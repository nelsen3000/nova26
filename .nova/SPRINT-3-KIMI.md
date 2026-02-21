# KIMI 2.5 — Sprint 3: "The Eternal Weaver"
## February 22–25, 2026 (72 Hours)

> **Provider**: Moonshot (swarm)
> **Sprint 2 Status**: Waves 1–3 COMPLETE (Harness 52 tests, SAGA 15 tests, RLM 18 tests = 85 total)
> **Sprint 3 Focus**: Hindsight Persistent Memory + RLM Advanced + SAGA Advanced + Harness Advanced + Cross-Feature Integration + New Modules
> **Duration**: 72 hours (6 waves × 12 hours)
> **Project folder**: `/Users/jonathannelsen/nova26/kiro/nova26`
> **Cannot touch**: `convex/`, `app/`

---

## SPRINT 2 RECAP (Kimi's Completed Work)

| Module | Files | Tests | Status |
|--------|-------|-------|--------|
| Agent Harnesses (`src/harness/`) | 12 files | 52 tests (3 test files) | ✅ Wave 1 complete |
| SAGA Self-Evolving Agents (`src/saga/`) | 15 files | 15 tests (1 test file) | ✅ Wave 2 complete |
| Recursive Language Models (`src/rlm/`) | 9 files | 18 tests (1 test file) | ✅ Wave 3 complete |
| Hindsight Persistent Memory | 0 files | 0 tests | ❌ Not started |

**Total project state**: 287 test files, 8341 tests, 0 failures, 0 TS errors

---

## SPRINT 3 RULES

- TypeScript strict, ESM `.js` imports, vitest, no `any`, mock all I/O
- All new code in `src/` (not `app/` or `convex/`)
- Follow Kiro spec task lists exactly — each task references requirements
- Property-based tests use `fast-check` (already in dependencies)
- Run `tsc --noEmit` after each task — must be 0 errors
- Run `vitest run src/<module>/` after each task — must pass
- Commit after each task: `feat(K3-XX): <description>`
- Push after each wave checkpoint

---

## WAVE 1 (Hours 0–12): Hindsight Persistent Memory — Foundation

> Spec: `.kiro/specs/hindsight-persistent-memory/tasks.md`
> Target: Tasks 1–5 (types, storage adapter, vector index, engine core)

### Task K3-01: Hindsight Types + Config
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` Task 1 (all sub-tasks).
Create `src/hindsight/types.ts` with all interfaces:
- MemoryFragment, MemoryFragmentInput, HindsightConfig, FragmentFilter
- ScoredFragment, RetrievalContext, ConsolidationReport, HealthStatus
- Zod schemas for HindsightConfig validation
- MemoryFragment serialization/deserialization helpers (toJSON, fromJSON)
- Factory function: MemoryFragmentInput → MemoryFragment (auto-generates id, timestamps, namespace)
Property tests: JSON serialization round-trip, invalid config rejection.
_Requirements: 1.1, 2.6, 3.6, 9.1, 9.2_

### Task K3-02: Hindsight Storage Adapter + SQLite Implementation
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` Task 2 (all sub-tasks).
Create `src/hindsight/storage-adapter.ts` — StorageAdapter interface.
Create `src/hindsight/sqlite-adapter.ts` — SQLite + sqlite-vec implementation.
Methods: write, read, bulkWrite, bulkRead, delete, query, count, searchByVector, exportAll, importAll, isAvailable, getStats.
**NOTE**: If `better-sqlite3` or `sqlite-vec` are not available, create an in-memory adapter (`src/hindsight/memory-adapter.ts`) that implements the same interface using Maps. This is the safer path for CI/testing.
Property tests: export/import round-trip, search filter correctness.
_Requirements: 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3_

