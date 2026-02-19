# KIMI TASK FILE — ACE Playbook System + Rehearsal Stage

> Owner: Kimi
> Priority: 2 (ACE Playbook System) and Priority 3 (Rehearsal Stage)
> Prerequisite: KIMI-VAULT-01 through KIMI-VAULT-06 complete and merged to main
> Spec sources: GROK-R7-01 (ACE), GROK-R7-02 (Rehearsal Stage), GROK-R7-03 (Self-Improvement)
> Test baseline: 872 + 75 (from Taste Vault sprint) = 947+ tests passing, 0 TypeScript errors

---

## Context

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. You just
finished KIMI-VAULT-01 through KIMI-VAULT-06, which implemented the Living Taste Vault
(graph-based per-user memory) and the Global Wisdom Pipeline. That work lives in:

- `src/taste-vault/graph-memory.ts` — low-level graph engine
- `src/taste-vault/taste-vault.ts` — per-user high-level API with tier enforcement
- `src/taste-vault/global-wisdom.ts` — cross-user aggregation pipeline

The ACE Playbook System makes the Generator -> Reflector -> Curator cycle stateful. Right
now every agent starts each task from a blank slate — no memory of past wins or losses at
the task-type level, no structured recipe for approaching a class of problem. Playbooks
change that. A Playbook accumulates wins and losses over time, evolving from a static
template into a learned heuristic that modifies what the Generator produces, what the
Reflector evaluates, and how the Curator ranks alternatives.

The Rehearsal Stage gives agents the ability to explore 2-3 alternative implementations
before committing. Rather than producing one output and running it through gates, an agent
can stage multiple branches, score them, and surface the winner to the user. This is a
premium-only feature — the computational overhead is real and the value is targeted at the
$250-$500/month buyer.

The Self-Improvement Protocol is the per-agent personality layer. Agents track their own
performance history — which task types they excel at, which approaches correlate with gate
failures, which style preferences users have expressed — and adapt their behavior over time.

**The existing inner loop hooks (where you will integrate):**
- `src/agent-loop/agent-loop.ts` — ReAct inner loop, tool use, scratchpad
- `src/orchestrator/ralph-loop.ts` — outer build orchestration, `processTask()` function
- `src/orchestrator/prompt-builder.ts` — `buildPrompt()`, `buildAgenticUserPrompt()`, `buildVaultContext()`
- `src/tools/tool-registry.ts` — singleton pattern, tool registration, permissions

**New directories you will create:**
- `src/ace/` — ACE Playbook System (generator, reflector, curator, playbook manager)
- `src/rehearsal/` — Rehearsal Stage (stage orchestrator, branch manager, scorer)
- `src/agents/self-improvement.ts` — Self-Improvement Protocol (add to existing agents dir)

---

## Global Rules (apply to every task)

- **TypeScript strict mode** — no `any`, no implicit `any`, no `@ts-ignore`
- **ESM imports** — always use `.js` extensions on relative imports (e.g., `import { Foo } from './foo.js'`)
- **Zod for all external/runtime data validation** — validate at system boundaries, especially when reading persisted JSON
- **Tests with vitest** — all new tests use `import { describe, it, expect, vi } from 'vitest'`
- **Do not break existing tests** — `npx vitest run` must show 947+ passing after each task
- **Zero TypeScript errors** — `npx tsc --noEmit` must report 0 errors after every task
- **Commit to main when done** — one commit per KIMI-ACE task, commit message format: `feat(ace): KIMI-ACE-XX <short description>`
- **Reference existing patterns** — follow conventions in `src/tools/tool-registry.ts` (class + singleton factory + `reset*` for tests) and `src/taste-vault/graph-memory.ts` (which you just wrote)
- **File header comments** — every new file starts with a 2-line comment: `// <Short description>\n// <Which spec this implements>`
- **No new npm dependencies** without a compelling reason — this codebase has enough deps already

---

## KIMI-ACE-01: ACE Playbook Core

**File:** `src/ace/playbook.ts`
**Target size:** ~200 lines
**Spec:** GROK-R7-01

### What to build

The `PlaybookManager` is the persistence and retrieval layer for agent playbooks. A Playbook
is a per-agent, per-task-type structured recipe that accumulates wins and losses, evolving
from a static template into a learned heuristic. The PlaybookManager reads from and writes
to `.nova/ace/playbooks/{agent}.json`.

### Core interfaces

```typescript
// Every rule in a playbook is either explicitly authored or learned from outcomes
export type RuleSource = 'learned' | 'manual' | 'global';

export interface PlaybookRule {
  id: string;                   // nanoid or crypto.randomUUID()
  content: string;              // Human-readable rule: "Always run tsc before returning output"
  source: RuleSource;           // How this rule was created
  confidence: number;           // 0–1, starts at 0.7 for learned rules, 1.0 for manual
  appliedCount: number;         // How many times this rule was injected into a prompt
  successCount: number;         // How many times tasks where this was applied succeeded
  createdAt: string;            // ISO timestamp
  updatedAt: string;            // ISO timestamp
  tags: string[];               // e.g. ['typescript', 'testing', 'auth']
}

export interface Playbook {
  id: string;
  agentName: string;            // Matches AgentName union type (MARS, VENUS, etc.)
  rules: PlaybookRule[];
  version: number;              // Incremented each time rules are modified by curator
  lastUpdated: string;          // ISO timestamp
  taskTypes: string[];          // Which task types this playbook applies to ('' = all)
  totalTasksApplied: number;    // Lifetime count of tasks where this playbook was used
  successRate: number;          // 0–1, computed from outcome history
}
```

### PlaybookDelta interface

`PlaybookDelta` is the output of the Reflector — a proposed change to a playbook rule.
It is produced after a task completes and fed to the Curator for filtering and application.

```typescript
export type DeltaType = 'Strategy' | 'Mistake' | 'Preference' | 'Pattern' | 'Decision';

export interface PlaybookDelta {
  nodeId: string;               // ID of the rule being created or modified
  type: DeltaType;
  content: string;              // The proposed rule content
  helpfulDelta: number;         // How much this helps (0–1)
  harmfulDelta: number;         // How much this hurts (0–1, for Mistake nodes)
  tags: string[];
  isGlobalCandidate: boolean;   // True if this rule is good enough to share globally
  confidence: number;           // How confident the Reflector is in this delta (0–1)
  agentName: string;            // Which agent produced this delta
  taskId: string;               // Which task triggered this delta
  createdAt: string;
}
```

