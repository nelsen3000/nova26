# GROK-R17: Nova26 Feature Completion Research Prompt

> Assigned to: Grok
> Round: R17 (post-R16)
> Date issued: 2026-02-19
> Status: Active

---

## Context Brief

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. The 21 agents
are named after celestial bodies (MARS, VENUS, MERCURY, JUPITER, SATURN, PLUTO, ATLAS, etc.)
and operate through the Ralph Loop execution engine with ACE quality feedback.

**Current state of the build:**
- R1-R15 covered: core architecture, Taste Vault, ACE, Rehearsal, Security, Performance,
  Plugins, Teams, CI/CD, Analytics, Onboarding, Multi-Modal, Voice, Benchmarks, Graph Viz,
  Autonomous Projects, Semantic Search, Adaptive Personality, Offline-First, Documentation,
  CLI Polish, Launch Readiness, Self-Healing Codebase, Natural Language Programming, etc.
- R16 covered: Cross-Project Intelligence (Portfolio), Agent Memory Consolidation, Generative
  UI & Live Preview, Autonomous Testing, Emotional Intelligence, Dream Mode, Parallel Universe,
  Overnight Evolution, Nova Symbiont, Taste Room.
- R17-01 (Error Recovery) and R17-02 (Project Init) already specced.
- 1901+ tests passing, 0 TypeScript errors.
- Kimi has implemented: Portfolio, Agent Memory, Visionary (Dream/Universe/Evolution/Symbiont/TasteRoom).
- Existing codebase directories include: ace/, agent-loop/, agents/, analytics/, atlas/, browser/,
  cli/, codebase/, config/, convex/, cost/, dependency-analysis/, dream/, evolution/, gates/,
  git/, ide/, integrations/, llm/, memory/, observability/, orchestrator/, performance/,
  persistence/, portfolio/, preview/, recovery/, rehearsal/, retry/, sandbox/, security/,
  similarity/, skills/, swarm/, symbiont/, sync/, taste-room/, taste-vault/, testing/, tools/,
  types/, universe/, visionary/.

**R17 mission:** R17 is the completion round. These features fill every remaining gap between
"impressive prototype" and "production-ready, competition-crushing product." Each spec must be
independently actionable by a code-implementing AI. Concrete TypeScript interfaces, clear agent
responsibilities, and honest open questions are mandatory. No hand-waving.

**Your style:** Open each deliverable with a tight, concrete analogy (one paragraph). Then go
deep: concrete TypeScript interfaces with every field documented, integration points with named
agents, CLI commands, and open questions. Every spec must be implementable in a 5-task sprint
by a coding AI (Kimi) working from your interfaces alone.

---

## Deliverables

Label each section clearly: GROK-R17-03, GROK-R17-04, etc.

---

### GROK-R17-03: Intelligent Code Review & PR Intelligence

**The analogy:** A building inspector does not merely check that walls are standing — they check
that the electrical wiring follows code, the plumbing has the right fall angle, and the fire
exits are accessible. A good code reviewer does the same: they check correctness, security,
performance, style, and maintainability in a single pass. But most AI code reviewers are
single-lens tools — they check one dimension. Nova26 has 21 specialists already. MARS knows
backend patterns. VENUS knows UI accessibility. ENCELADUS knows security. SATURN knows test
coverage. A code review that uses all 21 lenses simultaneously is not a feature — it is a
capability that no competitor can replicate without rebuilding their entire architecture.

Produce a complete specification for Nova26's intelligent code review system:

1. **Multi-agent review architecture.** Define how a code review request is routed through
   multiple agents simultaneously:

   - Input: a git diff (staged changes, PR diff, or commit range).
   - The diff is distributed to relevant agents based on file type and content:
     - `.ts` backend files → MARS (patterns, auth, data handling)
     - `.tsx` / `.css` files → VENUS (UI, accessibility, responsive design)
     - Any file → ENCELADUS (security vulnerabilities, injection risks)
     - Test files → SATURN (test quality, coverage gaps)
     - Schema files → PLUTO (database design, index usage)
     - Config files → TRITON (deployment, environment safety)
   - Each agent reviews independently and produces a `ReviewComment`.
   - MERCURY aggregates and deduplicates comments.
   - Define the review orchestration: parallel agent calls with a timeout (30 seconds per
     agent, 60 seconds total).

2. **Review comment structure.** Define `ReviewComment` with:
   - `file`, `line`, `severity` (critical/warning/suggestion/praise), `category`
     (security/performance/style/correctness/accessibility/testing), `message`,
     `suggestedFix` (optional code), `agentName`, `confidence`.
   - Praise comments are important: agents should call out genuinely good patterns.

3. **Review summary.** After all agent comments are collected:
   - MERCURY produces a `ReviewSummary` with overall verdict (approve/request-changes/comment),
     critical issue count, total comment count, and a 2-3 sentence summary.
   - The summary should be opinionated: "This PR adds solid auth middleware but has two
     SQL injection risks in the query builder. Request changes."

