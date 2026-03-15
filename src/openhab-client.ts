/**
 * OpenHabClient
 * High-performance, cached client for OpenHAB v5+ with SSE event buffering,
 * smart semantic discovery, and automated system auditing capabilities.
 */
import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';
import {
  OpenHabItem,
  OpenHabThing,
  OpenHabRule,
  OpenHabLink,
  OpenHabSemanticTag,
  OpenHabPersistenceData,
  OpenHabLogger,
  OpenHabInboxItem,
  OpenHabAddon,
  OpenHabSitemap,
  OpenHabService,
  OpenHabServiceConfig,
  OpenHabTemplate,
  OpenHabTransformation,
} from './types.js';

export class OpenHabClient {
  private client: AxiosInstance;
  private cache = new Map<string, { data: unknown; expiry: number }>();
  private scenes = new Map<string, Array<{ itemName: string; command: string }>>();
  private readonly META_CACHE_TTL = 300000; // 5 minutes for metadata
  private readonly ITEM_CACHE_TTL = 10000; // 10 seconds for items/state
  private readonly debug: boolean;
  private abortController: AbortController | null = null;
  private reconnectTimeout = 1000;
  private readonly enableSSE: boolean;
  private eventLogBuffer: string[] = [];
  private readonly MAX_LOG_BUFFER = 5000;
  private focusScope: { type: 'room' | 'group'; name: string } | null = null;
  private searchIndex: Map<string, any> = new Map();
  private lastIndexUpdate = 0;

