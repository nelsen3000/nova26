// Orchestration Optimization + Integration
// KIMI-R17-10: R17 spec - Integrates all R17 modules

import { z } from 'zod';
import type { PRIntelligence } from '../review/pr-intelligence.js';
import type { FrameworkMigrator } from '../migrate/framework-migrator.js';
import type { RootCauseAnalyzer } from '../debug/root-cause-analyzer.js';
import type { WCAGEngine } from '../a11y/wcag-engine.js';
import type { DebtTracker } from '../debt/technical-debt.js';
import type { DependencyManager } from '../deps/dependency-manager.js';
import type { FeedbackLoop } from '../prod-feedback/feedback-loop.js';
import type { HealthMonitor } from '../health/health-dashboard.js';
import type { EnvironmentManager } from '../env/environment-manager.js';

// ============================================================================
// Core Types
// ============================================================================

export type AgentTask = 
  | 'code-review' 
  | 'migration' 
  | 'debug' 
  | 'a11y-audit' 
  | 'debt-analysis' 
  | 'dependency-check' 
  | 'feedback-monitor' 
  | 'health-check' 
  | 'env-sync';

export interface OrchestrationContext {
  projectId: string;
  prIntelligence?: PRIntelligence;
  frameworkMigrator?: FrameworkMigrator;
  rootCauseAnalyzer?: RootCauseAnalyzer;
  wcagEngine?: WCAGEngine;
  debtTracker?: DebtTracker;
  dependencyManager?: DependencyManager;
  feedbackLoop?: FeedbackLoop;
  healthMonitor?: HealthMonitor;
  environmentManager?: EnvironmentManager;
}

export interface OptimizationPlan {
  id: string;
  tasks: AgentTask[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedTime: number;
  dependencies: string[];
  context: OrchestrationContext;
}

export interface TaskResult {
  task: AgentTask;
  success: boolean;
  output: unknown;
  duration: number;
  recommendations: string[];
}

export interface OrchestrationReport {
  timestamp: string;
  planId: string;
  results: TaskResult[];
  overallSuccess: boolean;
  totalDuration: number;
  summary: {
    tasksRun: number;
    tasksSucceeded: number;
    tasksFailed: number;
    issuesFound: number;
    recommendations: number;
  };
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const OptimizationPlanSchema = z.object({
  id: z.string(),
  tasks: z.array(z.enum([
    'code-review', 'migration', 'debug', 'a11y-audit', 
    'debt-analysis', 'dependency-check', 'feedback-monitor', 
    'health-check', 'env-sync'
  ])),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  estimatedTime: z.number(),
  dependencies: z.array(z.string()),
  context: z.any(),
});

export const TaskResultSchema = z.object({
  task: z.string(),
  success: z.boolean(),
  output: z.unknown(),
  duration: z.number(),
  recommendations: z.array(z.string()),
});

// ============================================================================
// OrchestrationOptimizer Class
// ============================================================================

export class OrchestrationOptimizer {
  private plans = new Map<string, OptimizationPlan>();
  private results = new Map<string, TaskResult[]>();

  createPlan(
    tasks: AgentTask[],
    priority: OptimizationPlan['priority'],
    context: OrchestrationContext
  ): OptimizationPlan {
    const plan: OptimizationPlan = {
      id: crypto.randomUUID(),
      tasks,
      priority,
      estimatedTime: this.estimateTime(tasks),
      dependencies: this.calculateDependencies(tasks),
      context,
    };

    this.plans.set(plan.id, plan);
    return plan;
  }

  async executePlan(planId: string): Promise<OrchestrationReport> {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    const startTime = Date.now();
    const results: TaskResult[] = [];

    for (const task of plan.tasks) {
      const taskStart = Date.now();
      const result = await this.executeTask(task, plan.context);
      result.duration = Date.now() - taskStart;
      results.push(result);
    }

    this.results.set(planId, results);

    const totalDuration = Date.now() - startTime;
    const succeeded = results.filter(r => r.success).length;

    return {
      timestamp: new Date().toISOString(),
      planId,
      results,
      overallSuccess: succeeded === results.length,
      totalDuration,
      summary: {
        tasksRun: results.length,
        tasksSucceeded: succeeded,
        tasksFailed: results.length - succeeded,
        issuesFound: results.reduce((sum, r) => sum + (r.output && typeof r.output === 'object' && 'issues' in r.output ? (r.output as any).issues?.length || 0 : 0), 0),
        recommendations: results.reduce((sum, r) => sum + r.recommendations.length, 0),
      },
    };
  }

