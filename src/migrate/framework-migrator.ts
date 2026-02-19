// Migration & Framework Upgrade
// KIMI-R17-02: R17 spec

import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export type MigrationType = 'framework' | 'language' | 'dependency' | 'config';
export type MigrationStatus = 'pending' | 'analyzing' | 'ready' | 'migrating' | 'testing' | 'complete' | 'failed';

export interface MigrationPlan {
  id: string;
  name: string;
  type: MigrationType;
  fromVersion: string;
  toVersion: string;
  status: MigrationStatus;
  steps: MigrationStep[];
  breakingChanges: BreakingChange[];
  estimatedEffort: number; // hours
  riskLevel: 'low' | 'medium' | 'high';
  createdAt: string;
  completedAt?: string;
}

export interface MigrationStep {
  id: string;
  name: string;
  description: string;
  order: number;
  status: MigrationStatus;
  automated: boolean;
  files: string[];
  commands?: string[];
  estimatedTime: number; // minutes
}

export interface BreakingChange {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  migration: string;
  affectedFiles: string[];
}

export interface FrameworkConfig {
  name: string;
  version: string;
  dependencies: Record<string, string>;
  configFiles: string[];
}

export interface MigrationResult {
  planId: string;
  success: boolean;
  stepsCompleted: number;
  stepsFailed: number;
  filesModified: string[];
  errors: string[];
  duration: number;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const MigrationStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  order: z.number(),
  status: z.enum(['pending', 'analyzing', 'ready', 'migrating', 'testing', 'complete', 'failed']),
  automated: z.boolean(),
  files: z.array(z.string()),
  commands: z.array(z.string()).optional(),
  estimatedTime: z.number(),
});

export const BreakingChangeSchema = z.object({
  id: z.string(),
  description: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  migration: z.string(),
  affectedFiles: z.array(z.string()),
});

export const MigrationPlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['framework', 'language', 'dependency', 'config']),
  fromVersion: z.string(),
  toVersion: z.string(),
  status: z.enum(['pending', 'analyzing', 'ready', 'migrating', 'testing', 'complete', 'failed']),
  steps: z.array(MigrationStepSchema),
  breakingChanges: z.array(BreakingChangeSchema),
  estimatedEffort: z.number(),
  riskLevel: z.enum(['low', 'medium', 'high']),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});

// ============================================================================
// FrameworkMigrator Class
// ============================================================================

export class FrameworkMigrator {
  private plans = new Map<string, MigrationPlan>();

  createPlan(
    name: string,
    type: MigrationType,
    fromVersion: string,
    toVersion: string
  ): MigrationPlan {
    const plan: MigrationPlan = {
      id: crypto.randomUUID(),
      name,
      type,
      fromVersion,
      toVersion,
      status: 'pending',
      steps: [],
      breakingChanges: [],
      estimatedEffort: 0,
      riskLevel: 'low',
      createdAt: new Date().toISOString(),
    };

    this.plans.set(plan.id, plan);
    return plan;
  }

  addStep(planId: string, step: Omit<MigrationStep, 'id'>): MigrationPlan {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    const newStep: MigrationStep = { ...step, id: crypto.randomUUID() };
    plan.steps.push(newStep);
    plan.steps.sort((a, b) => a.order - b.order);
    this.recalculateEffort(plan);

    return plan;
  }

  addBreakingChange(planId: string, change: Omit<BreakingChange, 'id'>): MigrationPlan {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    const newChange: BreakingChange = { ...change, id: crypto.randomUUID() };
    plan.breakingChanges.push(newChange);
    this.updateRiskLevel(plan);

    return plan;
  }

  updateStepStatus(planId: string, stepId: string, status: MigrationStatus): MigrationPlan {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    const step = plan.steps.find(s => s.id === stepId);
    if (!step) throw new Error(`Step not found: ${stepId}`);

    step.status = status;
    this.updatePlanStatus(plan);

    return plan;
  }

  executePlan(planId: string): MigrationResult {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    const startTime = Date.now();
    const result: MigrationResult = {
      planId,
      success: true,
      stepsCompleted: 0,
      stepsFailed: 0,
      filesModified: [],
      errors: [],
      duration: 0,
    };

    plan.status = 'migrating';

    for (const step of plan.steps) {
      if (!step.automated) continue;

      try {
        step.status = 'migrating';
        // Simulate execution
        result.filesModified.push(...step.files);
        step.status = 'complete';
        result.stepsCompleted++;
      } catch (error) {
        step.status = 'failed';
        result.stepsFailed++;
        result.errors.push((error as Error).message);
        result.success = false;
      }
    }

    result.duration = Date.now() - startTime;
    plan.status = result.success ? 'complete' : 'failed';
    plan.completedAt = new Date().toISOString();

    return result;
  }

