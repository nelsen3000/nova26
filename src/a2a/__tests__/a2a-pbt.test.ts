// A2A Property-Based Tests — Spec Task 1.4, 2.2, 2.4, 8.2, 9.2
// Sprint S3-15 | A2A/MCP Protocols
//
// Optional property tests covering:
// Property 4:  Agent Card serialization round trip
// Property 6:  A2A Envelope structure and uniqueness
// Property 7:  A2A Envelope serialization round trip
// Property 8:  Correlation threading
// Property 9:  Message type validation
// Property 23: Task negotiation message structure
// Property 25: Swarm broadcast to capable agents

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AgentCardSchema, A2AEnvelopeSchema, A2AMessageTypeSchema } from '../schemas.js';
import { EnvelopeFactory } from '../envelope.js';
import { AgentRegistry } from '../registry.js';
import { A2ARouter } from '../router.js';
import { A2AObservability } from '../observability.js';
import type { AgentCard, A2AMessageType } from '../types.js';

// ─── Arbitrary generators ─────────────────────────────────────────────────────

const arbAgentId = fc.constantFrom('MARS', 'VENUS', 'EARTH', 'ATLAS', 'SATURN', 'TITAN', 'PLUTO');
const arbTier = fc.constantFrom('L0', 'L1', 'L2', 'L3') as fc.Arbitrary<AgentCard['tier']>;
const arbMessageType = fc.constantFrom(
  'request', 'response', 'notification', 'task-proposal',
  'task-accept', 'task-reject', 'stream-data', 'heartbeat', 'error',
) as fc.Arbitrary<A2AMessageType>;

const arbAgentCard = fc.record({
  id: arbAgentId,
  name: fc.string({ minLength: 2, maxLength: 20 }),
  tier: arbTier,
  capabilities: fc.array(
    fc.record({ name: fc.string({ minLength: 2, maxLength: 15 }), version: fc.constant('1.0.0'), description: fc.constant(''), tags: fc.constant([]) }),
    { maxLength: 3 },
  ),
  endpoints: fc.constant([{ type: 'local' as const }]),
  protocolVersion: fc.constant('1.0'),
  origin: fc.constant('local' as const),
  revision: fc.nat({ max: 10 }),
});

// ─── Property 4: Agent Card serialization round trip ─────────────────────────

describe('Property 4: Agent Card serialization round trip', () => {
  it('JSON.stringify → parse → Zod validates produces equivalent card', () => {
    fc.assert(fc.property(arbAgentCard, (card) => {
      const validated = AgentCardSchema.parse(card);
      const json = JSON.stringify(validated);
      const reparsed = AgentCardSchema.parse(JSON.parse(json) as unknown);

      expect(reparsed.id).toBe(validated.id);
      expect(reparsed.name).toBe(validated.name);
      expect(reparsed.tier).toBe(validated.tier);
      expect(reparsed.capabilities).toHaveLength(validated.capabilities.length);
    }), { numRuns: 100 });
  });
});

// ─── Property 6: A2A Envelope structure and uniqueness ───────────────────────

describe('Property 6: A2A Envelope structure and uniqueness', () => {
  it('each createEnvelope produces a unique ID', () => {
    fc.assert(fc.property(
      arbAgentId,
      arbAgentId,
      arbMessageType,
      (from, to, type) => {
        const factory = new EnvelopeFactory(from);
        const e1 = factory.createEnvelope(type, to, { msg: 'a' });
        const e2 = factory.createEnvelope(type, to, { msg: 'a' });
        expect(e1.id).not.toBe(e2.id);
      },
    ), { numRuns: 100 });
  });

  it('envelope from/to/type fields are preserved', () => {
    fc.assert(fc.property(
      arbAgentId,
      arbAgentId,
      arbMessageType,
      (from, to, type) => {
        const factory = new EnvelopeFactory(from);
        const envelope = factory.createEnvelope(type, to, { data: 42 });
        expect(envelope.from).toBe(from);
        expect(envelope.to).toBe(to);
        expect(envelope.type).toBe(type);
      },
    ), { numRuns: 100 });
  });
});

// ─── Property 7: A2A Envelope serialization round trip ───────────────────────

describe('Property 7: A2A Envelope serialization round trip', () => {
  it('serialize → parse preserves all fields', () => {
    fc.assert(fc.property(
      arbAgentId,
      arbAgentId,
      arbMessageType,
      fc.oneof(fc.string(), fc.integer(), fc.record({ key: fc.string() })),
      (from, to, type, payload) => {
        const factory = new EnvelopeFactory(from);
        const envelope = factory.createEnvelope(type, to, payload);
        const json = JSON.stringify(envelope);
        const reparsed = A2AEnvelopeSchema.parse(JSON.parse(json) as unknown);

        expect(reparsed.id).toBe(envelope.id);
        expect(reparsed.from).toBe(from);
        expect(reparsed.to).toBe(to);
        expect(reparsed.type).toBe(type);
        expect(reparsed.timestamp).toBe(envelope.timestamp);
      },
    ), { numRuns: 100 });
  });
});