### PlaybookManager class

```typescript
class PlaybookManager {
  // Retrieval
  getPlaybook(agentName: string): Promise<Playbook>
  // Returns existing playbook for agent, or creates a default empty playbook if none exists.
  // Loads from .nova/ace/playbooks/{agentName}.json on first call.

  getActiveRules(agentName: string, context: string, limit?: number): Promise<PlaybookRule[]>
  // Returns top `limit` rules (default 10) relevant to the context string.
  // Relevance = confidence * (successCount / Math.max(appliedCount, 1)) * keyword overlap.
  // Keyword overlap: tokenize context string and count matching words in rule content.
  // Sort descending by relevance score, return top N.

  // Mutation
  updatePlaybook(agentName: string, deltas: PlaybookDelta[]): Promise<Playbook>
  // Applies deltas to the playbook:
  //   - If delta.nodeId matches an existing rule ID, update that rule's content + confidence.
  //   - If no match, create a new PlaybookRule from the delta.
  //   - Increment playbook.version.
  //   - Update playbook.lastUpdated.
  // Persists immediately after update.

  incrementApplied(agentName: string, ruleIds: string[]): Promise<void>
  // Called after rules are injected into a prompt. appliedCount++ for each rule.

  recordSuccess(agentName: string, ruleIds: string[]): Promise<void>
  // Called after a task succeeds. successCount++ for each rule that was applied.
  // Also updates playbook.successRate = totalSuccesses / totalTasksApplied.

  recordTaskApplied(agentName: string): Promise<void>
  // totalTasksApplied++ on the playbook.

  // Global candidates
  getGlobalCandidates(agentName: string): Promise<PlaybookRule[]>
  // Returns rules where: confidence >= 0.85 AND successCount >= 3 AND source !== 'global'

  // Persistence
  persist(agentName: string): Promise<void>
  // Write to .nova/ace/playbooks/{agentName}.json
  // Create parent directories if they do not exist.

  load(agentName: string): Promise<Playbook | null>
  // Read from .nova/ace/playbooks/{agentName}.json
  // Return null if file does not exist (caller should call getPlaybook() which handles default).

  clear(agentName: string): void
  // Remove from in-memory cache only — for tests. Does not delete the JSON file.
}
```

### Singleton factory (match tool-registry.ts pattern)

```typescript
export function getPlaybookManager(): PlaybookManager
export function resetPlaybookManager(): void  // for tests
```

### Default playbook for new agents

When `getPlaybook()` is called for an agent with no existing playbook, return:

```typescript
{
  id: crypto.randomUUID(),
  agentName,
  rules: [],
  version: 0,
  lastUpdated: new Date().toISOString(),
  taskTypes: [],
  totalTasksApplied: 0,
  successRate: 0,
}
```

### Persistence path

`.nova/ace/playbooks/{agentName}.json` — where `{agentName}` is lowercased (e.g., `mars.json`).
Use `fs/promises` for async reads and writes. Use Zod to validate the shape of the JSON
when loading (schema must match `Playbook` interface). If validation fails, log a warning
and return a fresh default playbook — do not throw.

---

## KIMI-ACE-02: Generator, Reflector, and Curator

**Files:** `src/ace/generator.ts`, `src/ace/reflector.ts`, `src/ace/curator.ts`
**Target size:** ~300 lines total across 3 files
**Spec:** GROK-R7-01

### generator.ts — AceGenerator

The Generator analyzes an incoming task, retrieves active playbook rules, and enriches
the prompt context before the LLM call. It does not make the LLM call itself — it prepares
the playbook context string that `prompt-builder.ts` will inject.

```typescript
class AceGenerator {
  // Main method: prepare playbook context for a task
  async analyzeTask(
    task: Task,
    agentName: string,
    tokenBudget: number
  ): Promise<{ playbookContext: string; appliedRuleIds: string[] }>
  // 1. Call getPlaybookManager().getActiveRules(agentName, task.description, 10)
  // 2. Format rules into a <playbook_context> XML block (see format below)
  // 3. Enforce token budget: estimate tokens as Math.ceil(text.length / 4)
  //    If context exceeds budget, trim rules from the bottom (lowest relevance first)
  // 4. Call getPlaybookManager().incrementApplied(agentName, appliedRuleIds)
  // 5. Return { playbookContext, appliedRuleIds }
}
```

**Format of playbook context block:**

```xml
<playbook_context agent="MARS" version="7" rules_applied="5">
- [Strategy, confidence: 0.92] Always run tsc before returning output
- [Pattern, confidence: 0.88] Validate all Convex mutation args with Zod
- [Preference, confidence: 0.81] Keep component files under 150 lines
- [Decision, confidence: 0.79] Use Math.floor() for integer arithmetic, not Math.round()
- [Mistake, confidence: 0.75] Do not use setTimeout() in Convex mutations — they are serverless
</playbook_context>
```

### reflector.ts — AceReflector

The Reflector runs after a task completes. It examines the task outcome and produces
`PlaybookDelta[]` — proposed changes to the agent's playbook. It uses an LLM call with
a specialized prompt.

```typescript
class AceReflector {
  async reflectOnOutcome(
    task: Task,
    outcome: { success: boolean; output: string; gateScore?: number },
    playbook: Playbook
  ): Promise<PlaybookDelta[]>
  // 1. Build the reflector prompt (see prompt template below)
  // 2. Make a cheap LLM call (use the model configured in the existing LLM client,
  //    prefer a fast model if one is configured — Qwen 7B or equivalent)
  // 3. Parse the LLM response into PlaybookDelta[]
  //    - Parse JSON from the LLM response. Use Zod to validate.
  //    - If parsing fails, return [] and log a warning (never throw).
  // 4. Filter: discard any delta with confidence < 0.5
  // 5. Cap at 5 deltas per reflection (return top 5 by confidence)
}
```

**Reflector prompt template:**

