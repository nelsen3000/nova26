// Tests for Nova Symbiont Core
// KIMI-VISIONARY-04

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SymbiontCore, type SymbiontState, type CreativeStyleProfile } from './symbiont-core.js';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('SymbiontCore', () => {
  let engine: SymbiontCore;
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), 'nova-symbiont-test-' + Date.now());
    mkdirSync(tempDir, { recursive: true });
    dbPath = join(tempDir, 'symbiont.db');
    engine = new SymbiontCore({ dbPath });
  });

  afterEach(async () => {
    await engine.resetSymbiont();
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('initSymbiont', () => {
    it('initializes a new Symbiont', async () => {
      const state = await engine.initSymbiont();

      expect(state).toBeDefined();
      expect(state.id).toBeDefined();
      expect(state.userId).toBeDefined();
      expect(state.tasteDNA).toEqual([]);
      expect(state.totalInteractions).toBe(0);
      expect(state.totalBuilds).toBe(0);
      expect(state.maturityLevel).toBe('nascent');
      expect(state.createdAt).toBeDefined();
      expect(state.lastActiveAt).toBeDefined();
    });

    it('loads existing Symbiont from storage', async () => {
      const state1 = await engine.initSymbiont();
      const id1 = state1.id;

      // Create new engine instance with same DB
      const engine2 = new SymbiontCore({ dbPath });
      const state2 = await engine2.initSymbiont();

      expect(state2.id).toBe(id1);
    });
  });

  describe('getSymbiont', () => {
    it('returns undefined before initialization', () => {
      expect(engine.getSymbiont()).toBeUndefined();
    });

    it('returns state after initialization', async () => {
      await engine.initSymbiont();
      const state = engine.getSymbiont();

      expect(state).toBeDefined();
      expect(state?.maturityLevel).toBe('nascent');
    });
  });

  describe('updateTasteDNA', () => {
    it('updates taste DNA', async () => {
      await engine.initSymbiont();

      engine.updateTasteDNA({ 'dark-mode': 0.8, 'minimal': 0.9 });

      const state = engine.getSymbiont();
      expect(state?.tasteDNA.length).toBeGreaterThan(0);
    });

    it('increments total interactions', async () => {
      await engine.initSymbiont();

      engine.updateTasteDNA({ 'key1': 0.5 });
      expect(engine.getSymbiont()?.totalInteractions).toBe(1);

      engine.updateTasteDNA({ 'key2': 0.7 });
      expect(engine.getSymbiont()?.totalInteractions).toBe(2);
    });

    it('taste DNA is a valid embedding vector', async () => {
      await engine.initSymbiont();

      engine.updateTasteDNA({ 'a': 0.5, 'b': 0.7, 'c': 0.3 });

      const dna = engine.getSymbiont()?.tasteDNA;
      expect(Array.isArray(dna)).toBe(true);
      expect(dna?.every(n => typeof n === 'number')).toBe(true);
    });
  });

  describe('maturity levels', () => {
    it('starts at nascent', async () => {
      const state = await engine.initSymbiont();
      expect(state.maturityLevel).toBe('nascent');
    });

    it('progresses to growing at 11 interactions', async () => {
      await engine.initSymbiont();

      // Simulate 11 interactions
      for (let i = 0; i < 11; i++) {
        engine.updateTasteDNA({ [`key${i}`]: 0.5 });
      }

      expect(engine.getSymbiont()?.maturityLevel).toBe('growing');
    });

    it('progresses to mature at 51 interactions', async () => {
      await engine.initSymbiont();

      for (let i = 0; i < 51; i++) {
        engine.updateTasteDNA({ [`key${i}`]: 0.5 });
      }

      expect(engine.getSymbiont()?.maturityLevel).toBe('mature');
    });

    it('progresses to evolved at 201 interactions', async () => {
      await engine.initSymbiont();

      for (let i = 0; i < 201; i++) {
        engine.updateTasteDNA({ [`key${i}`]: 0.5 });
      }

      expect(engine.getSymbiont()?.maturityLevel).toBe('evolved');
    });

    it('getMaturityLevel returns correct level', async () => {
      await engine.initSymbiont();
      expect(engine.getMaturityLevel()).toBe('nascent');

      for (let i = 0; i < 11; i++) {
        engine.updateTasteDNA({ [`key${i}`]: 0.5 });
      }

      expect(engine.getMaturityLevel()).toBe('growing');
    });
  });

  describe('recordDecision', () => {
    it('records a decision', async () => {
      await engine.initSymbiont();

      const entry = engine.recordDecision({
        buildId: 'build-123',
        decision: 'Use functional components',
        rationale: 'Better testability',
        alternatives: ['Class components', 'Mixins'],
        outcome: 'positive',
      });

      expect(entry).toBeDefined();
      expect(entry.id).toBeDefined();
      expect(entry.createdAt).toBeDefined();
      expect(entry.decision).toBe('Use functional components');
    });

    it('throws when not initialized', () => {
      expect(() => {
        engine.recordDecision({
          buildId: 'build-123',
          decision: 'Test',
          rationale: 'Test rationale',
          alternatives: [],
          outcome: 'neutral',
        });
      }).toThrow('Symbiont not initialized');
    });
  });

  describe('getDecisionJournal', () => {
    it('retrieves decision journal', async () => {
      await engine.initSymbiont();

      engine.recordDecision({
        buildId: 'build-1',
        decision: 'Decision 1',
        rationale: 'Why 1',
        alternatives: [],
        outcome: 'positive',
      });

      engine.recordDecision({
        buildId: 'build-2',
        decision: 'Decision 2',
        rationale: 'Why 2',
        alternatives: [],
        outcome: 'neutral',
      });

      engine.recordDecision({
        buildId: 'build-3',
        decision: 'Decision 3',
        rationale: 'Why 3',
        alternatives: [],
        outcome: 'negative',
      });

      const entries = engine.getDecisionJournal();

      expect(entries.length).toBe(3);
    });

    it('decision journal respects limit', async () => {
      await engine.initSymbiont();

      for (let i = 0; i < 5; i++) {
        engine.recordDecision({
          buildId: `build-${i}`,
          decision: `Decision ${i}`,
          rationale: `Why ${i}`,
          alternatives: [],
          outcome: 'positive',
        });
      }

      const entries = engine.getDecisionJournal(2);

      expect(entries.length).toBe(2);
    });
  });

  describe('generateInsight', () => {
    it('generates an insight', async () => {
      await engine.initSymbiont();

      const insight = await engine.generateInsight();

      expect(insight).toBeDefined();
      expect(insight?.status).toBe('pending');
      expect(insight?.confidence).toBeGreaterThan(0);
      expect(insight?.confidence).toBeLessThanOrEqual(1);
    });

    it('returns null when insightGenerationEnabled is false', async () => {
      const disabledEngine = new SymbiontCore({ 
        dbPath: join(tempDir, 'disabled.db'),
        insightGenerationEnabled: false 
      });
      await disabledEngine.initSymbiont();

      const insight = await disabledEngine.generateInsight();

      expect(insight).toBeNull();
    });

    it('respects maxInsightsPerDay', async () => {
      const limitedEngine = new SymbiontCore({ 
        dbPath: join(tempDir, 'limited.db'),
        maxInsightsPerDay: 2 
      });
      await limitedEngine.initSymbiont();

      const insight1 = await limitedEngine.generateInsight();
      const insight2 = await limitedEngine.generateInsight();
      const insight3 = await limitedEngine.generateInsight();

      expect(insight1).toBeDefined();
      expect(insight2).toBeDefined();
      expect(insight3).toBeNull();

      await limitedEngine.resetSymbiont();
    });
  });

  describe('getInsights', () => {
    it('gets insights filtered by status', async () => {
      await engine.initSymbiont();

      const insight1 = await engine.generateInsight();
      const insight2 = await engine.generateInsight();

      if (insight1) engine.acceptInsight(insight1.id);

      const pending = engine.getInsights({ status: 'pending' });
      const accepted = engine.getInsights({ status: 'accepted' });

      expect(pending.length).toBe(1);
      expect(accepted.length).toBe(1);
    });

    it('gets insights filtered by type', async () => {
      await engine.initSymbiont();

      // Generate several insights
      await engine.generateInsight();
      await engine.generateInsight();
      await engine.generateInsight();

      const allTypes = ['pattern-suggestion', 'style-drift', 'proactive-idea', 'meta-reflection'];
      
      for (const type of allTypes) {
        const filtered = engine.getInsights({ type: type as any });
        // Just verify filtering works (may be 0 or more depending on random generation)
        expect(Array.isArray(filtered)).toBe(true);
      }
    });
  });

  describe('acceptInsight', () => {
    it('accepts an insight', async () => {
      await engine.initSymbiont();

      const insight = await engine.generateInsight();
      if (!insight) return;

      engine.acceptInsight(insight.id);

      const updated = engine.getInsights({ status: 'accepted' });
      expect(updated.length).toBe(1);
      expect(updated[0].status).toBe('accepted');
    });

    it('throws when insight not found', async () => {
      await engine.initSymbiont();

      expect(() => {
        engine.acceptInsight('non-existent-id');
      }).toThrow('Insight not found');
    });
  });

  describe('dismissInsight', () => {
    it('dismisses an insight', async () => {
      await engine.initSymbiont();

      const insight = await engine.generateInsight();
      if (!insight) return;

      engine.dismissInsight(insight.id);

      const updated = engine.getInsights({ status: 'dismissed' });
      expect(updated.length).toBe(1);
      expect(updated[0].status).toBe('dismissed');
    });

    it('throws when insight not found', async () => {
      await engine.initSymbiont();

      expect(() => {
        engine.dismissInsight('non-existent-id');
      }).toThrow('Insight not found');
    });
  });

  describe('creative profile', () => {
    it('gets creative profile', async () => {
      await engine.initSymbiont();

      const profile = engine.getCreativeProfile();

      expect(profile).toBeDefined();
      expect(profile.preferredPatterns).toEqual([]);
      expect(profile.avoidedPatterns).toEqual([]);
      expect(profile.layoutPreference).toBe('unknown');
      expect(profile.confidence).toBe(0);
    });

    it('updates creative profile', async () => {
      await engine.initSymbiont();

      engine.updateCreativeProfile({
        layoutPreference: 'minimal',
        preferredPatterns: ['singleton', 'factory'],
      });

      const profile = engine.getCreativeProfile();
      expect(profile.layoutPreference).toBe('minimal');
      expect(profile.preferredPatterns).toEqual(['singleton', 'factory']);
    });
  });

  describe('askSymbiont', () => {
    it('ask symbiont returns a response', async () => {
      await engine.initSymbiont();

      const response = await engine.askSymbiont('What color scheme?');

      expect(response).toBeTruthy();
      expect(response.length).toBeGreaterThan(0);
    });

    it('returns contextual responses', async () => {
      await engine.initSymbiont();

      const colorResponse = await engine.askSymbiont('What color scheme?');
      expect(colorResponse.length).toBeGreaterThan(0);

      const patternResponse = await engine.askSymbiont('What pattern?');
      expect(patternResponse.length).toBeGreaterThan(0);
    });
  });

  describe('resetSymbiont', () => {
    it('resets symbiont completely', async () => {
      await engine.initSymbiont();
      engine.updateTasteDNA({ 'key': 0.5 });

      await engine.resetSymbiont();

      expect(engine.getSymbiont()).toBeUndefined();
    });
  });

  describe('total interactions tracking', () => {
    it('tracks interactions correctly', async () => {
      await engine.initSymbiont();

      for (let i = 0; i < 5; i++) {
        engine.updateTasteDNA({ [`pref${i}`]: 0.5 });
      }

      expect(engine.getSymbiont()?.totalInteractions).toBe(5);
    });
  });
});
