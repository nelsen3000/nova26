// Model Router - Switches between Free (Ollama) and Paid (OpenAI/Anthropic) models
// Allows users to choose cost vs quality tradeoffs
// Includes response caching (C-03) and circuit breaker (C-07)

import { callLLM as callOllamaClient } from './ollama-client.js';
import { getCachedResponse, cacheResponse } from './response-cache.js';
import { getConfig } from '../config/config.js';

export type ModelTier = 'free' | 'paid' | 'hybrid';
export type ModelProvider = 'ollama' | 'openai' | 'anthropic';

export interface ModelConfig {
  name: string;
  provider: ModelProvider;
  tier: ModelTier;
  contextWindow: number;
  costPer1KTokens: number; // USD
  speed: 'fast' | 'medium' | 'slow';
  quality: 'basic' | 'good' | 'excellent';
  bestFor: string[];
  // eslint-disable-next-line no-unused-vars
  description?: string;
}

// Available models configuration
export const AVAILABLE_MODELS: ModelConfig[] = [
  // Free tier - Ollama (local)
  {
    name: 'qwen2.5:7b',
    provider: 'ollama',
    tier: 'free',
    contextWindow: 128000,
    costPer1KTokens: 0,
    speed: 'fast',
    quality: 'good',
    bestFor: ['code generation', 'quick iterations', ' prototyping']
  },
  {
    name: 'qwen2.5:14b',
    provider: 'ollama',
    tier: 'free',
    contextWindow: 128000,
    costPer1KTokens: 0,
    speed: 'medium',
    quality: 'good',
    bestFor: ['complex code', 'documentation', 'analysis']
  },
  {
    name: 'llama3:8b',
    provider: 'ollama',
    tier: 'free',
    contextWindow: 8192,
    costPer1KTokens: 0,
    speed: 'fast',
    quality: 'good',
    bestFor: ['general tasks', 'chat', 'simple code']
  },
  {
    name: 'codellama:7b',
    provider: 'ollama',
    tier: 'free',
    contextWindow: 16384,
    costPer1KTokens: 0,
    speed: 'fast',
    quality: 'good',
    bestFor: ['code completion', 'refactoring', 'code review']
  },
  {
    name: 'deepseek-coder:6.7b',
    provider: 'ollama',
    tier: 'free',
    contextWindow: 16384,
    costPer1KTokens: 0,
    speed: 'fast',
    quality: 'good',
    bestFor: ['code generation', 'technical writing', 'debugging']
  },
  
  // Paid tier - OpenAI
  {
    name: 'gpt-4o-mini',
    provider: 'openai',
    tier: 'paid',
    contextWindow: 128000,
    costPer1KTokens: 0.00015,
    speed: 'fast',
    quality: 'good',
    bestFor: ['quick tasks', 'simple code', 'classification']
  },
  {
    name: 'gpt-4o',
    provider: 'openai',
    tier: 'paid',
    contextWindow: 128000,
    costPer1KTokens: 0.0025,
    speed: 'medium',
    quality: 'excellent',
    bestFor: ['complex code', 'architecture', 'reasoning']
  },
  {
    name: 'o1-mini',
    provider: 'openai',
    tier: 'paid',
    contextWindow: 128000,
    costPer1KTokens: 0.003,
    speed: 'slow',
    quality: 'excellent',
    bestFor: ['complex reasoning', 'math', 'debugging']
  },
  
  // Paid tier - Anthropic
  {
    name: 'claude-3-haiku',
    provider: 'anthropic',
    tier: 'paid',
    contextWindow: 200000,
    costPer1KTokens: 0.00025,
    speed: 'fast',
    quality: 'good',
    bestFor: ['quick tasks', 'summarization', 'simple code']
  },
  {
    name: 'claude-3-sonnet',
    provider: 'anthropic',
    tier: 'paid',
    contextWindow: 200000,
    costPer1KTokens: 0.003,
    speed: 'medium',
    quality: 'excellent',
    bestFor: ['complex code', 'analysis', 'writing']
  },
  {
    name: 'claude-3-opus',
    provider: 'anthropic',
    tier: 'paid',
    contextWindow: 200000,
    costPer1KTokens: 0.015,
    speed: 'slow',
    quality: 'excellent',
    bestFor: ['most complex tasks', 'research', 'creative work']
  }
];

