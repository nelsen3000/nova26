import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FeatureFlagStore,
  getFeatureFlagStore,
  resetFeatureFlagStore,
} from '../feature-flags.js';

// Mock fs module for file-loading tests
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

import { readFileSync } from 'fs';

const mockedReadFileSync = vi.mocked(readFileSync);

describe('FeatureFlagStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFeatureFlagStore();
  });

  // ==========================================================================
  // Boolean Flag Get/Set
  // ==========================================================================

  describe('boolean flag get/set', () => {
    it('should return false for a default flag that is disabled', () => {
      const store = new FeatureFlagStore();
      expect(store.get('modelRouting')).toBe(false);
    });

    it('should return true after setting a boolean flag to true', () => {
      const store = new FeatureFlagStore();
      store.set('modelRouting', true);
      expect(store.get('modelRouting')).toBe(true);
    });

    it('should return false after setting a boolean flag to false', () => {
      const store = new FeatureFlagStore();
      store.set('modelRouting', true);
      store.set('modelRouting', false);
      expect(store.get('modelRouting')).toBe(false);
    });

    it('should support setting a new flag not in defaults', () => {
      const store = new FeatureFlagStore();
      store.set('customFlag', true);
      expect(store.get('customFlag')).toBe(true);
    });
  });

  // ==========================================================================
  // Variant Flag Get/Set
  // ==========================================================================

  describe('variant flag get/set', () => {
    it('should return variant string via getVariant', () => {
      const store = new FeatureFlagStore();
      store.set('experimentTheme', 'dark');
      expect(store.getVariant('experimentTheme')).toBe('dark');
    });

    it('should return null for a boolean flag via getVariant', () => {
      const store = new FeatureFlagStore();
      store.set('modelRouting', true);
      expect(store.getVariant('modelRouting')).toBeNull();
    });

    it('should treat variant flag as enabled via get()', () => {
      const store = new FeatureFlagStore();
      store.set('abTest', 'variant_a');
      expect(store.get('abTest')).toBe(true);
    });

    it('should treat empty string variant as disabled via get()', () => {
      const store = new FeatureFlagStore();
      store.set('abTest', '');
      expect(store.get('abTest')).toBe(false);
    });
  });

  // ==========================================================================
  // Environment Variable Loading
  // ==========================================================================

  describe('env var loading', () => {
    it('should load NOVA26_FF_MODEL_ROUTING=true as boolean true', () => {
      const store = new FeatureFlagStore();
      store.loadFromEnv({ NOVA26_FF_MODEL_ROUTING: 'true' });
      expect(store.get('modelRouting')).toBe(true);
    });

    it('should load NOVA26_FF_MODEL_ROUTING=false as boolean false', () => {
      const store = new FeatureFlagStore();
      store.loadFromEnv({ NOVA26_FF_MODEL_ROUTING: 'false' });
      expect(store.get('modelRouting')).toBe(false);
    });

    it('should load NOVA26_FF_MODEL_ROUTING=1 as boolean true', () => {
      const store = new FeatureFlagStore();
      store.loadFromEnv({ NOVA26_FF_MODEL_ROUTING: '1' });
      expect(store.get('modelRouting')).toBe(true);
    });

    it('should load NOVA26_FF_MODEL_ROUTING=0 as boolean false', () => {
      const store = new FeatureFlagStore();
      store.loadFromEnv({ NOVA26_FF_MODEL_ROUTING: '0' });
      expect(store.get('modelRouting')).toBe(false);
    });

    it('should load variant values from env', () => {
      const store = new FeatureFlagStore();
      store.loadFromEnv({ NOVA26_FF_EXPERIMENT: 'variant_b' });
      expect(store.getVariant('experiment')).toBe('variant_b');
    });

    it('should return the count of loaded flags', () => {
      const store = new FeatureFlagStore();
      const count = store.loadFromEnv({
        NOVA26_FF_MODEL_ROUTING: 'true',
        NOVA26_FF_PERPLEXITY: 'false',
        UNRELATED_VAR: 'ignored',
      });
      expect(count).toBe(2);
    });

    it('should ignore undefined env values', () => {
      const store = new FeatureFlagStore();
      const count = store.loadFromEnv({
        NOVA26_FF_MODEL_ROUTING: undefined,
      });
      expect(count).toBe(0);
    });
  });

  // ==========================================================================
  // File Loading
  // ==========================================================================

  describe('file loading', () => {
    it('should load boolean flags from a JSON file', () => {
      mockedReadFileSync.mockReturnValue(JSON.stringify({
        modelRouting: true,
        perplexity: false,
      }));

      const store = new FeatureFlagStore();
      const count = store.loadFromFile('/fake/flags.json');
      expect(count).toBe(2);
      expect(store.get('modelRouting')).toBe(true);
      expect(store.get('perplexity')).toBe(false);
    });

    it('should load variant flags from a JSON file', () => {
      mockedReadFileSync.mockReturnValue(JSON.stringify({
        theme: 'dark',
      }));

      const store = new FeatureFlagStore();
      store.loadFromFile('/fake/flags.json');
      expect(store.getVariant('theme')).toBe('dark');
    });

    it('should return 0 and not throw when file does not exist', () => {
      mockedReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const store = new FeatureFlagStore();
      const count = store.loadFromFile('/nonexistent/flags.json');
      expect(count).toBe(0);
    });

    it('should return 0 when file contains invalid JSON', () => {
      mockedReadFileSync.mockReturnValue('not valid json{{{');

      const store = new FeatureFlagStore();
      const count = store.loadFromFile('/fake/flags.json');
      expect(count).toBe(0);
    });

    it('should skip non-boolean and non-string values from file', () => {
      mockedReadFileSync.mockReturnValue(JSON.stringify({
        validFlag: true,
        numericFlag: 42,
        arrayFlag: [1, 2, 3],
      }));

      const store = new FeatureFlagStore();
      const count = store.loadFromFile('/fake/flags.json');
      expect(count).toBe(1);
    });
  });

  // ==========================================================================
  // Priority: env > file > default
  // ==========================================================================

  describe('priority resolution', () => {
    it('env should override file values', () => {
      mockedReadFileSync.mockReturnValue(JSON.stringify({
        modelRouting: false,
      }));

      const store = new FeatureFlagStore();
      store.loadFromEnv({ NOVA26_FF_MODEL_ROUTING: 'true' });
      store.loadFromFile('/fake/flags.json');
      expect(store.get('modelRouting')).toBe(true);
    });

    it('file should override default values', () => {
      mockedReadFileSync.mockReturnValue(JSON.stringify({
        modelRouting: true,
      }));

      const store = new FeatureFlagStore();
      store.loadFromFile('/fake/flags.json');
      expect(store.get('modelRouting')).toBe(true);
    });

    it('programmatic set should not override env values', () => {
      const store = new FeatureFlagStore();
      store.loadFromEnv({ NOVA26_FF_MODEL_ROUTING: 'true' });
      store.set('modelRouting', false);
      expect(store.get('modelRouting')).toBe(true);
    });

    it('programmatic set should not override file values', () => {
      mockedReadFileSync.mockReturnValue(JSON.stringify({
        perplexity: true,
      }));

      const store = new FeatureFlagStore();
      store.loadFromFile('/fake/flags.json');
      store.set('perplexity', false);
      expect(store.get('perplexity')).toBe(true);
    });
  });

  // ==========================================================================
  // listFlags
  // ==========================================================================

  describe('listFlags', () => {
    it('should return all default flags with source "default"', () => {
      const store = new FeatureFlagStore();
      const flags = store.listFlags();
      const defaultFlags = flags.filter(f => f.source === 'default');
      expect(defaultFlags.length).toBe(7);
      expect(defaultFlags.every(f => f.source === 'default')).toBe(true);
    });

    it('should mark env-loaded flags with source "env"', () => {
      const store = new FeatureFlagStore();
      store.loadFromEnv({ NOVA26_FF_MODEL_ROUTING: 'true' });
      const flags = store.listFlags();
      const envFlag = flags.find(f => f.name === 'modelRouting');
      expect(envFlag?.source).toBe('env');
      expect(envFlag?.value).toBe(true);
    });

    it('should mark file-loaded flags with source "file"', () => {
      mockedReadFileSync.mockReturnValue(JSON.stringify({
        perplexity: true,
      }));

      const store = new FeatureFlagStore();
      store.loadFromFile('/fake/flags.json');
      const flags = store.listFlags();
      const fileFlag = flags.find(f => f.name === 'perplexity');
      expect(fileFlag?.source).toBe('file');
      expect(fileFlag?.value).toBe(true);
    });

    it('should return flags sorted alphabetically by name', () => {
      const store = new FeatureFlagStore();
      const flags = store.listFlags();
      const names = flags.map(f => f.name);
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });
  });

  // ==========================================================================
  // Unknown Flags
  // ==========================================================================

  describe('unknown flags', () => {
    it('should return false for an unknown boolean flag', () => {
      const store = new FeatureFlagStore();
      expect(store.get('nonExistentFlag')).toBe(false);
    });

    it('should return null for an unknown variant flag', () => {
      const store = new FeatureFlagStore();
      expect(store.getVariant('nonExistentFlag')).toBeNull();
    });

    it('should return false for isEnabled on an unknown flag', () => {
      const store = new FeatureFlagStore();
      expect(store.isEnabled('nonExistentFlag')).toBe(false);
    });
  });

  // ==========================================================================
  // Reset
  // ==========================================================================

  describe('reset', () => {
    it('should clear all flags and restore defaults', () => {
      const store = new FeatureFlagStore();
      store.set('modelRouting', true);
      store.set('customFlag', true);
      store.reset();

      expect(store.get('modelRouting')).toBe(false);
      expect(store.get('customFlag')).toBe(false);
    });

    it('should clear env-loaded flags on reset', () => {
      const store = new FeatureFlagStore();
      store.loadFromEnv({ NOVA26_FF_MODEL_ROUTING: 'true' });
      expect(store.get('modelRouting')).toBe(true);

      store.reset();
      expect(store.get('modelRouting')).toBe(false);
    });
  });

  // ==========================================================================
  // Singleton Behavior
  // ==========================================================================

  describe('singleton', () => {
    it('should return the same instance on repeated calls', () => {
      const a = getFeatureFlagStore();
      const b = getFeatureFlagStore();
      expect(a).toBe(b);
    });

    it('should return a new instance after resetFeatureFlagStore', () => {
      const a = getFeatureFlagStore();
      resetFeatureFlagStore();
      const b = getFeatureFlagStore();
      expect(a).not.toBe(b);
    });

    it('should not share state after reset', () => {
      const a = getFeatureFlagStore();
      a.set('modelRouting', true);
      expect(a.get('modelRouting')).toBe(true);

      resetFeatureFlagStore();
      const b = getFeatureFlagStore();
      expect(b.get('modelRouting')).toBe(false);
    });
  });
});
