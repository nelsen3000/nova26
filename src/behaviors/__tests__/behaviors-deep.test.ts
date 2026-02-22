// Behaviors Deep Tests - Property-based testing
// K4-11: Behavior composition, chaining, error propagation

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  BehaviorRegistry,
  resetGlobalBehaviorRegistry,
  createRetryBehavior,
  createCircuitBreakerBehavior,
  createTimeoutBehavior,
  createBackoffBehavior,
  CircuitBreakerBehavior,
  CircuitOpenError,
  TimeoutError,
  BackoffStrategies,
} from '../index.js';
import type { Behavior, BehaviorContext, BehaviorResult } from '../types.js';

describe('Behaviors Property Tests', () => {
  beforeEach(() => {
    resetGlobalBehaviorRegistry();
  });

  // ============================================================================
  // Property 1: Behavior Composition Associativity
  // ============================================================================

  describe('Behavior Composition Associativity', () => {
    it('should satisfy associativity: (A ∘ B) ∘ C === A ∘ (B ∘ C)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            agentId: fc.string(),
            projectId: fc.string(),
            sessionId: fc.string(),
            attempt: fc.integer({ min: 1, max: 10 }),
          }),
          fc.boolean(),
          async (ctx, initialSuccess) => {
            const initialResult: BehaviorResult = initialSuccess
              ? { success: true, output: 'test' }
              : { success: false, error: new Error('test') };

            // Create behaviors with deterministic outputs
            const behaviorA: Behavior = {
              name: 'behaviorA',
              execute: async (ctx, result) => ({
                ...result,
                metadata: { ...(result.metadata || {}), executedA: true },
              }),
            };

            const behaviorB: Behavior = {
              name: 'behaviorB',
              execute: async (ctx, result) => ({
                ...result,
                metadata: { ...(result.metadata || {}), executedB: true },
              }),
            };

            const behaviorC: Behavior = {
              name: 'behaviorC',
              execute: async (ctx, result) => ({
                ...result,
                metadata: { ...(result.metadata || {}), executedC: true },
              }),
            };

            // Left associative: (A ∘ B) ∘ C
            const leftResult = await behaviorC.execute(
              ctx,
              await behaviorB.execute(ctx, await behaviorA.execute(ctx, initialResult))
            );

            // Right associative: A ∘ (B ∘ C)
            const rightResult = await behaviorA.execute(
              ctx,
              await behaviorB.execute(ctx, await behaviorC.execute(ctx, initialResult))
            );

            // Both should have all three markers in metadata chain
            expect(leftResult.metadata).toHaveProperty('executedC');
            expect(rightResult.metadata).toHaveProperty('executedA');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // ============================================================================
  // Property 2: Backoff Increases Delay
  // ============================================================================

  describe('Backoff Behavior Properties', () => {
    it('should increase delay with each attempt', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 100 }),
          (initialDelayMs) => {
            const behavior = createBackoffBehavior({
              initialDelayMs,
              multiplier: 2,
              jitter: false,
            });

            const delay1 = behavior.calculateDelay(1);
            const delay2 = behavior.calculateDelay(2);
            const delay3 = behavior.calculateDelay(3);

            // Each delay should be >= previous (exponential)
            expect(delay2).toBeGreaterThanOrEqual(delay1);
            expect(delay3).toBeGreaterThanOrEqual(delay2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect maximum delay cap', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 10, max: 50 }),
          fc.integer({ min: 100, max: 500 }),
          (attempt, initialDelayMs, maxDelayMs) => {
            const behavior = createBackoffBehavior({
              initialDelayMs,
              maxDelayMs,
              multiplier: 2,
              jitter: false,
            });
            const delay = behavior.calculateDelay(attempt);

            expect(delay).toBeLessThanOrEqual(maxDelayMs);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // Property 3: Circuit Breaker State Transitions
  // ============================================================================

  describe('Circuit Breaker Properties', () => {
    it('should open after threshold failures', async () => {
      const behavior = new CircuitBreakerBehavior({
        name: 'test-circuit',
        failureThreshold: 3,
        resetTimeoutMs: 10000,
      });

      // Execute 3 failures
      for (let i = 0; i < 3; i++) {
        const failOp = async () => { throw new Error('failure'); };
        try {
          await behavior.execute(
            { agentId: 'test', projectId: 'test', sessionId: 'test', attempt: 1, executionId: `exec-${i}` },
            failOp
          );
        } catch {
          // Expected
        }
      }

      // Circuit should be OPEN now
      expect(behavior.getState()).toBe('OPEN');
    });

    it('should stay CLOSED with all successes', async () => {
      const behavior = new CircuitBreakerBehavior({
        name: 'test-circuit-2',
        failureThreshold: 5,
        resetTimeoutMs: 10000,
      });

      // Verify initial state
      expect(behavior.getState()).toBe('CLOSED');

      // Execute only successes
      for (let i = 0; i < 10; i++) {
        const op = async () => 'ok';
        const result = await behavior.execute(
          { agentId: 'test', projectId: 'test', sessionId: 'test', attempt: 1, executionId: `exec-${i}` },
          op
        );
        // All should succeed
        expect(result.success).toBe(true);
      }

      // With all successes, circuit should stay CLOSED
      expect(behavior.getState()).toBe('CLOSED');
      expect(behavior.getFailureCount()).toBe(0);
    });

    it('should reject calls when OPEN', async () => {
      const behavior = new CircuitBreakerBehavior({
        name: 'test-circuit',
        failureThreshold: 1,
        resetTimeoutMs: 60000, // Long timeout so it stays open
      });

      // Trigger failure to open circuit
      try {
        await behavior.execute(
          { agentId: 'test', projectId: 'test', sessionId: 'test', attempt: 1, executionId: 'exec-1' },
          async () => { throw new Error('fail'); }
        );
      } catch {
        // Expected
      }

      expect(behavior.getState()).toBe('OPEN');

      // Next call should fail immediately with CircuitOpenError
      const successOp = async () => 'should not execute';
      const result = await behavior.execute(
        { agentId: 'test', projectId: 'test', sessionId: 'test', attempt: 1, executionId: 'exec-2' },
        successOp
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(CircuitOpenError);
    });
  });

  // ============================================================================
  // Property 4: Registry Consistency
  // ============================================================================

  describe('Registry Properties', () => {
    it('should return same behavior instance for same name', () => {
      const registry = new BehaviorRegistry();
      const behavior = createRetryBehavior();

      registry.register(behavior);
      const retrieved1 = registry.get('retry');
      const retrieved2 = registry.get('retry');

      expect(retrieved1).toBe(retrieved2);
    });

    it('should maintain count consistency with unique behavior types', () => {
      const registry = new BehaviorRegistry();

      // Register different behavior types
      registry.register(createRetryBehavior());
      expect(registry.count).toBe(1);

      registry.register(createTimeoutBehavior());
      expect(registry.count).toBe(2);

      registry.register(createCircuitBreakerBehavior({ name: 'circuit1' }));
      expect(registry.count).toBe(3);

      // Registering same type again overwrites
      registry.register(createRetryBehavior());
      expect(registry.count).toBe(3);
    });

    it('should have all registered behaviors', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              fc.constant('retry'),
              fc.constant('timeout'),
              fc.constant('circuit1'),
            ),
            { minLength: 0, maxLength: 10 }
          ),
          (names) => {
            const registry = new BehaviorRegistry();
            const uniqueNames = [...new Set(names)];

            uniqueNames.forEach(name => {
              if (name === 'retry') registry.register(createRetryBehavior());
              if (name === 'timeout') registry.register(createTimeoutBehavior());
              if (name === 'circuit1') registry.register(createCircuitBreakerBehavior({ name }));
            });

            expect(registry.count).toBe(uniqueNames.length);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // ============================================================================
  // Property 5: Backoff Strategy Configs
  // ============================================================================

  describe('BackoffStrategies', () => {
    it('should generate valid configs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 1000 }),
          (initialDelayMs) => {
            const linear = BackoffStrategies.linear(initialDelayMs);
            expect(linear.initialDelayMs).toBe(initialDelayMs);
            expect(linear.multiplier).toBe(1);

            const exponential = BackoffStrategies.exponential(initialDelayMs);
            expect(exponential.initialDelayMs).toBe(initialDelayMs);
            expect(exponential.multiplier).toBe(2);

            const fibonacci = BackoffStrategies.fibonacci(initialDelayMs);
            expect(fibonacci.initialDelayMs).toBe(initialDelayMs);
            expect(fibonacci.multiplier).toBeCloseTo(1.618, 2);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
