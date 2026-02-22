# SONNET 4.6 — Sprint 4: "The Production Bridge"
## February 28 – March 3, 2026 (72 Hours)

> **Provider**: Anthropic (Claude Code terminal)
> **Sprint 3 Status**: COMPLETE — 29 tasks, 6 waves. Spec reconciliation, P2P Hypercore, Hypervisor, A2A PBTs, Landing Page, Dashboard panels, Desktop/Mobile polish, Observability wiring, Full sweep. 9,907 tests, 0 failures, 0 TS errors.
> **Sprint 4 Focus**: Convex backend wiring, Dashboard data integration, E2E user flows, Auth hardening, Landing page polish, Production readiness
> **Duration**: 72 hours (6 waves × 12 hours)
> **Project folder**: `/Users/jonathannelsen/nova26/kiro/nova26`
> **Git HEAD**: latest on origin/main

---

## CURRENT CODEBASE STATE

- 364 test files, ~9,907 tests, 0 TS errors
- Sprint 3 complete: hypercore, hypervisor, a2a specs done, landing page + dashboard panels built
- Kimi Sprint 4 complete: RLM, SAGA, Harness, Hindsight specs done, Convex bridge types created
- Haiku Sprint 6 complete: PBT sweep, deep coverage, cross-module smoke tests
- **Key gaps**: Dashboard panels show mock data (not wired to Convex), auth flow incomplete, no E2E user journey tests, Convex mutations/queries untested against schemas

---

## SPRINT 4 RULES

- TypeScript strict, ESM `.js` imports, vitest, no `any`, mock all I/O
- Convex files go in `convex/` — use Convex patterns (mutation, query, action)
- App files go in `app/` — Next.js 15 + React 19 + Tailwind + shadcn/ui
- Run `tsc --noEmit` after each task — must be 0 errors
- Commit after each task: `feat(S4-XX): <description>`
- Push after each wave checkpoint

---

## DO-NOT-TOUCH ZONES

| Module | Owner | Status |
|--------|-------|--------|
| `src/saga/` | Kimi | Sprint 5 incoming |
| `src/rlm/` | Kimi | Sprint 5 incoming |
| `src/harness/` | Kimi | Sprint 5 incoming |
| `src/hindsight/` | Kimi | Sprint 5 incoming |
| `src/model-routing/` | Haiku | Sprint 7 incoming |
| `src/orchestrator/ralph-loop.ts` | Shared | Read-only unless wiring |

---

## WAVE 1 (Hours 0–12): Convex Backend Wiring

> Target: Wire Convex schemas to real mutations/queries. Kimi created bridge types — now connect them.

### Task S4-01: Pull + Assess + Baseline
Pull latest from main.
Run `tsc --noEmit` — 0 errors.
Run `vitest run` — baseline test count.
Review `convex/schema.ts` — understand current table definitions.
Review Kimi's bridge types: `src/rlm/convex-bridge.ts`, `src/saga/convex-bridge.ts`, `src/harness/convex-bridge.ts`, `src/hindsight/convex-bridge.ts`.

### Task S4-02: Convex Dashboard Queries
Review `convex/dashboard.ts` — extend with real queries:
- `getBuildMetrics`: aggregate build data for dashboard
- `getAgentStatus`: current agent states and performance
- `getInfrastructureHealth`: hypercore, hypervisor, a2a status
- `getRecentActivity`: last N build events for activity feed
Write tests in `convex/dashboard.test.ts` (extend existing).

### Task S4-03: Convex Auth Hardening
Review `convex/auth.ts` and `convex/users.ts`.
Ensure:
- User creation flow is complete (sign-up → company assignment → role)
- Session management works (token refresh, expiry)
- Row-level isolation: all queries filter by `companyId`
Write tests in `convex/auth.test.ts` (extend existing).

### Task S4-04: Convex Module Mutations
Create or extend mutations for the 4 Eternal Data Reel modules:
- `convex/rlm.ts`: store/retrieve compressed contexts
- `convex/saga.ts`: persist evolution sessions, genomes
- `convex/harnesses.ts`: checkpoint CRUD, state transitions
- `convex/hindsight.ts`: fragment storage, retrieval, consolidation triggers
Each mutation validates input against Kimi's bridge types.
Write tests for each.

### Task S4-05: Wave 1 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run `vitest run convex/` — all pass.
Commit + push: `feat(S4-05): Convex backend wiring — dashboard queries, auth, module mutations`

---

## WAVE 2 (Hours 12–24): Dashboard Data Integration

