// Skill Runner — Executes multi-step skill workflows by orchestrating tool calls
// KIMI-INTEGRATE-02: Grok R11 Skills Framework spec

import { getToolRegistry, type ToolResult } from '../tools/tool-registry.js';
import { getSkillRegistry, type SkillContext } from './skill-registry.js';

// ============================================================================
// Core Types
// ============================================================================

export interface SkillRunResult {
  skillName: string;
  success: boolean;
  stepsCompleted: number;
  totalSteps: number;
  stepResults: Record<string, string>;
  failedStep?: string;
  error?: string;
  durationMs: number;
}

// ============================================================================
// SkillRunner Class
// ============================================================================

class SkillRunner {
  private registry = getSkillRegistry();

  async execute(skillName: string, context: SkillContext): Promise<SkillRunResult> {
    const startTime = Date.now();

    try {
      // Look up skill
      const skill = this.registry.get(skillName);
      if (!skill) {
        return {
          skillName,
          success: false,
          stepsCompleted: 0,
          totalSteps: 0,
          stepResults: {},
          error: 'Skill not found',
          durationMs: 0,
        };
      }

      // Validate required tools
      const toolRegistry = getToolRegistry();
      const missingTools = skill.requiredTools.filter(toolName => !toolRegistry.get(toolName));
      if (missingTools.length > 0) {
        return {
          skillName,
          success: false,
          stepsCompleted: 0,
          totalSteps: skill.steps.length,
          stepResults: {},
          error: `Missing required tools: ${missingTools.join(', ')}`,
          durationMs: Date.now() - startTime,
        };
      }

      // Execute steps
      const stepResults: Record<string, string> = {};
      let stepsCompleted = 0;

      for (const step of skill.steps) {
        // Build args from context
        const args = step.buildArgs({
          ...context,
          stepResults,
        });

        // Execute tool
        const toolResult: ToolResult = await toolRegistry.get(step.tool)!.execute(args);

        // Check for tool failure
        if (!toolResult.success) {
          return {
            skillName,
            success: false,
            stepsCompleted,
            totalSteps: skill.steps.length,
            stepResults,
            failedStep: step.name,
            error: toolResult.error ?? `Tool "${step.tool}" failed`,
            durationMs: Date.now() - startTime,
          };
        }

        // Validate result if validator provided
        if (step.validateResult && !step.validateResult(toolResult.output)) {
          return {
            skillName,
            success: false,
            stepsCompleted,
            totalSteps: skill.steps.length,
            stepResults,
            failedStep: step.name,
            error: `Step "${step.name}" validation failed`,
            durationMs: Date.now() - startTime,
          };
        }

        // Store result
        stepResults[step.name] = toolResult.output;
        stepsCompleted++;

        console.log(`SkillRunner: step "${step.name}" completed (${toolResult.output.length} chars)`);
      }

      return {
        skillName,
        success: true,
        stepsCompleted,
        totalSteps: skill.steps.length,
        stepResults,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`SkillRunner: execution failed for "${skillName}":`, errorMessage);
      return {
        skillName,
        success: false,
        stepsCompleted: 0,
        totalSteps: 0,
        stepResults: {},
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  }

  formatResultForPrompt(result: SkillRunResult): string {
    let output = `Skill: ${result.skillName} (${result.stepsCompleted}/${result.totalSteps} steps)\n`;

    if (result.success) {
      for (const [stepName, stepResult] of Object.entries(result.stepResults)) {
        const truncated = stepResult.slice(0, 200);
        output += `${stepName}: ${truncated}${stepResult.length > 200 ? '...' : ''}\n`;
      }
    } else {
      output += `Failed at step "${result.failedStep}": ${result.error ?? 'Unknown error'}`;
    }

    // Truncate to 1000 chars max
    if (output.length > 1000) {
      output = output.slice(0, 997) + '...';
    }

    return output;
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let instance: SkillRunner | null = null;

export function getSkillRunner(): SkillRunner {
  if (!instance) {
    instance = new SkillRunner();
  }
  return instance;
}

export function resetSkillRunner(): void {
  instance = null;
}

export { SkillRunner };
