# NOVA26 OPERATION ETERNAL FLAME — Capability Probe

> **INSTRUCTIONS**: Copy-paste this EXACT prompt to every agent (all 5 coding workers + all 4 browser agents).
> Collect their responses and bring them back to Kiro for analysis.

---

## THE PROMPT (copy everything below this line)

```
You are being evaluated for a role in NOVA26 OPERATION ETERNAL FLAME — a 24-hour sprint to ship a working AI-powered IDE dashboard.

Before we assign you real tasks, I need to understand exactly what you can and cannot do. Answer every question honestly. If you can't do something, say so — it's better to know now than discover it mid-sprint.

PROJECT: Nova26 — AI-powered IDE with 21 specialized agents
REPO: https://github.com/nelsen3000/nova26
TECH: TypeScript strict, React 19, Next.js 15, Tailwind CSS, shadcn/ui, Convex (backend/database/auth — Convex Auth, NOT Clerk), Vitest
PHILOSOPHY: Least space, least GB locally, fastest execution, cheapest, most efficient. Convex is the ONLY backend — auth, database, real-time, everything. No external auth providers unless Convex Auth literally cannot do something.

=== SECTION 1: IDENTITY ===
1. What model are you? (exact name + version)
2. What platform are you running on? (terminal CLI, browser tab, IDE extension, API)
3. What is your context window size? (tokens or approximate)
4. Can you maintain state across multiple messages in this conversation?

=== SECTION 2: CODE CAPABILITIES ===
5. Can you read files from the local filesystem? (yes/no, and how)
6. Can you WRITE files to the local filesystem? (yes/no, and how)
7. Can you execute shell commands? (e.g., `npm install`, `npx tsc --noEmit`, `vitest run`)
8. Can you access the internet / fetch URLs / search the web?
9. Can you access GitHub repos directly? (read code, create PRs, push commits)
10. What is the maximum output length you can produce in a single response?

=== SECTION 3: TECH STACK KNOWLEDGE ===
Rate yourself 1-5 (1=never used, 5=expert) on each:
11. TypeScript (strict mode, generics, utility types)
12. React 19 (use() hook, Server Components, Suspense)
13. Next.js 15 (App Router, route groups, middleware, server actions)
14. Tailwind CSS (utility classes, responsive design, dark mode)
15. shadcn/ui (component library, theming, customization)
16. Convex (schema, queries, mutations, actions, real-time subscriptions)
17. Vitest (unit tests, mocking, coverage)
18. Convex Auth (native authentication — the ONLY auth we use, no Clerk)
19. Vercel deployment (configuration, environment variables)
20. ESM imports with .js extensions (the Nova26 convention)

=== SECTION 4: WORK STYLE ===
21. Can you work in "mega sprint" mode — producing 2+ hours of continuous output without needing me to re-prompt?
22. If I give you a spec file (.md) and say "implement this", can you produce all source files + test files in one response?
23. Can you produce multiple files in a single response? If so, what's your preferred format? (code blocks with filenames, unified diff, other)
24. Do you have a "swarm" or parallel execution mode? If yes, describe it.
25. What happens when you hit your output limit mid-file? Do you stop, truncate, or ask to continue?

=== SECTION 5: CONSTRAINTS & GOTCHAS ===
26. What are your biggest weaknesses for this kind of work?
27. What types of tasks should I NOT give you?
28. Do you have any rate limits I should know about?
29. Can you see/reference previous messages in this conversation, or does each message start fresh?
30. Is there anything else I should know about your capabilities or limitations?

=== SECTION 6: QUICK PROOF ===
Write a minimal Convex query function that:
- Takes a `status` argument (string, one of: "running", "completed", "failed")
- Queries the `builds` table filtered by status
- Uses the `by_status` index
- Returns the results sorted by `startedAt` descending
- Uses proper Convex validators

This is a real function we need. If you can write it correctly, you're on the team.

Reply with your full assessment now. Be honest — we're assigning critical-path work based on your answers.
```

---

## HOW TO USE THIS

1. Open each agent (Opus, Sonnet, Kimi, GLM 5, Perplexity, Grok, ChatGPT, Gemini)
2. Paste the prompt above
3. Collect all 8 responses
4. Bring them back here — I'll analyze strengths/weaknesses and build the final assignment matrix

This tells us:
- Who can actually write files vs who just outputs code blocks
- Who knows Convex vs who will hallucinate the API
- Who can do mega-sprints vs who needs constant re-prompting
- Who has internet access for research vs who's working blind
- The proof-of-work Convex function catches anyone faking competence
