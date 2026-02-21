// SN-20: Handoff Pipeline E2E Test
// Tests full builder → payload → receiver pipeline with module state transfer

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HandoffContextBuilder,
  getHandoffContextBuilder,
  resetHandoffContextBuilder,
  type HandoffPayload,
  type ModelRoutingState,
  type MemoryState,
  type WorkflowState,
  type CollaborationState,
  type ObservabilityState,
} from '../handoff-context.js';
import {
  HandoffReceiver,
  getHandoffReceiver,
  resetHandoffReceiver,
} from '../handoff-receiver.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePayloadParams(overrides: Partial<{
  fromAgent: string; toAgent: string; taskId: string; buildId: string;
  taskOutput: string; taskDurationMs: number; aceScore: number;
  metadata: Record<string, unknown>;
}> = {}) {
  return {
    fromAgent: overrides.fromAgent ?? 'EARTH',
    toAgent: overrides.toAgent ?? 'MARS',
    taskId: overrides.taskId ?? 'task-001',
    buildId: overrides.buildId ?? 'build-001',
    taskOutput: overrides.taskOutput,
    taskDurationMs: overrides.taskDurationMs,
    aceScore: overrides.aceScore,
    metadata: overrides.metadata,
  };
}

const MOCK_MODEL_ROUTING: ModelRoutingState = {
  selectedModelId: 'qwen2.5:7b',
  routingReason: 'hardware-match',
  affinityScores: { 'EARTH': 0.95, 'MARS': 0.82 },
};

const MOCK_MEMORY: MemoryState = {
  recentNodeIds: ['mem-001', 'mem-002'],
  contextSummary: 'Built API endpoints',
  tasteScore: 0.88,
};

const MOCK_WORKFLOW: WorkflowState = {
  currentNodeId: 'node-spec',
  completedNodeIds: ['node-init'],
  pendingNodeIds: ['node-code', 'node-test'],
  criticalPathPosition: 2,
};

const MOCK_COLLABORATION: CollaborationState = {
  sessionId: 'collab-001',
  documentVersion: 5,
  participantCount: 3,
};

