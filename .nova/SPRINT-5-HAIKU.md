# HAIKU 3.5 — Sprint 5: "The Eternal Sentinel"
## February 22–24, 2026 (48 Hours)

> **Provider**: Anthropic (Claude Haiku)
> **Sprint 4 Status**: COMPLETE (fixed 120+ test failures, pushed as 9badff3)
> **Sprint 5 Focus**: Test coverage hardening + Sonnet reconciliation + Property-based test sweep
> **Duration**: 48 hours (4 waves × 12 hours)
> **Project folder**: `/Users/jonathannelsen/nova26/kiro/nova26`
> **Git HEAD**: 9badff3 on main

---

## SPRINT 4 RECAP

Fixed 120+ test failures across the codebase. All ~8464 tests passing, 0 TS errors. Pushed as 9badff3.

---

## SPRINT 5 MISSION

Three objectives:

1. **Sonnet Reconciliation** (P0): Sonnet is pushing Sprint 2 code (hypercore, hypervisor, a2a — 336 new tests). Their `crdt-core.ts` rewrite may cause ~119 test failures. You fix them.
2. **Test Coverage Hardening**: Write comprehensive tests for thin-coverage modules that NO other worker is touching this sprint.
3. **Property-Based Test Sweep**: Add fast-check PBTs to modules that have unit tests but no property tests.

**DO NOT** modify source files unless a test reveals a genuine bug. Your primary output is test files.

---

## SPRINT 5 RULES

- TypeScript strict, ESM `.js` imports, vitest, no `any`
- Property-based tests use `fast-check` (already in dependencies)
- Import from source files using relative `.js` extension: `import { Foo } from './foo.js'`
- Run `tsc --noEmit` after each task — must be 0 errors
- Run `vitest run src/<module>/` after each task — must pass
- Commit after each task: `test(H5-XX): <description>`
- Push after each wave checkpoint
- If a test reveals a real bug in source code, fix it and note in commit: `fix(H5-XX): <bug> + test coverage`

---

## DO-NOT-TOUCH ZONES (Other Workers Active)

| Module | Owner | Sprint |
|--------|-------|--------|
| `src/saga/` | Kimi | Sprint 3 → 4 |
| `src/rlm/` | Kimi | Sprint 3 → 4 |
| `src/harness/` | Kimi | Sprint 3 → 4 |
| `src/hindsight/` | Kimi | Sprint 3 → 4 |
| `src/eternal-reel/` | Kimi | Sprint 3 |
| `src/hypercore/` | Sonnet | Sprint 3 |
| `src/hypervisor/` | Sonnet | Sprint 3 |
| `src/a2a/` | Sonnet | Sprint 3 |
| `convex/`, `app/` | Sonnet | Sprint 3 |

**YOUR MODULES** (safe to test, no other worker touching):
- `src/model-routing/` (11 src, 2 test)
- `src/acp/` (6 src, 1 test) — Kimi touches in Sprint 4, you're clear for Sprint 5
- `src/compliance/` (6 src, 1 test) — Kimi touches in Sprint 4, you're clear for Sprint 5
- `src/models/` (6 src, 2 test)
- `src/mcp/` (5 src, 1 test) — Kimi touches in Sprint 4, you're clear for Sprint 5
- `src/behaviors/` (8 src, 1 test)
- `src/collaboration/` (8 src, 5 test) — may need reconciliation
- `src/integrations/` (11 src, 7 test)
- `src/llm/` (8 src, 5 test)
- `src/observability/` (14 src, 7 test)
- `src/atlas/` (17 src, 7 test)

---

## CODEBASE CONTEXT

- ~296 test files, ~8464 tests, 0 failures, 0 TS errors
- Two CRDTDocument types exist: one in `types.ts` (spec/view), one in `crdt-core.ts` (implementation). Lifecycle adapter bridges them.
- Sonnet will push Sprint 2 early in their Sprint 3 (Wave 1). Expect conflicts.

---

## WAVE 1 (Hours 0–12): Sonnet Reconciliation + Collaboration Hardening

> Priority: Fix whatever breaks when Sonnet pushes Sprint 2

### Task H5-01: Pull + Assess Damage
- `git pull origin main`
- Run `tsc --noEmit` — count errors
- Run `vitest run` — count failures
- Categorize failures: crdt-core type changes, import path shifts, schema changes, new module conflicts
- If Sonnet hasn't pushed yet, proceed to Wave 2 and come back when they do

### Task H5-02: Fix CRDT-Related Failures
- Focus on `src/collaboration/` failures first — this is the likely epicenter
- Reconcile the two CRDTDocument types if Sonnet's rewrite changed the interface
- Update lifecycle adapter if needed
- Fix any downstream modules that import from collaboration/

### Task H5-03: Fix Remaining Failures
- Fix all other test failures from Sonnet's push
- Do NOT rewrite Sonnet's code — adapt existing tests and type bridges
- If a failure is in a module you don't own, make the minimal fix needed

