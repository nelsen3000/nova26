// Convex server functions for authentication
// Handles user identity, profile creation, and tier management

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

// Get the current user's profile
// Returns null if user not authenticated or profile not found
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // Look up user in userProfiles table
    const user = await ctx.db
      .query('userProfiles')
      .withIndex('by_user_id', (q) => q.eq('userId', identity.subject))
      .first();

    return user || null;
  },
});

// Ensure user exists in database
// Creates profile on first login if needed
export const ensureUser = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('User not authenticated');

    // Check if user already exists
    const existingUser = await ctx.db
      .query('userProfiles')
      .withIndex('by_user_id', (q) => q.eq('userId', identity.subject))
      .first();

    if (existingUser) {
      return existingUser;
    }

    // Create new user profile
    const now = new Date().toISOString();
    const userId = await ctx.db.insert('userProfiles', {
      userId: identity.subject,
      email: args.email || identity.email || undefined,
      tier: 'free',
      globalWisdomOptIn: true,
      createdAt: now,
      lastActiveAt: now,
    });

    const newUser = await ctx.db.get(userId);
    return newUser;
  },
});

// Get user by ID
export const getUser = query({
  args: {
    userId: v.id('userProfiles'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user || null;
  },
});

// Update user settings
// Takes partial settings object, merges with existing
export const updateSettings = mutation({
  args: {
    userId: v.id('userProfiles'),
    settings: v.object({
      theme: v.optional(v.union(v.literal('light'), v.literal('dark'), v.literal('system'))),
      notifications: v.optional(v.boolean()),
      email: v.optional(v.string()),
      language: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    // Validate email if provided
    if (args.settings.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(args.settings.email)) {
        throw new Error('Invalid email format');
      }
    }

    // Create settings object with validated values
    const updates: any = {};

    if (args.settings.theme !== undefined) {
      updates.theme = args.settings.theme;
    }

    if (args.settings.notifications !== undefined) {
      updates.notifications = args.settings.notifications;
    }

    if (args.settings.email !== undefined) {
      updates.email = args.settings.email;
    }

    if (args.settings.language !== undefined) {
      updates.language = args.settings.language;
    }

    // Update user
    await ctx.db.patch(args.userId, updates);

    const updated = await ctx.db.get(args.userId);
    return updated;
  },
});

// Update user tier/subscription
export const updateTier = mutation({
  args: {
    userId: v.id('userProfiles'),
    tier: v.union(
      v.literal('free'),
      v.literal('pro'),
      v.literal('team'),
      v.literal('enterprise')
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    // Validate tier transition if needed
    const validTiers = ['free', 'pro', 'team', 'enterprise'];
    if (!validTiers.includes(args.tier)) {
      throw new Error('Invalid tier');
    }

    await ctx.db.patch(args.userId, {
      tier: args.tier,
    });

    const updated = await ctx.db.get(args.userId);
    return updated;
  },
});

// Check if user is authenticated (for guards)
export const isAuthenticated = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return !!identity;
  },
});

// Get user by email (admin/internal use)
export const getUserByEmail = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query('userProfiles')
      .filter((q) => q.eq(q.field('email'), args.email))
      .take(1);

    return users.length > 0 ? users[0] : null;
  },
});
