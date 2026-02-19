// Ralph Visual Workflow Engine - Main Engine (KIMI-R23-01)

import { randomUUID } from 'crypto';
import {
  type PersistentWorkflow,
  type VisualNode,
  type WorkflowState,
  type Checkpoint,
  type TemporalEvent,
  type NodeExecutionContext,
  type NodeExecutionResult,
  type WorkflowEngineOptions,
  type WorkflowStats,
  type WorkflowEngineEvent,
  type WorkflowEventHandler,
  type StorageAdapter,
  type VisualNodeStatus,
} from './types.js';

/**
 * Error thrown by the workflow engine
 */
export class WorkflowEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly nodeId?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'WorkflowEngineError';
  }
}

/**
 * Ralph Visual Workflow Engine - Core execution engine for visual workflows
 * 
 * Provides:
 * - Visual workflow execution with LangGraph-compatible nodes
 * - Checkpoint/rewind capability for temporal debugging
 * - Timeline tracking for event replay
 * - Persistent state management
 */
export class RalphVisualWorkflowEngine {
  private workflow: PersistentWorkflow;
  private options: Required<WorkflowEngineOptions>;
  private eventHandlers: Set<WorkflowEventHandler> = new Set();
  private abortController: AbortController | null = null;
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private isExecuting = false;

  // Default options
  private static readonly DEFAULT_OPTIONS: Required<WorkflowEngineOptions> = {
    persistent: false,
    storageAdapter: null as unknown as StorageAdapter,
    autoSaveIntervalMs: 30000,
    nodeTimeoutMs: 300000, // 5 minutes
    enableCheckpoints: true,
    maxCheckpoints: 50,
  };

  constructor(workflow: PersistentWorkflow, options?: WorkflowEngineOptions) {
    this.workflow = this.validateWorkflow(workflow);
    this.options = { ...RalphVisualWorkflowEngine.DEFAULT_OPTIONS, ...options };

    if (this.options.persistent && !this.options.storageAdapter) {
      throw new WorkflowEngineError(
        'Storage adapter required when persistence is enabled',
        'MISSING_STORAGE_ADAPTER'
      );
    }

    // Initialize auto-save if persistent
    if (this.options.persistent && this.options.autoSaveIntervalMs > 0) {
      this.autoSaveTimer = setInterval(() => {
        void this.persistWorkflow();
      }, this.options.autoSaveIntervalMs);
    }
  }

  /**
   * Start workflow execution from the beginning or resume from current state
   */
  async startWorkflow(workflow?: PersistentWorkflow): Promise<string> {
    if (workflow) {
      this.workflow = this.validateWorkflow(workflow);
    }

    if (this.isExecuting) {
      throw new WorkflowEngineError(
        'Workflow is already executing',
        'ALREADY_EXECUTING',
        this.workflow.state.currentNodeId
      );
    }

    this.isExecuting = true;
    this.abortController = new AbortController();

    try {
      // Reset state if starting fresh
      if (this.workflow.state.globalStatus === 'idle') {
        this.workflow.state.startedAt = new Date().toISOString();
        this.workflow.state.globalStatus = 'running';
        
        // Find the starting node (entry point)
        const startNode = this.findStartNode();
        if (!startNode) {
          throw new WorkflowEngineError(
            'No starting node found in workflow',
            'NO_START_NODE'
          );
        }
        this.workflow.state.currentNodeId = startNode.id;
      }

      // Create initial checkpoint
      if (this.options.enableCheckpoints) {
        this.createCheckpoint('workflow-start');
      }

      // Emit workflow start event
      this.emitEvent({
        type: 'node-start',
        timestamp: new Date().toISOString(),
        payload: { nodeId: this.workflow.state.currentNodeId },
        workflowId: this.workflow.id,
      });

      // Persist initial state
      await this.persistWorkflow();

      return this.workflow.id;
    } catch (error) {
      this.isExecuting = false;
      throw error;
    }
  }

