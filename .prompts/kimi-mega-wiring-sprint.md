# KIMI MEGA-SPRINT: Ralph-Loop Wiring, Lifecycle Hooks & Hardening

> Assigned to: Kimi
> Sprint: Mega Wiring + Lifecycle Hooks + Hardening
> Date issued: 2026-02-19
> Prerequisite: 2,642 tests passing, 0 TS errors
> Estimated time: 60–90 minutes
> CRITICAL: Task 1 is mandatory. The project cannot move forward without it.

---

## Mission

Nova26 has 17 feature modules (R16-01 through R17-12). Only 4 are wired into the orchestrator.
The other 13 are dead code — implemented, tested, but never invoked. This sprint:

1. **Wires all 13 modules into ralph-loop.ts** (config fields + imports)
2. **Builds a lifecycle hooks system** so modules activate at the right moment in every build
3. **Adds a Behavior system** (reusable, versioned patterns like Claude Code skills)
4. **Hardens all R17 modules** with edge case tests
5. **Builds cross-module integration tests** including lifecycle hook tests

This is the sprint that turns Nova26 from "beautiful disconnected modules" into "one living system."

---

## Rules

- TypeScript strict mode. No `any` types.
- ESM imports with `.js` extensions (e.g., `import type { Foo } from '../bar/baz.js'`).
- Tests use vitest. Mock Ollama — never real LLM calls. Mock fs — never real files.
- All IDs via `crypto.randomUUID()`. All timestamps ISO 8601.
- Immutable patterns — return new objects, don't mutate inputs.
- Run `npx tsc --noEmit` and `npx vitest run` after EVERY task. Zero errors, zero failures.
- Target: 2,642+ → 2,800+ tests (aim for 160+ new).

---

## Task 1: Wire All 13 Unwired Modules into ralph-loop.ts

### ⚠️ THIS IS THE #1 PRIORITY. DO NOT SKIP. DO NOT DEFER. DO IT FIRST.

Open `src/orchestrator/ralph-loop.ts`.

The `RalphLoopOptions` interface (line 42) currently has `Enabled` + config fields for:
- Visionary engines (dream, universe, evolution, symbiont, taste-room)
- R16-02 Agent Memory (`agentMemoryEnabled`, `memoryConfig`)
- R16-05 Wellbeing (`wellbeingEnabled`, `wellbeingConfig`)
- R17-01 Recovery (`advancedRecoveryEnabled`, `advancedRecoveryConfig`)
- R17-02 Init (`advancedInitEnabled`, `advancedInitConfig`)

You must add the remaining **13 features**. Here's exactly what to do:

### Step 1A: Add type-only imports after line 40

**IMPORTANT:** Before adding each import, open the source file and verify the exact exported
type name. Use whatever is actually exported. The names below are my best guess from reading
the source — adapt if wrong.

```typescript
// R16-01 Portfolio
import type { PortfolioEngineConfig } from '../portfolio/index.js';
// R16-03 Generative UI
import type { LivePreviewConfig } from '../generative-ui/live-preview.js';
// R16-04 Autonomous Testing
import type { TestRunConfig } from '../testing/autonomous-runner.js';
// R17-03 Code Review
import type { ReviewConfig } from '../review/pr-intelligence.js';
// R17-06 Accessibility
import type { A11yConfig } from '../a11y/wcag-engine.js';
// R17-07 Technical Debt
import type { DebtConfig } from '../debt/technical-debt.js';
// R17-09 Production Feedback
import type { FeedbackLoopConfig } from '../prod-feedback/feedback-loop.js';
// R17-10 Health Dashboard
import type { HealthConfig } from '../health/health-dashboard.js';
```

For modules that DO NOT export a config type (R17-04 migrate, R17-05 debug, R17-08 deps,
R17-11 env, R17-12 orchestration), define simple inline interfaces ABOVE `RalphLoopOptions`:

```typescript
/** Placeholder configs for modules without dedicated config types */
export interface MigrationModuleConfig {
  maxStepsPerRun?: number;
  autoRollback?: boolean;
}

export interface DebugModuleConfig {
  maxSessionHistory?: number;
  autoRegressionTests?: boolean;
}

export interface DependencyModuleConfig {
  autoUpdateMinor?: boolean;
  vulnerabilityScanOnBuild?: boolean;
}

export interface EnvModuleConfig {
  secretDetection?: boolean;
  envDiffOnSwitch?: boolean;
}

export interface OrchestrationModuleConfig {
  metaLearningEnabled?: boolean;
  retrospectiveAfterBuild?: boolean;
}
```

