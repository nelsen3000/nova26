# Gate Runner Pipeline

## Source
Extracted from Nova26 `src/orchestrator/gate-runner.ts`

---

## Pattern: Gate Runner Pipeline

The gate runner validates LLM responses before they are accepted. It runs hard limits first (non-negotiable constraints loaded from `hard-limits.json`), then configurable gates in sequence: response-validation, mercury-validator, schema-validation, typescript-check, and test-runner. Gates fail fast — the pipeline stops on the first failure. The MERCURY validator uses a real LLM call for semantic validation with a keyword-based fallback when the LLM is unavailable.

---

## Implementation

### Code Example

```typescript
import type { GateResult, LLMResponse, Task, HardLimit, HardLimitsConfig } from '../types/index.js';
import { callLLM } from '../llm/ollama-client.js';

export interface GateRunnerConfig {
  enabled: boolean;
  gates: string[];
  llmCaller?: LLMCaller;
}

export async function runGates(
  task: Task,
  response: LLMResponse,
  config: GateRunnerConfig
): Promise<GateResult[]> {
  const results: GateResult[] = [];

  // 1. Hard limits — checked first, non-negotiable
  const hardLimitsResult = checkHardLimits(task, response);
  results.push(...hardLimitsResult);

  // Stop immediately on SEVERE hard limit failures
  const severeFailures = hardLimitsResult.filter(
    r => !r.passed && r.message.includes('[SEVERE]')
  );
  if (severeFailures.length > 0) return results;

  if (!config.enabled) {
    return [{ gate: 'all', passed: true, message: 'Gates disabled' }];
  }

  // 2. Configurable gates — stop on first failure
  for (const gate of config.gates) {
    const result = await runGate(gate, task, response, config.llmCaller);
    results.push(result);
    if (!result.passed) break;
  }

  return results;
}

function checkLimit(limit: HardLimit, content: string): GateResult | null {
  if (limit.pattern) {
    const regex = new RegExp(limit.pattern.replace(/\\\\/g, '\\'), 'is');
    if (regex.test(content)) {
      const severity = limit.severity === 'SEVERE' ? '[SEVERE] ' : '';
      return {
        gate: `hard-limit:${limit.name}`,
        passed: false,
        message: `${severity}${limit.message}`,
      };
    }
  }
  if (limit.check) {
    switch (limit.check) {
      case 'count_ui_states': return checkUIStates(content, limit);
      case 'must_use_math_floor': return checkChipMath(content, limit);
    }
  }
  return null;
}

async function validateWithMercury(
  task: Task,
  response: LLMResponse,
  llmCaller?: LLMCaller
): Promise<GateResult> {
  const llm = llmCaller || callLLM;
  try {
    const result = await llm(mercurySystemPrompt, validationPrompt, 'MERCURY');
    const { passed, reason } = parseMercuryResponse(result.content);
    return { gate: 'mercury-validator', passed, message: reason || 'MERCURY validation completed' };
  } catch {
    // Graceful fallback to keyword-based validation
    return validateWithMercuryFallback(task, response);
  }
}
```

### Key Concepts

- Hard limits first: non-negotiable constraints from `hard-limits.json` are checked before any configurable gate
- Fail-fast pipeline: gates run in sequence and stop on the first failure
- MERCURY semantic validation: uses a real LLM call with a fallback to keyword matching
- Custom check functions: extensible via `limit.check` for domain-specific validations (UI states, chip math)

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// No hard limits — agents can produce any output unchecked
const results = [];
for (const gate of config.gates) {
  results.push(await runGate(gate, task, response));
}
// Missing: checkHardLimits(task, response) before configurable gates

// Continuing after SEVERE failure — defeats the purpose of hard limits
const hardResults = checkHardLimits(task, response);
results.push(...hardResults);
// Should stop here if any SEVERE failure, but continues to next gate

// No fallback for MERCURY LLM failure — gate crashes when Ollama is down
const result = await callLLM(mercuryPrompt, validationPrompt, 'MERCURY');
// Should catch and fall back to keyword-based validation
```

### ✅ Do This Instead

```typescript
// Check hard limits first, stop on SEVERE
const hardResults = checkHardLimits(task, response);
results.push(...hardResults);
if (hardResults.some(r => !r.passed && r.message.includes('[SEVERE]'))) {
  return results;
}

// MERCURY with graceful fallback
try {
  const result = await llm(mercuryPrompt, validationPrompt, 'MERCURY');
  return { gate: 'mercury-validator', passed: parseMercuryResponse(result.content).passed };
} catch {
  return validateWithMercuryFallback(task, response);
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Validating LLM outputs before accepting them into a pipeline
- Enforcing non-negotiable constraints (hard limits) alongside configurable quality checks

❌ **Don't use for:**
- Simple pass/fail checks that don't need a multi-stage pipeline or severity levels

---

## Benefits

1. Layered validation — hard limits catch critical violations before softer gates run
2. Fail-fast efficiency — stops on the first failure instead of running all gates unnecessarily
3. Graceful degradation — MERCURY falls back to keyword matching when the LLM is unavailable
4. Extensible — new gates and custom check functions can be added without changing the pipeline structure

---

## Related Patterns

- See `ralph-loop-execution.md` for where the gate runner is called in the task processing pipeline
- See `council-consensus-voting.md` for the multi-agent consensus check that runs after gates pass
- See `../06-llm-integration/structured-output.md` for the schema validation gate

---

*Extracted: 2025-07-15*
