# Langfuse Tracing Integration

**Category:** 02-intelligence
**Type:** Pattern
**Tags:** observability, tracing, langfuse, llm, monitoring, nova26

---

## Overview

`NovaTracer` wraps Langfuse to provide structured observability for Ralph Loop executions. Traces LLM calls, gate results, and council votes per task. Gracefully degrades to no-op if Langfuse credentials are not configured.

---

## Source

`src/observability/tracer.ts`

---

## Pattern
  private langfuse: Langfuse | null = null;
  private enabled: boolean = false;

  constructor() {
    // Graceful initialization — no crash if unconfigured
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;

    if (!publicKey || !secretKey) {
      console.log('Langfuse not configured - observability disabled');
      return;
    }

    this.langfuse = new Langfuse({ publicKey, secretKey, baseUrl: process.env.LANGFUSE_HOST });
    this.enabled = true;
  }

  startSession(prdName: string): string | null {
    if (!this.enabled) return null;
    const session = this.langfuse!.trace({ name: `nova26-${prdName}`, metadata: { prdName } });
    return session.id;
  }

  startTrace(sessionId: string | null, taskId: string, agent: string): TraceHandle | null {
    if (!this.enabled || !sessionId) return null;
    const trace = this.langfuse!.trace({ name: `task-${taskId}`, sessionId, metadata: { taskId, agent } });
    return { id: trace.id, name: `task-${taskId}` };
  }

  logLLMCall(trace: TraceHandle | null, input: string, output: string, model: string, duration: number, tokens: number): void {
    if (!this.enabled || !trace) return;
    this.langfuse!.trace({ id: trace.id }).generation({
      name: 'llm-call', model,
      input: { prompt: input.substring(0, 1000) },
      output: { response: output.substring(0, 1000) },
      metadata: { duration, tokens },
    });
  }

  logGateResult(trace: TraceHandle | null, gate: string, passed: boolean, message: string): void {
    if (!this.enabled || !trace) return;
    this.langfuse!.trace({ id: trace.id }).span({ name: `gate-${gate}`, metadata: { gate, passed, message } });
  }

  async flush(): Promise<void> {
    if (!this.enabled) return;
    await this.langfuse!.flushAsync();
  }
}

// Singleton
export function getTracer(): NovaTracer {
  if (!tracerInstance) tracerInstance = new NovaTracer();
  return tracerInstance;
}
```

---

## Usage

```typescript
// In Ralph Loop
const tracer = getTracer();
const sessionId = tracer.startSession(prd.meta.name);

// Per task
const trace = tracer.startTrace(sessionId, task.id, task.agent);
tracer.logLLMCall(trace, userPrompt, response.content, response.model, response.duration, response.tokens);
tracer.logGateResult(trace, 'mercury-validator', true, 'Validation passed');
tracer.endTrace(trace, 'done');

// Flush before exit
await tracer.flush();
```

```bash
# Enable tracing
LANGFUSE_PUBLIC_KEY=pk-lf-... LANGFUSE_SECRET_KEY=sk-lf-... node dist/index.js
```

---

## Anti-Patterns

```typescript
// ❌ Crash if Langfuse unavailable
this.langfuse = new Langfuse({ publicKey, secretKey }); // Throws if keys missing
// Should check keys first and set enabled = false

// ✅ Good: Gracefully disable when keys are missing
const enabled = !!(publicKey && secretKey);
if (!enabled) console.log('Langfuse disabled — no keys configured');

// ❌ Logging full prompts — PII exposure
input: { prompt: input }, // Full prompt may contain sensitive data
// Should truncate: input.substring(0, 1000)

// ✅ Good: Truncate inputs to avoid PII leaks
input: { prompt: input.substring(0, 1000) },

// ❌ Not flushing before exit — events lost
process.exit(0); // Without await tracer.flush() — buffered events dropped

// ✅ Good: Always flush before shutdown
await tracer.flush();
process.exit(0);
```

---

## When to Use

- Debugging agent failures by tracing the full LLM call chain per task
- Monitoring token usage and latency across models in production
- Auditing gate results and council votes for quality assurance

---

## Benefits

- Full observability into multi-agent orchestration without code changes
- Graceful degradation — zero impact when Langfuse is not configured
- Hierarchical session/trace/span structure maps naturally to Ralph Loop execution
- PII-safe truncation of prompts and responses

---

## Related Patterns

- `../01-orchestration/ralph-loop-execution.md` — Tracer used throughout processTask
- `checkpoint-system.md` — Persistent state (complements tracing)
- `session-memory-relevance.md` — Memory (separate from traces)
