import express, { Request, Response } from 'express';
import type { OpenHabClient } from './openhab-client.js';

export async function startHttpServer(client: OpenHabClient, port = 8000) {
    const app = express();
    app.use(express.json());

    app.get('/', (_req: Request, res: Response) => res.send('OpenHAB MCP - HTTP adapter'));

    // Accept POSTs at root so clients sending messages to `/` don't get 404.
    // If the payload looks like a ReadResource-style request with a `params.uri`,
    // try to satisfy it using the existing OpenHAB client. Otherwise acknowledge.
    app.post('/', async (req: Request, res: Response) => {
        const body = req.body;
        try {
            // Handle JSON-RPC initialize requests from MCP clients over HTTP
            if (body && body.method === 'initialize') {
                const id = body.id ?? null;
                // Minimal initialize result to satisfy clients: include server identity
                const result = {
                    server: 'openhab-mcp',
                    version: '1.0.0',
                    capabilities: {
                        tools: true,
                        resources: true,
                        subscribe: true
                    }
                };
                return res.json({ jsonrpc: '2.0', id, result });
            }

            // If client requests a resource by URI, handle a few common patterns
            const uri = body?.params?.uri || body?.uri;
            if (typeof uri === 'string' && uri.startsWith('openhab://')) {
                // Mirror the ReadResourceRequest handler behavior
                if (uri === 'openhab://items') {
                    const items = await client.getItems();
                    return res.json({ contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(items) }] });
                }
                if (uri === 'openhab://things') {
                    const things = await client.getThings();
                    return res.json({ contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(things) }] });
                }
                if (uri === 'openhab://discovery') {
                    const inbox = await client.getInbox();
                    return res.json({ contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(inbox) }] });
                }
                if (uri === 'openhab://summary') {
                    const summary = await client.getSystemSummary();
                    return res.json({ contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(summary) }] });
                }
                const itemMatch = uri.match(/^openhab:\/\/items\/(.+)$/);
                if (itemMatch) {
                    const item = await client.getItem(itemMatch[1]);
                    return res.json({ contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(item) }] });
                }
                const thingMatch = uri.match(/^openhab:\/\/things\/(.+)$/);
                if (thingMatch) {
                    const thing = await client.getThing(thingMatch[1]);
                    return res.json({ contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(thing) }] });
                }
            }

            // Fallback: acknowledge receipt so client won't fall back to legacy SSE
            res.json({ status: 'accepted', note: 'Received by HTTP adapter; no-op' });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/openhab/items', async (req: Request, res: Response) => {
        try {
            const items = await client.getItems(req.query.tags as any, req.query.type as any, req.query.metadata as any);
            res.json(items);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/openhab/items/:name', async (req: Request, res: Response) => {
        try {
            const item = await client.getItem(req.params.name);
            res.json(item);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/openhab/things', async (_req: Request, res: Response) => {
        try {
            const things = await client.getThings();
            res.json(things);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/openhab/things/:uid', async (req: Request, res: Response) => {
        try {
            const thing = await client.getThing(req.params.uid);
            res.json(thing);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/openhab/discovery', async (_req: Request, res: Response) => {
        try {
            const inbox = await client.getInbox();
            res.json(inbox);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/openhab/summary', async (_req: Request, res: Response) => {
        try {
            const summary = await client.getSystemSummary();
            res.json(summary);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/openhab/schema', async (_req: Request, res: Response) => {
        try {
            const schema = await client.getSchema();
            res.json(schema);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/openhab/prompt-context', async (_req: Request, res: Response) => {
        try {
            const context = await client.getPromptContext();
            res.type('text/markdown').send(context);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/openhab/visual/charts/:item', async (req: Request, res: Response) => {
        try {
            const chart = await client.getVisualChart(req.params.item);
            res.type('text/markdown').send(chart);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // Simple health-check endpoint
    app.get('/health', async (_req: Request, res: Response) => {
        const start = Date.now();
        const timeoutMs = 2000;

        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), timeoutMs)
        );

        try {
            // Attempt a light OpenHAB call to verify external connectivity
            await Promise.race([client.getSystemInfo(), timeout]);
            res.json({ status: 'ok', openhab: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString(), latencyMs: Date.now() - start });
        } catch (err: any) {
            res.status(503).json({ status: 'degraded', openhab: 'unreachable', reason: err.message || String(err), timestamp: new Date().toISOString(), latencyMs: Date.now() - start });
        }
    });

    return new Promise<void>((resolve) => {
        app.listen(port, () => {
            console.error(`HTTP adapter listening on port ${port}`);
            resolve();
        });
    });
}
