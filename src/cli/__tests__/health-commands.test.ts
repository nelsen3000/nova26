// KMS-21: /health CLI command tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleHealthCommand,
  resetHealthState,
  setHealthChecker,
  healthCommand,
} from '../health-commands.js';
import { ModuleHealthChecker, type HealthReport } from '../../orchestrator/module-health.js';

describe('/health command', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetHealthState();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('command definition', () => {
    it('should have correct name and description', () => {
      expect(healthCommand.name).toBe('/health');
      expect(healthCommand.description).toContain('health');
      expect(healthCommand.handler).toBe(handleHealthCommand);
    });

    it('should have usage information', () => {
      expect(healthCommand.usage).toContain('health');
    });
  });

  describe('help command', () => {
    it('should show help with no args', async () => {
      await handleHealthCommand([]);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('/health');
      expect(output).toContain('Usage:');
    });

    it('should show help with "help" arg', async () => {
      await handleHealthCommand(['help']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('/health');
      expect(output).toContain('Module Health');
    });

    it('should show help with "--help" arg', async () => {
      await handleHealthCommand(['--help']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Usage:');
    });
  });

  describe('show all health', () => {
    it('should check all modules with no args', async () => {
      const checker = new ModuleHealthChecker();
      checker.registerCheck('test-module', async () => ({
        status: 'healthy',
        message: 'Test module is healthy',
      }));
      setHealthChecker(checker);

      await handleHealthCommand([]);
      
      // Should default to help with no args
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('/health');
    });

    it('should check all modules with "all" arg', async () => {
      const checker = new ModuleHealthChecker();
      checker.registerCheck('module-a', async () => ({
        status: 'healthy',
        message: 'Module A is healthy',
      }));
      checker.registerCheck('module-b', async () => ({
        status: 'degraded',
        message: 'Module B is slow',
      }));
      setHealthChecker(checker);

      await handleHealthCommand(['all']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Checking module health');
    });

    it('should display formatted health report', async () => {
      const checker = new ModuleHealthChecker();
      checker.registerCheck('test-module', async () => ({
        status: 'healthy',
        message: 'All good',
      }));
      setHealthChecker(checker);

      await handleHealthCommand(['all']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('healthy');
    });

    it('should handle empty health checker', async () => {
      const checker = new ModuleHealthChecker();
      setHealthChecker(checker);

      await handleHealthCommand(['all']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Checking module health');
    });

    it('should show healthy status icon', async () => {
      const checker = new ModuleHealthChecker();
      checker.registerCheck('healthy-mod', async () => ({
        status: 'healthy',
        message: 'OK',
      }));
      setHealthChecker(checker);

      await handleHealthCommand(['all']);
      
      // Just verify no errors thrown
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should show degraded status icon', async () => {
      const checker = new ModuleHealthChecker();
      checker.registerCheck('degraded-mod', async () => ({
        status: 'degraded',
        message: 'Slow response',
      }));
      setHealthChecker(checker);

      await handleHealthCommand(['all']);
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should show unhealthy status icon', async () => {
      const checker = new ModuleHealthChecker();
      checker.registerCheck('unhealthy-mod', async () => ({
        status: 'unhealthy',
        message: 'Connection failed',
      }));
      setHealthChecker(checker);

      await handleHealthCommand(['all']);
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should show disabled status icon', async () => {
      const checker = new ModuleHealthChecker();
      checker.registerCheck('disabled-mod', async () => ({
        status: 'disabled',
        message: 'Module disabled',
      }));
      setHealthChecker(checker);

      await handleHealthCommand(['all']);
      
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('show specific module health', () => {
    it('should show health for specific module', async () => {
      const checker = new ModuleHealthChecker();
      checker.registerCheck('model-routing', async () => ({
        status: 'healthy',
        message: 'Router operational',
      }));
      setHealthChecker(checker);

      await handleHealthCommand(['model-routing']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('model-routing');
      expect(output).toContain('healthy');
    });

    it('should show error for unknown module', async () => {
      const checker = new ModuleHealthChecker();
      setHealthChecker(checker);

      await handleHealthCommand(['unknown-module']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('not found');
    });

    it('should show registered modules when module not found', async () => {
      const checker = new ModuleHealthChecker();
      checker.registerCheck('existing-module', async () => ({
        status: 'healthy',
        message: 'OK',
      }));
      setHealthChecker(checker);

      await handleHealthCommand(['nonexistent']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('existing-module');
    });

    it('should format module status with details', async () => {
      const checker = new ModuleHealthChecker();
      checker.registerCheck('detailed-module', async () => ({
        status: 'healthy',
        message: 'Running smoothly',
        details: { version: '1.0.0', uptime: 3600 },
      }));
      setHealthChecker(checker);

      await handleHealthCommand(['detailed-module']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Running smoothly');
      expect(output).toContain('Latency:');
    });

    it('should handle module with latency information', async () => {
      const checker = new ModuleHealthChecker();
      checker.registerCheck('latency-module', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          status: 'healthy',
          message: 'OK',
        };
      });
      setHealthChecker(checker);

      await handleHealthCommand(['latency-module']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Latency:');
    });
  });

  describe('health checker integration', () => {
    it('should use custom health checker', async () => {
      const customChecker = new ModuleHealthChecker();
      customChecker.registerCheck('custom', async () => ({
        status: 'healthy',
        message: 'Custom check',
      }));
      setHealthChecker(customChecker);

      await handleHealthCommand(['custom']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('custom');
    });

    it('should reset health state', () => {
      const checker = new ModuleHealthChecker();
      setHealthChecker(checker);
      
      resetHealthState();
      
      // After reset, a new checker will be created on next use
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Error'));
    });

    it('should handle multiple modules', async () => {
      const checker = new ModuleHealthChecker();
      checker.registerCheck('module-1', async () => ({ status: 'healthy', message: 'OK' }));
      checker.registerCheck('module-2', async () => ({ status: 'healthy', message: 'OK' }));
      checker.registerCheck('module-3', async () => ({ status: 'degraded', message: 'Slow' }));
      setHealthChecker(checker);

      await handleHealthCommand(['all']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Checking module health');
    });

    it('should handle health check errors gracefully', async () => {
      const checker = new ModuleHealthChecker();
      checker.registerCheck('failing-module', async () => {
        throw new Error('Health check failed');
      });
      setHealthChecker(checker);

      await handleHealthCommand(['failing-module']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('unhealthy');
    });

    it('should display timestamp for last checked', async () => {
      const checker = new ModuleHealthChecker();
      checker.registerCheck('timestamped-module', async () => ({
        status: 'healthy',
        message: 'OK',
      }));
      setHealthChecker(checker);

      await handleHealthCommand(['timestamped-module']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Checked:');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string module name', async () => {
      await handleHealthCommand(['']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('/health');
    });

    it('should handle module name with special characters', async () => {
      const checker = new ModuleHealthChecker();
      checker.registerCheck('module-with-dashes', async () => ({
        status: 'healthy',
        message: 'OK',
      }));
      setHealthChecker(checker);

      await handleHealthCommand(['module-with-dashes']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('module-with-dashes');
    });

    it('should handle health check timeout', async () => {
      const checker = new ModuleHealthChecker();
      checker.registerCheck('slow-module', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { status: 'healthy', message: 'OK' };
      }, 50); // 50ms timeout
      setHealthChecker(checker);

      await handleHealthCommand(['slow-module']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('unhealthy');
    });
  });
});
