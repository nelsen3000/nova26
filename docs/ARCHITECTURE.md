# NOVA26 Architecture

NOVA26 is an agentic IDE designed around the **Ralph Loop**—a deterministic, self-correcting orchestration cycle that coordinates a swarm of 21 specialized agents.

## High-Level Architecture

```mermaid
graph TD
    User[User Prompt] --> CLI[NOVA26 CLI]
    CLI --> Sun[SUN (Orchestrator)]
    Sun -->|Decompose| Plan[Execution Plan (PRD)]

    subgraph "Ralph Loop Execution"
        Plan --> Task{Pick Next Task}
        Task -->|Assign| Agent[Specialized Agent]
        Agent -->|Context| Context[Session Memory / ATLAS]
        Agent -->|Prompt| Router{Model Router}
        Router -->|Tier: Free| Ollama[Local LLM]
        Router -->|Tier: Paid| Cloud[OpenAI/Anthropic]
        Ollama --> Output
        Cloud --> Output
        Output --> Gates[Quality Gates]
        Gates -->|Pass| Save[Save Output]
        Gates -->|Fail| Retry[Retry Loop]
        Save --> UpdatePRD[Update PRD Status]
    end

    UpdatePRD --> Task
    Retry --> Agent
```

## 1. The Ralph Loop

Defined in `src/orchestrator/ralph-loop.ts`, the Ralph Loop is the core engine. It does not just "run prompts"; it enforces a strict lifecycle for every task:

1. **Planning Phase**: Before execution, tasks go through `UNDERSTAND`, `CLARIFY`, and `PLAN` states (if plan approval is enabled).
2. **Execution**: The assigned agent generates the initial output.
3. **Gating**: The output is passed to `src/orchestrator/gate-runner.ts`.
   - **Mercury Validator**: Checks against the PRD specs.
   - **TypeScript Gate**: Compiles code to ensure type safety.
   - **Test Runner**: Runs vitest or jest.
4. **Auto-Correction**: If gates fail, the loop triggers a retry with a specific "fix prompt" containing the error logs.
5. **Learning**: Successes and failures are logged to Session Memory to improve future runs.

## 2. The 21-Agent Swarm

NOVA26 uses a "planetary" hierarchy for agents, defined in `.nova/agents/`.

- **Orchestrator**: SUN (Planning & Dispatch).
- **Inner Planets** (Core Creation):
  MERCURY (Validation), VENUS (Frontend), EARTH (Specs), MARS (Backend).
- **Outer Planets** (Specialized Infra):
  JUPITER (Architecture), SATURN (Testing), URANUS (R&D), NEPTUNE (Analytics).
- **Moons** (Specific Utilities):
  TITAN (Real-time), EUROPA (Mobile), IO (Performance), GANYMEDE (API), CALLISTO (Docs), etc.

## 3. Data & Storage Layers

NOVA26 uses a multi-tiered storage strategy to ensure context retention and auditability.

| Layer | Implementation | Purpose | Source |
|-------|---------------|---------|--------|
| EventStore | JSONL (Append-only) | Full audit trail of every step, prompt, and result. | `src/orchestrator/event-store.ts` |
| Session Memory | JSON (`.nova/memory/`) | Short-term context for the current build session. | `src/memory/session-memory.ts` |
| ATLAS | Convex + Vectors | Long-term knowledge base. Stores patterns, reusable code, and global learnings. | `src/atlas/` |
| PRD | JSON | The "State of Truth" for the current project build. | `.nova/prd-*.json` |

## 4. Model Router & Fallbacks

Defined in `src/llm/model-router.ts`, the router handles the cost/quality tradeoff.

**Tiers:**
- `free`: Uses Ollama (qwen2.5, deepseek-coder).
- `paid`: Uses OpenAI (gpt-4o) or Anthropic (claude-3-opus).
- `hybrid`: Uses local models for simple tasks, cloud models for complex reasoning.

**Circuit Breaker**: Detects repeated API failures and temporarily disables specific models.

**Fallback Chains**: If a primary model fails, the router automatically tries the next model in the chain (e.g., `gpt-4o` -> `claude-3-sonnet` -> `gpt-4o-mini`).
