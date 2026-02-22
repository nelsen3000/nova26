# KIMI 2.5 — Sprint 4: "The Eternal Completer"
## February 25–28, 2026 (72 Hours)

> **Provider**: Moonshot (swarm)
> **Sprint 3 Status**: COMPLETE — Hindsight (Waves 1-2), RLM advanced (Wave 3), SAGA advanced (Wave 4), Harness advanced (Wave 5), Eternal Reel + Dream Mode (Wave 6). Pushed as 3f11668. 306 test files, 8640 tests.
> **Sprint 4 Focus**: Complete remaining spec tasks for RLM, SAGA, Harness + Spec reconciliation + New module implementations + Cross-module integration
> **Duration**: 72 hours (6 waves × 12 hours)
> **Project folder**: `/Users/jonathannelsen/nova26/kiro/nova26`
> **Git HEAD**: 3f11668 on origin/main (your push)

---

## CURRENT CODEBASE STATE

- ~316 test files, ~8985 tests, 0 real failures (1 flaky saga PBT — known)
- 0 TypeScript errors
- Haiku Sprint 5 in progress: model-routing, ACP, compliance, MCP tests done
- Sonnet Sprint 3 starting: spec reconciliation, hypercore/hypervisor completion, landing page

---

## SPRINT 4 RULES

- TypeScript strict, ESM `.js` imports, vitest, no `any`, mock all I/O
- All new code in `src/` (not `app/` or `convex/`)
- Follow Kiro spec task lists exactly — each task references requirements
- Property-based tests use `fast-check` (already in dependencies)
- Run `tsc --noEmit` after each task — must be 0 errors
- Run `vitest run src/<module>/` after each task — must pass
- Commit after each task: `feat(K4-XX): <description>`
- Push after each wave checkpoint

---

## DO-NOT-TOUCH ZONES

| Module | Owner | Sprint |
|--------|-------|--------|
| `src/hypercore/` | Sonnet | Sprint 3 |
| `src/hypervisor/` | Sonnet | Sprint 3 |
| `src/a2a/` | Sonnet | Sprint 3 |
| `app/` | Sonnet | Sprint 3 (landing page + dashboard) |
| `src/model-routing/` | Haiku | Sprint 5 (tests done) |
| `src/acp/` | Haiku | Sprint 5 (tests done) |
| `src/compliance/` | Haiku | Sprint 5 (tests done) |
| `src/mcp/` | Haiku | Sprint 5 (tests done) |

---

## WAVE 1 (Hours 0–12): Spec Reconciliation + RLM Completion

> Target: Mark completed spec tasks, then fill RLM gaps

### Task K4-01: Spec Task Reconciliation
Pull latest from main.
Read `.kiro/specs/recursive-language-models/tasks.md` — all 12 tasks unchecked.
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` — all 16 tasks unchecked.
Read `.kiro/specs/agent-harnesses/tasks.md` — all 16 tasks unchecked.
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` — all 15 tasks unchecked.
For each spec, verify which tasks your Sprint 2 + Sprint 3 code satisfies.
Mark completed tasks as `[x]`.
List remaining gaps per spec.

### Task K4-02: RLM — Foundation Gaps (Tasks 1-5)
Read `.kiro/specs/recursive-language-models/tasks.md` Tasks 1-5.
Review existing `src/rlm/` files: types.ts, schemas.ts, context-window.ts, reader-adapter.ts, model-selection.ts, rlm-pipeline.ts.
Fill any gaps between implementation and spec requirements.
Ensure ContextWindow serialization, reader model adapter, and pipeline core all match spec.
Property tests for any new/modified code.

### Task K4-03: RLM — Audit + Drift Detection (Tasks 7-8)
Read `.kiro/specs/recursive-language-models/tasks.md` Tasks 7-8.
Review existing `src/rlm/audit.ts`.
Ensure compression audit trail and drift detection match spec.
Property tests: audit log completeness, drift detection sensitivity.

### Task K4-04: RLM — Convex Schema Prep (Task 11)
Read `.kiro/specs/recursive-language-models/tasks.md` Task 11.
Cannot touch `convex/` directly. Instead:
- Create `src/rlm/convex-types.ts` if not exists — TypeScript types for Convex schema
- Create `src/rlm/convex-bridge.ts` if not exists — bridge layer for mutations
- Document required Convex schema changes

