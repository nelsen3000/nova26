// WCAG Engine Edge Cases — R17-06
// KIMI-W-04: 8 edge case tests for accessibility engine

import { describe, it, expect, vi } from 'vitest';
import {
  WCAGEngine,
  createWCAGEngine,
} from './wcag-engine.js';

describe('WCAG Engine Edge Cases', () => {
  describe('WCAGEngine Edge Cases', () => {
    it('should handle empty HTML document', async () => {
      const engine = new WCAGEngine();
      const result = await engine.audit('', 'http://test.com');
      expect(result).toBeDefined();
    });

    it('should handle malformed HTML', async () => {
      const engine = new WCAGEngine();
      const html = '<div><span><p>unclosed tags';

      const result = await engine.audit(html, 'http://test.com');
      expect(result).toBeDefined();
    });

    it('should handle very large documents', async () => {
      const engine = new WCAGEngine();
      const html = '<div>content</div>\n'.repeat(10000);

      const result = await engine.audit(html, 'http://test.com');
      expect(result).toBeDefined();
    });

    it('should handle empty element check', () => {
      const engine = new WCAGEngine();
      const result = engine.checkElement('', []);
      expect(result).toBeDefined();
    });

    it('should handle unknown WCAG level', async () => {
      const engine = new WCAGEngine();
      const result = await engine.audit('<div></div>', 'http://test.com');

      // @ts-expect-error Testing unknown level
      const violations = engine.getViolations(result.id, 'unknown');
      expect(violations).toBeDefined();
    });

    it('should handle compliant document', async () => {
      const engine = new WCAGEngine();
      // Minimal valid HTML
      const html = '<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><main><h1>Hello</h1></main></body></html>';

      const result = await engine.audit(html, 'http://test.com');
      const isCompliant = engine.isCompliant(result.id);
      expect(typeof isCompliant).toBe('boolean');
    });

    it('should handle report generation for nonexistent audit', () => {
      const engine = new WCAGEngine();
      expect(() => engine.generateReport('nonexistent')).toThrow();
    });

    it('should handle score calculation with no violations', async () => {
      const engine = new WCAGEngine();
      const result = await engine.audit('<main role="main"><h1>Test</h1></main>', 'http://test.com');
      const score = engine.getScore(result.id);
      expect(typeof score).toBe('number');
    });
  });

  describe('createWCAGEngine Edge Cases', () => {
    it('should handle unknown WCAG level', () => {
      const engine = createWCAGEngine({
        // @ts-expect-error Testing unknown level
        targetLevel: 'AAA+',
      });
      expect(engine).toBeDefined();
    });

    it('should handle custom config', () => {
      const engine = createWCAGEngine({
        includeBestPractices: false,
        includeExperimental: false,
      });
      expect(engine).toBeDefined();
    });
  });
});
