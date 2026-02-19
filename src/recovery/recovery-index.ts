// Recovery Index — Barrel Export for R17-01 Advanced Error Recovery
// Re-exports all modules and provides factory function

// Re-export circuit breaker
export {
  CircuitBreaker,
  CircuitOpenError,
} from './circuit-breaker.js';
export type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStats,
} from './circuit-breaker.js';

// Re-export build snapshot
export {
  BuildSnapshotManager,
  simpleHash,
} from './build-snapshot.js';
export type {
  BuildSnapshot,
  SnapshotConfig,
  SnapshotDiff,
} from './build-snapshot.js';

// Re-export error classifier
export {
  ErrorClassifier,
} from './error-classifier.js';
export type {
  ErrorClass,
  ErrorSeverity,
  ClassifiedError,
  ErrorPattern,
  ErrorCorrelation,
} from './error-classifier.js';

// Re-export recovery strategy
export {
  RecoveryOrchestrator,
} from './recovery-strategy.js';
export type {
  StrategyType,
  RecoveryStrategy,
  RecoveryAttempt,
  RecoveryResult,
  RecoveryConfig,
} from './recovery-strategy.js';

// ============================================================================
// Advanced Recovery Config
// ============================================================================

export interface AdvancedRecoveryConfig {
  circuitBreakerEnabled: boolean;
  snapshotEnabled: boolean;
  classifierEnabled: boolean;
  orchestratorEnabled: boolean;
  maxGlobalRetries: number;
  healthCheckIntervalMs: number;
}

export const DEFAULT_ADVANCED_RECOVERY_CONFIG: AdvancedRecoveryConfig = {
  circuitBreakerEnabled: true,
  snapshotEnabled: true,
  classifierEnabled: true,
  orchestratorEnabled: true,
  maxGlobalRetries: 5,
  healthCheckIntervalMs: 30000,
};

// ============================================================================
// Factory Function
// ============================================================================

export interface AdvancedRecoverySystem {
  circuitBreaker: InstanceType<typeof CircuitBreaker>;
  snapshotManager: InstanceType<typeof BuildSnapshotManager>;
  classifier: InstanceType<typeof ErrorClassifier>;
  orchestrator: InstanceType<typeof RecoveryOrchestrator>;
  config: AdvancedRecoveryConfig;
}

import { CircuitBreaker } from './circuit-breaker.js';
import { BuildSnapshotManager } from './build-snapshot.js';
import { ErrorClassifier } from './error-classifier.js';
import { RecoveryOrchestrator } from './recovery-strategy.js';

export function createAdvancedRecoverySystem(
  config?: Partial<AdvancedRecoveryConfig>,
): AdvancedRecoverySystem {
  const resolvedConfig: AdvancedRecoveryConfig = {
    ...DEFAULT_ADVANCED_RECOVERY_CONFIG,
    ...config,
  };

  const circuitBreaker = new CircuitBreaker('advanced-recovery', {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenMaxAttempts: 3,
    monitorWindowMs: 60000,
  });

  const snapshotManager = new BuildSnapshotManager({
    maxSnapshots: 50,
    autoSnapshot: resolvedConfig.snapshotEnabled,
  });

  const classifier = new ErrorClassifier();

  const orchestrator = new RecoveryOrchestrator({
    maxRetries: resolvedConfig.maxGlobalRetries,
  });

  return {
    circuitBreaker,
    snapshotManager,
    classifier,
    orchestrator,
    config: resolvedConfig,
  };
}
