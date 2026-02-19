// L1 Planning Layer — R20-01
// Task decomposition, dependency graph, parallel group detection

import type {
  TaskGraph,
  TaskNode,
  TaskEdge,
  DecompositionResult,
  UserIntent,
} from '../hierarchy-types.js';

export interface L1Config {
  maxTasksPerGraph: number;
  enableParallelDetection: boolean;
  validateArchitecture: boolean;
  maxReplanAttempts: number;
}

export const DEFAULT_L1_CONFIG: L1Config = {
  maxTasksPerGraph: 50,
  enableParallelDetection: true,
  validateArchitecture: true,
  maxReplanAttempts: 3,
};

export class L1PlanningLayer {
  private config: L1Config;
  private replanCount: number = 0;

  constructor(config: Partial<L1Config> = {}) {
    this.config = { ...DEFAULT_L1_CONFIG, ...config };
  }

  /**
   * Decompose user intent into task graph
   */
  async decompose(
    intent: UserIntent,
    context?: {
      availableAgents?: string[];
      projectStructure?: string[];
      existingFiles?: string[];
    }
  ): Promise<DecompositionResult> {
    const nodes = await this.createTaskNodes(intent, context);
    
    if (nodes.length > this.config.maxTasksPerGraph) {
      return {
        graph: { nodes: [], edges: [], parallelGroups: [], estimatedTotalTokens: 0, criticalPath: [] },
        architectureValidated: false,
        validationErrors: [`Too many tasks: ${nodes.length} > ${this.config.maxTasksPerGraph}`],
        replanCount: this.replanCount,
      };
    }

    const edges = this.createDependencyEdges(nodes);
    const parallelGroups = this.config.enableParallelDetection
      ? this.detectParallelGroups(nodes, edges)
      : [];

    const graph: TaskGraph = {
      nodes,
      edges,
      parallelGroups,
      estimatedTotalTokens: nodes.reduce((sum, n) => sum + n.estimatedTokens, 0),
      criticalPath: this.calculateCriticalPath(nodes, edges),
    };

    const validation = this.config.validateArchitecture
      ? await this.validateArchitecture(graph, context)
      : { valid: true, errors: [] };

    return {
      graph,
      architectureValidated: validation.valid,
      validationErrors: validation.errors,
      replanCount: this.replanCount,
    };
  }

  /**
   * Re-plan on failure - adjust task graph based on execution results
   */
  async replan(
    failedGraph: TaskGraph,
    failedTaskId: string,
    error: string
  ): Promise<DecompositionResult> {
    if (this.replanCount >= this.config.maxReplanAttempts) {
      return {
        graph: failedGraph,
        architectureValidated: false,
        validationErrors: [`Max replan attempts (${this.config.maxReplanAttempts}) exceeded`],
        replanCount: this.replanCount,
      };
    }

    this.replanCount++;

    // Clone and modify the graph
    const nodes = failedGraph.nodes.map(n => ({ ...n }));
    const failedNode = nodes.find(n => n.id === failedTaskId);

    if (failedNode) {
      // Mark as failed and adjust strategy
      failedNode.status = 'failed';
      failedNode.priority += 1; // Increase priority for retry
      
      // Split large tasks or add dependencies
      if (error.includes('timeout') || error.includes('token limit')) {
        const newNodes = this.splitTask(failedNode);
        nodes.push(...newNodes);
      }
    }

    const edges = this.createDependencyEdges(nodes);
    const parallelGroups = this.detectParallelGroups(nodes, edges);

    const graph: TaskGraph = {
      nodes,
      edges,
      parallelGroups,
      estimatedTotalTokens: nodes.reduce((sum, n) => sum + n.estimatedTokens, 0),
      criticalPath: this.calculateCriticalPath(nodes, edges),
    };

    return {
      graph,
      architectureValidated: true,
      validationErrors: [],
      replanCount: this.replanCount,
    };
  }

  /**
   * Detect circular dependencies in the graph
   */
  detectCircularDependencies(graph: TaskGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        const cycleStart = path.indexOf(nodeId);
        cycles.push(path.slice(cycleStart).concat(nodeId));
        return;
      }

      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const outgoingEdges = graph.edges.filter(e => e.from === nodeId);
      for (const edge of outgoingEdges) {
        dfs(edge.to, [...path]);
      }

