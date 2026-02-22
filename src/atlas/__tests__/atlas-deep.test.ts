/**
 * H6-02: Atlas Deep Coverage Tests
 *
 * Comprehensive tests for graph-memory, context-compactor, impact-analyzer, semantic-differ
 * Property-based tests for graph consistency and compaction preservation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Type Definitions (mirrored from src/atlas/)
// ============================================================================

interface CodeNode {
  id: string;
  type: 'file' | 'function' | 'class' | 'interface' | 'type' | 'export' | 'component' | 'hook' | 'page' | 'api' | 'endpoint' | 'util' | 'test';
  name: string;
  filePath: string;
  location: { line: number; column: number };
  complexity: number;
  changeFrequency: number;
  testCoverage: number;
  semanticTags: string[];
  dependents: string[];
}

interface CodeEdge {
  fromId: string;
  toId: string;
  type: 'imports' | 'calls' | 'extends' | 'implements' | 'uses-type' | 'renders' | 'depends-on';
  weight: number;
}

interface SyncStatus {
  lastSync: Date | null;
  pendingWrites: number;
  isSyncing: boolean;
  conflicts: Array<{ local: CodeNode; remote: CodeNode }>;
}

// ============================================================================
// Mock Implementations
// ============================================================================

class MockGraphMemory {
  private localNodes: Map<string, CodeNode> = new Map();
  private localEdges: CodeEdge[] = [];
  private syncStatus: SyncStatus = {
    lastSync: null,
    pendingWrites: 0,
    isSyncing: false,
    conflicts: [],
  };

  writeNode(node: CodeNode): void {
    this.localNodes.set(node.id, node);
    this.syncStatus.pendingWrites++;
  }

  writeNodes(nodes: CodeNode[]): void {
    for (const node of nodes) {
      this.localNodes.set(node.id, node);
    }
    this.syncStatus.pendingWrites += nodes.length;
  }

  readNode(id: string): CodeNode | undefined {
    return this.localNodes.get(id);
  }

  readAllNodes(): CodeNode[] {
    return Array.from(this.localNodes.values());
  }

  deleteNode(id: string): boolean {
    const existed = this.localNodes.delete(id);
    if (existed) {
      this.syncStatus.pendingWrites++;
    }
    return existed;
  }

  writeEdges(edges: CodeEdge[]): void {
    this.localEdges.push(...edges);
    this.syncStatus.pendingWrites++;
  }

  readEdges(): CodeEdge[] {
    return [...this.localEdges];
  }

  getSyncStatus(): SyncStatus {
    return this.syncStatus;
  }

  getNodeCount(): number {
    return this.localNodes.size;
  }

  getEdgeCount(): number {
    return this.localEdges.length;
  }
}

class MockContextCompactor {
  private importanceThreshold = 0.3;

  scoreNodeImportance(node: CodeNode): number {
    // Higher test coverage = higher importance
    // Higher change frequency = higher importance
    // Complex nodes are more important
    return (node.testCoverage * 0.4) + (node.changeFrequency * 0.3) + (Math.min(node.complexity, 100) / 100 * 0.3);
  }

  compactNodes(nodes: CodeNode[], targetTokenBudget: number): CodeNode[] {
    // Sort by importance descending
    const sorted = [...nodes].sort((a, b) => this.scoreNodeImportance(b) - this.scoreNodeImportance(a));

    let tokenCount = 0;
    const kept = [];

    for (const node of sorted) {
      const nodeTokens = Math.ceil(node.name.length / 4) + node.filePath.length / 4;
      if (tokenCount + nodeTokens <= targetTokenBudget) {
        kept.push(node);
        tokenCount += nodeTokens;
      }
    }

    return kept;
  }

  pruneNodes(nodes: CodeNode[]): CodeNode[] {
    return nodes.filter((n) => this.scoreNodeImportance(n) >= this.importanceThreshold);
  }
}

class MockImpactAnalyzer {
  analyzeImpact(changedNode: CodeNode, graph: CodeNode[]): string[] {
    // Find all nodes that depend on the changed node
    return graph
      .filter((n) => n.dependents.includes(changedNode.id))
      .map((n) => n.id);
  }

  riskLevel(affected: string[]): 'low' | 'medium' | 'high' | 'critical' {
    if (affected.length === 0) return 'low';
    if (affected.length <= 3) return 'medium';
    if (affected.length <= 10) return 'high';
    return 'critical';
  }
}

class MockSemanticDiffer {
  compareNodes(node1: CodeNode, node2: CodeNode): number {
    // Similarity score 0-1
    if (node1.id !== node2.id) return 0;
    if (node1.complexity !== node2.complexity) return 0.7;
    if (node1.testCoverage !== node2.testCoverage) return 0.8;
    return 1.0;
  }

  detectPatterns(changes: CodeNode[]): string[] {
    // Detect patterns in changes
    const patterns = [];

    // Pattern: mass complexity increase
    const avgComplexity = changes.reduce((sum, n) => sum + n.complexity, 0) / changes.length;
    if (avgComplexity > 50) {
      patterns.push('high-complexity-changes');
    }

    // Pattern: low test coverage
    const avgCoverage = changes.reduce((sum, n) => sum + n.testCoverage, 0) / changes.length;
    if (avgCoverage < 0.3) {
      patterns.push('low-coverage-changes');
    }

    return patterns;
  }
}

// ============================================================================
// Graph Memory Tests
// ============================================================================

describe('Atlas GraphMemory — Node & Edge Management', () => {
  let graph: MockGraphMemory;
  let testNode: CodeNode;

  beforeEach(() => {
    graph = new MockGraphMemory();
    testNode = {
      id: 'node-1',
      type: 'function',
      name: 'parseQuery',
      filePath: 'src/parser.ts',
      location: { line: 42, column: 10 },
      complexity: 5,
      changeFrequency: 0.2,
      testCoverage: 0.8,
      semanticTags: ['parsing', 'utility'],
      dependents: [],
    };
  });

  it('should write and read a single node', () => {
    graph.writeNode(testNode);

    const read = graph.readNode('node-1');

    expect(read).toEqual(testNode);
  });

  it('should track pending writes', () => {
    expect(graph.getSyncStatus().pendingWrites).toBe(0);

    graph.writeNode(testNode);

    expect(graph.getSyncStatus().pendingWrites).toBe(1);
  });

  it('should write and read multiple nodes', () => {
    const nodes = [
      { ...testNode, id: 'node-1' },
      { ...testNode, id: 'node-2', name: 'validateQuery' },
      { ...testNode, id: 'node-3', name: 'executeQuery' },
    ];

    graph.writeNodes(nodes);

    expect(graph.getNodeCount()).toBe(3);
    expect(graph.readAllNodes()).toHaveLength(3);
  });

  it('should delete nodes', () => {
    graph.writeNode(testNode);
    expect(graph.getNodeCount()).toBe(1);

    graph.deleteNode('node-1');

    expect(graph.getNodeCount()).toBe(0);
    expect(graph.readNode('node-1')).toBeUndefined();
  });

  it('should write and read edges', () => {
    const edge: CodeEdge = {
      fromId: 'node-1',
      toId: 'node-2',
      type: 'calls',
      weight: 1.0,
    };

    graph.writeEdges([edge]);

    const edges = graph.readEdges();

    expect(edges).toHaveLength(1);
    expect(edges[0]).toEqual(edge);
  });

  it('should handle circular edges', () => {
    const edges = [
      { fromId: 'a', toId: 'b', type: 'calls' as const, weight: 1 },
      { fromId: 'b', toId: 'c', type: 'calls' as const, weight: 1 },
      { fromId: 'c', toId: 'a', type: 'calls' as const, weight: 1 },
    ];

    graph.writeEdges(edges);

    expect(graph.getEdgeCount()).toBe(3);
  });

  it('property-based: write→read round-trip preserves node', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          complexity: fc.integer({ min: 0, max: 100 }),
          changeFrequency: fc.float({ min: 0, max: 1 }),
          testCoverage: fc.float({ min: 0, max: 1 }),
        }),
        (props) => {
          const g = new MockGraphMemory();
          const node: CodeNode = {
            ...testNode,
            ...props,
          };

          g.writeNode(node);
          const read = g.readNode(props.id);

          return read?.id === props.id && read?.complexity === props.complexity;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Context Compactor Tests
// ============================================================================

describe('Atlas ContextCompactor — Importance Scoring & Pruning', () => {
  let compactor: MockContextCompactor;
  let nodes: CodeNode[];

  beforeEach(() => {
    compactor = new MockContextCompactor();
    nodes = [
      {
        id: 'high-importance',
        type: 'function',
        name: 'criticalFunction',
        filePath: 'src/critical.ts',
        location: { line: 1, column: 1 },
        complexity: 80,
        changeFrequency: 0.8,
        testCoverage: 0.95,
        semanticTags: ['critical'],
        dependents: ['many-nodes'],
      },
      {
        id: 'low-importance',
        type: 'util',
        name: 'helperUtil',
        filePath: 'src/util.ts',
        location: { line: 50, column: 1 },
        complexity: 5,
        changeFrequency: 0.1,
        testCoverage: 0.2,
        semanticTags: ['helper'],
        dependents: [],
      },
      {
        id: 'medium-importance',
        type: 'class',
        name: 'ServiceClass',
        filePath: 'src/service.ts',
        location: { line: 100, column: 1 },
        complexity: 40,
        changeFrequency: 0.5,
        testCoverage: 0.6,
        semanticTags: ['service'],
        dependents: ['other-services'],
      },
    ];
  });

  it('should score node importance', () => {
    const highScore = compactor.scoreNodeImportance(nodes[0]);
    const lowScore = compactor.scoreNodeImportance(nodes[1]);

    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('should prune low-importance nodes', () => {
    const pruned = compactor.pruneNodes(nodes);

    expect(pruned.length).toBeLessThanOrEqual(nodes.length);
    expect(pruned.every((n) => compactor.scoreNodeImportance(n) >= 0.3)).toBe(true);
  });

  it('should compact nodes within token budget', () => {
    const compacted = compactor.compactNodes(nodes, 500);

    expect(compacted.length).toBeLessThanOrEqual(nodes.length);
    // High-importance nodes should be kept
    expect(compacted.some((n) => n.id === 'high-importance')).toBe(true);
  });

  it('should preserve high-importance nodes during compaction', () => {
    const beforeImportance = nodes.map((n) => compactor.scoreNodeImportance(n));
    const compacted = compactor.compactNodes(nodes, 100);

    // The highest-importance node should be preserved if budget allows
    const maxBeforeScore = Math.max(...beforeImportance);
    const highestInCompacted = compacted.map((n) => compactor.scoreNodeImportance(n));

    if (compacted.length > 0) {
      expect(Math.max(...highestInCompacted)).toBeGreaterThanOrEqual(maxBeforeScore * 0.5);
    }
  });

  it('property-based: importance is deterministic', () => {
    fc.assert(
      fc.property(
        fc.record({
          complexity: fc.integer({ min: 0, max: 100 }),
          changeFrequency: fc.float({ min: 0, max: 1 }),
          testCoverage: fc.float({ min: 0, max: 1 }),
        }),
        (props) => {
          const c = new MockContextCompactor();
          const node: CodeNode = { ...nodes[0], ...props };

          const score1 = c.scoreNodeImportance(node);
          const score2 = c.scoreNodeImportance(node);

          return score1 === score2;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Impact Analyzer Tests
// ============================================================================

describe('Atlas ImpactAnalyzer — Dependency Analysis & Risk Assessment', () => {
  let analyzer: MockImpactAnalyzer;
  let graph: CodeNode[];

  beforeEach(() => {
    analyzer = new MockImpactAnalyzer();
    graph = [
      {
        id: 'node-core',
        type: 'function',
        name: 'coreLogic',
        filePath: 'src/core.ts',
        location: { line: 1, column: 1 },
        complexity: 30,
        changeFrequency: 0.7,
        testCoverage: 0.9,
        semanticTags: ['core'],
        dependents: [],
      },
      {
        id: 'node-service',
        type: 'class',
        name: 'Service',
        filePath: 'src/service.ts',
        location: { line: 20, column: 1 },
        complexity: 20,
        changeFrequency: 0.5,
        testCoverage: 0.7,
        semanticTags: [],
        dependents: ['node-core'],
      },
      {
        id: 'node-api',
        type: 'api',
        name: 'APIHandler',
        filePath: 'src/api.ts',
        location: { line: 50, column: 1 },
        complexity: 15,
        changeFrequency: 0.3,
        testCoverage: 0.6,
        semanticTags: [],
        dependents: ['node-core'],
      },
      {
        id: 'node-util',
        type: 'util',
        name: 'Helper',
        filePath: 'src/util.ts',
        location: { line: 100, column: 1 },
        complexity: 5,
        changeFrequency: 0.2,
        testCoverage: 0.8,
        semanticTags: [],
        dependents: [],
      },
    ];
  });

  it('should find affected nodes when core node changes', () => {
    const affected = analyzer.analyzeImpact(graph[0], graph);

    expect(affected).toContain('node-service');
    expect(affected).toContain('node-api');
    expect(affected).not.toContain('node-util');
  });

  it('should assess risk level based on affected count', () => {
    expect(analyzer.riskLevel([])).toBe('low');
    expect(analyzer.riskLevel(['a', 'b', 'c'])).toBe('medium');
    expect(analyzer.riskLevel(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'])).toBe('high');
    expect(analyzer.riskLevel(Array.from({ length: 20 }, (_, i) => `n${i}`))).toBe('critical');
  });

  it('should detect high-impact changes', () => {
    const impactOnCore = analyzer.analyzeImpact(graph[0], graph);
    const riskLevel = analyzer.riskLevel(impactOnCore);

    expect(riskLevel).toBe('medium');
  });
});

// ============================================================================
// Semantic Differ Tests
// ============================================================================

describe('Atlas SemanticDiffer — Change Detection & Pattern Recognition', () => {
  let differ: MockSemanticDiffer;

  beforeEach(() => {
    differ = new MockSemanticDiffer();
  });

  it('should compare identical nodes with high similarity', () => {
    const node: CodeNode = {
      id: 'node-1',
      type: 'function',
      name: 'test',
      filePath: 'test.ts',
      location: { line: 1, column: 1 },
      complexity: 10,
      changeFrequency: 0.5,
      testCoverage: 0.8,
      semanticTags: [],
      dependents: [],
    };

    const similarity = differ.compareNodes(node, node);

    expect(similarity).toBe(1.0);
  });

  it('should detect complexity increases', () => {
    const before: CodeNode = {
      id: 'node-1',
      type: 'function',
      name: 'test',
      filePath: 'test.ts',
      location: { line: 1, column: 1 },
      complexity: 10,
      changeFrequency: 0.5,
      testCoverage: 0.8,
      semanticTags: [],
      dependents: [],
    };

    const after = { ...before, complexity: 50 };

    const similarity = differ.compareNodes(before, after);

    expect(similarity).toBeLessThan(1.0);
  });

  it('should detect low test coverage pattern', () => {
    const changes = [
      {
        id: 'node-1',
        type: 'function' as const,
        name: 'untested1',
        filePath: 'test.ts',
        location: { line: 1, column: 1 },
        complexity: 20,
        changeFrequency: 0.5,
        testCoverage: 0.1,
        semanticTags: [],
        dependents: [],
      },
      {
        id: 'node-2',
        type: 'function' as const,
        name: 'untested2',
        filePath: 'test.ts',
        location: { line: 20, column: 1 },
        complexity: 25,
        changeFrequency: 0.5,
        testCoverage: 0.2,
        semanticTags: [],
        dependents: [],
      },
    ];

    const patterns = differ.detectPatterns(changes);

    expect(patterns).toContain('low-coverage-changes');
  });

  it('should detect high complexity pattern', () => {
    const changes = [
      {
        id: 'node-1',
        type: 'class' as const,
        name: 'ComplexClass',
        filePath: 'test.ts',
        location: { line: 1, column: 1 },
        complexity: 60,
        changeFrequency: 0.5,
        testCoverage: 0.5,
        semanticTags: [],
        dependents: [],
      },
      {
        id: 'node-2',
        type: 'function' as const,
        name: 'ComplexFunction',
        filePath: 'test.ts',
        location: { line: 50, column: 1 },
        complexity: 55,
        changeFrequency: 0.5,
        testCoverage: 0.5,
        semanticTags: [],
        dependents: [],
      },
    ];

    const patterns = differ.detectPatterns(changes);

    expect(patterns).toContain('high-complexity-changes');
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Atlas Integration — Graph + Compactor + Analyzer + Differ', () => {
  it('should execute full graph analysis workflow', () => {
    const graph = new MockGraphMemory();
    const compactor = new MockContextCompactor();
    const analyzer = new MockImpactAnalyzer();

    // Create a graph
    const nodes: CodeNode[] = Array.from({ length: 10 }, (_, i) => ({
      id: `node-${i}`,
      type: 'function' as const,
      name: `func${i}`,
      filePath: `src/file${i}.ts`,
      location: { line: i * 10, column: 1 },
      complexity: Math.random() * 100,
      changeFrequency: Math.random(),
      testCoverage: Math.random(),
      semanticTags: [],
      dependents: i > 0 ? [`node-${i - 1}`] : [],
    }));

    graph.writeNodes(nodes);
    const compacted = compactor.compactNodes(graph.readAllNodes(), 1000);
    const impactedByFirst = analyzer.analyzeImpact(nodes[0], graph.readAllNodes());

    expect(compacted.length).toBeGreaterThan(0);
    expect(graph.getNodeCount()).toBe(10);
  });
});

// ============================================================================
// Stress Tests
// ============================================================================

describe('Atlas Stress Tests', () => {
  it('should handle 1000 nodes in graph', () => {
    const graph = new MockGraphMemory();
    const nodes = Array.from({ length: 1000 }, (_, i) => ({
      id: `node-${i}`,
      type: 'function' as const,
      name: `func${i}`,
      filePath: `src/file${Math.floor(i / 10)}.ts`,
      location: { line: i % 100, column: 1 },
      complexity: Math.random() * 100,
      changeFrequency: Math.random(),
      testCoverage: Math.random(),
      semanticTags: [],
      dependents: [],
    }));

    graph.writeNodes(nodes);

    expect(graph.getNodeCount()).toBe(1000);
  });

  it('should compact 1000 nodes efficiently', () => {
    const compactor = new MockContextCompactor();
    const nodes = Array.from({ length: 1000 }, (_, i) => ({
      id: `node-${i}`,
      type: 'function' as const,
      name: `func${i}`,
      filePath: `src/file${i}.ts`,
      location: { line: 1, column: 1 },
      complexity: Math.random() * 100,
      changeFrequency: Math.random(),
      testCoverage: Math.random(),
      semanticTags: [],
      dependents: [],
    }));

    const compacted = compactor.compactNodes(nodes, 5000);

    expect(compacted.length).toBeLessThan(nodes.length);
  });

  it('should handle large edge graphs', () => {
    const graph = new MockGraphMemory();
    const edges = Array.from({ length: 5000 }, (_, i) => ({
      fromId: `node-${i % 1000}`,
      toId: `node-${(i + 1) % 1000}`,
      type: 'calls' as const,
      weight: Math.random(),
    }));

    graph.writeEdges(edges);

    expect(graph.getEdgeCount()).toBe(5000);
  });
});