> Target: Wire dashboard panels to real Convex queries. Replace mock data with useQuery hooks.

### Task S4-06: Dashboard Main Page — Live Data
Update `app/dashboard/page.tsx`:
- Wire build metrics cards to `convex/dashboard.ts` queries
- Wire activity feed to real Convex subscription
- Add loading skeletons (shadcn Skeleton component)
- Handle error states with retry
- Handle empty state for new users

### Task S4-07: Infrastructure Panels — Live Data
Update the 4 infrastructure panels in `app/dashboard/infrastructure/components/`:
- `hypercore-status-panel.tsx`: wire to `convex/hypercore.ts` queries
- `hypervisor-sandbox-panel.tsx`: wire to `convex/hypervisor.ts` queries
- `a2a-comm-panel.tsx`: wire to `convex/a2a.ts` queries
- `eternal-reel-panel.tsx`: wire to Eternal Data Reel Convex queries
Each panel: loading skeleton → error state → empty state → populated state.

### Task S4-08: Agents Dashboard Page
Update `app/dashboard/agents/page.tsx`:
- Show all 21 agents with current status
- Wire to agent performance data from `src/agents/performance-tracker.ts`
- Agent capability matrix visualization
- Task assignment history

### Task S4-09: Builds Dashboard Page
Update `app/dashboard/builds/page.tsx` and `app/dashboard/builds/[buildId]/page.tsx`:
- Build list with status indicators
- Build detail view: phases, tasks, agent assignments, duration
- Wire to Convex build data

### Task S4-10: Wave 2 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests — must pass.
Commit + push: `feat(S4-10): Dashboard live data — all panels wired to Convex`

---

## WAVE 3 (Hours 24–36): Auth Flow + User Journey

> Target: Complete sign-in/sign-up flow, protected routes, user settings

### Task S4-11: Auth Pages Polish
Update `app/(auth)/sign-in/page.tsx` and `app/(auth)/sign-up/page.tsx`:
- Form validation (email format, password strength)
- Error messages (invalid credentials, account exists)
- Loading states during auth calls
- Redirect to dashboard on success
- "Forgot password" flow (stub if no email service)

### Task S4-12: Auth Guard + Protected Routes
Update `app/(auth)/components/auth-guard.tsx`:
- Wrap all `/dashboard/*` routes with auth guard
- Redirect unauthenticated users to sign-in
- Handle token expiry gracefully
- Show loading state while checking auth

### Task S4-13: Settings Page
Update `app/dashboard/settings/page.tsx`:
- User profile (name, email, avatar)
- Company settings (name, plan)
- API keys management (create, revoke, list)
- Notification preferences
- Theme toggle (already have next-themes)

### Task S4-14: User Onboarding Flow
Create `app/dashboard/onboarding/page.tsx`:
- Step 1: Welcome + company name
- Step 2: First project setup
- Step 3: Agent configuration preferences
- Step 4: Quick tour / feature highlights
- Progress indicator, skip option

### Task S4-15: Wave 3 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests — must pass.
Commit + push: `feat(S4-15): Auth flow + settings + onboarding complete`

---

## WAVE 4 (Hours 36–48): Landing Page Polish + SEO + Performance

> Target: Make the landing page production-ready

### Task S4-16: Landing Page — Content + Copy
Review `app/(landing)/components/`:
- Hero section: compelling headline, sub-headline, primary CTA
- Stage cards: clear feature descriptions for each Nova26 capability
- Social proof section (placeholder testimonials, GitHub stars counter)
- Pricing section (Free tier, Pro tier, Enterprise — placeholder)
- Footer with links

### Task S4-17: Landing Page — Animations + Polish
Using framer-motion (already in deps):
- Hero section entrance animation
- Stage cards stagger animation on scroll
- CTA button hover/press animations
- Smooth scroll between sections
- Parallax effect on hero background (subtle)

### Task S4-18: Landing Page — SEO + Meta
Create/update `app/(landing)/layout.tsx`:
- Open Graph meta tags
- Twitter card meta tags
- Structured data (JSON-LD for SoftwareApplication)
- Canonical URL
- Sitemap generation stub

### Task S4-19: Landing Page — Mobile Optimization
Test and fix all landing page components at:
- 375px (iPhone SE)
- 390px (iPhone 14)
- 768px (iPad)
- 1024px (iPad landscape)
- 1280px+ (desktop)
Fix any overflow, text truncation, or layout breaks.

### Task S4-20: Wave 4 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests — must pass.
Commit + push: `feat(S4-20): Landing page production-ready — content, animations, SEO, mobile`

