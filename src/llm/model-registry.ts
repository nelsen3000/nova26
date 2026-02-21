// Model Registry - Central registry for LLM model configurations
// Defines available models, their capabilities, and pricing

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type ModelProvider = 'ollama' | 'openrouter' | 'anthropic' | 'openai' | 'moonshot';

export type ModelCapability = 
  | 'chat'
  | 'code-generation'
  | 'code-analysis'
  | 'reasoning'
  | 'architecture'
  | 'testing'
  | 'documentation'
  | 'research'
  | 'summarization'
  | 'tool-use';

export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  costPerInputToken: number; // USD per token
  costPerOutputToken: number; // USD per token
  maxTokens: number;
  contextWindow: number;
  capabilities: ModelCapability[];
  latencyP50: number; // Median latency in ms
  latencyP99: number; // 99th percentile latency in ms
  quality: number; // 0-1 quality score
  description?: string;
}

export type TaskType = 
  | 'code-generation'
  | 'code-analysis'
  | 'architecture-design'
  | 'testing'
  | 'documentation'
  | 'research'
  | 'summarization'
  | 'validation'
  | 'orchestration'
  | 'quick-query';

// ═══════════════════════════════════════════════════════════════════════════════
// Model Registry
// ═══════════════════════════════════════════════════════════════════════════════