```
You are the ACE Reflector for agent {agentName} in Nova26.

Your job: analyze the outcome of the task below and produce a list of proposed rule
changes for the agent's playbook. Rules should encode what the agent should do MORE of
(type: Strategy, Pattern, Preference, Decision) or AVOID (type: Mistake).

Task title: {task.title}
Task description: {task.description}
Outcome: {success ? 'SUCCESS' : 'FAILURE'}
Gate score: {gateScore ?? 'not recorded'}
Agent output (first 500 chars): {output.slice(0, 500)}

Current playbook rules ({playbook.rules.length} rules):
{playbook.rules.slice(0, 5).map(r => `- ${r.content}`).join('\n')}

Produce a JSON array of PlaybookDelta objects. Each delta must have:
- nodeId: a new UUID (crypto.randomUUID())
- type: one of "Strategy" | "Mistake" | "Preference" | "Pattern" | "Decision"
- content: the rule text (max 120 chars, imperative form)
- helpfulDelta: 0.0–1.0 (how much this helps)
- harmfulDelta: 0.0–1.0 (only > 0 for Mistake type)
- tags: string[] (1–3 relevant tags)
- isGlobalCandidate: boolean (true if generally useful beyond this user)
- confidence: 0.0–1.0 (how confident you are in this rule)
- agentName: "{agentName}"
- taskId: "{task.id}"
- createdAt: ISO timestamp

Respond with ONLY a JSON array. No prose. No markdown fences. Max 5 items.
If the outcome provides no clear signal for a rule change, return [].
```

### curator.ts — AceCurator

The Curator receives deltas from the Reflector, filters them, deduplicates against the
existing playbook, scores them, and applies the surviving deltas to the playbook.

```typescript
class AceCurator {
  async curate(
    deltas: PlaybookDelta[],
    agentName: string
  ): Promise<{ applied: PlaybookDelta[]; rejected: PlaybookDelta[]; newPlaybook: Playbook }>
  // 1. Retrieve current playbook via getPlaybookManager().getPlaybook(agentName)
  // 2. Deduplicate: for each delta, check if any existing rule has Jaccard similarity >= 0.65
  //    with delta.content (tokenize on whitespace, compute overlap / union).
  //    If too similar AND existing rule confidence >= delta.confidence → reject delta.
  //    If too similar AND existing rule confidence < delta.confidence → replace (update) existing rule.
  // 3. Score survivors: score = delta.helpfulDelta * 0.6 + delta.confidence * 0.4 - delta.harmfulDelta * 0.3
  //    Clamp to [0, 1].
  // 4. Reject any delta where score < 0.4
  // 5. Cap total applied deltas at 3 per curation run (take top 3 by score)
  // 6. Apply: call getPlaybookManager().updatePlaybook(agentName, surviving deltas)
  // 7. For deltas where isGlobalCandidate is true AND score >= 0.75:
  //    call getTasteVault().learn() to store the rule as a global candidate Pattern node.
  // 8. Return { applied, rejected, newPlaybook }

  // Standalone deduplication utility (exported for tests)
  isDuplicate(
    deltaContent: string,
    existingRules: PlaybookRule[],
    threshold?: number  // default 0.65
  ): { isDuplicate: boolean; matchedRule?: PlaybookRule }
}
```

**Singleton factories:**

```typescript
export function getAceGenerator(): AceGenerator
export function resetAceGenerator(): void

export function getAceReflector(): AceReflector
export function resetAceReflector(): void

export function getAceCurator(): AceCurator
export function resetAceCurator(): void
```

---

## KIMI-ACE-03: Rehearsal Stage

**Files:** `src/rehearsal/stage.ts`, `src/rehearsal/branch-manager.ts`, `src/rehearsal/scorer.ts`
**Target size:** ~350 lines total
**Spec:** GROK-R7-02
**Access control:** Premium-only feature. Check `process.env.NOVA26_TIER === 'premium'` before running.

### Data structures

```typescript
// branch-manager.ts

export type BranchStrategy = 'in-memory';
// Note: Git worktrees are too heavy for local dev. Convex sandbox is future work.
// This sprint implements in-memory diffs only. The interface is designed to support
// other strategies later without breaking callers.

export interface BranchFile {
  path: string;         // Relative file path, e.g. 'src/components/Button.tsx'
  originalContent: string;
  proposedContent: string;
}

export interface RehearsalBranch {
  id: string;
  description: string;           // One-sentence description of this approach
  strategy: BranchStrategy;      // Always 'in-memory' for now
  files: BranchFile[];           // The proposed file changes for this branch
  createdAt: string;
  status: 'pending' | 'executed' | 'scored' | 'rejected';
  agentNotes: string;            // Agent's own assessment of this branch
}

// scorer.ts

export interface ScoreBreakdown {
  typeCheckPass: number;         // 0 or 1 (binary)
  lineDelta: number;             // 0–1 score: shorter is better if functionally equivalent
  agentSelfAssessment: number;   // 0–1 as reported by the agent
  tasteAlignment: number;        // 0–1 alignment with Taste Vault patterns (0 if no vault)
  compositeScore: number;        // Weighted final score (see formula below)
}

export interface RehearsalResult {
  branchId: string;
  score: number;                 // 0–1 composite
  scoreBreakdown: ScoreBreakdown;
  summary: string;               // 1-2 sentence prose summary of this branch
  tasteAlignment: number;        // Mirror of scoreBreakdown.tasteAlignment for quick access
  estimatedQuality: 'low' | 'medium' | 'high';  // Derived from compositeScore
  previewSnippet: string;        // First 300 chars of the primary changed file
}

// stage.ts

export interface RehearsalOptions {
  branchCount?: number;          // How many branches to generate (default 2, max 3)
  strategyHint?: BranchStrategy; // Currently ignored (always in-memory), reserved for future
  forceRehearse?: boolean;       // Override shouldRehearse() check
}

export interface RehearsalSession {
  id: string;
  taskId: string;
  agentName: string;
  branches: RehearsalBranch[];
  results: RehearsalResult[];
  winner?: string;               // branchId of the chosen winner
  userApproved?: boolean;        // undefined if auto-selected, true/false if user decided
  createdAt: string;
  completedAt?: string;
}
```

### stage.ts — RehearsalStage

