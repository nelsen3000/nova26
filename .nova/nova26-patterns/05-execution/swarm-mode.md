# Swarm Mode

## Source
Extracted from Nova26 `src/swarm/swarm-mode.ts`

---

## Pattern: Multi-Agent Swarm Coordination

Swarm Mode is a collaborative execution pattern where all 21 Nova26 agents are activated simultaneously to tackle complex tasks. Rather than the standard sequential Ralph Loop dispatch (one agent at a time), Swarm Mode defines typed tasks with complexity levels and required agent lists, then activates matching agents in a coordinated sweep.

The pattern uses a declarative agent registry where each agent declares its swarm role and an activation predicate. Convenience functions (`quickSwarm`, `fullSwarm`) provide preset configurations for common complexity levels, making it easy to spin up the right set of agents without manual configuration.

---

## Implementation

### Code Example

```typescript
export interface SwarmTask {
  id: string;
  description: string;
  complexity: 'simple' | 'medium' | 'complex';
  requiredAgents: string[];
  deliverables: string[];
  context?: Record<string, any>;
}

export interface SwarmAgent {
  name: string;
  emoji: string;
  role: string;
  swarmRole: string;
  activatesWhen: (task: SwarmTask) => boolean;
}

export const swarmAgents: SwarmAgent[] = [
  { name: 'SUN', emoji: '☀️', role: 'Orchestrator', swarmRole: 'Task Coordinator',
    activatesWhen: () => true },
  { name: 'EARTH', emoji: '🌍', role: 'Product Specs', swarmRole: 'Requirements Analyst',
    activatesWhen: () => true },
  { name: 'PLUTO', emoji: '🪐', role: 'Database', swarmRole: 'Data Architect',
    activatesWhen: () => true },
  { name: 'MARS', emoji: '🔴', role: 'Backend', swarmRole: 'Implementation Specialist',
    activatesWhen: () => true },
  { name: 'VENUS', emoji: '💫', role: 'Frontend', swarmRole: 'Interface Designer',
    activatesWhen: () => true },
  { name: 'MERCURY', emoji: '☿️', role: 'Validator', swarmRole: 'Quality Gatekeeper',
    activatesWhen: () => true },
  { name: 'JUPITER', emoji: '🟠', role: 'Architecture', swarmRole: 'Strategy Advisor',
    activatesWhen: () => true },
  { name: 'TITAN', emoji: '🌙', role: 'Real-time', swarmRole: 'Live Data Handler',
    activatesWhen: () => true },
  { name: 'SATURN', emoji: '🪐', role: 'Testing', swarmRole: 'Verification Specialist',
    activatesWhen: () => true },
  { name: 'URANUS', emoji: '🔭', role: 'Research', swarmRole: 'Knowledge Gatherer',
    activatesWhen: () => true },
  { name: 'NEPTUNE', emoji: '🔵', role: 'Analytics', swarmRole: 'Metrics Collector',
    activatesWhen: () => true },
];
```

### Swarm Execution and Convenience Functions

```typescript
export async function executeSwarmMode(task: SwarmTask): Promise<void> {
  console.log('\n🐝'.repeat(20));
  console.log('     SWARM MODE ACTIVATED');
  console.log('🐝'.repeat(20) + '\n');

  console.log(`🎯 Mission: ${task.description}`);
  console.log(`📊 Complexity: ${task.complexity.toUpperCase()}`);
  console.log(`👥 Active Agents: ${task.requiredAgents.join(', ')}\n`);

  // Filter agents using their activation predicates
  const activeAgents = swarmAgents.filter(a => a.activatesWhen(task));

  for (const agent of activeAgents) {
    console.log(`${agent.emoji} ${agent.name}: ${agent.swarmRole}...`);
    await new Promise(r => setTimeout(r, 500)); // Simulate agent work
  }

  console.log('\n✅ Swarm mission complete!');
}

/**
 * Quick swarm — minimal agent set for simple tasks
 */
export async function quickSwarm(description: string): Promise<void> {
  await executeSwarmMode({
    id: `swarm-${Date.now()}`,
    description,
    complexity: 'simple',
    requiredAgents: ['SUN', 'MARS', 'MERCURY'],
    deliverables: ['Implementation'],
  });
}

/**
 * Full swarm — all agents for complex tasks
 */
export async function fullSwarm(description: string): Promise<void> {
  await executeSwarmMode({
    id: `swarm-${Date.now()}`,
    description,
    complexity: 'complex',
    requiredAgents: swarmAgents.map(a => a.name),
    deliverables: ['Requirements', 'Implementation', 'Tests'],
  });
}
```

### Key Concepts

- **Declarative agent registry**: Each agent is a data object with a name, role, swarm role, and activation predicate — no subclassing needed
- **Activation predicates**: `activatesWhen` functions let agents self-select based on task properties (complexity, required agents, context)
- **Complexity tiers**: Tasks declare `simple`, `medium`, or `complex` — convenience functions map these to preset agent configurations
- **Typed task model**: `SwarmTask` captures everything needed to coordinate: description, complexity, required agents, deliverables, and optional context

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Hardcoding agent dispatch with no task model
function runAllAgents(description: string): void {
  // No complexity awareness, no activation filtering
  runSun(description);
  runEarth(description);
  runMars(description);
  runVenus(description);
  // ... every agent runs regardless of task needs
}

// No typed task structure — just passing strings around
function dispatch(agentName: string, taskDesc: string): void {
  // No deliverables tracking, no context, no complexity
  agents[agentName].run(taskDesc);
}
```

### ✅ Do This Instead

```typescript
// Use typed tasks with complexity and activation predicates
const task: SwarmTask = {
  id: `swarm-${Date.now()}`,
  description: 'Implement user dashboard',
  complexity: 'complex',
  requiredAgents: ['SUN', 'EARTH', 'VENUS', 'MARS', 'SATURN'],
  deliverables: ['Spec', 'UI Components', 'Backend API', 'Tests'],
};

// Agents self-select based on task properties
await executeSwarmMode(task);

// Or use convenience functions for common patterns
await quickSwarm('Fix login bug');   // SUN + MARS + MERCURY
await fullSwarm('Build new feature'); // All agents
```

---

## When to Use This Pattern

✅ **Use for:**
- Complex features that require multiple specialized agents working together
- Full-stack tasks that span specs, database, backend, frontend, and testing
- Rapid prototyping where you want all perspectives (architecture, security, testing) applied at once

❌ **Don't use for:**
- Simple single-domain tasks (use direct agent dispatch via the Ralph Loop instead)
- Tasks where agent ordering matters critically (swarm is parallel-intent, not strictly sequenced)

---

## Benefits

1. **Declarative coordination** — Agent capabilities are described as data, not buried in dispatch logic
2. **Flexible activation** — Predicate-based filtering means agents can self-select based on any task property
3. **Complexity-aware** — Built-in complexity tiers with convenience functions reduce boilerplate for common scenarios
4. **Extensible** — Adding a new agent is just appending an object to the `swarmAgents` array
5. **Typed task model** — `SwarmTask` interface ensures all coordination metadata is captured and type-checked

---

## Related Patterns

- See `../01-orchestration/ralph-loop-execution.md` for the standard sequential agent dispatch loop (alternative to swarm)
- See `../02-agent-system/agent-loader.md` for how agent prompt templates are loaded from disk
- See `../01-orchestration/parallel-task-runner.md` for parallel execution of independent sub-tasks within the orchestrator
- See `../01-orchestration/council-consensus-voting.md` for multi-agent decision-making via voting (complementary pattern)

---

*Extracted: 2025-07-18*
