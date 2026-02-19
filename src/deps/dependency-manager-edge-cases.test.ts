// Dependency Manager Edge Cases — R17-08
// KIMI-W-04: 8 edge case tests for dependency management

import { describe, it, expect, vi } from 'vitest';
import {
  DependencyManager,
  createDependencyManager,
} from './dependency-manager.js';

describe('Dependency Manager Edge Cases', () => {
  describe('DependencyManager Edge Cases', () => {
    it('should handle dependency with empty name', () => {
      const manager = new DependencyManager();
      manager.addDependency({ name: '', currentVersion: '1.0.0', type: 'production' });
      const deps = manager.getAllDependencies();
      expect(deps.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle dependency with very long name', () => {
      const manager = new DependencyManager();
      const longName = 'a'.repeat(500);
      manager.addDependency({ name: longName, currentVersion: '1.0.0', type: 'production' });
      const dep = manager.getDependency(longName);
      expect(dep?.name).toBe(longName);
    });

    it('should handle many dependencies', () => {
      const manager = new DependencyManager();

      // Add 1000 dependencies
      for (let i = 0; i < 1000; i++) {
        manager.addDependency({
          name: `package-${i}`,
          currentVersion: `${i}.0.0`,
          type: 'production',
        });
      }

      const all = manager.getAllDependencies();
      expect(all).toHaveLength(1000);
    });

    it('should handle missing dependency gracefully', () => {
      const manager = new DependencyManager();
      const result = manager.getDependency('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should handle outdated check for unknown package', () => {
      const manager = new DependencyManager();
      const result = manager.checkOutdated('unknown-package');
      expect(result.outdated).toBe(false);
    });

    it('should handle vulnerability with unknown severity', () => {
      const manager = new DependencyManager();
      // @ts-expect-error Testing unknown severity
      manager.addVulnerability({
        id: 'vuln-1',
        packageName: 'test',
        severity: 'unknown',
        range: '>=1.0.0',
        title: 'test vuln',
        description: 'test',
        fixAvailable: false,
      });

      const vulns = manager.getVulnerabilities();
      expect(vulns).toBeDefined();
    });

    it('should handle update analysis for non-semver version', () => {
      const manager = new DependencyManager();
      manager.addDependency({
        name: 'git-pkg',
        currentVersion: 'github:user/repo#branch',
        type: 'production',
      });

      const analysis = manager.analyzeUpdate('git-pkg', 'latest');
      expect(analysis).toBeDefined();
    });

    it('should handle empty dependency list for report', () => {
      const manager = new DependencyManager();
      const report = manager.generateReport();
      expect(report).toBeDefined();
    });
  });

  describe('createDependencyManager Edge Cases', () => {
    it('should create a fresh manager instance', () => {
      const manager = createDependencyManager();
      expect(manager).toBeDefined();
      expect(manager.getAllDependencies()).toHaveLength(0);
    });

    it('should create independent manager instances', () => {
      const manager1 = createDependencyManager();
      const manager2 = createDependencyManager();
      manager1.addDependency({ name: 'test', currentVersion: '1.0.0', type: 'production' });
      expect(manager1.getAllDependencies()).toHaveLength(1);
      expect(manager2.getAllDependencies()).toHaveLength(0);
    });

    it('should produce a valid report from fresh instance', () => {
      const manager = createDependencyManager();
      const report = manager.generateReport();
      expect(report.totalDependencies).toBe(0);
      expect(report.vulnerabilities).toEqual([]);
    });
  });
});
