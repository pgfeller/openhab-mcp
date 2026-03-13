
import { OpenHabClient } from './src/openhab-client.js';

async function verify() {
    const client = new OpenHabClient('http://localhost:8080', 'fake', { enableSSE: true });
    const clientAny = client as any;
    
    console.log('--- Verifying Log Buffering ---');
    for (let i = 0; i < 10; i++) {
        clientAny.addLogToBuffer(`Test log line ${i}`);
    }
    
    const recent = await client.getRecentLogs(5);
    console.log(`Recent logs count: ${recent.length}`);
    recent.forEach(l => console.log(`  ${l}`));
    
    if (recent.length === 5 && recent[4] === 'Test log line 9') {
        console.log('✅ Recent logs verified');
    } else {
        console.log('❌ Recent log verification failed');
    }

    console.log('\n--- Verifying Historical Logs ---');
    const historical = await clientAny.getHistoricalLogs(10);
    console.log(`Historical logs count: ${historical.length}`);
    if (historical.length === 10 && historical[0] === 'Test log line 0') {
        console.log('✅ Historical logs verified');
    } else {
        console.log('❌ Historical log verification failed');
    }

    console.log('\n--- Verifying Search Filter ---');
    const filtered = await clientAny.getHistoricalLogs(10, 'line 5');
    console.log(`Filtered logs count: ${filtered.length}`);
    if (filtered.length === 1 && filtered[0].includes('line 5')) {
        console.log('✅ Filtered logs verified');
    } else {
        console.log('❌ Filtered log verification failed');
    }

    console.log('\n--- Verifying MCP Health ---');
    const health = client.getMcpHealth();
    console.log(`Health Status: ${health.status}`);
    console.log(`Buffer Size: ${health.sse.bufferSize}`);
    if (health.status === 'OK' && health.sse.bufferSize === 10) {
        console.log('✅ MCP Health verified');
    } else {
        console.log('❌ MCP Health verification failed');
    }
}

verify().catch(console.error);
