import { Task, LLMResponse, AgentTemplate, GateResult } from '../types/index.js';
import { runMercuryValidation } from './ai/mercury-validator.js';
import { runTypeScriptCheck } from './mechanical/typescript-check.js';
import { runTestRunner } from './mechanical/test-runner.js';
import { log, info } from '../utils/logger.js';

/**
 * Run all quality gates on an LLM response
 * Gates are run in order - stops at first critical failure
 */
export async function runGates(
  task: Task,
  llmResponse: LLMResponse,
  agentTemplate: AgentTemplate
): Promise<GateResult[]> {
  const results: GateResult[] = [];
  
  // Gate 1: Response validation
  info('Running gate: response-validation');
  const responseValidation = runResponseValidation(llmResponse);
  results.push(responseValidation);
  
  if (!responseValidation.passed && responseValidation.severity === 'critical') {
    return results;
  }
  
  // Gate 2: Mercury validator (AI gate)
  info('Running gate: mercury-validator');
  const mercuryResult = await runMercuryValidation(task, llmResponse);
  results.push(mercuryResult);
  
  if (!mercuryResult.passed && mercuryResult.severity === 'critical') {
    return results;
  }
  
  // Gate 3: TypeScript check (stub for now)
  info('Running gate: typescript-check');
  const tsResult = await runTypeScriptCheck(llmResponse);
  results.push(tsResult);
  
  if (!tsResult.passed && tsResult.severity === 'critical') {
    return results;
  }
  
  // Gate 4: Test runner (stub for now)
  info('Running gate: test-runner');
  const testResult = await runTestRunner(llmResponse);
  results.push(testResult);
  
  return results;
}

/**
 * Gate 1: Validate that the response is non-empty and doesn't contain BLOCKED
 */
function runResponseValidation(llmResponse: LLMResponse): GateResult {
  // Check for empty content
  if (!llmResponse.content || llmResponse.content.trim().length === 0) {
    return {
      gateName: 'response-validation',
      passed: false,
      message: 'LLM returned empty response',
      severity: 'critical',
    };
  }
  
  // Check for BLOCKED marker (agent self-reported block)
  if (llmResponse.content.trim().startsWith('BLOCKED:')) {
    return {
      gateName: 'response-validation',
      passed: false,
      message: 'Agent self-reported block',
      severity: 'critical',
    };
  }
  
  // Check minimum content length (at least 50 characters)
  if (llmResponse.content.trim().length < 50) {
    return {
      gateName: 'response-validation',
      passed: false,
      message: 'Response too short (less than 50 characters)',
      severity: 'warning',
    };
  }
  
  return {
    gateName: 'response-validation',
    passed: true,
    message: 'Response is valid',
    severity: 'info',
  };
}

/**
 * Check if any critical gates failed
 */
export function hasCriticalFailure(results: GateResult[]): boolean {
  return results.some(r => !r.passed && r.severity === 'critical');
}

/**
 * Get a summary of gate results
 */
export function getGateSummary(results: GateResult[]): string {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  return `${passed} passed, ${failed} failed`;
}
