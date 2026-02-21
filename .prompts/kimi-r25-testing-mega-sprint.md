# Kimi Mega-Sprint: R25 Test Coverage for R22-R24 Modules
## 7 Tasks | 445+ Tests | Test Files ONLY | TypeScript Strict | ESM `.js` Imports

> **Pre-requisite**: R22-R24 source code delivered. 4,231 tests passing, 153 test files, 0 TS errors.
> **Repo**: https://github.com/nelsen3000/nova26
> **Branch**: `main` (or feature branch if preferred)
> **Rules**: TypeScript strict, ESM `.js` imports, vitest, no `any`, mock all I/O, no real API calls
> **Scope**: Write `__tests__/` files ONLY. Do NOT modify any source files.

---

## Mission

Kimi delivered source code for 7 active R22-R24 modules but deferred all test files. The source code is complete and compiling. This sprint writes the missing test files to bring test coverage up to production quality.

**What you ARE doing:**
- Creating new `__tests__/*.test.ts` files for each module
- Writing 445+ new vitest test cases across 7 modules
- Mocking all I/O (API calls, file system, hardware detection, LLM calls, network)
- Importing from existing source files and testing their exported interfaces

**What you are NOT doing:**
- Do NOT modify any existing source files (`.ts` files outside `__tests__/`)
- Do NOT create new source files
- Do NOT change `ralph-loop.ts` or any orchestrator wiring
- Do NOT add new dependencies to `package.json`

---

## Rules

- TypeScript strict mode. No `any` types — use `unknown` + type guards or specific types.
- ESM imports with `.js` extensions (e.g., `import { Foo } from '../foo.js';`).
- Tests use vitest (`import { describe, it, expect, vi, beforeEach } from 'vitest';`).
- Mock ALL external calls — Ollama, Perplexity API, Mem0, Letta, Braintrust, LangSmith, hardware detection, file system.
- Use `vi.fn()` and `vi.mock()` for mocking. Use `vi.useFakeTimers()` where time-sensitive.
- Each `describe` block should have a `beforeEach` that resets mocks via `vi.clearAllMocks()`.
- Run `npx tsc --noEmit` and `npx vitest run` after each task. Zero errors, zero failures.
- Target: 4,231 + 445 = **4,676+ tests** passing at end of sprint.
- If a test file already exists (e.g., perplexity), read it first. Add missing tests; do not duplicate existing ones.

---

## Task 1: KIMI-T-01 — Perplexity Research Tests

**Source**: `src/tools/perplexity/` (perplexity-agent.ts, types.ts, index.ts)
**Test file**: `src/tools/perplexity/__tests__/perplexity.test.ts` (may already exist — check first, add missing tests)
**Target**: 30 tests minimum

### Pre-check

Read the existing test file at `src/tools/perplexity/__tests__/perplexity.test.ts`. Count the existing tests. If fewer than 30, add the missing coverage below. If 30+ already exist with good coverage, skip to Task 2.

### What to Test

**API Mocking & Core Functionality (8 tests)**
1. Successful research query returns `PerplexityResearchBrief` with all required fields
2. API call includes correct headers (Authorization, model, baseURL)
3. Query with `sonar-pro` model uses correct model parameter
4. Query with `sonar-reasoning` model uses correct model parameter
5. API response maps correctly to `keyFindings` array
6. API response maps correctly to `sources` array with reliability scores
7. Empty API response returns brief with empty findings
8. Response includes `tasteVaultPersonalization` when Taste Vault context provided

**Cache Hit/Miss (5 tests)**
9. Cache hit returns cached result without API call
10. Cache miss triggers API call and stores result
11. Cache expires after TTL — stale entry triggers new API call
12. Different queries produce different cache keys
13. Cache stores and retrieves `novaRelevanceScore` correctly

**Relevance Scoring (5 tests)**
14. High-relevance query scores > 0.8
15. Low-relevance query scores < 0.3
16. Relevance score is between 0 and 1
17. `suggestedNextActions` populated for high-relevance results
18. `tags` array populated based on query content

**Fallback on Error (7 tests)**
19. Network error with `fallbackOnError: true` returns graceful fallback brief
20. Network error with `fallbackOnError: false` throws error
21. Rate limit (429) triggers backoff and retry
22. Invalid API response (malformed JSON) returns fallback
23. Timeout after configurable threshold returns fallback
24. Server error (500) with fallback returns degraded brief
25. Auth error (401) throws immediately (no fallback — config error)

