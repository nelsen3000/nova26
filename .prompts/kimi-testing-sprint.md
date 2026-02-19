# KIMI-TESTING Sprint: Autonomous Testing & Quality Assurance (R16-04)

> Assigned to: Kimi
> Sprint: Autonomous Testing (post-Generative UI)
> Date issued: 2026-02-19
> Prerequisite: KIMI-GENUI complete (~1991 tests, 0 TS errors)

## Project Context

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama (local LLM), Convex, and vitest. Agents are named after celestial bodies: MARS, VENUS, MERCURY, JUPITER, SATURN, PLUTO, ATLAS, etc.

**Key systems you should be aware of (do not modify unless told):**

- Core execution: Ralph Loop (`src/orchestrator/ralph-loop.ts`)
- Taste Vault: `src/taste-vault/`
- ACE playbooks: `src/ace/`
- Rehearsal Stage: `src/rehearsal/`
- Session Memory: `src/memory/session-memory.ts`
- Agent Memory: `src/memory/agent-memory.ts`
- Personality Engine: `src/agents/personality-engine.ts`
- Portfolio: `src/portfolio/`
- Generative UI: `src/generative-ui/`
- Preview Server: `src/preview/server.ts`
- Prompt Snapshots: `src/testing/prompt-snapshots.ts`

**Current state:** ~1991 tests passing, 0 TypeScript errors.

**Important context:** `src/testing/prompt-snapshots.ts` already exists for prompt drift detection. The Autonomous Testing system (this sprint) is a **separate, higher-level system** that adds strategic test gap analysis, mutation testing, test maintenance automation, test strategy generation, and PLUTO's expanded intelligence. New files go alongside the existing ones in `src/testing/`. Do **not** modify `prompt-snapshots.ts` or `prompt-snapshots.test.ts`.

**Key distinction from existing testing:** The existing prompt snapshot system detects drift in agent prompts. The autonomous testing system is about the *user's project* — analyzing test quality, finding scenario gaps, running mutation tests to verify test effectiveness, maintaining tests as code changes, and generating test strategies for new features.

---

## Rules

- TypeScript strict mode. No `any` types.
- ESM imports with `.js` extensions (e.g., `import { Foo } from './foo.js';`).
- Every new `.ts` source file gets a companion `.test.ts` file in the same directory.
- Tests use vitest (`import { describe, it, expect, vi, beforeEach } from 'vitest';`).
- Mock Ollama calls — **never** make real LLM calls in tests. Use `vi.fn()` or `vi.mock()`.
- Mock file system operations in tests — **never** read/write real files. Use `vi.mock('fs')`.
- Do **not** modify existing source files unless explicitly told to extend them.
- Run `npx tsc --noEmit` and `npx vitest run` after each task. Zero errors, zero failures.
- Target: 1991+ tests passing at end of sprint (aim for 90+ new tests).
- Use `zod` for runtime validation where appropriate.
- All IDs should be generated with `crypto.randomUUID()`.
- All timestamps should be ISO 8601 strings (`new Date().toISOString()`).

---

## KIMI-TESTING-01: Test Quality Analysis & Gap Detection

### Files to Create

- `src/testing/test-analyzer.ts`
- `src/testing/test-analyzer.test.ts`

### Purpose

PLUTO's strategic role expansion begins here. Instead of just running tests, PLUTO now analyzes the test suite to identify *scenario* gaps — not just uncovered lines, but uncovered business logic paths that matter. It scores test quality across multiple dimensions (assertion depth, boundary testing, failure paths, independence, speed) and generates a daily brief recommending the highest-value tests to write next.

### Interfaces to Implement

All interfaces must be exported from `src/testing/test-analyzer.ts`:

```typescript
export type GapType = 'scenario' | 'boundary' | 'error-path' | 'integration';
export type QualityGrade = 'excellent' | 'good' | 'adequate' | 'poor';

export interface TestGap {
  id: string;
  type: GapType;
  description: string;                 // human-readable gap description
  affectedFile: string;
  affectedFunction: string;
  riskScore: number;                   // 0-100; higher = more important to fix
  businessImpact: string;              // why this matters in plain English
  suggestedTestDescription: string;    // what a test covering this gap would assert
  relatedIntentSpecId?: string;        // link to R16-01 intent spec if applicable
}

export interface TestQualityScore {
  overall: number;                     // 0-100
  grade: QualityGrade;
  dimensions: {
    assertionDepth: number;            // 0-100: do tests assert meaningful properties?
    boundaryTesting: number;           // 0-100: are edge cases tested?
    failurePathCoverage: number;       // 0-100: are error cases tested?
    testIndependence: number;          // 0-100: do tests share mutable state?
    testSpeed: number;                 // 0-100: are tests fast enough?
  };
  lineCoverage: number;                // separate from quality score, 0-100
  mutationScore?: number;              // null if mutation testing not run yet
  gaps: TestGap[];
  computedAt: string;
}

export interface DailyBrief {
  briefId: string;
  projectId: string;
  generatedAt: string;
  overallScore: TestQualityScore;
  topRisks: TestGap[];                 // top 3 highest-risk gaps
  recommendation: string;             // 1-paragraph recommendation
  trendsVsLastBrief?: {
    overallDelta: number;              // positive = improvement
    newGaps: number;
    closedGaps: number;
  };
}

export interface TestFileAnalysis {
  filePath: string;
  testCount: number;
  assertionCount: number;
  avgAssertionsPerTest: number;
  hasBoundaryTests: boolean;
  hasErrorPathTests: boolean;
  hasSharedState: boolean;             // true if tests share mutable variables
  avgDurationMs: number;
}
```

### Class to Implement

```typescript
export class TestAnalyzer {
  constructor(
    analyzerFn: (sourceCode: string, testCode: string) => Promise<{ gaps: TestGap[]; fileAnalysis: TestFileAnalysis }>,
    config?: { riskThreshold?: number; maxGapsPerFile?: number }
  );
}
```

The `analyzerFn` wraps an LLM call that analyzes source code against its test file. Injected for testability.

Default config:
```typescript
{ riskThreshold: 30, maxGapsPerFile: 5 }
```

### Functions (all instance methods on `TestAnalyzer`)

1. **`analyzeFile(sourceFilePath: string, sourceCode: string, testCode: string): Promise<TestFileAnalysis>`**
   - Calls `analyzerFn(sourceCode, testCode)` to get gaps and file analysis.
   - Caps gaps at `maxGapsPerFile`.
   - Stores the analysis internally (keyed by sourceFilePath).
   - Returns the file analysis.

2. **`detectGaps(sourceCode: string, testCode: string): Promise<TestGap[]>`**
   - Calls `analyzerFn` and returns just the gaps.
   - Each gap gets a generated UUID for `id`.

3. **`scoreQuality(fileAnalyses: TestFileAnalysis[]): TestQualityScore`**
   - Computes aggregate quality score from all file analyses:
     - `assertionDepth`: average of `avgAssertionsPerTest` across files, scaled to 0-100 (3+ assertions per test = 100).
     - `boundaryTesting`: percentage of files with `hasBoundaryTests === true`.
     - `failurePathCoverage`: percentage of files with `hasErrorPathTests === true`.
     - `testIndependence`: percentage of files with `hasSharedState === false` (inverted — no shared state = good).
     - `testSpeed`: percentage of files with `avgDurationMs < 100`.
   - `overall`: weighted average of all dimensions (equal weights: 20% each).
   - `grade`: excellent (80+), good (60-79), adequate (40-59), poor (<40).
   - `computedAt` set to now.

4. **`generateBrief(projectId: string, allGaps: TestGap[], currentScore: TestQualityScore, previousBrief?: DailyBrief): DailyBrief`**
   - Selects top 3 gaps by `riskScore`.
   - Generates recommendation: "Your highest-risk untested paths today are {gap1}, {gap2}, and {gap3}. I recommend writing tests for {gap1} first because {gap1.businessImpact}."
   - Computes trends vs previous brief if provided.
   - Returns the brief with generated UUID.

5. **`getAllGaps(): TestGap[]`**
   - Returns all gaps from all analyzed files, sorted by riskScore descending.

6. **`getGapsByRisk(minRisk: number): TestGap[]`**
   - Returns gaps with riskScore >= minRisk.

### Required Tests (minimum 20)

Write these in `src/testing/test-analyzer.test.ts`:

1. **Analyzes file and returns analysis** — mock analyzerFn, verify TestFileAnalysis returned.
2. **Caps gaps at maxGapsPerFile** — analyzerFn returns 10 gaps, max 5, verify 5 stored.
3. **Detects gaps with generated IDs** — verify each gap has a UUID id.
4. **Scores quality with all dimensions** — 3 file analyses, verify all dimensions computed.
5. **Assertion depth: 3+ per test = 100** — avgAssertionsPerTest: 4, verify 100.
6. **Assertion depth: 1 per test scores low** — avgAssertionsPerTest: 1, verify ~33.
7. **Boundary testing percentage** — 2/3 files have boundary tests, verify ~67.
8. **Failure path percentage** — 1/3 files have error tests, verify ~33.
9. **Test independence: no shared state = 100** — all files clean, verify 100.
10. **Test speed: all fast = 100** — all avgDurationMs < 100, verify 100.
11. **Overall is weighted average** — verify calculation matches.
12. **Grade: excellent for 85** — verify 'excellent'.
13. **Grade: good for 65** — verify 'good'.
14. **Grade: adequate for 45** — verify 'adequate'.
15. **Grade: poor for 30** — verify 'poor'.
16. **Generates brief with top 3 risks** — 5 gaps, verify top 3 by riskScore selected.
17. **Brief recommendation mentions top gap** — verify string contains gap description.
18. **Brief computes trends vs previous** — previous overall 60, current 75, verify delta +15.
19. **Gets all gaps sorted by risk** — insert gaps with varied risks, verify sorted.
20. **Gets gaps filtered by min risk** — minRisk 50, verify only high-risk gaps returned.

---

## KIMI-TESTING-02: Mutation Testing Engine

### Files to Create

- `src/testing/mutation-engine.ts`
- `src/testing/mutation-engine.test.ts`

### Purpose

Mutation testing introduces small, controlled bugs into the codebase and verifies that tests catch them. A mutation that survives (no test catches it) reveals a gap in test effectiveness. This is different from line coverage — a line can be covered but the test might not assert anything meaningful about it. The mutation engine generates mutations, applies them one at a time, runs the test suite, and reports which survived.

### Interfaces to Implement

All interfaces must be exported from `src/testing/mutation-engine.ts`:

```typescript
export type MutationOperator =
  | 'boundary-relax'                   // > to >=
  | 'boundary-tighten'                 // >= to >
  | 'equality-negate'                  // === to !==
  | 'arithmetic-add-sub'              // + to -
  | 'arithmetic-mul-div'              // * to /
  | 'logical-and-or'                   // && to ||
  | 'logical-or-and'                   // || to &&
  | 'return-null'                      // return value to null
  | 'return-empty'                     // return value to [] or {}
  | 'statement-delete'                 // remove a statement
  | 'condition-true'                   // force condition to true
  | 'condition-false';                 // force condition to false

export type MutationStatus = 'pending' | 'killed' | 'survived' | 'skipped' | 'timeout';

export interface Mutation {
  id: string;
  operator: MutationOperator;
  file: string;
  line: number;
  originalCode: string;                // the exact original code snippet
  mutatedCode: string;                 // what it was changed to
  status: MutationStatus;
  killedByTest?: string;               // test name that caught it
  survivedReason?: string;             // why it survived (if survived)
}

export interface MutationResult {
  sessionId: string;
  projectId: string;
  runAt: string;
  totalMutations: number;
  killed: number;
  survived: number;
  skipped: number;
  timedOut: number;
  mutationScore: number;               // killed / (killed + survived), 0-1
  survivors: Mutation[];               // only survived mutations for review
  suggestedTests: SuggestedTest[];
  durationMs: number;
}

export interface SuggestedTest {
  mutationId: string;
  description: string;                 // what this test should assert
  testCode: string;                    // generated test code
  targetFile: string;                  // which test file to add it to
  confidence: number;                  // 0-1, how confident the suggestion is
}

export interface MutationConfig {
  operators: MutationOperator[];       // which operators to use
  maxMutationsPerFile: number;         // default: 20
  testTimeoutMs: number;               // per-mutation test timeout, default: 30000
  maxTotalDurationMs: number;          // total session timeout, default: 600000 (10 min)
  skipPatterns: string[];              // file patterns to skip (e.g., '*.test.ts')
}
```

### Class to Implement

```typescript
export class MutationEngine {
  constructor(
    testRunnerFn: (mutatedFile: string, mutatedCode: string) => Promise<{ passed: boolean; failedTest?: string; durationMs: number }>,
    suggestTestFn: (mutation: Mutation) => Promise<SuggestedTest>,
    config?: Partial<MutationConfig>
  );
}
```

The `testRunnerFn` applies a mutation and runs the relevant test suite. The `suggestTestFn` generates a test that would catch a surviving mutation. Both injected for testability.

Default config:
```typescript
const DEFAULT_CONFIG: MutationConfig = {
  operators: [
    'boundary-relax', 'boundary-tighten', 'equality-negate',
    'arithmetic-add-sub', 'logical-and-or', 'logical-or-and',
    'return-null', 'statement-delete', 'condition-true', 'condition-false',
  ],
  maxMutationsPerFile: 20,
  testTimeoutMs: 30000,
  maxTotalDurationMs: 600000,
  skipPatterns: ['*.test.ts', '*.spec.ts', '*.d.ts'],
};
```

