# Structured Output

## Source
Extracted from Nova26 `src/llm/structured-output.ts`

---

## Pattern: Zod-Validated Structured Output from LLM Responses

The structured output module defines per-agent Zod schemas for all 21 Nova26 agents and provides a `callLLMStructured<T>()` function that requests JSON from the LLM, extracts it from fenced code blocks or raw content, validates it against the schema, and returns a typed `StructuredLLMResponse<T>`. If validation fails, it falls back gracefully to the raw response with a best-effort parse, ensuring the pipeline never crashes on malformed LLM output.

---

## Implementation

### Code Example

```typescript
import { z } from 'zod';
import type { LLMResponse } from '../types/index.js';
import { callLLM } from './ollama-client.js';

export interface StructuredLLMResponse<T> extends LLMResponse {
  parsed: T;
}

// Example: MERCURY agent validation report schema
export const MercurySchema = z.object({
  status: z.enum(['PASS', 'FAIL', 'WARNING']),
  score: z.number().min(0).max(100),
  issues: z.array(z.object({
    severity: z.enum(['error', 'warning', 'info']),
    message: z.string(),
    location: z.string().optional(),
    suggestion: z.string().optional(),
  })),
  summary: z.string(),
  checksPerformed: z.array(z.string()),
});

// Example: SUN agent PRD generation schema
export const SunSchema = z.object({
  meta: z.object({
    name: z.string(),
    version: z.string(),
    createdAt: z.string(),
  }),
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    agent: z.string(),
    status: z.enum(['pending', 'ready', 'running', 'done', 'failed', 'blocked']),
    dependencies: z.array(z.string()),
    phase: z.number().int().min(0),
    attempts: z.number().int().min(0).default(0),
    createdAt: z.string(),
  })).min(1),
});

// Schema registry — maps all 21 agent names to their Zod schemas
export const AgentSchemas: Record<string, z.ZodType<unknown>> = {
  EARTH: EarthSchema,     PLUTO: PlutoSchema,       MERCURY: MercurySchema,
  JUPITER: JupiterSchema, VENUS: VenusSchema,       MARS: MarsSchema,
  SUN: SunSchema,         SATURN: SaturnSchema,     ENCELADUS: EnceladusSchema,
  GANYMEDE: GanymedeSchema, NEPTUNE: NeptuneSchema, TITAN: TitanSchema,
  MIMAS: MimasSchema,     IO: IoSchema,             TRITON: TritonSchema,
  CALLISTO: CallistoSchema, CHARON: CharonSchema,   URANUS: UranusSchema,
  EUROPA: EuropaSchema,   ANDROMEDA: AndromedaSchema, ATLAS: AtlasSchema,
};

/**
 * Extract JSON from LLM response — handles fenced code blocks and raw JSON.
 */
function extractJSON(content: string): string {
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch) return jsonMatch[1].trim();

  const objMatch = content.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];

  return content;
}

/**
 * Call LLM with structured output validation.
 * Appends schema instructions to the prompt, parses JSON from the response,
 * validates against the Zod schema, and falls back gracefully on failure.
 */
export async function callLLMStructured<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  agentName?: string
): Promise<StructuredLLMResponse<T>> {
  const startTime = Date.now();

  const structuredUserPrompt = `${userPrompt}

