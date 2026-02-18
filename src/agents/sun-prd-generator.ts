// SUN Agent PRD Generator
// Takes a natural language description and generates a structured PRD
// with appropriate tasks for the NOVA26 orchestrator

import { callLLM } from '../llm/ollama-client.js';
import type { PRD, Task } from '../types/index.js';

/**
 * Generate a PRD from a natural language description
 */
export async function generatePRD(description: string): Promise<PRD> {
  const prompt = buildPRDGenerationPrompt(description);
  
  const response = await callLLM(
    SUN_AGENT_SYSTEM_PROMPT,
    prompt,
    'SUN'
  );
  
  // Parse the LLM response into a PRD structure
  const prd = parsePRDResponse(response.content, description);
  
  return prd;
}

/**
 * Build the prompt for PRD generation
 */
function buildPRDGenerationPrompt(description: string): string {
  return `Generate a Product Requirements Document (PRD) for the following project:

Project Description: ${description}

Create a structured PRD with:
1. A clear project name and version
2. A list of tasks that need to be completed

For each task, specify:
- id: unique identifier (e.g., "sun-001")
- title: brief task title
- description: detailed description of what the task involves
- agent: which NOVA26 agent should handle this (SUN, EARTH, PLUTO, MERCURY, JUPITER, VENUS, MARS)
- status: start as "ready" for phase 0 tasks, "pending" for others
- phase: execution phase (0 = can run immediately, 1+ = depends on previous phase)
- dependencies: array of task IDs this task depends on
- attempts: 0
- createdAt: current ISO timestamp

Task Agent Guidelines:
- SUN: Creating the PRD itself (you're doing this!)
- EARTH: Define data models, specs, field definitions
- PLUTO: Database schema, Convex tables
- MERCURY: Validation logic, testing strategy
- JUPITER: Architecture decisions, ADRs
- VENUS: API endpoints, user interfaces
- MARS: Test implementation, quality assurance

Return the PRD as a JSON object in this format:
{
  "meta": {
    "name": "Project Name",
    "version": "1.0.0", 
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "tasks": [
    {
      "id": "sun-001",
      "title": "Create project PRD",
      "description": "...",
      "agent": "SUN",
      "status": "ready",
      "phase": 0,
      "dependencies": [],
      "attempts": 0,
      "createdAt": "..."
    }
  ]
}

Generate realistic, comprehensive tasks. Include at minimum:
- One EARTH task for data modeling
- One PLUTO task for schema
- One VENUS task for API/UI
- One MARS task for testing
- One JUPITER task for architecture decision (if complex project)

Ensure tasks have proper dependencies (later phases depend on earlier ones).`;
}

const SUN_AGENT_SYSTEM_PROMPT = `You are SUN, thePRD architect agent for NOVA26.
Your role is to break down project descriptions into actionable tasks for the 6 other agents (EARTH, PLUTO, MERCURY, JUPITER, VENUS, MARS).

Guidelines:
- Think carefully about what each agent needs to deliver
- Create realistic, comprehensive task breakdowns
- Ensure dependencies flow logically (data model → schema → implementation → tests)
- Set phase 0 tasks as "ready", others as "pending"
- Use proper dependencies to enforce execution order

Return ONLY valid JSON, no other text.`;

/**
 * Parse LLM response into PRD structure
 */
function parsePRDResponse(content: string, description: string): PRD {
  // Try to extract JSON from response
  let jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
  let jsonStr = jsonMatch?.[1]?.trim() || content;
  
  // Try to find JSON object
  if (!jsonMatch) {
    const objMatch = content.match(/\{[\s\S]*\}/);
    if (objMatch) {
      jsonStr = objMatch[0];
    }
  }
  
  try {
    const parsed = JSON.parse(jsonStr);
    
    // Validate and normalize structure
    return normalizePRD(parsed, description);
  } catch (error) {
    // If parsing fails, create a simple fallback PRD
    console.warn('Failed to parse LLM response, using fallback');
    return createFallbackPRD(description);
  }
}

/**
 * Normalize PRD structure
 */
function normalizePRD(parsed: any, description: string): PRD {
  const now = new Date().toISOString();
  
  // Ensure meta exists
  const meta = parsed.meta || {
    name: generateProjectName(description),
    version: '1.0.0',
    createdAt: now
  };
  
  // Ensure tasks is an array
  const tasks: Task[] = Array.isArray(parsed.tasks) 
    ? parsed.tasks.map((t: any, index: number) => normalizeTask(t, index))
    : [];
  
  return { meta, tasks };
}

/**
 * Normalize a single task
 */
function normalizeTask(task: any, index: number): Task {
  return {
    id: task.id || `task-${index.toString().padStart(3, '0')}`,
    title: task.title || 'Untitled Task',
    description: task.description || '',
    agent: task.agent || 'MARS',
    status: task.phase === 0 ? 'ready' : 'pending',
    dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
    phase: typeof task.phase === 'number' ? task.phase : 0,
    attempts: 0,
    createdAt: task.createdAt || new Date().toISOString()
  };
}

/**
 * Create fallback PRD if LLM fails
 */
function createFallbackPRD(description: string): PRD {
  const now = new Date().toISOString();
  const projectName = generateProjectName(description);
  
  return {
    meta: {
      name: projectName,
      version: '1.0.0',
      createdAt: now
    },
    tasks: [
      {
        id: 'earth-001',
        title: 'Define data model',
        description: `Define data models for ${projectName}`,
        agent: 'EARTH',
        status: 'ready',
        phase: 0,
        dependencies: [],
        attempts: 0,
        createdAt: now
      },
      {
        id: 'pluto-001',
        title: 'Create database schema',
        description: `Create Convex database schema for ${projectName}`,
        agent: 'PLUTO',
        status: 'pending',
        phase: 1,
        dependencies: ['earth-001'],
        attempts: 0,
        createdAt: now
      },
      {
        id: 'venus-001',
        title: 'Implement API endpoints',
        description: `Implement API endpoints for ${projectName}`,
        agent: 'VENUS',
        status: 'pending',
        phase: 2,
        dependencies: ['pluto-001'],
        attempts: 0,
        createdAt: now
      },
      {
        id: 'mars-001',
        title: 'Write tests',
        description: `Write tests for ${projectName}`,
        agent: 'MARS',
        status: 'pending',
        phase: 3,
        dependencies: ['venus-001'],
        attempts: 0,
        createdAt: now
      }
    ]
  };
}

/**
 * Generate project name from description
 */
function generateProjectName(description: string): string {
  // Extract key words from description
  const words = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 4);
  
  if (words.length === 0) {
    return 'New Project';
  }
  
  // Capitalize first letter of each word
  return words
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
