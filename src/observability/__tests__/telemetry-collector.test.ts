// KMS-30: Telemetry Collector Tests

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TelemetryCollector,
  createBuildCompleteHandler,
  getGlobalTelemetryCollector,
  resetGlobalTelemetryCollector,
  setGlobalTelemetryCollector,
  type TelemetryConfig,
  type BuildMetrics,
  type AgentUsageMetrics,
  type FeatureFlagState,
  type ErrorMetrics,
} from '../telemetry-collector.js';

describe('TelemetryCollector', () => {
  let collector: TelemetryCollector;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    collector = new TelemetryCollector({ enabled: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    collector.dispose();
  });

  describe('initialization', () => {
    it('should create with default config', () => {
      const defaultCollector = new TelemetryCollector();
      expect(defaultCollector.isEnabled()).toBe(false);
      defaultCollector.dispose();
    });

    it('should create with enabled config', () => {
      expect(collector.isEnabled()).toBe(true);
    });

    it('should generate anonymous ID', () => {
      const config = collector.getConfig();
      expect(config.anonymousId).toBeDefined();
      expect(config.anonymousId).toContain('anon-');
    });

    it('should accept custom anonymous ID', () => {
      const customCollector = new TelemetryCollector({
        enabled: true,
        anonymousId: 'custom-id-123',
      });
      expect(customCollector.getConfig().anonymousId).toBe('custom-id-123');
      customCollector.dispose();
    });
  });

  describe('enable/disable', () => {
    it('should enable telemetry', () => {
      const disabledCollector = new TelemetryCollector({ enabled: false });
      expect(disabledCollector.isEnabled()).toBe(false);
      
      disabledCollector.enable();
      expect(disabledCollector.isEnabled()).toBe(true);
      disabledCollector.dispose();
    });

    it('should disable telemetry', () => {
      expect(collector.isEnabled()).toBe(true);
      
      collector.disable();
      expect(collector.isEnabled()).toBe(false);
    });

    it('should not record events when disabled', () => {
      collector.disable();
      
      collector.recordBuild({
        buildId: 'test',
        taskCount: 5,
        durationMs: 1000,
        success: true,
      });

      expect(collector.getQueueSize()).toBe(0);
    });
  });

  describe('recordBuild', () => {
    it('should record build metrics', () => {
      collector.recordBuild({
        buildId: 'build-1',
        taskCount: 10,
        durationMs: 5000,
        success: true,
      });

      expect(collector.getQueueSize()).toBe(1);
    });

    it('should include correct event type', () => {
      collector.recordBuild({
        buildId: 'build-1',
        taskCount: 10,
        durationMs: 5000,
        success: true,
      });

      const events = collector.getPendingEvents();
      expect(events[0].type).toBe('build');
    });

    it('should include build data', () => {
      collector.recordBuild({
        buildId: 'build-1',
        taskCount: 10,
        durationMs: 5000,
        success: true,
      });

      const events = collector.getPendingEvents();
      expect(events[0].data.buildId).toBe('build-1');
      expect(events[0].data.taskCount).toBe(10);
      expect(events[0].data.durationMs).toBe(5000);
      expect(events[0].data.success).toBe(true);
    });
  });

  describe('recordAgentUsage', () => {
    it('should record agent usage', () => {
      collector.recordAgentUsage({
        agentName: 'Kimi',
        taskCount: 5,
        avgDurationMs: 2000,
        successRate: 0.9,
      });

      expect(collector.getQueueSize()).toBe(1);
    });

    it('should include correct event type', () => {
      collector.recordAgentUsage({
        agentName: 'Kimi',
        taskCount: 5,
        avgDurationMs: 2000,
        successRate: 0.9,
      });

      const events = collector.getPendingEvents();
      expect(events[0].type).toBe('agent');
    });
  });

  describe('recordFeatureFlag', () => {
    it('should record feature flag state', () => {
      collector.recordFeatureFlag({
        flagName: 'model-routing',
        value: true,
      });

      expect(collector.getQueueSize()).toBe(1);
    });

    it('should include correct event type', () => {
      collector.recordFeatureFlag({
        flagName: 'model-routing',
        value: true,
      });

      const events = collector.getPendingEvents();
      expect(events[0].type).toBe('feature_flag');
    });

    it('should record string flag value', () => {
      collector.recordFeatureFlag({
        flagName: 'environment',
        value: 'production',
      });

      const events = collector.getPendingEvents();
      expect(events[0].data.value).toBe('production');
    });

    it('should record number flag value', () => {
      collector.recordFeatureFlag({
        flagName: 'timeout',
        value: 5000,
      });

      const events = collector.getPendingEvents();
      expect(events[0].data.value).toBe(5000);
    });
  });

  describe('recordError', () => {
    it('should record error', () => {
      collector.recordError({
        errorType: 'ValidationError',
        count: 1,
        context: 'build',
      });

      expect(collector.getQueueSize()).toBe(1);
    });

    it('should include correct event type', () => {
      collector.recordError({
        errorType: 'ValidationError',
        count: 1,
        context: 'build',
      });

      const events = collector.getPendingEvents();
      expect(events[0].type).toBe('error');
    });
  });

  describe('batching', () => {
    it('should batch events', () => {
      for (let i = 0; i < 5; i++) {
        collector.recordBuild({
          buildId: `build-${i}`,
          taskCount: i,
          durationMs: 1000,
          success: true,
        });
      }

      expect(collector.getQueueSize()).toBe(5);
    });

    it('should auto-flush when batch size reached', async () => {
      // Use real timers for this test
      vi.useRealTimers();
      
      // Create collector with small batch size
      const smallBatchCollector = new TelemetryCollector({
        enabled: true,
        batchSize: 3,
      });
      
      const flushSpy = vi.spyOn(smallBatchCollector, 'flush');

      for (let i = 0; i < 3; i++) {
        smallBatchCollector.recordBuild({
          buildId: `build-${i}`,
          taskCount: i,
          durationMs: 1000,
          success: true,
        });
      }

      // Wait for async flush
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(flushSpy).toHaveBeenCalled();
      smallBatchCollector.dispose();
      
      // Restore fake timers
      vi.useFakeTimers();
    }, 10000);
  });

  describe('flushing', () => {
    it('should flush events', async () => {
      collector.recordBuild({
        buildId: 'build-1',
        taskCount: 5,
        durationMs: 1000,
        success: true,
      });

      expect(collector.getQueueSize()).toBe(1);
      
      await collector.flush();
      
      expect(collector.getQueueSize()).toBe(0);
    });

    it('should not flush when queue is empty', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await collector.flush();
      
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should log events when no endpoint configured', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      collector.recordBuild({
        buildId: 'build-1',
        taskCount: 5,
        durationMs: 1000,
        success: true,
      });

      await collector.flush();

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('auto flush timer', () => {
    it('should start timer when enabled', () => {
      const timerCollector = new TelemetryCollector({
        enabled: true,
        flushIntervalMs: 5000,
      });

      vi.advanceTimersByTime(5000);
      
      // Timer should have triggered
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      timerCollector.dispose();
    });

    it('should auto-flush on interval', async () => {
      const flushSpy = vi.spyOn(TelemetryCollector.prototype, 'flush');
      
      const intervalCollector = new TelemetryCollector({
        enabled: true,
        flushIntervalMs: 60000,
      });

      vi.advanceTimersByTime(60000);

      expect(flushSpy).toHaveBeenCalled();
      intervalCollector.dispose();
    });
  });

  describe('queue management', () => {
    it('should clear pending events', () => {
      collector.recordBuild({
        buildId: 'build-1',
        taskCount: 5,
        durationMs: 1000,
        success: true,
      });

      expect(collector.getQueueSize()).toBe(1);
      
      collector.clearPendingEvents();
      
      expect(collector.getQueueSize()).toBe(0);
    });

    it('should return copy of pending events', () => {
      collector.recordBuild({
        buildId: 'build-1',
        taskCount: 5,
        durationMs: 1000,
        success: true,
      });

      const events = collector.getPendingEvents();
      events.pop(); // Modify returned array

      expect(collector.getQueueSize()).toBe(1); // Original should be unchanged
    });
  });

  describe('session tracking', () => {
    it('should track session duration', () => {
      vi.advanceTimersByTime(5000);
      
      expect(collector.getSessionDurationMs()).toBe(5000);
    });
  });

  describe('configuration', () => {
    it('should get config', () => {
      const config = collector.getConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.batchSize).toBe(50);
    });

    it('should update config', () => {
      collector.updateConfig({ batchSize: 100 });
      
      expect(collector.getConfig().batchSize).toBe(100);
    });

    it('should start timer when enabling via config', () => {
      const disabledCollector = new TelemetryCollector({ enabled: false });
      
      disabledCollector.updateConfig({ enabled: true });
      
      expect(disabledCollector.isEnabled()).toBe(true);
      disabledCollector.dispose();
    });
  });

  describe('events include anonymous ID', () => {
    it('should include anonymous ID in build events', () => {
      collector.recordBuild({
        buildId: 'build-1',
        taskCount: 5,
        durationMs: 1000,
        success: true,
      });

      const events = collector.getPendingEvents();
      expect(events[0].data.anonymousId).toBe(collector.getConfig().anonymousId);
    });
  });
});

