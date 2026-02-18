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

### Claude - Kronos Integration Phase 1 Complete (2026-02-18)
1. Added Kronos semantic memory integration (Phase 1 — sidecar, zero risk)
   - `src/atlas/types.ts` — KronosEntry, KronosPointer, KronosSearchResult interfaces
   - `src/atlas/kronos-client.ts` — HTTP client wrapping Kronos REST API (port 8765)
   - `src/atlas/index.ts` — KronosAtlas dual-write layer (file-based + Kronos)
   - `scripts/start-with-kronos.sh` — Startup script with server detection
2. Modified `gate-runner.ts` — added `postGateKronosIngest()` after gates pass
3. Modified `ralph-loop.ts` — wired Kronos ingest into the main loop
4. Updated README.md with Kronos documentation section
5. All Kronos calls gracefully degrade (try/catch, healthCheck before ingest)
6. No new npm dependencies — uses Node.js native `fetch`
7. Mock tests pass (3/3), tsc --noEmit clean on all new/modified files

**Kronos dependency:** https://github.com/Ja1Denis/Kronos (Python, port 8765)
- Provides: pointer-based RAG, hybrid search (SQLite FTS5 + ChromaDB), knowledge graph
- Nova26 works fine without it — completely optional sidecar

## Recent Changes

| Date | Agent | Change |
|------|-------|--------|
| 2026-02-18 | MiniMax | Added council-runner.ts |
| 2026-02-18 | MiniMax | Integrated council into ralph-loop.ts |
| 2026-02-18 | Claude | Added Kronos sidecar integration (Phase 1) |
| 2026-02-18 | Claude | Created src/atlas/ module (types, client, KronosAtlas) |
| 2026-02-18 | Claude | Wired postGateKronosIngest into gate-runner + ralph-loop |
| 2026-02-18 | Both | Merged council + Kronos into unified branch |

## Files Structure

```
src/
├── orchestrator/
│   ├── ralph-loop.ts      # Core execution loop (council + Kronos ingest)
│   ├── council-runner.ts  # LLM Council (MiniMax)
│   ├── task-picker.ts     # Task scheduling
│   ├── prompt-builder.ts  # Prompt generation
│   ├── agent-loader.ts    # Agent loading
│   └── gate-runner.ts     # Quality gates + postGateKronosIngest (Claude)
├── atlas/                 # Kronos integration (Claude)
│   ├── types.ts           # KronosEntry, KronosPointer, KronosSearchResult
│   ├── kronos-client.ts   # HTTP client for Kronos REST API
│   └── index.ts           # KronosAtlas dual-write layer
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
- **MiniMax's council** runs before Kronos ingest in the Ralph Loop flow: gates -> council -> Kronos ingest -> save output.
- **Testing:** Run `npx tsx src/test/mock-run.ts` to verify the loop still works after merging both agents' changes.

## Next Steps Ideas

- [ ] Live LLM test with Ollama
- [ ] Expand council members
- [ ] Add more quality gates
- [ ] Convex database integration
- [ ] Kronos Phase 2 — Replace prompt-builder.ts context injection with Kronos semantic search
- [ ] Kronos Phase 3 — ATLAS agent uses Kronos for pattern retrospectives
