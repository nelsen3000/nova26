# KIMI TASK FILE — Living Taste Vault + Global Wisdom Layer

> Owner: Kimi
> Priority: 1 (Highest — before ACE, before Rehearsal Stage)
> Baseline: commit a41f218 (KIMI-AGENT-01 through 06 complete)
> Test baseline: 872 tests passing, 0 TypeScript errors

---

## Context

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. You just
finished KIMI-AGENT-01 through 06, which implemented the agentic inner loop (AgentLoop,
Scratchpad, tool use, ReAct reasoning). That work lives in:

- `src/agent-loop/agent-loop.ts` — ReAct inner loop
- `src/tools/tool-registry.ts` — tool registration, permissions, rate limiting
- `src/orchestrator/prompt-builder.ts` — prompt assembly for agents
- `src/orchestrator/ralph-loop.ts` — outer build orchestration loop
- `src/memory/session-memory.ts` — existing flat key/value memory (to be superseded)

The Living Taste Vault replaces and dramatically upgrades the flat session memory with a
graph-based memory system. The Global Wisdom Layer aggregates anonymized patterns from
opt-in users into a shared knowledge pool for premium subscribers.

**Product direction: Path A**
- Per-user private Taste Vault (graph memory, never leaves their machine by default)
- Opt-in Global Wisdom Layer (anonymized patterns promoted to a shared "Hall of Fame")
- Free tier: limited graph size (500 nodes), 4 global wisdom injections per prompt
- Premium tier ($250–$500/month): unlimited graph, 12 global wisdom injections per prompt

**Specs from Grok (implement exactly as described):**
- GROK-R4: Taste Vault graph memory (nodes + edges)
- GROK-R6-01: Premium Buyer Experience (onboarding wizard, studio insights dashboard)
- GROK-R6-02: Global Wisdom Aggregation Pipeline (scoring, anti-gaming, distribution)
- GROK-TAKEOVER-01: ACE Integration with Graph Memory (privacy filters, anonymization)

---

## Global Rules (apply to every task)

- **TypeScript strict mode** — no `any`, no implicit `any`, no `@ts-ignore`
- **ESM imports** — always use `.js` extensions on relative imports (e.g., `import { Foo } from './foo.js'`)
- **Zod for all external/runtime data validation** — validate at system boundaries
- **Tests with vitest** — all new tests use `import { describe, it, expect, vi } from 'vitest'`
- **Do not break existing tests** — `npx vitest run` must still show 872+ passing after each task
- **Zero TypeScript errors** — `npx tsc --noEmit` must report 0 errors after every task
- **Commit to main when done** — one commit per KIMI-VAULT task, commit message format: `feat(taste-vault): KIMI-VAULT-XX <short description>`
- **Reference existing patterns** — follow conventions in `src/tools/tool-registry.ts` (class + singleton factory + `reset*` for tests) and `src/agent-loop/agent-loop.ts` (config interface with defaults, typed result, error handling)
- **File header comments** — every new file starts with a 2-line comment: `// <Short description>\n// <Which spec this implements>`
- **No external graph libraries** — implement the graph in plain TypeScript (Map/Set-based adjacency list). Do not add new npm dependencies without a compelling reason.

---

## KIMI-VAULT-01: Graph Memory Core

**File:** `src/taste-vault/graph-memory.ts`
**Target size:** ~300 lines
**Spec:** GROK-R4

### What to build

Implement a `GraphMemory` class that is the low-level engine for the Taste Vault. It
stores nodes and directed edges, provides traversal and query methods, tracks confidence
and helpful counts, and persists to Convex (if available) with a local JSON fallback.

### Node schema

```typescript
export type NodeType = 'Strategy' | 'Mistake' | 'Preference' | 'Pattern' | 'Decision';

export interface GraphNode {
  id: string;                    // nanoid or crypto.randomUUID()
  type: NodeType;
  content: string;               // Human-readable description of the insight
  confidence: number;            // 0–1, starts at 0.7, updated via reinforce/demote
  helpfulCount: number;          // Incremented when this node improves a build
  userId: string;                // Owner (local user ID or 'anonymous')
  isGlobal: boolean;             // True if promoted to Global Wisdom
  globalSuccessCount: number;    // Times this helped globally (0 for private nodes)
  language?: string;             // e.g. 'typescript', 'python' — optional filter
  tags: string[];                // Freeform tags for retrieval
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}
```

