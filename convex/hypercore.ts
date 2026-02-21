// Convex mutations and queries for Hypercore P2P Protocol
// Spec: .kiro/specs/p2p-hypercore-protocol/design.md

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// ═══════════════════════════════════════════════════════════════════════════════
// Peer Management
// ═══════════════════════════════════════════════════════════════════════════════

export const registerPeer = mutation({
  args: {
    peerId: v.string(),
    publicKey: v.string(),
    displayName: v.optional(v.string()),
    isLocal: v.boolean(),
    version: v.string(),
    capabilities: v.array(v.string()),
  },
  returns: v.id('hypercorePeers'),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('hypercorePeers')
      .withIndex('by_peer_id', q => q.eq('peerId', args.peerId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        connectionStatus: 'connected',
        lastSeenAt: new Date().toISOString(),
        version: args.version,
        capabilities: args.capabilities,
      });
      return existing._id;
    }

    return await ctx.db.insert('hypercorePeers', {
      ...args,
      connectionStatus: 'connected',
      lastSeenAt: new Date().toISOString(),
      bytesTransferred: 0,
    });
  },
});

export const updatePeerStatus = mutation({
  args: {
    peerId: v.string(),
    status: v.union(
      v.literal('connected'),
      v.literal('disconnected'),
      v.literal('connecting'),
      v.literal('banned')
    ),
    latencyMs: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const peer = await ctx.db
      .query('hypercorePeers')
      .withIndex('by_peer_id', q => q.eq('peerId', args.peerId))
      .first();

    if (!peer) return false;

    const updates: Record<string, unknown> = {
      connectionStatus: args.status,
    };

    if (args.latencyMs !== undefined) {
      updates.latencyMs = args.latencyMs;
    }

    if (args.status === 'connected') {
      updates.lastSeenAt = new Date().toISOString();
    }

    await ctx.db.patch(peer._id, updates);
    return true;
  },
});

export const updatePeerStats = mutation({
  args: {
    peerId: v.string(),
    bytesTransferred: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const peer = await ctx.db
      .query('hypercorePeers')
      .withIndex('by_peer_id', q => q.eq('peerId', args.peerId))
      .first();

    if (!peer) return false;

    await ctx.db.patch(peer._id, {
      bytesTransferred: peer.bytesTransferred + args.bytesTransferred,
      lastSeenAt: new Date().toISOString(),
    });

    return true;
  },
});

