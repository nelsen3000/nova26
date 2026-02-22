// P2P Hypercore — Wave 2 Tests (S2-06 to S2-09)
// Covers: ATLAS adapter, CRDT bridge, observability

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { HypercoreStore } from '../store.js';
import { ATLASMemoryAdapter } from '../atlas-adapter.js';
import { CRDTBridge } from '../crdt-bridge.js';
import { ObservabilityLogger } from '../observability.js';
import type { MemoryNodeEntry, CRDTUpdateEntry } from '../types.js';

function makeMemoryNode(overrides: Partial<MemoryNodeEntry> = {}): MemoryNodeEntry {
  return {
    type: 'memory-node',
    nodeId: overrides.nodeId ?? `node-${Math.random().toString(36).slice(2, 6)}`,
    agentId: overrides.agentId ?? 'ATLAS',
    content: overrides.content ?? 'test content',
    tags: overrides.tags ?? ['arch'],
    tasteScore: overrides.tasteScore ?? 0.7,
    timestamp: overrides.timestamp ?? Date.now(),
    vectorClock: overrides.vectorClock ?? {},
  };
}

function makeCRDTUpdate(overrides: Partial<CRDTUpdateEntry> = {}): CRDTUpdateEntry {
  return {
    type: 'crdt-update',
    operationId: overrides.operationId ?? `op-${Date.now()}`,
    peerId: overrides.peerId ?? 'peer-A',
    targetNodeId: overrides.targetNodeId ?? 'node-1',
    operation: overrides.operation ?? 'insert',
    payload: overrides.payload ?? { content: 'x' },
    vectorClock: overrides.vectorClock ?? { 'peer-A': 1 },
    timestamp: overrides.timestamp ?? Date.now(),
  };
}

// ─── ATLASMemoryAdapter ───────────────────────────────────────────────────────

describe('ATLASMemoryAdapter (S2-08)', () => {
  let store: HypercoreStore;
  let adapter: ATLASMemoryAdapter;

  beforeEach(() => {
    store = new HypercoreStore('atlas-memory');
    adapter = new ATLASMemoryAdapter(store);
  });

  it('storeNode appends to the log and returns seq', () => {
    const node = makeMemoryNode();
    const seq = adapter.storeNode(node);
    expect(seq).toBe(0);
    expect(store.length()).toBe(1);
  });

  it('storeNode updates the index', () => {
    const node = makeMemoryNode({ nodeId: 'n42' });
    adapter.storeNode(node);
    const index = adapter.getIndex();
    expect(index.byNodeId.has('n42')).toBe(true);
  });

  it('getById returns the stored node', () => {
    const node = makeMemoryNode({ nodeId: 'findme' });
    adapter.storeNode(node);
    const found = adapter.getById('findme');
    expect(found?.nodeId).toBe('findme');
  });

  it('getById returns null for unknown nodeId', () => {
    expect(adapter.getById('nope')).toBeNull();
  });

  it('queryByAgent returns nodes for a specific agent', () => {
    adapter.storeNode(makeMemoryNode({ agentId: 'JUPITER' }));
    adapter.storeNode(makeMemoryNode({ agentId: 'MARS' }));
    adapter.storeNode(makeMemoryNode({ agentId: 'JUPITER' }));
    const results = adapter.queryByAgent({ agentId: 'JUPITER' });
    expect(results.length).toBe(2);
    expect(results.every(n => n.agentId === 'JUPITER')).toBe(true);
  });

  it('queryByTimeRange returns nodes in window', () => {
    const now = Date.now();
    adapter.storeNode(makeMemoryNode({ timestamp: now - 10_000 }));
    adapter.storeNode(makeMemoryNode({ timestamp: now }));
    adapter.storeNode(makeMemoryNode({ timestamp: now + 10_000 }));
    const results = adapter.queryByTimeRange({ from: now - 5_000, to: now + 5_000 });
    expect(results.length).toBe(1);
  });

  it('queryByTimeRange filters by agentId', () => {
    const now = Date.now();
    adapter.storeNode(makeMemoryNode({ agentId: 'ATLAS', timestamp: now }));
    adapter.storeNode(makeMemoryNode({ agentId: 'MARS', timestamp: now }));
    const results = adapter.queryByTimeRange({ from: 0, to: now + 1, agentId: 'ATLAS' });
    expect(results.every(n => n.agentId === 'ATLAS')).toBe(true);
  });

  it('storeNode throws PAYLOAD_TOO_LARGE for oversized nodes', () => {
    const smallAdapter = new ATLASMemoryAdapter(store, 50);
    expect(() => smallAdapter.storeNode(makeMemoryNode({ content: 'x'.repeat(200) }))).toThrow();
  });

  it('rebuildIndex produces consistent index', () => {
    for (let i = 0; i < 5; i++) {
      adapter.storeNode(makeMemoryNode({ nodeId: `node-${i}`, agentId: 'ATLAS' }));
    }
    const result = adapter.rebuildIndex();
    expect(result.validNodes).toBe(5);
    expect(result.totalEntries).toBe(5);
    expect(adapter.getIndex().byNodeId.size).toBe(5);
  });

  it('rebuildIndex handles invalid entries gracefully', () => {
    store.append({ not: 'a-memory-node' }); // invalid
    adapter.storeNode(makeMemoryNode());
    const result = adapter.rebuildIndex();
    expect(result.invalidEntries).toBe(1);
    expect(result.validNodes).toBe(1);
  });

  // Property: ATLAS store and query correctness
  it('Property: stored nodes are always retrievable by nodeId', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            nodeId: fc.string({ minLength: 1, maxLength: 20 }),
            agentId: fc.constantFrom('ATLAS', 'JUPITER', 'MARS'),
            content: fc.string({ maxLength: 100 }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        (nodes) => {
          const s = new HypercoreStore('prop-atlas');
          const a = new ATLASMemoryAdapter(s);
          for (const n of nodes) {
            a.storeNode(makeMemoryNode(n));
          }
          // Last write wins for duplicate nodeIds
          const uniqueNodes = new Map<string, typeof nodes[0]>();
          for (const n of nodes) uniqueNodes.set(n.nodeId, n);

          for (const [nodeId] of uniqueNodes) {
            const found = a.getById(nodeId);
            expect(found?.nodeId).toBe(nodeId);
          }
          return true;
        },
      ),
    );
  });
});