```typescript
class RehearsalStage {
  // Main entry point
  async rehearse(
    task: Task,
    agentName: string,
    options?: RehearsalOptions
  ): Promise<RehearsalSession>
  // 1. Verify NOVA26_TIER === 'premium'. If not, throw Error('Rehearsal Stage requires premium tier')
  // 2. Check options.forceRehearse OR shouldRehearse(task). If neither, throw Error('Task does not meet rehearsal threshold')
  // 3. Generate branches via BranchManager.createBranches(task, agentName, branchCount)
  // 4. Score each branch via RehearsalScorer.score(branch)
  // 5. Select winner: highest compositeScore wins
  // 6. Build RehearsalSession with all branches and results
  // 7. Log summary to console (see format below)
  // 8. Return session

  // Decision function
  shouldRehearse(task: Task): boolean
  // Returns true if ANY of these conditions is met:
  //   - task.complexity > 0.7 (if task has a complexity field; otherwise estimate from description length > 500 chars)
  //   - task.description.toLowerCase().includes('schema') OR task.description.toLowerCase().includes('migration')
  //   - task.description.toLowerCase().includes('rehearse') (user explicitly requested it)
  // Returns false otherwise.

  // Formatted summary for console output
  formatSummary(session: RehearsalSession): string
  // Format:
  // === Rehearsal Stage: {task.title} ===
  // Branches explored: {session.branches.length}
  // Winner: Branch {winner.description} (score: {winner.score.toFixed(2)})
  // Runner-up: Branch {runnerUp.description} (score: {runnerUp.score.toFixed(2)})
  // Key differences: [top 2 differences between winner and runner-up file sets]
  // Auto-applied: winner (no user prompt in autonomy >= 3 mode)
}
```

### branch-manager.ts — BranchManager

```typescript
class BranchManager {
  async createBranches(
    task: Task,
    agentName: string,
    count: number
  ): Promise<RehearsalBranch[]>
  // Makes `count` LLM calls (cheap model), each with a different approach prompt.
  // Approach 1: "straightforward and minimal — implement the simplest correct solution"
  // Approach 2: "optimized and idiomatic — use the most TypeScript-idiomatic patterns"
  // Approach 3 (if count >= 3): "defensive — add extensive error handling and validation"
  //
  // Each LLM call returns a JSON object: { description: string; files: BranchFile[]; agentNotes: string }
  // Validate with Zod. If an LLM call fails or returns invalid JSON, skip that branch
  // (log warning, do not throw — return however many valid branches were created, minimum 1).

  cleanupBranches(branches: RehearsalBranch[]): void
  // For in-memory strategy: set all branch.status = 'rejected' for non-winner branches.
  // Clears the files arrays from rejected branches to free memory (set files to []).
  // This is a no-op for in-memory strategy beyond the above — no filesystem cleanup needed.
}
```

**Branch generation prompt template:**

```
You are a Nova26 branch generator for agent {agentName}.

Your task: implement the following task using the approach described below.
Return ONLY a JSON object. No prose. No markdown fences.

Task title: {task.title}
Task description: {task.description}

Approach: {approachDescription}

Return this exact JSON shape:
{
  "description": "one sentence describing this implementation approach",
  "files": [
    {
      "path": "relative/file/path.ts",
      "originalContent": "existing file content or empty string if new file",
      "proposedContent": "your implementation"
    }
  ],
  "agentNotes": "your 1-2 sentence self-assessment of this approach's strengths"
}
```

### scorer.ts — RehearsalScorer

```typescript
class RehearsalScorer {
  async score(branch: RehearsalBranch): Promise<RehearsalResult>
  // Compute each dimension, then compositeScore.

  // Scoring dimensions:

  // typeCheckPass (weight 0.35):
  //   Cannot run real tsc in-memory without disk writes.
  //   Use a heuristic: scan proposedContent for obvious type errors:
  //     - untyped function params (pattern: /\((\w+)[,)]/g where param has no ':')
  //     - usage of 'any' keyword
  //   If no issues found: 1.0. Each issue found: subtract 0.15. Floor at 0.0.

  // lineDelta (weight 0.15):
  //   For each BranchFile, compute:
  //     originalLines = originalContent.split('\n').length (or 0 if new file)
  //     proposedLines = proposedContent.split('\n').length
  //     delta = proposedLines - originalLines
  //   Aggregate across all files. Score: 1.0 if delta <= 0, linearly decay to 0.5 at +200 lines.
  //   Formula: Math.max(0.5, 1.0 - Math.max(0, totalDelta) / 400)

  // agentSelfAssessment (weight 0.25):
  //   Parse branch.agentNotes for confidence signal.
  //   Heuristic: if notes contain "confident" or "straightforward" or "clean" → 0.85
  //              if notes contain "complex" or "workaround" or "hacky" → 0.55
  //              otherwise → 0.7

  // tasteAlignment (weight 0.25):
  //   Get relevant patterns from TasteVault for task.description (limit 5).
  //   For each pattern, check if any proposedContent contains pattern keywords (tokenize + overlap).
  //   Score = (matching patterns / total patterns retrieved). If vault is empty: 0.5 (neutral).

  // compositeScore:
  //   typeCheckPass * 0.35 + lineDelta * 0.15 + agentSelfAssessment * 0.25 + tasteAlignment * 0.25
  //   Clamp to [0, 1].

  // estimatedQuality:
  //   >= 0.8 → 'high'
  //   >= 0.55 → 'medium'
  //   < 0.55 → 'low'

  // previewSnippet:
  //   First changed file's proposedContent.slice(0, 300)
}
```

**Singleton factories:**

```typescript
// stage.ts
export function getRehearsalStage(): RehearsalStage
export function resetRehearsalStage(): void

// branch-manager.ts
export function getBranchManager(): BranchManager
export function resetBranchManager(): void

// scorer.ts
export function getRehearsalScorer(): RehearsalScorer
export function resetRehearsalScorer(): void
```

---

## KIMI-ACE-04: Agent Self-Improvement

**File:** `src/agents/self-improvement.ts`
**Target size:** ~200 lines
**Spec:** GROK-R7-03

### What to build

The `SelfImprovementProtocol` runs a periodic review of an agent's performance history.
After the agent has completed at least 5 tasks, it analyzes its outcomes, generates
proposed rule updates (using the Reflector internally), and applies guardrailed changes
to the agent's playbook. This is the mechanism by which agents evolve their approach
over weeks and months of use.

### Data structures

