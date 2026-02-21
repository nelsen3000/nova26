# NOVA26 — 24-HOUR SPRINT BATTLE PLAN
## February 20, 2026 (Friday) — Ship Day

> **Goal**: Get Nova26 from ~35% shippable to a working demo in 24 hours.
> **Coordinator**: Kiro (Opus 4.6) — planning only, no coding
> **Coding Workers**: 8 (Sonnet 4.6, Haiku 4, Kimi 2.5, DeepSeek V3.2, Qwen 3 Coder, GLM 5, Mistral Large, Llama 4 Maverick)
> **Browser Agents**: 4 (Perplexity, Grok 4.2, ChatGPT 5.2, Gemini 3.1)
> **Repo**: https://github.com/nelsen3000/nova26
> **Current state**: 4,007 tests, 0 TS errors, 151 test files, core engine ~85% done

---

## REALITY CHECK — What "Done" Means in 24 Hours

You can't ship 77 features in a day. Here's what you CAN ship:

**The MVP Demo**: A working Next.js app that connects to Convex, has auth, a dashboard showing agent activity, and the core engine running tasks end-to-end. Landing page already exists. Core engine already works. The gap is the middle: dashboard UI + Convex deployment + auth + wiring it all together.

**Wave 1 (Hours 0-8)**: MVP — project wiring, auth, dashboard UI, Convex functions, deployment
**Wave 2 (Hours 8-16)**: R22 features — Perplexity integration, model routing
**Wave 3 (Hours 16-24)**: R23/R24 features — Visual Workflow, Infinite Memory, Observability, AI Model DB, CRDT Collaboration (as far as we get)

---

## CRITICAL PATH (in priority order)

| # | Task | Why It's Critical | Hours | Worker |
|---|------|-------------------|-------|--------|
| 1 | Next.js + Convex project wiring | Nothing works without this | 2h | Sonnet 4.6 |
| 2 | Auth (Convex Auth) | Can't have users without auth | 2h | Sonnet 4.6 |
| 3 | Dashboard UI shell | The product IS the dashboard | 4h | DeepSeek V3.2 |
| 4 | Convex functions (queries/mutations) | Dashboard needs data | 3h | Haiku 4 |
| 5 | Connect engine → Convex | Engine output must persist | 2h | Sonnet 4.6 |
| 6 | Agent activity feed (real-time) | The "wow" feature | 2h | DeepSeek V3.2 |
| 7 | Perplexity integration | KIMI-PERP-01, specced and ready | 2h | Kimi 2.5 |
| 8 | Agent model routing | KIMI-R22-01, specced and ready | 3h | Kimi 2.5 |
| 9 | Deploy to Vercel + Convex cloud | Must be accessible | 2h | Haiku 4 |
| 10 | Landing → Dashboard navigation | Connect the two halves | 1h | GLM 5 |

---

## AGENT ASSIGNMENTS — 8 CODING WORKERS

### 🔴 SONNET 4.6 (Anthropic terminal) — "The Architect"
**Domain**: `next.config.*`, `tailwind.config.*`, `app/layout.tsx`, `app/providers.tsx`, `app/(auth)/`, `src/orchestrator/`, `src/convex/`
**No-touch zones**: `src/mcp/`, `src/acp/`

**Sprint sequence**:
1. (0-2h) Set up Next.js 15 properly — `next.config.ts`, `tailwind.config.ts`, Convex provider, layout wiring
2. (2-4h) Auth integration — Convex Auth (ONLY), `requireAuth()` in all Convex functions, session management
3. (4-6h) Wire ralph-loop engine output → Convex mutations (builds, tasks, executions tables already defined)
4. (6-8h) Fix any integration issues, help other agents with blockers

### 🟡 HAIKU 4 (Anthropic terminal) — "The Backend Glue"
**Domain**: `convex/*.ts` (NOT schema.ts), `vercel.json`, `.env*`, `convex.json`
**No-touch zones**: `src/`, `app/(landing)/`

**Sprint sequence**:
1. (0-3h) Convex query/mutation functions for dashboard:
   - `convex/dashboard.ts` — listBuilds, getBuild, listTasks, getAgentStats
   - `convex/auth.ts` — getCurrentUser, ensureAuth helper
   - `convex/realtime.ts` — subscribeToActivity, subscribeToBuilds
   - All functions use validators, `requireAuth()`, proper indexes
2. (3-5h) Deployment setup — Convex cloud, Vercel config, env vars
3. (5-7h) Integration testing — verify Convex functions work with dashboard queries
4. (7-8h) Production deployment to Vercel + Convex cloud

### 🟢 KIMI 2.5 (Moonshot swarm) — "The Implementer"
**Domain**: `src/integrations/`, `src/llm/`, `src/swarm/`
**No-touch zones**: `convex/`, `app/`, `src/orchestrator/ralph-loop.ts`

