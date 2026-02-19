// Pattern Detection & Portfolio Analytics
// KIMI-PORTFOLIO-03: R16-01 spec

import { z } from 'zod';
import type { PortfolioProject, PortfolioPattern, PatternLineage, SkillGrowthRecord } from './portfolio-manifest.js';

// ============================================================================
// Core Types
// ============================================================================

export interface PatternCandidate {
  name: string;
  description: string;
  projectIds: string[];                // projects where this pattern appears
  qualityScores: number[];             // per-project quality scores
  structuralHash: string;             // hash of normalized pattern for dedup
}

export interface PatternPromotionResult {
  promoted: PortfolioPattern[];        // patterns promoted to portfolio scope
  antiPatterns: PortfolioPattern[];    // patterns flagged as anti-patterns
  skipped: PatternCandidate[];         // patterns below threshold
}

export interface SkillGrowthAnalysis {
  dimensions: SkillGrowthRecord[];
  summary: string;                     // human-readable summary
  overallTrend: 'improving' | 'stable' | 'declining';
}

export interface PatternDetectionConfig {
  minProjectsForPromotion: number;     // default: 3
  minSimilarityForMatch: number;       // default: 0.80
  antiPatternQualityThreshold: number; // default: 40 — below this = anti-pattern candidate
  antiPatternMinOccurrences: number;   // default: 3
  skillWindowSize: number;             // default: 5 — rolling window for skill growth
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const PatternCandidateSchema = z.object({
  name: z.string(),
  description: z.string(),
  projectIds: z.array(z.string()),
  qualityScores: z.array(z.number()),
  structuralHash: z.string(),
});

export const PatternPromotionResultSchema = z.object({
  promoted: z.array(z.any()), // Using z.any() for PortfolioPattern to avoid circular import issues
  antiPatterns: z.array(z.any()),
  skipped: z.array(PatternCandidateSchema),
});

export const SkillGrowthAnalysisSchema = z.object({
  dimensions: z.array(z.any()),
  summary: z.string(),
  overallTrend: z.enum(['improving', 'stable', 'declining']),
});

export const PatternDetectionConfigSchema = z.object({
  minProjectsForPromotion: z.number().int().positive().default(3),
  minSimilarityForMatch: z.number().min(0).max(1).default(0.80),
  antiPatternQualityThreshold: z.number().min(0).max(100).default(40),
  antiPatternMinOccurrences: z.number().int().positive().default(3),
  skillWindowSize: z.number().int().positive().default(5),
});

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: PatternDetectionConfig = {
  minProjectsForPromotion: 3,
  minSimilarityForMatch: 0.80,
  antiPatternQualityThreshold: 40,
  antiPatternMinOccurrences: 3,
  skillWindowSize: 5,
};

// ============================================================================
// PatternDetector Class
// ============================================================================

export class PatternDetector {
  private config: PatternDetectionConfig;

