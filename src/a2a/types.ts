// A2A/MCP Protocol — Core Types
// Sprint S2-18 | A2A Agent-to-Agent Protocols

export type AgentTier = 'L0' | 'L1' | 'L2' | 'L3';

export type A2AMessageType =
  | 'request'
  | 'response'
  | 'notification'
  | 'task-proposal'
  | 'task-accept'
  | 'task-reject'
  | 'stream-data'
  | 'heartbeat'
  | 'error';

export type ChannelStatus = 'connecting' | 'open' | 'closed' | 'reconnecting' | 'error';

export interface CapabilityDescriptor {
  name: string;
  version: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  tags?: string[];
}

export interface AgentEndpoint {
  type: 'local' | 'hyperswarm' | 'websocket' | 'http';
  address?: string;
  port?: number;
  topic?: string;  // Hyperswarm topic
}

export interface AgentCard {
  id: string;
  name: string;
  tier: AgentTier;
  capabilities: CapabilityDescriptor[];
  endpoints: AgentEndpoint[];
  sandboxId?: string;
  metadata?: Record<string, string>;
  protocolVersion: string;
  origin: 'local' | 'remote';
  revision: number;
  registeredAt: number;
  updatedAt: number;
}

export interface A2AEnvelope {
  id: string;
  type: A2AMessageType;
  from: string;       // agentId
  to: string;         // agentId or '*' for broadcast
  correlationId?: string;
  payload: unknown;
  timestamp: number;
  ttlMs?: number;
  sandboxId?: string;
}

export interface RoutingResult {
  delivered: boolean;
  targetAgentId: string;
  channelType: AgentEndpoint['type'];
  latencyMs: number;
  error?: string;
}

export interface TaskProposal {
  taskId: string;
  description: string;
  requiredCapabilities: string[];
  complexity: 'low' | 'medium' | 'high';
  deadline?: number;
  proposedBy: string;
}

export interface CRDTSyncMessage {
  operationId: string;
  vectorClock: Record<string, number>;
  payload: unknown;
  logName: string;
  seq: number;
}

export interface A2ALogEvent {
  eventType: 'message-sent' | 'message-received' | 'routing-failed' | 'tool-invoked'
    | 'channel-opened' | 'channel-closed' | 'task-proposed' | 'task-accepted' | 'task-rejected';
  agentId?: string;
  targetAgentId?: string;
  envelopeId?: string;
  toolName?: string;
  latencyMs?: number;
  error?: string;
  timestamp: number;
}

export interface A2AMetrics {
  messagesSent: number;
  messagesReceived: number;
  routingFailures: number;
  toolInvocations: number;
  avgRoutingLatencyMs: number;
  channelsOpened: number;
  channelsClosed: number;
}
