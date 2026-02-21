// Model Router - Intelligent LLM model selection using UCB algorithm
// Routes tasks to optimal models based on performance history and constraints

import {
  MODEL_REGISTRY,
  getModelById,
  getModelsForTaskType,
  estimateRequestCost,
  estimateLatency,
  meetsQualityThreshold,
  meetsCostConstraint,
  meetsLatencyConstraint,
  type ModelConfig,
  type TaskType,
  type ModelProvider,
  type ModelCapability,
} from './model-registry.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface RoutingConstraints {
  maxCost?: number; // Maximum cost in USD
  maxLatency?: number; // Maximum latency in ms
  minQuality?: number; // Minimum quality score (0-1)
  preferLocal?: boolean; // Prefer local (Ollama) models
  preferredProviders?: ModelProvider[];
  excludedModels?: string[];
}

export interface RouteDecision {
  model: ModelConfig;
  reason: string;
  confidence: number;
  estimatedCost: number;
  estimatedLatency: number;
  alternatives: ModelConfig[];
}

export interface TaskResult {
  success: boolean;
  quality: number; // 0-1 quality score
  latency: number; // Actual latency in ms
  cost: number; // Actual cost in USD
  tokens: {
    input: number;
    output: number;
  };
  error?: string;
}

export interface ModelStats {
  modelId: string;
  totalCalls: number;
  totalReward: number; // Sum of rewards (quality / cost normalized)
  avgLatency: number;
  avgCost: number;
  successRate: number;
  successCount: number;
  failureCount: number;
  lastUsed: number;
}

