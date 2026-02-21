# OPERATION ETERNAL FLAME — 3-Worker Redistribution
## February 20, 2026

> **Reality**: Only Sonnet 4.6, Haiku 4, and Kimi 2.5 are available.
> **Strategy**: Redistribute all 8 workers' tasks across 3 workers.
> **Status**: Each worker already started their original Sprint 1 tasks.
> **Project folder**: `/Users/jonathannelsen/nova26/kiro/nova26`

---

## NEW DOMAIN MAP (3 Workers, Full Coverage)

| Worker | Original Domain | NOW ALSO OWNS |
|--------|----------------|---------------|
| Sonnet 4.6 | Wiring, auth, bridge, orchestrator | + Dashboard UI (was DeepSeek) + Responsive/polish (was GLM) + QA/fixing (was Mistral) |
| Haiku 4 | Convex functions, deployment | + Shared components (was Qwen) + Cron jobs, webhooks, monitoring, seed data |
| Kimi 2.5 | Perplexity, model routing, swarm | + Visual Workflow (was Qwen) + CRDT (was GLM) + Observability/Memory/ModelDB (was Llama) |

---

## SONNET 4.6 — "The Architect" (Expanded)

**Provider**: Anthropic (terminal)
**Now owns**: Everything in `app/` (dashboard, auth, landing fixes, responsive) + `src/convex/` + `src/orchestrator/` + QA duties
**Cannot touch**: `src/mcp/`, `src/acp/`

> You already completed or started Tasks S1-S6 from the original sprint (Next.js wiring, Tailwind, ConvexProvider, Auth, Middleware, Bridge). Continue from S7 below, which now includes all frontend UI work that was assigned to DeepSeek V3.2, GLM 5, and Mistral Large.


### Task S7: Dashboard Layout Shell (was DeepSeek D1)
Create `app/(dashboard)/layout.tsx`. Fixed sidebar (280px desktop, collapsible mobile) + header bar (64px, sticky) + main content area. Sidebar: import from `@/app/components/sidebar` (Haiku will build it). Header: page title, search placeholder, notification bell, UserButton. Main: `{children}` with `p-6`. Mobile: sidebar hidden, hamburger → shadcn Sheet overlay. Dark mode via `dark:` variants. Wrap in auth guard — redirect to `/sign-in` if not authenticated.

### Task S8: Dashboard Overview Page (was DeepSeek D2)
Create `app/(dashboard)/page.tsx`. 4 stat cards at top (grid 2×2 mobile, 4×1 desktop): "Total Builds", "Active Tasks", "Success Rate", "Last Build". Agent status section: grid of 21 mini agent cards (3 cols desktop, 1 mobile) showing name, status dot, current task. Recent activity section: last 10 items in vertical timeline. Use Convex hooks: `useQuery(api.dashboard.getOverviewStats)`, `useQuery(api.dashboard.getAgentStats)`, `useQuery(api.realtime.subscribeToActivity)`. Handle all 5 UI states per section.

### Task S9: Builds Page + Detail (was DeepSeek D3)
Create `app/(dashboard)/builds/page.tsx`. Filter bar (status dropdown, date range, search) + build table (shadcn Table: Build ID, Name, Status Badge, Duration, Agent Count, Started At, Actions) + pagination. Create `app/(dashboard)/builds/[buildId]/page.tsx` — detail view: metadata, task list by phase, execution timeline. Use `useQuery(api.dashboard.listBuilds)` with pagination. Empty state: "No builds yet — run your first build" with CTA.

### Task S10: Agents Page (was DeepSeek D4)
Create `app/(dashboard)/agents/page.tsx`. Filter/sort bar + agent card grid (3 cols desktop, 2 tablet, 1 mobile). Each card: agent name + role, model name, status indicator, stats row (tasks | success % | avg time), last active. "System Overview" section at top: total active, tasks today, health. Use `useQuery(api.dashboard.getAgentStats)`. Sort by name, activity, success rate, task count.

### Task S11: Settings Page (was DeepSeek D5)
Create `app/(dashboard)/settings/page.tsx`. Tabs (shadcn Tabs): Profile (name, email, timezone), Appearance (theme toggle, sidebar position, compact mode), API Keys (masked list, add form, delete with confirm), Notifications (toggles), Billing (tier display, usage, upgrade CTA). Use `useQuery(api.users.getUser)`, `useMutation(api.users.updateSettings)`. Toast on save.

