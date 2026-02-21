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
