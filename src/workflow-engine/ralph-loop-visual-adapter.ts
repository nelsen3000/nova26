// RalphLoop Visual Adapter - Bridges RalphLoop to Visual Workflow Engine (KIMI-R23-01)

import type { PRD, Task } from '../types/index.js';
import type { RalphLoopOptions } from '../orchestrator/ralph-loop-types.js';
import { RalphVisualWorkflowEngine } from './ralph-visual-engine.js';
import {
  type PersistentWorkflow,
  type VisualNode,
  type WorkflowEdge,
  type WorkflowState,
  type LangGraphNodeConfig,
  type NodePosition,
  type VisualNodeStatus,
  TaskToNodeStatusMap,
} from './types.js';

/**
 * Configuration for the RalphLoop visual adapter
 */
export interface RalphLoopAdapterConfig {
  /** Enable automatic checkpointing at each task */
  checkpointPerTask?: boolean;
  /** Visual layout algorithm */
  layoutAlgorithm?: 'layered' | 'force-directed' | 'manual';
  /** Node spacing in visual layout */
  nodeSpacing?: number;
  /** Enable edge labels for dependencies */
  showDependencyLabels?: boolean;
}

/**
 * Adapter that converts RalphLoop PRD/tasks into visual workflow engine format
 * 
 * This adapter enables:
 * - Converting existing PRD-based workflows to visual format
 * - Visual editing and debugging of RalphLoop executions
 * - Checkpoint/rewind capabilities for task-level debugging
 * - Timeline tracking for RalphLoop sessions
 */
export class RalphLoopVisualAdapter {
  private config: Required<RalphLoopAdapterConfig>;

  private static readonly DEFAULT_CONFIG: Required<RalphLoopAdapterConfig> = {
    checkpointPerTask: true,
    layoutAlgorithm: 'layered',
    nodeSpacing: 150,
    showDependencyLabels: true,
  };

  constructor(config?: RalphLoopAdapterConfig) {
    this.config = { ...RalphLoopVisualAdapter.DEFAULT_CONFIG, ...config };
  }

  /**
   * Adapt an existing RalphLoop PRD into a visual workflow engine
   */
  adapt(
    prd: PRD,
    ralphLoopOptions?: RalphLoopOptions,
    existingWorkflowId?: string
  ): RalphVisualWorkflowEngine {
    const workflow = this.convertPRDToWorkflow(prd, existingWorkflowId);
    
    const engine = new RalphVisualWorkflowEngine(workflow, {
      persistent: ralphLoopOptions?.eventStore ?? false,
      enableCheckpoints: this.config.checkpointPerTask,
      nodeTimeoutMs: this.getTimeoutFromOptions(ralphLoopOptions),
    });

    return engine;
  }

  /**
   * Convert a single RalphLoop task to a visual node
   */
  convertTaskToNode(task: Task, position?: NodePosition): VisualNode {
    const nodePosition = position ?? this.calculateNodePosition(task);
    
    return {
      id: task.id,
      type: this.inferNodeType(task),
      agentId: task.agent,
      config: this.buildNodeConfig(task),
      position: nodePosition,
      status: this.mapTaskStatus(task.status),
      label: task.title,
      metadata: {
        description: task.description,
        phase: task.phase,
        attempts: task.attempts,
        dependencies: task.dependencies,
        context: task.context,
        todos: task.todos,
        currentTodoId: task.currentTodoId,
        output: task.output,
        error: task.error,
      },
    };
  }

  /**
   * Convert a PRD into a full PersistentWorkflow
   */
  convertPRDToWorkflow(prd: PRD, existingWorkflowId?: string): PersistentWorkflow {
    const now = new Date().toISOString();
    const workflowId = existingWorkflowId ?? this.generateWorkflowId(prd);

    // Build nodes from tasks
    const nodes: VisualNode[] = prd.tasks.map((task, index) => {
      const position = this.calculateLayoutPosition(task, index, prd.tasks);
      return this.convertTaskToNode(task, position);
    });

    // Build edges from dependencies
    const edges: WorkflowEdge[] = this.buildEdgesFromDependencies(prd.tasks);

    // Determine initial state
    const currentNode = this.findInitialNode(nodes, edges);

    // Build workflow state
    const state: WorkflowState = {
      currentNodeId: currentNode?.id ?? nodes[0]?.id ?? '',
      checkpoints: [],
      variables: {
        prdName: prd.meta.name,
        prdVersion: prd.meta.version,
        totalTasks: prd.tasks.length,
      },
      globalStatus: 'idle',
    };

    return {
      id: workflowId,
      name: prd.meta.name,
      nodes,
      edges,
      state,
      timeline: [],
      createdAt: prd.meta.createdAt ?? now,
      lastModified: now,
    };
  }

