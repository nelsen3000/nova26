// Taste Vault Bridge tests - K3-09
import { describe, it, expect, beforeEach } from 'vitest';
import { TasteVaultBridge, createTasteVaultBridge } from './taste-vault-bridge.js';
import { createHindsightEngine } from './engine.js';
import type { GraphNode, HindsightEngine } from './types.js';

function makeGraphNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: `node-${Math.random().toString(36).slice(2, 8)}`,
    content: 'Use dependency injection for testability',
    type: 'pattern',
    confidence: 0.85,
    tags: ['architecture', 'testing'],
    ...overrides,
  };
}

describe('TasteVaultBridge', () => {
  let engine: HindsightEngine;
  let bridge: TasteVaultBridge;

  beforeEach(async () => {
    engine = createHindsightEngine({ storageType: 'memory' });
    await engine.initialize();
    bridge = createTasteVaultBridge(engine);
  });

  describe('onPatternLearned', () => {
    it('stores a semantic fragment for a graph node', async () => {
      const node = makeGraphNode({ content: 'Prefer composition over inheritance' });
      await bridge.onPatternLearned(node);

      const result = await engine.retrieve({ query: 'composition', topK: 5 });
      expect(result.fragments.length).toBeGreaterThan(0);
    });

    it('uses node confidence as relevance', async () => {
      const node = makeGraphNode({ confidence: 0.92 });
      await bridge.onPatternLearned(node);

      const result = await engine.retrieve({ query: node.content, topK: 5 });
      const frag = result.fragments[0]?.fragment;
      expect(frag?.confidence).toBeCloseTo(0.92, 1);
    });

    it('includes taste-vault and pattern tags', async () => {
      const node = makeGraphNode({ tags: ['custom-tag'] });
      await bridge.onPatternLearned(node);

      const result = await engine.retrieve({ query: node.content, topK: 5 });
      const frag = result.fragments[0]?.fragment;
      expect(frag?.tags).toContain('taste-vault');
      expect(frag?.tags).toContain('pattern');
      expect(frag?.tags).toContain('custom-tag');
    });

    it('stores graphNodeId in extra metadata', async () => {
      const node = makeGraphNode({ id: 'special-node-id' });
      await bridge.onPatternLearned(node);

      const result = await engine.retrieve({ query: node.content, topK: 5 });
      const frag = result.fragments[0]?.fragment;
      expect(frag?.extra?.graphNodeId).toBe('special-node-id');
    });
  });

  describe('onPatternReinforced', () => {
    it('stores a reinforcement record', async () => {
      const node = makeGraphNode();
      await bridge.onPatternLearned(node);
      await bridge.onPatternReinforced(node.id, 0.2);

      const result = await engine.retrieve({ query: 'reinforcement', topK: 10 });
      const reinforcementFrags = result.fragments.filter(
        f => f.fragment.tags?.includes('reinforcement')
      );
      expect(reinforcementFrags.length).toBeGreaterThan(0);
    });

    it('does not throw for unknown pattern id', async () => {
      await expect(
        bridge.onPatternReinforced('nonexistent-id', 0.1)
      ).resolves.not.toThrow();
    });

    it('records boost amount in extra', async () => {
      const node = makeGraphNode();
      await bridge.onPatternLearned(node);
      await bridge.onPatternReinforced(node.id, 0.15);

      const result = await engine.retrieve({ query: 'reinforcement', topK: 10 });
      const reinFrag = result.fragments.find(
        f => f.fragment.tags?.includes('reinforcement')
      );
      expect(reinFrag?.fragment.extra?.boostAmount).toBe(0.15);
    });
  });

  describe('onConflictResolved', () => {
    it('stores a procedural fragment recording the resolution', async () => {
      await bridge.onConflictResolved(
        'conflict-001',
        'winner-node',
        'loser-node',
        'Use strict mode for all new modules'
      );

      const result = await engine.retrieve({ query: 'conflict', topK: 5 });
      expect(result.fragments.length).toBeGreaterThan(0);
    });

    it('includes conflict-resolution tag', async () => {
      await bridge.onConflictResolved('c-1', 'win', 'lose', 'resolution text');
      const result = await engine.retrieve({ query: 'conflict resolution', topK: 5 });
      const frag = result.fragments[0]?.fragment;
      expect(frag?.tags).toContain('conflict-resolution');
    });

    it('stores winner and loser ids in extra', async () => {
      await bridge.onConflictResolved('c-2', 'node-win', 'node-lose', 'chose A over B');
      const result = await engine.retrieve({ query: 'chose', topK: 5 });
      const frag = result.fragments[0]?.fragment;
      expect(frag?.extra?.winningPatternId).toBe('node-win');
      expect(frag?.extra?.losingPatternId).toBe('node-lose');
    });

    it('fragment type is procedural', async () => {
      await bridge.onConflictResolved('c-3', 'a', 'b', 'prefer X');
      const result = await engine.retrieve({ query: 'prefer', topK: 5 });
      const frag = result.fragments[0]?.fragment;
      expect(frag?.type).toBe('procedural');
    });
  });

  describe('supplementRetrieval', () => {
    it('returns existing results unchanged when supplemental disabled', async () => {
      const disabledBridge = createTasteVaultBridge(engine, { enableSupplementalSearch: false });
      const nodes = [makeGraphNode()];
      const result = await disabledBridge.supplementRetrieval(nodes, 'query');
      expect(result).toEqual(nodes);
    });

    it('returns at minimum the original Taste Vault results', async () => {
      const nodes = [makeGraphNode({ id: 'node-original' })];
      const result = await bridge.supplementRetrieval(nodes, 'dependency injection');
      expect(result.some(n => n.id === 'node-original')).toBe(true);
    });

    it('does not return duplicate ids from supplemental', async () => {
      const node = makeGraphNode({ id: 'unique-id' });
      await bridge.onPatternLearned(node);

      const result = await bridge.supplementRetrieval([node], node.content);
      const ids = result.map(n => n.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });
  });
});