### Edge schema

```typescript
export type EdgeRelation = 'supports' | 'contradicts' | 'refines' | 'replaces' | 'depends_on';

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relation: EdgeRelation;
  strength: number;              // 0–1, how strong the relationship is
  createdAt: string;
}
```

### Methods to implement

```typescript
class GraphMemory {
  // CRUD — nodes
  addNode(node: Omit<GraphNode, 'id' | 'createdAt' | 'updatedAt'>): GraphNode
  getNode(id: string): GraphNode | undefined
  updateNode(id: string, updates: Partial<GraphNode>): GraphNode | undefined
  removeNode(id: string): boolean                    // also removes all edges touching this node

  // CRUD — edges
  addEdge(edge: Omit<GraphEdge, 'id' | 'createdAt'>): GraphEdge
  getEdge(id: string): GraphEdge | undefined
  removeEdge(id: string): boolean
  getEdgesFrom(nodeId: string): GraphEdge[]
  getEdgesTo(nodeId: string): GraphEdge[]

  // Queries
  getRelated(nodeId: string, relation?: EdgeRelation): GraphNode[]
  getByType(type: NodeType): GraphNode[]
  getHighConfidence(threshold?: number): GraphNode[]  // default threshold 0.8
  getByTag(tag: string): GraphNode[]
  search(query: string): GraphNode[]                  // simple substring match on content

  // Traversal
  traverse(startId: string, depth?: number, relation?: EdgeRelation): GraphNode[]
  // BFS traversal, default depth 3, returns nodes reachable from startId

  // Confidence management
  reinforce(nodeId: string, delta?: number): void    // default delta +0.05, max 1.0
  demote(nodeId: string, delta?: number): void       // default delta -0.1, min 0.0
  incrementHelpful(nodeId: string): void             // helpfulCount++

  // Stats
  nodeCount(): number
  edgeCount(): number
  stats(): { nodes: number; edges: number; byType: Record<NodeType, number>; avgConfidence: number }

  // Persistence
  persist(): Promise<void>                           // save to disk (local JSON fallback)
  load(): Promise<void>                              // load from disk
  clear(): void                                      // for tests only
}
```

### Persistence

Use local JSON at `.nova/taste-vault/graph-{userId}.json` as the primary storage.
The Convex integration is optional — if `CONVEX_URL` env var is set, also write to
Convex using the existing pattern from `src/convex/sync.ts`. If Convex is unavailable,
fall back silently to local JSON only.

### Singleton factory (same pattern as tool-registry.ts)

```typescript
export function getGraphMemory(userId?: string): GraphMemory
export function resetGraphMemory(): void  // for tests
```

---

## KIMI-VAULT-02: Taste Vault Manager

**File:** `src/taste-vault/taste-vault.ts`
**Target size:** ~250 lines
**Spec:** GROK-R4, GROK-R6-01

### What to build

`TasteVault` is the per-user high-level API on top of `GraphMemory`. It handles
auto-learning from build results, pattern extraction from code, conflict detection, and
tier enforcement.

### Tier configuration

```typescript
export interface TierConfig {
  tier: 'free' | 'premium';
  maxNodes: number;              // free: 500, premium: Infinity
  globalWisdomInjections: number; // free: 4, premium: 12
  canOptIntoGlobal: boolean;     // both tiers can opt in
}

const FREE_TIER: TierConfig = { tier: 'free', maxNodes: 500, globalWisdomInjections: 4, canOptIntoGlobal: true };
const PREMIUM_TIER: TierConfig = { tier: 'premium', maxNodes: Infinity, globalWisdomInjections: 12, canOptIntoGlobal: true };
```

### Methods to implement

