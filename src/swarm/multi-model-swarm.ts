// Multi-Model Swarm - Orchestrate multiple agents across different models
// Parallel execution with per-task model routing

import type { ModelConfig, TaskType } from '../llm/model-registry.js';
import { getModelRouter, type RouteDecision } from '../llm/model-router.js';
import { getCostOptimizer } from '../llm/cost-optimizer.js';
import type { AgentId } from '../llm/agent-profiles.js';
import { getProfileManager } from '../llm/agent-profiles.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface SwarmTask {
  id: string;
  agentId: AgentId;
  taskType: TaskType;
  prompt: string;
  estimatedTokens: number;
  timeout?: number;
  priority?: 'critical' | 'high' | 'normal' | 'low';
}

export interface SwarmPipeline {
  id: string;
  name: string;
  steps: Array<{
    task: SwarmTask;
    condition?: (previousResult: SwarmTaskResult) => boolean;
  }>;
}

export interface SwarmTaskResult {
  taskId: string;
  agentId: AgentId;
  success: boolean;
  output: string;
  model: string;
  latency: number;
  cost: number;
  tokens: { input: number; output: number };
  error?: string;
}

export interface SwarmParallelResult {
  results: SwarmTaskResult[];
  completed: number;
  failed: number;
  totalCost: number;
  totalLatency: number;
  partialFailure: boolean;
}

export interface SwarmPipelineResult {
  pipelineId: string;
  results: SwarmTaskResult[];
  completed: boolean;
  totalCost: number;
  totalLatency: number;
}

export interface CircuitBreakerState {
  modelId: string;
  failures: number;
  lastFailure: number;
  open: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MultiModelSwarm Class
// ═══════════════════════════════════════════════════════════════════════════════

export class MultiModelSwarm {
  private modelRouter = getModelRouter();
  private costOptimizer = getCostOptimizer();
  private profileManager = getProfileManager();
  private circuitBreakers: Map<string, CircuitBreakerState>;
  private readonly circuitThreshold = 3;
  private readonly circuitTimeout = 10 * 60 * 1000; // 10 minutes

  constructor() {
    this.circuitBreakers = new Map();
  }

  /**
   * Execute multiple tasks in parallel with optimal model routing
   */
  async executeParallel(tasks: SwarmTask[]): Promise<SwarmParallelResult> {
    const results: SwarmTaskResult[] = [];
    let totalCost = 0;
    let maxLatency = 0;

    // Route each task to its optimal model
    const routedTasks = tasks.map(task => ({
      task,
      route: this.routeTask(task),
    }));

    // Execute all tasks in parallel with individual timeouts
    const promises = routedTasks.map(async ({ task, route }) => {
      try {
        const result = await this.executeTask(task, route);
        return result;
      } catch (error) {
        return this.createErrorResult(task, error);
      }
    });

    const settledResults = await Promise.allSettled(promises);

    for (const settled of settledResults) {
      if (settled.status === 'fulfilled') {
        results.push(settled.value);
        totalCost += settled.value.cost;
        maxLatency = Math.max(maxLatency, settled.value.latency);
      } else {
        // This shouldn't happen due to error handling in executeTask
        console.error('Unexpected rejection:', settled.reason);
      }
    }

    const failed = results.filter(r => !r.success).length;

    return {
      results,
      completed: results.length - failed,
      failed,
      totalCost,
      totalLatency: maxLatency,
      partialFailure: failed > 0 && failed < tasks.length,
    };
  }

