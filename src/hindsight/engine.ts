// Hindsight Engine - Core persistent memory engine
// Spec: .kiro/specs/hindsight-persistent-memory/design.md

import type {
  MemoryFragment,
  MemoryFragmentInput,
  HindsightConfig,
  RetrievalQuery,
  RetrievalResult,
  SemanticSearchQuery,
  HealthStatus,
  ConsolidationReport,
  MergeReport,
  ImportReport,
} from './types.js';
import { HindsightConfigSchema, createMemoryFragment } from './schemas.js';
import type { StorageAdapter } from './storage-adapter.js';
import { createStorageAdapter } from './storage-adapter.js';
import { VectorIndex, generateRandomEmbedding } from './vector-index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_CONFIG: HindsightConfig = {
  storageType: 'memory',
  embeddingDimension: 384,
  similarityThreshold: 0.7,
  consolidationIntervalMs: 3600000,
  dedupSimilarityThreshold: 0.95,
  decayRate: 0.01,
  archiveThreshold: 0.1,
  maxFragmentsBeforeCompression: 10000,
  defaultTopK: 10,
  tokenBudget: 2000,
  recencyWeight: 0.3,
  frequencyWeight: 0.2,
  similarityWeight: 0.5,
  defaultNamespace: 'default',
  enableNamespaceIsolation: true,
  healthCheckIntervalMs: 60000,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Hindsight Engine
// ═══════════════════════════════════════════════════════════════════════════════

export class HindsightEngine {
  private config: HindsightConfig;
  private adapter: StorageAdapter | null = null;
  private index: VectorIndex | null = null;
  private initialized = false;
  private lastConsolidation: number | undefined;
  private inMemoryCache: Map<string, MemoryFragment> = new Map();

