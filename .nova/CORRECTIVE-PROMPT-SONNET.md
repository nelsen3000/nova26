# SONNET 4.6 — Corrective Redirect
## You Were On The Wrong Sprint

> **STOP. READ THIS FIRST.**

### What Happened
You were given Sprint 3 (SPRINT-3-SONNET.md) but instead executed GLM-5's tasks from TASK-BOARD.md:
- GLM-02: Extract build lifecycle ✅ (6ef899e)
- GLM-03: LRU cache module ✅ (3184fea)
- GLM-04: Input sanitization ✅ (d5a2575)
- GLM-05: Secret scanner ✅ (a5e8da7)
- GLM-06: Migration runner ✅ (c1ab14c)
- GLM-07: Persistence store ✅ (e1fa0bc) — **4 tests still failing**

Those were GLM-5 (Black agent) tasks, not yours. The work is done and committed, so no need to undo it. But you need to get on YOUR sprint now.

### Known Issue: 4 Failing Tests
Your GLM-07 `src/persistence/__tests__/store.test.ts` has 4 failing tests. The `clear()` method in `SqliteStore` doesn't work — it runs DELETE but `count()` still returns the old count. **Fix this first before starting Sprint 3.**

Failing test: `SqliteStore > clear() removes all entries` — expects count 0, gets 2.

### Your Actual Sprint: SPRINT-3-SONNET.md

**Read `.nova/SPRINT-3-SONNET.md` now.** Your 29 tasks across 6 waves:

**Wave 1 (S3-01 → S3-04)**: Spec task reconciliation for hypercore, hypervisor, a2a
**Wave 2 (S3-05 → S3-09)**: P2P Hypercore spec completion
**Wave 3 (S3-10 → S3-14)**: Hypervisor spec completion
**Wave 4 (S3-15 → S3-19)**: A2A optional PBTs + Landing page
**Wave 5 (S3-20 → S3-24)**: Dashboard integration panels
**Wave 6 (S3-25 → S3-29)**: Desktop/mobile polish + observability + sweep

### Current State
- **Git HEAD**: 773ce1b on main (all pushed)
- **Tests**: 329 files, 9,282 passing, 4 failing (your store.test.ts)
- **TS errors**: 0
- **Haiku Sprint 5**: COMPLETE (H5-01 through H5-17)
- **Kimi Sprint 4**: K4-01 done (spec reconciliation), K4-28 done, Waves 2-6 NOT started
- **GLM-5 tasks**: ALL DONE (you did them)

### Instructions

1. `git pull origin main` — make sure you're on 773ce1b
2. Fix the 4 failing tests in `src/persistence/__tests__/store.test.ts` (the `clear()` bug)
3. Run `npx tsc --noEmit` — must be 0 errors
4. Run `npx vitest run` — must be 0 failures
5. Commit: `fix(GLM-07): fix SqliteStore clear() method`
6. Push
7. **Start Sprint 3 Wave 1: S3-01** — read `.nova/SPRINT-3-SONNET.md`

### DO-NOT-TOUCH ZONES (same as Sprint 3)

| Module | Owner |
|--------|-------|
| `src/saga/` | Kimi |
| `src/rlm/` | Kimi |
| `src/harness/` | Kimi |
| `src/hindsight/` | Kimi |
| `src/model-routing/` | Haiku |
| `src/acp/` | Haiku |
| `src/compliance/` | Haiku |
| `src/mcp/` | Haiku |

### Quality Gates (after EVERY task)
```bash
npx tsc --noEmit        # Must be 0 errors
npx vitest run           # Must be 0 failures
```

---

*Corrective prompt by Kiro (Opus 4.6) — February 21, 2026*
