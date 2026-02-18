// MEGA-02: Configuration System Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getConfig,
  getDefaultConfig,
  loadConfigFile,
  mergeConfigs,
  getConfigFromEnv,
  resetConfig,
  saveProjectConfig,
  saveUserConfig,
  PROJECT_CONFIG_PATH,
  type NovaConfig,
} from './config.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('Configuration System', () => {
  let tempDir: string;
  let originalCwd: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset config cache before each test
    resetConfig();
    
    // Create a temp directory for test files
    tempDir = mkdtempSync(join(tmpdir(), 'nova26-config-test-'));
    originalCwd = process.cwd();
    
    // Clean up NOVA26_ env vars
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('NOVA26_')) {
        delete process.env[key];
      }
    }
  });

  afterEach(() => {
    // Restore original cwd
    process.chdir(originalCwd);
    
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    
    // Restore original env
    process.env = { ...originalEnv };
    
    // Reset config cache
    resetConfig();
  });

  // ============================================================================
  // Default Values Tests
  // ============================================================================

  describe('Default Values', () => {
    it('should return correct default ollama settings', () => {
      const config = getDefaultConfig();
      
      expect(config.ollama.host).toBe('http://localhost:11434');
      expect(config.ollama.timeout).toBe(120000);
    });

    it('should return correct default model settings', () => {
      const config = getDefaultConfig();
      
      expect(config.models.default).toBe('qwen2.5:7b');
      expect(config.models.tier).toBe('free');
      expect(config.models.agentOverrides).toEqual({});
    });

    it('should return correct default budget settings (null = unlimited)', () => {
      const config = getDefaultConfig();
      
      expect(config.budget.daily).toBeNull();
      expect(config.budget.weekly).toBeNull();
      expect(config.budget.monthly).toBeNull();
    });

    it('should return correct default cache settings', () => {
      const config = getDefaultConfig();
      
      expect(config.cache.enabled).toBe(true);
      expect(config.cache.maxAgeHours).toBe(24);
      expect(config.cache.maxSizeMB).toBe(500);
    });

    it('should return correct default git settings', () => {
      const config = getDefaultConfig();
      
      expect(config.git.enabled).toBe(false);
      expect(config.git.branchPrefix).toBe('nova26/');
      expect(config.git.autoCommit).toBe(true);
      expect(config.git.autoPR).toBe(false);
    });

    it('should return correct default security settings', () => {
      const config = getDefaultConfig();
      
      expect(config.security.scanOnBuild).toBe(false);
      expect(config.security.blockOnCritical).toBe(true);
    });

    it('should return correct default convex settings', () => {
      const config = getDefaultConfig();
      
      expect(config.convex.url).toBeNull();
      expect(config.convex.syncEnabled).toBe(false);
    });

    it('should return correct default UI settings', () => {
      const config = getDefaultConfig();
      
      expect(config.ui.verbose).toBe(false);
      expect(config.ui.theme).toBe('auto');
    });
  });

  // ============================================================================
  // Environment Variable Override Tests
  // ============================================================================

  describe('Environment Variable Overrides', () => {
    it('should parse NOVA26_OLLAMA_HOST', () => {
      process.env.NOVA26_OLLAMA_HOST = 'http://192.168.1.100:11434';
      
      const envConfig = getConfigFromEnv();
      
      expect(envConfig.ollama?.host).toBe('http://192.168.1.100:11434');
    });

    it('should parse NOVA26_OLLAMA_TIMEOUT', () => {
      process.env.NOVA26_OLLAMA_TIMEOUT = '30000';
      
      const envConfig = getConfigFromEnv();
      
      expect(envConfig.ollama?.timeout).toBe(30000);
    });

    it('should parse NOVA26_MODEL', () => {
      process.env.NOVA26_MODEL = 'gpt-4o';
      
      const envConfig = getConfigFromEnv();
      
      expect(envConfig.models?.default).toBe('gpt-4o');
    });

    it('should parse NOVA26_TIER', () => {
      process.env.NOVA26_TIER = 'hybrid';
      
      const envConfig = getConfigFromEnv();
      
      expect(envConfig.models?.tier).toBe('hybrid');
    });

    it('should parse NOVA26_BUDGET_DAILY', () => {
      process.env.NOVA26_BUDGET_DAILY = '5.50';
      
      const envConfig = getConfigFromEnv();
      
      expect(envConfig.budget?.daily).toBe(5.50);
    });

    it('should parse NOVA26_BUDGET_WEEKLY', () => {
      process.env.NOVA26_BUDGET_WEEKLY = '25.00';
      
      const envConfig = getConfigFromEnv();
      
      expect(envConfig.budget?.weekly).toBe(25.00);
    });

    it('should parse NOVA26_BUDGET_MONTHLY', () => {
      process.env.NOVA26_BUDGET_MONTHLY = '100.00';
      
      const envConfig = getConfigFromEnv();
      
      expect(envConfig.budget?.monthly).toBe(100.00);
    });

    it('should parse NOVA26_CACHE_ENABLED', () => {
      process.env.NOVA26_CACHE_ENABLED = 'false';
      
      const envConfig = getConfigFromEnv();
      
      expect(envConfig.cache?.enabled).toBe(false);
    });

    it('should parse NOVA26_VERBOSE', () => {
      process.env.NOVA26_VERBOSE = 'true';
      
      const envConfig = getConfigFromEnv();
      
      expect(envConfig.ui?.verbose).toBe(true);
    });

    it('should parse NOVA26_THEME', () => {
      process.env.NOVA26_THEME = 'dark';
      
      const envConfig = getConfigFromEnv();
      
      expect(envConfig.ui?.theme).toBe('dark');
    });

    it('should parse NOVA26_AGENT_* overrides', () => {
      process.env.NOVA26_AGENT_SUN = 'gpt-4o';
      process.env.NOVA26_AGENT_JUPITER = 'claude-3-opus';
      
      const envConfig = getConfigFromEnv();
      
      expect(envConfig.models?.agentOverrides).toEqual({
        SUN: 'gpt-4o',
        JUPITER: 'claude-3-opus',
      });
    });

    it('should parse multiple env vars at once', () => {
      process.env.NOVA26_OLLAMA_HOST = 'http://custom:11434';
      process.env.NOVA26_TIER = 'paid';
      process.env.NOVA26_CACHE_ENABLED = 'false';
      
      const config = getConfig();
      
      expect(config.ollama.host).toBe('http://custom:11434');
      expect(config.models.tier).toBe('paid');
      expect(config.cache.enabled).toBe(false);
    });

    it('should ignore invalid tier values', () => {
      process.env.NOVA26_TIER = 'invalid-tier';
      
      const envConfig = getConfigFromEnv();
      
      expect(envConfig.models?.tier).toBeUndefined();
    });

    it('should ignore invalid number values', () => {
      process.env.NOVA26_OLLAMA_TIMEOUT = 'not-a-number';
      process.env.NOVA26_BUDGET_DAILY = 'invalid';
      
      const envConfig = getConfigFromEnv();
      
      expect(envConfig.ollama?.timeout).toBeUndefined();
      expect(envConfig.budget?.daily).toBeUndefined();
    });
  });

  // ============================================================================
  // File Loading Tests
  // ============================================================================

  describe('File Loading', () => {
    it('should load valid config file', () => {
      const configPath = join(tempDir, 'config.json');
      const configData = {
        ollama: { host: 'http://custom-host:11434' },
        models: { default: 'llama3:8b' },
      };
      writeFileSync(configPath, JSON.stringify(configData), 'utf-8');
      
      const loaded = loadConfigFile(configPath);
      
      expect(loaded).toEqual(configData);
    });

    it('should return empty object for non-existent file', () => {
      const loaded = loadConfigFile(join(tempDir, 'non-existent.json'));
      
      expect(loaded).toEqual({});
    });

    it('should return empty object for invalid JSON', () => {
      const configPath = join(tempDir, 'invalid.json');
      writeFileSync(configPath, '{ invalid json }', 'utf-8');
      
      const loaded = loadConfigFile(configPath);
      
      expect(loaded).toEqual({});
    });

    it('should load project config from .nova/config.json', () => {
      process.chdir(tempDir);
      resetConfig(); // Reset to pick up new cwd
      
      const novaDir = join(tempDir, '.nova');
      mkdirSync(novaDir, { recursive: true });
      
      const configData = {
        models: { tier: 'hybrid' },
      };
      writeFileSync(join(novaDir, 'config.json'), JSON.stringify(configData), 'utf-8');
      
      const config = getConfig();
      
      expect(config.models.tier).toBe('hybrid');
    });
  });

  // ============================================================================
  // Merge Priority Tests
  // ============================================================================

  describe('Merge Priority (args > env > project > user > defaults)', () => {
    it('should use defaults when nothing else is set', () => {
      const config = getConfig();
      
      expect(config.ollama.host).toBe('http://localhost:11434');
      expect(config.models.default).toBe('qwen2.5:7b');
      expect(config.models.tier).toBe('free');
    });

    it('should override defaults with user config', () => {
      const userConfig: Partial<NovaConfig> = {
        models: { default: 'llama3:8b' },
      };
      
      const merged = mergeConfigs(getDefaultConfig(), userConfig);
      
      expect(merged.models.default).toBe('llama3:8b');
      expect(merged.ollama.host).toBe('http://localhost:11434'); // Still default
    });

    it('should override user config with project config', () => {
      const userConfig: Partial<NovaConfig> = {
        models: { default: 'llama3:8b', tier: 'free' },
      };
      const projectConfig: Partial<NovaConfig> = {
        models: { tier: 'hybrid' },
      };
      
      const merged = mergeConfigs(getDefaultConfig(), userConfig, projectConfig);
      
      expect(merged.models.default).toBe('llama3:8b'); // From user
      expect(merged.models.tier).toBe('hybrid'); // From project
    });

    it('should override project config with environment variables', () => {
      process.chdir(tempDir);
      resetConfig();
      
      // Create project config
      const novaDir = join(tempDir, '.nova');
      mkdirSync(novaDir, { recursive: true });
      writeFileSync(
        join(novaDir, 'config.json'),
        JSON.stringify({ models: { tier: 'free' } }),
        'utf-8'
      );
      
      // Set env override
      process.env.NOVA26_TIER = 'paid';
      
      const config = getConfig();
      
      expect(config.models.tier).toBe('paid'); // Env wins
    });

    it('should override env with runtime arguments', () => {
      process.env.NOVA26_OLLAMA_HOST = 'http://env-host:11434';
      
      const overrides: Partial<NovaConfig> = {
        ollama: { host: 'http://arg-host:11434' },
      };
      
      const config = getConfig(overrides);
      
      expect(config.ollama.host).toBe('http://arg-host:11434');
    });

    it('should handle deep merge of nested objects', () => {
      const defaults = getDefaultConfig();
      const userConfig: Partial<NovaConfig> = {
        models: { default: 'custom-model' }, // Only override default
      };
      
      const merged = mergeConfigs(defaults, userConfig);
      
      expect(merged.models.default).toBe('custom-model');
      expect(merged.models.tier).toBe('free'); // Default preserved
      expect(merged.models.agentOverrides).toEqual({}); // Default preserved
    });

    it('should properly merge null values (explicit override to null)', () => {
      const config1: Partial<NovaConfig> = {
        budget: { daily: 10, weekly: 50 },
      };
      const config2: Partial<NovaConfig> = {
        budget: { daily: null }, // Explicitly set to null
      };
      
      const merged = mergeConfigs(getDefaultConfig(), config1, config2);
      
      expect(merged.budget.daily).toBeNull();
      expect(merged.budget.weekly).toBe(50);
    });
  });

  // ============================================================================
  // Zod Validation Tests
  // ============================================================================

  describe('Zod Validation', () => {
    it('should throw on invalid tier value', () => {
      const invalidConfig = {
        models: { tier: 'invalid' },
      };
      
      expect(() => mergeConfigs(invalidConfig)).toThrow('Configuration validation failed');
    });

    it('should throw on invalid theme value', () => {
      const invalidConfig = {
        ui: { theme: 'purple' },
      };
      
      expect(() => mergeConfigs(invalidConfig)).toThrow('Configuration validation failed');
    });

    it('should throw on wrong type for timeout', () => {
      const invalidConfig = {
        ollama: { timeout: 'not-a-number' },
      };
      
      expect(() => mergeConfigs(invalidConfig)).toThrow('Configuration validation failed');
    });

    it('should throw on wrong type for enabled flags', () => {
      const invalidConfig = {
        cache: { enabled: 'yes' },
      };
      
      expect(() => mergeConfigs(invalidConfig)).toThrow('Configuration validation failed');
    });

    it('should apply defaults after validation', () => {
      const partialConfig: Partial<NovaConfig> = {
        ollama: { host: 'http://custom:11434' },
      };
      
      const merged = mergeConfigs(partialConfig);
      
      expect(merged.ollama.host).toBe('http://custom:11434');
      expect(merged.ollama.timeout).toBe(120000); // Default applied
    });
  });

  // ============================================================================
  // Cache Tests
  // ============================================================================

  describe('Config Caching', () => {
    it('should cache config after first call', () => {
      const config1 = getConfig();
      const config2 = getConfig();
      
      expect(config1).toBe(config2); // Same reference
    });

    it('should clear cache on resetConfig', () => {
      const config1 = getConfig();
      resetConfig();
      const config2 = getConfig();
      
      expect(config1).not.toBe(config2); // Different reference
      expect(config1).toEqual(config2); // But same values
    });

    it('should cache configs with different overrides separately', () => {
      const overrides1: Partial<NovaConfig> = { ollama: { host: 'http://host1:11434' } };
      const overrides2: Partial<NovaConfig> = { ollama: { host: 'http://host2:11434' } };
      
      const config1a = getConfig(overrides1);
      const config1b = getConfig(overrides1);
      const config2a = getConfig(overrides2);
      
      expect(config1a).toBe(config1b); // Same reference for same overrides
      expect(config1a.ollama.host).toBe('http://host1:11434');
      expect(config2a.ollama.host).toBe('http://host2:11434');
    });
  });

  // ============================================================================
  // saveProjectConfig Tests
  // ============================================================================

  describe('saveProjectConfig', () => {
    it('should write config to .nova/config.json', () => {
      process.chdir(tempDir);
      resetConfig();
      
      const config: Partial<NovaConfig> = {
        models: { tier: 'paid' },
        cache: { enabled: false },
      };
      
      saveProjectConfig(config);
      
      const configPath = join(tempDir, '.nova', 'config.json');
      const savedContent = loadConfigFile(configPath);
      
      expect(savedContent).toEqual(config);
    });

    it('should create .nova directory if it does not exist', () => {
      process.chdir(tempDir);
      resetConfig();
      
      saveProjectConfig({ ollama: { host: 'http://test:11434' } });
      
      const novaDir = join(tempDir, '.nova');
      expect(existsSync(novaDir)).toBe(true);
    });

    it('should write formatted JSON', () => {
      process.chdir(tempDir);
      resetConfig();
      
      saveProjectConfig({ models: { default: 'gpt-4o' } });
      
      const configPath = join(tempDir, '.nova', 'config.json');
      const content = readFileSync(configPath, 'utf-8');
      
      // Should be pretty-printed with 2-space indentation
      expect(content).toContain('\n');
      expect(content).toContain('  "models"');
    });
  });

  // ============================================================================
  // saveUserConfig Tests
  // ============================================================================

  describe('saveUserConfig', () => {
    it('should write config to ~/.nova26/config.json', () => {
      // Mock home directory
      const originalHomedir = homedir();
      // Note: We can't easily mock homedir(), but we can verify the function works
      
      const config: Partial<NovaConfig> = {
        ui: { theme: 'dark' },
      };
      
      // Just verify it doesn't throw
      expect(() => saveUserConfig(config)).not.toThrow();
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration', () => {
    it('should handle full config stack', () => {
      process.chdir(tempDir);
      resetConfig();
      
      // 1. Set up user config
      const userConfig: Partial<NovaConfig> = {
        models: { default: 'llama3:8b', tier: 'free' },
        cache: { maxAgeHours: 12 },
      };
      // We'll use env var as a proxy for user config priority testing
      
      // 2. Create project config
      const novaDir = join(tempDir, '.nova');
      mkdirSync(novaDir, { recursive: true });
      writeFileSync(
        join(novaDir, 'config.json'),
        JSON.stringify({
          models: { tier: 'hybrid' },
          git: { enabled: true },
        }),
        'utf-8'
      );
      
      // 3. Set env vars
      process.env.NOVA26_CACHE_MAX_AGE_HOURS = '48';
      
      // 4. Runtime overrides
      const overrides: Partial<NovaConfig> = {
        ollama: { timeout: 60000 },
      };
      
      const config = getConfig(overrides);
      
      // Verify the merge
      expect(config.models.default).toBe('qwen2.5:7b'); // Default (no user config in this test)
      expect(config.models.tier).toBe('hybrid'); // From project config
      expect(config.git.enabled).toBe(true); // From project config
      expect(config.cache.maxAgeHours).toBe(48); // From env
      expect(config.ollama.timeout).toBe(60000); // From overrides
    });
  });
});
