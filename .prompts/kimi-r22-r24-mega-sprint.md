# Kimi Mega-Sprint: R22→R24 Feature Implementation
## 7 Tasks | 440+ Tests | TypeScript Strict | ESM `.js` Imports

> **Pre-requisite**: R19 + R20 + R21 sprints complete. 4,007 tests passing, 0 TS errors.
> **Cut tasks** (deferred — premature or platform-blocked): R23-02 MicroVM/WASI (no macOS support), R23-04 Agent Debate (over-engineered), R24-02 Eternal Engine Rust (no Rust crate yet), R24-04 Voice/Multimodal (no product to talk to yet)
> **Repo**: https://github.com/nelsen3000/nova26
> **Branch**: `main` (or feature branch if preferred)
> **Rules**: TypeScript strict, ESM `.js` imports, vitest, no `any`, mock all I/O, no real API calls

---

## Task 1: KIMI-PERP-01 — Perplexity Research Integration

**Spec**: `.nova/specs/perplexity-integration.md`
**Tests**: 25 vitest cases minimum

### What to Build

Create `src/tools/perplexity/` module for real-time web research via Perplexity API.

```
src/tools/perplexity/
├── index.ts
├── types.ts
├── perplexity-agent.ts          ← main wrapper + caching
├── rules.md                     ← Studio Rules integration
└── __tests__/perplexity.test.ts
```

### Key Interfaces

```typescript
export interface PerplexityResearchBrief {
  queryId: string;
  timestamp: string;
  originalQuery: string;
  synthesizedAnswer: string;
  keyFindings: string[];
  sources: Array<{ title: string; url: string; reliability: number; snippet: string }>;
  novaRelevanceScore: number;
  suggestedNextActions: string[];
  tags: string[];
  tasteVaultPersonalization: string;
}

export interface PerplexityToolConfig {
  apiKey: string;
  model: 'sonar' | 'sonar-pro' | 'sonar-reasoning';
  maxTokens: number;
  temperature: number;
  cacheTTL: number;
  fallbackOnError: boolean;
}
```

### Key Implementation Notes

- Uses OpenAI-compatible client (change baseURL to `https://api.perplexity.ai`)
- Register in RalphLoop tool registry with priority "research-first"
- ATLAS ingest hook: `onResearchBriefReceived`
- Smart caching with configurable TTL
- Taste Vault auto-prepends user style preferences to queries
- `RalphLoopOptions.researchTools.perplexity: { enabled: true, weight: 0.8 }`

### Test Requirements (25 cases)

- Mocked API responses + cache hit/miss behavior
- Fallback on error (network, rate limit, invalid response)
- Relevance scoring accuracy
- ATLAS ingest hook invocation
- Integration test inside RalphLoop ReAct cycle

---

## Task 2: KIMI-R22-01 — Agent-Specific Model Routing & Speculative Decoding

**Spec**: `.nova/specs/grok-r22-01-model-routing.md`
**Tests**: 79 vitest cases minimum
**Detailed sprint**: `.prompts/kimi-r22-sprint.md` (full interfaces + implementation notes)

### What to Build

Create `src/model-routing/` module for intelligent per-agent model selection.

```
src/model-routing/
├── index.ts, types.ts
├── hardware-detector.ts           ← GPU/VRAM/RAM auto-detect
├── model-registry.ts              ← all model profiles + Modelfile generator
├── router.ts                      ← confidence-based routing + agent mapping
├── speculative-decoder.ts         ← draft/verify pipeline
├── inference-queue.ts             ← priority queue + GPU lock management
├── benchmark/nova-bench.ts        ← 42 role-specific benchmark tasks
├── ollama-modelfile-generator.ts
├── metrics-tracker.ts
└── __tests__/routing.test.ts
```

### Key Features

- Hardware auto-detection (Apple Silicon, NVIDIA, CPU-only)
- Confidence-based escalation (start fast → upgrade if confidence < threshold)
- Speculative decoding: Nemotron-3-Nano draft + Qwen-3.5 verify = 2.5x throughput
- Auto-generated Ollama Modelfiles per hardware tier
- Inference queue with priority (Taste Vault weight + urgency)
- Nova-Bench suite (42 role-specific benchmark tasks)

