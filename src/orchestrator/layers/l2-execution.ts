// L2 Execution Layer — R20-01
// Agent task execution, retry with new prompt, parallel workers

import type {
  ExecutionResult,
  ExecutionArtifact,
  ParallelExecutionResult,
  TaskNode,
} from '../hierarchy-types.js';

export interface L2Config {
  maxRetries: number;
  retryDelayMs: number;
  enableParallelWorkers: boolean;
  maxParallelTasks: number;
  timeoutMs: number;
}

export const DEFAULT_L2_CONFIG: L2Config = {
  maxRetries: 3,
  retryDelayMs: 1000,
  enableParallelWorkers: true,
  maxParallelTasks: 5,
  timeoutMs: 120000,
};

export interface AgentExecutor {
  execute(task: TaskNode, prompt: string): Promise<ExecutionResult>;
}

export class L2ExecutionLayer {
  private config: L2Config;
  private executor: AgentExecutor;

  constructor(executor: AgentExecutor, config: Partial<L2Config> = {}) {
    this.executor = executor;
    this.config = { ...DEFAULT_L2_CONFIG, ...config };
  }

  /**
   * Execute a single task with retry logic
   */
  async execute(
    task: TaskNode,
    options?: {
      initialPrompt?: string;
      retryStrategies?: string[];
    }
  ): Promise<ExecutionResult> {
    let retryCount = 0;
    let lastResult: ExecutionResult | null = null;
    let currentPrompt = options?.initialPrompt ?? this.buildPrompt(task);
    const retryStrategies = options?.retryStrategies ?? [
      'enhanced-context',
      'simplified-task',
      'different-angle',
    ];

    while (retryCount <= this.config.maxRetries) {
      try {
        const result = await this.runWithTimeout(task, currentPrompt);
        
        if (result.success) {
          return {
            ...result,
            retryCount,
            finalPrompt: currentPrompt,
          };
        }

        // Retry with new strategy
        if (retryCount < this.config.maxRetries) {
          currentPrompt = this.applyRetryStrategy(
            currentPrompt,
            retryStrategies[retryCount % retryStrategies.length],
            result.errors
          );
          await this.delay(this.config.retryDelayMs * (retryCount + 1));
        }

        lastResult = result;
        retryCount++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        if (retryCount >= this.config.maxRetries) {
          return {
            taskId: task.id,
            success: false,
            artifacts: [],
            retryCount,
            finalPrompt: currentPrompt,
            errors: [...(lastResult?.errors ?? []), errorMsg],
          };
        }

        retryCount++;
        await this.delay(this.config.retryDelayMs * retryCount);
      }
    }

    return {
      taskId: task.id,
      success: false,
      artifacts: lastResult?.artifacts ?? [],
      retryCount,
      finalPrompt: currentPrompt,
      errors: lastResult?.errors ?? ['Max retries exceeded'],
    };
  }

