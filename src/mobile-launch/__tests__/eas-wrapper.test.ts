// EAS Wrapper Tests — R19-01

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EASWrapper,
  createEASWrapper,
} from '../eas-wrapper.js';
import type { EASConfig } from '../eas-wrapper.js';

describe('EASWrapper', () => {
  let wrapper: EASWrapper;
  const mockConfig: EASConfig = {
    projectId: 'test-project',
    cli: { version: '5.0.0', requireCommit: true },
    build: {
      development: {},
      preview: {},
      production: {},
    },
  };

  beforeEach(() => {
    wrapper = new EASWrapper(mockConfig);
  });

  describe('createBuild()', () => {
    it('should create a new build', async () => {
      const build = await wrapper.createBuild({
        profile: 'production',
        platform: 'ios',
        cacheEnabled: true,
        environmentVariables: {},
      });

      expect(build.id).toBeDefined();
      expect(build.status).toBe('pending');
      expect(build.profile).toBe('production');
    });

    it('should track build in internal map', async () => {
      const build = await wrapper.createBuild({
        profile: 'development',
        platform: 'android',
        cacheEnabled: false,
        environmentVariables: {},
      });

      const retrieved = await wrapper.getBuildStatus(build.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(build.id);
    });

    it('should handle all platforms', async () => {
      const build = await wrapper.createBuild({
        profile: 'preview',
        platform: 'all',
        cacheEnabled: true,
        environmentVariables: {},
      });

      expect(build.platform).toBe('ios'); // defaults to ios
    });
  });

  describe('getBuildStatus()', () => {
    it('should return undefined for non-existent build', async () => {
      const result = await wrapper.getBuildStatus('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should return current status', async () => {
      const build = await wrapper.createBuild({
        profile: 'production',
        platform: 'ios',
        cacheEnabled: true,
        environmentVariables: {},
      });

      const status = await wrapper.getBuildStatus(build.id);
      expect(status?.status).toBe('pending');
    });
  });

  describe('updateBuildStatus()', () => {
    it('should update build status', async () => {
      const build = await wrapper.createBuild({
        profile: 'production',
        platform: 'ios',
        cacheEnabled: true,
        environmentVariables: {},
      });

      wrapper.updateBuildStatus(build.id, 'in-progress');
      const updated = await wrapper.getBuildStatus(build.id);

      expect(updated?.status).toBe('in-progress');
    });

    it('should set completedAt when completed', async () => {
      const build = await wrapper.createBuild({
        profile: 'production',
        platform: 'ios',
        cacheEnabled: true,
        environmentVariables: {},
      });

      wrapper.updateBuildStatus(build.id, 'completed');
      const updated = await wrapper.getBuildStatus(build.id);

      expect(updated?.completedAt).toBeDefined();
    });

    it('should not fail for non-existent build', async () => {
      expect(() => {
        wrapper.updateBuildStatus('nonexistent', 'completed');
      }).not.toThrow();
    });
  });

  describe('waitForBuild()', () => {
    it('should resolve when build completes', async () => {
      const build = await wrapper.createBuild({
        profile: 'production',
        platform: 'ios',
        cacheEnabled: true,
        environmentVariables: {},
      });

      // Immediately complete
      wrapper.updateBuildStatus(build.id, 'completed');

      const result = await wrapper.waitForBuild(build.id, 1000);
      expect(result.status).toBe('completed');
    }, 10000);

    it('should throw when build fails', async () => {
      const build = await wrapper.createBuild({
        profile: 'production',
        platform: 'ios',
        cacheEnabled: true,
        environmentVariables: {},
      });

      wrapper.updateBuildStatus(build.id, 'failed');

      await expect(wrapper.waitForBuild(build.id, 5000)).rejects.toThrow('failed');
    });

    it('should throw for non-existent build', async () => {
      await expect(wrapper.waitForBuild('nonexistent', 1000)).rejects.toThrow('not found');
    });
  });

  describe('generateBuildConfig()', () => {
    it('should generate config for profile', () => {
      const config = wrapper.generateBuildConfig('production', 'ios', []);

      expect(config.profile).toBe('production');
      expect(config.platform).toBe('ios');
      expect(config.cacheEnabled).toBe(true);
    });

    it('should include Taste Vault recommendations when enabled', () => {
      const wrapperWithTaste = new EASWrapper(mockConfig, 0.8);
      const config = wrapperWithTaste.generateBuildConfig(
        'production',
        'ios',
        ['pattern1', 'pattern2']
      );

      expect(config.environmentVariables['TASTE_VAULT_PATTERN1']).toBe('enabled');
      expect(config.environmentVariables['TASTE_VAULT_PATTERN2']).toBe('enabled');
    });

    it('should not include Taste Vault when influence is 0', () => {
      const wrapperNoTaste = new EASWrapper(mockConfig, 0);
      const config = wrapperNoTaste.generateBuildConfig(
        'production',
        'ios',
        ['pattern1']
      );

      expect(Object.keys(config.environmentVariables)).toHaveLength(0);
    });
  });

  describe('submitToTestFlight()', () => {
    it('should return URL for completed build', async () => {
      const build = await wrapper.createBuild({
        profile: 'production',
        platform: 'ios',
        cacheEnabled: true,
        environmentVariables: {},
      });

      wrapper.updateBuildStatus(build.id, 'completed');
      const url = await wrapper.submitToTestFlight(build.id);

      expect(url).toContain('testflight');
    });

    it('should return undefined for incomplete build', async () => {
      const build = await wrapper.createBuild({
        profile: 'production',
        platform: 'ios',
        cacheEnabled: true,
        environmentVariables: {},
      });

      const url = await wrapper.submitToTestFlight(build.id);
      expect(url).toBeUndefined();
    });
  });

  describe('submitToPlayStore()', () => {
    it('should return URL for completed build', async () => {
      const build = await wrapper.createBuild({
        profile: 'production',
        platform: 'android',
        cacheEnabled: true,
        environmentVariables: {},
      });

      wrapper.updateBuildStatus(build.id, 'completed');
      const url = await wrapper.submitToPlayStore(build.id, 'internal');

      expect(url).toContain('play.google.com');
    });

    it('should support different tracks', async () => {
      const build = await wrapper.createBuild({
        profile: 'production',
        platform: 'android',
        cacheEnabled: true,
        environmentVariables: {},
      });

      wrapper.updateBuildStatus(build.id, 'completed');
      const url = await wrapper.submitToPlayStore(build.id, 'production');

      expect(url).toContain('production');
    });
  });

  describe('validateConfig()', () => {
    it('should validate complete config', () => {
      const result = wrapper.validateConfig();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing projectId', () => {
      const invalidConfig: EASConfig = {
        projectId: '',
        cli: { version: '5.0.0', requireCommit: true },
        build: { development: {}, preview: {}, production: {} },
      };
      const invalidWrapper = new EASWrapper(invalidConfig);
      const result = invalidWrapper.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('EAS projectId is required');
    });

    it('should detect missing CLI version', () => {
      const invalidConfig: EASConfig = {
        projectId: 'test',
        cli: { version: '', requireCommit: true },
        build: { development: {}, preview: {}, production: {} },
      };
      const invalidWrapper = new EASWrapper(invalidConfig);
      const result = invalidWrapper.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('EAS CLI version is required');
    });
  });

  describe('getBuildsByProfile() & getBuildsByPlatform()', () => {
    it('should filter by profile', async () => {
      await wrapper.createBuild({ profile: 'production', platform: 'ios', cacheEnabled: true, environmentVariables: {} });
      await wrapper.createBuild({ profile: 'development', platform: 'ios', cacheEnabled: true, environmentVariables: {} });
      await wrapper.createBuild({ profile: 'production', platform: 'ios', cacheEnabled: true, environmentVariables: {} });

      const prodBuilds = wrapper.getBuildsByProfile('production');
      expect(prodBuilds).toHaveLength(2);
    });

    it('should filter by platform', async () => {
      await wrapper.createBuild({ profile: 'production', platform: 'ios', cacheEnabled: true, environmentVariables: {} });
      await wrapper.createBuild({ profile: 'production', platform: 'android', cacheEnabled: true, environmentVariables: {} });

      const iosBuilds = wrapper.getBuildsByPlatform('ios');
      expect(iosBuilds).toHaveLength(1);
    });
  });

  describe('cancelBuild()', () => {
    it('should cancel pending build', async () => {
      const build = await wrapper.createBuild({
        profile: 'production',
        platform: 'ios',
        cacheEnabled: true,
        environmentVariables: {},
      });

      const cancelled = wrapper.cancelBuild(build.id);
      expect(cancelled).toBe(true);

      const status = await wrapper.getBuildStatus(build.id);
      expect(status?.status).toBe('failed');
    });

    it('should return false for completed build', async () => {
      const build = await wrapper.createBuild({
        profile: 'production',
        platform: 'ios',
        cacheEnabled: true,
        environmentVariables: {},
      });

      wrapper.updateBuildStatus(build.id, 'completed');
      const cancelled = wrapper.cancelBuild(build.id);

      expect(cancelled).toBe(false);
    });

    it('should return false for non-existent build', () => {
      const cancelled = wrapper.cancelBuild('nonexistent');
      expect(cancelled).toBe(false);
    });
  });

  describe('createEASWrapper()', () => {
    it('should create a new wrapper instance', () => {
      const wrapper = createEASWrapper(mockConfig);
      expect(wrapper).toBeInstanceOf(EASWrapper);
    });

    it('should accept taste vault influence', () => {
      const wrapper = createEASWrapper(mockConfig, 0.75);
      expect(wrapper).toBeDefined();
    });
  });
});
