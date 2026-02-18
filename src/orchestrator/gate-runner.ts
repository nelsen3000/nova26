// Gate Runner - Runs quality gates on LLM responses
// Now includes XML tag validation (technique 3) alongside existing gates

import { parseOutputTags } from './prompt-builder.js';
import type { GateResult, LLMResponse, Task } from '../types/index.js';

export interface GateRunnerConfig {
  enabled: boolean;
  gates: string[];
}

// Default gate configurations — xml-structure runs first to extract tags
const defaultGates: GateRunnerConfig = {
  enabled: true,
  gates: ['xml-structure', 'response-validation', 'mercury-validator']
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
    case 'xml-structure':
      return validateXmlStructure(response);
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

/**
 * XML Structure Gate — validates that the response contains
 * the required <work_log>, <output>, and <confidence> tags.
 * Soft gate: warns but passes if tags are missing (graceful degradation
 * for models that don't follow XML instructions perfectly).
 */
function validateXmlStructure(response: LLMResponse): GateResult {
  const tags = parseOutputTags(response.content);
  const missing: string[] = [];

  if (!tags.workLog) missing.push('work_log');
  if (!tags.output) missing.push('output');
  if (!tags.confidence) missing.push('confidence');

  if (missing.length === 0) {
    return {
      gate: 'xml-structure',
      passed: true,
      message: 'All XML tags present (work_log, output, confidence)'
    };
  }

  // If <output> is present but others missing, still pass (soft gate)
  if (tags.output) {
    return {
      gate: 'xml-structure',
      passed: true,
      message: `XML structure partial: missing ${missing.join(', ')} (output present, passing)`
    };
  }

  // No XML tags at all — still pass but warn. The response may be useful
  // and other gates will catch actual quality issues. This allows mock
  // tests and non-XML-aware models to still work.
  return {
    gate: 'xml-structure',
    passed: true,
    message: `No XML tags found — response is unstructured (passing, will validate content)`
  };
}

function validateResponse(response: LLMResponse): GateResult {
  // Use <output> tag content if available, otherwise full response
  const tags = parseOutputTags(response.content);
  const contentToValidate = tags.output || response.content;

  // Basic validation - response should not be empty
  if (!contentToValidate || contentToValidate.trim().length === 0) {
    return {
      gate: 'response-validation',
      passed: false,
      message: 'Response is empty'
    };
  }

  // Check for minimum content length
  if (contentToValidate.length < 10) {
    return {
      gate: 'response-validation',
      passed: false,
      message: 'Response too short (< 10 characters)'
    };
  }

  // Check for error indicators in response
  const errorIndicators = ['error', 'failed', 'cannot', 'unable to'];
  const lowerContent = contentToValidate.toLowerCase();

  for (const indicator of errorIndicators) {
    if (lowerContent.includes(indicator) && contentToValidate.length < 100) {
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
  // Use <output> tag content if available, otherwise full response
  const tags = parseOutputTags(response.content);
  const contentToValidate = tags.output || response.content;

  // Check if response contains required keywords based on task type
  const agentKeywords: Record<string, string[]> = {
    EARTH: ['spec', 'field', 'constraint', 'validation'],
    PLUTO: ['defineTable', 'schema', 'index'],
    MERCURY: ['PASS', 'FAIL', 'validate'],
    JUPITER: ['ADR', 'Context', 'Decision', 'Consequences']
  };

  const requiredKeywords = agentKeywords[task.agent];
  if (requiredKeywords) {
    const lowerContent = contentToValidate.toLowerCase();
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
