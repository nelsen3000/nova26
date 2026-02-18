// Reflection Summary Generator Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  generateReflection,
  formatReflection,
  generateRecommendations,
  getFailedTasks,
  getEventsBySession,
  type ReflectionSummary,
} from './reflection.js';
import { createEventStore } from '../orchestrator/event-store.js';
import { recordTaskResult, resetAnalytics } from './agent-analytics.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';

// Mock dependencies
const TEST_EVENTS_DIR = join(process.cwd(), '.nova', 'events');

// Clean up test data
function cleanTestData() {
  if (existsSync(TEST_EVENTS_DIR)) {
    rmSync(TEST_EVENTS_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_EVENTS_DIR, { recursive: true });
}

beforeEach(() => {
  cleanTestData();
  resetAnalytics();
});

afterEach(() => {
  cleanTestData();
  resetAnalytics();
});

describe('generateReflection', () => {
  it('should return a complete reflection summary', async () => {
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    // Add some events
    store.emit('task_start', { title: 'Test Task' }, 'task-1', 'MARS');
    store.emit('task_complete', { output: 'success' }, 'task-1', 'MARS');

    const summary = await generateReflection(sessionId);

    expect(summary).toHaveProperty('sessionId', sessionId);
    expect(summary).toHaveProperty('timestamp');
    expect(summary).toHaveProperty('whatWorkedWell');
    expect(summary).toHaveProperty('whatFailed');
    expect(summary).toHaveProperty('agentHighlights');
    expect(summary).toHaveProperty('recommendations');
    expect(summary).toHaveProperty('costSummary');
    expect(summary).toHaveProperty('overallAssessment');
    expect(['excellent', 'good', 'mixed', 'poor']).toContain(summary.overallAssessment);
  });

  it('should include session ID in summary', async () => {
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);
    expect(summary.sessionId).toBe(sessionId);
  });

  it('should include valid timestamp', async () => {
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);
    const timestamp = new Date(summary.timestamp);
    expect(timestamp).toBeInstanceOf(Date);
    expect(!isNaN(timestamp.getTime())).toBe(true);
  });

  it('should extract successful patterns from session memory', async () => {
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    // Record successful task
    recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0);

    const summary = await generateReflection(sessionId);
    expect(summary.whatWorkedWell).toBeInstanceOf(Array);
  });

  it('should handle sessions with no events gracefully', async () => {
    // Create a store but don't add any events
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);
    expect(summary.whatFailed).toEqual([]);
    expect(summary.agentHighlights).toEqual([]);
    expect(summary.whatWorkedWell.length).toBeGreaterThanOrEqual(0);
  });

  it('should include cost summary with all required fields', async () => {
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);
    expect(summary.costSummary).toHaveProperty('totalCost');
    expect(summary.costSummary).toHaveProperty('totalTokens');
    expect(summary.costSummary).toHaveProperty('taskCount');
    expect(summary.costSummary).toHaveProperty('avgCostPerTask');
    expect(typeof summary.costSummary.totalCost).toBe('number');
    expect(typeof summary.costSummary.totalTokens).toBe('number');
    expect(typeof summary.costSummary.taskCount).toBe('number');
    expect(typeof summary.costSummary.avgCostPerTask).toBe('number');
  });
});

describe('whatWorkedWell extraction', () => {
  it('should extract high-confidence patterns', async () => {
    // Record successful tasks to create patterns
    recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0);
    recordTaskResult('MARS', 'task-2', true, 1000, 2000, 0);
    recordTaskResult('MARS', 'task-3', true, 1000, 2000, 0);

    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);

    // Should have patterns for high-performing agent
    const marsPatterns = summary.whatWorkedWell.filter(w => w.includes('MARS'));
    expect(marsPatterns.length).toBeGreaterThan(0);
  });

  it('should include agent success rate patterns', async () => {
    recordTaskResult('VENUS', 'task-1', true, 1000, 2000, 0);
    recordTaskResult('VENUS', 'task-2', true, 1000, 2000, 0);
    recordTaskResult('VENUS', 'task-3', true, 1000, 2000, 0);

    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);

    const venusPatterns = summary.whatWorkedWell.filter(w => w.includes('VENUS'));
    expect(venusPatterns.some(w => w.includes('100%'))).toBe(true);
  });

  it('should deduplicate patterns', async () => {
    // Record many tasks to potentially create duplicates
    for (let i = 0; i < 10; i++) {
      recordTaskResult('MARS', `task-${i}`, true, 1000, 2000, 0);
    }

    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);

    // Check for duplicates
    const uniquePatterns = new Set(summary.whatWorkedWell);
    expect(uniquePatterns.size).toBe(summary.whatWorkedWell.length);
  });

  it('should limit patterns to maximum of 8', async () => {
    // Record many tasks with different agents
    const agents = ['MARS', 'VENUS', 'PLUTO', 'EARTH', 'MERCURY'];
    for (const agent of agents) {
      for (let i = 0; i < 5; i++) {
        recordTaskResult(agent, `task-${agent}-${i}`, true, 1000, 2000, 0);
      }
    }

    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);
    expect(summary.whatWorkedWell.length).toBeLessThanOrEqual(8);
  });
});

