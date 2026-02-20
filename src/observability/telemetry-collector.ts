// KMS-30: Telemetry Collector
// Collect anonymous usage metrics for Nova26

// ============================================================================
// Telemetry Types
// ============================================================================

export interface TelemetryEvent {
  id: string;
  type: 'build' | 'task' | 'agent' | 'feature_flag' | 'error';
  timestamp: number;
  data: Record<string, unknown>;
}

export interface TelemetryConfig {
  enabled: boolean;
  endpoint?: string;
  batchSize: number;
  flushIntervalMs: number;
  anonymousId: string;
}

export interface BuildMetrics {
  buildId: string;
  taskCount: number;
  durationMs: number;
  success: boolean;
}

export interface AgentUsageMetrics {
  agentName: string;
  taskCount: number;
  avgDurationMs: number;
  successRate: number;
}

export interface FeatureFlagState {
  flagName: string;
  value: boolean | string | number;
}

export interface ErrorMetrics {
  errorType: string;
  count: number;
  context: string;
}

// ============================================================================
// Telemetry Collector
// ============================================================================

export class TelemetryCollector {
  private config: TelemetryConfig;
  private eventQueue: TelemetryEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private sessionStart: number = Date.now();

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      endpoint: config.endpoint,
      batchSize: config.batchSize ?? 50,
      flushIntervalMs: config.flushIntervalMs ?? 60000,
      anonymousId: config.anonymousId ?? this.generateAnonymousId(),
    };

    if (this.config.enabled) {
      this.startFlushTimer();
    }
  }

  /**
   * Generate anonymous ID for telemetry
   */
  private generateAnonymousId(): string {
    return `anon-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Check if telemetry is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable telemetry
   */
  enable(): void {
    this.config.enabled = true;
    this.startFlushTimer();
  }

  /**
   * Disable telemetry
   */
  disable(): void {
    this.config.enabled = false;
    this.stopFlushTimer();
  }

  /**
   * Record a build completion
   */
  recordBuild(metrics: BuildMetrics): void {
    if (!this.config.enabled) return;

    this.queueEvent({
      id: this.generateEventId(),
      type: 'build',
      timestamp: Date.now(),
      data: {
        ...metrics,
        anonymousId: this.config.anonymousId,
      },
    });
  }

  /**
   * Record agent usage
   */
  recordAgentUsage(metrics: AgentUsageMetrics): void {
    if (!this.config.enabled) return;

    this.queueEvent({
      id: this.generateEventId(),
      type: 'agent',
      timestamp: Date.now(),
      data: {
        ...metrics,
        anonymousId: this.config.anonymousId,
      },
    });
  }

  /**
   * Record feature flag state
   */
  recordFeatureFlag(state: FeatureFlagState): void {
    if (!this.config.enabled) return;

    this.queueEvent({
      id: this.generateEventId(),
      type: 'feature_flag',
      timestamp: Date.now(),
      data: {
        ...state,
        anonymousId: this.config.anonymousId,
      },
    });
  }

  /**
   * Record error
   */
  recordError(error: ErrorMetrics): void {
    if (!this.config.enabled) return;

    this.queueEvent({
      id: this.generateEventId(),
      type: 'error',
      timestamp: Date.now(),
      data: {
        ...error,
        anonymousId: this.config.anonymousId,
      },
    });
  }

  /**
   * Queue an event for batching
   */
  private queueEvent(event: TelemetryEvent): void {
    this.eventQueue.push(event);

    if (this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);
  }

  /**
   * Stop flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Flush events to endpoint
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    if (this.config.endpoint) {
      try {
        await this.sendToEndpoint(events);
      } catch (error) {
        // Put events back in queue on failure
        this.eventQueue.unshift(...events);
        console.warn('[Telemetry] Failed to send events:', error);
      }
    } else {
      // Log to console when no endpoint configured (dev mode)
      console.log('[Telemetry]', JSON.stringify(events));
    }
  }

  /**
   * Send events to telemetry endpoint
   */
  private async sendToEndpoint(events: TelemetryEvent[]): Promise<void> {
    if (!this.config.endpoint) return;

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telemetry-ID': this.config.anonymousId,
      },
      body: JSON.stringify({ events, sentAt: Date.now() }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.eventQueue.length;
  }

  /**
   * Get pending events
   */
  getPendingEvents(): TelemetryEvent[] {
    return [...this.eventQueue];
  }

  /**
   * Clear pending events
   */
  clearPendingEvents(): void {
    this.eventQueue = [];
  }

  /**
   * Get session duration
   */
  getSessionDurationMs(): number {
    return Date.now() - this.sessionStart;
  }

  /**
   * Get configuration
   */
  getConfig(): TelemetryConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TelemetryConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };

    if (!wasEnabled && this.config.enabled) {
      this.startFlushTimer();
    } else if (wasEnabled && !this.config.enabled) {
      this.stopFlushTimer();
    }
  }

  /**
   * Dispose collector
   */
  dispose(): void {
    this.stopFlushTimer();
    this.flush();
  }
}

// ============================================================================
// Build Complete Handler
// ============================================================================

/**
 * Create a handler for build complete events
 */
export function createBuildCompleteHandler(
  collector: TelemetryCollector
): (buildMetrics: BuildMetrics) => void {
  return (metrics) => {
    collector.recordBuild(metrics);
    // Flush on build complete
    collector.flush().catch(console.error);
  };
}

// ============================================================================
// Singleton
// ============================================================================

let globalCollector: TelemetryCollector | null = null;

export function getGlobalTelemetryCollector(): TelemetryCollector {
  if (!globalCollector) {
    globalCollector = new TelemetryCollector();
  }
  return globalCollector;
}

export function resetGlobalTelemetryCollector(): void {
  if (globalCollector) {
    globalCollector.dispose();
  }
  globalCollector = null;
}

export function setGlobalTelemetryCollector(collector: TelemetryCollector): void {
  globalCollector = collector;
}