  /**
   * Execute multiple tasks in parallel
   */
  async executeParallel(
    tasks: TaskNode[],
    options?: {
      maxConcurrency?: number;
      initialPrompts?: Record<string, string>;
    }
  ): Promise<ParallelExecutionResult> {
    const maxConcurrency = options?.maxConcurrency ?? this.config.maxParallelTasks;
    const results: ExecutionResult[] = [];
    const startTime = Date.now();

    // Process in batches
    for (let i = 0; i < tasks.length; i += maxConcurrency) {
      const batch = tasks.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(task =>
        this.execute(task, {
          initialPrompt: options?.initialPrompts?.[task.id],
        })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const completedCount = results.filter(r => r.success).length;
    const failedCount = results.length - completedCount;

    return {
      results,
      completedCount,
      failedCount,
      totalExecutionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Execute tasks with dependencies (respects dependency order)
   */
  async executeWithDependencies(
    tasks: TaskNode[],
    dependencyMap: Map<string, string[]>
  ): Promise<ParallelExecutionResult> {
    const results: ExecutionResult[] = [];
    const completed = new Set<string>();
    const startTime = Date.now();

    while (completed.size < tasks.length) {
      // Find ready tasks (all dependencies completed)
      const readyTasks = tasks.filter(task => {
        if (completed.has(task.id)) return false;
        const deps = dependencyMap.get(task.id) ?? [];
        return deps.every(dep => completed.has(dep));
      });

      if (readyTasks.length === 0) {
        // Deadlock or error
        const remaining = tasks.filter(t => !completed.has(t.id));
        results.push(...remaining.map(t => ({
          taskId: t.id,
          success: false,
          artifacts: [],
          retryCount: 0,
          finalPrompt: '',
          errors: ['Dependency resolution failed'],
        })));
        break;
      }

      // Execute ready tasks in parallel
      const batchResult = await this.executeParallel(readyTasks);
      results.push(...batchResult.results);

      // Mark completed
      for (const result of batchResult.results) {
        if (result.success) {
          completed.add(result.taskId);
        }
      }
    }

    const completedCount = results.filter(r => r.success).length;
    const failedCount = results.length - completedCount;

    return {
      results,
      completedCount,
      failedCount,
      totalExecutionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Collect and merge artifacts from multiple executions
   */
  collectArtifacts(results: ExecutionResult[]): ExecutionArtifact[] {
    const artifacts: ExecutionArtifact[] = [];
    
    for (const result of results) {
      if (result.success && result.artifacts) {
        artifacts.push(...result.artifacts);
      }
    }

    return artifacts;
  }

  /**
   * Check if execution was partially successful
   */
  isPartialSuccess(result: ParallelExecutionResult): boolean {
    return result.completedCount > 0 && result.failedCount > 0;
  }

  /**
   * Get failed tasks for retry
   */
  getFailedTasks(
    result: ParallelExecutionResult,
    originalTasks: TaskNode[]
  ): TaskNode[] {
    const failedIds = new Set(
      result.results
        .filter(r => !r.success)
        .map(r => r.taskId)
    );
    
    return originalTasks.filter(t => failedIds.has(t.id));
  }

  private async runWithTimeout(
    task: TaskNode,
    prompt: string
  ): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out after ${this.config.timeoutMs}ms`));
      }, this.config.timeoutMs);

      this.executor
        .execute(task, prompt)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private buildPrompt(task: TaskNode): string {
    return `Execute task: ${task.description}
Agent: ${task.agent}
Priority: ${task.priority}
Estimated tokens: ${task.estimatedTokens}

Please complete this task efficiently and provide the output.`;
  }

  private applyRetryStrategy(
    prompt: string,
    strategy: string,
    previousErrors: string[]
  ): string {
    const errorContext = previousErrors.length > 0
      ? `\n\nPrevious attempt failed with:\n${previousErrors.join('\n')}`
      : '';

    switch (strategy) {
      case 'enhanced-context':
        return `${prompt}${errorContext}\n\nRetry with additional context and attention to the errors above.`;
      
      case 'simplified-task':
        return `Simplify the following task and focus on core requirements only:${errorContext}\n\n${prompt}`;
      
      case 'different-angle':
        return `${prompt}${errorContext}\n\nApproach this from a different angle. Consider alternative implementations.`;
      
      default:
        return `${prompt}${errorContext}\n\nRetry with improved approach.`;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Mock executor for testing
export class MockAgentExecutor implements AgentExecutor {
  private shouldFail: Set<string> = new Set();
  private failCount: Map<string, number> = new Map();

  setShouldFail(taskId: string, failCount: number = 1): void {
    this.shouldFail.add(taskId);
    this.failCount.set(taskId, failCount);
  }

  async execute(task: TaskNode, prompt: string): Promise<ExecutionResult> {
    if (this.shouldFail.has(task.id)) {
      const remainingFailures = this.failCount.get(task.id) ?? 0;
      
      if (remainingFailures > 0) {
        this.failCount.set(task.id, remainingFailures - 1);
        return {
          taskId: task.id,
          success: false,
          artifacts: [],
          retryCount: 0,
          finalPrompt: prompt,
          errors: ['Simulated failure'],
        };
      }
    }

    return {
      taskId: task.id,
      success: true,
      artifacts: [{
        type: 'code',
        content: `// Generated by ${task.agent}\n// Task: ${task.description}`,
        metadata: {
          agent: task.agent,
          taskId: task.id,
          timestamp: Date.now(),
          tokensUsed: task.estimatedTokens,
          generationTimeMs: 1000,
        },
      }],
      retryCount: 0,
      finalPrompt: prompt,
      errors: [],
    };
  }
}

export function createL2ExecutionLayer(
  executor: AgentExecutor,
  config?: Partial<L2Config>
): L2ExecutionLayer {
  return new L2ExecutionLayer(executor, config);
}
