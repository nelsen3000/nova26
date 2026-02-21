// Speculative Decoding - Fast draft generation with strong model verification
// Uses a cheap/fast model to generate draft tokens, then verifies with strong model

import type { ModelConfig } from './model-registry.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface SpecOptions {
  maxDraftTokens?: number; // Maximum tokens to generate with draft model (default: 64)
  acceptanceThreshold?: number; // Minimum acceptance rate to continue speculative decoding (default: 0.3)
  parallelDrafts?: number; // Number of parallel draft sequences (default: 1)
  enableFallback?: boolean; // Whether to fall back to direct generation (default: true)
}

export interface SpeculativeResult {
  output: string;
  draftAcceptRate: number;
  totalLatency: number;
  costSaved: number;
  strategy: 'speculative' | 'direct';
  tokensGenerated: {
    draft: number;
    verified: number;
  };
}

export interface ModelPairStats {
  draftModelId: string;
  verifyModelId: string;
  totalAttempts: number;
  totalAcceptanceRate: number;
  avgAcceptanceRate: number;
  disabled: boolean;
  lastUsed: number;
}

export interface DecodingDecision {
  useSpeculative: boolean;
  draftModel?: ModelConfig;
  verifyModel: ModelConfig;
  reason: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mock LLM Caller Type
// ═══════════════════════════════════════════════════════════════════════════════

type LLMCaller = (model: ModelConfig, prompt: string, maxTokens: number) => Promise<{
  text: string;
  tokens: number;
  latency: number;
}>;

// ═══════════════════════════════════════════════════════════════════════════════
// SpeculativeDecoder Class
// ═══════════════════════════════════════════════════════════════════════════════

export class SpeculativeDecoder {
  private llmCaller: LLMCaller;
  private pairStats: Map<string, ModelPairStats>;
  private defaultOptions: Required<SpecOptions>;

  constructor(
    llmCaller: LLMCaller,
    options: SpecOptions = {}
  ) {
    this.llmCaller = llmCaller;
    this.pairStats = new Map();
    this.defaultOptions = {
      maxDraftTokens: options.maxDraftTokens ?? 64,
      acceptanceThreshold: options.acceptanceThreshold ?? 0.3,
      parallelDrafts: options.parallelDrafts ?? 1,
      enableFallback: options.enableFallback ?? true,
    };
  }

  /**
   * Perform speculative decoding
   * 1. Generate draft tokens with fast/cheap model
   * 2. Verify with strong model
   * 3. Return accepted prefix + model's continuation
   */
  async speculativeDecode(
    prompt: string,
    draftModel: ModelConfig,
    verifyModel: ModelConfig,
    options: SpecOptions = {}
  ): Promise<SpeculativeResult> {
    const opts = { ...this.defaultOptions, ...options };
    const pairKey = this.getPairKey(draftModel.id, verifyModel.id);
    const pairStats = this.getPairStats(draftModel.id, verifyModel.id);

    const startTime = Date.now();

    // Check if this pair is disabled due to low acceptance
    if (pairStats.disabled && opts.enableFallback) {
      const directResult = await this.directGenerate(prompt, verifyModel);
      return {
        output: directResult.text,
        draftAcceptRate: 0,
        totalLatency: directResult.latency,
        costSaved: 0,
        strategy: 'direct',
        tokensGenerated: { draft: 0, verified: directResult.tokens },
      };
    }

    try {
      // Step 1: Generate draft with fast model
      const draftResult = await this.llmCaller(
        draftModel,
        prompt,
        opts.maxDraftTokens
      );

      // Step 2: Verify draft with strong model
      // In real implementation, this would verify token-by-token
      // Here we simulate the verification process
      const verificationResult = await this.verifyDraft(
        prompt,
        draftResult.text,
        verifyModel
      );

      // Calculate acceptance rate
      const draftTokens = draftResult.tokens;
      const acceptedTokens = verificationResult.acceptedTokens;
      const acceptRate = draftTokens > 0 ? acceptedTokens / draftTokens : 0;

      // Update stats
      this.updatePairStats(draftModel.id, verifyModel.id, acceptRate);

      // Check if acceptance rate is too low
      if (acceptRate < opts.acceptanceThreshold && opts.enableFallback) {
        // Disable this pair for future calls
        if (pairStats.totalAttempts >= 5) {
          pairStats.disabled = true;
        }

        // Fall back to direct generation
        const directResult = await this.directGenerate(prompt, verifyModel);
        const totalLatency = Date.now() - startTime;

        return {
          output: directResult.text,
          draftAcceptRate: acceptRate,
          totalLatency,
          costSaved: 0,
          strategy: 'direct',
          tokensGenerated: { draft: draftTokens, verified: directResult.tokens },
        };
      }

      // Combine accepted draft with continuation
      const finalOutput = verificationResult.acceptedText + verificationResult.continuation;
      const totalLatency = Date.now() - startTime;

      // Calculate cost savings
      const costSaved = this.calculateCostSavings(
        draftModel,
        verifyModel,
        draftTokens,
        verificationResult.verifiedTokens
      );

      return {
        output: finalOutput,
        draftAcceptRate: acceptRate,
        totalLatency,
        costSaved,
        strategy: 'speculative',
        tokensGenerated: {
          draft: draftTokens,
          verified: verificationResult.verifiedTokens,
        },
      };
    } catch (error) {
      // On error, fall back to direct generation if enabled
      if (opts.enableFallback) {
        const directResult = await this.directGenerate(prompt, verifyModel);
        const totalLatency = Date.now() - startTime;

        return {
          output: directResult.text,
          draftAcceptRate: 0,
          totalLatency,
          costSaved: 0,
          strategy: 'direct',
          tokensGenerated: { draft: 0, verified: directResult.tokens },
        };
      }

      throw error;
    }
  }

