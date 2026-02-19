import { describe, it, expect } from 'vitest';
import { RuleEngine } from '../rule-engine.js';
import type { StudioRulesConfig, StudioRule } from '../types.js';

describe('Studio Rules Integration', () => {
  describe('multi-agent workflow', () => {
    it('should enforce different rules for different agents', async () => {
      const mercuryRule: StudioRule = {
        id: 'mercury-only',
        name: 'Mercury Rule',
        description: 'Only for Mercury',
        category: 'code-style',
        condition: 'contains:mercury-pattern',  // won't match 'code'
        action: 'require',
        examples: { good: '', bad: '', explanation: '' },
        scope: { agents: ['mercury'], filePatterns: ['*'], r16Features: [] },
        confidence: 1.0,
        source: 'test',
        decayScore: 1.0,
      };

      const venusRule: StudioRule = {
        id: 'venus-only',
        name: 'Venus Rule',
        description: 'Only for Venus',
        category: 'ux',
        condition: 'contains:venus-pattern',  // won't match 'code'
        action: 'require',
        examples: { good: '', bad: '', explanation: '' },
        scope: { agents: ['venus'], filePatterns: ['*'], r16Features: [] },
        confidence: 1.0,
        source: 'test',
        decayScore: 1.0,
      };

      const config: StudioRulesConfig = {
        rules: [mercuryRule, venusRule],
        enforcement: 'warn',
        ruleSource: 'test',
        optimizationEnabled: false,
        optimizationSchedule: '',
        maxRulesPerCategory: 10,
        decayEnabled: false,
        tasteVaultInfluence: 0,
      };

      const engine = new RuleEngine(config);

      const mercuryResult = await engine.evaluate('code', { agent: 'mercury', filePath: 'test.ts' });
      expect(mercuryResult.violations).toHaveLength(1);
      expect(mercuryResult.violations[0].rule.id).toBe('mercury-only');

      const venusResult = await engine.evaluate('code', { agent: 'venus', filePath: 'test.ts' });
      expect(venusResult.violations).toHaveLength(1);
      expect(venusResult.violations[0].rule.id).toBe('venus-only');
    });
  });

  describe('taste vault integration', () => {
    it('should apply taste vault influence to rule priority', () => {
      const tasteRule: StudioRule = {
        id: 'taste-rule',
        name: 'Taste Rule',
        description: 'From taste vault',
        category: 'taste-vault',
        condition: 'true',
        action: 'prefer',
        examples: { good: 'good', bad: 'bad', explanation: 'explanation' },
        scope: { agents: ['*'], filePatterns: ['*'], r16Features: [] },
        confidence: 0.8,
        source: 'taste-vault',
        decayScore: 1.0,
      };

      const config: StudioRulesConfig = {
        rules: [tasteRule],
        enforcement: 'warn',
        ruleSource: 'taste-vault',
        optimizationEnabled: false,
        optimizationSchedule: '',
        maxRulesPerCategory: 10,
        decayEnabled: false,
        tasteVaultInfluence: 0.7,
      };

      const engine = new RuleEngine(config);
      const snapshot = engine.getRulesSnapshot();
      expect(snapshot[0].confidence).toBe(0.8);
    });
  });

  describe('CI/CD integration', () => {
    it('should support CI gate mode', async () => {
      const config: StudioRulesConfig = {
        rules: [{
          id: 'ci-rule',
          name: 'CI Rule',
          description: 'Blocks CI on violation',
          category: 'security',
          condition: 'contains(eval)',
          action: 'forbid',
          examples: { good: '', bad: '', explanation: '' },
          scope: { agents: ['*'], filePatterns: ['*'], r16Features: [] },
          confidence: 1.0,
          source: 'ci',
          decayScore: 1.0,
        }],
        enforcement: 'block',
        ruleSource: 'ci-config',
        optimizationEnabled: false,
        optimizationSchedule: '',
        maxRulesPerCategory: 10,
        decayEnabled: false,
        tasteVaultInfluence: 0,
      };

      const engine = new RuleEngine(config);
      const result = await engine.evaluate('eval("bad")', { agent: 'any', filePath: 'test.ts' });
      expect(result.passed).toBe(false);
      expect(result.enforcement).toBe('block');
    });
  });
});
