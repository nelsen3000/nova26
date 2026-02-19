# KIMI-R17 Mega Sprint: Feature Completion (R17-03 through R17-12)

> Assigned to: Kimi
> Sprint: R17 Feature Completion (post-Autonomous Testing)
> Date issued: 2026-02-19
> Prerequisite: KIMI-TESTING complete (~2081 tests, 0 TS errors)

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
- Autonomous Testing: `src/testing/`
- Dependency Analysis (existing): `src/dependency-analysis/` — do NOT modify
- Recovery (existing): `src/recovery/` — do NOT modify
- Orchestrator (existing): `src/orchestrator/` — only modify `ralph-loop.ts` as instructed in Task 10

**Current state:** ~2081 tests passing, 0 TypeScript errors.

**This sprint creates 10 new feature modules.** Each is an independent system in its own `src/` subdirectory. Tasks are ordered so that cross-module imports work (Task 3 exports `StackFrame` which Task 7 imports).

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
- Target: 2081+ tests passing at end of sprint (aim for 150+ new tests → 2231+).
- All IDs should be generated with `crypto.randomUUID()`.
- All timestamps should be ISO 8601 strings (`new Date().toISOString()`).

---

## KIMI-R17-01: Intelligent Code Review & PR Intelligence

### Files to Create

- `src/review/code-review.ts`
- `src/review/code-review.test.ts`

### Purpose

Nova26 has 21 specialist agents. A code review that routes diffs through multiple agents simultaneously (MARS for backend, VENUS for UI, ENCELADUS for security, SATURN for tests, PLUTO for schemas) produces multi-dimensional feedback no single-lens tool can match. This module implements the review engine, comment structure, deduplication, and summary generation.

### Interfaces to Implement

```typescript
export interface ReviewConfig {
  agents: string[];                  // which agents participate; default: all relevant
  timeoutPerAgentMs: number;         // default: 30000
  totalTimeoutMs: number;            // default: 60000
  includePraise: boolean;            // default: true
  minSeverity: ReviewSeverity;       // default: 'suggestion'
}

export type ReviewSeverity = 'critical' | 'warning' | 'suggestion' | 'praise';
export type ReviewCategory = 'security' | 'performance' | 'style' | 'correctness' | 'accessibility' | 'testing' | 'documentation';

export interface ReviewComment {
  id: string;
  file: string;
  line: number;
  endLine?: number;
  severity: ReviewSeverity;
  category: ReviewCategory;
  message: string;
  suggestedFix?: string;
  agentName: string;
  confidence: number;               // 0-1
}

export interface ReviewSummary {
  reviewId: string;
  projectId: string;
  diffSource: 'staged' | 'pr' | 'commit';
  diffReference: string;            // PR number or commit SHA
  verdict: 'approve' | 'request-changes' | 'comment';
  criticalCount: number;
  warningCount: number;
  suggestionCount: number;
  praiseCount: number;
  comments: ReviewComment[];
  summary: string;                  // 2-3 sentence natural language
  reviewedAt: string;
  durationMs: number;
  agentsUsed: string[];
}
```

### Class to Implement

```typescript
export class CodeReviewEngine {
  constructor(config?: Partial<ReviewConfig>);
}
```

Default config:
```typescript
const DEFAULT_CONFIG: ReviewConfig = {
  agents: [],                        // empty = auto-detect from diff
  timeoutPerAgentMs: 30000,
  totalTimeoutMs: 60000,
  includePraise: true,
  minSeverity: 'suggestion',
};
```

### Functions

1. **`routeToAgents(diff: string): Map<string, string[]>`**
   - Parses the diff to extract file paths. Routes files to agents based on extension/path:
     - `.ts` backend files → `'MARS'`
     - `.tsx` / `.css` / `.scss` files → `'VENUS'`
     - Any file → `'ENCELADUS'` (security scan)
     - `*.test.*` / `*.spec.*` files → `'SATURN'`
     - `schema.*` / `*.schema.*` / `convex/` files → `'PLUTO'`
     - Config files (`.env`, `*.config.*`, `tsconfig.*`) → `'TRITON'`
   - Returns Map where key = agent name, value = array of file paths.
   - If `config.agents` is non-empty, filter to only those agents.

2. **`parseReviewComments(agentResponse: string, agentName: string, file: string): ReviewComment[]`**
   - Parses an agent's review response into structured `ReviewComment` objects.
   - Each comment gets a `crypto.randomUUID()` id.
   - Extracts line numbers, severity, category, and message from the response text.
   - Uses simple parsing: lines starting with `[CRITICAL]`, `[WARNING]`, `[SUGGESTION]`, or `[PRAISE]` followed by `L<number>:` for line reference.

3. **`deduplicateComments(comments: ReviewComment[]): ReviewComment[]`**
   - Removes duplicate comments that reference the same file+line+category from different agents.
   - Keeps the comment with the higher confidence score.

4. **`filterBySeverity(comments: ReviewComment[], minSeverity: ReviewSeverity): ReviewComment[]`**
   - Filters comments to only include those at or above the minimum severity.
   - Severity order: critical > warning > suggestion > praise.
   - Praise is always included if `config.includePraise` is true.

5. **`generateSummary(comments: ReviewComment[], diffSource: ReviewSummary['diffSource'], diffReference: string, projectId: string, durationMs: number): ReviewSummary`**
   - Aggregates comments into a `ReviewSummary`.
   - Verdict logic: if `criticalCount > 0` → `'request-changes'`; if `warningCount > 0` → `'comment'`; else → `'approve'`.
   - Summary string: `"<criticalCount> critical, <warningCount> warnings, <suggestionCount> suggestions across <fileCount> files."`.
   - Collects unique agent names into `agentsUsed`.

6. **`reviewDiff(diff: string, source: ReviewSummary['diffSource'], reference: string, projectId: string, agentCaller: (agent: string, prompt: string) => Promise<string>): Promise<ReviewSummary>`**
   - Full review pipeline: route → call agents → parse → deduplicate → filter → summarize.
   - Calls `agentCaller` for each agent with the relevant file diffs.
   - Measures total duration.

### Required Tests (minimum 15)

1. **Routes .ts files to MARS** — diff with `src/foo.ts`, verify MARS in routing map.
2. **Routes .tsx files to VENUS** — diff with `src/Bar.tsx`, verify VENUS.
3. **Routes all files to ENCELADUS** — any diff file appears in ENCELADUS routing.
4. **Routes test files to SATURN** — diff with `foo.test.ts`, verify SATURN.
5. **Routes schema files to PLUTO** — diff with `convex/schema.ts`, verify PLUTO.
6. **Routes config files to TRITON** — diff with `tsconfig.json`, verify TRITON.
7. **Multi-file diff routes to multiple agents** — diff with .ts + .tsx + .test.ts → MARS, VENUS, SATURN, ENCELADUS.
8. **Respects agents filter in config** — set `agents: ['MARS']`, verify only MARS in results.
9. **Parses review comments from response** — agent response with `[CRITICAL] L10: issue` → ReviewComment with correct fields.
10. **Deduplicates overlapping comments** — two comments on same file+line+category, keeps higher confidence.
11. **Filters by minSeverity** — set `'warning'`, verify suggestions excluded, criticals included.
12. **Verdict request-changes when criticals exist** — 1 critical → request-changes.
13. **Verdict approve when no criticals or warnings** — only suggestions → approve.
14. **Summary counts correct** — 2 critical + 3 warning → criticalCount=2, warningCount=3.
15. **reviewDiff calls agentCaller for each routed agent** — mock agentCaller, verify called per agent.

---

## KIMI-R17-02: Codebase Migration & Framework Upgrade Engine

### Files to Create

- `src/migrate/migration-engine.ts`
- `src/migrate/migration-engine.test.ts`

### Purpose

Framework migrations (React 18→19, Express→Fastify, Prisma→Drizzle) involve hundreds of small incompatibilities. This module generates ordered migration plans with risk scoring, executes steps incrementally with rollback support, and persists state so migrations can be paused/resumed across sessions.

### Interfaces to Implement

