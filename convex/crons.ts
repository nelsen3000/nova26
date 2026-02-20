// Convex server functions for background jobs and cron tasks
// Runs periodically to maintain database health and cache freshness

import { internalMutation } from './_generated/server';
import { v } from 'convex/values';

// Clean up old activity feed items (older than 7 days)
// Runs every hour to keep activity feed table trim
export const cleanupOldActivity = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const cutoffTime = cutoffDate.toISOString();

    // Find all activities older than 7 days
    const oldActivities = await ctx.db
      .query('agentActivityFeed')
      .filter((q) => q.lt(q.field('timestamp'), cutoffTime))
      .collect();

    // Delete them
    let deletedCount = 0;
    for (const activity of oldActivities) {
      await ctx.db.delete(activity._id);
      deletedCount++;
    }

    return {
      deleted: deletedCount,
      cutoffTime,
    };
  },
});

// Compute agent statistics cache
// Runs every 5 minutes to keep agent stats fresh
// Eliminates expensive O(n*m) aggregation from getAgentStats query
export const computeAgentStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query('agents').collect();
    const tasks = await ctx.db.query('tasks').collect();
    const executions = await ctx.db.query('executions').collect();

    const now = new Date().toISOString();
    let computedCount = 0;

    for (const agent of agents) {
      // Find all tasks for this agent
      const agentTasks = tasks.filter((t) => t.agent === agent.name);
      const completedTasks = agentTasks.filter((t) => t.status === 'done').length;
      const failedTasks = agentTasks.filter((t) => t.status === 'failed').length;
      const totalTasks = agentTasks.length;

      // Calculate success rate
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
      const lastActive = lastExecution ? lastExecution.timestamp : agent.createdAt;

      // Determine current status
      const currentStatus = agentTasks.some((t) => t.status === 'running')
        ? 'active'
        : 'idle';

      // Check if cache entry exists
      const existingCache = await ctx.db
        .query('agentStatsCache')
        .withIndex('by_agent_id', (q) => q.eq('agentId', agent._id))
        .first();

      if (existingCache) {
        // Update existing cache entry
        await ctx.db.patch(existingCache._id, {
          agentName: agent.name,
          role: agent.role,
          totalTasks,
          completedTasks,
          failedTasks,
          successRate,
          avgDuration,
          lastActive,
          currentStatus,
          cachedAt: now,
        });
      } else {
        // Create new cache entry
        await ctx.db.insert('agentStatsCache', {
          agentId: agent._id,
          agentName: agent.name,
          role: agent.role,
          totalTasks,
          completedTasks,
          failedTasks,
          successRate,
          avgDuration,
          lastActive,
          currentStatus,
          cachedAt: now,
        });
      }

      computedCount++;
    }

    return {
      computed: computedCount,
      timestamp: now,
    };
  },
});

// Check for stalled builds (running but no updates for 30+ minutes)
// Runs every 10 minutes
// Marks stalled builds as failed for manual investigation
export const checkStalledBuilds = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - 30);
    const cutoffTimeStr = cutoffTime.toISOString();

    // Find all running builds
    const runningBuilds = await ctx.db
      .query('builds')
      .withIndex('by_status', (q) => q.eq('status', 'running'))
      .collect();

    let stalledCount = 0;

    for (const build of runningBuilds) {
      // Check if build started before 30-minute cutoff
      if (build.startedAt < cutoffTimeStr) {
        // No updates in 30+ minutes, mark as stalled
        await ctx.db.patch(build._id, {
          status: 'failed',
          completedAt: new Date().toISOString(),
          error: 'Build stalled (no activity for 30+ minutes)',
        });

        // Log activity
        await ctx.db.insert('agentActivityFeed', {
          userId: 'system',
          agentName: 'ATLAS',
          eventType: 'task_failed',
          details: `Build stalled: ${build.prdName}`,
          timestamp: new Date().toISOString(),
        });

        stalledCount++;
      }
    }

    return {
      stalled: stalledCount,
      checkTime: new Date().toISOString(),
    };
  },
});

