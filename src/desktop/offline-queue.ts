// Offline Queue — R20-02
// Offline action queue + sync engine interface

import type { SyncQueueItem } from './types.js';

export interface OfflineQueueConfig {
  queuePath: string;
  conflictStrategy: 'last-write-wins' | 'merge' | 'manual';
  maxQueueSize: number;
  autoFlush: boolean;
}

export const DEFAULT_OFFLINE_CONFIG: OfflineQueueConfig = {
  queuePath: '.nova/sync-queue.json',
  conflictStrategy: 'last-write-wins',
  maxQueueSize: 1000,
  autoFlush: true,
};

export class OfflineQueue {
  private config: OfflineQueueConfig;
  private queue: SyncQueueItem[] = [];
  private isOnline: boolean = true;
  private flushCallbacks: Array<(items: SyncQueueItem[]) => Promise<void>> = [];

  constructor(config: Partial<OfflineQueueConfig> = {}) {
    this.config = { ...DEFAULT_OFFLINE_CONFIG, ...config };
  }

  /**
   * Add an action to the queue
   */
  async enqueue(
    action: SyncQueueItem['action'],
    path: string,
    content?: string
  ): Promise<string> {
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new Error('Queue is full');
    }

    const item: SyncQueueItem = {
      id: this.generateId(),
      action,
      path,
      content,
      timestamp: Date.now(),
      synced: false,
    };

    this.queue.push(item);

    if (this.config.autoFlush && this.isOnline) {
      await this.flush();
    }

    return item.id;
  }

  /**
   * Process all pending items
   */
  async flush(): Promise<{
    processed: number;
    failed: number;
    conflicts: string[];
  }> {
    const pending = this.queue.filter(item => !item.synced);
    let processed = 0;
    let failed = 0;
    const conflicts: string[] = [];

    for (const item of pending) {
      try {
        for (const callback of this.flushCallbacks) {
          await callback([item]);
        }
        item.synced = true;
        processed++;
      } catch (error) {
        if (this.isConflictError(error)) {
          conflicts.push(item.id);
          // Try to resolve conflict
          const resolved = await this.resolveConflict(item);
          if (resolved) {
            item.synced = true;
            processed++;
          } else {
            failed++;
          }
        } else {
          failed++;
        }
      }
    }

    // Clean up synced items
    this.queue = this.queue.filter(item => !item.synced);

    return { processed, failed, conflicts };
  }

  /**
   * Get current queue state
   */
  getQueue(): SyncQueueItem[] {
    return [...this.queue];
  }

  /**
   * Get pending (unsynced) items
   */
  getPending(): SyncQueueItem[] {
    return this.queue.filter(item => !item.synced);
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    synced: number;
    byAction: Record<string, number>;
  } {
    const byAction: Record<string, number> = { create: 0, update: 0, delete: 0 };
    
    for (const item of this.queue) {
      byAction[item.action]++;
    }

    return {
      total: this.queue.length,
      pending: this.queue.filter(i => !i.synced).length,
      synced: this.queue.filter(i => i.synced).length,
      byAction,
    };
  }

  /**
   * Set online/offline status
   */
  setOnline(online: boolean): void {
    this.isOnline = online;
    if (online && this.config.autoFlush) {
      this.flush().catch(console.error);
    }
  }

  /**
   * Check if currently online
   */
  isCurrentlyOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Register a callback for flush operations
   */
  onFlush(callback: (items: SyncQueueItem[]) => Promise<void>): () => void {
    this.flushCallbacks.push(callback);
    return () => {
      const index = this.flushCallbacks.indexOf(callback);
      if (index > -1) {
        this.flushCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Remove a specific item
   */
  remove(id: string): boolean {
    const index = this.queue.findIndex(item => item.id === id);
    if (index > -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Serialize queue to JSON
   */
  serialize(): string {
    return JSON.stringify({
      queue: this.queue,
      timestamp: Date.now(),
    });
  }

  /**
   * Deserialize queue from JSON
   */
  deserialize(data: string): void {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed.queue)) {
        this.queue = parsed.queue;
      }
    } catch {
      throw new Error('Invalid queue data');
    }
  }

  /**
   * Resolve a conflict using the configured strategy
   */
  private async resolveConflict(_item: SyncQueueItem): Promise<boolean> {
    switch (this.config.conflictStrategy) {
      case 'last-write-wins':
        // Always accept local version
        return true;
      
      case 'merge':
        // Would implement merge logic here
        return true;
      
      case 'manual':
        // Would prompt user in real implementation
        return false;
      
      default:
        return false;
    }
  }

  private isConflictError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return msg.toLowerCase().includes('conflict') || 
           msg.toLowerCase().includes('version mismatch');
  }

  private generateId(): string {
    return `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
}

export function createOfflineQueue(config?: Partial<OfflineQueueConfig>): OfflineQueue {
  return new OfflineQueue(config);
}
