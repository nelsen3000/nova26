# Model Router with Fallback Chains

**Category:** 02-intelligence
**Type:** Strategy
**Tags:** llm, model-routing, fallback, ollama, openai, anthropic, cost, nova26

---

## Overview

The model router selects the appropriate LLM based on tier (free/paid/hybrid) and task complexity, then automatically falls back through a priority chain if the primary model fails. Supports Ollama (local), OpenAI, and Anthropic.

---

## Source

`src/llm/model-router.ts`

---

## Pattern

// Fallback chains — ordered by priority within each tier
const FALLBACK_CHAINS: Record<ModelTier, string[]> = {
  free:   ['qwen2.5:7b', 'qwen2.5:14b', 'llama3:8b', 'deepseek-coder:6.7b'],
  paid:   ['gpt-4o', 'claude-3-sonnet', 'gpt-4o-mini', 'claude-3-haiku'],
  hybrid: ['qwen2.5:7b', 'gpt-4o-mini', 'qwen2.5:14b', 'gpt-4o'],
};

export async function callLLM(prompt: string, options: { complexity?: 'simple' | 'medium' | 'complex'; model?: string } = {}): Promise<string> {
  const model = options.model
    ? AVAILABLE_MODELS.find(m => m.name === options.model) || currentModel
    : selectModelForTask(prompt, options.complexity || 'medium');

  // Try primary model
  try {
    const result = await callSingleModel(model, prompt, options);
    if (!result || result.trim().length < 10) throw new Error('Empty response');
    return result;
  } catch (primaryError: any) {
    console.log(`Primary model ${model.name} failed: ${primaryError.message}`);

    // Walk fallback chain
    const chain = FALLBACK_CHAINS[currentTier].filter(name => name !== model.name);
    for (const fallbackName of chain) {
      const fallbackModel = AVAILABLE_MODELS.find(m => m.name === fallbackName);
      if (!fallbackModel) continue;
      try {
        const result = await callSingleModel(fallbackModel, prompt, options);
        if (!result || result.trim().length < 10) continue;
        console.log(`Fallback ${fallbackName} succeeded`);
        return result;
      } catch { /* try next */ }
    }

    throw new Error(`All models failed. Primary: ${primaryError.message}`);
  }
}
```

```typescript
// Smart model selection by complexity
export function selectModelForTask(prompt: string, complexity: 'simple' | 'medium' | 'complex'): ModelConfig {
  if (currentTier === 'free') {
    return { simple: 'qwen2.5:7b', medium: 'qwen2.5:14b', complex: 'deepseek-coder:6.7b' }[complexity];
  }
  if (currentTier === 'paid') {
    return { simple: 'gpt-4o-mini', medium: 'gpt-4o', complex: 'claude-3-opus' }[complexity];
  }
  // Hybrid: free for simple/medium, paid for complex
  if (complexity === 'complex') {
    console.log('Complex task — upgrading to GPT-4o');
    return AVAILABLE_MODELS.find(m => m.name === 'gpt-4o')!;
  }
  return AVAILABLE_MODELS.find(m => m.name === 'qwen2.5:7b')!;
}
```

---

## Usage

```typescript
// Select tier at startup
selectTier('free');   // Zero cost, local Ollama
selectTier('paid');   // Higher quality, API costs
selectTier('hybrid'); // Smart routing by complexity

// Override via environment
NOVA26_TIER=paid NOVA26_MODEL=gpt-4o node dist/index.js

// Estimate cost before running
const cost = estimateCost(tokenCount, 'gpt-4o'); // "~$0.0025"
```

---

## Anti-Patterns

```typescript
// ❌ No fallback — single model failure stops everything
const response = await callOllama(prompt); // If Ollama is down, crash

// ✅ Good: Use fallback chain across tiers
const response = await callLLM(prompt); // Walks FALLBACK_CHAINS automatically

// ❌ Fallback to same tier — doesn't help if tier is unavailable
const chain = ['qwen2.5:7b', 'llama3:8b']; // Both Ollama — if Ollama is down, both fail

// ✅ Good: Mix tiers in hybrid chain
const chain = ['qwen2.5:7b', 'gpt-4o-mini', 'qwen2.5:14b']; // Local + API fallback

// ❌ No empty response guard
const result = await callSingleModel(model, prompt);
return result; // Returns empty string — downstream agents get blank input

// ✅ Good: Validate response length before returning
if (!result || result.trim().length < 10) throw new Error('Empty response');
```

---

## When to Use

- Multi-model deployments where different tasks need different capability levels
- Cost-conscious setups that prefer free local models but need paid fallbacks for complex tasks
- Any LLM integration that needs resilience against individual model failures

---

## Benefits

- Automatic failover across models — no single point of failure
- Cost optimization by routing simple tasks to free/local models
- Complexity-aware selection matches task difficulty to model capability
- Environment-driven tier configuration for flexible deployment

---

## Related Patterns

- `smart-retry-escalation.md` — Retry with model switching
- `llm-response-cache.md` — Cache to avoid redundant calls
- `../06-llm-integration/structured-output.md` — Structured output on top of routing
