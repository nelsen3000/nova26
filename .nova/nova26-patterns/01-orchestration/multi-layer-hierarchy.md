# Multi-Layer Orchestrator Hierarchy

> Source: `src/orchestrator/layers/l0-intent.ts`, `src/orchestrator/layers/l1-planning.ts`, `src/orchestrator/layers/l2-execution.ts`, `src/orchestrator/layers/l3-tool.ts`, `src/orchestrator/escalation.ts`

## Description

The Multi-Layer Orchestrator Hierarchy replaces the flat orchestration loop with a 4-layer architecture where each layer has a distinct responsibility and supervisor agent. L0 (SUN) handles intent parsing and user clarification. L1 (SUN + JUPITER + MERCURY) decomposes user intent into a TaskGraph with parallel groups and dependency edges. L2 (assigned agent) executes individual tasks, retrying with re-prompting on failure. L3 (sandbox) handles raw tool calls with backoff retry. Tasks escalate between layers on failure via EscalationEvent, and a backward compatibility mode (`hierarchyLevel: "flat"`) routes everything directly to L2 for zero breaking changes with existing code.

---

## Code Examples

### Core Interfaces

```typescript
import type { AgentName } from '../types/index.js';

export interface OrchestratorHierarchyConfig {
  enabled: boolean;
  layers: LayerConfig[];
  escalationPolicy: 'auto' | 'manual' | 'threshold-based';
  defaultMaxRetries: number;
  globalTimeoutMs: number;
  backwardCompatibilityMode: boolean;
  observabilityLevel: 'minimal' | 'standard' | 'verbose';
}

export interface LayerConfig {
  level: 0 | 1 | 2 | 3;
  supervisorAgent: AgentName;
  workers: AgentName[];
  maxConcurrency: number;
  timeoutMs: number;
  maxRetries: number;
}

export interface UserIntent {
  id: string;
  rawInput: string;
  parsedType: 'build' | 'fix' | 'refactor' | 'explain' | 'deploy' | 'design';
  scope: string[];
  constraints: Record<string, unknown>;
  tasteVaultTags: string[];
  confidence: number;
  needsClarification: boolean;
}

export interface TaskGraph {
  nodes: TaskNode[];
  parallelGroups: TaskNode[][];
}

export interface TaskNode {
  id: string;
  agent: AgentName;
  description: string;
  dependencies: string[];
  estimatedTokens: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface ExecutionArtifact {
  type: 'code' | 'spec' | 'design' | 'test' | 'asset';
  content: string;
  metadata: Record<string, unknown>;
}

export interface ToolRequest {
  toolName: string;
  parameters: Record<string, unknown>;
  sandboxed: boolean;
}

export interface EscalationEvent {
  layer: 0 | 1 | 2 | 3;
  taskId: string;
  error: string;
  retryCount: number;
  suggestedNextLayer: 0 | 1 | 2 | 3;
  requiresHuman: boolean;
}
```

### Layer Dispatcher

```typescript
export class LayerDispatcher {
  private config: OrchestratorHierarchyConfig;

  constructor(config: OrchestratorHierarchyConfig) {
    this.config = config;
  }

  async dispatch(intent: UserIntent): Promise<ExecutionArtifact[]> {
    // Backward compatibility: skip L0/L1, route directly to L2
    if (this.config.backwardCompatibilityMode) {
      return this.executeAtLayer2(intent);
    }

    // L0: Parse and clarify intent (SUN)
    const clarifiedIntent = await this.l0ParseIntent(intent);
    if (clarifiedIntent.needsClarification) {
      return []; // Return to user for clarification
    }

    // L1: Decompose into TaskGraph (SUN + JUPITER + MERCURY)
    const taskGraph = await this.l1Plan(clarifiedIntent);

    // L2: Execute parallel groups in order
    const artifacts: ExecutionArtifact[] = [];
    for (const group of taskGraph.parallelGroups) {
      const groupResults = await Promise.all(
        group.map(node => this.l2Execute(node))
      );
      artifacts.push(...groupResults.flat());
    }

    return artifacts;
  }

  private async handleEscalation(event: EscalationEvent): Promise<void> {
    if (event.requiresHuman) {
      // Pause and wait for human input
      return;
    }

    switch (this.config.escalationPolicy) {
      case 'auto':
        // Re-dispatch to suggested layer automatically
        break;
      case 'threshold-based':
        // Escalate only if retryCount exceeds layer maxRetries
        const layerConfig = this.config.layers.find(
          l => l.level === event.layer
        );
        if (event.retryCount >= (layerConfig?.maxRetries ?? 3)) {
          // Escalate up one layer
        }
        break;
      case 'manual':
        // Always pause for human decision
        break;
    }
  }

  // ... l0ParseIntent, l1Plan, l2Execute, l3Tool, executeAtLayer2
}
```

