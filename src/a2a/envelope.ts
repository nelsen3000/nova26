// A2A Envelope Factory
// Sprint S2-19 | A2A Agent-to-Agent Protocols

import { randomUUID } from 'crypto';
import type { A2AEnvelope, A2AMessageType, TaskProposal } from './types.js';
import { A2AEnvelopeSchema } from './schemas.js';

export class EnvelopeFactory {
  private fromAgentId: string;
  private sandboxId?: string;
  private defaultTtlMs?: number;

  constructor(fromAgentId: string, options?: { sandboxId?: string; defaultTtlMs?: number }) {
    this.fromAgentId = fromAgentId;
    this.sandboxId = options?.sandboxId;
    this.defaultTtlMs = options?.defaultTtlMs;
  }

  /**
   * Create a typed A2A envelope with a unique ID.
   */
  createEnvelope(
    type: A2AMessageType,
    to: string,
    payload: unknown,
    options?: { correlationId?: string; ttlMs?: number; sandboxId?: string },
  ): A2AEnvelope {
    const envelope = A2AEnvelopeSchema.parse({
      id: randomUUID(),
      type,
      from: this.fromAgentId,
      to,
      correlationId: options?.correlationId,
      payload,
      timestamp: Date.now(),
      ttlMs: options?.ttlMs ?? this.defaultTtlMs,
      sandboxId: options?.sandboxId ?? this.sandboxId,
    });
    return envelope;
  }

  /**
   * Create a request envelope.
   */
  createRequest(to: string, payload: unknown, correlationId?: string): A2AEnvelope {
    return this.createEnvelope('request', to, payload, { correlationId });
  }

  /**
   * Create a response envelope (carries same correlationId as the request).
   */
  createResponse(to: string, payload: unknown, correlationId: string): A2AEnvelope {
    return this.createEnvelope('response', to, payload, { correlationId });
  }

  /**
   * Create a broadcast notification (to = '*').
   */
  createNotification(payload: unknown): A2AEnvelope {
    return this.createEnvelope('notification', '*', payload);
  }

  /**
   * Create a task-proposal envelope.
   */
  createTaskProposal(to: string, proposal: TaskProposal): A2AEnvelope {
    const correlationId = randomUUID();
    return this.createEnvelope('task-proposal', to, proposal, { correlationId });
  }

  /**
   * Create a task-accept envelope in response to a proposal.
   */
  createTaskAccept(to: string, taskId: string, correlationId: string, estimatedMs?: number): A2AEnvelope {
    return this.createEnvelope('task-accept', to, { taskId, estimatedMs, acceptedBy: this.fromAgentId }, { correlationId });
  }

  /**
   * Create a task-reject envelope.
   */
  createTaskReject(to: string, taskId: string, correlationId: string, reason: string, alternative?: string): A2AEnvelope {
    return this.createEnvelope('task-reject', to, { taskId, reason, alternative }, { correlationId });
  }
}
