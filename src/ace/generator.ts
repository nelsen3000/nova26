// KIMI-ACE-02: AceGenerator
// Generates playbook context for agents based on task and available rules

import type { Task } from '../types/index.js';
import { getPlaybookManager, type PlaybookRule } from './playbook.js';

// ============================================================================
// AceGenerator Class
// ============================================================================

export class AceGenerator {
  /**
   * Analyze a task and generate playbook context for the agent
   */
  async analyzeTask(
    task: Task,
    agentName: string,
    tokenBudget: number
  ): Promise<{ playbookContext: string; appliedRuleIds: string[] }> {
    // 1. Get active rules from playbook manager
    const rules = getPlaybookManager().getActiveRules(
      agentName,
      task.description,
      10
    );

    // 2. Format rules into XML block
    let playbookContext = this.formatPlaybookContext(rules, agentName);

    // 3. Enforce token budget
    const estimatedTokens = Math.ceil(playbookContext.length / 4);
    if (estimatedTokens > tokenBudget) {
      playbookContext = this.trimToBudget(playbookContext, rules, agentName, tokenBudget);
    }

    // 4. Track applied rule IDs
    const appliedRuleIds = rules.map(r => r.id);
    for (const ruleId of appliedRuleIds) {
      getPlaybookManager().incrementApplied(ruleId);
    }

    // 5. Return result
    return { playbookContext, appliedRuleIds };
  }

  /**
   * Format rules into <playbook_context> XML block
   */
  private formatPlaybookContext(rules: PlaybookRule[], agentName: string): string {
    const version = Date.now(); // Use timestamp as version
    const rulesApplied = rules.length;

    let xml = `<playbook_context agent="${agentName}" version="${version}" rules_applied="${rulesApplied}">\n`;
    
    for (const rule of rules) {
      xml += `- [${rule.type}, confidence: ${rule.confidence.toFixed(2)}] ${rule.content}\n`;
    }
    
    xml += '</playbook_context>';
    
    return xml;
  }

  /**
   * Trim playbook context to fit within token budget
   * Removes rules from the bottom until within budget
   */
  private trimToBudget(
    context: string,
    rules: PlaybookRule[],
    agentName: string,
    tokenBudget: number
  ): string {
    const maxChars = tokenBudget * 4;
    
    if (context.length <= maxChars) {
      return context;
    }

    // Keep removing rules from the bottom until we fit
    let trimmedRules = [...rules];
    while (trimmedRules.length > 0) {
      trimmedRules.pop();
      const trimmedContext = this.formatPlaybookContext(trimmedRules, agentName);
      if (trimmedContext.length <= maxChars) {
        return trimmedContext;
      }
    }

    // If even empty context is too big, return minimal context
    return '<playbook_context rules_applied="0"></playbook_context>';
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let generatorInstance: AceGenerator | null = null;

export function getAceGenerator(): AceGenerator {
  if (!generatorInstance) {
    generatorInstance = new AceGenerator();
  }
  return generatorInstance;
}

export function resetAceGenerator(): void {
  generatorInstance = null;
}

export function setAceGenerator(generator: AceGenerator): void {
  generatorInstance = generator;
}