```typescript
export interface AgentPerformanceProfile {
  agentName: string;
  totalTasks: number;
  successRate: number;            // 0–1
  avgGateScore: number;           // 0–1, average across all tasks that had a gate score
  strongTaskTypes: string[];      // task types with >= 80% success rate (min 3 samples)
  weakTaskTypes: string[];        // task types with <= 40% success rate (min 3 samples)
  recentOutcomes: PerformanceOutcome[];  // last 20 outcomes (rolling window)
  lastReviewedAt: string;         // ISO timestamp of last self-improvement run
  lastUpdated: string;
}

export interface PerformanceOutcome {
  taskId: string;
  taskTitle: string;
  taskType: string;               // Derived from task.phase or first word of task.title
  success: boolean;
  gateScore?: number;
  appliedRuleIds: string[];       // Playbook rules that were active during this task
  timestamp: string;
}

export interface StyleAdaptation {
  preference: string;             // e.g. "Keep components under 150 lines"
  source: 'taste-vault' | 'self-observed';
  confidence: number;
  appliedCount: number;
}
```

### SelfImprovementProtocol class

```typescript
class SelfImprovementProtocol {
  // Record an outcome (call this after every task in ralph-loop.ts)
  async recordOutcome(
    agentName: string,
    outcome: Omit<PerformanceOutcome, 'timestamp'>
  ): Promise<void>
  // Append to recentOutcomes (capped at 20 — drop oldest when full).
  // Recompute successRate, avgGateScore, strongTaskTypes, weakTaskTypes.
  // Persist profile.

  // Get current profile (creates default if not found)
  async getProfile(agentName: string): Promise<AgentPerformanceProfile>

  // Run the self-improvement review
  async runReview(agentName: string): Promise<{
    rulesAdded: number;
    rulesModified: number;
    reviewSummary: string;
  }>
  // Preconditions:
  //   - profile.totalTasks >= 5 (hard minimum — return early with message if not met)
  //   - profile.lastReviewedAt is undefined OR more than 7 days ago
  //     (prevent spammy reviews — return early with message if too recent)
  //
  // Process:
  //   1. Get current playbook via PlaybookManager.getPlaybook(agentName)
  //   2. Identify top 3 failing patterns:
  //        - Group recentOutcomes by taskType
  //        - Find taskTypes with successRate < 0.5
  //        - For each, collect the appliedRuleIds that were active during failures
  //   3. Identify top 3 succeeding patterns (taskType successRate >= 0.8)
  //   4. Synthesize rule changes:
  //        - For each failing taskType: create a PlaybookDelta of type 'Mistake'
  //          with content = "Caution: {taskType} tasks have {failRate}% failure rate — review approach"
  //          confidence = 0.65, helpfulDelta = 0.0, harmfulDelta = 0.8
  //        - For each succeeding taskType: create a PlaybookDelta of type 'Strategy'
  //          with content = "Strong performance on {taskType} tasks — apply same approach"
  //          confidence = 0.75, helpfulDelta = 0.8, harmfulDelta = 0.0
  //   5. Guardrails (enforce BEFORE applying):
  //        a. Max 3 rule changes per review (take top 3 by Math.abs(helpfulDelta - harmfulDelta))
  //        b. Any delta with confidence < 0.7 must NOT be auto-applied — log it as
  //           "pending human review" instead (store in profile.pendingDeltas, do not pass to curator)
  //        c. Do not create a 'Mistake' rule for a taskType if fewer than 3 samples exist
  //   6. Apply surviving deltas via AceCurator.curate()
  //   7. Also sync with Taste Vault:
  //        - Call getTasteVault().learnFromBuildResult() for each strong pattern
  //        - Store the performance profile summary as a Pattern node in the vault
  //   8. Update profile.lastReviewedAt = now
  //   9. Persist profile
  //   10. Return { rulesAdded, rulesModified, reviewSummary }

  // Utility: read style preferences from Taste Vault for an agent
  async getStyleAdaptations(agentName: string, userId: string): Promise<StyleAdaptation[]>
  // 1. Get relevant patterns from TasteVault where tags include agentName.toLowerCase()
  // 2. Convert each pattern node into a StyleAdaptation
  // 3. Return sorted by confidence descending

  // Persistence
  async persist(agentName: string): Promise<void>
  // Write to .nova/ace/profiles/{agentName}.json

  async load(agentName: string): Promise<AgentPerformanceProfile | null>
  // Read from .nova/ace/profiles/{agentName}.json. Return null if not found.
}
```

**Singleton factory:**

```typescript
export function getSelfImprovementProtocol(): SelfImprovementProtocol
export function resetSelfImprovementProtocol(): void
```

---

## KIMI-ACE-05: Integration

**Files:** `src/orchestrator/ralph-loop.ts` (modify), `src/agent-loop/agent-loop.ts` (modify), `src/orchestrator/prompt-builder.ts` (modify)
**Target size:** ~150 lines of new/modified code total
**Spec:** GROK-R7-01, GROK-R7-02

### Read these files before touching them

Read the full contents of each file before making any changes. Understand the existing
flow, variable names, and where the key phases happen (LLM call, gate check, task
completion). Make surgical additions — do not restructure existing logic.

### prompt-builder.ts changes

Add two new exports and modify the existing `buildAgenticUserPrompt` function.

**New export: `buildPlaybookContext`**

```typescript
export async function buildPlaybookContext(
  agentName: string,
  taskDescription: string,
  tokenBudget: number
): Promise<{ context: string; appliedRuleIds: string[] }>
// 1. Call getAceGenerator().analyzeTask(task, agentName, tokenBudget)
//    (Pass a minimal Task-shaped object if you only have title + description)
// 2. Return the playbookContext string and appliedRuleIds.
// If PlaybookManager or AceGenerator is unavailable, return { context: '', appliedRuleIds: [] }
// Never throw from this function.
```

**New export: `buildRehearsalContext`**

```typescript
export async function buildRehearsalContext(
  session: RehearsalSession | null
): Promise<string>
// If session is null or session.results is empty, return ''.
// Otherwise format:
// <rehearsal_context>
// <winner branch="{winner.description}" score="{winner.score.toFixed(2)}" quality="{winner.estimatedQuality}">
// {winner.previewSnippet}
// </winner>
// <runner_up branch="{runnerUp.description}" score="{runnerUp.score.toFixed(2)}"/>
// </rehearsal_context>
```

