// Auth helper utilities for the Convex backend
// These are used from Convex mutations/queries to enforce authentication.

import { AuthError } from './error-types.js';
export { AuthError } from './error-types.js';

export interface AuthContext {
  auth: {
    getUserIdentity(): Promise<{
      subject: string;
      email?: string;
      name?: string;
      pictureUrl?: string;
    } | null>;
  };
}

/**
 * requireAuth — throw ConvexError if there is no authenticated user.
 * Intended for use inside Convex query/mutation handlers.
 *
 * @example
 * export const myMutation = mutation({
 *   handler: async (ctx) => {
 *     const identity = await requireAuth(ctx);
 *     // identity.subject is the user ID
 *   }
 * });
 */
export async function requireAuth(ctx: AuthContext) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new AuthError('Not authenticated');
  }
  return identity;
}

/**
 * getOptionalAuth — returns identity or null (no throw).
 */
export async function getOptionalAuth(ctx: AuthContext) {
  return ctx.auth.getUserIdentity();
}

/**
 * Parse a user display name from identity data.
 */
export function parseDisplayName(identity: {
  name?: string;
  email?: string;
  subject: string;
}): string {
  if (identity.name) return identity.name;
  if (identity.email) return identity.email.split('@')[0];
  return `user_${identity.subject.slice(0, 8)}`;
}

/**
 * Extract initials from a display name (for avatar fallback).
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
