// Agent Harness Engine - Core state machine and lifecycle management
// Spec: .kiro/specs/agent-harnesses/tasks.md

import { EventEmitter } from 'events';
import type {
  HarnessConfig,
  HarnessState,
  HarnessStatus,
  HarnessResult,
  HarnessInfo,
  HarnessEvent,
  ExecutionPlan,
  ExecutionStep,
  ResourceUsage,
} from './types.js';
import { HarnessStateSchema, HarnessStatusSchema } from './schemas.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Error Types
// ═══════════════════════════════════════════════════════════════════════════════

export class HarnessError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'HarnessError';
  }
}

export class InvalidStateTransitionError extends HarnessError {
  constructor(from: HarnessStatus, to: HarnessStatus) {
    super(
      `Invalid state transition from "${from}" to "${to}"`,
      'INVALID_STATE_TRANSITION'
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Valid State Transitions
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_TRANSITIONS: Record<HarnessStatus, HarnessStatus[]> = {
  created: ['starting', 'stopped'],
  starting: ['running', 'paused', 'failed', 'stopped'],
  running: ['paused', 'completed', 'failed', 'stopping'],
  paused: ['running', 'stopped'],
  stopping: ['stopped', 'failed'],
  stopped: [],
  completed: [],
  failed: [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Task Queue Item
// ═══════════════════════════════════════════════════════════════════════════════

interface QueuedTask {
  id: string;
  harnessId: string;
  priority: number;
  enqueuedAt: number;
  execute: () => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AgentHarness Class
// ═══════════════════════════════════════════════════════════════════════════════

export class AgentHarness extends EventEmitter {
  private state: HarnessState;
  private taskQueue: QueuedTask[] = [];
  private isProcessing = false;
  private startTime?: number;
  private pausedDuration = 0;
  private lastPauseTime?: number;
  private resourceUsage: ResourceUsage = {
    cpuTimeMs: 0,
    memoryBytes: 0,
    wallClockTimeMs: 0,
  };

  constructor(config: HarnessConfig) {
    super();
    const now = Date.now();
    this.state = {
      schemaVersion: 1,
      config,
      status: 'created',
      createdAt: now,
      currentStepIndex: 0,
      toolCallHistory: [],
      subAgentIds: [],
      toolCallCount: 0,
      tokenCount: 0,
      cost: 0,
      retryCount: 0,
      context: {},
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Lifecycle Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Start the harness execution
   */
  async start(): Promise<void> {
    this.validateTransition('starting');
    this.state.status = 'starting';
    this.emit('stateChange', { from: 'created', to: 'starting' });

    try {
      this.startTime = Date.now();
      this.state.startedAt = this.startTime;
      this.state.status = 'running';
      this.emit('stateChange', { from: 'starting', to: 'running' });
      
      // Begin processing task queue
      this.processQueue();
    } catch (error) {
      await this.fail(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Pause the harness execution
   */
  async pause(): Promise<void> {
    if (this.state.status !== 'running') {
      throw new InvalidStateTransitionError(this.state.status, 'paused');
    }

    this.state.status = 'paused';
    this.state.pausedAt = Date.now();
    this.lastPauseTime = Date.now();
    this.emit('stateChange', { from: 'running', to: 'paused' });
    this.emit('paused', { timestamp: this.state.pausedAt });
  }

  /**
   * Resume the harness execution
   */
  async resume(): Promise<void> {
    if (this.state.status !== 'paused') {
      throw new InvalidStateTransitionError(this.state.status, 'running');
    }

    // Accumulate paused duration
    if (this.lastPauseTime) {
      this.pausedDuration += Date.now() - this.lastPauseTime;
      this.lastPauseTime = undefined;
    }

    this.state.status = 'running';
    this.state.pausedAt = undefined;
    this.emit('stateChange', { from: 'paused', to: 'running' });
    this.emit('resumed', { timestamp: Date.now() });

    // Resume processing
    this.processQueue();
  }

  /**
   * Stop the harness execution
   */
  async stop(reason?: string): Promise<HarnessResult> {
    const fromStatus = this.state.status;
    
    // Can stop from: running, starting, paused (via stopping)
    const canStop = ['running', 'starting', 'paused', 'stopping', 'created', 'stopped'].includes(fromStatus);
    if (!canStop) {
      throw new InvalidStateTransitionError(fromStatus, 'stopped');
    }

    if (fromStatus !== 'stopped' && fromStatus !== 'completed' && fromStatus !== 'failed') {
      const prevStatus = this.state.status;
      this.state.status = 'stopping';
      this.emit('stateChange', { from: prevStatus, to: 'stopping' });
    }

    // Clear remaining tasks
    this.taskQueue = [];
    this.isProcessing = false;

    const now = Date.now();
    this.state.status = 'stopped';
    this.state.completedAt = now;

    this.emit('stateChange', { from: 'stopping', to: 'stopped' });
    this.emit('stopped', { reason, timestamp: now });

    return this.buildResult();
  }

  /**
   * Complete the harness successfully
   */
  async complete(output?: string): Promise<HarnessResult> {
    if (this.state.status !== 'running') {
      throw new InvalidStateTransitionError(this.state.status, 'completed');
    }

    const now = Date.now();
    this.state.status = 'completed';
    this.state.completedAt = now;

    if (output !== undefined) {
      this.state.context.output = output;
    }

    this.emit('stateChange', { from: 'running', to: 'completed' });
    this.emit('completed', { output, timestamp: now });

    return this.buildResult();
  }

  /**
   * Mark the harness as failed
   */
  async fail(error: Error): Promise<HarnessResult> {
    const now = Date.now();
    
    this.state.status = 'failed';
    this.state.completedAt = now;
    this.state.error = {
      code: error.name || 'UNKNOWN_ERROR',
      message: error.message,
      stack: error.stack,
      timestamp: now,
    };

    this.emit('stateChange', { from: this.state.status, to: 'failed' });
    this.emit('failed', { error, timestamp: now });

    return this.buildResult();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Task Queue Management
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Enqueue a task with priority
   */
  enqueueTask(task: Omit<QueuedTask, 'harnessId' | 'enqueuedAt'>): void {
    if (this.state.status === 'stopped' || this.state.status === 'completed' || this.state.status === 'failed') {
      throw new HarnessError(
        `Cannot enqueue task on ${this.state.status} harness`,
        'HARNESS_INACTIVE'
      );
    }

    const queuedTask: QueuedTask = {
      ...task,
      harnessId: this.state.config.id,
      enqueuedAt: Date.now(),
    };

    // Insert based on priority (higher first), then FIFO
    const insertIndex = this.taskQueue.findIndex(t => t.priority < task.priority);
    if (insertIndex === -1) {
      this.taskQueue.push(queuedTask);
    } else {
      this.taskQueue.splice(insertIndex, 0, queuedTask);
    }

    this.emit('taskEnqueued', { taskId: task.id, priority: task.priority });

    // Auto-start if created
    if (this.state.status === 'created') {
      this.start().catch(() => {
        // Error handled via fail()
      });
    }
  }

  /**
   * Process the task queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.state.status !== 'running') {
      return;
    }

    this.isProcessing = true;

    while (this.taskQueue.length > 0 && this.state.status === 'running') {
      const task = this.taskQueue.shift();
      if (!task) continue;

      try {
        this.emit('taskStarting', { taskId: task.id });
        await task.execute();
        this.emit('taskCompleted', { taskId: task.id });
      } catch (error) {
        this.emit('taskFailed', { 
          taskId: task.id, 
          error: error instanceof Error ? error.message : String(error) 
        });
        
        // Don't fail the harness for individual task failures
        // Let the harness continue processing other tasks
      }
    }

    this.isProcessing = false;

    // Auto-complete if no more tasks and not explicitly stopped/paused
    if (this.taskQueue.length === 0 && this.state.status === 'running') {
      // Don't auto-complete - let the harness run until explicitly completed
      this.emit('queueEmpty', { timestamp: Date.now() });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // State Management
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get current harness state (serializable snapshot)
   */
  getState(): HarnessState {
    // Return a deep copy to prevent external mutation
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Get harness info summary
   */
  getInfo(): HarnessInfo {
    const now = Date.now();
    const elapsed = this.startTime ? now - this.startTime - this.pausedDuration : 0;
    const progress = this.calculateProgress();

    return {
      id: this.state.config.id,
      name: this.state.config.name,
      agentId: this.state.config.agentId,
      status: this.state.status,
      priority: this.state.config.priority,
      progress,
      createdAt: this.state.createdAt,
      startedAt: this.state.startedAt,
      estimatedCompletionAt: this.estimateCompletion(elapsed, progress),
      parentId: this.state.config.parentId,
      subAgentCount: this.state.subAgentIds.length,
    };
  }

  /**
   * Update execution plan
   */
  setExecutionPlan(plan: ExecutionPlan): void {
    this.state.executionPlan = plan;
    this.emit('planUpdated', { planId: plan.id, steps: plan.steps.length });
  }

  /**
   * Update current step
   */
  setCurrentStep(stepIndex: number): void {
    this.state.currentStepIndex = stepIndex;
    this.emit('stepChanged', { stepIndex });
  }

  /**
   * Update context data
   */
  setContext(key: string, value: unknown): void {
    this.state.context[key] = value;
  }

  /**
   * Get context data
   */
  getContext(key: string): unknown {
    return this.state.context[key];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Resource Management
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record tool call
   */
  recordToolCall(toolCall: {
    toolName: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    error?: string;
    durationMs: number;
    retryCount: number;
    cost: number;
    success: boolean;
  }): void {
    const record = {
      id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      ...toolCall,
      timestamp: Date.now(),
    };

    this.state.toolCallHistory.push(record);
    this.state.toolCallCount++;
    this.state.cost += toolCall.cost;

    this.emit('toolCall', { record });

    // Check budget
    if (this.state.toolCallCount >= this.state.config.budget.maxToolCalls) {
      this.emit('budgetExceeded', { type: 'toolCalls', limit: this.state.config.budget.maxToolCalls });
    }
  }

  /**
   * Record token usage
   */
  recordTokenUsage(tokens: number): void {
    this.state.tokenCount += tokens;
    this.emit('tokenUsage', { total: this.state.tokenCount, delta: tokens });

    // Check budget
    if (this.state.tokenCount >= this.state.config.budget.maxTokens) {
      this.emit('budgetExceeded', { type: 'tokens', limit: this.state.config.budget.maxTokens });
    }
  }

  /**
   * Update resource usage
   */
  updateResourceUsage(usage: Partial<ResourceUsage>): void {
    this.resourceUsage = { ...this.resourceUsage, ...usage };
  }

  /**
   * Get resource usage
   */
  getResourceUsage(): ResourceUsage {
    const wallClockTime = this.startTime 
      ? Date.now() - this.startTime - this.pausedDuration 
      : 0;
    
    return {
      ...this.resourceUsage,
      wallClockTimeMs: wallClockTime,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Sub-Agent Management
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Register a sub-agent
   */
  registerSubAgent(subAgentId: string): void {
    this.state.subAgentIds.push(subAgentId);
    this.emit('subAgentRegistered', { subAgentId });
  }

  /**
   * Check if can spawn sub-agent (depth limit)
   */
  canSpawnSubAgent(): boolean {
    return this.state.config.depth < this.state.config.maxDepth;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Checkpoint Support
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create checkpoint
   */
  createCheckpoint(): { state: HarnessState; timestamp: number } {
    this.state.lastCheckpointAt = Date.now();
    this.emit('checkpoint', { timestamp: this.state.lastCheckpointAt });
    return {
      state: this.getState(),
      timestamp: this.state.lastCheckpointAt,
    };
  }

  /**
   * Restore from checkpoint
   */
  restoreCheckpoint(checkpointState: HarnessState): void {
    // Validate the checkpoint
    const validated = HarnessStateSchema.parse(checkpointState);
    
    // Restore state
    this.state = validated;
    this.startTime = this.state.startedAt;
    this.pausedDuration = 0;
    
    this.emit('checkpointRestored', { timestamp: Date.now() });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private validateTransition(toStatus: HarnessStatus): void {
    const fromStatus = this.state.status;
    const validTransitions = VALID_TRANSITIONS[fromStatus];
    
    if (!validTransitions.includes(toStatus)) {
      throw new InvalidStateTransitionError(fromStatus, toStatus);
    }
  }

  private calculateProgress(): number {
    if (!this.state.executionPlan) {
      return this.state.status === 'completed' ? 100 : 0;
    }

    const totalSteps = this.state.executionPlan.steps.length;
    if (totalSteps === 0) {
      return this.state.status === 'completed' ? 100 : 0;
    }

    const completedSteps = this.state.executionPlan.steps.filter(
      s => s.status === 'completed'
    ).length;

    return Math.round((completedSteps / totalSteps) * 100);
  }

  private estimateCompletion(elapsedMs: number, progress: number): number | undefined {
    if (progress <= 0 || progress >= 100) {
      return undefined;
    }

    const remainingProgress = 100 - progress;
    const msPerPercent = elapsedMs / progress;
    const estimatedRemaining = remainingProgress * msPerPercent;

    return Date.now() + estimatedRemaining;
  }

  private buildResult(): HarnessResult {
    const now = Date.now();
    const durationMs = this.startTime 
      ? now - this.startTime - this.pausedDuration 
      : 0;

    return {
      harnessId: this.state.config.id,
      status: this.state.status as 'completed' | 'failed' | 'stopped',
      output: this.state.context.output as string | undefined,
      durationMs,
      toolCallCount: this.state.toolCallCount,
      tokenCount: this.state.tokenCount,
      cost: this.state.cost,
      subAgentResults: [], // Would be populated from sub-agent results
      error: this.state.error,
      finalState: this.getState(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

export function createAgentHarness(config: HarnessConfig): AgentHarness {
  return new AgentHarness(config);
}
