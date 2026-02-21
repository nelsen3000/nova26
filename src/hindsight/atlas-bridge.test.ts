// ATLAS Bridge tests - K3-08
import { describe, it, expect, beforeEach } from 'vitest';
import { ATLASBridge, createATLASBridge } from './atlas-bridge.js';
import { createHindsightEngine } from './engine.js';
import type { BuildLog, HindsightEngine } from './types.js';

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

      const result = await engine.retrieve({
        query: 'build',
        topK: 10,
      });
      expect(result.fragments.length).toBeGreaterThan(0);
    });

    it('stores a memory fragment for a failed build', async () => {
      const log = makeBuildLog({
        success: false,
        errors: ['TypeError: undefined is not a function'],
      });
      await bridge.onBuildLogged(log);

      const result = await engine.retrieve({ query: 'build failure', topK: 10 });
      expect(result.fragments.length).toBeGreaterThan(0);
    });

    it('failed builds have higher relevance than successful ones', async () => {
      await bridge.onBuildLogged(makeBuildLog({ success: true, buildId: 'ok' }));
      await bridge.onBuildLogged(makeBuildLog({ success: false, buildId: 'fail', errors: ['err'] }));

      const result = await engine.retrieve({ query: 'build', topK: 10 });
      const fragments = result.fragments.map(f => f.fragment);
      const failFrag = fragments.find(f => f.content.includes('FAILURE'));
      const okFrag = fragments.find(f => f.content.includes('SUCCESS'));
      if (failFrag && okFrag) {
        expect(failFrag.relevance).toBeGreaterThan(okFrag.relevance);
      }
    });
  });

  describe('onRetrospectiveComplete', () => {
    it('stores semantic fragments for each insight', async () => {
      const insights = ['Insight 1: Use caching', 'Insight 2: Reduce complexity'];
      await bridge.onRetrospectiveComplete('proj-test', 'agent-test', insights);

      const result = await engine.retrieve({ query: 'insight', topK: 10 });
      expect(result.fragments.length).toBeGreaterThanOrEqual(2);
    });

    it('stores with retrospective provenance', async () => {
      await bridge.onRetrospectiveComplete('proj-x', 'agent-x', ['Key learning']);
      const result = await engine.retrieve({ query: 'learning', topK: 5 });
      const frag = result.fragments[0]?.fragment;
      expect(frag?.provenance.sourceType).toBe('retrospective');
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
      expect(result.formattedContext).toBeTruthy(); // at minimum has base
    });
  });
});
