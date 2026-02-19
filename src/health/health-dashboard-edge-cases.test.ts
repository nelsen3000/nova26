// Health Dashboard Edge Cases — R17-10
// KIMI-W-04: 8 edge case tests for health monitoring system

import { describe, it, expect, vi } from 'vitest';
import {
  HealthMonitor,
  createHealthMonitor,
} from './health-dashboard.js';

describe('Health Dashboard Edge Cases', () => {
  describe('HealthMonitor Edge Cases', () => {
    it('should handle health check with empty name', () => {
      const monitor = new HealthMonitor();
      const check = monitor.registerCheck({
        name: '',
        service: 'test-service',
        status: 'unknown',
        responseTime: 0,
        metadata: {},
      });
      expect(check).toBeDefined();
    });

    it('should handle many health checks', () => {
      const monitor = new HealthMonitor();

      // Register 1000 health checks
      for (let i = 0; i < 1000; i++) {
        monitor.registerCheck({
          name: `check-${i}`,
          service: `service-${i}`,
          status: i % 2 === 0 ? 'healthy' : 'unknown',
          responseTime: i,
          metadata: {},
        });
      }

      const dashboard = monitor.getDashboard();
      expect(dashboard.checks.length).toBeGreaterThan(0);
    });

    it('should handle missing health check gracefully', () => {
      const monitor = new HealthMonitor();
      expect(() => monitor.updateCheck('nonexistent', { status: 'healthy' })).toThrow();
    });

    it('should handle rapid health check updates', () => {
      const monitor = new HealthMonitor();
      const check = monitor.registerCheck({
        name: 'test',
        service: 'test-service',
        status: 'unknown',
        responseTime: 0,
        metadata: {},
      });

      monitor.updateCheck(check.id, { responseTime: 100 });
      monitor.updateCheck(check.id, { responseTime: 200 });
      monitor.updateCheck(check.id, { responseTime: 300 });

      const unknownChecks = monitor.getChecksByStatus('unknown');
      expect(unknownChecks).toBeDefined();
    });

    it('should handle metric with extreme value', () => {
      const monitor = new HealthMonitor();
      const metric = monitor.recordMetric({
        type: 'custom',
        name: 'extreme',
        value: Number.MAX_SAFE_INTEGER,
        unit: 'count',
        labels: {},
      });
      expect(metric).toBeDefined();
    });

    it('should handle alert flood', () => {
      const monitor = new HealthMonitor();

      // Create 100 alerts
      for (let i = 0; i < 100; i++) {
        monitor.createAlert({
          severity: ['info', 'warning', 'critical'][i % 3] as 'info' | 'warning' | 'critical',
          title: `Alert ${i}`,
          message: `Alert message ${i}`,
          source: 'test',
        });
      }

      const active = monitor.getActiveAlerts();
      expect(active.length).toBeGreaterThan(0);
    });

    it('should handle alert lifecycle', () => {
      const monitor = new HealthMonitor();
      const alert = monitor.createAlert({
        severity: 'warning',
        title: 'Test Alert',
        message: 'Test',
        source: 'test',
      });

      monitor.acknowledgeAlert(alert.id);
      monitor.resolveAlert(alert.id);

      const active = monitor.getActiveAlerts();
      // Resolved alerts are filtered out of active
      expect(active.find(a => a.id === alert.id)).toBeUndefined();
    });

    it('should handle empty metrics query', () => {
      const monitor = new HealthMonitor();
      const metrics = monitor.getMetrics('custom', 'nonexistent');
      expect(metrics).toEqual([]);
    });
  });

  describe('createHealthMonitor Edge Cases', () => {
    it('should handle custom config', () => {
      const monitor = createHealthMonitor({
        checkInterval: 1000,
        timeout: 500,
        retries: 1,
      });
      expect(monitor).toBeDefined();
    });

    it('should handle extreme intervals', () => {
      const monitor = createHealthMonitor({
        checkInterval: 0,
        timeout: 1,
        retries: 0,
      });
      expect(monitor).toBeDefined();
    });

    it('should handle custom alert thresholds', () => {
      const monitor = createHealthMonitor({
        alertThresholds: {
          cpu: 100,
          memory: 100,
          disk: 100,
        },
      });
      expect(monitor).toBeDefined();
    });
  });
});