```typescript
export type MigrationStatus = 'planning' | 'in-progress' | 'paused' | 'completed' | 'rolled-back';

export interface MigrationPlan {
  id: string;
  projectId: string;
  source: { framework: string; version: string };
  target: { framework: string; version: string };
  steps: MigrationStep[];
  estimatedDurationMinutes: number;
  riskLevel: 'low' | 'medium' | 'high';
  status: MigrationStatus;
  createdAt: string;
  completedAt?: string;
}

export interface MigrationStep {
  id: string;
  order: number;
  description: string;
  affectedFiles: string[];
  transform: MigrationTransform;
  testCommand?: string;
  rollbackCommand?: string;
  status: 'pending' | 'completed' | 'failed' | 'rolled-back';
  riskScore: number;                // 0-100
}

export interface MigrationTransform {
  type: 'import-rewrite' | 'api-change' | 'config-update' | 'file-rename' | 'ast-transform' | 'dependency-swap';
  pattern: string;                  // what to look for
  replacement: string;              // what to replace with
  fileGlob: string;                 // which files to apply to
}

export interface MigrationState {
  migrationId: string;
  currentStep: number;
  completedSteps: string[];
  failedSteps: string[];
  rollbackStack: string[];          // step IDs that can be rolled back, LIFO
  pausedAt?: string;
  resumedAt?: string;
}

export interface MigrationConfig {
  stateDir: string;                 // default: '.nova/migrations'
  autoRollbackOnFailure: boolean;   // default: true
  maxStepsPerRun: number;           // default: 10
}
```

### Class to Implement

```typescript
export class MigrationEngine {
  constructor(config?: Partial<MigrationConfig>);
}
```

Default config:
```typescript
const DEFAULT_CONFIG: MigrationConfig = {
  stateDir: '.nova/migrations',
  autoRollbackOnFailure: true,
  maxStepsPerRun: 10,
};
```

### Functions

1. **`createPlan(source: MigrationPlan['source'], target: MigrationPlan['target'], projectId: string, affectedFiles: string[]): MigrationPlan`**
   - Creates a new `MigrationPlan` with `crypto.randomUUID()` id.
   - Generates steps based on the source→target migration. Each step creates a `MigrationTransform`.
   - Sets `riskLevel` based on max step risk: max < 30 → low, max < 70 → medium, else high.
   - Sets `estimatedDurationMinutes` as `steps.length * 5`.
   - Status starts as `'planning'`.

2. **`matchFiles(transform: MigrationTransform, files: string[]): string[]`**
   - Matches files against `transform.fileGlob` using simple glob matching (supports `*` and `**`).
   - Returns array of matching file paths.

3. **`executeStep(plan: MigrationPlan, stepId: string, fileApplier: (file: string, pattern: string, replacement: string) => boolean): MigrationStep`**
   - Finds the step by ID. Calls `fileApplier` for each affected file.
   - If all files succeed: marks step `'completed'`, adds to state rollback stack.
   - If any file fails: marks step `'failed'`. If `autoRollbackOnFailure`, calls `rollbackStep`.
   - Updates plan status to `'in-progress'` if not already.
   - Returns the updated step.

4. **`rollbackStep(plan: MigrationPlan, stepId: string): MigrationStep`**
   - Reverts a completed step to `'rolled-back'`.
   - Removes from rollback stack.
   - Returns the updated step.

5. **`getState(plan: MigrationPlan): MigrationState`**
   - Builds a `MigrationState` from the current plan.
   - `currentStep` = index of first pending step.
   - `completedSteps` = IDs of completed steps.
   - `failedSteps` = IDs of failed steps.
   - `rollbackStack` = IDs of completed steps in reverse order (LIFO).

6. **`pausePlan(plan: MigrationPlan): MigrationPlan`**
   - Sets status to `'paused'`. Records `pausedAt` timestamp in state.

7. **`resumePlan(plan: MigrationPlan): MigrationPlan`**
   - Sets status to `'in-progress'`. Records `resumedAt` timestamp in state.

### Required Tests (minimum 15)

1. **Creates plan with correct source and target** — verify source/target match input.
2. **Plan gets unique ID** — verify `crypto.randomUUID()` format.
3. **Plan starts in planning status** — verify status is `'planning'`.
4. **Risk level low when max step risk < 30** — all steps risk < 30 → `'low'`.
5. **Risk level high when max step risk >= 70** — one step risk 80 → `'high'`.
6. **Estimated duration is steps × 5** — 3 steps → 15 minutes.
7. **matchFiles matches glob pattern** — `'*.ts'` matches `foo.ts` but not `foo.js`.
8. **matchFiles handles ** glob** — `'src/**/*.ts'` matches nested paths.
9. **executeStep marks completed on success** — fileApplier returns true → step completed.
10. **executeStep marks failed on failure** — fileApplier returns false → step failed.
11. **executeStep updates plan to in-progress** — verify plan status changes.
12. **rollbackStep marks step as rolled-back** — verify status change.
13. **getState returns correct currentStep** — first 2 completed, third pending → currentStep=2.
14. **getState rollbackStack is LIFO** — completed steps 1,2,3 → rollback [3,2,1].
15. **pausePlan sets status and timestamp** — verify `'paused'` status and `pausedAt` set.

---

## KIMI-R17-03: Advanced Debugging & Root Cause Analysis

### Files to Create

- `src/debug/debug-engine.ts`
- `src/debug/debug-engine.test.ts`

### Purpose

When a bug is reported, most developers stare at the error message. This module traces the full call chain from error to root cause, parsing stack traces, reading source context, identifying the divergence point where actual behavior diverged from expected, and proposing specific code fixes with regression tests. The `StackFrame` interface exported here is also used by the Production Feedback module (Task 7).

### Interfaces to Implement

```typescript
export type ErrorSource = 'stack-trace' | 'description' | 'test-failure' | 'runtime-log';
export type FixConfidence = 'high' | 'medium' | 'low';

export interface DebugSession {
  id: string;
  projectId: string;
  errorSource: ErrorSource;
  rawInput: string;
  parsedError: ParsedError;
  rootCause: RootCauseAnalysis | undefined;
  fixProposals: FixProposal[];
  startedAt: string;
  completedAt?: string;
}

export interface ParsedError {
  message: string;
  type: string;                     // e.g., 'TypeError', 'ReferenceError'
  stackFrames: StackFrame[];
  file?: string;
  line?: number;
}

export interface StackFrame {
  functionName: string;
  filePath: string;
  line: number;
  column: number;
  sourcePreview?: string;           // 3 lines of context around the error
}

export interface RootCauseAnalysis {
  symptom: string;                  // what the user sees
  intermediateCauses: string[];     // chain of events
  rootCause: string;                // the actual underlying problem
  divergencePoint: {
    file: string;
    line: number;
    expected: string;               // what should have happened
    actual: string;                 // what actually happened
  };
  confidence: number;               // 0-1
  relatedFiles: string[];
}

export interface FixProposal {
  id: string;
  description: string;
  file: string;
  diff: string;                     // unified diff format
  confidence: FixConfidence;
  regressionTest: string;           // generated test code
  regressionTestFile: string;       // where to save the test
}

export interface DebugConfig {
  maxSessionHistory: number;        // default: 50
  autoFixThreshold: FixConfidence;  // default: 'high'
}
```

### Class to Implement

```typescript
export class DebugEngine {
  constructor(config?: Partial<DebugConfig>);
}
```

Default config:
```typescript
const DEFAULT_CONFIG: DebugConfig = {
  maxSessionHistory: 50,
  autoFixThreshold: 'high',
};
```

### Functions

1. **`parseStackTrace(trace: string): StackFrame[]`**
   - Parses V8-style stack traces: `at functionName (filePath:line:column)` or `at filePath:line:column`.
   - Handles anonymous functions (sets `functionName: '<anonymous>'`).
   - Returns array of `StackFrame` objects. Empty array if no frames parsed.

2. **`parseError(rawInput: string, source: ErrorSource): ParsedError`**
   - For `'stack-trace'`: extracts error type and message from first line (e.g., `TypeError: Cannot read...`), then calls `parseStackTrace` for the rest.
   - For `'description'`: sets `type: 'Unknown'`, `message` = rawInput, empty `stackFrames`.
   - For `'test-failure'`: looks for `FAIL` or `Error:` patterns, extracts file/line if present.
   - For `'runtime-log'`: looks for `[ERROR]` or `Error:` patterns.
   - Sets `file` and `line` from the first stack frame if available.

