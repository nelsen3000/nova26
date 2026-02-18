// ATLAS Convex Functions
// Mutations and queries for the 6 ATLAS meta-learner tables:
// builds, patterns, agents, tasks, executions, learnings

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// =====================
// BUILDS
// =====================

export const startBuild = mutation({
  args: {
    prdId: v.string(),
    prdName: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('builds', {
      prdId: args.prdId,
      prdName: args.prdName,
      status: 'running',
      startedAt: new Date().toISOString(),
    });
  },
});

export const completeBuild = mutation({
  args: {
    buildId: v.id('builds'),
    status: v.union(v.literal('completed'), v.literal('failed')),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.buildId, {
      status: args.status,
      completedAt: new Date().toISOString(),
      error: args.error,
    });
  },
});

export const getBuild = query({
  args: { buildId: v.id('builds') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.buildId);
  },
});

export const listBuilds = query({
  args: {
    status: v.optional(v.union(v.literal('running'), v.literal('completed'), v.literal('failed'))),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query('builds')
        .withIndex('by_status', q => q.eq('status', args.status!))
        .order('desc')
        .collect();
    }
    return await ctx.db.query('builds').order('desc').collect();
  },
});

// =====================
// ATLAS TASKS
// =====================

export const logTask = mutation({
  args: {
    buildId: v.id('builds'),
    taskId: v.string(),
    title: v.string(),
    agent: v.string(),
    dependencies: v.array(v.string()),
    phase: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('tasks', {
      buildId: args.buildId,
      taskId: args.taskId,
      title: args.title,
      agent: args.agent,
      status: 'pending',
      dependencies: args.dependencies,
      phase: args.phase,
      attempts: 0,
      createdAt: new Date().toISOString(),
    });
  },
});

export const updateTaskStatus = mutation({
  args: {
    convexTaskId: v.id('tasks'),
    status: v.union(
      v.literal('pending'),
      v.literal('ready'),
      v.literal('running'),
      v.literal('done'),
      v.literal('failed'),
      v.literal('blocked')
    ),
    output: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { status: args.status };
    if (args.output !== undefined) patch.output = args.output;
    if (args.error !== undefined) patch.error = args.error;
    await ctx.db.patch(args.convexTaskId, patch);
  },
});

export const incrementTaskAttempts = mutation({
  args: { convexTaskId: v.id('tasks') },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.convexTaskId);
    if (!task) return;
    await ctx.db.patch(args.convexTaskId, { attempts: task.attempts + 1 });
  },
});

export const getTasksByBuild = query({
  args: { buildId: v.id('builds') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('tasks')
      .withIndex('by_build', q => q.eq('buildId', args.buildId))
      .collect();
  },
});

// =====================
// EXECUTIONS
// =====================

export const logExecution = mutation({
  args: {
    taskId: v.id('tasks'),
    agent: v.string(),
    model: v.string(),
    prompt: v.string(),
    response: v.string(),
    gatesPassed: v.boolean(),
    duration: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('executions', {
      taskId: args.taskId,
      agent: args.agent,
      model: args.model,
      prompt: args.prompt,
      response: args.response,
      gatesPassed: args.gatesPassed,
      duration: args.duration,
      timestamp: new Date().toISOString(),
      error: args.error,
    });
  },
});

export const getExecutionsByTask = query({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('executions')
      .withIndex('by_task', q => q.eq('taskId', args.taskId))
      .order('desc')
      .collect();
  },
});

// =====================
// PATTERNS
// =====================

export const savePattern = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    code: v.string(),
    language: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('patterns', {
      name: args.name,
      description: args.description,
      code: args.code,
      language: args.language,
      tags: args.tags,
      createdAt: new Date().toISOString(),
    });
  },
});

export const getPatternsByLanguage = query({
  args: { language: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('patterns')
      .withIndex('by_language', q => q.eq('language', args.language))
      .collect();
  },
});

export const listPatterns = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('patterns').order('desc').collect();
  },
});

// =====================
// ATLAS AGENTS (orchestrator agent registry)
// =====================

export const upsertAgent = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    domain: v.string(),
    systemPrompt: v.string(),
    model: v.string(),
    gates: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if agent already exists
    const existing = await ctx.db
      .query('agents')
      .withIndex('by_name', q => q.eq('name', args.name))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        domain: args.domain,
        systemPrompt: args.systemPrompt,
        model: args.model,
        gates: args.gates,
      });
      return existing._id;
    }

    return await ctx.db.insert('agents', {
      name: args.name,
      role: args.role,
      domain: args.domain,
      systemPrompt: args.systemPrompt,
      model: args.model,
      gates: args.gates,
      createdAt: new Date().toISOString(),
    });
  },
});

export const getAgentByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('agents')
      .withIndex('by_name', q => q.eq('name', args.name))
      .first();
  },
});

export const listAgents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('agents').collect();
  },
});

// =====================
// LEARNINGS
// =====================

export const logLearning = mutation({
  args: {
    buildId: v.id('builds'),
    taskId: v.string(),
    pattern: v.string(),
    insight: v.string(),
    code: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('learnings', {
      buildId: args.buildId,
      taskId: args.taskId,
      pattern: args.pattern,
      insight: args.insight,
      code: args.code,
      createdAt: new Date().toISOString(),
    });
  },
});

export const getLearningsByBuild = query({
  args: { buildId: v.id('builds') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('learnings')
      .withIndex('by_build', q => q.eq('buildId', args.buildId))
      .collect();
  },
});

export const getLearningsByTask = query({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('learnings')
      .withIndex('by_task', q => q.eq('taskId', args.taskId))
      .collect();
  },
});

export const listRecentLearnings = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query('learnings')
      .order('desc')
      .take(limit);
  },
});