### Step 1B: Add config fields to RalphLoopOptions

Add these after the `advancedInitConfig` field (line 78):

```typescript
  // Portfolio Intelligence (R16-01)
  portfolioEnabled?: boolean;
  portfolioConfig?: PortfolioEngineConfig;
  // Generative UI (R16-03)
  generativeUIEnabled?: boolean;
  generativeUIConfig?: LivePreviewConfig;
  // Autonomous Testing (R16-04)
  autonomousTestingEnabled?: boolean;
  testRunConfig?: TestRunConfig;
  // Code Review (R17-03)
  codeReviewEnabled?: boolean;
  codeReviewConfig?: ReviewConfig;
  // Migration Engine (R17-04)
  migrationEnabled?: boolean;
  migrationConfig?: MigrationModuleConfig;
  // Debugging (R17-05)
  debugEngineEnabled?: boolean;
  debugConfig?: DebugModuleConfig;
  // Accessibility (R17-06)
  accessibilityEnabled?: boolean;
  accessibilityConfig?: A11yConfig;
  // Technical Debt (R17-07)
  debtScoringEnabled?: boolean;
  debtConfig?: DebtConfig;
  // Dependency Management (R17-08)
  dependencyManagementEnabled?: boolean;
  dependencyConfig?: DependencyModuleConfig;
  // Production Feedback (R17-09)
  productionFeedbackEnabled?: boolean;
  productionFeedbackConfig?: FeedbackLoopConfig;
  // Health Dashboard (R17-10)
  healthDashboardEnabled?: boolean;
  healthConfig?: HealthConfig;
  // Environment Management (R17-11)
  envManagementEnabled?: boolean;
  envConfig?: EnvModuleConfig;
  // Orchestration Optimization (R17-12)
  orchestrationOptimizationEnabled?: boolean;
  orchestrationConfig?: OrchestrationModuleConfig;
```

### Step 1C: Verify immediately

```bash
npx tsc --noEmit        # MUST be 0 errors
npx vitest run           # MUST pass all 2642+ tests
```

**If any import fails:** Open the source file, find the real export name, fix the import.
**If no config type exists:** Use the inline placeholder.

**DO NOT proceed to Task 2 until ralph-loop.ts compiles cleanly.**

---

## Task 2: Implement RalphLoopLifecycle Hooks System

### What to build

Create `src/orchestrator/lifecycle-hooks.ts` — a typed hook system that lets feature modules
register callbacks at specific points in the Ralph Loop build lifecycle.

### Interfaces

```typescript
export interface BuildContext {
  buildId: string;
  prdId: string;
  prdName: string;
  startedAt: string;
  options: Record<string, unknown>;
}

export interface TaskContext {
  taskId: string;
  title: string;
  agentName: string;
  dependencies: string[];
}

export interface TaskResult {
  taskId: string;
  agentName: string;
  success: boolean;
  output?: string;
  error?: string;
  durationMs: number;
  aceScore?: number;
}

export interface HandoffContext {
  fromAgent: string;
  toAgent: string;
  taskId: string;
  payload: Record<string, unknown>;
}

export interface BuildResult {
  buildId: string;
  prdId: string;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  totalDurationMs: number;
  averageAceScore: number;
}

export type HookPhase =
  | 'onBeforeBuild'
  | 'onBeforeTask'
  | 'onAfterTask'
  | 'onTaskError'
  | 'onHandoff'
  | 'onBuildComplete';

export interface LifecycleHook {
  id: string;
  phase: HookPhase;
  moduleName: string;
  priority: number;  // Lower = runs first. Default 100.
  handler: (context: any) => Promise<void>;
}

export interface RalphLoopLifecycle {
  onBeforeBuild: ((context: BuildContext) => Promise<void>)[];
  onBeforeTask: ((context: TaskContext) => Promise<void>)[];
  onAfterTask: ((context: TaskResult) => Promise<void>)[];
  onTaskError: ((context: TaskResult) => Promise<void>)[];
  onHandoff: ((context: HandoffContext) => Promise<void>)[];
  onBuildComplete: ((context: BuildResult) => Promise<void>)[];
}
```

