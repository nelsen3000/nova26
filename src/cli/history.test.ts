// Build History & Trends Tests
// Tests for the history CLI module

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { BuildHistoryEntry, HistorySummary } from './history.js';

// Mock better-sqlite3 with a proper constructor
const mockPrepare = vi.fn();
const mockAll = vi.fn();
const mockGet = vi.fn();
const mockRun = vi.fn();
const mockClose = vi.fn();

class MockDatabase {
  prepare = mockPrepare;
  close = mockClose;
}

vi.mock('better-sqlite3', () => ({
  default: MockDatabase
}));

// Mock fs
const mockExistsSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  readdirSync: mockReaddirSync,
  readFileSync: mockReadFileSync
}));

// Import after mocking
const {
  getBuildHistory,
  getAgentUtilization,
  analyzeTrends,
  getCommonFailurePatterns,
  generateHistorySummary,
  formatHistorySummary,
  renderBarChart
} = await import('./history.js');

describe('Build History & Trends', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue({});
    mockRun.mockReturnValue({});
    mockPrepare.mockReturnValue({
      all: mockAll,
      get: mockGet,
      run: mockRun
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getBuildHistory', () => {
    it('should return empty array when no builds exist', async () => {
      mockAll.mockReturnValue([]);
      
      const builds = await getBuildHistory(10);
      
      expect(builds).toEqual([]);
    });

    it('should return build entries with correct structure', async () => {
      const mockBuilds = [
        {
          build_id: 'build-1',
          task_count: 10,
          success_count: 8,
          failure_count: 2,
          start_time: '2024-01-15T14:30:00.000Z',
          end_time: '2024-01-15T14:35:00.000Z',
          total_tokens: 5000
        }
      ];
      mockAll
        .mockReturnValueOnce(mockBuilds)  // First call for buildRows
        .mockReturnValueOnce([]);          // Second call for costRows
      
      const builds = await getBuildHistory(10);
      
      expect(builds).toHaveLength(1);
      expect(builds[0]).toMatchObject({
        buildId: 'build-1',
        taskCount: 10,
        successCount: 8,
        failureCount: 2,
        status: 'partial',
        totalTokens: 5000
      });
    });

    it('should calculate success status correctly', async () => {
      const mockBuilds = [
        { build_id: 'b1', task_count: 5, success_count: 5, failure_count: 0, start_time: '2024-01-15T10:00:00Z', end_time: '2024-01-15T10:05:00Z', total_tokens: 1000 },
        { build_id: 'b2', task_count: 5, success_count: 0, failure_count: 5, start_time: '2024-01-15T11:00:00Z', end_time: '2024-01-15T11:05:00Z', total_tokens: 1000 },
        { build_id: 'b3', task_count: 5, success_count: 3, failure_count: 2, start_time: '2024-01-15T12:00:00Z', end_time: '2024-01-15T12:05:00Z', total_tokens: 1000 }
      ];
      mockAll
        .mockReturnValueOnce(mockBuilds)
        .mockReturnValueOnce([]);
      
      const builds = await getBuildHistory(10);
      
      expect(builds[0].status).toBe('success');
      expect(builds[1].status).toBe('failure');
      expect(builds[2].status).toBe('partial');
    });

    it('should calculate duration correctly', async () => {
      const mockBuilds = [
        {
          build_id: 'b1',
          task_count: 5,
          success_count: 5,
          failure_count: 0,
          start_time: '2024-01-15T14:00:00.000Z',
          end_time: '2024-01-15T14:05:32.000Z',
          total_tokens: 1000
        }
      ];
      mockAll
        .mockReturnValueOnce(mockBuilds)
        .mockReturnValueOnce([]);
      
      const builds = await getBuildHistory(10);
      
      expect(builds[0].duration).toBe(332000); // 5 minutes 32 seconds in ms
    });

    it('should respect the limit parameter', async () => {
      const mockBuilds = Array(20).fill(null).map((_, i) => ({
        build_id: `build-${i}`,
        task_count: 5,
        success_count: 5,
        failure_count: 0,
        start_time: `2024-01-15T${10 + i}:00:00Z`,
        end_time: `2024-01-15T${10 + i}:05:00Z`,
        total_tokens: 1000
      }));
      mockAll
        .mockReturnValueOnce(mockBuilds)
        .mockReturnValueOnce([]);
      
      const builds = await getBuildHistory(5);
      
      expect(builds).toHaveLength(20); // Mock returns what we give it
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('LIMIT ?'));
    });

    it('should handle cost data from cost database', async () => {
      const mockBuilds = [
        {
          build_id: 'b1',
          task_count: 5,
          success_count: 5,
          failure_count: 0,
          start_time: '2024-01-15T14:00:00Z',
          end_time: '2024-01-15T14:05:00Z',
          total_tokens: 1000
        }
      ];
      const mockCosts = [
        { task_id: 'task-1', cost: 0.15, timestamp: '2024-01-15T14:02:00Z' },
        { task_id: 'task-2', cost: 0.10, timestamp: '2024-01-15T14:03:00Z' }
      ];
      mockAll
        .mockReturnValueOnce(mockBuilds)
        .mockReturnValueOnce(mockCosts);
      
      const builds = await getBuildHistory(10);
      
      expect(builds[0].totalCost).toBe(0.25);
    });
  });

  describe('getAgentUtilization', () => {
    it('should return empty array when no agent data exists', async () => {
      mockAll.mockReturnValue([]);
      
      const utilization = await getAgentUtilization();
      
      expect(utilization).toEqual([]);
    });

    it('should calculate utilization percentages correctly', async () => {
      const mockAgents = [
        { agent: 'VENUS', task_count: 45, success_count: 40 },
        { agent: 'MARS', task_count: 32, success_count: 30 },
        { agent: 'PLUTO', task_count: 15, success_count: 12 }
      ];
      mockAll.mockReturnValue(mockAgents);
      
      const utilization = await getAgentUtilization();
      
      expect(utilization).toHaveLength(3);
      expect(utilization[0]).toMatchObject({
        agent: 'VENUS',
        taskCount: 45,
        successCount: 40,
        utilizationPct: 49  // 45/92 rounded
      });
    });

    it('should sort by task count descending', async () => {
      // Mock returns data already sorted by task_count DESC (as SQL would)
      const mockAgents = [
        { agent: 'VENUS', task_count: 50, success_count: 45 },
        { agent: 'MARS', task_count: 30, success_count: 28 },
        { agent: 'PLUTO', task_count: 10, success_count: 8 }
      ];
      mockAll.mockReturnValue(mockAgents);
      
      const utilization = await getAgentUtilization();
      
      expect(utilization[0].agent).toBe('VENUS');
      expect(utilization[1].agent).toBe('MARS');
      expect(utilization[2].agent).toBe('PLUTO');
    });

    it('should handle zero total tasks', async () => {
      mockAll.mockReturnValue([]);
      
      const utilization = await getAgentUtilization();
      
      expect(utilization).toEqual([]);
    });
  });

  describe('analyzeTrends', () => {
    it('should return stable trends with no data', () => {
      const trends = analyzeTrends([]);
      
      expect(trends.direction).toBe('stable');
      expect(trends.successRateChange).toBe(0);
      expect(trends.avgDurationChange).toBe(0);
      expect(trends.avgCostChange).toBe(0);
    });

    it('should return stable trends with single build', () => {
      const builds: BuildHistoryEntry[] = [
        { buildId: 'b1', sessionId: 's1', timestamp: '2024-01-15T10:00:00Z', status: 'success', duration: 100000, taskCount: 10, successCount: 10, failureCount: 0, totalCost: 1.0, totalTokens: 5000 }
      ];
      
      const trends = analyzeTrends(builds);
      
      expect(trends.direction).toBe('stable');
    });

    it('should detect improving trend', () => {
      const builds: BuildHistoryEntry[] = [
        // Recent builds (higher success rate)
        { buildId: 'b1', sessionId: 's1', timestamp: '2024-01-15T12:00:00Z', status: 'success', duration: 100000, taskCount: 10, successCount: 10, failureCount: 0, totalCost: 0.5, totalTokens: 5000 },
        { buildId: 'b2', sessionId: 's2', timestamp: '2024-01-15T11:00:00Z', status: 'success', duration: 100000, taskCount: 10, successCount: 9, failureCount: 1, totalCost: 0.5, totalTokens: 5000 },
        // Older builds (lower success rate)
        { buildId: 'b3', sessionId: 's3', timestamp: '2024-01-15T10:00:00Z', status: 'partial', duration: 200000, taskCount: 10, successCount: 5, failureCount: 5, totalCost: 1.0, totalTokens: 5000 },
        { buildId: 'b4', sessionId: 's4', timestamp: '2024-01-15T09:00:00Z', status: 'failure', duration: 200000, taskCount: 10, successCount: 4, failureCount: 6, totalCost: 1.0, totalTokens: 5000 }
      ];
      
      const trends = analyzeTrends(builds);
      
      expect(trends.direction).toBe('improving');
      expect(trends.successRateChange).toBeGreaterThan(0);
    });

    it('should detect declining trend', () => {
      const builds: BuildHistoryEntry[] = [
        // Recent builds (lower success rate)
        { buildId: 'b1', sessionId: 's1', timestamp: '2024-01-15T12:00:00Z', status: 'failure', duration: 200000, taskCount: 10, successCount: 3, failureCount: 7, totalCost: 1.5, totalTokens: 5000 },
        { buildId: 'b2', sessionId: 's2', timestamp: '2024-01-15T11:00:00Z', status: 'partial', duration: 200000, taskCount: 10, successCount: 4, failureCount: 6, totalCost: 1.5, totalTokens: 5000 },
        // Older builds (higher success rate)
        { buildId: 'b3', sessionId: 's3', timestamp: '2024-01-15T10:00:00Z', status: 'success', duration: 100000, taskCount: 10, successCount: 10, failureCount: 0, totalCost: 0.5, totalTokens: 5000 },
        { buildId: 'b4', sessionId: 's4', timestamp: '2024-01-15T09:00:00Z', status: 'success', duration: 100000, taskCount: 10, successCount: 9, failureCount: 1, totalCost: 0.5, totalTokens: 5000 }
      ];
      
      const trends = analyzeTrends(builds);
      
      expect(trends.direction).toBe('declining');
      expect(trends.successRateChange).toBeLessThan(0);
    });

    it('should detect stable trend', () => {
      const builds: BuildHistoryEntry[] = [
        { buildId: 'b1', sessionId: 's1', timestamp: '2024-01-15T12:00:00Z', status: 'success', duration: 100000, taskCount: 10, successCount: 8, failureCount: 2, totalCost: 1.0, totalTokens: 5000 },
        { buildId: 'b2', sessionId: 's2', timestamp: '2024-01-15T11:00:00Z', status: 'success', duration: 100000, taskCount: 10, successCount: 8, failureCount: 2, totalCost: 1.0, totalTokens: 5000 },
        { buildId: 'b3', sessionId: 's3', timestamp: '2024-01-15T10:00:00Z', status: 'success', duration: 100000, taskCount: 10, successCount: 8, failureCount: 2, totalCost: 1.0, totalTokens: 5000 },
        { buildId: 'b4', sessionId: 's4', timestamp: '2024-01-15T09:00:00Z', status: 'success', duration: 100000, taskCount: 10, successCount: 8, failureCount: 2, totalCost: 1.0, totalTokens: 5000 }
      ];
      
      const trends = analyzeTrends(builds);
      
      expect(trends.direction).toBe('stable');
      expect(Math.abs(trends.successRateChange)).toBeLessThan(1);
    });

    it('should calculate percentage changes correctly', () => {
      const builds: BuildHistoryEntry[] = [
        // Recent: 100% success, 100s duration, $0.50 cost
        { buildId: 'b1', sessionId: 's1', timestamp: '2024-01-15T12:00:00Z', status: 'success', duration: 100000, taskCount: 10, successCount: 10, failureCount: 0, totalCost: 0.5, totalTokens: 5000 },
        // Older: 50% success, 200s duration, $1.00 cost
        { buildId: 'b2', sessionId: 's2', timestamp: '2024-01-15T11:00:00Z', status: 'partial', duration: 200000, taskCount: 10, successCount: 5, failureCount: 5, totalCost: 1.0, totalTokens: 5000 }
      ];
      
      const trends = analyzeTrends(builds);
      
      expect(trends.successRateChange).toBe(50); // 100% - 50% = 50pp
      expect(trends.avgDurationChange).toBe(-50); // (100-200)/200 = -50%
      expect(trends.avgCostChange).toBe(-50); // (0.5-1.0)/1.0 = -50%
    });

    it('should detect improvement from decreased cost/duration with stable success', () => {
      const builds: BuildHistoryEntry[] = [
        // Recent: stable success but lower cost/duration
        { buildId: 'b1', sessionId: 's1', timestamp: '2024-01-15T12:00:00Z', status: 'success', duration: 50000, taskCount: 10, successCount: 8, failureCount: 2, totalCost: 0.3, totalTokens: 5000 },
        { buildId: 'b2', sessionId: 's2', timestamp: '2024-01-15T11:00:00Z', status: 'success', duration: 55000, taskCount: 10, successCount: 8, failureCount: 2, totalCost: 0.35, totalTokens: 5000 },
        // Older: higher cost/duration
        { buildId: 'b3', sessionId: 's3', timestamp: '2024-01-15T10:00:00Z', status: 'success', duration: 150000, taskCount: 10, successCount: 8, failureCount: 2, totalCost: 1.2, totalTokens: 5000 },
        { buildId: 'b4', sessionId: 's4', timestamp: '2024-01-15T09:00:00Z', status: 'success', duration: 140000, taskCount: 10, successCount: 8, failureCount: 2, totalCost: 1.1, totalTokens: 5000 }
      ];
      
      const trends = analyzeTrends(builds);
      
      expect(trends.direction).toBe('improving');
    });
  });

  describe('getCommonFailurePatterns', () => {
    it('should return empty array when no failures exist', async () => {
      mockAll.mockReturnValue([]);
      
      const patterns = await getCommonFailurePatterns(5);
      
      expect(patterns).toEqual([]);
    });

    it('should categorize failure reasons', async () => {
      const mockFailures = [
        { failure_reason: 'Type error in validation', count: 5, agents: 'MARS,SATURN' },
        { failure_reason: 'Missing index on users table', count: 3, agents: 'PLUTO' },
        { failure_reason: 'Timeout during test execution', count: 2, agents: 'MERCURY' }
      ];
      mockAll.mockReturnValue(mockFailures);
      
      const patterns = await getCommonFailurePatterns(5);
      
      expect(patterns).toHaveLength(3);
      expect(patterns[0].pattern).toBe('Type validation errors');
      expect(patterns[1].pattern).toBe('Missing index on query');
      expect(patterns[2].pattern).toBe('Timeout errors');
    });

    it('should parse agents correctly', async () => {
      const mockFailures = [
        { failure_reason: 'Type error', count: 3, agents: 'MARS,VENUS,PLUTO' }
      ];
      mockAll.mockReturnValue(mockFailures);
      
      const patterns = await getCommonFailurePatterns(5);
      
      expect(patterns[0].agents).toEqual(['MARS', 'VENUS', 'PLUTO']);
    });

    it('should limit results to specified count', async () => {
      const mockFailures = Array(10).fill(null).map((_, i) => ({
        failure_reason: `Error ${i}`,
        count: i + 1,
        agents: 'MARS'
      }));
      mockAll.mockReturnValue(mockFailures);
      
      await getCommonFailurePatterns(3);
      
      expect(mockAll).toHaveBeenCalledWith(3);
    });

    it('should truncate long failure reasons', async () => {
      const mockFailures = [
        { failure_reason: 'A'.repeat(100), count: 1, agents: 'MARS' }
      ];
      mockAll.mockReturnValue(mockFailures);
      
      const patterns = await getCommonFailurePatterns(5);
      
      expect(patterns[0].pattern.length).toBeLessThanOrEqual(43);
    });

    it('should handle empty agents string', async () => {
      const mockFailures = [
        { failure_reason: 'Error', count: 1, agents: null }
      ];
      mockAll.mockReturnValue(mockFailures);
      
      const patterns = await getCommonFailurePatterns(5);
      
      expect(patterns[0].agents).toEqual([]);
    });
  });

  describe('generateHistorySummary', () => {
    it('should generate complete summary', async () => {
      const mockBuilds = [
        {
          build_id: 'b1',
          task_count: 10,
          success_count: 9,
          failure_count: 1,
          start_time: '2024-01-15T14:00:00Z',
          end_time: '2024-01-15T14:05:00Z',
          total_tokens: 5000
        }
      ];
      const mockAgents = [
        { agent: 'VENUS', task_count: 45, success_count: 40 }
      ];
      const mockFailures = [
        { failure_reason: 'Type error', count: 3, agents: 'MARS' }
      ];
      
      mockAll
        .mockReturnValueOnce(mockBuilds)
        .mockReturnValueOnce([])
        .mockReturnValueOnce(mockAgents)
        .mockReturnValueOnce(mockFailures);
      
      const summary = await generateHistorySummary(10);
      
      expect(summary.recentBuilds).toBeDefined();
      expect(summary.agentUtilization).toBeDefined();
      expect(summary.trends).toBeDefined();
      expect(summary.commonFailures).toBeDefined();
      expect(summary.summary).toBeDefined();
    });

    it('should calculate summary statistics correctly', async () => {
      const mockBuilds = [
        { build_id: 'b1', task_count: 10, success_count: 8, failure_count: 2, start_time: '2024-01-15T14:00:00Z', end_time: '2024-01-15T14:05:00Z', total_tokens: 5000 },
        { build_id: 'b2', task_count: 15, success_count: 14, failure_count: 1, start_time: '2024-01-15T15:00:00Z', end_time: '2024-01-15T15:08:00Z', total_tokens: 8000 }
      ];
      
      mockAll
        .mockReturnValueOnce(mockBuilds)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);
      
      const summary = await generateHistorySummary(10);
      
      expect(summary.summary.totalBuilds).toBe(2);
      expect(summary.summary.totalTasks).toBe(25);
      expect(summary.summary.overallSuccessRate).toBe(22 / 25); // 88%
    });
  });

  describe('formatHistorySummary', () => {
    it('should format summary with all sections', () => {
      const summary: HistorySummary = {
        recentBuilds: [
          { buildId: 'b1', sessionId: 's1', timestamp: '2024-01-15T14:30:00Z', status: 'success', duration: 332000, taskCount: 12, successCount: 12, failureCount: 0, totalCost: 0.45, totalTokens: 5000 }
        ],
        agentUtilization: [
          { agent: 'VENUS', taskCount: 23, successCount: 21, utilizationPct: 45 },
          { agent: 'MARS', taskCount: 16, successCount: 15, utilizationPct: 32 }
        ],
        trends: {
          direction: 'improving',
          successRateChange: 7,
          avgDurationChange: -21,
          avgCostChange: -27
        },
        commonFailures: [
          { pattern: 'Type validation errors', count: 3, agents: ['MARS', 'SATURN'] },
          { pattern: 'Missing index on query', count: 2, agents: ['PLUTO'] }
        ],
        summary: {
          totalBuilds: 10,
          overallSuccessRate: 0.92,
          totalCost: 4.52,
          totalTasks: 156
        }
      };
      
      const output = formatHistorySummary(summary);
      
      expect(output).toContain('Build History');
      expect(output).toContain('Recent Builds');
      expect(output).toContain('Agent Utilization');
      expect(output).toContain('Trends');
      expect(output).toContain('Common Failure Patterns');
      expect(output).toContain('Summary');
    });

    it('should format empty state correctly', () => {
      const summary: HistorySummary = {
        recentBuilds: [],
        agentUtilization: [],
        trends: { direction: 'stable', successRateChange: 0, avgDurationChange: 0, avgCostChange: 0 },
        commonFailures: [],
        summary: { totalBuilds: 0, overallSuccessRate: 0, totalCost: 0, totalTasks: 0 }
      };
      
      const output = formatHistorySummary(summary);
      
      expect(output).toContain('No builds recorded yet');
      expect(output).toContain('No agent data recorded yet');
      expect(output).toContain('No failures recorded');
    });

    it('should show correct status icons', () => {
      const summary: HistorySummary = {
        recentBuilds: [
          { buildId: 'b1', sessionId: 's1', timestamp: '2024-01-15T14:00:00Z', status: 'success', duration: 100000, taskCount: 10, successCount: 10, failureCount: 0, totalCost: 0.5, totalTokens: 1000 },
          { buildId: 'b2', sessionId: 's2', timestamp: '2024-01-15T15:00:00Z', status: 'failure', duration: 100000, taskCount: 10, successCount: 0, failureCount: 10, totalCost: 0.5, totalTokens: 1000 },
          { buildId: 'b3', sessionId: 's3', timestamp: '2024-01-15T16:00:00Z', status: 'partial', duration: 100000, taskCount: 10, successCount: 5, failureCount: 5, totalCost: 0.5, totalTokens: 1000 }
        ],
        agentUtilization: [],
        trends: { direction: 'stable', successRateChange: 0, avgDurationChange: 0, avgCostChange: 0 },
        commonFailures: [],
        summary: { totalBuilds: 3, overallSuccessRate: 0.5, totalCost: 1.5, totalTasks: 30 }
      };
      
      const output = formatHistorySummary(summary);
      
      expect(output).toContain('✅');
      expect(output).toContain('❌');
      expect(output).toContain('⚠️');
    });

    it('should format duration correctly', () => {
      const summary: HistorySummary = {
        recentBuilds: [
          { buildId: 'b1', sessionId: 's1', timestamp: '2024-01-15T14:00:00Z', status: 'success', duration: 332000, taskCount: 10, successCount: 10, failureCount: 0, totalCost: 0.5, totalTokens: 1000 }
        ],
        agentUtilization: [],
        trends: { direction: 'stable', successRateChange: 0, avgDurationChange: 0, avgCostChange: 0 },
        commonFailures: [],
        summary: { totalBuilds: 1, overallSuccessRate: 1, totalCost: 0.5, totalTasks: 10 }
      };
      
      const output = formatHistorySummary(summary);
      
      expect(output).toContain('5m 32s');
    });
  });

  describe('renderBarChart', () => {
    it('should render empty chart for empty data', () => {
      const chart = renderBarChart([]);
      expect(chart).toBe('');
    });

    it('should render bar chart with correct proportions', () => {
      const data = [
        { label: 'A', value: 50, max: 100 },
        { label: 'B', value: 25, max: 100 },
        { label: 'C', value: 75, max: 100 }
      ];
      
      const chart = renderBarChart(data, 20);
      
      expect(chart).toContain('A');
      expect(chart).toContain('B');
      expect(chart).toContain('C');
      expect(chart).toContain('50%');
      expect(chart).toContain('25%');
      expect(chart).toContain('75%');
    });

    it('should handle zero max value', () => {
      const data = [{ label: 'A', value: 0, max: 0 }];
      
      const chart = renderBarChart(data);
      
      expect(chart).toBe('');
    });

    it('should respect custom width', () => {
      const data = [{ label: 'A', value: 50, max: 100 }];
      
      const chart = renderBarChart(data, 10);
      
      // With width 10, 50% should be 5 characters
      expect(chart).toContain('█████');
    });

    it('should include percentage labels', () => {
      const data = [
        { label: 'VENUS', value: 45, max: 100 }
      ];
      
      const chart = renderBarChart(data, 20);
      
      expect(chart).toContain('45%');
    });
  });

  describe('edge cases', () => {
    it('should handle builds with zero tasks', async () => {
      const mockBuilds = [
        { build_id: 'b1', task_count: 0, success_count: 0, failure_count: 0, start_time: '2024-01-15T14:00:00Z', end_time: '2024-01-15T14:05:00Z', total_tokens: 0 }
      ];
      mockAll
        .mockReturnValueOnce(mockBuilds)
        .mockReturnValueOnce([]);
      
      const builds = await getBuildHistory(10);
      
      expect(builds[0].status).toBe('success'); // No failures means success
      expect(builds[0].taskCount).toBe(0);
    });

    it('should handle negative durations gracefully', async () => {
      const mockBuilds = [
        { build_id: 'b1', task_count: 5, success_count: 5, failure_count: 0, start_time: '2024-01-15T14:05:00Z', end_time: '2024-01-15T14:00:00Z', total_tokens: 1000 }
      ];
      mockAll
        .mockReturnValueOnce(mockBuilds)
        .mockReturnValueOnce([]);
      
      const builds = await getBuildHistory(10);
      
      expect(builds[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle very large numbers', async () => {
      const mockBuilds = [
        { build_id: 'b1', task_count: 999999, success_count: 999999, failure_count: 0, start_time: '2024-01-15T14:00:00Z', end_time: '2024-01-15T14:05:00Z', total_tokens: 999999999 }
      ];
      mockAll
        .mockReturnValueOnce(mockBuilds)
        .mockReturnValueOnce([]);
      
      const builds = await getBuildHistory(10);
      
      expect(builds[0].taskCount).toBe(999999);
      expect(builds[0].totalTokens).toBe(999999999);
    });

    it('should handle missing event directory', async () => {
      mockExistsSync.mockReturnValue(false);
      
      const builds = await getBuildHistory(10);
      
      expect(builds).toEqual([]);
    });

    it('should handle special characters in failure reasons', async () => {
      const mockFailures = [
        { failure_reason: 'Error: "quoted" <html> & more', count: 1, agents: 'MARS' }
      ];
      mockAll.mockReturnValue(mockFailures);
      
      const patterns = await getCommonFailurePatterns(5);
      
      expect(patterns).toHaveLength(1);
      expect(patterns[0].pattern).toContain('Error');
    });

    it('should format costs correctly with 2 decimal places', () => {
      const summary: HistorySummary = {
        recentBuilds: [
          { buildId: 'b1', sessionId: 's1', timestamp: '2024-01-15T14:00:00Z', status: 'success', duration: 100000, taskCount: 10, successCount: 10, failureCount: 0, totalCost: 0.4567, totalTokens: 1000 }
        ],
        agentUtilization: [],
        trends: { direction: 'stable', successRateChange: 0, avgDurationChange: 0, avgCostChange: 0 },
        commonFailures: [],
        summary: { totalBuilds: 1, overallSuccessRate: 1, totalCost: 1.2345, totalTasks: 10 }
      };
      
      const output = formatHistorySummary(summary);
      
      expect(output).toContain('$0.46');
      expect(output).toContain('$1.23');
    });
  });
});
