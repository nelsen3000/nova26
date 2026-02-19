// R17 Full Integration Test Suite
// Validates all 10 modules work together correctly

import { describe, it, expect, beforeAll } from 'vitest';

// Import all R17 modules
import { PRIntelligence, createPRIntelligence } from '../review/index.js';
import { FrameworkMigrator, createFrameworkMigrator } from '../migrate/index.js';
import { RootCauseAnalyzer, createRootCauseAnalyzer } from '../debug/index.js';
import { WCAGEngine, createWCAGEngine } from '../a11y/index.js';
import { DebtTracker, createDebtTracker } from '../debt/index.js';
import { DependencyManager, createDependencyManager } from '../deps/index.js';
import { FeedbackLoop, createFeedbackLoop } from '../prod-feedback/index.js';
import { HealthMonitor, createHealthMonitor } from '../health/index.js';
import { EnvironmentManager, createEnvironmentManager } from '../env/index.js';
import { OrchestrationOptimizer, buildOrchestrationContext } from './orchestration-optimizer.js';

describe('R17 Full Stack Integration', () => {
  let context: ReturnType<typeof buildOrchestrationContext>;
  
  beforeAll(() => {
    context = buildOrchestrationContext('integration-test', {
      prIntelligence: createPRIntelligence(),
      frameworkMigrator: createFrameworkMigrator(),
      rootCauseAnalyzer: createRootCauseAnalyzer(),
      wcagEngine: createWCAGEngine(),
      debtTracker: createDebtTracker(),
      dependencyManager: createDependencyManager(),
      feedbackLoop: createFeedbackLoop(),
      healthMonitor: createHealthMonitor(),
      environmentManager: createEnvironmentManager(),
    });
  });

  it('all modules are instantiable', () => {
    expect(context.prIntelligence).toBeInstanceOf(PRIntelligence);
    expect(context.frameworkMigrator).toBeInstanceOf(FrameworkMigrator);
    expect(context.rootCauseAnalyzer).toBeInstanceOf(RootCauseAnalyzer);
    expect(context.wcagEngine).toBeInstanceOf(WCAGEngine);
    expect(context.debtTracker).toBeInstanceOf(DebtTracker);
    expect(context.dependencyManager).toBeInstanceOf(DependencyManager);
    expect(context.feedbackLoop).toBeInstanceOf(FeedbackLoop);
    expect(context.healthMonitor).toBeInstanceOf(HealthMonitor);
    expect(context.environmentManager).toBeInstanceOf(EnvironmentManager);
  });

  it('orchestrator can execute with all modules', async () => {
    const optimizer = new OrchestrationOptimizer();
    const plan = optimizer.createPlan([
      'code-review',
      'debt-analysis',
      'dependency-check',
      'health-check',
    ], 'high', context);

    const report = await optimizer.executePlan(plan.id);

    expect(report.overallSuccess).toBe(true);
    expect(report.results).toHaveLength(4);
  });

  it('cross-module data flow works', async () => {
    // 1. Add debt
    context.debtTracker!.addDebt({
      title: 'Security Issue',
      description: 'Vulnerable dependency',
      type: 'dependency',
      priority: 'critical',
      status: 'identified',
      estimatedEffort: 4,
      interestPerPeriod: 1,
      tags: ['security'],
      relatedIssues: [],
    });

    // 2. Add vulnerable dependency
    context.dependencyManager!.addDependency({
      name: 'vuln-package',
      currentVersion: '1.0.0',
      latestVersion: '2.0.0',
      type: 'production',
      outdated: true,
    });
    context.dependencyManager!.addVulnerability({
      id: 'CVE-2024-1234',
      packageName: 'vuln-package',
      severity: 'critical',
      range: '<2.0.0',
      title: 'Critical vulnerability',
      description: 'Remote code execution',
      fixAvailable: true,
    });

    // 3. Run orchestration
    const optimizer = new OrchestrationOptimizer();
    const plan = optimizer.createPlan(['debt-analysis', 'dependency-check'], 'critical', context);
    const report = await optimizer.executePlan(plan.id);

    // 4. Verify both modules executed and provided recommendations
    expect(report.summary.recommendations).toBeGreaterThan(0);
    expect(report.results[0].output).toBeDefined();
    expect(report.results[1].output).toBeDefined();
  });
});
