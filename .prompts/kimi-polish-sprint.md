# KIMI TASK FILE — Production Polish Sprint

> Owner: Kimi
> Priority: Production Hardening (crash-proof, fast, thoroughly tested)
> Prerequisite: KIMI-AGENT-01-06, KIMI-VAULT-01-06, KIMI-ACE-01-06, KIMI-INFRA-01-06 complete and merged to main
> Spec sources: Grok R10-01 (Error Recovery), R10-02 (Performance/Caching), R10-03 (Testing at Scale)
> Test baseline: 1226 tests passing, 0 TypeScript errors

---

## Context

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. You have
completed four major sprint cycles:

- **KIMI-AGENT-01-06** — inner loop (ReAct, agent-loop, tool registry, orchestrator)
- **KIMI-VAULT-01-06** — Living Taste Vault (`src/taste-vault/`) and Global Wisdom Pipeline
- **KIMI-ACE-01-06** — ACE Playbook System, Rehearsal Stage, Self-Improvement Protocol
- **KIMI-INFRA-01-06** — Semantic similarity, Convex real-time, security, model routing, analytics

The core product is feature-complete. 1226 tests are passing, 0 TS errors. The product
targets premium pricing at ~$299/month with a local-first (Ollama) value prop.

**This sprint is about production hardening and polish — the difference between a prototype
and a product people pay $299/month for:**

1. **Error Recovery and Checkpointing** — a $299/month product that loses work when Ollama
   crashes is not a product, it is a liability. Agents save state every 3 turns, model
   fallback chains prevent total failures, and the vault can repair itself.
2. **Performance and Caching** — three-tier caching (LLM responses, embeddings, repo maps),
   agent connection pooling, and memory budget enforcement. First task under 30 seconds on M1.
3. **Prompt Snapshot Testing** — capture the full prompt sent to each agent for each task
   type, detect unintended changes, and block merges that break prompt contracts.
4. **Property-Based Testing for the Taste Vault** — graph invariants proven with generated
   data; no orphan edges, no impossible states.
5. **CI Pipeline** — GitHub Actions workflow that gates every PR on type check, unit tests,
   property tests, and snapshot check.
6. **85+ new tests** covering all new modules and edge cases.

**Key existing files you will touch or integrate with:**

- `src/agent-loop/agent-loop.ts` — `AgentLoop`, the ReAct inner loop
- `src/orchestrator/ralph-loop.ts` — `processTask()`, outer build orchestration
- `src/taste-vault/graph-memory.ts` — `GraphMemory`, low-level vault graph engine
- `src/llm/model-router.ts` — `callLLM()`, `AVAILABLE_MODELS`, `selectModelForTask()`
- `src/similarity/semantic-dedup.ts` — `SemanticDedup`, embedding cache (from KIMI-INFRA-01)

**New directories you will create:**

- `src/recovery/` — graceful recovery, checkpointing, model fallback, vault repair
- `src/performance/` — cache manager, agent pool
- `src/testing/` — prompt snapshot system
- `src/taste-vault/property-tests.ts` — property-based tests (in existing directory)
- `.github/workflows/` — CI pipeline

---

## Global Rules (apply to every task)

- **TypeScript strict mode** — no `any`, no implicit `any`, no `@ts-ignore`
- **ESM imports** — always use `.js` extensions on relative imports (e.g., `import { Foo } from './foo.js'`)
- **Zod for all external/runtime data validation** — validate at system boundaries,
  especially when reading persisted JSON or checkpoint files
- **Tests with vitest** — all new tests use `import { describe, it, expect, vi } from 'vitest'`
- **Do not break existing tests** — `npx vitest run` must show 1226+ passing after each task
- **Zero TypeScript errors** — `npx tsc --noEmit` must report 0 errors after every task
- **Commit to main when done** — one commit per KIMI-POLISH task, commit message format:
  `feat(polish): KIMI-POLISH-XX <short description>`
- **Reference existing patterns** — follow singleton factory pattern from `src/tools/tool-registry.ts`
  (class + `get*()` factory + `reset*()` for tests). Match error handling conventions from
  `src/taste-vault/global-wisdom.ts` (catch, log, never throw from context-building paths).
- **File header comments** — every new file starts with a 2-line comment:
  `// <Short description>\n// <Which spec this implements>`
- **No new npm dependencies** without a compelling reason — `zod`, `vitest`, `better-sqlite3`,
  and `fast-check` are available. Do not add libraries arbitrarily.

---

## KIMI-POLISH-01: Error Recovery and Checkpointing

**File:** `src/recovery/graceful-recovery.ts`
**Target size:** ~250 lines
**Spec:** Grok R10-01

### What to build

The `GracefulRecovery` class is the crash-resilience layer for the Nova26 agent pipeline.
It saves agent state at regular intervals so that a crashed build can be resumed rather than
restarted, falls back to smaller models when larger ones OOM or time out, buffers Convex
mutations when the network is unavailable, and repairs corrupt vault files before they cause
silent data loss. This is the most invisible but most important feature for a $299/month
product used in production.

### Core interfaces

```typescript
export interface AgentCheckpoint {
  buildId: string;
  taskId: string;
  agentName: string;
  phase: string;
  checkpointedAt: string;          // ISO timestamp
  turnNumber: number;              // which ReAct turn this was saved after
  scratchpadSnapshot: string;      // JSON-serialized scratchpad state
  completedToolCalls: ToolCallRecord[];
  partialOutput?: string;          // generator output if the generate step completed
  filesWritten: string[];          // absolute paths already written to disk
  tokensUsedSoFar: number;
  resumable: boolean;              // false if state is too corrupt to safely resume
}

export interface ToolCallRecord {
  toolName: string;
  args: Record<string, unknown>;
  result: string;
  calledAt: string;                // ISO timestamp
}

export type ModelFallbackTier = 'primary' | 'mid' | 'base' | 'minimal';

export interface ModelFallbackEntry {
  model: string;                   // Ollama model name, e.g. 'qwen3-coder:32b'
  tier: ModelFallbackTier;
  qualityWarning?: string;         // message shown to the user when this tier is active
}

export interface ConvexSyncEvent {
  id: string;
  mutationPath: string;            // e.g., 'atlas:logTask'
  args: Record<string, unknown>;
  enqueuedAt: string;
  attemptCount: number;
  lastAttemptAt?: string;
  status: 'pending' | 'retrying' | 'failed';
}

export interface VaultRepairReport {
  vaultPath: string;
  checkedAt: string;
  isHealthy: boolean;
  orphanEdgesRemoved: number;
  brokenReferencesFixed: number;
  duplicateIdsResolved: number;
  anomalies: string[];             // human-readable description of each issue found
}
```

### GracefulRecovery class

