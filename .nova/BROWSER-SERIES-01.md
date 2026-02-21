# SERIES 1: Pre-Sprint Architecture Validation

## GROK 4.2

Review `convex/schema.ts` from the Nova26 repo. Before 8 coding workers start building in parallel, validate the foundation.

1. All 14 tables have appropriate indexes for dashboard queries:
   - `builds` needs: by_company, by_status, by_startedAt
   - `tasks` needs: by_build, by_agent, by_status
   - `agentActivityFeed` needs: by_timestamp, by_agent
   - `userProfiles` needs: by_tokenIdentifier
   - `agents` needs: by_name, by_status
2. Missing tables needed for dashboard? (session tracking, rate limiting, error logging, notification prefs, API key storage)
3. Schema design issues? (missing required fields, v.any() usage, missing relationships, unindexed query fields)
4. Review 7 existing Convex function files for best practices and validator correctness.

OUTPUT: Table-by-table analysis with pass/fail per index, recommended additions, issues with severity, code snippets for fixes.

---

## GEMINI 3.1

Research best practices for Convex + Next.js 15 App Router integration (Feb 2026).

1. Recommended ConvexProvider setup for Next.js 15 App Router? New patterns for Server Components + Convex?
2. Convex Auth configuration with Next.js 15? Middleware pattern for protecting routes?
3. Known gotchas with Convex + React 19? use() hook compatibility? Hydration issues? Suspense + Convex subscriptions?
4. Convex + Vercel deployment? Env var config, build commands, edge function compatibility?
5. Compare Convex Auth vs Clerk vs NextAuth for a Convex-backed app — simplest for a sprint?

OUTPUT: Research report with code snippets, priority matrix, gotchas list with workarounds, recommended package versions.

---

## CHATGPT 5.2

Write a detailed dashboard UI specification for Nova26. This spec goes to 3 frontend workers building in parallel — must be precise.

Nova26: AI IDE with 21 agents. Dashboard shows agent activity, build history, system status. Tech: React 19, Tailwind, shadcn/ui, Convex.

Specify: Component hierarchy (Layout→Sidebar+Header+Main, Overview→StatCards+AgentGrid+ActivityFeed, Builds→FilterBar+BuildTable+Pagination, Agents→FilterBar+AgentCardGrid, Settings→Tabs+Forms). For each component: TypeScript props interface, Convex data source, 5 UI states, responsive behavior, accessibility. Data flow: Convex queries→hooks→components. Design tokens: colors (light+dark), typography, spacing, status colors, 21 agent role colors.

OUTPUT: Comprehensive markdown document any frontend dev can implement from.

---

## PERPLEXITY

Repo health check on https://github.com/nelsen3000/nova26 before 8 workers start.

1. Package.json: verify next 15+, react 19+, convex, @convex-dev/auth, tailwindcss 4+, shadcn deps. Version conflicts?
2. File structure: next.config.ts? tailwind.config.ts? convex/schema.ts? app/layout.tsx? tsconfig.json?
3. Broken imports: files importing non-existent modules? Circular deps? Missing type declarations?
4. Test health: current pass rate? Persistent failures?
5. Build health: does `npm run build` succeed?

OUTPUT: Structured health report with pass/fail per check, specific fixes needed, priority order.
