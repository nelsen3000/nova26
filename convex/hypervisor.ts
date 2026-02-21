// Convex mutations and queries for Hypervisor (Reel 2)
// Spec: .kiro/specs/hypervisor-hypercore/design.md

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// ═══════════════════════════════════════════════════════════════════════════════
// Virtual Machine Mutations
// ═══════════════════════════════════════════════════════════════════════════════

export const createVM = mutation({
  args: {
    vmId: v.string(),
    name: v.string(),
    provider: v.union(v.literal('hypercore-hal'), v.literal('qemu'), v.literal('cloud-hypervisor')),
    vmSpec: v.string(), // JSON serialized hac.toml content
    parentHarnessId: v.optional(v.string()),
    cpuCount: v.number(),
    memoryMB: v.number(),
    diskMB: v.number(),
  },
  returns: v.id('virtualMachines'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('virtualMachines', {
      ...args,
      status: 'creating',
      createdAt: new Date().toISOString(),
    });
  },
});

export const updateVMStatus = mutation({
  args: {
    vmId: v.string(),
    status: v.union(
      v.literal('creating'),
      v.literal('running'),
      v.literal('paused'),
      v.literal('stopped'),
      v.literal('failed'),
      v.literal('destroyed')
    ),
    ipAddress: v.optional(v.string()),
    vsockPort: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const vm = await ctx.db
      .query('virtualMachines')
      .withIndex('by_vm_id', q => q.eq('vmId', args.vmId))
      .first();

    if (!vm) return false;

    const updates: Record<string, unknown> = {
      status: args.status,
    };

    if (args.ipAddress !== undefined) {
      updates.ipAddress = args.ipAddress;
    }
    if (args.vsockPort !== undefined) {
      updates.vsockPort = args.vsockPort;
    }
    if (args.errorMessage !== undefined) {
      updates.errorMessage = args.errorMessage;
    }
    if (args.status === 'running') {
      updates.startedAt = new Date().toISOString();
    }
    if (args.status === 'stopped' || args.status === 'destroyed' || args.status === 'failed') {
      updates.stoppedAt = new Date().toISOString();
    }

    await ctx.db.patch(vm._id, updates);
    return true;
  },
});

