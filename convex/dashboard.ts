// Convex server functions for NOVA26 dashboard
// Provides paginated builds, tasks, and overview statistics

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

// Paginated list of builds sorted by startedAt (most recent first)
// Returns builds with pagination cursors for infinite scroll
export const listBuilds = query({
  args: {
    cursor: v.optional(v.string()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const pageSize = Math.min(args.pageSize ?? 20, 100); // Max 100 per page

    let query_obj = ctx.db
      .query('builds')
      .order('desc');

    // Fetch pageSize + 1 to detect if there are more results
    let builds = await query_obj.take(pageSize + 1);

    const hasMore = builds.length > pageSize;
    if (hasMore) {
      builds = builds.slice(0, pageSize);
    }

    const nextCursor = hasMore && builds.length > 0
      ? builds[builds.length - 1]._id.toString()
      : null;

    return {
      builds,
      nextCursor,
      hasMore,
    };
  },
});

// Get a single build by ID with all its tasks
export const getBuild = query({
  args: {
    buildId: v.id('builds'),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) return null;

    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_build', (q) => q.eq('buildId', args.buildId))
      .collect();

    return {
      build,
      tasks,
    };
  },
});

// Get tasks for a build, sorted by phase then creation order
export const listTasks = query({
  args: {
    buildId: v.id('builds'),
  },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_build', (q) => q.eq('buildId', args.buildId))
      .collect();

    // Sort by phase, then by creation order (implicit sequence)
    return tasks.sort((a, b) => {
      if (a.phase !== b.phase) {
        return a.phase - b.phase;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });
  },
});

// Get overview statistics for the dashboard
export const getOverviewStats = query({
  args: {},
  handler: async (ctx) => {
    const builds = await ctx.db.query('builds').collect();
    const tasks = await ctx.db.query('tasks').collect();
    const agents = await ctx.db.query('agents').collect();

    const totalBuilds = builds.length;
    const completedBuilds = builds.filter((b) => b.status === 'completed').length;
    const failedBuilds = builds.filter((b) => b.status === 'failed').length;
    const successRate =
      totalBuilds > 0 ? (completedBuilds / totalBuilds) * 100 : 0;

    const activeTasks = tasks.filter((t) =>
      ['pending', 'ready', 'running'].includes(t.status)
    ).length;

    const completedTasks = tasks.filter((t) => t.status === 'done').length;

    // Find most recent build completion time
    const completedBuildTimes = builds
      .filter((b) => b.completedAt)
      .map((b) => new Date(b.completedAt!).getTime())
      .sort((a, b) => b - a);

    const lastBuildTime =
      completedBuildTimes.length > 0
        ? new Date(completedBuildTimes[0]).toISOString()
        : null;

    return {
      totalBuilds,
      completedBuilds,
      failedBuilds,
      successRate: Math.round(successRate * 100) / 100, // 2 decimal places
      activeTasks,
      completedTasks,
      lastBuildTime,
      totalAgents: agents.length,
    };
  },
});

// Create a new build
export const createBuild = mutation({
  args: {
    prdId: v.string(),
    prdName: v.string(),
  },
  handler: async (ctx, args) => {
    const buildId = await ctx.db.insert('builds', {
      prdId: args.prdId,
      prdName: args.prdName,
      status: 'running',
      startedAt: new Date().toISOString(),
    });

    return buildId;
  },
});

// Update build status
export const updateBuildStatus = mutation({
  args: {
    buildId: v.id('builds'),
    status: v.union(
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed')
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) throw new Error('Build not found');

    const patch: any = { status: args.status };

    if (args.status === 'completed' || args.status === 'failed') {
      patch.completedAt = new Date().toISOString();
    }

    if (args.error) {
      patch.error = args.error;
    }

    await ctx.db.patch(args.buildId, patch);
    return args.buildId;
  },
});

// Create a task for a build
export const createTask = mutation({
  args: {
    buildId: v.id('builds'),
    taskId: v.string(),
    title: v.string(),
    agent: v.string(),
    phase: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const taskDocId = await ctx.db.insert('tasks', {
      buildId: args.buildId,
      taskId: args.taskId,
      title: args.title,
      agent: args.agent,
      status: 'pending',
      dependencies: [],
      phase: args.phase,
      attempts: 0,
      createdAt: new Date().toISOString(),
    });

    return taskDocId;
  },
});

// Update task status
export const updateTaskStatus = mutation({
  args: {
    taskId: v.id('tasks'),
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
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error('Task not found');

    const patch: any = { status: args.status };

    if (args.output) patch.output = args.output;
    if (args.error) patch.error = args.error;

    await ctx.db.patch(args.taskId, patch);
    return args.taskId;
  },
});

// Log an execution for a task
export const logExecution = mutation({
  args: {
    taskId: v.id('tasks'),
    agent: v.string(),
    model: v.string(),
    prompt: v.string(),
    response: v.string(),
    gatesPassed: v.boolean(),
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    const executionId = await ctx.db.insert('executions', {
      taskId: args.taskId,
      agent: args.agent,
      model: args.model,
      prompt: args.prompt.substring(0, 2000),
      response: args.response.substring(0, 5000),
      gatesPassed: args.gatesPassed,
      duration: args.duration,
      timestamp: new Date().toISOString(),
    });

    return executionId;
  },
});

// Update agent status
export const updateAgentStatus = mutation({
  args: {
    agentId: v.id('agents'),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error('Agent not found');

    if (args.status) {
      await ctx.db.patch(args.agentId, { lastUpdated: new Date().toISOString() });
    }

    return args.agentId;
  },
});
