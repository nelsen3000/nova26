// Tests for Similarity Detection & Cross-Project Suggestions
// KIMI-PORTFOLIO-02

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimilarityEngine, type CrossProjectInsight } from './similarity-engine.js';
import type { PortfolioProject } from './portfolio-manifest.js';

describe('SimilarityEngine', () => {
  let engine: SimilarityEngine;

  beforeEach(() => {
    engine = new SimilarityEngine();
  });

  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      const a = [1, 0, 1];
      const b = [1, 0, 1];
      expect(engine.cosineSimilarity(a, b)).toBeCloseTo(1, 10);
    });

    it('returns 0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(engine.cosineSimilarity(a, b)).toBe(0);
    });

    it('returns -1 for opposite vectors', () => {
      const a = [1, 0];
      const b = [-1, 0];
      expect(engine.cosineSimilarity(a, b)).toBe(-1);
    });

    it('returns 0 for empty vectors', () => {
      expect(engine.cosineSimilarity([], [])).toBe(0);
    });

    it('returns 0 for zero vectors', () => {
      expect(engine.cosineSimilarity([0, 0, 0], [0, 0, 0])).toBe(0);
    });
  });

  describe('findSimilarProjects', () => {
    function createMockProject(
      id: string,
      name: string,
      fingerprint: number[],
      options: Partial<PortfolioProject> = {}
    ): PortfolioProject {
      return {
        id,
        name,
        path: `/projects/${name}`,
        type: 'dashboard',
        primaryLanguage: 'TypeScript',
        framework: 'React',
        firstBuildAt: new Date().toISOString(),
        lastBuildAt: new Date().toISOString(),
        totalBuilds: 5,
        aceScoreHistory: [],
        patternCount: 3,
        semanticFingerprint: fingerprint,
        isPrivate: false,
        isArchived: false,
        tags: [],
        ...options,
      };
    }

    it('finds similar projects above threshold', () => {
      const target = createMockProject('target', 'Target', [1, 0, 1, 0]);
      const similar = createMockProject('similar', 'Similar', [0.9, 0.1, 0.9, 0.1]); // High similarity
      const different = createMockProject('different', 'Different', [0, 1, 0, 1]); // Low similarity

      const results = engine.findSimilarProjects(target, [similar, different], () => 1.0);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.sourceProjectId === 'similar')).toBe(true);
    });

    it('excludes private projects', () => {
      const target = createMockProject('target', 'Target', [1, 0, 1, 0]);
      const privateProj = createMockProject('private', 'Private', [0.9, 0.1, 0.9, 0.1], { isPrivate: true });

      const engineWithExclude = new SimilarityEngine({ excludePrivateProjects: true });
      const results = engineWithExclude.findSimilarProjects(target, [privateProj], () => 1.0);

      expect(results.length).toBe(0);
    });

    it('excludes archived projects', () => {
      const target = createMockProject('target', 'Target', [1, 0, 1, 0]);
      const archived = createMockProject('archived', 'Archived', [0.9, 0.1, 0.9, 0.1], { isArchived: true });

      const results = engine.findSimilarProjects(target, [archived], () => 1.0);

      expect(results.length).toBe(0);
    });

    it('excludes the target project itself', () => {
      const target = createMockProject('target', 'Target', [1, 0, 1, 0]);

      const results = engine.findSimilarProjects(target, [target], () => 1.0);

      expect(results.length).toBe(0);
    });

    it('sorts by recency-weighted score descending', () => {
      const target = createMockProject('target', 'Target', [1, 0, 1, 0]);
      const old = createMockProject('old', 'Old', [0.95, 0.05, 0.95, 0.05], { lastBuildAt: '2020-01-01T00:00:00Z' });
      const recent = createMockProject('recent', 'Recent', [0.9, 0.1, 0.9, 0.1], { lastBuildAt: new Date().toISOString() });

      const recencyWeight = (date: string) => {
        return date.includes('2020') ? 0.6 : 1.0;
      };

      const results = engine.findSimilarProjects(target, [old, recent], recencyWeight);

      // Recent project should be first despite slightly lower raw similarity
      expect(results[0].sourceProjectId).toBe('recent');
    });

    it('filters below threshold', () => {
      const target = createMockProject('target', 'Target', [1, 0, 0, 0]);
      const lowSimilarity = createMockProject('low', 'Low', [0, 1, 0, 0]); // Orthogonal, similarity = 0

      const results = engine.findSimilarProjects(target, [lowSimilarity], () => 1.0);

      expect(results.length).toBe(0);
    });
  });

  describe('classifySimilarity', () => {
    it('classifies 0.75 as architecturally-similar', () => {
      expect(engine.classifySimilarity(0.75)).toBe('architecturally-similar');
    });

    it('classifies 0.85 as very-similar', () => {
      expect(engine.classifySimilarity(0.85)).toBe('very-similar');
    });

    it('classifies 0.95 as essentially-same', () => {
      expect(engine.classifySimilarity(0.95)).toBe('essentially-same');
    });

    it('classifies 0.50 as below-threshold', () => {
      expect(engine.classifySimilarity(0.50)).toBe('below-threshold');
    });
  });

  describe('generateInsight', () => {
    function createMockProject(id: string, name: string): PortfolioProject {
      return {
        id,
        name,
        path: `/projects/${name}`,
        type: 'dashboard',
        primaryLanguage: 'TypeScript',
        firstBuildAt: new Date().toISOString(),
        lastBuildAt: new Date().toISOString(),
        totalBuilds: 5,
        aceScoreHistory: [],
        patternCount: 3,
        semanticFingerprint: [],
        isPrivate: false,
        isArchived: false,
        tags: [],
      };
    }

    it('generates new-project-match insight', () => {
      const source = createMockProject('source', 'Source Project');
      const target = createMockProject('target', 'Target Project');
      const similarity = {
        sourceProjectId: 'source',
        targetProjectId: 'target',
        similarityScore: 0.85,
        recencyWeightedScore: 0.85,
        architecturalOverlap: ['same-type:dashboard', 'same-language:TypeScript'],
        computedAt: new Date().toISOString(),
      };

      const insight = engine.generateInsight(source, target, similarity);

      expect(insight.type).toBe('new-project-match');
      expect(insight.title).toContain('Source Project');
      expect(insight.description).toContain('very similar');
      expect(insight.actionAvailable).toBe(true);
      expect(insight.status).toBe('pending');
    });
  });

  describe('generateBetterPatternInsight', () => {
    function createMockProject(id: string, name: string): PortfolioProject {
      return {
        id,
        name,
        path: `/projects/${name}`,
        type: 'dashboard',
        primaryLanguage: 'TypeScript',
        firstBuildAt: new Date().toISOString(),
        lastBuildAt: new Date().toISOString(),
        totalBuilds: 5,
        aceScoreHistory: [],
        patternCount: 3,
        semanticFingerprint: [],
        isPrivate: false,
        isArchived: false,
        tags: [],
      };
    }

    it('generates better-pattern insight when delta meets threshold', () => {
      const source = createMockProject('source', 'Source');
      const target = createMockProject('target', 'Target');

      const insight = engine.generateBetterPatternInsight(source, target, 90, 70, 'auth-pattern');

      expect(insight).not.toBeNull();
      expect(insight?.type).toBe('better-pattern');
      expect(insight?.qualityDelta).toBe(20);
      expect(insight?.title).toContain('auth-pattern');
    });

    it('returns null when delta below threshold', () => {
      const source = createMockProject('source', 'Source');
      const target = createMockProject('target', 'Target');

      const insight = engine.generateBetterPatternInsight(source, target, 80, 70, 'auth-pattern');

      expect(insight).toBeNull(); // Delta of 10 < 15 threshold
    });
  });

  describe('createSuggestion', () => {
    it('creates suggestion linked to insight', () => {
      const insight: CrossProjectInsight = {
        id: 'insight-123',
        type: 'better-pattern',
        sourceProjectId: 'project-a',
        targetProjectId: 'project-b',
        title: 'Better pattern in A',
        description: 'Description',
        qualityDelta: 20,
        actionAvailable: true,
        generatedAt: new Date().toISOString(),
        status: 'pending',
      };

      const suggestion = engine.createSuggestion(insight, '/src/auth.ts', '/src/auth.ts', 'Apply better auth pattern');

      expect(suggestion.insightId).toBe('insight-123');
      expect(suggestion.qualityDelta).toBe(20);
      expect(suggestion.adaptationStatus).toBe('not-started');
    });
  });

  describe('acceptInsight', () => {
    it('accepts an insight', () => {
      const insight: CrossProjectInsight = {
        id: 'insight-123',
        type: 'new-project-match',
        sourceProjectId: 'project-a',
        title: 'Test',
        description: 'Test',
        actionAvailable: true,
        generatedAt: new Date().toISOString(),
        status: 'pending',
      };

      const accepted = engine.acceptInsight(insight);

      expect(accepted.status).toBe('accepted');
    });
  });

  describe('dismissInsight', () => {
    it('dismisses an insight', () => {
      const insight: CrossProjectInsight = {
        id: 'insight-123',
        type: 'new-project-match',
        sourceProjectId: 'project-a',
        title: 'Test',
        description: 'Test',
        actionAvailable: true,
        generatedAt: new Date().toISOString(),
        status: 'pending',
      };

      const dismissed = engine.dismissInsight(insight);

      expect(dismissed.status).toBe('dismissed');
    });
  });
});
