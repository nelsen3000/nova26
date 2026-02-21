# Model Router

## Source
Extracted from Nova26 `src/llm/model-router.ts`

---

## Pattern: Multi-Tier Model Routing with Fallback Chains

The model router implements a three-tier strategy (free/paid/hybrid) for selecting LLM providers based on cost constraints and task complexity. Each tier defines an ordered fallback chain so that if the primary model fails or returns an empty response, the system automatically walks through alternatives without manual intervention. The hybrid tier routes simple tasks to free local models (Ollama) and upgrades to paid APIs (OpenAI/Anthropic) only for complex work.

---

## Implementation

### Code Example

```typescript
import { callLLM as callOllamaClient } from './ollama-client.js';

export type ModelTier = 'free' | 'paid' | 'hybrid';
export type ModelProvider = 'ollama' | 'openai' | 'anthropic';

export interface ModelConfig {
  name: string;
  provider: ModelProvider;
  tier: ModelTier;
  contextWindow: number;
  costPer1KTokens: number;
  speed: 'fast' | 'medium' | 'slow';
  quality: 'basic' | 'good' | 'excellent';
  bestFor: string[];
}

// Fallback chains — ordered by priority within each tier
const FALLBACK_CHAINS: Record<ModelTier, string[]> = {
  free: ['qwen2.5:7b', 'qwen2.5:14b', 'llama3:8b', 'deepseek-coder:6.7b', 'codellama:7b'],
  paid: ['gpt-4o', 'claude-3-sonnet', 'gpt-4o-mini', 'claude-3-haiku', 'o1-mini', 'claude-3-opus'],
  hybrid: ['qwen2.5:7b', 'gpt-4o-mini', 'qwen2.5:14b', 'gpt-4o', 'claude-3-sonnet'],
};

// Current model configuration — mutable state driven by env vars or CLI commands
let currentModel: ModelConfig = AVAILABLE_MODELS[0]; // Default: qwen2.5:7b
let currentTier: ModelTier = 'free';

/**
 * Smart model selection based on task complexity and current tier.
 * Hybrid mode uses free models for simple/medium tasks, paid for complex.
 */
export function selectModelForTask(
  _taskDescription: string,
  complexity: 'simple' | 'medium' | 'complex'
): ModelConfig {
  if (currentTier === 'free') {
    const map = { simple: 'qwen2.5:7b', medium: 'qwen2.5:14b', complex: 'deepseek-coder:6.7b' };
    return AVAILABLE_MODELS.find(m => m.name === map[complexity])!;
  }
  if (currentTier === 'paid') {
    const map = { simple: 'gpt-4o-mini', medium: 'gpt-4o', complex: 'claude-3-opus' };
    return AVAILABLE_MODELS.find(m => m.name === map[complexity])!;
  }
  // Hybrid: free for simple/medium, paid for complex
  if (complexity === 'complex') {
    return AVAILABLE_MODELS.find(m => m.name === 'gpt-4o')!;
  }
  if (complexity === 'medium') {
    return AVAILABLE_MODELS.find(m => m.name === 'llama3:8b')!;
  }
  return AVAILABLE_MODELS.find(m => m.name === 'qwen2.5:7b')!;
}

/**
 * Main LLM call router with automatic fallback on failure.
 * Guards against empty/malformed responses (< 10 chars).
 */
export async function callLLM(
  prompt: string,
  options: {
    complexity?: 'simple' | 'medium' | 'complex';
    model?: string;
    temperature?: number;
    maxTokens?: number;
    disableFallback?: boolean;
  } = {}
): Promise<string> {
  const model = options.model
    ? AVAILABLE_MODELS.find(m => m.name === options.model) || currentModel
    : selectModelForTask(prompt, options.complexity || 'medium');

  try {
    const result = await callSingleModel(model, prompt, options);
    if (!result || result.trim().length < 10) {
      throw new Error(`Empty or malformed response from ${model.name}`);
    }
    return result;
  } catch (primaryError: any) {
    if (options.disableFallback) throw primaryError;

    // Walk fallback chain, skipping the model that just failed
    const chain = FALLBACK_CHAINS[currentTier].filter(name => name !== model.name);
    for (const fallbackName of chain) {
      const fallbackModel = AVAILABLE_MODELS.find(m => m.name === fallbackName);
      if (!fallbackModel) continue;
      try {
        const result = await callSingleModel(fallbackModel, prompt, options);
        if (!result || result.trim().length < 10) continue;
        return result;
      } catch { /* try next in chain */ }
    }
    throw new Error(`All models failed. Primary: ${primaryError.message}`);
  }
}

/**
 * Estimate cost for a task before execution.
 */
export function estimateCost(tokenCount: number, modelName?: string): string {
  const model = modelName
    ? AVAILABLE_MODELS.find(m => m.name === modelName)
    : currentModel;
  if (!model || model.tier === 'free') return 'Free (local model)';
  const cost = (tokenCount / 1000) * model.costPer1KTokens;
  return `~$${cost.toFixed(4)}`;
}

// Initialize from environment if set
if (process.env.NOVA26_TIER) selectTier(process.env.NOVA26_TIER as ModelTier);
if (process.env.NOVA26_MODEL) selectModel(process.env.NOVA26_MODEL);
```

