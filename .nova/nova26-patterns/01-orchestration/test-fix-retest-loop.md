# Test → Fix → Retest Loop

## Source
Extracted from Nova26 `src/orchestrator/ralph-loop.ts` (testFixLoop function)

---

## Pattern: Test → Fix → Retest Loop

After code-producing agents (MARS, VENUS, PLUTO, GANYMEDE, IO, TRITON) complete a task, the test-fix loop automatically runs TypeScript type-checking (`tsc --noEmit`) and the test suite (`vitest run` or `jest --ci`). If failures are found, it builds a fix prompt containing the errors and asks the LLM to regenerate — up to `maxRetries` times. Non-code agents (EARTH, MERCURY, JUPITER) are skipped entirely.

---

## Implementation

### Code Example

```typescript
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Task, LLMResponse, LLMCaller } from '../types/index.js';

interface TestResult {
  passed: boolean;
  errors: string[];
  command: string;
}

function runTypeCheck(): TestResult {
  try {
    execSync('npx tsc --noEmit 2>&1', { encoding: 'utf-8', timeout: 60000, cwd: process.cwd() });
    return { passed: true, errors: [], command: 'tsc --noEmit' };
  } catch (error: any) {
    const errors = (error.stdout || error.message || '')
      .split('\n')
      .filter((line: string) => line.includes('error TS'))
      .slice(0, 10); // Cap at 10 errors for prompt size
    return { passed: false, errors, command: 'tsc --noEmit' };
  }
}

function runTests(): TestResult {
  const hasVitest = existsSync(join(process.cwd(), 'node_modules', '.bin', 'vitest'));
  const cmd = hasVitest ? 'npx vitest run --reporter=verbose 2>&1' : 'npx jest --ci 2>&1';
  try {
    execSync(cmd, { encoding: 'utf-8', timeout: 120000, cwd: process.cwd() });
    return { passed: true, errors: [], command: cmd };
  } catch (error: any) {
    const errors = (error.stdout || error.message || '')
      .split('\n')
      .filter((line: string) => /FAIL|Error|AssertionError|expected|received/i.test(line))
      .slice(0, 15);
    return { passed: false, errors, command: cmd };
  }
}

async function testFixLoop(
  task: Task, response: LLMResponse, systemPrompt: string,
  llmCaller: LLMCaller | undefined, useStructuredOutput: boolean, maxRetries: number
): Promise<LLMResponse> {
  const codeAgents = ['MARS', 'VENUS', 'PLUTO', 'GANYMEDE', 'IO', 'TRITON'];
  if (!codeAgents.includes(task.agent)) return response;

  let currentResponse = response;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const typeCheck = runTypeCheck();
    const testRun = runTests();
    if (typeCheck.passed && testRun.passed) return currentResponse;

    const fixPrompt = buildTestFixPrompt(task, currentResponse.content, [typeCheck, testRun]);
    try {
      currentResponse = await callLLM(systemPrompt, fixPrompt, task.agent);
    } catch {
      return currentResponse; // Return best effort on LLM failure
    }
  }
  return currentResponse;
}

function buildTestFixPrompt(task: Task, originalResponse: string, testResults: TestResult[]): string {
  const failures = testResults.filter(r => !r.passed)
    .map(r => `Command: ${r.command}\nErrors:\n${r.errors.join('\n')}`)
    .join('\n\n');
  return `Your previous output for "${task.title}" produced test failures.\n\n## Previous Output (excerpt)\n${originalResponse.substring(0, 2000)}\n\n## Test Failures\n${failures}\n\nFix the issues and regenerate the complete output.`;
}
```

### Key Concepts

- Agent filtering: only code-producing agents enter the loop; doc/spec agents are skipped
- Error capping: type errors capped at 10, test errors at 15 to fit within LLM context windows
- Response truncation: previous output is capped at 2000 chars in the fix prompt
- Best-effort return: if the LLM call fails during a fix attempt, the last response is returned rather than crashing

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Running test loop on non-code agents — EARTH/MERCURY produce docs, not code
if (options.autoTestFix) {
  response = await testFixLoop(task, response, ...); // Runs tsc on a spec document
}

// No retry cap — infinite fix loop
while (!testsPassed) {
  response = await fixWithLLM(response); // Never terminates
}

// Including full response in fix prompt — exceeds context window
const fixPrompt = `Previous output:\n${response.content}\n\nFix it.`;
// Should truncate: response.content.substring(0, 2000)
```

### ✅ Do This Instead

```typescript
// Guard with agent check
const codeAgents = ['MARS', 'VENUS', 'PLUTO', 'GANYMEDE', 'IO', 'TRITON'];
if (!codeAgents.includes(task.agent)) return response;

// Bounded retries
for (let attempt = 0; attempt < maxRetries; attempt++) { ... }

// Truncated fix prompt
const fixPrompt = buildTestFixPrompt(task, response.content.substring(0, 2000), failures);
```

---

## When to Use This Pattern

✅ **Use for:**
- Automated code generation pipelines where type-checking and tests can validate output
- CI-like workflows where LLM-generated code must compile and pass tests before acceptance

❌ **Don't use for:**
- Non-code outputs (specifications, architecture documents, validation reports)

---

## Benefits

1. Automated quality loop — catches type errors and test failures without human intervention
2. Bounded retries — prevents infinite loops with a configurable `maxRetries` cap
3. Contextual fix prompts — includes specific error messages so the LLM can target its fixes

---

## Related Patterns

- See `ralph-loop-execution.md` for where the test-fix loop is invoked in `processTask`
- See `gate-runner-pipeline.md` for the quality gates that run before the test-fix loop

---

*Extracted: 2025-07-15*
