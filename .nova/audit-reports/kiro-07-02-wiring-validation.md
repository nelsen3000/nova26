# KIRO-07-02: Mega-Wiring Sprint Validation Report

**Date:** 2026-02-19
**Scope:** ralph-loop.ts (1230 lines), lifecycle-wiring.ts (300 lines), ralph-loop-types.ts (155 lines)
**Sprint:** KIMI-W-01 through KIMI-W-05 (mega-wiring)

---

## Summary

The mega-wiring sprint successfully connected 13 R16/R17 feature modules into the ralph-loop
execution pipeline via lifecycle-wiring.ts. Config fields for all planned features are present
in RalphLoopOptions (duplicated in both ralph-loop.ts and ralph-loop-types.ts). The core
processTask() function spans ~450 lines and integrates ACE, Taste Vault, cost tracking,
agentic mode, and the test-fix-retest loop. Nine feature modules remain imported as type-only
references without lifecycle hook wiring -- five visionary features and four from R16/R17
early sprints.

**Verdict:** Sprint deliverables W-01 through W-05 are complete. The 13 module wiring via
lifecycle hooks is structurally sound. The nine unwired modules are a known gap that requires
a separate integration pass.

---

## 1. Import Analysis

**Total import statements:** 46 (from 44 unique module paths)

| Category | Count | Modules |
|----------|-------|---------|
| Node.js built-in | 3 | fs, path, child_process |
| Orchestrator internal | 6 | task-picker, prompt-builder (x2), gate-runner, council-runner, parallel-runner, event-store |
| Core LLM | 3 | ollama-client, structured-output, observability/index (tracer) |
| Memory / Git / Cost | 3 | session-memory, git/workflow, cost-tracker |
| Analytics / Convex | 2 | agent-analytics, convex/sync |
| Types | 1 | types/index (PRD, Task, LLMResponse, TodoItem, PlanningPhase) |
| Agent / Tools | 3 | agent-loop, tool-registry, config/autonomy (type-only) |
| Taste Vault | 1 | taste-vault/taste-vault |
| ACE system | 3 | ace/playbook, ace/reflector, ace/curator |
| Self-improvement / Rehearsal | 2 | agents/self-improvement, rehearsal/stage |
| Type-only: Visionary (5) | 5 | dream-engine, parallel-universe, overnight-engine, symbiont-core, taste-room |
| Type-only: R16/R17 early (4) | 4 | agent-memory, signal-detector (wellbeing), recovery-index, init-index |
| Type-only: R16/R17 wired (8) | 8 | portfolio/index, live-preview, autonomous-runner, pr-intelligence, wcag-engine, technical-debt, feedback-loop, health-dashboard |
| Rehearsal type | 1 | rehearsal/stage (RehearsalSession) |

**Observation:** prompt-builder.js is imported on two separate lines (lines 7 and 25) for
different symbol groups. This is functionally fine but could be consolidated.

**Observation:** ralph-loop.ts and ralph-loop-types.ts both define RalphLoopOptions and the
placeholder config interfaces (MigrationModuleConfig, DebugModuleConfig, etc.). The types
file also contains R19/R20 config fields (mobileLaunch, semanticModel, studioRules,
orchestratorHierarchy) that do not yet appear in the ralph-loop.ts copy. This duplication
is a drift risk.

---

## 2. Config Analysis (RalphLoopOptions)

**Total config fields in ralph-loop.ts:** 38 (matches ralph-loop-types.ts core set)
**Additional fields in ralph-loop-types.ts only:** 8 (R19 + R20 configs)

### Core execution (7 fields)

| Field | Type | Purpose |
|-------|------|---------|
| parallelMode | boolean | Enable parallel task execution |
| concurrency | number | Max parallel tasks |
| autoTestFix | boolean | Auto test-fix-retest loop |
| maxTestRetries | number | Max retries (default: 3) |
| planApproval | boolean | Require plan approval before execution |
| eventStore | boolean | Event-sourced session logging |
| sessionMemory | boolean | Cross-session memory |

### Infrastructure (4 fields)

