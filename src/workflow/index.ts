// Workflow Engine
// Spec: .nova/specs/grok-r24-immortal-omniverse.md (R24-02)

export {
  WorkflowEngine,
  type ExecutionContext,
  type NodeExecutor,
  type EngineOptions,
  type ExecutionResult,
} from './engine';

export {
  WorkflowVisualizer,
  type GraphvizOptions,
  type NodeStyle,
  type ExecutionTrace,
  type TraceNode,
  type TraceEdge,
} from './visualizer';

export {
  TemplateRegistry,
  createAgentTaskTemplate,
  createCodeReviewTemplate,
  createMultiAgentSwarmTemplate,
  createIterativeRefinementTemplate,
  createSequentialPipelineTemplate,
  getTemplateRegistry,
  resetTemplateRegistry,
} from './templates';

export type { TemplateMetadata } from './templates';

export {
  WorkflowNodeTypeSchema,
  WorkflowNodeSchema,
  WorkflowEdgeSchema,
  WorkflowSchema,
  WorkflowRunStateSchema,
  WorkflowRunSchema,
} from './types';

export type {
  WorkflowNodeType,
  WorkflowNode,
  WorkflowEdge,
  Workflow,
  WorkflowRunState,
  WorkflowRun,
  AgentNodeConfig,
  DecisionNodeConfig,
  ParallelNodeConfig,
  LoopNodeConfig,
  WaitNodeConfig,
  TriggerNodeConfig,
} from './types';
