// LRU Cache - GLM-03
// Generic typed Least Recently Used cache with TTL support, size limits,
// and hit/miss statistics.

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface LRUCacheOptions {
  /** Maximum number of entries. Default: 500. */
  maxSize?: number;
  /** Time-to-live in milliseconds. 0 = no expiry. Default: 0. */
  ttlMs?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
  hitRate: number;
}

// ─── Internal node ────────────────────────────────────────────────────────────

interface Node<V> {
  key: string;
  value: V;
  insertedAt: number;
  prev: Node<V> | null;
  next: Node<V> | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LRU Cache
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generic LRU cache backed by a doubly-linked list + Map.
 * - O(1) get / set / delete
 * - Optional per-entry TTL
 * - Hit/miss/eviction statistics
 */
export class LRUCache<V> {
  private readonly maxSize: number;
  private readonly ttlMs: number;

  // Doubly-linked list: head = most recently used, tail = least recently used
  private head: Node<V> | null = null;
  private tail: Node<V> | null = null;
  private readonly map: Map<string, Node<V>> = new Map();

  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(options: LRUCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 500;
    this.ttlMs = options.ttlMs ?? 0;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Retrieve a value by key.
   * Returns undefined on miss or expired entry (which is evicted immediately).
   */
  get(key: string): V | undefined {
    const node = this.map.get(key);
    if (!node) {
      this.misses++;
      return undefined;
    }

    // Check TTL
    if (this.isExpired(node)) {
      this.deleteNode(node);
      this.misses++;
      return undefined;
    }

    // Move to head (most recently used)
    this.moveToHead(node);
    this.hits++;
    return node.value;
  }

  /**
   * Store a key-value pair.
   * Evicts the LRU entry if capacity is exceeded.
   */
  set(key: string, value: V): void {
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      existing.insertedAt = Date.now();
      this.moveToHead(existing);
      return;
    }

    const node: Node<V> = {
      key,
      value,
      insertedAt: Date.now(),
      prev: null,
      next: null,
    };

    this.map.set(key, node);
    this.prependHead(node);

    if (this.map.size > this.maxSize) {
      this.evictTail();
    }
  }

  /**
   * Remove an entry. Returns true if the key existed.
   */
  delete(key: string): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    this.deleteNode(node);
    return true;
  }

  /** Returns true if the key exists and is not expired. */
  has(key: string): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    if (this.isExpired(node)) {
      this.deleteNode(node);
      return false;
    }
    return true;
  }

  /** Remove all entries and reset statistics. */
  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /** Number of live (non-expired) entries. */
  get size(): number {
    return this.map.size;
  }

  /** Snapshot of cache statistics. */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.map.size,
      maxSize: this.maxSize,
      hitRate: total === 0 ? 0 : this.hits / total,
    };
  }

  /**
   * Sweep expired entries. O(n) — call periodically if TTL is enabled.
   * Returns the number of entries removed.
   */
  pruneExpired(): number {
    if (this.ttlMs === 0) return 0;
    let removed = 0;
    const now = Date.now();
    for (const node of this.map.values()) {
      if (now - node.insertedAt >= this.ttlMs) {
        this.deleteNode(node);
        removed++;
      }
    }
    return removed;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private isExpired(node: Node<V>): boolean {
    return this.ttlMs > 0 && Date.now() - node.insertedAt >= this.ttlMs;
  }

  private prependHead(node: Node<V>): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private moveToHead(node: Node<V>): void {
    if (node === this.head) return;
    this.unlinkNode(node);
    this.prependHead(node);
  }

  private unlinkNode(node: Node<V>): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;

    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;

    node.prev = null;
    node.next = null;
  }

  private deleteNode(node: Node<V>): void {
    this.unlinkNode(node);
    this.map.delete(node.key);
  }

  private evictTail(): void {
    if (!this.tail) return;
    this.map.delete(this.tail.key);
    this.evictions++;
    const newTail = this.tail.prev;
    if (newTail) {
      newTail.next = null;
    } else {
      this.head = null;
    }
    this.tail = newTail;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════════════════════

export function createLRUCache<V>(options: LRUCacheOptions = {}): LRUCache<V> {
  return new LRUCache<V>(options);
}
