# Core Type Definitions

## Source
Extracted from Nova26 `src/types/index.ts`

---

## Pattern: Core Type Definitions

Nova26's shared type module provides a single source of truth for every data structure that flows through the multi-agent architecture. By centralizing `Task`, `PRD`, `AgentConfig`, `GateResult`, `BuildLog`, `LLMResponse`, and related interfaces in one file, every agent, gate, and orchestrator component imports the same contract — eliminating type drift and enabling compile-time safety across the entire system.

---

## Implementation

### Code Example

```typescript
// src/types/index.ts — Central type definitions for NOVA26

/**
 * Task — the fundamental unit of work in the Ralph Loop.
 * Every agent receives a Task, processes it, and returns output.
 * Status transitions: pending → ready → running → done | failed | blocked
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  agent: string;
  status: 'pending' | 'ready' | 'running' | 'done' | 'failed' | 'blocked';
  dependencies: string[];
  phase: number;
  attempts: number;
  createdAt: string;
  output?: string;
  error?: string;
  todos?: TodoItem[];
  currentTodoId?: string;
  context?: Record<string, unknown>;
}

/**
 * TodoItem — granular sub-steps within a Task.
 * Supports the TodoWrite pattern where complex tasks are
 * decomposed into trackable, verifiable items.
 */
export interface TodoItem {
  id: string;
  content: string;        // Imperative form: "Fix authentication bug"
  activeForm: string;     // Continuous form: "Fixing authentication bug"
  status: 'pending' | 'in_progress' | 'completed';
  agent: string;
  createdAt: string;
  completedAt?: string;
  verificationCriteria?: string[];
}

/**
 * PRD — the top-level container that the Ralph Loop iterates over.
 * Holds metadata and the full task graph.
 */
export interface PRD {
  meta: {
    name: string;
    version: string;
    createdAt: string;
  };
  tasks: Task[];
}

/**
 * BuildLog — immutable record of every LLM call and gate result.
 * Used by the ATLAS meta-learner for retrospectives.
 */
export interface BuildLog {
  id: string;
  taskId: string;
  agent: string;
  model: string;
  prompt: string;
  response: string;
  gatesPassed: boolean;
  duration: number;
  timestamp: string;
  error?: string;
}

/**
 * GateResult — output of a single quality gate check.
 * The gate-runner collects an array of these per task.
 */
export interface GateResult {
  gate: string;
  passed: boolean;
  message: string;
}

/**
 * LLMResponse — standardized return type from any model call.
 * Abstracts away provider differences (Ollama, OpenAI, etc.).
 */
export interface LLMResponse {
  content: string;
  model: string;
  duration: number;
  tokens: number;
}

/** Function signature for LLM callers (real or mock) */
export type LLMCaller = (
  systemPrompt: string,
  userPrompt: string,
  agentName?: string
) => Promise<LLMResponse>;

/**
 * AgentConfig — defines an agent's identity, model, and gate requirements.
 * Loaded by the agent-loader from markdown prompt templates.
 */
export interface AgentConfig {
  name: string;
  role: string;
  domain: string;
  systemPrompt: string;
  model: string;
  gates: string[];
}

/**
 * ModelConfig — per-model tuning parameters.
 * Used by the model-router to select and configure LLM calls.
 */
export interface ModelConfig {
  name: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
}

/**
 * GateConfig — declares a quality gate and its runtime settings.
 */
export interface GateConfig {
  name: string;
  type: 'response-validation' | 'mercury-validator' | 'typescript-check' | 'test-runner';
  enabled: boolean;
  config: Record<string, unknown>;
}

/**
 * HardLimit — enforcement rule that prevents agents from violating constraints.
 * Checked before every LLM dispatch.
 */
export interface HardLimit {
  name: string;
  pattern?: string;
  check?: string;
  severity: 'SEVERE' | 'WARNING';
  message: string;
}

export interface HardLimitsConfig {
  agents: Record<string, {
    limits: HardLimit[];
  }>;
}

/**
 * PlanningPhase — stages of the structured planning protocol.
 * Tasks pass through UNDERSTAND → CLARIFY → PLAN → APPROVE → EXECUTE → VERIFY → DELIVER.
 */
export interface PlanningPhase {
  name: 'UNDERSTAND' | 'CLARIFY' | 'PLAN' | 'APPROVE' | 'EXECUTE' | 'VERIFY' | 'DELIVER';
  actions: string[];
  exitCriteria: string;
}

/**
 * Checkpoint — a milestone requiring explicit validation before proceeding.
 */
export interface Checkpoint {
  milestone: string;
  confirmationRequired: boolean;
  validationCriteria: string[];
}

/**
 * Pattern — reusable code pattern stored by the ATLAS meta-learner.
 */
export interface Pattern {
  id: string;
  name: string;
  description: string;
  code: string;
  language: string;
  tags: string[];
  createdAt: string;
}
```

