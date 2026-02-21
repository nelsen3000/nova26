// P2P Hypercore Protocol — Wave 1 Tests (S2-01 to S2-04)
// Covers: types/schemas, append-only store, replication, discovery

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  MemoryNodeEntrySchema,
  CRDTUpdateEntrySchema,
  HypercoreEntrySchema,
  ReplicationPeerSchema,
  DiscoveryConfigSchema,
  HypercoreStoreConfigSchema,
  StorageMetadataSchema,
  ManagerStatusSchema,
} from '../types.js';
import {
  HypercoreStore,
  Corestore,
  HypercoreOutOfRangeError,
  HypercorePayloadTooLargeError,
} from '../store.js';
import {
  ReplicationManager,
  computeMerkleRoot,
} from '../replication.js';
import {
  DiscoveryManager,
  resetGlobalDHT,
  getDHTTopicPeers,
} from '../discovery.js';

// ─── S2-01: Types & Schemas ───────────────────────────────────────────────────

describe('Hypercore Types & Schemas (S2-01)', () => {
  it('MemoryNodeEntrySchema validates a valid memory node', () => {
    const entry = {
      type: 'memory-node',
      nodeId: 'n1',
      agentId: 'ATLAS',
      content: 'hello',
      tags: ['arch'],
      tasteScore: 0.8,
      timestamp: Date.now(),
      vectorClock: {},
    };
    expect(() => MemoryNodeEntrySchema.parse(entry)).not.toThrow();
  });

  it('MemoryNodeEntrySchema rejects invalid type', () => {
    expect(() =>
      MemoryNodeEntrySchema.parse({ type: 'wrong', nodeId: 'n1', agentId: 'A', content: 'x', timestamp: 0 }),
    ).toThrow();
  });

  it('CRDTUpdateEntrySchema validates a valid CRDT update', () => {
    const entry = {
      type: 'crdt-update',
      operationId: 'op-1',
      peerId: 'peer-A',
      targetNodeId: 'n1',
      operation: 'insert',
      payload: { content: 'hello' },
      vectorClock: { 'peer-A': 1 },
      timestamp: Date.now(),
    };
    expect(() => CRDTUpdateEntrySchema.parse(entry)).not.toThrow();
  });

  it('HypercoreEntrySchema validates a log entry', () => {
    const entry = { seq: 0, hash: 'abc123', timestamp: Date.now(), byteLength: 42, data: { x: 1 } };
    expect(() => HypercoreEntrySchema.parse(entry)).not.toThrow();
  });

  it('ReplicationPeerSchema validates a peer', () => {
    const peer = {
      peerId: 'peer-1',
      address: '127.0.0.1:4001',
      connectedAt: Date.now(),
      bytesReceived: 0,
      bytesSent: 0,
      logsReplicated: [],
      isActive: true,
    };
    expect(() => ReplicationPeerSchema.parse(peer)).not.toThrow();
  });

  it('DiscoveryConfigSchema applies defaults', () => {
    const result = DiscoveryConfigSchema.parse({ topic: 'nova26' });
    expect(result.lookup).toBe(true);
    expect(result.announce).toBe(true);
    expect(result.bootstrap).toEqual([]);
  });

  it('HypercoreStoreConfigSchema applies defaults', () => {
    const result = HypercoreStoreConfigSchema.parse({});
    expect(result.storagePath).toBe('.nova/hypercore');
    expect(result.maxPayloadBytes).toBe(1_048_576);
  });

  it('StorageMetadataSchema validates', () => {
    const meta = { storagePath: '/x', logCount: 2, totalBytes: 1000, initializedAt: 0, replicationEnabled: false };
    expect(() => StorageMetadataSchema.parse(meta)).not.toThrow();
  });

  it('ManagerStatusSchema validates', () => {
    const status = { ready: true, logCount: 3, replicationEnabled: false, peerCount: 0, errorCount: 0, uptimeMs: 1000 };
    expect(() => ManagerStatusSchema.parse(status)).not.toThrow();
  });

  // Property: schema serialization round trip
  it('Property: MemoryNodeEntry serializes and round-trips', () => {
    fc.assert(
      fc.property(
        fc.record({
          type: fc.constant('memory-node' as const),
          nodeId: fc.string({ minLength: 1, maxLength: 50 }),
          agentId: fc.string({ minLength: 1, maxLength: 20 }),
          content: fc.string({ maxLength: 200 }),
          tags: fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }),
          tasteScore: fc.double({ min: 0, max: 1 }).filter(n => !Number.isNaN(n) && Number.isFinite(n)),
          timestamp: fc.integer({ min: 0 }),
          vectorClock: fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.integer({ min: 0, max: 1000 })),
        }),
        (entry) => {
          const parsed = MemoryNodeEntrySchema.parse(entry);
          const serialized = JSON.stringify(parsed);
          const deserialized = MemoryNodeEntrySchema.parse(JSON.parse(serialized));
          expect(deserialized.nodeId).toBe(entry.nodeId);
          expect(deserialized.agentId).toBe(entry.agentId);
          return true;
        },
      ),
    );
  });
});

