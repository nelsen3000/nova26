// KMS-29: Plugin Loader Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PluginLoader,
  PluginSchema,
  getGlobalPluginLoader,
  resetGlobalPluginLoader,
  setGlobalPluginLoader,
  registerPluginsIntoRegistry,
  type Plugin,
  type PluginLoadResult,
} from '../plugin-loader.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
}));

import { readdir, readFile, stat } from 'fs/promises';

describe('PluginLoader', () => {
  let loader: PluginLoader;
  const mockReaddir = readdir as unknown as ReturnType<typeof vi.fn>;
  const mockReadFile = readFile as unknown as ReturnType<typeof vi.fn>;
  const mockStat = stat as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    loader = new PluginLoader('/test/plugins');
  });

  describe('constructor', () => {
    it('should create with default directory', () => {
      const defaultLoader = new PluginLoader();
      expect(defaultLoader).toBeDefined();
    });

    it('should create with custom directory', () => {
      const customLoader = new PluginLoader('/custom/path');
      expect(customLoader).toBeDefined();
    });
  });

  describe('validatePlugin', () => {
    it('should validate correct plugin', () => {
      const plugin = {
        name: 'test-plugin',
        version: '1.0.0',
      };

      const result = loader.validatePlugin(plugin);
      expect(result.valid).toBe(true);
    });

    it('should reject plugin without name', () => {
      const plugin = {
        version: '1.0.0',
      };

      const result = loader.validatePlugin(plugin);
      expect(result.valid).toBe(false);
    });

    it('should reject plugin with invalid version', () => {
      const plugin = {
        name: 'test-plugin',
        version: 'invalid',
      };

      const result = loader.validatePlugin(plugin);
      expect(result.valid).toBe(false);
    });

    it('should accept plugin with hooks', () => {
      const plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          onBeforeBuild: async () => {},
        },
      };

      const result = loader.validatePlugin(plugin);
      expect(result.valid).toBe(true);
    });
  });

  describe('loadFromDirectory', () => {
    it('should load valid plugin', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        name: 'test-plugin',
        version: '1.0.0',
      }));

      const result = await loader.loadFromDirectory('/test/plugins/test-plugin');

      expect(result.success).toBe(true);
      expect(result.plugin).toBeDefined();
      expect(result.plugin?.name).toBe('test-plugin');
    });

    it('should fail if plugin.json not found', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const result = await loader.loadFromDirectory('/test/plugins/test-plugin');

      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });

    it('should fail if plugin.json is invalid JSON', async () => {
      mockReadFile.mockResolvedValue('not valid json');

      const result = await loader.loadFromDirectory('/test/plugins/test-plugin');

      expect(result.success).toBe(false);
    });

    it('should fail if plugin is missing required fields', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        version: '1.0.0',
        // missing name
      }));

      const result = await loader.loadFromDirectory('/test/plugins/test-plugin');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid plugin format');
    });

    it('should load plugin with hooks', async () => {
      const mockHook = async () => {};
      mockReadFile.mockResolvedValue(JSON.stringify({
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          onBeforeBuild: undefined, // Hooks from JSON can't have functions, will be validated as schema allows any function
        },
      }));

      const result = await loader.loadFromDirectory('/test/plugins/test-plugin');

      expect(result.success).toBe(true);
      // Hooks structure is validated but functions can't be loaded from JSON
    });
  });

  describe('loadAll', () => {
    it('should load all plugins from directory', async () => {
      mockReaddir.mockResolvedValue(['plugin-a', 'plugin-b']);
      mockStat.mockResolvedValue({ isDirectory: () => true });
      mockReadFile.mockResolvedValue(JSON.stringify({
        name: 'test-plugin',
        version: '1.0.0',
      }));

      const summary = await loader.loadAll();

      expect(summary.total).toBe(2);
      expect(summary.loaded).toHaveLength(2);
    });

    it('should skip non-directory entries', async () => {
      mockReaddir.mockResolvedValue(['plugin-a', 'file.txt']);
      mockStat
        .mockResolvedValueOnce({ isDirectory: () => true })
        .mockResolvedValueOnce({ isDirectory: () => false });
      mockReadFile.mockResolvedValue(JSON.stringify({
        name: 'test-plugin',
        version: '1.0.0',
      }));

      const summary = await loader.loadAll();

      expect(summary.total).toBe(1);
    });

    it('should handle missing plugins directory', async () => {
      mockReaddir.mockRejectedValue({ code: 'ENOENT' });

      const summary = await loader.loadAll();

      expect(summary.total).toBe(0);
      expect(summary.loaded).toHaveLength(0);
    });

    it('should report failed plugins', async () => {
      mockReaddir.mockResolvedValue(['plugin-a']);
      mockStat.mockResolvedValue({ isDirectory: () => true });
      mockReadFile.mockRejectedValue(new Error('Permission denied'));

      const summary = await loader.loadAll();

      expect(summary.failed).toHaveLength(1);
      expect(summary.failed[0].name).toBe('plugin-a');
    });
  });

  describe('plugin management', () => {
    it('should get all plugins', async () => {
      mockReaddir.mockResolvedValue(['test-plugin']);
      mockStat.mockResolvedValue({ isDirectory: () => true });
      mockReadFile.mockResolvedValue(JSON.stringify({
        name: 'test-plugin',
        version: '1.0.0',
      }));

      await loader.loadAll();
      const plugins = loader.getAllPlugins();

      expect(plugins).toHaveLength(1);
    });

    it('should get specific plugin', async () => {
      mockReaddir.mockResolvedValue(['test-plugin']);
      mockStat.mockResolvedValue({ isDirectory: () => true });
      mockReadFile.mockResolvedValue(JSON.stringify({
        name: 'test-plugin',
        version: '1.0.0',
      }));

      await loader.loadAll();
      const plugin = loader.getPlugin('test-plugin');

      expect(plugin).toBeDefined();
      expect(plugin?.name).toBe('test-plugin');
    });

    it('should return undefined for unknown plugin', () => {
      const plugin = loader.getPlugin('unknown');
      expect(plugin).toBeUndefined();
    });

    it('should check if plugin is loaded', async () => {
      mockReaddir.mockResolvedValue(['test-plugin']);
      mockStat.mockResolvedValue({ isDirectory: () => true });
      mockReadFile.mockResolvedValue(JSON.stringify({
        name: 'test-plugin',
        version: '1.0.0',
      }));

      await loader.loadAll();

      expect(loader.hasPlugin('test-plugin')).toBe(true);
      expect(loader.hasPlugin('unknown')).toBe(false);
    });

    it('should unload plugin', async () => {
      mockReaddir.mockResolvedValue(['test-plugin']);
      mockStat.mockResolvedValue({ isDirectory: () => true });
      mockReadFile.mockResolvedValue(JSON.stringify({
        name: 'test-plugin',
        version: '1.0.0',
      }));

      await loader.loadAll();
      const unloaded = loader.unloadPlugin('test-plugin');

      expect(unloaded).toBe(true);
      expect(loader.hasPlugin('test-plugin')).toBe(false);
    });

    it('should return false when unloading unknown plugin', () => {
      const unloaded = loader.unloadPlugin('unknown');
      expect(unloaded).toBe(false);
    });

    it('should clear all plugins', async () => {
      mockReaddir.mockResolvedValue(['test-plugin']);
      mockStat.mockResolvedValue({ isDirectory: () => true });
      mockReadFile.mockResolvedValue(JSON.stringify({
        name: 'test-plugin',
        version: '1.0.0',
      }));

      await loader.loadAll();
      loader.clear();

      expect(loader.getPluginCount()).toBe(0);
    });

    it('should get plugin count', async () => {
      mockReaddir.mockResolvedValue(['test-plugin']);
      mockStat.mockResolvedValue({ isDirectory: () => true });
      mockReadFile.mockResolvedValue(JSON.stringify({
        name: 'test-plugin',
        version: '1.0.0',
      }));

      await loader.loadAll();

      expect(loader.getPluginCount()).toBe(1);
    });
  });

  describe('hook merging', () => {
    it('should merge hooks', () => {
      const baseHandler = vi.fn();
      const pluginHandler = vi.fn();

      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          onBeforeBuild: pluginHandler as any,
        },
      };

      const merged = loader.mergeHooks(
        { onBeforeBuild: baseHandler as any },
        plugin
      );

      expect(merged.onBeforeBuild).toBeDefined();
    });

    it('should chain handlers', async () => {
      const calls: string[] = [];
      const baseHandler = async () => { calls.push('base'); };
      const pluginHandler = async () => { calls.push('plugin'); };

      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          onBeforeBuild: pluginHandler as any,
        },
      };

      const merged = loader.mergeHooks(
        { onBeforeBuild: baseHandler as any },
        plugin
      );

      await merged.onBeforeBuild?.({} as any);

      expect(calls).toEqual(['base', 'plugin']);
    });

    it('should use plugin handler when base is undefined', () => {
      const pluginHandler = vi.fn();

      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          onBeforeBuild: pluginHandler as any,
        },
      };

      const merged = loader.mergeHooks({}, plugin);

      expect(merged.onBeforeBuild).toBe(pluginHandler);
    });

    it('should use base handler when plugin has no hooks', () => {
      const baseHandler = vi.fn();
      const plugin: Plugin = {
        name: 'test',
        version: '1.0.0',
      };

      const merged = loader.mergeHooks(
        { onBeforeBuild: baseHandler as any },
        plugin
      );

      expect(merged.onBeforeBuild).toBe(baseHandler);
    });
  });
});

