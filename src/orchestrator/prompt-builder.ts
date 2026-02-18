// Prompt Builder - Builds prompts for LLM calls

import { readFileSync, existsSync } from 'fs';
import { loadAgent } from './agent-loader.js';
import { buildRepoMap, formatRepoContext, type RepoMap } from '../codebase/repo-map.js';
import { buildMemoryContext } from '../memory/session-memory.js';
import { buildCommunicationContext, type MessageBus } from '../agents/protocol.js';
import { getToolRegistry, type ToolRegistry } from '../tools/tool-registry.js';
import { getRepoMap as getToolsRepoMap, formatRepoMapForPrompt } from '../tools/repo-map.js';
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
  messageBus?: MessageBus,
  options?: {
    agenticMode?: boolean;
    toolRegistry?: ToolRegistry;
  }
): Promise<PromptContext> {
  // Load the agent template
  const agentTemplate = await loadAgent(task.agent);
  
  let systemPrompt = agentTemplate;
  let userPrompt: string;
  
  // Inject tool definitions and ReAct instructions if agentic mode is enabled
  if (options?.agenticMode) {
    const registry = options.toolRegistry ?? getToolRegistry();
    systemPrompt = injectAgenticInstructions(systemPrompt, task.agent, registry);
    userPrompt = buildAgenticUserPrompt(task, prd, messageBus);
  } else {
    // Build the user prompt with task info and dependency context (non-agentic)
    userPrompt = buildUserPrompt(task, prd, messageBus);
  }
  
  return {
    systemPrompt,
    userPrompt
  };
}

/**
 * Inject tool definitions and ReAct instructions into the system prompt
 */
function injectAgenticInstructions(
  systemPrompt: string,
  agentName: string,
  registry: ToolRegistry
): string {
  const toolPrompt = registry.formatToolsForPrompt(agentName);
  
  const instructions = `
${toolPrompt}

<react_instructions>
Think step by step to complete this task. You have access to tools that can help you:

1. ANALYZE: Understand what needs to be done
2. EXPLORE: Use searchCode, listFiles, readFile to understand the codebase
3. PLAN: Decide your approach before writing code
4. EXECUTE: Use writeFile to create/modify files, runTests to verify
5. VERIFY: Use checkTypes to ensure TypeScript compiles

When using tools:
- Wrap tool calls in <tool_call> tags with JSON: {"name": "toolName", "arguments": {...}}
- You may use multiple tools in sequence before providing final output
- Tool results will be provided in <tool_result> tags

When done:
- Wrap your final output in <final_output> tags
- Include a confidence assessment: <confidence>0.85</confidence> (0.0-1.0)
- The confidence should reflect how sure you are that your solution is correct
</react_instructions>
`;

  return systemPrompt + '\n' + instructions;
}

/**
 * Build user prompt with repo map and agentic context
 */
function buildAgenticUserPrompt(task: Task, prd: PRD, messageBus?: MessageBus): string {
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
  
  // Add repo map for codebase awareness (agentic mode uses tools/repo-map)
  try {
    const repoMap = getToolsRepoMap(process.cwd());
    const repoCtx = formatRepoMapForPrompt(repoMap, task.description);
    if (repoCtx && repoCtx.length > 50) {
      prompt += `## Codebase Context\n\n${repoCtx}\n\n`;
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

  // Add agentic-specific instructions with tool usage examples
  prompt += `## Instructions
Complete this task according to your role as ${task.agent}.

You have access to tools to help you complete this task. Use them to:
- Explore the codebase structure
- Read relevant files
- Search for patterns and implementations
- Write or modify files
- Run tests and type checks

### Tool Usage Format
When you want to use a tool, wrap your call in <tool_call> tags:

<tool_call>
{"name": "searchCode", "arguments": {"query": "function buildPrompt"}}
</tool_call>

<tool_call>
{"name": "readFile", "arguments": {"filePath": "src/orchestrator/prompt-builder.ts"}}
</tool_call>

<tool_call>
{"name": "writeFile", "arguments": {"filePath": "src/example.ts", "content": "export const example = 42;"}}
</tool_call>

You may make multiple tool calls in sequence. Wait for tool results before proceeding.

### Quality Expectations
Your output will be validated against quality gates. Ensure:
- All requirements are addressed
- Output follows the specified format
- Edge cases are considered
- Include a confidence assessment (0.0-1.0) in your final output

`;

  return prompt;
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
