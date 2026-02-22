// Ollama Bridge Tests — R20-02
// Comprehensive vitest tests for MockOllamaBridge

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockOllamaBridge, OllamaBridgeImpl } from '../ollama-bridge.js';
import type { NativeBridge } from '../types.js';
import type { OllamaStatus, NativeBridge, FileChangeEvent, GitStatus } from '../types.js';

describe('MockOllamaBridge', () => {
  let bridge: MockOllamaBridge;

  beforeEach(() => {
    bridge = new MockOllamaBridge();
  });

  // ============================================================
  // Auto-start (4 tests)
  // ============================================================
  describe('Auto-start', () => {
    it('start launches Ollama', async () => {
      expect(await bridge.isRunning()).toBe(false);
      
      await bridge.start();
      
      expect(await bridge.isRunning()).toBe(true);
    });

    it('isRunning returns true after start', async () => {
      await bridge.start();
      
      const running = await bridge.isRunning();
      
      expect(running).toBe(true);
    });

    it('isRunning returns false when stopped', async () => {
      await bridge.start();
      expect(await bridge.isRunning()).toBe(true);
      
      await bridge.stop();
      
      expect(await bridge.isRunning()).toBe(false);
    });

    it('start throws on failure', async () => {
      bridge.setShouldFailStart(true);
      
      await expect(bridge.start()).rejects.toThrow('Failed to start Ollama');
      expect(await bridge.isRunning()).toBe(false);
    });
  });

  // ============================================================
  // Health check (4 tests)
  // ============================================================
  describe('Health check', () => {
    it('getStatus returns OllamaStatus', async () => {
      await bridge.start();
      
      const status: OllamaStatus = await bridge.getStatus();
      
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });

    it('status has correct structure', async () => {
      await bridge.start();
      
      const status: OllamaStatus = await bridge.getStatus();
      
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('port');
      expect(status).toHaveProperty('models');
      expect(typeof status.running).toBe('boolean');
      expect(typeof status.port).toBe('number');
      expect(Array.isArray(status.models)).toBe(true);
    });

    it('status reflects running state', async () => {
      // Initially not running
      let status: OllamaStatus = await bridge.getStatus();
      expect(status.running).toBe(false);
      
      // After start
      await bridge.start();
      status = await bridge.getStatus();
      expect(status.running).toBe(true);
      
      // After stop
      await bridge.stop();
      status = await bridge.getStatus();
      expect(status.running).toBe(false);
    });

    it('listModels returns models', async () => {
      const expectedModels: string[] = ['llama2', 'codellama', 'mistral'];
      bridge.setModels(expectedModels);
      await bridge.start();
      
      const models: string[] = await bridge.listModels();
      
      expect(models).toEqual(expectedModels);
    });
  });

  // ============================================================
  // Port detection (3 tests)
  // ============================================================
  describe('Port detection', () => {
    it('detectPort returns port when running', async () => {
      const expectedPort = 11434;
      bridge.setPort(expectedPort);
      await bridge.start();
      
      const port: number | null = await bridge.detectPort();
      
      expect(port).toBe(expectedPort);
    });

    it('detectPort returns null when stopped', async () => {
      expect(await bridge.isRunning()).toBe(false);
      
      const port: number | null = await bridge.detectPort();
      
      expect(port).toBeNull();
    });

    it('checks common ports', async () => {
      const customPort = 11435;
      bridge.setPort(customPort);
      await bridge.start();
      
      const port: number | null = await bridge.detectPort();
      
      expect(port).toBe(customPort);
      expect([11434, 11435, 11436]).toContain(port);
    });
  });

  // ============================================================
  // Stop (3 tests)
  // ============================================================
  describe('Stop', () => {
    it('stop stops Ollama', async () => {
      await bridge.start();
      expect(await bridge.isRunning()).toBe(true);
      
      await bridge.stop();
      
      expect(await bridge.isRunning()).toBe(false);
    });

    it('isRunning false after stop', async () => {
      await bridge.start();
      await bridge.stop();
      
      const running: boolean = await bridge.isRunning();
      
      expect(running).toBe(false);
    });

    it('graceful shutdown', async () => {
      await bridge.start();
      const statusBefore: OllamaStatus = await bridge.getStatus();
      expect(statusBefore.running).toBe(true);
      
      await bridge.stop();
      
      const statusAfter: OllamaStatus = await bridge.getStatus();
      expect(statusAfter.running).toBe(false);
      // Port should still be reported even when stopped
      expect(statusAfter.port).toBe(statusBefore.port);
    });
  });

  // ============================================================
  // Wait for ready (4 tests)
  // ============================================================
  describe('Wait for ready', () => {
    it('waitForReady returns true when running', async () => {
      await bridge.start();
      
      const ready: boolean = await bridge.waitForReady();
      
      expect(ready).toBe(true);
    });

    it('waitForReady respects timeout', async () => {
      // Don't start Ollama, so it never becomes ready
      const timeoutMs = 200;
      const startTime = Date.now();
      
      const ready: boolean = await bridge.waitForReady(timeoutMs);
      const elapsed = Date.now() - startTime;
      
      expect(ready).toBe(false);
      // Should respect timeout with some margin for execution
      expect(elapsed).toBeGreaterThanOrEqual(timeoutMs - 50);
      expect(elapsed).toBeLessThan(timeoutMs + 200);
    });

    it('waits and retries', async () => {
      const startDelay = 300;
      bridge.setStartDelay(startDelay);
      
      // Start Ollama asynchronously (it will take 300ms)
      const startPromise = bridge.start();
      
      // Immediately call waitForReady with a generous timeout
      const waitPromise = bridge.waitForReady(2000);
      
      // Both should complete successfully
      const [_, ready] = await Promise.all([startPromise, waitPromise]);
      
      expect(ready).toBe(true);
      expect(await bridge.isRunning()).toBe(true);
    });

    it('hasModel checks availability', async () => {
      const availableModels: string[] = ['llama2', 'codellama', 'mistral'];
      bridge.setModels(availableModels);
      await bridge.start();
      
      const hasLlama2: boolean = await bridge.hasModel('llama2');
      const hasCodellama: boolean = await bridge.hasModel('codellama');
      const hasUnknown: boolean = await bridge.hasModel('unknown-model');
      
      expect(hasLlama2).toBe(true);
      expect(hasCodellama).toBe(true);
      expect(hasUnknown).toBe(false);
    });
  });
});

