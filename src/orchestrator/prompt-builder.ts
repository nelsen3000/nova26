import { AgentTemplate, LLMRequest, Task } from '../types/index.js';
import { getTemperature } from '../llm/model-router.js';

/**
 * Build a prompt for the LLM from an agent template and task
 */
export function buildPrompt(
  agent: AgentTemplate,
  task: Task,
  context?: string
): LLMRequest {
  const temperature = getTemperature(agent.name);
  
  const userPrompt = buildUserPrompt(task, context);
  
  return {
    model: '', // Will be set by model-router
    systemPrompt: agent.content,
    userPrompt,
    temperature,
  };
}

/**
 * Build the user prompt portion with task details
 */
function buildUserPrompt(task: Task, context?: string): string {
  let prompt = `## Task: ${task.title}\n\n`;
  prompt += `${task.description}\n\n`;
  prompt += `## Requirements\n`;
  prompt += `- Output must be production-ready\n`;
  prompt += `- Follow all constraints in your agent definition above\n`;
  prompt += `- If you need information you don't have, say BLOCKED: [reason]\n\n`;
  prompt += `## Context\n`;
  prompt += context ?? 'No additional context.';
  
  return prompt;
}

/**
 * Rebuild prompt with gate failure feedback for retry
 */
export function buildRetryPrompt(
  agent: AgentTemplate,
  task: Task,
  gateFailures: string[],
  originalResponse: string
): LLMRequest {
  const context = `
## Previous Attempt Failed

The following gates failed:
${gateFailures.map(f => `- ${f}`).join('\n')}

## Original Output
${originalResponse}

## Please fix the issues above and try again.
`.trim();
  
  return buildPrompt(agent, task, context);
}

/**
 * Extract any BLOCKED: marker from LLM response
 */
export function extractBlockedReason(response: string): string | null {
  const match = response.match(/^BLOCKED:\s*(.+)$/m);
  if (match) {
    return match[1].trim();
  }
  return null;
}

/**
 * Check if response indicates the agent blocked itself
 */
export function isResponseBlocked(response: string): boolean {
  return extractBlockedReason(response) !== null;
}
