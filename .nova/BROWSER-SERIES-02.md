# SERIES 2: Wave 1 Support — Hours 0-4

## GROK 4.2

Landing page production audit. Review all components in `app/(landing)/`.

Check each component for:
1. Accessibility: ARIA labels, keyboard nav, color contrast WCAG AA (4.5:1), focus indicators, semantic HTML, heading hierarchy.
2. Responsive: 375px, 768px, 1024px, 1440px. Overflow? Truncation? Image scaling?
3. Performance: Next.js Image component? Large bundle imports? Unnecessary re-renders? Heavy animations?
4. Hardcoded values: URLs, API endpoints, content that should be dynamic/env vars?
5. SEO: Meta tags? OG tags? Structured data? Canonical URL?
6. Code quality: TypeScript strict? Component composition? Reusable patterns?

OUTPUT: Component-by-component audit table (name, issues, severity, fix), priority fixes list, effort estimates.

---

## GEMINI 3.1

GEMINI-07: Agent Communication Protocols research.

1. MCP (Anthropic) — how it works, limitations, agent-to-agent suitability
2. ACP (IBM) — compare to MCP, what it adds, production readiness
3. A2A (Google) — differences from MCP/ACP, adoption status
4. Competing AI IDEs: Cursor, Windsurf, Cline, Aider — how they handle multi-agent coordination
5. Orchestration patterns for 21 agents: hub-and-spoke vs mesh, message queue patterns, shared vs isolated context, handling agent disagreements

OUTPUT: Comparison matrix (MCP vs ACP vs A2A), recommended architecture for Nova26, implementation roadmap, code examples.

---

## CHATGPT 5.2

Rewrite Nova26 README.md. Make it compelling and developer-friendly.

Context: AI IDE, 21 agents, Ralph Loop orchestrator. TypeScript, React 19, Next.js 15, Tailwind, shadcn/ui, Convex, Ollama. 4,007 tests, 0 TS errors, engine ~85% done.

Sections: Hero (badges), What is Nova26 (2-3 paragraphs), The 21 Agents (table), Tech Stack, Quick Start (clone→install→configure→run), Architecture Overview (ASCII diagram), Project Structure, Development, Deployment, Roadmap.

OUTPUT: Complete README.md content ready to commit.

---

## PERPLEXITY

Research exact steps for Convex Auth + Next.js 15 App Router integration. Need copy-paste code snippets.

1. Convex Auth setup: packages to install, `convex/auth.config.ts` exact content (password + GitHub OAuth), `convex/auth.ts` exact content, auth tables in schema
2. Next.js 15: `app/providers.tsx` ConvexProviderWithAuth setup, `middleware.ts` for protecting /dashboard/*, getting current user in Server vs Client components, auth redirects
3. Auth UI: sign-in form calling Convex Auth, sign-up form with validation, user button with sign-out, loading state handling
4. Common issues: hydration mismatches, cookie vs token auth, CORS in development

OUTPUT: Step-by-step guide with exact code per file, package versions included.
