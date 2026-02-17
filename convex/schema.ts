/**
 * ATLAS Convex Schema
 * 
 * This schema defines the tables for the ATLAS meta-learner system.
 * It is NOT deployed in Phase 0 - this is a definition file for future use.
 * 
 * For Phase 0, ATLAS uses file-based JSON storage (.nova/atlas/).
 * When Convex deployment is ready, this schema can be deployed.
 */

import { defineSchema, defineTable } from './server.js';
import { v } from './values.js';

export default defineSchema({
  // Build logs — every task attempt
  atlasBuilds: defineTable({
    companyId: v.id('companies'),
    taskId: v.string(),
    agent: v.string(),
    model: v.string(),
    attempt: v.number(),
    startedAt: v.string(),
    completedAt: v.string(),
    durationMs: v.number(),
    gateResults: v.array(v.object({
      gateName: v.string(),
      passed: v.boolean(),
      message: v.string(),
      severity: v.string(),
    })),
    success: v.boolean(),
    outputPath: v.optional(v.string()),
  })
    .index('by_company', ['companyId'])
    .index('by_agent', ['companyId', 'agent'])
    .index('by_task', ['companyId', 'taskId']),

  // Patterns — what works, what doesn't
  atlasPatterns: defineTable({
    companyId: v.id('companies'),
    agent: v.string(),
    patternType: v.string(), // "success" | "failure" | "optimization"
    description: v.string(),
    evidence: v.array(v.string()), // Build IDs that support this pattern
    confidence: v.number(), // 0-100
    createdAt: v.string(),
    lastValidated: v.string(),
  })
    .index('by_company', ['companyId'])
    .index('by_agent', ['companyId', 'agent']),

  // Retrospectives — post-build analysis
  atlasRetrospectives: defineTable({
    companyId: v.id('companies'),
    buildIds: v.array(v.string()),
    findings: v.array(v.object({
      finding: v.string(),
      category: v.string(),
      actionable: v.boolean(),
    })),
    createdAt: v.string(),
  })
    .index('by_company', ['companyId']),

  // Briefings — pre-task advice
  atlasBriefings: defineTable({
    companyId: v.id('companies'),
    agent: v.string(),
    taskType: v.string(),
    briefing: v.string(), // ~200 tokens of actionable advice
    basedOnBuilds: v.array(v.string()),
    createdAt: v.string(),
  })
    .index('by_company_agent', ['companyId', 'agent']),

  // Improvement proposals
  atlasImprovements: defineTable({
    companyId: v.id('companies'),
    proposal: v.string(),
    rationale: v.string(),
    estimatedImpact: v.string(),
    status: v.string(), // "proposed" | "approved" | "rejected" | "implemented"
    createdAt: v.string(),
  })
    .index('by_company', ['companyId']),

  // Agent performance metrics
  atlasAgentMetrics: defineTable({
    companyId: v.id('companies'),
    agent: v.string(),
    totalBuilds: v.number(),
    successRate: v.number(), // 0-1
    avgDurationMs: v.number(),
    commonFailures: v.array(v.string()),
    lastUpdated: v.string(),
  })
    .index('by_company_agent', ['companyId', 'agent']),
});

/**
 * TypeScript types for ATLAS tables (for reference)
 * These would be auto-generated in a real Convex deployment
 */

export type AtlasBuild = {
  companyId: string;
  taskId: string;
  agent: string;
  model: string;
  attempt: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  gateResults: Array<{
    gateName: string;
    passed: boolean;
    message: string;
    severity: string;
  }>;
  success: boolean;
  outputPath?: string;
};

export type AtlasPattern = {
  companyId: string;
  agent: string;
  patternType: 'success' | 'failure' | 'optimization';
  description: string;
  evidence: string[];
  confidence: number;
  createdAt: string;
  lastValidated: string;
};

export type AtlasRetrospective = {
  companyId: string;
  buildIds: string[];
  findings: Array<{
    finding: string;
    category: string;
    actionable: boolean;
  }>;
  createdAt: string;
};

export type AtlasBriefing = {
  companyId: string;
  agent: string;
  taskType: string;
  briefing: string;
  basedOnBuilds: string[];
  createdAt: string;
};

export type AtlasImprovement = {
  companyId: string;
  proposal: string;
  rationale: string;
  estimatedImpact: string;
  status: 'proposed' | 'approved' | 'rejected' | 'implemented';
  createdAt: string;
};

export type AtlasAgentMetrics = {
  companyId: string;
  agent: string;
  totalBuilds: number;
  successRate: number;
  avgDurationMs: number;
  commonFailures: string[];
  lastUpdated: string;
};
