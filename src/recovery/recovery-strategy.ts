// Recovery Strategy — Advanced Error Recovery (R17-01)
// Orchestrates error recovery with multiple strategies and backoff

import { randomUUID } from 'crypto';
import type { ClassifiedError } from './error-classifier.js';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type StrategyType =
  | 'retry-transient'
  | 'retry-model'
  | 'fallback-model'
  | 'checkpoint-resume'
  | 'skip-task'
  | 'graceful-degrade'
  | 'abort';

export interface RecoveryStrategy {
  type: StrategyType;
  name: string;
  description: string;
  applicableClasses: string[];
  priority: number;             // lower is higher priority
  maxAttempts: number;
}

export interface RecoveryAttempt {
  id: string;
  strategyType: StrategyType;
  attemptNumber: number;
  startedAt: string;
  completedAt?: string;
  success: boolean;
  error?: string;
}

export interface RecoveryResult {
  id: string;
  errorId: string;
  strategy: StrategyType;
  attempts: RecoveryAttempt[];
  success: boolean;
  finalError?: string;
  startedAt: string;
  completedAt: string;
}

export interface RecoveryConfig {
  maxRetries: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  globalTimeoutMs: number;
}

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  maxRetries: 3,
  baseBackoffMs: 1000,
  maxBackoffMs: 30000,
  backoffMultiplier: 2,
  jitterEnabled: true,
  globalTimeoutMs: 120000,
};

// ============================================================================
// Built-in Strategies
// ============================================================================

const BUILT_IN_STRATEGIES: RecoveryStrategy[] = [
  {
    type: 'retry-transient',
    name: 'Retry Transient Error',
    description: 'Retry with exponential backoff for transient errors',
    applicableClasses: ['network', 'timeout'],
    priority: 1,
    maxAttempts: 3,
  },
  {
    type: 'retry-model',
    name: 'Retry Model Call',
    description: 'Retry the model call with adjusted parameters',
    applicableClasses: ['model'],
    priority: 2,
    maxAttempts: 2,
  },
  {
    type: 'fallback-model',
    name: 'Fallback to Alternative Model',
    description: 'Switch to a fallback model',
    applicableClasses: ['model', 'resource', 'rate-limit'],
    priority: 3,
    maxAttempts: 3,
  },
  {
    type: 'checkpoint-resume',
    name: 'Resume from Checkpoint',
    description: 'Load the last checkpoint and resume from there',
    applicableClasses: ['resource', 'timeout', 'network'],
    priority: 4,
    maxAttempts: 1,
  },
  {
    type: 'skip-task',
    name: 'Skip Failed Task',
    description: 'Skip the current task and continue with the next',
    applicableClasses: ['validation', 'filesystem'],
    priority: 5,
    maxAttempts: 1,
  },
  {
    type: 'graceful-degrade',
    name: 'Graceful Degradation',
    description: 'Continue with reduced functionality',
    applicableClasses: ['network', 'timeout', 'rate-limit', 'model', 'resource'],
    priority: 6,
    maxAttempts: 1,
  },
  {
    type: 'abort',
    name: 'Abort Operation',
    description: 'Stop the operation and report failure',
    applicableClasses: ['auth', 'unknown'],
    priority: 7,
    maxAttempts: 1,
  },
];

// ============================================================================
// RecoveryOrchestrator
// ============================================================================

export class RecoveryOrchestrator {
  private readonly config: RecoveryConfig;
  private readonly strategies: RecoveryStrategy[];
  private readonly recoveryHistory: RecoveryResult[] = [];

  constructor(
    config?: Partial<RecoveryConfig>,
    additionalStrategies?: RecoveryStrategy[],
  ) {
    this.config = { ...DEFAULT_RECOVERY_CONFIG, ...config };
    this.strategies = [...BUILT_IN_STRATEGIES, ...(additionalStrategies ?? [])];
  }

  getStrategies(): RecoveryStrategy[] {
    return [...this.strategies];
  }

  selectStrategy(error: ClassifiedError): RecoveryStrategy | null {
    const applicable = this.strategies
      .filter(s => s.applicableClasses.includes(error.errorClass))
      .sort((a, b) => a.priority - b.priority);

    return applicable.length > 0 ? applicable[0] : null;
  }

  computeBackoff(attempt: number): number {
    const exponential = this.config.baseBackoffMs * Math.pow(this.config.backoffMultiplier, attempt);
    const capped = Math.min(exponential, this.config.maxBackoffMs);

    if (this.config.jitterEnabled) {
      const jitter = Math.random() * capped * 0.5;
      return Math.floor(capped + jitter);
    }

    return Math.floor(capped);
  }

  async executeStrategy(
    strategy: RecoveryStrategy,
    error: ClassifiedError,
    action: () => Promise<void>,
  ): Promise<RecoveryResult> {
    const resultId = randomUUID();
    const attempts: RecoveryAttempt[] = [];
    const startedAt = new Date().toISOString();
    const maxAttempts = Math.min(strategy.maxAttempts, this.config.maxRetries);
    let success = false;
    let finalError: string | undefined;

    for (let i = 0; i < maxAttempts; i++) {
      const attemptId = randomUUID();
      const attemptStartedAt = new Date().toISOString();

      try {
        await action();
        attempts.push({
          id: attemptId,
          strategyType: strategy.type,
          attemptNumber: i + 1,
          startedAt: attemptStartedAt,
          completedAt: new Date().toISOString(),
          success: true,
        });
        success = true;
        break;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        attempts.push({
          id: attemptId,
          strategyType: strategy.type,
          attemptNumber: i + 1,
          startedAt: attemptStartedAt,
          completedAt: new Date().toISOString(),
          success: false,
          error: errMsg,
        });
        finalError = errMsg;

        if (i < maxAttempts - 1) {
          const delay = this.computeBackoff(i);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    const result: RecoveryResult = {
      id: resultId,
      errorId: error.id,
      strategy: strategy.type,
      attempts,
      success,
      finalError: success ? undefined : finalError,
      startedAt,
      completedAt: new Date().toISOString(),
    };

    this.recoveryHistory.push(result);
    return result;
  }

  async orchestrate(
    error: ClassifiedError,
    action: () => Promise<void>,
  ): Promise<RecoveryResult> {
    const strategy = this.selectStrategy(error);

    if (!strategy) {
      // No applicable strategy — create abort result
      const result: RecoveryResult = {
        id: randomUUID(),
        errorId: error.id,
        strategy: 'abort',
        attempts: [],
        success: false,
        finalError: `No applicable strategy for error class '${error.errorClass}'`,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      this.recoveryHistory.push(result);
      return result;
    }

    return this.executeStrategy(strategy, error, action);
  }

  getRecoveryHistory(): RecoveryResult[] {
    return [...this.recoveryHistory];
  }
}
