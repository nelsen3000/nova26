// Model Taste Integrator — Connects ATLAS memory with model selection preferences
// KIMI-R24-01 | Feb 2026

import type { AIModelVault, JonFeedback, SemanticSelectOptions, ModelMetadata } from '../models/ai-model-vault.js';

export interface TasteIntegratorConfig {
  feedbackDecayDays: number;   // older feedback has less weight
  minFeedbackCount: number;    // min feedback needed before adjusting
  maxAffinityDelta: number;    // max change in affinity per batch
}

export interface ModelPreferenceReport {
  modelId: string;
  totalFeedback: number;
  avgRating: number;
  likeRate: number;
  adjustedAffinity: number;
  recommendation: 'boost' | 'maintain' | 'demote';
}

const DEFAULT_CONFIG: TasteIntegratorConfig = {
  feedbackDecayDays: 30,
  minFeedbackCount: 3,
  maxAffinityDelta: 0.3,
};

export class ModelTasteIntegrator {
  private config: TasteIntegratorConfig;
  private vault: AIModelVault;

  constructor(vault: AIModelVault, config: Partial<TasteIntegratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.vault = vault;
  }

  processFeedbackBatch(feedbacks: JonFeedback[]): ModelPreferenceReport[] {
    const byModel = new Map<string, JonFeedback[]>();
    for (const fb of feedbacks) {
      if (!byModel.has(fb.modelId)) byModel.set(fb.modelId, []);
      byModel.get(fb.modelId)!.push(fb);
    }

    const reports: ModelPreferenceReport[] = [];
    for (const [modelId, mFeedbacks] of byModel) {
      if (mFeedbacks.length < this.config.minFeedbackCount) continue;

      const report = this.buildReport(modelId, mFeedbacks);
      reports.push(report);

      // Apply affinity update
      const delta = this.computeAffinityDelta(report);
      this.vault.updateAffinity(modelId, delta);
    }

    return reports;
  }

  buildReport(modelId: string, feedbacks: JonFeedback[]): ModelPreferenceReport {
    const now = Date.now();
    const decayMs = this.config.feedbackDecayDays * 24 * 60 * 60 * 1000;

    // Weight older feedback less
    let weightedRating = 0;
    let totalWeight = 0;
    let likeCount = 0;

    for (const fb of feedbacks) {
      const age = now - fb.timestamp;
      const weight = Math.max(0.1, 1 - age / decayMs);
      weightedRating += fb.rating * weight;
      totalWeight += weight;
      if (fb.liked) likeCount++;
    }

    const avgRating = totalWeight > 0 ? weightedRating / totalWeight : 3;
    const likeRate = likeCount / feedbacks.length;
    const adjustedAffinity = this.vault.getAffinity(modelId);

    let recommendation: ModelPreferenceReport['recommendation'] = 'maintain';
    if (avgRating >= 4 && likeRate >= 0.7) recommendation = 'boost';
    else if (avgRating <= 2 || likeRate <= 0.3) recommendation = 'demote';

    return {
      modelId,
      totalFeedback: feedbacks.length,
      avgRating,
      likeRate,
      adjustedAffinity,
      recommendation,
    };
  }

  selectWithTasteContext(
    opts: SemanticSelectOptions,
    projectId?: string,
  ): ModelMetadata | undefined {
    // Boost taste weight for known projects
    const tasteWeight = projectId ? Math.min(0.8, (opts.tasteWeight ?? 0.5) + 0.2) : (opts.tasteWeight ?? 0.5);
    return this.vault.semanticSelect({ ...opts, tasteWeight });
  }

  getTopPreferredModels(agentId: string, limit = 5): Array<{ modelId: string; affinity: number }> {
    const routes = this.vault.getRoutes(agentId);
    return routes
      .map(r => ({ modelId: r.modelId, affinity: r.affinityScore }))
      .sort((a, b) => b.affinity - a.affinity)
      .slice(0, limit);
  }

  private computeAffinityDelta(report: ModelPreferenceReport): number {
    switch (report.recommendation) {
      case 'boost': return Math.min(this.config.maxAffinityDelta, 0.1);
      case 'demote': return Math.max(-this.config.maxAffinityDelta, -0.1);
      default: return 0;
    }
  }
}