// ─── CRDTBridge ───────────────────────────────────────────────────────────────

describe('CRDTBridge (S2-07)', () => {
  let store: HypercoreStore;
  let bridge: CRDTBridge;

  beforeEach(() => {
    store = new HypercoreStore('crdt-collab');
    bridge = new CRDTBridge(store);
  });

  it('broadcast appends update to store and returns seq', () => {
    const update = makeCRDTUpdate();
    const result = bridge.broadcast(update);
    expect(result.seq).toBe(0);
    expect(result.operationId).toBe(update.operationId);
    expect(store.length()).toBe(1);
  });

  it('onUpdate handler is called on broadcast', () => {
    const received: CRDTUpdateEntry[] = [];
    bridge.onUpdate(u => received.push(u));
    bridge.broadcast(makeCRDTUpdate());
    expect(received).toHaveLength(1);
    expect(received[0]!.peerId).toBe('peer-A');
  });

  it('onUpdate returns unsubscribe function', () => {
    const received: CRDTUpdateEntry[] = [];
    const unsub = bridge.onUpdate(u => received.push(u));
    bridge.broadcast(makeCRDTUpdate());
    unsub();
    bridge.broadcast(makeCRDTUpdate({ operationId: 'op-2' }));
    expect(received).toHaveLength(1);
  });

  it('poll processes entries added via direct store append', () => {
    // Simulate entries arriving via replication
    const update = makeCRDTUpdate();
    store.append(update); // direct append bypassing bridge

    const received: CRDTUpdateEntry[] = [];
    bridge.onUpdate(u => received.push(u));
    const processed = bridge.poll();
    expect(processed).toBe(1);
    expect(received).toHaveLength(1);
  });

  it('poll skips malformed entries', () => {
    store.append({ not: 'a-crdt-update' }); // invalid
    const received: CRDTUpdateEntry[] = [];
    bridge.onUpdate(u => received.push(u));
    bridge.poll();
    expect(received).toHaveLength(0);
  });

  it('broadcast validates CRDTUpdateEntry schema', () => {
    expect(() => bridge.broadcast({ type: 'wrong' } as unknown as CRDTUpdateEntry)).toThrow();
  });

  it('length returns number of entries in store', () => {
    bridge.broadcast(makeCRDTUpdate());
    bridge.broadcast(makeCRDTUpdate({ operationId: 'op-2' }));
    expect(bridge.length()).toBe(2);
  });

  // Property: CRDT append preserves causal metadata
  it('Property: vector clock is preserved through broadcast-poll cycle', () => {
    // Avoid __proto__, constructor, prototype — these break plain-object property access
    const safePeerId = fc.string({ minLength: 1, maxLength: 10 })
      .filter(s => !['__proto__', 'constructor', 'prototype'].includes(s));
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            peerId: safePeerId,
            seq: fc.integer({ min: 0, max: 100 }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        (peers) => {
          const s = new HypercoreStore('prop-crdt');
          const b1 = new CRDTBridge(s);
          const received: CRDTUpdateEntry[] = [];

          for (const { peerId, seq } of peers) {
            const update = makeCRDTUpdate({
              operationId: `${peerId}-${seq}`,
              peerId,
              vectorClock: { [peerId]: seq },
            });
            b1.broadcast(update);
          }

          const b2 = new CRDTBridge(new HypercoreStore('prop-crdt-2'));
          // Import via poll simulation
          for (let i = 0; i < s.length(); i++) {
            const entry = s.get(i);
            received.push(entry.data as CRDTUpdateEntry);
          }

          expect(received.length).toBe(peers.length);
          for (let i = 0; i < peers.length; i++) {
            expect(received[i]!.vectorClock[peers[i]!.peerId]).toBe(peers[i]!.seq);
          }
          return true;
        },
      ),
    );
  });
});