**Rate Limiting (5 tests)**
26. Concurrent requests within rate limit all succeed
27. Requests exceeding rate limit are queued
28. Rate limit resets after window expires
29. Rate limit counter tracks per-model usage
30. Burst of 10 requests processes correctly with rate limiting

### Verification

```bash
npx tsc --noEmit
npx vitest run src/tools/perplexity/__tests__/perplexity.test.ts
```

---

## Task 2: KIMI-T-02 — Model Routing Tests

**Source**: `src/model-routing/` — hardware-detector.ts, model-registry.ts, router.ts, speculative-decoder.ts, types.ts, inference-queue.ts, metrics-tracker.ts, ollama-modelfile-generator.ts
**Test file**: `src/model-routing/__tests__/routing.test.ts`
**Target**: 80 tests minimum

### What to Test

**Hardware Detection (12 tests)**
1. Detects Apple Silicon M1 — reports `apple` vendor, correct VRAM/RAM
2. Detects Apple Silicon M2 — reports `apple` vendor, upgraded specs
3. Detects Apple Silicon M3 — reports `apple` vendor, correct tier
4. Detects Apple Silicon M4 — reports `apple` vendor, `ultra` tier
5. Detects NVIDIA GPU — reports `nvidia` vendor, correct VRAM
6. Detects CPU-only system — reports `none` vendor, `low` tier
7. Recommends `fp16` quant for high VRAM (>24GB)
8. Recommends `q8` quant for medium VRAM (12-24GB)
9. Recommends `q5` quant for low VRAM (6-12GB)
10. Recommends `q4` quant for minimal VRAM (<6GB)
11. Hardware detection returns all required fields (gpuVendor, vramGB, ramGB, cpuCores)
12. Hardware detection is idempotent (same result on repeated calls)

**Agent-Model Mapping (15 tests)**
13. MARS maps to Qwen 3.5 Coder for code generation
14. PLUTO maps to Qwen 3.5 Coder for code tasks
15. VENUS maps to Kimi K2.5 for multimodal/UI tasks
16. EUROPA maps to Kimi K2.5 for UI tasks
17. MERCURY maps to MiniMax M2.5 for validation
18. CHARON maps to MiniMax M2.5 for debugging
19. SUN maps to DeepSeek-V3.2 for multi-step reasoning
20. JUPITER maps to DeepSeek-V3.2 for reasoning tasks
21. NEPTUNE maps to MiMo-V2-Flash for low-latency tasks
22. IO maps to MiMo-V2-Flash for low-latency tasks
23. Unknown agent falls back to default model
24. Agent mapping respects hardware tier constraints
25. Agent mapping returns `ModelProfile` with all required fields
26. Multiple agents can share the same model without conflict
27. Agent mapping includes `strength` field matching agent role

**Confidence-Based Escalation (10 tests)**
28. Low confidence (<0.3) escalates to larger model
29. Medium confidence (0.3-0.7) stays on current model
30. High confidence (>0.7) stays on current model
31. Escalation from q4 model upgrades to q8
32. Escalation from q8 model upgrades to fp16
33. Already on largest model — no further escalation possible
34. Escalation preserves agent context across model switch
35. Confidence threshold is configurable per agent
36. Sequential escalation: fast → mid → heavy model chain
37. Escalation logs reason for model switch

**Speculative Decoding (10 tests)**
38. Draft model generates tokens, verify model accepts/rejects
39. Acceptance rate > 0.7 means draft model is effective
40. Acceptance rate < 0.3 triggers draft model switch
41. Speculative decoding produces correct final output
42. Speed-up factor is > 1.0 when acceptance rate is high
43. Fallback to standard decoding when no draft model configured
44. Draft-verify pipeline handles empty draft gracefully
45. Speculative decoder tracks acceptance rate metrics
46. Speculative decoder respects token limit
47. Concurrent speculative decode requests handled correctly

**Inference Queue & Fairness (10 tests)**
48. Tasks enqueue in priority order (higher priority first)
49. Equal priority tasks processed in FIFO order
50. GPU lock prevents concurrent GPU-bound tasks
51. GPU lock releases on task completion
52. GPU lock releases on task failure (no deadlock)
53. Queue fairness: no agent starved after 100 mixed tasks
54. Queue respects max concurrent limit
55. Queue drains completely when all tasks complete
56. Priority incorporates Taste Vault weight
57. Queue handles 12 concurrent agent submissions

