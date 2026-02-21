# TypeScript Gate

## Source
Extracted from Nova26 `src/gates/typescript-gate.ts`

---

## Pattern: TypeScript Gate

The TypeScript gate validates code blocks in LLM responses by extracting fenced TypeScript/JavaScript code and compiling it through the Piston code execution service. It parses `typescript`, `ts`, and `javascript` code fences from the response content, sends each block to Piston for compilation, and collects structured error diagnostics. The gate degrades gracefully — if Piston is unavailable or TypeScript isn't installed, it passes silently rather than blocking the pipeline.

---

## Implementation

### Code Example

```typescript
import { getPistonClient, PistonClient } from './piston-client.js';
import type { LLMResponse, Task, GateResult } from '../types/index.js';

/**
 * Extract TypeScript code blocks from LLM response.
 * Matches ```typescript, ```ts, and ```javascript fences.
 */
function extractTypeScriptCode(content: string): string[] {
  const codeBlocks: string[] = [];

  const patterns = [
    /```typescript\n([\s\S]*?)\n```/g,
    /```ts\n([\s\S]*?)\n```/g,
    /```javascript\n([\s\S]*?)\n```/g,
  ];

  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      codeBlocks.push(match[1].trim());
    }
  }

  return codeBlocks;
}

/**
 * TypeScript validation gate.
 * Extracts code blocks and validates each through Piston compilation.
 */
export async function typescriptCheckGate(
  response: LLMResponse,
  _task: Task
): Promise<GateResult> {
  const client = getPistonClient();

  // Graceful skip when Piston is unavailable
  const isAvailable = await client.isAvailable();
  if (!isAvailable) {
    return {
      gate: 'typescript-check',
      passed: true,
      message: 'Piston not available, skipping TypeScript check',
    };
  }

  // Graceful skip when TypeScript runtime is missing
  const runtimes = await client.getRuntimes();
  const hasTS = runtimes.some(
    r => r.language === 'typescript' || r.aliases?.includes('ts')
  );
  if (!hasTS) {
    return {
      gate: 'typescript-check',
      passed: true,
      message: 'TypeScript runtime not installed in Piston, skipping',
    };
  }

  const codeBlocks = extractTypeScriptCode(response.content);
  if (codeBlocks.length === 0) {
    return {
      gate: 'typescript-check',
      passed: true,
      message: 'No TypeScript code blocks found in response, skipping',
    };
  }

  // Validate each block with a 15-second timeout
  const errors: string[] = [];
  for (let i = 0; i < codeBlocks.length; i++) {
    const result = await client.executeTypeScript(codeBlocks[i], 15000);
    if (result.exitCode !== 0 && result.stderr) {
      const tsErrors = parseTypeScriptErrors(result.stderr);
      errors.push(
        ...tsErrors.map(e => `Block ${i + 1}: ${e}`)
      );
    }
  }

  if (errors.length > 0) {
    return {
      gate: 'typescript-check',
      passed: false,
      message: `TypeScript validation failed:\n${errors.join('\n')}`,
    };
  }

  return {
    gate: 'typescript-check',
    passed: true,
    message: `TypeScript validation passed (${codeBlocks.length} block(s) validated)`,
  };
}

/**
 * Parse structured TS compiler errors from stderr.
 */
function parseTypeScriptErrors(stderr: string): string[] {
  const errors: string[] = [];
  const tsErrorRegex = /(\d+:\d+).*error TS(\d+): (.+)/g;
  let match;
  while ((match = tsErrorRegex.exec(stderr)) !== null) {
    errors.push(`TS${match[2]}: ${match[3]} (${match[1]})`);
  }
  return errors;
}
```

### Key Concepts

- Regex-based code fence extraction supporting `typescript`, `ts`, and `javascript` language tags
- Per-block compilation through Piston with a 15-second timeout per block
- Structured error parsing that extracts TS error codes, messages, and line positions from stderr
- Graceful degradation: passes silently when Piston or the TypeScript runtime is unavailable

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Failing the gate when Piston is down — blocks the entire pipeline
export async function typescriptCheckGate(response: LLMResponse): Promise<GateResult> {
  const client = getPistonClient();
  const isAvailable = await client.isAvailable();
  if (!isAvailable) {
    return { gate: 'typescript-check', passed: false, message: 'Piston unavailable' };
    // ^^^ This blocks all tasks when the execution service is down
  }
  // ...
}

// Dumping raw stderr without parsing — unhelpful error messages
if (result.exitCode !== 0) {
  errors.push(result.stderr); // Raw compiler output, hard to read
}
```

### ✅ Do This Instead

```typescript
// Pass silently when Piston is unavailable — don't block the pipeline
if (!isAvailable) {
  return { gate: 'typescript-check', passed: true, message: 'Piston not available, skipping' };
}

// Parse structured errors from stderr for actionable diagnostics
const tsErrors = parseTypeScriptErrors(result.stderr);
errors.push(...tsErrors.map(e => `Block ${i + 1}: ${e}`));
// Output: "Block 1: TS2304: Cannot find name 'foo' (3:5)"
```

---

## When to Use This Pattern

✅ **Use for:**
- Validating LLM-generated TypeScript code before accepting it into a codebase
- Catching type errors and syntax issues in code blocks produced by MARS/VENUS agents

❌ **Don't use for:**
- Full test execution or runtime behavior validation (use the test-runner gate instead)
- Validating non-TypeScript languages like Python or Go (extend with language-specific gates)

---

## Benefits

1. Catches compilation errors before generated code reaches the codebase
2. Graceful degradation — never blocks the pipeline when infrastructure is unavailable
3. Structured error output with TS error codes and line positions for easy debugging
4. Multi-block support — validates every code fence in a single response independently

---

## Related Patterns

- See `../01-orchestration/gate-runner-pipeline.md` for the pipeline that invokes this gate
- See `piston-client.md` for the code execution service client used by this gate
- See `test-runner-gate.md` for the companion gate that runs smoke tests on generated code

---

*Extracted: 2025-07-15*
