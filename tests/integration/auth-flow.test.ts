/**
 * Integration tests: Auth flow
 * Tests sign-up, sign-in, session persistence, protected routes.
 *
 * NOTE: These are unit-level tests of the auth helper utilities.
 * Full E2E browser tests are separate (Playwright / Cypress).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  requireAuth,
  getOptionalAuth,
  parseDisplayName,
  getInitials,
  AuthError,
} from '../../src/convex/auth-helpers.js';

// ============================================================================
// Mock auth context factory
// ============================================================================

function mockAuthCtx(identity: {
  subject?: string;
  email?: string;
  name?: string;
  pictureUrl?: string;
} | null) {
  return {
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(
        identity
          ? { subject: 'sub-001', ...identity }
          : null
      ),
    },
  };
}

// ============================================================================
// requireAuth
// ============================================================================

describe('requireAuth', () => {
  it('returns identity when user is authenticated', async () => {
    const ctx = mockAuthCtx({ email: 'alice@example.com', name: 'Alice' });
    const identity = await requireAuth(ctx);
    expect(identity.email).toBe('alice@example.com');
    expect(identity.name).toBe('Alice');
  });

  it('throws AuthError when no user is authenticated', async () => {
    const ctx = mockAuthCtx(null);
    await expect(requireAuth(ctx)).rejects.toThrow(AuthError);
  });

  it('throws AuthError with "Not authenticated" message', async () => {
    const ctx = mockAuthCtx(null);
    await expect(requireAuth(ctx)).rejects.toThrow('Not authenticated');
  });

  it('calls getUserIdentity exactly once', async () => {
    const ctx = mockAuthCtx({ email: 'bob@example.com' });
    await requireAuth(ctx);
    expect(ctx.auth.getUserIdentity).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// getOptionalAuth
// ============================================================================

describe('getOptionalAuth', () => {
  it('returns identity when user is present', async () => {
    const ctx = mockAuthCtx({ email: 'carol@example.com' });
    const identity = await getOptionalAuth(ctx);
    expect(identity?.email).toBe('carol@example.com');
  });

  it('returns null when no user (does not throw)', async () => {
    const ctx = mockAuthCtx(null);
    const identity = await getOptionalAuth(ctx);
    expect(identity).toBeNull();
  });
});

// ============================================================================
// parseDisplayName
// ============================================================================

describe('parseDisplayName', () => {
  it('prefers name over email', () => {
    const result = parseDisplayName({ subject: 'sub-1', name: 'Alice', email: 'alice@example.com' });
    expect(result).toBe('Alice');
  });

  it('falls back to email username when name is absent', () => {
    const result = parseDisplayName({ subject: 'sub-1', email: 'bob@example.com' });
    expect(result).toBe('bob');
  });

  it('falls back to short subject when both name and email are absent', () => {
    const result = parseDisplayName({ subject: 'abcdefgh1234' });
    expect(result).toBe('user_abcdefgh');
  });
});

// ============================================================================
// getInitials
// ============================================================================

describe('getInitials', () => {
  it('extracts first letters of first two words', () => {
    expect(getInitials('Alice Johnson')).toBe('AJ');
  });

  it('handles single-word names', () => {
    expect(getInitials('Alice')).toBe('A');
  });

  it('uppercases the initials', () => {
    expect(getInitials('dave')).toBe('D');
  });

  it('only uses first two words even for three-word names', () => {
    expect(getInitials('Alice Marie Johnson')).toBe('AM');
  });

  it('handles empty string without crashing', () => {
    expect(getInitials('')).toBe('');
  });
});

// ============================================================================
// AuthError type
// ============================================================================

describe('AuthError', () => {
  it('is an instance of Error', () => {
    const err = new AuthError();
    expect(err).toBeInstanceOf(Error);
  });

  it('has code AUTH_ERROR', () => {
    const err = new AuthError();
    expect(err.code).toBe('AUTH_ERROR');
  });

  it('accepts custom message', () => {
    const err = new AuthError('Session expired');
    expect(err.message).toBe('Session expired');
  });

  it('name is AuthError', () => {
    const err = new AuthError();
    expect(err.name).toBe('AuthError');
  });
});
