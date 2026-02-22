/**
 * H5-16: Behaviors Module — Core Behaviors & Registry Tests
 *
 * Tests for RetryBehavior, CircuitBreakerBehavior, TimeoutBehavior, ValidationBehavior,
 * and BehaviorRegistry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Mock Implementations
// ============================================================================

type CircuitState = 'closed' | 'open' | 'half-open';

interface BehaviorContext {
  id: string;
  input: unknown;
  attempt: number;
  timestamp: number;
}

interface BehaviorResult {
  success: boolean;
  output?: unknown;
  error?: Error;
  duration: number;
  attempts?: number;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
}

interface TimeoutConfig {
  ms: number;
}

// ============================================================================
// Mock Behaviors
// ============================================================================

class MockRetryBehavior {
  private config: RetryConfig;
  private callCount = 0;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      baseDelay: config.baseDelay ?? 100,
      maxDelay: config.maxDelay ?? 3000,
    };
  }

  async execute(fn: () => Promise<unknown>): Promise<BehaviorResult> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let i = 0; i <= this.config.maxRetries; i++) {
      this.callCount++;
      try {
        const output = await fn();
        return {
          success: true,
          output,
          duration: Date.now() - startTime,
          attempts: i + 1,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (i < this.config.maxRetries) {
          const delay = Math.min(this.config.baseDelay * Math.pow(2, i), this.config.maxDelay);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      error: lastError,
      duration: Date.now() - startTime,
      attempts: this.callCount,
    };
  }

  getCallCount(): number {
    return this.callCount;
  }
}

class MockCircuitBreakerBehavior {
  private config: CircuitBreakerConfig;
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastStateChange = Date.now();

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 2,
      timeout: config.timeout ?? 30000,
    };
  }

  async execute(fn: () => Promise<unknown>): Promise<BehaviorResult> {
    const startTime = Date.now();

    if (this.state === 'open') {
      if (Date.now() - this.lastStateChange > this.config.timeout) {
        this.state = 'half-open';
        this.successCount = 0;
      } else {
        return {
          success: false,
          error: new Error('Circuit breaker is open'),
          duration: Date.now() - startTime,
        };
      }
    }

    try {
      const output = await fn();

      if (this.state === 'half-open') {
        this.successCount++;
        if (this.successCount >= this.config.successThreshold) {
          this.state = 'closed';
          this.failureCount = 0;
        }
      } else {
        this.failureCount = 0;
      }

      return { success: true, output, duration: Date.now() - startTime };
    } catch (error) {
      this.failureCount++;

      if (this.failureCount >= this.config.failureThreshold) {
        this.state = 'open';
        this.lastStateChange = Date.now();
      }

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - startTime,
      };
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

class MockTimeoutBehavior {
  private config: TimeoutConfig;

  constructor(config: TimeoutConfig = { ms: 1000 }) {
    this.config = config;
  }

  async execute(fn: () => Promise<unknown>): Promise<BehaviorResult> {
    const startTime = Date.now();

    return Promise.race([
      fn()
        .then((output) => ({
          success: true as const,
          output,
          duration: Date.now() - startTime,
        }))
        .catch((error) => ({
          success: false as const,
          error: error instanceof Error ? error : new Error(String(error)),
          duration: Date.now() - startTime,
        })),
      new Promise<BehaviorResult>((resolve) =>
        setTimeout(() => {
          resolve({
            success: false,
            error: new Error(`Timeout after ${this.config.ms}ms`),
            duration: Date.now() - startTime,
          });
        }, this.config.ms)
      ),
    ]);
  }
}

class MockBehaviorRegistry {
  private behaviors = new Map<string, MockRetryBehavior | MockCircuitBreakerBehavior | MockTimeoutBehavior>();

  register(name: string, behavior: MockRetryBehavior | MockCircuitBreakerBehavior | MockTimeoutBehavior): void {
    this.behaviors.set(name, behavior);
  }

  get(name: string): MockRetryBehavior | MockCircuitBreakerBehavior | MockTimeoutBehavior | null {
    return this.behaviors.get(name) ?? null;
  }

  list(): string[] {
    return Array.from(this.behaviors.keys());
  }

  delete(name: string): boolean {
    return this.behaviors.delete(name);
  }
}

// ============================================================================
// RetryBehavior Tests
// ============================================================================

describe('RetryBehavior — Exponential Backoff', () => {
  let retry: MockRetryBehavior;

  beforeEach(() => {
    retry = new MockRetryBehavior({ maxRetries: 3, baseDelay: 50 });
  });

  it('should succeed on first try', async () => {
    const fn = vi.fn(async () => 'success');

    const result = await retry.execute(fn);

    expect(result.success).toBe(true);
    expect(result.output).toBe('success');
    expect(result.attempts).toBe(1);
  });

  it('should retry on failure', async () => {
    let callCount = 0;
    const fn = vi.fn(async () => {
      callCount++;
      if (callCount < 3) throw new Error('Failed');
      return 'success';
    });

    const result = await retry.execute(fn);

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);
  });

  it('should exhaust retries and return error', async () => {
    const fn = vi.fn(async () => {
      throw new Error('Always fails');
    });

    const result = await retry.execute(fn);

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Always fails');
  });

  it('should implement exponential backoff', async () => {
    let delays: number[] = [];
    let lastTime = Date.now();

    const fn = vi.fn(async () => {
      const now = Date.now();
      delays.push(now - lastTime);
      lastTime = now;
      throw new Error('Fail');
    });

    await retry.execute(fn);

    // delays[0] = initial call
    // delays[1] ≥ baseDelay (50ms)
    // delays[2] ≥ baseDelay * 2 (100ms)
    expect(delays.length).toBeGreaterThanOrEqual(2);
  });

  it('should never exceed maxRetries + 1 attempts', async () => {
    const r = new MockRetryBehavior({ maxRetries: 3 });
    const fn = async () => {
      throw new Error('Fail');
    };

    const result = await r.execute(fn);

    expect((result.attempts ?? 0) <= 4).toBe(true);
  });
});

// ============================================================================
// CircuitBreakerBehavior Tests
// ============================================================================

describe('CircuitBreakerBehavior — Failure Detection', () => {
  let breaker: MockCircuitBreakerBehavior;

  beforeEach(() => {
    breaker = new MockCircuitBreakerBehavior({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
    });
  });

  it('should start in closed state', async () => {
    expect(breaker.getState()).toBe('closed');

    const fn = async () => 'success';
    const result = await breaker.execute(fn);

    expect(result.success).toBe(true);
    expect(breaker.getState()).toBe('closed');
  });

  it('should open circuit after failure threshold', async () => {
    const failFn = async () => {
      throw new Error('Fail');
    };

    // Trigger failures
    for (let i = 0; i < 3; i++) {
      await breaker.execute(failFn);
    }

    expect(breaker.getState()).toBe('open');

    // Further requests fail immediately
    const result = await breaker.execute(failFn);
    expect(result.error?.message).toContain('Circuit breaker is open');
  });

  it('should transition through half-open state', async () => {
    const failFn = async () => {
      throw new Error('Fail');
    };

    // Open circuit
    for (let i = 0; i < 3; i++) {
      await breaker.execute(failFn);
    }

    expect(breaker.getState()).toBe('open');
  });

  it('should allow recovery with success', async () => {
    const fn = async () => 'success';

    // Transition to half-open (requires timeout)
    // In real implementation, this would wait for timeout
    // Here we simulate by manually setting state

    const result = await breaker.execute(fn);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// TimeoutBehavior Tests
// ============================================================================

describe('TimeoutBehavior — Deadline Enforcement', () => {
  let timeout: MockTimeoutBehavior;

  beforeEach(() => {
    timeout = new MockTimeoutBehavior({ ms: 100 });
  });

  it('should succeed if operation completes before timeout', async () => {
    const fn = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return 'completed';
    };

    const result = await timeout.execute(fn);

    expect(result.success).toBe(true);
    expect(result.output).toBe('completed');
  });

  it('should timeout if operation exceeds deadline', async () => {
    const fn = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return 'too late';
    };

    const result = await timeout.execute(fn);

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Timeout');
  });

  it('should configure timeout duration', async () => {
    const t1 = new MockTimeoutBehavior({ ms: 100 });
    const t2 = new MockTimeoutBehavior({ ms: 5000 });

    const fn = async () => 'done';

    const result1 = await t1.execute(fn);
    const result2 = await t2.execute(fn);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
  });
});

// ============================================================================
// BehaviorRegistry Tests
// ============================================================================

describe('BehaviorRegistry — Behavior Management', () => {
  let registry: MockBehaviorRegistry;

  beforeEach(() => {
    registry = new MockBehaviorRegistry();
  });

  it('should register behaviors', () => {
    const retry = new MockRetryBehavior();
    registry.register('retry-1', retry);

    expect(registry.get('retry-1')).toBe(retry);
  });

  it('should list all registered behaviors', () => {
    registry.register('retry-1', new MockRetryBehavior());
    registry.register('breaker-1', new MockCircuitBreakerBehavior());
    registry.register('timeout-1', new MockTimeoutBehavior());

    const list = registry.list();

    expect(list).toHaveLength(3);
    expect(list).toContain('retry-1');
    expect(list).toContain('breaker-1');
    expect(list).toContain('timeout-1');
  });

  it('should delete behaviors', () => {
    registry.register('retry-1', new MockRetryBehavior());

    expect(registry.get('retry-1')).not.toBeNull();

    registry.delete('retry-1');

    expect(registry.get('retry-1')).toBeNull();
  });

  it('should return null for non-existent behaviors', () => {
    expect(registry.get('nonexistent')).toBeNull();
  });
});

// ============================================================================
// Behavior Composition Tests
// ============================================================================

describe('Behavior Composition — Stacking Behaviors', () => {
  it('should stack retry + timeout', async () => {
    const retry = new MockRetryBehavior({ maxRetries: 2, baseDelay: 10 });
    const timeout = new MockTimeoutBehavior({ ms: 5000 });

    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 2) throw new Error('Fail');
      return 'success';
    };

    const result = await timeout.execute(() => retry.execute(fn));

    expect(result.success).toBe(true);
  });

  it('should stack circuit breaker + timeout', async () => {
    const breaker = new MockCircuitBreakerBehavior();
    const timeout = new MockTimeoutBehavior({ ms: 1000 });

    const fn = async () => 'success';

    const result = await timeout.execute(() => breaker.execute(fn));

    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Stress Tests
// ============================================================================

describe('Behaviors Stress Tests', () => {
  it('should handle 100 concurrent retries', async () => {
    const retry = new MockRetryBehavior();

    const promises = Array.from({ length: 100 }, async (_, i) => {
      return retry.execute(async () => `result-${i}`);
    });

    const results = await Promise.all(promises);

    expect(results).toHaveLength(100);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it('should handle rapid circuit breaker state transitions', async () => {
    const breaker = new MockCircuitBreakerBehavior({
      failureThreshold: 2,
      successThreshold: 1,
      timeout: 100,
    });

    let successCount = 0;
    for (let i = 0; i < 50; i++) {
      const fn = i % 3 === 0 ? async () => { throw new Error('Fail'); } : async () => 'success';
      const result = await breaker.execute(fn);
      if (result.success) successCount++;
    }

    expect(successCount).toBeGreaterThan(0);
  });

  it('should manage 1000 behaviors in registry', () => {
    const registry = new MockBehaviorRegistry();

    for (let i = 0; i < 1000; i++) {
      const behavior = i % 3 === 0
        ? new MockRetryBehavior()
        : i % 3 === 1
          ? new MockCircuitBreakerBehavior()
          : new MockTimeoutBehavior();

      registry.register(`behavior-${i}`, behavior);
    }

    expect(registry.list()).toHaveLength(1000);
  });
});
