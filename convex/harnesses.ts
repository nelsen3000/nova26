// Convex mutations and queries for Agent Harnesses
// Spec: .kiro/specs/agent-harnesses/tasks.md

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// ═══════════════════════════════════════════════════════════════════════════════
// Mutations
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new harness record in Convex
 */
export const createHarness = mutation({
  args: {
    harnessId: v.string(),
    agentName: v.string(),
    parentHarnessId: v.optional(v.string()),
    checkpointData: v.optional(v.string()),
  },
  returns: v.id('agentHarnesses'),
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    
    const harnessId = await ctx.db.insert('agentHarnesses', {
      harnessId: args.harnessId,
      agentName: args.agentName,
      status: 'created',
      parentHarnessId: args.parentHarnessId,
      checkpointData: args.checkpointData,
      progressPercent: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Log creation event
    await ctx.db.insert('harnessEvents', {
      harnessId: args.harnessId,
      eventType: 'state_transition',
      details: JSON.stringify({ from: null, to: 'created' }),
      timestamp: now,
    });

    return harnessId;
  },
});

/**
 * Update harness status
 */
export const updateHarnessStatus = mutation({
  args: {
    harnessId: v.string(),
    status: v.union(
      v.literal('created'),
      v.literal('running'),
      v.literal('paused'),
      v.literal('completed'),
      v.literal('failed')
    ),
    currentStepId: v.optional(v.string()),
    checkpointData: v.optional(v.string()),
    progressPercent: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const harness = await ctx.db
      .query('agentHarnesses')
      .withIndex('by_harness_id', (q) => q.eq('harnessId', args.harnessId))
      .first();

    if (!harness) {
      return false;
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };

    if (args.currentStepId !== undefined) {
      updates.currentStepId = args.currentStepId;
    }
    if (args.checkpointData !== undefined) {
      updates.checkpointData = args.checkpointData;
    }
    if (args.progressPercent !== undefined) {
      updates.progressPercent = args.progressPercent;
    }
    if (args.errorMessage !== undefined) {
      updates.errorMessage = args.errorMessage;
    }
    if (args.status === 'completed' || args.status === 'failed') {
      updates.completedAt = now;
    }

    await ctx.db.patch(harness._id, updates);

    // Log state transition event
    await ctx.db.insert('harnessEvents', {
      harnessId: args.harnessId,
      eventType: 'state_transition',
      details: JSON.stringify({
        from: harness.status,
        to: args.status,
        stepId: args.currentStepId,
      }),
      timestamp: now,
    });

    return true;
  },
});

/**
 * Log a harness event
 */
export const logHarnessEvent = mutation({
  args: {
    harnessId: v.string(),
    eventType: v.union(
      v.literal('state_transition'),
      v.literal('tool_call'),
      v.literal('human_gate'),
      v.literal('sub_agent_spawned'),
      v.literal('sub_agent_completed'),
      v.literal('checkpoint_created'),
      v.literal('step_completed'),
      v.literal('step_failed'),
      v.literal('plan_completed')
    ),
    stepId: v.optional(v.string()),
    details: v.string(),
  },
  returns: v.id('harnessEvents'),
  handler: async (ctx, args) => {
    const eventId = await ctx.db.insert('harnessEvents', {
      harnessId: args.harnessId,
      eventType: args.eventType,
      stepId: args.stepId,
      details: args.details,
      timestamp: new Date().toISOString(),
    });

    return eventId;
  },
});

/**
 * Delete a harness and its events
 */
export const deleteHarness = mutation({
  args: {
    harnessId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const harness = await ctx.db
      .query('agentHarnesses')
      .withIndex('by_harness_id', (q) => q.eq('harnessId', args.harnessId))
      .first();

    if (!harness) {
      return false;
    }

    // Delete associated events
    const events = await ctx.db
      .query('harnessEvents')
      .withIndex('by_harness', (q) => q.eq('harnessId', args.harnessId))
      .collect();

    for (const event of events) {
      await ctx.db.delete(event._id);
    }

    // Delete harness
    await ctx.db.delete(harness._id);

    return true;
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get a harness by its ID
 */
export const getHarness = query({
  args: {
    harnessId: v.string(),
  },
  returns: v.optional(
    v.object({
      _id: v.id('agentHarnesses'),
      _creationTime: v.number(),
      harnessId: v.string(),
      agentName: v.string(),
      status: v.union(
        v.literal('created'),
        v.literal('running'),
        v.literal('paused'),
        v.literal('completed'),
        v.literal('failed')
      ),
      parentHarnessId: v.optional(v.string()),
      currentStepId: v.optional(v.string()),
      checkpointData: v.optional(v.string()),
      progressPercent: v.number(),
      createdAt: v.string(),
      updatedAt: v.string(),
      completedAt: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('agentHarnesses')
      .withIndex('by_harness_id', (q) => q.eq('harnessId', args.harnessId))
      .first();
  },
});

/**
 * List all harnesses with optional filtering
 */
export const listHarnesses = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('created'),
        v.literal('running'),
        v.literal('paused'),
        v.literal('completed'),
        v.literal('failed')
      )
    ),
    agentName: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id('agentHarnesses'),
      _creationTime: v.number(),
      harnessId: v.string(),
      agentName: v.string(),
      status: v.union(
        v.literal('created'),
        v.literal('running'),
        v.literal('paused'),
        v.literal('completed'),
        v.literal('failed')
      ),
      parentHarnessId: v.optional(v.string()),
      currentStepId: v.optional(v.string()),
      checkpointData: v.optional(v.string()),
      progressPercent: v.number(),
      createdAt: v.string(),
      updatedAt: v.string(),
      completedAt: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    let query = ctx.db.query('agentHarnesses');

    if (args.status) {
      query = query.withIndex('by_status', (q) => q.eq('status', args.status));
    } else if (args.agentName) {
      query = query.withIndex('by_agent', (q) => q.eq('agentName', args.agentName));
    }

    const results = await query.order('desc').take(args.limit ?? 100);
    return results;
  },
});

/**
 * Get events for a harness
 */
export const getHarnessEvents = query({
  args: {
    harnessId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id('harnessEvents'),
      _creationTime: v.number(),
      harnessId: v.string(),
      eventType: v.union(
        v.literal('state_transition'),
        v.literal('tool_call'),
        v.literal('human_gate'),
        v.literal('sub_agent_spawned'),
        v.literal('sub_agent_completed'),
        v.literal('checkpoint_created'),
        v.literal('step_completed'),
        v.literal('step_failed'),
        v.literal('plan_completed')
      ),
      stepId: v.optional(v.string()),
      details: v.string(),
      timestamp: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('harnessEvents')
      .withIndex('by_harness_and_time', (q) => q.eq('harnessId', args.harnessId))
      .order('desc')
      .take(args.limit ?? 100);
  },
});

/**
 * Get child harnesses for a parent
 */
export const getChildHarnesses = query({
  args: {
    parentHarnessId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id('agentHarnesses'),
      _creationTime: v.number(),
      harnessId: v.string(),
      agentName: v.string(),
      status: v.union(
        v.literal('created'),
        v.literal('running'),
        v.literal('paused'),
        v.literal('completed'),
        v.literal('failed')
      ),
      parentHarnessId: v.optional(v.string()),
      currentStepId: v.optional(v.string()),
      progressPercent: v.number(),
      createdAt: v.string(),
      updatedAt: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('agentHarnesses')
      .withIndex('by_parent', (q) => q.eq('parentHarnessId', args.parentHarnessId))
      .collect();
  },
});
