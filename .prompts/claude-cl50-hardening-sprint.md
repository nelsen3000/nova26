# Sonnet CL-50: R22-R24 Hardening & Integration Sprint
## 7 Tasks | TypeScript Strict | ESM `.js` Imports

> **You are**: Claude Sonnet 4.6, one of 6 AI agents building Nova26 -- a 21-agent AI-powered IDE.
> **Your role**: Integration engineer. You wire modules together, fix structural issues, delete dead code, write integration tests, evaluate incoming source code, and update coordination files.
> **You do NOT**: Create new feature modules (Kimi does that), write specs (Grok does that), do research (Gemini does that), or extract knowledge patterns (Kiro does that).
> **Repo**: https://github.com/nelsen3000/nova26
> **Branch**: `main`
> **Current state**: 4,231 tests passing, 153 test files, 40 TS errors (all in 4 CUT modules -- will hit 0 after CL-50)
> **Rules**: TypeScript strict, ESM `.js` imports everywhere, vitest for tests, no `any` (use `unknown` + type guards), mock all I/O
> **This sprint**: CL-50 series -- continuation after S-01 Integration & Hardening sprint

---

## How This Project Works

Nova26 is a multi-agent AI IDE with 21 celestial-body-named agents (EARTH, MARS, VENUS, JUPITER, etc.) orchestrated by a **Ralph Loop** (`src/orchestrator/ralph-loop.ts`). The loop:
1. Picks tasks from a PRD
2. Dispatches to the right agent
3. Runs quality gates on the output
4. Persists results

### Agent Team (Who Does What)

| Agent | Model | Role |
|-------|-------|------|
| **Claude Code (Opus)** | claude-opus-4-6 | Coordinator -- evaluates all output, writes prompts, assigns tasks |
| **You (Sonnet)** | claude-sonnet-4-6 | Integration -- wiring, fixing, hardening, integration testing |
| **Kimi** | kimi-k2 | Implementation -- creates new feature modules with full tests |
| **Grok** | grok-4 | Research -- writes deep TypeScript specs with interfaces |
| **Gemini** | gemini-3 | Research -- competitive intelligence, tool audits |
| **Kiro** | kiro | Knowledge extraction -- pattern docs, audits (no code changes) |

### Communication Protocol

- **You report to Jon** (the human). When you finish tasks, tell him what you did.
- **Jon routes your output to Claude Code (Opus)** for evaluation.
- **Do not modify files outside your domain** without asking.
- **Always run `npx tsc --noEmit` and `npx vitest run`** after changes.

### Key Directories

```
src/orchestrator/                    YOUR PRIMARY DOMAIN
  ralph-loop.ts                      Core execution loop (~1230 lines)
  ralph-loop-types.ts                Type definitions (RalphLoopOptions, 155 lines)
  lifecycle-hooks.ts                 Hook registry (HookRegistry class)
  lifecycle-wiring.ts                Feature -> hook wiring (17 features currently)
  lifecycle/                         Lifecycle subdirectory
  layers/                            L0-L3 hierarchy
  __tests__/                         Integration tests

src/                                 Feature modules (Kimi creates these)
  model-routing/                     R22-01 Agent Model Routing (8 files, KEEP)
  tools/perplexity/                  PERP-01 Perplexity Research (5 files, KEEP)
  workflow-engine/                   R23-01 Visual Workflow Engine (5 files, KEEP)
  atlas/                             R23-03 Infinite Memory (14 files + existing, KEEP)
  observability/                     R23-05 Cinematic Observability (6 files, KEEP)
  models/                            R24-01 AI Model Database (5 files, KEEP)
  collaboration/                     R24-03 CRDT Collaboration (3 files, KEEP)

  sandbox/                           R23-02 MicroVM (DELETE -- CUT, Firecracker needs Linux KVM)
  swarm/                             R23-04 Agent Debate (DELETE -- CUT, over-engineered)
  engine/                            R24-02 Eternal Engine Rust (DELETE -- CUT, no Rust crate)
  multimodal/                        R24-04 Voice & Multimodal (DELETE -- CUT, no product)

.nova/TASK-BOARD.md                  Master coordination file
.prompts/                            Sprint prompts for all agents
kiro/nova26/CLAUDE.md                Claude Code task file
```

