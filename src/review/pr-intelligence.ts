// Code Review & PR Intelligence
// KIMI-R17-01: R17 spec

import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export type ReviewStatus = 'pending' | 'in-review' | 'approved' | 'changes-requested' | 'merged';
export type SeverityLevel = 'info' | 'warning' | 'error' | 'critical';

export interface CodeReview {
  id: string;
  prNumber: number;
  title: string;
  author: string;
  branch: string;
  baseBranch: string;
  status: ReviewStatus;
  filesChanged: FileChange[];
  comments: ReviewComment[];
  issues: CodeIssue[];
  metrics: ReviewMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
  patch?: string;
  previousPath?: string;
}

export interface ReviewComment {
  id: string;
  filePath?: string;
  line?: number;
  author: string;
  body: string;
  severity: SeverityLevel;
  createdAt: string;
  resolved: boolean;
}

export interface CodeIssue {
  id: string;
  filePath: string;
  line: number;
  column: number;
  severity: SeverityLevel;
  category: 'security' | 'performance' | 'maintainability' | 'style' | 'bug';
  message: string;
  suggestion?: string;
  ruleId?: string;
}

export interface ReviewMetrics {
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  issueCount: number;
  criticalIssues: number;
  complexityDelta: number;
  testCoverageDelta: number;
  reviewTime: number;
}

export interface ReviewConfig {
  autoReview: boolean;
  severityThreshold: SeverityLevel;
  requireTests: boolean;
  maxReviewTime: number;
  enabledRules: string[];
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const FileChangeSchema = z.object({
  path: z.string(),
  status: z.enum(['added', 'modified', 'deleted']),
  additions: z.number(),
  deletions: z.number(),
  patch: z.string().optional(),
  previousPath: z.string().optional(),
});

export const ReviewCommentSchema = z.object({
  id: z.string(),
  filePath: z.string().optional(),
  line: z.number().optional(),
  author: z.string(),
  body: z.string(),
  severity: z.enum(['info', 'warning', 'error', 'critical']),
  createdAt: z.string(),
  resolved: z.boolean(),
});

export const CodeIssueSchema = z.object({
  id: z.string(),
  filePath: z.string(),
  line: z.number(),
  column: z.number(),
  severity: z.enum(['info', 'warning', 'error', 'critical']),
  category: z.enum(['security', 'performance', 'maintainability', 'style', 'bug']),
  message: z.string(),
  suggestion: z.string().optional(),
  ruleId: z.string().optional(),
});

// ============================================================================
// PRIntelligence Class
// ============================================================================

export class PRIntelligence {
  private reviews = new Map<string, CodeReview>();
  private config: ReviewConfig;

  constructor(config?: Partial<ReviewConfig>) {
    this.config = {
      autoReview: true,
      severityThreshold: 'warning',
      requireTests: true,
      maxReviewTime: 30,
      enabledRules: ['security', 'performance', 'maintainability'],
      ...config,
    };
  }

