# KIMI: Ralph-Loop Wiring & Quality Hardening Sprint

> Assigned to: Kimi
> Sprint: Ralph-Loop Wiring + Quality Hardening
> Date issued: 2026-02-19
> Prerequisite: 2,642 tests passing, 0 TS errors
> IMPORTANT: This replaces the previous overnight hardening prompt. Task 1 is the #1 priority.

## Mission

13 feature modules are implemented but **never invoked by the orchestrator** because they have
no config fields in `ralph-loop.ts`. This sprint fixes that, then hardens test coverage.

1. **Wire all 13 modules into `ralph-loop.ts`** — type-only imports + config fields (THIS IS MANDATORY)
2. **Add edge case tests** to every R17 module
3. **Cross-module integration tests**

---

## Rules

- TypeScript strict mode. No `any` types.
- ESM imports with `.js` extensions.
- Tests use vitest. Mock Ollama — never real LLM calls. Mock fs — never real files.
- Run `npx tsc --noEmit` and `npx vitest run` after each task. Zero errors, zero failures.
- Target: 80+ new tests → 2720+.

---

## Task 1: Wire ALL 13 Unwired Modules into ralph-loop.ts

### THIS IS THE MOST IMPORTANT TASK. DO NOT SKIP IT.

Open `src/orchestrator/ralph-loop.ts`. The `RalphLoopOptions` interface currently has config
fields for: visionary engines, agentMemory (R16-02), wellbeing (R16-05), advancedRecovery (R17-01),
advancedInit (R17-02). That's only 4 of 17 R16/R17 features.

You must add the remaining 13.

### Step 1A: Add type-only imports

Add these imports after the existing `AdvancedInitConfig` import (around line 40). **Check
each file first** — if the config type name below doesn't match what the file actually exports,
use whatever name IS exported. If no config type exists in a module, define an inline interface.

```typescript
// R16-01 Portfolio
import type { PortfolioEngineConfig } from '../portfolio/index.js';
// R16-03 Generative UI
import type { LivePreviewConfig } from '../generative-ui/live-preview.js';
// R16-04 Autonomous Testing
import type { TestRunConfig } from '../testing/autonomous-runner.js';
// R17-03 Code Review
import type { ReviewConfig } from '../review/pr-intelligence.js';
// R17-04 Migration — no config type exported, define inline below
// R17-05 Debug — no config type exported, define inline below
// R17-06 Accessibility
import type { A11yConfig } from '../a11y/wcag-engine.js';
// R17-07 Technical Debt
import type { DebtConfig } from '../debt/technical-debt.js';
// R17-08 Dependencies — no config type exported, define inline below
// R17-09 Production Feedback
import type { FeedbackLoopConfig } from '../prod-feedback/feedback-loop.js';
// R17-10 Health Dashboard
import type { HealthConfig } from '../health/health-dashboard.js';
// R17-11 Environment — no config type exported, define inline below
// R17-12 Orchestration — no config type exported, define inline below
```

For modules with no exported config type (R17-04, R17-05, R17-08, R17-11, R17-12), add simple
inline interfaces ABOVE the `RalphLoopOptions` interface:

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

Add these fields to the `RalphLoopOptions` interface, after the existing `advancedInitConfig`
field (around line 78):

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

### Step 1C: Verify

```bash
npx tsc --noEmit        # MUST be 0 errors
npx vitest run           # MUST still pass all 2642+ tests
```

**DO NOT proceed to Task 2 until ralph-loop.ts compiles with 0 errors.**

If an import fails because the type name doesn't exist, open the source file, find the actual
exported type name, and use that instead. If truly no config type exists, use the inline
placeholder interface.

---

## Task 2: Edge Case Tests — Review, Migration, Debug Modules

Add edge case tests to the existing test files. Do NOT create new test files — extend the existing ones.

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

---

## Task 3: Edge Case Tests — A11y, Debt, Deps Modules

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

---

## Task 4: Edge Case Tests — Prod Feedback, Health, Env, Orchestration

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
5. Feature flag detection in nested object access (config.featureFlags.newUI)
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

### File to extend (if it exists) or create

- If `src/orchestration/r17-integration.test.ts` already exists, add these tests to it.
- Otherwise create `src/integration/r17-integration.test.ts`.

### Tests (15 minimum):

1. **Debug → Prod Feedback**: StackFrame from debug engine is compatible with prod-feedback's parsedFrames
2. **Debt → Health**: DebtReport score feeds into HealthDimension for code-quality
3. **A11y → Health**: AccessibilityReport score feeds into HealthDimension for accessibility
4. **Deps → Health**: DependencyReport score feeds into HealthDimension for dependencies
5. **Review → Orchestration**: Review comments by agent feed into AgentPerformanceProfile
6. **Env → Review**: SecretAlert from env scan can produce ReviewComment for security category
7. **Migration → Debug**: Migration step failure can be parsed by debug engine
8. **Health → Orchestration**: ProjectHealth grade maps to BuildRetrospective grade scale
9. **All modules export their primary class** — import and instantiate each
10. **All modules with config types accept them** — instantiate with config
11. **RalphLoopOptions accepts all 13 new config types** — type assertion test (import from ralph-loop.ts)
12. **Debt + Deps combined score** — debt score + dependency score average for overall quality
13. **Review severity matches health alert severity** — 'critical' maps correctly
14. **Prod feedback impact score feeds health alerts** — high impact → health alert
15. **Portfolio patterns feed into debt analysis** — cross-project debt patterns

---

## Final Checklist

After completing all 5 tasks, verify:

```bash
npx tsc --noEmit        # 0 errors
npx vitest run           # 2642+ tests (target: 80+ new = 2720+)
```

Modified files:
- `src/orchestrator/ralph-loop.ts` (26 new fields + 8 imports + 5 inline interfaces)
- All 10 R17 test files (edge case additions)

New or extended files:
- Integration test file (extended or created)

**SUCCESS CRITERIA:**
1. `ralph-loop.ts` has `Enabled` + config fields for ALL 17 R16/R17 features (not just 4)
2. `npx tsc --noEmit` = 0 errors
3. 80+ new tests added
4. All tests passing
