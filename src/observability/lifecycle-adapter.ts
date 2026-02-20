// KIMI-R26-05: Cinematic Observability Lifecycle Adapter
// Bridges Ralph Loop lifecycle events to CinematicObservability

import type { FeatureLifecycleHandlers } from '../orchestrator/lifecycle-wiring.js';
import type {
  BuildContext,
  TaskContext,
  TaskResult,
  HandoffContext,
  BuildResult,
} from '../orchestrator/lifecycle-hooks.js';
import {
  CinematicObservability,
  createCinematicObservability,
  resetCinematicObservability,
} from './cinematic-core.js';
import {
  BraintrustAdapter,
  createBraintrustAdapter,
  resetBraintrustAdapter,
} from './braintrust-adapter.js';
import {
  LangSmithBridge,
  createLangSmithBridge,
  resetLangSmithBridge,
} from './langsmith-bridge.js';
import type { CinematicConfig } from './types.js';
import { getGlobalEventBus } from '../orchestrator/event-bus.js';

// ============================================================================
// Configuration Types
// ============================================================================

export interface CinematicLifecycleConfig {
  /** Enable cinematic observability */
  enabled: boolean;
  /** Cinematic core configuration */
  cinematicConfig?: Partial<CinematicConfig>;
  /** Braintrust integration config */
  braintrust?: {
    enabled: boolean;
    apiKey: string;
    projectName: string;
    projectId: string;
  };
  /** LangSmith integration config */
  langsmith?: {
    enabled: boolean;
    apiKey: string;
    endpoint: string;
    projectName: string;
  };
  /** Quality thresholds for auto-evaluation */
  qualityThresholds?: {
    minAceScore: number;
    maxErrorRate: number;
  };
  /** Auto-remediation configuration */
  autoRemediation?: boolean;
}

// ============================================================================
// Adapter State
// ============================================================================

interface BuildState {
  buildId: string;
  rootSpanId: string;
  taskSpanMap: Map<string, string>;
  handoffCount: number;
  errorCount: number;
  startTime: number;
  cinematic: CinematicObservability;
  braintrust?: BraintrustAdapter;
  langsmith?: LangSmithBridge;
}

// Module-level state (isolated per build)
let currentBuildState: BuildState | null = null;

// ============================================================================
// Type Guards
// ============================================================================

function isValidBuildContext(context: unknown): context is BuildContext {
  return (
    typeof context === 'object' &&
    context !== null &&
    'buildId' in context &&
    'prdId' in context &&
    'prdName' in context &&
    typeof (context as Record<string, unknown>).buildId === 'string'
  );
}

function isValidTaskContext(context: unknown): context is TaskContext {
  return (
    typeof context === 'object' &&
    context !== null &&
    'taskId' in context &&
    'title' in context &&
    'agentName' in context &&
    typeof (context as Record<string, unknown>).taskId === 'string'
  );
}

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

