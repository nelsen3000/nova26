// ATLAS Bridge tests - K3-08
import { describe, it, expect, beforeEach } from 'vitest';
import { ATLASBridge, createATLASBridge } from './atlas-bridge.js';
import { createHindsightEngine } from './engine.js';
import type { BuildLog, HindsightEngine, MemoryFragment } from './types.js';

function makeBuildLog(overrides: Partial<BuildLog> = {}): BuildLog {
  return {
    buildId: 'build-001',
    agentId: 'agent-test',
    projectId: 'proj-test',
    timestamp: Date.now(),
    success: true,
    output: 'Build completed successfully',
    errors: [],
    durationMs: 5000,
    ...overrides,
  };
}

async function getAllFragments(engine: HindsightEngine): Promise<MemoryFragment[]> {
  const json = await engine.exportMemories();
  return JSON.parse(json);
}

describe('ATLASBridge', () => {
  let engine: HindsightEngine;
  let bridge: ATLASBridge;

  beforeEach(async () => {
    engine = createHindsightEngine({ storageType: 'memory' });
    await engine.initialize();
    bridge = createATLASBridge(engine);
  });

  describe('onBuildLogged', () => {
    it('stores a memory fragment for a successful build', async () => {
      const log = makeBuildLog({ success: true });
      await bridge.onBuildLogged(log);

      const frags = await getAllFragments(engine);
      expect(frags.length).toBeGreaterThan(0);
    });

    it('stores a memory fragment for a failed build', async () => {
      const log = makeBuildLog({
        success: false,
        errors: ['TypeError: undefined is not a function'],
      });
      await bridge.onBuildLogged(log);

      const frags = await getAllFragments(engine);
      expect(frags.length).toBeGreaterThan(0);
      expect(frags[0].content).toContain('FAILURE');
    });

    it('failed builds have higher relevance than successful ones', async () => {
      await bridge.onBuildLogged(makeBuildLog({ success: true, buildId: 'ok' }));
      await bridge.onBuildLogged(makeBuildLog({ success: false, buildId: 'fail', errors: ['err'] }));

      const frags = await getAllFragments(engine);
      const failFrag = frags.find(f => f.content.includes('FAILURE'));
      const okFrag = frags.find(f => f.content.includes('SUCCESS'));
      expect(failFrag).toBeDefined();
      expect(okFrag).toBeDefined();
      if (failFrag && okFrag) {
        expect(failFrag.relevance).toBeGreaterThan(okFrag.relevance);
      }
    });

    it('sets build provenance sourceType', async () => {
      await bridge.onBuildLogged(makeBuildLog({ buildId: 'bld-123' }));
      const frags = await getAllFragments(engine);
      expect(frags[0].provenance.sourceType).toBe('build');
      expect(frags[0].provenance.sourceId).toBe('bld-123');
    });

    it('includes build tags', async () => {
      await bridge.onBuildLogged(makeBuildLog({ success: true }));
      const frags = await getAllFragments(engine);
      expect(frags[0].tags).toContain('build');
      expect(frags[0].tags).toContain('success');
    });
  });

  describe('onRetrospectiveComplete', () => {
    it('stores semantic fragments for each insight', async () => {
      const insights = ['Insight 1: Use caching', 'Insight 2: Reduce complexity'];
      await bridge.onRetrospectiveComplete('proj-test', 'agent-test', insights);

      const frags = await getAllFragments(engine);
      expect(frags.length).toBeGreaterThanOrEqual(2);
    });

    it('stores with retrospective provenance', async () => {
      await bridge.onRetrospectiveComplete('proj-x', 'agent-x', ['Key learning']);
      const frags = await getAllFragments(engine);
      expect(frags[0].provenance.sourceType).toBe('retrospective');
    });

    it('each insight becomes its own fragment', async () => {
      const insights = ['first', 'second', 'third'];
      await bridge.onRetrospectiveComplete('p', 'a', insights);
      const frags = await getAllFragments(engine);
      expect(frags).toHaveLength(3);
    });

    it('handles empty insights array without error', async () => {
      await expect(
        bridge.onRetrospectiveComplete('proj', 'agent', [])
      ).resolves.not.toThrow();
    });
  });

  describe('mapSemanticTags', () => {
    it('maps agent: prefix to agent-', () => {
      const result = bridge.mapSemanticTags(['agent:alice', 'agent:bob']);
      expect(result).toContain('agent-alice');
      expect(result).toContain('agent-bob');
    });

    it('maps project: prefix to project-', () => {
      const result = bridge.mapSemanticTags(['project:nova26']);
      expect(result).toContain('project-nova26');
    });

    it('maps domain: prefix to domain-', () => {
      const result = bridge.mapSemanticTags(['domain:llm']);
      expect(result).toContain('domain-llm');
    });

    it('passes through unknown tags unchanged', () => {
      const result = bridge.mapSemanticTags(['custom-tag', 'another']);
      expect(result).toContain('custom-tag');
      expect(result).toContain('another');
    });

    it('removes duplicate mapped tags', () => {
      const result = bridge.mapSemanticTags(['agent:x', 'agent:x']);
      const count = result.filter(t => t === 'agent-x').length;
      expect(count).toBe(1);
    });

    it('returns empty array for empty input', () => {
      expect(bridge.mapSemanticTags([])).toHaveLength(0);
    });
  });

  describe('enrichRetrieval', () => {
    it('returns base context when enrichment disabled', async () => {
      const disabledBridge = createATLASBridge(engine, { enableEnrichment: false });
      const baseContext = {
        fragments: [],
        formattedContext: 'base',
        tokenCount: 10,
        relevanceScores: {},
      };
      const result = await disabledBridge.enrichRetrieval(baseContext, 'query');
      expect(result).toBe(baseContext);
    });

    it('returns context (with graceful fallback) when enrichment enabled', async () => {
      const baseContext = {
        fragments: [],
        formattedContext: 'base',
        tokenCount: 5,
        relevanceScores: {},
      };
      const result = await bridge.enrichRetrieval(baseContext, 'some query');
      expect(result).toBeDefined();
      expect(result.formattedContext).toBeTruthy();
    });
  });
});