### Functions (all instance methods on `MutationEngine`)

1. **`generateMutations(sourceCode: string, filePath: string): Mutation[]`**
   - Scans source code line by line.
   - For each line, checks which mutation operators could apply:
     - `boundary-relax`: line contains `>` (not `>=`, not `=>`) → replace `>` with `>=`
     - `boundary-tighten`: line contains `>=` → replace with `>`
     - `equality-negate`: line contains `===` → replace with `!==`
     - `arithmetic-add-sub`: line contains ` + ` (with spaces, to avoid string concat) → replace with ` - `
     - `arithmetic-mul-div`: line contains `*` (not `**`) → replace with `/`
     - `logical-and-or`: line contains `&&` → replace with `||`
     - `logical-or-and`: line contains `||` → replace with `&&`
     - `return-null`: line starts with `return ` (not `return;`) → replace return value with `null`
     - `return-empty`: line starts with `return [` or `return {` → replace with `return []` or `return {}`
     - `statement-delete`: non-empty, non-comment line → replace with empty string
     - `condition-true`: line contains `if (` → replace condition with `true`
     - `condition-false`: line contains `if (` → replace condition with `false`
   - For each applicable operator, creates a `Mutation` with UUID, both original and mutated code strings, file, line, status 'pending'.
   - Caps at `maxMutationsPerFile`.
   - Returns mutations sorted by line number.

2. **`runMutationTest(mutation: Mutation): Promise<Mutation>`**
   - Calls `testRunnerFn(mutation.file, mutation.mutatedCode)`.
   - If test failed (mutation caught): sets `status: 'killed'`, `killedByTest` to the failed test name.
   - If test passed (mutation survived): sets `status: 'survived'`.
   - If testRunnerFn throws or exceeds `testTimeoutMs`: sets `status: 'timeout'`.
   - Returns updated mutation.

3. **`runSession(projectId: string, mutations: Mutation[]): Promise<MutationResult>`**
   - Runs `runMutationTest()` for each mutation sequentially.
   - Enforces `maxTotalDurationMs` — stops processing if total time exceeded (marks remaining as 'skipped').
   - For each surviving mutation, calls `suggestTestFn()` to generate a suggested test.
   - Computes `mutationScore`: `killed / (killed + survived)`. Returns 1.0 if no mutations (perfect score by default).
   - Returns `MutationResult` with all stats.

4. **`calculateScore(killed: number, survived: number): number`**
   - Pure function: `killed / (killed + survived)`. Returns 1.0 if both are 0.

5. **`shouldSkipFile(filePath: string): boolean`**
   - Checks filePath against `skipPatterns` using glob matching.
   - Returns true if file should be skipped.

6. **`getOperatorDescription(operator: MutationOperator): { before: string; after: string; description: string }`**
   - Returns human-readable description of each operator.
   - E.g., `'boundary-relax'` → `{ before: '>', after: '>=', description: 'Relaxed boundary check' }`.

### Required Tests (minimum 20)

Write these in `src/testing/mutation-engine.test.ts`:

1. **Generates boundary-relax mutation** — source with `if (x > 5)`, verify mutation to `>=`.
2. **Generates equality-negate mutation** — source with `===`, verify mutation to `!==`.
3. **Generates logical-and-or mutation** — source with `&&`, verify mutation to `||`.
4. **Generates return-null mutation** — source with `return value`, verify mutation to `return null`.
5. **Generates statement-delete mutation** — verify line replaced with empty string.
6. **Generates condition-true mutation** — `if (x > 5)` → `if (true)`.
7. **Generates condition-false mutation** — `if (x > 5)` → `if (false)`.
8. **Caps mutations at max per file** — maxMutationsPerFile: 3, source with 10 applicable lines, verify 3 mutations.
9. **Stores original and mutated code** — verify both strings present and different.
10. **Runs mutation test: killed** — testRunnerFn returns { passed: false }, verify status 'killed'.
11. **Runs mutation test: survived** — testRunnerFn returns { passed: true }, verify status 'survived'.
12. **Runs mutation test: timeout** — testRunnerFn throws, verify status 'timeout'.
13. **Runs session and computes mutation score** — 3 killed, 1 survived → score 0.75.
14. **Enforces total duration limit** — slow testRunnerFn, verify remaining marked 'skipped'.
15. **Generates suggested tests for survivors** — verify suggestTestFn called for each survived mutation.
16. **Calculate score: all killed → 1.0** — verify.
17. **Calculate score: all survived → 0.0** — verify.
18. **Calculate score: no mutations → 1.0** — verify.
19. **Skips test files** — '*.test.ts' in skipPatterns, verify shouldSkipFile returns true.
20. **Does not skip source files** — 'src/foo.ts' not in skipPatterns, verify false.
21. **Operator description returns before/after** — verify all 12 operators have descriptions.