**Modelfile Generation (8 tests)**
58. Generates valid Ollama Modelfile for Apple Silicon M3
59. Generates valid Ollama Modelfile for NVIDIA RTX 4090
60. Generates valid Ollama Modelfile for CPU-only
61. Modelfile includes correct `FROM` directive for model
62. Modelfile includes correct `PARAMETER` directives for quant
63. Modelfile includes context window setting
64. Modelfile includes temperature setting
65. Generated Modelfile is valid string (no undefined/null fragments)

**Metrics Tracking (8 tests)**
66. Records inference duration per agent
67. Records tokens-per-second per model
68. Computes P50/P95/P99 latency across sessions
69. Tracks model usage distribution (which models used most)
70. Metrics reset on new session
71. Metrics aggregate correctly across 100+ inferences
72. Tracks escalation frequency per agent
73. Metrics include speculative decoding acceptance rate

**Chaos Fallback (7 tests)**
74. Model unavailable — falls back to next best model
75. All preferred models unavailable — falls back to CPU default
76. Timeout on model load — retries then falls back
77. Corrupt model response — retries with same model
78. Out of memory — downgrades to smaller quantization
79. Fallback chain exhausted — returns clear error message
80. Fallback events are logged in metrics

### Verification

```bash
npx tsc --noEmit
npx vitest run src/model-routing/__tests__/routing.test.ts
```

---

## Task 3: KIMI-T-03 — Workflow Engine Tests

**Source**: `src/workflow-engine/` — ralph-visual-engine.ts, ralph-loop-visual-adapter.ts, types.ts, index.ts
**Test file**: `src/workflow-engine/__tests__/workflow-engine.test.ts`
**Target**: 70 tests minimum

### What to Test

**DAG Execution Order (12 tests)**
1. Linear DAG (A→B→C) executes in order
2. Diamond DAG (A→B, A→C, B→D, C→D) executes correctly
3. Wide DAG (A→B, A→C, A→D, A→E) runs B-E in parallel after A
4. Deep DAG (A→B→C→D→E→F) executes sequentially
5. Single-node DAG executes the one node
6. Empty DAG (no nodes) completes immediately with no error
7. Node with multiple predecessors waits for all to complete
8. DAG detects and rejects cycles (A→B→C→A throws)
9. Disconnected subgraphs execute independently
10. Node execution order respects all edge constraints
11. Execution assigns correct status to each node ('pending' → 'running' → 'complete')
12. DAG with 50 nodes executes without stack overflow

**Rewind/Restore State Integrity (10 tests)**
13. Rewind to checkpoint restores correct `WorkflowState`
14. Rewind preserves all state variables at checkpoint time
15. Rewind does not corrupt nodes that completed before checkpoint
16. Rewind to first checkpoint resets entire workflow
17. Rewind to most recent checkpoint re-runs only last node
18. Multiple sequential rewinds (rewind, execute, rewind again) maintain integrity
19. Rewind clears status of nodes after checkpoint to 'pending'
20. Rewind with invalid checkpoint ID throws descriptive error
21. State snapshot at checkpoint is a deep copy (not reference)
22. Rewind preserves `timeline` events up to checkpoint

**Checkpoint Persistence (8 tests)**
23. Checkpoint created after each node completion
24. Checkpoint includes full `stateSnapshot`
25. Checkpoint includes `nodeId` and `timestamp`
26. Retrieving checkpoint by ID returns correct snapshot
27. Listing all checkpoints returns them in chronological order
28. Checkpoint count matches number of completed nodes
29. Checkpoint survives workflow pause and resume
30. Checkpoint serialization round-trip (serialize → deserialize → identical)

**Parallel Node Execution (8 tests)**
31. Parallel nodes execute concurrently (not sequentially)
32. Merge node waits for all parallel predecessors
33. One parallel node failure does not cancel siblings (by default)
34. All parallel node results available at merge node
35. Parallel execution respects max concurrency limit
36. Parallel nodes with different durations all complete before merge
37. Status of parallel nodes updates independently
38. Parallel fork with 10 branches executes correctly

**Error Propagation and Retry Policies (10 tests)**
39. Node failure propagates error to workflow state
40. Node with retry policy retries on first failure
41. Retry respects `maxRetries` limit
42. Retry uses `backoffMs` delay between attempts
43. Node succeeds on retry after transient failure
44. Node exhausts retries then marks as 'failed'
45. Failed node without retry policy fails immediately
46. Error propagation stops at failed node (downstream nodes skipped)
47. Error includes node ID and original error message
48. Retry count tracked in node metadata