  /**
   * Update a workflow with new task statuses from a running RalphLoop
   */
  syncWorkflowWithPRD(
    workflow: PersistentWorkflow,
    prd: PRD
  ): PersistentWorkflow {
    const updatedNodes = workflow.nodes.map((node) => {
      const task = prd.tasks.find((t) => t.id === node.id);
      if (!task) return node;

      return {
        ...node,
        status: this.mapTaskStatus(task.status),
        metadata: {
          ...node.metadata,
          output: task.output,
          error: task.error,
          attempts: task.attempts,
          todos: task.todos,
          currentTodoId: task.currentTodoId,
        },
      };
    });

    // Find current running task
    const runningTask = prd.tasks.find((t) => t.status === 'running');
    const currentNodeId = runningTask?.id ?? workflow.state.currentNodeId;

    return {
      ...workflow,
      nodes: updatedNodes,
      state: {
        ...workflow.state,
        currentNodeId,
        variables: {
          ...workflow.state.variables,
          lastSyncAt: new Date().toISOString(),
        },
      },
      lastModified: new Date().toISOString(),
    };
  }

  /**
   * Extract task statistics from workflow
   */
  extractTaskStats(workflow: PersistentWorkflow): TaskStatistics {
    const nodes = workflow.nodes;
    const total = nodes.length;
    const completed = nodes.filter((n) => n.status === 'complete').length;
    const failed = nodes.filter((n) => n.status === 'failed').length;
    const running = nodes.filter((n) => n.status === 'running').length;
    const pending = nodes.filter((n) => n.status === 'pending').length;
    const skipped = nodes.filter((n) => n.status === 'skipped').length;

    return {
      total,
      completed,
      failed,
      running,
      pending,
      skipped,
      completionPercentage: total > 0 ? (completed / total) * 100 : 0,
    };
  }

