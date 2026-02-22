# KIMI 2.5 — Corrective Redirect
## You Skipped Most of Sprint 4

> **STOP. READ THIS FIRST.**

### What Happened
You did K4-01 (spec reconciliation — marked all 4 specs complete) and K4-28 (final checkpoint), plus a TS error fix (773ce1b). But you skipped K4-02 through K4-27 — the actual implementation work.

Your TS error fix was useful (taste-vault/crdt-taste-sync.ts, workflow/engine.ts, workflow/visualizer.ts), but that wasn't a sprint task.

The spec reconciliation was good — all 4 specs (RLM, SAGA, Harness, Hindsight) are now marked complete. But the sprint had 6 waves of real work beyond that.

### What's Left From Sprint 4

**Wave 1 remainder (K4-02 → K4-05)**: RLM spec gap filling — review existing `src/rlm/` files against spec requirements, fill gaps, add property tests, create Convex bridge types.

**Wave 2 (K4-06 → K4-09)**: SAGA foundation gaps (Tasks 1-6 in spec), Harness foundation gaps (Tasks 1-2), Convex bridge types for both.

**Wave 3 (K4-10 → K4-13)**: Hindsight gap filling, Behaviors module full implementation (`src/behaviors/`), integration wiring.

**Wave 4 (K4-14 → K4-18)**: Models ensemble engine + router hardening, AI Model Vault, Ralph Loop harness integration hardening, predictive decomposer + task picker property tests.

**Wave 5 (K4-19 → K4-23)**: Agent loop RLM integration tests, Memory/Taste Vault/Atlas Hindsight integration tests.

**Wave 6 (K4-24 → K4-28)**: Cross-module contract tests, observability verification, flaky saga PBT investigation, full test suite sweep.

### Current State
- **Git HEAD**: 773ce1b on main (all pushed)
- **Tests**: 329 files, 9,282 passing, 4 failing (store.test.ts — Sonnet's bug, not yours)
- **TS errors**: 0
- **Specs**: All 4 marked complete (your K4-01 work)
- **Haiku Sprint 5**: COMPLETE
- **Sonnet**: Did GLM-5 tasks by accident, needs to start Sprint 3

### Instructions

1. `git pull origin main` — make sure you're on 773ce1b
2. **Read `.nova/SPRINT-4-KIMI.md`** — your full sprint document
3. **Start at K4-02** (RLM foundation gaps) and work through in order
4. The 4 failing tests in `src/persistence/__tests__/store.test.ts` are Sonnet's problem — ignore them
5. Run quality gates after every task:
   ```bash
   npx tsc --noEmit        # Must be 0 errors
   npx vitest run           # 4 known failures in store.test.ts are OK
   ```
6. Commit after each task: `feat(K4-XX): <description>`
7. Push after each wave checkpoint

### Priority Order (If Running Behind)
1. K4-02→K4-05 (RLM gaps)
2. K4-06→K4-09 (SAGA + Harness gaps)
3. K4-10 (Hindsight gaps)
4. K4-19→K4-23 (Integration tests — verify Sprint 3 wiring)
5. K4-14→K4-18 (Models + Orchestrator hardening)
6. K4-11→K4-12 (Behaviors module)
7. K4-24→K4-27 (Cross-module + sweep)

### DO-NOT-TOUCH ZONES

| Module | Owner |
|--------|-------|
| `src/hypercore/` | Sonnet |
| `src/hypervisor/` | Sonnet |
| `src/a2a/` | Sonnet |
| `app/` | Sonnet |
| `src/model-routing/` | Haiku |
| `src/acp/` | Haiku |
| `src/compliance/` | Haiku |
| `src/mcp/` | Haiku |
| `src/persistence/` | Already done (GLM-5 tasks) |
| `src/cache/` | Already done (GLM-5 tasks) |
| `src/security/` | Already done (GLM-5 tasks) |

---

*Corrective prompt by Kiro (Opus 4.6) — February 21, 2026*
