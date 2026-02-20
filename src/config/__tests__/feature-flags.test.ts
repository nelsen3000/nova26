// MX-09/KMS-22: Feature Flag Registry tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FeatureFlagRegistry,
  getGlobalRegistry,
  resetGlobalRegistry,
  setGlobalRegistry,
  registerDefaultFlags,
} from '../feature-flags.js';

describe('FeatureFlagRegistry', () => {
  let registry: FeatureFlagRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new FeatureFlagRegistry();
  });

  describe('registration', () => {
    it('should register a boolean flag', () => {
      registry.register({
        name: 'test-flag',
        description: 'A test flag',
        defaultValue: true,
        type: 'boolean',
      });

      expect(registry.has('test-flag')).toBe(true);
      expect(registry.getBoolean('test-flag')).toBe(true);
    });

    it('should register a string flag', () => {
      registry.register({
        name: 'env-flag',
        description: 'Environment',
        defaultValue: 'development',
        type: 'string',
      });

      expect(registry.getString('env-flag')).toBe('development');
    });

    it('should register a number flag', () => {
      registry.register({
        name: 'timeout',
        description: 'Timeout value',
        defaultValue: 5000,
        type: 'number',
      });

      expect(registry.get('timeout')).toBe(5000);
    });

    it('should return undefined for unknown flags', () => {
      expect(registry.get('unknown')).toBeUndefined();
      expect(registry.has('unknown')).toBe(false);
    });
  });

  describe('setting values', () => {
    beforeEach(() => {
      registry.register({
        name: 'feature-a',
        description: 'Feature A',
        defaultValue: false,
        type: 'boolean',
      });
    });

    it('should set a flag value', () => {
      const success = registry.set('feature-a', true);
      expect(success).toBe(true);
      expect(registry.getBoolean('feature-a')).toBe(true);
    });

    it('should return false for unknown flags', () => {
      const success = registry.set('unknown-flag', true);
      expect(success).toBe(false);
    });

    it('should track source as programmatic', () => {
      registry.set('feature-a', true);
      expect(registry.getSource('feature-a')).toBe('programmatic');
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      registry.register({
        name: 'resettable',
        description: 'Reset me',
        defaultValue: 'default',
        type: 'string',
      });
      registry.set('resettable', 'changed');
    });

    it('should reset a single flag to default', () => {
      expect(registry.get('resettable')).toBe('changed');
      
      registry.reset('resettable');
      
      expect(registry.get('resettable')).toBe('default');
      expect(registry.getSource('resettable')).toBe('default');
    });

    it('should reset all flags', () => {
      registry.register({
        name: 'another',
        description: 'Another flag',
        defaultValue: 100,
        type: 'number',
      });
      registry.set('another', 200);

      registry.resetAll();

      expect(registry.get('resettable')).toBe('default');
      expect(registry.get('another')).toBe(100);
    });

    it('should return false for resetting unknown flag', () => {
      expect(registry.reset('unknown')).toBe(false);
    });
  });

  describe('environment variables', () => {
    beforeEach(() => {
      registry.register({
        name: 'env-test',
        description: 'From env',
        defaultValue: false,
        type: 'boolean',
      });
    });

    it('should load boolean from env', () => {
      process.env.NOVA26_FF_ENV_TEST = 'true';
      registry.loadFromEnv();
      
      expect(registry.getBoolean('env-test')).toBe(true);
      expect(registry.getSource('env-test')).toBe('env');
      
      delete process.env.NOVA26_FF_ENV_TEST;
    });

    it('should load string from env', () => {
      registry.register({
        name: 'env-string',
        description: 'String from env',
        defaultValue: 'default',
        type: 'string',
      });
      
      process.env.NOVA26_FF_ENV_STRING = 'from-env';
      registry.loadFromEnv();
      
      expect(registry.getString('env-string')).toBe('from-env');
      
      delete process.env.NOVA26_FF_ENV_STRING;
    });

    it('should handle numeric env values', () => {
      registry.register({
        name: 'env-num',
        description: 'Number from env',
        defaultValue: 0,
        type: 'number',
      });
      
      process.env.NOVA26_FF_ENV_NUM = '42';
      registry.loadFromEnv();
      
      expect(registry.get('env-num')).toBe(42);
      
      delete process.env.NOVA26_FF_ENV_NUM;
    });
  });

  describe('getAllStates', () => {
    it('should return all flag states', () => {
      registry.register({
        name: 'flag-1',
        description: 'First',
        defaultValue: true,
        type: 'boolean',
      });
      registry.register({
        name: 'flag-2',
        description: 'Second',
        defaultValue: 'value',
        type: 'string',
      });

      const states = registry.getAllStates();

      expect(states).toHaveLength(2);
      expect(states.map(s => s.name)).toContain('flag-1');
      expect(states.map(s => s.name)).toContain('flag-2');
    });

    it('should include descriptions', () => {
      registry.register({
        name: 'described',
        description: 'This is described',
        defaultValue: true,
        type: 'boolean',
      });

      const states = registry.getAllStates();

      expect(states[0].description).toBe('This is described');
    });
  });

  describe('default Nova26 flags', () => {
    it('should register default flags', () => {
      registerDefaultFlags(registry);

      expect(registry.has('model-routing')).toBe(true);
      expect(registry.has('perplexity')).toBe(true);
      expect(registry.has('workflow-engine')).toBe(true);
      expect(registry.has('infinite-memory')).toBe(true);
      expect(registry.has('cinematic-observability')).toBe(true);
      expect(registry.has('ai-model-database')).toBe(true);
      expect(registry.has('crdt-collaboration')).toBe(true);
      expect(registry.has('experimental-features')).toBe(true);
    });

    it('should have correct defaults', () => {
      registerDefaultFlags(registry);

      expect(registry.getBoolean('model-routing')).toBe(true);
      expect(registry.getBoolean('perplexity')).toBe(false);
      expect(registry.getBoolean('workflow-engine')).toBe(true);
      expect(registry.getBoolean('infinite-memory')).toBe(false);
    });
  });

  describe('singleton', () => {
    it('should return same global registry', () => {
      const r1 = getGlobalRegistry();
      const r2 = getGlobalRegistry();
      expect(r1).toBe(r2);
    });

    it('should reset global registry', () => {
      const r1 = getGlobalRegistry();
      resetGlobalRegistry();
      const r2 = getGlobalRegistry();
      expect(r1).not.toBe(r2);
    });

    it('should set global registry', () => {
      const custom = new FeatureFlagRegistry();
      setGlobalRegistry(custom);
      expect(getGlobalRegistry()).toBe(custom);
    });
  });

  describe('edge cases', () => {
    it('should handle empty registry', () => {
      expect(registry.getAllNames()).toEqual([]);
      expect(registry.getAllStates()).toEqual([]);
    });

    it('should clear all flags', () => {
      registry.register({
        name: 'to-clear',
        description: 'Will be cleared',
        defaultValue: true,
        type: 'boolean',
      });

      registry.clear();

      expect(registry.has('to-clear')).toBe(false);
    });

    it('should get string representation of non-string values', () => {
      registry.register({
        name: 'bool-as-string',
        description: 'Bool',
        defaultValue: true,
        type: 'boolean',
      });

      expect(registry.getString('bool-as-string')).toBe('true');
    });
  });
});
