# Kimi R26: Lifecycle Adapters & Cross-Module Integration
## 7 Tasks | TypeScript Strict | ESM `.js` Imports

> **You are**: Kimi (kimi-k2), the implementation engine for Nova26 — a 21-agent AI-powered IDE.
> **Your role**: Build lifecycle adapter functions for 7 new modules so the Ralph Loop can call them during builds.
> **Repo**: https://github.com/nelsen3000/nova26
> **Branch**: `main`
> **Current state**: 4,552 tests passing, 0 TS errors, 158 test files
> **Rules**: TypeScript strict, ESM `.js` imports everywhere, vitest for tests, no `any` (use `unknown` + type guards), mock all I/O

---

## Context: What Are Lifecycle Adapters?

Nova26's Ralph Loop orchestrates builds by firing **lifecycle events** through a hook registry:
- `onBeforeBuild` — before a build starts
- `onBeforeTask` — before each agent task
- `onAfterTask` — after each agent task completes
- `onTaskError` — when a task fails
- `onHandoff` — when work passes between agents
- `onBuildComplete` — after a build finishes

Each feature module needs **adapter functions** that handle these events. The lifecycle wiring system (`src/orchestrator/lifecycle-wiring.ts`) already has hook configs registered for your 7 modules — but the actual handler implementations don't exist yet. That's what you're building.

### How It Works

```
Ralph Loop fires event → HookRegistry → lifecycle-wiring → YOUR ADAPTER → module logic
```

Your adapter file exports a `createXxxLifecycleHooks()` function returning `FeatureLifecycleHandlers`:

```typescript
import type { FeatureLifecycleHandlers } from '../../orchestrator/lifecycle-wiring.js';
import type { BuildContext, TaskContext, TaskResult } from '../../orchestrator/lifecycle-hooks.js';

export function createModelRoutingLifecycleHooks(
  config: ModelRoutingConfig
): FeatureLifecycleHandlers {
  return {
    onBeforeBuild: async (ctx: BuildContext) => {
      // Initialize model routing for this build
    },
    onBeforeTask: async (ctx: TaskContext) => {
      // Select model for this agent's task
    },
  };
}
```

### Registered Hook Configs (already in lifecycle-wiring.ts)

| Module | Phases | Priority |
|--------|--------|----------|
| modelRouting | onBeforeBuild, onBeforeTask | 42 |
| perplexity | onBeforeTask, onAfterTask | 65 |
| workflowEngine | onBeforeBuild, onAfterTask, onBuildComplete | 38 |
| infiniteMemory | onAfterTask, onBuildComplete | 48 |
| cinematicObservability | ALL 6 phases | 8 |
| aiModelDatabase | onBeforeBuild, onBeforeTask | 44 |
| crdtCollaboration | onBeforeBuild, onAfterTask, onBuildComplete | 52 |

---

## Key Files to Reference

```
src/orchestrator/lifecycle-hooks.ts      ← HookRegistry, context types (BuildContext, TaskContext, etc.)
src/orchestrator/lifecycle-wiring.ts     ← FeatureLifecycleHandlers, DEFAULT_FEATURE_HOOKS, wireFeatureHooks()
src/orchestrator/ralph-loop-types.ts     ← RalphLoopOptions (config fields for all modules)

src/model-routing/                       ← ModelRouter, ModelRegistry, HardwareDetector
src/tools/perplexity/                    ← PerplexityAgent, search/research functions
src/workflow-engine/                     ← RalphVisualEngine, RalphLoopVisualAdapter
src/atlas/infinite-memory-core.ts        ← InfiniteMemoryCore, 4-level hierarchy
src/observability/cinematic-core.ts      ← CinematicCore, span/trace lifecycle
src/models/                              ← AIModelVault, ModelRouter, EnsembleEngine
src/collaboration/crdt-core.ts           ← CRDTCore, session management
```

---

## Tasks (Do Them In Order)

### KIMI-R26-01: Model Routing Lifecycle Adapter
**File**: `src/model-routing/lifecycle-adapter.ts`
**Test file**: `src/model-routing/__tests__/lifecycle-adapter.test.ts`
**Tests**: 25+

Create lifecycle hooks for the model routing module:

**onBeforeBuild**: Initialize `ModelRouter` and `ModelRegistry` from config. Detect hardware. Store router instance for the build session.

**onBeforeTask**: Route the task to the best model based on `agentName` and task description. Log the routing decision. If speculative decoding is available, set it up.

Implementation:
```typescript
export function createModelRoutingLifecycleHooks(
  config: ModelRoutingConfig
): FeatureLifecycleHandlers
```

Test:
- onBeforeBuild initializes router with config
- onBeforeTask routes correctly for different agent/task combos
- Hardware detection influences routing
- Fallback chain works when primary model unavailable
- Config changes are respected between builds

---

### KIMI-R26-02: Perplexity Research Lifecycle Adapter
**File**: `src/tools/perplexity/lifecycle-adapter.ts`
**Test file**: `src/tools/perplexity/__tests__/lifecycle-adapter.test.ts`
**Tests**: 20+

**onBeforeTask**: Check if the task would benefit from research (keywords: "research", "analyze", "compare", "evaluate", "find", "investigate"). If so, prepare a research context object with suggested queries.

**onAfterTask**: If research was used, log the research results and their relevance score. Store useful findings in a research cache for future tasks.

Test:
- Research detection triggers on relevant keywords
- Non-research tasks skip Perplexity
- Research context includes relevant queries
- After-task logging captures results
- Research cache persists across tasks in same build

---

### KIMI-R26-03: Workflow Engine Lifecycle Adapter
**File**: `src/workflow-engine/lifecycle-adapter.ts`
**Test file**: `src/workflow-engine/__tests__/lifecycle-adapter.test.ts`
**Tests**: 25+

