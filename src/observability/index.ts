// KIMI-R23-05: Cinematic Observability & Eval Suite
// Nova26 observability module - exports all tracing and evaluation capabilities

// ============================================================================
// Legacy Exports (existing tracer)
// ============================================================================

export { NovaTracer, getTracer, type TraceHandle } from './tracer.js';
export type { CouncilVote, CouncilDecision } from './tracer.js';

// ============================================================================
// Core Types (KIMI-R23-05)
// ============================================================================

export type {
  // Span types
  CinematicSpan,
  SpanInput,
  SpanType,
  SpanStatus,
  
  // Evaluator types
  EvaluatorConfig,
  EvalDatasetEntry,
  EvalResult,
  
  // Eval suite types
  EvalSuite,
  EvalSuiteResult,
  
  // Remediation types
  RemediationAction,
  RemediationConfig,
  RemediationEvent,
  
  // Integration types
  BraintrustDataset,
  LangSmithTrace,
  
  // Configuration types
  CinematicConfig,
  DEFAULT_CINEMATIC_CONFIG,
} from './types.js';

// ============================================================================
// Cinematic Core (KIMI-R23-05)
// ============================================================================

export {
  CinematicObservability,
  getCinematicObservability,
  resetCinematicObservability,
  createCinematicObservability,
} from './cinematic-core.js';

// ============================================================================
// Braintrust Adapter (KIMI-R23-05)
// ============================================================================

export {
  BraintrustAdapter,
  getBraintrustAdapter,
  resetBraintrustAdapter,
  createBraintrustAdapter,
} from './braintrust-adapter.js';

export type {
  BraintrustConfig,
  BraintrustExperimentConfig,
  BraintrustExperimentResult,
} from './braintrust-adapter.js';

// ============================================================================
// LangSmith Bridge (KIMI-R23-05)
// ============================================================================

export {
  LangSmithBridge,
  getLangSmithBridge,
  resetLangSmithBridge,
  createLangSmithBridge,
} from './langsmith-bridge.js';

export type {
  LangSmithConfig,
  LangSmithRunInput,
  LangSmithFeedback,
} from './langsmith-bridge.js';

// ============================================================================
// Infrastructure Bridge (S3-26)
// ============================================================================

export {
  createInfrastructureBridge,
} from './infrastructure-bridge.js';

export type {
  InfrastructureBridgeOptions,
  InfrastructureBridge,
} from './infrastructure-bridge.js';