describe('PluginSchema', () => {
  it('should validate minimal plugin', () => {
    const result = PluginSchema.safeParse({
      name: 'test',
      version: '1.0.0',
    });

    expect(result.success).toBe(true);
  });

  it('should validate plugin with all hooks', () => {
    const result = PluginSchema.safeParse({
      name: 'test',
      version: '1.0.0',
      hooks: {
        onBeforeBuild: async () => {},
        onBeforeTask: async () => {},
        onAfterTask: async () => {},
        onTaskError: async () => {},
        onHandoff: async () => {},
        onBuildComplete: async () => {},
      },
    });

    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = PluginSchema.safeParse({
      name: '',
      version: '1.0.0',
    });

    expect(result.success).toBe(false);
  });

  it('should reject long name', () => {
    const result = PluginSchema.safeParse({
      name: 'a'.repeat(101),
      version: '1.0.0',
    });

    expect(result.success).toBe(false);
  });

  it('should reject invalid version format', () => {
    const result = PluginSchema.safeParse({
      name: 'test',
      version: 'not-a-version',
    });

    expect(result.success).toBe(false);
  });
});

describe('registerPluginsIntoRegistry', () => {
  it('should register plugins into registry', () => {
    const loader = new PluginLoader();
    // Manually add a plugin with hooks
    const mockPlugin: Plugin = {
      name: 'test-plugin',
      version: '1.0.0',
      hooks: {
        onBeforeBuild: vi.fn() as any,
      },
    };
    loader['loadedPlugins'].set('test-plugin', mockPlugin);

    const mockRegistry = {
      register: vi.fn(),
    };

    registerPluginsIntoRegistry(loader, mockRegistry);

    expect(mockRegistry.register).toHaveBeenCalledWith(
      expect.any(Object),
      100
    );
  });

  it('should not register plugins without hooks', () => {
    const loader = new PluginLoader();
    // Manually add a plugin without hooks
    const mockPlugin: Plugin = {
      name: 'test-plugin',
      version: '1.0.0',
    };
    loader['loadedPlugins'].set('test-plugin', mockPlugin);

    const mockRegistry = {
      register: vi.fn(),
    };

    registerPluginsIntoRegistry(loader, mockRegistry);

    expect(mockRegistry.register).not.toHaveBeenCalled();
  });
});

describe('Global plugin loader', () => {
  beforeEach(() => {
    resetGlobalPluginLoader();
  });

  it('should return same global instance', () => {
    const l1 = getGlobalPluginLoader();
    const l2 = getGlobalPluginLoader();
    expect(l1).toBe(l2);
  });

  it('should reset global instance', () => {
    const l1 = getGlobalPluginLoader();
    resetGlobalPluginLoader();
    const l2 = getGlobalPluginLoader();
    expect(l1).not.toBe(l2);
  });

  it('should set global instance', () => {
    const customLoader = new PluginLoader('/custom');
    setGlobalPluginLoader(customLoader);
    expect(getGlobalPluginLoader()).toBe(customLoader);
  });
});
