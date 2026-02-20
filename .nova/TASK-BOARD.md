# NOVA26 TASK BOARD — February 20, 2026

> **5-Agent Terminal System** — Color-coded AI agents building Nova26 in parallel.
> **Repo**: https://github.com/nelsen3000/nova26 | **Branch**: `main`
> **Current state**: 5,690 tests, 0 TS errors, 193 test files
> **Coordinator**: Claude (Red) — evaluates output, writes prompts, resolves conflicts
> **How it works**: Find your section below. Do every task in order. Run quality gates after each task.
> When you finish all tasks, report your results to Jon.

---

## Terminal Agents

| Color | Agent | Model | Strength | Role |
|-------|-------|-------|----------|------|
| — | **Claude** | claude-opus-4-6 | Reasoning, evaluation, architecture | Coordinator — evaluates all output, writes prompts, critical decisions |
| Blue | **Kimi** | kimi-k2 | Fast implementation, bulk output, FREE | Workhorse — new features, CLI commands, tests, high-volume implementation |
| Green | **MiniMax** | minimax-m2.5 | Agent workflows, integration, 205K context | Integrator — wiring modules together, cross-module pipelines, handoff logic |
| Red | **Sonnet** | claude-sonnet-4-6 | Integration testing, hardening, validation | Hardener — end-to-end tests, CI pipeline, documentation, quality sweeps |
| Black | **GLM-5** | z-ai/glm-5 | Complex systems, 745B MoE, deep backend | Architect — refactoring, performance, security, persistence, decomposition |

### Research Agents (on-demand, not terminal)

| Agent | Model | Used For |
|-------|-------|----------|
| **Grok** | grok-4 | Deep TypeScript specs with interfaces + test strategies |
| **Gemini** | gemini-3 | Competitive intelligence, tool audits, ecosystem research |

---

## Rules (ALL agents)

```
TypeScript strict mode         — no implicit any, strict null checks
ESM .js imports everywhere     — import from './foo.js' not './foo' or './foo.ts'
vitest for tests               — describe/it/expect, vi.mock for I/O
No `any` type                  — use `unknown` + type guards instead
Mock all I/O                   — no real network calls, file system, or database in tests
vi.clearAllMocks()             — in every beforeEach block
```

### Quality Gates (run after EVERY task)

```bash
npx tsc --noEmit        # Must be 0 errors
npx vitest run           # Must be 0 failures
```

### Commit Format

```
<type>(<scope>): <description>

Co-Authored-By: <your model name> <noreply@provider.com>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`

---

## KIMI (Blue) — Workhorse Mega Sprint

> **You are the high-volume implementation engine.** You write new features, CLI commands, config validation, and tests.
> **Your superpower**: You're free and fast. You do MORE tasks than anyone else.
> **Do NOT**: Refactor ralph-loop.ts (GLM-5 does that) or wire modules together (MiniMax does that).

### Sprint KIMI-MS-01: CLI + Config + Cleanup (10 tasks, 300+ tests)

**Phase 1: CLI Slash Commands for New Modules**
Each module needs slash commands so developers can interact with it from the CLI. Add commands to `src/cli/slash-commands-extended.ts` or create new command files.

- [x] `KMS-01` `/models` command ✅ (138d1f6)
- [x] `KMS-02` `/workflow` command ✅ (df62f46)
- [x] `KMS-03` `/memory` command ✅ (df62f46)
- [x] `KMS-04` `/observe` command ✅ (df62f46)
- [x] `KMS-05` `/collaborate` command ✅ — start session, show participants, show changes, resolve conflicts. Uses `src/collaboration/crdt-core.ts`. `src/cli/__tests__/collaborate-commands.test.ts` (25 tests)
- [x] `KMS-06` `/research` command ✅ (df62f46)
- [x] `KMS-07` `/route` command ✅ (df62f46)

**Phase 2: Config Validation**

- [x] `KMS-08` Zod schemas for all 7 module configs ✅ (df62f46)

**Phase 3: Codebase `any` Cleanup**

- [x] `KMS-09` Fix `any` types ✅ — replaced with `unknown` + type guards. `src/__tests__/type-safety-audit.test.ts` (15 tests)

**Phase 4: Error Boundaries**

- [x] `KMS-10` Error boundary wrappers ✅ — `src/orchestrator/adapter-error-boundary.ts` with graceful degradation. `src/orchestrator/__tests__/adapter-error-boundary.test.ts` (38 tests)

### Sprint KIMI-MS-02: API Clients + Agent System + Dashboard Data (10 tasks, 250+ tests)

