// Backoff Behavior - Delay with exponential backoff and jitter
// KIMI-W-03: Built-in behavior

import type {
  Behavior,
  BehaviorContext,
  BehaviorResult,
  BackoffConfig,
} from '../types.js';

/**
 * Default backoff configuration
 */
export const DEFAULT_BACKOFF_CONFIG: BackoffConfig = {
  name: 'backoff',
  initialDelayMs: 100,
  maxDelayMs: 30000,
  multiplier: 2,
  jitter: true,
  enabled: true,
  timeoutMs: 30000,
};

/**
 * Backoff behavior implementation
 * 
 * This behavior wraps an operation and applies a delay before execution
 * with exponential backoff. Useful for rate limiting and preventing
 * thundering herd problems.
 */
export class BackoffBehavior implements Behavior<BackoffConfig> {
  readonly name = 'backoff';
  config: BackoffConfig;
  private delayHistory: Map<string, number> = new Map();
  private executionCount = 0;

  constructor(config: Partial<BackoffConfig> = {}) {
    this.config = { ...DEFAULT_BACKOFF_CONFIG, ...config };
  }

  async execute<T>(
    operation: (ctx: BehaviorContext) => Promise<T>,
    context: BehaviorContext
  ): Promise<BehaviorResult<T>> {
    const startTime = Date.now();
    this.executionCount++;
    
    // Calculate delay based on execution count and attempt number
    const attempt = context.attempt ?? 1;
    const delayMs = this.calculateDelay(attempt);
    
    // Record delay for this execution
    this.delayHistory.set(context.executionId, delayMs);
    
    // Apply delay
    if (delayMs > 0) {
      await this.sleep(delayMs);
    }
    
    const actualStartTime = Date.now();
    
    try {
      const data = await operation(context);
      
      return {
        success: true,
        data,
        durationMs: Date.now() - actualStartTime,
        attempts: 1,
        metadata: {
          delayedMs: delayMs,
          totalDurationMs: Date.now() - startTime,
          executionCount: this.executionCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        durationMs: Date.now() - actualStartTime,
        attempts: 1,
        metadata: {
          delayedMs: delayMs,
          totalDurationMs: Date.now() - startTime,
          executionCount: this.executionCount,
        },
      };
    }
  }

  reset(): void {
    this.delayHistory.clear();
    this.executionCount = 0;
  }

  /**
   * Calculate delay for given attempt
   */
  calculateDelay(attempt: number): number {
    // Base delay with exponential backoff
    let delay = this.config.initialDelayMs * Math.pow(this.config.multiplier, attempt - 1);
    
    // Cap at max delay
    delay = Math.min(delay, this.config.maxDelayMs);
    
    // Add jitter (random variation ±25%) to prevent thundering herd
    if (this.config.jitter) {
      const jitterFactor = 0.75 + Math.random() * 0.5; // 0.75 to 1.25
      delay = Math.floor(delay * jitterFactor);
    }
    
    return delay;
  }

  /**
   * Get delay applied for an execution
   */
  getDelay(executionId: string): number | undefined {
    return this.delayHistory.get(executionId);
  }

  /**
   * Get average delay across all executions
   */
  getAverageDelay(): number {
    const delays = Array.from(this.delayHistory.values());
    if (delays.length === 0) return 0;
    return delays.reduce((a, b) => a + b, 0) / delays.length;
  }

  /**
   * Get delay statistics
   */
  getStats(): {
    min: number;
    max: number;
    average: number;
    count: number;
  } {
    const delays = Array.from(this.delayHistory.values());
    if (delays.length === 0) {
      return { min: 0, max: 0, average: 0, count: 0 };
    }
    
    return {
      min: Math.min(...delays),
      max: Math.max(...delays),
      average: this.getAverageDelay(),
      count: delays.length,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create backoff behavior factory
 */
export function createBackoffBehavior(config?: Partial<BackoffConfig>): BackoffBehavior {
  return new BackoffBehavior(config);
}

/**
 * Predefined backoff strategies
 */
export const BackoffStrategies = {
  /** Linear backoff: delay = initialDelay * attempt */
  linear: (initialDelayMs: number) => ({
    initialDelayMs,
    multiplier: 1,
    jitter: false,
  }),
  
  /** Exponential backoff: delay = initialDelay * 2^attempt */
  exponential: (initialDelayMs: number) => ({
    initialDelayMs,
    multiplier: 2,
    jitter: false,
  }),
  
  /** Fibonacci backoff: delays follow fibonacci sequence */
  fibonacci: (initialDelayMs: number) => ({
    initialDelayMs,
    multiplier: 1.618, // Golden ratio approximation
    jitter: false,
  }),
  
  /** Decorrelated jitter: randomized exponential */
  decorrelated: (initialDelayMs: number) => ({
    initialDelayMs,
    multiplier: 3,
    jitter: true,
  }),
};
