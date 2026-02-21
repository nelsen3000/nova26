# PRD Generator

## Source
Extracted from Nova26 `src/agents/sun-prd-generator.ts`

---

## Pattern: LLM-Driven PRD Generation with Structured Parsing and Fallback

The PRD Generator pattern uses the SUN agent to convert a natural language project description into a structured Product Requirements Document (PRD) with phased, dependency-aware tasks. It sends a carefully crafted prompt to the LLM, parses the JSON response with regex extraction, normalizes the result into typed structures, and falls back to a sensible default PRD if parsing fails. This ensures the orchestrator always has a valid task graph to execute.

---

## Implementation

### Code Example

```typescript
import { callLLM } from '../llm/ollama-client.js';
import type { PRD, Task } from '../types/index.js';

export async function generatePRD(description: string): Promise<PRD> {
  const prompt = buildPRDGenerationPrompt(description);

  const response = await callLLM(
    SUN_AGENT_SYSTEM_PROMPT,
    prompt,
    'SUN'
  );

  // Parse the LLM response into a PRD structure
  const prd = parsePRDResponse(response.content, description);
  return prd;
}

const SUN_AGENT_SYSTEM_PROMPT = `You are SUN, the PRD architect agent for NOVA26.
Your role is to break down project descriptions into actionable tasks for the 6 other agents.

Guidelines:
- Think carefully about what each agent needs to deliver
- Create realistic, comprehensive task breakdowns
- Ensure dependencies flow logically (data model → schema → implementation → tests)
- Set phase 0 tasks as "ready", others as "pending"

Return ONLY valid JSON, no other text.`;
```

### Prompt Construction

```typescript
function buildPRDGenerationPrompt(description: string): string {
  return `Generate a Product Requirements Document (PRD) for the following project:

Project Description: ${description}

Create a structured PRD with:
1. A clear project name and version
2. A list of tasks that need to be completed

For each task, specify:
- id: unique identifier (e.g., "sun-001")
- title: brief task title
- description: detailed description
- agent: which NOVA26 agent should handle this (SUN, EARTH, PLUTO, MERCURY, JUPITER, VENUS, MARS)
- status: "ready" for phase 0 tasks, "pending" for others
- phase: execution phase (0 = immediate, 1+ = depends on previous)
- dependencies: array of task IDs this depends on
- attempts: 0
- createdAt: current ISO timestamp

Return the PRD as a JSON object...`;
}
```

### Resilient JSON Parsing

```typescript
function parsePRDResponse(content: string, description: string): PRD {
  // Try fenced code block first
  let jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
  let jsonStr = jsonMatch?.[1]?.trim() || content;

  // Fallback: find raw JSON object
  if (!jsonMatch) {
    const objMatch = content.match(/\{[\s\S]*\}/);
    if (objMatch) {
      jsonStr = objMatch[0];
    }
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return normalizePRD(parsed, description);
  } catch (error) {
    console.warn('Failed to parse LLM response, using fallback');
    return createFallbackPRD(description);
  }
}
```

### Task Normalization and Fallback

```typescript
function normalizeTask(task: any, index: number): Task {
  return {
    id: task.id || `task-${index.toString().padStart(3, '0')}`,
    title: task.title || 'Untitled Task',
    description: task.description || '',
    agent: task.agent || 'MARS',
    status: task.phase === 0 ? 'ready' : 'pending',
    dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
    phase: typeof task.phase === 'number' ? task.phase : 0,
    attempts: 0,
    createdAt: task.createdAt || new Date().toISOString()
  };
}

function createFallbackPRD(description: string): PRD {
  const now = new Date().toISOString();
  const projectName = generateProjectName(description);

  return {
    meta: { name: projectName, version: '1.0.0', createdAt: now },
    tasks: [
      { id: 'earth-001', title: 'Define data model', agent: 'EARTH', status: 'ready', phase: 0, dependencies: [], attempts: 0, createdAt: now, description: `Define data models for ${projectName}` },
      { id: 'pluto-001', title: 'Create database schema', agent: 'PLUTO', status: 'pending', phase: 1, dependencies: ['earth-001'], attempts: 0, createdAt: now, description: `Create Convex schema for ${projectName}` },
      { id: 'venus-001', title: 'Implement API endpoints', agent: 'VENUS', status: 'pending', phase: 2, dependencies: ['pluto-001'], attempts: 0, createdAt: now, description: `Implement API for ${projectName}` },
      { id: 'mars-001', title: 'Write tests', agent: 'MARS', status: 'pending', phase: 3, dependencies: ['venus-001'], attempts: 0, createdAt: now, description: `Write tests for ${projectName}` },
    ]
  };
}
```

### Key Concepts

- System prompt constrains the LLM to return only valid JSON
- Multi-strategy JSON extraction: fenced code block → raw object match → fallback
- Every field in `normalizeTask` has a sensible default, so partial LLM output still works
- Fallback PRD provides a minimal but valid task graph (EARTH → PLUTO → VENUS → MARS)
- Phase-based dependency model: phase 0 = ready, phase N = depends on phase N-1
- Project name auto-generated from description keywords

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Trusting LLM output without validation or fallback
async function generatePRD(description: string): Promise<PRD> {
  const response = await callLLM(systemPrompt, description, 'SUN');
  return JSON.parse(response.content); // Crashes on malformed JSON
}
```

LLMs frequently return malformed JSON, extra text, or incomplete structures. A bare `JSON.parse` will crash the orchestrator.

### ✅ Do This Instead

```typescript
// Multi-layer parsing with normalization and fallback
async function generatePRD(description: string): Promise<PRD> {
  const response = await callLLM(systemPrompt, prompt, 'SUN');
  try {
    const jsonStr = extractJSON(response.content); // regex extraction
    const parsed = JSON.parse(jsonStr);
    return normalizePRD(parsed, description);       // fill missing fields
  } catch {
    return createFallbackPRD(description);           // always have a valid PRD
  }
}
```

Extract → parse → normalize → fallback. The orchestrator never receives an invalid PRD.

---

## When to Use This Pattern

✅ **Use for:**
- Converting natural language into structured task graphs via LLM
- Any LLM-driven code generation where the output must conform to a schema
- Systems that need guaranteed valid output even when the LLM misbehaves

❌ **Don't use for:**
- Simple prompt/response flows where structured output isn't needed
- Cases where a JSON schema validator (e.g., Zod) is already enforcing structure at the LLM level

---

## Benefits

1. Guaranteed valid PRD — fallback ensures the orchestrator always has work to do
2. Resilient JSON parsing — handles fenced blocks, raw JSON, and garbage gracefully
3. Field-level normalization — partial LLM output is completed with sensible defaults
4. Agent-aware task generation — prompt guides the LLM to assign tasks to the right agents
5. Phase-based dependency model aligns with the Ralph Loop execution order

---

## Related Patterns

- See `./agent-loader.md` for how the SUN agent prompt template is loaded
- See `../01-orchestration/ralph-loop-execution.md` for how the generated PRD is executed
- See `../01-orchestration/task-picker.md` for how tasks from the PRD are selected for execution

---

*Extracted: 2026-02-18*