```typescript
class TasteVault {
  constructor(userId: string, tier?: TierConfig)

  // Core API
  learn(node: Omit<GraphNode, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<GraphNode>
  // Enforces maxNodes limit. If at limit for free tier, removes lowest-confidence node first.
  // Before adding, checks for contradictions with existing nodes and creates contradicts edge.

  forget(nodeId: string): Promise<boolean>

  reinforce(nodeId: string): Promise<void>
  // Calls graphMemory.reinforce() and increments helpfulCount

  // Retrieval
  getRelevantPatterns(context: string, limit?: number): Promise<GraphNode[]>
  // Semantic match: tokenise context, score nodes by keyword overlap + confidence + helpfulCount
  // Returns top `limit` nodes (default 10)

  // Auto-learning
  learnFromBuildResult(taskTitle: string, taskDescription: string, agentOutput: string, agentName: string, success: boolean): Promise<void>
  // Extract patterns from successful builds, create Mistake nodes from failures
  // Called by ralph-loop.ts after each task

  // Pattern extraction
  detectPatterns(code: string, language: string): Promise<GraphNode[]>
  // Static analysis: detect common patterns (auth guards, error handling, type annotations, etc.)
  // Returns candidate nodes — caller decides whether to learn them

  // Conflict detection (internal, also exported for testing)
  detectConflicts(newContent: string, existingNodes: GraphNode[]): GraphNode[]
  // Returns existing nodes whose content contradicts the new content
  // Simple heuristic: if new node contains "never X" and existing has "always X" → conflict

  // Stats and introspection
  summary(): { tier: string; nodeCount: number; edgeCount: number; topPatterns: GraphNode[] }

  // Persistence delegation
  persist(): Promise<void>
  load(): Promise<void>
}
```

### Auto-learning heuristics for learnFromBuildResult

On success:
- If output contains `requireAuth` → learn Strategy node: "Use requireAuth() first in all Convex mutations"
- If output contains `companyId` and agent is PLUTO → learn Pattern node: "Multi-tenant tables include companyId"
- If output contains `Math.floor` → learn Constraint/Decision node: "Use Math.floor() for chip math, not Math.round()"
- If output contains `z.object` → learn Pattern node: "Validate inputs with Zod at API boundaries"
- For any successful output > 200 chars: create a general Pattern node summarising the approach (first 150 chars of output as content)

On failure:
- Create a Mistake node with content = `${agentName} failed on "${taskTitle}": ${error slice 0..200}`
- Confidence starts at 0.9 (high — we are very sure this was a mistake)

### Singleton factory

```typescript
export function getTasteVault(userId?: string, tier?: TierConfig): TasteVault
export function resetTasteVault(): void  // for tests
```

---

## KIMI-VAULT-03: Global Wisdom Pipeline

**File:** `src/taste-vault/global-wisdom.ts`
**Target size:** ~300 lines
**Spec:** GROK-R6-02, GROK-TAKEOVER-01

### What to build

`GlobalWisdomPipeline` aggregates high-confidence nodes from opt-in users, anonymizes
them, deduplicates, scores them, enforces anti-gaming rules, and distributes them to
subscribers.

### GlobalPattern schema

```typescript
export interface GlobalPattern {
  id: string;
  canonicalContent: string;      // Anonymized, deduplicated content
  originalNodeIds: string[];     // Source node IDs (for audit, never exposed to users)
  successScore: number;          // 0–1, computed by scoring formula
  userDiversity: number;         // Number of unique users who contributed (min 3 to promote)
  lastPromotedAt: string;        // ISO timestamp
  language?: string;
  tags: string[];
  promotionCount: number;        // How many times this has been promoted/updated
  harmReports: number;           // Reports of this being harmful (3+ → auto-demote)
  isActive: boolean;             // False if demoted
}
```

### Methods to implement