**Sprint sequence**:
1. (0-3h) `KIMI-PERP-01` — Perplexity research integration (spec: `.nova/specs/perplexity-integration.md`, 25 tests)
2. (3-6h) `KIMI-R22-01` — Agent model routing + speculative decoding (spec: `.nova/specs/grok-r22-01-model-routing.md`, 79 tests)
3. (6-8h) Continue R22-01 or start `KIMI-R23-01` Visual Workflow if R22-01 finishes early

### 🔵 DEEPSEEK V3.2 (OpenRouter/aider) — "The Frontend Builder"
**Domain**: `app/(dashboard)/layout.tsx`, `app/(dashboard)/page.tsx`, `app/(dashboard)/builds/`, `app/(dashboard)/agents/`, `app/(dashboard)/settings/`
**No-touch zones**: `src/`, `convex/schema.ts`

**Sprint sequence**:
1. (0-3h) Dashboard layout + sidebar + overview page
2. (3-6h) Builds page + Agents page + Settings page
3. (6-8h) Real-time activity feed component

### 🟣 QWEN 3 CODER (OpenRouter/aider) — "The Component Builder"
**Domain**: `app/components/agent-card.tsx`, `app/components/build-row.tsx`, `app/components/activity-item.tsx`, `src/workflow/`
**No-touch zones**: `convex/`

**Sprint sequence**:
1. (0-4h) Agent card + build row + activity item + sidebar components
2. (4-8h) Loading skeletons + error boundaries + empty states for all dashboard components

### ⚪ GLM 5 (OpenRouter/aider) — "The Polish Worker"
**Domain**: `app/(landing)/` (fixes), `src/collaboration/` (Wave 3), mobile responsive
**No-touch zones**: `convex/`

**Sprint sequence**:
1. (0-4h) Landing → Dashboard navigation + auth redirect wiring
2. (4-8h) Mobile responsive polish (375px, 768px, 1024px) across all dashboard pages

### 🟠 MISTRAL LARGE (OpenRouter/aider) — "The Fixer"
**Domain**: ALL domains (read + fix only) — cannot create new files, only fix existing
**Role**: Dedicated QA — runs `tsc --noEmit`, `vitest run`, fixes TS errors, validates integration

**Sprint sequence**:
1. (0-2h) Standby — let workers produce initial output
2. (2-4h) First pass — review all Wave 1 output, fix TS errors, run tests
3. (4-6h) Rolling fixes — catch errors as workers produce more code
4. (6-8h) Integration validation — verify auth + dashboard + Convex all connect

### 🔶 LLAMA 4 MAVERICK (OpenRouter/aider) — "Wave 3 Parallel"
**Domain**: `src/observability/`, `src/memory/`, `src/model-db/`
**No-touch zones**: `convex/`, `app/`

**Sprint sequence**:
1. (0-8h) `KIMI-R23-05` — Observability eval framework (`src/observability/eval-framework.ts` + tests)
2. (8-14h) `KIMI-R23-03` — Infinite Hierarchical Memory (`src/memory/` + tests)
3. (14-20h) `KIMI-R24-01` — AI Model Database (`src/model-db/` + tests)

---

## AGENT ASSIGNMENTS — 4 BROWSER AGENTS

### 🌐 PERPLEXITY (has GitHub repo access)
**Role**: Live documentation + PR review + issue tracking
**Tasks**:
1. (0-2h) Review current repo state on GitHub, identify any broken imports or missing files
2. (2-4h) Research: "Best practices for Convex + Next.js 15 + Clerk auth integration 2026"
3. (4-6h) Research: "Vercel deployment configuration for Next.js 15 with Convex backend"
4. (6-8h) Create GitHub issues for any bugs found during review, draft DEPLOYMENT.md content

### 🧠 GROK 4.2 BETA (can view code)
**Role**: Architecture validation + code review + spec refinement
**Tasks**:
1. (0-2h) Review `convex/schema.ts` — validate all indexes, identify missing tables for dashboard
2. (2-4h) Review landing page components — identify what needs fixing for production
3. (4-6h) Write `GROK-R22-02` Shannon Patterns Adaptation spec (last remaining Grok task)
4. (6-8h) Code review all PRs/commits from the coding agents, flag issues

### 💬 CHATGPT 5.2
**Role**: Spec refinement + documentation + prompt optimization
**Tasks**:
1. (0-2h) Refine dashboard UI spec — component hierarchy, data flow, state management approach
2. (2-4h) Write user-facing documentation: README update, Getting Started guide
3. (4-6h) Optimize the sprint prompts for Kimi/GLM/Sonnet — make them more precise
4. (6-8h) Write CONTRIBUTING.md, update PROJECT_REFERENCE.md with new architecture

### 💎 GEMINI 3.1 (can import code)
**Role**: Deep research + competitive analysis + testing strategy
**Tasks**:
1. (0-2h) `GEMINI-07` — Agent communication protocols research (MCP/ACP/A2A patterns)
2. (2-4h) `GEMINI-08` — Developer productivity metrics (DORA/SPACE for Nova26)
3. (4-6h) Import key source files, analyze test coverage gaps, recommend priority tests
4. (6-8h) `GEMINI-09` — AI-native testing patterns research

