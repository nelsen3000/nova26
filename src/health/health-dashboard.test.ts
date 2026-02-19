// Tests for Health Dashboard
// KIMI-R17-08

import { describe, it, expect, beforeEach } from 'vitest';
import {
  HealthMonitor,
  createHealthMonitor,
  statusToColor,
  calculateAvailability,
  HealthCheckSchema,
  SystemMetricSchema,
} from './health-dashboard.js';

describe('HealthMonitor', () => {
  let monitor: HealthMonitor;

  beforeEach(() => {
    monitor = new HealthMonitor();
  });

  describe('registerCheck', () => {
    it('registers health check', () => {
      const check = monitor.registerCheck({
        name: 'API Health',
        service: 'api',
        status: 'healthy',
        responseTime: 50,
        metadata: {},
      });

      expect(check.id).toBeDefined();
      expect(check.name).toBe('API Health');
    });
  });

  describe('updateCheck', () => {
    it('updates check status', () => {
      const check = monitor.registerCheck({ name: 'API', service: 'api', status: 'healthy', responseTime: 50, metadata: {} });
      const updated = monitor.updateCheck(check.id, { status: 'degraded', message: 'Slow response' });

      expect(updated.status).toBe('degraded');
      expect(updated.message).toBe('Slow response');
    });

    it('creates alert on degradation', () => {
      const check = monitor.registerCheck({ name: 'API', service: 'api', status: 'healthy', responseTime: 50, metadata: {} });
      monitor.updateCheck(check.id, { status: 'unhealthy' });

      const alerts = monitor.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  describe('recordMetric', () => {
    it('records metric', () => {
      const metric = monitor.recordMetric({
        type: 'cpu',
        name: 'cpu_usage',
        value: 45,
        unit: '%',
        labels: { service: 'api' },
      });

      expect(metric.id).toBeDefined();
      expect(metric.value).toBe(45);
    });

    it('creates alert on threshold breach', () => {
      monitor.recordMetric({
        type: 'cpu',
        name: 'cpu_usage',
        value: 95,
        unit: '%',
        labels: { service: 'api' },
        threshold: { warning: 70, critical: 90 },
      });

      const alerts = monitor.getActiveAlerts();
      expect(alerts.some(a => a.severity === 'critical')).toBe(true);
    });
  });

  describe('alert management', () => {
    it('acknowledges alert', () => {
      monitor.recordMetric({
        type: 'cpu',
        name: 'cpu_usage',
        value: 95,
        unit: '%',
        labels: {},
        threshold: { warning: 70, critical: 90 },
      });

      const alert = monitor.getActiveAlerts()[0];
      const acknowledged = monitor.acknowledgeAlert(alert.id);

      expect(acknowledged.acknowledged).toBe(true);
    });

    it('resolves alert', () => {
      monitor.recordMetric({
        type: 'cpu',
        name: 'cpu_usage',
        value: 95,
        unit: '%',
        labels: {},
        threshold: { warning: 70, critical: 90 },
      });

      const alert = monitor.getActiveAlerts()[0];
      const resolved = monitor.resolveAlert(alert.id);

      expect(resolved.resolvedAt).toBeDefined();
    });
  });

  describe('getDashboard', () => {
    it('returns complete dashboard', () => {
      monitor.registerCheck({ name: 'API', service: 'api', status: 'healthy', responseTime: 50, metadata: {} });
      monitor.recordMetric({ type: 'cpu', name: 'cpu', value: 50, unit: '%', labels: {} });

      const dashboard = monitor.getDashboard();

      expect(dashboard.overallStatus).toBeDefined();
      expect(dashboard.checks).toHaveLength(1);
      expect(dashboard.metrics.length).toBeGreaterThan(0);
    });

    it('calculates overall status as healthy', () => {
      monitor.registerCheck({ name: 'API', service: 'api', status: 'healthy', responseTime: 50, metadata: {} });

      const dashboard = monitor.getDashboard();

      expect(dashboard.overallStatus).toBe('healthy');
    });

    it('calculates overall status as unhealthy', () => {
      monitor.registerCheck({ name: 'API', service: 'api', status: 'unhealthy', responseTime: 50, metadata: {} });

      const dashboard = monitor.getDashboard();

      expect(dashboard.overallStatus).toBe('unhealthy');
    });
  });

  describe('getChecksByStatus', () => {
    it('filters by status', () => {
      monitor.registerCheck({ name: 'Healthy', service: 'api', status: 'healthy', responseTime: 50, metadata: {} });
      monitor.registerCheck({ name: 'Unhealthy', service: 'web', status: 'unhealthy', responseTime: 50, metadata: {} });

      const unhealthy = monitor.getChecksByStatus('unhealthy');

      expect(unhealthy).toHaveLength(1);
    });
  });

  describe('getMetrics', () => {
    it('filters by type', () => {
      monitor.recordMetric({ type: 'cpu', name: 'cpu', value: 50, unit: '%', labels: {} });
      monitor.recordMetric({ type: 'memory', name: 'mem', value: 60, unit: '%', labels: {} });

      const cpu = monitor.getMetrics('cpu');

      expect(cpu.every(m => m.type === 'cpu')).toBe(true);
    });
  });
});

describe('Helper Functions', () => {
  it('createHealthMonitor creates instance', () => {
    const instance = createHealthMonitor();
    expect(instance).toBeInstanceOf(HealthMonitor);
  });

  it('statusToColor returns correct colors', () => {
    expect(statusToColor('healthy')).toBe('#22c55e');
    expect(statusToColor('degraded')).toBe('#eab308');
    expect(statusToColor('unhealthy')).toBe('#ef4444');
  });

  it('calculateAvailability calculates correctly', () => {
    expect(calculateAvailability(100, 0)).toBe(100);
    expect(calculateAvailability(100, 10)).toBe(90);
    expect(calculateAvailability(0, 0)).toBe(100);
  });
});

describe('Zod Schemas', () => {
  it('validates health check', () => {
    const check = {
      id: 'c1',
      name: 'API',
      service: 'api',
      status: 'healthy',
      responseTime: 50,
      lastChecked: new Date().toISOString(),
      metadata: {},
    };
    const result = HealthCheckSchema.safeParse(check);
    expect(result.success).toBe(true);
  });

  it('validates system metric', () => {
    const metric = {
      id: 'm1',
      type: 'cpu',
      name: 'cpu_usage',
      value: 50,
      unit: '%',
      timestamp: new Date().toISOString(),
      labels: { service: 'api' },
    };
    const result = SystemMetricSchema.safeParse(metric);
    expect(result.success).toBe(true);
  });
});
