// Metrics Tracker — Records and aggregates inference metrics
// KIMI-R22-01 | Feb 2026

import type { InferenceMetrics } from './types.js';

export interface AgentMetricsSummary {
  agentId: string;
  totalInferences: number;
  avgDurationMs: number;
  avgConfidence: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalEnergyWh: number;
  escalationRate: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  avgSpeculativeAcceptanceRate: number;
  modelsUsed: Record<string, number>;
}

export interface RoutingMetricsSummary {
  totalInferences: number;
  byAgent: Record<string, AgentMetricsSummary>;
  globalEscalationRate: number;
  globalAvgConfidence: number;
  topModels: Array<{ model: string; count: number }>;
}

export class MetricsTracker {
  private metrics: InferenceMetrics[] = [];
  private maxHistory: number;

  constructor(maxHistory = 10000) {
    this.maxHistory = maxHistory;
  }

  record(metric: InferenceMetrics): void {
    this.metrics.push(metric);
    if (this.metrics.length > this.maxHistory) {
      this.metrics.shift(); // Drop oldest
    }
  }

  getRecent(n: number): InferenceMetrics[] {
    return this.metrics.slice(-n);
  }

  getForAgent(agentId: string): InferenceMetrics[] {
    return this.metrics.filter(m => m.agentId === agentId);
  }

  getSummary(agentId: string): AgentMetricsSummary {
    const agentMetrics = this.getForAgent(agentId);
    if (!agentMetrics.length) {
      return this.emptyAgentSummary(agentId);
    }

    const durations = agentMetrics.map(m => m.durationMs).sort((a, b) => a - b);
    const escalations = agentMetrics.filter(m => m.wasEscalated).length;
    const speculativeMetrics = agentMetrics.filter(m => m.speculativeAcceptanceRate !== undefined);

    const modelsUsed: Record<string, number> = {};
    for (const m of agentMetrics) {
      modelsUsed[m.modelUsed] = (modelsUsed[m.modelUsed] ?? 0) + 1;
    }

    return {
      agentId,
      totalInferences: agentMetrics.length,
      avgDurationMs: mean(durations),
      avgConfidence: mean(agentMetrics.map(m => m.confidence)),
      totalTokensIn: sum(agentMetrics.map(m => m.tokensIn)),
      totalTokensOut: sum(agentMetrics.map(m => m.tokensOut)),
      totalEnergyWh: sum(agentMetrics.map(m => m.energyWh)),
      escalationRate: escalations / agentMetrics.length,
      p50DurationMs: percentile(durations, 50),
      p95DurationMs: percentile(durations, 95),
      p99DurationMs: percentile(durations, 99),
      avgSpeculativeAcceptanceRate: speculativeMetrics.length
        ? mean(speculativeMetrics.map(m => m.speculativeAcceptanceRate!))
        : 0,
      modelsUsed,
    };
  }

  getGlobalSummary(): RoutingMetricsSummary {
    const agentIds = [...new Set(this.metrics.map(m => m.agentId))];
    const byAgent: Record<string, AgentMetricsSummary> = {};
    for (const id of agentIds) {
      byAgent[id] = this.getSummary(id);
    }

    const totalEscalations = this.metrics.filter(m => m.wasEscalated).length;
    const modelCounts: Record<string, number> = {};
    for (const m of this.metrics) {
      modelCounts[m.modelUsed] = (modelCounts[m.modelUsed] ?? 0) + 1;
    }

    const topModels = Object.entries(modelCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([model, count]) => ({ model, count }));

    return {
      totalInferences: this.metrics.length,
      byAgent,
      globalEscalationRate: this.metrics.length ? totalEscalations / this.metrics.length : 0,
      globalAvgConfidence: this.metrics.length
        ? mean(this.metrics.map(m => m.confidence))
        : 0,
      topModels,
    };
  }

  getCount(): number {
    return this.metrics.length;
  }

  clear(): void {
    this.metrics = [];
  }

  exportJson(): string {
    return JSON.stringify(this.metrics, null, 2);
  }

  private emptyAgentSummary(agentId: string): AgentMetricsSummary {
    return {
      agentId,
      totalInferences: 0,
      avgDurationMs: 0,
      avgConfidence: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalEnergyWh: 0,
      escalationRate: 0,
      p50DurationMs: 0,
      p95DurationMs: 0,
      p99DurationMs: 0,
      avgSpeculativeAcceptanceRate: 0,
      modelsUsed: {},
    };
  }
}

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function sum(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0);
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.floor((p / 100) * sorted.length);
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}