```typescript
class GracefulRecovery {
  // ---- Checkpoint system ----

  async saveCheckpoint(checkpoint: AgentCheckpoint): Promise<void>
  // Persist checkpoint to .nova/checkpoints/{taskId}.json
  // Create parent directory if it does not exist.
  // Zod-validate the checkpoint shape before writing.
  // Overwrite any existing checkpoint for the same taskId (latest wins).

  async loadCheckpoint(taskId: string): Promise<AgentCheckpoint | null>
  // Read from .nova/checkpoints/{taskId}.json
  // Validate with Zod. If file does not exist or is invalid: return null.

  async listResumableCheckpoints(): Promise<AgentCheckpoint[]>
  // Read all .json files from .nova/checkpoints/
  // Parse and validate each. Return only those where resumable === true.
  // Sort by checkpointedAt desc (most recent first).

  async deleteCheckpoint(taskId: string): Promise<void>
  // Delete .nova/checkpoints/{taskId}.json
  // Silently succeed if file does not exist.

  // ---- Model fallback chain ----

  readonly fallbackChain: ModelFallbackEntry[]
  // Default chain (in order, primary → last resort):
  //   { model: 'qwen3-coder:32b', tier: 'primary' }
  //   { model: 'qwen2.5:14b',     tier: 'mid',     qualityWarning: 'Fell back to 14B — output quality may be reduced.' }
  //   { model: 'qwen2.5:7b',      tier: 'base',    qualityWarning: 'Fell back to 7B — output quality is reduced. Consider re-running.' }
  //   { model: 'llama3.2:3b',     tier: 'minimal', qualityWarning: 'Running on minimal 3B model — output may be incomplete. Re-run with a larger model when available.' }

  selectFallbackModel(currentModel: string, failureReason: string): ModelFallbackEntry | null
  // Given the current model name and a failure reason string:
  //   - Find the current model in fallbackChain by matching model name.
  //   - Return the NEXT entry in the chain (one tier lower).
  //   - If the current model is already 'minimal' tier (or not found): return null
  //     (no further fallback available — the caller should fail gracefully).
  // Log: `GracefulRecovery: falling back from ${currentModel} → ${next.model} (${failureReason})`
  // The failureReason triggers a fallback if it contains any of:
  //   'oom', 'out of memory', 'model not found', 'timeout', 'http error 500', '500'

  isFallbackTrigger(errorMessage: string): boolean
  // Returns true if the error message is a recognized trigger for model fallback.
  // Recognized patterns (case-insensitive):
  //   - contains 'oom' or 'out of memory'
  //   - contains 'model not found'
  //   - contains 'timeout'
  //   - contains 'http error 500' or raw '500' status

  // ---- Convex offline queue ----

  enqueueConvexEvent(mutationPath: string, args: Record<string, unknown>): void
  // Append a ConvexSyncEvent to .nova/offline-queue.jsonl (append-only, newline-delimited JSON).
  // Assign a new crypto.randomUUID() as the event id.
  // Create parent directory if needed.

  async flushOfflineQueue(
    convexUrl: string,
    convexToken?: string
  ): Promise<{ succeeded: number; failed: number }>
  // Read all pending events from .nova/offline-queue.jsonl
  // For each event with status 'pending' or 'retrying':
  //   POST to ${convexUrl}/api/mutation with { path: event.mutationPath, args: event.args }
  //   Use Authorization: Bearer ${convexToken} header if token is provided.
  //   On success: mark as succeeded (remove from file on next write).
  //   On failure: increment attemptCount, set status 'retrying', update lastAttemptAt.
  //   If attemptCount >= 5: set status 'failed' (stop retrying).
  // Rewrite the file with only non-succeeded events.
  // Return { succeeded, failed } counts.

  offlineQueueSize(): number
  // Read .nova/offline-queue.jsonl and count lines with status !== 'succeeded'.
  // Return 0 if file does not exist.

  // ---- Vault repair ----

  async validateVault(vaultPath: string): Promise<VaultRepairReport>
  // Read the JSON file at vaultPath (expected shape: { nodes: [...], edges: [...] })
  // Validate with a loose Zod schema that accepts any node/edge shape.
  // Detect and repair the following issues IN ORDER:
  //
  //   1. Orphan edges: edges where source or target node ID does not exist in nodes array.
  //      Repair: remove the edge. Count in orphanEdgesRemoved.
  //
  //   2. Broken references: nodes that reference other node IDs (e.g. in a 'children' or
  //      'relatedTo' field) where the referenced ID does not exist.
  //      Repair: remove the broken reference from the node. Count in brokenReferencesFixed.
  //      (Best-effort scan: check any field named 'relatedTo', 'children', 'parentId',
  //      'canonicalNodeId' that contains a string value.)
  //
  //   3. Duplicate node IDs: multiple nodes with the same 'id' field.
  //      Repair: keep the first occurrence (lowest index), discard duplicates.
  //      Count in duplicateIdsResolved.
  //
  // After repair, write the cleaned vault back to vaultPath.
  // Return the VaultRepairReport.
  // If vaultPath does not exist: return a report with isHealthy: true and all counts at 0.
  // If vaultPath contains invalid JSON: return a report with isHealthy: false and
  //   anomalies: ['Invalid JSON — vault could not be parsed. Manual recovery required.']
  //   Do NOT attempt to overwrite the file in this case.

  // ---- User-friendly error messages ----

  formatError(errorCode: string, context: Record<string, string>): string
  // Returns a user-friendly, actionable error message string.
  // Never include raw stack traces in the returned string.
  // Supported error codes and their templates:
  //
  //   'OLLAMA_OOM':
  //     "Model ran out of memory. Nova26 is trying a smaller model automatically.
  //      If this keeps happening, run `ollama list` to check available models."
  //
  //   'OLLAMA_TIMEOUT':
  //     "Model took too long to respond (>{context.timeoutSeconds}s). Nova26 will retry with
  //      a faster model. You can adjust the timeout in your config."
  //
  //   'MODEL_NOT_FOUND':
  //     "Model '{context.model}' is not installed. Run `ollama pull {context.model}` to
  //      install it, or configure a different model in your Nova26 settings."
  //
  //   'CONVEX_UNREACHABLE':
  //     "Could not reach Convex (sync is offline). Your build will continue locally. Changes
  //      will sync automatically when the connection is restored."
  //
  //   'VAULT_CORRUPT':
  //     "The Taste Vault at '{context.vaultPath}' has data issues. Nova26 has attempted
  //      automatic repair. If the problem persists, run `nova26 vault repair`."
  //
  //   'VAULT_INVALID_JSON':
  //     "The Taste Vault file at '{context.vaultPath}' could not be read (invalid JSON).
  //      Your build will continue without vault context. To restore, check the file or
  //      delete it and allow Nova26 to create a fresh vault."
  //
  //   'CHECKPOINT_RESUME':
  //     "Resuming task '{context.taskId}' from checkpoint (turn {context.turnNumber}).
  //      Previous progress has been restored."
  //
  //   'BUILD_BUDGET_EXCEEDED':
  //     "Build stopped: token budget of {context.budget} has been reached. Partial results
  //      have been saved. Run with a higher `--budget` to complete the build."
  //
  //   Any unknown code: "An unexpected error occurred. Check .nova/logs/errors.log for
  //      technical details."
}
```

### Zod schemas

```typescript
const ToolCallRecordSchema = z.object({
  toolName: z.string(),
  args: z.record(z.unknown()),
  result: z.string(),
  calledAt: z.string(),
});

const AgentCheckpointSchema = z.object({
  buildId: z.string(),
  taskId: z.string(),
  agentName: z.string(),
  phase: z.string(),
  checkpointedAt: z.string(),
  turnNumber: z.number().int().nonnegative(),
  scratchpadSnapshot: z.string(),
  completedToolCalls: z.array(ToolCallRecordSchema),
  partialOutput: z.string().optional(),
  filesWritten: z.array(z.string()),
  tokensUsedSoFar: z.number().nonnegative(),
  resumable: z.boolean(),
});

const ConvexSyncEventSchema = z.object({
  id: z.string(),
  mutationPath: z.string(),
  args: z.record(z.unknown()),
  enqueuedAt: z.string(),
  attemptCount: z.number().int().nonnegative(),
  lastAttemptAt: z.string().optional(),
  status: z.enum(['pending', 'retrying', 'failed']),
});
```

### Singleton factory

```typescript
export function getGracefulRecovery(): GracefulRecovery
export function resetGracefulRecovery(): void  // for tests — clears singleton
```

### Integration with AgentLoop

