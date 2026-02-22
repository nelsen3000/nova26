# Implementation Plan: SAGA Self-Evolving Goal Agents

## Overview

Implement the SAGA bi-level evolutionary framework as a TypeScript module under `src/saga/`, with Convex backend tables for persistence. Build incrementally: core data types → mutations → fitness evaluation → Taste Guard → curriculum → session management → ATLAS integration → swarm debate → overnight/portfolio features.

## Tasks

- [x] 1. Set up project structure and core types
  - [x] 1.1 Create `src/saga/` directory and define core TypeScript interfaces
    - Create `src/saga/types.ts` with GoalGenome, ObjectiveDescriptor, FitnessCriterion, GoalMutation, FitnessScore, InnerLoopResult, Curriculum, CurriculumTask, CurriculumTaskResult, EvolutionConfig, EvolutionSession, EvolutionSessionInfo, EvolutionSessionSummary, SessionMetrics, BudgetStatus, TastePattern, TasteCheckResult, TasteConflict interfaces
    - _Requirements: 1.1, 7.2_

  - [x] 1.2 Add Convex schema extensions for SAGA tables
    - Add `goalGenomes` and `evolutionSessions` tables to `convex/schema.ts` with all fields and indexes as specified in the design
    - _Requirements: 8.1, 8.3_

  - [x] 1.3 Implement GoalGenome serialization and deserialization
    - Create `src/saga/goal-genome.ts` with `serializeGenome(genome: GoalGenome): string` and `deserializeGenome(json: string): GoalGenome` functions
    - Include schemaVersion validation — reject unknown versions with descriptive error
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x]* 1.4 Write property test for GoalGenome serialization round-trip
    - **Property 1: Goal Genome serialization round-trip**
    - Generate arbitrary GoalGenome objects with fast-check, serialize to JSON, deserialize, assert equivalence
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5**

- [x] 2. Implement Goal Mutation operations
  - [x] 2.1 Create `src/saga/goal-mutator.ts` with all mutation operations
    - Implement `addObjective`, `removeObjective`, `perturbObjective`, `recombine`, and generic `mutate` functions
    - Each mutation increments generation, sets parentId, validates at least 1 objective and no duplicate IDs
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x]* 2.2 Write property test for add objective mutation
    - **Property 6: Add objective mutation**
    - **Validates: Requirements 4.1**

  - [x]* 2.3 Write property test for remove objective mutation
    - **Property 7: Remove objective mutation**
    - **Validates: Requirements 4.2**

  - [x]* 2.4 Write property test for perturb objective mutation
    - **Property 8: Perturb objective mutation**
    - **Validates: Requirements 4.3**

  - [x]* 2.5 Write property test for recombine mutation
    - **Property 9: Recombine mutation**
    - **Validates: Requirements 4.4**

  - [x]* 2.6 Write property test for mutation invariants
    - **Property 10: Mutation invariants**
    - For all mutation types, verify generation increment, parentId, at least 1 objective, no duplicate IDs
    - **Validates: Requirements 4.5, 4.6**

- [x] 3. Implement Fitness Evaluator and Tournament Selection
  - [x] 3.1 Create `src/saga/fitness-evaluator.ts`
    - Implement `evaluate` function that computes performanceScore, noveltyScore, tasteAlignmentScore, and aggregateScore
    - Implement `tournamentSelect` function for population selection with configurable size
    - _Requirements: 3.2, 3.3_

  - [x]* 3.2 Write property test for fitness summary completeness
    - **Property 2: Inner Loop fitness summary completeness**
    - **Validates: Requirements 2.2, 2.3**

  - [x]* 3.3 Write property test for tournament selection
    - **Property 4: Tournament selection preserves population size**
    - **Validates: Requirements 3.3**

- [x] 4. Checkpoint — Ensure all tests pass
  - ✅ All tests pass