---

## TIMELINE (8 active hours per wave, 8 coding workers + 4 browser agents)

```
HOUR 0-2:  SETUP PHASE — 8 WORKERS IN PARALLEL
├── Sonnet 4.6:      Next.js + Convex wiring, project config
├── Haiku 4:         Convex dashboard functions (listBuilds, getAgentStats)
├── Kimi 2.5:        KIMI-PERP-01 (Perplexity integration)
├── DeepSeek V3.2:   Dashboard layout + sidebar + overview page
├── Qwen 3 Coder:    Agent card + build row + activity item components
├── GLM 5:           Landing → Dashboard navigation + auth redirect
├── Mistral Large:   Standby (waiting for first output to review)
├── Llama 4 Maverick: KIMI-R23-05 Observability eval framework
├── Perplexity:      Repo review + Convex/Next.js research
├── Grok:            Schema review + missing tables
├── ChatGPT:         Dashboard UI spec refinement
└── Gemini:          GEMINI-07 research

HOUR 2-4:  CORE BUILD
├── Sonnet 4.6:      Auth integration (Convex Auth)
├── Haiku 4:         Convex realtime + users functions
├── Kimi 2.5:        KIMI-PERP-01 continued → KIMI-R22-01 start
├── DeepSeek V3.2:   Builds page + Agents page + Settings page
├── Qwen 3 Coder:    Loading skeletons + error boundaries
├── GLM 5:           Mobile responsive polish (375px, 768px, 1024px)
├── Mistral Large:   First pass — review all output, fix TS errors, run tests
├── Llama 4 Maverick: KIMI-R23-05 continued
├── Perplexity:      Deployment research
├── Grok:            Landing page review + GROK-R22-02
├── ChatGPT:         README + Getting Started docs
└── Gemini:          GEMINI-08 research

HOUR 4-6:  INTEGRATION
├── Sonnet 4.6:      Engine → Convex wiring
├── Haiku 4:         Deployment config (Vercel, env vars)
├── Kimi 2.5:        KIMI-R22-01 (model routing)
├── DeepSeek V3.2:   Real-time activity feed component
├── Qwen 3 Coder:    Empty states + polish for all components
├── GLM 5:           Continue responsive polish
├── Mistral Large:   Rolling fixes — catch errors as workers produce code
├── Llama 4 Maverick: KIMI-R23-05 finish → start R23-03 Memory
├── Perplexity:      Deployment docs
├── Grok:            Code review all commits
├── ChatGPT:         Sprint prompt optimization
└── Gemini:          Test coverage analysis

HOUR 6-8:  POLISH + DEPLOY
├── Sonnet 4.6:      Fix integration issues, blockers
├── Haiku 4:         Production deploy + smoke test
├── Kimi 2.5:        KIMI-R22-01 finish or start R23-01
├── DeepSeek V3.2:   Dashboard polish — animations, transitions
├── Qwen 3 Coder:    Final component polish
├── GLM 5:           Final responsive QA
├── Mistral Large:   Integration validation — auth + dashboard + Convex
├── Llama 4 Maverick: KIMI-R23-03 Infinite Memory
├── Perplexity:      GitHub issues for bugs
├── Grok:            Final architecture review
├── ChatGPT:         CONTRIBUTING.md + docs
└── Gemini:          GEMINI-09 research
```

---

## FILE DOMAIN MAP (8 WORKERS — NO OVERLAPS)

| Worker | Owns | Can Read | Cannot Touch |
|--------|------|----------|-------------|
| Sonnet 4.6 | `next.config.*`, `tailwind.config.*`, `app/layout.tsx`, `app/providers.tsx`, `app/(auth)/`, `src/orchestrator/`, `src/convex/` | Everything | `src/mcp/`, `src/acp/` |
| Haiku 4 | `convex/*.ts` (NOT schema.ts), `vercel.json`, `.env*`, deployment | `convex/schema.ts`, `app/` | `src/`, `app/(landing)/` |
| Kimi 2.5 | `src/integrations/`, `src/llm/`, `src/swarm/` | `src/`, `.nova/specs/` | `convex/`, `app/`, `src/orchestrator/ralph-loop.ts` |
| DeepSeek V3.2 | `app/(dashboard)/layout.tsx`, `app/(dashboard)/page.tsx`, `app/(dashboard)/builds/`, `app/(dashboard)/agents/`, `app/(dashboard)/settings/` | `convex/schema.ts` | `src/`, `convex/*.ts` (functions) |
| Qwen 3 Coder | `app/components/agent-card.tsx`, `app/components/build-row.tsx`, `app/components/activity-item.tsx`, `app/components/sidebar.tsx`, `src/workflow/` | `src/`, `app/` | `convex/` |
| GLM 5 | `app/(landing)/` (fixes), `src/collaboration/` (Wave 3), mobile responsive | `src/`, `app/` | `convex/` |
| Mistral Large | ALL domains (read + fix only) | Everything | Cannot CREATE new files |
| Llama 4 Maverick | `src/observability/`, `src/memory/`, `src/model-db/` | `src/`, `.nova/specs/` | `convex/`, `app/` |