  createReview(prNumber: number, title: string, author: string, branch: string, baseBranch: string): CodeReview {
    const review: CodeReview = {
      id: crypto.randomUUID(),
      prNumber,
      title,
      author,
      branch,
      baseBranch,
      status: 'pending',
      filesChanged: [],
      comments: [],
      issues: [],
      metrics: {
        totalFiles: 0,
        totalAdditions: 0,
        totalDeletions: 0,
        issueCount: 0,
        criticalIssues: 0,
        complexityDelta: 0,
        testCoverageDelta: 0,
        reviewTime: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.reviews.set(review.id, review);
    return review;
  }

  addFileChange(reviewId: string, fileChange: FileChange): CodeReview {
    const review = this.reviews.get(reviewId);
    if (!review) throw new Error(`Review not found: ${reviewId}`);

    review.filesChanged.push(fileChange);
    this.recalculateMetrics(review);
    review.updatedAt = new Date().toISOString();

    return review;
  }

  addIssue(reviewId: string, issue: Omit<CodeIssue, 'id'>): CodeReview {
    const review = this.reviews.get(reviewId);
    if (!review) throw new Error(`Review not found: ${reviewId}`);

    const newIssue: CodeIssue = { ...issue, id: crypto.randomUUID() };
    review.issues.push(newIssue);
    this.recalculateMetrics(review);
    review.updatedAt = new Date().toISOString();

    return review;
  }

  addComment(reviewId: string, comment: Omit<ReviewComment, 'id' | 'createdAt'>): CodeReview {
    const review = this.reviews.get(reviewId);
    if (!review) throw new Error(`Review not found: ${reviewId}`);

    const newComment: ReviewComment = {
      ...comment,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    review.comments.push(newComment);
    review.updatedAt = new Date().toISOString();

    return review;
  }

  updateStatus(reviewId: string, status: ReviewStatus): CodeReview {
    const review = this.reviews.get(reviewId);
    if (!review) throw new Error(`Review not found: ${reviewId}`);

    review.status = status;
    review.updatedAt = new Date().toISOString();

    return review;
  }

  analyzeCodeQuality(reviewId: string): {
    score: number;
    issuesByCategory: Record<string, number>;
    issuesBySeverity: Record<string, number>;
    recommendations: string[];
  } {
    const review = this.reviews.get(reviewId);
    if (!review) throw new Error(`Review not found: ${reviewId}`);

    const issuesByCategory: Record<string, number> = {};
    const issuesBySeverity: Record<string, number> = {};

    for (const issue of review.issues) {
      issuesByCategory[issue.category] = (issuesByCategory[issue.category] || 0) + 1;
      issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1;
    }

    // Calculate score (100 - penalties)
    let score = 100;
    score -= (issuesBySeverity.critical || 0) * 10;
    score -= (issuesBySeverity.error || 0) * 5;
    score -= (issuesBySeverity.warning || 0) * 2;
    score -= (issuesBySeverity.info || 0) * 0.5;
    score = Math.max(0, score);

    const recommendations = this.generateRecommendations(review, issuesByCategory, issuesBySeverity);

    return { score, issuesByCategory, issuesBySeverity, recommendations };
  }

  getReview(id: string): CodeReview | undefined {
    return this.reviews.get(id);
  }

  getReviewsByStatus(status: ReviewStatus): CodeReview[] {
    return Array.from(this.reviews.values()).filter(r => r.status === status);
  }

  getReviewsByAuthor(author: string): CodeReview[] {
    return Array.from(this.reviews.values()).filter(r => r.author === author);
  }

  shouldBlockMerge(reviewId: string): { block: boolean; reasons: string[] } {
    const review = this.reviews.get(reviewId);
    if (!review) throw new Error(`Review not found: ${reviewId}`);

    const reasons: string[] = [];

    const criticalIssues = review.issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      reasons.push(`${criticalIssues.length} critical issues found`);
    }

    if (this.config.requireTests && !this.hasTestChanges(review)) {
      reasons.push('No test changes detected');
    }

    const unresolvedComments = review.comments.filter(c => !c.resolved && c.severity === 'error');
    if (unresolvedComments.length > 0) {
      reasons.push(`${unresolvedComments.length} unresolved error comments`);
    }

    return { block: reasons.length > 0, reasons };
  }

  // ---- Private Methods ----

  private recalculateMetrics(review: CodeReview): void {
    review.metrics.totalFiles = review.filesChanged.length;
    review.metrics.totalAdditions = review.filesChanged.reduce((sum, f) => sum + f.additions, 0);
    review.metrics.totalDeletions = review.filesChanged.reduce((sum, f) => sum + f.deletions, 0);
    review.metrics.issueCount = review.issues.length;
    review.metrics.criticalIssues = review.issues.filter(i => i.severity === 'critical').length;
  }

  private hasTestChanges(review: CodeReview): boolean {
    return review.filesChanged.some(f => 
      f.path.includes('.test.') || f.path.includes('.spec.') || f.path.includes('__tests__')
    );
  }

  private generateRecommendations(
    review: CodeReview,
    issuesByCategory: Record<string, number>,
    issuesBySeverity: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];

    if (issuesBySeverity.critical > 0) {
      recommendations.push(`Address ${issuesBySeverity.critical} critical issues before merging`);
    }

    if (issuesByCategory.security > 0) {
      recommendations.push(`Review ${issuesByCategory.security} security issues`);
    }

    if (review.metrics.totalAdditions > 500) {
      recommendations.push('Consider splitting large PR into smaller chunks');
    }

    if (!this.hasTestChanges(review) && this.config.requireTests) {
      recommendations.push('Add tests for new/changed functionality');
    }

    if (review.metrics.complexityDelta > 10) {
      recommendations.push('Refactor to reduce complexity');
    }

    return recommendations;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createPRIntelligence(config?: Partial<ReviewConfig>): PRIntelligence {
  return new PRIntelligence(config);
}

export function calculateDiffStats(files: FileChange[]): { additions: number; deletions: number; files: number } {
  return {
    additions: files.reduce((sum, f) => sum + f.additions, 0),
    deletions: files.reduce((sum, f) => sum + f.deletions, 0),
    files: files.length,
  };
}
