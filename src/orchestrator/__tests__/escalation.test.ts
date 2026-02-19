// Escalation System Tests — R20-01
// Comprehensive tests for layer-to-layer escalation and human-required detection

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EscalationManager,
  DefaultEscalationHandler,
  createEscalationManager,
  type EscalationHandler,
} from '../escalation.js';
import type {
  EscalationEvent,
  EscalationPolicy,
  OrchestratorHierarchyConfig,
} from '../hierarchy-types.js';

// Mock console methods to reduce test noise
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('EscalationManager', () => {
  let mockHandler: EscalationHandler;
  let defaultPolicy: EscalationPolicy;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHandler = {
      onEscalation: vi.fn().mockResolvedValue(undefined),
      onHumanRequired: vi.fn().mockResolvedValue(undefined),
    };
    defaultPolicy = {
      mode: 'auto',
      thresholds: {
        maxRetriesPerLayer: 3,
        confidenceThreshold: 0.7,
        successRateThreshold: 0.5,
      },
      autoEscalateOn: ['timeout', 'failure'],
    };
  });

  describe('Upward Flow', () => {
    it('evaluateEscalation creates event with correct structure', async () => {
      const manager = new EscalationManager(defaultPolicy, mockHandler);
      const context = { userId: 'user-123' };

      const event = await manager.evaluateEscalation(
        3,
        'task-001',
        'timeout error',
        3,
        context
      );

      expect(event).not.toBeNull();
      expect(event?.layer).toBe(3);
      expect(event?.taskId).toBe('task-001');
      expect(event?.error).toBe('timeout error');
      expect(event?.retryCount).toBe(3);
      expect(event?.context).toEqual(context);
      expect(event?.timestamp).toBeTypeOf('number');
      expect(event?.suggestedNextLayer).toBe(-1);
    });

    it('escalates from L3 to human intervention', async () => {
      const manager = new EscalationManager(defaultPolicy, mockHandler);

      const event = await manager.evaluateEscalation(
        3,
        'task-002',
        'timeout',
        3
      );

      expect(event).not.toBeNull();
      expect(event?.layer).toBe(3);
      expect(event?.suggestedNextLayer).toBe(-1);
      // L3 is not layer 0, and retryCount 3 is not >= 6 (maxRetriesPerLayer * 2)
      expect(event?.requiresHuman).toBe(false);
      expect(mockHandler.onEscalation).toHaveBeenCalledOnce();
    });

    it('escalates from L2 to L1', async () => {
      const manager = new EscalationManager(defaultPolicy, mockHandler);

      const event = await manager.evaluateEscalation(
        2,
        'task-003',
        'timeout',
        3
      );

      expect(event).not.toBeNull();
      expect(event?.layer).toBe(2);
      expect(event?.suggestedNextLayer).toBe(1);
      expect(mockHandler.onEscalation).toHaveBeenCalledOnce();
    });

    it('escalates from L1 to L0', async () => {
      const manager = new EscalationManager(defaultPolicy, mockHandler);

      const event = await manager.evaluateEscalation(
        1,
        'task-004',
        'timeout',
        3
      );

      expect(event).not.toBeNull();
      expect(event?.layer).toBe(1);
      expect(event?.suggestedNextLayer).toBe(0);
      expect(mockHandler.onEscalation).toHaveBeenCalledOnce();
    });

    it('prevents duplicate escalation for same task', async () => {
      const manager = new EscalationManager(defaultPolicy, mockHandler);

      const event1 = await manager.evaluateEscalation(
        3,
        'task-005',
        'timeout',
        3
      );
      expect(event1).not.toBeNull();

      const event2 = await manager.evaluateEscalation(
        3,
        'task-005',
        'failure',
        4
      );
      expect(event2).toBeNull();

      expect(mockHandler.onEscalation).toHaveBeenCalledOnce();
    });
  });

  describe('Human-Required Detection', () => {
    it('L0 always requires human intervention when escalated', async () => {
      // L0 escalations require a trigger (timeout, confidence, or retry >= maxRetries)
      const manager = new EscalationManager(defaultPolicy, mockHandler);

      // Use 'timeout' trigger to escalate from L0 (error containing 'timeout')
      const event = await manager.evaluateEscalation(
        0,
        'task-006',
        'timeout: processing failed',
        0
      );

      expect(event).not.toBeNull();
      expect(event?.layer).toBe(0);
      expect(event?.suggestedNextLayer).toBe(-1); // L0 escalates to human
      expect(event?.requiresHuman).toBe(true); // L0 always requires human
      expect(mockHandler.onHumanRequired).toHaveBeenCalledOnce();
    });

    it('max retries exceeded triggers human requirement', async () => {
      const manager = new EscalationManager(defaultPolicy, mockHandler);

      // retryCount >= maxRetriesPerLayer * 2 should trigger human
      // With maxRetriesPerLayer = 3, we need retryCount >= 6
      const event = await manager.evaluateEscalation(
        2,
        'task-007',
        'timeout',
        6 // 6 >= 3 * 2 = 6, triggers human
      );

      expect(event).not.toBeNull();
      expect(event?.requiresHuman).toBe(true);
      expect(mockHandler.onHumanRequired).toHaveBeenCalledOnce();
    });

    it('permission errors require human intervention', async () => {
      const manager = new EscalationManager(defaultPolicy, mockHandler);

      const permissionErrors = [
        'permission_denied',
        'PERMISSION_DENIED',
        'Permission_Denied',
        'unauthorized access',
        'UNAUTHORIZED request',
      ];

      for (let i = 0; i < permissionErrors.length; i++) {
        const error = permissionErrors[i];
        vi.clearAllMocks();
        manager.clearHistory();
        const taskId = `task-perm-${i}`;

        // Use timeout trigger to ensure escalation happens
        const event = await manager.evaluateEscalation(
          2,
          taskId,
          `timeout: ${error}`,
          1
        );

        expect(event?.requiresHuman).toBe(true);
        expect(mockHandler.onHumanRequired).toHaveBeenCalledOnce();
      }
    });

    it('security violations require human intervention', async () => {
      const manager = new EscalationManager(defaultPolicy, mockHandler);

      const securityErrors = [
        'security_violation detected',
        'cost_limit_exceeded',
        'SECURITY_VIOLATION',
      ];

      for (let i = 0; i < securityErrors.length; i++) {
        const error = securityErrors[i];
        vi.clearAllMocks();
        manager.clearHistory();
        const taskId = `task-sec-${i}`;

        // Use timeout trigger to ensure escalation happens
        const event = await manager.evaluateEscalation(
          2,
          taskId,
          `timeout: ${error}`,
          1
        );

        expect(event?.requiresHuman).toBe(true);
        expect(mockHandler.onHumanRequired).toHaveBeenCalledOnce();
      }
    });
  });

  describe('Policy Modes', () => {
    it('auto mode escalates automatically on failure trigger', async () => {
      const autoPolicy: EscalationPolicy = {
        ...defaultPolicy,
        mode: 'auto',
      };
      const manager = new EscalationManager(autoPolicy, mockHandler);

      const canRetry = manager.canRetryAtCurrentLayer(2, 2);
      expect(canRetry).toBe(true);

      const event = await manager.evaluateEscalation(
        2,
        'task-auto',
        'timeout',
        3
      );

      expect(event).not.toBeNull();
      expect(mockHandler.onEscalation).toHaveBeenCalledOnce();
    });

    it('manual mode blocks retries', async () => {
      const manualPolicy: EscalationPolicy = {
        ...defaultPolicy,
        mode: 'manual',
      };
      const manager = new EscalationManager(manualPolicy, mockHandler);

      const canRetry = manager.canRetryAtCurrentLayer(2, 1);
      expect(canRetry).toBe(false);

      // Manual mode still allows evaluation with triggers
      const event = await manager.evaluateEscalation(
        2,
        'task-manual',
        'timeout',
        3
      );

      expect(event).not.toBeNull();
    });

    it('threshold-based mode respects retry limits', async () => {
      const thresholdPolicy: EscalationPolicy = {
        ...defaultPolicy,
        mode: 'threshold-based',
        thresholds: {
          ...defaultPolicy.thresholds,
          maxRetriesPerLayer: 3,
        },
      };
      const manager = new EscalationManager(thresholdPolicy, mockHandler);

      // Below threshold - can retry
      expect(manager.canRetryAtCurrentLayer(2, 2)).toBe(true);

      // At threshold - cannot retry
      expect(manager.canRetryAtCurrentLayer(2, 3)).toBe(false);

      // Above threshold - cannot retry
      expect(manager.canRetryAtCurrentLayer(2, 4)).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('getHistory filters by layer correctly', async () => {
      const manager = new EscalationManager(defaultPolicy, mockHandler);

      // Create events at different layers with unique task IDs
      await manager.evaluateEscalation(3, 'task-s1', 'timeout', 3);
      await manager.evaluateEscalation(2, 'task-s2', 'timeout', 3);
      await manager.evaluateEscalation(2, 'task-s3', 'timeout', 3);
      await manager.evaluateEscalation(1, 'task-s4', 'timeout', 3);

      const layer3History = manager.getHistory({ layer: 3 });
      const layer2History = manager.getHistory({ layer: 2 });
      const layer1History = manager.getHistory({ layer: 1 });

      expect(layer3History).toHaveLength(1);
      expect(layer3History[0]?.layer).toBe(3);

      expect(layer2History).toHaveLength(2);
      expect(layer2History.every(e => e.layer === 2)).toBe(true);

      expect(layer1History).toHaveLength(1);
      expect(layer1History[0]?.layer).toBe(1);
    });

    it('getStatistics counts correctly', async () => {
      const manager = new EscalationManager(defaultPolicy, mockHandler);

      // Create a mix of events with unique task IDs
      await manager.evaluateEscalation(3, 'task-st1', 'timeout', 2);
      await manager.evaluateEscalation(2, 'task-st2', 'timeout', 4);
      await manager.evaluateEscalation(2, 'task-st3', 'timeout', 1);

      const stats = manager.getStatistics();

      expect(stats.totalEscalations).toBe(3);
      expect(stats.byLayer[3]).toBe(1);
      expect(stats.byLayer[2]).toBe(2);
      expect(stats.byLayer[1]).toBe(0);
      expect(stats.byLayer[0]).toBe(0);
      expect(stats.averageRetries).toBe((2 + 4 + 1) / 3);
    });

    it('clearHistory resets all data', async () => {
      const manager = new EscalationManager(defaultPolicy, mockHandler);

      await manager.evaluateEscalation(3, 'task-ch1', 'timeout', 3);
      await manager.evaluateEscalation(2, 'task-ch2', 'timeout', 3);

      expect(manager.getHistory()).toHaveLength(2);
      expect(manager.isEscalated('task-ch1')).toBe(true);
      expect(manager.isEscalated('task-ch2')).toBe(true);

      manager.clearHistory();

      expect(manager.getHistory()).toHaveLength(0);
      expect(manager.isEscalated('task-ch1')).toBe(false);
      expect(manager.isEscalated('task-ch2')).toBe(false);

      const stats = manager.getStatistics();
      expect(stats.totalEscalations).toBe(0);
      expect(stats.averageRetries).toBe(0);
    });
  });

  describe('Additional Methods', () => {
    it('escalate updates event timestamp', async () => {
      const manager = new EscalationManager(defaultPolicy, mockHandler);

      const originalEvent: EscalationEvent = {
        layer: 2,
        taskId: 'task-esc',
        error: 'test error',
        retryCount: 3,
        suggestedNextLayer: 1,
        requiresHuman: false,
        context: {},
        timestamp: Date.now() - 1000,
      };

      const beforeTimestamp = originalEvent.timestamp;

      const result = await manager.escalate(originalEvent);

      expect(result).toBe(true);
      expect(mockHandler.onEscalation).toHaveBeenCalledOnce();

      const updatedEvent = vi.mocked(mockHandler.onEscalation).mock.calls[0]?.[0];
      expect(updatedEvent?.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
    });

    it('escalate returns false for invalid next layer', async () => {
      const manager = new EscalationManager(defaultPolicy, mockHandler);

      // Test with invalid layer (less than 0)
      const invalidEvent1: EscalationEvent = {
        layer: 0,
        taskId: 'task-inv1',
        error: 'test error',
        retryCount: 3,
        suggestedNextLayer: -1, // Invalid for escalate() method
        requiresHuman: true,
        context: {},
        timestamp: Date.now(),
      };

      const result1 = await manager.escalate(invalidEvent1);
      expect(result1).toBe(false); // -1 is rejected by escalate()

      // Test with invalid layer (greater than 3)
      const invalidEvent2: EscalationEvent = {
        layer: 3,
        taskId: 'task-inv2',
        error: 'test error',
        retryCount: 3,
        suggestedNextLayer: 5, // Invalid layer
        requiresHuman: false,
        context: {},
        timestamp: Date.now(),
      };

      const result2 = await manager.escalate(invalidEvent2);
      expect(result2).toBe(false);

      // Test with valid layer
      const validEvent: EscalationEvent = {
        layer: 2,
        taskId: 'task-valid',
        error: 'test error',
        retryCount: 3,
        suggestedNextLayer: 1, // Valid layer
        requiresHuman: false,
        context: {},
        timestamp: Date.now(),
      };

      const resultValid = await manager.escalate(validEvent);
      expect(resultValid).toBe(true);
    });

    it('isEscalated returns correct status', async () => {
      const manager = new EscalationManager(defaultPolicy, mockHandler);

      expect(manager.isEscalated('task-new')).toBe(false);

      await manager.evaluateEscalation(3, 'task-new', 'timeout', 3);

      expect(manager.isEscalated('task-new')).toBe(true);
    });

    it('getHistory filters by taskId', async () => {
      const manager = new EscalationManager(defaultPolicy, mockHandler);

      await manager.evaluateEscalation(3, 'task-specific', 'timeout', 3);
      await manager.evaluateEscalation(2, 'task-other', 'timeout', 3);

      const filtered = manager.getHistory({ taskId: 'task-specific' });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.taskId).toBe('task-specific');
    });

    it('getHistory filters by requiresHuman', async () => {
      const manager = new EscalationManager(defaultPolicy, mockHandler);

      // L0 escalated via timeout trigger always requires human
      await manager.evaluateEscalation(0, 'task-human', 'timeout', 0);
      // L3 with retry count 1 doesn't require human
      await manager.evaluateEscalation(3, 'task-auto', 'timeout', 1);

      const humanRequired = manager.getHistory({ requiresHuman: true });
      const noHumanRequired = manager.getHistory({ requiresHuman: false });

      expect(humanRequired).toHaveLength(1);
      expect(humanRequired[0]?.taskId).toBe('task-human');

      expect(noHumanRequired).toHaveLength(1);
      expect(noHumanRequired[0]?.taskId).toBe('task-auto');
    });

    it('handles empty statistics correctly', () => {
      const manager = new EscalationManager(defaultPolicy, mockHandler);

      const stats = manager.getStatistics();

      expect(stats.totalEscalations).toBe(0);
      expect(stats.byLayer).toEqual({ 0: 0, 1: 0, 2: 0, 3: 0 });
      expect(stats.humanRequiredCount).toBe(0);
      expect(stats.averageRetries).toBe(0);
    });

    it('returns null when no escalation trigger is met', async () => {
      const manager = new EscalationManager(defaultPolicy, mockHandler);

      // No trigger met: error doesn't contain 'timeout' or 'confidence',
      // and retryCount < maxRetriesPerLayer (3)
      const event = await manager.evaluateEscalation(
        2,
        'task-no-esc',
        'random error',
        2 // Less than 3 (maxRetriesPerLayer)
      );

      expect(event).toBeNull();
      expect(mockHandler.onEscalation).not.toHaveBeenCalled();
    });

    it('handles multiple filter criteria in getHistory', async () => {
      const manager = new EscalationManager(defaultPolicy, mockHandler);

      // Create events with different properties
      await manager.evaluateEscalation(0, 'task-filter-1', 'low confidence', 0);
      await manager.evaluateEscalation(2, 'task-filter-2', 'timeout', 3);
      await manager.evaluateEscalation(2, 'task-filter-3', 'timeout', 6); // Human required

      // Filter by layer and requiresHuman
      const filtered = manager.getHistory({
        layer: 2,
        requiresHuman: true,
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.taskId).toBe('task-filter-3');
    });
  });
});

describe('DefaultEscalationHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores events in internal array', async () => {
    const handler = new DefaultEscalationHandler();
    const event: EscalationEvent = {
      layer: 2,
      taskId: 'task-default',
      error: 'test error',
      retryCount: 3,
      suggestedNextLayer: 1,
      requiresHuman: false,
      context: {},
      timestamp: Date.now(),
    };

    await handler.onEscalation(event);

    expect(handler.getEvents()).toHaveLength(1);
    expect(handler.getEvents()[0]).toEqual(event);
  });

  it('logs escalation messages', async () => {
    const handler = new DefaultEscalationHandler();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const event: EscalationEvent = {
      layer: 2,
      taskId: 'task-log',
      error: 'test error',
      retryCount: 3,
      suggestedNextLayer: 1,
      requiresHuman: false,
      context: {},
      timestamp: Date.now(),
    };

    await handler.onEscalation(event);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ESCALATION]')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Layer 2 -> 1')
    );
  });

  it('logs human required messages', async () => {
    const handler = new DefaultEscalationHandler();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const event: EscalationEvent = {
      layer: 0,
      taskId: 'task-human-log',
      error: 'critical error',
      retryCount: 0,
      suggestedNextLayer: -1,
      requiresHuman: true,
      context: {},
      timestamp: Date.now(),
    };

    await handler.onHumanRequired(event);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[HUMAN REQUIRED]')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('task-human-log')
    );
  });
});

