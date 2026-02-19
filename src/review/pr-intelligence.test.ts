// Tests for Code Review & PR Intelligence
// KIMI-R17-01

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PRIntelligence,
  createPRIntelligence,
  calculateDiffStats,
  FileChangeSchema,
  CodeIssueSchema,
} from './pr-intelligence.js';

describe('PRIntelligence', () => {
  let pr: PRIntelligence;

  beforeEach(() => {
    pr = new PRIntelligence();
  });

  describe('createReview', () => {
    it('creates a new review', () => {
      const review = pr.createReview(1, 'Test PR', 'author1', 'feature-branch', 'main');

      expect(review.prNumber).toBe(1);
      expect(review.title).toBe('Test PR');
      expect(review.author).toBe('author1');
      expect(review.branch).toBe('feature-branch');
      expect(review.baseBranch).toBe('main');
      expect(review.status).toBe('pending');
    });

    it('generates unique IDs', () => {
      const review1 = pr.createReview(1, 'PR 1', 'a1', 'b1', 'main');
      const review2 = pr.createReview(2, 'PR 2', 'a2', 'b2', 'main');

      expect(review1.id).not.toBe(review2.id);
    });
  });

  describe('addFileChange', () => {
    it('adds file change to review', () => {
      const review = pr.createReview(1, 'Test', 'author', 'feature', 'main');
      const updated = pr.addFileChange(review.id, {
        path: 'src/index.ts',
        status: 'modified',
        additions: 10,
        deletions: 5,
      });

      expect(updated.filesChanged).toHaveLength(1);
      expect(updated.filesChanged[0].path).toBe('src/index.ts');
    });

    it('recalculates metrics', () => {
      const review = pr.createReview(1, 'Test', 'author', 'feature', 'main');
      const updated = pr.addFileChange(review.id, {
        path: 'src/index.ts',
        status: 'modified',
        additions: 10,
        deletions: 5,
      });

      expect(updated.metrics.totalFiles).toBe(1);
      expect(updated.metrics.totalAdditions).toBe(10);
      expect(updated.metrics.totalDeletions).toBe(5);
    });

    it('throws for non-existent review', () => {
      expect(() => {
        pr.addFileChange('fake-id', { path: 'test.ts', status: 'added', additions: 1, deletions: 0 });
      }).toThrow('Review not found');
    });
  });

  describe('addIssue', () => {
    it('adds issue to review', () => {
      const review = pr.createReview(1, 'Test', 'author', 'feature', 'main');
      const updated = pr.addIssue(review.id, {
        filePath: 'src/index.ts',
        line: 10,
        column: 5,
        severity: 'error',
        category: 'security',
        message: 'Potential SQL injection',
      });

      expect(updated.issues).toHaveLength(1);
      expect(updated.issues[0].message).toBe('Potential SQL injection');
    });

    it('recalculates issue metrics', () => {
      const review = pr.createReview(1, 'Test', 'author', 'feature', 'main');
      pr.addIssue(review.id, {
        filePath: 'src/index.ts',
        line: 10,
        column: 5,
        severity: 'critical',
        category: 'security',
        message: 'Critical issue',
      });
      pr.addIssue(review.id, {
        filePath: 'src/index.ts',
        line: 20,
        column: 3,
        severity: 'warning',
        category: 'style',
        message: 'Style issue',
      });

      const updated = pr.getReview(review.id)!;
      expect(updated.metrics.issueCount).toBe(2);
      expect(updated.metrics.criticalIssues).toBe(1);
    });
  });

  describe('addComment', () => {
    it('adds comment to review', () => {
      const review = pr.createReview(1, 'Test', 'author', 'feature', 'main');
      const updated = pr.addComment(review.id, {
        filePath: 'src/index.ts',
        line: 10,
        author: 'reviewer1',
        body: 'Consider using const',
        severity: 'info',
        resolved: false,
      });

      expect(updated.comments).toHaveLength(1);
      expect(updated.comments[0].body).toBe('Consider using const');
    });
  });

  describe('updateStatus', () => {
    it('updates review status', () => {
      const review = pr.createReview(1, 'Test', 'author', 'feature', 'main');
      const updated = pr.updateStatus(review.id, 'approved');

      expect(updated.status).toBe('approved');
    });
  });

  describe('analyzeCodeQuality', () => {
    it('calculates quality score', () => {
      const review = pr.createReview(1, 'Test', 'author', 'feature', 'main');
      pr.addIssue(review.id, {
        filePath: 'src/index.ts',
        line: 10,
        column: 5,
        severity: 'warning',
        category: 'style',
        message: 'Style issue',
      });

      const analysis = pr.analyzeCodeQuality(review.id);

      expect(analysis.score).toBeLessThan(100);
      expect(analysis.issuesBySeverity.warning).toBe(1);
    });

    it('groups issues by category', () => {
      const review = pr.createReview(1, 'Test', 'author', 'feature', 'main');
      pr.addIssue(review.id, { filePath: 'a.ts', line: 1, column: 1, severity: 'error', category: 'security', message: 'Sec' });
      pr.addIssue(review.id, { filePath: 'b.ts', line: 1, column: 1, severity: 'warning', category: 'performance', message: 'Perf' });
      pr.addIssue(review.id, { filePath: 'c.ts', line: 1, column: 1, severity: 'info', category: 'security', message: 'Sec2' });

      const analysis = pr.analyzeCodeQuality(review.id);

      expect(analysis.issuesByCategory.security).toBe(2);
      expect(analysis.issuesByCategory.performance).toBe(1);
    });

    it('generates recommendations', () => {
      const review = pr.createReview(1, 'Test', 'author', 'feature', 'main');
      pr.addIssue(review.id, {
        filePath: 'src/index.ts',
        line: 10,
        column: 5,
        severity: 'critical',
        category: 'security',
        message: 'Critical',
      });

      const analysis = pr.analyzeCodeQuality(review.id);

      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('shouldBlockMerge', () => {
    it('blocks merge for critical issues', () => {
      const review = pr.createReview(1, 'Test', 'author', 'feature', 'main');
      pr.addIssue(review.id, {
        filePath: 'src/index.ts',
        line: 10,
        column: 5,
        severity: 'critical',
        category: 'security',
        message: 'Critical',
      });

      const result = pr.shouldBlockMerge(review.id);

      expect(result.block).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('allows merge when clean', () => {
      const review = pr.createReview(1, 'Test', 'author', 'feature', 'main');
      pr.addFileChange(review.id, { path: 'src/index.test.ts', status: 'added', additions: 10, deletions: 0 });

      const result = pr.shouldBlockMerge(review.id);

      expect(result.block).toBe(false);
    });
  });

  describe('getReviewsByStatus', () => {
    it('filters by status', () => {
      const r1 = pr.createReview(1, 'Test 1', 'a1', 'b1', 'main');
      const r2 = pr.createReview(2, 'Test 2', 'a2', 'b2', 'main');
      pr.updateStatus(r1.id, 'approved');

      const approved = pr.getReviewsByStatus('approved');

      expect(approved).toHaveLength(1);
      expect(approved[0].id).toBe(r1.id);
    });
  });

  describe('getReviewsByAuthor', () => {
    it('filters by author', () => {
      pr.createReview(1, 'Test 1', 'alice', 'b1', 'main');
      pr.createReview(2, 'Test 2', 'bob', 'b2', 'main');
      pr.createReview(3, 'Test 3', 'alice', 'b3', 'main');

      const aliceReviews = pr.getReviewsByAuthor('alice');

      expect(aliceReviews).toHaveLength(2);
    });
  });
});

describe('Helper Functions', () => {
  it('createPRIntelligence creates instance', () => {
    const instance = createPRIntelligence({ autoReview: false });
    expect(instance).toBeInstanceOf(PRIntelligence);
  });

  it('calculateDiffStats sums changes', () => {
    const files = [
      { path: 'a.ts', status: 'added' as const, additions: 10, deletions: 0 },
      { path: 'b.ts', status: 'modified' as const, additions: 5, deletions: 3 },
      { path: 'c.ts', status: 'deleted' as const, additions: 0, deletions: 20 },
    ];

    const stats = calculateDiffStats(files);

    expect(stats.additions).toBe(15);
    expect(stats.deletions).toBe(23);
    expect(stats.files).toBe(3);
  });
});

describe('Zod Schemas', () => {
  it('validates file change', () => {
    const file = { path: 'test.ts', status: 'added', additions: 10, deletions: 0 };
    const result = FileChangeSchema.safeParse(file);
    expect(result.success).toBe(true);
  });

  it('validates code issue', () => {
    const issue = {
      id: 'issue-1',
      filePath: 'test.ts',
      line: 10,
      column: 5,
      severity: 'error',
      category: 'security',
      message: 'Test',
    };
    const result = CodeIssueSchema.safeParse(issue);
    expect(result.success).toBe(true);
  });
});
