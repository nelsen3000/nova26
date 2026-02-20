# NOVA26 TASK BOARD — February 20, 2026

> **5-Agent Terminal System** — Color-coded AI agents building Nova26 in parallel.
> **Repo**: https://github.com/nelsen3000/nova26 | **Branch**: `main`
> **Current state**: 4,871 tests, 0 TS errors, 433 source files, 155K lines
> **Coordinator**: Claude (Red) — evaluates output, writes prompts, resolves conflicts
> **How it works**: Find your section below. Do every task in order. Run quality gates after each task.
> When you finish all tasks, report your results to Jon.

---

## Terminal Agents

| Color | Agent | Model | Strength | Role |
|-------|-------|-------|----------|------|
| Red | **Claude** | claude-opus-4-6 | Reasoning, evaluation, architecture | Coordinator — evaluates all output, writes prompts, critical decisions |
| Blue | **Kimi** | kimi-k2 | Fast implementation, bulk output, FREE | Workhorse — new features, CLI commands, tests, high-volume implementation |
| Green | **MiniMax** | minimax-m2.5 | Agent workflows, integration, 205K context | Integrator — wiring modules together, cross-module pipelines, handoff logic |
| White | **Sonnet** | claude-sonnet-4-6 | Integration testing, hardening, validation | Hardener — end-to-end tests, CI pipeline, documentation, quality sweeps |
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

- [ ] `KMS-01` `/models` command — list models, show model details, compare models, run ensemble debate. Uses `src/models/ai-model-vault.ts` and `src/models/ensemble-engine.ts`. Write `src/cli/__tests__/models-commands.test.ts` (25 tests)
- [ ] `KMS-02` `/workflow` command — show workflow graph, list nodes, show critical path, export as JSON. Uses `src/workflow-engine/ralph-visual-engine.ts`. Write `src/cli/__tests__/workflow-commands.test.ts` (25 tests)
- [ ] `KMS-03` `/memory` command — query memory, show hierarchy, show stats, prune stale nodes. Uses `src/atlas/infinite-memory-core.ts`. Write `src/cli/__tests__/memory-commands-v2.test.ts` (25 tests)
- [ ] `KMS-04` `/observe` command — show active traces, list spans, show build report, configure backends. Uses `src/observability/cinematic-core.ts`. Write `src/cli/__tests__/observe-commands.test.ts` (20 tests)
- [ ] `KMS-05` `/collaborate` command — start session, show participants, show changes, resolve conflicts. Uses `src/collaboration/crdt-core.ts`. Write `src/cli/__tests__/collaborate-commands.test.ts` (20 tests)
- [ ] `KMS-06` `/research` command — search, deep research, show cache, clear cache. Uses `src/tools/perplexity/perplexity-agent.ts`. Write `src/cli/__tests__/research-commands.test.ts` (20 tests)
- [ ] `KMS-07` `/route` command — route task to model, show routing table, show hardware, show affinity scores. Uses `src/model-routing/router.ts`. Write `src/cli/__tests__/route-commands.test.ts` (20 tests)

**Phase 2: Config Validation**

- [ ] `KMS-08` Zod schemas for all 7 new module configs — create `src/config/module-schemas.ts` with Zod validators for `ModelRoutingConfig`, `PerplexityToolConfig`, `WorkflowEngineOptions`, `InfiniteMemoryModuleConfig`, `CinematicConfig`, `AIModelDatabaseModuleConfig`, `CRDTCollaborationModuleConfig`. Write `src/config/__tests__/module-schemas.test.ts` (40 tests — valid configs, invalid configs, edge cases, defaults)

**Phase 3: Codebase `any` Cleanup**

- [ ] `KMS-09` Fix 80+ `any` types in `src/memory/`, `src/cli/`, `src/analytics/`, `src/persistence/`, `src/agents/` — replace with `unknown` + type guards or proper types. Currently 144 `any` across 43 files. Target: reduce to < 30 (keep only justified `as any` in test mocks). Write `src/__tests__/type-safety-audit.test.ts` (15 tests verifying type guard functions work)

**Phase 4: Error Boundaries**

- [ ] `KMS-10` Error boundary wrappers for all 7 lifecycle adapters — create `src/orchestrator/adapter-error-boundary.ts` that wraps adapter calls with try/catch, logging, and graceful degradation. If an adapter throws, the build continues (adapter errors are non-fatal). Write `src/orchestrator/__tests__/adapter-error-boundary.test.ts` (30 tests)

