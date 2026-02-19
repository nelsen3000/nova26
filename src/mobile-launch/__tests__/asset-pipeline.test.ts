// Asset Pipeline Tests — R19-01

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AssetPipeline,
  createAssetPipeline,
} from '../asset-pipeline.js';

describe('AssetPipeline', () => {
  let pipeline: AssetPipeline;

  beforeEach(() => {
    pipeline = new AssetPipeline();
  });

  describe('generateIcons()', () => {
    it('should generate iOS icons', async () => {
      const assets = await pipeline.generateIcons({
        sourceImage: 'icon.png',
        sizes: [60, 120, 180],
        style: 'rounded',
        outputDir: '/output',
      });

      const iosIcons = assets.filter(a => a.platform === 'ios');
      expect(iosIcons.length).toBeGreaterThan(0);
      expect(iosIcons[0].path).toContain('ios');
    });

    it('should generate Android icons for standard sizes', async () => {
      const assets = await pipeline.generateIcons({
        sourceImage: 'icon.png',
        sizes: [48, 72, 96, 144, 192],
        style: 'adaptive',
        outputDir: '/output',
      });

      const androidIcons = assets.filter(a => a.platform === 'android');
      expect(androidIcons.length).toBeGreaterThan(0);
    });

    it('should generate adaptive icon backgrounds', async () => {
      const assets = await pipeline.generateIcons({
        sourceImage: 'icon.png',
        sizes: [48, 72, 96],
        style: 'adaptive',
        outputDir: '/output',
      });

      const backgrounds = assets.filter(a => a.variant === 'dark');
      expect(backgrounds.length).toBeGreaterThan(0);
    });

    it('should include all requested sizes', async () => {
      const sizes = [60, 120, 180];
      const assets = await pipeline.generateIcons({
        sourceImage: 'icon.png',
        sizes,
        style: 'rounded',
        outputDir: '/output',
      });

      for (const size of sizes) {
        const icon = assets.find(a => a.size.width === size);
        expect(icon).toBeDefined();
      }
    });
  });

  describe('generateSplashScreens()', () => {
    it('should generate splash screens for multiple sizes', async () => {
      const assets = await pipeline.generateSplashScreens({
        backgroundColor: '#ffffff',
        logoImage: 'logo.png',
        animated: false,
        outputDir: '/output',
      });

      expect(assets.length).toBeGreaterThan(0);
      expect(assets[0].type).toBe('splash');
    });

    it('should generate dark mode variants', async () => {
      const assets = await pipeline.generateSplashScreens({
        backgroundColor: '#ffffff',
        darkModeBackgroundColor: '#000000',
        logoImage: 'logo.png',
        animated: false,
        outputDir: '/output',
      });

      const lightVariants = assets.filter(a => a.variant === 'light');
      const darkVariants = assets.filter(a => a.variant === 'dark');
      
      expect(lightVariants.length).toBeGreaterThan(0);
      expect(darkVariants.length).toBeGreaterThan(0);
    });

    it('should include iPhone and iPad sizes', async () => {
      const assets = await pipeline.generateSplashScreens({
        backgroundColor: '#ffffff',
        logoImage: 'logo.png',
        animated: false,
        outputDir: '/output',
      });

      const sizes = assets.map(a => `${a.size.width}x${a.size.height}`);
      expect(sizes).toContain('640x1136'); // iPhone SE
      expect(sizes).toContain('2048x2732'); // iPad Pro
    });
  });

  describe('generateScreenshots()', () => {
    it('should generate screenshots for each device', async () => {
      const assets = await pipeline.generateScreenshots(
        {
          devices: ['iPhone 15 Pro', 'iPad Pro'],
          count: 3,
          captionStyle: 'minimal',
          locales: ['en-US'],
        },
        {
          icon: { sizes: [], style: '' },
          splash: { darkMode: false, animated: false },
          screenshots: {
            count: 3,
            devices: ['iPhone 15 Pro', 'iPad Pro'],
            captionStyle: 'minimal',
          },
          generatorModel: 'dall-e-3',
        }
      );

      expect(assets.length).toBe(6); // 2 devices × 3 screenshots
    });

    it('should set correct platform for each device', async () => {
      const assets = await pipeline.generateScreenshots(
        {
          devices: ['iPhone 15 Pro', 'Pixel 8'],
          count: 1,
          captionStyle: 'minimal',
          locales: ['en-US'],
        },
        {
          icon: { sizes: [], style: '' },
          splash: { darkMode: false, animated: false },
          screenshots: {
            count: 1,
            devices: ['iPhone 15 Pro', 'Pixel 8'],
            captionStyle: 'minimal',
          },
          generatorModel: 'dall-e-3',
        }
      );

      const iphone = assets.find(a => a.path.includes('iphone'));
      const pixel = assets.find(a => a.path.includes('pixel'));

      expect(iphone?.platform).toBe('ios');
      expect(pixel?.platform).toBe('android');
    });
  });

  describe('getAsset() & getAssetsByType()', () => {
    it('should retrieve asset by ID', async () => {
      const assets = await pipeline.generateIcons({
        sourceImage: 'icon.png',
        sizes: [60],
        style: 'rounded',
        outputDir: '/output',
      });

      const id = assets[0].id;
      const retrieved = pipeline.getAsset(id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(id);
    });

    it('should return undefined for non-existent asset', () => {
      const result = pipeline.getAsset('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should filter assets by type', async () => {
      await pipeline.generateIcons({
        sourceImage: 'icon.png',
        sizes: [60],
        style: 'rounded',
        outputDir: '/output',
      });

      await pipeline.generateSplashScreens({
        backgroundColor: '#ffffff',
        logoImage: 'logo.png',
        animated: false,
        outputDir: '/output',
      });

      const icons = pipeline.getAssetsByType('icon');
      const splashes = pipeline.getAssetsByType('splash');

      expect(icons.length).toBeGreaterThan(0);
      expect(splashes.length).toBeGreaterThan(0);
    });

    it('should filter assets by platform', async () => {
      await pipeline.generateIcons({
        sourceImage: 'icon.png',
        sizes: [60, 48],
        style: 'adaptive',
        outputDir: '/output',
      });

      const iosAssets = pipeline.getAssetsByPlatform('ios');
      const androidAssets = pipeline.getAssetsByPlatform('android');

      expect(iosAssets.length).toBeGreaterThan(0);
    });
  });

  describe('validateIconSizes()', () => {
    it('should validate complete icon sizes', () => {
      const result = pipeline.validateIconSizes([60, 120, 180, 1024, 48, 72, 96, 144, 192, 512]);
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should detect missing iOS sizes', () => {
      const result = pipeline.validateIconSizes([48, 72, 96]);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain(1024);
    });

    it('should detect missing Android sizes', () => {
      const result = pipeline.validateIconSizes([60, 120, 180, 1024]);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain(512);
    });
  });

  describe('createAssetPipeline()', () => {
    it('should create a new pipeline instance', () => {
      const pipeline = createAssetPipeline();
      expect(pipeline).toBeInstanceOf(AssetPipeline);
    });
  });
});
