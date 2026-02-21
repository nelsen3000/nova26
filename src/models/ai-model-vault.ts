/**
 * Nova26 AI Model Database
 * KIMI-R24-01 - AI Model Vault
 *
 * Central vault for managing AI models with:
 * - Semantic model selection based on task and taste
 * - Feedback-driven affinity updates
 * - Multi-model ensemble debates
 * - Provider metadata synchronization
 */

import {
  ModelMetadata,
  ModelCapabilities,
  ModelRoute,
  JonFeedback,
  EnsembleDebateResult,
  /* SyncResult */
  ModelAffinity,
  RoutingMetrics,
} from './types.js';
import { ModelRouter } from './model-router.js';
import { EnsembleEngine } from './ensemble-engine.js';

// ============================================================================
// Default Models (Cold Start Data)
// ============================================================================

const DEFAULT_MODELS: ModelMetadata[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    family: 'gpt-4',
    version: '2024-08-06',
    capabilities: {
      code: 92,
      reasoning: 94,
      multimodal: 95,
      speed: 85,
      cost: 60,
      localAvailable: false,
      quantizations: [],
    },
    contextWindow: 128000,
    pricing: {
      inputPerMToken: 2.5,
      outputPerMToken: 10.0,
    },
    benchmarks: {
      'mmlu': 88.7,
      'human-eval': 90.2,
      'math': 76.6,
    },
    lastUpdated: '2024-08-06',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    family: 'gpt-4',
    version: '2024-07-18',
    capabilities: {
      code: 82,
      reasoning: 80,
      multimodal: 75,
      speed: 95,
      cost: 95,
      localAvailable: false,
      quantizations: [],
    },
    contextWindow: 128000,
    pricing: {
      inputPerMToken: 0.15,
      outputPerMToken: 0.6,
    },
    benchmarks: {
      'mmlu': 82.0,
      'human-eval': 86.6,
      'math': 70.2,
    },
    lastUpdated: '2024-07-18',
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    family: 'claude-3',
    version: '20241022',
    capabilities: {
      code: 94,
      reasoning: 93,
      multimodal: 88,
      speed: 88,
      cost: 70,
      localAvailable: false,
      quantizations: [],
    },
    contextWindow: 200000,
    pricing: {
      inputPerMToken: 3.0,
      outputPerMToken: 15.0,
    },
    benchmarks: {
      'mmlu': 88.5,
      'human-eval': 92.0,
      'math': 78.3,
    },
    lastUpdated: '2024-10-22',
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    family: 'claude-3',
    version: '20240229',
    capabilities: {
      code: 90,
      reasoning: 95,
      multimodal: 85,
      speed: 70,
      cost: 45,
      localAvailable: false,
      quantizations: [],
    },
    contextWindow: 200000,
    pricing: {
      inputPerMToken: 15.0,
      outputPerMToken: 75.0,
    },
    benchmarks: {
      'mmlu': 86.8,
      'human-eval': 84.9,
      'math': 95.2,
    },
    lastUpdated: '2024-02-29',
  },
  {
    id: 'llama-3.1-70b',
    name: 'Llama 3.1 70B',
    provider: 'meta',
    family: 'llama',
    version: '3.1',
    capabilities: {
      code: 85,
      reasoning: 84,
      multimodal: 60,
      speed: 80,
      cost: 90,
      localAvailable: true,
      quantizations: ['Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0'],
    },
    contextWindow: 128000,
    pricing: {
      inputPerMToken: 0.9,
      outputPerMToken: 0.9,
    },
    benchmarks: {
      'mmlu': 85.2,
      'human-eval': 80.5,
      'math': 68.4,
    },
    lastUpdated: '2024-07-23',
  },
  {
    id: 'llama-3.1-8b',
    name: 'Llama 3.1 8B',
    provider: 'meta',
    family: 'llama',
    version: '3.1',
    capabilities: {
      code: 75,
      reasoning: 72,
      multimodal: 50,
      speed: 98,
      cost: 98,
      localAvailable: true,
      quantizations: ['Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0', 'FP16'],
    },
    contextWindow: 128000,
    pricing: {
      inputPerMToken: 0.2,
      outputPerMToken: 0.2,
    },
    benchmarks: {
      'mmlu': 73.0,
      'human-eval': 72.8,
      'math': 52.9,
    },
    lastUpdated: '2024-07-23',
  },
  {
    id: 'codellama-34b',
    name: 'CodeLlama 34B',
    provider: 'meta',
    family: 'codellama',
    version: '1.0',
    capabilities: {
      code: 88,
      reasoning: 75,
      multimodal: 40,
      speed: 75,
      cost: 85,
      localAvailable: true,
      quantizations: ['Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0'],
    },
    contextWindow: 16384,
    pricing: {
      inputPerMToken: 0.5,
      outputPerMToken: 0.5,
    },
    benchmarks: {
      'mmlu': 65.0,
      'human-eval': 76.8,
      'math': 40.2,
    },
    lastUpdated: '2024-01-15',
  },
  {
    id: 'mistral-large',
    name: 'Mistral Large 2',
    provider: 'mistral',
    family: 'mistral',
    version: '2.0',
    capabilities: {
      code: 87,
      reasoning: 86,
      multimodal: 65,
      speed: 82,
      cost: 75,
      localAvailable: false,
      quantizations: [],
    },
    contextWindow: 128000,
    pricing: {
      inputPerMToken: 2.0,
      outputPerMToken: 6.0,
    },
    benchmarks: {
      'mmlu': 84.0,
      'human-eval': 84.5,
      'math': 71.6,
    },
    lastUpdated: '2024-07-24',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    family: 'gemini',
    version: '1.5',
    capabilities: {
      code: 88,
      reasoning: 89,
      multimodal: 92,
      speed: 87,
      cost: 72,
      localAvailable: false,
      quantizations: [],
    },
    contextWindow: 2000000,
    pricing: {
      inputPerMToken: 3.5,
      outputPerMToken: 10.5,
    },
    benchmarks: {
      'mmlu': 85.9,
      'human-eval': 84.1,
      'math': 86.5,
    },
    lastUpdated: '2024-05-15',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    family: 'gemini',
    version: '1.5',
    capabilities: {
      code: 80,
      reasoning: 82,
      multimodal: 85,
      speed: 95,
      cost: 90,
      localAvailable: false,
      quantizations: [],
    },
    contextWindow: 1000000,
    pricing: {
      inputPerMToken: 0.35,
      outputPerMToken: 1.05,
    },
    benchmarks: {
      'mmlu': 78.9,
      'human-eval': 78.3,
      'math': 77.0,
    },
    lastUpdated: '2024-05-15',
  },
];

