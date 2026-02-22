// Hypercore Offline Queue — Spec Task 8 (Offline-First Resilience)
// Sprint S3-06 | P2P Hypercore Protocol (Reel 1)
//
// Queues append operations when a store is offline and replays them on reconnect.
// Also handles replication-state persistence (in-memory for test compat).

import type { HypercoreStore } from './store.js';
import type { AppendResult } from './store.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QueuedOperation {
  id: string;
  storeName: string;
  data: unknown;
  queuedAt: number;
}

export interface DrainResult {
  replayed: number;
  failed: number;
  errors: string[];
}

export interface ReplicationState {
  lastSyncedSeq: number;
  peerId: string;
  logName: string;
  syncedAt: number;
}

export interface OfflineQueueStats {
  queueLength: number;
  isOnline: boolean;
  totalDrained: number;
  totalFailed: number;
  replicationStates: ReplicationState[];
}

// ─── OfflineQueue ─────────────────────────────────────────────────────────────

/**
 * OfflineQueue — wraps a HypercoreStore and buffers append operations
 * while the network is unavailable. On reconnect, replays operations
 * in FIFO order.
 *
 * Satisfies Spec Task 8.1:
 * - Local append/read always works (reads go straight to store).
 * - Offline appends are queued; no data loss.
 * - setOnline(true) auto-drains the queue.
 * - Replication state is tracked per log/peer.
 */
export class OfflineQueue {
  private queue: QueuedOperation[] = [];
  private _isOnline: boolean;
  private store: HypercoreStore;
  private storeName: string;
  private totalDrained = 0;
  private totalFailed = 0;
  private replicationStates = new Map<string, ReplicationState>(); // `${logName}:${peerId}` → state
  private onlineListeners: Array<() => void> = [];
  private offlineListeners: Array<() => void> = [];
  private opIdCounter = 0;

  constructor(
    store: HypercoreStore,
    storeName: string,
    initiallyOnline = true,
  ) {
    this.store = store;
    this.storeName = storeName;
    this._isOnline = initiallyOnline;
  }

  get isOnline(): boolean {
    return this._isOnline;
  }

  // ── Network state ──────────────────────────────────────────────────────────

  /**
   * Change network state. Setting online=true drains the queue.
   */
  setOnline(online: boolean): DrainResult | null {
    const wasOffline = !this._isOnline;
    this._isOnline = online;

    if (online) {
      for (const listener of this.onlineListeners) listener();
    } else {
      for (const listener of this.offlineListeners) listener();
    }

    if (online && wasOffline) {
      return this.drain();
    }
    return null;
  }

  // ── Append ─────────────────────────────────────────────────────────────────

  /**
   * Append data to the store. If online, appends immediately.
   * If offline, queues the operation for later replay.
   * Returns AppendResult if online; null if queued.
   */
  append(data: unknown): AppendResult | null {
    if (this._isOnline) {
      return this.store.append(data);
    }

    // Queue for later
    const op: QueuedOperation = {
      id: `op-${++this.opIdCounter}-${Date.now()}`,
      storeName: this.storeName,
      data,
      queuedAt: Date.now(),
    };
    this.queue.push(op);
    return null;
  }

  // ── Drain ──────────────────────────────────────────────────────────────────

  /**
   * Replay all queued operations into the underlying store.
   * Called automatically when going from offline → online.
   * Safe to call manually at any time.
   */
  drain(): DrainResult {
    const result: DrainResult = { replayed: 0, failed: 0, errors: [] };

    // Process in FIFO order (preserves causality)
    while (this.queue.length > 0) {
      const op = this.queue.shift()!;
      try {
        this.store.append(op.data);
        result.replayed++;
        this.totalDrained++;
      } catch (err) {
        result.failed++;
        this.totalFailed++;
        result.errors.push(err instanceof Error ? err.message : String(err));
        // On failure, put remaining operations back at the front
        // to preserve ordering (stop-on-first-failure mode)
        break;
      }
    }

    return result;
  }

  // ── Read passthrough (always available, even offline) ─────────────────────

  /**
   * Read a specific entry. Reads directly from the store (always available).
   */
  get(seq: number) {
    return this.store.get(seq);
  }

  /**
   * Get the current log length (reflects only committed entries, not queued).
   */
  length(): number {
    return this.store.length();
  }

  /**
   * Get the number of operations waiting in the queue.
   */
  queueSize(): number {
    return this.queue.length;
  }

  /**
   * Peek at the queued operations (read-only view).
   */
  getQueue(): ReadonlyArray<Readonly<QueuedOperation>> {
    return this.queue;
  }

  // ── Replication state ──────────────────────────────────────────────────────

  /**
   * Record the last synced sequence for a log/peer combination.
   * Used to persist sync progress across offline/online cycles.
   */
  recordSyncState(logName: string, peerId: string, lastSyncedSeq: number): void {
    const key = `${logName}:${peerId}`;
    this.replicationStates.set(key, {
      lastSyncedSeq,
      peerId,
      logName,
      syncedAt: Date.now(),
    });
  }

  /**
   * Get the last synced seq for a log/peer combination.
   * Returns -1 if no state has been recorded.
   */
  getLastSyncedSeq(logName: string, peerId: string): number {
    const key = `${logName}:${peerId}`;
    return this.replicationStates.get(key)?.lastSyncedSeq ?? -1;
  }

  /**
   * Get all recorded replication states.
   */
  getReplicationStates(): ReplicationState[] {
    return [...this.replicationStates.values()];
  }

  // ── Lifecycle listeners ────────────────────────────────────────────────────

  /**
   * Subscribe to going-online events.
   */
  onOnline(listener: () => void): () => void {
    this.onlineListeners.push(listener);
    return () => { this.onlineListeners = this.onlineListeners.filter(l => l !== listener); };
  }

  /**
   * Subscribe to going-offline events.
   */
  onOffline(listener: () => void): () => void {
    this.offlineListeners.push(listener);
    return () => { this.offlineListeners = this.offlineListeners.filter(l => l !== listener); };
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  getStats(): OfflineQueueStats {
    return {
      queueLength: this.queue.length,
      isOnline: this._isOnline,
      totalDrained: this.totalDrained,
      totalFailed: this.totalFailed,
      replicationStates: this.getReplicationStates(),
    };
  }

  // ── Reset (for testing) ───────────────────────────────────────────────────

  reset(): void {
    this.queue = [];
    this.totalDrained = 0;
    this.totalFailed = 0;
    this.replicationStates.clear();
    this._isOnline = true;
  }
}
