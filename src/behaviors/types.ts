// Behavior System - Core Types
// KIMI-W-03: Behavior system foundation

/**
 * Context passed to behavior execution
 */
export interface BehaviorContext {
  /** Unique execution ID */
  executionId: string;
  /** Agent name executing the behavior */
  agentName: string;
  /** Task ID if applicable */
  taskId?: string;
  /** Current attempt number (for retries) */
  attempt: number;
  /** Timestamp when execution started */
  startedAt: string;
  /** Arbitrary metadata */
  metadata: Record<string, unknown>;
}

/**
 * Result of behavior execution
 */
export interface BehaviorResult<T = unknown> {
  /** Whether execution succeeded */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error if failed */
  error?: Error;
  /** Execution duration in ms */
  durationMs: number;
  /** Number of attempts made */
  attempts: number;
  /** Behavior-specific metadata */
  metadata: Record<string, unknown>;
}

/**
 * Behavior configuration base interface
 */
export interface BehaviorConfig {
  /** Behavior name */
  name: string;
  /** Whether behavior is enabled */
  enabled?: boolean;
  /** Timeout in ms (default: 30000) */
  timeoutMs?: number;
}

/**
 * Core behavior interface
 */
export interface Behavior<TConfig extends BehaviorConfig = BehaviorConfig, TResult = unknown> {
  /** Unique behavior name */
  readonly name: string;
  /** Behavior configuration */
  config: TConfig;
  
  /**
   * Execute the behavior with given context
   * @param operation - The operation to wrap
   * @param context - Execution context
   * @returns Behavior result
   */
  execute<T>(
    operation: (ctx: BehaviorContext) => Promise<T>,
    context: BehaviorContext
  ): Promise<BehaviorResult<TResult>>;
  
  /**
   * Reset any internal state
   */
  reset(): void;
}

/**
 * Retry behavior configuration
 */
export interface RetryConfig extends BehaviorConfig {
  name: 'retry';
  /** Maximum retry attempts */
  maxRetries: number;
  /** Delay between retries in ms */
  retryDelayMs: number;
  /** Backoff multiplier (1 = linear, 2 = exponential) */
  backoffMultiplier: number;
  /** Retryable error predicates */
  retryableErrors?: ((error: Error) => boolean)[];
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig extends BehaviorConfig {
  name: 'circuit-breaker';
  /** Failure threshold before opening circuit */
  failureThreshold: number;
  /** Success threshold to close circuit */
  successThreshold: number;
  /** Timeout before attempting reset (ms) */
  timeoutMs: number;
}

/**
 * Timeout behavior configuration
 */
export interface TimeoutConfig extends BehaviorConfig {
  name: 'timeout';
  /** Timeout duration in ms */
  timeoutMs: number;
  /** Whether to throw on timeout */
  throwOnTimeout: boolean;
}

/**
 * Validation behavior configuration
 */
export interface ValidationConfig extends BehaviorConfig {
  name: 'validate';
  /** Validation functions */
  validators: ((result: unknown) => boolean | Promise<boolean>)[];
  /** Whether to throw on validation failure */
  throwOnInvalid: boolean;
}

/**
 * Backoff behavior configuration
 */
export interface BackoffConfig extends BehaviorConfig {
  name: 'backoff';
  /** Initial delay in ms */
  initialDelayMs: number;
  /** Maximum delay in ms */
  maxDelayMs: number;
  /** Backoff multiplier */
  multiplier: number;
  /** Whether to add jitter */
  jitter: boolean;
}

/**
 * Union of all behavior configs
 */
export type AnyBehaviorConfig =
  | RetryConfig
  | CircuitBreakerConfig
  | TimeoutConfig
  | ValidationConfig
  | BackoffConfig;

/**
 * Circuit breaker state
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Behavior chain for composing multiple behaviors
 */
export interface BehaviorChain {
  behaviors: Behavior[];
  execute<T>(operation: (ctx: BehaviorContext) => Promise<T>, context?: Partial<BehaviorContext>): Promise<BehaviorResult<T>>;
}
