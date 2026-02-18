# NOVA26 TASK BOARD — February 18, 2026

> **Coordination Hub** — All AI agents reference this file for assignments.
> **Real-time progress**: Each agent updates their section after completing each task.
> **Coordinator**: Claude Code (merges all work, assigns new tasks, resolves conflicts)

---

## Agent Roster

| Agent | Branch | Domain | Status |
|-------|--------|--------|--------|
| **Claude Code** | `main` | Coordinator + Core Engine | Active — C-01→C-10 done, working C-11 |
| **Kiro** | `kiro/dashboard` | Dashboard UI + Frontend | Active — finishing BistroLens, then dashboard |
| **OpenAI/ChatGPT** | `openai/semantic-engine` | Semantic Engine + Testing + Security | DONE — 15/15 tasks complete, awaiting push |
| **Perplexity** | `perplexity/docs-research` | Research + Documentation + Cutting-Edge | DONE — P-01→P-06 complete, merged to main |
| **Kimi** | `kimi/cli-agents` | CLI Commands + Agent Templates | DONE — 15/15 tasks complete, merged to main |

---

## CATEGORY 1: Core Engine Enhancements
**Owner: Claude Code**

- [x] `C-01` Integrate response-cache.ts into ollama-client.ts LLM call path
- [x] `C-02` Add streaming response support to ollama-client.ts (SSE/async iterators)
- [x] `C-03` Wire response cache into model-router.ts callLLM() with cache-first check
- [x] `C-04` Integrate cost-tracker.ts into ralph-loop processTask() — log every LLM call
- [x] `C-05` Add budget enforcement to cost-tracker — halt builds when budget exceeded
- [x] `C-06` Test event-store crash recovery end-to-end (simulate crash mid-build, resume)
- [x] `C-07` Add circuit breaker pattern to model-router (auto-disable failing models)
- [x] `C-08` Create .novaignore file support — exclude sensitive files from repo-map indexing
- [x] `C-09` Upgrade package.json: vitest 1.2→4.0, typescript 5.3→5.9, convex 1.16→1.31
- [x] `C-10` Add ts-morph, fast-check, recharts as dependencies
- [ ] `C-11` Create one-command setup: `npx nova26 init` (install deps, set env, index repo)
- [ ] `C-12` Final merge all agent branches + resolve conflicts
- [ ] `C-13` Final tsc --noEmit verification (0 errors)
- [ ] `C-14` Final vitest run (all tests passing)
- [ ] `C-15` Final git push to origin/main

## CATEGORY 2: Dashboard UI (Next.js)
**Owner: Kiro**

- [ ] `K-01` Initialize Next.js 15 app with App Router at project root (app/ directory)
- [ ] `K-02` Set up Tailwind CSS 4 + shadcn/ui component library
- [ ] `K-03` Create app/(dashboard)/layout.tsx — sidebar nav + header
- [ ] `K-04` Build Monitor page — real-time task status kanban (pending/running/done/failed)
- [ ] `K-05` Agent Output Viewer — click task to see LLM output, prompt, gate results
- [ ] `K-06` PRD Editor — visual task editor with dependency arrows
- [ ] `K-07` Cost Dashboard — token usage charts per agent/model/day (Recharts 3.7)
- [ ] `K-08` Agent Explainer Panel — view any agent's template, hard limits, success rate
- [ ] `K-09` Plan Visualization — show Ralph Loop planning phases as interactive timeline
- [ ] `K-10` Command Palette (Cmd+K) — quick navigation across all dashboard views
- [ ] `K-11` Wire Convex client for real-time subscriptions (builds, tasks, executions)
- [ ] `K-12` Responsive design — mobile + tablet + desktop breakpoints
- [ ] `K-13` Dark mode + light mode with system preference detection
- [ ] `K-14` Error boundaries + loading skeletons for all pages
- [ ] `K-15` Landing page polish — fix any remaining Higgsfield refs, add open-source video models

## CATEGORY 3: Semantic Engine + Testing + Security
**Owner: OpenAI/ChatGPT** — ALL COMPLETE