**Modify `buildAgenticUserPrompt` (or equivalent function):**

After the existing vault context block is appended (from KIMI-VAULT-04), also append
the playbook context:

```typescript
const { context: playbookCtx, appliedRuleIds } = await buildPlaybookContext(
  agentName,
  taskDescription,
  Math.floor(tokenBudget * 0.10)  // 10% of token budget for playbook context
);
if (playbookCtx) {
  prompt += '\n' + playbookCtx;
}
// Store appliedRuleIds for later reinforcement (use the same module-level Map pattern
// as trackInjectedVaultNodes from KIMI-VAULT-05)
```

**New module-level tracking (match KIMI-VAULT-05 pattern):**

```typescript
const injectedPlaybookRuleIds = new Map<string, string[]>();  // taskId → ruleIds
export function trackInjectedPlaybookRules(taskId: string, ruleIds: string[]): void
export function getInjectedPlaybookRuleIds(taskId: string): string[]
export function clearInjectedPlaybookRuleIds(taskId: string): void
```

### ralph-loop.ts changes

Make the following additions to `processTask()`. Read the file first to identify the
exact insertion points — do not guess at line numbers since the file may have changed.

**Before the LLM call (task preparation phase):**

```typescript
// ACE: retrieve active playbook rules and inject into prompt context
// (actual injection happens in prompt-builder.ts — this just ensures the playbook is loaded)
const playbookManager = getPlaybookManager();
await playbookManager.getPlaybook(task.agent);  // pre-warm cache

// Rehearsal Stage: check if task warrants a rehearsal (premium only)
let rehearsalSession: RehearsalSession | null = null;
if (process.env.NOVA26_TIER === 'premium' && getRehearsalStage().shouldRehearse(task)) {
  try {
    rehearsalSession = await getRehearsalStage().rehearse(task, task.agent);
    console.log(`  Rehearsal Stage: explored ${rehearsalSession.branches.length} branches, winner score: ${rehearsalSession.results[0]?.score.toFixed(2) ?? 'n/a'}`);
  } catch (err) {
    console.warn(`  Rehearsal Stage skipped: ${err instanceof Error ? err.message : String(err)}`);
  }
}
```

**After successful gate pass (task.status = 'done' phase):**

```typescript
// ACE: reinforce playbook rules that were applied during this task
const appliedRuleIds = getInjectedPlaybookRuleIds(task.id);
if (appliedRuleIds.length > 0) {
  await getPlaybookManager().recordSuccess(task.agent, appliedRuleIds);
}
clearInjectedPlaybookRuleIds(task.id);

// ACE: record outcome in self-improvement protocol
await getSelfImprovementProtocol().recordOutcome(task.agent, {
  taskId: task.id,
  taskTitle: task.title,
  taskType: task.phase ?? task.title.split(' ')[0],
  success: true,
  appliedRuleIds,
});

// ACE: run reflector and curator to evolve the playbook
if (options.autonomyLevel !== undefined && options.autonomyLevel >= 3) {
  const playbook = await getPlaybookManager().getPlaybook(task.agent);
  const deltas = await getAceReflector().reflectOnOutcome(
    task,
    { success: true, output: response.content, gateScore: gateResult?.score },
    playbook
  );
  if (deltas.length > 0) {
    const curation = await getAceCurator().curate(deltas, task.agent);
    console.log(`  ACE: applied ${curation.applied.length} playbook update(s), rejected ${curation.rejected.length}`);
  }
}

// ACE: record task applied count
await getPlaybookManager().recordTaskApplied(task.agent);
```

**After gate failure (task.status = 'failed' phase):**

```typescript
// ACE: record failure outcome
await getSelfImprovementProtocol().recordOutcome(task.agent, {
  taskId: task.id,
  taskTitle: task.title,
  taskType: task.phase ?? task.title.split(' ')[0],
  success: false,
  appliedRuleIds: getInjectedPlaybookRuleIds(task.id),
});
clearInjectedPlaybookRuleIds(task.id);
await getPlaybookManager().recordTaskApplied(task.agent);
```

**At session end (after `console.log('\n=== Ralph Loop finished ===')`):**

```typescript
// ACE: run self-improvement reviews for all agents that have enough task history
const protocol = getSelfImprovementProtocol();
for (const agentName of uniqueAgents) {  // collect unique agents from completed tasks
  const profile = await protocol.getProfile(agentName);
  if (profile.totalTasks >= 5) {
    const review = await protocol.runReview(agentName);
    if (review.rulesAdded > 0 || review.rulesModified > 0) {
      console.log(`  ACE Self-Improvement [${agentName}]: ${review.reviewSummary}`);
    }
  }
}
```

### agent-loop.ts changes

In `AgentLoop`, when building the system prompt or user prompt for the agent, inject
the playbook context. Look for where `buildPrompt()` or `buildAgenticUserPrompt()` is
called — the integration is through those functions, which you already modified in
`prompt-builder.ts`. Verify the agentName is threaded through to `buildPlaybookContext`.

If `agentName` is not currently passed into `buildPrompt()`, add it as an optional
parameter with a default of `'UNKNOWN'`. Do not break the existing call signature for
callers that do not pass agentName.

**Also add autonomy-level check in agent-loop.ts:**

In `AgentLoopConfig`, add:

```typescript
autonomyLevel?: number;  // Mirror of RalphLoopOptions.autonomyLevel — controls ACE activation
```

Pass `autonomyLevel` through from `RalphLoopOptions` when creating `AgentLoop` instances
in `ralph-loop.ts`.

**RalphLoopOptions additions (in the types file or inline):**

```typescript
acePlaybooks?: boolean;      // Enable ACE Playbook System (default false)
rehearsalStage?: boolean;    // Enable Rehearsal Stage, premium-only (default false)
```

---

## KIMI-ACE-06: Tests

**Files:**
- `src/ace/playbook.test.ts`
- `src/ace/ace-cycle.test.ts`
- `src/rehearsal/rehearsal.test.ts`
- `src/agents/self-improvement.test.ts`
- `src/ace/integration.test.ts`

**Target:** 85+ new tests. All must pass. Existing 947+ tests must still pass.

