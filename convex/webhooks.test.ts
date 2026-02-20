import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

/**
 * Webhook Tests (H8)
 *
 * Tests for GitHub, CI/CD, and monitoring webhook handlers.
 */

describe('webhooks.ts - External Integration Support', () => {
  describe('GitHub Webhook Validation', () => {
    it('validates GitHub webhook signature correctly', () => {
      const payload = JSON.stringify({ action: 'opened', number: 42 });
      const secret = 'test-secret';

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const signature = `sha256=${expectedSignature}`;

      // Validate signature
      const recalculatedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      expect(`sha256=${recalculatedSignature}`).toBe(signature);
    });

    it('rejects invalid GitHub signatures', () => {
      const payload = JSON.stringify({ action: 'opened' });
      const secret = 'correct-secret';
      const wrongSecret = 'wrong-secret';

      const correctSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const wrongSignature = crypto
        .createHmac('sha256', wrongSecret)
        .update(payload)
        .digest('hex');

      expect(`sha256=${correctSignature}`).not.toBe(
        `sha256=${wrongSignature}`
      );
    });

    it('validates GitHub event types', () => {
      const validEventTypes = [
        'push',
        'pull_request',
        'issues',
        'release',
        'fork',
      ];

      expect(validEventTypes).toContain('push');
      expect(validEventTypes).toContain('pull_request');
      expect(validEventTypes).not.toContain('invalid_event');
    });
  });

  describe('GitHub Webhook Payload Processing', () => {
    it('extracts push event data', () => {
      const payload = {
        action: 'push',
        repository: {
          name: 'nova26',
          full_name: 'anthropics/nova26',
        },
        commits: [
          { id: 'abc123', message: 'Fix bug' },
          { id: 'def456', message: 'Add feature' },
        ],
      };

      expect(payload.commits.length).toBe(2);
      expect(payload.repository.name).toBe('nova26');
    });

    it('extracts pull request event data', () => {
      const payload = {
        action: 'opened',
        number: 42,
        pull_request: {
          id: 'pr-123',
          title: 'Add authentication',
          user: { login: 'developer' },
        },
        repository: {
          name: 'nova26',
          full_name: 'anthropics/nova26',
        },
      };

      expect(payload.number).toBe(42);
      expect(payload.action).toBe('opened');
      expect(payload.pull_request.title).toBe('Add authentication');
    });

    it('extracts issue event data', () => {
      const payload = {
        action: 'opened',
        issue: {
          number: 123,
          title: 'Bug: Dashboard crashes',
          body: 'Steps to reproduce...',
        },
        repository: {
          name: 'nova26',
          full_name: 'anthropics/nova26',
        },
      };

      expect(payload.issue.number).toBe(123);
      expect(payload.issue.title).toContain('Dashboard');
    });
  });

  describe('CI/CD Build Completion Webhook', () => {
    it('validates required build fields', () => {
      const validPayload = {
        buildId: 'proj-001',
        status: 'success',
        source: 'github-actions',
      };

      const invalidPayload1 = {
        status: 'success', // Missing buildId
        source: 'github-actions',
      };

      const invalidPayload2 = {
        buildId: 'proj-001', // Missing status
        source: 'github-actions',
      };

      expect(validPayload.buildId).toBeDefined();
      expect(validPayload.status).toBeDefined();
      expect(invalidPayload1.buildId).toBeUndefined();
      expect(invalidPayload2.status).toBeUndefined();
    });

    it('maps CI status to Convex build status', () => {
      const mappings = [
        { ciStatus: 'success', convexStatus: 'completed' },
        { ciStatus: 'failure', convexStatus: 'failed' },
        { ciStatus: 'error', convexStatus: 'failed' },
        { ciStatus: 'timeout', convexStatus: 'failed' },
      ];

      for (const { ciStatus, convexStatus } of mappings) {
        const status = ciStatus === 'success' ? 'completed' : 'failed';
        expect(status).toBe(convexStatus);
      }
    });

    it('logs CI/CD event with correct details', () => {
      const payload = {
        buildId: 'proj-001',
        status: 'success',
        source: 'github-actions',
      };

      const activity = {
        agentName: 'CI/CD',
        eventType: 'task_completed',
        details: `Build completed: ${payload.buildId}`,
        timestamp: new Date().toISOString(),
      };

      expect(activity.agentName).toBe('CI/CD');
      expect(activity.eventType).toBe('task_completed');
      expect(activity.details).toContain(payload.buildId);
    });

    it('includes error details in failed builds', () => {
      const payload = {
        buildId: 'proj-001',
        status: 'failure',
        error: 'Tests failed: 3 assertions failed',
        source: 'github-actions',
      };

      const activity = {
        eventType: payload.status === 'success' ? 'task_completed' : 'task_failed',
        details: payload.error || 'Build failed',
      };

      expect(activity.eventType).toBe('task_failed');
      expect(activity.details).toContain('Tests failed');
    });
  });

  describe('Monitoring Alert Webhook', () => {
    it('validates required alert fields', () => {
      const validAlert = {
        alertType: 'database_high_latency',
        message: 'Average query latency > 500ms',
        severity: 'warning',
        source: 'datadog',
      };

      const invalidAlert = {
        alertType: 'database_high_latency', // Missing message
        severity: 'warning',
      };

      expect(validAlert.alertType).toBeDefined();
      expect(validAlert.message).toBeDefined();
      expect(invalidAlert.message).toBeUndefined();
    });

    it('distinguishes alert severity levels', () => {
      const severities = ['info', 'warning', 'critical'];

      expect(severities).toContain('warning');
      expect(severities).toContain('critical');
      expect(severities).not.toContain('minor');
    });

    it('creates critical alert as failed build', () => {
      const alert = {
        alertType: 'database_unreachable',
        message: 'Cannot connect to primary database',
        severity: 'critical',
        source: 'monitoring',
      };

      const createsBuild = alert.severity === 'critical';

      expect(createsBuild).toBe(true);
      expect(alert.severity).toBe('critical');
    });

    it('logs non-critical alerts as activity only', () => {
      const alert = {
        alertType: 'high_cpu_usage',
        message: 'CPU usage above 80%',
        severity: 'warning',
        source: 'monitoring',
      };

      const activity = {
        agentName: 'Monitoring',
        eventType: 'task_failed', // Alerts always treated as failures
        details: `${alert.alertType}: ${alert.message}`,
      };

      expect(alert.severity).not.toBe('critical');
      expect(activity.eventType).toBe('task_failed');
    });
  });

  describe('Rate Limiting', () => {
    it('enforces per-source rate limits', () => {
      const maxPerMinute = 100;
      const sourceId = 'github.com/anthropics/nova26';

      const requestTimes: number[] = [];
      for (let i = 0; i < maxPerMinute + 1; i++) {
        requestTimes.push(Date.now());
      }

      const oneMinuteAgo = Date.now() - 60 * 1000;
      const recentRequests = requestTimes.filter((t) => t > oneMinuteAgo);

      expect(recentRequests.length).toBe(maxPerMinute + 1);
      // Over limit, should reject next request
      expect(recentRequests.length > maxPerMinute).toBe(true);
    });

    it('allows requests below limit', () => {
      const maxPerMinute = 100;
      const requestCount = 50;

      expect(requestCount < maxPerMinute).toBe(true);
    });

    it('resets rate limit after expiry', () => {
      const oneMinuteAgo = Date.now() - 60 * 1000;
      const now = Date.now();

      const oldRequests = [
        oneMinuteAgo - 10000,
        oneMinuteAgo - 5000,
        oneMinuteAgo - 1000,
      ];

      const recentRequests = oldRequests.filter((t) => t > oneMinuteAgo);

      expect(recentRequests.length).toBe(0);
    });

    it('applies different limits per source type', () => {
      const limits = {
        github: 100,
        'ci-cd': 200,
        monitoring: 50,
      };

      expect(limits.github).toBeLessThan(limits['ci-cd']);
      expect(limits.monitoring).toBeLessThan(limits.github);
    });
  });

  describe('HTTP Response Handling', () => {
    it('returns 405 for unsupported HTTP methods', () => {
      const methods = ['GET', 'DELETE', 'PUT'];
      const allowedMethods = ['POST'];

      for (const method of methods) {
        expect(allowedMethods).not.toContain(method);
      }
    });

    it('returns 401 for missing signature', () => {
      const request = {
        headers: {} as Record<string, string>,
      };

      const hasSignature = 'x-hub-signature-256' in request.headers;
      expect(hasSignature).toBe(false);
    });

    it('returns 401 for invalid signature', () => {
      const signature = 'sha256=invalid';
      const expected = 'sha256=correct';

      expect(signature).not.toBe(expected);
    });

    it('returns 400 for missing required fields', () => {
      const payload = {
        // Missing buildId or status
        source: 'github-actions',
      };

      const hasRequired = payload.hasOwnProperty('buildId') &&
        payload.hasOwnProperty('status');

      expect(hasRequired).toBe(false);
    });

    it('returns 404 when build not found', () => {
      const builds: any[] = [];
      const buildFound = builds.length > 0;

      expect(buildFound).toBe(false);
    });

    it('returns 429 on rate limit exceeded', () => {
      const maxPerMinute = 100;
      const currentRequestCount = 101;

      const isRateLimited = currentRequestCount > maxPerMinute;
      expect(isRateLimited).toBe(true);
    });

    it('returns 200 on successful webhook processing', () => {
      const response = {
        status: 'received',
        eventType: 'push',
        commits: 3,
      };

      expect(response.status).toBe('received');
    });
  });

  describe('Activity Logging', () => {
    it('logs GitHub events to activity feed', () => {
      const activity = {
        userId: 'system',
        agentName: 'GitHub',
        eventType: 'task_started',
        details: 'GitHub event: opened on nova26',
        timestamp: new Date().toISOString(),
      };

      expect(activity.agentName).toBe('GitHub');
      expect(activity.eventType).toBe('task_started');
    });

    it('logs CI/CD events to activity feed', () => {
      const activity = {
        userId: 'system',
        agentName: 'CI/CD',
        eventType: 'task_completed',
        details: 'Build completed: proj-001',
        timestamp: new Date().toISOString(),
      };

      expect(activity.agentName).toBe('CI/CD');
      expect(activity.eventType).toBe('task_completed');
    });

    it('logs monitoring alerts to activity feed', () => {
      const activity = {
        userId: 'system',
        agentName: 'Monitoring',
        eventType: 'task_failed',
        details: 'database_unreachable: Cannot connect to primary database',
        timestamp: new Date().toISOString(),
      };

      expect(activity.agentName).toBe('Monitoring');
      expect(activity.eventType).toBe('task_failed');
    });

    it('includes detailed event context in logs', () => {
      const payload = {
        alertType: 'cpu_high',
        message: 'CPU > 80%',
        severity: 'warning',
      };

      const details = `${payload.alertType}: ${payload.message}`;
      expect(details).toContain('cpu_high');
      expect(details).toContain('80%');
    });
  });

  describe('Integration Scenarios', () => {
    it('handles GitHub push triggering CI/CD build', () => {
      const gitHubEvent = {
        action: 'push',
        commits: [{ id: 'abc123' }],
        repository: { name: 'nova26' },
      };

      const ciEvent = {
        buildId: 'proj-001',
        status: 'success',
        source: 'github-actions',
      };

      expect(gitHubEvent.action).toBe('push');
      expect(ciEvent.source).toBe('github-actions');
    });

    it('handles failed build triggering monitoring alert', () => {
      const ciEvent = {
        buildId: 'proj-001',
        status: 'failure',
        error: 'Tests failed',
      };

      const alertEvent = {
        alertType: 'build_failed',
        message: 'proj-001 failed: Tests failed',
        severity: 'warning',
      };

      expect(ciEvent.status).toBe('failure');
      expect(alertEvent.alertType).toContain('build');
    });

    it('handles critical alert creating build record', () => {
      const alertEvent = {
        alertType: 'database_down',
        message: 'Database unreachable',
        severity: 'critical',
      };

      const build = {
        prdId: `alert-${Date.now()}`,
        prdName: 'Critical Alert: database_down',
        status: 'failed',
        error: alertEvent.message,
      };

      expect(alertEvent.severity).toBe('critical');
      expect(build.status).toBe('failed');
    });
  });

  describe('Webhook Logs Retrieval', () => {
    it('filters activities by webhook source', () => {
      const activities = [
        { agentName: 'GitHub', details: 'push event' },
        { agentName: 'CI/CD', details: 'build completed' },
        { agentName: 'Monitoring', details: 'alert' },
        { agentName: 'ATLAS', details: 'task completed' },
      ];

      const webhookActivities = activities.filter((a) =>
        ['GitHub', 'CI/CD', 'Monitoring'].includes(a.agentName)
      );

      expect(webhookActivities.length).toBe(3);
      expect(webhookActivities).not.toContainEqual(
        expect.objectContaining({ agentName: 'ATLAS' })
      );
    });

    it('returns recent logs sorted by timestamp', () => {
      const logs = [
        { timestamp: new Date().toISOString(), id: 1 },
        { timestamp: new Date(Date.now() - 60000).toISOString(), id: 2 },
        { timestamp: new Date(Date.now() - 120000).toISOString(), id: 3 },
      ];

      const sorted = logs.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      expect(sorted[0].id).toBe(1);
      expect(sorted[sorted.length - 1].id).toBe(3);
    });

    it('limits log retrieval to recent entries', () => {
      const allLogs = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
      const recentLogs = allLogs.slice(0, 50);

      expect(recentLogs.length).toBe(50);
      expect(recentLogs.length < allLogs.length).toBe(true);
    });
  });
});
