# HAIKU 3.5 — Sprint 7: "The Convergence Guardian"
## February 28 – March 3, 2026 (72 Hours)

> **Provider**: Anthropic (Claude Haiku)
> **Sprint 6 Status**: COMPLETE — 17 tasks, 4 waves. 229 new tests. PBT sweep across 9 modules, cross-module smoke tests, workflow engine deep coverage, reconciliation. 9,907 tests, 0 TS errors.
> **Sprint 7 Focus**: Reconciliation duty, desktop/mobile test coverage, performance module hardening, end-to-end integration PBTs, production readiness validation
> **Duration**: 72 hours (6 waves × 12 hours)
> **Project folder**: `/Users/jonathannelsen/nova26/kiro/nova26`
> **Git HEAD**: latest on origin/main

---

## CURRENT CODEBASE STATE

- 364 test files, ~9,907 tests, 0 TS errors
- Haiku Sprint 6 complete: PBT sweep, deep coverage, cross-module smoke tests
- Kimi Sprint 4 complete: all 4 Eternal Data Reel specs done
- Sonnet Sprint 3 complete: hypercore, hypervisor, a2a, landing page, dashboard
- **Sonnet Sprint 4 IN PROGRESS**: Convex wiring, dashboard live data, auth flow
- **Kimi Sprint 5 IN PROGRESS**: SAGA/RLM deep tests, CLI commands, thin module coverage
- **Key gaps**: Desktop (6 src / 4 tests), Mobile (7 src / 5 tests), Performance (2 src / 2 tests), Convex (5 src / 3 tests), ACE (5 src / 3 tests), several small modules with 1:1 ratio need PBTs

---

## SPRINT 7 RULES

- TypeScript strict, ESM `.js` imports, vitest, no `any`
- Property-based tests use `fast-check` (already in dependencies)
- Import from source files using relative `.js` extension
- Run `tsc --noEmit` after each task — must be 0 errors
- Commit after each task: `test(H7-XX): <description>`
- Push after each wave checkpoint
- If a test reveals a real bug, fix it: `fix(H7-XX): <bug> + test coverage`
- **RECONCILIATION IS P0** — when Sonnet or Kimi push, pull and fix immediately

---

## DO-NOT-TOUCH ZONES

| Module | Owner | Sprint |
|--------|-------|--------|
| `src/saga/` | Kimi | Sprint 5 (deep testing) |
| `src/rlm/` | Kimi | Sprint 5 (deep testing) |
| `src/harness/` | Kimi | Sprint 5 (hardening) |
| `src/hindsight/` | Kimi | Sprint 5 (hardening) |
| `src/acp/` | Kimi | Sprint 5 (coverage) |
| `src/compliance/` | Kimi | Sprint 5 (coverage) |
| `src/mcp/` | Kimi | Sprint 5 (coverage) |
| `src/eternal-reel/` | Kimi | Sprint 5 (hardening) |
| `app/` | Sonnet | Sprint 4 (dashboard wiring) |
| `convex/` | Sonnet | Sprint 4 (mutations/queries) |
| `src/hypercore/` | Sonnet | Sprint 4 (Convex bridge) |
| `src/hypervisor/` | Sonnet | Sprint 4 (Convex bridge) |
| `src/a2a/` | Sonnet | Sprint 4 (Convex bridge) |

**YOUR MODULES** (safe to test):
- `src/desktop/` (6 src, 4 tests)
- `src/mobile-launch/` (7 src, 5 tests)
- `src/performance/` (2 src, 2 tests)
- `src/ace/` (5 src, 3 tests)
- `src/convex/` (5 src, 3 tests) — the src-side convex helpers, NOT the `convex/` dir
- `src/skills/` (4 src, 3 tests)
- `src/studio-rules/` (3 src, 2 tests)
- `src/rehearsal/` (3 src, 1 test)
- `src/optimization/` (3 src, 1 test)
- `src/generative-ui/` (3 src, 2 tests)
- `src/design-pipeline/` (5 src, 5 tests)
- `src/portfolio/` (5 src, 5 tests)
- `src/gates/` (3 src, 3 tests)
- `src/security/` (4 src, 4 tests)
- `src/cache/` (1 src, 1 test)
- `src/persistence/` (3 src, 3 tests)
- All 1-src modules: browser, codebase, cost, debt, debug, deps, dream, env, evolution, git, preview, plugins, similarity, swarm, symbiont, taste-room, template, universe, utils, visionary

