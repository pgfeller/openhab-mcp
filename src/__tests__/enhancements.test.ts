import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { OpenHabClient } from '../openhab-client.js';

describe('OpenHabClient Enhancements', () => {
  let client: OpenHabClient;
  let mock: MockAdapter;
  const baseUrl = 'http://openhab:8080';
  const apiToken = 'fake-token';

  beforeEach(() => {
    mock = new MockAdapter(axios as any);
    client = new OpenHabClient(baseUrl, apiToken, { enableSSE: false });
    vi.useFakeTimers();
  });

  afterEach(() => {
    mock.restore();
    vi.useRealTimers();
  });

  it('should trigger discovery scan', async () => {
    mock.onPost(`${baseUrl}/rest/discovery/bindings/hue/scan`).reply(200);
    const result = await client.triggerDiscoveryScan('hue');
    expect(result).toContain('triggered for binding: hue');
  });

  it('should get full semantic path for an item', async () => {
    const mockItems = [
      { name: 'Room1', label: 'Living Room', tags: ['Location'] },
      { name: 'Table', label: 'Dining Table', groupNames: ['Room1'], tags: ['Equipment'] },
      { name: 'Light1', label: 'Spotlight', groupNames: ['Table'], tags: ['Point'] },
    ];
    mock.onGet(`${baseUrl}/rest/items`).reply(200, mockItems);

    const path = await client.getSemanticPath('Light1');
    expect(path).toBe('Living Room > Dining Table > Spotlight');
  });

  it('should find neighboring equipment in the same room', async () => {
    const mockItems = [
      { name: 'Room1', label: 'Living Room', tags: ['Location'] },
      { name: 'Light1', label: 'Ceiling Light', groupNames: ['Room1'], tags: ['Light'] },
      { name: 'Speaker1', label: 'Sonos', groupNames: ['Room1'], tags: ['Speaker'] },
      { name: 'Hallway', label: 'Hall', tags: ['Location'] },
      { name: 'Light2', label: 'Hall Light', groupNames: ['Hallway'], tags: ['Light'] },
    ];
    mock.onGet(`${baseUrl}/rest/items`).reply(200, mockItems);

    const neighbors = await client.findNeighboringEquipment('Light1');
    expect(neighbors).toHaveLength(1);
    expect(neighbors[0].name).toBe('Speaker1');
  });

  it('should schedule a command execution', async () => {
    mock.onPost(`${baseUrl}/rest/items/Light1`).reply(200);
    
    const result = await client.scheduleCommand('Light1', 'OFF', 5000);
    expect(result).toContain('successfully scheduled');
    
    // Fast-forward time
    vi.advanceTimersByTime(5000);
    
    // Check that command was sent
    // Note: Since the command is sent in an async block within setTimeout, 
    // we need to wait for any pending promises.
    await vi.waitFor(() => {
        if (mock.history.post.length === 0) throw new Error('Not executed yet');
    });
    
    expect(mock.history.post[0].url).toBe(`/rest/items/Light1`);
    expect(mock.history.post[0].data).toBe('OFF');
  });

  it('should identify stale items based on event buffer', async () => {
    const mockItems = [
      { name: 'StaleSensor', type: 'Number', state: '10' },
      { name: 'ActiveSensor', type: 'Number', state: '20' },
    ];
    mock.onGet(`${baseUrl}/rest/items`).reply(200, mockItems);

    // Mocking internal state by accessing private property for test purposes
    // In a real scenario, this would be populated by the SSE handler.
    (client as any).eventLogBuffer = [
        `${new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()} - ItemStateChangedEvent - StaleSensor changed to 10`,
        `${new Date().toISOString()} - ItemStateChangedEvent - ActiveSensor changed to 20`
    ];

    const stale = await client.getStaleItems(7);
    expect(stale).toHaveLength(1);
    expect(stale[0].name).toBe('StaleSensor');
  });
});
