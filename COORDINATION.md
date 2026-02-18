# NOVA26 Multi-Agent Coordination

> Last updated: 2026-02-18
> Rule: ONE agent per domain. Read your own file before touching anything.

## Active Agents & Their Files

| Agent | Status File | File Ownership |
|-------|-------------|----------------|
| **Claude** | `CLAUDE.md` | `src/llm/`, `convex/`, Zod schemas, MCP config, agent XML restructure |
| **MiniMax** | `MINIMAX.md` | `src/orchestrator/`, `src/gates/`, `src/atlas/`, model router |
| **Kimi** | `KIMI.md` | `.nova/agents/*.md`, `.nova/style-guides/`, `.nova/config/` |

## Hard Ownership Rules — No Cross-Writes

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

## Cross-Agent Requests

If you need something from another agent's domain, add it to their file as a REQUEST.
Do not implement it yourself.

## Current Phase Status

See individual files for details:
- **Claude** → `CLAUDE.md`
- **MiniMax** → `MINIMAX.md`
- **Kimi** → `KIMI.md`
