// A2A/MCP Protocol Tests — Wave 3 + Wave 4 (S2-18 to S2-25)

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { randomUUID } from 'crypto';
import {
  AgentCardSchema,
  A2AEnvelopeSchema,
  A2AMessageTypeSchema,
  TaskProposalPayloadSchema,
  CRDTSyncMessageSchema,
} from '../schemas.js';
import { AgentRegistry } from '../registry.js';
import { EnvelopeFactory } from '../envelope.js';
import { A2ARouter, TierViolationError } from '../router.js';
import { A2AChannel, ChannelManager } from '../channel.js';
import { MCPBridge } from '../mcp-bridge.js';
import { A2AObservability } from '../observability.js';
import { createA2ALayer } from '../index.js';
import {
  DEFAULT_TIER_ASSIGNMENTS,
  DEFAULT_TIER_RULES,
  canRoute,
  requiresEscalation,
} from '../tier-config.js';
import type { A2AEnvelope, AgentCard } from '../types.js';

// ─── S2-18: Types & Schemas ───────────────────────────────────────────────────

describe('A2A Schemas (S2-18)', () => {
  it('AgentCardSchema validates a valid card', () => {
    const card = { id: 'SUN', name: 'Sun Agent', tier: 'L0' };
    const parsed = AgentCardSchema.parse(card);
    expect(parsed.tier).toBe('L0');
    expect(parsed.origin).toBe('local');
    expect(parsed.revision).toBe(0);
  });

  it('AgentCardSchema rejects invalid tier', () => {
    expect(() => AgentCardSchema.parse({ id: 'x', name: 'x', tier: 'L9' })).toThrow();
  });

  it('A2AEnvelopeSchema validates a valid envelope', () => {
    const env = { id: randomUUID(), type: 'request', from: 'SUN', to: 'MERCURY', payload: {}, timestamp: Date.now() };
    expect(() => A2AEnvelopeSchema.parse(env)).not.toThrow();
  });

  it('A2AMessageTypeSchema validates all message types', () => {
    const types = ['request', 'response', 'notification', 'task-proposal', 'task-accept', 'task-reject', 'stream-data', 'heartbeat', 'error'];
    for (const t of types) {
      expect(() => A2AMessageTypeSchema.parse(t)).not.toThrow();
    }
  });

  it('TaskProposalPayloadSchema validates', () => {
    const payload = {
      taskId: 'task-1',
      description: 'Build feature X',
      requiredCapabilities: ['coding'],
      proposedBy: 'SUN',
    };
    expect(() => TaskProposalPayloadSchema.parse(payload)).not.toThrow();
  });

  it('CRDTSyncMessageSchema validates', () => {
    const msg = { operationId: 'op-1', vectorClock: { 'peer-A': 1 }, payload: {}, logName: 'crdt-collab', seq: 0 };
    expect(() => CRDTSyncMessageSchema.parse(msg)).not.toThrow();
  });

  // Property: AgentCard serialization round trip
  it('Property: AgentCard round-trips through JSON', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          name: fc.string({ minLength: 1, maxLength: 30 }),
          tier: fc.constantFrom('L0', 'L1', 'L2', 'L3' as const),
        }),
        (card) => {
          const parsed = AgentCardSchema.parse(card);
          const serialized = JSON.stringify(parsed);
          const deserialized = AgentCardSchema.parse(JSON.parse(serialized));
          expect(deserialized.id).toBe(card.id);
          expect(deserialized.tier).toBe(card.tier);
          return true;
        },
      ),
    );
  });

  // Property: A2AEnvelope unique IDs
  it('Property: A2AEnvelope IDs are unique', () => {
    const factory = new EnvelopeFactory('SUN');
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const env = factory.createRequest('MERCURY', {});
      ids.add(env.id);
    }
    expect(ids.size).toBe(100);
  });
});

// ─── Tier Config ──────────────────────────────────────────────────────────────