---

## THE UNIFIED CODING WORKER PROMPT

> Copy-paste this to all 8 coding workers (Sonnet 4.6, Haiku 4, Kimi 2.5, DeepSeek V3.2, Qwen 3 Coder, GLM 5, Mistral Large, Llama 4 Maverick).
> Then append their specific task section below it.


```
=== NOVA26 UNIFIED CODING WORKER CONTEXT ===

PROJECT: Nova26 — AI-powered IDE with 21 specialized agents
REPO: https://github.com/nelsen3000/nova26
TECH STACK: TypeScript strict, React 19, Tailwind CSS, shadcn/ui, Convex (ONLY database), Ollama for LLM
STATE: 4,007 tests, 0 TS errors, 151 test files, core engine ~85% done

RULES (MANDATORY):
1. TypeScript strict mode — no `any`, no implicit any
2. ESM imports with `.js` extensions (e.g., `import { foo } from './bar.js'`)
3. Vitest for all tests — mock all I/O (network, filesystem, LLM calls)
4. Convex is the ONLY database — no REST APIs, no Express, no Next.js API routes
5. All Convex functions use validators (v.string(), v.number(), v.id(), etc.)
6. All Convex functions use requireAuth() for authentication
7. React 19 patterns — use() hook, Server Components where possible
8. Tailwind CSS only — no CSS modules, no styled-components
9. shadcn/ui for all UI components — do not build custom equivalents
10. Math.floor() for all numeric operations (never Math.round or Math.ceil for financial)
11. All validation: amount > 0, Number.isFinite(), Math.floor() === original value

FILE STRUCTURE:
- src/           → Core engine (orchestrator, agents, LLM, etc.)
- app/           → Next.js 15 frontend (landing page + dashboard)
- convex/        → Convex backend (schema + functions)
- .nova/agents/  → 21 agent markdown templates (DO NOT MODIFY)
- .nova/specs/   → Grok research specs (READ ONLY)
- .prompts/      → Sprint prompt files (READ ONLY)

CONVEX SCHEMA (14 tables already defined in convex/schema.ts):
- ATLAS: builds, patterns, agents, tasks, executions, learnings
- Dashboard: companies, chipAccounts, divisions, companyAgents
- Global: globalPatterns, userProfiles, wisdomUpdates, agentActivityFeed

YOUR DOMAIN: [SEE YOUR SPECIFIC ASSIGNMENT BELOW]
DO NOT TOUCH files outside your domain. If you need something from another domain, note it as a blocker.

QUALITY BAR:
- `tsc --noEmit` = 0 errors
- All tests pass (`vitest run`)
- No console.log in production code
- Every component handles 5 UI states: Loading, Empty, Error, Partial, Populated

WHEN DONE: Report what you built, what files you created/modified, and any blockers.
```

---

## SPECIFIC TASK PROMPTS (append one per agent)

### For SONNET 4.6 — "The Architect"

```
=== YOUR ASSIGNMENT: SONNET 4.6 — Project Wiring + Auth ===

YOUR DOMAIN (you own these files):
- next.config.ts (CREATE)
- tailwind.config.ts (CREATE or UPDATE)
- app/layout.tsx (UPDATE — add Convex provider)
- app/providers.tsx (CREATE — ConvexProvider + AuthProvider)
- app/(auth)/ (CREATE — sign-in, sign-up pages)
- src/orchestrator/ (UPDATE — wire output to Convex)
- src/convex/bridge.ts (CREATE)
- postcss.config.js (CREATE if needed)
- tsconfig.json (UPDATE if needed for Next.js)

TASK 1 (0-2h): Next.js + Convex Project Wiring
- Create next.config.ts with proper config for Next.js 15
- Create/update tailwind.config.ts with shadcn/ui preset
- Create app/providers.tsx wrapping ConvexProvider
- Update app/layout.tsx to use providers
- Verify: `npm run build` succeeds with no errors

TASK 2 (2-4h): Authentication
- Integrate Convex Auth (the ONLY auth provider — no Clerk, no external auth)
- Create auth middleware for protected routes
- Add requireAuth() helper for Convex functions
- Create app/(auth)/sign-in and app/(auth)/sign-up pages
- Wire auth state into ConvexProvider

TASK 3 (4-6h): Engine → Convex Bridge
- Create src/convex/bridge.ts that takes ralph-loop output and writes to Convex
- Map: build completion → convex builds table mutation
- Map: task completion → convex tasks table mutation
- Map: execution logs → convex executions table mutation
- Map: agent activity → convex agentActivityFeed mutation

TASK 4 (6-8h): Integration fixes + blocker resolution
- Fix any issues reported by other agents
- Ensure auth flow works end-to-end
- Verify Convex provider connects properly
```

