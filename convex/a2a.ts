// Convex mutations and queries for A2A/MCP Protocols
// Spec: .kiro/specs/a2a-mcp-protocols/design.md

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// ═══════════════════════════════════════════════════════════════════════════════
// Agent Card Mutations
// ═══════════════════════════════════════════════════════════════════════════════

export const registerAgentCard = mutation({
  args: {
    cardId: v.string(),
    agentId: v.string(),
    name: v.string(),
    description: v.string(),
    tier: v.union(v.literal('L0'), v.literal('L1'), v.literal('L2'), v.literal('L3')),
    capabilities: v.array(v.object({
      skill: v.string(),
      description: v.string(),
      inputSchema: v.optional(v.record(v.string(), v.any())),
      outputSchema: v.optional(v.record(v.string(), v.any())),
    })),
    endpoints: v.array(v.object({
      protocol: v.union(v.literal('a2a'), v.literal('mcp')),
      url: v.string(),
      authentication: v.optional(v.record(v.string(), v.any())),
    })),
    origin: v.union(v.literal('local'), v.literal('remote')),
  },
  returns: v.id('agentCards'),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('agentCards')
      .withIndex('by_agent', q => q.eq('agentId', args.agentId))
      .first();

    if (existing) {
      // Update with revision increment
      await ctx.db.patch(existing._id, {
        ...args,
        revision: existing.revision + 1,
        updatedAt: new Date().toISOString(),
        isActive: true,
      });
      return existing._id;
    }

    return await ctx.db.insert('agentCards', {
      ...args,
      revision: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },
});

export const updateAgentCard = mutation({
  args: {
    cardId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    tier: v.optional(v.union(v.literal('L0'), v.literal('L1'), v.literal('L2'), v.literal('L3'))),
    capabilities: v.optional(v.array(v.object({
      skill: v.string(),
      description: v.string(),
      inputSchema: v.optional(v.record(v.string(), v.any())),
      outputSchema: v.optional(v.record(v.string(), v.any())),
    }))),
    endpoints: v.optional(v.array(v.object({
      protocol: v.union(v.literal('a2a'), v.literal('mcp')),
      url: v.string(),
      authentication: v.optional(v.record(v.string(), v.any())),
    }))),
    isActive: v.optional(v.boolean()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const card = await ctx.db
      .query('agentCards')
      .withIndex('by_card_id', q => q.eq('cardId', args.cardId))
      .first();

    if (!card) return false;

    const updates: Record<string, unknown> = {
      revision: card.revision + 1,
      updatedAt: new Date().toISOString(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.tier !== undefined) updates.tier = args.tier;
    if (args.capabilities !== undefined) updates.capabilities = args.capabilities;
    if (args.endpoints !== undefined) updates.endpoints = args.endpoints;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    await ctx.db.patch(card._id, updates);
    return true;
  },
});

export const unregisterAgentCard = mutation({
  args: { cardId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const card = await ctx.db
      .query('agentCards')
      .withIndex('by_card_id', q => q.eq('cardId', args.cardId))
      .first();

    if (!card) return false;

    await ctx.db.patch(card._id, { isActive: false });
    return true;
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Agent Card Queries
// ═══════════════════════════════════════════════════════════════════════════════

export const getAgentCard = query({
  args: { cardId: v.string() },
  returns: v.optional(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('agentCards')
      .withIndex('by_card_id', q => q.eq('cardId', args.cardId))
      .first();
  },
});

export const getAgentCardByAgentId = query({
  args: { agentId: v.string() },
  returns: v.optional(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('agentCards')
      .withIndex('by_agent', q => q.eq('agentId', args.agentId))
      .first();
  },
});

export const listAgentCards = query({
  args: {
    tier: v.optional(v.union(v.literal('L0'), v.literal('L1'), v.literal('L2'), v.literal('L3'))),
    origin: v.optional(v.union(v.literal('local'), v.literal('remote'))),
    includeInactive: v.optional(v.boolean()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let results;

    if (args.tier) {
      results = await ctx.db
        .query('agentCards')
        .withIndex('by_tier', q => q.eq('tier', args.tier))
        .collect();
    } else if (args.origin) {
      results = await ctx.db
        .query('agentCards')
        .withIndex('by_origin', q => q.eq('origin', args.origin))
        .collect();
    } else {
      results = await ctx.db.query('agentCards').collect();
    }

    if (!args.includeInactive) {
      results = results.filter(c => c.isActive);
    }

    return results;
  },
});

export const findAgentsByCapability = query({
  args: {
    skill: v.string(),
    tier: v.optional(v.union(v.literal('L0'), v.literal('L1'), v.literal('L2'), v.literal('L3'))),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let results = await ctx.db
      .query('agentCards')
      .filter(q => q.eq(q.field('isActive'), true))
      .collect();

    // Filter by capability skill
    results = results.filter(c => 
      c.capabilities.some((cap: { skill: string }) => 
        cap.skill.toLowerCase().includes(args.skill.toLowerCase())
      )
    );

    if (args.tier) {
      results = results.filter(c => c.tier === args.tier);
    }

    return results;
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Swarm Task Mutations
// ═══════════════════════════════════════════════════════════════════════════════

export const createSwarmTask = mutation({
  args: {
    taskId: v.string(),
    swarmId: v.string(),
    coordinatorId: v.string(),
    taskType: v.string(),
    payload: v.string(),
    priority: v.number(),
  },
  returns: v.id('swarmTasks'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('swarmTasks', {
      ...args,
      status: 'proposed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },
});

export const updateTaskStatus = mutation({
  args: {
    taskId: v.string(),
    status: v.union(
      v.literal('proposed'),
      v.literal('negotiating'),
      v.literal('assigned'),
      v.literal('executing'),
      v.literal('completed'),
      v.literal('failed')
    ),
    assignedAgentId: v.optional(v.string()),
    result: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const task = await ctx.db
      .query('swarmTasks')
      .withIndex('by_task_id', q => q.eq('taskId', args.taskId))
      .first();

    if (!task) return false;

    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: new Date().toISOString(),
    };

    if (args.assignedAgentId !== undefined) {
      updates.assignedAgentId = args.assignedAgentId;
    }
    if (args.result !== undefined) {
      updates.result = args.result;
    }
    if (args.status === 'completed' || args.status === 'failed') {
      updates.completedAt = new Date().toISOString();
    }

    await ctx.db.patch(task._id, updates);
    return true;
  },
});

export const getSwarmTask = query({
  args: { taskId: v.string() },
  returns: v.optional(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('swarmTasks')
      .withIndex('by_task_id', q => q.eq('taskId', args.taskId))
      .first();
  },
});

export const listSwarmTasks = query({
  args: {
    swarmId: v.string(),
    status: v.optional(v.union(
      v.literal('proposed'),
      v.literal('negotiating'),
      v.literal('assigned'),
      v.literal('executing'),
      v.literal('completed'),
      v.literal('failed')
    )),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let results = await ctx.db
      .query('swarmTasks')
      .withIndex('by_swarm', q => q.eq('swarmId', args.swarmId))
      .collect();

    if (args.status) {
      results = results.filter(t => t.status === args.status);
    }

    return results;
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Message Log
// ═══════════════════════════════════════════════════════════════════════════════

export const logA2AMessage = mutation({
  args: {
    messageId: v.string(),
    envelopeId: v.string(),
    messageType: v.union(
      v.literal('request'),
      v.literal('response'),
      v.literal('notification'),
      v.literal('task_proposal'),
      v.literal('crdt_sync')
    ),
    senderId: v.string(),
    recipientId: v.string(),
    correlationId: v.optional(v.string()),
    payload: v.string(),
  },
  returns: v.id('a2aMessages'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('a2aMessages', {
      ...args,
      timestamp: new Date().toISOString(),
      delivered: false,
    });
  },
});

export const markMessageDelivered = mutation({
  args: { messageId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const message = await ctx.db
      .query('a2aMessages')
      .withIndex('by_message_id', q => q.eq('messageId', args.messageId))
      .first();

    if (!message) return false;

    await ctx.db.patch(message._id, { delivered: true });
    return true;
  },
});

export const getMessagesForAgent = query({
  args: {
    recipientId: v.string(),
    since: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let results = await ctx.db
      .query('a2aMessages')
      .withIndex('by_recipient', q => q.eq('recipientId', args.recipientId))
      .order('desc')
      .take(args.limit ?? 100);

    if (args.since) {
      results = results.filter(m => m.timestamp >= args.since);
    }

    return results;
  },
});
