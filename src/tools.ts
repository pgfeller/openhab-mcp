import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { OpenHabClient } from './openhab-client.js';
import { OpenHabItem } from './types.js';

export function registerTools(server: Server, client: OpenHabClient) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // --- Items ---
        {
          name: 'get_system_summary',
          description:
            'Get a high-density summary of the OpenHAB system (items, things, rooms, health)',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_items',
          description: 'Get all OpenHAB items, optionally filtered by tags, type, or metadata',
          inputSchema: {
            type: 'object',
            properties: {
              tags: { type: 'string', description: 'Comma-separated list of tags to filter by' },
              type: { type: 'string' },
              metadata: { type: 'string', description: 'Metadata selector or regular expression' },
            },
          },
        },
        {
          name: 'get_item',
          description: 'Get a specific OpenHAB item by name',
          inputSchema: {
            type: 'object',
            properties: { itemName: { type: 'string' } },
            required: ['itemName'],
          },
        },
        {
          name: 'send_command',
          description: 'Send a command (e.g., ON, OFF, 50, UP) to an OpenHAB item',
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
          description: 'Update the state of an OpenHAB item',
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
          description:
            'Preferred way to create or update an item definition via the modern REST API (enables managed-mode).',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              itemData: { type: 'object', description: 'Full item definition' },
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
        {
          name: 'add_tag',
          description: 'Add a tag to an item',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              tag: { type: 'string' },
            },
            required: ['itemName', 'tag'],
          },
        },
        {
          name: 'remove_tag',
          description: 'Remove a tag from an item',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              tag: { type: 'string' },
            },
            required: ['itemName', 'tag'],
          },
        },
        {
          name: 'set_metadata',
          description: 'Set metadata on an item',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              namespace: { type: 'string' },
              value: { type: 'string' },
              config: { type: 'object' },
            },
            required: ['itemName', 'namespace', 'value'],
          },
        },
        {
          name: 'remove_metadata',
          description: 'Remove metadata from an item',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              namespace: { type: 'string' },
            },
            required: ['itemName', 'namespace'],
          },
        },

        {
          name: 'get_room_status',
          description:
            'Get a concise status summary of all items in a specific room/location (filtered by tags)',
          inputSchema: {
            type: 'object',
            properties: {
              room: { type: 'string', description: 'The room name (e.g., Lounge, Kitchen)' },
            },
            required: ['room'],
          },
        },
        {
          name: 'find_equipment_by_type',
          description: 'Find all equipment of a specific type (e.g., Light, Speaker) in a room',
          inputSchema: {
            type: 'object',
            properties: {
              room: { type: 'string' },
              type: {
                type: 'string',
                description: 'Equipment type (Light, Speaker, Heater, etc.)',
              },
            },
            required: ['room', 'type'],
          },
        },
        {
          name: 'get_item_statistics',
          description: 'Analyze historical data for an item (averages, peaks, or duty cycles)',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              starttime: { type: 'string', description: 'ISO8601 start time' },
              endtime: { type: 'string', description: 'ISO8601 end time' },
              serviceId: { type: 'string', description: 'Persistence service ID' },
            },
            required: ['itemName'],
          },
        },
        {
          name: 'control_media',
          description:
            'Context-aware media control (play, pause, volume_up, volume_down, next, previous)',
          inputSchema: {
            type: 'object',
            properties: {
              equipmentName: {
                type: 'string',
                description: 'The name or label of the media device',
              },
              action: {
                type: 'string',
                enum: ['play', 'pause', 'volume_up', 'volume_down', 'next', 'previous'],
              },
            },
            required: ['equipmentName', 'action'],
          },
        },
        {
          name: 'validate_rule_logic',
          description: 'Validates script syntax and safety (loops, guards) before creating a rule',
          inputSchema: {
            type: 'object',
            properties: {
              script: { type: 'string' },
              type: { type: 'string', description: 'Mime type (e.g. application/javascript)' },
            },
            required: ['script', 'type'],
          },
        },
        {
          name: 'generate_system_boilerplate',
          description: 'Generates TypeScript interfaces for all items in your home',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'execute_batch',
          description: 'Executes multiple commands in parallel to reduce network latency.',
          inputSchema: {
            type: 'object',
            properties: {
              commands: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    itemName: { type: 'string' },
                    command: { type: 'string' },
                  },
                  required: ['itemName', 'command'],
                },
              },
            },
            required: ['commands'],
          },
        },
        {
          name: 'get_schema',
          description: 'Get a minimal schema of all items (name, type, label) for quick mapping.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_prompt_context',
          description:
            'Get a condensed priming context for an AI agent to understand the system state.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'search_items',
          description: 'Fuzzy search for items by name, label, or room to find hardware matches.',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search term (e.g. Lounge, Light, Sonos)' },
            },
            required: ['query'],
          },
        },
        {
          name: 'shadow_run',
          description:
            'Virtual simulation of a command sequence. Predicts state changes without affecting hardware.',
          inputSchema: {
            type: 'object',
            properties: {
              commands: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    itemName: { type: 'string' },
                    command: { type: 'string' },
                  },
                  required: ['itemName', 'command'],
                },
              },
            },
            required: ['commands'],
          },
        },
        {
          name: 'generate_topology',
          description:
            'Generates a Mermaid topology graph of the home (Room -> Equipment -> Point).',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'analyze_system_health',
          description: 'Proactive scan for hardware issues, low batteries, and OFFLINE nodes.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'predictive_rule_generator',
          description:
            'Converts natural language intent (e.g. "turn off lights when I leave") into a validated JS rule.',
          inputSchema: {
            type: 'object',
            properties: {
              intent: { type: 'string', description: 'Natural language automation goal' },
            },
            required: ['intent'],
          },
        },
        {
          name: 'capture_scene',
          description: 'Captures current state of items as a named scene (Snapshot).',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Unique name for the scene' },
              itemNames: { type: 'array', items: { type: 'string' } },
            },
            required: ['name', 'itemNames'],
          },
        },
        {
          name: 'get_visual_chart',
          description: 'Generate an ASCII sparkline chart for an item’s recent history.',
          inputSchema: {
            type: 'object',
            properties: { itemName: { type: 'string' } },
            required: ['itemName'],
          },
        },
        {
          name: 'activate_scene',
          description: 'Restores a previously captured state (Activate Snapshot).',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Scene name' },
            },
            required: ['name'],
          },
        },
        {
          name: 'generate_ui_widget',
          description: 'Generates professional MainUI YAML for a dashboard widget.',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
            },
            required: ['itemName'],
          },
        },
        {
          name: 'suggest_semantic_tags',
          description: 'AI-driven suggestion for Equipment/Location tags based on naming.',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
            },
            required: ['itemName'],
          },
        },
        // --- Elite Features ---
        {
          name: 'create_equipment_from_thing',
          description:
            'Rapidly creates an Equipment group and all associated Points for a Thing channel, linking them automatically. Massive time saver.',
          inputSchema: {
            type: 'object',
            properties: {
              thingUID: { type: 'string', description: 'The OpenHAB Thing UID' },
              roomGroup: {
                type: 'string',
                description: 'The parent Room Group Name (e.g. Lounge)',
              },
            },
            required: ['thingUID', 'roomGroup'],
          },
        },
        {
          name: 'test_transformation',
          description:
            'Evaluate a REGEX or JSONPATH transformation locally against a value to test extraction patterns.',
          inputSchema: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['REGEX', 'JSONPATH'] },
              pattern: { type: 'string', description: 'The regex or jsonpath pattern' },
              value: {
                type: 'string',
                description: 'The raw string or JSON payload to test against',
              },
            },
            required: ['type', 'pattern', 'value'],
          },
        },
        {
          name: 'find_orphans_and_broken_links',
          description:
            'System Janitor to scan for unlinked items, missing semantics, and links to deleted hardware.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'explain_item_state',
          description:
            'Forensic review of an item. Includes recent history, linked hardware channels, and rules that influence it.',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
            },
            required: ['itemName'],
          },
        },
        {
          name: 'get_recent_logs',
          description:
            'Fetch the recent event stream buffer (up to 100 lines) to see what just happened in OpenHAB.',
          inputSchema: {
            type: 'object',
            properties: {
              lines: { type: 'number', description: 'Number of lines to fetch' },
            },
          },
        },
        {
          name: 'configure_link_profile',
          description:
            'Applies a Profile configuration (e.g. system:follow, transform:JS) to an Item->Channel Link.',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              channelUID: { type: 'string' },
              profile: { type: 'string', description: 'e.g. system:default, system:follow' },
              profileConfig: {
                type: 'object',
                description: 'Additional config per profile requirements',
              },
            },
            required: ['itemName', 'channelUID', 'profile'],
          },
        },
        // --- Advanced Mastery Remediations ---
        {
          name: 'bulk_item_remediation',
          description: 'Mass-update tags, categories, and group memberships for a list of items.',
          inputSchema: {
            type: 'object',
            properties: {
              itemNames: { type: 'array', items: { type: 'string' } },
              updates: {
                type: 'object',
                properties: {
                  tags: { type: 'array', items: { type: 'string' } },
                  category: { type: 'string' },
                  groupNames: { type: 'array', items: { type: 'string' } },
                },
              },
            },
            required: ['itemNames', 'updates'],
          },
        },
        {
          name: 'discover_automation_patterns',
          description:
            'Correlation engine to find temporal relationships between two items for automation ideas.',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              correlatedItemName: { type: 'string' },
            },
            required: ['itemName', 'correlatedItemName'],
          },
        },
        {
          name: 'audit_semantic_model',
          description:
            'Structural audit to find loose items or Equipment missing parent Locations.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'detect_rule_conflicts',
          description:
            'Identifies potential race conditions or conflicting logic between rules targeting the same items.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'standardize_naming_convention',
          description:
            'Audits item names against semantic tags and proposes a unified Location_Equipment_Point format.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'optimize_persistence_strategy',
          description:
            'Recommends optimal persistence strategies (intervals/thresholds) to prevent database bloat.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'sitemap_to_main_ui',
          description: 'Converts legacy .sitemap definitions to modern MainUI YAML cards/pages.',
          inputSchema: {
            type: 'object',
            properties: { sitemapName: { type: 'string' } },
            required: ['sitemapName'],
          },
        },
        {
          name: 'optimize_mcp_focus',
          description:
            'Locks the MCP focus to a specific Room (tag) or Group to save tokens and increase accuracy. Pass null to clear.',
          inputSchema: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['room', 'group'] },
              name: { type: 'string', nullable: true },
            },
            required: ['type'],
          },
        },
        {
          name: 'export_system_snapshot',
          description:
            'Generates a lightweight JSON snapshot of all Items, Things, and Links for backup or comparison.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_mcp_health',
          description:
            'Returns real-time health metrics for the MCP (SSE status, buffer size, cache health).',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'summarize_persistence_range',
          description:
            'Returns statistical summary (Min, Max, Avg) of persistence data to save tokens and avoid context bloat.',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              starttime: { type: 'string', description: 'ISO8601 start time' },
              endtime: { type: 'string', description: 'ISO8601 end time' },
            },
            required: ['itemName', 'starttime', 'endtime'],
          },
        },
        {
          name: 'get_mcp_capabilities',
          description: 'Returns a list of currently active advanced master-tier capabilities.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'simulate_system_state',
          description:
            'Predicts the outcome of a command (including rule triggers) without executing it on real hardware.',
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
          description:
            'Generates a structured Markdown manual of the entire home model, rules, and equipment for AI onboarding.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'audit_system_safety',
          description:
            'Audits security items (Locks, Alarms) for missing safety metadata or insecure configurations.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'calculate_energy_insights',
          description:
            'Aggregates power/energy sensor data into a high-level consumption and efficiency report.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'trigger_discovery_scan',
          description: 'Triggers a manual discovery scan for a specific binding.',
          inputSchema: {
            type: 'object',
            properties: {
              bindingId: { type: 'string', description: 'The binding ID (e.g. hue, sonos)' },
            },
            required: ['bindingId'],
          },
        },
        {
          name: 'get_semantic_path',
          description: 'Returns the full semantic path for an item (e.g., Lounge > Sofa > Light).',
          inputSchema: {
            type: 'object',
            properties: { itemName: { type: 'string' } },
            required: ['itemName'],
          },
        },
        {
          name: 'find_neighboring_equipment',
          description: 'Finds equipment/points in the same location as the target item.',
          inputSchema: {
            type: 'object',
            properties: { itemName: { type: 'string' } },
            required: ['itemName'],
          },
        },
        {
          name: 'schedule_command',
          description: 'Schedules a command to be sent after a delay.',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              command: { type: 'string' },
              delayMs: { type: 'number', description: 'Delay in milliseconds' },
            },
            required: ['itemName', 'command', 'delayMs'],
          },
        },
        {
          name: 'get_stale_items',
          description: 'Identifies items that haven’t updated their state recently.',
          inputSchema: {
            type: 'object',
            properties: {
              days: { type: 'number', description: 'Number of days to check for staleness' },
            },
          },
        },

        // --- Things ---
        {
          name: 'get_things',
          description: 'Get all OpenHAB things',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_thing',
          description: 'Get a specific OpenHAB thing by UID',
          inputSchema: {
            type: 'object',
            properties: { thingUID: { type: 'string' } },
            required: ['thingUID'],
          },
        },
        {
          name: 'create_thing',
          description: 'Create a new thing',
          inputSchema: {
            type: 'object',
            properties: { thingData: { type: 'object' } },
            required: ['thingData'],
          },
        },
        {
          name: 'update_thing',
          description: 'Update a thing definition',
          inputSchema: {
            type: 'object',
            properties: {
              thingUID: { type: 'string' },
              thingData: { type: 'object' },
            },
            required: ['thingUID', 'thingData'],
          },
        },
        {
          name: 'delete_thing',
          description: 'Delete a thing',
          inputSchema: {
            type: 'object',
            properties: {
              thingUID: { type: 'string' },
              force: { type: 'boolean' },
            },
            required: ['thingUID'],
          },
        },
        {
          name: 'enable_thing',
          description: 'Enable or disable a thing',
          inputSchema: {
            type: 'object',
            properties: {
              thingUID: { type: 'string' },
              enable: { type: 'boolean' },
            },
            required: ['thingUID', 'enable'],
          },
        },
        {
          name: 'get_thing_status',
          description: 'Get the status of a thing',
          inputSchema: {
            type: 'object',
            properties: { thingUID: { type: 'string' } },
            required: ['thingUID'],
          },
        },
        {
          name: 'update_thing_config',
          description: 'Update the configuration of a thing',
          inputSchema: {
            type: 'object',
            properties: {
              thingUID: { type: 'string' },
              config: { type: 'object' },
            },
            required: ['thingUID', 'config'],
          },
        },

        // --- Links ---
        {
          name: 'get_links',
          description: 'Get all links between items and channels',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              channelUID: { type: 'string' },
            },
          },
        },
        {
          name: 'link_item_to_channel',
          description: 'Link an item to a channel',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              channelUID: { type: 'string' },
              config: { type: 'object' },
            },
            required: ['itemName', 'channelUID'],
          },
        },
        {
          name: 'unlink_item_from_channel',
          description: 'Unlink an item from a channel',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              channelUID: { type: 'string' },
            },
            required: ['itemName', 'channelUID'],
          },
        },

        // --- Semantic Tags ---
        {
          name: 'get_semantic_tags',
          description: 'Get all available semantic tags',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'create_semantic_tag',
          description: 'Create a new semantic tag',
          inputSchema: {
            type: 'object',
            properties: { tagData: { type: 'object' } },
            required: ['tagData'],
          },
        },
        {
          name: 'get_semantic_tag',
          description: 'Get a specific semantic tag',
          inputSchema: {
            type: 'object',
            properties: { tagId: { type: 'string' } },
            required: ['tagId'],
          },
        },
        {
          name: 'update_semantic_tag',
          description: 'Update a semantic tag',
          inputSchema: {
            type: 'object',
            properties: {
              tagId: { type: 'string' },
              tagData: { type: 'object' },
            },
            required: ['tagId', 'tagData'],
          },
        },
        {
          name: 'delete_semantic_tag',
          description: 'Delete a semantic tag',
          inputSchema: {
            type: 'object',
            properties: { tagId: { type: 'string' } },
            required: ['tagId'],
          },
        },

        // --- Rules ---
        {
          name: 'get_rules',
          description: 'Get all OpenHAB rules',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_rule',
          description: 'Get a specific rule by UID',
          inputSchema: {
            type: 'object',
            properties: { ruleUID: { type: 'string' } },
            required: ['ruleUID'],
          },
        },
        {
          name: 'create_rule',
          description:
            'Preferred way to create a new rule via the modern REST API. Use application/javascript for modern scripting.',
          inputSchema: {
            type: 'object',
            properties: { ruleData: { type: 'object' } },
            required: ['ruleData'],
          },
        },
        {
          name: 'update_rule',
          description: 'Update a rule definition',
          inputSchema: {
            type: 'object',
            properties: {
              ruleUID: { type: 'string' },
              ruleData: { type: 'object' },
            },
            required: ['ruleUID', 'ruleData'],
          },
        },
        {
          name: 'delete_rule',
          description: 'Delete a rule',
          inputSchema: {
            type: 'object',
            properties: { ruleUID: { type: 'string' } },
            required: ['ruleUID'],
          },
        },
        {
          name: 'run_rule',
          description: 'Manually execute an OpenHAB rule by UID',
          inputSchema: {
            type: 'object',
            properties: { ruleUID: { type: 'string' } },
            required: ['ruleUID'],
          },
        },
        {
          name: 'enable_rule',
          description: 'Enable or disable a rule',
          inputSchema: {
            type: 'object',
            properties: {
              ruleUID: { type: 'string' },
              enable: { type: 'boolean' },
            },
            required: ['ruleUID', 'enable'],
          },
        },

        // --- Inbox / Discovery ---
        {
          name: 'get_inbox',
          description: 'Get all discovered things in the inbox',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'approve_inbox_item',
          description: 'Approve a thing in the inbox',
          inputSchema: {
            type: 'object',
            properties: {
              thingUID: { type: 'string' },
              label: { type: 'string' },
              newThingId: { type: 'string' },
            },
            required: ['thingUID'],
          },
        },
        {
          name: 'ignore_inbox_item',
          description: 'Ignore a thing in the inbox',
          inputSchema: {
            type: 'object',
            properties: { thingUID: { type: 'string' } },
            required: ['thingUID'],
          },
        },
        {
          name: 'unignore_inbox_item',
          description: 'Unignore a thing in the inbox',
          inputSchema: {
            type: 'object',
            properties: { thingUID: { type: 'string' } },
            required: ['thingUID'],
          },
        },

        // --- Persistence ---
        {
          name: 'get_persistence_services',
          description: 'Get all available persistence services',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_item_persistence_data',
          description: 'Get historical data for an item',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              serviceId: { type: 'string' },
              starttime: { type: 'string' },
              endtime: { type: 'string' },
            },
            required: ['itemName'],
          },
        },
        {
          name: 'store_item_persistence_data',
          description: 'Store a state in persistence',
          inputSchema: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              time: { type: 'string' },
              state: { type: 'string' },
              serviceId: { type: 'string' },
            },
            required: ['itemName', 'time', 'state'],
          },
        },

        // --- Voice / Audio ---
        {
          name: 'voice_say',
          description: 'Speak a text via OpenHAB TTS',
          inputSchema: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              sinkId: { type: 'string', description: 'Audio sink ID (optional)' },
            },
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
          name: 'get_voices',
          description: 'Get all available TTS voices',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_audio_sinks',
          description: 'Get all audio sinks',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_audio_sources',
          description: 'Get all audio sources',
          inputSchema: { type: 'object', properties: {} },
        },

        // --- Addons ---
        {
          name: 'get_addons',
          description: 'Get all addons',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'install_addon',
          description: 'Install an addon',
          inputSchema: {
            type: 'object',
            properties: { addonId: { type: 'string' } },
            required: ['addonId'],
          },
        },
        {
          name: 'uninstall_addon',
          description: 'Uninstall an addon',
          inputSchema: {
            type: 'object',
            properties: { addonId: { type: 'string' } },
            required: ['addonId'],
          },
        },

        // --- Sitemaps & UI ---
        {
          name: 'get_sitemaps',
          description: 'Get all sitemaps',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_ui_components',
          description: 'Get UI components for a namespace',
          inputSchema: {
            type: 'object',
            properties: { namespace: { type: 'string' } },
            required: ['namespace'],
          },
        },
        {
          name: 'get_ui_tiles',
          description: 'Get all UI tiles',
          inputSchema: { type: 'object', properties: {} },
        },

        // --- System & Config ---
        {
          name: 'get_system_info',
          description: 'Get system information',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_loggers',
          description: 'Get all loggers',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'set_logger_level',
          description: 'Set level for a logger',
          inputSchema: {
            type: 'object',
            properties: {
              loggerName: { type: 'string' },
              level: { type: 'string' },
            },
            required: ['loggerName', 'level'],
          },
        },
        {
          name: 'get_services',
          description: 'Get all services',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_service_config',
          description: 'Get configuration for a service',
          inputSchema: {
            type: 'object',
            properties: { serviceId: { type: 'string' } },
            required: ['serviceId'],
          },
        },
        {
          name: 'update_service_config',
          description: 'Update service configuration',
          inputSchema: {
            type: 'object',
            properties: {
              serviceId: { type: 'string' },
              config: { type: 'object' },
            },
            required: ['serviceId', 'config'],
          },
        },
        {
          name: 'get_templates',
          description: 'Get all templates',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_transformations',
          description: 'Get all transformations',
          inputSchema: { type: 'object', properties: {} },
        },

        // --- Habot ---
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
        // --- Items ---
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
            .object({
              itemName: z.string(),
              command: z.string(),
            })
            .parse(args);
          result = await client.sendCommand(itemName, command);
          break;
        }
        case 'update_state': {
          const { itemName, state } = z
            .object({
              itemName: z.string(),
              state: z.string(),
            })
            .parse(args);
          result = await client.updateState(itemName, state);
          break;
        }
        case 'create_or_update_item': {
          const { itemName, itemData } = z
            .object({
              itemName: z.string(),
              itemData: z.record(z.string(), z.any()),
            })
            .parse(args);
          result = await client.createOrUpdateItem(itemName, itemData);
          break;
        }
        case 'delete_item': {
          const { itemName } = z.object({ itemName: z.string() }).parse(args);
          result = await client.deleteItem(itemName);
          break;
        }
        case 'add_tag': {
          const { itemName, tag } = z
            .object({
              itemName: z.string(),
              tag: z.string(),
            })
            .parse(args);
          result = await client.addTag(itemName, tag);
          break;
        }
        case 'remove_tag': {
          const { itemName, tag } = z
            .object({
              itemName: z.string(),
              tag: z.string(),
            })
            .parse(args);
          result = await client.removeTag(itemName, tag);
          break;
        }
        case 'set_metadata': {
          const { itemName, namespace, value, config } = z
            .object({
              itemName: z.string(),
              namespace: z.string(),
              value: z.string(),
              config: z.record(z.string(), z.any()).optional(),
            })
            .parse(args);
          result = await client.setMetadata(itemName, namespace, value, config);
          break;
        }
        case 'remove_metadata': {
          const { itemName, namespace } = z
            .object({
              itemName: z.string(),
              namespace: z.string(),
            })
            .parse(args);
          result = await client.removeMetadata(itemName, namespace);
          break;
        }
        case 'get_room_status': {
          const { room } = z.object({ room: z.string() }).parse(args);
          // Fetch all items in this room/location by tag
          const items = await client.getItems(room);
          const summary = items.map((i: OpenHabItem) => ({
            name: i.name,
            label: i.label,
            type: i.type,
            state: i.state,
          }));
          result = { room, count: summary.length, items: summary };
          break;
        }
        case 'find_equipment_by_type': {
          const { room, type } = z.object({ room: z.string(), type: z.string() }).parse(args);
          result = await client.findEquipmentByType(room, type);
          break;
        }
        case 'get_item_statistics': {
          const { itemName, starttime, endtime, serviceId } = z
            .object({
              itemName: z.string(),
              starttime: z.string().optional(),
              endtime: z.string().optional(),
              serviceId: z.string().optional(),
            })
            .parse(args);
          result = await client.getItemStatistics(itemName, starttime, endtime, serviceId);
          break;
        }
        case 'control_media': {
          const { equipmentName, action } = z
            .object({
              equipmentName: z.string(),
              action: z.string(),
            })
            .parse(args);
          result = await client.controlMedia(equipmentName, action);
          break;
        }
        case 'validate_rule_logic': {
          const { script, type } = z
            .object({
              script: z.string(),
              type: z.string(),
            })
            .parse(args);
          result = await client.validateRuleLogic(script, type);
          break;
        }
        case 'generate_system_boilerplate': {
          result = await client.generateSystemBoilerplate();
          break;
        }
        case 'execute_batch': {
          const { commands } = z
            .object({
              commands: z.array(
                z.object({
                  itemName: z.string(),
                  command: z.string(),
                })
              ),
            })
            .parse(args);
          result = await client.executeBatch(commands);
          break;
        }
        case 'search_items': {
          const { query } = z.object({ query: z.string() }).parse(args);
          result = await client.searchItems(query);
          break;
        }
        case 'get_schema': {
          result = await client.getSchema();
          break;
        }
        case 'get_prompt_context': {
          result = await client.getPromptContext();
          break;
        }
        case 'shadow_run': {
          const { commands } = z
            .object({
              commands: z.array(
                z.object({
                  itemName: z.string(),
                  command: z.string(),
                })
              ),
            })
            .parse(args);
          result = await client.shadowRun(commands);
          break;
        }
        case 'generate_topology': {
          result = await client.generateTopology();
          break;
        }
        case 'analyze_system_health': {
          result = await client.analyzeSystemHealth();
          break;
        }
        case 'predictive_rule_generator': {
          const { intent } = z.object({ intent: z.string() }).parse(args);
          result = await client.generateRuleFromNL(intent);
          break;
        }
        case 'capture_scene': {
          const { name, itemNames } = z
            .object({
              name: z.string(),
              itemNames: z.array(z.string()),
            })
            .parse(args);
          result = await client.captureScene(name, itemNames);
          break;
        }
        case 'activate_scene': {
          const { name } = z.object({ name: z.string() }).parse(args);
          result = await client.activateScene(name);
          break;
        }
        case 'get_visual_chart': {
          const { itemName } = z.object({ itemName: z.string() }).parse(args);
          result = await client.getVisualChart(itemName);
          break;
        }
        case 'generate_ui_widget': {
          const { itemName } = z.object({ itemName: z.string() }).parse(args);
          result = await client.generateUIWidget(itemName);
          break;
        }
        case 'suggest_semantic_tags': {
          const { itemName } = z.object({ itemName: z.string() }).parse(args);
          result = await client.suggestSemanticTags(itemName);
          break;
        }

        // --- Elite Features ---
        case 'create_equipment_from_thing': {
          const { thingUID, roomGroup } = z
            .object({ thingUID: z.string(), roomGroup: z.string() })
            .parse(args);
          result = await client.createEquipmentFromThing(thingUID, roomGroup);
          break;
        }
        case 'test_transformation': {
          const { type, pattern, value } = z
            .object({ type: z.string(), pattern: z.string(), value: z.string() })
            .parse(args);
          result = client.testTransformation(type, pattern, value);
          break;
        }
        case 'find_orphans_and_broken_links': {
          result = await client.findOrphansAndBrokenLinks();
          break;
        }
        case 'explain_item_state': {
          const { itemName } = z.object({ itemName: z.string() }).parse(args);
          result = await client.explainItemState(itemName);
          break;
        }
        case 'get_recent_logs': {
          const { lines } = z.object({ lines: z.number().optional() }).parse(args);
          result = await client.getRecentLogs(lines);
          break;
        }
        case 'configure_link_profile': {
          const { itemName, channelUID, profile, profileConfig } = z
            .object({
              itemName: z.string(),
              channelUID: z.string(),
              profile: z.string(),
              profileConfig: z.record(z.string(), z.any()).optional(),
            })
            .parse(args);
          result = await client.configureLinkProfile(itemName, channelUID, profile, profileConfig);
          break;
        }
        case 'bulk_item_remediation': {
          const { itemNames, updates } = z
            .object({
              itemNames: z.array(z.string()),
              updates: z.object({
                tags: z.array(z.string()).optional(),
                category: z.string().optional(),
                groupNames: z.array(z.string()).optional(),
              }),
            })
            .parse(args);
          result = await client.bulkItemRemediation(itemNames, updates);
          break;
        }
        case 'discover_automation_patterns': {
          const { itemName, correlatedItemName } = z
            .object({
              itemName: z.string(),
              correlatedItemName: z.string(),
            })
            .parse(args);
          result = await client.discoverAutomationPatterns(itemName, correlatedItemName);
          break;
        }
        case 'audit_semantic_model': {
          result = await client.auditSemanticModel();
          break;
        }
        case 'detect_rule_conflicts': {
          result = await client.detectRuleConflicts();
          break;
        }
        case 'standardize_naming_convention': {
          result = await client.standardizeNamingConvention();
          break;
        }
        case 'optimize_persistence_strategy': {
          result = await client.optimizePersistenceStrategy();
          break;
        }
        case 'sitemap_to_main_ui': {
          const { sitemapName } = z.object({ sitemapName: z.string() }).parse(args);
          result = await client.sitemapToMainUI(sitemapName);
          break;
        }
        case 'optimize_mcp_focus': {
          const { type, name } = z
            .object({
              type: z.enum(['room', 'group']),
              name: z.string().nullable(),
            })
            .parse(args);
          result = client.optimizeMcpFocus(type, name);
          break;
        }
        case 'export_system_snapshot': {
          result = await client.exportSystemSnapshot();
          break;
        }
        case 'get_mcp_health': {
          result = client.getMcpHealth();
          break;
        }
        case 'summarize_persistence_range': {
          const { itemName, starttime, endtime } = z
            .object({
              itemName: z.string(),
              starttime: z.string(),
              endtime: z.string(),
            })
            .parse(args);
          result = await client.summarizePersistenceRange(itemName, starttime, endtime);
          break;
        }
        case 'get_mcp_capabilities': {
          result = client.getMcpCapabilities();
          break;
        }
        case 'simulate_system_state': {
          const { itemName, command } = z
            .object({
              itemName: z.string(),
              command: z.string(),
            })
            .parse(args);
          result = await client.simulateSystemState(itemName, command);
          break;
        }
        case 'generate_home_blueprint': {
          result = await client.generateHomeBlueprint();
          break;
        }
        case 'audit_system_safety': {
          result = await client.auditSystemSafety();
          break;
        }
        case 'calculate_energy_insights': {
          result = await client.calculateEnergyInsights();
          break;
        }
        case 'trigger_discovery_scan': {
          const { bindingId } = z.object({ bindingId: z.string() }).parse(args);
          result = await client.triggerDiscoveryScan(bindingId);
          break;
        }
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
          const { itemName, command, delayMs } = z
            .object({
              itemName: z.string(),
              command: z.string(),
              delayMs: z.number(),
            })
            .parse(args);
          result = await client.scheduleCommand(itemName, command, delayMs);
          break;
        }
        case 'get_stale_items': {
          const { days } = z.object({ days: z.number().optional() }).parse(args);
          result = await client.getStaleItems(days);
          break;
        }

        // --- Things ---
        case 'get_things':
          result = await client.getThings();
          break;
        case 'get_thing': {
          const { thingUID } = z.object({ thingUID: z.string() }).parse(args);
          result = await client.getThing(thingUID);
          break;
        }
        case 'create_thing': {
          const { thingData } = z.object({ thingData: z.record(z.string(), z.any()) }).parse(args);
          result = await client.createThing(thingData);
          break;
        }
        case 'update_thing': {
          const { thingUID, thingData } = z
            .object({ thingUID: z.string(), thingData: z.record(z.string(), z.any()) })
            .parse(args);
          result = await client.updateThing(thingUID, thingData);
          break;
        }
        case 'delete_thing': {
          const { thingUID, force } = z
            .object({ thingUID: z.string(), force: z.boolean().optional() })
            .parse(args);
          result = await client.deleteThing(thingUID, force);
          break;
        }
        case 'enable_thing': {
          const { thingUID, enable } = z
            .object({ thingUID: z.string(), enable: z.boolean() })
            .parse(args);
          result = await client.enableThing(thingUID, enable);
          break;
        }
        case 'get_thing_status': {
          const { thingUID } = z.object({ thingUID: z.string() }).parse(args);
          result = await client.getThingStatus(thingUID);
          break;
        }
        case 'update_thing_config': {
          const { thingUID, config } = z
            .object({ thingUID: z.string(), config: z.record(z.string(), z.any()) })
            .parse(args);
          result = await client.updateThingConfig(thingUID, config);
          break;
        }

        // --- Links ---
        case 'get_links': {
          const { itemName, channelUID } = z
            .object({ itemName: z.string().optional(), channelUID: z.string().optional() })
            .parse(args);
          result = await client.getLinks(itemName, channelUID);
          break;
        }
        case 'link_item_to_channel': {
          const { itemName, channelUID, config } = z
            .object({
              itemName: z.string(),
              channelUID: z.string(),
              config: z.record(z.string(), z.any()).optional(),
            })
            .parse(args);
          result = await client.linkItemToChannel(itemName, channelUID, config);
          break;
        }
        case 'unlink_item_from_channel': {
          const { itemName, channelUID } = z
            .object({ itemName: z.string(), channelUID: z.string() })
            .parse(args);
          result = await client.unlinkItemFromChannel(itemName, channelUID);
          break;
        }

        // --- Semantic Tags ---
        case 'get_semantic_tags':
          result = await client.getSemanticTags();
          break;
        case 'create_semantic_tag': {
          const { tagData } = z.object({ tagData: z.any() }).parse(args);
          result = await client.createSemanticTag(tagData);
          break;
        }
        case 'get_semantic_tag': {
          const { tagId } = z.object({ tagId: z.string() }).parse(args);
          result = await client.getSemanticTag(tagId);
          break;
        }
        case 'update_semantic_tag': {
          const { tagId, tagData } = z.object({ tagId: z.string(), tagData: z.any() }).parse(args);
          result = await client.updateSemanticTag(tagId, tagData);
          break;
        }
        case 'delete_semantic_tag': {
          const { tagId } = z.object({ tagId: z.string() }).parse(args);
          result = await client.deleteSemanticTag(tagId);
          break;
        }

        // --- Rules ---
        case 'get_rules':
          result = await client.getRules();
          break;
        case 'get_rule': {
          const { ruleUID } = z.object({ ruleUID: z.string() }).parse(args);
          result = await client.getRule(ruleUID);
          break;
        }
        case 'create_rule': {
          const { ruleData } = z.object({ ruleData: z.record(z.string(), z.any()) }).parse(args);
          result = await client.createRule(ruleData);
          break;
        }
        case 'update_rule': {
          const { ruleUID, ruleData } = z
            .object({ ruleUID: z.string(), ruleData: z.record(z.string(), z.any()) })
            .parse(args);
          result = await client.updateRule(ruleUID, ruleData);
          break;
        }
        case 'delete_rule': {
          const { ruleUID } = z.object({ ruleUID: z.string() }).parse(args);
          result = await client.deleteRule(ruleUID);
          break;
        }
        case 'run_rule': {
          const { ruleUID, context } = z
            .object({ ruleUID: z.string(), context: z.record(z.string(), z.any()).optional() })
            .parse(args);
          result = await client.runRule(ruleUID, context);
          break;
        }
        case 'enable_rule': {
          const { ruleUID, enable } = z
            .object({ ruleUID: z.string(), enable: z.boolean() })
            .parse(args);
          result = await client.enableRule(ruleUID, enable);
          break;
        }

        // --- Inbox / Discovery ---
        case 'get_inbox':
          result = await client.getInbox();
          break;
        case 'approve_inbox_item': {
          const { thingUID, newThingId, label } = z
            .object({
              thingUID: z.string(),
              newThingId: z.string().optional(),
              label: z.string().optional(),
            })
            .parse(args);
          result = await client.approveInboxItem(thingUID, label, newThingId);
          break;
        }
        case 'ignore_inbox_item': {
          const { thingUID } = z.object({ thingUID: z.string() }).parse(args);
          result = await client.ignoreInboxItem(thingUID);
          break;
        }
        case 'unignore_inbox_item': {
          const { thingUID } = z.object({ thingUID: z.string() }).parse(args);
          result = await client.unignoreInboxItem(thingUID);
          break;
        }

        // --- Persistence ---
        case 'get_persistence_services':
          result = await client.getPersistenceServices();
          break;
        case 'get_item_persistence_data': {
          const { itemName, serviceId, starttime, endtime } = z
            .object({
              itemName: z.string(),
              serviceId: z.string().optional(),
              starttime: z.string().optional(),
              endtime: z.string().optional(),
            })
            .parse(args);
          result = await client.getItemPersistenceData(itemName, serviceId, starttime, endtime);
          break;
        }
        case 'store_item_persistence_data': {
          const { itemName, time, state, serviceId } = z
            .object({
              itemName: z.string(),
              time: z.string(),
              state: z.string(),
              serviceId: z.string().optional(),
            })
            .parse(args);
          result = await client.storeItemPersistenceData(itemName, time, state, serviceId);
          break;
        }

        // --- Voice / Audio ---
        case 'voice_say': {
          const { text, voiceId, sinkId } = z
            .object({
              text: z.string(),
              voiceId: z.string().optional(),
              sinkId: z.string().optional(),
            })
            .parse(args);
          result = await client.voiceSay(text, voiceId, sinkId);
          break;
        }
        case 'voice_interpret': {
          const { text, interpreterIds } = z
            .object({ text: z.string(), interpreterIds: z.string().optional() })
            .parse(args);
          result = await client.voiceInterpret(text, interpreterIds);
          break;
        }
        case 'get_voices':
          result = await client.getVoices();
          break;
        case 'get_audio_sinks':
          result = await client.getAudioSinks();
          break;
        case 'get_audio_sources':
          result = await client.getAudioSources();
          break;

        // --- Addons ---
        case 'get_addons':
          result = await client.getAddons();
          break;
        case 'install_addon': {
          const { addonId } = z.object({ addonId: z.string() }).parse(args);
          result = await client.installAddon(addonId);
          break;
        }
        case 'uninstall_addon': {
          const { addonId } = z.object({ addonId: z.string() }).parse(args);
          result = await client.uninstallAddon(addonId);
          break;
        }

        // --- Sitemaps & UI ---
        case 'get_sitemaps':
          result = await client.getSitemaps();
          break;
        case 'get_ui_components': {
          const { namespace } = z.object({ namespace: z.string() }).parse(args);
          result = await client.getUIComponents(namespace);
          break;
        }
        case 'get_ui_tiles':
          result = await client.getUITiles();
          break;

        // --- System & Logging ---
        case 'get_system_info':
          result = await client.getSystemInfo();
          break;
        case 'get_loggers':
          result = await client.getLoggers();
          break;
        case 'set_logger_level': {
          const { loggerName, level } = z
            .object({ loggerName: z.string(), level: z.string() })
            .parse(args);
          result = await client.setLoggerLevel(loggerName, level);
          break;
        }

        // --- Services ---
        case 'get_services':
          result = await client.getServices();
          break;
        case 'get_service_config': {
          const { serviceId } = z.object({ serviceId: z.string() }).parse(args);
          result = await client.getServiceConfig(serviceId);
          break;
        }
        case 'update_service_config': {
          const { serviceId, config } = z
            .object({ serviceId: z.string(), config: z.record(z.string(), z.any()) })
            .parse(args);
          result = await client.updateServiceConfig(serviceId, config);
          break;
        }

        // --- Templates & Transformations ---
        case 'get_templates':
          result = await client.getTemplates();
          break;
        case 'get_transformations':
          result = await client.getTransformations();
          break;

        // --- Habot ---
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
