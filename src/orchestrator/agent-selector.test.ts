// Tests for Smart Agent Selection
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  selectBestAgent,
  scoreAgentsForTask,
  getKeywordMatchScore,
  fallbackToDefaultAgent,
  formatSelectionResult,
  type SelectionResult,
} from './agent-selector.js';
import * as agentAnalytics from '../analytics/agent-analytics.js';

// Mock the agent-analytics module
vi.mock('../analytics/agent-analytics.js', () => ({
  getAllAgentStats: vi.fn(),
  getAgentStats: vi.fn(),
  recordTaskResult: vi.fn(),
  resetAnalytics: vi.fn(),
}));

describe('Agent Selector', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getKeywordMatchScore', () => {
    it('returns 0 when no keywords match', () => {
      const score = getKeywordMatchScore('Some random task', 'MARS');
      expect(score).toBe(0);
    });

    it('returns 10 for single keyword match', () => {
      const score = getKeywordMatchScore('Create a user table', 'PLUTO');
      expect(score).toBe(10);
    });

    it('returns 20 for two keyword matches', () => {
      const score = getKeywordMatchScore('Create database schema', 'PLUTO');
      expect(score).toBe(20);
    });

    it('caps at 30 points for 3+ matches', () => {
      const score = getKeywordMatchScore('Create database schema table migration', 'PLUTO');
      expect(score).toBe(30);
    });

    it('is case insensitive', () => {
      const score = getKeywordMatchScore('CREATE USER TABLE', 'PLUTO');
      expect(score).toBe(10);
    });

    it('matches VENUS for UI keywords', () => {
      expect(getKeywordMatchScore('Build a component', 'VENUS')).toBe(10);
      expect(getKeywordMatchScore('Create a page', 'VENUS')).toBe(10);
      expect(getKeywordMatchScore('Build react component', 'VENUS')).toBe(20);
    });

    it('matches SATURN for test keywords', () => {
      expect(getKeywordMatchScore('Write a test', 'SATURN')).toBe(10);
      expect(getKeywordMatchScore('Create spec file', 'SATURN')).toBe(10);
    });
  });

  describe('fallbackToDefaultAgent', () => {
    it('returns PLUTO for schema-related keywords', () => {
      expect(fallbackToDefaultAgent('schema')).toBe('PLUTO');
      expect(fallbackToDefaultAgent('database')).toBe('PLUTO');
      expect(fallbackToDefaultAgent('table')).toBe('PLUTO');
    });

    it('returns MARS for API-related keywords', () => {
      expect(fallbackToDefaultAgent('api')).toBe('MARS');
      expect(fallbackToDefaultAgent('backend')).toBe('MARS');
      expect(fallbackToDefaultAgent('mutation')).toBe('MARS');
      expect(fallbackToDefaultAgent('query')).toBe('MARS');
    });

    it('returns VENUS for UI-related keywords', () => {
      expect(fallbackToDefaultAgent('component')).toBe('VENUS');
      expect(fallbackToDefaultAgent('page')).toBe('VENUS');
      expect(fallbackToDefaultAgent('frontend')).toBe('VENUS');
      expect(fallbackToDefaultAgent('react')).toBe('VENUS');
    });

    it('returns SATURN for test-related keywords', () => {
      expect(fallbackToDefaultAgent('test')).toBe('SATURN');
      expect(fallbackToDefaultAgent('spec')).toBe('SATURN');
    });

    it('returns ENCELADUS for security-related keywords', () => {
      expect(fallbackToDefaultAgent('security')).toBe('ENCELADUS');
      expect(fallbackToDefaultAgent('auth')).toBe('ENCELADUS');
      expect(fallbackToDefaultAgent('validation')).toBe('ENCELADUS');
    });

    it('returns GANYMEDE for integration-related keywords', () => {
      expect(fallbackToDefaultAgent('integration')).toBe('GANYMEDE');
      expect(fallbackToDefaultAgent('webhook')).toBe('GANYMEDE');
      expect(fallbackToDefaultAgent('stripe')).toBe('GANYMEDE');
    });

    it('returns CALLISTO for documentation-related keywords', () => {
      expect(fallbackToDefaultAgent('doc')).toBe('CALLISTO');
      expect(fallbackToDefaultAgent('readme')).toBe('CALLISTO');
      expect(fallbackToDefaultAgent('documentation')).toBe('CALLISTO');
    });

    it('returns IO for performance-related keywords', () => {
      expect(fallbackToDefaultAgent('performance')).toBe('IO');
      expect(fallbackToDefaultAgent('optimize')).toBe('IO');
      expect(fallbackToDefaultAgent('cache')).toBe('IO');
    });

    it('returns MIMAS for resilience-related keywords', () => {
      expect(fallbackToDefaultAgent('add resilience')).toBe('MIMAS');
      expect(fallbackToDefaultAgent('retry logic')).toBe('MIMAS');
      expect(fallbackToDefaultAgent('circuit pattern')).toBe('MIMAS');
    });

    it('returns NEPTUNE for analytics-related keywords', () => {
      expect(fallbackToDefaultAgent('analytics')).toBe('NEPTUNE');
      expect(fallbackToDefaultAgent('metrics')).toBe('NEPTUNE');
      expect(fallbackToDefaultAgent('dashboard')).toBe('NEPTUNE');
    });

    it('returns MARS as default for unknown keywords', () => {
      expect(fallbackToDefaultAgent('unknown')).toBe('MARS');
      expect(fallbackToDefaultAgent('random')).toBe('MARS');
      expect(fallbackToDefaultAgent('')).toBe('MARS');
    });

    it('handles multi-word task types', () => {
      expect(fallbackToDefaultAgent('create user api')).toBe('MARS');
      expect(fallbackToDefaultAgent('design database schema')).toBe('PLUTO');
    });
  });

  describe('scoreAgentsForTask', () => {
    it('returns empty array when no analytics data', async () => {
      vi.mocked(agentAnalytics.getAllAgentStats).mockReturnValue([]);
      
      const scores = await scoreAgentsForTask({
        taskDescription: 'Create API endpoint',
      });
      
      expect(scores).toEqual([]);
    });

    it('includes success rate in scoring', async () => {
      vi.mocked(agentAnalytics.getAllAgentStats).mockReturnValue([
        { agent: 'MARS', totalTasks: 10, successRate: 0.9, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
        { agent: 'VENUS', totalTasks: 10, successRate: 0.7, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
      ]);
      
      const scores = await scoreAgentsForTask({
        taskDescription: 'Some task',
      });
      
      expect(scores).toHaveLength(2);
      expect(scores[0].agent).toBe('MARS');
      expect(scores[0].successRate).toBe(0.9);
      expect(scores[0].score).toBeGreaterThan(scores[1].score);
    });

    it('applies keyword matching bonus to scores', async () => {
      vi.mocked(agentAnalytics.getAllAgentStats).mockReturnValue([
        { agent: 'MARS', totalTasks: 10, successRate: 0.8, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
        { agent: 'PLUTO', totalTasks: 10, successRate: 0.7, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
      ]);
      
      const scores = await scoreAgentsForTask({
        taskDescription: 'Create database table',
      });
      
      // PLUTO should get keyword bonus for 'database' and 'table'
      const plutoScore = scores.find(s => s.agent === 'PLUTO');
      const marsScore = scores.find(s => s.agent === 'MARS');
      
      expect(plutoScore?.score).toBeGreaterThan(marsScore?.score || 0);
      expect(plutoScore?.reasoning).toContain('Keyword match');
    });

    it('filters out excluded agents', async () => {
      vi.mocked(agentAnalytics.getAllAgentStats).mockReturnValue([
        { agent: 'MARS', totalTasks: 10, successRate: 0.9, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
        { agent: 'VENUS', totalTasks: 10, successRate: 0.8, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
      ]);
      
      const scores = await scoreAgentsForTask({
        taskDescription: 'Some task',
        excludeAgents: ['MARS'],
      });
      
      expect(scores).toHaveLength(1);
      expect(scores[0].agent).toBe('VENUS');
    });

    it('filters out agents below minSuccessRate', async () => {
      vi.mocked(agentAnalytics.getAllAgentStats).mockReturnValue([
        { agent: 'MARS', totalTasks: 10, successRate: 0.9, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
        { agent: 'VENUS', totalTasks: 10, successRate: 0.4, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
      ]);
      
      const scores = await scoreAgentsForTask({
        taskDescription: 'Some task',
        minSuccessRate: 0.5,
      });
      
      expect(scores).toHaveLength(1);
      expect(scores[0].agent).toBe('MARS');
    });

    it('includes avgDuration and gatePassRate in results', async () => {
      vi.mocked(agentAnalytics.getAllAgentStats).mockReturnValue([
        { agent: 'MARS', totalTasks: 10, successRate: 0.9, avgTokens: 1000, avgDuration: 3000, gatePassRate: 0.95, topFailures: [] },
      ]);
      
      const scores = await scoreAgentsForTask({
        taskDescription: 'Some task',
      });
      
      expect(scores[0].avgDuration).toBe(3000);
      expect(scores[0].gatePassRate).toBe(0.95);
    });

    it('returns scores sorted by score descending', async () => {
      vi.mocked(agentAnalytics.getAllAgentStats).mockReturnValue([
        { agent: 'VENUS', totalTasks: 10, successRate: 0.7, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
        { agent: 'MARS', totalTasks: 10, successRate: 0.9, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
        { agent: 'PLUTO', totalTasks: 10, successRate: 0.5, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
      ]);
      
      const scores = await scoreAgentsForTask({
        taskDescription: 'Some task',
      });
      
      expect(scores[0].agent).toBe('MARS');
      expect(scores[1].agent).toBe('VENUS');
      expect(scores[2].agent).toBe('PLUTO');
      expect(scores[0].score).toBeGreaterThanOrEqual(scores[1].score);
      expect(scores[1].score).toBeGreaterThanOrEqual(scores[2].score);
    });
  });

  describe('selectBestAgent', () => {
    it('returns valid agent when analytics data exists', async () => {
      vi.mocked(agentAnalytics.getAllAgentStats).mockReturnValue([
        { agent: 'MARS', totalTasks: 10, successRate: 0.9, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
      ]);
      
      const result = await selectBestAgent({
        taskDescription: 'Create API',
      });
      
      expect(result.selectedAgent).toBe('MARS');
      expect(result.scores).toHaveLength(1);
      expect(result.reasoning).toBeTruthy();
    });

    it('uses fallback when no analytics data', async () => {
      vi.mocked(agentAnalytics.getAllAgentStats).mockReturnValue([]);
      
      const result = await selectBestAgent({
        taskDescription: 'Create database table',
      });
      
      expect(result.selectedAgent).toBe('PLUTO');
      expect(result.scores).toEqual([]);
      expect(result.confidence).toBe('low');
    });

    it('uses fallback with taskType when provided', async () => {
      vi.mocked(agentAnalytics.getAllAgentStats).mockReturnValue([]);
      
      const result = await selectBestAgent({
        taskDescription: 'Some generic description',
        taskType: 'component',
      });
      
      expect(result.selectedAgent).toBe('VENUS');
    });

    it('calculates high confidence for strong performers', async () => {
      vi.mocked(agentAnalytics.getAllAgentStats).mockReturnValue([
        { agent: 'MARS', totalTasks: 10, successRate: 0.9, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
      ]);
      
      const result = await selectBestAgent({
        taskDescription: 'Create API',
        preferredAgents: ['MARS'],
      });
      
      expect(result.confidence).toBe('high');
    });

    it('calculates low confidence for poor performers', async () => {
      vi.mocked(agentAnalytics.getAllAgentStats).mockReturnValue([
        { agent: 'MARS', totalTasks: 10, successRate: 0.4, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
      ]);
      
      const result = await selectBestAgent({
        taskDescription: 'Create API',
      });
      
      expect(result.confidence).toBe('low');
    });

    it('prioritizes preferred agents when performance is close', async () => {
      vi.mocked(agentAnalytics.getAllAgentStats).mockReturnValue([
        { agent: 'MARS', totalTasks: 10, successRate: 0.9, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
        { agent: 'VENUS', totalTasks: 10, successRate: 0.85, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
      ]);
      
      const result = await selectBestAgent({
        taskDescription: 'Create something',
        preferredAgents: ['VENUS'],
      });
      
      // VENUS has 85 score, MARS has 90, but VENUS is preferred and within 80%
      expect(result.selectedAgent).toBe('VENUS');
    });

    it('includes all scores in result', async () => {
      vi.mocked(agentAnalytics.getAllAgentStats).mockReturnValue([
        { agent: 'MARS', totalTasks: 10, successRate: 0.9, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
        { agent: 'VENUS', totalTasks: 10, successRate: 0.8, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
      ]);
      
      const result = await selectBestAgent({
        taskDescription: 'Create API',
      });
      
      expect(result.scores).toHaveLength(2);
    });
  });

  describe('formatSelectionResult', () => {
    it('includes selected agent in output', () => {
      const result: SelectionResult = {
        selectedAgent: 'MARS',
        scores: [
          { agent: 'MARS', score: 90, successRate: 0.9, avgDuration: 5000, gatePassRate: 0.85, reasoning: 'High success rate' },
        ],
        confidence: 'high',
        reasoning: 'MARS is the best choice',
      };
      
      const formatted = formatSelectionResult(result);
      
      expect(formatted).toContain('MARS');
      expect(formatted).toContain('high confidence');
      expect(formatted).toContain('MARS is the best choice');
    });

    it('includes score breakdown in output', () => {
      const result: SelectionResult = {
        selectedAgent: 'MARS',
        scores: [
          { agent: 'MARS', score: 90, successRate: 0.9, avgDuration: 5000, gatePassRate: 0.85, reasoning: 'High success rate' },
          { agent: 'VENUS', score: 80, successRate: 0.8, avgDuration: 6000, gatePassRate: 0.8, reasoning: 'Good match' },
        ],
        confidence: 'high',
        reasoning: 'Best performer',
      };
      
      const formatted = formatSelectionResult(result);
      
      expect(formatted).toContain('Score Breakdown');
      expect(formatted).toContain('MARS');
      expect(formatted).toContain('VENUS');
      expect(formatted).toContain('90.0');
      expect(formatted).toContain('80.0');
    });

    it('uses correct emoji for confidence levels', () => {
      const highResult: SelectionResult = {
        selectedAgent: 'MARS',
        scores: [],
        confidence: 'high',
        reasoning: 'Test',
      };
      
      const mediumResult: SelectionResult = {
        selectedAgent: 'MARS',
        scores: [],
        confidence: 'medium',
        reasoning: 'Test',
      };
      
      const lowResult: SelectionResult = {
        selectedAgent: 'MARS',
        scores: [],
        confidence: 'low',
        reasoning: 'Test',
      };
      
      expect(formatSelectionResult(highResult)).toContain('✅');
      expect(formatSelectionResult(mediumResult)).toContain('⚠️');
      expect(formatSelectionResult(lowResult)).toContain('❓');
    });

    it('shows "more" indicator when more than 5 scores', () => {
      const result: SelectionResult = {
        selectedAgent: 'MARS',
        scores: Array(7).fill(null).map((_, i) => ({
          agent: `AGENT${i}`,
          score: 90 - i,
          successRate: 0.9,
          avgDuration: 5000,
          gatePassRate: 0.85,
          reasoning: 'Test',
        })),
        confidence: 'high',
        reasoning: 'Test',
      };
      
      const formatted = formatSelectionResult(result);
      
      expect(formatted).toContain('2 more');
    });

    it('handles empty scores gracefully', () => {
      const result: SelectionResult = {
        selectedAgent: 'MARS',
        scores: [],
        confidence: 'low',
        reasoning: 'No data',
      };
      
      const formatted = formatSelectionResult(result);
      
      expect(formatted).toContain('MARS');
      expect(formatted).toContain('No analytics data available');
    });
  });

  describe('integration with analytics', () => {
    it('calls getAllAgentStats when scoring', async () => {
      vi.mocked(agentAnalytics.getAllAgentStats).mockReturnValue([]);
      
      await scoreAgentsForTask({ taskDescription: 'Test' });
      
      expect(agentAnalytics.getAllAgentStats).toHaveBeenCalledTimes(1);
    });

    it('passes correct criteria to filtering', async () => {
      vi.mocked(agentAnalytics.getAllAgentStats).mockReturnValue([
        { agent: 'MARS', totalTasks: 10, successRate: 0.9, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
        { agent: 'VENUS', totalTasks: 10, successRate: 0.4, avgTokens: 1000, avgDuration: 5000, gatePassRate: 0.85, topFailures: [] },
      ]);
      
      const scores = await scoreAgentsForTask({
        taskDescription: 'Test',
        excludeAgents: ['PLUTO'],
        minSuccessRate: 0.5,
      });
      
      // VENUS should be filtered out by minSuccessRate
      expect(scores.find(s => s.agent === 'VENUS')).toBeUndefined();
      expect(scores.find(s => s.agent === 'MARS')).toBeDefined();
    });
  });
});