3. **`analyzeRootCause(parsedError: ParsedError, fileReader: (path: string) => string | undefined): RootCauseAnalysis`**
   - Reads source files referenced in the stack frames using `fileReader`.
   - Identifies the divergence point: the earliest frame where the code's intent (inferred from function name and context) diverges from the error condition.
   - Sets `symptom` from the error message.
   - Populates `intermediateCauses` from the call chain.
   - Sets `rootCause` as a natural-language description.
   - `confidence` is 0.9 if source is available, 0.5 if not.

4. **`generateFix(rootCause: RootCauseAnalysis): FixProposal[]`**
   - Generates one `FixProposal` per divergence point.
   - `diff` is a simple unified diff format showing the change.
   - `regressionTest` is a vitest test that would catch the original error.
   - `confidence` is `'high'` if root cause confidence >= 0.8, `'medium'` if >= 0.5, else `'low'`.

5. **`createSession(rawInput: string, source: ErrorSource, projectId: string): DebugSession`**
   - Creates a new session with `crypto.randomUUID()` id.
   - Calls `parseError` internally. Sets `rootCause` to `undefined` (populated later).
   - Sets `startedAt` to now.

6. **`getSessionHistory(): DebugSession[]`**
   - Returns stored sessions, limited by `config.maxSessionHistory`.
   - Most recent first.

### Required Tests (minimum 15)

1. **Parses TypeError from stack trace** — input `TypeError: Cannot read property 'x'`, verify type and message.
2. **Parses V8 stack frames** — input `at foo (/src/bar.ts:10:5)`, verify functionName, filePath, line, column.
3. **Handles anonymous function frames** — `at /src/bar.ts:10:5` → functionName `'<anonymous>'`.
4. **Handles empty stack trace** — returns empty stackFrames array.
5. **parseError with description source** — sets type `'Unknown'`, message = input.
6. **parseError with test-failure source** — extracts file and line from FAIL output.
7. **parseError sets file and line from first frame** — verify top frame populates ParsedError.file/line.
8. **Root cause analysis identifies divergence point** — fileReader returns source, verify divergencePoint.file set.
9. **Root cause confidence high when source available** — confidence >= 0.8.
10. **Root cause confidence low when source unavailable** — fileReader returns undefined, confidence <= 0.6.
11. **Root cause lists intermediate causes** — multiple frames → multiple intermediateCauses.
12. **generateFix produces proposal with diff** — verify diff is non-empty string.
13. **generateFix includes regression test** — verify regressionTest contains `describe` or `it`.
14. **Fix confidence matches root cause confidence** — high root cause → high fix confidence.
15. **createSession assigns unique ID** — verify UUID format on session.id.

---

## KIMI-R17-04: Accessibility Compliance & WCAG Engine

### Files to Create

- `src/a11y/a11y-engine.ts`
- `src/a11y/a11y-engine.test.ts`

### Purpose

Accessibility is not an afterthought — it is a first-class design dimension. This module implements a WCAG 2.2 rule engine that scans TSX/JSX for violations (missing alt text, missing aria labels, click handlers without keyboard equivalents), computes a compliance score, and proposes auto-fixes. VENUS uses this to ensure all generated UI is accessible by default.

### Interfaces to Implement

```typescript
export type WCAGLevel = 'A' | 'AA' | 'AAA';
export type ViolationSeverity = 'critical' | 'serious' | 'moderate' | 'minor';

export interface WCAGRule {
  id: string;                       // e.g., '1.1.1'
  name: string;                     // e.g., 'Non-text Content'
  level: WCAGLevel;
  description: string;
  checkType: 'static' | 'dynamic' | 'both';
}

export interface AccessibilityViolation {
  id: string;
  ruleId: string;
  ruleName: string;
  level: WCAGLevel;
  severity: ViolationSeverity;
  file: string;
  line: number;
  element: string;                  // e.g., '<img src="logo.png">'
  message: string;
  suggestedFix: string;
  autoFixAvailable: boolean;
}

export interface AccessibilityReport {
  reportId: string;
  projectId: string;
  scannedAt: string;
  filesScanned: number;
  componentsScanned: number;
  violations: AccessibilityViolation[];
  score: number;                    // 0-100
  levelACompliance: number;         // percentage 0-100
  levelAACompliance: number;        // percentage 0-100
  summary: string;
}

export interface AccessibilityConfig {
  targetLevel: WCAGLevel;           // default: 'AA'
  autoFixEnabled: boolean;          // default: false
  scanOnBuild: boolean;             // default: true
  excludePatterns: string[];        // file patterns to skip
}
```

### Class to Implement

```typescript
export class AccessibilityEngine {
  constructor(config?: Partial<AccessibilityConfig>);
}
```

Default config:
```typescript
const DEFAULT_CONFIG: AccessibilityConfig = {
  targetLevel: 'AA',
  autoFixEnabled: false,
  scanOnBuild: true,
  excludePatterns: [],
};
```

### Functions

1. **`getRules(level?: WCAGLevel): WCAGRule[]`**
   - Returns built-in WCAG rules. If `level` provided, returns only rules at or below that level (A ⊂ AA ⊂ AAA).
   - Must include at least these rules:
     - `'1.1.1'` Non-text Content (A) — images need alt text
     - `'1.3.1'` Info and Relationships (A) — form labels
     - `'2.1.1'` Keyboard (A) — all functionality via keyboard
     - `'2.4.7'` Focus Visible (AA) — focus indicator visible
     - `'4.1.2'` Name, Role, Value (A) — aria attributes on interactive elements

2. **`scanFile(filePath: string, content: string): AccessibilityViolation[]`**
   - Scans file content for accessibility violations using static analysis:
     - `<img` tags without `alt` attribute → rule 1.1.1
     - `<button` / `<a` / interactive elements without `aria-label` or visible text → rule 4.1.2
     - `onClick` handler without corresponding `onKeyDown` or `onKeyUp` → rule 2.1.1
     - `<input` without associated `<label` or `aria-label` → rule 1.3.1
   - Each violation gets `crypto.randomUUID()` id.
   - Sets `autoFixAvailable: true` for missing alt text and missing keyboard handlers.

3. **`computeScore(violations: AccessibilityViolation[], totalElements: number): number`**
   - Score = `Math.max(0, 100 - (violations.length / Math.max(totalElements, 1)) * 100)`.
   - Returns integer 0-100. `Math.round()`.

4. **`computeCompliance(violations: AccessibilityViolation[], rules: WCAGRule[], level: WCAGLevel): number`**
   - Compliance = percentage of rules at this level that have zero violations.
   - Returns 0-100.

5. **`suggestFix(violation: AccessibilityViolation): string`**
   - Returns a code snippet showing the fix:
     - Missing alt: `<img src="..." alt="descriptive text" />`
     - Missing keyboard handler: add `onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}`
     - Missing aria-label: add `aria-label="..."` attribute
     - Missing label: add `<label htmlFor="...">` element

6. **`scanProject(files: Array<{ path: string; content: string }>, projectId: string): AccessibilityReport`**
   - Scans all files, aggregates violations, computes score and compliance.
   - Filters files against `config.excludePatterns`.
   - `componentsScanned` = count of files containing JSX/TSX (files with `<` followed by a capital letter).

### Required Tests (minimum 15)

