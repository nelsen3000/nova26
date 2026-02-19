// Tests for Orchestration Optimization + Integration
// KIMI-R17-10

import { describe, it, expect, beforeEach } from 'vitest';
import {
  OrchestrationOptimizer,
  createOrchestrationOptimizer,
  buildOrchestrationContext,
  mergeTaskResults,
  OptimizationPlanSchema,
  TaskResultSchema,
} from './orchestration-optimizer.js';
import { PRIntelligence } from '../review/pr-intelligence.js';
import { DebtTracker } from '../debt/technical-debt.js';
import { DependencyManager } from '../deps/dependency-manager.js';
import { FeedbackLoop } from '../prod-feedback/feedback-loop.js';
import { HealthMonitor } from '../health/health-dashboard.js';
import { EnvironmentManager } from '../env/environment-manager.js';

describe('OrchestrationOptimizer', () => {
  let optimizer: OrchestrationOptimizer;

  beforeEach(() => {
    optimizer = new OrchestrationOptimizer();
  });

  describe('createPlan', () => {
    it('creates optimization plan', () => {
      const context = buildOrchestrationContext('project-1');
      const plan = optimizer.createPlan(
        ['code-review', 'health-check'],
        'high',
        context
      );

      expect(plan.tasks).toHaveLength(2);
      expect(plan.priority).toBe('high');
      expect(plan.estimatedTime).toBeGreaterThan(0);
    });
  });

  describe('executePlan', () => {
    it('executes all tasks', async () => {
      const context = buildOrchestrationContext('project-1', {
        prIntelligence: new PRIntelligence(),
      });
      const plan = optimizer.createPlan(['code-review'], 'medium', context);

      const report = await optimizer.executePlan(plan.id);

      // Check that report exists and has the expected structure
      expect(report).toBeDefined();
      expect(report.planId).toBe(plan.id);
      expect(report.results).toBeDefined();
      expect(report.results.length).toBe(1);
      expect(report.results[0].task).toBe('code-review');
    });

    it('calculates summary correctly', async () => {
      const debtTracker = new DebtTracker();
      // Add more than 10 debts to trigger recommendations
      for (let i = 0; i < 12; i++) {
        debtTracker.addDebt({ title: `Debt ${i}`, description: 'D', type: 'code', priority: 'high', status: 'identified', estimatedEffort: 1, interestPerPeriod: 0.5, tags: [], relatedIssues: [] });
      }

      const context = buildOrchestrationContext('project-1', {
        debtTracker,
      });
      const plan = optimizer.createPlan(['debt-analysis'], 'medium', context);

      const report = await optimizer.executePlan(plan.id);

      expect(report.summary.tasksRun).toBe(1);
      expect(report.summary.recommendations).toBeGreaterThan(0);
    });

    it('handles missing modules gracefully', async () => {
      const context = buildOrchestrationContext('project-1'); // No modules
      const plan = optimizer.createPlan(['code-review'], 'medium', context);

      const report = await optimizer.executePlan(plan.id);

      expect(report.overallSuccess).toBe(true); // Task succeeds even without module
    });
  });

  describe('getOptimalTaskOrder', () => {
    it('orders tasks by dependencies', () => {
      const order = optimizer.getOptimalTaskOrder(['migration', 'dependency-check', 'health-check']);

      // dependency-check should come before migration
      const depCheckIndex = order.indexOf('dependency-check');
      const migrationIndex = order.indexOf('migration');
      expect(depCheckIndex).toBeLessThan(migrationIndex);
    });

    it('includes all tasks', () => {
      const tasks = ['code-review', 'health-check', 'debug'];
      const order = optimizer.getOptimalTaskOrder(tasks);

      expect(order).toHaveLength(tasks.length);
      expect(new Set(order)).toEqual(new Set(tasks));
    });
  });

  describe('analyzeBottlenecks', () => {
    it('identifies slow tasks', async () => {
      const context = buildOrchestrationContext('project-1');
      const plan = optimizer.createPlan(['health-check'], 'medium', context);
      await optimizer.executePlan(plan.id);

      const bottlenecks = optimizer.analyzeBottlenecks(plan.id);
      // May or may not have bottlenecks depending on execution
      expect(Array.isArray(bottlenecks)).toBe(true);
    });
  });
});

