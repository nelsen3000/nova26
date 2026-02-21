// MX-03: Typed Cross-Module Event Bus
// Provides pub/sub communication between lifecycle modules

// Types from lifecycle-hooks.js are used by consumers, not directly here

// ============================================================================
// Event Type Definitions
// ============================================================================

export interface ModelSelectedEvent {
  agentName: string;
  taskId: string;
  modelId: string;
  modelName: string;
  routingReason: string;
  latencyMs?: number;
}

export interface TaskStartedEvent {
  taskId: string;
  agentName: string;
  title: string;
  buildId: string;
  startedAt: number;
}

export interface TaskCompletedEvent {
  taskId: string;
  agentName: string;
  success: boolean;
  durationMs: number;
  outputSize: number;
  aceScore?: number;
}

export interface TaskFailedEvent {
  taskId: string;
  agentName: string;
  error: string;
  durationMs: number;
  recoveryAttempted: boolean;
}

export interface MemoryStoredEvent {
  nodeId: string;
  level: 'scene' | 'episode' | 'project' | 'portfolio';
  taskId: string;
  agentName: string;
  tasteScore?: number;
}

export interface WorkflowTransitionedEvent {
  nodeId: string;
  fromStatus: string;
  toStatus: string;
  taskId: string;
  triggeredDownstream: string[];
}

export interface CollaborationChangedEvent {
  sessionId: string;
  changeType: 'merge' | 'conflict' | 'resolve' | 'broadcast';
  participantCount: number;
  documentVersion: number;
}

export interface BuildStartedEvent {
  buildId: string;
  prdId: string;
  prdName: string;
  totalTasks: number;
  enabledModules: string[];
}

export interface BuildCompletedEvent {
  buildId: string;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  totalDurationMs: number;
}

export interface ResearchCompletedEvent {
  taskId: string;
  queryCount: number;
  relevanceScore: number;
  cachedResults: number;
}

export interface SpanCreatedEvent {
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  moduleName: string;
}

// ============================================================================
// Event Map — All event types keyed by name
// ============================================================================

export interface EventMap {
  'model:selected': ModelSelectedEvent;
  'task:started': TaskStartedEvent;
  'task:completed': TaskCompletedEvent;
  'task:failed': TaskFailedEvent;
  'memory:stored': MemoryStoredEvent;
  'workflow:transitioned': WorkflowTransitionedEvent;
  'collaboration:changed': CollaborationChangedEvent;
  'build:started': BuildStartedEvent;
  'build:completed': BuildCompletedEvent;
  'research:completed': ResearchCompletedEvent;
  'span:created': SpanCreatedEvent;
}

export type EventName = keyof EventMap;

// ============================================================================
// Subscriber Types
// ============================================================================

export type EventHandler<T extends EventName> = (payload: EventMap[T]) => void | Promise<void>;

interface Subscription {
  id: string;
  eventName: EventName;
  handler: EventHandler<EventName>;
  moduleName: string;
  once: boolean;
}

// ============================================================================
// Event History Entry
// ============================================================================

export interface EventHistoryEntry<T extends EventName = EventName> {
  eventName: T;
  payload: EventMap[T];
  timestamp: number;
  subscriberCount: number;
}

// ============================================================================
// Event Bus Configuration
// ============================================================================

export interface EventBusConfig {
  maxHistorySize: number;
  enableHistory: boolean;
  onError?: (eventName: string, error: unknown, moduleName: string) => void;
}

const DEFAULT_CONFIG: EventBusConfig = {
  maxHistorySize: 1000,
  enableHistory: true,
};

// ============================================================================
// EventBus Class
// ============================================================================

export class EventBus {
  private subscriptions: Map<EventName, Subscription[]> = new Map();
  private history: EventHistoryEntry[] = [];
  private config: EventBusConfig;
  private nextId = 0;