export interface TaskTypeStats {
  taskType: TaskType;
  modelStats: Map<string, ModelStats>;
  totalCalls: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UCB (Upper Confidence Bound) Algorithm Implementation
// ═══════════════════════════════════════════════════════════════════════════════

const UCB_EXPLORATION_CONSTANT = Math.sqrt(2);

function calculateUCBScore(stats: ModelStats, totalTaskCalls: number): number {
  if (stats.totalCalls === 0) {
    // Unexplored models get high score to encourage exploration
    return Infinity;
  }

  const avgReward = stats.totalReward / stats.totalCalls;
  const explorationTerm = UCB_EXPLORATION_CONSTANT * 
    Math.sqrt(Math.log(totalTaskCalls) / stats.totalCalls);

  return avgReward + explorationTerm;
}

function calculateReward(result: TaskResult): number {
  if (!result.success) {
    return 0;
  }

  // Normalize quality (0-1)
  const qualityComponent = result.quality;

  // Normalize cost (lower is better, cap at $0.01)
  const maxAcceptableCost = 0.01;
  const costComponent = Math.max(0, 1 - (result.cost / maxAcceptableCost));

  // Normalize latency (lower is better, cap at 10 seconds)
  const maxAcceptableLatency = 10000;
  const latencyComponent = Math.max(0, 1 - (result.latency / maxAcceptableLatency));

  // Weighted combination
  return (qualityComponent * 0.5) + (costComponent * 0.3) + (latencyComponent * 0.2);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ModelRouter Class
// ═══════════════════════════════════════════════════════════════════════════════

export class ModelRouter {
  private taskTypeStats: Map<TaskType, TaskTypeStats>;
  private modelStats: Map<string, ModelStats>;
  private explorationRate: number;

  constructor(explorationRate: number = 0.1) {
    this.taskTypeStats = new Map();
    this.modelStats = new Map();
    this.explorationRate = explorationRate;
    this.initializeStats();
  }

  /**
   * Initialize stats for all models
   */
  private initializeStats(): void {
    for (const model of MODEL_REGISTRY) {
      this.modelStats.set(model.id, {
        modelId: model.id,
        totalCalls: 0,
        totalReward: 0,
        avgLatency: model.latencyP50,
        avgCost: model.costPerInputToken * 1000 + model.costPerOutputToken * 1000,
        successRate: 1,
        successCount: 0,
        failureCount: 0,
        lastUsed: 0,
      });
    }
  }

  /**
   * Get or create task type stats
   */
  private getTaskTypeStats(taskType: TaskType): TaskTypeStats {
    let stats = this.taskTypeStats.get(taskType);
    if (!stats) {
      stats = {
        taskType,
        modelStats: new Map(),
        totalCalls: 0,
      };
      this.taskTypeStats.set(taskType, stats);
    }
    return stats;
  }

  /**
   * Get model stats for a task type
   */
  private getModelStatsForTaskType(modelId: string, taskType: TaskType): ModelStats {
    const taskStats = this.getTaskTypeStats(taskType);
    let stats = taskStats.modelStats.get(modelId);
    if (!stats) {
      const globalStats = this.modelStats.get(modelId);
      stats = { ...globalStats! };
      taskStats.modelStats.set(modelId, stats);
    }
    return stats;
  }

  /**
   * Route a task to the optimal model
   */
  route(
    agentId: string,
    taskType: TaskType,
    constraints: RoutingConstraints = {},
    estimatedTokens: { input: number; output: number } = { input: 1000, output: 500 }
  ): RouteDecision {
    // Get candidate models for this task type
    let candidates = getModelsForTaskType(taskType);

    // Apply constraints
    candidates = this.applyConstraints(candidates, constraints, estimatedTokens);

    if (candidates.length === 0) {
      throw new Error(`No models available for task type "${taskType}" with given constraints`);
    }

    // Get task type stats for UCB calculation
    const taskStats = this.getTaskTypeStats(taskType);

    // Calculate UCB scores for all candidates
    const scoredCandidates = candidates.map(model => {
      const modelStats = this.getModelStatsForTaskType(model.id, taskType);
      const ucbScore = calculateUCBScore(modelStats, taskStats.totalCalls);
      return { model, stats: modelStats, ucbScore };
    });

    // Sort by UCB score descending
    scoredCandidates.sort((a, b) => b.ucbScore - a.ucbScore);

    // With probability explorationRate, pick second best (if available)
    let selected = scoredCandidates[0];
    if (scoredCandidates.length > 1 && Math.random() < this.explorationRate) {
      selected = scoredCandidates[1];
    }

    // Calculate estimates
    const estimatedCost = estimateRequestCost(selected.model, estimatedTokens.input, estimatedTokens.output);
    const estimatedLatency = estimateLatency(selected.model, estimatedTokens.output);

    // Build reason string
    const reason = this.buildReason(selected, scoredCandidates, constraints);

    return {
      model: selected.model,
      reason,
      confidence: Math.min(selected.stats.successRate, 0.99),
      estimatedCost,
      estimatedLatency,
      alternatives: scoredCandidates.slice(1).map(s => s.model),
    };
  }

  /**
   * Update statistics after task completion
   */
  updateStats(modelId: string, taskType: TaskType, result: TaskResult): void {
    // Update global model stats
    const globalStats = this.modelStats.get(modelId);
    if (globalStats) {
      this.updateModelStats(globalStats, result);
    }

    // Update task type specific stats
    const taskStats = this.getTaskTypeStats(taskType);
    const modelStats = this.getModelStatsForTaskType(modelId, taskType);
    this.updateModelStats(modelStats, result);
    taskStats.totalCalls++;

    // Also update the entry in the task stats map
    taskStats.modelStats.set(modelId, modelStats);
  }

  /**
   * Get model ranking for a task type
   */
  getModelRanking(taskType: TaskType): Array<{ model: ModelConfig; ucbScore: number; stats: ModelStats }> {
    const taskStats = this.getTaskTypeStats(taskType);
    const candidates = getModelsForTaskType(taskType);

    const ranked = candidates.map(model => {
      const stats = this.getModelStatsForTaskType(model.id, taskType);
      const ucbScore = calculateUCBScore(stats, taskStats.totalCalls);
      return { model, ucbScore, stats };
    });

    ranked.sort((a, b) => b.ucbScore - a.ucbScore);
    return ranked;
  }

  /**
   * Get stats for a specific model
   */
  getModelStats(modelId: string): ModelStats | undefined {
    return this.modelStats.get(modelId);
  }

  /**
   * Get all stats
   */
  getAllStats(): { global: Map<string, ModelStats>; byTaskType: Map<TaskType, TaskTypeStats> } {
    return {
      global: new Map(this.modelStats),
      byTaskType: new Map(this.taskTypeStats),
    };
  }

  /**
   * Reset stats for a model or all models
   */
  resetStats(modelId?: string): void {
    if (modelId) {
      const model = getModelById(modelId);
      if (model) {
        this.modelStats.set(modelId, {
          modelId,
          totalCalls: 0,
          totalReward: 0,
          avgLatency: model.latencyP50,
          avgCost: model.costPerInputToken * 1000 + model.costPerOutputToken * 1000,
          successRate: 1,
          successCount: 0,
          failureCount: 0,
          lastUsed: 0,
        });
      }
    } else {
      this.modelStats.clear();
      this.taskTypeStats.clear();
      this.initializeStats();
    }
  }

  /**
   * Set exploration rate
   */
  setExplorationRate(rate: number): void {
    this.explorationRate = Math.max(0, Math.min(1, rate));
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════════

  private applyConstraints(
    models: ModelConfig[],
    constraints: RoutingConstraints,
    estimatedTokens: { input: number; output: number }
  ): ModelConfig[] {
    return models.filter(model => {
      // Exclude specific models
      if (constraints.excludedModels?.includes(model.id)) {
        return false;
      }

      // Check preferred providers
      if (constraints.preferredProviders && 
          !constraints.preferredProviders.includes(model.provider)) {
        return false;
      }

      // Check quality threshold
      if (constraints.minQuality !== undefined && 
          !meetsQualityThreshold(model, constraints.minQuality)) {
        return false;
      }

      // Check cost constraint
      if (constraints.maxCost !== undefined && 
          !meetsCostConstraint(model, constraints.maxCost, estimatedTokens.input, estimatedTokens.output)) {
        return false;
      }

      // Check latency constraint
      if (constraints.maxLatency !== undefined && 
          !meetsLatencyConstraint(model, constraints.maxLatency, estimatedTokens.output)) {
        return false;
      }

      return true;
    });
  }

  private updateModelStats(stats: ModelStats, result: TaskResult): void {
    stats.totalCalls++;
    stats.lastUsed = Date.now();

    if (result.success) {
      stats.successCount++;
    } else {
      stats.failureCount++;
    }

    stats.successRate = stats.successCount / stats.totalCalls;

    // Update reward
    const reward = calculateReward(result);
    stats.totalReward += reward;

    // Update averages
    stats.avgLatency = (stats.avgLatency * (stats.totalCalls - 1) + result.latency) / stats.totalCalls;
    stats.avgCost = (stats.avgCost * (stats.totalCalls - 1) + result.cost) / stats.totalCalls;
  }

  private buildReason(
    selected: { model: ModelConfig; stats: ModelStats; ucbScore: number },
    allCandidates: Array<{ model: ModelConfig; stats: ModelStats; ucbScore: number }>,
    constraints: RoutingConstraints
  ): string {
    const parts: string[] = [];

    parts.push(`Selected ${selected.model.name} (UCB score: ${selected.ucbScore.toFixed(3)})`);

    if (selected.stats.totalCalls === 0) {
      parts.push('Model has not been used before (exploration)');
    } else {
      parts.push(`Success rate: ${(selected.stats.successRate * 100).toFixed(1)}%`);
      parts.push(`Avg latency: ${selected.stats.avgLatency.toFixed(0)}ms`);
    }

    if (constraints.preferLocal && selected.model.provider === 'ollama') {
      parts.push('Preferred local model');
    }

    if (allCandidates.length > 1) {
      const nextBest = allCandidates[1];
      parts.push(`Next best: ${nextBest.model.name} (UCB: ${nextBest.ucbScore.toFixed(3)})`);
    }

    return parts.join('; ');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Legacy Exports (for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

export type ModelTier = 'free' | 'paid' | 'hybrid';

export { 
  MODEL_REGISTRY as AVAILABLE_MODELS,
  getModelById as selectModel,
  type ModelConfig as LegacyModelConfig,
};

// Legacy compatibility functions
export function selectTier(tier: ModelTier): void {
  console.log(`[ModelRouter] Tier selection "${tier}" - using new router instead`);
}

export function getCurrentTier(): ModelTier {
  return 'hybrid';
}

export function getCurrentModel(): ModelConfig {
  return MODEL_REGISTRY[0];
}

export function selectModelForTask(_taskDescription: string, complexity: 'simple' | 'medium' | 'complex'): ModelConfig {
  const router = new ModelRouter();
  const taskType: TaskType = complexity === 'simple' ? 'quick-query' : 
                              complexity === 'medium' ? 'code-generation' : 'architecture-design';
  return router.route('LEGACY', taskType).model;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════════════════════

let globalRouter: ModelRouter | null = null;

export function getModelRouter(): ModelRouter {
  if (!globalRouter) {
    globalRouter = new ModelRouter();
  }
  return globalRouter;
}

export function resetModelRouter(): void {
  globalRouter = null;
}
