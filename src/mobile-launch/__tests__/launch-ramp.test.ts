// Launch Ramp Tests — R19-01

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LaunchRamp,
  createLaunchRamp,
} from '../launch-ramp.js';
import type { MobileLaunchProfile } from '../types.js';

describe('LaunchRamp', () => {
  let ramp: LaunchRamp;

  beforeEach(() => {
    ramp = new LaunchRamp();
  });

  describe('registerProfile() & getProfile()', () => {
    it('should register and retrieve a profile', () => {
      const profile: MobileLaunchProfile = {
        id: 'test-profile',
        name: 'development',
        platforms: ['ios', 'android'],
        easConfig: {},
        tasteVaultWeight: 0.5,
        aso: {
          keywords: ['test', 'app'],
          subtitle: 'Test App',
          description: 'A test app',
          suggestedCategories: ['Productivity'],
          projectedScore: 75,
          locale: 'en-US',
        },
        rehearsalStage: false,
      };

      ramp.registerProfile(profile);
      const retrieved = ramp.getProfile('test-profile');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-profile');
    });

    it('should return undefined for non-existent profile', () => {
      const result = ramp.getProfile('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should get profiles by name', () => {
      ramp.registerProfile({
        id: 'dev-1',
        name: 'development',
        platforms: ['ios'],
        easConfig: {},
        tasteVaultWeight: 0.5,
        aso: { keywords: [], subtitle: '', description: '', suggestedCategories: [], projectedScore: 0, locale: 'en-US' },
        rehearsalStage: false,
      });

      ramp.registerProfile({
        id: 'prod-1',
        name: 'production',
        platforms: ['ios', 'android'],
        easConfig: {},
        tasteVaultWeight: 0.8,
        aso: { keywords: [], subtitle: '', description: '', suggestedCategories: [], projectedScore: 0, locale: 'en-US' },
        rehearsalStage: true,
      });

      const devProfiles = ramp.getProfilesByName('development');
      expect(devProfiles).toHaveLength(1);
      expect(devProfiles[0].id).toBe('dev-1');
    });
  });

  describe('execute()', () => {
    it('should execute full pipeline successfully', async () => {
      const profile: MobileLaunchProfile = {
        id: 'test-profile',
        name: 'development',
        platforms: ['ios'],
        easConfig: {},
        tasteVaultWeight: 0.5,
        aso: {
          keywords: ['test'],
          subtitle: 'Test',
          description: 'Test app',
          suggestedCategories: ['Productivity'],
          projectedScore: 80,
          locale: 'en-US',
        },
        rehearsalStage: false,
      };

      ramp.registerProfile(profile);
      const result = await ramp.execute('test-profile');

      expect(result.status).toBe('success');
      expect(result.buildId).toBeDefined();
      expect(result.testflightLink).toContain('testflight');
    });

    it('should return failed for missing profile', async () => {
      const result = await ramp.execute('nonexistent');
      expect(result.status).toBe('failed');
    });

    it('should support dry run mode', async () => {
      const profile: MobileLaunchProfile = {
        id: 'test-profile',
        name: 'development',
        platforms: ['ios'],
        easConfig: {},
        tasteVaultWeight: 0.5,
        aso: { keywords: ['test'], subtitle: '', description: '', suggestedCategories: [], projectedScore: 0, locale: 'en-US' },
        rehearsalStage: false,
      };

      ramp.registerProfile(profile);
      const result = await ramp.execute('test-profile', { dryRun: true });

      expect(result.status).toBe('success');
    });

    it('should skip phases when requested', async () => {
      const profile: MobileLaunchProfile = {
        id: 'test-profile',
        name: 'development',
        platforms: ['ios'],
        easConfig: {},
        tasteVaultWeight: 0.5,
        aso: { keywords: ['test'], subtitle: '', description: '', suggestedCategories: [], projectedScore: 0, locale: 'en-US' },
        rehearsalStage: true,
      };

      ramp.registerProfile(profile);
      const result = await ramp.execute('test-profile', {
        skipAssets: true,
        skipASO: true,
        skipRehearsal: true,
      });

      expect(result.status).toBe('success');
    });

    it('should handle platform-specific links', async () => {
      const iosProfile: MobileLaunchProfile = {
        id: 'ios-only',
        name: 'production',
        platforms: ['ios'],
        easConfig: {},
        tasteVaultWeight: 0.5,
        aso: { keywords: [], subtitle: '', description: '', suggestedCategories: [], projectedScore: 0, locale: 'en-US' },
        rehearsalStage: false,
      };

      ramp.registerProfile(iosProfile);
      const result = await ramp.execute('ios-only');

      expect(result.testflightLink).toBeDefined();
      expect(result.playStoreLink).toBeUndefined();
    });

    it('should accept profile via options', async () => {
      const profile: MobileLaunchProfile = {
        id: 'inline-profile',
        name: 'development',
        platforms: ['android'],
        easConfig: {},
        tasteVaultWeight: 0.5,
        aso: { keywords: ['test'], subtitle: '', description: '', suggestedCategories: [], projectedScore: 0, locale: 'en-US' },
        rehearsalStage: false,
      };

      const result = await ramp.execute('any-id', { profile });
      expect(result.status).toBe('success');
    });
  });

  describe('validateProfile()', () => {
    it('should validate a complete profile', () => {
      const profile: MobileLaunchProfile = {
        id: 'valid',
        name: 'production',
        platforms: ['ios', 'android'],
        easConfig: {},
        tasteVaultWeight: 0.5,
        aso: {
          keywords: ['app', 'mobile'],
          subtitle: 'Great App',
          description: 'A great app',
          suggestedCategories: ['Productivity'],
          projectedScore: 85,
          locale: 'en-US',
        },
        rehearsalStage: true,
      };

      const result = ramp.validateProfile(profile);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing ID', () => {
      const profile = {
        id: '',
        name: 'development',
        platforms: ['ios'],
        easConfig: {},
        tasteVaultWeight: 0.5,
        aso: { keywords: [], subtitle: '', description: '', suggestedCategories: [], projectedScore: 0, locale: 'en-US' },
        rehearsalStage: false,
      } as MobileLaunchProfile;

      const result = ramp.validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Profile ID is required');
    });

    it('should detect missing platforms', () => {
      const profile = {
        id: 'test',
        name: 'development',
        platforms: [],
        easConfig: {},
        tasteVaultWeight: 0.5,
        aso: { keywords: [], subtitle: '', description: '', suggestedCategories: [], projectedScore: 0, locale: 'en-US' },
        rehearsalStage: false,
      } as MobileLaunchProfile;

      const result = ramp.validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one platform must be specified');
    });

    it('should detect invalid tasteVaultWeight', () => {
      const profile = {
        id: 'test',
        name: 'development',
        platforms: ['ios'],
        easConfig: {},
        tasteVaultWeight: 1.5,
        aso: { keywords: [], subtitle: '', description: '', suggestedCategories: [], projectedScore: 0, locale: 'en-US' },
        rehearsalStage: false,
      } as MobileLaunchProfile;

      const result = ramp.validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('tasteVaultWeight must be between 0 and 1');
    });

    it('should detect missing ASO keywords', () => {
      const profile = {
        id: 'test',
        name: 'development',
        platforms: ['ios'],
        easConfig: {},
        tasteVaultWeight: 0.5,
        aso: { keywords: [], subtitle: '', description: '', suggestedCategories: [], projectedScore: 0, locale: 'en-US' },
        rehearsalStage: false,
      } as MobileLaunchProfile;

      const result = ramp.validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ASO configuration with keywords is required');
    });
  });

  describe('generateAssetConfig()', () => {
    it('should generate config for development profile', () => {
      const profile: MobileLaunchProfile = {
        id: 'dev',
        name: 'development',
        platforms: ['ios'],
        easConfig: {},
        tasteVaultWeight: 0.5,
        aso: { keywords: ['test'], subtitle: '', description: '', suggestedCategories: [], projectedScore: 0, locale: 'en-US' },
        rehearsalStage: false,
      };

      const config = ramp.generateAssetConfig(profile);
      expect(config.icon.sizes).toContain(1024);
      expect(config.splash.darkMode).toBe(true);
      expect(config.screenshots.captionStyle).toBe('minimal');
    });

    it('should generate config for production profile', () => {
      const profile: MobileLaunchProfile = {
        id: 'prod',
        name: 'production',
        platforms: ['ios', 'android'],
        easConfig: {},
        tasteVaultWeight: 0.5,
        aso: { keywords: ['test'], subtitle: '', description: '', suggestedCategories: [], projectedScore: 0, locale: 'en-US' },
        rehearsalStage: false,
      };

      const config = ramp.generateAssetConfig(profile);
      expect(config.icon.style).toBe('adaptive');
      expect(config.splash.animated).toBe(true);
      expect(config.screenshots.captionStyle).toBe('marketing');
    });

    it('should include Android devices for Android platform', () => {
      const profile: MobileLaunchProfile = {
        id: 'android-only',
        name: 'development',
        platforms: ['android'],
        easConfig: {},
        tasteVaultWeight: 0.5,
        aso: { keywords: ['test'], subtitle: '', description: '', suggestedCategories: [], projectedScore: 0, locale: 'en-US' },
        rehearsalStage: false,
      };

      const config = ramp.generateAssetConfig(profile);
      expect(config.screenshots.devices).toContain('Pixel 8');
    });
  });

  describe('createLaunchRamp()', () => {
    it('should create a new LaunchRamp instance', () => {
      const ramp = createLaunchRamp();
      expect(ramp).toBeInstanceOf(LaunchRamp);
    });
  });
});
