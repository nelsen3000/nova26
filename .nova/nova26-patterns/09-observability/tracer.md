# Tracer

## Source
Extracted from Nova26 `src/observability/tracer.ts`

---

## Pattern: Distributed Tracing for Agent Orchestration

The NovaTracer pattern wraps a third-party tracing backend (Langfuse) behind a gracefully-degrading singleton that tracks every meaningful event in the Ralph Loop: task execution, LLM generations, quality-gate results, and council votes. Each event is attached to a hierarchical session → trace → span/generation tree so operators can drill from a high-level PRD run down to an individual LLM call.

The key design choice is **silent degradation** — every public method is a no-op when the backend is unavailable, so the rest of the system never needs to guard against observability failures.

---

## Implementation

### Code Example

```typescript
import { Langfuse } from 'langfuse';

// --- Types ---

export interface TraceHandle {
  id: string;
  name: string;
}

export interface CouncilVote {
  member: string;
  verdict?: 'approve' | 'reject' | 'abstain';
  vote?: 'approve' | 'reject' | 'abstain';
  reasoning?: string;
  confidence?: number;
}

export interface CouncilDecision {
  finalVerdict: 'approved' | 'rejected' | 'pending' | 'deadlock';
  summary: string;
  votes: CouncilVote[];
}

// --- Tracer ---

export class NovaTracer {
  private langfuse: Langfuse | null = null;
  private enabled: boolean = false;

  constructor() {
    this.initialize();
  }

  /** Initialise Langfuse from env vars; silently disable on failure. */
  private initialize(): void {
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const host = process.env.LANGFUSE_HOST;

    if (!publicKey || !secretKey) {
      console.log('Langfuse not configured — observability disabled');
      return;
    }

    try {
      this.langfuse = new Langfuse({
        publicKey,
        secretKey,
        baseUrl: host || 'https://cloud.langfuse.com',
      });
      this.enabled = true;
    } catch (error: any) {
      console.warn(`Failed to initialize Langfuse: ${error.message}`);
      this.enabled = false;
    }
  }

  /** Start a session-level trace for an entire PRD run. */
  public startSession(prdName: string): string | null {
    if (!this.enabled || !this.langfuse) return null;

    try {
      const session = this.langfuse.trace({
        name: `nova26-${prdName}`,
        metadata: { prdName, startedAt: new Date().toISOString() },
      });
      return session.id;
    } catch (error: any) {
      console.warn(`Failed to start session: ${error.message}`);
      return null;
    }
  }

  /** Start a child trace for a single task within a session. */
  public startTrace(
    sessionId: string | null,
    taskId: string,
    agent: string,
  ): TraceHandle | null {
    if (!this.enabled || !this.langfuse || !sessionId) return null;

    try {
      const trace = this.langfuse.trace({
        name: `task-${taskId}`,
        sessionId,
        metadata: { taskId, agent },
      });
      return { id: trace.id, name: `task-${taskId}` };
    } catch (error: any) {
      console.warn(`Failed to start trace: ${error.message}`);
      return null;
    }
  }

  /** Record an LLM generation with model, duration, and token count. */
  public logLLMCall(
    trace: TraceHandle | null,
    input: string,
    output: string,
    model: string,
    duration: number,
    tokens: number,
  ): void {
    if (!this.enabled || !this.langfuse || !trace) return;

    try {
      this.langfuse.trace({ id: trace.id }).generation({
        name: 'llm-call',
        model,
        input: { prompt: input.substring(0, 1000) },
        output: { response: output.substring(0, 1000) },
        metadata: { duration, tokens },
      });
    } catch (error: any) {
      console.warn(`Failed to log LLM call: ${error.message}`);
    }
  }

  /** Record a quality-gate span (pass/fail + message). */
  public logGateResult(
    trace: TraceHandle | null,
    gate: string,
    passed: boolean,
    message: string,
  ): void {
    if (!this.enabled || !this.langfuse || !trace) return;

    try {
      this.langfuse.trace({ id: trace.id }).span({
        name: `gate-${gate}`,
        metadata: { gate, passed, message: message.substring(0, 500) },
      });
    } catch (error: any) {
      console.warn(`Failed to log gate result: ${error.message}`);
    }
  }

  /** Record council votes and the final decision. */
  public logCouncilVote(
    trace: TraceHandle | null,
    votes: CouncilVote[],
    decision: CouncilDecision,
  ): void {
    if (!this.enabled || !this.langfuse || !trace) return;

    try {
      this.langfuse.trace({ id: trace.id }).span({
        name: 'council-vote',
        metadata: {
          votes: votes.map((v) => ({ member: v.member, verdict: v.verdict })),
          finalVerdict: decision.finalVerdict,
          summary: decision.summary.substring(0, 500),
        },
      });
    } catch (error: any) {
      console.warn(`Failed to log council vote: ${error.message}`);
    }
  }

  /** Mark a trace as done or failed. */
  public endTrace(
    trace: TraceHandle | null,
    status: 'done' | 'failed',
    error?: string,
  ): void {
    if (!this.enabled || !this.langfuse || !trace) return;

    try {
      this.langfuse.trace({ id: trace.id }).update({
        metadata: { status, error: error?.substring(0, 500), endedAt: new Date().toISOString() },
      });
    } catch (error: any) {
      console.warn(`Failed to end trace: ${error.message}`);
    }
  }

  /** Flush pending events — call before process exit. */
  public async flush(): Promise<void> {
    if (!this.enabled || !this.langfuse) return;

    try {
      await this.langfuse.flushAsync();
    } catch (error: any) {
      console.warn(`Failed to flush Langfuse: ${error.message}`);
    }
  }
}

// --- Singleton ---

let tracerInstance: NovaTracer | null = null;

export function getTracer(): NovaTracer {
  if (!tracerInstance) {
    tracerInstance = new NovaTracer();
  }
  return tracerInstance;
}
```

