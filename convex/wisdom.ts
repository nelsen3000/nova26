// Convex server functions for NOVA26 Global Wisdom system
// Handles pattern promotion, user profiles, and wisdom feed

import { query, mutation, action } from './_generated/server';
import { v } from 'convex/values';

// =====================
// Queries
// =====================

// Get latest global wisdom patterns for a user
// Checks user tier/opt-in, returns active patterns sorted by successScore
export const getLatestGlobalWisdom = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check user profile for tier and opt-in status
    const userProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user_id', (q) => q.eq('userId', args.userId))
      .first();

    // Default to free tier with opt-in if no profile exists
    const tier = userProfile?.tier ?? 'free';
    const optIn = userProfile?.globalWisdomOptIn ?? false;

    // Only return patterns if user has opted in
    if (!optIn) {
      return { patterns: [], tier, optedIn: false };
    }

    // Get active patterns sorted by success score (descending)
    const patterns = await ctx.db
      .query('globalPatterns')
      .withIndex('by_active', (q) => q.eq('isActive', true))
      .filter((q) => q.gte(q.field('successScore'), tier === 'free' ? 0.8 : 0.5))
      .order('desc')
      .take(args.limit ?? 20);

    return { patterns, tier, optedIn: true };
  },
});

// Get wisdom updates feed for real-time subscriptions
// Returns wisdomUpdates ordered by timestamp desc
export const getWisdomFeed = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const updates = await ctx.db
      .query('wisdomUpdates')
      .withIndex('by_timestamp')
      .order('desc')
      .take(args.limit ?? 50);

    return updates;
  },
});

// =====================
// Mutations
// =====================

// Promote a pattern to global wisdom
// Inserts into globalPatterns and wisdomUpdates
export const promotePattern = mutation({
  args: {
    canonicalContent: v.string(),
    originalNodeIds: v.array(v.string()),
    successScore: v.number(),
    userDiversity: v.number(),
    tags: v.array(v.string()),
    language: v.optional(v.string()),
    promotedByUserId: v.string(),
    embeddingVector: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    // Insert into globalPatterns
    const patternId = await ctx.db.insert('globalPatterns', {
      canonicalContent: args.canonicalContent,
      originalNodeIds: args.originalNodeIds,
      successScore: args.successScore,
      userDiversity: args.userDiversity,
      lastPromotedAt: timestamp,
      language: args.language,
      tags: args.tags,
      promotionCount: 1,
      harmReports: 0,
      isActive: true,
      embeddingVector: args.embeddingVector,
    });

    // Insert into wisdomUpdates feed
    await ctx.db.insert('wisdomUpdates', {
      patternId: patternId.toString(),
      promotedByUserId: args.promotedByUserId,
      content: args.canonicalContent,
      tags: args.tags,
      successScore: args.successScore,
      timestamp,
    });

    return { patternId: patternId.toString() };
  },
});

// Sync a vault node to the learnings table
// Upsert into learnings table
export const syncVaultNode = mutation({
  args: {
    userId: v.string(),
    nodeId: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    helpfulCount: v.number(),
    timestamp: v.string(),
  },
  handler: async (ctx, args) => {
    // Find existing learning by nodeId (stored in taskId field for vault nodes)
    const existing = await ctx.db
      .query('learnings')
      .withIndex('by_task', (q) => q.eq('taskId', args.nodeId))
      .first();

    if (existing) {
      // Update existing learning
      await ctx.db.patch(existing._id, {
        insight: args.content,
        pattern: args.tags.join(', '),
        createdAt: args.timestamp,
      });
      return { learningId: existing._id.toString(), updated: true };
    } else {
      // Create new learning (use a placeholder buildId since vault nodes are user-specific)
      const placeholderBuildId = await ctx.db.insert('builds', {
        prdId: `vault-${args.userId}`,
        prdName: 'User Vault',
        status: 'completed',
        startedAt: args.timestamp,
      });

      const learningId = await ctx.db.insert('learnings', {
        buildId: placeholderBuildId,
        taskId: args.nodeId,
        pattern: args.tags.join(', '),
        insight: args.content,
        createdAt: args.timestamp,
      });

      return { learningId: learningId.toString(), updated: false };
    }
  },
});

// Upsert user profile
// Insert or update userProfiles
export const upsertUserProfile = mutation({
  args: {
    userId: v.string(),
    email: v.optional(v.string()),
    tier: v.union(v.literal('free'), v.literal('premium')),
    globalWisdomOptIn: v.boolean(),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    // Check if profile exists
    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_user_id', (q) => q.eq('userId', args.userId))
      .first();

    if (existing) {
      // Update existing profile
      await ctx.db.patch(existing._id, {
        email: args.email,
        tier: args.tier,
        globalWisdomOptIn: args.globalWisdomOptIn,
        lastActiveAt: timestamp,
      });
      return { profileId: existing._id.toString(), created: false };
    } else {
      // Create new profile
      const profileId = await ctx.db.insert('userProfiles', {
        userId: args.userId,
        email: args.email,
        tier: args.tier,
        globalWisdomOptIn: args.globalWisdomOptIn,
        createdAt: timestamp,
        lastActiveAt: timestamp,
      });
      return { profileId: profileId.toString(), created: true };
    }
  },
});

// =====================
// Actions
// =====================

// Run nightly aggregation job
// Logs to agentActivityFeed, returns summary
export const runNightlyAggregation = action({
  args: {
    triggeredBy: v.string(),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    // Count active patterns
    const activePatterns = await ctx.db
      .query('globalPatterns')
      .withIndex('by_active', (q) => q.eq('isActive', true))
      .collect();

    // Count total user profiles
    const userProfiles = await ctx.db.query('userProfiles').collect();

    // Count opted-in users
    const optedInUsers = userProfiles.filter((u) => u.globalWisdomOptIn);

    // Log the aggregation run to agentActivityFeed
    await ctx.db.insert('agentActivityFeed', {
      userId: 'system',
      agentName: 'WisdomAggregator',
      eventType: 'task_completed',
      taskId: undefined,
      details: `Nightly aggregation completed: ${activePatterns.length} active patterns, ${userProfiles.length} total users, ${optedInUsers.length} opted in`,
      timestamp,
    });

    return {
      success: true,
      timestamp,
      triggeredBy: args.triggeredBy,
      summary: {
        activePatterns: activePatterns.length,
        totalUsers: userProfiles.length,
        optedInUsers: optedInUsers.length,
      },
    };
  },
});
