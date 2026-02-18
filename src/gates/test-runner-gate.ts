// Test Runner Gate - Runs smoke tests on generated code

import { getPistonClient, PistonClient } from './piston-client.js';
import type { LLMResponse, Task, GateResult } from '../types/index.js';

/**
 * Extract code blocks from LLM response
 */
function extractCodeBlocks(content: string): { language: string; code: string }[] {
  const blocks: { language: string; code: string }[] = [];
  
  // TypeScript
  const tsRegex = /```typescript\n([\s\S]*?)\n```/g;
  let match;
  while ((match = tsRegex.exec(content)) !== null) {
    blocks.push({ language: 'typescript', code: match[1].trim() });
  }
  
  // JavaScript
  const jsRegex = /```javascript\n([\s\S]*?)\n```/g;
  while ((match = jsRegex.exec(content)) !== null) {
    blocks.push({ language: 'javascript', code: match[1].trim() });
  }
  
  // Python
  const pyRegex = /```python\n([\s\S]*?)\n```/g;
  while ((match = pyRegex.exec(content)) !== null) {
    blocks.push({ language: 'python', code: match[1].trim() });
  }
  
  return blocks;
}

/**
 * Create a simple smoke test for the code
 */
function createSmokeTest(code: string, language: string): string {
  if (language === 'typescript' || language === 'javascript') {
    // Wrap in try-catch and check for basic syntax
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
 * Check if Piston is available
 */
async function checkPistonAvailable(client: PistonClient): Promise<boolean> {
  return client.isAvailable();
}

/**
 * Test runner gate
 * For MARS/VENUS agents: extracts code and runs a smoke test
 */
export async function testRunnerGate(
  response: LLMResponse,
  task: Task
): Promise<GateResult> {
  // Only run for MARS and VENUS agents
  const supportedAgents = ['MARS', 'VENUS'];
  if (!supportedAgents.includes(task.agent)) {
    return {
      gate: 'test-runner',
      passed: true,
      message: `Test runner only runs for MARS/VENUS agents, skipping for ${task.agent}`
    };
  }
  
  const client = getPistonClient();
  
  // Check if Piston is available
  const isAvailable = await checkPistonAvailable(client);
  if (!isAvailable) {
    return {
      gate: 'test-runner',
      passed: true,
      message: 'Piston not available, skipping smoke test'
    };
  }
  
  // Extract code blocks
  const codeBlocks = extractCodeBlocks(response.content);
  
  if (codeBlocks.length === 0) {
    return {
      gate: 'test-runner',
      passed: true,
      message: 'No executable code blocks found, skipping smoke test'
    };
  }
  
  // Run smoke tests
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
    
    // Check for success marker
    if (result.stdout.includes('SMOKE_TEST_PASSED')) {
      continue;
    }
    
    // Check for failure
    if (result.exitCode !== 0 || result.stderr) {
      failures.push(`${block.language}: ${result.stderr || result.stdout}`.substring(0, 200));
    }
  }
  
  if (failures.length > 0) {
    return {
      gate: 'test-runner',
      passed: false,
      message: `Smoke test failed:\n${failures.join('\n')}`
    };
  }
  
  return {
    gate: 'test-runner',
    passed: true,
    message: `Smoke tests passed (${codeBlocks.length} block(s))`
  };
}
