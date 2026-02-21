// Execution Plan - K3-30
// Plan creation, step management, dependency resolution
// Spec: .kiro/specs/agent-harnesses/tasks.md

import type {
  ExecutionPlan,
  ExecutionStep,
  StepStatus,
  HarnessConfig,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Step Builder
// ═══════════════════════════════════════════════════════════════════════════════

export interface StepSpec {
  description: string;
  agentId?: string;
  dependencies?: string[];
  isCritical?: boolean;
  estimatedDurationMs?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Execution Plan Manager
// ═══════════════════════════════════════════════════════════════════════════════

export class ExecutionPlanManager {
  private plan: ExecutionPlan;

  constructor(plan: ExecutionPlan) {
    this.plan = plan;
  }

  /**
   * Get the current plan.
   */
  getPlan(): ExecutionPlan {
    return this.plan;
  }

  /**
   * Mark a step as started (transitions pending/ready → running).
   */
  startStep(stepId: string): void {
    const step = this.findStep(stepId);
    if (!step) throw new Error(`Step "${stepId}" not found`);
    if (step.status !== 'pending' && step.status !== 'ready') {
      throw new Error(`Step "${stepId}" is not in a startable state: ${step.status}`);
    }
    step.status = 'running';
    step.startedAt = Date.now();
    this.updatePlanStatus();
  }

  /**
   * Mark a step as complete.
   */
  completeStep(stepId: string, output?: string): void {
    const step = this.findStep(stepId);
    if (!step) throw new Error(`Step "${stepId}" not found`);

    step.status = 'completed';
    step.completedAt = Date.now();
    if (output !== undefined) step.output = output;

    // Unblock dependent steps
    this.updateReadiness();
    this.updatePlanStatus();
  }

  /**
   * Mark a step as failed. Transitively blocks dependent steps.
   */
  failStep(stepId: string, error: string): void {
    const step = this.findStep(stepId);
    if (!step) throw new Error(`Step "${stepId}" not found`);

    step.status = 'failed';
    step.error = error;
    step.completedAt = Date.now();

    // Block all steps that transitively depend on this one
    this.blockDependents(stepId);
    this.updatePlanStatus();
  }

  /**
   * Check if the plan is complete (all non-blocked steps done).
   */
  isComplete(): boolean {
    return this.plan.status === 'completed' || this.plan.status === 'failed';
  }

  /**
   * Get steps ready to execute (status === 'ready').
   */
  getReadySteps(): ExecutionStep[] {
    return this.plan.steps.filter(s => s.status === 'ready');
  }

  /**
   * Get steps blocked by failed dependencies.
   */
  getBlockedSteps(): ExecutionStep[] {
    return this.plan.steps.filter(s => s.status === 'blocked');
  }

  /**
   * Reset plan to pending state.
   */
  reset(): void {
    for (const step of this.plan.steps) {
      step.status = 'pending';
      step.startedAt = undefined;
      step.completedAt = undefined;
      step.output = undefined;
      step.error = undefined;
    }
    this.plan.status = 'pending';
    this.updateReadiness();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private findStep(id: string): ExecutionStep | undefined {
    return this.plan.steps.find(s => s.id === id);
  }

  private updateReadiness(): void {
    const completedIds = new Set(
      this.plan.steps.filter(s => s.status === 'completed').map(s => s.id)
    );

    for (const step of this.plan.steps) {
      if (step.status === 'pending') {
        const allDepsComplete = step.dependencies.every(dep => completedIds.has(dep));
        if (allDepsComplete) {
          step.status = 'ready';
        }
      }
    }
  }

  private blockDependents(failedStepId: string): void {
    const toBlock = new Set<string>([failedStepId]);
    let changed = true;

    // Transitively find all dependents
    while (changed) {
      changed = false;
      for (const step of this.plan.steps) {
        if (toBlock.has(step.id)) continue;
        if (step.dependencies.some(dep => toBlock.has(dep))) {
          toBlock.add(step.id);
          changed = true;
        }
      }
    }

    // Block all transitive dependents (not the failed step itself)
    for (const step of this.plan.steps) {
      if (toBlock.has(step.id) && step.id !== failedStepId) {
        if (step.status === 'pending' || step.status === 'ready') {
          step.status = 'blocked';
        }
      }
    }
  }

  private updatePlanStatus(): void {
    const steps = this.plan.steps;
    if (steps.length === 0) {
      this.plan.status = 'completed';
      return;
    }

    const allDone = steps.every(s =>
      s.status === 'completed' || s.status === 'failed' || s.status === 'blocked'
    );

    if (!allDone) {
      this.plan.status = this.plan.status === 'pending' ? 'in_progress' : this.plan.status;
      if (steps.some(s => s.status === 'running')) {
        this.plan.status = 'in_progress';
      }
      return;
    }

    // All done — check if any critical step failed
    const anyFailed = steps.some(s => s.status === 'failed' || s.status === 'blocked');
    this.plan.status = anyFailed ? 'failed' : 'completed';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Plan Factory
// ═══════════════════════════════════════════════════════════════════════════════

export function createExecutionPlan(
  taskDescription: string,
  stepSpecs: StepSpec[],
  defaultAgentId: string
): ExecutionPlanManager {
  const now = Date.now();
  const planId = `plan-${now}-${Math.random().toString(36).slice(2, 8)}`;

  const steps: ExecutionStep[] = stepSpecs.map((spec, idx) => {
    const stepId = `step-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`;
    return {
      id: stepId,
      description: spec.description,
      agentId: spec.agentId ?? defaultAgentId,
      status: (spec.dependencies && spec.dependencies.length > 0) ? 'pending' : 'ready',
      dependencies: spec.dependencies ?? [],
      isCritical: spec.isCritical ?? false,
      estimatedDurationMs: spec.estimatedDurationMs ?? 60000,
      toolCalls: [],
    };
  });

  // Re-check readiness after all steps created (IDs are now assigned)
  // Steps with no deps are immediately ready
  for (const step of steps) {
    step.status = step.dependencies.length === 0 ? 'ready' : 'pending';
  }

  const plan: ExecutionPlan = {
    id: planId,
    version: 1,
    createdAt: now,
    steps,
    status: 'pending',
  };

  return new ExecutionPlanManager(plan);
}

/**
 * Create a simple linear plan from a task description.
 * Each step depends on the previous one.
 * Builds the plan directly so dependency IDs correctly reference real step IDs.
 */
export function createLinearPlan(
  config: HarnessConfig,
  stepDescriptions: string[]
): ExecutionPlanManager {
  const now = Date.now();
  const planId = `plan-${now}-${Math.random().toString(36).slice(2, 8)}`;

  // Generate all step IDs up front so dependencies can reference real IDs
  const stepIds = stepDescriptions.map((_, idx) =>
    `step-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`
  );

  const steps: ExecutionStep[] = stepDescriptions.map((desc, idx) => ({
    id: stepIds[idx],
    description: desc,
    agentId: config.agentId,
    status: idx === 0 ? 'ready' : 'pending',
    dependencies: idx > 0 ? [stepIds[idx - 1]] : [],
    isCritical: false,
    estimatedDurationMs: 60000,
    toolCalls: [],
  }));

  const plan: ExecutionPlan = {
    id: planId,
    version: 1,
    createdAt: now,
    steps,
    status: 'pending',
  };

  return new ExecutionPlanManager(plan);
}