### Previous Sprint (S-01) Context

Your S-01 sprint covered 6 tasks:
- S-01-01: Deduplicate RalphLoopOptions (merge into ralph-loop-types.ts)
- S-01-02: Wire 4 missing modules into lifecycle-wiring.ts
- S-01-03: Delete cut R23-02 sandbox artifacts
- S-01-04: Extract shared failure handler from processTask()
- S-01-05: Add integration tests for lifecycle wiring
- S-01-06: Evaluate + integrate Kimi R22-R24 deliveries as they arrive

This CL-50 sprint is the NEXT PHASE. Kimi has now delivered source code (no tests) for all 7 KEEP modules from the R22-R24 mega-sprint. Your job: clean up the 4 CUT module artifacts, evaluate and commit the 7 KEEP modules, wire them into the system, create barrel exports, write cross-module integration tests, and update coordination files.

---

## Your Tasks (Do Them In Order)

### Task CL-50: Delete CUT Module Artifacts

**Problem**: 4 modules were cut from the R22-R24 mega-sprint but Kimi implemented them anyway. They contain all 40 current TS errors (multimodal=30, sandbox=1, plus swarm and engine errors). Deleting them should drop TS errors from 40 to 0.

**The 4 CUT modules and why they were cut**:
| Module | Task ID | Reason Cut |
|--------|---------|------------|
| `src/sandbox/` | R23-02 | Firecracker requires Linux KVM -- no macOS support |
| `src/swarm/` | R23-04 | Over-engineered multi-model debate before product exists |
| `src/engine/` | R24-02 | No Rust crate exists yet -- TS bridge has nothing to bridge |
| `src/multimodal/` | R24-04 | Premature without working UI -- no product to talk to |

**Steps**:
1. Delete `src/sandbox/` entirely (all files and subdirectories)
2. Delete `src/swarm/` entirely (files: docker-executor.ts, autogen-adapter.ts, crewai-bridge.ts, debate-orchestrator.ts, index.ts, swarm-mode.test.ts, swarm-mode.ts, types.ts)
3. Delete `src/engine/` entirely (files: index.ts, nano-claw-isolation.ts, rust-bridge.ts, types.ts)
4. Delete `src/multimodal/` entirely (files: gemini13-bridge.ts, index.ts, types.ts, vision-fusion.ts, voice-orchestrator.ts)
5. Search for dangling imports: `grep -r` for any file that imports from `sandbox`, `swarm`, `engine`, or `multimodal` paths. Remove those imports and any code that references the deleted modules.
6. Run `npx tsc --noEmit` -- should drop from 40 errors to **0 errors**
7. Run `npx vitest run` -- all existing tests should still pass

**Verification**: `npx tsc --noEmit` outputs 0 errors.

---

### Task CL-51: Evaluate + Commit All Kimi R22-R24 Source Code

**Context**: Kimi delivered source code (no tests) for 7 KEEP modules. For each module, you must read all files, verify code quality, and commit with descriptive messages.

**The 7 KEEP modules to evaluate**:

#### 1. `src/tools/perplexity/` (KIMI-PERP-01 -- Perplexity Research)
```
src/tools/perplexity/
  index.ts
  perplexity-agent.ts
  rules.md
  types.ts
  __tests__/perplexity.test.ts    (Kimi included tests for this one)
```

#### 2. `src/model-routing/` (KIMI-R22-01 -- Agent Model Routing)
```
src/model-routing/
  index.ts
  types.ts
  hardware-detector.ts
  model-registry.ts
  router.ts
  speculative-decoder.ts
  inference-queue.ts
  __tests__/                       (may have test files)
```