### Task K4-05: RLM — Final Checkpoint (Task 12)
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/rlm/` — all pass.
Mark all RLM spec tasks complete.
Commit + push: `feat(K4-05): RLM spec complete — all 12 tasks done`

---

## WAVE 2 (Hours 12–24): SAGA + Harness Spec Completion

> Target: Fill remaining SAGA gaps (Tasks 1-6) and Harness gaps (Tasks 1-2, 15-16)

### Task K4-06: SAGA — Foundation Gaps (Tasks 1-6)
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Tasks 1-6.
Review existing `src/saga/` files: types.ts, schemas.ts, goal-genome.ts, fitness-evaluator.ts, taste-guard.ts, curriculum-generator.ts.
Fill gaps: ensure types match spec, goal mutation operations are complete, fitness evaluator has tournament selection, taste guard filters correctly, curriculum generator covers all skills.
Property tests for any new/modified code.

### Task K4-07: SAGA — Mark All Complete
Run `vitest run src/saga/` — all pass.
Mark all 16 SAGA spec tasks complete.
Commit: `feat(K4-07): SAGA spec complete — all 16 tasks done`

### Task K4-08: Harness — Foundation Gaps (Tasks 1-2)
Read `.kiro/specs/agent-harnesses/tasks.md` Tasks 1-2.
Review existing `src/harness/` files: types.ts, agent-harness.ts.
Ensure types match spec, state machine and lifecycle are complete.
Property tests: state machine validity, type serialization round-trip.

### Task K4-09: Harness — Convex + Final (Tasks 15-16)
Read `.kiro/specs/agent-harnesses/tasks.md` Tasks 15-16.
Create Convex bridge types (same pattern as RLM).
Mark all 16 Harness spec tasks complete.
Run `vitest run src/harness/` — all pass.
Commit + push: `feat(K4-09): Harness + SAGA specs complete`

---

## WAVE 3 (Hours 24–36): Hindsight Spec Completion + Behaviors Module

> Target: Mark Hindsight spec complete + implement Behaviors module

### Task K4-10: Hindsight — Spec Reconciliation + Gaps
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` — all 15 tasks unchecked.
Review all `src/hindsight/` files (13 files).
Mark completed tasks, fill any gaps.
Ensure Convex adapter (Task 13) has bridge types if needed.
Mark all 15 tasks complete.
Commit: `feat(K4-10): Hindsight spec complete — all 15 tasks done`

### Task K4-11: Behaviors — Full Module Implementation
Read all source files in `src/behaviors/` (8 src, 1 test).
Review existing `src/behaviors/index.test.ts`.
Ensure all behavior functions/classes are complete:
- Behavior composition, chaining, error propagation
- Integration with agent system
Add comprehensive tests: `src/behaviors/__tests__/behaviors-deep.test.ts`.
Property tests: behavior composition associativity.

### Task K4-12: Behaviors — Integration Wiring
Wire behaviors into agent system:
- Ensure behaviors can be attached to agents
- Ensure behavior events emit to observability
- Test integration with harness system

### Task K4-13: Wave 3 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/hindsight/ src/behaviors/` — all pass.
Commit + push: `feat(K4-13): Hindsight spec done + Behaviors module complete`

---

## WAVE 4 (Hours 36–48): Models + Orchestrator Hardening

> Target: `src/models/` (6 src, 3 test), `src/orchestrator/` (36 src, 40 test — large but critical)

### Task K4-14: Models — Ensemble Engine + Router
Read all source files in `src/models/`.
Review and extend:
- `src/models/ensemble-engine.ts`: combine responses, voting, confidence weighting, disagreement handling
- `src/models/model-router.ts`: route by task type, fallback chain, cost optimization
Add tests: `src/models/__tests__/ensemble-router-deep.test.ts`.
Property tests: ensemble determinism, router always selects from available models.

### Task K4-15: Models — AI Model Vault + Lifecycle
Review and extend:
- `src/models/ai-model-vault.ts`: model registration, capability matching, version management
- `src/models/lifecycle-adapter.ts`: model lifecycle management
Add tests if coverage is thin.

### Task K4-16: Orchestrator — Ralph Loop Hardening
Review `src/orchestrator/ralph-loop.ts` — your Sprint 3 added harnessEnabled.
Ensure the harness integration is robust:
- Long-running task delegation works correctly
- Dream mode auto-checkpoint fires at correct intervals
- Error recovery when harness fails mid-task
Add targeted tests for the new harness integration paths.

### Task K4-17: Orchestrator — Predictive Decomposer + Task Picker
Review `src/orchestrator/predictive-decomposer.ts` and `src/orchestrator/task-picker.ts`.
Ensure these critical orchestration components have adequate test coverage.
Add property tests: decomposition preserves all requirements, task picker respects priorities.

### Task K4-18: Wave 4 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/models/ src/orchestrator/` — all pass.
Commit + push: `feat(K4-18): Models + Orchestrator hardening complete`

---

## WAVE 5 (Hours 48–60): Agent Loop + Memory + Taste Vault

> Target: Harden core agent infrastructure modules

### Task K4-19: Agent Loop — Deep Coverage
Read all source files in `src/agent-loop/` (2 src, 3 test).
Your Sprint 3 injected RLM pipeline into AgentLoop.callModel().
Ensure the RLM integration has comprehensive tests:
- Compression enabled: tokens counted correctly
- Compression disabled: bypass works
- Budget enforcement with compressed tokens
- Fallback when RLM fails
Add tests: `src/agent-loop/__tests__/rlm-integration.test.ts`.

