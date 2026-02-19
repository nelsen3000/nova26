# GROK-R18: Nova26 Dashboard, Deployment & Integration Architecture

> Assigned to: Grok
> Round: R18 (post-R17)
> Date issued: 2026-02-19
> Status: Active

---

## Context Brief

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. The engine is
feature-complete: 17 R16/R17 feature modules exist with 2,642+ tests, 0 TypeScript errors, and
a 4-job CI pipeline. The agent orchestrator (Ralph Loop) works. The Convex backend has 14 tables.
140 knowledge patterns are validated. The core is solid.

**What's missing is everything around the core:**
- No dashboard UI exists (0/15 tasks started)
- No deployment story (no `npx nova26 init`, no Docker, no Vercel config)
- No IDE integration (CLI only)
- No lint/prettier config (zero style enforcement)
- 11 of 21 agent templates still in legacy format (not EARTH XML)
- 13 of 17 feature modules are dead code — implemented but never invoked by the orchestrator

**Current tech stack:**
- TypeScript 5.9, ESM modules, vitest 4.0
- Ollama (local LLM), OpenAI (cloud LLM)
- Convex 1.31 (cloud DB + real-time subscriptions)
- React 19, Tremor 3.18 (charts), Recharts 3.7, Framer Motion 11
- BullMQ + ioredis (job queues), better-sqlite3 (local persistence)
- Langfuse 3.38 (LLM observability), ts-morph 27 (AST)
- fast-check 4.5 (property tests), promptfoo 0.120 (LLM eval)

**Existing Convex tables (14):**
- ATLAS: builds, patterns, agents, tasks, executions, learnings
- UA Dashboard: companies, chipAccounts, divisions, companyAgents
- Global Wisdom: globalPatterns, userProfiles, wisdomUpdates, agentActivityFeed

**R18 mission:** Spec the presentation, deployment, and integration layers that turn the engine
into a shippable product. Each spec must be independently actionable by a code-implementing AI
(Kimi) working from your interfaces alone. Concrete TypeScript interfaces, file paths, and
integration points are mandatory.

**Your style:** Open each deliverable with a tight, concrete analogy (one paragraph). Then go
deep: concrete TypeScript interfaces with every field documented, integration points with named
files, CLI commands, and open questions. Every spec must be implementable in a 5-task sprint.

---

## Deliverables

Label each section clearly: GROK-R18-01, GROK-R18-02, etc.

---

### GROK-R18-01: Real-Time Dashboard Architecture (Next.js 15 + Convex)

**Scope:** The Nova26 monitoring dashboard — a Next.js 15 App Router application that provides
real-time visibility into builds, agent activity, cost tracking, and project health.

**Must cover:**
- Next.js 15 App Router layout: sidebar navigation, route structure, page components
- Convex real-time subscriptions: which tables to subscribe, how to wire useQuery/useMutation
- Component library: Tremor 3.18 for charts, shadcn/ui for primitives, Framer Motion for transitions
- Pages to spec (matching K-01 through K-15 from the task board):
  1. Monitor page — real-time task status kanban (pending/running/done/failed)
  2. Agent Output Viewer — click task to see LLM output, prompt, gate results
  3. PRD Editor — visual task editor with dependency arrows
  4. Cost Dashboard — token usage charts per agent/model/day
  5. Agent Explainer Panel — view any agent's template, hard limits, success rate
  6. Plan Visualization — Ralph Loop planning phases as interactive timeline
  7. Project Health — aggregate scores from src/health/ module
- Command Palette (Cmd+K) for navigation
- Responsive design constraints (mobile + tablet + desktop)
- Dark mode + light mode with system preference detection
- Error boundaries + loading skeletons
- TypeScript interfaces for all page props, Convex query return types, component props

**Integration points:**
- `convex/schema.ts` — existing 14 tables
- `convex/atlas.ts` — build/task/execution queries
- `src/health/health-dashboard.ts` — HealthDashboard class
- `src/cost/cost-tracker.ts` — CostTracker class
- `src/orchestrator/ralph-loop.ts` — RalphLoopOptions, build lifecycle

**Open questions:**
- Should the dashboard be a separate package or live inside the Nova26 monorepo?
- Should it use Convex's built-in auth or a separate auth layer?
- Should it support multi-project views or single-project only?

---

### GROK-R18-02: Deployment & Infrastructure

**Scope:** Everything needed to go from `git clone` to running Nova26 in production.

**Must cover:**
- `npx nova26 init` one-command setup: install deps, prompt for env vars, index repo, verify Ollama
- Docker Compose setup: Nova26 engine + Ollama + Redis (for BullMQ) in containers
- Vercel deployment config for the dashboard (from GROK-R18-01)
- Convex deployment: `convex deploy` integration, preview deployments
- Environment management: `.env.example`, required vs optional vars, validation at startup
- Health checks: readiness and liveness probes for containerized deployment
- Ollama model management: auto-pull required models on first run
- Migration strategy: how to upgrade between Nova26 versions without losing state
- Backup/restore: export and import `.nova/` directory state