// ============================================================================
// AI Model Vault Class
// ============================================================================

export class AIModelVault {
  private models: Map<string, ModelMetadata> = new Map();
  private affinities: Map<string, ModelAffinity> = new Map();
  private router: ModelRouter;
  private ensemble: EnsembleEngine;
  private routeHistory: ModelRoute[] = [];
  private metrics: RoutingMetrics = {
    totalRoutes: 0,
    avgLatencyMs: 0,
    p50LatencyMs: 0,
    p99LatencyMs: 0,
    cacheHitRate: 0,
    feedbackIncorporated: 0,
  };

  constructor() {
    this.router = new ModelRouter(this);
    this.ensemble = new EnsembleEngine(this);
    this.loadDefaultModels();
  }

  // --------------------------------------------------------------------------
  // Core API
  // --------------------------------------------------------------------------

  /**
   * Semantically select the best model for a given task.
   * Uses Taste Vault-aware model selection with performance optimizations
   * for cold start (< 180ms with 500 models) and hot-swap (P99 < 25ms).
   */
  async semanticSelect(
    agentId: string,
    taskDescription: string
  ): Promise<ModelRoute> {
    const startTime = performance.now();

    // Use the router for taste-aware semantic routing
    const route = await this.router.route(agentId, taskDescription);

    // Track metrics
    const latency = performance.now() - startTime;
    this.updateMetrics(latency);
    this.routeHistory.push(route);

    // Trim history to prevent unbounded growth
    const MAX_HISTORY = 1000;
    if (this.routeHistory.length > MAX_HISTORY) {
      this.routeHistory = this.routeHistory.slice(-MAX_HISTORY);
    }

    return route;
  }