#### 3. `src/workflow-engine/` (KIMI-R23-01 -- Visual Workflow Engine)
```
src/workflow-engine/
  index.ts
  types.ts
  ralph-visual-engine.ts
  ralph-loop-visual-adapter.ts
  __tests__/workflow-engine.test.ts
```

#### 4. `src/atlas/` -- NEW FILES ONLY (KIMI-R23-03 -- Infinite Hierarchical Memory)
```
NEW files added to existing src/atlas/:
  infinite-memory-core.ts
  mem0-adapter.ts
  letta-soul-manager.ts
  memory-taste-scorer.ts
```
**IMPORTANT**: src/atlas/ already has existing files (convex-client.ts, graph-memory.ts, index.ts, types.ts, etc.). Only evaluate the 4 NEW files listed above. Do NOT touch existing atlas files.

#### 5. `src/observability/` (KIMI-R23-05 -- Cinematic Observability)
```
src/observability/
  index.ts
  types.ts
  cinematic-core.ts
  braintrust-adapter.ts
  langsmith-bridge.ts
  tracer.ts
```

#### 6. `src/models/` (KIMI-R24-01 -- AI Model Database)
```
src/models/
  index.ts
  types.ts
  ai-model-vault.ts
  model-router.ts
  ensemble-engine.ts
```

#### 7. `src/collaboration/` (KIMI-R24-03 -- CRDT Collaboration)
```
src/collaboration/
  index.ts
  types.ts
  crdt-core.ts
```

**For EACH module, check**:
1. **Read all files** -- understand what the code does, verify it matches the spec
2. **ESM `.js` imports** -- every relative import must end in `.js` (e.g., `import { Foo } from './types.js'`). Fix any bare `.ts` imports.
3. **No `any` types** -- must use `unknown` + type guards instead. Fix if found.
4. **TypeScript strict compliance** -- run `npx tsc --noEmit` after staging each module. Fix errors.
5. **No real API calls** -- all I/O should be behind interfaces that can be mocked
6. **Proper exports** -- index.ts should re-export the public API

**Commit each module separately** with a descriptive message:
```
feat(perplexity): add Perplexity research integration (KIMI-PERP-01)
feat(model-routing): add agent-specific model routing and speculative decoding (KIMI-R22-01)
feat(workflow-engine): add persistent visual workflow engine (KIMI-R23-01)
feat(atlas): add infinite hierarchical memory extensions (KIMI-R23-03)
feat(observability): add cinematic observability and eval suite (KIMI-R23-05)
feat(models): add AI model database and taste-aware routing (KIMI-R24-01)
feat(collaboration): add real-time CRDT collaboration (KIMI-R24-03)
```

---

### Task CL-52: Wire R22-R24 Modules into RalphLoopOptions

**File**: `src/orchestrator/ralph-loop-types.ts`

**What to do**: Add config fields and type imports for the 7 new modules to `RalphLoopOptions`.

**Step 1**: Add type imports at the top of the file. Check what each module exports as its config type -- read each module's `types.ts` or `index.ts` to find the correct type name. Expected pattern:

```typescript
// R22-R24 Imports
import type { ModelRoutingConfig } from '../model-routing/types.js';
import type { PerplexityToolConfig } from '../tools/perplexity/types.js';
import type { WorkflowEngineConfig } from '../workflow-engine/types.js';
import type { InfiniteMemoryConfig } from '../atlas/infinite-memory-core.js';
import type { CinematicObservabilityConfig } from '../observability/types.js';
import type { AIModelDatabaseConfig } from '../models/types.js';
import type { CRDTCollaborationConfig } from '../collaboration/types.js';
```

**NOTE**: The exact type names above are GUESSES. Read each module's actual exports to find the correct config interface name. If a module doesn't export a config interface, create a placeholder in ralph-loop-types.ts (following the existing pattern for `MigrationModuleConfig`, `DebugModuleConfig`, etc.).

**Step 2**: Add fields to `RalphLoopOptions` interface (at the end, after the R20 section):

