# KIMI-MEMORY Sprint: Agent Memory Consolidation & Long-Term Learning (R16-02)

> Assigned to: Kimi
> Sprint: Memory (post-Portfolio)
> Date issued: 2026-02-19
> Prerequisite: KIMI-PORTFOLIO complete (1811 tests, 0 TS errors)

## Project Context

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama (local LLM), Convex, and vitest. Agents are named after celestial bodies: MARS, VENUS, MERCURY, JUPITER, SATURN, PLUTO, ATLAS, etc.

**Key systems you should be aware of (do not modify unless told):**

- Core execution: Ralph Loop (`src/orchestrator/ralph-loop.ts`)
- Taste Vault: `src/taste-vault/`
- ACE playbooks: `src/ace/`
- Rehearsal Stage: `src/rehearsal/`
- Session Memory: `src/memory/session-memory.ts`
- Personality Engine: `src/agents/personality-engine.ts`
- Offline Engine: `src/sync/offline-engine.ts`
- Semantic Search: `src/tools/semantic-search.ts`
- ATLAS: `src/atlas/`
- Dream Engine: `src/dream/`
- Parallel Universe: `src/universe/`
- Overnight Evolution: `src/evolution/`
- Nova Symbiont: `src/symbiont/`
- Taste Room: `src/taste-room/`
- Portfolio: `src/portfolio/`

**Current state:** 1811 tests passing, 0 TypeScript errors.

**Important context:** `src/memory/session-memory.ts` already exists for session-scoped memory. Agent memory (this sprint) is a different system — it provides *long-term* memory that persists across sessions and projects in a local SQLite database (`~/.nova/memory.db`). Do **not** modify `session-memory.ts`.

**Key distinction from Taste Vault:** The Taste Vault stores code patterns (structural artifacts). Agent memory stores experiences, generalizations, and procedures (behavioral and contextual knowledge). A Taste Vault entry says "this is the shape of good code." An agent memory says "here is why we made that decision and what happened when we tried something else."

---

## Rules

- TypeScript strict mode. No `any` types.
- ESM imports with `.js` extensions (e.g., `import { Foo } from './foo.js';`).
- Every new `.ts` source file gets a companion `.test.ts` file in the same directory.
- Tests use vitest (`import { describe, it, expect, vi, beforeEach } from 'vitest';`).
- Mock Ollama calls — **never** make real LLM calls in tests. Use `vi.fn()` or `vi.mock()`.
- Mock `better-sqlite3` in tests — **never** create real database files. Use `vi.mock()`.
- Do **not** modify existing source files unless explicitly told to extend them.
- Run `npx tsc --noEmit` and `npx vitest run` after each task. Zero errors, zero failures.
- Target: 1811+ tests passing at end of sprint (aim for 90+ new tests).
- Use `zod` for runtime validation of configs and inputs where appropriate.
- Use `better-sqlite3` for local persistence (consistent with existing codebase).
- All IDs should be generated with `crypto.randomUUID()`.
- All timestamps should be ISO 8601 strings (`new Date().toISOString()`).

---

## KIMI-MEMORY-01: Agent Memory Types & SQLite Store

### Files to Create

- `src/memory/agent-memory.ts`
- `src/memory/agent-memory.test.ts`

### Purpose

Nova26's agents currently have no memory between sessions. Every build starts from scratch. This task creates the foundation: TypeScript interfaces for three memory types (episodic, semantic, procedural), the SQLite database schema, and CRUD operations for the memory store.

### Interfaces to Implement

All interfaces must be exported from `src/memory/agent-memory.ts`:

```typescript
export interface AgentMemoryConfig {
  dbPath: string;                     // default: '~/.nova/memory.db'
  consolidationEnabled: boolean;      // default: true
  retrievalBudget: {
    episodic: number;                 // default: 5
    semantic: number;                 // default: 3
    procedural: number;              // default: 2
    maxTokens: number;               // default: 800
  };
  forgettingCurve: {
    decayRate: number;               // default: 0.05
    deletionThreshold: number;       // default: 0.1
    reinforcementBoost: number;      // default: 0.2
  };
  compressionCycleInterval: number;  // default: 10 (builds)
}

export type MemoryType = 'episodic' | 'semantic' | 'procedural';
export type MemoryOutcome = 'positive' | 'negative' | 'neutral' | 'unknown';

export interface AgentMemory {
  id: string;
  type: MemoryType;
  content: string;                   // natural language, max 800 chars
  embedding: number[];               // vector for semantic search
  projectId?: string;                // undefined for cross-project semantic memories
  buildId?: string;                  // undefined for semantic and procedural memories
  agentsInvolved: string[];
  outcome: MemoryOutcome;
  relevanceScore: number;            // 0-1, decays over time
  isPinned: boolean;                 // pinned memories do not decay
  isSuppressed: boolean;             // suppressed memories are not retrieved
  accessCount: number;
  lastAccessedAt?: string;
  createdAt: string;
  updatedAt: string;
  sourceEventIds?: string[];         // build event log IDs that produced this memory
  tags: string[];
}

export type EpisodicMemory = AgentMemory & {
  type: 'episodic';
  eventDate: string;
  location: string;                  // e.g., 'auth/session.ts during auth sprint'
  decision?: string;                 // what was decided
  alternativesConsidered?: string[];
};

export type SemanticMemory = AgentMemory & {
  type: 'semantic';
  confidence: number;                // 0-1, how confident ATLAS is in this generalization
  supportingMemoryIds: string[];     // episodic memories that back this up
};

export type ProceduralMemory = AgentMemory & {
  type: 'procedural';
  triggerPattern: string;            // when this procedure applies
  steps: string[];                   // ordered list of actions
  successRate: number;              // 0-1
};

export interface ConsolidationResult {
  buildId: string;
  consolidatedAt: string;
  memoriesExtracted: number;
  memoriesDeduplicated: number;
  memoriesCompressed: number;
  memoriesDeleted: number;
  newMemoryIds: string[];
  durationMs: number;
}

export interface RetrievalQuery {
  taskDescription: string;
  taskEmbedding: number[];
  agentName: string;
  projectId: string;
  maxEpisodic: number;
  maxSemantic: number;
  maxProcedural: number;
  maxTokens: number;
}

export interface RetrievalResult {
  queryId: string;
  memories: AgentMemory[];
  totalTokensUsed: number;
  injectedPromptPrefix: string;      // formatted memory context for the agent
  retrievedAt: string;
}
```

### SQLite Schema

The `AgentMemoryStore` class creates this schema on initialization:

```sql
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('episodic', 'semantic', 'procedural')),
  content TEXT NOT NULL,
  embedding BLOB NOT NULL,
  project_id TEXT,
  build_id TEXT,
  agents_involved TEXT NOT NULL,     -- JSON array
  outcome TEXT NOT NULL DEFAULT 'unknown',
  relevance_score REAL NOT NULL DEFAULT 1.0,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_suppressed INTEGER NOT NULL DEFAULT 0,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',   -- JSON array
  extra_json TEXT                    -- type-specific fields as JSON
);

CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id);
CREATE INDEX IF NOT EXISTS idx_memories_relevance ON memories(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_memories_suppressed ON memories(is_suppressed);
CREATE INDEX IF NOT EXISTS idx_memories_type_relevance ON memories(type, relevance_score DESC);
```

**Embedding storage:** Store `number[]` as `Float32Array` binary BLOB. Provide two utility functions:

```typescript
export function serializeEmbedding(embedding: number[]): Buffer {
  return Buffer.from(new Float32Array(embedding).buffer);
}

export function deserializeEmbedding(blob: Buffer): number[] {
  return Array.from(new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4));
}
```

### Class to Implement

```typescript
export class AgentMemoryStore {
  constructor(config?: Partial<AgentMemoryConfig>);
}
```