### Task S12: Real-Time Activity Feed (was DeepSeek D6)
Add activity feed to dashboard overview. Use `useQuery(api.realtime.subscribeToActivity)`. Vertical list, newest at top. Each item: agent avatar (colored circle), name, action, relative timestamp, status badge. CSS slide-down animation for new items. Auto-scroll unless user scrolled down. "Live" pulsing green dot. Max 50 items. "View All Activity" link.

### Task S13: Landing Page CTA + Navigation (was GLM G1-G3)
Update `app/(landing)/components/cta-section.tsx`: authenticated → "Go to Dashboard" → `/dashboard`, unauthenticated → "Get Started Free" → `/sign-up`. Update landing header: authenticated → "Dashboard" link + avatar + "Sign Out", unauthenticated → "Sign In" + "Sign Up". Sticky header with backdrop blur. Create auth redirect: if authenticated on `/sign-in` or `/sign-up` → redirect to `/dashboard`. Post-auth redirect: check `?redirect=` param, default to `/dashboard`.

### Task S14: Mobile Responsive Pass (was GLM G4-G6, DeepSeek D10)
Full responsive audit at 375px, 768px, 1024px, 1440px. Sidebar: hidden on mobile (Sheet overlay), collapsed on tablet (64px icons only), full on desktop. Stat cards: 1-col mobile, 2×2 tablet, 4×1 desktop. Agent grid: 1-col mobile, 2-col tablet, 3-col desktop. Build table: card list on mobile. Settings tabs: dropdown on mobile. Touch targets 44px minimum. No horizontal overflow at any breakpoint.

### Task S15: Dashboard Polish — Animations + Empty States (was DeepSeek D7-D8)
Page transitions: fade-in on route change. Card hover: shadow elevation. Button press: `active:scale-95`. Status badges: pulse on "running". Number count-up on stat cards (500ms). Sidebar collapse/expand animation. Activity feed staggered entry. Loading skeleton shimmer. `prefers-reduced-motion` respected. Empty states for every section: overview (no builds), builds (no history), agents (no activity), settings (no API keys), activity (no events). Each: icon + title + description + CTA button. Consistent styling (centered, max-w-400px).

### Task S16: Search + Filtering (was DeepSeek D9)
Global search in header (shadcn Command, `Cmd+K`). Searches builds, agents, activity. Builds filters: status multi-select, date range (shadcn Calendar), duration quick filters. Agents filters: status, role, model. All filters sync with URL query params. Debounced search (300ms). Result count display. Clear all filters button.

### Task S17: TypeScript + Test QA Pass (was Mistral M1-M6)
Run `npx tsc --noEmit` — fix ALL errors. Run `vitest run` — fix ALL failures. Audit: ESM `.js` extensions on all imports, no `any`, no CommonJS, all Convex functions have validators + auth, all React components handle 5 UI states, `"use client"` directives correct, Convex hook usa                                                       ge handles `undefined` loading state, proper key props on `.map()`. Cross-check: dashboard `useQuery(api.dashboard.X)` matches actual Convex function names. Auth flow end-to-end: providers → guard → sign-in → dashboard → sign-out.

### Task S18: Security + Performance Audit (was Mistral M7-M8)
Security: no hardcoded secrets, no `dangerouslySetInnerHTML`, all user input validated, no API keys in client code, CORS restrictive, rate limiting on auth, error messages don't leak internals. Performance: no N+1 Convex queries, `useMemo`/`useCallback` on expensive ops, Next.js `<Image>` for images, pagination on large lists, no unnecessary re-renders.

### Task S19: Integration Smoke Test (was Sonnet S10 + Mistral M10-M11)
Full end-to-end: landing → CTA → sign-up → dashboard → overview (stats + agents + activity) → builds → agents → settings → sign out → landing. Verify Convex subscriptions real-time (two tabs). `tsc --noEmit` = 0. `vitest run` = 0 failures. No `console.log` in production. Document issues in `.nova/SMOKE-TEST-RESULTS.md`.

