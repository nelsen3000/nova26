// Rule Engine — R19-03
// Enforcement + agent prompt injection

import type { StudioRule, StudioRulesConfig, RuleMatch, RuleEnforcementResult, EvaluationContext, EvaluationResult, EvaluationViolation } from './types.js';

export class RuleEngine {
  private config: StudioRulesConfig;
  private ruleCache: Map<string, StudioRule> = new Map();

  constructor(config: StudioRulesConfig) {
    this.config = config;
    for (const rule of config.rules) {
      this.ruleCache.set(rule.id, rule);
    }
  }

  matchRules(
    code: string,
    filePath: string,
    agentName: string
  ): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const rule of this.config.rules) {
      // Check scope
      if (!this.isInScope(rule, filePath, agentName)) {
        continue;
      }

      // Evaluate condition (simplified)
      const matched = this.evaluateCondition(rule.condition, code);

      matches.push({
        rule,
        matched,
        location: matched ? { file: filePath, line: 1 } : undefined,
        message: matched
          ? `Rule "${rule.name}" matched`
          : `Rule "${rule.name}" did not match`,
      });
    }

    return matches;
  }

  enforce(
    code: string,
    filePath: string,
    agentName: string
  ): RuleEnforcementResult {
    const matches = this.matchRules(code, filePath, agentName);
    const violations = matches.filter(m => 
      (m.rule.action === 'forbid' && m.matched) ||
      (m.rule.action === 'require' && !m.matched)
    );

    const passed = violations.length === 0;

    return {
      passed,
      matches,
      violations,
      autoFixes: this.config.enforcement === 'auto-fix'
        ? this.generateAutoFixes(violations, code)
        : undefined,
    };
  }

  injectIntoPrompt(systemPrompt: string, agentName: string): string {
    const applicableRules = this.config.rules.filter(r =>
      r.scope.agents.includes(agentName) || r.scope.agents.includes('*')
    );

    if (applicableRules.length === 0) {
      return systemPrompt;
    }

    const rulesSection = `
## Studio Rules

The following rules must be followed:

${applicableRules.map(r => `- **${r.name}**: ${r.description}`).join('\n')}

### Examples

${applicableRules.slice(0, 3).map(r => `
**${r.name}:**
- Good: ${r.examples.good}
- Bad: ${r.examples.bad}
`).join('\n')}
`;

    return `${systemPrompt}\n\n${rulesSection}`;
  }

  addRule(rule: StudioRule): void {
    this.config.rules.push(rule);
    this.ruleCache.set(rule.id, rule);
  }

  removeRule(ruleId: string): boolean {
    const index = this.config.rules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
      this.config.rules.splice(index, 1);
      this.ruleCache.delete(ruleId);
      return true;
    }
    return false;
  }

  getRulesByCategory(category: StudioRule['category']): StudioRule[] {
    return this.config.rules.filter(r => r.category === category);
  }

  getRulesByAgent(agentName: string): StudioRule[] {
    return this.config.rules.filter(r =>
      r.scope.agents.includes(agentName) || r.scope.agents.includes('*')
    );
  }

  async evaluate(code: string, context: EvaluationContext): Promise<EvaluationResult> {
    const matches = this.matchRules(code, context.filePath, context.agent);
    const violations: EvaluationViolation[] = matches
      .filter(m => (m.rule.action === 'forbid' && m.matched) || (m.rule.action === 'require' && !m.matched))
      .map(m => ({
        rule: m.rule,
        message: m.message,
        location: m.location,
        effectiveConfidence: m.rule.confidence * (this.config.decayEnabled ? m.rule.decayScore : 1),
      }));

    const passed = violations.length === 0;

    return {
      passed,
      violations,
      checkedRules: matches.map(m => m.rule.id),
      enforcement: this.config.enforcement,
      suggestedFixes: this.config.enforcement === 'auto-fix' 
        ? this.generateAutoFixes(matches.filter(m => violations.some(v => v.rule.id === m.rule.id)), code)
        : undefined,
    };
  }

  getRulesSnapshot(filter?: { category?: StudioRule['category']; agent?: string }): StudioRule[] {
    let rules = this.config.rules;
    if (filter?.category) {
      rules = rules.filter(r => r.category === filter.category);
    }
    if (filter?.agent) {
      rules = rules.filter(r => r.scope.agents.includes(filter.agent!) || r.scope.agents.includes('*'));
    }
    return rules;
  }

  private isInScope(rule: StudioRule, filePath: string, agentName: string): boolean {
    // Check agent scope
    if (!rule.scope.agents.includes(agentName) && !rule.scope.agents.includes('*')) {
      return false;
    }

    // Check file pattern scope
    if (rule.scope.filePatterns.length > 0) {
      const matchesPattern = rule.scope.filePatterns.some(pattern =>
        filePath.includes(pattern.replace('*', ''))
      );
      if (!matchesPattern) return false;
    }

    return true;
  }

  private evaluateCondition(condition: string, code: string): boolean {
    // Simplified condition evaluation
    // In real implementation, use a proper expression parser
    if (condition.startsWith('contains:') || condition.startsWith('contains(')) {
      const keyword = condition.includes(':') 
        ? condition.split(':')[1]?.trim()
        : condition.replace('contains(', '').replace(')', '').trim();
      return code.includes(keyword);
    }
    if (condition.startsWith('max-length:')) {
      const maxLen = parseInt(condition.split(':')[1]);
      return code.length <= maxLen;
    }
    if (condition.startsWith('min-coverage:')) {
      // Would need coverage data
      return true;
    }
    if (condition === 'true') {
      return true;
    }
    return false;
  }

  private generateAutoFixes(violations: RuleMatch[], _code: string): string[] {
    return violations.map(v => 
      `Fix: ${v.rule.name} - ${v.rule.examples.good}`
    );
  }
}

export function createRuleEngine(config: StudioRulesConfig): RuleEngine {
  return new RuleEngine(config);
}
