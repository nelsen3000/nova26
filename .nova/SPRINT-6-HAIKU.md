# HAIKU 3.5 — Sprint 6: "The Eternal Guardian"
## February 24–26, 2026 (48 Hours)

> **Provider**: Anthropic (Claude Haiku)
> **Sprint 5 Status**: IN PROGRESS — H5-01 through H5-08 complete (model-routing 5 test files, ACP 1 test file, compliance 1 test file, MCP 1 test file). Unpushed local commits on b2d0cf3.
> **Sprint 6 Focus**: Complete Sprint 5 remaining tasks + PBT sweep + deep coverage for Atlas, Observability, LLM, Integrations + reconciliation duty
> **Duration**: 48 hours (4 waves × 12 hours)
> **Project folder**: `/Users/jonathannelsen/nova26/kiro/nova26`
> **Git HEAD**: b2d0cf3 (local), 3f11668 (origin/main)

---

## CURRENT CODEBASE STATE

- ~316 test files, ~8985 tests, 0 real failures (1 flaky saga PBT)
- 0 TypeScript errors
- Haiku Sprint 5 progress: model-routing (7 test files), ACP (2 test files), compliance (2 test files), MCP (2 test files) — all done
- Kimi Sprint 3: COMPLETE, pushed
- Sonnet Sprint 3: STARTING (spec reconciliation, hypercore/hypervisor completion, landing page)
- Kimi Sprint 4: STARTING after Sprint 3 (spec completion, behaviors, models, orchestrator)

---

## SPRINT 6 RULES

- TypeScript strict, ESM `.js` imports, vitest, no `any`
- Property-based tests use `fast-check` (already in dependencies)
- Import from source files using relative `.js` extension
- Run `tsc --noEmit` after each task — must be 0 errors
- Commit after each task: `test(H6-XX): <description>`
- Push after each wave checkpoint
- If a test reveals a real bug, fix it: `fix(H6-XX): <bug> + test coverage`

---

## DO-NOT-TOUCH ZONES

| Module | Owner | Sprint |
|--------|-------|--------|
| `src/hypercore/` | Sonnet | Sprint 3 (extending) |
| `src/hypervisor/` | Sonnet | Sprint 3 (extending) |
| `src/a2a/` | Sonnet | Sprint 3 |
| `app/` | Sonnet | Sprint 3 (landing page + dashboard) |
| `src/saga/` | Kimi | Sprint 4 (spec completion) |
| `src/rlm/` | Kimi | Sprint 4 (spec completion) |
| `src/harness/` | Kimi | Sprint 4 (spec completion) |
| `src/hindsight/` | Kimi | Sprint 4 (spec completion) |
| `src/behaviors/` | Kimi | Sprint 4 (implementing) |
| `src/models/` | Kimi | Sprint 4 (hardening) |
| `src/orchestrator/` | Kimi | Sprint 4 (hardening) |

**YOUR MODULES** (safe to test):
- `src/atlas/` (17 src, 7 test)
- `src/observability/` (14 src, 7 test)
- `src/llm/` (8 src, 5 test)
- `src/integrations/` (11 src, 7 test)
- `src/collaboration/` (8 src, 5 test)
- `src/agents/` (9 src, 7 test)
- `src/config/` (6 src, 8 test)
- `src/tools/` (12 src, 9 test)
- `src/memory/` (9 src, 7 test)
- `src/recovery/` (6 src, 7 test)
- `src/workflow/` (5 src, 3 test)
- `src/workflow-engine/` (5 src, 3 test)
- `src/testing/` (7 src, 6 test)
- `src/analytics/` (6 src, 6 test)
- `src/cli/` (15 src, 13 test)

---

## WAVE 1 (Hours 0–12): Push Sprint 5 + Atlas + Observability Deep Coverage

> Priority: Push Sprint 5 work, then tackle the two largest under-tested modules

### Task H6-01: Push Sprint 5 + Pull Latest
- Push Sprint 5 commits (H5-01 through H5-08)
- `git pull origin main` — get any Sonnet/Kimi updates
- Run `vitest run` — fix any merge conflicts or failures
- Target: 0 failures, 0 TS errors

### Task H6-02: Atlas — Deep Coverage
Read all 17 source files in `src/atlas/`.
Review existing 7 test files — identify untested functions.
Create `src/atlas/__tests__/atlas-deep.test.ts`:
- Test graph operations: add/remove nodes, edge traversal, cycle detection
- Test memory compaction: importance scoring, pruning, preservation
- Test context retrieval: relevance ranking, time-decay, cross-session
- Edge cases: empty graph, circular references, large datasets
Property tests: graph consistency (add → retrieve always works), compaction preserves high-importance nodes.

### Task H6-03: Observability — Deep Coverage
Read all 14 source files in `src/observability/`.
Review existing 7 test files — identify untested functions.
Create `src/observability/__tests__/observability-deep.test.ts`:
- Test NovaTracer: span creation, nesting, timing, export
- Test EventStore: store, query, retention, aggregation
- Test metrics collectors, formatters, structured logging
Property tests: span nesting validity (child within parent bounds), event chronological ordering.

### Task H6-04: Wave 1 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/atlas/ src/observability/` — all pass.
Commit + push: `test(H6-04): Atlas + Observability deep coverage`

---

## WAVE 2 (Hours 12–24): LLM + Integrations + Collaboration

> Target: Three mid-size modules with moderate coverage

### Task H6-05: LLM — Deep Coverage
Read all 8 source files in `src/llm/`.
Review existing 5 test files.
Create `src/llm/__tests__/llm-deep.test.ts`:
- Test model router: selection logic, fallback, cost optimization
- Test token counting, prompt building, response parsing
Property tests: token count non-negative, model selection from available pool.

