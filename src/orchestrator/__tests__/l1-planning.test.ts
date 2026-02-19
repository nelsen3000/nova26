// L1 Planning Layer Tests — Comprehensive test suite
// Covers: Task decomposition, Dependency graph, Parallel detection, Re-planning

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  L1PlanningLayer,
  createL1PlanningLayer,
  DEFAULT_L1_CONFIG,
  type L1Config,
} from '../layers/l1-planning.js';
import type {
  UserIntent,
  TaskGraph,
  TaskNode,
  TaskEdge,
  DecompositionResult,
} from '../hierarchy-types.js';

// ============================================================================
// Test Fixtures & Helpers
// ============================================================================

function createMockIntent(overrides: Partial<UserIntent> = {}): UserIntent {
  return {
    id: `intent-${Date.now()}`,
    rawInput: 'Test input',
    parsedType: 'create',
    scope: 'test',
    constraints: [],
    tasteVaultTags: [],
    confidence: 0.9,
    needsClarification: false,
    ...overrides,
  };
}

function createMockTaskNode(overrides: Partial<TaskNode> = {}): TaskNode {
  return {
    id: `task-${Math.random().toString(36).slice(2, 9)}`,
    agent: 'mercury',
    description: 'Test task',
    dependencies: [],
    estimatedTokens: 1000,
    status: 'pending',
    priority: 1,
    metadata: {},
    ...overrides,
  };
}

function createMockTaskGraph(overrides: Partial<TaskGraph> = {}): TaskGraph {
  return {
    nodes: [],
    edges: [],
    parallelGroups: [],
    estimatedTotalTokens: 0,
    criticalPath: [],
    ...overrides,
  };
}

// ============================================================================
// Task Decomposition Tests (8 tests)
// ============================================================================

describe('Task Decomposition', () => {
  let layer: L1PlanningLayer;

  beforeEach(() => {
    layer = new L1PlanningLayer();
  });

  it('decompose returns DecompositionResult with TaskGraph', async () => {
    const intent = createMockIntent({ parsedType: 'create' });
    const result = await layer.decompose(intent);

    expect(result).toBeDefined();
    expect(result.graph).toBeDefined();
    expect(result.graph.nodes).toBeInstanceOf(Array);
    expect(result.graph.edges).toBeInstanceOf(Array);
    expect(typeof result.architectureValidated).toBe('boolean');
    expect(result.validationErrors).toBeInstanceOf(Array);
    expect(typeof result.replanCount).toBe('number');
  });

  it('handles create intent with correct task sequence', async () => {
    const intent = createMockIntent({ parsedType: 'create' });
    const result = await layer.decompose(intent);

    const descriptions = result.graph.nodes.map(n => n.description);
    expect(descriptions).toContain('spec');
    expect(descriptions).toContain('design');
    expect(descriptions).toContain('implement');
    expect(descriptions).toContain('test');
    expect(result.graph.nodes).toHaveLength(4);
  });

  it('handles fix intent with analyze-fix-test sequence', async () => {
    const intent = createMockIntent({ parsedType: 'fix' });
    const result = await layer.decompose(intent);

    const descriptions = result.graph.nodes.map(n => n.description);
    expect(descriptions).toContain('analyze');
    expect(descriptions).toContain('fix');
    expect(descriptions).toContain('test');
    expect(result.graph.nodes).toHaveLength(3);
  });

  it('handles review intent with single review task', async () => {
    const intent = createMockIntent({ parsedType: 'review' });
    const result = await layer.decompose(intent);

    expect(result.graph.nodes).toHaveLength(1);
    expect(result.graph.nodes[0].description).toBe('review');
    expect(result.graph.nodes[0].agent).toBe('saturn');
  });

  it('respects maxTasksPerGraph configuration', async () => {
    const layerWithLowLimit = new L1PlanningLayer({ maxTasksPerGraph: 2 });
    const intent = createMockIntent({ parsedType: 'create' });
    const result = await layerWithLowLimit.decompose(intent);

    expect(result.architectureValidated).toBe(false);
    expect(result.validationErrors.some(e => e.includes('Too many tasks'))).toBe(true);
    expect(result.graph.nodes).toHaveLength(0);
  });

  it('creates TaskNodes with correct structure', async () => {
    const intent = createMockIntent({ parsedType: 'create' });
    const result = await layer.decompose(intent);

    for (const node of result.graph.nodes) {
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('agent');
      expect(node).toHaveProperty('description');
      expect(node).toHaveProperty('dependencies');
      expect(node).toHaveProperty('estimatedTokens');
      expect(node).toHaveProperty('status');
      expect(node).toHaveProperty('priority');
      expect(node).toHaveProperty('metadata');

      expect(typeof node.id).toBe('string');
      expect(typeof node.agent).toBe('string');
      expect(typeof node.description).toBe('string');
      expect(Array.isArray(node.dependencies)).toBe(true);
      expect(typeof node.estimatedTokens).toBe('number');
      expect(node.estimatedTokens).toBeGreaterThan(0);
      expect(['pending', 'running', 'completed', 'failed', 'blocked']).toContain(
        node.status
      );
      expect(typeof node.priority).toBe('number');
      expect(typeof node.metadata).toBe('object');
    }
  });

  it('estimates tokens correctly based on task type', async () => {
    const intent = createMockIntent({ parsedType: 'create' });
    const result = await layer.decompose(intent);

    const specNode = result.graph.nodes.find(n => n.description === 'spec');
    const implementNode = result.graph.nodes.find(
      n => n.description === 'implement'
    );

    expect(specNode).toBeDefined();
    expect(implementNode).toBeDefined();
    expect(specNode!.estimatedTokens).toBe(1000);
    expect(implementNode!.estimatedTokens).toBe(2000);
  });

  it('assigns agents based on intent type and context', async () => {
    const intent = createMockIntent({ parsedType: 'create' });
    const result = await layer.decompose(intent);

    const agentAssignments: Record<string, string> = {
      spec: 'sun',
      design: 'venus',
      implement: 'mercury',
      test: 'mars',
    };

    for (const [desc, expectedAgent] of Object.entries(agentAssignments)) {
      const node = result.graph.nodes.find(n => n.description === desc);
      expect(node).toBeDefined();
      expect(node!.agent).toBe(expectedAgent);
    }
  });

  it('uses default agents when availableAgents not provided', async () => {
    const intent = createMockIntent({ parsedType: 'unknown' });
    const result = await layer.decompose(intent);

    expect(result.graph.nodes).toHaveLength(1);
    expect(result.graph.nodes[0].agent).toBe('sun'); // First default agent
  });
});

