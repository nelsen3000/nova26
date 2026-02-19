// Studio Rules — R19-03 Types

export interface StudioRulesConfig {
  rules: StudioRule[];
  enforcement: 'warn' | 'block' | 'auto-fix';
  ruleSource: string;
  optimizationEnabled: boolean;
  optimizationSchedule: string; // cron
  maxRulesPerCategory: number;
  decayEnabled: boolean;
  tasteVaultInfluence: number;
}

export interface StudioRule {
  id: string;
  name: string;
  description: string;
  category: 'code-style' | 'security' | 'architecture' | 'ux' | 'taste-vault' | 'cinematic' | 'wellbeing';
  condition: string; // rule matching expression
  action: 'require' | 'forbid' | 'prefer' | 'style-guide';
  examples: { good: string; bad: string; explanation: string };
  scope: { agents: string[]; filePatterns: string[]; r16Features: string[] };
  confidence: number;
  source: string;
  decayScore: number;
}

export interface RuleMatch {
  rule: StudioRule;
  matched: boolean;
  location?: { file: string; line: number };
  message: string;
}

export interface RuleEnforcementResult {
  passed: boolean;
  matches: RuleMatch[];
  violations: RuleMatch[];
  autoFixes?: string[];
}

export interface EvaluationContext {
  agent: string;
  filePath: string;
}

export interface EvaluationViolation {
  rule: StudioRule;
  message: string;
  location?: { file: string; line: number };
  effectiveConfidence: number;
}

export interface EvaluationResult {
  passed: boolean;
  violations: EvaluationViolation[];
  checkedRules: string[];
  enforcement: 'warn' | 'block' | 'auto-fix';
  suggestedFixes?: string[];
}
