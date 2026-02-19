// Circuit Breaker Behavior - Fault tolerance pattern
// KIMI-W-03: Built-in behavior

import type {
  Behavior,
  BehaviorContext,
  BehaviorResult,
  CircuitBreakerConfig,
  CircuitState,
} from '../types.js';

/**
 * Circuit breaker error - thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  constructor(
    public readonly nextRetryAt: Date,
    public readonly openDurationMs: number
  ) {
    super(`Circuit breaker is OPEN. Retry after ${nextRetryAt.toISOString()}`);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  name: 'circuit-breaker',
  failureThreshold: 5,
  successThreshold: 3,
  timeoutMs: 60000,
  enabled: true,
};

/**
 * Circuit breaker behavior implementation
 */
export class CircuitBreakerBehavior implements Behavior<CircuitBreakerConfig> {
  readonly name = 'circuit-breaker';
  config: CircuitBreakerConfig;
  
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private halfOpenAttempts = 0;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
  }

  async execute<T>(
    operation: (ctx: BehaviorContext) => Promise<T>,
    context: BehaviorContext
  ): Promise<BehaviorResult<T>> {
    const startTime = Date.now();
    
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === 'OPEN') {
      const now = Date.now();
      const openDuration = this.lastFailureTime ? now - this.lastFailureTime : 0;
      
      if (openDuration >= this.config.timeoutMs) {
        this.transitionTo('HALF_OPEN');
      } else {
        const nextRetryAt = new Date((this.lastFailureTime ?? now) + this.config.timeoutMs);
        const error = new CircuitOpenError(nextRetryAt, this.config.timeoutMs - openDuration);
        
        return {
          success: false,
          error,
          durationMs: Date.now() - startTime,
          attempts: 0,
          metadata: {
            circuitState: this.state,
            failureCount: this.failureCount,
          },
        };
      }
    }
    
    try {
      const data = await operation(context);
      this.onSuccess();
      
      return {
        success: true,
        data,
        durationMs: Date.now() - startTime,
        attempts: 1,
        metadata: {
          circuitState: this.state,
          failureCount: this.failureCount,
          successCount: this.successCount,
        },
      };
    } catch (error) {
      this.onFailure();
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        durationMs: Date.now() - startTime,
        attempts: 1,
        metadata: {
          circuitState: this.state,
          failureCount: this.failureCount,
          successCount: this.successCount,
        },
      };
    }
  }

  reset(): void {
    this.transitionTo('CLOSED');
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.halfOpenAttempts = 0;
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: string | null;
    halfOpenAttempts: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      halfOpenAttempts: this.halfOpenAttempts,
    };
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo('CLOSED');
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'HALF_OPEN') {
      this.transitionTo('OPEN');
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state !== newState) {
      this.state = newState;
      
      if (newState === 'CLOSED') {
        this.failureCount = 0;
        this.successCount = 0;
        this.halfOpenAttempts = 0;
      } else if (newState === 'HALF_OPEN') {
        this.halfOpenAttempts = 0;
        this.successCount = 0;
      }
    }
  }
}

/**
 * Create circuit breaker behavior factory
 */
export function createCircuitBreakerBehavior(
  config?: Partial<CircuitBreakerConfig>
): CircuitBreakerBehavior {
  return new CircuitBreakerBehavior(config);
}