  /**
   * Get acceptance rate for a model pair
   */
  getAcceptanceRate(draftModelId: string, verifyModelId: string): number {
    const stats = this.pairStats.get(this.getPairKey(draftModelId, verifyModelId));
    return stats?.avgAcceptanceRate ?? 0;
  }

  /**
   * Get stats for all model pairs
   */
  getAllPairStats(): ModelPairStats[] {
    return Array.from(this.pairStats.values());
  }

  /**
   * Check if a model pair is disabled
   */
  isPairDisabled(draftModelId: string, verifyModelId: string): boolean {
    const stats = this.pairStats.get(this.getPairKey(draftModelId, verifyModelId));
    return stats?.disabled ?? false;
  }

  /**
   * Reset stats for a model pair or all pairs
   */
  resetStats(draftModelId?: string, verifyModelId?: string): void {
    if (draftModelId && verifyModelId) {
      this.pairStats.delete(this.getPairKey(draftModelId, verifyModelId));
    } else {
      this.pairStats.clear();
    }
  }

  /**
   * Enable a previously disabled pair
   */
  enablePair(draftModelId: string, verifyModelId: string): void {
    const key = this.getPairKey(draftModelId, verifyModelId);
    const stats = this.pairStats.get(key);
    if (stats) {
      stats.disabled = false;
      stats.totalAttempts = 0;
      stats.totalAcceptanceRate = 0;
      stats.avgAcceptanceRate = 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════════

  private getPairKey(draftModelId: string, verifyModelId: string): string {
    return `${draftModelId}::${verifyModelId}`;
  }

  private getPairStats(draftModelId: string, verifyModelId: string): ModelPairStats {
    const key = this.getPairKey(draftModelId, verifyModelId);
    let stats = this.pairStats.get(key);
    if (!stats) {
      stats = {
        draftModelId,
        verifyModelId,
        totalAttempts: 0,
        totalAcceptanceRate: 0,
        avgAcceptanceRate: 0,
        disabled: false,
        lastUsed: 0,
      };
      this.pairStats.set(key, stats);
    }
    return stats;
  }

  private updatePairStats(
    draftModelId: string,
    verifyModelId: string,
    acceptRate: number
  ): void {
    const stats = this.getPairStats(draftModelId, verifyModelId);
    stats.totalAttempts++;
    stats.totalAcceptanceRate += acceptRate;
    stats.avgAcceptanceRate = stats.totalAcceptanceRate / stats.totalAttempts;
    stats.lastUsed = Date.now();
  }

  private async directGenerate(
    prompt: string,
    model: ModelConfig
  ): Promise<{ text: string; tokens: number; latency: number }> {
    return this.llmCaller(model, prompt, 1024);
  }

  private async verifyDraft(
    prompt: string,
    draftText: string,
    verifyModel: ModelConfig
  ): Promise<{
    acceptedText: string;
    continuation: string;
    acceptedTokens: number;
    verifiedTokens: number;
  }> {
    // In a real implementation, this would:
    // 1. Send prompt + draft tokens to verify model
    // 2. Compare verify model's output with draft
    // 3. Find longest common prefix (accepted tokens)
    // 4. Continue generation from accepted prefix

    // For simulation, we use a heuristic acceptance rate
    const simulatedAcceptRate = 0.6 + (Math.random() * 0.3); // 60-90% acceptance
    const draftTokens = Math.ceil(draftText.length / 4); // Rough estimate
    const acceptedTokens = Math.floor(draftTokens * simulatedAcceptRate);
    
    // Simulate accepted portion
    const words = draftText.split(' ');
    const acceptedWordCount = Math.floor(words.length * simulatedAcceptRate);
    const acceptedText = words.slice(0, acceptedWordCount).join(' ');

    // Generate continuation with verify model
    const continuationResult = await this.llmCaller(
      verifyModel,
      prompt + acceptedText,
      256
    );

    return {
      acceptedText,
      continuation: continuationResult.text,
      acceptedTokens,
      verifiedTokens: continuationResult.tokens,
    };
  }

  private calculateCostSavings(
    draftModel: ModelConfig,
    verifyModel: ModelConfig,
    draftTokens: number,
    verifiedTokens: number
  ): number {
    // Cost without speculative decoding (full generation with verify model)
    const fullCost = verifiedTokens * 2 * verifyModel.costPerOutputToken; // Estimate

    // Cost with speculative decoding
    const draftCost = draftTokens * draftModel.costPerOutputToken;
    const verifyCost = verifiedTokens * verifyModel.costPerOutputToken;
    const speculativeCost = draftCost + verifyCost;

    return Math.max(0, fullCost - speculativeCost);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SpeculativeDecodingManager Class
// ═══════════════════════════════════════════════════════════════════════════════

export interface ManagerConfig {
  defaultDraftModel?: ModelConfig;
  defaultVerifyModel?: ModelConfig;
  taskComplexityThreshold?: number; // 0-1, tasks below this use direct generation
  latencyBudgetThreshold?: number; // ms, tasks with tight budget use direct
  costBudgetThreshold?: number; // USD, tasks with tight budget use speculative
}

export class SpeculativeDecodingManager {
  private decoder: SpeculativeDecoder;
  private config: Required<ManagerConfig>;

  constructor(
    llmCaller: LLMCaller,
    config: ManagerConfig = {}
  ) {
    this.decoder = new SpeculativeDecoder(llmCaller);
    this.config = {
      defaultDraftModel: config.defaultDraftModel ?? this.getDefaultDraftModel(),
      defaultVerifyModel: config.defaultVerifyModel ?? this.getDefaultVerifyModel(),
      taskComplexityThreshold: config.taskComplexityThreshold ?? 0.3,
      latencyBudgetThreshold: config.latencyBudgetThreshold ?? 2000,
      costBudgetThreshold: config.costBudgetThreshold ?? 0.001,
    };
  }

  /**
   * Decide whether to use speculative decoding and execute
   */
  async generate(
    prompt: string,
    options: {
      taskComplexity?: number;
      latencyBudget?: number;
      costBudget?: number;
      draftModel?: ModelConfig;
      verifyModel?: ModelConfig;
      specOptions?: SpecOptions;
    } = {}
  ): Promise<SpeculativeResult> {
    const decision = this.decideStrategy(options);

    if (!decision.useSpeculative) {
      // Direct generation
      const startTime = Date.now();
      const result = await this.callLLM(decision.verifyModel, prompt, 1024);
      const totalLatency = Date.now() - startTime;

      return {
        output: result.text,
        draftAcceptRate: 0,
        totalLatency,
        costSaved: 0,
        strategy: 'direct',
        tokensGenerated: { draft: 0, verified: result.tokens },
      };
    }

    // Speculative decoding
    return this.decoder.speculativeDecode(
      prompt,
      decision.draftModel!,
      decision.verifyModel,
      options.specOptions
    );
  }

  /**
   * Decide whether to use speculative decoding
   */
  decideStrategy(options: {
    taskComplexity?: number;
    latencyBudget?: number;
    costBudget?: number;
    draftModel?: ModelConfig;
    verifyModel?: ModelConfig;
  }): DecodingDecision {
    const draftModel = options.draftModel ?? this.config.defaultDraftModel;
    const verifyModel = options.verifyModel ?? this.config.defaultVerifyModel;

    // Check if pair is disabled
    if (this.decoder.isPairDisabled(draftModel.id, verifyModel.id)) {
      return {
        useSpeculative: false,
        verifyModel,
        reason: 'Model pair disabled due to low acceptance rate',
      };
    }

    // Simple tasks -> direct with cheap model
    if (options.taskComplexity !== undefined && 
        options.taskComplexity < this.config.taskComplexityThreshold) {
      return {
        useSpeculative: false,
        verifyModel: draftModel, // Use cheap model directly
        reason: 'Simple task - using draft model directly',
      };
    }

    // Tight latency budget -> direct generation
    if (options.latencyBudget !== undefined && 
        options.latencyBudget < this.config.latencyBudgetThreshold) {
      return {
        useSpeculative: false,
        verifyModel,
        reason: 'Tight latency budget - using direct generation',
      };
    }

    // Tight cost budget -> speculative decoding
    if (options.costBudget !== undefined && 
        options.costBudget < this.config.costBudgetThreshold) {
      return {
        useSpeculative: true,
        draftModel,
        verifyModel,
        reason: 'Tight cost budget - using speculative decoding',
      };
    }

    // Default to speculative decoding for complex tasks
    return {
      useSpeculative: true,
      draftModel,
      verifyModel,
      reason: 'Complex task - using speculative decoding',
    };
  }

  /**
   * Get decoder instance for advanced usage
   */
  getDecoder(): SpeculativeDecoder {
    return this.decoder;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════════

  private async callLLM(
    model: ModelConfig,
    prompt: string,
    maxTokens: number
  ): Promise<{ text: string; tokens: number; latency: number }> {
    // This would call the actual LLM in production
    // For now, it's handled by the injected llmCaller
    return { text: '', tokens: 0, latency: 0 };
  }

  private getDefaultDraftModel(): ModelConfig {
    // Return a fast, cheap model as default draft
    return {
      id: 'anthropic-claude-3-haiku',
      name: 'claude-3-haiku',
      provider: 'anthropic',
      costPerInputToken: 0.00000025,
      costPerOutputToken: 0.00000125,
      maxTokens: 4096,
      contextWindow: 200000,
      capabilities: ['chat', 'summarization', 'quick-query', 'documentation'],
      latencyP50: 400,
      latencyP99: 1500,
      quality: 0.75,
    };
  }

  private getDefaultVerifyModel(): ModelConfig {
    // Return a strong model as default verify
    return {
      id: 'anthropic-claude-3-sonnet',
      name: 'claude-3-sonnet',
      provider: 'anthropic',
      costPerInputToken: 0.000003,
      costPerOutputToken: 0.000015,
      maxTokens: 4096,
      contextWindow: 200000,
      capabilities: ['chat', 'code-generation', 'code-analysis', 'architecture', 'reasoning', 'testing', 'tool-use'],
      latencyP50: 800,
      latencyP99: 3500,
      quality: 0.88,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Functions
// ═══════════════════════════════════════════════════════════════════════════════

let globalManager: SpeculativeDecodingManager | null = null;

export function initializeSpeculativeDecoder(
  llmCaller: LLMCaller,
  config?: ManagerConfig
): SpeculativeDecodingManager {
  globalManager = new SpeculativeDecodingManager(llmCaller, config);
  return globalManager;
}

export function getSpeculativeDecoder(): SpeculativeDecodingManager {
  if (!globalManager) {
    throw new Error('SpeculativeDecodingManager not initialized. Call initializeSpeculativeDecoder first.');
  }
  return globalManager;
}

export function resetSpeculativeDecoder(): void {
  globalManager = null;
}