---

## WAVE 1 (Hours 0–12): Reconciliation + Desktop + Mobile

> Priority: Pull latest, fix breaks, then harden desktop/mobile

### Task H7-01: Pull + Reconciliation
Pull latest from main.
Run `tsc --noEmit` — count errors.
Run `vitest run` — count failures.
Fix ALL failures from Sonnet Sprint 4 and Kimi Sprint 5 pushes.
Do NOT rewrite their code — adapt tests and type bridges.
Target: 0 failures, 0 TS errors.

### Task H7-02: Desktop — Deep Coverage
Read all 6 source files in `src/desktop/`.
Review existing 4 test files — identify gaps.
Create `src/desktop/__tests__/desktop-deep.test.ts`:
- Test window management: create, resize, minimize, maximize, close
- Test IPC communication: main ↔ renderer message passing
- Test menu system: menu items, shortcuts, state
- Test auto-update: check, download, install lifecycle
- Test tray icon: show, hide, context menu
Property tests: window state machine validity, IPC message round-trip.
Target: 25+ new tests.

### Task H7-03: Mobile Launch — Deep Coverage
Read all 7 source files in `src/mobile-launch/`.
Review existing 5 test files — identify gaps.
Create `src/mobile-launch/__tests__/mobile-deep.test.ts`:
- Test PWA manifest generation
- Test service worker: install, activate, fetch, cache
- Test offline mode: queue operations, sync on reconnect
- Test responsive breakpoints: layout adaptation
- Test touch interactions: swipe, pinch, long-press handlers
Property tests: manifest always valid JSON, cache strategy determinism.
Target: 25+ new tests.

### Task H7-04: Wave 1 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/desktop/ src/mobile-launch/` — all pass.
Commit + push: `test(H7-04): Reconciliation + Desktop + Mobile deep coverage`

---

## WAVE 2 (Hours 12–24): ACE + Skills + Studio Rules + Rehearsal + Optimization

> Target: Mid-size modules with thin coverage

### Task H7-05: ACE — Deep Coverage
Read all 5 source files in `src/ace/`.
Create `src/ace/__tests__/ace-deep.test.ts`:
- Test ACE engine: code evaluation, scoring, feedback generation
- Test code quality metrics: complexity, maintainability, readability
- Test suggestion engine: improvement recommendations
Property tests: quality score bounded [0,100], suggestions always actionable.
Target: 20+ new tests.

### Task H7-06: Skills — Deep Coverage
Read all 4 source files in `src/skills/`.
Create `src/skills/__tests__/skills-deep.test.ts`:
- Test skill registry: register, lookup, match
- Test skill execution: invoke, timeout, error handling
- Test skill composition: chain skills, parallel execution
Property tests: skill lookup determinism, execution always returns result.
Target: 15+ new tests.

### Task H7-07: Studio Rules + Rehearsal + Optimization
Read source files in `src/studio-rules/` (3 src), `src/rehearsal/` (3 src), `src/optimization/` (3 src).
Create tests for each:
- `src/studio-rules/__tests__/studio-rules-deep.test.ts`: rule parsing, validation, application
- `src/rehearsal/__tests__/rehearsal-deep.test.ts`: dry-run execution, diff generation, rollback
- `src/optimization/__tests__/optimization-deep.test.ts`: optimization passes, cost analysis, recommendations
Property tests: rule application idempotency, optimization always improves or equals baseline.
Target: 30+ new tests.

### Task H7-08: Wave 2 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/ace/ src/skills/ src/studio-rules/ src/rehearsal/ src/optimization/` — all pass.
Commit + push: `test(H7-08): ACE + Skills + Studio Rules + Rehearsal + Optimization deep coverage`

---

## WAVE 3 (Hours 24–36): Small Module PBT Sweep

> Target: Add PBTs to all 1-src modules and small modules that only have basic unit tests

