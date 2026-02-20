// Convex server functions for user management
// Handles user profiles, preferences, and tier management

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

// Get paginated list of all users
export const listUsers = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 100);

    const users = await ctx.db
      .query('userProfiles')
      .order('desc')
      .take(limit + 1);

    const hasMore = users.length > limit;
    if (hasMore) {
      users.pop();
    }

    const nextCursor = hasMore && users.length > 0
      ? users[users.length - 1]._id.toString()
      : null;

    return {
      users,
      nextCursor,
      hasMore,
    };
  },
});

// Get users by tier
export const getUsersByTier = query({
  args: {
    tier: v.union(
      v.literal('free'),
      v.literal('pro'),
      v.literal('team'),
      v.literal('enterprise')
    ),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query('userProfiles')
      .withIndex('by_tier', (q) => q.eq('tier', args.tier))
      .collect();

    return users;
  },
});

// Update user profile (name, email, etc)
export const updateProfile = mutation({
  args: {
    userId: v.id('userProfiles'),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    const updates: any = {};

    if (args.name !== undefined && args.name.trim()) {
      updates.name = args.name;
    }

    if (args.email !== undefined && args.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(args.email)) {
        throw new Error('Invalid email format');
      }
      updates.email = args.email;
    }

    if (Object.keys(updates).length === 0) {
      return user;
    }

    await ctx.db.patch(args.userId, updates);
    const updated = await ctx.db.get(args.userId);
    return updated;
  },
});

// Update user preferences
export const updatePreferences = mutation({
  args: {
    userId: v.id('userProfiles'),
    preferences: v.object({
      theme: v.optional(v.union(v.literal('light'), v.literal('dark'), v.literal('system'))),
      notifications: v.optional(v.boolean()),
      emailNotifications: v.optional(v.boolean()),
      globalWisdomOptIn: v.optional(v.boolean()),
      language: v.optional(v.string()),
      timezone: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    const updates: any = {};

    if (args.preferences.theme !== undefined) {
      updates.theme = args.preferences.theme;
    }

    if (args.preferences.notifications !== undefined) {
      updates.notifications = args.preferences.notifications;
    }

    if (args.preferences.emailNotifications !== undefined) {
      updates.emailNotifications = args.preferences.emailNotifications;
    }

    if (args.preferences.globalWisdomOptIn !== undefined) {
      updates.globalWisdomOptIn = args.preferences.globalWisdomOptIn;
    }

    if (args.preferences.language !== undefined) {
      updates.language = args.preferences.language;
    }

    if (args.preferences.timezone !== undefined) {
      updates.timezone = args.preferences.timezone;
    }

    if (Object.keys(updates).length === 0) {
      return user;
    }

    await ctx.db.patch(args.userId, updates);
    const updated = await ctx.db.get(args.userId);
    return updated;
  },
});

// Update user tier
export const upgradeTier = mutation({
  args: {
    userId: v.id('userProfiles'),
    newTier: v.union(
      v.literal('free'),
      v.literal('pro'),
      v.literal('team'),
      v.literal('enterprise')
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    const validTransitions: Record<string, string[]> = {
      'free': ['pro', 'team', 'enterprise'],
      'pro': ['team', 'enterprise'],
      'team': ['enterprise'],
      'enterprise': [],
    };

    const currentTier = user.tier || 'free';
    if (!validTransitions[currentTier]?.includes(args.newTier)) {
      throw new Error('Invalid tier transition');
    }

    await ctx.db.patch(args.userId, {
      tier: args.newTier,
    });

    const updated = await ctx.db.get(args.userId);
    return updated;
  },
});

// Mark user as active (update lastActiveAt)
export const recordActivity = mutation({
  args: {
    userId: v.id('userProfiles'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    await ctx.db.patch(args.userId, {
      lastActiveAt: new Date().toISOString(),
    });

    return args.userId;
  },
});

// Get users active in last N days
export const getActiveUsers = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.days ?? 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const users = await ctx.db.query('userProfiles').collect();

    const activeUsers = users.filter((u) => {
      const lastActive = new Date(u.lastActiveAt);
      return lastActive >= cutoffDate;
    });

    return activeUsers.sort((a, b) =>
      new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );
  },
});

// Get user statistics
export const getUserStats = query({
  args: {
    userId: v.id('userProfiles'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    // Calculate days since account creation
    const createdDate = new Date(user.createdAt);
    const now = new Date();
    const daysSinceCreation = Math.floor(
      (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate days since last active
    const lastActiveDate = new Date(user.lastActiveAt);
    const daysSinceActive = Math.floor(
      (now.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      userId: user._id,
      tier: user.tier,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
      daysSinceCreation,
      daysSinceActive,
      email: user.email,
    };
  },
});

// Delete user account (soft delete)
export const deleteUser = mutation({
  args: {
    userId: v.id('userProfiles'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    // Instead of hard delete, mark as deleted
    await ctx.db.patch(args.userId, {
      // Add a deleted flag if schema supports it
      // For now, just remove email as soft delete indicator
      email: null,
    });

    return args.userId;
  },
});