### Task S20: Production Hardening (was Sonnet S11)
Remove console.logs. Document env vars in `.env.local.example`. CSP headers in next.config.ts. `robots.txt`, `sitemap.xml`. Meta tags on all pages. Graceful degradation without JS. Lighthouse audit target 90+. Final `tsc --noEmit` + `vitest run` = zero everything.

### Task S21: Accessibility Pass (was DeepSeek D11)
Keyboard nav: all elements reachable via Tab, visible focus indicators. Screen reader: alt text, aria-labels on icons/badges, data tables with `<th>` scope. Color contrast: WCAG AA in light + dark. Status indicators: never color-only. Forms: labels, `aria-describedby` for errors, `aria-required`. Activity feed: `aria-live="polite"`. `prefers-reduced-motion`. Focus management on modals. Run axe-core, fix critical/serious.

---

## HAIKU 4 — "The Backend Glue" (Expanded)

**Provider**: Anthropic (terminal)
**Now owns**: Everything in `convex/` + `app/components/` (shared components, was Qwen) + deployment + monitoring
**Cannot touch**: `src/` (except reading schema)

> You already completed or started Tasks H1-H5 from the original sprint (dashboard queries, agent stats, auth functions, user functions, build mutations, deployment config). Continue from H6 below, which now includes all shared component work that was assigned to Qwen 3 Coder.


### Task H6: Sidebar Component (was Qwen Q1)
Create `app/components/sidebar.tsx`. Fixed nav: logo at top ("Nova26"), links (Dashboard, Builds, Agents, Settings — each with Lucide icon), active state (left border + bg highlight). Props: `{ collapsed?, onToggle?, currentPath }`. Badge support for counts. Collapsed mode: icons only + tooltips. Width transition 280px → 64px. Bottom: user avatar + name (hidden collapsed), theme toggle. Mobile: shadcn Sheet. `usePathname()` for active detection. Keyboard accessible.

### Task H7: Agent Card Component (was Qwen Q2)
Create `app/components/agent-card.tsx`. Props: `{ agent: AgentData }` (id, name, role, model, status, totalTasks, successRate, avgDuration, lastActive, currentTask?). Card header (name + role badge), status section (colored dot + text, pulse when active), stats row (tasks | success % | avg time), current task if running, footer (last active + "View Details"). Status colors: active=green-500, idle=slate-400, error=red-500, offline=slate-300. Role badge unique colors per role. Hover elevation. Click handler.

### Task H8: Build Row + Activity Components (was Qwen Q3-Q4)
Create `app/components/build-row.tsx`. Table row: Build ID (mono, truncated 8 chars + tooltip), Name, Status Badge, Duration (formatted or "Running..." with timer), Agents (count + mini stack), Tasks (progress "12/15" + mini bar), Started (relative), Actions (kebab: View, Re-run, Delete). Active build: pulsing green left border. Failed: red border. Row click → onClick.

Create `app/components/activity-item.tsx`. Props: `{ activity: ActivityData }` (agentName, agentRole, action, details?, status, timestamp). Agent avatar (colored circle + first letter), content (name bold + action, details muted, relative time), status dot.

Create `app/components/activity-feed.tsx`. Container with real-time updates. Props: `{ activities, isLive?, maxItems?, onLoadMore? }`. "Live" indicator (pulsing green). New item slide-down animation. Auto-scroll unless user scrolled up. "Load More" at bottom. Empty state.

### Task H9: Loading Skeletons + Error Boundary + Empty State (was Qwen Q5-Q7)
Create `app/components/loading-skeleton.tsx`. Export: `AgentCardSkeleton`, `BuildRowSkeleton`, `ActivityItemSkeleton`, `StatCardSkeleton`, `SidebarSkeleton`, `PageSkeleton`. All use shadcn Skeleton with shimmer. Accept `count?` prop. Pixel-perfect match to real components (no layout shift).

Create `app/components/error-boundary.tsx`. Class component with `componentDidCatch`. Props: `{ fallback?, onError?, onRetry? }`. Default: warning icon, "Something went wrong", error message (dev only), "Try Again" button, "Report Issue" link.

Create `app/components/empty-state.tsx`. Props: `{ icon?, title, description?, actionLabel?, onAction?, variant? }`. Variants: default (centered, max-w-400px), compact (smaller, for cards), illustration (larger). Pre-built exports: `EmptyBuilds`, `EmptyAgents`, `EmptyActivity`, `EmptySearch`, `EmptySettings`.

