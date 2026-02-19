// KIMI-ACE-03: Rehearsal Scorer for Branch Evaluation
// Scores branches based on type safety, line delta, agent assessment, and taste alignment

import type { RehearsalBranch } from './branch-manager.js';
import { getTasteVault } from '../taste-vault/taste-vault.js';

// ============================================================================
// Types
// ============================================================================

export interface ScoreBreakdown {
  typeCheckPass: number;
  lineDelta: number;
  agentSelfAssessment: number;
  tasteAlignment: number;
  compositeScore: number;
}

export interface RehearsalResult {
  branchId: string;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  summary: string;
  tasteAlignment: number;
  estimatedQuality: 'low' | 'medium' | 'high';
  previewSnippet: string;
}

// ============================================================================
// Scoring Weights
// ============================================================================

const WEIGHTS = {
  typeCheckPass: 0.35,
  lineDelta: 0.15,
  agentSelfAssessment: 0.25,
  tasteAlignment: 0.25,
};

// ============================================================================
// Confidence Keywords for Agent Self-Assessment
// ============================================================================

const POSITIVE_CONFIDENCE_KEYWORDS = [
  'confident',
  'solid',
  'robust',
  'clean',
  'idiomatic',
  'optimal',
  'efficient',
  'well-tested',
  'production-ready',
  'best practice',
  'recommended',
  'preferred',
];

const NEGATIVE_CONFIDENCE_KEYWORDS = [
  'hack',
  'workaround',
  'temporary',
  'quick fix',
  'not ideal',
  'compromise',
  'limited',
  'basic',
  'simple',
  'minimal',
  'rough',
  'draft',
];

// ============================================================================
// Rehearsal Scorer Class
// ============================================================================

export class RehearsalScorer {
  /**
   * Score a branch based on multiple criteria:
   * - typeCheckPass (weight 0.35): Heuristic scan for untyped params, 'any' usage
   * - lineDelta (weight 0.15): 1.0 if delta <= 0, decay to 0.5 at +200 lines
   * - agentSelfAssessment (weight 0.25): Parse agentNotes for confidence signals
   * - tasteAlignment (weight 0.25): Check against TasteVault patterns
   * 
   * compositeScore = weighted sum, clamped [0,1]
   * estimatedQuality: >=0.8 high, >=0.55 medium, <0.55 low
   * previewSnippet: first 300 chars of primary changed file
   */
  async score(branch: RehearsalBranch): Promise<RehearsalResult> {
    const typeCheckPass = this.calculateTypeCheckPass(branch);
    const lineDelta = this.calculateLineDelta(branch);
    const agentSelfAssessment = this.calculateAgentSelfAssessment(branch);
    const tasteAlignment = await this.calculateTasteAlignment(branch);

    const compositeScore = this.calculateCompositeScore({
      typeCheckPass,
      lineDelta,
      agentSelfAssessment,
      tasteAlignment,
    });

    const estimatedQuality = this.determineQuality(compositeScore);
    const previewSnippet = this.generatePreviewSnippet(branch);
    const summary = this.generateSummary(branch, compositeScore, {
      typeCheckPass,
      lineDelta,
      agentSelfAssessment,
      tasteAlignment,
    });

    return {
      branchId: branch.id,
      score: compositeScore,
      scoreBreakdown: {
        typeCheckPass,
        lineDelta,
        agentSelfAssessment,
        tasteAlignment,
        compositeScore,
      },
      summary,
      tasteAlignment,
      estimatedQuality,
      previewSnippet,
    };
  }

  /**
   * Calculate type check pass score
   * Heuristic scan for untyped params, 'any' usage, missing return types
   * Returns 0-1 where 1 = excellent type safety, 0 = poor type safety
   */
  private calculateTypeCheckPass(branch: RehearsalBranch): number {
    let totalIssues = 0;
    let totalLines = 0;

    for (const file of branch.files) {
      const content = file.proposedContent;
      const lines = content.split('\n');
      totalLines += lines.length;

      // Count 'any' usage
      const anyMatches = content.match(/:\s*any\b/g);
      if (anyMatches) {
        totalIssues += anyMatches.length * 2;
      }

      // Count untyped function parameters (simplified heuristic)
      // Look for params that don't have type annotations
      const paramMatches = content.match(/\(([^)]*)\)\s*=>|function\s*\w*\s*\(([^)]*)\)/g);
      if (paramMatches) {
        for (const match of paramMatches) {
          // Check if params have no type annotation
          if (match.includes(':') === false && match.match(/\w+/)) {
            totalIssues += 1;
          }
        }
      }