describe('whatFailed extraction', () => {
  it('should extract failed tasks from event store', async () => {
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    store.emit('task_start', { title: 'Failing Task' }, 'task-1', 'VENUS');
    store.emit('task_fail', { error: 'TypeScript compilation failed' }, 'task-1', 'VENUS');

    const summary = await generateReflection(sessionId);

    expect(summary.whatFailed).toHaveLength(1);
    expect(summary.whatFailed[0].task).toBe('task-1');
    expect(summary.whatFailed[0].agent).toBe('VENUS');
    expect(summary.whatFailed[0].reason).toContain('TypeScript');
  });

  it('should extract multiple failures', async () => {
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    store.emit('task_fail', { error: 'Error 1' }, 'task-1', 'MARS');
    store.emit('task_fail', { error: 'Error 2' }, 'task-2', 'VENUS');
    store.emit('task_fail', { error: 'Error 3' }, 'task-3', 'PLUTO');

    const summary = await generateReflection(sessionId);

    expect(summary.whatFailed).toHaveLength(3);
  });

  it('should include gate failure context', async () => {
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    store.emit('task_start', {}, 'task-1', 'MARS');
    store.emit('task_fail', { error: 'Validation failed' }, 'task-1', 'MARS');
    store.emit('gate_fail', { gate: 'typescript-check' }, 'task-1', 'MARS');

    const summary = await generateReflection(sessionId);

    const failure = summary.whatFailed.find(f => f.task === 'task-1');
    expect(failure).toBeDefined();
  });

  it('should handle long error messages', async () => {
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const longError = 'A'.repeat(500);
    store.emit('task_fail', { error: longError }, 'task-1', 'MARS');

    const summary = await generateReflection(sessionId);

    expect(summary.whatFailed[0].reason.length).toBeLessThanOrEqual(103); // 100 + '...'
  });

  it('should handle unknown failure reasons', async () => {
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    store.emit('task_fail', {}, 'task-1', 'MARS');

    const summary = await generateReflection(sessionId);

    expect(summary.whatFailed[0].reason).toBe('Unknown failure reason');
  });
});

describe('agent highlights calculation', () => {
  it('should generate highlights for all agents', async () => {
    recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0);
    recordTaskResult('VENUS', 'task-2', true, 1000, 2000, 0);

    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);

    expect(summary.agentHighlights.length).toBeGreaterThanOrEqual(2);
  });

  it('should sort agents by success rate', async () => {
    // MARS: 100% success
    recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0);
    recordTaskResult('MARS', 'task-2', true, 1000, 2000, 0);

    // VENUS: 50% success
    recordTaskResult('VENUS', 'task-3', true, 1000, 2000, 0);
    recordTaskResult('VENUS', 'task-4', false, 1000, 2000, 0);

    // PLUTO: 0% success
    recordTaskResult('PLUTO', 'task-5', false, 1000, 2000, 0);

    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);

    expect(summary.agentHighlights[0].agent).toBe('MARS');
    expect(summary.agentHighlights[0].successRate).toBe(1);
  });

  it('should include success rate and duration in highlights', async () => {
    // Record sufficient data for MARS to appear in highlights
    recordTaskResult('MARS', 'task-1', true, 1000, 2500, 0);
    recordTaskResult('MARS', 'task-2', true, 1200, 2600, 0);

    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);

    // Verify MARS is in highlights
    const mars = summary.agentHighlights.find(h => h.agent === 'MARS');
    expect(mars).toBeDefined();
    if (mars) {
      expect(mars.successRate).toBe(1);
      expect(mars.avgDuration).toBeGreaterThan(0);
      expect(mars.highlight).toBeDefined();
    }
  });

  it('should generate appropriate highlight messages', async () => {
    // High performer
    recordTaskResult('EXCELLENT', 'task-1', true, 1000, 2000, 0);
    recordTaskResult('EXCELLENT', 'task-2', true, 1000, 2000, 0);

    // Low performer
    recordTaskResult('POOR', 'task-3', false, 1000, 2000, 0);

    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);

    // Verify highlights exist and contain expected data
    expect(summary.agentHighlights.length).toBeGreaterThanOrEqual(2);
    
    const excellent = summary.agentHighlights.find(h => h.agent === 'EXCELLENT');
    const poor = summary.agentHighlights.find(h => h.agent === 'POOR');

    // Both agents should be present with highlights
    expect(excellent).toBeDefined();
    expect(poor).toBeDefined();
    
    // Excellent performer should have high success rate
    expect(excellent!.successRate).toBe(1); // 100% success
    
    // Poor performer should have low success rate  
    expect(poor!.successRate).toBe(0); // 0% success
    
    // Verify highlights contain appropriate messaging
    expect(excellent!.highlight.length).toBeGreaterThan(0);
    expect(poor!.highlight.length).toBeGreaterThan(0);
  });

  it('should only include agents with task data', async () => {
    recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0);

    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);

    // Should only include MARS, not other agents with no data
    const agentNames = summary.agentHighlights.map(h => h.agent);
    expect(agentNames).toContain('MARS');
    expect(agentNames).not.toContain('UNKNOWN_AGENT');
  });
});

