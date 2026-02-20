// KMS-16: Agent Performance Tracker
// Records and analyzes per-agent metrics for performance monitoring

// ============================================================================
// Types
// ============================================================================

/**
 * Status of a task execution
 */
export type TaskStatus = 'success' | 'failure' | 'in_progress';

/**
 * Individual task execution record
 */
export interface TaskRecord {
  taskId: string;
  agentName: string;
  taskType: string;
  status: TaskStatus;
  durationMs: number;
  qualityScore: number;
  errorType?: string;
  errorMessage?: string;
  timestamp: string;
  metadata?: Record<string, string>;
}

/**
 * Aggregated metrics for an agent
 */
export interface AgentMetrics {
  agentName: string;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  successRate: number;
  errorRate: number;
  averageDurationMs: number;
  averageQualityScore: number;
  totalDurationMs: number;
  lastActiveAt: string;
  firstTaskAt: string;
}

/**
 * Trend data point for time-series analysis
 */
export interface TrendPoint {
  timestamp: string;
  successRate: number;
  averageDurationMs: number;
  taskCount: number;
  averageQualityScore: number;
}

/**
 * Agent ranking entry
 */
export interface AgentRanking {
  rank: number;
  agentName: string;
  score: number;
  metrics: AgentMetrics;
}

/**
 * Performance trend analysis result
 */
export interface TrendAnalysis {
  agentName: string;
  period: 'hourly' | 'daily' | 'weekly';
  trendDirection: 'improving' | 'declining' | 'stable';
  changePercent: number;
  dataPoints: TrendPoint[];
}

/**
 * Performance comparison between agents
 */
export interface PerformanceComparison {
  baselineAgent: string;
  compareAgent: string;
  successRateDiff: number;
  durationDiffMs: number;
  qualityDiff: number;
  overallWinner: string;
}

/**
 * Performance summary for all agents
 */
export interface PerformanceSummary {
  totalAgents: number;
  totalTasks: number;
  overallSuccessRate: number;
  overallAverageDurationMs: number;
  overallAverageQualityScore: number;
  topPerformer: string | null;
  mostImproved: string | null;
  rankings: AgentRanking[];
}

// ============================================================================
// PerformanceTracker Class
// ============================================================================

export class PerformanceTracker {
  private tasks: TaskRecord[] = [];
  private agentMetrics: Map<string, AgentMetrics> = new Map();
  private maxRecords: number;

  constructor(options: { maxRecords?: number } = {}) {
    this.maxRecords = options.maxRecords ?? 10000;
  }

  /**
   * Record a new task execution
   */
  recordTask(task: Omit<TaskRecord, 'timestamp'>): TaskRecord {
    const fullTask: TaskRecord = {
      ...task,
      timestamp: new Date().toISOString(),
    };

    this.tasks.push(fullTask);

    // Enforce max records limit
    if (this.tasks.length > this.maxRecords) {
      this.tasks.shift();
    }

    // Update agent metrics
    this.updateAgentMetrics(task.agentName);

    return fullTask;
  }

  /**
   * Start tracking a task (creates in-progress record)
   */
  startTask(
    agentName: string,
    taskType: string,
    taskId: string,
    metadata?: Record<string, string>
  ): TaskRecord {
    return this.recordTask({
      taskId,
      agentName,
      taskType,
      status: 'in_progress',
      durationMs: 0,
      qualityScore: 0,
      metadata,
    });
  }

  /**
   * Complete a task with success status
   */
  completeTask(
    taskId: string,
    durationMs: number,
    qualityScore: number
  ): TaskRecord | null {
    const task = this.tasks.find(t => t.taskId === taskId && t.status === 'in_progress');
    if (!task) return null;

    task.status = 'success';
    task.durationMs = durationMs;
    task.qualityScore = qualityScore;

    this.updateAgentMetrics(task.agentName);
    return task;
  }

  /**
   * Mark a task as failed
   */
  failTask(
    taskId: string,
    durationMs: number,
    errorType: string,
    errorMessage: string
  ): TaskRecord | null {
    const task = this.tasks.find(t => t.taskId === taskId && t.status === 'in_progress');
    if (!task) return null;

    task.status = 'failure';
    task.durationMs = durationMs;
    task.errorType = errorType;
    task.errorMessage = errorMessage;

    this.updateAgentMetrics(task.agentName);
    return task;
  }