**Phase 5: Mock API Clients for External Services**
Each external service needs a typed client with mock implementation so we can test without real network calls.

- [x] `KMS-11` Braintrust client ✅ (525364d)
- [x] `KMS-12` LangSmith client ✅ — `src/integrations/langsmith-client.ts` (37 tests)
- [x] `KMS-13` Mem0/Letta client ✅ — `src/integrations/memory-providers-client.ts` (36 tests)

**Phase 6: Agent System Enhancements**
The 21 agents need better selection, tracking, and capability awareness.

- [x] `KMS-14` Agent capability matrix ✅ — `src/agents/capability-matrix.ts` (73 tests)
- [x] `KMS-15` Task complexity estimator ✅ — `src/agents/complexity-estimator.ts` (48 tests)
- [x] `KMS-16` Agent performance tracker ✅ — `src/agents/performance-tracker.ts` (30 tests)

**Phase 7: Dashboard Data Layer**
Backend data aggregation for the future dashboard UI.

- [x] `KMS-17` Build metrics aggregator ✅ — `src/analytics/build-metrics.ts` (28 tests)
- [x] `KMS-18` Real-time build status ✅ — `src/analytics/build-status.ts` (36 tests)
- [x] `KMS-19` Historical build comparison ✅ — `src/analytics/build-comparison.ts` (29 tests)

**Phase 8: Notification System**

- [x] `KMS-20` Notification dispatcher ✅ — `src/notifications/dispatcher.ts` (30 tests)

---

## MINIMAX (Green) — Integrator Mega Sprint

> **You are the integration specialist.** You wire modules together, build cross-module pipelines, and make the agent handoff system work.
> **Your superpower**: 205K context window — you can hold the entire ralph-loop.ts + all adapters in context at once.
> **Do NOT**: Create new feature modules (Kimi does that) or refactor core architecture (GLM-5 does that).

### Sprint MX-01: Adapter Wiring + Agent Pipeline (8 tasks, 200+ tests)

**Phase 1: Wire Lifecycle Adapters into Ralph Loop**
The lifecycle adapters exist (`src/<module>/lifecycle-adapter.ts`) but aren't called yet. Wire them into the actual ralph-loop.ts execution flow.

- [x] `MX-01` Wire adapters into `wireFeatureHooks()` ✅ (c0f3c3b — `src/orchestrator/adapter-wiring.ts`)
- [ ] `MX-02` Wire adapters into `processTask()` — in `src/orchestrator/ralph-loop.ts`, ensure the lifecycle hook execution in processTask() flows through to real adapter code when modules are enabled. Add `registry.executePhase()` calls for onBeforeTask, onAfterTask, onTaskError, onHandoff, onBuildComplete. Wire config plumbing so adapter configs reach the adapter constructors. Write `src/orchestrator/__tests__/processtask-adapters.test.ts` (25 tests)

**Phase 2: Cross-Module Event System**
Modules need to communicate. Model routing needs to tell observability what model was selected. Memory needs to know when tasks complete. Build a lightweight event bus.

- [x] `MX-03` Create event bus ✅ (c0f3c3b — `src/orchestrator/event-bus.ts`, 30 tests)
- [ ] `MX-04` Connect modules to event bus — update lifecycle adapters to emit events at key points. Model routing emits `model:selected` after routing. Memory emits `memory:stored` after saving. Observability listens to ALL events for tracing. Write `src/orchestrator/__tests__/event-bus-integration.test.ts` (25 tests)

**Phase 3: Agent Handoff Protocol**
Nova26 has 21 agents that hand off work to each other. The handoff needs to carry context (memory, model selection, workflow state).

- [x] `MX-05` Handoff context builder ✅ (525364d — `src/orchestrator/handoff-context.ts`, 18 tests)
- [x] `MX-06` Handoff receiver ✅ (525364d — `src/orchestrator/handoff-receiver.ts`, 15 tests)

**Phase 4: Configuration Cascade**

- [x] `MX-07` Config resolver ✅ (c0f3c3b — `src/config/config-resolver.ts`, 25 tests)
- [x] `MX-08` Module health check system ✅ (525364d — `src/orchestrator/module-health.ts`, 21 tests)

### Sprint MX-02: Feature Flags + DI + Lazy Loading (4 tasks, 100+ tests)

**Phase 5: Feature Flag System**

