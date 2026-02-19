// Tests for Migration & Framework Upgrade
// KIMI-R17-02

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FrameworkMigrator,
  createFrameworkMigrator,
  estimateMigrationEffort,
  MigrationPlanSchema,
  MigrationStepSchema,
} from './framework-migrator.js';

describe('FrameworkMigrator', () => {
  let migrator: FrameworkMigrator;

  beforeEach(() => {
    migrator = new FrameworkMigrator();
  });

  describe('createPlan', () => {
    it('creates a migration plan', () => {
      const plan = migrator.createPlan('React 18 Upgrade', 'framework', '17.0.0', '18.0.0');

      expect(plan.name).toBe('React 18 Upgrade');
      expect(plan.type).toBe('framework');
      expect(plan.fromVersion).toBe('17.0.0');
      expect(plan.toVersion).toBe('18.0.0');
      expect(plan.status).toBe('pending');
    });

    it('generates unique IDs', () => {
      const plan1 = migrator.createPlan('Plan 1', 'framework', '1.0', '2.0');
      const plan2 = migrator.createPlan('Plan 2', 'language', '3.0', '4.0');

      expect(plan1.id).not.toBe(plan2.id);
    });
  });

  describe('addStep', () => {
    it('adds step to plan', () => {
      const plan = migrator.createPlan('Test', 'framework', '1.0', '2.0');
      const updated = migrator.addStep(plan.id, {
        name: 'Update dependencies',
        description: 'Update package.json',
        order: 1,
        status: 'pending',
        automated: true,
        files: ['package.json'],
        estimatedTime: 10,
      });

      expect(updated.steps).toHaveLength(1);
      expect(updated.steps[0].name).toBe('Update dependencies');
    });

    it('sorts steps by order', () => {
      const plan = migrator.createPlan('Test', 'framework', '1.0', '2.0');
      migrator.addStep(plan.id, { name: 'Step 2', description: 'D2', order: 2, status: 'pending', automated: true, files: [], estimatedTime: 5 });
      migrator.addStep(plan.id, { name: 'Step 1', description: 'D1', order: 1, status: 'pending', automated: true, files: [], estimatedTime: 5 });

      const updated = migrator.getPlan(plan.id)!;
      expect(updated.steps[0].name).toBe('Step 1');
      expect(updated.steps[1].name).toBe('Step 2');
    });

    it('recalculates effort', () => {
      const plan = migrator.createPlan('Test', 'framework', '1.0', '2.0');
      migrator.addStep(plan.id, { name: 'Step 1', description: 'D1', order: 1, status: 'pending', automated: true, files: [], estimatedTime: 60 });

      const updated = migrator.getPlan(plan.id)!;
      expect(updated.estimatedEffort).toBe(1); // 60 minutes = 1 hour
    });
  });

  describe('addBreakingChange', () => {
    it('adds breaking change', () => {
      const plan = migrator.createPlan('Test', 'framework', '1.0', '2.0');
      const updated = migrator.addBreakingChange(plan.id, {
        description: 'Removed deprecated API',
        severity: 'high',
        migration: 'Use new API instead',
        affectedFiles: ['src/api.ts'],
      });

      expect(updated.breakingChanges).toHaveLength(1);
      expect(updated.breakingChanges[0].severity).toBe('high');
    });

    it('updates risk level for critical changes', () => {
      const plan = migrator.createPlan('Test', 'framework', '1.0', '2.0');
      const updated = migrator.addBreakingChange(plan.id, {
        description: 'Breaking',
        severity: 'critical',
        migration: 'Fix it',
        affectedFiles: [],
      });

      expect(updated.riskLevel).toBe('high');
    });
  });

  describe('executePlan', () => {
    it('executes automated steps', () => {
      const plan = migrator.createPlan('Test', 'framework', '1.0', '2.0');
      migrator.addStep(plan.id, { name: 'Step 1', description: 'D1', order: 1, status: 'pending', automated: true, files: ['file.ts'], estimatedTime: 5 });

      const result = migrator.executePlan(plan.id);

      expect(result.success).toBe(true);
      expect(result.stepsCompleted).toBe(1);
      expect(result.filesModified).toContain('file.ts');
    });

    it('skips non-automated steps', () => {
      const plan = migrator.createPlan('Test', 'framework', '1.0', '2.0');
      migrator.addStep(plan.id, { name: 'Manual', description: 'D1', order: 1, status: 'pending', automated: false, files: [], estimatedTime: 5 });

      const result = migrator.executePlan(plan.id);

      expect(result.stepsCompleted).toBe(0);
    });

    it('updates plan status to complete', () => {
      const plan = migrator.createPlan('Test', 'framework', '1.0', '2.0');
      migrator.addStep(plan.id, { name: 'Step 1', description: 'D1', order: 1, status: 'pending', automated: true, files: [], estimatedTime: 5 });

      migrator.executePlan(plan.id);
      const updated = migrator.getPlan(plan.id)!;

      expect(updated.status).toBe('complete');
      expect(updated.completedAt).toBeDefined();
    });
  });

  describe('analyzeFramework', () => {
    it('detects new dependencies', () => {
      const current = { name: 'app', version: '1.0', dependencies: { a: '1.0' }, configFiles: [] };
      const target = { name: 'app', version: '2.0', dependencies: { a: '1.0', b: '2.0' }, configFiles: [] };

      const analysis = migrator.analyzeFramework(current, target);

      expect(analysis.newDependencies).toContain('b');
    });

    it('detects removed dependencies', () => {
      const current = { name: 'app', version: '1.0', dependencies: { a: '1.0', b: '2.0' }, configFiles: [] };
      const target = { name: 'app', version: '2.0', dependencies: { a: '1.0' }, configFiles: [] };

      const analysis = migrator.analyzeFramework(current, target);

      expect(analysis.removedDependencies).toContain('b');
    });

    it('detects major version change', () => {
      const current = { name: 'app', version: '1.0.0', dependencies: {}, configFiles: [] };
      const target = { name: 'app', version: '2.0.0', dependencies: {}, configFiles: [] };

      const analysis = migrator.analyzeFramework(current, target);

      expect(analysis.breakingChanges.length).toBeGreaterThan(0);
    });
  });

  describe('generateReport', () => {
    it('generates text report', () => {
      const plan = migrator.createPlan('React Upgrade', 'framework', '17.0', '18.0');
      migrator.addBreakingChange(plan.id, { description: 'API change', severity: 'high', migration: 'Update code', affectedFiles: [] });

      const report = migrator.generateReport(plan.id);

      expect(report).toContain('Migration Plan: React Upgrade');
      expect(report).toContain('Breaking Changes: 1');
      expect(report).toContain('[high] API change');
    });
  });

  describe('getPlansByStatus', () => {
    it('filters by status', () => {
      const p1 = migrator.createPlan('Plan 1', 'framework', '1.0', '2.0');
      const p2 = migrator.createPlan('Plan 2', 'framework', '2.0', '3.0');
      migrator.addStep(p1.id, { name: 'Step', description: 'D', order: 1, status: 'pending', automated: true, files: [], estimatedTime: 5 });
      migrator.executePlan(p1.id);

      const complete = migrator.getPlansByStatus('complete');

      expect(complete).toHaveLength(1);
      expect(complete[0].id).toBe(p1.id);
    });
  });
});

describe('Helper Functions', () => {
  it('createFrameworkMigrator creates instance', () => {
    const instance = createFrameworkMigrator();
    expect(instance).toBeInstanceOf(FrameworkMigrator);
  });

  it('estimateMigrationEffort calculates time', () => {
    const automated = estimateMigrationEffort(10, true);
    const manual = estimateMigrationEffort(10, false);

    expect(automated).toBeLessThan(manual);
    expect(manual).toBe(300); // 10 * 30 minutes
  });
});

describe('Zod Schemas', () => {
  it('validates migration step', () => {
    const step = {
      id: 's1',
      name: 'Step 1',
      description: 'Test',
      order: 1,
      status: 'pending',
      automated: true,
      files: [],
      estimatedTime: 10,
    };
    const result = MigrationStepSchema.safeParse(step);
    expect(result.success).toBe(true);
  });

  it('validates migration plan', () => {
    const plan = {
      id: 'p1',
      name: 'Plan',
      type: 'framework',
      fromVersion: '1.0',
      toVersion: '2.0',
      status: 'pending',
      steps: [],
      breakingChanges: [],
      estimatedEffort: 5,
      riskLevel: 'medium',
      createdAt: new Date().toISOString(),
    };
    const result = MigrationPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });
});
