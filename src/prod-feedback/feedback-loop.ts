// Production Feedback Loop
// KIMI-R17-07: R17 spec

import { z } from 'zod';
import type { StackFrame } from '../debug/root-cause-analyzer.js';

// ============================================================================
// Core Types
// ============================================================================

export type FeedbackType = 'error' | 'performance' | 'usage' | 'anomaly';
export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ProductionFeedback {
  id: string;
  type: FeedbackType;
  priority: FeedbackPriority;
  timestamp: string;
  service: string;
  environment: string;
  version: string;
  sessionId?: string;
  userId?: string;
  metadata: Record<string, unknown>;
}

export interface ErrorFeedback extends ProductionFeedback {
  type: 'error';
  errorType: string;
  message: string;
  stackTrace: StackFrame[];
  context: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
}

export interface PerformanceFeedback extends ProductionFeedback {
  type: 'performance';
  metric: string;
  value: number;
  unit: string;
  threshold: number;
  exceeded: boolean;
}

export interface AnomalyFeedback extends ProductionFeedback {
  type: 'anomaly';
  anomalyType: string;
  expectedValue: number;
  actualValue: number;
  deviation: number;
}

export interface FeedbackAnalysis {
  feedbackId: string;
  pattern?: string;
  correlatedIssues: string[];
  recommendedActions: string[];
  severity: FeedbackPriority;
  autoFixable: boolean;
}

