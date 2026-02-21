// Model Matcher - Semantic model matching based on task requirements
// Spec: .nova/specs/grok-r24-immortal-omniverse.md (R24-01)

import {
  type ModelEntry,
  type ModelCapability,
  getExtendedModelRegistry,
} from './model-registry';

// ═══════════════════════════════════════════════════════════════════════════════
// Type Definitions
// ═══════════════════════════════════════════════════════════════════════════════

export interface TaskRequirements {
  capabilities: RequiredCapability[];
  minQuality?: number;
  maxLatencyMs?: number;
  minContextWindow?: number;
  preferredProviders?: string[];
  excludedModels?: string[];
  budgetLimit?: number;
}

export interface RequiredCapability {
  name: string;
  minScore: number;
  weight: number; // 0-1, importance of this capability
}

export interface MatchResult {
  model: ModelEntry;
  score: number; // 0-1 overall match score
  breakdown: MatchBreakdown;
}

export interface MatchBreakdown {
  capabilityScore: number;
  latencyScore: number;
  costScore: number;
  contextScore: number;
}

export interface MatchOptions {
  maxResults?: number;
  minScore?: number;
  sortBy?: 'score' | 'cost' | 'latency';
}

// ═══════════════════════════════════════════════════════════════════════════════
// ModelMatcher Class
// ═══════════════════════════════════════════════════════════════════════════════

export class ModelMatcher {
  private get registry() {
    return getExtendedModelRegistry();
  }

  /**
   * Match models to task requirements
   */
  match(
    requirements: TaskRequirements,
    options: MatchOptions = {}
  ): MatchResult[] {
    const { maxResults = 5, minScore = 0, sortBy = 'score' } = options;

    // Get candidate models
    let candidates = this.registry.list({ status: 'active' });

    // Filter out excluded models
    if (requirements.excludedModels) {
      candidates = candidates.filter(
        m => !requirements.excludedModels!.includes(m.id)
      );
    }

    // Filter by preferred providers
    if (requirements.preferredProviders) {
      candidates = candidates.filter(m =>
        requirements.preferredProviders!.includes(m.provider)
      );
    }

    // Filter by minimum context window
    if (requirements.minContextWindow) {
      candidates = candidates.filter(
        m => m.performance.contextWindow >= requirements.minContextWindow!
      );
    }

    // Score each candidate
    const scored: MatchResult[] = candidates.map(model =>
      this.scoreMatch(model, requirements)
    );

    // Filter by minimum score
    let results = scored.filter(r => r.score >= minScore);

    // Sort results
    results.sort((a, b) => {
      switch (sortBy) {
        case 'cost':
          return a.model.pricing.inputPerMToken - b.model.pricing.inputPerMToken;
        case 'latency':
          return a.model.performance.latencyP50 - b.model.performance.latencyP50;
        case 'score':
        default:
          return b.score - a.score;
      }
    });

    // Limit results
    return results.slice(0, maxResults);
  }

  /**
   * Find best match for task requirements
   */
  findBest(requirements: TaskRequirements): MatchResult | null {
    const results = this.match(requirements, { maxResults: 1, minScore: 0 });
    return results[0] ?? null;
  }

  /**
   * Score a model against requirements
   */
  private scoreMatch(model: ModelEntry, req: TaskRequirements): MatchResult {
    const breakdown = {
      capabilityScore: this.scoreCapabilities(model, req.capabilities),
      latencyScore: req.maxLatencyMs
        ? this.scoreLatency(model, req.maxLatencyMs)
        : 1,
      costScore: req.budgetLimit ? this.scoreCost(model, req.budgetLimit) : 0.5,
      contextScore: req.minContextWindow
        ? this.scoreContext(model, req.minContextWindow)
        : 1,
    };

    // Weighted average
    const overallScore =
      breakdown.capabilityScore * 0.4 +
      breakdown.latencyScore * 0.25 +
      breakdown.costScore * 0.2 +
      breakdown.contextScore * 0.15;

    return {
      model,
      score: overallScore,
      breakdown,
    };
  }

  /**
   * Score capability match
   */
  private scoreCapabilities(
    model: ModelEntry,
    required: RequiredCapability[]
  ): number {
    if (required.length === 0) return 1;

    let totalWeight = 0;
    let weightedScore = 0;

    for (const req of required) {
      totalWeight += req.weight;
      const modelCap = model.capabilities.find(c => c.name === req.name);

      if (!modelCap) {
        // Capability not found - zero score for this capability
        continue;
      }

      // Score based on how well it exceeds minimum
      const excess = Math.max(0, modelCap.score - req.minScore);
      const range = 1 - req.minScore;
      const bonus = range > 0 ? excess / range : 0;

      // Base score is 1 if meets minimum, plus bonus for exceeding
      const capScore = modelCap.score >= req.minScore ? 0.7 + bonus * 0.3 : 0;
      weightedScore += capScore * req.weight;
    }

    return totalWeight > 0 ? weightedScore / totalWeight : 0;
  }