// ─── S2-02: Append-Only Store ─────────────────────────────────────────────────

describe('HypercoreStore — Append-Only Log (S2-02)', () => {
  let store: HypercoreStore;

  beforeEach(() => {
    store = new HypercoreStore('test-log');
  });

  it('starts with length 0', () => {
    expect(store.length()).toBe(0);
  });

  it('append returns sequential sequence numbers', () => {
    const r1 = store.append({ value: 'a' });
    const r2 = store.append({ value: 'b' });
    const r3 = store.append({ value: 'c' });
    expect(r1.seq).toBe(0);
    expect(r2.seq).toBe(1);
    expect(r3.seq).toBe(2);
  });

  it('length increases after each append', () => {
    store.append('x');
    store.append('y');
    expect(store.length()).toBe(2);
  });

  it('get retrieves the correct entry', () => {
    store.append({ msg: 'hello' });
    const entry = store.get(0);
    expect((entry.data as { msg: string }).msg).toBe('hello');
    expect(entry.seq).toBe(0);
  });

  it('get throws OUT_OF_RANGE for invalid seq', () => {
    expect(() => store.get(0)).toThrow(HypercoreOutOfRangeError);
    store.append('x');
    expect(() => store.get(1)).toThrow(HypercoreOutOfRangeError);
    expect(() => store.get(-1)).toThrow(HypercoreOutOfRangeError);
  });

  it('entries are immutable after append — get always returns original data', () => {
    store.append({ value: 42 });
    const e1 = store.get(0);
    const e2 = store.get(0);
    expect(e1).toEqual(e2);
    expect(e1.data).toEqual({ value: 42 });
  });

  it('verifyChain returns true for valid chain', () => {
    store.append({ a: 1 });
    store.append({ a: 2 });
    store.append({ a: 3 });
    expect(store.verifyChain()).toBe(true);
  });

  it('verifySignature returns true for each entry', () => {
    store.append('data-0');
    store.append('data-1');
    expect(store.verifySignature(0)).toBe(true);
    expect(store.verifySignature(1)).toBe(true);
  });

  it('getRange returns correct slice', () => {
    for (let i = 0; i < 5; i++) store.append({ i });
    const range = store.getRange(1, 3);
    expect(range.entries).toHaveLength(2);
    expect((range.entries[0]!.data as { i: number }).i).toBe(1);
    expect((range.entries[1]!.data as { i: number }).i).toBe(2);
  });

  it('getRange without end returns everything from start', () => {
    for (let i = 0; i < 4; i++) store.append({ i });
    const range = store.getRange(2);
    expect(range.entries).toHaveLength(2);
  });

  it('createReadStream yields all entries in order', async () => {
    for (let i = 0; i < 3; i++) store.append({ i });
    const items: number[] = [];
    for await (const entry of store.createReadStream()) {
      items.push((entry.data as { i: number }).i);
    }
    expect(items).toEqual([0, 1, 2]);
  });

  it('throws PAYLOAD_TOO_LARGE for oversized entries', () => {
    const tinyStore = new HypercoreStore('tiny', { maxPayloadBytes: 10 });
    expect(() => tinyStore.append('this string is definitely too long for 10 bytes')).toThrow(
      HypercorePayloadTooLargeError,
    );
  });

  it('getMetadata returns correct counts', () => {
    store.append({ x: 1 });
    store.append({ x: 2 });
    const meta = store.getMetadata();
    expect(meta.name).toBe('test-log');
    expect(meta.length).toBe(2);
    expect(meta.byteLength).toBeGreaterThan(0);
    expect(meta.writable).toBe(true);
  });

  it('exportEntries returns all entries from a seq', () => {
    for (let i = 0; i < 5; i++) store.append({ i });
    const exported = store.exportEntries(2);
    expect(exported).toHaveLength(3);
    expect(exported[0]!.seq).toBe(2);
  });

  it('importEntries adds new entries without duplicates', () => {
    const storeA = new HypercoreStore('shared');
    const storeB = new HypercoreStore('shared');
    storeA.append({ v: 1 });
    storeA.append({ v: 2 });
    const imported = storeB.importEntries(storeA.exportEntries());
    expect(imported).toBe(2);
    expect(storeB.length()).toBe(2);
    // Import again — should not duplicate
    const reimported = storeB.importEntries(storeA.exportEntries());
    expect(reimported).toBe(0);
  });

  // Property: append-only invariant (monotonically increasing seq)
  it('Property: monotonically increasing sequence numbers', () => {
    fc.assert(
      fc.property(
        fc.array(fc.jsonValue(), { minLength: 1, maxLength: 50 }),
        (items) => {
          const s = new HypercoreStore('prop-test');
          let prevSeq = -1;
          for (const item of items) {
            const result = s.append(item);
            expect(result.seq).toBe(prevSeq + 1);
            prevSeq = result.seq;
          }
          expect(s.length()).toBe(items.length);
          return true;
        },
      ),
    );
  });

  // Property: append-read round trip
  it('Property: append-read round trip preserves data', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(fc.string(), fc.integer(), fc.record({ key: fc.string(), val: fc.integer() })),
          { minLength: 1, maxLength: 20 },
        ),
        (items) => {
          const s = new HypercoreStore('prop-rr');
          for (const item of items) {
            s.append(item);
          }
          for (let i = 0; i < items.length; i++) {
            const entry = s.get(i);
            expect(JSON.stringify(entry.data)).toBe(JSON.stringify(items[i]));
          }
          return true;
        },
      ),
    );
  });

  // Property: hash chain integrity
  it('Property: hash chain is always valid after any number of appends', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 1, maxLength: 30 }),
        (items) => {
          const s = new HypercoreStore('prop-chain');
          for (const item of items) s.append(item);
          expect(s.verifyChain()).toBe(true);
          return true;
        },
      ),
    );
  });
});

