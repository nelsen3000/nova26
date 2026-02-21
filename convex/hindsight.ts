// Convex mutations and queries for Hindsight Persistent Memory
// Spec: .kiro/specs/hindsight-persistent-memory/design.md

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// ═══════════════════════════════════════════════════════════════════════════════
// Memory Fragment Mutations
// ═══════════════════════════════════════════════════════════════════════════════

export const storeFragment = mutation({
  args: {
    fragmentId: v.string(),
    content: v.string(),
    contentType: v.union(
      v.literal('text'),
      v.literal('code'),
      v.literal('error'),
      v.literal('insight'),
      v.literal('task_result')
    ),
    agentId: v.string(),
    projectId: v.string(),
    namespaceId: v.string(),
    embeddingVector: v.optional(v.array(v.number())),
    metadata: v.optional(v.record(v.string(), v.any())),
    expiresAt: v.optional(v.string()),
    isPinned: v.optional(v.boolean()),
  },
  returns: v.id('memoryFragments'),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('memoryFragments')
      .withIndex('by_fragment_id', q => q.eq('fragmentId', args.fragmentId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        embeddingVector: args.embeddingVector,
        metadata: args.metadata ?? existing.metadata,
        updatedAt: new Date().toISOString(),
      });
      return existing._id;
    }

    return await ctx.db.insert('memoryFragments', {
      ...args,
      isPinned: args.isPinned ?? false,
      isArchived: false,
      accessCount: 0,
      consolidationCount: 0,
      createdAt: new Date().toISOString(),
    });
  },
});

export const getFragment = query({
  args: { fragmentId: v.string() },
  returns: v.optional(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('memoryFragments')
      .withIndex('by_fragment_id', q => q.eq('fragmentId', args.fragmentId))
      .first();
  },
});

export const getFragmentsByNamespace = query({
  args: {
    namespaceId: v.string(),
    contentType: v.optional(v.union(
      v.literal('text'),
      v.literal('code'),
      v.literal('error'),
      v.literal('insight'),
      v.literal('task_result')
    )),
    limit: v.optional(v.number()),
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let results = await ctx.db
      .query('memoryFragments')
      .withIndex('by_namespace', q => q.eq('namespaceId', args.namespaceId))
      .order('desc')
      .take(args.limit ?? 100);

    if (args.contentType) {
      results = results.filter(f => f.contentType === args.contentType);
    }

    if (!args.includeArchived) {
      results = results.filter(f => !f.isArchived);
    }

    return results;
  },
});

export const searchFragments = query({
  args: {
    namespaceId: v.string(),
    queryText: v.string(),
    contentType: v.optional(v.union(
      v.literal('text'),
      v.literal('code'),
      v.literal('error'),
      v.literal('insight'),
      v.literal('task_result')
    )),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // Simple text search (full-text search would require additional indexing)
    let results = await ctx.db
      .query('memoryFragments')
      .withIndex('by_namespace', q => q.eq('namespaceId', args.namespaceId))
      .filter(q => q.eq(q.field('isArchived'), false))
      .take(args.limit ?? 50);

    // Filter by content type if specified
    if (args.contentType) {
      results = results.filter(f => f.contentType === args.contentType);
    }

    // Simple text matching (case-insensitive)
    const queryLower = args.queryText.toLowerCase();
    results = results.filter(f => 
      f.content.toLowerCase().includes(queryLower)
    );

    // Sort by relevance (access count + recency)
    return results.sort((a, b) => {
      const scoreA = a.accessCount + (a.lastAccessedAt ? 1 : 0);
      const scoreB = b.accessCount + (b.lastAccessedAt ? 1 : 0);
      return scoreB - scoreA;
    });
  },
});

export const updateFragmentAccess = mutation({
  args: { fragmentId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const fragment = await ctx.db
      .query('memoryFragments')
      .withIndex('by_fragment_id', q => q.eq('fragmentId', args.fragmentId))
      .first();

    if (!fragment) return false;

    await ctx.db.patch(fragment._id, {
      accessCount: fragment.accessCount + 1,
      lastAccessedAt: new Date().toISOString(),
    });

    return true;
  },
});