  /**
   * Update model affinity based on Jon's feedback.
   * Adjusts future model selection preferences.
   */
  async updateAffinity(feedback: JonFeedback): Promise<void> {
    const key = `${feedback.routeId}:${feedback.modelId}`;
    const existing = this.affinities.get(key);

    if (existing) {
      // Update existing affinity with weighted average
      const totalWeight = existing.feedbackCount + 1;
      const newScore =
        (existing.score * existing.feedbackCount + feedback.rating * 20) /
        totalWeight;

      this.affinities.set(key, {
        ...existing,
        score: Math.min(100, Math.max(0, newScore)),
        feedbackCount: totalWeight,
        lastFeedbackAt: feedback.timestamp,
      });
    } else {
      // Create new affinity entry
      this.affinities.set(key, {
        modelId: feedback.modelId,
        agentId: feedback.routeId.split(':')[0] ?? 'unknown',
        taskType: 'general',
        score: feedback.rating * 20,
        feedbackCount: 1,
        lastFeedbackAt: feedback.timestamp,
      });
    }

    this.metrics.feedbackIncorporated++;

    // Propagate feedback to router for taste profile updates
    await this.router.incorporateFeedback(feedback);
  }

  /**
   * Run a multi-model ensemble debate.
   * Multiple models compete, and the best response wins.
   */
  async ensembleDebate(
    models: string[],
    prompt: string
  ): Promise<{ winner: string; reasoning: string }> {
    const result: EnsembleDebateResult = await this.ensemble.debate(
      models,
      prompt
    );

    return {
      winner: result.winner,
      reasoning: result.reasoning,
    };
  }

  /**
   * Synchronize model metadata from a provider.
   * Fetches latest metadata (mocked for now - would call provider APIs).
   */
  async syncFromProvider(provider: string): Promise<{ added: number; updated: number }> {
    // Mock provider sync - in production, would fetch from provider API
    const mockProviderModels = this.getMockProviderModels(provider);
    let added = 0;
    let updated = 0;

    for (const model of mockProviderModels) {
      const existing = this.models.get(model.id);

      if (existing) {
        // Check if model has been updated
        if (existing.lastUpdated !== model.lastUpdated) {
          this.models.set(model.id, {
            ...model,
            // Preserve local availability info if not provided by API
            capabilities: {
              ...model.capabilities,
              localAvailable:
                model.capabilities.localAvailable ??
                existing.capabilities.localAvailable,
            },
          });
          updated++;
        }
      } else {
        this.models.set(model.id, model);
        added++;
      }
    }

    return { added, updated };
  }