### Task H5-04: Collaboration Module Deep Tests
After reconciliation, harden `src/collaboration/` (8 src, 5 test):
- Create `src/collaboration/__tests__/crdt-deep.test.ts`
- Test CRDT merge operations, conflict resolution, concurrent edits
- Test sync manager: connect, disconnect, reconnect, partial sync
- Property tests: CRDT commutativity (merge order doesn't matter), convergence (all replicas reach same state)

### Task H5-05: Wave 1 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests — must pass.
Commit + push: `test(H5-05): Sonnet reconciliation + collaboration deep tests`

---

## WAVE 2 (Hours 12–24): Atlas + Observability + LLM Coverage

> Target: `src/atlas/` (17 src, 7 test), `src/observability/` (14 src, 7 test), `src/llm/` (8 src, 5 test)
> These are large modules with decent but not comprehensive test coverage

### Task H5-06: Atlas — Untested Source Files
Read all source files in `src/atlas/` — identify which of the 17 src files lack test coverage.
Create `src/atlas/__tests__/atlas-deep.test.ts`:
- Test any untested atlas functions: graph operations, memory compaction, context retrieval
- Test edge cases: empty graph, circular references, large datasets
- Property tests: graph memory consistency (add node → retrieve node always works), compaction preserves important nodes

### Task H5-07: Observability — Untested Source Files
Read all source files in `src/observability/` — identify which of the 14 src files lack test coverage.
Create `src/observability/__tests__/observability-deep.test.ts`:
- Test NovaTracer: span creation, nesting, timing, export
- Test EventStore: store, query, retention, aggregation
- Test any untested metrics collectors or formatters
- Property tests: span nesting validity (child spans within parent bounds), event ordering (stored events maintain chronological order)

### Task H5-08: LLM — Untested Source Files
Read all source files in `src/llm/` — identify which of the 8 src files lack test coverage.
Create `src/llm/__tests__/llm-deep.test.ts`:
- Test model router: selection logic, fallback, cost optimization
- Test any untested LLM utilities: token counting, prompt building, response parsing
- Property tests: token count is always non-negative, model selection always returns from available pool

### Task H5-09: Wave 2 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/atlas/ src/observability/ src/llm/` — all pass.
Commit + push: `test(H5-09): Atlas + Observability + LLM deep test coverage`

---

## WAVE 3 (Hours 24–36): Integrations + Model Routing + Behaviors

> Target: `src/integrations/` (11 src, 7 test), `src/model-routing/` (11 src, 2 test), `src/behaviors/` (8 src, 1 test)

### Task H5-10: Integrations — Gap Coverage
Read all source files in `src/integrations/` — identify untested files.
Create `src/integrations/__tests__/integrations-deep.test.ts`:
- Test any untested integration adapters: Stripe, Ollama, webhooks
- Test error handling: timeout, retry, malformed responses
- Property tests: integration adapter always returns structured response (success or error, never throws unhandled)

### Task H5-11: Model Routing — Full Coverage
Read all source files in `src/model-routing/`.
Create `src/model-routing/__tests__/router-deep.test.ts`:
- Test router: route selection, fallback, preference matching
- Test inference queue: priority ordering, capacity limits, timeout
- Test speculative decoder: decode, verify, accept/reject
- Property tests: queue ordering invariant (higher priority first), router always selects or returns explicit fallback

### Task H5-12: Model Routing — Metrics + Hardware + Bench
Create `src/model-routing/__tests__/metrics-hardware.test.ts`:
- Test metrics tracker: record, aggregate, reset, time-window queries
- Test hardware detector: capability detection, memory limits
- Test NovaBench: benchmark execution, scoring
- Test Modelfile generator: valid syntax, parameter injection
- Property tests: metrics aggregation commutativity, Modelfile always contains FROM directive

### Task H5-13: Behaviors — Full Coverage
Read all source files in `src/behaviors/`.
Create `src/behaviors/__tests__/behaviors-deep.test.ts`:
- Test all exported behavior functions/classes
- Test composition, chaining, error propagation
- Property tests: behavior composition associativity where applicable

### Task H5-14: Wave 3 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/integrations/ src/model-routing/ src/behaviors/` — all pass.
Commit + push: `test(H5-14): Integrations + Model Routing + Behaviors deep coverage`

---

## WAVE 4 (Hours 36–48): PBT Sweep + Models + Final Sweep

> Target: Add property-based tests to modules that have unit tests but no PBTs

### Task H5-15: Models — Ensemble + Router Tests
Read all source files in `src/models/`.
Create `src/models/__tests__/ensemble-deep.test.ts`:
- Test ensemble engine: voting, confidence weighting, disagreement handling
- Test model router: task-type routing, fallback chain, cost optimization
- Property tests: ensemble determinism, router always selects from available models

### Task H5-16: PBT Sweep — Config + Tools + Memory
Add property-based tests to modules that have unit tests but no PBTs:
- `src/config/`: Create `src/config/__tests__/config-pbt.test.ts`
  - Property: config merge is associative, feature flag evaluation is deterministic
- `src/tools/`: Create `src/tools/__tests__/tools-pbt.test.ts`
  - Property: tool registry lookup round-trip, tool execution always returns structured result
- `src/memory/`: Create `src/memory/__tests__/memory-pbt.test.ts`
  - Property: memory store/retrieve round-trip, memory compression preserves key data

### Task H5-17: PBT Sweep — Recovery + Workflow + Testing
Add property-based tests to more modules:
- `src/recovery/`: Create `src/recovery/__tests__/recovery-pbt.test.ts`
  - Property: circuit breaker state machine validity, retry backoff is monotonically increasing
- `src/workflow/`: Create `src/workflow/__tests__/workflow-pbt.test.ts`
  - Property: workflow step ordering respects dependencies, workflow completion is deterministic
- `src/testing/`: Create `src/testing/__tests__/testing-pbt.test.ts`
  - Property: mock factory produces valid mocks, snapshot comparison is symmetric

### Task H5-18: Cross-Module Smoke Tests
Create `src/__tests__/cross-module-smoke.test.ts`:
- Smoke test: model-routing → models (router selects from model vault)
- Smoke test: collaboration → atlas (CRDT changes reflected in atlas)
- Smoke test: observability → any module (telemetry captured)
- Smoke test: llm → model-routing (LLM calls route through model routing)
Lightweight integration tests — verify wiring, not deep logic.

### Task H5-19: Kimi Reconciliation (If Needed)
**CONDITIONAL**: Only execute if Kimi has pushed Sprint 3 work and `git pull` introduces failures.
- Pull latest
- Run `vitest run` — identify failures
- Fix all failures from Kimi's new modules (hindsight, eternal-reel, etc.)
- Do NOT rewrite Kimi's code — adapt tests and bridges

### Task H5-20: Final Sweep
Run full test suite: `vitest run`
- Fix any remaining failures
- Run `tsc --noEmit` — 0 errors
- Document remaining thin-coverage modules in commit message

### Task H5-21: Final Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests — must pass.
Commit + push: `test(H5-21): Sprint 5 complete — reconciliation + 10 modules hardened + PBT sweep`

---

## TASK COUNT SUMMARY

| Wave | Hours | Tasks | Focus |
|------|-------|-------|-------|
| Wave 1 | 0–12 | H5-01 → H5-05 | Sonnet reconciliation + collaboration |
| Wave 2 | 12–24 | H5-06 → H5-09 | Atlas + Observability + LLM deep coverage |
| Wave 3 | 24–36 | H5-10 → H5-14 | Integrations + Model Routing + Behaviors |
| Wave 4 | 36–48 | H5-15 → H5-21 | Models + PBT sweep + smoke tests + final |
| **TOTAL** | **48h** | **21 tasks** | **~12 modules hardened, ~100+ new tests expected** |

---

## PRIORITY ORDER (If Running Behind)

1. **H5-01 → H5-03** (Sonnet Reconciliation) — P0, blocks everyone
2. **Wave 3** (Model Routing + Behaviors) — thinnest coverage
3. **Wave 2** (Atlas + Observability + LLM) — large modules, moderate coverage
4. **Wave 4 H5-15** (Models) — thin coverage
5. **Wave 4 H5-16-17** (PBT sweep) — quality improvement
6. **Wave 1 H5-04** (Collaboration deep) — already has 5 test files
7. **Wave 4 H5-18-19** (Smoke + Kimi reconciliation) — nice-to-have

---

## APPROACH GUIDE

For each module, follow this pattern:

1. **Read all source files** — understand exports, types, logic
2. **Read existing tests** — understand what's covered, match style
3. **Identify untested functions/classes** — these are your targets
4. **Write unit tests first** — happy path, then edge cases
5. **Write property-based tests** — identify invariants for all inputs
6. **Run and fix** — if tests reveal bugs, fix source and note in commit

### Property Test Patterns to Look For
- **Round-trip**: serialize → deserialize produces original
- **Idempotency**: applying operation twice = applying once
- **Monotonicity**: values only increase (counters, append-only logs)
- **Commutativity**: order doesn't matter (set operations, metrics aggregation)
- **State machine validity**: only valid transitions occur
- **Invariant preservation**: property holds before and after any operation
- **Convergence**: distributed replicas reach same state regardless of message order

---

## ESTIMATED DELIVERABLES

By end of Sprint 5, Haiku will have delivered:
- **Sonnet reconciliation**: 0 failures after merge (if applicable)
- **Kimi reconciliation**: 0 failures after merge (if applicable)
- **~15 new test files** across ~12 modules
- **~100+ new test cases** (unit + property-based)
- **~25 property-based tests** using fast-check
- **Cross-module smoke tests** verifying integration wiring
- **0 regressions** — all existing tests still passing

---

*Sprint 5 created by Kiro (Opus 4.6) — February 22, 2026*
