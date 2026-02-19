// Retry Behavior - Automatic retry with backoff
// KIMI-W-03: Built-in behavior

import type {
  Behavior,
  BehaviorContext,
  BehaviorResult,
  RetryConfig,
} from '../types.js';

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  name: 'retry',
  maxRetries: 3,
  retryDelayMs: 1000,
  backoffMultiplier: 2,
  enabled: true,
  timeoutMs: 30000,
};

/**
 * Retry behavior implementation
 */
export class RetryBehavior implements Behavior<RetryConfig> {
  readonly name = 'retry';
  config: RetryConfig;
  private attemptHistory: Map<string, number> = new Map();

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  async execute<T>(
    operation: (ctx: BehaviorContext) => Promise<T>,
    context: BehaviorContext
  ): Promise<BehaviorResult<T>> {
    const startTime = Date.now();
    let lastError: Error | undefined;
    
    const maxAttempts = this.config.enabled !== false ? this.config.maxRetries + 1 : 1;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const attemptContext: BehaviorContext = {
          ...context,
          attempt,
        };
        
        const data = await operation(attemptContext);
        
        return {
          success: true,
          data,
          durationMs: Date.now() - startTime,
          attempts: attempt,
          metadata: {
            maxAttempts,
            finalAttempt: attempt,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if error is retryable
        if (!this.isRetryable(lastError)) {
          return {
            success: false,
            error: lastError,
            durationMs: Date.now() - startTime,
            attempts: attempt,
            metadata: { notRetryable: true },
          };
        }
        
        // Track attempt
        this.attemptHistory.set(context.executionId, attempt);
        
        // Calculate delay with backoff
        if (attempt < maxAttempts) {
          const delayMs = this.calculateDelay(attempt);
          await this.sleep(delayMs);
        }
      }
    }
    
    return {
      success: false,
      error: lastError ?? new Error('Max retries exceeded'),
      durationMs: Date.now() - startTime,
      attempts: maxAttempts,
      metadata: { maxAttemptsExceeded: true },
    };
  }

  reset(): void {
    this.attemptHistory.clear();
  }

  /**
   * Check if an error should be retried
   */
  private isRetryable(error: Error): boolean {
    // If no custom predicates, retry all errors
    if (!this.config.retryableErrors || this.config.retryableErrors.length === 0) {
      return true;
    }
    
    return this.config.retryableErrors.some(predicate => predicate(error));
  }

  /**
   * Calculate delay with exponential backoff
   */
  private calculateDelay(attempt: number): number {
    const delay = this.config.retryDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
    return Math.min(delay, 30000); // Cap at 30 seconds
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get attempt count for an execution
   */
  getAttemptCount(executionId: string): number {
    return this.attemptHistory.get(executionId) ?? 0;
  }
}

/**
 * Create retry behavior factory
 */
export function createRetryBehavior(config?: Partial<RetryConfig>): RetryBehavior {
  return new RetryBehavior(config);
}