### Default Agent-Model Mapping

| Agent Role | Primary Model | Strength |
|-----------|--------------|----------|
| MARS / PLUTO | Qwen 3.5 Coder | Heavy code generation |
| VENUS / EUROPA | Kimi K2.5 | Multimodal / UI |
| MERCURY / CHARON | MiniMax M2.5 | Validation / debugging |
| SUN / JUPITER | DeepSeek-V3.2 | Multi-step reasoning |
| NEPTUNE / IO | MiMo-V2-Flash | Low latency |

### Test Requirements (79 cases)

- Hardware detection across 6 configs (M1-M4, RTX 4090, CPU-only)
- Agent mapping + confidence escalation (42 role-specific paths)
- Speculative decoding acceptance rate & speed-up
- Queue fairness under 12 concurrent agents
- Modelfile generation + validation
- Nova-Bench regression, metrics tracking, chaos fallback

---

## Task 3: KIMI-R23-01 — Persistent Visual Workflow Engine

**Spec**: `.nova/specs/grok-r23-eternal-symphony.md` → R23-01 section
**Tests**: 70 vitest cases minimum

### What to Build

Create `src/workflow-engine/` module for visual, rewindable workflow orchestration.

```
src/workflow-engine/
├── index.ts
├── types.ts
├── ralph-visual-engine.ts         ← RalphVisualWorkflowEngine class
├── ralph-loop-visual-adapter.ts   ← adapter for existing RalphLoop
├── atlas/visual-memory-hook.ts    ← persist workflow states to ATLAS
└── __tests__/workflow-engine.test.ts
```

### Key Interfaces

```typescript
export interface PersistentWorkflow {
  id: string;
  name: string;
  nodes: VisualNode[];
  edges: Array<{ from: string; to: string; condition?: string }>;
  state: WorkflowState;
  timeline: TemporalEvent[];
  createdAt: string;
  lastModified: string;
}

export interface VisualNode {
  id: string;
  type: 'agent' | 'gate' | 'decision' | 'parallel' | 'merge';
  agentId?: string;
  config: LangGraphNodeConfig;
  position: { x: number; y: number };
  status: 'pending' | 'running' | 'complete' | 'failed' | 'skipped';
}

export interface LangGraphNodeConfig {
  entryFunction: string;
  stateSchema: Record<string, unknown>;
  retryPolicy?: { maxRetries: number; backoffMs: number };
}

export interface WorkflowState {
  currentNodeId: string;
  checkpoints: Array<{ nodeId: string; timestamp: string; stateSnapshot: unknown }>;
  variables: Record<string, unknown>;
}

export interface TemporalEvent {
  id: string;
  type: 'node-start' | 'node-complete' | 'node-fail' | 'rewind' | 'fork';
  nodeId: string;
  timestamp: string;
  data: unknown;
}
```

### Key Implementation Notes

- `startVisualWorkflow(workflow)` → executes nodes in DAG order
- `rewindTo(checkpointId)` → restores workflow to previous state
- LangGraph-style node configs with state schemas
- Every checkpoint persisted for time-travel debugging
- Integrates with existing RalphLoop via adapter pattern
- Taste Vault fidelity check at each checkpoint (target: 95%+)

### Test Requirements (70 cases)

- DAG execution order correctness
- Rewind/restore state integrity
- Checkpoint persistence and retrieval
- Parallel node execution
- Error propagation and retry policies
- LangGraph node config validation
- Visual state serialization round-trip
- ATLAS memory hook invocation

---

## ~~Task 4: KIMI-R23-02 — MicroVM / WASI Ultra-Sandbox~~ **CUT** (Firecracker requires Linux KVM, no macOS support)

---

## Task 5: KIMI-R23-03 — Infinite Hierarchical Memory

**Spec**: `.nova/specs/grok-r23-eternal-symphony.md` → R23-03 section
**Tests**: 70 vitest cases minimum

### What to Build

Create `src/atlas/` extensions for infinite hierarchical memory.

