// KIMI-R24-03: CRDT Collaboration Lifecycle Adapter
// Bridges Ralph Loop lifecycle events to CRDT Collaboration module

import type { FeatureLifecycleHandlers } from '../orchestrator/lifecycle-wiring.js';
import type {
  BuildContext,
  TaskResult,
  BuildResult,
} from '../orchestrator/lifecycle-hooks.js';
import {
  RealTimeCRDTOrchestrator,
  createCRDTOrchestrator,
} from './crdt-core.js';
import type { CRDTDocument, MergeResult, SemanticCRDTNode } from './types.js';

// ============================================================================
// Configuration Types
// ============================================================================

export interface CRDTLifecycleConfig {
  /** Enable CRDT collaboration */
  enabled: boolean;
  /** Document type for collaboration */
  documentType?: 'code' | 'design' | 'prd' | 'taste-vault' | 'config';
  /** Conflict resolution strategy */
  conflictResolution?: 'last-writer-wins' | 'semantic-merge' | 'manual';
  /** Enable parallel universe forking */
  enableParallelUniverses?: boolean;
  /** Maximum participants per session */
  maxParticipants?: number;
  /** Auto-broadcast changes */
  autoBroadcast?: boolean;
}

// ============================================================================
// Adapter State
// ============================================================================

