# Agent Schema Registry

## Source
Extracted from Nova26 `src/llm/structured-output.ts`

---

## Pattern: Agent Schema Registry

Every Nova26 agent has a Zod schema defining the expected structure of its output. The `AgentSchemas` registry maps agent names to schemas. `callLLMWithSchema` uses these to request structured JSON responses and validate them against the schema. If validation fails, the system warns but continues with the raw response rather than crashing.

---

## Implementation

### Code Example

```typescript
import { z } from 'zod';
import { callLLM } from '../llm/ollama-client.js';
import type { LLMResponse } from '../types/index.js';

export const EarthSchema = z.object({
  specName: z.string(),
  fields: z.array(z.object({ name: z.string(), type: z.string(), required: z.boolean() })),
  validationRules: z.array(z.string()),
});

export const PlutoSchema = z.object({
  tables: z.array(z.object({
    tableName: z.string(),
    columns: z.array(z.object({ name: z.string(), type: z.string(), nullable: z.boolean() })),
    indexes: z.array(z.object({ name: z.string(), columns: z.array(z.string()), unique: z.boolean() })).optional(),
  })),
  migrations: z.array(z.string()),
});

export const AgentSchemas: Record<string, z.ZodType<unknown>> = {
  EARTH: EarthSchema,
  PLUTO: PlutoSchema,
  // ... all 21 agents
};

export function hasAgentSchema(agentName: string): boolean {
  return agentName in AgentSchemas;
}

export function getAgentSchema<T>(agentName: string): z.ZodType<T> | undefined {
  return AgentSchemas[agentName] as z.ZodType<T> | undefined;
}

export async function callLLMWithSchema(
  systemPrompt: string,
  userPrompt: string,
  agentName?: string
): Promise<LLMResponse> {
  if (!agentName || !hasAgentSchema(agentName)) {
    return callLLM(systemPrompt, userPrompt, agentName);
  }

  const schema = getAgentSchema(agentName)!;
  const structuredPrompt = `${userPrompt}\n\nIMPORTANT: Respond ONLY with valid JSON matching the schema.`;
  const response = await callLLM(systemPrompt, structuredPrompt, agentName);

  const jsonStr = extractJSON(response.content);
  const parsed = JSON.parse(jsonStr);
  const result = schema.safeParse(parsed);

  if (!result.success) {
    console.warn(`Schema validation failed: ${result.error.message}`);
    // Warn but continue — don't crash on schema mismatch
  }

  return response;
}
```

### Key Concepts

- Registry pattern: agent name → Zod schema mapping for type-safe structured output
- Graceful degradation: falls back to unstructured `callLLM` when no schema exists
- Warn-not-crash: schema validation failures are logged as warnings, not thrown as errors
- JSON extraction: parses JSON from code fences or raw response content

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// No schema validation — accept any JSON shape
const parsed = JSON.parse(response.content);
// No guarantee it matches expected structure

// Strict failure on schema mismatch — breaks on minor LLM variations
if (!result.success) throw new Error('Schema failed');
// Should warn and continue with raw response

// Same schema for all agents — loses type safety
const UniversalSchema = z.object({ content: z.string() });
```

### ✅ Do This Instead

```typescript
// Per-agent schemas with graceful fallback
if (hasAgentSchema(task.agent)) {
  response = await callLLMWithSchema(systemPrompt, userPrompt, task.agent);
} else {
  response = await callLLM(systemPrompt, userPrompt, task.agent);
}

// Warn on mismatch, don't crash
const result = schema.safeParse(parsed);
if (!result.success) console.warn(`Schema validation failed: ${result.error.message}`);
```

---

## When to Use This Pattern

✅ **Use for:**
- Multi-agent systems where each agent produces a different structured output format
- Pipelines that benefit from type-safe validation of LLM responses

❌ **Don't use for:**
- Free-form text generation where structured output adds no value

---

## Benefits

1. Type-safe agent outputs — Zod schemas catch structural mismatches at runtime
2. Graceful fallback — agents without schemas still work via unstructured calls
3. Centralized registry — adding a new agent's schema is a single registry entry

---

## Related Patterns

- See `ralph-loop-execution.md` for where `callLLMWithSchema` is used in the task processing pipeline
- See `gate-runner-pipeline.md` for the schema-validation gate that uses `getAgentSchema`
- See `../06-llm-integration/structured-output.md` for the full structured output implementation

---

*Extracted: 2025-07-15*