```typescript
  // R22: Model Routing (R22-01)
  modelRoutingEnabled?: boolean;
  modelRoutingConfig?: ModelRoutingConfig;
  // PERP: Perplexity Research (PERP-01)
  perplexityEnabled?: boolean;
  perplexityConfig?: PerplexityToolConfig;
  // R23: Workflow Engine (R23-01)
  workflowEngineEnabled?: boolean;
  workflowEngineConfig?: WorkflowEngineConfig;
  // R23: Infinite Memory (R23-03)
  infiniteMemoryEnabled?: boolean;
  infiniteMemoryConfig?: InfiniteMemoryConfig;
  // R23: Cinematic Observability (R23-05)
  cinematicObservabilityEnabled?: boolean;
  cinematicObservabilityConfig?: CinematicObservabilityConfig;
  // R24: AI Model Database (R24-01)
  aiModelDatabaseEnabled?: boolean;
  aiModelDatabaseConfig?: AIModelDatabaseConfig;
  // R24: CRDT Collaboration (R24-03)
  crdtCollaborationEnabled?: boolean;
  crdtCollaborationConfig?: CRDTCollaborationConfig;
```

**Step 3**: Run `npx tsc --noEmit` -- 0 errors.

---

### Task CL-53: Wire R22-R24 into Lifecycle Hooks

**File**: `src/orchestrator/lifecycle-wiring.ts`

**What to do**: Add the 7 new modules to `DEFAULT_FEATURE_HOOKS`, `wireFeatureHooks()` featureFlags map, and `getWiringSummary()` featureFlags map.

**Step 1**: Add to `DEFAULT_FEATURE_HOOKS` (after the existing R17 entries):

```typescript
  // R22-R24 Features
  modelRouting: {
    moduleName: 'model-routing',
    phases: { onBeforeBuild: true, onBeforeTask: true },
    priority: 42,
  },
  perplexity: {
    moduleName: 'perplexity',
    phases: { onBeforeTask: true, onAfterTask: true },
    priority: 65,
  },
  workflowEngine: {
    moduleName: 'workflow-engine',
    phases: { onBeforeBuild: true, onAfterTask: true, onBuildComplete: true },
    priority: 38,
  },
  infiniteMemory: {
    moduleName: 'infinite-memory',
    phases: { onAfterTask: true, onBuildComplete: true },
    priority: 48,
  },
  cinematicObservability: {
    moduleName: 'cinematic-observability',
    phases: { onBeforeBuild: true, onBeforeTask: true, onAfterTask: true, onTaskError: true, onHandoff: true, onBuildComplete: true },
    priority: 8,
  },
  aiModelDatabase: {
    moduleName: 'ai-model-database',
    phases: { onBeforeBuild: true, onBeforeTask: true },
    priority: 44,
  },
  crdtCollaboration: {
    moduleName: 'crdt-collaboration',
    phases: { onBeforeBuild: true, onAfterTask: true, onBuildComplete: true },
    priority: 52,
  },
```

**Priority rationale**:
- `cinematicObservability` at 8 = runs very early (observes everything)
- `workflowEngine` at 38 = runs before most features (orchestrates flow)
- `modelRouting` at 42 = runs before tasks that need model selection
- `aiModelDatabase` at 44 = feeds model routing with data
- `infiniteMemory` at 48 = captures results after tasks
- `crdtCollaboration` at 52 = syncs state after captures
- `perplexity` at 65 = research augmentation mid-pipeline

**Step 2**: Add to `wireFeatureHooks()` featureFlags map (the `const featureFlags` inside that function):

```typescript
    modelRouting: options.modelRoutingEnabled,
    perplexity: options.perplexityEnabled,
    workflowEngine: options.workflowEngineEnabled,
    infiniteMemory: options.infiniteMemoryEnabled,
    cinematicObservability: options.cinematicObservabilityEnabled,
    aiModelDatabase: options.aiModelDatabaseEnabled,
    crdtCollaboration: options.crdtCollaborationEnabled,
```

**Step 3**: Add the same 7 entries to `getWiringSummary()` featureFlags map (identical to Step 2).

**Step 4**: Run `npx tsc --noEmit` -- 0 errors.

