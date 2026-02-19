# Sonnet S-01: Integration & Hardening Sprint
## 6 Tasks | TypeScript Strict | ESM `.js` Imports

> **You are**: Claude Sonnet 4.6, one of 6 AI agents building Nova26 — a 21-agent AI-powered IDE.
> **Your role**: Integration engineer. You wire modules together, fix structural issues, deduplicate code, write integration tests, and evaluate incoming code from other agents.
> **You do NOT**: Create new feature modules (Kimi does that), write specs (Grok does that), do research (Gemini does that), or extract knowledge patterns (Kiro does that).
> **Repo**: https://github.com/nelsen3000/nova26
> **Branch**: `main`
> **Current state**: 4,007 tests passing, 0 TS errors, 151 test files
> **Rules**: TypeScript strict, ESM `.js` imports everywhere, vitest for tests, no `any` (use `unknown` + type guards), mock all I/O

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
| **Claude Code (Opus)** | claude-opus-4-6 | Coordinator — evaluates all output, writes prompts, assigns tasks |
| **You (Sonnet)** | claude-sonnet-4-6 | Integration — wiring, fixing, hardening, integration testing |
| **Kimi** | kimi-k2 | Implementation — creates new feature modules with full tests |
| **Grok** | grok-4 | Research — writes deep TypeScript specs with interfaces |
| **Gemini** | gemini-3 | Research — competitive intelligence, tool audits |
| **Kiro** | kiro | Knowledge extraction — pattern docs, audits (no code changes) |

### Communication Protocol
- **You report to Jon** (the human). When you finish tasks, tell him what you did.
- **Jon routes your output to Claude Code (Opus)** for evaluation.
- **Do not modify files outside your domain** without asking.
- **Always run `npx tsc --noEmit` and `npx vitest run`** after changes.

### Key Directories
```
src/orchestrator/          ← YOUR PRIMARY DOMAIN
  ralph-loop.ts            ← Core execution loop (1230 lines)
  ralph-loop-types.ts      ← Type definitions (154 lines)
  lifecycle-hooks.ts       ← Hook registry (273 lines)
  lifecycle-wiring.ts      ← Feature→hook wiring (299 lines)
  lifecycle/               ← Lifecycle subdirectory
  layers/                  ← L0-L3 hierarchy
  __tests__/               ← Integration tests

src/                       ← Feature modules (Kimi creates these)
  wellbeing/               ← R16-05 (117 tests)
  recovery/                ← R17-01 (93 tests)
  init/                    ← R17-02 (109 tests)
  memory/                  ← R16-02 agent memory
  portfolio/               ← R16-01 cross-project
  generative-ui/           ← R16-03
  testing/                 ← R16-04 autonomous testing
  review/                  ← R17-03 code review
  a11y/                    ← R17-06 accessibility
  debt/                    ← R17-07 technical debt
  prod-feedback/           ← R17-09 production feedback
  health/                  ← R17-10 health dashboard
  model-routing/           ← R22-01 (Kimi in progress, UNTRACKED)
  tools/perplexity/        ← PERP-01 (Kimi in progress, UNTRACKED)
  workflow-engine/         ← R23-01 (Kimi in progress, UNTRACKED)
  sandbox/                 ← R23-02 (CUT TASK — DELETE THESE FILES)

.nova/TASK-BOARD.md        ← Master coordination file
.prompts/                  ← Sprint prompts for all agents
```

---

## Your Tasks (Do Them In Order)

### Task S-01-01: Fix P0 — Deduplicate RalphLoopOptions

**Problem**: `RalphLoopOptions` is defined in TWO places:
1. `src/orchestrator/ralph-loop.ts` (line 85) — the original, 38 fields
2. `src/orchestrator/ralph-loop-types.ts` — newer copy with R19/R20 fields that DON'T exist in ralph-loop.ts

**Fix**:
1. Read both files and diff the interfaces
2. Merge all fields into `ralph-loop-types.ts` as the single source of truth
3. In `ralph-loop.ts`, delete the local `RalphLoopOptions` interface and add:
   ```typescript
   import type { RalphLoopOptions } from './ralph-loop-types.js';
   export type { RalphLoopOptions };
   ```
4. Also move the 5 placeholder config interfaces (`MigrationModuleConfig`, `DebugModuleConfig`, `DependencyModuleConfig`, `EnvModuleConfig`, `OrchestrationModuleConfig`) to ralph-loop-types.ts
5. Fix any imports across the codebase that import `RalphLoopOptions` from ralph-loop.ts
6. Run `npx tsc --noEmit` → 0 errors

### Task S-01-02: Wire 4 Missing Modules into Lifecycle Wiring

**Problem**: 4 feature modules have config fields and type imports in ralph-loop.ts but are NOT wired into `lifecycle-wiring.ts`:
- `agentMemory` (R16-02) — `options.agentMemoryEnabled`
- `wellbeing` (R16-05) — `options.wellbeingEnabled`
- `advancedRecovery` (R17-01) — `options.advancedRecoveryEnabled`
- `advancedInit` (R17-02) — `options.advancedInitEnabled`

**Fix**:
1. In `lifecycle-wiring.ts`, add entries to `DEFAULT_FEATURE_HOOKS`:
   ```typescript
   agentMemory: {
     moduleName: 'agent-memory',
     phases: { onBeforeBuild: true, onAfterTask: true },
     priority: 45,
   },
   wellbeing: {
     moduleName: 'wellbeing',
     phases: { onBeforeTask: true, onAfterTask: true, onBuildComplete: true },
     priority: 35,
   },
   advancedRecovery: {
     moduleName: 'advanced-recovery',
     phases: { onTaskError: true },
     priority: 15,
   },
   advancedInit: {
     moduleName: 'advanced-init',
     phases: { onBeforeBuild: true },
     priority: 5,
   },
   ```
