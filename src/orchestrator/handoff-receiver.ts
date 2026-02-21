// MX-06: Handoff Receiver
// Unpacks a HandoffPayload and initializes the receiving agent's module state

import type {
  HandoffPayload,
  ModelRoutingState,
  MemoryState,
  WorkflowState,
  CollaborationState,
  ObservabilityState,
} from './handoff-context.js';

// ============================================================================
// Receiver Types
// ============================================================================

export interface ReceivedHandoffState {
  fromAgent: string;
  toAgent: string;
  taskId: string;
  buildId: string;
  timestamp: number;

  // Extracted module states
  modelRouting: ModelRoutingState | null;
  memory: MemoryState | null;
  workflow: WorkflowState | null;
  collaboration: CollaborationState | null;
  observability: ObservabilityState | null;

  // Task context
  taskOutput: string | null;
  taskDurationMs: number | null;
  aceScore: number | null;

  // Custom data
  metadata: Record<string, unknown>;
}

export type ModuleStateRestorer<T> = (
  state: T,
  receivingAgent: string,
  buildId: string
) => void | Promise<void>;

interface RegisteredRestorer {
  moduleName: string;
  key: string;
  restorer: ModuleStateRestorer<unknown>;
}

// ============================================================================
// Handoff Receiver
// ============================================================================

export class HandoffReceiver {
  private restorers: RegisteredRestorer[] = [];

  /**
   * Register a module state restorer.
   * Called during handoff reception to restore the module's state for the new agent.
   */
  registerRestorer<T>(
    moduleName: string,
    key: string,
    restorer: ModuleStateRestorer<T>
  ): void {
    this.restorers.push({
      moduleName,
      key,
      restorer: restorer as ModuleStateRestorer<unknown>,
    });
  }

  /**
   * Unregister a module's restorer.
   */
  unregisterRestorer(moduleName: string): boolean {
    const before = this.restorers.length;
    this.restorers = this.restorers.filter(r => r.moduleName !== moduleName);
    return this.restorers.length < before;
  }

  /**
   * Extract structured state from a HandoffPayload.
   */
  extractState(payload: HandoffPayload): ReceivedHandoffState {
    return {
      fromAgent: payload.fromAgent,
      toAgent: payload.toAgent,
      taskId: payload.taskId,
      buildId: payload.buildId,
      timestamp: payload.timestamp,

      modelRouting: payload.modelRouting ?? null,
      memory: payload.memory ?? null,
      workflow: payload.workflow ?? null,
      collaboration: payload.collaboration ?? null,
      observability: payload.observability ?? null,

      taskOutput: payload.taskOutput ?? null,
      taskDurationMs: payload.taskDurationMs ?? null,
      aceScore: payload.aceScore ?? null,

      metadata: payload.metadata,
    };
  }

  /**
   * Receive a HandoffPayload: extract state, run all restorers, return extracted state.
   */
  async receive(payload: HandoffPayload): Promise<{
    state: ReceivedHandoffState;
    restoredModules: string[];
    errors: Array<{ module: string; error: string }>;
  }> {
    const state = this.extractState(payload);
    const restoredModules: string[] = [];
    const errors: Array<{ module: string; error: string }> = [];

    for (const { moduleName, key, restorer } of this.restorers) {
      const moduleState = (payload as unknown as Record<string, unknown>)[key];
      if (moduleState === undefined || moduleState === null) continue;

      try {
        await restorer(moduleState, payload.toAgent, payload.buildId);
        restoredModules.push(moduleName);
      } catch (error) {
        errors.push({
          module: moduleName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { state, restoredModules, errors };
  }

  /**
   * Get list of registered module restorers.
   */
  getRegisteredModules(): string[] {
    return this.restorers.map(r => r.moduleName);
  }

  /**
   * Clear all registered restorers.
   */
  clear(): void {
    this.restorers = [];
  }
}

// ============================================================================
// Singleton
// ============================================================================

let globalReceiver: HandoffReceiver | null = null;

export function getHandoffReceiver(): HandoffReceiver {
  if (!globalReceiver) {
    globalReceiver = new HandoffReceiver();
  }
  return globalReceiver;
}

export function resetHandoffReceiver(): void {
  if (globalReceiver) {
    globalReceiver.clear();
  }
  globalReceiver = null;
}