// Fallback chains - ordered by priority within each tier
const FALLBACK_CHAINS: Record<ModelTier, string[]> = {
  free: ['qwen2.5:7b', 'qwen2.5:14b', 'llama3:8b', 'deepseek-coder:6.7b', 'codellama:7b'],
  paid: ['gpt-4o', 'claude-3-sonnet', 'gpt-4o-mini', 'claude-3-haiku', 'o1-mini', 'claude-3-opus'],
  hybrid: ['qwen2.5:7b', 'gpt-4o-mini', 'qwen2.5:14b', 'gpt-4o', 'claude-3-sonnet'],
};

// Current model configuration
let currentModel: ModelConfig = AVAILABLE_MODELS[0]; // Default to qwen2.5:7b
let currentTier: ModelTier = getConfig().models.tier; // Initialize from config

/**
 * Select model by name
 */
export function selectModel(modelName: string): ModelConfig {
  const model = AVAILABLE_MODELS.find(m => m.name === modelName);
  if (!model) {
    throw new Error(`Model ${modelName} not found. Use /models to see available options.`);
  }
  currentModel = model;
  console.log(`🤖 Switched to ${model.name} (${model.tier} tier)`);
  return model;
}

/**
 * Select tier (free/paid/hybrid)
 */
export function selectTier(tier: ModelTier): void {
  currentTier = tier;
  if (tier === 'free') {
    currentModel = AVAILABLE_MODELS.find(m => m.name === 'qwen2.5:7b')!;
    console.log('💰 Switched to FREE tier - using Ollama local models');
    console.log('   Zero API costs - everything runs locally');
  } else if (tier === 'paid') {
    currentModel = AVAILABLE_MODELS.find(m => m.name === 'gpt-4o')!;
    console.log('💎 Switched to PAID tier - using OpenAI/Anthropic models');
    console.log('   Higher quality, faster for complex tasks');
    console.log('   Estimated cost: ~$0.50-2.00 per build');
  } else {
    console.log('🔄 Switched to HYBRID tier');
    console.log('   Simple tasks: Free (Ollama)');
    console.log('   Complex tasks: Paid (OpenAI/Anthropic)');
  }
}

/**
 * Get current model configuration
 */
export function getCurrentModel(): ModelConfig {
  return currentModel;
}

/**
 * Get current tier
 */
export function getCurrentTier(): ModelTier {
  return currentTier;
}

/**
 * Smart model selection based on task complexity
 */
export function selectModelForTask(_taskDescription: string, complexity: 'simple' | 'medium' | 'complex'): ModelConfig {
  if (currentTier === 'free') {
    // Always use free models
    if (complexity === 'simple') {
      return AVAILABLE_MODELS.find(m => m.name === 'qwen2.5:7b')!;
    } else if (complexity === 'medium') {
      return AVAILABLE_MODELS.find(m => m.name === 'qwen2.5:14b')!;
    } else {
      return AVAILABLE_MODELS.find(m => m.name === 'deepseek-coder:6.7b')!;
    }
  } else if (currentTier === 'paid') {
    // Always use paid models
    if (complexity === 'simple') {
      return AVAILABLE_MODELS.find(m => m.name === 'gpt-4o-mini')!;
    } else if (complexity === 'medium') {
      return AVAILABLE_MODELS.find(m => m.name === 'gpt-4o')!;
    } else {
      return AVAILABLE_MODELS.find(m => m.name === 'claude-3-opus')!;
    }
  } else {
    // Hybrid mode - choose based on complexity
    if (complexity === 'simple') {
      return AVAILABLE_MODELS.find(m => m.name === 'qwen2.5:7b')!;
    } else if (complexity === 'medium') {
      return AVAILABLE_MODELS.find(m => m.name === 'llama3:8b')!;
    } else {
      console.log('🤖 Complex task detected - upgrading to GPT-4o');
      return AVAILABLE_MODELS.find(m => m.name === 'gpt-4o')!;
    }
  }
}

/**
 * Call a single model (no fallback) — with circuit breaker tracking
 */
