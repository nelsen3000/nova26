// Technical Debt Scoring
// KIMI-R17-05: R17 spec

import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export type DebtType = 'code' | 'architecture' | 'test' | 'documentation' | 'dependency';
export type DebtPriority = 'low' | 'medium' | 'high' | 'critical';
export type DebtStatus = 'identified' | 'acknowledged' | 'in-progress' | 'resolved';

export interface TechnicalDebt {
  id: string;
  title: string;
  description: string;
  type: DebtType;
  priority: DebtPriority;
  status: DebtStatus;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  estimatedEffort: number; // hours
  interestPerPeriod: number; // additional hours if not fixed
  createdAt: string;
  dueDate?: string;
  assignedTo?: string;
  tags: string[];
  relatedIssues: string[];
}

export interface DebtMetrics {
  totalDebt: number;
  byType: Record<DebtType, number>;
  byPriority: Record<DebtPriority, number>;
  byStatus: Record<DebtStatus, number>;
  totalInterest: number;
  debtRatio: number; // debt items per 1000 LOC
}

export interface DebtTrend {
  period: string;
  opened: number;
  resolved: number;
  netChange: number;
}

export interface DebtConfig {
  thresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  interestRates: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const TechnicalDebtSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.enum(['code', 'architecture', 'test', 'documentation', 'dependency']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['identified', 'acknowledged', 'in-progress', 'resolved']),
  filePath: z.string().optional(),
  lineStart: z.number().optional(),
  lineEnd: z.number().optional(),
  estimatedEffort: z.number(),
  interestPerPeriod: z.number(),
  createdAt: z.string(),
  dueDate: z.string().optional(),
  assignedTo: z.string().optional(),
  tags: z.array(z.string()),
  relatedIssues: z.array(z.string()),
});

// ============================================================================
// DebtTracker Class
// ============================================================================

export class DebtTracker {
  private debts = new Map<string, TechnicalDebt>();
  private _config: DebtConfig;

  constructor(configArg?: Partial<DebtConfig>) {
    this._config = {
      thresholds: { low: 10, medium: 25, high: 50, critical: 100 },
      interestRates: { low: 1, medium: 3, high: 8, critical: 15 },
      ...configArg,
    };
  }

  getConfig(): DebtConfig {
    return this._config;
  }

  addDebt(debt: Omit<TechnicalDebt, 'id' | 'createdAt'>): TechnicalDebt {
    const newDebt: TechnicalDebt = {
      ...debt,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    this.debts.set(newDebt.id, newDebt);
    return newDebt;
  }

  updateDebt(id: string, updates: Partial<TechnicalDebt>): TechnicalDebt {
    const debt = this.debts.get(id);
    if (!debt) throw new Error(`Debt not found: ${id}`);

    const updated = { ...debt, ...updates };
    this.debts.set(id, updated);
    return updated;
  }

  resolveDebt(id: string): TechnicalDebt {
    return this.updateDebt(id, { status: 'resolved' });
  }

  getDebt(id: string): TechnicalDebt | undefined {
    return this.debts.get(id);
  }

  getAllDebts(): TechnicalDebt[] {
    return Array.from(this.debts.values());
  }

  getDebtsByType(type: DebtType): TechnicalDebt[] {
    return this.getAllDebts().filter(d => d.type === type);
  }

  getDebtsByPriority(priority: DebtPriority): TechnicalDebt[] {
    return this.getAllDebts().filter(d => d.priority === priority);
  }

  getDebtsByStatus(status: DebtStatus): TechnicalDebt[] {
    return this.getAllDebts().filter(d => d.status === status);
  }

  getOverdueDebts(): TechnicalDebt[] {
    const now = new Date().toISOString();
    return this.getAllDebts().filter(d => 
      d.dueDate && d.dueDate < now && d.status !== 'resolved'
    );
  }

  calculateMetrics(): DebtMetrics {
    const debts = this.getAllDebts();
    const activeDebts = debts.filter(d => d.status !== 'resolved');

    const byType: Record<DebtType, number> = { code: 0, architecture: 0, test: 0, documentation: 0, dependency: 0 };
    const byPriority: Record<DebtPriority, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const byStatus: Record<DebtStatus, number> = { identified: 0, acknowledged: 0, 'in-progress': 0, resolved: 0 };

    let totalInterest = 0;

    for (const debt of activeDebts) {
      byType[debt.type]++;
      byPriority[debt.priority]++;
      byStatus[debt.status]++;
      totalInterest += debt.interestPerPeriod;
    }

    return {
      totalDebt: activeDebts.length,
      byType,
      byPriority,
      byStatus,
      totalInterest,
      debtRatio: activeDebts.length, // Simplified - would be per 1000 LOC
    };
  }

  calculateScore(): number {
    const metrics = this.calculateMetrics();
    const weights = { low: 1, medium: 3, high: 8, critical: 20 };

    let weightedDebt = 0;
    for (const [priority, count] of Object.entries(metrics.byPriority)) {
      weightedDebt += count * weights[priority as DebtPriority];
    }

    // Score from 0-100, lower is better
    return Math.max(0, 100 - weightedDebt);
  }

  getTrends(periods: number = 6): DebtTrend[] {
    // Simulate trend data
    const trends: DebtTrend[] = [];
    const now = new Date();

    for (let i = periods - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const period = date.toISOString().slice(0, 7); // YYYY-MM

      // Randomized data for demonstration
      const opened = Math.floor(Math.random() * 10);
      const resolved = Math.floor(Math.random() * 8);

      trends.push({
        period,
        opened,
        resolved,
        netChange: opened - resolved,
      });
    }

    return trends;
  }

  generateReport(): string {
    const metrics = this.calculateMetrics();
    const score = this.calculateScore();

    const lines: string[] = [
      `Technical Debt Report`,
      `====================`,
      ``,
      `Score: ${score}/100`,
      `Total Active Debt: ${metrics.totalDebt} items`,
      `Total Interest: ${metrics.totalInterest} hours/period`,
      ``,
      `By Type`,
      `-------`,
      `Code: ${metrics.byType.code}`,
      `Architecture: ${metrics.byType.architecture}`,
      `Test: ${metrics.byType.test}`,
      `Documentation: ${metrics.byType.documentation}`,
      `Dependency: ${metrics.byType.dependency}`,
      ``,
      `By Priority`,
      `-----------`,
      `Critical: ${metrics.byPriority.critical}`,
      `High: ${metrics.byPriority.high}`,
      `Medium: ${metrics.byPriority.medium}`,
      `Low: ${metrics.byPriority.low}`,
      ``,
      `By Status`,
      `---------`,
      `Identified: ${metrics.byStatus.identified}`,
      `Acknowledged: ${metrics.byStatus.acknowledged}`,
      `In Progress: ${metrics.byStatus['in-progress']}`,
      `Resolved: ${metrics.byStatus.resolved}`,
    ];

    return lines.join('\n');
  }

  recommendRepayment(): TechnicalDebt[] {
    const active = this.getAllDebts().filter(d => d.status !== 'resolved');

    // Sort by: critical priority first, then highest interest, then oldest
    return active.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (b.interestPerPeriod !== a.interestPerPeriod) {
        return b.interestPerPeriod - a.interestPerPeriod;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createDebtTracker(config?: Partial<DebtConfig>): DebtTracker {
  return new DebtTracker(config);
}

export function calculateInterest(principal: number, rate: number, periods: number): number {
  return principal * Math.pow(1 + rate / 100, periods) - principal;
}

export function prioritizeDebts(debts: TechnicalDebt[]): TechnicalDebt[] {
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...debts].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}