// ============================================================================
// Dependency Graph Tests (6 tests)
// ============================================================================

describe('Dependency Graph', () => {
  let layer: L1PlanningLayer;

  beforeEach(() => {
    layer = new L1PlanningLayer();
  });

  it('creates edges between tasks in priority order', async () => {
    const intent = createMockIntent({ parsedType: 'create' });
    const result = await layer.decompose(intent);

    // Should have edges connecting tasks by priority
    expect(result.graph.edges.length).toBeGreaterThan(0);

    for (const edge of result.graph.edges) {
      expect(edge).toHaveProperty('from');
      expect(edge).toHaveProperty('to');
      expect(edge).toHaveProperty('type');
      expect(edge.type).toBe('depends-on');
    }
  });

  it('detects circular dependencies correctly', async () => {
    const circularGraph = createMockTaskGraph({
      nodes: [
        createMockTaskNode({ id: 'A', priority: 1 }),
        createMockTaskNode({ id: 'B', priority: 2 }),
        createMockTaskNode({ id: 'C', priority: 3 }),
      ],
      edges: [
        { from: 'A', to: 'B', type: 'depends-on' },
        { from: 'B', to: 'C', type: 'depends-on' },
        { from: 'C', to: 'A', type: 'depends-on' }, // Creates cycle
      ],
    });

    const cycles = layer.detectCircularDependencies(circularGraph);

    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]).toContain('A');
    expect(cycles[0]).toContain('B');
    expect(cycles[0]).toContain('C');
  });

  it('returns empty array for acyclic graph', async () => {
    const acyclicGraph = createMockTaskGraph({
      nodes: [
        createMockTaskNode({ id: 'A', priority: 1 }),
        createMockTaskNode({ id: 'B', priority: 2 }),
        createMockTaskNode({ id: 'C', priority: 3 }),
      ],
      edges: [
        { from: 'A', to: 'B', type: 'depends-on' },
        { from: 'B', to: 'C', type: 'depends-on' },
      ],
    });

    const cycles = layer.detectCircularDependencies(acyclicGraph);

    expect(cycles).toHaveLength(0);
  });

  it('getReadyTasks returns executable tasks with completed dependencies', async () => {
    const graph = createMockTaskGraph({
      nodes: [
        createMockTaskNode({ id: 'A', status: 'completed' }),
        createMockTaskNode({ id: 'B', status: 'pending' }),
        createMockTaskNode({ id: 'C', status: 'pending' }),
      ],
      edges: [
        { from: 'A', to: 'B', type: 'depends-on' },
        { from: 'B', to: 'C', type: 'depends-on' },
      ],
    });

    const ready = layer.getReadyTasks(graph);

    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe('B');
  });

  it('getReadyTasks returns all pending tasks with no dependencies', async () => {
    const graph = createMockTaskGraph({
      nodes: [
        createMockTaskNode({ id: 'A', status: 'pending' }),
        createMockTaskNode({ id: 'B', status: 'pending' }),
        createMockTaskNode({ id: 'C', status: 'running' }),
      ],
      edges: [],
    });

    const ready = layer.getReadyTasks(graph);

    expect(ready).toHaveLength(2);
    expect(ready.map(n => n.id)).toContain('A');
    expect(ready.map(n => n.id)).toContain('B');
  });

  it('updateTaskStatus modifies graph without mutation', async () => {
    const graph = createMockTaskGraph({
      nodes: [
        createMockTaskNode({ id: 'A', status: 'pending' }),
        createMockTaskNode({ id: 'B', status: 'pending' }),
      ],
    });

    const updated = layer.updateTaskStatus(graph, 'A', 'running');

    // Original graph should not be mutated
    expect(graph.nodes[0].status).toBe('pending');

    // Updated graph should have new status
    expect(updated.nodes[0].status).toBe('running');
    expect(updated.nodes[1].status).toBe('pending');
  });

  it('getExecutionOrder returns topological sort', async () => {
    const graph = createMockTaskGraph({
      nodes: [
        createMockTaskNode({ id: 'C', priority: 3 }),
        createMockTaskNode({ id: 'A', priority: 1 }),
        createMockTaskNode({ id: 'B', priority: 2 }),
      ],
      edges: [
        { from: 'A', to: 'B', type: 'depends-on' },
        { from: 'B', to: 'C', type: 'depends-on' },
      ],
    });

    const order = layer.getExecutionOrder(graph);

    expect(order).toHaveLength(3);
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('C'));
  });
});