### For HAIKU 4 — "The Backend Glue"

```
=== YOUR ASSIGNMENT: HAIKU 4 — Convex Functions + Deployment ===

YOUR DOMAIN (you own these files):
- convex/dashboard.ts (CREATE)
- convex/auth.ts (CREATE)
- convex/realtime.ts (CREATE)
- convex/users.ts (CREATE)
- vercel.json (CREATE)
- .env.local.example (CREATE)
- DO NOT touch: convex/schema.ts, src/, app/(landing)/

TASK 1 (0-3h): Convex Dashboard Functions
Create convex/dashboard.ts:
- listBuilds: query — paginated, sorted by startedAt desc, auth required
- getBuild: query — single build by ID with its tasks
- listTasks: query — tasks for a build, sorted by phase
- getAgentStats: query — aggregate stats per agent (total tasks, success rate, avg duration)
- getOverviewStats: query — total builds, active tasks, success rate, last build time

Create convex/auth.ts:
- getCurrentUser: query — get current user profile
- ensureUser: mutation — create user profile if not exists (called on first login)

Create convex/realtime.ts:
- subscribeToActivity: query — latest 50 activity feed items for user, sorted by timestamp desc
- subscribeToBuilds: query — active builds with real-time status updates
- logActivity: mutation — write new activity event

Create convex/users.ts:
- getUser: query — by userId
- updateSettings: mutation — update user preferences
- updateTier: mutation — change subscription tier

ALL functions must:
- Use proper Convex validators (v.string(), v.number(), v.id(), etc.)
- Use auth via ctx.auth.getUserIdentity()
- Return typed results
- Use existing indexes from schema.ts

TASK 2 (3-5h): Deployment Configuration
- Create vercel.json with Convex integration
- Create .env.local.example with all required env vars
- Set up Convex deployment config (convex.json if needed)
- Test: `npx convex dev` connects and syncs schema

TASK 3 (5-7h): Integration Testing
- Verify all Convex functions work with `npx convex dev`
- Test auth flow end-to-end
- Verify real-time subscriptions update correctly
- Check all indexes are used properly (no full table scans)

TASK 4 (7-8h): Production Deploy
- Deploy Convex to production (`npx convex deploy`)
- Deploy Next.js to Vercel
- Verify production URLs work
- Smoke test: sign in → dashboard → see data
```

### For KIMI 2.5 — "The Implementer"

```
=== YOUR ASSIGNMENT: KIMI 2.5 — Feature Implementation ===

YOUR DOMAIN (you own these files):
- src/integrations/ (CREATE/UPDATE)
- src/llm/ (UPDATE — model routing)
- src/swarm/ (UPDATE if needed)
- src/observability/ (CREATE/UPDATE)

TASK 1 (0-3h): KIMI-PERP-01 — Perplexity Research Integration
- Spec: .nova/specs/perplexity-integration.md
- Expected: 25 tests minimum
- Create src/integrations/perplexity-client.ts
- Create src/integrations/perplexity-client.test.ts
- Wire into agent system as research tool

TASK 2 (3-6h): KIMI-R22-01 — Agent Model Routing
- Spec: .nova/specs/grok-r22-01-model-routing.md
- Expected: 79 tests minimum
- Implement agent-specific model selection
- Speculative decoding support
- UCB (Upper Confidence Bound) router for model selection
- Update src/llm/model-router.ts

TASK 3 (6-8h): KIMI-R23-05 — Observability Basics
- Spec: .nova/specs/grok-r23-eternal-symphony.md (R23-05 section)
- Expected: 60 tests minimum
- Focus on: eval framework + golden set testing
- SKIP: LangSmith/Braintrust cloud integration (post-launch)
- Create src/observability/eval-framework.ts
```

### For DEEPSEEK V3.2 — "The Frontend Builder"

```
=== YOUR ASSIGNMENT: DEEPSEEK V3.2 — Dashboard UI ===

YOUR DOMAIN (you own these files):
- app/(dashboard)/layout.tsx (CREATE)
- app/(dashboard)/page.tsx (CREATE)
- app/(dashboard)/builds/page.tsx (CREATE)
- app/(dashboard)/agents/page.tsx (CREATE)
- app/(dashboard)/settings/page.tsx (CREATE)
- DO NOT touch: src/, convex/*.ts, app/(landing)/, app/components/

TECH: React 19, Tailwind CSS, shadcn/ui, Convex useQuery/useMutation hooks

TASK 1 (0-3h): Dashboard Shell
Create these pages:
- app/(dashboard)/layout.tsx — Dashboard layout with sidebar slot + header + main content area
- app/(dashboard)/page.tsx — Overview: agent status grid, recent builds, activity feed
- app/(dashboard)/builds/page.tsx — Build history list with status badges
- app/(dashboard)/agents/page.tsx — 21 agent cards showing status, last task, model
- app/(dashboard)/settings/page.tsx — User settings, API keys, model config

Use Convex hooks for data:
- useQuery(api.dashboard.listBuilds) for builds
- useQuery(api.dashboard.getAgentStats) for agent status
- useQuery(api.realtime.subscribeToActivity) for live feed

Every page MUST handle: Loading (skeleton), Empty (CTA), Error (retry), Partial, Populated

TASK 2 (3-6h): Remaining Pages + Activity Feed
- Finish any incomplete pages from Task 1
- app/(dashboard)/page.tsx — add real-time activity feed section using Convex subscription
- Show: agent name, action, timestamp, status badge
- Auto-scroll to newest, max 50 items visible

TASK 3 (6-8h): Polish
- Animated entry for new activity items (framer-motion or CSS transitions)
- Breadcrumb navigation in dashboard
- Responsive layout adjustments
```

