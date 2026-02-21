// A2A Router — Tier-enforced agent-to-agent message routing
// Sprint S2-21 | A2A Agent-to-Agent Protocols

import type { A2AEnvelope, A2AMessageType, AgentTier, RoutingResult } from './types.js';
import type { AgentRegistry } from './registry.js';
import { canRoute, requiresEscalation, DEFAULT_TIER_ASSIGNMENTS } from './tier-config.js';

export type MessageHandler = (envelope: A2AEnvelope) => void | Promise<void>;

export interface RouterConfig {
  defaultTimeout?: number;
  enableTierEnforcement?: boolean;
  enableSandboxEnforcement?: boolean;
}

export class TierViolationError extends Error {
  readonly sourceTier: AgentTier;
  readonly targetTier: AgentTier;
  constructor(sourceAgentId: string, targetAgentId: string, sourceTier: AgentTier, targetTier: AgentTier) {
    super(`Tier violation: ${sourceAgentId} (${sourceTier}) cannot message ${targetAgentId} (${targetTier}) without escalation`);
    this.sourceTier = sourceTier;
    this.targetTier = targetTier;
  }
}

export class SandboxViolationError extends Error {
  constructor(sourceAgent: string, sourceSandbox: string | undefined, targetSandbox: string | undefined) {
    super(`Sandbox violation: ${sourceAgent} (sandbox: ${sourceSandbox}) cannot message agent in sandbox ${targetSandbox}`);
  }
}

/**
 * A2ARouter — routes envelopes between agents with tier and sandbox enforcement.
 */
export class A2ARouter {
  private handlers = new Map<string, MessageHandler[]>(); // agentId → handlers
  private registry: AgentRegistry;
  private config: Required<RouterConfig>;
  private routingLog: Array<{ envelope: A2AEnvelope; result: RoutingResult }> = [];

  constructor(registry: AgentRegistry, config: RouterConfig = {}) {
    this.registry = registry;
    this.config = {
      defaultTimeout: config.defaultTimeout ?? 5000,
      enableTierEnforcement: config.enableTierEnforcement ?? true,
      enableSandboxEnforcement: config.enableSandboxEnforcement ?? true,
    };
  }

  /**
   * Register a message handler for an agent.
   */
  onReceive(agentId: string, handler: MessageHandler): () => void {
    const existing = this.handlers.get(agentId) ?? [];
    existing.push(handler);
    this.handlers.set(agentId, existing);
    return () => {
      const handlers = this.handlers.get(agentId) ?? [];
      this.handlers.set(agentId, handlers.filter(h => h !== handler));
    };
  }

  /**
   * Send an envelope — resolves target, enforces tier/sandbox rules, delivers via handler.
   */
  async send(envelope: A2AEnvelope): Promise<RoutingResult> {
    const start = Date.now();

    // Broadcast
    if (envelope.to === '*') {
      return this.broadcast(envelope, start);
    }

    // Resolve target
    const targetCard = this.registry.getById(envelope.to);
    if (!targetCard) {
      return { delivered: false, targetAgentId: envelope.to, channelType: 'local', latencyMs: Date.now() - start, error: `Agent ${envelope.to} not found in registry` };
    }

    // Tier enforcement
    if (this.config.enableTierEnforcement) {
      const sourceTier = DEFAULT_TIER_ASSIGNMENTS[envelope.from] ?? 'L3';
      const targetTier = targetCard.tier;
      if (!canRoute(sourceTier, targetTier)) {
        const err = new TierViolationError(envelope.from, envelope.to, sourceTier, targetTier);
        return { delivered: false, targetAgentId: envelope.to, channelType: 'local', latencyMs: Date.now() - start, error: err.message };
      }
    }

    // Sandbox enforcement
    if (this.config.enableSandboxEnforcement && envelope.sandboxId !== undefined) {
      const sourceCard = this.registry.getById(envelope.from);
      const targetSandbox = targetCard.sandboxId;
      const sourceSandbox = sourceCard?.sandboxId ?? envelope.sandboxId;
      if (targetSandbox && sourceSandbox !== targetSandbox) {
        const err = new SandboxViolationError(envelope.from, sourceSandbox, targetSandbox);
        return { delivered: false, targetAgentId: envelope.to, channelType: 'local', latencyMs: Date.now() - start, error: err.message };
      }
    }

    // Deliver
    const handlers = this.handlers.get(envelope.to) ?? [];
    for (const handler of handlers) {
      await handler(envelope);
    }

    const channelType = targetCard.endpoints[0]?.type ?? 'local';
    const result: RoutingResult = {
      delivered: handlers.length > 0,
      targetAgentId: envelope.to,
      channelType,
      latencyMs: Date.now() - start,
    };

    this.routingLog.push({ envelope, result });
    return result;
  }

  /**
   * Broadcast to all registered agents (skips sender).
   */
  private async broadcast(envelope: A2AEnvelope, start: number): Promise<RoutingResult> {
    const agents = this.registry.listAll().filter(c => c.id !== envelope.from);
    let delivered = 0;
    for (const agent of agents) {
      const handlers = this.handlers.get(agent.id) ?? [];
      for (const handler of handlers) {
        await handler({ ...envelope, to: agent.id });
        delivered++;
      }
    }
    return {
      delivered: delivered > 0,
      targetAgentId: '*',
      channelType: 'local',
      latencyMs: Date.now() - start,
    };
  }

  /**
   * Route by capability — find agents with a capability and deliver to each.
   */
  async routeByCapability(envelope: A2AEnvelope, capabilityName: string): Promise<RoutingResult[]> {
    const agents = this.registry.findByCapability(capabilityName);
    return Promise.all(agents.map(agent => this.send({ ...envelope, to: agent.id })));
  }

  /**
   * Get routing log (last N entries).
   */
  getRoutingLog(limit = 50): Array<{ envelope: A2AEnvelope; result: RoutingResult }> {
    return this.routingLog.slice(-limit);
  }
}
