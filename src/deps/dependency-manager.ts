// Dependency Management
// KIMI-R17-06: R17 spec

import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export type DependencyType = 'production' | 'development' | 'peer' | 'optional';
export type UpdateType = 'major' | 'minor' | 'patch' | 'prerelease';
export type VulnerabilitySeverity = 'low' | 'moderate' | 'high' | 'critical';

export interface Dependency {
  name: string;
  currentVersion: string;
  wantedVersion?: string;
  latestVersion?: string;
  type: DependencyType;
  homepage?: string;
  repository?: string;
  license?: string;
  deprecated?: boolean;
  outdated?: boolean;
}

export interface Vulnerability {
  id: string;
  packageName: string;
  severity: VulnerabilitySeverity;
  range: string;
  title: string;
  description: string;
  fixAvailable: boolean;
  fixedIn?: string;
  cve?: string;
}

export interface DependencyReport {
  timestamp: string;
  totalDependencies: number;
  outdated: Dependency[];
  vulnerabilities: Vulnerability[];
  deprecated: Dependency[];
  sizeEstimate?: string;
  licenseIssues: LicenseIssue[];
}

export interface LicenseIssue {
  package: string;
  license: string;
  severity: 'warning' | 'error';
  reason: string;
}

export interface UpdatePlan {
  packageName: string;
  from: string;
  to: string;
  updateType: UpdateType;
  breaking: boolean;
  changelog?: string;
  estimatedRisk: 'low' | 'medium' | 'high';
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const DependencySchema = z.object({
  name: z.string(),
  currentVersion: z.string(),
  wantedVersion: z.string().optional(),
  latestVersion: z.string().optional(),
  type: z.enum(['production', 'development', 'peer', 'optional']),
  homepage: z.string().optional(),
  repository: z.string().optional(),
  license: z.string().optional(),
  deprecated: z.boolean().optional(),
  outdated: z.boolean().optional(),
});

export const VulnerabilitySchema = z.object({
  id: z.string(),
  packageName: z.string(),
  severity: z.enum(['low', 'moderate', 'high', 'critical']),
  range: z.string(),
  title: z.string(),
  description: z.string(),
  fixAvailable: z.boolean(),
  fixedIn: z.string().optional(),
  cve: z.string().optional(),
});

// ============================================================================
// DependencyManager Class
// ============================================================================

export class DependencyManager {
  private dependencies = new Map<string, Dependency>();
  private vulnerabilities: Vulnerability[] = [];

  addDependency(dep: Dependency): void {
    this.dependencies.set(dep.name, dep);
  }

  addVulnerability(vuln: Vulnerability): void {
    this.vulnerabilities.push(vuln);
  }

  getDependency(name: string): Dependency | undefined {
    return this.dependencies.get(name);
  }

  getAllDependencies(): Dependency[] {
    return Array.from(this.dependencies.values());
  }

  getOutdatedDependencies(): Dependency[] {
    return this.getAllDependencies().filter(d => d.outdated);
  }

  getDeprecatedDependencies(): Dependency[] {
    return this.getAllDependencies().filter(d => d.deprecated);
  }

  getVulnerabilities(severity?: VulnerabilitySeverity): Vulnerability[] {
    if (severity) {
      return this.vulnerabilities.filter(v => v.severity === severity);
    }
    return this.vulnerabilities;
  }

  checkOutdated(name: string): { outdated: boolean; current?: string; latest?: string } {
    const dep = this.dependencies.get(name);
    if (!dep) return { outdated: false };

    return {
      outdated: dep.outdated || false,
      current: dep.currentVersion,
      latest: dep.latestVersion,
    };
  }

  analyzeUpdate(name: string, targetVersion: string): UpdatePlan {
    const dep = this.dependencies.get(name);
    if (!dep) throw new Error(`Dependency not found: ${name}`);

    const from = dep.currentVersion;
    const updateType = this.detectUpdateType(from, targetVersion);
    const breaking = this.isBreakingChange(from, targetVersion);

    return {
      packageName: name,
      from,
      to: targetVersion,
      updateType,
      breaking,
      estimatedRisk: breaking ? 'high' : updateType === 'major' ? 'medium' : 'low',
    };
  }

  generateReport(): DependencyReport {
    const deps = this.getAllDependencies();

    return {
      timestamp: new Date().toISOString(),
      totalDependencies: deps.length,
      outdated: this.getOutdatedDependencies(),
      vulnerabilities: this.vulnerabilities,
      deprecated: this.getDeprecatedDependencies(),
      licenseIssues: this.checkLicenses(),
    };
  }

  getUpdateRecommendations(): UpdatePlan[] {
    const recommendations: UpdatePlan[] = [];

    // Critical vulnerabilities first
    for (const vuln of this.vulnerabilities.filter(v => v.severity === 'critical')) {
      if (vuln.fixAvailable && vuln.fixedIn) {
        recommendations.push(this.analyzeUpdate(vuln.packageName, vuln.fixedIn));
      }
    }

    // Then deprecated packages
    for (const dep of this.getDeprecatedDependencies()) {
      if (dep.latestVersion) {
        recommendations.push(this.analyzeUpdate(dep.name, dep.latestVersion));
      }
    }

    // Then outdated packages
    for (const dep of this.getOutdatedDependencies()) {
      if (dep.latestVersion && !recommendations.find(r => r.packageName === dep.name)) {
        recommendations.push(this.analyzeUpdate(dep.name, dep.latestVersion));
      }
    }

    return recommendations;
  }

  private detectUpdateType(from: string, to: string): UpdateType {
    const fromParts = from.replace(/[^\d.]/g, '').split('.').map(Number);
    const toParts = to.replace(/[^\d.]/g, '').split('.').map(Number);

    if (toParts[0] > fromParts[0]) return 'major';
    if (toParts[1] > fromParts[1]) return 'minor';
    if (toParts[2] > fromParts[2]) return 'patch';
    return 'prerelease';
  }

  private isBreakingChange(from: string, to: string): boolean {
    const fromMajor = parseInt(from.split('.')[0]);
    const toMajor = parseInt(to.split('.')[0]);
    return toMajor > fromMajor;
  }

  private checkLicenses(): LicenseIssue[] {
    const issues: LicenseIssue[] = [];
    const allowedLicenses = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC'];

    for (const dep of this.getAllDependencies()) {
      if (dep.license && !allowedLicenses.includes(dep.license)) {
        issues.push({
          package: dep.name,
          license: dep.license,
          severity: 'warning',
          reason: 'License not in approved list',
        });
      }
    }

    return issues;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createDependencyManager(): DependencyManager {
  return new DependencyManager();
}

export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.replace(/[^\d.]/g, '').split('.').map(Number);
  const parts2 = v2.replace(/[^\d.]/g, '').split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  return 0;
}

export function satisfiesRange(version: string, range: string): boolean {
  // Simplified semver range check
  // In real implementation, use semver package
  if (range.startsWith('^')) {
    const min = range.slice(1);
    return compareVersions(version, min) >= 0;
  }
  if (range.startsWith('~')) {
    const min = range.slice(1);
    return compareVersions(version, min) >= 0;
  }
  if (range.includes('>=')) {
    const min = range.replace('>=', '');
    return compareVersions(version, min) >= 0;
  }
  return version === range;
}