export const destroyVM = mutation({
  args: { vmId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const vm = await ctx.db
      .query('virtualMachines')
      .withIndex('by_vm_id', q => q.eq('vmId', args.vmId))
      .first();

    if (!vm) return false;

    await ctx.db.patch(vm._id, {
      status: 'destroyed',
      stoppedAt: new Date().toISOString(),
    });

    return true;
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// VM Queries
// ═══════════════════════════════════════════════════════════════════════════════

export const getVM = query({
  args: { vmId: v.string() },
  returns: v.optional(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('virtualMachines')
      .withIndex('by_vm_id', q => q.eq('vmId', args.vmId))
      .first();
  },
});

export const getVMByName = query({
  args: { name: v.string() },
  returns: v.optional(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('virtualMachines')
      .withIndex('by_name', q => q.eq('name', args.name))
      .first();
  },
});

export const listVMs = query({
  args: {
    status: v.optional(v.union(
      v.literal('creating'),
      v.literal('running'),
      v.literal('paused'),
      v.literal('stopped'),
      v.literal('failed'),
      v.literal('destroyed')
    )),
    provider: v.optional(v.union(v.literal('hypercore-hal'), v.literal('qemu'), v.literal('cloud-hypervisor'))),
    parentHarnessId: v.optional(v.string()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let results;

    if (args.status) {
      results = await ctx.db
        .query('virtualMachines')
        .withIndex('by_status', q => q.eq('status', args.status))
        .collect();
    } else if (args.provider) {
      results = await ctx.db
        .query('virtualMachines')
        .withIndex('by_provider', q => q.eq('provider', args.provider))
        .collect();
    } else if (args.parentHarnessId) {
      results = await ctx.db
        .query('virtualMachines')
        .withIndex('by_harness', q => q.eq('parentHarnessId', args.parentHarnessId))
        .collect();
    } else {
      results = await ctx.db.query('virtualMachines').collect();
    }

    return results;
  },
});

export const getRunningVMs = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db
      .query('virtualMachines')
      .withIndex('by_status', q => q.eq('status', 'running'))
      .collect();
  },
});

export const getVMStats = query({
  args: {},
  returns: v.object({
    total: v.number(),
    creating: v.number(),
    running: v.number(),
    paused: v.number(),
    stopped: v.number(),
    failed: v.number(),
    destroyed: v.number(),
  }),
  handler: async (ctx) => {
    const vms = await ctx.db.query('virtualMachines').collect();

    return {
      total: vms.length,
      creating: vms.filter(v => v.status === 'creating').length,
      running: vms.filter(v => v.status === 'running').length,
      paused: vms.filter(v => v.status === 'paused').length,
      stopped: vms.filter(v => v.status === 'stopped').length,
      failed: vms.filter(v => v.status === 'failed').length,
      destroyed: vms.filter(v => v.status === 'destroyed').length,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Sandbox Policy Management
// ═══════════════════════════════════════════════════════════════════════════════

export const createSandboxPolicy = mutation({
  args: {
    policyId: v.string(),
    name: v.string(),
    policyType: v.union(v.literal('ultra'), v.literal('standard'), v.literal('permissive')),
    maxSyscallsPerSecond: v.number(),
    maxNetworkConnections: v.number(),
    allowedSystemCalls: v.array(v.string()),
    blockedSystemCalls: v.array(v.string()),
    rules: v.optional(v.array(v.object({
      action: v.union(v.literal('allow'), v.literal('deny')),
      resource: v.string(),
      condition: v.optional(v.string()),
    }))),
  },
  returns: v.id('sandboxPolicies'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('sandboxPolicies', {
      ...args,
      rules: args.rules ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },
});

export const updateSandboxPolicy = mutation({
  args: {
    policyId: v.string(),
    name: v.optional(v.string()),
    maxSyscallsPerSecond: v.optional(v.number()),
    maxNetworkConnections: v.optional(v.number()),
    allowedSystemCalls: v.optional(v.array(v.string())),
    blockedSystemCalls: v.optional(v.array(v.string())),
    rules: v.optional(v.array(v.object({
      action: v.union(v.literal('allow'), v.literal('deny')),
      resource: v.string(),
      condition: v.optional(v.string()),
    }))),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const policy = await ctx.db
      .query('sandboxPolicies')
      .withIndex('by_policy_id', q => q.eq('policyId', args.policyId))
      .first();

    if (!policy) return false;

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.maxSyscallsPerSecond !== undefined) updates.maxSyscallsPerSecond = args.maxSyscallsPerSecond;
    if (args.maxNetworkConnections !== undefined) updates.maxNetworkConnections = args.maxNetworkConnections;
    if (args.allowedSystemCalls !== undefined) updates.allowedSystemCalls = args.allowedSystemCalls;
    if (args.blockedSystemCalls !== undefined) updates.blockedSystemCalls = args.blockedSystemCalls;
    if (args.rules !== undefined) updates.rules = args.rules;

    await ctx.db.patch(policy._id, updates);
    return true;
  },
});

export const getSandboxPolicy = query({
  args: { policyId: v.string() },
  returns: v.optional(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('sandboxPolicies')
      .withIndex('by_policy_id', q => q.eq('policyId', args.policyId))
      .first();
  },
});

export const listSandboxPolicies = query({
  args: {
    policyType: v.optional(v.union(v.literal('ultra'), v.literal('standard'), v.literal('permissive'))),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    if (args.policyType) {
      return await ctx.db
        .query('sandboxPolicies')
        .withIndex('by_type', q => q.eq('policyType', args.policyType))
        .collect();
    }
    return await ctx.db.query('sandboxPolicies').collect();
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Agent Deployment Management
// ═══════════════════════════════════════════════════════════════════════════════

export const createDeployment = mutation({
  args: {
    deploymentId: v.string(),
    vmId: v.string(),
    agentId: v.string(),
    agentType: v.union(v.literal('moltbot'), v.literal('custom')),
    manifestHash: v.string(),
    environment: v.optional(v.record(v.string(), v.string())),
    healthCheckUrl: v.optional(v.string()),
  },
  returns: v.id('agentDeployments'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('agentDeployments', {
      ...args,
      environment: args.environment ?? {},
      status: 'pending',
      startedAt: new Date().toISOString(),
    });
  },
});

export const updateDeploymentStatus = mutation({
  args: {
    deploymentId: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('deploying'),
      v.literal('running'),
      v.literal('failed'),
      v.literal('terminated')
    ),
    isHealthy: v.optional(v.boolean()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const deployment = await ctx.db
      .query('agentDeployments')
      .withIndex('by_deployment_id', q => q.eq('deploymentId', args.deploymentId))
      .first();

    if (!deployment) return false;

    const updates: Record<string, unknown> = {
      status: args.status,
    };

    if (args.isHealthy !== undefined) {
      updates.isHealthy = args.isHealthy;
      updates.lastHealthCheck = new Date().toISOString();
    }

    if (args.status === 'terminated' || args.status === 'failed') {
      updates.terminatedAt = new Date().toISOString();
    }

    await ctx.db.patch(deployment._id, updates);
    return true;
  },
});

export const recordHealthCheck = mutation({
  args: {
    deploymentId: v.string(),
    isHealthy: v.boolean(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const deployment = await ctx.db
      .query('agentDeployments')
      .withIndex('by_deployment_id', q => q.eq('deploymentId', args.deploymentId))
      .first();

    if (!deployment) return false;

    await ctx.db.patch(deployment._id, {
      isHealthy: args.isHealthy,
      lastHealthCheck: new Date().toISOString(),
    });

    return true;
  },
});

export const getDeployment = query({
  args: { deploymentId: v.string() },
  returns: v.optional(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('agentDeployments')
      .withIndex('by_deployment_id', q => q.eq('deploymentId', args.deploymentId))
      .first();
  },
});

export const listDeployments = query({
  args: {
    vmId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal('pending'),
      v.literal('deploying'),
      v.literal('running'),
      v.literal('failed'),
      v.literal('terminated')
    )),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let results;

    if (args.vmId) {
      results = await ctx.db
        .query('agentDeployments')
        .withIndex('by_vm', q => q.eq('vmId', args.vmId))
        .collect();
    } else if (args.agentId) {
      results = await ctx.db
        .query('agentDeployments')
        .withIndex('by_agent', q => q.eq('agentId', args.agentId))
        .collect();
    } else if (args.status) {
      results = await ctx.db
        .query('agentDeployments')
        .withIndex('by_status', q => q.eq('status', args.status))
        .collect();
    } else {
      results = await ctx.db.query('agentDeployments').collect();
    }

    return results;
  },
});

export const getRunningDeployments = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db
      .query('agentDeployments')
      .withIndex('by_status', q => q.eq('status', 'running'))
      .collect();
  },
});
