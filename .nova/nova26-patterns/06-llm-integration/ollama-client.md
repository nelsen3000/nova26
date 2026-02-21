# Ollama Client

## Source
Extracted from Nova26 `src/llm/ollama-client.ts`

---

## Pattern: Local LLM Client Wrapper for Ollama

The Ollama client provides a typed wrapper around the Ollama REST API for running LLMs locally. It maps Nova26 agents to specific models (e.g., SUN → `qwen2.5:14b`, MARS → `qwen2.5:7b`), manages per-model configuration (temperature, max tokens, timeout), and provides connection health checks. This is the foundation of the free tier — all local model calls flow through this client.

---

## Implementation

### Code Example

```typescript
import type { LLMResponse, ModelConfig } from '../types/index.js';

const DEFAULT_MODEL = 'qwen2.5:7b';
const OLLAMA_HOST = 'http://localhost:11434';

// Function type for LLM calls (allows mocking in tests)
export type LLMCaller = (
  systemPrompt: string,
  userPrompt: string,
  agentName?: string
) => Promise<LLMResponse>;

const modelConfigs: Record<string, ModelConfig> = {
  'qwen2.5:7b': { name: 'qwen2.5:7b', temperature: 0.7, maxTokens: 4096, timeout: 120000 },
  'qwen2.5:14b': { name: 'qwen2.5:14b', temperature: 0.7, maxTokens: 8192, timeout: 180000 },
  'llama3:8b': { name: 'llama3:8b', temperature: 0.7, maxTokens: 4096, timeout: 120000 },
};

/**
 * Call Ollama with system + user prompt, routed by agent name.
 * Returns typed LLMResponse with content, model, duration, and token count.
 */
export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  agentName?: string
): Promise<LLMResponse> {
  const startTime = Date.now();
  const model = getModelForAgent(agentName || 'default');
  const config = modelConfigs[model] || modelConfigs[DEFAULT_MODEL];

  const payload = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: false,
  };

  try {
    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      message?: { content?: string };
      eval_count?: number;
    };

    return {
      content: data.message?.content || '',
      model,
      duration: Date.now() - startTime,
      tokens: data.eval_count || 0,
    };
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Ollama is not running. Start it with: ollama serve');
    }
    throw error;
  }
}

/**
 * Map agent names to specific models.
 * Orchestrator agents (SUN, JUPITER) get larger models;
 * worker agents get the default smaller model.
 */
export function getModelForAgent(agentName: string): string {
  const agentModels: Record<string, string> = {
    SUN: 'qwen2.5:14b',
    JUPITER: 'qwen2.5:14b',
    PLUTO: 'qwen2.5:7b',
    MERCURY: 'qwen2.5:7b',
    EARTH: 'qwen2.5:7b',
    MARS: 'qwen2.5:7b',
    VENUS: 'qwen2.5:7b',
  };
  return agentModels[agentName] || DEFAULT_MODEL;
}

/**
 * List all configured model names for discovery.
 */
export function listAvailableModels(): string[] {
  return Object.keys(modelConfigs);
}

/**
 * Health check — verifies Ollama is reachable with a 5-second timeout.
 */
export async function checkOllamaConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
```

### Key Concepts

- **Agent-to-model mapping**: Each Nova26 agent is assigned a model suited to its workload (orchestrators get larger models)
- **Per-model configuration**: Temperature, max tokens, and timeout are tuned per model variant
- **Connection error detection**: `ECONNREFUSED` is caught and surfaced as a user-friendly message
- **Typed responses**: Returns `LLMResponse` with content, model name, duration, and token count for downstream tracking
- **Mockable interface**: The `LLMCaller` type allows test doubles without modifying production code
- **Model discovery**: `listAvailableModels()` exposes configured model names for CLI display and validation

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Hardcoded model for all agents — no differentiation by workload
const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
  body: JSON.stringify({ model: 'qwen2.5:7b', messages, stream: false }),
});
// SUN (orchestrator) gets the same small model as VENUS (UI worker)

// No connection check — cryptic ECONNREFUSED error reaches the user
const data = await fetch(`${OLLAMA_HOST}/api/chat`, { ... });
// Error: fetch failed — user has no idea Ollama isn't running

// No timeout — large model hangs indefinitely
const response = await fetch(url, { body: JSON.stringify(payload) });
// qwen2.5:14b takes 5 minutes, no abort signal, CLI appears frozen
```

### ✅ Do This Instead

```typescript
// Agent-specific model selection with per-model timeouts
const model = getModelForAgent(agentName); // SUN → 14b, MARS → 7b
const config = modelConfigs[model];        // timeout: 180000 for 14b

// Friendly connection error
try {
  const response = await fetch(`${OLLAMA_HOST}/api/chat`, { ... });
} catch (error: any) {
  if (error.code === 'ECONNREFUSED') {
    throw new Error('Ollama is not running. Start it with: ollama serve');
  }
  throw error;
}

// Health check before starting a build
const isUp = await checkOllamaConnection();
if (!isUp) console.log('⚠️ Ollama is offline — free tier unavailable');
```

---

## When to Use This Pattern

✅ **Use for:**
- Running LLMs locally with zero API cost during development and prototyping
- Multi-agent systems where different agents need different model sizes
- Environments where internet access is unreliable and local inference is preferred

❌ **Don't use for:**
- Production deployments requiring guaranteed uptime (Ollama is a local dev tool)
- Tasks requiring models not available in Ollama's model library

---

## Benefits

1. **Zero cost** — all inference runs locally, no API keys or billing required
2. **Agent-aware routing** — orchestrator agents automatically get larger, more capable models
3. **Typed interface** — `LLMResponse` provides structured output with duration and token metrics
4. **Graceful failure** — connection errors produce actionable messages instead of raw stack traces
5. **Testable** — `LLMCaller` type enables dependency injection for unit testing

---

## Related Patterns

- See `../06-llm-integration/model-router.md` for the multi-tier routing layer that dispatches to this client
- See `../06-llm-integration/structured-output.md` for Zod schema validation on top of Ollama responses
- See `../06-llm-integration/response-cache.md` for caching responses to avoid redundant local inference
- See `../02-agent-system/agent-loader.md` for how agents are loaded and dispatched to the LLM

---

*Extracted: 2025-07-15*