// ─── Corestore ────────────────────────────────────────────────────────────────

describe('Corestore', () => {
  it('get returns same store instance for same name', () => {
    const cs = new Corestore();
    const s1 = cs.get('log-a');
    const s2 = cs.get('log-a');
    expect(s1).toBe(s2);
  });

  it('get creates different stores for different names', () => {
    const cs = new Corestore();
    const s1 = cs.get('log-a');
    const s2 = cs.get('log-b');
    expect(s1).not.toBe(s2);
  });

  it('list returns all managed log names', () => {
    const cs = new Corestore();
    cs.get('log-a');
    cs.get('log-b');
    expect(cs.list()).toContain('log-a');
    expect(cs.list()).toContain('log-b');
  });

  it('close clears all stores', () => {
    const cs = new Corestore();
    cs.get('log-a');
    cs.close();
    expect(cs.list()).toHaveLength(0);
  });
});

// ─── S2-03: Replication Protocol ─────────────────────────────────────────────

describe('ReplicationManager (S2-03)', () => {
  let nodeA: ReplicationManager;
  let nodeB: ReplicationManager;

  beforeEach(() => {
    nodeA = new ReplicationManager();
    nodeB = new ReplicationManager();
  });

  it('addPeer returns an active peer record', () => {
    const peer = nodeA.addPeer('peer-B');
    expect(peer.peerId).toBe('peer-B');
    expect(peer.isActive).toBe(true);
  });

  it('removePeer makes peer inactive', () => {
    nodeA.addPeer('peer-B');
    nodeA.removePeer('peer-B');
    const status = nodeA.getReplicationState();
    expect(status.peerCount).toBe(0);
  });

  it('enable/disable toggles replication state', () => {
    nodeA.enable();
    expect(nodeA.getReplicationState().enabled).toBe(true);
    nodeA.disable();
    expect(nodeA.getReplicationState().enabled).toBe(false);
  });

  it('getReplicationState returns peer count', () => {
    nodeA.addPeer('p1');
    nodeA.addPeer('p2');
    expect(nodeA.getReplicationState().peerCount).toBe(2);
  });

  it('sync transfers entries from A to B (one-directional)', () => {
    const storeA = new HypercoreStore('shared');
    const storeB = new HypercoreStore('shared');
    nodeA.registerStore('shared', storeA);
    nodeB.registerStore('shared', storeB);

    storeA.append({ msg: 'hello' });
    storeA.append({ msg: 'world' });

    const results = nodeA.sync(nodeB);
    expect(results).toHaveLength(1);
    expect(results[0]!.entriesSent).toBe(2);
    expect(storeB.length()).toBe(2);
    expect(results[0]!.merkleValid).toBe(true);
  });

  it('sync is idempotent when already in sync', () => {
    const storeA = new HypercoreStore('shared');
    const storeB = new HypercoreStore('shared');
    nodeA.registerStore('shared', storeA);
    nodeB.registerStore('shared', storeB);

    storeA.append({ v: 1 });
    nodeA.sync(nodeB);

    // Sync again — already in sync
    const results = nodeA.sync(nodeB);
    expect(results[0]!.entriesReceived).toBe(0);
    expect(results[0]!.entriesSent).toBe(0);
  });

  it('sync is bidirectional — B entries propagate to A', () => {
    const storeA = new HypercoreStore('shared');
    const storeB = new HypercoreStore('shared');
    nodeA.registerStore('shared', storeA);
    nodeB.registerStore('shared', storeB);

    storeA.append({ v: 1 });
    nodeA.sync(nodeB); // A → B

    storeB.append({ v: 2 });
    nodeB.sync(nodeA); // B → A

    expect(storeA.length()).toBe(2);
    expect(storeB.length()).toBe(2);
  });

  it('computeMerkleRoot is deterministic', () => {
    const hashes = ['abc', 'def', 'ghi'];
    expect(computeMerkleRoot(hashes)).toBe(computeMerkleRoot(hashes));
  });

  it('computeMerkleRoot returns empty string for empty array', () => {
    expect(computeMerkleRoot([])).toBe('');
  });

  it('computeMerkleRoot differs for different inputs', () => {
    expect(computeMerkleRoot(['a', 'b'])).not.toBe(computeMerkleRoot(['b', 'a']));
  });

  // Property: replication convergence
  it('Property: after sync, both stores have same content', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ maxLength: 20 }), { minLength: 1, maxLength: 20 }),
        (items) => {
          const sA = new HypercoreStore('conv-test');
          const sB = new HypercoreStore('conv-test');
          const rA = new ReplicationManager();
          const rB = new ReplicationManager();
          rA.registerStore('conv-test', sA);
          rB.registerStore('conv-test', sB);

          for (const item of items) sA.append({ v: item });
          rA.sync(rB);

          expect(sB.length()).toBe(sA.length());
          for (let i = 0; i < sA.length(); i++) {
            expect(JSON.stringify(sA.get(i).data)).toBe(JSON.stringify(sB.get(i).data));
          }
          return true;
        },
      ),
    );
  });
});

