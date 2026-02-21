# SONNET 4.6 — Sprint 3: "The Eternal Integrator"
## February 22–25, 2026 (72 Hours)

> **Provider**: Anthropic (Claude Code terminal)
> **Sprint 2 Status**: COMPLETE (25 tasks: hypercore, hypervisor, a2a — 336 new tests). NOT YET PUSHED.
> **Sprint 3 Focus**: Push Sprint 2 + Reconcile conflicts + P2P Hypercore spec completion + Hypervisor spec completion + A2A spec completion + Landing Page UX + New feature specs
> **Duration**: 72 hours (6 waves × 12 hours)
> **Project folder**: `/Users/jonathannelsen/nova26/kiro/nova26`
> **Spec files**: `.kiro/specs/p2p-hypercore-protocol/`, `.kiro/specs/hypervisor-hypercore/`, `.kiro/specs/a2a-mcp-protocols/`, `.kiro/specs/landing-page-and-ux-validation/`

---

## SPRINT 2 RECAP (Complete, Unpushed)

| Module | Files Created | Tests | Status |
|--------|--------------|-------|--------|
| P2P Hypercore (`src/hypercore/`) | 8 files | ~80 tests | ✅ Built |
| Hypervisor (`src/hypervisor/`) | 8 files | ~80 tests | ✅ Built |
| A2A/MCP (`src/a2a/`) | 13 files | ~176 tests | ✅ Built |
| **Total Sprint 2** | **29 files** | **~336 tests** | ✅ Unpushed |

**WARNING**: When you push, expect potential conflicts with Haiku's 9badff3 (test fixes) and Kimi's work. Your `crdt-core.ts` rewrite may cause ~119 test failures that need reconciliation.

---

## SPRINT 3 RULES

- TypeScript strict, ESM `.js` imports, vitest, no `any`, mock all I/O
- All new code in `src/` (not `app/` or `convex/`)
- Follow Kiro spec task lists exactly — each task references requirements
- Property-based tests use `fast-check` (already in dependencies)
- Run `tsc --noEmit` after each task — must be 0 errors
- Commit after each task: `feat(S3-XX): <description>`
- Push after each wave checkpoint

---

## DO-NOT-TOUCH ZONES (Other Workers Active)

| Module | Owner | Sprint |
|--------|-------|--------|
| `src/saga/` | Kimi | Sprint 3 |
| `src/rlm/` | Kimi | Sprint 3 |
| `src/harness/` | Kimi | Sprint 3 |
| `src/hindsight/` | Kimi | Sprint 3 |
| `src/eternal-reel/` | Kimi | Sprint 3 |
| `convex/`, `app/` | — | Off-limits for now |

---

## WAVE 1 (Hours 0–12): Push, Reconcile, Stabilize

> Priority: Get Sprint 2 code merged cleanly into main

