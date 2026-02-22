# CUTTING-EDGE SPRINT: "Generation Leap"
## Nova26 — 5 Frontier Upgrades + Model Confidence Meter
### February 2026

---

## 1. Big Vision

These six upgrades push Nova26 from "advanced multi-agent IDE" to "self-optimizing autonomous development platform" — a generation ahead of anything shipping in 2026.

**ALMA** gives every agent a living memory that reshapes itself around Jon's patterns. No more static schemas — the system learns what to remember and how to organize it, like a developer who gets better at note-taking over years.

**Microsoft Agent Framework** replaces the ad-hoc swarm coordination with the industry-standard SDK that unifies Semantic Kernel + AutoGen. Nova26's 21 agents get proper state management, typed skills, filters, and telemetry — the same backbone Microsoft uses for production multi-agent systems.

**WasmEdge + WASI-NN** embeds tiny AI models directly inside the Rust Eternal Engine. Classification, embedding, and gate checks run in microseconds without an Ollama round-trip. The binary stays under 8 MB because WASM modules load on demand.

**Loro CRDT** brings Rust-native, Peritext-aware conflict resolution that's measurably faster than Yjs for rich text and JSON. It slots in as an optional backend alongside the existing CRDT engine, with version-control-like time travel built in.

**Computer-Use Autonomy Layer** gives Nova26 eyes and hands. Goose (open-source, local, Ollama-powered) handles screen vision, mouse/keyboard, app control, and browser automation. Claude 4.5 computer-use and Gemini 3 full-stack are available as paid fallbacks. Every action passes through Taste Vault safety filters and Ralph Loop approval gates.

**Model Confidence Meter** makes all of this visible. A real-time % bar in the Director's Booth shows estimated success likelihood per model for any task — "Local Goose 87% | Claude 4.5 96% | Gemini 3 94%" — powered by ATLAS historical performance data and Taste Vault awareness.

Together: Nova26 remembers better (ALMA), coordinates smarter (Agent Framework), thinks faster (WasmEdge), syncs cleaner (Loro), acts in the real world (Goose), and shows its confidence (Meter). All within the <8 MB binary / <11 MB RAM envelope.

---

## 2. Integration Points

### 2.1 ALMA — Autonomous Long-term Memory Architecture

| Integration Point | File | Hook/Method |
|---|---|---|
| ATLAS Memory Core | `src/atlas/infinite-memory-core.ts` | Extend `InfiniteMemoryStore` with schema evolution |
| ATLAS Graph Memory | `src/atlas/graph-memory.ts` | Add `SchemaNode` type for meta-schema tracking |
| Taste Vault | `src/taste-vault/taste-vault.ts` | `learn()` / `reinforce()` feed ALMA pattern signals |
| Taste Vault Scorer | `src/atlas/memory-taste-scorer.ts` | ALMA relevance scoring replaces static weights |
| Hindsight Engine | `src/hindsight/engine.ts` | ALMA consolidation replaces fixed forgetting curve |
| Ralph Loop | `src/orchestrator/ralph-loop-types.ts` | Add `almaEnabled?: boolean` + `AlmaConfig` |
| Lifecycle Wiring | `src/orchestrator/lifecycle-wiring.ts` | Register ALMA hooks at `onAfterTask` (priority 25) and `onBuildComplete` (priority 30) |
| Agent: ATLAS | `.nova/agents/ATLAS.md` | ATLAS agent gains schema-evolution capability |

**New files:**
- `src/alma/types.ts` — SchemaBlueprint, EvolutionStrategy, UsagePattern, AlmaConfig
- `src/alma/schema-evolver.ts` — analyzes usage patterns, proposes schema mutations
- `src/alma/pattern-detector.ts` — detects recurring access patterns from ATLAS logs
- `src/alma/lifecycle-adapter.ts` — hooks into Ralph Loop lifecycle
- `src/alma/index.ts` — barrel export + `createAlma()` factory

