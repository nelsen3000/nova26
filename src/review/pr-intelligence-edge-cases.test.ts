// PR Intelligence Edge Cases — R17-03
// KIMI-W-04: 8 edge case tests for code review intelligence

import { describe, it, expect, vi } from 'vitest';
import {
  PRIntelligence,
  createPRIntelligence,
} from './pr-intelligence.js';

describe('PR Intelligence Edge Cases', () => {
  describe('PRIntelligence Edge Cases', () => {
    it('should handle PR with empty title', () => {
      const intelligence = new PRIntelligence();
      const review = intelligence.createReview(1, '', 'author', 'branch', 'main');
      expect(review).toBeDefined();
      expect(review.title).toBe('');
    });

    it('should handle PR with very long title', () => {
      const intelligence = new PRIntelligence();
      const longTitle = 'a'.repeat(1000);
      const review = intelligence.createReview(1, longTitle, 'author', 'branch', 'main');
      expect(review).toBeDefined();
      expect(review.title).toBe(longTitle);
    });

    it('should handle PR with many file changes', () => {
      const intelligence = new PRIntelligence();
      const review = intelligence.createReview(1, 'Big PR', 'author', 'branch', 'main');
      expect(review).toBeDefined();
      expect(review.id).toBeDefined();
      
      // Add 100 file changes - just verify it doesn't throw
      for (let i = 0; i < 100; i++) {
        expect(() => {
          intelligence.addFileChange(review.id, {
            path: `file${i}.ts`,
            additions: 10,
            deletions: 5,
            status: 'modified',
          });
        }).not.toThrow();
      }
    });

    it('should handle binary file changes', () => {
      const intelligence = new PRIntelligence();
      const review = intelligence.createReview(1, 'Binary change', 'author', 'branch', 'main');
      
      const fileChange = intelligence.addFileChange(review.id, {
        path: 'image.png',
        additions: 0,
        deletions: 0,
        status: 'modified',
        isBinary: true,
      });
      
      expect(fileChange).toBeDefined();
    });

    it('should handle conflicting review comments', () => {
      const intelligence = new PRIntelligence();
      const review = intelligence.createReview(1, 'Test', 'author', 'branch', 'main');
      
      // Add conflicting comments
      intelligence.addComment(review.id, {
        file: 'test.ts',
        line: 10,
        body: 'Remove this',
        author: 'reviewer1',
      });
      
      intelligence.addComment(review.id, {
        file: 'test.ts',
        line: 10,
        body: 'Keep this',
        author: 'reviewer2',
      });
      
      const updated = intelligence.getReview(review.id);
      expect(updated?.comments).toHaveLength(2);
    });

    it('should handle many issues with same severity', () => {
      const intelligence = new PRIntelligence();
      const review = intelligence.createReview(1, 'Issues PR', 'author', 'branch', 'main');
      
      // Add 100 critical issues
      for (let i = 0; i < 100; i++) {
        intelligence.addIssue(review.id, {
          file: `file${i}.ts`,
          line: i,
          severity: 'critical',
          message: `Issue ${i}`,
          rule: 'test-rule',
        });
      }
      
      const shouldBlock = intelligence.shouldBlockMerge(review.id);
      expect(shouldBlock.block).toBe(true);
    });

    it('should handle rapid status changes', () => {
      const intelligence = new PRIntelligence();
      const review = intelligence.createReview(1, 'Test', 'author', 'branch', 'main');
      
      intelligence.updateStatus(review.id, 'in-review');
      intelligence.updateStatus(review.id, 'changes-requested');
      intelligence.updateStatus(review.id, 'in-review');
      intelligence.updateStatus(review.id, 'approved');
      
      const final = intelligence.getReview(review.id);
      expect(final?.status).toBe('approved');
    });

    it('should handle empty reviews list', () => {
      const intelligence = new PRIntelligence();
      const reviews = intelligence.getReviewsByStatus('approved');
      expect(reviews).toEqual([]);
    });
  });

  describe('createPRIntelligence Edge Cases', () => {
    it('should handle null options gracefully', () => {
      // @ts-expect-error Testing null options
      const intelligence = createPRIntelligence(null);
      expect(intelligence).toBeDefined();
    });

    it('should handle partial options', () => {
      const intelligence = createPRIntelligence({
        minConfidence: 0.5,
      });
      expect(intelligence).toBeDefined();
    });
  });
});