### Task S3-01: Push Sprint 2 + Pull Latest
- `git pull origin main` (get Haiku's 9badff3 and any Kimi work)
- Resolve merge conflicts (especially `src/collaboration/crdt-core.ts` if touched)
- `git push origin main`
- If conflicts are complex, create a reconciliation branch first

### Task S3-02: Reconcile Test Failures
- Run `vitest run` — identify all failures
- Fix failures caused by your Sprint 2 changes conflicting with existing code
- Focus areas: `crdt-core.ts` type changes, any import path shifts, schema changes
- Do NOT rewrite other workers' code — adapt your code to match theirs where possible
- Target: 0 failures, 0 TS errors

### Task S3-03: Mark Spec Tasks Complete
- Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` — mark all tasks that your Sprint 2 code satisfies as `[x]`
- Read `.kiro/specs/hypervisor-hypercore/tasks.md` — same
- Read `.kiro/specs/a2a-mcp-protocols/tasks.md` — same (most already marked)
- Be honest: only mark tasks where the implementation genuinely satisfies the requirements

### Task S3-04: Wave 1 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests — must pass.
Commit + push: `feat(S3-04): Sprint 2 merged, reconciled, spec tasks updated`

---

## WAVE 2 (Hours 12–24): P2P Hypercore Spec Completion

> Spec: `.kiro/specs/p2p-hypercore-protocol/tasks.md`
> Target: Complete remaining unchecked tasks (ATLAS adapter, CRDT bridge, replication, offline resilience, observability, security, Rust bridge, wiring)

### Task S3-05: P2P Hypercore — ATLAS Memory Adapter
Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` Task 5 (all sub-tasks).
Review existing `src/hypercore/atlas-adapter.ts` — extend if needed.
Ensure ATLAS memory nodes can be stored/retrieved via Hypercore.
Property tests: ATLAS ↔ Hypercore round-trip integrity.

### Task S3-06: P2P Hypercore — CRDT Bridge Completion
Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` Task 6 (all sub-tasks).
Review existing `src/hypercore/crdt-bridge.ts` — ensure full spec compliance.
CRDT operations stored as Hypercore entries, replicated via Hypercore protocol.
Handle the two CRDTDocument types (types.ts spec/view vs crdt-core.ts implementation).
Property tests: CRDT convergence over Hypercore replication.

### Task S3-07: P2P Hypercore — Replication + Offline Resilience
Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` Tasks 7–8 (all sub-tasks).
Review existing `src/hypercore/replication.ts` — extend for full P2P replication.
Implement offline-first resilience: queue operations when offline, sync on reconnect.
Property tests: replication convergence, offline queue ordering.

### Task S3-08: P2P Hypercore — Observability + Security + Rust Bridge
Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` Tasks 10–12 (all sub-tasks).
Review existing `src/hypercore/observability.ts` — extend for full spec.
Implement security and access control layer.
Implement Rust Eternal Engine Bridge stub (returns unavailable, with interface ready).
Unit tests for each.

### Task S3-09: P2P Hypercore — Wire Everything + Final
Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` Tasks 13–14.
Wire all Hypercore components together via `src/hypercore/index.ts`.
Ensure public API exports are complete.
Run all Hypercore tests — must pass.

### Task S3-10: Wave 2 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/hypercore/` — all pass.
Commit + push: `feat(S3-10): P2P Hypercore spec complete — all 14 tasks done`

---

## WAVE 3 (Hours 24–36): Hypervisor Spec Completion

> Spec: `.kiro/specs/hypervisor-hypercore/tasks.md`
> Target: Complete remaining unchecked tasks (config parser, manager lifecycle, VSOCK, sandbox, Moltbot, security, observability, edge/cloud, Rust bridge, wiring)

### Task S3-11: Hypervisor — Config Parser (hac.toml)
Read `.kiro/specs/hypervisor-hypercore/tasks.md` Tasks 2–3 (all sub-tasks).
Implement `hac.toml` config parser and pretty printer.
If TOML parsing is needed, use a lightweight approach (regex or simple parser — avoid heavy deps).
Property tests: parse → pretty-print → parse round-trip.

### Task S3-12: Hypervisor — Manager Lifecycle + VSOCK
Read `.kiro/specs/hypervisor-hypercore/tasks.md` Tasks 4–6 (all sub-tasks).
Review existing `src/hypervisor/sandbox-manager.ts` — extend for full HypervisorManager lifecycle.
Implement VSOCK communication channel for sandbox ↔ host communication.
Property tests: lifecycle state machine validity.

### Task S3-13: Hypervisor — Sandbox + Moltbot + Security
Read `.kiro/specs/hypervisor-hypercore/tasks.md` Tasks 7–10 (all sub-tasks).
Implement Ultra-Sandbox adapter.
Implement Moltbot deployer and agent registry.
Implement image verifier and security auditing.
Property tests: sandbox isolation, image verification.

### Task S3-14: Hypervisor — Observability + Edge/Cloud + Rust Bridge
Read `.kiro/specs/hypervisor-hypercore/tasks.md` Tasks 11–14 (all sub-tasks).
Review existing `src/hypervisor/observability.ts` — extend for full spec.
Implement edge/cloud deployment provisioning.
Implement Rust Hypervisor Bridge stub.
Property tests: health monitoring accuracy.

### Task S3-15: Hypervisor — Wire Everything + Final
Read `.kiro/specs/hypervisor-hypercore/tasks.md` Tasks 15–16.
Wire all Hypervisor components together.
Ensure integration with existing Nova26 modules (observability, orchestrator).
Run all Hypervisor tests — must pass.

### Task S3-16: Wave 3 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/hypervisor/` — all pass.
Commit + push: `feat(S3-16): Hypervisor spec complete — all 16 tasks done`

---

## WAVE 4 (Hours 36–48): A2A Spec Gaps + Optional PBTs

> Spec: `.kiro/specs/a2a-mcp-protocols/tasks.md`
> Target: Complete any remaining optional PBT tasks, fill gaps

### Task S3-17: A2A — Optional Property-Based Tests
Read `.kiro/specs/a2a-mcp-protocols/tasks.md` — find all `[ ]*` (optional) tasks.
Implement the optional PBTs that were skipped in Sprint 2:
- Property 4: Agent Card serialization round trip
- Property 7: A2A Envelope serialization round trip
- Property 9: Message type validation
- Any other optional PBT tasks
Use `fast-check` for all property tests.

### Task S3-18: A2A — CRDT Sync + Discovery Integration Tests
Review `src/a2a/crdt-sync.ts` and `src/a2a/swarm-coordinator.ts`.
Ensure existing tests in `src/a2a/__tests__/` cover all spec requirements.
Add missing integration tests for:
- CRDT sync over A2A channels
- Discovery integration with Hyperswarm
- Task negotiation end-to-end flow

### Task S3-19: A2A — Swarm Coordinator + Task Negotiator Hardening
Deep test `src/a2a/swarm-coordinator.ts` and `src/a2a/task-negotiator.ts`.
Property tests: swarm consensus, task allocation fairness, negotiation termination.

### Task S3-20: Wave 4 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/a2a/` — all pass.
Commit + push: `feat(S3-20): A2A spec complete — all tasks + optional PBTs done`

---

## WAVE 5 (Hours 48–60): Landing Page UX + Desktop/Mobile Polish

> Spec: `.kiro/specs/landing-page-and-ux-validation/` (requirements exist, needs design + tasks)
> Target: Complete the landing page spec, implement UX validation, polish desktop/mobile

### Task S3-21: Landing Page — Create Design + Tasks
Read `.kiro/specs/landing-page-and-ux-validation/requirements.md`.
Create `.kiro/specs/landing-page-and-ux-validation/design.md` — design document.
Create `.kiro/specs/landing-page-and-ux-validation/tasks.md` — implementation task list.
Focus: hero section, CTA, feature showcase, responsive layout, accessibility.

### Task S3-22: Landing Page — Implement Core Components
Follow the tasks.md you just created.
Implement landing page components in `app/` (this is the one exception to the src-only rule).
Hero section, feature cards, CTA buttons, navigation.
Tailwind + shadcn/ui. Mobile-first responsive.

### Task S3-23: Landing Page — UX Validation + Accessibility
Implement UX validation tests.
Accessibility audit: ARIA labels, keyboard navigation, color contrast, screen reader flow.
Responsive breakpoint testing: mobile (375px), tablet (768px), desktop (1280px).

### Task S3-24: Desktop + Mobile Polish
Review `src/desktop/` (6 src files) and `src/mobile-launch/` (7 src files).
Fix any rough edges, ensure consistent UX patterns.
Add missing error states, loading states, empty states per VENUS agent guidelines.

### Task S3-25: Wave 5 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests — must pass.
Commit + push: `feat(S3-25): Landing page + UX validation + desktop/mobile polish`

---

## WAVE 6 (Hours 60–72): Cross-Module Wiring + Dashboard Integration

> Target: Wire Sonnet's modules into the dashboard, create unified views

### Task S3-26: Dashboard — Hypercore Status Panel
Create dashboard component showing Hypercore store status:
- Active stores, entry counts, replication peer count
- Sync status indicators (synced/syncing/offline)
- Wire into existing dashboard layout (`app/dashboard/`)

### Task S3-27: Dashboard — Hypervisor Sandbox Panel
Create dashboard component showing Hypervisor sandbox status:
- Active sandboxes, resource usage per sandbox
- Lifecycle state indicators
- Network policy summary

### Task S3-28: Dashboard — A2A Agent Communication Panel
Create dashboard component showing A2A message flow:
- Active channels, message throughput
- Agent tier visualization
- Recent routing events

### Task S3-29: Observability Wiring
Ensure all 3 modules (hypercore, hypervisor, a2a) emit telemetry to `src/observability/`.
Wire metrics into existing NovaTracer and EventStore.
Verify structured logs are consistent with project conventions.

### Task S3-30: Final Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests — must pass.
Commit + push: `feat(S3-30): Sprint 3 complete — specs done, dashboard panels, observability wired`

---

## TASK COUNT SUMMARY

| Wave | Hours | Tasks | Focus |
|------|-------|-------|-------|
| Wave 1 | 0–12 | S3-01 → S3-04 | Push, reconcile, stabilize |
| Wave 2 | 12–24 | S3-05 → S3-10 | P2P Hypercore spec completion (14 tasks) |
| Wave 3 | 24–36 | S3-11 → S3-16 | Hypervisor spec completion (16 tasks) |
| Wave 4 | 36–48 | S3-17 → S3-20 | A2A spec gaps + optional PBTs |
| Wave 5 | 48–60 | S3-21 → S3-25 | Landing page + UX + desktop/mobile |
| Wave 6 | 60–72 | S3-26 → S3-30 | Dashboard panels + observability wiring |
| **TOTAL** | **72h** | **30 tasks** | **3 specs completed + landing page + dashboard** |

---

## PRIORITY ORDER (If Running Behind)

1. **Wave 1** (Push + Reconcile) — CRITICAL, blocks everyone
2. **Wave 2** (P2P Hypercore) — complete the spec
3. **Wave 3** (Hypervisor) — complete the spec
4. **Wave 4** (A2A gaps) — polish existing work
5. **Wave 5** (Landing page) — user-facing, high impact
6. **Wave 6** (Dashboard) — nice-to-have integration

---

## CROSS-REFERENCES

- `src/collaboration/crdt-core.ts` — Your rewrite may conflict with existing tests. Reconcile in Wave 1.
- `src/observability/` — All modules emit telemetry here
- `src/orchestrator/ralph-loop.ts` — Kimi is wiring harness into this in Sprint 3
- `app/dashboard/` — Dashboard components live here
- `.kiro/specs/landing-page-and-ux-validation/` — Requirements exist, needs design + tasks

---

*Sprint 3 created by Kiro (Opus 4.6) — February 22, 2026*
