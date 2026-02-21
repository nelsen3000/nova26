// KIMI-R23-05: Cinematic Observability & Eval Suite - LangSmith Bridge
// LangSmith integration for distributed tracing and LLM observability

import {
  type CinematicSpan,
  type LangSmithTrace,
  type SpanType,
  type SpanStatus,
} from './types.js';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * LangSmith API configuration
 */
export interface LangSmithConfig {
  /** LangSmith API key */
  apiKey: string;
  /** LangSmith endpoint */
  endpoint: string;
  /** Project name */
  projectName: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Trace sampling rate (0-1) */
  sampleRate?: number;
  /** Auto-flush interval in ms */
  flushIntervalMs?: number;
}

/**
 * LangSmith run creation input
 */
export interface LangSmithRunInput {
  /** Run name */
  name: string;
  /** Run type */
  runType: 'chain' | 'llm' | 'tool' | 'retriever' | 'embedding' | 'agent';
  /** Trace ID */
  traceId?: string;
  /** Parent run ID */
  parentRunId?: string;
  /** Inputs */
  inputs: Record<string, unknown>;
  /** Metadata */
  metadata?: Record<string, unknown>;
  /** Tags */
  tags?: string[];
}

/**
 * LangSmith feedback input
 */
export interface LangSmithFeedback {
  /** Run ID */
  runId: string;
  /** Feedback key/type */
  key: string;
  /** Score (0-1 or any number) */
  score?: number;
  /** Comment */
  comment?: string;
  /** Correction value */
  correction?: unknown;
}

// ============================================================================
// Mock LangSmith Client
// ============================================================================

/**
 * Mock LangSmith client for Nova26 development
 * In production, this would connect to the actual LangSmith API
 */
class LangSmithClient {
  private config: LangSmithConfig;
  private runs: Map<string, LangSmithTrace> = new Map();
  private pendingRuns: LangSmithTrace[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private connected: boolean = false;

  constructor(config: LangSmithConfig) {
    this.config = config;
    this.startAutoFlush();
  }

  /**
   * Connect to LangSmith (mock)
   */
  async connect(): Promise<boolean> {
    if (this.config.debug) {
      console.log('[LangSmith] Connecting to project:', this.config.projectName);
    }
    
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    this.connected = true;
    
    if (this.config.debug) {
      console.log('[LangSmith] Connected successfully');
    }
    
    return true;
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    await this.flush();
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    this.connected = false;
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Create a new run
   */
  async createRun(input: LangSmithRunInput): Promise<LangSmithTrace> {
    this.ensureConnected();
    
    // Apply sampling
    if (Math.random() > (this.config.sampleRate || 1)) {
      throw new Error('Run sampled out');
    }

    const run: LangSmithTrace = {
      id: this.generateId(),
      traceId: input.traceId || this.generateId(),
      name: input.name,
      runType: input.runType,
      startTime: new Date().toISOString(),
      inputs: input.inputs,
      childRuns: [],
    };

    this.runs.set(run.id, run);
    this.pendingRuns.push(run);

    if (this.config.debug) {
      console.log(`[LangSmith] Run created: ${run.name} (${run.id})`);
    }

    return run;
  }

  /**
   * Update a run with outputs
   */
  async updateRun(
    runId: string,
    outputs: Record<string, unknown>,
    error?: string
  ): Promise<void> {
    this.ensureConnected();
    
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    run.outputs = outputs;
    run.endTime = new Date().toISOString();
    
    if (error) {
      run.error = error;
    }

    if (this.config.debug) {
      console.log(`[LangSmith] Run updated: ${run.name} (${error ? 'failed' : 'success'})`);
    }
  }

  /**
   * End a run
   */
  async endRun(runId: string, error?: string): Promise<void> {
    this.ensureConnected();
    
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    run.endTime = new Date().toISOString();
    
    if (error) {
      run.error = error;
    }

    if (this.config.debug) {
      console.log(`[LangSmith] Run ended: ${run.name}`);
    }
  }

  /**
   * Create a child run
   */
  async createChildRun(
    parentRunId: string,
    input: LangSmithRunInput
  ): Promise<LangSmithTrace> {
    this.ensureConnected();
    
    const parent = this.runs.get(parentRunId);
    if (!parent) {
      throw new Error(`Parent run not found: ${parentRunId}`);
    }

    const childRun: LangSmithTrace = {
      id: this.generateId(),
      traceId: parent.traceId,
      name: input.name,
      runType: input.runType,
      startTime: new Date().toISOString(),
      inputs: input.inputs,
      childRuns: [],
    };

    parent.childRuns.push(childRun);
    this.runs.set(childRun.id, childRun);

    if (this.config.debug) {
      console.log(`[LangSmith] Child run created: ${childRun.name} under ${parent.name}`);
    }

    return childRun;
  }

  /**
   * Add feedback to a run
   */
  async addFeedback(feedback: LangSmithFeedback): Promise<void> {
    this.ensureConnected();
    
    const run = this.runs.get(feedback.runId);
    if (!run) {
      throw new Error(`Run not found: ${feedback.runId}`);
    }

    // Store feedback in run metadata
    if (!run.inputs._feedback) {
      run.inputs._feedback = [];
    }
    (run.inputs._feedback as LangSmithFeedback[]).push(feedback);

    if (this.config.debug) {
      console.log(`[LangSmith] Feedback added to ${run.name}: ${feedback.key}=${feedback.score}`);
    }
  }

  /**
   * Get a run by ID
   */
  async getRun(runId: string): Promise<LangSmithTrace | null> {
    this.ensureConnected();
    return this.runs.get(runId) || null;
  }

  /**
   * Get runs by trace ID
   */
  async getTraceRuns(traceId: string): Promise<LangSmithTrace[]> {
    this.ensureConnected();
    
    return Array.from(this.runs.values()).filter(run => run.traceId === traceId);
  }

  /**
   * Flush pending runs to LangSmith
   */
  async flush(): Promise<void> {
    if (this.pendingRuns.length === 0) {
      return;
    }

    if (this.config.debug) {
      console.log(`[LangSmith] Flushing ${this.pendingRuns.length} runs`);
    }

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 10));

    // Clear pending runs
    this.pendingRuns = [];

    if (this.config.debug) {
      console.log('[LangSmith] Flush complete');
    }
  }

