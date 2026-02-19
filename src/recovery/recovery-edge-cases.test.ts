// Recovery Edge Cases — R17-01
// KIMI-W-04: 8 edge case tests for advanced error recovery

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CircuitBreaker,
  CircuitOpenError,
  BuildSnapshotManager,
  ErrorClassifier,
  RecoveryOrchestrator,
  createAdvancedRecoverySystem,
} from './recovery-index.js';

describe('Recovery Edge Cases', () => {
  describe('CircuitBreaker Edge Cases', () => {
    it('should handle rapid state transitions', () => {
      const cb = new CircuitBreaker('test');
      
      // Quick failures to open circuit
      cb.recordFailure(new Error('fail1'));
      cb.recordFailure(new Error('fail2'));
      cb.recordFailure(new Error('fail3'));
      cb.recordFailure(new Error('fail4'));
      cb.recordFailure(new Error('fail5'));
      
      expect(cb.getState()).toBe('open');
      
      // Reset should work
      cb.reset();
      expect(cb.getState()).toBe('closed');
    });

    it('should handle many success/failure cycles', () => {
      const cb = new CircuitBreaker('test');
      
      for (let i = 0; i < 100; i++) {
        cb.recordSuccess();
        cb.recordFailure(new Error('fail'));
      }
      
      expect(cb.getStats()).toBeDefined();
    });

    it('should handle shouldAttempt when half-open', () => {
      const cb = new CircuitBreaker('test');
      
      // Trip the circuit
      for (let i = 0; i < 5; i++) {
        cb.recordFailure(new Error('fail'));
      }
      
      expect(cb.getState()).toBe('open');
      expect(cb.shouldAttempt()).toBe(false);
    });
  });

  describe('BuildSnapshotManager Edge Cases', () => {
    it('should handle empty snapshot creation', () => {
      const mgr = new BuildSnapshotManager();
      const snapshot = mgr.createSnapshot('build-1', {}, {});
      expect(snapshot).toBeDefined();
    });

    it('should handle missing snapshot gracefully', () => {
      const mgr = new BuildSnapshotManager();
      const result = mgr.loadSnapshot('nonexistent');
      expect(result).toBeNull();
    });

    it('should handle many snapshots', () => {
      const mgr = new BuildSnapshotManager();
      
      // Create 100 snapshots
      for (let i = 0; i < 100; i++) {
        mgr.createSnapshot(`build-${i}`, { [`dep-${i}`]: '1.0.0' }, {});
      }
      
      const list = mgr.listSnapshots();
      expect(list.length).toBeGreaterThan(0);
    });

    it('should handle snapshot comparison with empty data', () => {
      const mgr = new BuildSnapshotManager();
      const snap1 = mgr.createSnapshot('build-1', {}, {});
      const snap2 = mgr.createSnapshot('build-2', {}, {});
      
      const diff = mgr.compareSnapshots(snap1, snap2);
      expect(diff).toBeDefined();
    });

    it('should handle environment hash with empty deps', () => {
      const mgr = new BuildSnapshotManager();
      const hash = mgr.computeEnvironmentHash({});
      expect(hash).toBeDefined();
    });
  });

  describe('ErrorClassifier Edge Cases', () => {
    it('should classify error with no message', () => {
      const classifier = new ErrorClassifier();
      const error = new Error('');
      const result = classifier.classifyError(error);
      expect(result).toBeDefined();
    });

    it('should classify error with very long message', () => {
      const classifier = new ErrorClassifier();
      const error = new Error('a'.repeat(10000));
      const result = classifier.classifyError(error);
      expect(result).toBeDefined();
    });

    it('should classify many different errors', () => {
      const classifier = new ErrorClassifier();
      const errors = [
        new Error('network timeout'),
        new Error('connection refused'),
        new Error('file not found'),
        new Error('permission denied'),
        new TypeError('undefined is not a function'),
        new SyntaxError('unexpected token'),
      ];
      
      for (const error of errors) {
        const result = classifier.classifyError(error);
        expect(result).toBeDefined();
      }
    });
  });

  describe('createAdvancedRecoverySystem Edge Cases', () => {
    it('should handle all features disabled', () => {
      const system = createAdvancedRecoverySystem({
        circuitBreakerEnabled: false,
        snapshotEnabled: false,
        classifierEnabled: false,
        orchestratorEnabled: false,
      });
      
      expect(system.config.circuitBreakerEnabled).toBe(false);
    });

    it('should handle extreme config values', () => {
      const system = createAdvancedRecoverySystem({
        maxGlobalRetries: Number.MAX_SAFE_INTEGER,
        healthCheckIntervalMs: 1,
      });
      
      expect(system.config.maxGlobalRetries).toBe(Number.MAX_SAFE_INTEGER);
    });
  });
});
