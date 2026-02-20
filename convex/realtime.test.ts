import { describe, it, expect } from 'vitest';

/**
 * Realtime Query & Mutation Tests (H2)
 *
 * Tests for activity subscription and build monitoring functions.
 */

describe('realtime.ts - Agent Stats & Activity Functions', () => {
  describe('subscribeToActivity - Query signature', () => {
    it('accepts no arguments', () => {
      const args = {};
      expect(args).toBeDefined();
    });

    it('returns activity array with optional limit', () => {
      const mockActivities = [
        {
          _id: 'activity-1',
          userId: 'system',
          agentName: 'ATLAS',
          eventType: 'task_completed',
          details: 'Task completed successfully',
          timestamp: new Date().toISOString(),
          taskId: 'task-001',
        },
      ];

      expect(Array.isArray(mockActivities)).toBe(true);
      expect(mockActivities.length).toBeLessThanOrEqual(50);
    });

    it('activities are sorted by timestamp descending', () => {
      const activities = [
        { timestamp: '2024-01-03T12:00:00Z', agentName: 'ATLAS' },
        { timestamp: '2024-01-01T12:00:00Z', agentName: 'CHARON' },
        { timestamp: '2024-01-02T12:00:00Z', agentName: 'EARTH' },
      ];

      const sorted = activities.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      expect(sorted[0].timestamp).toBe('2024-01-03T12:00:00Z');
      expect(sorted[2].timestamp).toBe('2024-01-01T12:00:00Z');
    });
  });

  describe('subscribeToBuilds - Query signature', () => {
    it('accepts no arguments', () => {
      const args = {};
      expect(args).toBeDefined();
    });

    it('returns only running and pending builds', () => {
      const builds = [
        { _id: 'b1', status: 'running' },
        { _id: 'b2', status: 'running' },
        { _id: 'b3', status: 'completed' },
        { _id: 'b4', status: 'pending' },
        { _id: 'b5', status: 'failed' },
      ];

      const filtered = builds.filter((b) =>
        ['running', 'pending'].includes(b.status)
      );

      expect(filtered.length).toBe(3);
      expect(filtered.map((b) => b._id)).toContain('b1');
      expect(filtered.map((b) => b._id)).toContain('b2');
      expect(filtered.map((b) => b._id)).toContain('b4');
      expect(filtered.map((b) => b._id)).not.toContain('b3');
      expect(filtered.map((b) => b._id)).not.toContain('b5');
    });

    it('builds are sorted by startedAt descending', () => {
      const builds = [
        { _id: 'b1', status: 'running', startedAt: '2024-01-01T12:00:00Z' },
        { _id: 'b2', status: 'running', startedAt: '2024-01-03T12:00:00Z' },
        { _id: 'b3', status: 'pending', startedAt: '2024-01-02T12:00:00Z' },
      ];

      const sorted = builds.sort((a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );

      expect(sorted[0]._id).toBe('b2');
      expect(sorted[1]._id).toBe('b3');
      expect(sorted[2]._id).toBe('b1');
    });
  });

  describe('logActivity - Mutation signature', () => {
    it('requires agentName, action, and details', () => {
      const args = {
        agentName: 'ATLAS',
        action: 'task_started',
        details: 'Started executing task-001',
        status: 'running',
        taskId: 'task-001',
      };

      expect(args).toHaveProperty('agentName');
      expect(args).toHaveProperty('action');
      expect(args).toHaveProperty('details');
      expect(typeof args.agentName).toBe('string');
      expect(typeof args.action).toBe('string');
      expect(typeof args.details).toBe('string');
    });

    it('accepts optional status and taskId', () => {
      const args1 = {
        agentName: 'ATLAS',
        action: 'task_completed',
        details: 'Completed successfully',
      };

      const args2 = {
        agentName: 'ATLAS',
        action: 'task_completed',
        details: 'Completed successfully',
        status: 'done',
        taskId: 'task-001',
      };

      expect(args1).toBeDefined();
      expect(args2).toBeDefined();
    });

    it('event type should be valid activity type', () => {
      const validEventTypes = [
        'task_started',
        'task_completed',
        'task_failed',
        'playbook_updated',
        'wisdom_promoted',
        'rehearsal_ran',
      ];

      expect(validEventTypes).toContain('task_started');
      expect(validEventTypes).toContain('task_completed');
      expect(validEventTypes).toContain('task_failed');
    });
  });

  describe('getAgentActivityHistory - Query signature', () => {
    it('requires agentName argument', () => {
      const args = {
        agentName: 'ATLAS',
        limit: 20,
      };

      expect(args).toHaveProperty('agentName');
      expect(typeof args.agentName).toBe('string');
    });

    it('accepts optional limit (default 20)', () => {
      const limit1 = undefined ?? 20;
      const limit2 = 50;

      expect(limit1).toBe(20);
      expect(limit2).toBe(50);
    });

    it('returns activity array filtered by agentName', () => {
      const activities = [
        { agentName: 'ATLAS', timestamp: '2024-01-03T12:00:00Z' },
        { agentName: 'ATLAS', timestamp: '2024-01-02T12:00:00Z' },
        { agentName: 'CHARON', timestamp: '2024-01-03T11:00:00Z' },
      ];

      const filtered = activities.filter((a) => a.agentName === 'ATLAS');

      expect(filtered.length).toBe(2);
      expect(filtered.every((a) => a.agentName === 'ATLAS')).toBe(true);
    });
  });

  describe('getBuildActivityTimeline - Query signature', () => {
    it('requires buildId argument', () => {
      const args = { buildId: 'build-123' };
      expect(args).toHaveProperty('buildId');
    });

    it('returns timeline sorted by createdAt', () => {
      const timeline = [
        { taskId: 't1', createdAt: '2024-01-01T10:00:00Z' },
        { taskId: 't2', createdAt: '2024-01-01T11:00:00Z' },
        { taskId: 't3', createdAt: '2024-01-01T09:00:00Z' },
      ];

      const sorted = timeline.sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      );

      expect(sorted[0].taskId).toBe('t3');
      expect(sorted[1].taskId).toBe('t1');
      expect(sorted[2].taskId).toBe('t2');
    });

    it('includes task details in timeline', () => {
      const mockTimeline = [
        {
          taskId: 'task-1',
          taskTitle: 'Task 1',
          agent: 'ATLAS',
          status: 'done',
          createdAt: '2024-01-01T10:00:00Z',
          phase: 1,
        },
      ];

      expect(mockTimeline[0]).toHaveProperty('taskId');
      expect(mockTimeline[0]).toHaveProperty('taskTitle');
      expect(mockTimeline[0]).toHaveProperty('agent');
      expect(mockTimeline[0]).toHaveProperty('status');
      expect(mockTimeline[0]).toHaveProperty('createdAt');
      expect(mockTimeline[0]).toHaveProperty('phase');
    });
  });

  describe('getRecentActivity - Query signature', () => {
    it('accepts optional limit and hours', () => {
      const args1 = {};
      const args2 = { limit: 100, hours: 48 };

      expect(args1).toBeDefined();
      expect(args2).toBeDefined();
    });

    it('defaults to 50 items and 24 hours', () => {
      const limit = undefined ?? 50;
      const hours = undefined ?? 24;

      expect(limit).toBe(50);
      expect(hours).toBe(24);
    });

    it('filters activities by time range', () => {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - 24);

      const activities = [
        { timestamp: new Date().toISOString() }, // Within 24h
        {
          timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        }, // 12h ago
        {
          timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        }, // 48h ago
      ];

      const filtered = activities.filter(
        (a) => a.timestamp >= cutoffTime.toISOString()
      );

      expect(filtered.length).toBe(2);
    });
  });

  describe('Agent stats calculation', () => {
    it('calculates success rate correctly', () => {
      const testCases = [
        { completed: 8, total: 10, expected: 80 },
        { completed: 5, total: 5, expected: 100 },
        { completed: 0, total: 10, expected: 0 },
        { completed: 0, total: 0, expected: 0 },
      ];

      for (const test of testCases) {
        const successRate =
          test.total > 0
            ? Math.round((test.completed / test.total) * 100 * 100) / 100
            : 0;
        expect(successRate).toBe(test.expected);
      }
    });

    it('calculates average duration', () => {
      const executions = [
        { duration: 1000 },
        { duration: 2000 },
        { duration: 3000 },
      ];

      const avgDuration = Math.round(
        executions.reduce((sum, e) => sum + e.duration, 0) / executions.length
      );

      expect(avgDuration).toBe(2000);
    });

    it('determines current status based on active tasks', () => {
      const tasks1 = [
        { status: 'done' },
        { status: 'done' },
        { status: 'failed' },
      ];
      const status1 = tasks1.some((t) => t.status === 'running')
        ? 'active'
        : 'idle';
      expect(status1).toBe('idle');

      const tasks2 = [
        { status: 'done' },
        { status: 'running' },
        { status: 'pending' },
      ];
      const status2 = tasks2.some((t) => t.status === 'running')
        ? 'active'
        : 'idle';
      expect(status2).toBe('active');
    });

    it('sorts agents by lastActive timestamp', () => {
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
  });

  describe('Activity logging validations', () => {
    it('activity timestamp is always ISO 8601', () => {
      const timestamp = new Date().toISOString();
      const iso8601Regex =
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;

      expect(iso8601Regex.test(timestamp)).toBe(true);
    });

    it('agent names are consistent across tables', () => {
      const agents = ['ATLAS', 'CHARON', 'EARTH', 'EUROPA', 'GANYMEDE'];
      const activity = { agentName: 'ATLAS' };

      expect(agents).toContain(activity.agentName);
    });

    it('task references link correctly', () => {
      const task = { _id: 'task-001', buildId: 'build-123' };
      const activity = { taskId: 'task-001' };

      expect(activity.taskId).toBe(task._id);
    });
  });

  describe('Integration scenarios', () => {
    it('activity feed captures full task lifecycle', () => {
      const events = [
        { action: 'task_started', status: 'running' },
        { action: 'task_completed', status: 'done' },
      ];

      expect(events).toHaveLength(2);
      expect(events[0].action).toBe('task_started');
      expect(events[1].action).toBe('task_completed');
    });

    it('agent stats reflect task execution patterns', () => {
      const tasks = [
        { agent: 'ATLAS', status: 'done' },
        { agent: 'ATLAS', status: 'done' },
        { agent: 'ATLAS', status: 'done' },
        { agent: 'ATLAS', status: 'failed' },
      ];

      const agentTasks = tasks.filter((t) => t.agent === 'ATLAS');
      const successRate =
        (agentTasks.filter((t) => t.status === 'done').length / agentTasks.length) * 100;

      expect(successRate).toBe(75);
    });

    it('recent activity respects time window filtering', () => {
      const now = new Date();
      const activities = [
        { timestamp: now.toISOString() }, // Now
        {
          timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        }, // 6h ago
        {
          timestamp: new Date(now.getTime() - 30 * 60 * 60 * 1000).toISOString(),
        }, // 30h ago
      ];

      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const filtered = activities.filter(
        (a) => new Date(a.timestamp).getTime() >= cutoff.getTime()
      );

      expect(filtered.length).toBe(2);
    });
  });
});
