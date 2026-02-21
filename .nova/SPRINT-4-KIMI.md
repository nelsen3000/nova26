# KIMI 2.5 — Sprint 4: "The Eternal Completer"
## February 25–28, 2026 (72 Hours)

> **Provider**: Moonshot (swarm)
> **Sprint 3 Status**: IN PROGRESS (39 tasks, 72h — Hindsight, RLM advanced, SAGA advanced, Harness advanced, cross-feature integration)
> **Sprint 4 Focus**: Complete remaining spec tasks for RLM, SAGA, Harness + New modules (ACP, Compliance, Behaviors) + Convex schema integration
> **Duration**: 72 hours (6 waves × 12 hours)
> **Project folder**: `/Users/jonathannelsen/nova26/kiro/nova26`
> **Cannot touch**: `convex/`, `app/`

---

## SPRINT 3 RECAP (Expected Deliverables)

| Module | Sprint 3 Work | Expected Status |
|--------|--------------|-----------------|
| Hindsight (`src/hindsight/`) | Full module: engine, consolidation, formatters, bridges, namespaces | ✅ Complete |
| RLM (`src/rlm/`) | AgentLoop integration, ATLAS integration, CRDT integration | ✅ Tasks 6, 9, 10 done |
| SAGA (`src/saga/`) | Inner/outer loops, sessions, autonomy, swarm debate, overnight, portfolio | ✅ Tasks 7-15 done |
| Harness (`src/harness/`) | Manager, serializer, persistence, tools, gates, plans, sub-agents, observability | ✅ Tasks 3-14 done |
| Eternal Reel (`src/eternal-reel/`) | Unified export, cross-module wiring, dream mode | ✅ Complete |

**After Sprint 3, remaining unchecked spec tasks:**
- RLM: Tasks 1-5, 7-8, 11 (foundations + pipeline + audit + Convex) — 8 tasks
- SAGA: Tasks 1-6 (foundations + mutation + fitness + taste guard + curriculum) — 6 tasks
- Harness: Tasks 1-2, 15-16 (foundations + Convex + final) — 4 tasks

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

## DO-NOT-TOUCH ZONES (Other Workers Active)

| Module | Owner | Sprint |
|--------|-------|--------|
| `src/hypercore/` | Sonnet | Sprint 3 |
| `src/hypervisor/` | Sonnet | Sprint 3 |
| `src/a2a/` | Sonnet | Sprint 3 |
| `convex/`, `app/` | Sonnet | Sprint 3 |

---

## WAVE 1 (Hours 0–12): RLM Spec Completion

> Spec: `.kiro/specs/recursive-language-models/tasks.md`
> Target: Tasks 1-5, 7-8 (types, context window, reader model, pipeline, audit)

### Task K4-01: RLM — Types + Context Window Serialization
Read `.kiro/specs/recursive-language-models/tasks.md` Tasks 1-2 (all sub-tasks).
Review existing `src/rlm/types.ts` and `src/rlm/schemas.ts` — ensure they match spec.
Review `src/rlm/context-window.ts` — ensure serialization matches spec requirements.
Add any missing types, schemas, or serialization logic.
Property tests: ContextWindow serialization round-trip, schema validation.

### Task K4-02: RLM — Reader Model Adapter + Model Selection
Read `.kiro/specs/recursive-language-models/tasks.md` Task 3 (all sub-tasks).
Review existing `src/rlm/reader-adapter.ts` and `src/rlm/model-selection.ts`.
Ensure reader model adapter correctly wraps LLM calls for compression.
Ensure model selection picks appropriate small/fast model for compression tasks.
Property tests: model selection always returns a valid model, compression ratio within bounds.

### Task K4-03: RLM — Pipeline Core Logic
Read `.kiro/specs/recursive-language-models/tasks.md` Task 5 (all sub-tasks).
Review existing `src/rlm/rlm-pipeline.ts`.
Ensure pipeline: input → prioritize → compress → fit → output.
Multi-pass compression with convergence detection.
Max recursion depth enforcement.
Property tests: output always fits within token budget, monotonic size reduction per pass.

