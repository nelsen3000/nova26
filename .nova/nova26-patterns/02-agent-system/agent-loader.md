# Agent Loader

## Source
Extracted from Nova26 `src/orchestrator/agent-loader.ts`

---

## Pattern: Agent Loader with Cache and Fallback Defaults

The Agent Loader pattern provides a cached, file-based mechanism for loading agent prompt templates from the `.nova/agents/` directory. Each agent in the NOVA26 multi-agent system is defined as a markdown file, not code. The loader reads these files on demand, caches them in memory, and falls back to hardcoded default prompts when a file is missing — ensuring the system always has a working prompt for every agent.

---

## Implementation

### Code Example

```typescript
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// In-memory cache for loaded agent prompts
const agentCache = new Map<string, string>();

export async function loadAgent(agentName: string): Promise<string> {
  // Check cache first
  if (agentCache.has(agentName)) {
    return agentCache.get(agentName)!;
  }

  const novaDir = join(process.cwd(), '.nova');
  const agentPath = join(novaDir, 'agents', `${agentName.toLowerCase()}.md`);

  if (!existsSync(agentPath)) {
    // Return a default agent prompt if file doesn't exist
    const defaultPrompt = getDefaultAgentPrompt(agentName);
    agentCache.set(agentName, defaultPrompt);
    return defaultPrompt;
  }

  const content = readFileSync(agentPath, 'utf-8');
  agentCache.set(agentName, content);
  return content;
}

function getDefaultAgentPrompt(agentName: string): string {
  const defaultPrompts: Record<string, string> = {
    SUN: `# SUN - Orchestrator Agent\n\nYou are SUN, the chief orchestrator...`,
    EARTH: `# EARTH - Product Specification Agent\n\nYou are EARTH...`,
    PLUTO: `# PLUTO - Database Schema Agent\n\nYou are PLUTO...`,
    // ... one entry per agent
  };

  return defaultPrompts[agentName] || `# ${agentName} Agent\n\nYou are ${agentName}, a specialized agent in the NOVA26 system.\n`;
}

export function clearAgentCache(): void {
  agentCache.clear();
}

export function listAvailableAgents(): string[] {
  return [
    'SUN', 'MERCURY', 'VENUS', 'EARTH', 'MARS', 'PLUTO', 'SATURN',
    'JUPITER', 'ENCELADUS', 'GANYMEDE', 'NEPTUNE', 'CHARON', 'URANUS',
    'TITAN', 'EUROPA', 'MIMAS', 'IO', 'TRITON', 'CALLISTO', 'ATLAS', 'ANDROMEDA'
  ];
}
```

### Key Concepts

- Agents are markdown prompt templates, not executable code
- A `Map<string, string>` cache avoids repeated filesystem reads
- Case-normalized filenames (`agentName.toLowerCase()`) prevent mismatches
- Hardcoded default prompts guarantee every agent has a usable prompt even without a file on disk
- `clearAgentCache()` enables hot-reloading during development

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Loading the agent file on every call without caching
export async function loadAgent(name: string): Promise<string> {
  const path = join(process.cwd(), '.nova', 'agents', `${name}.md`);
  return readFileSync(path, 'utf-8'); // Throws if file missing, no cache
}
```

Repeated filesystem reads are slow and the missing-file crash halts the entire orchestrator.

### ✅ Do This Instead

```typescript
// Cache + fallback pattern
export async function loadAgent(agentName: string): Promise<string> {
  if (agentCache.has(agentName)) {
    return agentCache.get(agentName)!;
  }

  const agentPath = join(novaDir, 'agents', `${agentName.toLowerCase()}.md`);

  if (!existsSync(agentPath)) {
    const defaultPrompt = getDefaultAgentPrompt(agentName);
    agentCache.set(agentName, defaultPrompt);
    return defaultPrompt;
  }

  const content = readFileSync(agentPath, 'utf-8');
  agentCache.set(agentName, content);
  return content;
}
```

Cache first, then filesystem, then fallback — three layers of resilience.

---

## When to Use This Pattern

✅ **Use for:**
- Loading prompt templates for any multi-agent LLM orchestrator
- Any system where configuration lives in user-editable files that may or may not exist
- Plugin/extension loading where defaults must always be available

❌ **Don't use for:**
- Loading large binary assets (use streaming instead)
- Configurations that must be validated at startup (use a schema validator, not silent fallbacks)

---

## Benefits

1. Zero-downtime agent loading — missing files never crash the orchestrator
2. Fast repeated access via in-memory caching
3. User-customizable agents — edit a markdown file to change behavior
4. Predictable fallback behavior with hardcoded defaults for all 21 agents

---

## Related Patterns

- See `../01-orchestration/ralph-loop-execution.md` for how the orchestrator dispatches tasks to loaded agents
- See `./agent-explanations.md` for the companion pattern that provides human-readable explanations of what each agent does
- See `./prd-generator.md` for how the SUN agent prompt is used during PRD generation

---

*Extracted: 2026-02-18*
