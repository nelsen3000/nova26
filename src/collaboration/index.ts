// Real-time CRDT Collaboration — KIMI-R24-03

export type {
  CRDTDocument,
  SemanticCRDTNode,
  CRDTSession,
  CRDTChange,
  ParallelUniverse,
  MergeResult,
} from './types.js';

export {
  RealTimeCRDTOrchestrator,
  createCRDTOrchestrator,
} from './crdt-core.js';

export {
  createCRDTLifecycleHooks,
  getCurrentBuildState,
  getCRDTDocument,
  resetBuildState,
  getBuildParticipants,
  getTaskChangeCount,
  type CRDTLifecycleConfig,
} from './lifecycle-adapter.js';