**LangGraph Node Config Validation (8 tests)**
49. Valid `LangGraphNodeConfig` passes validation
50. Missing `entryFunction` throws validation error
51. Missing `stateSchema` throws validation error
52. Invalid `retryPolicy` (negative maxRetries) throws error
53. Invalid `retryPolicy` (negative backoffMs) throws error
54. Config with optional `retryPolicy` omitted passes validation
55. `entryFunction` must be non-empty string
56. `stateSchema` accepts arbitrary key-value pairs

**Visual State Serialization Round-trip (7 tests)**
57. Workflow serializes to JSON and deserializes to identical structure
58. Node positions (x, y) preserved through serialization
59. Edge conditions preserved through serialization
60. `WorkflowState` variables preserved through serialization
61. `TemporalEvent` data preserved through serialization
62. Large workflow (100 nodes, 200 edges) serializes/deserializes correctly
63. Serialized workflow is valid JSON string

**ATLAS Memory Hook (7 tests)**
64. Workflow start triggers ATLAS memory hook
65. Node completion triggers ATLAS memory hook with node data
66. Workflow completion triggers ATLAS memory hook with final state
67. Workflow failure triggers ATLAS memory hook with error
68. ATLAS hook receives correct workflow ID
69. ATLAS hook is called with serializable data (no circular refs)
70. ATLAS hook failure does not crash workflow execution

### Verification

```bash
npx tsc --noEmit
npx vitest run src/workflow-engine/__tests__/workflow-engine.test.ts
```

---

## Task 4: KIMI-T-04 — Infinite Memory Tests

**Source**: `src/atlas/infinite-memory-core.ts`, `src/atlas/mem0-adapter.ts`, `src/atlas/letta-soul-manager.ts`, `src/atlas/memory-taste-scorer.ts` (or `src/atlas/taste-vault/memory-taste-scorer.ts`)
**Test file**: `src/atlas/__tests__/infinite-memory.test.ts`
**Target**: 70 tests minimum

### Important

Read the actual source files first to determine exact exports, class names, and method signatures. The interfaces below are from the spec — adapt test imports to match the actual code.

### What to Test

**Hierarchy Creation (12 tests)**
1. Create scene-level memory node — verify `level: 'scene'`
2. Create project-level memory node — verify `level: 'project'`
3. Create portfolio-level memory node — verify `level: 'portfolio'`
4. Create lifetime-level memory node — verify `level: 'lifetime'`
5. Scene node links to parent project node via `parentId`
6. Project node links to parent portfolio node via `parentId`
7. Portfolio node links to parent lifetime node via `parentId`
8. Lifetime node has no `parentId` (root level)
9. Parent node's `childIds` includes child node ID after insert
10. Creating a node returns a valid UUID
11. Node metadata includes `agentId`, `timestamp`, `tasteScore`, `accessCount`
12. Hierarchy depth: scene→project→portfolio→lifetime traversal works

**Query Across Levels with Taste Scoring (10 tests)**
13. Query at scene level returns only scene-level memories
14. Query at project level returns project-level memories
15. Query without level filter returns memories from all levels
16. Query results sorted by taste score (highest first)
17. Query with `tasteThreshold` filters out low-scoring memories
18. Query with `limit` caps result count
19. Query returns empty array when no memories match
20. Query updates `accessCount` on returned memories
21. Query updates `lastAccessed` timestamp on returned memories
22. Taste score influences ranking — high taste score ranks above recent but low-taste memory

**Legacy Migration (5 tests)**
23. `migrateLegacyGraphMemory()` converts R16 format nodes to hierarchical format
24. Migration preserves original content
25. Migration assigns correct hierarchy level based on metadata
26. Migration returns count of migrated and failed nodes
27. Migration is idempotent (running twice does not duplicate)

**Memory Pruning and Access Tracking (8 tests)**
28. `pruneStale()` removes memories older than threshold
29. Pruning preserves recently accessed memories
30. Pruning returns count of pruned nodes
31. Pruning removes node from parent's `childIds`
32. Access tracking increments `accessCount` on each query hit
33. Access tracking updates `lastAccessed` to current time
34. Pruning with 0 days threshold removes nothing (all are "today")
35. Pruning with very large threshold removes all old memories

