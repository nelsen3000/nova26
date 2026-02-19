// Health Dashboard
// KIMI-R17-08: R17 spec

import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
export type MetricType = 'cpu' | 'memory' | 'disk' | 'network' | 'custom';

export interface HealthCheck {
  id: string;
  name: string;
  service: string;
  status: HealthStatus;
  responseTime: number;
  lastChecked: string;
  message?: string;
  metadata: Record<string, unknown>;
}

export interface SystemMetric {
  id: string;
  type: MetricType;
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  labels: Record<string, string>;
  threshold?: {
    warning: number;
    critical: number;
  };
}

export interface HealthDashboard {
  timestamp: string;
  overallStatus: HealthStatus;
  checks: HealthCheck[];
  metrics: SystemMetric[];
  alerts: Alert[];
  uptime: Record<string, number>; // service -> percentage
}

export interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  source: string;
  timestamp: string;
  acknowledged: boolean;
  resolvedAt?: string;
}

export interface HealthConfig {
  checkInterval: number;
  timeout: number;
  retries: number;
  alertThresholds: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const HealthCheckSchema = z.object({
  id: z.string(),
  name: z.string(),
  service: z.string(),
  status: z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
  responseTime: z.number(),
  lastChecked: z.string(),
  message: z.string().optional(),
  metadata: z.record(z.unknown()),
});

export const SystemMetricSchema = z.object({
  id: z.string(),
  type: z.enum(['cpu', 'memory', 'disk', 'network', 'custom']),
  name: z.string(),
  value: z.number(),
  unit: z.string(),
  timestamp: z.string(),
  labels: z.record(z.string()),
  threshold: z.object({ warning: z.number(), critical: z.number() }).optional(),
});

// ============================================================================
// HealthMonitor Class
// ============================================================================

export class HealthMonitor {
  private checks = new Map<string, HealthCheck>();
  private metrics: SystemMetric[] = [];
  private alerts: Alert[] = [];
  private _config: HealthConfig;

  constructor(configArg?: Partial<HealthConfig>) {
    this._config = {
      checkInterval: 30000,
      timeout: 5000,
      retries: 3,
      alertThresholds: { cpu: 80, memory: 85, disk: 90 },
      ...configArg,
    };
  }

  getConfig(): HealthConfig {
    return this._config;
  }

  registerCheck(check: Omit<HealthCheck, 'id' | 'lastChecked'>): HealthCheck {
    const newCheck: HealthCheck = {
      ...check,
      id: crypto.randomUUID(),
      lastChecked: new Date().toISOString(),
    };

    this.checks.set(newCheck.id, newCheck);
    return newCheck;
  }

  updateCheck(id: string, updates: Partial<HealthCheck>): HealthCheck {
    const check = this.checks.get(id);
    if (!check) throw new Error(`Check not found: ${id}`);

    const updated = { ...check, ...updates, lastChecked: new Date().toISOString() };
    this.checks.set(id, updated);

    // Generate alert if status degraded
    if (updates.status && updates.status !== 'healthy' && check.status === 'healthy') {
      this.createAlert({
        severity: updates.status === 'unhealthy' ? 'critical' : 'warning',
        title: `${check.name} is ${updates.status}`,
        message: updates.message || `Status changed to ${updates.status}`,
        source: check.service,
      });
    }

    return updated;
  }

  recordMetric(metric: Omit<SystemMetric, 'id' | 'timestamp'>): SystemMetric {
    const newMetric: SystemMetric = {
      ...metric,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    this.metrics.push(newMetric);

    // Check thresholds
    if (metric.threshold) {
      if (metric.value >= metric.threshold.critical) {
        this.createAlert({
          severity: 'critical',
          title: `${metric.name} critical`,
          message: `${metric.name} is ${metric.value}${metric.unit}`,
          source: metric.labels.service || 'system',
        });
      } else if (metric.value >= metric.threshold.warning) {
        this.createAlert({
          severity: 'warning',
          title: `${metric.name} warning`,
          message: `${metric.name} is ${metric.value}${metric.unit}`,
          source: metric.labels.service || 'system',
        });
      }
    }

    // Prune old metrics (keep last 1000)
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    return newMetric;
  }

  createAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>): Alert {
    const newAlert: Alert = {
      ...alert,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };

    this.alerts.push(newAlert);
    return newAlert;
  }

  acknowledgeAlert(id: string): Alert {
    const alert = this.alerts.find(a => a.id === id);
    if (!alert) throw new Error(`Alert not found: ${id}`);

    alert.acknowledged = true;
    return alert;
  }

  resolveAlert(id: string): Alert {
    const alert = this.alerts.find(a => a.id === id);
    if (!alert) throw new Error(`Alert not found: ${id}`);

    alert.resolvedAt = new Date().toISOString();
    return alert;
  }

  getDashboard(): HealthDashboard {
    const checks = Array.from(this.checks.values());
    const overallStatus = this.calculateOverallStatus(checks);

    return {
      timestamp: new Date().toISOString(),
      overallStatus,
      checks,
      metrics: this.metrics.slice(-100),
      alerts: this.alerts.filter(a => !a.resolvedAt),
      uptime: this.calculateUptime(),
    };
  }

  getChecksByStatus(status: HealthStatus): HealthCheck[] {
    return Array.from(this.checks.values()).filter(c => c.status === status);
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolvedAt);
  }

  getMetrics(type?: MetricType, name?: string): SystemMetric[] {
    let metrics = this.metrics;

    if (type) {
      metrics = metrics.filter(m => m.type === type);
    }
    if (name) {
      metrics = metrics.filter(m => m.name === name);
    }

    return metrics;
  }

  // ---- Private Methods ----

  private calculateOverallStatus(checks: HealthCheck[]): HealthStatus {
    if (checks.length === 0) return 'unknown';
    if (checks.some(c => c.status === 'unhealthy')) return 'unhealthy';
    if (checks.some(c => c.status === 'degraded')) return 'degraded';
    if (checks.some(c => c.status === 'unknown')) return 'unknown';
    return 'healthy';
  }

  private calculateUptime(): Record<string, number> {
    // Simplified uptime calculation
    const uptime: Record<string, number> = {};
    
    for (const check of this.checks.values()) {
      if (!uptime[check.service]) {
        uptime[check.service] = check.status === 'healthy' ? 100 : 99.9;
      }
    }

    return uptime;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createHealthMonitor(config?: Partial<HealthConfig>): HealthMonitor {
  return new HealthMonitor(config);
}

export function statusToColor(status: HealthStatus): string {
  const colors = {
    healthy: '#22c55e',
    degraded: '#eab308',
    unhealthy: '#ef4444',
    unknown: '#6b7280',
  };
  return colors[status];
}

export function calculateAvailability(minutes: number, downtimeMinutes: number): number {
  if (minutes === 0) return 100;
  return ((minutes - downtimeMinutes) / minutes) * 100;
}
