// Tests for Pattern Detection & Portfolio Analytics
// KIMI-PORTFOLIO-03

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PatternDetector, type PatternCandidate } from './pattern-detection.js';
import type { PortfolioProject, PortfolioPattern } from './portfolio-manifest.js';

describe('PatternDetector', () => {
  let detector: PatternDetector;

  beforeEach(() => {
    detector = new PatternDetector();
  });

  function createMockProject(
    id: string,
    name: string,
    options: Partial<PortfolioProject> = {}
  ): PortfolioProject {
    return {
      id,
      name,
      path: `/projects/${name}`,
      type: 'dashboard',
      primaryLanguage: 'TypeScript',
      firstBuildAt: new Date().toISOString(),
      lastBuildAt: new Date().toISOString(),
      totalBuilds: 5,
      aceScoreHistory: [{ date: new Date().toISOString(), score: 75 }],
      patternCount: 3,
      semanticFingerprint: [],
      isPrivate: false,
      isArchived: false,
      tags: [],
      ...options,
    };
  }

  describe('detectCandidates', () => {
    it('detects candidate patterns across projects', () => {
      const projects = [
        createMockProject('p1', 'Project 1'),
        createMockProject('p2', 'Project 2'),
        createMockProject('p3', 'Project 3'),
      ];

      const extractor = (projectId: string) => [
        {
          name: 'Shared Pattern',
          description: 'A common pattern',
          projectIds: [projectId],
          qualityScores: [80],
          structuralHash: 'hash-shared-pattern',
        },
      ];

      const candidates = detector.detectCandidates(projects, extractor);

      expect(candidates.length).toBe(1);
      expect(candidates[0].name).toBe('Shared Pattern');
      expect(candidates[0].projectIds.length).toBe(3);
    });

    it('ignores archived projects', () => {
      const projects = [
        createMockProject('p1', 'Project 1'),
        createMockProject('p2', 'Archived', { isArchived: true }),
      ];

      const extractor = (projectId: string) => [
        {
          name: 'Pattern',
          description: 'Desc',
          projectIds: [projectId],
          qualityScores: [80],
          structuralHash: 'hash-1',
        },
      ];

      const candidates = detector.detectCandidates(projects, extractor);

      // Only p1 contributes, so pattern appears in only 1 project
      expect(candidates.length).toBe(0); // Need 2+ projects
    });

    it('ignores private projects', () => {
      const projects = [
        createMockProject('p1', 'Project 1'),
        createMockProject('p2', 'Private', { isPrivate: true }),
      ];

      const extractor = (projectId: string) => [
        {
          name: 'Pattern',
          description: 'Desc',
          projectIds: [projectId],
          qualityScores: [80],
          structuralHash: 'hash-1',
        },
      ];

      const candidates = detector.detectCandidates(projects, extractor);

      expect(candidates.length).toBe(0);
    });
  });

  describe('promotePatterns', () => {
    it('promotes patterns appearing in 3+ projects', () => {
      const candidates: PatternCandidate[] = [
        {
          name: 'Good Pattern',
          description: 'A good pattern',
          projectIds: ['p1', 'p2', 'p3'],
          qualityScores: [80, 85, 90],
          structuralHash: 'hash-good',
        },
      ];

      const result = detector.promotePatterns(candidates);

      expect(result.promoted.length).toBe(1);
      expect(result.promoted[0].name).toBe('Good Pattern');
      expect(result.promoted[0].scope).toBe('portfolio');
    });

    it('does not promote patterns in only 2 projects', () => {
      const candidates: PatternCandidate[] = [
        {
          name: 'Rare Pattern',
          description: 'A rare pattern',
          projectIds: ['p1', 'p2'],
          qualityScores: [80, 85],
          structuralHash: 'hash-rare',
        },
      ];

      const result = detector.promotePatterns(candidates);

      expect(result.promoted.length).toBe(0);
      expect(result.skipped.length).toBe(1);
    });

    it('flags anti-patterns with low quality scores', () => {
      const candidates: PatternCandidate[] = [
        {
          name: 'Bad Pattern',
          description: 'A problematic pattern',
          projectIds: ['p1', 'p2', 'p3', 'p4'],
          qualityScores: [30, 35, 25, 40], // All below 40 threshold
          structuralHash: 'hash-bad',
        },
      ];

      const result = detector.promotePatterns(candidates);

      expect(result.antiPatterns.length).toBe(1);
      expect(result.antiPatterns[0].isAntiPattern).toBe(true);
    });

    it('does not flag anti-patterns below occurrence threshold', () => {
      const candidates: PatternCandidate[] = [
        {
          name: 'Low Quality Rare',
          description: 'Low quality but rare',
          projectIds: ['p1', 'p2'], // Only 2 occurrences (< 3 threshold)
          qualityScores: [30, 35],
          structuralHash: 'hash-low',
        },
      ];

      const result = detector.promotePatterns(candidates);

      expect(result.antiPatterns.length).toBe(0);
      expect(result.skipped.length).toBe(1);
    });

    it('separates promoted and anti-patterns in result', () => {
      const candidates: PatternCandidate[] = [
        {
          name: 'Good Pattern',
          description: 'Good',
          projectIds: ['p1', 'p2', 'p3'],
          qualityScores: [80, 85, 90],
          structuralHash: 'hash-good',
        },
        {
          name: 'Bad Pattern',
          description: 'Bad',
          projectIds: ['p1', 'p2', 'p3', 'p4'],
          qualityScores: [30, 35, 25, 40],
          structuralHash: 'hash-bad',
        },
      ];

      const result = detector.promotePatterns(candidates);

      expect(result.promoted.length).toBe(1);
      expect(result.antiPatterns.length).toBe(1);
      expect(result.skipped.length).toBe(0);
    });
  });

  describe('detectAntiPatterns', () => {
    it('detects anti-patterns correctly', () => {
      const candidates: PatternCandidate[] = [
        {
          name: 'Bad Pattern',
          description: 'A bad pattern',
          projectIds: ['p1', 'p2', 'p3', 'p4'],
          qualityScores: [35, 30, 40, 35], // Average 35 < 40 threshold
          structuralHash: 'hash-bad',
        },
      ];

      const antiPatterns = detector.detectAntiPatterns(candidates);

      expect(antiPatterns.length).toBe(1);
      expect(antiPatterns[0].isAntiPattern).toBe(true);
    });
  });

  describe('buildLineage', () => {
    it('builds lineage sorted by build date', () => {
      const pattern: PortfolioPattern = {
        id: 'pattern-1',
        scope: 'portfolio',
        name: 'Evolved Pattern',
        description: 'A pattern that evolved',
        sourceProjectIds: ['p1', 'p2', 'p3'],
        firstSeenAt: '2020-01-01',
        lastSeenAt: '2023-01-01',
        occurrenceCount: 3,
        averageQualityScore: 75,
        isAntiPattern: false,
      };

      const projectDetails = [
        { projectId: 'p2', projectName: 'Project 2', builtAt: '2021-06-01', qualityScore: 70, changeDescription: 'Improved' },
        { projectId: 'p1', projectName: 'Project 1', builtAt: '2020-01-01', qualityScore: 60, changeDescription: 'Initial' },
        { projectId: 'p3', projectName: 'Project 3', builtAt: '2022-12-01', qualityScore: 80, changeDescription: 'Refined' },
      ];

      const lineage = detector.buildLineage(pattern, projectDetails);

      expect(lineage.versions[0].projectId).toBe('p1'); // Oldest first
      expect(lineage.versions[1].projectId).toBe('p2');
      expect(lineage.versions[2].projectId).toBe('p3'); // Newest
    });

    it('identifies best version in lineage', () => {
      const pattern: PortfolioPattern = {
        id: 'pattern-1',
        scope: 'portfolio',
        name: 'Pattern',
        description: 'Desc',
        sourceProjectIds: ['p1', 'p2', 'p3'],
        firstSeenAt: '2020-01-01',
        lastSeenAt: '2023-01-01',
        occurrenceCount: 3,
        averageQualityScore: 75,
        isAntiPattern: false,
      };

      const projectDetails = [
        { projectId: 'p1', projectName: 'Project 1', builtAt: '2020-01-01', qualityScore: 60, changeDescription: '' },
        { projectId: 'p2', projectName: 'Project 2', builtAt: '2021-01-01', qualityScore: 90, changeDescription: '' },
        { projectId: 'p3', projectName: 'Project 3', builtAt: '2022-01-01', qualityScore: 75, changeDescription: '' },
      ];

      const lineage = detector.buildLineage(pattern, projectDetails);

      expect(lineage.bestVersionProjectId).toBe('p2'); // Highest score
    });
  });

  describe('computeSkillGrowth', () => {
    it('computes skill growth as improving', () => {
      const projects: PortfolioProject[] = [
        createMockProject('p1', 'Old', { 
          lastBuildAt: '2020-01-01',
          aceScoreHistory: [{ date: '2020-01-01', score: 60 }] 
        }),
        createMockProject('p2', 'Mid', { 
          lastBuildAt: '2021-01-01',
          aceScoreHistory: [{ date: '2021-01-01', score: 70 }] 
        }),
        createMockProject('p3', 'Recent', { 
          lastBuildAt: '2022-01-01',
          aceScoreHistory: [{ date: '2022-01-01', score: 85 }] 
        }),
        createMockProject('p4', 'New', { 
          lastBuildAt: '2023-01-01',
          aceScoreHistory: [{ date: '2023-01-01', score: 90 }] 
        }),
        createMockProject('p5', 'Latest', { 
          lastBuildAt: '2024-01-01',
          aceScoreHistory: [{ date: '2024-01-01', score: 95 }] 
        }),
      ];

      const analysis = detector.computeSkillGrowth(projects);

      // Check that dimensions show improving trend (at least some do)
      const improvingDimensions = analysis.dimensions.filter(d => d.trend === 'improving');
      expect(improvingDimensions.length).toBeGreaterThan(0);
      expect(analysis.summary.length).toBeGreaterThan(0);
    });

    it('computes skill growth as declining', () => {
      const projects: PortfolioProject[] = [
        createMockProject('p1', 'Old', { 
          lastBuildAt: '2020-01-01',
          aceScoreHistory: [{ date: '2020-01-01', score: 90 }] 
        }),
        createMockProject('p2', 'Mid', { 
          lastBuildAt: '2021-01-01',
          aceScoreHistory: [{ date: '2021-01-01', score: 85 }] 
        }),
        createMockProject('p3', 'Recent', { 
          lastBuildAt: '2022-01-01',
          aceScoreHistory: [{ date: '2022-01-01', score: 70 }] 
        }),
        createMockProject('p4', 'New', { 
          lastBuildAt: '2023-01-01',
          aceScoreHistory: [{ date: '2023-01-01', score: 60 }] 
        }),
        createMockProject('p5', 'Latest', { 
          lastBuildAt: '2024-01-01',
          aceScoreHistory: [{ date: '2024-01-01', score: 50 }] 
        }),
      ];

      const analysis = detector.computeSkillGrowth(projects);

      // Check that dimensions show declining trend
      const decliningDimensions = analysis.dimensions.filter(d => d.trend === 'declining');
      expect(decliningDimensions.length).toBeGreaterThan(0);
      expect(analysis.summary.length).toBeGreaterThan(0);
    });

    it('computes skill growth as stable', () => {
      const projects: PortfolioProject[] = [
        createMockProject('p1', 'Old', { aceScoreHistory: [{ date: '2020-01-01', score: 75 }] }),
        createMockProject('p2', 'Mid', { aceScoreHistory: [{ date: '2021-01-01', score: 76 }] }),
        createMockProject('p3', 'Recent', { aceScoreHistory: [{ date: '2022-01-01', score: 74 }] }),
      ];

      const analysis = detector.computeSkillGrowth(projects);

      expect(analysis.overallTrend).toBe('stable');
    });

    it('generates human-readable skill summary', () => {
      const projects: PortfolioProject[] = [
        createMockProject('p1', 'Project 1', { aceScoreHistory: [{ date: '2020-01-01', score: 70 }] }),
      ];

      const analysis = detector.computeSkillGrowth(projects);

      expect(analysis.summary.length).toBeGreaterThan(0);
    });

    it('handles empty project list for skill growth', () => {
      const analysis = detector.computeSkillGrowth([]);

      expect(analysis.dimensions).toEqual([]);
      expect(analysis.summary).toContain('No projects');
    });

    it('handles single project for skill growth', () => {
      const projects = [createMockProject('p1', 'Only')];

      const analysis = detector.computeSkillGrowth(projects);

      expect(analysis.overallTrend).toBe('stable');
    });
  });
});
