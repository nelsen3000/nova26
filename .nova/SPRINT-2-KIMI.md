# KIMI 2.5 — Sprint 2: "The Eternal Implementer"
## February 21–23, 2026 (48 Hours)

> **Provider**: Moonshot (swarm)
> **Sprint 1 Status**: COMPLETE (K1–K18 equivalent, all delivered — K1-K3 by Kimi, K4-K18 by Claude)
> **Sprint 2 Focus**: Eternal Data Reel features — Agent Harnesses + SAGA Self-Evolving Agents + Recursive Language Models + Hindsight Persistent Memory
> **Duration**: 48 hours (4 waves × 12 hours)
> **Project folder**: `/Users/jonathannelsen/nova26/kiro/nova26`
> **Spec files**: `.kiro/specs/agent-harnesses/`, `.kiro/specs/saga-self-evolving-agents/`, `.kiro/specs/recursive-language-models/`, `.kiro/specs/hindsight-persistent-memory/`
> **Cannot touch**: `convex/`, `app/`

---

## SPRINT 1 RECAP (All Complete)

K1–K3: Perplexity client, research agent, caching/cost control
K4–K7: Model routing (UCB router, speculative decoding, profiles, cost optimizer, multi-model swarm)
K8–K10: Eval framework (types, registry, scoring, runner, golden sets, persistence, reporting)
K11–K12: Infinite memory (store, retrieval, compression)
K13: AI Model Database (registry, capability matching)
K14–K15: Visual workflow engine (core, visualization, templates)
K16: CRDT collaboration (engine, sync protocol)
K17–K18: Observability bridge, end-to-end integration

---

## SPRINT 2 RULES

- TypeScript strict, ESM `.js` imports, vitest, no `any`, mock all I/O
- All new code in `src/` (not `app/` or `convex/`)
- Follow Kiro spec task lists exactly — each task references requirements
- Property-based tests use `fast-check` (already in dependencies)
- Run `tsc --noEmit` after each task — must be 0 errors
- Commit after each task: `feat(K2-XX): <description>`

---

## WAVE 1 (Hours 0–12): Agent Harnesses — Persistent Long-Running Tasks

> Spec: `.kiro/specs/agent-harnesses/tasks.md`
> Target: Tasks 1–8 (types, schemas, harness core, lifecycle, checkpointing, recovery)

### Task K2-01: Agent Harness Types + Schemas
Read `.kiro/specs/agent-harnesses/tasks.md` Task 1 (all sub-tasks).
Create `src/harness/types.ts` and `src/harness/schemas.ts`.
All interfaces: HarnessConfig, HarnessState, HarnessCheckpoint, HarnessMetrics, TaskHandle.
Zod schemas for all types. Property tests for serialization round trips.

### Task K2-02: Harness Core Engine
Read `.kiro/specs/agent-harnesses/tasks.md` Task 2 (all sub-tasks).
Create `src/harness/engine.ts` — HarnessEngine.
`start()`, `stop()`, `pause()`, `resume()`, `getStatus()`.
State machine: idle → starting → running → paused → stopping → stopped → failed.
Task queue with priority scheduling.
Property tests: state machine validity, task ordering.

### Task K2-03: Harness Checkpointing
Read `.kiro/specs/agent-harnesses/tasks.md` Task 3 (all sub-tasks).
Create `src/harness/checkpoint.ts` — CheckpointManager.
`save()`, `restore()`, `list()`, `prune()`.
Periodic auto-checkpointing with configurable interval.
Checkpoint serialization to JSON files.
Property tests: checkpoint round trip, restore-from-checkpoint correctness.

### Task K2-04: Harness Recovery + Retry
Read `.kiro/specs/agent-harnesses/tasks.md` Task 4 (all sub-tasks).
Create `src/harness/recovery.ts` — RecoveryManager.
Automatic restart from last checkpoint on failure.
Retry with exponential backoff (configurable max retries).
Dead letter queue for permanently failed tasks.
Property tests: recovery restores correct state, retry backoff timing.

### Task K2-05: Harness Resource Management
Read `.kiro/specs/agent-harnesses/tasks.md` Task 5 (all sub-tasks).
Create `src/harness/resources.ts` — ResourceManager.
CPU/memory/time budget per harness.
Graceful degradation on resource exhaustion.
Resource usage tracking and reporting.

### Task K2-06: Harness Communication
Read `.kiro/specs/agent-harnesses/tasks.md` Task 6 (all sub-tasks).
Create `src/harness/communication.ts`.
Inter-harness messaging via event emitter.
Parent-child harness relationships.
Progress reporting to orchestrator.

### Task K2-07: Harness Observability + Index
Read `.kiro/specs/agent-harnesses/tasks.md` Tasks 7–8.
Create `src/harness/observability.ts` — metrics, structured logs.
Create `src/harness/index.ts` — public API + `createHarness()` factory.
Wire into existing observability (`src/observability/`).

### Task K2-08: Wave 1 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run all harness tests — must pass.
Commit: `feat(K2-08): Agent Harnesses complete — engine, checkpointing, recovery, resources`

---

## WAVE 2 (Hours 12–24): SAGA Self-Evolving Agents

