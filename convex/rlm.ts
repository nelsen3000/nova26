// Convex mutations and queries for Recursive Language Models (RLM)
// Spec: .kiro/specs/recursive-language-models/tasks.md

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// ═══════════════════════════════════════════════════════════════════════════════
// Mutations
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get or create RLM config for a company/agent
 */
export const getRlmConfig = query({
  args: {
    companyId: v.string(),
    agentId: v.optional(v.string()),
  },
  returns: v.optional(
    v.object({
      _id: v.id('rlmConfigs'),
      _creationTime: v.number(),
      companyId: v.string(),
      agentId: v.optional(v.string()),
      enabled: v.boolean(),
      readerModelId: v.string(),
      compressionThreshold: v.number(),
      maxTokens: v.number(),
      fallbackOnError: v.boolean(),
      updatedAt: v.string(),
      updatedBy: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    // First try to get agent-specific config
    if (args.agentId) {
      const agentConfig = await ctx.db
        .query('rlmConfigs')
        .withIndex('by_company_agent', (q) =>
          q.eq('companyId', args.companyId).eq('agentId', args.agentId)
        )
        .first();

      if (agentConfig) {
        return agentConfig;
      }
    }

    // Fall back to company default (agentId is null/undefined)
    return await ctx.db
      .query('rlmConfigs')
      .withIndex('by_company_agent', (q) =>
        q.eq('companyId', args.companyId).eq('agentId', undefined)
      )
      .first();
  },
});

/**
 * Update RLM configuration
 */
export const updateRlmConfig = mutation({
  args: {
    companyId: v.string(),
    agentId: v.optional(v.string()),
    enabled: v.boolean(),
    readerModelId: v.string(),
    compressionThreshold: v.number(),
    maxTokens: v.number(),
    fallbackOnError: v.boolean(),
    updatedBy: v.string(),
  },
  returns: v.id('rlmConfigs'),
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    // Check if config exists
    const existing = await ctx.db
      .query('rlmConfigs')
      .withIndex('by_company_agent', (q) =>
        q.eq('companyId', args.companyId).eq('agentId', args.agentId)
      )
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        enabled: args.enabled,
        readerModelId: args.readerModelId,
        compressionThreshold: args.compressionThreshold,
        maxTokens: args.maxTokens,
        fallbackOnError: args.fallbackOnError,
        updatedAt: now,
        updatedBy: args.updatedBy,
      });
      return existing._id;
    } else {
      // Create new
      return await ctx.db.insert('rlmConfigs', {
        companyId: args.companyId,
        agentId: args.agentId,
        enabled: args.enabled,
        readerModelId: args.readerModelId,
        compressionThreshold: args.compressionThreshold,
        maxTokens: args.maxTokens,
        fallbackOnError: args.fallbackOnError,
        updatedAt: now,
        updatedBy: args.updatedBy,
      });
    }
  },
});

/**
 * Log an RLM audit entry
 */
export const logAuditEntry = mutation({
  args: {
    companyId: v.string(),
    sessionId: v.string(),
    agentId: v.string(),
    originalTokens: v.number(),
    compressedTokens: v.number(),
    compressionRatio: v.number(),
    driftScore: v.number(),
    fallbackUsed: v.boolean(),
    segmentsCount: v.number(),
    warningIssued: v.boolean(),
  },
  returns: v.id('rlmAuditLogs'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('rlmAuditLogs', {
      companyId: args.companyId,
      sessionId: args.sessionId,
      agentId: args.agentId,
      originalTokens: args.originalTokens,
      compressedTokens: args.compressedTokens,
      compressionRatio: args.compressionRatio,
      driftScore: args.driftScore,
      fallbackUsed: args.fallbackUsed,
      segmentsCount: args.segmentsCount,
      timestamp: new Date().toISOString(),
      warningIssued: args.warningIssued,
    });
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get audit history for a company
 */
export const getAuditHistory = query({
  args: {
    companyId: v.string(),
    limit: v.optional(v.number()),
    agentId: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      _id: v.id('rlmAuditLogs'),
      _creationTime: v.number(),
      companyId: v.string(),
      sessionId: v.string(),
      agentId: v.string(),
      originalTokens: v.number(),
      compressedTokens: v.number(),
      compressionRatio: v.number(),
      driftScore: v.number(),
      fallbackUsed: v.boolean(),
      segmentsCount: v.number(),
      timestamp: v.string(),
      warningIssued: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    let query = ctx.db
      .query('rlmAuditLogs')
      .withIndex('by_company_time', (q) => q.eq('companyId', args.companyId));

    if (args.agentId) {
      query = query.filter((q) => q.eq(q.field('agentId'), args.agentId));
    }

    return await query.order('desc').take(args.limit ?? 100);
  },
});

/**
 * Get audit stats for a company (avg compression, drift, etc.)
 */
export const getAuditStats = query({
  args: {
    companyId: v.string(),
    since: v.optional(v.string()), // ISO timestamp
  },
  returns: v.object({
    totalCompressions: v.number(),
    avgCompressionRatio: v.number(),
    avgDriftScore: v.number(),
    fallbackRate: v.number(),
    warningRate: v.number(),
  }),
  handler: async (ctx, args) => {
    let query = ctx.db
      .query('rlmAuditLogs')
      .withIndex('by_company', (q) => q.eq('companyId', args.companyId));

    if (args.since) {
      query = query.filter((q) => q.gte(q.field('timestamp'), args.since));
    }

    const entries = await query.collect();

    if (entries.length === 0) {
      return {
        totalCompressions: 0,
        avgCompressionRatio: 0,
        avgDriftScore: 0,
        fallbackRate: 0,
        warningRate: 0,
      };
    }

    const totalCompressions = entries.length;
    const avgCompressionRatio =
      entries.reduce((sum, e) => sum + e.compressionRatio, 0) / totalCompressions;
    const avgDriftScore =
      entries.reduce((sum, e) => sum + e.driftScore, 0) / totalCompressions;
    const fallbackCount = entries.filter((e) => e.fallbackUsed).length;
    const warningCount = entries.filter((e) => e.warningIssued).length;

    return {
      totalCompressions,
      avgCompressionRatio,
      avgDriftScore,
      fallbackRate: fallbackCount / totalCompressions,
      warningRate: warningCount / totalCompressions,
    };
  },
});

/**
 * List all RLM configs for a company
 */
export const listRlmConfigs = query({
  args: {
    companyId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id('rlmConfigs'),
      _creationTime: v.number(),
      companyId: v.string(),
      agentId: v.optional(v.string()),
      enabled: v.boolean(),
      readerModelId: v.string(),
      compressionThreshold: v.number(),
      maxTokens: v.number(),
      fallbackOnError: v.boolean(),
      updatedAt: v.string(),
      updatedBy: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('rlmConfigs')
      .withIndex('by_company', (q) => q.eq('companyId', args.companyId))
      .collect();
  },
});

/**
 * Delete RLM config
 */
export const deleteRlmConfig = mutation({
  args: {
    configId: v.id('rlmConfigs'),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.configId);
    return true;
  },
});