export const MODEL_REGISTRY: ModelConfig[] = [
  // ═══════════════════════════════════════════════════════════════════════════════
  // Ollama (Local) Models
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    id: 'ollama-qwen2.5:7b',
    name: 'qwen2.5:7b',
    provider: 'ollama',
    costPerInputToken: 0,
    costPerOutputToken: 0,
    maxTokens: 4096,
    contextWindow: 128000,
    capabilities: ['chat', 'code-generation', 'code-analysis', 'quick-query'],
    latencyP50: 500,
    latencyP99: 2000,
    quality: 0.7,
    description: 'Fast local model good for quick code tasks',
  },
  {
    id: 'ollama-qwen2.5:14b',
    name: 'qwen2.5:14b',
    provider: 'ollama',
    costPerInputToken: 0,
    costPerOutputToken: 0,
    maxTokens: 4096,
    contextWindow: 128000,
    capabilities: ['chat', 'code-generation', 'code-analysis', 'documentation', 'testing'],
    latencyP50: 1000,
    latencyP99: 4000,
    quality: 0.78,
    description: 'Larger local model with better code understanding',
  },
  {
    id: 'ollama-qwen2.5:32b',
    name: 'qwen2.5:32b',
    provider: 'ollama',
    costPerInputToken: 0,
    costPerOutputToken: 0,
    maxTokens: 4096,
    contextWindow: 128000,
    capabilities: ['chat', 'code-generation', 'code-analysis', 'architecture', 'reasoning'],
    latencyP50: 2000,
    latencyP99: 8000,
    quality: 0.82,
    description: 'Large local model suitable for complex tasks',
  },
  {
    id: 'ollama-llama3:8b',
    name: 'llama3:8b',
    provider: 'ollama',
    costPerInputToken: 0,
    costPerOutputToken: 0,
    maxTokens: 4096,
    contextWindow: 8192,
    capabilities: ['chat', 'code-generation', 'quick-query'],
    latencyP50: 600,
    latencyP99: 2500,
    quality: 0.72,
    description: 'Fast general-purpose local model',
  },
  {
    id: 'ollama-deepseek-coder:6.7b',
    name: 'deepseek-coder:6.7b',
    provider: 'ollama',
    costPerInputToken: 0,
    costPerOutputToken: 0,
    maxTokens: 4096,
    contextWindow: 16384,
    capabilities: ['chat', 'code-generation', 'code-analysis'],
    latencyP50: 700,
    latencyP99: 3000,
    quality: 0.75,
    description: 'Specialized coding model',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // OpenRouter Models
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    id: 'openrouter-qwen/qwen-2.5-coder-32b-instruct',
    name: 'Qwen2.5 Coder 32B',
    provider: 'openrouter',
    costPerInputToken: 0.00000015,
    costPerOutputToken: 0.0000004,
    maxTokens: 4096,
    contextWindow: 128000,
    capabilities: ['chat', 'code-generation', 'code-analysis', 'architecture'],
    latencyP50: 800,
    latencyP99: 3000,
    quality: 0.82,
    description: 'High-quality coding model via OpenRouter',
  },
  {
    id: 'openrouter-deepseek/deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'openrouter',
    costPerInputToken: 0.00000014,
    costPerOutputToken: 0.00000028,
    maxTokens: 4096,
    contextWindow: 64000,
    capabilities: ['chat', 'code-generation', 'code-analysis', 'reasoning'],
    latencyP50: 1000,
    latencyP99: 4000,
    quality: 0.8,
    description: 'Cost-effective reasoning model',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Anthropic Models
  // ═══════════════════════════════════════════════════════════════════════════════
  {
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
    description: 'Fast and cheap for simple tasks',
  },
  {
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
    description: 'Balanced performance for most tasks',
  },
  {
    id: 'anthropic-claude-3-opus',
    name: 'claude-3-opus',
    provider: 'anthropic',
    costPerInputToken: 0.000015,
    costPerOutputToken: 0.000075,
    maxTokens: 4096,
    contextWindow: 200000,
    capabilities: ['chat', 'code-generation', 'code-analysis', 'architecture', 'reasoning', 'research', 'testing', 'tool-use'],
    latencyP50: 1500,
    latencyP99: 6000,
    quality: 0.95,
    description: 'Highest quality for complex tasks',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // OpenAI Models
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    id: 'openai-gpt-4o-mini',
    name: 'gpt-4o-mini',
    provider: 'openai',
    costPerInputToken: 0.00000015,
    costPerOutputToken: 0.0000006,
    maxTokens: 16384,
    contextWindow: 128000,
    capabilities: ['chat', 'code-generation', 'quick-query', 'summarization'],
    latencyP50: 300,
    latencyP99: 1200,
    quality: 0.78,
    description: 'Fast and cheap for simple tasks',
  },
  {
    id: 'openai-gpt-4o',
    name: 'gpt-4o',
    provider: 'openai',
    costPerInputToken: 0.0000025,
    costPerOutputToken: 0.00001,
    maxTokens: 16384,
    contextWindow: 128000,
    capabilities: ['chat', 'code-generation', 'code-analysis', 'architecture', 'reasoning', 'testing', 'tool-use'],
    latencyP50: 600,
    latencyP99: 2500,
    quality: 0.88,
    description: 'High quality for complex code tasks',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Moonshot Models
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    id: 'moonshot-kimi-k2.5',
    name: 'kimi-k2.5',
    provider: 'moonshot',
    costPerInputToken: 0.000002,
    costPerOutputToken: 0.00001,
    maxTokens: 8192,
    contextWindow: 256000,
    capabilities: ['chat', 'code-generation', 'code-analysis', 'architecture', 'reasoning', 'testing'],
    latencyP50: 700,
    latencyP99: 3000,
    quality: 0.86,
    description: 'Strong coding performance with large context',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Task Type to Capability Mapping
// ═══════════════════════════════════════════════════════════════════════════════

export const TASK_CAPABILITY_MAP: Record<TaskType, ModelCapability[]> = {
  'code-generation': ['code-generation'],
  'code-analysis': ['code-analysis'],
  'architecture-design': ['architecture', 'reasoning'],
  'testing': ['testing', 'code-analysis'],
  'documentation': ['documentation', 'summarization'],
  'research': ['research', 'reasoning'],
  'summarization': ['summarization'],
  'validation': ['code-analysis', 'testing'],
  'orchestration': ['reasoning', 'architecture'],
  'quick-query': ['chat', 'quick-query'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get a model by its ID
 */
export function getModelById(id: string): ModelConfig | undefined {
  return MODEL_REGISTRY.find(m => m.id === id);
}

/**
 * Get models by provider
 */
export function getModelsByProvider(provider: ModelProvider): ModelConfig[] {
  return MODEL_REGISTRY.filter(m => m.provider === provider);
}

/**
 * Get models by capability
 */
export function getModelsByCapability(capability: ModelCapability): ModelConfig[] {
  return MODEL_REGISTRY.filter(m => m.capabilities.includes(capability));
}

/**
 * Get models suitable for a task type
 */
export function getModelsForTaskType(taskType: TaskType): ModelConfig[] {
  const requiredCapabilities = TASK_CAPABILITY_MAP[taskType];
  return MODEL_REGISTRY.filter(m => 
    requiredCapabilities.some(cap => m.capabilities.includes(cap))
  );
}

/**
 * Calculate estimated cost for a request
 */
export function estimateRequestCost(
  model: ModelConfig,
  inputTokens: number,
  outputTokens: number
): number {
  return (inputTokens * model.costPerInputToken) + (outputTokens * model.costPerOutputToken);
}

/**
 * Calculate estimated latency
 */
export function estimateLatency(model: ModelConfig, outputTokens: number): number {
  // Simple linear model: base latency + token generation time
  // Model-specific throughput: local models faster than cloud models
  const tokensPerSecond = model.provider === 'ollama' ? 100 : 50;
  const generationTime = (outputTokens / tokensPerSecond) * 1000;
  return model.latencyP50 + generationTime;
}

/**
 * Check if model satisfies quality threshold
 */
export function meetsQualityThreshold(model: ModelConfig, minQuality: number): boolean {
  return model.quality >= minQuality;
}

/**
 * Check if model satisfies cost constraint
 */
export function meetsCostConstraint(
  model: ModelConfig,
  maxCost: number,
  inputTokens: number,
  outputTokens: number
): boolean {
  const estimatedCost = estimateRequestCost(model, inputTokens, outputTokens);
  return estimatedCost <= maxCost;
}

/**
 * Check if model satisfies latency constraint
 */
export function meetsLatencyConstraint(
  model: ModelConfig,
  maxLatency: number,
  outputTokens: number
): boolean {
  const estimatedLatency = estimateLatency(model, outputTokens);
  return estimatedLatency <= maxLatency;
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): ModelProvider[] {
  return [...new Set(MODEL_REGISTRY.map(m => m.provider))];
}

/**
 * Get all available capabilities
 */
export function getAvailableCapabilities(): ModelCapability[] {
  const caps = new Set<ModelCapability>();
  for (const model of MODEL_REGISTRY) {
    for (const cap of model.capabilities) {
      caps.add(cap);
    }
  }
  return [...caps];
}

/**
 * Filter models by multiple criteria
 */
export function filterModels(options: {
  provider?: ModelProvider;
  capabilities?: ModelCapability[];
  minQuality?: number;
  maxCost?: number;
  maxLatency?: number;
  preferLocal?: boolean;
}): ModelConfig[] {
  let models = [...MODEL_REGISTRY];

  if (options.provider) {
    models = models.filter(m => m.provider === options.provider);
  }

  if (options.capabilities && options.capabilities.length > 0) {
    models = models.filter(m => 
      options.capabilities!.some(cap => m.capabilities.includes(cap))
    );
  }

  if (options.minQuality !== undefined) {
    models = models.filter(m => m.quality >= options.minQuality!);
  }

  if (options.maxCost !== undefined) {
    models = models.filter(m => m.costPerInputToken + m.costPerOutputToken <= options.maxCost!);
  }

  if (options.maxLatency !== undefined) {
    models = models.filter(m => m.latencyP99 <= options.maxLatency!);
  }

  if (options.preferLocal) {
    // Sort local models first
    models.sort((a, b) => {
      const aLocal = a.provider === 'ollama' ? 1 : 0;
      const bLocal = b.provider === 'ollama' ? 1 : 0;
      return bLocal - aLocal;
    });
  }

  return models;
}
