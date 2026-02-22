// Hypervisor Moltbot Deployer — Spec Task 9.2
// Sprint S3-12 | Hypervisor Hypercore Integration (Reel 2)
//
// Deploys Moltbot agents into sandboxed VMs via the SandboxManager.

import { randomUUID } from 'crypto';
import type { VMSpec, AgentDeployment } from './types.js';
import { AgentDeploymentSchema } from './types.js';
import { AgentRegistry, AgentNotFoundError } from './agent-registry.js';
import type { SandboxManager } from './sandbox-manager.js';

// ─── Errors ───────────────────────────────────────────────────────────────────

export class MoltbotDeployError extends Error {
  readonly code = 'MOLTBOT_DEPLOY_FAILED';
  constructor(agentName: string, cause: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`MoltbotDeployer: failed to deploy '${agentName}': ${msg}`);
    this.name = 'MoltbotDeployError';
  }
}

export class MoltbotUndeployError extends Error {
  readonly code = 'MOLTBOT_UNDEPLOY_FAILED';
  constructor(agentName: string, cause: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`MoltbotDeployer: failed to undeploy '${agentName}': ${msg}`);
    this.name = 'MoltbotUndeployError';
  }
}

// ─── Agent config loader (injected or default) ───────────────────────────────

export type AgentConfigLoader = (agentName: string, overrides?: Partial<VMSpec>) => Promise<VMSpec>;

/**
 * Default config loader: builds a minimal VMSpec from the agent name + overrides.
 */
export function defaultAgentConfigLoader(agentName: string, overrides?: Partial<VMSpec>): Promise<VMSpec> {
  const spec: VMSpec = {
    name: agentName,
    provider: 'docker',
    image: `nova26-agents/${agentName.toLowerCase()}:latest`,
    isolationLevel: 'namespace',
    resources: { cpuMillicores: 250, memoryMb: 128, diskMb: 1024, networkKbps: 512, maxProcesses: 16 },
    drives: [],
    networkEnabled: false,
    metadata: { agentName },
    bootTimeoutMs: 10_000,
    agentId: agentName,
    ...overrides,
  };
  return Promise.resolve(spec);
}

// ─── MoltbotDeployer ──────────────────────────────────────────────────────────

/**
 * MoltbotDeployer — deploys and manages Nova26 agents in sandboxed VMs.
 *
 * Satisfies Spec Task 9.2:
 * - deployAgent: load hac.toml config, merge overrides, spawn VM, register
 * - undeployAgent: terminate VM, unregister
 * - getDeployment / listDeployments
 */
export class MoltbotDeployer {
  private registry: AgentRegistry;
  private sandboxManager: SandboxManager;
  private configLoader: AgentConfigLoader;

  constructor(
    sandboxManager: SandboxManager,
    opts: { registry?: AgentRegistry; configLoader?: AgentConfigLoader } = {},
  ) {
    this.sandboxManager = sandboxManager;
    this.registry = opts.registry ?? new AgentRegistry();
    this.configLoader = opts.configLoader ?? defaultAgentConfigLoader;
  }

  /**
   * Deploy an agent: load config, spawn VM, register deployment.
   * Returns the AgentDeployment record.
   */
  async deployAgent(agentName: string, overrides?: Partial<VMSpec>): Promise<AgentDeployment> {
    try {
      const spec = await this.configLoader(agentName, overrides);
      const vmId = await this.sandboxManager.spawn(spec);
      const instance = this.sandboxManager.getStatus(vmId);

      const deployment = AgentDeploymentSchema.parse({
        agentName,
        vmId,
        spec,
        deployedAt: Date.now(),
        status: instance.state,
      });

      this.registry.upsert(deployment);
      return deployment;
    } catch (err) {
      throw new MoltbotDeployError(agentName, err);
    }
  }

  /**
   * Undeploy an agent: terminate VM, unregister.
   */
  async undeployAgent(agentName: string): Promise<void> {
    try {
      const deployment = this.registry.get(agentName);
      await this.sandboxManager.terminate(deployment.vmId);
      this.registry.unregister(agentName);
    } catch (err) {
      if (err instanceof AgentNotFoundError) throw err;
      throw new MoltbotUndeployError(agentName, err);
    }
  }

  /**
   * Get deployment info for a specific agent.
   * Throws AgentNotFoundError if not deployed.
   */
  getDeployment(agentName: string): AgentDeployment {
    return this.registry.get(agentName);
  }

  /**
   * Check if an agent is currently deployed.
   */
  isDeployed(agentName: string): boolean {
    return this.registry.has(agentName);
  }

  /**
   * List all current deployments.
   */
  listDeployments(): AgentDeployment[] {
    return this.registry.list();
  }

  /**
   * Update deployment status from current VM state.
   */
  syncStatus(agentName: string): void {
    const deployment = this.registry.get(agentName);
    const instance = this.sandboxManager.getStatus(deployment.vmId);
    this.registry.upsert({ ...deployment, status: instance.state });
  }
}