      recursionStack.delete(nodeId);
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return cycles;
  }

  /**
   * Get tasks that are ready to execute (all dependencies completed)
   */
  getReadyTasks(graph: TaskGraph): TaskNode[] {
    return graph.nodes.filter(node => {
      if (node.status !== 'pending') return false;
      
      const dependencies = graph.edges
        .filter(e => e.to === node.id)
        .map(e => e.from);
      
      const depNodes = graph.nodes.filter(n => dependencies.includes(n.id));
      return depNodes.every(n => n.status === 'completed');
    });
  }

  /**
   * Update task status in the graph
   */
  updateTaskStatus(graph: TaskGraph, taskId: string, status: TaskNode['status']): TaskGraph {
    const nodes = graph.nodes.map(n =>
      n.id === taskId ? { ...n, status } : n
    );
    return { ...graph, nodes };
  }

  /**
   * Get execution order (topological sort)
   */
  getExecutionOrder(graph: TaskGraph): string[] {
    const inDegree = new Map<string, number>();
    
    for (const node of graph.nodes) {
      inDegree.set(node.id, 0);
    }
    
    for (const edge of graph.edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }

    const queue: string[] = [];
    const result: string[] = [];

    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const outgoing = graph.edges.filter(e => e.from === current);
      for (const edge of outgoing) {
        const newDegree = (inDegree.get(edge.to) ?? 0) - 1;
        inDegree.set(edge.to, newDegree);
        if (newDegree === 0) queue.push(edge.to);
      }
    }

    return result;
  }

  private async createTaskNodes(
    intent: UserIntent,
    context?: {
      availableAgents?: string[];
      projectStructure?: string[];
      existingFiles?: string[];
    }
  ): Promise<TaskNode[]> {
    const nodes: TaskNode[] = [];
    const agents = context?.availableAgents ?? ['sun', 'mercury', 'venus', 'mars', 'saturn'];

    // Based on intent type, create appropriate tasks
    const intentType = intent.parsedType;
    
    if (intentType === 'create' || intentType === 'modify') {
      nodes.push(this.createNode('spec', 'sun', 1, 1000));
      nodes.push(this.createNode('design', 'venus', 2, 800));
      nodes.push(this.createNode('implement', 'mercury', 3, 2000));
      nodes.push(this.createNode('test', 'mars', 4, 1000));
    } else if (intentType === 'fix') {
      nodes.push(this.createNode('analyze', 'mercury', 1, 500));
      nodes.push(this.createNode('fix', 'mercury', 2, 800));
      nodes.push(this.createNode('test', 'mars', 3, 600));
    } else if (intentType === 'review') {
      nodes.push(this.createNode('review', 'saturn', 1, 1000));
    } else {
      // General - single task
      nodes.push(this.createNode('execute', agents[0], 1, 1500));
    }

    return nodes;
  }

  private createNode(
    description: string,
    agent: string,
    priority: number,
    estimatedTokens: number
  ): TaskNode {
    return {
      id: `task-${description}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      agent,
      description,
      dependencies: [],
      estimatedTokens,
      status: 'pending',
      priority,
      metadata: {},
    };
  }

  private createDependencyEdges(nodes: TaskNode[]): TaskEdge[] {
    const edges: TaskEdge[] = [];
    
    // Sort by priority and create dependencies
    const sorted = [...nodes].sort((a, b) => a.priority - b.priority);
    
    for (let i = 0; i < sorted.length - 1; i++) {
      edges.push({
        from: sorted[i].id,
        to: sorted[i + 1].id,
        type: 'depends-on',
      });
    }

    return edges;
  }

  private detectParallelGroups(nodes: TaskNode[], edges: TaskEdge[]): string[][] {
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
  }

  private calculateCriticalPath(nodes: TaskNode[], edges: TaskEdge[]): string[] {
    const distances = new Map<string, number>();
    
    for (const node of nodes) {
      distances.set(node.id, 0);
    }

    // Topological order
    const order = this.topologicalSort(nodes, edges);
    
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

    // Find path with max distance
    const endNode = order.reduce((max, id) =>
      (distances.get(id) ?? 0) > (distances.get(max) ?? 0) ? id : max
    );

    // Backtrack to find path
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
  }

  private topologicalSort(nodes: TaskNode[], edges: TaskEdge[]): string[] {
    const inDegree = new Map<string, number>();
    
    for (const node of nodes) {
      inDegree.set(node.id, 0);
    }
    
    for (const edge of edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }

    const queue: string[] = [];
    const result: string[] = [];

    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const outgoing = edges.filter(e => e.from === current);
      for (const edge of outgoing) {
        const newDegree = (inDegree.get(edge.to) ?? 0) - 1;
        inDegree.set(edge.to, newDegree);
        if (newDegree === 0) queue.push(edge.to);
      }
    }

    return result;
  }

  private splitTask(node: TaskNode): TaskNode[] {
    // Split a large task into smaller subtasks
    const subtasks: TaskNode[] = [];
    const parts = 2;
    
    for (let i = 0; i < parts; i++) {
      subtasks.push({
        ...node,
        id: `${node.id}-part${i + 1}`,
        description: `${node.description} (part ${i + 1}/${parts})`,
        estimatedTokens: Math.floor(node.estimatedTokens / parts),
        dependencies: i === 0 ? node.dependencies : [...node.dependencies, subtasks[i - 1].id],
      });
    }

    return subtasks;
  }

  private async validateArchitecture(
    graph: TaskGraph,
    _context?: { existingFiles?: string[] }
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check for circular dependencies
    const cycles = this.detectCircularDependencies(graph);
    if (cycles.length > 0) {
      errors.push(`Circular dependencies detected: ${cycles.map(c => c.join(' -> ')).join(', ')}`);
    }

    // Check agent assignments
    const unassigned = graph.nodes.filter(n => !n.agent);
    if (unassigned.length > 0) {
      errors.push(`Unassigned tasks: ${unassigned.map(n => n.id).join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export function createL1PlanningLayer(config?: Partial<L1Config>): L1PlanningLayer {
  return new L1PlanningLayer(config);
}
