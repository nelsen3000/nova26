// Offline Queue Tests — Spec Task 8.1
// Sprint S3-06 | P2P Hypercore Protocol (Reel 1)

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { HypercoreStore } from '../store.js';
import { OfflineQueue } from '../offline-queue.js';

function makeQueue(online = true): { store: HypercoreStore; queue: OfflineQueue } {
  const store = new HypercoreStore('test-offline');
  const queue = new OfflineQueue(store, 'test-offline', online);
  return { store, queue };
}

// ─── Online mode ──────────────────────────────────────────────────────────────

describe('Online mode', () => {
  it('append() writes directly to store when online', () => {
    const { store, queue } = makeQueue(true);
    const result = queue.append({ msg: 'hello' });
    expect(result).not.toBeNull();
    expect(result!.seq).toBe(0);
    expect(store.length()).toBe(1);
    expect(queue.queueSize()).toBe(0);
  });

  it('get() reads directly from store', () => {
    const { queue } = makeQueue(true);
    queue.append({ msg: 'A' });
    const entry = queue.get(0);
    expect((entry.data as { msg: string }).msg).toBe('A');
  });

  it('length() reflects committed store length', () => {
    const { queue } = makeQueue(true);
    expect(queue.length()).toBe(0);
    queue.append('x');
    queue.append('y');
    expect(queue.length()).toBe(2);
  });
});

// ─── Offline mode ─────────────────────────────────────────────────────────────

describe('Offline mode', () => {
  it('append() queues when offline — store unchanged', () => {
    const { store, queue } = makeQueue(false);
    const result = queue.append({ msg: 'queued' });
    expect(result).toBeNull();
    expect(store.length()).toBe(0);
    expect(queue.queueSize()).toBe(1);
  });

  it('multiple appends accumulate in queue', () => {
    const { queue } = makeQueue(false);
    for (let i = 0; i < 5; i++) {
      queue.append({ i });
    }
    expect(queue.queueSize()).toBe(5);
  });

  it('get() still reads from store when offline', () => {
    const { store, queue } = makeQueue(true);
    // Pre-load store when online
    queue.append({ pre: 'data' });
    // Go offline
    queue.setOnline(false);
    // Read still works
    const entry = store.get(0);
    expect((entry.data as { pre: string }).pre).toBe('data');
  });

  it('isOnline is false when offline', () => {
    const { queue } = makeQueue(false);
    expect(queue.isOnline).toBe(false);
  });
});

// ─── Drain (reconnect) ────────────────────────────────────────────────────────

describe('drain() on reconnect', () => {
  it('setOnline(true) replays all queued operations in FIFO order', () => {
    const { store, queue } = makeQueue(false);
    queue.append({ i: 0 });
    queue.append({ i: 1 });
    queue.append({ i: 2 });

    const drainResult = queue.setOnline(true)!;
    expect(drainResult.replayed).toBe(3);
    expect(drainResult.failed).toBe(0);
    expect(store.length()).toBe(3);

    // FIFO order preserved
    expect((store.get(0).data as { i: number }).i).toBe(0);
    expect((store.get(1).data as { i: number }).i).toBe(1);
    expect((store.get(2).data as { i: number }).i).toBe(2);
  });

  it('queue is empty after drain', () => {
    const { queue } = makeQueue(false);
    queue.append('a');
    queue.append('b');
    queue.setOnline(true);
    expect(queue.queueSize()).toBe(0);
  });

  it('drain() is a no-op when queue is empty', () => {
    const { store, queue } = makeQueue(true);
    const result = queue.drain();
    expect(result.replayed).toBe(0);
    expect(store.length()).toBe(0);
  });

  it('setOnline(true) does not drain when already online', () => {
    const { queue } = makeQueue(true);
    queue.append('x');
    // Going from online → online: no auto-drain
    const result = queue.setOnline(true);
    expect(result).toBeNull();
  });

  it('online listener fires on setOnline(true)', () => {
    const { queue } = makeQueue(false);
    let fired = false;
    queue.onOnline(() => { fired = true; });
    queue.setOnline(true);
    expect(fired).toBe(true);
  });

  it('offline listener fires on setOnline(false)', () => {
    const { queue } = makeQueue(true);
    let fired = false;
    queue.onOffline(() => { fired = true; });
    queue.setOnline(false);
    expect(fired).toBe(true);
  });
});

// ─── Replication state persistence ───────────────────────────────────────────

describe('Replication state', () => {
  it('recordSyncState() stores last synced seq per log/peer', () => {
    const { queue } = makeQueue();
    queue.recordSyncState('log-a', 'peer-1', 42);
    expect(queue.getLastSyncedSeq('log-a', 'peer-1')).toBe(42);
  });

  it('getLastSyncedSeq() returns -1 for unknown log/peer', () => {
    const { queue } = makeQueue();
    expect(queue.getLastSyncedSeq('unknown', 'peer-x')).toBe(-1);
  });

  it('recordSyncState() updates existing state', () => {
    const { queue } = makeQueue();
    queue.recordSyncState('log-a', 'peer-1', 10);
    queue.recordSyncState('log-a', 'peer-1', 99);
    expect(queue.getLastSyncedSeq('log-a', 'peer-1')).toBe(99);
  });

  it('different peers maintain independent state', () => {
    const { queue } = makeQueue();
    queue.recordSyncState('log-a', 'peer-1', 10);
    queue.recordSyncState('log-a', 'peer-2', 20);
    expect(queue.getLastSyncedSeq('log-a', 'peer-1')).toBe(10);
    expect(queue.getLastSyncedSeq('log-a', 'peer-2')).toBe(20);
  });

  it('getReplicationStates() returns all recorded states', () => {
    const { queue } = makeQueue();
    queue.recordSyncState('log-a', 'peer-1', 5);
    queue.recordSyncState('log-b', 'peer-2', 10);
    const states = queue.getReplicationStates();
    expect(states).toHaveLength(2);
  });
});

// ─── Stats ────────────────────────────────────────────────────────────────────

describe('getStats()', () => {
  it('reflects queue length, online status, and totals', () => {
    const { queue } = makeQueue(false);
    queue.append('a');
    queue.append('b');
    const stats = queue.getStats();
    expect(stats.queueLength).toBe(2);
    expect(stats.isOnline).toBe(false);
    expect(stats.totalDrained).toBe(0);
  });

  it('totalDrained increments after drain', () => {
    const { queue } = makeQueue(false);
    queue.append('x');
    queue.append('y');
    queue.setOnline(true);
    expect(queue.getStats().totalDrained).toBe(2);
  });
});

// ─── Property: queue ordering preserved across offline/online cycles ──────────

describe('Property: offline queue ordering preserved', () => {
  it('drain replays operations in original order', () => {
    fc.assert(fc.property(
      fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 50 }),
      (values) => {
        const store = new HypercoreStore('prop-store');
        const queue = new OfflineQueue(store, 'prop-store', false);

        for (const v of values) {
          queue.append({ v });
        }

        queue.setOnline(true);

        for (let i = 0; i < values.length; i++) {
          const entry = store.get(i);
          expect((entry.data as { v: number }).v).toBe(values[i]);
        }
      },
    ), { numRuns: 50 });
  });
});