- [ ] `MX-09` Feature flag registry — `src/config/feature-flags.ts` with a typed `FeatureFlagRegistry` that manages boolean and variant flags. Flags can be set from env vars (`NOVA26_FF_MODEL_ROUTING=true`), config file (`.nova/flags.json`), or programmatically. Write `src/config/__tests__/feature-flags.test.ts` (25 tests)
- [ ] `MX-10` Flag-controlled module loading — update `wireFeatureHooks()` in `lifecycle-wiring.ts` to check feature flags BEFORE loading adapters. If a flag is off, skip the adapter entirely (don't even import it). Write `src/orchestrator/__tests__/flag-controlled-loading.test.ts` (25 tests)

**Phase 6: Dependency Injection**

- [ ] `MX-11` DI container — `src/orchestrator/di-container.ts` with a simple typed DI container. Modules register themselves with `container.register('modelRouting', factory)`. Other modules resolve dependencies with `container.resolve('modelRouting')`. Supports singletons and transient instances. Write `src/orchestrator/__tests__/di-container.test.ts` (30 tests)
- [ ] `MX-12` Lazy module initialization — update adapters to use lazy initialization. Modules don't initialize until their first lifecycle hook fires. Reduces startup time for builds that don't use all modules. Write `src/orchestrator/__tests__/lazy-init.test.ts` (25 tests)

---

## GLM-5 (Black) — Architect Mega Sprint

> **You are the systems architect.** You refactor complex code, optimize performance, harden security, and build the persistence layer.
> **Your superpower**: 745B parameters of deep reasoning — you handle the hardest engineering problems.
> **Do NOT**: Write new feature modules (Kimi does that) or wire modules together (MiniMax does that).

### Sprint GLM-01: Decompose + Harden + Optimize (7 tasks, 200+ tests)

**Phase 1: Decompose ralph-loop.ts**
`src/orchestrator/ralph-loop.ts` is 1,074 lines — too large. Split it into focused modules.

- [x] `GLM-01` Extract task execution ✅ (27b669a — `src/orchestrator/task-executor.ts`, 35 tests)
- [ ] `GLM-02` Extract build lifecycle — move `startBuild()`, `completeBuild()`, and build-level logic to `src/orchestrator/build-lifecycle.ts`. ralph-loop.ts becomes a thin coordinator that delegates to task-executor and build-lifecycle. Write `src/orchestrator/__tests__/build-lifecycle.test.ts` (25 tests)

**Phase 2: Caching Layer**
Several modules do repeated lookups. Add a proper caching layer.

- [ ] `GLM-03` LRU cache module — `src/cache/lru-cache.ts` with generic typed LRU cache. TTL support, size limits, hit/miss stats. Replace the ad-hoc Map caches in `src/models/model-router.ts` (line 119) and `src/model-routing/router.ts` with this. Write `src/cache/__tests__/lru-cache.test.ts` (30 tests)

**Phase 3: Security Hardening**

- [ ] `GLM-04` Input sanitization — `src/security/input-sanitizer.ts` that validates and sanitizes all external inputs: task descriptions (XSS), file paths (path traversal), config values (injection). Wire into processTask() entry point. Write `src/security/__tests__/input-sanitizer.test.ts` (30 tests)
- [ ] `GLM-05` Secret detection — `src/security/secret-scanner.ts` that scans task outputs and agent responses for accidentally leaked secrets (API keys, tokens, passwords). Regex patterns for common formats (AWS, GitHub, OpenAI, Anthropic keys). Wire into onAfterTask hook. Write `src/security/__tests__/secret-scanner.test.ts` (25 tests)

**Phase 4: Persistence Layer Upgrade**

- [ ] `GLM-06` Migration system — `src/persistence/migration-runner.ts` that manages SQLite schema migrations. Version tracking, up/down migrations, atomic transactions. Replace the raw `db.prepare()` calls in `src/persistence/checkpoint-system.ts` with proper migration-managed schemas. Write `src/persistence/__tests__/migration-runner.test.ts` (30 tests)
- [ ] `GLM-07` Persistence abstraction — `src/persistence/store.ts` with a `Store<T>` interface that abstracts over SQLite, providing type-safe CRUD operations. Use in checkpoint-system, analytics, and memory modules. Write `src/persistence/__tests__/store.test.ts` (25 tests)

---

## SONNET (Red) — Hardener Mega Sprint

> **You are the quality hardener.** You write end-to-end tests, set up CI, write docs, and sweep for quality issues.
> **Your superpower**: Fast, precise, thorough — you catch what others miss.
> **Do NOT**: Create new feature modules (Kimi does that), wire modules (MiniMax does that), or refactor architecture (GLM-5 does that).

### Sprint SN-01: E2E Tests + CI + Docs (8 tasks, 200+ tests)

**Phase 1: End-to-End Build Simulation Tests**
Test the full Ralph Loop pipeline — from PRD input to build completion — verifying all modules participate.

- [x] `SN-01` Full build simulation test ✅ (e3ddc44 — 40 tests)
- [x] `SN-02` Error recovery E2E test ✅ (b7ccb86 — 30 tests)
- [x] `SN-03` Multi-agent handoff E2E test ✅ (2da4f6e — 25 tests)

**Phase 2: CI/CD Pipeline**

- [x] `SN-04` GitHub Actions CI ✅ (cc71cd8)
- [x] `SN-05` Pre-commit hooks ✅ (7ec58ae)

**Phase 3: Documentation**

- [x] `SN-06` CONTRIBUTING.md ✅ (4ac3d1a)
- [x] `SN-07` ARCHITECTURE.md ✅ (9842a26)

**Phase 4: Quality Sweep**

- [x] `SN-08` Dead code elimination ✅ (24dbdf4 — 15 tests)

### Sprint SN-02: Stress Tests + Contract Tests + Coverage (8 tasks, 200+ tests)

**Phase 5: Stress & Load Testing**
Verify the system handles extreme conditions gracefully.

- [ ] `SN-09` Concurrent build stress test — `src/orchestrator/__tests__/stress-concurrent-builds.test.ts`. Simulate 10 builds running simultaneously. Verify no shared state corruption, each build gets isolated lifecycle hooks, memory doesn't leak between builds. (25 tests)
- [ ] `SN-10` Large PRD stress test — `src/orchestrator/__tests__/stress-large-prd.test.ts`. Feed a PRD with 50 tasks to the Ralph Loop. Verify all tasks execute, workflow graph handles large graphs, memory hierarchy stays valid, observability doesn't drop spans. (20 tests)
- [ ] `SN-11` Rapid task failure stress test — `src/orchestrator/__tests__/stress-rapid-failures.test.ts`. Simulate 20 consecutive task failures. Verify circuit breaker activates, recovery hooks fire correctly, error counts are accurate, build terminates gracefully. (20 tests)

**Phase 6: Module Contract Tests**
Verify every module's public API matches its documented interface.

- [ ] `SN-12` Lifecycle adapter contract tests — `src/orchestrator/__tests__/contract-lifecycle-adapters.test.ts`. For each of the 7 adapters: verify createXxxLifecycleHooks() returns correct handler shape, all registered phases have implementations, handlers accept correct context types, handlers don't throw on empty/null inputs. (35 tests)
- [ ] `SN-13` Event payload contract tests — `src/orchestrator/__tests__/contract-event-payloads.test.ts`. Once MiniMax creates the event bus (MX-03), verify all event types have correct payload shapes, payloads serialize/deserialize correctly, invalid payloads are rejected. (20 tests)
- [ ] `SN-14` Config schema contract tests — `src/config/__tests__/contract-config-schemas.test.ts`. Once Kimi creates module schemas (KMS-08), verify all RalphLoopOptions fields have matching Zod schemas, defaults are applied correctly, invalid configs throw descriptive errors. (25 tests)

**Phase 7: Test Infrastructure**

- [ ] `SN-15` Test coverage configuration — add vitest coverage config (`vitest.config.ts` → `coverage` section), set thresholds (statements 70%, branches 60%, functions 70%, lines 70%). Create `npm run test:coverage` script. Write `src/__tests__/coverage-thresholds.test.ts` that verifies critical modules meet thresholds. (15 tests)
- [ ] `SN-16` Test timing reporter — `src/test/timing-reporter.ts`, a vitest reporter plugin that logs slow tests (>500ms), identifies flaky tests (different results on re-run), and generates a timing report. Wire into vitest config. Write `src/test/__tests__/timing-reporter.test.ts` (15 tests)

---

## CLAUDE — Coordinator

> Domain: Evaluation, prompt writing, conflict resolution, architectural decisions
> Does NOT write features (Kimi), wiring (MiniMax), or refactoring (GLM-5)

### Active Responsibilities

- [ ] Evaluate all output from Kimi, MiniMax, GLM-5, and Sonnet as it arrives
- [ ] Fix TS errors in delivered code
- [ ] Resolve merge conflicts between agents
- [ ] Write follow-up sprint prompts as needed
- [ ] Commission Grok/Gemini research when agents need specs

### Pending Evaluation Tasks

- [ ] `CL-35` Evaluate Gemini-07→11 research (when delivered)
- [ ] `CL-44` Evaluate Gemini-12→15 research (when delivered)

---

## Research Agents (On-Demand)

### GROK — Spec Writer
- [ ] `GROK-R22-02` Shannon Patterns Adaptation Spec (Temporal replay + UCB router + WASI sandbox)
- Available for new spec requests from Claude

### GEMINI — Research Intelligence
- [ ] `GEMINI-07` Agent communication protocols & multi-agent UX
- [ ] `GEMINI-08` Developer productivity metrics & benchmarking
- [ ] `GEMINI-09` AI-native testing & quality assurance
- [ ] `GEMINI-10` Enterprise self-hosted deployment
- [ ] `GEMINI-11` AI design systems & component generation
- [ ] `GEMINI-13` Voice & Multimodal AI Interfaces
- [ ] `GEMINI-14` Edge AI & On-Device Inference
- [ ] `GEMINI-15` Real-time Collaboration & CRDT Sync

---

## Completed Work (Archive)

<details>
<summary>Click to expand — 90+ completed tasks across all agents</summary>

### Kimi (55+ tasks)
- R16-01→R16-05, R17-01→R17-12, R19→R21, R22-R24 (7 KEEP modules)
- R25 testing (538 tests), R26 lifecycle adapters (268 tests)
- M-01→M-15 CLI tasks, mega-wiring (W-01→W-05)

### Sonnet (13 tasks)
- S-01-01→06 Integration sprint (RalphLoopOptions dedup, 4 module wiring, sandbox cleanup, failure handler, 45 tests)
- CL-50→56 Hardening sprint (CUT deletion, R22-R24 evaluation, wiring, barrel exports, 51 integration tests)

### Claude (80+ tasks)
- CL-20→CL-56 evaluation + coordination
- C-01→C-10 core engine, R16-05/R17-01/R17-02 implementation (319 tests)
- All agent template conversions, all prompt writing

### Grok (80+ specs)
- R7→R24 feature specs, R18 dashboard/deployment, Shannon research, Perplexity spec

### Kiro (31+ audits)
- KIRO-01→07 pattern extraction (58 patterns), structural audits, quality gates

### Gemini (7 reports)
- GEMINI-01→06 + GEMINI-12 (ecosystem, UX, mobile, monetization, compliance, SLM, model database)

</details>

---

## Dependency Map

```
✅ KIMI KMS-08 ──→ ✅ MINIMAX MX-07 (both done)
✅ MINIMAX MX-01 ──→ MINIMAX MX-02 (MX-01 done, MX-02 ready)
✅ MINIMAX MX-03 ──→ MINIMAX MX-04 (MX-03 done, MX-04 ready)
✅ MINIMAX MX-05 ──→ ✅ MINIMAX MX-06 (both done)
✅ GLM-5 GLM-01 ──→ GLM-5 GLM-02 (GLM-01 done, GLM-02 ready)
✅ SONNET SN-01→SN-08 all complete

Remaining blockers:
  SONNET SN-13 (event payloads) blocked on MX-03 ── UNBLOCKED (MX-03 done)
  SONNET SN-14 (config schemas) blocked on KMS-08 ── UNBLOCKED (KMS-08 done)

Everything else is independent — agents can work in parallel.
```

---

## Coordination Rules

1. **Task board is truth** — every agent finds their section and works top to bottom
2. **Quality gates after every task** — `npx tsc --noEmit` = 0 errors, `npx vitest run` = 0 failures
3. **Report to Jon when done** — Jon routes output to Claude for evaluation
4. **No overlapping files** — each agent owns their domain:
   - Kimi: `src/cli/`, `src/config/module-schemas.ts`, `src/__tests__/type-safety-audit*`, `src/orchestrator/adapter-error-boundary*`
   - MiniMax: `src/orchestrator/event-bus*`, `src/orchestrator/handoff-*`, `src/orchestrator/module-health*`, `src/config/config-resolver*`, adapter wiring in `lifecycle-wiring.ts`
   - GLM-5: `src/orchestrator/task-executor*`, `src/orchestrator/build-lifecycle*`, `src/cache/`, `src/security/`, `src/persistence/`
   - Sonnet: `src/orchestrator/__tests__/e2e-*`, `.github/`, `.husky/`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, `src/__tests__/no-dead-code*`
   - Claude: `.nova/`, `.prompts/`, evaluation only
5. **If you hit a file owned by another agent** — skip that task and move to the next one
6. **Commit after every task** — small, focused commits with descriptive messages