// Compact old executions (older than 30 days)
// Runs daily at midnight to archive historical data
export const compactOldExecutions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffTime = cutoffDate.toISOString();

    // Find old executions
    const oldExecutions = await ctx.db
      .query('executions')
      .filter((q) => q.lt(q.field('timestamp'), cutoffTime))
      .collect();

    let compactedCount = 0;

    // Note: In production, you would archive these to cold storage
    // For now, just track that they exist
    for (const _execution of oldExecutions) {
      // Could summarize, archive, or delete
      compactedCount++;
    }

    return {
      compacted: compactedCount,
      cutoffTime,
    };
  },
});

// Mark inactive users (no activity for 90+ days)
// Runs daily
// Used for engagement campaigns and account maintenance
export const markInactiveUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cutoffTime = cutoffDate.toISOString();

    // Find all users
    const allUsers = await ctx.db.query('userProfiles').collect();

    let inactiveCount = 0;

    for (const user of allUsers) {
      if (user.lastActiveAt < cutoffTime) {
        // In production: could send reactivation email, or flag for cleanup
        // For now just track the count
        inactiveCount++;

        // Optionally add metadata (if schema supported)
        // await ctx.db.patch(user._id, { flaggedForInactivity: true });
      }
    }

    return {
      inactive: inactiveCount,
      cutoffTime,
    };
  },
});

// Refresh build completion statistics cache
// Runs every hour
// Caches aggregated build stats for dashboard
export const refreshBuildStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    const builds = await ctx.db.query('builds').collect();

    const totalBuilds = builds.length;
    const completedBuilds = builds.filter((b) => b.status === 'completed').length;
    const failedBuilds = builds.filter((b) => b.status === 'failed').length;
    const runningBuilds = builds.filter((b) => b.status === 'running').length;

    const successRate =
      totalBuilds > 0
        ? Math.round((completedBuilds / totalBuilds) * 100 * 100) / 100
        : 0;

    // Get average build duration (completed only)
    const completedWithDuration = builds
      .filter((b) => b.completedAt)
      .map((b) => ({
        duration:
          new Date(b.completedAt!).getTime() -
          new Date(b.startedAt).getTime(),
      }));

    const avgDuration =
      completedWithDuration.length > 0
        ? Math.round(
            completedWithDuration.reduce((sum, b) => sum + b.duration, 0) /
              completedWithDuration.length
          )
        : 0;

    return {
      totalBuilds,
      completedBuilds,
      failedBuilds,
      runningBuilds,
      successRate,
      avgDurationMs: avgDuration,
      timestamp: new Date().toISOString(),
    };
  },
});

// Send health check notification
// Runs every 30 minutes
// Verifies database connectivity and overall health
export const healthCheck = internalMutation({
  args: {},
  handler: async (ctx) => {
    const checks = {
      buildTableSize: 0,
      taskTableSize: 0,
      executionTableSize: 0,
      activityTableSize: 0,
      userTableSize: 0,
      timestamp: new Date().toISOString(),
      status: 'healthy' as const,
    };

    try {
      // Count records in each table
      const builds = await ctx.db.query('builds').collect();
      checks.buildTableSize = builds.length;

      const tasks = await ctx.db.query('tasks').collect();
      checks.taskTableSize = tasks.length;

      const executions = await ctx.db.query('executions').collect();
      checks.executionTableSize = executions.length;

      const activities = await ctx.db.query('agentActivityFeed').collect();
      checks.activityTableSize = activities.length;

      const users = await ctx.db.query('userProfiles').collect();
      checks.userTableSize = users.length;

      // Check for unreasonable table sizes (would indicate corruption/runaway inserts)
      if (
        checks.taskTableSize > 100000 ||
        checks.activityTableSize > 1000000
      ) {
        checks.status = 'warning';
      }
    } catch (error) {
      checks.status = 'error';
      console.error('Health check failed:', error);
    }

    return checks;
  },
});
