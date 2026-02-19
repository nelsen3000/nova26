# GROK-R10: Nova26 Deep Implementation Polish Research Prompt

> Assigned to: Grok
> Round: R10 (post-R9)
> Date issued: 2026-02-18
> Status: Active

---

## Context Brief

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. The 21 agents
are named after celestial bodies (MARS, VENUS, MERCURY, JUPITER, SATURN, PLUTO, etc.) and
operate through a core execution engine called the Ralph Loop (`src/orchestrator/ralph-loop.ts`),
which drives a Generator -> Reflector -> Curator cycle (ACE) for iterative quality improvement.

**Current state of the build:**
- R1-R9 covered: tool use, inner loops, Taste Vault design, Global Wisdom Pipeline, Premium
  Buyer Experience, ACE specs, Rehearsal Stage specs, Self-Improvement Protocol, Real-Time
  Collaboration UX, Competitive Moat Analysis, Semantic Similarity Engine, Convex Real-Time
  Architecture, Launch Strategy/GTM, Security/Privacy Architecture, Ollama Model Strategy,
  Plugin Ecosystem, Team/Enterprise Features, CI/CD Integration, Advanced Analytics,
  Onboarding & Education System.
- Kimi has built: inner loop, Taste Vault + Global Wisdom, ACE + Rehearsal + Self-Improvement.
  Currently executing the infrastructure sprint: similarity engine, Convex real-time,
  security, model routing, analytics.
- 1116 tests passing, 0 TypeScript errors.
- Premium pricing: $299/month. Path A: Opt-In Global Wisdom Layer. Local-first with Ollama.
- Core architecture is well-specified and partially implemented. R10 pushes into the deep
  implementation details, edge cases, and polish that separates a good product from a great one.
  These are the areas that make Nova26 feel bulletproof, delightful, and worth the premium.

**Your style:** Open each deliverable with a big-picture analogy that makes the architecture
click instantly. Then go deep — TypeScript interfaces, method signatures, file structure, flow
diagrams in ASCII or prose. Every spec must be ready-to-implement or ready-to-research: a
developer or researcher should be able to pick it up without reading R1-R9.

---

## Deliverables

Label each section clearly: GROK-R10-01, GROK-R10-02, etc.

---

### GROK-R10-01: Error Recovery & Graceful Degradation Patterns

**The ask:** A $299/month product that loses work when Ollama crashes is not a product —
it is a liability. The most important invisible feature in any serious dev tool is what
happens when something goes wrong. This deliverable designs Nova26's complete error recovery
and graceful degradation architecture: checkpointing in-flight agent work, surviving model
OOMs, tolerating network loss, and repairing corrupt vault state — all while surfacing
errors to the user in a way that feels helpful rather than catastrophic.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. Error recovery in a multi-agent build pipeline
   is like what real-world resilience system? The key insight: a 21-agent build is not a single
   transaction — it is a long-running workflow with dozens of intermediate states, each of which
   can be checkpointed independently. The right analogy should capture both checkpoint/resume
   and graceful degradation (falling back to a less capable but still functional configuration).
   (Think: an airplane with redundant engines where losing one engine does not crash the plane;
   a database WAL that lets you replay from the last committed position; a surgeon who has a
   backup plan for every tool failure mid-operation.) Pick the one that makes the
   checkpoint-then-degrade architecture click.

2. **Checkpoint system.** Design the complete agent state checkpoint system:
   - What constitutes an agent's "checkpoint state"? Define precisely: what data must be
     saved to resume a task that was 60% complete when Ollama crashed.
     - Task metadata (id, description, agent assignment, phase)
     - Scratchpad contents (`src/agent-loop/scratchpad.ts`)
     - ACE cycle position (which cycle iteration? generator output already saved? reflection done?)
     - Partial file writes (what files were already written to disk?)
     - Tool call history (which tools fired, what they returned)
     - Token counts and cost so far (for `budgetLimit` enforcement on resume)
   - How frequently are checkpoints written? (After every ACE cycle completion? After every
     tool call? Configurable interval?)
   - Where are checkpoints stored? (`.nova/checkpoints/<buildId>/<taskId>.json`? SQLite via
     `better-sqlite3`? Both — hot checkpoints in SQLite, archive to JSON on completion?)
   - What is the checkpoint lifecycle? (Created on task start, updated on progress,
     deleted on successful completion, retained on failure for post-mortem)
   - What is the resume flow? How does the Ralph Loop detect an abandoned checkpoint on startup
     and offer to resume it?

   Provide the full TypeScript interfaces:

   ```typescript
   interface AgentCheckpoint {
     buildId: string;
     taskId: string;
     agentName: AgentName;
     phase: string;
     checkpointedAt: string;
     aceIteration: number;             // which ACE cycle (0-based)
     acePhase: 'pre-generate' | 'post-generate' | 'post-reflect' | 'post-curate';
     scratchpadSnapshot: string;       // serialized scratchpad state
     completedToolCalls: ToolCallRecord[];
     partialOutput?: string;           // generator output if generate completed
     partialReflection?: string;       // reflection output if reflect completed
     filesWritten: string[];           // absolute paths already written
     tokensUsedSoFar: number;
     costSoFar: number;
     resumable: boolean;               // false if state is too corrupt to resume
   }

   interface ToolCallRecord {
     toolName: string;
     args: Record<string, unknown>;
     result: string;
     calledAt: string;
   }

   interface CheckpointManager {
     save(checkpoint: AgentCheckpoint): Promise<void>;
     load(buildId: string, taskId: string): Promise<AgentCheckpoint | null>;
     listResumable(): Promise<AgentCheckpoint[]>;
     delete(buildId: string, taskId: string): Promise<void>;
     purgeOlderThan(days: number): Promise<number>;   // returns count deleted
   }
   ```

   Show the integration point in `src/orchestrator/ralph-loop.ts`: where in `processTask()`
   does the checkpoint get written and loaded? Provide pseudocode.

3. **Graceful degradation policy.** Design the model fallback chain:
   - Define the standard degradation ladder for Ollama model failures:
     - Attempt 1: assigned model (e.g., `deepseek-r1:32b`)
     - Attempt 2: mid-tier fallback (e.g., `deepseek-r1:14b`)
     - Attempt 3: base fallback (e.g., `deepseek-r1:7b` or `qwen2.5-coder:7b`)
     - Attempt 4: minimal fallback (e.g., `llama3.2:3b`) — degraded output quality, user warned
     - Attempt 5: fail gracefully with partial result and explanation
   - What triggers a degradation step? (OOM error from Ollama API? Timeout after N seconds?
     Explicit "model not found" error? HTTP 500?)
   - How does the user get notified when degradation occurs?
     ("MARS fell back to 14B — output quality may be reduced. [Run again with 32B]")
   - How is the degradation event recorded for analytics? (Feed into cost-tracker and heatmap)
   - What is the recovery check? After a fallback succeeds, does the next task in the build
     try the full model again, or stay on the fallback for the rest of the build?

   Provide the full TypeScript interfaces:

   ```typescript
   interface DegradationPolicy {
     modelChain: ModelFallback[];      // ordered from primary to last resort
     triggerConditions: DegradationTrigger[];
     notifyUser: boolean;
     recordInAnalytics: boolean;
     resetAfterBuild: boolean;         // if true, next build starts fresh at primary model
   }

   interface ModelFallback {
     model: string;                    // Ollama model name
     tier: 'primary' | 'mid' | 'base' | 'minimal';
     maxContextTokens: number;
     qualityWarning?: string;          // message shown to user when this tier is active
   }

   type DegradationTrigger =
     | { type: 'oom'; retryAfterMs?: number }
     | { type: 'timeout'; thresholdMs: number }
     | { type: 'model-not-found' }
     | { type: 'http-error'; statusCodes: number[] }
     | { type: 'repeated-failure'; consecutiveFailures: number };

   interface RecoveryStrategy {
     checkpointManager: CheckpointManager;
     degradationPolicy: DegradationPolicy;
     maxResumeAttempts: number;
     onDegradation(from: ModelFallback, to: ModelFallback, reason: string): void;
     onUnrecoverable(taskId: string, error: Error): void;
   }
   ```