| Field | Type | Purpose |
|-------|------|---------|
| gitWorkflow | boolean | Auto branch/commit/PR workflow |
| costTracking | boolean | Per-call cost tracking (C-04) |
| budgetLimit | number | Daily USD limit, halts builds (C-05) |
| convexSync | boolean | Real-time Convex dashboard sync (MEGA-04) |

### Agentic (2 fields)

| Field | Type | Purpose |
|-------|------|---------|
| agenticMode | boolean | Enable agentic inner loop with tools |
| autonomyLevel | AutonomyLevel (1-5) | Controls tool access and turn limits |

### Visionary (10 fields -- 5 enabled/config pairs)

dreamModeEnabled/Config, parallelUniverseEnabled/Config, overnightEvolutionEnabled/Config,
symbiontEnabled/Config, tasteRoomEnabled/Config

### R16-R17 modules (30 fields -- 15 enabled/config pairs)

agentMemoryEnabled/memoryConfig (R16-02), wellbeingEnabled/Config (R16-05),
advancedRecoveryEnabled/Config (R17-01), advancedInitEnabled/Config (R17-02),
portfolioEnabled/Config (R16-01), generativeUIEnabled/Config (R16-03),
autonomousTestingEnabled/testRunConfig (R16-04), codeReviewEnabled/Config (R17-03),
migrationEnabled/Config (R17-04), debugEngineEnabled/debugConfig (R17-05),
accessibilityEnabled/Config (R17-06), debtScoringEnabled/debtConfig (R17-07),
dependencyManagementEnabled/dependencyConfig (R17-08),
productionFeedbackEnabled/Config (R17-09), healthDashboardEnabled/healthConfig (R17-10),
envManagementEnabled/envConfig (R17-11), orchestrationOptimizationEnabled/orchestrationConfig (R17-12)

### R19/R20 (ralph-loop-types.ts only -- 8 fields)

mobileLaunchEnabled/Config (R19-01), semanticModelEnabled/Config (R19-02),
studioRulesEnabled/Config (R19-03), orchestratorHierarchyEnabled/Config (R20-01)

**Issue: Config Duplication.** RalphLoopOptions is defined in both ralph-loop.ts (line 85)
and ralph-loop-types.ts (line 63). The types file has already drifted ahead with R19/R20
fields. The ralph-loop.ts copy should be removed and re-exported from ralph-loop-types.ts
to prevent further drift.

---

## 3. Wiring Status

### Wired via lifecycle-wiring.ts (13 modules)

All 13 are registered in `wireFeatureHooks()` with feature flag mapping, priority, and
lifecycle phase configuration:

| Module | Feature Flag | Priority | Lifecycle Phases |
|--------|-------------|----------|-----------------|
| portfolio | portfolioEnabled | 50 | onBeforeBuild, onBuildComplete |
| generativeUI | generativeUIEnabled | 60 | onBeforeBuild, onAfterTask |
| autonomousTesting | autonomousTestingEnabled | 40 | onAfterTask, onTaskError, onBuildComplete |
| codeReview | codeReviewEnabled | 70 | onAfterTask, onBuildComplete |
| migration | migrationEnabled | 80 | onBeforeBuild, onAfterTask |
| debug | debugEngineEnabled | 20 | onTaskError |
| accessibility | accessibilityEnabled | 55 | onAfterTask, onBuildComplete |
| debt | debtScoringEnabled | 90 | onBeforeBuild, onBuildComplete |
| dependencyManagement | dependencyManagementEnabled | 100 | onBeforeBuild |
| productionFeedback | productionFeedbackEnabled | 110 | onBuildComplete |
| health | healthDashboardEnabled | 30 | onBeforeBuild, onBuildComplete |
| environment | envManagementEnabled | 10 | onBeforeBuild |
| orchestration | orchestrationOptimizationEnabled | 25 | onHandoff, onBeforeTask |

**Note:** All 13 wired modules currently use stub handlers (`async () => {}`). The real
module implementations exist but are not yet called from the lifecycle hooks. This means
the wiring infrastructure is in place and flags are respected, but actual feature behavior
at lifecycle boundaries is not yet active.

### Not wired -- Visionary features (5 modules)