  /**
   * Get run statistics
   */
  getStats(): {
    totalRuns: number;
    pendingRuns: number;
    traces: number;
  } {
    const traces = new Set(Array.from(this.runs.values()).map(r => r.traceId));
    
    return {
      totalRuns: this.runs.size,
      pendingRuns: this.pendingRuns.length,
      traces: traces.size,
    };
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('LangSmith client not connected. Call connect() first.');
    }
  }

  private generateId(): string {
    return `run_${Math.random().toString(36).substring(2, 15)}`;
  }

  private startAutoFlush(): void {
    const interval = this.config.flushIntervalMs || 30000;
    this.flushTimer = setInterval(() => {
      this.flush().catch(err => {
        console.error('[LangSmith] Auto-flush failed:', err);
      });
    }, interval);
  }
}

// ============================================================================
// LangSmithBridge Class
// ============================================================================

/**
 * LangSmithBridge - Integration layer for LangSmith tracing
 * Provides distributed trace tracking for LLM calls and agent executions
 */
export class LangSmithBridge {
  private client: LangSmithClient;
  private config: LangSmithConfig;
  private spanToRunMap: Map<string, string> = new Map();

  constructor(config: LangSmithConfig) {
    this.config = config;
    this.client = new LangSmithClient(config);
  }

  /**
   * Initialize the bridge and connect to LangSmith
   */
  async initialize(): Promise<boolean> {
    return this.client.connect();
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    return this.client.disconnect();
  }

  /**
   * Check if bridge is connected
   */
  isConnected(): boolean {
    return this.client.isConnected();
  }

  /**
   * Convert CinematicSpan type to LangSmith run type
   */
  private mapSpanTypeToRunType(spanType: SpanType): LangSmithRunInput['runType'] {
    switch (spanType) {
      case 'agent-call':
        return 'agent';
      case 'llm-inference':
        return 'llm';
      case 'tool-use':
        return 'tool';
      case 'gate-check':
        return 'chain';
      case 'user-interaction':
        return 'chain';
      default:
        return 'chain';
    }
  }

  /**
   * Convert CinematicSpan status to LangSmith error status
   */
  private mapStatusToError(status: SpanStatus): string | undefined {
    return status === 'failure' ? 'Span execution failed' : undefined;
  }

  /**
   * Convert LangSmith run type to CinematicSpan type
   */
  private mapRunTypeToSpanType(runType: LangSmithTrace['runType'] | string): SpanType {
    switch (runType) {
      case 'agent':
        return 'agent-call';
      case 'llm':
        return 'llm-inference';
      case 'tool':
        return 'tool-use';
      case 'chain':
        return 'gate-check';
      case 'retriever':
      case 'embedding':
        return 'tool-use';
      default:
        return 'agent-call';
    }
  }

