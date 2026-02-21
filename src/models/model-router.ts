/**
 * Nova26 AI Model Database
 * KIMI-R24-01 - Model Router
 *
 * Taste-aware semantic routing for model selection.
 * Optimized for cold start < 180ms with 500 models,
 * hot-swap P99 < 25ms.
 */

import {
  ModelMetadata,
  ModelRoute,
  JonFeedback,
  TasteProfile,
} from './types.js';
import { AIModelVault } from './ai-model-vault.js';

// ============================================================================
// Task Type Classification
// ============================================================================

const TASK_TYPE_KEYWORDS: Record<string, string[]> = {
  code: [
    'code',
    'function',
    'implement',
    'refactor',
    'bug',
    'fix',
    'test',
    'typescript',
    'javascript',
    'python',
    'api',
    'endpoint',
  ],
  reasoning: [
    'analyze',
    'explain',
    'compare',
    'evaluate',
    'why',
    'how',
    'architecture',
    'design',
    'strategy',
    'optimize',
  ],
  multimodal: [
    'image',
    'diagram',
    'ui',
    'component',
    'visual',
    'layout',
    'design',
    'css',
    'styled',
  ],
  creative: [
    'generate',
    'create',
    'write',
    'draft',
    'content',
    'copy',
    'narrative',
    'story',
  ],
  data: [
    'data',
    'json',
    'csv',
    'parse',
    'transform',
    'query',
    'database',
    'sql',
    'schema',
  ],
  context: [
    'long',
    'large',
    'file',
    'document',
    'context',
    'summarize',
    'review',
    'audit',
  ],
};

// ============================================================================
// Default Capability Weights
// ============================================================================

// Default weights reserved for future taste-profile-aware routing
// const DEFAULT_WEIGHTS: ModelCapabilities = {
//   code: 1.0, reasoning: 1.0, multimodal: 0.8, speed: 1.2, cost: 0.9,
//   localAvailable: true, quantizations: [],
// };

// ============================================================================
// Routing Cache
// ============================================================================

interface CacheEntry {
  route: ModelRoute;
  timestamp: number;
  hitCount: number;
}

// ============================================================================
// Model Router Class
// ============================================================================

export class ModelRouter {
  private vault: AIModelVault;
  private cache: Map<string, CacheEntry> = new Map();
  private tasteProfile: TasteProfile;
  private affinityScores: Map<string, number> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 500;

  constructor(vault: AIModelVault) {
    this.vault = vault;
    this.tasteProfile = this.createDefaultTasteProfile();
  }

  // --------------------------------------------------------------------------
  // Core Routing
  // --------------------------------------------------------------------------

  /**
   * Route a task to the most appropriate model.
   * Cold start: < 180ms with 500 models
   * Hot swap: P99 < 25ms via caching
   */
  async route(
    agentId: string,
    taskDescription: string
  ): Promise<ModelRoute> {
    const cacheKey = this.generateCacheKey(agentId, taskDescription);

    // Check cache first (hot path)
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      cached.hitCount++;
      return cached.route;
    }

    // Cold path: compute route
    const taskType = this.classifyTaskType(taskDescription);
    const candidates = this.getCandidateModels(taskDescription);
    const scored = this.scoreModels(candidates, agentId, taskType, taskDescription);

    // Select top model and alternatives
    const [selected, ...alternatives] = scored.slice(0, 4);

    const route: ModelRoute = {
      agentId,
      taskType,
      selectedModel: selected.model,
      confidence: selected.score / 100,
      reasoning: this.generateReasoning(selected, taskType),
      alternatives: alternatives.map((s) => s.model),
    };

    // Cache the result
    this.cacheRoute(cacheKey, route);