- [x] 5. Implement Taste Guard
  - [x] 5.1 Create `src/saga/taste-guard.ts`
    - Implement `check` function that evaluates each objective against Taste Vault patterns
    - Implement `filterCandidates` that rejects genomes conflicting with patterns having successScore > 0.5 and passes neutral/aligned genomes
    - Read patterns from Convex `globalPatterns` table via the existing wisdom query
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x]* 5.2 Write property test for Taste Guard filtering
    - **Property 11: Taste Guard filtering**
    - **Validates: Requirements 5.1, 5.2, 5.4**

  - [x]* 5.3 Write property test for Taste-rejected candidates excluded from selection
    - **Property 12: Taste-rejected candidates excluded from selection**
    - **Validates: Requirements 5.3**

- [x] 6. Implement Curriculum Generator
  - [x] 6.1 Create `src/saga/curriculum-generator.ts`
    - Implement `generate` function that produces a Curriculum from GoalGenome objectives
    - Tasks ordered by increasing difficulty with predecessor dependencies forming a valid topological order
    - Implement remedial task generation on failure
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x]* 6.2 Write property test for curriculum topological ordering
    - **Property 13: Curriculum topological ordering**
    - **Validates: Requirements 6.1, 6.2**

  - [x]* 6.3 Write property test for curriculum task result recording
    - **Property 14: Curriculum task result recording**
    - **Validates: Requirements 6.3**

- [x] 7. Implement Inner Loop
  - [x] 7.1 Create `src/saga/inner-loop.ts`
    - Implement the Inner Loop cycle: load GoalGenome → generate Curriculum → execute tasks via Agent Harness → collect metrics → produce fitness summary
    - Handle iteration budget exceeded with partial fitness summary
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 8. Implement Outer Loop
  - [x] 8.1 Create `src/saga/outer-loop.ts`
    - Implement the Outer Loop cycle: generate candidates via GoalMutator → filter via TasteGuard → run Inner Loop → evaluate fitness → optional Swarm Debate → tournament selection → persist to ATLAS
    - Handle low-fitness generation retention with increased mutation diversity
    - Track lineage for all genomes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x]* 8.2 Write property test for lineage graph reachability
    - **Property 5: Lineage graph reachability**
    - **Validates: Requirements 3.6**

  - [x]* 8.3 Write property test for candidate generation from population
    - **Property 3: Outer Loop candidate generation from population**
    - **Validates: Requirements 3.1**

- [x] 9. Checkpoint — Ensure all tests pass
  - ✅ All tests pass

- [x] 10. Implement ATLAS Goal Store
  - [x] 10.1 Create `convex/saga.ts` with Convex mutations and queries
    - Implement `persistGenome`, `persistGeneration`, `getLatestPopulation`, `getGenomesByFitness`, `getGenomeByGeneration`, `getGenomeLineage`, `getPortfolioSeeds`, `pruneOldGenomes`, `persistSessionState`, `restoreSessionState`
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

  - [x] 10.2 Create `src/saga/atlas-goal-store.ts` as the TypeScript client wrapper
    - Wrap Convex mutations/queries with the ATLASGoalStore interface
    - Implement notable fitness logging to the existing ATLAS `learnings` table
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x]* 10.3 Write property test for ATLAS Goal Store persistence completeness
    - **Property 17: ATLAS Goal Store persistence completeness**
    - **Validates: Requirements 8.1, 8.3**

  - [x]* 10.4 Write property test for ATLAS Goal Store retention pruning
    - **Property 18: ATLAS Goal Store retention pruning**
    - **Validates: Requirements 8.5**

  - [x]* 10.5 Write property test for notable fitness logging
    - **Property 19: Notable fitness logging**
    - **Validates: Requirements 8.4**

- [x] 11. Implement Session Manager
  - [x] 11.1 Create `src/saga/session-manager.ts`
    - Implement `create`, `pause`, `resume`, `stop`, `checkBudget`, `checkpoint` functions
    - Session creation with unique ID, agent name, budget, "running" status
    - Budget checking before each Outer Loop iteration
    - Pause persists state, resume restores state
    - _Requirements: 7.1, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x]* 11.2 Write property test for budget enforcement
    - **Property 15: Evolution Session budget enforcement**
    - **Validates: Requirements 7.3, 7.7**

  - [x]* 11.3 Write property test for pause/resume round-trip
    - **Property 16: Evolution Session pause/resume round-trip**
    - **Validates: Requirements 7.4, 7.5**

  - [x]* 11.4 Write property test for population size invariant
    - **Property 27: Population size invariant**
    - **Validates: Requirements 12.4**

