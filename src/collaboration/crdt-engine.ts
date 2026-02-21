// CRDT Engine - Y.js-based collaborative editing engine
// Spec: .nova/specs/grok-r24-immortal-omniverse.md (R24-03)

// ═══════════════════════════════════════════════════════════════════════════════
// Type Definitions
// ═══════════════════════════════════════════════════════════════════════════════

export type CRDTValue =
  | string
  | number
  | boolean
  | null
  | CRDTValue[]
  | { [key: string]: CRDTValue };

export interface CRDTChange {
  type: 'insert' | 'delete' | 'update' | 'move';
  path: string;
  value?: CRDTValue;
  oldValue?: CRDTValue;
  timestamp: number;
  clientId: string;
  operationId: string;
}

export interface CRDTDocument {
  id: string;
  content: Map<string, CRDTValue>;
  clock: number;
  clientId: string;
}

export interface PresenceInfo {
  clientId: string;
  userName: string;
  cursor?: { path: string; offset: number };
  selection?: { start: { path: string; offset: number }; end: { path: string; offset: number } };
  color: string;
  lastSeen: number;
}

export interface SyncMessage {
  type: 'update' | 'awareness' | 'sync' | 'init';
  documentId: string;
  changes?: CRDTChange[];
  state?: Record<string, CRDTValue>;
  presence?: PresenceInfo;
  timestamp: number;
  clientId: string;
}

export interface SyncOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  syncIntervalMs?: number;
  timeoutMs?: number;
}

export interface CRDTOperation {
  id: string;
  timestamp: number;
  clientId: string;
  type: string;
  payload: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Simple CRDT Implementation (LWW - Last Write Wins)
// ═══════════════════════════════════════════════════════════════════════════════

export class LWWRegister<T extends CRDTValue> {
  private value: T;
  private timestamp: number;
  private clientId: string;

  constructor(initialValue: T, clientId: string) {
    this.value = initialValue;
    this.timestamp = Date.now();
    this.clientId = clientId;
  }

  get(): T {
    return this.value;
  }

  set(newValue: T, clientId: string): void {
    const now = Date.now();
    // LWW: Allow if:
    // 1. Same client (always allow client to update its own value)
    // 2. Newer timestamp
    // 3. Same timestamp but higher clientId (deterministic tie-break)
    if (
      clientId === this.clientId ||
      now > this.timestamp ||
      (now === this.timestamp && clientId > this.clientId)
    ) {
      this.value = newValue;
      this.timestamp = now;
      this.clientId = clientId;
    }
  }

  merge(other: LWWRegister<T>): void {
    if (
      other.timestamp > this.timestamp ||
      (other.timestamp === this.timestamp && other.clientId > this.clientId)
    ) {
      this.value = other.value;
      this.timestamp = other.timestamp;
      this.clientId = other.clientId;
    }
  }

  getState(): { value: T; timestamp: number; clientId: string } {
    return {
      value: this.value,
      timestamp: this.timestamp,
      clientId: this.clientId,
    };
  }

