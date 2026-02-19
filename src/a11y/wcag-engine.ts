// Accessibility & WCAG Engine
// KIMI-R17-04: R17 spec

import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export type WCAGLevel = 'A' | 'AA' | 'AAA';
export type AccessibilitySeverity = 'minor' | 'moderate' | 'serious' | 'critical';
export type CheckType = 'automated' | 'manual' | 'semi-automated';

export interface AccessibilityAudit {
  id: string;
  url: string;
  timestamp: string;
  wcagVersion: string;
  targetLevel: WCAGLevel;
  results: AccessibilityResult[];
  summary: AuditSummary;
}

export interface AccessibilityResult {
  id: string;
  ruleId: string;
  description: string;
  level: WCAGLevel;
  severity: AccessibilitySeverity;
  type: CheckType;
  element?: string;
  impact: string;
  help: string;
  helpUrl: string;
  tags: string[];
}

export interface AuditSummary {
  totalViolations: number;
  byLevel: Record<WCAGLevel, number>;
  bySeverity: Record<AccessibilitySeverity, number>;
  byType: Record<CheckType, number>;
  passRate: number;
  score: number;
}

export interface A11yConfig {
  wcagVersion: string;
  targetLevel: WCAGLevel;
  includeBestPractices: boolean;
  includeExperimental: boolean;
  selectors: boolean;
  iframes: boolean;
}

export interface ElementCheck {
  selector: string;
  checks: CheckResult[];
}

export interface CheckResult {
  id: string;
  pass: boolean;
  description: string;
  data?: unknown;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const AccessibilityResultSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  description: z.string(),
  level: z.enum(['A', 'AA', 'AAA']),
  severity: z.enum(['minor', 'moderate', 'serious', 'critical']),
  type: z.enum(['automated', 'manual', 'semi-automated']),
  element: z.string().optional(),
  impact: z.string(),
  help: z.string(),
  helpUrl: z.string(),
  tags: z.array(z.string()),
});

export const AuditSummarySchema = z.object({
  totalViolations: z.number(),
  byLevel: z.record(z.number()),
  bySeverity: z.record(z.number()),
  byType: z.record(z.number()),
  passRate: z.number(),
  score: z.number(),
});

// ============================================================================
// WCAGEngine Class
// ============================================================================

export class WCAGEngine {
  private config: A11yConfig;
  private audits = new Map<string, AccessibilityAudit>();

  constructor(config?: Partial<A11yConfig>) {
    this.config = {
      wcagVersion: '2.1',
      targetLevel: 'AA',
      includeBestPractices: true,
      includeExperimental: false,
      selectors: true,
      iframes: true,
      ...config,
    };
  }

  async audit(html: string, url: string): Promise<AccessibilityAudit> {
    const audit: AccessibilityAudit = {
      id: crypto.randomUUID(),
      url,
      timestamp: new Date().toISOString(),
      wcagVersion: this.config.wcagVersion,
      targetLevel: this.config.targetLevel,
      results: [],
      summary: {
        totalViolations: 0,
        byLevel: { A: 0, AA: 0, AAA: 0 },
        bySeverity: { minor: 0, moderate: 0, serious: 0, critical: 0 },
        byType: { automated: 0, manual: 0, 'semi-automated': 0 },
        passRate: 100,
        score: 100,
      },
    };

    // Simulate running WCAG checks
    const results = this.runChecks(html);
    audit.results = results;
    audit.summary = this.calculateSummary(results);

    this.audits.set(audit.id, audit);
    return audit;
  }

  checkElement(element: string, checks: string[]): ElementCheck {
    const checkResults: CheckResult[] = checks.map(checkId => ({
      id: checkId,
      pass: Math.random() > 0.2, // 80% pass rate simulation
      description: `Check: ${checkId}`,
    }));

    return {
      selector: element,
      checks: checkResults,
    };
  }

  getViolations(auditId: string, level?: WCAGLevel): AccessibilityResult[] {
    const audit = this.audits.get(auditId);
    if (!audit) throw new Error(`Audit not found: ${auditId}`);

    let violations = audit.results;
    if (level) {
      violations = violations.filter(r => r.level === level);
    }

    return violations;
  }