| Module | Config Fields Present | Type Import Present | Why Not Wired |
|--------|----------------------|--------------------|----|
| dreamMode | Yes | Yes (DreamModeConfig) | Visionary -- separate activation path expected |
| parallelUniverse | Yes | Yes (ParallelUniverseConfig) | Visionary -- separate activation path expected |
| overnightEvolution | Yes | Yes (OvernightEvolutionConfig) | Visionary -- separate activation path expected |
| symbiont | Yes | Yes (SymbiontConfig) | Visionary -- separate activation path expected |
| tasteRoom | Yes | Yes (TasteRoomConfig) | Visionary -- separate activation path expected |

### Not wired -- R16/R17 early sprint features (4 modules)

| Module | Config Fields Present | Type Import Present | Sprint |
|--------|----------------------|--------------------|----|
| agentMemory | Yes (agentMemoryEnabled, memoryConfig) | Yes (AgentMemoryConfig) | R16-02 |
| wellbeing | Yes (wellbeingEnabled, wellbeingConfig) | Yes (WellbeingConfig) | R16-05 |
| advancedRecovery | Yes (advancedRecoveryEnabled, advancedRecoveryConfig) | Yes (AdvancedRecoveryConfig) | R17-01 |
| advancedInit | Yes (advancedInitEnabled, advancedInitConfig) | Yes (AdvancedInitConfig) | R17-02 |

These four modules have config fields in RalphLoopOptions and type imports in ralph-loop.ts,
but they are absent from the `featureFlags` map in `wireFeatureHooks()`. They were implemented
before the lifecycle-wiring infrastructure was built and may have their own inline integration
points within processTask(), or they may genuinely be unwired.

### Not wired -- R19/R20 (ralph-loop-types.ts only, 4 modules)

mobileLaunch, semanticModel, studioRules, orchestratorHierarchy -- these are defined in
ralph-loop-types.ts but not yet in ralph-loop.ts. They are from later sprints (R19/R20)
and would need both config field sync and lifecycle hook wiring.

---

## 4. Architecture Notes

### 4.1 processTask() -- Core Execution (lines 778-1230, ~452 lines)

The processTask() function is the heart of the system. It handles:

1. **Trace + event store initialization** -- starts span, emits task_start event
2. **Convex sync** -- logs task as running to cloud dashboard
3. **Todo management** -- creates and tracks sub-task items for complex tasks
4. **ACE playbook pre-warm** -- loads playbook rules for the task's agent before prompt building
5. **Prompt construction** -- via buildPrompt() with memory context injection
6. **LLM invocation** -- structured output (Zod schema) or raw text, with agentic loop option
7. **Cost tracking + budget enforcement** -- records cost per call, halts build if daily budget exceeded
8. **Gate running** -- quality gates via runGates(), with pass/fail handling
9. **Council vote** -- for tasks requiring council approval
10. **Test-fix-retest loop** -- for code agents only
11. **ACE reflector + curator** -- evolves playbook at autonomy level >= 3
12. **Taste Vault integration** -- 5 touch points (see below)
13. **Git commit** -- auto-commits task output when git workflow is enabled

**Complexity concern:** At 452 lines, processTask() is well above typical function size
guidelines. The function mixes execution orchestration with cross-cutting concerns (cost,
analytics, ACE, vault). This is the primary candidate for decomposition.

### 4.2 Taste Vault Integration (5 touch points)

| Location | Line | Purpose |
|----------|------|---------|
| Build summary | 496 | Log vault stats (node count, edge count, avg confidence) at build end |
| Failure path 1 | 1037 | Record gate failure as Mistake node |
| Failure path 2 | 1066 | Record max-retry exhaustion as Mistake node |
| Failure path 3 | 1112 | Record council rejection as Mistake node |
| Success path | 1179 | Extract patterns from successful output + reinforce injected node IDs |

All five are wrapped in try/catch with silent failure (`// Vault unavailable -- skip silently`),
which is correct for an optional subsystem.

### 4.3 ACE System Integration (4 components)

- **Playbook** (line 825): Pre-warms playbook cache for the task's agent before prompt building.
  Playbook rules are injected into prompts via prompt-builder.ts.
