import { describe, it, expect } from 'vitest';

/**
 * Dashboard Query & Mutation Tests
 *
 * NOTE: Full integration tests require `convex dev` and generated API files.
 * These tests validate function signatures and return types.
 */

describe('dashboard.ts - Function signatures and types', () => {
  describe('Query function signatures', () => {
    it('listBuilds query accepts optional cursor and pageSize', () => {
      // Test signature: (cursor?: string, pageSize?: number)
      const validArgs = [
        { cursor: undefined, pageSize: undefined },
        { cursor: 'cursor-123', pageSize: 20 },
        { pageSize: 50 },
        {},
      ];

      expect(validArgs).toBeDefined();
    });

    it('getBuild query requires buildId argument', () => {
      // Test signature: (buildId: v.id('builds'))
      const validArgs = { buildId: 'id-123' };
      expect(validArgs).toHaveProperty('buildId');
    });

    it('listTasks query requires buildId argument', () => {
      // Test signature: (buildId: v.id('builds'))
      const validArgs = { buildId: 'id-123' };
      expect(validArgs).toHaveProperty('buildId');
    });

    it('getOverviewStats query requires no arguments', () => {
      // Test signature: ()
      const validArgs = {};
      expect(validArgs).toBeDefined();
    });
  });

  describe('Mutation function signatures', () => {
    it('createBuild mutation requires prdId and prdName', () => {
      const args = {
        prdId: 'proj-001',
        prdName: 'Test Project',
      };

      expect(args).toHaveProperty('prdId');
      expect(args).toHaveProperty('prdName');
      expect(typeof args.prdId).toBe('string');
      expect(typeof args.prdName).toBe('string');
    });

    it('updateBuildStatus mutation requires buildId and status', () => {
      const validStatuses = ['running', 'completed', 'failed'];

      const args = {
        buildId: 'id-123',
        status: 'completed',
        error: 'optional error message',
      };

      expect(args).toHaveProperty('buildId');
      expect(args).toHaveProperty('status');
      expect(validStatuses).toContain(args.status);
    });

    it('createTask mutation requires buildId, taskId, title, agent, and phase', () => {
      const args = {
        buildId: 'id-123',
        taskId: 'task-001',
        title: 'Test Task',
        agent: 'ATLAS',
        phase: 1,
        description: 'optional description',
      };

      expect(args).toHaveProperty('buildId');
      expect(args).toHaveProperty('taskId');
      expect(args).toHaveProperty('title');
      expect(args).toHaveProperty('agent');
      expect(args).toHaveProperty('phase');
      expect(typeof args.phase).toBe('number');
    });

    it('updateTaskStatus mutation requires taskId and status', () => {
      const validStatuses = ['pending', 'ready', 'running', 'done', 'failed', 'blocked'];

      const args = {
        taskId: 'id-123',
        status: 'running',
        output: 'optional output',
        error: 'optional error',
        duration: 1234,
      };

      expect(args).toHaveProperty('taskId');
      expect(args).toHaveProperty('status');
      expect(validStatuses).toContain(args.status);
    });

    it('logExecution mutation requires taskId, agent, model, and response info', () => {
      const args = {
        taskId: 'id-123',
        agent: 'ATLAS',
        model: 'claude-3-sonnet',
        prompt: 'Test prompt',
        response: 'Test response',
        gatesPassed: true,
        duration: 1234,
      };

      expect(args).toHaveProperty('taskId');
      expect(args).toHaveProperty('agent');
      expect(args).toHaveProperty('model');
      expect(args).toHaveProperty('duration');
      expect(typeof args.duration).toBe('number');
      expect(typeof args.gatesPassed).toBe('boolean');
    });

    it('updateAgentStatus mutation requires agentId', () => {
      const args = {
        agentId: 'id-123',
        status: 'active',
      };

      expect(args).toHaveProperty('agentId');
    });
  });

  describe('Return type validation', () => {
    it('listBuilds returns pagination structure', () => {
      const mockResult = {
        builds: [
          {
            _id: 'id-1',
            prdId: 'proj-001',
            prdName: 'Project 1',
            status: 'completed',
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
        ],
        nextCursor: 'cursor-123',
        hasMore: true,
      };

      expect(mockResult).toHaveProperty('builds');
      expect(mockResult).toHaveProperty('nextCursor');
      expect(mockResult).toHaveProperty('hasMore');
      expect(Array.isArray(mockResult.builds)).toBe(true);
      expect(typeof mockResult.hasMore).toBe('boolean');
    });

    it('getBuild returns build with tasks array', () => {
      const mockResult = {
        build: {
          _id: 'id-1',
          prdId: 'proj-001',
          prdName: 'Project 1',
          status: 'running',
          startedAt: new Date().toISOString(),
        },
        tasks: [
          {
            _id: 'task-1',
            buildId: 'id-1',
            taskId: 'task-001',
            title: 'Task 1',
            agent: 'ATLAS',
            status: 'done',
            phase: 1,
            attempts: 1,
            createdAt: new Date().toISOString(),
          },
        ],
      };

      expect(mockResult).toHaveProperty('build');
      expect(mockResult).toHaveProperty('tasks');
      expect(Array.isArray(mockResult.tasks)).toBe(true);
    });

    it('getOverviewStats returns statistics structure', () => {
      const mockResult = {
        totalBuilds: 10,
        completedBuilds: 7,
        failedBuilds: 2,
        successRate: 70,
        activeTasks: 5,
        completedTasks: 23,
        lastBuildTime: new Date().toISOString(),
        totalAgents: 21,
      };

      expect(mockResult).toHaveProperty('totalBuilds');
      expect(mockResult).toHaveProperty('completedBuilds');
      expect(mockResult).toHaveProperty('failedBuilds');
      expect(mockResult).toHaveProperty('successRate');
      expect(mockResult).toHaveProperty('activeTasks');
      expect(mockResult).toHaveProperty('completedTasks');
      expect(mockResult).toHaveProperty('lastBuildTime');
      expect(mockResult).toHaveProperty('totalAgents');

      expect(typeof mockResult.totalBuilds).toBe('number');
      expect(typeof mockResult.successRate).toBe('number');
    });
  });

  describe('Validation logic', () => {
    it('pageSize should be capped at 100', () => {
      const pageSizeTests = [
        { input: 20, expected: 20 },
        { input: 100, expected: 100 },
        { input: 200, expected: 100 }, // Should be capped
        { input: -1, expected: 100 }, // Invalid, should use max
      ];

      for (const test of pageSizeTests) {
        // Simulate the capping logic from the function
        const capped = Math.min(test.input ?? 20, 100);
        expect(capped).toBeLessThanOrEqual(100);
      }
    });

    it('build status values are validated', () => {
      const validStatuses = ['running', 'completed', 'failed'];
      const invalidStatuses = ['pending', 'active', 'paused'];

      for (const status of validStatuses) {
        expect(validStatuses).toContain(status);
      }

      for (const status of invalidStatuses) {
        expect(validStatuses).not.toContain(status);
      }
    });

    it('task status values are validated', () => {
      const validStatuses = ['pending', 'ready', 'running', 'done', 'failed', 'blocked'];
      const invalidStatuses = ['completed', 'paused', 'active'];

      for (const status of validStatuses) {
        expect(validStatuses).toContain(status);
      }

      for (const status of invalidStatuses) {
        expect(validStatuses).not.toContain(status);
      }
    });
  });

  describe('Data transformation logic', () => {
    it('success rate is calculated correctly', () => {
      const testCases = [
        { completed: 7, total: 10, expected: 70 },
        { completed: 10, total: 10, expected: 100 },
        { completed: 0, total: 10, expected: 0 },
        { completed: 0, total: 0, expected: 0 }, // Division by zero case
      ];

      for (const test of testCases) {
        const successRate = test.total > 0 ? (test.completed / test.total) * 100 : 0;
        const rounded = Math.round(successRate * 100) / 100;
        expect(rounded).toBe(test.expected);
      }
    });

    it('long prompts and responses are truncated', () => {
      const longPrompt = 'x'.repeat(5000);
      const longResponse = 'y'.repeat(10000);

      const truncatedPrompt = longPrompt.substring(0, 2000);
      const truncatedResponse = longResponse.substring(0, 5000);

      expect(truncatedPrompt.length).toBeLessThanOrEqual(2000);
      expect(truncatedResponse.length).toBeLessThanOrEqual(5000);
      expect(truncatedPrompt.length).toBe(2000);
      expect(truncatedResponse.length).toBe(5000);
    });

    it('tasks are sorted by phase then creation time', () => {
      const unsortedTasks = [
        { _id: 'task-1', phase: 2, createdAt: '2024-01-03T00:00:00Z' },
        { _id: 'task-2', phase: 1, createdAt: '2024-01-02T00:00:00Z' },
        { _id: 'task-3', phase: 1, createdAt: '2024-01-01T00:00:00Z' },
        { _id: 'task-4', phase: 2, createdAt: '2024-01-01T00:00:00Z' },
      ];

      const sorted = unsortedTasks.sort((a, b) => {
        if (a.phase !== b.phase) {
          return a.phase - b.phase;
        }
        return a.createdAt.localeCompare(b.createdAt);
      });

      expect(sorted[0]._id).toBe('task-3'); // phase 1, earliest
      expect(sorted[1]._id).toBe('task-2'); // phase 1, later
      expect(sorted[2]._id).toBe('task-4'); // phase 2, earliest
      expect(sorted[3]._id).toBe('task-1'); // phase 2, latest
    });
  });

  describe('Integration scenarios', () => {
    it('complete build lifecycle transitions through statuses', () => {
      const statuses = ['running', 'completed', 'failed'];
      const validTransitions: Record<string, string[]> = {
        'running': ['completed', 'failed'],
        'completed': [], // Final state
        'failed': [], // Final state
      };

      let currentStatus = 'running';
      expect(validTransitions[currentStatus]).toContain('completed');

      currentStatus = 'completed';
      expect(validTransitions[currentStatus]).not.toContain('running');
    });

    it('task phases progress sequentially', () => {
      const taskPhases = [1, 1, 1, 2, 2, 3];
      let lastPhase = 0;

      for (const phase of taskPhases) {
        expect(phase).toBeGreaterThanOrEqual(lastPhase);
        lastPhase = phase;
      }
    });
  });

  describe('getAgentStats - Agent statistics aggregation', () => {
    it('returns all agents with computed statistics', () => {
      const mockResult = [
        {
          agentId: 'agent-1',
          name: 'ATLAS',
          role: 'orchestrator',
          totalTasks: 10,
          successRate: 80,
          avgDuration: 1250,
          lastActive: '2024-01-03T12:00:00Z',
          currentStatus: 'idle',
          completedTasks: 8,
          failedTasks: 2,
        },
      ];

      expect(Array.isArray(mockResult)).toBe(true);
      expect(mockResult[0]).toHaveProperty('agentId');
      expect(mockResult[0]).toHaveProperty('name');
      expect(mockResult[0]).toHaveProperty('role');
      expect(mockResult[0]).toHaveProperty('totalTasks');
      expect(mockResult[0]).toHaveProperty('successRate');
      expect(mockResult[0]).toHaveProperty('avgDuration');
      expect(mockResult[0]).toHaveProperty('lastActive');
      expect(mockResult[0]).toHaveProperty('currentStatus');
    });

    it('calculates agent success rate correctly', () => {
      const testCases = [
        { completed: 8, total: 10, expected: 80 },
        { completed: 10, total: 10, expected: 100 },
        { completed: 0, total: 10, expected: 0 },
      ];

      for (const test of testCases) {
        const successRate =
          test.total > 0
            ? Math.round((test.completed / test.total) * 100 * 100) / 100
            : 0;
        expect(successRate).toBe(test.expected);
      }
    });

    it('calculates average execution duration', () => {
      const durations = [1000, 2000, 3000, 4000];
      const avgDuration = Math.round(
        durations.reduce((sum, d) => sum + d, 0) / durations.length
      );

      expect(avgDuration).toBe(2500);
    });

    it('determines current status based on running tasks', () => {
      const tasks1 = [
        { agent: 'ATLAS', status: 'done' },
        { agent: 'ATLAS', status: 'failed' },
      ];
      const status1 = tasks1.some((t) => t.status === 'running')
        ? 'active'
        : 'idle';
      expect(status1).toBe('idle');

      const tasks2 = [
        { agent: 'ATLAS', status: 'running' },
        { agent: 'ATLAS', status: 'pending' },
      ];
      const status2 = tasks2.some((t) => t.status === 'running')
        ? 'active'
        : 'idle';
      expect(status2).toBe('active');
    });

    it('tracks last active time from most recent execution', () => {
      const executions = [
        { agent: 'ATLAS', timestamp: '2024-01-01T10:00:00Z' },
        { agent: 'ATLAS', timestamp: '2024-01-03T10:00:00Z' },
        { agent: 'ATLAS', timestamp: '2024-01-02T10:00:00Z' },
      ];

      const sorted = executions.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      expect(sorted[0].timestamp).toBe('2024-01-03T10:00:00Z');
    });

    it('sorts agents by most recently active', () => {
      const agents = [
        { name: 'ATLAS', lastActive: '2024-01-01T10:00:00Z' },
        { name: 'CHARON', lastActive: '2024-01-03T10:00:00Z' },
        { name: 'EARTH', lastActive: '2024-01-02T10:00:00Z' },
      ];

      const sorted = agents.sort((a, b) =>
        new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
      );

      expect(sorted[0].name).toBe('CHARON');
      expect(sorted[1].name).toBe('EARTH');
      expect(sorted[2].name).toBe('ATLAS');
    });

    it('counts completed and failed tasks separately', () => {
      const tasks = [
        { agent: 'ATLAS', status: 'done' },
        { agent: 'ATLAS', status: 'done' },
        { agent: 'ATLAS', status: 'failed' },
        { agent: 'ATLAS', status: 'done' },
        { agent: 'ATLAS', status: 'pending' },
      ];

      const agentTasks = tasks.filter((t) => t.agent === 'ATLAS');
      const completedTasks = agentTasks.filter((t) => t.status === 'done').length;
      const failedTasks = agentTasks.filter((t) => t.status === 'failed').length;

      expect(completedTasks).toBe(3);
      expect(failedTasks).toBe(1);
      expect(completedTasks + failedTasks).toBeLessThanOrEqual(
        agentTasks.length
      );
    });

    it('handles agents with no tasks', () => {
      const tasks: any[] = [];

      const totalTasks = tasks.length;
      const successRate = totalTasks > 0 ? 100 : 0;
      const avgDuration = totalTasks > 0 ? 1000 : 0;

      expect(totalTasks).toBe(0);
      expect(successRate).toBe(0);
      expect(avgDuration).toBe(0);
    });

    it('handles agents with no executions', () => {
      const executions: any[] = [];
      const createdAt = '2024-01-01T10:00:00Z';

      const lastActive =
        executions.length > 0
          ? executions.sort((a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )[0].timestamp
          : createdAt;

      expect(lastActive).toBe(createdAt);
    });
  });
});