In `src/agent-loop/agent-loop.ts`, wrap the ReAct turn loop in a try/catch and add
checkpoint saves every 3 turns. Read the file before touching it.

```typescript
// After every 3rd turn completes successfully:
if (turnNumber % 3 === 0) {
  try {
    const recovery = getGracefulRecovery();
    await recovery.saveCheckpoint({
      buildId: this.config.buildId ?? 'unknown',
      taskId: this.config.taskId,
      agentName: this.config.agentName,
      phase: this.config.phase ?? 'unknown',
      checkpointedAt: new Date().toISOString(),
      turnNumber,
      scratchpadSnapshot: JSON.stringify(this.scratchpad.getSnapshot()),
      completedToolCalls: this.completedToolCalls,
      partialOutput: this.partialOutput,
      filesWritten: this.filesWritten,
      tokensUsedSoFar: this.tokensUsed,
      resumable: true,
    });
  } catch {
    // never let checkpointing break the main loop
  }
}

// In the catch block for LLM call failures, check for fallback trigger:
} catch (err) {
  const errMsg = err instanceof Error ? err.message : String(err);
  const recovery = getGracefulRecovery();
  if (recovery.isFallbackTrigger(errMsg) && this.currentModel) {
    const fallback = recovery.selectFallbackModel(this.currentModel, errMsg);
    if (fallback) {
      console.warn(recovery.formatError(
        errMsg.toLowerCase().includes('oom') ? 'OLLAMA_OOM' : 'OLLAMA_TIMEOUT',
        { model: this.currentModel, timeoutSeconds: '120' }
      ));
      this.currentModel = fallback.model;
      if (fallback.qualityWarning) console.warn(`  ${fallback.qualityWarning}`);
      continue; // retry the turn with the fallback model
    }
  }
  throw err;
}
```

### Notes

- Checkpoint files are per-task, not per-build. Multiple tasks in a build each have their
  own checkpoint file.
- On successful task completion, the caller (ralph-loop.ts) should call
  `getGracefulRecovery().deleteCheckpoint(taskId)` to clean up.
- The offline queue is append-only during a build. `flushOfflineQueue()` is called
  opportunistically — it is safe to call repeatedly.
- `validateVault()` is non-destructive on invalid JSON — it never overwrites a file it
  cannot parse. The user's raw data is always preserved as-is in the corruption case.

---

## KIMI-POLISH-02: Performance and Caching

**Files:** `src/performance/cache-manager.ts`, `src/performance/agent-pool.ts`
**Target size:** ~300 lines total
**Spec:** Grok R10-02

### What to build

Two classes that make Nova26 fast on consumer hardware:

**CacheManager**: a three-tier caching system. LLM responses are expensive — caching an
identical prompt+model pair avoids a 5-30 second model call. Embeddings cost a Ollama round
trip — caching them makes semantic search instant on the second lookup. The repo map is a
filesystem scan — caching it avoids re-scanning on every build when nothing has changed.

**AgentPool**: a connection and state pool that reuses Ollama client setup across agent
invocations. Combined with memory budget enforcement, this prevents Nova26 from consuming
all available RAM when many agents are active simultaneously.

### CacheManager class

```typescript
// src/performance/cache-manager.ts
// Three-tier cache: LLM response cache, embedding cache, repo map cache
// Implements Grok R10-02 performance specification

export interface LLMCacheEntry {
  key: string;            // SHA-256 of (model + prompt)
  response: string;
  cachedAt: string;       // ISO timestamp
  expiresAt: string;      // ISO timestamp (cachedAt + TTL)
  model: string;
  promptPreview: string;  // first 100 chars of the prompt, for debugging
}

export interface EmbeddingCacheEntry {
  key: string;            // SHA-256 of (text + model)
  embedding: number[];
  model: string;
  cachedAt: string;
  expiresAt: string;
}

export interface RepoMapCacheEntry {
  directoryHash: string;  // SHA-256 of sorted file paths + mtimes in the directory
  repoPath: string;
  map: Record<string, unknown>;  // the repo map data (opaque to CacheManager)
  cachedAt: string;
}

export interface CacheStats {
  llmHits: number;
  llmMisses: number;
  llmHitRate: number;
  llmSize: number;        // number of entries
  embeddingHits: number;
  embeddingMisses: number;
  embeddingSize: number;
  repoMapHits: number;
  repoMapMisses: number;
  repoMapSize: number;
}

class CacheManager {
  constructor(options?: {
    llmTTLMs?: number;          // default: 3_600_000 (1 hour)
    llmMaxEntries?: number;      // default: 500
    embeddingTTLMs?: number;    // default: 86_400_000 (24 hours)
    embeddingMaxEntries?: number; // default: 10_000
  })

  // ---- LLM response cache ----

  async getLLMResponse(model: string, prompt: string): Promise<string | null>
  // Compute key = SHA-256 of (model + '\x00' + prompt).
  // Look up in in-memory LLM cache map.
  // If found AND entry.expiresAt > now: return entry.response (cache hit).
  // Otherwise: return null (cache miss).
  // Increment llmHits or llmMisses accordingly.

  async setLLMResponse(model: string, prompt: string, response: string): Promise<void>
  // Compute key = SHA-256 of (model + '\x00' + prompt).
  // Store LLMCacheEntry in in-memory map.
  // If map size > llmMaxEntries: evict the oldest entry (LRU approximation: lowest cachedAt).
  // TTL: expiresAt = cachedAt + llmTTLMs.

  // ---- Embedding cache ----

  async getEmbedding(text: string, model: string): Promise<number[] | null>
  // Compute key = SHA-256 of (text + '\x00' + model).
  // Look up in in-memory embedding cache map.
  // If found AND not expired: return embedding.
  // Otherwise: return null.

  async setEmbedding(text: string, model: string, embedding: number[]): Promise<void>
  // Store EmbeddingCacheEntry. Evict LRU entries if size > embeddingMaxEntries.

  // Extend SemanticDedup's existing embedding cache:
  // CacheManager.getEmbedding() and setEmbedding() use the SAME key format as
  // SemanticDedup's in-memory cache so they are interoperable.
  // Call getSemanticDedup().getEmbedding() first (which checks its own cache),
  // and feed results into CacheManager for persistence.

  // ---- Repo map cache ----

  async getRepoMap(repoPath: string, directoryHash: string): Promise<Record<string, unknown> | null>
  // Look up in in-memory repo map cache by (repoPath + directoryHash).
  // Return map if found, null otherwise.
  // (No TTL — invalidation is by directory hash change only.)

  async setRepoMap(repoPath: string, directoryHash: string, map: Record<string, unknown>): Promise<void>
  // Store RepoMapCacheEntry. Max 50 repo map entries (evict oldest).

  invalidateRepoMap(repoPath: string): void
  // Remove all cached repo maps for a given repoPath from in-memory cache.

  // ---- Stats and management ----

  stats(): CacheStats
  // Return current hit/miss counts and sizes for all three tiers.

  clearAll(): void
  // Clear all three in-memory caches. For tests.

  // Singleton factory
}

export function getCacheManager(): CacheManager
export function resetCacheManager(): void  // for tests
```

### AgentPool class

