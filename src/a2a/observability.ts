// A2A Observability — Structured telemetry and metrics
// Sprint S2-24 | A2A Agent-to-Agent Protocols

import type { A2ALogEvent, A2AMetrics } from './types.js';
import { A2ALogEventSchema } from './schemas.js';

export type A2AObservabilityListener = (event: A2ALogEvent) => void;

/**
 * A2AObservability — tracks all A2A messaging events with structured metrics.
 */
export class A2AObservability {
  private events: A2ALogEvent[] = [];
  private maxEvents: number;
  private listeners: A2AObservabilityListener[] = [];
  private metrics: A2AMetrics = {
    messagesSent: 0,
    messagesReceived: 0,
    routingFailures: 0,
    toolInvocations: 0,
    avgRoutingLatencyMs: 0,
    channelsOpened: 0,
    channelsClosed: 0,
  };
  private latencySamples: number[] = [];

  constructor(maxEvents = 500) {
    this.maxEvents = maxEvents;
  }

  /**
   * Emit a structured event.
   */
  emit(rawEvent: Omit<A2ALogEvent, 'timestamp'> & { timestamp?: number }): void {
    const event = A2ALogEventSchema.parse({ timestamp: Date.now(), ...rawEvent });
    this.events.push(event);
    if (this.events.length > this.maxEvents) this.events.shift();

    this.updateMetrics(event);
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /**
   * Get current metrics snapshot.
   */
  getMetrics(): A2AMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent events (most recent first).
   */
  getRecentEvents(limit = 50): A2ALogEvent[] {
    return [...this.events].reverse().slice(0, limit);
  }

  /**
   * Reset metrics counters.
   */
  resetMetrics(): void {
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      routingFailures: 0,
      toolInvocations: 0,
      avgRoutingLatencyMs: 0,
      channelsOpened: 0,
      channelsClosed: 0,
    };
    this.latencySamples = [];
  }

  /**
   * Subscribe to observability events.
   */
  on(listener: A2AObservabilityListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private updateMetrics(event: A2ALogEvent): void {
    switch (event.eventType) {
      case 'message-sent':
        this.metrics.messagesSent++;
        if (event.latencyMs !== undefined) {
          this.latencySamples.push(event.latencyMs);
          this.metrics.avgRoutingLatencyMs =
            this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length;
        }
        break;
      case 'message-received':
        this.metrics.messagesReceived++;
        break;
      case 'routing-failed':
        this.metrics.routingFailures++;
        break;
      case 'tool-invoked':
        this.metrics.toolInvocations++;
        break;
      case 'channel-opened':
        this.metrics.channelsOpened++;
        break;
      case 'channel-closed':
        this.metrics.channelsClosed++;
        break;
    }
  }
}
