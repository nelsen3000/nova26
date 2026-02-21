// Workflow Engine - Core execution engine
// Spec: .nova/specs/grok-r24-immortal-omniverse.md (R24-02)

import {
  type Workflow,
  type WorkflowRun,
  type WorkflowNode,
  type WorkflowEdge,
  WorkflowRunStateSchema,
  type AgentNodeConfig,
  type DecisionNodeConfig,
  type ParallelNodeConfig,
  type LoopNodeConfig,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// Type Definitions
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExecutionContext {
  [key: string]: unknown;
}

export type NodeExecutor = (
  node: WorkflowNode,
  context: ExecutionContext
) => Promise<ExecutionContext>;

export interface EngineOptions {
  maxConcurrentRuns?: number;
  defaultTimeoutMs?: number;
  onStateChange?: (run: WorkflowRun) => void;
  onNodeComplete?: (runId: string, nodeId: string, context: ExecutionContext) => void;
}

export interface ExecutionResult {
  runId: string;
  state: 'completed' | 'failed' | 'cancelled';
  context: ExecutionContext;
  error?: string;
  durationMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WorkflowEngine Class
// ═══════════════════════════════════════════════════════════════════════════════

export class WorkflowEngine {
  private workflows: Map<string, Workflow> = new Map();
  private runs: Map<string, WorkflowRun> = new Map();
  private executors: Map<string, NodeExecutor> = new Map();
  private options: EngineOptions;

  constructor(options: EngineOptions = {}) {
    this.options = {
      maxConcurrentRuns: 10,
      defaultTimeoutMs: 60000,
      ...options,
    };
  }

  /**
   * Register a workflow
   */
  register(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
  }

  /**
   * Get a workflow by ID
   */
  getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  /**
   * List all workflows
   */
  listWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Delete a workflow
   */
  deleteWorkflow(id: string): boolean {
    return this.workflows.delete(id);
  }

  /**
   * Register a node executor
   */
  registerExecutor(nodeType: string, executor: NodeExecutor): void {
    this.executors.set(nodeType, executor);
  }

  /**
   * Start a workflow execution
   */
  async start(
    workflowId: string,
    initialContext: ExecutionContext = {}
  ): Promise<string> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Find trigger node (entry point)
    const triggerNode = workflow.nodes.find(n => n.type === 'trigger');
    const startNode = triggerNode
      ? this.getNextNodes(workflow, triggerNode.id)[0]
      : workflow.nodes[0];

    const run: WorkflowRun = {
      id: runId,
      workflowId,
      state: WorkflowRunStateSchema.enum.running,
      currentNodeId: startNode?.id ?? null,
      context: { ...initialContext },
      startedAt: Date.now(),
    };

    this.runs.set(runId, run);
    this.options.onStateChange?.(run);

    // Execute asynchronously
    this.executeRun(runId).catch(err => {
      console.error(`Workflow execution failed: ${err.message}`);
    });

    return runId;
  }

  /**
   * Execute a workflow run
   */
  private async executeRun(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) return;

    const workflow = this.workflows.get(run.workflowId);
    if (!workflow) {
      this.failRun(runId, 'Workflow not found');
      return;
    }

    try {
      while (run.currentNodeId && run.state === 'running') {
        const node = workflow.nodes.find(n => n.id === run.currentNodeId);
        if (!node) {
          this.failRun(runId, `Node not found: ${run.currentNodeId}`);
          return;
        }

        // Execute node
        const executor = this.executors.get(node.type);
        if (!executor) {
          this.failRun(runId, `No executor for node type: ${node.type}`);
          return;
        }

        // Update context with node output
        const newContext = await executor(node, run.context);
        run.context = { ...run.context, ...newContext };

        this.options.onNodeComplete?.(runId, node.id, run.context);

        // Determine next node
        const nextNodes = this.getNextNodes(workflow, node.id, run.context);

        if (nextNodes.length === 0) {
          // End of workflow
          run.currentNodeId = null;
          run.state = WorkflowRunStateSchema.enum.completed;
          run.completedAt = Date.now();
        } else if (nextNodes.length === 1) {
          // Single path
          run.currentNodeId = nextNodes[0].id;
        } else {
          // Parallel execution - for now just take first
          // TODO: Implement proper parallel execution
          run.currentNodeId = nextNodes[0].id;
        }

        this.options.onStateChange?.(run);
      }

      if (run.state === 'running') {
        run.state = WorkflowRunStateSchema.enum.completed;
        run.completedAt = Date.now();
        this.options.onStateChange?.(run);
      }
    } catch (error) {
      this.failRun(
        runId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Get next nodes based on current node and context
   */
  private getNextNodes(
    workflow: Workflow,
    currentNodeId: string,
    context?: ExecutionContext
  ): WorkflowNode[] {
    const edges = workflow.edges.filter(e => e.source === currentNodeId);

    if (edges.length === 0) return [];

    const currentNode = workflow.nodes.find(n => n.id === currentNodeId);

    // Handle decision node
    if (currentNode?.type === 'decision' && context) {
      const config = currentNode.config as DecisionNodeConfig;
      for (const edge of edges) {
        if (edge.condition) {
          try {
            // Simple condition evaluation
            const condition = this.evaluateCondition(edge.condition, context);
            if (condition) {
              const target = workflow.nodes.find(n => n.id === edge.target);
              if (target) return [target];
            }
          } catch {
            // Continue to next edge if evaluation fails
          }
        }
      }
    }

    // Return all target nodes
    return edges
      .map(e => workflow.nodes.find(n => n.id === e.target))
      .filter((n): n is WorkflowNode => n !== undefined);
  }

  /**
   * Evaluate a condition expression
   */
  private evaluateCondition(condition: string, context: ExecutionContext): boolean {
    // Simple expression evaluation: "context.value > 5" or "context.status === 'done'"
    try {
      // Create a safe evaluation context
      const evalContext = { context, Math, JSON };
      const fn = new Function(...Object.keys(evalContext), `return ${condition}`);
      return Boolean(fn(...Object.values(evalContext)));
    } catch {
      return false;
    }
  }

  /**
   * Fail a workflow run
   */
  private failRun(runId: string, error: string): void {
    const run = this.runs.get(runId);
    if (!run) return;

    run.state = WorkflowRunStateSchema.enum.failed;
    run.error = error;
    run.completedAt = Date.now();
    this.options.onStateChange?.(run);
  }

  /**
   * Get run status
   */
  getRun(runId: string): WorkflowRun | undefined {
    return this.runs.get(runId);
  }

  /**
   * Cancel a running workflow
   */
  cancel(runId: string): boolean {
    const run = this.runs.get(runId);
    if (!run || run.state !== 'running') return false;

    run.state = WorkflowRunStateSchema.enum.cancelled;
    run.completedAt = Date.now();
    this.options.onStateChange?.(run);
    return true;
  }

  /**
   * Pause a running workflow
   */
  pause(runId: string): boolean {
    const run = this.runs.get(runId);
    if (!run || run.state !== 'running') return false;

    run.state = WorkflowRunStateSchema.enum.paused;
    this.options.onStateChange?.(run);
    return true;
  }

  /**
   * Resume a paused workflow
   */
  resume(runId: string): boolean {
    const run = this.runs.get(runId);
    if (!run || run.state !== 'paused') return false;

    run.state = WorkflowRunStateSchema.enum.running;
    this.options.onStateChange?.(run);

    // Continue execution
    this.executeRun(runId).catch(err => {
      console.error(`Workflow execution failed: ${err.message}`);
    });

    return true;
  }

  /**
   * Wait for a workflow to complete
   */
  async waitForCompletion(
    runId: string,
    timeoutMs: number = 30000
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const check = () => {
        const run = this.runs.get(runId);
        if (!run) {
          reject(new Error(`Run not found: ${runId}`));
          return;
        }

        if (['completed', 'failed', 'cancelled'].includes(run.state)) {
          const durationMs = (run.completedAt ?? Date.now()) - (run.startedAt ?? startTime);
          resolve({
            runId,
            state: run.state as 'completed' | 'failed' | 'cancelled',
            context: run.context,
            error: run.error,
            durationMs,
          });
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          reject(new Error(`Timeout waiting for workflow completion`));
          return;
        }

        setTimeout(check, 100);
      };

      check();
    });
  }

  /**
   * Get execution history
   */
  getRuns(workflowId?: string): WorkflowRun[] {
    const runs = Array.from(this.runs.values());
    if (workflowId) {
      return runs.filter(r => r.workflowId === workflowId);
    }
    return runs;
  }
}
