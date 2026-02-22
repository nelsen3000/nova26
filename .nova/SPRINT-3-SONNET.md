# SONNET 4.6 — Sprint 3: "The Eternal Integrator"
## February 22–25, 2026 (72 Hours)

> **Provider**: Anthropic (Claude Code terminal)
> **Sprint 2 Status**: COMPLETE + PUSHED (hypercore, hypervisor, a2a — all in main)
> **Sprint 3 Focus**: Spec task reconciliation + P2P Hypercore spec completion + Hypervisor spec completion + Landing Page UX + Dashboard panels + Convex integration
> **Duration**: 72 hours (6 waves × 12 hours)
> **Project folder**: `/Users/jonathannelsen/nova26/kiro/nova26`
> **Git HEAD**: 3f11668 on origin/main

---

## CURRENT CODEBASE STATE

- 316 test files, ~8985 tests, 0 real failures (1 flaky saga PBT — known, ignore)
- 0 TypeScript errors
- Kimi Sprint 3: COMPLETE — Hindsight, RLM advanced, SAGA advanced, Harness advanced, Eternal Reel, Convex integration all pushed
- Haiku Sprint 5: IN PROGRESS — model-routing, ACP, compliance, MCP tests done (H5-01 through H5-08)
- All Sonnet Sprint 2 code is already in main (hypercore, hypervisor, a2a)

---

## SPRINT 3 RULES

- TypeScript strict, ESM `.js` imports, vitest, no `any`, mock all I/O
- All new code in `src/` unless explicitly working on `app/` components
- Follow Kiro spec task lists exactly — each task references requirements
- Property-based tests use `fast-check` (already in dependencies)
- Run `tsc --noEmit` after each task — must be 0 errors
- Commit after each task: `feat(S3-XX): <description>`
- Push after each wave checkpoint

---

## DO-NOT-TOUCH ZONES

| Module | Owner | Status |
|--------|-------|--------|
| `src/saga/` | Kimi | Sprint 3 complete, Sprint 4 incoming |
| `src/rlm/` | Kimi | Sprint 3 complete, Sprint 4 incoming |
| `src/harness/` | Kimi | Sprint 3 complete, Sprint 4 incoming |
| `src/hindsight/` | Kimi | Sprint 3 complete |
| `src/model-routing/` | Haiku | Sprint 5 in progress |
| `src/acp/` | Haiku | Sprint 5 done |
| `src/compliance/` | Haiku | Sprint 5 done |
| `src/mcp/` | Haiku | Sprint 5 done |

---

## WAVE 1 (Hours 0–12): Spec Task Reconciliation

> Priority: Mark completed spec tasks, identify gaps between implementations and specs

### Task S3-01: P2P Hypercore Spec Reconciliation
Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` — all 14 tasks are unchecked.
Read all source files in `src/hypercore/` (8 files).
For each spec task, verify if the implementation satisfies the requirements.
Mark completed tasks as `[x]` in tasks.md.
List any gaps where implementation doesn't fully match spec.

### Task S3-02: Hypervisor Spec Reconciliation
Read `.kiro/specs/hypervisor-hypercore/tasks.md` — all 16 tasks are unchecked.
Read all source files in `src/hypervisor/` (8 files).
Same process: verify implementations, mark completed, list gaps.

### Task S3-03: A2A Spec Verification
Read `.kiro/specs/a2a-mcp-protocols/tasks.md` — 14/14 top-level done, but 15 sub-tasks unchecked (mostly optional PBTs).
Verify all marked-complete tasks are genuinely complete.
Identify which optional PBT sub-tasks should be implemented.

### Task S3-04: Wave 1 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests — must pass.
Commit + push: `docs(S3-04): Spec task reconciliation — hypercore, hypervisor, a2a`

---

## WAVE 2 (Hours 12–24): P2P Hypercore Spec Completion

> Spec: `.kiro/specs/p2p-hypercore-protocol/tasks.md`
> Target: Fill gaps identified in Wave 1

### Task S3-05: P2P Hypercore — ATLAS Memory Adapter
Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` Task 5.
Review existing `src/hypercore/atlas-adapter.ts` — extend if spec requirements aren't met.
Ensure ATLAS memory nodes can be stored/retrieved via Hypercore.
Property tests: ATLAS ↔ Hypercore round-trip integrity.