---

## MINIMAX (Green) — Integrator Mega Sprint

> **You are the integration specialist.** You wire modules together, build cross-module pipelines, and make the agent handoff system work.
> **Your superpower**: 205K context window — you can hold the entire ralph-loop.ts + all adapters in context at once.
> **Do NOT**: Create new feature modules (Kimi does that) or refactor core architecture (GLM-5 does that).

### Sprint MX-01: Adapter Wiring + Agent Pipeline (8 tasks, 200+ tests)

**Phase 1: Wire Lifecycle Adapters into Ralph Loop**
The lifecycle adapters exist (`src/<module>/lifecycle-adapter.ts`) but aren't called yet. Wire them into the actual ralph-loop.ts execution flow.

- [ ] `MX-01` Wire adapters into `wireFeatureHooks()` — in `src/orchestrator/lifecycle-wiring.ts`, replace the stub/no-op handlers with actual calls to `createXxxLifecycleHooks()` from each adapter file. Import all 7 adapters, call them with their config from RalphLoopOptions, register the returned handlers. Write `src/orchestrator/__tests__/adapter-wiring-live.test.ts` (30 tests)
- [ ] `MX-02` Wire adapters into `processTask()` — in `src/orchestrator/ralph-loop.ts`, ensure the lifecycle hook execution in processTask() flows through to real adapter code when modules are enabled. Add config plumbing so adapter configs reach the adapter constructors. Write `src/orchestrator/__tests__/processtask-adapters.test.ts` (25 tests)

**Phase 2: Cross-Module Event System**
Modules need to communicate. Model routing needs to tell observability what model was selected. Memory needs to know when tasks complete. Build a lightweight event bus.

- [ ] `MX-03` Create event bus — `src/orchestrator/event-bus.ts` with typed events: `model:selected`, `task:started`, `task:completed`, `task:failed`, `memory:stored`, `workflow:transitioned`, `collaboration:changed`. Pub/sub with type-safe payloads. Write `src/orchestrator/__tests__/event-bus.test.ts` (30 tests)
- [ ] `MX-04` Connect modules to event bus — update lifecycle adapters to emit events at key points. Model routing emits `model:selected` after routing. Memory emits `memory:stored` after saving. Observability listens to ALL events for tracing. Write `src/orchestrator/__tests__/event-bus-integration.test.ts` (25 tests)

**Phase 3: Agent Handoff Protocol**
Nova26 has 21 agents that hand off work to each other. The handoff needs to carry context (memory, model selection, workflow state).

- [ ] `MX-05` Handoff context builder — `src/orchestrator/handoff-context.ts` that assembles a `HandoffPayload` from all active modules: current workflow node, memory context, model routing state, active collaboration session. Write `src/orchestrator/__tests__/handoff-context.test.ts` (25 tests)
- [ ] `MX-06` Handoff receiver — `src/orchestrator/handoff-receiver.ts` that unpacks a `HandoffPayload` and initializes the receiving agent's module state: restore memory context, apply model routing preferences, sync collaboration state. Write `src/orchestrator/__tests__/handoff-receiver.test.ts` (25 tests)

**Phase 4: Configuration Cascade**

- [ ] `MX-07` Config resolver — `src/config/config-resolver.ts` that merges configs from 3 sources: environment variables → config file (`.nova/config.json`) → RalphLoopOptions defaults. Type-safe, with Zod validation at each layer. Write `src/config/__tests__/config-resolver.test.ts` (25 tests)
- [ ] `MX-08` Module health check system — `src/orchestrator/module-health.ts` that pings each enabled module's adapter to verify it's operational. Returns a health report with status per module. Wire into `/health` CLI command. Write `src/orchestrator/__tests__/module-health.test.ts` (20 tests)

---

## GLM-5 (Black) — Architect Mega Sprint

> **You are the systems architect.** You refactor complex code, optimize performance, harden security, and build the persistence layer.
> **Your superpower**: 745B parameters of deep reasoning — you handle the hardest engineering problems.
> **Do NOT**: Write new feature modules (Kimi does that) or wire modules together (MiniMax does that).

### Sprint GLM-01: Decompose + Harden + Optimize (7 tasks, 200+ tests)