export const archiveFragment = mutation({
  args: { fragmentId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const fragment = await ctx.db
      .query('memoryFragments')
      .withIndex('by_fragment_id', q => q.eq('fragmentId', args.fragmentId))
      .first();

    if (!fragment) return false;

    await ctx.db.patch(fragment._id, { isArchived: true });
    return true;
  },
});

export const deleteFragment = mutation({
  args: { fragmentId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const fragment = await ctx.db
      .query('memoryFragments')
      .withIndex('by_fragment_id', q => q.eq('fragmentId', args.fragmentId))
      .first();

    if (!fragment) return false;

    await ctx.db.delete(fragment._id);
    return true;
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Namespace Management
// ═══════════════════════════════════════════════════════════════════════════════

export const createNamespace = mutation({
  args: {
    namespaceId: v.string(),
    name: v.string(),
    projectId: v.string(),
    agentId: v.string(),
    parentNamespaceId: v.optional(v.string()),
    forkedFromId: v.optional(v.string()),
  },
  returns: v.id('memoryNamespaces'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('memoryNamespaces', {
      ...args,
      isActive: true,
      fragmentCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },
});

export const getNamespace = query({
  args: { namespaceId: v.string() },
  returns: v.optional(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('memoryNamespaces')
      .withIndex('by_namespace_id', q => q.eq('namespaceId', args.namespaceId))
      .first();
  },
});

export const listNamespaces = query({
  args: {
    projectId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    includeInactive: v.optional(v.boolean()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let results;

    if (args.projectId) {
      results = await ctx.db
        .query('memoryNamespaces')
        .withIndex('by_project', q => q.eq('projectId', args.projectId))
        .collect();
    } else if (args.agentId) {
      results = await ctx.db
        .query('memoryNamespaces')
        .withIndex('by_agent', q => q.eq('agentId', args.agentId))
        .collect();
    } else {
      results = await ctx.db.query('memoryNamespaces').collect();
    }

    if (!args.includeInactive) {
      results = results.filter(n => n.isActive);
    }

    return results;
  },
});

export const updateNamespaceFragmentCount = mutation({
  args: {
    namespaceId: v.string(),
    fragmentCount: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const namespace = await ctx.db
      .query('memoryNamespaces')
      .withIndex('by_namespace_id', q => q.eq('namespaceId', args.namespaceId))
      .first();

    if (!namespace) return false;

    await ctx.db.patch(namespace._id, {
      fragmentCount: args.fragmentCount,
      updatedAt: new Date().toISOString(),
    });

    return true;
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Consolidation Job Management
// ═══════════════════════════════════════════════════════════════════════════════

export const createConsolidationJob = mutation({
  args: {
    jobId: v.string(),
    namespaceId: v.string(),
  },
  returns: v.id('consolidationJobs'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('consolidationJobs', {
      ...args,
      status: 'pending',
      startedAt: new Date().toISOString(),
      fragmentsProcessed: 0,
      fragmentsDeduplicated: 0,
      fragmentsArchived: 0,
    });
  },
});

export const updateConsolidationJob = mutation({
  args: {
    jobId: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed')
    ),
    fragmentsProcessed: v.optional(v.number()),
    fragmentsDeduplicated: v.optional(v.number()),
    fragmentsArchived: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query('consolidationJobs')
      .withIndex('by_job_id', q => q.eq('jobId', args.jobId))
      .first();

    if (!job) return false;

    const updates: Record<string, unknown> = { status: args.status };

    if (args.fragmentsProcessed !== undefined) {
      updates.fragmentsProcessed = args.fragmentsProcessed;
    }
    if (args.fragmentsDeduplicated !== undefined) {
      updates.fragmentsDeduplicated = args.fragmentsDeduplicated;
    }
    if (args.fragmentsArchived !== undefined) {
      updates.fragmentsArchived = args.fragmentsArchived;
    }
    if (args.errorMessage !== undefined) {
      updates.errorMessage = args.errorMessage;
    }
    if (args.status === 'completed' || args.status === 'failed') {
      updates.completedAt = new Date().toISOString();
    }

    await ctx.db.patch(job._id, updates);
    return true;
  },
});

export const getConsolidationJob = query({
  args: { jobId: v.string() },
  returns: v.optional(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('consolidationJobs')
      .withIndex('by_job_id', q => q.eq('jobId', args.jobId))
      .first();
  },
});
