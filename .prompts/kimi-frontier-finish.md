# KIMI TASK FILE — Frontier Sprint Finish (Resume from Step Limit)

> Owner: Kimi
> Priority: CRITICAL — resume interrupted frontier sprint
> Context: Kimi hit the 100-step limit mid-sprint at KIMI-FRONTIER-04 (personality-engine.ts tests)
> Test baseline to restore: 1445 passing, 0 TS errors
> Goal: fix broken tests, complete any incomplete tasks, commit to main

---

## Situation

You were working on the KIMI-FRONTIER-01 through 06 sprint and hit the 100-step execution
limit. Before starting any new work, you must assess what state the codebase is actually in.
Do not assume anything — run the checks and let the output tell you.

**The wrong approach:** starting tasks from scratch, re-writing files that already exist,
or committing before confirming tests pass.

**The right approach:** check current state, fix what is broken, complete only what is
missing, verify everything, then commit.

---

## Step 1 — Assess current state (do this FIRST, before touching any code)

Run both checks and read the output carefully:

```bash
# Check TypeScript errors
npx tsc --noEmit

# Check test results — note which test files are failing and why
npx vitest run
```

From the output, identify:

1. How many tests are currently passing vs failing
2. Which specific test files have failures (look for FAIL lines in vitest output)
3. What the TypeScript error count is
4. Which of these frontier files already exist on disk:
   - `src/agents/message-bus.ts` and `src/agents/blackboard.ts` (FRONTIER-01)
   - `src/tools/semantic-search.ts` (FRONTIER-02)
   - `src/orchestrator/predictive-decomposer.ts` (FRONTIER-03)
   - `src/agents/personality-engine.ts` (FRONTIER-04)
   - `src/sync/offline-engine.ts` (FRONTIER-05)
   - All corresponding `.test.ts` files (FRONTIER-06)

---

## Step 2 — Fix personality-engine.ts issues (FRONTIER-04)

This is the known broken task. The tests in `src/agents/personality-engine.test.ts` were
28/37 passing when the step limit was hit.

### Known issues to fix

**Issue A: `version` field missing from PersonalityProfile**

The test at line 129 of `personality-engine.test.ts` does:
```typescript
expect(updated.version).toBeGreaterThan(initial.version);
```

But `PersonalityProfile` has no `version` field. You must:

1. Add `version: number` to the `PersonalityProfile` interface
2. Update the `PersonalityDimensionsSchema` (Zod) to include `version: z.number().int().nonneg()`
3. In `getDefaultProfile()`, set `version: 0` on all returned profiles
4. In `applySignal()`, increment `profile.version` each time a signal is applied
   (increment it after applying dimension adjustments, before saving)
5. Handle any loaded profiles that pre-date this field: if `version` is undefined after
   loading from disk, default it to 0

**Issue B: PLUTO default profile — verbosity expectation mismatch**

The test at line 82-84 checks:
```typescript
const profile = engine.getDefaultProfile('PLUTO');
expect(profile.agentName).toBe('PLUTO');
expect(profile.dimensions.verbosity).toBeGreaterThan(7);  // expects > 7
```

But the current PLUTO default is `verbosity: 5`. Change PLUTO's default to:
```typescript
PLUTO: { verbosity: 8, formality: 7, explanationDepth: 7, technicalDensity: 8, encouragement: 3 }
```
(PLUTO is the tester — testers write exhaustive test reports, so high verbosity makes
sense for their written output.)

**Issue C: URANUS missing from AgentName type**

The test references `getDefaultProfile('URANUS')` but URANUS is not in the `AgentName`
type union in `src/agents/message-bus.ts`. You must add URANUS to the AgentName type:

In `src/agents/message-bus.ts`, change:
```typescript
export type AgentName =
  | 'MARS' | 'VENUS' | 'MERCURY' | 'JUPITER' | 'SATURN' | 'PLUTO'
  | 'ATLAS' | 'GANYMEDE' | 'IO' | 'CALLISTO' | 'MIMAS' | 'NEPTUNE'
  | 'ANDROMEDA' | 'ENCELADUS' | 'SUN' | 'EARTH' | 'RALPH';
```
to:
```typescript
export type AgentName =
  | 'MARS' | 'VENUS' | 'MERCURY' | 'JUPITER' | 'SATURN' | 'PLUTO'
  | 'ATLAS' | 'GANYMEDE' | 'IO' | 'CALLISTO' | 'MIMAS' | 'NEPTUNE'
  | 'ANDROMEDA' | 'ENCELADUS' | 'SUN' | 'EARTH' | 'RALPH' | 'URANUS';
```

Also add URANUS to the `getAllProfiles()` method in `personality-engine.ts` so it is
included when loading all profiles.

**Issue D: URANUS default profile expectations**

The test checks:
```typescript
expect(profile.dimensions.verbosity).toBeLessThan(5);  // expects < 5
```

The current URANUS default is `verbosity: 4` which satisfies `< 5`. Confirm this is
already correct. If URANUS is missing from the defaults map entirely, add it:
```typescript
URANUS: { verbosity: 4, formality: 5, explanationDepth: 5, technicalDensity: 8, encouragement: 2 }
```

**Issue E: EARTH default profile expectations**

The test checks:
```typescript
expect(profile.dimensions.explanationDepth).toBeGreaterThan(7);  // expects > 7
```

The current EARTH default is `explanationDepth: 9` which satisfies `> 7`. Confirm this
is already correct.

**Issue F: VENUS encouragement for "unknown agent" fallback test**

Line 110-116 of the test:
```typescript
it('getDefaultProfile() returns VENUS profile for unknown agent', () => {
  const profile = engine.getDefaultProfile('UNKNOWN' as any);
  // Falls back to VENUS profile
  expect(profile.dimensions.encouragement).toBeGreaterThan(7);
});
```

The fallback defaults are `encouragement: 5` which does NOT satisfy `> 7`. The test
comment says "Falls back to VENUS profile." Change the fallback to actually use VENUS
dimensions:

In `getDefaultProfile()`, when the agent is not found in the `defaults` map, return the
VENUS dimensions instead of the generic balanced defaults:
```typescript
const dimensions = defaults[agentName] ?? defaults['VENUS']!;
```

### After fixing personality-engine.ts

Run just the personality tests to confirm all pass before moving on:
```bash
npx vitest run src/agents/personality-engine.test.ts
```

All tests in that file must pass before proceeding.

---

## Step 3 — Verify each frontier task is complete

After fixing the personality engine, check each remaining frontier task. For each one,
confirm: (a) the implementation file exists, (b) the test file exists, and (c) the tests
pass. Only do work for tasks that are missing or broken.

### FRONTIER-01: Agent-to-Agent Communication

Check:
```bash
ls src/agents/message-bus.ts src/agents/blackboard.ts
npx vitest run src/agents/message-bus.test.ts
```

If the files exist and tests pass: mark complete, move on.

If tests fail: read the test file to understand what is expected, then fix the
implementation. The spec is in `kimi-frontier-sprint.md` KIMI-FRONTIER-01 section.

Key implementation requirements (for reference if incomplete):
- `AgentMessageBus`: `send()`, `subscribe()`, `getThread()`, `getInbox()`, `markRead()`,
  `getUnread()`, `clearTask()` — all in-memory
- `NegotiationProtocol`: `openNegotiation()`, `respondToNegotiation()`, `resolve()`,
  `escalate()`, `getOpenNegotiations()`, `shouldTriggerNegotiation()`
- `SharedBlackboard` (in `blackboard.ts`): `write()`, `read()`, `readAll()`, `supersede()`,
  `snapshot()`, `clear()`, `formatForPrompt()`
- Singleton factories: `getAgentMessageBus()`, `resetAgentMessageBus()`,
  `getNegotiationProtocol()`, `resetNegotiationProtocol()`,
  `getSharedBlackboard()`, `resetSharedBlackboard()`
- Commit format: `feat(frontier): KIMI-FRONTIER-01 agent-to-agent communication — message bus, blackboard, negotiation protocol`

### FRONTIER-02: Semantic Code Search