  /**
   * Export a CinematicSpan to LangSmith
   */
  async exportSpan(span: CinematicSpan): Promise<string> {
    // Check if span already exported
    if (this.spanToRunMap.has(span.id)) {
      return this.spanToRunMap.get(span.id)!;
    }

    const runInput: LangSmithRunInput = {
      name: span.name,
      runType: this.mapSpanTypeToRunType(span.type),
      traceId: span.traceId,
      inputs: {
        agentId: span.agentId,
        spanType: span.type,
        ...span.metadata,
      },
      metadata: {
        cinematicSpanId: span.id,
        tasteVaultScore: span.tasteVaultScore,
        startTime: span.startTime,
      },
      tags: [span.type, span.agentId, span.status],
    };

    let run: LangSmithTrace;

    if (span.parentId && this.spanToRunMap.has(span.parentId)) {
      // Create as child run
      const parentRunId = this.spanToRunMap.get(span.parentId)!;
      run = await this.client.createChildRun(parentRunId, runInput);
    } else {
      // Create as root run
      run = await this.client.createRun(runInput);
    }

    // Map span to run
    this.spanToRunMap.set(span.id, run.id);

    // If span is complete, update with outputs
    if (span.status !== 'running' && span.endTime) {
      const outputs: Record<string, unknown> = {
        status: span.status,
        durationMs: span.durationMs,
      };

      await this.client.updateRun(
        run.id,
        outputs,
        this.mapStatusToError(span.status)
      );
    }

    return run.id;
  }

  /**
   * Export multiple spans to LangSmith
   */
  async exportSpans(spans: CinematicSpan[]): Promise<string[]> {
    const runIds: string[] = [];
    
    // Sort spans by start time to ensure parent runs are created first
    const sortedSpans = [...spans].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    for (const span of sortedSpans) {
      const runId = await this.exportSpan(span);
      runIds.push(runId);
    }

    return runIds;
  }

  /**
   * Update an exported span with completion data
   */
  async completeSpan(span: CinematicSpan): Promise<void> {
    const runId = this.spanToRunMap.get(span.id);
    if (!runId) {
      throw new Error(`Span not exported: ${span.id}`);
    }

    const outputs: Record<string, unknown> = {
      status: span.status,
      durationMs: span.durationMs,
      endTime: span.endTime,
      ...span.metadata,
    };

    await this.client.updateRun(
      runId,
      outputs,
      this.mapStatusToError(span.status)
    );
  }

  /**
   * Import a LangSmith trace as CinematicSpans
   */
  async importTrace(traceId: string): Promise<CinematicSpan[]> {
    const runs = await this.client.getTraceRuns(traceId);
    const spans: CinematicSpan[] = [];

    for (const run of runs) {
      const span = this.convertRunToSpan(run);
      spans.push(span);
    }

    return spans;
  }

  /**
   * Convert a LangSmith run to CinematicSpan
   */
  private convertRunToSpan(run: LangSmithTrace): CinematicSpan {
    const metadata = run.inputs.metadata as Record<string, unknown> || {};
    
    return {
      id: (metadata.cinematicSpanId as string) || this.generateSpanId(),
      traceId: run.traceId,
      name: run.name,
      agentId: (run.inputs.agentId as string) || 'unknown',
      type: this.mapRunTypeToSpanType(run.runType),
      startTime: run.startTime,
      endTime: run.endTime,
      durationMs: run.startTime && run.endTime
        ? new Date(run.endTime).getTime() - new Date(run.startTime).getTime()
        : undefined,
      metadata: run.inputs,
      status: run.error ? 'failure' : run.endTime ? 'success' : 'running',
    };
  }

  /**
   * Add feedback to an exported span
   */
  async addSpanFeedback(
    spanId: string,
    feedback: Omit<LangSmithFeedback, 'runId'>
  ): Promise<void> {
    const runId = this.spanToRunMap.get(spanId);
    if (!runId) {
      throw new Error(`Span not exported: ${spanId}`);
    }

    await this.client.addFeedback({
      ...feedback,
      runId,
    });
  }

  /**
   * Flush pending traces to LangSmith
   */
  async flush(): Promise<void> {
    return this.client.flush();
  }

  /**
   * Get bridge statistics
   */
  getStats(): {
    totalRuns: number;
    pendingRuns: number;
    traces: number;
    exportedSpans: number;
    projectName: string;
  } {
    const clientStats = this.client.getStats();
    
    return {
      ...clientStats,
      exportedSpans: this.spanToRunMap.size,
      projectName: this.config.projectName,
    };
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private generateSpanId(): string {
    return `span_${Math.random().toString(36).substring(2, 15)}`;
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let langsmithBridgeInstance: LangSmithBridge | null = null;

/**
 * Get or create the singleton LangSmithBridge instance
 */
export function getLangSmithBridge(config?: LangSmithConfig): LangSmithBridge {
  if (!langsmithBridgeInstance && config) {
    langsmithBridgeInstance = new LangSmithBridge(config);
  }
  
  if (!langsmithBridgeInstance) {
    throw new Error('LangSmithBridge not initialized. Provide config on first call.');
  }
  
  return langsmithBridgeInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetLangSmithBridge(): void {
  langsmithBridgeInstance = null;
}

/**
 * Create a new bridge instance
 */
export function createLangSmithBridge(config: LangSmithConfig): LangSmithBridge {
  return new LangSmithBridge(config);
}
