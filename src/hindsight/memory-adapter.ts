// Memory Storage Adapter - In-memory implementation for testing
// Spec: .kiro/specs/hindsight-persistent-memory/design.md

import type {
  MemoryFragment,
  FragmentFilter,
  ScoredFragment,
  StorageStats,
} from './types.js';
import type { StorageAdapter } from './storage-adapter.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Memory Storage Adapter
// ═══════════════════════════════════════════════════════════════════════════════

export class MemoryStorageAdapter implements StorageAdapter {
  private fragments = new Map<string, MemoryFragment>();
  private initialized = false;

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async close(): Promise<void> {
    this.fragments.clear();
    this.initialized = false;
  }

  async write(fragment: MemoryFragment): Promise<void> {
    this.fragments.set(fragment.id, fragment);
  }

  async read(id: string): Promise<MemoryFragment | null> {
    return this.fragments.get(id) || null;
  }

  async bulkWrite(fragments: MemoryFragment[]): Promise<void> {
    for (const fragment of fragments) {
      this.fragments.set(fragment.id, fragment);
    }
  }

  async bulkRead(ids: string[]): Promise<MemoryFragment[]> {
    return ids
      .map(id => this.fragments.get(id))
      .filter((f): f is MemoryFragment => f !== undefined);
  }

  async delete(id: string): Promise<boolean> {
    return this.fragments.delete(id);
  }

  async query(filter: FragmentFilter): Promise<MemoryFragment[]> {
    return Array.from(this.fragments.values()).filter(fragment =>
      this.matchesFilter(fragment, filter)
    );
  }

  async count(filter?: FragmentFilter): Promise<number> {
    if (!filter) {
      return this.fragments.size;
    }
    return (await this.query(filter)).length;
  }

  async searchByVector(
    embedding: number[],
    topK: number,
    filter?: FragmentFilter
  ): Promise<ScoredFragment[]> {
    // Brute-force cosine similarity search
    const candidates = filter
      ? await this.query(filter)
      : Array.from(this.fragments.values());

    const scored = candidates.map(fragment => ({
      fragment,
      score: this.cosineSimilarity(embedding, fragment.embedding),
      similarityScore: this.cosineSimilarity(embedding, fragment.embedding),
      recencyScore: this.calculateRecencyScore(fragment),
      frequencyScore: this.calculateFrequencyScore(fragment),
    }));

    // Sort by score descending and take topK
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async exportAll(): Promise<MemoryFragment[]> {
    return Array.from(this.fragments.values());
  }

  async importAll(fragments: MemoryFragment[]): Promise<number> {
    for (const fragment of fragments) {
      this.fragments.set(fragment.id, fragment);
    }
    return fragments.length;
  }

  async isAvailable(): Promise<boolean> {
    return this.initialized;
  }

  async getStats(): Promise<StorageStats> {
    const allFragments = Array.from(this.fragments.values());
    const namespaces = new Set(allFragments.map(f => f.namespace));
    
    const totalSizeBytes = allFragments.reduce(
      (sum, f) => sum + JSON.stringify(f).length,
      0
    );

    return {
      totalFragments: this.fragments.size,
      totalSizeBytes,
      indexSize: this.fragments.size,
      averageFragmentSize: allFragments.length > 0
        ? totalSizeBytes / allFragments.length
        : 0,
      namespaces: Array.from(namespaces),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private matchesFilter(
    fragment: MemoryFragment,
    filter: FragmentFilter
  ): boolean {
    if (filter.namespace && fragment.namespace !== filter.namespace) {
      return false;
    }
    if (filter.agentId && fragment.agentId !== filter.agentId) {
      return false;
    }
    if (filter.projectId && fragment.projectId !== filter.projectId) {
      return false;
    }
    if (filter.type && fragment.type !== filter.type) {
      return false;
    }
    if (filter.minRelevance !== undefined && fragment.relevance < filter.minRelevance) {
      return false;
    }
    if (filter.maxRelevance !== undefined && fragment.relevance > filter.maxRelevance) {
      return false;
    }
    if (filter.isArchived !== undefined && fragment.isArchived !== filter.isArchived) {
      return false;
    }
    if (filter.isPinned !== undefined && fragment.isPinned !== filter.isPinned) {
      return false;
    }
    if (filter.timeRange) {
      if (
        fragment.createdAt < filter.timeRange.start ||
        fragment.createdAt > filter.timeRange.end
      ) {
        return false;
      }
    }
    if (filter.tags && filter.tags.length > 0) {
      const hasTag = filter.tagsAll
        ? filter.tags.every(tag => fragment.tags.includes(tag))
        : filter.tags.some(tag => fragment.tags.includes(tag));
      if (!hasTag) {
        return false;
      }
    }
    return true;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private calculateRecencyScore(fragment: MemoryFragment): number {
    const now = Date.now();
    const ageMs = now - fragment.lastAccessedAt;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    // Exponential decay: score = exp(-0.1 * ageDays)
    return Math.exp(-0.1 * ageDays);
  }

  private calculateFrequencyScore(fragment: MemoryFragment): number {
    // Logarithmic scaling: score = log(1 + accessCount) / log(1 + maxExpected)
    const maxExpected = 100;
    return Math.log(1 + fragment.accessCount) / Math.log(1 + maxExpected);
  }
}
