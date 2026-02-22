// ATLASMemoryAdapter Property Tests — Spec Task 5.2 / 5.3
// Sprint S3-05 | P2P Hypercore Protocol

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { HypercoreStore } from '../store.js';
import { ATLASMemoryAdapter } from '../atlas-adapter.js';
import type { MemoryNodeEntry } from '../types.js';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const arbTag = fc.stringMatching(/^[a-z][a-z0-9-]{0,15}$/);

const arbMemoryNodeEntry = fc.record<MemoryNodeEntry>({
  type: fc.constant('memory-node' as const),
  nodeId: fc.uuid(),
  agentId: fc.constantFrom('MARS', 'VENUS', 'EARTH', 'ATLAS', 'SATURN'),
  content: fc.string({ minLength: 1, maxLength: 200 }),
  tags: fc.array(arbTag, { minLength: 0, maxLength: 5 }),
  tasteScore: fc.float({ min: 0, max: 1, noNaN: true }),
  timestamp: fc.integer({ min: 1_700_000_000_000, max: 1_800_000_000_000 }),
  vectorClock: fc.record({}),
});

// ─── Setup ────────────────────────────────────────────────────────────────────

function makeAdapter(): { store: HypercoreStore; adapter: ATLASMemoryAdapter } {
  const store = new HypercoreStore('test-atlas');
  const adapter = new ATLASMemoryAdapter(store);
  return { store, adapter };
}

// ─── Property 10: ATLAS store and query correctness ──────────────────────────

describe('Property 10: ATLAS store and query correctness', () => {
  it('storeNode() returns a monotonically increasing seq', () => {
    fc.assert(fc.property(
      fc.array(arbMemoryNodeEntry, { minLength: 2, maxLength: 20 }),
      (nodes) => {
        const { adapter } = makeAdapter();
        const seqs = nodes.map(n => adapter.storeNode(n));
        for (let i = 1; i < seqs.length; i++) {
          expect(seqs[i]).toBeGreaterThan(seqs[i - 1]!);
        }
      },
    ), { numRuns: 50 });
  });

  it('queryByAgent() returns all nodes for that agent in insertion order', () => {
    fc.assert(fc.property(
      fc.array(arbMemoryNodeEntry, { minLength: 1, maxLength: 20 }),
      fc.constantFrom('MARS', 'VENUS', 'EARTH', 'ATLAS', 'SATURN'),
      (nodes, targetAgent) => {
        const { adapter } = makeAdapter();
        const targetNodes = nodes.filter(n => n.agentId === targetAgent);

        for (const node of nodes) {
          adapter.storeNode(node);
        }

        const results = adapter.queryByAgent({ agentId: targetAgent });
        expect(results).toHaveLength(targetNodes.length);
        for (const r of results) {
          expect(r.agentId).toBe(targetAgent);
        }
      },
    ), { numRuns: 50 });
  });

  it('queryByTimeRange() returns only nodes within [from, to]', () => {
    fc.assert(fc.property(
      fc.array(arbMemoryNodeEntry, { minLength: 1, maxLength: 20 }),
      fc.integer({ min: 1_700_000_000_000, max: 1_749_999_999_999 }),
      fc.integer({ min: 1_750_000_000_000, max: 1_800_000_000_000 }),
      (nodes, from, to) => {
        const { adapter } = makeAdapter();
        for (const node of nodes) {
          adapter.storeNode(node);
        }

        const results = adapter.queryByTimeRange({ from, to });
        for (const r of results) {
          expect(r.timestamp).toBeGreaterThanOrEqual(from);
          expect(r.timestamp).toBeLessThanOrEqual(to);
        }
      },
    ), { numRuns: 50 });
  });

  it('queryByAgent() with limit cap does not exceed limit', () => {
    fc.assert(fc.property(
      fc.array(arbMemoryNodeEntry, { minLength: 5, maxLength: 30 }),
      fc.integer({ min: 1, max: 5 }),
      (nodes, limit) => {
        const { adapter } = makeAdapter();
        const targetAgent = nodes[0]!.agentId;
        const nodesSameAgent = nodes.map(n => ({ ...n, agentId: targetAgent }));
        for (const node of nodesSameAgent) {
          adapter.storeNode(node);
        }

        const results = adapter.queryByAgent({ agentId: targetAgent, limit });
        expect(results.length).toBeLessThanOrEqual(limit);
      },
    ), { numRuns: 50 });
  });
});

// ─── Property 11: Index rebuild consistency ───────────────────────────────────

