# Sonnet S-02: Lifecycle Adapter Wiring Sprint
## 5 Tasks | TypeScript Strict | ESM `.js` Imports

> **You are**: Claude Sonnet 4.6, one of 6 AI agents building Nova26 -- a 21-agent AI-powered IDE.
> **Your role**: Integration engineer. You wire modules together, fix structural issues, delete dead code, write integration tests, evaluate incoming source code, and update coordination files.
> **You do NOT**: Create new feature modules (Kimi does that), write specs (Grok does that), do research (Gemini does that), or extract knowledge patterns (Kiro does that).
> **Repo**: https://github.com/nelsen3000/nova26
> **Branch**: `main`
> **Current state**: 4,603 tests passing, 159 test files, 0 TS errors
> **Rules**: TypeScript strict, ESM `.js` imports everywhere, vitest for tests, no `any` (use `unknown` + type guards), mock all I/O
> **This sprint**: S-02 -- wire Kimi R26 lifecycle adapters into the runtime system
> **Depends on**: Kimi R26 lifecycle adapters sprint (KIMI-R26-01 through KIMI-R26-07)

---

## Context: What Happened Before

### S-01 Sprint (COMPLETE)
- Deduplicated `RalphLoopOptions` into single source of truth (`ralph-loop-types.ts`)
- Wired 4 missing R16/R17 modules into `lifecycle-wiring.ts`
- Extracted `handleTaskFailure()` helper from `processTask()`
- Added 45 lifecycle wiring integration tests

### CL-50 Sprint (COMPLETE)
- Deleted 4 CUT module artifacts (sandbox, swarm, engine, multimodal)
- Evaluated + committed 7 Kimi R22-R24 KEEP modules
- Wired 7 new modules into `RalphLoopOptions` (14 new fields)
- Wired 7 new modules into `lifecycle-wiring.ts` (24 total features)
- Verified all barrel exports (6 index.ts files)
- Added 51 cross-module integration tests

### Current Gap
The lifecycle hooks system is fully wired with 24 features, but all handlers are **stubs** -- they register correctly in the `HookRegistry` but execute empty `async () => {}` functions. Kimi is building real lifecycle adapters (R26 sprint) that implement the actual logic for each phase. This sprint wires those adapters into the system so hooks execute real code.

---

## How Lifecycle Hooks Work

1. **`RalphLoopOptions`** (`ralph-loop-types.ts`): Config flags like `modelRoutingEnabled` and `modelRoutingConfig`
2. **`lifecycle-wiring.ts`**: `wireFeatureHooks()` reads the flags and registers hooks in `HookRegistry` with priorities
3. **`lifecycle-hooks.ts`**: `HookRegistry.executePhase()` runs all registered hooks for a given phase in priority order
4. **`ralph-loop.ts`**: `processTask()` calls `registry.executePhase('onBeforeTask', context)` at the right moments
5. **Lifecycle adapters** (NEW): Factory functions that create real hook handlers from module config

The adapters bridge the gap between the generic hook system and the actual module code.

---

## The 7 Lifecycle Adapter Files

Kimi will create these files in the R26 sprint. Each exports a factory function following the pattern `create<ModuleName>LifecycleHooks(config)`.

| # | Module | Adapter File | Factory Function | Phases |
|---|--------|-------------|------------------|--------|
| 1 | Model Routing | `src/model-routing/lifecycle-adapter.ts` | `createModelRoutingLifecycleHooks()` | onBeforeBuild, onBeforeTask |
| 2 | Perplexity | `src/tools/perplexity/lifecycle-adapter.ts` | `createPerplexityLifecycleHooks()` | onBeforeTask, onAfterTask |
| 3 | Workflow Engine | `src/workflow-engine/lifecycle-adapter.ts` | `createWorkflowEngineLifecycleHooks()` | onBeforeBuild, onAfterTask, onBuildComplete |
| 4 | Infinite Memory | `src/atlas/lifecycle-adapter.ts` | `createInfiniteMemoryLifecycleHooks()` | onAfterTask, onBuildComplete |
| 5 | Cinematic Observability | `src/observability/lifecycle-adapter.ts` | `createCinematicObservabilityLifecycleHooks()` | onBeforeBuild, onBeforeTask, onAfterTask, onTaskError, onHandoff, onBuildComplete |
| 6 | AI Model Database | `src/models/lifecycle-adapter.ts` | `createAIModelDatabaseLifecycleHooks()` | onBeforeBuild, onBeforeTask |
| 7 | CRDT Collaboration | `src/collaboration/lifecycle-adapter.ts` | `createCRDTCollaborationLifecycleHooks()` | onBeforeBuild, onAfterTask, onBuildComplete |

