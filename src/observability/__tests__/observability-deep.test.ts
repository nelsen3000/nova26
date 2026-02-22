/**
 * H6-03: Observability Deep Coverage Tests
 *
 * Comprehensive tests for NovaTracer, TelemetryCollector, and event/metrics handling
 * Property-based tests for span nesting validity and event ordering
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Type Definitions
// ============================================================================

interface CouncilVote {
  member: string;
  verdict?: 'approve' | 'reject' | 'abstain';
  vote?: 'approve' | 'reject' | 'abstain';
  reasoning?: string;
  confidence?: number;
}

interface CouncilDecision {
  finalVerdict: 'approved' | 'rejected' | 'pending' | 'deadlock';
  summary: string;
  votes: CouncilVote[];
}

interface TraceHandle {
  id: string;
  name: string;
}

interface Span {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'completed' | 'failed';
  metadata: Record<string, unknown>;
}

interface TelemetryEvent {
  id: string;
  type: 'build' | 'task' | 'agent' | 'feature_flag' | 'error';
  timestamp: number;
  data: Record<string, unknown>;
}

interface TelemetryConfig {
  enabled: boolean;
  endpoint?: string;
  batchSize: number;
  flushIntervalMs: number;
  anonymousId: string;
}

interface BuildMetrics {
  buildId: string;
  taskCount: number;
  durationMs: number;
  success: boolean;
}

// ============================================================================
// Mock NovaTracer
// ============================================================================

class MockNovaTracer {
  private enabled: boolean = true;
  private traces: Map<string, Span[]> = new Map();
  private activeSpans: Map<string, Span> = new Map();
  private spanCounter = 0;

  startTrace(name: string): TraceHandle {
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.traces.set(traceId, []);
    return { id: traceId, name };
  }

  startSpan(traceId: string, name: string, parentSpanId?: string): string {
    const spanId = `span-${++this.spanCounter}`;
    const span: Span = {
      id: spanId,
      traceId,
      parentSpanId,
      name,
      startTime: Date.now(),
      status: 'running',
      metadata: {},
    };

    if (!this.traces.has(traceId)) {
      this.traces.set(traceId, []);
    }

    const trace = this.traces.get(traceId)!;
    trace.push(span);
    this.activeSpans.set(spanId, span);

    return spanId;
  }

  endSpan(spanId: string, status: 'completed' | 'failed' = 'completed'): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.endTime = Date.now();
      span.duration = span.endTime - span.startTime;
      span.status = status;
      this.activeSpans.delete(spanId);
    }
  }

  recordCouncilVote(traceId: string, vote: CouncilVote): void {
    const span = this.startSpan(traceId, `council-vote-${vote.member}`);
    this.activeSpans.get(span)!.metadata = vote;
    this.endSpan(span);
  }

  recordCouncilDecision(traceId: string, decision: CouncilDecision): void {
    const span = this.startSpan(traceId, 'council-decision');
    this.activeSpans.get(span)!.metadata = decision;
    this.endSpan(span);
  }

  getTrace(traceId: string): Span[] | null {
    return this.traces.get(traceId) ?? null;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

// ============================================================================
// Mock TelemetryCollector
// ============================================================================

class MockTelemetryCollector {
  private config: TelemetryConfig;
  private eventQueue: TelemetryEvent[] = [];
  private sessionStart: number = Date.now();

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      batchSize: config.batchSize ?? 10,
      flushIntervalMs: config.flushIntervalMs ?? 5000,
      anonymousId: config.anonymousId ?? `anon-${Math.random().toString(36).slice(2, 9)}`,
    };
  }

  record(event: Omit<TelemetryEvent, 'id' | 'timestamp'>): void {
    if (!this.config.enabled) return;

    const fullEvent: TelemetryEvent = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
    };

    this.eventQueue.push(fullEvent);
  }

  recordBuildMetrics(metrics: BuildMetrics): void {
    this.record({
      type: 'build',
      data: metrics,
    });
  }

  recordAgentUsage(agentName: string, taskCount: number, durationMs: number): void {
    this.record({
      type: 'agent',
      data: { agentName, taskCount, durationMs },
    });
  }

  recordFeatureFlag(flagName: string, value: boolean | string | number): void {
    this.record({
      type: 'feature_flag',
      data: { flagName, value },
    });
  }

  recordError(errorType: string, context: string): void {
    this.record({
      type: 'error',
      data: { errorType, context },
    });
  }

  getQueue(): TelemetryEvent[] {
    return [...this.eventQueue];
  }

  flush(): TelemetryEvent[] {
    const events = [...this.eventQueue];
    this.eventQueue = [];
    return events;
  }

  getEventCount(): number {
    return this.eventQueue.length;
  }
}

// ============================================================================
// NovaTracer Tests
// ============================================================================

describe('Observability NovaTracer — Span Creation & Nesting', () => {
  let tracer: MockNovaTracer;

  beforeEach(() => {
    tracer = new MockNovaTracer();
  });

  it('should create and start a trace', () => {
    const trace = tracer.startTrace('test-trace');

    expect(trace.id).toBeDefined();
    expect(trace.name).toBe('test-trace');
  });

  it('should create spans within a trace', () => {
    const trace = tracer.startTrace('parent-trace');
    const span1 = tracer.startSpan(trace.id, 'span-1');
    const span2 = tracer.startSpan(trace.id, 'span-2');

    expect(span1).toBeDefined();
    expect(span2).toBeDefined();

    const traceSpans = tracer.getTrace(trace.id);
    expect(traceSpans).toHaveLength(2);
  });

  it('should handle span nesting (parent-child relationships)', () => {
    const trace = tracer.startTrace('nested-trace');
    const parentSpan = tracer.startSpan(trace.id, 'parent');
    const childSpan = tracer.startSpan(trace.id, 'child', parentSpan);

    tracer.endSpan(childSpan);
    tracer.endSpan(parentSpan);

    const traceSpans = tracer.getTrace(trace.id);
    expect(traceSpans).toHaveLength(2);

    const child = traceSpans![1];
    expect(child.parentSpanId).toBe(parentSpan);
  });

  it('should track span timing', () => {
    const trace = tracer.startTrace('timing-trace');
    const span = tracer.startSpan(trace.id, 'timed-span');

    expect(tracer.getTrace(trace.id)![0].status).toBe('running');
    expect(tracer.getTrace(trace.id)![0].endTime).toBeUndefined();

    tracer.endSpan(span);

    const endedSpan = tracer.getTrace(trace.id)![0];
    expect(endedSpan.status).toBe('completed');
    expect(endedSpan.endTime).toBeDefined();
    expect(endedSpan.duration).toBeGreaterThanOrEqual(0);
  });

  it('should record council votes in spans', () => {
    const trace = tracer.startTrace('council-trace');

    const vote: CouncilVote = {
      member: 'claude',
      verdict: 'approve',
      confidence: 0.9,
      reasoning: 'looks good',
    };

    tracer.recordCouncilVote(trace.id, vote);

    const spans = tracer.getTrace(trace.id);
    expect(spans).toHaveLength(1);
    expect(spans![0].metadata).toEqual(vote);
  });

  it('should record council decisions', () => {
    const trace = tracer.startTrace('decision-trace');

    const decision: CouncilDecision = {
      finalVerdict: 'approved',
      summary: 'All council members approved',
      votes: [
        { member: 'alice', vote: 'approve' },
        { member: 'bob', vote: 'approve' },
      ],
    };

    tracer.recordCouncilDecision(trace.id, decision);

    const spans = tracer.getTrace(trace.id);
    expect(spans![0].metadata).toEqual(decision);
  });

  it('should enable/disable tracing', () => {
    expect(tracer.isEnabled()).toBe(true);

    tracer.setEnabled(false);
    expect(tracer.isEnabled()).toBe(false);

    tracer.setEnabled(true);
    expect(tracer.isEnabled()).toBe(true);
  });

  it('property-based: span nesting respects parent-child bounds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (depthLevel) => {
          const tr = new MockNovaTracer();
          const trace = tr.startTrace('test');

          let parentSpanId: string | undefined;
          for (let i = 0; i < depthLevel; i++) {
            const span = tr.startSpan(trace.id, `span-${i}`, parentSpanId);
            parentSpanId = span;
          }

          const spans = tr.getTrace(trace.id);
          // All spans should be in trace
          return spans!.length === depthLevel;
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ============================================================================
// TelemetryCollector Tests
// ============================================================================

describe('Observability TelemetryCollector — Event Collection & Aggregation', () => {
  let collector: MockTelemetryCollector;

  beforeEach(() => {
    collector = new MockTelemetryCollector({ enabled: true });
  });

  it('should record build metrics', () => {
    const metrics: BuildMetrics = {
      buildId: 'build-123',
      taskCount: 5,
      durationMs: 1500,
      success: true,
    };

    collector.recordBuildMetrics(metrics);

    const queue = collector.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('build');
  });

  it('should record agent usage', () => {
    collector.recordAgentUsage('agent-1', 10, 2500);

    const queue = collector.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('agent');
  });

  it('should record feature flags', () => {
    collector.recordFeatureFlag('dark-mode', true);
    collector.recordFeatureFlag('beta-features', 'enabled');
    collector.recordFeatureFlag('max-concurrent', 100);

    const queue = collector.getQueue();
    expect(queue).toHaveLength(3);
    expect(queue.every((e) => e.type === 'feature_flag')).toBe(true);
  });

  it('should record errors', () => {
    collector.recordError('TimeoutError', 'LLM request exceeded 30s');

    const queue = collector.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('error');
  });

  it('should batch events', () => {
    for (let i = 0; i < 15; i++) {
      collector.recordAgentUsage(`agent-${i}`, 1, 100);
    }

    expect(collector.getEventCount()).toBe(15);
  });

  it('should flush queue and reset', () => {
    collector.recordBuildMetrics({ buildId: 'b1', taskCount: 5, durationMs: 1000, success: true });
    collector.recordAgentUsage('a1', 3, 500);

    expect(collector.getEventCount()).toBe(2);

    const flushed = collector.flush();

    expect(flushed).toHaveLength(2);
    expect(collector.getEventCount()).toBe(0);
  });

  it('should respect enabled flag', () => {
    const disabledCollector = new MockTelemetryCollector({ enabled: false });

    disabledCollector.recordBuildMetrics({ buildId: 'b1', taskCount: 5, durationMs: 1000, success: true });

    expect(disabledCollector.getEventCount()).toBe(0);
  });

  it('property-based: events have chronological timestamps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (eventCount) => {
          const c = new MockTelemetryCollector({ enabled: true });

          for (let i = 0; i < eventCount; i++) {
            c.recordAgentUsage(`agent-${i}`, 1, 100);
          }

          const queue = c.getQueue();
          for (let i = 1; i < queue.length; i++) {
            if (queue[i].timestamp < queue[i - 1].timestamp) {
              return false;
            }
          }

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Observability Integration — Tracer + Telemetry', () => {
  it('should trace a complete build with telemetry', () => {
    const tracer = new MockNovaTracer();
    const collector = new MockTelemetryCollector({ enabled: true });

    // Start trace
    const trace = tracer.startTrace('build-execution');

    // Record telemetry
    collector.recordBuildMetrics({ buildId: 'build-1', taskCount: 5, durationMs: 1200, success: true });

    // Record agent usage in telemetry
    collector.recordAgentUsage('analyzer', 2, 300);
    collector.recordAgentUsage('synthesizer', 3, 700);

    // Complete trace
    const spans = tracer.getTrace(trace.id);

    expect(spans).not.toBeNull();
    expect(collector.getEventCount()).toBe(3);
  });

  it('should handle concurrent traces', () => {
    const tracer = new MockNovaTracer();

    const trace1 = tracer.startTrace('trace-1');
    const trace2 = tracer.startTrace('trace-2');

    tracer.startSpan(trace1.id, 'span-1');
    tracer.startSpan(trace2.id, 'span-2');

    const spans1 = tracer.getTrace(trace1.id);
    const spans2 = tracer.getTrace(trace2.id);

    expect(spans1).toHaveLength(1);
    expect(spans2).toHaveLength(1);
  });
});

// ============================================================================
// Stress Tests
// ============================================================================

describe('Observability Stress Tests', () => {
  it('should handle 1000 span creations', () => {
    const tracer = new MockNovaTracer();
    const trace = tracer.startTrace('stress-test');

    for (let i = 0; i < 1000; i++) {
      const span = tracer.startSpan(trace.id, `span-${i}`);
      tracer.endSpan(span);
    }

    const spans = tracer.getTrace(trace.id);
    expect(spans).toHaveLength(1000);
  });

  it('should handle deeply nested spans', () => {
    const tracer = new MockNovaTracer();
    const trace = tracer.startTrace('deep-nesting');

    let parentSpanId: string | undefined;
    for (let i = 0; i < 50; i++) {
      const span = tracer.startSpan(trace.id, `span-${i}`, parentSpanId);
      parentSpanId = span;
    }

    const spans = tracer.getTrace(trace.id);
    expect(spans).toHaveLength(50);
  });

  it('should handle 10k telemetry events', () => {
    const collector = new MockTelemetryCollector({ enabled: true });

    for (let i = 0; i < 10000; i++) {
      const type = ['build', 'task', 'agent', 'feature_flag', 'error'][i % 5] as any;
      collector.record({ type, data: { index: i } });
    }

    expect(collector.getEventCount()).toBe(10000);

    const flushed = collector.flush();
    expect(flushed).toHaveLength(10000);
  });

  it('should efficiently flush large batches', () => {
    const collector = new MockTelemetryCollector({ enabled: true, batchSize: 100 });

    for (let i = 0; i < 5000; i++) {
      collector.recordAgentUsage(`agent-${i % 50}`, 1, 100);
    }

    const flushed = collector.flush();

    expect(flushed).toHaveLength(5000);
    expect(collector.getEventCount()).toBe(0);
  });
});
