// KIMI-ACE-03: Branch Manager for Rehearsal Stage
// Creates multiple implementation branches with different approaches

import { z } from 'zod';
import type { Task } from '../types/index.js';
import { callLLM } from '../llm/ollama-client.js';

// ============================================================================
// Types
// ============================================================================

export type BranchStrategy = 'in-memory';

export interface BranchFile {
  path: string;
  originalContent: string;
  proposedContent: string;
}

export interface RehearsalBranch {
  id: string;
  description: string;
  strategy: BranchStrategy;
  files: BranchFile[];
  createdAt: string;
  status: 'pending' | 'executed' | 'scored' | 'rejected';
  agentNotes: string;
}

// ============================================================================
// Zod Schema for Branch Generation
// ============================================================================

const BranchFileSchema = z.object({
  path: z.string(),
  originalContent: z.string(),
  proposedContent: z.string(),
});

const BranchOutputSchema = z.object({
  description: z.string(),
  files: z.array(BranchFileSchema).min(1),
  agentNotes: z.string(),
});

type BranchOutput = z.infer<typeof BranchOutputSchema>;

// ============================================================================
// Approach Prompts
// ============================================================================

const APPROACH_PROMPTS: Record<number, string> = {
  1: `Approach this task in a straightforward and minimal way.
Focus on correctness and clarity over cleverness.
Use simple, readable code that directly solves the problem.
Avoid unnecessary abstractions or optimizations.`,
  
  2: `Approach this task with optimized and idiomatic code.
Use modern language features and best practices.
Consider performance implications and write clean, maintainable code.
Follow established patterns for this type of task.`,
  
  3: `Approach this task defensively with extensive error handling.
Consider edge cases, input validation, and failure modes.
Add comprehensive error messages and graceful degradation.
Include type guards, null checks, and defensive programming patterns.`,
};

// ============================================================================
// Branch Manager Class
// ============================================================================

export class BranchManager {
  private generateBranchId(agentName: string, index: number): string {
    const timestamp = Date.now();
    return `branch-${agentName.toLowerCase()}-${index}-${timestamp}`;
  }

  /**
   * Create multiple branches with different approaches
   * Makes `count` LLM calls with different approach prompts
   * Each returns JSON: { description, files, agentNotes }
   * Validates with Zod, skips failed branches, returns at least 1
   */
  async createBranches(
    task: Task,
    agentName: string,
    count: number
  ): Promise<RehearsalBranch[]> {
    const branches: RehearsalBranch[] = [];
    const effectiveCount = Math.min(count, 3);

    for (let i = 1; i <= effectiveCount; i++) {
      try {
        const branch = await this.createSingleBranch(task, agentName, i);
        branches.push(branch);
      } catch (error) {
        console.warn(`Branch ${i} generation failed:`, error instanceof Error ? error.message : String(error));
        // Continue to next branch - we need at least 1 successful branch
      }
    }

    if (branches.length === 0) {
      throw new Error('All branch generation attempts failed');
    }

    return branches;
  }

  private async createSingleBranch(
    task: Task,
    agentName: string,
    approachIndex: number
  ): Promise<RehearsalBranch> {
    const approachPrompt = APPROACH_PROMPTS[approachIndex];
    
    const systemPrompt = `You are an expert software engineer implementing a task.
Your response must be valid JSON matching the specified schema.
Do not include any markdown formatting or explanations outside the JSON.\n
${approachPrompt}`;

    const userPrompt = `Task: ${task.title}
Description: ${task.description}

Generate the implementation with these requirements:
1. Provide a brief description of your approach
2. List all files that need to be created or modified
3. Include both original and proposed content for each file
4. Add notes about your confidence and any trade-offs made

Respond with JSON matching this structure:
{
  "description": "string",
  "files": [
    {
      "path": "string",
      "originalContent": "string",
      "proposedContent": "string"
    }
  ],
  "agentNotes": "string"
}`;

    const response = await callLLM(systemPrompt, userPrompt, agentName);
    
    // Parse and validate the response
    const parsed = this.parseAndValidateResponse(response.content);
    
    return {
      id: this.generateBranchId(agentName, approachIndex),
      description: parsed.description,
      strategy: 'in-memory',
      files: parsed.files,
      createdAt: new Date().toISOString(),
      status: 'pending',
      agentNotes: parsed.agentNotes,
    };
  }

  private parseAndValidateResponse(content: string): BranchOutput {
    // Try to extract JSON from markdown code blocks
    let jsonStr = content;
    
    const codeBlockMatch = content.match(/```(?:json)?\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    // Try to find JSON object if not in code block
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Validate with Zod
    const result = BranchOutputSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Schema validation failed: ${result.error.message}`);
    }

    return result.data;
  }

  /**
   * Clean up non-winner branches
   * Sets status='rejected' and clears files arrays to free memory
   */
  cleanupBranches(branches: RehearsalBranch[], winnerId?: string): void {
    for (const branch of branches) {
      if (branch.id !== winnerId) {
        branch.status = 'rejected';
        branch.files = []; // Clear files to free memory
      }
    }
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let branchManagerInstance: BranchManager | null = null;

export function getBranchManager(): BranchManager {
  if (!branchManagerInstance) {
    branchManagerInstance = new BranchManager();
  }
  return branchManagerInstance;
}

export function resetBranchManager(): void {
  branchManagerInstance = null;
}