The constructor merges config with defaults and opens the SQLite database (creating it and running schema if it doesn't exist):

```typescript
const DEFAULT_CONFIG: AgentMemoryConfig = {
  dbPath: '~/.nova/memory.db',
  consolidationEnabled: true,
  retrievalBudget: {
    episodic: 5,
    semantic: 3,
    procedural: 2,
    maxTokens: 800,
  },
  forgettingCurve: {
    decayRate: 0.05,
    deletionThreshold: 0.1,
    reinforcementBoost: 0.2,
  },
  compressionCycleInterval: 10,
};
```

### Functions (all instance methods on `AgentMemoryStore`)

1. **`insertMemory(memory: Omit<AgentMemory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'>): AgentMemory`**
   - Generates UUID for `id`, sets timestamps, `accessCount: 0`.
   - Serializes `embedding` to BLOB. Stores type-specific fields in `extra_json`.
   - INSERTs into SQLite. Returns the full `AgentMemory`.

2. **`getMemory(id: string): AgentMemory | undefined`**
   - SELECT by id. Deserializes embedding and extra_json. Returns undefined if not found.

3. **`updateMemory(id: string, updates: Partial<Pick<AgentMemory, 'content' | 'relevanceScore' | 'isPinned' | 'isSuppressed' | 'tags' | 'outcome'>>): AgentMemory`**
   - UPDATEs specified fields. Sets `updatedAt` to now. Returns updated memory.
   - Throws if memory not found.

4. **`deleteMemory(id: string): boolean`**
   - DELETEs by id. Returns true if deleted, false if not found.

5. **`queryByType(type: MemoryType, options?: { limit?: number; includeSuppressed?: boolean }): AgentMemory[]`**
   - SELECT WHERE type=? AND (is_suppressed=0 unless includeSuppressed). ORDER BY relevance_score DESC LIMIT ?.
   - Default limit: 50. Deserializes all results.

6. **`queryByProject(projectId: string, options?: { type?: MemoryType; limit?: number }): AgentMemory[]`**
   - SELECT WHERE project_id=? with optional type filter. ORDER BY relevance_score DESC.

7. **`recordAccess(id: string): AgentMemory`**
   - Increments `access_count`, sets `last_accessed_at` to now, boosts `relevance_score` by `forgettingCurve.reinforcementBoost` (capped at 1.0). Returns updated memory.
   - Throws if not found.

8. **`getStats(): { total: number; byType: Record<MemoryType, number>; avgRelevance: number; pinnedCount: number; suppressedCount: number }`**
   - Aggregate queries for dashboard stats.

9. **`getAllMemories(options?: { includeSuppressed?: boolean }): AgentMemory[]`**
   - Returns all memories. Default excludes suppressed.

10. **`close(): void`**
    - Closes the SQLite database connection.

### Required Tests (minimum 20)

Write these in `src/memory/agent-memory.test.ts`:

1. **Creates database and tables on init** — init store, verify tables exist (mock better-sqlite3).
2. **Inserts episodic memory** — insert with type 'episodic', verify all fields set correctly.
3. **Inserts semantic memory** — insert with type 'semantic', verify confidence stored in extra_json.
4. **Inserts procedural memory** — insert with type 'procedural', verify steps stored in extra_json.
5. **Gets memory by ID** — insert then get, verify round-trip matches.
6. **Returns undefined for non-existent ID** — getMemory('fake') returns undefined.
7. **Updates memory fields** — update relevanceScore, verify change persisted.
8. **Update throws for non-existent ID** — expect error.
9. **Deletes memory** — delete, verify getMemory returns undefined.
10. **Delete returns false for non-existent ID** — verify.
11. **Queries by type** — insert 3 episodic + 2 semantic, query 'episodic', verify 3 returned.
12. **Excludes suppressed by default** — insert suppressed memory, verify excluded from queryByType.
13. **Includes suppressed when requested** — verify includeSuppressed option works.
14. **Queries by project** — insert memories for 2 projects, query one, verify correct results.
15. **Records access and boosts relevance** — recordAccess, verify accessCount incremented and relevanceScore boosted.
16. **Relevance capped at 1.0 after boost** — memory at 0.95, boost 0.2, verify capped at 1.0.
17. **Records access throws for non-existent ID** — expect error.
18. **Gets stats with correct counts** — insert various memories, verify all stat fields.
19. **Serializes and deserializes embeddings** — round-trip test for serializeEmbedding/deserializeEmbedding.
20. **Respects limit in queryByType** — insert 10 memories, query with limit 3, verify 3 returned.

---

## KIMI-MEMORY-02: Consolidation Pipeline

### Files to Create

- `src/memory/consolidation-pipeline.ts`
- `src/memory/consolidation-pipeline.test.ts`

### Purpose

After every build, ATLAS runs a consolidation pipeline that extracts memories from the build event log, deduplicates against existing memories, and writes new ones to the store. Every N cycles (default: 10), it runs a **compression pass** that collapses related episodic memories into semantic generalizations. This is the critical feature — not just garbage collection, but genuine knowledge distillation.

**Example of compression:** "Attempts at JWT refresh tokens across 3 different builds all failed" → new semantic memory: "User's auth requirements conflict with short-lived JWT patterns; prefer session-based auth." The original episodic memories are preserved (for audit), but the semantic memory is the distilled wisdom that agents use going forward.

### Interfaces to Implement

All interfaces must be exported from `src/memory/consolidation-pipeline.ts`:

```typescript
export interface ConsolidationConfig {
  deduplicationThreshold: number;    // default: 0.82 (cosine similarity)
  maxMemoriesPerExtraction: number;  // default: 8
  compressionCycleInterval: number;  // default: 10
  maxDurationMs: number;             // default: 60000 (60 seconds)
  maxMemoryMb: number;               // default: 128
}

export interface BuildEventLog {
  buildId: string;
  projectId: string;
  tasks: Array<{
    taskId: string;
    agentName: string;
    description: string;
    output: string;
    outcome: 'success' | 'failure' | 'partial';
    aceScore?: number;
  }>;
  userInterventions: Array<{
    timestamp: string;
    action: string;
    context: string;
  }>;
  buildSummary: string;
  buildOutcome: 'success' | 'failure' | 'partial';
  startedAt: string;
  completedAt: string;
}

export interface ExtractionPromptResult {
  memories: Array<{
    type: MemoryType;
    content: string;
    outcome: MemoryOutcome;
    agentsInvolved: string[];
    tags: string[];
    // Episodic-specific
    eventDate?: string;
    location?: string;
    decision?: string;
    alternativesConsidered?: string[];
    // Semantic-specific
    confidence?: number;
    // Procedural-specific
    triggerPattern?: string;
    steps?: string[];
  }>;
}
```

Import `AgentMemoryStore`, `AgentMemory`, `MemoryType`, `MemoryOutcome`, `ConsolidationResult` from `./agent-memory.js`.

### Class to Implement

```typescript
export class ConsolidationPipeline {
  constructor(
    store: AgentMemoryStore,
    embeddingFn: (text: string) => Promise<number[]>,
    extractionFn: (eventLog: BuildEventLog) => Promise<ExtractionPromptResult>,
    config?: Partial<ConsolidationConfig>
  );
}
```

The `embeddingFn` wraps Ollama embedding calls. The `extractionFn` wraps the Ollama prompt that extracts candidate memories from a build event log. Both are injected so tests can mock them.

Default config:

```typescript
const DEFAULT_CONFIG: ConsolidationConfig = {
  deduplicationThreshold: 0.82,
  maxMemoriesPerExtraction: 8,
  compressionCycleInterval: 10,
  maxDurationMs: 60000,
  maxMemoryMb: 128,
};
```

### Functions (all instance methods on `ConsolidationPipeline`)

1. **`consolidate(eventLog: BuildEventLog): Promise<ConsolidationResult>`**
   - Main entry point. Called after every build.
   - Calls `extractionFn(eventLog)` to get candidate memories (cap at `maxMemoriesPerExtraction`).
   - For each candidate:
     - Calls `embeddingFn(candidate.content)` to compute embedding.
     - Calls `deduplicate()` to check against existing memories.
     - If no duplicate: inserts via `store.insertMemory()`.
     - If duplicate found: calls `merge()` to merge with existing.
   - Tracks and enforces `maxDurationMs` — stops processing new candidates if time runs out.
   - Returns `ConsolidationResult` with all stats.

2. **`deduplicate(embedding: number[], type: MemoryType): AgentMemory | null`**
   - Queries existing memories of the same type from the store (non-suppressed, limit 100).
   - Computes cosine similarity between the new embedding and each existing memory's embedding.
   - If any similarity >= `deduplicationThreshold`, returns that memory (the duplicate).
   - Returns null if no duplicate found.

3. **`merge(existing: AgentMemory, candidate: { content: string; sourceEventIds?: string[]; outcome: MemoryOutcome }): AgentMemory`**
   - Appends candidate's `sourceEventIds` to existing's.
   - Averages the `relevanceScore`: `(existing.relevanceScore + 1.0) / 2`.
   - If candidate's content is longer (more detail), replaces existing content.
   - Updates `updatedAt`. Returns merged memory.

4. **`compress(cycleCount: number): Promise<{ compressed: number; deleted: number }>`**
   - Only runs when `cycleCount % compressionCycleInterval === 0`. Returns `{ compressed: 0, deleted: 0 }` otherwise.
   - **Episodic→Semantic consolidation:** Queries all episodic memories. Groups them by overlapping tags (2+ shared tags = same group). For each group of 3+ episodic memories with the same `outcome`:
     - Creates ONE new semantic memory whose `content` summarizes the group (concatenate the episodic contents with "Pattern observed across N builds: ..." prefix).
     - Sets `supportingMemoryIds` to the IDs of the grouped episodic memories.
     - Sets `confidence` based on group size: 3 memories = 0.7, 4 = 0.8, 5+ = 0.9.
     - Does **NOT** delete the source episodic memories — they remain for audit.
   - **Garbage collection:** Deletes memories where `relevanceScore < deletionThreshold` AND `accessCount < 3` AND `isPinned === false` AND `isSuppressed === false`. Before deletion, checks `isLandmark()`. Landmarks are preserved at relevanceScore 0.1 indefinitely.
   - Returns count of `compressed` (new semantic memories created) and `deleted`.

5. **`isLandmark(memory: AgentMemory): boolean`**
   - A memory is a landmark if:
     - `outcome === 'negative'` AND no other memory shares the same `projectId` + tags combination, OR
     - `tags` include any of: `'critical-failure'`, `'data-loss'`, `'security-incident'`, `'user-escalation'`
   - Landmark memories are never deleted by garbage collection.

6. **`cosineSimilarity(a: number[], b: number[]): number`**
   - Standard cosine similarity. Returns 0 for empty/zero vectors.

### Required Tests (minimum 20)

Write these in `src/memory/consolidation-pipeline.test.ts`:

1. **Extracts memories from build event log** — mock extractionFn returning 3 memories, verify 3 inserted.
2. **Computes embeddings for each candidate** — verify embeddingFn called once per candidate.
3. **Deduplicates against existing memories** — existing memory with 0.85 similarity, verify merge instead of insert.
4. **Does not deduplicate below threshold** — similarity 0.75 < 0.82, verify new insert.
5. **Merges sourceEventIds on dedup** — verify existing's sourceEventIds extended with candidate's.
6. **Averages relevanceScore on merge** — existing 0.8, new 1.0, verify (0.8+1.0)/2 = 0.9.
7. **Replaces content when candidate is more detailed** — longer content wins.
8. **Keeps content when existing is more detailed** — shorter candidate does not replace.
9. **Enforces max extraction count** — extractionFn returns 12, only 8 processed.
10. **Enforces time limit** — simulate slow embeddingFn, verify stops before maxDurationMs.
11. **Returns correct ConsolidationResult stats** — verify all fields populated correctly.
12. **Compression creates semantic from episodic group** — 3 episodic memories with overlapping tags + same outcome, verify 1 semantic created with supportingMemoryIds linking all 3.
13. **Compression does not run on wrong cycle** — cycle 5 (interval 10) returns {0, 0}.
14. **Compression runs on correct cycle** — cycle 10, verify compression executes.
15. **Compression preserves source episodic memories** — after compression, verify all 3 episodic memories still exist.
16. **Garbage collection deletes low-relevance memories** — relevance 0.05, accessCount 1, not pinned → deleted.
17. **Does not delete pinned memories** — pinned memory with relevance 0.01 → preserved.
18. **Does not delete landmark memories** — negative outcome memory, only record for project → preserved at 0.1.
19. **Identifies landmark by tags** — memory with tag 'critical-failure' → isLandmark returns true.
20. **Cosine similarity of identical vectors** — verify returns 1.0.

---

## KIMI-MEMORY-03: Memory Retrieval & Forgetting Curve

### Files to Create

- `src/memory/memory-retrieval.ts`
- `src/memory/memory-retrieval.test.ts`

### Purpose

Before each task is assigned to an agent, ATLAS retrieves relevant memories from the store and injects them into the agent's system prompt. Retrieval is embedding-based, recency-weighted, and budget-constrained. The forgetting curve ensures old, unreinforced memories gradually fade. Negative memories (past failures) are boosted so agents avoid repeating mistakes.

### Interfaces to Implement

All interfaces must be exported from `src/memory/memory-retrieval.ts`:

```typescript
export interface RetrievalConfig {
  maxEpisodic: number;               // default: 5
  maxSemantic: number;               // default: 3
  maxProcedural: number;             // default: 2
  maxTokens: number;                 // default: 800
  negativeBoostMultiplier: number;   // default: 1.5
  recencyWeight: number;             // default: 0.1 (multiplied by accessCount in scoring)
}

export interface ForgettingCurveConfig {
  decayRate: number;                 // default: 0.05
  deletionThreshold: number;        // default: 0.1
  reinforcementBoost: number;       // default: 0.2
  maxRelevance: number;             // default: 1.0
}

// Relevance-to-language mapping for user-facing output
export type MemoryConfidenceLabel =
  | 'clear'      // 0.8-1.0: "I have a clear memory of this"
  | 'recall'     // 0.5-0.8: "I recall something similar"
  | 'vague'      // 0.2-0.5: "I vaguely remember"
  | 'none';      // <0.2: "I don't think we've tried this before"
```

Import `AgentMemoryStore`, `AgentMemory`, `RetrievalQuery`, `RetrievalResult`, `EpisodicMemory`, `ProceduralMemory` from `./agent-memory.js`.

### Class to Implement

```typescript
export class MemoryRetrieval {
  constructor(
    store: AgentMemoryStore,
    embeddingFn: (text: string) => Promise<number[]>,
    config?: Partial<RetrievalConfig>,
    forgettingConfig?: Partial<ForgettingCurveConfig>
  );
}
```

### Functions (all instance methods on `MemoryRetrieval`)

1. **`retrieve(query: RetrievalQuery): Promise<RetrievalResult>`**
   - Main entry point. Called before each task assignment.
   - Uses `query.taskEmbedding` if provided, otherwise embeds `query.taskDescription` via `embeddingFn`.
   - For each memory type (`episodic`, `semantic`, `procedural`):
     - Queries store: non-suppressed memories of that type, limit 20.
     - Scores each: `compositeScore = relevanceScore * (1 + recencyWeight * accessCount)`.
     - For `outcome === 'negative'`: multiply compositeScore by `negativeBoostMultiplier` (1.5x).
     - Re-rank by cosine similarity to query embedding.
     - Take top N (maxEpisodic, maxSemantic, maxProcedural).
   - Enforce token budget: estimate tokens as `Math.ceil(content.length / 4)`. Drop lowest-scored memories from the combined list until total ≤ `maxTokens`.
   - Call `store.recordAccess()` on each retrieved memory.
   - Format `injectedPromptPrefix` via `formatInjectedPrefix()`.
   - Return `RetrievalResult` with generated `queryId` and `retrievedAt`.

2. **`formatInjectedPrefix(memories: AgentMemory[]): string`**
   - Formats retrieved memories as a system prompt prefix. Exact format:
   ```
   You have the following relevant memories from past experience:

   • Episodic (clear): On {eventDate} in {projectId}, {content}
   • Semantic: {content}
   • Procedural: When {triggerPattern}: {step1} → {step2} → {step3}

   Use these memories to inform your work. Avoid repeating past mistakes.
   ```
   - The parenthetical label on episodic comes from `getConfidenceLabel(memory.relevanceScore)`.
   - If no memories retrieved, returns empty string (no prefix injected).

3. **`calculateDecayedRelevance(initialWeight: number, daysSinceLastAccess: number, isPinned: boolean): number`**
   - Pure function. Ebbinghaus decay:
   - `if (isPinned) return 1.0;`
   - `return Math.max(0.0, initialWeight * Math.exp(-decayRate * daysSinceLastAccess));`

4. **`applyDecay(): { updated: number; belowThreshold: number }`**
   - Batch operation: queries ALL non-pinned, non-suppressed memories via `store.getAllMemories()`.
   - For each, calculates decayed relevance based on days since `lastAccessedAt` (or `createdAt` if never accessed).
   - Updates `relevanceScore` in store via `store.updateMemory()`.
   - Returns count of updated memories and count now below deletion threshold.

5. **`getConfidenceLabel(relevanceScore: number): MemoryConfidenceLabel`**
   - 0.8 to 1.0 → `'clear'`
   - 0.5 to 0.8 → `'recall'`
   - 0.2 to 0.5 → `'vague'`
   - below 0.2 → `'none'`

6. **`getConfidenceText(label: MemoryConfidenceLabel): string`**
   - `'clear'` → `"I have a clear memory of this"`
   - `'recall'` → `"I recall something similar"`
   - `'vague'` → `"I vaguely remember"`
   - `'none'` → `"I don't think we've tried this before"`

7. **`cosineSimilarity(a: number[], b: number[]): number`**
   - Standard cosine similarity. Returns 0 for empty/zero vectors.

### Required Tests (minimum 20)

Write these in `src/memory/memory-retrieval.test.ts`:

1. **Retrieves memories within type budgets** — insert 10 episodic, verify max 5 returned.
2. **Retrieves across all three types** — insert all types, verify 5+3+2 max returned.
3. **Respects token budget** — memories with long content, verify total tokens ≤ 800.
4. **Drops lowest-scored when over token budget** — verify correct memories dropped.
5. **Boosts negative-outcome memories** — negative memory with lower raw score surfaces above positive.
6. **Records access on all retrieved memories** — verify store.recordAccess called for each.
7. **Embeds task description when no taskEmbedding** — verify embeddingFn called.
8. **Uses provided taskEmbedding when available** — verify embeddingFn NOT called.
9. **Re-ranks by cosine similarity** — memories closer to query embedding rank higher.
10. **Excludes suppressed memories** — suppressed memory not in results.
11. **Returns empty result when no memories** — verify empty arrays and empty prefix.
12. **Formats prefix for episodic with confidence label** — verify "Episodic (clear):" format.
13. **Formats prefix for procedural** — verify "When {trigger}: step1 → step2" format.
14. **Returns empty prefix for no memories** — verify empty string.
15. **Decay reduces relevance over time** — 30 days at 0.05 rate, verify score reduced.
16. **Pinned memories always return 1.0** — verify isPinned bypasses decay.
17. **Decay at 0 days returns initial weight** — e^0 = 1.
18. **applyDecay updates non-pinned memories** — 5 memories, 2 pinned, verify 3 updated.
19. **Confidence label: 0.9 → clear** — verify.
20. **Confidence label: 0.6 → recall** — verify.
21. **Confidence label: 0.3 → vague** — verify.
22. **Confidence label: 0.1 → none** — verify.
23. **Confidence text maps all labels correctly** — verify all 4 strings.

---

## KIMI-MEMORY-04: Explicit Memory Interface & CLI

### Files to Create

- `src/memory/memory-commands.ts`
- `src/memory/memory-commands.test.ts`

### Purpose

Users interact with agent memory through conversational commands: `nova26 remember "..."` pins a semantic memory, `nova26 forget "..."` suppresses memories, `nova26 ask "Remember when..."` queries episodic memories and returns a natural language summary. Additional CLI commands list, show, export, and import memories.

### Interfaces to Implement

All interfaces must be exported from `src/memory/memory-commands.ts`:

```typescript
export interface MemoryCommandResult {
  command: string;
  success: boolean;
  message: string;
  data?: unknown;
}

export interface MemoryListOptions {
  type?: MemoryType;
  project?: string;
  includeSuppressed?: boolean;
  limit?: number;                    // default: 20
  sortBy?: 'relevance' | 'created' | 'accessed';  // default: 'relevance'
}

export interface MemoryListEntry {
  id: string;
  type: MemoryType;
  content: string;                   // truncated to 80 chars for display
  relevanceScore: number;
  confidenceLabel: MemoryConfidenceLabel;
  outcome: MemoryOutcome;
  age: string;                       // human-readable, e.g. "3 days ago"
  accessCount: number;
  isPinned: boolean;
}

export interface MemoryStatsOutput {
  total: number;
  byType: Record<MemoryType, number>;
  avgRelevance: number;
  pinnedCount: number;
  suppressedCount: number;
  dbSizeBytes: number;
}

export interface MemoryExport {
  version: string;                   // '1.0.0'
  exportedAt: string;
  totalMemories: number;
  memories: AgentMemory[];
}
```

Import from `./agent-memory.js` and `./memory-retrieval.js`.

### Class to Implement

```typescript
export class MemoryCommands {
  constructor(
    store: AgentMemoryStore,
    embeddingFn: (text: string) => Promise<number[]>,
    retrieval: MemoryRetrieval
  );
}
```

### Functions (all instance methods on `MemoryCommands`)

1. **`remember(text: string, tags?: string[]): Promise<MemoryCommandResult>`**
   - Creates a pinned semantic memory: `relevanceScore: 1.0`, `isPinned: true`, `outcome: 'positive'`, `type: 'semantic'`.
   - Embeds the text via `embeddingFn`.
   - Inserts via `store.insertMemory()`.
   - Returns `{ command: 'remember', success: true, message: "Remembered: '${truncated}' (pinned, will not decay)" }`.

2. **`forget(query: string): Promise<MemoryCommandResult>`**
   - Embeds the query. Gets all non-suppressed memories from store.
   - Computes cosine similarity between query embedding and each memory.
   - If best match similarity > 0.5: marks it as `isSuppressed: true` via `store.updateMemory()`.
   - Returns success with the suppressed memory's content preview (first 60 chars), or failure if no match found.

3. **`ask(query: string): Promise<MemoryCommandResult>`**
   - Embeds the query. Queries episodic memories only (non-suppressed, limit 20).
   - Ranks by cosine similarity, takes top 5.
   - Formats a natural language summary. For each memory, includes the confidence label text from `retrieval.getConfidenceText()`.
   - Returns `{ command: 'ask', success: true, message: formattedSummary }`.

4. **`list(options?: MemoryListOptions): MemoryListEntry[]`**
   - Queries the store with filters.
   - Maps each memory to `MemoryListEntry` with:
     - `content` truncated to 80 chars (add "..." if truncated).
     - `confidenceLabel` from `retrieval.getConfidenceLabel()`.
     - `age` from `formatAge()`.
   - Sorts by the specified `sortBy` field.
   - Applies `limit` (default 20).

5. **`show(id: string): AgentMemory | undefined`**
   - Returns the full memory by ID via `store.getMemory()`, or undefined.

6. **`stats(): MemoryStatsOutput`**
   - Returns `store.getStats()` plus `dbSizeBytes` (get file size of the database path).

7. **`exportMemories(): MemoryExport`**
   - Gets all memories from store (including suppressed).
   - Returns `{ version: '1.0.0', exportedAt: now, totalMemories: count, memories: all }`.

8. **`importMemories(data: MemoryExport): MemoryCommandResult`**
   - Validates the export data with zod (version, memories array).
   - For each memory: attempts `store.insertMemory()`, skipping any where the ID already exists.
   - Returns count of successfully imported memories.

9. **`formatAge(isoTimestamp: string): string`**
   - Converts ISO timestamp to human-readable age:
     - < 60 seconds → `"just now"`
     - < 60 minutes → `"N minutes ago"`
     - < 24 hours → `"N hours ago"`
     - < 30 days → `"N days ago"`
     - < 365 days → `"N months ago"`
     - >= 365 days → `"N years ago"`

### Required Tests (minimum 18)

Write these in `src/memory/memory-commands.test.ts`:

1. **Remember creates pinned semantic memory** — verify isPinned true, relevanceScore 1.0, type 'semantic'.
2. **Remember embeds the text** — verify embeddingFn called with the text.
3. **Remember returns success message** — verify message contains the text.
4. **Remember accepts custom tags** — verify tags stored on memory.
5. **Forget suppresses matching memory** — insert memory, forget it, verify isSuppressed true.
6. **Forget returns failure when no match** — empty store, verify success: false.
7. **Forget requires similarity > 0.5** — memory with low similarity not suppressed.
8. **Ask returns episodic memories only** — insert episodic + semantic, verify only episodic in response.
9. **Ask formats natural language summary** — verify message is non-empty with confidence text.
10. **Ask returns top 5 by similarity** — insert 10 episodic, verify only 5 in summary.
11. **List returns memories with truncated content** — content > 80 chars, verify "..." appended.
12. **List filters by type** — verify type filter returns only matching type.
13. **List filters by project** — verify project filter works.
14. **List respects limit** — insert 30 memories, list with default limit, verify 20 returned.
15. **Show returns full memory** — verify all fields present.
16. **Show returns undefined for non-existent ID** — verify.
17. **Stats returns correct counts** — verify all stat fields match inserted data.
18. **Export includes all memories** — insert 5 (including 1 suppressed), export, verify 5 in export.
19. **Import inserts new memories** — export, clear, import, verify all restored.
20. **Import skips duplicate IDs** — import same data twice, verify no duplicates.
21. **FormatAge: seconds ago → "just now"** — verify.
22. **FormatAge: 2 days ago → "2 days ago"** — verify.

---

## KIMI-MEMORY-05: Integration & Wiring

### Files to Modify

- `src/orchestrator/ralph-loop.ts` — **ADD** two new fields to `RalphLoopOptions`

### Files to Create

- `src/memory/index.ts`
- `src/memory/index.test.ts`

### Purpose

Wire the agent memory system into the Ralph Loop. Add `agentMemoryEnabled` and `memoryConfig` to `RalphLoopOptions`. Create the barrel export for the memory module. Write integration tests that verify the full pipeline: insert → consolidate → retrieve → remember → forget → export.

### Modification to `src/orchestrator/ralph-loop.ts`

Add these two lines to the `RalphLoopOptions` interface, **after** the existing visionary engine configs (after `tasteRoomConfig`):

```typescript
  // Agent memory (R16-02)
  agentMemoryEnabled?: boolean;
  memoryConfig?: AgentMemoryConfig;
```

Add the import at the top of the file:

```typescript
import type { AgentMemoryConfig } from '../memory/agent-memory.js';
```

**That is the ONLY change to ralph-loop.ts.** Do not modify any functions.

### Barrel Export: `src/memory/index.ts`

Create a barrel export that re-exports from all new memory modules:

```typescript
export * from './agent-memory.js';
export * from './consolidation-pipeline.js';
export * from './memory-retrieval.js';
export * from './memory-commands.js';
```

**Do not re-export from `session-memory.js`** — that module has its own existing import patterns.

### Integration Tests: `src/memory/index.test.ts`

### Required Tests (minimum 15)

1. **Full pipeline: insert memory, retrieve it** — insert episodic memory, retrieve with related query, verify returned.
2. **Full pipeline: consolidate build, retrieve memory** — run consolidation on mock build, then retrieve, verify the extracted memory appears.
3. **Full pipeline: remember command creates retrievable memory** — remember text, then retrieve with related query, verify it appears.
4. **Full pipeline: forget command prevents retrieval** — remember, forget, retrieve, verify not returned.
5. **Full pipeline: ask returns episodic summary** — insert episodic memories, ask about topic, verify summary.
6. **Decay reduces retrieval ranking over time** — insert old and new memories of equal relevance, verify new ranks higher after decay.
7. **Negative memories surface preferentially** — insert positive and negative memories with same similarity, verify negative ranks higher.
8. **Compression creates semantic from episodic group** — insert 3 related episodic, run compress, verify semantic memory created with supportingMemoryIds.
9. **Pinned memories persist through decay** — apply decay, verify pinned memory still at 1.0.
10. **Landmark memories survive garbage collection** — critical-failure memory at low relevance, run compress, verify not deleted.
11. **Export and import round-trip** — export all, import to fresh store, verify all present.
12. **Memory config flows from RalphLoopOptions** — verify `AgentMemoryConfig` type is importable and assignable to `RalphLoopOptions.memoryConfig`.
13. **Barrel export exposes all key types** — import `AgentMemoryStore`, `ConsolidationPipeline`, `MemoryRetrieval`, `MemoryCommands` from index, verify defined.
14. **Token budget enforced across retrieval** — insert many long-content memories, verify total tokens ≤ 800.
15. **Empty store produces valid results** — retrieve from empty store → empty arrays, empty prefix.

---

## Final Checklist

After completing all 5 tasks, verify:

```bash
npx tsc --noEmit        # 0 errors
npx vitest run           # 1811+ tests (target: 90+ new = 1901+)
```

New files created:
- `src/memory/agent-memory.ts`
- `src/memory/agent-memory.test.ts`
- `src/memory/consolidation-pipeline.ts`
- `src/memory/consolidation-pipeline.test.ts`
- `src/memory/memory-retrieval.ts`
- `src/memory/memory-retrieval.test.ts`
- `src/memory/memory-commands.ts`
- `src/memory/memory-commands.test.ts`
- `src/memory/index.ts`
- `src/memory/index.test.ts`

Modified files:
- `src/orchestrator/ralph-loop.ts` (2 new fields + 1 import only)
