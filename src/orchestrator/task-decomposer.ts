// Hierarchical Task Decomposition for NOVA26
// Breaks down complex tasks into manageable subtasks

import { randomUUID } from 'crypto';

export interface Subtask {
  id: string;
  title: string;
  description: string;
  agent: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  parentId: string;
  dependencies: string[];
  estimatedComplexity: 'simple' | 'medium' | 'complex';
  estimatedDuration: number; // in minutes
  output?: string;
  error?: string;
  order: number;
}

export interface DecomposedTask {
  parentId: string;
  subtasks: Subtask[];
  totalEstimatedDuration: number;
  criticalPath: string[]; // IDs of subtasks on critical path
  parallelizable: string[][]; // Groups of subtasks that can run in parallel
}

export interface TaskComplexity {
  linesOfCode: number;
  fileCount: number;
  integrationPoints: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendedSubtaskCount: number;
}

/**
 * Analyze task complexity to determine if decomposition is needed
 */
export function analyzeComplexity(
  _title: string,
  description: string,
  _context?: Record<string, unknown>
): TaskComplexity {
  // Simple heuristic-based analysis
  const linesEstimate = description.length / 50; // Rough estimate
  const complexity: TaskComplexity = {
    linesOfCode: Math.max(50, linesEstimate * 10),
    fileCount: 1,
    integrationPoints: 0,
    riskLevel: 'low',
    recommendedSubtaskCount: 1,
  };

  // Count integration points
  const integrationKeywords = ['api', 'database', 'webhook', 'integration', 'auth', 'payment'];
  const descriptionLower = description.toLowerCase();
  
  for (const keyword of integrationKeywords) {
    if (descriptionLower.includes(keyword)) {
      complexity.integrationPoints++;
    }
  }

  // Estimate file count
  if (descriptionLower.includes('component')) complexity.fileCount++;
  if (descriptionLower.includes('page')) complexity.fileCount += 2;
  if (descriptionLower.includes('api')) complexity.fileCount += 2;
  if (descriptionLower.includes('schema')) complexity.fileCount++;
  if (descriptionLower.includes('test')) complexity.fileCount++;

  // Determine risk level
  if (complexity.integrationPoints >= 3 || complexity.fileCount >= 5) {
    complexity.riskLevel = 'high';
    complexity.recommendedSubtaskCount = Math.min(5, complexity.fileCount);
  } else if (complexity.integrationPoints >= 1 || complexity.fileCount >= 3) {
    complexity.riskLevel = 'medium';
    complexity.recommendedSubtaskCount = Math.min(3, complexity.fileCount);
  }

  return complexity;
}

/**
 * Determines if a task needs decomposition
 */
export function shouldDecompose(taskTitle: string, taskDescription: string): boolean {
  const complexity = analyzeComplexity(taskTitle, taskDescription);
  
  // Decompose if complexity is medium or high
  return complexity.riskLevel !== 'low' || complexity.integrationPoints >= 2;
}

/**
 * Decompose a complex task into subtasks
 */
