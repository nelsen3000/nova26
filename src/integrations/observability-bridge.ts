// Observability Bridge - Connects model router to observability framework
// Logs routing decisions, model calls, and speculative decoding attempts

import { z } from 'zod';
import type { RouteDecision } from '../llm/model-router.js';
import type { SpeculativeResult } from '../llm/speculative-decoder.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Zod Schemas for Log Entries
// ═══════════════════════════════════════════════════════════════════════════════

export const RoutingDecisionLogSchema = z.object({
  timestamp: z.string().datetime(),
  agentId: z.string(),
  taskType: z.string(),
  selectedModel: z.string(),
  ucbScore: z.number(),
  constraints: z.object({
    maxCost: z.number().optional(),
    maxLatency: z.number().optional(),
    minQuality: z.number().optional(),
    preferLocal: z.boolean().optional(),
  }),
  alternatives: z.array(z.string()),
  reason: z.string(),
});

export const ModelCallLogSchema = z.object({
  timestamp: z.string().datetime(),
  model: z.string(),
  agentId: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  latency: z.number(),
  success: z.boolean(),
  cost: z.number(),
  error: z.string().optional(),
});

export const SpeculativeDecodingLogSchema = z.object({
  timestamp: z.string().datetime(),
  draftModel: z.string(),
  verifyModel: z.string(),
  acceptanceRate: z.number(),
  latencySaved: z.number(),
  costSaved: z.number(),
  strategy: z.enum(['speculative', 'direct']),
});

export type RoutingDecisionLog = z.infer<typeof RoutingDecisionLogSchema>;
export type ModelCallLog = z.infer<typeof ModelCallLogSchema>;
export type SpeculativeDecodingLog = z.infer<typeof SpeculativeDecodingLogSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// ObservabilityBridge Class
// ═══════════════════════════════════════════════════════════════════════════════

export class ObservabilityBridge {
  private routingLogs: RoutingDecisionLog[];
  private modelCallLogs: ModelCallLog[];
  private speculativeLogs: SpeculativeDecodingLog[];
  private maxLogs: number;

  constructor(maxLogs: number = 10000) {
    this.routingLogs = [];
    this.modelCallLogs = [];
    this.speculativeLogs = [];
    this.maxLogs = maxLogs;
  }

  /**
   * Log a routing decision
   */
  logRoutingDecision(
    agentId: string,
    taskType: string,
    decision: RouteDecision & { ucbScore: number }
  ): void {
    const log: RoutingDecisionLog = {
      timestamp: new Date().toISOString(),
      agentId,
      taskType,
      selectedModel: decision.model.id,
      ucbScore: decision.ucbScore,
      constraints: {
        maxCost: decision.estimatedCost,
        maxLatency: decision.estimatedLatency,
      },
      alternatives: decision.alternatives.map(m => m.id),
      reason: decision.reason,
    };

    const validated = RoutingDecisionLogSchema.parse(log);
    this.addLog(this.routingLogs, validated);

    // Also emit to console for real-time visibility
    console.log(`[Router] ${agentId} -> ${decision.model.name} (${decision.reason})`);
  }

  /**
   * Log a model call
   */
  logModelCall(
    model: string,
    agentId: string,
    inputTokens: number,
    outputTokens: number,
    latency: number,
    success: boolean,
    cost: number,
    error?: string
  ): void {
    const log: ModelCallLog = {
      timestamp: new Date().toISOString(),
      model,
      agentId,
      inputTokens,
      outputTokens,
      latency,
      success,
      cost,
      error,
    };

    const validated = ModelCallLogSchema.parse(log);
    this.addLog(this.modelCallLogs, validated);

    if (!success) {
      console.error(`[Model] ${model} failed for ${agentId}: ${error}`);
    }
  }

  /**
   * Log a speculative decoding attempt
   */
  logSpeculativeDecoding(
    draftModel: string,
    verifyModel: string,
    result: SpeculativeResult,
    latencySaved: number
  ): void {
    const log: SpeculativeDecodingLog = {
      timestamp: new Date().toISOString(),
      draftModel,
      verifyModel,
      acceptanceRate: result.draftAcceptRate,
      latencySaved,
      costSaved: result.costSaved,
      strategy: result.strategy,
    };

    const validated = SpeculativeDecodingLogSchema.parse(log);
    this.addLog(this.speculativeLogs, validated);

    console.log(`[Speculative] ${draftModel} -> ${verifyModel}: ${result.strategy}, saved $${result.costSaved.toFixed(4)}`);
  }