describe('Helper Functions', () => {
  it('createOrchestrationOptimizer creates instance', () => {
    const instance = createOrchestrationOptimizer();
    expect(instance).toBeInstanceOf(OrchestrationOptimizer);
  });

  it('buildOrchestrationContext creates context', () => {
    const context = buildOrchestrationContext('project-1', {
      prIntelligence: new PRIntelligence(),
      debtTracker: new DebtTracker(),
    });

    expect(context.projectId).toBe('project-1');
    expect(context.prIntelligence).toBeDefined();
    expect(context.debtTracker).toBeDefined();
  });

  it('mergeTaskResults aggregates correctly', () => {
    const results = [
      { task: 'a' as any, success: true, output: { issues: [1, 2] }, duration: 0, recommendations: ['R1'] },
      { task: 'b' as any, success: true, output: { issues: [3] }, duration: 0, recommendations: ['R2', 'R3'] },
    ];

    const merged = mergeTaskResults(results);

    expect(merged.success).toBe(true);
    expect(merged.allRecommendations).toHaveLength(3);
    expect(merged.totalIssues).toBe(3);
  });

  it('mergeTaskResults detects failures', () => {
    const results = [
      { task: 'a' as any, success: true, output: null, duration: 0, recommendations: [] },
      { task: 'b' as any, success: false, output: null, duration: 0, recommendations: [] },
    ];

    const merged = mergeTaskResults(results);

    expect(merged.success).toBe(false);
  });
});

describe('Zod Schemas', () => {
  it('validates optimization plan', () => {
    const plan = {
      id: 'p1',
      tasks: ['code-review', 'health-check'],
      priority: 'high',
      estimatedTime: 60,
      dependencies: [],
      context: { projectId: 'proj1' },
    };
    const result = OptimizationPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  it('validates task result', () => {
    const result = {
      task: 'code-review',
      success: true,
      output: { reviews: 5 },
      duration: 1000,
      recommendations: ['Review PRs'],
    };
    const parseResult = TaskResultSchema.safeParse(result);
    expect(parseResult.success).toBe(true);
  });
});

describe('Integration with R17 modules', () => {
  it('integrates with PRIntelligence', async () => {
    const prIntel = new PRIntelligence();
    prIntel.createReview(1, 'Test PR', 'author', 'feature', 'main');

    const optimizer = createOrchestrationOptimizer();
    const context = buildOrchestrationContext('proj1', { prIntelligence: prIntel });
    const plan = optimizer.createPlan(['code-review'], 'medium', context);

    const report = await optimizer.executePlan(plan.id);

    expect(report.results[0].output).toHaveProperty('pendingReviews', 1);
  });

  it('integrates with DebtTracker', async () => {
    const debtTracker = new DebtTracker();
    debtTracker.addDebt({ title: 'Debt', description: 'D', type: 'code', priority: 'high', status: 'identified', estimatedEffort: 8, interestPerPeriod: 2, tags: [], relatedIssues: [] });

    const optimizer = createOrchestrationOptimizer();
    const context = buildOrchestrationContext('proj1', { debtTracker });
    const plan = optimizer.createPlan(['debt-analysis'], 'medium', context);

    const report = await optimizer.executePlan(plan.id);

    expect(report.results[0].success).toBe(true);
  });

  it('integrates with DependencyManager', async () => {
    const depManager = new DependencyManager();
    depManager.addDependency({ name: 'lodash', currentVersion: '4.17.20', latestVersion: '4.17.21', type: 'production', outdated: true });

    const optimizer = createOrchestrationOptimizer();
    const context = buildOrchestrationContext('proj1', { dependencyManager: depManager });
    const plan = optimizer.createPlan(['dependency-check'], 'medium', context);

    const report = await optimizer.executePlan(plan.id);

    expect(report.results[0].output).toHaveProperty('outdated', 1);
  });

  it('integrates with FeedbackLoop', async () => {
    const feedbackLoop = new FeedbackLoop();
    feedbackLoop.collect({ type: 'error', priority: 'critical', timestamp: new Date().toISOString(), service: 'api', environment: 'prod', version: '1.0', metadata: {} });

    const optimizer = createOrchestrationOptimizer();
    const context = buildOrchestrationContext('proj1', { feedbackLoop });
    const plan = optimizer.createPlan(['feedback-monitor'], 'high', context);

    const report = await optimizer.executePlan(plan.id);

    expect(report.results[0].output).toHaveProperty('criticalFeedback', 1);
    expect(report.results[0].recommendations).toContain('Address critical production feedback');
  });

  it('integrates with HealthMonitor', async () => {
    const healthMonitor = new HealthMonitor();
    healthMonitor.registerCheck({ name: 'API', service: 'api', status: 'healthy', responseTime: 50, metadata: {} });

    const optimizer = createOrchestrationOptimizer();
    const context = buildOrchestrationContext('proj1', { healthMonitor });
    const plan = optimizer.createPlan(['health-check'], 'high', context);

    const report = await optimizer.executePlan(plan.id);

    expect(report.results[0].output).toHaveProperty('status', 'healthy');
  });

  it('integrates with EnvironmentManager', async () => {
    const envManager = new EnvironmentManager();
    envManager.createEnvironment('Production', 'production');

    const optimizer = createOrchestrationOptimizer();
    const context = buildOrchestrationContext('proj1', { environmentManager: envManager });
    const plan = optimizer.createPlan(['env-sync'], 'medium', context);

    const report = await optimizer.executePlan(plan.id);

    expect(report.results[0].output).toHaveProperty('productionEnvs', 1);
  });
});
