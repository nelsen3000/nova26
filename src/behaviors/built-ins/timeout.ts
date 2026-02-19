// Timeout Behavior - Execution time limits
// KIMI-W-03: Built-in behavior

import type {
  Behavior,
  BehaviorContext,
  BehaviorResult,
  TimeoutConfig,
} from '../types.js';

/**
 * Timeout error - thrown when operation exceeds time limit
 */
export class TimeoutError extends Error {
  constructor(
    public readonly timeoutMs: number,
    public readonly operationName?: string
  ) {
    super(
      operationName
        ? `Operation "${operationName}" timed out after ${timeoutMs}ms`
        : `Operation timed out after ${timeoutMs}ms`
    );
    this.name = 'TimeoutError';
  }
}

/**
 * Default timeout configuration
 */
export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  name: 'timeout',
  timeoutMs: 30000,
  throwOnTimeout: true,
  enabled: true,
};

/**
 * Timeout behavior implementation
 */
export class TimeoutBehavior implements Behavior<TimeoutConfig> {
  readonly name = 'timeout';
  config: TimeoutConfig;
  private timeoutHistory: Map<string, boolean> = new Map();

  constructor(config: Partial<TimeoutConfig> = {}) {
    this.config = { ...DEFAULT_TIMEOUT_CONFIG, ...config };
  }

  async execute<T>(
    operation: (ctx: BehaviorContext) => Promise<T>,
    context: BehaviorContext
  ): Promise<BehaviorResult<T>> {
    const startTime = Date.now();
    const timeoutMs = this.config.timeoutMs;
    
    return new Promise((resolve) => {
      let completed = false;
      
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          if (!completed) {
            const error = new TimeoutError(timeoutMs, context.taskId);
            reject(error);
          }
        }, timeoutMs);
      });
      
      // Create operation promise
      const operationPromise = (async () => {
        try {
          const data = await operation(context);
          completed = true;
          return {
            success: true as const,
            data,
            durationMs: Date.now() - startTime,
            attempts: 1,
            metadata: {
              timedOut: false,
              timeoutMs,
            },
          };
        } catch (error) {
          completed = true;
          return {
            success: false as const,
            error: error instanceof Error ? error : new Error(String(error)),
            durationMs: Date.now() - startTime,
            attempts: 1,
            metadata: {
              timedOut: false,
              timeoutMs,
            },
          };
        }
      })();
      
      // Race between timeout and operation
      Promise.race([operationPromise, timeoutPromise])
        .then(result => {
          if (result.success) {
            resolve(result);
          } else {
            resolve(result as BehaviorResult<T>);
          }
        })
        .catch(error => {
          this.timeoutHistory.set(context.executionId, true);
          
          if (this.config.throwOnTimeout) {
            resolve({
              success: false,
              error: error instanceof Error ? error : new Error(String(error)),
              durationMs: Date.now() - startTime,
              attempts: 1,
              metadata: {
                timedOut: true,
                timeoutMs,
              },
            });
          } else {
            // Return success with undefined data on timeout (non-throwing mode)
            resolve({
              success: true,
              data: undefined as unknown as T,
              durationMs: Date.now() - startTime,
              attempts: 1,
              metadata: {
                timedOut: true,
                timeoutMs,
              },
            });
          }
        });
    });
  }

  reset(): void {
    this.timeoutHistory.clear();
  }

  /**
   * Check if an execution timed out
   */
  didTimeout(executionId: string): boolean {
    return this.timeoutHistory.get(executionId) ?? false;
  }

  /**
   * Get count of timed out executions
   */
  getTimeoutCount(): number {
    return Array.from(this.timeoutHistory.values()).filter(Boolean).length;
  }
}

/**
 * Create timeout behavior factory
 */
export function createTimeoutBehavior(config?: Partial<TimeoutConfig>): TimeoutBehavior {
  return new TimeoutBehavior(config);
}