  /**
   * Score latency match (lower is better)
   */
  private scoreLatency(model: ModelEntry, maxLatencyMs: number): number {
    const p95 = model.performance.latencyP95;
    if (p95 <= maxLatencyMs) return 1;

    // Linear decay after threshold
    const excess = p95 - maxLatencyMs;
    const tolerance = maxLatencyMs * 0.5; // 50% tolerance
    return Math.max(0, 1 - excess / tolerance);
  }

  /**
   * Score cost match (lower is better)
   */
  private scoreCost(model: ModelEntry, budgetLimit: number): number {
    // Estimate cost per 1k tokens
    const estimatedCost =
      (model.pricing.inputPerMToken + model.pricing.outputPerMToken) / 1000;

    if (estimatedCost === 0) return 1; // Free model
    if (estimatedCost <= budgetLimit) return 1;

    // Logarithmic decay for cost exceeding budget
    const ratio = budgetLimit / estimatedCost;
    return Math.max(0, Math.log10(ratio * 9 + 1)); // Scale 0-1
  }

  /**
   * Score context window match
   */
  private scoreContext(model: ModelEntry, minContext: number): number {
    const context = model.performance.contextWindow;
    if (context >= minContext) return 1;

    // Linear penalty for insufficient context
    return context / minContext;
  }

  /**
   * Explain why a model was matched
   */
  explainMatch(result: MatchResult): string {
    const { model, score, breakdown } = result;

    const lines = [
      `Match for "${model.name}" (score: ${(score * 100).toFixed(1)}%)`,
      `  Capabilities: ${(breakdown.capabilityScore * 100).toFixed(0)}%`,
      `  Latency: ${(breakdown.latencyScore * 100).toFixed(0)}%`,
      `  Cost: ${(breakdown.costScore * 100).toFixed(0)}%`,
      `  Context: ${(breakdown.contextScore * 100).toFixed(0)}%`,
      `  Provider: ${model.provider}`,
      `  Price: $${model.pricing.inputPerMToken}/M input, $${model.pricing.outputPerMToken}/M output`,
      `  P50 Latency: ${model.performance.latencyP50}ms`,
      `  Context Window: ${model.performance.contextWindow.toLocaleString()} tokens`,
    ];

    return lines.join('\n');
  }

  /**
   * Compare two models for a specific task
   */
  compare(
    modelIdA: string,
    modelIdB: string,
    requirements: TaskRequirements
  ): { winner: string; diff: number; reasons: string[] } | null {
    const modelA = this.registry.get(modelIdA);
    const modelB = this.registry.get(modelIdB);

    if (!modelA || !modelB) return null;

    const resultA = this.scoreMatch(modelA, requirements);
    const resultB = this.scoreMatch(modelB, requirements);

    const winner = resultA.score >= resultB.score ? modelA : modelB;
    const loser = resultA.score >= resultB.score ? modelB : modelA;
    const winnerResult = resultA.score >= resultB.score ? resultA : resultB;
    const loserResult = resultA.score >= resultB.score ? resultB : resultA;

    const diff = Math.abs(resultA.score - resultB.score);
    const reasons: string[] = [];

    // Generate comparison reasons
    if (winnerResult.breakdown.capabilityScore > loserResult.breakdown.capabilityScore + 0.1) {
      reasons.push(`${winner.name} has better capabilities`);
    }

    if (winnerResult.breakdown.latencyScore > loserResult.breakdown.latencyScore + 0.1) {
      reasons.push(`${winner.name} has lower latency`);
    }

    if (winnerResult.breakdown.costScore > loserResult.breakdown.costScore + 0.1) {
      reasons.push(`${winner.name} is more cost-effective`);
    }

    if (winner.pricing.inputPerMToken < loser.pricing.inputPerMToken * 0.5) {
      reasons.push(`${winner.name} is significantly cheaper`);
    }

    if (winner.performance.latencyP50 < loser.performance.latencyP50 * 0.7) {
      reasons.push(`${winner.name} is much faster`);
    }

    return {
      winner: winner.id,
      diff,
      reasons: reasons.length > 0 ? reasons : ['Overall better match'],
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════════════════════

let globalMatcher: ModelMatcher | null = null;

export function getModelMatcher(): ModelMatcher {
  if (!globalMatcher) {
    globalMatcher = new ModelMatcher();
  }
  return globalMatcher;
}

export function resetModelMatcher(): void {
  globalMatcher = null;
}
