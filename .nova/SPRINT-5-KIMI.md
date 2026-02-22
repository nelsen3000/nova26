# KIMI 2.5 — Sprint 5: "The Production Engine"
## February 28 – March 3, 2026 (72 Hours)

> **Provider**: Moonshot (swarm)
> **Sprint 4 Status**: COMPLETE — 28 tasks, 6 waves. RLM, SAGA, Harness, Hindsight specs all done. Convex bridge types created. 2,446 tests, 0 TS errors. 51 new tests added.
> **Sprint 5 Focus**: Test coverage for thin modules, SAGA/RLM deep testing, CLI production commands, real Convex integration layer, cross-module hardening
> **Duration**: 72 hours (6 waves × 12 hours)
> **Project folder**: `/Users/jonathannelsen/nova26/kiro/nova26`
> **Git HEAD**: latest on origin/main

---

## CURRENT CODEBASE STATE

- 364 test files, ~9,907 tests, 0 TS errors
- Kimi Sprint 4 complete: all 4 Eternal Data Reel specs done, Convex bridge types created
- Sonnet Sprint 3 complete: hypercore, hypervisor, a2a, landing page, dashboard panels
- Haiku Sprint 6 complete: PBT sweep, deep coverage, cross-module smoke tests
- **Key gaps**: SAGA has 18 src / 2 tests (worst ratio in codebase), RLM has 12 src / 1 test, ACP/Compliance/MCP thin, CLI needs production commands, Convex bridge types exist but have no tests

---

## SPRINT 5 RULES

- TypeScript strict, ESM `.js` imports, vitest, no `any`, mock all I/O
- All new code in `src/` (not `app/` or `convex/`)
- Property-based tests use `fast-check` (already in dependencies)
- Run `tsc --noEmit` after each task — must be 0 errors
- Run `vitest run src/<module>/` after each task — must pass
- Commit after each task: `feat(K5-XX): <description>`
- Push after each wave checkpoint

---

## DO-NOT-TOUCH ZONES

| Module | Owner | Sprint |
|--------|-------|--------|
| `src/hypercore/` | Sonnet | Sprint 4 (Convex bridge) |
| `src/hypervisor/` | Sonnet | Sprint 4 (Convex bridge) |
| `src/a2a/` | Sonnet | Sprint 4 (Convex bridge) |
| `app/` | Sonnet | Sprint 4 (dashboard wiring) |
| `convex/` | Sonnet | Sprint 4 (mutations/queries) |

---

## WAVE 1 (Hours 0–12): SAGA Deep Testing + RLM Deep Testing

> Target: Fix the two worst test ratios in the codebase

### Task K5-01: Pull + Baseline
Pull latest from main.
Run `tsc --noEmit` — 0 errors.
Run `vitest run` — baseline test count.
Fix any merge conflicts.

### Task K5-02: SAGA — Comprehensive Test Suite
`src/saga/` has 18 source files but only 2 test files. This is the worst ratio in the codebase.
Read all 18 source files. Create comprehensive tests:
- `src/saga/__tests__/saga-inner-loop.test.ts`: inner loop execution, iteration budget, partial fitness
- `src/saga/__tests__/saga-outer-loop.test.ts`: candidate generation, tournament selection, lineage tracking
- `src/saga/__tests__/saga-session-manager.test.ts`: create, pause, resume, stop, budget enforcement
- `src/saga/__tests__/saga-autonomy-swarm.test.ts`: autonomy gating levels, swarm debate consensus
- `src/saga/__tests__/saga-overnight-portfolio.test.ts`: overnight evolution, portfolio seeding
Property tests: lineage graph reachability, budget enforcement, population size invariant.
Target: 60+ new tests.

### Task K5-03: RLM — Comprehensive Test Suite
`src/rlm/` has 12 source files but only 1 test file. Second worst ratio.
Read all 12 source files. Create comprehensive tests:
- `src/rlm/__tests__/rlm-pipeline.test.ts`: compression pipeline, token counting, bypass
- `src/rlm/__tests__/rlm-context-window.test.ts`: serialization, budget enforcement, overflow handling
- `src/rlm/__tests__/rlm-audit-drift.test.ts`: audit trail completeness, drift detection sensitivity
- `src/rlm/__tests__/rlm-atlas-crdt.test.ts`: ATLAS storage, CRDT compression, cross-project merge
Property tests: compression ratio always 0-1, token count non-negative, audit log append-only.
Target: 40+ new tests.

### Task K5-04: Wave 1 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/saga/ src/rlm/` — all pass.
Commit + push: `test(K5-04): SAGA + RLM comprehensive test suites — 100+ new tests`

---

## WAVE 2 (Hours 12–24): Thin Module Coverage Blitz

> Target: ACP, Compliance, MCP — all have 6/5 src but only 2 tests each

### Task K5-05: ACP — Full Test Coverage
Read all 6 source files in `src/acp/`.
Create `src/acp/__tests__/acp-deep.test.ts`:
- Test all ACP protocol operations
- Test permission checking, capability negotiation
- Test error handling and edge cases
Property tests: permission check determinism, capability negotiation convergence.
Target: 25+ new tests.

