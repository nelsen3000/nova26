// KIMI-R26-04: Infinite Memory Lifecycle Adapter
// Bridges Ralph Loop lifecycle events to ATLAS Infinite Memory

import type { FeatureLifecycleHandlers } from '../orchestrator/lifecycle-wiring.js';
import type {
  TaskResult,
  BuildResult,
} from '../orchestrator/lifecycle-hooks.js';
import {
  ATLASInfiniteMemory,
  type MemoryLevel,
} from './infinite-memory-core.js';

// ============================================================================
// Configuration Types
// ============================================================================

export interface InfiniteMemoryLifecycleConfig {
  /** Enable infinite memory */
  enabled: boolean;
  /** Maximum memory nodes before pruning */
  maxNodes?: number;
  /** Days after which to prune stale memories */
  pruneAfterDays?: number;
  /** Default taste score for new memories */
  defaultTasteScore?: number;
  /** Enable automatic hierarchy classification */
  autoClassify?: boolean;
}

// ============================================================================
// Adapter State
// ============================================================================

interface BuildState {
  buildId: string;
  memory: ATLASInfiniteMemory;
  taskNodeIds: Map<string, string>;
  buildSummary: {
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    agentsUsed: Set<string>;
    totalDurationMs: number;
  };
}

// Module-level state (isolated per build)
let currentBuildState: BuildState | null = null;

// ============================================================================
// Type Guards
// ============================================================================

function isValidTaskResult(context: unknown): context is TaskResult {
  return (
    typeof context === 'object' &&
    context !== null &&
    'taskId' in context &&
    'success' in context &&
    typeof (context as Record<string, unknown>).taskId === 'string' &&
    typeof (context as Record<string, unknown>).success === 'boolean'
  );
}