---

## KIMI-TESTING-03: Test Maintenance & Flaky Detection

### Files to Create

- `src/testing/test-maintenance.ts`
- `src/testing/test-maintenance.test.ts`

### Purpose

Tests rot when code changes. Function signatures change and tests don't update. Behavior changes and tests assert the old behavior. Some tests are flaky — they pass sometimes and fail others with no code change. This task automates the detection and management of all three cases: signature changes, semantic drift, and flaky tests.

### Interfaces to Implement

All interfaces must be exported from `src/testing/test-maintenance.ts`:

```typescript
export type ChangeType = 'signature' | 'behavior' | 'deletion';
export type MaintenanceAction = 'auto-updated' | 'manual-review' | 'quarantined' | 'no-action';

export interface TestMaintenance {
  id: string;
  triggeredAt: string;
  changedFile: string;
  changedFunction: string;
  changeType: ChangeType;
  affectedTests: string[];             // test file paths
  autoUpdated: string[];               // tests that were auto-updated
  manualReviewRequired: string[];      // tests that need human review
  flakiesDetected: string[];           // test names flagged as flaky
}

export interface SignatureChange {
  functionName: string;
  filePath: string;
  oldSignature: string;                // e.g., '(a: string, b: number): void'
  newSignature: string;                // e.g., '(a: string, b: number, c?: boolean): void'
  changeDescription: string;           // human-readable: 'Added optional parameter c'
  isSafeToAutoUpdate: boolean;         // only true for new optional params
}

export interface FlakyTest {
  testName: string;
  testFilePath: string;
  failureCount: number;                // failures in last 10 runs
  totalRuns: number;                   // always 10 for the detection window
  failureRate: number;                 // failureCount / totalRuns
  quarantinedAt?: string;
  lastFailureMessage?: string;
}

export interface SemanticDrift {
  functionName: string;
  filePath: string;
  commitMessage?: string;
  isIntentional: boolean;              // inferred from commit message signals
  failingTests: string[];
  recommendation: MaintenanceAction;
}
```

### Class to Implement

```typescript
export class TestMaintenanceManager {
  constructor(
    signatureAnalyzerFn: (oldCode: string, newCode: string) => Promise<SignatureChange[]>,
    config?: { flakinessThreshold?: number; autoUpdateEnabled?: boolean }
  );
}
```

The `signatureAnalyzerFn` compares old and new source code to detect function signature changes. Injected for testability.

Default config:
```typescript
{ flakinessThreshold: 2, autoUpdateEnabled: true }
```

`flakinessThreshold`: a test that fails more than this many times in 10 runs is flaky.

### Functions (all instance methods on `TestMaintenanceManager`)

1. **`detectSignatureChanges(oldCode: string, newCode: string, filePath: string): Promise<SignatureChange[]>`**
   - Calls `signatureAnalyzerFn(oldCode, newCode)`.
   - For each change, determines `isSafeToAutoUpdate`:
     - Safe if: parameter was added AND it has a default value OR is optional (`?`).
     - Unsafe if: parameter was removed, type was changed, or return type changed.
   - Returns the changes with `filePath` set.