  /**
   * Get all routing logs
   */
  getRoutingLogs(): RoutingDecisionLog[] {
    return [...this.routingLogs];
  }

  /**
   * Get all model call logs
   */
  getModelCallLogs(): ModelCallLog[] {
    return [...this.modelCallLogs];
  }

  /**
   * Get all speculative decoding logs
   */
  getSpeculativeLogs(): SpeculativeDecodingLog[] {
    return [...this.speculativeLogs];
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.routingLogs = [];
    this.modelCallLogs = [];
    this.speculativeLogs = [];
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Dashboard Data Providers
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get model usage distribution for pie chart
   */
  getModelUsageDistribution(): Array<{ model: string; count: number; percentage: number }> {
    const counts = new Map<string, number>();
    
    for (const log of this.modelCallLogs) {
      const count = counts.get(log.model) ?? 0;
      counts.set(log.model, count + 1);
    }

    const total = this.modelCallLogs.length;
    return Array.from(counts.entries())
      .map(([model, count]) => ({
        model,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get cost over time for line chart
   */
  getCostOverTime(
    bucketMinutes: number = 60
  ): Array<{ timestamp: string; cost: number; count: number }> {
    const buckets = new Map<string, { cost: number; count: number }>();

    for (const log of this.modelCallLogs) {
      const bucketTime = this.floorToBucket(log.timestamp, bucketMinutes);
      const existing = buckets.get(bucketTime) ?? { cost: 0, count: 0 };
      buckets.set(bucketTime, {
        cost: existing.cost + log.cost,
        count: existing.count + 1,
      });
    }

    return Array.from(buckets.entries())
      .map(([timestamp, data]) => ({ timestamp, ...data }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Get latency percentiles per model for bar chart
   */
  getLatencyPercentilesByModel(): Array<{
    model: string;
    p50: number;
    p95: number;
    p99: number;
  }> {
    const byModel = new Map<string, number[]>();

    for (const log of this.modelCallLogs) {
      const latencies = byModel.get(log.model) ?? [];
      latencies.push(log.latency);
      byModel.set(log.model, latencies);
    }

    return Array.from(byModel.entries()).map(([model, latencies]) => ({
      model,
      p50: this.percentile(latencies, 0.5),
      p95: this.percentile(latencies, 0.95),
      p99: this.percentile(latencies, 0.99),
    }));
  }

  /**
   * Get UCB score evolution over time
   */
  getUCBScoreEvolution(
    modelId: string
  ): Array<{ timestamp: string; ucbScore: number }> {
    return this.routingLogs
      .filter(log => log.selectedModel === modelId)
      .map(log => ({
        timestamp: log.timestamp,
        ucbScore: log.ucbScore,
      }));
  }

  /**
   * Get aggregated statistics
   */
  getStats(): {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalCost: number;
    avgLatency: number;
    uniqueModels: number;
    uniqueAgents: number;
  } {
    const successful = this.modelCallLogs.filter(l => l.success).length;
    const totalCost = this.modelCallLogs.reduce((sum, l) => sum + l.cost, 0);
    const avgLatency = this.modelCallLogs.length > 0
      ? this.modelCallLogs.reduce((sum, l) => sum + l.latency, 0) / this.modelCallLogs.length
      : 0;

    const uniqueModels = new Set(this.modelCallLogs.map(l => l.model)).size;
    const uniqueAgents = new Set(this.modelCallLogs.map(l => l.agentId)).size;

    return {
      totalCalls: this.modelCallLogs.length,
      successfulCalls: successful,
      failedCalls: this.modelCallLogs.length - successful,
      totalCost,
      avgLatency,
      uniqueModels,
      uniqueAgents,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════════

  private addLog<T>(logs: T[], log: T): void {
    logs.push(log);
    if (logs.length > this.maxLogs) {
      logs.shift();
    }
  }

  private floorToBucket(timestamp: string, bucketMinutes: number): string {
    const date = new Date(timestamp);
    const bucketMs = bucketMinutes * 60 * 1000;
    const floored = new Date(Math.floor(date.getTime() / bucketMs) * bucketMs);
    return floored.toISOString();
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const sorted = [...sortedValues].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════════════════════

let globalBridge: ObservabilityBridge | null = null;

export function getObservabilityBridge(): ObservabilityBridge {
  if (!globalBridge) {
    globalBridge = new ObservabilityBridge();
  }
  return globalBridge;
}

export function resetObservabilityBridge(): void {
  globalBridge = null;
}