### playbook.test.ts (~20 tests)

Cover:

- `getPlaybook()` returns a default playbook for a new agent (no JSON file)
- `getPlaybook()` loads from disk when JSON file exists
- `getPlaybook()` returns the same instance on second call (singleton cache)
- `updatePlaybook()` adds a new rule when delta has no matching nodeId
- `updatePlaybook()` updates existing rule content and confidence when nodeId matches
- `updatePlaybook()` increments playbook.version on each call
- `updatePlaybook()` updates playbook.lastUpdated timestamp
- `getActiveRules()` returns rules sorted by relevance (confidence * success rate * overlap)
- `getActiveRules()` respects the `limit` parameter
- `getActiveRules()` returns empty array for agent with no rules
- `incrementApplied()` increments appliedCount on specified rules
- `recordSuccess()` increments successCount on specified rules
- `recordTaskApplied()` increments totalTasksApplied
- `getGlobalCandidates()` returns only rules with confidence >= 0.85 and successCount >= 3
- `getGlobalCandidates()` excludes rules with source === 'global'
- `persist()` writes valid JSON to `.nova/ace/playbooks/{agent}.json`
- `load()` returns null if file does not exist
- `load()` returns Playbook if file exists and is valid
- `load()` returns null (with warning) if JSON is invalid (malformed)
- `clear()` removes agent from in-memory cache (next getPlaybook() re-initializes)

### ace-cycle.test.ts (~20 tests)

Cover generator:

- `analyzeTask()` returns an empty playbookContext string when agent has no rules
- `analyzeTask()` returns a playbookContext string containing rule content
- `analyzeTask()` includes agent name and version in the XML block
- `analyzeTask()` respects tokenBudget — trims rules when context would exceed budget
- `analyzeTask()` calls `incrementApplied()` with the applied rule IDs

Cover reflector:

- `reflectOnOutcome()` returns empty array when LLM call fails (never throws)
- `reflectOnOutcome()` returns empty array when LLM returns invalid JSON
- `reflectOnOutcome()` filters out deltas with confidence < 0.5
- `reflectOnOutcome()` caps output at 5 deltas
- `reflectOnOutcome()` returns PlaybookDelta objects with all required fields

Cover curator:

- `isDuplicate()` returns true when Jaccard similarity >= 0.65
- `isDuplicate()` returns false for completely different content
- `curate()` rejects deltas that are duplicates of higher-confidence existing rules
- `curate()` replaces existing rule when delta has higher confidence
- `curate()` rejects deltas with score < 0.4
- `curate()` applies at most 3 deltas per run
- `curate()` calls `getTasteVault().learn()` for global candidates with score >= 0.75
- `curate()` returns { applied, rejected, newPlaybook } with correct counts
- `curate()` increments playbook version after applying deltas
- End-to-end: reflector delta → curator → playbook has new rule

### rehearsal.test.ts (~20 tests)

Cover shouldRehearse:

- `shouldRehearse()` returns true when task description length > 500 chars
- `shouldRehearse()` returns true when description contains 'schema'
- `shouldRehearse()` returns true when description contains 'migration'
- `shouldRehearse()` returns true when description contains 'rehearse'
- `shouldRehearse()` returns false for short, simple tasks

Cover RehearsalStage:

- `rehearse()` throws when NOVA26_TIER !== 'premium'
- `rehearse()` throws when shouldRehearse() returns false and forceRehearse is not set
- `rehearse()` returns a session with the correct number of branches
- `rehearse()` selects the branch with the highest composite score as winner
- `rehearse()` calls BranchManager.cleanupBranches() after selecting winner
- `formatSummary()` returns a string containing the winner description and score

Cover BranchManager:

- `createBranches()` returns at least 1 branch when LLM responses are mocked
- `createBranches()` skips branches where LLM returns invalid JSON (no throw)
- `cleanupBranches()` clears files from non-winner branches

Cover RehearsalScorer:

- `score()` returns 1.0 typeCheckPass for clean TypeScript content
- `score()` penalizes content containing `any` keyword
- `score()` penalizes content with untyped function parameters
- `score()` computes lineDelta correctly for added lines
- `score()` returns estimatedQuality 'high' for score >= 0.8
- `score()` returns estimatedQuality 'medium' for score between 0.55 and 0.8
- `score()` returns estimatedQuality 'low' for score < 0.55
- `score()` returns tasteAlignment 0.5 when vault has no relevant patterns
- `score()` returns previewSnippet of max 300 chars

### self-improvement.test.ts (~15 tests)

Cover:

- `getProfile()` returns default profile for new agent (totalTasks: 0, successRate: 0)
- `recordOutcome()` appends to recentOutcomes
- `recordOutcomes()` caps recentOutcomes at 20 (drops oldest)
- `recordOutcome()` recomputes successRate correctly
- `recordOutcome()` persists the profile after each call
- `runReview()` returns early when totalTasks < 5
- `runReview()` returns early when lastReviewedAt is less than 7 days ago
- `runReview()` produces Mistake deltas for taskTypes with failure rate > 50%
- `runReview()` produces Strategy deltas for taskTypes with success rate >= 80%
- `runReview()` applies at most 3 rule changes per review (guardrail)
- `runReview()` does NOT auto-apply deltas with confidence < 0.7 (stores as pending)
- `runReview()` does NOT produce Mistake rules for taskTypes with fewer than 3 samples
- `runReview()` updates lastReviewedAt after completing
- `getStyleAdaptations()` returns empty array when vault has no agent-tagged patterns
- `persist()` and `load()` round-trip for AgentPerformanceProfile

### integration.test.ts (~10 tests)

Cover the full ACE + Rehearsal pipeline:

- PlaybookManager.getPlaybook() → AceGenerator.analyzeTask() → playbookContext contains rule text
- AceReflector.reflectOnOutcome() → AceCurator.curate() → PlaybookManager has new rule
- After 5 recorded outcomes, SelfImprovementProtocol.runReview() runs without error
- SelfImprovementProtocol.runReview() result has rulesAdded OR rulesModified > 0 (when outcomes have signal)
- RehearsalStage.rehearse() (forceRehearse: true, mocked LLM) → returns session with winner
- RehearsalStage session.results[0].score is between 0 and 1
- playbook.test: rules added via curator are retrieved by getActiveRules() in subsequent call
- Global candidate rule from curator appears in TasteVault after curate() call
- SelfImprovementProtocol stores performance summary as Pattern node in TasteVault
- Full round-trip: record 5 outcomes → runReview() → playbook version incremented