**Acceptance Criteria:**
- [ ] ALMA detects top-5 usage patterns from ATLAS access logs after 10+ builds
- [ ] Schema evolution proposals are validated by Taste Vault before application
- [ ] Memory retrieval latency improves by ≥15% after schema optimization
- [ ] Zero data loss during schema migration (round-trip property test)
- [ ] `almaEnabled: false` completely bypasses all ALMA code paths
- [ ] <0.5 MB added to binary, <1 MB added to RAM at runtime

---

### 2.2 Microsoft Agent Framework Integration

| Integration Point | File | Hook/Method |
|---|---|---|
| Swarm Coordinator | `src/a2a/swarm-coordinator.ts` | Replace with MAF orchestration patterns |
| A2A Router | `src/a2a/router.ts` | MAF typed skills replace ad-hoc routing |
| Ralph Loop | `src/orchestrator/ralph-loop.ts` | MAF agent runtime wraps task execution |
| Agent Templates | `.nova/agents/*.md` | Map to MAF AgentDefinition with typed skills |
| Multi-Model Swarm | `src/swarm/multi-model-swarm.ts` | MAF group chat patterns replace custom swarm |
| Task Negotiator | `src/a2a/task-negotiator.ts` | MAF workflow orchestration |
| Observability | `src/observability/` | MAF telemetry feeds into NovaTracer |
| Tier Config | `src/a2a/tier-config.ts` | MAF filters enforce L0-L3 tier rules |

**New files:**
- `src/maf/types.ts` — MAF adapter types, AgentDefinition, SkillDefinition
- `src/maf/agent-adapter.ts` — wraps Nova26 agent templates as MAF agents
- `src/maf/skill-registry.ts` — maps Nova26 tools to MAF typed skills
- `src/maf/orchestrator.ts` — MAF-based swarm orchestration replacing custom coordinator
- `src/maf/telemetry-bridge.ts` — MAF telemetry → NovaTracer
- `src/maf/lifecycle-adapter.ts` — hooks into Ralph Loop
- `src/maf/index.ts` — barrel export

**Acceptance Criteria:**
- [ ] All 21 agents expressible as MAF AgentDefinitions with typed skills
- [ ] Swarm coordination uses MAF group chat patterns (facilitator/worker)
- [ ] MAF filters enforce existing L0-L3 tier rules without regression
- [ ] MAF telemetry events appear in NovaTracer with correct span nesting
- [ ] Existing A2A tests pass with MAF backend (backward compatible)
- [ ] `mafEnabled: false` falls back to existing swarm coordinator

---

### 2.3 WasmEdge + WASI-NN — Embedded AI in Eternal Engine

| Integration Point | File | Hook/Method |
|---|---|---|
| Eternal Engine Bridge | `src/hypercore/atlas-adapter.ts` | WASM inference for embedding generation |
| Hypervisor Sandbox | `src/hypervisor/sandbox-manager.ts` | WASM sandboxes for model isolation |
| Model Routing | `src/model-routing/router.ts` | Add WASM model tier (fastest, cheapest) |
| Gate Runner | `src/orchestrator/gate-runner.ts` | WASM-based fast gate checks |
| RLM Pipeline | `src/rlm/rlm-pipeline.ts` | WASM compression for small contexts |
| NanoClaw Layer | (new) | WASM runtime management |

**New files:**
- `src/nanoclaw/types.ts` — WasmModelConfig, InferenceRequest, InferenceResult
- `src/nanoclaw/wasm-runtime.ts` — WasmEdge runtime wrapper, model loading, inference
- `src/nanoclaw/model-registry.ts` — registry of available WASM models (classifiers, embedders)
- `src/nanoclaw/gate-accelerator.ts` — fast gate checks via WASM inference
- `src/nanoclaw/lifecycle-adapter.ts` — hooks into Ralph Loop
- `src/nanoclaw/index.ts` — barrel export

**Acceptance Criteria:**
- [ ] WASM models load in <100ms, inference in <10ms for classification tasks
- [ ] Gate checks via WASM are ≥5x faster than Ollama round-trip
- [ ] Total WASM runtime adds <2 MB to binary footprint
- [ ] WASM models run inside Hypervisor sandbox isolation
- [ ] Graceful fallback to Ollama when WASM model unavailable
- [ ] `nanoClawEnabled: false` completely bypasses WASM paths