### For QWEN 3 CODER — "The Component Builder"

```
=== YOUR ASSIGNMENT: QWEN 3 CODER — Shared Components ===

YOUR DOMAIN (you own these files):
- app/components/sidebar.tsx (CREATE)
- app/components/agent-card.tsx (CREATE)
- app/components/build-row.tsx (CREATE)
- app/components/activity-item.tsx (CREATE)
- app/components/activity-feed.tsx (CREATE)
- app/components/loading-skeleton.tsx (CREATE)
- app/components/error-boundary.tsx (CREATE)
- app/components/empty-state.tsx (CREATE)
- DO NOT touch: convex/, src/

TECH: React 19, Tailwind CSS, shadcn/ui

TASK 1 (0-4h): Core Components
- app/components/sidebar.tsx — Navigation sidebar (Dashboard, Builds, Agents, Settings) with active state
- app/components/agent-card.tsx — Individual agent status card (name, role, model, status badge, last task)
- app/components/build-row.tsx — Build history row (build ID, status, duration, agent count, timestamp)
- app/components/activity-item.tsx — Activity feed item (agent name, action, timestamp, status)
- app/components/activity-feed.tsx — Live-updating feed container using Convex subscription

Use shadcn/ui: Button, Card, Badge, Table, Tabs, Skeleton

TASK 2 (4-8h): Polish Components
- app/components/loading-skeleton.tsx — Reusable skeleton for cards, rows, feeds
- app/components/error-boundary.tsx — Error boundary with retry button
- app/components/empty-state.tsx — Empty state with icon + message + CTA button
- Ensure all components handle 5 UI states
- Mobile responsive (test at 375px, 768px, 1024px)
```

### For GLM 5 — "The Polish Worker"

```
=== YOUR ASSIGNMENT: GLM 5 — Navigation + Responsive Polish ===

YOUR DOMAIN (you own these files):
- app/(landing)/ (fixes only — do not rewrite)
- Mobile responsive fixes across app/(dashboard)/
- src/collaboration/ (Wave 3 only)
- DO NOT touch: convex/

TASK 1 (0-4h): Landing → Dashboard Navigation
- Update app/(landing)/components/cta-section.tsx — "Get Started" → /dashboard
- Add auth-gated redirect: unauthenticated → /sign-in, authenticated → /dashboard
- Ensure landing page links work correctly
- Test navigation flow end-to-end

TASK 2 (4-8h): Mobile Responsive Polish
- Test all dashboard pages at 375px, 768px, 1024px breakpoints
- Fix any layout issues (sidebar collapse on mobile, card stacking, table scrolling)
- Ensure touch targets are 44px minimum
- Test activity feed on mobile (scrolling, item sizing)
```

### For MISTRAL LARGE — "The Fixer"

```
=== YOUR ASSIGNMENT: MISTRAL LARGE — QA + Error Fixing ===

YOUR DOMAIN: ALL files (read + fix only — do NOT create new files)
YOUR ROLE: Dedicated QA engineer. You review other workers' output and fix errors.

WORKFLOW (rolling, hours 2-8):
1. Wait for first output from other workers (hours 0-2)
2. Pull latest changes
3. Run `npx tsc --noEmit` — fix ALL TypeScript errors
4. Run `vitest run` — fix ALL failing tests
5. Check for: missing imports, wrong types, `any` usage, missing validators
6. Check for: ESM .js import extensions, strict mode violations
7. Report what you fixed and any blockers you found
8. Repeat every 1-2 hours as workers produce more code

RULES:
- You can MODIFY any file to fix errors
- You CANNOT create new feature files (that's other workers' jobs)
- You CAN create missing type definition files if needed
- Always run `tsc --noEmit` after your fixes to verify 0 errors
- Always run `vitest run` after your fixes to verify tests pass
- If you find a design issue (not just a typo), report it — don't redesign
```

### For LLAMA 4 MAVERICK — "Wave 3 Parallel"