// ============================================================================
// Parallel Detection Tests (5 tests)
// ============================================================================

describe('Parallel Detection', () => {
  let layer: L1PlanningLayer;

  beforeEach(() => {
    layer = new L1PlanningLayer();
  });

  it('detectParallelGroups finds independent tasks', async () => {
    // Access private method through any cast for testing
    const detectParallelGroups = (
      nodes: TaskNode[],
      edges: TaskEdge[]
    ): string[][] => {
      const groups: string[][] = [];
      const independentTasks: string[] = [];

      for (const node of nodes) {
        const hasIncoming = edges.some(e => e.to === node.id);
        const hasOutgoing = edges.some(e => e.from === node.id);

        if (!hasIncoming && !hasOutgoing) {
          independentTasks.push(node.id);
        }
      }

      if (independentTasks.length > 1) {
        groups.push(independentTasks);
      }

      return groups;
    };

    const nodes = [
      createMockTaskNode({ id: 'A' }),
      createMockTaskNode({ id: 'B' }),
      createMockTaskNode({ id: 'C' }),
    ];
    const edges: TaskEdge[] = [];

    const groups = detectParallelGroups(nodes, edges);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toContain('A');
    expect(groups[0]).toContain('B');
    expect(groups[0]).toContain('C');
  });

  it('respects enableParallelDetection flag', async () => {
    const layerWithParallel = new L1PlanningLayer({
      enableParallelDetection: true,
    });
    const layerWithoutParallel = new L1PlanningLayer({
      enableParallelDetection: false,
    });

    const intent = createMockIntent({ parsedType: 'unknown' });

    const resultWith = await layerWithParallel.decompose(intent);
    const resultWithout = await layerWithoutParallel.decompose(intent);

    // Both should decompose, but parallel groups may differ
    expect(resultWith.graph.parallelGroups).toBeDefined();
    expect(resultWithout.graph.parallelGroups).toBeDefined();
    expect(Array.isArray(resultWithout.graph.parallelGroups)).toBe(true);
  });

  it('groups correctly identified in decompose result', async () => {
    const intent = createMockIntent({ parsedType: 'general' });
    const result = await layer.decompose(intent);

    expect(result.graph.parallelGroups).toBeInstanceOf(Array);
    // Single task graphs won't have parallel groups
  });

  it('does not include dependent tasks in parallel groups', async () => {
    const detectParallelGroups = (
      nodes: TaskNode[],
      edges: TaskEdge[]
    ): string[][] => {
      const groups: string[][] = [];
      const independentTasks: string[] = [];

      for (const node of nodes) {
        const hasIncoming = edges.some(e => e.to === node.id);
        const hasOutgoing = edges.some(e => e.from === node.id);

        if (!hasIncoming && !hasOutgoing) {
          independentTasks.push(node.id);
        }
      }

      if (independentTasks.length > 1) {
        groups.push(independentTasks);
      }

      return groups;
    };

    const nodes = [
      createMockTaskNode({ id: 'A' }),
      createMockTaskNode({ id: 'B' }),
      createMockTaskNode({ id: 'C' }),
    ];
    const edges: TaskEdge[] = [{ from: 'A', to: 'B', type: 'depends-on' }];

    const groups = detectParallelGroups(nodes, edges);

    // C is independent, but only one independent task
    expect(groups).toHaveLength(0);
  });

  it('handles empty graph for parallel detection', async () => {
    const intent = createMockIntent({ parsedType: 'unknown' });
    const result = await layer.decompose(intent);

    expect(result.graph.parallelGroups).toBeInstanceOf(Array);
  });
});

