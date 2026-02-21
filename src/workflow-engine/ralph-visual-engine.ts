// Ralph Visual Workflow Engine — Persistent execution with rewind
// Inspired by Temporal + LangGraph patterns
// KIMI-R23-01 | Feb 2026

import type {
  PersistentWorkflow,
  WorkflowState,
  VisualNode,
  WorkflowCheckpoint,
  TemporalEvent,
  EventType,
  RewindTarget,
  WorkflowExecutionResult,
  VisualWorkflowEngineConfig,
  NodeStatus,
} from './types.js';

export type NodeExecutorFn = (
  node: VisualNode,
  channelValues: Map<string, unknown>,
) => Promise<{ outputs: Record<string, unknown>; success: boolean; error?: string }>;

export interface EngineEventListener {
  onEvent: (event: TemporalEvent) => void | Promise<void>;
}

const DEFAULT_CONFIG: VisualWorkflowEngineConfig = {
  persistenceEnabled: true,
  maxCheckpoints: 50,
  autoCheckpointEveryN: 5,
  rewindEnabled: true,
  tasteVaultEnabled: true,
  langGraphSimulatorEnabled: true,
  maxConcurrentNodes: 4,
};

export class RalphVisualWorkflowEngine {
  private config: VisualWorkflowEngineConfig;
  private states = new Map<string, WorkflowState>();
  private executor: NodeExecutorFn | null = null;
  private listeners: EngineEventListener[] = [];

