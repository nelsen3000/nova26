// MEGA-04: Convex Real-Time Sync Layer Tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createConvexSyncClient,
  generateBuildId,
  retryWithDelay,
  resetDisabledLogged,
  type ConvexSyncOptions,
} from './sync.js';
import { setProjectConfigPath, resetConfig } from '../config/config.js';
import type { Task } from '../types/index.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('Convex Real-Time Sync Layer', () => {
  let tempDir: string;
  const originalEnv = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create a temp directory for test files
    tempDir = `/tmp/nova26-convex-test-${Date.now()}`;
    
    // Set a non-existent config path to prevent loading real project config
    setProjectConfigPath(`${tempDir}/non-existent-config.json`);
    resetConfig();
    resetDisabledLogged();
    
    // Clean up NOVA26_ env vars
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('NOVA26_')) {
        delete process.env[key];
      }
    }
    
    // Mock fetch
    fetchMock = vi.fn<typeof fetch>();
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
    
    // Reset config cache
    resetConfig();
    
    // Restore fetch
    vi.restoreAllMocks();
  });

  // ============================================================================
  // generateBuildId Tests
  // ============================================================================

  describe('generateBuildId', () => {
    it('should generate unique build IDs', () => {
      const id1 = generateBuildId();
      const id2 = generateBuildId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^build-[a-z0-9]+-[a-z0-9]+$/);
      expect(id2).toMatch(/^build-[a-z0-9]+-[a-z0-9]+$/);
    });

    it('should include timestamp and random parts', () => {
      const id = generateBuildId();
      const parts = id.split('-');
      
      expect(parts.length).toBe(3);
      expect(parts[0]).toBe('build');
      expect(parts[1].length).toBeGreaterThan(0); // timestamp
      expect(parts[2].length).toBe(6); // random
    });
  });

  // ============================================================================
  // retryWithDelay Tests
  // ============================================================================

  describe('retryWithDelay', () => {
    it('should return result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await retryWithDelay(fn, 1, 100);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('first failure'))
        .mockResolvedValue('success');
      
      const start = Date.now();
      const result = await retryWithDelay(fn, 1, 50);
      const duration = Date.now() - start;
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(duration).toBeGreaterThanOrEqual(50); // Should wait for retry delay
    });

    it('should return null after all retries exhausted', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));
      
      const result = await retryWithDelay(fn, 1, 10);
      
      expect(result).toBeNull();
      expect(fn).toHaveBeenCalledTimes(2); // initial + 1 retry
    });

    it('should handle non-Error throws', async () => {
      const fn = vi.fn().mockRejectedValue('string error');
      
      const result = await retryWithDelay(fn, 0, 10);
      
      expect(result).toBeNull();
    });

    it('should respect retry count', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      
      await retryWithDelay(fn, 2, 10);
      
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });
  });

  // ============================================================================
  // Graceful Degradation Tests
  // ============================================================================

  describe('Graceful Degradation', () => {
    it('should return no-op client when no URL configured', () => {
      const client = createConvexSyncClient();
      
      expect(client.enabled).toBe(false);
      expect(client.buildId).toBeNull();
    });

    it('should return no-op client when explicitly disabled', () => {
      const options: ConvexSyncOptions = {
        url: 'https://example.convex.cloud',
        enabled: false,
      };
      
      const client = createConvexSyncClient(options);
      
      expect(client.enabled).toBe(false);
    });

    it('should log disabled message only once', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      createConvexSyncClient();
      createConvexSyncClient();
      createConvexSyncClient();
      
      // Should only log once despite multiple calls
      const disabledLogs = consoleSpy.mock.calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('Convex sync disabled')
      );
      expect(disabledLogs.length).toBe(1);
      
      consoleSpy.mockRestore();
    });

    it('no-op startBuild should return disabled string', async () => {
      const client = createConvexSyncClient();
      
      const buildId = await client.startBuild('test-prd');
      
      expect(buildId).toBe('disabled');
    });

    it('no-op methods should not throw', async () => {
      const client = createConvexSyncClient();
      
      const task: Task = {
        id: 'test-task',
        title: 'Test Task',
        description: 'Test description',
        agent: 'MARS',
        status: 'running',
        dependencies: [],
        phase: 1,
        attempts: 0,
        createdAt: new Date().toISOString(),
      };
      
      await expect(client.logTask(task, 'running')).resolves.not.toThrow();
      await expect(client.logExecution('task-1', 'gpt-4', 100, 1000)).resolves.not.toThrow();
      await expect(client.completeBuild(true)).resolves.not.toThrow();
      await expect(client.logLearning('MARS', 'auth_pattern')).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // Enabled Client Tests
  // ============================================================================

  describe('Enabled Client', () => {
    const mockUrl = 'https://test.convex.cloud';
    
    beforeEach(() => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, result: { buildId: 'conv-123' } }),
      });
    });

    it('should create enabled client with URL and enabled flag', () => {
      const options: ConvexSyncOptions = {
        url: mockUrl,
        enabled: true,
      };
      
      const client = createConvexSyncClient(options);
      
      expect(client.enabled).toBe(true);
      expect(client.buildId).not.toBeNull();
    });

    it('should call atlas:startBuild on startBuild', async () => {
      const options: ConvexSyncOptions = {
        url: mockUrl,
        enabled: true,
        maxRetries: 0,
      };
      
      const client = createConvexSyncClient(options);
      await client.startBuild('my-prd');
      
      expect(fetchMock).toHaveBeenCalledWith(
        `${mockUrl}/api/mutation`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('atlas:startBuild'),
        })
      );
      
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.path).toBe('atlas:startBuild');
      expect(body.args.prdName).toBe('my-prd');
    });

    it('should call atlas:logTask on logTask', async () => {
      const options: ConvexSyncOptions = {
        url: mockUrl,
        enabled: true,
        maxRetries: 0,
      };
      
      const client = createConvexSyncClient(options);
      await client.startBuild('my-prd');
      
      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'Test description',
        agent: 'MARS',
        status: 'running',
        dependencies: ['dep-1'],
        phase: 2,
        attempts: 1,
        createdAt: new Date().toISOString(),
      };
      
      await client.logTask(task, 'running');
      
      const logTaskCall = fetchMock.mock.calls.find(
        call => call[1].body.includes('atlas:logTask')
      );
      expect(logTaskCall).toBeDefined();
      if (!logTaskCall) throw new Error('logTaskCall not found');
      
      const body = JSON.parse(logTaskCall[1].body as string);
      expect(body.path).toBe('atlas:logTask');
      expect(body.args.taskId).toBe('task-1');
      expect(body.args.agent).toBe('MARS');
      expect(body.args.status).toBe('running');
    });

    it('should call atlas:logExecution on logExecution', async () => {
      const options: ConvexSyncOptions = {
        url: mockUrl,
        enabled: true,
        maxRetries: 0,
      };
      
      const client = createConvexSyncClient(options);
      await client.startBuild('my-prd');
      await client.logExecution('task-1', 'gpt-4o', 150, 2000);
      
      const logExecCall = fetchMock.mock.calls.find(
        call => call[1].body.includes('atlas:logExecution')
      );
      expect(logExecCall).toBeDefined();
      if (!logExecCall) throw new Error('logExecCall not found');
      
      const body = JSON.parse(logExecCall[1].body as string);
      expect(body.path).toBe('atlas:logExecution');
      expect(body.args.model).toBe('gpt-4o');
      expect(body.args.tokens).toBe(150);
      expect(body.args.duration).toBe(2000);
    });

    it('should call atlas:completeBuild on completeBuild', async () => {
      const options: ConvexSyncOptions = {
        url: mockUrl,
        enabled: true,
        maxRetries: 0,
      };
      
      const client = createConvexSyncClient(options);
      await client.startBuild('my-prd');
      await client.completeBuild(true);
      
      const completeCall = fetchMock.mock.calls.find(
        call => call[1].body.includes('atlas:completeBuild')
      );
      expect(completeCall).toBeDefined();
      if (!completeCall) throw new Error('completeCall not found');
      
      const body = JSON.parse(completeCall[1].body as string);
      expect(body.path).toBe('atlas:completeBuild');
      expect(body.args.status).toBe('completed');
    });

    it('should call atlas:logLearning on logLearning', async () => {
      const options: ConvexSyncOptions = {
        url: mockUrl,
        enabled: true,
        maxRetries: 0,
      };
      
      const client = createConvexSyncClient(options);
      await client.startBuild('my-prd');
      await client.logLearning('MARS', 'auth_pattern');
      
      const learningCall = fetchMock.mock.calls.find(
        call => call[1].body.includes('atlas:logLearning')
      );
      expect(learningCall).toBeDefined();
      if (!learningCall) throw new Error('learningCall not found');
      
      const body = JSON.parse(learningCall[1].body as string);
      expect(body.path).toBe('atlas:logLearning');
      expect(body.args.agent).toBe('MARS');
      expect(body.args.pattern).toBe('auth_pattern');
    });
  });

  // ============================================================================
  // Build Lifecycle Tests
  // ============================================================================

  describe('Build Lifecycle', () => {
    const mockUrl = 'https://test.convex.cloud';
    
    beforeEach(() => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, result: { buildId: 'conv-123' } }),
      });
    });

    it('should execute full build lifecycle: startBuild → logTask → logExecution → completeBuild', async () => {
      const options: ConvexSyncOptions = {
        url: mockUrl,
        enabled: true,
        maxRetries: 0,
      };
      
      const client = createConvexSyncClient(options);
      
      // Start build
      const buildId = await client.startBuild('my-prd');
      expect(buildId).not.toBeNull();
      
      // Log task
      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'Test',
        agent: 'MARS',
        status: 'running',
        dependencies: [],
        phase: 1,
        attempts: 0,
        createdAt: new Date().toISOString(),
      };
      await client.logTask(task, 'running');
      
      // Log execution
      await client.logExecution('task-1', 'gpt-4', 100, 1000);
      
      // Complete build
      await client.completeBuild(true);
      
      // Verify all calls were made in order
      const paths = fetchMock.mock.calls.map(call => {
        const body = JSON.parse(call[1].body);
        return body.path;
      });
      
      expect(paths).toEqual([
        'atlas:startBuild',
        'atlas:logTask',
        'atlas:logExecution',
        'atlas:completeBuild',
      ]);
    });

    it('should mark build as failed on completeBuild(false)', async () => {
      const options: ConvexSyncOptions = {
        url: mockUrl,
        enabled: true,
        maxRetries: 0,
      };
      
      const client = createConvexSyncClient(options);
      await client.startBuild('my-prd');
      await client.completeBuild(false);
      
      const completeCall = fetchMock.mock.calls.find(
        call => call[1].body.includes('atlas:completeBuild')
      );
      expect(completeCall).toBeDefined();
      if (!completeCall) throw new Error('completeCall not found');
      const body = JSON.parse(completeCall[1].body as string);
      expect(body.args.status).toBe('failed');
    });
  });

  // ============================================================================
  // Retry Logic Tests
  // ============================================================================

  describe('Retry Logic', () => {
    const mockUrl = 'https://test.convex.cloud';
    
    it('should retry failed calls', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, result: { buildId: 'conv-123' } }),
        });
      
      const options: ConvexSyncOptions = {
        url: mockUrl,
        enabled: true,
        maxRetries: 1,
        retryDelayMs: 10,
      };
      
      const client = createConvexSyncClient(options);
      const buildId = await client.startBuild('my-prd');
      
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(buildId).toBe('conv-123');
    });

    it('should not throw when all retries fail', async () => {
      fetchMock.mockRejectedValue(new Error('Persistent failure'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const options: ConvexSyncOptions = {
        url: mockUrl,
        enabled: true,
        maxRetries: 1,
        retryDelayMs: 10,
      };
      
      const client = createConvexSyncClient(options);
      
      // Should not throw even though the call fails
      await expect(client.startBuild('my-prd')).resolves.not.toThrow();
      
      expect(fetchMock).toHaveBeenCalledTimes(2); // initial + 1 retry
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ConvexSync] Failed after')
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle HTTP error responses', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });
      
      const options: ConvexSyncOptions = {
        url: mockUrl,
        enabled: true,
        maxRetries: 0,
      };
      
      const client = createConvexSyncClient(options);
      
      // Should not throw, just log and return null
      await expect(client.startBuild('my-prd')).resolves.not.toThrow();
    });

    it('should handle Convex error responses', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, error: 'Invalid arguments' }),
      });
      
      const options: ConvexSyncOptions = {
        url: mockUrl,
        enabled: true,
        maxRetries: 0,
      };
      
      const client = createConvexSyncClient(options);
      
      // Should not throw, just log and return null
      await expect(client.startBuild('my-prd')).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    const mockUrl = 'https://test.convex.cloud';
    
    it('should handle malformed JSON responses gracefully', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); },
      });
      
      const options: ConvexSyncOptions = {
        url: mockUrl,
        enabled: true,
        maxRetries: 0,
      };
      
      const client = createConvexSyncClient(options);
      
      await expect(client.startBuild('my-prd')).resolves.not.toThrow();
    });

    it('should handle network timeouts', async () => {
      fetchMock.mockRejectedValue(new Error('Timeout'));
      
      const options: ConvexSyncOptions = {
        url: mockUrl,
        enabled: true,
        maxRetries: 0,
      };
      
      const client = createConvexSyncClient(options);
      
      await expect(client.startBuild('my-prd')).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // Configuration Priority Tests
  // ============================================================================

  describe('Configuration Priority', () => {
    it('should use options over config', () => {
      // First create with no URL (should be disabled)
      const client1 = createConvexSyncClient();
      expect(client1.enabled).toBe(false);
      
      // Now create with explicit URL in options
      const client2 = createConvexSyncClient({
        url: 'https://test.convex.cloud',
        enabled: true,
      });
      expect(client2.enabled).toBe(true);
    });

    it('should use CONVEX_URL environment variable', () => {
      process.env.CONVEX_URL = 'https://env.convex.cloud';
      
      // Mock fetch to prevent actual calls
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      
      // Should use env var and be enabled if syncEnabled is true in config
      // But since default config has syncEnabled: false, we need to enable it
      const client = createConvexSyncClient({
        enabled: true,  // Enable via options
        maxRetries: 0,
      });
      
      // Client should be enabled because CONVEX_URL is set and we enabled it
      expect(client.enabled).toBe(true);
    });
  });

  // ============================================================================
  // No-Op When Disabled Tests
  // ============================================================================

  describe('No-Op When Disabled', () => {
    it('should not make any HTTP calls when disabled', async () => {
      const client = createConvexSyncClient();
      
      await client.startBuild('test');
      await client.logTask({} as Task, 'running');
      await client.logExecution('t1', 'm', 1, 1);
      await client.completeBuild(true);
      await client.logLearning('A', 'p');
      
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should not block execution flow when disabled', async () => {
      const client = createConvexSyncClient();
      
      const start = Date.now();
      await client.startBuild('test');
      await client.completeBuild(true);
      const duration = Date.now() - start;
      
      // Should complete almost instantly (no network calls)
      expect(duration).toBeLessThan(50);
    });
  });
});