2. **`autoUpdateTests(changes: SignatureChange[], testCode: string): { updatedCode: string; updatedTests: string[] }`**
   - For each change where `isSafeToAutoUpdate === true`:
     - Scans `testCode` for calls to the changed function.
     - No action needed (new optional param doesn't break existing calls).
     - Records the test as "auto-updated" (verified compatible).
   - For unsafe changes: records the test as needing manual review.
   - Returns the updated test code (may be unchanged) and lists.

3. **`detectSemanticDrift(functionName: string, filePath: string, failingTests: string[], commitMessage?: string): SemanticDrift`**
   - Infers `isIntentional` from commit message signals:
     - Intentional if commit message contains: 'refactor', 'update', 'change', 'migrate', 'rename', 'redesign'.
     - Unintentional if commit message contains: 'fix', 'hotfix', 'patch', 'revert', or is empty/undefined.
   - If intentional: `recommendation: 'manual-review'` (tests need updating to match new behavior).
   - If unintentional: `recommendation: 'manual-review'` (might be a regression — investigate).
   - Returns the SemanticDrift.

4. **`recordTestRun(testName: string, testFilePath: string, passed: boolean, failureMessage?: string): void`**
   - Records the result in an internal sliding window (last 10 runs per test).
   - Uses `Map<string, { runs: boolean[]; lastFailure?: string }>`.

5. **`detectFlaky(): FlakyTest[]`**
   - Scans all recorded test runs.
   - A test is flaky if `failureCount > flakinessThreshold` within its 10-run window.
   - Returns all flaky tests.

6. **`quarantineFlaky(testName: string): FlakyTest`**
   - Marks the test as quarantined with `quarantinedAt` set to now.
   - Stores in internal flaky list.
   - Returns the updated FlakyTest.
   - Throws if test not found in recorded runs.

7. **`generateMaintenanceReport(filePath: string, signatureChanges: SignatureChange[], semanticDrifts: SemanticDrift[], flakyTests: FlakyTest[]): TestMaintenance`**
   - Creates a comprehensive maintenance report combining all findings.
   - Generates UUID for `id`, sets `triggeredAt` to now.
   - Returns the report.

### Required Tests (minimum 18)

Write these in `src/testing/test-maintenance.test.ts`:

1. **Detects signature changes** — mock analyzerFn, verify changes returned.
2. **Marks optional param addition as safe** — new `c?: boolean`, verify isSafeToAutoUpdate true.
3. **Marks param removal as unsafe** — verify isSafeToAutoUpdate false.
4. **Marks type change as unsafe** — verify isSafeToAutoUpdate false.
5. **Auto-update records safe changes** — verify updatedTests includes the test.
6. **Auto-update records unsafe as manual review** — verify in manualReviewRequired.
7. **Detects intentional drift from commit message** — 'refactor: update handler', verify isIntentional true.
8. **Detects unintentional drift** — 'fix: broken auth', verify isIntentional false.
9. **Empty commit message → unintentional** — verify.
10. **Records test run in sliding window** — record 3 runs, verify internal state.
11. **Detects flaky test exceeding threshold** — 3 failures in 10 runs (threshold 2), verify flagged.
12. **Does not flag stable test** — 1 failure in 10 runs, verify not flagged.
13. **Does not flag consistently failing test** — 10/10 failures → this is broken, not flaky. Verify flagged (it still exceeds threshold).
14. **Quarantines flaky test** — verify quarantinedAt set.
15. **Quarantine throws for unknown test** — expect error.
16. **Generates maintenance report** — verify all fields populated.
17. **Report includes affected tests** — verify affectedTests array.
18. **Report separates auto-updated and manual-review** — verify both arrays populated.
19. **Sliding window caps at 10 runs** — record 15 runs, verify only last 10 considered.
20. **Flaky detection uses correct threshold** — threshold 3, 3 failures → flaky (at threshold).

---

## KIMI-TESTING-04: Test Strategy Generation

### Files to Create

- `src/testing/test-strategy.ts`
- `src/testing/test-strategy.test.ts`

### Purpose

When a new feature is planned (PRD task, code file just written), Nova26 generates a test strategy *before* implementation begins. The strategy specifies test types needed, specific scenarios to cover, mocking strategy, and priority ordering. This transforms testing from an afterthought into a design input.

### Interfaces to Implement

All interfaces must be exported from `src/testing/test-strategy.ts`:

```typescript
export type TestType = 'unit' | 'integration' | 'e2e';
export type ScenarioType = 'happy-path' | 'failure-path' | 'edge-case' | 'integration';
export type ScenarioPriority = 'critical' | 'high' | 'medium' | 'low';

export interface TestScenario {
  id: string;
  type: ScenarioType;
  description: string;                 // one-sentence description
  preconditions: string[];             // what must be true before the test
  assertion: string;                   // what the test asserts
  priority: ScenarioPriority;
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
}

export interface TestStrategy {
  id: string;
  featureDescription: string;
  generatedAt: string;
  generatedBy: string;                 // agent name, typically 'PLUTO'
  testTypes: TestType[];
  estimatedImplementationHours: number;
  scenarios: TestScenario[];
  mockingStrategy: {
    externalServices: string[];        // what to mock
    database: 'real' | 'in-memory' | 'mocked';
    rationale: string;                 // why this mocking approach
  };
  coverageTargets: {
    line: number;                      // target line coverage %
    branch: number;                    // target branch coverage %
    scenario: number;                  // target scenario coverage %
  };
}

export interface StrategyGenerationInput {
  featureDescription: string;
  sourceCode?: string;                 // existing code to analyze
  existingTests?: string;              // existing tests for context
  projectContext?: string;             // additional context
}
```

### Class to Implement

```typescript
export class TestStrategyGenerator {
  constructor(
    strategyFn: (input: StrategyGenerationInput) => Promise<{ scenarios: Array<Omit<TestScenario, 'id'>>; mockingStrategy: TestStrategy['mockingStrategy'] }>,
    config?: { defaultCoverageTarget?: number }
  );
}
```

The `strategyFn` wraps an LLM call that generates test scenarios and mocking strategy from a feature description. Injected for testability.

Default config:
```typescript
{ defaultCoverageTarget: 80 }
```

### Functions (all instance methods on `TestStrategyGenerator`)

1. **`generateStrategy(input: StrategyGenerationInput): Promise<TestStrategy>`**
   - Calls `strategyFn(input)` to get scenarios and mocking strategy.
   - Assigns UUID to each scenario.
   - Determines `testTypes` from scenario types: any 'happy-path' or 'failure-path' → 'unit'; any 'integration' → 'integration'; any 'edge-case' may be either.
   - Estimates `estimatedImplementationHours`: simple=0.25h, moderate=0.5h, complex=1h per scenario.
   - Sets coverage targets to `defaultCoverageTarget` for all three.
   - Returns the strategy with UUID, `generatedAt`, `generatedBy: 'PLUTO'`.

2. **`prioritizeScenarios(scenarios: TestScenario[]): TestScenario[]`**
   - Sorts by priority: critical > high > medium > low.
   - Within same priority, sorts by type: failure-path > happy-path > edge-case > integration.
   - Returns sorted array.

3. **`estimateImplementationTime(scenarios: TestScenario[]): number`**
   - Simple: 0.25 hours. Moderate: 0.5 hours. Complex: 1.0 hours.
   - Returns total hours.

4. **`formatStrategy(strategy: TestStrategy): string`**
   - Formats the strategy as a readable markdown document:
   ```
   # Test Strategy: {featureDescription}
   Generated by PLUTO on {generatedAt}

   ## Test Types: {testTypes}
   ## Estimated Time: {hours}h

   ## Scenarios
   ### Critical
   - [ ] {scenario.description} ({scenario.type})

   ### High
   ...

   ## Mocking Strategy
   - External services: {list}
   - Database: {approach}
   - Rationale: {rationale}

   ## Coverage Targets
   - Line: {target}%
   - Branch: {target}%
   - Scenario: {target}%
   ```

5. **`generateForNewFile(sourceCode: string, filePath: string): Promise<TestStrategy>`**
   - Convenience method: calls `generateStrategy` with sourceCode as context and filePath-derived description.

6. **`listStrategies(): TestStrategy[]`**
   - Returns all generated strategies, sorted by generatedAt descending.

### Required Tests (minimum 16)

Write these in `src/testing/test-strategy.test.ts`:

1. **Generates strategy with scenarios** — mock strategyFn returning 4 scenarios, verify strategy.
2. **Assigns UUID to each scenario** — verify unique IDs.
3. **Determines test types from scenarios** — happy-path → includes 'unit', integration → includes 'integration'.
4. **Estimates implementation time** — 2 simple + 1 complex, verify 1.5 hours.
5. **Sets coverage targets to default** — verify all three at 80.
6. **Sets generatedBy to PLUTO** — verify.
7. **Prioritizes scenarios: critical first** — verify critical before high.
8. **Prioritizes by type within same priority** — failure-path before happy-path.
9. **Formats strategy as markdown** — verify contains "# Test Strategy".
10. **Format includes all sections** — verify Scenarios, Mocking Strategy, Coverage Targets present.
11. **Generates for new file** — pass sourceCode, verify strategy returned.
12. **Lists strategies sorted by date** — generate 2, verify order.
13. **Estimates time: all simple** — 4 simple scenarios, verify 1.0 hours.
14. **Estimates time: all complex** — 3 complex scenarios, verify 3.0 hours.
15. **Empty scenarios → 0 hours** — verify.
16. **Strategy includes mocking rationale** — verify mockingStrategy.rationale is non-empty.

---

## KIMI-TESTING-05: Integration & Wiring

### Files to Modify

- `src/orchestrator/ralph-loop.ts` — **ADD** two new fields to `RalphLoopOptions`

### Files to Create

- `src/testing/autonomous-index.ts`
- `src/testing/autonomous-index.test.ts`

### Purpose

Wire the autonomous testing system into the Ralph Loop. Add `autonomousTestingEnabled` and `testingConfig` to `RalphLoopOptions`. Create the barrel export for the autonomous testing module (named `autonomous-index.ts` to avoid conflict with any existing index file). Write integration tests that verify the full pipeline: analyze → detect gaps → run mutations → maintain → generate strategy.

### Modification to `src/orchestrator/ralph-loop.ts`

Add these two lines to the `RalphLoopOptions` interface, **after** the generative UI fields (after `livePreviewConfig`):

```typescript
  // Autonomous Testing (R16-04)
  autonomousTestingEnabled?: boolean;
  testingConfig?: AutonomousTestingConfig;
```

Add the import at the top of the file:

```typescript
import type { AutonomousTestingConfig } from '../testing/autonomous-index.js';
```

Also define and export the config interface in `autonomous-index.ts`:

```typescript
export interface AutonomousTestingConfig {
  mutationTestingEnabled: boolean;     // default: false (expensive)
  mutationTestingSchedule?: string;    // cron expression; default: '0 0 * * 0' (weekly)
  flakinessThreshold: number;          // failures per 10 runs; default: 2
  testMaintenanceEnabled: boolean;     // default: true
  strategyGenerationEnabled: boolean;  // default: true
  dailyBriefEnabled: boolean;          // default: true
}
```

**That is the ONLY change to ralph-loop.ts.** Do not modify any functions.

### Barrel Export: `src/testing/autonomous-index.ts`

Create a barrel export that re-exports from all new autonomous testing modules:

```typescript
export * from './test-analyzer.js';
export * from './mutation-engine.js';
export * from './test-maintenance.js';
export * from './test-strategy.js';

export interface AutonomousTestingConfig {
  mutationTestingEnabled: boolean;
  mutationTestingSchedule?: string;
  flakinessThreshold: number;
  testMaintenanceEnabled: boolean;
  strategyGenerationEnabled: boolean;
  dailyBriefEnabled: boolean;
}
```

**Do not re-export from `prompt-snapshots.ts`** — that module has its own existing import patterns.

### Integration Tests: `src/testing/autonomous-index.test.ts`

### Required Tests (minimum 15)

1. **Full pipeline: analyze file, detect gaps** — analyze source+test, verify gaps returned.
2. **Full pipeline: analyze then score quality** — verify quality score computed from analysis.
3. **Full pipeline: generate mutations then run session** — verify MutationResult returned.
4. **Full pipeline: mutation survivors get suggested tests** — survived mutation → suggestTestFn called.
5. **Full pipeline: detect signature changes, auto-update** — verify compatible tests marked as auto-updated.
6. **Full pipeline: detect flaky, quarantine** — record runs, detect, quarantine, verify.
7. **Full pipeline: generate test strategy** — feature description → strategy with scenarios.
8. **Full pipeline: generate brief from analysis** — analyze → score → brief, verify recommendation.
9. **Mutation score zero means all survived** — verify score 0.0.
10. **Mutation score one means all killed** — verify score 1.0.
11. **Strategy generation respects coverage target** — verify configured target flows through.
12. **AutonomousTestingConfig type is assignable to RalphLoopOptions.testingConfig** — verify type compatibility.
13. **Barrel export exposes all key types** — import TestAnalyzer, MutationEngine, TestMaintenanceManager, TestStrategyGenerator from autonomous-index, verify defined.
14. **Flaky detection threshold configurable** — set threshold to 5, verify only tests with 6+ failures flagged.
15. **Maintenance report includes all categories** — verify autoUpdated, manualReviewRequired, flakiesDetected all populated.

---

## Final Checklist

After completing all 5 tasks, verify:

```bash
npx tsc --noEmit        # 0 errors
npx vitest run           # 1991+ tests (target: 90+ new = 2081+)
```

New files created:
- `src/testing/test-analyzer.ts`
- `src/testing/test-analyzer.test.ts`
- `src/testing/mutation-engine.ts`
- `src/testing/mutation-engine.test.ts`
- `src/testing/test-maintenance.ts`
- `src/testing/test-maintenance.test.ts`
- `src/testing/test-strategy.ts`
- `src/testing/test-strategy.test.ts`
- `src/testing/autonomous-index.ts`
- `src/testing/autonomous-index.test.ts`

Modified files:
- `src/orchestrator/ralph-loop.ts` (2 new fields + 1 import only)