2. Add to the `featureFlags` map in `wireFeatureHooks()`:
   ```typescript
   agentMemory: options.agentMemoryEnabled,
   wellbeing: options.wellbeingEnabled,
   advancedRecovery: options.advancedRecoveryEnabled,
   advancedInit: options.advancedInitEnabled,
   ```
3. Do the same in `getWiringSummary()`
4. Run `npx tsc --noEmit` → 0 errors

### Task S-01-03: Delete Cut R23-02 Sandbox Artifacts

**Problem**: Kimi started implementing R23-02 (MicroVM/WASI Ultra-Sandbox) before we cut it. The files exist in `src/sandbox/` but this task is CUT (Firecracker requires Linux KVM, no macOS support).

**Fix**:
1. Delete these untracked files:
   - `src/sandbox/firecracker-adapter.ts`
   - `src/sandbox/index.ts`
   - `src/sandbox/opa-policy-engine.ts`
   - `src/sandbox/security/` (entire directory)
   - `src/sandbox/types.ts`
   - `src/sandbox/ultra-sandbox-manager.ts`
   - `src/sandbox/wasi-bridge.ts`
2. Check if any other files import from `src/sandbox/` and remove those imports
3. Run `npx tsc --noEmit` → 0 errors

### Task S-01-04: Extract Shared Failure Handler from processTask()

**Problem**: `processTask()` in ralph-loop.ts is 450+ lines with 3 near-identical failure paths (~lines 1037, 1066, 1112). Each does:
- Taste Vault failure recording
- ACE outcome recording (getSelfImprovementProtocol().recordOutcome)
- Playbook rule cleanup (clearInjectedPlaybookRuleIds, recordTaskApplied)
- Analytics recording (recordTaskResult)

**Fix**:
1. Extract a `handleTaskFailure()` helper function that takes the shared parameters
2. Replace all 3 failure paths with calls to the helper
3. Keep the function in ralph-loop.ts (no need for a separate file)
4. Run `npx tsc --noEmit` → 0 errors
5. Run `npx vitest run` → all tests pass

### Task S-01-05: Add Integration Tests for Lifecycle Wiring

**File**: `src/orchestrator/__tests__/lifecycle-wiring.test.ts`
**Tests**: 30 vitest cases minimum

Test these scenarios:
1. `wireFeatureHooks()` with all 17 features enabled → correct hook count
2. `wireFeatureHooks()` with no features enabled → 0 hooks
3. `wireFeatureHooks()` with partial features → only enabled hooks registered
4. Priority ordering is correct (advancedInit=5 runs before productionFeedback=110)
5. `getWiringSummary()` accuracy for all combinations
6. HookRegistry phase execution order respects priority
7. Error isolation: one failing hook doesn't crash others
8. `getRegisteredModules()` returns unique module names
9. Singleton registry reset between tests
10. Each feature's phase configuration is correct (e.g., debug only has onTaskError)

### Task S-01-06: Evaluate + Integrate Kimi R22-R24 Deliveries

**Context**: Kimi is working on 7 tasks from `.prompts/kimi-r22-r24-mega-sprint.md`. As deliveries arrive (untracked files in src/), you:

1. Read all new files
2. Run `npx tsc --noEmit` — fix any TS errors
3. Run `npx vitest run` — verify all tests pass
4. Check ESM `.js` imports (no bare `.ts` imports)
5. Check for `any` types (must use `unknown` + type guards)
6. If Kimi delivered files for a CUT task, delete them (R23-02, R23-04, R24-02, R24-04)
7. Commit passing code with descriptive messages

**Currently untracked (Kimi in progress)**:
- `src/model-routing/` — R22-01 Agent Model Routing (KEEP — active task)
- `src/tools/perplexity/` — PERP-01 Perplexity Research (KEEP — active task)
- `src/workflow-engine/` — R23-01 Visual Workflow Engine (KEEP — active task)
- `src/sandbox/` — R23-02 MicroVM (DELETE — CUT task)

---

## Execution Order

Do tasks 1→5 first (they're sequential), then task 6 is ongoing:

1. **S-01-01** — Dedup RalphLoopOptions (unblocks S-01-02)
2. **S-01-02** — Wire 4 missing modules (depends on S-01-01)
3. **S-01-03** — Delete sandbox artifacts (independent, quick)
4. **S-01-04** — Extract failure handler (independent)
5. **S-01-05** — Integration tests (depends on S-01-01 + S-01-02)
6. **S-01-06** — Evaluate Kimi deliveries (ongoing, do between other tasks)

---

## Final Checklist

After all tasks:
1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → all tests pass (4,007+ existing + 30+ new)
3. No `any` types
4. ESM `.js` imports throughout
5. `RalphLoopOptions` exists in exactly ONE place (ralph-loop-types.ts)
6. All 17 feature modules wired in lifecycle-wiring.ts
7. No src/sandbox/ files from cut R23-02 task
8. processTask() failure paths deduplicated

---

## Commit Format

```
<type>(<scope>): <description>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Types: `fix`, `refactor`, `test`, `feat`
Scopes: `orchestrator`, `lifecycle`, `wiring`, `integration`