### Task S3-06: P2P Hypercore — Offline Resilience
Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` Task 8.
Implement offline-first resilience if not already present:
- Queue operations when offline
- Sync on reconnect
- Conflict resolution for divergent states
Property tests: offline queue ordering, sync convergence.

### Task S3-07: P2P Hypercore — Security + Access Control
Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` Task 11.
Implement security and access control layer:
- Per-store access permissions
- Encryption at rest
- Peer authentication
Unit tests for security boundaries.

### Task S3-08: P2P Hypercore — Rust Bridge Stub + Wiring
Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` Tasks 12-13.
Implement Rust Eternal Engine Bridge stub (returns unavailable, interface ready).
Wire all components together via `src/hypercore/index.ts`.
Ensure public API exports are complete.

### Task S3-09: P2P Hypercore — Final Checkpoint
Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` Task 14.
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/hypercore/` — all pass.
Mark all completed tasks in spec.
Commit + push: `feat(S3-09): P2P Hypercore spec complete`

---

## WAVE 3 (Hours 24–36): Hypervisor Spec Completion

> Spec: `.kiro/specs/hypervisor-hypercore/tasks.md`
> Target: Fill gaps identified in Wave 1

### Task S3-10: Hypervisor — Config Parser (hac.toml)
Read `.kiro/specs/hypervisor-hypercore/tasks.md` Task 2.
Implement `hac.toml` config parser and pretty printer.
Lightweight approach — regex or simple parser, avoid heavy deps.
Property tests: parse → pretty-print → parse round-trip.

### Task S3-11: Hypervisor — VSOCK Communication
Read `.kiro/specs/hypervisor-hypercore/tasks.md` Task 6.
Implement VSOCK communication channel for sandbox ↔ host.
Message framing, serialization, bidirectional communication.
Unit tests for channel lifecycle.

### Task S3-12: Hypervisor — Moltbot + Image Verifier + Security
Read `.kiro/specs/hypervisor-hypercore/tasks.md` Tasks 9-10.
Implement Moltbot deployer and agent registry.
Implement image verifier and security auditing.
Property tests: image verification, sandbox isolation.

### Task S3-13: Hypervisor — Edge/Cloud + Rust Bridge + Wiring
Read `.kiro/specs/hypervisor-hypercore/tasks.md` Tasks 13-15.
Implement edge/cloud deployment provisioning.
Implement Rust Hypervisor Bridge stub.
Wire all components together, integrate with Nova26 modules.

### Task S3-14: Hypervisor — Final Checkpoint
Read `.kiro/specs/hypervisor-hypercore/tasks.md` Task 16.
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/hypervisor/` — all pass.
Mark all completed tasks in spec.
Commit + push: `feat(S3-14): Hypervisor spec complete`

---

## WAVE 4 (Hours 36–48): A2A Optional PBTs + Landing Page Spec

> Spec: `.kiro/specs/a2a-mcp-protocols/tasks.md` (optional PBTs)
> Spec: `.kiro/specs/landing-page-and-ux-validation/` (requirements exist, needs design + tasks)

### Task S3-15: A2A — Optional Property-Based Tests
Implement the optional PBT sub-tasks skipped in Sprint 2:
- Property 4: Agent Card serialization round trip
- Property 7: A2A Envelope serialization round trip
- Property 9: Message type validation
- Property tests for swarm coordinator consensus, task negotiation termination
Use `fast-check` for all.

### Task S3-16: Landing Page — Create Design + Tasks
Read `.kiro/specs/landing-page-and-ux-validation/requirements.md`.
Create `.kiro/specs/landing-page-and-ux-validation/design.md`.
Create `.kiro/specs/landing-page-and-ux-validation/tasks.md`.
Focus: hero section, CTA, feature showcase, responsive layout, accessibility.

### Task S3-17: Landing Page — Core Components
Follow the tasks.md you just created.
Implement landing page components in `app/`.
Hero section, feature cards, CTA buttons, navigation.
Tailwind + shadcn/ui. Mobile-first responsive.
Handle all 5 UI states per VENUS agent guidelines.

