// Graph Memory Core Tests — KIMI-VAULT-01

import { describe, it, expect, beforeEach } from 'vitest';
import { GraphMemory, getGraphMemory, resetGraphMemory } from './graph-memory.js';

describe('GraphMemory', () => {
  let memory: GraphMemory;

  beforeEach(() => {
    resetGraphMemory();
    memory = getGraphMemory('test-user');
    memory.clear();
  });

  // ============================================================================
  // Node Operations
  // ============================================================================

  describe('addNode()', () => {
    it('creates node with generated ID and timestamps', () => {
      const node = memory.addNode({
        type: 'Strategy',
        content: 'Test content',
        confidence: 0.9,
        helpfulCount: 0,
        userId: 'test-user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: ['test'],
      });

      expect(node.id).toBeDefined();
      expect(node.id.length).toBeGreaterThan(0);
      expect(node.createdAt).toBeDefined();
      expect(node.updatedAt).toBeDefined();
      expect(node.type).toBe('Strategy');
      expect(node.content).toBe('Test content');
    });

    it('throws if content is empty', () => {
      expect(() =>
        memory.addNode({
          type: 'Strategy',
          content: '',
          confidence: 0.9,
          helpfulCount: 0,
          userId: 'test-user',
          isGlobal: false,
          globalSuccessCount: 0,
          tags: [],
        })
      ).toThrow();
    });
  });

  describe('getNode()', () => {
    it('returns node when ID exists', () => {
      const node = memory.addNode({
        type: 'Pattern',
        content: 'Test',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const retrieved = memory.getNode(node.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(node.id);
    });

    it('returns undefined for unknown IDs', () => {
      const result = memory.getNode('non-existent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('updateNode()', () => {
    it('updates only specified fields', () => {
      const node = memory.addNode({
        type: 'Strategy',
        content: 'Original',
        confidence: 0.7,
        helpfulCount: 5,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: ['original'],
      });

      const updated = memory.updateNode(node.id, { content: 'Updated', confidence: 0.9 });
      
      expect(updated).toBeDefined();
      expect(updated?.content).toBe('Updated');
      expect(updated?.confidence).toBe(0.9);
      expect(updated?.helpfulCount).toBe(5);
      expect(updated?.type).toBe('Strategy');
    });

    it('updates updatedAt timestamp', () => {
      const node = memory.addNode({
        type: 'Strategy',
        content: 'Test',
        confidence: 0.7,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const originalUpdatedAt = node.updatedAt;
      
      // Small delay to ensure timestamp difference
      setTimeout(() => {
        const updated = memory.updateNode(node.id, { content: 'Updated' });
        expect(updated?.updatedAt).not.toBe(originalUpdatedAt);
      }, 10);
    });
  });

  describe('removeNode()', () => {
    it('removes node successfully', () => {
      const node = memory.addNode({
        type: 'Pattern',
        content: 'To be removed',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const removed = memory.removeNode(node.id);
      expect(removed).toBe(true);
      expect(memory.getNode(node.id)).toBeUndefined();
    });

    it('also removes all connected edges', () => {
      const node1 = memory.addNode({
        type: 'Strategy',
        content: 'Node 1',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const node2 = memory.addNode({
        type: 'Pattern',
        content: 'Node 2',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const edge = memory.addEdge({
        sourceId: node1.id,
        targetId: node2.id,
        relation: 'supports',
        strength: 0.9,
      });

      memory.removeNode(node1.id);
      
      expect(memory.getEdge(edge.id)).toBeUndefined();
      expect(memory.getEdgesFrom(node1.id)).toHaveLength(0);
    });
  });

  // ============================================================================
  // Edge Operations
  // ============================================================================

  describe('addEdge()', () => {
    it('creates directed edge between two nodes', () => {
      const node1 = memory.addNode({
        type: 'Strategy',
        content: 'Source',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const node2 = memory.addNode({
        type: 'Pattern',
        content: 'Target',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const edge = memory.addEdge({
        sourceId: node1.id,
        targetId: node2.id,
        relation: 'supports',
        strength: 0.9,
      });

      expect(edge.sourceId).toBe(node1.id);
      expect(edge.targetId).toBe(node2.id);
      expect(edge.relation).toBe('supports');
      expect(edge.strength).toBe(0.9);
    });

    it('throws if source node does not exist', () => {
      const node = memory.addNode({
        type: 'Pattern',
        content: 'Target',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      expect(() =>
        memory.addEdge({
          sourceId: 'non-existent',
          targetId: node.id,
          relation: 'supports',
          strength: 0.9,
        })
      ).toThrow();
    });

    it('throws if target node does not exist', () => {
      const node = memory.addNode({
        type: 'Strategy',
        content: 'Source',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      expect(() =>
        memory.addEdge({
          sourceId: node.id,
          targetId: 'non-existent',
          relation: 'supports',
          strength: 0.9,
        })
      ).toThrow();
    });
  });

  describe('removeEdge()', () => {
    it('removes only that edge, leaves nodes intact', () => {
      const node1 = memory.addNode({
        type: 'Strategy',
        content: 'Source',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const node2 = memory.addNode({
        type: 'Pattern',
        content: 'Target',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const edge = memory.addEdge({
        sourceId: node1.id,
        targetId: node2.id,
        relation: 'supports',
        strength: 0.9,
      });

      const removed = memory.removeEdge(edge.id);
      
      expect(removed).toBe(true);
      expect(memory.getEdge(edge.id)).toBeUndefined();
      expect(memory.getNode(node1.id)).toBeDefined();
      expect(memory.getNode(node2.id)).toBeDefined();
    });
  });

  describe('getEdgesFrom()', () => {
    it('returns all edges where sourceId matches', () => {
      const node1 = memory.addNode({
        type: 'Strategy',
        content: 'Source',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const node2 = memory.addNode({
        type: 'Pattern',
        content: 'Target 1',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const node3 = memory.addNode({
        type: 'Pattern',
        content: 'Target 2',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      memory.addEdge({
        sourceId: node1.id,
        targetId: node2.id,
        relation: 'supports',
        strength: 0.9,
      });

      memory.addEdge({
        sourceId: node1.id,
        targetId: node3.id,
        relation: 'refines',
        strength: 0.8,
      });

      const edges = memory.getEdgesFrom(node1.id);
      expect(edges).toHaveLength(2);
    });
  });

  describe('getEdgesTo()', () => {
    it('returns all edges where targetId matches', () => {
      const node1 = memory.addNode({
        type: 'Strategy',
        content: 'Source 1',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const node2 = memory.addNode({
        type: 'Strategy',
        content: 'Source 2',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const node3 = memory.addNode({
        type: 'Pattern',
        content: 'Target',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      memory.addEdge({
        sourceId: node1.id,
        targetId: node3.id,
        relation: 'supports',
        strength: 0.9,
      });

      memory.addEdge({
        sourceId: node2.id,
        targetId: node3.id,
        relation: 'refines',
        strength: 0.8,
      });

      const edges = memory.getEdgesTo(node3.id);
      expect(edges).toHaveLength(2);
    });
  });

  // ============================================================================
  // Queries
  // ============================================================================

  describe('getRelated()', () => {
    it('with no relation filter returns all adjacent nodes', () => {
      const node1 = memory.addNode({
        type: 'Strategy',
        content: 'Source',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const node2 = memory.addNode({
        type: 'Pattern',
        content: 'Target 1',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const node3 = memory.addNode({
        type: 'Pattern',
        content: 'Target 2',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      memory.addEdge({
        sourceId: node1.id,
        targetId: node2.id,
        relation: 'supports',
        strength: 0.9,
      });

      memory.addEdge({
        sourceId: node1.id,
        targetId: node3.id,
        relation: 'refines',
        strength: 0.8,
      });

      const related = memory.getRelated(node1.id);
      expect(related).toHaveLength(2);
    });

    it('with relation filter returns only matching-relation neighbors', () => {
      const node1 = memory.addNode({
        type: 'Strategy',
        content: 'Source',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const node2 = memory.addNode({
        type: 'Pattern',
        content: 'Target 1',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const node3 = memory.addNode({
        type: 'Pattern',
        content: 'Target 2',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      memory.addEdge({
        sourceId: node1.id,
        targetId: node2.id,
        relation: 'supports',
        strength: 0.9,
      });

      memory.addEdge({
        sourceId: node1.id,
        targetId: node3.id,
        relation: 'refines',
        strength: 0.8,
      });

      const related = memory.getRelated(node1.id, 'supports');
      expect(related).toHaveLength(1);
      expect(related[0].id).toBe(node2.id);
    });
  });

  describe('getByType()', () => {
    it("getByType('Strategy') returns only Strategy nodes", () => {
      memory.addNode({
        type: 'Strategy',
        content: 'Strategy 1',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      memory.addNode({
        type: 'Pattern',
        content: 'Pattern 1',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      memory.addNode({
        type: 'Strategy',
        content: 'Strategy 2',
        confidence: 0.9,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const strategies = memory.getByType('Strategy');
      expect(strategies).toHaveLength(2);
      expect(strategies.every(n => n.type === 'Strategy')).toBe(true);
    });
  });

  describe('getHighConfidence()', () => {
    it('getHighConfidence(0.9) returns only nodes with confidence >= 0.9', () => {
      memory.addNode({
        type: 'Strategy',
        content: 'High confidence',
        confidence: 0.95,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      memory.addNode({
        type: 'Pattern',
        content: 'Medium confidence',
        confidence: 0.85,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      memory.addNode({
        type: 'Strategy',
        content: 'Very high confidence',
        confidence: 0.99,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const highConf = memory.getHighConfidence(0.9);
      expect(highConf).toHaveLength(2);
      expect(highConf.every(n => n.confidence >= 0.9)).toBe(true);
    });
  });

  describe('getByTag()', () => {
    it('returns nodes that include the tag', () => {
      memory.addNode({
        type: 'Strategy',
        content: 'Auth pattern',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: ['auth', 'security'],
      });

      memory.addNode({
        type: 'Pattern',
        content: 'Validation pattern',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: ['validation'],
      });

      memory.addNode({
        type: 'Strategy',
        content: 'Another auth',
        confidence: 0.9,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: ['auth'],
      });

      const authNodes = memory.getByTag('auth');
      expect(authNodes).toHaveLength(2);
    });
  });

  describe('search()', () => {
    it('returns nodes whose content contains the string', () => {
      memory.addNode({
        type: 'Strategy',
        content: 'Use requireAuth() for all mutations',
        confidence: 0.9,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      memory.addNode({
        type: 'Pattern',
        content: 'Validate inputs with Zod',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      memory.addNode({
        type: 'Strategy',
        content: 'Use requireAuth in middleware',
        confidence: 0.85,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const results = memory.search('requireAuth');
      expect(results).toHaveLength(2);
    });
  });

  // ============================================================================
  // Traversal
  // ============================================================================

  describe('traverse()', () => {
    it('BFS at depth 1 returns direct neighbors only', () => {
      const node1 = memory.addNode({
        type: 'Strategy',
        content: 'Start',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const node2 = memory.addNode({
        type: 'Pattern',
        content: 'Direct neighbor',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const node3 = memory.addNode({
        type: 'Pattern',
        content: 'Two hops away',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      memory.addEdge({
        sourceId: node1.id,
        targetId: node2.id,
        relation: 'supports',
        strength: 0.9,
      });

      memory.addEdge({
        sourceId: node2.id,
        targetId: node3.id,
        relation: 'supports',
        strength: 0.9,
      });

      const result = memory.traverse(node1.id, 1);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(node2.id);
    });

    it('BFS at depth 2 returns neighbors-of-neighbors', () => {
      const node1 = memory.addNode({
        type: 'Strategy',
        content: 'Start',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const node2 = memory.addNode({
        type: 'Pattern',
        content: 'Direct neighbor',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const node3 = memory.addNode({
        type: 'Pattern',
        content: 'Two hops away',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      memory.addEdge({
        sourceId: node1.id,
        targetId: node2.id,
        relation: 'supports',
        strength: 0.9,
      });

      memory.addEdge({
        sourceId: node2.id,
        targetId: node3.id,
        relation: 'supports',
        strength: 0.9,
      });

      const result = memory.traverse(node1.id, 2);
      expect(result).toHaveLength(2);
    });

    it('with relation filter only follows matching edges', () => {
      const node1 = memory.addNode({
        type: 'Strategy',
        content: 'Start',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const node2 = memory.addNode({
        type: 'Pattern',
        content: 'Supports target',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const node3 = memory.addNode({
        type: 'Pattern',
        content: 'Refines target',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      memory.addEdge({
        sourceId: node1.id,
        targetId: node2.id,
        relation: 'supports',
        strength: 0.9,
      });

      memory.addEdge({
        sourceId: node1.id,
        targetId: node3.id,
        relation: 'refines',
        strength: 0.9,
      });

      const result = memory.traverse(node1.id, 1, 'supports');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(node2.id);
    });
  });

  // ============================================================================
  // Confidence Management
  // ============================================================================

  describe('reinforce()', () => {
    it('increases confidence by default delta, caps at 1.0', () => {
      const node = memory.addNode({
        type: 'Strategy',
        content: 'Test',
        confidence: 0.85,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      memory.reinforce(node.id);
      let updated = memory.getNode(node.id);
      expect(updated?.confidence).toBe(0.9);

      memory.reinforce(node.id);
      updated = memory.getNode(node.id);
      expect(updated?.confidence).toBeCloseTo(0.95, 10);

      memory.reinforce(node.id);
      memory.reinforce(node.id);
      memory.reinforce(node.id);
      updated = memory.getNode(node.id);
      expect(updated?.confidence).toBe(1.0);
    });
  });

  describe('demote()', () => {
    it('decreases confidence by default delta, floors at 0.0', () => {
      const node = memory.addNode({
        type: 'Strategy',
        content: 'Test',
        confidence: 0.25,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      memory.demote(node.id);
      let updated = memory.getNode(node.id);
      expect(updated?.confidence).toBe(0.15);

      memory.demote(node.id);
      updated = memory.getNode(node.id);
      expect(updated?.confidence).toBeCloseTo(0.05, 10);

      memory.demote(node.id);
      updated = memory.getNode(node.id);
      expect(updated?.confidence).toBe(0);
    });
  });

  describe('incrementHelpful()', () => {
    it('increments helpfulCount', () => {
      const node = memory.addNode({
        type: 'Strategy',
        content: 'Test',
        confidence: 0.8,
        helpfulCount: 5,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      memory.incrementHelpful(node.id);
      const updated = memory.getNode(node.id);
      expect(updated?.helpfulCount).toBe(6);
    });
  });

  // ============================================================================
  // Stats
  // ============================================================================

  describe('stats()', () => {
    it('returns correct counts and average confidence', () => {
      memory.addNode({
        type: 'Strategy',
        content: 'Test 1',
        confidence: 0.8,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      memory.addNode({
        type: 'Pattern',
        content: 'Test 2',
        confidence: 0.9,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      memory.addNode({
        type: 'Strategy',
        content: 'Test 3',
        confidence: 1.0,
        helpfulCount: 0,
        userId: 'user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: [],
      });

      const stats = memory.stats();
      expect(stats.nodes).toBe(3);
      expect(stats.byType.Strategy).toBe(2);
      expect(stats.byType.Pattern).toBe(1);
      expect(stats.avgConfidence).toBeCloseTo(0.9, 1);
    });
  });

  // ============================================================================
  // Persistence
  // ============================================================================

  describe('persist() and load()', () => {
    it('round-trip: node added before persist is available after load', async () => {
      const node = memory.addNode({
        type: 'Strategy',
        content: 'Persist test',
        confidence: 0.9,
        helpfulCount: 0,
        userId: 'test-user',
        isGlobal: false,
        globalSuccessCount: 0,
        tags: ['test'],
      });

      await memory.persist();

      // Create new memory instance and load
      resetGraphMemory();
      const newMemory = getGraphMemory('test-user');
      await newMemory.load();

      const loaded = newMemory.getNode(node.id);
      expect(loaded).toBeDefined();
      expect(loaded?.content).toBe('Persist test');
    });
  });

  // ============================================================================
  // Singleton Factory
  // ============================================================================

  describe('getGraphMemory()', () => {
    it('returns singleton instance per user', () => {
      const instance1 = getGraphMemory('user1');
      const instance2 = getGraphMemory('user1');
      const instance3 = getGraphMemory('user2');

      expect(instance1).toBe(instance2);
      expect(instance1).not.toBe(instance3);
    });
  });
});
