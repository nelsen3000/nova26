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

// Internal helper to log activity
async function logActivityInternal(
  ctx: any,
  agentName: string,
  action: string,
  details: string,
  taskId?: string
) {
  try {
    await ctx.db.insert('agentActivityFeed', {
      userId: 'system',
      agentName,
      eventType: action as any,
      taskId,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Log errors but don't throw
    console.error('Failed to log activity:', error);
  }
}

// Create a new build
export const createBuild = mutation({
  args: {
    prdId: v.string(),
    prdName: v.string(),
    config: v.optional(v.object({
      timeout: v.optional(v.number()),
      retries: v.optional(v.number()),
      parallelism: v.optional(v.number()),
    })),
    agentIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const buildId = await ctx.db.insert('builds', {
      prdId: args.prdId,
      prdName: args.prdName,
      status: 'pending',
      startedAt: now,
    });

    // Log activity
    await logActivityInternal(
      ctx,
      'ATLAS',
      'task_started',
      `Created new build: ${args.prdName}`,
      undefined
    );

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

    // Log activity
    const action =
      args.status === 'completed'
        ? 'task_completed'
        : args.status === 'failed'
          ? 'task_failed'
          : 'task_started';

    const details = args.error
      ? `Build ${args.status}: ${args.error}`
      : `Build ${args.status}`;

    await logActivityInternal(ctx, 'ATLAS', action, details);

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
    agentId: v.optional(v.id('agents')),
    phase: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate build exists
    const build = await ctx.db.get(args.buildId);
    if (!build) throw new Error('Build not found');

    // Validate phase is positive
    if (args.phase < 1) throw new Error('Phase must be >= 1');

    // Validate task ID uniqueness (within build)
    const existingTask = await ctx.db
      .query('tasks')
      .withIndex('by_build', (q) => q.eq('buildId', args.buildId))
      .filter((q) => q.eq(q.field('taskId'), args.taskId))
      .first();

    if (existingTask) throw new Error('Task with this ID already exists in build');

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

    // Log activity
    await logActivityInternal(
      ctx,
      args.agent,
      'task_started',
      `Created task: ${args.title}`,
      args.taskId
    );

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

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      'pending': ['ready', 'running', 'blocked', 'failed'],
      'ready': ['running', 'failed', 'blocked'],
      'running': ['done', 'failed'],
      'done': [],
      'failed': [],
      'blocked': ['pending', 'ready', 'failed'],
    };

    if (!validTransitions[task.status]?.includes(args.status)) {
      throw new Error(
        `Invalid status transition from ${task.status} to ${args.status}`
      );
    }

    const patch: any = { status: args.status };

    if (args.output) patch.output = args.output;
    if (args.error) patch.error = args.error;

    await ctx.db.patch(args.taskId, patch);

    // Log activity
    const action =
      args.status === 'done'
        ? 'task_completed'
        : args.status === 'failed'
          ? 'task_failed'
          : 'task_started';

    const details = args.error
      ? `Task ${args.status}: ${args.error}`
      : `Task ${args.status}`;

    await logActivityInternal(
      ctx,
      task.agent,
      action,
      details,
      task.taskId
    );

    return args.taskId;
  },
});

// Log an execution for a task
export const logExecution = mutation({
  args: {
    taskId: v.id('tasks'),
    agent: v.string(),
    agentId: v.optional(v.id('agents')),
    model: v.string(),
    prompt: v.string(),
    response: v.string(),
    gatesPassed: v.boolean(),
    duration: v.number(),
    input: v.optional(v.string()),
    output: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate task exists
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error('Task not found');

    // Validate duration is non-negative
    if (args.duration < 0) throw new Error('Duration must be >= 0');

    const executionId = await ctx.db.insert('executions', {
      taskId: args.taskId,
      agent: args.agent,
      model: args.model,
      prompt: args.prompt.substring(0, 2000),
      response: args.response.substring(0, 5000),
      gatesPassed: args.gatesPassed,
      duration: args.duration,
      timestamp: new Date().toISOString(),
      error: args.error,
    });

    // Log activity based on gates passed
    const action = args.gatesPassed ? 'task_completed' : 'task_failed';
    const details = `Execution ${args.gatesPassed ? 'passed' : 'failed'} gates (${args.duration}ms)`;

    await logActivityInternal(
      ctx,
      args.agent,
      action,
      details,
      task.taskId
    );

    return executionId;
  },
});

// Update agent status
export const updateAgentStatus = mutation({
  args: {
    agentId: v.id('agents'),
    status: v.optional(
      v.union(v.literal('active'), v.literal('idle'), v.literal('suspended'))
    ),
    currentTask: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error('Agent not found');

    const patch: any = {};

    if (args.status) {
      patch.status = args.status;
    }

    if (args.currentTask !== undefined) {
      patch.currentTask = args.currentTask;
    }

    if (Object.keys(patch).length > 0) {
      patch.lastUpdated = new Date().toISOString();
      await ctx.db.patch(args.agentId, patch);
    }

    return args.agentId;
  },
});

// Get statistics for all agents
// Aggregates task data and execution metrics per agent
export const getAgentStats = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query('agents').collect();
    const tasks = await ctx.db.query('tasks').collect();
    const executions = await ctx.db.query('executions').collect();

    const stats = agents.map((agent) => {
      // Find all tasks assigned to this agent
      const agentTasks = tasks.filter((t) => t.agent === agent.name);
      const completedTasks = agentTasks.filter((t) => t.status === 'done').length;
      const failedTasks = agentTasks.filter((t) => t.status === 'failed').length;

      // Calculate success rate
      const totalTasks = agentTasks.length;
      const successRate =
        totalTasks > 0
          ? Math.round((completedTasks / totalTasks) * 100 * 100) / 100
          : 0;

      // Get executions for this agent
      const agentExecutions = executions.filter((e) => e.agent === agent.name);
      const avgDuration =
        agentExecutions.length > 0
          ? Math.round(
              agentExecutions.reduce((sum, e) => sum + e.duration, 0) /
                agentExecutions.length
            )
          : 0;

      // Find last activity time
      const lastExecution = agentExecutions.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];
      const lastActive = lastExecution
        ? lastExecution.timestamp
        : agent.createdAt;

      // Determine current status
      const currentStatus = agentTasks.some((t) => t.status === 'running')
        ? 'active'
        : 'idle';

      return {
        agentId: agent._id,
        name: agent.name,
        role: agent.role,
        totalTasks,
        successRate,
        avgDuration,
        lastActive,
        currentStatus,
        completedTasks,
        failedTasks,
      };
    });

    // Sort by most recently active
    return stats.sort((a, b) =>
      new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
    );
  },
});
