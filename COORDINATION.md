# NOVA26 Project Coordination

> Last updated: 2026-02-18
> Active agents: MiniMax Agent, Claude

## Current Status

### MiniMax Agent - Completed (2026-02-18)
1. Fixed TypeScript compilation (43 errors)
2. Added LLMCaller type for testing
3. Created promotePendingTasks()
4. Created integration-test.ts (25/25 tests passed)
5. Added LLM Council module for multi-agent consensus
   - 3 council members: ARCHITECT, REVIEWER, IMPLEMENTER
   - Consensus types: unanimous, majority, split, deadlock
   - Integrated into Ralph Loop for Phase 1-2 tasks

### Claude - Kronos Integration All 3 Phases Complete (2026-02-18)

**Phase 1 — Sidecar (zero risk):**
1. `src/atlas/types.ts` — KronosEntry, KronosPointer, KronosSearchResult
2. `src/atlas/kronos-client.ts` — HTTP client wrapping Kronos REST API (port 8765)
3. `src/atlas/index.ts` — KronosAtlas dual-write layer (builds.json + Kronos)
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

**All Kronos calls gracefully degrade.** No new npm dependencies (native `fetch`).

**Kronos dependency:** https://github.com/Ja1Denis/Kronos (Python, port 8765)
- Provides: pointer-based RAG, hybrid search (SQLite FTS5 + ChromaDB), knowledge graph
- Nova26 works fine without it — completely optional

## Recent Changes

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

## Files Structure

```
src/
├── orchestrator/
│   ├── ralph-loop.ts      # Core execution loop (council + Kronos ingest)
│   ├── council-runner.ts  # LLM Council (MiniMax)
│   ├── task-picker.ts     # Task scheduling
│   ├── prompt-builder.ts  # Prompt generation + Kronos context (Phase 2)
│   ├── agent-loader.ts    # Agent loading
│   └── gate-runner.ts     # Quality gates
├── atlas/                 # Kronos integration (Claude)
│   ├── types.ts           # KronosEntry, KronosPointer, KronosSearchResult
│   ├── kronos-client.ts   # HTTP client for Kronos REST API
│   ├── index.ts           # KronosAtlas dual-write layer
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
- **Full Ralph Loop flow:** Kronos prompt context -> LLM call -> gates -> council -> dual-write (builds.json + Kronos) -> save output -> (after loop) ATLAS retrospective.
- **Testing:** Run `npx tsx src/test/mock-run.ts` to verify the loop still works after merging both agents' changes.

## Next Steps Ideas

- [ ] Live LLM test with Ollama
- [ ] Expand council members
- [ ] Add more quality gates
- [ ] Convex database integration
- [x] Kronos Phase 2 — Kronos semantic context injected into prompt-builder.ts
- [x] Kronos Phase 3 — ATLAS retrospective engine with pattern analysis