---

### 2.4 Loro CRDT — Faster Real-time Sync

| Integration Point | File | Hook/Method |
|---|---|---|
| CRDT Core | `src/collaboration/crdt-core.ts` | Loro as optional backend alongside Yjs/Automerge |
| CRDT Engine | `src/collaboration/crdt-engine.ts` | Engine abstraction supports Loro adapter |
| Sync Manager | `src/collaboration/sync-manager.ts` | Loro binary sync protocol |
| Hypercore Bridge | `src/hypercore/crdt-bridge.ts` | Loro ops stored in Hypercore log |
| A2A CRDT Sync | `src/a2a/crdt-sync.ts` | Loro sync over A2A channels |
| RLM CRDT Integration | `src/rlm/crdt-integration.ts` | Loro-aware compression |

**New files:**
- `src/collaboration/loro-adapter.ts` — Loro CRDT adapter implementing CRDTBackend interface
- `src/collaboration/loro-sync.ts` — Loro binary sync protocol handler
- `src/collaboration/backend-factory.ts` — factory that selects Yjs, Automerge, or Loro based on config

**Acceptance Criteria:**
- [ ] Loro adapter passes all existing CRDT collaboration tests
- [ ] Merge performance ≥2x faster than current implementation for 1000+ ops
- [ ] Loro time-travel (version history) accessible via API
- [ ] Peritext-aware rich text merging preserves formatting intent
- [ ] Config switch: `crdtBackend: 'yjs' | 'automerge' | 'loro'` (default: existing)
- [ ] Zero regression when Loro is not selected

---

### 2.5 Computer-Use Autonomy Layer (Goose + Claude + Gemini)

| Integration Point | File | Hook/Method |
|---|---|---|
| Ralph Loop | `src/orchestrator/ralph-loop.ts` | Computer-use tasks routed through autonomy layer |
| Taste Vault | `src/taste-vault/taste-vault.ts` | Safety filter for all computer-use actions |
| Gate Runner | `src/orchestrator/gate-runner.ts` | Approval gate before destructive actions |
| Agent: SUN | `.nova/agents/SUN.md` | SUN can delegate computer-use tasks |
| Model Routing | `src/model-routing/router.ts` | Route to Goose/Claude/Gemini based on task + confidence |
| Observability | `src/observability/` | Screen capture + action log telemetry |
| Autonomy Config | `src/config/autonomy.ts` | Computer-use autonomy levels (1-5) |

**New files:**
- `src/computer-use/types.ts` — ScreenAction, DesktopState, ComputerUseConfig, ActionResult
- `src/computer-use/goose-adapter.ts` — Goose CLI/API wrapper (local, Ollama-powered)
- `src/computer-use/claude-adapter.ts` — Claude 4.5 computer-use API adapter
- `src/computer-use/gemini-adapter.ts` — Gemini 3 full-stack API adapter
- `src/computer-use/action-planner.ts` — decomposes high-level tasks into screen actions
- `src/computer-use/safety-filter.ts` — Taste Vault integration, action classification, blocklist
- `src/computer-use/router.ts` — selects Goose/Claude/Gemini based on confidence + cost + user preference
- `src/computer-use/lifecycle-adapter.ts` — hooks into Ralph Loop
- `src/computer-use/index.ts` — barrel export

**Acceptance Criteria:**
- [ ] Goose adapter executes screen actions via local Ollama (no cloud dependency)
- [ ] Claude 4.5 and Gemini 3 adapters work as paid fallbacks when user selects paid mode
- [ ] ALL actions pass through Taste Vault safety filter before execution
- [ ] Destructive actions (file delete, system settings, purchases) require Ralph Loop approval gate
- [ ] Action log with screenshots stored in observability for audit trail
- [ ] Autonomy levels 1-2: all actions require approval; 3: only destructive; 4-5: auto-approve safe actions
- [ ] `computerUseEnabled: false` completely disables the layer

---

### 2.6 Model Confidence Meter