describe('Tier Config', () => {
  it('DEFAULT_TIER_ASSIGNMENTS has all 21 agents', () => {
    expect(Object.keys(DEFAULT_TIER_ASSIGNMENTS).length).toBe(21);
    expect(DEFAULT_TIER_ASSIGNMENTS['SUN']).toBe('L0');
    expect(DEFAULT_TIER_ASSIGNMENTS['MARS']).toBe('L2');
    expect(DEFAULT_TIER_ASSIGNMENTS['IO']).toBe('L3');
  });

  it('canRoute: L0 can message all tiers', () => {
    expect(canRoute('L0', 'L0')).toBe(true);
    expect(canRoute('L0', 'L3')).toBe(true);
  });

  it('canRoute: L3 cannot message L0 or L1 directly', () => {
    expect(canRoute('L3', 'L0')).toBe(false);
    expect(canRoute('L3', 'L1')).toBe(false);
  });

  it('canRoute: L2 cannot message L0 directly', () => {
    expect(canRoute('L2', 'L0')).toBe(false);
  });

  it('requiresEscalation: L2 needs escalation to reach L0', () => {
    expect(requiresEscalation('L2', 'L0')).toBe(true);
  });

  it('requiresEscalation: L1 does not need escalation for any tier', () => {
    expect(requiresEscalation('L1', 'L0')).toBe(false);
  });
});

// ─── S2-19: EnvelopeFactory ───────────────────────────────────────────────────

describe('EnvelopeFactory (S2-19)', () => {
  let factory: EnvelopeFactory;

  beforeEach(() => {
    factory = new EnvelopeFactory('SUN', { sandboxId: 'sandbox-1' });
  });

  it('createEnvelope generates unique IDs', () => {
    const e1 = factory.createEnvelope('request', 'MERCURY', {});
    const e2 = factory.createEnvelope('request', 'MERCURY', {});
    expect(e1.id).not.toBe(e2.id);
  });

  it('createRequest sets correct type and from', () => {
    const env = factory.createRequest('MERCURY', { action: 'run' });
    expect(env.type).toBe('request');
    expect(env.from).toBe('SUN');
    expect(env.to).toBe('MERCURY');
  });

  it('createResponse carries correlationId', () => {
    const corrId = randomUUID();
    const env = factory.createResponse('MERCURY', { result: 'ok' }, corrId);
    expect(env.correlationId).toBe(corrId);
    expect(env.type).toBe('response');
  });

  it('createNotification targets broadcast (*)', () => {
    const env = factory.createNotification({ msg: 'broadcast' });
    expect(env.to).toBe('*');
    expect(env.type).toBe('notification');
  });

  it('createTaskProposal sets task-proposal type and correlationId', () => {
    const proposal = {
      taskId: 'task-1',
      description: 'Do X',
      requiredCapabilities: ['coding'],
      complexity: 'medium' as const,
      proposedBy: 'SUN',
    };
    const env = factory.createTaskProposal('MARS', proposal);
    expect(env.type).toBe('task-proposal');
    expect(env.correlationId).toBeDefined();
  });

  it('envelope inherits sandboxId from factory', () => {
    const env = factory.createRequest('MARS', {});
    expect(env.sandboxId).toBe('sandbox-1');
  });
});

// ─── S2-19: AgentRegistry ─────────────────────────────────────────────────────

