// Prompt Builder - Builds prompts for LLM calls

import { readFileSync, existsSync } from 'fs';
import { loadAgent } from './agent-loader.js';
import { KronosAtlas } from '../atlas/index.js';
import type { KronosPointer } from '../atlas/types.js';
import type { Task, PRD } from '../types/index.js';

export interface PromptContext {
  systemPrompt: string;
  userPrompt: string;
}

// Shared KronosAtlas instance for semantic context injection
const atlas = new KronosAtlas();

export async function buildPrompt(task: Task, prd: PRD): Promise<PromptContext> {
  // Load the agent template
  const agentTemplate = await loadAgent(task.agent);

  // Build the user prompt with task info and dependency context
  let userPrompt = buildUserPrompt(task, prd);

  // Phase 2: Inject Kronos semantic context (best-effort)
  const kronosContext = await buildKronosContext(task, prd);
  if (kronosContext) {
    userPrompt += kronosContext;
  }

  return {
    systemPrompt: agentTemplate,
    userPrompt
  };
}

function buildUserPrompt(task: Task, prd: PRD): string {
  let prompt = `# Task: ${task.title}

## Task ID
${task.id}

## Description
${task.description}

## Agent
${task.agent}

## Phase
${task.phase}

`;
  
  // Add dependency context if there are dependencies
  if (task.dependencies && task.dependencies.length > 0) {
    prompt += buildDependencyContext(task, prd);
  }
  
  // Add instructions
  prompt += `
## Instructions
Complete this task according to your role as ${task.agent}. 

Your output will be validated against quality gates. Ensure:
- All requirements are addressed
- Output follows the specified format
- Edge cases are considered

`;
  
  return prompt;
}

function buildDependencyContext(task: Task, prd: PRD): string {
  let context = `## Context from Completed Dependencies

`;
  
  for (const depId of task.dependencies) {
    const depTask = prd.tasks.find(t => t.id === depId);
    
    if (!depTask) {
      context += `### ${depId}: NOT FOUND\n\nDependency task not found in PRD.\n\n`;
      continue;
    }
    
    if (depTask.status !== 'done') {
      context += `### ${depId}: ${depTask.title}\n\nDependency ${depId} output not yet available (status: ${depTask.status})\n\n`;
      continue;
    }
    
    // Try to read the output file
    context += `### ${depId} — ${depTask.title}:\n`;
    
    if (depTask.output && existsSync(depTask.output.replace(process.cwd(), '.'))) {
      try {
        const outputContent = readFileSync(depTask.output, 'utf-8');
        context += `${outputContent}\n\n`;
      } catch {
        context += `(Output file not readable)\n\n`;
      }
    } else {
      context += `(No output file found - task marked as done)\n\n`;
    }
  }
  
  return context;
}

export function buildRetryPrompt(task: Task, error: string, previousResponse: string): string {
  return `# Retry Task: ${task.title}

## Task ID
${task.id}

## Previous Error
${error}

## Previous Response
${previousResponse}

## Instructions
Please retry this task. The previous attempt failed with the above error.

Address the issues and provide a corrected output.
`;
}

/**
 * Phase 2: Query Kronos for relevant past builds and patterns.
 * Returns a context section to append to the prompt, or null if
 * Kronos is unavailable or returns no results.
 */
async function buildKronosContext(task: Task, prd: PRD): Promise<string | null> {
  try {
    const isAvailable = await atlas.isKronosAvailable();
    if (!isAvailable) {
      return null;
    }

    const projectName = prd.meta?.name || 'nova26';
    const query = `${task.agent} ${task.title} ${task.description}`;
    const result = await atlas.searchPatterns(query, projectName);

    if (result.pointers.length === 0) {
      return null;
    }

    console.log(
      `[Kronos] Found ${result.pointers.length} relevant patterns ` +
      `(~${result.totalTokensSaved} tokens saved via pointers)`
    );

    return formatKronosContext(result.pointers);
  } catch {
    // Kronos context is optional — never block prompt building
    return null;
  }
}

function formatKronosContext(pointers: KronosPointer[]): string {
  let context = `## Historical Context (from Kronos memory)

The following patterns from previous builds may be relevant:

`;

  for (const pointer of pointers) {
    const score = (pointer.relevanceScore * 100).toFixed(0);
    context += `### ${pointer.summary}\n`;
    context += `- **Relevance:** ${score}%\n`;
    context += `- **Source:** ${pointer.id}\n`;
    context += `- **Tokens:** ~${pointer.tokenCount}\n\n`;
  }

  context += `Use these patterns as reference. Prioritize higher-relevance matches.\n\n`;

  return context;
}
