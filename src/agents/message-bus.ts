// Agent Message Bus — Inter-agent communication and negotiation protocol
// KIMI-FRONTIER-01: Grok R13-01 Agent Communication spec

import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export type AgentMessageType =
  | 'REQUEST_HELP'
  | 'SHARE_FINDING'
  | 'FLAG_CONCERN'
  | 'PROPOSE'
  | 'COUNTER'
  | 'AGREE'
  | 'ESCALATE';

export type AgentName =
  | 'MARS' | 'VENUS' | 'MERCURY' | 'JUPITER' | 'SATURN' | 'PLUTO'
  | 'ATLAS' | 'GANYMEDE' | 'IO' | 'CALLISTO' | 'MIMAS' | 'NEPTUNE'
  | 'ANDROMEDA' | 'ENCELADUS' | 'SUN' | 'EARTH' | 'RALPH';

export interface AgentMessage {
  id: string;
  type: AgentMessageType;
  from: AgentName;
  to: AgentName | 'BROADCAST';
  subject: string;
  body: string;
  replyToId?: string;
  taskId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requiresResponse: boolean;
  responseDeadlineMs?: number;
  sentAt: string;
  deliveredAt?: string;
  readAt?: string;
}

export type NegotiationStatus = 'open' | 'agreed' | 'escalated';

export interface NegotiationSession {
  id: string;
  taskId: string;
  initiator: AgentName;
  respondent: AgentName;
  topic: string;
  initiatorPosition: string;
  respondentPosition?: string;
  status: NegotiationStatus;
  resolution?: string;
  resolvedBy?: AgentName | 'JUPITER' | 'auto';
  openedAt: string;
  resolvedAt?: string;
  messageIds: string[];
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const AgentMessageSchema = z.object({
  id: z.string(),
  type: z.enum(['REQUEST_HELP', 'SHARE_FINDING', 'FLAG_CONCERN', 'PROPOSE', 'COUNTER', 'AGREE', 'ESCALATE']),
  from: z.string(),
  to: z.union([z.string(), z.literal('BROADCAST')]),
  subject: z.string(),
  body: z.string(),
  replyToId: z.string().optional(),
  taskId: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  requiresResponse: z.boolean(),
  responseDeadlineMs: z.number().optional(),
  sentAt: z.string(),
  deliveredAt: z.string().optional(),
  readAt: z.string().optional(),
});

export const NegotiationSessionSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  initiator: z.string(),
  respondent: z.string(),
  topic: z.string(),
  initiatorPosition: z.string(),
  respondentPosition: z.string().optional(),
  status: z.enum(['open', 'agreed', 'escalated']),
  resolution: z.string().optional(),
  resolvedBy: z.union([z.string(), z.literal('JUPITER'), z.literal('auto')]).optional(),
  openedAt: z.string(),
  resolvedAt: z.string().optional(),
  messageIds: z.array(z.string()),
});

// ============================================================================
// AgentMessageBus Class
// ============================================================================

class AgentMessageBus {
  private messages: Map<string, AgentMessage> = new Map();
  private handlers: Map<AgentName, (msg: AgentMessage) => Promise<void>> = new Map();

  async send(message: Omit<AgentMessage, 'id' | 'sentAt'>): Promise<AgentMessage> {
    const id = crypto.randomUUID();
    const sentAt = new Date().toISOString();

    const fullMessage: AgentMessage = {
      ...message,
      id,
      sentAt,
    };

    this.messages.set(id, fullMessage);

    // Deliver message
    if (message.to === 'BROADCAST') {
      // Deliver to all registered handlers
      for (const [agentName, handler] of this.handlers) {
        if (agentName !== message.from) {
          const deliveredMessage = { ...fullMessage, deliveredAt: new Date().toISOString() };
          this.messages.set(id, deliveredMessage);
          try {
            await handler(deliveredMessage);
          } catch (error) {
            console.warn(`MessageBus: handler for ${agentName} failed:`, error);
          }
        }
      }
    } else {
      // Deliver to specific recipient
      const handler = this.handlers.get(message.to as AgentName);
      if (handler) {
        const deliveredMessage = { ...fullMessage, deliveredAt: new Date().toISOString() };
        this.messages.set(id, deliveredMessage);
        try {
          await handler(deliveredMessage);
        } catch (error) {
          console.warn(`MessageBus: handler for ${message.to} failed:`, error);
        }
      }
    }

    console.log(`MessageBus [${message.from} → ${message.to}] ${message.type}: ${message.subject}`);
    return this.messages.get(id)!;
  }

