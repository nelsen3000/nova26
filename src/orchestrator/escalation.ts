// Escalation System — R20-01
// Layer-to-layer escalation, human-required detection

import type {
  EscalationEvent,
  EscalationPolicy,
  OrchestratorHierarchyConfig,
} from './hierarchy-types.js';

export interface EscalationHandler {
  onEscalation(event: EscalationEvent): Promise<void>;
  onHumanRequired(event: EscalationEvent): Promise<void>;
}

export class EscalationManager {
  private policy: EscalationPolicy;
  private handler: EscalationHandler;
  private history: EscalationEvent[] = [];
  private escalatedTasks: Set<string> = new Set();

  constructor(policy: EscalationPolicy, handler: EscalationHandler) {
    this.policy = policy;
    this.handler = handler;
  }

  /**
   * Evaluate if escalation is needed based on error and retry count
   */
  async evaluateEscalation(
    layer: 0 | 1 | 2 | 3,
    taskId: string,
    error: string,
    retryCount: number,
    context?: Record<string, unknown>
  ): Promise<EscalationEvent | null> {
    // Check if already escalated
    if (this.escalatedTasks.has(taskId)) {
      return null;
    }

    // Check escalation triggers
    const shouldEscalate = this.shouldEscalate(layer, error, retryCount);
    
    if (!shouldEscalate) {
      return null;
    }

    const requiresHuman = this.requiresHumanIntervention(layer, error, retryCount);
    const suggestedNextLayer = this.determineNextLayer(layer, error);

    const event: EscalationEvent = {
      layer,
      taskId,
      error,
      retryCount,
      suggestedNextLayer,
      requiresHuman,
      context: context ?? {},
      timestamp: Date.now(),
    };

    // Record escalation
    this.history.push(event);
    this.escalatedTasks.add(taskId);

    // Handle escalation
    await this.handler.onEscalation(event);

    if (requiresHuman) {
      await this.handler.onHumanRequired(event);
    }

    return event;
  }

  /**
   * Escalate from current layer to next layer
   */
  async escalate(event: EscalationEvent): Promise<boolean> {
    if (event.suggestedNextLayer < 0 || event.suggestedNextLayer > 3) {
      return false;
    }

    // Update the escalation record
    const updatedEvent: EscalationEvent = {
      ...event,
      timestamp: Date.now(),
    };

    await this.handler.onEscalation(updatedEvent);
    return true;
  }

  /**
   * Check if a task can be retried at current layer
   */
  canRetryAtCurrentLayer(_layer: number, retryCount: number): boolean {
    if (this.policy.mode === 'manual') {
      return false; // Manual mode requires explicit escalation
    }

    if (this.policy.mode === 'threshold-based') {
      return retryCount < this.policy.thresholds.maxRetriesPerLayer;
    }

    // Auto mode - allow retries up to threshold
    return retryCount < this.policy.thresholds.maxRetriesPerLayer;
  }

  /**
   * Determine if human intervention is required
   */
  requiresHumanIntervention(layer: number, error: string, retryCount: number): boolean {
    // Always require human for L0 escalations
    if (layer === 0) return true;

    // Require human after max retries
    if (retryCount >= this.policy.thresholds.maxRetriesPerLayer * 2) {
      return true;
    }

    // Require human for specific error types
    const humanRequiredErrors = [
      'permission_denied',
      'unauthorized',
      'security_violation',
      'cost_limit_exceeded',
    ];

    if (humanRequiredErrors.some(e => error.toLowerCase().includes(e))) {
      return true;
    }

    return false;
  }

  /**
   * Get escalation history
   */
  getHistory(filters?: {
    layer?: number;
    taskId?: string;
    requiresHuman?: boolean;
  }): EscalationEvent[] {
    let filtered = this.history;

    if (filters?.layer !== undefined) {
      filtered = filtered.filter(e => e.layer === filters.layer);
    }

    if (filters?.taskId) {
      filtered = filtered.filter(e => e.taskId === filters.taskId);
    }

    if (filters?.requiresHuman !== undefined) {
      filtered = filtered.filter(e => e.requiresHuman === filters.requiresHuman);
    }

    return filtered;
  }

  /**
   * Get escalation statistics
   */
  getStatistics(): {
    totalEscalations: number;
    byLayer: Record<number, number>;
    humanRequiredCount: number;
    averageRetries: number;
  } {
    const byLayer: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    let humanRequiredCount = 0;
    let totalRetries = 0;

    for (const event of this.history) {
      byLayer[event.layer]++;
      if (event.requiresHuman) humanRequiredCount++;
      totalRetries += event.retryCount;
    }

    return {
      totalEscalations: this.history.length,
      byLayer,
      humanRequiredCount,
      averageRetries: this.history.length > 0 ? totalRetries / this.history.length : 0,
    };
  }

  /**
   * Clear escalation history
   */
  clearHistory(): void {
    this.history = [];
    this.escalatedTasks.clear();
  }

  /**
   * Check if a task has been escalated
   */
  isEscalated(taskId: string): boolean {
    return this.escalatedTasks.has(taskId);
  }

  private shouldEscalate(layer: number, error: string, retryCount: number): boolean {
    // Check auto-escalate triggers
    for (const trigger of this.policy.autoEscalateOn) {
      switch (trigger) {
        case 'timeout':
          if (error.toLowerCase().includes('timeout')) return true;
          break;
        case 'failure':
          if (retryCount >= this.policy.thresholds.maxRetriesPerLayer) return true;
          break;
        case 'low-confidence':
          if (error.toLowerCase().includes('confidence')) return true;
          break;
      }
    }

    // Always escalate from L3 failures (no lower layer)
    if (layer === 3 && retryCount >= this.policy.thresholds.maxRetriesPerLayer) {
      return true;
    }

    return false;
  }

  private determineNextLayer(currentLayer: number, _error: string): number {
    // L3 failures escalate up to human (represented as -1 or to L0)
    if (currentLayer === 3) {
      return -1; // Signal for human intervention
    }

    // L0 failures may need human intervention
    if (currentLayer === 0) {
      return -1;
    }

    // Default: escalate to previous layer (higher level = lower number)
    return currentLayer - 1;
  }
}

// Default escalation handler that logs events
export class DefaultEscalationHandler implements EscalationHandler {
  private events: EscalationEvent[] = [];

  async onEscalation(event: EscalationEvent): Promise<void> {
    this.events.push(event);
    console.log(`[ESCALATION] Layer ${event.layer} -> ${event.suggestedNextLayer}: ${event.error}`);
  }

  async onHumanRequired(event: EscalationEvent): Promise<void> {
    console.log(`[HUMAN REQUIRED] Task ${event.taskId}: ${event.error}`);
  }

  getEvents(): EscalationEvent[] {
    return this.events;
  }
}

export function createEscalationManager(
  config: OrchestratorHierarchyConfig,
  handler?: EscalationHandler
): EscalationManager {
  const policy: EscalationPolicy = {
    mode: config.escalationPolicy as 'auto' | 'manual' | 'threshold-based',
    thresholds: {
      maxRetriesPerLayer: config.defaultMaxRetries,
      confidenceThreshold: 0.7,
      successRateThreshold: 0.5,
    },
    autoEscalateOn: ['timeout', 'failure'],
  };

  return new EscalationManager(
    policy,
    handler ?? new DefaultEscalationHandler()
  );
}
