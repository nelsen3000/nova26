// Workflow Engine Types
// Spec: .nova/specs/grok-r24-immortal-omniverse.md (R24-02)

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// Core Workflow Types
// ═══════════════════════════════════════════════════════════════════════════════

export const WorkflowNodeTypeSchema = z.enum([
  'agent',
  'decision',
  'parallel',
  'loop',
  'wait',
  'trigger',
]);

export const WorkflowNodeSchema = z.object({
  id: z.string(),
  type: WorkflowNodeTypeSchema,
  name: z.string(),
  config: z.record(z.any()),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  metadata: z.record(z.any()).optional(),
});

export const WorkflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
  condition: z.string().optional(), // For decision nodes
});

export const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
  version: z.string().default('1.0.0'),
  createdAt: z.number(),
  updatedAt: z.number(),
  metadata: z.record(z.any()).optional(),
});

export const WorkflowRunStateSchema = z.enum([
  'pending',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
]);

export const WorkflowRunSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  state: WorkflowRunStateSchema,
  currentNodeId: z.string().nullable(),
  context: z.record(z.any()),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  error: z.string().optional(),
});

export type WorkflowNodeType = z.infer<typeof WorkflowNodeTypeSchema>;
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
export type WorkflowRunState = z.infer<typeof WorkflowRunStateSchema>;
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// Node Configuration Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface AgentNodeConfig {
  agentId: string;
  taskType: string;
  inputMapping: Record<string, string>; // Map context keys to agent inputs
  outputMapping: Record<string, string>; // Map agent outputs to context
}

export interface DecisionNodeConfig {
  condition: string; // Expression to evaluate
  branches: {
    label: string;
    expression: string;
  }[];
}

export interface ParallelNodeConfig {
  branches: string[][]; // Array of node ID paths to execute in parallel
  joinStrategy: 'all' | 'any' | 'first'; // How to combine results
}

export interface LoopNodeConfig {
  iterator: string; // Context key containing array to iterate
  body: string[]; // Node IDs in loop body
  maxIterations: number;
}

export interface WaitNodeConfig {
  durationMs?: number;
  until?: string; // Condition to wait for
}

export interface TriggerNodeConfig {
  type: 'manual' | 'scheduled' | 'webhook' | 'event';
  config: Record<string, any>;
}