```typescript
// src/performance/agent-pool.ts
// Agent connection pool with LRU eviction and memory budget enforcement
// Implements Grok R10-02 performance specification

export interface PooledAgent {
  agentName: string;
  ollamaBaseUrl: string;
  lastUsedAt: string;     // ISO timestamp — for LRU eviction
  isActive: boolean;      // true if currently executing a task
  estimatedMemoryMb: number;  // approximate RAM cost of keeping this agent alive
}

export interface AgentPoolStats {
  active: number;          // agents currently executing
  idle: number;            // agents in pool but not executing
  evicted: number;         // total agents evicted since pool creation
  poolSize: number;        // current total agents in pool (active + idle)
  memoryBudgetMb: number;
  estimatedUsedMb: number;
}

export interface MemoryBudget {
  totalBudgetMb: number;  // configurable, default: 512 (Nova26's own RAM, not Ollama model memory)
  warningThresholdPct: number;  // default: 0.80 — collapse scratchpad above this
  hardLimitPct: number;  // default: 0.95 — refuse new agents above this
}

class AgentPool {
  constructor(options?: {
    maxPoolSize?: number;        // default: 10
    idleTimeoutMs?: number;      // evict idle agents after this (default: 300_000 — 5 min)
    memoryBudget?: Partial<MemoryBudget>;
    ollamaBaseUrl?: string;      // default: 'http://localhost:11434'
  })

  acquire(agentName: string): PooledAgent
  // Return an existing PooledAgent for agentName if one exists in the pool (cache hit).
  // Otherwise create a new PooledAgent with:
  //   estimatedMemoryMb = 8  (baseline per-agent overhead in Nova26's process)
  //   isActive = true
  //   lastUsedAt = now
  // Add to pool. If pool size > maxPoolSize: evict the least-recently-used IDLE agent first.
  // If no idle agents to evict and pool is at maxPoolSize: evict the LRU idle agent anyway.
  // Log: `AgentPool: acquired ${agentName} (pool size: ${this.pool.size})`

  release(agentName: string): void
  // Mark the agent as idle (isActive = false). Update lastUsedAt = now.
  // If the agent is above the memory warning threshold: attempt to trim its scratchpad.
  // (Trimming is advisory — set estimatedMemoryMb back to baseline 8MB.)

  evict(agentName: string): void
  // Remove the agent from the pool entirely.
  // Increment evicted count.
  // Log: `AgentPool: evicted ${agentName}`

  evictIdleAgents(): void
  // Remove all agents where isActive === false AND
  //   (now - lastUsedAt) > idleTimeoutMs.

  checkMemoryBudget(): { withinBudget: boolean; usedMb: number; budgetMb: number }
  // Sum estimatedMemoryMb for all agents in pool.
  // Return whether we are within the configured budget.

  shouldCollapseScratchpad(): boolean
  // Return true when estimatedUsedMb > totalBudgetMb * warningThresholdPct.
  // Used by AgentLoop to decide whether to trim the scratchpad.

  stats(): AgentPoolStats

  // Pre-warm: initialize pool entries for the given agents without marking them active
  prewarm(agentNames: string[]): void
  // For each agentName: add a PooledAgent with isActive = false, lastUsedAt = now.
  // This ensures the first acquire() for these agents is a cache hit.
  // Skip names already in the pool.

  clear(): void
  // Empty the pool. For tests.
}

export function getAgentPool(): AgentPool
export function resetAgentPool(): void  // for tests
```

### Memory budget enforcement in AgentLoop

After acquiring from the pool and before starting each turn, check:

```typescript
// In src/agent-loop/agent-loop.ts, at the start of each turn:
const pool = getAgentPool();
if (pool.shouldCollapseScratchpad()) {
  // Collapse: keep only the last 3 turns of the scratchpad.
  this.scratchpad.collapse(3);
  console.warn('AgentPool: memory pressure detected — scratchpad collapsed to last 3 turns');
}
```

### Integration with callLLM

In `src/llm/model-router.ts`, wrap the Ollama call with a cache check:

```typescript
// Before calling the model, check the LLM cache:
const cacheManager = getCacheManager();
const cachedResponse = await cacheManager.getLLMResponse(model.name, prompt);
if (cachedResponse !== null) {
  // Cache hit — return immediately without calling Ollama
  return cachedResponse;
}

// ... call Ollama as usual ...

// After a successful call, store in cache:
await cacheManager.setLLMResponse(model.name, prompt, result);
```

Do not cache if the prompt contains `<rehearsal_context>` tags (those are
branch-generation prompts that should not be reused). Check:
`if (!prompt.includes('<rehearsal_context>'))` before caching.

### Notes

- The CacheManager's embedding cache and SemanticDedup's embedding cache are separate
  in-memory stores but use compatible key formats. In a future sprint they can be unified.
  For now, CacheManager provides the TTL-aware, size-bounded layer; SemanticDedup has its
  own simpler cache that persists to disk.
- AgentPool does not manage Ollama model loading — that is Ollama's responsibility. The pool
  manages Nova26's own per-agent state objects (scratchpad, session memory, config).
- `prewarm()` is called at nova26 startup with the 2-3 most frequently used agents based
  on build history. The startup call site is in `ralph-loop.ts` before the first task is
  processed. Read ralph-loop.ts before making this addition.

---

## KIMI-POLISH-03: Prompt Snapshot Testing

**Files:** `src/testing/prompt-snapshots.ts`, `src/testing/prompt-snapshots.test.ts`
**Target size:** ~150 lines + test file
**Spec:** Grok R10-03

### What to build

Agent prompts are the hidden control surface of Nova26. A one-line change to a system
prompt can silently degrade output quality across every build. The snapshot system captures
the full rendered prompt for each agent/task-type combination, stores it as a baseline
`.snap` file, and fails loudly when a prompt changes without an explicit developer decision
to update the snapshot.

### Core interfaces

```typescript
export interface PromptSnapshot {
  agent: string;          // agent name, e.g. 'MARS'
  taskType: string;       // e.g. 'code-generation', 'testing', 'architecture'
  prompt: string;         // the full rendered prompt
  capturedAt: string;     // ISO timestamp
  promptHash: string;     // SHA-256 of prompt, for fast comparison
  version: string;        // semver or build tag, e.g. '1.0.0'
}

export type DriftResult =
  | { drifted: false }
  | {
      drifted: true;
      agent: string;
      taskType: string;
      oldHash: string;
      newHash: string;
      diffSummary: string;  // first 200 chars of the changed section
    };
```

### PromptSnapshotManager class

```typescript
class PromptSnapshotManager {
  constructor(options?: {
    snapshotDir?: string;  // default: '.nova/testing/snapshots'
    version?: string;      // default: '1.0.0'
  })

  async captureSnapshot(
    agent: string,
    taskType: string,
    prompt: string
  ): Promise<PromptSnapshot>
  // Compute SHA-256 hash of the prompt.
  // Build a PromptSnapshot object.
  // Write to .nova/testing/snapshots/{agent}-{taskType}.snap as JSON.
  // Create parent directory if needed.
  // Return the snapshot.

  async loadSnapshot(agent: string, taskType: string): Promise<PromptSnapshot | null>
  // Read .nova/testing/snapshots/{agent}-{taskType}.snap
  // Parse and validate with Zod.
  // Return null if file does not exist or is invalid.

  async detectPromptDrift(
    agent: string,
    taskType: string,
    currentPrompt: string
  ): Promise<DriftResult>
  // 1. Load the stored snapshot for this agent + taskType.
  // 2. If no snapshot exists: return { drifted: false }
  //    (No baseline to compare against — first capture establishes the baseline.)
  // 3. Compute SHA-256 of currentPrompt.
  // 4. If hash matches stored snapshot.promptHash: return { drifted: false }
  // 5. If hashes differ: find the first differing line between stored and current prompt.
  //    Set diffSummary = first 200 chars starting from the first differing line.
  //    Return { drifted: true, agent, taskType, oldHash: stored hash, newHash: current hash, diffSummary }

  async updateSnapshot(agent: string, taskType: string, prompt: string): Promise<void>
  // Force-overwrite the snapshot with the current prompt.
  // This is the `--update-snapshots` path.
  // Log: `PromptSnapshots: updated snapshot for ${agent}/${taskType}`

  async detectAllDrift(
    renderPrompt: (agent: string, taskType: string) => Promise<string>
  ): Promise<DriftResult[]>
  // Read all .snap files from the snapshot directory.
  // For each, call renderPrompt(agent, taskType) to get the current rendered prompt.
  // Run detectPromptDrift() for each.
  // Return only the entries where drifted === true.

  listSnapshots(): Promise<Array<{ agent: string; taskType: string }>>
  // Read snapshot directory, parse filenames matching pattern {agent}-{taskType}.snap
  // Return array of { agent, taskType } objects.
}
```