**Mem0 Adapter Round-trip (8 tests)**
36. Mem0 adapter `store()` sends correct payload (mocked HTTP)
37. Mem0 adapter `retrieve()` returns parsed memories (mocked HTTP)
38. Mem0 adapter handles API error gracefully
39. Mem0 adapter handles empty response
40. Mem0 adapter includes auth token in requests
41. Mem0 adapter maps response to `HierarchicalMemoryNode` format
42. Mem0 adapter respects rate limits
43. Mem0 adapter timeout returns fallback

**Letta Soul Persistence (8 tests)**
44. Letta soul manager `saveSoul()` persists personality data (mocked)
45. Letta soul manager `loadSoul()` retrieves personality data (mocked)
46. Letta soul manager handles missing soul gracefully (returns default)
47. Letta soul manager `updateSoul()` merges new data with existing
48. Letta soul format includes agent personality traits
49. Letta soul round-trip: save then load returns identical data
50. Letta soul manager handles API errors gracefully
51. Letta soul manager validates soul data schema

**Graph Statistics (7 tests)**
52. `getGraph()` returns correct `totalNodes` count
53. `getGraph()` returns correct `maxDepth` (4 for full hierarchy)
54. `getGraph()` returns correct `avgTasteScore`
55. Graph edges include `parent`, `related`, and `temporal` types
56. Edge weights reflect relationship strength
57. Graph with zero nodes returns empty stats
58. Graph with 1000 nodes computes stats correctly

**Concurrent Upsert/Query (10 tests)**
59. Two concurrent upserts to different nodes both succeed
60. Two concurrent upserts to same node resolve without corruption
61. Concurrent query during upsert returns consistent state
62. 10 concurrent upserts complete without errors
63. 10 concurrent queries complete without errors
64. Concurrent upsert and prune do not conflict
65. Concurrent queries to same node return identical results
66. Upsert followed immediately by query returns the new data
67. Rapid sequential upserts (100) all persist correctly
68. Mixed read/write workload (50 queries + 50 upserts) completes without errors

### Verification

```bash
npx tsc --noEmit
npx vitest run src/atlas/__tests__/infinite-memory.test.ts
```

---

## Task 5: KIMI-T-05 — Cinematic Observability Tests

**Source**: `src/observability/cinematic-core.ts`, `src/observability/braintrust-adapter.ts`, `src/observability/langsmith-bridge.ts`, `src/observability/types.ts`
**Test file**: `src/observability/__tests__/cinematic-observability.test.ts`
**Target**: 60 tests minimum

### What to Test

**Span Lifecycle (10 tests)**
1. `recordSpan()` returns a valid span ID
2. `recordSpan()` stores span with `status: 'running'`
3. `endSpan()` sets `status: 'success'` and computes `durationMs`
4. `endSpan()` with failure sets `status: 'failure'`
5. `endSpan()` sets `endTime` to current timestamp
6. `endSpan()` on already-ended span throws error
7. `endSpan()` on non-existent span ID throws error
8. `recordSpan()` with all span types ('agent-call', 'llm-inference', 'tool-use', 'gate-check', 'user-interaction')
9. Span `durationMs` is positive and reasonable (not negative, not zero for real spans)
10. Span metadata preserved through record→end lifecycle

**Nested Span Tree Construction (8 tests)**
11. Child span references parent via `parentId`
12. `getTraceTree()` returns all spans for a trace ID
13. `getTraceTree()` returns spans in chronological order
14. Three-level nesting: root → child → grandchild all linked correctly
15. Multiple children of same parent all reference correct `parentId`
16. Trace tree with 20 spans reconstructs correctly
17. Orphan span (no parent, new trace) creates new trace root
18. `getTraceTree()` for non-existent trace ID returns empty array

**Eval Suite Execution (10 tests)**
19. `runEvalSuite()` executes all evaluators in suite
20. `runEvalSuite()` returns scores for each evaluator
21. `llm-judge` evaluator returns score 0-1 (mocked LLM)
22. `heuristic` evaluator computes score from rules
23. `taste-vault` evaluator uses taste preferences for scoring
24. `human-labeled` evaluator returns pre-labeled scores
25. Eval suite with empty dataset returns empty results
26. Eval suite `passed` is true when all scores > threshold
27. Eval suite `passed` is false when any score below threshold
28. Eval suite returns `details` strings for each evaluation

