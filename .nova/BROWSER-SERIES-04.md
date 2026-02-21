# SERIES 4: Wave 1 Wrap-Up — Code Review

## GROK 4.2

Code review all Wave 1 output from the 8 coding workers (hours 0-8).

Focus areas:
1. TypeScript strict compliance: any `any` types? Implicit any? Missing return types? Proper generics usage?
2. Convex patterns: all functions use validators? All mutations check auth? Queries use indexes? No full table scans?
3. React 19 patterns: proper "use client" directives? Server Components not importing client hooks? Correct use of use() hook?
4. Security: no hardcoded secrets? No dangerouslySetInnerHTML? Input validation on all user-facing forms? Auth checks on all protected routes?
5. Performance: no N+1 queries? Proper React.memo/useMemo usage? No unnecessary re-renders? Images using Next.js Image component?
6. Accessibility: ARIA labels on icons? Alt text on images? Keyboard navigation? Focus management?

Review these file domains:
- Sonnet: next.config.ts, app/providers.tsx, app/(auth)/, src/convex/bridge.ts
- Haiku: convex/dashboard.ts, convex/auth.ts, convex/realtime.ts, convex/users.ts
- DeepSeek: app/(dashboard)/ pages
- Qwen: app/components/
- GLM: app/(landing)/ fixes
- Kimi: src/integrations/perplexity-client.ts, src/llm/model-router.ts

OUTPUT: Per-worker review with issues found, severity, fix recommendations. Flag any cross-worker integration issues.

---

## GEMINI 3.1

Import key source files from the Nova26 repo and analyze test coverage gaps.

1. Identify modules in `src/` with 0 test files (no corresponding .test.ts)
2. Identify modules with weak coverage (test file exists but only tests happy path, no edge cases)
3. For the dashboard code being built today: what tests are critical? Prioritize: auth flow tests, Convex function tests, component rendering tests, integration tests
4. Analyze the existing 151 test files: what patterns do they follow? Vitest + what assertion style? Any common test utilities or helpers?
5. Recommend priority test targets for maximum confidence: which 10 files, if tested thoroughly, would give the most confidence in the system?

OUTPUT: Coverage gap report with: untested modules list, weak coverage modules, priority test targets (top 10), recommended test patterns based on existing codebase.

---

## CHATGPT 5.2

Optimize the sprint prompts for the coding workers. Review the prompts in the battle plan and make them more precise.

For each of the 8 coding workers, review their task prompts and:
1. Identify ambiguities that could lead to different interpretations
2. Add missing details (exact file paths, exact function signatures, exact import paths)
3. Clarify integration points (what does Worker A's output need to look like for Worker B to consume it?)
4. Add acceptance criteria (how does the worker know they're done? What should `tsc --noEmit` and `vitest run` show?)
5. Identify potential conflicts (two workers creating the same file, incompatible type definitions, different naming conventions)

Pay special attention to:
- DeepSeek + Qwen overlap (both touch app/components/)
- Sonnet + Haiku overlap (auth functions in both convex/ and src/convex/)
- Kimi + Llama overlap (both touch src/observability/)

OUTPUT: Refined prompt sections for each worker with tracked changes (what you added/modified and why).

---

## PERPLEXITY

Create GitHub issues for any bugs or missing pieces found during Series 1-3 research.

Based on your repo health check (Series 1) and deployment research (Series 3):
1. Create issues for missing dependencies that need to be installed
2. Create issues for broken imports or circular dependencies found
3. Create issues for missing configuration files (next.config.ts, tailwind.config.ts, etc.)
4. Create issues for any test failures found
5. Create a tracking issue: "24-Hour Sprint — Pre-Flight Checklist" that links to all the above

For each issue:
- Clear title describing the problem
- Steps to reproduce (if applicable)
- Expected vs actual behavior
- Suggested fix
- Labels: bug, enhancement, or chore
- Assign to appropriate worker domain

OUTPUT: List of GitHub issues created with URLs, plus the tracking issue.
