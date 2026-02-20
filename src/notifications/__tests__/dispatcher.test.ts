/**
 * Notification Dispatcher Tests
 * KMS-20
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NotificationDispatcher,
  ConsoleHandler,
  FileHandler,
  WebhookHandler,
  getGlobalDispatcher,
  resetGlobalDispatcher,
  setGlobalDispatcher,
  createConsoleHandler,
  createFileHandler,
  createWebhookHandler,
  isPriorityAtLeast,
  comparePriority,
  type NotificationType,
  type PriorityLevel,
  type NotificationPayload,
  type HandlerConfig,
} from '../dispatcher.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('NotificationDispatcher', () => {
  let dispatcher: NotificationDispatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    dispatcher = new NotificationDispatcher();
  });

  // ============================================================================
  // Handler Registration
  // ============================================================================

  it('should register a handler', () => {
    const handler = new ConsoleHandler();
    dispatcher.registerHandler(handler);

    expect(dispatcher.hasHandler('console')).toBe(true);
    expect(dispatcher.getHandlerNames()).toContain('console');
  });

  it('should unregister a handler', () => {
    const handler = new ConsoleHandler();
    dispatcher.registerHandler(handler);
    expect(dispatcher.hasHandler('console')).toBe(true);

    const result = dispatcher.unregisterHandler('console');
    expect(result).toBe(true);
    expect(dispatcher.hasHandler('console')).toBe(false);
  });

  it('should return false when unregistering non-existent handler', () => {
    const result = dispatcher.unregisterHandler('nonexistent');
    expect(result).toBe(false);
  });

  it('should get all registered handlers', () => {
    dispatcher.registerHandler(new ConsoleHandler());
    dispatcher.registerHandler(new FileHandler('/tmp/notifications.log'));

    const handlers = dispatcher.getHandlers();
    expect(handlers).toHaveLength(2);
    expect(handlers.map((h) => h.name)).toContain('console');
    expect(handlers.map((h) => h.name)).toContain('file');
  });

  it('should clear all handlers', () => {
    dispatcher.registerHandler(new ConsoleHandler());
    dispatcher.registerHandler(new FileHandler('/tmp/notifications.log'));

    dispatcher.clearHandlers();
    expect(dispatcher.getHandlerCount()).toBe(0);
    expect(dispatcher.getHandlerNames()).toHaveLength(0);
  });

  // ============================================================================
  // Dispatch Logic
  // ============================================================================

  it('should dispatch notification to applicable handlers', async () => {
    const consoleHandler = new ConsoleHandler();
    const fileHandler = new FileHandler('/tmp/notifications.log');

    const consoleSpy = vi.spyOn(consoleHandler, 'handle').mockResolvedValue(undefined);
    const fileSpy = vi.spyOn(fileHandler, 'handle').mockResolvedValue(undefined);

    dispatcher.registerHandler(consoleHandler);
    dispatcher.registerHandler(fileHandler);

    const payload: NotificationPayload = {
      type: 'build:complete',
      priority: 'high',
      title: 'Build Complete',
      message: 'Build finished successfully',
    };

    const result = await dispatcher.dispatch(payload);

    expect(result.success).toBe(true);
    expect(result.handledBy).toContain('console');
    expect(result.handledBy).toContain('file');
    expect(consoleSpy).toHaveBeenCalledOnce();
    expect(fileSpy).toHaveBeenCalledOnce();
  });

  it('should not dispatch to handlers below priority threshold', async () => {
    const consoleHandler = new ConsoleHandler({ minPriority: 'medium' });
    const fileHandler = new FileHandler('/tmp/notifications.log', { minPriority: 'high' });

    const consoleSpy = vi.spyOn(consoleHandler, 'handle').mockResolvedValue(undefined);
    const fileSpy = vi.spyOn(fileHandler, 'handle').mockResolvedValue(undefined);

    dispatcher.registerHandler(consoleHandler);
    dispatcher.registerHandler(fileHandler);

    await dispatcher.dispatch({
      type: 'task:failed',
      priority: 'medium',
      title: 'Task Failed',
      message: 'Task execution failed',
    });

    expect(consoleSpy).toHaveBeenCalledOnce();
    expect(fileSpy).not.toHaveBeenCalled();
  });

  it('should filter handlers by notification type', async () => {
    const consoleHandler = new ConsoleHandler({ types: ['build:complete', 'task:failed'] });
    const fileHandler = new FileHandler('/tmp/notifications.log', { types: ['security:alert'] });

    const consoleSpy = vi.spyOn(consoleHandler, 'handle').mockResolvedValue(undefined);
    const fileSpy = vi.spyOn(fileHandler, 'handle').mockResolvedValue(undefined);

    dispatcher.registerHandler(consoleHandler);
    dispatcher.registerHandler(fileHandler);

    await dispatcher.dispatch({
      type: 'security:alert',
      priority: 'critical',
      title: 'Security Alert',
      message: 'Unauthorized access detected',
    });

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(fileSpy).toHaveBeenCalledOnce();
  });

  it('should handle dispatch when no handlers match', async () => {
    const consoleHandler = new ConsoleHandler({ minPriority: 'high' });
    dispatcher.registerHandler(consoleHandler);

    const result = await dispatcher.dispatch({
      type: 'budget:exceeded',
      priority: 'low',
      title: 'Budget Exceeded',
      message: 'Monthly budget exceeded',
    });

    expect(result.success).toBe(true);
    expect(result.handledBy).toHaveLength(0);
  });

  it('should generate unique notification IDs', async () => {
    const results: string[] = [];
    const handler = {
      name: 'test',
      config: { minPriority: 'low' as PriorityLevel },
      handle: vi.fn(async (n) => {
        results.push(n.id);
      }),
    };

    dispatcher.registerHandler(handler);

    await dispatcher.dispatch({
      type: 'build:complete',
      priority: 'low',
      title: 'Build 1',
      message: 'First build',
    });

    await dispatcher.dispatch({
      type: 'build:complete',
      priority: 'low',
      title: 'Build 2',
      message: 'Second build',
    });

    expect(results[0]).not.toBe(results[1]);
    expect(results[0]).toMatch(/^notif-/);
    expect(results[1]).toMatch(/^notif-/);
  });

  it('should track errors from failed handlers', async () => {
    const goodHandler = {
      name: 'good',
      config: { minPriority: 'low' as PriorityLevel },
      handle: vi.fn().mockResolvedValue(undefined),
    };
    const badHandler = {
      name: 'bad',
      config: { minPriority: 'low' as PriorityLevel },
      handle: vi.fn().mockRejectedValue(new Error('Handler failed')),
    };

    dispatcher.registerHandler(goodHandler);
    dispatcher.registerHandler(badHandler);

    const result = await dispatcher.dispatch({
      type: 'task:failed',
      priority: 'high',
      title: 'Error Test',
      message: 'Testing error handling',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].handler).toBe('bad');
    expect(result.errors[0].error.message).toBe('Handler failed');
    expect(result.handledBy).toContain('good');
  });

  // ============================================================================
  // History Tracking
  // ============================================================================

  it('should track notification history', async () => {
    dispatcher.registerHandler(new ConsoleHandler());

    await dispatcher.dispatch({
      type: 'build:complete',
      priority: 'medium',
      title: 'Build Complete',
      message: 'Build finished',
    });

    const history = dispatcher.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].type).toBe('build:complete');
    expect(history[0].title).toBe('Build Complete');
  });

  it('should filter history by notification type', async () => {
    dispatcher.registerHandler(new ConsoleHandler());

    await dispatcher.dispatch({
      type: 'build:complete',
      priority: 'medium',
      title: 'Build Complete',
      message: 'Build finished',
    });

    await dispatcher.dispatch({
      type: 'security:alert',
      priority: 'critical',
      title: 'Security Alert',
      message: 'Alert!',
    });

    await dispatcher.dispatch({
      type: 'build:complete',
      priority: 'low',
      title: 'Another Build',
      message: 'Another build finished',
    });

    const buildHistory = dispatcher.getHistory('build:complete');
    expect(buildHistory).toHaveLength(2);
    expect(buildHistory.every((n) => n.type === 'build:complete')).toBe(true);
  });

  it('should get recent notifications', async () => {
    dispatcher.registerHandler(new ConsoleHandler());

    for (let i = 0; i < 5; i++) {
      await dispatcher.dispatch({
        type: 'build:complete',
        priority: 'low',
        title: `Build ${i}`,
        message: `Build ${i} finished`,
      });
    }

    const recent = dispatcher.getRecent(3);
    expect(recent).toHaveLength(3);
    expect(recent[2].title).toBe('Build 4');
  });

  it('should get notifications by priority', async () => {
    dispatcher.registerHandler(new ConsoleHandler());

    await dispatcher.dispatch({
      type: 'task:failed',
      priority: 'high',
      title: 'High Priority',
      message: 'High',
    });

    await dispatcher.dispatch({
      type: 'security:alert',
      priority: 'critical',
      title: 'Critical Priority',
      message: 'Critical',
    });

    await dispatcher.dispatch({
      type: 'budget:exceeded',
      priority: 'high',
      title: 'Another High',
      message: 'High',
    });

    const highNotifications = dispatcher.getByPriority('high');
    expect(highNotifications).toHaveLength(2);
    expect(highNotifications.every((n) => n.priority === 'high')).toBe(true);
  });

  it('should get notifications by time range', async () => {
    dispatcher.registerHandler(new ConsoleHandler());

    const startTime = Date.now();

    await dispatcher.dispatch({
      type: 'build:complete',
      priority: 'low',
      title: 'Build 1',
      message: 'First',
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const midTime = Date.now();

    await dispatcher.dispatch({
      type: 'build:complete',
      priority: 'low',
      title: 'Build 2',
      message: 'Second',
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const endTime = Date.now();

    const inRange = dispatcher.getByTimeRange(startTime, endTime);
    expect(inRange).toHaveLength(2);

    const afterMid = dispatcher.getByTimeRange(midTime, endTime);
    expect(afterMid).toHaveLength(1);
    expect(afterMid[0].title).toBe('Build 2');
  });

  it('should clear history', async () => {
    dispatcher.registerHandler(new ConsoleHandler());

    await dispatcher.dispatch({
      type: 'build:complete',
      priority: 'medium',
      title: 'Build',
      message: 'Done',
    });

    expect(dispatcher.getHistoryCount()).toBe(1);

    dispatcher.clearHistory();
    expect(dispatcher.getHistoryCount()).toBe(0);
  });

  it('should disable and enable history tracking', async () => {
    dispatcher.registerHandler(new ConsoleHandler());

    await dispatcher.dispatch({
      type: 'build:complete',
      priority: 'medium',
      title: 'First',
      message: 'First',
    });

    expect(dispatcher.isHistoryEnabled()).toBe(true);
    expect(dispatcher.getHistoryCount()).toBe(1);

    dispatcher.setHistoryEnabled(false);
    expect(dispatcher.isHistoryEnabled()).toBe(false);
    expect(dispatcher.getHistoryCount()).toBe(0);

    await dispatcher.dispatch({
      type: 'build:complete',
      priority: 'medium',
      title: 'Second',
      message: 'Second',
    });

    expect(dispatcher.getHistoryCount()).toBe(0);
  });

  // ============================================================================
  // Built-in Handlers
  // ============================================================================

  it('should create console handler with default config', () => {
    const handler = createConsoleHandler();
    expect(handler.name).toBe('console');
    expect(handler.config.minPriority).toBe('low');
  });

  it('should create console handler with custom config', () => {
    const handler = createConsoleHandler({ minPriority: 'high' });
    expect(handler.config.minPriority).toBe('high');
  });

  it('should create file handler with default config', () => {
    const handler = createFileHandler('/tmp/test.log');
    expect(handler.name).toBe('file');
    expect(handler.getFilePath()).toBe('/tmp/test.log');
    expect(handler.config.minPriority).toBe('medium');
  });

  it('should store and retrieve logs from file handler', async () => {
    const handler = new FileHandler('/tmp/test.log');

    await handler.handle({
      id: 'test-1',
      type: 'build:complete',
      priority: 'high',
      title: 'Test',
      message: 'Test message',
      timestamp: Date.now(),
    });

    const logs = handler.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].title).toBe('Test');
  });

  it('should create webhook handler with default config', () => {
    const handler = createWebhookHandler({ url: 'https://example.com/webhook' });
    expect(handler.name).toBe('webhook');
    expect(handler.getWebhookUrl()).toBe('https://example.com/webhook');
    expect(handler.config.minPriority).toBe('high');
  });

  it('should store webhook request details', async () => {
    const handler = new WebhookHandler({
      url: 'https://example.com/webhook',
      headers: { 'X-Custom': 'header' },
    });

    await handler.handle({
      id: 'test-1',
      type: 'security:alert',
      priority: 'critical',
      title: 'Alert',
      message: 'Security alert',
      timestamp: Date.now(),
    });

    const lastRequest = handler.getLastRequest();
    expect(lastRequest).toBeDefined();
    expect(lastRequest?.url).toBe('https://example.com/webhook');
    expect(lastRequest?.headers['Content-Type']).toBe('application/json');
    expect(lastRequest?.headers['X-Custom']).toBe('header');
  });

  // ============================================================================
  // Priority Utilities
  // ============================================================================

  it('should correctly compare priorities', () => {
    expect(isPriorityAtLeast('critical', 'high')).toBe(true);
    expect(isPriorityAtLeast('high', 'high')).toBe(true);
    expect(isPriorityAtLeast('medium', 'high')).toBe(false);
    expect(isPriorityAtLeast('low', 'medium')).toBe(false);
  });

  it('should sort priorities correctly', () => {
    expect(comparePriority('low', 'high')).toBeLessThan(0);
    expect(comparePriority('high', 'low')).toBeGreaterThan(0);
    expect(comparePriority('medium', 'medium')).toBe(0);
  });

  // ============================================================================
  // Singleton
  // ============================================================================

  it('should return the same global instance', () => {
    resetGlobalDispatcher();
    const d1 = getGlobalDispatcher();
    const d2 = getGlobalDispatcher();
    expect(d1).toBe(d2);
  });

  it('should reset global instance', () => {
    const d1 = getGlobalDispatcher();
    d1.registerHandler(new ConsoleHandler());

    resetGlobalDispatcher();
    const d2 = getGlobalDispatcher();

    expect(d2.getHandlerCount()).toBe(0);
    expect(d1).not.toBe(d2);
  });

  it('should set custom global instance', () => {
    const customDispatcher = new NotificationDispatcher();
    customDispatcher.registerHandler(new ConsoleHandler());

    setGlobalDispatcher(customDispatcher);
    const retrieved = getGlobalDispatcher();

    expect(retrieved).toBe(customDispatcher);
    expect(retrieved.getHandlerCount()).toBe(1);
  });

  // ============================================================================
  // Reset
  // ============================================================================

  it('should reset dispatcher state', async () => {
    dispatcher.registerHandler(new ConsoleHandler());

    await dispatcher.dispatch({
      type: 'build:complete',
      priority: 'medium',
      title: 'Build',
      message: 'Done',
    });

    expect(dispatcher.getHandlerCount()).toBe(1);
    expect(dispatcher.getHistoryCount()).toBe(1);

    dispatcher.reset();

    expect(dispatcher.getHandlerCount()).toBe(0);
    expect(dispatcher.getHistoryCount()).toBe(0);
  });
});