**Braintrust Adapter (8 tests)**
29. Braintrust adapter sends eval data in correct format (mocked HTTP)
30. Braintrust adapter receives and parses scores (mocked)
31. Braintrust adapter handles API error gracefully
32. Braintrust adapter includes project ID in requests
33. Braintrust adapter maps Nova eval format to Braintrust format
34. Braintrust adapter handles rate limiting
35. Braintrust adapter timeout returns fallback scores
36. Braintrust adapter batch sends multiple eval results

**LangSmith Bridge (8 tests)**
37. LangSmith bridge exports spans in LangSmith trace format (mocked)
38. LangSmith bridge maps `CinematicSpan` to LangSmith run format
39. LangSmith bridge handles nested spans as parent-child runs
40. LangSmith bridge includes metadata in run extra fields
41. LangSmith bridge handles API error gracefully
42. LangSmith bridge batches span exports
43. LangSmith bridge handles empty trace gracefully
44. LangSmith bridge preserves span timing data

**Dashboard Rendering (8 tests)**
45. `renderDirectorDashboard()` returns spans for given trace
46. Dashboard includes timeline representation
47. Dashboard includes taste vault summary
48. Dashboard spans sorted by start time
49. Dashboard handles trace with single span
50. Dashboard handles trace with 50+ spans
51. Dashboard returns empty state for non-existent trace
52. Dashboard includes span status distribution (running/success/failure counts)

**Trace Fidelity (4 tests)**
53. 100% of recorded spans appear in trace tree
54. No duplicate spans in trace output
55. Span IDs are unique across all traces
56. Concurrent span recording preserves all spans

**Auto-Remediation Trigger (4 tests)**
57. Taste score drop > 8% triggers remediation callback
58. Taste score drop <= 8% does not trigger remediation
59. Remediation callback receives correct span context
60. Remediation trigger is configurable (threshold adjustable)

### Verification

```bash
npx tsc --noEmit
npx vitest run src/observability/__tests__/cinematic-observability.test.ts
```

---

## Task 6: KIMI-T-06 — AI Model Database Tests

**Source**: `src/models/` — ai-model-vault.ts, model-router.ts, ensemble-engine.ts, types.ts, atlas/ adapter, orchestrator/ adapter
**Test file**: `src/models/__tests__/ai-model-vault.test.ts`
**Target**: 70 tests minimum

### What to Test

**Semantic Model Selection (15 tests)**
1. `semanticSelect()` for "write a React component" returns UI-capable model
2. `semanticSelect()` for "debug this crash" returns validation-capable model
3. `semanticSelect()` for "analyze this data" returns reasoning-capable model
4. `semanticSelect()` for "generate unit tests" returns code-capable model
5. `semanticSelect()` for "design a REST API" returns code+reasoning model
6. `semanticSelect()` for "review this PR" returns validation model
7. `semanticSelect()` for "translate to French" returns general-purpose model
8. `semanticSelect()` for "optimize this SQL" returns code model
9. `semanticSelect()` for "create UI mockup" returns multimodal model
10. `semanticSelect()` for "explain this algorithm" returns reasoning model
11. Selection returns `ModelRoute` with confidence > 0
12. Selection returns `alternatives` array (at least 1 alternative)
13. Selection `reasoning` field explains why model was chosen
14. Selection respects `localAvailable` constraint when offline
15. Selection returns different models for different agent IDs + same task

**Affinity Drift Tracking (10 tests)**
16. `updateAffinity()` with rating 5 increases model preference
17. `updateAffinity()` with rating 1 decreases model preference
18. `updateAffinity()` with rating 3 has minimal effect
19. Affinity drift < 3% after 100 feedback cycles (stability test)
20. Affinity accumulates over multiple feedback events
21. Affinity tracks per agent-model pair (agent A's feedback doesn't affect agent B)
22. New model starts with neutral affinity (no bias)
23. Affinity impacts `semanticSelect()` ranking
24. Affinity with comment stores the comment
25. Affinity `timestamp` is recorded