**NOTE**: 3 adapters may already be delivered (model-routing, observability, atlas). Check the repo for existing files before starting. The factory function names above are **guesses** -- read each actual file to find the correct export names.

Each adapter also has a test file at `src/<module>/__tests__/lifecycle-adapter.test.ts`.

---

## Your Tasks (Do Them In Order)

### Task S-02-01: Evaluate All 7 Lifecycle Adapters

**Prerequisite**: All 7 adapter files from Kimi R26 must be delivered. If some are missing, evaluate what exists and pause until the rest arrive.

**For EACH adapter file, check**:

1. **Read all files** -- understand the factory function signature, what phases it handles, what module code it calls
2. **ESM `.js` imports** -- every relative import must end in `.js`. Fix any bare `.ts` imports.
3. **No `any` types** -- must use `unknown` + type guards. Fix if found.
4. **TypeScript strict compliance** -- run `npx tsc --noEmit` after each evaluation. Fix errors.
5. **Phase alignment** -- verify the adapter handles the same phases listed in `DEFAULT_FEATURE_HOOKS` for that feature. If there's a mismatch, the adapter takes precedence (update `DEFAULT_FEATURE_HOOKS` if needed).
6. **Config type alignment** -- verify the factory function accepts the config type from `RalphLoopOptions` (e.g., `ModelRoutingConfig` for model routing). Fix any mismatches.
7. **Return type** -- the factory should return an object with handler functions matching `FeatureLifecycleHandlers` interface (from lifecycle-wiring.ts): `{ onBeforeBuild?, onBeforeTask?, onAfterTask?, onTaskError?, onHandoff?, onBuildComplete? }`.

**Files to evaluate**:
```
src/model-routing/lifecycle-adapter.ts
src/model-routing/__tests__/lifecycle-adapter.test.ts
src/tools/perplexity/lifecycle-adapter.ts
src/tools/perplexity/__tests__/lifecycle-adapter.test.ts
src/workflow-engine/lifecycle-adapter.ts
src/workflow-engine/__tests__/lifecycle-adapter.test.ts
src/atlas/lifecycle-adapter.ts
src/atlas/__tests__/lifecycle-adapter.test.ts
src/observability/lifecycle-adapter.ts
src/observability/__tests__/lifecycle-adapter.test.ts
src/models/lifecycle-adapter.ts
src/models/__tests__/lifecycle-adapter.test.ts
src/collaboration/lifecycle-adapter.ts
src/collaboration/__tests__/lifecycle-adapter.test.ts
```

**Verification**: `npx tsc --noEmit` = 0 errors, `npx vitest run` = all tests pass.

---

### Task S-02-02: Replace Stub Handlers in lifecycle-wiring.ts

**File**: `src/orchestrator/lifecycle-wiring.ts`

**Problem**: Currently, `wireFeatureHooks()` creates stub handlers for all 24 features:

```typescript
// Current stub pattern (for ALL features):
const handler = async (): Promise<void> => {
  // This is a stub - actual feature modules would be called here
};
```

**What to do**: For the 7 R22-R24 features, replace the stub handlers with real adapter calls. Import each adapter's factory function and call it with the corresponding config from `RalphLoopOptions`.

**Step 1**: Add imports at the top of `lifecycle-wiring.ts`:

```typescript
// R22-R24 Lifecycle Adapters
import { createModelRoutingLifecycleHooks } from '../model-routing/lifecycle-adapter.js';
import { createPerplexityLifecycleHooks } from '../tools/perplexity/lifecycle-adapter.js';
import { createWorkflowEngineLifecycleHooks } from '../workflow-engine/lifecycle-adapter.js';
import { createInfiniteMemoryLifecycleHooks } from '../atlas/lifecycle-adapter.js';
import { createCinematicObservabilityLifecycleHooks } from '../observability/lifecycle-adapter.js';
import { createAIModelDatabaseLifecycleHooks } from '../models/lifecycle-adapter.js';
import { createCRDTCollaborationLifecycleHooks } from '../collaboration/lifecycle-adapter.js';
```

**NOTE**: The import names above are guesses based on the naming pattern from 3 delivered adapters. Read the actual files from S-02-01 to get the correct export names.

**Step 2**: In `wireFeatureHooks()`, after the `featureFlags` map, create a `adapterFactories` map that links feature names to their adapter factory + config:

```typescript
// Map R22-R24 features to their adapter factories
const adapterFactories: Record<string, {
  factory: (config: unknown) => Record<string, (context: unknown) => Promise<void>>;
  config: unknown;
}> = {
  modelRouting: {
    factory: createModelRoutingLifecycleHooks,
    config: options.modelRoutingConfig,
  },
  perplexity: {
    factory: createPerplexityLifecycleHooks,
    config: options.perplexityConfig,
  },
  workflowEngine: {
    factory: createWorkflowEngineLifecycleHooks,
    config: options.workflowEngineConfig,
  },
  infiniteMemory: {
    factory: createInfiniteMemoryLifecycleHooks,
    config: options.infiniteMemoryConfig,
  },
  cinematicObservability: {
    factory: createCinematicObservabilityLifecycleHooks,
    config: options.cinematicObservabilityConfig,
  },
  aiModelDatabase: {
    factory: createAIModelDatabaseLifecycleHooks,
    config: options.aiModelDatabaseConfig,
  },
  crdtCollaboration: {
    factory: createCRDTCollaborationLifecycleHooks,
    config: options.crdtCollaborationConfig,
  },
};
```

**Step 3**: In the hook registration loop, check if the feature has an adapter factory. If yes, use the real handler from the adapter. If no (for the 17 older features), keep the stub:

```typescript
for (const [phase, phaseEnabled] of Object.entries(config.phases)) {
  if (!phaseEnabled) continue;

  // Use real adapter handler if available, otherwise stub
  const adapterEntry = adapterFactories[featureName];
  let handler: (context: unknown) => Promise<void>;

  if (adapterEntry) {
    const hooks = adapterEntry.factory(adapterEntry.config);
    const hookFn = hooks[phase];
    handler = hookFn ?? (async () => {});
  } else {
    handler = async () => {};
  }

  registry.register({ phase, moduleName: config.moduleName, priority: config.priority, handler });
  totalHooks++;
}
```

**IMPORTANT**: The adapter factory should only be called ONCE per feature (not once per phase). Cache the result:

```typescript
const adapterCache = new Map<string, Record<string, (context: unknown) => Promise<void>>>();

function getAdapterHooks(featureName: string): Record<string, (context: unknown) => Promise<void>> | null {
  if (adapterCache.has(featureName)) return adapterCache.get(featureName)!;
  const entry = adapterFactories[featureName];
  if (!entry) return null;
  const hooks = entry.factory(entry.config);
  adapterCache.set(featureName, hooks);
  return hooks;
}
```

**Step 4**: Run `npx tsc --noEmit` -- 0 errors.

**Verification**: After this task, `wireFeatureHooks()` with R22-R24 features enabled creates real handlers (not stubs) for those 7 features.

---

### Task S-02-03: Wire Adapter Initialization into ralph-loop.ts

**File**: `src/orchestrator/ralph-loop.ts`

**Problem**: The Ralph Loop currently calls `wireFeatureHooks()` during initialization, which now creates real adapter handlers. But the adapters may need build-level initialization (e.g., creating an observability trace for the entire build, or initializing a CRDT session).

**What to do**: Verify that `processTask()` and the build lifecycle in `ralph-loop.ts` correctly invoke the lifecycle phases at the right moments. Specifically check:

1. **`onBeforeBuild`** is called once at build start (before any tasks)
2. **`onBeforeTask`** is called before each task dispatch
3. **`onAfterTask`** is called after each successful task
4. **`onTaskError`** is called when a task fails (inside `handleTaskFailure()`)
5. **`onHandoff`** is called during agent handoffs
6. **`onBuildComplete`** is called once at build end

**If any phase invocations are missing**, add them. The pattern is:
```typescript
await registry.executePhase('onBeforeTask', { task, prd, options });
```

**Also verify**: The context objects passed to each phase contain the data the adapters need. Check each adapter's handler signature to confirm the context fields match.

**Step 2**: Run `npx tsc --noEmit` -- 0 errors.

---

### Task S-02-04: Full Pipeline Integration Tests

**File**: `src/orchestrator/__tests__/adapter-pipeline-integration.test.ts`
**Tests**: 40+ vitest cases minimum

Write integration tests that verify the complete pipeline: `RalphLoopOptions` config → `wireFeatureHooks()` with real adapters → `HookRegistry.executePhase()` invokes real module code.

**Test categories**:

#### Category 1: Adapter Factory Wiring (10-12 tests)
- `wireFeatureHooks()` with modelRouting enabled calls `createModelRoutingLifecycleHooks()`
- `wireFeatureHooks()` with all 7 R22-R24 features enabled produces real (non-stub) handlers
- `wireFeatureHooks()` without R22-R24 features still produces stubs for R16/R17 features
- Each adapter factory is called exactly once per `wireFeatureHooks()` invocation (no duplicate calls)
- Adapter factory receives the correct config from `RalphLoopOptions`
- 7 tests for each adapter: handler for each registered phase is a function (not undefined)

#### Category 2: Phase Execution with Real Adapters (10-12 tests)
- `registry.executePhase('onBeforeBuild', context)` invokes modelRouting and observability handlers
- `registry.executePhase('onBeforeTask', context)` invokes all features registered for that phase
- `registry.executePhase('onAfterTask', context)` invokes infiniteMemory, workflowEngine, etc.
- `registry.executePhase('onTaskError', context)` invokes cinematicObservability error handler
- `registry.executePhase('onBuildComplete', context)` invokes all features for that phase
- Priority ordering is preserved: observability (8) fires before modelRouting (42)
- Error in one adapter handler doesn't crash other handlers (error isolation)

#### Category 3: Config Propagation (8-10 tests)
- `modelRoutingConfig` flows from RalphLoopOptions → adapter factory → handler behavior
- `cinematicObservabilityConfig` flows correctly with all 6 phases
- `infiniteMemoryConfig` placeholder config is accepted by adapter
- `crdtCollaborationConfig` with `conflictResolution: 'semantic-merge'` reaches adapter
- Missing config (undefined) doesn't crash adapter factory (graceful defaults)
- Partial config is merged with defaults inside adapter

#### Category 4: Mixed Real + Stub Pipeline (8-10 tests)
- All 24 features enabled: 7 use real adapters, 17 use stubs, all execute without error
- Only R22-R24 features enabled: 7 real adapters fire, 17 stubs skipped
- Only R16/R17 features enabled: 0 real adapters, 17 stubs fire
- `getWiringSummary()` still reports correct counts with adapter wiring
- Disabling a feature with an adapter skips it entirely (factory not called)

**Test patterns to follow**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HookRegistry } from '../../orchestrator/lifecycle-hooks.js';
import { wireFeatureHooks, DEFAULT_FEATURE_HOOKS } from '../../orchestrator/lifecycle-wiring.js';
import type { RalphLoopOptions } from '../../orchestrator/ralph-loop-types.js';

// Mock the adapter imports to verify they're called correctly
vi.mock('../../model-routing/lifecycle-adapter.js', () => ({
  createModelRoutingLifecycleHooks: vi.fn(() => ({
    onBeforeBuild: vi.fn(),
    onBeforeTask: vi.fn(),
  })),
}));

