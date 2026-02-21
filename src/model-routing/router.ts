// Agent Model Router — Confidence-based escalation
// KIMI-R22-01 | Feb 2026

import type {
  AgentModelMapping,
  ModelProfile,
  ModelRoutingConfig,
  InferenceResult,
  HardwareTier,
} from './types.js';
import { DEFAULT_AGENT_MAPPINGS, getAgentMapping } from './model-registry.js';
import { detectHardware } from './hardware-detector.js';
import { MetricsTracker } from './metrics-tracker.js';

export interface RouterContext {
  agentId: string;
  prompt: string;
  tasteVaultWeight?: number;  // User preference boost (0-1)
  urgency?: number;           // 0-1; high urgency → prefer speed over quality
  maxBudget?: number;         // costFactor ceiling
}

export interface RouteDecision {
  model: ModelProfile;
  reason: 'primary' | 'fallback' | 'hardware-limit' | 'budget-limit';
  mapping: AgentModelMapping;
  hardwareTier: HardwareTier;
}

export class AgentModelRouter {
  private config: ModelRoutingConfig;
  private hardware: HardwareTier;
  private metrics: MetricsTracker;

  constructor(config: ModelRoutingConfig, metrics: MetricsTracker) {
    this.config = config;
    this.metrics = metrics;

    const detection = detectHardware(config.forceTier);
    this.hardware = detection.tier;
  }

  getHardwareTier(): HardwareTier {
    return this.hardware;
  }

  route(ctx: RouterContext): RouteDecision {
    const mapping = this.resolveMapping(ctx.agentId);
    const urgency = ctx.urgency ?? 0.5;
    const maxBudget = ctx.maxBudget ?? Infinity;

    // If urgency is very high, prefer fast models regardless of quality
    if (urgency > 0.85) {
      const fastModel = this.findFastModel(mapping, maxBudget);
      if (fastModel) {
        return { model: fastModel, reason: 'primary', mapping, hardwareTier: this.hardware };
      }
    }

    // Check if primary model fits hardware
    if (this.modelFitsHardware(mapping.primary) && mapping.primary.costFactor <= maxBudget) {
      return { model: mapping.primary, reason: 'primary', mapping, hardwareTier: this.hardware };
    }

    // Try fallbacks in order
    for (const fallback of mapping.fallback) {
      if (this.modelFitsHardware(fallback) && fallback.costFactor <= maxBudget) {
        const reason = !this.modelFitsHardware(mapping.primary) ? 'hardware-limit' : 'budget-limit';
        return { model: fallback, reason, mapping, hardwareTier: this.hardware };
      }
    }

    // Last resort: smallest fallback regardless of hardware (will be slow)
    const cheapest = [...mapping.fallback].sort((a, b) => a.costFactor - b.costFactor)[0];
    return {
      model: cheapest ?? mapping.primary,
      reason: 'fallback',
      mapping,
      hardwareTier: this.hardware,
    };
  }

  async escalate(
    ctx: RouterContext,
    currentModel: ModelProfile,
    currentConfidence: number,
    executeInference: (model: ModelProfile, prompt: string) => Promise<InferenceResult>,
  ): Promise<InferenceResult> {
    const mapping = this.resolveMapping(ctx.agentId);

    if (currentConfidence >= mapping.confidenceThreshold) {
      // Already good enough — return a "mock" escalation result that indicates no escalation
      return executeInference(currentModel, ctx.prompt);
    }

    // Find a better model than the current one
    const candidates = [mapping.primary, ...mapping.fallback].filter(
      m => m.costFactor > currentModel.costFactor && this.modelFitsHardware(m),
    );

    if (!candidates.length) {
      // No better model available — return with current
      return executeInference(currentModel, ctx.prompt);
    }

    const escalatedModel = candidates.sort((a, b) => b.costFactor - a.costFactor)[0]!;
    const result = await executeInference(escalatedModel, ctx.prompt);

    this.metrics.record({
      agentId: ctx.agentId,
      modelUsed: escalatedModel.name,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      durationMs: result.durationMs,
      confidence: result.confidence,
      energyWh: estimateEnergy(result.durationMs, escalatedModel),
      timestamp: Date.now(),
      wasEscalated: true,
    });

    return { ...result, escalated: true };
  }

  private resolveMapping(agentId: string): AgentModelMapping {
    // Custom config takes precedence over defaults
    const custom = this.config.agentMappings.find(m => m.agentId === agentId);
    if (custom) return custom;
    const def = getAgentMapping(agentId);
    if (def) return def;

    // Unknown agent — use a safe default
    return DEFAULT_AGENT_MAPPINGS.find(m => m.agentId === 'EARTH')!;
  }

  private modelFitsHardware(model: ModelProfile): boolean {
    const available = this.hardware.vramGB > 0 ? this.hardware.vramGB : this.hardware.ramGB * 0.5;
    return model.vramRequiredGB <= available;
  }

  private findFastModel(mapping: AgentModelMapping, maxBudget: number): ModelProfile | undefined {
    return [...mapping.fallback, mapping.primary]
      .filter(m => m.costFactor <= maxBudget && this.modelFitsHardware(m))
      .sort((a, b) => b.tokensPerSec - a.tokensPerSec)[0];
  }
}

function estimateEnergy(durationMs: number, model: ModelProfile): number {
  // Rough: 50W base + 5W per GB VRAM
  const watts = 50 + model.vramRequiredGB * 5;
  return (watts * durationMs) / (1000 * 3600); // Wh
}
