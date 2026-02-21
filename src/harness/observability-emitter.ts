// Observability Emitter - K3-32
// Structured event emission for harness lifecycle events
// Wires into EventStream (singleton) + optional NovaTracer
// Spec: .kiro/specs/agent-harnesses/tasks.md

import type {
  HarnessStatus,
  HarnessEvent,
  HarnessEventType,
  ToolCallRecord,
  HumanGateRequest,
} from './types.js';
import { harnessEventStream } from './observability.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function makeEvent(
  harnessId: string,
  type: HarnessEventType,
  payload: Record<string, unknown>
): HarnessEvent {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    harnessId,
    type,
    timestamp: Date.now(),
    payload,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Observability Emitter
// ═══════════════════════════════════════════════════════════════════════════════

export class ObservabilityEmitter {
  constructor(
    private readonly harnessId: string,
    private readonly tracerSpanName?: string
  ) {}

  /**
   * Emit a harness state transition event.
   * Fired whenever the harness moves between lifecycle states.
   */
  emitStateTransition(from: HarnessStatus, to: HarnessStatus): void {
    const event = makeEvent(this.harnessId, 'state_transition', { from, to });
    harnessEventStream.emitEvent(event);
  }

  /**
   * Emit a tool call event (success or failure).
   */
  emitToolCall(record: ToolCallRecord): void {
    const type: HarnessEventType = record.success ? 'tool_called' : 'tool_failed';
    const event = makeEvent(this.harnessId, type, {
      toolCallId: record.id,
      toolName: record.toolName,
      durationMs: record.durationMs,
      retryCount: record.retryCount,
      cost: record.cost,
      success: record.success,
      error: record.error,
    });
    harnessEventStream.emitEvent(event);
  }

  /**
   * Emit a human gate triggered event.
   */
  emitHumanGate(request: HumanGateRequest): void {
    const event = makeEvent(this.harnessId, 'human_gate_triggered', {
      gateId: request.id,
      stepId: request.stepId,
      reason: request.reason,
      proposedAction: request.proposedAction,
    });
    harnessEventStream.emitEvent(event);
  }

  /**
   * Emit a sub-agent lifecycle event.
   * @param type 'spawned' when a child harness is created, 'completed' when it finishes.
   */
  emitSubAgent(
    subAgentId: string,
    type: 'spawned' | 'completed',
    extra?: Record<string, unknown>
  ): void {
    const eventType: HarnessEventType =
      type === 'spawned' ? 'sub_agent_spawned' : 'sub_agent_completed';
    const event = makeEvent(this.harnessId, eventType, {
      subAgentId,
      ...extra,
    });
    harnessEventStream.emitEvent(event);
  }

  /**
   * Emit a checkpoint event.
   * @param type 'created' when a new checkpoint is saved, 'restored' on resume.
   */
  emitCheckpoint(checkpointId: string, type: 'created' | 'restored'): void {
    const eventType: HarnessEventType =
      type === 'created' ? 'checkpoint_created' : 'checkpoint_restored';
    const event = makeEvent(this.harnessId, eventType, { checkpointId });
    harnessEventStream.emitEvent(event);
  }

  /**
   * Emit a step lifecycle event.
   * @param type 'completed' or 'failed'
   */
  emitStep(
    stepId: string,
    type: 'completed' | 'failed',
    extra?: Record<string, unknown>
  ): void {
    const eventType: HarnessEventType =
      type === 'completed' ? 'step_completed' : 'step_failed';
    const event = makeEvent(this.harnessId, eventType, {
      stepId,
      ...extra,
    });
    harnessEventStream.emitEvent(event);
  }

  /**
   * Get the harness ID this emitter is scoped to.
   */
  getHarnessId(): string {
    return this.harnessId;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

export function createObservabilityEmitter(
  harnessId: string,
  tracerSpanName?: string
): ObservabilityEmitter {
  return new ObservabilityEmitter(harnessId, tracerSpanName);
}