    return route;
  }

  /**
   * Incorporate user feedback into routing decisions.
   */
  async incorporateFeedback(feedback: JonFeedback): Promise<void> {
    const key = `${feedback.routeId}:${feedback.modelId}`;
    const normalizedScore = feedback.rating * 20; // 1-5 -> 20-100

    // Update affinity score
    const existing = this.affinityScores.get(key);
    if (existing !== undefined) {
      // Exponential moving average
      this.affinityScores.set(key, existing * 0.7 + normalizedScore * 0.3);
    } else {
      this.affinityScores.set(key, normalizedScore);
    }

    // Invalidate cache entries that might be affected
    this.invalidateCacheForAgent(feedback.routeId.split(':')[0] ?? 'unknown');
  }

  /**
   * Update taste profile with new preferences.
   */
  updateTasteProfile(profile: Partial<TasteProfile>): void {
    this.tasteProfile = {
      ...this.tasteProfile,
      ...profile,
      capabilityWeights: {
        ...this.tasteProfile.capabilityWeights,
        ...profile.capabilityWeights,
      },
      taskPreferences: {
        ...this.tasteProfile.taskPreferences,
        ...profile.taskPreferences,
      },
    };

    // Clear cache since preferences changed
    this.cache.clear();
  }

  /**
   * Get current taste profile.
   */
  getTasteProfile(): TasteProfile {
    return { ...this.tasteProfile };
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private classifyTaskType(description: string): string {
    const lowerDesc = description.toLowerCase();
    const scores: Record<string, number> = {};

    for (const [type, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
      scores[type] = keywords.filter((kw) => lowerDesc.includes(kw)).length;
    }

    // Find highest scoring type
    let bestType = 'general';
    let bestScore = 0;

    for (const [type, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }

    return bestType;
  }

  private getCandidateModels(_taskDescription: string): ModelMetadata[] { // eslint-disable-line -- future use
    const allModels = this.vault.listModels();

    // Filter by local availability preference
    if (this.tasteProfile.preferredProviders.includes('local')) {
      const localModels = allModels.filter((m) => m.capabilities.localAvailable);
      if (localModels.length > 0) {
        return localModels;
      }
    }

    // Filter by preferred providers
    if (this.tasteProfile.preferredProviders.length > 0) {
      const preferred = allModels.filter((m) =>
        this.tasteProfile.preferredProviders.includes(m.provider)
      );
      if (preferred.length > 0) {
        return preferred;
      }
    }

    // Filter by preferred families
    if (this.tasteProfile.preferredFamilies.length > 0) {
      const preferred = allModels.filter((m) =>
        this.tasteProfile.preferredFamilies.includes(m.family)
      );
      if (preferred.length > 0) {
        return preferred;
      }
    }

    return allModels;
  }

  private scoreModels(
    candidates: ModelMetadata[],
    agentId: string,
    taskType: string,
    description: string
  ): Array<{ model: ModelMetadata; score: number }> {
    const weights = this.tasteProfile.capabilityWeights;
    const scored: Array<{ model: ModelMetadata; score: number }> = [];

    for (const model of candidates) {
      let score = 0;
      const caps = model.capabilities;

      // Base capability scores weighted by task type
      switch (taskType) {
        case 'code':
          score += caps.code * weights.code * 1.5;
          score += caps.reasoning * weights.reasoning * 0.8;
          break;
        case 'reasoning':
          score += caps.reasoning * weights.reasoning * 1.5;
          score += caps.code * weights.code * 0.6;
          break;
        case 'multimodal':
          score += caps.multimodal * weights.multimodal * 1.5;
          break;
        case 'creative':
          score += caps.reasoning * weights.reasoning;
          score += caps.multimodal * weights.multimodal * 0.8;
          break;
        case 'data':
          score += caps.code * weights.code;
          score += caps.reasoning * weights.reasoning * 0.8;
          break;
        case 'context':
          // Prioritize large context windows
          score += Math.min(model.contextWindow / 50000, 2) * 20;
          score += caps.code * weights.code * 0.5;
          break;
        default:
          score += caps.code * weights.code;
          score += caps.reasoning * weights.reasoning;
          score += caps.multimodal * weights.multimodal * 0.5;
      }

      // Speed and cost factors
      score += caps.speed * weights.speed * 0.3;
      score += caps.cost * weights.cost * 0.2;

      // Affinity boost
      const affinity = this.getAffinityScore(model.id, agentId, taskType);
      score += affinity * 0.3;

      // Task-specific preferences
      const preferredModels = this.tasteProfile.taskPreferences[taskType];
      if (preferredModels?.includes(model.id)) {
        score += 15;
      }

      // Context window fit
      const estimatedTokens = this.estimateTokens(description);
      if (estimatedTokens > model.contextWindow * 0.8) {
        score -= 30; // Penalize models that might not fit context
      }

      scored.push({ model, score: Math.min(100, Math.max(0, score)) });
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored;
  }

  private getAffinityScore(
    modelId: string,
    agentId: string,
    taskType: string
  ): number {
    const key = `${agentId}:${taskType}:${modelId}`;
    return this.affinityScores.get(key) ?? 50; // Default neutral affinity
  }

  private generateReasoning(
    selected: { model: ModelMetadata; score: number },
    taskType: string
  ): string {
    const model = selected.model;
    const caps = model.capabilities;

    const reasons: string[] = [];

    reasons.push(`Selected ${model.name} (${model.family} family)`);

    switch (taskType) {
      case 'code':
        reasons.push(`code capability: ${caps.code}/100`);
        break;
      case 'reasoning':
        reasons.push(`reasoning capability: ${caps.reasoning}/100`);
        break;
      case 'multimodal':
        reasons.push(`multimodal capability: ${caps.multimodal}/100`);
        break;
      case 'context':
        reasons.push(`context window: ${model.contextWindow.toLocaleString()} tokens`);
        break;
    }

    if (caps.localAvailable) {
      reasons.push('local inference available');
    }

    reasons.push(`cost efficiency: ${caps.cost}/100`);

    return reasons.join('; ');
  }

  private cacheRoute(cacheKey: string, route: ModelRoute): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      let oldestKey: string | null = null;
      let oldestTime = Date.now();

      const cacheEntries = Array.from(this.cache.entries());
    for (const [key, entry] of cacheEntries) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(cacheKey, {
      route,
      timestamp: Date.now(),
      hitCount: 0,
    });
  }

  private invalidateCacheForAgent(agentId: string): void {
    const cacheEntries = Array.from(this.cache.entries());
    for (const [key, entry] of cacheEntries) {
      if (entry.route.agentId === agentId) {
        this.cache.delete(key);
      }
    }
  }

  private generateCacheKey(agentId: string, description: string): string {
    // Simple hash for cache key
    const normalized = `${agentId}:${description.toLowerCase().trim()}`;
    return this.hashString(normalized);
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `${hash}`;
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private createDefaultTasteProfile(): TasteProfile {
    return {
      userId: 'jon',
      preferredProviders: [],
      preferredFamilies: [],
      capabilityWeights: {
        code: 1.0,
        reasoning: 1.0,
        multimodal: 1.0,
        speed: 1.0,
        cost: 1.0,
      },
      taskPreferences: {},
    };
  }
}
