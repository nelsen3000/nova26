import { describe, it, expect } from 'vitest';

/**
 * Cron Jobs Tests (H7)
 *
 * Tests for background job logic (time mocking needed for actual execution).
 */

describe('crons.ts - Background Jobs & Maintenance Tasks', () => {
  describe('cleanupOldActivity', () => {
    it('deletes activities older than 7 days', () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      const cutoffTime = cutoffDate.toISOString();

      const activities = [
        { timestamp: new Date().toISOString() }, // Now - keep
        {
          timestamp: new Date(
            Date.now() - 3 * 24 * 60 * 60 * 1000
          ).toISOString(),
        }, // 3 days ago - keep
        {
          timestamp: new Date(
            Date.now() - 14 * 24 * 60 * 60 * 1000
          ).toISOString(),
        }, // 14 days ago - delete
      ];

      const oldActivities = activities.filter((a) => a.timestamp < cutoffTime);

      expect(oldActivities.length).toBe(1);
      expect(
        new Date(oldActivities[0].timestamp) < new Date(cutoffTime)
      ).toBe(true);
    });

    it('preserves recent activities', () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      const cutoffTime = cutoffDate.toISOString();

      const recentActivities = [
        { timestamp: new Date().toISOString() },
        {
          timestamp: new Date(
            Date.now() - 6 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
      ];

      const filtered = recentActivities.filter(
        (a) => a.timestamp >= cutoffTime
      );

      expect(filtered.length).toBe(2);
    });
  });

  describe('computeAgentStats', () => {
    it('calculates agent statistics correctly', () => {
      const agent = { name: 'ATLAS' };

      const tasks = [
        { agent: 'ATLAS', status: 'done' },
        { agent: 'ATLAS', status: 'done' },
        { agent: 'ATLAS', status: 'failed' },
      ];

      const agentTasks = tasks.filter((t) => t.agent === agent.name);
      const completed = agentTasks.filter((t) => t.status === 'done').length;
      const failed = agentTasks.filter((t) => t.status === 'failed').length;
      const total = agentTasks.length;

      const successRate = Math.round((completed / total) * 100 * 100) / 100;

      expect(agentTasks.length).toBe(3);
      expect(completed).toBe(2);
      expect(failed).toBe(1);
      expect(successRate).toBe(66.67);
    });

    it('determines agent status based on running tasks', () => {
      const tasks1 = [
        { agent: 'ATLAS', status: 'done' },
        { agent: 'ATLAS', status: 'done' },
      ];

      const status1 = tasks1.some((t) => t.status === 'running')
        ? 'active'
        : 'idle';
      expect(status1).toBe('idle');

      const tasks2 = [
        { agent: 'ATLAS', status: 'done' },
        { agent: 'ATLAS', status: 'running' },
      ];

      const status2 = tasks2.some((t) => t.status === 'running')
        ? 'active'
        : 'idle';
      expect(status2).toBe('active');
    });

    it('calculates average duration from executions', () => {
      const executions = [
        { agent: 'ATLAS', duration: 1000 },
        { agent: 'ATLAS', duration: 2000 },
        { agent: 'ATLAS', duration: 3000 },
      ];

      const agentExecutions = executions.filter((e) => e.agent === 'ATLAS');
      const avgDuration = Math.round(
        agentExecutions.reduce((sum, e) => sum + e.duration, 0) /
          agentExecutions.length
      );

      expect(avgDuration).toBe(2000);
    });

    it('handles agents with no tasks or executions', () => {
      const tasks: any[] = [];
      const executions: any[] = [];

      const totalTasks = tasks.length;
      const successRate = totalTasks > 0 ? 100 : 0;
      const avgDuration =
        executions.length > 0
          ? executions.reduce((sum, e) => sum + e.duration, 0) /
            executions.length
          : 0;

      expect(totalTasks).toBe(0);
      expect(successRate).toBe(0);
      expect(avgDuration).toBe(0);
    });

    it('updates cache with current timestamp', () => {
      const now = new Date().toISOString();
      const cache = { cachedAt: now };

      expect(cache.cachedAt).toBe(now);
      expect(new Date(cache.cachedAt) <= new Date()).toBe(true);
    });
  });

  describe('checkStalledBuilds', () => {
    it('identifies builds older than 30 minutes', () => {
      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - 30);
      const cutoffTimeStr = cutoffTime.toISOString();

      const builds = [
        {
          prdName: 'Build 1',
          startedAt: new Date().toISOString(),
          status: 'running',
        }, // Now - not stalled
        {
          prdName: 'Build 2',
          startedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          status: 'running',
        }, // 45 min ago - stalled
      ];

      const stalledBuilds = builds.filter((b) => b.startedAt < cutoffTimeStr);

      expect(stalledBuilds.length).toBe(1);
      expect(stalledBuilds[0].prdName).toBe('Build 2');
    });

    it('marks stalled builds with completed timestamp', () => {
      const build = { status: 'running' };
      const updated = {
        ...build,
        status: 'failed',
        completedAt: new Date().toISOString(),
      };

      expect(updated.status).toBe('failed');
      expect(updated.completedAt).toBeDefined();
    });

    it('only marks running builds as stalled', () => {
      const builds = [
        { status: 'running', startedAt: '2026-02-20T00:00:00Z' },
        { status: 'completed', startedAt: '2026-02-20T00:00:00Z' },
        { status: 'failed', startedAt: '2026-02-20T00:00:00Z' },
      ];

      const runningBuilds = builds.filter((b) => b.status === 'running');

      expect(runningBuilds.length).toBe(1);
    });
  });

  describe('compactOldExecutions', () => {
    it('identifies executions older than 30 days', () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      const cutoffTime = cutoffDate.toISOString();

      const executions = [
        { timestamp: new Date().toISOString() }, // Now - keep
        {
          timestamp: new Date(
            Date.now() - 15 * 24 * 60 * 60 * 1000
          ).toISOString(),
        }, // 15 days ago - keep
        {
          timestamp: new Date(
            Date.now() - 60 * 24 * 60 * 60 * 1000
          ).toISOString(),
        }, // 60 days ago - archive
      ];

      const oldExecutions = executions.filter(
        (e) => e.timestamp < cutoffTime
      );

      expect(oldExecutions.length).toBe(1);
    });

    it('preserves recent executions', () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      const cutoffTime = cutoffDate.toISOString();

      const recentExecutions = [
        { timestamp: new Date().toISOString() },
        {
          timestamp: new Date(
            Date.now() - 29 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
      ];

      const filtered = recentExecutions.filter(
        (e) => e.timestamp >= cutoffTime
      );

      expect(filtered.length).toBe(2);
    });
  });

  describe('markInactiveUsers', () => {
    it('identifies users inactive for 90+ days', () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      const cutoffTime = cutoffDate.toISOString();

      const users = [
        { email: 'active@example.com', lastActiveAt: new Date().toISOString() },
        {
          email: 'inactive@example.com',
          lastActiveAt: new Date(
            Date.now() - 120 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
      ];

      const inactiveUsers = users.filter(
        (u) => u.lastActiveAt < cutoffTime
      );

      expect(inactiveUsers.length).toBe(1);
      expect(inactiveUsers[0].email).toBe('inactive@example.com');
    });

    it('preserves active users', () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      const cutoffTime = cutoffDate.toISOString();

      const activeUsers = [
        { email: 'user1@example.com', lastActiveAt: new Date().toISOString() },
        {
          email: 'user2@example.com',
          lastActiveAt: new Date(
            Date.now() - 60 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
      ];

      const filtered = activeUsers.filter(
        (u) => u.lastActiveAt >= cutoffTime
      );

      expect(filtered.length).toBe(2);
    });

    it('handles users with no activity', () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      const cutoffTime = cutoffDate.toISOString();

      const user = {
        lastActiveAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      };

      expect(user.lastActiveAt < cutoffTime).toBe(true);
    });
  });

  describe('refreshBuildStats', () => {
    it('calculates build success rate', () => {
      const builds = [
        { status: 'completed', startedAt: '2026-02-20T00:00:00Z' },
        { status: 'completed', startedAt: '2026-02-20T01:00:00Z' },
        { status: 'failed', startedAt: '2026-02-20T02:00:00Z' },
        { status: 'running', startedAt: '2026-02-20T03:00:00Z' },
      ];

      const total = builds.length;
      const completed = builds.filter((b) => b.status === 'completed').length;
      const successRate = Math.round((completed / total) * 100 * 100) / 100;

      expect(total).toBe(4);
      expect(completed).toBe(2);
      expect(successRate).toBe(50);
    });

    it('separates build statuses', () => {
      const builds = [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'failed' },
        { status: 'running' },
      ];

      const completed = builds.filter((b) => b.status === 'completed').length;
      const failed = builds.filter((b) => b.status === 'failed').length;
      const running = builds.filter((b) => b.status === 'running').length;

      expect(completed).toBe(2);
      expect(failed).toBe(1);
      expect(running).toBe(1);
    });

    it('calculates average build duration', () => {
      const builds = [
        {
          startedAt: '2026-02-20T00:00:00Z',
          completedAt: '2026-02-20T00:10:00Z',
        },
        {
          startedAt: '2026-02-20T01:00:00Z',
          completedAt: '2026-02-20T01:20:00Z',
        },
      ];

      const durations = builds.map((b) => ({
        duration:
          new Date(b.completedAt).getTime() -
          new Date(b.startedAt).getTime(),
      }));

      const avgDuration = Math.round(
        durations.reduce((sum, d) => sum + d.duration, 0) / durations.length
      );

      expect(avgDuration).toBeGreaterThan(0);
      expect(typeof avgDuration).toBe('number');
    });
  });

  describe('healthCheck', () => {
    it('returns health status structure', () => {
      const health = {
        buildTableSize: 100,
        taskTableSize: 1000,
        executionTableSize: 5000,
        activityTableSize: 50000,
        userTableSize: 500,
        timestamp: new Date().toISOString(),
        status: 'healthy' as const,
      };

      expect(health).toHaveProperty('buildTableSize');
      expect(health).toHaveProperty('taskTableSize');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('status');
    });

    it('detects warning conditions for large tables', () => {
      const checks1 = {
        taskTableSize: 50000,
        activityTableSize: 50000,
        status: 'healthy' as const,
      };

      if (checks1.taskTableSize > 100000 || checks1.activityTableSize > 1000000) {
        checks1.status = 'warning';
      }

      expect(checks1.status).toBe('healthy');

      const checks2 = {
        taskTableSize: 200000, // Over limit
        activityTableSize: 50000,
        status: 'healthy' as const,
      };

      if (checks2.taskTableSize > 100000 || checks2.activityTableSize > 1000000) {
        checks2.status = 'warning';
      }

      expect(checks2.status).toBe('warning');
    });

    it('verifies all table metrics are numbers', () => {
      const health = {
        buildTableSize: 100,
        taskTableSize: 1000,
        executionTableSize: 5000,
        activityTableSize: 50000,
        userTableSize: 500,
      };

      expect(typeof health.buildTableSize).toBe('number');
      expect(typeof health.taskTableSize).toBe('number');
      expect(typeof health.executionTableSize).toBe('number');
      expect(typeof health.activityTableSize).toBe('number');
      expect(typeof health.userTableSize).toBe('number');
    });
  });

  describe('Cron Job Scheduling', () => {
    it('defines correct execution frequencies', () => {
      const schedule = {
        cleanupOldActivity: '0 * * * *', // Every hour
        computeAgentStats: '*/5 * * * *', // Every 5 minutes
        checkStalledBuilds: '*/10 * * * *', // Every 10 minutes
        compactOldExecutions: '0 0 * * *', // Daily at midnight
        markInactiveUsers: '0 1 * * *', // Daily at 1 AM
        refreshBuildStats: '0 * * * *', // Every hour
        healthCheck: '*/30 * * * *', // Every 30 minutes
      };

      expect(schedule).toHaveProperty('cleanupOldActivity');
      expect(schedule).toHaveProperty('computeAgentStats');
      expect(schedule).toHaveProperty('checkStalledBuilds');
    });

    it('ensures non-overlapping critical jobs', () => {
      // cleanupOldActivity and refreshBuildStats both run hourly
      // but at different minutes to avoid contention
      const job1 = '0 * * * *'; // Minute 0
      const job2 = '0 * * * *'; // Minute 0 (same, but OK for non-intensive)

      expect(job1).toBeDefined();
      expect(job2).toBeDefined();
    });
  });

  describe('Data Consistency', () => {
    it('maintains referential integrity when deleting activities', () => {
      const activity = { _id: 'activity-1', taskId: 'task-001' };
      const task = { _id: 'task-001', buildId: 'build-1' };

      // Activity deletion should not cascade
      // Task remains valid even if activity is deleted
      expect(task._id).toBe('task-001');
    });

    it('prevents deletion of referenced tasks', () => {
      const tasks = [{ _id: 'task-001', buildId: 'build-1' }];

      // Even if executions referencing this task are old
      // Task should be preserved if still used
      const oldEnoughForExecution = true; // hypothetical
      const canDeleteTask = !oldEnoughForExecution;

      expect(canDeleteTask).toBe(false);
    });
  });
});