export const banPeer = mutation({
  args: { peerId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const peer = await ctx.db
      .query('hypercorePeers')
      .withIndex('by_peer_id', q => q.eq('peerId', args.peerId))
      .first();

    if (!peer) return false;

    await ctx.db.patch(peer._id, { connectionStatus: 'banned' });
    return true;
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Peer Queries
// ═══════════════════════════════════════════════════════════════════════════════

export const getPeer = query({
  args: { peerId: v.string() },
  returns: v.optional(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('hypercorePeers')
      .withIndex('by_peer_id', q => q.eq('peerId', args.peerId))
      .first();
  },
});

export const getPeerByPublicKey = query({
  args: { publicKey: v.string() },
  returns: v.optional(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('hypercorePeers')
      .withIndex('by_public_key', q => q.eq('publicKey', args.publicKey))
      .first();
  },
});

export const listPeers = query({
  args: {
    status: v.optional(v.union(
      v.literal('connected'),
      v.literal('disconnected'),
      v.literal('connecting'),
      v.literal('banned')
    )),
    includeLocal: v.optional(v.boolean()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let results;

    if (args.status) {
      results = await ctx.db
        .query('hypercorePeers')
        .withIndex('by_status', q => q.eq('connectionStatus', args.status))
        .collect();
    } else {
      results = await ctx.db.query('hypercorePeers').collect();
    }

    if (!args.includeLocal) {
      results = results.filter(p => !p.isLocal);
    }

    return results;
  },
});

export const getConnectedPeers = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db
      .query('hypercorePeers')
      .withIndex('by_status', q => q.eq('connectionStatus', 'connected'))
      .collect();
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Replication Status
// ═══════════════════════════════════════════════════════════════════════════════

export const updateReplicationStatus = mutation({
  args: {
    feedId: v.string(),
    feedType: v.union(v.literal('memory'), v.literal('crdt'), v.literal('audit')),
    localSeq: v.number(),
    remoteSeq: v.optional(v.number()),
    peerCount: v.number(),
    conflictCount: v.optional(v.number()),
  },
  returns: v.id('replicationStatus'),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('replicationStatus')
      .withIndex('by_feed_id', q => q.eq('feedId', args.feedId))
      .first();

    const syncPercentage = args.remoteSeq 
      ? Math.min(100, (args.localSeq / args.remoteSeq) * 100)
      : 100;

    const isFullySynced = args.remoteSeq 
      ? args.localSeq >= args.remoteSeq
      : true;

    if (existing) {
      await ctx.db.patch(existing._id, {
        localSeq: args.localSeq,
        remoteSeq: args.remoteSeq,
        syncPercentage,
        peerCount: args.peerCount,
        isFullySynced,
        conflictCount: args.conflictCount ?? existing.conflictCount,
        lastSyncAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return existing._id;
    }

    return await ctx.db.insert('replicationStatus', {
      ...args,
      syncPercentage,
      isFullySynced,
      conflictCount: args.conflictCount ?? 0,
      lastSyncAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },
});

export const getReplicationStatus = query({
  args: { feedId: v.string() },
  returns: v.optional(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('replicationStatus')
      .withIndex('by_feed_id', q => q.eq('feedId', args.feedId))
      .first();
  },
});

export const listReplicationStatus = query({
  args: {
    feedType: v.optional(v.union(v.literal('memory'), v.literal('crdt'), v.literal('audit'))),
    onlyUnsynced: v.optional(v.boolean()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let results;

    if (args.feedType) {
      results = await ctx.db
        .query('replicationStatus')
        .withIndex('by_type', q => q.eq('feedType', args.feedType))
        .collect();
    } else {
      results = await ctx.db.query('replicationStatus').collect();
    }

    if (args.onlyUnsynced) {
      results = results.filter(r => !r.isFullySynced);
    }

    return results;
  },
});

export const getSyncStats = query({
  args: {},
  returns: v.object({
    totalFeeds: v.number(),
    fullySynced: v.number(),
    partialSync: v.number(),
    totalConflicts: v.number(),
    avgSyncPercentage: v.number(),
  }),
  handler: async (ctx) => {
    const statuses = await ctx.db.query('replicationStatus').collect();

    if (statuses.length === 0) {
      return {
        totalFeeds: 0,
        fullySynced: 0,
        partialSync: 0,
        totalConflicts: 0,
        avgSyncPercentage: 0,
      };
    }

    const fullySynced = statuses.filter(s => s.isFullySynced).length;
    const totalConflicts = statuses.reduce((sum, s) => sum + s.conflictCount, 0);
    const avgSyncPercentage = statuses.reduce((sum, s) => sum + s.syncPercentage, 0) / statuses.length;

    return {
      totalFeeds: statuses.length,
      fullySynced,
      partialSync: statuses.length - fullySynced,
      totalConflicts,
      avgSyncPercentage,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Conflict Resolution
// ═══════════════════════════════════════════════════════════════════════════════

export const recordConflict = mutation({
  args: {
    feedId: v.string(),
    seq: v.number(),
    peerId: v.string(),
    resolution: v.union(v.literal('local'), v.literal('remote'), v.literal('merge')),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const status = await ctx.db
      .query('replicationStatus')
      .withIndex('by_feed_id', q => q.eq('feedId', args.feedId))
      .first();

    if (!status) return false;

    await ctx.db.patch(status._id, {
      conflictCount: status.conflictCount + 1,
      updatedAt: new Date().toISOString(),
    });

    return true;
  },
});