### Task K3-03: Hindsight Vector Index + Retrieval Scoring
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` Task 4 (all sub-tasks).
Create `src/hindsight/vector-index.ts` — VectorIndex interface + implementation.
Composite scoring: similarity × recency × access frequency.
Configurable similarity threshold filtering.
Property tests: retrieval ranking correctness.
_Requirements: 1.3, 1.5, 3.1, 3.2, 3.4_

### Task K3-04: Hindsight Engine Core
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` Task 5 (all sub-tasks).
Create `src/hindsight/engine.ts` — HindsightEngine class.
Methods: store(), retrieve(), search(), initialize(), shutdown(), healthCheck().
Fallback to in-memory cache when storage unavailable.
Property tests: fragment creation completeness.
_Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 9.1, 9.3, 9.4, 9.5_

### Task K3-05: Wave 1 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run all hindsight tests — must pass.
Commit + push: `feat(K3-05): Hindsight foundation — types, storage, vector index, engine`

---

## WAVE 2 (Hours 12–24): Hindsight Advanced — Consolidation, Formatting, Bridges

> Spec: `.kiro/specs/hindsight-persistent-memory/tasks.md`
> Target: Tasks 6–11 (consolidation, formatter, ATLAS bridge, Taste Vault bridge, namespaces)

### Task K3-06: Hindsight Consolidation Pipeline
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` Task 6 (all sub-tasks).
Create `src/hindsight/consolidation.ts` — ConsolidationPipeline class.
- Deduplication: cosine similarity > 0.95 → merge
- Forgetting curve: R × exp(-D × T) for unaccessed, unpinned fragments
- Archival: isArchived=true for below-threshold (not permanent delete)
- Compression: summarize low-relevance fragments when size exceeds threshold
- Return ConsolidationReport with accurate counts
Property tests: forgetting curve decay, deduplication merges, merge preserves highest relevance, below-threshold archived not deleted, consolidation report accuracy.
_Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

### Task K3-07: Hindsight Retrieval Formatter
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` Task 8 (all sub-tasks).
Create `src/hindsight/formatter.ts` — RetrievalFormatter + prettyPrint.
- Token budget enforcement with relevance-based prioritization
- Type-specific formatting: episodic, procedural, semantic
Property tests: token budget enforcement, type-specific formatting completeness, pretty-printer key fields.
_Requirements: 3.5, 8.1, 8.2, 8.3, 8.4, 8.5_

### Task K3-08: Hindsight ATLAS Bridge
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` Task 9 (all sub-tasks).
Create `src/hindsight/atlas-bridge.ts` — ATLASBridge class.
- onBuildLogged(): convert BuildLog → MemoryFragmentInput → engine.store()
- onRetrospectiveComplete(): create semantic fragments from insights
- mapSemanticTags(): ATLAS CodeNode tags → Hindsight namespace tags
- enrichRetrieval(): query Kronos for additional context (graceful fallback)
Property tests: bridge fragment creation, ATLAS tag mapping determinism.
_Requirements: 5.1, 5.3, 5.4, 5.5_

### Task K3-09: Hindsight Taste Vault Bridge
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` Task 10 (all sub-tasks).
Create `src/hindsight/taste-vault-bridge.ts` — TasteVaultBridge class.
- onPatternLearned(): GraphNode → MemoryFragmentInput
- onPatternReinforced(): boost relevance score
- onConflictResolved(): create procedural fragment
- supplementRetrieval(): search for semantically similar fragments
Property tests: fragment creation, reinforcement boosts relevance.
_Requirements: 6.1, 6.2, 6.3, 6.4_

### Task K3-10: Hindsight Namespace Manager + Parallel Universe Bridge
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` Task 11 (all sub-tasks).
Create `src/hindsight/namespace-manager.ts` — fork, merge, isolation logic.
Create `src/hindsight/parallel-universe-bridge.ts` — ParallelUniverseBridge.
Property tests: namespace isolation, branch merge reconciliation, cross-agent retrieval.
_Requirements: 7.2, 7.3, 7.4, 7.5_

### Task K3-11: Hindsight Index + Public API
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` Task 14 (all sub-tasks).
Create `src/hindsight/index.ts` — barrel export + createHindsightEngine() factory.
Export all types, adapters, bridges, engine.
_Requirements: 9.1, 9.5_