const MOCK_OBSERVABILITY: ObservabilityState = {
  parentSpanId: 'span-root',
  traceId: 'trace-001',
  buildSpanId: 'span-build',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E2E Handoff Pipeline', () => {
  let builder: HandoffContextBuilder;
  let receiver: HandoffReceiver;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    resetHandoffContextBuilder();
    resetHandoffReceiver();
    builder = new HandoffContextBuilder();
    receiver = new HandoffReceiver();
  });

  describe('Builder creates valid payloads', () => {
    it('should build payload with required fields', () => {
      const payload = builder.buildPayload(makePayloadParams());

      expect(payload.fromAgent).toBe('EARTH');
      expect(payload.toAgent).toBe('MARS');
      expect(payload.taskId).toBe('task-001');
      expect(payload.buildId).toBe('build-001');
      expect(typeof payload.timestamp).toBe('number');
      expect(payload.metadata).toEqual({});
    });

    it('should include optional task context when provided', () => {
      const payload = builder.buildPayload(makePayloadParams({
        taskOutput: 'Generated 3 files',
        taskDurationMs: 5000,
        aceScore: 92,
      }));

      expect(payload.taskOutput).toBe('Generated 3 files');
      expect(payload.taskDurationMs).toBe(5000);
      expect(payload.aceScore).toBe(92);
    });

    it('should include custom metadata', () => {
      const payload = builder.buildPayload(makePayloadParams({
        metadata: { retryCount: 2, urgent: true },
      }));

      expect(payload.metadata.retryCount).toBe(2);
      expect(payload.metadata.urgent).toBe(true);
    });
  });

  describe('Module state collectors', () => {
    it('should collect model routing state', () => {
      builder.registerCollector('model-routing', 'modelRouting',
        () => MOCK_MODEL_ROUTING);

      const payload = builder.buildPayload(makePayloadParams());
      expect(payload.modelRouting).toEqual(MOCK_MODEL_ROUTING);
    });

    it('should collect state from multiple modules', () => {
      builder.registerCollector('model-routing', 'modelRouting', () => MOCK_MODEL_ROUTING);
      builder.registerCollector('memory', 'memory', () => MOCK_MEMORY);
      builder.registerCollector('workflow', 'workflow', () => MOCK_WORKFLOW);

      const payload = builder.buildPayload(makePayloadParams());

      expect(payload.modelRouting).toEqual(MOCK_MODEL_ROUTING);
      expect(payload.memory).toEqual(MOCK_MEMORY);
      expect(payload.workflow).toEqual(MOCK_WORKFLOW);
    });

    it('should skip module when collector returns null', () => {
      builder.registerCollector('memory', 'memory', () => null);

      const payload = builder.buildPayload(makePayloadParams());
      expect(payload.memory).toBeUndefined();
    });

    it('should handle collector errors gracefully', () => {
      builder.registerCollector('broken', 'broken', () => {
        throw new Error('Collector crash');
      });
      builder.registerCollector('memory', 'memory', () => MOCK_MEMORY);

      const payload = builder.buildPayload(makePayloadParams());
      // Memory still collected despite broken collector
      expect(payload.memory).toEqual(MOCK_MEMORY);
    });

    it('should pass agent and task context to collectors', () => {
      let capturedFrom = '';
      let capturedTo = '';
      let capturedTask = '';

      builder.registerCollector('spy', 'spy', (from, to, task) => {
        capturedFrom = from;
        capturedTo = to;
        capturedTask = task;
        return null;
      });

      builder.buildPayload(makePayloadParams({
        fromAgent: 'JUPITER', toAgent: 'SATURN', taskId: 'task-xyz',
      }));

      expect(capturedFrom).toBe('JUPITER');
      expect(capturedTo).toBe('SATURN');
      expect(capturedTask).toBe('task-xyz');
    });
  });

  describe('Receiver extracts state', () => {
    it('should extract all module states from payload', () => {
      const payload: HandoffPayload = {
        fromAgent: 'EARTH', toAgent: 'MARS', taskId: 'task-001',
        buildId: 'build-001', timestamp: Date.now(), metadata: {},
        modelRouting: MOCK_MODEL_ROUTING,
        memory: MOCK_MEMORY,
        workflow: MOCK_WORKFLOW,
        collaboration: MOCK_COLLABORATION,
        observability: MOCK_OBSERVABILITY,
      };

      const state = receiver.extractState(payload);

      expect(state.modelRouting).toEqual(MOCK_MODEL_ROUTING);
      expect(state.memory).toEqual(MOCK_MEMORY);
      expect(state.workflow).toEqual(MOCK_WORKFLOW);
      expect(state.collaboration).toEqual(MOCK_COLLABORATION);
      expect(state.observability).toEqual(MOCK_OBSERVABILITY);
    });

    it('should return null for absent module states', () => {
      const payload: HandoffPayload = {
        fromAgent: 'EARTH', toAgent: 'MARS', taskId: 'task-001',
        buildId: 'build-001', timestamp: Date.now(), metadata: {},
      };

      const state = receiver.extractState(payload);

      expect(state.modelRouting).toBeNull();
      expect(state.memory).toBeNull();
      expect(state.workflow).toBeNull();
      expect(state.collaboration).toBeNull();
      expect(state.observability).toBeNull();
    });

    it('should extract task context fields', () => {
      const payload: HandoffPayload = {
        fromAgent: 'A', toAgent: 'B', taskId: 't1', buildId: 'b1',
        timestamp: Date.now(), metadata: {},
        taskOutput: 'Output text', taskDurationMs: 1500, aceScore: 88,
      };

      const state = receiver.extractState(payload);

      expect(state.taskOutput).toBe('Output text');
      expect(state.taskDurationMs).toBe(1500);
      expect(state.aceScore).toBe(88);
    });
  });

  describe('Receiver runs restorers', () => {
    it('should invoke restorers for present module states', async () => {
      let restoredModel: ModelRoutingState | null = null;
      receiver.registerRestorer('model-routing', 'modelRouting',
        (state) => { restoredModel = state as ModelRoutingState; });

      const payload: HandoffPayload = {
        fromAgent: 'EARTH', toAgent: 'MARS', taskId: 't1', buildId: 'b1',
        timestamp: Date.now(), metadata: {},
        modelRouting: MOCK_MODEL_ROUTING,
      };

      const result = await receiver.receive(payload);

      expect(result.restoredModules).toContain('model-routing');
      expect(restoredModel).toEqual(MOCK_MODEL_ROUTING);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip restorers when state is absent', async () => {
      let called = false;
      receiver.registerRestorer('memory', 'memory', () => { called = true; });

      const payload: HandoffPayload = {
        fromAgent: 'A', toAgent: 'B', taskId: 't1', buildId: 'b1',
        timestamp: Date.now(), metadata: {},
        // memory not included
      };

      const result = await receiver.receive(payload);

      expect(called).toBe(false);
      expect(result.restoredModules).not.toContain('memory');
    });

    it('should capture restorer errors without stopping pipeline', async () => {
      receiver.registerRestorer('broken', 'modelRouting',
        () => { throw new Error('Restore failed'); });
      receiver.registerRestorer('memory', 'memory',
        () => { /* no-op */ });

      const payload: HandoffPayload = {
        fromAgent: 'A', toAgent: 'B', taskId: 't1', buildId: 'b1',
        timestamp: Date.now(), metadata: {},
        modelRouting: MOCK_MODEL_ROUTING,
        memory: MOCK_MEMORY,
      };

      const result = await receiver.receive(payload);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].module).toBe('broken');
      expect(result.restoredModules).toContain('memory');
    });
  });

  describe('Full builder → receiver pipeline', () => {
    it('should transfer all module states end-to-end', async () => {
      // Builder collects state
      builder.registerCollector('model-routing', 'modelRouting', () => MOCK_MODEL_ROUTING);
      builder.registerCollector('memory', 'memory', () => MOCK_MEMORY);
      builder.registerCollector('workflow', 'workflow', () => MOCK_WORKFLOW);
      builder.registerCollector('collaboration', 'collaboration', () => MOCK_COLLABORATION);
      builder.registerCollector('observability', 'observability', () => MOCK_OBSERVABILITY);

      const payload = builder.buildPayload(makePayloadParams());

      // Receiver restores state
      const restored: Record<string, unknown> = {};
      receiver.registerRestorer('model-routing', 'modelRouting',
        (s) => { restored.modelRouting = s; });
      receiver.registerRestorer('memory', 'memory',
        (s) => { restored.memory = s; });
      receiver.registerRestorer('workflow', 'workflow',
        (s) => { restored.workflow = s; });
      receiver.registerRestorer('collaboration', 'collaboration',
        (s) => { restored.collaboration = s; });
      receiver.registerRestorer('observability', 'observability',
        (s) => { restored.observability = s; });

      const result = await receiver.receive(payload);

      expect(result.restoredModules).toHaveLength(5);
      expect(result.errors).toHaveLength(0);
      expect(restored.modelRouting).toEqual(MOCK_MODEL_ROUTING);
      expect(restored.memory).toEqual(MOCK_MEMORY);
      expect(restored.workflow).toEqual(MOCK_WORKFLOW);
      expect(restored.collaboration).toEqual(MOCK_COLLABORATION);
      expect(restored.observability).toEqual(MOCK_OBSERVABILITY);
    });

    it('should chain handoffs across 3 agents', async () => {
      builder.registerCollector('memory', 'memory', () => MOCK_MEMORY);

      // EARTH → MARS
      const p1 = builder.buildPayload(makePayloadParams({
        fromAgent: 'EARTH', toAgent: 'MARS',
      }));
      const s1 = receiver.extractState(p1);
      expect(s1.fromAgent).toBe('EARTH');
      expect(s1.toAgent).toBe('MARS');
      expect(s1.memory).toEqual(MOCK_MEMORY);

      // MARS → VENUS
      const p2 = builder.buildPayload(makePayloadParams({
        fromAgent: 'MARS', toAgent: 'VENUS',
      }));
      const s2 = receiver.extractState(p2);
      expect(s2.fromAgent).toBe('MARS');
      expect(s2.toAgent).toBe('VENUS');
      expect(s2.memory).toEqual(MOCK_MEMORY);
    });
  });

  describe('Registration management', () => {
    it('should list registered collector modules', () => {
      builder.registerCollector('model-routing', 'modelRouting', () => null);
      builder.registerCollector('memory', 'memory', () => null);

      const modules = builder.getRegisteredModules();
      expect(modules).toContain('model-routing');
      expect(modules).toContain('memory');
    });

    it('should unregister a collector', () => {
      builder.registerCollector('removable', 'removable', () => null);
      expect(builder.getRegisteredModules()).toContain('removable');

      builder.unregisterCollector('removable');
      expect(builder.getRegisteredModules()).not.toContain('removable');
    });

    it('should list registered restorer modules', () => {
      receiver.registerRestorer('model-routing', 'modelRouting', () => {});
      receiver.registerRestorer('workflow', 'workflow', () => {});

      const modules = receiver.getRegisteredModules();
      expect(modules).toContain('model-routing');
      expect(modules).toContain('workflow');
    });

    it('should clear all registrations', () => {
      builder.registerCollector('a', 'a', () => null);
      builder.registerCollector('b', 'b', () => null);
      builder.clear();
      expect(builder.getRegisteredModules()).toHaveLength(0);

      receiver.registerRestorer('c', 'c', () => {});
      receiver.clear();
      expect(receiver.getRegisteredModules()).toHaveLength(0);
    });
  });

  describe('Lifecycle context conversion', () => {
    it('should convert payload to HandoffContext for hooks', () => {
      builder.registerCollector('memory', 'memory', () => MOCK_MEMORY);

      const ctx = builder.buildLifecycleContext(makePayloadParams());

      expect(ctx.fromAgent).toBe('EARTH');
      expect(ctx.toAgent).toBe('MARS');
      expect(ctx.taskId).toBe('task-001');
      expect(ctx.payload).toBeDefined();
      expect((ctx.payload as Record<string, unknown>).memory).toEqual(MOCK_MEMORY);
    });
  });

  describe('Singleton management', () => {
    it('should provide global builder singleton', () => {
      const b1 = getHandoffContextBuilder();
      const b2 = getHandoffContextBuilder();
      expect(b1).toBe(b2);
    });

    it('should provide global receiver singleton', () => {
      const r1 = getHandoffReceiver();
      const r2 = getHandoffReceiver();
      expect(r1).toBe(r2);
    });

    it('should reset global builder singleton', () => {
      const b1 = getHandoffContextBuilder();
      b1.registerCollector('test', 'test', () => null);
      resetHandoffContextBuilder();
      const b2 = getHandoffContextBuilder();
      expect(b2).not.toBe(b1);
      expect(b2.getRegisteredModules()).toHaveLength(0);
    });

    it('should reset global receiver singleton', () => {
      const r1 = getHandoffReceiver();
      r1.registerRestorer('test', 'test', () => {});
      resetHandoffReceiver();
      const r2 = getHandoffReceiver();
      expect(r2).not.toBe(r1);
      expect(r2.getRegisteredModules()).toHaveLength(0);
    });
  });
});