  private async executeTask(task: AgentTask, context: OrchestrationContext): Promise<TaskResult> {
    const baseResult: TaskResult = {
      task,
      success: true,
      output: null,
      duration: 0,
      recommendations: [],
    };

    try {
      switch (task) {
        case 'code-review':
          if (context.prIntelligence) {
            const reviews = context.prIntelligence.getReviewsByStatus('pending');
            baseResult.output = { pendingReviews: reviews.length };
            baseResult.recommendations = reviews.length > 0 ? ['Review pending PRs'] : [];
          }
          break;

        case 'migration':
          if (context.frameworkMigrator) {
            const plans = context.frameworkMigrator.getPlansByStatus('ready');
            baseResult.output = { readyPlans: plans.length };
            baseResult.recommendations = plans.length > 0 ? ['Execute ready migration plans'] : [];
          }
          break;

        case 'debug':
          if (context.rootCauseAnalyzer) {
            const sessions = context.rootCauseAnalyzer.getActiveSessions();
            baseResult.output = { activeSessions: sessions.length };
            baseResult.recommendations = sessions.length > 0 ? ['Monitor active debug sessions'] : [];
          }
          break;

        case 'a11y-audit':
          baseResult.output = { message: 'Run WCAG audit' };
          baseResult.recommendations = ['Schedule regular accessibility audits'];
          break;

        case 'debt-analysis':
          if (context.debtTracker) {
            const metrics = context.debtTracker.calculateMetrics();
            baseResult.output = metrics;
            baseResult.recommendations = metrics.totalDebt > 10 ? ['Address technical debt'] : [];
          }
          break;

        case 'dependency-check':
          if (context.dependencyManager) {
            const outdated = context.dependencyManager.getOutdatedDependencies();
            const vulns = context.dependencyManager.getVulnerabilities();
            baseResult.output = { outdated: outdated.length, vulnerabilities: vulns.length };
            baseResult.recommendations = [...outdated.length > 0 ? ['Update dependencies'] : [], ...vulns.length > 0 ? ['Fix security vulnerabilities'] : []];
          }
          break;

        case 'feedback-monitor':
          if (context.feedbackLoop) {
            const critical = context.feedbackLoop.getCriticalFeedback();
            baseResult.output = { criticalFeedback: critical.length };
            baseResult.recommendations = critical.length > 0 ? ['Address critical production feedback'] : [];
          }
          break;

        case 'health-check':
          if (context.healthMonitor) {
            const dashboard = context.healthMonitor.getDashboard();
            baseResult.output = { status: dashboard.overallStatus };
            baseResult.recommendations = dashboard.overallStatus !== 'healthy' ? ['Investigate health issues'] : [];
          }
          break;

        case 'env-sync':
          if (context.environmentManager) {
            const envs = context.environmentManager.getEnvironmentsByType('production');
            baseResult.output = { productionEnvs: envs.length };
            baseResult.recommendations = ['Verify environment synchronization'];
          }
          break;
      }

      return baseResult;
    } catch (error) {
      return {
        ...baseResult,
        success: false,
        output: { error: (error as Error).message },
      };
    }
  }

  getOptimalTaskOrder(tasks: AgentTask[]): AgentTask[] {
    // Define dependencies between tasks
    const dependencies: Record<AgentTask, AgentTask[]> = {
      'health-check': [],
      'feedback-monitor': ['health-check'],
      'debug': ['feedback-monitor'],
      'code-review': [],
      'a11y-audit': ['code-review'],
      'debt-analysis': ['code-review'],
      'dependency-check': [],
      'migration': ['dependency-check', 'debt-analysis'],
      'env-sync': ['migration'],
    };

    // Topological sort
    const visited = new Set<AgentTask>();
    const result: AgentTask[] = [];

    const visit = (task: AgentTask) => {
      if (visited.has(task)) return;
      visited.add(task);

      for (const dep of dependencies[task] || []) {
        if (tasks.includes(dep)) {
          visit(dep);
        }
      }
      result.push(task);
    };

    for (const task of tasks) {
      visit(task);
    }

    return result;
  }

  analyzeBottlenecks(planId: string): Array<{ task: AgentTask; reason: string; suggestion: string }> {
    const results = this.results.get(planId);
    if (!results) return [];

    const bottlenecks: Array<{ task: AgentTask; reason: string; suggestion: string }> = [];

    for (const result of results) {
      if (result.duration > 5000) {
        bottlenecks.push({
          task: result.task,
          reason: `High execution time (${result.duration}ms)`,
          suggestion: 'Consider parallel execution or caching',
        });
      }
      if (!result.success) {
        bottlenecks.push({
          task: result.task,
          reason: 'Task failed',
          suggestion: 'Review error logs and fix underlying issues',
        });
      }
    }

    return bottlenecks;
  }

  // ---- Private Methods ----

  private estimateTime(tasks: AgentTask[]): number {
    const estimates: Record<AgentTask, number> = {
      'code-review': 30,
      'migration': 60,
      'debug': 45,
      'a11y-audit': 20,
      'debt-analysis': 15,
      'dependency-check': 10,
      'feedback-monitor': 5,
      'health-check': 5,
      'env-sync': 10,
    };

    return tasks.reduce((sum, t) => sum + (estimates[t] || 10), 0);
  }

  private calculateDependencies(tasks: AgentTask[]): string[] {
    const deps: string[] = [];
    if (tasks.includes('migration')) deps.push('dependency-check');
    if (tasks.includes('debug')) deps.push('feedback-monitor');
    return deps;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createOrchestrationOptimizer(): OrchestrationOptimizer {
  return new OrchestrationOptimizer();
}

export function buildOrchestrationContext(
  projectId: string,
  options: Partial<Omit<OrchestrationContext, 'projectId'>> = {}
): OrchestrationContext {
  return {
    projectId,
    ...options,
  };
}

export function mergeTaskResults(results: TaskResult[]): {
  success: boolean;
  allRecommendations: string[];
  totalIssues: number;
} {
  const success = results.every(r => r.success);
  const allRecommendations = results.flatMap(r => r.recommendations);
  const totalIssues = results.reduce((sum, r) => {
    if (r.output && typeof r.output === 'object' && 'issues' in r.output) {
      return sum + ((r.output as any).issues?.length || 0);
    }
    return sum;
  }, 0);

  return { success, allRecommendations, totalIssues };
}
