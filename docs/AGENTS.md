# Agent Catalog

NOVA26 utilizes 21 specialized agents. Each agent is defined by a system prompt template in `.nova/agents/` and configured constraints in `.nova/config/hard-limits.json`.

## Core Swarm

| Agent | Emoji | Role | Domain | Tier | Model (Default) |
|-------|-------|------|--------|------|-----------------|
| SUN | ☀️ | Orchestrator | Planning, Dispatch, Root Cause Analysis | Balanced | qwen2.5:14b / gpt-4o |
| MERCURY | ☿️ | Validator | Spec Compliance, Quality Control | Fast | qwen2.5:7b / gpt-4o-mini |
| VENUS | 💫 | Frontend | React, Tailwind, Shadcn/UI | Quality | deepseek-coder / claude-3-sonnet |
| EARTH | 🌍 | Product | Requirements, User Stories, Gherkin | Balanced | qwen2.5:14b |
| MARS | 🔴 | Backend | Node.js, TypeScript, API Design | Quality | deepseek-coder / gpt-4o |

## Infrastructure & Quality

| Agent | Emoji | Role | Domain | Tier | Model (Default) |
|-------|-------|------|--------|------|-----------------|
| JUPITER | 🟠 | Architecture | System Design, ADRs, Scalability | Quality | claude-3-opus |
| SATURN | 🪐 | Testing | Vitest, Playwright, E2E | Balanced | qwen2.5:14b |
| URANUS | 🔭 | R&D | Tool Selection, Library Evaluation | Quality | gpt-4o |
| NEPTUNE | 🔵 | Analytics | Dashboards, Metrics, Visualization | Balanced | qwen2.5:14b |
| PLUTO | 🪐 | Database | Schema Design, SQL/Convex, Migrations | Fast | qwen2.5:14b |

## Specialized Moons

| Agent | Emoji | Role | Domain | Tier |
|-------|-------|------|--------|------|
| TITAN | 🌙 | Real-time | WebSockets, Subscriptions, Sync | Balanced |
| EUROPA | 🌊 | Mobile | React Native, PWA, Responsive | Balanced |
| IO | ⚡ | Performance | Optimization, Bundling, Core Vitals | Fast |
| GANYMEDE | 🛰️ | Integrations | External APIs, Webhooks, OAuth | Balanced |
| CALLISTO | 📝 | Docs | Documentation, READMEs, Comments | Fast |
| MIMAS | 🛡️ | Resilience | Circuit Breakers, Retry Logic | Balanced |
| ENCELADUS | ⭐ | Security | Auth, Penetration Testing, OWASP | Quality |
| TRITON | 🚀 | DevOps | CI/CD, Docker, Deployment | Fast |
| CHARON | 🌑 | Error UX | Fallbacks, Error Boundaries | Fast |
| ATLAS | 📚 | Memory | Pattern Storage, Retrospectives | Balanced |
| ANDROMEDA | 🌌 | Ideas | Innovation, Feature Proposals | Balanced |

## Constraints & Limits

Agents are restricted by `.nova/config/hard-limits.json` to prevent destructive actions:

- **File Access**: Agents cannot edit `.env`, `.git/`, or `package-lock.json` directly.
- **Shell Commands**: `rm -rf` and other destructive commands are blocked by the tool execution layer.
- **Budget**: Execution halts if `NOVA26_BUDGET` (daily limit) is exceeded.