export interface FeedbackLoopConfig {
  enabledTypes: FeedbackType[];
  samplingRate: number;
  autoAlertThreshold: FeedbackPriority;
  autoCreateTickets: boolean;
  retentionDays: number;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const ProductionFeedbackSchema = z.object({
  id: z.string(),
  type: z.enum(['error', 'performance', 'usage', 'anomaly']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  timestamp: z.string(),
  service: z.string(),
  environment: z.string(),
  version: z.string(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  metadata: z.record(z.unknown()),
});

// ============================================================================
// FeedbackLoop Class
// ============================================================================

export class FeedbackLoop {
  private feedback: Map<string, ProductionFeedback> = new Map();
  private analyses: Map<string, FeedbackAnalysis> = new Map();
  private config: FeedbackLoopConfig;

  constructor(config?: Partial<FeedbackLoopConfig>) {
    this.config = {
      enabledTypes: ['error', 'performance', 'anomaly'],
      samplingRate: 1.0,
      autoAlertThreshold: 'high',
      autoCreateTickets: false,
      retentionDays: 30,
      ...config,
    };
  }

  collect(feedback: Omit<ProductionFeedback, 'id'>): ProductionFeedback {
    // Apply sampling
    if (Math.random() > this.config.samplingRate) {
      return { ...feedback, id: 'dropped' };
    }

    const newFeedback: ProductionFeedback = {
      ...feedback,
      id: crypto.randomUUID(),
    };

    this.feedback.set(newFeedback.id, newFeedback);
    
    // Auto-analyze critical feedback
    if (newFeedback.priority === 'critical' || newFeedback.type === 'error') {
      this.analyze(newFeedback.id);
    }

    return newFeedback;
  }

  analyze(feedbackId: string): FeedbackAnalysis {
    const item = this.feedback.get(feedbackId);
    if (!item) throw new Error(`Feedback not found: ${feedbackId}`);

    const analysis: FeedbackAnalysis = {
      feedbackId,
      correlatedIssues: this.findCorrelatedIssues(item),
      recommendedActions: this.generateRecommendations(item),
      severity: item.priority,
      autoFixable: this.isAutoFixable(item),
    };

    this.analyses.set(feedbackId, analysis);
    return analysis;
  }

  getFeedback(id: string): ProductionFeedback | undefined {
    return this.feedback.get(id);
  }

  getFeedbackByType(type: FeedbackType): ProductionFeedback[] {
    return Array.from(this.feedback.values()).filter(f => f.type === type);
  }

  getFeedbackByService(service: string): ProductionFeedback[] {
    return Array.from(this.feedback.values()).filter(f => f.service === service);
  }

  getCriticalFeedback(): ProductionFeedback[] {
    return Array.from(this.feedback.values()).filter(f => f.priority === 'critical');
  }

  getTrend(timeWindow: number): { timestamp: string; count: number; type: FeedbackType }[] {
    const now = Date.now();
    const cutoff = now - timeWindow;
    const trends = new Map<string, { timestamp: string; count: number; type: FeedbackType }>();

    for (const item of this.feedback.values()) {
      const itemTime = new Date(item.timestamp).getTime();
      if (itemTime < cutoff) continue;

      const key = `${item.timestamp.slice(0, 13)}:${item.type}`; // Hourly grouping
      if (!trends.has(key)) {
        trends.set(key, { timestamp: item.timestamp.slice(0, 13) + ':00:00.000Z', count: 0, type: item.type });
      }
      trends.get(key)!.count++;
    }

    return Array.from(trends.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  correlate(feedbackId1: string, feedbackId2: string): boolean {
    const f1 = this.feedback.get(feedbackId1);
    const f2 = this.feedback.get(feedbackId2);

    if (!f1 || !f2) return false;

    // Check for correlation
    const sameService = f1.service === f2.service;
    const sameVersion = f1.version === f2.version;
    const timeProximity = Math.abs(
      new Date(f1.timestamp).getTime() - new Date(f2.timestamp).getTime()
    ) < 60000; // Within 1 minute

    return sameService && sameVersion && timeProximity;
  }

  generateIncidentReport(timeWindow: number): {
    period: { start: string; end: string };
    summary: Record<FeedbackType, number>;
    topIssues: ProductionFeedback[];
    recommendations: string[];
  } {
    const now = Date.now();
    const start = new Date(now - timeWindow).toISOString();
    const end = new Date(now).toISOString();

    const relevant = Array.from(this.feedback.values()).filter(f => {
      const ts = new Date(f.timestamp).getTime();
      return ts >= now - timeWindow;
    });

    const summary: Record<FeedbackType, number> = { error: 0, performance: 0, usage: 0, anomaly: 0 };
    for (const item of relevant) {
      summary[item.type]++;
    }

    const topIssues = relevant
      .filter(f => f.priority === 'critical' || f.priority === 'high')
      .slice(0, 10);

    const recommendations = this.generateIncidentRecommendations(relevant);

    return { period: { start, end }, summary, topIssues, recommendations };
  }

  // ---- Private Methods ----

  private findCorrelatedIssues(item: ProductionFeedback): string[] {
    const correlated: string[] = [];
    
    for (const [id] of this.feedback) {
      if (id !== item.id && this.correlate(item.id, id)) {
        correlated.push(id);
      }
    }

    return correlated.slice(0, 5); // Top 5 correlations
  }

  private generateRecommendations(item: ProductionFeedback): string[] {
    const recommendations: string[] = [];

    if (item.type === 'error') {
      recommendations.push('Review error logs and stack traces');
      recommendations.push('Check recent deployments');
    }

    if (item.type === 'performance') {
      recommendations.push('Analyze performance metrics');
      recommendations.push('Consider scaling resources');
    }

    if (item.type === 'anomaly') {
      recommendations.push('Investigate anomalous behavior');
      recommendations.push('Review data pipelines');
    }

    if (item.priority === 'critical') {
      recommendations.push('Escalate to on-call engineer');
    }

    return recommendations;
  }

  private isAutoFixable(item: ProductionFeedback): boolean {
    if (item.type !== 'error') return false;
    const errorItem = item as ErrorFeedback;
    // Only auto-fix known patterns
    return errorItem.errorType === 'TimeoutError' || errorItem.errorType === 'ConnectionError';
  }

  private generateIncidentRecommendations(items: ProductionFeedback[]): string[] {
    const recommendations = new Set<string>();

    const errors = items.filter(i => i.type === 'error').length;
    const perf = items.filter(i => i.type === 'performance').length;
    const anomalies = items.filter(i => i.type === 'anomaly').length;

    if (errors > 10) recommendations.add('Deploy rollback candidate');
    if (perf > 5) recommendations.add('Scale up infrastructure');
    if (anomalies > 3) recommendations.add('Check data quality');

    return Array.from(recommendations);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createFeedbackLoop(config?: Partial<FeedbackLoopConfig>): FeedbackLoop {
  return new FeedbackLoop(config);
}

export function prioritizeFeedback(feedback: ProductionFeedback[]): ProductionFeedback[] {
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...feedback].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

export function groupByService(feedback: ProductionFeedback[]): Map<string, ProductionFeedback[]> {
  const groups = new Map<string, ProductionFeedback[]>();
  
  for (const item of feedback) {
    if (!groups.has(item.service)) {
      groups.set(item.service, []);
    }
    groups.get(item.service)!.push(item);
  }

  return groups;
}
