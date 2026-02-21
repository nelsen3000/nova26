// Braintrust Adapter — Experiment tracking in Braintrust format
// KIMI-R23-05 | Feb 2026

export interface BraintrustExperiment {
  id: string;
  name: string;
  projectId: string;
  datasetId?: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface BraintrustDataRow {
  id: string;
  input: unknown;
  expected?: unknown;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface BraintrustScores {
  [scorer: string]: number;  // e.g. accuracy: 0.92, faithfulness: 0.87
}

export interface BraintrustSpan {
  id: string;
  spanType: 'llm' | 'function' | 'tool' | 'task' | 'eval';
  name: string;
  input: unknown;
  output: unknown;
  expected?: unknown;
  scores: BraintrustScores;
  metadata: Record<string, unknown>;
  startTime: string;   // ISO
  endTime?: string;
  durationMs?: number;
  tokensIn?: number;
  tokensOut?: number;
}

export interface BraintrustExperimentResult {
  experimentId: string;
  rows: Array<{
    dataRowId: string;
    scores: BraintrustScores;
    spans: BraintrustSpan[];
  }>;
  summaryScores: BraintrustScores;
  createdAt: string;
}

export class BraintrustAdapter {
  private experiments = new Map<string, BraintrustExperiment>();
  private results = new Map<string, BraintrustExperimentResult>();

  createExperiment(
    name: string,
    projectId: string,
    metadata: Record<string, unknown> = {},
  ): BraintrustExperiment {
    const experiment: BraintrustExperiment = {
      id: `bt-exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      projectId,
      createdAt: new Date().toISOString(),
      metadata,
    };
    this.experiments.set(experiment.id, experiment);
    return experiment;
  }

  logSpan(
    experimentId: string,
    dataRowId: string,
    span: Omit<BraintrustSpan, 'startTime'> & { startTime?: string },
  ): void {
    const fullSpan: BraintrustSpan = {
      ...span,
      startTime: span.startTime ?? new Date().toISOString(),
    };

    let result = this.results.get(experimentId);
    if (!result) {
      const exp = this.experiments.get(experimentId);
      result = {
        experimentId,
        rows: [],
        summaryScores: {},
        createdAt: exp?.createdAt ?? new Date().toISOString(),
      };
      this.results.set(experimentId, result);
    }

    let row = result.rows.find(r => r.dataRowId === dataRowId);
    if (!row) {
      row = { dataRowId, scores: {}, spans: [] };
      result.rows.push(row);
    }

    row.spans.push(fullSpan);

    // Merge scores from span into row scores
    for (const [scorer, score] of Object.entries(fullSpan.scores)) {
      row.scores[scorer] = score;
    }

    this.recomputeSummary(result);
  }

  getResult(experimentId: string): BraintrustExperimentResult | undefined {
    return this.results.get(experimentId);
  }

  getExperiment(experimentId: string): BraintrustExperiment | undefined {
    return this.experiments.get(experimentId);
  }

  listExperiments(): BraintrustExperiment[] {
    return [...this.experiments.values()];
  }

  compareExperiments(id1: string, id2: string): Record<string, { exp1: number; exp2: number; delta: number }> {
    const r1 = this.results.get(id1);
    const r2 = this.results.get(id2);
    if (!r1 || !r2) return {};

    const comparison: Record<string, { exp1: number; exp2: number; delta: number }> = {};
    const scorers = new Set([...Object.keys(r1.summaryScores), ...Object.keys(r2.summaryScores)]);
    for (const scorer of scorers) {
      const v1 = r1.summaryScores[scorer] ?? 0;
      const v2 = r2.summaryScores[scorer] ?? 0;
      comparison[scorer] = { exp1: v1, exp2: v2, delta: v2 - v1 };
    }
    return comparison;
  }

  private recomputeSummary(result: BraintrustExperimentResult): void {
    const allScorers = new Set<string>();
    for (const row of result.rows) {
      for (const scorer of Object.keys(row.scores)) allScorers.add(scorer);
    }

    for (const scorer of allScorers) {
      const vals = result.rows
        .map(r => r.scores[scorer])
        .filter((v): v is number => v !== undefined);
      result.summaryScores[scorer] = vals.reduce((s, v) => s + v, 0) / vals.length;
    }
  }
}
