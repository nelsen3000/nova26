/**
 * Notification Dispatcher
 * Routes typed notifications to appropriate handlers based on priority and type
 * KMS-20
 */

// ============================================================================
// Types
// ============================================================================

export type NotificationType =
  | 'build:complete'
  | 'task:failed'
  | 'budget:exceeded'
  | 'security:alert';

export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Notification {
  id: string;
  type: NotificationType;
  priority: PriorityLevel;
  title: string;
  message: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface NotificationPayload {
  type: NotificationType;
  priority: PriorityLevel;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface HandlerConfig {
  minPriority: PriorityLevel;
  types?: NotificationType[];
}

export interface NotificationHandler {
  name: string;
  config: HandlerConfig;
  handle(notification: Notification): Promise<void>;
}

export interface DispatcherConfig {
  defaultMinPriority?: PriorityLevel;
  maxHistorySize?: number;
  enableHistory?: boolean;
}

export interface DispatchResult {
  success: boolean;
  handledBy: string[];
  errors: Array<{ handler: string; error: Error }>;
  timestamp: number;
}

// ============================================================================
// Priority Utilities
// ============================================================================

const PRIORITY_WEIGHTS: Record<PriorityLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function isPriorityAtLeast(
  priority: PriorityLevel,
  minPriority: PriorityLevel
): boolean {
  return PRIORITY_WEIGHTS[priority] >= PRIORITY_WEIGHTS[minPriority];
}

export function comparePriority(
  a: PriorityLevel,
  b: PriorityLevel
): number {
  return PRIORITY_WEIGHTS[a] - PRIORITY_WEIGHTS[b];
}

// ============================================================================
// Built-in Handlers
// ============================================================================

export class ConsoleHandler implements NotificationHandler {
  name = 'console';
  config: HandlerConfig;

  constructor(config: Partial<HandlerConfig> = {}) {
    this.config = {
      minPriority: config.minPriority ?? 'low',
      types: config.types,
    };
  }

  async handle(notification: Notification): Promise<void> {
    const emoji = this.getEmoji(notification.priority);
    const timestamp = new Date(notification.timestamp).toISOString();

    const lines: string[] = [
      `${emoji} [${notification.type}] ${notification.title}`,
      `   Priority: ${notification.priority.toUpperCase()}`,
      `   Time: ${timestamp}`,
      `   Message: ${notification.message}`,
    ];

    if (notification.metadata && Object.keys(notification.metadata).length > 0) {
      lines.push(`   Metadata: ${JSON.stringify(notification.metadata)}`);
    }

    // Use console.error for critical/high, warn for medium, log for low
    if (notification.priority === 'critical' || notification.priority === 'high') {
      console.error(lines.join('\n'));
    } else if (notification.priority === 'medium') {
      console.warn(lines.join('\n'));
    } else {
      console.log(lines.join('\n'));
    }
  }

  private getEmoji(priority: PriorityLevel): string {
    switch (priority) {
      case 'critical':
        return '🚨';
      case 'high':
        return '⚠️';
      case 'medium':
        return 'ℹ️';
      case 'low':
        return '📝';
      default:
        return '📢';
    }
  }
}

export class FileHandler implements NotificationHandler {
  name = 'file';
  config: HandlerConfig;
  private filePath: string;
  private logs: Notification[] = [];

  constructor(filePath: string, config: Partial<HandlerConfig> = {}) {
    this.filePath = filePath;
    this.config = {
      minPriority: config.minPriority ?? 'medium',
      types: config.types,
    };
  }

  async handle(notification: Notification): Promise<void> {
    this.logs.push(notification);
    // In a real implementation, this would write to a file
    // For now, we store in memory
  }

  getLogs(): Notification[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  getFilePath(): string {
    return this.filePath;
  }

  async exportToJSON(): Promise<string> {
    return JSON.stringify(this.logs, null, 2);
  }
}

export interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retryCount?: number;
}

export class WebhookHandler implements NotificationHandler {
  name = 'webhook';
  config: HandlerConfig;
  private webhookConfig: WebhookConfig;
  private lastRequest?: {
    url: string;
    body: string;
    headers: Record<string, string>;
  };

  constructor(webhookConfig: WebhookConfig, config: Partial<HandlerConfig> = {}) {
    this.webhookConfig = {
      timeoutMs: 5000,
      retryCount: 3,
      ...webhookConfig,
    };
    this.config = {
      minPriority: config.minPriority ?? 'high',
      types: config.types,
    };
  }

  async handle(notification: Notification): Promise<void> {
    const payload = {
      notification,
      sentAt: new Date().toISOString(),
    };

    const body = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      ...this.webhookConfig.headers,
    };

    // Store for testing/mocking purposes
    this.lastRequest = {
      url: this.webhookConfig.url,
      body,
      headers,
    };

    // In a real implementation, this would make an HTTP request
    // For now, we just store the request details
  }

  getLastRequest(): typeof this.lastRequest {
    return this.lastRequest;
  }

  getWebhookUrl(): string {
    return this.webhookConfig.url;
  }

  getWebhookConfig(): WebhookConfig {
    return { ...this.webhookConfig };
  }
}

// ============================================================================
// Notification Dispatcher
// ============================================================================

export class NotificationDispatcher {
  private handlers: Map<string, NotificationHandler> = new Map();
  private history: Notification[] = [];
  private config: Required<DispatcherConfig>;

  constructor(config: DispatcherConfig = {}) {
    this.config = {
      defaultMinPriority: config.defaultMinPriority ?? 'low',
      maxHistorySize: config.maxHistorySize ?? 100,
      enableHistory: config.enableHistory ?? true,
    };
  }

  /**
   * Register a notification handler
   */
  registerHandler(handler: NotificationHandler): void {
    this.handlers.set(handler.name, handler);
  }

  /**
   * Unregister a notification handler
   */
  unregisterHandler(name: string): boolean {
    return this.handlers.delete(name);
  }

  /**
   * Check if a handler is registered
   */
  hasHandler(name: string): boolean {
    return this.handlers.has(name);
  }

  /**
   * Get all registered handler names
   */
  getHandlerNames(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get a specific handler
   */
  getHandler(name: string): NotificationHandler | undefined {
    return this.handlers.get(name);
  }

  /**
   * Dispatch a notification to all applicable handlers
   */
  async dispatch(payload: NotificationPayload): Promise<DispatchResult> {
    const notification: Notification = {
      ...payload,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    const result: DispatchResult = {
      success: true,
      handledBy: [],
      errors: [],
      timestamp: Date.now(),
    };

    // Store in history if enabled
    if (this.config.enableHistory) {
      this.addToHistory(notification);
    }

    // Find applicable handlers
    const applicableHandlers = this.findApplicableHandlers(notification);

    // Dispatch to each handler
    for (const handler of applicableHandlers) {
      try {
        await handler.handle(notification);
        result.handledBy.push(handler.name);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        result.errors.push({ handler: handler.name, error: err });
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * Check if a handler should handle a notification
   */
  shouldHandle(handler: NotificationHandler, notification: Notification): boolean {
    // Check priority threshold
    if (!isPriorityAtLeast(notification.priority, handler.config.minPriority)) {
      return false;
    }

    // Check type filter if specified
    if (handler.config.types !== undefined) {
      return handler.config.types.includes(notification.type);
    }

    return true;
  }

  /**
   * Find all handlers that should handle a notification
   */
  findApplicableHandlers(notification: Notification): NotificationHandler[] {
    return Array.from(this.handlers.values()).filter((handler) =>
      this.shouldHandle(handler, notification)
    );
  }

  /**
   * Get notification history
   */
  getHistory(type?: NotificationType): Notification[] {
    if (type === undefined) {
      return [...this.history];
    }
    return this.history.filter((n) => n.type === type);
  }

  /**
   * Get recent notifications
   */
  getRecent(count: number): Notification[] {
    return this.history.slice(-count);
  }

  /**
   * Get notifications by priority
   */
  getByPriority(priority: PriorityLevel): Notification[] {
    return this.history.filter((n) => n.priority === priority);
  }

  /**
   * Get notifications by time range
   */
  getByTimeRange(startTime: number, endTime: number): Notification[] {
    return this.history.filter((n) => n.timestamp >= startTime && n.timestamp <= endTime);
  }

  /**
   * Clear notification history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get history count
   */
  getHistoryCount(): number {
    return this.history.length;
  }

  /**
   * Check if history is enabled
   */
  isHistoryEnabled(): boolean {
    return this.config.enableHistory;
  }

  /**
   * Set history enabled state
   */
  setHistoryEnabled(enabled: boolean): void {
    this.config.enableHistory = enabled;
    if (!enabled) {
      this.clearHistory();
    }
  }

  /**
   * Get all registered handlers
   */
  getHandlers(): NotificationHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Clear all handlers
   */
  clearHandlers(): void {
    this.handlers.clear();
  }

  /**
   * Reset dispatcher to initial state
   */
  reset(): void {
    this.clearHandlers();
    this.clearHistory();
  }

  /**
   * Get handler count
   */
  getHandlerCount(): number {
    return this.handlers.size;
  }

  private generateId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private addToHistory(notification: Notification): void {
    this.history.push(notification);
    // Trim history if exceeds max size
    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(-this.config.maxHistorySize);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalDispatcher: NotificationDispatcher | undefined;

export function getGlobalDispatcher(): NotificationDispatcher {
  if (globalDispatcher === undefined) {
    globalDispatcher = new NotificationDispatcher();
  }
  return globalDispatcher;
}

export function resetGlobalDispatcher(): void {
  globalDispatcher = undefined;
}

export function setGlobalDispatcher(dispatcher: NotificationDispatcher): void {
  globalDispatcher = dispatcher;
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createConsoleHandler(
  config?: Partial<HandlerConfig>
): ConsoleHandler {
  return new ConsoleHandler(config);
}

export function createFileHandler(
  filePath: string,
  config?: Partial<HandlerConfig>
): FileHandler {
  return new FileHandler(filePath, config);
}

export function createWebhookHandler(
  webhookConfig: WebhookConfig,
  config?: Partial<HandlerConfig>
): WebhookHandler {
  return new WebhookHandler(webhookConfig, config);
}