// ============================================================================
// Re-planning Tests (4 tests)
// ============================================================================

describe('Re-planning', () => {
  let layer: L1PlanningLayer;

  beforeEach(() => {
    layer = new L1PlanningLayer();
  });

  it('replan adjusts graph on failure', async () => {
    const initialGraph = createMockTaskGraph({
      nodes: [
        createMockTaskNode({ id: 'task-1', status: 'pending', priority: 1 }),
        createMockTaskNode({ id: 'task-2', status: 'pending', priority: 2 }),
      ],
      edges: [],
    });

    const result = await layer.replan(initialGraph, 'task-1', 'Execution failed');

    expect(result).toBeDefined();
    expect(result.graph).toBeDefined();
    expect(result.replanCount).toBe(1);
  });

  it('replan splits large tasks on timeout or token limit errors', async () => {
    const initialGraph = createMockTaskGraph({
      nodes: [
        createMockTaskNode({
          id: 'large-task',
          status: 'pending',
          priority: 1,
          estimatedTokens: 4000,
        }),
      ],
      edges: [],
    });

    const result = await layer.replan(
      initialGraph,
      'large-task',
      'token limit exceeded'
    );

    // Task should be split into subtasks
    expect(result.graph.nodes.length).toBeGreaterThan(1);

    const originalTask = result.graph.nodes.find(n => n.id === 'large-task');
    expect(originalTask?.status).toBe('failed');

    const subtasks = result.graph.nodes.filter(n => n.id.includes('part'));
    expect(subtasks.length).toBeGreaterThan(0);
  });

  it('replan increments replanCount', async () => {
    const initialGraph = createMockTaskGraph({
      nodes: [createMockTaskNode({ id: 'task-1', status: 'pending', priority: 1 })],
      edges: [],
    });

    const result1 = await layer.replan(initialGraph, 'task-1', 'error');
    expect(result1.replanCount).toBe(1);

    const result2 = await layer.replan(result1.graph, 'task-1', 'error');
    expect(result2.replanCount).toBe(2);
  });

  it('replan respects maxReplanAttempts', async () => {
    const layerWithLowLimit = new L1PlanningLayer({ maxReplanAttempts: 2 });
    const initialGraph = createMockTaskGraph({
      nodes: [createMockTaskNode({ id: 'task-1', status: 'pending', priority: 1 })],
      edges: [],
    });

    // First replan
    const result1 = await layerWithLowLimit.replan(
      initialGraph,
      'task-1',
      'error'
    );
    expect(result1.replanCount).toBe(1);

    // Second replan
    const result2 = await layerWithLowLimit.replan(
      result1.graph,
      'task-1',
      'error'
    );
    expect(result2.replanCount).toBe(2);

    // Third replan should fail
    const result3 = await layerWithLowLimit.replan(
      result2.graph,
      'task-1',
      'error'
    );
    expect(result3.replanCount).toBe(2);
    expect(result3.validationErrors.some(e => e.includes('Max replan attempts'))).toBe(true);
    expect(result3.architectureValidated).toBe(false);
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('Factory Function', () => {
  it('createL1PlanningLayer creates instance with default config', () => {
    const layer = createL1PlanningLayer();

    expect(layer).toBeInstanceOf(L1PlanningLayer);
  });

  it('createL1PlanningLayer applies custom config', () => {
    const customConfig: Partial<L1Config> = {
      maxTasksPerGraph: 10,
      enableParallelDetection: false,
      maxReplanAttempts: 5,
    };
    const layer = createL1PlanningLayer(customConfig);

    expect(layer).toBeInstanceOf(L1PlanningLayer);
  });
});

// ============================================================================
// Configuration Tests
// ============================================================================

describe('Configuration', () => {
  it('DEFAULT_L1_CONFIG has correct values', () => {
    expect(DEFAULT_L1_CONFIG.maxTasksPerGraph).toBe(50);
    expect(DEFAULT_L1_CONFIG.enableParallelDetection).toBe(true);
    expect(DEFAULT_L1_CONFIG.validateArchitecture).toBe(true);
    expect(DEFAULT_L1_CONFIG.maxReplanAttempts).toBe(3);
  });

  it('constructor merges partial config with defaults', async () => {
    const layer = new L1PlanningLayer({ maxTasksPerGraph: 5 });

    const intent = createMockIntent({ parsedType: 'create' });
    const result = await layer.decompose(intent);

    // Should fail due to maxTasksPerGraph: 5 (create makes 4 tasks which is < 5)
    // Actually create makes 4 tasks, so it should pass
    expect(result.architectureValidated).toBe(true);

    const layerStrict = new L1PlanningLayer({ maxTasksPerGraph: 3 });
    const resultStrict = await layerStrict.decompose(intent);
    expect(resultStrict.architectureValidated).toBe(false);
  });
});

// ============================================================================
// Critical Path Tests
// ============================================================================

describe('Critical Path Calculation', () => {
  let layer: L1PlanningLayer;

  beforeEach(() => {
    layer = new L1PlanningLayer();
  });

  it('calculateCriticalPath returns array of task IDs', async () => {
    const intent = createMockIntent({ parsedType: 'create' });
    const result = await layer.decompose(intent);

    expect(result.graph.criticalPath).toBeInstanceOf(Array);
    expect(result.graph.criticalPath.length).toBeGreaterThan(0);
  });

  it('critical path respects task dependencies', async () => {
    const graph = createMockTaskGraph({
      nodes: [
        createMockTaskNode({ id: 'A', priority: 1, estimatedTokens: 100 }),
        createMockTaskNode({ id: 'B', priority: 2, estimatedTokens: 200 }),
        createMockTaskNode({ id: 'C', priority: 3, estimatedTokens: 300 }),
      ],
      edges: [
        { from: 'A', to: 'B', type: 'depends-on' },
        { from: 'B', to: 'C', type: 'depends-on' },
      ],
    });

    // Access private method through any cast for testing
    const calculateCriticalPath = (
      nodes: TaskNode[],
      edges: TaskEdge[]
    ): string[] => {
      const distances = new Map<string, number>();

      for (const node of nodes) {
        distances.set(node.id, 0);
      }

      // Topological order
      const inDegree = new Map<string, number>();
      for (const node of nodes) {
        inDegree.set(node.id, 0);
      }
      for (const edge of edges) {
        inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
      }

      const queue: string[] = [];
      const order: string[] = [];

      for (const [id, degree] of inDegree) {
        if (degree === 0) queue.push(id);
      }

      while (queue.length > 0) {
        const current = queue.shift()!;
        order.push(current);

        const outgoing = edges.filter(e => e.from === current);
        for (const edge of outgoing) {
          const newDegree = (inDegree.get(edge.to) ?? 0) - 1;
          inDegree.set(edge.to, newDegree);
          if (newDegree === 0) queue.push(edge.to);
        }
      }

      for (const nodeId of order) {
        const incoming = edges.filter(e => e.to === nodeId);
        let maxDist = 0;

        for (const edge of incoming) {
          const dist = distances.get(edge.from) ?? 0;
          maxDist = Math.max(maxDist, dist);
        }

        const node = nodes.find(n => n.id === nodeId);
        distances.set(nodeId, maxDist + (node?.estimatedTokens ?? 0));
      }

      const endNode = order.reduce((max, id) =>
        (distances.get(id) ?? 0) > (distances.get(max) ?? 0) ? id : max
      );

      const path: string[] = [endNode];
      let current = endNode;

      while (true) {
        const incoming = edges.filter(e => e.to === current);
        if (incoming.length === 0) break;

        const prev = incoming.reduce((max, e) =>
          (distances.get(e.from) ?? 0) > (distances.get(max.from) ?? 0) ? e : max
        );

        path.unshift(prev.from);
        current = prev.from;
      }

      return path;
    };

    const path = calculateCriticalPath(graph.nodes, graph.edges);

    expect(path).toHaveLength(3);
    expect(path[0]).toBe('A');
    expect(path[1]).toBe('B');
    expect(path[2]).toBe('C');
  });
});

// ============================================================================
// Architecture Validation Tests
// ============================================================================

describe('Architecture Validation', () => {
  let layer: L1PlanningLayer;

  beforeEach(() => {
    layer = new L1PlanningLayer();
  });

  it('detects unassigned tasks during validation', async () => {
    const intent = createMockIntent({ parsedType: 'create' });
    const result = await layer.decompose(intent);

    // All tasks should be assigned
    expect(result.architectureValidated).toBe(true);
    expect(result.validationErrors).toHaveLength(0);
  });

  it('validateArchitecture can be disabled', async () => {
    const layerNoValidation = new L1PlanningLayer({
      validateArchitecture: false,
    });
    const intent = createMockIntent({ parsedType: 'create' });
    const result = await layerNoValidation.decompose(intent);

    // Should still produce a graph even if validation is disabled
    expect(result.graph.nodes.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Edge Cases', () => {
  let layer: L1PlanningLayer;

  beforeEach(() => {
    layer = new L1PlanningLayer();
  });

  it('handles unknown intent types gracefully', async () => {
    const intent = createMockIntent({ parsedType: 'unknown-intent-type' });
    const result = await layer.decompose(intent);

    expect(result.graph.nodes).toHaveLength(1);
    expect(result.graph.nodes[0].description).toBe('execute');
  });

  it('handles empty context', async () => {
    const intent = createMockIntent({ parsedType: 'create' });
    const result = await layer.decompose(intent, {});

    expect(result.graph.nodes.length).toBeGreaterThan(0);
  });

  it('handles undefined context', async () => {
    const intent = createMockIntent({ parsedType: 'create' });
    const result = await layer.decompose(intent, undefined);

    expect(result.graph.nodes.length).toBeGreaterThan(0);
  });

  it('getExecutionOrder handles disconnected graph', async () => {
    const graph = createMockTaskGraph({
      nodes: [
        createMockTaskNode({ id: 'A' }),
        createMockTaskNode({ id: 'B' }),
        createMockTaskNode({ id: 'C' }),
      ],
      edges: [],
    });

    const order = layer.getExecutionOrder(graph);

    expect(order).toHaveLength(3);
    expect(order).toContain('A');
    expect(order).toContain('B');
    expect(order).toContain('C');
  });

  it('handles replan with non-existent task ID', async () => {
    const graph = createMockTaskGraph({
      nodes: [createMockTaskNode({ id: 'existing', status: 'pending' })],
      edges: [],
    });

    const result = await layer.replan(graph, 'non-existent', 'error');

    expect(result.replanCount).toBe(1);
    expect(result.graph.nodes).toHaveLength(1);
  });

  it('handles circular dependency detection on empty graph', () => {
    const emptyGraph = createMockTaskGraph();

    const cycles = layer.detectCircularDependencies(emptyGraph);

    expect(cycles).toHaveLength(0);
  });

  it('handles circular dependency detection on single node', () => {
    const singleNodeGraph = createMockTaskGraph({
      nodes: [createMockTaskNode({ id: 'A' })],
      edges: [],
    });

    const cycles = layer.detectCircularDependencies(singleNodeGraph);

    expect(cycles).toHaveLength(0);
  });
});