describe('recommendations generation', () => {
  it('should generate recommendations for high failure rates', () => {
    const summary: ReflectionSummary = {
      sessionId: 'test',
      timestamp: new Date().toISOString(),
      whatWorkedWell: [],
      whatFailed: [
        { task: 't1', reason: 'error', agent: 'MARS' },
        { task: 't2', reason: 'error', agent: 'MARS' },
        { task: 't3', reason: 'error', agent: 'MARS' },
      ],
      agentHighlights: [],
      recommendations: [],
      costSummary: {
        totalCost: 1,
        totalTokens: 1000,
        taskCount: 10,
        avgCostPerTask: 0.1,
      },
      overallAssessment: 'mixed',
    };

    const recommendations = generateRecommendations(summary);
    expect(recommendations.some(r => r.includes('MARS'))).toBe(true);
  });

  it('should recommend for low-performing agents', () => {
    const summary: ReflectionSummary = {
      sessionId: 'test',
      timestamp: new Date().toISOString(),
      whatWorkedWell: [],
      whatFailed: [],
      agentHighlights: [
        { agent: 'BAD_AGENT', successRate: 0.3, avgDuration: 2000, highlight: '' },
      ],
      recommendations: [],
      costSummary: {
        totalCost: 1,
        totalTokens: 1000,
        taskCount: 10,
        avgCostPerTask: 0.1,
      },
      overallAssessment: 'poor',
    };

    const recommendations = generateRecommendations(summary);
    expect(recommendations.some(r => r.includes('BAD_AGENT'))).toBe(true);
  });

  it('should recommend cost optimizations for high costs', () => {
    const summary: ReflectionSummary = {
      sessionId: 'test',
      timestamp: new Date().toISOString(),
      whatWorkedWell: [],
      whatFailed: [],
      agentHighlights: [],
      recommendations: [],
      costSummary: {
        totalCost: 15,
        totalTokens: 10000,
        taskCount: 10,
        avgCostPerTask: 1.5,
      },
      overallAssessment: 'mixed',
    };

    const recommendations = generateRecommendations(summary);
    expect(recommendations.some(r => r.toLowerCase().includes('cost'))).toBe(true);
  });

  it('should leverage top performers', () => {
    const summary: ReflectionSummary = {
      sessionId: 'test',
      timestamp: new Date().toISOString(),
      whatWorkedWell: [],
      whatFailed: [],
      agentHighlights: [
        { agent: 'STAR', successRate: 1.0, avgDuration: 2000, highlight: '' },
      ],
      recommendations: [],
      costSummary: {
        totalCost: 1,
        totalTokens: 1000,
        taskCount: 10,
        avgCostPerTask: 0.1,
      },
      overallAssessment: 'excellent',
    };

    const recommendations = generateRecommendations(summary);
    expect(recommendations.some(r => r.includes('STAR'))).toBe(true);
  });

  it('should limit recommendations to 6', () => {
    const summary: ReflectionSummary = {
      sessionId: 'test',
      timestamp: new Date().toISOString(),
      whatWorkedWell: [],
      whatFailed: [],
      agentHighlights: [
        { agent: 'A1', successRate: 0.1, avgDuration: 2000, highlight: '' },
        { agent: 'A2', successRate: 0.1, avgDuration: 2000, highlight: '' },
        { agent: 'A3', successRate: 0.1, avgDuration: 2000, highlight: '' },
        { agent: 'A4', successRate: 0.1, avgDuration: 2000, highlight: '' },
        { agent: 'A5', successRate: 0.1, avgDuration: 2000, highlight: '' },
        { agent: 'A6', successRate: 0.1, avgDuration: 2000, highlight: '' },
        { agent: 'A7', successRate: 0.1, avgDuration: 2000, highlight: '' },
      ],
      recommendations: [],
      costSummary: {
        totalCost: 20,
        totalTokens: 1000,
        taskCount: 10,
        avgCostPerTask: 2.0,
      },
      overallAssessment: 'poor',
    };

    const recommendations = generateRecommendations(summary);
    expect(recommendations.length).toBeLessThanOrEqual(6);
  });

  it('should deduplicate recommendations', () => {
    const summary: ReflectionSummary = {
      sessionId: 'test',
      timestamp: new Date().toISOString(),
      whatWorkedWell: [],
      whatFailed: [
        { task: 't1', reason: 'error', agent: 'MARS' },
        { task: 't2', reason: 'error', agent: 'MARS' },
        { task: 't3', reason: 'error', agent: 'MARS' },
      ],
      agentHighlights: [
        { agent: 'MARS', successRate: 0.5, avgDuration: 2000, highlight: '' },
      ],
      recommendations: [],
      costSummary: {
        totalCost: 1,
        totalTokens: 1000,
        taskCount: 10,
        avgCostPerTask: 0.1,
      },
      overallAssessment: 'mixed',
    };

    const recommendations = generateRecommendations(summary);
    const uniqueRecommendations = [...new Set(recommendations)];
    expect(uniqueRecommendations.length).toBe(recommendations.length);
  });
});