### Task K5-06: Compliance — Full Test Coverage
Read all 6 source files in `src/compliance/`.
Create `src/compliance/__tests__/compliance-deep.test.ts`:
- Test all compliance rules and validators
- Test audit logging, violation detection
- Test remediation suggestions
Property tests: compliance check idempotency, violation severity ordering.
Target: 25+ new tests.

### Task K5-07: MCP — Full Test Coverage
Read all 5 source files in `src/mcp/`.
Create `src/mcp/__tests__/mcp-deep.test.ts`:
- Test MCP protocol implementation
- Test tool registration, discovery, invocation
- Test error handling, timeout, retry
Property tests: tool registry round-trip, invocation always returns structured result.
Target: 20+ new tests.

### Task K5-08: Convex Bridge Type Tests
Test all 4 Convex bridge type files you created in Sprint 4:
- `src/rlm/__tests__/convex-bridge.test.ts`: type validation, mutation builders, query builders
- `src/saga/__tests__/convex-bridge.test.ts`: same pattern
- `src/harness/__tests__/convex-bridge.test.ts`: same pattern
- `src/hindsight/__tests__/convex-bridge.test.ts`: same pattern
Property tests: bridge type serialization round-trip.
Target: 30+ new tests.

### Task K5-09: Wave 2 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/acp/ src/compliance/ src/mcp/` — all pass.
Commit + push: `test(K5-09): ACP + Compliance + MCP + Convex bridge tests — 100+ new tests`

---

## WAVE 3 (Hours 24–36): CLI Production Commands

> Target: CLI commands for production operations — deploy, status, diagnostics

### Task K5-10: CLI — `/deploy` Command
Create `src/cli/deploy-commands.ts`:
- `/deploy preview` — dry-run deployment check (validate config, check deps)
- `/deploy status` — show current deployment state
- `/deploy rollback` — rollback to previous version (stub, logs intent)
Tests in `src/cli/__tests__/deploy-commands.test.ts`.

### Task K5-11: CLI — `/diagnostics` Command
Create `src/cli/diagnostics-commands.ts`:
- `/diagnostics run` — full system health check (all modules)
- `/diagnostics report` — generate diagnostic report (JSON + human-readable)
- `/diagnostics fix` — attempt auto-fix for known issues
Tests in `src/cli/__tests__/diagnostics-commands.test.ts`.

### Task K5-12: CLI — `/project` Command
Create `src/cli/project-commands.ts`:
- `/project init` — initialize new Nova26 project
- `/project status` — show project health, test count, coverage
- `/project export` — export project config + agent settings
- `/project import` — import project config from export
Tests in `src/cli/__tests__/project-commands.test.ts`.

### Task K5-13: CLI — `/agent` Enhanced Commands
Extend existing agent CLI with production features:
- `/agent benchmark <name>` — run performance benchmark for specific agent
- `/agent logs <name>` — show recent agent activity logs
- `/agent reset <name>` — reset agent state to defaults
Tests in `src/cli/__tests__/agent-enhanced-commands.test.ts`.

### Task K5-14: Wave 3 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/cli/` — all pass.
Commit + push: `feat(K5-14): CLI production commands — deploy, diagnostics, project, agent enhanced`

---

## WAVE 4 (Hours 36–48): Eternal Data Reel Integration Hardening

> Target: Harden the cross-module integration between RLM, SAGA, Harness, Hindsight

### Task K5-15: Eternal Reel — Factory Tests
Read `src/eternal-reel/factory.ts` and `src/eternal-reel/index.ts`.
Create `src/eternal-reel/__tests__/factory-deep.test.ts`:
- Factory initializes all 4 modules correctly
- Shared config propagates to all modules
- Module health checks work through factory
- Graceful degradation when one module fails
Property tests: factory always returns valid instance, config propagation completeness.

### Task K5-16: Dream Mode — Deep Tests
Read `src/eternal-reel/dream-mode.ts`.
Create `src/eternal-reel/__tests__/dream-mode-deep.test.ts`:
- Dream mode coordinates all 4 modules
- SAGA overnight evolution triggers correctly
- Hindsight consolidation runs during dream
- RLM cache warming executes
- Harness checkpoint pruning works
- DreamModeReport is complete and accurate
Property tests: dream mode report completeness, operation ordering.

### Task K5-17: Harness — State Machine PBTs
`src/harness/` has 18 src / 10 tests — decent but the state machine needs PBTs.
Create `src/harness/__tests__/harness-state-pbt.test.ts`:
- State machine: only valid transitions occur
- Checkpoint serialization round-trip
- Tool call budget enforcement across all paths
- Sub-agent depth enforcement
- Execution plan dependency resolution
Property tests: state machine validity, checkpoint round-trip, budget monotonic decrease.
Target: 20+ PBTs.

### Task K5-18: Cross-Module Data Flow Tests
Create `src/__tests__/eternal-reel-data-flow.test.ts`:
- RLM compresses → Hindsight stores compressed context
- SAGA evolves → Harness executes evolution tasks
- Hindsight consolidates → ATLAS receives consolidated fragments
- Harness checkpoints → include RLM compressed state
- Dream mode → all 4 modules coordinate
Verify data flows correctly between modules.