### Task H7-09: PBT Sweep — Infrastructure Modules
Add property-based tests to:
- `src/cache/__tests__/cache-pbt.test.ts`: LRU eviction ordering, capacity enforcement, get after set
- `src/persistence/__tests__/persistence-pbt.test.ts`: store/retrieve round-trip, migration ordering
- `src/security/__tests__/security-pbt.test.ts`: sanitization idempotency, secret detection recall
- `src/gates/__tests__/gates-pbt.test.ts`: gate evaluation determinism, priority ordering
Target: 20+ PBTs.

### Task H7-10: PBT Sweep — Feature Modules
Add property-based tests to:
- `src/generative-ui/__tests__/generative-ui-pbt.test.ts`: component generation validity, style consistency
- `src/design-pipeline/__tests__/design-pipeline-pbt.test.ts`: pipeline stage ordering, output format validity
- `src/portfolio/__tests__/portfolio-pbt.test.ts`: portfolio scoring, project ranking stability
- `src/convex/__tests__/convex-helpers-pbt.test.ts`: query builder validity, mutation builder completeness
Target: 20+ PBTs.

### Task H7-11: PBT Sweep — Utility Modules
Add property-based tests to small utility modules:
- `src/cost/__tests__/cost-pbt.test.ts`: cost calculation non-negative, budget tracking monotonic
- `src/debt/__tests__/debt-pbt.test.ts`: debt scoring bounded, priority ordering
- `src/similarity/__tests__/similarity-pbt.test.ts`: similarity score bounded [0,1], symmetry
- `src/env/__tests__/env-pbt.test.ts`: env parsing round-trip, validation completeness
- `src/git/__tests__/git-pbt.test.ts`: commit message parsing, branch name validation
Target: 20+ PBTs.

### Task H7-12: Wave 3 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests — must pass.
Commit + push: `test(H7-12): PBT sweep — infrastructure, feature, utility modules — 60+ new PBTs`

---

## WAVE 4 (Hours 36–48): Mid-Sprint Reconciliation + Performance + Generative UI

> Target: Handle mid-sprint pushes, then harden remaining modules

### Task H7-13: Mid-Sprint Reconciliation
**CONDITIONAL**: Pull latest, run tests, fix any failures from Sonnet/Kimi mid-sprint pushes.
If no new pushes, skip to H7-14.

### Task H7-14: Performance Module — Deep Coverage
Read all source files in `src/performance/` (2 src, 2 tests).
Create `src/performance/__tests__/performance-deep.test.ts`:
- Test FCP/LCP measurement and reporting
- Test bundle size analysis
- Test code splitting recommendations
- Test performance budget enforcement
Property tests: metrics always non-negative, budget check determinism.
Target: 15+ new tests.

### Task H7-15: Generative UI — Deep Coverage
Read all source files in `src/generative-ui/` (3 src, 2 tests).
Create `src/generative-ui/__tests__/generative-ui-deep.test.ts`:
- Test component generation from specs
- Test style system: theme application, responsive variants
- Test accessibility: generated components have ARIA attributes
Property tests: generated components always valid JSX structure.
Target: 15+ new tests.

### Task H7-16: Design Pipeline — PBT Hardening
Read all source files in `src/design-pipeline/` (5 src, 5 tests).
Create `src/design-pipeline/__tests__/pipeline-integration.test.ts`:
- Test full pipeline: spec → design → component → test
- Test stage dependencies and ordering
- Test error recovery at each stage
Property tests: pipeline always produces output or explicit error.
Target: 15+ new tests.

### Task H7-17: Wave 4 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests — must pass.
Commit + push: `test(H7-17): Performance + Generative UI + Design Pipeline hardening`

---

## WAVE 5 (Hours 48–60): Cross-Module Integration PBTs

> Target: Property-based tests that verify cross-module invariants

### Task H7-18: Integration PBT — Observability Pipeline
Create `src/__tests__/integration-pbt-observability.test.ts`:
- Property: any module operation → observability event emitted
- Property: span nesting always valid (child within parent)
- Property: event timestamps monotonically increasing per source
- Property: metric aggregation commutative across modules
Target: 10+ PBTs.

