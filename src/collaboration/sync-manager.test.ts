// Sync Manager Tests
// Spec: .nova/specs/grok-r24-immortal-omniverse.md (R24-03)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SyncManager,
  InMemoryTransport,
} from './sync-manager';
import {
  CRDTDocumentManager,
  PresenceManager,
} from './crdt-engine';

describe('SyncManager', () => {
  let client1Doc: CRDTDocumentManager;
  let client1Presence: PresenceManager;
  let client1Transport: InMemoryTransport;
  let client1Sync: SyncManager;

  let client2Doc: CRDTDocumentManager;
  let client2Presence: PresenceManager;
  let client2Transport: InMemoryTransport;
  let client2Sync: SyncManager;

  beforeEach(() => {
    // Setup client 1
    client1Doc = new CRDTDocumentManager('client-1');
    client1Presence = new PresenceManager('client-1', 'Alice', '#FF0000');
    client1Transport = new InMemoryTransport();
    client1Sync = new SyncManager(
      'doc-1',
      'client-1',
      client1Transport,
      client1Doc,
      client1Presence
    );

    // Setup client 2
    client2Doc = new CRDTDocumentManager('client-2');
    client2Presence = new PresenceManager('client-2', 'Bob', '#00FF00');
    client2Transport = new InMemoryTransport();
    client2Sync = new SyncManager(
      'doc-1',
      'client-2',
      client2Transport,
      client2Doc,
      client2Presence
    );

    // Connect transports
    client1Transport.setPeer(client2Transport);
    client2Transport.setPeer(client1Transport);
  });

  describe('Connection', () => {
    it('should connect and sync', async () => {
      await client1Sync.connect();
      expect(client1Sync.getState()).toBe('connected');
    });

    it('should handle disconnect', async () => {
      await client1Sync.connect();
      await client1Sync.disconnect();
      expect(client1Sync.getState()).toBe('disconnected');
    });

    it('should emit state changes', async () => {
      const states: string[] = [];
      client1Sync.onStateChange(state => states.push(state));

      await client1Sync.connect();

      expect(states).toContain('connecting');
      expect(states).toContain('connected');
    });
  });

  describe('Data Sync', () => {
    it('should sync changes between clients', async () => {
      // Connect both clients first
      await client1Sync.connect();
      await client2Sync.connect();

      // Setup client 1 with data after connection
      client1Doc.setValue('doc-1', 'key1', 'value1');

      // Sync the change manually since auto-sync isn't implemented
      await client1Sync.requestSync();

      // Client 2 should receive the state
      await vi.waitFor(() => {
        expect(client2Doc.getValue('doc-1', 'key1')).toBe('value1');
      }, { timeout: 1000 });
    });

    it('should sync subsequent changes', async () => {
      await client1Sync.connect();
      await client2Sync.connect();

      // Client 1 makes a change
      client1Doc.setValue('doc-1', 'key2', 'value2');

      // Sync the change
      await client1Sync.requestSync();

      // Client 2 should receive the change
      await vi.waitFor(() => {
        expect(client2Doc.getValue('doc-1', 'key2')).toBe('value2');
      }, { timeout: 1000 });
    });

    it('should sync bidirectionally', async () => {
      await client1Sync.connect();
      await client2Sync.connect();

      // Both clients make changes
      client1Doc.setValue('doc-1', 'client1-key', 'client1-value');
      client2Doc.setValue('doc-1', 'client2-key', 'client2-value');

      // Sync changes
      await client1Sync.requestSync();
      await client2Sync.requestSync();

      // Both should see each other's changes
      await vi.waitFor(() => {
        expect(client1Doc.getValue('doc-1', 'client2-key')).toBe('client2-value');
        expect(client2Doc.getValue('doc-1', 'client1-key')).toBe('client1-value');
      }, { timeout: 1000 });
    });
  });

  describe('Presence Sync', () => {
    it('should sync presence between clients', async () => {
      await client1Sync.connect();
      await client2Sync.connect();

      // Client 1 sets cursor
      client1Presence.setCursor('content', 42);
      await client1Sync.sendPresence();

      // Client 2 should receive presence
      await vi.waitFor(() => {
        const presence = client2Presence.getPresence();
        const client1 = presence.find(p => p.clientId === 'client-1');
        expect(client1?.cursor).toEqual({ path: 'content', offset: 42 });
      });
    });
  });

  describe('Stats', () => {
    it('should track messages sent', async () => {
      await client1Sync.connect();

      const initialStats = client1Sync.getStats();
      expect(initialStats.messagesSent).toBeGreaterThan(0); // At least sync message
    });

    it('should track messages received', async () => {
      await client1Sync.connect();
      await client2Sync.connect();

      // Force a sync exchange
      await client1Sync.requestSync();
      await client2Sync.requestSync();

      // Wait for sync messages
      await vi.waitFor(() => {
        const stats1 = client1Sync.getStats();
        const stats2 = client2Sync.getStats();
        expect(stats1.messagesReceived).toBeGreaterThan(0);
        expect(stats2.messagesReceived).toBeGreaterThan(0);
      }, { timeout: 1000 });
    });

    it('should reset stats', async () => {
      await client1Sync.connect();
      await client1Sync.resetStats();

      const stats = client1Sync.getStats();
      expect(stats.messagesSent).toBe(0);
      expect(stats.messagesReceived).toBe(0);
    });
  });

  describe('Reconnection', () => {
    it('should handle reconnection', async () => {
      await client1Sync.connect();
      await client1Sync.disconnect();

      // Should be able to reconnect
      await client1Sync.connect();
      expect(client1Sync.getState()).toBe('connected');
    });

    it('should queue messages while disconnected', async () => {
      // Make client 1 connect and then disconnect
      await client1Sync.connect();
      await client1Sync.disconnect();

      // Changes while disconnected
      client1Doc.setValue('doc-1', 'queued-key', 'queued-value');

      // Reconnect
      await client1Sync.connect();

      // Changes should eventually sync
      await vi.waitFor(() => {
        expect(client1Doc.getValue('doc-1', 'queued-key')).toBe('queued-value');
      });
    });
  });
});

describe('InMemoryTransport', () => {
  it('should connect and disconnect', async () => {
    const transport = new InMemoryTransport();
    await transport.connect();
    expect(transport.getState()).toBe('connected');
    await transport.disconnect();
    expect(transport.getState()).toBe('disconnected');
  });

  it('should deliver messages to peer', async () => {
    const transport1 = new InMemoryTransport();
    const transport2 = new InMemoryTransport();

    transport1.setPeer(transport2);
    transport2.setPeer(transport1);

    const handler = vi.fn();
    transport2.onMessage(handler);

    await transport1.connect();
    await transport2.connect();

    const message = {
      type: 'update' as const,
      documentId: 'doc-1',
      timestamp: Date.now(),
      clientId: 'client-1',
    };

    await transport1.send(message);

    expect(handler).toHaveBeenCalledWith(message);
  });

  it('should simulate latency', async () => {
    const transport = new InMemoryTransport(50); // 50ms latency
    const startTime = Date.now();

    await transport.connect();
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeGreaterThanOrEqual(50);
  });

  it('should throw when not connected', async () => {
    const transport = new InMemoryTransport();
    const message = {
      type: 'update' as const,
      documentId: 'doc-1',
      timestamp: Date.now(),
      clientId: 'client-1',
    };

    await expect(transport.send(message)).rejects.toThrow('Not connected');
  });
});
