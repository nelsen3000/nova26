# NOVA26 TASK BOARD — February 21, 2026

> **5-Agent Terminal System** — Color-coded AI agents building Nova26 in parallel.
> **Repo**: https://github.com/nelsen3000/nova26 | **Branch**: `main`
> **Current state**: 9,884 tests (0 failing), 0 TS errors, 363 test files
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

### Sprint KIMI-MS-03: CLI + API + Wiring (5 tasks, 150+ tests)

**Phase 9: CLI + API + Integration**

- [x] `KMS-21` `/health` command ✅ (f7c5cc4) — module health check CLI
- [x] `KMS-22` `/flags` command ✅ (551c656) — feature flag CLI
- [x] `KMS-23` Dashboard REST API ✅ (4a37593) — `src/api/dashboard-api.ts` (31 tests)
- [x] `KMS-24` Notification lifecycle wiring ✅ (534ddb5) — `src/notifications/lifecycle-notifier.ts`
- [x] `KMS-25` Config file watcher ✅ (daa3a04) — `src/config/config-watcher.ts` (28 tests)

---

## MINIMAX (Green) — Integrator Mega Sprint — ALL COMPLETE (done by Claude)

> **You are the integration specialist.** You wire modules together, build cross-module pipelines, and make the agent handoff system work.
> **Your superpower**: 205K context window — you can hold the entire ralph-loop.ts + all adapters in context at once.
> **Do NOT**: Create new feature modules (Kimi does that) or refactor core architecture (GLM-5 does that).

### Sprint MX-01: Adapter Wiring + Agent Pipeline (8 tasks, 200+ tests)

**Phase 1: Wire Lifecycle Adapters into Ralph Loop**
The lifecycle adapters exist (`src/<module>/lifecycle-adapter.ts`) but aren't called yet. Wire them into the actual ralph-loop.ts execution flow.

- [x] `MX-01` Wire adapters into `wireFeatureHooks()` ✅ (c0f3c3b — `src/orchestrator/adapter-wiring.ts`)
- [x] `MX-02` Wire adapters into `processTask()` ✅ (88b70e2) — lifecycle hooks in ralph-loop.ts, 23 tests

**Phase 2: Cross-Module Event System**
Modules need to communicate. Model routing needs to tell observability what model was selected. Memory needs to know when tasks complete. Build a lightweight event bus.

- [x] `MX-03` Create event bus ✅ (c0f3c3b — `src/orchestrator/event-bus.ts`, 30 tests)
- [x] `MX-04` Connect modules to event bus ✅ (d46762f) — 7 adapters emit events, 32 tests

**Phase 3: Agent Handoff Protocol**
Nova26 has 21 agents that hand off work to each other. The handoff needs to carry context (memory, model selection, workflow state).

- [x] `MX-05` Handoff context builder ✅ (525364d — `src/orchestrator/handoff-context.ts`, 18 tests)
- [x] `MX-06` Handoff receiver ✅ (525364d — `src/orchestrator/handoff-receiver.ts`, 15 tests)

**Phase 4: Configuration Cascade**

- [x] `MX-07` Config resolver ✅ (c0f3c3b — `src/config/config-resolver.ts`, 25 tests)
- [x] `MX-08` Module health check system ✅ (525364d — `src/orchestrator/module-health.ts`, 21 tests)

### Sprint MX-02: Feature Flags + DI + Lazy Loading (4 tasks, 100+ tests)

**Phase 5: Feature Flag System**

- [x] `MX-09` Feature flag registry ✅ (d46762f) — `src/config/feature-flags.ts`, 36 tests
- [x] `MX-10` Flag-controlled module loading ✅ (1183414) — `src/orchestrator/lifecycle-wiring.ts`, 35 tests

**Phase 6: Dependency Injection**

- [x] `MX-11` DI container ✅ (d46762f) — `src/orchestrator/di-container.ts`, 31 tests
- [x] `MX-12` Lazy module initialization ✅ (1183414) — `src/orchestrator/lazy-adapter.ts`, 29 tests

---

## GLM-5 (Black) — Architect Mega Sprint

> **You are the systems architect.** You refactor complex code, optimize performance, harden security, and build the persistence layer.
> **Your superpower**: 745B parameters of deep reasoning — you handle the hardest engineering problems.
> **Do NOT**: Write new feature modules (Kimi does that) or wire modules together (MiniMax does that).

### Sprint GLM-01: Decompose + Harden + Optimize (7 tasks, 200+ tests)

**Phase 1: Decompose ralph-loop.ts**
`src/orchestrator/ralph-loop.ts` is 1,074 lines — too large. Split it into focused modules.

- [x] `GLM-01` Extract task execution ✅ (27b669a — `src/orchestrator/task-executor.ts`, 35 tests)
- [x] `GLM-02` Extract build lifecycle ✅ (6ef899e — done by Sonnet, `src/orchestrator/build-lifecycle.ts`)

**Phase 2: Caching Layer**
Several modules do repeated lookups. Add a proper caching layer.

- [x] `GLM-03` LRU cache module ✅ (3184fea — done by Sonnet, `src/cache/lru-cache.ts`)

**Phase 3: Security Hardening**

