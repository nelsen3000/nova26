# Claude Task File — NOVA26

> Owner: Claude (claude-sonnet-4-5)
> Domains: src/llm/, convex/, .claude/, Zod schemas, agent XML restructure

---

## Completed

- [x] Fixed duplicate `agents` table in `convex/schema.ts` → renamed to `companyAgents`
- [x] Created `convex/atlas.ts` — all ATLAS mutations + queries (builds, tasks, executions, patterns, agents, learnings)
- [x] Added Zod schemas for all 21 agents in `src/llm/structured-output.ts`
- [x] Created `.claude/mcp.json` — Convex MCP server config
- [x] Audited all 21 agent templates — full report delivered to user
- [x] tsc: 0 errors confirmed
- [x] XML-restructured 10 legacy agents to EARTH format:
  ANDROMEDA, CALLISTO, ENCELADUS, GANYMEDE, IO, JUPITER, MIMAS, NEPTUNE, PLUTO, SUN
- [x] Created `.prompts/kimi-portfolio-sprint.md` — R16-01 Cross-Project Intelligence sprint (5 tasks, 90+ tests)
- [x] Evaluated Grok R16-02 output (~75% depth, 13 gaps identified, accepted with corrections)
- [x] Created `.prompts/kimi-memory-sprint.md` — R16-02 Agent Memory sprint (5 tasks, 90+ tests)
- [x] Evaluated Grok R16-03 through R17-02 outputs (5 specs, all accepted)
- [x] Created `.prompts/kimi-genui-sprint.md` — R16-03 Generative UI sprint (5 tasks, 90+ tests)
- [x] Created `.prompts/kimi-testing-sprint.md` — R16-04 Autonomous Testing sprint (5 tasks, 90+ tests)
- [x] Created `.prompts/grok-r17.md` — R17-03 through R17-12 (10 feature specs)
- [x] Evaluated Grok R17-03 through R17-12 outputs (10 specs, all accepted)
- [x] Created `.prompts/kimi-r17-mega-sprint.md` — R17 Feature Completion mega-sprint (10 tasks, 150+ tests)
- [x] Created `.prompts/kimi-wellbeing-sprint.md` — R16-05 Emotional Intelligence sprint (5 tasks, 116 tests)
- [x] Created `.prompts/kimi-recovery-sprint.md` — R17-01 Advanced Error Recovery sprint (5 tasks, 90+ tests)
- [x] Created `.prompts/kimi-init-sprint.md` — R17-02 Advanced Project Init sprint (5 tasks, 103 tests)
- [x] Created `.prompts/kimi-overnight-hardening.md` — overnight quality hardening sprint for Kimi
- [x] Implemented R16-05 Wellbeing sprint — 12 files in src/wellbeing/, 117 tests
- [x] Implemented R17-01 Recovery sprint — 10 files in src/recovery/, 93 new tests
- [x] Implemented R17-02 Init sprint — 10 files in src/init/, 109 tests
- [x] Wired ralph-loop.ts — added wellbeing, recovery, init config fields + 3 imports
- [x] Final verification: 0 TS errors, 2639 tests passing (319 new), 104 test files
- [x] Created `.prompts/grok-r18.md` — R18 Dashboard, Deployment & Integration specs (5 deliverables)
- [x] Created `.prompts/kiro-04.md` — R16/R17 pattern extraction, structural audit, doc validation (4 tasks)
- [x] Evaluated Grok R18 output — all 5 specs accepted (Dashboard, Deployment, VS Code, Integration Layer, Observability)
- [x] Evaluated Grok research on Claude skills, JetBrains, Rork, mobile tools, ASO — key patterns identified
- [x] Created `.prompts/kimi-mega-wiring-sprint.md` — ralph-loop wiring + lifecycle hooks + behaviors + hardening (5 tasks, 160+ tests)
- [x] Created `.prompts/grok-r19.md` — Mobile Launch Stage, Deep Semantic Model, Studio Rules (3 specs)
- [x] Created `.prompts/grok-r20.md` — Orchestrator-Worker hierarchy, Tauri desktop, AI Design Pipeline (3 specs)
- [x] Created `.prompts/gemini-01.md` — exhaustive AI tools & frameworks audit (11 categories)
- [x] Created `.prompts/gemini-02.md` — world-class UX patterns, DX, calm technology, retention (9 categories)

## In Progress

- [ ] Wire 13 unwired R16/R17 modules into ralph-loop.ts (R16-01, R16-03, R16-04, R17-03→R17-12)
  NOTE: Kimi overnight hardening produced docs + integration tests but did NOT wire ralph-loop.ts.
  Grok R18-04 will spec the integration layer. Then Kimi implements.

## Queued

- [ ] Convex UA Dashboard backend — companies.ts, divisions.ts, chipAccounts.ts already exist
  with full CRUD. NOTE: Schema + mutations complete. Blocked on dashboard UI (R18-01).
- [ ] Dashboard UI (K-01→K-15) — 0% complete, waiting on Grok R18-01 spec
- [ ] VS Code extension — waiting on Grok R18-03 spec
- [ ] ESLint + Prettier config — waiting on Grok R18-05 spec
- [ ] Remaining 11 agent templates to EARTH XML format

---

## Requests TO Other Agents

### → MiniMax
- `src/atlas/convex-logger.ts` should call `convex/atlas.ts` mutations via HTTP.
  The mutation names are: `atlas:startBuild`, `atlas:logTask`, `atlas:logExecution`,
  `atlas:logLearning`, `atlas:completeBuild`. Example:
  ```
  POST $CONVEX_URL/api/mutation
  { "path": "atlas:startBuild", "args": { "prdId": "...", "prdName": "..." } }
  ```

---

## Notes

- `convex/atlas.ts` uses indexes defined in `convex/schema.ts`. If schema indexes change,
  update atlas.ts queries to match.
- The Zod schemas in `structured-output.ts` mirror the agent template output formats.
  If Kimi changes an agent's output format, the corresponding Zod schema needs updating.
