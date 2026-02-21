// Model Database - Extended model registry with capabilities and matching
// Spec: .nova/specs/grok-r24-immortal-omniverse.md (R24-01)

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// Type Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const ModelCapabilitySchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(1),
});

export const ModelPricingSchema = z.object({
  inputPerMToken: z.number(), // USD
  outputPerMToken: z.number(), // USD
  currency: z.string().default('USD'),
});

export const ModelPerformanceSchema = z.object({
  latencyP50: z.number(), // ms
  latencyP95: z.number(), // ms
  throughput: z.number(), // tokens/sec
  contextWindow: z.number(),
  maxOutput: z.number(),
});

export const ModelLimitsSchema = z.object({
  rateLimitPerMinute: z.number().optional(),
  concurrentRequests: z.number().optional(),
  dailyQuota: z.number().optional(),
});

export const ModelEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum(['ollama', 'anthropic', 'openrouter', 'openai', 'moonshot']),
  family: z.string(),
  version: z.string(),
  capabilities: z.array(ModelCapabilitySchema),
  pricing: ModelPricingSchema,
  performance: ModelPerformanceSchema,
  limits: ModelLimitsSchema.optional(),
  status: z.enum(['active', 'deprecated', 'preview']).default('active'),
  metadata: z.record(z.any()).optional(),
});

export type ModelCapability = z.infer<typeof ModelCapabilitySchema>;
export type ModelPricing = z.infer<typeof ModelPricingSchema>;
export type ModelPerformance = z.infer<typeof ModelPerformanceSchema>;
export type ModelLimits = z.infer<typeof ModelLimitsSchema>;
export type ModelEntry = z.infer<typeof ModelEntrySchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// Pre-populated Model Data
// ═══════════════════════════════════════════════════════════════════════════════

