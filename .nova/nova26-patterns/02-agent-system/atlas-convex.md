# ATLAS Convex Integration

## Source
Extracted from Nova26 `src/orchestrator/atlas-convex.ts`

---

## Pattern: Graceful Backend Integration with Silent Degradation

The ATLAS Convex Integration pattern provides a typed facade over the Convex backend for build tracking, task logging, execution recording, pattern storage, and learning insights. Every function wraps its Convex call in a try/catch that logs a warning and returns a safe default (`null` or `[]`) when Convex is unavailable. This means the orchestrator can run fully offline — build tracking is a best-effort enhancement, never a hard dependency.

---

## Implementation

### Code Example

```typescript
import { convexClient } from './convex-client.js';

/**
 * Initialize a new build in Convex and return the build ID.
 * Returns null if Convex is unavailable.
 */
export async function startConvexBuild(prdId: string, prdName: string): Promise<string | null> {
  try {
    const client = convexClient;
    const buildId = await client.mutation<string>('atlas:startBuild', {
      prdId,
      prdName,
    });
    return buildId;
  } catch (error) {
    console.warn('Convex unavailable, skipping build tracking:', error);
    return null;
  }
}

/**
 * Mark a build as completed or failed.
 */
export async function completeConvexBuild(
  buildId: string,
  status: 'completed' | 'failed',
  error?: string
): Promise<void> {
  try {
    const client = convexClient;
    await client.mutation('atlas:completeBuild', {
      buildId,
      status,
      error,
    });
  } catch (err) {
    console.warn('Convex unavailable, skipping build completion:', err);
  }
}

/**
 * Log a task execution to Convex.
 * Returns null if Convex is unavailable.
 */
export async function logConvexTask(
  buildId: string,
  taskId: string,
  title: string,
  agent: string,
  status: 'pending' | 'ready' | 'running' | 'done' | 'failed' | 'blocked',
  dependencies: string[],
  phase: number
): Promise<string | null> {
  try {
    const client = convexClient;
    const convexTaskId = await client.mutation<string>('atlas:createTask', {
      buildId,
      taskId,
      title,
      agent,
      status,
      dependencies,
      phase,
      attempts: 0,
      createdAt: new Date().toISOString(),
    });
    return convexTaskId;
  } catch (err) {
    console.warn('Convex unavailable, skipping task log:', err);
    return null;
  }
}

/**
 * Log an LLM execution to Convex.
 */
export async function logConvexExecution(
  taskId: string,
  agent: string,
  model: string,
  prompt: string,
  response: string,
  gatesPassed: boolean,
  duration: number,
  error?: string
): Promise<string | null> {
  try {
    const client = convexClient;
    const executionId = await client.mutation<string>('atlas:logExecution', {
      taskId,
      agent,
      model,
      prompt,
      response,
      gatesPassed,
      duration,
      timestamp: new Date().toISOString(),
      error,
    });
    return executionId;
  } catch (err) {
    console.warn('Convex unavailable, skipping execution log:', err);
    return null;
  }
}

/**
 * Store a learned pattern in Convex.
 */
export async function storeConvexPattern(
  name: string,
  description: string,
  code: string,
  language: string,
  tags: string[]
): Promise<string | null> {
  try {
    const client = convexClient;
    const patternId = await client.mutation<string>('atlas:storePattern', {
      name,
      description,
      code,
      language,
      tags,
      createdAt: new Date().toISOString(),
    });
    return patternId;
  } catch (err) {
    console.warn('Convex unavailable, skipping pattern storage:', err);
    return null;
  }
}

/**
 * Query patterns from Convex.
 * Returns empty array if Convex is unavailable.
 */
export async function queryConvexPatterns(language?: string, tags?: string[]): Promise<any[]> {
  try {
    const client = convexClient;
    return await client.query('atlas:queryPatterns', { language, tags });
  } catch (err) {
    console.warn('Convex unavailable, returning empty patterns list:', err);
    return [];
  }
}
```

### Key Concepts

- Every public function follows the same shape: try the Convex call, catch and return a safe default
- Mutations return `string | null` (the created ID, or null on failure)
- Queries return `T | null` or `T[]` (empty array on failure)
- Void mutations silently swallow errors after logging a warning
- The module covers the full ATLAS lifecycle: builds → tasks → executions → patterns → learnings
- ISO timestamps are generated at call time, not delegated to the backend

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Hard dependency on Convex — crashes when backend is down
export async function startBuild(prdId: string, prdName: string): Promise<string> {
  const buildId = await convexClient.mutation<string>('atlas:startBuild', {
    prdId,
    prdName,
  });
  return buildId; // Throws if Convex is unreachable
}
```

If Convex is down, the entire orchestrator halts. Build tracking should never block task execution.

### ✅ Do This Instead

```typescript
// Graceful degradation — return null, log warning, keep running
export async function startConvexBuild(prdId: string, prdName: string): Promise<string | null> {
  try {
    return await convexClient.mutation<string>('atlas:startBuild', { prdId, prdName });
  } catch (error) {
    console.warn('Convex unavailable, skipping build tracking:', error);
    return null;
  }
}
```

The orchestrator continues without tracking. When Convex comes back, new calls succeed automatically.

---

## When to Use This Pattern

✅ **Use for:**
- Optional backend integrations that enhance but don't gate core functionality
- Telemetry, analytics, or logging systems that should never block the main workflow
- Any external service call where availability is not guaranteed

❌ **Don't use for:**
- Core data operations where failure must be surfaced to the user (e.g., saving user data)
- Transactions that require atomicity across multiple services

---

## Benefits

1. Offline-capable orchestrator — runs without Convex with zero code changes
2. Consistent error handling — every function follows the same try/catch/warn/default shape
3. Full lifecycle coverage — builds, tasks, executions, patterns, and learnings in one module
4. Type-safe API — generic `mutation<T>` and `query<T>` preserve return types
5. Zero-config recovery — when Convex comes back online, subsequent calls succeed automatically

---

## Related Patterns

- See `./convex-client.md` for the underlying HTTP client that this module wraps
- See `../01-orchestration/ralph-loop-execution.md` for the orchestration loop that calls these tracking functions
- See `../01-orchestration/event-store.md` for the local event store that complements Convex tracking

---

*Extracted: 2026-02-18*