**Phase 1: Decompose ralph-loop.ts**
`src/orchestrator/ralph-loop.ts` is 1,074 lines — too large. Split it into focused modules.

- [ ] `GLM-01` Extract task execution — move `processTask()` and its helpers to `src/orchestrator/task-executor.ts`. Keep the main loop in ralph-loop.ts, but delegate task execution. Preserve all existing behavior. Write `src/orchestrator/__tests__/task-executor.test.ts` (35 tests)
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

## SONNET (White) — Hardener Mega Sprint

> **You are the quality hardener.** You write end-to-end tests, set up CI, write docs, and sweep for quality issues.
> **Your superpower**: Fast, precise, thorough — you catch what others miss.
> **Do NOT**: Create new feature modules (Kimi does that), wire modules (MiniMax does that), or refactor architecture (GLM-5 does that).

### Sprint SN-01: E2E Tests + CI + Docs (8 tasks, 200+ tests)

**Phase 1: End-to-End Build Simulation Tests**
Test the full Ralph Loop pipeline — from PRD input to build completion — verifying all modules participate.

- [ ] `SN-01` Full build simulation test — `src/orchestrator/__tests__/e2e-build-simulation.test.ts`. Mock a complete build with 5 tasks, verify lifecycle hooks fire in order, all adapters get called, workflow graph updates, memory stores results, observability traces complete. (40 tests)
- [ ] `SN-02` Error recovery E2E test — `src/orchestrator/__tests__/e2e-error-recovery.test.ts`. Simulate builds where tasks fail at different stages. Verify recovery hooks fire, circuit breakers activate, error paths in all adapters handle gracefully, build completes with partial results. (30 tests)
- [ ] `SN-03` Multi-agent handoff E2E test — `src/orchestrator/__tests__/e2e-handoff.test.ts`. Simulate SUN → EARTH → MARS → VENUS agent chain. Verify context passes between agents, model routing adjusts per agent, memory accumulates across handoffs. (25 tests)

**Phase 2: CI/CD Pipeline**

- [ ] `SN-04` GitHub Actions CI — `.github/workflows/ci.yml`. Matrix: Node 20/22, runs `tsc --noEmit` + `vitest run` + coverage report. Cache node_modules. Fail on any TS error or test failure. Add status badge to README. (no test file — verify by pushing)
- [ ] `SN-05` Pre-commit hooks — `.husky/pre-commit` with lint-staged. Run `tsc --noEmit` on changed `.ts` files. Run vitest on changed test files only (fast feedback). Create `package.json` scripts: `lint`, `typecheck`, `test:changed`. (no test file — verify by committing)

**Phase 3: Documentation**

- [ ] `SN-06` CONTRIBUTING.md — how to add a new module (create src/module/, types.ts, index.ts, lifecycle-adapter.ts, __tests__/), how to wire it (RalphLoopOptions, lifecycle-wiring.ts, event bus), coding standards, commit format, quality gates.
- [ ] `SN-07` ARCHITECTURE.md — system overview diagram (ASCII), module dependency graph, Ralph Loop execution flow, lifecycle hook phases, agent roster, key file paths. Keep it under 200 lines.

**Phase 4: Quality Sweep**

- [ ] `SN-08` Dead code elimination — find and remove unused exports, unreachable functions, orphaned test helpers across the entire codebase. Use `npx tsc --noEmit` + grep for unexported functions. Report what was removed. Write `src/__tests__/no-dead-code.test.ts` (15 tests verifying key exports exist)

---

## CLAUDE (Red) — Coordinator

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
KIMI KMS-08 (config schemas) ──→ MINIMAX MX-07 (config resolver uses schemas)
MINIMAX MX-01 (wire adapters) ──→ MINIMAX MX-02 (processTask needs wired adapters)
MINIMAX MX-03 (event bus) ──→ MINIMAX MX-04 (modules connect to bus)
MINIMAX MX-05 (handoff builder) ──→ MINIMAX MX-06 (handoff receiver)
GLM-5 GLM-01 (extract task-executor) ──→ GLM-5 GLM-02 (extract build-lifecycle)
GLM-5 GLM-03 (LRU cache) ──→ independent, no blockers

SONNET SN-01/02/03 depend on MiniMax MX-01/02 (adapters must be wired first)
SONNET SN-04/05/06/07/08 are independent — can start immediately

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
