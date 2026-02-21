// Cost Optimizer - Manages LLM spend across all agents with budget enforcement
// Implements smart downgrade logic and cost projections

import type { ModelConfig } from './model-registry.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface BudgetConfig {
  daily: number;
  hourly?: number;
  perAgent?: Map<string, number>;
}

export interface SpendReport {
  totalSpend: number;
  byModel: Map<string, number>;
  byAgent: Map<string, number>;
  projectedDaily: number;
  budgetRemaining: number;
  period: 'hour' | 'day' | 'week';
}

export interface CostAlert {
  threshold: number;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface SpendRecord {
  timestamp: number;
  model: string;
  agent: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CostOptimizer Class
// ═══════════════════════════════════════════════════════════════════════════════

export class CostOptimizer {
  private records: SpendRecord[];
  private dailyBudget: number;
  private hourlyBudget: number;
  private perAgentBudgets: Map<string, number>;
  private dailySpend: number;
  private hourlySpend: number;
  private agentSpends: Map<string, number>;
  private lastResetDate: string;
  private lastResetHour: string;
  private alertsEnabled: boolean;
  private alertThresholds: number[];

  constructor() {
    this.records = [];
    this.dailyBudget = Infinity;
    this.hourlyBudget = Infinity;
    this.perAgentBudgets = new Map();
    this.dailySpend = 0;
    this.hourlySpend = 0;
    this.agentSpends = new Map();
    this.lastResetDate = this.getCurrentDate();
    this.lastResetHour = this.getCurrentHour();
    this.alertsEnabled = true;
    this.alertThresholds = [0.5, 0.75, 0.9];
  }

  /**
   * Set budget limits
   */
  setBudget(config: BudgetConfig): void {
    this.dailyBudget = config.daily;
    this.hourlyBudget = config.hourly ?? Infinity;
    this.perAgentBudgets = config.perAgent ?? new Map();
    this.checkAndResetBudgets();
  }

  /**
   * Check if a request can be afforded
   */
  canAfford(model: ModelConfig, estimatedTokens: number): boolean {
    this.checkAndResetBudgets();

    const estimatedCost = this.estimateCost(model, estimatedTokens);

    // Check daily budget
    if (this.dailySpend + estimatedCost > this.dailyBudget) {
      return false;
    }

    // Check hourly budget
    if (this.hourlySpend + estimatedCost > this.hourlyBudget) {
      return false;
    }

    return true;
  }

  /**
   * Check if an agent can afford a request
   */
  canAgentAfford(agentId: string, model: ModelConfig, estimatedTokens: number): boolean {
    this.checkAndResetBudgets();

    const estimatedCost = this.estimateCost(model, estimatedTokens);
    const agentBudget = this.perAgentBudgets.get(agentId) ?? Infinity;
    const agentSpend = this.agentSpends.get(agentId) ?? 0;

    return agentSpend + estimatedCost <= agentBudget;
  }

  /**
   * Record actual spend
   */
  recordSpend(model: string, agent: string, inputTokens: number, outputTokens: number): void {
    this.checkAndResetBudgets();

    // Get model config for pricing
    const cost = this.calculateCost(model, inputTokens, outputTokens);

    const record: SpendRecord = {
      timestamp: Date.now(),
      model,
      agent,
      inputTokens,
      outputTokens,
      cost,
    };

    this.records.push(record);
    this.dailySpend += cost;
    this.hourlySpend += cost;

    const currentAgentSpend = this.agentSpends.get(agent) ?? 0;
    this.agentSpends.set(agent, currentAgentSpend + cost);

    // Check alert thresholds
    this.checkAlerts();
  }

  /**
   * Get spend report for a period
   */
  getSpendReport(period: 'hour' | 'day' | 'week'): SpendReport {
    this.checkAndResetBudgets();

    const cutoff = this.getCutoffTime(period);
    const relevantRecords = this.records.filter(r => r.timestamp >= cutoff);

    const byModel = new Map<string, number>();
    const byAgent = new Map<string, number>();
    let totalSpend = 0;

    for (const record of relevantRecords) {
      totalSpend += record.cost;

      const modelSpend = byModel.get(record.model) ?? 0;
      byModel.set(record.model, modelSpend + record.cost);

      const agentSpend = byAgent.get(record.agent) ?? 0;
      byAgent.set(record.agent, agentSpend + record.cost);
    }

    // Calculate projection
    const projectedDaily = this.calculateProjectedDaily(period, totalSpend);

    return {
      totalSpend,
      byModel,
      byAgent,
      projectedDaily,
      budgetRemaining: this.dailyBudget - this.dailySpend,
      period,
    };
  }

  /**
   * Get remaining budget for today
   */
  getRemainingBudget(): number {
    this.checkAndResetBudgets();
    return Math.max(0, this.dailyBudget - this.dailySpend);
  }

  /**
   * Get current daily spend
   */
  getDailySpend(): number {
    this.checkAndResetBudgets();
    return this.dailySpend;
  }

  /**
   * Get current hourly spend
   */
  getHourlySpend(): number {
    this.checkAndResetBudgets();
    return this.hourlySpend;
  }

  /**
   * Get spend for a specific agent
   */
  getAgentSpend(agentId: string): number {
    this.checkAndResetBudgets();
    return this.agentSpends.get(agentId) ?? 0;
  }

  /**
   * Check if should downgrade (budget at 80%)
   */
  shouldDowngrade(): boolean {
    this.checkAndResetBudgets();
    return this.dailySpend / this.dailyBudget >= 0.8;
  }

  /**
   * Check if only critical tasks allowed (budget at 95%)
   */
  onlyCriticalAllowed(): boolean {
    this.checkAndResetBudgets();
    return this.dailySpend / this.dailyBudget >= 0.95;
  }

  /**
   * Check if budget exhausted
   */
  isBudgetExhausted(): boolean {
    this.checkAndResetBudgets();
    return this.dailySpend >= this.dailyBudget;
  }

  /**
   * Get budget status with alerts
   */
  getBudgetStatus(): {
    dailySpend: number;
    dailyBudget: number;
    percentage: number;
    alerts: CostAlert[];
  } {
    this.checkAndResetBudgets();
    const percentage = (this.dailySpend / this.dailyBudget) * 100;
    const alerts = this.generateAlerts(percentage);

    return {
      dailySpend: this.dailySpend,
      dailyBudget: this.dailyBudget,
      percentage,
      alerts,
    };
  }

  /**
   * Clear all records
   */
  clear(): void {
    this.records = [];
    this.dailySpend = 0;
    this.hourlySpend = 0;
    this.agentSpends.clear();
    this.lastResetDate = this.getCurrentDate();
    this.lastResetHour = this.getCurrentHour();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════════

  private estimateCost(model: ModelConfig, tokens: number): number {
    // Rough estimate: 60% input, 40% output split
    const inputTokens = Math.floor(tokens * 0.6);
    const outputTokens = Math.floor(tokens * 0.4);
    return (inputTokens * model.costPerInputToken) + (outputTokens * model.costPerOutputToken);
  }

  private calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    // Default pricing if model not found
    const defaultInputCost = 0.000002;
    const defaultOutputCost = 0.00001;

    // In production, this would look up actual model pricing
    // For now, use simple heuristic based on model ID
    if (modelId.includes('haiku') || modelId.includes('mini')) {
      return (inputTokens * 0.00000025) + (outputTokens * 0.00000125);
    }
    if (modelId.includes('sonnet')) {
      return (inputTokens * 0.000003) + (outputTokens * 0.000015);
    }
    if (modelId.includes('opus')) {
      return (inputTokens * 0.000015) + (outputTokens * 0.000075);
    }

    return (inputTokens * defaultInputCost) + (outputTokens * defaultOutputCost);
  }

  private checkAndResetBudgets(): void {
    const currentDate = this.getCurrentDate();
    if (currentDate !== this.lastResetDate) {
      this.dailySpend = 0;
      this.agentSpends.clear();
      this.lastResetDate = currentDate;
    }

    const currentHour = this.getCurrentHour();
    if (currentHour !== this.lastResetHour) {
      this.hourlySpend = 0;
      this.lastResetHour = currentHour;
    }
  }

  private getCurrentDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getCurrentHour(): string {
    return new Date().toISOString().slice(0, 13);
  }

  private getCutoffTime(period: 'hour' | 'day' | 'week'): number {
    const now = Date.now();
    switch (period) {
      case 'hour':
        return now - 60 * 60 * 1000;
      case 'day':
        return now - 24 * 60 * 60 * 1000;
      case 'week':
        return now - 7 * 24 * 60 * 60 * 1000;
      default:
        return 0;
    }
  }

  private calculateProjectedDaily(period: 'hour' | 'day' | 'week', periodSpend: number): number {
    const now = Date.now();
    const dayStart = new Date().setHours(0, 0, 0, 0);
    const dayProgress = (now - dayStart) / (24 * 60 * 60 * 1000);

    if (dayProgress > 0) {
      return this.dailySpend / dayProgress;
    }

    return this.dailySpend;
  }

  private checkAlerts(): void {
    if (!this.alertsEnabled) return;

    const percentage = (this.dailySpend / this.dailyBudget) * 100;

    for (const threshold of this.alertThresholds) {
      if (percentage >= threshold * 100 && percentage < (threshold * 100) + 1) {
        this.emitAlert(threshold);
      }
    }
  }

  private emitAlert(threshold: number): void {
    const messages: Record<number, string> = {
      0.5: 'Budget 50% consumed',
      0.75: 'Budget 75% consumed - consider cost optimization',
      0.9: 'Budget 90% consumed - only critical tasks allowed',
    };

    console.warn(`[CostOptimizer] Alert: ${messages[threshold]}`);
  }

  private generateAlerts(percentage: number): CostAlert[] {
    const alerts: CostAlert[] = [];

    if (percentage >= 90) {
      alerts.push({
        threshold: 90,
        message: 'Budget 90% consumed - only critical tasks allowed',
        severity: 'critical',
      });
    } else if (percentage >= 75) {
      alerts.push({
        threshold: 75,
        message: 'Budget 75% consumed - consider cost optimization',
        severity: 'warning',
      });
    } else if (percentage >= 50) {
      alerts.push({
        threshold: 50,
        message: 'Budget 50% consumed',
        severity: 'info',
      });
    }

    return alerts;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CostProjector Class
// ═══════════════════════════════════════════════════════════════════════════════

export class CostProjector {
  private optimizer: CostOptimizer;

  constructor(optimizer: CostOptimizer) {
    this.optimizer = optimizer;
  }

  /**
   * Project when budget will be exhausted
   */
  projectExhaustion(): {
    hoursRemaining: number | null;
    willExhaust: boolean;
    recommendation: string;
  } {
    const status = this.optimizer.getBudgetStatus();
    const { dailySpend, dailyBudget, percentage } = status;

    if (percentage >= 100) {
      return {
        hoursRemaining: 0,
        willExhaust: true,
        recommendation: 'Budget exhausted - stop non-critical tasks',
      };
    }

    const remaining = dailyBudget - dailySpend;
    const hourlyRate = dailySpend / (new Date().getHours() + new Date().getMinutes() / 60);

    if (hourlyRate <= 0) {
      return {
        hoursRemaining: null,
        willExhaust: false,
        recommendation: 'Current rate sustainable',
      };
    }

    const hoursRemaining = remaining / hourlyRate;

    return {
      hoursRemaining,
      willExhaust: hoursRemaining < (24 - new Date().getHours()),
      recommendation: hoursRemaining < 4 
        ? 'Urgent: Reduce spend immediately'
        : hoursRemaining < 8
        ? 'Warning: Consider cost optimization'
        : 'Budget on track',
    };
  }

  /**
   * Get cost projection for next N hours
   */
  projectNextHours(hours: number): {
    projectedSpend: number;
    projectedRemaining: number;
    risk: 'low' | 'medium' | 'high';
  } {
    const hourlyRate = this.estimateHourlyRate();
    const projectedSpend = hourlyRate * hours;
    const remaining = this.optimizer.getRemainingBudget();
    const projectedRemaining = remaining - projectedSpend;

    const risk = projectedRemaining < 0 
      ? 'high' 
      : projectedRemaining < remaining * 0.2 
      ? 'medium' 
      : 'low';

    return { projectedSpend, projectedRemaining, risk };
  }

  private estimateHourlyRate(): number {
    // Use last hour's spend as estimate
    const report = this.optimizer.getSpendReport('hour');
    return report.totalSpend;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════════════════════

let globalOptimizer: CostOptimizer | null = null;

export function getCostOptimizer(): CostOptimizer {
  if (!globalOptimizer) {
    globalOptimizer = new CostOptimizer();
  }
  return globalOptimizer;
}

export function resetCostOptimizer(): void {
  globalOptimizer = null;
}
