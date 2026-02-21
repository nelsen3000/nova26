// MX-05: Handoff Context Builder
// Assembles a HandoffPayload from all active modules for agent-to-agent handoffs

import type { HandoffContext } from './lifecycle-hooks.js';
// ============================================================================
// Handoff Payload Types
// ============================================================================

export interface ModelRoutingState {
  selectedModelId: string;
  routingReason: string;
  affinityScores: Record<string, number>;
}

export interface MemoryState {
  recentNodeIds: string[];
  contextSummary: string;
  tasteScore: number;
}

export interface WorkflowState {
  currentNodeId: string;
  completedNodeIds: string[];
  pendingNodeIds: string[];
  criticalPathPosition: number;
}

export interface CollaborationState {
  sessionId: string;
  documentVersion: number;
  participantCount: number;
}

export interface ObservabilityState {
  parentSpanId: string;
  traceId: string;
  buildSpanId: string;
}

export interface HandoffPayload {
  fromAgent: string;
  toAgent: string;
  taskId: string;
  buildId: string;
  timestamp: number;

  // Module states (optional — only present if module is enabled)
  modelRouting?: ModelRoutingState;
  memory?: MemoryState;
  workflow?: WorkflowState;
  collaboration?: CollaborationState;
  observability?: ObservabilityState;

  // Task context
  taskOutput?: string;
  taskDurationMs?: number;
  aceScore?: number;

  // Custom data
  metadata: Record<string, unknown>;
}

// ============================================================================
// Module State Collectors
// ============================================================================

export type ModuleStateCollector<T> = (
  fromAgent: string,
  toAgent: string,
  taskId: string,
  buildId: string
) => T | null;

interface RegisteredCollector {
  moduleName: string;
  key: string;
  collector: ModuleStateCollector<unknown>;
}

// ============================================================================
// Handoff Context Builder
// ============================================================================

export class HandoffContextBuilder {
  private collectors: RegisteredCollector[] = [];

  /**
   * Register a module state collector.
   * The collector function is called during handoff to gather the module's current state.
   */
  registerCollector<T>(
    moduleName: string,
    key: string,
    collector: ModuleStateCollector<T>
  ): void {
    this.collectors.push({
      moduleName,
      key,
      collector: collector as ModuleStateCollector<unknown>,
    });
  }

  /**
   * Unregister a module's collector.
   */
  unregisterCollector(moduleName: string): boolean {
    const before = this.collectors.length;
    this.collectors = this.collectors.filter(c => c.moduleName !== moduleName);
    return this.collectors.length < before;
  }

  /**
   * Build a HandoffPayload by collecting state from all registered modules.
   */
  buildPayload(params: {
    fromAgent: string;
    toAgent: string;
    taskId: string;
    buildId: string;
    taskOutput?: string;
    taskDurationMs?: number;
    aceScore?: number;
    metadata?: Record<string, unknown>;
  }): HandoffPayload {
    const payload: HandoffPayload = {
      fromAgent: params.fromAgent,
      toAgent: params.toAgent,
      taskId: params.taskId,
      buildId: params.buildId,
      timestamp: Date.now(),
      taskOutput: params.taskOutput,
      taskDurationMs: params.taskDurationMs,
      aceScore: params.aceScore,
      metadata: params.metadata ?? {},
    };

    // Collect state from each registered module
    for (const { moduleName, key, collector } of this.collectors) {
      try {
        const state = collector(
          params.fromAgent,
          params.toAgent,
          params.taskId,
          params.buildId
        );

        if (state !== null) {
          (payload as unknown as Record<string, unknown>)[key] = state;
        }
      } catch (error) {
        console.error(
          `[HandoffContext] Failed to collect state from ${moduleName}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    return payload;
  }

  /**
   * Build a HandoffPayload and convert to HandoffContext for the lifecycle hooks.
   */
  buildLifecycleContext(params: {
    fromAgent: string;
    toAgent: string;
    taskId: string;
    buildId: string;
    taskOutput?: string;
    taskDurationMs?: number;
    aceScore?: number;
    metadata?: Record<string, unknown>;
  }): HandoffContext {
    const payload = this.buildPayload(params);

    return {
      fromAgent: payload.fromAgent,
      toAgent: payload.toAgent,
      taskId: payload.taskId,
      payload: payload as unknown as Record<string, unknown>,
    };
  }

  /**
   * Get list of registered module collectors.
   */
  getRegisteredModules(): string[] {
    return this.collectors.map(c => c.moduleName);
  }

  /**
   * Clear all registered collectors.
   */
  clear(): void {
    this.collectors = [];
  }
}

// ============================================================================
// Singleton
// ============================================================================

let globalBuilder: HandoffContextBuilder | null = null;

export function getHandoffContextBuilder(): HandoffContextBuilder {
  if (!globalBuilder) {
    globalBuilder = new HandoffContextBuilder();
  }
  return globalBuilder;
}

export function resetHandoffContextBuilder(): void {
  if (globalBuilder) {
    globalBuilder.clear();
  }
  globalBuilder = null;
}