// ─── OllamaBridgeImpl retry tests ────────────────────────────────────────────

function makeMockNativeBridge(invokeImpl: NativeBridge['invoke']): NativeBridge {
  return {
    invoke: invokeImpl,
    listen: vi.fn() as unknown as NativeBridge['listen'],
    fileSystem: {
      readFile: vi.fn<[string], Promise<string>>(),
      writeFile: vi.fn<[string, string], Promise<void>>(),
      watchDir: vi.fn<[string, (event: FileChangeEvent) => void], () => void>(),
    },
    git: {
      commit: vi.fn<[string, string[]], Promise<string>>(),
      status: vi.fn<[], Promise<GitStatus>>(),
    },
    notifications: {
      send: vi.fn<[string, string], Promise<void>>(),
    },
  };
}

describe('OllamaBridgeImpl start() retry', () => {
  it('succeeds on first attempt with no retries', async () => {
    const invokeFn = vi.fn<[string, Record<string, unknown>?], Promise<void>>().mockResolvedValue(undefined);
    const nativeBridge = makeMockNativeBridge(invokeFn as unknown as NativeBridge['invoke']);
    const ollama = new OllamaBridgeImpl(nativeBridge);

    await expect(ollama.start()).resolves.toBeUndefined();

    expect(invokeFn).toHaveBeenCalledTimes(1);
    expect(invokeFn).toHaveBeenCalledWith('spawn_ollama');
  });

  it('retries and succeeds after one failure', async () => {
    let callCount = 0;
    const invokeFn = vi.fn().mockImplementation(async (cmd: string) => {
      if (cmd === 'spawn_ollama') {
        callCount++;
        if (callCount < 2) throw new Error('spawn failed');
      }
    });
    const nativeBridge = makeMockNativeBridge(invokeFn as unknown as NativeBridge['invoke']);
    const ollama = new OllamaBridgeImpl(nativeBridge);

    await expect(ollama.start(2)).resolves.toBeUndefined();

    expect(callCount).toBe(2);
  }, 5000);

  it('throws the last error after maxRetries=1 is exhausted', async () => {
    const invokeFn = vi.fn().mockRejectedValue(new Error('persistent failure'));
    const nativeBridge = makeMockNativeBridge(invokeFn as unknown as NativeBridge['invoke']);
    const ollama = new OllamaBridgeImpl(nativeBridge);

    await expect(ollama.start(1)).rejects.toThrow('persistent failure');
    // maxRetries=1: only one attempt, no delays
    expect(invokeFn).toHaveBeenCalledTimes(1);
  });

  it('attempts exactly maxRetries times before giving up', async () => {
    const invokeFn = vi.fn().mockRejectedValue(new Error('always fails'));
    const nativeBridge = makeMockNativeBridge(invokeFn as unknown as NativeBridge['invoke']);
    const ollama = new OllamaBridgeImpl(nativeBridge);

    await expect(ollama.start(1)).rejects.toThrow();
    expect(invokeFn).toHaveBeenCalledTimes(1);
  });
});