  /**
   * Convert visual workflow back to PRD format
   */
  convertWorkflowToPRD(workflow: PersistentWorkflow): PRD {
    const tasks: Task[] = workflow.nodes.map((node) => ({
      id: node.id,
      title: node.label ?? node.id,
      description: (node.metadata?.description as string) ?? '',
      agent: node.agentId ?? 'UNKNOWN',
      status: this.mapNodeStatusToTaskStatus(node.status),
      dependencies: this.getNodeDependencies(node.id, workflow.edges),
      phase: (node.metadata?.phase as number) ?? 0,
      attempts: (node.metadata?.attempts as number) ?? 0,
      createdAt: workflow.createdAt,
      output: node.metadata?.output as string | undefined,
      error: node.metadata?.error as string | undefined,
      context: node.metadata?.context as Record<string, unknown> | undefined,
      todos: node.metadata?.todos as Task['todos'],
      currentTodoId: node.metadata?.currentTodoId as string | undefined,
    }));

    return {
      meta: {
        name: workflow.name,
        version: (workflow.state.variables.prdVersion as string) ?? '1.0.0',
        createdAt: workflow.createdAt,
      },
      tasks,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private inferNodeType(task: Task): VisualNode['type'] {
    // Infer node type based on task characteristics
    const title = task.title.toLowerCase();
    const agent = task.agent.toLowerCase();

    if (title.includes('decide') || title.includes('choose') || title.includes('if ')) {
      return 'decision';
    }
    
    if (title.includes('parallel') || title.includes('concurrent') || title.includes('batch')) {
      return 'parallel';
    }
    
    if (title.includes('merge') || title.includes('combine') || title.includes('join')) {
      return 'merge';
    }
    
    if (title.includes('gate') || title.includes('validate') || title.includes('check')) {
      return 'gate';
    }
    
    // MERCURY is typically a validation gate
    if (agent === 'mercury') {
      return 'gate';
    }

    return 'agent';
  }

  private buildNodeConfig(task: Task): LangGraphNodeConfig {
    const entryFunctionMap: Record<string, string> = {
      MARS: 'executeBackendTask',
      VENUS: 'executeFrontendTask',
      MERCURY: 'executeValidationTask',
      JUPITER: 'executeArchitectureTask',
      PLUTO: 'executeDatabaseTask',
      EARTH: 'executeRequirementsTask',
      IO: 'executeIntegrationTask',
      GANYMEDE: 'executeAnalyticsTask',
      TRITON: 'executeDevOpsTask',
    };

    return {
      entryFunction: entryFunctionMap[task.agent] ?? 'executeGenericTask',
      stateSchema: {
        input: { type: 'object', required: true },
        output: { type: 'object', required: false },
        context: { type: 'object', required: false },
      },
      retryPolicy: {
        maxRetries: 2,
        backoffMs: 1000,
        strategy: 'exponential',
      },
      timeoutMs: 300000, // 5 minutes
    };
  }

  private calculateNodePosition(_task: Task): NodePosition {
    // Default positioning - will be overridden by layout algorithm
    return { x: 0, y: 0 };
  }

  private calculateLayoutPosition(
    task: Task,
    index: number,
    allTasks: Task[]
  ): NodePosition {
    const spacing = this.config.nodeSpacing;

    switch (this.config.layoutAlgorithm) {
      case 'layered':
        return this.calculateLayeredPosition(task, index, allTasks, spacing);
      
      case 'force-directed':
        // Simplified force-directed approximation
        return this.calculateForceDirectedPosition(index, allTasks.length, spacing);
      
      case 'manual':
      default:
        // Use phase-based positioning
        return {
          x: task.phase * spacing * 2,
          y: index * spacing,
        };
    }
  }

  private calculateLayeredPosition(
    task: Task,
    index: number,
    allTasks: Task[],
    spacing: number
  ): NodePosition {
    // Group tasks by phase
    const tasksByPhase = new Map<number, Task[]>();
    for (const t of allTasks) {
      const phase = t.phase;
      if (!tasksByPhase.has(phase)) {
        tasksByPhase.set(phase, []);
      }
      tasksByPhase.get(phase)!.push(t);
    }

    // Find position within phase
    const phaseTasks = tasksByPhase.get(task.phase) ?? [];
    const indexInPhase = phaseTasks.findIndex((t) => t.id === task.id);

    return {
      x: task.phase * spacing * 2,
      y: (indexInPhase >= 0 ? indexInPhase : index) * spacing,
    };
  }

  private calculateForceDirectedPosition(
    index: number,
    total: number,
    spacing: number
  ): NodePosition {
    // Simple circular layout as force-directed approximation
    const angle = (index / total) * 2 * Math.PI;
    const radius = spacing * 3;
    
    return {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    };
  }

  private buildEdgesFromDependencies(tasks: Task[]): WorkflowEdge[] {
    const edges: WorkflowEdge[] = [];

    for (const task of tasks) {
      for (const depId of task.dependencies) {
        const depTask = tasks.find((t) => t.id === depId);
        if (depTask) {
          edges.push({
            from: depId,
            to: task.id,
            condition: this.config.showDependencyLabels 
              ? `depends on ${depTask.title}` 
              : undefined,
          });
        }
      }
    }

    return edges;
  }

  private findInitialNode(nodes: VisualNode[], edges: WorkflowEdge[]): VisualNode | undefined {
    // Find nodes with no incoming edges
    const incomingEdgeTargets = new Set(edges.map((e) => e.to));
    const startNodes = nodes.filter((n) => !incomingEdgeTargets.has(n.id));
    
    // Prefer phase 0 nodes
    return startNodes.find((n) => (n.metadata?.phase as number) === 0) ?? startNodes[0];
  }

  private mapTaskStatus(taskStatus: Task['status']): VisualNodeStatus {
    return TaskToNodeStatusMap[taskStatus] ?? 'pending';
  }

  private mapNodeStatusToTaskStatus(nodeStatus: VisualNodeStatus): Task['status'] {
    const reverseMap: Record<VisualNodeStatus, Task['status']> = {
      pending: 'pending',
      running: 'running',
      complete: 'done',
      failed: 'failed',
      skipped: 'blocked',
    };
    return reverseMap[nodeStatus] ?? 'pending';
  }

  private getNodeDependencies(nodeId: string, edges: WorkflowEdge[]): string[] {
    return edges
      .filter((e) => e.to === nodeId)
      .map((e) => e.from);
  }

  private generateWorkflowId(prd: PRD): string {
    const sanitized = prd.meta.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const timestamp = Date.now().toString(36);
    return `${sanitized}-${timestamp}`;
  }

  private getTimeoutFromOptions(_options?: RalphLoopOptions): number {
    // Default to 5 minutes, could be extracted from options if available
    return 300000;
  }
}

/**
 * Task statistics interface
 */
export interface TaskStatistics {
  total: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  skipped: number;
  completionPercentage: number;
}

/**
 * Factory function for quick adapter creation
 */
export function createRalphLoopAdapter(
  config?: RalphLoopAdapterConfig
): RalphLoopVisualAdapter {
  return new RalphLoopVisualAdapter(config);
}

/**
 * Convert a PRD to visual workflow in one call
 */
export function prdToVisualWorkflow(
  prd: PRD,
  config?: RalphLoopAdapterConfig
): PersistentWorkflow {
  const adapter = new RalphLoopVisualAdapter(config);
  return adapter.convertPRDToWorkflow(prd);
}
