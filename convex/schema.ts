import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // =====================
  // ATLAS Tables (6)
  // =====================
  
  builds: defineTable({
    prdId: v.string(),
    prdName: v.string(),
    status: v.union(v.literal('running'), v.literal('completed'), v.literal('failed')),
    startedAt: v.string(),
    completedAt: v.optional(v.string()),
    error: v.optional(v.string()),
  }).index('by_prd', ['prdId'])
    .index('by_status', ['status']),

  patterns: defineTable({
    name: v.string(),
    description: v.string(),
    code: v.string(),
    language: v.string(),
    tags: v.array(v.string()),
    createdAt: v.string(),
  }).index('by_language', ['language'])
    .index('by_tags', ['tags']),

  agents: defineTable({
    name: v.string(),
    role: v.string(),
    domain: v.string(),
    systemPrompt: v.string(),
    model: v.string(),
    gates: v.array(v.string()),
    createdAt: v.string(),
  }).index('by_name', ['name'])
    .index('by_domain', ['domain']),

  tasks: defineTable({
    buildId: v.id('builds'),
    taskId: v.string(),
    title: v.string(),
    agent: v.string(),
    status: v.union(v.literal('pending'), v.literal('ready'), v.literal('running'), v.literal('done'), v.literal('failed'), v.literal('blocked')),
    dependencies: v.array(v.string()),
    phase: v.number(),
    attempts: v.number(),
    createdAt: v.string(),
    output: v.optional(v.string()),
    error: v.optional(v.string()),
  }).index('by_build', ['buildId'])
    .index('by_status', ['status'])
    .index('by_agent', ['agent']),

  executions: defineTable({
    taskId: v.id('tasks'),
    agent: v.string(),
    model: v.string(),
    prompt: v.string(),
    response: v.string(),
    gatesPassed: v.boolean(),
    duration: v.number(),
    timestamp: v.string(),
    error: v.optional(v.string()),
  }).index('by_task', ['taskId'])
    .index('by_timestamp', ['timestamp']),

  learnings: defineTable({
    buildId: v.id('builds'),
    taskId: v.string(),
    pattern: v.string(),
    insight: v.string(),
    code: v.optional(v.string()),
    createdAt: v.string(),
  }).index('by_build', ['buildId'])
    .index('by_task', ['taskId']),

  // =====================
  // UA Dashboard Tables (4)
  // =====================

  companies: defineTable({
    name: v.string(),
    sector: v.string(),
    ceoPersona: v.string(),
    status: v.union(v.literal('active'), v.literal('suspended'), v.literal('bankrupt')),
    createdAt: v.string(),
  }).index("by_status", ["status"])
    .index("by_sector", ["sector"]),

  chipAccounts: defineTable({
    companyId: v.id("companies"),
    type: v.union(v.literal("savings"), v.literal("spending"), v.literal("investment")),
    balance: v.number(),
    lastTransactionAt: v.string(),
  }).index("by_company", ["companyId"])
    .index("by_company_type", ["companyId", "type"]),

  divisions: defineTable({
    companyId: v.id("companies"),
    name: v.string(),
    revenue: v.number(),
    expenses: v.number(),
    agentCount: v.number(),
    status: v.union(v.literal("active"), v.literal("paused")),
  }).index("by_company", ["companyId"])
    .index("by_company_revenue", ["companyId", "revenue"]),

  agents: defineTable({
    companyId: v.id("companies"),
    divisionId: v.id("divisions"),
    name: v.string(),
    role: v.string(),
    status: v.union(v.literal("active"), v.literal("idle"), v.literal("suspended")),
    currentTaskId: v.optional(v.string()),
    idleMinutes: v.number(),
  }).index("by_company", ["companyId"])
    .index("by_division", ["divisionId"])
    .index("by_status", ["companyId", "status"]),
});
