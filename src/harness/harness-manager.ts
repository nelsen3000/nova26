// Harness Manager Registry - K3-25
// Singleton registry for creating and tracking AgentHarness instances
// Spec: .kiro/specs/agent-harnesses/tasks.md

import { AgentHarness, createAgentHarness } from './engine.js';
import type { HarnessConfig, HarnessState, HarnessStatus } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Harness Manager
// ═══════════════════════════════════════════════════════════════════════════════

export class HarnessManager {
  private registry = new Map<string, AgentHarness>();
  private idCounter = 0;

  /**
   * Create a new harness and register it.
   */
  create(config: HarnessConfig): AgentHarness {
    if (this.registry.has(config.id)) {
      throw new Error(`Harness with id "${config.id}" already exists`);
    }
    const harness = createAgentHarness(config);
    this.registry.set(config.id, harness);
    return harness;
  }

  /**
   * Create a harness with an auto-generated unique ID.
   */
  createWithAutoId(config: Omit<HarnessConfig, 'id'>): AgentHarness {
    const id = `harness-${Date.now()}-${++this.idCounter}`;
    return this.create({ ...config, id } as HarnessConfig);
  }

  /**
   * Get a harness by ID. Returns undefined if not found.
   */
  get(id: string): AgentHarness | undefined {
    return this.registry.get(id);
  }

  /**
   * Get a harness by ID, throws if not found.
   */
  getOrThrow(id: string): AgentHarness {
    const harness = this.registry.get(id);
    if (!harness) throw new Error(`Harness "${id}" not found`);
    return harness;
  }

  /**
   * List all registered harness infos.
   */
  list(): Array<{ id: string; status: HarnessStatus; name: string }> {
    const result: Array<{ id: string; status: HarnessStatus; name: string }> = [];
    for (const [id, harness] of this.registry) {
      const state = harness.getState();
      result.push({ id, status: state.status, name: state.config.name });
    }
    return result;
  }

  /**
   * Stop a harness by ID.
   */
  async stop(id: string, reason?: string): Promise<void> {
    const harness = this.getOrThrow(id);
    const state = harness.getState();
    const finalStates: HarnessStatus[] = ['stopped', 'completed', 'failed'];
    if (!finalStates.includes(state.status)) {
      await harness.stop(reason);
    }
  }

  /**
   * Restore a harness from a previously saved state.
   */
  resumeFromCheckpoint(checkpointState: HarnessState): AgentHarness {
    const id = checkpointState.config.id;

    // Remove existing if present
    if (this.registry.has(id)) {
      this.registry.delete(id);
    }

    const harness = createAgentHarness(checkpointState.config);
    harness.restoreCheckpoint(checkpointState);
    this.registry.set(id, harness);
    return harness;
  }

  /**
   * Deregister a harness (does not stop it).
   */
  remove(id: string): boolean {
    return this.registry.delete(id);
  }

  /**
   * Count registered harnesses.
   */
  count(): number {
    return this.registry.size;
  }

  /**
   * Clear all harnesses from the registry.
   */
  clear(): void {
    this.registry.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton
// ═══════════════════════════════════════════════════════════════════════════════

let _instance: HarnessManager | undefined;

export function getHarnessManager(): HarnessManager {
  if (!_instance) {
    _instance = new HarnessManager();
  }
  return _instance;
}

/** Reset the singleton (for testing). */
export function resetHarnessManager(): void {
  _instance = undefined;
}

export function createHarnessManager(): HarnessManager {
  return new HarnessManager();
}
