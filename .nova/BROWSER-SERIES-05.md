# SERIES 5: Wave 2 Kickoff — Hours 8-10

## GROK 4.2

Architecture review of the Engine → Convex Bridge (built by Sonnet in Wave 1).

Review `src/convex/bridge.ts` and validate:
1. Does the bridge correctly map ralph-loop engine output to Convex mutations? Check: BuildResult → builds table, TaskResult → tasks table, ExecutionLog → executions table, ActivityEvent → agentActivityFeed table.
2. Are Zod schemas correct and complete? Do they match the Convex schema validators?
3. Error handling: what happens on network failure? Convex rate limiting? Invalid data? Does it retry? Does it queue?
4. Performance: is it batching writes where possible? Or making individual mutation calls for each event?
5. Type safety: are the TypeScript types between the engine (src/) and Convex (convex/) compatible? Any implicit any or type assertions?
6. Testing: review bridge tests — are they comprehensive? Do they cover error paths?

Also review the auth integration:
- Does the middleware correctly protect /dashboard/* routes?
- Does the auth flow handle edge cases (expired tokens, concurrent sessions, sign-out from multiple tabs)?

OUTPUT: Detailed review with pass/fail per check, specific code issues, recommended fixes.

---

## GEMINI 3.1

GEMINI-09: AI-Native Testing & Quality Assurance research.

1. AI Code Bug Patterns: What are the most common bugs in AI-generated code? (type errors, logic errors, missing edge cases, incorrect API usage, hallucinated imports). How to detect them automatically?
2. Auto-Fix Frameworks: Tools that automatically fix AI-generated code errors. Compare: TypeScript compiler suggestions, ESLint auto-fix, AI-powered fix suggestions (like Copilot's "fix this"). What's the state of the art?
3. Eval Frameworks: Compare Braintrust, promptfoo, LangSmith, Ragas for evaluating LLM outputs. Which is best for evaluating code generation quality? Which works offline (no cloud dependency)?
4. Quality Gates for AI Output: How to implement automated quality gates that AI-generated code must pass before being accepted. Pattern: generate → lint → type-check → test → review → accept/reject.
5. Property-Based Testing for AI: Can we use property-based testing (fast-check, Hypothesis) to test AI agent behavior? What properties should hold? (idempotency, determinism, bounded output size, valid syntax)

OUTPUT: Research report with: bug pattern taxonomy, auto-fix tool comparison, eval framework comparison matrix, quality gate architecture, property-based testing strategy for agents.

---

## CHATGPT 5.2

Write CONTRIBUTING.md for Nova26.

Sections:
1. Welcome: brief intro, code of conduct reference, how contributions work
2. Development Setup: link to GETTING-STARTED.md, additional setup for contributors (fork, branch naming: `feat/`, `fix/`, `docs/`)
3. The 21-Agent System: explain that agents are markdown templates, not code. How to modify agent behavior. How to add a new agent.
4. Code Style: TypeScript strict, ESM imports with .js extensions, Tailwind only (no CSS modules), shadcn/ui for components, Convex patterns (validators, auth, indexes)
5. Domain Map: which files belong to which domain. Workers should only modify files in their domain. Cross-domain changes need coordinator approval.
6. Testing Requirements: every new function needs tests, vitest for unit tests, mock all I/O, 5 UI states for every component
7. PR Process: create branch → make changes → run `tsc --noEmit` (0 errors) → run `vitest run` (0 failures) → create PR → code review → merge
8. Commit Convention: `feat(domain): description`, `fix(domain): description`, `docs(domain): description`, `test(domain): description`
9. Architecture Decisions: ADRs live in `.nova/specs/`, how to propose a new ADR
10. Getting Help: where to ask questions, how to report bugs, how to request features

OUTPUT: Complete CONTRIBUTING.md ready to commit.

---

## PERPLEXITY

Research shadcn/ui component best practices for the Nova26 dashboard.

1. Which shadcn/ui components are best for: data tables (Table vs DataTable), navigation (Sidebar patterns), status indicators (Badge variants), real-time feeds (ScrollArea + custom), settings forms (Form + Input + Select)?
2. shadcn/ui + Next.js 15 App Router: any known issues? Server Component compatibility? "use client" requirements?
3. Dark mode implementation: next-themes + shadcn/ui integration, CSS custom properties approach, how to handle charts (recharts) in dark mode
4. Accessibility: which shadcn/ui components have built-in accessibility? Which need additional ARIA attributes? Common accessibility pitfalls with shadcn/ui?
5. Performance: are there heavy shadcn/ui components to avoid? Bundle size impact? Tree-shaking effectiveness?
6. Custom theming: how to customize shadcn/ui colors for Nova26's brand (dark tech aesthetic), how to add custom variants to existing components

OUTPUT: Best practices guide with component recommendations per use case, code examples, accessibility checklist, performance tips.