Check:
```bash
ls src/tools/semantic-search.ts
npx vitest run src/tools/semantic-search.test.ts
```

If the file exists and tests pass: mark complete, move on.

Key implementation requirements (for reference if incomplete):
- `CodeIndex` class: `buildIndex()`, `parseFile()`, `embedUnit()`, `query()`,
  `analyzeImpact()`, `saveIndex()`, `loadIndex()`, `incrementalUpdate()`,
  `detectChangedFiles()`, `getStats()`
- `parseFile()` uses TypeScript Compiler API (`import ts from 'typescript'`) — no new deps
- Embeddings use `getSemanticDedup().embed()` from `src/similarity/semantic-dedup.ts`
  (read that file before calling — confirm exact method signature)
- Index persisted at `.nova/code-index/{projectHash}.json`
- Singleton factory: `getCodeIndex()`, `resetCodeIndex()`
- Commit format: `feat(frontier): KIMI-FRONTIER-02 semantic code search — TypeScript AST indexing, embedding, impact analysis`

### FRONTIER-03: Predictive Task Decomposition

Check:
```bash
ls src/orchestrator/predictive-decomposer.ts
npx vitest run src/orchestrator/predictive-decomposer.test.ts
```

If the file exists and tests pass: mark complete, move on.

Key implementation requirements (for reference if incomplete):
- `PredictiveDecomposer` class: `predictDecomposition()`, `learnFromBuild()`,
  `extractTemplate()`, `saveTemplate()`, `loadTemplates()`, `deleteTemplate()`, `getStats()`
- Templates persisted at `.nova/templates/decomposition/{templateId}.json`
- Similarity matching uses `getSemanticDedup().embed()` + cosine similarity
- Singleton factory: `getPredictiveDecomposer()`, `resetPredictiveDecomposer()`
- Commit format: `feat(frontier): KIMI-FRONTIER-03 predictive task decomposition — template learning, similarity matching, JUPITER integration`

### FRONTIER-04: Adaptive Agent Personality — ALREADY BEING FIXED IN STEP 2

Once Step 2 is complete and all personality tests pass, commit:
```
feat(frontier): KIMI-FRONTIER-04 adaptive agent personality — 5-dimension profiles, signal learning, prompt injection
```

### FRONTIER-05: Offline-First Engine

Check:
```bash
ls src/sync/offline-engine.ts
npx vitest run src/sync/offline-engine.test.ts
```

If the file exists and tests pass: mark complete, move on.

Key implementation requirements (for reference if incomplete):
- `OfflineEngine` class using `better-sqlite3` (synchronous, already available)
- SQLite tables: `kv_store` (namespace/key/value), `sync_queue` (mutation buffering)
- Methods: `checkConnectivity()`, `startMonitoring()`, `stopMonitoring()`, `on()` (events),
  `initStore()`, `storeLocal()`, `loadLocal()`, `loadAllLocal()`, `deleteLocal()`,
  `enqueue()`, `flush()`, `getPendingCount()`, `getFailedCount()`, `clearSynced()`,
  `resolveConflict()`, `isAvailable()`, `getUnavailableMessage()`, `close()`
- `conflictStrategies`: `local-wins` (user-content), `union-merge` (tags-metadata),
  `server-wins` (computed-fields)
- `featureMatrix`: hardcoded availability for agent-loop, taste-vault-read/write,
  global-wisdom-sync, docs-fetcher, convex-analytics, semantic-search
- Singleton factory: `getOfflineEngine()`, `resetOfflineEngine()`
- Commit format: `feat(frontier): KIMI-FRONTIER-05 offline-first engine — SQLite store, sync queue, conflict resolution, connectivity detection`

---

## Step 4 — Complete FRONTIER-06 tests if any are missing

If all five implementation files exist and their test files exist, skip this step.

If any test files are missing, write them following the spec in `kimi-frontier-sprint.md`
KIMI-FRONTIER-06 section. The test files and target coverage are:

- `src/agents/message-bus.test.ts` — ~20 tests (includes blackboard and NegotiationProtocol)
- `src/tools/semantic-search.test.ts` — ~25 tests
- `src/orchestrator/predictive-decomposer.test.ts` — ~20 tests
- `src/agents/personality-engine.test.ts` — ~37 tests (already exists, fixing in Step 2)
- `src/sync/offline-engine.test.ts` — ~20 tests

