/**
 * Integration tests: Dashboard data helpers
 * Tests Nova26 error types, query helpers, and error handling patterns.
 */

import { describe, it, expect } from 'vitest';
import {
  Nova26Error,
  AuthError,
  BridgeError,
  ConnectionError,
  ValidationError,
  RateLimitError,
  isNova26Error,
  toError,
} from '../../src/convex/error-types.js';

// ============================================================================
// Error hierarchy
// ============================================================================

describe('Nova26Error hierarchy', () => {
  it('Nova26Error is an instance of Error', () => {
    const err = new Nova26Error('base error', 'BASE');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('BASE');
  });

  it('AuthError extends Nova26Error', () => {
    const err = new AuthError();
    expect(err).toBeInstanceOf(Nova26Error);
    expect(err.code).toBe('AUTH_ERROR');
    expect(err.name).toBe('AuthError');
  });

  it('BridgeError stores mutation name and attempt', () => {
    const err = new BridgeError('timeout', 'dashboard:createBuild', 2);
    expect(err.mutation).toBe('dashboard:createBuild');
    expect(err.attempt).toBe(2);
    expect(err.code).toBe('BRIDGE_ERROR');
  });

  it('ConnectionError stores url', () => {
    const err = new ConnectionError('unreachable', 'https://bad.convex.cloud');
    expect(err.url).toBe('https://bad.convex.cloud');
    expect(err.code).toBe('CONNECTION_ERROR');
  });

  it('ValidationError stores optional field name', () => {
    const err = new ValidationError('must be positive', 'duration');
    expect(err.field).toBe('duration');
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('RateLimitError stores retryAfterMs', () => {
    const err = new RateLimitError('too many requests', 30_000);
    expect(err.retryAfterMs).toBe(30_000);
    expect(err.code).toBe('RATE_LIMIT_ERROR');
  });
});

// ============================================================================
// isNova26Error type guard
// ============================================================================

describe('isNova26Error', () => {
  it('returns true for Nova26Error subclasses', () => {
    expect(isNova26Error(new AuthError())).toBe(true);
    expect(isNova26Error(new BridgeError('x', 'mutation'))).toBe(true);
    expect(isNova26Error(new ValidationError('x'))).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isNova26Error(new Error('generic'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isNova26Error(null)).toBe(false);
    expect(isNova26Error('string')).toBe(false);
    expect(isNova26Error(42)).toBe(false);
  });
});

// ============================================================================
// toError
// ============================================================================

describe('toError', () => {
  it('passes through Error instances unchanged', () => {
    const original = new Error('original');
    expect(toError(original)).toBe(original);
  });

  it('wraps strings in an Error', () => {
    const err = toError('something went wrong');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('something went wrong');
  });

  it('wraps numbers in an Error', () => {
    const err = toError(42);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('42');
  });

  it('wraps null in an Error', () => {
    const err = toError(null);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('null');
  });

  it('wraps objects in an Error', () => {
    const err = toError({ code: 500 });
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('500');
  });
});

// ============================================================================
// Error instanceof chain
// ============================================================================

describe('Error instanceof chain', () => {
  it('all errors are instanceof Error for catch blocks', () => {
    const errors = [
      new AuthError(),
      new BridgeError('x', 'y'),
      new ConnectionError('x', 'y'),
      new ValidationError('x'),
      new RateLimitError('x'),
    ];

    for (const err of errors) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  it('errors can be discriminated by code in catch blocks', () => {
    function handleError(err: unknown): string {
      if (!isNova26Error(err)) return 'unknown';
      switch (err.code) {
        case 'AUTH_ERROR': return 'redirect-to-sign-in';
        case 'RATE_LIMIT_ERROR': return 'show-retry';
        case 'BRIDGE_ERROR': return 'queue-retry';
        case 'VALIDATION_ERROR': return 'show-form-error';
        case 'CONNECTION_ERROR': return 'show-offline-banner';
        default: return 'generic';
      }
    }

    expect(handleError(new AuthError())).toBe('redirect-to-sign-in');
    expect(handleError(new RateLimitError('x'))).toBe('show-retry');
    expect(handleError(new BridgeError('x', 'y'))).toBe('queue-retry');
    expect(handleError(new Error('generic'))).toBe('unknown');
    expect(handleError('string')).toBe('unknown');
  });
});
