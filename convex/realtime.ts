// Convex server functions for real-time activity and build subscriptions
// Provides activity feed, running build status, and activity logging

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

// Subscribe to latest activity feed items
// Returns most recent 50 activities sorted by timestamp descending
export const subscribeToActivity = query({
  args: {},
  handler: async (ctx) => {
    const activities = await ctx.db
      .query('agentActivityFeed')
      .order('desc')
      .take(50);

    return activities;
  },
});

// Subscribe to all running and pending builds
// Useful for dashboard showing current work in progress
export const subscribeToBuilds = query({
  args: {},
  handler: async (ctx) => {
    const runningBuilds = await ctx.db
      .query('builds')
      .withIndex('by_status', (q) => q.eq('status', 'running'))
      .collect();

    const pendingBuilds = await ctx.db
      .query('builds')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .collect();

    // Combine and sort by startedAt descending
    const allBuilds = [...runningBuilds, ...pendingBuilds].sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    return allBuilds;
  },
});

// Log an activity event to the activity feed
// Called when tasks start, complete, fail, etc.
export const logActivity = mutation({
  args: {
    agentName: v.string(),
    action: v.string(),
    details: v.string(),
    status: v.optional(v.string()),
    taskId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    const activityId = await ctx.db.insert('agentActivityFeed', {
      userId: 'system', // Internal logging, no specific user
      agentName: args.agentName,
      eventType: args.action as any, // Would be: task_started | task_completed | task_failed | etc
      taskId: args.taskId,
      details: args.details,
      timestamp,
    });

    return activityId;
  },
});

// Get activity history for a specific agent
export const getAgentActivityHistory = query({
  args: {
    agentName: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    const activities = await ctx.db
      .query('agentActivityFeed')
      .withIndex('by_user_and_agent', (q) =>
        q.eq('userId', 'system').eq('agentName', args.agentName)
      )
      .order('desc')
      .take(limit);

    return activities;
  },
});

// Get activity timeline for a specific build
// Useful for build detail pages
export const getBuildActivityTimeline = query({
  args: {
    buildId: v.id('builds'),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) return [];

    // Find all tasks for this build
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_build', (q) => q.eq('buildId', args.buildId))
      .collect();

    // Collect activity for each task
    const timeline = tasks
      .map((task) => ({
        taskId: task._id,
        taskTitle: task.title,
        agent: task.agent,
        status: task.status,
        createdAt: task.createdAt,
        phase: task.phase,
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return timeline;
  },
});

// Get recent activity across all agents
export const getRecentActivity = query({
  args: {
    limit: v.optional(v.number()),
    hours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const hours = args.hours ?? 24;

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hours);

    const activities = await ctx.db
      .query('agentActivityFeed')
      .order('desc')
      .filter((q) => q.gte(q.field('timestamp'), cutoffTime.toISOString()))
      .take(limit);

    return activities;
  },
});