| Integration Point | File | Hook/Method |
|---|---|---|
| ATLAS Performance Data | `src/agents/performance-tracker.ts` | Historical success rates per model per task type |
| Taste Vault | `src/taste-vault/taste-vault.ts` | Taste-aware confidence adjustment |
| Model Routing | `src/model-routing/router.ts` | Confidence scores feed routing decisions |
| Director's Booth UI | `app/dashboard/` | Real-time confidence bar component |
| Observability | `src/observability/` | Confidence predictions vs actual outcomes |

**New files:**
- `src/confidence/types.ts` — ConfidenceScore, ModelConfidence, TaskConfidenceReport
- `src/confidence/estimator.ts` — estimates success likelihood per model using ATLAS history
- `src/confidence/taste-adjuster.ts` — adjusts confidence based on Taste Vault patterns
- `src/confidence/lifecycle-adapter.ts` — hooks into Ralph Loop at `onBeforeTask`
- `src/confidence/index.ts` — barrel export

**Acceptance Criteria:**
- [ ] Confidence scores computed for all available models before each task
- [ ] Scores use ATLAS historical performance data (success rate, latency, cost)
- [ ] Taste Vault adjusts scores based on learned preferences
- [ ] Director's Booth displays real-time bar: "Local Goose 87% | Claude 4.5 96% | Gemini 3 94%"
- [ ] Confidence predictions tracked against actual outcomes for calibration
- [ ] Meter updates in <200ms when task context changes
- [ ] Works with 0 historical data (falls back to model capability priors)

---

## 3. Sprint Tickets for TASK-BOARD.md