```
=== YOUR ASSIGNMENT: LLAMA 4 MAVERICK — R23/R24 Features ===

YOUR DOMAIN (you own these files):
- src/observability/ (CREATE/UPDATE)
- src/memory/ (CREATE/UPDATE)
- src/model-db/ (CREATE/UPDATE)
- DO NOT touch: convex/, app/

TASK 1 (0-8h): KIMI-R23-05 — Observability Eval Framework
- Spec: .nova/specs/grok-r23-eternal-symphony.md (R23-05 section)
- Expected: 60 tests minimum
- Focus on: eval framework + golden set testing
- SKIP: LangSmith/Braintrust cloud integration (post-launch)
- Create src/observability/eval-framework.ts + tests

TASK 2 (8-14h): KIMI-R23-03 — Infinite Hierarchical Memory
- Spec: .nova/specs/grok-r23-eternal-symphony.md (R23-03 section)
- Expected: 70 tests minimum
- Implement: hierarchical memory store, retrieval, compression
- Create src/memory/ directory with implementation + tests

TASK 3 (14-20h): KIMI-R24-01 — AI Model Database
- Spec: .nova/specs/grok-r24-immortal-omniverse.md (R24-01 section)
- Expected: 70 tests minimum
- Implement: model registry, capability matching, cost tracking
- Create src/model-db/ directory with implementation + tests
```

---

## THE UNIFIED BROWSER AGENT PROMPT

> Copy-paste this to Perplexity, Grok, ChatGPT, and Gemini.
> Then append their specific task section below it.


```
=== NOVA26 BROWSER AGENT CONTEXT ===

PROJECT: Nova26 — AI-powered IDE with 21 specialized agents orchestrated by the Ralph Loop
REPO: https://github.com/nelsen3000/nova26
TECH: TypeScript, React 19, Tailwind CSS, shadcn/ui, Convex, Ollama
STATE: 4,007 tests, 0 TS errors, core engine ~85% done, dashboard 0%, deployment ~15%

WHAT EXISTS:
- Core engine in src/ (233 files, 68K lines) — orchestrator, agents, LLM client, gates, persistence
- Landing page in app/(landing)/ — 7 React components, looks good but not wired to backend
- Convex schema in convex/schema.ts — 14 tables defined (ATLAS 6, Dashboard 4, Global 4)
- 7 Convex function files (activity, atlas, chipAccounts, companies, divisions, wisdom)
- 21 agent markdown templates in .nova/agents/
- 13 Grok research specs in .nova/specs/
- 45 sprint prompt files in .prompts/

WHAT'S MISSING (critical path):
- Dashboard UI (0% built) — the actual product interface
- Auth integration — no Convex Auth wired yet
- Convex deployment — schema defined but not deployed to cloud
- Next.js project config — no next.config.ts, no tailwind.config.ts
- Engine → Convex bridge — engine runs locally but doesn't persist to Convex
- Vercel deployment — no vercel.json, no production deploy

24-HOUR GOAL: Working demo with auth, dashboard, real-time agent activity, deployed to Vercel + Convex cloud.

YOUR ROLE: Research, review, document, and advise. You do NOT write code directly.
REPORT TO: Jon (the human coordinator). When done with a task, report findings.
```

---

### For PERPLEXITY — "Intelligence Division"

```
=== YOUR ASSIGNMENT: PERPLEXITY — Research + Repo Review ===

You have direct GitHub access to nelsen3000/nova26.

TASK 1 (0-2h): Repo Health Check
- Pull the latest repo state from GitHub
- Check for: broken imports, missing dependencies, circular references
- Verify package.json dependencies are compatible (React 19 + Next.js 15 + Convex)
- List any files that reference modules that don't exist
- Report findings as a GitHub issue or directly to Jon

TASK 2 (2-4h): Integration Research
- Research: "Convex + Next.js 15 App Router integration best practices 2026"
- Research: "Convex Auth setup with Next.js 15 App Router 2026"
- Research: "shadcn/ui + Next.js 15 + Tailwind CSS 4 configuration"
- Compile a concise integration guide with exact code snippets
- Focus on: ConvexProvider setup, Convex Auth middleware, protected routes

TASK 3 (4-6h): Deployment Research
- Research: "Vercel deployment for Next.js 15 with Convex backend"
- Research: "Convex production deployment checklist"
- Document: required environment variables, build commands, deployment steps
- Create draft DEPLOYMENT.md content

TASK 4 (6-8h): Bug Hunting
- Review recent commits for potential issues
- Check if convex/schema.ts indexes match the queries being written
- Identify any missing Convex functions that the dashboard will need
- Create GitHub issues for anything found
```

### For GROK 4.2 — "Architecture Validator"

