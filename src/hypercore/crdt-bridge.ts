// CRDT Bridge — Bridges HypercoreStore with CRDT collaboration engine
// Sprint S2-07 (Spec Task 6) | P2P Hypercore Protocol (Reel 1)

import { HypercoreStore } from './store.js';
import { CRDTUpdateEntrySchema } from './types.js';
import type { CRDTUpdateEntry } from './types.js';

export type CRDTUpdateHandler = (entry: CRDTUpdateEntry) => void;

export interface BroadcastResult {
  seq: number;
  operationId: string;
  byteLength: number;
}

/**
 * CRDTBridge — Appends CRDT operations to a Hypercore log and broadcasts them to subscribers.
 * Simulates the CRDTBridge from the design doc without requiring actual Hypercore binaries.
 */
export class CRDTBridge {
  private store: HypercoreStore;
  private handlers: CRDTUpdateHandler[] = [];
  private pollingFromSeq: number;

  constructor(store: HypercoreStore) {
    this.store = store;
    this.pollingFromSeq = store.length();
  }

  /**
   * Broadcast a CRDT update by appending it to the log.
   * Notifies all registered handlers immediately.
   */
  broadcast(update: CRDTUpdateEntry): BroadcastResult {
    const validated = CRDTUpdateEntrySchema.parse(update);
    const result = this.store.append(validated);
    this.notifyHandlers(validated);
    return { seq: result.seq, operationId: validated.operationId, byteLength: result.byteLength };
  }

  /**
   * Subscribe to incoming CRDT updates.
   * Returns an unsubscribe function.
   */
  onUpdate(handler: CRDTUpdateHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  /**
   * Poll the store for new entries since the last poll (simulates event subscription).
   * Useful when entries arrive via replication rather than local broadcast.
   */
  poll(): number {
    let processed = 0;
    const currentLength = this.store.length();

    for (let seq = this.pollingFromSeq; seq < currentLength; seq++) {
      const entry = this.store.get(seq);
      const parsed = CRDTUpdateEntrySchema.safeParse(entry.data);
      if (parsed.success) {
        this.notifyHandlers(parsed.data);
        processed++;
      }
      // Skip malformed entries (DESERIALIZATION_FAILED — log and continue)
    }

    this.pollingFromSeq = currentLength;
    return processed;
  }

  /**
   * Get the number of CRDT entries in the log.
   */
  length(): number {
    return this.store.length();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private notifyHandlers(entry: CRDTUpdateEntry): void {
    for (const handler of this.handlers) {
      handler(entry);
    }
  }
}
