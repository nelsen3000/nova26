// A2A Channel and ChannelManager — In-memory local channels with ordering and retry
// Sprint S2-22 | A2A Agent-to-Agent Protocols

import type { A2AEnvelope, ChannelStatus } from './types.js';

export type ChannelMessageHandler = (envelope: A2AEnvelope) => Promise<void> | void;

export interface ChannelOptions {
  maxRetries?: number;
  retryBaseMs?: number;
  maxQueueSize?: number;
}

/**
 * A2AChannel — in-memory, zero-copy message passing between agents.
 * State machine: connecting → open → closed, with reconnecting on failure.
 * Guarantees message ordering within a channel.
 */
export class A2AChannel {
  readonly fromAgentId: string;
  readonly toAgentId: string;
  private status: ChannelStatus = 'connecting';
  private queue: A2AEnvelope[] = [];
  private handlers: ChannelMessageHandler[] = [];
  private maxRetries: number;
  private retryBaseMs: number;
  private maxQueueSize: number;

  constructor(fromAgentId: string, toAgentId: string, options: ChannelOptions = {}) {
    this.fromAgentId = fromAgentId;
    this.toAgentId = toAgentId;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryBaseMs = options.retryBaseMs ?? 100;
    this.maxQueueSize = options.maxQueueSize ?? 1000;
    // Auto-transition to open after microtask
    Promise.resolve().then(() => { this.status = 'open'; });
  }

  get channelStatus(): ChannelStatus {
    return this.status;
  }

  /**
   * Send an envelope through the channel with retry on failure.
   */
  async send(envelope: A2AEnvelope): Promise<void> {
    if (this.status === 'closed') {
      throw new Error(`Channel ${this.fromAgentId} → ${this.toAgentId} is closed`);
    }
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error(`Channel queue full (max ${this.maxQueueSize})`);
    }

    this.queue.push(envelope);

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      try {
        await this.deliverToHandlers(envelope);
        return;
      } catch (err) {
        attempt++;
        if (attempt > this.maxRetries) {
          this.status = 'reconnecting';
          await new Promise(resolve => setTimeout(resolve, this.retryBaseMs));
          this.status = 'open';
          throw err;
        }
        await new Promise(resolve => setTimeout(resolve, this.retryBaseMs * Math.pow(2, attempt - 1)));
      }
    }
  }

  /**
   * Drain queued messages to handlers (preserving order).
   */
  async drain(): Promise<void> {
    const toDeliver = [...this.queue];
    this.queue = [];
    for (const envelope of toDeliver) {
      await this.deliverToHandlers(envelope);
    }
  }

  /**
   * Register a message handler.
   */
  onMessage(handler: ChannelMessageHandler): () => void {
    this.handlers.push(handler);
    return () => { this.handlers = this.handlers.filter(h => h !== handler); };
  }

  /**
   * Close the channel.
   */
  close(): void {
    this.status = 'closed';
    this.queue = [];
    this.handlers = [];
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  private async deliverToHandlers(envelope: A2AEnvelope): Promise<void> {
    for (const handler of this.handlers) {
      await handler(envelope);
    }
  }
}

/**
 * ChannelManager — manages a pool of A2AChannels.
 */
export class ChannelManager {
  private channels = new Map<string, A2AChannel>();

  private channelKey(from: string, to: string): string {
    return `${from}→${to}`;
  }

  /**
   * Open (or return existing) channel between two agents.
   */
  openChannel(fromAgentId: string, toAgentId: string, options?: ChannelOptions): A2AChannel {
    const key = this.channelKey(fromAgentId, toAgentId);
    if (!this.channels.has(key)) {
      this.channels.set(key, new A2AChannel(fromAgentId, toAgentId, options));
    }
    return this.channels.get(key)!;
  }

  /**
   * Get an existing channel (or undefined).
   */
  getChannel(fromAgentId: string, toAgentId: string): A2AChannel | undefined {
    return this.channels.get(this.channelKey(fromAgentId, toAgentId));
  }

  /**
   * List all open channels.
   */
  listChannels(): A2AChannel[] {
    return [...this.channels.values()];
  }

  /**
   * Close all channels.
   */
  closeAll(): void {
    for (const channel of this.channels.values()) {
      channel.close();
    }
    this.channels.clear();
  }

  /**
   * Close a specific channel.
   */
  closeChannel(fromAgentId: string, toAgentId: string): void {
    const key = this.channelKey(fromAgentId, toAgentId);
    this.channels.get(key)?.close();
    this.channels.delete(key);
  }
}