describe('AgentRegistry (S2-19)', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it('register stores an agent card', () => {
    registry.register({ id: 'SUN', name: 'Sun', tier: 'L0' });
    expect(registry.getById('SUN')).toBeDefined();
  });

  it('register increments revision on duplicate ID', () => {
    registry.register({ id: 'SUN', name: 'Sun', tier: 'L0' });
    registry.register({ id: 'SUN', name: 'Sun', tier: 'L0' });
    expect(registry.getById('SUN')?.revision).toBe(1);
  });

  it('getById returns undefined for unknown agent', () => {
    expect(registry.getById('UNKNOWN')).toBeUndefined();
  });

  it('findByCapability returns matching agents', () => {
    registry.register({ id: 'MARS', name: 'Mars', tier: 'L2', capabilities: [{ name: 'coding', version: '1.0', description: '' }] });
    registry.register({ id: 'VENUS', name: 'Venus', tier: 'L2', capabilities: [{ name: 'review', version: '1.0', description: '' }] });
    const coders = registry.findByCapability('coding');
    expect(coders.length).toBe(1);
    expect(coders[0]!.id).toBe('MARS');
  });

  it('findByTier returns agents at specific tier', () => {
    registry.register({ id: 'SUN', name: 'Sun', tier: 'L0' });
    registry.register({ id: 'MERCURY', name: 'Mercury', tier: 'L1' });
    registry.register({ id: 'EARTH', name: 'Earth', tier: 'L1' });
    expect(registry.findByTier('L1').length).toBe(2);
    expect(registry.findByTier('L0').length).toBe(1);
  });

  it('unregister removes an agent', () => {
    registry.register({ id: 'PLUTO', name: 'Pluto', tier: 'L3' });
    registry.unregister('PLUTO');
    expect(registry.getById('PLUTO')).toBeUndefined();
  });

  it('mergeRemoteCard sets origin to remote', () => {
    registry.mergeRemoteCard({ id: 'REMOTE-1', name: 'Remote', tier: 'L2' });
    expect(registry.getById('REMOTE-1')?.origin).toBe('remote');
  });

  it('getLocalCards / getRemoteCards separates correctly', () => {
    registry.register({ id: 'LOCAL-1', name: 'L1', tier: 'L1' });
    registry.mergeRemoteCard({ id: 'REMOTE-1', name: 'R1', tier: 'L2' });
    expect(registry.getLocalCards().length).toBe(1);
    expect(registry.getRemoteCards().length).toBe(1);
  });

  it('serialize/deserialize round-trips', () => {
    registry.register({ id: 'SUN', name: 'Sun', tier: 'L0' });
    const json = registry.serialize();
    const newRegistry = new AgentRegistry();
    const count = newRegistry.deserialize(json);
    expect(count).toBe(1);
    expect(newRegistry.getById('SUN')).toBeDefined();
  });

  it('getStats returns correct counts', () => {
    registry.register({ id: 'SUN', name: 'Sun', tier: 'L0' });
    registry.register({ id: 'MERCURY', name: 'Mercury', tier: 'L1' });
    const stats = registry.getStats();
    expect(stats.totalAgents).toBe(2);
    expect(stats.byTier.L0).toBe(1);
    expect(stats.byTier.L1).toBe(1);
  });

  // Property: duplicate updates increment revision
  it('Property: revision monotonically increases on duplicate registration', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (updates) => {
          const r = new AgentRegistry();
          for (let i = 0; i < updates; i++) {
            r.register({ id: 'SUN', name: 'Sun', tier: 'L0' });
          }
          const card = r.getById('SUN')!;
          expect(card.revision).toBe(updates - 1);
          return true;
        },
      ),
    );
  });
});

// ─── S2-21: A2ARouter ────────────────────────────────────────────────────────

