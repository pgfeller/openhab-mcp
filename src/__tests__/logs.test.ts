import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { OpenHabClient } from '../openhab-client.js';

describe('OpenHabClient Logs', () => {
    let client: OpenHabClient;
    let mock: MockAdapter;
    const baseUrl = 'http://openhab:8080';
    const apiToken = 'fake-token';

    beforeEach(() => {
        mock = new MockAdapter(axios as any);
        // We need to trigger the SSE handler manually to fill the buffer
        client = new OpenHabClient(baseUrl, apiToken, { enableSSE: true });
    });

    afterEach(() => {
        mock.restore();
    });

    it('should buffer events and retrieve logs', async () => {
        // Access private buffer for testing purposes (using any cast)
        const clientAny = client as any;
        
        // Populate buffer
        for (let i = 0; i < 50; i++) {
            clientAny.addLogToBuffer(`Log entry ${i}`);
        }

        const recent = await client.getRecentLogs(20);
        expect(recent).toHaveLength(20);
        expect(recent[19]).toBe('Log entry 49');

        const historical = await (client as any).getHistoricalLogs(50);
        expect(historical).toHaveLength(50);
        expect(historical[0]).toBe('Log entry 0');
    });

    it('should filter logs by search query', async () => {
        const clientAny = client as any;
        clientAny.addLogToBuffer('Critical Error: system failed');
        clientAny.addLogToBuffer('Info: system starting');
        clientAny.addLogToBuffer('Warning: high memory');

        const filtered = await (client as any).getHistoricalLogs(10, 'Critical');
        expect(filtered).toHaveLength(1);
        expect(filtered[0]).toContain('Critical Error');
    });

    it('should respect the log buffer limits', async () => {
        const clientAny = client as any;
        // The new limit is 5000
        for (let i = 0; i < 6000; i++) {
            clientAny.addLogToBuffer(`Log ${i}`);
        }

        const historical = await (client as any).getHistoricalLogs(6000);
        expect(historical).toHaveLength(5000); // Should be capped at MAX_LOG_BUFFER
        expect(historical[0]).toBe('Log 1000');
    });
});
