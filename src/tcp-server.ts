import net from 'net';
import type { OpenHabClient } from './openhab-client.js';

function safeJsonParse(s: string) {
    try { return JSON.parse(s); } catch { return null; }
}

function send(socket: net.Socket, obj: any) {
    try {
        socket.write(JSON.stringify(obj) + '\n');
    } catch (e) {
        // ignore
    }
}

export async function startTcpServer(client: OpenHabClient, port = 8001) {
    const server = net.createServer((socket) => {
        let buffer = '';
        socket.setEncoding('utf8');

        socket.on('data', async (chunk: string) => {
            buffer += chunk;
            let idx;
            while ((idx = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, idx).trim();
                buffer = buffer.slice(idx + 1);
                if (!line) continue;
                const msg = safeJsonParse(line);
                if (!msg) {
                    // ignore invalid JSON
                    continue;
                }

                // JSON-RPC initialize
                if (msg.method === 'initialize') {
                    const id = msg.id ?? null;
                    const result = {
                        server: 'openhab-mcp',
                        version: '1.0.0',
                        capabilities: { tools: true, resources: true, subscribe: true },
                    };
                    send(socket, { jsonrpc: '2.0', id, result });
                    continue;
                }

                // ReadResource-style messages: look for params.uri
                const uri = msg?.params?.uri || msg?.uri;
                if (typeof uri === 'string' && uri.startsWith('openhab://')) {
                    try {
                        if (uri === 'openhab://summary') {
                            const summary = await client.getSystemSummary();
                            send(socket, { jsonrpc: '2.0', id: msg.id ?? null, result: { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(summary) }] } });
                            continue;
                        }
                        if (uri === 'openhab://items') {
                            const items = await client.getItems();
                            send(socket, { jsonrpc: '2.0', id: msg.id ?? null, result: { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(items) }] } });
                            continue;
                        }
                        const itemMatch = uri.match(/^openhab:\/\/items\/(.+)$/);
                        if (itemMatch) {
                            const item = await client.getItem(itemMatch[1]);
                            send(socket, { jsonrpc: '2.0', id: msg.id ?? null, result: { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(item) }] } });
                            continue;
                        }
                    } catch (e: any) {
                        send(socket, { jsonrpc: '2.0', id: msg.id ?? null, error: { message: e.message || String(e) } });
                        continue;
                    }
                }

                // Default acknowledgement
                send(socket, { jsonrpc: '2.0', id: msg.id ?? null, result: { status: 'accepted' } });
            }
        });

        socket.on('error', () => { });
    });

    return new Promise<void>((resolve, reject) => {
        server.listen(port, () => {
            console.error(`TCP MCP transport listening on port ${port}`);
            resolve();
        });
        server.on('error', reject);
    });
}
