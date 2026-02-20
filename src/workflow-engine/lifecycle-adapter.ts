// Workflow Engine Lifecycle Adapter - Bridges Ralph Loop to Visual Workflow Engine (KIMI-W-02)

import type {
  BuildContext,
  TaskResult,
  BuildResult,
} from '../orchestrator/lifecycle-hooks.js';
import type { FeatureLifecycleHandlers } from '../orchestrator/lifecycle-wiring.js';
import type { PRD } from '../types/index.js';
import {
  RalphVisualWorkflowEngine,
  WorkflowEngineError,
} from './ralph-visual-engine.js';
import {
  RalphLoopVisualAdapter,
  type RalphLoopAdapterConfig,
  type TaskStatistics,
} from './ralph-loop-visual-adapter.js';
import type {
  PersistentWorkflow,
  WorkflowStats,
  VisualNodeStatus,
} from './types.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Configuration for the workflow engine lifecycle adapter
 */
export interface WorkflowEngineLifecycleConfig {
  /** Enable detailed logging */
  verbose?: boolean;
  /** Enable checkpoint per task */
  checkpointPerTask?: boolean;
  /** Visual layout algorithm */
  layoutAlgorithm?: 'layered' | 'force-directed' | 'manual';
  /** Enable critical path analysis */
  enableCriticalPath?: boolean;
  /** Custom adapter configuration */
  adapterConfig?: RalphLoopAdapterConfig;
}

/**
 * Current state of a build in progress
 */
export interface BuildState {
  buildId: string;
  prdId: string;
  prdName: string;
  startedAt: string;
  workflowEngine: RalphVisualWorkflowEngine | null;
  workflow: PersistentWorkflow | null;
  taskStats: Map<string, TaskExecutionStats>;
  completedTasks: string[];
  failedTasks: string[];
  downstreamBlocked: string[];
}

/**
 * Statistics for a single task execution
 */
export interface TaskExecutionStats {
  taskId: string;
  agentName: string;
  startedAt?: string;
  completedAt?: string;
  durationMs: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
  output?: string;
  error?: string;
  aceScore?: number;
}

/**
 * Critical path analysis result
 */
export interface CriticalPathResult {
  path: string[];
  totalDuration: number;
  criticalNodes: string[];
}

/**
 * Complete workflow state snapshot
 */
export interface WorkflowStateSnapshot {
  buildState: BuildState | null;
  workflowStats: WorkflowStats | null;
  taskStatistics: TaskStatistics | null;
  criticalPath: CriticalPathResult | null;
  timestamp: string;
}

// ============================================================================
// Module State
// ============================================================================