4. **PR integration.** Define how the review integrates with git workflows:
   - `nova26 review` reviews staged changes.
   - `nova26 review --pr <number>` reviews a GitHub PR (if gh CLI available).
   - `nova26 review --commit <sha>` reviews a specific commit.
   - Output: structured comments in terminal, or posted to GitHub PR via gh API.

5. **Learning from review outcomes.** When a review suggestion is accepted (the code is changed
   to match the suggestion) or rejected (the code is kept as-is), Nova26 learns:
   - Accepted suggestions reinforce the agent's pattern.
   - Rejected suggestions are flagged for review — was the agent wrong, or did the developer
     ignore good advice? Use Taste Vault to store review outcomes.

6. **TypeScript interfaces.** Define:

   ```typescript
   interface ReviewConfig {
     agents: string[];                  // which agents participate; default: all relevant
     timeoutPerAgentMs: number;         // default: 30000
     totalTimeoutMs: number;            // default: 60000
     includePraise: boolean;            // default: true
     minSeverity: 'critical' | 'warning' | 'suggestion'; // default: 'suggestion'
   }

   type ReviewSeverity = 'critical' | 'warning' | 'suggestion' | 'praise';
   type ReviewCategory = 'security' | 'performance' | 'style' | 'correctness' | 'accessibility' | 'testing' | 'documentation';

   interface ReviewComment {
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

   interface ReviewSummary {
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

7. **CLI surface.**
   ```
   nova26 review                        # Review staged changes
   nova26 review --pr <number>          # Review a GitHub PR
   nova26 review --commit <sha>         # Review a specific commit
   nova26 review --severity critical    # Only show critical issues
   nova26 review --agents MARS,ENCELADUS # Limit to specific agents
   nova26 review history                # Show past review summaries
   ```

8. **Open questions.** How to handle very large diffs (1000+ lines) without exceeding LLM
   context limits — recommend chunking by file with cross-file context injection. How to
   avoid review fatigue (too many comments per PR) — cap at 15 comments per review, prioritized
   by severity. Whether to auto-post comments to GitHub or always show in terminal first —
   recommend terminal-first with explicit `--post` flag.

---

### GROK-R17-04: Codebase Migration & Framework Upgrade Engine

**The analogy:** Moving house is not just about transporting boxes from one address to another.
You discover that the new kitchen has a different oven, so your baking pans do not fit. The
light switches are in different positions. The garage is narrower. You unpack for weeks,
discovering small incompatibilities at every turn. Framework migrations in software are the
same: upgrading from React 18 to React 19, moving from Express to Fastify, switching from
Prisma to Drizzle — each involves a thousand small incompatibilities that no one catalogues
completely. The developer starts confidently, hits the first surprise at hour two, and by
hour eight is questioning the decision. Nova26 can do this work in minutes because it has
seen hundreds of projects (via the portfolio system from R16-01) and knows exactly which
incompatibilities to expect.

Produce a complete specification for Nova26's codebase migration engine:

1. **Migration plan generation.** Given a source framework/version and target framework/version:
   - Nova26 analyzes the codebase to identify all files affected by the migration.
   - Generates a `MigrationPlan` with ordered steps, estimated risk per step, and rollback
     instructions for each step.
   - Uses Portfolio data (R16-01) to reference past migrations in other projects.
   - Uses Agent Memory (R16-02) to recall what worked and what failed in previous migrations.

2. **Incremental migration execution.** Migrations are never all-or-nothing:
   - Each step is a self-contained, testable change.
   - After each step: run tests, type-check, and verify. If a step fails: rollback that
     step and pause for human review.
   - The migration can be paused and resumed across sessions. State persists in
     `.nova/migrations/<migration-id>/state.json`.

3. **Common migration patterns.** Define migration support for:
   - Package version upgrades (React 18→19, Next.js 14→15, TypeScript 5.3→5.5)
   - ORM migrations (Prisma→Drizzle, Mongoose→native, etc.)
   - CSS framework migrations (CSS Modules→Tailwind, styled-components→CSS Modules)
   - API framework migrations (Express→Fastify, REST→tRPC)
   - Each migration pattern defines: file patterns affected, AST transforms needed,
     import rewrites, config file changes.

4. **TypeScript interfaces.**
   ```typescript
   type MigrationStatus = 'planning' | 'in-progress' | 'paused' | 'completed' | 'rolled-back';

   interface MigrationPlan {
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

   interface MigrationStep {
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

   interface MigrationTransform {
     type: 'import-rewrite' | 'api-change' | 'config-update' | 'file-rename' | 'ast-transform' | 'dependency-swap';
     pattern: string;                  // what to look for
     replacement: string;              // what to replace with
     fileGlob: string;                 // which files to apply to
   }

   interface MigrationState {
     migrationId: string;
     currentStep: number;
     completedSteps: string[];
     failedSteps: string[];
     rollbackStack: string[];          // steps that can be rolled back
     pausedAt?: string;
     resumedAt?: string;
   }
   ```

5. **CLI surface.**
   ```
   nova26 migrate plan <source> <target>  # Generate migration plan
   nova26 migrate run                     # Execute next step
   nova26 migrate run --all               # Execute all remaining steps
   nova26 migrate pause                   # Pause migration
   nova26 migrate resume                  # Resume from last step
   nova26 migrate rollback                # Rollback last completed step
   nova26 migrate rollback --all          # Rollback entire migration
   nova26 migrate status                  # Show current migration state
   ```

6. **Open questions.** How to handle migrations that require manual human decisions (e.g.,
   choosing between two valid API patterns in the new framework) — recommend pausing and
   presenting options. How to validate a migration is complete (all tests pass is necessary
   but not sufficient — some regressions only appear at runtime). Whether to integrate with
   `codemods` tooling (jscodeshift) for AST transforms or implement a custom transformer.

---

### GROK-R17-05: Advanced Debugging & Root Cause Analysis

**The analogy:** When an airplane crashes, investigators do not just look at the wreckage.
They reconstruct the flight path, review the black box recordings, analyze weather data,
check maintenance logs, and interview ground crews. They work backward from the failure to
the root cause, which is often many steps removed from the symptom. When a software bug is
reported, most developers do the equivalent of staring at the wreckage: they read the error
message and try to fix the line that threw. But the root cause is often three function calls
back, in a module the developer forgot existed. Nova26 can trace the full flight path.

Produce a complete specification for Nova26's debugging and root cause analysis system:

1. **Error intake.** Nova26 accepts errors from multiple sources:
   - Stack traces (pasted into terminal or piped: `nova26 debug < error.log`)
   - Error messages ("I'm getting 'Cannot read property x of undefined' in the login flow")
   - Test failure output (`nova26 debug --from-test "user.test.ts"`)
   - Runtime error screenshots (future: OCR from screenshot, spec but don't implement)

2. **Root cause tracing.** Given an error:
   - Parse the stack trace to identify the call chain.
   - For each frame in the stack: read the source file, understand the function's purpose,
     check its inputs and outputs.
   - Identify the "divergence point" — where did the actual behavior diverge from expected?
     This requires comparing the code's intent (from function name, comments, types) against
     the error condition.
   - Generate a `RootCauseAnalysis` that traces from symptom → intermediate causes → root cause.

3. **Fix proposal.** For each identified root cause:
   - Generate a specific code fix with explanation.
   - Generate a regression test that would have caught this bug.
   - Estimate the fix confidence (how sure Nova26 is that this fix is correct).

4. **TypeScript interfaces.**
   ```typescript
   type ErrorSource = 'stack-trace' | 'description' | 'test-failure' | 'runtime-log';
   type FixConfidence = 'high' | 'medium' | 'low';

   interface DebugSession {
     id: string;
     projectId: string;
     errorSource: ErrorSource;
     rawInput: string;
     parsedError: ParsedError;
     rootCause: RootCauseAnalysis;
     fixProposals: FixProposal[];
     startedAt: string;
     completedAt?: string;
   }

   interface ParsedError {
     message: string;
     type: string;                     // e.g., 'TypeError', 'ReferenceError'
     stackFrames: StackFrame[];
     file?: string;
     line?: number;
   }

   interface StackFrame {
     functionName: string;
     filePath: string;
     line: number;
     column: number;
     sourcePreview?: string;           // 3 lines of context around the error
   }

   interface RootCauseAnalysis {
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

   interface FixProposal {
     id: string;
     description: string;
     file: string;
     diff: string;                     // unified diff format
     confidence: FixConfidence;
     regressionTest: string;           // generated test code
     regressionTestFile: string;       // where to save the test
   }
   ```

5. **CLI surface.**
   ```
   nova26 debug "<error message>"        # Debug from error description
   nova26 debug --stack "<stack trace>"  # Debug from stack trace
   nova26 debug --from-test <test-file>  # Debug from failing test
   nova26 debug --apply <fix-id>         # Apply a proposed fix
   nova26 debug history                  # Show past debug sessions
   ```

6. **Open questions.** How to trace across async boundaries (Promise chains, event emitters)
   where the stack trace loses context. How to handle errors in third-party code where Nova26
   cannot read the source. How to distinguish between "the code is wrong" (bug) and "the
   input is wrong" (user error or upstream issue).

---

### GROK-R17-06: Accessibility Compliance & WCAG Engine

**The analogy:** Wheelchair ramps were not added to buildings because architects suddenly
became more empathetic. They were added because laws required it. And once the ramps were
there, everyone used them — parents with strollers, delivery workers with hand trucks,
travelers with luggage. Accessibility features in software follow the same pattern: built
for compliance, used by everyone. But most AI coding tools treat accessibility as an
afterthought — a linting rule that highlights missing alt tags. Nova26 treats it as a
first-class design dimension, checked by a specialist agent (VENUS), enforced across
every component, and reported with the same rigor as test coverage.

Produce a complete specification for Nova26's accessibility compliance engine:

1. **WCAG 2.2 rule engine.** Define the rule set Nova26 checks:
   - Level A (must-have): focus management, alt text, color contrast, keyboard navigation,
     form labels, error identification.
   - Level AA (should-have): resize text, consistent navigation, focus visible, input purpose.
   - Level AAA (nice-to-have): sign language, extended audio description (mostly N/A for web).
   - Define a `WCAGRule` type with id (e.g., '1.1.1'), name, level, check function signature.

2. **Component scanning.** Nova26 scans all UI components:
   - Static analysis: parse TSX/JSX for missing aria attributes, missing labels, click
     handlers without keyboard equivalents, images without alt text.
   - Dynamic analysis (if live preview from R16-03 is active): run axe-core on the rendered
     DOM, check focus order, verify contrast ratios.
   - Each violation produces an `AccessibilityViolation` with file, line, rule, severity,
     and a specific fix suggestion.

3. **Auto-fix capability.** For common violations:
   - Missing `alt` on images → generate descriptive alt text from image context/filename.
   - Missing `aria-label` → infer from component usage context.
   - Missing keyboard handler → add `onKeyDown` that mirrors `onClick` behavior.
   - Missing focus styles → add `:focus-visible` CSS.
   - Each auto-fix is proposed, not auto-applied.

4. **TypeScript interfaces.**
   ```typescript
   type WCAGLevel = 'A' | 'AA' | 'AAA';
   type ViolationSeverity = 'critical' | 'serious' | 'moderate' | 'minor';

   interface WCAGRule {
     id: string;                       // e.g., '1.1.1'
     name: string;                     // e.g., 'Non-text Content'
     level: WCAGLevel;
     description: string;
     checkType: 'static' | 'dynamic' | 'both';
   }

   interface AccessibilityViolation {
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

   interface AccessibilityReport {
     reportId: string;
     projectId: string;
     scannedAt: string;
     filesScanned: number;
     componentsScanned: number;
     violations: AccessibilityViolation[];
     score: number;                    // 0-100
     levelACompliance: number;         // percentage
     levelAACompliance: number;
     summary: string;
   }

   interface AccessibilityConfig {
     targetLevel: WCAGLevel;           // default: 'AA'
     autoFixEnabled: boolean;          // default: false
     scanOnBuild: boolean;             // default: true
     excludePatterns: string[];        // file patterns to skip
   }
   ```

5. **CLI surface.**
   ```
   nova26 a11y scan                      # Full accessibility scan
   nova26 a11y scan --file <path>        # Scan specific file
   nova26 a11y scan --level AAA          # Scan at AAA level
   nova26 a11y fix                       # Auto-fix all fixable violations
   nova26 a11y fix --file <path>         # Auto-fix specific file
   nova26 a11y report                    # Generate compliance report
   nova26 a11y report --format html      # HTML report for stakeholders
   ```

6. **Open questions.** How to handle dynamic content that only violates accessibility in
   certain states (e.g., a modal that traps focus but only when open). How to test color
   contrast across all theme variants. Whether to integrate with the Generative UI system
   (R16-03) so that generated components are accessible by default.

---

### GROK-R17-07: Technical Debt Scoring & Automated Remediation

**The analogy:** A credit score is not a judgment — it is a number that tells you where you
stand and what you can improve. It aggregates dozens of signals (payment history, utilization,
age of accounts) into a single number that is immediately useful. Technical debt has always
been described in vague terms: "we have some debt in the auth module." Developers know it
exists but cannot quantify it, prioritize it, or track whether it is growing or shrinking.
Nova26 computes a Technical Debt Score the same way a credit agency computes a credit score:
by aggregating measurable signals into a single, actionable number.

Produce a complete specification for Nova26's technical debt scoring system:

1. **Debt dimensions.** Define the measurable signals that contribute to technical debt:
   - Code complexity (cyclomatic complexity > 10 per function, nesting depth > 4)
   - Code duplication (blocks > 6 lines duplicated across 2+ files)
   - Outdated patterns (using deprecated APIs, old syntax, anti-patterns from Taste Vault)
   - Test coverage gaps (from R16-04's test quality analysis)
   - Dependency age (dependencies more than 2 major versions behind)
   - TODO/FIXME/HACK density (comments indicating known shortcuts)
   - Type safety gaps (`as any`, `@ts-ignore`, `// @ts-expect-error` without explanation)

2. **Debt scoring algorithm.** Each dimension contributes to the overall score:
   - Each file gets a `FileDebtScore` (0-100, lower is better; 0 = no debt).
   - Project-level score is weighted average: complexity (25%), duplication (20%),
     patterns (15%), test gaps (15%), dependencies (10%), TODOs (10%), type safety (5%).
   - Define `DebtTrend`: daily snapshots stored locally, showing whether debt is
     increasing or decreasing.

3. **Automated remediation.** For each debt type, define auto-fix capabilities:
   - Complexity: extract long functions into smaller helpers.
   - Duplication: extract shared code into utilities.
   - Type safety: replace `as any` with proper type assertions.
   - TODOs: convert to tracked issues.
   - Each fix is proposed as a diff, not auto-applied.

4. **TypeScript interfaces.**
   ```typescript
   interface DebtDimension {
     name: string;
     weight: number;                   // 0-1, sums to 1
     score: number;                    // 0-100 (0 = no debt)
     items: DebtItem[];
   }

   interface DebtItem {
     id: string;
     dimension: string;
     file: string;
     line: number;
     description: string;
     severity: 'high' | 'medium' | 'low';
     autoFixAvailable: boolean;
     estimatedFixMinutes: number;
   }

   interface DebtReport {
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

   interface DebtTrend {
     dataPoints: Array<{ date: string; score: number }>;
     direction: 'improving' | 'stable' | 'worsening';
     changeRate: number;               // score change per day
   }
   ```

5. **CLI surface.**
   ```
   nova26 debt score                     # Compute and show debt score
   nova26 debt score --file <path>       # Score specific file
   nova26 debt report                    # Full debt report
   nova26 debt fix                       # Propose fixes for top items
   nova26 debt fix --auto                # Auto-apply safe fixes
   nova26 debt trend                     # Show debt trend over time
   ```

6. **Open questions.** How to weigh dimensions fairly — some debt is harmless (a TODO that
   is a reminder, not a shortcut). How to avoid false positives for intentional complexity
   (some functions are inherently complex). How to integrate with sprint planning (showing
   debt items as potential sprint tasks).

---

### GROK-R17-08: Smart Dependency Management & Supply Chain Security

**The analogy:** A good chef does not just cook with whatever ingredients happen to be in
the pantry. They check expiration dates, source quality ingredients, know which substitutions
work, and never use a recalled product. Dependencies in software are ingredients — and most
developers are cooking with whatever `npm install` put in the pantry three months ago. Some
of those packages have known vulnerabilities. Some have been abandoned. Some have been
taken over by malicious actors (the xz-utils incident). Nova26 checks the pantry.

Produce a complete specification for Nova26's dependency management system:

1. **Dependency health analysis.** For each dependency in package.json:
   - Version currency: how many versions behind? Major, minor, patch.
   - Maintenance status: last publish date, open issues/PRs ratio, bus factor (contributors).
   - Security: known CVEs from npm audit and NVD database.
   - License compatibility: detect license conflicts.
   - Bundle impact: size added to the bundle.

2. **Smart update recommendations.** Not all updates are equal:
   - Patch updates (1.2.3 → 1.2.4): auto-recommend, low risk.
   - Minor updates (1.2.3 → 1.3.0): recommend with changelog summary.
   - Major updates (1.2.3 → 2.0.0): full migration analysis with breaking changes listed.
   - Nova26 groups related updates (e.g., all React packages together).

3. **Supply chain security.** Beyond known CVEs:
   - Detect typosquatting (dependencies with names similar to popular packages).
   - Detect abnormal publish patterns (new maintainer + large code change = risk signal).
   - Flag dependencies with install scripts (preinstall/postinstall) that could execute
     arbitrary code.

4. **TypeScript interfaces.**
   ```typescript
   type UpdateUrgency = 'critical' | 'recommended' | 'optional';

   interface DependencyHealth {
     name: string;
     currentVersion: string;
     latestVersion: string;
     versionsBehind: { major: number; minor: number; patch: number };
     lastPublished: string;
     weeklyDownloads: number;
     maintainerCount: number;
     openIssues: number;
     knownVulnerabilities: Vulnerability[];
     license: string;
     licenseCompatible: boolean;
     bundleSizeKb: number;
     healthScore: number;              // 0-100
   }

   interface Vulnerability {
     id: string;                       // CVE ID
     severity: 'critical' | 'high' | 'medium' | 'low';
     description: string;
     fixedInVersion?: string;
     patchAvailable: boolean;
   }

   interface UpdateRecommendation {
     dependency: string;
     fromVersion: string;
     toVersion: string;
     urgency: UpdateUrgency;
     breakingChanges: string[];
     changelogSummary: string;
     riskScore: number;                // 0-100
     relatedUpdates: string[];         // other deps that should update together
   }

   interface DependencyReport {
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

   interface SupplyChainAlert {
     id: string;
     type: 'typosquat' | 'new-maintainer' | 'install-script' | 'abandoned' | 'deprecated';
     dependency: string;
     description: string;
     severity: 'critical' | 'warning';
     recommendation: string;
   }
   ```

5. **CLI surface.**
   ```
   nova26 deps scan                      # Full dependency health scan
   nova26 deps update                    # Show update recommendations
   nova26 deps update --apply            # Apply recommended updates
   nova26 deps security                  # Security-only scan
   nova26 deps licenses                  # License compatibility report
   nova26 deps report                    # Full dependency report
   ```

6. **Open questions.** How to handle monorepos with multiple package.json files. How to
   verify that an update does not break the project without running the full test suite
   (recommend: type-check first, then targeted tests for packages that import the updated
   dependency). How to handle dependencies that are used but not in package.json (phantom
   dependencies from hoisting).

---

### GROK-R17-09: Production Feedback Loop & Error Intelligence

**The analogy:** A doctor who never sees patients after surgery has no feedback loop. They
prescribe, they operate, they discharge — and they never learn whether the treatment worked.
Software developers do the same thing: they write code, deploy it, and move on. If the code
breaks in production at 3am, someone else handles it. The feedback loop from production back
to development is broken in most organizations. Nova26 cannot fix organizational dysfunction,
but it can close the loop for the individual developer: when code you wrote breaks in
production, Nova26 traces it back to the commit, shows you the root cause, and proposes the
fix — before anyone files a ticket.

Produce a complete specification for Nova26's production feedback loop:

1. **Error ingestion.** Nova26 accepts production error data from:
   - Error tracking services (Sentry webhook, generic JSON webhook).
   - Log files (structured JSON logs, plain text with regex patterns).
   - Manual input (`nova26 prod-error "<error message>" --stack "<trace>"`).
   - Define a `ProductionError` interface that normalizes all sources.

2. **Commit attribution.** For each production error:
   - Parse the stack trace to identify the file and line.
   - Use `git blame` to identify the commit that introduced that line.
   - Identify the developer, the date, and the commit message.
   - Check if the error correlates with a recent deployment (error appeared within 24 hours
     of a deploy).

3. **Impact assessment.** Quantify the production error's impact:
   - Frequency: how often is this error occurring?
   - Affected users: how many unique users/sessions are affected?
   - Severity: does it crash the app, degrade performance, or produce wrong data?
   - Trend: is it increasing or stable?

4. **Automated fix cycle.** When Nova26 identifies a production error:
   - Invoke the debugging system (R17-05) to trace root cause.
   - Generate a fix proposal and regression test.
   - If confidence is high and the fix is safe: create a hotfix branch and PR automatically.
   - Surface the fix to the developer for review.

5. **TypeScript interfaces.**
   ```typescript
   type ErrorSeverityLevel = 'fatal' | 'error' | 'warning' | 'info';

   interface ProductionError {
     id: string;
     source: 'sentry' | 'log' | 'webhook' | 'manual';
     message: string;
     type: string;
     stackTrace?: string;
     parsedFrames: StackFrame[];       // reuse from R17-05
     firstSeenAt: string;
     lastSeenAt: string;
     occurrenceCount: number;
     affectedUsers: number;
     severity: ErrorSeverityLevel;
     environment: string;              // 'production', 'staging', etc.
     metadata: Record<string, unknown>;
   }

   interface CommitAttribution {
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

   interface ProductionImpact {
     errorId: string;
     frequency: 'increasing' | 'stable' | 'decreasing';
     occurrencesLast24h: number;
     occurrencesLast7d: number;
     uniqueUsers: number;
     impactScore: number;              // 0-100
     recommendation: 'hotfix-now' | 'fix-next-sprint' | 'monitor' | 'ignore';
   }

   interface ProductionFeedbackConfig {
     webhookPort?: number;             // default: 5275
     sentryDsn?: string;
     logPaths?: string[];
     autoHotfix: boolean;              // default: false
     impactThreshold: number;          // auto-escalate above this score; default: 70
   }
   ```

6. **CLI surface.**
   ```
   nova26 prod-error "<message>"         # Report a production error
   nova26 prod-error --from-sentry       # Start Sentry webhook listener
   nova26 prod-error --from-log <path>   # Watch a log file
   nova26 prod-error list                # Show recent production errors
   nova26 prod-error trace <id>          # Trace a specific error
   nova26 prod-error fix <id>            # Generate fix for a specific error
   ```

7. **Open questions.** How to handle errors in minified/bundled production code where source
   maps may not be available. How to rate-limit error ingestion to avoid overwhelming Nova26
   with high-volume production errors. Whether to integrate with PagerDuty/Opsgenie for
   alerting (recommend: yes, as a future plugin).

---

### GROK-R17-10: Project Health Dashboard & Executive Reporting

**The analogy:** A car dashboard does not show the driver the RPM of every gear in the
transmission. It shows speed, fuel, temperature, and warning lights. An engineer who wants
to dig deeper looks at the OBD-II diagnostic port. Nova26 has accumulated a wealth of data —
test scores, ACE scores, build history, security scores, debt scores, accessibility scores,
dependency health — but no unified view. A project health dashboard is the car dashboard:
the five numbers that tell you whether the project is healthy, and the diagnostic port for
when you need to investigate.

Produce a complete specification for Nova26's project health dashboard:

1. **Health dimensions.** Define the five core health metrics:
   - **Test Health** (from R16-04): test quality score, mutation score, flaky test count.
   - **Security Health** (from existing): security audit score, vulnerability count.
   - **Code Quality** (from R17-07): technical debt score, complexity trends.
   - **Accessibility Health** (from R17-06): WCAG compliance score.
   - **Dependency Health** (from R17-08): dependency score, CVE count.
   - Each dimension produces a 0-100 score. Overall health is the weighted average.

2. **Trend tracking.** Health scores are computed after every build:
   - Stored in `.nova/health/<project-id>/history.json`.
   - 90-day rolling window.
   - Trend analysis: improving, stable, or degrading.
   - Alerts when a dimension drops below a threshold.

3. **Report generation.** Nova26 generates periodic reports:
   - Daily brief (terminal output): 3-line summary + any alerts.
   - Weekly report (markdown file): full breakdown with trends, recommendations.
   - Stakeholder report (HTML file): executive summary for non-technical stakeholders.

4. **TypeScript interfaces.**
   ```typescript
   interface HealthDimension {
     name: string;
     score: number;                    // 0-100
     weight: number;                   // 0-1
     trend: 'improving' | 'stable' | 'degrading';
     alerts: HealthAlert[];
     details: Record<string, number>;  // dimension-specific sub-scores
   }

   interface HealthAlert {
     id: string;
     dimension: string;
     severity: 'critical' | 'warning' | 'info';
     message: string;
     triggeredAt: string;
     acknowledged: boolean;
   }

   interface ProjectHealth {
     projectId: string;
     computedAt: string;
     overallScore: number;
     grade: 'A' | 'B' | 'C' | 'D' | 'F';
     dimensions: HealthDimension[];
     alerts: HealthAlert[];
     trend: 'improving' | 'stable' | 'degrading';
   }

   interface HealthReport {
     reportId: string;
     projectId: string;
     generatedAt: string;
     type: 'daily' | 'weekly' | 'stakeholder';
     format: 'text' | 'markdown' | 'html';
     content: string;
     healthSnapshot: ProjectHealth;
   }

   interface HealthConfig {
     enabled: boolean;                 // default: true
     computeOnBuild: boolean;          // default: true
     alertThresholds: Record<string, number>; // dimension name → minimum score
     reportSchedule: 'daily' | 'weekly' | 'none';
     stakeholderReportEnabled: boolean; // default: false
   }
   ```

5. **CLI surface.**
   ```
   nova26 health                         # Show current project health
   nova26 health --detail                # Show all dimensions with sub-scores
   nova26 health trend                   # Show 30-day health trend
   nova26 health report                  # Generate weekly report
   nova26 health report --stakeholder    # Generate stakeholder HTML report
   nova26 health alerts                  # Show active alerts
   nova26 health alerts ack <id>         # Acknowledge an alert
   ```

6. **Open questions.** How to weigh dimensions when some are not applicable (e.g., no UI
   project has no accessibility score — should it be excluded or scored at 100?). How to
   make the stakeholder report genuinely useful to non-technical people (recommend: focus on
   risk and progress, not metrics).

---

### GROK-R17-11: Environment & Configuration Management

**The analogy:** A theatre production has different lighting rigs for rehearsal and
performance. Same stage, same actors, same script — but the lighting changes for different
contexts. Software environments work the same way: development, staging, production.
Different API keys, different database URLs, different feature flags. The management of
these differences is tedious, error-prone, and the source of approximately 40% of all
deployment failures. Nova26 can manage the lighting rig.

Produce a complete specification for Nova26's environment and configuration management:

1. **Environment detection and validation.** Nova26 understands environments:
   - Detects environment files (.env, .env.local, .env.production, etc.).
   - Validates that all required variables are present (cross-references code usage).
   - Detects secrets accidentally committed to git.
   - Validates variable values (URL format, port range, boolean strings).

2. **Secret detection and prevention.**
   - Scans all files for patterns that look like secrets: API keys, tokens, passwords,
     connection strings.
   - Pattern library: AWS keys (`AKIA...`), GitHub tokens (`ghp_...`), generic patterns
     (high-entropy strings, `password=`, `secret=`).
   - Pre-commit hook integration: blocks commits containing detected secrets.
   - If a secret is detected: suggests moving it to .env and adding the file to .gitignore.

3. **Feature flag management.**
   - Nova26 tracks feature flags defined in code.
   - Shows which flags are active in which environment.
   - Detects stale flags (flags that are always on or always off across all environments).
   - Suggests cleanup when a flag has been 100% on for 30+ days.

4. **TypeScript interfaces.**
   ```typescript
   type EnvVarStatus = 'present' | 'missing' | 'invalid' | 'unused';

   interface EnvironmentVariable {
     name: string;
     value?: string;                   // masked for secrets
     isSecret: boolean;
     status: EnvVarStatus;
     usedInFiles: string[];
     definedInFiles: string[];
     validationError?: string;
   }

   interface EnvironmentReport {
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

   interface SecretAlert {
     id: string;
     file: string;
     line: number;
     pattern: string;                  // what was detected
     type: 'api-key' | 'token' | 'password' | 'connection-string' | 'generic';
     severity: 'critical' | 'warning';
     suggestion: string;
   }

   interface FeatureFlag {
     name: string;
     definedIn: string;                // file path
     activeIn: string[];               // environments where flag is on
     stale: boolean;
     staleSinceDays?: number;
   }

   interface EnvConfig {
     secretDetectionEnabled: boolean;  // default: true
     preCommitHookEnabled: boolean;    // default: true
     featureFlagTrackingEnabled: boolean; // default: true
     customSecretPatterns: string[];   // regex patterns
   }
   ```

5. **CLI surface.**
   ```
   nova26 env scan                       # Scan all environment files
   nova26 env validate                   # Validate all env vars are present and valid
   nova26 env secrets                    # Scan for exposed secrets
   nova26 env secrets --fix              # Move detected secrets to .env
   nova26 env flags                      # List all feature flags
   nova26 env flags --stale              # Show stale flags
   nova26 env diff dev production        # Compare two environments
   ```

6. **Open questions.** How to handle secrets in CI environments where .env files don't exist.
   How to detect secrets that are encoded (base64, hex) rather than plaintext. Whether Nova26
   should integrate with secret managers (Vault, AWS Secrets Manager) or stay local-only
   (recommend: local-only for v1, plugin for managers later).

---

### GROK-R17-12: Agent Orchestration Optimization & Meta-Learning

**The analogy:** A basketball team does not get better just by having five talented players.
They get better when the coach studies game film, notices that the point guard and the center
have a timing pattern that leads to turnovers, and designs a play that uses the center's
screening ability to create space for the point guard. The improvement comes from understanding
how the players interact, not just how they perform individually. Nova26's 21 agents are
talented individuals. But their coordination can be optimized. Which agents work well together?
Which agent pairs produce errors when they hand off work? When JUPITER's architecture spec
is ambiguous, does MARS always stumble in the same way? This spec asks ATLAS to become the
coach.

Produce a complete specification for Nova26's agent orchestration optimization system:

1. **Agent performance analytics.** Extend ATLAS to track:
   - Per-agent success rates, average ACE scores, retry rates, and duration.
   - Per-agent-pair handoff success rates: when JUPITER hands to MARS, what is the first-attempt
     success rate? When EARTH hands to VENUS, how often does MERCURY reject?
   - Correlation analysis: does high quality from EARTH correlate with fewer retries for MARS?
   - Track all metrics over time to identify trends.

2. **Handoff optimization.** When a task flows from one agent to another:
   - ATLAS analyzes the handoff interface: is the upstream output clear enough for the
     downstream agent?
   - If a handoff has a low success rate (<70%), ATLAS recommends an intermediate step
     (e.g., "add a clarification prompt between JUPITER and MARS").
   - ATLAS can inject "handoff primers" — short context paragraphs that translate upstream
     output into language the downstream agent processes better.

3. **Task routing intelligence.** Currently, tasks are assigned to agents based on fixed rules.
   With meta-learning:
   - ATLAS tracks which agent performs best for each task type.
   - If MARS struggles with auth tasks but excels at CRUD endpoints, ATLAS adjusts the
     routing confidence.
   - ATLAS can recommend task decomposition changes: "MARS performs better when auth tasks
     are split into middleware and handler sub-tasks."

4. **Build retrospective generation.** After each build:
   - ATLAS generates a `BuildRetrospective` analyzing what went well, what went poorly,
     which agents need attention, and specific recommendations.
   - The retrospective feeds back into agent memory (R16-02) as learnings.

5. **TypeScript interfaces.**
   ```typescript
   interface AgentPerformanceProfile {
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

   interface HandoffMetrics {
     fromAgent: string;
     toAgent: string;
     totalHandoffs: number;
     firstAttemptSuccessRate: number;  // 0-1
     avgRetries: number;
     commonFailureReasons: string[];
     primerRecommended: boolean;
     primerText?: string;
   }

   interface BuildRetrospective {
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

   interface OrchestrationConfig {
     metaLearningEnabled: boolean;     // default: true
     retrospectiveEnabled: boolean;    // default: true
     handoffPrimersEnabled: boolean;   // default: true
     routingOptimizationEnabled: boolean; // default: false (experimental)
     minTasksForProfile: number;       // default: 5
   }
   ```

6. **CLI surface.**
   ```
   nova26 agents stats                   # Show agent performance profiles
   nova26 agents stats <name>            # Show specific agent profile
   nova26 agents handoffs                # Show handoff metrics
   nova26 agents retro                   # Generate build retrospective
   nova26 agents retro --last 5          # Retrospective for last 5 builds
   nova26 agents optimize                # Show optimization recommendations
   ```

7. **Open questions.** How many builds of data are needed before meta-learning recommendations
   are reliable (recommend: minimum 10 builds per agent). How to prevent feedback loops where
   ATLAS's routing changes degrade an agent's training data distribution. Whether handoff
   primers should be static (written once, reused) or dynamic (generated per task).

---

## Final Notes

When producing each spec, ensure:
- All TypeScript interfaces have every field documented with types and defaults.
- Integration points reference specific existing agents by name (MARS, VENUS, etc.).
- CLI commands are concrete and follow the existing `nova26 <noun> <verb>` pattern.
- Open questions are genuine implementation challenges, not stalling tactics.
- Each spec is independently actionable — a coding AI should be able to implement it from
  the interfaces alone without needing to ask follow-up questions.