### Task H10: Data Table Component (was Qwen Q8)
Create `app/components/data-table.tsx`. Generic reusable table on shadcn Table. Props: `{ columns: ColumnDef[], data: T[], isLoading?, emptyState?, onRowClick?, pagination?, sorting? }`. Sortable columns (click header, arrow indicator). Pagination (page numbers + prev/next, page size 10/20/50). Loading state (skeleton rows). Empty state. Row hover + click. Responsive: horizontal scroll on mobile with sticky first column.

Create `app/components/pagination.tsx`. Props: `{ currentPage, totalPages, onPageChange, pageSize, onPageSizeChange }`. "Showing 1-20 of 147" + page buttons + size selector.

### Task H11: Component Barrel Export + Fixtures (was Qwen Q11)
Create `app/components/index.ts` — barrel export all components. Create `app/components/__fixtures__/`: `mock-agents.ts` (21 agents), `mock-builds.ts` (10 builds), `mock-activities.ts` (50 items), `mock-workflows.ts` (3 templates). Typed constants for tests and dev. Verify all components import from barrel, render without errors, pass `tsc --noEmit`.

### Task H12: Index Optimization + Query Performance (was Haiku H6)
Audit ALL Convex queries. Verify each uses an index (no full table scans). Cross-reference with `convex/schema.ts`. Optimize `getAgentStats` — consider pre-computing in `agentStatsCache` table via cron or incremental on task completion. Add `.paginate()` to all list queries returning 100+ results. Add `withIndex()` explicitly. Benchmark at 100, 1000, 10000 rows.

### Task H13: Convex Cron Jobs (was Haiku H7)
Create `convex/crons.ts`. `cleanupOldActivity` — hourly, delete items >7 days. `computeAgentStats` — every 5 min, aggregate to `agentStatsCache`. `checkStalledBuilds` — every 10 min, mark builds "running" with no update in 30 min as "stalled". Register with `cronJobs()`. Create `convex/internal.ts` for internal functions. Write 10+ tests.

### Task H14: Webhook + HTTP Actions (was Haiku H8)
Create `convex/webhooks.ts`. `handleGitHubWebhook` HTTP action — GitHub push/PR events → activity. `handleBuildComplete` — external CI notification. `handleAlertWebhook` — monitoring alerts → activity. All: validate signatures (HMAC-SHA256), rate limit (100/min/source), log requests. Create `convex/http.ts` — register routes: `POST /webhooks/github`, `/build`, `/alert`. Write 15+ tests.

### Task H15: Production Deployment (was Haiku H9)
Deploy Convex: `npx convex deploy`. Verify tables, indexes, functions. Deploy Next.js to Vercel: connect repo, set env vars, trigger build. Verify production URLs. Smoke test: sign up → sign in → dashboard → data visible → sign out. Check Convex dashboard: no errors, <200ms queries. Document in `.nova/DEPLOYMENT-LOG.md`.

### Task H16: Monitoring + Health (was Haiku H10)
Create `convex/monitoring.ts`. `getSystemHealth` query: function calls/hour, error rate, avg latency, active subscriptions, DB size estimate. `getErrorLog` query: last 100 errors grouped by function. `logError` internal mutation: function name, message, stack, timestamp, userId. Add try/catch with `logError` to ALL mutations. Health endpoint: `GET /health` → `{ status: "ok", timestamp, version }`.

### Task H17: Seed Data (was Haiku H11)
Create `convex/seed.ts`. One-time mutation: populate 21 agents (name, role, model, status "idle"), 5 sample builds (various statuses), 20 sample tasks, 50 activity feed items spanning 24h. Makes dashboard look alive for demos. Create `convex/migrations.ts`: version tracking, up/down functions, idempotent. Migration 001: backfill nulls with defaults.

---

## KIMI 2.5 — "The Implementer" (Expanded)

**Provider**: Moonshot (swarm)
**Now owns**: Everything in `src/` except orchestrator/ralph-loop.ts — integrations, LLM, swarm, workflow, collaboration, observability, memory, model-db
**Cannot touch**: `convex/`, `app/`