  analyzeFramework(current: FrameworkConfig, target: FrameworkConfig): {
    breakingChanges: string[];
    newDependencies: string[];
    removedDependencies: string[];
    configChanges: string[];
  } {
    const currentDeps = Object.keys(current.dependencies);
    const targetDeps = Object.keys(target.dependencies);

    return {
      breakingChanges: this.detectBreakingChanges(current, target),
      newDependencies: targetDeps.filter(d => !currentDeps.includes(d)),
      removedDependencies: currentDeps.filter(d => !targetDeps.includes(d)),
      configChanges: this.detectConfigChanges(current, target),
    };
  }

  getPlan(id: string): MigrationPlan | undefined {
    return this.plans.get(id);
  }

  getPlansByStatus(status: MigrationStatus): MigrationPlan[] {
    return Array.from(this.plans.values()).filter(p => p.status === status);
  }

  generateReport(planId: string): string {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    const completedSteps = plan.steps.filter(s => s.status === 'complete').length;
    const automatedSteps = plan.steps.filter(s => s.automated).length;

    return [
      `Migration Plan: ${plan.name}`,
      `Type: ${plan.type}`,
      `From: ${plan.fromVersion} → To: ${plan.toVersion}`,
      `Status: ${plan.status}`,
      `Risk Level: ${plan.riskLevel}`,
      ``,
      `Progress: ${completedSteps}/${plan.steps.length} steps completed`,
      `Automation: ${automatedSteps}/${plan.steps.length} steps automated`,
      ``,
      `Breaking Changes: ${plan.breakingChanges.length}`,
      ...plan.breakingChanges.map(c => `  - [${c.severity}] ${c.description}`),
      ``,
      `Estimated Effort: ${plan.estimatedEffort} hours`,
    ].join('\n');
  }

  // ---- Private Methods ----

  private recalculateEffort(plan: MigrationPlan): void {
    plan.estimatedEffort = plan.steps.reduce((sum, s) => sum + s.estimatedTime, 0) / 60;
  }

  private updateRiskLevel(plan: MigrationPlan): void {
    const hasCritical = plan.breakingChanges.some(c => c.severity === 'critical');
    const hasHigh = plan.breakingChanges.some(c => c.severity === 'high');

    if (hasCritical) plan.riskLevel = 'high';
    else if (hasHigh) plan.riskLevel = 'medium';
    else plan.riskLevel = 'low';
  }

  private updatePlanStatus(plan: MigrationPlan): void {
    if (plan.steps.every(s => s.status === 'complete')) {
      plan.status = 'complete';
      plan.completedAt = new Date().toISOString();
    } else if (plan.steps.some(s => s.status === 'failed')) {
      plan.status = 'failed';
    } else if (plan.steps.some(s => s.status === 'migrating')) {
      plan.status = 'migrating';
    }
  }

  private detectBreakingChanges(current: FrameworkConfig, target: FrameworkConfig): string[] {
    const changes: string[] = [];
    const majorVersionChange = this.isMajorVersionChange(current.version, target.version);
    
    if (majorVersionChange) {
      changes.push(`Major version change: ${current.version} → ${target.version}`);
    }

    return changes;
  }

  private detectConfigChanges(current: FrameworkConfig, target: FrameworkConfig): string[] {
    const changes: string[] = [];
    
    for (const file of target.configFiles) {
      if (!current.configFiles.includes(file)) {
        changes.push(`New config file: ${file}`);
      }
    }

    return changes;
  }

  private isMajorVersionChange(from: string, to: string): boolean {
    const fromMajor = parseInt(from.split('.')[0]);
    const toMajor = parseInt(to.split('.')[0]);
    return toMajor > fromMajor;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createFrameworkMigrator(): FrameworkMigrator {
  return new FrameworkMigrator();
}

export function estimateMigrationEffort(changes: number, automated: boolean): number {
  const baseTime = changes * 30; // 30 min per change
  return automated ? baseTime * 0.3 : baseTime;
}