### Task S3-18: Landing Page — UX Validation + Accessibility
Accessibility audit: ARIA labels, keyboard navigation, color contrast.
Responsive breakpoint testing: mobile (375px), tablet (768px), desktop (1280px).
Unit tests for component rendering.

### Task S3-19: Wave 4 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests — must pass.
Commit + push: `feat(S3-19): A2A PBTs + Landing page complete`

---

## WAVE 5 (Hours 48–60): Dashboard Integration Panels

> Target: Wire Sonnet's modules into the dashboard with live status panels

### Task S3-20: Dashboard — Hypercore Status Panel
Create dashboard component showing Hypercore store status:
- Active stores, entry counts, replication peer count
- Sync status indicators (synced/syncing/offline)
- Wire into existing dashboard layout

### Task S3-21: Dashboard — Hypervisor Sandbox Panel
Create dashboard component showing Hypervisor sandbox status:
- Active sandboxes, resource usage per sandbox
- Lifecycle state indicators
- Network policy summary

### Task S3-22: Dashboard — A2A Communication Panel
Create dashboard component showing A2A message flow:
- Active channels, message throughput
- Agent tier visualization
- Recent routing events

### Task S3-23: Dashboard — Eternal Data Reel Overview
Create unified dashboard panel for Eternal Data Reel:
- Harness status (active harnesses, checkpoints)
- SAGA evolution progress (generation, fitness)
- Hindsight memory stats (fragments, consolidation)
- RLM compression metrics
Wire into Kimi's `src/eternal-reel/` exports.

### Task S3-24: Wave 5 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests — must pass.
Commit + push: `feat(S3-24): Dashboard panels — hypercore, hypervisor, a2a, eternal reel`

---

## WAVE 6 (Hours 60–72): Desktop/Mobile Polish + Observability + Final

> Target: Polish UX, wire observability, final sweep

### Task S3-25: Desktop + Mobile Polish
Review `src/desktop/` (6 src) and `src/mobile-launch/` (7 src).
Fix rough edges, ensure consistent UX patterns.
Add missing error/loading/empty states per VENUS guidelines.

### Task S3-26: Observability Wiring
Ensure hypercore, hypervisor, and a2a all emit telemetry to `src/observability/`.
Wire metrics into existing NovaTracer and EventStore.
Verify structured logs are consistent with project conventions.

### Task S3-27: Generative UI + Design Pipeline Review
Review `src/generative-ui/` (3 src) and `src/design-pipeline/` (5 src).
Ensure these modules are wired correctly and have adequate test coverage.
Add tests if coverage is thin.

### Task S3-28: Full Test Suite Sweep
Run `vitest run` — full suite.
Fix any failures.
Run `tsc --noEmit` — 0 errors.

### Task S3-29: Final Checkpoint
Run ALL tests — must pass.
Commit + push: `feat(S3-29): Sprint 3 complete — 3 specs done, landing page, dashboard, polish`

---

## TASK COUNT SUMMARY

| Wave | Hours | Tasks | Focus |
|------|-------|-------|-------|
| Wave 1 | 0–12 | S3-01 → S3-04 | Spec task reconciliation |
| Wave 2 | 12–24 | S3-05 → S3-09 | P2P Hypercore spec completion |
| Wave 3 | 24–36 | S3-10 → S3-14 | Hypervisor spec completion |
| Wave 4 | 36–48 | S3-15 → S3-19 | A2A PBTs + Landing page |
| Wave 5 | 48–60 | S3-20 → S3-24 | Dashboard integration panels |
| Wave 6 | 60–72 | S3-25 → S3-29 | Desktop/mobile + observability + sweep |
| **TOTAL** | **72h** | **29 tasks** | **3 specs completed + landing page + dashboard + polish** |

---

## PRIORITY ORDER (If Running Behind)

1. **Wave 1** (Spec reconciliation) — unblocks everything, low effort
2. **Wave 2** (P2P Hypercore) — complete the spec
3. **Wave 3** (Hypervisor) — complete the spec
4. **Wave 4** (Landing page) — user-facing, high impact
5. **Wave 5** (Dashboard) — integration visibility
6. **Wave 6** (Polish) — nice-to-have

---

*Sprint 3 created by Kiro (Opus 4.6) — February 22, 2026*
