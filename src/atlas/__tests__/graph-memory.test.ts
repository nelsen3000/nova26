// Graph Memory Tests — R19-02

import { describe, it, expect, beforeEach } from 'vitest';
import { GraphMemory, createGraphMemory } from '../graph-memory.js';
import type { CodeNode } from '../types.js';

describe('GraphMemory', () => {
  let memory: GraphMemory;

  beforeEach(() => {
    memory = new GraphMemory();
  });

  describe('writeNode() & readNode()', () => {
    it('should write and read a node', () => {
      const node: CodeNode = {
        id: '1',
        type: 'function',
        name: 'test',
        filePath: 'src/test.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      };

      memory.writeNode(node);
      const retrieved = memory.readNode('1');

      expect(retrieved).toEqual(node);
    });

    it('should increment pending writes', () => {
      const node: CodeNode = {
        id: '1',
        type: 'function',
        name: 'test',
        filePath: 'src/test.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      };

      memory.writeNode(node);
      const status = memory.getSyncStatus();

      expect(status.pendingWrites).toBe(1);
    });
  });

  describe('writeNodes()', () => {
    it('should write multiple nodes', () => {
      const nodes: CodeNode[] = [
        {
          id: '1',
          type: 'function',
          name: 'a',
          filePath: 'src/a.ts',
          location: { line: 1, column: 0 },
          complexity: 5,
          changeFrequency: 0,
          testCoverage: 80,
          semanticTags: [],
          dependents: [],
        },
        {
          id: '2',
          type: 'function',
          name: 'b',
          filePath: 'src/b.ts',
          location: { line: 1, column: 0 },
          complexity: 3,
          changeFrequency: 0,
          testCoverage: 60,
          semanticTags: [],
          dependents: [],
        },
      ];

      memory.writeNodes(nodes);
      const all = memory.readAllNodes();

      expect(all).toHaveLength(2);
    });
  });

  describe('deleteNode()', () => {
    it('should delete a node', () => {
      const node: CodeNode = {
        id: '1',
        type: 'function',
        name: 'test',
        filePath: 'src/test.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      };

      memory.writeNode(node);
      const deleted = memory.deleteNode('1');

      expect(deleted).toBe(true);
      expect(memory.readNode('1')).toBeUndefined();
    });

    it('should return false for non-existent node', () => {
      const deleted = memory.deleteNode('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('sync operations', () => {
    it('should sync to remote', async () => {
      const node: CodeNode = {
        id: '1',
        type: 'function',
        name: 'test',
        filePath: 'src/test.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      };

      memory.writeNode(node);
      const result = await memory.syncToRemote();

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);
    });

    it('should sync from remote', async () => {
      const result = await memory.syncFromRemote();
      expect(result.success).toBe(true);
    });

    it('should do bidirectional sync', async () => {
      const result = await memory.bidirectionalSync();
      expect(result.success).toBe(true);
    });
  });

  describe('detectConflicts()', () => {
    it('should detect diverged nodes', () => {
      const localNode: CodeNode = {
        id: '1',
        type: 'function',
        name: 'test',
        filePath: 'src/test.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 5, // Changed
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      };

      const remoteNode: CodeNode = {
        id: '1',
        type: 'function',
        name: 'test',
        filePath: 'src/test.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 3, // Different
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      };

      memory.writeNode(localNode);
      const remote = new Map([['1', remoteNode]]);
      const conflicts = memory.detectConflicts(remote);

      expect(conflicts).toHaveLength(1);
    });

    it('should return empty when no conflicts', () => {
      const node: CodeNode = {
        id: '1',
        type: 'function',
        name: 'test',
        filePath: 'src/test.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      };

      memory.writeNode(node);
      const remote = new Map([['1', node]]);
      const conflicts = memory.detectConflicts(remote);

      expect(conflicts).toHaveLength(0);
    });
  });

  describe('resolveConflict()', () => {
    it('should resolve using local', () => {
      const local: CodeNode = {
        id: '1',
        type: 'function',
        name: 'local',
        filePath: 'src/test.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      };

      const remote: CodeNode = {
        id: '1',
        type: 'function',
        name: 'remote',
        filePath: 'src/test.ts',
        location: { line: 1, column: 0 },
        complexity: 3,
        changeFrequency: 0,
        testCoverage: 60,
        semanticTags: [],
        dependents: [],
      };

      const resolved = memory.resolveConflict({ local, remote }, 'local');
      expect(resolved.name).toBe('local');
    });

    it('should resolve using remote', () => {
      const local: CodeNode = {
        id: '1',
        type: 'function',
        name: 'local',
        filePath: 'src/test.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      };

      const remote: CodeNode = {
        id: '1',
        type: 'function',
        name: 'remote',
        filePath: 'src/test.ts',
        location: { line: 1, column: 0 },
        complexity: 3,
        changeFrequency: 0,
        testCoverage: 60,
        semanticTags: [],
        dependents: [],
      };

      const resolved = memory.resolveConflict({ local, remote }, 'remote');
      expect(resolved.name).toBe('remote');
    });

    it('should merge nodes', () => {
      const local: CodeNode = {
        id: '1',
        type: 'function',
        name: 'test',
        filePath: 'src/test.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 80,
        semanticTags: ['a'],
        dependents: [],
      };

      const remote: CodeNode = {
        id: '1',
        type: 'function',
        name: 'test',
        filePath: 'src/test.ts',
        location: { line: 1, column: 0 },
        complexity: 3,
        changeFrequency: 0,
        testCoverage: 60,
        semanticTags: ['b'],
        dependents: [],
      };

      const resolved = memory.resolveConflict({ local, remote }, 'merge');
      expect(resolved.complexity).toBe(5); // max
      expect(resolved.testCoverage).toBe(80); // max
      expect(resolved.semanticTags).toContain('a');
      expect(resolved.semanticTags).toContain('b');
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      const node: CodeNode = {
        id: '1',
        type: 'function',
        name: 'test',
        filePath: 'src/test.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      };

      memory.writeNode(node);
      memory.clearCache();

      expect(memory.readAllNodes()).toHaveLength(0);
    });

    it('should get cache size', () => {
      const node: CodeNode = {
        id: '1',
        type: 'function',
        name: 'test',
        filePath: 'src/test.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      };

      memory.writeNode(node);
      const size = memory.getCacheSize();

      expect(size.nodes).toBe(1);
    });
  });

  describe('isStale()', () => {
    it('should be stale when never synced', () => {
      expect(memory.isStale()).toBe(true);
    });
  });

  describe('export/import', () => {
    it('should export to JSON', () => {
      const node: CodeNode = {
        id: '1',
        type: 'function',
        name: 'test',
        filePath: 'src/test.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      };

      memory.writeNode(node);
      const json = memory.exportToJSON();

      expect(json).toContain('test');
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should import from JSON', () => {
      const node: CodeNode = {
        id: '1',
        type: 'function',
        name: 'test',
        filePath: 'src/test.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      };

      memory.writeNode(node);
      const json = memory.exportToJSON();

      memory.clearCache();
      const imported = memory.importFromJSON(json);

      expect(imported).toBe(true);
      expect(memory.readAllNodes()).toHaveLength(1);
    });

    it('should return false for invalid JSON', () => {
      const result = memory.importFromJSON('invalid');
      expect(result).toBe(false);
    });
  });

  describe('createGraphMemory()', () => {
    it('should create a graph memory instance', () => {
      const memory = createGraphMemory();
      expect(memory).toBeInstanceOf(GraphMemory);
    });
  });
});