### How Types Flow Through the System

```typescript
// The orchestrator imports Task and PRD to drive the loop
import type { PRD, Task, LLMCaller } from '../types/index.js';

// The agent-loader imports AgentConfig to configure each agent
import type { AgentConfig } from '../types/index.js';

// The gate-runner imports GateResult and GateConfig
import type { GateResult, GateConfig } from '../types/index.js';

// The model-router imports ModelConfig and LLMResponse
import type { ModelConfig, LLMResponse } from '../types/index.js';

// The ATLAS logger imports BuildLog to persist execution history
import type { BuildLog } from '../types/index.js';

// Every consumer uses `import type` — zero runtime cost, full compile-time safety
```

### Key Concepts

- Single source of truth: all interfaces live in one file, imported everywhere via `import type`
- String literal unions for status fields enforce valid state transitions at compile time
- Optional fields (`output?`, `error?`, `todos?`) model the progressive enrichment of a Task as it moves through the pipeline
- The `LLMCaller` function type enables dependency injection — swap real LLM calls for mocks in tests without changing any interface
- `Record<string, unknown>` is used sparingly for truly dynamic config bags, keeping the rest strictly typed

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Duplicating type definitions across modules — leads to drift
// src/orchestrator/types.ts
interface Task {
  id: string;
  name: string;       // "name" here, "title" elsewhere — drift!
  status: string;     // Loose string — any typo compiles
  agent: string;
}

// src/gates/types.ts
interface GateResult {
  gateName: string;   // "gateName" here, "gate" elsewhere — drift!
  passed: boolean;
  msg: string;        // "msg" here, "message" elsewhere — drift!
}

// Using `any` for status fields
interface Task {
  status: any;         // No compile-time safety on transitions
}

// Using runtime enums instead of literal unions
enum TaskStatus {
  Pending = 'pending',
  Ready = 'ready',
  // Adds runtime overhead, harder to narrow in switch statements
}
```

### ✅ Do This Instead

```typescript
// Single shared module — one import, one contract
import type { Task, GateResult } from '../types/index.js';

// String literal unions — zero runtime cost, full type narrowing
interface Task {
  status: 'pending' | 'ready' | 'running' | 'done' | 'failed' | 'blocked';
}

// Exhaustive switch with compile-time completeness check
function handleStatus(task: Task): string {
  switch (task.status) {
    case 'pending':  return 'Waiting for dependencies';
    case 'ready':    return 'Ready to execute';
    case 'running':  return 'In progress';
    case 'done':     return 'Completed';
    case 'failed':   return 'Failed — check error field';
    case 'blocked':  return 'Blocked by dependency failure';
    // TypeScript errors if a case is missing — exhaustiveness guaranteed
  }
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Multi-module systems where the same data structures cross boundaries (orchestrator → agents → gates → persistence)
- Projects with 5+ consumers of the same interface — centralization prevents drift
- Systems that benefit from `import type` for zero-runtime-cost contracts

❌ **Don't use for:**
- Small single-file scripts where inline types are sufficient and a shared module adds unnecessary indirection

---

## Benefits

1. Type safety across the entire agent pipeline — a field rename in `Task` triggers compile errors in every consumer, catching drift instantly
2. Zero runtime overhead — `import type` is erased at compile time, so the shared module adds no bundle cost
3. Self-documenting architecture — reading `src/types/index.ts` gives a complete picture of every data structure in the system
4. Testability via function types — `LLMCaller` enables dependency injection, letting tests swap real LLM calls for deterministic mocks

---

## Related Patterns

- See `../01-orchestration/ralph-loop-execution.md` for how `Task` and `PRD` drive the core execution loop
- See `../01-orchestration/gate-runner-pipeline.md` for how `GateResult` and `GateConfig` are produced and consumed
- See `../02-agent-system/agent-loader.md` for how `AgentConfig` is populated from markdown prompt templates
- See `../06-llm-integration/model-router.md` for how `ModelConfig` and `LLMResponse` route calls across providers
- See `../01-orchestration/todo-tracking-system.md` for how `TodoItem` enables granular sub-task tracking
- See `../09-observability/tracer.md` for how `BuildLog` feeds into the observability pipeline

---

*Extracted: 2026-02-19*