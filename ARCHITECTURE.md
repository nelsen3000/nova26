# Nova26 Architecture

> 21-agent AI-powered IDE/orchestrator — TypeScript, Ollama, Convex, vitest

## System Overview

```
                          ┌─────────────────────┐
                          │     CLI (src/cli/)   │
                          └──────────┬──────────┘
                                     │
                          ┌──────────▼──────────┐
                          │     Ralph Loop       │
                          │  (src/orchestrator/) │
                          └──────────┬──────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
    ┌─────────▼────────┐  ┌─────────▼────────┐  ┌─────────▼────────┐
    │  Task Execution   │  │  Lifecycle Hooks  │  │  Agent Templates │
    │  pick → prompt →  │  │  6 phases, 24     │  │  21 agents in    │
    │  LLM → gates      │  │  feature modules  │  │  EARTH XML       │
    └──────────────────┘  └──────────────────┘  └──────────────────┘
```

Nova26 takes PRD files (JSON task definitions) and builds software by routing each task
through specialized agents powered by local LLMs via Ollama.

## Ralph Loop Execution Flow

```
1. Pick Task     →  task-picker.ts finds next ready task (deps met, not blocked)
2. Load Agent    →  Read agent template, build system prompt
3. Build Prompt  →  Combine agent + task + dependency outputs + memory context
4. Route Model   →  model-routing/ selects optimal model for this agent/task
5. Call LLM      →  ollama-client.ts → Ollama API (localhost:11434)
6. Run Gates     →  gate-runner.ts validates response quality
7. Save + Log    →  Write output, update PRD, store in memory, emit events
        │
        ├── PASS → next task (loop)
        └── FAIL → retry 1x with error feedback → block if still failing
```

### Lifecycle Hook Phases

Modules participate in the build through 6 hook phases fired by `HookRegistry`:

| Phase | When | Example Modules |
|-------|------|-----------------|
| `onBeforeBuild` | Build starts | workflow-engine, model-routing, observability |
| `onBeforeTask` | Before each task | model-routing, perplexity, observability |
| `onAfterTask` | After each task | infinite-memory, observability, collaboration |
| `onTaskError` | Task fails | debug, autonomous-testing, observability |
| `onHandoff` | Agent handoff | observability |
| `onBuildComplete` | Build ends | workflow-engine, infinite-memory, observability |

Hooks run in priority order (ascending) within each phase. Priority range: 8-65.

## Agent System

Agents are markdown prompt templates (not services or processes). SUN loads them as
system prompts into the LLM context. Each agent specializes in a task type:

| Agent | Role | Agent | Role |
|-------|------|-------|------|
| SUN | Orchestrator | NEPTUNE | Data |
| EARTH | Specs | URANUS | Performance |
| MARS | Frontend | PLUTO | Schemas |
| VENUS | Testing | CHARON | Security |
| MERCURY | Validation | IO | Monitoring |
| JUPITER | Backend | EUROPA | Search |
| SATURN | Architecture | GANYMEDE | Deploy |
| TITAN | Infrastructure | CALLISTO | Docs |
| TRITON | CLI Tools | ENCELADUS | Events |
| ATLAS | Learning | ANDROMEDA | Research |
| MIMAS | Config | | |

## Module Dependency Graph

```
src/orchestrator/                    ← Core engine
  ralph-loop.ts                      ← Main execution loop (1,074 lines)
  ralph-loop-types.ts                ← RalphLoopOptions (single source of truth)
  lifecycle-wiring.ts                ← Maps 24 feature flags → hook registrations
  lifecycle-hooks.ts                 ← HookRegistry (phase-based execution)
  task-picker.ts                     ← Task selection + dependency resolution
  prompt-builder.ts                  ← Prompt assembly with context injection
  gate-runner.ts                     ← Quality gate pipeline
  parallel-runner.ts                 ← Concurrent task execution
  event-store.ts                     ← Event-sourced session logging

src/llm/                             ← LLM integration
  ollama-client.ts                   ← Ollama API client
  structured-output.ts               ← Zod schemas for agent outputs

src/model-routing/                   ← Model selection
  router.ts                          ← Hardware-aware routing, affinity scoring
  lifecycle-adapter.ts               ← Lifecycle hooks for model routing

src/atlas/                           ← Semantic memory
  infinite-memory-core.ts            ← Hierarchical knowledge graph
  lifecycle-adapter.ts               ← Lifecycle hooks for memory

src/observability/                   ← Tracing + monitoring
  cinematic-core.ts                  ← Build-level trace visualization
  lifecycle-adapter.ts               ← Lifecycle hooks (all 6 phases)

src/workflow-engine/                 ← Visual workflow
  ralph-visual-engine.ts             ← DAG-based workflow graph
  lifecycle-adapter.ts               ← Lifecycle hooks for workflow

src/tools/perplexity/                ← Research integration
  perplexity-agent.ts                ← Web search + deep research
  lifecycle-adapter.ts               ← Lifecycle hooks for research

src/models/                          ← Model database
  ai-model-vault.ts                  ← Model catalog + comparison
  lifecycle-adapter.ts               ← Lifecycle hooks for model DB

src/collaboration/                   ← Real-time sync
  crdt-core.ts                       ← CRDT-based concurrent editing
  lifecycle-adapter.ts               ← Lifecycle hooks for collaboration
```

## Feature Module Architecture

Each of the 24 feature modules follows the same pattern:

```
src/<module>/
  types.ts               ← Config interface
  <module>-core.ts       ← Implementation
  lifecycle-adapter.ts   ← create<Module>LifecycleHooks() factory
  index.ts               ← Barrel exports
  __tests__/             ← Tests (25+ per module)
```

Modules are wired in 3 places:
1. `RalphLoopOptions` in `ralph-loop-types.ts` — config fields
2. `DEFAULT_FEATURE_HOOKS` in `lifecycle-wiring.ts` — phase + priority mapping
3. `wireFeatureHooks()` / `getWiringSummary()` — flag → config key mapping

## Configuration Cascade

```
RalphLoopOptions (code defaults)
       ↓
.nova/config.json (project config)
       ↓
Environment variables (runtime overrides)
```

All config flows through `RalphLoopOptions` — the single source of truth.

## Quality Gates Pipeline

```
Response Validation → Agent-Specific Checks → TypeScript Check → Test Runner
        │                    │                       │                │
      non-empty          format ok               tsc --noEmit    vitest run
```

1 retry allowed with failure feedback injected into the retry prompt.

## Key Constraints

- **TypeScript strict mode** — no `any`, strict null checks
- **ESM imports** — all imports use `.js` extension
- **Local-first** — runs against Ollama on localhost
- **No real I/O in tests** — everything mocked via `vi.mock()`
- **24 feature modules** — all independently toggleable via `*Enabled` flags

## Testing

- **Framework**: vitest
- **Current count**: 4,900+ tests across 167+ files
- **Property tests**: fast-check based (`src/taste-vault/property-tests.ts`)
- **Prompt snapshots**: drift detection (`src/testing/prompt-snapshots.test.ts`)
- **CI**: GitHub Actions with Node 20/22 matrix
