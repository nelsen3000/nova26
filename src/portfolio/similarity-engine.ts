// Similarity Detection & Cross-Project Suggestions
// KIMI-PORTFOLIO-02: R16-01 spec

import { z } from 'zod';
import type { PortfolioProject } from './portfolio-manifest.js';

// ============================================================================
// Core Types
// ============================================================================

export interface ProjectSimilarity {
  sourceProjectId: string;
  targetProjectId: string;
  similarityScore: number;             // 0-1 cosine similarity
  recencyWeightedScore: number;        // similarity * recency weight
  architecturalOverlap: string[];      // shared patterns/approaches
  computedAt: string;
}

export interface CrossProjectInsight {
  id: string;
  type: 'better-pattern' | 'anti-pattern' | 'new-project-match' | 'skill-growth';
  sourceProjectId: string;
  targetProjectId?: string;
  title: string;
  description: string;
  qualityDelta?: number;               // signed; positive = source is better
  actionAvailable: boolean;
  actionDescription?: string;
  generatedAt: string;
  status: 'pending' | 'accepted' | 'rejected' | 'dismissed';
}

export interface CrossProjectSuggestion {
  insightId: string;
  sourceProject: string;
  sourceFile: string;
  targetProject: string;
  targetFile: string;
  qualityDelta: number;
  explanation: string;
  adaptedDiff?: string;
  adaptationStatus: 'not-started' | 'running' | 'ready' | 'failed';
}

export interface SimilarityEngineConfig {
  similarityThreshold: number;         // default: 0.70 — minimum to surface
  qualityDeltaThreshold: number;       // default: 15 — minimum quality gap to suggest
  maxSuggestions: number;              // default: 10
  excludePrivateProjects: boolean;     // default: true
}

export type SimilarityClassification = 'architecturally-similar' | 'very-similar' | 'essentially-same' | 'below-threshold';

// ============================================================================
// Zod Schemas
// ============================================================================

export const ProjectSimilaritySchema = z.object({
  sourceProjectId: z.string(),
  targetProjectId: z.string(),
  similarityScore: z.number().min(0).max(1),
  recencyWeightedScore: z.number(),
  architecturalOverlap: z.array(z.string()),
  computedAt: z.string(),
});

export const CrossProjectInsightSchema = z.object({
  id: z.string(),
  type: z.enum(['better-pattern', 'anti-pattern', 'new-project-match', 'skill-growth']),
  sourceProjectId: z.string(),
  targetProjectId: z.string().optional(),
  title: z.string(),
  description: z.string(),
  qualityDelta: z.number().optional(),
  actionAvailable: z.boolean(),
  actionDescription: z.string().optional(),
  generatedAt: z.string(),
  status: z.enum(['pending', 'accepted', 'rejected', 'dismissed']),
});

export const CrossProjectSuggestionSchema = z.object({
  insightId: z.string(),
  sourceProject: z.string(),
  sourceFile: z.string(),
  targetProject: z.string(),
  targetFile: z.string(),
  qualityDelta: z.number(),
  explanation: z.string(),
  adaptedDiff: z.string().optional(),
  adaptationStatus: z.enum(['not-started', 'running', 'ready', 'failed']),
});

export const SimilarityEngineConfigSchema = z.object({
  similarityThreshold: z.number().min(0).max(1).default(0.70),
  qualityDeltaThreshold: z.number().default(15),
  maxSuggestions: z.number().int().positive().default(10),
  excludePrivateProjects: z.boolean().default(true),
});

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: SimilarityEngineConfig = {
  similarityThreshold: 0.70,
  qualityDeltaThreshold: 15,
  maxSuggestions: 10,
  excludePrivateProjects: true,
};

// ============================================================================
// SimilarityEngine Class
// ============================================================================

export class SimilarityEngine {
  private config: SimilarityEngineConfig;