function isValidBuildResult(context: unknown): context is BuildResult {
  return (
    typeof context === 'object' &&
    context !== null &&
    'buildId' in context &&
    'totalTasks' in context &&
    typeof (context as Record<string, unknown>).buildId === 'string' &&
    typeof (context as Record<string, unknown>).totalTasks === 'number'
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function determineHierarchyLevel(
  _taskResult: TaskResult,
  _config: InfiniteMemoryLifecycleConfig
): MemoryLevel {
  // Individual tasks are stored at 'scene' level
  // Task groups would be 'project' level (determined by related task patterns)
  return 'scene';
}

function calculateTasteScore(
  taskResult: TaskResult,
  config: InfiniteMemoryLifecycleConfig
): number {
  let score = config.defaultTasteScore ?? 0.5;

  // Successful tasks get higher base score
  if (taskResult.success) {
    score += 0.15;
  } else {
    score -= 0.2;
  }

  // Tasks with ACE score get significant bonus (up to 0.35 for aceScore 1.0)
  if (taskResult.aceScore !== undefined) {
    score += taskResult.aceScore * 0.35;
  }

  // Penalize very short outputs (likely trivial tasks) - strong penalty
  if (taskResult.output && taskResult.output.length < 50) {
    score -= 0.4;
  }

  // Reward comprehensive outputs
  if (taskResult.output && taskResult.output.length > 500) {
    score += 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

function generateMemoryContent(taskResult: TaskResult): string {
  const parts: string[] = [
    `Task: ${taskResult.taskId}`,
    `Agent: ${taskResult.agentName}`,
    `Status: ${taskResult.success ? 'SUCCESS' : 'FAILED'}`,
  ];

  if (taskResult.durationMs) {
    parts.push(`Duration: ${taskResult.durationMs}ms`);
  }

  if (taskResult.aceScore !== undefined) {
    parts.push(`ACE Score: ${taskResult.aceScore.toFixed(2)}`);
  }

  if (taskResult.output) {
    parts.push(`Output Preview: ${taskResult.output.substring(0, 200)}`);
  }

  if (taskResult.error) {
    parts.push(`Error: ${taskResult.error}`);
  }

  return parts.join('\n');
}

function generateBuildSummaryContent(
  buildResult: BuildResult,
  state: BuildState
): string {
  const parts: string[] = [
    `Build: ${buildResult.buildId}`,
    `Total Tasks: ${buildResult.totalTasks}`,
    `Successful: ${buildResult.successfulTasks}`,
    `Failed: ${buildResult.failedTasks}`,
    `Success Rate: ${((buildResult.successfulTasks / buildResult.totalTasks) * 100).toFixed(1)}%`,
    `Average ACE Score: ${buildResult.averageAceScore.toFixed(2)}`,
    `Duration: ${buildResult.totalDurationMs}ms`,
    `Agents Used: ${Array.from(state.buildSummary.agentsUsed).join(', ')}`,
    `Memory Nodes Created: ${state.taskNodeIds.size}`,
  ];

  return parts.join('\n');
}

// ============================================================================
// Lifecycle Hook Factory
// ============================================================================

export function createInfiniteMemoryLifecycleHooks(
  config: InfiniteMemoryLifecycleConfig
): FeatureLifecycleHandlers {
  return {
    onAfterTask: async (context: TaskResult): Promise<void> => {
      if (!config.enabled || !currentBuildState) return;

      // Validate context
      if (!isValidTaskResult(context)) {
        console.warn('[InfiniteMemoryAdapter] Invalid task result context');
        return;
      }

      const { memory, buildId, taskNodeIds, buildSummary } = currentBuildState;

      // Determine hierarchy level
      const level = determineHierarchyLevel(context, config);

      // Calculate taste score
      const tasteScore = calculateTasteScore(context, config);

      // Generate memory content
      const content = generateMemoryContent(context);

      try {
        // Create memory node
        const nodeId = await memory.upsertWithHierarchy({
          level,
          content,
          metadata: {
            agentId: context.agentName,
            timestamp: new Date().toISOString(),
            tasteScore,
            accessCount: 1,
            lastAccessed: new Date().toISOString(),
          },
          childIds: [],
          tags: [
            context.success ? 'success' : 'failure',
            `agent-${context.agentName}`,
            `build-${buildId}`,
          ],
        });

        // Store node ID for later linking
        taskNodeIds.set(context.taskId, nodeId);

        // Update build summary
        buildSummary.totalTasks++;
        if (context.success) {
          buildSummary.successfulTasks++;
        } else {
          buildSummary.failedTasks++;
        }
        buildSummary.agentsUsed.add(context.agentName);
        buildSummary.totalDurationMs += context.durationMs || 0;

        console.log('[InfiniteMemoryAdapter] Stored task memory', {
          taskId: context.taskId,
          nodeId,
          level,
          tasteScore: tasteScore.toFixed(2),
        });
      } catch (error) {
        console.error('[InfiniteMemoryAdapter] Failed to store task memory', {
          taskId: context.taskId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },

    onBuildComplete: async (context: BuildResult): Promise<void> => {
      // Always clear state at the end, even if disabled
      if (!config.enabled || !currentBuildState) {
        currentBuildState = null;
        return;
      }

      // Validate context
      if (!isValidBuildResult(context)) {
        console.warn('[InfiniteMemoryAdapter] Invalid build result context');
        currentBuildState = null;
        return;
      }

      const { memory, buildId, taskNodeIds } = currentBuildState;

      try {
        // Create project-level summary node
        const summaryContent = generateBuildSummaryContent(context, currentBuildState);
        const summaryTasteScore = context.averageAceScore > 0.7 ? 0.8 : 0.5;

        const summaryNodeId = await memory.upsertWithHierarchy({
          level: 'project',
          content: summaryContent,
          metadata: {
            agentId: 'ralph-loop',
            timestamp: new Date().toISOString(),
            tasteScore: summaryTasteScore,
            accessCount: 1,
            lastAccessed: new Date().toISOString(),
          },
          childIds: Array.from(taskNodeIds.values()),
          tags: [
            'build-summary',
            context.failedTasks === 0 ? 'successful-build' : 'partial-build',
            `build-${buildId}`,
          ],
        });

        console.log('[InfiniteMemoryAdapter] Created build summary node', {
          buildId,
          summaryNodeId,
          taskNodesLinked: taskNodeIds.size,
        });

        // Prune stale nodes if memory exceeds configured limits
        const stats = memory.getStats();
        const maxNodes = config.maxNodes ?? 10000;

        if (stats.totalNodes > maxNodes) {
          const pruneDays = config.pruneAfterDays ?? 30;
          const prunedCount = await memory.pruneStale(pruneDays);

          console.log('[InfiniteMemoryAdapter] Pruned stale memories', {
            pruned: prunedCount,
            remaining: stats.totalNodes - prunedCount,
          });
        }

        // Log final memory stats
        const finalStats = memory.getStats();
        console.log('[InfiniteMemoryAdapter] Build complete - Memory stats', {
          totalNodes: finalStats.totalNodes,
          byLevel: finalStats.byLevel,
          avgTasteScore: finalStats.avgTasteScore.toFixed(2),
        });
      } catch (error) {
        console.error('[InfiniteMemoryAdapter] Failed to create build summary', {
          buildId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Cleanup build state
      currentBuildState = null;
    },
  };
}

// ============================================================================
// Initialization Hook (called by external wiring)
// ============================================================================

export async function initializeInfiniteMemoryForBuild(
  buildId: string,
  _config: InfiniteMemoryLifecycleConfig
): Promise<void> {
  // Reset state
  currentBuildState = null;

  // Initialize memory instance
  const memory = new ATLASInfiniteMemory();

  // Store build state
  currentBuildState = {
    buildId,
    memory,
    taskNodeIds: new Map(),
    buildSummary: {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      agentsUsed: new Set(),
      totalDurationMs: 0,
    },
  };

  console.log('[InfiniteMemoryAdapter] Initialized for build', buildId);
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getCurrentBuildState(): BuildState | null {
  return currentBuildState;
}

export function getTaskNodeId(taskId: string): string | undefined {
  return currentBuildState?.taskNodeIds.get(taskId);
}

export function getAllTaskNodeIds(): Map<string, string> {
  return new Map(currentBuildState?.taskNodeIds ?? []);
}

export function resetBuildState(): void {
  currentBuildState = null;
}

export function getMemoryInstance(): ATLASInfiniteMemory | null {
  return currentBuildState?.memory ?? null;
}