  /**
   * Execute a sequential pipeline with model switching between steps
   */
  async executeSequential(pipeline: SwarmPipeline): Promise<SwarmPipelineResult> {
    const results: SwarmTaskResult[] = [];
    let totalCost = 0;
    let totalLatency = 0;

    for (const step of pipeline.steps) {
      // Check if condition is met
      if (step.condition && results.length > 0) {
        const lastResult = results[results.length - 1];
        if (!step.condition(lastResult)) {
          console.log(`[Swarm] Skipping step ${step.task.id} - condition not met`);
          continue;
        }
      }

      const route = this.routeTask(step.task);

      try {
        const result = await this.executeTask(step.task, route);
        results.push(result);
        totalCost += result.cost;
        totalLatency += result.latency;

        if (!result.success) {
          // Stop pipeline on failure
          break;
        }
      } catch (error) {
        results.push(this.createErrorResult(step.task, error));
        break;
      }
    }

    return {
      pipelineId: pipeline.id,
      results,
      completed: results.every(r => r.success),
      totalCost,
      totalLatency,
    };
  }

  /**
   * Execute the same task on multiple models and return best result
   */
  async executeFanOut(
    task: SwarmTask,
    models: ModelConfig[],
    strategy: 'best' | 'consensus' = 'best'
  ): Promise<SwarmTaskResult> {
    const results = await Promise.all(
      models.map(async model => {
        const route: RouteDecision = {
          model,
          reason: 'Fan-out execution',
          confidence: 1,
          estimatedCost: 0,
          estimatedLatency: 0,
          alternatives: [],
        };
        return this.executeTask(task, route);
      })
    );

    if (strategy === 'best') {
      // Return result with best quality (estimated by success and token count)
      const best = results.reduce((best, current) => {
        if (!current.success) return best;
        if (!best.success) return current;
        // Prefer lower latency among successful results
        return current.latency < best.latency ? current : best;
      });
      return best;
    } else {
      // Consensus - return most common output (simplified)
      const successful = results.filter(r => r.success);
      if (successful.length === 0) {
        return results[0];
      }
      // Return first successful result as consensus
      return successful[0];
    }
  }

  /**
   * Get circuit breaker status for all models
   */
  getCircuitBreakerStatus(): CircuitBreakerState[] {
    return Array.from(this.circuitBreakers.values());
  }

  /**
   * Reset circuit breaker for a model
   */
  resetCircuitBreaker(modelId: string): void {
    this.circuitBreakers.delete(modelId);
  }