export const PREPOPULATED_MODELS: ModelEntry[] = [
  // Ollama Models
  {
    id: 'ollama-qwen2.5:7b',
    name: 'Qwen2.5 7B',
    provider: 'ollama',
    family: 'qwen',
    version: '2.5',
    capabilities: [
      { name: 'chat', score: 0.75 },
      { name: 'code-generation', score: 0.7 },
      { name: 'code-analysis', score: 0.7 },
      { name: 'reasoning', score: 0.65 },
    ],
    pricing: { inputPerMToken: 0, outputPerMToken: 0, currency: 'USD' },
    performance: {
      latencyP50: 500,
      latencyP95: 2000,
      throughput: 50,
      contextWindow: 128000,
      maxOutput: 4096,
    },
    limits: { concurrentRequests: 10 },
    status: 'active',
  },
  {
    id: 'ollama-qwen2.5:14b',
    name: 'Qwen2.5 14B',
    provider: 'ollama',
    family: 'qwen',
    version: '2.5',
    capabilities: [
      { name: 'chat', score: 0.8 },
      { name: 'code-generation', score: 0.78 },
      { name: 'code-analysis', score: 0.78 },
      { name: 'reasoning', score: 0.75 },
    ],
    pricing: { inputPerMToken: 0, outputPerMToken: 0, currency: 'USD' },
    performance: {
      latencyP50: 800,
      latencyP95: 3000,
      throughput: 40,
      contextWindow: 128000,
      maxOutput: 4096,
    },
    status: 'active',
  },
  // Anthropic Models
  {
    id: 'anthropic-claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    family: 'claude-3',
    version: '20240307',
    capabilities: [
      { name: 'chat', score: 0.8 },
      { name: 'summarization', score: 0.85 },
      { name: 'quick-query', score: 0.9 },
      { name: 'documentation', score: 0.8 },
    ],
    pricing: { inputPerMToken: 0.25, outputPerMToken: 1.25, currency: 'USD' },
    performance: {
      latencyP50: 400,
      latencyP95: 1500,
      throughput: 100,
      contextWindow: 200000,
      maxOutput: 4096,
    },
    status: 'active',
  },
  {
    id: 'anthropic-claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    family: 'claude-3',
    version: '20240229',
    capabilities: [
      { name: 'chat', score: 0.88 },
      { name: 'code-generation', score: 0.88 },
      { name: 'code-analysis', score: 0.88 },
      { name: 'architecture', score: 0.85 },
      { name: 'reasoning', score: 0.88 },
      { name: 'testing', score: 0.85 },
      { name: 'tool-use', score: 0.9 },
    ],
    pricing: { inputPerMToken: 3, outputPerMToken: 15, currency: 'USD' },
    performance: {
      latencyP50: 800,
      latencyP95: 3500,
      throughput: 60,
      contextWindow: 200000,
      maxOutput: 4096,
    },
    status: 'active',
  },
  {
    id: 'anthropic-claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    family: 'claude-3',
    version: '20240229',
    capabilities: [
      { name: 'chat', score: 0.95 },
      { name: 'code-generation', score: 0.92 },
      { name: 'code-analysis', score: 0.92 },
      { name: 'architecture', score: 0.95 },
      { name: 'reasoning', score: 0.95 },
      { name: 'research', score: 0.95 },
      { name: 'testing', score: 0.9 },
      { name: 'tool-use', score: 0.92 },
    ],
    pricing: { inputPerMToken: 15, outputPerMToken: 75, currency: 'USD' },
    performance: {
      latencyP50: 1500,
      latencyP95: 6000,
      throughput: 30,
      contextWindow: 200000,
      maxOutput: 4096,
    },
    status: 'active',
  },
  // OpenRouter Models
  {
    id: 'openrouter-qwen-2.5-coder-32b',
    name: 'Qwen2.5 Coder 32B',
    provider: 'openrouter',
    family: 'qwen',
    version: '2.5',
    capabilities: [
      { name: 'chat', score: 0.82 },
      { name: 'code-generation', score: 0.88 },
      { name: 'code-analysis', score: 0.85 },
      { name: 'architecture', score: 0.78 },
    ],
    pricing: { inputPerMToken: 0.15, outputPerMToken: 0.4, currency: 'USD' },
    performance: {
      latencyP50: 800,
      latencyP95: 3000,
      throughput: 50,
      contextWindow: 128000,
      maxOutput: 4096,
    },
    status: 'active',
  },
  {
    id: 'openrouter-deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'openrouter',
    family: 'deepseek',
    version: 'v2',
    capabilities: [
      { name: 'chat', score: 0.85 },
      { name: 'code-generation', score: 0.82 },
      { name: 'code-analysis', score: 0.8 },
      { name: 'reasoning', score: 0.85 },
    ],
    pricing: { inputPerMToken: 0.14, outputPerMToken: 0.28, currency: 'USD' },
    performance: {
      latencyP50: 1000,
      latencyP95: 4000,
      throughput: 45,
      contextWindow: 64000,
      maxOutput: 4096,
    },
    status: 'active',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ExtendedModelRegistry Class
// ═══════════════════════════════════════════════════════════════════════════════

export class ExtendedModelRegistry {
  private models: Map<string, ModelEntry> = new Map();

  constructor() {
    // Pre-populate with known models
    for (const model of PREPOPULATED_MODELS) {
      this.models.set(model.id, model);
    }
  }

  /**
   * Register a new model
   */
  register(model: ModelEntry): ModelEntry {
    const validated = ModelEntrySchema.parse(model);
    this.models.set(validated.id, validated);
    return validated;
  }

  /**
   * Get a model by ID
   */
  get(id: string): ModelEntry | undefined {
    return this.models.get(id);
  }

  /**
   * Get a model or throw
   */
  getOrThrow(id: string): ModelEntry {
    const model = this.models.get(id);
    if (!model) {
      throw new Error(`Model not found: ${id}`);
    }
    return model;
  }

  /**
   * List all models
   */
  list(filters?: {
    provider?: string;
    family?: string;
    status?: 'active' | 'deprecated' | 'preview';
    minCapability?: { name: string; score: number };
  }): ModelEntry[] {
    let models = Array.from(this.models.values());

    if (filters?.provider) {
      models = models.filter(m => m.provider === filters.provider);
    }

    if (filters?.family) {
      models = models.filter(m => m.family === filters.family);
    }

    if (filters?.status) {
      models = models.filter(m => m.status === filters.status);
    }

    if (filters?.minCapability) {
      models = models.filter(m =>
        m.capabilities.some(
          c =>
            c.name === filters.minCapability!.name &&
            c.score >= filters.minCapability!.score
        )
      );
    }

    return models;
  }

  /**
   * Update a model
   */
  update(id: string, updates: Partial<ModelEntry>): ModelEntry {
    const existing = this.getOrThrow(id);
    const updated = { ...existing, ...updates };
    return this.register(updated);
  }

  /**
   * Deprecate a model
   */
  deprecate(id: string): ModelEntry {
    return this.update(id, { status: 'deprecated' });
  }

  /**
   * Get all unique providers
   */
  getProviders(): string[] {
    return [...new Set(Array.from(this.models.values()).map(m => m.provider))];
  }

  /**
   * Get all unique families
   */
  getFamilies(): string[] {
    return [...new Set(Array.from(this.models.values()).map(m => m.family))];
  }

  /**
   * Get all unique capabilities
   */
  getCapabilities(): string[] {
    const caps = new Set<string>();
    for (const model of this.models.values()) {
      for (const cap of model.capabilities) {
        caps.add(cap.name);
      }
    }
    return [...caps];
  }

  /**
   * Get capability score for a model
   */
  getCapabilityScore(modelId: string, capability: string): number {
    const model = this.models.get(modelId);
    if (!model) return 0;

    const cap = model.capabilities.find(c => c.name === capability);
    return cap?.score ?? 0;
  }

  /**
   * Count models
   */
  count(): number {
    return this.models.size;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════════════════════

let globalRegistry: ExtendedModelRegistry | null = null;

export function getExtendedModelRegistry(): ExtendedModelRegistry {
  if (!globalRegistry) {
    globalRegistry = new ExtendedModelRegistry();
  }
  return globalRegistry;
}

export function resetExtendedModelRegistry(): void {
  globalRegistry = null;
}
