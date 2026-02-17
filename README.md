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

## Status

Phase 0 — Orchestrator built, 21 agents defined, Convex schema defined. Ready for first live LLM test.
