# SAGA Self-Evolving Goal Agents - TODO

## Spec Reference
- **Design Doc**: `.kiro/specs/saga-self-evolving-agents/design.md`
- **Tasks Doc**: `.kiro/specs/saga-self-evolving-agents/tasks.md`
- **Goal Genome Format**: `.kiro/specs/saga-self-evolving-agents/goal-genome-format.md`

---

## Wave 1: Core Types & Specs (K3-01 to K3-04) ✅ COMPLETE
**Status**: 4/4 tasks complete | **Tests**: 8 property-based tests

| Task | Status | File | Description |
|------|--------|------|-------------|
| K3-01 | ✅ | `types.ts` | Core types: GoalGenome, FitnessScore, ObjectiveDescriptor, etc. |
| K3-02 | ✅ | `schemas.ts` | Zod schemas with validation for all types |
| K3-03 | ✅ | `types.test.ts` | 8 property tests for type invariants |
| K3-04 | ✅ | `goal-genome.md` | Markdown spec documenting format |

**Key Features**:
- `GoalGenome` with mutation lineage tracking
- `ObjectiveDescriptor` with extensible parameters
- `FitnessScore` with multi-component scoring
- `GoalMutation` with operation history
- Property-based tests (fast-check)

---

## Wave 2: Mutation & Fitness (K3-05 to K3-09) ✅ COMPLETE
**Status**: 5/5 tasks complete | **Tests**: 35 property-based tests

| Task | Status | File | Description |
|------|--------|------|-------------|
| K3-05 | ✅ | `goal-genome.ts` | Serialize/deserialize, mutation operators (add/remove/perturb/recombine) |
| K3-06 | ✅ | `goal-genome.test.ts` | 11 property tests for mutation invariants |
| K3-07 | ✅ | `fitness-evaluator.ts` | Multi-objective fitness with performance/novelty/taste |
| K3-08 | ✅ | `fitness-evaluator.test.ts` | 12 property tests for fitness properties |
| K3-09 | ✅ | `taste-guard.ts` | Pattern matching guard for architectural taste |
| K3-09a | ✅ | `taste-guard.test.ts` | 12 property tests for taste guard |

**Key Features**:
- Genome mutation with parent-child lineage
- Tournament selection for next generation
- Taste pattern matching with confidence scoring
- Fitness normalization and statistics

---

## Wave 3: Curriculum & Evolution (K3-10 to K3-12) ✅ COMPLETE
**Status**: 3/3 tasks complete | **Tests**: 10 property-based tests

| Task | Status | File | Description |
|------|--------|------|-------------|
| K3-10 | ✅ | `curriculum-generator.ts` | Task generation from objectives with progression |
| K3-11 | ✅ | `curriculum-generator.test.ts` | 5 property tests for curriculum properties |
| K3-12 | ✅ | `atlas-goal-store.ts` | ATLAS persistence for genomes with portfolio queries |
| K3-12a | ✅ | `atlas-goal-store.test.ts` | 5 property tests for store operations |

**Key Features**:
- Curriculum generation with 3 difficulty levels per objective
- ATLAS integration for genome persistence
- Portfolio seed queries for cross-project learning
- Genome pruning based on age

---

## Wave 4: SAGA Advanced (K3-13 to K3-24) ✅ COMPLETE
**Status**: 12/12 tasks complete | **Tests**: 36 property-based tests

| Task | Status | File | Description |
|------|--------|------|-------------|
| K3-13 | ✅ | `inner-loop.ts` | Micro-cycle: task execution → remedial → curriculum |
| K3-14 | ✅ | `inner-loop.test.ts` | 6 property tests for inner loop |
| K3-15 | ✅ | `outer-loop.ts` | Macro-cycle: fitness eval → selection → mutation → debate |
| K3-16 | ✅ | `outer-loop.test.ts` | 6 property tests for outer loop |
| K3-17 | ✅ | `session-manager.ts` | Session lifecycle with budget tracking |
| K3-18 | ✅ | `session-manager.test.ts` | 6 property tests for sessions |
| K3-19 | ✅ | `autonomy-gating.ts` | Pause after each generation with deviation check |
| K3-20 | ✅ | `autonomy-gating.test.ts` | 6 property tests for autonomy gating |
| K3-21 | ✅ | `swarm-debate.ts` | Optional swarm debate for fitness > threshold |
| K3-22 | ✅ | `swarm-debate.test.ts` | 6 property tests for swarm debate |
| K3-23 | ✅ | `overnight-evolution.ts` | Time-batched evolution (8hr mode) |
| K3-24 | ✅ | `portfolio-learning.ts` | Cross-project seeding + learning log |

**Key Features**:
- Inner loop with remedial task generation
- Outer loop with full evolutionary cycle
- Session management with budget enforcement
- Autonomy gating for human-in-the-loop
- Swarm debate with consensus scoring
- Overnight evolution mode for 8-hour runs
- Cross-project portfolio learning

---

## Wave 5: SAGA Engine Integration (K3-25 to K3-28) ✅ COMPLETE
**Status**: 4/4 tasks complete | **Tests**: 7 tests

| Task | Status | File | Description |
|------|--------|------|-------------|
| K3-25 | ✅ | `saga-engine.ts` | Unified engine: loop orchestration + ATLAS persistence |
| K3-26 | ✅ | `saga-engine.test.ts` | 7 tests for engine functionality |
| K3-27 | ✅ | `index.ts` | Complete module exports |
| K3-28 | ✅ | - | README documentation |

**Key Features**:
- Unified SAGAEngine API
- Autonomy level 0-4 support
- Integration with Inner/Outer loops
- ATLAS persistence integration
- Complete TypeScript exports
- `createMockExecutor` for testing

---

## Summary

| Wave | Tasks | Status | Tests |
|------|-------|--------|-------|
| 1: Core Types | 4 | ✅ Complete | 8 |
| 2: Mutation & Fitness | 5 | ✅ Complete | 35 |
| 3: Curriculum & Evolution | 3 | ✅ Complete | 10 |
| 4: SAGA Advanced | 12 | ✅ Complete | 36 |
| 5: SAGA Engine | 4 | ✅ Complete | 5 |
| **Total** | **28** | **✅ 100%** | **96** |

---

## Module Structure

```
src/saga/
├── types.ts                    # Core type definitions
├── schemas.ts                  # Zod schemas with validation
├── goal-genome.ts              # Serialization & mutation
├── fitness-evaluator.ts        # Multi-objective fitness
├── taste-guard.ts              # Pattern matching guard
├── curriculum-generator.ts     # Task generation
├── atlas-goal-store.ts         # ATLAS persistence
├── inner-loop.ts               # Micro-cycle execution
├── outer-loop.ts               # Macro-cycle evolution
├── session-manager.ts          # Session lifecycle
├── autonomy-gating.ts          # Pause & approval logic
├── swarm-debate.ts             # Swarm consensus
├── overnight-evolution.ts      # Time-batched evolution
├── portfolio-learning.ts       # Cross-project learning
├── saga-engine.ts              # Unified engine
├── index.ts                    # Module exports
├── *.test.ts                   # Property-based tests
└── goal-genome.md              # Format specification
```

---

*Last Updated: 2026-02-21*