- [x] 12. Checkpoint — Ensure all tests pass
  - ✅ All tests pass

- [x] 13. Implement Autonomy Gating and Swarm Debate
  - [x] 13.1 Create `src/saga/autonomy-gating.ts`
    - Implement autonomy-level logic: levels 1-2 pause after every generation, level 3 pause on significant deviation, levels 4-5 no gates
    - Control Swarm Debate enablement based on autonomy level (≥ 3)
    - _Requirements: 9.1, 9.5, 10.3, 10.4, 10.5_

  - [x] 13.2 Create `src/saga/swarm-debate.ts`
    - Implement Swarm Debate: submit top candidates to participating agents, collect scores and critiques, incorporate into fitness ranking
    - Handle consensus rejection (unanimous rejection excludes candidate)
    - Handle timeout and insufficient participants gracefully
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x]* 13.3 Write property test for autonomy-level evolution gating
    - **Property 20: Autonomy-level evolution gating**
    - **Validates: Requirements 9.1, 9.5, 10.3, 10.4, 10.5**

  - [x]* 13.4 Write property test for Swarm Debate score incorporation
    - **Property 21: Swarm Debate score incorporation**
    - **Validates: Requirements 9.2, 9.3**

  - [x]* 13.5 Write property test for Swarm Debate consensus rejection
    - **Property 22: Swarm Debate consensus rejection**
    - **Validates: Requirements 9.4**

- [x] 14. Implement Overnight Evolution and Portfolio Learning
  - [x] 14.1 Create `src/saga/overnight-evolution.ts`
    - Implement overnight mode: start session with time budget matching overnight window, auto-checkpoint at configurable intervals
    - Produce summary report on completion with starting/ending fitness, generations evolved, notable discoveries
    - _Requirements: 10.1, 10.2, 10.6_

  - [x] 14.2 Create `src/saga/portfolio-learning.ts`
    - Implement portfolio seeding: query ATLAS for high-fitness genomes from other projects, limit to configured percentage of population
    - Re-evaluate imported genomes against current objectives
    - Log cross-project learning entries when portfolio seeds achieve top fitness
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x]* 14.3 Write property test for auto-checkpoint frequency
    - **Property 23: Auto-checkpoint frequency**
    - **Validates: Requirements 10.2**

  - [x]* 14.4 Write property test for overnight evolution summary completeness
    - **Property 24: Overnight evolution summary completeness**
    - **Validates: Requirements 10.6**

  - [x]* 14.5 Write property test for portfolio seed population limit
    - **Property 25: Portfolio seed population limit**
    - **Validates: Requirements 11.3**

  - [x]* 14.6 Write property test for cross-project learning logging
    - **Property 26: Cross-project learning logging**
    - **Validates: Requirements 11.4**

- [x] 15. Wire SAGA Engine top-level coordinator
  - [x] 15.1 Create `src/saga/saga-engine.ts`
    - Implement the SAGAEngine interface: `startSession`, `pauseSession`, `resumeSession`, `stopSession`, `getSession`, `listSessions`
    - Wire together SessionManager, OuterLoop, InnerLoop, GoalMutator, FitnessEvaluator, TasteGuard, CurriculumGenerator, ATLASGoalStore, AutonomyGating, SwarmDebate
    - Ensure async non-blocking execution of Outer Loop iterations
    - _Requirements: 7.1, 12.2_

  - [x] 15.2 Create `src/saga/index.ts` barrel export
    - Export all public interfaces and the SAGAEngine factory function
    - _Requirements: all_

- [x] 16. Final checkpoint — Ensure all tests pass
  - ✅ All 16 tasks complete
  - ✅ TypeScript compiles with 0 errors
  - ✅ All tests pass

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- All code is TypeScript, persisted via Convex, tested with vitest