// ─── S2-04: Hyperswarm Discovery ─────────────────────────────────────────────

describe('DiscoveryManager (S2-04)', () => {
  beforeEach(() => {
    resetGlobalDHT();
  });

  it('each DiscoveryManager gets a unique peer ID', () => {
    const d1 = new DiscoveryManager();
    const d2 = new DiscoveryManager();
    expect(d1.id).not.toBe(d2.id);
  });

  it('announce makes peer discoverable on a topic', () => {
    const d = new DiscoveryManager('peer-test');
    d.announce('nova26-test');
    const peers = getDHTTopicPeers('nova26-test');
    expect(peers.some(p => p.peerId === 'peer-test')).toBe(true);
  });

  it('lookup finds other announced peers', () => {
    const d1 = new DiscoveryManager('peer-A');
    const d2 = new DiscoveryManager('peer-B');
    d1.announce('topic-1');
    d2.announce('topic-1');
    const found = d1.lookup('topic-1');
    expect(found.some(p => p.peerId === 'peer-B')).toBe(true);
    // Should not include self
    expect(found.some(p => p.peerId === 'peer-A')).toBe(false);
  });

  it('lookup returns empty for unknown topic', () => {
    const d = new DiscoveryManager();
    expect(d.lookup('no-such-topic')).toEqual([]);
  });

  it('leave removes peer from topic', () => {
    const d = new DiscoveryManager('peer-leave');
    d.announce('topic-leave');
    d.leave('topic-leave');
    const peers = getDHTTopicPeers('topic-leave');
    expect(peers.some(p => p.peerId === 'peer-leave')).toBe(false);
  });

  it('getPeers returns all peers across joined topics', () => {
    const d1 = new DiscoveryManager('peer-X');
    const d2 = new DiscoveryManager('peer-Y');
    const d3 = new DiscoveryManager('peer-Z');
    d1.announce('shared-topic');
    d2.announce('shared-topic');
    d3.announce('shared-topic');
    const peers = d1.getPeers();
    const peerIds = peers.map(p => p.peerId);
    expect(peerIds).toContain('peer-Y');
    expect(peerIds).toContain('peer-Z');
  });

  it('on listener is called on lookup-complete event', () => {
    const events: string[] = [];
    const d1 = new DiscoveryManager('peer-listener');
    d1.on(evt => events.push(evt.type));
    d1.announce('listener-topic');
    d1.lookup('listener-topic');
    expect(events).toContain('lookup-complete');
  });

  it('destroy removes peer from all topics', () => {
    const d = new DiscoveryManager('peer-destroy');
    d.announce('topic-a');
    d.announce('topic-b');
    d.destroy();
    expect(getDHTTopicPeers('topic-a').some(p => p.peerId === 'peer-destroy')).toBe(false);
    expect(getDHTTopicPeers('topic-b').some(p => p.peerId === 'peer-destroy')).toBe(false);
  });

  it('getTopics returns all announced topics', () => {
    const d = new DiscoveryManager();
    d.announce('topic-1');
    d.announce('topic-2');
    const topics = d.getTopics().map(h => h.topic);
    expect(topics).toContain('topic-1');
    expect(topics).toContain('topic-2');
  });

  it('resetGlobalDHT clears all announcements', () => {
    const d = new DiscoveryManager('peer-R');
    d.announce('some-topic');
    resetGlobalDHT();
    expect(getDHTTopicPeers('some-topic')).toHaveLength(0);
  });
});
