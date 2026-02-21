// Cinematic Observability — CinematicSpan, EvalSuite, Director Dashboard
// Analogy: The Private Dailies Theater with God-Mode
// KIMI-R23-05 | Feb 2026

export type SpanKind = 'agent' | 'llm' | 'tool' | 'chain' | 'retrieval' | 'embedding';
export type SpanStatus = 'running' | 'success' | 'error' | 'timeout';

export interface CinematicSpan {
  id: string;
  parentId: string | null;
  traceId: string;
  name: string;
  kind: SpanKind;
  agentId?: string;
  modelUsed?: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: SpanStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  tasteScore?: number;       // Taste Vault alignment
  metadata: Record<string, unknown>;
}

export interface EvalExample {
  id: string;
  input: string;
  expectedOutput: string;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface EvalScore {
  exampleId: string;
  score: number;           // 0-1
  passed: boolean;
  reason: string;
  actualOutput: string;
  latencyMs: number;
}

export interface CinematicEvalSuite {
  id: string;
  name: string;
  examples: EvalExample[];
  scoringFn: (actual: string, expected: string) => number;
  passThreshold: number;   // 0-1; examples with score >= this pass
  agentId?: string;
}

export interface EvalSuiteResult {
  suiteId: string;
  passRate: number;
  avgScore: number;
  scores: EvalScore[];
  tasteAlignmentRate: number;
  durationMs: number;
  timestamp: number;
}

export interface DirectorDashboard {
  activeSessions: number;
  totalSpans: number;
  avgLatencyMs: number;
  errorRate: number;
  topAgents: Array<{ agentId: string; spanCount: number; avgScore: number }>;
  recentEvals: EvalSuiteResult[];
  tasteDropAlert: boolean;   // true if taste score dropped > 8%
  loadMs: number;            // time to render dashboard
}

export interface AutoRemediationAction {
  triggeredAt: number;
  reason: string;
  action: string;
  affectedAgentId?: string;
}

export class CinematicObservability {
  private traces = new Map<string, CinematicSpan[]>(); // traceId → spans
  private evalResults: EvalSuiteResult[] = [];
  private remediations: AutoRemediationAction[] = [];
  private tasteScoreHistory: number[] = [];
  private tasteDropThreshold = 0.08;

  recordSpan(span: CinematicSpan): void {
    if (!this.traces.has(span.traceId)) {
      this.traces.set(span.traceId, []);
    }
    // Complete the span if endTime is set
    if (span.endTime && !span.durationMs) {
      span.durationMs = span.endTime - span.startTime;
    }
    this.traces.get(span.traceId)!.push(span);

    // Track taste scores
    if (span.tasteScore !== undefined) {
      this.tasteScoreHistory.push(span.tasteScore);
      this.checkTasteDrop();
    }
  }

