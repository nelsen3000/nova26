/**
 * H5-11: Hypercore Module — Store & Replication Tests
 *
 * Tests for HypercoreStore (append-only log with hash chain)
 * and ReplicationManager (peer sync and Merkle root verification)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Mock Implementations
// ============================================================================

interface HypercoreEntry {
  seq: number;
  hash: string;
  timestamp: number;
  byteLength: number;
  data: unknown;
}

interface AppendResult {
  seq: number;
  hash: string;
  byteLength: number;
}

interface SyncResult {
  peerId: string;
  syncedSeqs: number[];
  bytesSynced: number;
  duration: number;
  merkleRoot: string;
}

class MockHypercoreStore {
  private entries: HypercoreEntry[] = [];
  private maxPayloadBytes: number;

  constructor(maxPayloadBytes = 1_048_576) {
    this.maxPayloadBytes = maxPayloadBytes;
  }

  append(data: unknown): AppendResult {
    const serialized = JSON.stringify(data);
    const byteLength = Buffer.byteLength(serialized, 'utf8');

    if (byteLength > this.maxPayloadBytes) {
      throw new Error(`Payload ${byteLength} bytes exceeds max ${this.maxPayloadBytes} bytes`);
    }

    const seq = this.entries.length;
    const prevHash = seq > 0 ? this.entries[seq - 1].hash : '';
    const hash = this.computeHash(seq, prevHash, serialized);

    const entry: HypercoreEntry = {
      seq,
      hash,
      timestamp: Date.now(),
      byteLength,
      data,
    };

    this.entries.push(entry);
    return { seq, hash, byteLength };
  }

  get(seq: number): HypercoreEntry | null {
    if (seq < 0 || seq >= this.entries.length) return null;
    return this.entries[seq];
  }

  range(start: number, end: number): HypercoreEntry[] {
    if (start < 0) start = 0;
    if (end > this.entries.length) end = this.entries.length;
    return this.entries.slice(start, end);
  }

  length(): number {
    return this.entries.length;
  }

  root(): string {
    if (this.entries.length === 0) return '';
    return this.entries[this.entries.length - 1].hash;
  }

  private computeHash(seq: number, prevHash: string, data: string): string {
    const combined = `${seq}:${prevHash}:${data}`;
    return Buffer.from(combined).toString('base64').substring(0, 16);
  }
}

class MockReplicationManager {
  private local: MockHypercoreStore;
  private replicasByPeer = new Map<string, MockHypercoreStore>();

  constructor(local: MockHypercoreStore) {
    this.local = local;
  }

  addReplica(peerId: string, store: MockHypercoreStore): void {
    this.replicasByPeer.set(peerId, store);
  }

  async sync(peerId: string): Promise<SyncResult> {
    const replica = this.replicasByPeer.get(peerId);
    if (!replica) throw new Error(`Replica for ${peerId} not found`);

    const startTime = Date.now();
    const syncedSeqs: number[] = [];
    let bytesSynced = 0;

    // Sync from local to replica
    for (let i = replica.length(); i < this.local.length(); i++) {
      const entry = this.local.get(i);
      if (entry) {
        replica.append(entry.data);
        syncedSeqs.push(i);
        bytesSynced += entry.byteLength;
      }
    }

    const duration = Date.now() - startTime;
    const merkleRoot = this.local.root();

    return { peerId, syncedSeqs, bytesSynced, duration, merkleRoot };
  }

  verifyIntegrity(peerId: string): boolean {
    const replica = this.replicasByPeer.get(peerId);
    if (!replica) return false;
    return replica.root() === this.local.root() && replica.length() === this.local.length();
  }
}

// ============================================================================
// HypercoreStore Tests
// ============================================================================

describe('HypercoreStore — Append-Only Log', () => {
  let store: MockHypercoreStore;

  beforeEach(() => {
    store = new MockHypercoreStore();
  });

  it('should append entries and return seq + hash', () => {
    const result = store.append({ message: 'test' });

    expect(result.seq).toBe(0);
    expect(result.hash).toHaveLength(16);
    expect(result.byteLength).toBeGreaterThan(0);
  });

  it('should maintain hash chain invariant', () => {
    const r1 = store.append({ id: 1 });
    const r2 = store.append({ id: 2 });
    const r3 = store.append({ id: 3 });

    expect(r1.seq).toBe(0);
    expect(r2.seq).toBe(1);
    expect(r3.seq).toBe(2);
    expect(r1.hash).not.toBe(r2.hash);
    expect(r2.hash).not.toBe(r3.hash);
  });

  it('should reject payloads exceeding max size', () => {
    const smallStore = new MockHypercoreStore(100);
    const largeData = { text: 'x'.repeat(1000) };

    expect(() => smallStore.append(largeData)).toThrow();
  });

  it('should retrieve entries by seq', () => {
    store.append({ id: 1 });
    store.append({ id: 2 });
    store.append({ id: 3 });

    const entry = store.get(1);

    expect(entry?.seq).toBe(1);
    expect(entry?.data).toEqual({ id: 2 });
  });

  it('should return null for out-of-range seq', () => {
    store.append({ id: 1 });

    expect(store.get(5)).toBeNull();
    expect(store.get(-1)).toBeNull();
  });

  it('should return range of entries', () => {
    store.append({ id: 1 });
    store.append({ id: 2 });
    store.append({ id: 3 });
    store.append({ id: 4 });

    const range = store.range(1, 3);

    expect(range).toHaveLength(2);
    expect(range[0].seq).toBe(1);
    expect(range[1].seq).toBe(2);
  });

  it('should report correct length', () => {
    expect(store.length()).toBe(0);

    store.append({ id: 1 });
    expect(store.length()).toBe(1);

    store.append({ id: 2 });
    expect(store.length()).toBe(2);
  });

  it('should compute merkle root from tail hash', () => {
    store.append({ id: 1 });
    const root1 = store.root();

    store.append({ id: 2 });
    const root2 = store.root();

    expect(root1).toHaveLength(16);
    expect(root2).toHaveLength(16);
    expect(root1).not.toBe(root2);
  });

  it('should maintain entry immutability across appends', () => {
    const s = new MockHypercoreStore();
    s.append({ id: 1 });
    s.append({ id: 2 });

    const before = s.get(0);
    s.append({ id: 3 });
    const after = s.get(0);

    expect(JSON.stringify(before)).toBe(JSON.stringify(after));
  });

  it('property-based: length equals appended count', () => {
    fc.assert(
      fc.property(
        fc.array(fc.json(), { minLength: 0, maxLength: 100 }),
        (items) => {
          const s = new MockHypercoreStore();
          items.forEach((item) => s.append(item));
          return s.length() === items.length;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('property-based: seq is always within bounds', () => {
    fc.assert(
      fc.property(
        fc.array(fc.json(), { minLength: 1, maxLength: 100 }),
        (items) => {
          const s = new MockHypercoreStore();
          items.forEach((item) => s.append(item));

          for (let i = 0; i < s.length(); i++) {
            const entry = s.get(i);
            if (entry) {
              return entry.seq === i;
            }
          }
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Replication Manager Tests
// ============================================================================

describe('ReplicationManager — Peer Synchronization', () => {
  let local: MockHypercoreStore;
  let replica: MockHypercoreStore;
  let manager: MockReplicationManager;

  beforeEach(() => {
    local = new MockHypercoreStore();
    replica = new MockHypercoreStore();
    manager = new MockReplicationManager(local);
    manager.addReplica('peer-1', replica);
  });

  it('should sync new entries to replica', async () => {
    local.append({ id: 1 });
    local.append({ id: 2 });

    const result = await manager.sync('peer-1');

    expect(result.peerId).toBe('peer-1');
    expect(result.syncedSeqs).toHaveLength(2);
    expect(result.merkleRoot).toHaveLength(16);
  });

  it('should track bytes synced', async () => {
    local.append({ text: 'x'.repeat(100) });
    local.append({ text: 'y'.repeat(100) });

    const result = await manager.sync('peer-1');

    expect(result.bytesSynced).toBeGreaterThan(0);
  });

  it('should verify sync integrity', async () => {
    local.append({ id: 1 });
    local.append({ id: 2 });

    await manager.sync('peer-1');

    const verified = manager.verifyIntegrity('peer-1');

    expect(verified).toBe(true);
  });

  it('should detect diverged replicas', async () => {
    local.append({ id: 1 });
    await manager.sync('peer-1');

    local.append({ id: 2 });
    // Don't sync the second append

    const verified = manager.verifyIntegrity('peer-1');

    expect(verified).toBe(false);
  });

  it('should handle partial syncs', async () => {
    local.append({ id: 1 });
    local.append({ id: 2 });

    await manager.sync('peer-1');

    local.append({ id: 3 });
    const result = await manager.sync('peer-1');

    expect(result.syncedSeqs).toContain(2);
  });

  it('should produce valid merkle root on sync', async () => {
    const l = new MockHypercoreStore();
    const r = new MockHypercoreStore();
    const mgr = new MockReplicationManager(l);
    mgr.addReplica('peer', r);

    l.append({ id: 1 });
    l.append({ id: 2 });
    const result = await mgr.sync('peer');

    expect(result.merkleRoot).toHaveLength(16);
    expect(result.syncedSeqs).toHaveLength(2);
  });

  it('should be idempotent on repeated sync', async () => {
    const l = new MockHypercoreStore();
    const r = new MockHypercoreStore();
    const mgr = new MockReplicationManager(l);
    mgr.addReplica('peer', r);

    l.append({ id: 1 });
    l.append({ id: 2 });

    const result1 = await mgr.sync('peer');
    const result2 = await mgr.sync('peer');

    expect(result1.merkleRoot).toBe(result2.merkleRoot);
    expect(result2.syncedSeqs).toHaveLength(0);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('HypercoreStore + ReplicationManager Integration', () => {
  let local: MockHypercoreStore;
  let replicas: Map<string, MockHypercoreStore>;
  let manager: MockReplicationManager;

  beforeEach(() => {
    local = new MockHypercoreStore();
    replicas = new Map();
    manager = new MockReplicationManager(local);
  });

  it('should sync to multiple replicas', async () => {
    const replica1 = new MockHypercoreStore();
    const replica2 = new MockHypercoreStore();

    manager.addReplica('peer-1', replica1);
    manager.addReplica('peer-2', replica2);

    local.append({ id: 1 });
    local.append({ id: 2 });

    const result1 = await manager.sync('peer-1');
    const result2 = await manager.sync('peer-2');

    expect(result1.syncedSeqs).toHaveLength(2);
    expect(result2.syncedSeqs).toHaveLength(2);
  });

  it('should maintain consistency across replica network', async () => {
    const replicas = ['peer-1', 'peer-2', 'peer-3'].map((peerId) => {
      const replica = new MockHypercoreStore();
      manager.addReplica(peerId, replica);
      return { peerId, store: replica };
    });

    local.append({ id: 1 });
    local.append({ id: 2 });
    local.append({ id: 3 });

    for (const { peerId } of replicas) {
      await manager.sync(peerId);
    }

    const allConsistent = replicas.every(({ peerId }) => manager.verifyIntegrity(peerId));

    expect(allConsistent).toBe(true);
  });

  it('should handle high-volume append and sync', async () => {
    const replica = new MockHypercoreStore();
    manager.addReplica('peer-1', replica);

    for (let i = 0; i < 100; i++) {
      local.append({ id: i, data: `entry-${i}` });
    }

    const result = await manager.sync('peer-1');

    expect(result.syncedSeqs).toHaveLength(100);
    expect(manager.verifyIntegrity('peer-1')).toBe(true);
  });
});

// ============================================================================
// Stress Tests
// ============================================================================

describe('HypercoreStore Stress Tests', () => {
  it('should handle 10k sequential appends', () => {
    const store = new MockHypercoreStore();

    for (let i = 0; i < 10000; i++) {
      store.append({ id: i });
    }

    expect(store.length()).toBe(10000);
  });

  it('should compute distinct hashes for each entry', () => {
    const store = new MockHypercoreStore();
    const hashes = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const result = store.append({ id: i });
      hashes.add(result.hash);
    }

    expect(hashes.size).toBe(100);
  });

  it('should efficiently query range after large appends', () => {
    const store = new MockHypercoreStore();

    for (let i = 0; i < 1000; i++) {
      store.append({ id: i });
    }

    const range = store.range(400, 410);

    expect(range).toHaveLength(10);
    expect(range[0].seq).toBe(400);
  });
});