- [x] `O-01` Upgrade repo-map.ts from regex parsing to AST-based (ts-morph 27.0)
- [x] `O-02` Add incremental indexing — only re-parse changed files (watch mode)
- [x] `O-03` Build semantic search layer — query codebase by natural language
- [x] `O-04` Add cross-file dependency graph with cycle detection
- [x] `O-05` Implement hallucination detector gate — compare output vs known code patterns
- [x] `O-06` Add property-based testing with fast-check 4.5 for orchestrator
- [x] `O-07` Write unit tests for src/llm/ollama-client.ts (mock HTTP)
- [x] `O-08` Write unit tests for src/memory/session-memory.ts
- [x] `O-09` Write unit tests for src/codebase/repo-map.ts
- [x] `O-10` Write unit tests for src/git/workflow.ts
- [x] `O-11` Write unit tests for src/cost/cost-tracker.ts
- [x] `O-12` Write unit tests for src/security/security-scanner.ts
- [x] `O-13` Implement .novaignore parser in security-scanner (skip sensitive files)
- [x] `O-14` Add encryption-at-rest for .nova/cache/ and .nova/memory/ (AES-256)
- [x] `O-15` Create GitHub Actions CI pipeline (.github/workflows/ci.yml) — lint, tsc, vitest

## CATEGORY 4: Research + Documentation + Cutting-Edge
**Owner: Perplexity**

- [x] `P-01` Competitive analysis: Nova26 vs Cursor vs Windsurf vs Devin vs Copilot Workspace vs Bolt.new vs v0.dev
- [x] `P-02` Research latest multi-agent orchestration patterns (CrewAI, LangGraph, AutoGen Feb 2026)
- [x] `P-03` Research latest Convex 1.31 features — agents, vector search, preview deployments
- [x] `P-04` Research SOC 2 + ISO 42001 compliance requirements for AI coding tools
- [x] `P-05` Research open-source video generation state (Open-Sora, CogVideo, Mochi Feb 2026)
- [x] `P-06` Research streaming LLM patterns for TypeScript (best practices Feb 2026)
- [ ] `P-07` Create unified documentation portal — restructure docs/ with search + nav
- [ ] `P-08` Write DEPLOYMENT.md — full deployment guide (Convex, Vercel, Ollama setup)
- [ ] `P-09` Write CONTRIBUTING.md — how to add agents, modules, skills
- [ ] `P-10` Create interactive tutorial: "Build Hello World with Nova26" walkthrough
- [ ] `P-11` Write SECURITY.md — threat model, encryption, compliance roadmap
- [ ] `P-12` Create onboarding script documentation (one-command setup guide)

## CATEGORY 5: CLI Commands + Agent Templates
**Owner: Kimi** — ALL COMPLETE

- [x] `M-01` Modernize ANDROMEDA agent template → XML format with examples
- [x] `M-02` Modernize CALLISTO agent template → XML format with examples
- [x] `M-03` Modernize ENCELADUS agent template → XML format with examples
- [x] `M-04` Modernize GANYMEDE agent template → XML format with examples
- [x] `M-05` Modernize IO agent template → XML format with examples
- [x] `M-06` Modernize MIMAS agent template → XML format with examples
- [x] `M-07` Modernize NEPTUNE agent template → XML format with examples
- [x] `M-08` Wire /template CLI command → call template-engine.ts
- [x] `M-09` Wire /swarm CLI command → call swarm-mode.ts
- [x] `M-10` Wire /dependencies CLI command → call analyzer.ts
- [x] `M-11` Wire /scan CLI command → call security-scanner.ts
- [x] `M-12` Wire /cost CLI command → call cost-tracker.ts + formatCacheStats
- [x] `M-13` Wire /preview CLI command → call preview server.ts
- [x] `M-14` Add hierarchical task decomposition to ralph-loop planner
- [x] `M-15` Create skill marketplace scaffold (src/skills/marketplace.ts)

---

## Progress Summary

| Agent | Assigned | Completed | % |
|-------|----------|-----------|---|
| Claude Code | 15 | 10 | 67% |
| Kiro | 15 | 0 | 0% |
| OpenAI | 15 | 15 | 100% |
| Perplexity | 12 | 6 | 50% |
| Kimi | 15 | 15 | 100% |
| **TOTAL** | **72** | **46** | **64%** |

---

## Coordination Rules

1. **Branch isolation**: Each agent works ONLY on their designated branch
2. **No overlapping files**: Agents only modify files in their domain
3. **Update on completion**: After each task, update this file (check the box) and commit
4. **Blockers**: If blocked, add a note under the task and move to next task
5. **Claude merges**: Only Claude Code merges branches to main
6. **Quality bar**: All code must compile (tsc --noEmit = 0 errors), all tests must pass