### HookRegistry class

```typescript
export class HookRegistry {
  private hooks: LifecycleHook[] = [];

  register(hook: Omit<LifecycleHook, 'id'>): string { /* generate ID, push, return ID */ }
  unregister(hookId: string): boolean { /* remove by ID */ }
  getHooksForPhase(phase: HookPhase): LifecycleHook[] { /* sorted by priority */ }
  async executePhase(phase: HookPhase, context: unknown): Promise<void> {
    /* run all hooks for phase in priority order, catch errors per-hook (don't crash the build) */
  }
  getRegisteredModules(): string[] { /* unique module names */ }
  clear(): void { /* remove all hooks */ }
}
```

### Feature → Hook Mapping (implement as a factory)

Create `src/orchestrator/lifecycle-wiring.ts`:

```typescript
export function wireFeatureHooks(
  registry: HookRegistry,
  options: RalphLoopOptions
): void {
  // Wire each enabled feature to its lifecycle phase:
  //
  // onBeforeBuild:
  //   - R17-11 env (validate environment if envManagementEnabled)
  //   - R17-08 deps (scan dependencies if dependencyManagementEnabled)
  //   - R17-07 debt (pre-build debt snapshot if debtScoringEnabled)
  //
  // onBeforeTask:
  //   - R17-06 a11y (check if Venus UI task, attach config if accessibilityEnabled)
  //   - R16-03 generative-ui (attach live preview if generativeUIEnabled and Venus task)
  //
  // onAfterTask:
  //   - R17-03 review (review output if codeReviewEnabled)
  //   - R16-04 testing (run tests if autonomousTestingEnabled)
  //   - R16-02 memory (consolidate if agentMemoryEnabled)
  //   - R17-05 debug (analyze errors if debugEngineEnabled and task failed)
  //
  // onTaskError:
  //   - R17-01 recovery (checkpoint + recovery strategy if advancedRecoveryEnabled)
  //   - R17-05 debug (root cause analysis if debugEngineEnabled)
  //
  // onHandoff:
  //   - R17-12 orchestration (generate primer if orchestrationOptimizationEnabled)
  //   - R16-05 wellbeing (check developer state if wellbeingEnabled)
  //
  // onBuildComplete:
  //   - R17-10 health (compute snapshot if healthDashboardEnabled)
  //   - R17-07 debt (update debt score if debtScoringEnabled)
  //   - R17-12 orchestration (generate retrospective if orchestrationOptimizationEnabled)
  //   - R16-01 portfolio (update cross-project learning if portfolioEnabled)
  //   - R17-09 prod-feedback (ingest feedback if productionFeedbackEnabled)
  //
  // Each hook should:
  // 1. Check if the feature is enabled in options
  // 2. Import the module's factory/class lazily
  // 3. Call the appropriate method
  // 4. Log via console.log(`[lifecycle] ${moduleName} ${phase}`)
  //
  // For this sprint, the handlers can be lightweight stubs that log and return.
  // The REAL implementation will be wired in a future sprint.
  // But the types, registry, and wiring MUST be complete and compile.
}
```

### Tests: `src/orchestrator/lifecycle-hooks.test.ts` (20+ tests)

1. Register a hook and retrieve it by phase
2. Hooks sorted by priority (lower first)
3. Execute phase calls all registered hooks
4. Hook error doesn't crash other hooks in the phase
5. Unregister removes hook
6. Clear removes all hooks
7. getRegisteredModules returns unique names
8. Duplicate hook IDs rejected
9. Empty phase execution succeeds (no hooks)
10. Priority 0 runs before priority 100
11. Multiple modules can register for same phase
12. Context is passed correctly to handler
13. Async hooks awaited in order
14. wireFeatureHooks with all disabled = 0 hooks registered
15. wireFeatureHooks with env enabled = hook on onBeforeBuild
16. wireFeatureHooks with review enabled = hook on onAfterTask
17. wireFeatureHooks with health enabled = hook on onBuildComplete
18. wireFeatureHooks with recovery enabled = hook on onTaskError
19. wireFeatureHooks with orchestration enabled = hooks on onHandoff + onBuildComplete
20. wireFeatureHooks with ALL enabled = hooks on every phase