```
src/atlas/
├── infinite-memory-core.ts        ← ATLASInfiniteMemory class
├── mem0-adapter.ts                ← Mem0 API integration
├── letta-soul-manager.ts          ← Letta soul persistence
├── taste-vault/memory-taste-scorer.ts  ← taste-aware memory ranking
└── __tests__/infinite-memory.test.ts
```

### Key Interfaces

```typescript
export interface HierarchicalMemoryNode {
  id: string;
  level: 'scene' | 'project' | 'portfolio' | 'lifetime';
  content: string;
  embedding?: number[];
  parentId?: string;
  childIds: string[];
  metadata: {
    agentId: string;
    timestamp: string;
    tasteScore: number;
    accessCount: number;
    lastAccessed: string;
  };
}

export interface InfiniteMemoryGraph {
  nodes: Map<string, HierarchicalMemoryNode>;
  edges: Array<{ from: string; to: string; weight: number; type: 'parent' | 'related' | 'temporal' }>;
  stats: { totalNodes: number; maxDepth: number; avgTasteScore: number };
}

export interface ATLASInfiniteMemory {
  upsertWithHierarchy(node: Omit<HierarchicalMemoryNode, 'id'>): Promise<string>;
  queryHierarchical(query: string, options: { level?: string; limit?: number; tasteThreshold?: number }): Promise<HierarchicalMemoryNode[]>;
  migrateLegacyGraphMemory(): Promise<{ migrated: number; failed: number }>;
  getGraph(): InfiniteMemoryGraph;
  pruneStale(olderThanDays: number): Promise<number>;
}
```

### Key Implementation Notes

- 4-level hierarchy: scene (current task) → project → portfolio → lifetime
- `migrateLegacyGraphMemory()` → converts R16 memory format to hierarchical
- Taste Vault scorer ranks memories by relevance to user preferences
- Mem0 adapter for managed memory API, Letta for soul/personality persistence
- Query performance target: <40ms for 1M nodes (mock performance in tests)

### Test Requirements (70 cases)

- Hierarchy creation (scene → project → portfolio → lifetime)
- Query across levels with taste scoring
- Legacy migration (R16 → R23 format)
- Memory pruning and access tracking
- Mem0 adapter round-trip (mocked)
- Letta soul persistence (mocked)
- Edge weight calculation and graph statistics
- Concurrent upsert/query safety

---

## ~~Task 6: KIMI-R23-04 — Agent Debate & Swarm Layer~~ **CUT** (Over-engineered for current stage; expensive multi-model debate before product exists)

---

## Task 7: KIMI-R23-05 — Cinematic Observability & Eval Suite

**Spec**: `.nova/specs/grok-r23-eternal-symphony.md` → R23-05 section
**Tests**: 60 vitest cases minimum

### What to Build

Create `src/observability/` extensions for cinematic tracing and evaluation.

```
src/observability/
├── cinematic-core.ts              ← CinematicObservability class
├── braintrust-adapter.ts          ← Braintrust eval integration
├── langsmith-bridge.ts            ← LangSmith trace integration
├── DirectorsBooth/
│   └── CinematicDailies.tsx       ← React dashboard component (types only)
└── __tests__/cinematic-observability.test.ts
```

### Key Interfaces

```typescript
export interface CinematicSpan {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  agentId: string;
  type: 'agent-call' | 'llm-inference' | 'tool-use' | 'gate-check' | 'user-interaction';
  startTime: string;
  endTime?: string;
  durationMs?: number;
  metadata: Record<string, unknown>;
  tasteVaultScore?: number;
  status: 'running' | 'success' | 'failure';
}

export interface EvalSuite {
  id: string;
  name: string;
  evaluators: Array<{
    name: string;
    type: 'llm-judge' | 'heuristic' | 'human-labeled' | 'taste-vault';
    config: Record<string, unknown>;
  }>;
  dataset: Array<{ input: unknown; expectedOutput: unknown; tags: string[] }>;
  results?: Array<{ score: number; evaluator: string; details: string }>;
}

export interface CinematicObservability {
  recordSpan(span: Omit<CinematicSpan, 'id'>): string;
  endSpan(spanId: string, result: { status: 'success' | 'failure'; metadata?: Record<string, unknown> }): void;
  runEvalSuite(suite: EvalSuite): Promise<{ passed: boolean; scores: Record<string, number>; details: string[] }>;
  renderDirectorDashboard(traceId: string): { spans: CinematicSpan[]; timeline: unknown; tasteVaultSummary: unknown };
  getTraceTree(traceId: string): CinematicSpan[];
}
```