1. **getRules returns Level A rules** — at least 4 A-level rules returned.
2. **getRules with AA includes A rules** — AA filter returns A + AA rules.
3. **Detects missing alt text on img** — `<img src="x" />` → violation for rule 1.1.1.
4. **No violation for img with alt** — `<img src="x" alt="logo" />` → no violation.
5. **Detects onClick without onKeyDown** — `<div onClick={fn}>` → violation for rule 2.1.1.
6. **No violation when both onClick and onKeyDown** — verify clean scan.
7. **Detects input without label** — `<input type="text" />` → violation for rule 1.3.1.
8. **Detects interactive element without aria-label** — `<button />` with no text/aria → violation.
9. **suggestFix returns alt text fix** — violation for 1.1.1 → fix contains `alt=`.
10. **suggestFix returns keyboard handler fix** — violation for 2.1.1 → fix contains `onKeyDown`.
11. **Score 100 for zero violations** — 0 violations, 10 elements → score 100.
12. **Score decreases with more violations** — 5 violations, 10 elements → score ≤ 50.
13. **Compliance 100 when no rules violated** — all rules clean → 100.
14. **Report includes correct file count** — 3 files scanned → `filesScanned: 3`.
15. **Respects excludePatterns** — pattern `'*.test.tsx'` excludes test files from scan.

---

## KIMI-R17-05: Technical Debt Scoring & Automated Remediation

### Files to Create

- `src/debt/debt-scorer.ts`
- `src/debt/debt-scorer.test.ts`

### Purpose

Technical debt is always described vaguely. This module quantifies it: cyclomatic complexity, code duplication, TODO/FIXME/HACK density, `as any` / `@ts-ignore` usage, and outdated patterns. Each file gets a debt score (0-100, lower = less debt). The project gets a letter grade. Trends are tracked daily so teams can see whether debt is growing or shrinking.

### Interfaces to Implement

```typescript
export interface DebtDimension {
  name: string;
  weight: number;                   // 0-1, all weights sum to 1
  score: number;                    // 0-100 (0 = no debt)
  items: DebtItem[];
}

export interface DebtItem {
  id: string;
  dimension: string;
  file: string;
  line: number;
  description: string;
  severity: 'high' | 'medium' | 'low';
  autoFixAvailable: boolean;
  estimatedFixMinutes: number;
}

export interface DebtReport {
  reportId: string;
  projectId: string;
  computedAt: string;
  overallScore: number;             // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: DebtDimension[];
  topItems: DebtItem[];             // top 10 highest-impact items
  trend: DebtTrend;
  summary: string;
}

export interface DebtTrend {
  dataPoints: Array<{ date: string; score: number }>;
  direction: 'improving' | 'stable' | 'worsening';
  changeRate: number;               // score change per day (negative = improving)
}

export interface DebtConfig {
  computeOnBuild: boolean;          // default: true
  trendHistoryDays: number;         // default: 90
  complexityThreshold: number;      // default: 10 (cyclomatic complexity per function)
  nestingThreshold: number;         // default: 4
}
```

### Class to Implement

```typescript
export class DebtScorer {
  constructor(config?: Partial<DebtConfig>);
}
```

Default config:
```typescript
const DEFAULT_CONFIG: DebtConfig = {
  computeOnBuild: true,
  trendHistoryDays: 90,
  complexityThreshold: 10,
  nestingThreshold: 4,
};
```

### Functions

1. **`analyzeFile(filePath: string, content: string): DebtItem[]`**
   - Runs all detectors on the file and returns combined debt items.
   - Calls `detectComplexity`, `detectTodoHacks`, `detectTypeSafetyGaps` internally.

2. **`detectComplexity(content: string, filePath: string): DebtItem[]`**
   - Counts branching statements (`if`, `else if`, `case`, `for`, `while`, `&&`, `||`, `? :`) per function.
   - Functions exceeding `config.complexityThreshold` produce a debt item with severity `'high'`.
   - Counts nesting depth (indentation-based heuristic). Depth > `config.nestingThreshold` → `'medium'`.

3. **`detectTodoHacks(content: string, filePath: string): DebtItem[]`**
   - Finds `// TODO`, `// FIXME`, `// HACK`, `// XXX` comments.
   - `HACK` and `FIXME` → severity `'medium'`. `TODO` and `XXX` → severity `'low'`.
   - `autoFixAvailable: false` for all.
   - `estimatedFixMinutes: 15` for HACK/FIXME, `10` for TODO/XXX.

4. **`detectTypeSafetyGaps(content: string, filePath: string): DebtItem[]`**
   - Finds `as any`, `@ts-ignore`, `@ts-expect-error`, and `// eslint-disable` comments.
   - `as any` → severity `'high'`, `autoFixAvailable: true`, `estimatedFixMinutes: 10`.
   - `@ts-ignore` → severity `'high'`, `autoFixAvailable: false`, `estimatedFixMinutes: 15`.

5. **`computeDimensions(items: DebtItem[]): DebtDimension[]`**
   - Groups items by dimension name. Computes weighted scores:
     - `'complexity'` weight 0.30
     - `'type-safety'` weight 0.25
     - `'todo-hacks'` weight 0.15
     - `'duplication'` weight 0.15
     - `'dependencies'` weight 0.15
   - Dimension score = `Math.min(100, items.length * 10)` for that dimension.

6. **`computeGrade(score: number): DebtReport['grade']`**
   - A: 0-20, B: 21-40, C: 41-60, D: 61-80, F: 81-100.

7. **`computeTrend(dataPoints: Array<{ date: string; score: number }>): DebtTrend`**
   - Direction: if last 3 scores decreasing → `'improving'`; increasing → `'worsening'`; else `'stable'`.
   - `changeRate` = (latest score - oldest score) / number of days between them.

8. **`generateReport(projectId: string, items: DebtItem[], trendHistory: Array<{ date: string; score: number }>): DebtReport`**
   - Assembles full report with dimensions, grade, top 10 items (sorted by severity desc), trend, and summary.

### Required Tests (minimum 15)

1. **Detects TODO comment** — `// TODO: fix this` → debt item with dimension `'todo-hacks'`.
2. **Detects FIXME comment** — `// FIXME: broken` → severity `'medium'`.
3. **Detects HACK comment** — `// HACK: workaround` → severity `'medium'`.
4. **Detects as any** — `const x = foo as any;` → severity `'high'`, autoFixAvailable true.
5. **Detects @ts-ignore** — `// @ts-ignore` → severity `'high'`.
6. **Detects high complexity** — function with 12 if/else → debt item for complexity.
7. **No complexity item below threshold** — function with 3 branches, threshold 10 → no item.
8. **Grade A for score 0-20** — verify computeGrade(15) returns 'A'.
9. **Grade F for score 81-100** — verify computeGrade(90) returns 'F'.
10. **Dimension weights sum to 1.0** — verify all weights add up.
11. **Top items sorted by severity** — high before medium before low.
12. **Trend improving when scores decrease** — [50, 40, 30] → `'improving'`.
13. **Trend worsening when scores increase** — [30, 40, 50] → `'worsening'`.
14. **Trend stable when scores constant** — [40, 40, 40] → `'stable'`.
15. **Empty file produces zero debt items** — empty string → empty array.

---

## KIMI-R17-06: Smart Dependency Management & Supply Chain Security

### Files to Create

- `src/deps/dependency-manager.ts`
- `src/deps/dependency-manager.test.ts`

### Purpose

Dependencies are ingredients — most developers cook with whatever `npm install` put in the pantry months ago. This module checks every dependency for version currency, maintenance status, known vulnerabilities, license compatibility, and supply chain risks (typosquatting, abandoned packages, install scripts). It generates update recommendations grouped by urgency and related packages.

### Interfaces to Implement

```typescript
export type UpdateUrgency = 'critical' | 'recommended' | 'optional';

export interface DependencyHealth {
  name: string;
  currentVersion: string;
  latestVersion: string;
  versionsBehind: { major: number; minor: number; patch: number };
  lastPublished: string;            // ISO date
  weeklyDownloads: number;
  maintainerCount: number;
  openIssues: number;
  knownVulnerabilities: Vulnerability[];
  license: string;
  licenseCompatible: boolean;
  bundleSizeKb: number;
  healthScore: number;              // 0-100
}

export interface Vulnerability {
  id: string;                       // CVE ID
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  fixedInVersion?: string;
  patchAvailable: boolean;
}

export interface UpdateRecommendation {
  dependency: string;
  fromVersion: string;
  toVersion: string;
  urgency: UpdateUrgency;
  breakingChanges: string[];
  changelogSummary: string;
  riskScore: number;                // 0-100
  relatedUpdates: string[];         // other deps that should update together
}

export interface DependencyReport {
  reportId: string;
  projectId: string;
  scannedAt: string;
  totalDependencies: number;
  healthyCount: number;
  atRiskCount: number;
  criticalCount: number;
  dependencies: DependencyHealth[];
  recommendations: UpdateRecommendation[];
  supplyChainAlerts: SupplyChainAlert[];
  overallScore: number;             // 0-100
}

export interface SupplyChainAlert {
  id: string;
  type: 'typosquat' | 'new-maintainer' | 'install-script' | 'abandoned' | 'deprecated';
  dependency: string;
  description: string;
  severity: 'critical' | 'warning';
  recommendation: string;
}

export interface DependencyConfig {
  scanOnBuild: boolean;             // default: true
  autoUpdatePatch: boolean;         // default: false
  supplyChainChecks: boolean;       // default: true
  abandonedThresholdDays: number;   // default: 365
}
```

