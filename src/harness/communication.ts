// Harness Communication - Inter-harness messaging and coordination
// Spec: .kiro/specs/agent-harnesses/tasks.md

import { EventEmitter } from 'events';
import type { HarnessEvent, HarnessStatus } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Inter-Harness Message Bus
// ═══════════════════════════════════════════════════════════════════════════════

export interface HarnessMessage {
  id: string;
  fromHarnessId: string;
  toHarnessId: string | 'broadcast';
  type: 'command' | 'query' | 'event' | 'result';
  payload: unknown;
  timestamp: number;
  replyTo?: string;
}

export interface HarnessSubscription {
  harnessId: string;
  filter?: (message: HarnessMessage) => boolean;
}

export class HarnessMessageBus extends EventEmitter {
  private static instance: HarnessMessageBus;
  private messages: Map<string, HarnessMessage> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map();

  static getInstance(): HarnessMessageBus {
    if (!HarnessMessageBus.instance) {
      HarnessMessageBus.instance = new HarnessMessageBus();
    }
    return HarnessMessageBus.instance;
  }

  /**
   * Send a message to another harness
   */
  send(message: Omit<HarnessMessage, 'id' | 'timestamp'>): string {
    const fullMessage: HarnessMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
    };

    this.messages.set(fullMessage.id, fullMessage);

    if (fullMessage.toHarnessId === 'broadcast') {
      this.emit('broadcast', fullMessage);
    } else {
      this.emit(`message:${fullMessage.toHarnessId}`, fullMessage);
    }

    this.emit('sent', fullMessage);
    return fullMessage.id;
  }

  /**
   * Subscribe to messages for a harness
   */
  subscribe(harnessId: string, handler: (message: HarnessMessage) => void): () => void {
    const eventName = `message:${harnessId}`;
    this.on(eventName, handler);
    
    return () => {
      this.off(eventName, handler);
    };
  }

  /**
   * Subscribe to broadcasts
   */
  subscribeToBroadcast(handler: (message: HarnessMessage) => void): () => void {
    this.on('broadcast', handler);
    return () => {
      this.off('broadcast', handler);
    };
  }

  /**
   * Get message by ID
   */
  getMessage(id: string): HarnessMessage | undefined {
    return this.messages.get(id);
  }

  /**
   * Reply to a message
   */
  reply(
    originalMessageId: string,
    payload: unknown,
    fromHarnessId: string
  ): string | null {
    const original = this.messages.get(originalMessageId);
    if (!original || !original.replyTo) {
      return null;
    }

    return this.send({
      fromHarnessId,
      toHarnessId: original.fromHarnessId,
      type: 'result',
      payload,
      replyTo: originalMessageId,
    });
  }

  /**
   * Clear old messages
   */
  prune(maxAgeMs: number = 3600000): number {
    const cutoff = Date.now() - maxAgeMs;
    let count = 0;
    
    for (const [id, message] of this.messages) {
      if (message.timestamp < cutoff) {
        this.messages.delete(id);
        count++;
      }
    }
    
    return count;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Parent-Child Relationship Manager
// ═══════════════════════════════════════════════════════════════════════════════

export interface ParentChildRelation {
  parentId: string;
  childIds: Set<string>;
}

export class ParentChildManager {
  private relations: Map<string, ParentChildRelation> = new Map();
  private childToParent: Map<string, string> = new Map();

  /**
   * Register a parent-child relationship
   */
  registerChild(parentId: string, childId: string): void {
    // Update parent record
    let relation = this.relations.get(parentId);
    if (!relation) {
      relation = { parentId, childIds: new Set() };
      this.relations.set(parentId, relation);
    }
    relation.childIds.add(childId);

    // Update child record
    this.childToParent.set(childId, parentId);
  }

  /**
   * Get parent of a harness
   */
  getParent(childId: string): string | undefined {
    return this.childToParent.get(childId);
  }

  /**
   * Get children of a harness
   */
  getChildren(parentId: string): string[] {
    const relation = this.relations.get(parentId);
    return relation ? Array.from(relation.childIds) : [];
  }

  /**
   * Remove a child relationship
   */
  removeChild(childId: string): void {
    const parentId = this.childToParent.get(childId);
    if (parentId) {
      const relation = this.relations.get(parentId);
      if (relation) {
        relation.childIds.delete(childId);
      }
      this.childToParent.delete(childId);
    }
  }

  /**
   * Check if a harness has children
   */
  hasChildren(parentId: string): boolean {
    const relation = this.relations.get(parentId);
    return relation ? relation.childIds.size > 0 : false;
  }

  /**
   * Get all descendants (children, grandchildren, etc.)
   */
  getDescendants(parentId: string): string[] {
    const descendants: string[] = [];
    const toProcess = [parentId];
    const visited = new Set<string>();

    while (toProcess.length > 0) {
      const current = toProcess.shift()!;
      
      if (visited.has(current)) continue;
      visited.add(current);

      const children = this.getChildren(current);
      for (const child of children) {
        if (child !== parentId) {
          descendants.push(child);
          toProcess.push(child);
        }
      }
    }

    return descendants;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Progress Reporter
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProgressUpdate {
  harnessId: string;
  stepIndex: number;
  totalSteps: number;
  percentComplete: number;
  message?: string;
  timestamp: number;
}

export class ProgressReporter extends EventEmitter {
  private progress: Map<string, ProgressUpdate> = new Map();

  /**
   * Report progress update
   */
  report(update: Omit<ProgressUpdate, 'timestamp'>): void {
    const fullUpdate: ProgressUpdate = {
      ...update,
      timestamp: Date.now(),
    };

    this.progress.set(update.harnessId, fullUpdate);
    this.emit('progress', fullUpdate);
    this.emit(`progress:${update.harnessId}`, fullUpdate);
  }

  /**
   * Get latest progress for a harness
   */
  getProgress(harnessId: string): ProgressUpdate | undefined {
    return this.progress.get(harnessId);
  }

  /**
   * Subscribe to progress updates for a harness
   */
  subscribe(harnessId: string, handler: (update: ProgressUpdate) => void): () => void {
    const eventName = `progress:${harnessId}`;
    this.on(eventName, handler);
    return () => this.off(eventName, handler);
  }

  /**
   * Subscribe to all progress updates
   */
  subscribeToAll(handler: (update: ProgressUpdate) => void): () => void {
    this.on('progress', handler);
    return () => this.off('progress', handler);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Exports
// ═══════════════════════════════════════════════════════════════════════════════

export const harnessMessageBus = HarnessMessageBus.getInstance();

export const parentChildManager = new ParentChildManager();

export const progressReporter = new ProgressReporter();
