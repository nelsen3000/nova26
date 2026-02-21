// Convex mutations and queries for SAGA (Self-Evolving Goal Agents)
// Spec: .kiro/specs/saga-self-evolving-agents/design.md

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// ═══════════════════════════════════════════════════════════════════════════════
// Goal Genome Mutations
// ═══════════════════════════════════════════════════════════════════════════════

export const persistGenome = mutation({
  args: {
    genomeId: v.string(),
    agentName: v.string(),
    schemaVersion: v.number(),
    generation: v.number(),
    parentId: v.optional(v.string()),
    objectives: v.array(v.object({
      id: v.string(),
      description: v.string(),
      domain: v.string(),
      parameters: v.record(v.string(), v.any()),
      weight: v.number(),
    })),
    fitnessCriteria: v.array(v.object({
      objectiveId: v.string(),
      metricName: v.string(),
      targetValue: v.number(),
      currentValue: v.number(),
    })),
    fitnessScore: v.optional(v.number()),
    serializedData: v.string(),
    projectId: v.string(),
  },
  returns: v.id('goalGenomes'),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('goalGenomes')
      .withIndex('by_genome_id', q => q.eq('genomeId', args.genomeId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        fitnessScore: args.fitnessScore,
        objectives: args.objectives,
        fitnessCriteria: args.fitnessCriteria,
        serializedData: args.serializedData,
      });
      return existing._id;
    }

    return await ctx.db.insert('goalGenomes', {
      ...args,
      createdAt: new Date().toISOString(),
      isArchived: false,
    });
  },
});

export const archiveGenome = mutation({
  args: { genomeId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const genome = await ctx.db
      .query('goalGenomes')
      .withIndex('by_genome_id', q => q.eq('genomeId', args.genomeId))
      .first();

    if (!genome) return false;

    await ctx.db.patch(genome._id, { isArchived: true });
    return true;
  },
});

export const getGenome = query({
  args: { genomeId: v.string() },
  returns: v.optional(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('goalGenomes')
      .withIndex('by_genome_id', q => q.eq('genomeId', args.genomeId))
      .first();
  },
});

export const getGenomesByAgent = query({
  args: {
    agentName: v.string(),
    projectId: v.string(),
    limit: v.optional(v.number()),
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let results = await ctx.db
      .query('goalGenomes')
      .withIndex('by_agent', q => q.eq('agentName', args.agentName))
      .filter(q => q.eq(q.field('projectId'), args.projectId))
      .order('desc')
      .take(args.limit ?? 100);

    if (!args.includeArchived) {
      results = results.filter(g => !g.isArchived);
    }

    return results;
  },
});

export const getGenomesByFitness = query({
  args: {
    projectId: v.string(),
    minFitness: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('goalGenomes')
      .withIndex('by_fitness', q => q.gte('fitnessScore', args.minFitness))
      .filter(q => q.eq(q.field('projectId'), args.projectId))
      .filter(q => q.eq(q.field('isArchived'), false))
      .order('desc')
      .take(args.limit ?? 50);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Evolution Session Mutations
// ═══════════════════════════════════════════════════════════════════════════════

export const createEvolutionSession = mutation({
  args: {
    sessionId: v.string(),
    agentName: v.string(),
    projectId: v.string(),
    config: v.string(), // Serialized EvolutionConfig
  },
  returns: v.id('evolutionSessions'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('evolutionSessions', {
      ...args,
      status: 'running',
      currentGeneration: 0,
      populationIds: [],
      fitnessHistory: [],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metrics: {
        outerLoopIterations: 0,
        innerLoopExecutions: 0,
        totalComputeTimeMs: 0,
        peakMemoryBytes: 0,
        candidatesGenerated: 0,
        candidatesRejectedByTaste: 0,
        swarmDebatesRun: 0,
      },
    });
  },
});

export const updateSessionStatus = mutation({
  args: {
    sessionId: v.string(),
    status: v.union(
      v.literal('running'),
      v.literal('paused'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('budget_exceeded')
    ),
    currentGeneration: v.optional(v.number()),
    bestGenomeId: v.optional(v.string()),
    fitnessHistory: v.optional(v.array(v.array(v.number()))),
    metrics: v.optional(v.object({
      outerLoopIterations: v.number(),
      innerLoopExecutions: v.number(),
      totalComputeTimeMs: v.number(),
      peakMemoryBytes: v.number(),
      candidatesGenerated: v.number(),
      candidatesRejectedByTaste: v.number(),
      swarmDebatesRun: v.number(),
    })),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('evolutionSessions')
      .withIndex('by_session_id', q => q.eq('sessionId', args.sessionId))
      .first();

    if (!session) return false;

    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: new Date().toISOString(),
    };

    if (args.currentGeneration !== undefined) {
      updates.currentGeneration = args.currentGeneration;
    }
    if (args.bestGenomeId !== undefined) {
      updates.bestGenomeId = args.bestGenomeId;
    }
    if (args.fitnessHistory !== undefined) {
      updates.fitnessHistory = args.fitnessHistory;
    }
    if (args.metrics !== undefined) {
      updates.metrics = args.metrics;
    }
    if (args.status === 'completed' || args.status === 'failed') {
      updates.completedAt = new Date().toISOString();
    }

    await ctx.db.patch(session._id, updates);
    return true;
  },
});

export const getSession = query({
  args: { sessionId: v.string() },
  returns: v.optional(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('evolutionSessions')
      .withIndex('by_session_id', q => q.eq('sessionId', args.sessionId))
      .first();
  },
});

export const listSessions = query({
  args: {
    projectId: v.optional(v.string()),
    agentName: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal('running'),
      v.literal('paused'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('budget_exceeded')
    )),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let query = ctx.db.query('evolutionSessions');

    if (args.projectId) {
      query = query.withIndex('by_project', q => q.eq('projectId', args.projectId));
    } else if (args.agentName) {
      query = query.withIndex('by_agent', q => q.eq('agentName', args.agentName));
    } else if (args.status) {
      query = query.withIndex('by_status', q => q.eq('status', args.status));
    }

    return await query.order('desc').take(args.limit ?? 100);
  },
});

export const deleteSession = mutation({
  args: { sessionId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('evolutionSessions')
      .withIndex('by_session_id', q => q.eq('sessionId', args.sessionId))
      .first();

    if (!session) return false;

    await ctx.db.delete(session._id);
    return true;
  },
});