**Verification**: After wiring, `DEFAULT_FEATURE_HOOKS` should have **24 entries total** (17 existing + 7 new). Both `wireFeatureHooks()` and `getWiringSummary()` should have 24 entries in their featureFlags maps.

---

### Task CL-54: Create Barrel Exports for All New Modules

**What to do**: Ensure each new module has a proper `index.ts` barrel export that re-exports its public API. Some modules already have index.ts files from Kimi -- verify they export the right things. Create or fix as needed.

**Modules to check/create**:

#### 1. `src/models/index.ts`
Read the file. Verify it exports the key types and classes:
- `AIModelVault` class (from ai-model-vault.ts)
- `ModelMetadata`, `ModelCapabilities`, `ModelRoute`, `JonFeedback` types (from types.ts)
- `EnsembleEngine` class (from ensemble-engine.ts)
- `ModelRouter` class (from model-router.ts)

#### 2. `src/collaboration/index.ts`
Read the file. Verify it exports:
- `RealTimeCRDTOrchestrator` class (from crdt-core.ts)
- `CRDTDocument`, `SemanticCRDTNode` types (from types.ts)

#### 3. `src/model-routing/index.ts`
Read the file. Verify it exports:
- `Router` or `AgentModelRouter` class (from router.ts)
- `HardwareDetector` (from hardware-detector.ts)
- `ModelRegistry` (from model-registry.ts)
- `SpeculativeDecoder` (from speculative-decoder.ts)
- `InferenceQueue` (from inference-queue.ts)
- All types from types.ts

#### 4. `src/workflow-engine/index.ts`
Read the file. Verify it exports:
- `RalphVisualWorkflowEngine` class (from ralph-visual-engine.ts)
- `RalphLoopVisualAdapter` (from ralph-loop-visual-adapter.ts)
- All types from types.ts

#### 5. `src/tools/perplexity/index.ts`
Read the file. Verify it exports:
- `PerplexityAgent` class (from perplexity-agent.ts)
- `PerplexityResearchBrief`, `PerplexityToolConfig` types (from types.ts)

#### 6. `src/observability/index.ts`
Read the file. Verify it exports:
- `CinematicCore` or `CinematicObservability` class (from cinematic-core.ts)
- `BraintrustAdapter` (from braintrust-adapter.ts)
- `LangSmithBridge` (from langsmith-bridge.ts)
- All types from types.ts

**For each file**:
- If the index.ts exists but is missing exports, add them
- If the index.ts doesn't exist, create it
- Use `export { ... } from './filename.js';` and `export type { ... } from './filename.js';` syntax
- ALL imports must use `.js` extension

**Run `npx tsc --noEmit`** after all barrel export changes -- 0 errors.

---

### Task CL-55: Cross-Module Integration Tests

**File**: `src/orchestrator/__tests__/r22-r24-integration.test.ts`
**Tests**: 40+ vitest cases minimum

Write integration tests that verify the new R22-R24 modules work together and integrate correctly with the lifecycle system.

**Test categories**:

#### Category 1: Model Routing -> Models Pipeline (R22-01 feeds R24-01)
Test that the model-routing module can query the AI model database for model selection.
- `modelRouting.selectModel()` uses models database for lookup
- Hardware tier affects model selection
- Confidence-based escalation triggers model database re-query
- Speculative decoding uses model database capabilities
- 8-10 tests

#### Category 2: Workflow Engine -> Observability (R23-01 spans in R23-05)
Test that workflow engine execution produces cinematic spans.
- Workflow node execution creates observability spans
- Span tree structure matches workflow DAG
- Rewind operations create rewind spans
- Error spans capture workflow failures
- 8-10 tests

#### Category 3: Infinite Memory -> Collaboration (R23-03 state in R24-03 CRDT)
Test that infinite memory state can be synced via CRDT collaboration.
- Memory hierarchy nodes representable as CRDT documents
- Memory upsert propagates to collaboration session
- Concurrent memory writes resolved via CRDT merge
- Legacy migration preserves CRDT compatibility
- 8-10 tests