function isValidHandoffContext(context: unknown): context is HandoffContext {
  return (
    typeof context === 'object' &&
    context !== null &&
    'fromAgent' in context &&
    'toAgent' in context &&
    'taskId' in context &&
    typeof (context as Record<string, unknown>).fromAgent === 'string'
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

function generateTraceId(buildId: string): string {
  return `build-${buildId}`;
}

// generateSpanId is available for future use when custom span IDs are needed
// function generateSpanId(): string {
//   return `span-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
// }

// ============================================================================
// Lifecycle Hook Factory
// ============================================================================

export function createCinematicObservabilityLifecycleHooks(
  config: CinematicLifecycleConfig
): FeatureLifecycleHandlers {
  return {
    onBeforeBuild: async (context: BuildContext): Promise<void> => {
      if (!config.enabled) return;

      // Validate context
      if (!isValidBuildContext(context)) {
        console.warn('[CinematicAdapter] Invalid build context');
        return;
      }

      // Reset any previous state
      resetCinematicObservability();
      resetBraintrustAdapter();
      resetLangSmithBridge();

      // Initialize CinematicObservability
      const cinematic = createCinematicObservability(config.cinematicConfig);

      // Initialize Braintrust adapter if configured
      let braintrust: BraintrustAdapter | undefined;
      if (config.braintrust?.enabled) {
        braintrust = createBraintrustAdapter({
          apiKey: config.braintrust.apiKey,
          projectName: config.braintrust.projectName,
          projectId: config.braintrust.projectId,
          debug: false,
        });
        await braintrust.initialize();
      }

      // Initialize LangSmith bridge if configured
      let langsmith: LangSmithBridge | undefined;
      if (config.langsmith?.enabled) {
        langsmith = createLangSmithBridge({
          apiKey: config.langsmith.apiKey,
          endpoint: config.langsmith.endpoint,
          projectName: config.langsmith.projectName,
          sampleRate: 1.0,
        });
        await langsmith.initialize();
      }

      // Create root span for the build
      const traceId = generateTraceId(context.buildId);
      const rootSpanId = cinematic.recordSpan({
        traceId,
        name: `build-${context.prdName}`,
        agentId: 'ralph-loop',
        type: 'agent-call',
        startTime: new Date().toISOString(),
        metadata: {
          buildId: context.buildId,
          prdId: context.prdId,
          prdName: context.prdName,
          options: context.options,
        },
        status: 'running',
      });

      // Store build state
      currentBuildState = {
        buildId: context.buildId,
        rootSpanId,
        taskSpanMap: new Map(),
        handoffCount: 0,
        errorCount: 0,
        startTime: Date.now(),
        cinematic,
        braintrust,
        langsmith,
      };
    },

    onBeforeTask: async (context: TaskContext): Promise<void> => {
      if (!config.enabled || !currentBuildState) return;

      // Validate context
      if (!isValidTaskContext(context)) {
        console.warn('[CinematicAdapter] Invalid task context');
        return;
      }

      const { cinematic } = currentBuildState;
      const traceId = generateTraceId(currentBuildState.buildId);

      // Create task span as child of root
      const taskSpanId = cinematic.recordSpan({
        traceId,
        parentId: currentBuildState.rootSpanId,
        name: context.title,
        agentId: context.agentName,
        type: 'agent-call',
        startTime: new Date().toISOString(),
        metadata: {
          taskId: context.taskId,
          title: context.title,
          dependencies: context.dependencies,
        },
        status: 'running',
      });

      // Store task span mapping
      currentBuildState.taskSpanMap.set(context.taskId, taskSpanId);

      // Emit span:created event to event bus
      try {
        getGlobalEventBus().emit('span:created', {
          spanId: taskSpanId,
          parentSpanId: currentBuildState.rootSpanId,
          operationName: context.title,
          moduleName: 'observability',
        }).catch(() => { /* event bus emission fire-and-forget */ });
      } catch (_eventBusError: unknown) {
        // Event bus failure must not crash the adapter
      }

      // Export to LangSmith if configured
      if (currentBuildState.langsmith) {
        const span = cinematic.getSpan(taskSpanId);
        if (span) {
          await currentBuildState.langsmith.exportSpan(span);
        }
      }
    },

    onAfterTask: async (context: TaskResult): Promise<void> => {
      if (!config.enabled || !currentBuildState) return;

      // Validate context
      if (!isValidTaskResult(context)) {
        console.warn('[CinematicAdapter] Invalid task result');
        return;
      }

      const { cinematic } = currentBuildState;
      const taskSpanId = currentBuildState.taskSpanMap.get(context.taskId);

      if (!taskSpanId) {
        console.warn(`[CinematicAdapter] No span found for task ${context.taskId}`);
        return;
      }

      // End the task span
      const status = context.success ? 'success' : 'failure';
      cinematic.endSpan(taskSpanId, {
        status,
        metadata: {
          durationMs: context.durationMs,
          output: context.output,
          aceScore: context.aceScore,
        },
      });

      // Check quality thresholds if configured
      if (config.qualityThresholds && context.aceScore !== undefined) {
        if (context.aceScore < config.qualityThresholds.minAceScore) {
          console.warn(
            `[CinematicAdapter] Task ${context.taskId} ACE score ${context.aceScore} below threshold ${config.qualityThresholds.minAceScore}`
          );
        }
      }

      // Update LangSmith if configured
      if (currentBuildState.langsmith) {
        const span = cinematic.getSpan(taskSpanId);
        if (span) {
          await currentBuildState.langsmith.completeSpan(span);
        }
      }
    },

    onTaskError: async (context: TaskResult): Promise<void> => {
      if (!config.enabled || !currentBuildState) return;

      // Validate context
      if (!isValidTaskResult(context)) {
        console.warn('[CinematicAdapter] Invalid task error context');
        return;
      }

      const { cinematic } = currentBuildState;
      const taskSpanId = currentBuildState.taskSpanMap.get(context.taskId);

      if (taskSpanId) {
        // End span with failure status
        cinematic.endSpan(taskSpanId, {
          status: 'failure',
          metadata: {
            error: context.error,
            durationMs: context.durationMs,
          },
        });

        // Update LangSmith if configured
        if (currentBuildState.langsmith) {
          const span = cinematic.getSpan(taskSpanId);
          if (span) {
            await currentBuildState.langsmith.completeSpan(span);
          }
        }
      }

      // Increment error count
      currentBuildState.errorCount++;

      // Check if auto-remediation should trigger
      if (config.autoRemediation && config.qualityThresholds) {
        const errorRate = currentBuildState.errorCount / currentBuildState.taskSpanMap.size;
        if (errorRate > config.qualityThresholds.maxErrorRate) {
          console.error(
            `[CinematicAdapter] Error rate ${errorRate.toFixed(2)} exceeds threshold ${config.qualityThresholds.maxErrorRate}`
          );
        }
      }
    },

    onHandoff: async (context: HandoffContext): Promise<void> => {
      if (!config.enabled || !currentBuildState) return;

      // Validate context
      if (!isValidHandoffContext(context)) {
        console.warn('[CinematicAdapter] Invalid handoff context');
        return;
      }

      const { cinematic } = currentBuildState;
      const traceId = generateTraceId(currentBuildState.buildId);

      // Create handoff span
      const handoffSpanId = cinematic.recordSpan({
        traceId,
        parentId: currentBuildState.rootSpanId,
        name: `handoff-${context.fromAgent}-to-${context.toAgent}`,
        agentId: context.fromAgent,
        type: 'user-interaction',
        startTime: new Date().toISOString(),
        metadata: {
          fromAgent: context.fromAgent,
          toAgent: context.toAgent,
          taskId: context.taskId,
          payloadSize: JSON.stringify(context.payload).length,
        },
        status: 'success',
      });

      // End handoff span immediately (it's an event, not a duration)
      cinematic.endSpan(handoffSpanId, {
        status: 'success',
        metadata: {
          handoffNumber: ++currentBuildState.handoffCount,
        },
      });

      // Export to LangSmith if configured
      if (currentBuildState.langsmith) {
        const span = cinematic.getSpan(handoffSpanId);
        if (span) {
          await currentBuildState.langsmith.exportSpan(span);
        }
      }
    },

    onBuildComplete: async (context: BuildResult): Promise<void> => {
      if (!config.enabled || !currentBuildState) return;

      // Validate context
      if (!isValidBuildResult(context)) {
        console.warn('[CinematicAdapter] Invalid build result context');
        return;
      }

      const { cinematic } = currentBuildState;
      const durationMs = Date.now() - currentBuildState.startTime;

      // End root span
      const buildStatus = context.failedTasks === 0 ? 'success' : 'failure';
      cinematic.endSpan(currentBuildState.rootSpanId, {
        status: buildStatus,
        metadata: {
          totalTasks: context.totalTasks,
          successfulTasks: context.successfulTasks,
          failedTasks: context.failedTasks,
          totalDurationMs: durationMs,
          averageAceScore: context.averageAceScore,
          handoffCount: currentBuildState.handoffCount,
          errorCount: currentBuildState.errorCount,
        },
      });

      // Flush traces to LangSmith if configured
      if (currentBuildState.langsmith) {
        const traceId = generateTraceId(currentBuildState.buildId);
        const spans = cinematic.getTraceTree(traceId);
        await currentBuildState.langsmith.exportSpans(spans);
        await currentBuildState.langsmith.flush();
      }

      // Generate build quality report
      const stats = cinematic.getStats();
      const traceId = generateTraceId(currentBuildState.buildId);
      const traceTree = cinematic.getHierarchicalTrace(traceId);

      console.log('[CinematicAdapter] Build Complete Report:', {
        buildId: context.buildId,
        totalSpans: stats.totalSpans,
        completedSpans: stats.completedSpans,
        failedSpans: stats.failedSpans,
        remediationCount: stats.remediationCount,
        traceTree: traceTree.length,
      });

      // Cleanup
      currentBuildState = null;
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getCurrentBuildState(): BuildState | null {
  return currentBuildState;
}

export function resetBuildState(): void {
  currentBuildState = null;
  resetCinematicObservability();
  resetBraintrustAdapter();
  resetLangSmithBridge();
}
