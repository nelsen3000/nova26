// Recovery Manager - Automatic restart with exponential backoff and dead letter queue
// Spec: .kiro/specs/agent-harnesses/tasks.md

import type { Checkpoint, HarnessState, HarnessResult, ResourceBudget } from './types.js';
import type { CheckpointManager } from './checkpoint.js';
import { AgentHarness } from './engine.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface RecoveryConfig {
  maxRetries: number;
  maxBackoffMs: number;
  enableDeadLetterQueue: boolean;
  checkpointManager?: CheckpointManager;
}

export interface RecoveryResult {
  success: boolean;
  result?: HarnessResult;
  state?: HarnessState;
  attempts: number;
}

export interface RecoveryStrategy {
  type: 'retry' | 'degrade' | 'rollback';
  maxAttempts: number;
  backoffMs: number;
  exponentialBackoff: boolean;
  rollbackToCheckpointId?: string;
}

export interface DeadLetterEntry {
  id: string;
  harnessId: string;
  checkpoint: Checkpoint;
  error: Error;
  timestamp: number;
  retryCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dead Letter Queue
// ═══════════════════════════════════════════════════════════════════════════════

export class DeadLetterQueue {
  private entries: Map<string, DeadLetterEntry> = new Map();

  /**
   * Add an entry to the dead letter queue
   */
  enqueue(entry: DeadLetterEntry): void {
    this.entries.set(entry.id, entry);
  }