### Task K5-19: Wave 4 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/eternal-reel/ src/harness/` — all pass.
Commit + push: `test(K5-19): Eternal Data Reel integration hardening — factory, dream mode, state PBTs, data flow`

---

## WAVE 5 (Hours 48–60): Agent System + Taste Vault + Behaviors Hardening

> Target: Harden the agent infrastructure layer

### Task K5-20: Agent Capability Matrix — Extended Tests
Read `src/agents/capability-matrix.ts`.
Create `src/agents/__tests__/capability-matrix-extended.test.ts`:
- Test all 21 agents have capabilities defined
- Test capability matching for complex task types
- Test multi-agent selection for collaborative tasks
- Test capability overlap detection
Property tests: capability matching always returns subset of available agents.

### Task K5-21: Taste Vault — CRDT Sync Tests
Read `src/taste-vault/crdt-taste-sync.ts` and related files.
Create `src/taste-vault/__tests__/crdt-sync-deep.test.ts`:
- Test taste preference synchronization across agents
- Test conflict resolution when agents disagree
- Test convergence after network partition
Property tests: CRDT convergence, taste score bounded [0,1].

### Task K5-22: Behaviors — Composition + Chaining Tests
Read all 8 source files in `src/behaviors/`.
Create `src/behaviors/__tests__/behaviors-composition.test.ts`:
- Test behavior composition (A then B = AB)
- Test behavior chaining with error propagation
- Test circuit breaker + retry composition
- Test behavior priority ordering
Property tests: composition associativity, error propagation completeness.

### Task K5-23: Agent Loop — Budget + Fallback Tests
Read `src/agent-loop/agent-loop.ts`.
Create `src/agent-loop/__tests__/budget-fallback.test.ts`:
- Test token budget enforcement with various limits
- Test fallback chain when primary model fails
- Test RLM compression integration under budget pressure
- Test graceful degradation when all models fail
Property tests: budget never exceeded, fallback always terminates.

### Task K5-24: Wave 5 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/agents/ src/taste-vault/ src/behaviors/ src/agent-loop/` — all pass.
Commit + push: `test(K5-24): Agent system + Taste Vault + Behaviors + Agent Loop hardening`

---

## WAVE 6 (Hours 60–72): Production Readiness + Final Sweep

> Target: Production-grade error handling, final quality sweep

### Task K5-25: Error Catalog
Create `src/errors/error-catalog.ts`:
- Typed error classes for each module (RLMError, SAGAError, HarnessError, etc.)
- Error codes with human-readable messages
- Error severity levels (fatal, recoverable, warning)
- Error serialization for logging/reporting
Tests in `src/errors/__tests__/error-catalog.test.ts`.

### Task K5-26: Module Health Registry
Create `src/health/module-health-registry.ts`:
- Register all modules with health check functions
- Aggregate health status across all modules
- Dependency-aware health (if module A depends on B, A is unhealthy when B is)
- Health history for trend analysis
Tests in `src/health/__tests__/module-health-registry.test.ts`.

### Task K5-27: Full Test Suite Sweep
Run `vitest run` — full suite.
Fix any failures.
Run `tsc --noEmit` — 0 errors.
Document final test count and any remaining thin areas.

### Task K5-28: Final Checkpoint
Run ALL tests — must pass.
Commit + push: `feat(K5-28): Sprint 5 complete — production engine, 200+ new tests, all modules hardened`

---

## TASK COUNT SUMMARY

| Wave | Hours | Tasks | Focus |
|------|-------|-------|-------|
| Wave 1 | 0–12 | K5-01 → K5-04 | SAGA + RLM deep testing |
| Wave 2 | 12–24 | K5-05 → K5-09 | ACP + Compliance + MCP + Convex bridges |
| Wave 3 | 24–36 | K5-10 → K5-14 | CLI production commands |
| Wave 4 | 36–48 | K5-15 → K5-19 | Eternal Data Reel integration hardening |
| Wave 5 | 48–60 | K5-20 → K5-24 | Agent system + Taste Vault + Behaviors |
| Wave 6 | 60–72 | K5-25 → K5-28 | Error catalog + health registry + sweep |
| **TOTAL** | **72h** | **28 tasks** | **~200+ new tests, worst ratios fixed, CLI production commands, error handling** |

---

## PRIORITY ORDER (If Running Behind)

1. **Wave 1** (SAGA + RLM tests) — worst test ratios, highest risk
2. **Wave 2 K5-05-07** (ACP + Compliance + MCP) — thin coverage
3. **Wave 4** (Eternal Reel hardening) — integration confidence
4. **Wave 3** (CLI commands) — user-facing features
5. **Wave 5** (Agent system) — moderate coverage already
6. **Wave 6** (Error catalog + sweep) — production polish
7. **Wave 2 K5-08** (Convex bridge tests) — nice-to-have

---

*Sprint 5 created by Kiro (Opus 4.6) — February 28, 2026*