```typescript
class GlobalWisdomPipeline {
  // Aggregation
  collectHighConfidenceNodes(vaults: TasteVault[], threshold?: number): GraphNode[]
  // threshold default 0.85
  // Only includes nodes where user has opted in (userId not 'anonymous' and optInStatus true)

  // Privacy
  stripSensitiveData(node: GraphNode): GraphNode
  // Remove: file paths (regex: /[/.][a-zA-Z]+\//), variable names (camelCase identifiers
  // that look like project-specific names), secrets (anything matching /key|secret|token|password/i),
  // user-specific identifiers.
  // Replace stripped content with generic placeholders.
  // Return a new node object — do NOT mutate the original.

  // Deduplication
  isSimilar(a: string, b: string, threshold?: number): boolean
  // Jaccard similarity on word tokens, threshold default 0.7
  // Returns true if strings are too similar (would be a duplicate)

  findDuplicates(candidates: GraphNode[], existing: GlobalPattern[]): {
    duplicates: GraphNode[];   // too similar to existing
    unique: GraphNode[];       // safe to promote
  }

  // Scoring
  scoreNode(node: GraphNode, userDiversity: number, recencyBoostDays?: number): number
  // successScore = (helpfulCount * 0.6) + (userDiversity * 0.3) + (recencyBoost * 0.1)
  // recencyBoost = 1.0 if promoted within last 30 days, decays linearly to 0 at 180 days
  // recencyBoostDays defaults to 30

  // Anti-gaming
  checkAntiGaming(userId: string, weeklyPromotionLog: Map<string, number>): boolean
  // Returns false (blocked) if user has >= 5 promotions this week
  // weeklyPromotionLog: Map<userId, countThisWeek>

  reportHarm(patternId: string): void
  // harmReports++ on the pattern; if harmReports >= 3, set isActive = false (auto-demote)

  // Promotion
  promote(node: GraphNode, userId: string, weeklyLog: Map<string, number>): GlobalPattern | null
  // Runs full pipeline: stripSensitiveData → isSimilar dedup check → antiGaming check →
  // score → create GlobalPattern. Returns null if any check fails.
  // Requires userDiversity >= 3 before a pattern becomes publicly visible (mark as pending until then)

  // Distribution
  getForPremium(limit?: number): GlobalPattern[]
  // Returns top `limit` active patterns by successScore, default 12

  getForFree(limit?: number): GlobalPattern[]
  // Returns top `limit` active patterns, default 4

  pushToSubscribers(pattern: GlobalPattern): void
  // In-memory pub/sub for now — emit event for premium subscribers
  // Real implementation: Convex mutation if CONVEX_URL is set

  // Persistence
  persist(): Promise<void>   // .nova/taste-vault/global-wisdom.json
  load(): Promise<void>

  // Stats
  stats(): {
    totalPatterns: number;
    activePatterns: number;
    demotedPatterns: number;
    avgSuccessScore: number;
    topPatterns: GlobalPattern[];
  }
}
```

### Singleton factory

```typescript
export function getGlobalWisdomPipeline(): GlobalWisdomPipeline
export function resetGlobalWisdomPipeline(): void  // for tests
```

---

## KIMI-VAULT-04: Prompt Integration

**File:** `src/orchestrator/prompt-builder.ts` (modify existing)
**Target size:** ~100 lines of new/modified code
**Spec:** GROK-R6-01, GROK-R6-02

### What to build

Inject Taste Vault context into agent prompts. This modifies the existing `buildPrompt`
function and `buildAgenticUserPrompt` helper.

### Token budget rule

Vault context must not exceed **15% of the prompt token budget**. Estimate tokens as
`Math.ceil(text.length / 4)`. If the vault context would exceed the budget, trim nodes
from the bottom of the list (lowest priority first) until it fits.

### New function to add

```typescript
// Add to prompt-builder.ts
export async function buildVaultContext(
  taskDescription: string,
  agentName: string,
  tier: 'free' | 'premium',
  tokenBudget: number
): Promise<string>
```

Logic:
1. Get `TasteVault` instance via `getTasteVault()`
2. Get personal patterns: `vault.getRelevantPatterns(taskDescription, 20)` — then trim to fit budget
3. Get global patterns: `GlobalWisdomPipeline.getForPremium(12)` for premium, `getForFree(4)` for free
4. Format into a `<taste_vault_context>` XML block (see format below)
5. Enforce 15% token budget — trim from bottom if needed

### Format of injected context