### Class to Implement

```typescript
export class DependencyManager {
  constructor(config?: Partial<DependencyConfig>);
}
```

Default config:
```typescript
const DEFAULT_CONFIG: DependencyConfig = {
  scanOnBuild: true,
  autoUpdatePatch: false,
  supplyChainChecks: true,
  abandonedThresholdDays: 365,
};
```

### Functions

1. **`parseDependencies(packageJson: Record<string, unknown>): Array<{ name: string; version: string; isDev: boolean }>`**
   - Extracts dependencies from `dependencies` and `devDependencies` fields.
   - Strips version prefixes (`^`, `~`, `>=`).
   - Returns flat array with `isDev` flag.

2. **`computeHealth(dep: { name: string; currentVersion: string; latestVersion: string; lastPublished: string; maintainerCount: number; weeklyDownloads: number; vulnerabilities: Vulnerability[] }): DependencyHealth`**
   - Computes `versionsBehind` by comparing semver components.
   - `healthScore` starts at 100, deducted: -20 per major behind, -5 per minor behind, -1 per patch behind, -30 per critical vuln, -15 per high vuln, -10 if `maintainerCount < 2`, -10 if `lastPublished` > 1 year ago. Clamped to 0-100.

3. **`generateRecommendations(deps: DependencyHealth[]): UpdateRecommendation[]`**
   - For each dep that is behind: creates an `UpdateRecommendation`.
   - Urgency: `'critical'` if has critical/high vulns; `'recommended'` if major version behind; `'optional'` otherwise.
   - `riskScore` = 10 for patch, 30 for minor, 70 for major updates.
   - `relatedUpdates` groups packages with matching prefixes (e.g., `@react/` packages together).

4. **`detectSupplyChainRisks(deps: DependencyHealth[]): SupplyChainAlert[]`**
   - `'abandoned'`: `lastPublished` > `config.abandonedThresholdDays` ago.
   - `'typosquat'`: name differs from popular packages by 1-2 characters (check against a small built-in list of popular packages: `react`, `express`, `lodash`, `axios`, `next`, `vue`, `angular`, `typescript`).
   - Each alert gets `crypto.randomUUID()` id.

5. **`generateReport(projectId: string, deps: DependencyHealth[], alerts: SupplyChainAlert[]): DependencyReport`**
   - Assembles full report. `healthyCount` = deps with score >= 80. `atRiskCount` = score 40-79. `criticalCount` = score < 40.
   - `overallScore` = average of all dependency health scores.

### Required Tests (minimum 15)

1. **Parses dependencies from package.json** — `{"dependencies":{"react":"^18.0.0"}}` → name=react, version=18.0.0.
2. **Strips version prefixes** — `~1.2.3` → `1.2.3`, `>=2.0.0` → `2.0.0`.
3. **Identifies devDependencies** — devDependencies entries have `isDev: true`.
4. **Computes versions behind for major** — current 1.0.0, latest 3.0.0 → major: 2.
5. **Health score 100 for up-to-date dep** — latest version, no vulns, active → 100.
6. **Health score decreases for outdated dep** — 2 majors behind → score ≤ 60.
7. **Health score decreases for critical vulns** — 1 critical vuln → score ≤ 70.
8. **Critical urgency for deps with critical vulns** — verify urgency.
9. **Optional urgency for patch-only updates** — only patches behind → `'optional'`.
10. **Groups related updates** — `@react/core` and `@react/dom` grouped.
11. **Detects abandoned packages** — lastPublished 2 years ago → abandoned alert.
12. **Detects typosquat names** — `reacct` (close to `react`) → typosquat alert.
13. **No typosquat for legitimate names** — `my-custom-lib` → no typosquat alert.
14. **Report counts healthy vs at-risk** — 3 healthy + 2 at-risk → healthyCount=3, atRiskCount=2.
15. **Overall score is average of dep scores** — scores [80, 60, 100] → overall 80.

---

## KIMI-R17-07: Production Feedback Loop & Error Intelligence

### Files to Create

- `src/prod-feedback/prod-feedback.ts`
- `src/prod-feedback/prod-feedback.test.ts`

### Purpose

The feedback loop from production to development is broken in most organizations. This module ingests production errors from Sentry, log files, or manual input, normalizes them, attributes errors to specific commits via git blame, assesses impact (frequency, user count, severity), and recommends action (hotfix-now, fix-next-sprint, monitor, ignore).

**Cross-module dependency:** This module imports `StackFrame` from `src/debug/debug-engine.ts` (Task 3). Ensure Task 3 is completed first.

### Interfaces to Implement

```typescript
import type { StackFrame } from '../debug/debug-engine.js';

export type ErrorSeverityLevel = 'fatal' | 'error' | 'warning' | 'info';

export interface ProductionError {
  id: string;
  source: 'sentry' | 'log' | 'webhook' | 'manual';
  message: string;
  type: string;
  stackTrace?: string;
  parsedFrames: StackFrame[];
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  affectedUsers: number;
  severity: ErrorSeverityLevel;
  environment: string;              // 'production', 'staging', etc.
  metadata: Record<string, unknown>;
}

export interface CommitAttribution {
  errorId: string;
  file: string;
  line: number;
  commitSha: string;
  commitMessage: string;
  author: string;
  committedAt: string;
  deployedAt?: string;
  timeSinceDeploy?: number;         // hours
}

export interface ProductionImpact {
  errorId: string;
  frequency: 'increasing' | 'stable' | 'decreasing';
  occurrencesLast24h: number;
  occurrencesLast7d: number;
  uniqueUsers: number;
  impactScore: number;              // 0-100
  recommendation: 'hotfix-now' | 'fix-next-sprint' | 'monitor' | 'ignore';
}

export interface ProductionFeedbackConfig {
  webhookPort: number;              // default: 5275
  sentryDsn?: string;
  logPaths: string[];               // default: []
  autoHotfix: boolean;              // default: false
  impactThreshold: number;          // auto-escalate above this score; default: 70
}
```

### Class to Implement

```typescript
export class ProductionFeedbackEngine {
  constructor(config?: Partial<ProductionFeedbackConfig>);
}
```

Default config:
```typescript
const DEFAULT_CONFIG: ProductionFeedbackConfig = {
  webhookPort: 5275,
  logPaths: [],
  autoHotfix: false,
  impactThreshold: 70,
};
```

### Functions

1. **`ingestError(raw: { message: string; type: string; stackTrace?: string; source: ProductionError['source']; environment: string; metadata?: Record<string, unknown> }): ProductionError`**
   - Creates a `ProductionError` with `crypto.randomUUID()` id.
   - If `stackTrace` provided, parses frames using simple V8 parser (same logic as debug engine: `at fn (path:line:col)`).
   - Sets `firstSeenAt` and `lastSeenAt` to now. `occurrenceCount: 1`. `affectedUsers: 1`.
   - Infers `severity` from `type`: `'TypeError'`/`'ReferenceError'` → `'error'`, contains `'fatal'` → `'fatal'`, else `'warning'`.

2. **`parseStackFrames(trace: string): StackFrame[]`**
   - Same V8 stack trace parser as debug engine. Extracts functionName, filePath, line, column.
   - This is a standalone implementation (does not import from debug-engine, to avoid circular dependencies in tests — but uses the same `StackFrame` type).

