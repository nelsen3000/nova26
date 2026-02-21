// Memory Compressor - Compression strategies for memory optimization
// Spec: .nova/specs/grok-r23-eternal-symphony.md (R23-03)

import type { MemoryItem, MemoryLevel } from './memory-store.js';
import { getMemoryStore } from './memory-store.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type CompressionStrategy = 'merge' | 'summarize' | 'prune' | 'archive';

export interface CompressionOptions {
  strategy?: CompressionStrategy;
  threshold?: number;
  maxAge?: number;
  minImportance?: number;
}

export interface CompressionHistoryEntry {
  timestamp: number;
  level: MemoryLevel;
  itemsBefore: number;
  itemsAfter: number;
  strategy: CompressionStrategy;
  bytesFreed: number;
}

export interface ArchiveEntry {
  id: string;
  items: MemoryItem[];
  compressedAt: number;
  query: string;
  itemCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Compression Strategies
// ═══════════════════════════════════════════════════════════════════════════════

export function mergeStrategy(items: MemoryItem[]): MemoryItem[] {
  const merged: MemoryItem[] = [];
  const processed = new Set<string>();

  for (const item of items) {
    if (processed.has(item.id)) continue;

    // Find similar items
    const similar: MemoryItem[] = [item];
    for (const other of items) {
      if (other.id === item.id || processed.has(other.id)) continue;

      const similarity = calculateSimilarity(item.content, other.content);
      if (similarity >= 0.5) {
        similar.push(other);
      }
    }

    if (similar.length > 1) {
      // Merge similar items
      const mergedItem = createMergedItem(similar);
      merged.push(mergedItem);
      for (const s of similar) {
        processed.add(s.id);
      }
    } else {
      merged.push(item);
      processed.add(item.id);
    }
  }

  return merged;
}

export function summarizeStrategy(items: MemoryItem[]): MemoryItem[] {
  // Group by tags
  const byTag = new Map<string, MemoryItem[]>();

  for (const item of items) {
    const key = item.tags.sort().join(',') || 'untagged';
    const group = byTag.get(key) ?? [];
    group.push(item);
    byTag.set(key, group);
  }

  const summarized: MemoryItem[] = [];

  for (const [tagKey, group] of byTag) {
    if (group.length <= 2) {
      summarized.push(...group);
      continue;
    }

    // Create summary
    const summaryContent = summarizeGroup(group);
    const avgImportance = group.reduce((s, i) => s + i.importance, 0) / group.length;

    const summaryItem: MemoryItem = {
      id: `summary-${Date.now()}-${tagKey}`,
      content: summaryContent,
      tags: group[0].tags,
      importance: avgImportance,
      createdAt: Math.min(...group.map(i => i.createdAt)),
      accessedAt: Date.now(),
      accessCount: group.reduce((s, i) => s + i.accessCount, 0),
      level: group[0].level,
      metadata: {
        compressed: true,
        strategy: 'summarize',
        originalCount: group.length,
        originalIds: group.map(i => i.id),
      },
    };

    summarized.push(summaryItem);
  }

  return summarized;
}

export function pruneStrategy(
  items: MemoryItem[],
  options: { maxAge?: number; minImportance?: number } = {}
): { kept: MemoryItem[]; pruned: MemoryItem[] } {
  const now = Date.now();
  const maxAge = options.maxAge ?? 24 * 60 * 60 * 1000; // 1 day default
  const minImportance = options.minImportance ?? 0.2;

  const kept: MemoryItem[] = [];
  const pruned: MemoryItem[] = [];

  for (const item of items) {
    const age = now - item.accessedAt;
    const isStale = age > maxAge && item.accessCount < 3;
    const isUnimportant = item.importance < minImportance && item.accessCount < 2;

    if (isStale || isUnimportant) {
      pruned.push(item);
    } else {
      kept.push(item);
    }
  }

  return { kept, pruned };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MemoryCompressor Class
// ═══════════════════════════════════════════════════════════════════════════════

export class MemoryCompressor {
  private history: CompressionHistoryEntry[] = [];
  private archive: Map<string, ArchiveEntry> = new Map();

  /**
   * Compress items using specified strategy
   */
  compress(
    items: MemoryItem[],
    level: MemoryLevel,
    options: CompressionOptions = {}
  ): { compressed: MemoryItem[]; freed: number } {
    const { strategy = 'summarize' } = options;
    const itemsBefore = items.length;
    let compressed: MemoryItem[] = [];

    switch (strategy) {
      case 'merge':
        compressed = mergeStrategy(items);
        break;
      case 'summarize':
        compressed = summarizeStrategy(items);
        break;
      case 'prune': {
        const result = pruneStrategy(items, options);
        compressed = result.kept;
        // Archive pruned items
        if (result.pruned.length > 0) {
          this.archiveItems(result.pruned, 'pruned');
        }
        break;
      }
      case 'archive':
        this.archiveItems(items, 'manual');
        compressed = [];
        break;
      default:
        compressed = items;
    }

    const itemsAfter = compressed.length;
    const bytesFreed = this.estimateSize(items) - this.estimateSize(compressed);

    // Record history
    this.history.push({
      timestamp: Date.now(),
      level,
      itemsBefore,
      itemsAfter,
      strategy,
      bytesFreed,
    });

    return { compressed, freed: bytesFreed };
  }

  /**
   * Auto-compress a level if needed
   */
  autoCompress(level: MemoryLevel, currentSize: number, capacity: number): {
    compressed: boolean;
    freed: number;
  } {
    // L1: compress at 80%
    // L2: compress at 90%
    const threshold = level === 'L1' ? 0.8 : 0.9;

    if (currentSize / capacity < threshold) {
      return { compressed: false, freed: 0 };
    }

    const store = getMemoryStore();
    const items = store.getItemsByLevel(level);

    const strategy: CompressionStrategy = level === 'L1' ? 'summarize' : 'prune';
    const { compressed, freed } = this.compress(items, level, { strategy });

    // Update store
    // Note: In practice, this would need to sync with MemoryStore

    return { compressed: true, freed };
  }

  /**
   * Archive items to cold storage
   */
  archiveItems(items: MemoryItem[], reason: string): string {
    const archiveId = `archive-${Date.now()}`;

    const entry: ArchiveEntry = {
      id: archiveId,
      items: items.map(item => ({
        ...item,
        metadata: { ...item.metadata, archived: true, archiveReason: reason },
      })),
      compressedAt: Date.now(),
      query: reason,
      itemCount: items.length,
    };

    this.archive.set(archiveId, entry);
    return archiveId;
  }

  /**
   * Search archived items
   */
  searchArchive(query: string): ArchiveEntry[] {
    const results: ArchiveEntry[] = [];

    for (const entry of this.archive.values()) {
      // Simple content search
      const matches = entry.items.some(item =>
        item.content.toLowerCase().includes(query.toLowerCase())
      );

      if (matches) {
        results.push(entry);
      }
    }

    return results;
  }

  /**
   * Decompress archive - restore items to L3
   */
  decompressArchive(archiveId: string): MemoryItem[] | undefined {
    const entry = this.archive.get(archiveId);
    if (!entry) return undefined;

    // Restore items to L3
    return entry.items.map(item => ({
      ...item,
      level: 'L3' as const,
      accessedAt: Date.now(),
      metadata: { ...item.metadata, restored: true, restoredAt: Date.now() },
    }));
  }

  /**
   * Get compression history
   */
  getHistory(level?: MemoryLevel): CompressionHistoryEntry[] {
    if (level) {
      return this.history.filter(h => h.level === level);
    }
    return [...this.history];
  }

  /**
   * Get archive statistics
   */
  getArchiveStats(): {
    totalArchives: number;
    totalItems: number;
    totalBytes: number;
  } {
    let totalItems = 0;
    let totalBytes = 0;

    for (const entry of this.archive.values()) {
      totalItems += entry.itemCount;
      totalBytes += this.estimateSize(entry.items);
    }

    return {
      totalArchives: this.archive.size,
      totalItems,
      totalBytes,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════════

  private estimateSize(items: MemoryItem[]): number {
    // Rough estimate: content size + per-item overhead (100 bytes for metadata)
    return items.reduce((sum, item) => sum + item.content.length * 2 + 100, 0);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════════

function calculateSimilarity(a: string, b: string): number {
  // Simple Jaccard similarity on words
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));

  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

function createMergedItem(items: MemoryItem[]): MemoryItem {
  const contents = items.map(i => i.content);
  const mergedContent = contents.join(' | ');
  const avgImportance = items.reduce((s, i) => s + i.importance, 0) / items.length;

  return {
    id: `merged-${Date.now()}`,
    content: mergedContent,
    tags: [...new Set(items.flatMap(i => i.tags))],
    importance: avgImportance,
    createdAt: Math.min(...items.map(i => i.createdAt)),
    accessedAt: Date.now(),
    accessCount: items.reduce((s, i) => s + i.accessCount, 0),
    level: items[0].level,
    metadata: {
      compressed: true,
      strategy: 'merge',
      originalCount: items.length,
      originalIds: items.map(i => i.id),
    },
  };
}

function summarizeGroup(items: MemoryItem[]): string {
  const contents = items.map(i => i.content);
  if (contents.length <= 3) {
    return `[Summary of ${items.length}] ${contents.join(' | ')}`;
  }
  return `[Summary of ${items.length} items] ${contents[0]} | ... | ${contents[contents.length - 1]}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════════════════════

let globalCompressor: MemoryCompressor | null = null;

export function getMemoryCompressor(): MemoryCompressor {
  if (!globalCompressor) {
    globalCompressor = new MemoryCompressor();
  }
  return globalCompressor;
}

export function resetMemoryCompressor(): void {
  globalCompressor = null;
}