  completeSpan(
    traceId: string,
    spanId: string,
    opts: { output?: unknown; error?: string; status?: SpanStatus; tokensOut?: number; tasteScore?: number },
  ): void {
    const spans = this.traces.get(traceId) ?? [];
    const span = spans.find(s => s.id === spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
    span.status = opts.error ? 'error' : (opts.status ?? 'success');
    if (opts.output !== undefined) span.output = opts.output;
    if (opts.error) span.error = opts.error;
    if (opts.tokensOut !== undefined) span.tokensOut = opts.tokensOut;
    if (opts.tasteScore !== undefined) {
      span.tasteScore = opts.tasteScore;
      this.tasteScoreHistory.push(opts.tasteScore);
      this.checkTasteDrop();
    }
  }

  async runEvalSuite(
    suite: CinematicEvalSuite,
    runFn: (input: string) => Promise<string>,
  ): Promise<EvalSuiteResult> {
    const start = Date.now();
    const scores: EvalScore[] = [];

    for (const example of suite.examples) {
      const exampleStart = Date.now();
      let actualOutput = '';
      let score = 0;

      try {
        actualOutput = await runFn(example.input);
        score = suite.scoringFn(actualOutput, example.expectedOutput);
      } catch (err) {
        score = 0;
        actualOutput = `ERROR: ${String(err)}`;
      }

      scores.push({
        exampleId: example.id,
        score,
        passed: score >= suite.passThreshold,
        reason: score >= suite.passThreshold ? 'above threshold' : 'below threshold',
        actualOutput,
        latencyMs: Date.now() - exampleStart,
      });
    }

    const passRate = scores.filter(s => s.passed).length / Math.max(scores.length, 1);
    const avgScore = scores.reduce((s, r) => s + r.score, 0) / Math.max(scores.length, 1);
    const tasteAlignmentRate = scores.filter(s => s.score >= 0.8).length / Math.max(scores.length, 1);

    const result: EvalSuiteResult = {
      suiteId: suite.id,
      passRate,
      avgScore,
      scores,
      tasteAlignmentRate,
      durationMs: Date.now() - start,
      timestamp: Date.now(),
    };

    this.evalResults.push(result);

    // Auto-remediation: if taste alignment drops > 8%
    if (this.evalResults.length >= 2) {
      const prev = this.evalResults[this.evalResults.length - 2]!;
      const drop = prev.tasteAlignmentRate - tasteAlignmentRate;
      if (drop > this.tasteDropThreshold) {
        this.triggerRemediation(`Taste alignment dropped ${(drop * 100).toFixed(1)}% in eval suite ${suite.id}`, suite.agentId);
      }
    }

    return result;
  }

  renderDirectorDashboard(): DirectorDashboard {
    const renderStart = Date.now();
    const allSpans = [...this.traces.values()].flat();

    const agentMap = new Map<string, { count: number; scores: number[] }>();
    let totalDurationMs = 0;
    let errorCount = 0;

    for (const span of allSpans) {
      if (span.agentId) {
        if (!agentMap.has(span.agentId)) agentMap.set(span.agentId, { count: 0, scores: [] });
        const entry = agentMap.get(span.agentId)!;
        entry.count++;
        if (span.tasteScore !== undefined) entry.scores.push(span.tasteScore);
      }
      if (span.durationMs) totalDurationMs += span.durationMs;
      if (span.status === 'error') errorCount++;
    }

    const topAgents = [...agentMap.entries()]
      .map(([agentId, data]) => ({
        agentId,
        spanCount: data.count,
        avgScore: data.scores.length ? data.scores.reduce((s, v) => s + v, 0) / data.scores.length : 0,
      }))
      .sort((a, b) => b.spanCount - a.spanCount)
      .slice(0, 5);

    const tasteDropAlert = this.checkRecentTasteDrop();

    return {
      activeSessions: this.traces.size,
      totalSpans: allSpans.length,
      avgLatencyMs: allSpans.length ? totalDurationMs / allSpans.length : 0,
      errorRate: allSpans.length ? errorCount / allSpans.length : 0,
      topAgents,
      recentEvals: this.evalResults.slice(-5),
      tasteDropAlert,
      loadMs: Date.now() - renderStart,
    };
  }

  getTrace(traceId: string): CinematicSpan[] {
    return this.traces.get(traceId) ?? [];
  }

  getRemediations(): AutoRemediationAction[] {
    return [...this.remediations];
  }

  getTraceFidelity(traceId: string): number {
    const spans = this.traces.get(traceId) ?? [];
    if (!spans.length) return 0;
    const complete = spans.filter(s => s.status === 'success' || s.status === 'error').length;
    return complete / spans.length;
  }

  clear(): void {
    this.traces.clear();
    this.evalResults = [];
    this.remediations = [];
    this.tasteScoreHistory = [];
  }

  private checkTasteDrop(): void {
    if (this.tasteScoreHistory.length < 10) return;
    const recent = this.tasteScoreHistory.slice(-5);
    const older = this.tasteScoreHistory.slice(-10, -5);
    const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
    const olderAvg = older.reduce((s, v) => s + v, 0) / older.length;
    const drop = olderAvg - recentAvg;
    if (drop > this.tasteDropThreshold) {
      this.triggerRemediation(`Taste score dropped ${(drop * 100).toFixed(1)}% in recent spans`);
    }
  }

  private checkRecentTasteDrop(): boolean {
    if (this.tasteScoreHistory.length < 10) return false;
    const recent = this.tasteScoreHistory.slice(-5);
    const older = this.tasteScoreHistory.slice(-10, -5);
    const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
    const olderAvg = older.reduce((s, v) => s + v, 0) / older.length;
    return olderAvg - recentAvg > this.tasteDropThreshold;
  }

  private triggerRemediation(reason: string, agentId?: string): void {
    this.remediations.push({
      triggeredAt: Date.now(),
      reason,
      action: 'alert-and-throttle',
      affectedAgentId: agentId,
    });
  }
}

// Factory
export function createCinematicObservability(): CinematicObservability {
  return new CinematicObservability();
}