```xml
<taste_vault_context>
<personal_patterns count="N">
- [Strategy] Use requireAuth() in all Convex mutations (confidence: 0.95, helpful: 12)
- [Pattern] Validate inputs with Zod at API boundaries (confidence: 0.88, helpful: 7)
</personal_patterns>
<global_wisdom tier="premium|free" count="N">
- [Pattern] Always run TypeScript type checking before committing (score: 0.91)
- [Pattern] Use BFS for graph traversal in bounded depth scenarios (score: 0.87)
</global_wisdom>
</taste_vault_context>
```

### Integration points

Modify `buildAgenticUserPrompt()`: after building the session memory context block,
call `buildVaultContext()` and append the result if non-empty.

Modify `buildUserPrompt()` (non-agentic path): same — append vault context after
session memory.

The `buildPrompt` signature does not change. The vault context is appended transparently.

Detect tier from env var `NOVA26_TIER` (`'free'` if unset, `'premium'` if set to `'premium'`).

---

## KIMI-VAULT-05: Ralph Loop Integration

**File:** `src/orchestrator/ralph-loop.ts` (modify existing)
**Target size:** ~80 lines of new/modified code
**Spec:** GROK-R4, GROK-R6-02

### What to build

Hook the Taste Vault into the build lifecycle. After each task completes or fails,
feed results back to the vault so it can learn. Track "wisdom impact" — a metric
showing how much the vault contributed to the build.

### Changes to processTask()

**After successful gate pass (near line 912 where task is marked 'done'):**

```typescript
// Taste Vault: extract patterns from successful task
const vault = getTasteVault();
await vault.learnFromBuildResult(task.title, task.description, response.content, task.agent, true);

// Reinforce patterns that were injected into the prompt for this task
// (vault context was injected — we know nodes that were used, reinforce them)
const injectedNodeIds = getInjectedVaultNodeIds(task.id);  // from a module-level Map
for (const nodeId of injectedNodeIds) {
  await vault.reinforce(nodeId);
}
clearInjectedVaultNodeIds(task.id);

// Track wisdom impact
const impactBefore = wisdomImpactTracker.get(task.id) ?? 0;
console.log(`  Taste Vault: learned from task (wisdom impact: ${impactBefore} injected nodes helped)`);
```

**After gate failure (near lines 856, 866 where task is marked 'failed'):**

```typescript
// Taste Vault: record failure as Mistake node
const vault = getTasteVault();
await vault.learnFromBuildResult(task.title, task.description, '', task.agent, false);
```

**Wisdom impact tracking** — add a module-level Map:

```typescript
const injectedVaultNodeIds = new Map<string, string[]>();  // taskId → nodeIds injected
export function trackInjectedVaultNodes(taskId: string, nodeIds: string[]): void
export function getInjectedVaultNodeIds(taskId: string): string[]
export function clearInjectedVaultNodeIds(taskId: string): void
```

Modify `buildVaultContext()` in `prompt-builder.ts` to call
`trackInjectedVaultNodes(taskId, ids)` when it injects vault nodes. Since
`buildPrompt` does not currently receive `taskId`, thread it through or use a
module-level "current task ID" variable (match whatever pattern is cleanest given
the existing code).

**Log wisdom impact at session end** (after `console.log('\n=== Ralph Loop finished ===')`):**

```typescript
const totalReinforced = Array.from(injectedVaultNodeIds.values()).flat().length;
console.log(`Taste Vault wisdom impact: ${totalReinforced} node reinforcements this session`);
```

---

## KIMI-VAULT-06: Tests

**Files:**
- `src/taste-vault/graph-memory.test.ts`
- `src/taste-vault/taste-vault.test.ts`
- `src/taste-vault/global-wisdom.test.ts`
- `src/taste-vault/integration.test.ts`

**Target:** 75+ new tests. All must pass. Existing 872 tests must still pass.

### graph-memory.test.ts (~25 tests)

