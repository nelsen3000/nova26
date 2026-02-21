// KMS-28: WebSocket-style real-time build events
// SSE-compatible event stream for build updates

import { EventBus } from '../orchestrator/event-bus.js';

// ============================================================================
// Event Types for WebSocket Stream
// ============================================================================

export type BuildEventType = 
  | 'build.started'
  | 'build.completed'
  | 'build.failed'
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'memory.stored'
  | 'model.selected'
  | 'error';

export interface BuildEvent {
  id: string;
  type: BuildEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface SSEEvent {
  id?: string;
  event?: string;
  data: string;
}

// ============================================================================
// Event Stream Handler
// ============================================================================

export class WSBuildEventStream {
  private eventBus: EventBus;
  private subscribers: Set<(event: BuildEvent) => void> = new Set();
  private unsubscribers: Array<() => void> = [];
  private isRunning: boolean = false;
  private eventId: number = 0;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Start listening to build events
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Subscribe to task:completed
    const unsubTaskCompleted = this.eventBus.on('task:completed', (payload) => {
      this.emit({
        id: this.generateId(),
        type: 'task.completed',
        timestamp: Date.now(),
        data: {
          taskId: payload.taskId,
          agentName: payload.agentName,
          success: payload.success,
          durationMs: payload.durationMs,
          outputSize: payload.outputSize,
          aceScore: payload.aceScore,
        },
      });
    }, 'ws-build-events');
    this.unsubscribers.push(unsubTaskCompleted);

    // Subscribe to build:started
    const unsubBuildStarted = this.eventBus.on('build:started', (payload) => {
      this.emit({
        id: this.generateId(),
        type: 'build.started',
        timestamp: Date.now(),
        data: {
          buildId: payload.buildId,
          prdId: payload.prdId,
          prdName: payload.prdName,
          totalTasks: payload.totalTasks,
          enabledModules: payload.enabledModules,
        },
      });
    }, 'ws-build-events');
    this.unsubscribers.push(unsubBuildStarted);

    // Subscribe to build:completed
    const unsubBuildCompleted = this.eventBus.on('build:completed', (payload) => {
      this.emit({
        id: this.generateId(),
        type: 'build.completed',
        timestamp: Date.now(),
        data: {
          buildId: payload.buildId,
          totalTasks: payload.totalTasks,
          successfulTasks: payload.successfulTasks,
          failedTasks: payload.failedTasks,
          totalDurationMs: payload.totalDurationMs,
        },
      });
    }, 'ws-build-events');
    this.unsubscribers.push(unsubBuildCompleted);

    // Subscribe to memory:stored
    const unsubMemoryStored = this.eventBus.on('memory:stored', (payload) => {
      this.emit({
        id: this.generateId(),
        type: 'memory.stored',
        timestamp: Date.now(),
        data: {
          nodeId: payload.nodeId,
          level: payload.level,
          taskId: payload.taskId,
          agentName: payload.agentName,
          tasteScore: payload.tasteScore,
        },
      });
    }, 'ws-build-events');
    this.unsubscribers.push(unsubMemoryStored);

    // Subscribe to model:selected
    const unsubModelSelected = this.eventBus.on('model:selected', (payload) => {
      this.emit({
        id: this.generateId(),
        type: 'model.selected',
        timestamp: Date.now(),
        data: {
          agentName: payload.agentName,
          taskId: payload.taskId,
          modelId: payload.modelId,
          modelName: payload.modelName,
          routingReason: payload.routingReason,
          latencyMs: payload.latencyMs,
        },
      });
    }, 'ws-build-events');
    this.unsubscribers.push(unsubModelSelected);
  }

  /**
   * Stop listening to events
   */
  stop(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.isRunning = false;
  }

  /**
   * Check if stream is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Subscribe to build events
   */
  subscribe(callback: (event: BuildEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Emit event to all subscribers
   */
  private emit(event: BuildEvent): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch (error) {
        console.error('[WSBuildEventStream] Error in subscriber:', error);
      }
    }
  }

  /**
   * Generate unique event ID
   */
  private generateId(): string {
    return `${Date.now()}-${++this.eventId}`;
  }

  /**
   * Convert build event to SSE format
   */
  toSSE(event: BuildEvent): string {
    const lines: string[] = [];
    
    lines.push(`id: ${event.id}`);
    lines.push(`event: ${event.type}`);
    lines.push(`data: ${JSON.stringify(event.data)}`);
    lines.push(''); // Empty line to end event
    
    return lines.join('\n');
  }

  /**
   * Create SSE stream header
   */
  getSSEHeader(): Record<string, string> {
    return {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    };
  }

  /**
   * Get current subscriber count
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }
}

// ============================================================================
// Event Stream Manager (handles multiple concurrent streams)
// ============================================================================

export class BuildEventStreamManager {
  private eventBus: EventBus;
  private streams: Map<string, WSBuildEventStream> = new Map();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Create a new event stream
   */
  createStream(streamId: string): WSBuildEventStream {
    const stream = new WSBuildEventStream(this.eventBus);
    this.streams.set(streamId, stream);
    return stream;
  }

  /**
   * Get an existing stream
   */
  getStream(streamId: string): WSBuildEventStream | undefined {
    return this.streams.get(streamId);
  }

  /**
   * Remove a stream
   */
  removeStream(streamId: string): boolean {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.stop();
      return this.streams.delete(streamId);
    }
    return false;
  }

  /**
   * Get all stream IDs
   */
  getStreamIds(): string[] {
    return Array.from(this.streams.keys());
  }

  /**
   * Get total subscriber count across all streams
   */
  getTotalSubscriberCount(): number {
    let count = 0;
    for (const stream of this.streams.values()) {
      count += stream.getSubscriberCount();
    }
    return count;
  }

  /**
   * Start all streams
   */
  startAll(): void {
    for (const stream of this.streams.values()) {
      stream.start();
    }
  }

  /**
   * Stop all streams
   */
  stopAll(): void {
    for (const stream of this.streams.values()) {
      stream.stop();
    }
  }

  /**
   * Clear all streams
   */
  clear(): void {
    this.stopAll();
    this.streams.clear();
  }
}

// ============================================================================
// Singleton
// ============================================================================

let globalManager: BuildEventStreamManager | null = null;
let globalEventBus: EventBus | null = null;

export function getGlobalStreamManager(eventBus?: EventBus): BuildEventStreamManager {
  if (!globalManager) {
    const bus = eventBus ?? getGlobalEventBus();
    globalManager = new BuildEventStreamManager(bus);
  }
  return globalManager;
}

export function resetGlobalStreamManager(): void {
  if (globalManager) {
    globalManager.clear();
  }
  globalManager = null;
}

function getGlobalEventBus(): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus();
  }
  return globalEventBus;
}