  constructor(config?: Partial<SimilarityEngineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---- Similarity Computation ----

  cosineSimilarity(a: number[], b: number[]): number {
    // Handle edge cases
    if (a.length === 0 || b.length === 0) {
      return 0;
    }

    // Check for zero vectors
    const aAllZero = a.every(v => v === 0);
    const bAllZero = b.every(v => v === 0);
    if (aAllZero || bAllZero) {
      return 0;
    }

    // Ensure same length
    const length = Math.min(a.length, b.length);
    const aSlice = a.slice(0, length);
    const bSlice = b.slice(0, length);

    // Compute dot product
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < length; i++) {
      dotProduct += aSlice[i] * bSlice[i];
      normA += aSlice[i] * aSlice[i];
      normB += bSlice[i] * bSlice[i];
    }

    // Handle zero norms
    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  findSimilarProjects(
    targetProject: PortfolioProject,
    allProjects: PortfolioProject[],
    recencyWeightFn: (lastBuildAt: string) => number
  ): ProjectSimilarity[] {
    const similarities: ProjectSimilarity[] = [];

    for (const project of allProjects) {
      // Skip target project itself
      if (project.id === targetProject.id) {
        continue;
      }

      // Skip archived projects
      if (project.isArchived) {
        continue;
      }

      // Skip private projects if configured
      if (this.config.excludePrivateProjects && project.isPrivate) {
        continue;
      }

      // Skip projects without fingerprints
      if (targetProject.semanticFingerprint.length === 0 || project.semanticFingerprint.length === 0) {
        continue;
      }

      // Compute similarity
      const similarityScore = this.cosineSimilarity(
        targetProject.semanticFingerprint,
        project.semanticFingerprint
      );

      // Filter by threshold
      if (similarityScore < this.config.similarityThreshold) {
        continue;
      }

      // Compute recency-weighted score
      const recencyWeight = recencyWeightFn(project.lastBuildAt);
      const recencyWeightedScore = similarityScore * recencyWeight;

      // Detect architectural overlap (mock based on project type and framework)
      const architecturalOverlap = this.detectArchitecturalOverlap(targetProject, project);

      similarities.push({
        sourceProjectId: project.id,
        targetProjectId: targetProject.id,
        similarityScore,
        recencyWeightedScore,
        architecturalOverlap,
        computedAt: new Date().toISOString(),
      });
    }

    // Sort by recency-weighted score descending
    similarities.sort((a, b) => b.recencyWeightedScore - a.recencyWeightedScore);

    // Limit to max suggestions
    return similarities.slice(0, this.config.maxSuggestions);
  }

  private detectArchitecturalOverlap(a: PortfolioProject, b: PortfolioProject): string[] {
    const overlap: string[] = [];

    if (a.type === b.type) {
      overlap.push(`same-type:${a.type}`);
    }

    if (a.framework && b.framework && a.framework === b.framework) {
      overlap.push(`same-framework:${a.framework}`);
    }

    if (a.primaryLanguage === b.primaryLanguage) {
      overlap.push(`same-language:${a.primaryLanguage}`);
    }

    return overlap;
  }

  classifySimilarity(score: number): SimilarityClassification {
    if (score >= 0.90) {
      return 'essentially-same';
    } else if (score >= 0.80) {
      return 'very-similar';
    } else if (score >= 0.70) {
      return 'architecturally-similar';
    } else {
      return 'below-threshold';
    }
  }

  // ---- Insight Generation ----

  generateInsight(
    sourceProject: PortfolioProject,
    targetProject: PortfolioProject,
    similarity: ProjectSimilarity
  ): CrossProjectInsight {
    const classification = this.classifySimilarity(similarity.similarityScore);
    
    const classificationLabels: Record<string, string> = {
      'essentially-same': 'essentially the same architecture',
      'very-similar': 'very similar architecture',
      'architecturally-similar': 'architecturally similar',
      'below-threshold': 'some architectural overlap',
    };

    const overlapText = similarity.architecturalOverlap.length > 0
      ? ` Shared characteristics: ${similarity.architecturalOverlap.join(', ')}.`
      : '';

    return {
      id: crypto.randomUUID(),
      type: 'new-project-match',
      sourceProjectId: sourceProject.id,
      targetProjectId: targetProject.id,
      title: `Similar to ${sourceProject.name}`,
      description: `This project has ${classificationLabels[classification]} to ${sourceProject.name} (similarity: ${(similarity.similarityScore * 100).toFixed(1)}%).${overlapText}`,
      actionAvailable: true,
      actionDescription: `Pre-load patterns from ${sourceProject.name}`,
      generatedAt: new Date().toISOString(),
      status: 'pending',
    };
  }

  generateBetterPatternInsight(
    sourceProject: PortfolioProject,
    targetProject: PortfolioProject,
    sourceScore: number,
    targetScore: number,
    patternName: string
  ): CrossProjectInsight | null {
    const qualityDelta = sourceScore - targetScore;

    if (qualityDelta < this.config.qualityDeltaThreshold) {
      return null;
    }

    return {
      id: crypto.randomUUID(),
      type: 'better-pattern',
      sourceProjectId: sourceProject.id,
      targetProjectId: targetProject.id,
      title: `Better '${patternName}' in ${sourceProject.name}`,
      description: `The '${patternName}' implementation in ${sourceProject.name} scored ${sourceScore} vs ${targetScore} here (delta: +${qualityDelta}). Consider applying the better version.`,
      qualityDelta,
      actionAvailable: true,
      actionDescription: `Apply improved '${patternName}' from ${sourceProject.name}`,
      generatedAt: new Date().toISOString(),
      status: 'pending',
    };
  }

  createSuggestion(
    insight: CrossProjectInsight,
    sourceFile: string,
    targetFile: string,
    explanation: string
  ): CrossProjectSuggestion {
    return {
      insightId: insight.id,
      sourceProject: insight.sourceProjectId,
      sourceFile,
      targetProject: insight.targetProjectId || '',
      targetFile,
      qualityDelta: insight.qualityDelta || 0,
      explanation,
      adaptationStatus: 'not-started',
    };
  }

  acceptInsight(insight: CrossProjectInsight): CrossProjectInsight {
    return {
      ...insight,
      status: 'accepted',
    };
  }

  dismissInsight(insight: CrossProjectInsight): CrossProjectInsight {
    return {
      ...insight,
      status: 'dismissed',
    };
  }
}
