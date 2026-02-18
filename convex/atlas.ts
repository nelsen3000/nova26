// Convex server functions for ATLAS triple-write
// These mutations handle the builds → tasks → executions chain

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

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
    prompt: v.string(),
    response: v.string(),
    gatesPassed: v.boolean(),
    duration: v.number(),
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
    taskId: v.string(),
    pattern: v.string(),
    insight: v.string(),
    code: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
  },
});