**onBeforeBuild**: Initialize the visual workflow engine. Create a workflow graph from the PRD tasks. Set up the Ralph Loop visual adapter.

**onAfterTask**: Update the workflow node status (pending → running → completed/failed). Record task duration and output. Trigger any downstream workflow transitions.

**onBuildComplete**: Generate the final workflow summary. Calculate critical path. Log total build metrics.

Test:
- Workflow graph created from build context
- Task status transitions are correct
- Downstream transitions fire after task completion
- Build summary includes all tasks
- Critical path calculation works
- Failed tasks mark downstream as blocked

---

### KIMI-R26-04: Infinite Memory Lifecycle Adapter
**File**: `src/atlas/lifecycle-adapter.ts`
**Test file**: `src/atlas/__tests__/lifecycle-adapter.test.ts`
**Tests**: 25+

**onAfterTask**: Store task results as memory nodes. Classify by hierarchy level (scene for individual tasks, project for related task groups). Calculate taste score. Link to parent nodes if context available.

**onBuildComplete**: Create a project-level summary node. Link all task nodes as children. Update portfolio-level stats. Prune stale nodes if memory exceeds configured limits.

Test:
- Task results stored as scene-level nodes
- Hierarchy relationships maintained
- Taste scores calculated correctly
- Build summary creates project-level node
- Pruning respects configured limits
- Memory persists across builds (mock persistence)

---

### KIMI-R26-05: Cinematic Observability Lifecycle Adapter
**File**: `src/observability/lifecycle-adapter.ts`
**Test file**: `src/observability/__tests__/lifecycle-adapter.test.ts`
**Tests**: 30+

This is the most comprehensive adapter — it traces ALL lifecycle events.

**onBeforeBuild**: Create a root span for the build. Initialize Braintrust/LangSmith adapters if configured. Start the build timer.

**onBeforeTask**: Create a child span for the task. Record agent name, task description, model selected.

**onAfterTask**: Complete the task span. Record duration, success/failure, output size. If eval thresholds configured, check quality.

**onTaskError**: Record error details. Tag the span as errored. Trigger auto-remediation if configured.

**onHandoff**: Create a handoff span linking two agent spans. Record payload size.

**onBuildComplete**: Complete the root span. Flush all traces to configured backends. Generate build quality report.

Test:
- Root span created on build start
- Child spans nest correctly under root
- Error spans tagged properly
- Handoff spans link agents
- Build complete flushes traces
- Braintrust adapter receives traces
- LangSmith adapter receives traces
- Auto-remediation triggers on repeated failures
- Quality thresholds evaluated correctly
- Span timing is accurate

---

### KIMI-R26-06: AI Model Database Lifecycle Adapter
**File**: `src/models/lifecycle-adapter.ts`
**Test file**: `src/models/__tests__/lifecycle-adapter.test.ts`
**Tests**: 20+

**onBeforeBuild**: Load model metadata from the vault. Sync with provider APIs if configured. Update taste-aware routing scores.

**onBeforeTask**: Select optimal model for the task using the semantic router. Check model availability. Log selection reasoning.

Test:
- Vault loads on build start
- Provider sync respects config
- Model selection uses taste profiles
- Unavailable models fall back correctly
- Selection reasoning is logged

---

### KIMI-R26-07: CRDT Collaboration Lifecycle Adapter
**File**: `src/collaboration/lifecycle-adapter.ts`
**Test file**: `src/collaboration/__tests__/lifecycle-adapter.test.ts`
**Tests**: 20+

**onBeforeBuild**: Create a collaboration session for the build. Initialize CRDT document. Set up change tracking.

**onAfterTask**: Merge task output into the shared CRDT document. Resolve any conflicts. Broadcast changes to connected participants.

**onBuildComplete**: Finalize the CRDT document. Generate a merge summary. Close the collaboration session.

Test:
- Session created on build start
- Task outputs merged correctly
- Conflicts resolved per strategy (last-write-wins vs semantic-merge)
- Build complete finalizes document
- Multiple participants see consistent state
- Session cleanup on build complete

---

## Execution Order

Do them in this order:
1. **R26-05** Cinematic Observability (traces everything, most useful to have first)
2. **R26-01** Model Routing (needed by most agents)
3. **R26-04** Infinite Memory (persists learnings)
4. **R26-03** Workflow Engine (visualizes progress)
5. **R26-06** AI Model Database (supports routing)
6. **R26-02** Perplexity Research (enhances tasks)
7. **R26-07** CRDT Collaboration (enables multiplayer)

---

## File Naming Convention

Each adapter file follows this pattern:
```
src/<module>/lifecycle-adapter.ts      ← Implementation
src/<module>/__tests__/lifecycle-adapter.test.ts  ← Tests
```

For atlas (infinite-memory), use:
```
src/atlas/lifecycle-adapter.ts
src/atlas/__tests__/lifecycle-adapter.test.ts
```

---

## Quality Gates

Before declaring a task complete:
1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run src/<module>/__tests__/lifecycle-adapter.test.ts` → all pass
3. No `any` types — use `unknown` + type guards
4. ESM `.js` imports throughout
5. All I/O mocked
6. `vi.clearAllMocks()` in every `beforeEach`

---

## Final Checklist

After all 7 tasks:
1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → all tests pass (4,552+ existing + 165+ new)
3. Every lifecycle adapter exports `createXxxLifecycleHooks()`
4. Every adapter returns `FeatureLifecycleHandlers` (from lifecycle-wiring.ts)
5. Tests cover all registered phases per module
6. No `any` types, ESM `.js` imports, mocked I/O

---

## Commit Format

```
feat(<module>): add lifecycle adapter for <module-name>

Co-Authored-By: Kimi K2 <noreply@moonshot.cn>
```
