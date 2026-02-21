// Model Selection - Reader model selection with capability checking
// Spec: .kiro/specs/recursive-language-models/design.md

import type { ModelCapability, ModelSelectionResult } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Capability Constants
// ═══════════════════════════════════════════════════════════════════════════════

export const CONTEXT_COMPRESSION_CAPABILITY = 'context-compression';

// ═══════════════════════════════════════════════════════════════════════════════
// Default Model Registry
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_MODELS: ModelCapability[] = [
  {
    id: 'ollama-qwen2.5:7b',
    name: 'Qwen 2.5 7B',
    capabilities: [CONTEXT_COMPRESSION_CAPABILITY, 'chat', 'completion'],
    costPerToken: 0.001,
  },
  {
    id: 'ollama-llama3.1:8b',
    name: 'Llama 3.1 8B',
    capabilities: [CONTEXT_COMPRESSION_CAPABILITY, 'chat', 'completion'],
    costPerToken: 0.0015,
  },
  {
    id: 'ollama-phi3:medium',
    name: 'Phi-3 Medium',
    capabilities: [CONTEXT_COMPRESSION_CAPABILITY, 'chat'],
    costPerToken: 0.0008,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Model Registry
// ═══════════════════════════════════════════════════════════════════════════════

class ModelRegistry {
  private models: Map<string, ModelCapability> = new Map();

  constructor(models: ModelCapability[] = DEFAULT_MODELS) {
    for (const model of models) {
      this.models.set(model.id, model);
    }
  }

  register(model: ModelCapability): void {
    this.models.set(model.id, model);
  }

  get(modelId: string): ModelCapability | undefined {
    return this.models.get(modelId);
  }

  getAll(): ModelCapability[] {
    return Array.from(this.models.values());
  }

  findByCapability(capability: string): ModelCapability[] {
    return this.getAll().filter(m => m.capabilities.includes(capability));
  }
}

// Global registry instance
export const modelRegistry = new ModelRegistry();

// ═══════════════════════════════════════════════════════════════════════════════
// Model Selection
// ═══════════════════════════════════════════════════════════════════════════════

export interface SelectReaderModelOptions {
  preferredModelId?: string;
  requiredCapabilities?: string[];
}

export function selectReaderModel(
  options: SelectReaderModelOptions = {}
): ModelSelectionResult {
  const requiredCapabilities = options.requiredCapabilities || [
    CONTEXT_COMPRESSION_CAPABILITY,
  ];

  // If preferred model specified, validate it has required capabilities
  if (options.preferredModelId) {
    const preferred = modelRegistry.get(options.preferredModelId);
    if (preferred) {
      const hasAllCapabilities = requiredCapabilities.every(cap =>
        preferred.capabilities.includes(cap)
      );
      if (hasAllCapabilities) {
        return {
          modelId: preferred.id,
          model: preferred,
          autoSelected: false,
        };
      }
      throw new Error(
        `Preferred model ${options.preferredModelId} does not have required capabilities: ${requiredCapabilities.join(', ')}`
      );
    }
    throw new Error(`Preferred model not found: ${options.preferredModelId}`);
  }

  // Auto-select cheapest model with required capabilities
  const candidates = modelRegistry.findByCapability(
    CONTEXT_COMPRESSION_CAPABILITY
  ).filter(m =>
    requiredCapabilities.every(cap => m.capabilities.includes(cap))
  );

  if (candidates.length === 0) {
    throw new Error(
      `No models found with required capabilities: ${requiredCapabilities.join(', ')}`
    );
  }

  // Sort by cost and pick cheapest
  const cheapest = candidates.sort((a, b) => a.costPerToken - b.costPerToken)[0];

  return {
    modelId: cheapest.id,
    model: cheapest,
    autoSelected: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Capability Checking
// ═══════════════════════════════════════════════════════════════════════════════

export function hasCapability(
  modelId: string,
  capability: string
): boolean {
  const model = modelRegistry.get(modelId);
  return model ? model.capabilities.includes(capability) : false;
}

export function validateCapabilities(
  modelId: string,
  requiredCapabilities: string[]
): { valid: boolean; missing: string[] } {
  const model = modelRegistry.get(modelId);
  if (!model) {
    return { valid: false, missing: requiredCapabilities };
  }

  const missing = requiredCapabilities.filter(
    cap => !model.capabilities.includes(cap)
  );

  return { valid: missing.length === 0, missing };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cost Estimation
// ═══════════════════════════════════════════════════════════════════════════════

export function estimateCost(
  modelId: string,
  tokenCount: number
): number {
  const model = modelRegistry.get(modelId);
  if (!model) {
    throw new Error(`Model not found: ${modelId}`);
  }
  return model.costPerToken * tokenCount;
}

export function compareCosts(
  modelIds: string[],
  tokenCount: number
): Array<{ modelId: string; cost: number }> {
  return modelIds
    .map(id => ({
      modelId: id,
      cost: estimateCost(id, tokenCount),
    }))
    .sort((a, b) => a.cost - b.cost);
}