  subscribe(agentName: AgentName, handler: (msg: AgentMessage) => Promise<void>): () => void {
    this.handlers.set(agentName, handler);
    
    // Return unsubscribe function
    return () => {
      this.handlers.delete(agentName);
    };
  }

  getThread(rootMessageId: string): AgentMessage[] {
    const root = this.messages.get(rootMessageId);
    if (!root) return [];

    const thread: AgentMessage[] = [root];
    
    // Find all messages that reply to this thread
    for (const msg of this.messages.values()) {
      if (msg.replyToId === rootMessageId || this.tracesBackTo(msg.replyToId, rootMessageId)) {
        thread.push(msg);
      }
    }

    // Sort by sentAt ascending
    thread.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
    
    return thread;
  }

  private tracesBackTo(replyToId: string | undefined, rootId: string): boolean {
    if (!replyToId) return false;
    if (replyToId === rootId) return true;
    
    const parent = this.messages.get(replyToId);
    if (!parent) return false;
    
    return this.tracesBackTo(parent.replyToId, rootId);
  }

  getInbox(agentName: AgentName, taskId?: string): AgentMessage[] {
    const inbox: AgentMessage[] = [];
    
    for (const msg of this.messages.values()) {
      const isRecipient = msg.to === agentName || msg.to === 'BROADCAST';
      const matchesTask = !taskId || msg.taskId === taskId;
      
      if (isRecipient && matchesTask) {
        inbox.push(msg);
      }
    }

    // Sort by sentAt desc (newest first)
    inbox.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
    
    return inbox;
  }

  markRead(messageId: string, agentName: AgentName): void {
    const msg = this.messages.get(messageId);
    if (msg && (msg.to === agentName || msg.to === 'BROADCAST')) {
      msg.readAt = new Date().toISOString();
      this.messages.set(messageId, msg);
    }
  }

  getUnread(agentName: AgentName, taskId: string): AgentMessage[] {
    return this.getInbox(agentName, taskId).filter(msg => !msg.readAt);
  }

  clearTask(taskId: string): void {
    for (const [id, msg] of this.messages) {
      if (msg.taskId === taskId) {
        this.messages.delete(id);
      }
    }
  }

  // For testing
  getMessage(id: string): AgentMessage | undefined {
    return this.messages.get(id);
  }
}

// ============================================================================
// NegotiationProtocol Class
// ============================================================================

class NegotiationProtocol {
  private sessions: Map<string, NegotiationSession> = new Map();

  constructor(private bus: AgentMessageBus) {}

  async openNegotiation(
    taskId: string,
    initiator: AgentName,
    respondent: AgentName,
    topic: string,
    initiatorPosition: string
  ): Promise<NegotiationSession> {
    const session: NegotiationSession = {
      id: crypto.randomUUID(),
      taskId,
      initiator,
      respondent,
      topic,
      initiatorPosition,
      status: 'open',
      openedAt: new Date().toISOString(),
      messageIds: [],
    };

    // Send PROPOSE message
    const message = await this.bus.send({
      type: 'PROPOSE',
      from: initiator,
      to: respondent,
      subject: topic,
      body: initiatorPosition,
      taskId,
      priority: 'medium',
      requiresResponse: true,
    });

    session.messageIds.push(message.id);
    this.sessions.set(session.id, session);
    
    return session;
  }

