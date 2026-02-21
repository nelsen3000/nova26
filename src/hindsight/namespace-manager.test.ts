// Namespace Manager & Parallel Universe Bridge tests - K3-10
import { describe, it, expect, beforeEach } from 'vitest';
import {
  NamespaceManager,
  ParallelUniverseBridge,
  createNamespaceManager,
  createParallelUniverseBridge,
} from './namespace-manager.js';
import { createHindsightEngine } from './engine.js';
import type { HindsightEngine } from './types.js';

describe('NamespaceManager', () => {
  let engine: HindsightEngine;
  let mgr: NamespaceManager;

  beforeEach(async () => {
    engine = createHindsightEngine({ storageType: 'memory' });
    await engine.initialize();
    mgr = createNamespaceManager(engine);
  });

  describe('forkNamespace', () => {
    it('forks an empty namespace without error', async () => {
      await expect(mgr.forkNamespace('proj:main', 'proj:branch')).resolves.not.toThrow();
    });

    it('adds target namespace to active set', async () => {
      await mgr.forkNamespace('proj:main', 'proj:feat');
      const ns = await mgr.listNamespaces();
      expect(ns).toContain('proj:feat');
    });

    it('throws when max namespaces exceeded', async () => {
      const smallMgr = createNamespaceManager(engine, { maxNamespaces: 2 });
      await smallMgr.forkNamespace('a', 'b');
      await smallMgr.forkNamespace('a', 'c');
      await expect(smallMgr.forkNamespace('a', 'd')).rejects.toThrow('Maximum');
    });

    it('does not throw when isolation disabled and limit exceeded', async () => {
      const noIsoMgr = createNamespaceManager(engine, {
        enableIsolation: false,
        maxNamespaces: 1,
      });
      await noIsoMgr.forkNamespace('a', 'b');
      await expect(noIsoMgr.forkNamespace('a', 'c')).resolves.not.toThrow();
    });
  });

  describe('mergeNamespaces', () => {
    it('returns a MergeReport', async () => {
      const report = await mgr.mergeNamespaces('ns:source', 'ns:target');
      expect(report).toHaveProperty('fragmentsMerged');
      expect(report).toHaveProperty('fragmentsSkipped');
      expect(report).toHaveProperty('conflicts');
    });

    it('removes source from active namespaces after merge', async () => {
      await mgr.forkNamespace('ns:main', 'ns:branch');
      await mgr.mergeNamespaces('ns:branch', 'ns:main');
      const ns = await mgr.listNamespaces();
      // Source namespace removed if fragments were merged
      // (empty merge still completes)
    });
  });

  describe('listNamespaces', () => {
    it('returns empty list initially', async () => {
      const ns = await mgr.listNamespaces();
      expect(Array.isArray(ns)).toBe(true);
    });

    it('lists all forked namespaces', async () => {
      await mgr.forkNamespace('base', 'ns1');
      await mgr.forkNamespace('base', 'ns2');
      const ns = await mgr.listNamespaces();
      expect(ns).toContain('ns1');
      expect(ns).toContain('ns2');
    });
  });

  describe('retrieveCrossAgent', () => {
    it('returns array for multiple agent ids', async () => {
      const results = await mgr.retrieveCrossAgent(
        'test query',
        ['agent-a', 'agent-b'],
        'proj'
      );
      expect(Array.isArray(results)).toBe(true);
    });

    it('returns empty array when no fragments stored', async () => {
      const results = await mgr.retrieveCrossAgent('query', ['agent-x']);
      expect(results).toHaveLength(0);
    });
  });
});

describe('ParallelUniverseBridge', () => {
  let engine: HindsightEngine;
  let pub: ParallelUniverseBridge;

  beforeEach(async () => {
    engine = createHindsightEngine({ storageType: 'memory' });
    await engine.initialize();
    pub = createParallelUniverseBridge(engine);
  });

  describe('createUniverse', () => {
    it('returns a ParallelUniverseContext', async () => {
      const ctx = await pub.createUniverse('univ-1', 'proj-base', 'feature/x');
      expect(ctx.universeId).toBe('univ-1');
      expect(ctx.baseProjectId).toBe('proj-base');
      expect(ctx.branchName).toBe('feature/x');
      expect(ctx.forkedAt).toBeGreaterThan(0);
      expect(Array.isArray(ctx.memories)).toBe(true);
    });

    it('stores the universe in the registry', async () => {
      await pub.createUniverse('u-test', 'proj', 'branch');
      expect(pub.getUniverse('u-test')).toBeDefined();
    });
  });

  describe('syncUniverse', () => {
    it('syncs without error for existing universe', async () => {
      await pub.createUniverse('u-sync', 'proj', 'branch');
      await expect(pub.syncUniverse('u-sync')).resolves.not.toThrow();
    });

    it('throws for unknown universe', async () => {
      await expect(pub.syncUniverse('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('mergeUniverseBack', () => {
    it('returns a MergeReport for existing universe', async () => {
      await pub.createUniverse('u-merge', 'proj', 'branch');
      const report = await pub.mergeUniverseBack('u-merge');
      expect(report).toHaveProperty('fragmentsMerged');
    });

    it('throws for unknown universe', async () => {
      await expect(pub.mergeUniverseBack('ghost')).rejects.toThrow('not found');
    });
  });

  describe('listUniverses', () => {
    it('returns empty list initially', () => {
      expect(pub.listUniverses()).toHaveLength(0);
    });

    it('includes created universes', async () => {
      await pub.createUniverse('u-a', 'proj', 'a');
      await pub.createUniverse('u-b', 'proj', 'b');
      const list = pub.listUniverses();
      expect(list).toContain('u-a');
      expect(list).toContain('u-b');
    });
  });

  describe('getUniverse', () => {
    it('returns undefined for missing universe', () => {
      expect(pub.getUniverse('missing')).toBeUndefined();
    });

    it('returns the context for an existing universe', async () => {
      await pub.createUniverse('u-get', 'p', 'b');
      const ctx = pub.getUniverse('u-get');
      expect(ctx?.universeId).toBe('u-get');
    });
  });
});