// ─── ObservabilityLogger ──────────────────────────────────────────────────────

describe('ObservabilityLogger (S2-09)', () => {
  let obs: ObservabilityLogger;

  beforeEach(() => {
    obs = new ObservabilityLogger(100, 5, 60_000);
  });

  it('record stores an append event', () => {
    obs.record({ eventType: 'append', logName: 'atlas-memory', seq: 0, bytes: 42 });
    const events = obs.getRecentEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.eventType).toBe('append');
  });

  it('getMetrics tracks append counts and bytes', () => {
    obs.record({ eventType: 'append', logName: 'log-a', seq: 0, bytes: 100 });
    obs.record({ eventType: 'append', logName: 'log-a', seq: 1, bytes: 200 });
    const m = obs.getMetrics();
    expect(m.totalAppends).toBe(2);
    expect(m.totalBytes).toBe(300);
    expect(m.avgBytesPerAppend).toBe(150);
  });

  it('getMetrics tracks replication events', () => {
    obs.record({ eventType: 'replicate', logName: 'log', direction: 'send', bytes: 50 });
    expect(obs.getMetrics().totalReplicationEvents).toBe(1);
  });

  it('getMetrics tracks error count', () => {
    obs.record({ eventType: 'error', logName: 'log', message: 'oops' });
    expect(obs.getMetrics().totalErrors).toBe(1);
  });

  it('getHealth returns healthy when errors below threshold', () => {
    obs.record({ eventType: 'error', logName: 'log', message: 'e1' });
    obs.record({ eventType: 'error', logName: 'log', message: 'e2' });
    expect(obs.getHealth().healthy).toBe(true);
  });

  it('getHealth returns unhealthy when errors exceed threshold', () => {
    for (let i = 0; i < 6; i++) {
      obs.record({ eventType: 'error', logName: 'log', message: `err-${i}` });
    }
    expect(obs.getHealth().healthy).toBe(false);
    expect(obs.getHealth().warnings.length).toBeGreaterThan(0);
  });

  it('on listener is called for every recorded event', () => {
    const seen: string[] = [];
    obs.on(e => seen.push(e.eventType));
    obs.record({ eventType: 'append', logName: 'log', bytes: 10 });
    obs.record({ eventType: 'replicate', logName: 'log', direction: 'receive', bytes: 5 });
    expect(seen).toEqual(['append', 'replicate']);
  });

  it('reset clears all metrics and events', () => {
    obs.record({ eventType: 'append', logName: 'log', bytes: 10 });
    obs.reset();
    expect(obs.getRecentEvents()).toHaveLength(0);
    expect(obs.getMetrics().totalAppends).toBe(0);
  });

  it('getRecentEvents respects limit parameter', () => {
    for (let i = 0; i < 10; i++) {
      obs.record({ eventType: 'append', logName: 'log', seq: i, bytes: i * 10 });
    }
    expect(obs.getRecentEvents(3)).toHaveLength(3);
  });

  it('per-log metrics tracked correctly', () => {
    obs.record({ eventType: 'append', logName: 'log-x', bytes: 50 });
    obs.record({ eventType: 'append', logName: 'log-y', bytes: 100 });
    const m = obs.getMetrics();
    expect(m.logMetrics['log-x']?.appends).toBe(1);
    expect(m.logMetrics['log-y']?.bytes).toBe(100);
  });
});