### Zod schema for snapshot files

```typescript
const PromptSnapshotSchema = z.object({
  agent: z.string(),
  taskType: z.string(),
  prompt: z.string(),
  capturedAt: z.string(),
  promptHash: z.string(),
  version: z.string(),
});
```

### Singleton factory

```typescript
export function getPromptSnapshotManager(): PromptSnapshotManager
export function resetPromptSnapshotManager(): void  // for tests
```

### Standard task types for snapshot coverage

Use these `taskType` values as the standard set when capturing and checking snapshots:

```typescript
export const STANDARD_TASK_TYPES = [
  'code-generation',
  'testing',
  'architecture',
  'review',
  'debugging',
] as const;
```

### Notes

- Snapshot files are committed to the repository alongside code. When a developer
  intentionally changes a prompt, they run `nova26 test --update-snapshots` (or
  equivalent) to refresh the baselines and commit both the code change and the updated
  `.snap` files in the same PR.
- The CI job (KIMI-POLISH-05) runs `detectAllDrift()` and fails the build if any snapshots
  have drifted without an explicit update.
- Do not snapshot prompts that include dynamic content like vault context (those will always
  drift). The snapshot captures the structural template portion of the prompt only.
  In practice, call the prompt builder with an empty vault context for snapshot purposes.

---

## KIMI-POLISH-04: Property-Based Testing for the Taste Vault

**File:** `src/taste-vault/property-tests.ts`
**Target size:** ~200 lines
**Spec:** Grok R10-03

### What to build

Property-based tests that prove the Taste Vault's graph invariants hold under any sequence
of random operations. Rather than testing specific cases, these tests generate hundreds of
random graphs, apply random operations, and assert that the invariants never break.

**Required dependency:** `fast-check` — the standard TypeScript property-based testing
library. If it is already in `devDependencies`, use it. If not, add it:
`npm install --save-dev fast-check`

### Graph invariants (must hold after EVERY operation)

```typescript
// These 6 invariants must be verified in all property tests:

// 1. Every edge references existing nodes (no orphan edges)
//    For every edge e: nodes.some(n => n.id === e.source) && nodes.some(n => n.id === e.target)

// 2. Node IDs are unique
//    new Set(nodes.map(n => n.id)).size === nodes.length

// 3. Confidence is always 0–1 (for nodes that have a confidence field)
//    For every node n that has a numeric 'confidence' field:
//    n.confidence >= 0 && n.confidence <= 1

// 4. No self-referencing edges
//    For every edge e: e.source !== e.target

// 5. Edge relations are valid enum values
//    Valid relations: 'SIMILAR_TO' | 'DERIVED_FROM' | 'CONTRADICTS' | 'REINFORCES' | 'APPLIED_WITH'
//    For every edge e: VALID_RELATIONS.includes(e.relation)

// 6. helpfulCount is never negative
//    For every node n that has a numeric 'helpfulCount' field: n.helpfulCount >= 0
```

### Arbitraries (fast-check generators)

```typescript
import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

// Generate a valid node ID
const arbitraryNodeId = fc.uuid();

// Generate a single valid vault node
const arbitraryVaultNode = fc.record({
  id: arbitraryNodeId,
  content: fc.string({ minLength: 1, maxLength: 500 }),
  confidence: fc.float({ min: 0, max: 1, noNaN: true }),
  helpfulCount: fc.nat(),         // non-negative integer
  createdAt: fc.constant(new Date().toISOString()),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
});

// Generate a valid edge between two node IDs
const arbitraryEdge = (nodeIds: string[]) =>
  fc.record({
    id: fc.uuid(),
    source: fc.constantFrom(...nodeIds),
    target: fc.constantFrom(...nodeIds),
    relation: fc.constantFrom(
      'SIMILAR_TO', 'DERIVED_FROM', 'CONTRADICTS', 'REINFORCES', 'APPLIED_WITH'
    ),
    confidence: fc.float({ min: 0, max: 1, noNaN: true }),
  }).filter(e => e.source !== e.target);  // no self-referencing edges

// Generate a valid vault graph (nodes + edges, all constraints satisfied)
const arbitraryValidVaultGraph = fc
  .array(arbitraryVaultNode, { minLength: 2, maxLength: 20 })
  .chain(nodes => {
    const nodeIds = nodes.map(n => n.id);
    // Ensure unique IDs (fast-check may generate duplicates via fc.uuid() collisions)
    const uniqueNodes = nodes.filter(
      (n, i, arr) => arr.findIndex(x => x.id === n.id) === i
    );
    if (uniqueNodes.length < 2) {
      return fc.constant({ nodes: uniqueNodes, edges: [] });
    }
    const uniqueIds = uniqueNodes.map(n => n.id);
    return fc
      .array(arbitraryEdge(uniqueIds), { maxLength: uniqueNodes.length * 2 })
      .map(edges => ({ nodes: uniqueNodes, edges }));
  });
```

### Property tests to implement

