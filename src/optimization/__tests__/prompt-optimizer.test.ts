import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptOptimizer, createPromptOptimizer } from '../prompt-optimizer.js';
import type { OptimizationObjective, OptimizeResult } from '../types.js';

describe('PromptOptimizer', () => {
  const mockObjective: OptimizationObjective = {
    agentTemplateId: 'test-agent',
    goldenSet: [
      { input: 'test1', expectedOutput: 'output1', weight: 1.0 },
      { input: 'test2', expectedOutput: 'output2', weight: 0.5 },
    ],
    scorers: [
      { name: 'accuracy', fn: () => 0.8 },
      { name: 'conciseness', fn: () => 0.7 },
    ],
    weights: [0.6, 0.4],
  };

  describe('createPromptOptimizer', () => {
    it('should create a PromptOptimizer instance', () => {
      const optimizer = createPromptOptimizer({ maxIterations: 50 });
      expect(optimizer).toBeInstanceOf(PromptOptimizer);
    });
  });

  describe('optimize', () => {
    it('should return optimized result', async () => {
      const optimizer = new PromptOptimizer({ maxIterations: 10 });
      const template = 'You are a helpful assistant.';
      
      const result = await optimizer.optimize(template, mockObjective, 'bayesian');
      
      expect(result).toHaveProperty('optimizedSystemPrompt');
      expect(result).toHaveProperty('optimizedFewShot');
      expect(result).toHaveProperty('improvementPercent');
      expect(result).toHaveProperty('trace');
      expect(result.optimizedSystemPrompt).toContain('helpful');
    });

    it('should include few-shot examples', async () => {
      const optimizer = new PromptOptimizer({ maxIterations: 5 });
      const template = 'Base template';
      
      const result = await optimizer.optimize(template, mockObjective, 'hill-climbing');
      
      expect(Array.isArray(result.optimizedFewShot)).toBe(true);
      expect(result.optimizedFewShot.length).toBeGreaterThan(0);
      expect(result.optimizedFewShot[0]).toHaveProperty('input');
      expect(result.optimizedFewShot[0]).toHaveProperty('output');
    });

    it('should track optimization trace', async () => {
      const optimizer = new PromptOptimizer({ maxIterations: 5 });
      const template = 'Template';
      
      const result = await optimizer.optimize(template, mockObjective, 'genetic');
      
      expect(Array.isArray(result.trace)).toBe(true);
      expect(result.trace.length).toBeGreaterThan(0);
      expect(result.trace[0]).toHaveProperty('iteration');
      expect(result.trace[0]).toHaveProperty('score');
      expect(result.trace[0]).toHaveProperty('mutation');
    });

    it('should calculate improvement percentage', async () => {
      const optimizer = new PromptOptimizer({ maxIterations: 5 });
      const template = 'Template';
      
      const result = await optimizer.optimize(template, mockObjective, 'bayesian');
      
      expect(typeof result.improvementPercent).toBe('number');
    });
  });

  describe('evaluateGoldenSet', () => {
    it('should evaluate against golden set', async () => {
      const optimizer = new PromptOptimizer({ maxIterations: 5 });
      const prompt = 'Test prompt';
      
      const score = await optimizer.evaluateGoldenSet(prompt, mockObjective);
      
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('detectRegression', () => {
    it('should detect significant regression', () => {
      const optimizer = new PromptOptimizer({ maxIterations: 10 });
      const baseline: OptimizeResult = {
        optimizedSystemPrompt: 'baseline',
        optimizedFewShot: [],
        improvementPercent: 10,
        trace: [],
      };
      
      const candidate: OptimizeResult = {
        optimizedSystemPrompt: 'candidate',
        optimizedFewShot: [],
        improvementPercent: -10,
        trace: [],
      };
      
      const hasRegression = optimizer.detectRegression(baseline, candidate, 5);
      expect(hasRegression).toBe(true);
    });

    it('should not flag minor changes as regression', () => {
      const optimizer = new PromptOptimizer({ maxIterations: 10 });
      const baseline: OptimizeResult = {
        optimizedSystemPrompt: 'baseline',
        optimizedFewShot: [],
        improvementPercent: 10,
        trace: [],
      };
      
      const candidate: OptimizeResult = {
        optimizedSystemPrompt: 'candidate',
        optimizedFewShot: [],
        improvementPercent: 8,
        trace: [],
      };
      
      const hasRegression = optimizer.detectRegression(baseline, candidate, 5);
      expect(hasRegression).toBe(false);
    });
  });

  describe('optimization strategies', () => {
    const strategies = ['bayesian', 'genetic', 'hill-climbing'];
    
    strategies.forEach(strategy => {
      it(`should support ${strategy} strategy`, async () => {
        const optimizer = new PromptOptimizer({ maxIterations: 5 });
        const template = 'Test template';
        
        const result = await optimizer.optimize(template, mockObjective, strategy);
        
        expect(result.optimizedSystemPrompt).toBeTruthy();
        expect(result.trace.length).toBeGreaterThan(0);
      });
    });
  });

  describe('configuration', () => {
    it('should respect maxIterations', async () => {
      const optimizer = new PromptOptimizer({ maxIterations: 3 });
      const template = 'Template';
      
      const result = await optimizer.optimize(template, mockObjective, 'hill-climbing');
      
      expect(result.trace.length).toBeLessThanOrEqual(3);
    });

    it('should use default convergence threshold', async () => {
      const optimizer = new PromptOptimizer({});
      expect(optimizer).toBeDefined();
    });
  });
});