---

## Task 3: Implement Behavior System

### What to build

Create `src/behaviors/` — a system for reusable, versioned agent behaviors (inspired by Claude
Code skills). A Behavior is a small, self-contained instruction module that any agent can load
when relevant.

### Files to create

**`src/behaviors/behavior-types.ts`**

```typescript
export interface BehaviorMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  triggerConditions: TriggerCondition[];
  compatibleAgents: string[];  // '*' means all agents
  tags: string[];
  priority: number;  // Lower = higher priority
}

export type TriggerCondition =
  | { type: 'taskType'; value: string }        // e.g., 'ui-component', 'api-endpoint'
  | { type: 'agentName'; value: string }       // e.g., 'VENUS', 'MARS'
  | { type: 'filePattern'; value: string }     // e.g., '*.tsx', '*.test.ts'
  | { type: 'keyword'; value: string }         // e.g., 'authentication', 'database'
  | { type: 'manual'; value: string };         // explicit /behavior invoke

export interface BehaviorInstruction {
  phase: 'planning' | 'execution' | 'review';
  instruction: string;
  required: boolean;
}

export interface Behavior {
  metadata: BehaviorMetadata;
  instructions: BehaviorInstruction[];
  templates: Record<string, string>;  // Named templates the behavior provides
  rules: string[];  // Constitutional rules to enforce
}
```

**`src/behaviors/behavior-registry.ts`**

```typescript
export class BehaviorRegistry {
  private behaviors: Map<string, Behavior> = new Map();

  register(behavior: Behavior): void { /* validate + store */ }
  unregister(behaviorId: string): boolean { /* remove */ }
  getBehavior(behaviorId: string): Behavior | undefined { /* lookup */ }
  getAllBehaviors(): Behavior[] { /* all registered */ }

  findByTrigger(context: TriggerContext): Behavior[] {
    /* Match behaviors whose triggerConditions match the current task/agent/file context.
       Return sorted by priority (lower first). */
  }

  getInstructionsForAgent(agentName: string, taskContext: TriggerContext): BehaviorInstruction[] {
    /* Find all matching behaviors for this agent + context, merge instructions by phase,
       deduplicate, and return sorted by priority. */
  }

  getTemplatesForAgent(agentName: string, taskContext: TriggerContext): Record<string, string> {
    /* Merge all matching behavior templates. Later behaviors override earlier for same key. */
  }

  getRulesForAgent(agentName: string, taskContext: TriggerContext): string[] {
    /* Collect all constitutional rules from matching behaviors. Deduplicate. */
  }
}

export interface TriggerContext {
  taskType?: string;
  agentName?: string;
  filePaths?: string[];
  taskTitle?: string;
  taskDescription?: string;
}
```

**`src/behaviors/builtin-behaviors.ts`**

Create 5 built-in behaviors:

1. **calm-ui** — For VENUS. Enforces calm aesthetic (muted colors, generous whitespace, subtle
   animations). Triggered on taskType 'ui-component' or agentName 'VENUS'.
2. **secure-code** — For all agents. Adds security checklist (no hardcoded secrets, input
   validation, SQL parameterization). Triggered on keyword 'authentication' or 'database'.
3. **test-first** — For SATURN/PLUTO. Enforces test-first development (write test → implement →
   verify). Triggered on taskType containing 'test'.
4. **api-design** — For MARS. Enforces REST conventions (proper HTTP verbs, error responses,
   pagination). Triggered on keyword 'api' or 'endpoint'.
5. **adr-on-decision** — For all agents. When a significant architectural decision is detected
   (new dependency, pattern change), generate an Architecture Decision Record stub. Triggered
   on keyword 'decision' or 'architecture' or 'migrate'.

**`src/behaviors/index.ts`**

Barrel export: `BehaviorRegistry`, `Behavior`, `BehaviorMetadata`, `TriggerContext`,
`getDefaultBehaviors()` (returns the 5 built-ins).

### Tests: `src/behaviors/behavior-registry.test.ts` (25+ tests)

