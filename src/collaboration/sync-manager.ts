// Sync Manager - Handles sync strategy, conflict resolution, and reconnection
// Spec: .nova/specs/grok-r24-immortal-omniverse.md (R24-03)

import {
  type SyncMessage,
  type SyncOptions,
  type CRDTDocumentManager,
  type PresenceManager,
} from './crdt-engine';

// ═══════════════════════════════════════════════════════════════════════════════
// Type Definitions
// ═══════════════════════════════════════════════════════════════════════════════

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SyncStats {
  messagesSent: number;
  messagesReceived: number;
  bytesTransferred: number;
  lastSyncAt: number | null;
  latencyMs: number;
  conflictsResolved: number;
}

export interface SyncConflict {
  path: string;
  localValue: unknown;
  remoteValue: unknown;
  resolution: 'local' | 'remote' | 'merge';
}

export interface Transport {
  send(message: SyncMessage): Promise<void>;
  onMessage(handler: (message: SyncMessage) => void): () => void;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getState(): ConnectionState;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sync Manager
// ═══════════════════════════════════════════════════════════════════════════════

export class SyncManager {
  private transport: Transport;
  private documentManager: CRDTDocumentManager;
  private presenceManager: PresenceManager;
  private options: Required<SyncOptions>;
  private stats: SyncStats = {
    messagesSent: 0,
    messagesReceived: 0,
    bytesTransferred: 0,
    lastSyncAt: null,
    latencyMs: 0,
    conflictsResolved: 0,
  };
  private state: ConnectionState = 'disconnected';
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private pendingMessages: SyncMessage[] = [];
  private documentId: string;
  private clientId: string;
  private stateHandlers: ((state: ConnectionState) => void)[] = [];
  private messageUnsub: (() => void) | null = null;

  constructor(
    documentId: string,
    clientId: string,
    transport: Transport,
    documentManager: CRDTDocumentManager,
    presenceManager: PresenceManager,
    options: SyncOptions = {}
  ) {
    this.documentId = documentId;
    this.clientId = clientId;
    this.transport = transport;
    this.documentManager = documentManager;
    this.presenceManager = presenceManager;
    this.options = {
      maxRetries: 5,
      retryDelayMs: 1000,
      syncIntervalMs: 5000,
      timeoutMs: 30000,
      ...options,
    };
  }

  /**
   * Connect and start syncing
   */
  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.setState('connecting');

    try {
      await this.transport.connect();
      this.setState('connected');
      this.retryCount = 0;

      // Subscribe to messages
      this.messageUnsub = this.transport.onMessage(msg =>
        this.handleMessage(msg)
      );

      // Send initial sync
      await this.requestSync();

      // Start periodic sync
      this.startPeriodicSync();

      // Flush pending messages
      await this.flushPendingMessages();
    } catch (error) {
      this.setState('error');
      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * Disconnect and stop syncing
   */
  async disconnect(): Promise<void> {
    this.stopPeriodicSync();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.messageUnsub) {
      this.messageUnsub();
      this.messageUnsub = null;
    }

    await this.transport.disconnect();
    this.setState('disconnected');
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: SyncMessage): void {
    this.stats.messagesReceived++;
    this.stats.bytesTransferred += JSON.stringify(message).length;

    switch (message.type) {
      case 'update':
        this.handleUpdate(message);
        break;
      case 'awareness':
        this.handleAwareness(message);
        break;
      case 'sync':
        this.handleSync(message);
        break;
      case 'init':
        this.handleInit(message);
        break;
    }

    this.stats.lastSyncAt = Date.now();
  }

  /**
   * Handle update message
   */
  private handleUpdate(message: SyncMessage): void {
    if (message.changes) {
      this.documentManager.applyChanges(this.documentId, message.changes);
    }
  }

  /**
   * Handle awareness message
   */
  private handleAwareness(message: SyncMessage): void {
    if (message.presence) {
      this.presenceManager.receivePresence(message.presence);
    }
  }

  /**
   * Handle sync message
   */
  private handleSync(message: SyncMessage): void {
    if (message.state) {
      // Merge remote state - convert to LWW register format
      this.documentManager.mergeState(
        this.documentId,
        Object.fromEntries(
          Object.entries(message.state).map(([key, value]) => [
            key,
            { value, timestamp: message.timestamp, clientId: message.clientId },
          ])
        )
      );
    }
  }

