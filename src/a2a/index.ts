// A2A/MCP Protocol — Public API
// Sprint S2-24..S2-25 | A2A Agent-to-Agent Protocols

export * from './types.js';
export * from './schemas.js';
export * from './tier-config.js';
export { EnvelopeFactory } from './envelope.js';
export { AgentRegistry } from './registry.js';
export type { RegistryStats } from './registry.js';
export {
  A2ARouter,
  TierViolationError,
  SandboxViolationError,
} from './router.js';
export type { RouterConfig } from './router.js';
export { A2AChannel, ChannelManager } from './channel.js';
export type { ChannelOptions } from './channel.js';
export { MCPBridge } from './mcp-bridge.js';
export type { ToolDefinition, ResourceDefinition, PromptDefinition, ToolInvocationResult, MCPBridgeStats } from './mcp-bridge.js';
export { A2AObservability } from './observability.js';
export { TaskNegotiator } from './task-negotiator.js';
export type { NegotiationRecord, ProposalStatus, ProposalHandler } from './task-negotiator.js';
export { SwarmCoordinator } from './swarm-coordinator.js';
export type { SwarmSession, SwarmSubTask, SwarmStatus, SubTaskStatus } from './swarm-coordinator.js';
export { CRDTSyncChannel } from './crdt-sync.js';

export interface A2ALayer {
  registry: AgentRegistry;
  router: A2ARouter;
  channels: ChannelManager;
  envelope: (agentId: string) => EnvelopeFactory;
  mcp: MCPBridge;
  observability: A2AObservability;
  negotiator: (agentId: string) => TaskNegotiator;
  swarm: SwarmCoordinator;
  crdtSync: (agentId: string) => CRDTSyncChannel;
}

import { AgentRegistry } from './registry.js';
import { A2ARouter } from './router.js';
import { ChannelManager } from './channel.js';
import { EnvelopeFactory } from './envelope.js';
import { MCPBridge } from './mcp-bridge.js';
import { A2AObservability } from './observability.js';
import { TaskNegotiator } from './task-negotiator.js';
import { SwarmCoordinator } from './swarm-coordinator.js';
import { CRDTSyncChannel } from './crdt-sync.js';

/**
 * createA2ALayer — Factory function that wires all A2A components together.
 */
export function createA2ALayer(coordinatorAgentId = 'SUN'): A2ALayer {
  const registry = new AgentRegistry();
  const observability = new A2AObservability();
  const router = new A2ARouter(registry);
  const channels = new ChannelManager();
  const mcp = new MCPBridge();
  const swarm = new SwarmCoordinator(coordinatorAgentId, router, registry);

  // Wire router to emit observability events
  const origSend = router.send.bind(router);
  router.send = async (envelope) => {
    const result = await origSend(envelope);
    observability.emit({
      eventType: result.delivered ? 'message-sent' : 'routing-failed',
      agentId: envelope.from,
      targetAgentId: envelope.to,
      envelopeId: envelope.id,
      latencyMs: result.latencyMs,
      error: result.error,
    });
    return result;
  };

  return {
    registry,
    router,
    channels,
    envelope: (agentId: string) => new EnvelopeFactory(agentId),
    mcp,
    observability,
    negotiator: (agentId: string) => new TaskNegotiator(agentId, router),
    swarm,
    crdtSync: (agentId: string) => new CRDTSyncChannel(agentId, router),
  };
}