let currentBuildState: BuildState | null = null;
let adapterConfig: Required<WorkflowEngineLifecycleConfig> = {
  verbose: false,
  checkpointPerTask: true,
  layoutAlgorithm: 'layered',
  enableCriticalPath: true,
  adapterConfig: {
    checkpointPerTask: true,
    layoutAlgorithm: 'layered',
    nodeSpacing: 150,
    showDependencyLabels: true,
  },
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to validate BuildContext
 */
export function isValidBuildContext(context: unknown): context is BuildContext {
  if (typeof context !== 'object' || context === null) {
    return false;
  }
  const ctx = context as Record<string, unknown>;
  return (
    typeof ctx.buildId === 'string' &&
    typeof ctx.prdId === 'string' &&
    typeof ctx.prdName === 'string' &&
    typeof ctx.startedAt === 'string' &&
    typeof ctx.options === 'object' &&
    ctx.options !== null
  );
}

/**
 * Type guard to validate TaskResult
 */
export function isValidTaskResult(context: unknown): context is TaskResult {
  if (typeof context !== 'object' || context === null) {
    return false;
  }
  const ctx = context as Record<string, unknown>;
  return (
    typeof ctx.taskId === 'string' &&
    typeof ctx.agentName === 'string' &&
    typeof ctx.success === 'boolean' &&
    typeof ctx.durationMs === 'number'
  );
}

/**
 * Type guard to validate BuildResult
 */
export function isValidBuildResult(context: unknown): context is BuildResult {
  if (typeof context !== 'object' || context === null) {
    return false;
  }
  const ctx = context as Record<string, unknown>;
  return (
    typeof ctx.buildId === 'string' &&
    typeof ctx.prdId === 'string' &&
    typeof ctx.totalTasks === 'number' &&
    typeof ctx.successfulTasks === 'number' &&
    typeof ctx.failedTasks === 'number' &&
    typeof ctx.totalDurationMs === 'number' &&
    typeof ctx.averageAceScore === 'number'
  );
}

/**
 * Type guard to validate PRD in options
 */
function isValidPRDInOptions(options: Record<string, unknown>): PRD | null {
  if (!options.prd || typeof options.prd !== 'object') {
    return null;
  }
  const prd = options.prd as Record<string, unknown>;
  if (
    !prd.meta ||
    typeof prd.meta !== 'object' ||
    !Array.isArray(prd.tasks)
  ) {
    return null;
  }
  return prd as unknown as PRD;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the current build state
 */
export function getCurrentBuildState(): BuildState | null {
  return currentBuildState;
}

/**
 * Get the current workflow state snapshot
 */
export function getWorkflowState(): WorkflowStateSnapshot {
  if (!currentBuildState || !currentBuildState.workflowEngine) {
    return {
      buildState: currentBuildState,
      workflowStats: null,
      taskStatistics: null,
      criticalPath: null,
      timestamp: new Date().toISOString(),
    };
  }

  const engine = currentBuildState.workflowEngine;
  const workflow = currentBuildState.workflow;

  return {
    buildState: currentBuildState,
    workflowStats: engine.getStats(),
    taskStatistics: workflow
      ? calculateTaskStatistics(workflow)
      : null,
    criticalPath: adapterConfig.enableCriticalPath
      ? calculateCriticalPath(currentBuildState)
      : null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Reset the build state (useful for testing and cleanup)
 */
export function resetBuildState(): void {
  if (currentBuildState?.workflowEngine) {
    currentBuildState.workflowEngine.dispose();
  }
  currentBuildState = null;
}

// ============================================================================
// Internal Helper Functions
// ============================================================================

function logVerbose(message: string): void {
  if (adapterConfig.verbose) {
    console.log(`[workflow-engine-lifecycle] ${message}`);
  }
}

function initializeBuildState(context: BuildContext): BuildState {
  return {
    buildId: context.buildId,
    prdId: context.prdId,
    prdName: context.prdName,
    startedAt: context.startedAt,
    workflowEngine: null,
    workflow: null,
    taskStats: new Map(),
    completedTasks: [],
    failedTasks: [],
    downstreamBlocked: [],
  };
}

function calculateTaskStatistics(workflow: PersistentWorkflow): TaskStatistics {
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

function calculateCriticalPath(buildState: BuildState): CriticalPathResult {
  const workflow = buildState.workflow;
  if (!workflow) {
    return { path: [], totalDuration: 0, criticalNodes: [] };
  }

  // Build adjacency list and calculate durations
  const nodeDurations = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // Initialize
  for (const node of workflow.nodes) {
    const stats = buildState.taskStats.get(node.id);
    nodeDurations.set(node.id, stats?.durationMs ?? 0);
    adjacencyList.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  // Build graph
  for (const edge of workflow.edges) {
    const fromList = adjacencyList.get(edge.from);
    if (fromList) {
      fromList.push(edge.to);
    }
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  // Find all paths using topological sort with path tracking
  const startNodes = workflow.nodes.filter(
    (n) => (inDegree.get(n.id) ?? 0) === 0
  );

  let longestPath: string[] = [];
  let maxDuration = 0;

  function findLongestPath(
    nodeId: string,
    currentPath: string[],
    currentDuration: number
  ): void {
    const newPath = [...currentPath, nodeId];
    const newDuration = currentDuration + (nodeDurations.get(nodeId) ?? 0);

    const neighbors = adjacencyList.get(nodeId) ?? [];
    if (neighbors.length === 0) {
      // End node
      if (newDuration > maxDuration) {
        maxDuration = newDuration;
        longestPath = newPath;
      }
    } else {
      for (const neighbor of neighbors) {
        findLongestPath(neighbor, newPath, newDuration);
      }
    }
  }

  for (const startNode of startNodes) {
    findLongestPath(startNode.id, [], 0);
  }

  return {
    path: longestPath,
    totalDuration: maxDuration,
    criticalNodes: longestPath,
  };
}

function updateNodeStatusFromTask(
  workflow: PersistentWorkflow,
  taskResult: TaskResult
): void {
  const node = workflow.nodes.find((n) => n.id === taskResult.taskId);
  if (!node) {
    logVerbose(`Node not found for task ${taskResult.taskId}`);
    return;
  }

  // Map task result to node status
  const newStatus: VisualNodeStatus = taskResult.success ? 'complete' : 'failed';
  node.status = newStatus;

  // Update metadata with execution info
  node.metadata = {
    ...node.metadata,
    output: taskResult.output,
    error: taskResult.error,
    executedAt: new Date().toISOString(),
    durationMs: taskResult.durationMs,
    aceScore: taskResult.aceScore,
  };

  logVerbose(`Updated node ${node.id} status to ${newStatus}`);
}

function triggerDownstreamTransitions(
  buildState: BuildState,
  taskResult: TaskResult
): string[] {
  if (!buildState.workflow) {
    return [];
  }

  const workflow = buildState.workflow;
  const blockedNodes: string[] = [];

  // Find all edges from this task's node
  const outgoingEdges = workflow.edges.filter(
    (e) => e.from === taskResult.taskId
  );

  for (const edge of outgoingEdges) {
    const targetNode = workflow.nodes.find((n) => n.id === edge.to);
    if (!targetNode) continue;

    // Check if all dependencies are complete
    const incomingEdges = workflow.edges.filter((e) => e.to === edge.to);
    const allDependenciesComplete = incomingEdges.every((incomingEdge) => {
      const sourceNode = workflow.nodes.find((n) => n.id === incomingEdge.from);
      return sourceNode?.status === 'complete';
    });

    if (taskResult.success && allDependenciesComplete) {
      // Mark as ready to run
      if (targetNode.status === 'pending') {
        targetNode.status = 'running';
        logVerbose(`Triggered downstream node ${targetNode.id} to running`);
      }
    } else if (!taskResult.success) {
      // Mark downstream as blocked
      targetNode.status = 'skipped';
      blockedNodes.push(targetNode.id);
      logVerbose(`Blocked downstream node ${targetNode.id} due to failure`);
    }
  }

  return blockedNodes;
}

function recursivelyBlockDownstream(
  workflow: PersistentWorkflow,
  nodeId: string,
  blockedNodes: string[]
): void {
  const outgoingEdges = workflow.edges.filter((e) => e.from === nodeId);

  for (const edge of outgoingEdges) {
    const targetNode = workflow.nodes.find((n) => n.id === edge.to);
    if (targetNode && targetNode.status !== 'skipped') {
      targetNode.status = 'skipped';
      blockedNodes.push(targetNode.id);
      recursivelyBlockDownstream(workflow, targetNode.id, blockedNodes);
    }
  }
}

// ============================================================================
// Lifecycle Handlers
// ============================================================================

async function handleBeforeBuild(context: BuildContext): Promise<void> {
  logVerbose(`Initializing workflow engine for build ${context.buildId}`);

  // Reset any previous state
  if (currentBuildState) {
    resetBuildState();
  }

  // Initialize build state
  currentBuildState = initializeBuildState(context);

  // Extract PRD from options if available
  const prd = isValidPRDInOptions(context.options);

  if (prd && prd.tasks.length > 0) {
    // Create visual adapter and convert PRD to workflow
    const visualAdapter = new RalphLoopVisualAdapter(adapterConfig.adapterConfig);
    const workflow = visualAdapter.convertPRDToWorkflow(prd);
    currentBuildState.workflow = workflow;

    // Create workflow engine
    currentBuildState.workflowEngine = new RalphVisualWorkflowEngine(workflow, {
      enableCheckpoints: adapterConfig.checkpointPerTask,
      persistent: false,
    });

    // Start the workflow
    await currentBuildState.workflowEngine.startWorkflow();

    // Initialize task stats for all nodes
    for (const node of workflow.nodes) {
      currentBuildState.taskStats.set(node.id, {
        taskId: node.id,
        agentName: node.agentId ?? 'unknown',
        durationMs: 0,
        status: node.status === 'pending' ? 'pending' : 'pending',
      });
    }

    logVerbose(
      `Created workflow with ${workflow.nodes.length} nodes and ${workflow.edges.length} edges`
    );
  } else if (prd && prd.tasks.length === 0) {
    // Handle empty PRD - create workflow but don't start engine
    const visualAdapter = new RalphLoopVisualAdapter(adapterConfig.adapterConfig);
    const workflow = visualAdapter.convertPRDToWorkflow(prd);
    currentBuildState.workflow = workflow;
    logVerbose('Created empty workflow (no tasks in PRD)');
  } else {
    logVerbose('No PRD found in build context, workflow engine not initialized');
  }
}

async function handleAfterTask(taskResult: TaskResult): Promise<void> {
  if (!currentBuildState) {
    logVerbose('No active build state, skipping task update');
    return;
  }

  logVerbose(
    `Updating workflow for task ${taskResult.taskId} with success=${taskResult.success}`
  );

  // Update task stats
  const existingStats = currentBuildState.taskStats.get(taskResult.taskId);
  const taskStats: TaskExecutionStats = {
    taskId: taskResult.taskId,
    agentName: taskResult.agentName,
    startedAt: existingStats?.startedAt ?? new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: taskResult.durationMs,
    status: taskResult.success ? 'completed' : 'failed',
    output: taskResult.output,
    error: taskResult.error,
    aceScore: taskResult.aceScore,
  };
  currentBuildState.taskStats.set(taskResult.taskId, taskStats);

  // Track completed/failed tasks
  if (taskResult.success) {
    currentBuildState.completedTasks.push(taskResult.taskId);
  } else {
    currentBuildState.failedTasks.push(taskResult.taskId);
  }

  // Update workflow node status if engine exists
  if (currentBuildState.workflow && currentBuildState.workflowEngine) {
    updateNodeStatusFromTask(currentBuildState.workflow, taskResult);

    // Trigger downstream transitions
    const blockedNodes = triggerDownstreamTransitions(currentBuildState, taskResult);
    currentBuildState.downstreamBlocked.push(...blockedNodes);

    // Recursively block all downstream if task failed
    if (!taskResult.success) {
      const allBlocked: string[] = [];
      recursivelyBlockDownstream(
        currentBuildState.workflow,
        taskResult.taskId,
        allBlocked
      );
      currentBuildState.downstreamBlocked.push(...allBlocked);
    }

    // Create checkpoint after task completion if enabled
    if (adapterConfig.checkpointPerTask) {
      currentBuildState.workflowEngine.createCheckpoint(`task-complete-${taskResult.taskId}`);
    }
  }
}

async function handleBuildComplete(buildResult: BuildResult): Promise<void> {
  if (!currentBuildState) {
    logVerbose('No active build state, skipping build completion');
    return;
  }

  logVerbose(`Finalizing workflow for build ${buildResult.buildId}`);

  // Calculate final statistics
  const stats = currentBuildState.workflowEngine?.getStats();
  const taskStats = currentBuildState.workflow
    ? calculateTaskStatistics(currentBuildState.workflow)
    : null;

  // Calculate critical path
  const criticalPath = adapterConfig.enableCriticalPath
    ? calculateCriticalPath(currentBuildState)
    : null;

  // Log build metrics
  console.log('[workflow-engine] Build Summary:');
  console.log(`  Build ID: ${buildResult.buildId}`);
  console.log(`  PRD: ${buildResult.prdId}`);
  console.log(`  Total Tasks: ${buildResult.totalTasks}`);
  console.log(`  Successful: ${buildResult.successfulTasks}`);
  console.log(`  Failed: ${buildResult.failedTasks}`);
  console.log(`  Total Duration: ${buildResult.totalDurationMs}ms`);
  console.log(`  Average ACE Score: ${buildResult.averageAceScore.toFixed(2)}`);

  if (stats) {
    console.log('[workflow-engine] Workflow Stats:');
    console.log(`  Total Nodes: ${stats.totalNodes}`);
    console.log(`  Completed Nodes: ${stats.completedNodes}`);
    console.log(`  Failed Nodes: ${stats.failedNodes}`);
    console.log(`  Avg Execution Time: ${stats.avgExecutionTimeMs.toFixed(2)}ms`);
    console.log(`  Total Execution Time: ${stats.totalExecutionTimeMs}ms`);
  }

  if (taskStats) {
    console.log('[workflow-engine] Task Statistics:');
    console.log(`  Completion: ${taskStats.completionPercentage.toFixed(1)}%`);
    console.log(`  Pending: ${taskStats.pending}`);
    console.log(`  Running: ${taskStats.running}`);
    console.log(`  Skipped: ${taskStats.skipped}`);
  }

  if (criticalPath) {
    console.log('[workflow-engine] Critical Path:');
    console.log(`  Path: ${criticalPath.path.join(' -> ')}`);
    console.log(`  Total Duration: ${criticalPath.totalDuration}ms`);
  }

  // Store final summary in build state
  currentBuildState.workflow = currentBuildState.workflowEngine?.getWorkflow() ?? null;

  // Clean up workflow engine
  if (currentBuildState.workflowEngine) {
    currentBuildState.workflowEngine.dispose();
    currentBuildState.workflowEngine = null;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create workflow engine lifecycle hooks
 * @param config - Configuration for the lifecycle adapter
 * @returns FeatureLifecycleHandlers for wiring into the lifecycle system
 */
export function createWorkflowEngineLifecycleHooks(
  config?: WorkflowEngineLifecycleConfig
): FeatureLifecycleHandlers {
  // Merge config with defaults
  adapterConfig = {
    ...adapterConfig,
    ...config,
    adapterConfig: {
      ...adapterConfig.adapterConfig,
      ...config?.adapterConfig,
    },
  };

  logVerbose('Creating workflow engine lifecycle hooks');

  return {
    onBeforeBuild: handleBeforeBuild,
    onAfterTask: handleAfterTask,
    onBuildComplete: handleBuildComplete,
  };
}

// Export error class for consumers
export { WorkflowEngineError };