### Task H7-19: Integration PBT — Config Cascade
Create `src/__tests__/integration-pbt-config.test.ts`:
- Property: config merge is associative (A merge B merge C = A merge (B merge C))
- Property: feature flag evaluation deterministic for same input
- Property: config validation rejects all invalid configs
- Property: module config isolation (changing module A config doesn't affect B)
Target: 10+ PBTs.

### Task H7-20: Integration PBT — Memory + Atlas Pipeline
Create `src/__tests__/integration-pbt-memory.test.ts`:
- Property: memory store → retrieve always returns stored data
- Property: atlas graph operations maintain consistency
- Property: memory compaction preserves high-importance items
- Property: cross-session retrieval returns relevant results
Target: 10+ PBTs.

### Task H7-21: Integration PBT — Agent Selection + Routing
Create `src/__tests__/integration-pbt-agents.test.ts`:
- Property: agent selection always returns from available pool
- Property: task complexity estimation bounded and deterministic
- Property: model routing respects cost constraints
- Property: agent handoff preserves context completeness
Target: 10+ PBTs.

### Task H7-22: Wave 5 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests — must pass.
Commit + push: `test(H7-22): Cross-module integration PBTs — observability, config, memory, agents`

---

## WAVE 6 (Hours 60–72): Final Reconciliation + Production Validation + Sweep

> Target: Final reconciliation, production readiness checks, comprehensive sweep

### Task H7-23: Final Reconciliation
Pull latest from main.
Run `tsc --noEmit` — 0 errors.
Run `vitest run` — fix ALL failures.
This is the final merge point for Sprint 4 (Sonnet) and Sprint 5 (Kimi).

### Task H7-24: Production Readiness Validation
Create `src/__tests__/production-readiness.test.ts`:
- All 86 modules export at least one public function
- All modules have at least 1 test file
- No circular dependencies between top-level modules
- All Zod schemas validate correctly
- All lifecycle adapters implement required interface
- All event bus subscribers handle errors gracefully
Target: 20+ validation tests.

### Task H7-25: Test Health Report
Create `src/__tests__/test-health-report.test.ts`:
- Verify test count hasn't regressed (should be > 10,000)
- Verify no test files are empty
- Verify no test files have only skipped tests
- Verify PBT coverage across critical modules
- Report final module-by-module coverage summary

### Task H7-26: Full Test Suite Sweep
Run `vitest run` — full suite.
Fix any remaining failures.
Run `tsc --noEmit` — 0 errors.

### Task H7-27: Final Checkpoint
Run ALL tests — must pass.
Commit + push: `test(H7-27): Sprint 7 complete — convergence guardian, 150+ new tests, production validated`

---

## TASK COUNT SUMMARY

| Wave | Hours | Tasks | Focus |
|------|-------|-------|-------|
| Wave 1 | 0–12 | H7-01 → H7-04 | Reconciliation + Desktop + Mobile |
| Wave 2 | 12–24 | H7-05 → H7-08 | ACE + Skills + Studio Rules + Rehearsal + Optimization |
| Wave 3 | 24–36 | H7-09 → H7-12 | Small module PBT sweep (60+ PBTs) |
| Wave 4 | 36–48 | H7-13 → H7-17 | Mid-reconciliation + Performance + Generative UI |
| Wave 5 | 48–60 | H7-18 → H7-22 | Cross-module integration PBTs |
| Wave 6 | 60–72 | H7-23 → H7-27 | Final reconciliation + production validation |
| **TOTAL** | **72h** | **27 tasks** | **~150+ new tests, 60+ PBTs, production readiness validated** |

---

## PRIORITY ORDER (If Running Behind)

1. **H7-01** (Reconciliation) — P0, blocks everything
2. **H7-13/H7-23** (Mid/Final reconciliation) — P0 when triggered
3. **Wave 1 H7-02-03** (Desktop + Mobile) — thin coverage, user-facing
4. **Wave 3** (Small module PBT sweep) — broad quality improvement
5. **Wave 5** (Integration PBTs) — cross-module confidence
6. **Wave 2** (ACE + Skills + etc.) — moderate coverage gaps
7. **Wave 4 H7-14-16** (Performance + Generative UI) — nice-to-have
8. **Wave 6 H7-24-25** (Production validation) — final quality gate

---

*Sprint 7 created by Kiro (Opus 4.6) — February 28, 2026*