### Task K4-04: RLM — Audit + Drift Detection
Read `.kiro/specs/recursive-language-models/tasks.md` Task 8 (all sub-tasks).
Review existing `src/rlm/audit.ts`.
Implement compression audit trail: log every compression with before/after metrics.
Drift detection: alert when compression quality degrades over time.
Property tests: audit log completeness, drift detection sensitivity.

### Task K4-05: Wave 1 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/rlm/` — all pass.
Commit + push: `feat(K4-05): RLM spec complete — all 12 tasks done`

---

## WAVE 2 (Hours 12–24): SAGA Spec Completion

> Spec: `.kiro/specs/saga-self-evolving-agents/tasks.md`
> Target: Tasks 1-6 (types, goal mutation, fitness evaluator, taste guard, curriculum generator)

### Task K4-06: SAGA — Types + Schemas Verification
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Task 1 (all sub-tasks).
Review existing `src/saga/types.ts` and `src/saga/schemas.ts`.
Ensure all interfaces match spec: GoalGenome, FitnessScore, MutationOp, CurriculumTask, etc.
Add any missing types or schema validations.
Property tests: GoalGenome serialization round-trip.

### Task K4-07: SAGA — Goal Mutation Operations
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Task 2 (all sub-tasks).
Review existing `src/saga/goal-genome.ts`.
Ensure mutation operations: mutate, crossover, interpolate.
Mutation respects bounds and constraints.
Property tests: mutation preserves genome structure, crossover produces valid offspring.

### Task K4-08: SAGA — Fitness Evaluator + Tournament Selection
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Task 3 (all sub-tasks).
Review existing `src/saga/fitness-evaluator.ts`.
Multi-objective fitness evaluation.
Tournament selection with configurable tournament size.
Property tests: tournament selection always picks from population, fitness ordering consistency.

### Task K4-09: SAGA — Taste Guard + Curriculum Generator
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Tasks 5-6 (all sub-tasks).
Review existing `src/saga/taste-guard.ts` and `src/saga/curriculum-generator.ts`.
Taste Guard: filter candidates that violate taste constraints.
Curriculum Generator: generate task sequences for fitness evaluation.
Property tests: taste guard never passes invalid candidates, curriculum covers all required skills.

### Task K4-10: SAGA — Checkpoint 4 Verification
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Task 4.
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/saga/` — all pass.
Commit + push: `feat(K4-10): SAGA spec complete — all 16 tasks done`

---

## WAVE 3 (Hours 24–36): Harness Spec Completion + ACP Module

> Spec: `.kiro/specs/agent-harnesses/tasks.md` Tasks 1-2, 15-16
> Target: Complete harness foundations + ACP module hardening

### Task K4-11: Harness — Types + Schemas + Core Lifecycle
Read `.kiro/specs/agent-harnesses/tasks.md` Tasks 1-2 (all sub-tasks).
Review existing `src/harness/types.ts`.
Ensure all types match spec: HarnessConfig, HarnessState, HarnessCheckpoint, etc.
Ensure AgentHarness state machine and lifecycle are complete.
Property tests: state machine validity, type serialization round-trip.

### Task K4-12: Harness — Convex Schema + Dashboard Mutations
Read `.kiro/specs/agent-harnesses/tasks.md` Task 15 (all sub-tasks).
**NOTE**: Cannot touch `convex/` directly. Instead:
- Create `src/harness/convex-types.ts` — TypeScript types that mirror what the Convex schema would look like
- Create `src/harness/convex-bridge.ts` — bridge layer that prepares data for Convex mutations
- Document the required Convex schema changes in a comment block for later integration

### Task K4-13: Harness — Final Checkpoint
Read `.kiro/specs/agent-harnesses/tasks.md` Task 16.
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/harness/` — all pass.
Commit + push: `feat(K4-13): Harness spec complete — all 16 tasks done`

### Task K4-14: ACP — Client + Server Hardening
Read all source files in `src/acp/`.
Review existing `src/acp/__tests__/acp.test.ts`.
Extend `src/acp/client.ts`: ensure connect, disconnect, send, receive, reconnect are robust.
Extend `src/acp/server.ts`: ensure listen, accept, broadcast, client management are complete.
Extend `src/acp/session-manager.ts`: session lifecycle, concurrent sessions.
Add comprehensive tests: `src/acp/__tests__/client-server.test.ts`.
Property tests: session lifecycle state machine, message delivery guarantees.