3. **`attributeCommit(errorId: string, file: string, line: number, blameOutput: string): CommitAttribution`**
   - Parses `git blame` output format: `<sha> (<author> <date> <line>) <content>`.
   - Extracts `commitSha`, `author`, `committedAt` from the blame line.
   - `commitMessage` is set from blame output or `'unknown'`.

4. **`assessImpact(error: ProductionError): ProductionImpact`**
   - `impactScore` = `Math.min(100, error.occurrenceCount * 2 + error.affectedUsers * 5 + (error.severity === 'fatal' ? 40 : error.severity === 'error' ? 20 : 0))`.
   - `frequency` = `'stable'` (single snapshot — would need history for trend).
   - `recommendation`: score >= 80 → `'hotfix-now'`; score >= 50 → `'fix-next-sprint'`; score >= 20 → `'monitor'`; else `'ignore'`.

5. **`getRecentErrors(): ProductionError[]`**
   - Returns stored errors sorted by `lastSeenAt` descending.
   - Limited to 100 entries.

### Required Tests (minimum 15)

1. **Ingests sentry error with all fields** — source 'sentry', verify all fields populated.
2. **Ingests manual error without stack trace** — no stackTrace → parsedFrames empty.
3. **Assigns unique ID on ingest** — verify UUID format.
4. **Parses stack frames from trace** — `at foo (/src/bar.ts:10:5)` → frame with correct fields.
5. **Infers severity error for TypeError** — type 'TypeError' → severity 'error'.
6. **Infers severity fatal for fatal type** — type contains 'fatal' → severity 'fatal'.
7. **Infers severity warning for unknown types** — type 'CustomError' → severity 'warning'.
8. **Attributes commit from blame output** — parses sha, author, date from blame format.
9. **Impact score high for frequent fatal errors** — 50 occurrences + fatal → score >= 80.
10. **Impact score low for single warning** — 1 occurrence + warning → score < 20.
11. **Recommends hotfix-now for high impact** — score >= 80 → 'hotfix-now'.
12. **Recommends monitor for low impact** — score 20-49 → 'monitor'.
13. **Recommends ignore for minimal impact** — score < 20 → 'ignore'.
14. **Metadata stored as Record** — custom metadata key → retrievable from error.
15. **getRecentErrors returns sorted by lastSeenAt** — verify ordering.

---

## KIMI-R17-08: Project Health Dashboard & Executive Reporting

### Files to Create

- `src/health/health-dashboard.ts`
- `src/health/health-dashboard.test.ts`

### Purpose

Nova26 has accumulated a wealth of data — test scores, security scores, debt scores, accessibility scores, dependency health — but no unified view. This module is the car dashboard: five health dimensions (test, security, code quality, accessibility, dependencies) combined into an overall score with letter grade, trend tracking over time, alerts when a dimension drops below threshold, and report generation in text/markdown/HTML formats.

### Interfaces to Implement

```typescript
export interface HealthDimension {
  name: string;
  score: number;                    // 0-100
  weight: number;                   // 0-1
  trend: 'improving' | 'stable' | 'degrading';
  alerts: HealthAlert[];
  details: Record<string, number>;  // dimension-specific sub-scores
}

export interface HealthAlert {
  id: string;
  dimension: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  triggeredAt: string;
  acknowledged: boolean;
}

export interface ProjectHealth {
  projectId: string;
  computedAt: string;
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: HealthDimension[];
  alerts: HealthAlert[];
  trend: 'improving' | 'stable' | 'degrading';
}

export interface HealthReport {
  reportId: string;
  projectId: string;
  generatedAt: string;
  type: 'daily' | 'weekly' | 'stakeholder';
  format: 'text' | 'markdown' | 'html';
  content: string;
  healthSnapshot: ProjectHealth;
}

export interface HealthConfig {
  computeOnBuild: boolean;          // default: true
  alertThresholds: Record<string, number>; // dimension name → minimum score
  reportSchedule: 'daily' | 'weekly' | 'none'; // default: 'weekly'
  stakeholderReportEnabled: boolean; // default: false
}
```

### Class to Implement

```typescript
export class HealthDashboard {
  constructor(config?: Partial<HealthConfig>);
}
```

Default config:
```typescript
const DEFAULT_CONFIG: HealthConfig = {
  computeOnBuild: true,
  alertThresholds: {
    'test-health': 70,
    'security': 80,
    'code-quality': 60,
    'accessibility': 70,
    'dependencies': 70,
  },
  reportSchedule: 'weekly',
  stakeholderReportEnabled: false,
};
```

### Functions

1. **`computeOverallScore(dimensions: HealthDimension[]): number`**
   - Weighted average: `sum(dimension.score * dimension.weight) / sum(dimension.weight)`.
   - Returns `Math.round()` integer 0-100.

2. **`computeGrade(score: number): ProjectHealth['grade']`**
   - A: 90-100, B: 75-89, C: 60-74, D: 40-59, F: 0-39.

3. **`checkAlerts(dimensions: HealthDimension[], thresholds: Record<string, number>): HealthAlert[]`**
   - For each dimension: if `score < threshold`, create an alert.
   - Severity: `'critical'` if score < threshold - 20, `'warning'` if score < threshold, `'info'` otherwise.
   - Each alert gets `crypto.randomUUID()` id and `triggeredAt` = now.

4. **`determineTrend(history: Array<{ date: string; score: number }>): 'improving' | 'stable' | 'degrading'`**
   - Requires at least 3 data points. If fewer → `'stable'`.
   - Compares average of last 3 to average of first 3:
     - Difference > 5 → `'improving'` (score went up).
     - Difference < -5 → `'degrading'`.
     - Else → `'stable'`.

5. **`computeHealth(projectId: string, dimensions: HealthDimension[], history: Array<{ date: string; score: number }>): ProjectHealth`**
   - Assembles full `ProjectHealth`: overall score, grade, alerts from thresholds, trend from history.
   - `computedAt` = now.

6. **`generateReport(health: ProjectHealth, type: HealthReport['type'], format: HealthReport['format']): HealthReport`**
   - `reportId` = `crypto.randomUUID()`.
   - `'text'` format: plain text summary with scores and alerts.
   - `'markdown'` format: markdown with headers, tables for dimensions, and alert list.
   - `'html'` format: basic HTML with `<h1>`, `<table>`, and color-coded scores.
   - `content` is the formatted string.

7. **`recordSnapshot(projectId: string, health: ProjectHealth): { date: string; score: number }`**
   - Returns a data point for trend history. Meant to be appended to a history array by the caller.

### Required Tests (minimum 15)

1. **Overall score is weighted average** — dimensions [90, 80] with weights [0.6, 0.4] → 86.
2. **Grade A for score 90-100** — verify computeGrade(95) returns 'A'.
3. **Grade F for score 0-39** — verify computeGrade(30) returns 'F'.
4. **Grade B for score 75-89** — verify computeGrade(80) returns 'B'.
5. **Alert generated for dimension below threshold** — score 60, threshold 70 → alert created.
6. **No alert when dimension above threshold** — score 80, threshold 70 → no alert.
7. **Alert severity critical for very low scores** — score 40, threshold 70 → critical.
8. **Alert severity warning for marginally low scores** — score 65, threshold 70 → warning.
9. **Trend improving when recent scores higher** — history [60, 65, 70, 75, 80, 85] → 'improving'.
10. **Trend degrading when recent scores lower** — history [85, 80, 75, 70, 65, 60] → 'degrading'.
11. **Trend stable when scores flat** — history [70, 70, 70, 70, 70, 70] → 'stable'.
12. **Trend stable with fewer than 3 points** — [70, 80] → 'stable'.
13. **Text report contains score** — format='text', verify content includes overall score number.
14. **Markdown report contains headers** — format='markdown', verify content includes `#`.
15. **HTML report contains table** — format='html', verify content includes `<table>`.

---

## KIMI-R17-09: Environment & Configuration Management

### Files to Create

- `src/env/env-manager.ts`
- `src/env/env-manager.test.ts`

### Purpose

