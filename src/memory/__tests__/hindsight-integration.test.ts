// Memory-Hindsight Integration Tests
// K4-20: Verify Hindsight integration with Memory module

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentMemoryStore } from '../agent-memory.js';

describe('Memory Hindsight Integration', () => {
  let store: AgentMemoryStore;

  const baseMemory = {
    embedding: new Array(384).fill(0.1),
    agentsInvolved: ['test-agent'],
    relevanceScore: 0.8,
    isPinned: false,
    isSuppressed: false,
    tags: ['test'],
    outcome: 'unknown',
  };

  beforeEach(() => {
    store = new AgentMemoryStore({
      dbPath: ':memory:',
    });
  });

  describe('Memory Store Operations', () => {
    it('should store and retrieve episodic memory', () => {
      const memory = store.insertMemory({
        ...baseMemory,
        type: 'episodic' as const,
        content: 'Completed task successfully',
        projectId: 'test-project',
        outcome: 'success',
      });

      expect(memory.id).toBeDefined();
      expect(memory.content).toBe('Completed task successfully');

      const retrieved = store.getMemory(memory.id);
      expect(retrieved?.content).toBe('Completed task successfully');
      expect(retrieved?.type).toBe('episodic');
    });

    it('should store semantic memory', () => {
      const memory = store.insertMemory({
        ...baseMemory,
        type: 'semantic' as const,
        content: 'React hooks must be called in component body',
        outcome: 'unknown',
        confidence: 0.95,
      });

      expect(memory.type).toBe('semantic');
      expect(memory.content).toContain('React');
    });

    it('should store procedural memory', () => {
      const memory = store.insertMemory({
        ...baseMemory,
        type: 'procedural' as const,
        content: 'How to deploy: 1. Build 2. Test 3. Deploy',
        outcome: 'unknown',
        triggerPattern: 'deployment needed',
        steps: ['Build', 'Test', 'Deploy'],
      });

      expect(memory.type).toBe('procedural');
    });
  });

  describe('Memory Query Operations', () => {
    it('should query by type', () => {
      store.insertMemory({
        ...baseMemory,
        type: 'episodic',
        content: 'Episodic 1',
        outcome: 'success',
      });

      store.insertMemory({
        ...baseMemory,
        type: 'semantic',
        content: 'Semantic 1',
      });

      const episodic = store.queryByType('episodic');
      const semantic = store.queryByType('semantic');

      expect(episodic).toHaveLength(1);
      expect(semantic).toHaveLength(1);
    });

    it('should query by project', () => {
      store.insertMemory({
        ...baseMemory,
        type: 'episodic',
        content: 'Project A',
        projectId: 'project-a',
        outcome: 'success',
      });

      store.insertMemory({
        ...baseMemory,
        type: 'episodic',
        content: 'Project B',
        projectId: 'project-b',
        outcome: 'success',
      });

      const results = store.queryByProject('project-a');
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Project A');
    });
  });

  describe('Memory Updates', () => {
    it('should update memory content', () => {
      const memory = store.insertMemory({
        ...baseMemory,
        type: 'semantic',
        content: 'Original',
      });

      const updated = store.updateMemory(memory.id, {
        content: 'Updated',
        relevanceScore: 0.95,
      });

      expect(updated.content).toBe('Updated');
      expect(updated.relevanceScore).toBe(0.95);
    });

    it('should pin memories', () => {
      const memory = store.insertMemory({
        ...baseMemory,
        type: 'episodic',
        content: 'Important memory',
        outcome: 'success',
      });

      store.updateMemory(memory.id, { isPinned: true });

      const retrieved = store.getMemory(memory.id);
      expect(retrieved?.isPinned).toBe(true);
    });
  });

  describe('Memory Statistics', () => {
    it('should track stats by type', () => {
      store.insertMemory({ ...baseMemory, type: 'episodic', content: 'E1', outcome: 'success' });
      store.insertMemory({ ...baseMemory, type: 'semantic', content: 'S1', outcome: 'unknown' });
      store.insertMemory({ ...baseMemory, type: 'procedural', content: 'P1', outcome: 'unknown', triggerPattern: 't', steps: [] });

      const stats = store.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byType.episodic).toBe(1);
      expect(stats.byType.semantic).toBe(1);
      expect(stats.byType.procedural).toBe(1);
    });

    it('should track total count', () => {
      store.insertMemory({ ...baseMemory, type: 'episodic', content: 'A1', agentsInvolved: ['agent-a'], outcome: 'success' });
      store.insertMemory({ ...baseMemory, type: 'episodic', content: 'A2', agentsInvolved: ['agent-a'], outcome: 'success' });
      store.insertMemory({ ...baseMemory, type: 'semantic', content: 'B1', agentsInvolved: ['agent-b'], outcome: 'unknown' });

      const stats = store.getStats();

      expect(stats.total).toBe(3);
    });
  });

  describe('Memory Persistence', () => {
    it('should retrieve all memories', () => {
      for (let i = 0; i < 3; i++) {
        store.insertMemory({
          ...baseMemory,
          type: 'episodic',
          content: `Memory ${i}`,
          outcome: 'success',
        });
      }

      const all = store.getAllMemories();
      expect(all).toHaveLength(3);
    });

    it('should handle memory lifecycle', () => {
      // Create
      const memory = store.insertMemory({
        ...baseMemory,
        type: 'episodic',
        content: 'Lifecycle test',
        outcome: 'success',
      });

      // Read
      expect(store.getMemory(memory.id)).toBeDefined();

      // Update
      store.updateMemory(memory.id, { content: 'Updated' });
      expect(store.getMemory(memory.id)?.content).toBe('Updated');

      // Delete
      store.deleteMemory(memory.id);
      expect(store.getMemory(memory.id)).toBeUndefined();
    });
  });
});