  /**
   * Handle init message
   */
  private handleInit(message: SyncMessage): void {
    // Server is sending initial state
    if (message.state) {
      this.documentManager.mergeState(
        this.documentId,
        Object.fromEntries(
          Object.entries(message.state).map(([key, value]) => [
            key,
            { value, timestamp: message.timestamp, clientId: message.clientId },
          ])
        )
      );
    }
  }

  /**
   * Send changes to remote
   */
  async sendChanges(changes: SyncMessage['changes']): Promise<void> {
    const message: SyncMessage = {
      type: 'update',
      documentId: this.documentId,
      changes,
      timestamp: Date.now(),
      clientId: this.clientId,
    };

    await this.send(message);
  }

  /**
   * Send presence update
   */
  async sendPresence(): Promise<void> {
    const message: SyncMessage = {
      type: 'awareness',
      documentId: this.documentId,
      presence: this.presenceManager.getLocalPresence(),
      timestamp: Date.now(),
      clientId: this.clientId,
    };

    await this.send(message);
  }

  /**
   * Request full sync
   */
  async requestSync(): Promise<void> {
    const message: SyncMessage = {
      type: 'sync',
      documentId: this.documentId,
      state: this.documentManager.getDocumentState(this.documentId),
      timestamp: Date.now(),
      clientId: this.clientId,
    };

    await this.send(message);
  }

  /**
   * Send message with queueing and retry logic
   */
  private async send(message: SyncMessage): Promise<void> {
    if (this.state !== 'connected') {
      this.pendingMessages.push(message);
      return;
    }

    try {
      await this.transport.send(message);
      this.stats.messagesSent++;
      this.stats.bytesTransferred += JSON.stringify(message).length;
    } catch (error) {
      this.pendingMessages.push(message);
      this.setState('error');
      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * Flush pending messages
   */
  private async flushPendingMessages(): Promise<void> {
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift()!;
      await this.send(message);
    }
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    this.syncInterval = setInterval(() => {
      this.sendPresence().catch(() => {
        // Presence updates are non-critical
      });
    }, this.options.syncIntervalMs);
  }

  /**
   * Stop periodic sync
   */
  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.retryCount >= this.options.maxRetries) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = this.options.retryDelayMs * Math.pow(2, this.retryCount);

    this.reconnectTimeout = setTimeout(() => {
      this.retryCount++;
      this.connect().catch(() => {
        // Reconnection failed, will retry
      });
    }, delay);
  }

  /**
   * Set connection state
   */
  private setState(state: ConnectionState): void {
    this.state = state;
    this.stateHandlers.forEach(h => h(state));
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(handler: (state: ConnectionState) => void): () => void {
    this.stateHandlers.push(handler);
    return () => {
      const idx = this.stateHandlers.indexOf(handler);
      if (idx !== -1) this.stateHandlers.splice(idx, 1);
    };
  }

  /**
   * Get sync stats
   */
  getStats(): SyncStats {
    return { ...this.stats };
  }

  /**
   * Reset stats
   */
  resetStats(): void {
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
      lastSyncAt: null,
      latencyMs: 0,
      conflictsResolved: 0,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// In-Memory Transport (for testing)
// ═══════════════════════════════════════════════════════════════════════════════

export class InMemoryTransport implements Transport {
  private handlers: ((message: SyncMessage) => void)[] = [];
  private state: ConnectionState = 'disconnected';
  private peer: InMemoryTransport | null = null;
  private latencyMs = 0;

  constructor(latencyMs = 0) {
    this.latencyMs = latencyMs;
  }

  setPeer(peer: InMemoryTransport): void {
    this.peer = peer;
  }

  async send(message: SyncMessage): Promise<void> {
    if (this.state !== 'connected' || !this.peer) {
      throw new Error('Not connected');
    }

    await this.delay();
    this.peer.deliver(message);
  }

  private deliver(message: SyncMessage): void {
    this.handlers.forEach(h => h(message));
  }

  onMessage(handler: (message: SyncMessage) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx !== -1) this.handlers.splice(idx, 1);
    };
  }

  async connect(): Promise<void> {
    await this.delay();
    this.state = 'connected';
  }

  async disconnect(): Promise<void> {
    await this.delay();
    this.state = 'disconnected';
  }

  getState(): ConnectionState {
    return this.state;
  }

  private delay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.latencyMs));
  }
}
