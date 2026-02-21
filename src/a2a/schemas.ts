// A2A/MCP Protocol — Zod Schemas
// Sprint S2-18 | A2A Agent-to-Agent Protocols

import { z } from 'zod';

export const AgentTierSchema = z.enum(['L0', 'L1', 'L2', 'L3']);

export const A2AMessageTypeSchema = z.enum([
  'request', 'response', 'notification', 'task-proposal',
  'task-accept', 'task-reject', 'stream-data', 'heartbeat', 'error',
]);

export const ChannelStatusSchema = z.enum(['connecting', 'open', 'closed', 'reconnecting', 'error']);

export const CapabilityDescriptorSchema = z.object({
  name: z.string().min(1),
  version: z.string().default('1.0.0'),
  description: z.string().default(''),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).default([]),
});

export const AgentEndpointSchema = z.object({
  type: z.enum(['local', 'hyperswarm', 'websocket', 'http']),
  address: z.string().optional(),
  port: z.number().optional(),
  topic: z.string().optional(),
});

export const AgentCardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tier: AgentTierSchema,
  capabilities: z.array(CapabilityDescriptorSchema).default([]),
  endpoints: z.array(AgentEndpointSchema).default([{ type: 'local' }]),
  sandboxId: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  protocolVersion: z.string().default('1.0'),
  origin: z.enum(['local', 'remote']).default('local'),
  revision: z.number().int().nonnegative().default(0),
  registeredAt: z.number().default(() => Date.now()),
  updatedAt: z.number().default(() => Date.now()),
});

export const A2AEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: A2AMessageTypeSchema,
  from: z.string().min(1),
  to: z.string().min(1),
  correlationId: z.string().optional(),
  payload: z.unknown(),
  timestamp: z.number(),
  ttlMs: z.number().positive().optional(),
  sandboxId: z.string().optional(),
});

export const RoutingResultSchema = z.object({
  delivered: z.boolean(),
  targetAgentId: z.string(),
  channelType: z.enum(['local', 'hyperswarm', 'websocket', 'http']),
  latencyMs: z.number().nonnegative(),
  error: z.string().optional(),
});

export const TaskProposalPayloadSchema = z.object({
  taskId: z.string(),
  description: z.string(),
  requiredCapabilities: z.array(z.string()),
  complexity: z.enum(['low', 'medium', 'high']).default('medium'),
  deadline: z.number().optional(),
  proposedBy: z.string(),
});

export const CRDTSyncMessageSchema = z.object({
  operationId: z.string(),
  vectorClock: z.record(z.number()),
  payload: z.unknown(),
  logName: z.string(),
  seq: z.number().int().nonnegative(),
});

export const A2ALogEventSchema = z.object({
  eventType: z.enum([
    'message-sent', 'message-received', 'routing-failed', 'tool-invoked',
    'channel-opened', 'channel-closed', 'task-proposed', 'task-accepted', 'task-rejected',
  ]),
  agentId: z.string().optional(),
  targetAgentId: z.string().optional(),
  envelopeId: z.string().optional(),
  toolName: z.string().optional(),
  latencyMs: z.number().nonnegative().optional(),
  error: z.string().optional(),
  timestamp: z.number(),
});

// Inferred types from schemas (for external usage)
export type AgentCardParsed = z.infer<typeof AgentCardSchema>;
export type A2AEnvelopeParsed = z.infer<typeof A2AEnvelopeSchema>;
export type TaskProposalPayloadParsed = z.infer<typeof TaskProposalPayloadSchema>;
