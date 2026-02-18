# NOVA26 Multi-Agent Coordination

> Last updated: 2026-02-18
<<<<<<< HEAD
> Rule: ONE agent per domain. Read your own file before touching anything.
=======
> Active agents: MiniMax Agent, Claude
>>>>>>> origin/claude/setup-claude-code-cli-xRTjx

## Active Agents & Their Files

| Agent | Status File | File Ownership |
|-------|-------------|----------------|
| **Claude** | `CLAUDE.md` | `src/llm/`, `convex/`, Zod schemas, MCP config, agent XML restructure |
| **MiniMax** | `MINIMAX.md` | `src/orchestrator/`, `src/gates/`, `src/atlas/`, model router |
| **Kimi** | `KIMI.md` | `.nova/agents/*.md`, `.nova/style-guides/`, `.nova/config/` |

<<<<<<< HEAD
## Hard Ownership Rules — No Cross-Writes
=======
### Claude - Kronos + Convex Integration Complete (2026-02-18)

**Phase 1 — Sidecar (zero risk):**
1. `src/atlas/types.ts` — KronosEntry, KronosPointer, KronosSearchResult
2. `src/atlas/kronos-client.ts` — HTTP client wrapping Kronos REST API (port 8765)
3. `src/atlas/index.ts` — KronosAtlas triple-write layer (builds.json + Kronos + Convex)
4. `scripts/start-with-kronos.sh` — Startup script with server detection
5. Wired into `ralph-loop.ts` via `KronosAtlas.logBuild()` after gate pass

**Phase 2 — Semantic prompt context:**
6. `prompt-builder.ts` queries Kronos before building prompts
7. Injects "Historical Context" section with relevant past build patterns
8. Agents now see what worked/failed in previous runs

**Phase 3 — ATLAS retrospectives:**
9. `src/atlas/retrospective.ts` — KronosRetrospective engine
10. Auto-generates retrospective after Ralph Loop completes
11. Computes agent stats, effective/failure patterns, recommendations
12. `generateBriefing()` — pre-task briefings with agent track record + Kronos patterns

**Phase 4 — Convex cloud redundancy (triple-write):**
13. `convex/atlas.ts` — Convex server mutations/queries (logExecution, completeBuild, logLearning, getBuildStatus, getAgentExecutions, getLearnings)
14. `src/atlas/convex-client.ts` — ConvexAtlasClient with graceful degradation (disabled if CONVEX_URL not set)
15. `src/atlas/index.ts` — Upgraded KronosAtlas from dual-write to triple-write
16. `ralph-loop.ts` — Passes LogBuildOptions for Convex sync, calls `atlas.completeBuild()` after loop ends

**All external calls (Kronos, Convex) gracefully degrade.** No new npm dependencies (native `fetch`).

**Kronos dependency:** https://github.com/Ja1Denis/Kronos (Python, port 8765)
- Provides: pointer-based RAG, hybrid search (SQLite FTS5 + ChromaDB), knowledge graph
- Nova26 works fine without it — completely optional

**Convex dependency:** Set `CONVEX_URL` env var to enable cloud sync
- Provides: cloud-hosted builds/tasks/executions/learnings database
- Nova26 works fine without it — completely optional
>>>>>>> origin/claude/setup-claude-code-cli-xRTjx

| Path | Owner |
|------|-------|
| `src/llm/` | Claude |
| `src/orchestrator/` | MiniMax |
| `src/gates/` | MiniMax |
| `src/atlas/` | MiniMax |
| `src/agents/` | MiniMax |
| `convex/` | Claude |
| `.nova/agents/` | Kimi |
| `.nova/style-guides/` | Kimi |
| `.nova/config/` | Kimi |
| `src/types/index.ts` | **Shared** — coordinate before changing |