### Task K3-12: Wave 2 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run all hindsight tests — must pass.
Commit + push: `feat(K3-12): Hindsight complete — consolidation, formatter, bridges, namespaces`

---

## WAVE 3 (Hours 24–36): RLM Advanced — ATLAS, CRDT, AgentLoop Integration

> Spec: `.kiro/specs/recursive-language-models/tasks.md`
> Target: Tasks 6, 9, 10, 11 (AgentLoop integration, ATLAS integration, CRDT integration, Convex schema)

### Task K3-13: RLM → AgentLoop Integration
Read `.kiro/specs/recursive-language-models/tasks.md` Task 6 (all sub-tasks).
Extend `AgentLoopConfig` in `src/agent-loop/agent-loop.ts`:
- Add optional `rlm?: RlmPipelineConfig` to config
- Add `originalTokens`, `compressedTokens`, `compressionRatio`, `rlmFallbackUsed` to result
Inject RLM pipeline into `AgentLoop.callModel()`:
- Before building user prompt, run through RlmPipeline if enabled
- Use compressed messages for LLM call
- Count compressed tokens against budget
- Bypass when disabled
Property tests: token count tracking, bypass when disabled, budget uses compressed tokens.
_Requirements: 3.1, 3.2, 3.3, 3.4_

### Task K3-14: RLM → ATLAS Integration
Read `.kiro/specs/recursive-language-models/tasks.md` Task 9 (all sub-tasks).
Create `src/rlm/atlas-integration.ts`:
- Store serialized ContextWindow in ATLAS memory after successful compression
- Re-compress retrieved historical context to fit current budget
- Handle cross-project context merging
Property tests: ATLAS storage after compression, budget compliance on retrieved context.
_Requirements: 4.1, 4.2, 4.3_

### Task K3-15: RLM → CRDT Collaboration Integration
Read `.kiro/specs/recursive-language-models/tasks.md` Task 10 (all sub-tasks).
Create `src/rlm/crdt-integration.ts`:
- Compress session history before CRDT broadcast
- Generate compressed summary for new participant joins
- Reconcile divergent compressed contexts by createdAt timestamp
Property tests: CRDT compression before broadcast, join summary, reconciliation.
_Requirements: 5.1, 5.2, 5.3_

### Task K3-16: Wave 3 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run all RLM tests — must pass.
Commit + push: `feat(K3-16): RLM advanced — AgentLoop, ATLAS, CRDT integrations`

---

## WAVE 4 (Hours 36–48): SAGA Advanced — Outer Loop, Sessions, Autonomy, Swarm Debate

> Spec: `.kiro/specs/saga-self-evolving-agents/tasks.md`
> Target: Tasks 7–15 (inner loop, outer loop, ATLAS store, session manager, autonomy, swarm debate, overnight, portfolio, engine)

### Task K3-17: SAGA Inner Loop
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Task 7 (all sub-tasks).
Create or update `src/saga/inner-loop.ts`:
- Load GoalGenome → generate Curriculum → execute tasks via Agent Harness → collect metrics → produce fitness summary
- Handle iteration budget exceeded with partial fitness summary
_Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

### Task K3-18: SAGA Outer Loop
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Task 8 (all sub-tasks).
Create or update `src/saga/outer-loop.ts`:
- Generate candidates via GoalMutator → filter via TasteGuard → run Inner Loop → evaluate fitness → tournament selection → persist to ATLAS
- Handle low-fitness generation retention with increased mutation diversity
- Track lineage for all genomes
Property tests: lineage graph reachability, candidate generation from population.
_Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

