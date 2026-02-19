// Convex server functions for NOVA26 Agent Activity Feed
// Tracks agent events per user for audit and monitoring

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

// =====================
// Mutations
// =====================

// Record an agent activity event
// Insert into agentActivityFeed
export const recordAgentActivity = mutation({
  args: {
    userId: v.string(),
    agentName: v.string(),
    eventType: v.union(
      v.literal('task_started'),
      v.literal('task_completed'),
      v.literal('task_failed'),
      v.literal('playbook_updated'),
      v.literal('wisdom_promoted'),
      v.literal('rehearsal_ran')
    ),
    taskId: v.optional(v.string()),
    details: v.string(),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    const activityId = await ctx.db.insert('agentActivityFeed', {
      userId: args.userId,
      agentName: args.agentName,
      eventType: args.eventType,
      taskId: args.taskId,
      details: args.details,
      timestamp,
    });

    return { activityId: activityId.toString(), timestamp };
  },
});

// =====================
// Queries
// =====================

// Get agent activity for a user
// Returns activity ordered by timestamp desc
export const getAgentActivity = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const activities = await ctx.db
      .query('agentActivityFeed')
      .withIndex('by_user_and_time', (q) => q.eq('userId', args.userId))
      .order('desc')
      .take(args.limit ?? 50);

    return activities;
  },
});

// Get agent activity for a user filtered by agent name
// Returns activity for specific agent ordered by timestamp desc
export const getAgentActivityByAgent = query({
  args: {
    userId: v.string(),
    agentName: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const activities = await ctx.db
      .query('agentActivityFeed')
      .withIndex('by_user_and_agent', (q) => 
        q.eq('userId', args.userId).eq('agentName', args.agentName)
      )
      .order('desc')
      .take(args.limit ?? 50);

    return activities;
  },
});
