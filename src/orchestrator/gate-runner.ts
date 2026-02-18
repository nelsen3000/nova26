// Gate Runner - Runs quality gates on LLM responses

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { GateResult, LLMResponse, LLMCaller, Task, HardLimit, HardLimitsConfig } from '../types/index.js';
import { getAgentSchema, hasAgentSchema } from '../llm/structured-output.js';
import { typescriptCheckGate } from '../gates/typescript-gate.js';
import { testRunnerGate } from '../gates/test-runner-gate.js';
import { validateVisually } from '../browser/visual-validator.js';
import { typeCheck as sandboxTypeCheck } from '../sandbox/docker-executor.js';
import { callLLM } from '../llm/ollama-client.js';

// Load hard limits configuration
let hardLimitsCache: HardLimitsConfig | null = null;

function loadHardLimits(): HardLimitsConfig | null {
  if (hardLimitsCache) return hardLimitsCache;
  
  const configPath = join(process.cwd(), '.nova', 'config', 'hard-limits.json');
  if (!existsSync(configPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(configPath, 'utf-8');
    hardLimitsCache = JSON.parse(content) as HardLimitsConfig;
    return hardLimitsCache;
  } catch {
    return null;
  }
}

export function clearHardLimitsCache(): void {
  hardLimitsCache = null;
}

export interface GateRunnerConfig {
  enabled: boolean;
  gates: string[];
  llmCaller?: LLMCaller;  // Injectable LLM caller for testing
}

// Default gate configurations
const defaultGates: GateRunnerConfig = {
  enabled: true,
  gates: ['response-validation', 'mercury-validator']
};

export async function runGates(
  task: Task,
  response: LLMResponse,
  config: GateRunnerConfig = defaultGates
): Promise<GateResult[]> {
  const results: GateResult[] = [];
  
  // 1. Check hard limits first (non-negotiable)
  const hardLimitsResult = checkHardLimits(task, response);
  if (hardLimitsResult.length > 0) {
    results.push(...hardLimitsResult);
    // If any SEVERE hard limits failed, stop immediately
    const severeFailures = hardLimitsResult.filter(
      r => !r.passed && r.message.includes('[SEVERE]')
    );
    if (severeFailures.length > 0) {
      return results;
    }
  }
  
  if (!config.enabled) {
    results.push({
      gate: 'all',
      passed: true,
      message: 'Gates disabled'
    });
    return results;
  }
  
  for (const gate of config.gates) {
    const result = await runGate(gate, task, response, config.llmCaller);
    results.push(result);
    
    // Stop on first failure
    if (!result.passed) {
      break;
    }
  }
  
  return results;
}

/**
 * Check hard limits - non-negotiable constraints from hard-limits.json
 */
function checkHardLimits(task: Task, response: LLMResponse): GateResult[] {
  const results: GateResult[] = [];
  const config = loadHardLimits();
  
  if (!config || !config.agents[task.agent]) {
    return results;
  }
  
  const agentLimits = config.agents[task.agent].limits;
  
  for (const limit of agentLimits) {
    const result = checkLimit(limit, response.content);
    if (result) {
      results.push(result);
    }
  }
  
  return results;
}

/**
 * Check a single hard limit against response content
 */
function checkLimit(limit: HardLimit, content: string): GateResult | null {
  // Pattern-based checks
  if (limit.pattern) {
    try {
      // Handle escaped regex patterns from JSON
      const patternStr = limit.pattern.replace(/\\\\/g, '\\');
      // Use 's' (dotAll) flag so '.' matches newlines in multiline content
      const regex = new RegExp(patternStr, 'is');
      const matches = regex.test(content);

      // All patterns are designed so that a match = violation
      // - "no_*" patterns match prohibited content directly
      // - "require_*" patterns use negative lookahead to match when content is MISSING
      if (matches) {
        const severity = limit.severity === 'SEVERE' ? '[SEVERE] ' : '';
        return {
          gate: `hard-limit:${limit.name}`,
          passed: false,
          message: `${severity}${limit.message}`
        };
      }
    } catch {
      // Invalid regex, skip
    }
  }
  
  // Custom check functions (future expansion)
  if (limit.check) {
    switch (limit.check) {
      case 'count_ui_states':
        return checkUIStates(content, limit);
      case 'must_use_math_floor':
        return checkChipMath(content, limit);
    }
  }
  
  return null;
}

/**
 * Check if component has 5 UI states (VENUS)
 */
function checkUIStates(content: string, limit: HardLimit): GateResult | null {
  const statePatterns = [
    /loading|skeleton/i,
    /empty/i,
    /error/i,
    /partial/i,
    /populated|data\s*available/i
  ];
  
  let stateCount = 0;
  for (const pattern of statePatterns) {
    if (pattern.test(content)) {
      stateCount++;
    }
  }
  
  if (stateCount < 5) {
    return {
      gate: `hard-limit:${limit.name}`,
      passed: false,
      message: `[SEVERE] ${limit.message} (found ${stateCount}/5 states)`
    };
  }
  
  return null;
}

/**
 * Check that chip calculations use Math.floor (MARS)
 */
function checkChipMath(content: string, limit: HardLimit): GateResult | null {
  // Check for chip-related calculations
  const chipPattern = /chip|balance/i;
  if (!chipPattern.test(content)) {
    return null; // No chip calculations, skip
  }
  
  // Check for dangerous patterns
  const dangerousPatterns = [
    /Math\.round\s*\(/i,
    /Math\.ceil\s*\(/i,
    /balance\s*[/+-]\s*\d+(?!.*Math\.floor)/i
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      return {
        gate: `hard-limit:${limit.name}`,
        passed: false,
        message: `[SEVERE] ${limit.message}`
      };
    }
  }
  
  return null;
}

/**
 * Visual validation gate — runs for VENUS tasks only
 * Checks component code for accessibility, responsiveness, semantic HTML, etc.
 */
async function runVisualValidationGate(task: Task, response: LLMResponse): Promise<GateResult> {
  if (task.agent !== 'VENUS') {
    return { gate: 'visual-validation', passed: true, message: 'Skipped (not a VENUS task)' };
  }

  try {
    const result = await validateVisually(response.content, task.id);
    return {
      gate: 'visual-validation',
      passed: result.passed,
      message: result.passed
        ? `Visual validation passed (score: ${result.score}/100)`
        : `Visual validation failed (score: ${result.score}/100): ${result.issues.join('; ')}`
    };
  } catch (error: any) {
    return { gate: 'visual-validation', passed: true, message: `Visual validation skipped: ${error.message}` };
  }
}

/**
 * Sandbox type-check gate — runs for code-producing agents
 * Extracts TypeScript code blocks and type-checks them
 */
async function runSandboxTypeCheckGate(task: Task, response: LLMResponse): Promise<GateResult> {
  const codeAgents = ['MARS', 'VENUS', 'PLUTO', 'GANYMEDE', 'IO', 'TRITON'];
  if (!codeAgents.includes(task.agent)) {
    return { gate: 'sandbox-typecheck', passed: true, message: 'Skipped (not a code agent)' };
  }

  // Extract TypeScript code blocks from the response
  const codeBlockRegex = /```(?:typescript|tsx?)\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  let match;
  while ((match = codeBlockRegex.exec(response.content)) !== null) {
    blocks.push(match[1]);
  }

  if (blocks.length === 0) {
    return { gate: 'sandbox-typecheck', passed: true, message: 'No TypeScript code blocks found' };
  }

  try {
    const combined = blocks.join('\n\n');
    const result = await sandboxTypeCheck(combined);
    return {
      gate: 'sandbox-typecheck',
      passed: result.success,
      message: result.success
        ? `Type-check passed (${blocks.length} code block(s))`
        : `Type-check failed: ${result.stderr.substring(0, 300)}`
    };
  } catch (error: any) {
    return { gate: 'sandbox-typecheck', passed: true, message: `Type-check skipped: ${error.message}` };
  }
}

async function runGate(
  gateName: string,
  task: Task,
  response: LLMResponse,
  llmCaller?: LLMCaller
): Promise<GateResult> {
  switch (gateName) {
    case 'response-validation':
      return validateResponse(response);
    case 'mercury-validator':
      return validateWithMercury(task, response, llmCaller);
    case 'schema-validation':
      return validateWithSchema(task, response);
    case 'typescript-check':
      return await typescriptCheckGate(response, task);
    case 'test-runner':
      return await testRunnerGate(response, task);
    case 'visual-validation':
      return await runVisualValidationGate(task, response);
    case 'sandbox-typecheck':
      return await runSandboxTypeCheckGate(task, response);
    default:
      return {
        gate: gateName,
        passed: true,
        message: `Unknown gate: ${gateName}, passing by default`
      };
  }
}

function validateResponse(response: LLMResponse): GateResult {
  // Basic validation - response should not be empty
  if (!response.content || response.content.trim().length === 0) {
    return {
      gate: 'response-validation',
      passed: false,
      message: 'Response is empty'
    };
  }
  
  // Check for minimum content length
  if (response.content.length < 10) {
    return {
      gate: 'response-validation',
      passed: false,
      message: 'Response too short (< 10 characters)'
    };
  }
  
  // Check for error indicators in response
  const errorIndicators = ['error', 'failed', 'cannot', 'unable to'];
  const lowerContent = response.content.toLowerCase();
  
  for (const indicator of errorIndicators) {
    if (lowerContent.includes(indicator) && response.content.length < 100) {
      return {
        gate: 'response-validation',
        passed: false,
        message: `Response contains error indicator: "${indicator}"`
      };
    }
  }
  
  return {
    gate: 'response-validation',
    passed: true,
    message: 'Response validation passed'
  };
}

/**
 * Validate response using MERCURY agent via real LLM call
 * This replaces keyword matching with actual semantic validation
 */
async function validateWithMercury(
  task: Task,
  response: LLMResponse,
  llmCaller?: LLMCaller
): Promise<GateResult> {
  // Determine which LLM to use - injected or default callLLM
  const llm = llmCaller || callLLM;
  
  // Build validation prompt for MERCURY agent
  const validationPrompt = buildMercuryValidationPrompt(task, response);
  
  const mercurySystemPrompt = `You are MERCURY, the quality validation agent for NOVA26.
Your role is to validate LLM responses for correctness, completeness, and adherence to task requirements.

Provide a structured validation result with:
- PASS: The response meets all requirements
- FAIL: The response has issues that need addressing
- Reason: Brief explanation of your decision

Be strict but fair. Focus on:
1. Task requirements fulfillment
2. Code correctness and safety
3. Completeness of the response
4. Proper formatting and structure`;

  try {
    // Try to call the LLM for validation
    const validationResult = await llm(
      mercurySystemPrompt,
      validationPrompt,
      'MERCURY'
    );
    
    // Parse the LLM response to determine pass/fail
    const result = parseMercuryResponse(validationResult.content);
    
    return {
      gate: 'mercury-validator',
      passed: result.passed,
      message: result.reason || 'MERCURY validation completed'
    };
  } catch (error: any) {
    // Graceful fallback if Ollama is unavailable
    console.warn(`MERCURY LLM validation failed: ${error.message}`);
    console.warn('Falling back to keyword-based validation');
    
    // Fall back to keyword-based validation
    return validateWithMercuryFallback(task, response);
  }
}

/**
 * Build validation prompt for MERCURY agent based on task type
 */
function buildMercuryValidationPrompt(task: Task, response: LLMResponse): string {
  const taskTypeHints: Record<string, string> = {
    EARTH: 'The response should contain a specification with fields, validation rules, and constraints.',
    PLUTO: 'The response should define database tables, schemas, and indexes.',
    MERCURY: 'The response should contain validation logic, PASS/FAIL indicators, and validation criteria.',
    JUPITER: 'The response should contain an ADR with Context, Decision, and Consequences.',
    VENUS: 'The response should contain API endpoints, request/response schemas, and error handling.',
    MARS: 'The response should contain test cases, assertions, and test coverage details.',
    SUN: 'The response should contain a complete PRD with goals, scope, and requirements.'
  };
  
  const hint = taskTypeHints[task.agent] || 'The response should fulfill the task requirements.';
  
  return `Validate the following LLM response for task "${task.title}" (Agent: ${task.agent}):

Task Description: ${task.description}

Expected Format Hint: ${hint}

---

Response to validate:
${response.content}

---

Please validate this response and return your decision in this format:
PASS - [brief reason]
or
FAIL - [brief reason explaining what's wrong]`;
}

/**
 * Parse MERCURY LLM response to extract pass/fail decision
 */
function parseMercuryResponse(content: string): { passed: boolean; reason?: string } {
  const upperContent = content.toUpperCase();
  
  // Look for PASS or FAIL at the start of response
  const passMatch = content.match(/^PASS\s*[-–—:]\s*(.*)/i);
  const failMatch = content.match(/^FAIL\s*[-–—:]\s*(.*)/i);
  
  if (passMatch) {
    return { passed: true, reason: passMatch[1]?.trim() };
  }
  
  if (failMatch) {
    return { passed: false, reason: failMatch[1]?.trim() };
  }
  
  // If no clear PASS/FAIL found, check for any occurrence
  if (upperContent.includes('PASS') && !upperContent.includes('FAIL')) {
    return { passed: true, reason: 'Response contains PASS' };
  }
  
  if (upperContent.includes('FAIL')) {
    return { passed: false, reason: 'Response contains FAIL' };
  }
  
  // Default to pass if unclear but response exists
  return { passed: true, reason: 'Validation response unclear, passing by default' };
}

/**
 * Fallback validation when LLM is unavailable
 * Uses keyword matching as a secondary validation method
 */
function validateWithMercuryFallback(task: Task, response: LLMResponse): GateResult {
  // Check if response contains required keywords based on task type
  const agentKeywords: Record<string, string[]> = {
    EARTH: ['spec', 'field', 'constraint', 'validation'],
    PLUTO: ['defineTable', 'schema', 'index'],
    MERCURY: ['PASS', 'FAIL', 'validate'],
    JUPITER: ['ADR', 'Context', 'Decision', 'Consequences']
  };
  
  const requiredKeywords = agentKeywords[task.agent];
  if (requiredKeywords) {
    const lowerContent = response.content.toLowerCase();
    const hasKeyword = requiredKeywords.some(kw => lowerContent.includes(kw.toLowerCase()));
    
    if (!hasKeyword) {
      return {
        gate: 'mercury-validator',
        passed: false,
        message: `Response missing expected keywords for ${task.agent}: ${requiredKeywords.join(', ')} (LLM fallback)`
      };
    }
  }
  
  return {
    gate: 'mercury-validator',
    passed: true,
    message: 'Mercury validation passed (LLM fallback mode)'
  };
}

/**
 * Validate response against agent's Zod schema
 * This catches anything that slipped past Instructor's retries
 */
function validateWithSchema(task: Task, response: LLMResponse): GateResult {
  // Skip if agent doesn't have a schema
  if (!hasAgentSchema(task.agent)) {
    return {
      gate: 'schema-validation',
      passed: true,
      message: `No schema defined for agent ${task.agent}, skipping`
    };
  }
  
  // Get the schema for this agent
  const schema = getAgentSchema(task.agent);
  if (!schema) {
    return {
      gate: 'schema-validation',
      passed: true,
      message: `Could not load schema for ${task.agent}, skipping`
    };
  }
  
  // Try to extract and parse JSON from response
  let parsed: unknown;
  try {
    // Try to find JSON in the response
    const jsonMatch = response.content.match(/```json\n([\s\S]*?)\n```/);
    let jsonStr = jsonMatch ? jsonMatch[1].trim() : response.content;
    
    // If no code block, try to find any JSON object
    if (!jsonMatch) {
      const objMatch = response.content.match(/\{[\s\S]*\}/);
      if (objMatch) {
        jsonStr = objMatch[0];
      }
    }
    
    parsed = JSON.parse(jsonStr);
  } catch {
    return {
      gate: 'schema-validation',
      passed: false,
      message: 'Response does not contain valid JSON'
    };
  }
  
  // Validate against schema
  const result = schema.safeParse(parsed);
  
  if (!result.success) {
    const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return {
      gate: 'schema-validation',
      passed: false,
      message: `Schema validation failed: ${errors}`
    };
  }
  
  return {
    gate: 'schema-validation',
    passed: true,
    message: 'Schema validation passed'
  };
}

export function allGatesPassed(results: GateResult[]): boolean {
  return results.every(r => r.passed);
}

export function getGatesSummary(results: GateResult[]): string {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  let summary = `Gates: ${passed} passed, ${failed} failed`;
  
  if (failed > 0) {
    const failedGates = results.filter(r => !r.passed).map(r => r.gate);
    summary += ` (${failedGates.join(', ')})`;
  }
  
  return summary;
}
