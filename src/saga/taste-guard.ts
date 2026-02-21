// Taste Guard - Hard constraint filter against Taste Vault patterns
// Spec: .kiro/specs/saga-self-evolving-agents/design.md

import type { GoalGenome, TastePattern, TasteCheckResult, TasteConflict } from './types.js';
import { TasteCheckResultSchema } from './schemas.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface TasteGuardConfig {
  /** Patterns with successScore > threshold are treated as hard constraints */
  successScoreThreshold: number;
  /** Enable detailed conflict reporting */
  detailedReporting: boolean;
}

export const DEFAULT_CONFIG: TasteGuardConfig = {
  successScoreThreshold: 0.5,
  detailedReporting: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Taste Checking
// ═══════════════════════════════════════════════════════════════════════════════

export function check(
  genome: GoalGenome,
  patterns: TastePattern[],
  config: Partial<TasteGuardConfig> = {}
): TasteCheckResult {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const conflicts: TasteConflict[] = [];

  for (const pattern of patterns) {
    // Only check active patterns with high success scores
    if (!pattern.isActive || pattern.successScore <= fullConfig.successScoreThreshold) {
      continue;
    }

    // Check each objective against this pattern
    for (const objective of genome.objectives) {
      const conflict = checkObjectiveAgainstPattern(objective, pattern, fullConfig);
      if (conflict) {
        conflicts.push(conflict);
      }
    }
  }

  const result: TasteCheckResult = {
    passed: conflicts.length === 0,
    conflicts,
  };

  return TasteCheckResultSchema.parse(result);
}

export function filterCandidates(
  candidates: GoalGenome[],
  patterns: TastePattern[],
  config: Partial<TasteGuardConfig> = {}
): GoalGenome[] {
  return candidates.filter(candidate => {
    const result = check(candidate, patterns, config);
    return result.passed;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Conflict Detection
// ═══════════════════════════════════════════════════════════════════════════════

function checkObjectiveAgainstPattern(
  objective: { id: string; description: string; domain: string },
  pattern: TastePattern,
  config: TasteGuardConfig
): TasteConflict | null {
  // Pattern matching strategies

  // 1. Direct content match in description
  if (containsPattern(objective.description, pattern.canonicalContent)) {
    return {
      objectiveId: objective.id,
      patternId: pattern.id,
      reason: `Objective description contains conflicting pattern: "${pattern.canonicalContent}"`,
    };
  }

  // 2. Domain match with pattern tags
  for (const tag of pattern.tags) {
    if (objective.domain.toLowerCase() === tag.toLowerCase()) {
      return {
        objectiveId: objective.id,
        patternId: pattern.id,
        reason: `Objective domain "${objective.domain}" conflicts with pattern tag "${tag}"`,
      };
    }
  }

  // 3. Semantic similarity check (simplified - could be enhanced with embeddings)
  const similarity = calculateSimilarity(objective.description, pattern.canonicalContent);
  if (similarity > 0.8) {
    return {
      objectiveId: objective.id,
      patternId: pattern.id,
      reason: `High semantic similarity (${similarity.toFixed(2)}) with pattern: "${pattern.canonicalContent}"`,
    };
  }

  return null;
}

function containsPattern(text: string, pattern: string): boolean {
  // Case-insensitive substring match
  return text.toLowerCase().includes(pattern.toLowerCase());
}

function calculateSimilarity(str1: string, str2: string): number {
  // Simple Jaccard similarity on word sets
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Batch Operations
// ═══════════════════════════════════════════════════════════════════════════════

export interface BatchCheckResult {
  passed: GoalGenome[];
  rejected: Array<{ genome: GoalGenome; conflicts: TasteConflict[] }>;
  passRate: number;
}

export function checkBatch(
  candidates: GoalGenome[],
  patterns: TastePattern[],
  config: Partial<TasteGuardConfig> = {}
): BatchCheckResult {
  const passed: GoalGenome[] = [];
  const rejected: Array<{ genome: GoalGenome; conflicts: TasteConflict[] }> = [];

  for (const genome of candidates) {
    const result = check(genome, patterns, config);
    if (result.passed) {
      passed.push(genome);
    } else {
      rejected.push({ genome, conflicts: result.conflicts });
    }
  }

  const passRate = candidates.length > 0 ? passed.length / candidates.length : 0;

  return { passed, rejected, passRate };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pattern Statistics
// ═══════════════════════════════════════════════════════════════════════════════

export interface PatternStatistics {
  patternId: string;
  checksPerformed: number;
  conflictsFound: number;
  conflictRate: number;
}

export function calculatePatternStatistics(
  results: BatchCheckResult
): PatternStatistics[] {
  const stats = new Map<string, { checks: number; conflicts: number }>();

  for (const rejected of results.rejected) {
    for (const conflict of rejected.conflicts) {
      const current = stats.get(conflict.patternId) || { checks: 0, conflicts: 0 };
      current.checks++;
      current.conflicts++;
      stats.set(conflict.patternId, current);
    }
  }

  // Count checks that passed (each passed genome was checked against all patterns)
  const passedCount = results.passed.length;
  // Estimate total checks (simplified)

  return Array.from(stats.entries()).map(([patternId, data]) => ({
    patternId,
    checksPerformed: data.checks,
    conflictsFound: data.conflicts,
    conflictRate: data.checks > 0 ? data.conflicts / data.checks : 0,
  }));
}