describe('cost summary aggregation', () => {
  it('should calculate average cost per task', async () => {
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);

    const expectedAvg = summary.costSummary.taskCount > 0
      ? summary.costSummary.totalCost / summary.costSummary.taskCount
      : 0;
    expect(summary.costSummary.avgCostPerTask).toBe(expectedAvg);
  });

  it('should have non-negative cost values', async () => {
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);

    expect(summary.costSummary.totalCost).toBeGreaterThanOrEqual(0);
    expect(summary.costSummary.totalTokens).toBeGreaterThanOrEqual(0);
    expect(summary.costSummary.avgCostPerTask).toBeGreaterThanOrEqual(0);
  });

  it('should have positive task count', async () => {
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    // Add some events to indicate tasks
    store.emit('llm_call_complete', { tokens: 100 }, 'task-1', 'MARS');
    store.emit('llm_call_complete', { tokens: 100 }, 'task-2', 'VENUS');

    const summary = await generateReflection(sessionId);

    expect(summary.costSummary.taskCount).toBeGreaterThanOrEqual(1);
  });
});

describe('overall assessment scoring', () => {
  it('should give excellent for high success and low failures', async () => {
    // Create perfect performance
    for (let i = 0; i < 10; i++) {
      recordTaskResult('MARS', `task-${i}`, true, 1000, 2000, 0);
    }

    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);

    expect(['excellent', 'good']).toContain(summary.overallAssessment);
  });

  it('should give poor for low success and high failures', async () => {
    // Create poor performance
    for (let i = 0; i < 5; i++) {
      recordTaskResult('BAD', `task-${i}`, false, 1000, 2000, 0);
    }

    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    // Add failures
    store.emit('task_fail', { error: 'fail' }, 'fail-1', 'BAD');
    store.emit('task_fail', { error: 'fail' }, 'fail-2', 'BAD');

    const summary = await generateReflection(sessionId);

    expect(['poor', 'mixed']).toContain(summary.overallAssessment);
  });

  it('should return a valid assessment value', async () => {
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);

    expect(['excellent', 'good', 'mixed', 'poor']).toContain(summary.overallAssessment);
  });
});