---

## WAVE 5 (Hours 48–60): E2E User Flow Tests + Contract Tests

> Target: Test the full user journey from landing page to dashboard

### Task S4-21: E2E — Landing to Sign-Up Flow
Create `src/__tests__/e2e-user-journey.test.ts`:
- Landing page renders all sections
- CTA click navigates to sign-up
- Sign-up form validates inputs
- Successful sign-up redirects to onboarding
- Onboarding completes and redirects to dashboard

### Task S4-22: E2E — Dashboard Navigation
Create `src/__tests__/e2e-dashboard-nav.test.ts`:
- Dashboard main page loads with metrics
- Navigate to Agents page — shows 21 agents
- Navigate to Builds page — shows build list
- Navigate to Infrastructure page — shows 4 panels
- Navigate to Settings page — shows user profile
- Sidebar navigation works correctly

### Task S4-23: E2E — Build Lifecycle
Create `src/__tests__/e2e-build-lifecycle.test.ts`:
- Create new build from dashboard
- Build progresses through phases (plan → execute → test → deliver)
- Agent assignments visible during build
- Build completion shows results
- Build detail page shows full history

### Task S4-24: Convex Contract Tests
Create `convex/__tests__/convex-contracts.test.ts`:
- All mutations validate required fields
- All queries filter by companyId (row-level isolation)
- Schema validators reject invalid data
- Index queries return correct results
- Pagination works correctly

### Task S4-25: Wave 5 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests — must pass.
Commit + push: `test(S4-25): E2E user flows + Convex contract tests`

---

## WAVE 6 (Hours 60–72): Hypercore/Hypervisor Convex + Production Sweep

> Target: Bridge remaining modules to Convex, final production readiness

### Task S4-26: Hypercore + Hypervisor + A2A Convex Bridge Types
Create Convex bridge types for the 3 remaining modules (matching Kimi's pattern):
- `src/hypercore/convex-types.ts` + `src/hypercore/convex-bridge.ts`
- `src/hypervisor/convex-types.ts` + `src/hypervisor/convex-bridge.ts`
- `src/a2a/convex-types.ts` + `src/a2a/convex-bridge.ts`
Ensure bridge types match `convex/hypercore.ts`, `convex/hypervisor.ts`, `convex/a2a.ts` schemas.

### Task S4-27: Error Boundary + Global Error Handling
Create `app/components/error-boundary.tsx`:
- React error boundary wrapping dashboard
- Fallback UI with error details + retry button
- Global unhandled rejection handler
- Report errors to observability system

### Task S4-28: Performance Audit
- Check bundle size: `app/` should be < 500KB initial JS
- Verify code splitting: each dashboard page lazy-loaded
- Image optimization: all images use Next.js Image component
- Font optimization: preload critical fonts
- Document findings and fixes

### Task S4-29: Full Test Suite Sweep
Run `vitest run` — full suite.
Fix any failures.
Run `tsc --noEmit` — 0 errors.
Verify 0 regressions from Sprint 3.

### Task S4-30: Final Checkpoint
Run ALL tests — must pass.
Commit + push: `feat(S4-30): Sprint 4 complete — Convex wired, dashboard live, auth done, landing polished`

---

## TASK COUNT SUMMARY

| Wave | Hours | Tasks | Focus |
|------|-------|-------|-------|
| Wave 1 | 0–12 | S4-01 → S4-05 | Convex backend wiring |
| Wave 2 | 12–24 | S4-06 → S4-10 | Dashboard live data |
| Wave 3 | 24–36 | S4-11 → S4-15 | Auth flow + user journey |
| Wave 4 | 36–48 | S4-16 → S4-20 | Landing page production-ready |
| Wave 5 | 48–60 | S4-21 → S4-25 | E2E tests + Convex contracts |
| Wave 6 | 60–72 | S4-26 → S4-30 | Remaining bridges + production sweep |
| **TOTAL** | **72h** | **30 tasks** | **Convex wired, dashboard live, auth complete, landing polished, E2E tested** |

---

## PRIORITY ORDER (If Running Behind)

1. **Wave 1** (Convex wiring) — everything depends on backend queries
2. **Wave 2** (Dashboard live data) — highest user-visible impact
3. **Wave 3 S4-11-12** (Auth + guard) — security critical
4. **Wave 4 S4-16** (Landing content) — first impression
5. **Wave 5** (E2E tests) — confidence in user flows
6. **Wave 6** (Bridges + sweep) — completeness

---

*Sprint 4 created by Kiro (Opus 4.6) — February 28, 2026*
