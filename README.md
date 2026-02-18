# Nova26

AI-powered IDE that uses 21 specialized agents to build software through orchestrated task execution.

## Architecture

Nova26 uses a star topology: SUN orchestrates all work through the Ralph Loop. Agents are markdown prompt templates loaded into LLM contexts — they are NOT running services or microservices.

```
Pick Task → Load Agent → Build Prompt → Call LLM → Run Gates
    ↑                                                   ↓
    ←←←←← (next task) ←←←←←←←←←←←←←←←←←←←← PASS → Save + Log
                                               FAIL → Retry 1x → Block
```

## Quick Start

```bash
# Prerequisites: Node.js 20+, Ollama with qwen2.5:7b
npm install

npx tsx src/index.ts status .nova/prd-test.json
npx tsx src/index.ts run .nova/prd-test.json
npx tsx src/index.ts reset .nova/prd-test.json

# Test without Ollama
npx tsx src/test/mock-run.ts
```

## Directory Structure

```
src/                — Orchestrator (TypeScript)
  orchestrator/     — Ralph Loop, task picker, agent loader, prompt builder
  llm/              — Ollama client, model router
  gates/            — Quality gates (response validation, Mercury AI check)
  atlas/            — Build logging, pattern storage
  types/            — All TypeScript interfaces
  utils/            — File I/O, logger
  test/             — Integration tests
.nova
  agents/           — 21 agent templates (local, not in git)
  atlas/            — Build logs and patterns (runtime data)
  output/           — Task outputs (runtime data)
  prd-test.json     — 3-task test PRD
  prd-ua-dashboard-v1.json — Real UA Dashboard PRD (15 tasks)
convex/
  schema.ts         — Database schema (10 tables: 6 ATLAS + 4 UA Dashboard)
```

## Agents (21 total)

| Agent | Role | Domain |
|-------|------|--------|
| SUN | Orchestrator | Task planning, dispatch, coordination |
| MERCURY | Validator | Spec compliance checking |
| VENUS | Frontend | React 19, Tailwind, shadcn/ui, WCAG 2.1 AA |
| EARTH | Product | Specs, user stories, Gherkin scenarios |
| MARS | Backend | TypeScript strict, Convex mutations/queries |
| PLUTO | Database | Convex schemas, row-level isolation |
| SATURN | Testing | Vitest, RTL, Playwright |
| JUPITER | Architecture | ADRs, component hierarchy, data flow |
| ENCELADUS | Security | Auth, XSS prevention, input validation |
| GANYMEDE | API | Stripe, Ollama, external integrations |
| NEPTUNE | Analytics | Metrics dashboards, recharts |
| CHARON | Error UX | Fallback screens, empty states |
| URANUS | R&D | Tool evaluation, recommendations |
| TITAN | Real-time | Convex subscriptions, optimistic updates |
| EUROPA | Mobile | PWA, responsive, service workers |
| MIMAS | Resilience | Retry logic, circuit breakers |
| IO | Performance | FCP/LCP budgets, bundle analysis |
| TRITON | DevOps | GitHub Actions, Convex deploy |
| CALLISTO | Documentation | READMEs, API docs |
| ATLAS | Meta-learner | Build logs, patterns, retrospectives |
| ANDROMEDA | Ideas | Opportunity identification, research |

## Tech Stack

- TypeScript (strict mode)
- Node.js 20+
- Ollama (Qwen 7B default, local)
- Convex (schema defined, not yet deployed)

## Kronos Memory Integration

Nova26 optionally integrates with [Kronos](https://github.com/Ja1Denis/Kronos), a local semantic memory system that provides pointer-based RAG, hybrid search (SQLite FTS5 + ChromaDB vector), and a knowledge graph.

**What Kronos does for Nova26:** After each task passes quality gates, its output is ingested into Kronos for semantic search. This lets agents query past build outputs, patterns, and decisions across PRD runs — replacing the flat-file `.nova/atlas/builds.json` with intelligent, searchable memory.

**Kronos is optional.** Nova26 works fine without it. All Kronos calls gracefully degrade — if the server is unreachable, the Ralph Loop logs a warning and continues normally. The existing file-based ATLAS system always runs as a fallback.

### Running with Kronos

```bash
# 1. Start Kronos on port 8765 (in a separate terminal)
cd ../Kronos && python src/mcp_server.py

# 2. Run Nova26 with the helper script
./scripts/start-with-kronos.sh .nova/prd-test.json

# Or run directly (Kronos ingest happens automatically if server is detected)
npx tsx src/index.ts run .nova/prd-test.json
```

Kronos runs on **port 8765** by default. No additional npm dependencies are required — the integration uses Node.js native `fetch`.

## Status

Phase 0 — Orchestrator built, 21 agents defined, Convex schema defined. Ready for first live LLM test.