### Task K3-19: SAGA ATLAS Goal Store
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Task 10 (all sub-tasks).
Create or update `src/saga/atlas-goal-store.ts`:
- TypeScript client wrapper for genome persistence
- Notable fitness logging to existing ATLAS learnings
Property tests: persistence completeness, retention pruning, notable fitness logging.
_Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

### Task K3-20: SAGA Session Manager
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Task 11 (all sub-tasks).
Create or update `src/saga/session-manager.ts`:
- create, pause, resume, stop, checkBudget, checkpoint
- Budget checking before each Outer Loop iteration
Property tests: budget enforcement, pause/resume round-trip, population size invariant.
_Requirements: 7.1, 7.3, 7.4, 7.5, 7.6, 7.7_

### Task K3-21: SAGA Autonomy Gating + Swarm Debate
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Task 13 (all sub-tasks).
Create or update `src/saga/autonomy-gating.ts` and `src/saga/swarm-debate.ts`:
- Autonomy levels 1-5 gate placement
- Swarm Debate: submit candidates, collect scores/critiques, consensus rejection
Property tests: autonomy-level gating, swarm debate score incorporation, consensus rejection.
_Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.3, 10.4, 10.5_

### Task K3-22: SAGA Overnight Evolution + Portfolio Learning
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Task 14 (all sub-tasks).
Create `src/saga/overnight-evolution.ts` and `src/saga/portfolio-learning.ts`:
- Overnight mode with time budget, auto-checkpoint, summary report
- Portfolio seeding from high-fitness genomes across projects
Property tests: auto-checkpoint frequency, overnight summary completeness, portfolio seed limit, cross-project learning logging.
_Requirements: 10.1, 10.2, 10.6, 11.1, 11.2, 11.3, 11.4_

### Task K3-23: SAGA Engine + Index
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Task 15 (all sub-tasks).
Create or update `src/saga/saga-engine.ts` and `src/saga/index.ts`:
- SAGAEngine: startSession, pauseSession, resumeSession, stopSession, getSession, listSessions
- Wire all components together
- Barrel export
_Requirements: 7.1, 12.2_

### Task K3-24: Wave 4 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run all SAGA tests — must pass.
Commit + push: `feat(K3-24): SAGA advanced — loops, sessions, autonomy, swarm debate, overnight, portfolio`

---

## WAVE 5 (Hours 48–60): Harness Advanced — Persistence, Tools, Human-in-Loop, Plans, Sub-Agents

> Spec: `.kiro/specs/agent-harnesses/tasks.md`
> Target: Tasks 3–12 (manager, serializer, persistence, tool calls, human-in-loop, execution plans, sub-agents, observability)

### Task K3-25: Harness Manager Registry
Read `.kiro/specs/agent-harnesses/tasks.md` Task 3 (all sub-tasks).
Create `src/harness/harness-manager.ts` — HarnessManager class.
- create() with unique IDs, get(), list(), stop(), resumeFromCheckpoint()
- In-memory registry, singleton via getHarnessManager()
Property tests: harness creation invariants.
_Requirements: 1.1, 1.6_

### Task K3-26: Harness State Serialization
Read `.kiro/specs/agent-harnesses/tasks.md` Task 4 (all sub-tasks).
Create `src/harness/harness-serializer.ts`:
- serialize(state) → JSON with schemaVersion
- deserialize(json) → HarnessState with version validation
Property tests: JSON serialization round-trip.
_Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

### Task K3-27: Harness Eternal Engine Bridge (Persistence)
Read `.kiro/specs/agent-harnesses/tasks.md` Task 6 (all sub-tasks).
Create `src/harness/eternal-engine-bridge.ts`:
- persist(), restore(), delete(), isAvailable()
- Primary: Rust FFI stub (returns unavailable)
- Fallback: existing `src/persistence/checkpoint-system.ts` SQLite
Property tests: persistence round-trip.
_Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

