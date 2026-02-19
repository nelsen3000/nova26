// Behavior System - Main Export
// KIMI-W-03: Behavior system complete

// Core types
export type {
  Behavior,
  BehaviorConfig,
  BehaviorContext,
  BehaviorResult,
  BehaviorChain,
  AnyBehaviorConfig,
  RetryConfig,
  CircuitBreakerConfig,
  TimeoutConfig,
  ValidationConfig,
  BackoffConfig,
  CircuitState,
} from './types.js';

// Registry
export {
  BehaviorRegistry,
  BehaviorNotFoundError,
  BehaviorExecutionError,
  getGlobalBehaviorRegistry,
  resetGlobalBehaviorRegistry,
} from './registry.js';

// Built-in behaviors
export {
  RetryBehavior,
  createRetryBehavior,
  DEFAULT_RETRY_CONFIG,
} from './built-ins/retry.js';

export {
  CircuitBreakerBehavior,
  CircuitOpenError,
  createCircuitBreakerBehavior,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './built-ins/circuit-breaker.js';

export {
  TimeoutBehavior,
  TimeoutError,
  createTimeoutBehavior,
  DEFAULT_TIMEOUT_CONFIG,
} from './built-ins/timeout.js';

export {
  ValidationBehavior,
  ValidationError,
  createValidationBehavior,
  CommonValidators,
  DEFAULT_VALIDATION_CONFIG,
} from './built-ins/validate.js';

export {
  BackoffBehavior,
  createBackoffBehavior,
  BackoffStrategies,
  DEFAULT_BACKOFF_CONFIG,
} from './built-ins/backoff.js';