### Key Concepts

- **Three tiers**: `free` (Ollama local, zero cost), `paid` (OpenAI/Anthropic APIs), `hybrid` (auto-routes by complexity)
- **Fallback chains**: Each tier has an ordered list of models; on failure the router walks the chain sequentially
- **Empty response guard**: Responses shorter than 10 characters are treated as failures, triggering fallback
- **Environment-driven defaults**: `NOVA26_TIER` and `NOVA26_MODEL` env vars configure startup behavior
- **Cost estimation**: `estimateCost()` calculates token cost before execution for budget awareness
- **Provider-specific API calls**: `callOpenAI()` and `callAnthropic()` handle auth headers and response parsing per provider

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Single model, no fallback — one failure stops the entire pipeline
const response = await callOllama(prompt);
return response; // If Ollama is down, the whole build crashes

// Fallback within same provider — doesn't help if the provider is down
const chain = ['qwen2.5:7b', 'llama3:8b']; // Both Ollama — if Ollama is offline, both fail

// No empty response guard — downstream agents receive blank input
const result = await callSingleModel(model, prompt);
return result; // Could be "" or whitespace
```

### ✅ Do This Instead

```typescript
// Cross-provider fallback chain with empty response guard
const chain = FALLBACK_CHAINS[currentTier]; // Mixes providers in hybrid mode
for (const fallbackName of chain) {
  const fallbackModel = AVAILABLE_MODELS.find(m => m.name === fallbackName);
  if (!fallbackModel) continue;
  try {
    const result = await callSingleModel(fallbackModel, prompt, options);
    if (!result || result.trim().length < 10) continue; // Skip empty responses
    return result;
  } catch { /* try next */ }
}
throw new Error('All models failed');
```

---

## When to Use This Pattern

✅ **Use for:**
- Multi-provider LLM systems where availability of any single provider is not guaranteed
- Cost-sensitive applications that need to balance quality vs. expense (free local models for simple tasks, paid APIs for complex ones)
- Agent orchestrators that dispatch tasks of varying complexity to different models

❌ **Don't use for:**
- Single-model applications with no fallback requirements (direct API call is simpler)
- Latency-critical paths where walking a fallback chain adds unacceptable delay

---

## Benefits

1. **Zero-downtime LLM access** — automatic fallback ensures the pipeline never stalls on a single model failure
2. **Cost optimization** — hybrid tier routes simple tasks to free local models, reserving paid APIs for complex work
3. **Complexity-aware routing** — task complexity drives model selection, matching quality to need
4. **Environment-configurable** — tier and model can be set via env vars without code changes
5. **Provider-agnostic interface** — callers use a single `callLLM()` function regardless of which provider serves the request

---

## Related Patterns

- See `../06-llm-integration/ollama-client.md` for the local Ollama client that serves the free tier
- See `../06-llm-integration/response-cache.md` for caching responses to avoid redundant LLM calls
- See `../06-llm-integration/structured-output.md` for Zod-validated structured output on top of routing
- See `../10-cost-management/cost-tracker.md` for token cost monitoring across models

---

*Extracted: 2025-07-15*
