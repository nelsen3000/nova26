import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  withRetry,
  isRetryableError,
  calculateDelay,
  type RetryOptions,
} from '../retry.js';

// Use zero delays in tests to avoid slow tests
const FAST_OPTS = { baseDelayMs: 0, maxDelayMs: 0 };

describe('Retry Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isRetryableError', () => {
    it('should return true for TypeError (network errors)', () => {
      expect(isRetryableError(new TypeError('Failed to fetch'))).toBe(true);
    });

    it('should return true for errors with status 429', () => {
      expect(isRetryableError({ status: 429 })).toBe(true);
    });

    it('should return true for errors with status 500-599', () => {
      expect(isRetryableError({ status: 500 })).toBe(true);
      expect(isRetryableError({ status: 502 })).toBe(true);
      expect(isRetryableError({ status: 503 })).toBe(true);
      expect(isRetryableError({ status: 599 })).toBe(true);
    });

    it('should return true for errors with response.status in 5xx range', () => {
      expect(isRetryableError({ response: { status: 503 } })).toBe(true);
      expect(isRetryableError({ response: { status: 429 } })).toBe(true);
    });

    it('should return false for client errors', () => {
      expect(isRetryableError({ status: 400 })).toBe(false);
      expect(isRetryableError({ status: 404 })).toBe(false);
    });

    it('should return false for generic Error', () => {
      expect(isRetryableError(new Error('something broke'))).toBe(false);
    });

    it('should return false for non-error primitives', () => {
      expect(isRetryableError('string error')).toBe(false);
      expect(isRetryableError(42)).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });
  });

  describe('calculateDelay', () => {
    const baseOptions: RetryOptions = {
      maxAttempts: 5,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
    };

    it('should return a delay for attempt 1 at most baseDelayMs', () => {
      const delay = calculateDelay(1, baseOptions);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(baseOptions.baseDelayMs);
    });

    it('should produce exponentially increasing delays on average', () => {
      let avg1 = 0;
      let avg3 = 0;
      for (let i = 0; i < 100; i++) {
        avg1 += calculateDelay(1, baseOptions);
        avg3 += calculateDelay(3, baseOptions);
      }
      expect(avg3 / 100).toBeGreaterThan(avg1 / 100);
    });

    it('should respect maxDelayMs cap', () => {
      const opts: RetryOptions = { ...baseOptions, maxDelayMs: 500 };
      for (let i = 0; i < 50; i++) {
        expect(calculateDelay(10, opts)).toBeLessThanOrEqual(500);
      }
    });

    it('should always return a non-negative integer', () => {
      for (let attempt = 1; attempt <= 10; attempt++) {
        const delay = calculateDelay(attempt, baseOptions);
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(delay)).toBe(true);
      }
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt without retrying', async () => {
      const fn = vi.fn<() => Promise<string>>().mockResolvedValue('ok');
      const result = await withRetry(fn, FAST_OPTS);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry and succeed on the second attempt', async () => {
      const fn = vi.fn<() => Promise<string>>()
        .mockRejectedValueOnce(new TypeError('network error'))
        .mockResolvedValueOnce('recovered');
      const result = await withRetry(fn, FAST_OPTS);
      expect(result).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry and succeed on the third attempt', async () => {
      const fn = vi.fn<() => Promise<string>>()
        .mockRejectedValueOnce(new TypeError('network error'))
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValueOnce('finally');
      const result = await withRetry(fn, FAST_OPTS);
      expect(result).toBe('finally');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should exhaust all attempts and throw the last error', async () => {
      const lastError = new TypeError('persistent failure');
      const fn = vi.fn<() => Promise<string>>()
        .mockRejectedValueOnce(new TypeError('fail 1'))
        .mockRejectedValueOnce(new TypeError('fail 2'))
        .mockRejectedValue(lastError);
      await expect(withRetry(fn, { ...FAST_OPTS, maxAttempts: 3 })).rejects.toBe(lastError);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw immediately for non-retryable errors', async () => {
      const error = new Error('validation error');
      const fn = vi.fn<() => Promise<string>>().mockRejectedValue(error);
      await expect(withRetry(fn, FAST_OPTS)).rejects.toBe(error);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should use custom retryableErrors predicate', async () => {
      const customError = { code: 'CUSTOM_RETRYABLE' };
      const fn = vi.fn<() => Promise<string>>()
        .mockRejectedValueOnce(customError)
        .mockResolvedValueOnce('ok');
      const result = await withRetry(fn, {
        ...FAST_OPTS,
        retryableErrors: (err: unknown) =>
          typeof err === 'object' && err !== null && 'code' in err &&
          (err as Record<string, unknown>).code === 'CUSTOM_RETRYABLE',
      });
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry when custom predicate returns false', async () => {
      const error = new TypeError('network error');
      const fn = vi.fn<() => Promise<string>>().mockRejectedValue(error);
      await expect(withRetry(fn, { ...FAST_OPTS, retryableErrors: () => false })).rejects.toBe(error);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback with correct arguments', async () => {
      const onRetry = vi.fn<(attempt: number, error: unknown, delayMs: number) => void>();
      const networkError = new TypeError('network error');
      const fn = vi.fn<() => Promise<string>>()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce('ok');
      await withRetry(fn, { ...FAST_OPTS, onRetry });
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, networkError, expect.any(Number));
    });

    it('should respect maxAttempts option', async () => {
      const fn = vi.fn<() => Promise<string>>().mockRejectedValue(new TypeError('fail'));
      await expect(withRetry(fn, { ...FAST_OPTS, maxAttempts: 5 })).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('should use default maxAttempts of 3', async () => {
      const fn = vi.fn<() => Promise<string>>().mockRejectedValue(new TypeError('fail'));
      await expect(withRetry(fn, FAST_OPTS)).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should handle maxAttempts of 1 (no retries)', async () => {
      const error = new TypeError('fail');
      const fn = vi.fn<() => Promise<string>>().mockRejectedValue(error);
      await expect(withRetry(fn, { ...FAST_OPTS, maxAttempts: 1 })).rejects.toBe(error);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should return the correct type', async () => {
      const fn = vi.fn<() => Promise<{ id: number }>>().mockResolvedValue({ id: 42 });
      const result = await withRetry(fn, FAST_OPTS);
      expect(result).toEqual({ id: 42 });
    });
  });
});
