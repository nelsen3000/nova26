// Hindsight Storage Adapter Tests - Task K3-02
// Spec: .kiro/specs/hindsight-persistent-memory/tasks.md

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { MemoryFragment, MemoryFragmentInput } from './types.js';
import { createMemoryFragment } from './schemas.js';
import { MemoryStorageAdapter } from './memory-adapter.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

function createTestFragment(
  content: string,
  type: MemoryFragment['type'],
  agentId: string = 'agent1',
  projectId: string = 'project1'
): MemoryFragment {
  const input: MemoryFragmentInput = {
    content,
    type,
    agentId,
    projectId,
  };
  return createMemoryFragment(input, new Array(384).fill(Math.random()));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property 3: Export/Import Round-Trip
// ═══════════════════════════════════════════════════════════════════════════════

describe('MemoryStorageAdapter', () => {
  let adapter: MemoryStorageAdapter;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    await adapter.initialize();
  });

  it('should export and import round-trip', async () => {
    // Create test fragments
    const fragments: MemoryFragment[] = [
      createTestFragment('content1', 'episodic'),
      createTestFragment('content2', 'procedural'),
      createTestFragment('content3', 'semantic'),
    ];

    // Write fragments
    await adapter.bulkWrite(fragments);

    // Export all
    const exported = await adapter.exportAll();
    expect(exported.length).toBe(3);

    // Create fresh adapter and import
    const freshAdapter = new MemoryStorageAdapter();
    await freshAdapter.initialize();
    await freshAdapter.importAll(exported);

    // Verify import
    const imported = await freshAdapter.exportAll();
    expect(imported.length).toBe(3);
    expect(imported.map(f => f.content).sort()).toEqual(
      fragments.map(f => f.content).sort()
    );
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 5: Search Filter Correctness
  // ═════════════════════════════════════════════════════════════════════════════

  it('should filter by namespace', async () => {
    const fragment1 = createMemoryFragment(
      { content: 'test1', type: 'episodic', agentId: 'agent1', projectId: 'project1' },
      new Array(384).fill(0)
    );
    const fragment2 = createMemoryFragment(
      { content: 'test2', type: 'episodic', agentId: 'agent2', projectId: 'project2' },
      new Array(384).fill(0)
    );

    await adapter.bulkWrite([fragment1, fragment2]);

    const results = await adapter.query({ namespace: 'project1:agent1' });
    expect(results.length).toBe(1);
    expect(results[0].content).toBe('test1');
  });

  it('should filter by type', async () => {
    const episodic = createTestFragment('episodic content', 'episodic');
    const procedural = createTestFragment('procedural content', 'procedural');
    const semantic = createTestFragment('semantic content', 'semantic');

    await adapter.bulkWrite([episodic, procedural, semantic]);

    const results = await adapter.query({ type: 'procedural' });
    expect(results.length).toBe(1);
    expect(results[0].type).toBe('procedural');
  });

  it('should filter by relevance range', async () => {
    const lowRelevance = createMemoryFragment(
      { content: 'low', type: 'episodic', agentId: 'agent1', projectId: 'project1', relevance: 0.2 },
      new Array(384).fill(0)
    );
    const highRelevance = createMemoryFragment(
      { content: 'high', type: 'episodic', agentId: 'agent1', projectId: 'project1', relevance: 0.9 },
      new Array(384).fill(0)
    );

    await adapter.bulkWrite([lowRelevance, highRelevance]);

    const results = await adapter.query({ minRelevance: 0.5 });
    expect(results.length).toBe(1);
    expect(results[0].content).toBe('high');
  });

  it('should filter by tags (any match)', async () => {
    const fragment1 = createMemoryFragment(
      { content: 'test1', type: 'episodic', agentId: 'agent1', projectId: 'project1', tags: ['a', 'b'] },
      new Array(384).fill(0)
    );
    const fragment2 = createMemoryFragment(
      { content: 'test2', type: 'episodic', agentId: 'agent1', projectId: 'project1', tags: ['b', 'c'] },
      new Array(384).fill(0)
    );
    const fragment3 = createMemoryFragment(
      { content: 'test3', type: 'episodic', agentId: 'agent1', projectId: 'project1', tags: ['c', 'd'] },
      new Array(384).fill(0)
    );

    await adapter.bulkWrite([fragment1, fragment2, fragment3]);

    // Any tag match (default)
    const anyResults = await adapter.query({ tags: ['a', 'c'] });
    expect(anyResults.length).toBe(3);

    // All tags must match
    const allResults = await adapter.query({ tags: ['a', 'b'], tagsAll: true });
    expect(allResults.length).toBe(1);
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Vector Search
  // ═════════════════════════════════════════════════════════════════════════════

  it('should search by vector similarity', async () => {
    // Create fragments with different embeddings
    const queryVector = new Array(384).fill(0);
    queryVector[0] = 1;

    const similarVector = new Array(384).fill(0);
    similarVector[0] = 0.9;

    const differentVector = new Array(384).fill(0);
    differentVector[1] = 1;

    const similarFragment = createMemoryFragment(
      { content: 'similar', type: 'episodic', agentId: 'agent1', projectId: 'project1' },
      similarVector
    );
    const differentFragment = createMemoryFragment(
      { content: 'different', type: 'episodic', agentId: 'agent1', projectId: 'project1' },
      differentVector
    );

    await adapter.bulkWrite([similarFragment, differentFragment]);

    const results = await adapter.searchByVector(queryVector, 2);
    expect(results.length).toBe(2);
    expect(results[0].fragment.content).toBe('similar'); // More similar should be first
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // CRUD Operations
  // ═════════════════════════════════════════════════════════════════════════════

  it('should write and read fragments', async () => {
    const fragment = createTestFragment('test', 'episodic');

    await adapter.write(fragment);
    const read = await adapter.read(fragment.id);

    expect(read).not.toBeNull();
    expect(read!.content).toBe('test');
  });

  it('should return null for non-existent fragments', async () => {
    const read = await adapter.read('non-existent-id');
    expect(read).toBeNull();
  });

  it('should delete fragments', async () => {
    const fragment = createTestFragment('to-delete', 'episodic');

    await adapter.write(fragment);
    const deleted = await adapter.delete(fragment.id);

    expect(deleted).toBe(true);
    expect(await adapter.read(fragment.id)).toBeNull();
  });

  it('should return false when deleting non-existent fragment', async () => {
    const deleted = await adapter.delete('non-existent');
    expect(deleted).toBe(false);
  });

  it('should bulk read fragments', async () => {
    const fragment1 = createTestFragment('content1', 'episodic');
    const fragment2 = createTestFragment('content2', 'episodic');
    const fragment3 = createTestFragment('content3', 'episodic');

    await adapter.bulkWrite([fragment1, fragment2, fragment3]);

    const read = await adapter.bulkRead([fragment1.id, fragment3.id]);
    expect(read.length).toBe(2);
    expect(read.map(f => f.content).sort()).toEqual(['content1', 'content3']);
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Stats and Health
  // ═════════════════════════════════════════════════════════════════════════════

  it('should report stats', async () => {
    const stats1 = await adapter.getStats();
    expect(stats1.totalFragments).toBe(0);

    await adapter.write(createTestFragment('test', 'episodic'));

    const stats2 = await adapter.getStats();
    expect(stats2.totalFragments).toBe(1);
    expect(stats2.namespaces.length).toBe(1);
  });

  it('should report availability', async () => {
    expect(await adapter.isAvailable()).toBe(true);

    await adapter.close();
    expect(await adapter.isAvailable()).toBe(false);
  });

  it('should count fragments with filters', async () => {
    await adapter.bulkWrite([
      createTestFragment('content1', 'episodic'),
      createTestFragment('content2', 'procedural'),
      createTestFragment('content3', 'semantic'),
    ]);

    const total = await adapter.count();
    expect(total).toBe(3);

    const episodic = await adapter.count({ type: 'episodic' });
    expect(episodic).toBe(1);
  });
});