  static fromState<T extends CRDTValue>(state: {
    value: T;
    timestamp: number;
    clientId: string;
  }): LWWRegister<T> {
    const reg = new LWWRegister<T>(state.value, state.clientId);
    // Use Object.assign to set private fields
    Object.assign(reg, { timestamp: state.timestamp });
    return reg;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRDT Document Manager
// ═══════════════════════════════════════════════════════════════════════════════

export class CRDTDocumentManager {
  private documents: Map<string, Map<string, LWWRegister<CRDTValue>>> = new Map();
  private clientId: string;
  private changeHandlers: Map<string, ((changes: CRDTChange[]) => void)[]> =
    new Map();

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  /**
   * Create or get a document
   */
  getOrCreateDocument(documentId: string): Map<string, LWWRegister<CRDTValue>> {
    if (!this.documents.has(documentId)) {
      this.documents.set(documentId, new Map());
    }
    return this.documents.get(documentId)!;
  }

  /**
   * Get document state as plain object
   */
  getDocumentState(documentId: string): Record<string, CRDTValue> {
    const doc = this.documents.get(documentId);
    if (!doc) return {};

    const state: Record<string, CRDTValue> = {};
    for (const [key, register] of doc) {
      state[key] = register.get();
    }
    return state;
  }

  /**
   * Set a value in the document
   */
  setValue(
    documentId: string,
    key: string,
    value: CRDTValue
  ): CRDTChange {
    const doc = this.getOrCreateDocument(documentId);

    let register = doc.get(key);
    const oldValue = register?.get();

    if (!register) {
      register = new LWWRegister(value, this.clientId);
      doc.set(key, register);
    } else {
      register.set(value, this.clientId);
    }

    const change: CRDTChange = {
      type: oldValue === undefined ? 'insert' : 'update',
      path: key,
      value,
      oldValue,
      timestamp: Date.now(),
      clientId: this.clientId,
      operationId: this.generateOperationId(),
    };

    this.emitChanges(documentId, [change]);
    return change;
  }

  /**
   * Get a value from the document
   */
  getValue(documentId: string, key: string): CRDTValue | undefined {
    const doc = this.documents.get(documentId);
    if (!doc) return undefined;
    return doc.get(key)?.get();
  }

  /**
   * Delete a value from the document
   */
  deleteValue(documentId: string, key: string): CRDTChange | null {
    const doc = this.documents.get(documentId);
    if (!doc) return null;

    const register = doc.get(key);
    if (!register) return null;

    const oldValue = register.get();
    // Set to null to mark as deleted
    register.set(null, this.clientId);

    const change: CRDTChange = {
      type: 'delete',
      path: key,
      oldValue,
      timestamp: Date.now(),
      clientId: this.clientId,
      operationId: this.generateOperationId(),
    };

    this.emitChanges(documentId, [change]);
    return change;
  }

  /**
   * Apply remote changes
   */
  applyChanges(documentId: string, changes: CRDTChange[]): void {
    const doc = this.getOrCreateDocument(documentId);

    for (const change of changes) {
      let register = doc.get(change.path);

      if (change.type === 'delete') {
        if (register) {
          register.set(null, change.clientId);
        }
      } else {
        // insert or update
        if (!register) {
          register = new LWWRegister(change.value!, change.clientId);
          doc.set(change.path, register);
        } else {
          register.set(change.value!, change.clientId);
        }
      }
    }

    this.emitChanges(documentId, changes);
  }

  /**
   * Merge entire document state
   */
  mergeState(
    documentId: string,
    state: Record<string, { value: CRDTValue; timestamp: number; clientId: string }>
  ): void {
    const doc = this.getOrCreateDocument(documentId);

    for (const [key, regState] of Object.entries(state)) {
      let register = doc.get(key);
      const incoming = LWWRegister.fromState(regState);

      if (!register) {
        doc.set(key, incoming);
      } else {
        register.merge(incoming);
      }
    }
  }

  /**
   * Subscribe to changes
   */
  onChanges(
    documentId: string,
    handler: (changes: CRDTChange[]) => void
  ): () => void {
    if (!this.changeHandlers.has(documentId)) {
      this.changeHandlers.set(documentId, []);
    }
    this.changeHandlers.get(documentId)!.push(handler);

    return () => {
      const handlers = this.changeHandlers.get(documentId);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx !== -1) handlers.splice(idx, 1);
      }
    };
  }

  /**
   * Emit changes to subscribers
   */
  private emitChanges(documentId: string, changes: CRDTChange[]): void {
    const handlers = this.changeHandlers.get(documentId);
    if (handlers) {
      handlers.forEach(h => h(changes));
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `${this.clientId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  /**
   * Delete a document
   */
  deleteDocument(documentId: string): boolean {
    this.changeHandlers.delete(documentId);
    return this.documents.delete(documentId);
  }

  /**
   * Get all document IDs
   */
  getDocumentIds(): string[] {
    return Array.from(this.documents.keys());
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Presence Manager
// ═══════════════════════════════════════════════════════════════════════════════

export class PresenceManager {
  private presence: Map<string, PresenceInfo> = new Map();
  private handlers: ((presence: PresenceInfo[]) => void)[] = [];
  private clientId: string;
  private localPresence: PresenceInfo;

  constructor(clientId: string, userName: string, color: string) {
    this.clientId = clientId;
    this.localPresence = {
      clientId,
      userName,
      color,
      lastSeen: Date.now(),
    };
  }

  /**
   * Update local presence
   */
  updatePresence(update: Partial<PresenceInfo>): void {
    this.localPresence = {
      ...this.localPresence,
      ...update,
      clientId: this.clientId,
      lastSeen: Date.now(),
    };
    this.emitPresence();
  }

  /**
   * Set cursor position
   */
  setCursor(path: string, offset: number): void {
    this.updatePresence({ cursor: { path, offset } });
  }

  /**
   * Set selection
   */
  setSelection(
    start: { path: string; offset: number },
    end: { path: string; offset: number }
  ): void {
    this.updatePresence({ selection: { start, end } });
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.updatePresence({ selection: undefined });
  }

  /**
   * Receive remote presence update
   */
  receivePresence(info: PresenceInfo): void {
    // Don't override local presence
    if (info.clientId === this.clientId) return;

    this.presence.set(info.clientId, {
      ...info,
      lastSeen: Date.now(),
    });

    this.emitPresence();
  }

  /**
   * Get all active presence info
   */
  getPresence(): PresenceInfo[] {
    const now = Date.now();
    const timeout = 30000; // 30 seconds

    // Filter out stale presence
    const active: PresenceInfo[] = [];
    for (const [clientId, info] of this.presence) {
      if (now - info.lastSeen < timeout) {
        active.push(info);
      } else {
        this.presence.delete(clientId);
      }
    }

    // Include local presence
    return [this.localPresence, ...active];
  }

  /**
   * Subscribe to presence updates
   */
  onPresenceChange(handler: (presence: PresenceInfo[]) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx !== -1) this.handlers.splice(idx, 1);
    };
  }

  /**
   * Emit presence to subscribers
   */
  private emitPresence(): void {
    const presence = this.getPresence();
    this.handlers.forEach(h => h(presence));
  }

  /**
   * Get local presence
   */
  getLocalPresence(): PresenceInfo {
    return this.localPresence;
  }
}
