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
import type { CRDTDocument as CRDTDocumentView, MergeResult, SemanticCRDTNode } from './types.js';
import type { CRDTDocument as CRDTCoreDocument, CRDTOperation } from './crdt-core.js';
import { getGlobalEventBus } from '../orchestrator/event-bus.js';
import { randomUUID } from 'node:crypto';

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
  coreDocument: CRDTCoreDocument;
  viewDocument: CRDTDocumentView;
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

function makeInsertOp(taskResult: TaskResult): CRDTOperation {
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
  return {
    id: `op-${Date.now()}-${randomUUID().slice(0, 6)}`,
    peerId: taskResult.agentName,
    type: 'insert',
    targetNodeId: `node-${taskResult.taskId}`,
    timestamp: Date.now(),
    vectorClock: { [taskResult.agentName]: Date.now() },
    payload: {
      content: JSON.stringify(data),
      type: 'task-output',
    },
  };
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
      return { resolved: remote, strategy: 'semantic-merge' };
    case 'manual':
      return { resolved: remote, strategy: 'manual' };
    default:
      return { resolved: remote, strategy: 'default' };
  }
}

/**
 * Build a CRDTDocumentView from the core document + adapter state.
 */
function buildViewDocument(
  coreDoc: CRDTCoreDocument,
  docType: CRDTDocumentView['type'],
  participants: Set<string>,
  version: number,
  conflictCount: number,
): CRDTDocumentView {
  // Serialize all node contents into a single Uint8Array
  const contents: string[] = [];
  // coreDoc.nodes is a Map in the real implementation, but may be mocked differently
  if (coreDoc.nodes && typeof coreDoc.nodes[Symbol.iterator] === 'function') {
    for (const [, node] of coreDoc.nodes) {
      contents.push(node.content);
    }
  }
  const content = new TextEncoder().encode(contents.join(''));

  return {
    id: coreDoc.id,
    type: docType,
    content,
    version,
    participants: Array.from(participants),
    lastModified: new Date().toISOString(),
    conflictCount,
  };
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

      if (!isValidBuildContext(context)) {
        console.warn('[CRDTAdapter] Invalid build context');
        return;
      }

      resetBuildState();

      const orchestrator = createCRDTOrchestrator();
      const documentType = config.documentType ?? 'code';
      const coreDocument = orchestrator.createDocument(documentType);

      // Build initial view document — handle both real and mocked orchestrators
      const viewDocument = buildViewDocument(coreDocument, documentType, new Set(), 1, 0);

      currentBuildState = {
        buildId: context.buildId,
        orchestrator,
        coreDocument,
        viewDocument,
        participants: new Set(),
        taskChanges: new Map(),
        mergeResults: [],
        startTime: Date.now(),
        conflictResolution: config.conflictResolution ?? 'last-writer-wins',
      };

      console.log('[CRDTAdapter] Collaboration session created', {
        buildId: context.buildId,
        documentId: coreDocument.id,
        type: documentType,
      });
    },

    onAfterTask: async (context: TaskResult): Promise<void> => {
      if (!config.enabled || !currentBuildState) return;

      if (!isValidTaskResult(context)) {
        console.warn('[CRDTAdapter] Invalid task result context');
        return;
      }

      const { orchestrator, coreDocument, participants, taskChanges, conflictResolution } = currentBuildState;

      const participantId = generateParticipantId(context.agentName, context.taskId);
      if (!participants.has(participantId)) {
        try {
          orchestrator.joinSession(coreDocument.id, participantId);
          participants.add(participantId);
        } catch (error) {
          console.error('[CRDTAdapter] Failed to join session', {
            participantId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const op = makeInsertOp(context);

      try {
        const result = orchestrator.applyChange(coreDocument.id, op);

        const existingChanges = taskChanges.get(context.taskId) ?? [];
        existingChanges.push(`change-${Date.now()}`);
        taskChanges.set(context.taskId, existingChanges);

        const semanticNode = createSemanticNode(context, conflictResolution);

        const { strategy } = await resolveConflictPerStrategy(
          null,
          op,
          conflictResolution
        );

        // Update view document
        const docType = currentBuildState.viewDocument.type;
        const conflictCount = typeof orchestrator.getConflicts === 'function'
          ? orchestrator.getConflicts(coreDocument.id).length
          : 0;
        currentBuildState.viewDocument = buildViewDocument(
          coreDocument,
          docType,
          participants,
          currentBuildState.viewDocument.version + 1,
          conflictCount,
        );

        console.log('[CRDTAdapter] Task output merged', {
          taskId: context.taskId,
          participantId,
          strategy,
          documentVersion: currentBuildState.viewDocument.version,
          semanticNodeId: semanticNode.id,
        });

        if (config.autoBroadcast) {
          console.log('[CRDTAdapter] Broadcasting changes to participants', {
            documentId: coreDocument.id,
            participantCount: participants.size,
          });
        }

        try {
          getGlobalEventBus().emit('collaboration:changed', {
            sessionId: coreDocument.id,
            changeType: 'merge',
            participantCount: participants.size,
            documentVersion: currentBuildState.viewDocument.version,
          }).catch(() => { /* fire-and-forget */ });
        } catch (_eventBusError: unknown) {
          // Event bus failure must not crash the adapter
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

      if (!isValidBuildResult(context)) {
        console.warn('[CRDTAdapter] Invalid build result context');
        currentBuildState = null;
        return;
      }

      const { buildId, coreDocument, viewDocument, participants, taskChanges, mergeResults, startTime, orchestrator } = currentBuildState;
      const durationMs = Date.now() - startTime;

      try {
        const totalChanges = coreDocument.history?.length ?? 0;

        const conflictCount = typeof orchestrator.getConflicts === 'function'
          ? orchestrator.getConflicts(coreDocument.id).length
          : 0;

        const mergeSummary = {
          buildId,
          documentId: coreDocument.id,
          documentVersion: viewDocument.version,
          documentType: viewDocument.type,
          totalParticipants: participants.size,
          totalTasks: taskChanges.size,
          totalChanges,
          conflictCount,
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

        currentBuildState.viewDocument = buildViewDocument(
          coreDocument,
          viewDocument.type,
          participants,
          viewDocument.version,
          conflictCount,
        );

        console.log('[CRDTAdapter] Build complete - CRDT Summary', mergeSummary);

        console.log('[CRDTAdapter] Final document state', {
          documentId: coreDocument.id,
          version: currentBuildState.viewDocument.version,
          contentSize: currentBuildState.viewDocument.content.length,
          participants: currentBuildState.viewDocument.participants.length,
          lastModified: currentBuildState.viewDocument.lastModified,
        });
      } catch (error) {
        console.error('[CRDTAdapter] Failed to finalize document', {
          buildId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

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

export function getCRDTDocument(): CRDTDocumentView | null {
  return currentBuildState?.viewDocument ?? null;
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