// ... similar mocks for other adapters
```

**Rules**:
- All I/O mocked (no real API calls, no real hardware detection)
- Mock the adapter factory functions to verify call patterns
- Use `vi.fn()` to verify handlers are invoked with correct context
- Each test must be independent (use `beforeEach` for reset)
- ESM `.js` imports in all import statements

---

### Task S-02-05: Update Coordination Files

#### Part A: Update `.nova/TASK-BOARD.md`

**In the SONNET section**, add the S-02 sprint:

```markdown
### Sprint S-02: Lifecycle Adapter Wiring (COMPLETE)
> Sprint file: `.prompts/sonnet-s02-adapter-wiring-sprint.md`

- [x] `S-02-01` Evaluate all 7 Kimi R26 lifecycle adapters
- [x] `S-02-02` Replace stub handlers in lifecycle-wiring.ts with real adapter calls
- [x] `S-02-03` Wire adapter initialization into ralph-loop.ts processTask()
- [x] `S-02-04` Full pipeline integration tests (adapter-pipeline-integration.test.ts, 40+ tests)
- [x] `S-02-05` Update TASK-BOARD.md + CLAUDE.md with completed tasks and new test counts
```

Update header stats with new test count.

#### Part B: Update `CLAUDE.md`

In the Completed section, add:
```markdown
- [x] Evaluated 7 Kimi R26 lifecycle adapters (S-02-01)
- [x] Replaced stub handlers with real adapter calls (S-02-02): 7 adapters wired into lifecycle-wiring.ts
- [x] Verified ralph-loop.ts phase invocations (S-02-03)
- [x] Full pipeline integration tests (S-02-04): 40+ tests in adapter-pipeline-integration.test.ts
- [x] Updated TASK-BOARD.md + CLAUDE.md (S-02-05)
```

---

## Execution Order

```
S-02-01  Evaluate adapters        (first -- verify Kimi delivery quality)
  |
S-02-02  Replace stubs            (depends on S-02-01 -- needs correct import names)
  |
S-02-03  Wire into ralph-loop.ts  (depends on S-02-02 -- adapters must be wired first)
  |
S-02-04  Integration tests        (depends on S-02-02 + S-02-03 -- tests the full pipeline)
  |
S-02-05  Update docs              (LAST -- needs final test counts)
```

**After each task**: Run `npx tsc --noEmit` (must be 0 errors) and `npx vitest run` (all tests must pass).

---

## Final Checklist

After all 5 tasks are complete:

1. `npx tsc --noEmit` --> **0 errors**
2. `npx vitest run` --> all tests pass (4,603 existing + 40+ new = **4,643+** tests)
3. No `any` types in any new or modified files
4. ESM `.js` imports throughout all new and modified files
5. `lifecycle-wiring.ts` uses real adapter handlers for 7 R22-R24 features
6. `lifecycle-wiring.ts` still uses stub handlers for 17 R16/R17 features (until their adapters are built)
7. `ralph-loop.ts` invokes all 6 lifecycle phases at the correct moments
8. Adapter factories are called exactly once per feature per `wireFeatureHooks()` invocation
9. Error isolation: one adapter failure doesn't crash the build
10. `DEFAULT_FEATURE_HOOKS` still has **24 entries** (phases may be updated based on adapter reality)
11. All 7 adapter test files pass
12. `src/orchestrator/__tests__/adapter-pipeline-integration.test.ts` exists with 40+ tests
13. `.nova/TASK-BOARD.md` updated with S-02 sprint
14. `CLAUDE.md` updated with completed tasks

---

## Commit Format

```
<type>(<scope>): <description>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Types: `fix`, `refactor`, `test`, `feat`, `chore`
Scopes: `orchestrator`, `lifecycle`, `wiring`, `integration`, `adapters`

**Example commits for this sprint**:
```
feat(adapters): evaluate 7 R26 lifecycle adapters (model-routing, perplexity, workflow-engine, atlas, observability, models, collaboration)
feat(lifecycle): replace stub handlers with real adapter calls for 7 R22-R24 features
refactor(orchestrator): verify and wire lifecycle phase invocations in ralph-loop.ts
test(integration): add 40+ full pipeline integration tests for adapter wiring
chore(docs): update TASK-BOARD.md and CLAUDE.md with S-02 sprint results
```