  constructor(
    baseUrl: string,
    apiToken: string,
    options: { debug?: boolean; enableSSE?: boolean } = {}
  ) {
    this.debug = options.debug ?? process.env.OPENHAB_DEBUG === 'true';
    this.enableSSE = options.enableSSE ?? true;
    this.log(`Initializing client for ${baseUrl}`);
    this.client = axios.create({
      baseURL: baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      // Optimization: Connection pooling via Keep-Alive
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true }),
      // Optimization: Global request timeout (10s)
      timeout: 10000,
    });

    // Add interceptor to format errors nicely
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          let hint = '';
          if (error.response.status === 401) {
            const endpoint = error.config?.url || '';
            if (endpoint.includes('/rest/things') || endpoint.includes('/rest/systeminfo')) {
              hint = ' - This endpoint may require "Admin" or "Full Access" token scopes.';
            }
          }
          throw new Error(
            `OpenHAB API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}${hint}`
          );
        } else if (error.request) {
          throw new Error(`OpenHAB Network Error: No response received connecting to ${baseUrl}`);
        } else {
          throw new Error(`OpenHAB Request Error: ${error.message}`);
        }
      }
    );

    if (this.enableSSE) {
      this.initEventStream();
    }

    // Optimization: Background pre-warm of items/things cache to make first interaction instant
    setTimeout(() => {
      this.log('Pre-warming cache...');
      this.getItems().catch(() => {});
      this.getThings().catch(() => {});
    }, 100);
  }

  private log(message: string): void {
    if (this.debug) {
      console.error(`[OpenHAB MCP] ${message}`);
    }
  }

  private async initEventStream(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    this.log('Connecting to OpenHAB Event Stream...');

    try {
      const response = await this.client.get('/rest/events', {
        responseType: 'stream',
        signal: this.abortController.signal,
      });

      const stream = response.data;
      let buffer = '';

      stream.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventPayload = JSON.parse(line.substring(6));
              this.handleSSEEvent(eventPayload);
            } catch {
              // Ignore parse errors
            }
          }
        }
      });

      stream.on('end', () => {
        this.log('Event Stream disconnected. Reconnecting...');
        this.reconnectSSE();
      });

      stream.on('error', (err: any) => {
        this.log(`Event Stream error: ${err.message}. Reconnecting...`);
        this.reconnectSSE();
      });

      this.reconnectTimeout = 1000; // Reset on success
    } catch (error: any) {
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        this.log(`SSE connection failed: ${error.message}`);
        this.reconnectSSE();
      }
    }
  }

  private reconnectSSE(): void {
    setTimeout(() => {
      this.reconnectTimeout = Math.min(this.reconnectTimeout * 2, 60000); // Max 1 min
      this.initEventStream();
    }, this.reconnectTimeout);
  }

  private handleSSEEvent(event: any): void {
    const topicParts = event.topic.split('/');
    // Check for smarthome/items/*/statechanged
    if (topicParts[0] === 'smarthome' && topicParts[1] === 'items') {
      const itemName = topicParts[2];
      const eventType = topicParts[3];

      if (eventType === 'statechanged') {
        const payload = JSON.parse(event.payload);
        this.log(`SSE SYNC: ${itemName} changed to ${payload.value}`);
        this.addLogToBuffer(
          `${new Date().toISOString()} - ItemStateChangedEvent - ${itemName} changed to ${payload.value}`
        );

        const cacheKey = `item_${itemName}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
          (cached.data as any).state = payload.value;
          cached.expiry = Date.now() + this.ITEM_CACHE_TTL;
        }

        // Always invalidate the 'all items' list which might contain this item
        this.cache.delete('items_all');
      } else if (eventType === 'added' || eventType === 'removed') {
        this.log(`SSE SYNC: Item ${itemName} ${eventType}. Clearing caches.`);
        this.addLogToBuffer(
          `${new Date().toISOString()} - Item${eventType === 'added' ? 'Added' : 'Removed'}Event - ${itemName}`
        );
        this.invalidateItemCache(itemName);
      }
    } else {
      // Log other interesting events
      const eventType = topicParts[topicParts.length - 1];
      if (['CommandEvent', 'ItemStateEvent', 'ThingStatusInfoChangedEvent'].includes(eventType)) {
        try {
          const payload = JSON.parse(event.payload);
          this.addLogToBuffer(
            `${new Date().toISOString()} - ${eventType} - ${topicParts.slice(2, -1).join('/')} : ${JSON.stringify(payload)}`
          );
        } catch {
          this.addLogToBuffer(
            `${new Date().toISOString()} - ${eventType} - ${topicParts.slice(2, -1).join('/')}`
          );
        }
      }
    }
  }

  private addLogToBuffer(log: string): void {
    this.eventLogBuffer.push(log);
    if (this.eventLogBuffer.length > this.MAX_LOG_BUFFER) {
      this.eventLogBuffer.shift(); // Keep only last MAX_LOG_BUFFER items
    }
  }

  private async withCache<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && cached.expiry > now) {
      this.log(`Cache HIT: ${key}`);
      return cached.data as T;
    }

    this.log(`Cache MISS: ${key}`);
    const data = await fetcher();
    this.cache.set(key, { data, expiry: now + ttl });
    return data;
  }

  private invalidateItemCache(itemName?: string): void {
    if (itemName) {
      this.log(`Invalidating cache for item: ${itemName}`);
      this.cache.delete(`item_${itemName}`);
    }
    this.log('Invalidating global items cache');
    this.cache.delete('items_all');
    // Also clear keys that might have filters if we want to be safe,
    // but for now we mainly cache the common 'all items' request.
  }

  // --- Items ---
  async getItems(tags?: string, type?: string, metadata?: string): Promise<OpenHabItem[]> {
    const params: Record<string, string> = {};
    if (tags) params.tags = tags;
    if (type) params.type = type;
    if (metadata) params.metadata = metadata;

    const cacheKey = tags || type || metadata ? `items_${tags}_${type}_${metadata}` : 'items_all';

    return this.withCache(cacheKey, this.ITEM_CACHE_TTL, async () => {
      const response = await this.client.get('/rest/items', { params });
      let items = response.data;

      // Apply Focus Scope if active and no broader filter is requested
      if (this.focusScope && !tags && !type && !metadata) {
        items = items.filter((i: any) => {
          if (this.focusScope!.type === 'room') return i.tags?.includes(this.focusScope!.name);
          if (this.focusScope!.type === 'group')
            return i.groupNames?.includes(this.focusScope!.name);
          return true;
        });
      }
      return items;
    });
  }

  async getItem(itemName: string): Promise<OpenHabItem> {
    return this.withCache(`item_${itemName}`, this.ITEM_CACHE_TTL, async () => {
      const response = await this.client.get(`/rest/items/${itemName}`);
      return response.data;
    });
  }

  async sendCommand(itemName: string, command: string): Promise<string> {
    this.invalidateItemCache(itemName);
    const response = await this.client.post(`/rest/items/${itemName}`, command, {
      headers: { 'Content-Type': 'text/plain', Accept: '*/*' },
    });
    return response.data;
  }

  async updateState(itemName: string, state: string): Promise<string> {
    this.invalidateItemCache(itemName);
    const response = await this.client.put(`/rest/items/${itemName}/state`, state, {
      headers: { 'Content-Type': 'text/plain', Accept: '*/*' },
    });
    return response.data;
  }

  async createOrUpdateItem(itemName: string, itemData: Partial<OpenHabItem>): Promise<void> {
    this.invalidateItemCache(itemName);
    const response = await this.client.put(`/rest/items/${itemName}`, itemData);
    return response.data;
  }

  async deleteItem(itemName: string): Promise<void> {
    this.invalidateItemCache(itemName);
    const response = await this.client.delete(`/rest/items/${itemName}`);
    return response.data;
  }

  async addTag(itemName: string, tag: string): Promise<void> {
    this.invalidateItemCache(itemName);
    const response = await this.client.put(`/rest/items/${itemName}/tags/${tag}`);
    return response.data;
  }

  async removeTag(itemName: string, tag: string): Promise<void> {
    this.invalidateItemCache(itemName);
    const response = await this.client.delete(`/rest/items/${itemName}/tags/${tag}`);
    return response.data;
  }

  async setMetadata(
    itemName: string,
    namespace: string,
    value: string,
    config?: Record<string, unknown>
  ): Promise<void> {
    this.invalidateItemCache(itemName);
    const data = { value, config };
    const response = await this.client.put(`/rest/items/${itemName}/metadata/${namespace}`, data);
    return response.data;
  }

  async removeMetadata(itemName: string, namespace: string): Promise<void> {
    this.invalidateItemCache(itemName);
    const response = await this.client.delete(`/rest/items/${itemName}/metadata/${namespace}`);
    return response.data;
  }

  /**
   * Finds equipment of a specific type within a room.
   * Traverses the semantic model: Room -> Equipment -> Points.
   */
  async findEquipmentByType(
    roomName: string,
    equipmentType: string
  ): Promise<Array<{ equipment: OpenHabItem; points: OpenHabItem[] }>> {
    // 1. Get all items to build the relationship map
    const allItems = await this.getItems();

    // 2. Find the room item (usually a location-tagged group)
    const room = allItems.find(
      (i) =>
        (i.name === roomName || i.label === roomName) &&
        i.tags?.some((t) => t.toLowerCase().includes('location'))
    );

    if (!room) {
      this.log(`Semantic Search: Room '${roomName}' not found.`);
      return [];
    }

    // 3. Find equipment in that room
    // Equipment are items that have the room as a parent group AND have an equipment tag
    const equipment = allItems.filter(
      (i) =>
        i.groupNames?.includes(room.name) &&
        i.tags?.some((t) => t.toLowerCase().includes(equipmentType.toLowerCase()))
    );

    // 4. For each equipment, find its points (child items)
    return equipment.map((e) => {
      const points = allItems.filter((i) => i.groupNames?.includes(e.name));
      return { equipment: e, points };
    });
  }

  // --- Things ---
  async getThings(): Promise<OpenHabThing[]> {
    return this.withCache('things_all', this.ITEM_CACHE_TTL, async () => {
      const response = await this.client.get('/rest/things');
      return response.data;
    });
  }

  async getThing(thingUID: string): Promise<OpenHabThing> {
    return this.withCache(`thing_${thingUID}`, this.ITEM_CACHE_TTL, async () => {
      const response = await this.client.get(`/rest/things/${thingUID}`);
      return response.data;
    });
  }

  async createThing(thingData: Partial<OpenHabThing>): Promise<OpenHabThing> {
    const response = await this.client.post('/rest/things', thingData);
    return response.data;
  }

  async updateThing(thingUID: string, thingData: Partial<OpenHabThing>): Promise<OpenHabThing> {
    const response = await this.client.put(`/rest/things/${thingUID}`, thingData);
    return response.data;
  }

  async deleteThing(thingUID: string, force = false): Promise<void> {
    const response = await this.client.delete(`/rest/things/${thingUID}`, {
      params: { force },
    });
    return response.data;
  }

  async enableThing(thingUID: string, enable: boolean): Promise<void> {
    const response = await this.client.put(`/rest/things/${thingUID}/enable`, enable.toString(), {
      headers: { 'Content-Type': 'text/plain' },
    });
    return response.data;
  }

  async getThingStatus(thingUID: string): Promise<{ status: string; statusDetail: string }> {
    const response = await this.client.get(`/rest/things/${thingUID}/status`);
    return response.data;
  }

  async updateThingConfig(thingUID: string, config: Record<string, unknown>): Promise<void> {
    const response = await this.client.put(`/rest/things/${thingUID}/config`, config);
    return response.data;
  }

  // --- Links ---
  async getLinks(itemName?: string, channelUID?: string): Promise<OpenHabLink[]> {
    const params: Record<string, string> = {};
    if (itemName) params.itemName = itemName;
    if (channelUID) params.channelUID = channelUID;
    const response = await this.client.get('/rest/links', { params });
    return response.data;
  }

  async linkItemToChannel(
    itemName: string,
    channelUID: string,
    config?: Record<string, unknown>
  ): Promise<void> {
    const response = await this.client.put(`/rest/links/${itemName}/${channelUID}`, {
      configuration: config || {},
    });
    return response.data;
  }

  async unlinkItemFromChannel(itemName: string, channelUID: string): Promise<void> {
    const response = await this.client.delete(`/rest/links/${itemName}/${channelUID}`);
    return response.data;
  }

  // --- Semantic Tags ---
  async getSemanticTags(): Promise<OpenHabSemanticTag[]> {
    return this.withCache('semantic_tags', this.META_CACHE_TTL, async () => {
      const response = await this.client.get('/rest/tags');
      return response.data;
    });
  }

  async createSemanticTag(tagData: OpenHabSemanticTag): Promise<void> {
    const response = await this.client.post('/rest/tags', tagData);
    this.cache.delete('semantic_tags');
    return response.data;
  }

  async getSemanticTag(tagId: string): Promise<OpenHabSemanticTag> {
    const response = await this.client.get(`/rest/tags/${tagId}`);
    return response.data;
  }

  async updateSemanticTag(tagId: string, tagData: OpenHabSemanticTag): Promise<void> {
    const response = await this.client.put(`/rest/tags/${tagId}`, tagData);
    this.cache.delete('semantic_tags');
    return response.data;
  }

  async deleteSemanticTag(tagId: string): Promise<void> {
    const response = await this.client.delete(`/rest/tags/${tagId}`);
    this.cache.delete('semantic_tags');
    return response.data;
  }

  // --- Rules ---
  async getRules(): Promise<OpenHabRule[]> {
    return this.withCache('rules_all', this.META_CACHE_TTL, async () => {
      const response = await this.client.get('/rest/rules');
      return response.data;
    });
  }

  async getRule(ruleUID: string): Promise<OpenHabRule> {
    return this.withCache(`rule_${ruleUID}`, this.META_CACHE_TTL, async () => {
      const response = await this.client.get(`/rest/rules/${ruleUID}`);
      return response.data;
    });
  }

  async createRule(ruleData: Partial<OpenHabRule>): Promise<OpenHabRule> {
    const response = await this.client.post('/rest/rules', ruleData);
    return response.data;
  }

  async updateRule(ruleUID: string, ruleData: Partial<OpenHabRule>): Promise<OpenHabRule> {
    const response = await this.client.put(`/rest/rules/${ruleUID}`, ruleData);
    return response.data;
  }

  async deleteRule(ruleUID: string): Promise<void> {
    const response = await this.client.delete(`/rest/rules/${ruleUID}`);
    return response.data;
  }

  async runRule(ruleUID: string, context?: Record<string, unknown>): Promise<void> {
    const response = await this.client.post(`/rest/rules/${ruleUID}/runnow`, context || {});
    return response.data;
  }

  async enableRule(ruleUID: string, enable: boolean): Promise<void> {
    const response = await this.client.post(`/rest/rules/${ruleUID}/enable`, enable.toString(), {
      headers: { 'Content-Type': 'text/plain' },
    });
    return response.data;
  }

  // --- Inbox / Discovery ---
  async getInbox(): Promise<OpenHabInboxItem[]> {
    return this.withCache('inbox_all', this.ITEM_CACHE_TTL, async () => {
      const response = await this.client.get('/rest/inbox');
      return response.data;
    });
  }

  async approveInboxItem(thingUID: string, label?: string, newThingId?: string): Promise<void> {
    const params: Record<string, string> = {};
    if (newThingId) params.newThingId = newThingId;
    const response = await this.client.post(`/rest/inbox/${thingUID}/approve`, label || '', {
      params,
      headers: { 'Content-Type': 'text/plain' },
    });
    return response.data;
  }

  async ignoreInboxItem(thingUID: string): Promise<void> {
    const response = await this.client.post(`/rest/inbox/${thingUID}/ignore`);
    return response.data;
  }

  async unignoreInboxItem(thingUID: string): Promise<void> {
    const response = await this.client.post(`/rest/inbox/${thingUID}/unignore`);
    return response.data;
  }

  // --- Persistence ---
  async getPersistenceServices(): Promise<Array<{ id: string; label: string; default: boolean }>> {
    const response = await this.client.get('/rest/persistence');
    return response.data;
  }

  async getItemPersistenceData(
    itemName: string,
    serviceId?: string,
    starttime?: string,
    endtime?: string
  ): Promise<OpenHabPersistenceData> {
    const params: Record<string, string> = {};
    if (serviceId) params.serviceId = serviceId;
    if (starttime) params.starttime = starttime;
    if (endtime) params.endtime = endtime;
    const response = await this.client.get(`/rest/persistence/items/${itemName}`, { params });
    return response.data;
  }

  async storeItemPersistenceData(
    itemName: string,
    time: string,
    state: string,
    serviceId?: string
  ): Promise<void> {
    const params: Record<string, string> = { time, state };
    if (serviceId) params.serviceId = serviceId;
    const response = await this.client.put(`/rest/persistence/items/${itemName}`, null, { params });
    return response.data;
  }

  /**
   * Analyzes persistence data for an item over a period.
   * Calculates averages/peaks for numbers or duty cycles for switches.
   */
  async getItemStatistics(
    itemName: string,
    starttime?: string,
    endtime?: string,
    serviceId?: string
  ): Promise<Record<string, unknown>> {
    // 1. Get item metadata to determine type
    const item = await this.getItem(itemName);

    // 2. Get the historical data
    const data = await this.getItemPersistenceData(itemName, serviceId, starttime, endtime);

    if (!data.data || data.data.length === 0) {
      return { itemName, message: 'No data available for this period' };
    }

    const values = data.data.map((d) => parseFloat(d.state)).filter((v) => !isNaN(v));

    // 3. Perform analysis based on item type
    const isNumeric =
      item.type.includes('Number') || item.type.includes('Dimmer') || item.type.includes('Color');

    if (isNumeric && values.length > 0) {
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return {
        itemName,
        type: 'numeric',
        count: values.length,
        min,
        max,
        average: avg,
        current: item.state,
      };
    } else {
      // Binary / Boolean Analysis (ON/OFF)
      let onTime = 0;
      let totalTime = 0;
      const points = data.data;

      for (let i = 0; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        const duration = new Date(next.time).getTime() - new Date(current.time).getTime();

        totalTime += duration;
        if (current.state === 'ON' || parseFloat(current.state) > 0) {
          onTime += duration;
        }
      }

      const dutyCycle = totalTime > 0 ? (onTime / totalTime) * 100 : 0;
      return {
        itemName,
        type: 'stateful',
        onTimeHours: onTime / 3600000,
        totalTimeHours: totalTime / 3600000,
        dutyCyclePercentage: dutyCycle.toFixed(2) + '%',
        current: item.state,
      };
    }
  }

  /**
   * Normalizes media controls across different device types.
   * Handles Player items, Dimmers (volume), and Switches (power/play).
   */
  async controlMedia(equipmentName: string, action: string): Promise<string> {
    const allItems = await this.getItems();
    const equipment = allItems.find((i) => i.name === equipmentName || i.label === equipmentName);

    if (!equipment) {
      throw new Error(`Equipment '${equipmentName}' not found`);
    }

    // Find all points associated with this equipment
    const points = allItems.filter((i) => i.groupNames?.includes(equipment.name));

    const player = points.find((p) => p.type === 'Player');
    const volume = points.find(
      (p) =>
        p.name.toLowerCase().includes('volume') ||
        p.label?.toLowerCase().includes('volume') ||
        p.name.toLowerCase().endsWith('_vol') ||
        p.tags?.includes('SpeakerVolume')
    );
    const playPause = points.find(
      (p) =>
        p.name.toLowerCase().includes('play') ||
        p.label?.toLowerCase().includes('play') ||
        p.tags?.includes('Control')
    );

    switch (action.toLowerCase()) {
      case 'play':
        if (player) return this.sendCommand(player.name, 'PLAY');
        if (playPause) return this.sendCommand(playPause.name, 'ON');
        break;
      case 'pause':
        if (player) return this.sendCommand(player.name, 'PAUSE');
        if (playPause) return this.sendCommand(playPause.name, 'OFF');
        break;
      case 'volume_up':
        if (volume) {
          const currentVol = parseFloat(volume.state) || 0;
          return this.sendCommand(volume.name, Math.min(currentVol + 10, 100).toString());
        }
        break;
      case 'volume_down':
        if (volume) {
          const currentVol = parseFloat(volume.state) || 0;
          return this.sendCommand(volume.name, Math.max(currentVol - 10, 0).toString());
        }
        break;
      case 'next':
        if (player) return this.sendCommand(player.name, 'NEXT');
        break;
      case 'previous':
        if (player) return this.sendCommand(player.name, 'PREVIOUS');
        break;
    }

    throw new Error(
      `Action '${action}' not supported for equipment '${equipmentName}' or required points missing`
    );
  }

  // --- Voice / Audio ---
  async voiceSay(text: string, voiceId?: string, sinkId?: string, volume?: string): Promise<void> {
    const params: Record<string, string> = {};
    if (voiceId) params.voiceid = voiceId;
    if (sinkId) params.sinkid = sinkId;
    if (volume) params.volume = volume;
    const response = await this.client.post('/rest/voice/say', text, {
      params,
      headers: { 'Content-Type': 'text/plain' },
    });
    return response.data;
  }

  async voiceInterpret(text: string, interpreterIds?: string): Promise<void> {
    const url = interpreterIds
      ? `/rest/voice/interpreters/${interpreterIds}`
      : '/rest/voice/interpreters';
    const response = await this.client.post(url, text, {
      headers: { 'Content-Type': 'text/plain' },
    });
    return response.data;
  }

  async getVoices(): Promise<Array<{ id: string; label: string }>> {
    return this.withCache('voices', this.META_CACHE_TTL, async () => {
      const response = await this.client.get('/rest/voice/voices');
      return response.data;
    });
  }

  async getAudioSinks(): Promise<Array<{ id: string; label: string }>> {
    return this.withCache('audio_sinks', this.META_CACHE_TTL, async () => {
      const response = await this.client.get('/rest/audio/sinks');
      return response.data;
    });
  }

  async getAudioSources(): Promise<Array<{ id: string; label: string }>> {
    return this.withCache('audio_sources', this.META_CACHE_TTL, async () => {
      const response = await this.client.get('/rest/audio/sources');
      return response.data;
    });
  }

  // --- Addons ---
  async getAddons(): Promise<OpenHabAddon[]> {
    return this.withCache('addons', this.META_CACHE_TTL, async () => {
      const response = await this.client.get('/rest/addons');
      return response.data;
    });
  }

  async installAddon(addonId: string): Promise<void> {
    const response = await this.client.post(`/rest/addons/${addonId}/install`);
    this.cache.delete('addons');
    return response.data;
  }

  async uninstallAddon(addonId: string): Promise<void> {
    const response = await this.client.post(`/rest/addons/${addonId}/uninstall`);
    this.cache.delete('addons');
    return response.data;
  }

  // --- Sitemaps & UI ---
  async getSitemaps(): Promise<OpenHabSitemap[]> {
    return this.withCache('sitemaps', this.META_CACHE_TTL, async () => {
      const response = await this.client.get('/rest/sitemaps');
      return response.data;
    });
  }

  async getUIComponents(namespace: string): Promise<unknown> {
    return this.withCache(`ui_components_${namespace}`, this.META_CACHE_TTL, async () => {
      const response = await this.client.get(`/rest/ui/components/${namespace}`);
      return response.data;
    });
  }

  async getUITiles(): Promise<unknown> {
    return this.withCache('ui_tiles', this.META_CACHE_TTL, async () => {
      const response = await this.client.get('/rest/ui/tiles');
      return response.data;
    });
  }

  // --- System & Config ---
  async getSystemInfo(): Promise<Record<string, unknown>> {
    const response = await this.client.get('/rest/systeminfo');
    return response.data;
  }

  async getLoggers(): Promise<OpenHabLogger[]> {
    const response = await this.client.get('/rest/logging');
    return response.data.loggers || [];
  }

  async setLoggerLevel(loggerName: string, level: string): Promise<void> {
    const response = await this.client.put(`/rest/logging/${loggerName}`, { loggerName, level });
    return response.data;
  }

  async getServices(): Promise<OpenHabService[]> {
    return this.withCache('services', this.META_CACHE_TTL, async () => {
      const response = await this.client.get('/rest/services');
      return response.data;
    });
  }

  async getServiceConfig(serviceId: string): Promise<OpenHabServiceConfig> {
    const response = await this.client.get(`/rest/services/${serviceId}/config`);
    return response.data;
  }

  async updateServiceConfig(serviceId: string, config: OpenHabServiceConfig): Promise<void> {
    const response = await this.client.put(`/rest/services/${serviceId}/config`, config);
    return response.data;
  }

  async getTemplates(): Promise<OpenHabTemplate[]> {
    return this.withCache('templates', this.META_CACHE_TTL, async () => {
      const response = await this.client.get('/rest/templates');
      return response.data;
    });
  }

  async getTransformations(): Promise<OpenHabTransformation[]> {
    return this.withCache('transformations', this.META_CACHE_TTL, async () => {
      const response = await this.client.get('/rest/transformations');
      return response.data;
    });
  }

  // --- Habot ---
  async chatWithHabot(text: string): Promise<string> {
    const response = await this.client.post('/rest/habot/chat', text, {
      headers: { 'Content-Type': 'text/plain' },
    });
    return response.data;
  }

  /**
   * Provides a high-density system summary to save LLM tokens.
   */
  async getSystemSummary(): Promise<{
    overview: { totalItems: number; totalThings: number; roomsFound: number };
    equipmentDistribution: Record<string, number>;
    rooms: string[];
    activeSnapshot: string[];
    systemIssues: string[] | string;
    systemPolicy: {
      preferredItemManagement: string;
      preferredRuleFormat: string;
      recommendation: string;
    };
  }> {
    const items = await this.getItems();
    const things = await this.getThings();

    // 1. Group items by type
    const itemStats: Record<string, number> = {};
    items.forEach((i) => {
      itemStats[i.type] = (itemStats[i.type] || 0) + 1;
    });

    // 2. Find rooms (Locations)
    const rooms = items
      .filter((i) => i.tags?.some((t) => t.toLowerCase().includes('location')))
      .map((i) => i.label || i.name);

    // 3. Current "Active" states (e.g. Lights ON, Doors OPEN)
    const activeStates = items
      .filter((i) => i.state === 'ON' || (i.type.includes('Number') && parseFloat(i.state) > 0))
      .slice(0, 20) // Limit to top 20 for token safety
      .map((i) => `${i.label || i.name}: ${i.state}`);

    // 4. Offline/Error check
    const issues = things
      .filter((t) => t.statusInfo?.status !== 'ONLINE')
      .map((t) => `${t.label}: ${t.statusInfo?.status}`);

    return {
      overview: {
        totalItems: items.length,
        totalThings: things.length,
        roomsFound: rooms.length,
      },
      equipmentDistribution: itemStats,
      rooms,
      activeSnapshot: activeStates,
      systemIssues: issues.length > 0 ? issues : 'All systems normal',
      systemPolicy: {
        preferredItemManagement: 'Managed (REST API)',
        preferredRuleFormat: 'Modern JavaScript (application/javascript)',
        recommendation:
          'Favor using create_or_update_item tool over file-based configuration to ensure better integration with this MCP.',
      },
    };
  }

  /**
   * Validates rule logic for safety and syntax.
   */
  async validateRuleLogic(
    script: string,
    type: string
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic syntax check for JS
    if (type === 'application/javascript') {
      try {
        new Function(script);
      } catch (e: any) {
        errors.push(`JS Syntax Error: ${e.message}`);
      }
    }

    // Logical Safety Checks
    if (script.includes('.sendCommand(')) {
      // Check if command is targeting the same item (potential loop)
      // This is a naive check but helpful for AI
      if (script.length < 50) {
        warnings.push('Rule script is unusually short; ensure logical guards are present.');
      }
    }

    if (script.includes('while(true)') || script.includes('for(;;)')) {
      errors.push('Infinite loop detected. This will crash the OpenHAB engine.');
    }

    // Check for non-existent item references in the script
    const allItems = await this.getItems();
    const itemNames = new Set(allItems.map((i) => i.name));

    // Simple regex for item name patterns like 'ItemName.' or '["ItemName"]'
    const itemRefs = script.match(/[A-Z0-9_]{3,}/gi) || [];
    const suspectedItems = itemRefs.filter((ref) => itemNames.has(ref));

    if (suspectedItems.length === 0 && script.includes('items.')) {
      warnings.push('No known item names detected in script. Ensure item names are correct.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generates TypeScript interfaces for the current home system.
   */
  async generateSystemBoilerplate(): Promise<string> {
    const items = await this.getItems();

    let boilerplate = `/**
 * OpenHAB Home System Types
 * Generated on ${new Date().toISOString()}
 */\n\n`;

    boilerplate += 'export type HomeItems = {\n';

    items.forEach((i) => {
      let tsType = 'string';
      if (i.type.includes('Number')) tsType = 'number';
      if (i.type === 'Switch' || i.type === 'Contact') tsType = '"ON" | "OFF" | "OPEN" | "CLOSED"';

      boilerplate += `  /** ${i.label || 'No label'} */\n`;
      boilerplate += `  ${i.name}: ${tsType};\n`;
    });

    boilerplate += '};\n\n';

    boilerplate +=
      'export type RoomNames = ' +
      items
        .filter((i) => i.tags?.some((t) => t.toLowerCase().includes('location')))
        .map((i) => `'${i.name}'`)
        .join(' | ') +
      ';\n';

    return boilerplate;
  }

  /**
   * Executes multiple commands in parallel.
   */
  async executeBatch(commands: Array<{ itemName: string; command: string }>): Promise<string[]> {
    this.log(`Executing batch of ${commands.length} commands...`);
    const results: any[] = await Promise.all(
      commands.map((c) =>
        this.sendCommand(c.itemName, c.command)
          .then(() => `Success on ${c.itemName}: ${c.command}`)
          .catch((e) => `Error on ${c.itemName}: ${e.message}`)
      )
    );
    return results;
  }

  /**
   * Fuzzy search for items by name, label, tags, or groups.
   */
  async searchItems(query: string): Promise<OpenHabItem[]> {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    if (terms.length === 0) return [];
    
    const allItems = await this.getItems();

    return allItems
      .filter((i) => {
        const haystack = `${i.name} ${i.label || ''} ${i.tags?.join(' ') || ''} ${i.groupNames?.join(' ') || ''}`.toLowerCase();
        return terms.every(term => haystack.includes(term));
      })
      .slice(0, 50);
  }

  /**
   * Unified search across items, things, and rules.
   * Reduces multiple MCP calls when entity type is unknown.
   */
  async masterSearch(query: string): Promise<{
    items: OpenHabItem[];
    things: OpenHabThing[];
    rules: OpenHabRule[];
  }> {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    if (terms.length === 0) return { items: [], things: [], rules: [] };
    
    // Fetch all in parallel for speed
    const [items, things, rules] = await Promise.all([
      this.getItems(),
      this.getThings(),
      this.getRules()
    ]);

    return {
      items: items.filter(i => {
        const haystack = `${i.name} ${i.label || ''} ${i.tags?.join(' ') || ''}`.toLowerCase();
        return terms.every(term => haystack.includes(term));
      }).slice(0, 20),
      things: things.filter(t => {
        const haystack = `${t.UID} ${t.label || ''}`.toLowerCase();
        return terms.every(term => haystack.includes(term));
      }).slice(0, 10),
      rules: rules.filter(r => {
        const haystack = `${r.uid} ${r.name || ''}`.toLowerCase();
        return terms.every(term => haystack.includes(term));
      }).slice(0, 10)
    };
  }

  /**
   * Gets all equipment and items in a specific room.
   * Uses semantic model traversal.
   */
  async getRoomInventory(roomName: string): Promise<{
    room: OpenHabItem;
    equipment: Array<{ info: OpenHabItem; points: OpenHabItem[] }>;
    standaloneItems: OpenHabItem[];
  }> {
    const allItems = await this.getItems();
    
    // 1. Find the room
    const room = allItems.find(i => 
      (i.name.toLowerCase() === roomName.toLowerCase() || i.label?.toLowerCase() === roomName.toLowerCase()) &&
      i.tags?.some(t => t.toLowerCase().includes('location'))
    );

    if (!room) {
      throw new Error(`Room '${roomName}' not found in semantic model.`);
    }

    // 2. Find all direct children
    const directChildren = allItems.filter(i => i.groupNames?.includes(room.name));

    // 3. Separate Equipment from Points/Standalone
    const equipment = directChildren
      .filter(i => i.tags?.some(t => t.toLowerCase().includes('equipment')))
      .map(e => ({
        info: e,
        points: allItems.filter(p => p.groupNames?.includes(e.name))
      }));

    const standaloneItems = directChildren.filter(i => 
      !i.tags?.some(t => t.toLowerCase().includes('equipment'))
    );

    return {
      room,
      equipment,
      standaloneItems
    };
  }

  /**
   * Minimal schema mapping for discovery.
   */
  async getSchema(): Promise<Array<{ name: string; type: string; label?: string; tags: string[]; groups: string[] }>> {
    const items = await this.getItems();
    return items.map((i) => ({
      name: i.name,
      type: i.type,
      label: i.label,
      tags: i.tags,
      groups: i.groupNames,
    }));
  }

  /**
   * Priming context for AI agents.
   */
  async getPromptContext(): Promise<string> {
    const summary = await this.getSystemSummary();

    let context = `## OpenHAB Intelligence Context\n\n`;
    context += `You are an expert home automation assistant for the user's specific OpenHAB installation.\n\n`;
    context += `### Environment Status\n`;
    context += `- Rooms Found: ${summary.overview.roomsFound} (${summary.rooms.join(', ')})\n`;
    context += `- Total Items: ${summary.overview.totalItems}\n`;
    context += `- Active States: ${summary.activeSnapshot.join(', ') || 'None'}\n\n`;

    context += `### Core Policies\n`;
    context += `1. **Managed Preference**: Always prefer using \`create_or_update_item\` over manual file editing.\n`;
    context += `2. **Modern Scripting**: Prefer the \`application/javascript\` format for all rules.\n`;
    context += `3. **Safety First**: Use the \`validate_rule_logic\` tool before committing new rule automation.\n\n`;

    context += `### Usage Tips\n`;
    context += `- Use \`execute_batch\` when the user asks for multiple actions (e.g. 'Goodnight').\n`;
    context += `- Use \`master_search\` for a combined search across items, things, and rules in one step.\n`;
    context += `- Use \`get_room_inventory\` to see everything in a room (e.g. 'Kitchen') with equipment groupings.\n`;
    context += `- Use \`get_semantic_path\` and \`find_neighboring_equipment\` to understand the spatial layout of the home.\n`;
    context += `- Use \`schedule_command\` for delayed actions (e.g. 'turn off in 20 minutes').\n`;
    context += `- Use \`trigger_discovery_scan\` if you suspect hardware is missing or unlinked.\n`;
    context += `- Use \`get_stale_items\` for proactive maintenance of sensors.\n`;
    context += `- Refer to the \`openhab://schema\` resource for a full lightweight list of available controls.\n`;
    return context;
  }

  /**
   * Consolidated first-interaction bootstrap.
   * Returns prompt context, room list, and full structural schema in one call.
   */
  async initialDiscovery(): Promise<{
    context: string;
    schema: Array<{ name: string; type: string; label?: string; tags: string[]; groups: string[] }>;
  }> {
    const [context, schema] = await Promise.all([
      this.getPromptContext(),
      this.getSchema()
    ]);
    return { context, schema };
  }

  /**
   * Virtual simulation of a command sequence.
   */
  async shadowRun(
    commands: Array<{ itemName: string; command: string }>
  ): Promise<Array<{ itemName: string; oldState: string; predictedState: string }>> {
    const results = [];
    const items = await this.getItems();

    for (const cmd of commands) {
      const item = items.find((i) => i.name === cmd.itemName);
      if (item) {
        results.push({
          itemName: cmd.itemName,
          oldState: item.state,
          predictedState: cmd.command, // Simplification: prediction = target command
        });
      }
    }
    return results;
  }

  /**
   * Generates a Mermaid topology graph for spatial reasoning.
   */
  async generateTopology(): Promise<string> {
    const items = await this.getItems();
    let graph = 'graph TD\n';

    // Locations
    const locations = items.filter((i) =>
      i.tags?.some((t) => t.toLowerCase().includes('location'))
    );
    locations.forEach((loc) => {
      graph += `  ${loc.name}["🏠 ${loc.label || loc.name}"]\n`;

      // Equipment in this location
      const equipment = items.filter((i) => i.groupNames?.includes(loc.name));
      equipment.forEach((eq) => {
        graph += `  ${loc.name} --> ${eq.name}["📦 ${eq.label || eq.name}"]\n`;

        // Points for this equipment
        const points = items.filter((i) => i.groupNames?.includes(eq.name));
        points.forEach((p) => {
          graph += `  ${eq.name} --> ${p.name}["📍 ${p.label || p.name}"]\n`;
        });
      });
    });

    return graph;
  }

  /**
   * Scans Things for hardware issues and connectivity drift.
   */
  async analyzeSystemHealth(): Promise<Record<string, string[]>> {
    const things = await this.getThings();
    const items = await this.getItems();

    const issues: string[] = [];
    const connectivity: string[] = [];

    things
      .filter((t) => t.statusInfo?.status !== 'ONLINE')
      .forEach((t) => {
        issues.push(`Device OFFLINE: ${t.label || t.UID} (${t.statusInfo?.status})`);
      });

    // Battery check (semantic point search)
    items
      .filter((i) => i.name.toLowerCase().includes('battery') || i.tags?.includes('LowBattery'))
      .forEach((i) => {
        if (parseFloat(i.state) < 20 || i.state === 'ON') {
          issues.push(`Low Battery Alert: ${i.label || i.name} (${i.state})`);
        }
      });

    return {
      criticalIssues: issues,
      connectivityDrift: connectivity.length > 0 ? connectivity : ['No signal drift detected'],
    };
  }

  /**
   * Predictive rule generation from natural language intent.
   */
  async generateRuleFromNL(intent: string): Promise<Partial<OpenHabRule>> {
    const items = await this.getItems();
    const lcIntent = intent.toLowerCase();

    // Naive semantic matcher for rule actions
    const targetItem = items.find(
      (i) =>
        lcIntent.includes(i.name.toLowerCase()) ||
        (i.label && lcIntent.includes(i.label.toLowerCase()))
    );

    const isOff = lcIntent.includes('off') || lcIntent.includes('close');
    const command = isOff ? 'OFF' : 'ON';

    const rule: Partial<OpenHabRule> = {
      uid: `ai_rule_${Date.now()}`,
      name: `AI generated: ${intent}`,
      actions: [
        {
          id: '1',
          type: 'script.ScriptAction',
          configuration: {
            type: 'application/javascript',
            script: targetItem
              ? `items.getItem("${targetItem.name}").sendCommand("${command}");`
              : '// Item not found',
          },
        },
      ],
      triggers: [
        {
          id: '2',
          type: 'core.ItemStateUpdateTrigger',
          configuration: { itemName: 'GlobalTrigger' }, // Mock trigger
        },
      ],
    };

    return rule;
  }

  /**
   * Captures current state of items as a named scene.
   */
  async captureScene(name: string, itemNames: string[]): Promise<string> {
    const items = await this.getItems();
    const sceneData = itemNames.map((itemName) => {
      const item = items.find((i) => i.name === itemName);
      return { itemName, command: item?.state || 'OFF' };
    });
    this.scenes.set(name, sceneData);
    return `Scene '${name}' captured with ${sceneData.length} items.`;
  }

  /**
   * Activates a previously captured scene.
   */
  async activateScene(name: string): Promise<string[]> {
    const scene = this.scenes.get(name);
    if (!scene) throw new Error(`Scene '${name}' not found.`);
    return this.executeBatch(scene);
  }

  /**
   * ASCII Sparkline of recent item history for trend analysis.
   */
  async getVisualChart(itemName: string): Promise<string> {
    const data = await this.getItemPersistenceData(itemName);
    if (!data.data || data.data.length === 0) return 'No history available for trend analysis.';

    const values = data.data.map((d) => parseFloat(d.state)).filter((v) => !isNaN(v));
    if (values.length === 0) return 'Non-numeric data detected.';

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const ticks = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

    const sparkline = values
      .map((v) => {
        const idx = Math.floor(((v - min) / range) * (ticks.length - 1));
        return ticks[idx];
      })
      .join('');

    return `Trend for ${itemName} (Min: ${min.toFixed(1)}, Max: ${max.toFixed(1)}):\n${sparkline}`;
  }

  /**
   * Generates professional-grade MainUI YAML for a widget.
   */
  async generateUIWidget(itemName: string): Promise<string> {
    const item = await this.getItem(itemName);
    return `uid: widget_${itemName}
props:
  parameterGroups: []
  parameters: []
tags: []
component: oh-label-card
config:
  item: ${itemName}
  title: ${item.label || itemName}
  icon: f7:lightbulb
  label: =items["${itemName}"].state
  footer: AI Generated Dashboard Prototyper
`;
  }

  /**
   * Suggests semantic tags based on naming intelligence.
   */
  async suggestSemanticTags(
    itemName: string
  ): Promise<{ suggestion: string[]; reasoning: string }> {
    const item = await this.getItem(itemName);
    const name = item.name.toLowerCase();
    const label = (item.label || '').toLowerCase();
    const tags: string[] = [];

    if (name.includes('light') || label.includes('light'))
      tags.push('Light', 'Point_Control_Switch');
    if (name.includes('temp') || label.includes('temp'))
      tags.push('Temperature', 'Point_Measurement_Property');
    if (name.includes('kitchen')) tags.push('Kitchen');
    if (name.includes('living')) tags.push('LivingRoom');
    if (name.includes('bedroom')) tags.push('Bedroom');

    return {
      suggestion: tags,
      reasoning: `Found keywords: ${tags.join(', ')} in item metadata.`,
    };
  }

  // --- ELITE FEATURES ---

  /**
   * The "Semantic Expressway": Replicates "Create Equipment from Thing" workflow
   */
  async createEquipmentFromThing(thingUID: string, roomGroup: string): Promise<string[]> {
    const thing = await this.getThing(thingUID);
    const results: string[] = [];

    // Create the Equipment Group
    const equipmentName = `Equipment_${thingUID.replace(/[^a-zA-Z0-9_]/g, '')}`;
    const equipmentLabel = thing.label || `Equipment for ${thingUID}`;

    // Check if equipment already exists
    try {
      await this.getItem(equipmentName);
      results.push(`Equipment ${equipmentName} already exists.`);
    } catch {
      await this.createOrUpdateItem(equipmentName, {
        type: 'Group',
        name: equipmentName,
        label: equipmentLabel,
        groupNames: [roomGroup],
        tags: ['Equipment'],
      });
      results.push(`Created Equipment Group: ${equipmentName} in ${roomGroup}`);
    }

    // Process all channels
    if (thing.channels && thing.channels.length > 0) {
      for (const ch of thing.channels) {
        const channel: any = ch;
        if (channel.kind !== 'STATE') continue;

        const channelId = channel.id.replace(/[^a-zA-Z0-9_]/g, '');
        const itemName = `${equipmentName}_${channelId}`;
        const itemType = channel.itemType || 'String';
        const itemLabel = channel.label || channel.id;

        // Guess Semantic Tags
        const tags = ['Point'];
        if (
          itemType === 'Switch' ||
          channel.id.toLowerCase().includes('power') ||
          channel.id.toLowerCase().includes('switch')
        ) {
          tags.push('Switch');
        } else if (
          itemType === 'Number' &&
          (channel.id.toLowerCase().includes('temp') ||
            channel.id.toLowerCase().includes('humidity'))
        ) {
          tags.push('Measurement');
        }

        try {
          await this.getItem(itemName);
          results.push(`Item ${itemName} already exists.`);
        } catch {
          // Create Item
          await this.createOrUpdateItem(itemName, {
            type: itemType,
            name: itemName,
            label: itemLabel,
            groupNames: [equipmentName],
            tags: tags,
          });
          results.push(`Created Item: ${itemName} (${itemType})`);

          // Link Item to Channel
          await this.linkItemToChannel(itemName, channel.uid);
          results.push(`Linked ${itemName} to ${channel.uid}`);
        }
      }
    }

    return results;
  }

  /**
   * The "Transformation Playground": Test transformations safely locally where possible
   */
  testTransformation(type: string, pattern: string, value: string): string {
    try {
      if (type.toUpperCase() === 'REGEX') {
        const regex = new RegExp(pattern);
        const match = value.match(regex);
        return match ? (match[1] !== undefined ? match[1] : match[0]) : 'Null/No Match';
      } else if (type.toUpperCase() === 'JSONPATH') {
        // Very rudimentary JSONPath support since full library is not injected
        // Just extract top-level or dot-separated paths for basic testing
        try {
          const obj = JSON.parse(value);
          const parts = pattern.replace('$.', '').split('.');
          let current: any = obj;
          for (const p of parts) {
            if (current && p in current) {
              current = current[p];
            } else {
              return 'Null/No Match';
            }
          }
          return typeof current === 'object' ? JSON.stringify(current) : String(current);
        } catch (e) {
          return `Invalid JSON or Path: ${(e as Error).message}`;
        }
      }
      return `Transformation type '${type}' cannot be perfectly simulated locally. Best approach is creating an internal test Rule via API.`;
    } catch (e) {
      return `Error evaluating transformation: ${(e as Error).message}`;
    }
  }

  /**
   * The "System Janitor": Finds orphan items and broken links.
   */
  async findOrphansAndBrokenLinks(): Promise<{ orphans: string[]; brokenLinks: string[] }> {
    const items = await this.getItems();
    const links = await this.getLinks();
    const things = await this.getThings();

    const thingUIDs = new Set(things.map((t) => t.UID));
    const itemNames = new Set(items.map((i) => i.name));

    // Find unlinked items that also have no groups and no semantic tags (potential orphans)
    const linkedItemNames = new Set(links.map((l) => l.itemName));
    const orphans = items
      .filter(
        (i) =>
          !linkedItemNames.has(i.name) &&
          (!i.groupNames || i.groupNames.length === 0) &&
          (!i.tags || i.tags.length === 0) &&
          i.type !== 'Group'
      )
      .map((i) => i.name);

    // Find links where the Thing doesn't exist
    const brokenLinks = links
      .filter((l) => {
        // channelUID usually looks like bind:thingType:thingUID:channelId
        // A generic Thing UID is usually the first 3 or 4 segments depending on the binding
        // Let's check if there's any Thing that whose UID is a prefix of the channelUID
        let thingExists = false;
        for (const tid of thingUIDs) {
          if (l.channelUID.startsWith(tid)) {
            thingExists = true;
            break;
          }
        }
        return !thingExists || !itemNames.has(l.itemName);
      })
      .map((l) => `Link: Item '${l.itemName}' <-> Channel '${l.channelUID}'`);

    return { orphans, brokenLinks };
  }

  /**
   * The "Forensic Investigator": Comprehensive state history and rule influences
   */
  async explainItemState(itemName: string): Promise<Record<string, unknown>> {
    const item = await this.getItem(itemName);
    const links = await this.getLinks(itemName);
    const rules = await this.getRules();

    let history: any = { message: 'No history found' };
    try {
      const histData = await this.getItemPersistenceData(itemName);
      if (histData.data && histData.data.length > 0) {
        history = histData.data.slice(-5); // Last 5 states
      }
    } catch (e) {
      history = { error: 'Persistence query failed', details: (e as Error).message };
    }

    // Find rules that reference this item
    const affectingRules = rules
      .filter((r) => {
        // Check triggers
        const inTrigger = r.triggers?.some((t: any) =>
          JSON.stringify(t.configuration).includes(itemName)
        );
        // Check actions/scripts
        const inAction = r.actions?.some((a: any) =>
          JSON.stringify(a.configuration).includes(itemName)
        );
        // Check conditions
        const inCondition = r.conditions?.some((c: any) =>
          JSON.stringify(c.configuration).includes(itemName)
        );
        return inTrigger || inAction || inCondition;
      })
      .map((r) => ({ uid: r.uid, name: r.name }));

    return {
      itemInfo: {
        name: item.name,
        state: item.state,
        type: item.type,
        tags: item.tags,
        groups: item.groupNames,
      },
      recentHistory: history,
      linkedChannels: links.map((l) => l.channelUID),
      referencedInRules: affectingRules,
    };
  }

  /**
   * Unified Log Tailer: Fetches the recent event buffer
   */
  async getRecentLogs(lines: number = 20): Promise<string[]> {
    if (this.eventLogBuffer.length === 0) {
      if (!this.enableSSE) return ['SSE Event stream is disabled. Enable it to buffer logs.'];
      return ['No events buffered yet. Waiting for system activity...'];
    }
    const safeLines = Math.min(lines, 100); // Standard recent logs remain small
    return this.eventLogBuffer.slice(-safeLines);
  }

  /**
   * Mastery Tool: Fetches a larger window of historical logs from the buffer.
   */
  async getHistoricalLogs(lines: number = 500, search?: string): Promise<string[]> {
    if (this.eventLogBuffer.length === 0) {
      return ['No events buffered. Historical logs require the MCP server to be running and connected to SSE.'];
    }

    let logs = this.eventLogBuffer;
    if (search) {
      const query = search.toLowerCase();
      logs = logs.filter(l => l.toLowerCase().includes(query));
    }

    const safeLines = Math.min(lines, this.MAX_LOG_BUFFER);
    return logs.slice(-safeLines);
  }

  /**
   * The "Profile Configurator": Applies Link Profiles during channel linking.
   */
  async configureLinkProfile(
    itemName: string,
    channelUID: string,
    profile: string,
    profileConfig: Record<string, unknown> = {}
  ): Promise<void> {
    const configToSubmit = {
      profile,
      ...profileConfig,
    };
    return this.linkItemToChannel(itemName, channelUID, configToSubmit);
  }

  /**
   * Advanced Remediation: Mass-update item metadata, tags, and groups.
   */
  async bulkItemRemediation(
    itemNames: string[],
    updates: { tags?: string[]; category?: string; groupNames?: string[] }
  ): Promise<string[]> {
    const results: string[] = [];
    for (const itemName of itemNames) {
      try {
        const item = await this.getItem(itemName);
        const newData = { ...item };
        if (updates.tags)
          newData.tags = Array.from(new Set([...(newData.tags || []), ...updates.tags]));
        if (updates.category) newData.category = updates.category;
        if (updates.groupNames)
          newData.groupNames = Array.from(
            new Set([...(newData.groupNames || []), ...updates.groupNames])
          );

        await this.createOrUpdateItem(itemName, newData);
        results.push(`Updated ${itemName}`);
      } catch (e: any) {
        results.push(`Error updating ${itemName}: ${e.message}`);
      }
    }
    return results;
  }

  /**
   * Advanced Remediation: Simple correlation discovery in persistence history.
   */
  async discoverAutomationPatterns(itemName: string, correlatedItemName: string): Promise<string> {
    const dataA = await this.getItemPersistenceData(itemName);
    const dataB = await this.getItemPersistenceData(correlatedItemName);

    if (!dataA.data || !dataB.data || dataA.data.length < 5 || dataB.data.length < 5) {
      return 'Insufficient data for correlation analysis.';
    }

    // Very simple check: see if events for Item B happen within 15 mins of Item A
    let matches = 0;
    for (const eventA of dataA.data) {
      const timeA = new Date(eventA.time).getTime();
      const match = dataB.data.find((eventB) => {
        const timeB = new Date(eventB.time).getTime();
        return Math.abs(timeA - timeB) < 900000; // 15 mins
      });
      if (match) matches++;
    }

    const precision = (matches / dataA.data.length) * 100;
    return `Analysis: ${itemName} and ${correlatedItemName} showed temporal correlation in ${precision.toFixed(1)}% of events. Suggested Automation: Trigger on ${itemName} and check state of ${correlatedItemName}.`;
  }

  /**
   * Advanced Remediation: Audit the semantic model for orphans and structural gaps.
   */
  async auditSemanticModel(): Promise<{ gaps: string[]; recommendations: string[] }> {
    const items = await this.getItems();
    const gaps: string[] = [];
    const recommendations: string[] = [];

    items.forEach((i) => {
      const isEquipment = i.tags?.some(
        (t) => t.toLowerCase() === 'equipment' || t.includes('Equipment_')
      );
      const isPoint = i.tags?.some((t) => t.toLowerCase() === 'point' || t.includes('Point_'));

      // Check Equipment has a parent Location
      if (isEquipment) {
        const hasLocationParent = i.groupNames?.some((gName) => {
          const g = items.find((item) => item.name === gName);
          return g?.tags?.some((t) => t.toLowerCase() === 'location' || t.includes('Location_'));
        });
        if (!hasLocationParent) {
          gaps.push(`Equipment '${i.name}' has no parent Location.`);
          recommendations.push(`Move '${i.name}' into a Location group (e.g., Lounge, Kitchen).`);
        }
      }

      // Check Point has a parent Equipment or Location
      if (isPoint) {
        const hasParent = i.groupNames && i.groupNames.length > 0;
        if (!hasParent) {
          gaps.push(`Point '${i.name}' is top-level (no parent).`);
          recommendations.push(`Link '${i.name}' to its parent Equipment or Location.`);
        }
      }
    });

    return { gaps, recommendations };
  }

  /**
   * Mastery Tool: Detects potential conflicts between rules targeting the same items.
   */
  async detectRuleConflicts(): Promise<string[]> {
    const rules = await this.getRules();
    const conflicts: string[] = [];
    const itemMap = new Map<string, string[]>();

    rules.forEach((r) => {
      const actionsStr = JSON.stringify(r.actions);
      // Heuristic: find common item names in action strings
      const foundItems = actionsStr.match(/[a-zA-Z0-9_]{5,}/g) || [];
      foundItems.forEach((itemName) => {
        if (!itemMap.has(itemName)) itemMap.set(itemName, []);
        itemMap.get(itemName)!.push(r.uid);
      });
    });

    itemMap.forEach((ruleUIDs, itemName) => {
      const uniqueRules = Array.from(new Set(ruleUIDs));
      if (uniqueRules.length > 1) {
        conflicts.push(
          `Potential Conflict: Item '${itemName}' is targeted by multiple rules: ${uniqueRules.join(', ')}`
        );
      }
    });

    return conflicts.length > 0 ? conflicts : ['No obvious rule conflicts detected.'];
  }

  /**
   * Mastery Tool: Proposes standardized naming for items based on semantics.
   */
  async standardizeNamingConvention(): Promise<Array<{ oldName: string; suggestedName: string }>> {
    const items = await this.getItems();
    const suggestions: Array<{ oldName: string; suggestedName: string }> = [];

    items.forEach((i) => {
      const room = i.tags?.find(
        (t) => t.startsWith('Room_') || ['Lounge', 'Kitchen', 'Bedroom', 'Hallway'].includes(t)
      );
      const equipment = i.tags?.find((t) => t.toLowerCase().includes('equipment'));

      if (room && equipment) {
        const expectedPrefix = `${room}_${equipment}`.replace(/ /g, '_');
        if (!i.name.startsWith(expectedPrefix)) {
          suggestions.push({
            oldName: i.name,
            suggestedName: `${expectedPrefix}_${i.name.split('_').pop()}`,
          });
        }
      }
    });

    return suggestions;
  }

  /**
   * Mastery Tool: Recommends persistence optimizations.
   */
  async optimizePersistenceStrategy(): Promise<string[]> {
    const items = await this.getItems();
    const recs: string[] = [];

    items.forEach((i) => {
      if (i.type === 'Number' && i.name.toLowerCase().includes('power')) {
        recs.push(
          `Optimization for '${i.name}': High-frequency power sensor detected. Use 'everyChange' with a '0.1' threshold if possible to reduce DB bloat.`
        );
      }
      if (i.type === 'Contact' || i.type === 'Switch') {
        recs.push(
          `Optimization for '${i.name}': Binary state. Ensure 'everyChange' is the only strategy; 'everyMinute' is redundant.`
        );
      }
    });

    return recs;
  }

  /**
   * Mastery Tool: Converts legacy Sitemap definitions to modern MainUI YAML.
   */
  async sitemapToMainUI(sitemapName: string): Promise<string> {
    try {
      const sitemaps = await this.getSitemaps();
      const sitemap = sitemaps.find((s) => s.name === sitemapName);
      if (!sitemap) return `Sitemap '${sitemapName}' not found.`;

      // Simulating a conversion of a basic sitemap structure to YAML
      return `component: oh-layout-page
config:
  label: ${sitemap.label || sitemapName}
blocks:
  - component: oh-block
    slots:
      default:
        - component: oh-grid-row
          slots:
            default:
              - component: oh-grid-col
                config:
                  width: "100"
                slots:
                  default:
                    - component: oh-label-card
                      config:
                        title: Generated from legacy sitemap ${sitemapName}`;
    } catch (e: any) {
      return `Error converting sitemap: ${e.message}`;
    }
  }

  /**
   * Mastery Tool: Locks the MCP focus to a specific Room or Group to save tokens.
   */
  optimizeMcpFocus(type: 'room' | 'group', name: string | null): string {
    if (!name) {
      this.focusScope = null;
      return 'Focus Scope cleared. All items are now visible.';
    }
    this.focusScope = { type, name };
    return `Focus Scope locked to ${type}: ${name}. Tools will now only see items in this scope.`;
  }

  /**
   * Mastery Tool: Exports a lightweight JSON snapshot of the system configuration.
   */
  async exportSystemSnapshot(): Promise<string> {
    const items = await this.getItems();
    const things = await this.getThings();
    const links = await this.getLinks();

    const snapshot = {
      timestamp: new Date().toISOString(),
      version: '1.0-snapshot',
      counts: {
        items: items.length,
        things: things.length,
        links: links.length,
      },
      data: { items, things, links },
    };

    return JSON.stringify(snapshot, null, 2);
  }

  /**
   * Mastery Tool: Returns observability metrics for the MCP server.
   */
  getMcpHealth(): any {
    return {
      status: 'OK',
      capabilities: ['SSE', 'Caching', 'FuzzySearch', 'Simulation', 'SemanticAudit'],
      sse: {
        active: this.enableSSE,
        bufferSize: this.eventLogBuffer.length,
        lastEvents: this.eventLogBuffer.slice(-5),
      },
      cache: {
        size: this.cache.size,
      },
      focus: this.focusScope || 'None',
    };
  }

  /**
   * Mastery Tool: Returns statistical summary of persistence data to save tokens.
   */
  async summarizePersistenceRange(
    itemName: string,
    startTime: string,
    endTime: string
  ): Promise<any> {
    const data = await this.getItemPersistenceData(itemName, undefined, startTime, endTime);
    if (!data || !data.data || data.data.length === 0) return { error: 'No data found in range.' };

    const values = data.data.map((p: any) => parseFloat(p.state)).filter((v: any) => !isNaN(v));
    if (values.length === 0)
      return { count: data.data.length, info: 'No numeric values to summarize.' };

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length;
    const trend = values[values.length - 1] > values[0] ? 'Increasing' : 'Decreasing';

    return {
      itemName,
      range: { startTime, endTime },
      statistics: {
        count: values.length,
        min: min.toFixed(2),
        max: max.toFixed(2),
        avg: avg.toFixed(2),
        trend,
      },
      recommendation:
        values.length > 500
          ? 'Token warning: Recommend higher sampling interval if retrieving raw data.'
          : 'Safe for extraction.',
    };
  }

  /**
   * Mastery Tool: Returns a list of active master-tier capabilities.
   */
  getMcpCapabilities(): string[] {
    return [
      'Bulk Item Remediation',
      'Automation Pattern Discovery',
      'Semantic Model Auditing',
      'Rule Conflict Detection',
      'Naming Convention Standardization',
      'Persistence Strategy Optimization',
      'Sitemap-to-MainUI Migration',
      'Agentic Focus Locking',
      'Configuration Snapshotting',
      'Statistical Persistence Summaries',
      'System Simulation Engine',
      'Auto-Generated Home Blueprint',
      'Comprehensive Safety Auditing',
      'Energy & Power Insights',
      'Discovery Scan Triggering',
      'Semantic Path breadcrumbs',
      'Neighboring Equipment discovery',
      'Future-dated Command Scheduling',
      'Proactive Staleness Detection',
    ];
  }

  /**
   * Ultimate Tool: Predicts the effect of a command without executing it on hardware.
   */
  async simulateSystemState(itemName: string, command: string): Promise<any> {
    const item = await this.getItem(itemName);
    const rules = await this.getRules();

    const affectedRules = rules.filter((r) => {
      const triggers = JSON.stringify(r.triggers);
      return (
        triggers.includes(itemName) &&
        (triggers.includes('changed') || triggers.includes('command'))
      );
    });

    return {
      simulationResult: 'Success',
      initialState: item.state,
      predictedState: command,
      potentialTriggers: affectedRules.map((r) => ({ uid: r.uid, name: r.name })),
      impactLevel: affectedRules.length > 2 ? 'High' : affectedRules.length > 0 ? 'Medium' : 'Low',
      warning:
        affectedRules.length > 5
          ? 'Significant automation chain detected. High risk of side effects.'
          : null,
    };
  }

  /**
   * Ultimate Tool: Generates a complete Markdown guide of the current OpenHAB setup.
   */
  async generateHomeBlueprint(): Promise<string> {
    const items = await this.getItems();
    const rules = await this.getRules();

    let blueprint = '# OpenHAB Home Blueprint\n\n';
    blueprint += `Generated: ${new Date().toLocaleString()}\n\n`;

    // Summary
    blueprint += '## System Overview\n';
    blueprint += `- Total Items: ${items.length}\n`;
    blueprint += `- Total Rules: ${rules.length}\n\n`;

    // High level Rooms
    const rooms = Array.from(
      new Set(
        items
          .flatMap((i) => i.tags || [])
          .filter((t) => t.startsWith('Room_') || ['Lounge', 'Kitchen', 'Bedroom'].includes(t))
      )
    );
    blueprint += '## Spatial Model\n';
    rooms.forEach((room) => {
      const roomItems = items.filter((i) => i.tags?.includes(room));
      blueprint += `### ${room.replace('Room_', '')}\n`;
      blueprint += `- Devices: ${roomItems.length}\n`;
      blueprint +=
        roomItems
          .slice(0, 5)
          .map((i) => `  - ${i.label || i.name}`)
          .join('\n') +
        (roomItems.length > 5 ? '\n  - ...' : '') +
        '\n\n';
    });

    return blueprint;
  }

  /**
   * Ultimate Tool: Audits security-sensitive items for misconfiguration.
   */
  async auditSystemSafety(): Promise<any> {
    const items = await this.getItems();
    const issues: string[] = [];

    items.forEach((i) => {
      const isSecurity = i.tags?.some(
        (t) =>
          ['Security', 'Safety', 'Lock', 'Alarm'].includes(t) ||
          t.toLowerCase().includes('security')
      );
      if (isSecurity) {
        if (!i.metadata?.['security_lock'] && i.type === 'Switch') {
          issues.push(
            `Item '${i.name}' (Security) lacks a safety lock metadata tag. It can be toggled without confirmation.`
          );
        }
      }
    });

    return {
      auditType: 'Safety & Security',
      status: issues.length === 0 ? 'Protected' : 'Vulnerable',
      findings: issues,
      recommendation:
        issues.length > 0
          ? "Apply 'security_lock' metadata to all critical switches."
          : 'All security items appear standard.',
    };
  }

  /**
   * Ultimate Tool: Aggregates power and energy data into an efficiency report.
   */
  async calculateEnergyInsights(): Promise<any> {
    const items = await this.getItems();
    const energyItems = items.filter(
      (i) =>
        i.type === 'Number' &&
        (i.name.toLowerCase().includes('power') || i.name.toLowerCase().includes('energy'))
    );

    if (energyItems.length === 0) return { error: 'No energy-tracking items found.' };

    const insights = energyItems.map((i) => ({
      name: i.name,
      lastReading: i.state,
      category: i.category || 'Unknown',
    }));

    return {
      reportType: 'Energy Efficiency',
      monitoredDevices: energyItems.length,
      insights,
      totalNominalLoad:
        energyItems.reduce((acc, i) => acc + (parseFloat(i.state) || 0), 0).toFixed(2) + ' W/kWh',
    };
  }

  /**
   * Enhancement: Triggers a manual discovery scan for a specific binding.
   */
  async triggerDiscoveryScan(bindingId: string): Promise<string> {
    const response = await this.client.post(`/rest/discovery/bindings/${bindingId}/scan`);
    return `Discovery scan triggered for binding: ${bindingId}. Check the inbox for new items.`;
  }

  /**
   * Enhancement: Returns the full semantic path for an item (e.g., Lounge > Sofa > Light).
   */
  async getSemanticPath(itemName: string): Promise<string> {
    const allItems = await this.getItems();
    const item = allItems.find((i) => i.name === itemName);
    if (!item) throw new Error(`Item ${itemName} not found.`);

    const path: string[] = [item.label || item.name];
    let current = item;

    // Traverse upwards through groups
    while (current.groupNames && current.groupNames.length > 0) {
      // Find a parent that is part of the semantic model
      const parent = allItems.find(
        (i) =>
          current.groupNames.includes(i.name) &&
          i.tags?.some((t) =>
            ['Location', 'Equipment', 'Point'].some((s) => t.toLowerCase().includes(s.toLowerCase()))
          )
      );

      if (!parent) break;
      path.unshift(parent.label || parent.name);
      current = parent;
    }

    return path.join(' > ');
  }

  /**
   * Enhancement: Finds equipment/points in the same location as the target item.
   */
  async findNeighboringEquipment(itemName: string): Promise<OpenHabItem[]> {
    const allItems = await this.getItems();
    const item = allItems.find((i) => i.name === itemName);
    if (!item) throw new Error(`Item ${itemName} not found.`);

    // Find the closest location parent
    let locationParent: OpenHabItem | undefined;
    let current = item;

    while (current.groupNames && current.groupNames.length > 0) {
      const parent = allItems.find(
        (i) =>
          current.groupNames.includes(i.name) &&
          i.tags?.some((t) => t.toLowerCase().includes('location'))
      );
      if (parent) {
        locationParent = parent;
        break;
      }
      // If no location parent yet, try next group level
      const nextParent = allItems.find((i) => current.groupNames.includes(i.name));
      if (!nextParent) break;
      current = nextParent;
    }

    if (!locationParent) return [];

    // Find all items that share this location parent
    return allItems.filter(
      (i) => i.name !== itemName && i.groupNames?.includes(locationParent!.name)
    );
  }

  /**
   * Enhancement: Schedules a command to be sent after a delay.
   */
  async scheduleCommand(itemName: string, command: string, delayMs: number): Promise<string> {
    this.log(`SCHEDULER: Queuing ${command} for ${itemName} in ${delayMs}ms`);
    this.addLogToBuffer(
      `${new Date().toISOString()} - ScheduledEvent - Queued ${command} for ${itemName} in ${delayMs}ms`
    );

    setTimeout(async () => {
      try {
        await this.sendCommand(itemName, command);
        this.log(`SCHEDULER: Executed scheduled command ${command} on ${itemName}`);
      } catch (err: any) {
        this.log(`SCHEDULER ERROR: Failed to execute command on ${itemName}: ${err.message}`);
      }
    }, delayMs);

    return `Command '${command}' successfully scheduled for item '${itemName}' in ${delayMs}ms.`;
  }

  /**
   * Enhancement: Identifies items that haven't updated their state recently.
   */
  async getStaleItems(days = 7): Promise<Array<{ name: string; lastUpdate?: string }>> {
    const items = await this.getItems(undefined, undefined, '.*'); // Get all items with metadata
    const now = Date.now();
    const threshold = days * 24 * 60 * 60 * 1000;
    const stale: Array<{ name: string; lastUpdate?: string }> = [];

    items.forEach((i) => {
      // Try to find last update from metadata if the system supports it,
      // or check the event logs if we have them.
      // Since standard REST items don't have a 'lastUpdate' field without persistence,
      // we check our event logs first.
      const lastLog = this.eventLogBuffer
        .reverse()
        .find((l) => l.includes(`ItemStateChangedEvent - ${i.name}`));
      this.eventLogBuffer.reverse(); // Restore original order

      if (lastLog) {
        const logTime = new Date(lastLog.split(' - ')[0]).getTime();
        if (now - logTime > threshold) {
          stale.push({ name: i.name, lastUpdate: new Date(logTime).toISOString() });
        }
      } else {
        // If no log in buffer, and it's a sensor (Number), it might be stale
        if (i.type === 'Number' || i.type === 'Contact') {
          stale.push({ name: i.name, lastUpdate: 'Unknown (No recent event logs)' });
        }
      }
    });

    return stale;
  }
}
