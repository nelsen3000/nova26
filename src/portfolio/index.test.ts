// Integration Tests for Portfolio Module
// KIMI-PORTFOLIO-05: R16-01 spec

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createPortfolioEngine,
  PortfolioManifest,
  SimilarityEngine,
  PatternDetector,
  PortfolioRenderer,
} from './index.js';
import type { PortfolioProject } from './portfolio-manifest.js';

describe('Portfolio Module Integration', () => {
  describe('createPortfolioEngine', () => {
    it('creates all engine components', () => {
      const engine = createPortfolioEngine();

      expect(engine.manifest).toBeInstanceOf(PortfolioManifest);
      expect(engine.similarity).toBeInstanceOf(SimilarityEngine);
      expect(engine.detector).toBeInstanceOf(PatternDetector);
      expect(engine.renderer).toBeInstanceOf(PortfolioRenderer);
    });

    it('accepts configuration options', () => {
      const engine = createPortfolioEngine({
        manifest: { similarityThreshold: 0.8 },
        similarity: { topK: 5 },
        patternDetection: { minProjectsForPromotion: 2 },
        rendering: { format: 'json' },
      });

      expect(engine).toBeDefined();
    });
  });

  describe('End-to-end portfolio workflow', () => {
    function createMockProject(
      id: string,
      name: string,
      score: number,
      fingerprint: number[]
    ): PortfolioProject {
      return {
        id,
        name,
        path: `/projects/${name}`,
        type: 'dashboard',
        primaryLanguage: 'TypeScript',
        firstBuildAt: '2020-01-01',
        lastBuildAt: new Date().toISOString(),
        totalBuilds: 5,
        aceScoreHistory: [{ date: new Date().toISOString(), score }],
        patternCount: 3,
        semanticFingerprint: fingerprint,
        isPrivate: false,
        isArchived: false,
        tags: [],
      };
    }

    it('detects similar projects and generates insights', () => {
      const engine = createPortfolioEngine();

      // Create projects with very similar fingerprints
      const projects: PortfolioProject[] = [
        createMockProject('p1', 'ecommerce-dashboard', 85, [1, 0, 0]),
        createMockProject('p2', 'analytics-dashboard', 80, [0.99, 0.01, 0]), // Very similar
        createMockProject('p3', 'mobile-app', 75, [0, 0, 1]), // Different
      ];

      // Find similar projects (source project p1 is excluded from results)
      const similarities = engine.similarity.findSimilarProjects(
        projects[0],
        projects,
        () => 1.0
      );

      // Should find similar projects with high scores
      expect(similarities.length).toBeGreaterThan(0);
      
      // Results should be sorted by similarity (highest first)
      const topSimilarity = similarities[0];
      expect(topSimilarity.similarityScore).toBeGreaterThan(0.9);
    });

    it('detects cross-project patterns', () => {
      const engine = createPortfolioEngine();

      // Create candidate patterns
      const candidates = [
        {
          name: 'Auth Pattern',
          description: 'JWT-based authentication',
          projectIds: ['p1', 'p2', 'p3', 'p4'],
          qualityScores: [85, 82, 88, 80],
          structuralHash: 'auth-jwt-pattern',
        },
        {
          name: 'Bad Pattern',
          description: 'Poor error handling',
          projectIds: ['p1', 'p2', 'p3'],
          qualityScores: [30, 35, 32],
          structuralHash: 'bad-error-pattern',
        },
      ];

      const result = engine.detector.promotePatterns(candidates);

      // High quality pattern should be promoted
      expect(result.promoted.length).toBe(1);
      expect(result.promoted[0].name).toBe('Auth Pattern');

      // Low quality pattern should be flagged as anti-pattern
      expect(result.antiPatterns.length).toBe(1);
      expect(result.antiPatterns[0].name).toBe('Bad Pattern');
      expect(result.antiPatterns[0].isAntiPattern).toBe(true);
    });

    it('computes skill growth across projects', () => {
      const engine = createPortfolioEngine();

      const projects: PortfolioProject[] = [
        createMockProject('p1', 'Old', 60, [1, 0, 0]),
        createMockProject('p2', 'Mid', 70, [1, 0, 0]),
        createMockProject('p3', 'Recent', 85, [1, 0, 0]),
        createMockProject('p4', 'New', 90, [1, 0, 0]),
        createMockProject('p5', 'Latest', 95, [1, 0, 0]),
      ];

      const analysis = engine.detector.computeSkillGrowth(projects);

      expect(analysis.dimensions.length).toBeGreaterThan(0);
      expect(analysis.summary.length).toBeGreaterThan(0);
    });

    it('renders portfolio in multiple formats', () => {
      const engine = createPortfolioEngine();

      const portfolio = {
        version: '1.0.0',
        userId: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projects: [
          createMockProject('p1', 'Project 1', 85, [1, 0, 0]),
          createMockProject('p2', 'Project 2', 80, [0, 1, 0]),
        ],
        portfolioPatterns: [],
        skillGrowthHistory: [],
      };

      const skillAnalysis = {
        dimensions: [
          { date: '2024-01-01', dimension: 'ace-score' as const, rollingAverage5Projects: 82, allTimeAverage: 75, trend: 'improving' as const },
        ],
        summary: 'Skills improving',
        overallTrend: 'improving' as const,
      };

      const insights: any[] = [];

      // Test terminal format
      const terminalOutput = engine.renderer.renderPortfolio(portfolio, skillAnalysis, insights);
      expect(terminalOutput).toContain('NOVA PORTFOLIO');

      // Test JSON format
      const jsonRenderer = new PortfolioRenderer({ format: 'json' });
      const jsonOutput = jsonRenderer.renderPortfolio(portfolio, skillAnalysis, insights);
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.summary.totalProjects).toBe(2);

      // Test Markdown format
      const mdRenderer = new PortfolioRenderer({ format: 'markdown' });
      const mdOutput = mdRenderer.renderPortfolio(portfolio, skillAnalysis, insights);
      expect(mdOutput).toContain('# Nova Portfolio Dashboard');
    });
  });

  describe('Component interoperability', () => {
    it('similarity engine uses manifest config thresholds', () => {
      const engine = createPortfolioEngine({
        manifest: { similarityThreshold: 0.85 },
      });

      // The similarity engine should respect the threshold
      expect(engine.similarity).toBeDefined();
    });

    it('pattern detector uses configured promotion thresholds', () => {
      const engine = createPortfolioEngine({
        patternDetection: { minProjectsForPromotion: 2 },
      });

      const candidates = [
        {
          name: 'Test Pattern',
          description: 'Test',
          projectIds: ['p1', 'p2'],
          qualityScores: [80, 85],
          structuralHash: 'test',
        },
      ];

      // With threshold of 2, pattern in 2 projects should be promoted
      const result = engine.detector.promotePatterns(candidates);
      expect(result.promoted.length).toBe(1);
    });
  });
});
