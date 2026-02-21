// Hypercore Observability Logger — Event tracking and metrics
// Sprint S2-09 (Spec Task 10) | P2P Hypercore Protocol (Reel 1)

import type { HypercoreLogEvent } from './types.js';
import { HypercoreLogEventSchema } from './types.js';

export interface AggregateMetrics {
  totalAppends: number;
  totalBytes: number;
  totalReplicationEvents: number;
  totalErrors: number;
  avgBytesPerAppend: number;
  errorRate: number;
  logMetrics: Record<string, { appends: number; bytes: number }>;
}

export interface HealthStatus {
  healthy: boolean;
  errorCount: number;
  windowMs: number;
  threshold: number;
  warnings: string[];
}

export type ObservabilityEventListener = (event: HypercoreLogEvent) => void;

/**
 * ObservabilityLogger — subscribes to Hypercore events and tracks structured metrics.
 */
export class ObservabilityLogger {
  private events: HypercoreLogEvent[] = [];
  private metrics: AggregateMetrics = {
    totalAppends: 0,
    totalBytes: 0,
    totalReplicationEvents: 0,
    totalErrors: 0,
    avgBytesPerAppend: 0,
    errorRate: 0,
    logMetrics: {},
  };
  private errorWindowEvents: number[] = []; // timestamps of recent errors
  private listeners: ObservabilityEventListener[] = [];
  private maxEvents: number;
  private errorThreshold: number;
  private errorWindowMs: number;

  constructor(
    maxEvents = 1000,
    errorThreshold = 10,
    errorWindowMs = 60_000,
  ) {
    this.maxEvents = maxEvents;
    this.errorThreshold = errorThreshold;
    this.errorWindowMs = errorWindowMs;
  }

  /**
   * Record a Hypercore event.
   */
  record(rawEvent: Omit<HypercoreLogEvent, 'timestamp'> & { timestamp?: number }): void {
    const event = HypercoreLogEventSchema.parse({ timestamp: Date.now(), ...rawEvent });

    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    this.updateMetrics(event);

    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /**
   * Get current aggregate metrics.
   */
  getMetrics(): AggregateMetrics {
    return { ...this.metrics };
  }

  /**
   * Get health status based on error threshold.
   */
  getHealth(): HealthStatus {
    const now = Date.now();
    // Prune old error events
    this.errorWindowEvents = this.errorWindowEvents.filter(t => now - t < this.errorWindowMs);

    const recentErrors = this.errorWindowEvents.length;
    const healthy = recentErrors < this.errorThreshold;
    const warnings: string[] = [];

    if (!healthy) {
      warnings.push(`Error count ${recentErrors} exceeds threshold ${this.errorThreshold} in ${this.errorWindowMs}ms window`);
    }

    return {
      healthy,
      errorCount: recentErrors,
      windowMs: this.errorWindowMs,
      threshold: this.errorThreshold,
      warnings,
    };
  }

  /**
   * Get recent events (most recent first).
   */
  getRecentEvents(limit = 50): HypercoreLogEvent[] {
    return [...this.events].reverse().slice(0, limit);
  }

  /**
   * Subscribe to observability events.
   */
  on(listener: ObservabilityEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Reset metrics (for testing).
   */
  reset(): void {
    this.events = [];
    this.errorWindowEvents = [];
    this.metrics = {
      totalAppends: 0,
      totalBytes: 0,
      totalReplicationEvents: 0,
      totalErrors: 0,
      avgBytesPerAppend: 0,
      errorRate: 0,
      logMetrics: {},
    };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private updateMetrics(event: HypercoreLogEvent): void {
    switch (event.eventType) {
      case 'append': {
        this.metrics.totalAppends++;
        const bytes = event.bytes ?? 0;
        this.metrics.totalBytes += bytes;
        this.metrics.avgBytesPerAppend =
          this.metrics.totalAppends > 0 ? this.metrics.totalBytes / this.metrics.totalAppends : 0;

        const logStats = this.metrics.logMetrics[event.logName] ?? { appends: 0, bytes: 0 };
        logStats.appends++;
        logStats.bytes += bytes;
        this.metrics.logMetrics[event.logName] = logStats;
        break;
      }
      case 'replicate': {
        this.metrics.totalReplicationEvents++;
        break;
      }
      case 'error': {
        this.metrics.totalErrors++;
        this.errorWindowEvents.push(event.timestamp);
        const total = this.metrics.totalAppends + this.metrics.totalErrors;
        this.metrics.errorRate = total > 0 ? this.metrics.totalErrors / total : 0;
        break;
      }
    }
  }
}
