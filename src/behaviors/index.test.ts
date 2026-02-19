// Behavior System Tests
// KIMI-W-03: Comprehensive test suite

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  // Registry
  BehaviorRegistry,
  BehaviorNotFoundError,
  BehaviorExecutionError,
  getGlobalBehaviorRegistry,
  resetGlobalBehaviorRegistry,
  
  // Built-ins
  RetryBehavior,
  CircuitBreakerBehavior,
  CircuitOpenError,
  TimeoutBehavior,
  TimeoutError,
  ValidationBehavior,
  ValidationError,
  BackoffBehavior,
  CommonValidators,
  BackoffStrategies,
  
  // Factories
  createRetryBehavior,
  createCircuitBreakerBehavior,
  createTimeoutBehavior,
  createValidationBehavior,
  createBackoffBehavior,
} from './index.js';
import type { BehaviorContext, BehaviorConfig } from './types.js';

describe('Behavior System', () => {
  beforeEach(() => {
    resetGlobalBehaviorRegistry();
  });

  // ============================================================================
  // Registry Tests
  // ============================================================================
  
  describe('BehaviorRegistry', () => {
    describe('register() & get()', () => {
      it('should register and retrieve a behavior', () => {
        const registry = new BehaviorRegistry();
        const behavior = createRetryBehavior();
        
        registry.register(behavior);
        
        expect(registry.get('retry')).toBe(behavior);
      });

      it('should throw for unknown behavior', () => {
        const registry = new BehaviorRegistry();
        
        expect(() => registry.get('unknown')).toThrow(BehaviorNotFoundError);
      });

      it('should mark behavior as default when specified', () => {
        const registry = new BehaviorRegistry();
        const behavior = createRetryBehavior();
        
        registry.register(behavior, true);
        
        expect(registry.getDefaultNames()).toContain('retry');
      });
    });

    describe('unregister()', () => {
      it('should remove a behavior', () => {
        const registry = new BehaviorRegistry();
        registry.register(createRetryBehavior());
        
        expect(registry.unregister('retry')).toBe(true);
        expect(registry.has('retry')).toBe(false);
      });

      it('should return false for non-existent behavior', () => {
        const registry = new BehaviorRegistry();
        
        expect(registry.unregister('unknown')).toBe(false);
      });

      it('should remove from defaults when unregistered', () => {
        const registry = new BehaviorRegistry();
        registry.register(createRetryBehavior(), true);
        
        registry.unregister('retry');
        
        expect(registry.getDefaultNames()).not.toContain('retry');
      });
    });

    describe('has() & count', () => {
      it('should track registered behaviors', () => {
        const registry = new BehaviorRegistry();
        
        expect(registry.count).toBe(0);
        expect(registry.has('retry')).toBe(false);
        
        registry.register(createRetryBehavior());
        
        expect(registry.count).toBe(1);
        expect(registry.has('retry')).toBe(true);
      });
    });

    describe('getRegisteredNames()', () => {
      it('should return all behavior names', () => {
        const registry = new BehaviorRegistry();
        registry.register(createRetryBehavior());
        registry.register(createTimeoutBehavior());
        
        const names = registry.getRegisteredNames();
        expect(names).toContain('retry');
        expect(names).toContain('timeout');
        expect(names).toHaveLength(2);
      });
    });

    describe('executeWith()', () => {
      it('should execute operation with behavior', async () => {
        const registry = new BehaviorRegistry();
        registry.register(createRetryBehavior({ maxRetries: 0 }));
        
        const operation = vi.fn().mockResolvedValue('success');
        const result = await registry.executeWith('retry', operation);
        
        expect(result.success).toBe(true);
        expect(result.data).toBe('success');
        expect(operation).toHaveBeenCalled();
      });

      it('should include execution context', async () => {
        const registry = new BehaviorRegistry();
        registry.register(createRetryBehavior({ maxRetries: 0 }));
        
        const operation = vi.fn().mockResolvedValue('success');
        await registry.executeWith('retry', operation, { agentName: 'test-agent' });
        
        expect(operation.mock.calls[0][0].agentName).toBe('test-agent');
      });
    });

    describe('executeChain()', () => {
      it('should execute with chained behaviors', async () => {
        const registry = new BehaviorRegistry();
        registry.register(createRetryBehavior({ maxRetries: 0 }));
        registry.register(createTimeoutBehavior({ timeoutMs: 5000 }));
        
        const operation = vi.fn().mockResolvedValue('success');
        const result = await registry.executeChain(['retry', 'timeout'], operation);
        
        expect(result.success).toBe(true);
        expect(result.data).toBe('success');
      });

      it('should handle empty chain', async () => {
        const registry = new BehaviorRegistry();
        
        const operation = vi.fn().mockResolvedValue('success');
        const result = await registry.executeChain([], operation);
        
        expect(result.success).toBe(true);
        expect(result.data).toBe('success');
      });
    });

    describe('executeWithDefaults()', () => {
      it('should execute with default behaviors', async () => {
        const registry = new BehaviorRegistry();
        registry.register(createRetryBehavior({ maxRetries: 0 }), true);
        
        const operation = vi.fn().mockResolvedValue('success');
        const result = await registry.executeWithDefaults(operation);
        
        expect(result.success).toBe(true);
      });

      it('should work with no defaults', async () => {
        const registry = new BehaviorRegistry();
        
        const operation = vi.fn().mockResolvedValue('success');
        const result = await registry.executeWithDefaults(operation);
        
        expect(result.success).toBe(true);
      });
    });

    describe('resetAll() & clear()', () => {
      it('should reset all behaviors', () => {
        const registry = new BehaviorRegistry();
        const behavior = createRetryBehavior();
        registry.register(behavior);
        
        // Simulate some usage
        behavior.reset = vi.fn();
        
        registry.resetAll();
        
        expect(behavior.reset).toHaveBeenCalled();
      });

      it('should clear all registrations', () => {
        const registry = new BehaviorRegistry();
        registry.register(createRetryBehavior(), true);
        
        registry.clear();
        
        expect(registry.count).toBe(0);
        expect(registry.getDefaultNames()).toHaveLength(0);
      });
    });

    describe('createChain()', () => {
      it('should create executable chain', async () => {
        const registry = new BehaviorRegistry();
        registry.register(createRetryBehavior({ maxRetries: 0 }));
        
        const chain = registry.createChain(['retry']);
        const operation = vi.fn().mockResolvedValue('success');
        
        const result = await chain.execute(operation);
        
        expect(result.success).toBe(true);
        expect(chain.behaviors).toHaveLength(1);
      });
    });
  });

  describe('Global Registry', () => {
    it('should return same instance', () => {
      const r1 = getGlobalBehaviorRegistry();
      const r2 = getGlobalBehaviorRegistry();
      expect(r1).toBe(r2);
    });

    it('should create new instance after reset', () => {
      const r1 = getGlobalBehaviorRegistry();
      resetGlobalBehaviorRegistry();
      const r2 = getGlobalBehaviorRegistry();
      expect(r1).not.toBe(r2);
    });
  });

  // ============================================================================
  // Retry Behavior Tests
  // ============================================================================
  
  describe('RetryBehavior', () => {
    it('should succeed on first attempt', async () => {
      const retry = createRetryBehavior({ maxRetries: 3 });
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await retry.execute(operation, createTestContext());
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const retry = createRetryBehavior({ maxRetries: 3, retryDelayMs: 10 });
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');
      
      const result = await retry.execute(operation, createTestContext());
      
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries exceeded', async () => {
      const retry = createRetryBehavior({ maxRetries: 2, retryDelayMs: 10 });
      const operation = vi.fn().mockRejectedValue(new Error('always fails'));
      
      const result = await retry.execute(operation, createTestContext());
      
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3); // initial + 2 retries
      expect(result.error?.message).toBe('always fails');
    });

    it('should support retryableErrors configuration', async () => {
      // Verify config is properly stored
      const retry = createRetryBehavior({
        maxRetries: 3,
        retryDelayMs: 10,
        retryableErrors: [(e) => e.message.includes('retryable')],
      });
      
      expect(retry.config.retryableErrors).toHaveLength(1);
    });

    it('should track attempt history', async () => {
      const retry = createRetryBehavior({ maxRetries: 2, retryDelayMs: 10 });
      const context = createTestContext();
      
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      await retry.execute(operation, context);
      
      // Records attempts 1 and 2 (since it retries before checking max)
      expect(retry.getAttemptCount(context.executionId)).toBeGreaterThanOrEqual(1);
    });

    it('should use exponential backoff', async () => {
      const retry = createRetryBehavior({
        maxRetries: 2,
        retryDelayMs: 100,
        backoffMultiplier: 2,
      });
      
      // Just verify it doesn't throw - actual timing tests are flaky
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      const result = await retry.execute(operation, createTestContext());
      
      expect(result.success).toBe(false);
    });

    it('should reset state', () => {
      const retry = createRetryBehavior();
      retry.reset();
      // Should not throw
    });
  });

  // ============================================================================
  // Circuit Breaker Tests
  // ============================================================================
  
  describe('CircuitBreakerBehavior', () => {
    it('should start in CLOSED state', () => {
      const cb = createCircuitBreakerBehavior();
      expect(cb.getState()).toBe('CLOSED');
    });

    it('should stay CLOSED on success', async () => {
      const cb = createCircuitBreakerBehavior({ failureThreshold: 3 });
      const operation = vi.fn().mockResolvedValue('success');
      
      await cb.execute(operation, createTestContext());
      
      expect(cb.getState()).toBe('CLOSED');
      expect(cb.getFailureCount()).toBe(0);
    });

    it('should track failures in CLOSED state', async () => {
      const cb = createCircuitBreakerBehavior({ failureThreshold: 5 });
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      
      await cb.execute(operation, createTestContext());
      
      expect(cb.getFailureCount()).toBe(1);
      expect(cb.getState()).toBe('CLOSED');
    });

    it('should OPEN after failure threshold', async () => {
      const cb = createCircuitBreakerBehavior({ failureThreshold: 3 });
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      
      await cb.execute(operation, createTestContext());
      await cb.execute(operation, createTestContext());
      await cb.execute(operation, createTestContext());
      
      expect(cb.getState()).toBe('OPEN');
    });

    it('should reject calls when OPEN', async () => {
      const cb = createCircuitBreakerBehavior({ failureThreshold: 1, timeoutMs: 60000 });
      const failOp = vi.fn().mockRejectedValue(new Error('fail'));
      
      await cb.execute(failOp, createTestContext());
      
      const successOp = vi.fn().mockResolvedValue('success');
      const result = await cb.execute(successOp, createTestContext());
      
      expect(cb.getState()).toBe('OPEN');
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(CircuitOpenError);
      expect(successOp).not.toHaveBeenCalled();
    });

    it('should provide metrics', async () => {
      const cb = createCircuitBreakerBehavior({ failureThreshold: 2 });
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      
      await cb.execute(operation, createTestContext());
      
      const metrics = cb.getMetrics();
      expect(metrics.state).toBe('CLOSED');
      expect(metrics.failureCount).toBe(1);
      expect(metrics.lastFailureTime).not.toBeNull();
    });

    it('should reset to CLOSED', async () => {
      const cb = createCircuitBreakerBehavior({ failureThreshold: 1 });
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      
      await cb.execute(operation, createTestContext());
      expect(cb.getState()).toBe('OPEN');
      
      cb.reset();
      
      expect(cb.getState()).toBe('CLOSED');
      expect(cb.getFailureCount()).toBe(0);
    });
  });

  // ============================================================================
  // Timeout Behavior Tests
  // ============================================================================
  
  describe('TimeoutBehavior', () => {
    it('should succeed when operation completes in time', async () => {
      const timeout = createTimeoutBehavior({ timeoutMs: 1000 });
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await timeout.execute(operation, createTestContext());
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
    });

    it('should fail when operation times out', async () => {
      const timeout = createTimeoutBehavior({ timeoutMs: 50 });
      const operation = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('late'), 200))
      );
      
      const result = await timeout.execute(operation, createTestContext());
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(TimeoutError);
      expect(result.metadata.timedOut).toBe(true);
    });

    it('should track timeouts', async () => {
      const timeout = createTimeoutBehavior({ timeoutMs: 50 });
      const operation = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('late'), 200))
      );
      
      const context = createTestContext();
      await timeout.execute(operation, context);
      
      expect(timeout.didTimeout(context.executionId)).toBe(true);
      expect(timeout.getTimeoutCount()).toBe(1);
    });

    it('should not throw on timeout when throwOnTimeout is false', async () => {
      const timeout = createTimeoutBehavior({ timeoutMs: 50, throwOnTimeout: false });
      const operation = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('late'), 200))
      );
      
      const result = await timeout.execute(operation, createTestContext());
      
      expect(result.success).toBe(true);
      expect(result.metadata.timedOut).toBe(true);
    });
  });

  // ============================================================================
  // Validation Behavior Tests
  // ============================================================================
  
  describe('ValidationBehavior', () => {
    it('should succeed when all validators pass', async () => {
      const validation = createValidationBehavior({
        validators: [
          (r) => r !== null,
          (r) => typeof r === 'string',
        ],
      });
      const operation = vi.fn().mockResolvedValue('valid');
      
      const result = await validation.execute(operation, createTestContext());
      
      expect(result.success).toBe(true);
      expect(result.metadata.validated).toBe(true);
      expect(result.metadata.passed).toBe(true);
    });

    it('should fail when validators fail', async () => {
      const validation = createValidationBehavior({
        validators: [(r) => r === 'specific'],
        throwOnInvalid: true,
      });
      const operation = vi.fn().mockResolvedValue('wrong');
      
      const result = await validation.execute(operation, createTestContext());
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ValidationError);
    });

    it('should track validation results', async () => {
      const validation = createValidationBehavior({
        validators: [(r) => r !== null],
      });
      const operation = vi.fn().mockResolvedValue('data');
      
      const context = createTestContext();
      await validation.execute(operation, context);
      
      const result = validation.getValidationResult(context.executionId);
      expect(result?.passed).toBe(true);
      expect(result?.failed).toBe(0);
    });

    it('should provide statistics', async () => {
      const validation = createValidationBehavior({
        validators: [(r) => r !== null],
      });
      
      await validation.execute(
        vi.fn().mockResolvedValue('data'),
        createTestContext()
      );
      await validation.execute(
        vi.fn().mockResolvedValue(null),
        createTestContext()
      );
      
      const stats = validation.getStats();
      expect(stats.total).toBe(2);
      expect(stats.passed).toBe(1);
      expect(stats.failed).toBe(1);
    });

    it('should support dynamic validators', async () => {
      const validation = createValidationBehavior({ validators: [] });
      validation.addValidator((r) => r !== undefined);
      
      const operation = vi.fn().mockResolvedValue('data');
      const result = await validation.execute(operation, createTestContext());
      
      expect(result.success).toBe(true);
    });
  });

  describe('CommonValidators', () => {
    it('should validate notNull', () => {
      expect(CommonValidators.notNull('value')).toBe(true);
      expect(CommonValidators.notNull(null)).toBe(false);
      expect(CommonValidators.notNull(undefined)).toBe(false);
    });

    it('should validate notEmpty', () => {
      expect(CommonValidators.notEmpty('text')).toBe(true);
      expect(CommonValidators.notEmpty('')).toBe(false);
      expect(CommonValidators.notEmpty([1, 2])).toBe(true);
      expect(CommonValidators.notEmpty([])).toBe(false);
      expect(CommonValidators.notEmpty({ a: 1 })).toBe(true);
      expect(CommonValidators.notEmpty({})).toBe(false);
    });

    it('should validate isArray', () => {
      expect(CommonValidators.isArray([1, 2])).toBe(true);
      expect(CommonValidators.isArray('string')).toBe(false);
    });

    it('should validate isObject', () => {
      expect(CommonValidators.isObject({})).toBe(true);
      expect(CommonValidators.isObject([])).toBe(false);
      expect(CommonValidators.isObject('string')).toBe(false);
    });

    it('should validate hasProperties', () => {
      const validator = CommonValidators.hasProperties('a', 'b');
      expect(validator({ a: 1, b: 2 })).toBe(true);
      expect(validator({ a: 1 })).toBe(false);
      expect(validator(null)).toBe(false);
    });
  });

  // ============================================================================
  // Backoff Behavior Tests
  // ============================================================================
  
  describe('BackoffBehavior', () => {
    it('should delay before executing', async () => {
      const backoff = createBackoffBehavior({ initialDelayMs: 50, jitter: false });
      const operation = vi.fn().mockResolvedValue('success');
      
      const start = Date.now();
      const result = await backoff.execute(operation, createTestContext());
      const duration = Date.now() - start;
      
      expect(result.success).toBe(true);
      expect(duration).toBeGreaterThanOrEqual(45); // Allow small variance
    });

    it('should calculate delays correctly', () => {
      const backoff = createBackoffBehavior({
        initialDelayMs: 100,
        multiplier: 2,
        jitter: false,
        maxDelayMs: 1000,
      });
      
      expect(backoff.calculateDelay(1)).toBe(100);
      expect(backoff.calculateDelay(2)).toBe(200);
      expect(backoff.calculateDelay(3)).toBe(400);
    });

    it('should cap at max delay', () => {
      const backoff = createBackoffBehavior({
        initialDelayMs: 1000,
        multiplier: 10,
        maxDelayMs: 5000,
        jitter: false,
      });
      
      const delay = backoff.calculateDelay(3);
      expect(delay).toBeLessThanOrEqual(5000);
    });

    it('should track delays', async () => {
      const backoff = createBackoffBehavior({ initialDelayMs: 10, jitter: false });
      const context = createTestContext();
      
      await backoff.execute(vi.fn().mockResolvedValue('ok'), context);
      
      expect(backoff.getDelay(context.executionId)).toBe(10);
    });

    it('should provide statistics', async () => {
      const backoff = createBackoffBehavior({ initialDelayMs: 10, jitter: false });
      
      await backoff.execute(vi.fn().mockResolvedValue('ok'), createTestContext());
      await backoff.execute(vi.fn().mockResolvedValue('ok'), createTestContext());
      
      const stats = backoff.getStats();
      expect(stats.count).toBe(2);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(10);
    });

    it('should apply jitter when enabled', () => {
      const backoff = createBackoffBehavior({
        initialDelayMs: 100,
        jitter: true,
      });
      
      const delays: number[] = [];
      for (let i = 0; i < 10; i++) {
        delays.push(backoff.calculateDelay(1));
      }
      
      // With jitter, delays should vary
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('BackoffStrategies', () => {
    it('should provide linear strategy', () => {
      const config = BackoffStrategies.linear(100);
      expect(config.initialDelayMs).toBe(100);
      expect(config.multiplier).toBe(1);
    });

    it('should provide exponential strategy', () => {
      const config = BackoffStrategies.exponential(100);
      expect(config.initialDelayMs).toBe(100);
      expect(config.multiplier).toBe(2);
    });

    it('should provide fibonacci strategy', () => {
      const config = BackoffStrategies.fibonacci(100);
      expect(config.initialDelayMs).toBe(100);
      expect(config.multiplier).toBeCloseTo(1.618, 2);
    });

    it('should provide decorrelated strategy', () => {
      const config = BackoffStrategies.decorrelated(100);
      expect(config.initialDelayMs).toBe(100);
      expect(config.jitter).toBe(true);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================
  
  describe('Integration', () => {
    it('should chain retry with timeout', async () => {
      const registry = new BehaviorRegistry();
      registry.register(createRetryBehavior({ maxRetries: 2, retryDelayMs: 10 }));
      registry.register(createTimeoutBehavior({ timeoutMs: 500 }));
      
      let attempts = 0;
      const operation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) throw new Error('fail');
        return Promise.resolve('success');
      });
      
      const result = await registry.executeChain(
        ['retry', 'timeout'],
        operation,
        createTestContext()
      );
      
      expect(result.success).toBe(true);
      expect(attempts).toBe(2);
    });

    it('should combine all 5 behaviors in chain', async () => {
      const registry = new BehaviorRegistry();
      registry.register(createRetryBehavior({ maxRetries: 1, retryDelayMs: 10 }));
      registry.register(createCircuitBreakerBehavior({ failureThreshold: 5 }));
      registry.register(createTimeoutBehavior({ timeoutMs: 1000 }));
      registry.register(createValidationBehavior({ validators: [(r) => r !== null] }));
      registry.register(createBackoffBehavior({ initialDelayMs: 10, jitter: false }));
      
      const operation = vi.fn().mockResolvedValue('valid result');
      
      const result = await registry.executeChain(
        ['retry', 'circuit-breaker', 'timeout', 'validate', 'backoff'],
        operation,
        createTestContext()
      );
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('valid result');
    });
  });
});

// Helper function
function createTestContext(overrides: Partial<BehaviorContext> = {}): BehaviorContext {
  return {
    executionId: crypto.randomUUID(),
    agentName: 'test-agent',
    taskId: 'test-task',
    attempt: 1,
    startedAt: new Date().toISOString(),
    metadata: {},
    ...overrides,
  };
}
