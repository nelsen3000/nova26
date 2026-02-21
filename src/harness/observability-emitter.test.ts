// Observability Emitter Tests - K3-32
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ObservabilityEmitter,
  createObservabilityEmitter,
} from './observability-emitter.js';
import { harnessEventStream } from './observability.js';
import type { HarnessEvent, ToolCallRecord, HumanGateRequest, HarnessState } from './types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeToolCallRecord(overrides: Partial<ToolCallRecord> = {}): ToolCallRecord {
  return {
    id: 'tc-1',
    toolName: 'bash',
    arguments: { cmd: 'ls' },
    timestamp: Date.now(),
    durationMs: 50,
    retryCount: 0,
    cost: 0.001,
    success: true,
    ...overrides,
  };
}

function makeGateRequest(overrides: Partial<HumanGateRequest> = {}): HumanGateRequest {
  const stateSnapshot: HarnessState = {
    schemaVersion: 1,
    config: {
      id: 'h-gate',
      name: 'Gate Test',
      agentId: 'agent',
      task: 'test',
      priority: 'normal',
      timeoutMs: 0,
      maxRetries: 1,
      autonomyLevel: 3,
      maxDepth: 1,
      depth: 0,
      allowedTools: [],
      budget: { maxToolCalls: 10, maxTokens: 1000, maxCost: 1 },
      checkpointIntervalMs: 30000,
      dreamModeEnabled: false,
      overnightEvolutionEnabled: false,
    },
    status: 'running',
    createdAt: Date.now(),
    currentStepIndex: 0,
    toolCallHistory: [],
    subAgentIds: [],
    toolCallCount: 0,
    tokenCount: 0,
    cost: 0,
    retryCount: 0,
    context: {},
  };
  return {
    id: 'gate-1',
    stepId: 'step-1',
    reason: 'review needed',
    stateSnapshot,
    proposedAction: 'delete file',
    timestamp: Date.now(),
    ...overrides,
  };
}

function captureEvents(harnessId: string): HarnessEvent[] {
  const events: HarnessEvent[] = [];
  harnessEventStream.on(`event:${harnessId}`, (e: HarnessEvent) => events.push(e));
  return events;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ObservabilityEmitter', () => {
  let emitter: ObservabilityEmitter;
  const HARNESS_ID = `test-obs-${Date.now()}`;

  beforeEach(() => {
    emitter = createObservabilityEmitter(HARNESS_ID);
    // Remove previous listeners to avoid cross-test bleed
    harnessEventStream.removeAllListeners(`event:${HARNESS_ID}`);
  });

  describe('getHarnessId()', () => {
    it('returns the harnessId it was created with', () => {
      expect(emitter.getHarnessId()).toBe(HARNESS_ID);
    });
  });

  describe('emitStateTransition()', () => {
    it('emits a state_transition event', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitStateTransition('created', 'running');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('state_transition');
    });

    it('payload includes from/to', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitStateTransition('running', 'completed');
      expect(events[0].payload.from).toBe('running');
      expect(events[0].payload.to).toBe('completed');
    });

    it('event harnessId matches', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitStateTransition('created', 'starting');
      expect(events[0].harnessId).toBe(HARNESS_ID);
    });
  });

  describe('emitToolCall()', () => {
    it('emits tool_called for successful call', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitToolCall(makeToolCallRecord({ success: true }));
      expect(events[0].type).toBe('tool_called');
    });

    it('emits tool_failed for failed call', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitToolCall(makeToolCallRecord({ success: false, error: 'exec failed' }));
      expect(events[0].type).toBe('tool_failed');
    });

    it('payload includes toolName', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitToolCall(makeToolCallRecord({ toolName: 'read', success: true }));
      expect(events[0].payload.toolName).toBe('read');
    });

    it('payload includes cost and durationMs', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitToolCall(makeToolCallRecord({ cost: 0.05, durationMs: 200, success: true }));
      expect(events[0].payload.cost).toBe(0.05);
      expect(events[0].payload.durationMs).toBe(200);
    });
  });

  describe('emitHumanGate()', () => {
    it('emits human_gate_triggered event', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitHumanGate(makeGateRequest());
      expect(events[0].type).toBe('human_gate_triggered');
    });

    it('payload includes gateId, stepId, reason, proposedAction', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitHumanGate(makeGateRequest({
        id: 'gate-xyz',
        stepId: 'step-5',
        reason: 'destructive op',
        proposedAction: 'rm -rf /',
      }));
      expect(events[0].payload.gateId).toBe('gate-xyz');
      expect(events[0].payload.stepId).toBe('step-5');
      expect(events[0].payload.reason).toBe('destructive op');
      expect(events[0].payload.proposedAction).toBe('rm -rf /');
    });
  });

  describe('emitSubAgent()', () => {
    it('emits sub_agent_spawned when type=spawned', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitSubAgent('child-h1', 'spawned');
      expect(events[0].type).toBe('sub_agent_spawned');
    });

    it('emits sub_agent_completed when type=completed', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitSubAgent('child-h1', 'completed');
      expect(events[0].type).toBe('sub_agent_completed');
    });

    it('payload includes subAgentId', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitSubAgent('child-42', 'spawned');
      expect(events[0].payload.subAgentId).toBe('child-42');
    });

    it('merges extra payload fields', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitSubAgent('child-1', 'completed', { exitCode: 0 });
      expect(events[0].payload.exitCode).toBe(0);
    });
  });

  describe('emitCheckpoint()', () => {
    it('emits checkpoint_created when type=created', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitCheckpoint('ckpt-1', 'created');
      expect(events[0].type).toBe('checkpoint_created');
    });

    it('emits checkpoint_restored when type=restored', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitCheckpoint('ckpt-1', 'restored');
      expect(events[0].type).toBe('checkpoint_restored');
    });

    it('payload includes checkpointId', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitCheckpoint('ckpt-999', 'created');
      expect(events[0].payload.checkpointId).toBe('ckpt-999');
    });
  });

  describe('emitStep()', () => {
    it('emits step_completed event', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitStep('step-1', 'completed');
      expect(events[0].type).toBe('step_completed');
    });

    it('emits step_failed event', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitStep('step-1', 'failed');
      expect(events[0].type).toBe('step_failed');
    });

    it('payload includes stepId', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitStep('step-7', 'completed');
      expect(events[0].payload.stepId).toBe('step-7');
    });
  });

  describe('event structure', () => {
    it('events have unique ids', () => {
      const events = captureEvents(HARNESS_ID);
      emitter.emitStateTransition('created', 'running');
      emitter.emitStateTransition('running', 'completed');
      expect(events[0].id).not.toBe(events[1].id);
    });

    it('events have timestamp', () => {
      const events = captureEvents(HARNESS_ID);
      const before = Date.now();
      emitter.emitStateTransition('created', 'running');
      const after = Date.now();
      expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(events[0].timestamp).toBeLessThanOrEqual(after);
    });
  });
});
