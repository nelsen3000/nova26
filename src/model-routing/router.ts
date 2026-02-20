/**
 * Nova26 Model Routing & Speculative Decoding Module
 * KIMI-R22-01 - Model Router
 */

import {
  ModelProfile,
  AgentModelMapping,
  ModelRouteResult,
  InferenceMetrics,
  HardwareTier,
} from './types.js';
import { ModelRegistry } from './model-registry.js';
import { HardwareDetector } from './hardware-detector.js';

/**
 * Configuration options for the ModelRouter.
 */
export interface RouterConfig {
  enableSpeculativeDecoding: boolean;
  enableDynamicEscalation: boolean;
  enableQueueing: boolean;
  defaultConfidenceThreshold: number;
  maxFallbackDepth: number;
}

/**
 * Default router configuration.
 */
const DEFAULT_CONFIG: RouterConfig = {
  enableSpeculativeDecoding: true,
  enableDynamicEscalation: true,
  enableQueueing: true,
  defaultConfidenceThreshold: 0.75,
  maxFallbackDepth: 3,
};

/**
 * Main routing logic for selecting appropriate models based on
 * agent requirements, task characteristics, and system hardware.
 */
export class ModelRouter {
  private registry: ModelRegistry;
  private hardwareDetector: HardwareDetector;
  private config: RouterConfig;
  private metrics: InferenceMetrics[] = [];
  private activeInferences: Map<string, number> = new Map();

