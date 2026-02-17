// Gate Runner - Runs quality gates on LLM responses

import type { GateResult, LLMResponse, Task } from '../types/index.js';

export interface GateRunnerConfig {
  enabled: boolean;
  gates: string[];
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
  
  if (!config.enabled) {
    results.push({
      gate: 'all',
      passed: true,
      message: 'Gates disabled'
    });
    return results;
  }
  
  for (const gate of config.gates) {
    const result = await runGate(gate, task, response);
    results.push(result);
    
    // Stop on first failure (for now)
    if (!result.passed) {
      break;
    }
  }
  
  return results;
}

async function runGate(
  gateName: string,
  task: Task,
  response: LLMResponse
): Promise<GateResult> {
  switch (gateName) {
    case 'response-validation':
      return validateResponse(response);
    case 'mercury-validator':
      return validateWithMercury(task, response);
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

async function validateWithMercury(task: Task, response: LLMResponse): Promise<GateResult> {
  // For now, this is a simplified version
  // In production, this would call the MERCURY agent to validate
  
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
        message: `Response missing expected keywords for ${task.agent}: ${requiredKeywords.join(', ')}`
      };
    }
  }
  
  return {
    gate: 'mercury-validator',
    passed: true,
    message: 'Mercury validation passed'
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