  constructor(config?: Partial<HindsightConfig>) {
    this.config = HindsightConfigSchema.parse({ ...DEFAULT_CONFIG, ...config });
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.adapter = await createStorageAdapter({
        type: this.config.storageType,
        path: this.config.storagePath,
      });

      await this.adapter.initialize();

      this.index = new VectorIndex(this.adapter, {
        similarityThreshold: this.config.similarityThreshold,
        recencyWeight: this.config.recencyWeight,
        frequencyWeight: this.config.frequencyWeight,
        similarityWeight: this.config.similarityWeight,
      });

      this.initialized = true;
    } catch (error) {
      // Fallback to in-memory cache
      console.warn(
        'Storage initialization failed, using in-memory cache:',
        error
      );
      this.adapter = null;
      this.index = null;
      this.initialized = true;
    }
  }

  async shutdown(): Promise<void> {
    if (this.adapter) {
      await this.adapter.close();
    }
    this.inMemoryCache.clear();
    this.initialized = false;
  }

  async healthCheck(): Promise<HealthStatus> {
    const errors: string[] = [];
    let storageAvailable = false;
    let indexSize = 0;
    let fragmentCount = 0;

    try {
      if (this.adapter) {
        storageAvailable = await this.adapter.isAvailable();
        if (storageAvailable) {
          const stats = await this.adapter.getStats();
          fragmentCount = stats.totalFragments;
          indexSize = stats.indexSize;
        }
      } else {
        // In-memory mode
        storageAvailable = true;
        fragmentCount = this.inMemoryCache.size;
        indexSize = this.inMemoryCache.size;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return {
      healthy: storageAvailable && errors.length === 0,
      storageAvailable,
      indexSize,
      fragmentCount,
      lastConsolidation: this.lastConsolidation,
      errors,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Core Operations
  // ═══════════════════════════════════════════════════════════════════════════

  async store(input: MemoryFragmentInput): Promise<MemoryFragment> {
    await this.ensureInitialized();

    // Generate embedding (in production, this would call an embedding model)
    const embedding =
      input.embedding ?? generateRandomEmbedding(this.config.embeddingDimension);

    // Create fragment
    const fragment = createMemoryFragment(input, embedding);

    // Write to storage
    if (this.adapter) {
      await this.adapter.write(fragment);
      await this.index?.index(fragment.id, fragment.embedding);
    } else {
      this.inMemoryCache.set(fragment.id, fragment);
    }

    return fragment;
  }

  async retrieve(query: RetrievalQuery): Promise<RetrievalResult> {
    await this.ensureInitialized();

    const startTime = Date.now();

    // Generate embedding for query (in production, call embedding model)
    const queryEmbedding =
      query.embedding ?? generateRandomEmbedding(this.config.embeddingDimension);

    // Search
    const topK = query.topK ?? this.config.defaultTopK;
    const fragments = await this.search({
      embedding: queryEmbedding,
      topK,
      filter: query.filter,
    });

    // Update access counts
    for (const fragment of fragments) {
      fragment.accessCount++;
      fragment.lastAccessedAt = Date.now();
      if (this.adapter) {
        await this.adapter.write(fragment);
      }
    }

    // Estimate tokens
    const totalTokens = fragments.reduce(
      (sum, f) => sum + Math.ceil(f.content.length / 4),
      0
    );

    // Convert to ScoredFragment format (scores are not available from simple search)
    const scoredFragments = fragments.map(f => ({
      fragment: f,
      score: 1.0,
      similarityScore: 1.0,
      recencyScore: 1.0,
      frequencyScore: 1.0,
    }));

    return {
      fragments: scoredFragments,
      totalTokens,
      query,
      durationMs: Date.now() - startTime,
    };
  }

  async search(query: SemanticSearchQuery): Promise<MemoryFragment[]> {
    await this.ensureInitialized();

    if (this.index) {
      const results = await this.index.search(
        query.embedding,
        query.topK,
        query.filter,
        query.similarityThreshold
      );
      return results.map(r => r.fragment);
    } else {
      // In-memory search
      return Array.from(this.inMemoryCache.values())
        .filter(f => this.matchesFilter(f, query.filter))
        .slice(0, query.topK);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Consolidation
  // ═══════════════════════════════════════════════════════════════════════════

  async consolidate(): Promise<ConsolidationReport> {
    await this.ensureInitialized();

    const startTime = Date.now();

    // Get all fragments
    const fragments = this.adapter
      ? await this.adapter.exportAll()
      : Array.from(this.inMemoryCache.values());

    // Apply decay
    const now = Date.now();
    const decayed: MemoryFragment[] = [];
    for (const fragment of fragments) {
      if (!fragment.isPinned && !fragment.isArchived) {
        const daysSinceAccess =
          (now - fragment.lastAccessedAt) / (1000 * 60 * 60 * 24);
        const decayFactor = Math.exp(-this.config.decayRate * daysSinceAccess);
        fragment.relevance *= decayFactor;

        if (fragment.relevance < this.config.archiveThreshold) {
          fragment.isArchived = true;
          decayed.push(fragment);
        }
      }
    }

    // Write back decayed fragments
    if (this.adapter) {
      await this.adapter.bulkWrite(decayed);
    }

    this.lastConsolidation = Date.now();

    return {
      merged: 0, // TODO: Implement deduplication
      compressed: 0, // TODO: Implement compression
      archived: decayed.length,
      decayed: decayed.length,
      deleted: 0,
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Namespace Management
  // ═══════════════════════════════════════════════════════════════════════════

  async forkNamespace(source: string, target: string): Promise<void> {
    await this.ensureInitialized();

    const fragments = this.adapter
      ? await this.adapter.query({ namespace: source })
      : Array.from(this.inMemoryCache.values()).filter(
          f => f.namespace === source
        );

    const forked = fragments.map(f => ({
      ...f,
      id: `frag-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      namespace: target,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    if (this.adapter) {
      await this.adapter.bulkWrite(forked);
    } else {
      for (const f of forked) {
        this.inMemoryCache.set(f.id, f);
      }
    }
  }

  async mergeNamespaces(source: string, target: string): Promise<MergeReport> {
    await this.ensureInitialized();

    const sourceFragments = this.adapter
      ? await this.adapter.query({ namespace: source })
      : Array.from(this.inMemoryCache.values()).filter(
          f => f.namespace === source
        );

    const conflicts: Array<{ fragmentId: string; reason: string }> = [];
    const merged: MemoryFragment[] = [];

    for (const fragment of sourceFragments) {
      const targetFragments = this.adapter
        ? await this.adapter.query({ namespace: target })
        : Array.from(this.inMemoryCache.values()).filter(
            f => f.namespace === target
          );

      // Check for conflicts (same content)
      const conflict = targetFragments.find(
        f => f.content === fragment.content
      );

      if (conflict) {
        conflicts.push({
          fragmentId: fragment.id,
          reason: 'Duplicate content in target namespace',
        });
      } else {
        merged.push({
          ...fragment,
          namespace: target,
          updatedAt: Date.now(),
        });
      }
    }

    // Write merged fragments
    if (this.adapter) {
      await this.adapter.bulkWrite(merged);
    } else {
      for (const f of merged) {
        this.inMemoryCache.set(f.id, f);
      }
    }

    return {
      sourceNamespace: source,
      targetNamespace: target,
      fragmentsMerged: merged.length,
      fragmentsSkipped: conflicts.length,
      conflicts,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Export/Import
  // ═══════════════════════════════════════════════════════════════════════════

  async exportMemories(namespace?: string): Promise<string> {
    await this.ensureInitialized();

    const fragments = this.adapter
      ? await this.adapter.query(namespace ? { namespace } : {})
      : Array.from(this.inMemoryCache.values()).filter(
          f => !namespace || f.namespace === namespace
        );

    return JSON.stringify(fragments, null, 2);
  }

  async importMemories(json: string): Promise<ImportReport> {
    await this.ensureInitialized();

    const fragments: MemoryFragment[] = JSON.parse(json);
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;

    for (const fragment of fragments) {
      try {
        if (this.adapter) {
          await this.adapter.write(fragment);
        } else {
          this.inMemoryCache.set(fragment.id, fragment);
        }
        imported++;
      } catch (error) {
        skipped++;
        errors.push(
          error instanceof Error ? error.message : 'Import error'
        );
      }
    }

    return { imported, skipped, errors };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private matchesFilter(
    fragment: MemoryFragment,
    filter?: { namespace?: string }
  ): boolean {
    if (!filter) return true;
    if (filter.namespace && fragment.namespace !== filter.namespace) {
      return false;
    }
    return true;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

export function createHindsightEngine(
  config?: Partial<HindsightConfig>
): HindsightEngine {
  return new HindsightEngine(config);
}