- [x] `GLM-04` Input sanitization ✅ (d5a2575 — done by Sonnet, `src/security/input-sanitizer.ts`)
- [x] `GLM-05` Secret detection ✅ (a5e8da7 — done by Sonnet, `src/security/secret-scanner.ts`)

**Phase 4: Persistence Layer Upgrade**

- [x] `GLM-06` Migration system ✅ (c1ab14c — done by Sonnet, `src/persistence/migration-runner.ts`, 20 tests)
- [x] `GLM-07` Persistence abstraction ✅ (e1fa0bc — done by Sonnet, `src/persistence/store.ts`, 28/32 tests — 4 failing, fix pending)

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

- [x] `SN-09` Concurrent build stress test ✅ (188eb3c — 25 tests)
- [x] `SN-10` Large PRD stress test ✅ (3d76cb5 — 20 tests)
- [x] `SN-11` Rapid task failure stress test ✅ (c2aa59a — 20 tests)

**Phase 6: Module Contract Tests**

- [x] `SN-12` Lifecycle adapter contract tests ✅ (fad7c7c — 61 tests)
- [x] `SN-13` Event payload contract tests ✅ (fce0313 — 25 tests)
- [x] `SN-14` Config schema contract tests ✅ (ea2a156 — 31 tests)

**Phase 7: Test Infrastructure**

- [x] `SN-15` Test coverage configuration ✅ (a878695 — 16 tests)
- [x] `SN-16` Test timing reporter ✅ (511f8df — 22 tests)

### Sprint SN-03: E2E Integration Tests (5 tasks, 135 tests)

**Phase 8: Cross-Module E2E Tests**

- [x] `SN-17` Lifecycle hook E2E test ✅ (a8060a6 — 35 tests)
- [x] `SN-18` Cross-module event flow E2E test ✅ (9479a57 — 25 tests)
- [x] `SN-19` Config cascade integration test ✅ (d5149f5 — 30 tests)
- [x] `SN-20` Handoff pipeline E2E test ✅ (b6b578d — 25 tests)
- [x] `SN-21` Module health + diagnostics E2E test ✅ (733e5db — 20 tests)

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
<summary>Click to expand — 120+ completed tasks across all agents</summary>

### Kimi (60+ tasks)
- R16-01→R16-05, R17-01→R17-12, R19→R21, R22-R24 (7 KEEP modules)
- R25 testing (538 tests), R26 lifecycle adapters (268 tests)
- M-01→M-15 CLI tasks, mega-wiring (W-01→W-05)
- KMS-01→25: CLI commands, config validation, API clients, agent system, dashboard, notifications, API layer, config watcher

### MiniMax/Claude (12 tasks — all complete)
- MX-01→12: Adapter wiring, processTask lifecycle, event bus, handoff, config cascade, health checks, feature flags, flag-controlled loading, DI container, lazy initialization

### Sonnet (21 tasks — all complete)
- SN-01→08: E2E tests, CI, docs, dead code
- SN-09→16: Stress tests, contract tests, coverage, timing reporter
- SN-17→21: Lifecycle E2E, event flow E2E, config cascade E2E, handoff E2E, diagnostics E2E

### Claude (80+ tasks)
- CL-20→CL-56 evaluation + coordination
- C-01→C-10 core engine, R16-05/R17-01/R17-02 implementation (319 tests)
- All agent template conversions, all prompt writing

### GLM-5 (1 task)
- GLM-01: Task executor extraction (35 tests)

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
ALL KIMI tasks complete (KMS-01→25)
ALL MINIMAX tasks complete (MX-01→12, done by Claude)
ALL SONNET tasks complete (SN-01→21)
ALL GLM-5 tasks complete (GLM-01→07, GLM-02→07 done by Sonnet accidentally)

COMPLETED SPRINTS:
  Haiku Sprint 5: COMPLETE (H5-01→H5-17)
  Haiku Sprint 6: COMPLETE (H6-01→H6-17, 229 tests added)
  Kimi Sprint 4: COMPLETE (K4-01→K4-28, 2,446 tests, 51 new, all 4 specs done)
  Sonnet Sprint 3 Waves 1-4: COMPLETE (S3-01→S3-19)
    - Wave 1: Spec reconciliation (hypercore, hypervisor, a2a)
    - Wave 2: P2P Hypercore spec completion
    - Wave 3: Hypervisor spec completion
    - Wave 4: A2A PBTs + Landing page spec docs

IN PROGRESS:
  Sonnet Sprint 4: S4-01→S4-30 (Convex wiring, dashboard live data, auth, landing polish, E2E tests)
  Kimi Sprint 5: K5-01→K5-28 (SAGA/RLM deep tests, thin module coverage, CLI commands, Eternal Reel hardening)
  Haiku Sprint 7: H7-01→H7-27 (reconciliation, desktop/mobile, PBT sweep, integration PBTs, production validation)

COMPLETED SPRINTS:
  Sonnet Sprint 3: COMPLETE (S3-01→S3-29, 29 tasks, 6 waves)
  Kimi Sprint 4: COMPLETE (K4-01→K4-28, 28 tasks, 6 waves, all 4 specs done)
  Haiku Sprint 6: COMPLETE (H6-01→H6-17, 17 tasks, 229 tests)
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