  constructor(
    registry: ModelRegistry,
    hardwareDetector: HardwareDetector,
    config: Partial<RouterConfig> = {}
  ) {
    this.registry = registry;
    this.hardwareDetector = hardwareDetector;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Routes a task to the most appropriate model based on agent ID,
   * task description, and confidence level.
   */
  route(
    agentId: string,
    taskDescription: string,
    confidence: number
  ): ModelRouteResult {
    const mapping = this.registry.getForAgent(agentId);
    
    if (!mapping) {
      throw new Error(`No model mapping found for agent: ${agentId}`);
    }

    const hardware = this.hardwareDetector.detect();
    const currentConcurrent = this.activeInferences.get(agentId) ?? 0;

    // Check if we need to queue due to concurrency limits
    if (currentConcurrent >= mapping.maxConcurrent) {
      return this.createQueuedResult(mapping, hardware, confidence);
    }

    // Determine if we should use primary or fallback model
    const selectedModel = this.selectModel(mapping, confidence, hardware);
    const useSpeculative = this.shouldUseSpeculativeDecoding(selectedModel);
    const fallbackChain = this.buildFallbackChain(mapping, selectedModel);

    // Calculate estimates
    const estimatedTokensPerSec = this.estimateTokensPerSec(selectedModel, hardware);
    const estimatedCost = this.estimateCost(selectedModel, taskDescription);

    const result: ModelRouteResult = {
      agentId,
      selectedModel,
      fallbackChain,
      useSpeculativeDecoding: useSpeculative,
      estimatedTokensPerSec,
      estimatedCost,
      confidence,
    };

    // Track active inference
    this.activeInferences.set(agentId, currentConcurrent + 1);

    return result;
  }

  /**
   * Determines if the current model should be escalated to a more
   * powerful model based on confidence threshold.
   */
  shouldEscalate(currentModel: string, confidence: number): boolean {
    if (!this.config.enableDynamicEscalation) {
      return false;
    }

    const model = this.registry.get(currentModel);
    if (!model) {
      return false;
    }

    // Escalate if confidence is below threshold and model has draft model
    // (indicating there's a more powerful version available)
    const shouldEscalate = confidence < this.config.defaultConfidenceThreshold && 
                          model.strength !== 'power' &&
                          model.strength !== 'reasoning';

    return shouldEscalate;
  }

  /**
   * Gets the fallback models for a specific agent.
   */
  getFallbackModels(agentId: string): ModelProfile[] {
    const mapping = this.registry.getForAgent(agentId);
    return mapping?.fallback ?? [];
  }

  /**
   * Records inference metrics for future routing optimization.
   */
  recordMetrics(metrics: InferenceMetrics): void {
    this.metrics.push(metrics);
    
    // Trim metrics history to prevent unbounded growth
    const MAX_METRICS = 1000;
    if (this.metrics.length > MAX_METRICS) {
      this.metrics = this.metrics.slice(-MAX_METRICS);
    }

    // Update active inference count
    const current = this.activeInferences.get(metrics.agentId) ?? 0;
    if (current > 0) {
      this.activeInferences.set(metrics.agentId, current - 1);
    }
  }

  /**
   * Gets historical metrics for analysis.
   */
  getMetrics(agentId?: string): InferenceMetrics[] {
    if (agentId) {
      return this.metrics.filter(m => m.agentId === agentId);
    }
    return [...this.metrics];
  }

  /**
   * Clears all recorded metrics.
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Releases an active inference slot for an agent.
   */
  releaseSlot(agentId: string): void {
    const current = this.activeInferences.get(agentId) ?? 0;
    if (current > 0) {
      this.activeInferences.set(agentId, current - 1);
    }
  }

  // Private helper methods

  private selectModel(
    mapping: AgentModelMapping,
    confidence: number,
    hardware: HardwareTier
  ): ModelProfile {
    // If confidence is high and hardware supports it, use primary
    if (confidence >= mapping.confidenceThreshold) {
      if (this.canRunOnHardware(mapping.primary, hardware)) {
        return mapping.primary;
      }
    }

    // Find first fallback that fits on hardware
    for (const fallback of mapping.fallback) {
      if (this.canRunOnHardware(fallback, hardware)) {
        return fallback;
      }
    }

    // Fallback to primary even if it might not fit (will use CPU offloading)
    return mapping.primary;
  }

  private canRunOnHardware(model: ModelProfile, hardware: HardwareTier): boolean {
    // Rough VRAM estimation: 1B params ~ 0.5GB for Q4_K_M quantized
    const estimatedVRAM = this.estimateModelVRAM(model);
    
    if (hardware.gpuVendor === null) {
      // CPU-only mode - check RAM
      return estimatedVRAM <= hardware.ramGB * 0.75;
    }

    return estimatedVRAM <= hardware.vramGB;
  }

  private estimateModelVRAM(model: ModelProfile): number {
    // Extract size from model name (e.g., "70b" -> 70)
    const sizeMatch = model.name.match(/(\d+)b/i);
    const sizeInB = sizeMatch ? parseInt(sizeMatch[1], 10) : 7;
    
    // Quantization factor mapping
    const quantFactors: Record<string, number> = {
      'Q2_K': 0.3,
      'Q3_K': 0.4,
      'Q4_K_M': 0.5,
      'Q4_K_S': 0.45,
      'Q5_K_M': 0.6,
      'Q5_K_S': 0.55,
      'Q6_K': 0.7,
      'Q8_0': 0.75,
      'FP16': 2.0,
    };

    const factor = quantFactors[model.quant] ?? 0.5;
    return sizeInB * factor;
  }

  private shouldUseSpeculativeDecoding(model: ModelProfile): boolean {
    if (!this.config.enableSpeculativeDecoding) {
      return false;
    }

    // Use speculative decoding if model has a draft model defined
    return model.speculativeDraft !== undefined;
  }

  private buildFallbackChain(
    mapping: AgentModelMapping,
    selectedModel: ModelProfile
  ): ModelProfile[] {
    const chain: ModelProfile[] = [];
    
    // If selected model is primary, use defined fallbacks
    if (selectedModel.name === mapping.primary.name) {
      chain.push(...mapping.fallback.slice(0, this.config.maxFallbackDepth));
      return chain;
    }

    // If a fallback is selected, include primary first, then remaining fallbacks
    const selectedIndex = mapping.fallback.findIndex(f => f.name === selectedModel.name);
    if (selectedIndex >= 0) {
      // Primary is always the first fallback option
      chain.push(mapping.primary);
      // Then include remaining fallbacks after the selected one
      chain.push(...mapping.fallback.slice(selectedIndex + 1, selectedIndex + 1 + this.config.maxFallbackDepth - 1));
    }

    return chain;
  }

  private estimateTokensPerSec(model: ModelProfile, hardware: HardwareTier): number {
    let baseTokens = model.tokensPerSec;

    // Adjust for hardware tier
    const hardwareMultiplier: Record<string, number> = {
      'low': 0.3,
      'mid': 0.7,
      'high': 1.0,
      'ultra': 1.5,
      'apple-silicon': 0.9,
    };

    baseTokens *= hardwareMultiplier[hardware.id] ?? 0.5;

    // Adjust for speculative decoding
    if (model.speculativeDraft) {
      baseTokens *= 1.5; // ~50% speedup with speculative decoding
    }

    return Math.round(baseTokens);
  }

  private estimateCost(model: ModelProfile, taskDescription: string): number {
    // Estimate based on model cost factor and estimated task complexity
    const baseCost = model.costFactor;
    
    // Estimate complexity from description length and keywords
    const complexityMultiplier = this.estimateComplexity(taskDescription);
    
    return Math.round(baseCost * complexityMultiplier * 100) / 100;
  }

  private estimateComplexity(taskDescription: string): number {
    const length = taskDescription.length;
    let multiplier = 1.0;

    // Length-based adjustment
    if (length > 1000) multiplier += 0.3;
    if (length > 5000) multiplier += 0.5;

    // Keyword-based complexity detection
    const complexityKeywords = [
      'refactor', 'optimize', 'architecture', 'design pattern',
      'security audit', 'performance', 'scalability', 'distributed'
    ];

    for (const keyword of complexityKeywords) {
      if (taskDescription.toLowerCase().includes(keyword)) {
        multiplier += 0.2;
      }
    }

    return multiplier;
  }

  private createQueuedResult(
    mapping: AgentModelMapping,
    _hardware: HardwareTier,
    _confidence: number
  ): ModelRouteResult {
    return {
      agentId: mapping.agentId,
      selectedModel: mapping.primary,
      fallbackChain: mapping.fallback,
      useSpeculativeDecoding: false,
      estimatedTokensPerSec: 0,
      estimatedCost: 0,
      confidence: _confidence,
      queuePosition: -1, // Indicates queued state
    };
  }
}
