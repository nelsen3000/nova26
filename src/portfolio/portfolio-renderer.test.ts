// Tests for Portfolio CLI Output & Status Display
// KIMI-PORTFOLIO-04

import { describe, it, expect, beforeEach } from 'vitest';
import { PortfolioRenderer, type RenderOptions } from './portfolio-renderer.js';
import type { Portfolio, PortfolioProject, PortfolioPattern } from './portfolio-manifest.js';
import type { CrossProjectInsight } from './similarity-engine.js';
import type { SkillGrowthAnalysis } from './pattern-detection.js';

describe('PortfolioRenderer', () => {
  let renderer: PortfolioRenderer;
  let mockPortfolio: Portfolio;
  let mockSkillAnalysis: SkillGrowthAnalysis;
  let mockInsights: CrossProjectInsight[];

  beforeEach(() => {
    renderer = new PortfolioRenderer();

    mockPortfolio = {
      version: '1.0.0',
      userId: 'test-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      projects: [
        createMockProject('p1', 'dashboard-app', 'Dashboard', 85),
        createMockProject('p2', 'api-server', 'API', 72),
        createMockProject('p3', 'mobile-app', 'Mobile', 90),
      ],
      portfolioPatterns: [
        createMockPattern('auth-flow', 'portfolio', 85, 3, false),
        createMockPattern('bad-pattern', 'portfolio', 35, 4, true),
      ],
      skillGrowthHistory: [],
    };

    mockSkillAnalysis = {
      dimensions: [
        { date: '2024-01-01', dimension: 'ace-score', rollingAverage5Projects: 82, allTimeAverage: 75, trend: 'improving' },
        { date: '2024-01-01', dimension: 'test-coverage', rollingAverage5Projects: 78, allTimeAverage: 70, trend: 'improving' },
      ],
      summary: 'Your skills are improving! Current average score: 80/100.',
      overallTrend: 'improving',
    };

    mockInsights = [
      {
        id: 'insight-1',
        type: 'new-project-match',
        title: 'Similar Project Found',
        description: 'dashboard-app and api-server are 85% similar',
        sourceProjectId: 'p1',
        targetProjectId: 'p2',
        actionAvailable: true,
        generatedAt: new Date().toISOString(),
      },
    ];
  });

  function createMockProject(
    id: string,
    name: string,
    type: string,
    aceScore: number
  ): PortfolioProject {
    return {
      id,
      name,
      path: `/projects/${name}`,
      type,
      primaryLanguage: 'TypeScript',
      firstBuildAt: '2020-01-01',
      lastBuildAt: new Date().toISOString(),
      totalBuilds: 10,
      aceScoreHistory: [{ date: new Date().toISOString(), score: aceScore }],
      patternCount: 3,
      semanticFingerprint: [],
      isPrivate: false,
      isArchived: false,
      tags: [],
    };
  }

  function createMockPattern(
    name: string,
    scope: 'project' | 'portfolio',
    quality: number,
    occurrences: number,
    isAntiPattern: boolean
  ): PortfolioPattern {
    return {
      id: crypto.randomUUID(),
      scope,
      name,
      description: `Pattern: ${name}`,
      sourceProjectIds: ['p1', 'p2', 'p3'],
      firstSeenAt: '2020-01-01',
      lastSeenAt: new Date().toISOString(),
      occurrenceCount: occurrences,
      averageQualityScore: quality,
      isAntiPattern,
    };
  }

  describe('renderPortfolio - terminal format', () => {
    it('renders terminal output with header', () => {
      const output = renderer.renderPortfolio(mockPortfolio, mockSkillAnalysis, mockInsights);

      expect(output).toContain('NOVA PORTFOLIO DASHBOARD');
      expect(output).toContain('PORTFOLIO SUMMARY');
      expect(output).toContain('dashboard-app');
    });

    it('includes project list', () => {
      const output = renderer.renderPortfolio(mockPortfolio, mockSkillAnalysis, mockInsights);

      expect(output).toContain('RECENT PROJECTS');
      expect(output).toContain('dashboard-app');
      expect(output).toContain('api-server');
      expect(output).toContain('mobile-app');
    });

    it('includes skill growth section', () => {
      const output = renderer.renderPortfolio(mockPortfolio, mockSkillAnalysis, mockInsights);

      expect(output).toContain('SKILL GROWTH');
      expect(output).toContain('ace-score');
      expect(output).toContain('test-coverage');
    });

    it('includes patterns when includePatterns is true', () => {
      const output = renderer.renderPortfolio(mockPortfolio, mockSkillAnalysis, mockInsights);

      expect(output).toContain('PORTFOLIO PATTERNS');
      expect(output).toContain('auth-flow');
    });

    it('includes insights when includeInsights is true', () => {
      const output = renderer.renderPortfolio(mockPortfolio, mockSkillAnalysis, mockInsights);

      expect(output).toContain('CROSS-PROJECT INSIGHTS');
      expect(output).toContain('Similar Project Found');
    });

    it('includes skill summary', () => {
      const output = renderer.renderPortfolio(mockPortfolio, mockSkillAnalysis, mockInsights);

      expect(output).toContain('Your skills are improving!');
    });
  });

  describe('renderPortfolio - JSON format', () => {
    it('renders valid JSON', () => {
      const jsonRenderer = new PortfolioRenderer({ format: 'json' });
      const output = jsonRenderer.renderPortfolio(mockPortfolio, mockSkillAnalysis, mockInsights);

      const parsed = JSON.parse(output);
      expect(parsed.summary).toBeDefined();
      expect(parsed.summary.totalProjects).toBe(3);
      expect(parsed.recentProjects).toHaveLength(3);
    });

    it('includes all status fields in JSON', () => {
      const jsonRenderer = new PortfolioRenderer({ format: 'json' });
      const output = jsonRenderer.renderPortfolio(mockPortfolio, mockSkillAnalysis, mockInsights);

      const parsed = JSON.parse(output);
      expect(parsed.summary.skillTrend).toBe('improving');
      expect(parsed.skillTrends).toHaveLength(2);
      expect(parsed.portfolioPatterns).toHaveLength(2);
      expect(parsed.crossProjectInsights).toHaveLength(1);
      expect(parsed.warnings).toBeDefined();
    });
  });

  describe('renderPortfolio - Markdown format', () => {
    it('renders markdown with headers', () => {
      const mdRenderer = new PortfolioRenderer({ format: 'markdown' });
      const output = mdRenderer.renderPortfolio(mockPortfolio, mockSkillAnalysis, mockInsights);

      expect(output).toContain('# Nova Portfolio Dashboard');
      expect(output).toContain('## Summary');
      expect(output).toContain('## Recent Projects');
      expect(output).toContain('## Skill Growth');
    });

    it('renders markdown tables', () => {
      const mdRenderer = new PortfolioRenderer({ format: 'markdown' });
      const output = mdRenderer.renderPortfolio(mockPortfolio, mockSkillAnalysis, mockInsights);

      expect(output).toContain('| Metric | Value |');
      expect(output).toContain('|--------|-------|');
    });
  });

  describe('renderStatus', () => {
    it('returns structured status object', () => {
      const status = renderer.renderStatus(mockPortfolio, mockSkillAnalysis, mockInsights);

      expect(status.summary.totalProjects).toBe(3);
      expect(status.summary.activeProjects).toBe(3);
      expect(status.summary.skillTrend).toBe('improving');
      expect(status.recentProjects).toHaveLength(3);
      expect(status.skillTrends).toHaveLength(2);
    });

    it('calculates average ACE score correctly', () => {
      const status = renderer.renderStatus(mockPortfolio, mockSkillAnalysis, mockInsights);

      // (85 + 72 + 90) / 3 = 82.33... -> rounded to 82
      expect(status.summary.averageAceScore).toBe(82);
    });

    it('respects maxProjects limit', () => {
      const limitedRenderer = new PortfolioRenderer({ maxProjects: 2 });
      const status = limitedRenderer.renderStatus(mockPortfolio, mockSkillAnalysis, mockInsights);

      expect(status.recentProjects).toHaveLength(2);
    });

    it('respects maxPatterns limit', () => {
      const limitedRenderer = new PortfolioRenderer({ maxPatterns: 1 });
      const status = limitedRenderer.renderStatus(mockPortfolio, mockSkillAnalysis, mockInsights);

      expect(status.portfolioPatterns).toHaveLength(1);
    });
  });

  describe('warnings generation', () => {
    it('warns about stale projects', () => {
      const stalePortfolio: Portfolio = {
        ...mockPortfolio,
        projects: [
          createMockProject('p1', 'old-project', 'Dashboard', 85),
        ],
      };
      // Make project stale by setting lastBuildAt to 100 days ago
      stalePortfolio.projects[0].lastBuildAt = new Date(
        Date.now() - 100 * 24 * 60 * 60 * 1000
      ).toISOString();

      const status = renderer.renderStatus(stalePortfolio, mockSkillAnalysis, mockInsights);

      expect(status.warnings.some(w => w.includes('90+ days'))).toBe(true);
    });

    it('warns about declining skill trend', () => {
      const decliningAnalysis: SkillGrowthAnalysis = {
        ...mockSkillAnalysis,
        overallTrend: 'declining',
      };

      const status = renderer.renderStatus(mockPortfolio, decliningAnalysis, mockInsights);

      expect(status.warnings.some(w => w.includes('declining'))).toBe(true);
    });

    it('warns about low ACE scores', () => {
      const lowScorePortfolio: Portfolio = {
        ...mockPortfolio,
        projects: [createMockProject('p1', 'bad-project', 'Dashboard', 40)],
      };

      const status = renderer.renderStatus(lowScorePortfolio, mockSkillAnalysis, mockInsights);

      expect(status.warnings.some(w => w.includes('below 50'))).toBe(true);
    });
  });

  describe('skill trend rendering', () => {
    it('renders improving trend with up arrow', () => {
      const status = renderer.renderStatus(mockPortfolio, mockSkillAnalysis, mockInsights);

      const aceTrend = status.skillTrends.find(t => t.dimension === 'ace-score');
      expect(aceTrend?.trend).toBe('improving');
      expect(aceTrend?.indicator).toBe('↑');
    });

    it('renders declining trend with down arrow', () => {
      const decliningAnalysis: SkillGrowthAnalysis = {
        dimensions: [
          { date: '2024-01-01', dimension: 'ace-score', rollingAverage5Projects: 60, allTimeAverage: 80, trend: 'declining' },
        ],
        summary: 'Skills declining',
        overallTrend: 'declining',
      };

      const status = renderer.renderStatus(mockPortfolio, decliningAnalysis, mockInsights);

      const aceTrend = status.skillTrends.find(t => t.dimension === 'ace-score');
      expect(aceTrend?.trend).toBe('declining');
      expect(aceTrend?.indicator).toBe('↓');
    });

    it('renders stable trend with right arrow', () => {
      const stableAnalysis: SkillGrowthAnalysis = {
        dimensions: [
          { date: '2024-01-01', dimension: 'ace-score', rollingAverage5Projects: 75, allTimeAverage: 75, trend: 'stable' },
        ],
        summary: 'Skills stable',
        overallTrend: 'stable',
      };

      const status = renderer.renderStatus(mockPortfolio, stableAnalysis, mockInsights);

      const aceTrend = status.skillTrends.find(t => t.dimension === 'ace-score');
      expect(aceTrend?.trend).toBe('stable');
      expect(aceTrend?.indicator).toBe('→');
    });
  });

  describe('renderSimilarityMatrix', () => {
    it('renders similarity matrix', () => {
      const similarities = new Map([
        ['p1', [{ 
          sourceProjectId: 'p1',
          targetProjectId: 'p2', 
          similarityScore: 0.85, 
          recencyWeightedScore: 0.85,
          architecturalOverlap: ['shared-pattern'],
          computedAt: new Date().toISOString(),
        }]],
      ]);

      const output = renderer.renderSimilarityMatrix(mockPortfolio.projects, similarities);

      expect(output).toContain('PROJECT SIMILARITY MATRIX');
      expect(output).toContain('dashboard-app');
      expect(output).toContain('85% similarity');
    });
  });

  describe('formatScore', () => {
    it('renders green for high scores', () => {
      const output = renderer.renderPortfolio(mockPortfolio, mockSkillAnalysis, mockInsights);
      expect(output).toContain('🟢');
    });
  });
});