### Task K4-15: ACP — Descriptor + Types Completion
Review `src/acp/descriptor.ts` and `src/acp/types.ts`.
Ensure capability descriptors are complete and validated.
Ensure all types have Zod schemas.
Property tests: descriptor serialization round-trip.

### Task K4-16: Wave 3 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/harness/ src/acp/` — all pass.
Commit + push: `feat(K4-16): Harness + ACP specs complete`

---

## WAVE 4 (Hours 36–48): Compliance + Behaviors Modules

> Target: `src/compliance/` (6 src, 1 test) and `src/behaviors/` (8 src, 1 test)

### Task K4-17: Compliance — Audit Trail + PII Redactor
Read all source files in `src/compliance/`.
Review and extend `src/compliance/audit-trail.ts`:
- Log event, query by time range, query by agent, export, retention policy
Review and extend `src/compliance/pii-redactor.ts`:
- Redact emails, phone numbers, names, addresses, custom patterns, nested objects
Add tests: `src/compliance/__tests__/audit-pii.test.ts`.
Property tests: PII redaction idempotency, audit trail chronological ordering.

### Task K4-18: Compliance — Explanation Engine + Trajectory Recorder
Review and extend `src/compliance/explanation-engine.ts`:
- Generate explanation, trace decision path, format for different audiences
Review and extend `src/compliance/trajectory-recorder.ts`:
- Record step, replay trajectory, checkpoint, resume
Add tests: `src/compliance/__tests__/explanation-trajectory.test.ts`.
Property tests: trajectory replay fidelity.

### Task K4-19: Behaviors — Full Module Completion
Read all source files in `src/behaviors/`.
Review existing `src/behaviors/index.test.ts`.
Ensure all behavior functions/classes are complete and tested.
Add tests: `src/behaviors/__tests__/behaviors-deep.test.ts`.
Property tests: behavior composition associativity where applicable.

### Task K4-20: Wave 4 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/compliance/ src/behaviors/` — all pass.
Commit + push: `feat(K4-20): Compliance + Behaviors modules complete`

---

## WAVE 5 (Hours 48–60): MCP + Models + Model Routing

> Target: `src/mcp/` (5 src, 1 test), `src/models/` (6 src, 2 test), `src/model-routing/` (11 src, 2 test)

### Task K4-21: MCP — Client + Server + Registry
Read all source files in `src/mcp/`.
Review and extend:
- `src/mcp/client.ts`: connect, invoke tool, handle response, timeout, retry
- `src/mcp/server.ts`: register tool, handle invocation, error responses
- `src/mcp/registry.ts`: register, lookup, list, namespace isolation
Add tests: `src/mcp/__tests__/client-server-registry.test.ts`.
Property tests: tool registration/lookup round-trip, namespace isolation.

### Task K4-22: Models — Ensemble Engine + Model Router
Read all source files in `src/models/`.
Review and extend:
- `src/models/ensemble-engine.ts`: combine responses, voting, confidence weighting
- `src/models/model-router.ts`: route by task type, fallback chain, cost optimization
Add tests: `src/models/__tests__/ensemble-router.test.ts`.
Property tests: ensemble determinism with identical inputs, router always selects available model.

### Task K4-23: Model Routing — Router + Queue + Speculative Decoder
Read all source files in `src/model-routing/`.
Review and extend:
- `src/model-routing/router.ts`: route selection, fallback, preference matching
- `src/model-routing/inference-queue.ts`: priority ordering, capacity limits
- `src/model-routing/speculative-decoder.ts`: decode, verify, accept/reject
Add tests: `src/model-routing/__tests__/router-queue-decoder.test.ts`.
Property tests: queue ordering invariant, router fallback chain.

### Task K4-24: Model Routing — Metrics + Hardware + NovaBench + Modelfile
Review and extend:
- `src/model-routing/metrics-tracker.ts`: record, aggregate, time-window queries
- `src/model-routing/hardware-detector.ts`: detect capabilities
- `src/model-routing/benchmark/nova-bench.ts`: benchmark execution, scoring
- `src/model-routing/ollama-modelfile-generator.ts`: generate valid Modelfile syntax
Add tests: `src/model-routing/__tests__/metrics-hardware-bench.test.ts`.
Property tests: metrics aggregation commutativity, Modelfile always contains FROM directive.