export function decomposeTask(
  parentId: string,
  title: string,
  description: string,
  agent: string
): DecomposedTask {
  const complexity = analyzeComplexity(title, description);
  const subtasks: Subtask[] = [];

  // Generate subtasks based on task type and complexity
  const descriptionLower = description.toLowerCase();

  // Schema/Database tasks
  if (descriptionLower.includes('schema') || descriptionLower.includes('database')) {
    subtasks.push(
      createSubtask(parentId, 'Design schema structure', 'PLUTO', 1),
      createSubtask(parentId, 'Implement schema validation', 'ENCELADUS', 2, [subtasks[0]?.id]),
      createSubtask(parentId, 'Create migration scripts', 'PLUTO', 3, [subtasks[0]?.id]),
      createSubtask(parentId, 'Add indexes for performance', 'IO', 4, [subtasks[0]?.id])
    );
  }

  // API/Backend tasks
  if (descriptionLower.includes('api') || descriptionLower.includes('backend') || descriptionLower.includes('mutation')) {
    subtasks.push(
      createSubtask(parentId, 'Design API interface', 'MARS', subtasks.length + 1),
      createSubtask(parentId, 'Implement business logic', 'MARS', subtasks.length + 2),
      createSubtask(parentId, 'Add input validation', 'ENCELADUS', subtasks.length + 3),
      createSubtask(parentId, 'Handle error cases', 'CHARON', subtasks.length + 4)
    );
  }

  // Integration tasks
  if (descriptionLower.includes('integration') || descriptionLower.includes('webhook') || descriptionLower.includes('stripe')) {
    subtasks.push(
      createSubtask(parentId, 'Set up external API client', 'GANYMEDE', subtasks.length + 1),
      createSubtask(parentId, 'Implement retry logic', 'MIMAS', subtasks.length + 2, [subtasks[subtasks.length - 1]?.id]),
      createSubtask(parentId, 'Add webhook handlers', 'GANYMEDE', subtasks.length + 3),
      createSubtask(parentId, 'Test integration flows', 'SATURN', subtasks.length + 4)
    );
  }

  // Frontend/UI tasks
  if (descriptionLower.includes('ui') || descriptionLower.includes('component') || descriptionLower.includes('page')) {
    subtasks.push(
      createSubtask(parentId, 'Design component structure', 'VENUS', subtasks.length + 1),
      createSubtask(parentId, 'Implement component logic', 'VENUS', subtasks.length + 2),
      createSubtask(parentId, 'Add loading/error states', 'CHARON', subtasks.length + 3),
      createSubtask(parentId, 'Style with Tailwind', 'VENUS', subtasks.length + 4),
      createSubtask(parentId, 'Add animations', 'VENUS', subtasks.length + 5)
    );
  }

  // Testing tasks
  if (descriptionLower.includes('test')) {
    subtasks.push(
      createSubtask(parentId, 'Write unit tests', 'SATURN', subtasks.length + 1),
      createSubtask(parentId, 'Write integration tests', 'SATURN', subtasks.length + 2),
      createSubtask(parentId, 'Add E2E tests', 'SATURN', subtasks.length + 3)
    );
  }

  // Documentation tasks
  if (complexity.riskLevel === 'high' || descriptionLower.includes('document')) {
    subtasks.push(
      createSubtask(parentId, 'Write API documentation', 'CALLISTO', subtasks.length + 1),
      createSubtask(parentId, 'Add inline code comments', 'CALLISTO', subtasks.length + 2)
    );
  }

  // If no specific patterns matched, create generic subtasks
  if (subtasks.length === 0) {
    subtasks.push(
      createSubtask(parentId, `Analyze requirements: ${title}`, 'EARTH', 1),
      createSubtask(parentId, `Design implementation: ${title}`, 'JUPITER', 2, [subtasks[0]?.id]),
      createSubtask(parentId, `Implement core functionality: ${title}`, agent, 3, [subtasks[1]?.id]),
      createSubtask(parentId, `Validate implementation: ${title}`, 'MERCURY', 4, [subtasks[2]?.id])
    );
  }

  // Calculate parallelizable groups
  const parallelizable = findParallelizableGroups(subtasks);
  
  // Calculate critical path
  const criticalPath = calculateCriticalPath(subtasks);

  // Calculate total estimated duration
  const totalEstimatedDuration = subtasks.reduce((sum, s) => sum + s.estimatedDuration, 0);

  return {
    parentId,
    subtasks,
    totalEstimatedDuration,
    criticalPath,
    parallelizable,
  };
}

/**
 * Create a new subtask
 */
function createSubtask(
  parentId: string,
  title: string,
  agent: string,
  order: number,
  dependencies: string[] = []
): Subtask {
  return {
    id: `sub-${randomUUID().slice(0, 8)}`,
    title,
    description: `Subtask: ${title}`,
    agent,
    status: 'pending',
    parentId,
    dependencies: dependencies.filter(Boolean),
    estimatedComplexity: 'medium',
    estimatedDuration: estimateDuration(title, agent),
    order,
  };
}

/**
 * Estimate duration based on task type and agent
 */
function estimateDuration(title: string, agent: string): number {
  // Base durations by agent type
  const baseDurations: Record<string, number> = {
    'VENUS': 20,
    'MARS': 25,
    'PLUTO': 15,
    'SATURN': 30,
    'ENCELADUS': 20,
    'GANYMEDE': 25,
    'CALLISTO': 15,
    'EARTH': 10,
    'JUPITER': 15,
    'MERCURY': 10,
    'CHARON': 15,
    'IO': 20,
    'MIMAS': 20,
    'NEPTUNE': 15,
  };

  let duration = baseDurations[agent] || 20;

  // Adjust based on keywords in title
  if (title.includes('design') || title.includes('Design')) duration += 10;
  if (title.includes('implement') || title.includes('Implement')) duration += 15;
  if (title.includes('test') || title.includes('Test')) duration += 20;
  if (title.includes('document') || title.includes('Document')) duration += 10;

  return duration;
}

/**
 * Find groups of subtasks that can run in parallel
 */