> Spec: `.kiro/specs/saga-self-evolving-agents/tasks.md`
> Target: Tasks 1–8 (types, schemas, goal system, evolution engine, fitness, adaptation)

### Task K2-09: SAGA Types + Schemas
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Task 1 (all sub-tasks).
Create `src/saga/types.ts` and `src/saga/schemas.ts`.
All interfaces: AgentGoal, EvolutionStrategy, FitnessScore, AdaptationRecord, GoalHierarchy.
Zod schemas. Property tests for serialization.

### Task K2-10: SAGA Goal System
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Task 2 (all sub-tasks).
Create `src/saga/goal-system.ts` — GoalManager.
`createGoal()`, `decomposeGoal()`, `evaluateProgress()`, `adjustGoal()`.
Hierarchical goal trees with parent-child relationships.
Goal priority scoring and conflict resolution.
Property tests: goal decomposition preserves intent, priority ordering.

### Task K2-11: SAGA Evolution Engine
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Task 3 (all sub-tasks).
Create `src/saga/evolution-engine.ts` — EvolutionEngine.
Bi-level optimization: inner loop (task execution), outer loop (strategy evolution).
Strategy mutation, crossover, selection.
Population management with elitism.
Property tests: fitness monotonically improves over generations, population size invariant.

### Task K2-12: SAGA Fitness Evaluation
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Task 4 (all sub-tasks).
Create `src/saga/fitness.ts` — FitnessEvaluator.
Multi-objective fitness: task success, efficiency, cost, quality.
Pareto frontier for multi-objective optimization.
Historical fitness tracking per agent.
Property tests: Pareto dominance transitivity, fitness normalization.

### Task K2-13: SAGA Adaptation + Learning
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Task 5 (all sub-tasks).
Create `src/saga/adaptation.ts` — AdaptationManager.
Prompt evolution (mutate system prompts based on performance).
Tool selection adaptation (learn which tools work for which tasks).
Model routing adaptation (feed back into UCB router from `src/llm/model-router.ts`).
Property tests: adaptation records are immutable, learning rate bounds.

### Task K2-14: SAGA Agent Profiles + Persistence
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Tasks 6–7.
Create `src/saga/profiles.ts` — evolved agent profiles.
Create `src/saga/persistence.ts` — JSON file storage for evolution state.
Snapshot/restore evolution state across sessions.

### Task K2-15: SAGA Observability + Index
Read `.kiro/specs/saga-self-evolving-agents/tasks.md` Task 8.
Create `src/saga/observability.ts` and `src/saga/index.ts`.
Evolution metrics, generation tracking, public API.

### Task K2-16: Wave 2 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run all SAGA tests — must pass.
Commit: `feat(K2-16): SAGA Self-Evolving Agents complete — goals, evolution, fitness, adaptation`

---

## WAVE 3 (Hours 24–36): Recursive Language Models

> Spec: `.kiro/specs/recursive-language-models/tasks.md`
> Target: Tasks 1–6 (types, schemas, reader model, context compression, recursive loop, caching)

### Task K2-17: RLM Types + Schemas
Read `.kiro/specs/recursive-language-models/tasks.md` Task 1 (all sub-tasks).
Create `src/rlm/types.ts` and `src/rlm/schemas.ts`.
All interfaces: CompressionResult, ReaderConfig, RecursionState, ContextWindow, CompressionMetrics.
Zod schemas. Property tests for serialization.

### Task K2-18: RLM Reader Model
Read `.kiro/specs/recursive-language-models/tasks.md` Task 2 (all sub-tasks).
Create `src/rlm/reader-model.ts` — ReaderModel.
`compress()` — takes long context, produces compressed representation.
`decompress()` — reconstructs key information from compressed form.
Configurable compression ratio (target token reduction).
Uses small/fast model (from `src/llm/model-router.ts`) for compression.
Property tests: compression preserves key information, decompression recovers salient facts.

### Task K2-19: RLM Context Window Manager
Read `.kiro/specs/recursive-language-models/tasks.md` Task 3 (all sub-tasks).
Create `src/rlm/context-manager.ts` — ContextWindowManager.
`fit()` — fits content into target token budget via recursive compression.
`prioritize()` — ranks context segments by relevance.
`evict()` — removes least relevant segments when window is full.
Sliding window with overlap for continuity.
Property tests: output always fits within token budget, priority ordering preserved.

### Task K2-20: RLM Recursive Compression Loop
Read `.kiro/specs/recursive-language-models/tasks.md` Task 4 (all sub-tasks).
Create `src/rlm/recursive-loop.ts` — RecursiveCompressor.
Multi-pass compression: compress → check fit → compress again if needed.
Convergence detection (stop when compression gain < threshold).
Max recursion depth to prevent infinite loops.
Property tests: convergence within max depth, monotonic size reduction per pass.

### Task K2-21: RLM Compression Cache
Read `.kiro/specs/recursive-language-models/tasks.md` Task 5 (all sub-tasks).
Create `src/rlm/cache.ts` — CompressionCache.
Cache compressed representations by content hash.
LRU eviction. TTL-based expiry.
Cache hit/miss metrics.