All new tests must use:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
```

Call the corresponding `reset*()` singleton factory in `beforeEach` for each test suite.
Use `vi.stubGlobal('fetch', ...)` for offline-engine connectivity and Convex call mocking.
Use temporary directories (from `os.tmpdir()`) for any file system operations in tests.

---

## Step 5 — Final verification before committing

Run the full suite and confirm:

```bash
# Must be 0 errors
npx tsc --noEmit

# Must be 1445 + all new tests passing, 0 failing
npx vitest run
```

If there are TS errors or failing tests, fix them before committing. Do not commit a
broken state.

---

## Step 6 — Commit each completed task to main

Commit in this order (only commit tasks that were actually completed or fixed in this
session — skip ones that were already committed in the prior run):

```
feat(frontier): KIMI-FRONTIER-01 agent-to-agent communication — message bus, blackboard, negotiation protocol
feat(frontier): KIMI-FRONTIER-02 semantic code search — TypeScript AST indexing, embedding, impact analysis
feat(frontier): KIMI-FRONTIER-03 predictive task decomposition — template learning, similarity matching, JUPITER integration
feat(frontier): KIMI-FRONTIER-04 adaptive agent personality — 5-dimension profiles, signal learning, prompt injection
feat(frontier): KIMI-FRONTIER-05 offline-first engine — SQLite store, sync queue, conflict resolution, connectivity detection
feat(frontier): KIMI-FRONTIER-06 100+ tests for message bus, semantic search, decomposer, personality, offline engine
```

Each commit must have `npx tsc --noEmit` and `npx vitest run` passing at the time of commit.

---

## Global Rules

- **TypeScript strict mode** — no `any`, no implicit `any`, no `@ts-ignore`
- **ESM imports** — always use `.js` extensions on relative imports
  (e.g., `import { Foo } from './foo.js'`)
- **Zod for all external/runtime data validation** — validate at system boundaries,
  especially when reading persisted JSON files
- **Tests with vitest** — all new tests use `import { describe, it, expect, vi } from 'vitest'`
- **Do not break existing tests** — `npx vitest run` must show 1445+ passing total
- **Zero TypeScript errors** — `npx tsc --noEmit` must report 0 errors after every task
- **Read existing files before modifying them** — every integration point must be read in
  full before any edits; never blindly overwrite
- **Singleton factory pattern** — `class Foo` is not exported directly; only `getFoo()` and
  `resetFoo()` are exported. This is how every Nova26 module is structured
- **File header comments** — every new file starts with a 2-line comment:
  `// <Short description>\n// <Which spec this implements>`
- **No new npm dependencies** — `zod`, `vitest`, `better-sqlite3`, `typescript`, and the
  TypeScript Compiler API are all already available. Do not add libraries
- **Commit to main** — one commit per completed KIMI-FRONTIER task

---

## Key file locations for reference

- `src/agents/message-bus.ts` — AgentName type, AgentMessageBus, NegotiationProtocol
- `src/agents/blackboard.ts` — SharedBlackboard
- `src/agents/personality-engine.ts` — PersonalityEngine (BEING FIXED)
- `src/tools/semantic-search.ts` — CodeIndex
- `src/orchestrator/predictive-decomposer.ts` — PredictiveDecomposer
- `src/sync/offline-engine.ts` — OfflineEngine
- `src/similarity/semantic-dedup.ts` — read this before calling `.embed()` anywhere
- `src/tools/core-tools.ts` — read before adding new tools (readBlackboard, writeBlackboard,
  semanticSearch, impactAnalysis)
- `src/agent-loop/agent-loop.ts` — read before adding message bus integration
- `src/orchestrator/ralph-loop.ts` — read before adding predictive decomposer + offline
  engine integration
- `src/orchestrator/prompt-builder.ts` — read before adding personality injection
- `kimi-frontier-sprint.md` — full original spec for all six tasks; consult for any detail
  not covered here