Cover:
- `addNode()` creates node with generated ID and timestamps
- `addNode()` throws if content is empty
- `getNode()` returns undefined for unknown IDs
- `updateNode()` updates only specified fields, leaves others unchanged
- `updateNode()` updates `updatedAt` timestamp
- `removeNode()` removes the node and all its edges
- `addEdge()` creates directed edge between two nodes
- `addEdge()` throws if source or target node does not exist
- `removeEdge()` removes only that edge, leaves nodes intact
- `getEdgesFrom()` returns all edges where sourceId matches
- `getEdgesTo()` returns all edges where targetId matches
- `getRelated()` with no relation filter returns all adjacent nodes
- `getRelated()` with relation filter returns only matching-relation neighbors
- `getByType('Strategy')` returns only Strategy nodes
- `getHighConfidence(0.9)` returns only nodes with confidence >= 0.9
- `getByTag('auth')` returns nodes that include the tag
- `search('requireAuth')` returns nodes whose content contains the string
- `traverse()` BFS at depth 1 returns direct neighbors only
- `traverse()` BFS at depth 2 returns neighbors-of-neighbors
- `traverse()` with relation filter only follows matching edges
- `reinforce()` increases confidence by default delta, caps at 1.0
- `demote()` decreases confidence by default delta, floors at 0.0
- `incrementHelpful()` increments helpfulCount
- `stats()` returns correct counts and average confidence
- `persist()` and `load()` round-trip: node added before persist is available after load

### taste-vault.test.ts (~20 tests)

Cover:
- `learn()` adds a node to the graph
- `learn()` enforces free tier 500-node limit (evicts lowest confidence when full)
- `learn()` creates `contradicts` edge when new node conflicts with existing
- `forget()` removes node from the graph
- `reinforce()` increments helpfulCount and confidence
- `getRelevantPatterns()` returns nodes sorted by relevance to context
- `getRelevantPatterns()` respects `limit` parameter
- `learnFromBuildResult()` with success=true creates Strategy/Pattern nodes
- `learnFromBuildResult()` with success=false creates Mistake node
- `learnFromBuildResult()` with requireAuth in output creates auth Strategy node
- `learnFromBuildResult()` with Math.floor in output creates constraint node
- `detectPatterns()` on TypeScript code containing z.object returns Pattern node
- `detectPatterns()` on code containing requireAuth returns Strategy node
- `detectConflicts()` detects "never X" vs "always X" contradiction
- `detectConflicts()` returns empty array when no conflicts
- `summary()` returns correct tier and counts
- Premium tier has unlimited nodes
- Free tier respects globalWisdomInjections limit of 4
- Premium tier allows 12 globalWisdomInjections
- `persist()` and `load()` round-trip via graph memory

### global-wisdom.test.ts (~20 tests)

Cover:
- `stripSensitiveData()` removes file paths (e.g., `src/auth/mutations.ts`)
- `stripSensitiveData()` removes secret-looking strings (apiKey, secretToken, password)
- `stripSensitiveData()` does not mutate the original node
- `isSimilar()` returns true for strings with Jaccard similarity >= 0.7
- `isSimilar()` returns false for completely different strings
- `findDuplicates()` separates candidates into duplicates and unique
- `scoreNode()` formula: `(helpfulCount * 0.6) + (userDiversity * 0.3) + (recencyBoost * 0.1)` is correct
- `scoreNode()` clamps result to 0–1 range
- `checkAntiGaming()` returns false when user has >= 5 promotions this week
- `checkAntiGaming()` returns true when user has < 5 promotions this week
- `reportHarm()` increments harmReports
- `reportHarm()` auto-demotes pattern when harmReports reaches 3
- `promote()` returns null when antiGaming check fails
- `promote()` returns null when content is too similar to existing pattern
- `promote()` returns GlobalPattern on success
- `getForPremium()` returns patterns sorted by successScore descending
- `getForFree()` returns max 4 patterns
- `getForFree()` never returns inactive (demoted) patterns
- `stats()` returns correct counts
- `persist()` and `load()` round-trip for GlobalPattern array

### integration.test.ts (~10 tests)

Cover the full pipeline: vault learns → prompt is built with vault context → ralph loop reinforces.