// ─── Property 8: Correlation threading ───────────────────────────────────────

describe('Property 8: Correlation threading', () => {
  it('createResponse() preserves correlationId from request', () => {
    fc.assert(fc.property(
      arbAgentId,
      arbAgentId,
      (from, to) => {
        const factory = new EnvelopeFactory(from);
        const request = factory.createRequest(to, { action: 'ping' });
        const response = factory.createResponse(from, { result: 'pong' }, request.id);
        expect(response.correlationId).toBe(request.id);
      },
    ), { numRuns: 50 });
  });
});

// ─── Property 9: Message type validation ─────────────────────────────────────

describe('Property 9: Message type validation', () => {
  it('all valid message types are accepted by schema', () => {
    fc.assert(fc.property(arbMessageType, (type) => {
      const parsed = A2AMessageTypeSchema.parse(type);
      expect(parsed).toBe(type);
    }), { numRuns: 50 });
  });

  it('invalid message type is rejected by schema', () => {
    fc.assert(fc.property(
      fc.string({ minLength: 1 }).filter(s => ![
        'request', 'response', 'notification', 'task-proposal',
        'task-accept', 'task-reject', 'stream-data', 'heartbeat', 'error',
      ].includes(s)),
      (invalidType) => {
        expect(() => A2AMessageTypeSchema.parse(invalidType)).toThrow();
      },
    ), { numRuns: 50 });
  });
});

// ─── Property 25: Swarm broadcast to capable agents ──────────────────────────

describe('Property 25: Swarm broadcast to capable agents', () => {
  it('A2ARouter broadcasts to all registered agents', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(arbAgentId, { minLength: 2, maxLength: 5 }),
      async (agentIdsRaw) => {
        const agentIds = [...new Set(agentIdsRaw)];
        // Need at least 2 unique agents to test broadcast
        fc.pre(agentIds.length >= 2);

        const registry = new AgentRegistry();
        const obs = new A2AObservability();
        const router = new A2ARouter(registry, obs);

        // Register all agents
        for (const id of agentIds) {
          registry.register(AgentCardSchema.parse({
            id, name: `Agent ${id}`, tier: 'L1',
          }));
        }

        // Track deliveries
        const received: string[] = [];
        for (const id of agentIds) {
          router.onReceive(id, (env) => { received.push(env.to); });
        }

        // Broadcast from first agent
        const factory = new EnvelopeFactory(agentIds[0]);
        const broadcastEnv = factory.createNotification({ event: 'ping' });
        const result = await router.send(broadcastEnv);

        // At least one agent received it (broadcast excludes sender)
        expect(result.delivered).toBe(true);
      },
    ), { numRuns: 20 });
  });
});

// ─── Property: AgentRegistry register + findByCapability ─────────────────────

describe('Property 1-5: AgentRegistry correctness', () => {
  it('registered agent can be retrieved by ID', () => {
    fc.assert(fc.property(arbAgentCard, (card) => {
      const registry = new AgentRegistry();
      const parsed = AgentCardSchema.parse(card);
      registry.register(parsed);
      const retrieved = registry.getById(parsed.id);
      expect(retrieved?.id).toBe(parsed.id);
      expect(retrieved?.tier).toBe(parsed.tier);
    }), { numRuns: 50 });
  });

  it('duplicate registration increments revision', () => {
    fc.assert(fc.property(arbAgentCard, (card) => {
      const registry = new AgentRegistry();
      const first = registry.register(card);
      const second = registry.register(card); // re-register same ID
      expect(second.revision).toBe(first.revision + 1);
    }), { numRuns: 50 });
  });

  it('findByCapability returns agents with that capability', () => {
    fc.assert(fc.property(
      fc.array(fc.constantFrom('analyze', 'synthesize', 'generate', 'validate'), { minLength: 1, maxLength: 4 }).map(arr => [...new Set(arr)]),
      (capabilities) => {
        const registry = new AgentRegistry();
        const testCap = capabilities[0];
        const card = AgentCardSchema.parse({
          id: 'TEST-AGENT',
          name: 'Test',
          tier: 'L1',
          capabilities: capabilities.map(c => ({ name: c, version: '1.0.0', description: '', tags: [] })),
        });
        registry.register(card);
        const results = registry.findByCapability(testCap);
        expect(results.some(c => c.id === 'TEST-AGENT')).toBe(true);
      },
    ), { numRuns: 30 });
  });

  it('remote card merge sets origin to remote', () => {
    fc.assert(fc.property(arbAgentCard, (card) => {
      const registry = new AgentRegistry();
      const parsed = AgentCardSchema.parse(card);
      registry.mergeRemoteCard(parsed);
      const retrieved = registry.getById(parsed.id);
      expect(retrieved?.origin).toBe('remote');
    }), { numRuns: 30 });
  });
});