describe('A2ARouter (S2-21)', () => {
  let registry: AgentRegistry;
  let router: A2ARouter;
  let factory: EnvelopeFactory;

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.register({ id: 'SUN', name: 'Sun', tier: 'L0' });
    registry.register({ id: 'MERCURY', name: 'Mercury', tier: 'L1' });
    registry.register({ id: 'MARS', name: 'Mars', tier: 'L2' });
    registry.register({ id: 'IO', name: 'Io', tier: 'L3' });
    router = new A2ARouter(registry);
    factory = new EnvelopeFactory('SUN');
  });

  it('send delivers to registered handler', async () => {
    const received: A2AEnvelope[] = [];
    router.onReceive('MERCURY', env => { received.push(env); });
    const env = factory.createRequest('MERCURY', { action: 'run' });
    const result = await router.send(env);
    expect(result.delivered).toBe(true);
    expect(received.length).toBe(1);
  });

  it('send returns not-delivered when no handler registered', async () => {
    const env = factory.createRequest('MERCURY', {});
    const result = await router.send(env);
    expect(result.delivered).toBe(false);
  });

  it('send returns error when target not in registry', async () => {
    const env = factory.createRequest('UNKNOWN-AGENT', {});
    const result = await router.send(env);
    expect(result.delivered).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('tier enforcement: L3 cannot message L1', async () => {
    const l3Factory = new EnvelopeFactory('IO');
    const env = l3Factory.createRequest('MERCURY', {});
    const result = await router.send(env);
    expect(result.delivered).toBe(false);
    expect(result.error).toContain('Tier violation');
  });

  it('tier enforcement: L0 can message anyone', async () => {
    const received: A2AEnvelope[] = [];
    router.onReceive('IO', env => received.push(env));
    const env = factory.createRequest('IO', {});
    const result = await router.send(env);
    expect(result.delivered).toBe(true);
  });

  it('broadcast sends to all registered agents', async () => {
    const received = new Set<string>();
    router.onReceive('MERCURY', env => received.add(env.to));
    router.onReceive('MARS', env => received.add(env.to));
    const env = factory.createNotification({ msg: 'hello everyone' });
    await router.send(env);
    expect(received.has('MERCURY')).toBe(true);
    expect(received.has('MARS')).toBe(true);
  });

  it('routeByCapability delivers to capable agents', async () => {
    registry.register({ id: 'VENUS', name: 'Venus', tier: 'L2', capabilities: [{ name: 'review', version: '1.0', description: '' }] });
    const received: A2AEnvelope[] = [];
    router.onReceive('VENUS', env => received.push(env));
    const env = factory.createRequest('VENUS', { action: 'review' });
    await router.routeByCapability(env, 'review');
    expect(received.length).toBe(1);
  });

  it('onReceive returns unsubscribe function', async () => {
    const received: A2AEnvelope[] = [];
    const unsub = router.onReceive('MERCURY', env => received.push(env));
    const env = factory.createRequest('MERCURY', {});
    router.onReceive('MERCURY', () => {}); // keep at least one handler
    unsub();
    await router.send(env);
    expect(received.length).toBe(0);
  });

  it('getRoutingLog records sent envelopes', async () => {
    router.onReceive('MERCURY', () => {});
    const env = factory.createRequest('MERCURY', {});
    await router.send(env);
    expect(router.getRoutingLog().length).toBeGreaterThan(0);
  });

  it('tier enforcement can be disabled', async () => {
    const noEnforceRouter = new A2ARouter(registry, { enableTierEnforcement: false });
    const l3Factory = new EnvelopeFactory('IO');
    const received: A2AEnvelope[] = [];
    noEnforceRouter.onReceive('MERCURY', env => received.push(env));
    const env = l3Factory.createRequest('MERCURY', {});
    const result = await noEnforceRouter.send(env);
    expect(result.delivered).toBe(true);
  });
});

// ─── S2-22: A2AChannel ───────────────────────────────────────────────────────