- Adding a pattern to TasteVault causes it to appear in `buildVaultContext()` output
- Premium vault injects up to 12 global wisdom nodes; free injects up to 4
- After a successful build, `learnFromBuildResult()` adds a new node (node count increases)
- After a failed build, a Mistake node is created
- Reinforcing a node increases its confidence
- A node with confidence >= 0.85 is returned by `getHighConfidence()`
- `buildVaultContext()` respects 15% token budget (trims nodes if context would exceed budget)
- Promoted global pattern appears in `getForPremium()` with correct successScore
- Pattern with 3+ harm reports is excluded from `getForPremium()`
- End-to-end: `getTasteVault().learn()` → `getGlobalWisdomPipeline().promote()` → `getForFree()` returns the pattern (if userDiversity >= 3)

---

## File Structure to Create

```
src/
  taste-vault/
    graph-memory.ts            (KIMI-VAULT-01)
    taste-vault.ts             (KIMI-VAULT-02)
    global-wisdom.ts           (KIMI-VAULT-03)
    graph-memory.test.ts       (KIMI-VAULT-06)
    taste-vault.test.ts        (KIMI-VAULT-06)
    global-wisdom.test.ts      (KIMI-VAULT-06)
    integration.test.ts        (KIMI-VAULT-06)
  orchestrator/
    prompt-builder.ts          (KIMI-VAULT-04, modify)
    ralph-loop.ts              (KIMI-VAULT-05, modify)
```

---

## Verification Checklist

After all six tasks are done, verify:

```bash
# TypeScript: must be 0 errors
npx tsc --noEmit

# Tests: must be 872 + 75+ new tests passing, 0 failing
npx vitest run

# Manually spot-check
node -e "
import('./src/taste-vault/taste-vault.js').then(async m => {
  const v = m.getTasteVault('test-user');
  await v.load();
  const n = await v.learn({ type: 'Strategy', content: 'Use requireAuth first', confidence: 0.9, helpfulCount: 0, isGlobal: false, globalSuccessCount: 0, tags: ['auth'] });
  console.log('learned node:', n.id);
  const patterns = await v.getRelevantPatterns('auth mutations', 5);
  console.log('retrieved patterns:', patterns.length);
});
"
```

---

## Commit Order

Commit after each task so main stays green:

1. `feat(taste-vault): KIMI-VAULT-01 graph memory core with CRUD, traversal, persistence`
2. `feat(taste-vault): KIMI-VAULT-02 taste vault manager with auto-learning and tier enforcement`
3. `feat(taste-vault): KIMI-VAULT-03 global wisdom pipeline with scoring and anti-gaming`
4. `feat(taste-vault): KIMI-VAULT-04 inject vault context into agent prompts with token budget`
5. `feat(taste-vault): KIMI-VAULT-05 ralph loop hooks for vault learning and wisdom impact tracking`
6. `feat(taste-vault): KIMI-VAULT-06 75+ tests for graph memory, vault, global wisdom, integration`

Each commit must pass `npx tsc --noEmit` and `npx vitest run` before being committed.

---

## Key Design Decisions (don't deviate without flagging)

1. **Graph is in-memory + JSON file, not a database.** The Convex integration is additive
   and optional. Free-tier users get full graph functionality with local storage only.

2. **No external graph libraries.** The graph is a `Map<string, GraphNode>` + adjacency
   list `Map<string, Set<string>>`. BFS traversal is hand-rolled. This keeps the bundle
   small and eliminates dependency risk.

3. **Privacy by design.** `stripSensitiveData()` runs on every node before global
   promotion. Nodes are never sent anywhere without explicit opt-in.

4. **The `detectConflicts()` heuristic is intentionally simple.** "never X" vs "always X"
   is the primary signal. Do not implement ML-based similarity here — that is ACE's job.

5. **Tier enforcement is at the TasteVault layer, not GraphMemory.** GraphMemory is
   tier-agnostic. TasteVault.learn() enforces the 500-node free-tier cap.

6. **Singleton pattern matches tool-registry.ts.** Each of the three main classes has a
   module-level singleton with a `get*()` factory and a `reset*()` for tests.

7. **Token budget is 15% of the prompt budget.** `buildVaultContext()` accepts a
   `tokenBudget` parameter in tokens (not characters). Estimate tokens as
   `Math.ceil(text.length / 4)`.
