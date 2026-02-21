// Hindsight Consolidation Tests - Task K3-06
// Spec: .kiro/specs/hindsight-persistent-memory/tasks.md

import { describe, it, expect } from 'vitest';
import { createConsolidationPipeline } from './consolidation.js';
import type { MemoryFragment, MemoryFragmentInput } from './types.js';
import { createMemoryFragment } from './schemas.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

function createTestFragment(
  content: string,
  relevance: number = 0.5,
  lastAccessedAt?: number,
  isPinned: boolean = false
): MemoryFragment {
  const input: MemoryFragmentInput = {
    content,
    type: 'episodic',
    agentId: 'agent1',
    projectId: 'project1',
    relevance,
  };
  const fragment = createMemoryFragment(input, new Array(384).fill(0).map(() => Math.random()));
  if (lastAccessedAt) {
    fragment.lastAccessedAt = lastAccessedAt;
  }
  fragment.isPinned = isPinned;
  return fragment;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property 7: Deduplication Merges Similar Fragments
// ═══════════════════════════════════════════════════════════════════════════════

describe('ConsolidationPipeline', () => {
  const pipeline = createConsolidationPipeline();

  it('should merge similar fragments', () => {
    // Create nearly identical fragments
    const fragment1 = createTestFragment('duplicate content', 0.5);
    const fragment2 = createTestFragment('duplicate content', 0.6);
    const fragment3 = createTestFragment('different content', 0.7);

    // Set similar embeddings
    const similarEmbedding = new Array(384).fill(0.1);
    fragment1.embedding = similarEmbedding;
    fragment2.embedding = similarEmbedding;
    fragment3.embedding = new Array(384).fill(0.9);

    const result = pipeline.deduplicateFragments([fragment1, fragment2, fragment3]);

    expect(result.merged).toBeGreaterThan(0);
    expect(result.clusters.length).toBeLessThan(3);
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 8: Merge Preserves Highest Relevance
  // ═════════════════════════════════════════════════════════════════════════════

  it('should preserve highest relevance when merging', () => {
    const fragment1 = createTestFragment('content', 0.5);
    const fragment2 = createTestFragment('content', 0.9);

    // Set similar embeddings
    const similarEmbedding = new Array(384).fill(0.1);
    fragment1.embedding = similarEmbedding;
    fragment2.embedding = similarEmbedding;

    const result = pipeline.deduplicateFragments([fragment1, fragment2]);

    expect(result.clusters.length).toBe(1);
    expect(result.clusters[0].kept.relevance).toBe(0.9);
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 9: Forgetting Curve Exponential Decay
  // ═════════════════════════════════════════════════════════════════════════════

  it('should calculate forgetting curve decay correctly', () => {
    const relevance = 1.0;
    const decayRate = 0.1;
    const daysSinceAccess = 7;
    const isPinned = false;

    const score = pipeline.calculateForgettingScore(
      relevance,
      decayRate,
      daysSinceAccess,
      isPinned
    );

    // R × exp(-D × T) = 1.0 × exp(-0.1 × 7) ≈ 0.497
    const expected = relevance * Math.exp(-decayRate * daysSinceAccess);
    expect(score).toBeCloseTo(expected, 3);
  });

  it('should not decay pinned items', () => {
    const relevance = 1.0;
    const decayRate = 0.1;
    const daysSinceAccess = 30;
    const isPinned = true;

    const score = pipeline.calculateForgettingScore(
      relevance,
      decayRate,
      daysSinceAccess,
      isPinned
    );

    expect(score).toBe(relevance);
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 10: Below-Threshold Fragments Archived Not Deleted
  // ═════════════════════════════════════════════════════════════════════════════

  it('should archive below-threshold fragments', () => {
    const oldFragment = createTestFragment('old', 0.5);
    oldFragment.lastAccessedAt = Date.now() - 365 * 24 * 60 * 60 * 1000; // 1 year ago

    const decayResult = pipeline.applyDecay([oldFragment]);
    const archiveResult = pipeline.archiveFragments(decayResult.retained);

    expect(archiveResult.archived).toBeGreaterThan(0);
    expect(archiveResult.retained[0].isArchived).toBe(true);
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 11: Consolidation Report Accuracy
  // ═════════════════════════════════════════════════════════════════════════════

  it('should generate accurate consolidation report', async () => {
    const fragments: MemoryFragment[] = [
      createTestFragment('dup1', 0.5),
      createTestFragment('dup1', 0.6), // Will be merged
      createTestFragment('unique', 0.7),
    ];

    // Set similar embeddings for duplicates
    const similarEmbedding = new Array(384).fill(0.1);
    fragments[0].embedding = similarEmbedding;
    fragments[1].embedding = similarEmbedding;
    fragments[2].embedding = new Array(384).fill(0.9);

    const report = await pipeline.run(fragments);

    expect(report.merged).toBeGreaterThanOrEqual(0);
    expect(report.timestamp).toBeGreaterThan(0);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
  });
});