Environment misconfigurations cause ~40% of deployment failures. This module detects and validates environment files, scans for accidentally committed secrets (AWS keys, GitHub tokens, passwords), tracks feature flags, and identifies stale flags that should be cleaned up. TRITON uses this for deployment safety.

### Interfaces to Implement

```typescript
export type EnvVarStatus = 'present' | 'missing' | 'invalid' | 'unused';

export interface EnvironmentVariable {
  name: string;
  value?: string;                   // masked for secrets (shows first 4 chars + '****')
  isSecret: boolean;
  status: EnvVarStatus;
  usedInFiles: string[];
  definedInFiles: string[];
  validationError?: string;
}

export interface EnvironmentReport {
  reportId: string;
  projectId: string;
  scannedAt: string;
  environments: Array<{
    name: string;                   // 'development', 'staging', 'production'
    filePath: string;
    variables: EnvironmentVariable[];
    missingCount: number;
    secretCount: number;
  }>;
  secretAlerts: SecretAlert[];
  featureFlags: FeatureFlag[];
}

export interface SecretAlert {
  id: string;
  file: string;
  line: number;
  pattern: string;                  // what was detected
  type: 'api-key' | 'token' | 'password' | 'connection-string' | 'generic';
  severity: 'critical' | 'warning';
  suggestion: string;
}

export interface FeatureFlag {
  name: string;
  definedIn: string;                // file path
  activeIn: string[];               // environments where flag is on
  stale: boolean;
  staleSinceDays?: number;
}

export interface EnvConfig {
  secretDetectionEnabled: boolean;  // default: true
  preCommitHookEnabled: boolean;    // default: true
  featureFlagTrackingEnabled: boolean; // default: true
  customSecretPatterns: string[];   // regex patterns; default: []
}
```

### Class to Implement

```typescript
export class EnvironmentManager {
  constructor(config?: Partial<EnvConfig>);
}
```

Default config:
```typescript
const DEFAULT_CONFIG: EnvConfig = {
  secretDetectionEnabled: true,
  preCommitHookEnabled: true,
  featureFlagTrackingEnabled: true,
  customSecretPatterns: [],
};
```

### Functions

1. **`parseEnvFile(content: string): Array<{ name: string; value: string }>`**
   - Parses `.env` file format: `KEY=VALUE` per line.
   - Handles `"quoted values"` and `'single-quoted values'` (strips quotes).
   - Ignores lines starting with `#` (comments) and empty lines.
   - Handles `export KEY=VALUE` syntax (strips `export ` prefix).

2. **`scanForSecrets(content: string, filePath: string): SecretAlert[]`**
   - Built-in patterns:
     - AWS keys: `/AKIA[0-9A-Z]{16}/` → type `'api-key'`, severity `'critical'`.
     - GitHub tokens: `/ghp_[a-zA-Z0-9]{36}/` → type `'token'`, severity `'critical'`.
     - Generic passwords: `/(?:password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]+/i` → type `'password'`, severity `'warning'`.
     - Connection strings: `/(?:mongodb|postgresql|mysql|redis):\/\/[^\s]+/i` → type `'connection-string'`, severity `'critical'`.
   - Also checks `config.customSecretPatterns` (treated as regex).
   - Each alert gets `crypto.randomUUID()` id.
   - `suggestion`: `"Move this secret to a .env file and add to .gitignore"`.

3. **`validateEnvVars(envVars: Array<{ name: string; value: string }>, sourceFiles: string[]): EnvironmentVariable[]`**
   - For each env var: checks if it's referenced in any source file (`process.env.NAME` or `import.meta.env.NAME`).
   - Status:
     - Referenced in source but not in env → `'missing'`.
     - In env but not referenced → `'unused'`.
     - In env and referenced → `'present'`.
   - `isSecret` = true if name contains `SECRET`, `KEY`, `TOKEN`, `PASSWORD`, `CREDENTIAL`, or `DSN` (case-insensitive).
   - Values of secrets are masked: first 4 chars + `'****'`.

4. **`detectFeatureFlags(sourceContent: string, filePath: string): FeatureFlag[]`**
   - Looks for patterns: `FEATURE_`, `FF_`, `FLAG_` prefixed env vars or `featureFlags.` property access.
   - Returns `FeatureFlag` with `name`, `definedIn` = filePath.
   - `stale` defaults to `false` (needs external history data to determine).

5. **`checkStaleFlags(flags: FeatureFlag[], activeSinceDays: Record<string, number>): FeatureFlag[]`**
   - Marks flags as `stale: true` if they've been active for 30+ days.
   - Sets `staleSinceDays` from the provided map.

6. **`generateReport(projectId: string, envFiles: Array<{ name: string; filePath: string; content: string }>, sourceFiles: string[]): EnvironmentReport`**
   - Parses each env file, validates vars, scans for secrets, detects feature flags.
   - Assembles full `EnvironmentReport`.

### Required Tests (minimum 15)

1. **Parses KEY=VALUE pairs** — `API_URL=http://localhost` → name='API_URL', value='http://localhost'.
2. **Handles quoted values** — `SECRET="my secret"` → value='my secret' (no quotes).
3. **Ignores comment lines** — `# comment` line skipped.
4. **Handles export prefix** — `export DB_URL=foo` → name='DB_URL', value='foo'.
5. **Detects AWS key pattern** — `AKIAIOSFODNN7EXAMPLE` → api-key alert, severity critical.
6. **Detects GitHub token pattern** — `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` → token alert.
7. **Detects password pattern** — `password=hunter2` → password alert.
8. **Detects connection string** — `mongodb://user:pass@host` → connection-string alert.
9. **Respects custom secret patterns** — custom regex `/CUSTOM_[0-9]+/` → matches.
10. **Identifies missing env vars** — var used in source but not in .env → status 'missing'.
11. **Identifies unused env vars** — var in .env but not in source → status 'unused'.
12. **Masks secret values** — SECRET_KEY=abcdefgh → value='abcd****'.
13. **Detects feature flag patterns** — `FEATURE_NEW_UI` → detected as flag.
14. **Marks stale flags** — active 45 days → stale=true, staleSinceDays=45.
15. **Report includes all environments** — 2 env files → 2 environment entries in report.

---

## KIMI-R17-10: Agent Orchestration Optimization & Integration Wiring

### Files to Create

- `src/orchestration/orchestration-optimizer.ts`
- `src/orchestration/orchestration-optimizer.test.ts`

### Purpose

Nova26's 21 agents are talented individuals, but their coordination can be optimized. ATLAS becomes the coach: tracking per-agent performance profiles, analyzing handoff success rates between agent pairs, generating build retrospectives, and recommending handoff primers where agent-to-agent communication breaks down. **This task also wires all 10 R17 features into `ralph-loop.ts`.**

### Interfaces to Implement

```typescript
export interface AgentPerformanceProfile {
  agentName: string;
  totalTasks: number;
  successRate: number;              // 0-1
  avgAceScore: number;              // 0-100
  avgRetries: number;
  avgDurationMs: number;
  taskTypeBreakdown: Array<{
    taskType: string;
    count: number;
    successRate: number;
    avgAceScore: number;
  }>;
  trend: 'improving' | 'stable' | 'declining';
}

export interface HandoffMetrics {
  fromAgent: string;
  toAgent: string;
  totalHandoffs: number;
  firstAttemptSuccessRate: number;  // 0-1
  avgRetries: number;
  commonFailureReasons: string[];
  primerRecommended: boolean;
  primerText?: string;
}

export interface BuildRetrospective {
  buildId: string;
  projectId: string;
  generatedAt: string;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  topPerformers: string[];          // agent names
  underperformers: string[];        // agent names
  handoffIssues: HandoffMetrics[];
  recommendations: string[];
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  narrative: string;                // 3-5 sentence summary
}

export interface OrchestrationConfig {
  metaLearningEnabled: boolean;     // default: true
  retrospectiveEnabled: boolean;    // default: true
  handoffPrimersEnabled: boolean;   // default: true
  routingOptimizationEnabled: boolean; // default: false (experimental)
  minTasksForProfile: number;       // default: 5
}
```

### Class to Implement

```typescript
export class OrchestrationOptimizer {
  constructor(config?: Partial<OrchestrationConfig>);
}
```