### Key Implementation Notes

- Every agent call, LLM inference, tool use → gets a cinematic span
- Braintrust adapter for eval dataset management and scoring
- LangSmith bridge for distributed trace collection
- Director's dashboard: visual timeline of all spans in a build
- Auto-remediation trigger when taste score drops >8%
- Dashboard component exports types only (UI implementation separate)

### Test Requirements (60 cases)

- Span lifecycle (record → end → query)
- Nested span tree construction
- Eval suite execution with multiple evaluator types
- Braintrust adapter round-trip (mocked)
- LangSmith bridge round-trip (mocked)
- Dashboard rendering from trace data
- Trace fidelity (100% of spans captured)
- Auto-remediation trigger on taste drift

---

## Task 8: KIMI-R24-01 — AI Model Database

**Spec**: `.nova/specs/grok-r24-immortal-omniverse.md` → R24-01 section
**Tests**: 70 vitest cases minimum

### What to Build

Create `src/models/` module for intelligent model selection and management.

```
src/models/
├── index.ts
├── types.ts
├── ai-model-vault.ts              ← AIModelVault class
├── model-router.ts                ← taste-aware semantic routing
├── ensemble-engine.ts             ← multi-model ensemble debates
├── atlas/model-taste-integrator.ts ← taste feedback integration
├── orchestrator/model-spine-adapter.ts ← ralph-loop adapter
└── __tests__/ai-model-vault.test.ts
```

### Key Interfaces

```typescript
export interface ModelMetadata {
  id: string;
  name: string;
  provider: string;
  family: string;
  version: string;
  capabilities: ModelCapabilities;
  contextWindow: number;
  pricing: { inputPerMToken: number; outputPerMToken: number };
  benchmarks: Record<string, number>;
  lastUpdated: string;
}

export interface ModelCapabilities {
  code: number;        // 0-100 capability score
  reasoning: number;
  multimodal: number;
  speed: number;
  cost: number;
  localAvailable: boolean;
  quantizations: string[];
}

export interface ModelRoute {
  agentId: string;
  taskType: string;
  selectedModel: ModelMetadata;
  confidence: number;
  reasoning: string;
  alternatives: ModelMetadata[];
}

export interface JonFeedback {
  routeId: string;
  modelId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  timestamp: string;
}

export interface AIModelVault {
  semanticSelect(agentId: string, taskDescription: string): Promise<ModelRoute>;
  updateAffinity(feedback: JonFeedback): Promise<void>;
  ensembleDebate(models: string[], prompt: string): Promise<{ winner: string; reasoning: string }>;
  syncFromProvider(provider: string): Promise<{ added: number; updated: number }>;
  listModels(filter?: Partial<ModelCapabilities>): ModelMetadata[];
}
```

### Key Implementation Notes

- `semanticSelect()` → Taste Vault-aware model selection based on task semantics
- `updateAffinity()` → Jon's feedback adjusts model preference over time
- `ensembleDebate()` → multiple models compete on same prompt, best wins
- `syncFromProvider()` → fetch latest model metadata from provider APIs (mocked)
- Integrates with R22-01 model-routing module (complementary, not duplicate)
- R22-01 = hardware-aware routing; R24-01 = taste-aware semantic selection

### Test Requirements (70 cases)

- Semantic model selection accuracy across 20+ task types
- Affinity drift tracking (<3% after 100 feedback cycles)
- Ensemble debate scoring fairness
- Provider sync with mocked API responses
- Filter/search across model capabilities
- Model spine adapter integration with ralph-loop
- Cold start with 500 models → <180ms selection
- Hot-swap P99 → <25ms

