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
    } as any;

    registerTools(mockServer, mockClient);
  });

  describe('Tool Dispatch Matrix', () => {
    const testCases = [
      // Items
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
      {
        tool: 'add_tag',
        args: { itemName: 'i', tag: 't' },
        clientMethod: 'addTag',
        expectedArgs: ['i', 't'],
      },
      {
        tool: 'remove_tag',
        args: { itemName: 'i', tag: 't' },
        clientMethod: 'removeTag',
        expectedArgs: ['i', 't'],
      },
      {
        tool: 'set_metadata',
        args: { itemName: 'i', namespace: 'n', value: 'v', config: { c: 1 } },
        clientMethod: 'setMetadata',
        expectedArgs: ['i', 'n', 'v', { c: 1 }],
      },
      {
        tool: 'remove_metadata',
        args: { itemName: 'i', namespace: 'n' },
        clientMethod: 'removeMetadata',
        expectedArgs: ['i', 'n'],
      },

      // Things
      { tool: 'get_things', args: {}, clientMethod: 'getThings', expectedArgs: [] },
      { tool: 'get_thing', args: { thingUID: 'u' }, clientMethod: 'getThing', expectedArgs: ['u'] },
      {
        tool: 'create_thing',
        args: { thingData: { t: 1 } },
        clientMethod: 'createThing',
        expectedArgs: [{ t: 1 }],
      },
      {
        tool: 'update_thing',
        args: { thingUID: 'u', thingData: { t: 2 } },
        clientMethod: 'updateThing',
        expectedArgs: ['u', { t: 2 }],
      },
      {
        tool: 'delete_thing',
        args: { thingUID: 'u', force: true },
        clientMethod: 'deleteThing',
        expectedArgs: ['u', true],
      },
      {
        tool: 'enable_thing',
        args: { thingUID: 'u', enable: true },
        clientMethod: 'enableThing',
        expectedArgs: ['u', true],
      },
      {
        tool: 'get_thing_status',
        args: { thingUID: 'u' },
        clientMethod: 'getThingStatus',
        expectedArgs: ['u'],
      },
      {
        tool: 'update_thing_config',
        args: { thingUID: 'u', config: { c: 1 } },
        clientMethod: 'updateThingConfig',
        expectedArgs: ['u', { c: 1 }],
      },

      // Links
      {
        tool: 'get_links',
        args: { itemName: 'i', channelUID: 'c' },
        clientMethod: 'getLinks',
        expectedArgs: ['i', 'c'],
      },
      {
        tool: 'link_item_to_channel',
        args: { itemName: 'i', channelUID: 'c', config: { k: 1 } },
        clientMethod: 'linkItemToChannel',
        expectedArgs: ['i', 'c', { k: 1 }],
      },
      {
        tool: 'unlink_item_from_channel',
        args: { itemName: 'i', channelUID: 'c' },
        clientMethod: 'unlinkItemFromChannel',
        expectedArgs: ['i', 'c'],
      },

      // Semantic Tags
      { tool: 'get_semantic_tags', args: {}, clientMethod: 'getSemanticTags', expectedArgs: [] },
      {
        tool: 'create_semantic_tag',
        args: { tagData: { id: 't' } },
        clientMethod: 'createSemanticTag',
        expectedArgs: [{ id: 't' }],
      },
      {
        tool: 'get_semantic_tag',
        args: { tagId: 't' },
        clientMethod: 'getSemanticTag',
        expectedArgs: ['t'],
      },
      {
        tool: 'update_semantic_tag',
        args: { tagId: 't', tagData: { id: 't', l: 'l' } },
        clientMethod: 'updateSemanticTag',
        expectedArgs: ['t', { id: 't', l: 'l' }],
      },
      {
        tool: 'delete_semantic_tag',
        args: { tagId: 't' },
        clientMethod: 'deleteSemanticTag',
        expectedArgs: ['t'],
      },

      // Rules
      { tool: 'get_rules', args: {}, clientMethod: 'getRules', expectedArgs: [] },
      { tool: 'get_rule', args: { ruleUID: 'u' }, clientMethod: 'getRule', expectedArgs: ['u'] },
      {
        tool: 'create_rule',
        args: { ruleData: { r: 1 } },
        clientMethod: 'createRule',
        expectedArgs: [{ r: 1 }],
      },
      {
        tool: 'update_rule',
        args: { ruleUID: 'u', ruleData: { r: 2 } },
        clientMethod: 'updateRule',
        expectedArgs: ['u', { r: 2 }],
      },
      {
        tool: 'delete_rule',
        args: { ruleUID: 'u' },
        clientMethod: 'deleteRule',
        expectedArgs: ['u'],
      },
      {
        tool: 'run_rule',
        args: { ruleUID: 'u' },
        clientMethod: 'runRule',
        expectedArgs: ['u', undefined],
      },
      {
        tool: 'enable_rule',
        args: { ruleUID: 'u', enable: true },
        clientMethod: 'enableRule',
        expectedArgs: ['u', true],
      },

      // Inbox
      { tool: 'get_inbox', args: {}, clientMethod: 'getInbox', expectedArgs: [] },
      {
        tool: 'approve_inbox_item',
        args: { thingUID: 'u', label: 'l', newThingId: 'n' },
        clientMethod: 'approveInboxItem',
        expectedArgs: ['u', 'l', 'n'],
      },
      {
        tool: 'ignore_inbox_item',
        args: { thingUID: 'u' },
        clientMethod: 'ignoreInboxItem',
        expectedArgs: ['u'],
      },
      {
        tool: 'unignore_inbox_item',
        args: { thingUID: 'u' },
        clientMethod: 'unignoreInboxItem',
        expectedArgs: ['u'],
      },

      // Persistence
      {
        tool: 'get_persistence_services',
        args: {},
        clientMethod: 'getPersistenceServices',
        expectedArgs: [],
      },
      {
        tool: 'get_item_persistence_data',
        args: { itemName: 'i', serviceId: 's', starttime: 's1', endtime: 'e1' },
        clientMethod: 'getItemPersistenceData',
        expectedArgs: ['i', 's', 's1', 'e1'],
      },
      {
        tool: 'store_item_persistence_data',
        args: { itemName: 'i', time: 't', state: 's', serviceId: 's1' },
        clientMethod: 'storeItemPersistenceData',
        expectedArgs: ['i', 't', 's', 's1'],
      },

      // Voice
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
      { tool: 'get_voices', args: {}, clientMethod: 'getVoices', expectedArgs: [] },
      { tool: 'get_audio_sinks', args: {}, clientMethod: 'getAudioSinks', expectedArgs: [] },
      { tool: 'get_audio_sources', args: {}, clientMethod: 'getAudioSources', expectedArgs: [] },

      // Addons
      { tool: 'get_addons', args: {}, clientMethod: 'getAddons', expectedArgs: [] },
      {
        tool: 'install_addon',
        args: { addonId: 'a' },
        clientMethod: 'installAddon',
        expectedArgs: ['a'],
      },
      {
        tool: 'uninstall_addon',
        args: { addonId: 'a' },
        clientMethod: 'uninstallAddon',
        expectedArgs: ['a'],
      },

      // UI
      { tool: 'get_sitemaps', args: {}, clientMethod: 'getSitemaps', expectedArgs: [] },
      {
        tool: 'get_ui_components',
        args: { namespace: 'n' },
        clientMethod: 'getUIComponents',
        expectedArgs: ['n'],
      },
      { tool: 'get_ui_tiles', args: {}, clientMethod: 'getUITiles', expectedArgs: [] },

      // System
      { tool: 'get_system_info', args: {}, clientMethod: 'getSystemInfo', expectedArgs: [] },
      { tool: 'get_loggers', args: {}, clientMethod: 'getLoggers', expectedArgs: [] },
      {
        tool: 'set_logger_level',
        args: { loggerName: 'l', level: 'I' },
        clientMethod: 'setLoggerLevel',
        expectedArgs: ['l', 'I'],
      },
      { tool: 'get_services', args: {}, clientMethod: 'getServices', expectedArgs: [] },
      {
        tool: 'get_service_config',
        args: { serviceId: 's' },
        clientMethod: 'getServiceConfig',
        expectedArgs: ['s'],
      },
      {
        tool: 'update_service_config',
        args: { serviceId: 's', config: { c: 1 } },
        clientMethod: 'updateServiceConfig',
        expectedArgs: ['s', { c: 1 }],
      },
      { tool: 'get_templates', args: {}, clientMethod: 'getTemplates', expectedArgs: [] },
      {
        tool: 'get_transformations',
        args: {},
        clientMethod: 'getTransformations',
        expectedArgs: [],
      },
      {
        tool: 'chat_with_habot',
        args: { text: 'h' },
        clientMethod: 'chatWithHabot',
        expectedArgs: ['h'],
      },
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