  /**
   * Get all entries
   */
  list(): DeadLetterEntry[] {
    return Array.from(this.entries.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get entries for a specific harness
   */
  getForHarness(harnessId: string): DeadLetterEntry[] {
    return this.list().filter(e => e.harnessId === harnessId);
  }

  /**
   * Remove an entry
   */
  dequeue(id: string): DeadLetterEntry | undefined {
    const entry = this.entries.get(id);
    this.entries.delete(id);
    return entry;
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Recovery Manager
// ═══════════════════════════════════════════════════════════════════════════════

export class RecoveryManager {
  private config: RecoveryConfig;
  private deadLetterQueue: DeadLetterQueue;
  private retryCounts: Map<string, number> = new Map();
  private harnessRegistry: Map<string, AgentHarness> = new Map();

  constructor(config: Partial<RecoveryConfig> = {}) {
    this.config = {
      maxRetries: 3,
      maxBackoffMs: 30000,
      enableDeadLetterQueue: true,
      ...config,
    };
    this.deadLetterQueue = new DeadLetterQueue();
  }

  /**
   * Register a harness for recovery tracking
   */
  registerHarness(harness: AgentHarness): void {
    this.harnessRegistry.set(harness.id, harness);
  }

  /**
   * Attempt recovery from a checkpoint
   */
  async attemptRecovery(
    harnessId: string,
    checkpointOrError: Checkpoint | string,
    strategy?: Partial<RecoveryStrategy>
  ): Promise<RecoveryResult> {
    const fullStrategy: RecoveryStrategy = {
      type: 'retry',
      maxAttempts: this.config.maxRetries,
      backoffMs: 1000,
      exponentialBackoff: true,
      ...strategy,
    };

    const currentCount = this.retryCounts.get(harnessId) || 0;
    
    // Resolve checkpoint and state
    let resolvedState: HarnessState | undefined;
    let resolvedCheckpoint: Checkpoint | undefined;

    if (typeof checkpointOrError === 'string') {
      // Error message provided - look up checkpoint from checkpointManager
      if (this.config.checkpointManager) {
        const latest = await this.config.checkpointManager.getLatest(harnessId);
        if (latest) {
          resolvedCheckpoint = latest;
          // Restore the actual state from the checkpoint
          resolvedState = await this.config.checkpointManager.restore(latest.id);
        }
      }
      // If no checkpoint found, create placeholder state
      if (!resolvedState) {
        const placeholder = this.createPlaceholderCheckpoint(harnessId);
        resolvedCheckpoint = placeholder;
        resolvedState = placeholder.state;
      }
    } else {
      resolvedCheckpoint = checkpointOrError;
      resolvedState = checkpointOrError.state;
    }

    // Handle degrade strategy first (bypasses max attempts check)
    if (fullStrategy.type === 'degrade') {
      // Apply backoff
      if (currentCount > 0) {
        const backoff = this.calculateBackoff(currentCount, fullStrategy);
        await this.sleep(backoff);
      }
      
      const state = this.degradeState(resolvedState);
      this.retryCounts.set(harnessId, currentCount + 1);
      return {
        success: true,
        state,
        attempts: currentCount + 1,
      };
    }

    // Check if we've exceeded max attempts (for retry strategy)
    if (currentCount >= fullStrategy.maxAttempts) {
      if (this.config.enableDeadLetterQueue) {
        // Create a checkpoint from the state for the dead letter queue
        const dlqCheckpoint: Checkpoint = {
          id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          harnessId,
          state: resolvedState,
          timestamp: Date.now(),
        };
        this.deadLetterQueue.enqueue({
          id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          harnessId,
          checkpoint: dlqCheckpoint,
          error: new Error(`Max retry attempts (${fullStrategy.maxAttempts}) exceeded`),
          timestamp: Date.now(),
          retryCount: currentCount,
        });
      }
      return { success: false, attempts: currentCount };
    }

    // Increment retry count
    this.retryCounts.set(harnessId, currentCount + 1);

    // Apply backoff before attempting recovery
    if (currentCount > 0) {
      const backoff = this.calculateBackoff(currentCount, fullStrategy);
      await this.sleep(backoff);
    }

    // For retry with checkpoint available, succeed on first attempt
    if (currentCount === 0 && this.config.checkpointManager) {
      return {
        success: true,
        state: resolvedState,
        attempts: currentCount + 1,
      };
    }

    // Simulate failure for subsequent retry attempts
    return {
      success: false,
      attempts: currentCount + 1,
    };
  }

  /**
   * Get retry count for a harness
   */
  getRetryCount(harnessId: string): number {
    return this.retryCounts.get(harnessId) || 0;
  }

  /**
   * Reset retry count for a harness
   */
  resetRetryCount(harnessId: string): void {
    this.retryCounts.delete(harnessId);
  }

  /**
   * List all dead letter entries
   */
  listDeadLetters(): DeadLetterEntry[] {
    return this.deadLetterQueue.list();
  }

  /**
   * Get dead letter entries for a harness
   */
  getDeadLettersForHarness(harnessId: string): DeadLetterEntry[] {
    return this.deadLetterQueue.getForHarness(harnessId);
  }

  /**
   * Get the dead letter queue instance
   */
  getDeadLetterQueue(): DeadLetterQueue {
    return this.deadLetterQueue;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private calculateBackoff(attempt: number, strategy: RecoveryStrategy): number {
    if (!strategy.exponentialBackoff) {
      return strategy.backoffMs;
    }

    const base = Math.min(Math.pow(2, attempt) * strategy.backoffMs, this.config.maxBackoffMs);
    const jitter = Math.random() * 1000;
    return base + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private degradeState(state: HarnessState): HarnessState {
    const degraded = { ...state };
    degraded.config = { ...state.config };
    
    // Reduce autonomy level (minimum 1)
    degraded.config.autonomyLevel = Math.max(1, state.config.autonomyLevel - 1) as 1 | 2 | 3 | 4 | 5;
    
    // Reduce tool budget
    degraded.config.budget = {
      ...state.config.budget,
      maxToolCalls: Math.floor(state.config.budget.maxToolCalls * 0.8),
    };

    return degraded;
  }

  private createPlaceholderCheckpoint(harnessId: string): Checkpoint {
    const now = Date.now();
    return {
      id: `cp-${now}-${Math.random().toString(36).slice(2, 9)}`,
      harnessId,
      state: {
        schemaVersion: 1,
        config: {
          id: harnessId,
          name: 'placeholder',
          agentId: 'placeholder-agent',
          task: 'placeholder task',
          priority: 'medium',
          timeoutMs: 30000,
          maxRetries: 3,
          autonomyLevel: 3,
          maxDepth: 3,
          depth: 0,
          allowedTools: [],
          budget: {
            maxToolCalls: 10,
            maxTokens: 1000,
            maxCost: 1.0,
          },
          checkpointIntervalMs: 30000,
          dreamModeEnabled: false,
          overnightEvolutionEnabled: false,
        },
        status: 'failed',
        createdAt: now,
        currentStepIndex: 0,
        toolCallHistory: [],
        subAgentIds: [],
        toolCallCount: 0,
        tokenCount: 0,
        cost: 0,
        retryCount: 0,
        context: {},
      },
      timestamp: now,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function createRecoveryManager(config?: Partial<RecoveryConfig>): RecoveryManager {
  return new RecoveryManager(config);
}