1. Register behavior and retrieve by ID
2. Unregister removes behavior
3. findByTrigger matches taskType condition
4. findByTrigger matches agentName condition
5. findByTrigger matches filePattern condition (glob-like: *.tsx)
6. findByTrigger matches keyword in task title
7. findByTrigger matches keyword in task description
8. findByTrigger with no matches returns empty
9. findByTrigger with multiple matches sorted by priority
10. getInstructionsForAgent merges from multiple behaviors
11. getInstructionsForAgent deduplicates identical instructions
12. getTemplatesForAgent merges, later overrides earlier
13. getRulesForAgent deduplicates
14. compatibleAgents '*' matches any agent
15. compatibleAgents ['VENUS'] only matches VENUS
16. Behavior with empty triggerConditions never auto-triggers
17. Manual trigger type matched by explicit ID lookup
18. Register duplicate ID overwrites
19. getAllBehaviors returns all
20. calm-ui behavior matches VENUS agent
21. secure-code behavior matches 'authentication' keyword
22. test-first behavior matches SATURN agent
23. api-design behavior matches 'api' keyword
24. adr-on-decision behavior matches 'architecture' keyword
25. getDefaultBehaviors returns exactly 5 behaviors

---

## Task 4: Edge Case Tests for R17 Modules

Add edge case tests to the EXISTING test files. Do NOT create new test files — extend them.

### `src/review/pr-intelligence.test.ts` — add 8 tests:
1. Empty diff produces empty review
2. Very large diff (1000+ lines) does not crash
3. Review with all praise comments → verdict 'approve'
4. Duplicate comments from multiple agents are deduplicated
5. Comments with confidence 0 are filtered out
6. Mixed file types route to correct agents simultaneously
7. Config with empty agents array triggers auto-detection
8. Review summary includes duration in milliseconds

### `src/migrate/framework-migrator.test.ts` — add 8 tests:
1. Plan with zero steps has risk level 'low'
2. Migration from same version to same version creates empty plan
3. Rollback on already-rolled-back step is no-op
4. Pause then resume preserves step progress
5. Maximum steps per run is respected
6. File glob matching handles nested directories
7. Config state directory is used for persistence path
8. Completed migration cannot be re-executed

### `src/debug/root-cause-analyzer.test.ts` — add 8 tests:
1. Stack trace with Windows paths (backslash) parses correctly
2. Stack trace with no file path handles gracefully
3. Multiple fix proposals sorted by confidence
4. Fix proposal diff is valid unified diff format
5. Debug session with empty raw input creates valid session
6. Regression test file path is in same directory as source
7. Root cause analysis with all frames unreadable still returns result
8. Session history respects max limit

### `src/a11y/wcag-engine.test.ts` — add 8 tests:
1. Nested img tags detected (img inside div inside section)
2. Button with child text content is not a violation
3. Self-closing components handled correctly
4. Multiple violations on same line get unique IDs
5. Score computation with zero total elements returns 100
6. AAA-level scan includes all A and AA rules
7. File with no JSX produces zero violations
8. Suggested fix for missing label includes htmlFor

### `src/debt/technical-debt.test.ts` — add 8 tests:
1. Nested ternary operators count as complexity
2. Short-circuit operators (&&, ||) count as complexity
3. `as unknown as Type` double cast detected
4. Multiple TODO comments in same file each produce an item
5. Grade boundaries are inclusive (score 20 → A, score 21 → B)
6. Trend with single data point returns 'stable'
7. Report summary includes grade letter
8. Top items capped at 10 even if more exist

### `src/deps/dependency-manager.test.ts` — add 8 tests:
1. Handles workspace:* version syntax
2. Empty package.json returns empty dependencies
3. Dev dependencies properly flagged
4. Multiple vulnerabilities on same dep aggregate correctly
5. Health score never goes below 0
6. Update recommendations sorted by urgency
7. Typosquat detection for 'expresss' (double s)
8. Report overall score 0 when all deps are critical

### `src/prod-feedback/feedback-loop.test.ts` — add 7 tests:
1. Error with no type defaults to 'Unknown'
2. Multiple ingestions increment occurrence count
3. Git blame with merge commit format parses correctly
4. Impact score capped at 100
5. Recommendation 'ignore' for score below 20
6. Stack frames with TypeScript source maps (.ts:line)
7. Metadata with nested objects preserved