**Integration points:**
- `src/env/environment-manager.ts` — EnvironmentManager class (R17-11)
- `src/config/` — existing config system
- `src/init/` — AdvancedInitConfig (R17-02)
- `package.json` scripts section
- `.github/workflows/ci.yml` — extend for CD

**Open questions:**
- Should Ollama be required or should there be a cloud-only mode (OpenAI/Anthropic)?
- What's the minimum viable self-hosted setup?
- Should Nova26 support running as a daemon/service?

---

### GROK-R18-03: VS Code Extension Architecture

**Scope:** A VS Code extension that brings Nova26 into the editor — inline agent suggestions,
build status in the status bar, command palette integration, and a webview panel for the dashboard.

**Must cover:**
- Extension activation events and lifecycle
- Command registration: mirror all CLI `/commands` as VS Code commands
- Status bar items: current build status, test count, cost tracker
- Webview panel: embed the Next.js dashboard (from R18-01) or a lightweight version
- Inline decorations: agent suggestions as CodeLens or inline hints
- Diagnostics provider: wire ENCELADUS security findings as VS Code problems
- Tree view: agent status, active build tasks, pattern library browser
- Settings contribution: VS Code settings UI for Nova26 config
- Communication: how the extension talks to the Nova26 engine (stdio, HTTP, WebSocket?)
- Packaging: VSIX build, marketplace publishing, auto-update

**Integration points:**
- `src/cli/` — existing CLI commands to mirror
- `src/orchestrator/ralph-loop.ts` — build lifecycle events
- `src/agents/` — agent status for tree view
- `src/security/security-scanner.ts` — findings for diagnostics

**Open questions:**
- Should the extension bundle its own Nova26 engine or connect to a running instance?
- Should it support remote development (SSH, WSL, Codespaces)?
- What's the minimum VS Code version to target?

---

### GROK-R18-04: Orchestrator Integration Layer

**Scope:** The missing wiring layer that connects all 17 R16/R17 feature modules to the Ralph Loop
orchestrator. Currently 13 of 17 features are implemented but never invoked.

**Must cover:**
- For EACH of the 13 unwired modules, specify:
  - The config type to import (e.g., `PortfolioConfig from '../portfolio/index.js'`)
  - The `enabled` + `config` fields to add to `RalphLoopOptions`
  - WHERE in the Ralph Loop lifecycle it activates (before planning? during execution? after build?)
  - HOW it hooks in (called by which function, receives what data, returns what)
- Module activation map:
  - **Pre-build:** portfolio (load cross-project insights), env (validate environment)
  - **During planning:** review (analyze existing code before changes), debt (score before refactor)
  - **During execution:** debug (on error), migrate (on framework task), a11y (on UI task)
  - **Post-task:** testing (run tests), deps (check new dependencies)
  - **Post-build:** health (generate report), prod-feedback (collect metrics), orchestration (meta-learn)
  - **On-demand:** generative-ui (when UI generation requested)
- Type-safe integration: every module gets a typed config, typed input, typed output
- Feature flag pattern: all modules disabled by default, opt-in via config
- Cross-module communication: which modules should share data (e.g., debt → review, debug → recovery)

**Integration points:**
- `src/orchestrator/ralph-loop.ts` — RalphLoopOptions interface (lines 42-79)
- All 13 module index.ts files — their exported config types and factory functions
- `src/orchestrator/prompt-builder.ts` — context injection

**This is the most critical R18 spec** — without it, 76% of the feature modules remain dead code.

---

### GROK-R18-05: Production Observability & Developer Experience

**Scope:** The monitoring, logging, and DX polish layer that makes Nova26 production-ready.

**Must cover:**
- Langfuse integration: structured traces for every LLM call, agent execution, build lifecycle
- Structured logging: consistent log format across all modules, log levels, log rotation
- Metrics collection: agent success rates, build times, token usage, cache hit rates
- Alerting: configurable alerts for budget exceeded, build failures, circuit breaker trips
- Developer CLI polish:
  - `nova26 status` — one-screen overview of project health
  - `nova26 doctor` — diagnose environment issues (Ollama running? Convex connected? Models pulled?)
  - `nova26 benchmark` — run perf benchmarks and compare to previous runs
- ESLint + Prettier config for the Nova26 codebase itself (currently none)
- Git hooks: pre-commit (lint + type-check), commit-msg (conventional commits)

**Integration points:**
- `src/observability/` — existing observability module
- `src/health/health-dashboard.ts` — HealthDashboard class
- `src/cost/cost-tracker.ts` — CostTracker
- `src/cli/` — CLI command registration
- `package.json` — scripts section
- `.github/workflows/ci.yml` — extend with lint job

**Open questions:**
- Should observability data go to Convex, Langfuse, or both?
- What's the right log retention policy?
- Should there be a `nova26 debug` mode that enables verbose logging?

---

## Output Format

Deliver all 5 specs in a single response. For each spec:
1. Open with a one-paragraph analogy
2. TypeScript interfaces (complete, every field documented)
3. File-by-file implementation plan (which files to create/modify)
4. Integration points (exact file paths and function names)
5. CLI commands (if applicable)
6. Open questions
7. Test strategy (what to test, approximate test count)

Total expected output: ~15,000-20,000 words across all 5 specs.
