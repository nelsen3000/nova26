// Tests for Accessibility & WCAG Engine
// KIMI-R17-04

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WCAGEngine,
  createWCAGEngine,
  calculateContrastRatio,
  isContrastCompliant,
  AccessibilityResultSchema,
  AuditSummarySchema,
} from './wcag-engine.js';

describe('WCAGEngine', () => {
  let engine: WCAGEngine;

  beforeEach(() => {
    engine = new WCAGEngine();
  });

  describe('audit', () => {
    it('performs accessibility audit', async () => {
      const html = '<html><body><img src="test.jpg"></body></html>';
      const audit = await engine.audit(html, 'https://example.com');

      expect(audit.url).toBe('https://example.com');
      expect(audit.wcagVersion).toBe('2.1');
      expect(audit.targetLevel).toBe('AA');
      expect(audit.summary).toBeDefined();
    });

    it('calculates summary', async () => {
      const html = '<html><body></body></html>';
      const audit = await engine.audit(html, 'https://example.com');

      expect(audit.summary.passRate).toBeGreaterThanOrEqual(0);
      expect(audit.summary.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('checkElement', () => {
    it('checks element for accessibility', () => {
      const result = engine.checkElement('#myButton', ['color-contrast', 'keyboard-accessible']);

      expect(result.selector).toBe('#myButton');
      expect(result.checks).toHaveLength(2);
    });
  });

  describe('getViolations', () => {
    it('returns all violations', async () => {
      const html = '<html><body></body></html>';
      const audit = await engine.audit(html, 'https://example.com');

      const violations = engine.getViolations(audit.id);
      expect(Array.isArray(violations)).toBe(true);
    });

    it('filters by level', async () => {
      const html = '<html><body></body></html>';
      const audit = await engine.audit(html, 'https://example.com');

      const violations = engine.getViolations(audit.id, 'A');
      expect(Array.isArray(violations)).toBe(true);
    });
  });

  describe('generateReport', () => {
    it('generates text report', async () => {
      const html = '<html><body></body></html>';
      const audit = await engine.audit(html, 'https://example.com');

      const report = engine.generateReport(audit.id);

      expect(report).toContain('Accessibility Audit Report');
      expect(report).toContain(audit.url);
    });
  });

  describe('isCompliant', () => {
    it('checks compliance', async () => {
      const html = '<html><body></body></html>';
      const audit = await engine.audit(html, 'https://example.com');

      const compliant = engine.isCompliant(audit.id);
      expect(typeof compliant).toBe('boolean');
    });
  });

  describe('getScore', () => {
    it('returns accessibility score', async () => {
      const html = '<html><body></body></html>';
      const audit = await engine.audit(html, 'https://example.com');

      const score = engine.getScore(audit.id);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});

describe('Helper Functions', () => {
  it('createWCAGEngine creates instance', () => {
    const instance = createWCAGEngine({ targetLevel: 'AAA' });
    expect(instance).toBeInstanceOf(WCAGEngine);
  });

  it('calculateContrastRatio calculates ratio', () => {
    const ratio = calculateContrastRatio('#000000', '#ffffff');
    expect(ratio).toBeGreaterThan(1);
  });

  it('isContrastCompliant checks AAA level', () => {
    expect(isContrastCompliant(7, 'AAA')).toBe(true);
    expect(isContrastCompliant(6, 'AAA')).toBe(false);
  });

  it('isContrastCompliant checks AA level', () => {
    expect(isContrastCompliant(4.5, 'AA')).toBe(true);
    expect(isContrastCompliant(4, 'AA')).toBe(false);
  });

  it('isContrastCompliant checks A level', () => {
    expect(isContrastCompliant(3, 'A')).toBe(true);
    expect(isContrastCompliant(2, 'A')).toBe(false);
  });
});

describe('Zod Schemas', () => {
  it('validates accessibility result', () => {
    const result = {
      id: 'r1',
      ruleId: 'color-contrast',
      description: 'Elements must have sufficient color contrast',
      level: 'AA',
      severity: 'serious',
      type: 'automated',
      impact: 'Visual',
      help: 'Fix it',
      helpUrl: 'https://example.com',
      tags: ['wcag2aa'],
    };
    const parseResult = AccessibilityResultSchema.safeParse(result);
    expect(parseResult.success).toBe(true);
  });

  it('validates audit summary', () => {
    const summary = {
      totalViolations: 5,
      byLevel: { A: 2, AA: 3, AAA: 0 },
      bySeverity: { minor: 1, moderate: 2, serious: 2, critical: 0 },
      byType: { automated: 5, manual: 0, 'semi-automated': 0 },
      passRate: 95,
      score: 85,
    };
    const result = AuditSummarySchema.safeParse(summary);
    expect(result.success).toBe(true);
  });
});