IMPORTANT: Respond ONLY with valid JSON that matches the schema.`;

  try {
    const response = await callLLM(systemPrompt, structuredUserPrompt, agentName);
    const jsonStr = extractJSON(response.content);
    const parsed = JSON.parse(jsonStr) as T;

    const result = schema.safeParse(parsed);
    if (!result.success) {
      console.warn(`Schema validation failed: ${result.error.message}`);
      // Return raw parse — downstream can still use partial data
      return { content: response.content, parsed, model: response.model,
               duration: Date.now() - startTime, tokens: response.tokens };
    }

    return { content: JSON.stringify(parsed, null, 2), parsed,
             model: response.model, duration: Date.now() - startTime,
             tokens: response.tokens };
  } catch (error: any) {
    // Full fallback — call LLM without structured constraints
    console.warn(`Structured output failed: ${error.message}, falling back`);
    const response = await callLLM(systemPrompt, userPrompt, agentName);

    let parsed: T;
    try {
      parsed = JSON.parse(extractJSON(response.content)) as T;
    } catch {
      parsed = { content: response.content } as unknown as T;
    }

    return { content: response.content, parsed, model: response.model,
             duration: Date.now() - startTime, tokens: response.tokens };
  }
}

/**
 * Convenience wrapper — uses the agent's registered schema if available,
 * otherwise falls back to an unstructured call.
 */
export async function callLLMWithSchema(
  systemPrompt: string,
  userPrompt: string,
  agentName?: string
): Promise<LLMResponse> {
  if (!agentName || !hasAgentSchema(agentName)) {
    return callLLM(systemPrompt, userPrompt, agentName);
  }
  const schema = getAgentSchema(agentName)!;
  return callLLMStructured(systemPrompt, userPrompt, schema, agentName);
}
```

### Key Concepts

- **Per-agent Zod schemas**: All 21 agents have dedicated schemas defining their expected output structure (fields, types, constraints)
- **JSON extraction**: Handles both fenced `` ```json `` blocks and raw JSON objects in LLM responses
- **Graceful degradation**: If schema validation fails, the raw parsed JSON is still returned — downstream code can use partial data
- **Double fallback**: If structured prompting fails entirely, a second unstructured call is made as a last resort
- **Schema registry**: `AgentSchemas` map enables dynamic schema lookup by agent name via `callLLMWithSchema()`
- **Schema helpers**: `hasAgentSchema()` and `getAgentSchema()` provide safe lookup without direct map access

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// No validation — trust LLM output blindly
const response = await callLLM(systemPrompt, userPrompt);
const data = JSON.parse(response.content); // Crashes on malformed JSON
processData(data.tasks); // data.tasks might not exist

// Crash on validation failure — stops the entire pipeline
const result = schema.parse(data); // Throws ZodError, unhandled

// Single JSON extraction strategy — misses fenced code blocks
const data = JSON.parse(response.content); // Fails when LLM wraps JSON in ```json
```

### ✅ Do This Instead

```typescript
// Validate with safeParse — never crashes
const result = schema.safeParse(parsed);
if (!result.success) {
  console.warn(`Validation failed: ${result.error.message}`);
  // Return raw parse for best-effort downstream processing
  return { content: response.content, parsed };
}

// Multi-strategy JSON extraction
function extractJSON(content: string): string {
  const fenced = content.match(/```json\n([\s\S]*?)\n```/);
  if (fenced) return fenced[1].trim();
  const raw = content.match(/\{[\s\S]*\}/);
  if (raw) return raw[0];
  return content;
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Multi-agent systems where each agent produces structured data that downstream agents consume
- Any LLM integration that needs typed, validated output instead of raw text
- Pipelines where partial/degraded output is preferable to a hard failure

❌ **Don't use for:**
- Free-form text generation (creative writing, chat) where structured output adds unnecessary constraints

---

## Benefits

1. **Type safety** — Zod schemas provide compile-time and runtime type guarantees for LLM output
2. **Pipeline resilience** — graceful fallback ensures one malformed response doesn't crash the entire build
3. **Agent-specific contracts** — each agent's expected output is formally defined, making inter-agent communication predictable
4. **Automatic schema lookup** — `callLLMWithSchema()` resolves the correct schema by agent name, no manual wiring needed
5. **Multi-strategy extraction** — handles fenced code blocks, raw JSON, and wrapped content from different LLM providers

---

## Related Patterns

- See `../06-llm-integration/ollama-client.md` for the underlying LLM call that structured output wraps
- See `../06-llm-integration/model-router.md` for tier-based model selection before structured output is applied
- See `../02-agent-system/agent-loader.md` for how agents are loaded with their corresponding schemas
- See `../01-orchestration/ralph-loop-execution.md` for the orchestration loop that consumes structured agent output

---

*Extracted: 2025-07-15*