> You already completed or started Tasks K1-K3 from the original sprint (Perplexity client, research agent, caching/cost control). Continue from K4 below, which now includes all work that was assigned to Qwen (workflow engine), GLM (CRDT), and Llama 4 Maverick (observability, memory, model-db).


### Task K4: Agent Model Routing — Core UCB Router (was Kimi K4)
Spec: `.nova/specs/grok-r22-01-model-routing.md`. Create `src/llm/model-router.ts`. `ModelRouter` class. `route(agentId, taskType, constraints)` → `{ model, reason, confidence, estimatedCost, estimatedLatency }`. UCB algorithm: `ModelStats` per model (totalCalls, totalReward, avgLatency, avgCost, successRate). UCB score = `avgReward + sqrt(2 * ln(totalCalls) / modelCalls)`. Select highest UCB satisfying constraints. `updateStats(model, result)`. `getModelRanking(taskType)`. Model registry: `src/llm/model-registry.ts` with configs for Ollama, Anthropic, OpenRouter models. Write 25+ tests.

### Task K5: Agent Model Routing — Speculative Decoding (was Kimi K5)
Create `src/llm/speculative-decoder.ts`. Use fast model for draft, strong model to verify. `speculativeDecode(prompt, draftModel, verifyModel, options?)` → `{ output, draftAcceptRate, totalLatency, costSaved }`. Track acceptance rate per model pair — if <30%, stop using speculative for that pair. `SpeculativeDecodingManager` decides when to use speculative vs direct based on task complexity, latency budget, cost budget. Write 20+ tests.

### Task K6: Agent Model Routing — Profiles + Cost Optimizer (was Kimi K6-K7)
Create `src/llm/agent-profiles.ts`. Routing profiles for all 21 agents: `{ agentId, preferredModels, taskTypeOverrides, costBudgetPerHour, qualityThreshold, latencyBudget }`. `ProfileManager`: get/update/reset profiles. `optimizeProfiles()` — analyze history, suggest adjustments.

Create `src/llm/cost-optimizer.ts`. `CostOptimizer`: `setBudget(daily, hourly?, perAgent?)`, `canAfford(model, tokens)`, `recordSpend(model, in, out)`, `getSpendReport(period)`. Smart downgrade: 80% → cheaper models, 95% → critical tasks only, 100% → queue non-critical. `CostProjector` — project exhaustion, alert at 50/75/90%. Wire into ModelRouter. Write 15+ tests each.

### Task K7: Swarm Multi-Model Orchestration (was Kimi K8)
Create `src/swarm/multi-model-swarm.ts`. `MultiModelSwarm`: `executeParallel(tasks)` — route each via ModelRouter, execute all parallel, handle partial failures. `executeSequential(pipeline)` — chain tasks, switch models between steps. `executeFanOut(task, models)` — same task on multiple models, return best/consensus. Circuit breaker per model: 3 failures in 5 min → remove for 10 min. Wire into existing swarm. Write 15+ tests.

### Task K8: Eval Framework — Types + Registry + Scoring (was Llama L1-L2)
Spec: `.nova/specs/grok-r23-eternal-symphony.md` (R23-05). Create `src/observability/types.ts`: `EvalCase`, `EvalResult`, `EvalSuite`, `ScoringFunction`, `EvalRun`, `EvalSummary`. Create `src/observability/eval-registry.ts`: `registerSuite`, `getSuite`, `listSuites`, `removeSuite`. Zod validation.

Create `src/observability/scoring.ts`: `exactMatch`, `fuzzyMatch` (Levenshtein), `containsMatch`, `jsonMatch` (deep partial), `semanticSimilarity` (TF-IDF cosine), `codeMatch` (whitespace-normalized), `compositeScore` (weighted). All handle null/undefined gracefully. Write 35+ tests total.

### Task K9: Eval Framework — Runner + Golden Sets (was Llama L3-L4)
Create `src/observability/eval-runner.ts`. `EvalRunner.run(suiteId, targetFn, options?)` — execute cases with configurable concurrency (default 5). Per-case: call target, measure latency, score, pass/fail against threshold. Handle timeout, errors, scoring errors. Progress callback. Summary stats (avg/p50/p95 latency, pass rate).