Default config:
```typescript
const DEFAULT_CONFIG: OrchestrationConfig = {
  metaLearningEnabled: true,
  retrospectiveEnabled: true,
  handoffPrimersEnabled: true,
  routingOptimizationEnabled: false,
  minTasksForProfile: 5,
};
```

### Functions

1. **`buildProfile(agentName: string, taskResults: Array<{ taskId: string; taskType: string; success: boolean; aceScore: number; retries: number; durationMs: number }>): AgentPerformanceProfile`**
   - Computes `successRate` = successful / total.
   - Computes `avgAceScore`, `avgRetries`, `avgDurationMs` from results.
   - Groups by `taskType` for breakdown.
   - `trend` defaults to `'stable'` (needs history for real trend).
   - Returns `undefined`-safe: if fewer than `config.minTasksForProfile` results, still returns a profile but with `trend: 'stable'`.

2. **`analyzeHandoffs(handoffs: Array<{ fromAgent: string; toAgent: string; success: boolean; retries: number; failureReason?: string }>): HandoffMetrics[]`**
   - Groups by `fromAgent`-`toAgent` pair.
   - Computes `firstAttemptSuccessRate` = handoffs where `retries === 0 && success` / total.
   - `commonFailureReasons` = top 3 most frequent failure reasons.
   - `primerRecommended` = true if `firstAttemptSuccessRate < 0.7`.

3. **`recommendPrimer(metrics: HandoffMetrics): string | undefined`**
   - If `primerRecommended` is false, returns `undefined`.
   - Generates a primer text: `"When ${fromAgent} hands off to ${toAgent}, ensure: <recommendations based on common failures>"`.

4. **`generateRetrospective(buildId: string, projectId: string, taskResults: Array<{ taskId: string; agent: string; success: boolean; aceScore: number; retries: number; durationMs: number }>, handoffData: Array<{ fromAgent: string; toAgent: string; success: boolean; retries: number; failureReason?: string }>): BuildRetrospective`**
   - `topPerformers` = agents with 100% success rate and aceScore >= 80. Top 3.
   - `underperformers` = agents with success rate < 0.7 or avgAceScore < 60. Bottom 3.
   - `handoffIssues` = handoff pairs where `primerRecommended` is true.
   - `overallGrade`: success rate >= 0.95 → A, >= 0.85 → B, >= 0.70 → C, >= 0.50 → D, else F.
   - `narrative`: `"Build <buildId> completed <successfulTasks>/<totalTasks> tasks. Top performers: <names>. <issueCount> handoff issues identified."`.
   - `recommendations` = list of suggested improvements based on underperformers and handoff issues.

5. **`computeTrend(history: Array<{ date: string; successRate: number }>): AgentPerformanceProfile['trend']`**
   - Same logic as health dashboard: compare recent avg to earlier avg.
   - Difference > 0.05 → `'improving'`. Difference < -0.05 → `'declining'`. Else `'stable'`.

6. **`gradeOverall(successRate: number): BuildRetrospective['overallGrade']`**
   - >= 0.95 → A, >= 0.85 → B, >= 0.70 → C, >= 0.50 → D, else F.

### Required Tests (minimum 15)

1. **Builds profile with correct success rate** — 8 success / 10 total → 0.8.
2. **Builds profile with correct avg ACE score** — scores [80, 90, 70] → avg 80.
3. **Profile includes task type breakdown** — 3 'backend' + 2 'frontend' → 2 breakdown entries.
4. **Profile trend stable with insufficient data** — 3 results → trend 'stable'.
5. **Handoff metrics computed per agent pair** — JUPITER→MARS and EARTH→VENUS → 2 metrics.
6. **First attempt success rate computed correctly** — 7/10 with 0 retries and success → 0.7.
7. **Low success handoff recommends primer** — rate 0.5 → primerRecommended true.
8. **High success handoff no primer** — rate 0.9 → primerRecommended false.
9. **Common failure reasons populated** — 3 failures with reason 'ambiguous spec' → appears in list.
10. **Retrospective identifies top performers** — MARS 100% success, score 90 → in topPerformers.
11. **Retrospective identifies underperformers** — SATURN 50% success → in underperformers.
12. **Retrospective grade A for >95% success** — verify gradeOverall(0.96) returns 'A'.
13. **Retrospective grade F for <50% success** — verify gradeOverall(0.4) returns 'F'.
14. **Narrative is non-empty string** — verify narrative.length > 0.
15. **Recommendations list non-empty when issues exist** — underperformers present → recommendations.length > 0.

---

### Modification to `src/orchestrator/ralph-loop.ts`

**This is the ONLY existing file you modify in this entire sprint.** Add these imports at the top of the file (after the existing import block):

```typescript
import type { ReviewConfig } from '../review/code-review.js';
import type { MigrationConfig } from '../migrate/migration-engine.js';
import type { DebugConfig } from '../debug/debug-engine.js';
import type { AccessibilityConfig } from '../a11y/a11y-engine.js';
import type { DebtConfig } from '../debt/debt-scorer.js';
import type { DependencyConfig } from '../deps/dependency-manager.js';
import type { ProductionFeedbackConfig } from '../prod-feedback/prod-feedback.js';
import type { HealthConfig } from '../health/health-dashboard.js';
import type { EnvConfig } from '../env/env-manager.js';
import type { OrchestrationConfig } from '../orchestration/orchestration-optimizer.js';
```

Add these fields to the `RalphLoopOptions` interface, **after** the agent memory fields (after `memoryConfig`):

```typescript
  // Code Review (R17-03)
  codeReviewEnabled?: boolean;
  codeReviewConfig?: ReviewConfig;
  // Migration Engine (R17-04)
  migrationEnabled?: boolean;
  migrationConfig?: MigrationConfig;
  // Debugging (R17-05)
  debugEngineEnabled?: boolean;
  debugConfig?: DebugConfig;
  // Accessibility (R17-06)
  accessibilityEnabled?: boolean;
  accessibilityConfig?: AccessibilityConfig;
  // Technical Debt (R17-07)
  debtScoringEnabled?: boolean;
  debtConfig?: DebtConfig;
  // Dependency Management (R17-08)
  dependencyManagementEnabled?: boolean;
  dependencyConfig?: DependencyConfig;
  // Production Feedback (R17-09)
  productionFeedbackEnabled?: boolean;
  productionFeedbackConfig?: ProductionFeedbackConfig;
  // Health Dashboard (R17-10)
  healthDashboardEnabled?: boolean;
  healthConfig?: HealthConfig;
  // Environment Management (R17-11)
  envManagementEnabled?: boolean;
  envConfig?: EnvConfig;
  // Orchestration Optimization (R17-12)
  orchestrationOptimizationEnabled?: boolean;
  orchestrationConfig?: OrchestrationConfig;
```

**That is the ONLY change to ralph-loop.ts.** Do not modify any functions.

---

## Final Checklist

After completing all 10 tasks, verify:

```bash
npx tsc --noEmit        # 0 errors
npx vitest run           # 2081+ tests (target: 150+ new = 2231+)
```

New files created (20 total):
- `src/review/code-review.ts`
- `src/review/code-review.test.ts`
- `src/migrate/migration-engine.ts`
- `src/migrate/migration-engine.test.ts`
- `src/debug/debug-engine.ts`
- `src/debug/debug-engine.test.ts`
- `src/a11y/a11y-engine.ts`
- `src/a11y/a11y-engine.test.ts`
- `src/debt/debt-scorer.ts`
- `src/debt/debt-scorer.test.ts`
- `src/deps/dependency-manager.ts`
- `src/deps/dependency-manager.test.ts`
- `src/prod-feedback/prod-feedback.ts`
- `src/prod-feedback/prod-feedback.test.ts`
- `src/health/health-dashboard.ts`
- `src/health/health-dashboard.test.ts`
- `src/env/env-manager.ts`
- `src/env/env-manager.test.ts`
- `src/orchestration/orchestration-optimizer.ts`
- `src/orchestration/orchestration-optimizer.test.ts`

Modified files (1 total):
- `src/orchestrator/ralph-loop.ts` (20 new fields + 10 imports only)
