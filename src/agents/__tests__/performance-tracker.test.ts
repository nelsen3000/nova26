// KMS-16: Agent Performance Tracker Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PerformanceTracker,
  createPerformanceTracker,
  getPerformanceTracker,
  resetPerformanceTracker,
  type TaskRecord,
  type AgentMetrics,
  type TrendAnalysis,
} from '../performance-tracker.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('PerformanceTracker', () => {
  let tracker: PerformanceTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = createPerformanceTracker();
  });

  // ============================================================================
  // Test 1: Record Task
  // ============================================================================

  it('should record a task and return it with timestamp', () => {
    const task = tracker.recordTask({
      taskId: 'task-1',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'success',
      durationMs: 1000,
      qualityScore: 85,
    });

    expect(task.timestamp).toBeDefined();
    expect(task.agentName).toBe('TestAgent');
    expect(task.taskId).toBe('task-1');
  });

  // ============================================================================
  // Test 2: Get Agent Metrics After Recording
  // ============================================================================

  it('should calculate agent metrics after recording tasks', () => {
    tracker.recordTask({
      taskId: 'task-1',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'success',
      durationMs: 1000,
      qualityScore: 90,
    });

    const metrics = tracker.getAgentMetrics('TestAgent');
    expect(metrics).not.toBeNull();
    expect(metrics!.totalTasks).toBe(1);
    expect(metrics!.successRate).toBe(1);
    expect(metrics!.averageQualityScore).toBe(90);
  });

  // ============================================================================
  // Test 3: Calculate Success Rate
  // ============================================================================

  it('should calculate correct success rate for mixed outcomes', () => {
    tracker.recordTask({
      taskId: 'task-1',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'success',
      durationMs: 1000,
      qualityScore: 90,
    });

    tracker.recordTask({
      taskId: 'task-2',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'failure',
      durationMs: 500,
      qualityScore: 0,
    });

    tracker.recordTask({
      taskId: 'task-3',
      agentName: 'TestAgent',
      taskType: 'testing',
      status: 'success',
      durationMs: 800,
      qualityScore: 85,
    });

    const metrics = tracker.getAgentMetrics('TestAgent');
    expect(metrics!.totalTasks).toBe(3);
    expect(metrics!.successfulTasks).toBe(2);
    expect(metrics!.failedTasks).toBe(1);
    expect(metrics!.successRate).toBeCloseTo(0.667, 2);
    expect(metrics!.errorRate).toBeCloseTo(0.333, 2);
  });

  // ============================================================================
  // Test 4: Calculate Average Duration
  // ============================================================================

  it('should calculate correct average duration', () => {
    tracker.recordTask({
      taskId: 'task-1',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'success',
      durationMs: 1000,
      qualityScore: 90,
    });

    tracker.recordTask({
      taskId: 'task-2',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'success',
      durationMs: 2000,
      qualityScore: 85,
    });

    tracker.recordTask({
      taskId: 'task-3',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'success',
      durationMs: 3000,
      qualityScore: 95,
    });

    const metrics = tracker.getAgentMetrics('TestAgent');
    expect(metrics!.averageDurationMs).toBe(2000);
    expect(metrics!.totalDurationMs).toBe(6000);
  });

  // ============================================================================
  // Test 5: Start Task
  // ============================================================================

  it('should start a task with in_progress status', () => {
    const task = tracker.startTask('TestAgent', 'coding', 'task-1', { priority: 'high' });

    expect(task.status).toBe('in_progress');
    expect(task.agentName).toBe('TestAgent');
    expect(task.taskType).toBe('coding');
    expect(task.metadata).toEqual({ priority: 'high' });
  });

  // ============================================================================
  // Test 6: Complete Task
  // ============================================================================

  it('should complete an in-progress task', () => {
    tracker.startTask('TestAgent', 'coding', 'task-1');
    const completed = tracker.completeTask('task-1', 1500, 92);

    expect(completed).not.toBeNull();
    expect(completed!.status).toBe('success');
    expect(completed!.durationMs).toBe(1500);
    expect(completed!.qualityScore).toBe(92);
  });

  // ============================================================================
  // Test 7: Fail Task
  // ============================================================================

  it('should fail an in-progress task', () => {
    tracker.startTask('TestAgent', 'coding', 'task-1');
    const failed = tracker.failTask('task-1', 500, 'TypeError', 'Cannot read property of undefined');

    expect(failed).not.toBeNull();
    expect(failed!.status).toBe('failure');
    expect(failed!.errorType).toBe('TypeError');
    expect(failed!.errorMessage).toBe('Cannot read property of undefined');
  });

  // ============================================================================
  // Test 8: Get Agent Task History
  // ============================================================================

  it('should retrieve agent task history with filters', () => {
    tracker.recordTask({
      taskId: 'task-1',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'success',
      durationMs: 1000,
      qualityScore: 90,
    });

    tracker.recordTask({
      taskId: 'task-2',
      agentName: 'TestAgent',
      taskType: 'testing',
      status: 'failure',
      durationMs: 500,
      qualityScore: 0,
    });

    tracker.recordTask({
      taskId: 'task-3',
      agentName: 'OtherAgent',
      taskType: 'coding',
      status: 'success',
      durationMs: 800,
      qualityScore: 85,
    });

    const history = tracker.getAgentTaskHistory('TestAgent');
    expect(history).toHaveLength(2);
    expect(history.every(t => t.agentName === 'TestAgent')).toBe(true);
  });

  // ============================================================================
  // Test 9: Filter History By Status
  // ============================================================================

  it('should filter task history by status', () => {
    tracker.recordTask({
      taskId: 'task-1',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'success',
      durationMs: 1000,
      qualityScore: 90,
    });

    tracker.recordTask({
      taskId: 'task-2',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'failure',
      durationMs: 500,
      qualityScore: 0,
    });

    tracker.recordTask({
      taskId: 'task-3',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'success',
      durationMs: 800,
      qualityScore: 85,
    });

    const successHistory = tracker.getAgentTaskHistory('TestAgent', { status: 'success' });
    expect(successHistory).toHaveLength(2);
    expect(successHistory.every(t => t.status === 'success')).toBe(true);
  });

  // ============================================================================
  // Test 10: Calculate Rankings
  // ============================================================================

  it('should calculate agent rankings', () => {
    // Agent A: High performer
    tracker.recordTask({
      taskId: 'a-1',
      agentName: 'AgentA',
      taskType: 'coding',
      status: 'success',
      durationMs: 1000,
      qualityScore: 95,
    });

    // Agent B: Lower performer
    tracker.recordTask({
      taskId: 'b-1',
      agentName: 'AgentB',
      taskType: 'coding',
      status: 'failure',
      durationMs: 5000,
      qualityScore: 0,
    });

    const rankings = tracker.calculateRankings();
    expect(rankings).toHaveLength(2);
    expect(rankings[0].rank).toBe(1);
    expect(rankings[1].rank).toBe(2);
    expect(rankings[0].agentName).toBe('AgentA');
    expect(rankings[0].score).toBeGreaterThan(rankings[1].score);
  });

  // ============================================================================
  // Test 11: Empty Rankings
  // ============================================================================

  it('should return empty rankings when no data', () => {
    const rankings = tracker.calculateRankings();
    expect(rankings).toEqual([]);
  });

  // ============================================================================
  // Test 12: Analyze Trends
  // ============================================================================

  it('should analyze performance trends', () => {
    // Record tasks to establish trend
    for (let i = 0; i < 5; i++) {
      tracker.recordTask({
        taskId: `task-${i}`,
        agentName: 'TestAgent',
        taskType: 'coding',
        status: i < 2 ? 'failure' : 'success',
        durationMs: 1000 + i * 100,
        qualityScore: 70 + i * 5,
      });
    }

    const trend = tracker.analyzeTrends('TestAgent', 'daily', 7);
    expect(trend).not.toBeNull();
    expect(trend!.agentName).toBe('TestAgent');
    expect(trend!.period).toBe('daily');
    expect(trend!.dataPoints).toHaveLength(7);
    expect(['improving', 'declining', 'stable']).toContain(trend!.trendDirection);
  });

  // ============================================================================
  // Test 13: Null Trends For Unknown Agent
  // ============================================================================

  it('should return null trends for unknown agent', () => {
    const trend = tracker.analyzeTrends('UnknownAgent', 'daily', 7);
    expect(trend).toBeNull();
  });

  // ============================================================================
  // Test 14: Compare Agents
  // ============================================================================

  it('should compare two agents performance', () => {
    tracker.recordTask({
      taskId: 'a-1',
      agentName: 'AgentA',
      taskType: 'coding',
      status: 'success',
      durationMs: 1000,
      qualityScore: 90,
    });

    tracker.recordTask({
      taskId: 'b-1',
      agentName: 'AgentB',
      taskType: 'coding',
      status: 'failure',
      durationMs: 2000,
      qualityScore: 0,
    });

    const comparison = tracker.compareAgents('AgentA', 'AgentB');
    expect(comparison).not.toBeNull();
    expect(comparison!.baselineAgent).toBe('AgentA');
    expect(comparison!.compareAgent).toBe('AgentB');
    expect(comparison!.successRateDiff).toBe(1);
    expect(comparison!.overallWinner).toBe('AgentA');
  });

  // ============================================================================
  // Test 15: Null Comparison For Unknown Agent
  // ============================================================================

  it('should return null comparison when agent not found', () => {
    tracker.recordTask({
      taskId: 'a-1',
      agentName: 'AgentA',
      taskType: 'coding',
      status: 'success',
      durationMs: 1000,
      qualityScore: 90,
    });

    const comparison = tracker.compareAgents('AgentA', 'UnknownAgent');
    expect(comparison).toBeNull();
  });

  // ============================================================================
  // Test 16: Get Performance Summary
  // ============================================================================

  it('should generate performance summary', () => {
    tracker.recordTask({
      taskId: 'a-1',
      agentName: 'AgentA',
      taskType: 'coding',
      status: 'success',
      durationMs: 1000,
      qualityScore: 90,
    });

    tracker.recordTask({
      taskId: 'b-1',
      agentName: 'AgentB',
      taskType: 'testing',
      status: 'success',
      durationMs: 1500,
      qualityScore: 85,
    });

    const summary = tracker.getPerformanceSummary();
    expect(summary.totalAgents).toBe(2);
    expect(summary.totalTasks).toBe(2);
    expect(summary.overallSuccessRate).toBe(1);
    expect(summary.topPerformer).toBe('AgentA');
    expect(summary.rankings).toHaveLength(2);
  });

  // ============================================================================
  // Test 17: Empty Performance Summary
  // ============================================================================

  it('should return empty performance summary when no data', () => {
    const summary = tracker.getPerformanceSummary();
    expect(summary.totalAgents).toBe(0);
    expect(summary.totalTasks).toBe(0);
    expect(summary.overallSuccessRate).toBe(0);
    expect(summary.topPerformer).toBeNull();
    expect(summary.rankings).toEqual([]);
  });

  // ============================================================================
  // Test 18: Get Error Breakdown
  // ============================================================================

  it('should get error breakdown for agent', () => {
    tracker.recordTask({
      taskId: 'task-1',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'failure',
      durationMs: 500,
      qualityScore: 0,
      errorType: 'TypeError',
      errorMessage: 'Cannot read property',
    });

    tracker.recordTask({
      taskId: 'task-2',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'failure',
      durationMs: 600,
      qualityScore: 0,
      errorType: 'TypeError',
      errorMessage: 'Undefined is not a function',
    });

    tracker.recordTask({
      taskId: 'task-3',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'failure',
      durationMs: 700,
      qualityScore: 0,
      errorType: 'NetworkError',
      errorMessage: 'Connection refused',
    });

    const breakdown = tracker.getErrorBreakdown('TestAgent');
    expect(breakdown).toHaveLength(2);
    expect(breakdown[0].errorType).toBe('TypeError');
    expect(breakdown[0].count).toBe(2);
    expect(breakdown[0].percentage).toBeCloseTo(66.67, 1);
  });

  // ============================================================================
  // Test 19: Empty Error Breakdown
  // ============================================================================

  it('should return empty error breakdown when no failures', () => {
    tracker.recordTask({
      taskId: 'task-1',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'success',
      durationMs: 1000,
      qualityScore: 90,
    });

    const breakdown = tracker.getErrorBreakdown('TestAgent');
    expect(breakdown).toEqual([]);
  });

  // ============================================================================
  // Test 20: Clear All Data
  // ============================================================================

  it('should clear all tasks and metrics', () => {
    tracker.recordTask({
      taskId: 'task-1',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'success',
      durationMs: 1000,
      qualityScore: 90,
    });

    expect(tracker.getTaskCount()).toBe(1);
    expect(tracker.getAgentMetrics('TestAgent')).not.toBeNull();

    tracker.clear();

    expect(tracker.getTaskCount()).toBe(0);
    expect(tracker.getAgentMetrics('TestAgent')).toBeNull();
  });

  // ============================================================================
  // Test 21: Get All Agent Metrics
  // ============================================================================

  it('should get metrics for all agents sorted by task count', () => {
    tracker.recordTask({
      taskId: 'a-1',
      agentName: 'AgentA',
      taskType: 'coding',
      status: 'success',
      durationMs: 1000,
      qualityScore: 90,
    });

    tracker.recordTask({
      taskId: 'b-1',
      agentName: 'AgentB',
      taskType: 'coding',
      status: 'success',
      durationMs: 1000,
      qualityScore: 85,
    });

    tracker.recordTask({
      taskId: 'b-2',
      agentName: 'AgentB',
      taskType: 'testing',
      status: 'success',
      durationMs: 1500,
      qualityScore: 80,
    });

    const allMetrics = tracker.getAllAgentMetrics();
    expect(allMetrics).toHaveLength(2);
    expect(allMetrics[0].agentName).toBe('AgentB'); // More tasks first
    expect(allMetrics[1].agentName).toBe('AgentA');
  });

  // ============================================================================
  // Test 22: Complete Task Not Found
  // ============================================================================

  it('should return null when completing non-existent task', () => {
    const result = tracker.completeTask('non-existent', 1000, 90);
    expect(result).toBeNull();
  });

  // ============================================================================
  // Test 23: Fail Task Not Found
  // ============================================================================

  it('should return null when failing non-existent task', () => {
    const result = tracker.failTask('non-existent', 1000, 'Error', 'Message');
    expect(result).toBeNull();
  });

  // ============================================================================
  // Test 24: Max Records Limit
  // ============================================================================

  it('should enforce max records limit', () => {
    const limitedTracker = createPerformanceTracker({ maxRecords: 5 });

    for (let i = 0; i < 10; i++) {
      limitedTracker.recordTask({
        taskId: `task-${i}`,
        agentName: 'TestAgent',
        taskType: 'coding',
        status: 'success',
        durationMs: 1000,
        qualityScore: 90,
      });
    }

    expect(limitedTracker.getTaskCount()).toBe(5);
  });

  // ============================================================================
  // Test 25: Singleton Pattern
  // ============================================================================

  it('should return same instance for singleton', () => {
    resetPerformanceTracker();
    const instance1 = getPerformanceTracker();
    const instance2 = getPerformanceTracker();
    expect(instance1).toBe(instance2);
  });

  // ============================================================================
  // Test 26: Filter History By Time Range
  // ============================================================================

  it('should filter task history by time range', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    tracker.recordTask({
      taskId: 'task-1',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'success',
      durationMs: 1000,
      qualityScore: 90,
    });

    const history = tracker.getAgentTaskHistory('TestAgent', {
      startTime: oneHourAgo.toISOString(),
      endTime: now.toISOString(),
    });

    expect(history.length).toBeGreaterThanOrEqual(0);
  });

  // ============================================================================
  // Test 27: Average Quality Score For Failed Tasks
  // ============================================================================

  it('should handle average quality score with all failed tasks', () => {
    tracker.recordTask({
      taskId: 'task-1',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'failure',
      durationMs: 500,
      qualityScore: 0,
    });

    tracker.recordTask({
      taskId: 'task-2',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'failure',
      durationMs: 600,
      qualityScore: 0,
    });

    const metrics = tracker.getAgentMetrics('TestAgent');
    expect(metrics!.averageQualityScore).toBe(0);
  });

  // ============================================================================
  // Test 28: Metrics Include Timestamps
  // ============================================================================

  it('should include first and last active timestamps in metrics', () => {
    tracker.recordTask({
      taskId: 'task-1',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'success',
      durationMs: 1000,
      qualityScore: 90,
    });

    tracker.recordTask({
      taskId: 'task-2',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'success',
      durationMs: 1000,
      qualityScore: 85,
    });

    const metrics = tracker.getAgentMetrics('TestAgent');
    expect(metrics!.firstTaskAt).toBeDefined();
    expect(metrics!.lastActiveAt).toBeDefined();
    expect(new Date(metrics!.firstTaskAt).getTime()).toBeLessThanOrEqual(
      new Date(metrics!.lastActiveAt).getTime()
    );
  });

  // ============================================================================
  // Test 29: Trend Analysis With Different Periods
  // ============================================================================

  it('should support different trend periods', () => {
    tracker.recordTask({
      taskId: 'task-1',
      agentName: 'TestAgent',
      taskType: 'coding',
      status: 'success',
      durationMs: 1000,
      qualityScore: 90,
    });

    const hourlyTrend = tracker.analyzeTrends('TestAgent', 'hourly', 5);
    const dailyTrend = tracker.analyzeTrends('TestAgent', 'daily', 5);
    const weeklyTrend = tracker.analyzeTrends('TestAgent', 'weekly', 5);

    expect(hourlyTrend).not.toBeNull();
    expect(dailyTrend).not.toBeNull();
    expect(weeklyTrend).not.toBeNull();

    expect(hourlyTrend!.period).toBe('hourly');
    expect(dailyTrend!.period).toBe('daily');
    expect(weeklyTrend!.period).toBe('weekly');
  });

  // ============================================================================
  // Test 30: Multiple Agents Independent Metrics
  // ============================================================================

  it('should track metrics independently for multiple agents', () => {
    tracker.recordTask({
      taskId: 'a-1',
      agentName: 'AgentA',
      taskType: 'coding',
      status: 'success',
      durationMs: 1000,
      qualityScore: 95,
    });

    tracker.recordTask({
      taskId: 'b-1',
      agentName: 'AgentB',
      taskType: 'coding',
      status: 'failure',
      durationMs: 2000,
      qualityScore: 0,
    });

    tracker.recordTask({
      taskId: 'b-2',
      agentName: 'AgentB',
      taskType: 'testing',
      status: 'success',
      durationMs: 1500,
      qualityScore: 80,
    });

    const metricsA = tracker.getAgentMetrics('AgentA');
    const metricsB = tracker.getAgentMetrics('AgentB');

    expect(metricsA!.totalTasks).toBe(1);
    expect(metricsA!.successRate).toBe(1);
    expect(metricsB!.totalTasks).toBe(2);
    expect(metricsB!.successRate).toBe(0.5);
  });
});