4. **Network failure handling.** Design the Convex connectivity loss strategy:
   - What happens to a build in progress when Convex becomes unreachable?
     (Does the build pause? Continue locally without sync? Queue sync events for later?)
   - Design the offline queue: events that would normally sync to Convex are buffered locally
     and replayed when connectivity is restored. What is the event queue format?
   - How long can the offline queue grow before it becomes a problem?
     (Max queue size? Oldest-event-wins? Newest-event-wins for conflicting updates?)
   - What is the reconnect strategy? (Exponential backoff with jitter? Fixed interval? Both,
     switching to fixed after N attempts?)
   - How is connectivity loss surfaced to the user? (Status indicator in dashboard? Warning
     before starting a new build when offline?)

   Provide the TypeScript interface for the offline queue:

   ```typescript
   interface ConvexSyncEvent {
     id: string;
     mutationPath: string;             // e.g., 'atlas:logTask'
     args: Record<string, unknown>;
     enqueuedAt: string;
     attemptCount: number;
     lastAttemptAt?: string;
     status: 'pending' | 'retrying' | 'failed';
   }

   interface OfflineSyncQueue {
     enqueue(event: Omit<ConvexSyncEvent, 'id' | 'enqueuedAt' | 'attemptCount' | 'status'>): void;
     flush(): Promise<{ succeeded: number; failed: number }>;
     size(): number;
     clear(): void;
     onConnectivityRestored(handler: () => Promise<void>): void;
   }
   ```

5. **Corrupt vault recovery.** Design the `graph-memory.json` corruption detection and repair:
   - What constitutes a corrupt vault file? (Invalid JSON? Missing required fields? Broken
     graph edges pointing to non-existent nodes? Duplicate node IDs? Impossible timestamps?)
   - Define a vault integrity check: a function that reads the vault and returns a structured
     report of all detected anomalies, categorized by severity.
   - For each category of corruption, define the repair strategy:
     - Invalid JSON: attempt recovery from last-good backup; if none, initialize empty vault
     - Missing required fields: populate with safe defaults and log the repair
     - Broken graph edges: prune dangling edges, log which patterns were affected
     - Duplicate node IDs: keep the highest-quality-score copy, discard the duplicate
   - What is the backup rotation strategy? (Keep last 3 vault snapshots in `.nova/vault-backups/`)
   - When is an integrity check run? (On every Nova26 startup? Before every build? On demand?)

   Provide the TypeScript interfaces:

   ```typescript
   interface VaultIntegrityReport {
     vaultPath: string;
     checkedAt: string;
     isHealthy: boolean;
     anomalies: VaultAnomaly[];
     repairableCount: number;
     unrepairableCount: number;
   }

   interface VaultAnomaly {
     type: 'invalid-json' | 'missing-field' | 'broken-edge' | 'duplicate-id'
         | 'impossible-timestamp' | 'orphaned-node' | 'cycle-detected';
     severity: 'warning' | 'error' | 'critical';
     nodeId?: string;
     description: string;
     autoRepaired: boolean;
     repairAction?: string;
   }

   interface VaultRecoveryManager {
     check(vaultPath: string): Promise<VaultIntegrityReport>;
     repair(vaultPath: string, report: VaultIntegrityReport): Promise<void>;
     backup(vaultPath: string): Promise<string>;     // returns backup file path
     restore(backupPath: string): Promise<void>;
     listBackups(): Promise<string[]>;
   }
   ```

6. **User-facing error messages.** Design the error communication system:
   - Define the error taxonomy for Nova26: which categories of errors exist, and what is
     the correct user-facing message and action for each?
     - Model errors (OOM, timeout, model not found)
     - Network errors (Convex unreachable, Ollama API down)
     - Vault errors (corrupt, missing, permission denied)
     - Build errors (task failed, dependency cycle, budget exceeded)
     - Configuration errors (invalid settings, missing API key)
   - What is the structure of a Nova26 error message? Design the format:
     - One-line summary in plain English (no stack traces)
     - What happened (brief, non-technical)
     - Why it happened (root cause, if determinable)
     - What to do now (concrete, actionable next step)
     - Where to get more help (link to docs or Academy module)
   - How are technical error details preserved for debugging without cluttering the UX?
     (Write full stack trace to `.nova/logs/errors.log`; surface a "Show technical details"
     toggle in the UI)

   Provide the TypeScript interface:

   ```typescript
   interface Nova26Error {
     code: string;                     // e.g., 'OLLAMA_OOM', 'VAULT_CORRUPT', 'CONVEX_UNREACHABLE'
     category: 'model' | 'network' | 'vault' | 'build' | 'config';
     severity: 'warning' | 'error' | 'fatal';
     userMessage: string;              // plain English one-liner
     whatHappened: string;             // brief explanation
     whyItHappened?: string;           // root cause if known
     whatToDoNow: string;              // concrete next step
     helpLink?: string;                // docs or Academy link
     technicalDetails?: string;        // stack trace / raw error (hidden by default)
     recoverable: boolean;
     checkpointAvailable?: boolean;    // can the user resume?
   }

   interface ErrorMessageFactory {
     fromOllamaError(raw: Error, model: string): Nova26Error;
     fromConvexError(raw: Error, mutation: string): Nova26Error;
     fromVaultError(raw: Error, vaultPath: string): Nova26Error;
     fromBuildError(raw: Error, taskId: string): Nova26Error;
     format(error: Nova26Error): string;   // terminal-friendly formatted string
   }
   ```

7. **File structure.** Specify:
   - `src/recovery/checkpoint-manager.ts` — `CheckpointManager` implementation with SQLite backing
   - `src/recovery/degradation-policy.ts` — `DegradationPolicy` defaults and `RecoveryStrategy`
   - `src/recovery/offline-queue.ts` — `OfflineSyncQueue` implementation
   - `src/recovery/vault-recovery.ts` — `VaultRecoveryManager` implementation
   - `src/recovery/error-factory.ts` — `ErrorMessageFactory` and `Nova26Error` type definitions
   - `src/recovery/index.ts` — unified export and `RecoveryCoordinator` that wires everything together

8. **Integration with ralph-loop.ts.** Show the specific additions to `RalphLoopOptions`
   and `processTask()` that enable checkpointing and degradation. Where exactly does the
   `RecoveryCoordinator` get initialized? How does `processTask()` call into it before and
   after each ACE cycle? Provide pseudocode for the full wrapped `processTask()` with recovery.

9. **Open questions for the build team.** List 3-5 questions that must be answered before
   implementation begins.

---

### GROK-R10-02: Performance Optimization & Caching Strategy

**The ask:** A tool that runs on consumer hardware cannot apologize for being slow. Nova26's
21-agent parallel build must feel fast on an M1 MacBook with 16GB of unified memory — not
just "fast for an AI tool," but genuinely snappy in a way that makes users feel powerful.
This deliverable designs Nova26's complete performance architecture: agent pooling, memory
management, intelligent caching, startup optimization, and the build pipeline parallelism
model. The goal is a concrete benchmark target: first task result in under 30 seconds on M1.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. Optimizing a 21-agent parallel build on
   consumer hardware is like optimizing what real-world system that must do many things at
   once under tight resource constraints? The key insight is that not all agents need to be
   alive at the same time — the system must schedule, pool, and evict intelligently, the same
   way operating system schedulers manage processes or database buffer pools manage pages.
   Pick the analogy (OS scheduler, browser rendering pipeline, database buffer pool, HTTP
   connection pool) that makes the pool-and-evict architecture click.