---

## ~~Task 9: KIMI-R24-02 — Eternal Engine Rust Core~~ **CUT** (No Rust crate exists yet; TS bridge has nothing to bridge)

---

## Task 10: KIMI-R24-03 — Real-time CRDT Collaboration

**Spec**: `.nova/specs/grok-r24-immortal-omniverse.md` → R24-03 section
**Tests**: 65 vitest cases minimum

### What to Build

Create `src/collaboration/` module for real-time multi-user editing with CRDT sync.

```
src/collaboration/
├── index.ts
├── types.ts
├── crdt-core.ts                    ← RealTimeCRDTOrchestrator class
├── yjs-automerge-bridge.ts         ← Yjs/Automerge adapter
├── semantic-resolver.ts            ← AI-powered conflict resolution
├── living-canvas/crdt-visual-sync.ts  ← visual sync for living canvas
├── taste-vault/crdt-taste-sync.ts  ← taste vault CRDT merge
└── __tests__/crdt-collaboration.test.ts
```

### Key Interfaces

```typescript
export interface CRDTDocument {
  id: string;
  type: 'code' | 'design' | 'prd' | 'taste-vault' | 'config';
  content: Uint8Array;  // CRDT-encoded state
  version: number;
  participants: string[];
  lastModified: string;
  conflictCount: number;
}

export interface SemanticCRDTNode {
  id: string;
  path: string;
  value: unknown;
  author: string;
  timestamp: string;
  semanticType: string;  // e.g. "function-body", "style-rule", "config-value"
  conflictResolution?: 'last-writer-wins' | 'semantic-merge' | 'manual';
}

export interface RealTimeCRDTOrchestrator {
  joinSession(documentId: string, userId: string): Promise<CRDTDocument>;
  applyChange(documentId: string, change: Uint8Array): Promise<void>;
  resolveConflict(documentId: string, nodeId: string, resolution: unknown): Promise<void>;
  forkParallelUniverse(documentId: string, name: string): Promise<string>;
  mergeUniverse(sourceId: string, targetId: string): Promise<{ conflicts: number; autoResolved: number }>;
  getParticipants(documentId: string): Promise<string[]>;
}
```

### Key Implementation Notes

- Yjs for text/code CRDT, Automerge for structured data CRDT
- Semantic resolver uses LLM to intelligently merge code conflicts
- "Parallel universe" = branched CRDT state for experimental changes
- Taste Vault CRDT sync ensures preference merges are deterministic
- Living canvas visual sync for real-time design collaboration
- Target: 50 concurrent editors on 10k nodes → zero conflicts

### Test Requirements (65 cases)

- Session join/leave and participant tracking
- Change application and CRDT merge correctness
- Semantic conflict resolution (mocked LLM)
- Parallel universe fork and merge
- Yjs adapter round-trip
- Automerge adapter round-trip
- Taste Vault CRDT deterministic merge
- Concurrent editor simulation (50 users mocked)
- Offline → online sync recovery

---

## ~~Task 11: KIMI-R24-04 — Voice & Multimodal Interface~~ **CUT** (No product to talk to yet; premature without working UI)

---

## Execution Order (Recommended)

Tasks are independent but this order minimizes conflicts:

1. **KIMI-PERP-01** (smallest, standalone)
2. **KIMI-R22-01** (model routing — other tasks reference it)
3. **KIMI-R23-01** (workflow engine — foundation for observability)
4. **KIMI-R23-03** (memory — foundation for model DB)
5. **KIMI-R23-05** (observability — spans all modules)
6. **KIMI-R24-01** (model DB — extends R22-01)
7. **KIMI-R24-03** (CRDT — standalone)

---

## Final Checklist

After implementing all 7 tasks:
1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → all tests pass (target: 440+ new tests)
3. Barrel exports in each `index.ts`
4. No `any` types (use `unknown` + type guards)
5. All I/O mocked in tests (no real API calls, no real hardware detection)
6. ESM `.js` imports throughout
7. Each module has its own `__tests__/` directory with `*.test.ts`
