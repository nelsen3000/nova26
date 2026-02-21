// A2A CRDT Sync Channel — Propagates CRDT state updates between agents via A2A messaging
// Implements Requirements 9.1-9.5

import type { CRDTSyncMessage } from './types.js';
import type { A2ARouter } from './router.js';
import { EnvelopeFactory } from './envelope.js';
import { CRDTSyncMessageSchema } from './schemas.js';

export type CRDTUpdateHandler = (message: CRDTSyncMessage) => void | Promise<void>;

/**
 * CRDTSyncChannel — broadcasts CRDT updates via A2A envelopes with vector clocks.
 * Wraps updates in "stream-data" type envelopes and broadcasts to all connected agents.
 */
export class CRDTSyncChannel {
  private agentId: string;
  private router: A2ARouter;
  private factory: EnvelopeFactory;
  private vectorClock: Record<string, number> = {};
  private handlers: CRDTUpdateHandler[] = [];
  private closed = false;
  private errorLog: Array<{ sourceAgentId: string; error: string; timestamp: number }> = [];

  constructor(agentId: string, router: A2ARouter) {
    this.agentId = agentId;
    this.router = router;
    this.factory = new EnvelopeFactory(agentId);
    this.vectorClock[agentId] = 0;
  }

  /**
   * Broadcast a CRDT update to all connected agents.
   * Increments local vector clock and wraps in A2A envelope.
   */
  async broadcast(payload: unknown): Promise<void> {
    if (this.closed) throw new Error('CRDTSyncChannel is closed');

    // Increment local clock
    this.vectorClock[this.agentId] = (this.vectorClock[this.agentId] ?? 0) + 1;

    const message: CRDTSyncMessage = {
      operationId: `${this.agentId}-${this.vectorClock[this.agentId]}`,
      vectorClock: { ...this.vectorClock },
      payload,
      logName: 'crdt-sync',
      seq: this.vectorClock[this.agentId],
    };

    const envelope = this.factory.createEnvelope('stream-data', '*', message);
    await this.router.send(envelope);
  }

  /**
   * Handle an incoming CRDT update. Merges vector clock and notifies handlers.
   * Skips malformed updates with error logging (Req 9.5).
   */
  async applyUpdate(rawMessage: unknown): Promise<boolean> {
    // Validate the message
    const parsed = CRDTSyncMessageSchema.safeParse(rawMessage);
    if (!parsed.success) {
      const sourceId = (rawMessage as Record<string, unknown>)?.operationId ?? 'unknown';
      this.errorLog.push({
        sourceAgentId: String(sourceId),
        error: parsed.error.message,
        timestamp: Date.now(),
      });
      return false;
    }

    const message = parsed.data as CRDTSyncMessage;

    // Merge vector clocks — take max of each entry
    for (const [agent, clock] of Object.entries(message.vectorClock)) {
      this.vectorClock[agent] = Math.max(this.vectorClock[agent] ?? 0, clock);
    }

    // Notify handlers
    for (const handler of this.handlers) {
      await handler(message);
    }
    return true;
  }

  /**
   * Register a handler for incoming CRDT updates.
   */
  onUpdate(handler: CRDTUpdateHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  /**
   * Get the current vector clock state.
   */
  getVectorClock(): Record<string, number> {
    return { ...this.vectorClock };
  }

  /**
   * Get deserialization error log.
   */
  getErrorLog(): Array<{ sourceAgentId: string; error: string; timestamp: number }> {
    return [...this.errorLog];
  }

  /**
   * Close the sync channel.
   */
  close(): void {
    this.closed = true;
    this.handlers = [];
  }
}