| # | Ticket | Module | Est. Hours | Owner | Priority |
|---|--------|--------|-----------|-------|----------|
| CE-01 | ALMA Pattern Detector + Schema Evolver | `src/alma/` | 12h | Kimi (swarm) | P0 |
| CE-02 | ALMA → ATLAS + Taste Vault + Hindsight Wiring | `src/alma/`, `src/atlas/`, `src/taste-vault/` | 8h | Kimi (swarm) | P0 |
| CE-03 | Computer-Use Goose Adapter + Safety Filter | `src/computer-use/` | 12h | Kimi (swarm) | P1 |
| CE-04 | Computer-Use Claude + Gemini Adapters + Router | `src/computer-use/` | 8h | Kimi (swarm) | P1 |
| CE-05 | Model Confidence Estimator + Taste Adjuster | `src/confidence/` | 8h | Kimi (swarm) | P1 |
| CE-06 | Confidence Meter UI (Director's Booth) | `app/dashboard/` | 6h | Sonnet | P1 |
| CE-07 | Microsoft Agent Framework Adapter Layer | `src/maf/` | 10h | Kimi (swarm) | P2 |
| CE-08 | MAF Swarm Orchestration + Telemetry Bridge | `src/maf/`, `src/a2a/` | 8h | Kimi (swarm) | P2 |
| CE-09 | Loro CRDT Adapter + Sync Protocol | `src/collaboration/` | 8h | Sonnet | P2 |
| CE-10 | WasmEdge NanoClaw Runtime + Model Registry | `src/nanoclaw/` | 12h | Opus (Rust) | P3 |
| CE-11 | NanoClaw Gate Accelerator + Routing Integration | `src/nanoclaw/`, `src/model-routing/` | 8h | Opus (Rust) | P3 |
| CE-12 | Integration Testing + Size/RAM Audit + Final Wiring | all modules | 8h | Haiku | P0 |

**Total: 12 tickets, ~108 hours estimated**

---

## 4. Requirements per Ticket

### CE-01: ALMA Pattern Detector + Schema Evolver

**Requirements:**
1. `PatternDetector` analyzes ATLAS access logs to identify recurring query patterns (top-K by frequency)
2. `SchemaEvolver` proposes schema mutations: add index, merge fields, split collections, archive stale
3. Evolution proposals are serializable JSON with before/after schema diffs
4. Proposals require Taste Vault approval before application (safety gate)
5. Pattern detection runs asynchronously after `onBuildComplete` (non-blocking)
6. All types have Zod schemas. Property tests for schema evolution round-trip.

### CE-02: ALMA → ATLAS + Taste Vault + Hindsight Wiring

**Requirements:**
1. Wire `PatternDetector` into ATLAS `InfiniteMemoryStore` access log stream
2. Wire `SchemaEvolver` proposals through Taste Vault `learn()` for approval
3. Wire approved schema changes into Hindsight consolidation pipeline
4. Add `almaEnabled` flag to `RalphLoopOptions` with lifecycle adapter
5. Register ALMA hooks in `lifecycle-wiring.ts` at correct priorities
6. Integration tests: ALMA detects pattern → proposes schema → Taste Vault approves → schema applied

### CE-03: Computer-Use Goose Adapter + Safety Filter

**Requirements:**
1. `GooseAdapter` wraps Goose CLI/API for local desktop automation via Ollama
2. Supports: screen capture, mouse click, keyboard input, app launch, browser navigation
3. `SafetyFilter` classifies actions as safe/destructive/blocked using Taste Vault patterns
4. Blocked actions: system settings changes, financial transactions, credential access (configurable)
5. All actions logged with before/after screenshots to observability
6. Goose adapter works offline (no cloud dependency)

### CE-04: Computer-Use Claude + Gemini Adapters + Router

**Requirements:**
1. `ClaudeAdapter` wraps Claude 4.5 computer-use API (paid mode only)
2. `GeminiAdapter` wraps Gemini 3 full-stack API (paid mode only)
3. `ComputerUseRouter` selects adapter based on: user preference, confidence score, cost, availability
4. Seamless fallback: Goose → Claude → Gemini (or user-configured order)
5. All adapters implement same `ComputerUseProvider` interface
6. Paid adapters require explicit user opt-in (never auto-select paid)

### CE-05: Model Confidence Estimator + Taste Adjuster

**Requirements:**
1. `ConfidenceEstimator` computes success likelihood per model using ATLAS `performance-tracker.ts` data
2. Inputs: task type, complexity estimate, model capabilities, historical success rate
3. `TasteAdjuster` modifies raw confidence using Taste Vault learned preferences
4. Output: `TaskConfidenceReport` with per-model scores (0-100%), reasoning, and recommended model
5. Works with zero history (Bayesian prior from model capability matrix)
6. Confidence tracked against actual outcomes for calibration (Brier score)

### CE-06: Confidence Meter UI (Director's Booth)

**Requirements:**
1. React component showing horizontal bar chart: one bar per available model
2. Real-time updates as task context changes (<200ms refresh)
3. Color coding: green (>80%), yellow (50-80%), red (<50%)
4. Tooltip shows reasoning: "87% — strong on TypeScript tasks, 94% success rate last 30 days"
5. Click to override: user can force-select any model regardless of confidence
6. Responsive: works on desktop and tablet breakpoints
7. Accessible: ARIA labels, keyboard navigable, screen reader friendly

### CE-07: Microsoft Agent Framework Adapter Layer

**Requirements:**
1. `AgentAdapter` converts Nova26 agent templates (`.nova/agents/*.md`) to MAF `AgentDefinition`
2. `SkillRegistry` maps Nova26 tools to MAF typed skills with input/output schemas
3. MAF agent runtime wraps existing `callModel()` in Ralph Loop
4. All 21 agents expressible as MAF agents without losing capabilities
5. MAF filters enforce existing L0-L3 tier rules
6. Backward compatible: `mafEnabled: false` uses existing code paths

### CE-08: MAF Swarm Orchestration + Telemetry Bridge

**Requirements:**
1. Replace `src/a2a/swarm-coordinator.ts` internals with MAF group chat patterns
2. Facilitator/worker model maps to SUN (facilitator) + specialist agents (workers)
3. MAF state management replaces custom session state
4. `TelemetryBridge` converts MAF telemetry events to NovaTracer spans
5. Existing A2A tests pass with MAF backend
6. Swarm debate (SAGA) works through MAF orchestration

### CE-09: Loro CRDT Adapter + Sync Protocol

**Requirements:**
1. `LoroAdapter` implements `CRDTBackend` interface using `loro-crdt` npm package
2. `LoroSync` handles Loro binary sync protocol for peer-to-peer sync
3. `BackendFactory` selects Yjs, Automerge, or Loro based on `crdtBackend` config
4. Loro time-travel API exposed for version history browsing
5. Peritext-aware rich text merging for agent output formatting
6. All existing CRDT tests pass with Loro backend selected

### CE-10: WasmEdge NanoClaw Runtime + Model Registry

**Requirements:**
1. `WasmRuntime` manages WasmEdge lifecycle: init, load model, inference, cleanup
2. `ModelRegistry` catalogs available WASM models with capabilities and size
3. Supported model types: text classifier, embedding generator, sentiment analyzer
4. Models load on demand (lazy), unload after idle timeout
5. Total WASM footprint <2 MB (models loaded from disk, not bundled)
6. Rust FFI bridge for TypeScript ↔ WasmEdge communication

### CE-11: NanoClaw Gate Accelerator + Routing Integration

**Requirements:**
1. `GateAccelerator` runs quality gate checks via WASM models (≥5x faster than Ollama)
2. Wire into `gate-runner.ts` as first-pass filter before Ollama gates
3. Add WASM model tier to `model-routing/router.ts` (fastest, cheapest, limited capability)
4. Graceful fallback: WASM unavailable → Ollama → cloud API
5. Metrics: track WASM vs Ollama gate check latency in observability

### CE-12: Integration Testing + Size/RAM Audit + Final Wiring

**Requirements:**
1. Integration tests for all 6 features working together
2. Binary size audit: total <8 MB with all features enabled
3. RAM audit: total <11 MB at runtime with all features active
4. All existing ~9000 tests still passing (zero regression)
5. Feature flag matrix test: every combination of enabled/disabled works
6. Performance benchmark: end-to-end build time with all features vs baseline

---

## 5. Trade-offs, Size/RAM Impact, and Test Strategy

### Size/RAM Budget

| Feature | Binary Impact | RAM Impact | Notes |
|---------|-------------|-----------|-------|
| ALMA | +0.3 MB | +0.8 MB | Schema metadata + pattern cache |
| MAF | +0.5 MB | +1.0 MB | MAF SDK + agent definitions |
| WasmEdge | +1.5 MB | +2.0 MB | WASM runtime + model loader (models on disk) |
| Loro | +0.4 MB | +0.5 MB | Loro WASM module (via `loro-crdt` npm) |
| Computer-Use | +0.2 MB | +0.3 MB | Adapter code only (Goose is external process) |
| Confidence | +0.1 MB | +0.2 MB | Estimator + small history cache |
| **TOTAL** | **+3.0 MB** | **+4.8 MB** | **Within 8 MB binary / 11 MB RAM** |

**Current baseline**: ~4.5 MB binary, ~5.5 MB RAM → **After: ~7.5 MB binary, ~10.3 MB RAM** ✅

### Trade-offs

| Decision | Trade-off | Rationale |
|----------|-----------|-----------|
| Goose as primary (not Claude) | Lower capability ceiling | Free, local, private, no API costs, works offline |
| MAF adapter (not full rewrite) | Dual code paths temporarily | Backward compatible, incremental migration, no big-bang risk |
| Loro as optional (not replacement) | Three CRDT backends to maintain | Teams can choose; Loro is new, Yjs is battle-tested |
| WASM models on disk (not bundled) | First-load latency | Keeps binary under 8 MB; models cached after first load |
| ALMA async (not synchronous) | Schema changes delayed | Non-blocking; schema evolution is not time-critical |
| Confidence Bayesian prior | Less accurate with no history | Graceful cold-start; improves with usage |

### Test Strategy

| Layer | Approach | Tool | Count |
|-------|----------|------|-------|
| Unit tests | Every new function/class | vitest | ~200 new tests |
| Property-based tests | Schema evolution, CRDT convergence, confidence calibration | fast-check | ~30 PBTs |
| Integration tests | Cross-module wiring (ALMA→ATLAS, Goose→TasteVault, MAF→A2A) | vitest | ~40 tests |
| Size/RAM audit | Binary size check, heap snapshot | custom script | 2 tests |
| Feature flag matrix | All on, all off, each individually | vitest | 12 tests |
| Regression | Full existing suite | vitest | ~9000 existing |
| E2E smoke | Full build with all features enabled | vitest | 5 tests |

**Total new tests: ~290**

---

## 6. Prioritization Order

```
P0 — ALMA (CE-01, CE-02)           ← Memory is the foundation everything else builds on
P0 — Integration Audit (CE-12)     ← Size/RAM gate must be validated continuously
P1 — Goose Layer (CE-03, CE-04)    ← Highest user-visible impact, enables desktop autonomy
P1 — Confidence Meter (CE-05, CE-06) ← Makes model selection transparent, feeds Goose routing
P2 — MAF (CE-07, CE-08)            ← Swarm coordination upgrade, not blocking other features
P2 — Loro (CE-09)                  ← Performance upgrade, existing CRDT works fine
P3 — WasmEdge (CE-10, CE-11)       ← Rust dependency, longest lead time, highest risk
```

### Execution Order (Dependency-Aware)

```
Week 1: CE-01 → CE-02 → CE-05 → CE-03
Week 2: CE-04 → CE-06 → CE-07 → CE-08
Week 3: CE-09 → CE-10 → CE-11 → CE-12
```

---

## 7. Next Actions — Worker Assignments

| Ticket | Assigned To | Rationale |
|--------|------------|-----------|
| CE-01 | **Kimi** (Moonshot swarm) | High-volume implementation, pattern detection is bulk TypeScript |
| CE-02 | **Kimi** (Moonshot swarm) | Wiring into existing modules Kimi already knows from Sprint 3 |
| CE-03 | **Kimi** (Moonshot swarm) | Goose adapter + safety filter is TypeScript + CLI integration |
| CE-04 | **Kimi** (Moonshot swarm) | Claude/Gemini API adapters are straightforward typed clients |
| CE-05 | **Kimi** (Moonshot swarm) | Confidence estimator is pure TypeScript logic + ATLAS queries |
| CE-06 | **Sonnet** (Claude Sonnet 4.6) | React UI component, Tailwind, shadcn/ui — Sonnet's domain |
| CE-07 | **Kimi** (Moonshot swarm) | MAF adapter layer is bulk TypeScript mapping |
| CE-08 | **Kimi** (Moonshot swarm) | Swarm orchestration replacement, Kimi knows A2A from Sprint 2 |
| CE-09 | **Sonnet** (Claude Sonnet 4.6) | Loro CRDT integration, Sonnet built the collaboration module |
| CE-10 | **Opus** (Claude Opus 4.6 / Rust) | WasmEdge is Rust FFI, needs deep systems knowledge |
| CE-11 | **Opus** (Claude Opus 4.6 / Rust) | Gate accelerator + routing integration, Rust bridge |
| CE-12 | **Haiku** (Claude Haiku) | Integration testing + size audit — Haiku's specialty |

### Research Assignment

| Task | Assigned To |
|------|------------|
| Goose API documentation + MCP integration patterns | **Perplexity** |
| Microsoft Agent Framework TypeScript SDK reference | **Perplexity** |
| Loro CRDT npm package API + migration from Yjs | **Perplexity** |
| WasmEdge WASI-NN TypeScript FFI patterns | **Perplexity** |
| Claude 4.5 computer-use API reference | **Perplexity** |
| Gemini 3 full-stack API reference | **Perplexity** |

---

## Summary

This sprint adds 6 frontier capabilities to Nova26 while staying within the <8 MB binary / <11 MB RAM envelope. ALMA makes memory self-optimizing. MAF brings industry-standard swarm coordination. WasmEdge embeds AI inference in the engine. Loro accelerates real-time sync. Goose gives Nova26 desktop autonomy with Claude/Gemini as paid fallbacks. The Confidence Meter makes it all visible and trustworthy.

12 tickets. ~108 hours. ~290 new tests. Zero regressions. One generation ahead.

---

**Send this plan to Perplexity for PR: Add CUTTING-EDGE-SPRINT.md and update TASK-BOARD.md**