describe('formatReflection', () => {
  it('should include session ID in output', () => {
    const summary: ReflectionSummary = {
      sessionId: 'test-session-123',
      timestamp: new Date().toISOString(),
      whatWorkedWell: ['Pattern 1'],
      whatFailed: [],
      agentHighlights: [],
      recommendations: ['Rec 1'],
      costSummary: {
        totalCost: 1.5,
        totalTokens: 1000,
        taskCount: 5,
        avgCostPerTask: 0.3,
      },
      overallAssessment: 'good',
    };

    const output = formatReflection(summary);
    expect(output).toContain('test-session-123');
  });

  it('should include all sections', () => {
    const summary: ReflectionSummary = {
      sessionId: 'test',
      timestamp: new Date().toISOString(),
      whatWorkedWell: ['Pattern 1'],
      whatFailed: [{ task: 't1', reason: 'error', agent: 'MARS' }],
      agentHighlights: [{ agent: 'MARS', successRate: 1, avgDuration: 2000, highlight: 'Great!' }],
      recommendations: ['Rec 1'],
      costSummary: {
        totalCost: 1,
        totalTokens: 1000,
        taskCount: 5,
        avgCostPerTask: 0.2,
      },
      overallAssessment: 'excellent',
    };

    const output = formatReflection(summary);
    expect(output).toContain('What Worked Well');
    expect(output).toContain('What Failed');
    expect(output).toContain('Agent Performance');
    expect(output).toContain('Recommendations');
    expect(output).toContain('Cost Summary');
  });

  it('should format cost summary as table', () => {
    const summary: ReflectionSummary = {
      sessionId: 'test',
      timestamp: new Date().toISOString(),
      whatWorkedWell: [],
      whatFailed: [],
      agentHighlights: [],
      recommendations: [],
      costSummary: {
        totalCost: 1.2345,
        totalTokens: 5000,
        taskCount: 10,
        avgCostPerTask: 0.1234,
      },
      overallAssessment: 'good',
    };

    const output = formatReflection(summary);
    expect(output).toContain('Total Cost');
    expect(output).toContain('Total Tokens');
    expect(output).toContain('Task Count');
    expect(output).toContain('Avg Cost/Task');
  });

  it('should format failed tasks as table', () => {
    const summary: ReflectionSummary = {
      sessionId: 'test',
      timestamp: new Date().toISOString(),
      whatWorkedWell: [],
      whatFailed: [
        { task: 'task-1', reason: 'TypeScript error', agent: 'MARS' },
      ],
      agentHighlights: [],
      recommendations: [],
      costSummary: {
        totalCost: 1,
        totalTokens: 1000,
        taskCount: 5,
        avgCostPerTask: 0.2,
      },
      overallAssessment: 'mixed',
    };

    const output = formatReflection(summary);
    expect(output).toContain('Task');
    expect(output).toContain('Agent');
    expect(output).toContain('Reason');
    expect(output).toContain('task-1');
    expect(output).toContain('MARS');
  });

  it('should format assessment badge', () => {
    const assessments: Array<ReflectionSummary['overallAssessment']> = ['excellent', 'good', 'mixed', 'poor'];

    for (const assessment of assessments) {
      const summary: ReflectionSummary = {
        sessionId: 'test',
        timestamp: new Date().toISOString(),
        whatWorkedWell: [],
        whatFailed: [],
        agentHighlights: [],
        recommendations: [],
        costSummary: {
          totalCost: 1,
          totalTokens: 1000,
          taskCount: 5,
          avgCostPerTask: 0.2,
        },
        overallAssessment: assessment,
      };

      const output = formatReflection(summary);
      expect(output.toUpperCase()).toContain(assessment.toUpperCase());
    }
  });

  it('should show success message when no failures', () => {
    const summary: ReflectionSummary = {
      sessionId: 'test',
      timestamp: new Date().toISOString(),
      whatWorkedWell: ['Success!'],
      whatFailed: [],
      agentHighlights: [],
      recommendations: [],
      costSummary: {
        totalCost: 1,
        totalTokens: 1000,
        taskCount: 5,
        avgCostPerTask: 0.2,
      },
      overallAssessment: 'excellent',
    };

    const output = formatReflection(summary);
    expect(output).toContain('No failures');
  });

  it('should handle empty data gracefully', () => {
    const summary: ReflectionSummary = {
      sessionId: 'test',
      timestamp: new Date().toISOString(),
      whatWorkedWell: [],
      whatFailed: [],
      agentHighlights: [],
      recommendations: [],
      costSummary: {
        totalCost: 0,
        totalTokens: 0,
        taskCount: 0,
        avgCostPerTask: 0,
      },
      overallAssessment: 'mixed',
    };

    const output = formatReflection(summary);
    expect(output).toContain('No patterns recorded');
    expect(output).toContain('No failures recorded');
    expect(output).toContain('No agent data');
  });
});