  /**
   * Check if a model is available (circuit breaker not open)
   */
  isModelAvailable(modelId: string): boolean {
    const cb = this.circuitBreakers.get(modelId);
    if (!cb) return true;
    if (!cb.open) return true;

    // Check if cooldown has elapsed
    if (Date.now() - cb.lastFailure > this.circuitTimeout) {
      cb.open = false;
      cb.failures = 0;
      return true;
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════════

  private routeTask(task: SwarmTask): RouteDecision {
    const profile = this.profileManager.getProfile(task.agentId);
    
    // Get base constraints from profile
    const baseConstraints = profile 
      ? this.profileManager.getConstraints(task.agentId, task.taskType)
      : {};

    // Check budget constraints
    const budgetConstraints = this.getBudgetConstraints();

    // Merge constraints
    const constraints = {
      ...baseConstraints,
      ...budgetConstraints,
      excludedModels: this.getExcludedModels(),
    };

    // Route via model router
    return this.modelRouter.route(task.agentId, task.taskType, constraints, {
      input: Math.floor(task.estimatedTokens * 0.6),
      output: Math.floor(task.estimatedTokens * 0.4),
    });
  }

  private getBudgetConstraints() {
    const constraints: { minQuality?: number } = {};

    if (this.costOptimizer.onlyCriticalAllowed()) {
      // Only allow high-quality models for critical tasks
      constraints.minQuality = 0.9;
    } else if (this.costOptimizer.shouldDowngrade()) {
      // Prefer cheaper models
      constraints.minQuality = 0.7;
    }

    return constraints;
  }

  private getExcludedModels(): string[] {
    const excluded: string[] = [];
    
    for (const [modelId, cb] of this.circuitBreakers) {
      if (cb.open && Date.now() - cb.lastFailure < this.circuitTimeout) {
        excluded.push(modelId);
      }
    }

    return excluded;
  }

  private async executeTask(
    task: SwarmTask,
    route: RouteDecision
  ): Promise<SwarmTaskResult> {
    const startTime = Date.now();
    const modelId = route.model.id;

    // Check circuit breaker
    if (!this.isModelAvailable(modelId)) {
      throw new Error(`Circuit breaker open for model ${modelId}`);
    }

    // Check budget
    if (!this.costOptimizer.canAfford(route.model, task.estimatedTokens)) {
      throw new Error('Budget exceeded');
    }

    try {
      // Execute with timeout
      const timeout = task.timeout ?? 60000;
      const output = await this.callModelWithTimeout(route.model, task.prompt, timeout);

      const latency = Date.now() - startTime;
      const tokens = {
        input: Math.floor(task.estimatedTokens * 0.6),
        output: Math.floor(task.estimatedTokens * 0.4),
      };
      const cost = this.calculateCost(route.model, tokens.input, tokens.output);

      // Record spend
      this.costOptimizer.recordSpend(modelId, task.agentId, tokens.input, tokens.output);

      // Update model stats
      this.modelRouter.updateStats(modelId, task.taskType, {
        success: true,
        quality: 0.85, // Estimated
        latency,
        cost,
        tokens,
      });

      // Reset circuit breaker on success
      this.recordSuccess(modelId);

      return {
        taskId: task.id,
        agentId: task.agentId,
        success: true,
        output,
        model: modelId,
        latency,
        cost,
        tokens,
      };
    } catch (error) {
      // Record failure
      this.recordFailure(modelId);

      // Update model stats
      this.modelRouter.updateStats(modelId, task.taskType, {
        success: false,
        quality: 0,
        latency: Date.now() - startTime,
        cost: 0,
        tokens: { input: 0, output: 0 },
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  private async callModelWithTimeout(
    model: ModelConfig,
    prompt: string,
    timeout: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Model call timed out after ${timeout}ms`));
      }, timeout);

      // Simulate model call
      this.simulateModelCall(model, prompt)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async simulateModelCall(model: ModelConfig, prompt: string): Promise<string> {
    // In production, this would call the actual LLM API
    // For now, simulate latency and return mock response
    await new Promise(r => setTimeout(r, model.latencyP50));
    return `Mock response from ${model.name} for: ${prompt.slice(0, 50)}...`;
  }

  private calculateCost(model: ModelConfig, inputTokens: number, outputTokens: number): number {
    return (inputTokens * model.costPerInputToken) + (outputTokens * model.costPerOutputToken);
  }

  private recordSuccess(modelId: string): void {
    const cb = this.circuitBreakers.get(modelId);
    if (cb) {
      cb.failures = 0;
      cb.open = false;
    }
  }

  private recordFailure(modelId: string): void {
    let cb = this.circuitBreakers.get(modelId);
    if (!cb) {
      cb = { modelId, failures: 0, lastFailure: 0, open: false };
      this.circuitBreakers.set(modelId, cb);
    }

    cb.failures++;
    cb.lastFailure = Date.now();

    if (cb.failures >= this.circuitThreshold) {
      cb.open = true;
      console.warn(`[Swarm] Circuit breaker opened for ${modelId}`);
    }
  }

  private createErrorResult(task: SwarmTask, error: unknown): SwarmTaskResult {
    return {
      taskId: task.id,
      agentId: task.agentId,
      success: false,
      output: '',
      model: 'unknown',
      latency: 0,
      cost: 0,
      tokens: { input: 0, output: 0 },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Functions
// ═══════════════════════════════════════════════════════════════════════════════

let globalSwarm: MultiModelSwarm | null = null;

export function getMultiModelSwarm(): MultiModelSwarm {
  if (!globalSwarm) {
    globalSwarm = new MultiModelSwarm();
  }
  return globalSwarm;
}

export function resetMultiModelSwarm(): void {
  globalSwarm = null;
}