  constructor(config: Partial<VisualWorkflowEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setExecutor(fn: NodeExecutorFn): void {
    this.executor = fn;
  }

  addListener(listener: EngineEventListener): void {
    this.listeners.push(listener);
  }

  async startVisualWorkflow(
    workflow: PersistentWorkflow,
    initialValues: Record<string, unknown> = {},
  ): Promise<WorkflowState> {
    const nodeMap = new Map<string, VisualNode>(
      workflow.nodes.map(n => [n.id, { ...n, status: 'pending' }]),
    );
    const channelValues = new Map<string, unknown>();
    for (const [k, v] of Object.entries(workflow.initialChannelValues ?? {})) {
      channelValues.set(k, v);
    }
    for (const [k, v] of Object.entries(initialValues)) {
      channelValues.set(k, v);
    }

    const state: WorkflowState = {
      workflowId: workflow.id,
      name: workflow.name,
      status: 'running',
      nodes: nodeMap,
      edges: workflow.edges,
      checkpoints: [],
      events: [],
      channelValues,
      startedAt: Date.now(),
      currentSequenceNumber: 0,
      tasteVaultScore: 1.0,
    };

    this.states.set(workflow.id, state);
    this.emitEvent(state, 'workflow.started', {});

    // Create initial checkpoint
    this.createCheckpoint(state, 'start');

    // Execute the workflow
    await this.executeWorkflow(state);

    return state;
  }

  async rewindTo(
    workflowId: string,
    target: RewindTarget,
  ): Promise<WorkflowState> {
    if (!this.config.rewindEnabled) {
      throw new Error('Rewind is disabled in config');
    }

    const state = this.states.get(workflowId);
    if (!state) throw new Error(`Workflow ${workflowId} not found`);

    const checkpoint = this.resolveCheckpoint(state, target);
    if (!checkpoint) throw new Error(`Checkpoint not found for target: ${JSON.stringify(target)}`);

    // Restore node states from checkpoint
    for (const [nodeId, status] of Object.entries(checkpoint.nodeStates)) {
      const node = state.nodes.get(nodeId);
      if (node) node.status = status as NodeStatus;
    }

    // Restore channel values
    for (const [key, value] of Object.entries(checkpoint.channelValues)) {
      state.channelValues.set(key, value);
    }

    state.status = 'rewound';
    state.currentSequenceNumber = checkpoint.sequenceNumber;
    this.emitEvent(state, 'workflow.rewound', { checkpointId: checkpoint.id });

    // Re-execute from checkpoint
    state.status = 'running';
    await this.executeWorkflow(state);

    return state;
  }

  getState(workflowId: string): WorkflowState | undefined {
    return this.states.get(workflowId);
  }

  listCheckpoints(workflowId: string): WorkflowCheckpoint[] {
    return this.states.get(workflowId)?.checkpoints ?? [];
  }

  getResult(workflowId: string): WorkflowExecutionResult | undefined {
    const state = this.states.get(workflowId);
    if (!state) return undefined;

    const nodes = [...state.nodes.values()];
    const outputValues: Record<string, unknown> = {};
    for (const [k, v] of state.channelValues) {
      outputValues[k] = v;
    }

    return {
      workflowId: state.workflowId,
      status: state.status,
      completedNodes: nodes.filter(n => n.status === 'completed').map(n => n.id),
      failedNodes: nodes.filter(n => n.status === 'failed').map(n => n.id),
      skippedNodes: nodes.filter(n => n.status === 'skipped').map(n => n.id),
      durationMs: state.completedAt ? state.completedAt - (state.startedAt ?? 0) : Date.now() - (state.startedAt ?? 0),
      checkpointCount: state.checkpoints.length,
      tasteVaultScore: state.tasteVaultScore,
      outputChannelValues: outputValues,
    };
  }

  // ─── Private: Execution ────────────────────────────────────────────────────

  private async executeWorkflow(state: WorkflowState): Promise<void> {
    const visited = new Set<string>();
    let completedThisBatch = 0;

    while (true) {
      const ready = this.getReadyNodes(state, visited);
      if (!ready.length) break;

      // Execute in parallel (up to maxConcurrentNodes)
      const batch = ready.slice(0, this.config.maxConcurrentNodes);
      await Promise.all(batch.map(node => this.executeNode(state, node)));

      for (const node of batch) {
        visited.add(node.id);
        completedThisBatch++;
      }

      // Auto-checkpoint every N nodes
      if (completedThisBatch % this.config.autoCheckpointEveryN === 0) {
        this.createCheckpoint(state, `auto-${completedThisBatch}`);
      }
    }

    const nodes = [...state.nodes.values()];
    const hasFailed = nodes.some(n => n.status === 'failed');
    state.status = hasFailed ? 'failed' : 'completed';
    state.completedAt = Date.now();

    this.createCheckpoint(state, 'final');
    this.emitEvent(state, hasFailed ? 'workflow.failed' : 'workflow.completed', {
      durationMs: state.completedAt - (state.startedAt ?? 0),
    });
  }

  private async executeNode(state: WorkflowState, node: VisualNode): Promise<void> {
    node.status = 'running';
    node.startedAt = Date.now();
    this.emitEvent(state, 'node.started', { nodeId: node.id, agentId: node.agentId });

    try {
      if (!this.executor) {
        // No executor registered — simulate completion
        node.status = 'completed';
        node.completedAt = Date.now();
        this.emitEvent(state, 'node.completed', { nodeId: node.id, durationMs: 0 });
        return;
      }

      const timeoutMs = node.config.timeoutMs ?? 30000;
      const resultPromise = this.executor(node, state.channelValues);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Node ${node.id} timed out after ${timeoutMs}ms`)), timeoutMs),
      );

      const result = await Promise.race([resultPromise, timeoutPromise]);

      if (result.success) {
        // Write outputs to channels
        for (const [outKey, value] of Object.entries(result.outputs)) {
          const channelName = node.config.channelBindings[outKey] ?? outKey;
          state.channelValues.set(channelName, value);
        }
        node.status = 'completed';
        node.completedAt = Date.now();
        this.emitEvent(state, 'node.completed', {
          nodeId: node.id,
          durationMs: node.completedAt - (node.startedAt ?? 0),
        });

        if (node.config.checkpointAfter) {
          this.createCheckpoint(state, `after-${node.id}`);
        }
      } else {
        await this.handleNodeFailure(state, node, new Error(result.error ?? 'Unknown error'));
      }
    } catch (err) {
      await this.handleNodeFailure(state, node, err instanceof Error ? err : new Error(String(err)));
    }
  }

  private async handleNodeFailure(state: WorkflowState, node: VisualNode, err: Error): Promise<void> {
    const maxRetries = node.config.maxRetries ?? 0;
    const retryCount = (node.metadata['retryCount'] as number) ?? 0;

    if (retryCount < maxRetries) {
      node.metadata['retryCount'] = retryCount + 1;
      node.status = 'pending';
      await this.executeNode(state, node);
      return;
    }

    node.status = 'failed';
    node.error = err.message;
    node.completedAt = Date.now();
    this.emitEvent(state, 'node.failed', { nodeId: node.id, error: err.message });
  }

  private getReadyNodes(state: WorkflowState, visited: Set<string>): VisualNode[] {
    const ready: VisualNode[] = [];

    for (const node of state.nodes.values()) {
      if (visited.has(node.id)) continue;
      if (node.status === 'running') continue;
      if (node.status === 'completed' || node.status === 'failed' || node.status === 'skipped') continue;

      const incomingEdges = state.edges.filter(e => e.toNodeId === node.id);
      const allPredecessorsComplete = incomingEdges.every(e => {
        const fromNode = state.nodes.get(e.fromNodeId);
        return fromNode?.status === 'completed' || fromNode?.status === 'skipped';
      });

      if (allPredecessorsComplete) {
        ready.push(node);
      }
    }

    return ready;
  }

  private createCheckpoint(state: WorkflowState, label: string): WorkflowCheckpoint {
    const checkpoint: WorkflowCheckpoint = {
      id: `ckpt-${state.workflowId}-${state.currentSequenceNumber++}`,
      workflowId: state.workflowId,
      sequenceNumber: state.currentSequenceNumber,
      timestamp: Date.now(),
      nodeStates: Object.fromEntries([...state.nodes.entries()].map(([id, n]) => [id, n.status])),
      channelValues: Object.fromEntries(state.channelValues),
      activeNodeIds: [...state.nodes.values()].filter(n => n.status === 'running').map(n => n.id),
      label,
    };

    state.checkpoints.push(checkpoint);
    this.emitEvent(state, 'checkpoint.created', { checkpointId: checkpoint.id, label });

    // Prune old checkpoints
    if (state.checkpoints.length > this.config.maxCheckpoints) {
      state.checkpoints.shift();
    }

    return checkpoint;
  }

  private resolveCheckpoint(state: WorkflowState, target: RewindTarget): WorkflowCheckpoint | undefined {
    if (target.checkpointId) {
      return state.checkpoints.find(c => c.id === target.checkpointId);
    }
    if (target.sequenceNumber !== undefined) {
      return state.checkpoints.find(c => c.sequenceNumber <= target.sequenceNumber!);
    }
    if (target.timestamp !== undefined) {
      return [...state.checkpoints]
        .reverse()
        .find(c => c.timestamp <= target.timestamp!);
    }
    return state.checkpoints[state.checkpoints.length - 1];
  }

  private emitEvent(state: WorkflowState, eventType: EventType, payload: Record<string, unknown>): void {
    const event: TemporalEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      workflowId: state.workflowId,
      eventType,
      timestamp: Date.now(),
      sequenceNumber: state.currentSequenceNumber,
      payload,
    };
    state.events.push(event);

    for (const listener of this.listeners) {
      void listener.onEvent(event);
    }
  }
}