### Key Concepts

- **Session → Trace → Span hierarchy**: A session covers an entire PRD run, traces cover individual tasks, and spans/generations cover gates, council votes, and LLM calls within a task.
- **Graceful degradation**: Every method checks `this.enabled` and `this.langfuse` before acting. Missing env vars or Langfuse errors never crash the system.
- **Singleton access**: `getTracer()` lazily creates one `NovaTracer` instance so all modules share the same Langfuse connection.
- **Payload truncation**: Prompts and responses are truncated to 1 000 characters, gate messages to 500, preventing oversized payloads.
- **Typed event vocabulary**: Separate methods for LLM calls (`generation`), gate results (`span`), and council votes (`span`) give each event type its own schema.

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Letting a tracing failure crash the task
class BadTracer {
  private langfuse: Langfuse;

  logLLMCall(traceId: string, prompt: string, response: string): void {
    // No null check — throws if Langfuse is not configured
    this.langfuse.trace({ id: traceId }).generation({
      name: 'llm-call',
      input: { prompt },          // No truncation — huge payloads
      output: { response },
    });
    // No try/catch — network error kills the caller
  }
}
```

### ✅ Do This Instead

```typescript
class GoodTracer {
  private langfuse: Langfuse | null = null;
  private enabled: boolean = false;

  logLLMCall(trace: TraceHandle | null, prompt: string, response: string): void {
    if (!this.enabled || !this.langfuse || !trace) return; // silent no-op

    try {
      this.langfuse.trace({ id: trace.id }).generation({
        name: 'llm-call',
        input: { prompt: prompt.substring(0, 1000) },   // truncated
        output: { response: response.substring(0, 1000) },
      });
    } catch (error: any) {
      console.warn(`Trace failed: ${error.message}`);    // warn, don't throw
    }
  }
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Tracking the full lifecycle of a Ralph Loop PRD run (session → tasks → LLM calls)
- Recording quality-gate pass/fail results with timing metadata
- Capturing council voting outcomes for post-mortem analysis
- Measuring LLM latency and token usage across models

❌ **Don't use for:**
- High-frequency, sub-millisecond instrumentation (use lightweight counters instead)
- Replacing structured application logs — the tracer captures events, not log lines

---

## Benefits

1. **Zero-impact when disabled** — the entire system runs identically without Langfuse credentials; no conditional logic needed in callers.
2. **Hierarchical drill-down** — operators can navigate from a PRD session to a specific LLM generation in the Langfuse UI.
3. **Bounded payload size** — truncation guards prevent runaway storage costs and API timeouts.
4. **Single integration point** — all observability flows through one singleton, making it easy to swap backends later.
5. **Rich event taxonomy** — separate methods for LLM calls, gates, and council votes produce well-typed, queryable traces.

---

## Related Patterns

- See [`../01-orchestration/ralph-loop-execution.md`](../01-orchestration/ralph-loop-execution.md) for the orchestration loop that creates sessions and traces
- See [`../01-orchestration/gate-runner-pipeline.md`](../01-orchestration/gate-runner-pipeline.md) for the gate execution pipeline whose results are logged via `logGateResult`
- See [`../06-llm-integration/model-router.md`](../06-llm-integration/model-router.md) for the model routing layer whose calls are recorded via `logLLMCall`
- See [`./observability-setup.md`](./observability-setup.md) for the module initialisation and export pattern
- See [`../10-cost-management/cost-tracker.md`](../10-cost-management/cost-tracker.md) for the cost tracking system that consumes token counts from traces

---

*Extracted: 2026-02-19*
