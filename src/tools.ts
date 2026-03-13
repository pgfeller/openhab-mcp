import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { OpenHabClient } from './openhab-client.js';
import { OpenHabItem } from './types.js';

export function registerTools(server: Server, client: OpenHabClient) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // --- Core Items ---
        {
          name: 'get_system_summary',
          description: 'Get a high-density summary of the OpenHAB system (items, things, rooms, health)',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_items',
          description: 'Get all OpenHAB items, optionally filtered by tags, type, or metadata',
          inputSchema: {
            type: 'object',
            properties: {
              tags: { type: 'string', description: 'Comma-separated list of tags' },
              type: { type: 'string' },
              metadata: { type: 'string' },
            },
          },
        },
        {
          name: 'get_item',
          description: 'Get a specific item by name',
          inputSchema: {
            type: 'object',
            properties: { itemName: { type: 'string' } },
            required: ['itemName'],
          },
        },
        {
          name: 'send_command',
          description: 'Send a command (ON, OFF, 50, etc.) to an item',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              command: { type: 'string' },
            },
            required: ['itemName', 'command'],
          },
        },
        {
          name: 'update_state',
          description: 'Update the state of an item',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              state: { type: 'string' },
            },
            required: ['itemName', 'state'],
          },
        },
        {
          name: 'create_or_update_item',
          description: 'Create or update an item definition (managed mode)',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              itemData: { type: 'object' },
            },
            required: ['itemName', 'itemData'],
          },
        },
        {
          name: 'delete_item',
          description: 'Delete an item',
          inputSchema: {
            type: 'object',
            properties: { itemName: { type: 'string' } },
            required: ['itemName'],
          },
        },

        // --- Item Modifications (Consolidated) ---
        {
          name: 'manage_item_tag',
          description: 'Add or remove a tag from an item',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              tag: { type: 'string' },
              action: { type: 'string', enum: ['add', 'remove'] },
            },
            required: ['itemName', 'tag', 'action'],
          },
        },
        {
          name: 'manage_item_metadata',
          description: 'Set or remove metadata on an item',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              namespace: { type: 'string' },
              value: { type: 'string' },
              config: { type: 'object' },
              action: { type: 'string', enum: ['set', 'remove'] },
            },
            required: ['itemName', 'namespace', 'action'],
          },
        },

        // --- Hardware & Things (Consolidated) ---
        {
          name: 'get_things',
          description: 'Get all things',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_thing',
          description: 'Get a specific thing by UID',
          inputSchema: {
            type: 'object',
            properties: { thingUID: { type: 'string' } },
            required: ['thingUID'],
          },
        },
        {
          name: 'manage_thing',
          description: 'Lifecycle and config management for things',
          inputSchema: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['create', 'update', 'delete', 'enable', 'disable', 'configure'] },
              thingUID: { type: 'string', description: 'Required for all actions except create' },
              thingData: { type: 'object', description: 'Used for create/update' },
              config: { type: 'object', description: 'Used for configure' },
              force: { type: 'boolean', description: 'Used for delete' },
            },
            required: ['action'],
          },
        },
        {
          name: 'get_thing_status',
          description: 'Get status of a thing',
          inputSchema: {
            type: 'object',
            properties: { thingUID: { type: 'string' } },
            required: ['thingUID'],
          },
        },

        // --- Rules & Automation (Consolidated) ---
        {
          name: 'get_rules',
          description: 'Get all rules',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_rule',
          description: 'Get a rule by UID',
          inputSchema: {
            type: 'object',
            properties: { ruleUID: { type: 'string' } },
            required: ['ruleUID'],
          },
        },
        {
          name: 'manage_rule',
          description: 'Lifecycle and execution management for rules',
          inputSchema: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['create', 'update', 'delete', 'enable', 'disable', 'run'] },
              ruleUID: { type: 'string', description: 'Required for all actions except create' },
              ruleData: { type: 'object', description: 'Used for create/update' },
              enable: { type: 'boolean', description: 'Used for enable/disable' },
            },
            required: ['action'],
          },
        },

        // --- Semantic Model (Consolidated) ---
        {
          name: 'manage_semantic_tag',
          description: 'Create, update or delete semantic tags',
          inputSchema: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['create', 'update', 'delete'] },
              tagId: { type: 'string' },
              tagData: { type: 'object' },
            },
            required: ['action'],
          },
        },
        {
          name: 'manage_link',
          description: 'Manage links between items and channels',
          inputSchema: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['link', 'unlink', 'configure'] },
              itemName: { type: 'string' },
              channelUID: { type: 'string' },
              config: { type: 'object' },
              profile: { type: 'string', description: 'Used for configure' },
              profileConfig: { type: 'object', description: 'Used for configure' },
            },
            required: ['action', 'itemName', 'channelUID'],
          },
        },
        {
          name: 'get_semantic_tags',
          description: 'Get all semantic tags',
          inputSchema: { type: 'object', properties: {} },
        },

        // --- System Management (Consolidated) ---
        {
          name: 'get_audio_info',
          description: 'Get info about audio sinks, sources, or voices',
          inputSchema: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['sinks', 'sources', 'voices'] },
            },
            required: ['type'],
          },
        },
        {
          name: 'voice_say',
          description: 'Speak text via TTS',
          inputSchema: {
            type: 'object',
            properties: { text: { type: 'string' }, sinkId: { type: 'string' } },
            required: ['text'],
          },
        },
        {
          name: 'voice_interpret',
          description: 'Interpret a natural language string',
          inputSchema: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              interpreterIds: { type: 'string' },
            },
            required: ['text'],
          },
        },
        {
          name: 'manage_addon',
          description: 'Install or uninstall an addon',
          inputSchema: {
            type: 'object',
            properties: {
              addonId: { type: 'string' },
              action: { type: 'string', enum: ['install', 'uninstall'] },
            },
            required: ['addonId', 'action'],
          },
        },
        {
          name: 'manage_inbox',
          description: 'Approve or ignore discovered things in the inbox',
          inputSchema: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['approve', 'ignore', 'unignore'] },
              thingUID: { type: 'string' },
              label: { type: 'string' },
              newThingId: { type: 'string' },
            },
            required: ['action', 'thingUID'],
          },
        },

        // --- Configuration & Services (Consolidated) ---
        {
          name: 'get_system_registry',
          description: 'Get lists from system registries (services, loggers, transformations, templates)',
          inputSchema: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['services', 'loggers', 'transformations', 'templates'] },
            },
            required: ['type'],
          },
        },
        {
          name: 'manage_service_config',
          description: 'Get or update configuration for a specific service',
          inputSchema: {
            type: 'object',
            properties: {
              serviceId: { type: 'string' },
              action: { type: 'string', enum: ['get', 'update'] },
              config: { type: 'object' },
            },
            required: ['serviceId', 'action'],
          },
        },
        {
          name: 'manage_logger',
          description: 'Get all loggers or set log level',
          inputSchema: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['list', 'set'] },
              loggerName: { type: 'string' },
              level: { type: 'string' },
            },
            required: ['action'],
          },
        },
        {
          name: 'get_system_info',
          description: 'Get system information',
          inputSchema: { type: 'object', properties: {} },
        },

        {
          name: 'initial_discovery',
          description: 'One-shot bootstrap to get system context and full schema at once',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'search_items',
          description: 'Broad fuzzy search for items by name, label, tags, or groups',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
        },
        {
          name: 'master_search',
          description: 'Unified search across items, things, and rules in one call',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
        },
        {
          name: 'get_room_inventory',
          description: 'Get all equipment and items in a specific room (e.g. "Kitchen")',
          inputSchema: {
            type: 'object',
            properties: { roomName: { type: 'string' } },
            required: ['roomName'],
          },
        },
        {
          name: 'analyze_system_health',
          description: 'Scan for hardware issues and battery levels',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'generate_topology',
          description: 'Generate Mermaid topology graph',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'explain_item_state',
          description: 'Forensic review of an item status and history',
          inputSchema: {
            type: 'object',
            properties: { itemName: { type: 'string' } },
            required: ['itemName'],
          },
        },
        {
          name: 'execute_batch',
          description: 'Execute multiple commands in parallel',
          inputSchema: {
            type: 'object',
            properties: {
              commands: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { itemName: { type: 'string' }, command: { type: 'string' } },
                  required: ['itemName', 'command'],
                },
              },
            },
            required: ['commands'],
          },
        },
        {
          name: 'capture_scene',
          description: 'Capture current item states as a scene',
          inputSchema: {
            type: 'object',
            properties: { name: { type: 'string' }, itemNames: { type: 'array', items: { type: 'string' } } },
            required: ['name', 'itemNames'],
          },
        },
        {
          name: 'activate_scene',
          description: 'Restore a named scene',
          inputSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
          },
        },
        {
          name: 'get_prompt_context',
          description: 'Get condensed system state for AI priming',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_recent_logs',
          description: 'Fetch the recent event stream buffer (last 100 events)',
          inputSchema: {
            type: 'object',
            properties: {
              lines: { type: 'number' },
            },
          },
        },
        {
          name: 'get_historical_logs',
          description: 'Fetch a larger window of historical log events for deep review (up to 5000 lines)',
          inputSchema: {
            type: 'object',
            properties: {
              lines: { type: 'number', description: 'Number of lines to return (max 5000)' },
              search: { type: 'string', description: 'Optional text filter' },
            },
          },
        },
        {
          name: 'get_mcp_health',
          description: 'Get real-time health metrics for the MCP server (SSE status, cache, buffer)',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_mcp_capabilities',
          description: 'List all active advanced mastery capabilities of this MCP',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'summarize_persistence_range',
          description: 'Get a statistical summary of an item over a time range (peakes, averages, trends)',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              startTime: { type: 'string', description: 'ISO8601 start time' },
              endTime: { type: 'string', description: 'ISO8601 end time' },
            },
            required: ['itemName', 'startTime', 'endTime'],
          },
        },
        {
          name: 'simulate_system_state',
          description: 'Predict the outcome of a command including potential rule trigger chains',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              command: { type: 'string' },
            },
            required: ['itemName', 'command'],
          },
        },
        {
          name: 'generate_home_blueprint',
          description: 'Generate a comprehensive Markdown guide of the entire home system',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'audit_system_safety',
          description: 'Security audit of items tagged with Security/Safety',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'calculate_energy_insights',
          description: 'Aggregate energy consumption across the home',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_semantic_path',
          description: 'Get the full semantic location path for an item',
          inputSchema: {
            type: 'object',
            properties: { itemName: { type: 'string' } },
            required: ['itemName'],
          },
        },
        {
          name: 'find_neighboring_equipment',
          description: 'Find other equipment in the same location as the target item',
          inputSchema: {
            type: 'object',
            properties: { itemName: { type: 'string' } },
            required: ['itemName'],
          },
        },
        {
          name: 'schedule_command',
          description: 'Schedule a command for the future',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              command: { type: 'string' },
              delayMs: { type: 'number' },
            },
            required: ['itemName', 'command', 'delayMs'],
          },
        },
        {
          name: 'get_stale_items',
          description: 'Identify sensors that haven\'t updated in a while',
          inputSchema: {
            type: 'object',
            properties: {
              days: { type: 'number', description: 'Staleness threshold in days' },
            },
          },
        },
        {
          name: 'trigger_discovery_scan',
          description: 'Trigger a manual hardware scan for a binding',
          inputSchema: {
            type: 'object',
            properties: {
              bindingId: { type: 'string', description: 'e.g., hue, sonos' },
            },
            required: ['bindingId'],
          },
        },
        {
          name: 'chat_with_habot',
          description: 'Send a natural language query to Habot',
          inputSchema: {
            type: 'object',
            properties: { text: { type: 'string' } },
            required: ['text'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: unknown;
      switch (name) {
        // --- Core Items ---
        case 'get_system_summary':
          result = await client.getSystemSummary();
          break;
        case 'get_items': {
          const { tags, type, metadata } = z
            .object({
              tags: z.string().optional(),
              type: z.string().optional(),
              metadata: z.string().optional(),
            })
            .parse(args);
          result = await client.getItems(tags, type, metadata);
          break;
        }
        case 'get_item': {
          const { itemName } = z.object({ itemName: z.string() }).parse(args);
          result = await client.getItem(itemName);
          break;
        }
        case 'send_command': {
          const { itemName, command } = z
            .object({ itemName: z.string(), command: z.string() })
            .parse(args);
          result = await client.sendCommand(itemName, command);
          break;
        }
        case 'update_state': {
          const { itemName, state } = z
            .object({ itemName: z.string(), state: z.string() })
            .parse(args);
          result = await client.updateState(itemName, state);
          break;
        }
        case 'create_or_update_item': {
          const { itemName, itemData } = z
            .object({ itemName: z.string(), itemData: z.record(z.string(), z.any()) })
            .parse(args);
          result = await client.createOrUpdateItem(itemName, itemData);
          break;
        }
        case 'delete_item': {
          const { itemName } = z.object({ itemName: z.string() }).parse(args);
          result = await client.deleteItem(itemName);
          break;
        }

        // --- Item Modifications (Consolidated) ---
        case 'manage_item_tag': {
          const { itemName, tag, action } = z
            .object({ itemName: z.string(), tag: z.string(), action: z.enum(['add', 'remove']) })
            .parse(args);
          result = action === 'add' ? await client.addTag(itemName, tag) : await client.removeTag(itemName, tag);
          break;
        }
        case 'manage_item_metadata': {
          const { itemName, namespace, value, config, action } = z
            .object({
              itemName: z.string(),
              namespace: z.string(),
              value: z.string().optional(),
              config: z.record(z.string(), z.any()).optional(),
              action: z.enum(['set', 'remove']),
            })
            .parse(args);
          result = action === 'set' ? await client.setMetadata(itemName, namespace, value!, config) : await client.removeMetadata(itemName, namespace);
          break;
        }

        // --- Hardware & Things (Consolidated) ---
        case 'get_things':
          result = await client.getThings();
          break;
        case 'get_thing': {
          const { thingUID } = z.object({ thingUID: z.string() }).parse(args);
          result = await client.getThing(thingUID);
          break;
        }
        case 'manage_thing': {
          const { action, thingUID, thingData, config, force } = z
            .object({
              action: z.enum(['create', 'update', 'delete', 'enable', 'disable', 'configure']),
              thingUID: z.string().optional(),
              thingData: z.record(z.string(), z.any()).optional(),
              config: z.record(z.string(), z.any()).optional(),
              force: z.boolean().optional(),
            })
            .parse(args);

          switch (action) {
            case 'create': result = await client.createThing(thingData!); break;
            case 'update': result = await client.updateThing(thingUID!, thingData!); break;
            case 'delete': result = await client.deleteThing(thingUID!, force); break;
            case 'enable': result = await client.enableThing(thingUID!, true); break;
            case 'disable': result = await client.enableThing(thingUID!, false); break;
            case 'configure': result = await client.updateThingConfig(thingUID!, config!); break;
          }
          break;
        }
        case 'get_thing_status': {
          const { thingUID } = z.object({ thingUID: z.string() }).parse(args);
          result = await client.getThingStatus(thingUID);
          break;
        }

        // --- Rules & Automation (Consolidated) ---
        case 'get_rules':
          result = await client.getRules();
          break;
        case 'get_rule': {
          const { ruleUID } = z.object({ ruleUID: z.string() }).parse(args);
          result = await client.getRule(ruleUID);
          break;
        }
        case 'manage_rule': {
          const { action, ruleUID, ruleData, enable } = z
            .object({
              action: z.enum(['create', 'update', 'delete', 'enable', 'disable', 'run']),
              ruleUID: z.string().optional(),
              ruleData: z.record(z.string(), z.any()).optional(),
              enable: z.boolean().optional(),
            })
            .parse(args);

          switch (action) {
            case 'create': result = await client.createRule(ruleData!); break;
            case 'update': result = await client.updateRule(ruleUID!, ruleData!); break;
            case 'delete': result = await client.deleteRule(ruleUID!); break;
            case 'enable': result = await client.enableRule(ruleUID!, true); break;
            case 'disable': result = await client.enableRule(ruleUID!, false); break;
            case 'run': result = await client.runRule(ruleUID!); break;
          }
          break;
        }

        // --- Semantic Model (Consolidated) ---
        case 'manage_semantic_tag': {
          const { action, tagId, tagData } = z
            .object({
              action: z.enum(['create', 'update', 'delete']),
              tagId: z.string().optional(),
              tagData: z.any().optional(),
            })
            .parse(args);
          if (action === 'create') result = await client.createSemanticTag(tagData!);
          else if (action === 'update') result = await client.updateSemanticTag(tagId!, tagData!);
          else result = await client.deleteSemanticTag(tagId!);
          break;
        }
        case 'manage_link': {
          const { action, itemName, channelUID, config, profile, profileConfig } = z
            .object({
              action: z.enum(['link', 'unlink', 'configure']),
              itemName: z.string(),
              channelUID: z.string(),
              config: z.record(z.string(), z.any()).optional(),
              profile: z.string().optional(),
              profileConfig: z.record(z.string(), z.any()).optional(),
            })
            .parse(args);

          if (action === 'link') result = await client.linkItemToChannel(itemName, channelUID, config);
          else if (action === 'unlink') result = await client.unlinkItemFromChannel(itemName, channelUID);
          else result = await client.configureLinkProfile(itemName, channelUID, profile!, profileConfig);
          break;
        }
        case 'get_semantic_tags':
          result = await client.getSemanticTags();
          break;

        // --- System Management (Consolidated) ---
        case 'get_audio_info': {
          const { type } = z.object({ type: z.enum(['sinks', 'sources', 'voices']) }).parse(args);
          if (type === 'sinks') result = await client.getAudioSinks();
          else if (type === 'sources') result = await client.getAudioSources();
          else result = await client.getVoices();
          break;
        }
        case 'voice_say': {
          const { text, sinkId } = z.object({ text: z.string(), sinkId: z.string().optional() }).parse(args);
          result = await client.voiceSay(text, undefined, sinkId);
          break;
        }
        case 'voice_interpret': {
          const { text, interpreterIds } = z.object({ text: z.string(), interpreterIds: z.string().optional() }).parse(args);
          result = await client.voiceInterpret(text, interpreterIds);
          break;
        }
        case 'manage_addon': {
          const { addonId, action } = z.object({ addonId: z.string(), action: z.enum(['install', 'uninstall']) }).parse(args);
          result = action === 'install' ? await client.installAddon(addonId) : await client.uninstallAddon(addonId);
          break;
        }
        case 'manage_inbox': {
          const { action, thingUID, label, newThingId } = z
            .object({
              action: z.enum(['approve', 'ignore', 'unignore']),
              thingUID: z.string(),
              label: z.string().optional(),
              newThingId: z.string().optional(),
            })
            .parse(args);
          if (action === 'approve') result = await client.approveInboxItem(thingUID, label, newThingId);
          else if (action === 'ignore') result = await client.ignoreInboxItem(thingUID);
          else result = await client.unignoreInboxItem(thingUID);
          break;
        }

        // --- Configuration & Services (Consolidated) ---
        case 'get_system_registry': {
          const { type } = z.object({ type: z.enum(['services', 'loggers', 'transformations', 'templates']) }).parse(args);
          if (type === 'services') result = await client.getServices();
          else if (type === 'loggers') result = await client.getLoggers();
          else if (type === 'transformations') result = await client.getTransformations();
          else result = await client.getTemplates();
          break;
        }
        case 'manage_service_config': {
          const { serviceId, action, config } = z
            .object({
              serviceId: z.string(),
              action: z.enum(['get', 'update']),
              config: z.record(z.string(), z.any()).optional(),
            })
            .parse(args);
          result = action === 'get' ? await client.getServiceConfig(serviceId) : await client.updateServiceConfig(serviceId, config!);
          break;
        }
        case 'manage_logger': {
          const { action, loggerName, level } = z
            .object({
              action: z.enum(['list', 'set']),
              loggerName: z.string().optional(),
              level: z.string().optional(),
            })
            .parse(args);
          result = action === 'list' ? await client.getLoggers() : await client.setLoggerLevel(loggerName!, level!);
          break;
        }
        case 'get_system_info':
          result = await client.getSystemInfo();
          break;

        // --- Advanced Mastery Tools ---
        case 'initial_discovery':
          result = await client.initialDiscovery();
          break;
        case 'search_items': {
          const { query } = z.object({ query: z.string() }).parse(args);
          result = await client.searchItems(query);
          break;
        }
        case 'master_search': {
          const { query } = z.object({ query: z.string() }).parse(args);
          result = await client.masterSearch(query);
          break;
        }
        case 'get_room_inventory': {
          const { roomName } = z.object({ roomName: z.string() }).parse(args);
          result = await client.getRoomInventory(roomName);
          break;
        }
        case 'analyze_system_health':
          result = await client.analyzeSystemHealth();
          break;
        case 'generate_topology':
          result = await client.generateTopology();
          break;
        case 'explain_item_state': {
          const { itemName } = z.object({ itemName: z.string() }).parse(args);
          result = await client.explainItemState(itemName);
          break;
        }
        case 'execute_batch': {
          const { commands } = z
            .object({
              commands: z.array(z.object({ itemName: z.string(), command: z.string() })),
            })
            .parse(args);
          result = await client.executeBatch(commands);
          break;
        }
        case 'capture_scene': {
          const { name, itemNames } = z.object({ name: z.string(), itemNames: z.array(z.string()) }).parse(args);
          result = await client.captureScene(name, itemNames);
          break;
        }
        case 'activate_scene': {
          const { name } = z.object({ name: z.string() }).parse(args);
          result = await client.activateScene(name);
          break;
        }
        case 'get_prompt_context':
          result = await client.getPromptContext();
          break;
        case 'get_recent_logs': {
          const { lines } = z.object({ lines: z.number().optional() }).parse(args);
          result = await client.getRecentLogs(lines);
          break;
        }
        case 'get_historical_logs': {
          const { lines, search } = z.object({ lines: z.number().optional(), search: z.string().optional() }).parse(args);
          result = await client.getHistoricalLogs(lines, search);
          break;
        }
        case 'get_mcp_health':
          result = client.getMcpHealth();
          break;
        case 'get_mcp_capabilities':
          result = client.getMcpCapabilities();
          break;
        case 'summarize_persistence_range': {
          const { itemName, startTime, endTime } = z.object({ itemName: z.string(), startTime: z.string(), endTime: z.string() }).parse(args);
          result = await client.summarizePersistenceRange(itemName, startTime, endTime);
          break;
        }
        case 'simulate_system_state': {
          const { itemName, command } = z.object({ itemName: z.string(), command: z.string() }).parse(args);
          result = await client.simulateSystemState(itemName, command);
          break;
        }
        case 'generate_home_blueprint':
          result = await client.generateHomeBlueprint();
          break;
        case 'audit_system_safety':
          result = await client.auditSystemSafety();
          break;
        case 'calculate_energy_insights':
          result = await client.calculateEnergyInsights();
          break;
        case 'get_semantic_path': {
          const { itemName } = z.object({ itemName: z.string() }).parse(args);
          result = await client.getSemanticPath(itemName);
          break;
        }
        case 'find_neighboring_equipment': {
          const { itemName } = z.object({ itemName: z.string() }).parse(args);
          result = await client.findNeighboringEquipment(itemName);
          break;
        }
        case 'schedule_command': {
          const { itemName, command, delayMs } = z.object({ itemName: z.string(), command: z.string(), delayMs: z.number() }).parse(args);
          result = await client.scheduleCommand(itemName, command, delayMs);
          break;
        }
        case 'get_stale_items': {
          const { days } = z.object({ days: z.number().optional() }).parse(args);
          result = await client.getStaleItems(days);
          break;
        }
        case 'trigger_discovery_scan': {
          const { bindingId } = z.object({ bindingId: z.string() }).parse(args);
          result = await client.triggerDiscoveryScan(bindingId);
          break;
        }
        case 'chat_with_habot': {
          const { text } = z.object({ text: z.string() }).parse(args);
          result = await client.chatWithHabot(text);
          break;
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool ${name}: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });
}
