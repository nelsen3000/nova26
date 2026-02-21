# Test Runner Gate

## Source
Extracted from Nova26 `src/gates/test-runner-gate.ts`

---

## Pattern: Test Runner Gate

The test runner gate performs smoke tests on LLM-generated code by wrapping extracted code blocks in try-catch harnesses and executing them through Piston. It targets MARS (backend) and VENUS (frontend) agent outputs specifically, skipping other agents. The gate supports TypeScript, JavaScript, and Python code blocks, creating language-appropriate smoke test wrappers that check for runtime exceptions. A `SMOKE_TEST_PASSED` sentinel in stdout signals success.

---

## Implementation

### Code Example

```typescript
import { getPistonClient, PistonClient } from './piston-client.js';
import type { LLMResponse, Task, GateResult } from '../types/index.js';

/**
 * Extract code blocks with language metadata from LLM response.
 */
function extractCodeBlocks(content: string): { language: string; code: string }[] {
  const blocks: { language: string; code: string }[] = [];
  const patterns: [string, RegExp][] = [
    ['typescript', /```typescript\n([\s\S]*?)\n```/g],
    ['javascript', /```javascript\n([\s\S]*?)\n```/g],
    ['python', /```python\n([\s\S]*?)\n```/g],
  ];

  for (const [language, regex] of patterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      blocks.push({ language, code: match[1].trim() });
    }
  }
  return blocks;
}

/**
 * Wrap code in a language-appropriate smoke test harness.
 * Success is signaled by printing SMOKE_TEST_PASSED to stdout.
 */
function createSmokeTest(code: string, language: string): string {
  if (language === 'typescript' || language === 'javascript') {
    return `
try {
  ${code}
  console.log('SMOKE_TEST_PASSED');
} catch (e) {
  console.error('SMOKE_TEST_FAILED:', e.message);
  process.exit(1);
}
`;
  } else if (language === 'python') {
    return `
try:
  ${code}
  print('SMOKE_TEST_PASSED')
except Exception as e:
    print('SMOKE_TEST_FAILED:', str(e))
    exit(1)
`;
  }
  return code;
}

/**
 * Test runner gate — runs smoke tests on MARS/VENUS agent output.
 */
export async function testRunnerGate(
  response: LLMResponse,
  task: Task
): Promise<GateResult> {
  // Agent-scoped: only MARS and VENUS produce executable code
  const supportedAgents = ['MARS', 'VENUS'];
  if (!supportedAgents.includes(task.agent)) {
    return {
      gate: 'test-runner',
      passed: true,
      message: `Test runner only runs for MARS/VENUS agents, skipping for ${task.agent}`,
    };
  }

  const client = getPistonClient();
  if (!(await client.isAvailable())) {
    return {
      gate: 'test-runner',
      passed: true,
      message: 'Piston not available, skipping smoke test',
    };
  }

  const codeBlocks = extractCodeBlocks(response.content);
  if (codeBlocks.length === 0) {
    return {
      gate: 'test-runner',
      passed: true,
      message: 'No executable code blocks found, skipping smoke test',
    };
  }

  const failures: string[] = [];
  for (const block of codeBlocks) {
    const smokeTest = createSmokeTest(block.code, block.language);

    let result;
    switch (block.language) {
      case 'typescript':
        result = await client.executeTypeScript(smokeTest, 15000);
        break;
      case 'javascript':
        result = await client.executeJavaScript(smokeTest, 15000);
        break;
      case 'python':
        result = await client.executePython(smokeTest, 15000);
        break;
      default:
        continue;
    }

    if (!result.stdout.includes('SMOKE_TEST_PASSED')) {
      if (result.exitCode !== 0 || result.stderr) {
        failures.push(
          `${block.language}: ${(result.stderr || result.stdout).substring(0, 200)}`
        );
      }
    }
  }

  if (failures.length > 0) {
    return {
      gate: 'test-runner',
      passed: false,
      message: `Smoke test failed:\n${failures.join('\n')}`,
    };
  }

  return {
    gate: 'test-runner',
    passed: true,
    message: `Smoke tests passed (${codeBlocks.length} block(s))`,
  };
}
```

### Key Concepts

- Agent-scoped execution: only runs for MARS (backend) and VENUS (frontend) agents that produce executable code
- Smoke test harness: wraps code in try-catch with a `SMOKE_TEST_PASSED` sentinel for pass/fail detection
- Multi-language support: TypeScript, JavaScript, and Python with language-appropriate wrappers
- Sentinel-based result checking: looks for `SMOKE_TEST_PASSED` in stdout rather than relying solely on exit codes

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Running smoke tests for ALL agents — wastes time on non-code agents
export async function testRunnerGate(response: LLMResponse, task: Task): Promise<GateResult> {
  // No agent check — EARTH (specs), CALLISTO (docs) get smoke-tested for no reason
  const codeBlocks = extractCodeBlocks(response.content);
  // ...
}

// Relying only on exit code — misses cases where code runs but produces errors
if (result.exitCode === 0) {
  continue; // Might miss runtime errors that don't set exit code
}

// No timeout on Piston execution — infinite loops in generated code hang the pipeline
const result = await client.executeTypeScript(smokeTest);
```

### ✅ Do This Instead

```typescript
// Scope to code-producing agents only
const supportedAgents = ['MARS', 'VENUS'];
if (!supportedAgents.includes(task.agent)) {
  return { gate: 'test-runner', passed: true, message: `Skipping for ${task.agent}` };
}

// Use sentinel-based checking for reliable pass/fail detection
if (!result.stdout.includes('SMOKE_TEST_PASSED')) {
  failures.push(`${block.language}: ${result.stderr || result.stdout}`);
}

// Always set a timeout to prevent infinite loops
const result = await client.executeTypeScript(smokeTest, 15000);
```

---

## When to Use This Pattern

✅ **Use for:**
- Validating that LLM-generated code executes without runtime exceptions
- Quick smoke testing of backend (MARS) and frontend (VENUS) agent outputs before integration

❌ **Don't use for:**
- Comprehensive test suites or assertion-based testing (use SATURN agent and Vitest instead)
- Validating code from non-code agents like EARTH (specs) or CALLISTO (docs)

---

## Benefits

1. Catches runtime errors in generated code before it reaches the codebase
2. Agent-scoped — avoids wasting execution time on non-code agents
3. Multi-language smoke testing with a single gate implementation
4. Sentinel-based pass/fail detection is more reliable than exit code alone

---

## Related Patterns

- See `../01-orchestration/gate-runner-pipeline.md` for the pipeline that invokes this gate
- See `piston-client.md` for the code execution service client used by this gate
- See `typescript-gate.md` for the companion gate that validates TypeScript compilation

---

*Extracted: 2025-07-15*