describe('createBuildCompleteHandler', () => {
  it('should create handler that records build', async () => {
    const collector = new TelemetryCollector({ enabled: true });
    const handler = createBuildCompleteHandler(collector);
    
    handler({
      buildId: 'build-1',
      taskCount: 5,
      durationMs: 1000,
      success: true,
    });

    // Wait for async flush
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(collector.getQueueSize()).toBe(0); // Flushed after build complete
    collector.dispose();
  });
});

describe('Global telemetry collector', () => {
  beforeEach(() => {
    resetGlobalTelemetryCollector();
  });

  afterEach(() => {
    resetGlobalTelemetryCollector();
  });

  it('should return same global instance', () => {
    const c1 = getGlobalTelemetryCollector();
    const c2 = getGlobalTelemetryCollector();
    expect(c1).toBe(c2);
  });

  it('should reset global instance', () => {
    const c1 = getGlobalTelemetryCollector();
    resetGlobalTelemetryCollector();
    const c2 = getGlobalTelemetryCollector();
    expect(c1).not.toBe(c2);
  });

  it('should dispose on reset', () => {
    const collector = getGlobalTelemetryCollector();
    const disposeSpy = vi.spyOn(collector, 'dispose');
    
    resetGlobalTelemetryCollector();
    
    expect(disposeSpy).toHaveBeenCalled();
  });

  it('should set global instance', () => {
    const customCollector = new TelemetryCollector();
    setGlobalTelemetryCollector(customCollector);
    expect(getGlobalTelemetryCollector()).toBe(customCollector);
  });
});
