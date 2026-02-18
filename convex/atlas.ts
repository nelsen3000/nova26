<<<<<<< HEAD
// ATLAS Convex Functions
// Mutations and queries for the 6 ATLAS meta-learner tables:
// builds, patterns, agents, tasks, executions, learnings
=======
// Convex server functions for ATLAS triple-write
// These mutations handle the builds → tasks → executions chain
>>>>>>> origin/claude/setup-claude-code-cli-xRTjx

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

<<<<<<< HEAD
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
=======
// Log a build execution (combines build + task + execution in one call)
export const logExecution = mutation({
  args: {
    prdId: v.string(),
    prdName: v.string(),
    taskId: v.string(),
    taskTitle: v.string(),
    agent: v.string(),
    model: v.string(),
    phase: v.number(),
>>>>>>> origin/claude/setup-claude-code-cli-xRTjx
    prompt: v.string(),
    response: v.string(),
    gatesPassed: v.boolean(),
    duration: v.number(),
<<<<<<< HEAD
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
=======
    timestamp: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Find or create the build record
    let build = await ctx.db
      .query('builds')
      .withIndex('by_prd', (q) => q.eq('prdId', args.prdId))
      .first();

    if (!build) {
      const buildId = await ctx.db.insert('builds', {
        prdId: args.prdId,
        prdName: args.prdName,
        status: 'running',
        startedAt: args.timestamp,
      });
      build = await ctx.db.get(buildId);
    }

    // 2. Find or create the task record
    let task = await ctx.db
      .query('tasks')
      .withIndex('by_build', (q) => q.eq('buildId', build!._id))
      .filter((q) => q.eq(q.field('taskId'), args.taskId))
      .first();

    if (!task) {
      const taskDocId = await ctx.db.insert('tasks', {
        buildId: build!._id,
        taskId: args.taskId,
        title: args.taskTitle,
        agent: args.agent,
        status: args.gatesPassed ? 'done' : 'failed',
        dependencies: [],
        phase: args.phase,
        attempts: 1,
        createdAt: args.timestamp,
        output: args.gatesPassed ? args.response.substring(0, 500) : undefined,
        error: args.error,
      });
      task = await ctx.db.get(taskDocId);
    } else {
      // Update existing task
      await ctx.db.patch(task._id, {
        status: args.gatesPassed ? 'done' : 'failed',
        attempts: task.attempts + 1,
        output: args.gatesPassed ? args.response.substring(0, 500) : undefined,
        error: args.error,
      });
    }

    // 3. Insert the execution record
    await ctx.db.insert('executions', {
      taskId: task!._id,
      agent: args.agent,
      model: args.model,
      prompt: args.prompt.substring(0, 2000),
      response: args.response.substring(0, 5000),
      gatesPassed: args.gatesPassed,
      duration: args.duration,
      timestamp: args.timestamp,
      error: args.error,
    });

    return { buildId: build!._id, taskId: task!._id };
  },
});

// Mark a build as completed or failed
export const completeBuild = mutation({
  args: {
    prdId: v.string(),
    status: v.union(v.literal('completed'), v.literal('failed')),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db
      .query('builds')
      .withIndex('by_prd', (q) => q.eq('prdId', args.prdId))
      .first();

    if (build) {
      await ctx.db.patch(build._id, {
        status: args.status,
        completedAt: new Date().toISOString(),
        error: args.error,
      });
    }
  },
});

// Log a learning/pattern from a retrospective
export const logLearning = mutation({
  args: {
    prdId: v.string(),
>>>>>>> origin/claude/setup-claude-code-cli-xRTjx
    taskId: v.string(),
    pattern: v.string(),
    insight: v.string(),
    code: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
<<<<<<< HEAD
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
=======
    const build = await ctx.db
      .query('builds')
      .withIndex('by_prd', (q) => q.eq('prdId', args.prdId))
      .first();

    if (build) {
      await ctx.db.insert('learnings', {
        buildId: build._id,
        taskId: args.taskId,
        pattern: args.pattern,
        insight: args.insight,
        code: args.code,
        createdAt: new Date().toISOString(),
      });
    }
  },
});

// Query recent executions for an agent
export const getAgentExecutions = query({
  args: {
    agent: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const executions = await ctx.db
      .query('executions')
      .withIndex('by_timestamp')
      .order('desc')
      .filter((q) => q.eq(q.field('agent'), args.agent))
      .take(args.limit ?? 10);

    return executions;
  },
});

// Query build status
export const getBuildStatus = query({
  args: { prdId: v.string() },
  handler: async (ctx, args) => {
    const build = await ctx.db
      .query('builds')
      .withIndex('by_prd', (q) => q.eq('prdId', args.prdId))
      .first();

    if (!build) return null;

    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_build', (q) => q.eq('buildId', build._id))
      .collect();

    return {
      build,
      tasks,
      summary: {
        total: tasks.length,
        done: tasks.filter((t) => t.status === 'done').length,
        failed: tasks.filter((t) => t.status === 'failed').length,
        pending: tasks.filter((t) => t.status === 'pending' || t.status === 'ready').length,
      },
    };
  },
});

// Query all learnings for a project
export const getLearnings = query({
  args: { prdId: v.string() },
  handler: async (ctx, args) => {
    const build = await ctx.db
      .query('builds')
      .withIndex('by_prd', (q) => q.eq('prdId', args.prdId))
      .first();

    if (!build) return [];

    return ctx.db
      .query('learnings')
      .withIndex('by_build', (q) => q.eq('buildId', build._id))
      .collect();
>>>>>>> origin/claude/setup-claude-code-cli-xRTjx
  },
});