  /**
   * Get metrics for a specific agent
   */
  getAgentMetrics(agentName: string): AgentMetrics | null {
    return this.agentMetrics.get(agentName) ?? null;
  }

  /**
   * Get metrics for all agents
   */
  getAllAgentMetrics(): AgentMetrics[] {
    return Array.from(this.agentMetrics.values()).sort(
      (a, b) => b.totalTasks - a.totalTasks
    );
  }

  /**
   * Get task history for an agent
   */
  getAgentTaskHistory(
    agentName: string,
    options: {
      limit?: number;
      status?: TaskStatus;
      startTime?: string;
      endTime?: string;
    } = {}
  ): TaskRecord[] {
    let filtered = this.tasks.filter(t => t.agentName === agentName);

    if (options.status) {
      filtered = filtered.filter(t => t.status === options.status);
    }

    if (options.startTime) {
      const start = new Date(options.startTime).getTime();
      filtered = filtered.filter(t => new Date(t.timestamp).getTime() >= start);
    }

    if (options.endTime) {
      const end = new Date(options.endTime).getTime();
      filtered = filtered.filter(t => new Date(t.timestamp).getTime() <= end);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Calculate rankings for all agents
   */
  calculateRankings(): AgentRanking[] {
    const metrics = this.getAllAgentMetrics();
    
    if (metrics.length === 0) return [];

    // Calculate composite score for each agent
    const scored = metrics.map(m => {
      // Score formula: weighted combination of success rate, quality, and efficiency
      const successScore = m.successRate * 40; // 40% weight
      const qualityScore = m.averageQualityScore * 30; // 30% weight
      const efficiencyScore = Math.max(0, 1 - m.averageDurationMs / 60000) * 30; // 30% weight
      const compositeScore = successScore + qualityScore + efficiencyScore;
      
      return {
        agentName: m.agentName,
        score: compositeScore,
        metrics: m,
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Assign ranks
    return scored.map((s, index) => ({
      rank: index + 1,
      agentName: s.agentName,
      score: Math.round(s.score * 100) / 100,
      metrics: s.metrics,
    }));
  }

  /**
   * Analyze performance trends for an agent
   */
  analyzeTrends(
    agentName: string,
    period: 'hourly' | 'daily' | 'weekly' = 'daily',
    dataPoints: number = 7
  ): TrendAnalysis | null {
    const tasks = this.tasks.filter(t => t.agentName === agentName && t.status !== 'in_progress');
    
    if (tasks.length === 0) return null;

    const now = new Date();
    const periodMs = this.getPeriodMs(period);
    const buckets: Map<string, TaskRecord[]> = new Map();

    // Group tasks into time buckets
    for (const task of tasks) {
      const taskTime = new Date(task.timestamp).getTime();
      const bucketIndex = Math.floor((now.getTime() - taskTime) / periodMs);
      
      if (bucketIndex >= 0 && bucketIndex < dataPoints) {
        const bucketKey = `${dataPoints - bucketIndex - 1}`;
        const bucket = buckets.get(bucketKey) ?? [];
        bucket.push(task);
        buckets.set(bucketKey, bucket);
      }
    }

    // Calculate trend points
    const trendData: TrendPoint[] = [];
    for (let i = 0; i < dataPoints; i++) {
      const bucketTasks = buckets.get(`${i}`) ?? [];
      const completedTasks = bucketTasks.filter(t => t.status === 'success' || t.status === 'failure');
      
      if (completedTasks.length > 0) {
        const successes = completedTasks.filter(t => t.status === 'success').length;
        const totalDuration = completedTasks.reduce((sum, t) => sum + t.durationMs, 0);
        const totalQuality = completedTasks.reduce((sum, t) => sum + t.qualityScore, 0);
        
        const bucketTime = new Date(now.getTime() - (dataPoints - i - 1) * periodMs);
        
        trendData.push({
          timestamp: bucketTime.toISOString(),
          successRate: successes / completedTasks.length,
          averageDurationMs: totalDuration / completedTasks.length,
          taskCount: completedTasks.length,
          averageQualityScore: totalQuality / completedTasks.length,
        });
      } else {
        const bucketTime = new Date(now.getTime() - (dataPoints - i - 1) * periodMs);
        trendData.push({
          timestamp: bucketTime.toISOString(),
          successRate: 0,
          averageDurationMs: 0,
          taskCount: 0,
          averageQualityScore: 0,
        });
      }
    }

    // Determine trend direction
    const firstHalf = trendData.slice(0, Math.floor(trendData.length / 2));
    const secondHalf = trendData.slice(Math.floor(trendData.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, p) => sum + p.successRate, 0) / (firstHalf.length || 1);
    const secondAvg = secondHalf.reduce((sum, p) => sum + p.successRate, 0) / (secondHalf.length || 1);
    
    const changePercent = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
    
    let trendDirection: 'improving' | 'declining' | 'stable';
    if (Math.abs(changePercent) < 5) {
      trendDirection = 'stable';
    } else if (changePercent > 0) {
      trendDirection = 'improving';
    } else {
      trendDirection = 'declining';
    }

    return {
      agentName,
      period,
      trendDirection,
      changePercent: Math.round(changePercent * 100) / 100,
      dataPoints: trendData,
    };
  }

  /**
   * Compare performance between two agents
   */
  compareAgents(agentA: string, agentB: string): PerformanceComparison | null {
    const metricsA = this.getAgentMetrics(agentA);
    const metricsB = this.getAgentMetrics(agentB);

    if (!metricsA || !metricsB) return null;

    const successRateDiff = metricsA.successRate - metricsB.successRate;
    const durationDiffMs = metricsA.averageDurationMs - metricsB.averageDurationMs;
    const qualityDiff = metricsA.averageQualityScore - metricsB.averageQualityScore;

    // Calculate overall winner based on weighted score
    const scoreA = metricsA.successRate * 0.4 + (metricsA.averageQualityScore / 100) * 0.3 +
                   Math.max(0, 1 - metricsA.averageDurationMs / 60000) * 0.3;
    const scoreB = metricsB.successRate * 0.4 + (metricsB.averageQualityScore / 100) * 0.3 +
                   Math.max(0, 1 - metricsB.averageDurationMs / 60000) * 0.3;

    return {
      baselineAgent: agentA,
      compareAgent: agentB,
      successRateDiff: Math.round(successRateDiff * 10000) / 10000,
      durationDiffMs: Math.round(durationDiffMs * 100) / 100,
      qualityDiff: Math.round(qualityDiff * 100) / 100,
      overallWinner: scoreA > scoreB ? agentA : agentB,
    };
  }

  /**
   * Get overall performance summary
   */
  getPerformanceSummary(): PerformanceSummary {
    const allMetrics = this.getAllAgentMetrics();
    const rankings = this.calculateRankings();

    if (allMetrics.length === 0) {
      return {
        totalAgents: 0,
        totalTasks: 0,
        overallSuccessRate: 0,
        overallAverageDurationMs: 0,
        overallAverageQualityScore: 0,
        topPerformer: null,
        mostImproved: null,
        rankings: [],
      };
    }

    const totalTasks = allMetrics.reduce((sum, m) => sum + m.totalTasks, 0);
    const totalSuccessful = allMetrics.reduce((sum, m) => sum + m.successfulTasks, 0);
    const totalDuration = allMetrics.reduce((sum, m) => sum + m.totalDurationMs, 0);
    const totalQuality = allMetrics.reduce((sum, m) => sum + m.averageQualityScore * m.totalTasks, 0);

    // Find most improved by analyzing trends
    let mostImproved: string | null = null;
    let bestImprovement = -Infinity;

    for (const metric of allMetrics) {
      const trend = this.analyzeTrends(metric.agentName, 'daily', 7);
      if (trend && trend.changePercent > bestImprovement) {
        bestImprovement = trend.changePercent;
        mostImproved = metric.agentName;
      }
    }

    return {
      totalAgents: allMetrics.length,
      totalTasks,
      overallSuccessRate: totalTasks > 0 ? totalSuccessful / totalTasks : 0,
      overallAverageDurationMs: totalTasks > 0 ? totalDuration / totalTasks : 0,
      overallAverageQualityScore: totalTasks > 0 ? totalQuality / totalTasks : 0,
      topPerformer: rankings[0]?.agentName ?? null,
      mostImproved,
      rankings,
    };
  }

  /**
   * Get error breakdown for an agent
   */
  getErrorBreakdown(agentName: string): Array<{ errorType: string; count: number; percentage: number }> {
    const failedTasks = this.tasks.filter(
      t => t.agentName === agentName && t.status === 'failure' && t.errorType
    );

    if (failedTasks.length === 0) return [];

    const errorCounts = new Map<string, number>();
    for (const task of failedTasks) {
      const errorType = task.errorType ?? 'Unknown';
      errorCounts.set(errorType, (errorCounts.get(errorType) ?? 0) + 1);
    }

    const total = failedTasks.length;
    return Array.from(errorCounts.entries())
      .map(([errorType, count]) => ({
        errorType,
        count,
        percentage: Math.round((count / total) * 10000) / 100,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Clear all records and metrics
   */
  clear(): void {
    this.tasks = [];
    this.agentMetrics.clear();
  }

  /**
   * Get raw task count
   */
  getTaskCount(): number {
    return this.tasks.length;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private updateAgentMetrics(agentName: string): void {
    const agentTasks = this.tasks.filter(t => t.agentName === agentName);
    const completedTasks = agentTasks.filter(t => t.status === 'success' || t.status === 'failure');

    if (completedTasks.length === 0) {
      // Still create a metrics entry for in-progress tasks
      const inProgressTasks = agentTasks.filter(t => t.status === 'in_progress');
      if (inProgressTasks.length > 0) {
        const firstTask = inProgressTasks[0];
        this.agentMetrics.set(agentName, {
          agentName,
          totalTasks: 0,
          successfulTasks: 0,
          failedTasks: 0,
          successRate: 0,
          errorRate: 0,
          averageDurationMs: 0,
          averageQualityScore: 0,
          totalDurationMs: 0,
          lastActiveAt: firstTask.timestamp,
          firstTaskAt: firstTask.timestamp,
        });
      }
      return;
    }

    const successfulTasks = completedTasks.filter(t => t.status === 'success');
    const failedTasks = completedTasks.filter(t => t.status === 'failure');

    const totalDuration = completedTasks.reduce((sum, t) => sum + t.durationMs, 0);
    const totalQuality = successfulTasks.reduce((sum, t) => sum + t.qualityScore, 0);

    // Sort by timestamp to get first and last
    const sorted = [...completedTasks].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    this.agentMetrics.set(agentName, {
      agentName,
      totalTasks: completedTasks.length,
      successfulTasks: successfulTasks.length,
      failedTasks: failedTasks.length,
      successRate: successfulTasks.length / completedTasks.length,
      errorRate: failedTasks.length / completedTasks.length,
      averageDurationMs: totalDuration / completedTasks.length,
      averageQualityScore: successfulTasks.length > 0 ? totalQuality / successfulTasks.length : 0,
      totalDurationMs: totalDuration,
      lastActiveAt: sorted[sorted.length - 1].timestamp,
      firstTaskAt: sorted[0].timestamp,
    });
  }

  private getPeriodMs(period: 'hourly' | 'daily' | 'weekly'): number {
    switch (period) {
      case 'hourly':
        return 60 * 60 * 1000; // 1 hour
      case 'daily':
        return 24 * 60 * 60 * 1000; // 1 day
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000; // 1 week
      default:
        return 24 * 60 * 60 * 1000;
    }
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let trackerInstance: PerformanceTracker | null = null;

export function getPerformanceTracker(): PerformanceTracker {
  if (!trackerInstance) {
    trackerInstance = new PerformanceTracker();
  }
  return trackerInstance;
}

export function resetPerformanceTracker(): void {
  trackerInstance = null;
}

export function createPerformanceTracker(options?: { maxRecords?: number }): PerformanceTracker {
  return new PerformanceTracker(options);
}
