// Recovery Index Tests — R17-01 Advanced Error Recovery
// 16 tests covering barrel exports, config, and factory function

import { describe, it, expect, vi } from 'vitest';
import {
  // Circuit Breaker
  CircuitBreaker,
  CircuitOpenError,
  // Build Snapshot
  BuildSnapshotManager,
  simpleHash,
  // Error Classifier
  ErrorClassifier,
  // Recovery Strategy
  RecoveryOrchestrator,
  // Config
  DEFAULT_ADVANCED_RECOVERY_CONFIG,
  // Factory
  createAdvancedRecoverySystem,
} from './recovery-index.js';
import type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStats,
  BuildSnapshot,
  SnapshotConfig,
  SnapshotDiff,
  ErrorClass,
  ErrorSeverity,
  ClassifiedError,
  ErrorPattern,
  ErrorCorrelation,
  StrategyType,
  RecoveryStrategy,
  RecoveryAttempt,
  RecoveryResult,
  RecoveryConfig,
  AdvancedRecoveryConfig,
} from './recovery-index.js';

describe('Recovery Index — Barrel Exports', () => {
  // 1
  it('exports CircuitBreaker class', () => {
    expect(CircuitBreaker).toBeDefined();
    const cb = new CircuitBreaker('test');
    expect(cb.getState()).toBe('closed');
  });

  // 2
  it('exports CircuitOpenError class', () => {
    expect(CircuitOpenError).toBeDefined();
    const err = new CircuitOpenError('test');
    expect(err.name).toBe('CircuitOpenError');
  });

  // 3
  it('exports BuildSnapshotManager class', () => {
    expect(BuildSnapshotManager).toBeDefined();
    const mgr = new BuildSnapshotManager();
    expect(mgr.listSnapshots()).toEqual([]);
  });

  // 4
  it('exports simpleHash function', () => {
    expect(simpleHash).toBeDefined();
    expect(typeof simpleHash('hello')).toBe('string');
  });

  // 5
  it('exports ErrorClassifier class', () => {
    expect(ErrorClassifier).toBeDefined();
    const c = new ErrorClassifier();
    expect(c.getErrorHistory()).toEqual([]);
  });

  // 6
  it('exports RecoveryOrchestrator class', () => {
    expect(RecoveryOrchestrator).toBeDefined();
    const o = new RecoveryOrchestrator();
    expect(o.getStrategies().length).toBeGreaterThan(0);
  });

  // 7
  it('type exports compile correctly (CircuitState)', () => {
    const state: CircuitState = 'closed';
    expect(state).toBe('closed');
  });

  // 8
  it('type exports compile correctly (ErrorClass, ErrorSeverity)', () => {
    const ec: ErrorClass = 'network';
    const es: ErrorSeverity = 'critical';
    expect(ec).toBe('network');
    expect(es).toBe('critical');
  });

  // 9
  it('type exports compile correctly (StrategyType)', () => {
    const st: StrategyType = 'retry-transient';
    expect(st).toBe('retry-transient');
  });
});

describe('Recovery Index — DEFAULT_ADVANCED_RECOVERY_CONFIG', () => {
  // 10
  it('has 6 required fields', () => {
    const keys = Object.keys(DEFAULT_ADVANCED_RECOVERY_CONFIG);
    expect(keys).toHaveLength(6);
    expect(keys).toContain('circuitBreakerEnabled');
    expect(keys).toContain('snapshotEnabled');
    expect(keys).toContain('classifierEnabled');
    expect(keys).toContain('orchestratorEnabled');
    expect(keys).toContain('maxGlobalRetries');
    expect(keys).toContain('healthCheckIntervalMs');
  });

  // 11
  it('has sensible defaults', () => {
    expect(DEFAULT_ADVANCED_RECOVERY_CONFIG.circuitBreakerEnabled).toBe(true);
    expect(DEFAULT_ADVANCED_RECOVERY_CONFIG.snapshotEnabled).toBe(true);
    expect(DEFAULT_ADVANCED_RECOVERY_CONFIG.classifierEnabled).toBe(true);
    expect(DEFAULT_ADVANCED_RECOVERY_CONFIG.orchestratorEnabled).toBe(true);
    expect(DEFAULT_ADVANCED_RECOVERY_CONFIG.maxGlobalRetries).toBe(5);
    expect(DEFAULT_ADVANCED_RECOVERY_CONFIG.healthCheckIntervalMs).toBe(30000);
  });
});