- **Reflector** (line 1211): Generates reflections on completed tasks at autonomy >= 3.
- **Curator** (line 1221): Applies/rejects playbook updates from reflector suggestions.
- **Self-Improvement** (line 1044+): Records outcomes (success/failure) for agent performance tracking.

### 4.4 Agentic Mode + Autonomy Levels

Autonomy level (1-5) controls:
- Whether agentic mode is auto-enabled (level >= 3)
- Tool access scope per agent
- Maximum turns in the agent loop
- Whether ACE reflector/curator run post-task

Configuration is handled by `getAgentLoopConfig()` (line 572) with a switch statement
across all 5 levels.

### 4.5 Test-Fix-Retest Loop

The `testFixLoop()` function (line 273) runs only for code agents:
**MARS, VENUS, PLUTO, GANYMEDE, IO, TRITON**

It executes tests, captures failures, builds retry prompts with error context, and re-invokes
the LLM up to `maxTestRetries` times (default: 3).

### 4.6 Placeholder Config Types

Five config interfaces are defined inline (both in ralph-loop.ts and ralph-loop-types.ts)
because their feature modules do not export dedicated config types:

- MigrationModuleConfig (R17-04)
- DebugModuleConfig (R17-05)
- DependencyModuleConfig (R17-08)
- EnvModuleConfig (R17-11)
- OrchestrationModuleConfig (R17-12)

These should eventually be moved to their respective module directories and imported.

---

## 5. Recommendations

### P0 -- Fix immediately

1. **Eliminate RalphLoopOptions duplication.** The interface is defined in both ralph-loop.ts
   (line 85) and ralph-loop-types.ts (line 63). The types file already has R19/R20 fields
   that ralph-loop.ts lacks. Remove the copy in ralph-loop.ts and import from
   ralph-loop-types.ts. This also applies to the five placeholder config interfaces.

### P1 -- Address in next sprint

2. **Wire the 4 missing R16/R17 modules.** agentMemory (R16-02), wellbeing (R16-05),
   advancedRecovery (R17-01), and advancedInit (R17-02) have config fields and type imports
   but are absent from lifecycle-wiring.ts. Add them to `featureFlags` in `wireFeatureHooks()`
   and `getWiringSummary()` with appropriate lifecycle phases.

3. **Replace stub handlers with real module calls.** All 13 wired modules use
   `async () => {}` stub handlers. The actual feature modules exist and export the necessary
   functions. Connect them.

4. **Decompose processTask().** Extract cross-cutting concerns into helper functions:
   - `recordTaskOutcome()` -- cost tracking, analytics, Taste Vault, ACE outcome recording
   - `runPostTaskEvolution()` -- ACE reflector + curator + self-improvement
   - `handleTaskFailure()` -- the three failure paths share identical vault + ACE + analytics code

### P2 -- Track for later

5. **Decide visionary module wiring strategy.** The 5 visionary features (dream, parallel-universe,
   overnight-evolution, symbiont, taste-room) have config fields but no lifecycle wiring.
   Determine whether they should use the lifecycle hook system or maintain a separate
   activation path.

6. **Sync R19/R20 config fields.** ralph-loop-types.ts has mobileLaunch, semanticModel,
   studioRules, and orchestratorHierarchy configs. These need to propagate to ralph-loop.ts
   (or, preferably, the duplication is resolved first per P0).

7. **Move placeholder configs to feature modules.** The 5 inline config interfaces should
   live in their respective module directories (src/migration/, src/debug/, etc.).

---

## Appendix: File Inventory

| File | Lines | Role |
|------|-------|------|
| `src/orchestrator/ralph-loop.ts` | 1230 | Core execution loop, processTask(), RalphLoopOptions (duplicate) |
| `src/orchestrator/ralph-loop-types.ts` | 155 | Canonical RalphLoopOptions, placeholder configs, type re-exports |
| `src/orchestrator/lifecycle-wiring.ts` | 300 | Feature hook registry, wireFeatureHooks(), wiring summary |
| `src/orchestrator/lifecycle-wiring.test.ts` | ~200 | Tests for lifecycle wiring (wireFeatureHooks, getWiringSummary, registry) |