Create `src/observability/golden-sets.ts`. `GoldenSet` extends EvalSuite with version, dates. `createGoldenSet`, `updateGoldenSet` (version increment), `compareToGolden(run)` → regressions/improvements/unchanged. `promoteRunToGolden`. Regression report. Write 30+ tests total.

### Task K10: Eval Framework — Persistence + Reporting (was Llama L5-L6)
Create `src/observability/eval-store.ts`. JSON file-based storage. `saveRun`, `getRun`, `listRuns(suiteId, options)`, `saveGoldenSet`, `getGoldenSet`, `getRunHistory`. `analyzeTrend(suiteId, window)` → direction (improving/degrading/stable), score/latency/passRate changes.

Create `src/observability/eval-reporter.ts`. `generateReport(run, options)` — markdown/JSON/HTML. Summary table, per-case results, regression section, recommendations. `generateDiffReport(runA, runB)`. `generateTrendReport(suiteId, runs)`. Write 25+ tests total.

### Task K11: Infinite Memory — Core Store + Retrieval (was Llama L7-L8)
Spec: `.nova/specs/grok-r23-eternal-symphony.md` (R23-03). Create `src/memory/memory-store.ts`. Hierarchy: L1 (Working, max 100), L2 (Session, max 1000), L3 (Long-term, unlimited). `MemoryItem`: id, content, embedding?, tags, importance (0-1), createdAt, accessedAt, accessCount, level. `store(content, tags, importance?)` → L1. `retrieve(query, options?)` → ranked results across levels. `promote`/`demote`. `compress(level)` — summarize + merge similar. LRU eviction when capacity exceeded.

Create `src/memory/memory-retriever.ts`. Strategies: keyword (TF-IDF), semantic (cosine on embeddings), temporal (recency decay), importance, hybrid (weighted combo). `RelevanceScorer`: text similarity + recency decay + importance + frequency + tag match. `MemoryIndex` — inverted index for fast keyword lookup. Write 40+ tests total.

### Task K12: Infinite Memory — Compression (was Llama L9)
Create `src/memory/memory-compressor.ts`. Strategies: `merge` (>80% overlap → combine), `summarize` (group by tag, extract key phrases), `prune` (below importance threshold + stale), `archive` (cold storage file). `CompressionScheduler`: auto-compress L1 at 80% full, L2 at 90%. Track history: `{ timestamp, level, itemsBefore, itemsAfter, strategy, bytesFreed }`. `decompressArchive(query)` — search archived, restore to L3. Write 15+ tests.

### Task K13: AI Model Database — Registry + Matching (was Llama L10-L11)
Spec: `.nova/specs/grok-r24-immortal-omniverse.md` (R24-01). Create `src/model-db/model-registry.ts`. `ModelEntry`: id, name, provider, family, version, capabilities (name+score), pricing (in/out per MToken), performance (latency p50/p95, throughput, context window, max output), limits (rate, concurrent), status. `ModelRegistry`: register, get, list(filters), update, deprecate. Pre-populate: Ollama, Anthropic (Sonnet/Haiku/Opus), OpenRouter models.

Create `src/model-db/capability-matcher.ts`. `findBestModel(requirements, constraints)` → ranked models. Filter by hard constraints, score by: capability match + cost efficiency + latency + locality bonus. `CostCalculator`: `estimateCost`, `compareCosts`, `findCheapestModel`. Wire into model router. Write 30+ tests total.

### Task K14: Visual Workflow Engine — Core (was Qwen Q9)
Spec: `.nova/specs/grok-r23-eternal-symphony.md` (R23-01). Create `src/workflow/workflow-engine.ts`. `WorkflowEngine`: DAG of Steps + Edges. `createWorkflow(name, steps, edges)` → WorkflowId. `executeWorkflow(workflowId, input)` → ExecutionId. `getExecutionStatus`. `pauseExecution`, `resumeExecution`, `cancelExecution`. Step types: task, decision (conditional branch), parallel (fan-out), join (wait all), human (pause for approval). Persistence: serialize/deserialize JSON for crash recovery. Zod schemas. Write 20+ tests.

