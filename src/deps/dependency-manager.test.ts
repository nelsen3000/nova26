// Tests for Dependency Management
// KIMI-R17-06

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DependencyManager,
  createDependencyManager,
  compareVersions,
  satisfiesRange,
  DependencySchema,
  VulnerabilitySchema,
} from './dependency-manager.js';

describe('DependencyManager', () => {
  let manager: DependencyManager;

  beforeEach(() => {
    manager = new DependencyManager();
  });

  describe('addDependency', () => {
    it('adds dependency', () => {
      manager.addDependency({
        name: 'lodash',
        currentVersion: '4.17.20',
        latestVersion: '4.17.21',
        type: 'production',
        outdated: true,
      });

      const dep = manager.getDependency('lodash');
      expect(dep).toBeDefined();
      expect(dep?.currentVersion).toBe('4.17.20');
    });
  });

  describe('getOutdatedDependencies', () => {
    it('returns only outdated', () => {
      manager.addDependency({ name: 'old', currentVersion: '1.0', latestVersion: '2.0', type: 'production', outdated: true });
      manager.addDependency({ name: 'current', currentVersion: '2.0', latestVersion: '2.0', type: 'production', outdated: false });

      const outdated = manager.getOutdatedDependencies();

      expect(outdated).toHaveLength(1);
      expect(outdated[0].name).toBe('old');
    });
  });

  describe('getDeprecatedDependencies', () => {
    it('returns deprecated', () => {
      manager.addDependency({ name: 'good', currentVersion: '1.0', type: 'production' });
      manager.addDependency({ name: 'bad', currentVersion: '1.0', type: 'production', deprecated: true });

      const deprecated = manager.getDeprecatedDependencies();

      expect(deprecated).toHaveLength(1);
      expect(deprecated[0].name).toBe('bad');
    });
  });

  describe('addVulnerability', () => {
    it('adds vulnerability', () => {
      manager.addVulnerability({
        id: 'VULN-1',
        packageName: 'lodash',
        severity: 'high',
        range: '<4.17.21',
        title: 'Prototype Pollution',
        description: 'Security issue',
        fixAvailable: true,
        fixedIn: '4.17.21',
      });

      const vulns = manager.getVulnerabilities();
      expect(vulns).toHaveLength(1);
    });

    it('filters by severity', () => {
      manager.addVulnerability({ id: 'V1', packageName: 'a', severity: 'critical', range: '*', title: 'T', description: 'D', fixAvailable: false });
      manager.addVulnerability({ id: 'V2', packageName: 'b', severity: 'low', range: '*', title: 'T', description: 'D', fixAvailable: false });

      const critical = manager.getVulnerabilities('critical');

      expect(critical).toHaveLength(1);
      expect(critical[0].id).toBe('V1');
    });
  });

  describe('analyzeUpdate', () => {
    it('detects major update', () => {
      manager.addDependency({ name: 'pkg', currentVersion: '1.0.0', type: 'production' });

      const plan = manager.analyzeUpdate('pkg', '2.0.0');

      expect(plan.updateType).toBe('major');
      expect(plan.breaking).toBe(true);
      expect(plan.estimatedRisk).toBe('high');
    });

    it('detects minor update', () => {
      manager.addDependency({ name: 'pkg', currentVersion: '1.0.0', type: 'production' });

      const plan = manager.analyzeUpdate('pkg', '1.1.0');

      expect(plan.updateType).toBe('minor');
      expect(plan.breaking).toBe(false);
    });

    it('detects patch update', () => {
      manager.addDependency({ name: 'pkg', currentVersion: '1.0.0', type: 'production' });

      const plan = manager.analyzeUpdate('pkg', '1.0.1');

      expect(plan.updateType).toBe('patch');
      expect(plan.breaking).toBe(false);
      expect(plan.estimatedRisk).toBe('low');
    });
  });

  describe('generateReport', () => {
    it('generates report', () => {
      manager.addDependency({ name: 'lodash', currentVersion: '4.17.20', type: 'production', outdated: true });
      manager.addVulnerability({ id: 'V1', packageName: 'lodash', severity: 'high', range: '*', title: 'T', description: 'D', fixAvailable: true });

      const report = manager.generateReport();

      expect(report.totalDependencies).toBe(1);
      expect(report.outdated).toHaveLength(1);
      expect(report.vulnerabilities).toHaveLength(1);
    });
  });

  describe('getUpdateRecommendations', () => {
    it('prioritizes security fixes', () => {
      manager.addDependency({ name: 'vuln-pkg', currentVersion: '1.0.0', latestVersion: '1.0.1', type: 'production' });
      manager.addVulnerability({ id: 'V1', packageName: 'vuln-pkg', severity: 'critical', range: '*', title: 'T', description: 'D', fixAvailable: true, fixedIn: '1.0.1' });

      const recommendations = manager.getUpdateRecommendations();

      expect(recommendations.length).toBeGreaterThan(0);
    });
  });
});

describe('Helper Functions', () => {
  it('createDependencyManager creates instance', () => {
    const instance = createDependencyManager();
    expect(instance).toBeInstanceOf(DependencyManager);
  });

  it('compareVersions compares correctly', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    expect(compareVersions('1.2.0', '1.10.0')).toBe(-1);
  });

  it('satisfiesRange checks caret', () => {
    expect(satisfiesRange('1.2.3', '^1.0.0')).toBe(true);
    expect(satisfiesRange('2.0.0', '^1.0.0')).toBe(true);
  });
});

describe('Zod Schemas', () => {
  it('validates dependency', () => {
    const dep = {
      name: 'test',
      currentVersion: '1.0.0',
      type: 'production',
    };
    const result = DependencySchema.safeParse(dep);
    expect(result.success).toBe(true);
  });

  it('validates vulnerability', () => {
    const vuln = {
      id: 'V1',
      packageName: 'test',
      severity: 'high',
      range: '<1.0.0',
      title: 'Test',
      description: 'Test vuln',
      fixAvailable: true,
    };
    const result = VulnerabilitySchema.safeParse(vuln);
    expect(result.success).toBe(true);
  });
});