describe('Recovery Index — createAdvancedRecoverySystem', () => {
  // 12
  it('returns all four subsystems', () => {
    const system = createAdvancedRecoverySystem();
    expect(system.circuitBreaker).toBeInstanceOf(CircuitBreaker);
    expect(system.snapshotManager).toBeInstanceOf(BuildSnapshotManager);
    expect(system.classifier).toBeInstanceOf(ErrorClassifier);
    expect(system.orchestrator).toBeInstanceOf(RecoveryOrchestrator);
  });

  // 13
  it('returns resolved config with defaults', () => {
    const system = createAdvancedRecoverySystem();
    expect(system.config).toEqual(DEFAULT_ADVANCED_RECOVERY_CONFIG);
  });

  // 14
  it('merges partial config overrides', () => {
    const system = createAdvancedRecoverySystem({
      maxGlobalRetries: 10,
      circuitBreakerEnabled: false,
    });
    expect(system.config.maxGlobalRetries).toBe(10);
    expect(system.config.circuitBreakerEnabled).toBe(false);
    // Other defaults remain
    expect(system.config.snapshotEnabled).toBe(true);
    expect(system.config.healthCheckIntervalMs).toBe(30000);
  });

  // 15
  it('circuit breaker starts in closed state', () => {
    const system = createAdvancedRecoverySystem();
    expect(system.circuitBreaker.getState()).toBe('closed');
  });

  // 16
  it('orchestrator has 7 built-in strategies', () => {
    const system = createAdvancedRecoverySystem();
    expect(system.orchestrator.getStrategies()).toHaveLength(7);
  });
});

// Suppress unused type warnings by using them in type-checking assertions
describe('Recovery Index — Type Compatibility', () => {
  it('all exported types are structurally valid', () => {
    // CircuitBreakerConfig
    const cbConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      resetTimeoutMs: 30000,
      halfOpenMaxAttempts: 3,
      monitorWindowMs: 60000,
    };
    expect(cbConfig.failureThreshold).toBe(5);

    // CircuitBreakerStats
    const cbStats: CircuitBreakerStats = {
      name: 'test',
      state: 'closed',
      failureCount: 0,
      successCount: 0,
      totalTrips: 0,
    };
    expect(cbStats.name).toBe('test');

    // BuildSnapshot
    const snap: BuildSnapshot = {
      id: '1',
      buildId: 'b1',
      createdAt: new Date().toISOString(),
      files: {},
      dependencies: {},
      environmentHash: 'abc',
      metadata: {},
    };
    expect(snap.id).toBe('1');

    // SnapshotConfig
    const snapConfig: SnapshotConfig = {
      snapshotDir: '.nova/snapshots',
      maxSnapshots: 50,
      autoSnapshot: true,
      compressionEnabled: false,
    };
    expect(snapConfig.maxSnapshots).toBe(50);

    // SnapshotDiff
    const diff: SnapshotDiff = {
      added: [],
      removed: [],
      modified: [],
      unchangedCount: 0,
    };
    expect(diff.unchangedCount).toBe(0);

    // ClassifiedError
    const ce: ClassifiedError = {
      id: '1',
      originalError: new Error('test'),
      errorClass: 'network',
      severity: 'medium',
      retryable: true,
      suggestedAction: 'retry',
      timestamp: new Date().toISOString(),
      context: {},
    };
    expect(ce.retryable).toBe(true);

    // ErrorPattern
    const ep: ErrorPattern = {
      errorClass: 'timeout',
      count: 3,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      averageIntervalMs: 1000,
    };
    expect(ep.count).toBe(3);

    // ErrorCorrelation
    const ec: ErrorCorrelation = {
      primaryClass: 'network',
      correlatedClass: 'timeout',
      occurrences: 5,
      confidence: 0.8,
    };
    expect(ec.confidence).toBe(0.8);

    // RecoveryStrategy
    const rs: RecoveryStrategy = {
      type: 'retry-transient',
      name: 'Retry',
      description: 'Retry on transient',
      applicableClasses: ['network'],
      priority: 1,
      maxAttempts: 3,
    };
    expect(rs.type).toBe('retry-transient');

    // RecoveryAttempt
    const ra: RecoveryAttempt = {
      id: '1',
      strategyType: 'retry-transient',
      attemptNumber: 1,
      startedAt: new Date().toISOString(),
      success: true,
    };
    expect(ra.success).toBe(true);

    // RecoveryResult
    const rr: RecoveryResult = {
      id: '1',
      errorId: 'err-1',
      strategy: 'retry-transient',
      attempts: [ra],
      success: true,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    expect(rr.success).toBe(true);

    // RecoveryConfig
    const rc: RecoveryConfig = {
      maxRetries: 3,
      baseBackoffMs: 1000,
      maxBackoffMs: 30000,
      backoffMultiplier: 2,
      jitterEnabled: true,
      globalTimeoutMs: 120000,
    };
    expect(rc.maxRetries).toBe(3);

    // AdvancedRecoveryConfig
    const arc: AdvancedRecoveryConfig = {
      circuitBreakerEnabled: true,
      snapshotEnabled: true,
      classifierEnabled: true,
      orchestratorEnabled: true,
      maxGlobalRetries: 5,
      healthCheckIntervalMs: 30000,
    };
    expect(arc.maxGlobalRetries).toBe(5);
  });
});
