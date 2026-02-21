// Consolidation Pipeline - Deduplication, decay, archival, compression
// Spec: .kiro/specs/hindsight-persistent-memory/tasks.md

import type {
  MemoryFragment,
  ConsolidationReport,
  DeduplicationResult,
  DecayResult,
  ArchiveResult,
} from './types.js';
import { ConsolidationReportSchema } from './schemas.js';
import { cosineSimilarity } from './vector-index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConsolidationConfig {
  dedupSimilarityThreshold: number;
  decayRate: number;
  archiveThreshold: number;
  maxFragmentsBeforeCompression: number;
}

export const DEFAULT_CONFIG: ConsolidationConfig = {
  dedupSimilarityThreshold: 0.95,
  decayRate: 0.01,
  archiveThreshold: 0.1,
  maxFragmentsBeforeCompression: 10000,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Consolidation Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export class ConsolidationPipeline {
  private config: ConsolidationConfig;

  constructor(config?: Partial<ConsolidationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async run(fragments: MemoryFragment[]): Promise<ConsolidationReport> {
    const startTime = Date.now();

    // Step 1: Deduplication
    const dedupResult = this.deduplicateFragments(fragments);
    let workingFragments = dedupResult.clusters.map(c => c.kept);

    // Step 2: Apply decay
    const decayResult = this.applyDecay(workingFragments);
    workingFragments = decayResult.retained;

    // Step 3: Archive low-relevance fragments
    const archiveResult = this.archiveFragments(workingFragments);
    workingFragments = archiveResult.retained;

    // Step 4: Compress if needed
    const compressed = this.compressFragments(workingFragments);

    const report: ConsolidationReport = {
      merged: dedupResult.merged,
      compressed: compressed.count,
      archived: archiveResult.archived,
      decayed: decayResult.decayed,
      deleted: 0, // We don't permanently delete, only archive
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
    };

    return ConsolidationReportSchema.parse(report);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Deduplication
  // ═══════════════════════════════════════════════════════════════════════════

  deduplicateFragments(fragments: MemoryFragment[]): DeduplicationResult {
    const clusters: Array<{ kept: MemoryFragment; removed: MemoryFragment[] }> = [];
    const processed = new Set<string>();
    let merged = 0;

    for (const fragment of fragments) {
      if (processed.has(fragment.id)) continue;

      // Find similar fragments
      const similar: MemoryFragment[] = [];
      for (const other of fragments) {
        if (other.id === fragment.id || processed.has(other.id)) continue;

        const similarity = cosineSimilarity(fragment.embedding, other.embedding);
        if (similarity >= this.config.dedupSimilarityThreshold) {
          similar.push(other);
        }
      }

      if (similar.length > 0) {
        // Merge similar fragments
        const mergedFragment = this.mergeFragments(fragment, similar);
        clusters.push({
          kept: mergedFragment,
          removed: [fragment, ...similar],
        });
        merged += similar.length;
        processed.add(fragment.id);
        for (const s of similar) {
          processed.add(s.id);
        }
      } else {
        clusters.push({ kept: fragment, removed: [] });
        processed.add(fragment.id);
      }
    }

    return { merged, clusters };
  }

  private mergeFragments(
    primary: MemoryFragment,
    others: MemoryFragment[]
  ): MemoryFragment {
    // Keep highest relevance
    const maxRelevance = Math.max(primary.relevance, ...others.map(o => o.relevance));

    // Combine provenance
    const allSourceIds = [primary.provenance.sourceId, ...others.map(o => o.provenance.sourceId)];
    const uniqueSourceIds = [...new Set(allSourceIds)];

    // Combine tags
    const allTags = new Set([...primary.tags, ...others.flatMap(o => o.tags)]);

    return {
      ...primary,
      relevance: maxRelevance,
      tags: Array.from(allTags),
      provenance: {
        ...primary.provenance,
        sourceId: uniqueSourceIds.join('+'),
      },
      updatedAt: Date.now(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Forgetting Curve Decay
  // ═══════════════════════════════════════════════════════════════════════════

  applyDecay(fragments: MemoryFragment[]): DecayResult {
    const now = Date.now();
    const retained: MemoryFragment[] = [];
    let decayed = 0;

    for (const fragment of fragments) {
      if (fragment.isPinned || fragment.isArchived) {
        retained.push(fragment);
        continue;
      }

      const daysSinceAccess = (now - fragment.lastAccessedAt) / (1000 * 60 * 60 * 24);
      const decayFactor = Math.exp(-this.config.decayRate * daysSinceAccess);
      const newRelevance = fragment.relevance * decayFactor;

      if (newRelevance < this.config.archiveThreshold) {
        // Will be archived in next step
        fragment.relevance = newRelevance;
        retained.push(fragment);
        decayed++;
      } else {
        fragment.relevance = newRelevance;
        retained.push(fragment);
      }
    }

    return { decayed, retained };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Archival
  // ═══════════════════════════════════════════════════════════════════════════

  archiveFragments(fragments: MemoryFragment[]): ArchiveResult {
    const retained: MemoryFragment[] = [];
    let archived = 0;

    for (const fragment of fragments) {
      if (fragment.isPinned) {
        retained.push(fragment);
        continue;
      }

      if (fragment.relevance < this.config.archiveThreshold && !fragment.isArchived) {
        fragment.isArchived = true;
        fragment.updatedAt = Date.now();
        archived++;
      }

      retained.push(fragment);
    }

    return { archived, retained };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Compression
  // ═══════════════════════════════════════════════════════════════════════════

  private compressFragments(fragments: MemoryFragment[]): { count: number; fragments: MemoryFragment[] } {
    if (fragments.length < this.config.maxFragmentsBeforeCompression) {
      return { count: 0, fragments };
    }

    // Sort by relevance
    const sorted = [...fragments].sort((a, b) => b.relevance - a.relevance);

    // Keep top 80%, summarize bottom 20%
    const keepCount = Math.floor(fragments.length * 0.8);
    const keep = sorted.slice(0, keepCount);
    const compress = sorted.slice(keepCount);

    // Create summary fragments for low-relevance ones
    const summaries = this.summarizeFragments(compress);

    return {
      count: compress.length,
      fragments: [...keep, ...summaries],
    };
  }

  private summarizeFragments(fragments: MemoryFragment[]): MemoryFragment[] {
    // Group by type and create summaries
    const byType = new Map<string, MemoryFragment[]>();
    for (const f of fragments) {
      const existing = byType.get(f.type) || [];
      existing.push(f);
      byType.set(f.type, existing);
    }

    const summaries: MemoryFragment[] = [];
    for (const [type, typeFragments] of byType) {
      if (typeFragments.length === 0) continue;

      const summary: MemoryFragment = {
        ...typeFragments[0],
        id: `summary-${Date.now()}-${type}`,
        content: `Summary of ${typeFragments.length} ${type} fragments: ${typeFragments.map(f => f.content.substring(0, 50)).join(' | ')}`,
        relevance: Math.max(...typeFragments.map(f => f.relevance)) * 0.9,
        updatedAt: Date.now(),
      };
      summaries.push(summary);
    }

    return summaries;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Forgetting Curve Calculation
  // ═══════════════════════════════════════════════════════════════════════════

  calculateForgettingScore(
    relevance: number,
    decayRate: number,
    daysSinceAccess: number,
    isPinned: boolean
  ): number {
    if (isPinned) {
      return relevance; // Pinned items don't decay
    }
    return relevance * Math.exp(-decayRate * daysSinceAccess);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

export function createConsolidationPipeline(
  config?: Partial<ConsolidationConfig>
): ConsolidationPipeline {
  return new ConsolidationPipeline(config);
}