### Task K4-25: Wave 5 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run src/mcp/ src/models/ src/model-routing/` — all pass.
Commit + push: `feat(K4-25): MCP + Models + Model Routing modules complete`

---

## WAVE 6 (Hours 60–72): Cross-Module Integration + Observability + Sweep

> Target: Wire new modules into observability, ensure cross-module contracts, final sweep

### Task K4-26: Observability Integration
Review `src/observability/` (14 src files).
Ensure all modules from Waves 3-5 emit telemetry:
- ACP sessions → observability events
- Compliance audit events → observability
- MCP tool invocations → observability
- Model routing decisions → observability
Wire into existing NovaTracer and EventStore.

### Task K4-27: Cross-Module Contract Tests
Create `src/__tests__/cross-module-contracts.test.ts`:
- RLM → AgentLoop: compressed tokens flow correctly
- SAGA → Harness: evolution tasks execute via harness
- Hindsight → ATLAS: memory fragments stored in ATLAS
- Compliance → all modules: audit trail captures events
- MCP → ACP: tool invocations route through ACP sessions
Lightweight integration tests — verify wiring, not deep logic.

### Task K4-28: RLM Convex Schema Prep
Read `.kiro/specs/recursive-language-models/tasks.md` Task 11.
**NOTE**: Cannot touch `convex/` directly. Instead:
- Create `src/rlm/convex-types.ts` — TypeScript types for Convex schema
- Create `src/rlm/convex-bridge.ts` — bridge layer for Convex mutations
- Document required Convex schema changes

### Task K4-29: Full Test Suite Sweep
Run `vitest run` — full suite.
Fix any failures.
Run `tsc --noEmit` — 0 errors.
Document any remaining thin-coverage areas for next sprint.

### Task K4-30: Final Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests — must pass.
Commit + push: `feat(K4-30): Sprint 4 complete — 6 specs done, cross-module integration, observability wired`

---

## TASK COUNT SUMMARY

| Wave | Hours | Tasks | Focus |
|------|-------|-------|-------|
| Wave 1 | 0–12 | K4-01 → K4-05 | RLM spec completion (8 remaining tasks) |
| Wave 2 | 12–24 | K4-06 → K4-10 | SAGA spec completion (6 remaining tasks) |
| Wave 3 | 24–36 | K4-11 → K4-16 | Harness spec completion + ACP module |
| Wave 4 | 36–48 | K4-17 → K4-20 | Compliance + Behaviors modules |
| Wave 5 | 48–60 | K4-21 → K4-25 | MCP + Models + Model Routing |
| Wave 6 | 60–72 | K4-26 → K4-30 | Observability + cross-module + sweep |
| **TOTAL** | **72h** | **30 tasks** | **3 specs completed + 5 modules hardened + integration** |

---

## PRIORITY ORDER (If Running Behind)

1. **Wave 1** (RLM) — complete the spec, AgentLoop integration is critical
2. **Wave 2** (SAGA) — complete the spec, evolution system needs foundations
3. **Wave 3** (Harness + ACP) — complete the spec + harden ACP
4. **Wave 5** (MCP + Models + Model Routing) — core infrastructure
5. **Wave 4** (Compliance + Behaviors) — important but less urgent
6. **Wave 6** (Integration + sweep) — ties everything together

---

## CROSS-REFERENCES

- `src/agent-loop/agent-loop.ts` — RLM pipeline injection (Sprint 3 work)
- `src/atlas/index.ts` — Hindsight ATLASBridge (Sprint 3 work)
- `src/taste-vault/taste-vault.ts` — Hindsight TasteVaultBridge (Sprint 3 work)
- `src/orchestrator/ralph-loop.ts` — Harness integration (Sprint 3 work)
- `src/observability/` — All modules emit telemetry
- `src/collaboration/crdt-core.ts` — RLM CRDT integration (Sprint 3 work)

---

*Sprint 4 created by Kiro (Opus 4.6) — February 22, 2026*
