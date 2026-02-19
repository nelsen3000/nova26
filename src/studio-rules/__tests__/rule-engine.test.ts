import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RuleEngine, createRuleEngine } from '../rule-engine.js';
import type { StudioRulesConfig, StudioRule } from '../types.js';

describe('RuleEngine', () => {
  const mockConfig: StudioRulesConfig = {
    rules: [],
    enforcement: 'warn',
    ruleSource: 'test',
    optimizationEnabled: true,
    optimizationSchedule: '0 0 * * *',
    maxRulesPerCategory: 10,
    decayEnabled: true,
    tasteVaultInfluence: 0.5,
  };

  const mockRule: StudioRule = {
    id: 'test-rule-1',
    name: 'No Console Log',
    description: 'Disallow console.log statements',
    category: 'code-style',
    condition: 'contains(console.log)',
    action: 'forbid',
    examples: {
      good: 'logger.info("message")',
      bad: 'console.log("message")',
      explanation: 'Use logger instead of console.log',
    },
    scope: {
      agents: ['mercury'],
      filePatterns: ['*.ts'],
      r16Features: ['review'],
    },
    confidence: 0.9,
    source: 'test',
    decayScore: 1.0,
  };

  describe('createRuleEngine', () => {
    it('should create a RuleEngine instance', () => {
      const engine = createRuleEngine(mockConfig);
      expect(engine).toBeInstanceOf(RuleEngine);
    });
  });

  describe('evaluate', () => {
    it('should return no violations for empty ruleset', async () => {
      const engine = createRuleEngine(mockConfig);
      const result = await engine.evaluate('const x = 1;', { agent: 'mercury', filePath: 'test.ts' });
      expect(result.violations).toHaveLength(0);
      expect(result.passed).toBe(true);
    });

    it('should detect console.log violations', async () => {
      const configWithRule = { ...mockConfig, rules: [mockRule] };
      const engine = createRuleEngine(configWithRule);
      const result = await engine.evaluate('console.log("hello")', { agent: 'mercury', filePath: 'test.ts' });
      expect(result.violations).toHaveLength(1);
      expect(result.passed).toBe(false);
      expect(result.violations[0].rule.id).toBe('test-rule-1');
    });

    it('should respect file pattern scope', async () => {
      const configWithRule = { ...mockConfig, rules: [mockRule] };
      const engine = createRuleEngine(configWithRule);
      const result = await engine.evaluate('console.log("hello")', { agent: 'mercury', filePath: 'test.py' });
      expect(result.violations).toHaveLength(0);
      expect(result.passed).toBe(true);
    });

    it('should respect agent scope', async () => {
      const configWithRule = { ...mockConfig, rules: [mockRule] };
      const engine = createRuleEngine(configWithRule);
      const result = await engine.evaluate('console.log("hello")', { agent: 'venus', filePath: 'test.ts' });
      expect(result.violations).toHaveLength(0);
      expect(result.passed).toBe(true);
    });

    it('should apply decay to rule confidence', async () => {
      const decayedRule = { ...mockRule, decayScore: 0.5 };
      const configWithRule = { ...mockConfig, rules: [decayedRule], decayEnabled: true };
      const engine = createRuleEngine(configWithRule);
      const result = await engine.evaluate('console.log("hello")', { agent: 'mercury', filePath: 'test.ts' });
      expect(result.violations[0].effectiveConfidence).toBe(0.45); // 0.9 * 0.5
    });

    it('should track which rules were checked', async () => {
      const configWithRule = { ...mockConfig, rules: [mockRule] };
      const engine = createRuleEngine(configWithRule);
      const result = await engine.evaluate('const x = 1;', { agent: 'mercury', filePath: 'test.ts' });
      expect(result.checkedRules).toHaveLength(1);
      expect(result.checkedRules[0]).toBe('test-rule-1');
    });
  });

  describe('getRulesSnapshot', () => {
    it('should return rules filtered by category', () => {
      const securityRule = { ...mockRule, id: 'sec-1', category: 'security' };
      const configWithRules = { ...mockConfig, rules: [mockRule, securityRule] };
      const engine = createRuleEngine(configWithRules);
      const snapshot = engine.getRulesSnapshot({ category: 'security' });
      expect(snapshot).toHaveLength(1);
      expect(snapshot[0].id).toBe('sec-1');
    });

    it('should return all rules when no filter', () => {
      const configWithRules = { ...mockConfig, rules: [mockRule] };
      const engine = createRuleEngine(configWithRules);
      const snapshot = engine.getRulesSnapshot();
      expect(snapshot).toHaveLength(1);
    });
  });

  describe('injectIntoPrompt', () => {
    it('should inject applicable rules into system prompt', () => {
      const configWithRule = { ...mockConfig, rules: [mockRule] };
      const engine = createRuleEngine(configWithRule);
      const injected = engine.injectIntoPrompt('base prompt', 'mercury');
      expect(injected).toContain('No Console Log');
      expect(injected).toContain('base prompt');
    });

    it('should not include rules for different agents', () => {
      const configWithRule = { ...mockConfig, rules: [mockRule] };
      const engine = createRuleEngine(configWithRule);
      const injected = engine.injectIntoPrompt('base prompt', 'venus');
      expect(injected).not.toContain('No Console Log');
    });
  });

  describe('rule categories', () => {
    const categories: StudioRule['category'][] = ['code-style', 'security', 'architecture', 'ux', 'taste-vault', 'cinematic', 'wellbeing'];
    
    categories.forEach(category => {
      it(`should support ${category} rules`, async () => {
        const rule = { ...mockRule, id: `${category}-1`, category };
        const config = { ...mockConfig, rules: [rule] };
        const engine = createRuleEngine(config);
        const snapshot = engine.getRulesSnapshot({ category });
        expect(snapshot[0].category).toBe(category);
      });
    });
  });

  describe('enforcement modes', () => {
    it('should support warn enforcement', async () => {
      const config = { ...mockConfig, rules: [mockRule], enforcement: 'warn' as const };
      const engine = createRuleEngine(config);
      const result = await engine.evaluate('console.log("test")', { agent: 'mercury', filePath: 'test.ts' });
      expect(result.enforcement).toBe('warn');
    });

    it('should support block enforcement', async () => {
      const config = { ...mockConfig, rules: [mockRule], enforcement: 'block' as const };
      const engine = createRuleEngine(config);
      const result = await engine.evaluate('console.log("test")', { agent: 'mercury', filePath: 'test.ts' });
      expect(result.enforcement).toBe('block');
    });

    it('should support auto-fix enforcement', async () => {
      // Use forbid action - code contains 'console.log' which triggers the violation
      const config = { ...mockConfig, rules: [mockRule], enforcement: 'auto-fix' as const };
      const engine = createRuleEngine(config);
      // This code contains 'console.log' which triggers the forbid violation
      const result = await engine.evaluate('console.log("test")', { agent: 'mercury', filePath: 'test.ts' });
      expect(result.enforcement).toBe('auto-fix');
      expect(result.suggestedFixes).toBeDefined();
      expect(result.suggestedFixes!.length).toBeGreaterThan(0);
    });
  });
});
