# Event Store

## Source
Extracted from Nova26 `src/orchestrator/event-store.ts`

---

## Pattern: Event Store

The Event Store implements an append-only, event-sourced durable session log. Every agent action — task starts, LLM calls, gate results, council votes — is recorded as a JSON event appended to a `.jsonl` file. A companion `.state.json` file tracks the current session state for fast resumption. This enables full replay of any session and crash-safe resumption from the last checkpoint.

---

## Implementation

### Code Example

```typescript
import { appendFileSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export type EventType =
  | 'session_start' | 'session_end'
  | 'task_start' | 'task_complete' | 'task_fail'
  | 'llm_call_start' | 'llm_call_complete' | 'llm_call_fail'
  | 'gate_start' | 'gate_pass' | 'gate_fail'
  | 'retry_start' | 'council_vote' | 'output_saved'
  | 'phase_promoted' | 'checkpoint';

export interface Event {
  id: string;
  timestamp: string;
  type: EventType;
  sessionId: string;
  taskId?: string;
  agent?: string;
  data: Record<string, unknown>;
}

export interface SessionState {
  sessionId: string;
  prdPath: string;
  startedAt: string;
  lastEventAt: string;
  completedTaskIds: string[];
  failedTaskIds: string[];
  currentTaskId: string | null;
  totalEvents: number;
  status: 'running' | 'completed' | 'failed' | 'interrupted';
}

const EVENTS_DIR = join(process.cwd(), '.nova', 'events');

export class EventStore {
  private sessionId: string;
  private eventFile: string;
  private stateFile: string;
  private state: SessionState;

  constructor(sessionId: string, prdPath: string) {
    this.sessionId = sessionId;
    if (!existsSync(EVENTS_DIR)) mkdirSync(EVENTS_DIR, { recursive: true });
    this.eventFile = join(EVENTS_DIR, `${sessionId}.jsonl`);
    this.stateFile = join(EVENTS_DIR, `${sessionId}.state.json`);
    this.state = {
      sessionId, prdPath,
      startedAt: new Date().toISOString(),
      lastEventAt: new Date().toISOString(),
      completedTaskIds: [], failedTaskIds: [],
      currentTaskId: null, totalEvents: 0, status: 'running',
    };
  }

  emit(type: EventType, data: Record<string, unknown> = {}, taskId?: string, agent?: string): Event {
    const event: Event = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      type, sessionId: this.sessionId, taskId, agent, data,
    };
    // Append to JSONL file (crash-safe: one line per event)
    appendFileSync(this.eventFile, JSON.stringify(event) + '\n');
    this.state.lastEventAt = event.timestamp;
    this.state.totalEvents++;
    if (type === 'task_complete' && taskId) this.state.completedTaskIds.push(taskId);
    if (type === 'task_fail' && taskId) this.state.failedTaskIds.push(taskId);
    if (type === 'session_end') this.state.status = data.success ? 'completed' : 'failed';
    this.saveState();
    return event;
  }

  checkpoint(description: string, prdSnapshot?: unknown): void {
    this.emit('checkpoint', {
      description,
      completedTasks: this.state.completedTaskIds.length,
      prdSnapshot: prdSnapshot ? JSON.stringify(prdSnapshot) : undefined,
    });
  }

  static resume(sessionId: string): { store: EventStore; completedTaskIds: string[] } | null {
    const state = EventStore.loadState(sessionId);
    if (!state) return null;
    const store = new EventStore(sessionId, state.prdPath);
    store.state = { ...state, status: 'running', lastEventAt: new Date().toISOString() };
    store.emit('session_start', { resumed: true, previousEvents: state.totalEvents });
    return { store, completedTaskIds: state.completedTaskIds };
  }

  static replay(sessionId: string): Event[] {
    const eventFile = join(EVENTS_DIR, `${sessionId}.jsonl`);
    if (!existsSync(eventFile)) return [];
    return readFileSync(eventFile, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as Event);
  }

  private saveState(): void {
    writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
  }
}
```

### Key Concepts

- Append-only JSONL log: each event is one JSON line, safe against partial writes on crash
- Separate state file: `.state.json` provides O(1) session status lookup without replaying the full log
- Checkpoint mechanism: explicit save points that mark resumption boundaries
- Typed event taxonomy: discriminated union of event types covers the full orchestration lifecycle

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Storing events in memory only — lost on crash
const events: Event[] = [];
function emit(event: Event) {
  events.push(event); // Gone if process dies
}
```

### ✅ Do This Instead

```typescript
// Append to disk immediately — crash-safe
appendFileSync(this.eventFile, JSON.stringify(event) + '\n');
this.saveState(); // Also persist derived state
```

---

## When to Use This Pattern

✅ **Use for:**
- Long-running orchestration sessions that must survive crashes
- Audit trails where every agent action needs to be recorded and replayable

❌ **Don't use for:**
- Short-lived, stateless request/response handlers where persistence overhead is unnecessary

---

## Benefits

1. Crash-safe resumption — sessions can resume from the last checkpoint without re-running completed tasks
2. Full audit trail — every LLM call, gate result, and council vote is recorded with timestamps
3. Replay capability — any session can be replayed event-by-event for debugging or analysis

---

## Related Patterns

- See `ralph-loop-execution.md` for the main loop that creates and emits events during task processing
- See `gate-runner-pipeline.md` for the gate events (`gate_start`, `gate_pass`, `gate_fail`) emitted during validation

---

*Extracted: 2025-07-15*
