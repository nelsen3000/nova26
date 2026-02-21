// ATLAS Visual Memory Hook — Records workflow events into long-term memory
// KIMI-R23-01 | Feb 2026

import type { TemporalEvent, WorkflowState, WorkflowCheckpoint } from '../workflow-engine/types.js';

export interface VisualMemoryEntry {
  id: string;
  workflowId: string;
  workflowName: string;
  eventType: string;
  nodeId?: string;
  agentId?: string;
  timestamp: number;
  payload: Record<string, unknown>;
  tasteVaultScore?: number;
}

export interface VisualMemoryQuery {
  workflowId?: string;
  agentId?: string;
  eventType?: string;
  fromTimestamp?: number;
  toTimestamp?: number;
  limit?: number;
}

export interface VisualMemoryHookConfig {
  enabled: boolean;
  recordCheckpoints: boolean;
  recordNodeEvents: boolean;
  maxMemorySize: number;    // max entries in memory
  tasteVaultThreshold: number; // only record if tasteVaultScore >= this
}

const DEFAULT_HOOK_CONFIG: VisualMemoryHookConfig = {
  enabled: true,
  recordCheckpoints: true,
  recordNodeEvents: true,
  maxMemorySize: 50000,
  tasteVaultThreshold: 0.0,
};

export class ATLASVisualMemoryHook {
  private config: VisualMemoryHookConfig;
  private memory: VisualMemoryEntry[] = [];
  private workflowNames = new Map<string, string>();

  constructor(config: Partial<VisualMemoryHookConfig> = {}) {
    this.config = { ...DEFAULT_HOOK_CONFIG, ...config };
  }

  registerWorkflow(workflowId: string, name: string): void {
    this.workflowNames.set(workflowId, name);
  }

  onEvent(event: TemporalEvent, state?: WorkflowState): void {
    if (!this.config.enabled) return;

    // Filter by event type
    if (!this.config.recordNodeEvents && event.eventType.startsWith('node.')) return;
    if (!this.config.recordCheckpoints && event.eventType === 'checkpoint.created') return;

    const tasteScore = state?.tasteVaultScore ?? 1.0;
    if (tasteScore < this.config.tasteVaultThreshold) return;

    const entry: VisualMemoryEntry = {
      id: event.id,
      workflowId: event.workflowId,
      workflowName: this.workflowNames.get(event.workflowId) ?? 'unknown',
      eventType: event.eventType,
      nodeId: event.nodeId,
      agentId: this.extractAgentId(event, state),
      timestamp: event.timestamp,
      payload: event.payload,
      tasteVaultScore: tasteScore,
    };

    this.memory.push(entry);

    // Evict oldest entries when at capacity
    if (this.memory.length > this.config.maxMemorySize) {
      this.memory.shift();
    }
  }

  onCheckpoint(checkpoint: WorkflowCheckpoint, state?: WorkflowState): void {
    if (!this.config.enabled || !this.config.recordCheckpoints) return;

    const entry: VisualMemoryEntry = {
      id: checkpoint.id,
      workflowId: checkpoint.workflowId,
      workflowName: this.workflowNames.get(checkpoint.workflowId) ?? 'unknown',
      eventType: 'checkpoint.created',
      timestamp: checkpoint.timestamp,
      payload: {
        label: checkpoint.label,
        nodeStates: checkpoint.nodeStates,
        sequenceNumber: checkpoint.sequenceNumber,
      },
      tasteVaultScore: state?.tasteVaultScore,
    };

    this.memory.push(entry);
    if (this.memory.length > this.config.maxMemorySize) {
      this.memory.shift();
    }
  }

  query(q: VisualMemoryQuery): VisualMemoryEntry[] {
    let results = this.memory;

    if (q.workflowId) results = results.filter(e => e.workflowId === q.workflowId);
    if (q.agentId) results = results.filter(e => e.agentId === q.agentId);
    if (q.eventType) results = results.filter(e => e.eventType === q.eventType);
    if (q.fromTimestamp) results = results.filter(e => e.timestamp >= q.fromTimestamp!);
    if (q.toTimestamp) results = results.filter(e => e.timestamp <= q.toTimestamp!);

    if (q.limit) results = results.slice(-q.limit);

    return results;
  }

  getWorkflowHistory(workflowId: string): VisualMemoryEntry[] {
    return this.query({ workflowId });
  }

  getAgentActivity(agentId: string, limit = 100): VisualMemoryEntry[] {
    return this.query({ agentId, limit });
  }

  getMemorySize(): number {
    return this.memory.length;
  }

  extractPatterns(): Record<string, number> {
    const agentFailureRates: Record<string, { fail: number; total: number }> = {};

    for (const e of this.memory) {
      if (!e.agentId) continue;
      if (!agentFailureRates[e.agentId]) {
        agentFailureRates[e.agentId] = { fail: 0, total: 0 };
      }
      if (e.eventType === 'node.started') {
        agentFailureRates[e.agentId]!.total++;
      }
      if (e.eventType === 'node.failed') {
        agentFailureRates[e.agentId]!.fail++;
      }
    }

    const failureRates: Record<string, number> = {};
    for (const [agentId, counts] of Object.entries(agentFailureRates)) {
      failureRates[agentId] = counts.total > 0 ? counts.fail / counts.total : 0;
    }

    return failureRates;
  }

  clear(): void {
    this.memory = [];
  }

  private extractAgentId(event: TemporalEvent, state?: WorkflowState): string | undefined {
    if (event.payload['agentId']) return event.payload['agentId'] as string;
    if (event.nodeId && state) {
      return state.nodes.get(event.nodeId)?.agentId;
    }
    return undefined;
  }
}