  generateReport(auditId: string): string {
    const audit = this.audits.get(auditId);
    if (!audit) throw new Error(`Audit not found: ${auditId}`);

    const lines: string[] = [
      `Accessibility Audit Report`,
      `=========================`,
      `URL: ${audit.url}`,
      `WCAG Version: ${audit.wcagVersion}`,
      `Target Level: ${audit.targetLevel}`,
      `Timestamp: ${audit.timestamp}`,
      ``,
      `Summary`,
      `-------`,
      `Total Violations: ${audit.summary.totalViolations}`,
      `Pass Rate: ${audit.summary.passRate.toFixed(1)}%`,
      `Score: ${audit.summary.score}/100`,
      ``,
      `Violations by Level`,
      `-------------------`,
      `Level A: ${audit.summary.byLevel.A}`,
      `Level AA: ${audit.summary.byLevel.AA}`,
      `Level AAA: ${audit.summary.byLevel.AAA}`,
      ``,
      `Violations by Severity`,
      `----------------------`,
      `Critical: ${audit.summary.bySeverity.critical}`,
      `Serious: ${audit.summary.bySeverity.serious}`,
      `Moderate: ${audit.summary.bySeverity.moderate}`,
      `Minor: ${audit.summary.bySeverity.minor}`,
      ``,
      `Detailed Results`,
      `----------------`,
    ];

    for (const result of audit.results) {
      lines.push(`[${result.level}] ${result.description}`);
      lines.push(`  Severity: ${result.severity}`);
      lines.push(`  Impact: ${result.impact}`);
      lines.push(`  Help: ${result.help}`);
      lines.push(`  URL: ${result.helpUrl}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  isCompliant(auditId: string, level?: WCAGLevel): boolean {
    const audit = this.audits.get(auditId);
    if (!audit) throw new Error(`Audit not found: ${auditId}`);

    const targetLevel = level || audit.targetLevel;
    const violations = this.getViolations(auditId, targetLevel);

    return violations.length === 0;
  }

  getScore(auditId: string): number {
    const audit = this.audits.get(auditId);
    if (!audit) throw new Error(`Audit not found: ${auditId}`);

    return audit.summary.score;
  }

  // ---- Private Methods ----

  private runChecks(_html: string): AccessibilityResult[] {
    const results: AccessibilityResult[] = [];

    // Simulate various WCAG checks
    const checks = [
      { ruleId: 'color-contrast', description: 'Elements must have sufficient color contrast', level: 'AA' as WCAGLevel, severity: 'serious' as AccessibilitySeverity },
      { ruleId: 'image-alt', description: 'Images must have alternate text', level: 'A' as WCAGLevel, severity: 'critical' as AccessibilitySeverity },
      { ruleId: 'label', description: 'Form elements must have labels', level: 'A' as WCAGLevel, severity: 'critical' as AccessibilitySeverity },
      { ruleId: 'link-name', description: 'Links must have discernible text', level: 'A' as WCAGLevel, severity: 'serious' as AccessibilitySeverity },
      { ruleId: 'keyboard', description: 'All functionality must be keyboard accessible', level: 'A' as WCAGLevel, severity: 'critical' as AccessibilitySeverity },
    ];

    for (const check of checks) {
      // Simulate 30% chance of violation for demo
      if (Math.random() < 0.3) {
        results.push({
          id: crypto.randomUUID(),
          ruleId: check.ruleId,
          description: check.description,
          level: check.level,
          severity: check.severity,
          type: 'automated',
          impact: 'Users with visual disabilities may not be able to perceive content',
          help: `Fix ${check.ruleId}`,
          helpUrl: `https://www.w3.org/WAI/WCAG21/Understanding/${check.ruleId}`,
          tags: ['wcag2a', 'wcag2aa', check.ruleId],
        });
      }
    }

    return results;
  }

  private calculateSummary(results: AccessibilityResult[]): AuditSummary {
    const byLevel: Record<WCAGLevel, number> = { A: 0, AA: 0, AAA: 0 };
    const bySeverity: Record<AccessibilitySeverity, number> = { minor: 0, moderate: 0, serious: 0, critical: 0 };
    const byType: Record<CheckType, number> = { automated: 0, manual: 0, 'semi-automated': 0 };

    for (const result of results) {
      byLevel[result.level]++;
      bySeverity[result.severity]++;
      byType[result.type]++;
    }

    const totalViolations = results.length;
    const passRate = Math.max(0, 100 - totalViolations * 5);
    const score = Math.max(0, 100 - totalViolations * 3);

    return {
      totalViolations,
      byLevel,
      bySeverity,
      byType,
      passRate,
      score,
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createWCAGEngine(config?: Partial<A11yConfig>): WCAGEngine {
  return new WCAGEngine(config);
}

export function calculateContrastRatio(foreground: string, background: string): number {
  // Simplified contrast ratio calculation
  // In a real implementation, this would parse hex/rgb values
  const fgLuminance = parseInt(foreground.replace('#', ''), 16) / 0xffffff;
  const bgLuminance = parseInt(background.replace('#', ''), 16) / 0xffffff;
  
  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);
  
  return (lighter + 0.05) / (darker + 0.05);
}

export function isContrastCompliant(ratio: number, level: WCAGLevel = 'AA'): boolean {
  if (level === 'AAA') return ratio >= 7;
  if (level === 'AA') return ratio >= 4.5;
  return ratio >= 3;
}
