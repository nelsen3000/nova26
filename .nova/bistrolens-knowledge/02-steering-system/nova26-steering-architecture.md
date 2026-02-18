# Nova26 Steering System Architecture

## Adapted from BistroLens Steering System

**Source:** BistroLens `.kiro/steering/` directory  
**Category:** Agent Context Management  
**Priority:** P1  
**Reusability:** 10/10

---

## Overview

BistroLens uses a sophisticated steering file system with three inclusion patterns:
- **Always** - Critical system rules loaded for every request
- **FileMatch** - Context-specific rules based on file patterns
- **Manual** - Reference documents loaded on-demand via `#filename`

Nova26 has 21 agent `.md` files but NO steering system. This causes:
1. Context bloat when all 21 agents are loaded
2. No priority management for conflicting guidance
3. No on-demand access to specialized patterns
4. Inefficient token usage

---

## Nova26 Steering Architecture

### Inclusion Categories

```typescript
// Agent inclusion patterns for Nova26
const STEERING_CONFIG = {
  // ALWAYS INCLUDED - Critical system agents
  always: [
    'SUN.md',        // Orchestrator - needed for every build
    'MERCURY.md',    // Quality gate - validates all output
    'RALPH.md',      // Loop controller - manages execution
  ],
  
  // FILEMATCH - Context-specific agents
  fileMatch: {
    'convex/**/*.ts': ['PLUTO.md', 'TITAN.md', 'NEPTUNE.md'],
    'src/**/*.{ts,tsx}': ['MARS.md', 'VENUS.md', 'CHARON.md'],
    'app/**/*.tsx': ['VENUS.md', 'EUROPA.md'],
    '**/*.test.{ts,tsx}': ['SATURN.md'],
    '.nova/specs/**/*.md': ['EARTH.md', 'JUPITER.md'],
  },
  
  // MANUAL - On-demand reference agents
  manual: [
    'URANUS.md',     // Research agent - load via #URANUS
    'ANDROMEDA.md',  // Analysis agent - load via #ANDROMEDA
    'CALLISTO.md',   // Documentation - load via #CALLISTO
    'TRITON.md',     // Deployment - load via #TRITON
    'ATLAS.md',      // Analytics - load via #ATLAS
    'ENCELADUS.md',  // Security - load via #ENCELADUS
    'IO.md',         // Performance - load via #IO
    'MIMAS.md',      // Resilience - load via #MIMAS
    'GANYMEDE.md',   // API integration - load via #GANYMEDE
  ]
};
```

### Implementation Schema

```yaml
---
# Add to top of each agent .md file
inclusion: always|fileMatch|manual
priority: critical|high|medium|low
fileMatchPattern: "pattern/**/*.ext"  # Only for fileMatch
---
```

---

## Pattern: Agent Steering Service

**Source:** BistroLens `README-STEERING-USAGE.md`  
**Nova26 Adaptation:** Create `src/steering/agent-loader.ts`

### Implementation

```typescript
// src/steering/agent-loader.ts

interface AgentConfig {
  name: string;
  file: string;
  inclusion: 'always' | 'fileMatch' | 'manual';
  priority: 'critical' | 'high' | 'medium' | 'low';
  fileMatchPattern?: string;
  tokenEstimate: number;
}

const AGENT_REGISTRY: AgentConfig[] = [
  { name: 'SUN', file: 'SUN.md', inclusion: 'always', priority: 'critical', tokenEstimate: 1500 },
  { name: 'MERCURY', file: 'MERCURY.md', inclusion: 'always', priority: 'critical', tokenEstimate: 1200 },
  { name: 'RALPH', file: 'RALPH.md', inclusion: 'always', priority: 'critical', tokenEstimate: 800 },
  { name: 'PLUTO', file: 'PLUTO.md', inclusion: 'fileMatch', priority: 'high', fileMatchPattern: 'convex/**/*.ts', tokenEstimate: 2000 },
  { name: 'MARS', file: 'MARS.md', inclusion: 'fileMatch', priority: 'high', fileMatchPattern: 'src/**/*.ts', tokenEstimate: 1800 },
  // ... etc
];

export function getRelevantAgents(
  context: { files: string[], taskType: string },
  maxTokens: number = 8000
): string[] {
  const selected: AgentConfig[] = [];
  let tokenCount = 0;
  
  // 1. Always include critical agents
  for (const agent of AGENT_REGISTRY.filter(a => a.inclusion === 'always')) {
    if (tokenCount + agent.tokenEstimate <= maxTokens) {
      selected.push(agent);
      tokenCount += agent.tokenEstimate;
    }
  }
  
  // 2. Match file patterns
  for (const file of context.files) {
    for (const agent of AGENT_REGISTRY.filter(a => a.inclusion === 'fileMatch')) {
      if (minimatch(file, agent.fileMatchPattern!) && 
          !selected.find(s => s.name === agent.name)) {
        if (tokenCount + agent.tokenEstimate <= maxTokens) {
          selected.push(agent);
          tokenCount += agent.tokenEstimate;
        }
      }
    }
  }
  
  // 3. Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  selected.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return selected.map(a => a.name);
}
```

