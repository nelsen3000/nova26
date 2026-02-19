// Asset Pipeline — R19-01
// Icon, splash screen, and screenshot generation

import type {
  IconGenerationConfig,
  SplashGenerationConfig,
  ScreenshotGenerationConfig,
  AssetGenPipeline,
} from './types.js';

export interface GeneratedAsset {
  id: string;
  type: 'icon' | 'splash' | 'screenshot';
  size: { width: number; height: number };
  path: string;
  platform: 'ios' | 'android' | 'universal';
  variant?: 'light' | 'dark' | 'adaptive';
}

export class AssetPipeline {
  private assets: Map<string, GeneratedAsset> = new Map();

  async generateIcons(config: IconGenerationConfig): Promise<GeneratedAsset[]> {
    const generated: GeneratedAsset[] = [];

    for (const size of config.sizes) {
      // Generate iOS icons
      const iosIcon: GeneratedAsset = {
        id: crypto.randomUUID(),
        type: 'icon',
        size: { width: size, height: size },
        path: `${config.outputDir}/ios/AppIcon-${size}x${size}.png`,
        platform: 'ios',
        variant: config.style === 'rounded' ? 'light' : 'adaptive',
      };
      this.assets.set(iosIcon.id, iosIcon);
      generated.push(iosIcon);

      // Generate Android icons for standard sizes
      if ([48, 72, 96, 144, 192].includes(size)) {
        const androidIcon: GeneratedAsset = {
          id: crypto.randomUUID(),
          type: 'icon',
          size: { width: size, height: size },
          path: `${config.outputDir}/android/mipmap-${this.getDPI(size)}/ic_launcher.png`,
          platform: 'android',
          variant: config.style === 'adaptive' ? 'adaptive' : 'light',
        };
        this.assets.set(androidIcon.id, androidIcon);
        generated.push(androidIcon);

        if (config.style === 'adaptive') {
          const androidIconBg: GeneratedAsset = {
            id: crypto.randomUUID(),
            type: 'icon',
            size: { width: size, height: size },
            path: `${config.outputDir}/android/mipmap-${this.getDPI(size)}/ic_launcher_background.png`,
            platform: 'android',
            variant: 'dark',
          };
          this.assets.set(androidIconBg.id, androidIconBg);
          generated.push(androidIconBg);
        }
      }
    }

    return generated;
  }

  async generateSplashScreens(config: SplashGenerationConfig): Promise<GeneratedAsset[]> {
    const generated: GeneratedAsset[] = [];
    const sizes = [
      { width: 640, height: 1136 },  // iPhone SE
      { width: 750, height: 1334 },  // iPhone 8
      { width: 1125, height: 2436 }, // iPhone X/XS
      { width: 1242, height: 2688 }, // iPhone XS Max
      { width: 2048, height: 2732 }, // iPad Pro
    ];

    for (const size of sizes) {
      // Light mode
      const lightSplash: GeneratedAsset = {
        id: crypto.randomUUID(),
        type: 'splash',
        size,
        path: `${config.outputDir}/ios/splash-${size.width}x${size.height}.png`,
        platform: 'ios',
        variant: 'light',
      };
      this.assets.set(lightSplash.id, lightSplash);
      generated.push(lightSplash);

      // Dark mode
      if (config.darkModeBackgroundColor) {
        const darkSplash: GeneratedAsset = {
          id: crypto.randomUUID(),
          type: 'splash',
          size,
          path: `${config.outputDir}/ios/splash-${size.width}x${size.height}-dark.png`,
          platform: 'ios',
          variant: 'dark',
        };
        this.assets.set(darkSplash.id, darkSplash);
        generated.push(darkSplash);
      }
    }

    return generated;
  }

  async generateScreenshots(
    _config: ScreenshotGenerationConfig,
    appConfig: AssetGenPipeline
  ): Promise<GeneratedAsset[]> {
    const generated: GeneratedAsset[] = [];

    for (const device of appConfig.screenshots.devices) {
      for (let i = 0; i < appConfig.screenshots.count; i++) {
        const size = this.getDeviceSize(device);
        const screenshot: GeneratedAsset = {
          id: crypto.randomUUID(),
          type: 'screenshot',
          size,
          path: `screenshots/${device.replace(/\s+/g, '-').toLowerCase()}-${i + 1}.png`,
          platform: device.includes('iPhone') || device.includes('iPad') ? 'ios' : 'android',
        };
        this.assets.set(screenshot.id, screenshot);
        generated.push(screenshot);
      }
    }

    return generated;
  }

  getAsset(id: string): GeneratedAsset | undefined {
    return this.assets.get(id);
  }

  getAssetsByType(type: GeneratedAsset['type']): GeneratedAsset[] {
    return Array.from(this.assets.values()).filter(a => a.type === type);
  }

  getAssetsByPlatform(platform: GeneratedAsset['platform']): GeneratedAsset[] {
    return Array.from(this.assets.values()).filter(a => a.platform === platform);
  }

  validateIconSizes(sizes: number[]): { valid: boolean; missing: number[] } {
    const requiredIOS = [60, 120, 180, 1024];
    const requiredAndroid = [48, 72, 96, 144, 192, 512];
    
    const missingIOS = requiredIOS.filter(s => !sizes.includes(s));
    const missingAndroid = requiredAndroid.filter(s => !sizes.includes(s));
    
    return {
      valid: missingIOS.length === 0 && missingAndroid.length === 0,
      missing: [...missingIOS, ...missingAndroid],
    };
  }

  private getDPI(size: number): string {
    if (size <= 48) return 'mdpi';
    if (size <= 72) return 'hdpi';
    if (size <= 96) return 'xhdpi';
    if (size <= 144) return 'xxhdpi';
    return 'xxxhdpi';
  }

  private getDeviceSize(device: string): { width: number; height: number } {
    const sizes: Record<string, { width: number; height: number }> = {
      'iPhone 15 Pro': { width: 1179, height: 2556 },
      'iPhone 14': { width: 1170, height: 2532 },
      'iPad Pro': { width: 2048, height: 2732 },
      'Pixel 8': { width: 1080, height: 2400 },
      'Samsung Galaxy S24': { width: 1080, height: 2340 },
    };
    return sizes[device] ?? { width: 1280, height: 720 };
  }
}

export function createAssetPipeline(): AssetPipeline {
  return new AssetPipeline();
}