```typescript
describe('Taste Vault graph invariants', () => {
  // Invariant 1: no orphan edges after any add/remove operation
  it('no orphan edges after adding a node', () => {
    fc.assert(fc.property(arbitraryValidVaultGraph, arbitraryVaultNode, (graph, newNode) => {
      const updated = addNode(graph, newNode);
      return checkNoOrphanEdges(updated);
    }));
  });

  it('no orphan edges after removing a node', () => {
    fc.assert(fc.property(arbitraryValidVaultGraph, (graph) => {
      if (graph.nodes.length === 0) return true;
      const nodeToRemove = graph.nodes[0];
      const updated = removeNode(graph, nodeToRemove.id);
      return checkNoOrphanEdges(updated);
    }));
  });

  // Invariant 2: node IDs remain unique after operations
  it('node IDs are unique after bulk insert', () => {
    fc.assert(fc.property(
      arbitraryValidVaultGraph,
      fc.array(arbitraryVaultNode, { maxLength: 10 }),
      (graph, newNodes) => {
        let updated = graph;
        for (const node of newNodes) {
          updated = addNode(updated, node);
        }
        const ids = updated.nodes.map(n => n.id);
        return new Set(ids).size === ids.length;
      }
    ));
  });

  // Invariant 3: confidence is always 0–1 after update operations
  it('confidence stays in [0, 1] after update', () => {
    fc.assert(fc.property(
      arbitraryValidVaultGraph,
      fc.float({ min: 0, max: 1, noNaN: true }),
      (graph, newConfidence) => {
        if (graph.nodes.length === 0) return true;
        const updated = updateNodeConfidence(graph, graph.nodes[0].id, newConfidence);
        return updated.nodes.every(n =>
          typeof n.confidence === 'undefined' ||
          (n.confidence >= 0 && n.confidence <= 1)
        );
      }
    ));
  });

  // Invariant 4: no self-referencing edges after adding an edge
  it('no self-referencing edges are ever added', () => {
    fc.assert(fc.property(arbitraryValidVaultGraph, fc.uuid(), (graph, nodeId) => {
      if (graph.nodes.length === 0) return true;
      // Attempt to add a self-referencing edge and confirm it is rejected
      const selfEdge = {
        id: nodeId,
        source: graph.nodes[0].id,
        target: graph.nodes[0].id,
        relation: 'SIMILAR_TO' as const,
        confidence: 0.5,
      };
      const updated = tryAddEdge(graph, selfEdge);
      return updated.edges.every(e => e.source !== e.target);
    }));
  });

  // Invariant 5: edge relations are always valid enum values
  it('all edge relations are valid after random operations', () => {
    fc.assert(fc.property(arbitraryValidVaultGraph, (graph) => {
      const validRelations = new Set([
        'SIMILAR_TO', 'DERIVED_FROM', 'CONTRADICTS', 'REINFORCES', 'APPLIED_WITH',
      ]);
      return graph.edges.every(e => validRelations.has(e.relation));
    }));
  });

  // Invariant 6: helpfulCount is never negative
  it('helpfulCount is never negative', () => {
    fc.assert(fc.property(arbitraryValidVaultGraph, (graph) => {
      return graph.nodes.every(n =>
        typeof n.helpfulCount === 'undefined' || n.helpfulCount >= 0
      );
    }));
  });

  // Stress test: 1000 rapid operations
  it('all invariants hold after 1000 random operations', () => {
    fc.assert(
      fc.property(
        arbitraryValidVaultGraph,
        fc.array(
          fc.oneof(
            fc.record({ op: fc.constant('addNode' as const), node: arbitraryVaultNode }),
            fc.record({ op: fc.constant('removeNode' as const), index: fc.nat({ max: 19 }) }),
          ),
          { minLength: 50, maxLength: 1000 }
        ),
        (graph, operations) => {
          let state = graph;
          for (const operation of operations) {
            if (operation.op === 'addNode') {
              state = addNode(state, operation.node);
            } else if (operation.op === 'removeNode' && state.nodes.length > 0) {
              const idx = operation.index % state.nodes.length;
              state = removeNode(state, state.nodes[idx].id);
            }
          }
          return (
            checkNoOrphanEdges(state) &&
            checkUniqueIds(state) &&
            checkConfidenceRange(state) &&
            checkNoSelfEdges(state) &&
            checkValidRelations(state) &&
            checkNonNegativeHelpfulCount(state)
          );
        }
      ),
      { numRuns: 100 }  // 100 different random starting graphs × up to 1000 ops each
    );
  });
});
```

### Helper functions (implement alongside the tests)

```typescript
// These are pure utility functions that apply operations to a plain graph object.
// They do NOT call TasteVault methods — they operate on raw { nodes, edges } data
// to keep the property tests isolated from I/O.

type RawGraph = {
  nodes: Array<{ id: string; confidence?: number; helpfulCount?: number; [key: string]: unknown }>;
  edges: Array<{ id: string; source: string; target: string; relation: string; confidence?: number }>;
};

function addNode(graph: RawGraph, node: RawGraph['nodes'][0]): RawGraph
// Add node. If a node with the same id already exists, replace it (upsert semantics).
// Edges are unchanged.

function removeNode(graph: RawGraph, nodeId: string): RawGraph
// Remove the node with the given id.
// Also remove ALL edges where source === nodeId OR target === nodeId.
// (This maintains invariant 1 — no orphan edges after node removal.)

function tryAddEdge(graph: RawGraph, edge: RawGraph['edges'][0]): RawGraph
// Add the edge ONLY IF:
//   - source !== target (no self-reference)
//   - source exists in nodes
//   - target exists in nodes
//   - relation is a valid enum value
// If any condition fails: return graph unchanged (reject the edge silently).

function updateNodeConfidence(graph: RawGraph, nodeId: string, confidence: number): RawGraph
// Update the confidence of the node with the given id.
// Clamp confidence to [0, 1].

// Invariant checkers (return true if invariant holds):
function checkNoOrphanEdges(graph: RawGraph): boolean
function checkUniqueIds(graph: RawGraph): boolean
function checkConfidenceRange(graph: RawGraph): boolean
function checkNoSelfEdges(graph: RawGraph): boolean
function checkValidRelations(graph: RawGraph): boolean
function checkNonNegativeHelpfulCount(graph: RawGraph): boolean
```

### Notes

- These property tests do not import TasteVault or GraphMemory. They test the invariants
  of the data model in isolation using raw graph objects. This keeps them fast and
  deterministic — no I/O, no singletons, no file system.
- The `fast-check` library generates minimal failing examples automatically. When a test
  fails, the output will show the smallest input that violates the invariant.
- Target: 100 runs of the stress test = 100,000+ individual operations verified.

---

## KIMI-POLISH-05: CI Pipeline Configuration

**File:** `.github/workflows/ci.yml`
**Target size:** ~100 lines
**Spec:** Grok R10-03

### What to build

A GitHub Actions workflow that gates every push to main and every pull request on four
quality checks. The workflow is structured as four independent jobs that run in parallel
where possible, with caching to minimize CI time.

### Complete workflow YAML

```yaml
name: Nova26 CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  typecheck:
    name: TypeScript Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Check TypeScript
        run: npx tsc --noEmit

  unit-integration:
    name: Unit + Integration Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Run tests
        run: npx vitest run --reporter=verbose --exclude='**/property-tests*'
      - name: Report results
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            // Post test result summary as a PR comment when running on a PR
            if (context.eventName === 'pull_request') {
              const summary = `Test run completed on commit ${context.sha.slice(0, 7)}.`;
              await github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: summary,
              });
            }

  property-tests:
    name: Property-Based Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Run property-based tests
        run: npx vitest run --reporter=verbose src/taste-vault/property-tests.ts
        timeout-minutes: 10

  snapshot-check:
    name: Prompt Snapshot Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Check for prompt drift
        run: npx vitest run --reporter=verbose src/testing/prompt-snapshots.test.ts
      - name: Fail on unexpected snapshot drift
        # If any snapshot has changed without an explicit update, this step fails the build.
        # Developers must run `nova26 test --update-snapshots` and commit the updated .snap
        # files alongside their code changes.
        run: |
          if git diff --name-only | grep -q '\.snap$'; then
            echo "ERROR: Prompt snapshots have drifted. Run 'nova26 test --update-snapshots'"
            echo "and commit the updated .snap files."
            exit 1
          fi
```

### Notes

- The four jobs run in parallel — total CI time is the slowest of the four, not the sum.
- Node modules are cached via `actions/setup-node`'s built-in `cache: 'npm'` option.
  This avoids a full `npm ci` download on every run after the first.
- The snapshot-check job fails if `.snap` files have changed content without being
  explicitly committed. The check is: run the snapshot tests (which re-render current
  prompts) and then verify the `.snap` files in the working tree match the committed files.
- The PR comment step in `unit-integration` requires the `pull_request` event.
  It posts a comment on every PR with the commit SHA. Expand this in a future sprint
  to include a full test summary table.
- `timeout-minutes: 10` on property tests prevents runaway generators from blocking CI.

---

## KIMI-POLISH-06: Tests

**Files:**
- `src/recovery/graceful-recovery.test.ts` — ~25 tests
- `src/performance/cache-manager.test.ts` — ~20 tests
- `src/performance/agent-pool.test.ts` — ~15 tests
- `src/testing/prompt-snapshots.test.ts` — ~10 tests
- `src/taste-vault/property-tests.ts` — ~15 property tests (counts toward total)

**Target:** 85+ new tests. All must pass. Existing 1226 tests must still pass.

### graceful-recovery.test.ts (~25 tests)