**Ensemble Debate Scoring (10 tests)**
26. `ensembleDebate()` with 2 models returns a winner
27. `ensembleDebate()` with 3 models returns a winner
28. Debate winner has highest score
29. Debate `reasoning` explains why winner was chosen
30. Debate with identical responses picks any (deterministic tiebreak)
31. Debate handles model failure gracefully (excludes failed model)
32. Debate with single model returns that model as winner
33. Debate scoring is fair (no position bias — first model doesn't always win)
34. Debate with empty prompt throws validation error
35. Debate results include score for each participant

**Provider Sync (8 tests)**
36. `syncFromProvider('openai')` fetches and stores models (mocked)
37. `syncFromProvider()` returns count of added and updated models
38. Sync adds new models not previously in vault
39. Sync updates existing models with new metadata
40. Sync handles provider API error gracefully
41. Sync handles empty provider response
42. Sync updates `lastUpdated` timestamp on models
43. Sync from unknown provider throws descriptive error

**Model Capability Filtering (8 tests)**
44. `listModels()` with no filter returns all models
45. `listModels({ code: 80 })` returns only models with code >= 80
46. `listModels({ localAvailable: true })` returns only local models
47. `listModels({ speed: 90 })` returns only fast models
48. Combined filters intersect correctly (code >= 80 AND speed >= 70)
49. Filter returns empty array when no models match
50. `listModels()` with 500 models returns correct subset
51. Filter on `quantizations` includes models with matching quant

**Taste Integration (7 tests)**
52. Selection incorporates Taste Vault user preferences
53. User who prefers "concise" code gets models biased toward speed
54. User who prefers "thorough" gets models biased toward reasoning
55. Taste integration does not override capability requirements
56. Taste score appears in `ModelRoute` response
57. Taste integration gracefully handles missing taste profile
58. Taste-adjusted ranking differs from pure-capability ranking

**Cold Start Performance (5 tests)**
59. Cold start with 500 mocked models completes `semanticSelect()` in < 180ms
60. Cold start initializes model index correctly
61. Cold start with 0 models returns error (no models available)
62. Second `semanticSelect()` call is faster than first (warm cache)
63. Cold start with 1000 models still completes within reasonable time

**Hot-Swap Performance (5 tests)**
64. Hot-swap model (replace one model with updated version) completes in < 25ms
65. Hot-swap preserves affinity data for unchanged models
66. Hot-swap does not interrupt in-flight `semanticSelect()` calls
67. Hot-swap updates model metadata atomically
68. Multiple rapid hot-swaps (10 in sequence) all succeed

**Model Spine Adapter (2 tests)**
69. Adapter bridges AI Model Vault to Ralph Loop options
70. Adapter handles missing vault configuration gracefully

### Verification

```bash
npx tsc --noEmit
npx vitest run src/models/__tests__/ai-model-vault.test.ts
```

---

## Task 7: KIMI-T-07 — CRDT Collaboration Tests

**Source**: `src/collaboration/` — crdt-core.ts, yjs-automerge-bridge.ts, semantic-resolver.ts, taste-vault/ sync, living-canvas/ sync
**Test file**: `src/collaboration/__tests__/crdt-collaboration.test.ts`
**Target**: 65 tests minimum

### What to Test

**Session Join/Leave (8 tests)**
1. `joinSession()` returns `CRDTDocument` with all required fields
2. `joinSession()` adds user to `participants` list
3. Second user joins — both appear in `participants`
4. `getParticipants()` returns current participant list
5. User leaves session — removed from `participants`
6. Joining non-existent document creates it
7. Joining same session twice (idempotent) does not duplicate participant
8. Session with 50 participants tracks all correctly

**Change Application and CRDT Merge (10 tests)**
9. `applyChange()` updates document content
10. `applyChange()` increments document `version`
11. `applyChange()` updates `lastModified` timestamp
12. Two users apply non-conflicting changes — both preserved
13. Sequential changes from same user accumulate correctly
14. CRDT merge of concurrent edits produces valid document
15. Document content after merge contains both users' changes
16. Change application with empty change is no-op
17. Change application on non-existent document throws error
18. 100 sequential changes all apply correctly

**Semantic Conflict Resolution (8 tests)**
19. Conflicting edits to same function body trigger semantic resolver (mocked LLM)
20. Semantic resolver returns merged result
21. Semantic resolver picks `last-writer-wins` for config values
22. Semantic resolver picks `semantic-merge` for function bodies
23. Semantic resolver fallback to `manual` when confidence is low
24. `resolveConflict()` updates document with resolution
25. Conflict resolution decrements `conflictCount`
26. Semantic resolver handles LLM error gracefully (falls back to last-writer-wins)

**Parallel Universe Fork and Merge (10 tests)**
27. `forkParallelUniverse()` creates new document branched from source
28. Fork returns new document ID (different from source)
29. Forked document has same content as source at fork time
30. Changes to fork do not affect source document
31. Changes to source do not affect forked document
32. `mergeUniverse()` combines fork back into source
33. Merge returns conflict and auto-resolved counts
34. Merge with no conflicts returns `{ conflicts: 0, autoResolved: 0 }`
35. Merge with conflicts reports correct conflict count
36. Forking from a fork (nested fork) works correctly

**Yjs Adapter (6 tests)**
37. Yjs adapter encodes text document to CRDT bytes
38. Yjs adapter decodes CRDT bytes back to text
39. Yjs round-trip preserves content exactly
40. Yjs adapter handles concurrent text insertions
41. Yjs adapter merges two divergent text states
42. Yjs adapter handles empty document

**Automerge Adapter (6 tests)**
43. Automerge adapter encodes structured data to CRDT bytes
44. Automerge adapter decodes CRDT bytes back to structured data
45. Automerge round-trip preserves data exactly
46. Automerge adapter handles concurrent object property changes
47. Automerge adapter merges two divergent object states
48. Automerge adapter handles empty document

**Taste Vault CRDT Sync (5 tests)**
49. Taste vault preferences merge deterministically
50. Two users' taste preferences merge without conflict
51. Conflicting taste preferences resolve via deterministic rule
52. Taste vault sync preserves preference scores
53. Taste vault sync handles missing preferences gracefully

**Concurrent Editor Simulation (7 tests)**
54. 10 concurrent editors apply changes without data loss
55. 25 concurrent editors apply changes without corruption
56. 50 concurrent editors maintain document consistency
57. Concurrent editors' changes all reflected in final state
58. Concurrent editors see consistent participant list
59. Rapid concurrent edits (100 in 10ms window) all apply
60. Concurrent fork + edit + merge cycle completes correctly

**Offline → Online Sync (5 tests)**
61. Offline changes queue locally
62. Reconnection syncs queued changes to server
63. Offline changes merge with online changes on reconnect
64. Multiple offline users reconnect simultaneously — all changes merge
65. Offline → online sync preserves document integrity

### Verification

```bash
npx tsc --noEmit
npx vitest run src/collaboration/__tests__/crdt-collaboration.test.ts
```

---

## Execution Order (Recommended)

Tasks are independent but this order minimizes risk:

1. **KIMI-T-01** (Perplexity) — smallest, may already have partial tests
2. **KIMI-T-02** (Model Routing) — largest, get it done early
3. **KIMI-T-03** (Workflow Engine) — standalone, no cross-module deps
4. **KIMI-T-04** (Infinite Memory) — standalone, ATLAS is well-tested module
5. **KIMI-T-05** (Observability) — references patterns from other modules
6. **KIMI-T-06** (AI Model DB) — complements Model Routing, do after T-02
7. **KIMI-T-07** (CRDT) — standalone, can be done anytime

After each task, run:
```bash
npx tsc --noEmit        # Must be 0 errors
npx vitest run           # Must be 0 failures
```

---

## Final Checklist

After completing all 7 tasks, verify:

```bash
npx tsc --noEmit        # 0 errors
npx vitest run           # 4,676+ tests passing (445+ new)
```

### Quality Gates

- [ ] `npx tsc --noEmit` → **0 errors**
- [ ] `npx vitest run` → **all tests pass**, 4,676+ total (was 4,231)
- [ ] No `any` types in test files (use `unknown`, concrete types, or type assertions)
- [ ] All imports use ESM `.js` extensions
- [ ] All I/O is mocked — zero real API calls, zero real file system access, zero real hardware detection
- [ ] No source files modified — only `__tests__/*.test.ts` files created
- [ ] Each test file has proper `describe`/`it` structure with `beforeEach` cleanup
- [ ] No test depends on another test's state (tests are independent and order-independent)

### New Files Created (7 test files)

```
src/tools/perplexity/__tests__/perplexity.test.ts    (30 tests — verify/extend existing)
src/model-routing/__tests__/routing.test.ts           (80 tests)
src/workflow-engine/__tests__/workflow-engine.test.ts  (70 tests)
src/atlas/__tests__/infinite-memory.test.ts            (70 tests)
src/observability/__tests__/cinematic-observability.test.ts  (60 tests)
src/models/__tests__/ai-model-vault.test.ts            (70 tests)
src/collaboration/__tests__/crdt-collaboration.test.ts (65 tests)
```

### Modified Files

**None.** This is a test-only sprint. Do not touch source files.
