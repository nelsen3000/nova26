// Prompt Builder - Builds prompts for LLM calls

import { readFileSync, existsSync } from 'fs';
import { loadAgent } from './agent-loader.js';
import { buildRepoMap, formatRepoContext, type RepoMap } from '../codebase/repo-map.js';
import { buildMemoryContext } from '../memory/session-memory.js';
import { buildCommunicationContext, type MessageBus } from '../agents/protocol.js';
import type { Task, PRD } from '../types/index.js';

// Cache the repo map so we don't rebuild it for every task
let cachedRepoMap: RepoMap | null = null;

/**
 * Get or build the repo map (cached per session)
 */
export function getRepoMap(): RepoMap {
  if (!cachedRepoMap) {
    cachedRepoMap = buildRepoMap(process.cwd());
  }
  return cachedRepoMap;
}

/**
 * Reset the cached repo map (call when codebase changes)
 */
export function invalidateRepoMap(): void {
  cachedRepoMap = null;
}

export interface PromptContext {
  systemPrompt: string;
  userPrompt: string;
}

export async function buildPrompt(
  task: Task,
  prd: PRD,
  messageBus?: MessageBus
): Promise<PromptContext> {
  // Load the agent template
  const agentTemplate = await loadAgent(task.agent);
  
  // Build the user prompt with task info and dependency context
  const userPrompt = buildUserPrompt(task, prd, messageBus);
  
  return {
    systemPrompt: agentTemplate,
    userPrompt
  };
}

function buildUserPrompt(task: Task, prd: PRD, messageBus?: MessageBus): string {
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
  
  // Add codebase context (relevant symbols from repo map)
  try {
    const repoMap = getRepoMap();
    const repoCtx = formatRepoContext(repoMap, task.description, 1500);
    if (repoCtx && repoCtx.length > 50) {
      prompt += `${repoCtx}\n\n`;
    }
  } catch {
    // Repo map unavailable — skip silently
  }

  // Add session memory context (patterns learned from prior builds)
  try {
    const memCtx = buildMemoryContext(task.agent);
    if (memCtx) {
      prompt += `${memCtx}\n\n`;
    }
  } catch {
    // Memory unavailable — skip silently
  }

  // Add agent communication context if message bus is available
  if (messageBus) {
    try {
      const commCtx = buildCommunicationContext(messageBus, task.agent);
      if (commCtx) {
        prompt += commCtx;
      }
    } catch {
      // Communication context unavailable — skip silently
    }
  }

  // Add instructions
  prompt += `## Instructions
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