describe('A2AChannel (S2-22)', () => {
  it('starts in connecting state, transitions to open', async () => {
    const channel = new A2AChannel('SUN', 'MERCURY');
    expect(channel.channelStatus).toBe('connecting');
    await Promise.resolve(); // microtask
    expect(channel.channelStatus).toBe('open');
  });

  it('send delivers to registered handlers', async () => {
    const channel = new A2AChannel('SUN', 'MERCURY');
    await Promise.resolve();
    const factory = new EnvelopeFactory('SUN');
    const received: A2AEnvelope[] = [];
    channel.onMessage(env => { received.push(env); });
    await channel.send(factory.createRequest('MERCURY', {}));
    expect(received.length).toBe(1);
  });

  it('send throws on closed channel', async () => {
    const channel = new A2AChannel('SUN', 'MERCURY');
    await Promise.resolve();
    channel.close();
    const factory = new EnvelopeFactory('SUN');
    await expect(channel.send(factory.createRequest('MERCURY', {}))).rejects.toThrow('closed');
  });

  it('onMessage returns unsubscribe function', async () => {
    const channel = new A2AChannel('SUN', 'MERCURY');
    await Promise.resolve();
    const received: A2AEnvelope[] = [];
    const unsub = channel.onMessage(env => received.push(env));
    unsub();
    const factory = new EnvelopeFactory('SUN');
    await channel.send(factory.createRequest('MERCURY', {}));
    expect(received.length).toBe(0);
  });

  it('message ordering is preserved', async () => {
    const channel = new A2AChannel('SUN', 'MERCURY');
    await Promise.resolve();
    const factory = new EnvelopeFactory('SUN');
    const received: number[] = [];
    channel.onMessage(async env => { received.push((env.payload as { seq: number }).seq); });
    for (let i = 0; i < 5; i++) {
      await channel.send(factory.createRequest('MERCURY', { seq: i }));
    }
    expect(received).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('ChannelManager (S2-22)', () => {
  let cm: ChannelManager;

  beforeEach(() => { cm = new ChannelManager(); });

  it('openChannel returns same channel for same pair', () => {
    const c1 = cm.openChannel('SUN', 'MERCURY');
    const c2 = cm.openChannel('SUN', 'MERCURY');
    expect(c1).toBe(c2);
  });

  it('openChannel creates different channels for different pairs', () => {
    const c1 = cm.openChannel('SUN', 'MERCURY');
    const c2 = cm.openChannel('SUN', 'MARS');
    expect(c1).not.toBe(c2);
  });

  it('getChannel returns undefined for unknown pair', () => {
    expect(cm.getChannel('SUN', 'PLUTO')).toBeUndefined();
  });

  it('listChannels returns all open channels', () => {
    cm.openChannel('SUN', 'MERCURY');
    cm.openChannel('SUN', 'MARS');
    expect(cm.listChannels().length).toBe(2);
  });

  it('closeAll closes and clears all channels', () => {
    cm.openChannel('SUN', 'MERCURY');
    cm.closeAll();
    expect(cm.listChannels().length).toBe(0);
  });
});

// ─── S2-23: MCPBridge ─────────────────────────────────────────────────────────

describe('MCPBridge (S2-23)', () => {
  let bridge: MCPBridge;

  beforeEach(() => { bridge = new MCPBridge(); });

  it('registerAgentTools registers with namespaced names', () => {
    const registered = bridge.registerAgentTools('MARS', [
      { name: 'generateCode', description: 'Generate code', handler: async () => 'code' },
    ]);
    expect(registered).toContain('MARS.generateCode');
  });

  it('registerAgentTools throws on duplicate namespaced name', () => {
    bridge.registerAgentTools('MARS', [{ name: 'run', description: '', handler: async () => {} }]);
    expect(() =>
      bridge.registerAgentTools('MARS', [{ name: 'run', description: '', handler: async () => {} }])
    ).toThrow();
  });

  it('invokeTool calls the handler and returns result', async () => {
    bridge.registerAgentTools('MARS', [{ name: 'ping', description: '', handler: async () => 'pong' }]);
    const result = await bridge.invokeTool('MARS.ping');
    expect(result.success).toBe(true);
    expect(result.output).toBe('pong');
  });

  it('invokeTool returns error for unknown tool', async () => {
    const result = await bridge.invokeTool('MARS.unknown');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('invokeTool handles handler errors gracefully', async () => {
    bridge.registerAgentTools('MARS', [{ name: 'fail', description: '', handler: async () => { throw new Error('oops'); } }]);
    const result = await bridge.invokeTool('MARS.fail');
    expect(result.success).toBe(false);
    expect(result.error).toBe('oops');
  });

  it('listAllTools returns all registered tools', () => {
    bridge.registerAgentTools('MARS', [{ name: 'a', description: '', handler: async () => {} }]);
    bridge.registerAgentTools('VENUS', [{ name: 'b', description: '', handler: async () => {} }]);
    expect(bridge.listAllTools().length).toBe(2);
  });

  it('registerResource and readResource round-trip', () => {
    bridge.registerResource({ uri: 'nova26://config', name: 'Config', content: { theme: 'dark' } });
    expect((bridge.readResource('nova26://config') as { theme: string }).theme).toBe('dark');
  });

  it('readResource throws RESOURCE_NOT_FOUND for unknown URI', () => {
    expect(() => bridge.readResource('nova26://missing')).toThrow('not found');
  });

  it('registerPrompt and getPrompt with substitution', () => {
    bridge.registerPrompt({ name: 'greeting', template: 'Hello, {{name}}! You are {{role}}.' });
    const rendered = bridge.getPrompt('greeting', { name: 'Alice', role: 'engineer' });
    expect(rendered).toBe('Hello, Alice! You are engineer.');
  });

  it('getPrompt throws for unknown prompt', () => {
    expect(() => bridge.getPrompt('nope')).toThrow('not found');
  });

  it('getStats returns accurate counts', async () => {
    bridge.registerAgentTools('MARS', [{ name: 'x', description: '', handler: async () => {} }]);
    await bridge.invokeTool('MARS.x');
    const stats = bridge.getStats();
    expect(stats.totalTools).toBe(1);
    expect(stats.invocations).toBe(1);
  });
});

// ─── S2-24: A2AObservability ─────────────────────────────────────────────────

describe('A2AObservability (S2-24)', () => {
  let obs: A2AObservability;

  beforeEach(() => { obs = new A2AObservability(); });

  it('emit records an event', () => {
    obs.emit({ eventType: 'message-sent', agentId: 'SUN', targetAgentId: 'MERCURY' });
    expect(obs.getRecentEvents()).toHaveLength(1);
  });

  it('getMetrics tracks message counts', () => {
    obs.emit({ eventType: 'message-sent' });
    obs.emit({ eventType: 'message-received' });
    obs.emit({ eventType: 'routing-failed' });
    const m = obs.getMetrics();
    expect(m.messagesSent).toBe(1);
    expect(m.messagesReceived).toBe(1);
    expect(m.routingFailures).toBe(1);
  });

  it('getMetrics tracks tool invocations', () => {
    obs.emit({ eventType: 'tool-invoked', toolName: 'MARS.generateCode' });
    expect(obs.getMetrics().toolInvocations).toBe(1);
  });

  it('getMetrics computes avg routing latency', () => {
    obs.emit({ eventType: 'message-sent', latencyMs: 10 });
    obs.emit({ eventType: 'message-sent', latencyMs: 20 });
    expect(obs.getMetrics().avgRoutingLatencyMs).toBe(15);
  });

  it('resetMetrics clears all counters', () => {
    obs.emit({ eventType: 'message-sent' });
    obs.resetMetrics();
    expect(obs.getMetrics().messagesSent).toBe(0);
  });

  it('on listener is called for each event', () => {
    const seen: string[] = [];
    obs.on(e => seen.push(e.eventType));
    obs.emit({ eventType: 'message-sent' });
    obs.emit({ eventType: 'routing-failed' });
    expect(seen).toEqual(['message-sent', 'routing-failed']);
  });
});

// ─── S2-25: createA2ALayer factory ────────────────────────────────────────────

describe('createA2ALayer (S2-25)', () => {
  it('returns all components', () => {
    const layer = createA2ALayer();
    expect(layer.registry).toBeDefined();
    expect(layer.router).toBeDefined();
    expect(layer.channels).toBeDefined();
    expect(layer.mcp).toBeDefined();
    expect(layer.observability).toBeDefined();
  });

  it('envelope factory creates correct envelopes', () => {
    const layer = createA2ALayer();
    const factory = layer.envelope('SUN');
    const env = factory.createRequest('MERCURY', { x: 1 });
    expect(env.from).toBe('SUN');
    expect(env.to).toBe('MERCURY');
  });

  it('router send emits observability event', async () => {
    const layer = createA2ALayer();
    layer.registry.register({ id: 'SUN', name: 'Sun', tier: 'L0' });
    layer.registry.register({ id: 'MERCURY', name: 'Mercury', tier: 'L1' });
    layer.router.onReceive('MERCURY', () => {});

    const factory = layer.envelope('SUN');
    await layer.router.send(factory.createRequest('MERCURY', {}));
    expect(layer.observability.getMetrics().messagesSent).toBe(1);
  });

  it('all components work together end-to-end', async () => {
    const layer = createA2ALayer();
    layer.registry.register({ id: 'SUN', name: 'Sun', tier: 'L0' });
    layer.registry.register({ id: 'MARS', name: 'Mars', tier: 'L2' });
    layer.mcp.registerAgentTools('MARS', [{ name: 'build', description: '', handler: async () => 'built' }]);

    const received: A2AEnvelope[] = [];
    layer.router.onReceive('MARS', async env => {
      received.push(env);
      const result = await layer.mcp.invokeTool('MARS.build');
      expect(result.success).toBe(true);
    });

    const factory = layer.envelope('SUN');
    await layer.router.send(factory.createRequest('MARS', { action: 'build' }));
    expect(received.length).toBe(1);
    expect(layer.observability.getMetrics().messagesSent).toBe(1);
  });
});