      // Count missing return types on functions
      const functionMatches = content.match(/function\s+\w+\s*\([^)]*\)\s*\{/g);
      if (functionMatches) {
        for (const match of functionMatches) {
          if (!match.includes('):')) {
            totalIssues += 1;
          }
        }
      }

      // Bonus for proper TypeScript patterns
      if (content.includes('interface ')) totalIssues -= 0.5;
      if (content.includes('type ')) totalIssues -= 0.5;
    }

    // Normalize to 0-1 scale
    // Fewer issues = higher score
    const issueRate = totalLines > 0 ? totalIssues / totalLines : 0;
    const score = Math.max(0, Math.min(1, 1 - issueRate * 5));
    
    return Math.round(score * 100) / 100;
  }

  /**
   * Calculate line delta score
   * 1.0 if delta <= 0 (reduced or same lines)
   * Decays to 0.5 at +200 lines
   */
  private calculateLineDelta(branch: RehearsalBranch): number {
    let totalDelta = 0;

    for (const file of branch.files) {
      const originalLines = file.originalContent.split('\n').length;
      const proposedLines = file.proposedContent.split('\n').length;
      totalDelta += proposedLines - originalLines;
    }

    // Score calculation:
    // delta <= 0: score = 1.0
    // delta > 0: linear decay from 1.0 to 0.5 at +200 lines
    if (totalDelta <= 0) {
      return 1.0;
    }

    const score = 1.0 - (totalDelta / 200) * 0.5;
    return Math.max(0.5, Math.round(score * 100) / 100);
  }

  /**
   * Calculate agent self-assessment score
   * Parse agentNotes for confidence signals
   * Returns 0-1 based on positive/negative keyword ratio
   */
  private calculateAgentSelfAssessment(branch: RehearsalBranch): number {
    const notes = branch.agentNotes.toLowerCase();
    
    let positiveCount = 0;
    let negativeCount = 0;

    for (const keyword of POSITIVE_CONFIDENCE_KEYWORDS) {
      const regex = new RegExp(keyword.toLowerCase(), 'g');
      const matches = notes.match(regex);
      if (matches) {
        positiveCount += matches.length;
      }
    }

    for (const keyword of NEGATIVE_CONFIDENCE_KEYWORDS) {
      const regex = new RegExp(keyword.toLowerCase(), 'g');
      const matches = notes.match(regex);
      if (matches) {
        negativeCount += matches.length;
      }
    }

    // Calculate score
    const total = positiveCount + negativeCount;
    if (total === 0) {
      // Neutral if no keywords found
      return 0.5;
    }

    const score = positiveCount / total;
    return Math.round(score * 100) / 100;
  }

  /**
   * Calculate taste alignment score
   * Check proposed code against TasteVault patterns
   * Returns 0-1 based on alignment with user's taste patterns
   */
  private async calculateTasteAlignment(branch: RehearsalBranch): Promise<number> {
    const vault = getTasteVault('default');
    
    // Combine all proposed content for pattern matching
    const combinedContent = branch.files
      .map(f => f.proposedContent)
      .join('\n\n');

    // Detect patterns in the proposed code
    const detectedPatterns = await vault.detectPatterns(combinedContent);
    
    if (detectedPatterns.length === 0) {
      // No patterns detected, return neutral score
      return 0.5;
    }

    // Get relevant patterns from the vault based on the task description
    const relevantPatterns = await vault.getRelevantPatterns(
      `${branch.description} ${branch.agentNotes}`,
      10
    );

    // Calculate alignment score
    // Higher score if detected patterns match relevant vault patterns
    let alignmentScore = 0;
    let matchCount = 0;

    for (const detected of detectedPatterns) {
      const content = detected.content.toLowerCase();
      
      for (const relevant of relevantPatterns) {
        const relevantContent = relevant.content.toLowerCase();
        
        // Check for content similarity
        if (this.contentSimilarity(content, relevantContent) > 0.6) {
          alignmentScore += relevant.confidence;
          matchCount++;
        }
      }
    }

    if (matchCount === 0) {
      return 0.5;
    }

    const score = alignmentScore / matchCount;
    return Math.round(Math.min(1, score) * 100) / 100;
  }

  /**
   * Calculate content similarity between two strings
   * Simple token-based Jaccard similarity
   */
  private contentSimilarity(a: string, b: string): number {
    const tokenize = (text: string): Set<string> => {
      return new Set(
        text
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter(t => t.length > 2)
      );
    };

    const tokensA = tokenize(a);
    const tokensB = tokenize(b);

    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    const intersection = new Set([...tokensA].filter(x => tokensB.has(x)));
    const union = new Set([...tokensA, ...tokensB]);

    return intersection.size / union.size;
  }

  /**
   * Calculate composite score from individual scores
   * Weighted sum, clamped [0,1]
   */
  private calculateCompositeScore(scores: {
    typeCheckPass: number;
    lineDelta: number;
    agentSelfAssessment: number;
    tasteAlignment: number;
  }): number {
    const composite = 
      scores.typeCheckPass * WEIGHTS.typeCheckPass +
      scores.lineDelta * WEIGHTS.lineDelta +
      scores.agentSelfAssessment * WEIGHTS.agentSelfAssessment +
      scores.tasteAlignment * WEIGHTS.tasteAlignment;

    return Math.round(Math.max(0, Math.min(1, composite)) * 100) / 100;
  }

  /**
   * Determine estimated quality based on composite score
   * >=0.8 high, >=0.55 medium, <0.55 low
   */
  private determineQuality(score: number): 'low' | 'medium' | 'high' {
    if (score >= 0.8) return 'high';
    if (score >= 0.55) return 'medium';
    return 'low';
  }

  /**
   * Generate preview snippet from primary changed file
   * Returns first 300 chars
   */
  private generatePreviewSnippet(branch: RehearsalBranch): string {
    if (branch.files.length === 0) {
      return '';
    }

    // Use the first file as primary
    const primaryFile = branch.files[0];
    const content = primaryFile.proposedContent;
    
    // Extract first 300 chars, preserving whole lines if possible
    if (content.length <= 300) {
      return content;
    }

    // Find the last newline before 300 chars
    const snippet = content.slice(0, 300);
    const lastNewline = snippet.lastIndexOf('\n');
    
    if (lastNewline > 200) {
      return snippet.slice(0, lastNewline) + '\n// ...';
    }

    return snippet + '...';
  }

  /**
   * Generate human-readable summary of the scoring
   */
  private generateSummary(
    branch: RehearsalBranch,
    compositeScore: number,
    scores: {
      typeCheckPass: number;
      lineDelta: number;
      agentSelfAssessment: number;
      tasteAlignment: number;
    }
  ): string {
    const parts: string[] = [];

    parts.push(`Branch "${branch.description}" scored ${(compositeScore * 100).toFixed(0)}%`);
    
    if (scores.typeCheckPass >= 0.8) {
      parts.push('Excellent type safety');
    } else if (scores.typeCheckPass >= 0.5) {
      parts.push('Good type safety');
    } else {
      parts.push('Type safety needs improvement');
    }

    if (scores.lineDelta >= 0.9) {
      parts.push('Minimal code change');
    } else if (scores.lineDelta >= 0.7) {
      parts.push('Moderate code change');
    } else {
      parts.push('Significant code change');
    }

    if (scores.tasteAlignment >= 0.7) {
      parts.push('Well aligned with taste patterns');
    } else if (scores.tasteAlignment <= 0.4) {
      parts.push('Deviates from taste patterns');
    }

    return parts.join('. ') + '.';
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let scorerInstance: RehearsalScorer | null = null;

export function getRehearsalScorer(): RehearsalScorer {
  if (!scorerInstance) {
    scorerInstance = new RehearsalScorer();
  }
  return scorerInstance;
}

export function resetRehearsalScorer(): void {
  scorerInstance = null;
}
