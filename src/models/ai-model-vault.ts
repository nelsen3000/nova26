// AI Model Vault — Celestial Model Archive
// Central registry for all AI models with Taste Vault-aware selection
// KIMI-R24-01 | Feb 2026

export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'meta' | 'qwen' | 'deepseek' |
  'kimi' | 'minimax' | 'mistral' | 'phi' | 'nvidia' | 'local' | 'custom';

export type ModelCapabilityType =
  | 'text-generation'
  | 'code-generation'
  | 'reasoning'
  | 'multimodal'
  | 'embedding'
  | 'fast-inference'
  | 'long-context'
  | 'tool-use';

export interface ModelCapabilities {
  types: ModelCapabilityType[];
  maxContextWindow: number;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
  avgLatencyMs: number;      // p50 latency under normal load
  throughputTPS: number;     // tokens per second
}

export interface ModelPricing {
  inputPerMillion: number;   // USD per 1M input tokens
  outputPerMillion: number;  // USD per 1M output tokens
  currency: 'USD';
  tier: 'budget' | 'standard' | 'premium';
}

export interface ModelMetadata {
  id: string;
  name: string;
  provider: ModelProvider;
  version: string;
  description: string;
  capabilities: ModelCapabilities;
  pricing: ModelPricing;
  benchmarks: Record<string, number>;  // e.g. { sweBench: 80.2, humanEval: 0.91 }
  tags: string[];
  isLocal: boolean;
  ollamaTag?: string;
  apiEndpoint?: string;
  releaseDate: string;
  isDeprecated: boolean;
}

export interface JonFeedback {
  modelId: string;
  taskId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  liked: boolean;
  comment?: string;
  timestamp: number;
  agentId?: string;
}

export interface ModelRoute {
  agentId: string;
  modelId: string;
  tier: 'quality' | 'speed' | 'budget';
  affinityScore: number;    // 0-1; higher = more preferred
  overrideReason?: string;
}

export interface SemanticSelectOptions {
  agentId: string;
  requiredCapabilities?: ModelCapabilityType[];
  maxLatencyMs?: number;
  maxCostPerMillion?: number;
  tasteWeight?: number;      // how much Taste Vault affects selection (0-1)
  preferLocal?: boolean;
  tier?: 'quality' | 'speed' | 'budget' | 'any';
}

export interface ModelVaultStats {
  totalModels: number;
  localModels: number;
  cloudModels: number;
  avgAffinityScore: number;
  topModels: Array<{ id: string; affinityScore: number }>;
}

export class AIModelVault {
  private models = new Map<string, ModelMetadata>();
  private routes = new Map<string, ModelRoute[]>(); // agentId → routes
  private feedback: JonFeedback[] = [];
  private affinities = new Map<string, number>(); // modelId → affinity (0-1)

  register(model: ModelMetadata): void {
    this.models.set(model.id, model);
    if (!this.affinities.has(model.id)) {
      this.affinities.set(model.id, 0.5); // start neutral
    }
  }

  getModel(modelId: string): ModelMetadata | undefined {
    return this.models.get(modelId);
  }

  listModels(filter?: { provider?: ModelProvider; isLocal?: boolean; capability?: ModelCapabilityType }): ModelMetadata[] {
    let models = [...this.models.values()].filter(m => !m.isDeprecated);
    if (filter?.provider) models = models.filter(m => m.provider === filter.provider);
    if (filter?.isLocal !== undefined) models = models.filter(m => m.isLocal === filter.isLocal);
    if (filter?.capability) models = models.filter(m => m.capabilities.types.includes(filter.capability!));
    return models;
  }