### Task K2-22: RLM Integration + Index
Read `.kiro/specs/recursive-language-models/tasks.md` Task 6.
Create `src/rlm/index.ts` — public API + `createRLM()` factory.
Wire into existing LLM pipeline (`src/llm/`).
Integration with memory system (`src/memory/`) for compressing memory retrievals.

### Task K2-23: Wave 3 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run all RLM tests — must pass.
Commit: `feat(K2-23): Recursive Language Models complete — reader, context manager, recursive loop, cache`

---

## WAVE 4 (Hours 36–48): Hindsight Persistent Memory

> Spec: `.kiro/specs/hindsight-persistent-memory/tasks.md`
> Target: Tasks 1–8 (types, schemas, cross-session store, retrieval, consolidation, agent integration)

### Task K2-24: Hindsight Types + Schemas
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` Task 1 (all sub-tasks).
Create `src/hindsight/types.ts` and `src/hindsight/schemas.ts`.
All interfaces: MemoryEntry, SessionContext, ConsolidationRecord, RetrievalQuery, HindsightConfig.
Zod schemas. Property tests for serialization.

### Task K2-25: Hindsight Cross-Session Store
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` Task 2 (all sub-tasks).
Create `src/hindsight/store.ts` — HindsightStore.
`record()` — stores memory entries with session context, timestamps, importance scores.
`query()` — retrieves memories across sessions by relevance.
`getSessionHistory()` — returns all memories from a specific session.
File-based persistence (JSON). Append-only for audit trail.
Property tests: cross-session retrieval, append-only invariant.

### Task K2-26: Hindsight Retrieval Engine
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` Task 3 (all sub-tasks).
Create `src/hindsight/retrieval.ts` — HindsightRetriever.
Multi-strategy retrieval: keyword, semantic, temporal, importance-weighted.
Cross-session relevance scoring (recency decay across sessions).
Context-aware retrieval (current task influences what's relevant).
Property tests: retrieval ranking stability, relevance monotonicity.

### Task K2-27: Hindsight Consolidation
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` Task 4 (all sub-tasks).
Create `src/hindsight/consolidation.ts` — ConsolidationEngine.
Periodic consolidation: merge similar memories, extract patterns, prune stale entries.
"Sleep-like" consolidation (runs between sessions).
Importance re-scoring based on access patterns.
Property tests: consolidation preserves high-importance memories, total information non-decreasing.

### Task K2-28: Hindsight Agent Integration
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` Task 5 (all sub-tasks).
Create `src/hindsight/agent-bridge.ts`.
Per-agent memory namespaces (each of 21 agents has own memory space).
Cross-agent memory sharing (opt-in, with access control).
Integration with existing memory system (`src/memory/`).
Integration with RLM (`src/rlm/`) for compressing old memories.

### Task K2-29: Hindsight Learning + Patterns
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` Task 6 (all sub-tasks).
Create `src/hindsight/patterns.ts` — PatternExtractor.
Detect recurring patterns across sessions (common errors, successful strategies).
Build agent "wisdom" — distilled lessons from past sessions.
Feed patterns into SAGA adaptation (`src/saga/adaptation.ts`).

### Task K2-30: Hindsight Observability + Index
Read `.kiro/specs/hindsight-persistent-memory/tasks.md` Tasks 7–8.
Create `src/hindsight/observability.ts` and `src/hindsight/index.ts`.
Memory metrics, consolidation stats, public API + `createHindsight()` factory.

### Task K2-31: Cross-Feature Integration
Wire all 4 new modules together:
- Agent Harnesses use Hindsight for checkpoint context
- SAGA uses Hindsight patterns for evolution fitness
- RLM compresses Hindsight memories for context windows
- All modules report to existing observability (`src/observability/`)
Create `src/eternal-reel/index.ts` — unified export for all Eternal Data Reel features.

### Task K2-32: Final Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests — must pass.
Commit: `feat(K2-32): Hindsight Persistent Memory + cross-feature integration complete`

---

## TASK COUNT SUMMARY

| Wave | Hours | Tasks | Focus |
|------|-------|-------|-------|
| Wave 1 | 0–12 | K2-01 → K2-08 | Agent Harnesses |
| Wave 2 | 12–24 | K2-09 → K2-16 | SAGA Self-Evolving Agents |
| Wave 3 | 24–36 | K2-17 → K2-23 | Recursive Language Models |
| Wave 4 | 36–48 | K2-24 → K2-32 | Hindsight Persistent Memory + Integration |
| **TOTAL** | **48h** | **32 tasks** | **4 Eternal Data Reel features** |

---

## CROSS-REFERENCES

These modules integrate with existing Sprint 1 code:
- `src/llm/model-router.ts` — RLM uses for compression model selection, SAGA feeds back routing data
- `src/memory/` — Hindsight extends existing memory hierarchy
- `src/observability/` — All modules emit telemetry
- `src/collaboration/crdt-engine.ts` — Harnesses can checkpoint CRDT state
- `src/workflow/engine.ts` — Harnesses wrap workflow executions

---

*Sprint 2 created by Kiro (Opus 4.6) — February 21, 2026*