<<<<<<< HEAD
## Cross-Agent Requests
=======
| Date | Agent | Change |
|------|-------|--------|
| 2026-02-18 | MiniMax | Added council-runner.ts |
| 2026-02-18 | MiniMax | Integrated council into ralph-loop.ts |
| 2026-02-18 | Claude | Added Kronos sidecar integration (Phase 1) |
| 2026-02-18 | Claude | Created src/atlas/ module (types, client, KronosAtlas) |
| 2026-02-18 | Claude | Wired postGateKronosIngest into gate-runner + ralph-loop |
| 2026-02-18 | Both | Merged council + Kronos into unified branch |
| 2026-02-18 | Claude | Phase 2: Kronos semantic context in prompt-builder.ts |
| 2026-02-18 | Claude | Phase 3: ATLAS retrospective engine + auto-run after loop |
| 2026-02-18 | Claude | Phase 4: Convex cloud triple-write (local + Kronos + Convex) |
>>>>>>> origin/claude/setup-claude-code-cli-xRTjx

If you need something from another agent's domain, add it to their file as a REQUEST.
Do not implement it yourself.

<<<<<<< HEAD
## Current Phase Status

See individual files for details:
- **Claude** → `CLAUDE.md`
- **MiniMax** → `MINIMAX.md`
- **Kimi** → `KIMI.md`
=======
```
src/
├── orchestrator/
│   ├── ralph-loop.ts      # Core execution loop (council + Kronos ingest)
│   ├── council-runner.ts  # LLM Council (MiniMax)
│   ├── task-picker.ts     # Task scheduling
│   ├── prompt-builder.ts  # Prompt generation + Kronos context (Phase 2)
│   ├── agent-loader.ts    # Agent loading
│   └── gate-runner.ts     # Quality gates
├── atlas/                 # Kronos + Convex integration (Claude)
│   ├── types.ts           # KronosEntry, KronosPointer, KronosSearchResult
│   ├── kronos-client.ts   # HTTP client for Kronos REST API
│   ├── convex-client.ts   # Convex cloud HTTP client
│   ├── index.ts           # KronosAtlas triple-write layer
│   └── retrospective.ts  # ATLAS retrospective engine (Phase 3)
├── llm/
│   └── ollama-client.ts   # Ollama LLM client
├── types/
│   └── index.ts           # TypeScript types
└── test/
    ├── mock-run.ts        # Mock tests
    └── integration-test.ts # Integration tests (MiniMax)
scripts/
└── start-with-kronos.sh   # Kronos startup helper (Claude)
```

## Notes for Coordination

- MiniMax is working in: `/Users/jonathannelsen/.minimax-agent/projects/22`
- Git repo is in: `/Users/jonathannelsen/.minimax-agent/projects/19`
- Copy files from project 22 to 19 before pushing to GitHub
- Tests: `npx tsx src/test/mock-run.ts`

## Coordination Notes

- **Shared files:** Both agents modified `ralph-loop.ts` and `gate-runner.ts`. Claude's changes add Kronos ingest calls after gates pass. MiniMax's council integration also hooks into ralph-loop. Both should merge cleanly since they touch different sections.
- **Claude's Kronos client** never throws — all methods return safe defaults on failure, so MiniMax's council flow is unaffected.
- **Full Ralph Loop flow:** Kronos prompt context -> LLM call -> gates -> council -> triple-write (builds.json + Kronos + Convex) -> save output -> completeBuild (Convex) -> ATLAS retrospective.
- **Testing:** Run `npx tsx src/test/mock-run.ts` to verify the loop still works after merging both agents' changes.

## Next Steps Ideas

- [ ] Live LLM test with Ollama
- [ ] Expand council members
- [ ] Add more quality gates
- [x] Convex database integration (triple-write: local + Kronos + Convex)
- [x] Kronos Phase 2 — Kronos semantic context injected into prompt-builder.ts
- [x] Kronos Phase 3 — ATLAS retrospective engine with pattern analysis
>>>>>>> origin/claude/setup-claude-code-cli-xRTjx
