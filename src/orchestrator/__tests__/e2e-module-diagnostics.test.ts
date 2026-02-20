// SN-21: Module Health + Diagnostics E2E Test
// Tests health check registration, execution, reporting, and default module wiring

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ModuleHealthChecker,
  registerDefaultHealthChecks,
  formatHealthReport,
  getModuleHealthChecker,
  resetModuleHealthChecker,
  type ModuleStatus,
  type HealthReport,
} from '../module-health.js';
import type { RalphLoopOptions } from '../ralph-loop-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOptions(overrides: Partial<RalphLoopOptions> = {}): RalphLoopOptions {
  return {
    modelRoutingEnabled: true,
    cinematicObservabilityEnabled: true,
    workflowEngineEnabled: true,
    infiniteMemoryEnabled: true,
    perplexityEnabled: true,
    aiModelDatabaseEnabled: true,
    crdtCollaborationEnabled: true,
    ...overrides,
  } as RalphLoopOptions;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E2E Module Diagnostics', () => {
  let checker: ModuleHealthChecker;

  beforeEach(() => {
    vi.clearAllMocks();
    resetModuleHealthChecker();
    checker = new ModuleHealthChecker();
  });

  describe('Health check registration', () => {
    it('should register and list module checks', () => {
      checker.registerCheck('model-routing', async () => ({
        status: 'healthy', message: 'OK',
      }));
      checker.registerCheck('perplexity', async () => ({
        status: 'healthy', message: 'OK',
      }));

      const modules = checker.getRegisteredModules();
      expect(modules).toContain('model-routing');
      expect(modules).toContain('perplexity');
      expect(modules).toHaveLength(2);
    });

    it('should replace duplicate module registrations', () => {
      checker.registerCheck('model-routing', async () => ({
        status: 'healthy', message: 'v1',
      }));
      checker.registerCheck('model-routing', async () => ({
        status: 'degraded', message: 'v2',
      }));

      expect(checker.getRegisteredModules()).toHaveLength(1);
    });

    it('should unregister module checks', () => {
      checker.registerCheck('removable', async () => ({
        status: 'healthy', message: 'OK',
      }));
      expect(checker.unregisterCheck('removable')).toBe(true);
      expect(checker.getRegisteredModules()).toHaveLength(0);
    });

    it('should return false when unregistering unknown module', () => {
      expect(checker.unregisterCheck('nonexistent')).toBe(false);
    });
  });

  describe('Health check execution', () => {
    it('should return healthy status for passing checks', async () => {
      checker.registerCheck('model-routing', async () => ({
        status: 'healthy' as ModuleStatus, message: 'Operational',
      }));

      const report = await checker.checkAll();
      expect(report.healthy).toBe(1);
      expect(report.overallStatus).toBe('healthy');
      expect(report.modules[0].message).toBe('Operational');
    });

    it('should mark overall as degraded when any module is degraded', async () => {
      checker.registerCheck('healthy-mod', async () => ({
        status: 'healthy' as ModuleStatus, message: 'OK',
      }));
      checker.registerCheck('degraded-mod', async () => ({
        status: 'degraded' as ModuleStatus, message: 'Slow',
      }));

      const report = await checker.checkAll();
      expect(report.overallStatus).toBe('degraded');
      expect(report.degraded).toBe(1);
      expect(report.healthy).toBe(1);
    });

    it('should mark overall as unhealthy when any module fails', async () => {
      checker.registerCheck('healthy-mod', async () => ({
        status: 'healthy' as ModuleStatus, message: 'OK',
      }));
      checker.registerCheck('broken-mod', async () => {
        throw new Error('Connection refused');
      });

      const report = await checker.checkAll();
      expect(report.overallStatus).toBe('unhealthy');
      expect(report.unhealthy).toBe(1);
      expect(report.modules.find(m => m.moduleName === 'broken-mod')?.message)
        .toBe('Connection refused');
    });

    it('should measure latency for each check', async () => {
      checker.registerCheck('slow-mod', async () => {
        await new Promise(r => setTimeout(r, 10));
        return { status: 'healthy' as ModuleStatus, message: 'OK' };
      });

      const report = await checker.checkAll();
      expect(report.modules[0].latencyMs).toBeGreaterThanOrEqual(5);
    });

    it('should check a single module', async () => {
      checker.registerCheck('target', async () => ({
        status: 'healthy' as ModuleStatus, message: 'Single check',
      }));

      const result = await checker.checkModule('target');
      expect(result).not.toBeNull();
      expect(result!.status).toBe('healthy');
      expect(result!.message).toBe('Single check');
    });

    it('should return null for unknown module check', async () => {
      const result = await checker.checkModule('nonexistent');
      expect(result).toBeNull();
    });

    it('should include details in health result', async () => {
      checker.registerCheck('detailed', async () => ({
        status: 'healthy' as ModuleStatus,
        message: 'OK',
        details: { connections: 5, queueDepth: 0 },
      }));

      const report = await checker.checkAll();
      expect(report.modules[0].details).toEqual({ connections: 5, queueDepth: 0 });
    });
  });

  describe('Default health checks for R22-R24 modules', () => {
    it('should register all 7 modules when all enabled', async () => {
      const opts = makeOptions();
      registerDefaultHealthChecks(checker, opts);

      const modules = checker.getRegisteredModules();
      expect(modules).toHaveLength(7);
      expect(modules).toContain('model-routing');
      expect(modules).toContain('perplexity');
      expect(modules).toContain('workflow-engine');
      expect(modules).toContain('infinite-memory');
      expect(modules).toContain('cinematic-observability');
      expect(modules).toContain('ai-model-database');
      expect(modules).toContain('crdt-collaboration');
    });

    it('should report enabled modules as healthy', async () => {
      registerDefaultHealthChecks(checker, makeOptions());

      const report = await checker.checkAll();
      expect(report.healthy).toBe(7);
      expect(report.overallStatus).toBe('healthy');
    });

    it('should report disabled modules with disabled status', async () => {
      const opts = makeOptions({
        modelRoutingEnabled: false,
        perplexityEnabled: false,
      });
      registerDefaultHealthChecks(checker, opts);

      const report = await checker.checkAll();
      expect(report.disabled).toBe(2);
      expect(report.healthy).toBe(5);

      const disabledMods = report.modules
        .filter(m => m.status === 'disabled')
        .map(m => m.moduleName);
      expect(disabledMods).toContain('model-routing');
      expect(disabledMods).toContain('perplexity');
    });
  });

  describe('Report formatting', () => {
    it('should format a healthy report', async () => {
      checker.registerCheck('model-routing', async () => ({
        status: 'healthy' as ModuleStatus, message: 'Operational',
      }));
      const report = await checker.checkAll();
      const output = formatHealthReport(report);

      expect(output).toContain('Module Health Report');
      expect(output).toContain('[OK] healthy');
      expect(output).toContain('model-routing');
      expect(output).toContain('Operational');
    });

    it('should format mixed-status report', async () => {
      checker.registerCheck('ok-mod', async () => ({
        status: 'healthy' as ModuleStatus, message: 'OK',
      }));
      checker.registerCheck('warn-mod', async () => ({
        status: 'degraded' as ModuleStatus, message: 'Slow',
      }));
      checker.registerCheck('off-mod', async () => ({
        status: 'disabled' as ModuleStatus, message: 'Disabled',
      }));

      const report = await checker.checkAll();
      const output = formatHealthReport(report);

      expect(output).toContain('[OK]');
      expect(output).toContain('[WARN]');
      expect(output).toContain('[OFF]');
      expect(output).toContain('Healthy: 1');
      expect(output).toContain('Degraded: 1');
      expect(output).toContain('Disabled: 1');
    });
  });

  describe('Report caching and lifecycle', () => {
    it('should cache last report from checkAll', async () => {
      checker.registerCheck('mod', async () => ({
        status: 'healthy' as ModuleStatus, message: 'OK',
      }));

      expect(checker.getLastReport()).toBeNull();

      await checker.checkAll();
      const report = checker.getLastReport();
      expect(report).not.toBeNull();
      expect(report!.totalModules).toBe(1);
    });

    it('should clear checks and cached report', async () => {
      checker.registerCheck('mod', async () => ({
        status: 'healthy' as ModuleStatus, message: 'OK',
      }));
      await checker.checkAll();

      checker.clear();
      expect(checker.getRegisteredModules()).toHaveLength(0);
      expect(checker.getLastReport()).toBeNull();
    });

    it('should provide global singleton', () => {
      const c1 = getModuleHealthChecker();
      const c2 = getModuleHealthChecker();
      expect(c1).toBe(c2);
    });

    it('should reset global singleton', () => {
      const c1 = getModuleHealthChecker();
      c1.registerCheck('test', async () => ({
        status: 'healthy' as ModuleStatus, message: 'OK',
      }));
      resetModuleHealthChecker();
      const c2 = getModuleHealthChecker();
      expect(c2).not.toBe(c1);
      expect(c2.getRegisteredModules()).toHaveLength(0);
    });
  });
});