async function callSingleModel(
  model: ModelConfig,
  prompt: string,
  options: { temperature?: number; maxTokens?: number }
): Promise<string> {
  // Circuit breaker check
  if (!isModelAvailable(model.name)) {
    throw new Error(`Circuit breaker OPEN for ${model.name}`);
  }

  try {
    let result: string;
    if (model.provider === 'ollama') {
      const response = await callOllamaClient(prompt, '', model.name);
      result = response.content;
    } else if (model.provider === 'openai') {
      result = await callOpenAI(prompt, model.name, options);
    } else if (model.provider === 'anthropic') {
      result = await callAnthropic(prompt, model.name, options);
    } else {
      throw new Error(`Unknown provider: ${model.provider}`);
    }
    recordModelSuccess(model.name);
    return result;
  } catch (error) {
    recordModelFailure(model.name);
    throw error;
  }
}

/**
 * Main LLM call router — with cache-first check, circuit breaker, and automatic fallback
 */
export async function callLLM(
  prompt: string,
  options: {
    complexity?: 'simple' | 'medium' | 'complex';
    model?: string;
    temperature?: number;
    maxTokens?: number;
    disableFallback?: boolean;
    cache?: boolean; // Enable response caching (default: true)
    cacheMaxAgeHours?: number;
  } = {}
): Promise<string> {
  const complexity = options.complexity || 'medium';
  const useCache = options.cache !== false;

  // Select appropriate model
  let model: ModelConfig;
  if (options.model) {
    model = AVAILABLE_MODELS.find(m => m.name === options.model) || currentModel;
  } else {
    model = selectModelForTask(prompt, complexity);
  }

  // C-03: Cache-first check
  if (useCache) {
    const temperature = options.temperature ?? 0.7;
    const cached = getCachedResponse(prompt, model.name, temperature, options.cacheMaxAgeHours);
    if (cached) {
      console.log(`Router cache hit for ${model.name} — saved ${cached.tokensUsed} tokens`);
      return cached.response;
    }
  }

  // Try the primary model first
  try {
    const result = await callSingleModel(model, prompt, options);
    // Guard against empty/malformed responses
    if (!result || result.trim().length < 10) {
      throw new Error(`Empty or malformed response from ${model.name}`);
    }
    // Cache the result
    if (useCache) {
      cacheResponse(prompt, model.name, options.temperature ?? 0.7, result, result.length);
    }
    return result;
  } catch (primaryError: any) {
    if (options.disableFallback) throw primaryError;

    console.log(`Primary model ${model.name} failed: ${primaryError.message}`);
    console.log('Attempting fallback...');

    // Get fallback chain, skipping the model that just failed + circuit-broken models
    const chain = FALLBACK_CHAINS[currentTier]
      .filter(name => name !== model.name)
      .filter(name => isModelAvailable(name));

    for (const fallbackName of chain) {
      const fallbackModel = AVAILABLE_MODELS.find(m => m.name === fallbackName);
      if (!fallbackModel) continue;

      try {
        console.log(`Trying fallback: ${fallbackName}...`);
        const result = await callSingleModel(fallbackModel, prompt, options);
        if (!result || result.trim().length < 10) continue;
        console.log(`Fallback ${fallbackName} succeeded`);
        // Cache the fallback result
        if (useCache) {
          cacheResponse(prompt, fallbackModel.name, options.temperature ?? 0.7, result, result.length);
        }
        return result;
      } catch (fallbackError: any) {
        console.log(`Fallback ${fallbackName} failed: ${fallbackError.message}`);
      }
    }

    throw new Error(`All models failed. Primary: ${primaryError.message}`);
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
  prompt: string,
  modelName: string,
  options: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set. Use /tier free to use local models instead.');
  }
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }
  
  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
}

/**
 * Call Anthropic API
 */