### `src/health/health-dashboard.test.ts` — add 7 tests:
1. Zero dimensions returns score 0
2. All dimensions at 100 returns grade A
3. Alert acknowledged flag prevents re-triggering
4. Snapshot records correct date
5. Weekly report contains trend information
6. Health computed with missing dimension weights defaults correctly
7. HTML report includes CSS for color-coded scores

### `src/env/environment-manager.test.ts` — add 7 tests:
1. Multi-line values in env files handled
2. Empty value (KEY=) returns empty string not undefined
3. Duplicate keys — last value wins
4. Secret pattern matching is case-insensitive
5. Feature flag detection in nested object access
6. Env diff between two environments shows additions and removals
7. Report with no env files returns empty environments array

### `src/orchestration/orchestration-optimizer.test.ts` — add 7 tests:
1. Profile with zero tasks returns 0 success rate
2. Agent with no task type breakdown has empty array
3. Handoff with zero retries counts as first-attempt success
4. Retrospective with zero failed tasks has empty underperformers
5. Primer text includes both agent names
6. Build grade boundaries match spec (0.95 → A, 0.85 → B, etc.)
7. Narrative mentions build ID

---

## Task 5: Cross-Module Integration Tests

### File: `src/integration/r17-lifecycle-integration.test.ts`

Create this file (or extend `src/orchestration/r17-integration.test.ts` if it exists).

### Tests (20 minimum):

**Module interoperability (10 tests):**
1. Debug → Prod Feedback: StackFrame compatible with parsedFrames
2. Debt → Health: DebtReport score feeds HealthDimension
3. A11y → Health: AccessibilityReport score feeds HealthDimension
4. Deps → Health: DependencyReport score feeds HealthDimension
5. Review → Orchestration: Review comments feed AgentPerformanceProfile
6. Env → Review: SecretAlert can become ReviewComment
7. Migration → Debug: Migration failure parseable by debug engine
8. Health → Orchestration: ProjectHealth grade maps to BuildRetrospective grade
9. Debt + Deps combined quality score
10. Portfolio patterns feed into debt analysis

**Lifecycle hooks (6 tests):**
11. HookRegistry.executePhase('onBeforeBuild') calls env + deps hooks
12. HookRegistry.executePhase('onAfterTask') calls review + testing hooks
13. HookRegistry.executePhase('onBuildComplete') calls health + debt + orchestration hooks
14. HookRegistry.executePhase('onTaskError') calls recovery + debug hooks
15. Full lifecycle simulation: before → task → after → complete (all hooks fire)
16. Hook failure on one module doesn't prevent others from running

**Behavior system (4 tests):**
17. BehaviorRegistry.findByTrigger returns calm-ui for Venus UI task
18. BehaviorRegistry.getInstructionsForAgent merges calm-ui + secure-code for Venus auth task
19. All 5 default behaviors load without error
20. Behaviors + Lifecycle hooks work together (behavior adds rules, hook enforces them)

---

## Final Checklist

After completing all 5 tasks, verify:

```bash
npx tsc --noEmit        # 0 errors
npx vitest run           # 2642+ tests → target 2800+
```

**SUCCESS CRITERIA (all must be true):**

1. ✅ `ralph-loop.ts` has `Enabled` + config fields for ALL 17 R16/R17 features
2. ✅ `src/orchestrator/lifecycle-hooks.ts` exists with HookRegistry class
3. ✅ `src/orchestrator/lifecycle-wiring.ts` exists with wireFeatureHooks function
4. ✅ `src/behaviors/` directory exists with registry, types, builtin behaviors, index
5. ✅ `npx tsc --noEmit` = 0 errors
6. ✅ 160+ new tests added (target: 2800+ total)
7. ✅ All tests passing

**Modified files:**
- `src/orchestrator/ralph-loop.ts` (26 new fields + 8 imports + 5 inline interfaces)
- 10 R17 test files (edge case additions)

**New files:**
- `src/orchestrator/lifecycle-hooks.ts`
- `src/orchestrator/lifecycle-hooks.test.ts`
- `src/orchestrator/lifecycle-wiring.ts`
- `src/behaviors/behavior-types.ts`
- `src/behaviors/behavior-registry.ts`
- `src/behaviors/builtin-behaviors.ts`
- `src/behaviors/index.ts`
- `src/behaviors/behavior-registry.test.ts`
- `src/integration/r17-lifecycle-integration.test.ts`