```
=== YOUR ASSIGNMENT: GROK 4.2 — Code Review + Architecture ===

You can view code directly.

TASK 1 (0-2h): Schema Validation
- Review convex/schema.ts thoroughly
- Check: Are all indexes optimal for the queries we'll need?
- Check: Are there missing tables for dashboard features?
- Recommend: Any schema changes needed before deployment?
- Specifically validate: agentActivityFeed indexes, builds query patterns

TASK 2 (2-4h): Landing Page Audit
- Review all 7 components in app/(landing)/components/
- Check: accessibility (ARIA labels, keyboard nav, color contrast)
- Check: responsive design (mobile breakpoints)
- Check: are there hardcoded values that should be dynamic?
- List fixes needed for production readiness

TASK 3 (4-6h): GROK-R22-02 — Shannon Patterns Spec
- Write the Shannon Patterns Adaptation spec
- Cover: Temporal replay patterns, UCB router, WASI sandbox adaptation
- Follow the same format as previous Grok specs
- Save as: .nova/specs/grok-r22-02-shannon-patterns.md

TASK 4 (6-8h): Code Review
- Review all code produced by the 5 coding agents during this sprint
- Check for: TypeScript strict compliance, proper Convex patterns, security issues
- Flag: any `any` types, missing validators, unhandled errors
- Provide fix recommendations for each issue found
```

### For CHATGPT 5.2 — "Spec Refiner + Docs"

```
=== YOUR ASSIGNMENT: CHATGPT 5.2 — Documentation + Specs ===

TASK 1 (0-2h): Dashboard UI Spec
- Write a detailed dashboard UI specification
- Component hierarchy: Layout → Pages → Sections → Components
- Data flow: Convex queries → React hooks → Components → UI
- State management approach (Convex reactive queries, no Redux needed)
- Include wireframe descriptions for each page
- Deliver as a markdown document

TASK 2 (2-4h): README Overhaul
- Rewrite the main README.md for the repo
- Sections: Overview, Quick Start, Architecture, Tech Stack, Development, Deployment, Contributing
- Make it compelling — this is what people see first on GitHub
- Include badges (build status, test count, TypeScript, license)

TASK 3 (4-6h): Getting Started Guide
- Write docs/GETTING-STARTED.md
- Step-by-step: clone → install → configure Convex → configure auth → run dev → run tests
- Include troubleshooting section for common issues
- Target audience: developer who's never seen the project

TASK 4 (6-8h): CONTRIBUTING.md + Project Reference Update
- Write CONTRIBUTING.md (code style, PR process, agent domains, testing requirements)
- Update PROJECT_REFERENCE.md with current architecture
- Document the 21-agent system for new contributors
```

### For GEMINI 3.1 — "Deep Researcher"

```
=== YOUR ASSIGNMENT: GEMINI 3.1 — Research Sprint ===

TASK 1 (0-2h): GEMINI-07 — Agent Communication Protocols
- Deep research: MCP (Model Context Protocol), ACP, A2A, orchestration patterns
- Compare: How do Cursor, Windsurf, Cline, Aider handle multi-agent communication?
- Recommend: Best protocol patterns for Nova26's 21-agent architecture
- Output: Structured research report with priority matrix

TASK 2 (2-4h): GEMINI-08 — Developer Productivity Metrics
- Research: DORA metrics, SPACE framework, AI-specific productivity metrics
- Design: Nova26-specific metrics dashboard (what to measure, how to display)
- Recommend: Which metrics matter most for an AI IDE?
- Output: Metrics specification with recharts visualization recommendations

TASK 3 (4-6h): Code Analysis
- Import key source files from the repo
- Analyze: test coverage gaps across src/ modules
- Identify: which modules have 0 tests, which have weak coverage
- Recommend: priority test targets for maximum confidence
- Output: Coverage gap report with specific file recommendations

TASK 4 (6-8h): GEMINI-09 — AI-Native Testing
- Research: AI code bug patterns, auto-fix frameworks, eval suites
- Compare: Braintrust, promptfoo, LangSmith eval approaches
- Recommend: Testing strategy for Nova26's agent outputs
- Output: Testing strategy document with implementation roadmap
```

---

## COORDINATION PROTOCOL

1. **Jon is the hub**: All 8 coding workers + 4 browser agents report to Jon. Jon routes information between them.
2. **Blockers go to Kiro**: If a worker is blocked, Jon tells Kiro. Kiro adjusts the plan.
3. **No file conflicts**: Each worker has a strict domain. If you need a file outside your domain, ask Jon.
4. **Mistral Large is the fixer**: Don't stop to debug TS errors. Report them and keep building. Mistral will fix.
5. **Quality check**: Before merging any worker's output, Mistral runs `tsc --noEmit` + `vitest run`.
6. **Commit format**: `feat(domain): description` — e.g., `feat(dashboard): add agent status cards`

## SUCCESS CRITERIA

At the end of 24 hours, we should have:
- [ ] Next.js 15 app running with Convex backend
- [ ] Auth working (sign in/sign up/sign out)
- [ ] Dashboard with 4 pages (overview, builds, agents, settings)
- [ ] Real-time agent activity feed
- [ ] Landing page linking to dashboard
- [ ] Deployed to Vercel + Convex cloud
- [ ] At least 2 new KIMI features implemented (PERP-01 + R22-01)
- [ ] Updated documentation (README, DEPLOYMENT, GETTING-STARTED)

---

*Generated by Kiro (Opus 4.6) — February 20, 2026*
*Reference: .nova/TASK-BOARD.md, MISSING_FEATURES.md, ARCHITECTURE.md*
