// Inner Loop - Execute curriculum tasks and collect fitness metrics
// Spec: .kiro/specs/saga-self-evolving-agents/design.md

import type {
  GoalGenome,
  Curriculum,
  CurriculumTask,
  CurriculumTaskResult,
  InnerLoopResult,
} from './types.js';
import { generate as generateCurriculum, getReadyTasks, updateTaskStatus } from './curriculum-generator.js';
import { InnerLoopResultSchema } from './schemas.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface InnerLoopConfig {
  maxIterations: number;
  timeoutMs: number;
  enableRemedial: boolean;
}

export const DEFAULT_CONFIG: InnerLoopConfig = {
  maxIterations: 100,
  timeoutMs: 300000, // 5 minutes
  enableRemedial: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Task Executor Interface
// ═══════════════════════════════════════════════════════════════════════════════

export interface TaskExecutor {
  execute(task: CurriculumTask, genome: GoalGenome): Promise<CurriculumTaskResult>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Inner Loop Execution
// ═══════════════════════════════════════════════════════════════════════════════

export interface InnerLoopOptions {
  genome: GoalGenome;
  executor: TaskExecutor;
  config?: Partial<InnerLoopConfig>;
  onProgress?: (completed: number, total: number) => void;
}

export async function executeInnerLoop(
  options: InnerLoopOptions
): Promise<InnerLoopResult> {
  const config = { ...DEFAULT_CONFIG, ...options.config };
  const startTime = Date.now();
  const taskResults: CurriculumTaskResult[] = [];
  let iterationsCompleted = 0;
  let partial = false;

  // Generate curriculum from genome
  let curriculum = generateCurriculum(options.genome);
  const totalTasks = curriculum.tasks.length;

  // Execute tasks in topological order
  while (iterationsCompleted < config.maxIterations) {
    // Check timeout
    if (Date.now() - startTime > config.timeoutMs) {
      partial = true;
      break;
    }

    // Get ready tasks (dependencies satisfied)
    const readyTasks = getReadyTasks(curriculum);
    if (readyTasks.length === 0) {
      // No more tasks to execute
      break;
    }

    // Execute ready tasks
    for (const task of readyTasks) {
      // Check timeout before each task
      if (Date.now() - startTime > config.timeoutMs) {
        partial = true;
        break;
      }

      try {
        const result = await options.executor.execute(task, options.genome);
        taskResults.push(result);

        // Update task status
        curriculum = updateTaskStatus(
          curriculum,
          task.id,
          result.passed ? 'passed' : 'failed'
        );

        // Handle failure with remedial task
        if (!result.passed && config.enableRemedial) {
          // Remedial logic is handled by the curriculum generator
          // The remedial task would be generated and inserted
        }
      } catch (error) {
        // Task execution error
        taskResults.push({
          taskId: task.id,
          objectiveId: task.objectiveId,
          passed: false,
          score: 0,
          duration: Date.now() - startTime,
        });

        curriculum = updateTaskStatus(curriculum, task.id, 'failed');
      }

      iterationsCompleted++;
      options.onProgress?.(taskResults.length, totalTasks);
    }

    if (partial) break;
  }

  // Check if we hit iteration limit
  if (iterationsCompleted >= config.maxIterations) {
    partial = true;
  }

  const result: InnerLoopResult = {
    genomeId: options.genome.id,
    taskResults,
    totalDuration: Date.now() - startTime,
    iterationsCompleted,
    partial,
  };

  return InnerLoopResultSchema.parse(result);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mock Task Executor (for testing)
// ═══════════════════════════════════════════════════════════════════════════════

export function createMockExecutor(
  successRate: number = 0.8
): TaskExecutor {
  return {
    async execute(task, genome): Promise<CurriculumTaskResult> {
      // Simulate task execution time
      await new Promise(r => setTimeout(r, 10));

      const passed = Math.random() < successRate;
      const score = passed
        ? 0.7 + Math.random() * 0.3
        : Math.random() * 0.5;

      return {
        taskId: task.id,
        objectiveId: task.objectiveId,
        passed,
        score,
        duration: 10,
      };
    },
  };
}
