// Semantic Differ Tests — R19-02

import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticDiffer, createSemanticDiffer } from '../semantic-differ.js';
import type { FileChange } from '../semantic-differ.js';

describe('SemanticDiffer', () => {
  let differ: SemanticDiffer;

  beforeEach(() => {
    differ = new SemanticDiffer();
  });

  describe('analyzePRIntent()', () => {
    it('should analyze PR with file changes', () => {
      const changes: FileChange[] = [
        {
          filePath: 'src/auth.ts',
          changeType: 'modified',
          additions: 50,
          deletions: 10,
        },
        {
          filePath: 'src/utils.ts',
          changeType: 'modified',
          additions: 20,
          deletions: 5,
        },
      ];

      const result = differ.analyzePRIntent(changes);

      expect(result.prIntent).toBeDefined();
      expect(result.groupedChanges).toHaveLengthGreaterThan(0);
      expect(result.overallConfidence).toBeGreaterThan(0);
    });

    it('should detect suspicious patterns', () => {
      const changes: FileChange[] = [
        {
          filePath: 'src/large.ts',
          changeType: 'modified',
          additions: 200,
          deletions: 50,
        },
      ];

      const result = differ.analyzePRIntent(changes);
      expect(result.suspiciousPatterns.length).toBeGreaterThan(0);
    });

    it('should assess safety', () => {
      const changes: FileChange[] = [
        {
          filePath: 'src/auth.ts',
          changeType: 'modified',
          additions: 10,
          deletions: 5,
        },
      ];

      const result = differ.analyzePRIntent(changes);
      expect(typeof result.safeToMerge).toBe('boolean');
    });
  });

  describe('categorizeChanges()', () => {
    it('should categorize test files', () => {
      const changes: FileChange[] = [
        {
          filePath: 'src/auth.test.ts',
          changeType: 'modified',
          additions: 50,
          deletions: 10,
        },
      ];

      const grouped = differ.categorizeChanges(changes);
      expect(grouped.some(g => g.category === 'Tests')).toBe(true);
    });

    it('should categorize components', () => {
      const changes: FileChange[] = [
        {
          filePath: 'src/components/Button.tsx',
          changeType: 'modified',
          additions: 30,
          deletions: 5,
        },
      ];

      const grouped = differ.categorizeChanges(changes);
      expect(grouped.some(g => g.category === 'Components')).toBe(true);
    });

    it('should include file counts in summaries', () => {
      const changes: FileChange[] = [
        {
          filePath: 'src/a.ts',
          changeType: 'modified',
          additions: 10,
          deletions: 5,
        },
        {
          filePath: 'src/b.ts',
          changeType: 'modified',
          additions: 20,
          deletions: 10,
        },
      ];

      const grouped = differ.categorizeChanges(changes);
      expect(grouped[0].summary).toContain('2 files');
    });
  });

  describe('detectSuspiciousPatterns()', () => {
    it('should detect large changes without tests', () => {
      const changes: FileChange[] = [
        {
          filePath: 'src/large.ts',
          changeType: 'modified',
          additions: 150,
          deletions: 20,
        },
      ];

      const patterns = differ.detectSuspiciousPatterns(changes);
      expect(patterns.some(p => p.includes('Large code changes'))).toBe(true);
    });

    it('should detect critical file changes', () => {
      const changes: FileChange[] = [
        {
          filePath: 'src/auth.ts',
          changeType: 'modified',
          additions: 50,
          deletions: 10,
        },
        {
          filePath: 'src/security.ts',
          changeType: 'modified',
          additions: 30,
          deletions: 5,
        },
        {
          filePath: 'src/config.ts',
          changeType: 'modified',
          additions: 20,
          deletions: 5,
        },
      ];

      const patterns = differ.detectSuspiciousPatterns(changes);
      expect(patterns.some(p => p.includes('critical'))).toBe(true);
    });

    it('should detect schema changes', () => {
      const changes: FileChange[] = [
        {
          filePath: 'src/migrations/001.sql',
          changeType: 'added',
          additions: 50,
          deletions: 0,
          content: 'CREATE TABLE users',
        },
      ];

      const patterns = differ.detectSuspiciousPatterns(changes);
      expect(patterns.some(p => p.includes('schema'))).toBe(true);
    });

    it('should detect lock file conflicts', () => {
      const changes: FileChange[] = [
        {
          filePath: 'package-lock.json',
          changeType: 'modified',
          additions: 1000,
          deletions: 500,
        },
        {
          filePath: 'yarn.lock',
          changeType: 'modified',
          additions: 800,
          deletions: 400,
        },
      ];

      const patterns = differ.detectSuspiciousPatterns(changes);
      expect(patterns.some(p => p.includes('lock file'))).toBe(true);
    });

    it('should return empty for safe changes', () => {
      const changes: FileChange[] = [
        {
          filePath: 'src/safe.ts',
          changeType: 'modified',
          additions: 20,
          deletions: 5,
        },
      ];

      const patterns = differ.detectSuspiciousPatterns(changes);
      expect(patterns).toHaveLength(0);
    });
  });

  describe('calculateConfidence()', () => {
    it('should be high for small safe changes', () => {
      const changes: FileChange[] = [
        {
          filePath: 'src/small.ts',
          changeType: 'modified',
          additions: 20,
          deletions: 5,
        },
      ];

      const confidence = differ.calculateConfidence(changes, []);
      expect(confidence).toBe(1);
    });

    it('should be lower for large changes', () => {
      const changes: FileChange[] = [
        {
          filePath: 'src/large.ts',
          changeType: 'modified',
          additions: 600,
          deletions: 100,
        },
      ];

      const confidence = differ.calculateConfidence(changes, []);
      expect(confidence).toBeLessThan(0.9);
    });

    it('should be lower for many deletions', () => {
      const changes: FileChange[] = [
        {
          filePath: 'src/a.ts',
          changeType: 'deleted',
          additions: 0,
          deletions: 100,
        },
        {
          filePath: 'src/b.ts',
          changeType: 'deleted',
          additions: 0,
          deletions: 100,
        },
        {
          filePath: 'src/c.ts',
          changeType: 'deleted',
          additions: 0,
          deletions: 100,
        },
        {
          filePath: 'src/d.ts',
          changeType: 'deleted',
          additions: 0,
          deletions: 100,
        },
        {
          filePath: 'src/e.ts',
          changeType: 'deleted',
          additions: 0,
          deletions: 100,
        },
        {
          filePath: 'src/f.ts',
          changeType: 'deleted',
          additions: 0,
          deletions: 100,
        },
      ];

      const confidence = differ.calculateConfidence(changes, []);
      expect(confidence).toBeLessThan(1);
    });
  });

  describe('assessSafety()', () => {
    it('should be safe for simple changes', () => {
      const changes: FileChange[] = [
        {
          filePath: 'src/safe.ts',
          changeType: 'modified',
          additions: 20,
          deletions: 5,
        },
      ];

      const safe = differ.assessSafety(changes, []);
      expect(safe).toBe(true);
    });

    it('should be unsafe for too many suspicious patterns', () => {
      const changes: FileChange[] = [
        {
          filePath: 'src/a.ts',
          changeType: 'modified',
          additions: 200,
          deletions: 50,
        },
      ];

      const patterns = ['pattern1', 'pattern2', 'pattern3'];
      const safe = differ.assessSafety(changes, patterns);
      expect(safe).toBe(false);
    });

    it('should be unsafe for too many files', () => {
      const changes: FileChange[] = Array(60).fill(null).map((_, i) => ({
        filePath: `src/${i}.ts`,
        changeType: 'modified',
        additions: 10,
        deletions: 5,
      }));

      const safe = differ.assessSafety(changes, []);
      expect(safe).toBe(false);
    });
  });

  describe('generateReport()', () => {
    it('should include summary', () => {
      const changes: FileChange[] = [
        {
          filePath: 'src/a.ts',
          changeType: 'modified',
          additions: 50,
          deletions: 10,
        },
      ];

      const report = differ.generateReport(changes, [], []);
      expect(report).toContain('Semantic Diff Report');
    });

    it('should include change count', () => {
      const changes: FileChange[] = [
        {
          filePath: 'src/a.ts',
          changeType: 'modified',
          additions: 50,
          deletions: 10,
        },
      ];

      const report = differ.generateReport(changes, [], []);
      expect(report).toContain('1 files');
    });

    it('should include suspicious patterns section', () => {
      const changes: FileChange[] = [];
      const patterns = ['Test pattern'];

      const report = differ.generateReport(changes, [], patterns);
      expect(report).toContain('Suspicious Patterns');
      expect(report).toContain('Test pattern');
    });
  });

  describe('createSemanticDiffer()', () => {
    it('should create a differ instance', () => {
      const differ = createSemanticDiffer();
      expect(differ).toBeInstanceOf(SemanticDiffer);
    });
  });
});
