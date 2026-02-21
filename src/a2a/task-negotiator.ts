// A2A Task Negotiator — Proposal/accept/reject flows with timeout handling
// Implements Requirements 7.1-7.5

import { randomUUID } from 'crypto';
import type { A2AEnvelope, TaskProposal } from './types.js';
import { EnvelopeFactory } from './envelope.js';
import type { A2ARouter } from './router.js';

export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'timed-out';

export interface NegotiationRecord {
  proposalId: string;
  correlationId: string;
  proposal: TaskProposal;
  status: ProposalStatus;
  proposerAgentId: string;
  targetAgentId: string;
  acceptedBy?: string;
  estimatedCompletionMs?: number;
  rejectionReason?: string;
  alternativeSuggestion?: string;
  createdAt: number;
  resolvedAt?: number;
}

export type ProposalHandler = (record: NegotiationRecord) => void | Promise<void>;

/**
 * TaskNegotiator — manages task proposal/accept/reject flows via A2A messaging.
 * Tracks proposal state, deadlines, and correlation threads.
 */
export class TaskNegotiator {
  private records = new Map<string, NegotiationRecord>();
  private router: A2ARouter;
  private agentId: string;
  private factory: EnvelopeFactory;
  private proposalHandlers: ProposalHandler[] = [];
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(agentId: string, router: A2ARouter) {
    this.agentId = agentId;
    this.router = router;
    this.factory = new EnvelopeFactory(agentId);
  }

  /**
   * Propose a task to a target agent. Creates a correlation thread and starts deadline timer.
   */
  async propose(
    targetAgentId: string,
    proposal: TaskProposal,
    deadlineMs = 30000,
  ): Promise<NegotiationRecord> {
    const proposalId = randomUUID();
    const correlationId = randomUUID();

    const record: NegotiationRecord = {
      proposalId,
      correlationId,
      proposal,
      status: 'pending',
      proposerAgentId: this.agentId,
      targetAgentId,
      createdAt: Date.now(),
    };
    this.records.set(proposalId, record);

    // Send task-proposal envelope
    const envelope = this.factory.createEnvelope('task-proposal', targetAgentId, {
      proposalId,
      ...proposal,
      deadlineMs,
    }, { correlationId });
    await this.router.send(envelope);

    // Start deadline timer
    const timer = setTimeout(() => {
      const r = this.records.get(proposalId);
      if (r && r.status === 'pending') {
        r.status = 'timed-out';
        r.resolvedAt = Date.now();
      }
      this.timers.delete(proposalId);
    }, deadlineMs);
    this.timers.set(proposalId, timer);

    return record;
  }

  /**
   * Accept a received proposal. Sends task-accept response with estimated completion time.
   */
  async accept(proposalId: string, estimatedCompletionMs?: number): Promise<void> {
    const record = this.records.get(proposalId);
    if (!record) throw new Error(`Proposal "${proposalId}" not found`);
    if (record.status !== 'pending') throw new Error(`Proposal "${proposalId}" is already ${record.status}`);

    record.status = 'accepted';
    record.acceptedBy = this.agentId;
    record.estimatedCompletionMs = estimatedCompletionMs;
    record.resolvedAt = Date.now();
    this.clearTimer(proposalId);

    const envelope = this.factory.createEnvelope('task-accept', record.proposerAgentId, {
      proposalId,
      acceptedBy: this.agentId,
      estimatedCompletionMs,
    }, { correlationId: record.correlationId });
    await this.router.send(envelope);
  }

  /**
   * Reject a received proposal with a reason and optional alternative suggestion.
   */
  async reject(proposalId: string, reason: string, alternative?: string): Promise<void> {
    const record = this.records.get(proposalId);
    if (!record) throw new Error(`Proposal "${proposalId}" not found`);
    if (record.status !== 'pending') throw new Error(`Proposal "${proposalId}" is already ${record.status}`);

    record.status = 'rejected';
    record.rejectionReason = reason;
    record.alternativeSuggestion = alternative;
    record.resolvedAt = Date.now();
    this.clearTimer(proposalId);

    const envelope = this.factory.createEnvelope('task-reject', record.proposerAgentId, {
      proposalId,
      reason,
      alternative,
    }, { correlationId: record.correlationId });
    await this.router.send(envelope);
  }

  /**
   * Handle an incoming proposal envelope — stores it and notifies handlers.
   */
  async handleIncomingProposal(envelope: A2AEnvelope): Promise<NegotiationRecord> {
    const payload = envelope.payload as {
      proposalId: string;
      deadlineMs?: number;
    } & TaskProposal;

    const record: NegotiationRecord = {
      proposalId: payload.proposalId,
      correlationId: envelope.correlationId ?? randomUUID(),
      proposal: {
        taskId: payload.taskId,
        description: payload.description,
        requiredCapabilities: payload.requiredCapabilities,
        complexity: payload.complexity,
        deadline: payload.deadline,
        proposedBy: payload.proposedBy,
      },
      status: 'pending',
      proposerAgentId: envelope.from,
      targetAgentId: this.agentId,
      createdAt: Date.now(),
    };
    this.records.set(record.proposalId, record);

    // Start deadline timer if provided
    if (payload.deadlineMs) {
      const timer = setTimeout(() => {
        const r = this.records.get(record.proposalId);
        if (r && r.status === 'pending') {
          r.status = 'timed-out';
          r.resolvedAt = Date.now();
        }
        this.timers.delete(record.proposalId);
      }, payload.deadlineMs);
      this.timers.set(record.proposalId, timer);
    }

    for (const handler of this.proposalHandlers) {
      await handler(record);
    }
    return record;
  }

  /**
   * Register a handler for incoming proposals.
   */
  onProposalReceived(handler: ProposalHandler): () => void {
    this.proposalHandlers.push(handler);
    return () => {
      this.proposalHandlers = this.proposalHandlers.filter(h => h !== handler);
    };
  }

  getProposal(proposalId: string): NegotiationRecord | undefined {
    return this.records.get(proposalId);
  }

  listPending(): NegotiationRecord[] {
    return [...this.records.values()].filter(r => r.status === 'pending');
  }

  listAll(): NegotiationRecord[] {
    return [...this.records.values()];
  }

  /**
   * Get all records sharing a correlation ID (the negotiation thread).
   */
  getThread(correlationId: string): NegotiationRecord[] {
    return [...this.records.values()]
      .filter(r => r.correlationId === correlationId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Clean up all timers.
   */
  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  private clearTimer(proposalId: string): void {
    const timer = this.timers.get(proposalId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(proposalId);
    }
  }
}