async function callAnthropic(
  prompt: string,
  modelName: string,
  options: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set. Use /tier free to use local models instead.');
  }
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${error}`);
  }
  
  const data = await response.json() as { content: Array<{ text: string }> };
  return data.content[0].text;
}

/**
 * Show model comparison table
 */
export function showModelComparison(): void {
  console.log('\n📊 Model Comparison\n');
  
  console.log('FREE TIER (Ollama - Local)');
  console.log('─'.repeat(80));
  console.log('Model            Speed    Quality  Context  Cost');
  console.log('─'.repeat(80));
  AVAILABLE_MODELS
    .filter(m => m.tier === 'free')
    .forEach(m => {
      console.log(
        `${m.name.padEnd(16)} ${m.speed.padEnd(8)} ${m.quality.padEnd(8)} ${(m.contextWindow/1000 + 'k').padEnd(8)} Free`
      );
    });
  
  console.log('\nPAID TIER (OpenAI/Anthropic - API)');
  console.log('─'.repeat(80));
  console.log('Model            Speed    Quality  Context  Cost/1K tokens');
  console.log('─'.repeat(80));
  AVAILABLE_MODELS
    .filter(m => m.tier === 'paid')
    .forEach(m => {
      const cost = m.costPer1KTokens < 0.001 
        ? '$' + (m.costPer1KTokens * 1000).toFixed(2) + '¢'
        : '$' + m.costPer1KTokens.toFixed(4);
      console.log(
        `${m.name.padEnd(16)} ${m.speed.padEnd(8)} ${m.quality.padEnd(8)} ${(m.contextWindow/1000 + 'k').padEnd(8)} ${cost}`
      );
    });
  
  console.log('\n💡 Use /tier free|paid|hybrid to switch tiers');
  console.log('💡 Use /model <name> to select specific model');
}

/**
 * Estimate cost for a task
 */
export function estimateCost(tokenCount: number, modelName?: string): string {
  const model = modelName 
    ? AVAILABLE_MODELS.find(m => m.name === modelName) 
    : currentModel;
  
  if (!model || model.tier === 'free') {
    return 'Free (local model)';
  }
  
  const cost = (tokenCount / 1000) * model.costPer1KTokens;
  return `~$${cost.toFixed(4)}`;
}

// --- C-07: Circuit Breaker ---

interface CircuitState {
  failures: number;
  lastFailure: number;
  open: boolean; // true = model disabled
}

const CIRCUIT_BREAKER_THRESHOLD = 3;  // consecutive failures to open
const CIRCUIT_BREAKER_COOLDOWN = 60_000; // 60s before retry

const circuitStates = new Map<string, CircuitState>();

function getCircuitState(modelName: string): CircuitState {
  if (!circuitStates.has(modelName)) {
    circuitStates.set(modelName, { failures: 0, lastFailure: 0, open: false });
  }
  return circuitStates.get(modelName)!;
}

function recordModelFailure(modelName: string): void {
  const state = getCircuitState(modelName);
  state.failures++;
  state.lastFailure = Date.now();
  if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    state.open = true;
    console.log(`Circuit breaker OPEN for ${modelName} (${state.failures} consecutive failures)`);
  }
}

function recordModelSuccess(modelName: string): void {
  const state = getCircuitState(modelName);
  state.failures = 0;
  state.open = false;
}

function isModelAvailable(modelName: string): boolean {
  const state = getCircuitState(modelName);
  if (!state.open) return true;
  // Check if cooldown has elapsed — allow a retry
  if (Date.now() - state.lastFailure > CIRCUIT_BREAKER_COOLDOWN) {
    state.open = false;
    state.failures = 0;
    console.log(`Circuit breaker CLOSED for ${modelName} (cooldown elapsed)`);
    return true;
  }
  return false;
}

/** Get circuit breaker status for all models */
export function getCircuitBreakerStatus(): Record<string, { available: boolean; failures: number }> {
  const status: Record<string, { available: boolean; failures: number }> = {};
  for (const model of AVAILABLE_MODELS) {
    const state = getCircuitState(model.name);
    status[model.name] = { available: isModelAvailable(model.name), failures: state.failures };
  }
  return status;
}

/** Reset circuit breaker for a specific model */
export function resetCircuitBreaker(modelName?: string): void {
  if (modelName) {
    circuitStates.delete(modelName);
  } else {
    circuitStates.clear();
  }
}

// Note: Environment initialization is handled by the config system
// The currentTier is initialized from getConfig().models.tier on module load
