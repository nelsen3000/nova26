// Studio Rules — R19-03
// Public exports

export type {
  StudioRulesConfig,
  StudioRule,
  RuleMatch,
  RuleEnforcementResult,
} from './types.js';

export { RuleEngine, createRuleEngine } from './rule-engine.js';
