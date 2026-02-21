import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ModuleHealthChecker,
  getModuleHealthChecker,
  resetModuleHealthChecker,
  registerDefaultHealthChecks,
  formatHealthReport,
  type ModuleStatus,
  type HealthReport,
} from '../module-health.js';

describe('ModuleHealthChecker', () => {
  let checker: ModuleHealthChecker;

  beforeEach(() => {
    vi.clearAllMocks();
    checker = new ModuleHealthChecker();
  });

  // ============================================================
  // Basic Health Checks
  // ============================================================

  it('should register and run a health check', async () => {
    checker.registerCheck('test-module', async () => ({
      status: 'healthy',
      message: 'All good',
    }));

    const report = await checker.checkAll();
    expect(report.totalModules).toBe(1);
    expect(report.healthy).toBe(1);
    expect(report.modules[0].status).toBe('healthy');
  });

  it('should handle unhealthy modules', async () => {
    checker.registerCheck('bad-module', async () => ({
      status: 'unhealthy',
      message: 'Connection failed',
    }));

    const report = await checker.checkAll();
    expect(report.unhealthy).toBe(1);
    expect(report.overallStatus).toBe('unhealthy');
  });

  it('should handle degraded modules', async () => {
    checker.registerCheck('slow-module', async () => ({
      status: 'degraded',
      message: 'Latency above threshold',
    }));

    const report = await checker.checkAll();
    expect(report.degraded).toBe(1);
    expect(report.overallStatus).toBe('degraded');
  });

  it('should handle disabled modules', async () => {
    checker.registerCheck('disabled-module', async () => ({
      status: 'disabled',
      message: 'Module is off',
    }));

    const report = await checker.checkAll();
    expect(report.disabled).toBe(1);
    // Disabled doesn't make overall unhealthy
    expect(report.overallStatus).toBe('healthy');
  });

  it('should handle check that throws', async () => {
    checker.registerCheck('crash-module', async () => {
      throw new Error('Check crashed');
    });

    const report = await checker.checkAll();
    expect(report.unhealthy).toBe(1);
    expect(report.modules[0].message).toBe('Check crashed');
  });

  it('should handle check timeout', async () => {
    checker.registerCheck('slow-module', async () => {
      await new Promise(resolve => setTimeout(resolve, 10000));
      return { status: 'healthy' as ModuleStatus, message: 'ok' };
    }, 50); // 50ms timeout

    const report = await checker.checkAll();
    expect(report.unhealthy).toBe(1);
    expect(report.modules[0].message).toBe('Health check timed out');
  }, 10000);

  // ============================================================
  // Multiple Modules
  // ============================================================

  it('should check multiple modules', async () => {
    checker.registerCheck('mod-a', async () => ({ status: 'healthy', message: 'ok' }));
    checker.registerCheck('mod-b', async () => ({ status: 'degraded', message: 'slow' }));
    checker.registerCheck('mod-c', async () => ({ status: 'healthy', message: 'ok' }));

    const report = await checker.checkAll();
    expect(report.totalModules).toBe(3);
    expect(report.healthy).toBe(2);
    expect(report.degraded).toBe(1);
    expect(report.overallStatus).toBe('degraded');
  });

  it('should determine overall status correctly', async () => {
    checker.registerCheck('ok', async () => ({ status: 'healthy', message: 'ok' }));
    checker.registerCheck('bad', async () => ({ status: 'unhealthy', message: 'down' }));
    checker.registerCheck('slow', async () => ({ status: 'degraded', message: 'slow' }));

    const report = await checker.checkAll();
    // Unhealthy takes precedence
    expect(report.overallStatus).toBe('unhealthy');
  });

  it('should track check latency', async () => {
    checker.registerCheck('test', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return { status: 'healthy' as ModuleStatus, message: 'ok' };
    });

    const report = await checker.checkAll();
    expect(report.modules[0].latencyMs).toBeGreaterThanOrEqual(5);
  });

  it('should include details in health result', async () => {
    checker.registerCheck('detailed', async () => ({
      status: 'healthy',
      message: 'ok',
      details: { connections: 5, cacheHitRate: 0.85 },
    }));

    const report = await checker.checkAll();
    expect(report.modules[0].details).toEqual({
      connections: 5,
      cacheHitRate: 0.85,
    });
  });

  // ============================================================
  // Single Module Check
  // ============================================================

  it('should check a single module', async () => {
    checker.registerCheck('target', async () => ({ status: 'healthy', message: 'running' }));
    checker.registerCheck('other', async () => ({ status: 'unhealthy', message: 'down' }));

    const result = await checker.checkModule('target');
    expect(result).not.toBeNull();
    expect(result?.status).toBe('healthy');
    expect(result?.moduleName).toBe('target');
  });

  it('should return null for unknown module', async () => {
    const result = await checker.checkModule('nonexistent');
    expect(result).toBeNull();
  });

  // ============================================================
  // Registration Management
  // ============================================================

  it('should replace existing check on re-register', async () => {
    checker.registerCheck('mod', async () => ({ status: 'unhealthy', message: 'v1' }));
    checker.registerCheck('mod', async () => ({ status: 'healthy', message: 'v2' }));

    const report = await checker.checkAll();
    expect(report.totalModules).toBe(1);
    expect(report.modules[0].message).toBe('v2');
  });

  it('should unregister a check', () => {
    checker.registerCheck('mod', async () => ({ status: 'healthy', message: 'ok' }));
    expect(checker.unregisterCheck('mod')).toBe(true);
    expect(checker.getRegisteredModules()).toHaveLength(0);
  });

  it('should return false when unregistering unknown module', () => {
    expect(checker.unregisterCheck('nonexistent')).toBe(false);
  });

  it('should list registered modules', () => {
    checker.registerCheck('a', async () => ({ status: 'healthy', message: '' }));
    checker.registerCheck('b', async () => ({ status: 'healthy', message: '' }));

    expect(checker.getRegisteredModules()).toEqual(['a', 'b']);
  });

  // ============================================================
  // Last Report
  // ============================================================

  it('should store last report', async () => {
    checker.registerCheck('mod', async () => ({ status: 'healthy', message: 'ok' }));

    expect(checker.getLastReport()).toBeNull();

    await checker.checkAll();

    const report = checker.getLastReport();
    expect(report).not.toBeNull();
    expect(report?.totalModules).toBe(1);
  });

  // ============================================================
  // Default Health Checks
  // ============================================================

  it('should register default checks for enabled modules', async () => {
    registerDefaultHealthChecks(checker, {
      modelRoutingEnabled: true,
      perplexityEnabled: false,
      workflowEngineEnabled: true,
    });

    const report = await checker.checkAll();
    const modelRouting = report.modules.find(m => m.moduleName === 'model-routing');
    const perplexity = report.modules.find(m => m.moduleName === 'perplexity');
    const workflow = report.modules.find(m => m.moduleName === 'workflow-engine');

    expect(modelRouting?.status).toBe('healthy');
    expect(perplexity?.status).toBe('disabled');
    expect(workflow?.status).toBe('healthy');
  });

  // ============================================================
  // Format Report
  // ============================================================

  it('should format health report as readable string', () => {
    const report: HealthReport = {
      timestamp: Date.now(),
      totalModules: 3,
      healthy: 2,
      degraded: 0,
      unhealthy: 1,
      disabled: 0,
      overallStatus: 'unhealthy',
      modules: [
        { moduleName: 'model-routing', status: 'healthy', latencyMs: 5, message: 'ok', lastChecked: Date.now() },
        { moduleName: 'perplexity', status: 'healthy', latencyMs: 3, message: 'ok', lastChecked: Date.now() },
        { moduleName: 'memory', status: 'unhealthy', latencyMs: 5000, message: 'timeout', lastChecked: Date.now() },
      ],
      totalCheckDurationMs: 5008,
    };

    const formatted = formatHealthReport(report);
    expect(formatted).toContain('Module Health Report');
    expect(formatted).toContain('[FAIL] unhealthy');
    expect(formatted).toContain('[OK] model-routing');
    expect(formatted).toContain('[FAIL] memory');
  });

  // ============================================================
  // Singleton
  // ============================================================

  it('should return same global instance', () => {
    resetModuleHealthChecker();
    const c1 = getModuleHealthChecker();
    const c2 = getModuleHealthChecker();
    expect(c1).toBe(c2);
  });

  it('should reset global instance', () => {
    const c1 = getModuleHealthChecker();
    c1.registerCheck('test', async () => ({ status: 'healthy', message: '' }));

    resetModuleHealthChecker();
    const c2 = getModuleHealthChecker();

    expect(c2.getRegisteredModules()).toHaveLength(0);
  });
});