2. **Memory model for 21 agents.** Design the complete memory budget:
   - What is the baseline memory cost of one idle agent? (Estimate: scratchpad in RAM,
     session memory object, prompt template loaded — roughly how many MB?)
   - What is the memory cost of one active agent running a 32B model? (Ollama loads models
     into GPU/unified memory separately — what is Nova26's own RAM overhead per running agent?)
   - Given 16GB unified memory and Ollama's model requirements (32B model ≈ 18-20GB, 14B ≈ 8-9GB,
     7B ≈ 4-5GB), how many agents can realistically run in parallel on 16GB hardware?
   - Design the tiered concurrency limits:
     - 8GB RAM: max 2 agents in parallel, force 7B model
     - 16GB RAM: max 3 agents in parallel, allow up to 14B model
     - 32GB+ RAM: max 6 agents in parallel, allow 32B model
   - How does the system detect available memory at runtime?
     (Node.js `os.freemem()` and `os.totalmem()`? Query Ollama's model info endpoint?)

   Provide the TypeScript interface:

   ```typescript
   interface SystemMemoryProfile {
     totalRamGb: number;
     availableRamGb: number;
     unifiedMemory: boolean;         // true on Apple Silicon
     recommendedConcurrency: number;
     recommendedMaxModel: string;    // e.g., 'deepseek-r1:14b'
     warningThresholdGb: number;     // alert if available RAM drops below this
   }

   interface AgentPoolConfig {
     maxConcurrentAgents: number;
     scratchpadEvictionPolicy: 'lru' | 'lfu' | 'size-based';
     maxScratchpadSizeKb: number;
     idleTimeoutMs: number;          // evict idle agents after this
     warmAgents: AgentName[];        // pre-warm these agents at startup
   }

   interface AgentPool {
     acquire(agentName: AgentName): Promise<AgentHandle>;
     release(handle: AgentHandle): void;
     evict(agentName: AgentName): void;
     stats(): AgentPoolStats;
   }

   interface AgentPoolStats {
     active: number;
     idle: number;
     evicted: number;
     averageWaitMs: number;
     peakConcurrency: number;
   }
   ```

3. **Caching architecture.** Design the three-tier cache:

   **Tier 1: LLM response cache** (identical prompt → cached response)
   - Under what conditions is an LLM response cacheable? (Exact prompt match? Semantic
     near-match above a threshold? Never for generation tasks, always for classification tasks?)
   - What is the cache key? (SHA-256 hash of: model name + system prompt + user prompt)
   - What is the cache storage? (SQLite table with LRU eviction? In-memory Map with TTL?)
   - What is the TTL? (24 hours? Until the prompt template version changes? User-configurable?)
   - How large can the cache grow? (Max N entries? Max total size in MB?)
   - When should the cache be bypassed? (Autonomy level 5 builds where novelty is the goal?)

   **Tier 2: Embedding cache** (text → vector)
   - Embedding generation is expensive. Every Taste Vault lookup and semantic search
     re-embeds query text. Design the embedding cache.
   - Cache key: SHA-256 of (text + model name used for embedding)
   - Storage: SQLite (reuses `better-sqlite3` dependency)
   - Max size: configurable, default 10,000 embeddings
   - Eviction: LRU

   **Tier 3: Repo map cache** (filesystem scan results)
   - What is a repo map? (Directory tree + file type classification + dependency graph snapshot)
   - When is it stale? (File watcher detects changes? Invalidate on every build? TTL-based?)
   - How is the repo map stored? (JSON file at `.nova/repo-map.json`? In-memory only?)

   Provide the unified cache interface:

   ```typescript
   interface CacheManager {
     llm: LLMResponseCache;
     embeddings: EmbeddingCache;
     repoMap: RepoMapCache;
     stats(): CacheStats;
     clearAll(): Promise<void>;
   }

   interface LLMResponseCache {
     get(key: string): Promise<string | null>;
     set(key: string, value: string, ttlMs?: number): Promise<void>;
     invalidateByPromptVersion(version: string): Promise<number>;
     size(): number;
   }

   interface EmbeddingCache {
     get(text: string, model: string): Promise<number[] | null>;
     set(text: string, model: string, embedding: number[]): Promise<void>;
     size(): number;
     evictLRU(targetSize: number): Promise<number>;
   }

   interface RepoMapCache {
     get(repoPath: string): Promise<RepoMap | null>;
     set(repoPath: string, map: RepoMap): Promise<void>;
     invalidate(repoPath: string): Promise<void>;
     startWatcher(repoPath: string): void;
     stopWatcher(repoPath: string): void;
   }

   interface CacheStats {
     llmHits: number;
     llmMisses: number;
     llmHitRate: number;
     embeddingHits: number;
     embeddingMisses: number;
     repoMapHits: number;
     totalSizeBytes: number;
   }
   ```

4. **Startup time optimization.** Design the fast startup strategy:
   - What is Nova26's current cold start path? (Enumerate every operation that happens
     before the first task can execute: config load, vault load, agent initialization,
     Ollama connectivity check, Convex connection establishment, etc.)
   - Which of these can be parallelized? (Vault load + Ollama check + Convex connection
     can all start simultaneously)
   - Which can be lazy-loaded? (Agents not needed for the first task do not need to
     initialize on startup)
   - What is "pre-warming"? Design the pre-warm heuristic: given the user's build history,
     predict which 2-3 agents will be needed first and initialize them while the user
     is reviewing the generated plan.
   - Benchmark target: time from `nova26 run` to "first task executing" under 5 seconds
     on cold start, under 2 seconds on warm start (model already loaded in Ollama).

   Provide the TypeScript interface:

   ```typescript
   interface StartupProfile {
     coldStartMs: number;
     warmStartMs: number;
     lazyAgents: AgentName[];
     prewarmAgents: AgentName[];
     parallelInitTasks: string[];
   }

   interface StartupOptimizer {
     measure(): Promise<StartupProfile>;
     prewarm(agentNames: AgentName[]): Promise<void>;
     predictFirstAgents(buildHistory: BuildSummary[]): AgentName[];
   }
   ```