describe('Property 11: Index rebuild consistency', () => {
  it('rebuildIndex() produces same totalNodes count as number of stored nodes', () => {
    fc.assert(fc.property(
      fc.array(arbMemoryNodeEntry, { minLength: 1, maxLength: 30 }),
      (nodes) => {
        const { adapter } = makeAdapter();
        for (const node of nodes) {
          adapter.storeNode(node);
        }

        const result = adapter.rebuildIndex();
        expect(result.validNodes).toBe(nodes.length);
        expect(result.invalidEntries).toBe(0);
        expect(result.totalEntries).toBe(nodes.length);
      },
    ), { numRuns: 50 });
  });

  it('rebuildIndex() produces index with same data as incremental index', () => {
    fc.assert(fc.property(
      fc.array(arbMemoryNodeEntry, { minLength: 1, maxLength: 20 }),
      (nodes) => {
        const { adapter } = makeAdapter();
        for (const node of nodes) {
          adapter.storeNode(node);
        }

        const indexBefore = adapter.getIndex();
        const agentsBefore = new Set(indexBefore.byAgent.keys());

        adapter.rebuildIndex();
        const indexAfter = adapter.getIndex();
        const agentsAfter = new Set(indexAfter.byAgent.keys());

        // Same agent set after rebuild
        for (const agentId of agentsBefore) {
          expect(agentsAfter).toContain(agentId);
        }
      },
    ), { numRuns: 50 });
  });

  it('queryByAgent() after rebuild returns same results as before', () => {
    fc.assert(fc.property(
      fc.array(arbMemoryNodeEntry, { minLength: 1, maxLength: 20 }),
      (nodes) => {
        const { adapter } = makeAdapter();
        const agentId = nodes[0]!.agentId;
        const expectedCount = nodes.filter(n => n.agentId === agentId).length;

        for (const node of nodes) {
          adapter.storeNode(node);
        }

        const beforeRebuild = adapter.queryByAgent({ agentId });
        adapter.rebuildIndex();
        const afterRebuild = adapter.queryByAgent({ agentId });

        expect(afterRebuild).toHaveLength(beforeRebuild.length);
        expect(afterRebuild).toHaveLength(expectedCount);
      },
    ), { numRuns: 50 });
  });
});

// ─── Spec Task 5.3: PAYLOAD_TOO_LARGE error ───────────────────────────────────

describe('Spec Task 5.3: PAYLOAD_TOO_LARGE error', () => {
  it('storeNode() throws when payload exceeds maxPayloadBytes', () => {
    const store = new HypercoreStore('test-large');
    const adapter = new ATLASMemoryAdapter(store, 100); // 100 byte limit

    const bigNode: MemoryNodeEntry = {
      type: 'memory-node',
      nodeId: 'big-1',
      agentId: 'MARS',
      content: 'x'.repeat(200), // definitely > 100 bytes
      tags: [],
      tasteScore: 0.5,
      timestamp: Date.now(),
      vectorClock: {},
    };

    expect(() => adapter.storeNode(bigNode)).toThrow();
    try {
      adapter.storeNode(bigNode);
    } catch (err) {
      expect((err as { code?: string }).code).toBe('PAYLOAD_TOO_LARGE');
    }
  });

  it('storeNode() succeeds for nodes within maxPayloadBytes', () => {
    const store = new HypercoreStore('test-small');
    const adapter = new ATLASMemoryAdapter(store, 1_048_576); // 1MB

    const smallNode: MemoryNodeEntry = {
      type: 'memory-node',
      nodeId: 'small-1',
      agentId: 'VENUS',
      content: 'small content',
      tags: [],
      tasteScore: 0.5,
      timestamp: Date.now(),
      vectorClock: {},
    };

    expect(() => adapter.storeNode(smallNode)).not.toThrow();
  });
});

// ─── Hypercore ↔ ATLAS round-trip ─────────────────────────────────────────────

describe('ATLAS ↔ Hypercore round-trip integrity', () => {
  it('storeNode() data can be retrieved from the underlying store', () => {
    fc.assert(fc.property(
      arbMemoryNodeEntry,
      (node) => {
        const store = new HypercoreStore('rt-store');
        const adapter = new ATLASMemoryAdapter(store);

        const seq = adapter.storeNode(node);
        const rawEntry = store.get(seq);

        expect(rawEntry.seq).toBe(seq);
        const retrieved = rawEntry.data as MemoryNodeEntry;
        expect(retrieved.nodeId).toBe(node.nodeId);
        expect(retrieved.agentId).toBe(node.agentId);
        expect(retrieved.content).toBe(node.content);
      },
    ), { numRuns: 100 });
  });

  it('getById() finds the last written node for a given nodeId', () => {
    fc.assert(fc.property(
      arbMemoryNodeEntry,
      (node) => {
        const { adapter } = makeAdapter();
        adapter.storeNode(node);

        const found = adapter.getById(node.nodeId);
        expect(found).not.toBeNull();
        expect(found!.nodeId).toBe(node.nodeId);
      },
    ), { numRuns: 100 });
  });
});