  /**
   * Execute a specific node by ID
   */
  async executeNode(nodeId: string): Promise<NodeExecutionResult> {
    const node = this.workflow.nodes.find((n) => n.id === nodeId);
    if (!node) {
      throw new WorkflowEngineError(
        `Node not found: ${nodeId}`,
        'NODE_NOT_FOUND',
        nodeId
      );
    }

    // Update node status
    this.updateNodeStatus(nodeId, 'running');

    // Create checkpoint before execution
    if (this.options.enableCheckpoints) {
      this.createCheckpoint(`pre-execute-${nodeId}`);
    }

    // Record timeline event
    this.recordTimelineEvent('node-start', nodeId, { config: node.config });

    const context: NodeExecutionContext = {
      state: this.workflow.state,
      input: this.getNodeInput(nodeId),
      variables: { ...this.workflow.state.variables },
      signal: this.abortController?.signal,
    };

    const startTime = Date.now();

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(node, context);

      // Update state with result
      this.updateStateFromResult(nodeId, result);

      // Update node status
      this.updateNodeStatus(nodeId, result.success ? 'complete' : 'failed');

      // Record completion
      this.recordTimelineEvent('node-complete', nodeId, {
        duration: Date.now() - startTime,
        success: result.success,
      });

      this.emitEvent({
        type: 'node-complete',
        timestamp: new Date().toISOString(),
        payload: { nodeId, result, duration: Date.now() - startTime },
        workflowId: this.workflow.id,
      });

      await this.persistWorkflow();

      return result;
    } catch (error) {
      const errorResult: NodeExecutionResult = {
        success: false,
        output: null,
        error: {
          code: error instanceof Error ? error.name : 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : String(error),
          retryable: true,
        },
      };

      this.updateNodeStatus(nodeId, 'failed');

      this.recordTimelineEvent('node-fail', nodeId, {
        error: errorResult.error,
        duration: Date.now() - startTime,
      });

      this.emitEvent({
        type: 'node-fail',
        timestamp: new Date().toISOString(),
        payload: { nodeId, error: errorResult.error },
        workflowId: this.workflow.id,
      });

      await this.persistWorkflow();

      return errorResult;
    }
  }

  /**
   * Rewind workflow to a specific checkpoint
   */
  async rewindTo(checkpointId: string): Promise<void> {
    const checkpoint = this.workflow.state.checkpoints.find(
      (cp) => cp.id === checkpointId
    );

    if (!checkpoint) {
      throw new WorkflowEngineError(
        `Checkpoint not found: ${checkpointId}`,
        'CHECKPOINT_NOT_FOUND'
      );
    }

    // Prevent rewind during execution
    if (this.isExecuting) {
      throw new WorkflowEngineError(
        'Cannot rewind while workflow is executing',
        'REWIND_DURING_EXECUTION'
      );
    }

    // Set rewinding status
    this.workflow.state.globalStatus = 'rewinding';

    // Restore state from checkpoint
    this.workflow.state.currentNodeId = checkpoint.nodeId;
    this.workflow.state.variables = this.deserializeStateSnapshot(
      checkpoint.stateSnapshot
    ) as Record<string, unknown>;

    // Reset node statuses after checkpoint
    this.resetNodesAfterCheckpoint(checkpoint);

    // Record rewind event
    this.recordTimelineEvent('rewind', checkpoint.nodeId, {
      checkpointId,
      timestamp: checkpoint.timestamp,
    });

    this.emitEvent({
      type: 'rewind',
      timestamp: new Date().toISOString(),
      payload: { checkpointId, restoredNodeId: checkpoint.nodeId },
      workflowId: this.workflow.id,
    });

    // Restore running status
    this.workflow.state.globalStatus = 'running';

    await this.persistWorkflow();
  }

  /**
   * Create a new checkpoint at the current state
   */
  createCheckpoint(label?: string): string {
    const checkpointId = randomUUID();
    
    const checkpoint: Checkpoint = {
      id: checkpointId,
      nodeId: this.workflow.state.currentNodeId,
      timestamp: new Date().toISOString(),
      stateSnapshot: this.serializeStateSnapshot(this.workflow.state.variables),
      label,
    };

    this.workflow.state.checkpoints.push(checkpoint);

    // Trim checkpoints if exceeding max
    if (this.workflow.state.checkpoints.length > this.options.maxCheckpoints) {
      this.workflow.state.checkpoints = this.workflow.state.checkpoints.slice(
        -this.options.maxCheckpoints
      );
    }

    this.recordTimelineEvent('fork', this.workflow.state.currentNodeId, {
      checkpointId,
      label,
    });

    this.emitEvent({
      type: 'checkpoint-created',
      timestamp: new Date().toISOString(),
      payload: { checkpointId, label, nodeId: this.workflow.state.currentNodeId },
      workflowId: this.workflow.id,
    });

    return checkpointId;
  }

  /**
   * Get current workflow state
   */
  getWorkflowState(): WorkflowState {
    return { ...this.workflow.state };
  }

  /**
   * Get full workflow definition
   */
  getWorkflow(): PersistentWorkflow {
    return { ...this.workflow };
  }

  /**
   * Pause workflow execution
   */
  pause(): void {
    if (this.workflow.state.globalStatus === 'running') {
      this.workflow.state.globalStatus = 'paused';
      this.abortController?.abort('Workflow paused by user');
    }
  }

  /**
   * Resume paused workflow
   */
  resume(): void {
    if (this.workflow.state.globalStatus === 'paused') {
      this.workflow.state.globalStatus = 'running';
      this.abortController = new AbortController();
    }
  }

  /**
   * Stop workflow execution
   */
  stop(): void {
    this.isExecuting = false;
    this.abortController?.abort('Workflow stopped by user');
    this.workflow.state.globalStatus = 'idle';
  }

  /**
   * Subscribe to workflow events
   */
  onEvent(handler: WorkflowEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Get workflow statistics
   */
  getStats(): WorkflowStats {
    const nodes = this.workflow.nodes;
    const completedNodes = nodes.filter((n) => n.status === 'complete').length;
    const failedNodes = nodes.filter((n) => n.status === 'failed').length;
    
    const executionTimes = this.workflow.timeline
      .filter((e) => e.type === 'node-complete' && typeof e.data === 'object' && e.data !== null)
      .map((e) => (e.data as { duration?: number }).duration ?? 0)
      .filter((d) => d > 0);

    const totalExecutionTime = executionTimes.reduce((a, b) => a + b, 0);
    const avgExecutionTime = executionTimes.length > 0 
      ? totalExecutionTime / executionTimes.length 
      : 0;

    const rewindCount = this.workflow.timeline.filter(
      (e) => e.type === 'rewind'
    ).length;

    return {
      totalNodes: nodes.length,
      completedNodes,
      failedNodes,
      avgExecutionTimeMs: avgExecutionTime,
      totalExecutionTimeMs: totalExecutionTime,
      rewindCount,
    };
  }

  /**
   * Dispose of the engine and cleanup resources
   */
  dispose(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    this.stop();
    this.eventHandlers.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private validateWorkflow(workflow: PersistentWorkflow): PersistentWorkflow {
    if (!workflow.id) {
      throw new WorkflowEngineError('Workflow ID is required', 'INVALID_WORKFLOW');
    }
    if (!Array.isArray(workflow.nodes)) {
      throw new WorkflowEngineError('Workflow nodes must be an array', 'INVALID_WORKFLOW');
    }
    if (!Array.isArray(workflow.edges)) {
      throw new WorkflowEngineError('Workflow edges must be an array', 'INVALID_WORKFLOW');
    }
    if (!workflow.state) {
      throw new WorkflowEngineError('Workflow state is required', 'INVALID_WORKFLOW');
    }

    // Validate all node IDs are unique
    const nodeIds = new Set<string>();
    for (const node of workflow.nodes) {
      if (nodeIds.has(node.id)) {
        throw new WorkflowEngineError(
          `Duplicate node ID: ${node.id}`,
          'INVALID_WORKFLOW'
        );
      }
      nodeIds.add(node.id);
    }

    // Validate all edge references exist
    for (const edge of workflow.edges) {
      if (!nodeIds.has(edge.from)) {
        throw new WorkflowEngineError(
          `Edge references non-existent node: ${edge.from}`,
          'INVALID_WORKFLOW'
        );
      }
      if (!nodeIds.has(edge.to)) {
        throw new WorkflowEngineError(
          `Edge references non-existent node: ${edge.to}`,
          'INVALID_WORKFLOW'
        );
      }
    }

    return workflow;
  }

  private findStartNode(): VisualNode | undefined {
    // Find nodes with no incoming edges (entry points)
    const incomingEdges = new Set(this.workflow.edges.map((e) => e.to));
    const startNodes = this.workflow.nodes.filter((n) => !incomingEdges.has(n.id));
    
    // Return first start node or first node as fallback
    return startNodes[0] ?? this.workflow.nodes[0];
  }

  private async executeWithTimeout(
    node: VisualNode,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const timeout = node.config.timeoutMs ?? this.options.nodeTimeoutMs;
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Node execution timed out after ${timeout}ms`));
      }, timeout);

      this.executeNodeLogic(node, context)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async executeNodeLogic(
    node: VisualNode,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    // Apply retry policy if configured
    const maxRetries = node.config.retryPolicy?.maxRetries ?? 0;
    const backoffMs = node.config.retryPolicy?.backoffMs ?? 1000;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.invokeEntryFunction(node, context);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          const delay = backoffMs * Math.pow(2, attempt); // Exponential backoff
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error('Node execution failed');
  }

  private async invokeEntryFunction(
    node: VisualNode,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    // This is a placeholder for the actual LangGraph integration
    // In a real implementation, this would dynamically import and call
    // the entry function specified in node.config.entryFunction
    
    // For now, return a mock success result
    return {
      success: true,
      output: {
        nodeId: node.id,
        entryFunction: node.config.entryFunction,
        executedAt: new Date().toISOString(),
        input: context.input,
      },
      variables: context.variables,
    };
  }

  private getNodeInput(nodeId: string): unknown {
    // Find incoming edges
    const incomingEdges = this.workflow.edges.filter((e) => e.to === nodeId);
    
    if (incomingEdges.length === 0) {
      // Start node - use initial variables
      return this.workflow.state.variables;
    }

    // Get output from previous nodes
    const inputs: Record<string, unknown> = {};
    for (const edge of incomingEdges) {
      const prevNode = this.workflow.nodes.find((n) => n.id === edge.from);
      if (prevNode?.status === 'complete') {
        inputs[edge.from] = prevNode.metadata?.output;
      }
    }

    return inputs;
  }

  private updateStateFromResult(
    nodeId: string,
    result: NodeExecutionResult
  ): void {
    // Update variables
    if (result.variables) {
      this.workflow.state.variables = {
        ...this.workflow.state.variables,
        ...result.variables,
      };
    }

    // Update node metadata with output
    const node = this.workflow.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.metadata = {
        ...node.metadata,
        output: result.output,
        executedAt: new Date().toISOString(),
      };
    }

    // Determine next node
    if (result.nextNodeId) {
      this.workflow.state.currentNodeId = result.nextNodeId;
    } else {
      const outgoingEdges = this.workflow.edges.filter((e) => e.from === nodeId);
      if (outgoingEdges.length > 0) {
        // For now, take the first unconditional edge or first edge
        const nextEdge = outgoingEdges.find((e) => !e.condition) ?? outgoingEdges[0];
        if (nextEdge) {
          this.workflow.state.currentNodeId = nextEdge.to;
        }
      }
    }
  }

  private updateNodeStatus(nodeId: string, status: VisualNodeStatus): void {
    const node = this.workflow.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.status = status;
    }
  }

  private recordTimelineEvent(
    type: TemporalEvent['type'],
    nodeId: string,
    data: unknown
  ): void {
    const event: TemporalEvent = {
      id: randomUUID(),
      type,
      nodeId,
      timestamp: new Date().toISOString(),
      data,
      previousEventId: this.workflow.timeline[this.workflow.timeline.length - 1]?.id,
    };

    this.workflow.timeline.push(event);
  }

  private resetNodesAfterCheckpoint(checkpoint: Checkpoint): void {
    // Find timeline events after the checkpoint
    const checkpointIndex = this.workflow.timeline.findIndex(
      (e) => e.id === checkpoint.id
    );
    
    if (checkpointIndex === -1) return;

    const eventsAfter = this.workflow.timeline.slice(checkpointIndex + 1);
    const affectedNodeIds = new Set(
      eventsAfter.map((e) => e.nodeId)
    );

    // Reset status of affected nodes
    for (const nodeId of affectedNodeIds) {
      const node = this.workflow.nodes.find((n) => n.id === nodeId);
      if (node) {
        node.status = 'pending';
        node.metadata = {
          ...node.metadata,
          output: undefined,
          executedAt: undefined,
        };
      }
    }
  }

  private async persistWorkflow(): Promise<void> {
    if (!this.options.persistent || !this.options.storageAdapter) {
      return;
    }

    this.workflow.lastModified = new Date().toISOString();
    await this.options.storageAdapter.save(this.workflow);
  }

  private serializeStateSnapshot(variables: Record<string, unknown>): unknown {
    return JSON.parse(JSON.stringify(variables));
  }

  private deserializeStateSnapshot(snapshot: unknown): Record<string, unknown> {
    if (typeof snapshot === 'object' && snapshot !== null) {
      return snapshot as Record<string, unknown>;
    }
    return {};
  }

  private emitEvent(event: WorkflowEngineEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        void handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
