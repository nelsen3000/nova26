# Observability Setup

## Source
Extracted from Nova26 `src/observability/index.ts`

---

## Pattern: Observability Module Initialisation and Configuration

The observability setup pattern defines how Nova26 bootstraps its tracing, logging, and metrics infrastructure through a single barrel module. The `index.ts` re-exports the tracer singleton and all public types, giving consumers a clean import surface while keeping internal wiring private. Configuration is entirely environment-driven — no config files, no constructor arguments — so the same code works in local dev (disabled), CI (disabled), and production (enabled) without changes.

---

## Implementation

### Code Example

```typescript
// src/observability/index.ts
// Barrel module — single import point for all observability concerns

export { NovaTracer, getTracer, type TraceHandle } from './tracer.js';
export type { CouncilVote, CouncilDecision } from './tracer.js';
```

```typescript
// Environment variables that control observability behaviour
// .env (production)
// LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxx
// LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxx
// LANGFUSE_HOST=https://cloud.langfuse.com   # optional, defaults to cloud
```

```typescript
// Consumer usage — the Ralph Loop orchestrator
import { getTracer } from '../observability/index.js';

async function runPrd(prdName: string, tasks: Task[]): Promise<void> {
  const tracer = getTracer();

  // Session covers the entire PRD run
  const sessionId = tracer.startSession(prdName);

  for (const task of tasks) {
    const trace = tracer.startTrace(sessionId, task.id, task.agent);

    try {
      const result = await executeTask(task);

      // Log LLM calls made during the task
      if (result.llmCalls) {
        for (const call of result.llmCalls) {
          tracer.logLLMCall(
            trace,
            call.prompt,
            call.response,
            call.model,
            call.durationMs,
            call.tokens,
          );
        }
      }

      // Log gate results
      for (const gate of result.gateResults) {
        tracer.logGateResult(trace, gate.name, gate.passed, gate.message);
      }

      tracer.endTrace(trace, 'done');
    } catch (error: any) {
      tracer.endTrace(trace, 'failed', error.message);
      throw error;
    }
  }

  // Flush before the process exits
  await tracer.flush();
}
```

### Key Concepts

- **Barrel re-export**: `index.ts` re-exports only the public API (`getTracer`, `NovaTracer`, types) so consumers never import from internal files.
- **Environment-driven configuration**: The tracer reads `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and optionally `LANGFUSE_HOST` from `process.env`. No config objects are passed around.
- **Lazy singleton**: `getTracer()` creates the `NovaTracer` on first call. Subsequent calls return the same instance, ensuring one Langfuse connection per process.
- **Flush-on-exit**: Callers must invoke `tracer.flush()` before the process terminates to ensure all buffered events reach the backend.
- **Type-only exports**: `CouncilVote` and `CouncilDecision` are exported as `type` to avoid runtime overhead and make the dependency tree clear.

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Scattering Langfuse initialisation across multiple modules
import { Langfuse } from 'langfuse';

// orchestrator.ts — creates its own client
const langfuse1 = new Langfuse({ publicKey: 'pk-...', secretKey: 'sk-...' });

// gate-runner.ts — creates another client
const langfuse2 = new Langfuse({ publicKey: 'pk-...', secretKey: 'sk-...' });

// Problems:
// 1. Duplicate connections waste resources
// 2. Credentials are hardcoded in multiple files
// 3. No central flush — events may be lost on exit
```

### ✅ Do This Instead

```typescript
// All modules import from the single barrel
import { getTracer } from '../observability/index.js';

// orchestrator.ts
const tracer = getTracer(); // shared singleton

// gate-runner.ts
const tracer = getTracer(); // same instance

// main.ts — flush once before exit
process.on('beforeExit', async () => {
  await getTracer().flush();
});
```

---

## When to Use This Pattern

✅ **Use for:**
- Bootstrapping observability in a multi-module TypeScript application
- Providing a single import surface for tracing, so consumers don't couple to the backend SDK
- Keeping credentials out of application code via environment variables

❌ **Don't use for:**
- Applications that need multiple independent tracing backends simultaneously (use a registry pattern instead)

---

## Benefits

1. **Single source of truth** — one barrel module controls what is public; internal refactors don't break consumers.
2. **Zero-config local dev** — without env vars the tracer silently disables itself; no setup needed for developers who don't use Langfuse.
3. **Resource efficiency** — the singleton ensures exactly one Langfuse connection regardless of how many modules import the tracer.
4. **Clean dependency graph** — type-only exports prevent runtime coupling between modules that only need the interfaces.
5. **Portable** — swapping Langfuse for another backend (OpenTelemetry, Datadog) requires changes only inside the `observability/` folder.

---

## Related Patterns

- See [`./tracer.md`](./tracer.md) for the full `NovaTracer` class implementation and event taxonomy
- See [`../01-orchestration/ralph-loop-execution.md`](../01-orchestration/ralph-loop-execution.md) for the primary consumer that creates sessions and traces
- See [`../06-llm-integration/model-router.md`](../06-llm-integration/model-router.md) for the model router whose LLM calls are recorded through the tracer
- See [`../08-security/security-scanner.md`](../08-security/security-scanner.md) for another module that follows the barrel-export pattern
- See [`../10-cost-management/cost-tracker.md`](../10-cost-management/cost-tracker.md) for the cost tracker that pairs with observability data

---

*Extracted: 2026-02-19*
