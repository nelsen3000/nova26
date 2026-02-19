/**
 * Nova26 Model Routing & Speculative Decoding Module
 * KIMI-R22-01 - Model Registry
 */

import { ModelProfile, AgentModelMapping } from './types.js';

/**
 * Central registry for model profiles and agent-to-model mappings.
 * Manages the configuration for 21 different agents with their
 * primary and fallback model assignments.
 */
export class ModelRegistry {
  private models: Map<string, ModelProfile> = new Map();
  private agentMappings: Map<string, AgentModelMapping> = new Map();

  constructor() {
    this.initializeDefaultModels();
    this.initializeDefaultMappings();
  }

  /**
   * Registers a new model profile in the registry.
   */
  register(profile: ModelProfile): void {
    if (!profile.name || !profile.family) {
      throw new Error('ModelProfile must have a name and family');
    }
    this.models.set(profile.name, profile);
  }

  /**
   * Retrieves a model profile by name.
   */
  get(name: string): ModelProfile | undefined {
    return this.models.get(name);
  }

  /**
   * Lists all registered model profiles.
   */
  list(): ModelProfile[] {
    return Array.from(this.models.values());
  }

  /**
   * Gets the model mapping for a specific agent.
   */
  getForAgent(agentId: string): AgentModelMapping | undefined {
    return this.agentMappings.get(agentId);
  }

  /**
   * Registers an agent model mapping.
   */
  registerAgentMapping(mapping: AgentModelMapping): void {
    this.agentMappings.set(mapping.agentId, mapping);
  }

  /**
   * Gets all default agent mappings (21 agents).
   */
  getDefaultMappings(): AgentModelMapping[] {
    return Array.from(this.agentMappings.values());
  }

  /**
   * Clears all registered models and mappings.
   */
  clear(): void {
    this.models.clear();
    this.agentMappings.clear();
  }

  // Private initialization methods

  private initializeDefaultModels(): void {
    // Llama family models
    const llamaModels: ModelProfile[] = [
      {
        name: 'llama-3.1-70b-Q4_K_M',
        family: 'llama',
        strength: 'reasoning',
        quant: 'Q4_K_M',
        contextWindow: 128000,
        tokensPerSec: 45,
        costFactor: 0.8,
        speculativeDraft: 'llama-3.1-8b-Q4_K_M',
      },
      {
        name: 'llama-3.1-8b-Q4_K_M',
        family: 'llama',
        strength: 'speed',
        quant: 'Q4_K_M',
        contextWindow: 128000,
        tokensPerSec: 120,
        costFactor: 0.2,
      },
      {
        name: 'llama-3.1-405b-Q4_K_M',
        family: 'llama',
        strength: 'power',
        quant: 'Q4_K_M',
        contextWindow: 128000,
        tokensPerSec: 15,
        costFactor: 2.5,
      },
    ];

    // Mistral family models
    const mistralModels: ModelProfile[] = [
      {
        name: 'mistral-large-Q4_K_M',
        family: 'mistral',
        strength: 'balanced',
        quant: 'Q4_K_M',
        contextWindow: 32000,
        tokensPerSec: 35,
        costFactor: 0.6,
        speculativeDraft: 'mistral-nemo-Q4_K_M',
      },
      {
        name: 'mistral-nemo-Q4_K_M',
        family: 'mistral',
        strength: 'efficiency',
        quant: 'Q4_K_M',
        contextWindow: 128000,
        tokensPerSec: 150,
        costFactor: 0.15,
      },
      {
        name: 'mixtral-8x22b-Q4_K_M',
        family: 'mistral',
        strength: 'moe',
        quant: 'Q4_K_M',
        contextWindow: 64000,
        tokensPerSec: 25,
        costFactor: 1.2,
      },
    ];

    // Qwen family models
    const qwenModels: ModelProfile[] = [
      {
        name: 'qwen2.5-72b-Q4_K_M',
        family: 'qwen',
        strength: 'multilingual',
        quant: 'Q4_K_M',
        contextWindow: 128000,
        tokensPerSec: 40,
        costFactor: 0.7,
      },
      {
        name: 'qwen2.5-7b-Q4_K_M',
        family: 'qwen',
        strength: 'speed',
        quant: 'Q4_K_M',
        contextWindow: 128000,
        tokensPerSec: 140,
        costFactor: 0.18,
      },
      {
        name: 'qwen2.5-coder-32b-Q4_K_M',
        family: 'qwen',
        strength: 'coding',
        quant: 'Q4_K_M',
        contextWindow: 128000,
        tokensPerSec: 50,
        costFactor: 0.5,
      },
    ];

    // DeepSeek family models
    const deepseekModels: ModelProfile[] = [
      {
        name: 'deepseek-coder-v2-Q4_K_M',
        family: 'deepseek',
        strength: 'coding',
        quant: 'Q4_K_M',
        contextWindow: 128000,
        tokensPerSec: 42,
        costFactor: 0.65,
      },
      {
        name: 'deepseek-chat-v2-Q4_K_M',
        family: 'deepseek',
        strength: 'reasoning',
        quant: 'Q4_K_M',
        contextWindow: 64000,
        tokensPerSec: 38,
        costFactor: 0.6,
      },
    ];

    // Phi family models (small, efficient)
    const phiModels: ModelProfile[] = [
      {
        name: 'phi-4-Q4_K_M',
        family: 'phi',
        strength: 'efficiency',
        quant: 'Q4_K_M',
        contextWindow: 16000,
        tokensPerSec: 180,
        costFactor: 0.1,
      },
      {
        name: 'phi-3-medium-Q4_K_M',
        family: 'phi',
        strength: 'on-device',
        quant: 'Q4_K_M',
        contextWindow: 128000,
        tokensPerSec: 160,
        costFactor: 0.12,
      },
    ];

    // Gemma family models
    const gemmaModels: ModelProfile[] = [
      {
        name: 'gemma-2-27b-Q4_K_M',
        family: 'gemma',
        strength: 'balanced',
        quant: 'Q4_K_M',
        contextWindow: 8000,
        tokensPerSec: 55,
        costFactor: 0.45,
      },
    ];

    // Register all models
    [...llamaModels, ...mistralModels, ...qwenModels, ...deepseekModels, ...phiModels, ...gemmaModels]
      .forEach(model => this.register(model));
  }