Use `vi.stubGlobal('fetch', ...)` to mock the Convex HTTP call in `flushOfflineQueue`.
Use a temporary directory (e.g., via `os.tmpdir()`) for checkpoint file tests.
Call `resetGracefulRecovery()` in `beforeEach`.

Cover:

- `saveCheckpoint()` writes a valid JSON file to the checkpoint directory
- `saveCheckpoint()` creates the `.nova/checkpoints/` directory if it does not exist
- `saveCheckpoint()` overwrites an existing checkpoint for the same taskId
- `loadCheckpoint()` returns the checkpoint that was saved
- `loadCheckpoint()` returns null when no checkpoint file exists
- `loadCheckpoint()` returns null when the checkpoint file is invalid JSON
- `loadCheckpoint()` returns null when the checkpoint fails Zod validation
- `listResumableCheckpoints()` returns only checkpoints where resumable === true
- `listResumableCheckpoints()` returns checkpoints sorted by checkpointedAt desc
- `listResumableCheckpoints()` returns empty array when no checkpoint files exist
- `deleteCheckpoint()` removes the checkpoint file
- `deleteCheckpoint()` succeeds silently when the file does not exist
- `isFallbackTrigger()` returns true for 'oom', 'out of memory', 'timeout', '500'
- `isFallbackTrigger()` is case-insensitive
- `isFallbackTrigger()` returns false for unrecognized error messages
- `selectFallbackModel()` returns the next tier when current model is 'primary'
- `selectFallbackModel()` returns the 'base' model when current model is 'mid'
- `selectFallbackModel()` returns null when current model is 'minimal' (no further fallback)
- `selectFallbackModel()` returns null when current model is not in the fallback chain
- `enqueueConvexEvent()` appends a valid JSON line to `.nova/offline-queue.jsonl`
- `flushOfflineQueue()` POSTs each pending event to the Convex URL
- `flushOfflineQueue()` marks events as failed after 5 consecutive failures
- `offlineQueueSize()` returns the count of pending/retrying events
- `validateVault()` removes orphan edges and reports the count
- `validateVault()` resolves duplicate node IDs and reports the count
- `validateVault()` returns isHealthy: false and no repair attempt on invalid JSON files
- `formatError()` returns a user-friendly string for each known error code
- `formatError()` returns a generic message for unknown error codes
- `formatError()` never includes the word 'stack' or 'Error:' in its output

### cache-manager.test.ts (~20 tests)

Call `resetCacheManager()` in `beforeEach`.

Cover:

- `getLLMResponse()` returns null on cache miss
- `setLLMResponse()` + `getLLMResponse()` round-trip: returns the stored response
- `getLLMResponse()` returns null when the TTL has expired (mock Date.now() to simulate expiry)
- `setLLMResponse()` evicts the oldest entry when llmMaxEntries is exceeded
- `getLLMResponse()` correctly generates the same cache key for identical model + prompt
- `getLLMResponse()` correctly generates different keys for different models with same prompt
- `getEmbedding()` returns null on cache miss
- `setEmbedding()` + `getEmbedding()` round-trip: returns the stored embedding array
- `getEmbedding()` returns null when the embedding TTL has expired
- `setEmbedding()` evicts entries when embeddingMaxEntries is exceeded
- `getRepoMap()` returns null on cache miss
- `setRepoMap()` + `getRepoMap()` round-trip with matching directoryHash
- `getRepoMap()` returns null when directoryHash differs (stale map)
- `invalidateRepoMap()` removes all cached maps for the given repoPath
- `stats()` returns zero hits and misses on a fresh instance
- `stats()` correctly counts hits and misses after several get calls
- `stats().llmHitRate` equals hits / (hits + misses) correctly
- `clearAll()` resets all three caches to empty state
- `getCacheManager()` returns the same singleton on multiple calls
- `resetCacheManager()` causes next `getCacheManager()` call to return a fresh instance

### agent-pool.test.ts (~15 tests)

Call `resetAgentPool()` in `beforeEach`.

Cover:

- `acquire()` returns a PooledAgent with isActive = true
- `acquire()` returns the SAME PooledAgent on a second call for the same agentName (cache hit)
- `acquire()` creates a new PooledAgent for a different agentName
- `release()` sets the agent's isActive to false
- `release()` updates lastUsedAt to the current time
- `evict()` removes the agent from the pool
- `evict()` increments the evicted count
- `acquire()` evicts the LRU idle agent when maxPoolSize is reached
- `evictIdleAgents()` removes agents that have been idle longer than idleTimeoutMs
- `evictIdleAgents()` does not remove active agents regardless of idle time
- `checkMemoryBudget()` returns withinBudget: true when pool is small
- `shouldCollapseScratchpad()` returns false when memory usage is below the warning threshold
- `shouldCollapseScratchpad()` returns true when estimated memory exceeds warningThresholdPct
- `prewarm()` adds agents to the pool with isActive = false
- `stats()` returns correct active, idle, evicted, and poolSize counts

### prompt-snapshots.test.ts (~10 tests)

Use a temporary directory for snapshot storage. Call `resetPromptSnapshotManager()` in `beforeEach`.

Cover:

- `captureSnapshot()` writes a JSON file to the snapshot directory
- `captureSnapshot()` creates the snapshot directory if it does not exist
- `loadSnapshot()` returns null when no snapshot exists for the agent/taskType
- `loadSnapshot()` returns the snapshot that was previously captured
- `detectPromptDrift()` returns `{ drifted: false }` when no baseline snapshot exists
- `detectPromptDrift()` returns `{ drifted: false }` when the prompt hash matches the baseline
- `detectPromptDrift()` returns `{ drifted: true }` with correct hashes when the prompt has changed
- `detectPromptDrift()` includes a non-empty diffSummary when drift is detected
- `updateSnapshot()` overwrites the existing snapshot with new content
- `listSnapshots()` returns all agent/taskType pairs for existing snapshot files

---

## File Structure to Create

```
src/
  recovery/
    graceful-recovery.ts              (KIMI-POLISH-01)
    graceful-recovery.test.ts         (KIMI-POLISH-06)
  performance/
    cache-manager.ts                  (KIMI-POLISH-02)
    agent-pool.ts                     (KIMI-POLISH-02)
    cache-manager.test.ts             (KIMI-POLISH-06)
    agent-pool.test.ts                (KIMI-POLISH-06)
  testing/
    prompt-snapshots.ts               (KIMI-POLISH-03)
    prompt-snapshots.test.ts          (KIMI-POLISH-06)
  taste-vault/
    property-tests.ts                 (KIMI-POLISH-04 + KIMI-POLISH-06)
  agent-loop/
    agent-loop.ts                     (KIMI-POLISH-01, small integration additions)
  llm/
    model-router.ts                   (KIMI-POLISH-02, wrap callLLM with cache check)
  orchestrator/
    ralph-loop.ts                     (KIMI-POLISH-01, checkpoint on success/failure + prewarm)
.github/
  workflows/
    ci.yml                            (KIMI-POLISH-05)
.nova/
  checkpoints/                        (created at runtime by GracefulRecovery)
  offline-queue.jsonl                 (created at runtime by GracefulRecovery)
  testing/
    snapshots/                        (created at runtime by PromptSnapshotManager)
```

---

## Verification Checklist

After all six tasks are complete, run:

```bash
# TypeScript: must be 0 errors
npx tsc --noEmit

# Tests: must be 1226 + 85+ new passing, 0 failing
npx vitest run

# Spot-check: checkpoint round-trip
node --input-type=module << 'EOF'
import { getGracefulRecovery } from './src/recovery/graceful-recovery.js';
const recovery = getGracefulRecovery();
await recovery.saveCheckpoint({
  buildId: 'build-001',
  taskId: 'task-001',
  agentName: 'MARS',
  phase: 'code-generation',
  checkpointedAt: new Date().toISOString(),
  turnNumber: 3,
  scratchpadSnapshot: '{"turns":[]}',
  completedToolCalls: [],
  filesWritten: [],
  tokensUsedSoFar: 1200,
  resumable: true,
});
const loaded = await recovery.loadCheckpoint('task-001');
console.log('Checkpoint round-trip OK:', loaded?.taskId === 'task-001', '| Turn:', loaded?.turnNumber);
const resumable = await recovery.listResumableCheckpoints();
console.log('Resumable checkpoints:', resumable.length);
await recovery.deleteCheckpoint('task-001');
EOF

# Spot-check: model fallback chain
node --input-type=module << 'EOF'
import { getGracefulRecovery } from './src/recovery/graceful-recovery.js';
const recovery = getGracefulRecovery();
const fallback = recovery.selectFallbackModel('qwen3-coder:32b', 'OOM error from Ollama');
console.log('Fallback from 32B:', fallback?.model, '| Tier:', fallback?.tier);
const endOfChain = recovery.selectFallbackModel('llama3.2:3b', 'OOM');
console.log('End of chain (should be null):', endOfChain);
console.log('Error message:', recovery.formatError('OLLAMA_OOM', { model: 'qwen3-coder:32b' }));
EOF

# Spot-check: cache manager
node --input-type=module << 'EOF'
import { getCacheManager } from './src/performance/cache-manager.js';
const cache = getCacheManager();
await cache.setLLMResponse('qwen3:7b', 'Write a hello world function', 'function hello() { return "hello"; }');
const hit = await cache.getLLMResponse('qwen3:7b', 'Write a hello world function');
console.log('LLM cache hit:', hit !== null);
const miss = await cache.getLLMResponse('qwen3:7b', 'Write a different function');
console.log('LLM cache miss (should be null):', miss === null);
const stats = cache.stats();
console.log('Cache stats:', JSON.stringify(stats));
EOF

# Spot-check: vault repair
node --input-type=module << 'EOF'
import { getGracefulRecovery } from './src/recovery/graceful-recovery.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
const recovery = getGracefulRecovery();
const testVault = {
  nodes: [
    { id: 'node-1', content: 'Always validate inputs' },
    { id: 'node-2', content: 'Use TypeScript strict mode' },
  ],
  edges: [
    { id: 'edge-1', source: 'node-1', target: 'node-2', relation: 'REINFORCES', confidence: 0.8 },
    { id: 'edge-2', source: 'node-1', target: 'node-MISSING', relation: 'SIMILAR_TO', confidence: 0.5 },
  ],
};
await mkdir('/tmp/nova26-test', { recursive: true });
const vaultPath = '/tmp/nova26-test/graph-memory.json';
await writeFile(vaultPath, JSON.stringify(testVault), 'utf8');
const report = await recovery.validateVault(vaultPath);
console.log('Vault repair report:', JSON.stringify(report, null, 2));
console.log('Orphan edges removed (should be 1):', report.orphanEdgesRemoved);
EOF

# Spot-check: agent pool
node --input-type=module << 'EOF'
import { getAgentPool } from './src/performance/agent-pool.js';
const pool = getAgentPool({ maxPoolSize: 3 });
pool.prewarm(['MARS', 'VENUS']);
const mars = pool.acquire('MARS');
console.log('Acquired MARS:', mars.agentName, '| Active:', mars.isActive);
pool.release('MARS');
const stats = pool.stats();
console.log('Pool stats:', JSON.stringify(stats));
EOF
```

---

## Commit Order

Commit after each task so main stays green:

1. `feat(polish): KIMI-POLISH-01 graceful recovery — checkpoints, model fallback, offline queue, vault repair`
2. `feat(polish): KIMI-POLISH-02 performance caching — LLM/embedding/repo-map cache, agent pool, memory budget`
3. `feat(polish): KIMI-POLISH-03 prompt snapshots — snapshot capture, drift detection, update workflow`
4. `feat(polish): KIMI-POLISH-04 property-based vault tests — 6 invariants, fast-check generators, 1000-op stress test`
5. `feat(polish): KIMI-POLISH-05 CI pipeline — GitHub Actions workflow with typecheck, tests, property, snapshot jobs`
6. `feat(polish): KIMI-POLISH-06 85+ tests for recovery, cache, agent pool, prompt snapshots, vault properties`

Each commit must pass `npx tsc --noEmit` and `npx vitest run` before being committed.

---

## Key Design Decisions (do not deviate without flagging)

1. **Checkpoints are per-task, not per-build.** Each task in a build has its own
   `.nova/checkpoints/{taskId}.json` file. This keeps checkpoint files small and makes
   partial resume (resuming one task without resuming the whole build) straightforward.
   The `buildId` field in the checkpoint is present for reference but not used for
   file routing.

2. **Model fallback chain is linear, not configurable per-task.** All tasks use the same
   fallback chain (32B → 14B → 7B → 3B). There is no per-task fallback configuration in
   this sprint. A future sprint can add task-type-specific fallback policies.

3. **The LLM response cache is intentionally skipped for rehearsal branch prompts.**
   Branch generation prompts contain `<rehearsal_context>` tags. These prompts are
   designed to explore different implementation approaches — caching them would defeat
   the purpose of the Rehearsal Stage. Check for this tag before caching.

4. **CacheManager and SemanticDedup maintain separate in-memory stores.** They are not
   unified in this sprint. The CacheManager provides TTL and size management; SemanticDedup
   has disk persistence. They are interoperable via compatible key formats. Unifying them
   is KIMI-POLISH future work.

5. **Property tests operate on plain graph data, not on TasteVault singletons.** The
   property tests import helper functions that manipulate raw `{ nodes, edges }` objects.
   This avoids I/O in the hot path of fast-check's generator loop (which runs 100+ iterations
   per test) and keeps the tests deterministic.

6. **Snapshot tests capture structural prompt content only, not dynamic vault context.**
   When rendering prompts for snapshots, always pass an empty vault context and empty
   playbook context. This ensures snapshots reflect intentional prompt structure changes,
   not incidental changes in the user's vault state.

7. **The offline queue is append-only during a build.** `enqueueConvexEvent()` only appends.
   `flushOfflineQueue()` rewrites the file with only the non-succeeded events. Never read
   and rewrite the file from `enqueueConvexEvent()` — that would create a write-after-read
   race condition if two agents enqueue simultaneously.

8. **AgentPool memory estimates are advisory, not precise.** The `estimatedMemoryMb` field
   is a rough approximation (8MB baseline per agent). It does not measure actual RSS or
   heap usage. Its purpose is to trigger scratchpad collapse before the process starts
   thrashing, not to provide accurate accounting. Precise memory profiling is future work.

9. **`validateVault()` never overwrites on invalid JSON.** If the vault file is unparseable,
   the method returns a report with `isHealthy: false` and does NOT touch the file. This
   preserves the user's raw data and ensures a human can recover it manually. The caller
   is responsible for deciding what to do (e.g., initialize a fresh vault, restore from
   backup). Only valid-JSON-but-structurally-inconsistent vaults are auto-repaired.

10. **CI jobs run in parallel, not sequentially.** The four GitHub Actions jobs
    (`typecheck`, `unit-integration`, `property-tests`, `snapshot-check`) have no
    `needs:` dependencies between them. All four start simultaneously on every push.
    Total CI time is bounded by the slowest job (property-tests at 10 minutes max),
    not by the sum of all four.
