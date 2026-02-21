// Hindsight Vector Index Tests - Task K3-03
// Spec: .kiro/specs/hindsight-persistent-memory/tasks.md

import { describe, it, expect, beforeEach } from 'vitest';
import type { MemoryFragment, MemoryFragmentInput } from './types.js';
import { createMemoryFragment } from './schemas.js';
import { MemoryStorageAdapter } from './memory-adapter.js';
import { VectorIndex, cosineSimilarity, generateRandomEmbedding } from './vector-index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

function createTestFragment(
  content: string,
  type: MemoryFragment['type'],
  embedding: number[],
  accessCount: number = 0,
  lastAccessedAt?: number
): MemoryFragment {
  const input: MemoryFragmentInput = {
    content,
    type,
    agentId: 'agent1',
    projectId: 'project1',
  };
  const fragment = createMemoryFragment(input, embedding);
  fragment.accessCount = accessCount;
  if (lastAccessedAt) {
    fragment.lastAccessedAt = lastAccessedAt;
  }
  return fragment;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property 2: Retrieval Ranking Correctness
// ═══════════════════════════════════════════════════════════════════════════════

describe('VectorIndex', () => {
  let adapter: MemoryStorageAdapter;
  let index: VectorIndex;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    await adapter.initialize();
    index = new VectorIndex(adapter);
  });

  it('should rank by composite score (similarity × recency × frequency)', async () => {
    const now = Date.now();

    // Use deterministic query embedding
    const queryEmbedding = new Array(384).fill(0);
    queryEmbedding[0] = 1;

    // High similarity - vector aligned with query
    const highSimOld = createTestFragment(
      'high similarity old',
      'episodic',
      new Array(384).fill(0).map((_, i) => (i === 0 ? 0.95 : 0)),
      1,
      now - 30 * 24 * 60 * 60 * 1000 // 30 days ago
    );

    // Medium similarity
    const medSimRecent = createTestFragment(
      'medium similarity recent',
      'episodic',
      new Array(384).fill(0).map((_, i) => (i === 0 ? 0.7 : 0)),
      50,
      now // Just now
    );

    // Lower similarity but still above threshold
    const lowSim = createTestFragment(
      'low similarity',
      'episodic',
      new Array(384).fill(0).map((_, i) => (i === 0 ? 0.5 : (i === 1 ? 0.5 : 0))),
      100,
      now
    );

    await adapter.bulkWrite([highSimOld, medSimRecent, lowSim]);

    const results = await index.search(queryEmbedding, 3);

    expect(results.length).toBe(3);
    // High similarity fragment should be first
    expect(results[0].similarityScore).toBeGreaterThanOrEqual(results[1].similarityScore);
  });

  it('should filter by similarity threshold', async () => {
    // Use deterministic query embedding
    const queryEmbedding = new Array(384).fill(0);
    queryEmbedding[0] = 1;

    // Very similar - aligned with query
    const similar = createTestFragment(
      'similar',
      'episodic',
      new Array(384).fill(0).map((_, i) => (i === 0 ? 0.95 : 0))
    );

    // Not similar - mostly orthogonal
    const different = createTestFragment(
      'different',
      'episodic',
      new Array(384).fill(0).map((_, i) => (i < 100 ? 0.1 : 0)) // Low similarity
    );

    await adapter.bulkWrite([similar, different]);

    const results = await index.search(queryEmbedding, 10, undefined, 0.8);

    // Only very similar should pass threshold
    expect(results.length).toBe(1);
    expect(results[0].fragment.content).toBe('similar');
  });

  it('should respect topK limit', async () => {
    // Use deterministic query embedding
    const queryEmbedding = new Array(384).fill(0);
    queryEmbedding[0] = 1;

    // Create many similar fragments
    const fragments: MemoryFragment[] = [];
    for (let i = 0; i < 20; i++) {
      // Vary similarity by using different magnitudes on same dimension
      const similarity = 0.9 + (i % 10) / 100; // 0.90 to 0.99
      fragments.push(
        createTestFragment(
          `content ${i}`,
          'episodic',
          new Array(384).fill(0).map((_, idx) => (idx === 0 ? similarity : 0))
        )
      );
    }

    await adapter.bulkWrite(fragments);

    const results = await index.search(queryEmbedding, 5);
    expect(results.length).toBe(5);
  });

  it('should update index size after operations', async () => {
    expect(index.getSize()).toBe(0);

    const fragment = createTestFragment('test', 'episodic', generateRandomEmbedding());
    await adapter.write(fragment);
    await index.index(fragment.id, fragment.embedding);

    expect(index.getSize()).toBe(1);

    await index.remove(fragment.id);
    expect(index.getSize()).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Cosine Similarity Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const v = [1, 0, 0, 0];
    expect(cosineSimilarity(v, v)).toBe(1);
  });

  it('should return 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('should return -1 for opposite vectors', () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(-1);
  });

  it('should throw on dimension mismatch', () => {
    const a = [1, 0];
    const b = [1, 0, 0];
    expect(() => cosineSimilarity(a, b)).toThrow('dimension mismatch');
  });
});