### Key Concepts

- **4-layer separation**: L0 (intent), L1 (planning), L2 (execution), L3 (tools) -- each layer has a supervisor agent and distinct responsibility
- **TaskGraph with parallel groups**: L1 produces a DAG where independent tasks are batched into parallel groups for concurrent L2 execution
- **Escalation policy**: Failed tasks emit EscalationEvent; the dispatcher routes them to the appropriate layer based on `auto`, `manual`, or `threshold-based` policy
- **Backward compatibility**: Setting `backwardCompatibilityMode: true` routes everything to L2, preserving the existing flat orchestrator behavior with zero breaking changes
- **Supervisor agents**: L0 = SUN (user-facing), L1 = SUN + JUPITER + MERCURY (planning triad), L2 = task-assigned agent, L3 = sandbox

---

## Anti-Patterns

### Don't Do This

```typescript
// Flat dispatch — no separation of intent, planning, and execution
async function handleInput(input: string): Promise<void> {
  const agent = pickAgent(input); // Guessing agent from raw input
  await agent.execute(input);     // No clarification, no task graph, no escalation
}

// Hardcoded layer skipping — breaks escalation chain
async function dispatch(intent: UserIntent): Promise<void> {
  // Skipping L0/L1 without backward compatibility flag
  const result = await l2Execute(intent); // No planning, no dependency resolution
}

// Swallowing escalation events — failures silently disappear
try {
  await l2Execute(task);
} catch {
  console.log('Task failed, moving on'); // No escalation, no retry
}
```

### Do This Instead

```typescript
// Structured dispatch through all layers with escalation
const dispatcher = new LayerDispatcher({
  enabled: true,
  layers: defaultLayers,
  escalationPolicy: 'threshold-based',
  defaultMaxRetries: 3,
  globalTimeoutMs: 300_000,
  backwardCompatibilityMode: false,
  observabilityLevel: 'standard',
});

const artifacts = await dispatcher.dispatch(intent);

// Backward compat when needed — explicit opt-in, not silent skipping
const flatDispatcher = new LayerDispatcher({
  ...config,
  backwardCompatibilityMode: true, // Routes to L2 directly
});
```

---

## When to Use

**Use for:**
- Complex multi-step user requests that require planning, decomposition, and multi-agent coordination
- Any workflow where intent parsing, task planning, and execution should be independently retryable
- Systems that need graceful escalation from tool failures up to human intervention

**Don't use for:**
- Simple single-agent, single-tool interactions (use backward compatibility mode instead)
- Latency-critical paths where the overhead of 4 layers is unacceptable

---

## Benefits

1. **Separation of concerns** -- each layer owns one responsibility (parse, plan, execute, tool-call), making the system easier to reason about and debug
2. **Resilient escalation** -- failures at any layer propagate upward with context, enabling smart retry at the right level instead of blanket retries
3. **Parallel execution** -- TaskGraph parallel groups enable concurrent agent work within a single user request
4. **Zero-cost migration** -- backward compatibility mode preserves existing behavior, allowing incremental adoption of the hierarchy
5. **Observability** -- each layer boundary is a natural tracing point for Langfuse spans and cost tracking

---

## Related Patterns

- See `ralph-loop-execution.md` for the existing flat orchestrator that L2 backward compatibility mode preserves
- See `parallel-task-runner.md` for the parallel execution engine used within L2 parallel groups
- See `task-picker.md` for the sequential task selection that L1 planning replaces
- See `../02-intelligence/smart-retry-escalation.md` for the retry logic used within each layer
- See `event-store.md` for persisting EscalationEvent records

---

*Extracted: 2026-02-19*
