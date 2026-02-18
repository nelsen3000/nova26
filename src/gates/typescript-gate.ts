// TypeScript Gate - Validates TypeScript code using Piston

import { getPistonClient, PistonClient } from './piston-client.js';
import type { LLMResponse, Task, GateResult } from '../types/index.js';

/**
 * Extract TypeScript code blocks from LLM response
 */
function extractTypeScriptCode(content: string): string[] {
  const codeBlocks: string[] = [];
  
  // Match ```typescript ... ``` blocks
  const tsRegex = /```typescript\n([\s\S]*?)\n```/g;
  let match;
  while ((match = tsRegex.exec(content)) !== null) {
    codeBlocks.push(match[1].trim());
  }
  
  // Match ```ts ... ``` blocks
  const tsShortRegex = /```ts\n([\s\S]*?)\n```/g;
  while ((match = tsShortRegex.exec(content)) !== null) {
    codeBlocks.push(match[1].trim());
  }
  
  // Match ```javascript ... ``` blocks (for JS/TS mixed responses)
  const jsRegex = /```javascript\n([\s\S]*?)\n```/g;
  while ((match = jsRegex.exec(content)) !== null) {
    codeBlocks.push(match[1].trim());
  }
  
  return codeBlocks;
}

/**
 * Check if Piston is available for TypeScript
 */
async function checkTypeScriptSupport(client: PistonClient): Promise<boolean> {
  const runtimes = await client.getRuntimes();
  return runtimes.some(r => 
    r.language === 'typescript' || 
    r.aliases?.includes('ts')
  );
}

/**
 * TypeScript validation gate
 * Extracts TypeScript code from LLM response and validates it using Piston
 */
export async function typescriptCheckGate(
  response: LLMResponse,
  _task: Task
): Promise<GateResult> {
  const client = getPistonClient();
  
  // Check if Piston is available
  const isAvailable = await client.isAvailable();
  if (!isAvailable) {
    return {
      gate: 'typescript-check',
      passed: true,
      message: 'Piston not available, skipping TypeScript check'
    };
  }
  
  // Check if TypeScript is supported
  const hasSupport = await checkTypeScriptSupport(client);
  if (!hasSupport) {
    return {
      gate: 'typescript-check',
      passed: true,
      message: 'TypeScript runtime not installed in Piston, skipping'
    };
  }
  
  // Extract TypeScript code
  const codeBlocks = extractTypeScriptCode(response.content);
  
  if (codeBlocks.length === 0) {
    return {
      gate: 'typescript-check',
      passed: true,
      message: 'No TypeScript code blocks found in response, skipping'
    };
  }
  
  // Validate each code block
  const errors: string[] = [];
  
  for (let i = 0; i < codeBlocks.length; i++) {
    const code = codeBlocks[i];
    
    // Try to compile TypeScript
    const result = await client.executeTypeScript(code, 15000);
    
    if (result.exitCode !== 0) {
      // Check if it's a compilation error or runtime error
      if (result.stderr) {
        // Parse TypeScript errors
        const tsErrors = parseTypeScriptErrors(result.stderr);
        if (tsErrors.length > 0) {
          errors.push(...tsErrors.map(e => `Block ${i + 1}: ${e}`));
        } else {
          errors.push(`Block ${i + 1}: ${result.stderr.substring(0, 200)}`);
        }
      } else if (result.stdout) {
        // Runtime output (not necessarily an error)
        errors.push(`Block ${i + 1} runtime output: ${result.stdout.substring(0, 100)}`);
      }
    }
  }
  
  if (errors.length > 0) {
    return {
      gate: 'typescript-check',
      passed: false,
      message: `TypeScript validation failed:\n${errors.join('\n')}`
    };
  }
  
  return {
    gate: 'typescript-check',
    passed: true,
    message: `TypeScript validation passed (${codeBlocks.length} block(s) validated)`
  };
}

/**
 * Parse TypeScript compiler errors
 */
function parseTypeScriptErrors(stderr: string): string[] {
  const errors: string[] = [];
  
  // TypeScript error format: file.ts(line,col): error TS1234: message
  const tsErrorRegex = /(\d+:\d+).*error TS(\d+): (.+)/g;
  let match;
  
  while ((match = tsErrorRegex.exec(stderr)) !== null) {
    errors.push(`TS${match[2]}: ${match[3]} (${match[1]})`);
  }
  
  return errors;
}