#### Category 4: Lifecycle Wiring for All 24 Features (17 old + 7 new)
Test that lifecycle hooks fire correctly for all features.
- `wireFeatureHooks()` with all 24 features enabled returns correct wiredCount (24)
- `wireFeatureHooks()` with all 24 features enabled returns correct totalHooks (count all phases)
- `getWiringSummary()` with all features returns 24 in wouldWire
- `getWiringSummary()` with no features returns 24 in wouldSkip
- Priority ordering: cinematicObservability (8) fires before all others
- Priority ordering: productionFeedback (110) fires last
- New features correctly wired to their specified phases
- Partial enablement (only R22-R24 features) works correctly
- 10-15 tests

#### Category 5: Perplexity + Workflow Integration
- Perplexity research result can feed into workflow engine node
- Research brief metadata stored in infinite memory hierarchy
- 4-6 tests

**Test patterns to follow**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HookRegistry } from '../../orchestrator/lifecycle-hooks.js';
import { wireFeatureHooks, getWiringSummary, DEFAULT_FEATURE_HOOKS } from '../../orchestrator/lifecycle-wiring.js';
import type { RalphLoopOptions } from '../../orchestrator/ralph-loop-types.js';

// Mock I/O-heavy modules
vi.mock('../../model-routing/router.js', () => ({ ... }));
vi.mock('../../observability/cinematic-core.js', () => ({ ... }));
// etc.
```

**Rules**:
- All I/O mocked (no real API calls, no real hardware detection)
- Use `vi.mock()` for module-level mocking
- Use `vi.fn()` for function-level mocking
- Each test must be independent (use `beforeEach` for reset)
- Descriptive test names: `it('should create observability span when workflow node executes')`
- ESM `.js` imports in all import statements

---

### Task CL-56: Update TASK-BOARD + CLAUDE.md

#### Part A: Update `.nova/TASK-BOARD.md`

**In the SONNET section**, add the CL-50 sprint tasks:

```markdown
### Sprint CL-50: R22-R24 Hardening & Integration
> Sprint file: `.prompts/claude-cl50-hardening-sprint.md`

- [ ] `CL-50` Delete 4 CUT module artifacts (sandbox, swarm, engine, multimodal) -- drop TS errors from 40 to 0
- [ ] `CL-51` Evaluate + commit all 7 Kimi R22-R24 KEEP modules (source code, no tests)
- [ ] `CL-52` Wire 7 new modules into RalphLoopOptions (ralph-loop-types.ts)
- [ ] `CL-53` Wire 7 new modules into lifecycle hooks (lifecycle-wiring.ts) -- total 24 features
- [ ] `CL-54` Create/verify barrel exports for all new modules (6 index.ts files)
- [ ] `CL-55` Cross-module integration tests (r22-r24-integration.test.ts, 40+ tests)
- [ ] `CL-56` Update TASK-BOARD.md + CLAUDE.md with completed tasks and new test counts
```

**In the KIMI section**, update the R22-R24 task statuses to show source delivery:
- Mark KIMI-PERP-01 through KIMI-R24-03 as "DELIVERED (source, no tests)" where applicable
- Keep CUT tasks marked as CUT

**Update the header** stats:
- After CL-50 (deletion): TS errors should be 0
- After CL-55 (integration tests): test count increases by 40+

**Update the Progress Summary table** with new Sonnet sprint info.

#### Part B: Update `kiro/nova26/CLAUDE.md`

In the Completed section, add entries for each completed CL-50 task:
```markdown
- [x] Deleted 4 CUT module artifacts (CL-50): sandbox, swarm, engine, multimodal -- 40 TS errors -> 0
- [x] Evaluated + committed 7 Kimi R22-R24 KEEP modules (CL-51): perplexity, model-routing, workflow-engine, atlas extensions, observability, models, collaboration
- [x] Wired 7 new modules into RalphLoopOptions (CL-52): 14 new fields
- [x] Wired 7 new modules into lifecycle hooks (CL-53): 24 total features
- [x] Created barrel exports for all new modules (CL-54): 6 index.ts files verified
- [x] Cross-module integration tests (CL-55): 40+ new tests in r22-r24-integration.test.ts
- [x] Updated TASK-BOARD.md + CLAUDE.md (CL-56)
```

Move the S-01 related items from "In Progress" to "Completed" if they were completed in S-01.

Update the "Current state" line with new test count and 0 TS errors.

---

## Execution Order

Tasks must be done in this order due to dependencies:

```
CL-50  Delete CUT modules             (first -- eliminates 40 TS errors, clean slate)
  |