  async respondToNegotiation(
    sessionId: string,
    respondentPosition: string
  ): Promise<NegotiationSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Negotiation session ${sessionId} not found`);
    }
    if (session.status !== 'open') {
      throw new Error(`Negotiation session ${sessionId} is not open`);
    }

    session.respondentPosition = respondentPosition;

    // Find the original PROPOSE message to reply to
    const proposeMessageId = session.messageIds[0];

    // Send COUNTER message
    const message = await this.bus.send({
      type: 'COUNTER',
      from: session.respondent,
      to: session.initiator,
      subject: `Re: ${session.topic}`,
      body: respondentPosition,
      replyToId: proposeMessageId,
      taskId: session.taskId,
      priority: 'medium',
      requiresResponse: true,
    });

    session.messageIds.push(message.id);
    this.sessions.set(sessionId, session);
    
    return session;
  }

  async resolve(
    sessionId: string,
    chosenApproach: string,
    resolvedBy: AgentName | 'JUPITER' | 'auto'
  ): Promise<NegotiationSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Negotiation session ${sessionId} not found`);
    }

    session.status = 'agreed';
    session.resolution = chosenApproach;
    session.resolvedBy = resolvedBy;
    session.resolvedAt = new Date().toISOString();

    // Send AGREE message to both agents
    const message = await this.bus.send({
      type: 'AGREE',
      from: resolvedBy === 'auto' ? session.initiator : (resolvedBy as AgentName),
      to: 'BROADCAST',
      subject: `Resolved: ${session.topic}`,
      body: `Approach agreed: ${chosenApproach}`,
      taskId: session.taskId,
      priority: 'medium',
      requiresResponse: false,
    });

    session.messageIds.push(message.id);
    this.sessions.set(sessionId, session);
    
    return session;
  }

  async escalate(
    sessionId: string,
    reason: string
  ): Promise<NegotiationSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Negotiation session ${sessionId} not found`);
    }

    session.status = 'escalated';
    session.resolvedBy = 'JUPITER';
    session.resolution = reason;
    session.resolvedAt = new Date().toISOString();

    // Send ESCALATE message to JUPITER
    const message = await this.bus.send({
      type: 'ESCALATE',
      from: session.initiator,
      to: 'JUPITER',
      subject: `Escalated: ${session.topic}`,
      body: reason,
      taskId: session.taskId,
      priority: 'high',
      requiresResponse: true,
    });

    session.messageIds.push(message.id);
    this.sessions.set(sessionId, session);
    
    return session;
  }

  getOpenNegotiations(taskId: string): NegotiationSession[] {
    const open: NegotiationSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.taskId === taskId && session.status === 'open') {
        open.push(session);
      }
    }
    return open;
  }

  shouldTriggerNegotiation(agentConfidence: number, peerHasExpertise: boolean): boolean {
    return agentConfidence < 0.65 && peerHasExpertise;
  }

  // For testing
  getSession(id: string): NegotiationSession | undefined {
    return this.sessions.get(id);
  }
}

// ============================================================================
// Singleton Factories
// ============================================================================

let messageBusInstance: AgentMessageBus | null = null;
let negotiationProtocolInstance: NegotiationProtocol | null = null;

export function getAgentMessageBus(): AgentMessageBus {
  if (!messageBusInstance) {
    messageBusInstance = new AgentMessageBus();
  }
  return messageBusInstance;
}

export function resetAgentMessageBus(): void {
  messageBusInstance = null;
}

export function getNegotiationProtocol(): NegotiationProtocol {
  if (!negotiationProtocolInstance) {
    negotiationProtocolInstance = new NegotiationProtocol(getAgentMessageBus());
  }
  return negotiationProtocolInstance;
}

export function resetNegotiationProtocol(): void {
  negotiationProtocolInstance = null;
}

export { AgentMessageBus, NegotiationProtocol };
