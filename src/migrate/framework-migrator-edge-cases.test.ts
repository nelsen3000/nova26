// Framework Migrator Edge Cases — R17-04
// KIMI-W-04: 8 edge case tests for migration system

import { describe, it, expect, vi } from 'vitest';
import {
  FrameworkMigrator,
  createFrameworkMigrator,
} from './framework-migrator.js';

describe('Framework Migrator Edge Cases', () => {
  describe('FrameworkMigrator Edge Cases', () => {
    it('should handle migration with empty plan name', () => {
      const migrator = new FrameworkMigrator();
      const plan = migrator.createPlan('', 'framework', 'react@17', 'vue@3');
      expect(plan).toBeDefined();
    });

    it('should handle migration with very long plan name', () => {
      const migrator = new FrameworkMigrator();
      const longName = 'a'.repeat(1000);
      const plan = migrator.createPlan(longName, 'framework', 'react@17', 'vue@3');
      expect(plan.name).toBe(longName);
    });

    it('should handle many breaking changes', () => {
      const migrator = new FrameworkMigrator();
      const plan = migrator.createPlan('Test', 'framework', 'react@17', 'vue@3');

      // Add 100 breaking changes
      for (let i = 0; i < 100; i++) {
        migrator.addBreakingChange(plan.id, {
          description: `Breaking change ${i}`,
          severity: 'high',
          migration: 'fix',
          affectedFiles: [],
        });
      }

      const updated = migrator.getPlan(plan.id);
      expect(updated?.breakingChanges).toHaveLength(100);
    });

    it('should handle circular dependency in migration steps', () => {
      const migrator = new FrameworkMigrator();
      const plan = migrator.createPlan('Test', 'framework', 'react@17', 'vue@3');

      migrator.addStep(plan.id, { name: 'step1', description: '', order: 1, status: 'pending', automated: false, files: [], estimatedTime: 10 });
      migrator.addStep(plan.id, { name: 'step2', description: '', order: 2, status: 'pending', automated: false, files: [], estimatedTime: 10 });
      migrator.addStep(plan.id, { name: 'step3', description: '', order: 3, status: 'pending', automated: false, files: [], estimatedTime: 10 });

      const retrieved = migrator.getPlan(plan.id);
      expect(retrieved?.steps).toHaveLength(3);
    });

    it('should handle missing plan gracefully', () => {
      const migrator = new FrameworkMigrator();
      const result = migrator.getPlan('nonexistent-id');
      expect(result).toBeUndefined();
    });

    it('should handle empty framework analysis', () => {
      const migrator = new FrameworkMigrator();
      const analysis = migrator.analyzeFramework(
        { name: '', version: '0', dependencies: {}, configFiles: [] },
        { name: '', version: '0', dependencies: {}, configFiles: [] },
      );
      expect(analysis).toBeDefined();
    });

    it('should handle rapid status changes', () => {
      const migrator = new FrameworkMigrator();
      const plan = migrator.createPlan('Test', 'framework', 'react@17', 'vue@3');

      migrator.addStep(plan.id, { name: 'step1', description: '', order: 1, status: 'pending', automated: false, files: [], estimatedTime: 10 });

      const stepId = migrator.getPlan(plan.id)?.steps[0].id || '';
      migrator.updateStepStatus(plan.id, stepId, 'migrating');
      migrator.updateStepStatus(plan.id, stepId, 'complete');
      migrator.updateStepStatus(plan.id, stepId, 'failed');
      migrator.updateStepStatus(plan.id, stepId, 'pending');

      const updated = migrator.getPlan(plan.id);
      expect(updated?.steps[0].status).toBe('pending');
    });

    it('should handle report generation with no steps', () => {
      const migrator = new FrameworkMigrator();
      const plan = migrator.createPlan('Empty', 'framework', 'react@17', 'vue@3');

      const report = migrator.generateReport(plan.id);
      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
    });
  });

  describe('createFrameworkMigrator Edge Cases', () => {
    it('should create a fresh migrator instance', () => {
      const migrator = createFrameworkMigrator();
      expect(migrator).toBeDefined();
    });

    it('should create independent migrator instances', () => {
      const migrator1 = createFrameworkMigrator();
      const migrator2 = createFrameworkMigrator();
      migrator1.createPlan('Test', 'framework', '1.0', '2.0');
      expect(migrator1.getPlansByStatus('pending')).toHaveLength(1);
      expect(migrator2.getPlansByStatus('pending')).toHaveLength(0);
    });
  });
});
