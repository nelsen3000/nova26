// Memory Store - Hierarchical memory system with L1/L2/L3 levels
// Spec: .nova/specs/grok-r23-eternal-symphony.md (R23-03)

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// Type Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const MemoryLevelSchema = z.enum(['L1', 'L2', 'L3']);

export const MemoryItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  embedding: z.array(z.number()).optional(),
  tags: z.array(z.string()).default([]),
  importance: z.number().min(0).max(1).default(0.5),
  createdAt: z.number(), // timestamp
  accessedAt: z.number(), // timestamp
  accessCount: z.number().default(0),
  level: MemoryLevelSchema,
  metadata: z.record(z.any()).optional(),
});

export type MemoryLevel = z.infer<typeof MemoryLevelSchema>;
export type MemoryItem = z.infer<typeof MemoryItemSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// Error Classes
// ═══════════════════════════════════════════════════════════════════════════════

export class MemoryStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MemoryStoreError';
  }
}

export class ItemNotFoundError extends Error {
  constructor(itemId: string) {
    super(`Memory item not found: ${itemId}`);
    this.name = 'ItemNotFoundError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MemoryStore Class
// ═══════════════════════════════════════════════════════════════════════════════

export interface MemoryStoreConfig {
  l1Capacity?: number; // Default: 100
  l2Capacity?: number; // Default: 1000
}

export class MemoryStore {
  private l1: Map<string, MemoryItem>; // Working - max 100
  private l2: Map<string, MemoryItem>; // Session - max 1000
  private l3: Map<string, MemoryItem>; // Long-term - unlimited
  private l1Capacity: number;
  private l2Capacity: number;

  constructor(config: MemoryStoreConfig = {}) {
    this.l1Capacity = config.l1Capacity ?? 100;
    this.l2Capacity = config.l2Capacity ?? 1000;
    this.l1 = new Map();
    this.l2 = new Map();
    this.l3 = new Map();
  }

  /**
   * Store new content in L1 (Working memory)
   */
  store(
    content: string,
    tags: string[] = [],
    importance: number = 0.5,
    metadata?: Record<string, unknown>
  ): MemoryItem {
    const item: MemoryItem = {
      id: this.generateId(),
      content,
      tags,
      importance,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 0,
      level: 'L1',
      metadata,
    };

    // Validate
    const validated = MemoryItemSchema.parse(item);

    // Evict if at capacity
    this.evictIfNeeded('L1');

    this.l1.set(item.id, validated);
    return validated;
  }

  /**
   * Get an item by ID from any level
   */
  get(itemId: string): MemoryItem | undefined {
    // Try L1 first
    let item = this.l1.get(itemId);
    if (item) {
      this.touch(item);
      return item;
    }

    // Try L2
    item = this.l2.get(itemId);
    if (item) {
      this.touch(item);
      return item;
    }

    // Try L3
    item = this.l3.get(itemId);
    if (item) {
      this.touch(item);
      return item;
    }

    return undefined;
  }

  /**
   * Get item or throw
   */
  getOrThrow(itemId: string): MemoryItem {
    const item = this.get(itemId);
    if (!item) {
      throw new ItemNotFoundError(itemId);
    }
    return item;
  }

  /**
   * Promote item to a higher level
   */
  promote(itemId: string): MemoryItem | undefined {
    const item = this.get(itemId);
    if (!item) return undefined;

    if (item.level === 'L3') return item; // Already at highest

    // Remove from current level
    this.removeFromLevel(itemId, item.level);

    // Promote
    const newLevel: MemoryLevel = item.level === 'L1' ? 'L2' : 'L3';
    item.level = newLevel;

    // Evict if needed
    this.evictIfNeeded(newLevel);

    // Add to new level
    this.getLevelMap(newLevel).set(itemId, item);

    return item;
  }

  /**
   * Demote item to a lower level
   */
  demote(itemId: string): MemoryItem | undefined {
    const item = this.get(itemId);
    if (!item) return undefined;

    if (item.level === 'L1') return item; // Already at lowest

    // Remove from current level
    this.removeFromLevel(itemId, item.level);

    // Demote
    const newLevel: MemoryLevel = item.level === 'L3' ? 'L2' : 'L1';
    item.level = newLevel;

    // Evict if needed
    this.evictIfNeeded(newLevel);

    // Add to new level
    this.getLevelMap(newLevel).set(itemId, item);

    return item;
  }

  /**
   * Compress a level - summarize and merge similar items
   */
  compress(level: MemoryLevel): {
    itemsBefore: number;
    itemsAfter: number;
    strategy: string;
  } {
    const levelMap = this.getLevelMap(level);
    const itemsBefore = levelMap.size;

    if (itemsBefore === 0) {
      return { itemsBefore: 0, itemsAfter: 0, strategy: 'none' };
    }

    // Group by tags
    const byTag = new Map<string, MemoryItem[]>();
    for (const item of levelMap.values()) {
      const key = item.tags.sort().join(',') || 'untagged';
      const group = byTag.get(key) ?? [];
      group.push(item);
      byTag.set(key, group);
    }

    // Compress each group
    const compressed = new Map<string, MemoryItem>();

    for (const [tagKey, items] of byTag) {
      if (items.length <= 2) {
        // Keep small groups as-is
        for (const item of items) {
          compressed.set(item.id, item);
        }
      } else {
        // Create summary item
        const summaryContent = this.summarizeGroup(items);
        const avgImportance = items.reduce((s, i) => s + i.importance, 0) / items.length;

        const summaryItem: MemoryItem = {
          id: this.generateId(),
          content: summaryContent,
          tags: items[0].tags,
          importance: avgImportance,
          createdAt: Math.min(...items.map(i => i.createdAt)),
          accessedAt: Date.now(),
          accessCount: items.reduce((s, i) => s + i.accessCount, 0),
          level,
          metadata: {
            compressed: true,
            originalCount: items.length,
            originalIds: items.map(i => i.id),
          },
        };

        compressed.set(summaryItem.id, summaryItem);
      }
    }

    // Replace level contents
    levelMap.clear();
    for (const item of compressed.values()) {
      levelMap.set(item.id, item);
    }

    return {
      itemsBefore,
      itemsAfter: compressed.size,
      strategy: 'merge-by-tags',
    };
  }

  /**
   * Get all items from a level
   */
  getItemsByLevel(level: MemoryLevel): MemoryItem[] {
    return Array.from(this.getLevelMap(level).values());
  }

  /**
   * Get items across all levels
   */
  getAllItems(): MemoryItem[] {
    return [
      ...this.l1.values(),
      ...this.l2.values(),
      ...this.l3.values(),
    ];
  }

  /**
   * Search items by tags
   */
  findByTags(tags: string[], matchAll: boolean = false): MemoryItem[] {
    const allItems = this.getAllItems();

    return allItems.filter(item => {
      if (matchAll) {
        return tags.every(tag => item.tags.includes(tag));
      }
      return tags.some(tag => item.tags.includes(tag));
    });
  }

  /**
   * Get memory statistics
   */
  getStats(): {
    l1Count: number;
    l2Count: number;
    l3Count: number;
    totalCount: number;
    l1Capacity: number;
    l2Capacity: number;
  } {
    return {
      l1Count: this.l1.size,
      l2Count: this.l2.size,
      l3Count: this.l3.size,
      totalCount: this.l1.size + this.l2.size + this.l3.size,
      l1Capacity: this.l1Capacity,
      l2Capacity: this.l2Capacity,
    };
  }

  /**
   * Delete an item
   */
  delete(itemId: string): boolean {
    const item = this.get(itemId);
    if (!item) return false;

    this.removeFromLevel(itemId, item.level);
    return true;
  }

  /**
   * Clear all levels
   */
  clear(): void {
    this.l1.clear();
    this.l2.clear();
    this.l3.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════════

  private generateId(): string {
    return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private getLevelMap(level: MemoryLevel): Map<string, MemoryItem> {
    switch (level) {
      case 'L1':
        return this.l1;
      case 'L2':
        return this.l2;
      case 'L3':
        return this.l3;
    }
  }

  private evictIfNeeded(level: MemoryLevel): void {
    const levelMap = this.getLevelMap(level);
    const capacity = level === 'L1' ? this.l1Capacity : this.l2Capacity;

    if (level === 'L3' || levelMap.size < capacity) return;

    // Find LRU item (least recently accessed)
    let lruItem: MemoryItem | undefined;
    let lruTime = Infinity;

    for (const item of levelMap.values()) {
      if (item.accessedAt < lruTime) {
        lruTime = item.accessedAt;
        lruItem = item;
      }
    }

    if (lruItem) {
      // Move to lower level instead of deleting
      this.demote(lruItem.id);
    }
  }

  private touch(item: MemoryItem): void {
    item.accessedAt = Date.now();
    item.accessCount++;
  }

  private removeFromLevel(itemId: string, level: MemoryLevel): void {
    this.getLevelMap(level).delete(itemId);
  }

  private summarizeGroup(items: MemoryItem[]): string {
    const contents = items.map(i => i.content);
    if (contents.length <= 3) {
      return `[Summary] ${contents.join(' | ')}`;
    }
    return `[Summary of ${items.length} items] ${contents[0]} | ... | ${contents[contents.length - 1]}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════════════════════

let globalStore: MemoryStore | null = null;

export function getMemoryStore(config?: MemoryStoreConfig): MemoryStore {
  if (!globalStore) {
    globalStore = new MemoryStore(config);
  }
  return globalStore;
}

export function resetMemoryStore(): void {
  globalStore = null;
}
