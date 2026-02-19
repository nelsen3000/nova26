// Circuit Breaker Tests — R17-01 Advanced Error Recovery
// 20 tests covering closed/open/half-open transitions, execute, stats, reset

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitOpenError,
} from './circuit-breaker.js';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1
  it('starts in closed state', () => {
    const cb = new CircuitBreaker('test');
    expect(cb.getState()).toBe('closed');
  });

  // 2
  it('stays closed after failures below threshold', () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 5 });
    for (let i = 0; i < 4; i++) {
      cb.recordFailure(new Error('fail'));
    }
    expect(cb.getState()).toBe('closed');
  });

  // 3
  it('trips to open when failure threshold is reached', () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 3 });
    for (let i = 0; i < 3; i++) {
      cb.recordFailure(new Error('fail'));
    }
    expect(cb.getState()).toBe('open');
  });

  // 4
  it('transitions from open to half-open after resetTimeoutMs', () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 1, resetTimeoutMs: 5000 });
    cb.recordFailure(new Error('fail'));
    expect(cb.getState()).toBe('open');

    vi.advanceTimersByTime(5000);
    expect(cb.getState()).toBe('half-open');
  });

  // 5
  it('does not transition to half-open before resetTimeoutMs', () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 1, resetTimeoutMs: 5000 });
    cb.recordFailure(new Error('fail'));

    vi.advanceTimersByTime(4999);
    expect(cb.getState()).toBe('open');
  });

  // 6
  it('transitions from half-open back to closed after enough successes', () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 1,
      resetTimeoutMs: 1000,
      halfOpenMaxAttempts: 2,
    });
    cb.recordFailure(new Error('fail'));
    vi.advanceTimersByTime(1000);
    expect(cb.getState()).toBe('half-open');

    cb.recordSuccess();
    cb.recordSuccess();
    expect(cb.getState()).toBe('closed');
  });

  // 7
  it('transitions from half-open back to open on failure', () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 1,
      resetTimeoutMs: 1000,
    });
    cb.recordFailure(new Error('fail'));
    vi.advanceTimersByTime(1000);
    expect(cb.getState()).toBe('half-open');

    cb.recordFailure(new Error('fail again'));
    expect(cb.getState()).toBe('open');
  });

  // 8
  it('execute resolves successfully when circuit is closed', async () => {
    const cb = new CircuitBreaker('test');
    const result = await cb.execute(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  // 9
  it('execute throws CircuitOpenError when circuit is open', async () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 1, resetTimeoutMs: 60000 });
    cb.recordFailure(new Error('fail'));
    expect(cb.getState()).toBe('open');

    await expect(cb.execute(() => Promise.resolve(42))).rejects.toThrow(CircuitOpenError);
  });

  // 10
  it('execute records failure on rejected promise', async () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 2 });
    await expect(cb.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');

    const stats = cb.getStats();
    expect(stats.failureCount).toBe(1);
  });

  // 11
  it('execute records success on resolved promise', async () => {
    const cb = new CircuitBreaker('test');
    await cb.execute(() => Promise.resolve('ok'));

    const stats = cb.getStats();
    expect(stats.successCount).toBe(1);
  });

  // 12
  it('getStats returns correct stats', () => {
    const cb = new CircuitBreaker('my-service', { failureThreshold: 5 });
    cb.recordSuccess();
    cb.recordFailure(new Error('err'));

    const stats = cb.getStats();
    expect(stats.name).toBe('my-service');
    expect(stats.state).toBe('closed');
    expect(stats.failureCount).toBe(1);
    expect(stats.successCount).toBe(1);
    expect(stats.lastFailureAt).toBeDefined();
    expect(stats.lastSuccessAt).toBeDefined();
    expect(stats.totalTrips).toBe(0);
  });

  // 13
  it('totalTrips increments on each trip', () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 1, resetTimeoutMs: 1000 });
    cb.recordFailure(new Error('fail 1'));
    expect(cb.getStats().totalTrips).toBe(1);

    vi.advanceTimersByTime(1000);
    // getState() triggers the open -> half-open transition
    expect(cb.getState()).toBe('half-open');
    // A failure in half-open trips the circuit again
    cb.recordFailure(new Error('fail 2'));
    expect(cb.getStats().totalTrips).toBe(2);
  });

  // 14
  it('reset restores to initial closed state', () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 1 });
    cb.recordFailure(new Error('fail'));
    expect(cb.getState()).toBe('open');

    cb.reset();
    const stats = cb.getStats();
    expect(stats.state).toBe('closed');
    expect(stats.failureCount).toBe(0);
    expect(stats.successCount).toBe(0);
    expect(stats.trippedAt).toBeUndefined();
  });

  // 15
  it('shouldAttempt returns true when closed', () => {
    const cb = new CircuitBreaker('test');
    expect(cb.shouldAttempt()).toBe(true);
  });

  // 16
  it('shouldAttempt returns false when open and timeout not elapsed', () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 1, resetTimeoutMs: 5000 });
    cb.recordFailure(new Error('fail'));
    expect(cb.shouldAttempt()).toBe(false);
  });

  // 17
  it('shouldAttempt returns true when open and timeout elapsed (transitions to half-open)', () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 1, resetTimeoutMs: 1000 });
    cb.recordFailure(new Error('fail'));
    vi.advanceTimersByTime(1000);
    expect(cb.shouldAttempt()).toBe(true);
    expect(cb.getState()).toBe('half-open');
  });

  // 18
  it('failures outside monitorWindowMs are pruned', () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 3,
      monitorWindowMs: 5000,
    });

    cb.recordFailure(new Error('old1'));
    cb.recordFailure(new Error('old2'));
    vi.advanceTimersByTime(6000);
    // Old failures are outside window, so after next failure count should be 1
    cb.recordFailure(new Error('new'));
    expect(cb.getStats().failureCount).toBe(1);
    expect(cb.getState()).toBe('closed');
  });

  // 19
  it('CircuitOpenError has correct name and message', () => {
    const err = new CircuitOpenError('ollama');
    expect(err.name).toBe('CircuitOpenError');
    expect(err.message).toContain('ollama');
    expect(err.message).toContain('open');
  });

  // 20
  it('half-open limits attempts via halfOpenMaxAttempts', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 1,
      resetTimeoutMs: 1000,
      halfOpenMaxAttempts: 2,
    });

    cb.recordFailure(new Error('fail'));
    vi.advanceTimersByTime(1000);
    expect(cb.getState()).toBe('half-open');

    // First two attempts should be allowed
    const r1 = await cb.execute(() => Promise.resolve('a'));
    expect(r1).toBe('a');
    const r2 = await cb.execute(() => Promise.resolve('b'));
    expect(r2).toBe('b');

    // After 2 successes meeting the threshold, circuit should close
    expect(cb.getState()).toBe('closed');
  });
});