  constructor(config?: Partial<PatternDetectionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---- Pattern Detection ----

  detectCandidates(
    projects: PortfolioProject[],
    patternExtractor: (projectId: string) => PatternCandidate[]
  ): PatternCandidate[] {
    // Filter to non-archived, non-private projects
    const eligibleProjects = projects.filter(
      p => !p.isArchived && !p.isPrivate
    );

    // Collect all candidates
    const allCandidates: PatternCandidate[] = [];
    for (const project of eligibleProjects) {
      const candidates = patternExtractor(project.id);
      allCandidates.push(...candidates);
    }

    // Group by structural hash
    const groupedByHash = new Map<string, PatternCandidate[]>();
    for (const candidate of allCandidates) {
      const existing = groupedByHash.get(candidate.structuralHash) || [];
      existing.push(candidate);
      groupedByHash.set(candidate.structuralHash, existing);
    }

    // Merge candidates that appear in multiple projects
    const mergedCandidates: PatternCandidate[] = [];
    for (const [hash, candidates] of groupedByHash) {
      if (candidates.length >= 2) {
        // Merge into single candidate with all project IDs
        const merged: PatternCandidate = {
          name: candidates[0].name,
          description: candidates[0].description,
          projectIds: candidates.flatMap(c => c.projectIds),
          qualityScores: candidates.flatMap(c => c.qualityScores),
          structuralHash: hash,
        };
        mergedCandidates.push(merged);
      }
    }

    return mergedCandidates;
  }

  promotePatterns(candidates: PatternCandidate[]): PatternPromotionResult {
    const promoted: PortfolioPattern[] = [];
    const antiPatterns: PortfolioPattern[] = [];
    const skipped: PatternCandidate[] = [];

    for (const candidate of candidates) {
      const avgQuality = candidate.qualityScores.reduce((a, b) => a + b, 0) / candidate.qualityScores.length;

      if (candidate.projectIds.length >= this.config.minProjectsForPromotion) {
        const now = new Date().toISOString();
        
        if (avgQuality >= this.config.antiPatternQualityThreshold) {
          // Promote to portfolio pattern
          const pattern: PortfolioPattern = {
            id: crypto.randomUUID(),
            scope: 'portfolio',
            name: candidate.name,
            description: candidate.description,
            sourceProjectIds: [...new Set(candidate.projectIds)], // dedupe
            firstSeenAt: now,
            lastSeenAt: now,
            occurrenceCount: candidate.projectIds.length,
            averageQualityScore: avgQuality,
            isAntiPattern: false,
          };
          promoted.push(pattern);
        } else if (candidate.projectIds.length >= this.config.antiPatternMinOccurrences) {
          // Flag as anti-pattern (low quality, but widespread)
          const pattern: PortfolioPattern = {
            id: crypto.randomUUID(),
            scope: 'portfolio',
            name: candidate.name,
            description: `${candidate.description} (Flagged as anti-pattern due to consistently low quality scores)`,
            sourceProjectIds: [...new Set(candidate.projectIds)],
            firstSeenAt: now,
            lastSeenAt: now,
            occurrenceCount: candidate.projectIds.length,
            averageQualityScore: avgQuality,
            isAntiPattern: true,
          };
          antiPatterns.push(pattern);
        } else {
          skipped.push(candidate);
        }
      } else {
        skipped.push(candidate);
      }
    }

    return { promoted, antiPatterns, skipped };
  }

  detectAntiPatterns(candidates: PatternCandidate[]): PortfolioPattern[] {
    const antiPatterns: PortfolioPattern[] = [];

    for (const candidate of candidates) {
      const avgQuality = candidate.qualityScores.reduce((a, b) => a + b, 0) / candidate.qualityScores.length;

      if (
        avgQuality < this.config.antiPatternQualityThreshold &&
        candidate.projectIds.length >= this.config.antiPatternMinOccurrences
      ) {
        const now = new Date().toISOString();
        const pattern: PortfolioPattern = {
          id: crypto.randomUUID(),
          scope: 'portfolio',
          name: candidate.name,
          description: `${candidate.description} (Anti-pattern: low quality across ${candidate.projectIds.length} projects)`,
          sourceProjectIds: [...new Set(candidate.projectIds)],
          firstSeenAt: now,
          lastSeenAt: now,
          occurrenceCount: candidate.projectIds.length,
          averageQualityScore: avgQuality,
          isAntiPattern: true,
        };
        antiPatterns.push(pattern);
      }
    }

    return antiPatterns;
  }

  // ---- Lineage Tracking ----

  buildLineage(
    pattern: PortfolioPattern,
    projectDetails: Array<{
      projectId: string;
      projectName: string;
      builtAt: string;
      qualityScore: number;
      changeDescription: string;
    }>
  ): PatternLineage {
    // Sort by builtAt ascending
    const sortedVersions = [...projectDetails].sort(
      (a, b) => new Date(a.builtAt).getTime() - new Date(b.builtAt).getTime()
    );

    // Find best version (highest quality score)
    const bestVersion = sortedVersions.reduce((best, current) =>
      current.qualityScore > best.qualityScore ? current : best
    );

    return {
      patternId: pattern.id,
      versions: sortedVersions,
      bestVersionProjectId: bestVersion.projectId,
    };
  }

  // ---- Skill Growth Analysis ----

  computeSkillGrowth(projects: PortfolioProject[]): SkillGrowthAnalysis {
    if (projects.length === 0) {
      return {
        dimensions: [],
        summary: 'No projects available for skill growth analysis.',
        overallTrend: 'stable',
      };
    }

    // Sort projects by lastBuildAt
    const sortedProjects = [...projects].sort(
      (a, b) => new Date(a.lastBuildAt).getTime() - new Date(b.lastBuildAt).getTime()
    );

    const dimensions: SkillGrowthRecord[] = [];
    const skillDimensions: SkillGrowthRecord['dimension'][] = [
      'test-coverage',
      'complexity',
      'security',
      'ace-score',
      'build-speed',
    ];

    let improvingCount = 0;
    let decliningCount = 0;
    let stableCount = 0;

    for (const dimension of skillDimensions) {
      // Use ACE scores as proxy for all dimensions (in real implementation, would have specific metrics)
      const scores = sortedProjects.map(p => {
        const latestScore = p.aceScoreHistory[p.aceScoreHistory.length - 1]?.score;
        return latestScore || 50; // Default if no scores
      });

      if (scores.length === 0) continue;

      // Compute rolling average of most recent window
      const windowSize = Math.min(this.config.skillWindowSize, scores.length);
      const recentScores = scores.slice(-windowSize);
      const rollingAverage = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;

      // Compute baseline: if we have more than windowSize projects, use earlier projects as baseline
      // Otherwise, compare first half vs second half of the scores
      let baselineAverage: number;
      if (scores.length > windowSize) {
        const earlierScores = scores.slice(0, -windowSize);
        baselineAverage = earlierScores.reduce((a, b) => a + b, 0) / earlierScores.length;
      } else if (scores.length >= 2) {
        // Compare first half vs second half
        const midPoint = Math.floor(scores.length / 2);
        const firstHalf = scores.slice(0, midPoint);
        baselineAverage = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      } else {
        baselineAverage = scores[0] || 50;
      }

      // Compute all-time average for reporting
      const allTimeAverage = scores.reduce((a, b) => a + b, 0) / scores.length;

      // Determine trend: compare recent performance to baseline
      let trend: SkillGrowthRecord['trend'];
      if (rollingAverage > baselineAverage * 1.05) {
        trend = 'improving';
        improvingCount++;
      } else if (rollingAverage < baselineAverage * 0.95) {
        trend = 'declining';
        decliningCount++;
      } else {
        trend = 'stable';
        stableCount++;
      }

      dimensions.push({
        date: new Date().toISOString(),
        dimension,
        rollingAverage5Projects: rollingAverage,
        allTimeAverage,
        trend,
      });
    }

    // Determine overall trend
    let overallTrend: SkillGrowthAnalysis['overallTrend'];
    if (improvingCount > decliningCount && improvingCount > stableCount) {
      overallTrend = 'improving';
    } else if (decliningCount > improvingCount && decliningCount > stableCount) {
      overallTrend = 'declining';
    } else {
      overallTrend = 'stable';
    }

    // Generate summary
    const summary = this.generateSkillSummary(dimensions, overallTrend);

    return {
      dimensions,
      summary,
      overallTrend,
    };
  }

  private generateSkillSummary(
    dimensions: SkillGrowthRecord[],
    overallTrend: SkillGrowthAnalysis['overallTrend']
  ): string {
    if (dimensions.length === 0) {
      return 'No skill data available yet. Keep building projects to track your growth!';
    }

    const improvingDimensions = dimensions.filter(d => d.trend === 'improving');
    const decliningDimensions = dimensions.filter(d => d.trend === 'declining');

    let summary = '';

    switch (overallTrend) {
      case 'improving':
        summary = `Your skills are improving! You're getting better at ${improvingDimensions.map(d => d.dimension).join(', ')}.`;
        break;
      case 'declining':
        summary = `Some areas need attention: ${decliningDimensions.map(d => d.dimension).join(', ')}. Consider reviewing best practices.`;
        break;
      case 'stable':
        summary = 'Your skills are stable across all measured dimensions. Keep up the consistent work!';
        break;
    }

    const avgScore = dimensions.reduce((sum, d) => sum + d.rollingAverage5Projects, 0) / dimensions.length;
    summary += ` Current average score: ${avgScore.toFixed(1)}/100.`;

    return summary;
  }
}
