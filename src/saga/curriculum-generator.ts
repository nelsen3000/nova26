// Curriculum Generator - Self-generated training sequences from goal objectives
// Spec: .kiro/specs/saga-self-evolving-agents/design.md

import type { GoalGenome, Curriculum, CurriculumTask, ObjectiveDescriptor } from './types.js';
import { CurriculumSchema, CurriculumTaskSchema } from './schemas.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface CurriculumConfig {
  /** Tasks per objective */
  tasksPerObjective: number;
  /** Difficulty progression curve: linear, exponential, adaptive */
  progressionCurve: 'linear' | 'exponential' | 'adaptive';
  /** Enable remedial task generation on failure */
  enableRemedial: boolean;
}

export const DEFAULT_CONFIG: CurriculumConfig = {
  tasksPerObjective: 3,
  progressionCurve: 'linear',
  enableRemedial: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Curriculum Generation
// ═══════════════════════════════════════════════════════════════════════════════

export function generate(
  genome: GoalGenome,
  config: Partial<CurriculumConfig> = {}
): Curriculum {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const tasks: CurriculumTask[] = [];

  // Generate tasks for each objective with progressive difficulty
  for (const objective of genome.objectives) {
    const objectiveTasks = generateTasksForObjective(
      objective,
      fullConfig.tasksPerObjective,
      fullConfig.progressionCurve
    );
    tasks.push(...objectiveTasks);
  }

  // Establish dependencies - easier tasks are prerequisites for harder ones
  const tasksWithDeps = establishDependencies(tasks);

  // Topological sort to ensure valid ordering
  const sortedTasks = topologicalSort(tasksWithDeps);

  const curriculum: Curriculum = {
    genomeId: genome.id,
    tasks: sortedTasks,
    createdAt: new Date().toISOString(),
  };

  return CurriculumSchema.parse(curriculum);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Task Generation
// ═══════════════════════════════════════════════════════════════════════════════

function generateTasksForObjective(
  objective: ObjectiveDescriptor,
  count: number,
  curve: CurriculumConfig['progressionCurve']
): CurriculumTask[] {
  const tasks: CurriculumTask[] = [];

  for (let i = 0; i < count; i++) {
    const difficulty = calculateDifficulty(i, count, curve);
    const task: CurriculumTask = {
      id: `task-${objective.id}-${i}`,
      description: generateTaskDescription(objective, difficulty, i),
      objectiveId: objective.id,
      difficulty,
      predecessorIds: [], // Will be set by establishDependencies
      status: 'pending',
    };
    tasks.push(CurriculumTaskSchema.parse(task));
  }

  return tasks;
}

function calculateDifficulty(
  index: number,
  total: number,
  curve: CurriculumConfig['progressionCurve']
): number {
  const progress = index / (total - 1 || 1);

  switch (curve) {
    case 'linear':
      return progress;
    case 'exponential':
      return Math.pow(progress, 2);
    case 'adaptive':
      // Start easy, accelerate in middle, plateau at end
      return 0.5 * (1 - Math.cos(progress * Math.PI));
    default:
      return progress;
  }
}

function generateTaskDescription(
  objective: ObjectiveDescriptor,
  difficulty: number,
  index: number
): string {
  const difficultyLabel =
    difficulty < 0.33 ? 'basic' : difficulty < 0.66 ? 'intermediate' : 'advanced';

  return `Task ${index + 1} (${difficultyLabel}): Apply "${objective.description}" ` +
    `with weight ${objective.weight.toFixed(2)} in domain "${objective.domain}"`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dependency Management
// ═══════════════════════════════════════════════════════════════════════════════

function establishDependencies(tasks: CurriculumTask[]): CurriculumTask[] {
  // Group tasks by objective
  const tasksByObjective = new Map<string, CurriculumTask[]>();
  for (const task of tasks) {
    const existing = tasksByObjective.get(task.objectiveId) || [];
    existing.push(task);
    tasksByObjective.set(task.objectiveId, existing);
  }

  // Sort each objective's tasks by difficulty and establish chain dependencies
  const result: CurriculumTask[] = [];

  for (const [objectiveId, objectiveTasks] of tasksByObjective) {
    const sorted = [...objectiveTasks].sort((a, b) => a.difficulty - b.difficulty);

    for (let i = 0; i < sorted.length; i++) {
      const task = sorted[i];
      const predecessors: string[] = [];

      // Each task depends on the previous one in the same objective
      if (i > 0) {
        predecessors.push(sorted[i - 1].id);
      }

      // Harder tasks may depend on easier tasks from other objectives
      if (task.difficulty > 0.5) {
        for (const [otherId, otherTasks] of tasksByObjective) {
          if (otherId !== objectiveId) {
            // Find an easy task from another objective as prerequisite
            const easyTask = otherTasks.find(t => t.difficulty < 0.33);
            if (easyTask) {
              predecessors.push(easyTask.id);
            }
          }
        }
      }

      result.push({
        ...task,
        predecessorIds: predecessors,
      });
    }
  }

  return result;
}

function topologicalSort(tasks: CurriculumTask[]): CurriculumTask[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const result: CurriculumTask[] = [];

  function visit(taskId: string): void {
    if (visited.has(taskId)) return;
    if (visiting.has(taskId)) {
      // Cycle detected - shouldn't happen with our dependency rules
      return;
    }

    visiting.add(taskId);
    const task = taskMap.get(taskId);
    if (task) {
      for (const predId of task.predecessorIds) {
        visit(predId);
      }
      result.push(task);
    }
    visiting.delete(taskId);
    visited.add(taskId);
  }

  for (const task of tasks) {
    visit(task.id);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Remedial Task Generation
// ═══════════════════════════════════════════════════════════════════════════════

export function generateRemedialTask(
  failedTask: CurriculumTask,
  genome: GoalGenome
): CurriculumTask {
  const objective = genome.objectives.find(o => o.id === failedTask.objectiveId);
  
  const remedialTask: CurriculumTask = {
    id: `remedial-${failedTask.id}-${Date.now()}`,
    description: `Remedial: ${failedTask.description} (simplified version)`,
    objectiveId: failedTask.objectiveId,
    difficulty: Math.max(0, failedTask.difficulty - 0.2), // Easier version
    predecessorIds: [], // No dependencies for remedial tasks
    status: 'remedial',
  };

  return CurriculumTaskSchema.parse(remedialTask);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Curriculum Utilities
// ═══════════════════════════════════════════════════════════════════════════════

export function getReadyTasks(curriculum: Curriculum): CurriculumTask[] {
  const completedIds = new Set(
    curriculum.tasks.filter(t => t.status === 'passed').map(t => t.id)
  );

  return curriculum.tasks.filter(
    task =>
      task.status === 'pending' &&
      task.predecessorIds.every(id => completedIds.has(id))
  );
}

export function getProgress(curriculum: Curriculum): {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  percentage: number;
} {
  const total = curriculum.tasks.length;
  const completed = curriculum.tasks.filter(t => t.status === 'passed').length;
  const failed = curriculum.tasks.filter(t => t.status === 'failed').length;
  const pending = curriculum.tasks.filter(t => t.status === 'pending').length;

  return {
    total,
    completed,
    failed,
    pending,
    percentage: total > 0 ? completed / total : 0,
  };
}

export function updateTaskStatus(
  curriculum: Curriculum,
  taskId: string,
  status: CurriculumTask['status']
): Curriculum {
  const updatedTasks = curriculum.tasks.map(t =>
    t.id === taskId ? { ...t, status } : t
  );

  return {
    ...curriculum,
    tasks: updatedTasks,
  };
}
