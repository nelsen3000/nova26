import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyRecommender } from './dependency-recommender.js';
import type {
  DependencyRecommendation,
  RecommendationRule,
  RecommendationReport,
  RecommendationPriority,
} from './dependency-recommender.js';
import type { ProjectProfile } from './framework-detector.js';

function createProfile(overrides: Partial<ProjectProfile> = {}): ProjectProfile {
  return {
    detectedFrameworks: [],
    packageManager: 'npm',
    inferredProjectType: null,
    hasTypeScript: true,
    hasTests: false,
    builtAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('DependencyRecommender', () => {
  let recommender: DependencyRecommender;

  beforeEach(() => {
    recommender = new DependencyRecommender();
  });

  // ── Constructor / built-in rules ──────────────────────────────────────

  it('should register exactly 8 built-in rules', () => {
    expect(recommender.getRecommendationRules()).toHaveLength(8);
  });

  it('should have unique UUIDs for all rules', () => {
    const ids = recommender.getRecommendationRules().map((r) => r.id);
    expect(new Set(ids).size).toBe(8);
  });

  it('should include rules for vitest, @types/node, eslint, prettier, @testing-library/react, zod, husky, tsx', () => {
    const names = recommender.getRecommendationRules().map((r) => r.packageName);
    expect(names).toContain('vitest');
    expect(names).toContain('@types/node');
    expect(names).toContain('eslint');
    expect(names).toContain('prettier');
    expect(names).toContain('@testing-library/react');
    expect(names).toContain('zod');
    expect(names).toContain('husky');
    expect(names).toContain('tsx');
  });

  // ── recommendForProfile ──────────────────────────────────────────────

  it('should recommend @types/node for TypeScript projects', () => {
    const profile = createProfile({ hasTypeScript: true });
    const recs = recommender.recommendForProfile(profile);
    expect(recs.find((r) => r.packageName === '@types/node')).toBeDefined();
  });

  it('should recommend vitest when no test framework is present', () => {
    const profile = createProfile({ hasTests: false, detectedFrameworks: [] });
    const recs = recommender.recommendForProfile(profile);
    expect(recs.find((r) => r.packageName === 'vitest')).toBeDefined();
  });

  it('should not recommend vitest when Vitest is already detected', () => {
    const profile = createProfile({
      detectedFrameworks: [
        { name: 'Vitest', category: 'testing', confidence: 1.0, detectedVia: 'package.json' },
      ],
    });
    const recs = recommender.recommendForProfile(profile);
    expect(recs.find((r) => r.packageName === 'vitest')).toBeUndefined();
  });

  it('should recommend @testing-library/react when React is detected', () => {
    const profile = createProfile({
      detectedFrameworks: [
        { name: 'React', category: 'frontend', confidence: 1.0, detectedVia: 'package.json' },
      ],
    });
    const recs = recommender.recommendForProfile(profile);
    expect(recs.find((r) => r.packageName === '@testing-library/react')).toBeDefined();
  });

  it('should not recommend @testing-library/react for non-React projects', () => {
    const profile = createProfile({
      detectedFrameworks: [
        { name: 'Express', category: 'backend', confidence: 1.0, detectedVia: 'package.json' },
      ],
    });
    const recs = recommender.recommendForProfile(profile);
    expect(recs.find((r) => r.packageName === '@testing-library/react')).toBeUndefined();
  });

  it('should recommend zod for api-server projects', () => {
    const profile = createProfile({ inferredProjectType: 'api-server' });
    const recs = recommender.recommendForProfile(profile);
    expect(recs.find((r) => r.packageName === 'zod')).toBeDefined();
  });

  it('should not recommend tsx when Next.js is detected', () => {
    const profile = createProfile({
      hasTypeScript: true,
      detectedFrameworks: [
        { name: 'Next.js', category: 'frontend', confidence: 1.0, detectedVia: 'package.json' },
      ],
    });
    const recs = recommender.recommendForProfile(profile);
    expect(recs.find((r) => r.packageName === 'tsx')).toBeUndefined();
  });

  it('should always recommend eslint and prettier', () => {
    const profile = createProfile();
    const recs = recommender.recommendForProfile(profile);
    expect(recs.find((r) => r.packageName === 'eslint')).toBeDefined();
    expect(recs.find((r) => r.packageName === 'prettier')).toBeDefined();
  });

  it('should assign unique UUIDs to each recommendation', () => {
    const recs = recommender.recommendForProfile(createProfile());
    const ids = recs.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // ── checkConflicts ───────────────────────────────────────────────────

  it('should detect conflict between vitest and jest', () => {
    const recs: DependencyRecommendation[] = [
      { id: '1', packageName: 'vitest', reason: '', priority: 'recommended', isDev: true, conflictsWith: ['jest'] },
      { id: '2', packageName: 'jest', reason: '', priority: 'recommended', isDev: true, conflictsWith: ['vitest'] },
    ];
    const conflicts = recommender.checkConflicts(recs);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].packageA).toBe('vitest');
    expect(conflicts[0].packageB).toBe('jest');
  });

  it('should return empty array when no conflicts', () => {
    const recs: DependencyRecommendation[] = [
      { id: '1', packageName: 'eslint', reason: '', priority: 'recommended', isDev: true, conflictsWith: [] },
    ];
    expect(recommender.checkConflicts(recs)).toEqual([]);
  });

  // ── suggestDevTools ──────────────────────────────────────────────────

  it('should return only dev dependencies from suggestDevTools', () => {
    const devTools = recommender.suggestDevTools(createProfile({ inferredProjectType: 'api-server' }));
    for (const tool of devTools) {
      expect(tool.isDev).toBe(true);
    }
  });

  it('should not include non-dev dependencies like zod in suggestDevTools', () => {
    const devTools = recommender.suggestDevTools(createProfile({ inferredProjectType: 'api-server' }));
    expect(devTools.find((r) => r.packageName === 'zod')).toBeUndefined();
  });

  // ── rankRecommendations ──────────────────────────────────────────────

  it('should rank required before recommended before optional', () => {
    const recs: DependencyRecommendation[] = [
      { id: '1', packageName: 'husky', reason: '', priority: 'optional', isDev: true, conflictsWith: [] },
      { id: '2', packageName: '@types/node', reason: '', priority: 'required', isDev: true, conflictsWith: [] },
      { id: '3', packageName: 'eslint', reason: '', priority: 'recommended', isDev: true, conflictsWith: [] },
    ];
    const ranked = recommender.rankRecommendations(recs);
    expect(ranked[0].priority).toBe('required');
    expect(ranked[1].priority).toBe('recommended');
    expect(ranked[2].priority).toBe('optional');
  });

  // ── generateReport ───────────────────────────────────────────────────

  it('should generate a complete report with all sections', () => {
    const report = recommender.generateReport(createProfile());
    expect(report.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(Array.isArray(report.conflicts)).toBe(true);
    expect(Array.isArray(report.devTools)).toBe(true);
    expect(new Date(report.generatedAt).toISOString()).toBe(report.generatedAt);
  });

  it('should rank recommendations in the report', () => {
    const report = recommender.generateReport(createProfile());
    for (let i = 1; i < report.recommendations.length; i++) {
      const order: Record<RecommendationPriority, number> = { required: 0, recommended: 1, optional: 2 };
      expect(order[report.recommendations[i - 1].priority]).toBeLessThanOrEqual(
        order[report.recommendations[i].priority],
      );
    }
  });

  it('should recommend husky as optional for all projects', () => {
    const recs = recommender.recommendForProfile(createProfile());
    const husky = recs.find((r) => r.packageName === 'husky');
    expect(husky).toBeDefined();
    expect(husky!.priority).toBe('optional');
    expect(husky!.isDev).toBe(true);
  });
});