  private initializeDefaultMappings(): void {
    // Define the 21 agent mappings
    const agentDefinitions: Array<{
      agentId: string;
      primary: string;
      fallbacks: string[];
      confidenceThreshold: number;
      maxConcurrent: number;
      tasteVaultWeight: number;
    }> = [
      // Core Agents (1-7)
      {
        agentId: 'architect-alpha',
        primary: 'llama-3.1-405b-Q4_K_M',
        fallbacks: ['llama-3.1-70b-Q4_K_M', 'mistral-large-Q4_K_M'],
        confidenceThreshold: 0.85,
        maxConcurrent: 2,
        tasteVaultWeight: 0.9,
      },
      {
        agentId: 'code-sage',
        primary: 'qwen2.5-coder-32b-Q4_K_M',
        fallbacks: ['deepseek-coder-v2-Q4_K_M', 'llama-3.1-70b-Q4_K_M'],
        confidenceThreshold: 0.8,
        maxConcurrent: 4,
        tasteVaultWeight: 0.85,
      },
      {
        agentId: 'debug-oracle',
        primary: 'deepseek-coder-v2-Q4_K_M',
        fallbacks: ['qwen2.5-coder-32b-Q4_K_M', 'mistral-large-Q4_K_M'],
        confidenceThreshold: 0.82,
        maxConcurrent: 3,
        tasteVaultWeight: 0.8,
      },
      {
        agentId: 'doc-weaver',
        primary: 'mistral-large-Q4_K_M',
        fallbacks: ['llama-3.1-70b-Q4_K_M', 'qwen2.5-72b-Q4_K_M'],
        confidenceThreshold: 0.75,
        maxConcurrent: 5,
        tasteVaultWeight: 0.7,
      },
      {
        agentId: 'test-master',
        primary: 'qwen2.5-coder-32b-Q4_K_M',
        fallbacks: ['phi-4-Q4_K_M', 'mistral-nemo-Q4_K_M'],
        confidenceThreshold: 0.78,
        maxConcurrent: 4,
        tasteVaultWeight: 0.75,
      },
      {
        agentId: 'review-critic',
        primary: 'llama-3.1-70b-Q4_K_M',
        fallbacks: ['mistral-large-Q4_K_M', 'gemma-2-27b-Q4_K_M'],
        confidenceThreshold: 0.8,
        maxConcurrent: 3,
        tasteVaultWeight: 0.85,
      },
      {
        agentId: 'security-guard',
        primary: 'llama-3.1-405b-Q4_K_M',
        fallbacks: ['llama-3.1-70b-Q4_K_M', 'qwen2.5-72b-Q4_K_M'],
        confidenceThreshold: 0.88,
        maxConcurrent: 2,
        tasteVaultWeight: 0.9,
      },

      // Specialized Agents (8-14)
      {
        agentId: 'ui-artisan',
        primary: 'mistral-large-Q4_K_M',
        fallbacks: ['gemma-2-27b-Q4_K_M', 'phi-3-medium-Q4_K_M'],
        confidenceThreshold: 0.72,
        maxConcurrent: 4,
        tasteVaultWeight: 0.8,
      },
      {
        agentId: 'api-gatekeeper',
        primary: 'qwen2.5-72b-Q4_K_M',
        fallbacks: ['llama-3.1-70b-Q4_K_M', 'mistral-large-Q4_K_M'],
        confidenceThreshold: 0.8,
        maxConcurrent: 3,
        tasteVaultWeight: 0.75,
      },
      {
        agentId: 'data-alchemist',
        primary: 'deepseek-chat-v2-Q4_K_M',
        fallbacks: ['qwen2.5-72b-Q4_K_M', 'mixtral-8x22b-Q4_K_M'],
        confidenceThreshold: 0.77,
        maxConcurrent: 3,
        tasteVaultWeight: 0.7,
      },
      {
        agentId: 'perf-sage',
        primary: 'phi-4-Q4_K_M',
        fallbacks: ['mistral-nemo-Q4_K_M', 'phi-3-medium-Q4_K_M'],
        confidenceThreshold: 0.7,
        maxConcurrent: 6,
        tasteVaultWeight: 0.65,
      },
      {
        agentId: 'refactor-ninja',
        primary: 'deepseek-coder-v2-Q4_K_M',
        fallbacks: ['qwen2.5-coder-32b-Q4_K_M', 'llama-3.1-70b-Q4_K_M'],
        confidenceThreshold: 0.8,
        maxConcurrent: 4,
        tasteVaultWeight: 0.8,
      },
      {
        agentId: 'dep-analyzer',
        primary: 'mistral-nemo-Q4_K_M',
        fallbacks: ['phi-4-Q4_K_M', 'phi-3-medium-Q4_K_M'],
        confidenceThreshold: 0.68,
        maxConcurrent: 6,
        tasteVaultWeight: 0.6,
      },
      {
        agentId: 'migration-wizard',
        primary: 'llama-3.1-70b-Q4_K_M',
        fallbacks: ['qwen2.5-72b-Q4_K_M', 'mistral-large-Q4_K_M'],
        confidenceThreshold: 0.78,
        maxConcurrent: 3,
        tasteVaultWeight: 0.75,
      },

      // Support Agents (15-21)
      {
        agentId: 'context-manager',
        primary: 'llama-3.1-8b-Q4_K_M',
        fallbacks: ['mistral-nemo-Q4_K_M', 'phi-4-Q4_K_M'],
        confidenceThreshold: 0.65,
        maxConcurrent: 8,
        tasteVaultWeight: 0.5,
      },
      {
        agentId: 'prompt-engineer',
        primary: 'mistral-large-Q4_K_M',
        fallbacks: ['gemma-2-27b-Q4_K_M', 'llama-3.1-8b-Q4_K_M'],
        confidenceThreshold: 0.75,
        maxConcurrent: 4,
        tasteVaultWeight: 0.7,
      },
      {
        agentId: 'knowledge-curator',
        primary: 'qwen2.5-72b-Q4_K_M',
        fallbacks: ['llama-3.1-70b-Q4_K_M', 'mistral-large-Q4_K_M'],
        confidenceThreshold: 0.72,
        maxConcurrent: 3,
        tasteVaultWeight: 0.75,
      },
      {
        agentId: 'quality-assurer',
        primary: 'llama-3.1-70b-Q4_K_M',
        fallbacks: ['mistral-large-Q4_K_M', 'qwen2.5-72b-Q4_K_M'],
        confidenceThreshold: 0.82,
        maxConcurrent: 3,
        tasteVaultWeight: 0.85,
      },
      {
        agentId: 'collab-facilitator',
        primary: 'mistral-nemo-Q4_K_M',
        fallbacks: ['phi-4-Q4_K_M', 'llama-3.1-8b-Q4_K_M'],
        confidenceThreshold: 0.68,
        maxConcurrent: 6,
        tasteVaultWeight: 0.6,
      },
      {
        agentId: 'scheduler-optimizer',
        primary: 'phi-4-Q4_K_M',
        fallbacks: ['phi-3-medium-Q4_K_M', 'mistral-nemo-Q4_K_M'],
        confidenceThreshold: 0.65,
        maxConcurrent: 8,
        tasteVaultWeight: 0.55,
      },
      {
        agentId: 'telemetry-analyst',
        primary: 'mistral-large-Q4_K_M',
        fallbacks: ['gemma-2-27b-Q4_K_M', 'phi-4-Q4_K_M'],
        confidenceThreshold: 0.7,
        maxConcurrent: 5,
        tasteVaultWeight: 0.65,
      },
    ];

    // Create agent mappings from definitions
    for (const def of agentDefinitions) {
      const primary = this.models.get(def.primary);
      if (!primary) {
        throw new Error(`Primary model not found: ${def.primary}`);
      }

      const fallbacks: ModelProfile[] = [];
      for (const fallbackName of def.fallbacks) {
        const fallback = this.models.get(fallbackName);
        if (fallback) {
          fallbacks.push(fallback);
        }
      }

      const mapping: AgentModelMapping = {
        agentId: def.agentId,
        primary,
        fallback: fallbacks,
        confidenceThreshold: def.confidenceThreshold,
        maxConcurrent: def.maxConcurrent,
        tasteVaultWeight: def.tasteVaultWeight,
      };

      this.registerAgentMapping(mapping);
    }
  }
}
