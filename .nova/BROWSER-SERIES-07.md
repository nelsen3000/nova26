# SERIES 7: Wave 2 Wrap-Up — Hours 14-16

## GROK 4.2

Review the Perplexity integration (src/integrations/perplexity-client.ts, perplexity-research-agent.ts, perplexity-cache.ts) built by Kimi.

Validate:
1. API client: Is the Perplexity sonar API called correctly? Are request/response schemas accurate? Is error handling comprehensive (429, 401, 5xx, timeout)?
2. Research agent: Do the higher-level methods (researchTopic, compareOptions, factCheck) compose correctly? Is partial failure handling robust?
3. Caching: Is the LRU cache implementation correct? Does TTL expiry work? Is the cache key generation collision-resistant (SHA-256 of query+options)?
4. Cost control: Does the budget enforcement work? What happens when budget is exceeded mid-request? Is cost estimation accurate for Perplexity's pricing?
5. Request deduplication: Does it correctly return existing promises for duplicate in-flight queries? What about race conditions?
6. Integration: Is it properly registered as a tool in the agent system? Can any agent use it?

Also review Llama 4 Maverick's observability eval framework (src/observability/). Is the eval runner correct? Are scoring functions mathematically sound? Is golden set comparison working?

OUTPUT: Technical review with correctness assessment, integration validation, test gap analysis for both modules.

---

## GEMINI 3.1

GEMINI-11: AI Design Systems & Component Generation research.

1. Design token systems: How do modern AI IDEs handle design tokens? Compare: Figma Tokens, Style Dictionary, Tailwind CSS config. How to make tokens AI-readable so agents can generate consistent UI.
2. shadcn/ui ecosystem: What's the current state of shadcn/ui (Feb 2026)? New components? v0.dev integration? How to extend shadcn/ui with custom components that match the design system.
3. Multi-screen journey generation: Can AI generate entire user flows (sign-up → onboarding → dashboard → settings)? What tools exist? How to maintain consistency across screens?
4. Screenshot-to-code: Current state of screenshot/wireframe to React code. Compare: v0.dev, Vercel AI SDK, GPT-4V approaches. Accuracy? Tailwind output quality?
5. Component library management: How to maintain a component library that AI agents can use. Component documentation format that's both human and AI readable. Storybook alternatives for AI-first workflows.

OUTPUT: Research report with: design token architecture for Nova26, shadcn/ui extension guide, multi-screen generation feasibility, screenshot-to-code tool comparison, component library strategy.

---

## CHATGPT 5.2

Update PROJECT_REFERENCE.md with the current Nova26 architecture.

Document:
1. System Architecture: ASCII diagram showing all layers (Landing → Auth → Dashboard → Convex → Engine → Agents → LLM). Include the new components built today.
2. Data Flow: How data moves through the system. User action → React component → Convex mutation → database → subscription → UI update. Include the bridge pattern (engine → Convex).
3. Agent System: How the 21 agents work. Ralph Loop orchestration. Agent templates (markdown). Model routing (UCB algorithm). Task assignment and execution.
4. Technology Decisions: Why Convex (not PostgreSQL), why React 19 (not Svelte), why Tailwind (not CSS modules), why Ollama (not cloud-only LLM), why shadcn/ui (not Material UI).
5. File Structure: Updated directory tree with descriptions of each major directory and key files.
6. Testing Strategy: Vitest for unit tests, mock patterns, test file naming convention, coverage goals.
7. Deployment Architecture: Vercel (frontend) + Convex Cloud (backend) + Ollama (local LLM). How they connect.

OUTPUT: Complete PROJECT_REFERENCE.md update ready to commit.

---

## PERPLEXITY

Research Convex cron jobs, scheduled functions, and background tasks.

1. Convex cron jobs: How to define recurring tasks. Syntax for `cronJobs()`. Minimum interval? Can crons call mutations? Can they call external APIs?
2. Scheduled functions: `ctx.scheduler.runAfter()` and `ctx.scheduler.runAt()`. Use cases: delayed notifications, cleanup tasks, retry logic. How to cancel scheduled functions.
3. Background processing patterns: Long-running tasks in Convex. Action functions vs mutation functions. How to handle tasks that take >10 seconds (Convex function timeout limits).
4. Rate limiting in Convex: How to implement rate limiting using Convex tables. Token bucket vs sliding window. Example implementation for auth endpoints.
5. Data cleanup patterns: How to implement TTL (time-to-live) for Convex documents. Cron-based cleanup vs on-read cleanup. Best practices for managing growing tables.

OUTPUT: Implementation guide with exact code for cron jobs, scheduled functions, rate limiting, and data cleanup. Include Convex-specific gotchas.
