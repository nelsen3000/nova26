// CRDT Collaboration Engine
// Spec: .nova/specs/grok-r24-immortal-omniverse.md (R24-03)

export {
  LWWRegister,
  CRDTDocumentManager,
  PresenceManager,
} from './crdt-engine';

export type {
  CRDTValue,
  CRDTChange,
  CRDTDocument,
  PresenceInfo,
  SyncMessage,
  SyncOptions,
  CRDTOperation,
} from './crdt-engine';

export {
  SyncManager,
  InMemoryTransport,
} from './sync-manager';

export type {
  ConnectionState,
  SyncStats,
  SyncConflict,
  Transport,
} from './sync-manager';

// R24-03: Semantic CRDT Core
export {
  RealTimeCRDTOrchestrator,
  DefaultConflictResolver,
} from './crdt-core.js';

export type {
  VectorClock,
  CRDTOperation as SemanticCRDTOperation,
  SemanticCRDTNode,
  ConflictMarker,
  CRDTDocument as SemanticCRDTDocument,
  CollaborationSession,
  ApplyChangeResult,
  ForkResult,
  OperationType,
  NodeType,
  ConflictResolutionStrategy,
  ConflictResolver,
} from './crdt-core.js';

// R24-03: Yjs/Automerge Bridge
export {
  yjsChangeToCRDTOp,
  automergePatchToCRDTOp,
  crdtOpToYjsChange,
  crdtOpToAutomergePatch,
  SyncProtocol,
} from './yjs-automerge-bridge.js';

export type {
  YjsChange,
  AutomergePatch,
} from './yjs-automerge-bridge.js';

// R24-03: Semantic Resolver
export {
  SemanticConflictResolver,
  createSemanticResolver,
  getStrategyPriority,
} from './semantic-resolver.js';

export type {
  SemanticContext,
  ResolutionCandidate,
  SemanticResolutionResult,
  TasteVaultPreferences,
} from './semantic-resolver.js';
