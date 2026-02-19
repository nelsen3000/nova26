// KIMI-ACE-02: AceReflector
// Reflects on task outcomes and suggests playbook updates


import type { Task } from '../types/index.js';
import type { Playbook, PlaybookDelta } from './playbook.js';
import { PlaybookDeltaSchema } from './playbook.js';
import { callLLM } from '../llm/model-router.js';

// ============================================================================
// AceReflector Class
// ============================================================================

export class AceReflector {
  private minConfidence = 0.5;
  private maxDeltas = 5;

  /**
   * Reflect on a task outcome and generate playbook deltas
   */
  async reflectOnOutcome(
    task: Task,
    outcome: { success: boolean; output: string; gateScore?: number },
    playbook: Playbook
  ): Promise<PlaybookDelta[]> {
    // 1. Build reflector prompt
    const prompt = this.buildReflectorPrompt(task, outcome, playbook);

    // 2. Call LLM with cheap model
    const response = await callLLM(prompt, {
      complexity: 'simple',
      model: 'gpt-4o-mini', // Use cheap model for reflection
      temperature: 0.3,
      maxTokens: 2000,
    });

    // 3. Parse and validate LLM response
    const deltas = this.parseDeltas(response);

    // 4. Filter: discard deltas with confidence < 0.5
    const filteredDeltas = deltas.filter(d => d.confidence >= this.minConfidence);

    // 5. Cap at 5 deltas, return top by confidence
    filteredDeltas.sort((a, b) => b.confidence - a.confidence);
    return filteredDeltas.slice(0, this.maxDeltas);
  }

  /**
   * Build the reflector prompt for the LLM
   */
  private buildReflectorPrompt(
    task: Task,
    outcome: { success: boolean; output: string; gateScore?: number },
    playbook: Playbook
  ): string {
    const gateScoreText = outcome.gateScore !== undefined 
      ? `Gate Score: ${outcome.gateScore}/100` 
      : 'Gate Score: N/A';

    const currentRules = playbook.rules
      .map(r => `- [${r.id}] ${r.type}: ${r.content} (confidence: ${r.confidence})`)
      .join('\n') || 'No existing rules';

    return `You are a reflection agent that analyzes task outcomes and suggests updates to an agent's playbook.

Analyze the task execution and suggest playbook updates (new rules, updates to existing rules, or rule removals).

## Task Information
- Title: ${task.title}
- Description: ${task.description}
- Agent: ${task.agent}
- Success: ${outcome.success}
${gateScoreText}

## Task Output
\`\`\`
${outcome.output.substring(0, 2000)}
\`\`\`

## Current Playbook Rules
${currentRules}

## Instructions
Based on the task outcome, suggest playbook updates. For each suggestion:
1. Identify patterns that worked well (increase confidence, helpful++)
2. Identify mistakes or anti-patterns (add Mistake rules, harmful++)
3. Identify outdated rules that should be removed
4. Consider if any rule should be a global candidate (score >= 0.75 confidence)

Respond with a JSON array of playbook deltas:
\`\`\`json
[
  {
    "id": "new-rule-id",
    "ruleId": "existing-rule-id", // Only for update/remove actions
    "action": "add|update|remove",
    "content": "Rule content",
    "type": "Strategy|Mistake|Preference|Pattern|Decision",
    "confidence": 0.85,
    "helpfulDelta": 1,
    "harmfulDelta": 0,
    "isGlobalCandidate": false,
    "reason": "Why this change is needed"
  }
]
\`\`\`

Guidelines:
- Use "add" for new learnings
- Use "update" to adjust confidence or content of existing rules
- Use "remove" for outdated or wrong rules
- Confidence should be 0.0-1.0 based on certainty
- isGlobalCandidate: true only if confidence >= 0.75 and pattern is broadly applicable
- Keep suggestions minimal and high-quality (max 5)

JSON Response:`;
  }

  /**
   * Parse LLM response into PlaybookDelta array
   */
  private parseDeltas(response: string): PlaybookDelta[] {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || 
                        response.match(/```\s*([\s\S]*?)```/) ||
                        response.match(/(\[[\s\S]*\])/);
      
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.trim();
      const parsed = JSON.parse(jsonStr);

      // Validate with Zod
      const result = PlaybookDeltaSchema.array().safeParse(parsed);
      
      if (result.success) {
        // Cast to PlaybookDelta[] since Zod validated the shape
        return result.data as PlaybookDelta[];
      } else {
        console.warn('Invalid delta format from LLM:', result.error);
        return [];
      }
    } catch (error) {
      console.warn('Failed to parse LLM response as deltas:', error);
      return [];
    }
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let reflectorInstance: AceReflector | null = null;

export function getAceReflector(): AceReflector {
  if (!reflectorInstance) {
    reflectorInstance = new AceReflector();
  }
  return reflectorInstance;
}

export function resetAceReflector(): void {
  reflectorInstance = null;
}

export function setAceReflector(reflector: AceReflector): void {
  reflectorInstance = reflector;
}
