import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { OpenHabClient } from './openhab-client.js';
import { registerTools } from './tools.js';

async function main() {
  const openhabUrl = process.env.OPENHAB_URL;
  const apiToken = process.env.OPENHAB_API_TOKEN;

  // We enforce settings via Env variables
  if (!openhabUrl || !apiToken) {
    console.error('Error: OPENHAB_URL and OPENHAB_API_TOKEN environment variables are required.');
    console.error(
      'Example: OPENHAB_URL=http://openhab.localdomain:8080 OPENHAB_API_TOKEN=oh.mytoken node dist/index.js'
    );
    process.exit(1);
  }

  // Set up MCP Server
  const server = new Server(
    { name: 'openhab-mcp', version: '1.0.0' },
    { capabilities: { tools: {}, resources: { subscribe: true } } }
  );

  // Initialize Client
  const client = new OpenHabClient(openhabUrl, apiToken);

  // Register Resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: 'openhab://items',
        name: 'OpenHAB Items',
        mimeType: 'application/json',
        description: 'A list of all items and their current states',
      },
      {
        uri: 'openhab://things',
        name: 'OpenHAB Things',
        mimeType: 'application/json',
        description: 'A list of all configured things and their status',
      },
      {
        uri: 'openhab://discovery',
        name: 'OpenHAB Discovery Inbox',
        mimeType: 'application/json',
        description: 'A list of discovered but unconfigured things in the inbox',
      },
      {
        uri: 'openhab://summary',
        name: 'OpenHAB System Summary',
        mimeType: 'application/json',
        description: 'A token-efficient overview of the system state for LLM context optimization',
      },
      {
        uri: 'openhab://schema',
        name: 'OpenHAB Item Schema',
        mimeType: 'application/json',
        description: 'Ultra-minimal list of item names and types for zero-token discovery',
      },
      {
        uri: 'openhab://prompt-context',
        name: 'OpenHAB AI Prompt Context',
        mimeType: 'text/markdown',
        description:
          'Pre-baked system prompt fragment to prime any AI agent for this specific home',
      },
    ],
  }));

  // Register Resource Templates
  server.setRequestHandler(ListResourcesRequestSchema, async (_request, _extra) => {
    // Note: The SDK might handle ListResources and ResourceTemplates differently
    // depending on version, but adding them to the list is standard.
    return {
      resources: [
        {
          uri: 'openhab://items',
          name: 'OpenHAB Items',
          mimeType: 'application/json',
        },
        {
          uri: 'openhab://things',
          name: 'OpenHAB Things',
          mimeType: 'application/json',
        },
        {
          uri: 'openhab://discovery',
          name: 'OpenHAB Discovery Inbox',
          mimeType: 'application/json',
        },
        {
          uri: 'openhab://summary',
          name: 'OpenHAB System Summary',
          mimeType: 'application/json',
        },
        {
          uri: 'openhab://schema',
          name: 'OpenHAB Item Schema',
          mimeType: 'application/json',
        },
        {
          uri: 'openhab://prompt-context',
          name: 'OpenHAB AI Prompt Context',
          mimeType: 'text/markdown',
        },
        {
          uri: 'openhab://visual/charts/{item}',
          name: 'Item Visual Telemetry',
          description: "ASCII Sparkline representation of an item's recent historical trend.",
          mimeType: 'text/markdown',
        },
      ],
      resourceTemplates: [
        {
          uriTemplate: 'openhab://items/{name}',
          name: 'Specific OpenHAB Item',
          mimeType: 'application/json',
          description: 'Access a single item by its name',
        },
        {
          uriTemplate: 'openhab://things/{uid}',
          name: 'Specific OpenHAB Thing',
          mimeType: 'application/json',
          description: 'Access a single thing by its UID',
        },
        {
          uriTemplate: 'openhab://visual/charts/{item}',
          name: 'Item Visual Telemetry',
          mimeType: 'text/markdown',
          description: 'ASCII Sparkline trend analysis for an item',
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri === 'openhab://items') {
      const items = await client.getItems();
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'application/json',
            text: JSON.stringify(items, null, 2),
          },
        ],
      };
    }
    if (request.params.uri === 'openhab://things') {
      const things = await client.getThings();
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'application/json',
            text: JSON.stringify(things, null, 2),
          },
        ],
      };
    }
    if (request.params.uri === 'openhab://discovery') {
      const inbox = await client.getInbox();
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'application/json',
            text: JSON.stringify(inbox, null, 2),
          },
        ],
      };
    }
    if (request.params.uri === 'openhab://summary') {
      const summary = await client.getSystemSummary();
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'application/json',
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    }
    if (request.params.uri === 'openhab://schema') {
      const schema = await client.getSchema();
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'application/json',
            text: JSON.stringify(schema, null, 2),
          },
        ],
      };
    }
    if (request.params.uri === 'openhab://prompt-context') {
      const context = await client.getPromptContext();
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'text/markdown',
            text: context,
          },
        ],
      };
    }

    // Handle Templates
    const itemMatch = request.params.uri.match(/^openhab:\/\/items\/(.+)$/);
    if (itemMatch) {
      const itemName = itemMatch[1];
      const item = await client.getItem(itemName);
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'application/json',
            text: JSON.stringify(item, null, 2),
          },
        ],
      };
    }

    const thingMatch = request.params.uri.match(/^openhab:\/\/things\/(.+)$/);
    if (thingMatch) {
      const thingUID = thingMatch[1];
      const thing = await client.getThing(thingUID);
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'application/json',
            text: JSON.stringify(thing, null, 2),
          },
        ],
      };
    }

    const chartMatch = request.params.uri.match(/^openhab:\/\/visual\/charts\/(.+)$/);
    if (chartMatch) {
      const itemName = chartMatch[1];
      const chart = await client.getVisualChart(itemName);
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'text/markdown',
            text: chart,
          },
        ],
      };
    }

    throw new Error(`Resource not found: ${request.params.uri}`);
  });

  // Register Tools
  registerTools(server, client);

  // Use stdio for communication with MCP Clients
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`OpenHAB MCP Server started successfully connected to ${openhabUrl}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