### Task K3-28: Harness Tool Call Manager
Read `.kiro/specs/agent-harnesses/tasks.md` Task 7 (all sub-tasks).
Create `src/harness/tool-call-manager.ts`:
- Permission checking, exponential backoff retry, timeout handling
- Per-harness budget limit enforcement
- Call history recording
Property tests: permission enforcement, retry backoff, budget enforcement.
_Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

### Task K3-29: Harness Human-in-Loop Gate
Read `.kiro/specs/agent-harnesses/tasks.md` Task 8 (all sub-tasks).
Create `src/harness/human-in-loop-gate.ts`:
- approve(), reject(reason), isPending()
- Autonomy level gate placement (1-2: all, 3: critical, 4-5: none)
- Persist state on gate, resume on approve
Property tests: autonomy-level gate placement, gate suspend behavior.
_Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

### Task K3-30: Harness Execution Plans + Dependency Resolution
Read `.kiro/specs/agent-harnesses/tasks.md` Task 10 (all sub-tasks).
Create `src/harness/execution-plan.ts`:
- createPlan(task) → ordered steps with dependencies
- completeStep(), failStep(), isComplete()
- Transitive dependency blocking on failure
Property tests: step structure, dependency resolution, plan completion triggers harness completion.
_Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

### Task K3-31: Harness Sub-Agent Spawning
Read `.kiro/specs/agent-harnesses/tasks.md` Task 11 (all sub-tasks).
Add sub-agent logic to `src/harness/agent-harness.ts` (or new file):
- Spawn sub-agent harness via HarnessManager
- Track sub-agents in parent state
- Max depth enforcement (default 3)
Property tests: sub-agent spawning/tracking, depth enforcement.
_Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

### Task K3-32: Harness Observability Emitter
Read `.kiro/specs/agent-harnesses/tasks.md` Task 12 (all sub-tasks).
Create `src/harness/observability-emitter.ts`:
- emitStateTransition(), emitToolCall(), emitHumanGate(), emitSubAgent(), emitCheckpoint()
- Wire into existing NovaTracer + EventStore
Property tests: event completeness.
_Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

### Task K3-33: Wave 5 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run all harness tests — must pass.
Commit + push: `feat(K3-33): Harness advanced — manager, persistence, tools, gates, plans, sub-agents`

---

## WAVE 6 (Hours 60–72): Cross-Feature Integration + Eternal Data Reel

> Target: Wire all 4 modules together, Ralph Loop integration, unified export

### Task K3-34: Harness → Ralph Loop Integration
Read `.kiro/specs/agent-harnesses/tasks.md` Task 14 (all sub-tasks).
Wire harness into `src/orchestrator/ralph-loop.ts`:
- Add `harnessEnabled?: boolean` to RalphLoopOptions
- Long-running tasks → delegate to HarnessManager
- Dream Mode auto-checkpoint interval
- Overnight evolution persistence at phase boundaries
Property tests: long-running task wrapping.
_Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

