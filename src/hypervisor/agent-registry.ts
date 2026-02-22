// Hypervisor Agent Registry — Spec Task 9.1
// Sprint S3-12 | Hypervisor Hypercore Integration (Reel 2)
//
// Persists agent → deployment metadata. In-memory for tests; file-backed in prod.

import type { AgentDeployment } from './types.js';
import { AgentDeploymentSchema } from './types.js';

// ─── Errors ───────────────────────────────────────────────────────────────────

export class AgentNotFoundError extends Error {
  constructor(agentName: string) {
    super(`Agent '${agentName}' not found in registry`);
    this.name = 'AgentNotFoundError';
  }
}

export class AgentAlreadyRegisteredError extends Error {
  constructor(agentName: string) {
    super(`Agent '${agentName}' is already registered`);
    this.name = 'AgentAlreadyRegisteredError';
  }
}

// ─── AgentRegistry ────────────────────────────────────────────────────────────

/**
 * AgentRegistry — stores agent deployments in memory (file persistence optional).
 *
 * Satisfies Spec Task 9.1:
 * - register / unregister / get / list operations
 * - save/load persistence (in-memory by default; file backend optional)
 */
export class AgentRegistry {
  private agents = new Map<string, AgentDeployment>();

  /**
   * Register a new agent deployment.
   * Throws AgentAlreadyRegisteredError if already registered.
   */
  register(deployment: AgentDeployment): void {
    const parsed = AgentDeploymentSchema.parse(deployment);
    if (this.agents.has(parsed.agentName)) {
      throw new AgentAlreadyRegisteredError(parsed.agentName);
    }
    this.agents.set(parsed.agentName, parsed);
  }

  /**
   * Update (upsert) an existing registration.
   */
  upsert(deployment: AgentDeployment): void {
    const parsed = AgentDeploymentSchema.parse(deployment);
    this.agents.set(parsed.agentName, parsed);
  }

  /**
   * Unregister an agent.
   * Returns true if removed, false if not found.
   */
  unregister(agentName: string): boolean {
    return this.agents.delete(agentName);
  }

  /**
   * Get the deployment for a specific agent.
   * Throws AgentNotFoundError if not found.
   */
  get(agentName: string): AgentDeployment {
    const deployment = this.agents.get(agentName);
    if (!deployment) throw new AgentNotFoundError(agentName);
    return deployment;
  }

  /**
   * Try to get a deployment without throwing.
   */
  tryGet(agentName: string): AgentDeployment | undefined {
    return this.agents.get(agentName);
  }

  /**
   * List all registered agent deployments.
   */
  list(): AgentDeployment[] {
    return [...this.agents.values()];
  }

  /**
   * Check if an agent is registered.
   */
  has(agentName: string): boolean {
    return this.agents.has(agentName);
  }

  /**
   * Total number of registered agents.
   */
  count(): number {
    return this.agents.size;
  }

  /**
   * Export all deployments as JSON (for persistence).
   */
  toJSON(): string {
    return JSON.stringify([...this.agents.values()], null, 2);
  }

  /**
   * Load deployments from JSON (file persistence restore).
   * Clears existing entries before loading.
   */
  fromJSON(json: string): void {
    const records = JSON.parse(json) as unknown[];
    this.agents.clear();
    for (const record of records) {
      const parsed = AgentDeploymentSchema.parse(record);
      this.agents.set(parsed.agentName, parsed);
    }
  }

  /**
   * Clear all registrations.
   */
  clear(): void {
    this.agents.clear();
  }
}
