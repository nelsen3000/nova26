// Semantic Model Tests — R19-02

import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticModel, createSemanticModel } from '../semantic-model.js';
import type { CodeNode, CodeEdge } from '../types.js';

describe('SemanticModel', () => {
  let model: SemanticModel;

  beforeEach(() => {
    model = new SemanticModel();
  });

  describe('addNode() & getNode()', () => {
    it('should add and retrieve a node', () => {
      const node = model.addNode({
        type: 'function',
        name: 'calculateTotal',
        filePath: 'src/utils.ts',
        location: { line: 10, column: 0 },
        complexity: 5,
        changeFrequency: 3,
        testCoverage: 80,
        semanticTags: ['math', 'calculation'],
        dependents: [],
      });

      expect(node.id).toBeDefined();
      
      const retrieved = model.getNode(node.id);
      expect(retrieved?.name).toBe('calculateTotal');
    });

    it('should generate unique IDs', () => {
      const node1 = model.addNode({
        type: 'function',
        name: 'func1',
        filePath: 'src/a.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      const node2 = model.addNode({
        type: 'function',
        name: 'func2',
        filePath: 'src/b.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      expect(node1.id).not.toBe(node2.id);
    });
  });

  describe('removeNode()', () => {
    it('should remove a node', () => {
      const node = model.addNode({
        type: 'function',
        name: 'temp',
        filePath: 'src/temp.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      const removed = model.removeNode(node.id);
      expect(removed).toBe(true);
      expect(model.getNode(node.id)).toBeUndefined();
    });

    it('should remove connected edges', () => {
      const node1 = model.addNode({
        type: 'function',
        name: 'caller',
        filePath: 'src/a.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      const node2 = model.addNode({
        type: 'function',
        name: 'callee',
        filePath: 'src/b.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      model.addEdge({ fromId: node1.id, toId: node2.id, type: 'calls' });
      
      const edgesBefore = model.getEdgesFrom(node1.id);
      expect(edgesBefore).toHaveLength(1);

      model.removeNode(node2.id);
      
      const edgesAfter = model.getEdgesFrom(node1.id);
      expect(edgesAfter).toHaveLength(0);
    });
  });

  describe('addEdge() & query methods', () => {
    it('should add an edge with calculated weight', () => {
      const node1 = model.addNode({
        type: 'function',
        name: 'main',
        filePath: 'src/main.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      const node2 = model.addNode({
        type: 'function',
        name: 'helper',
        filePath: 'src/helper.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      const edge = model.addEdge({
        fromId: node1.id,
        toId: node2.id,
        type: 'calls',
      });

      expect(edge.weight).toBeGreaterThan(0);
    });

    it('should get edges from a node', () => {
      const node1 = model.addNode({
        type: 'function',
        name: 'main',
        filePath: 'src/main.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      const node2 = model.addNode({
        type: 'function',
        name: 'helper1',
        filePath: 'src/helper.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      const node3 = model.addNode({
        type: 'function',
        name: 'helper2',
        filePath: 'src/helper.ts',
        location: { line: 10, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      model.addEdge({ fromId: node1.id, toId: node2.id, type: 'calls' });
      model.addEdge({ fromId: node1.id, toId: node3.id, type: 'calls' });

      const edges = model.getEdgesFrom(node1.id);
      expect(edges).toHaveLength(2);
    });
  });

  describe('queryWhatDependsOn()', () => {
    it('should find direct dependents', () => {
      const node1 = model.addNode({
        type: 'function',
        name: 'base',
        filePath: 'src/base.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      const node2 = model.addNode({
        type: 'function',
        name: 'user',
        filePath: 'src/user.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      model.addEdge({ fromId: node2.id, toId: node1.id, type: 'calls' });

      const dependents = model.queryWhatDependsOn(node1.id);
      expect(dependents).toHaveLength(1);
      expect(dependents[0].name).toBe('user');
    });

    it('should find transitive dependents', () => {
      const node1 = model.addNode({
        type: 'function',
        name: 'base',
        filePath: 'src/base.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      const node2 = model.addNode({
        type: 'function',
        name: 'middle',
        filePath: 'src/middle.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      const node3 = model.addNode({
        type: 'function',
        name: 'top',
        filePath: 'src/top.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      model.addEdge({ fromId: node2.id, toId: node1.id, type: 'calls' });
      model.addEdge({ fromId: node3.id, toId: node2.id, type: 'calls' });

      const dependents = model.queryWhatDependsOn(node1.id);
      expect(dependents).toHaveLength(2);
    });
  });

  describe('queryImpactRadius()', () => {
    it('should return affected nodes within max depth', () => {
      const node1 = model.addNode({
        type: 'function',
        name: 'base',
        filePath: 'src/base.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      const node2 = model.addNode({
        type: 'function',
        name: 'level1',
        filePath: 'src/l1.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      const node3 = model.addNode({
        type: 'function',
        name: 'level2',
        filePath: 'src/l2.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      model.addEdge({ fromId: node2.id, toId: node1.id, type: 'calls' });
      model.addEdge({ fromId: node3.id, toId: node2.id, type: 'calls' });

      const result = model.queryImpactRadius(node1.id, 2);
      expect(result.nodes).toHaveLength(2);
      expect(result.depth).toBe(2);
    });

    it('should respect max depth', () => {
      const nodes: CodeNode[] = [];
      for (let i = 0; i < 5; i++) {
        const node = model.addNode({
          type: 'function',
          name: `node${i}`,
          filePath: `src/${i}.ts`,
          location: { line: 1, column: 0 },
          complexity: 1,
          changeFrequency: 0,
          testCoverage: 0,
          semanticTags: [],
          dependents: [],
        });
        nodes.push(node);
        
        if (i > 0) {
          model.addEdge({ fromId: node.id, toId: nodes[i - 1].id, type: 'calls' });
        }
      }

      const result = model.queryImpactRadius(nodes[0].id, 2);
      expect(result.depth).toBeLessThanOrEqual(2);
    });
  });

  describe('findBySemanticTag()', () => {
    it('should find nodes by tag', () => {
      model.addNode({
        type: 'function',
        name: 'authLogin',
        filePath: 'src/auth.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: ['auth', 'security'],
        dependents: [],
      });

      model.addNode({
        type: 'function',
        name: 'authLogout',
        filePath: 'src/auth.ts',
        location: { line: 10, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: ['auth'],
        dependents: [],
      });

      const authNodes = model.findBySemanticTag('auth');
      expect(authNodes).toHaveLength(2);
    });
  });

  describe('detectCircularDependencies()', () => {
    it('should detect circular dependencies', () => {
      const node1 = model.addNode({
        type: 'function',
        name: 'a',
        filePath: 'src/a.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      const node2 = model.addNode({
        type: 'function',
        name: 'b',
        filePath: 'src/b.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      const node3 = model.addNode({
        type: 'function',
        name: 'c',
        filePath: 'src/c.ts',
        location: { line: 1, column: 0 },
        complexity: 1,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      // A -> B -> C -> A (circular)
      model.addEdge({ fromId: node1.id, toId: node2.id, type: 'calls' });
      model.addEdge({ fromId: node2.id, toId: node3.id, type: 'calls' });
      model.addEdge({ fromId: node3.id, toId: node1.id, type: 'calls' });

      const cycles = model.detectCircularDependencies();
      expect(cycles.length).toBeGreaterThan(0);
    });
  });

  describe('getGraphStats()', () => {
    it('should return graph statistics', () => {
      model.addNode({
        type: 'function',
        name: 'func1',
        filePath: 'src/a.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      model.addNode({
        type: 'function',
        name: 'func2',
        filePath: 'src/b.ts',
        location: { line: 1, column: 0 },
        complexity: 10,
        changeFrequency: 0,
        testCoverage: 0,
        semanticTags: [],
        dependents: [],
      });

      const stats = model.getGraphStats();
      expect(stats.nodeCount).toBe(2);
      expect(stats.avgComplexity).toBe(7.5);
    });
  });

  describe('createSemanticModel()', () => {
    it('should create a model with default config', () => {
      const model = createSemanticModel();
      expect(model).toBeInstanceOf(SemanticModel);
    });

    it('should create a model with custom config', () => {
      const model = createSemanticModel({
        analysisDepth: 'deep',
        cacheLocation: '/custom/cache',
      });
      expect(model).toBeInstanceOf(SemanticModel);
    });
  });
});
