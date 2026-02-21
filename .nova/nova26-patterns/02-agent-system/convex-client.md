# Convex Client

## Source
Extracted from Nova26 `src/orchestrator/convex-client.ts`

---

## Pattern: Lightweight HTTP Client Wrapper with Singleton and Logging Decorator

The Convex Client pattern provides a minimal HTTP wrapper around the Convex API with typed query/mutation methods, a health-check ping, a singleton accessor, and a higher-order function that decorates any LLM caller with automatic execution logging. The client is environment-configurable via `CONVEX_URL` and designed to be the single point of contact between the orchestrator and the Convex backend.

---

## Implementation

### Code Example

```typescript
import type { LLMResponse } from '../types/index.js';

const CONVEX_URL = process.env.CONVEX_URL || 'http://localhost:3000';

interface ConvexQueryResponse<T> {
  data?: T;
  error?: string;
}

interface ConvexMutationResponse<T> {
  data?: T;
  error?: string;
}

export class ConvexClient {
  public readonly url: string;

  constructor(url: string = CONVEX_URL) {
    this.url = url;
  }

  async query<T>(name: string, args: Record<string, any> = {}): Promise<T> {
    const response = await fetch(`${this.url}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: name, args }),
    });

    if (!response.ok) {
      throw new Error(`Convex query failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as ConvexQueryResponse<T>;
    if (result.error) {
      throw new Error(`Convex query error: ${result.error}`);
    }

    return result.data as T;
  }

  async mutation<T>(name: string, args: Record<string, any> = {}): Promise<T> {
    const response = await fetch(`${this.url}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: name, args }),
    });

    if (!response.ok) {
      throw new Error(`Convex mutation failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as ConvexMutationResponse<T>;
    if (result.error) {
      throw new Error(`Convex mutation error: ${result.error}`);
    }

    return result.data as T;
  }

  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.url}/api/health`, { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### Singleton and Availability Check

```typescript
let convexClientInstance: ConvexClient | null = null;

export function getConvexClient(): ConvexClient {
  if (!convexClientInstance) {
    convexClientInstance = new ConvexClient(CONVEX_URL);
  }
  return convexClientInstance;
}

export const convexClient = getConvexClient();

export async function isConvexAvailable(): Promise<boolean> {
  try {
    return await convexClient.ping();
  } catch {
    return false;
  }
}
```

### LLM Logging Decorator

```typescript
export function createConvexLoggingLLM(
  baseCaller: (systemPrompt: string, userPrompt: string, agentName?: string) => Promise<LLMResponse>,
  executionLogger?: (prompt: string, response: string, model: string, duration: number) => Promise<void>
): (systemPrompt: string, userPrompt: string, agentName?: string) => Promise<LLMResponse> {
  return async (
    systemPrompt: string,
    userPrompt: string,
    agentName?: string
  ): Promise<LLMResponse> => {
    const startTime = Date.now();
    const response = await baseCaller(systemPrompt, userPrompt, agentName);
    const duration = Date.now() - startTime;

    if (executionLogger) {
      try {
        await executionLogger(userPrompt, response.content, response.model, duration);
      } catch (err) {
        console.warn('Failed to log execution to Convex:', err);
      }
    }

    return response;
  };
}
```

### Key Concepts

- Generic `query<T>` and `mutation<T>` methods provide type-safe Convex access over HTTP
- Singleton pattern ensures one client instance per process
- `ping()` enables health checks without side effects
- `isConvexAvailable()` wraps ping with an extra catch for callers that don't want to handle exceptions
- `createConvexLoggingLLM` is a higher-order function (decorator) that wraps any LLM caller with timing and logging
- The logging decorator silently swallows logger failures — LLM calls always succeed even if logging breaks
- Environment variable `CONVEX_URL` with localhost fallback supports local dev and production

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Creating a new client on every call
async function queryConvex(name: string, args: any) {
  const client = new ConvexClient(); // New instance every time
  return client.query(name, args);
}

// Letting logging failures crash the LLM call
async function callWithLogging(prompt: string) {
  const response = await callLLM(prompt);
  await logToConvex(prompt, response); // If this throws, response is lost
  return response;
}
```

Multiple client instances waste resources. Logging failures should never discard a successful LLM response.

### ✅ Do This Instead

```typescript
// Singleton client
export const convexClient = getConvexClient();

// Decorator that isolates logging failures
const loggingLLM = createConvexLoggingLLM(baseCaller, async (prompt, response, model, duration) => {
  await logConvexExecution(taskId, agent, model, prompt, response, true, duration);
});
const result = await loggingLLM(systemPrompt, userPrompt, 'SUN');
// result is always returned, even if logging failed
```

---

## When to Use This Pattern

✅ **Use for:**
- Wrapping any HTTP-based backend API with typed query/mutation methods
- Adding observability (logging, timing) to LLM calls without coupling the caller to the logger
- Systems that need a health-check mechanism before attempting backend operations

❌ **Don't use for:**
- Direct Convex SDK usage in frontend apps (use the official Convex React hooks instead)
- High-throughput scenarios where HTTP overhead matters (use WebSocket-based Convex client)

---

## Benefits

1. Single point of contact — all Convex communication flows through one typed client
2. Singleton lifecycle — no wasted connections or redundant instances
3. Decorator pattern for logging — adds observability without modifying the LLM caller
4. Failure isolation — logging errors never propagate to the caller
5. Environment-configurable — `CONVEX_URL` switches between local and production with no code changes

---

## Related Patterns

- See `./atlas-convex.md` for the higher-level facade that uses this client for build/task/execution tracking
- See `../01-orchestration/ralph-loop-execution.md` for how the orchestrator uses the logging decorator during execution
- See `../../bistrolens-knowledge/01-convex-patterns/convex-file-storage.md` for Convex patterns in the BistroLens context

---

*Extracted: 2026-02-18*