describe('createEscalationManager', () => {
  it('creates manager with correct policy from config', () => {
    const config: OrchestratorHierarchyConfig = {
      enabled: true,
      layers: [],
      escalationPolicy: 'threshold-based',
      defaultMaxRetries: 5,
      globalTimeoutMs: 30000,
      backwardCompatibilityMode: false,
      observabilityLevel: 'standard',
    };

    const manager = createEscalationManager(config);

    expect(manager).toBeInstanceOf(EscalationManager);

    // Test that policy was applied by checking retry behavior
    const canRetry = manager.canRetryAtCurrentLayer(2, 4);
    expect(canRetry).toBe(true); // 4 < 5 (maxRetries)

    const cannotRetry = manager.canRetryAtCurrentLayer(2, 5);
    expect(cannotRetry).toBe(false); // 5 >= 5 (maxRetries)
  });

  it('uses custom handler when provided', async () => {
    const config: OrchestratorHierarchyConfig = {
      enabled: true,
      layers: [],
      escalationPolicy: 'auto',
      defaultMaxRetries: 3,
      globalTimeoutMs: 30000,
      backwardCompatibilityMode: false,
      observabilityLevel: 'standard',
    };

    const customHandler: EscalationHandler = {
      onEscalation: vi.fn().mockResolvedValue(undefined),
      onHumanRequired: vi.fn().mockResolvedValue(undefined),
    };

    const manager = createEscalationManager(config, customHandler);

    await manager.evaluateEscalation(3, 'task-factory', 'timeout', 3);

    expect(customHandler.onEscalation).toHaveBeenCalledOnce();
  });

  it('uses DefaultEscalationHandler when no handler provided', () => {
    const config: OrchestratorHierarchyConfig = {
      enabled: true,
      layers: [],
      escalationPolicy: 'manual',
      defaultMaxRetries: 2,
      globalTimeoutMs: 30000,
      backwardCompatibilityMode: false,
      observabilityLevel: 'minimal',
    };

    const manager = createEscalationManager(config);

    expect(manager).toBeInstanceOf(EscalationManager);
  });

  it('correctly maps all policy modes', () => {
    const modes: Array<'auto' | 'manual' | 'threshold-based'> = [
      'auto',
      'manual',
      'threshold-based',
    ];

    for (const mode of modes) {
      const config: OrchestratorHierarchyConfig = {
        enabled: true,
        layers: [],
        escalationPolicy: mode,
        defaultMaxRetries: 3,
        globalTimeoutMs: 30000,
        backwardCompatibilityMode: false,
        observabilityLevel: 'standard',
      };

      const manager = createEscalationManager(config);
      expect(manager).toBeInstanceOf(EscalationManager);

      // Verify mode is applied by checking canRetryAtCurrentLayer behavior
      const canRetry = manager.canRetryAtCurrentLayer(2, 1);

      if (mode === 'manual') {
        expect(canRetry).toBe(false);
      } else {
        expect(canRetry).toBe(true);
      }
    }
  });
});
