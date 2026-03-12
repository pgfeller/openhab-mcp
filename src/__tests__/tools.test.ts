import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { OpenHabClient } from '../openhab-client.js';
import { registerTools } from '../tools.js';

describe('MCP Tools Integration', () => {
  let mockServer: Server;
  let mockClient: OpenHabClient;
  const toolHandlers: Record<string, (...args: any[]) => Promise<any>> = {};

  beforeEach(() => {
    mockServer = {
      setRequestHandler: vi.fn((_schema: any, handler: any) => {
        if (handler.length === 0) {
          toolHandlers['list_tools'] = handler;
        } else {
          toolHandlers['call_tool'] = handler;
        }
      }),
    } as any;

    const mockMethod = () => vi.fn().mockResolvedValue('ok');

    mockClient = {
      // Items
      getSystemSummary: mockMethod(),
      getItems: mockMethod(),
      getItem: mockMethod(),
      sendCommand: mockMethod(),
      updateState: mockMethod(),
      createOrUpdateItem: mockMethod(),
      deleteItem: mockMethod(),
      addTag: mockMethod(),
      removeTag: mockMethod(),
      setMetadata: mockMethod(),
      removeMetadata: mockMethod(),
      // Things
      getThings: mockMethod(),
      getThing: mockMethod(),
      createThing: mockMethod(),
      updateThing: mockMethod(),
      deleteThing: mockMethod(),
      enableThing: mockMethod(),
      getThingStatus: mockMethod(),
      updateThingConfig: mockMethod(),
      // Links
      getLinks: mockMethod(),
      linkItemToChannel: mockMethod(),
      unlinkItemFromChannel: mockMethod(),
      configureLinkProfile: mockMethod(),
      // Semantic Tags
      getSemanticTags: mockMethod(),
      createSemanticTag: mockMethod(),
      getSemanticTag: mockMethod(),
      updateSemanticTag: mockMethod(),
      deleteSemanticTag: mockMethod(),
      // Rules
      getRules: mockMethod(),
      getRule: mockMethod(),
      createRule: mockMethod(),
      updateRule: mockMethod(),
      deleteRule: mockMethod(),
      runRule: mockMethod(),
      enableRule: mockMethod(),
      // Persistence
      getPersistenceServices: mockMethod(),
      getItemPersistenceData: mockMethod(),
      storeItemPersistenceData: mockMethod(),
      // Inbox
      getInbox: mockMethod(),
      approveInboxItem: mockMethod(),
      ignoreInboxItem: mockMethod(),
      unignoreInboxItem: mockMethod(),
      // Voice
      voiceSay: mockMethod(),
      voiceInterpret: mockMethod(),
      getVoices: mockMethod(),
      getAudioSinks: mockMethod(),
      getAudioSources: mockMethod(),
      // Addons
      getAddons: mockMethod(),
      installAddon: mockMethod(),
      uninstallAddon: mockMethod(),
      // UI
      getSitemaps: mockMethod(),
      getUIComponents: mockMethod(),
      getUITiles: mockMethod(),
      // System
      getSystemInfo: mockMethod(),
      getLoggers: mockMethod(),
      setLoggerLevel: mockMethod(),
      getServices: mockMethod(),
      getServiceConfig: mockMethod(),
      updateServiceConfig: mockMethod(),
      getTemplates: mockMethod(),
      getTransformations: mockMethod(),
      chatWithHabot: mockMethod(),
      // Mastery
      searchItems: mockMethod(),
      analyzeSystemHealth: mockMethod(),
      generateTopology: mockMethod(),
      explainItemState: mockMethod(),
      executeBatch: mockMethod(),
      captureScene: mockMethod(),
      activateScene: mockMethod(),
      getPromptContext: mockMethod(),
      getRecentLogs: mockMethod(),
    } as any;

    registerTools(mockServer, mockClient);
  });

  describe('Tool Dispatch Matrix', () => {
    const testCases = [
      // --- Core Items ---
      {
        tool: 'get_items',
        args: { tags: 't', type: 'S', metadata: 'm' },
        clientMethod: 'getItems',
        expectedArgs: ['t', 'S', 'm'],
      },
      { tool: 'get_item', args: { itemName: 'i' }, clientMethod: 'getItem', expectedArgs: ['i'] },
      {
        tool: 'send_command',
        args: { itemName: 'i', command: 'ON' },
        clientMethod: 'sendCommand',
        expectedArgs: ['i', 'ON'],
      },
      {
        tool: 'update_state',
        args: { itemName: 'i', state: 'ON' },
        clientMethod: 'updateState',
        expectedArgs: ['i', 'ON'],
      },
      {
        tool: 'create_or_update_item',
        args: { itemName: 'i', itemData: { t: 'S' } },
        clientMethod: 'createOrUpdateItem',
        expectedArgs: ['i', { t: 'S' }],
      },
      {
        tool: 'delete_item',
        args: { itemName: 'i' },
        clientMethod: 'deleteItem',
        expectedArgs: ['i'],
      },

      // --- Item Modifications (Consolidated) ---
      {
        tool: 'manage_item_tag',
        args: { itemName: 'i', tag: 't', action: 'add' },
        clientMethod: 'addTag',
        expectedArgs: ['i', 't'],
      },
      {
        tool: 'manage_item_tag',
        args: { itemName: 'i', tag: 't', action: 'remove' },
        clientMethod: 'removeTag',
        expectedArgs: ['i', 't'],
      },
      {
        tool: 'manage_item_metadata',
        args: { itemName: 'i', namespace: 'n', value: 'v', config: { c: 1 }, action: 'set' },
        clientMethod: 'setMetadata',
        expectedArgs: ['i', 'n', 'v', { c: 1 }],
      },
      {
        tool: 'manage_item_metadata',
        args: { itemName: 'i', namespace: 'n', action: 'remove' },
        clientMethod: 'removeMetadata',
        expectedArgs: ['i', 'n'],
      },

      // --- Hardware & Things (Consolidated) ---
      { tool: 'get_things', args: {}, clientMethod: 'getThings', expectedArgs: [] },
      { tool: 'get_thing', args: { thingUID: 'u' }, clientMethod: 'getThing', expectedArgs: ['u'] },
      {
        tool: 'manage_thing',
        args: { action: 'create', thingData: { t: 1 } },
        clientMethod: 'createThing',
        expectedArgs: [{ t: 1 }],
      },
      {
        tool: 'manage_thing',
        args: { action: 'update', thingUID: 'u', thingData: { t: 2 } },
        clientMethod: 'updateThing',
        expectedArgs: ['u', { t: 2 }],
      },
      {
        tool: 'manage_thing',
        args: { action: 'delete', thingUID: 'u', force: true },
        clientMethod: 'deleteThing',
        expectedArgs: ['u', true],
      },
      {
        tool: 'manage_thing',
        args: { action: 'enable', thingUID: 'u' },
        clientMethod: 'enableThing',
        expectedArgs: ['u', true],
      },
      {
        tool: 'manage_thing',
        args: { action: 'disable', thingUID: 'u' },
        clientMethod: 'enableThing',
        expectedArgs: ['u', false],
      },
      {
        tool: 'manage_thing',
        args: { action: 'configure', thingUID: 'u', config: { c: 1 } },
        clientMethod: 'updateThingConfig',
        expectedArgs: ['u', { c: 1 }],
      },
      { tool: 'get_thing_status', args: { thingUID: 'u' }, clientMethod: 'getThingStatus', expectedArgs: ['u'] },

      // --- Rules & Automation (Consolidated) ---
      { tool: 'get_rules', args: {}, clientMethod: 'getRules', expectedArgs: [] },
      { tool: 'get_rule', args: { ruleUID: 'u' }, clientMethod: 'getRule', expectedArgs: ['u'] },
      {
        tool: 'manage_rule',
        args: { action: 'create', ruleData: { r: 1 } },
        clientMethod: 'createRule',
        expectedArgs: [{ r: 1 }],
      },
      {
        tool: 'manage_rule',
        args: { action: 'update', ruleUID: 'u', ruleData: { r: 2 } },
        clientMethod: 'updateRule',
        expectedArgs: ['u', { r: 2 }],
      },
      {
        tool: 'manage_rule',
        args: { action: 'delete', ruleUID: 'u' },
        clientMethod: 'deleteRule',
        expectedArgs: ['u'],
      },
      {
        tool: 'manage_rule',
        args: { action: 'enable', ruleUID: 'u' },
        clientMethod: 'enableRule',
        expectedArgs: ['u', true],
      },
      {
        tool: 'manage_rule',
        args: { action: 'disable', ruleUID: 'u' },
        clientMethod: 'enableRule',
        expectedArgs: ['u', false],
      },
      {
        tool: 'manage_rule',
        args: { action: 'run', ruleUID: 'u' },
        clientMethod: 'runRule',
        expectedArgs: ['u'],
      },

      // --- Semantic Model (Consolidated) ---
      {
        tool: 'manage_semantic_tag',
        args: { action: 'create', tagData: { id: 't' } },
        clientMethod: 'createSemanticTag',
        expectedArgs: [{ id: 't' }],
      },
      {
        tool: 'manage_semantic_tag',
        args: { action: 'update', tagId: 't', tagData: { id: 't2' } },
        clientMethod: 'updateSemanticTag',
        expectedArgs: ['t', { id: 't2' }],
      },
      {
        tool: 'manage_semantic_tag',
        args: { action: 'delete', tagId: 't' },
        clientMethod: 'deleteSemanticTag',
        expectedArgs: ['t'],
      },
      {
        tool: 'manage_link',
        args: { action: 'link', itemName: 'i', channelUID: 'c', config: { k: 1 } },
        clientMethod: 'linkItemToChannel',
        expectedArgs: ['i', 'c', { k: 1 }],
      },
      {
        tool: 'manage_link',
        args: { action: 'unlink', itemName: 'i', channelUID: 'c' },
        clientMethod: 'unlinkItemFromChannel',
        expectedArgs: ['i', 'c'],
      },
      {
        tool: 'manage_link',
        args: { action: 'configure', itemName: 'i', channelUID: 'c', profile: 'p', profileConfig: { k: 1 } },
        clientMethod: 'configureLinkProfile',
        expectedArgs: ['i', 'c', 'p', { k: 1 }],
      },
      { tool: 'get_semantic_tags', args: {}, clientMethod: 'getSemanticTags', expectedArgs: [] },

      // --- System Management ---
      {
        tool: 'get_audio_info',
        args: { type: 'sinks' },
        clientMethod: 'getAudioSinks',
        expectedArgs: [],
      },
      {
        tool: 'get_audio_info',
        args: { type: 'sources' },
        clientMethod: 'getAudioSources',
        expectedArgs: [],
      },
      {
        tool: 'get_audio_info',
        args: { type: 'voices' },
        clientMethod: 'getVoices',
        expectedArgs: [],
      },
      {
        tool: 'voice_say',
        args: { text: 'h', sinkId: 's' },
        clientMethod: 'voiceSay',
        expectedArgs: ['h', undefined, 's'],
      },
      {
        tool: 'voice_interpret',
        args: { text: 'h', interpreterIds: 'i' },
        clientMethod: 'voiceInterpret',
        expectedArgs: ['h', 'i'],
      },
      {
        tool: 'manage_addon',
        args: { action: 'install', addonId: 'a' },
        clientMethod: 'installAddon',
        expectedArgs: ['a'],
      },
      {
        tool: 'manage_addon',
        args: { action: 'uninstall', addonId: 'a' },
        clientMethod: 'uninstallAddon',
        expectedArgs: ['a'],
      },
      {
        tool: 'manage_inbox',
        args: { action: 'approve', thingUID: 'u', label: 'l', newThingId: 'n' },
        clientMethod: 'approveInboxItem',
        expectedArgs: ['u', 'l', 'n'],
      },
      {
        tool: 'manage_inbox',
        args: { action: 'ignore', thingUID: 'u' },
        clientMethod: 'ignoreInboxItem',
        expectedArgs: ['u'],
      },
      {
        tool: 'manage_inbox',
        args: { action: 'unignore', thingUID: 'u' },
        clientMethod: 'unignoreInboxItem',
        expectedArgs: ['u'],
      },

      // --- Configuration ---
      {
        tool: 'get_system_registry',
        args: { type: 'services' },
        clientMethod: 'getServices',
        expectedArgs: [],
      },
      {
        tool: 'get_system_registry',
        args: { type: 'loggers' },
        clientMethod: 'getLoggers',
        expectedArgs: [],
      },
      {
        tool: 'manage_service_config',
        args: { action: 'get', serviceId: 's' },
        clientMethod: 'getServiceConfig',
        expectedArgs: ['s'],
      },
      {
        tool: 'manage_service_config',
        args: { action: 'update', serviceId: 's', config: { k: 1 } },
        clientMethod: 'updateServiceConfig',
        expectedArgs: ['s', { k: 1 }],
      },
      {
        tool: 'manage_logger',
        args: { action: 'list' },
        clientMethod: 'getLoggers',
        expectedArgs: [],
      },
      {
        tool: 'manage_logger',
        args: { action: 'set', loggerName: 'l', level: 'I' },
        clientMethod: 'setLoggerLevel',
        expectedArgs: ['l', 'I'],
      },

      // --- Advanced Mastery ---
      { tool: 'search_items', args: { query: 'q' }, clientMethod: 'searchItems', expectedArgs: ['q'] },
      { tool: 'analyze_system_health', args: {}, clientMethod: 'analyzeSystemHealth', expectedArgs: [] },
      { tool: 'generate_topology', args: {}, clientMethod: 'generateTopology', expectedArgs: [] },
      { tool: 'explain_item_state', args: { itemName: 'i' }, clientMethod: 'explainItemState', expectedArgs: ['i'] },
      {
        tool: 'execute_batch',
        args: { commands: [{ itemName: 'i', command: 'c' }] },
        clientMethod: 'executeBatch',
        expectedArgs: [[{ itemName: 'i', command: 'c' }]],
      },
      {
        tool: 'capture_scene',
        args: { name: 'n', itemNames: ['i'] },
        clientMethod: 'captureScene',
        expectedArgs: ['n', ['i']],
      },
      { tool: 'activate_scene', args: { name: 'n' }, clientMethod: 'activateScene', expectedArgs: ['n'] },
      { tool: 'get_prompt_context', args: {}, clientMethod: 'getPromptContext', expectedArgs: [] },
      { tool: 'get_recent_logs', args: { lines: 10 }, clientMethod: 'getRecentLogs', expectedArgs: [10] },
      { tool: 'chat_with_habot', args: { text: 'h' }, clientMethod: 'chatWithHabot', expectedArgs: ['h'] },
    ];

    testCases.forEach(({ tool, args, clientMethod, expectedArgs }) => {
      it(`should dispatch ${tool} to client.${clientMethod}`, async () => {
        await toolHandlers['call_tool']({
          params: { name: tool, arguments: args },
        });
        expect((mockClient as any)[clientMethod]).toHaveBeenCalledWith(...expectedArgs);
      });
    });

    it('should return error for unknown tool', async () => {
      const result = await toolHandlers['call_tool']({
        params: { name: 'unknown_tool', arguments: {} },
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown tool');
    });

    it('should handle tool execution errors', async () => {
      (mockClient.getItem as any).mockRejectedValue(new Error('API Failure'));
      const result = await toolHandlers['call_tool']({
        params: { name: 'get_item', arguments: { itemName: 'i' } },
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error executing tool get_item: API Failure');
    });

    it('should handle non-Error rejections', async () => {
      (mockClient.getItem as any).mockRejectedValue('String Failure');
      const result = await toolHandlers['call_tool']({
        params: { name: 'get_item', arguments: { itemName: 'i' } },
      });
      expect(result.content[0].text).toContain('Error executing tool get_item: String Failure');
    });
  });
});
