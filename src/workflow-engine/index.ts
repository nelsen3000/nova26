// Visual Workflow Engine - Public Exports (KIMI-R23-01)

// ============================================================================
// Core Types
// ============================================================================

export type {
  // Core workflow types
  PersistentWorkflow,
  VisualNode,
  WorkflowEdge,
  WorkflowState,
  Checkpoint,
  TemporalEvent,
  
  // Node configuration
  LangGraphNodeConfig,
  RetryPolicy,
  NodePosition,
  
  // Execution types
  NodeExecutionContext,
  NodeExecutionResult,
  NodeExecutionError,
  
  // Engine configuration
  WorkflowEngineOptions,
  StorageAdapter,
  
  // Statistics and events
  WorkflowStats,
  WorkflowEngineEvent,
  WorkflowEventHandler,
  
  // Enums as const maps
  TaskToNodeStatusMap,
} from './types.js';

export type {
  VisualNodeType,
  VisualNodeStatus,
  TemporalEventType,
  WorkflowGlobalStatus,
} from './types.js';

// ============================================================================
// Main Engine
// ============================================================================

export {
  RalphVisualWorkflowEngine,
  WorkflowEngineError,
} from './ralph-visual-engine.js';

// ============================================================================
// RalphLoop Adapter
// ============================================================================

export {
  RalphLoopVisualAdapter,
  createRalphLoopAdapter,
  prdToVisualWorkflow,
} from './ralph-loop-visual-adapter.js';

export type {
  RalphLoopAdapterConfig,
  TaskStatistics,
} from './ralph-loop-visual-adapter.js';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';
export const ENGINE_NAME = 'RalphVisualWorkflowEngine';

// ============================================================================
// Factory Functions
// ============================================================================

import type { PersistentWorkflow, WorkflowEngineOptions } from './types.js';
import { RalphVisualWorkflowEngine } from './ralph-visual-engine.js';
import { RalphLoopVisualAdapter } from './ralph-loop-visual-adapter.js';
import type { PRD } from '../types/index.js';

/**
 * Create a new visual workflow engine instance
 */
export function createWorkflowEngine(
  workflow: PersistentWorkflow,
  options?: WorkflowEngineOptions
): RalphVisualWorkflowEngine {
  return new RalphVisualWorkflowEngine(workflow, options);
}

/**
 * Create a visual workflow engine from a PRD
 */
export function createEngineFromPRD(prd: PRD): RalphVisualWorkflowEngine {
  const adapter = new RalphLoopVisualAdapter();
  return adapter.adapt(prd, undefined, undefined);
}

/**
 * Quick start helper - create and start a workflow in one call
 */
export async function runWorkflow(
  workflow: PersistentWorkflow,
  options?: WorkflowEngineOptions
): Promise<RalphVisualWorkflowEngine> {
  const engine = createWorkflowEngine(workflow, options);
  await engine.startWorkflow();
  return engine;
}
