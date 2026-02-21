// Convex mutations and queries for Taste Vault
// Spec: .kiro/specs/taste-vault/design.md (referenced from SAGA)

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// ═══════════════════════════════════════════════════════════════════════════════
// Taste Pattern Mutations
// ═══════════════════════════════════════════════════════════════════════════════

export const createPattern = mutation({
  args: {
    patternId: v.string(),
    canonicalContent: v.string(),
    patternType: v.union(
      v.literal('architectural'),
      v.literal('code_style'),
      v.literal('testing'),
      v.literal('security'),
      v.literal('performance')
    ),
    language: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    embeddingVector: v.optional(v.array(v.number())),
  },
  returns: v.id('tastePatterns'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('tastePatterns', {
      ...args,
      successScore: 0.5,
      userDiversity: 0,
      promotionCount: 0,
      harmReports: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastPromotedAt: new Date().toISOString(),
    });
  },
});

export const updatePatternScore = mutation({
  args: {
    patternId: v.string(),
    successScore: v.number(),
    userDiversity: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const pattern = await ctx.db
      .query('tastePatterns')
      .withIndex('by_pattern_id', q => q.eq('patternId', args.patternId))
      .first();

    if (!pattern) return false;

    await ctx.db.patch(pattern._id, {
      successScore: args.successScore,
      userDiversity: args.userDiversity ?? pattern.userDiversity,
      updatedAt: new Date().toISOString(),
    });

    return true;
  },
});

export const promotePattern = mutation({
  args: { patternId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const pattern = await ctx.db
      .query('tastePatterns')
      .withIndex('by_pattern_id', q => q.eq('patternId', args.patternId))
      .first();

    if (!pattern) return false;

    await ctx.db.patch(pattern._id, {
      promotionCount: pattern.promotionCount + 1,
      lastPromotedAt: new Date().toISOString(),
    });

    return true;
  },
});

export const reportHarm = mutation({
  args: { patternId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const pattern = await ctx.db
      .query('tastePatterns')
      .withIndex('by_pattern_id', q => q.eq('patternId', args.patternId))
      .first();

    if (!pattern) return false;

    const newHarmCount = pattern.harmReports + 1;
    await ctx.db.patch(pattern._id, {
      harmReports: newHarmCount,
      isActive: newHarmCount < 5, // Auto-deactivate after 5 reports
    });

    return true;
  },
});

export const deactivatePattern = mutation({
  args: { patternId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const pattern = await ctx.db
      .query('tastePatterns')
      .withIndex('by_pattern_id', q => q.eq('patternId', args.patternId))
      .first();

    if (!pattern) return false;

    await ctx.db.patch(pattern._id, { isActive: false });
    return true;
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Pattern Queries
// ═══════════════════════════════════════════════════════════════════════════════

export const getPattern = query({
  args: { patternId: v.string() },
  returns: v.optional(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('tastePatterns')
      .withIndex('by_pattern_id', q => q.eq('patternId', args.patternId))
      .first();
  },
});

export const listPatterns = query({
  args: {
    patternType: v.optional(v.union(
      v.literal('architectural'),
      v.literal('code_style'),
      v.literal('testing'),
      v.literal('security'),
      v.literal('performance')
    )),
    language: v.optional(v.string()),
    minSuccessScore: v.optional(v.number()),
    includeInactive: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let results;

    if (args.patternType) {
      results = await ctx.db
        .query('tastePatterns')
        .withIndex('by_type', q => q.eq('patternType', args.patternType))
        .take(args.limit ?? 100);
    } else if (args.minSuccessScore !== undefined) {
      results = await ctx.db
        .query('tastePatterns')
        .withIndex('by_success_score', q => q.gte('successScore', args.minSuccessScore))
        .take(args.limit ?? 100);
    } else {
      results = await ctx.db
        .query('tastePatterns')
        .take(args.limit ?? 100);
    }

    // Filter by language if specified
    if (args.language) {
      results = results.filter(p => p.language === args.language);
    }

    // Filter inactive unless requested
    if (!args.includeInactive) {
      results = results.filter(p => p.isActive);
    }

    // Sort by success score descending
    return results.sort((a, b) => b.successScore - a.successScore);
  },
});

export const searchPatterns = query({
  args: {
    query: v.string(),
    patternType: v.optional(v.union(
      v.literal('architectural'),
      v.literal('code_style'),
      v.literal('testing'),
      v.literal('security'),
      v.literal('performance')
    )),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let results = await ctx.db
      .query('tastePatterns')
      .filter(q => q.eq(q.field('isActive'), true))
      .take(args.limit ?? 50);

    if (args.patternType) {
      results = results.filter(p => p.patternType === args.patternType);
    }

    // Simple text search in content
    const queryLower = args.query.toLowerCase();
    results = results.filter(p =>
      p.canonicalContent.toLowerCase().includes(queryLower) ||
      p.tags.some((tag: string) => tag.toLowerCase().includes(queryLower))
    );

    // Sort by success score
    return results.sort((a, b) => b.successScore - a.successScore);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Pattern Vote Mutations
// ═══════════════════════════════════════════════════════════════════════════════

export const castVote = mutation({
  args: {
    voteId: v.string(),
    patternId: v.string(),
    userId: v.string(),
    voteType: v.union(v.literal('upvote'), v.literal('downvote'), v.literal('report')),
    context: v.optional(v.string()),
  },
  returns: v.id('patternVotes'),
  handler: async (ctx, args) => {
    // Check for existing vote
    const existing = await ctx.db
      .query('patternVotes')
      .withIndex('by_pattern_user', q => 
        q.eq('patternId', args.patternId).eq('userId', args.userId)
      )
      .first();

    if (existing) {
      // Update existing vote
      await ctx.db.patch(existing._id, {
        voteType: args.voteType,
        context: args.context ?? existing.context,
      });
      return existing._id;
    }

    return await ctx.db.insert('patternVotes', {
      ...args,
      createdAt: new Date().toISOString(),
    });
  },
});

export const getPatternVotes = query({
  args: { patternId: v.string() },
  returns: v.object({
    upvotes: v.number(),
    downvotes: v.number(),
    reports: v.number(),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    const votes = await ctx.db
      .query('patternVotes')
      .withIndex('by_pattern', q => q.eq('patternId', args.patternId))
      .collect();

    return {
      upvotes: votes.filter(v => v.voteType === 'upvote').length,
      downvotes: votes.filter(v => v.voteType === 'downvote').length,
      reports: votes.filter(v => v.voteType === 'report').length,
      total: votes.length,
    };
  },
});

export const getUserVote = query({
  args: {
    patternId: v.string(),
    userId: v.string(),
  },
  returns: v.optional(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('patternVotes')
      .withIndex('by_pattern_user', q => 
        q.eq('patternId', args.patternId).eq('userId', args.userId)
      )
      .first();
  },
});