  constructor(config: Partial<EventBusConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on<T extends EventName>(
    eventName: T,
    handler: EventHandler<T>,
    moduleName: string = 'unknown'
  ): () => void {
    return this.addSubscription(eventName, handler as EventHandler<EventName>, moduleName, false);
  }

  /**
   * Subscribe to an event, but only fire once.
   */
  once<T extends EventName>(
    eventName: T,
    handler: EventHandler<T>,
    moduleName: string = 'unknown'
  ): () => void {
    return this.addSubscription(eventName, handler as EventHandler<EventName>, moduleName, true);
  }

  /**
   * Emit an event to all subscribers.
   */
  async emit<T extends EventName>(eventName: T, payload: EventMap[T]): Promise<void> {
    const subs = this.subscriptions.get(eventName) ?? [];

    // Record in history
    if (this.config.enableHistory) {
      this.history.push({
        eventName,
        payload,
        timestamp: Date.now(),
        subscriberCount: subs.length,
      });

      // Trim history
      if (this.history.length > this.config.maxHistorySize) {
        this.history = this.history.slice(-this.config.maxHistorySize);
      }
    }

    // Execute handlers
    const toRemove: string[] = [];

    for (const sub of subs) {
      try {
        await sub.handler(payload);
      } catch (error) {
        if (this.config.onError) {
          this.config.onError(eventName, error, sub.moduleName);
        } else {
          console.error(
            `[EventBus] Handler error in ${sub.moduleName} for ${eventName}:`,
            error instanceof Error ? error.message : String(error)
          );
        }
      }

      if (sub.once) {
        toRemove.push(sub.id);
      }
    }

    // Remove once-subscriptions
    if (toRemove.length > 0) {
      const remaining = subs.filter(s => !toRemove.includes(s.id));
      this.subscriptions.set(eventName, remaining);
    }
  }

  /**
   * Remove all subscriptions for a module.
   */
  removeAllForModule(moduleName: string): number {
    let removed = 0;
    for (const [eventName, subs] of this.subscriptions) {
      const before = subs.length;
      const filtered = subs.filter(s => s.moduleName !== moduleName);
      this.subscriptions.set(eventName, filtered);
      removed += before - filtered.length;
    }
    return removed;
  }

  /**
   * Get subscriber count for an event.
   */
  subscriberCount(eventName: EventName): number {
    return (this.subscriptions.get(eventName) ?? []).length;
  }

  /**
   * Get total subscriber count across all events.
   */
  totalSubscriberCount(): number {
    let total = 0;
    for (const subs of this.subscriptions.values()) {
      total += subs.length;
    }
    return total;
  }

  /**
   * Get event history, optionally filtered by event name.
   */
  getHistory(eventName?: EventName): EventHistoryEntry[] {
    if (eventName) {
      return this.history.filter(e => e.eventName === eventName);
    }
    return [...this.history];
  }

  /**
   * Get the last N events from history.
   */
  getRecentEvents(count: number): EventHistoryEntry[] {
    return this.history.slice(-count);
  }

  /**
   * Clear event history.
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Clear all subscriptions and history.
   */
  clear(): void {
    this.subscriptions.clear();
    this.history = [];
    this.nextId = 0;
  }

  /**
   * Get list of event names that have active subscribers.
   */
  getActiveEventNames(): EventName[] {
    const names: EventName[] = [];
    for (const [name, subs] of this.subscriptions) {
      if (subs.length > 0) {
        names.push(name);
      }
    }
    return names;
  }

  /**
   * Get all modules that have subscriptions.
   */
  getSubscribedModules(): string[] {
    const modules = new Set<string>();
    for (const subs of this.subscriptions.values()) {
      for (const sub of subs) {
        modules.add(sub.moduleName);
      }
    }
    return Array.from(modules);
  }

  // Internal
  private addSubscription(
    eventName: EventName,
    handler: EventHandler<EventName>,
    moduleName: string,
    once: boolean
  ): () => void {
    const id = `sub_${this.nextId++}`;
    const sub: Subscription = { id, eventName, handler, moduleName, once };

    if (!this.subscriptions.has(eventName)) {
      this.subscriptions.set(eventName, []);
    }
    this.subscriptions.get(eventName)!.push(sub);

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(eventName);
      if (subs) {
        const idx = subs.findIndex(s => s.id === id);
        if (idx >= 0) {
          subs.splice(idx, 1);
        }
      }
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let globalEventBus: EventBus | null = null;

export function getGlobalEventBus(): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus();
  }
  return globalEventBus;
}

export function resetGlobalEventBus(): void {
  if (globalEventBus) {
    globalEventBus.clear();
  }
  globalEventBus = null;
}