---

## Pattern: Manual Agent Invocation

**Source:** BistroLens `#filename` syntax  
**Nova26 Adaptation:** Parse `#AGENTNAME` in user prompts

### Implementation

```typescript
// src/steering/manual-invocation.ts

export function parseManualAgents(prompt: string): {
  cleanedPrompt: string;
  manualAgents: string[];
} {
  const agentPattern = /#([A-Z]+)/g;
  const matches = [...prompt.matchAll(agentPattern)];
  const manualAgents = matches.map(m => m[1]);
  
  // Remove #AGENT from prompt
  const cleanedPrompt = prompt.replace(agentPattern, '').trim();
  
  return { cleanedPrompt, manualAgents };
}

// Usage in orchestrator
const { cleanedPrompt, manualAgents } = parseManualAgents(userPrompt);
const baseAgents = getRelevantAgents(context);
const allAgents = [...new Set([...baseAgents, ...manualAgents])];
```

---

## Pattern: Context Budget Management

**Source:** BistroLens context optimization techniques  
**Nova26 Adaptation:** Dynamic agent trimming based on token budget

### Implementation

```typescript
// src/steering/context-budget.ts

interface ContextBudget {
  maxTokens: number;
  criticalReserve: number;  // Always keep for critical agents
  priorityWeights: Record<string, number>;
}

export function optimizeContext(
  agents: AgentConfig[],
  budget: ContextBudget
): AgentConfig[] {
  const usableBudget = budget.maxTokens - budget.criticalReserve;
  const criticalAgents = agents.filter(a => a.priority === 'critical');
  const otherAgents = agents.filter(a => a.priority !== 'critical');
  
  let usedTokens = criticalAgents.reduce((sum, a) => sum + a.tokenEstimate, 0);
  const selected = [...criticalAgents];
  
  // Sort by weighted priority
  otherAgents.sort((a, b) => {
    const weightA = budget.priorityWeights[a.priority] * a.tokenEstimate;
    const weightB = budget.priorityWeights[b.priority] * b.tokenEstimate;
    return weightB - weightA;  // Higher weight first
  });
  
  for (const agent of otherAgents) {
    if (usedTokens + agent.tokenEstimate <= usableBudget) {
      selected.push(agent);
      usedTokens += agent.tokenEstimate;
    }
  }
  
  return selected;
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `.nova/agents/*.md` | Add YAML front matter with inclusion/priority |
| `src/steering/agent-loader.ts` | New file - agent selection logic |
| `src/steering/manual-invocation.ts` | New file - #AGENT parsing |
| `src/steering/context-budget.ts` | New file - token budget management |
| `src/orchestrator/ralph-loop.ts` | Integrate steering system |

---

## Migration Plan

1. Add YAML front matter to all 21 agents
2. Create steering service files
3. Update Ralph Loop to use steering
4. Add `#AGENT` support to CLI
5. Test with sample builds
6. Measure token savings

---

*Adapted from BistroLens steering system*
*For Nova26 agent context management*