  semanticSelect(opts: SemanticSelectOptions): ModelMetadata | undefined {
    const tier = opts.tier ?? 'quality';
    let candidates = [...this.models.values()].filter(m => !m.isDeprecated);

    // Filter by capabilities
    if (opts.requiredCapabilities?.length) {
      candidates = candidates.filter(m =>
        opts.requiredCapabilities!.every(cap => m.capabilities.types.includes(cap)),
      );
    }

    // Filter by latency
    if (opts.maxLatencyMs !== undefined) {
      candidates = candidates.filter(m => m.capabilities.avgLatencyMs <= opts.maxLatencyMs!);
    }

    // Filter by cost
    if (opts.maxCostPerMillion !== undefined) {
      candidates = candidates.filter(m => m.pricing.inputPerMillion <= opts.maxCostPerMillion!);
    }

    // Prefer local models
    if (opts.preferLocal) {
      const local = candidates.filter(m => m.isLocal);
      if (local.length > 0) candidates = local;
    }

    if (!candidates.length) return undefined;

    // Score each candidate
    const tasteWeight = opts.tasteWeight ?? 0.5;
    const scored = candidates.map(m => {
      const affinity = this.affinities.get(m.id) ?? 0.5;
      const agentRoutes = this.routes.get(opts.agentId) ?? [];
      const routeBoost = agentRoutes.find(r => r.modelId === m.id)?.affinityScore ?? 0;

      // Quality proxy: benchmark average
      const benchAvg = Object.values(m.benchmarks).length
        ? Object.values(m.benchmarks).reduce((s, v) => s + v, 0) / Object.values(m.benchmarks).length / 100
        : 0.5;

      // Tier preference
      const tierMatch = m.pricing.tier === tier || tier === 'any' ? 0.1 : 0;

      const score = tasteWeight * affinity + (1 - tasteWeight) * benchAvg + routeBoost * 0.2 + tierMatch;
      return { model: m, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.model;
  }

  updateAffinity(modelId: string, delta: number): void {
    const current = this.affinities.get(modelId) ?? 0.5;
    this.affinities.set(modelId, Math.min(1, Math.max(0, current + delta)));
  }

  setRoute(agentId: string, route: ModelRoute): void {
    if (!this.routes.has(agentId)) this.routes.set(agentId, []);
    const routes = this.routes.get(agentId)!;
    const idx = routes.findIndex(r => r.modelId === route.modelId && r.tier === route.tier);
    if (idx >= 0) {
      routes[idx] = route;
    } else {
      routes.push(route);
    }
  }

  getRoutes(agentId: string): ModelRoute[] {
    return this.routes.get(agentId) ?? [];
  }

  recordFeedback(fb: JonFeedback): void {
    this.feedback.push(fb);
    // Update affinity based on feedback
    const delta = fb.liked ? 0.05 : -0.05;
    const ratingDelta = (fb.rating - 3) * 0.02; // -0.04 to +0.04
    this.updateAffinity(fb.modelId, delta + ratingDelta);
  }

  syncFromProvider(provider: ModelProvider, models: ModelMetadata[]): { added: number; updated: number } {
    let added = 0;
    let updated = 0;
    for (const model of models) {
      if (model.provider !== provider) continue;
      if (this.models.has(model.id)) {
        updated++;
      } else {
        added++;
      }
      this.register(model);
    }
    return { added, updated };
  }

  getStats(): ModelVaultStats {
    const models = [...this.models.values()].filter(m => !m.isDeprecated);
    const affinities = models.map(m => this.affinities.get(m.id) ?? 0.5);
    const avgAffinity = affinities.length ? affinities.reduce((s, v) => s + v, 0) / affinities.length : 0;

    const topModels = models
      .map(m => ({ id: m.id, affinityScore: this.affinities.get(m.id) ?? 0.5 }))
      .sort((a, b) => b.affinityScore - a.affinityScore)
      .slice(0, 5);

    return {
      totalModels: models.length,
      localModels: models.filter(m => m.isLocal).length,
      cloudModels: models.filter(m => !m.isLocal).length,
      avgAffinityScore: avgAffinity,
      topModels,
    };
  }

  getAffinity(modelId: string): number {
    return this.affinities.get(modelId) ?? 0.5;
  }

  getFeedback(modelId: string): JonFeedback[] {
    return this.feedback.filter(f => f.modelId === modelId);
  }

  modelCount(): number {
    return this.models.size;
  }
}