---

## File Structure to Create

```
src/
  ace/
    playbook.ts              (KIMI-ACE-01)
    generator.ts             (KIMI-ACE-02)
    reflector.ts             (KIMI-ACE-02)
    curator.ts               (KIMI-ACE-02)
    playbook.test.ts         (KIMI-ACE-06)
    ace-cycle.test.ts        (KIMI-ACE-06)
    integration.test.ts      (KIMI-ACE-06)
  rehearsal/
    stage.ts                 (KIMI-ACE-03)
    branch-manager.ts        (KIMI-ACE-03)
    scorer.ts                (KIMI-ACE-03)
    rehearsal.test.ts        (KIMI-ACE-06)
  agents/
    self-improvement.ts      (KIMI-ACE-04)
    self-improvement.test.ts (KIMI-ACE-06)
  orchestrator/
    prompt-builder.ts        (KIMI-ACE-05, modify)
    ralph-loop.ts            (KIMI-ACE-05, modify)
  agent-loop/
    agent-loop.ts            (KIMI-ACE-05, modify)
.nova/
  ace/
    playbooks/               (created at runtime by PlaybookManager)
    profiles/                (created at runtime by SelfImprovementProtocol)
```

---

## Verification Checklist

After all six tasks are complete, verify:

```bash
# TypeScript: must be 0 errors
npx tsc --noEmit

# Tests: must be 947 + 85+ new tests passing, 0 failing
npx vitest run

# Spot-check: playbook round-trip
node -e "
import('./src/ace/playbook.js').then(async m => {
  const pm = m.getPlaybookManager();
  const pb = await pm.getPlaybook('MARS');
  console.log('Playbook version:', pb.version, '| Rules:', pb.rules.length);
  await pm.updatePlaybook('MARS', [{
    nodeId: crypto.randomUUID(),
    type: 'Strategy',
    content: 'Always validate Zod schemas at API boundaries',
    helpfulDelta: 0.8,
    harmfulDelta: 0,
    tags: ['validation', 'zod'],
    isGlobalCandidate: false,
    confidence: 0.85,
    agentName: 'MARS',
    taskId: 'test-001',
    createdAt: new Date().toISOString(),
  }]);
  const pb2 = await pm.getPlaybook('MARS');
  console.log('After update — version:', pb2.version, '| Rules:', pb2.rules.length);
});
"

# Spot-check: rehearsal stage (premium mode)
NOVA26_TIER=premium node -e "
import('./src/rehearsal/stage.js').then(async m => {
  const stage = m.getRehearsalStage();
  const task = { id: 'task-001', title: 'Test task', description: 'Write a schema migration for the users table. Rehearse this please.', agent: 'MARS', phase: 'schema', status: 'running', dependencies: [], attempts: 1 };
  console.log('shouldRehearse:', stage.shouldRehearse(task));
});
"
```

---

## Commit Order

Commit after each task so main stays green:

1. `feat(ace): KIMI-ACE-01 playbook core — PlaybookManager with CRUD, active rules, persistence`
2. `feat(ace): KIMI-ACE-02 generator reflector curator — ACE cycle with LLM prompts and deduplication`
3. `feat(ace): KIMI-ACE-03 rehearsal stage — in-memory branch generation, scoring, session management`
4. `feat(ace): KIMI-ACE-04 agent self-improvement — performance profiles, guardrailed rule evolution`
5. `feat(ace): KIMI-ACE-05 integration — ralph-loop, agent-loop, prompt-builder wired to ACE and rehearsal`
6. `feat(ace): KIMI-ACE-06 85+ tests for playbook, ACE cycle, rehearsal, self-improvement, integration`

Each commit must pass `npx tsc --noEmit` and `npx vitest run` before being committed.

---

## Key Design Decisions (do not deviate without flagging)

1. **Rehearsal uses in-memory diffs only, not git worktrees.** Git worktrees require FS
   operations and are too heavy for local dev latency. The `BranchStrategy` type is
   designed to accommodate future strategies (worktree, Convex sandbox) without breaking
   callers — but only `'in-memory'` is implemented in this sprint.

2. **ACE reflector and curator use cheap models.** Do not call the most expensive
   configured model for reflection and curation. Use whatever fast model is available
   (Qwen 7B or equivalent via the existing LLM client). If no fast model is configured,
   fall back gracefully to the default model — never block the task.

3. **Self-improvement guardrails are non-negotiable.** Max 3 rule changes per review.
   Confidence < 0.7 deltas are never auto-applied. Fewer than 3 samples for a taskType
   means no rule change. These limits exist to prevent feedback loops where agents
   over-optimize for short-term signal.

4. **ACE is gated by `autonomyLevel >= 3`.** The Reflector and Curator only run
   automatically when autonomyLevel >= 3. At lower autonomy levels, playbook context
   is still injected (Generator always runs) but no post-task learning happens. This
   gives users full control at lower autonomy settings.

5. **Rehearsal is gated by `NOVA26_TIER === 'premium'`.** The `shouldRehearse()` check
   still runs and returns its result — it is the `rehearse()` call itself that throws
   when tier is not premium. This allows the ralph-loop to log "rehearsal would have
   run" for free-tier users (future upsell hook).

6. **Singleton pattern matches existing codebase.** Every class has a `get*()` factory
   and a `reset*()` for tests. The reset functions clear in-memory state only — they
   do not delete JSON files on disk. This matches the pattern established in
   `src/tools/tool-registry.ts` and `src/taste-vault/graph-memory.ts`.

7. **Never throw from context-building functions.** `buildPlaybookContext()`,
   `buildRehearsalContext()`, and `buildVaultContext()` must all catch their own errors
   and return empty strings on failure. The prompt must always be buildable even when
   ACE subsystems are unavailable.

8. **The Taste Vault integration is additive.** The ACE curator calls
   `getTasteVault().learn()` for global candidate rules, and the self-improvement
   protocol stores performance summaries in the vault. These calls must be wrapped in
   try/catch — if the vault is unavailable, ACE still functions (it just does not
   write to the vault).