### Task K4-20: Memory — Hindsight Integration
Read all source files in `src/memory/` (9 src, 7 test).
Your Sprint 3 wired Hindsight into the memory hierarchy.
Ensure the integration is tested:
- Memory store → Hindsight fragment creation
- Hindsight retrieval → memory context enrichment
- Cross-session memory persistence
Add targeted integration tests.

### Task K4-21: Taste Vault — Hindsight Integration
Read all source files in `src/taste-vault/` (7 src, 5 test).
Your Sprint 3 wired Hindsight TasteVaultBridge hooks.
Ensure the integration is tested:
- TasteVault.learn() → Hindsight fragment creation
- TasteVault.reinforce() → Hindsight relevance boost
- Pattern conflict → procedural fragment
Add targeted integration tests.

### Task K4-22: Atlas — Hindsight Integration
Read all source files in `src/atlas/` (17 src, 7 test).
Your Sprint 3 wired Hindsight ATLASBridge hooks.
Ensure the integration is tested:
- KronosAtlas.logBuild() → Hindsight fragment creation
- Retrospective → semantic fragments
- Tag mapping determinism
Add targeted integration tests.

### Task K4-23: Wave 5 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/agent-loop/ src/memory/ src/taste-vault/ src/atlas/` — all pass.
Commit + push: `feat(K4-23): Agent loop + Memory + Taste Vault + Atlas integration tests`

---

## WAVE 6 (Hours 60–72): Cross-Module Integration + Final Sweep

> Target: End-to-end integration verification, observability, final sweep

### Task K4-24: Cross-Module Contract Tests
Create `src/__tests__/cross-module-contracts.test.ts`:
- RLM → AgentLoop: compressed tokens flow correctly
- SAGA → Harness: evolution tasks execute via harness
- Hindsight → ATLAS: memory fragments stored in ATLAS
- Hindsight → TasteVault: pattern learning creates fragments
- Eternal Reel factory: all 4 modules initialize correctly
- Dream Mode: overnight operations coordinate across modules
Lightweight integration tests — verify wiring, not deep logic.

### Task K4-25: Observability Verification
Verify all Sprint 3 + Sprint 4 modules emit telemetry:
- Harness state transitions → observability events
- SAGA evolution metrics → observability
- RLM compression metrics → observability
- Hindsight consolidation stats → observability
- Eternal Reel dream mode events → observability
Add tests if any module is missing telemetry.

### Task K4-26: Flaky Test Investigation
Investigate the known flaky saga PBT (`src/saga/types.test.ts` line ~398).
Determine root cause: timing issue, random seed sensitivity, or genuine bug.
Fix if possible. If not fixable, add `retry(3)` annotation and document why.

### Task K4-27: Full Test Suite Sweep
Run `vitest run` — full suite.
Fix any failures.
Run `tsc --noEmit` — 0 errors.
Document remaining thin-coverage areas.

### Task K4-28: Final Checkpoint
Run ALL tests — must pass.
Commit + push: `feat(K4-28): Sprint 4 complete — 4 specs done, integration verified, observability wired`

---

## TASK COUNT SUMMARY

| Wave | Hours | Tasks | Focus |
|------|-------|-------|-------|
| Wave 1 | 0–12 | K4-01 → K4-05 | Spec reconciliation + RLM completion |
| Wave 2 | 12–24 | K4-06 → K4-09 | SAGA + Harness spec completion |
| Wave 3 | 24–36 | K4-10 → K4-13 | Hindsight spec + Behaviors module |
| Wave 4 | 36–48 | K4-14 → K4-18 | Models + Orchestrator hardening |
| Wave 5 | 48–60 | K4-19 → K4-23 | Agent loop + Memory + Taste Vault + Atlas integration |
| Wave 6 | 60–72 | K4-24 → K4-28 | Cross-module integration + sweep |
| **TOTAL** | **72h** | **28 tasks** | **4 specs completed + integration verified + hardening** |

---

## PRIORITY ORDER (If Running Behind)

1. **Wave 1 K4-01** (Spec reconciliation) — unblocks everything
2. **Wave 1 K4-02-05** (RLM) — complete the spec
3. **Wave 2** (SAGA + Harness) — complete the specs
4. **Wave 3 K4-10** (Hindsight) — complete the spec
5. **Wave 5** (Integration tests) — verify Sprint 3 wiring works
6. **Wave 4** (Models + Orchestrator) — hardening
7. **Wave 3 K4-11-12** (Behaviors) — new module
8. **Wave 6** (Cross-module + sweep) — final quality

---

## CROSS-REFERENCES

- `src/agent-loop/agent-loop.ts` — RLM pipeline injection (your Sprint 3)
- `src/atlas/index.ts` — Hindsight ATLASBridge hooks (your Sprint 3)
- `src/taste-vault/taste-vault.ts` — Hindsight TasteVaultBridge hooks (your Sprint 3)
- `src/orchestrator/ralph-loop.ts` — Harness integration (your Sprint 3)
- `src/eternal-reel/` — Unified export + dream mode (your Sprint 3)
- `src/observability/` — All modules emit telemetry

---

*Sprint 4 created by Kiro (Opus 4.6) — February 22, 2026*