CL-51  Evaluate + commit KEEP modules (depends on CL-50 -- clean baseline)
  |
CL-52  Wire into RalphLoopOptions     (depends on CL-51 -- needs to import module types)
  |
CL-53  Wire into lifecycle hooks       (depends on CL-52 -- needs options fields to exist)
  |
CL-54  Create barrel exports           (can overlap with CL-52/53, but do after CL-51)
  |
CL-55  Integration tests              (depends on CL-52 + CL-53 + CL-54 -- tests the wiring)
  |
CL-56  Update coordination files       (LAST -- needs final test counts)
```

**After each task**: Run `npx tsc --noEmit` (must be 0 errors) and `npx vitest run` (all tests must pass).

---

## Final Checklist

After all 7 tasks are complete:

1. `npx tsc --noEmit` --> **0 errors** (was 40 before CL-50)
2. `npx vitest run` --> all tests pass (4,231 existing + 40+ new from CL-55 = **4,271+** tests)
3. No `any` types in any new or modified files
4. ESM `.js` imports throughout all new and modified files
5. No `src/sandbox/` directory exists
6. No `src/swarm/` directory exists
7. No `src/engine/` directory exists
8. No `src/multimodal/` directory exists
9. No dangling imports referencing deleted modules
10. `RalphLoopOptions` has 14 new fields (7 enabled + 7 config) for R22-R24 modules
11. `DEFAULT_FEATURE_HOOKS` has **24 entries** (17 existing + 7 new)
12. `wireFeatureHooks()` featureFlags map has **24 entries**
13. `getWiringSummary()` featureFlags map has **24 entries**
14. All 7 new modules have proper barrel exports in their index.ts
15. `src/orchestrator/__tests__/r22-r24-integration.test.ts` exists with 40+ tests
16. `.nova/TASK-BOARD.md` updated with CL-50 sprint and Kimi delivery status
17. `kiro/nova26/CLAUDE.md` updated with completed tasks

---

## Commit Format

```
<type>(<scope>): <description>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Types: `fix`, `refactor`, `test`, `feat`, `chore`
Scopes: `orchestrator`, `lifecycle`, `wiring`, `integration`, `cleanup`, `perplexity`, `model-routing`, `workflow-engine`, `atlas`, `observability`, `models`, `collaboration`

**Example commits for this sprint**:
```
chore(cleanup): delete 4 CUT module artifacts (sandbox, swarm, engine, multimodal)
feat(perplexity): add Perplexity research integration (KIMI-PERP-01)
feat(model-routing): add agent-specific model routing (KIMI-R22-01)
feat(workflow-engine): add persistent visual workflow engine (KIMI-R23-01)
feat(atlas): add infinite hierarchical memory extensions (KIMI-R23-03)
feat(observability): add cinematic observability and eval suite (KIMI-R23-05)
feat(models): add AI model database and taste-aware routing (KIMI-R24-01)
feat(collaboration): add real-time CRDT collaboration (KIMI-R24-03)
feat(wiring): add 7 R22-R24 modules to RalphLoopOptions
feat(lifecycle): wire 7 R22-R24 modules into lifecycle hooks (24 total features)
refactor(exports): create/verify barrel exports for R22-R24 modules
test(integration): add 40+ cross-module integration tests for R22-R24
chore(docs): update TASK-BOARD.md and CLAUDE.md with CL-50 sprint results
```