function findParallelizableGroups(subtasks: Subtask[]): string[][] {
  const groups: string[][] = [];

  // Group by order (subtasks with same order can run in parallel)
  const orderGroups = new Map<number, string[]>();
  
  for (const subtask of subtasks) {
    const order = subtask.order;
    if (!orderGroups.has(order)) {
      orderGroups.set(order, []);
    }
    orderGroups.get(order)!.push(subtask.id);
  }

  for (const [, ids] of orderGroups) {
    if (ids.length > 1) {
      groups.push(ids);
    }
  }

  return groups;
}

/**
 * Calculate critical path (longest dependency chain)
 */
function calculateCriticalPath(subtasks: Subtask[]): string[] {
  const path: string[] = [];
  const visited = new Set<string>();

  // Find the longest chain
  let maxDepth = 0;
  let deepestTask: Subtask | null = null;

  for (const subtask of subtasks) {
    const depth = calculateDepth(subtask, subtasks, visited);
    if (depth > maxDepth) {
      maxDepth = depth;
      deepestTask = subtask;
    }
  }

  // Reconstruct path from deepest task
  if (deepestTask) {
    let current: Subtask | undefined = deepestTask;
    while (current) {
      path.unshift(current.id);
      if (current.dependencies.length === 0) break;
      current = subtasks.find(s => s.id === current!.dependencies[0]);
    }
  }

  return path;
}

function calculateDepth(subtask: Subtask, allSubtasks: Subtask[], visited: Set<string>): number {
  if (visited.has(subtask.id)) return 0;
  visited.add(subtask.id);

  if (subtask.dependencies.length === 0) return 1;

  let maxDepDepth = 0;
  for (const depId of subtask.dependencies) {
    const dep = allSubtasks.find(s => s.id === depId);
    if (dep) {
      maxDepDepth = Math.max(maxDepDepth, calculateDepth(dep, allSubtasks, visited));
    }
  }

  return 1 + maxDepDepth;
}

/**
 * Format decomposed task for display
 */
export function formatDecomposition(decomposition: DecomposedTask): string {
  const lines = [
    '\n📋 Task Decomposition',
    '═══════════════════════════════════════════════════',
    '',
    `Parent Task: ${decomposition.parentId}`,
    `Total Subtasks: ${decomposition.subtasks.length}`,
    `Estimated Duration: ${decomposition.totalEstimatedDuration} minutes`,
    '',
    'Subtasks:',
  ];

  const sortedSubtasks = [...decomposition.subtasks].sort((a, b) => a.order - b.order);

  for (const subtask of sortedSubtasks) {
    const deps = subtask.dependencies.length > 0 
      ? ` (depends on: ${subtask.dependencies.join(', ')})` 
      : '';
    const status = getStatusEmoji(subtask.status);
    lines.push(`  ${status} [${subtask.agent}] ${subtask.title}${deps}`);
  }

  if (decomposition.criticalPath.length > 0) {
    lines.push('');
    lines.push(`Critical Path: ${decomposition.criticalPath.join(' → ')}`);
  }

  if (decomposition.parallelizable.length > 0) {
    lines.push('');
    lines.push('Parallelizable Groups:');
    for (const group of decomposition.parallelizable) {
      lines.push(`  • ${group.join(', ')}`);
    }
  }

  lines.push('═══════════════════════════════════════════════════\n');

  return lines.join('\n');
}

function getStatusEmoji(status: Subtask['status']): string {
  const emojis: Record<string, string> = {
    'pending': '⏳',
    'in_progress': '🔄',
    'completed': '✅',
    'failed': '❌',
  };
  return emojis[status] || '⏳';
}

/**
 * Get next subtask to execute
 */
export function getNextSubtask(decomposition: DecomposedTask): Subtask | null {
  const pendingSubtasks = decomposition.subtasks.filter(s => s.status === 'pending');
  
  for (const subtask of pendingSubtasks) {
    // Check if all dependencies are completed
    const depsCompleted = subtask.dependencies.every(depId => {
      const dep = decomposition.subtasks.find(s => s.id === depId);
      return dep?.status === 'completed';
    });
    
    if (depsCompleted) {
      return subtask;
    }
  }
  
  return null;
}

/**
 * Check if all subtasks are completed
 */
export function isDecompositionComplete(decomposition: DecomposedTask): boolean {
  return decomposition.subtasks.every(s => s.status === 'completed');
}

/**
 * Calculate completion percentage
 */
export function getCompletionPercentage(decomposition: DecomposedTask): number {
  if (decomposition.subtasks.length === 0) return 0;
  const completed = decomposition.subtasks.filter(s => s.status === 'completed').length;
  return Math.round((completed / decomposition.subtasks.length) * 100);
}