5. **Build pipeline parallelism.** Design the dependency-aware parallel scheduler:
   - Nova26 currently has a `parallelMode` flag in `RalphLoopOptions`. This spec makes
     it smart. Define which agents can run in parallel vs which have sequential dependencies:
     - Independent (always parallelizable): MARS, VENUS, MERCURY in separate file domains
     - Sequential dependencies: PLUTO (tests) must follow MARS (code generation);
       SATURN (review) must follow JUPITER (architecture); SUN (integration) must follow all
     - Conditionally parallel: depends on whether tasks share file paths (detect write conflicts)
   - How does the scheduler detect file-level write conflicts between parallel tasks?
     (Each task declares its target files before execution; scheduler checks for overlap)
   - What is the scheduling algorithm? (Topological sort of the dependency DAG + greedy
     parallel execution of all nodes with no pending dependencies)
   - What is the maximum theoretical speedup over sequential execution for a typical build?
     (Amdahl's Law analysis — what fraction of tasks are truly parallelizable?)

   Provide the TypeScript interface:

   ```typescript
   interface BuildPipeline {
     schedule(tasks: Task[]): ExecutionPlan;
     execute(plan: ExecutionPlan, pool: AgentPool): AsyncGenerator<TaskResult>;
     detectConflicts(tasks: Task[]): ConflictReport;
   }

   interface ExecutionPlan {
     stages: ExecutionStage[];    // stages execute sequentially; tasks within a stage run in parallel
     criticalPath: string[];      // task IDs on the critical path (longest sequential chain)
     estimatedDuration: number;   // ms estimate based on historical data
     parallelismFactor: number;   // 1.0 = fully sequential, N = N-way parallel
   }

   interface ExecutionStage {
     stageIndex: number;
     tasks: Task[];               // these tasks run in parallel within the stage
     estimatedDuration: number;
   }

   interface ConflictReport {
     hasConflicts: boolean;
     conflicts: FileConflict[];
   }

   interface FileConflict {
     file: string;
     tasks: string[];             // task IDs that both write to this file
     resolution: 'sequential' | 'merge' | 'error';
   }
   ```

6. **Benchmark targets and measurement.** Define the concrete performance contract:
   - First task result: under 30 seconds on M1 MacBook (16GB, model already loaded in Ollama)
   - Full simple build (3-5 tasks): under 3 minutes
   - Full complex build (10+ tasks): under 10 minutes
   - LLM cache hit response: under 100ms
   - Vault pattern lookup (semantic search, top-5): under 500ms
   - Cold start to first task executing: under 5 seconds
   - How are these benchmarks measured? Design a `BenchmarkSuite` that runs in CI and
     flags regressions when any target is missed by more than 20%.

7. **File structure.** Specify:
   - `src/performance/agent-pool.ts` — `AgentPool` implementation
   - `src/performance/cache-manager.ts` — `CacheManager` with all three tiers
   - `src/performance/build-pipeline.ts` — `BuildPipeline` scheduler
   - `src/performance/startup-optimizer.ts` — `StartupOptimizer` and pre-warm logic
   - `src/performance/memory-profiler.ts` — `SystemMemoryProfile` detection
   - `src/performance/benchmarks.ts` — `BenchmarkSuite` for CI regression detection
   - `src/performance/index.ts` — unified export and `PerformanceCoordinator`

8. **Integration with ralph-loop.ts.** Show the specific additions to `RalphLoopOptions`
   and `processTask()` that enable the agent pool, cache, and pipeline scheduler. How does
   the `CacheManager` intercept Ollama calls in `src/llm/`? Provide pseudocode for the
   cache-aware LLM call wrapper.

9. **Open questions for the build team.** List 3-5 questions.

---

### GROK-R10-03: Testing Strategy at Scale

**The ask:** Nova26 has 1116 tests passing today. As the product grows to cover all the specs
from R1-R10, the test suite will need to scale to cover 21 interacting agents, a living Taste
Vault, a semantic similarity engine, real-time Convex sync, and a build pipeline with
checkpoint/resume logic. A test suite that does not grow with the product becomes a liability —
false confidence, slow CI, and flaky tests that developers learn to ignore. This deliverable
designs the complete testing strategy at scale: what to test, how to test it, and how to keep
the suite reliable, fast, and trustworthy.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. Testing a 21-agent AI build system reliably is
   like testing what other complex distributed system? The core challenge is that LLMs are
   non-deterministic, agent interactions are emergent, and the Taste Vault's state changes
   with every build. The right analogy should capture the strategy of "test the contracts,
   mock the non-determinism" — the same way you test a microservices system by mocking external
   services and testing service contracts rather than end-to-end flows in unit tests.

2. **Test pyramid for Nova26.** Design the complete test pyramid:
   - Unit tests (fastest, most numerous): test individual functions, TypeScript interfaces,
     pure logic — no Ollama, no Convex, no filesystem. What belongs here?
   - Integration tests (medium speed): test agent loop logic with mocked Ollama, real SQLite,
     real filesystem in a temp directory. What belongs here?
   - Contract tests (medium speed): snapshot-test agent prompts to detect unintended changes.
     What belongs here?
   - Property-based tests (medium speed): test Taste Vault graph invariants with generated data.
     What belongs here?
   - End-to-end tests (slowest, fewest): test full build pipeline with real Ollama (small model
     only in CI). What belongs here?
   - Load tests (separate pipeline): simulate 100+ concurrent builds to find race conditions.
     What belongs here and when do they run?

   Define the target breakdown: "At 1,000 total tests, the breakdown should be roughly X% unit,
   Y% integration, Z% contract, W% property-based, V% e2e." Justify the ratios.

3. **Snapshot testing for agent prompts.** Design the prompt snapshot system:
   - Agent prompts in `src/orchestrator/prompt-builder.ts` are critical — an unintended change
     to a system prompt can silently degrade output quality across all builds. Snapshot tests
     catch these changes.
   - How does a prompt snapshot test work? (Render the prompt with a fixed set of inputs,
     save the output as a `.snap` file, fail the test if it changes without an explicit update)
   - What inputs are used to render prompts for snapshot testing? (Synthetic `Task` objects
     covering the main task categories: code generation, testing, architecture, review)
   - How are snapshot updates approved? (`npm run test:update-snapshots` command? PR review
     requirement?)
   - What is the snapshot file format and storage location?
     (`src/orchestrator/__snapshots__/prompt-builder.test.ts.snap`)
   - How many prompt snapshots are needed for adequate coverage? (One per agent? One per
     agent per task category? Define the minimum meaningful set.)

   Provide the test structure:

   ```typescript
   // Example snapshot test structure
   describe('PromptBuilder snapshots', () => {
     const fixtures = loadPromptFixtures();  // synthetic Task objects

     for (const agentName of ALL_AGENT_NAMES) {
       for (const fixture of fixtures) {
         it(`${agentName} prompt for ${fixture.category} task matches snapshot`, () => {
           const prompt = promptBuilder.build(agentName, fixture.task, fixture.context);
           expect(prompt).toMatchSnapshot();
         });
       }
     }
   });
   ```

4. **Property-based testing for the Taste Vault.** Design the invariant test suite:
   - Define 5-7 invariants that must always hold in a healthy Taste Vault:
     - No node may have a quality score outside [0, 1]
     - No edge may reference a non-existent node ID
     - The graph must be acyclic (no feedback loops in the preference hierarchy)
     - Every pattern must have at least one `usageCount >= 0`
     - Node IDs must be globally unique
     - Pattern text must be non-empty and under 10,000 characters
     - The `createdAt` timestamp must be in the past
   - Which property-based testing library fits Nova26's TypeScript stack?
     (Evaluate `fast-check` — it is the standard for TypeScript PBT. Recommend it with reasons.)
   - How are arbitrary vault graphs generated for testing? (Define generators for `VaultNode`,
     `VaultEdge`, and full `VaultGraph` using `fast-check`'s `fc.record()` and `fc.array()`)
   - How are invariant violations reported? (Property-based tests should print the minimal
     failing example that violates the invariant)

   Provide example property test structure:

   ```typescript
   import * as fc from 'fast-check';

   const arbitraryVaultNode = fc.record({
     id: fc.uuid(),
     text: fc.string({ minLength: 1, maxLength: 9999 }),
     qualityScore: fc.float({ min: 0, max: 1 }),
     usageCount: fc.nat(),
     createdAt: fc.date({ max: new Date() }).map(d => d.toISOString()),
   });

   describe('Vault invariants', () => {
     it('quality scores are always in [0, 1]', () => {
       fc.assert(fc.property(arbitraryVaultNode, (node) => {
         return node.qualityScore >= 0 && node.qualityScore <= 1;
       }));
     });
     // ... define all 5-7 invariants
   });
   ```

5. **Mocking strategy.** Design the mock hierarchy:
   - Ollama mock: when to use it vs when to use a real (small) model.
     - Unit tests: always mock — return canned responses from fixtures
     - Integration tests: mock by default; use `--real-ollama` flag to test with actual model
     - E2E tests in CI: use `llama3.2:3b` (smallest available model) — never 32B in CI
     - E2E tests locally: use whatever model the developer has loaded
   - Convex mock: how to test Convex mutations and queries without a live Convex deployment.
     (In-memory Convex test framework? Mock the HTTP client? Use Convex's official test
     utilities if they exist?)
   - Filesystem mock: use `memfs` for tests that involve file writes, avoiding temp directory
     cleanup issues.
   - Design the mock factory: a central `TestMockFactory` that creates consistent mocks
     across the entire test suite.

   Provide the interface:

   ```typescript
   interface TestMockFactory {
     createOllamaMock(responses?: OllamaMockConfig): OllamaClientMock;
     createConvexMock(initialState?: ConvexMockState): ConvexClientMock;
     createVaultMock(patterns?: VaultPattern[]): TasteVaultClientMock;
     createFilesystemMock(initialFiles?: Record<string, string>): MemFsInstance;
     createCheckpointManagerMock(): CheckpointManagerMock;
   }

   interface OllamaMockConfig {
     responses: Record<string, string>;   // prompt hash → response
     defaultResponse?: string;
     latencyMs?: number;
     failAfterN?: number;                 // simulate failure after N calls
   }
   ```

6. **Load testing for race conditions.** Design the concurrent build simulation:
   - What race conditions are plausible in Nova26's architecture?
     - Two agents writing to the same file simultaneously
     - Checkpoint write and checkpoint read racing
     - Vault update and vault query racing on the same node
     - Convex sync queue processing while new events are being enqueued
     - Agent pool acquisition with maxConcurrentAgents = 3 and 10 tasks queued
   - How is the load test structured? (100 simulated build requests fired concurrently
     against the Ralph Loop with mocked Ollama)
   - What assertions catch race conditions? (Final file state is deterministic? No
     checkpoint files are left orphaned? Vault remains internally consistent after load?)
   - Which load testing tool fits the Node.js/TypeScript stack? (Artillery? k6? Custom
     `Promise.all` harness? Recommend with rationale.)

7. **Flaky test detection and quarantine.** Design the flakiness management system:
   - Define what makes a Nova26 test flaky: timing-dependent tests (agent pool eviction by
     `idleTimeoutMs`), tests that depend on Ollama response ordering, tests that use
     `Date.now()` without mocking.
   - Design the flakiness detector: run each test 5 times in isolation; if it fails on
     any run, flag it as potentially flaky.
   - Design the quarantine system: flaky tests are moved to a `__flaky__` directory and
     excluded from the main CI gate. They run in a separate CI job that does not block merges.
   - What is the remediation SLA? (Quarantined tests must be fixed or deleted within 2 sprints)

8. **Recommended CI configuration.** Provide the complete GitHub Actions workflow for the
   full test suite:
   - Define 4 CI jobs that run in parallel:
     - `unit-integration`: fast tests with mocks only (target: under 2 minutes)
     - `contract`: snapshot tests for all agent prompts (target: under 1 minute)
     - `property`: `fast-check` invariant tests (target: under 3 minutes)
     - `e2e`: full pipeline with `llama3.2:3b` (target: under 15 minutes, runs only on main branch push)
   - Define when the load tests run: nightly, not on every PR
   - Show the complete `.github/workflows/nova26-tests.yml` YAML

9. **Open questions for the build team.** List 3-5 questions.

---

### GROK-R10-04: Accessibility & Internationalization

**The ask:** A premium product at $299/month that only works well for English-speaking, fully
sighted developers on a high-contrast display is leaving money on the table and failing its
users. Accessibility and internationalization are not nice-to-haves — they are the difference
between a tool that a senior blind engineer can use at their job and one they cannot. This
deliverable designs Nova26's complete A11y and i18n architecture, covering the CLI, the
dashboard, the Taste Vault's handling of non-ASCII text, and the question of whether agent
prompts should ever be multilingual.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. Building accessibility and i18n into a product
   that was designed English-first and sighted-first is like retrofitting what into a building
   that was designed without thinking about it? The key insight is that it is far cheaper to
   design for it from the start than to retrofit — but Nova26 is at the point where the
   foundation is laid and retrofitting is the reality. The right analogy should capture the
   "systematic audit + incremental improvement" approach rather than a full rewrite.

2. **CLI accessibility.** Design the accessible terminal interface:
   - Screen reader support: what does a screen reader-friendly CLI output look like?
     - Progress bars that rely on ANSI cursor movement are not screen-reader-friendly.
       Design a `--screen-reader` mode that outputs plain text progress updates instead:
       "Task 3 of 8 started: MARS generating authentication module."
     - How is `--screen-reader` mode detected? (Explicit flag? `NOVA26_SCREEN_READER=1`
       env var? Check for `$TERM_PROGRAM == 'iTerm.app'` and screen reader detection heuristics?)
   - High contrast mode: what does a `--no-color` / high contrast terminal experience look like?
     - Define which UI elements use color and what their accessible alternatives are
     - How does Nova26 respect the `NO_COLOR` environment variable convention?
     - How does Nova26 respect the system-level `prefers-color-scheme: dark`?
   - Keyboard navigation for interactive prompts (plan approval, autonomy level selection):
     - What interactive prompts does Nova26 currently have? (The plan approval step in the
       Ralph Loop, the autonomy level selector, error recovery choices)
     - Are these built with `inquirer.js` or similar? If so, it already has keyboard support.
       What is missing?
   - What is the minimum WCAG 2.1 level that applies to a CLI? (WCAG 2.1 is for web UIs, but
     the principles of perceivable, operable, understandable, robust apply. Define Nova26's
     CLI accessibility baseline in these terms.)

   Provide the TypeScript interface:

   ```typescript
   interface CLIAccessibilityConfig {
     screenReaderMode: boolean;
     noColor: boolean;
     highContrast: boolean;
     verboseProgress: boolean;       // replaces animations with plain text updates
     reducedMotion: boolean;         // no spinners, no animations
   }

   interface AccessibleProgressReporter {
     start(taskName: string, total: number): void;
     update(current: number, detail?: string): void;
     complete(taskName: string): void;
     error(taskName: string, message: string): void;
   }
   ```

3. **Dashboard accessibility (WCAG 2.1 AA).** Design the web dashboard accessibility
   compliance checklist:
   - Provide a complete WCAG 2.1 AA checklist specific to Nova26's dashboard components:
     - 1.1.1 Non-text content: do agent activity icons have alt text?
     - 1.3.1 Info and relationships: is the build pipeline status conveyed structurally,
       not just via color?
     - 1.4.3 Contrast minimum: are all text elements meeting the 4.5:1 contrast ratio?
     - 2.1.1 Keyboard: can every dashboard action be performed without a mouse?
     - 2.4.3 Focus order: does focus move logically through the dashboard layout?
     - 3.3.1 Error identification: are all form errors described in text, not just highlighted?
     - 4.1.2 Name, Role, Value: do all custom components have proper ARIA roles?
   - What automated tools check WCAG compliance in CI? (axe-core, Lighthouse CI, Pa11y —
     recommend one with rationale and provide the CI integration snippet)
   - What manual testing is required that automated tools cannot catch?
     (Screen reader testing with VoiceOver/NVDA, keyboard-only navigation audit)

4. **Internationalization architecture.** Design the i18n system:
   - What strings in Nova26 need to be translatable?
     - User-facing error messages (`ErrorMessageFactory` output)
     - CLI progress messages and prompts
     - Dashboard UI strings
     - Tutorial and Academy content
     - Webhook and email notification templates
     - NOT: agent prompts (see section 6)
   - What i18n library fits the TypeScript stack? (Evaluate `i18next` for the dashboard and
     CLI — it supports TypeScript, React, and Node.js. Recommend with rationale.)
   - What is the string extraction workflow? (How do developers add new translatable strings?
     Mark with `t('key')`, run `npm run i18n:extract` to update the base locale file,
     submit to translators via Crowdin or Lokalise?)
   - What locales are supported in v1.0? (en-US as primary; recommend 3-5 additional locales
     for the first release based on developer tool adoption data: zh-CN, ja, de, fr, pt-BR)
   - What is the fallback chain? (Missing translation → en-US string → raw key)

   Provide the TypeScript interface:

   ```typescript
   interface I18nConfig {
     defaultLocale: string;          // 'en-US'
     supportedLocales: string[];
     fallbackLocale: string;         // 'en-US'
     loadPath: string;               // path to locale files, e.g., './locales/{{lng}}/{{ns}}.json'
     namespaces: I18nNamespace[];
   }

   type I18nNamespace =
     | 'cli'         // CLI messages and prompts
     | 'errors'      // error messages
     | 'dashboard'   // web UI strings
     | 'tutorials'   // Academy and tutorial content
     | 'emails';     // notification templates

   interface TranslationKey {
     key: string;
     namespace: I18nNamespace;
     defaultValue: string;           // en-US fallback
     interpolations?: string[];      // variable names used in the string, e.g., ['agentName', 'count']
   }
   ```

5. **Unicode handling in the Taste Vault.** Design the Unicode robustness layer:
   - What Unicode edge cases can appear in vault pattern text?
     - CJK characters (Chinese, Japanese, Korean): full-width characters, surrogate pairs
     - RTL scripts (Arabic, Hebrew): bidirectional text that can break terminal rendering
     - Emoji: multi-codepoint emoji (ZWJ sequences, skin tone modifiers) in code comments
     - Null bytes and control characters: can corrupt JSON if not sanitized
     - Normalization forms: NFC vs NFD can cause duplicate entries for the same text
   - Design the vault text sanitization pipeline: what transformations are applied to
     pattern text before it is stored?
     1. Unicode normalization to NFC
     2. Control character removal (except common whitespace)
     3. Null byte removal
     4. Length enforcement (max 10,000 characters after normalization)
     5. Bidirectional text marker stripping for terminal display safety
   - How are CJK patterns handled in semantic search? (Does the embedding model handle
     CJK well? Which Ollama-available embedding models support multilingual text?)
   - How is vault pattern text rendered safely in the terminal?
     (Strip ANSI escape sequences embedded in text? Truncate at display width?)

   Provide the TypeScript interface:

   ```typescript
   interface VaultTextSanitizer {
     sanitize(raw: string): SanitizedText;
     isSafe(text: string): boolean;
     detectScript(text: string): TextScript;
   }

   interface SanitizedText {
     value: string;
     originalLength: number;
     wasModified: boolean;
     modifications: TextModification[];
   }

   type TextScript = 'latin' | 'cjk' | 'rtl' | 'mixed' | 'unknown';

   interface TextModification {
     type: 'normalize' | 'strip-control' | 'strip-null' | 'truncate' | 'strip-bidi';
     description: string;
   }
   ```

6. **Agent prompts in multiple languages.** Answer the core question definitively:
   - Should Nova26's 21 agent system prompts ever be translated to non-English languages?
   - Make the case for each position:
     - Position A (English-only prompts): LLMs trained predominantly on English code and
       English technical content perform better with English prompts even for non-English
       users. The output code and comments can still be in any language.
     - Position B (translated prompts): users who think and work in their native language
       benefit from prompts that match their cognitive frame; some Ollama-hosted models
       are specifically trained for non-English languages.
   - Recommend one position and justify it with evidence from current LLM research.
   - If Position A is recommended: how does Nova26 support non-English codebases and
     code comments without translating the prompts? (The agent understands non-English
     comments even with English prompts; the Taste Vault stores patterns in the user's
     language regardless of prompt language)
   - If Position B is recommended: what is the translation architecture for prompts?
     (Separate locale-specific prompt files? Dynamic prompt interpolation?)

7. **Error messages and UI strings: i18n extraction strategy.** Design the extraction workflow:
   - Show the complete workflow from "developer adds a new error message" to "translator
     receives it and the translation ships":
     1. Developer adds `t('errors.vault.corrupt', { vaultPath })` in code
     2. `npm run i18n:extract` scans source and updates `locales/en-US/errors.json`
     3. CI fails if extracted keys differ from committed locale file (prevents string drift)
     4. Crowdin/Lokalise picks up the new key for translation
     5. Translated strings are committed back to `locales/{lng}/errors.json`
     6. `I18nConfig.loadPath` serves the correct file at runtime
   - What is the CI check? (Run `npm run i18n:extract --dry-run`; fail if output differs
     from committed file)
   - How are plurals handled? (English "1 pattern" vs "5 patterns" — `i18next` plural rules)
   - How are interpolated variables handled? (Ensure translator cannot accidentally remove
     `{{vaultPath}}` from a string)

8. **File structure.** Specify:
   - `src/a11y/cli-accessibility.ts` — `CLIAccessibilityConfig` and `AccessibleProgressReporter`
   - `src/a11y/vault-text-sanitizer.ts` — `VaultTextSanitizer` implementation
   - `src/i18n/config.ts` — `I18nConfig` and initialization
   - `src/i18n/extract.ts` — string extraction script (runs via `npm run i18n:extract`)
   - `locales/en-US/cli.json` — CLI strings
   - `locales/en-US/errors.json` — error message strings
   - `locales/en-US/dashboard.json` — dashboard UI strings
   - `locales/en-US/tutorials.json` — tutorial and Academy content
   - `.github/workflows/i18n-check.yml` — CI job that checks for string drift

9. **Open questions for the build team.** List 3-5 questions.

---

### GROK-R10-05: Long-Term Architecture & Technical Debt Prevention

**The ask:** Nova26 today is a tightly coupled, rapidly moving codebase. That is correct for
a pre-launch product. But the architectural decisions made in the next six months will determine
whether Nova26 at 100,000 lines of TypeScript is a coherent system or a tangled mess that
requires a rewrite. This deliverable answers the hardest long-term questions: where are the
module boundaries, how do breaking changes ship without losing users, how does the migration
system evolve vault and config formats over years of use, and what does production monitoring
look like for a tool that runs entirely on the user's hardware?

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. Managing technical debt and architecture
   evolution in a local-first AI tool is like managing what other long-lived technical
   system where the data format and the code both evolve, compatibility must be preserved,
   and the "production environment" is thousands of different machines that the developer
   does not control? (Think: SQLite's extraordinary backward compatibility story; VS Code's
   extension API stability guarantees; npm's package resolution rules that must work across
   a decade of packages.) Pick the analogy that captures the "you cannot break users' local
   data" constraint that makes Nova26's versioning harder than a cloud service.

2. **Module boundary design at scale.** Design the long-term module structure:
   - At 50,000 lines of TypeScript, which current directories should be separate npm packages
     in a monorepo? Define the proposed package split:
     - `@nova26/core` — `src/types/`, `src/orchestrator/`, core interfaces
     - `@nova26/agents` — all 21 agent implementations and `.nova/agents/` templates
     - `@nova26/vault` — Taste Vault, Global Wisdom Pipeline, vault recovery (Kimi's output)
     - `@nova26/llm` — `src/llm/`, Ollama client, embedding engine
     - `@nova26/recovery` — checkpoint system, degradation policy, offline queue (R10-01)
     - `@nova26/performance` — agent pool, cache manager, build pipeline (R10-02)
     - `@nova26/analytics` — all analytics, cost tracking, ROI calculator
     - `@nova26/convex` — all Convex functions and schema
     - `@nova26/cli` — CLI runner, pre-commit hook, CI mode
   - Which packages have a "public API" (stable, versioned, semver-respected) vs which are
     internal (can change freely)?
   - What is the monorepo tool? (Turborepo is the clear choice for a TypeScript/Node.js
     monorepo — recommend with rationale and show the `turbo.json` pipeline definition)
   - What is the dependency graph between packages? (Which packages depend on which?
     Are there any circular dependencies in the proposed design? How are they resolved?)

   Provide an ASCII diagram of the package dependency graph.

3. **API stability contracts.** Define which interfaces are public contracts:
   - "Public API" means: a change requires a semver major bump, a deprecation notice in a
     prior minor release, and a migration guide. Define the complete list of public APIs:
     - `RalphLoopOptions` — changing a field name is a breaking change
     - `Task` and `AgentCheckpoint` — stored in SQLite; changing breaks existing checkpoints
     - `PortableVaultFile` — committed to repos; changing breaks vault import/export
     - `PluginAgentManifest` and `PluginAgent` — published to marketplace; changing breaks plugins
     - `WebhookPayload` — received by user servers; changing breaks integrations
     - `CLIRunOptions` and `CLIRunResult` — used in CI scripts; changing breaks pipelines
   - "Internal API" means: can change in any release without notice. Define the internal list:
     - `AgentPool` internals, `CacheManager` internals, `CheckpointManager` internals
     - All Convex function implementations (the mutation names in `convex/atlas.ts` are
       internal — the CLI uses the HTTP wrapper, not the Convex function names directly)
   - How is the public/internal distinction enforced in TypeScript?
     (Re-export public types from `@nova26/core/index.ts`; keep internal types in subdirectories
     that are not re-exported)

4. **Dependency management.** Design the lean dependency strategy:
   - Current dependencies: `zod`, `better-sqlite3`, `ollama` (the Ollama Node.js client).
     These are the right minimal set. Define the policy for adding new dependencies:
     - Standard: any new dependency must be justified in a PR with: size impact, alternatives
       considered, maintenance health (last commit, open issues, download count)
     - Banned: no lodash, no moment.js, no large utility libraries — use TypeScript standard
       library equivalents
     - Preferred: well-maintained, TypeScript-native libraries with small bundle sizes
   - Which planned additions from R10 specs add new dependencies?
     - `fast-check` (PBT testing) — dev dependency only, acceptable
     - `i18next` (i18n) — production dependency, evaluate size and alternatives
     - `memfs` (filesystem mocking) — dev dependency only, acceptable
   - How are dependency vulnerabilities managed? (`npm audit` in CI; `dependabot` for
     automated PRs; security policy for how quickly critical vulnerabilities must be patched)

   Provide the TypeScript interface for a dependency policy checker:

   ```typescript
   interface DependencyPolicy {
     banned: string[];               // package names that must never be added
     requireJustification: boolean;  // all new production deps need a written justification
     maxBundleSizeKb: number;        // individual package size limit
     auditOnCI: boolean;
   }
   ```

5. **Versioning strategy.** Design the complete versioning and release system:
   - What versioning scheme does Nova26 use? (Semantic versioning: MAJOR.MINOR.PATCH)
   - What constitutes a MAJOR change? A MINOR change? A PATCH change?
     - MAJOR: any change to a public API interface, any change to vault/playbook file formats,
       any change to CLI exit code contract
     - MINOR: new features, new optional fields in public interfaces, new CLI commands
     - PATCH: bug fixes, performance improvements, internal refactors
   - How are breaking changes communicated?
     - Deprecation notice in release N: "This interface will change in release N+1"
     - Migration guide published alongside the MAJOR release
     - In-product warning when a deprecated API is used
   - What is the release cadence? (Monthly MINOR releases? Weekly PATCH releases?
     MAJOR releases only when unavoidable?)
   - How are pre-release versions handled? (Beta channel: `1.5.0-beta.1` installable with
     `nova26 update --channel beta`)

   Provide the TypeScript interface:

   ```typescript
   interface VersionedRelease {
     version: string;                // semver string
     channel: 'stable' | 'beta' | 'canary';
     releasedAt: string;
     breakingChanges: BreakingChange[];
     deprecations: Deprecation[];
     migrationRequired: boolean;
     minimumCompatibleVaultVersion: string;
     minimumCompatibleConfigVersion: string;
   }

   interface BreakingChange {
     what: string;                   // what changed
     why: string;                    // why it was necessary
     migrationGuideUrl: string;
   }

   interface Deprecation {
     api: string;                    // which API is deprecated
     removedInVersion: string;       // when it will be removed
     replacement: string;            // what to use instead
   }
   ```

6. **Migration system.** Design the format migration architecture:
   - Nova26 has three local data formats that will evolve over time:
     - Vault format (`.nova/graph-memory.json` + SQLite)
     - Playbook format (`.nova/playbooks/*.json`)
     - Config format (`.nova/config.json` or `nova26.config.ts`)
   - Design the migration runner:
     - On startup, Nova26 reads the version field from each local data file
     - If the version is older than the current schema version, run migrations automatically
     - Migrations are incremental: a migration from v1 to v3 runs v1→v2, then v2→v3
     - Before migrating, create an automatic backup (`.nova/backups/vault-v1-pre-migration.json`)
     - If a migration fails, restore from backup and display the specific error
   - What is the migration file naming convention?
     (`src/migrations/vault/001-add-quality-score.ts`,
      `src/migrations/vault/002-normalize-text-to-nfc.ts`)
   - What is the migration function signature? It must be pure: take the old data, return
     the new data, throw on unrecoverable errors.

   Provide the full TypeScript interfaces:

   ```typescript
   interface Migration {
     version: number;                // the version this migration upgrades TO
     description: string;
     up(data: unknown): unknown;     // transform old format to new format
     down?(data: unknown): unknown;  // optional: revert new format to old (for rollbacks)
   }

   interface VersionedSchema<T> {
     schemaVersion: number;
     data: T;
   }

   interface MigrationRunner {
     register(migrations: Migration[]): void;
     migrate<T>(versioned: VersionedSchema<unknown>, targetVersion: number): VersionedSchema<T>;
     getCurrentVersion(format: 'vault' | 'playbook' | 'config'): number;
     needsMigration(versioned: VersionedSchema<unknown>, format: 'vault' | 'playbook' | 'config'): boolean;
     runAll(format: 'vault' | 'playbook' | 'config', dataPath: string): Promise<MigrationResult>;
   }

   interface MigrationResult {
     fromVersion: number;
     toVersion: number;
     migrationsApplied: number;
     backupPath: string;
     success: boolean;
     error?: string;
   }

   interface BreakingChangePolicy {
     deprecationLeadVersions: number;  // how many minor versions before removal (e.g., 2)
     autoMigrateFormats: boolean;      // always auto-migrate local data on startup
     requireConfirmationForMajor: boolean;  // ask user before applying MAJOR data migrations
     backupBeforeMigration: boolean;
   }
   ```

7. **Production monitoring for a local-first tool.** Design the telemetry and monitoring
   strategy:
   - What metrics matter for a local-first tool? Unlike a cloud service, Nova26 cannot
     monitor server uptime or request latency from the operator side. Define what can
     and should be measured:
     - Opt-in crash reporting: when Nova26 panics or throws an unhandled exception,
       send an anonymized crash report (stack trace, OS, RAM, model name, Nova26 version)
       — with explicit user consent required
     - Opt-in usage telemetry: build count, task success rate, model used, feature flags
       active — aggregated, never task content
     - Local health metrics: build duration, cache hit rate, memory usage per build,
       test pass rate — stored locally in `.nova/metrics.db` and surfaced in the dashboard
     - Update check: on startup, check for a new version of Nova26 (one HTTP request to
       a version manifest endpoint; respect user opt-out)
   - How is opt-in consent managed?
     - First run: explicit prompt "Help improve Nova26 by sharing anonymized usage stats? [Y/n]"
     - Stored in `.nova/config.json` as `telemetry: { crashReporting: bool, usageStats: bool }`
     - Can be changed at any time with `nova26 config set telemetry.usageStats false`
   - What does the crash report payload look like? (Define the minimum necessary fields;
     never include task descriptions, file paths from the user's project, or vault pattern text)
   - How are local health metrics aggregated for the ROI dashboard and analytics UI?

   Provide the TypeScript interface:

   ```typescript
   interface TelemetryConfig {
     crashReporting: boolean;
     usageStats: boolean;
     consentedAt?: string;
   }

   interface CrashReport {
     novaVersion: string;
     nodeVersion: string;
     platform: 'darwin' | 'linux' | 'win32';
     archRamGb: number;              // rounded to nearest 4GB for privacy
     ollamaVersion: string;
     activeModel: string;
     errorCode: string;              // Nova26 error code, NOT the raw error message
     stackHash: string;              // SHA-256 of the sanitized stack trace
     featureFlags: Record<string, boolean>;  // which RalphLoopOptions flags were active
   }

   interface LocalMetricsStore {
     recordBuildMetric(metric: BuildMetric): void;
     getAggregates(period: '7d' | '30d' | '90d'): LocalMetricsAggregate;
     export(format: 'json' | 'csv'): string;
   }

   interface BuildMetric {
     buildId: string;
     durationMs: number;
     taskCount: number;
     successCount: number;
     failureCount: number;
     cacheHitRate: number;
     peakMemoryMb: number;
     modelsUsed: string[];
     degradationsOccurred: number;
   }
   ```

8. **Technical debt register.** Define the process for tracking and paying down tech debt:
   - Design the `TECH_DEBT.md` convention: a living document in the repo root that lists
     known shortcuts taken during fast development, with an owner, a severity, and a
     target release for resolution.
   - What categories of tech debt are tracked?
     - Architecture debt (wrong module boundary, missed abstraction)
     - Test debt (untested path, skipped test, mocked-out critical behavior)
     - Dependency debt (outdated library, security vulnerability, deprecated API usage)
     - Documentation debt (undocumented public interface, missing JSDoc)
   - How is tech debt discovered? (PR review checklist includes "does this create tech debt?";
     `TODO` and `FIXME` comments are parsed by a CI job and linked to issues)
   - What is the pay-down policy? (No new major features while any severity-critical
     tech debt is open; all tech debt items must have a resolution target)

9. **File structure.** Specify:
   - `src/migrations/vault/` — vault format migration files (numbered, e.g., `001-*.ts`)
   - `src/migrations/playbook/` — playbook format migration files
   - `src/migrations/config/` — config format migration files
   - `src/migrations/runner.ts` — `MigrationRunner` implementation
   - `src/migrations/versioned-schema.ts` — `VersionedSchema` and `BreakingChangePolicy` types
   - `src/telemetry/crash-reporter.ts` — opt-in crash report construction and submission
   - `src/telemetry/local-metrics.ts` — `LocalMetricsStore` implementation
   - `src/telemetry/update-checker.ts` — startup version check
   - `src/telemetry/config.ts` — `TelemetryConfig` storage and consent management
   - `TECH_DEBT.md` — living tech debt register (initial entries from known shortcuts)
   - `turbo.json` — Turborepo pipeline definition (for the eventual monorepo split)

10. **Open questions for the build team.** List 3-5 questions.

---

## Output Format

- Label each section clearly: `## GROK-R10-01`, `## GROK-R10-02`, etc.
- Begin each deliverable with the big-picture analogy paragraph before any technical content.
- Use TypeScript for all interfaces and method signatures.
- Use ASCII or prose for flow diagrams — no image dependencies.
- For code examples that reference real Nova26 files, use the actual file paths:
  - `src/orchestrator/ralph-loop.ts`
  - `src/orchestrator/prompt-builder.ts`
  - `src/llm/structured-output.ts`
  - `src/agent-loop/scratchpad.ts`
  - `src/agent-loop/agent-loop.ts`
  - `src/memory/session-memory.ts`
  - `src/analytics/agent-analytics.ts`
  - `convex/schema.ts`
  - `convex/atlas.ts`
- Each deliverable should be independently useful — a developer picking up GROK-R10-03
  should not need to read R10-01 first.
- Estimated output: 3,000-5,000 words per deliverable, 15,000-25,000 words total.

---

## Reference: Key Nova26 Types

For accuracy, here are the core types from `src/types/index.ts` that your specs should
build on or extend:

```typescript
// Agent names in the system
type AgentName = 'MARS' | 'VENUS' | 'MERCURY' | 'JUPITER' | 'SATURN' | 'PLUTO'
  | 'NEPTUNE' | 'URANUS' | 'EARTH' | 'IO' | 'GANYMEDE' | 'EUROPA' | 'CALLISTO'
  | 'TITAN' | 'ENCELADUS' | 'MIMAS' | 'TRITON' | 'CHARON' | 'ANDROMEDA'
  | 'ATLAS' | 'SUN';

// Task structure (used throughout ralph-loop.ts and prompt-builder.ts)
interface Task {
  id: string;
  title: string;
  description: string;
  agent: string;
  phase: string;
  status: 'pending' | 'ready' | 'running' | 'done' | 'failed';
  dependencies: string[];
  attempts: number;
  output?: string;
  todos?: TodoItem[];
  currentTodoId?: string;
}

// The autonomy spectrum
type AutonomyLevel = 1 | 2 | 3 | 4 | 5;

// Ralph Loop options (extend these for R10 features)
interface RalphLoopOptions {
  parallelMode?: boolean;
  concurrency?: number;
  autoTestFix?: boolean;
  maxTestRetries?: number;
  planApproval?: boolean;
  eventStore?: boolean;
  sessionMemory?: boolean;
  gitWorkflow?: boolean;
  costTracking?: boolean;
  budgetLimit?: number;
  convexSync?: boolean;
  agenticMode?: boolean;
  autonomyLevel?: AutonomyLevel;
  acePlaybooks?: boolean;
  rehearsalStage?: boolean;
  similarityEngine?: boolean;
  modelRouting?: boolean;
  pluginAgents?: boolean;
  teamVault?: boolean;
  ciMode?: boolean;
  predictiveAnalytics?: boolean;
  onboardingMode?: boolean;
  // New in R10:
  // checkpointing?: boolean;
  // gracefulDegradation?: boolean;
  // agentPooling?: boolean;
  // llmResponseCache?: boolean;
  // migrationCheck?: boolean;
}
```

---

## Coordination Note

Kimi is currently executing the infrastructure sprint:
- Similarity engine (`src/similarity/`)
- Convex real-time architecture (`convex/`)
- Security and privacy layer (`src/security/`)
- Model routing (`src/llm/`)
- Analytics pipeline (`src/analytics/`)

Your R10-01 spec (`src/recovery/`) and R10-02 spec (`src/performance/`) are clean-slate
new directories — no conflicts with Kimi's current work.

Your R10-03 spec (testing) extends the existing test suite. Do not modify existing test
files — document proposed additions as "new test files to be added."

Your R10-04 spec (`src/a11y/`, `src/i18n/`, `locales/`) and R10-05 spec
(`src/migrations/`, `src/telemetry/`) are new directories — no conflicts.

The `src/analytics/agent-analytics.ts` file is in Claude Code's domain. R10-05's
`src/telemetry/local-metrics.ts` is a new file that feeds into analytics — document the
integration point but do not specify changes to the existing analytics file.

Existing Convex tables (from `convex/schema.ts`): `builds`, `tasks`, `executions`,
`patterns`, `agents`, `companyAgents`, `learnings`. R10 specs should not add new Convex
tables without explicitly calling out the addition and its rationale.

---

*Prompt issued by Claude Code on 2026-02-18. Grok R10 output should be delivered to
`.nova/output/` or committed directly to the `grok/r10` branch for coordinator review.*
