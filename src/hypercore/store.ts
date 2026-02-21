// Hypercore Append-Only Store — In-memory implementation with hash chain
// Sprint S2-02 | P2P Hypercore Protocol (Reel 1)

import { createHash } from 'crypto';
import type { HypercoreEntry, HypercoreMetadata, HypercoreStoreConfig } from './types.js';

export interface AppendResult {
  seq: number;
  hash: string;
  byteLength: number;
}

export interface RangeResult {
  entries: HypercoreEntry[];
  start: number;
  end: number;
}

export class HypercoreOutOfRangeError extends Error {
  readonly code = 'OUT_OF_RANGE';
  readonly seq: number;
  constructor(seq: number, length: number) {
    super(`Sequence ${seq} out of range (log length: ${length})`);
    this.seq = seq;
  }
}

export class HypercorePayloadTooLargeError extends Error {
  readonly code = 'PAYLOAD_TOO_LARGE';
  constructor(byteLength: number, maxBytes: number) {
    super(`Payload ${byteLength} bytes exceeds max ${maxBytes} bytes`);
  }
}

/**
 * Append-only log with cryptographic hash chain.
 * Immutable — no update or delete operations.
 * In-memory implementation suitable for testing and dev; wire to real Hypercore for production.
 */
export class HypercoreStore {
  private entries: HypercoreEntry[] = [];
  private name: string;
  private config: HypercoreStoreConfig;
  private publicKey: string;
  private createdAt: number;

  constructor(name: string, config: Partial<HypercoreStoreConfig> = {}) {
    this.name = name;
    this.config = {
      storagePath: config.storagePath ?? '.nova/hypercore',
      maxPayloadBytes: config.maxPayloadBytes ?? 1_048_576,
      replicationEnabled: config.replicationEnabled ?? false,
      healthWarningThreshold: config.healthWarningThreshold ?? 10,
      healthWarningWindowMs: config.healthWarningWindowMs ?? 60_000,
    };
    this.publicKey = this.generatePublicKey(name);
    this.createdAt = Date.now();
  }

  /**
   * Append data to the log. Returns the new sequence number + hash.
   * Immutable — once appended, entries cannot be changed.
   */
  append(data: unknown): AppendResult {
    const serialized = data === undefined ? 'null' : JSON.stringify(data) ?? 'null';
    const byteLength = Buffer.byteLength(serialized, 'utf8');

    if (byteLength > this.config.maxPayloadBytes) {
      throw new HypercorePayloadTooLargeError(byteLength, this.config.maxPayloadBytes);
    }

    const seq = this.entries.length;
    const prevHash = seq > 0 ? this.entries[seq - 1]!.hash : '';
    const hash = this.hashEntry(seq, prevHash, serialized);

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

  /**
   * Get a single entry by sequence number.
   * Throws HypercoreOutOfRangeError if seq >= length.
   */
  get(seq: number): HypercoreEntry {
    if (seq < 0 || seq >= this.entries.length) {
      throw new HypercoreOutOfRangeError(seq, this.entries.length);
    }
    return this.entries[seq]!;
  }

  /**
   * Get a range of entries [start, end).
   */
  getRange(start: number, end?: number): RangeResult {
    const resolvedEnd = end ?? this.entries.length;
    const clampedStart = Math.max(0, start);
    const clampedEnd = Math.min(resolvedEnd, this.entries.length);
    return {
      entries: this.entries.slice(clampedStart, clampedEnd),
      start: clampedStart,
      end: clampedEnd,
    };
  }

  /**
   * Returns the current length of the log (number of entries).
   */
  length(): number {
    return this.entries.length;
  }

  /**
   * Verify the hash chain integrity from a given starting seq.
   * Returns true if the chain is valid.
   */
  verifyChain(fromSeq = 0): boolean {
    let prevHash = fromSeq > 0 ? (this.entries[fromSeq - 1]?.hash ?? '') : '';

    for (let i = fromSeq; i < this.entries.length; i++) {
      const entry = this.entries[i]!;
      const serialized = entry.data === undefined ? 'null' : JSON.stringify(entry.data) ?? 'null';
      const expectedHash = this.hashEntry(i, prevHash, serialized);
      if (entry.hash !== expectedHash) return false;
      prevHash = entry.hash;
    }
    return true;
  }

  /**
   * Verify the signature (hash) of a single entry.
   */
  verifySignature(seq: number): boolean {
    const entry = this.get(seq);
    const prevHash = seq > 0 ? (this.entries[seq - 1]?.hash ?? '') : '';
    const serialized = entry.data === undefined ? 'null' : JSON.stringify(entry.data) ?? 'null';
    const expectedHash = this.hashEntry(seq, prevHash, serialized);
    return entry.hash === expectedHash;
  }

  /**
   * Returns an async generator over all entries (simulates ReadableStream).
   */
  async *createReadStream(start = 0, end?: number): AsyncGenerator<HypercoreEntry> {
    const resolvedEnd = end ?? this.entries.length;
    for (let i = start; i < resolvedEnd && i < this.entries.length; i++) {
      yield this.entries[i]!;
    }
  }

  /**
   * Metadata about this log.
   */
  getMetadata(): HypercoreMetadata {
    return {
      name: this.name,
      publicKey: this.publicKey,
      length: this.entries.length,
      byteLength: this.entries.reduce((sum, e) => sum + e.byteLength, 0),
      writable: true,
      createdAt: this.createdAt,
      updatedAt: this.entries.length > 0 ? (this.entries[this.entries.length - 1]?.timestamp ?? this.createdAt) : this.createdAt,
    };
  }

  /**
   * Export all entries for replication.
   */
  exportEntries(fromSeq = 0): HypercoreEntry[] {
    return this.entries.slice(fromSeq);
  }

  /**
   * Import entries from a peer (for replication). Only appends missing entries.
   */
  importEntries(entries: HypercoreEntry[]): number {
    let imported = 0;
    for (const entry of entries) {
      if (entry.seq === this.entries.length) {
        // Only append the next expected seq
        this.entries.push(entry);
        imported++;
      }
    }
    return imported;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private hashEntry(seq: number, prevHash: string, serialized: string): string {
    return createHash('sha256')
      .update(`${seq}:${prevHash}:${serialized}`)
      .digest('hex');
  }

  private generatePublicKey(name: string): string {
    return createHash('sha256').update(`hypercore-key:${name}:${Date.now()}`).digest('hex');
  }
}

/**
 * Corestore-like manager for multiple named HypercoreStore instances.
 */
export class Corestore {
  private stores = new Map<string, HypercoreStore>();
  private config: Partial<HypercoreStoreConfig>;

  constructor(config: Partial<HypercoreStoreConfig> = {}) {
    this.config = config;
  }

  /**
   * Get (or create) a named log.
   */
  get(name: string): HypercoreStore {
    if (!this.stores.has(name)) {
      this.stores.set(name, new HypercoreStore(name, this.config));
    }
    return this.stores.get(name)!;
  }

  /**
   * List all managed log names.
   */
  list(): string[] {
    return [...this.stores.keys()];
  }

  /**
   * Close all stores (no-op in in-memory impl).
   */
  close(): void {
    this.stores.clear();
  }
}
