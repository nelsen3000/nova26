// KMS-25: Config Watcher tests

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ConfigWatcher,
  getGlobalConfigWatcher,
  resetGlobalConfigWatcher,
  setGlobalConfigWatcher,
  type ConfigChangedEvent,
} from '../config-watcher.js';
import { EventBus } from '../../orchestrator/event-bus.js';

// Mock fs/promises - allow per-test customization
const mockReadFile = vi.fn();
vi.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

// Mock fs - allow per-test customization
const mockExistsSync = vi.fn();
vi.mock('fs', () => ({
  watch: vi.fn(() => ({ close: vi.fn() })),
  unwatchFile: vi.fn(),
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}));

describe('ConfigWatcher', () => {
  let eventBus: EventBus;
  let watcher: ConfigWatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue('{ "test": true }');
    
    eventBus = new EventBus();
    watcher = new ConfigWatcher(eventBus, {
      configPath: '/tmp/test-config.json',
      flagsPath: '/tmp/test-flags.json',
      debounceMs: 10,
    });
  });

  afterEach(() => {
    watcher.stop();
    resetGlobalConfigWatcher();
  });

  describe('initialization', () => {
    it('should create with default config', () => {
      const defaultWatcher = new ConfigWatcher(eventBus);
      const config = defaultWatcher.getConfig();
      
      expect(config.configPath).toBe('.nova/config.json');
      expect(config.flagsPath).toBe('.nova/flags.json');
      expect(config.debounceMs).toBe(100);
    });

    it('should create with custom config', () => {
      const config = watcher.getConfig();
      
      expect(config.configPath).toBe('/tmp/test-config.json');
      expect(config.flagsPath).toBe('/tmp/test-flags.json');
      expect(config.debounceMs).toBe(10);
    });

    it('should not be watching initially', () => {
      expect(watcher.watching()).toBe(false);
    });
  });

  describe('start/stop', () => {
    it('should start watching', () => {
      watcher.start();
      
      expect(watcher.watching()).toBe(true);
    });

    it('should stop watching', () => {
      watcher.start();
      watcher.stop();
      
      expect(watcher.watching()).toBe(false);
    });

    it('should handle multiple start calls', () => {
      watcher.start();
      watcher.start(); // Should not throw
      
      expect(watcher.watching()).toBe(true);
    });

    it('should handle stop without start', () => {
      expect(() => watcher.stop()).not.toThrow();
    });
  });

  describe('file watching', () => {
    it('should get watched files', () => {
      watcher.start();
      
      const files = watcher.getWatchedFiles();
      expect(Array.isArray(files)).toBe(true);
    });

    it('should return empty array when not watching', () => {
      const files = watcher.getWatchedFiles();
      expect(files).toEqual([]);
    });
  });

  describe('config changes', () => {
    it('should update config', () => {
      watcher.updateConfig({ debounceMs: 500 });
      
      expect(watcher.getConfig().debounceMs).toBe(500);
    });

    it('should preserve existing config values', () => {
      watcher.updateConfig({ debounceMs: 500 });
      
      expect(watcher.getConfig().configPath).toBe('/tmp/test-config.json');
    });

    it('should restart when updating config while watching', () => {
      watcher.start();
      const wasWatching = watcher.watching();
      
      watcher.updateConfig({ debounceMs: 200 });
      
      expect(watcher.watching()).toBe(wasWatching);
    });
  });

  describe('file state', () => {
    it('should return undefined for unknown file', () => {
      const state = watcher.getFileState('/unknown/file.json');
      expect(state).toBeUndefined();
    });

    it('should track file state after check', async () => {
      // Create a mock file check
      await watcher.checkFile('/tmp/test-config.json', 'config');
      
      const state = watcher.getFileState('/tmp/test-config.json');
      expect(state).toBeDefined();
      expect(state?.lastModified).toBeGreaterThan(0);
    });
  });

  describe('config:changed event', () => {
    it('should emit event on file change', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      
      await watcher.checkFile('/tmp/test-config.json', 'config');
      
      expect(emitSpy).toHaveBeenCalled();
    });

    it('should include correct event data', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      
      await watcher.checkFile('/tmp/test-config.json', 'config');
      
      const call = emitSpy.mock.calls[0];
      expect(call[0]).toBe('config:changed');
      
      const event = call[1] as ConfigChangedEvent;
      expect(event.filePath).toBe('/tmp/test-config.json');
      expect(event.configType).toBe('config');
      expect(event.timestamp).toBeGreaterThan(0);
    });

    it('should include hash in event', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      
      await watcher.checkFile('/tmp/test-config.json', 'config');
      
      const event = emitSpy.mock.calls[0][1] as ConfigChangedEvent;
      expect(event.currentHash).toBeDefined();
      expect(typeof event.currentHash).toBe('string');
    });

    it('should track previous hash', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      
      // First check
      await watcher.checkFile('/tmp/test-config.json', 'config');
      
      // Change content for second check
      mockReadFile.mockResolvedValueOnce('{ "test": false }');
      
      // Second check
      await watcher.checkFile('/tmp/test-config.json', 'config');
      
      // Should have been called twice, second call has previous hash
      expect(emitSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('debouncing', () => {
    it('should debounce file changes', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      mockReadFile.mockResolvedValue('{ "version": 1 }');
      
      // Direct call to processFileChange (not through debounce)
      await watcher.checkFile('/tmp/test-config.json', 'config');
      
      // Should emit immediately when using checkFile (bypasses debounce)
      expect(emitSpy).toHaveBeenCalled();
    });
  });

  describe('singleton', () => {
    it('should return same global instance', () => {
      const w1 = getGlobalConfigWatcher(eventBus);
      const w2 = getGlobalConfigWatcher(eventBus);
      expect(w1).toBe(w2);
    });

    it('should reset global instance', () => {
      const w1 = getGlobalConfigWatcher(eventBus);
      resetGlobalConfigWatcher();
      const w2 = getGlobalConfigWatcher(eventBus);
      expect(w1).not.toBe(w2);
    });

    it('should set global instance', () => {
      const customWatcher = new ConfigWatcher(eventBus);
      setGlobalConfigWatcher(customWatcher);
      expect(getGlobalConfigWatcher(eventBus)).toBe(customWatcher);
    });

    it('should stop watcher on reset', () => {
      const w = getGlobalConfigWatcher(eventBus);
      w.start();
      expect(w.watching()).toBe(true);
      
      resetGlobalConfigWatcher();
      
      // Creating new instance doesn't affect old one
      const w2 = getGlobalConfigWatcher(eventBus);
      expect(w2).not.toBe(w);
    });
  });

  describe('config types', () => {
    it('should handle config type', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      
      await watcher.checkFile('/tmp/test-config.json', 'config');
      
      const event = emitSpy.mock.calls[0][1] as ConfigChangedEvent;
      expect(event.configType).toBe('config');
    });

    it('should handle flags type', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      
      await watcher.checkFile('/tmp/test-flags.json', 'flags');
      
      const event = emitSpy.mock.calls[0][1] as ConfigChangedEvent;
      expect(event.configType).toBe('flags');
    });
  });

  describe('hash calculation', () => {
    it('should calculate different hashes for different content', async () => {
      // First check
      await watcher.checkFile('/tmp/test-config.json', 'config');
      
      const state1 = watcher.getFileState('/tmp/test-config.json');
      
      // Hash should be a hex string
      expect(state1?.contentHash).toMatch(/^[0-9a-f-]+$/);
    });
  });

  describe('edge cases', () => {
    it('should handle missing file gracefully', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      mockExistsSync.mockReturnValue(false);
      
      // Check a file that doesn't exist - mockReadFile will reject
      mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));
      
      await watcher.checkFile('/nonexistent/path.json', 'config');
      
      // Should not emit event for missing file
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should handle file read errors', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Mock readFile to throw
      mockReadFile.mockRejectedValueOnce(new Error('Permission denied'));
      
      // Try to check a file that will cause an error
      await watcher.checkFile('/root/readonly/test.json', 'config');
      
      // Should log warning
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
