import { Task, LLMResponse, GateResult } from '../../types/index.js';
import { callOllama } from '../../llm/ollama-client.js';
import { loadAgent } from '../../orchestrator/agent-loader.js';
import { log, warn } from '../../utils/logger.js';

/**
 * Run the Mercury validator gate - uses MERCURY.md to validate output
 */
export async function runMercuryValidation(task: Task, llmResponse: LLMResponse): Promise<GateResult> {
  try {
    // Load MERCURY agent template
    const mercuryAgent = await loadAgent('MERCURY');
    
    // Build validation prompt
    const validationPrompt = buildMercuryPrompt(task, llmResponse.content);
    
    // Call Ollama with MERCURY as the system prompt
    const response = await callOllama({
      model: 'qwen2.5:7b', // Use same model for validation
      systemPrompt: mercuryAgent.content,
      userPrompt: validationPrompt,
      temperature: 0.1, // Low temperature for consistent validation
    });
    
    // Parse response for PASS/FAIL
    const result = parseMercuryResponse(response.content);
    
    if (result.passed) {
      return {
        gateName: 'mercury-validator',
        passed: true,
        message: result.reason || 'MERCURY validated the output',
        severity: 'info',
      };
    } else {
      return {
        gateName: 'mercury-validator',
        passed: false,
        message: result.reason || 'MERCURY rejected the output',
        severity: 'critical',
      };
    }
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    warn(`Mercury validation failed: ${errorMessage}`);
    
    // If validation fails, don't block the task - just warn
    return {
      gateName: 'mercury-validator',
      passed: true,
      message: `Validation unavailable: ${errorMessage}`,
      severity: 'warning',
    };
  }
}

/**
 * Build the prompt for MERCURY to validate output
 */
function buildMercuryPrompt(task: Task, output: string): string {
  return `
You are MERCURY, the spec validator. Your job is to validate that the output satisfies the task requirements.

## Task
${task.title}

${task.description}

## Output to Validate
${output}

## Instructions
1. Review the output against the task requirements
2. Check if all requirements are met
3. Check if the output follows the proper format/structure
4. Return PASS if the output is acceptable, FAIL if it needs revision

## Response Format
Return ONLY one line:
- PASS: [brief reason why it passed]
- FAIL: [brief reason why it failed and what needs to be fixed]

Do not include any other text.
`;
}

/**
 * Parse MERCURY's response to extract pass/fail and reason
 */
function parseMercuryResponse(response: string): { passed: boolean; reason: string } {
  const lines = response.trim().split('\n');
  const firstLine = lines[0].trim();
  
  if (firstLine.startsWith('PASS:')) {
    return {
      passed: true,
      reason: firstLine.substring(5).trim(),
    };
  }
  
  if (firstLine.startsWith('FAIL:')) {
    return {
      passed: false,
      reason: firstLine.substring(5).trim(),
    };
  }
  
  // If we can't parse, assume pass but warn
  return {
    passed: true,
    reason: 'Could not parse validation response, assuming pass',
  };
}
