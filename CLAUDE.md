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

## In Progress

- [ ] XML-restructure remaining 10 legacy agents in `.nova/agents/`:
  ANDROMEDA, CALLISTO, ENCELADUS, GANYMEDE, IO, JUPITER, MIMAS, NEPTUNE, PLUTO, SUN

## Queued

- [ ] Create `convex/companies.ts`, `convex/divisions.ts`, `convex/chipAccounts.ts` indexes
  NOTE: These are UA Dashboard backend — do NOT build until MiniMax confirms orchestrator
  is running end-to-end first

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
