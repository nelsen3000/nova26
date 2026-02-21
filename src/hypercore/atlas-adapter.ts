// ATLAS Memory Adapter — Bridges HypercoreStore with ATLAS memory system
// Sprint S2-08 (Spec Task 5) | P2P Hypercore Protocol (Reel 1)

import { HypercoreStore } from './store.js';
import type { MemoryNodeEntry } from './types.js';
import { MemoryNodeEntrySchema } from './types.js';

export interface MemoryIndex {
  byNodeId: Map<string, number>;       // nodeId → seq
  byAgent: Map<string, number[]>;      // agentId → seqs
  byTimeRange: Map<number, number>;    // timestamp-bucket → seq (bucketed to minute)
  tagIndex: Map<string, number[]>;     // tag → seqs
  totalNodes: number;
}

export interface TimeRangeQuery {
  from: number;
  to: number;
  agentId?: string;
  tags?: string[];
  limit?: number;
}

export interface AgentQuery {
  agentId: string;
  since?: number;
  limit?: number;
}

export interface IndexRebuildResult {
  totalEntries: number;
  validNodes: number;
  invalidEntries: number;
  rebuildMs: number;
}

/**
 * ATLASMemoryAdapter — Stores ATLAS memory nodes in a HypercoreStore.
 * Maintains an in-memory index for fast queries without re-scanning the log.
 */
export class ATLASMemoryAdapter {
  private store: HypercoreStore;
  private index: MemoryIndex;
  private maxPayloadBytes: number;

  constructor(store: HypercoreStore, maxPayloadBytes = 1_048_576) {
    this.store = store;
    this.maxPayloadBytes = maxPayloadBytes;
    this.index = {
      byNodeId: new Map(),
      byAgent: new Map(),
      byTimeRange: new Map(),
      tagIndex: new Map(),
      totalNodes: 0,
    };
  }

  /**
   * Store a memory node. Returns the seq in the log.
   */
  storeNode(node: MemoryNodeEntry): number {
    const serialized = JSON.stringify(node);
    if (Buffer.byteLength(serialized, 'utf8') > this.maxPayloadBytes) {
      throw Object.assign(new Error('Memory node exceeds max payload size'), { code: 'PAYLOAD_TOO_LARGE' });
    }

    const result = this.store.append(node);
    this.updateIndex(node, result.seq);
    return result.seq;
  }

  /**
   * Query nodes by time range with optional filters.
   */
  queryByTimeRange(query: TimeRangeQuery): MemoryNodeEntry[] {
    const results: MemoryNodeEntry[] = [];
    const limit = query.limit ?? 100;

    for (let seq = 0; seq < this.store.length() && results.length < limit; seq++) {
      const entry = this.store.get(seq);
      const node = entry.data as MemoryNodeEntry;

      if (!node || node.type !== 'memory-node') continue;
      if (node.timestamp < query.from || node.timestamp > query.to) continue;
      if (query.agentId && node.agentId !== query.agentId) continue;
      if (query.tags && !query.tags.every(t => node.tags.includes(t))) continue;

      results.push(node);
    }

    return results;
  }

  /**
   * Query nodes by agent ID.
   */
  queryByAgent(query: AgentQuery): MemoryNodeEntry[] {
    const seqs = this.index.byAgent.get(query.agentId) ?? [];
    const limit = query.limit ?? 100;
    const since = query.since ?? 0;

    return seqs
      .slice(-limit)
      .map(seq => this.store.get(seq).data as MemoryNodeEntry)
      .filter(node => node && node.timestamp >= since);
  }

  /**
   * Get a node by its ID (most recent write wins if duplicated).
   */
  getById(nodeId: string): MemoryNodeEntry | null {
    const seq = this.index.byNodeId.get(nodeId);
    if (seq === undefined) return null;
    return this.store.get(seq).data as MemoryNodeEntry;
  }

  /**
   * Rebuild the index by scanning the entire log.
   */
  rebuildIndex(): IndexRebuildResult {
    const start = Date.now();
    this.index = {
      byNodeId: new Map(),
      byAgent: new Map(),
      byTimeRange: new Map(),
      tagIndex: new Map(),
      totalNodes: 0,
    };

    let validNodes = 0;
    let invalidEntries = 0;

    for (let seq = 0; seq < this.store.length(); seq++) {
      const entry = this.store.get(seq);
      const parsed = MemoryNodeEntrySchema.safeParse(entry.data);
      if (parsed.success) {
        this.updateIndex(parsed.data, seq);
        validNodes++;
      } else {
        invalidEntries++;
      }
    }

    return {
      totalEntries: this.store.length(),
      validNodes,
      invalidEntries,
      rebuildMs: Date.now() - start,
    };
  }

  /**
   * Get the current index snapshot.
   */
  getIndex(): Readonly<MemoryIndex> {
    return this.index;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private updateIndex(node: MemoryNodeEntry, seq: number): void {
    // Update nodeId index (latest wins)
    this.index.byNodeId.set(node.nodeId, seq);

    // Update agent index
    const agentSeqs = this.index.byAgent.get(node.agentId) ?? [];
    agentSeqs.push(seq);
    this.index.byAgent.set(node.agentId, agentSeqs);

    // Update time bucket index (minute resolution)
    const bucket = Math.floor(node.timestamp / 60_000);
    this.index.byTimeRange.set(bucket, seq);

    // Update tag index
    for (const tag of node.tags) {
      const tagSeqs = this.index.tagIndex.get(tag) ?? [];
      tagSeqs.push(seq);
      this.index.tagIndex.set(tag, tagSeqs);
    }

    this.index.totalNodes++;
  }
}