### Task K15: Visual Workflow Engine — Visualization + Templates (was Qwen Q10)
Create `src/workflow/workflow-visualizer.ts`. `toVisualizationData(workflow, execution?)` → `{ nodes: VisNode[], edges: VisEdge[], layout }`. Auto-layout: topological sort → layers → minimize crossings → x/y positions. Nodes colored by status (pending=gray, running=blue animated, completed=green, failed=red). Edges animated when active.

Create `src/workflow/workflow-templates.ts`. Pre-built: `linearBuild` (plan→code→test→review→deploy), `parallelAgents` (fan-out N, join), `reviewPipeline` (code→test→if pass: deploy, if fail: fix→test). Write 15+ tests.

### Task K16: CRDT Collaboration — Engine + Sync (was GLM G9-G10)
Spec: `.nova/specs/grok-r24-immortal-omniverse.md` (R24-03). Create `src/collaboration/crdt-engine.ts`. `CRDTDocument`, `Operation` (with vector clock), `VectorClock`. Implement: LWW-Register (key-value), G-Counter (grow-only), OR-Set (add/remove). Each: `merge(local, remote)` deterministic, `apply(op)`, `serialize()`/`deserialize()`.

Create `src/collaboration/sync-protocol.ts`. `SyncManager`: `connect(docId)`, `disconnect()`, `broadcastOperation`, `receiveOperation` (merge remote), `getState()`, `getPendingOps()`. Optimistic local apply → send → rollback if rejected. Presence: `updatePresence(cursor, selection?)`, `getPresences()`. Write 45+ tests total (commutativity, associativity, idempotency, convergence, presence).

### Task K17: Observability Bridge + Integration (was Kimi K9)
Create `src/integrations/observability-bridge.ts`. Bridge model router ↔ eval framework. Log every routing decision, model call, speculative decoding attempt. `RouterDashboard` data provider: model usage distribution, cost over time, latency percentiles, UCB score evolution. Zod schemas for all log entries. Write 10+ tests.

### Task K18: End-to-End Integration + Hardening (was Kimi K10)
Integration test the complete flow: Agent → ModelRouter → SpeculativeDecoder → LLM call → CostOptimizer → ObservabilityBridge → Stats update. Create `src/llm/integration.test.ts` with 20+ tests: full routing, budget exhaustion downgrade, speculative latency improvement, UCB convergence after 50+ tasks, circuit breaker activation, cost projection accuracy. Edge cases: empty registry, all models circuit-broken, $0 budget, Perplexity API down. `tsc --noEmit` = 0 across all `src/` files.

---

## REVISED TIMELINE (3 Workers)

```
WAVE 1 (Hours 0-8): MVP Foundation
├── Sonnet: S1-S6 (DONE/IN PROGRESS) → S7-S12 (dashboard UI)
├── Haiku:  H1-H5 (DONE/IN PROGRESS) → H6-H9 (components)
└── Kimi:   K1-K3 (DONE/IN PROGRESS) → K4-K6 (model routing)

WAVE 2 (Hours 8-16): Features + Polish
├── Sonnet: S13-S16 (landing nav, responsive, polish, search)
├── Haiku:  H10-H14 (data table, fixtures, indexes, crons, webhooks)
└── Kimi:   K7-K10 (swarm, eval framework)

WAVE 3 (Hours 16-24): Frontier + QA
├── Sonnet: S17-S21 (QA, security, smoke test, hardening, accessibility)
├── Haiku:  H15-H17 (deploy, monitoring, seed data)
└── Kimi:   K11-K18 (memory, model-db, workflow, CRDT, integration)
```

---

## TASK COUNT SUMMARY

| Worker | Original Tasks | Absorbed From | New Total |
|--------|---------------|---------------|-----------|
| Sonnet 4.6 | 11 (S1-S11) | DeepSeek (11), GLM (6), Mistral (11) | 21 (S1-S21) |
| Haiku 4 | 11 (H1-H11) | Qwen (11) | 17 (H1-H17) |
| Kimi 2.5 | 10 (K1-K10) | Llama (11), Qwen workflow (2), GLM CRDT (2) | 18 (K1-K18) |
| **TOTAL** | **32** | **+54 absorbed** | **56 tasks** |

---

*Redistributed by Kiro (Opus 4.6) — February 20, 2026*
*All 5 dropped workers' tasks fully covered. No work lost.*