### Task K3-35: Hindsight → ATLAS + Taste Vault Wiring
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` Task 14.2 and 14.3.
Wire ATLASBridge into `src/atlas/index.ts`:
- Optional Hindsight hook on KronosAtlas.logBuild()
- Optional Hindsight hook on KronosRetrospective
Wire TasteVaultBridge into `src/taste-vault/taste-vault.ts`:
- Optional Hindsight hook on TasteVault.learn()
- Optional Hindsight hook on TasteVault.reinforce()
_Requirements: 5.1, 5.4, 6.1, 6.3_

### Task K3-36: Cross-Module Integration
Wire all 4 Eternal Data Reel modules together:
- Agent Harnesses use Hindsight for checkpoint context enrichment
- SAGA uses Hindsight patterns for evolution fitness signals
- RLM compresses Hindsight memories for context windows
- Harness checkpoints include RLM compressed state
- All modules report to existing observability (`src/observability/`)

### Task K3-37: Eternal Data Reel Unified Export
Create `src/eternal-reel/index.ts` — unified export for all Eternal Data Reel features:
```typescript
export * from '../harness/index.js';
export * from '../saga/index.js';
export * from '../rlm/index.js';
export * from '../hindsight/index.js';
export { createEternalReel } from './factory.js';
```
Create `src/eternal-reel/factory.ts` — factory that initializes all 4 modules with shared config.

### Task K3-38: Dream Mode Integration
Create `src/eternal-reel/dream-mode.ts`:
- DreamMode class that coordinates overnight operations across all modules
- Triggers SAGA overnight evolution
- Triggers Hindsight consolidation
- Triggers RLM cache warming for next session
- Triggers Harness checkpoint pruning
- Produces unified DreamModeReport

### Task K3-39: Final Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests across all modules — must pass.
Commit + push: `feat(K3-39): Eternal Data Reel complete — cross-feature integration, dream mode`

---

## TASK COUNT SUMMARY

| Wave | Hours | Tasks | Focus |
|------|-------|-------|-------|
| Wave 1 | 0–12 | K3-01 → K3-05 | Hindsight foundation |
| Wave 2 | 12–24 | K3-06 → K3-12 | Hindsight advanced (consolidation, bridges) |
| Wave 3 | 24–36 | K3-13 → K3-16 | RLM advanced (AgentLoop, ATLAS, CRDT) |
| Wave 4 | 36–48 | K3-17 → K3-24 | SAGA advanced (loops, sessions, overnight) |
| Wave 5 | 48–60 | K3-25 → K3-33 | Harness advanced (manager, tools, gates, plans) |
| Wave 6 | 60–72 | K3-34 → K3-39 | Cross-feature integration + Eternal Data Reel |
| **TOTAL** | **72h** | **39 tasks** | **4 modules completed + unified integration** |

---

## PRIORITY ORDER (If Running Behind)

If time runs short, prioritize in this order:
1. **Wave 1–2** (Hindsight) — only unstarted module, highest priority
2. **Wave 6** (Integration) — ties everything together
3. **Wave 3** (RLM advanced) — AgentLoop integration is critical
4. **Wave 4** (SAGA advanced) — inner/outer loops complete the system
5. **Wave 5** (Harness advanced) — harness already has 52 tests, least urgent

---

## CROSS-REFERENCES

These modules integrate with existing code:
- `src/agent-loop/agent-loop.ts` — RLM injects compression middleware
- `src/atlas/index.ts` — Hindsight ATLASBridge hooks into KronosAtlas
- `src/taste-vault/taste-vault.ts` — Hindsight TasteVaultBridge hooks into learn/reinforce
- `src/orchestrator/ralph-loop.ts` — Harness wraps long-running tasks
- `src/observability/` — All modules emit telemetry
- `src/collaboration/crdt-core.ts` — RLM compresses before CRDT broadcast
- `src/persistence/checkpoint-system.ts` — Harness fallback persistence
- `src/memory/` — Hindsight extends existing memory hierarchy

---

## DELIVERABLES AT 72H

By end of Sprint 3, Kimi will have delivered:
- **Hindsight Persistent Memory**: Complete module with engine, consolidation, formatters, bridges, namespaces (~15 files, ~20 PBTs)
- **RLM Advanced**: AgentLoop integration, ATLAS storage, CRDT collaboration (~3 new files, ~6 PBTs)
- **SAGA Advanced**: Inner/outer loops, sessions, autonomy, swarm debate, overnight, portfolio (~8 files updated, ~15 PBTs)
- **Harness Advanced**: Manager, serializer, persistence, tools, gates, plans, sub-agents, observability (~8 new files, ~15 PBTs)
- **Eternal Data Reel**: Unified export, cross-module wiring, dream mode (~4 new files)
- **Estimated total new tests**: ~56 property-based tests + unit tests

---

*Sprint 3 created by Kiro (Opus 4.6) — February 22, 2026*