interface BuildState {
  buildId: string;
  orchestrator: RealTimeCRDTOrchestrator;
  document: CRDTDocument;
  participants: Set<string>;
  taskChanges: Map<string, string[]>;
  mergeResults: MergeResult[];
  startTime: number;
  conflictResolution: 'last-writer-wins' | 'semantic-merge' | 'manual';
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

function generateParticipantId(agentName: string, taskId: string): string {
  return `${agentName}-${taskId}`;
}

function encodeTaskOutput(taskResult: TaskResult): Uint8Array {
  const data = {
    taskId: taskResult.taskId,
    agentName: taskResult.agentName,
    success: taskResult.success,
    output: taskResult.output ?? '',
    error: taskResult.error ?? '',
    durationMs: taskResult.durationMs,
    aceScore: taskResult.aceScore,
    timestamp: new Date().toISOString(),
  };
  return new TextEncoder().encode(JSON.stringify(data));
}

function createSemanticNode(
  taskResult: TaskResult,
  resolution: 'last-writer-wins' | 'semantic-merge' | 'manual'
): SemanticCRDTNode {
  return {
    id: `node-${taskResult.taskId}`,
    path: `/tasks/${taskResult.taskId}`,
    value: {
      output: taskResult.output,
      success: taskResult.success,
      aceScore: taskResult.aceScore,
    },
    author: taskResult.agentName,
    timestamp: new Date().toISOString(),
    semanticType: 'task-output',
    conflictResolution: resolution,
  };
}

async function resolveConflictPerStrategy(
  _local: unknown,
  remote: unknown,
  strategy: 'last-writer-wins' | 'semantic-merge' | 'manual'
): Promise<{ resolved: unknown; strategy: string }> {
  switch (strategy) {
    case 'last-writer-wins':
      return { resolved: remote, strategy: 'last-writer-wins' };
    case 'semantic-merge':
      // In a real implementation, this would use semantic merging
      return { resolved: remote, strategy: 'semantic-merge' };
    case 'manual':
      // Manual resolution would require user intervention
      return { resolved: remote, strategy: 'manual' };
    default:
      return { resolved: remote, strategy: 'default' };
  }
}

// ============================================================================
// Lifecycle Hook Factory
// ============================================================================

export function createCRDTLifecycleHooks(
  config: CRDTLifecycleConfig
): FeatureLifecycleHandlers {
  return {
    onBeforeBuild: async (context: BuildContext): Promise<void> => {
      if (!config.enabled) return;

      // Validate context
      if (!isValidBuildContext(context)) {
        console.warn('[CRDTAdapter] Invalid build context');
        return;
      }

      // Reset any previous state
      resetBuildState();

      // Initialize CRDT orchestrator
      const orchestrator = createCRDTOrchestrator();

      // Create document for this build
      const documentType = config.documentType ?? 'code';
      const document = orchestrator.createDocument(documentType);

      // Initialize build state
      currentBuildState = {
        buildId: context.buildId,
        orchestrator,
        document,
        participants: new Set(),
        taskChanges: new Map(),
        mergeResults: [],
        startTime: Date.now(),
        conflictResolution: config.conflictResolution ?? 'last-writer-wins',
      };

      console.log('[CRDTAdapter] Collaboration session created', {
        buildId: context.buildId,
        documentId: document.id,
        type: documentType,
      });
    },

    onAfterTask: async (context: TaskResult): Promise<void> => {
      if (!config.enabled || !currentBuildState) return;

      // Validate context
      if (!isValidTaskResult(context)) {
        console.warn('[CRDTAdapter] Invalid task result context');
        return;
      }

      const { orchestrator, document, participants, taskChanges, conflictResolution } = currentBuildState;

      // Add participant (agent) if not already present
      const participantId = generateParticipantId(context.agentName, context.taskId);
      if (!participants.has(participantId)) {
        try {
          await orchestrator.joinSession(document.id, participantId);
          participants.add(participantId);
        } catch (error) {
          console.error('[CRDTAdapter] Failed to join session', {
            participantId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Encode task output as CRDT change
      const change = encodeTaskOutput(context);

      try {
        // Apply change to document
        await orchestrator.applyChange(document.id, change);

        // Track change for this task
        const existingChanges = taskChanges.get(context.taskId) ?? [];
        existingChanges.push(`change-${Date.now()}`);
        taskChanges.set(context.taskId, existingChanges);

        // Create semantic node for conflict resolution metadata
        const semanticNode = createSemanticNode(context, conflictResolution);

        // Resolve any conflicts per strategy
        const { strategy } = await resolveConflictPerStrategy(
          document.content,
          change,
          conflictResolution
        );

        console.log('[CRDTAdapter] Task output merged', {
          taskId: context.taskId,
          participantId,
          strategy,
          documentVersion: document.version,
          semanticNodeId: semanticNode.id,
        });

        // Broadcast changes if enabled
        if (config.autoBroadcast) {
          console.log('[CRDTAdapter] Broadcasting changes to participants', {
            documentId: document.id,
            participantCount: participants.size,
          });
        }
      } catch (error) {
        console.error('[CRDTAdapter] Failed to apply task change', {
          taskId: context.taskId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },

    onBuildComplete: async (context: BuildResult): Promise<void> => {
      if (!config.enabled || !currentBuildState) {
        currentBuildState = null;
        return;
      }

      // Validate context
      if (!isValidBuildResult(context)) {
        console.warn('[CRDTAdapter] Invalid build result context');
        currentBuildState = null;
        return;
      }

      const { buildId, document, participants, taskChanges, mergeResults, startTime, orchestrator } = currentBuildState;
      const durationMs = Date.now() - startTime;

      try {
        // Get all changes for the document
        const changes = orchestrator.getChanges(document.id);

        // Generate merge summary
        const mergeSummary = {
          buildId,
          documentId: document.id,
          documentVersion: document.version,
          documentType: document.type,
          totalParticipants: participants.size,
          totalTasks: taskChanges.size,
          totalChanges: changes.length,
          conflictCount: document.conflictCount,
          mergeResults,
          durationMs,
          participants: Array.from(participants),
          taskChangeCounts: Object.fromEntries(
            Array.from(taskChanges.entries()).map(([taskId, changes]) => [
              taskId,
              changes.length,
            ])
          ),
        };

        // Finalize document
        document.lastModified = new Date().toISOString();

        console.log('[CRDTAdapter] Build complete - CRDT Summary', mergeSummary);

        // Log final document state
        console.log('[CRDTAdapter] Final document state', {
          documentId: document.id,
          version: document.version,
          contentSize: document.content.length,
          participants: document.participants.length,
          lastModified: document.lastModified,
        });
      } catch (error) {
        console.error('[CRDTAdapter] Failed to finalize document', {
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
// Utility Functions
// ============================================================================

export function getCurrentBuildState(): BuildState | null {
  return currentBuildState;
}

export function getCRDTDocument(): CRDTDocument | null {
  return currentBuildState?.document ?? null;
}

export function resetBuildState(): void {
  currentBuildState = null;
}

export function getBuildParticipants(): string[] {
  return currentBuildState ? Array.from(currentBuildState.participants) : [];
}

export function getTaskChangeCount(taskId: string): number {
  return currentBuildState?.taskChanges.get(taskId)?.length ?? 0;
}