  /**
   * List all models matching the given filter criteria.
   */
  listModels(filter?: Partial<ModelCapabilities>): ModelMetadata[] {
    let results = Array.from(this.models.values());

    if (filter) {
      results = results.filter((model) => {
        const caps = model.capabilities;

        if (filter.code !== undefined && caps.code < filter.code) {
          return false;
        }
        if (filter.reasoning !== undefined && caps.reasoning < filter.reasoning) {
          return false;
        }
        if (filter.multimodal !== undefined && caps.multimodal < filter.multimodal) {
          return false;
        }
        if (filter.speed !== undefined && caps.speed < filter.speed) {
          return false;
        }
        if (filter.cost !== undefined && caps.cost < filter.cost) {
          return false;
        }
        if (
          filter.localAvailable !== undefined &&
          caps.localAvailable !== filter.localAvailable
        ) {
          return false;
        }

        return true;
      });
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // Model Management
  // --------------------------------------------------------------------------

  /**
   * Get a specific model by ID.
   */
  getModel(id: string): ModelMetadata | undefined {
    return this.models.get(id);
  }

  /**
   * Add or update a model in the vault.
   */
  upsertModel(model: ModelMetadata): void {
    this.models.set(model.id, {
      ...model,
      lastUpdated: new Date().toISOString().split('T')[0],
    });
  }

  /**
   * Remove a model from the vault.
   */
  removeModel(id: string): boolean {
    return this.models.delete(id);
  }

  /**
   * Get the affinity score for a model-route combination.
   */
  getAffinity(
    modelId: string,
    agentId: string,
    taskType: string
  ): ModelAffinity | undefined {
    const routeId = `${agentId}:${taskType}`;
    const key = `${routeId}:${modelId}`;
    return this.affinities.get(key);
  }

  // --------------------------------------------------------------------------
  // Performance & Metrics
  // --------------------------------------------------------------------------

  /**
   * Get current routing metrics.
   */
  getMetrics(): RoutingMetrics {
    return { ...this.metrics };
  }

  /**
   * Get route history (limited to recent routes).
   */
  getRouteHistory(limit: number = 100): ModelRoute[] {
    return this.routeHistory.slice(-limit);
  }

  /**
   * Clear all metrics and history.
   */
  clearMetrics(): void {
    this.metrics = {
      totalRoutes: 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p99LatencyMs: 0,
      cacheHitRate: 0,
      feedbackIncorporated: 0,
    };
    this.routeHistory = [];
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private loadDefaultModels(): void {
    for (const model of DEFAULT_MODELS) {
      this.models.set(model.id, model);
    }
  }

  private updateMetrics(latencyMs: number): void {
    const total = this.metrics.totalRoutes;
    const newAvg =
      (this.metrics.avgLatencyMs * total + latencyMs) / (total + 1);

    this.metrics.totalRoutes = total + 1;
    this.metrics.avgLatencyMs = Math.round(newAvg);

    // Update latency percentiles (simplified approximation)
    if (total === 0) {
      this.metrics.p50LatencyMs = latencyMs;
      this.metrics.p99LatencyMs = latencyMs;
    } else {
      // Exponential moving average for p50
      this.metrics.p50LatencyMs = Math.round(
        this.metrics.p50LatencyMs * 0.9 + latencyMs * 0.1
      );
      // Higher weight to recent values for p99 (tracks extremes)
      this.metrics.p99LatencyMs = Math.round(
        Math.max(this.metrics.p99LatencyMs * 0.95, latencyMs)
      );
    }
  }

  private getMockProviderModels(provider: string): ModelMetadata[] {
    // Mock data for provider sync - would be replaced with actual API calls
    const mockData: Record<string, ModelMetadata[]> = {
      openai: [
        {
          id: 'gpt-4o-latest',
          name: 'GPT-4o Latest',
          provider: 'openai',
          family: 'gpt-4',
          version: '2024-11-20',
          capabilities: {
            code: 93,
            reasoning: 95,
            multimodal: 96,
            speed: 87,
            cost: 58,
            localAvailable: false,
            quantizations: [],
          },
          contextWindow: 128000,
          pricing: {
            inputPerMToken: 2.5,
            outputPerMToken: 10.0,
          },
          benchmarks: {
            'mmlu': 89.5,
            'human-eval': 91.0,
            'math': 78.0,
          },
          lastUpdated: '2024-11-20',
        },
      ],
      anthropic: [],
      meta: [],
      mistral: [],
      google: [],
    };

    return mockData[provider] ?? [];
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let vaultInstance: AIModelVault | null = null;

export function getAIModelVault(): AIModelVault {
  if (!vaultInstance) {
    vaultInstance = new AIModelVault();
  }
  return vaultInstance;
}

export function resetAIModelVault(): void {
  vaultInstance = null;
}