describe('getFailedTasks', () => {
  it('should return failed tasks for session', async () => {
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    store.emit('task_fail', { error: 'Error 1' }, 'task-1', 'MARS');
    store.emit('task_fail', { error: 'Error 2' }, 'task-2', 'VENUS');

    const failures = await getFailedTasks(sessionId);

    expect(failures).toHaveLength(2);
    expect(failures[0].task).toBe('task-1');
    expect(failures[1].task).toBe('task-2');
  });

  it('should return empty array for session with no failures', async () => {
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    store.emit('task_complete', {}, 'task-1', 'MARS');

    const failures = await getFailedTasks(sessionId);

    expect(failures).toEqual([]);
  });

  it('should return empty array for non-existent session', async () => {
    const failures = await getFailedTasks('non-existent-session');
    expect(failures).toEqual([]);
  });
});

describe('getEventsBySession', () => {
  it('should return all events for session', () => {
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    store.emit('task_start', {}, 'task-1', 'MARS');
    store.emit('task_complete', {}, 'task-1', 'MARS');

    const events = getEventsBySession(sessionId);

    expect(events.length).toBeGreaterThanOrEqual(3); // session_start + task events
  });

  it('should return empty array for non-existent session', () => {
    const events = getEventsBySession('non-existent-session');
    expect(events).toEqual([]);
  });
});

describe('edge cases', () => {
  it('should handle all success scenario', async () => {
    for (let i = 0; i < 10; i++) {
      recordTaskResult('MARS', `task-${i}`, true, 1000, 2000, 0);
    }

    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);

    expect(summary.whatFailed).toHaveLength(0);
    expect(summary.overallAssessment).toBe('excellent');
  });

  it('should handle all failure scenario', async () => {
    for (let i = 0; i < 5; i++) {
      recordTaskResult('MARS', `task-${i}`, false, 1000, 2000, 0, 'Error');
    }

    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    store.emit('task_fail', { error: 'Fail 1' }, 't1', 'MARS');
    store.emit('task_fail', { error: 'Fail 2' }, 't2', 'MARS');

    const summary = await generateReflection(sessionId);

    expect(summary.overallAssessment).toBe('poor');
  });

  it('should handle no data scenario', async () => {
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);

    expect(summary.whatWorkedWell).toBeInstanceOf(Array);
    expect(summary.whatFailed).toEqual([]);
    expect(summary.agentHighlights).toEqual([]);
    expect(summary.recommendations.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle special characters in error messages', async () => {
    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    store.emit('task_fail', { error: 'Error: "quoted" <html> & more \n newline' }, 'task-1', 'MARS');

    const summary = await generateReflection(sessionId);

    expect(summary.whatFailed[0].reason).toContain('quoted');
  });

  it('should handle very long session IDs', async () => {
    const longId = 'session-' + 'a'.repeat(500);

    // We can't actually create a store with a custom ID easily, but we can test formatting
    const summary: ReflectionSummary = {
      sessionId: longId,
      timestamp: new Date().toISOString(),
      whatWorkedWell: [],
      whatFailed: [],
      agentHighlights: [],
      recommendations: [],
      costSummary: {
        totalCost: 1,
        totalTokens: 1000,
        taskCount: 5,
        avgCostPerTask: 0.2,
      },
      overallAssessment: 'good',
    };

    const output = formatReflection(summary);
    expect(output).toContain(longId);
  });

  it('should handle mixed success/failure scenario', async () => {
    recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0);
    recordTaskResult('MARS', 'task-2', false, 1000, 2000, 0, 'Error');
    recordTaskResult('MARS', 'task-3', true, 1000, 2000, 0);

    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    store.emit('task_fail', { error: 'Some error' }, 'fail-1', 'MARS');

    const summary = await generateReflection(sessionId);

    expect(summary.overallAssessment).toBe('mixed');
    expect(summary.agentHighlights[0].successRate).toBeCloseTo(0.667, 1);
  });

  it('should handle many agents scenario', async () => {
    const agents = ['SUN', 'EARTH', 'PLUTO', 'MARS', 'VENUS', 'MERCURY', 'SATURN', 'JUPITER', 'TITAN', 'EUROPA'];
    for (const agent of agents) {
      recordTaskResult(agent, `task-${agent}`, true, 1000, 2000, 0);
    }

    const store = createEventStore('/tmp/test.json');
    const sessionId = store.getState().sessionId;

    const summary = await generateReflection(sessionId);

    expect(summary.agentHighlights.length).toBeGreaterThanOrEqual(agents.length);
  });
});