### Task H6-06: Integrations — Gap Coverage
Read all 11 source files in `src/integrations/`.
Review existing 7 test files.
Create `src/integrations/__tests__/integrations-deep.test.ts`:
- Test untested integration adapters
- Test error handling: timeout, retry, malformed responses
Property tests: adapter always returns structured response.

### Task H6-07: Collaboration — Deep Coverage
Read all 8 source files in `src/collaboration/`.
Review existing 5 test files.
Create `src/collaboration/__tests__/collaboration-deep.test.ts`:
- Test CRDT merge operations, conflict resolution, concurrent edits
- Test sync manager: connect, disconnect, reconnect, partial sync
- Handle the two CRDTDocument types correctly
Property tests: CRDT commutativity, convergence.

### Task H6-08: Wave 2 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/llm/ src/integrations/ src/collaboration/` — all pass.
Commit + push: `test(H6-08): LLM + Integrations + Collaboration deep coverage`

---

## WAVE 3 (Hours 24–36): PBT Sweep Across Modules

> Target: Add fast-check property-based tests to modules that have unit tests but no PBTs

### Task H6-09: PBT Sweep — Config + Tools + Memory
- `src/config/__tests__/config-pbt.test.ts`: config merge associativity, feature flag determinism
- `src/tools/__tests__/tools-pbt.test.ts`: tool registry round-trip, execution returns structured result
- `src/memory/__tests__/memory-pbt.test.ts`: store/retrieve round-trip, compression preserves key data

### Task H6-10: PBT Sweep — Recovery + Workflow + Agents
- `src/recovery/__tests__/recovery-pbt.test.ts`: circuit breaker state machine validity, retry backoff monotonicity
- `src/workflow/__tests__/workflow-pbt.test.ts`: step ordering respects dependencies, completion determinism
- `src/agents/__tests__/agents-pbt.test.ts`: agent capability matching, message bus delivery guarantees

### Task H6-11: PBT Sweep — Analytics + CLI + Testing
- `src/analytics/__tests__/analytics-pbt.test.ts`: metrics aggregation commutativity, time-range queries
- `src/cli/__tests__/cli-pbt.test.ts`: command parsing round-trip, flag validation
- `src/testing/__tests__/testing-pbt.test.ts`: mock factory validity, snapshot comparison symmetry

### Task H6-12: Wave 3 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests — must pass.
Commit + push: `test(H6-12): PBT sweep — 9 modules with new property-based tests`

---

## WAVE 4 (Hours 36–48): Reconciliation + Smoke Tests + Final

> Target: Handle any pushes from Sonnet/Kimi, cross-module smoke tests, final sweep

### Task H6-13: Sonnet/Kimi Reconciliation
**CONDITIONAL**: Pull latest, run tests, fix any failures from other workers' pushes.
- Sonnet may push hypercore/hypervisor extensions, landing page, dashboard
- Kimi may push spec completions, behaviors, models hardening
- Fix failures without rewriting their code

### Task H6-14: Cross-Module Smoke Tests
Create `src/__tests__/cross-module-smoke.test.ts`:
- Smoke: collaboration → atlas (CRDT changes reflected in atlas)
- Smoke: observability → any module (telemetry captured)
- Smoke: llm → model-routing (LLM calls route through model routing)
- Smoke: config → feature flags → any module (flags affect behavior)
- Smoke: tools → integrations (tool execution uses integration adapters)
Lightweight — verify wiring, not deep logic.

### Task H6-15: Workflow Engine + Workflow Deep Tests
Read `src/workflow/` (5 src, 3 test) and `src/workflow-engine/` (5 src, 3 test).
Create `src/workflow/__tests__/workflow-deep.test.ts`:
- Test engine execution, step ordering, error handling, retry
Create `src/workflow-engine/__tests__/engine-deep.test.ts`:
- Test visual engine, lifecycle adapter
Property tests: workflow execution determinism.

### Task H6-16: Final Sweep
Run full test suite: `vitest run`
Fix any remaining failures.
Run `tsc --noEmit` — 0 errors.

### Task H6-17: Final Checkpoint
Run ALL tests — must pass.
Commit + push: `test(H6-17): Sprint 6 complete — deep coverage + PBT sweep + smoke tests`

---

## TASK COUNT SUMMARY

| Wave | Hours | Tasks | Focus |
|------|-------|-------|-------|
| Wave 1 | 0–12 | H6-01 → H6-04 | Push Sprint 5 + Atlas + Observability |
| Wave 2 | 12–24 | H6-05 → H6-08 | LLM + Integrations + Collaboration |
| Wave 3 | 24–36 | H6-09 → H6-12 | PBT sweep (9 modules) |
| Wave 4 | 36–48 | H6-13 → H6-17 | Reconciliation + smoke tests + sweep |
| **TOTAL** | **48h** | **17 tasks** | **~15 modules hardened, ~80+ new tests, ~27 PBTs** |

---

## PRIORITY ORDER (If Running Behind)

1. **H6-01** (Push + pull) — unblocks everything
2. **H6-13** (Reconciliation) — if other workers push, this becomes P0
3. **Wave 1 H6-02-03** (Atlas + Observability) — largest under-tested modules
4. **Wave 3** (PBT sweep) — broad quality improvement
5. **Wave 2** (LLM + Integrations + Collaboration) — moderate coverage gaps
6. **Wave 4 H6-14-15** (Smoke tests + workflow) — nice-to-have

---

*Sprint 6 created by Kiro (Opus 4.6) — February 22, 2026*
