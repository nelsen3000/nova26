// Mobile Launch Stage — R19-01
// Types for mobile launch pipeline

export interface MobileLaunchProfile {
  id: string;
  name: 'development' | 'preview' | 'production';
  platforms: ('ios' | 'android')[];
  easConfig: Record<string, unknown>;
  tasteVaultWeight: number; // 0-1
  aso: ASOOptimizer;
  rehearsalStage: boolean;
}

export interface AssetGenPipeline {
  icon: { sizes: number[]; style: string };
  splash: { darkMode: boolean; animated: boolean };
  screenshots: { count: number; devices: string[]; captionStyle: string };
  generatorModel: string;
}

export interface ASOOptimizer {
  keywords: string[];
  subtitle: string;
  description: string;
  suggestedCategories: string[];
  projectedScore: number; // 0-100
  locale: string;
}

export interface MobileLaunchResult {
  buildId: string;
  status: 'success' | 'failed' | 'pending';
  testflightLink?: string;
  playStoreLink?: string;
  assetGalleryUrl?: string;
  rehearsalVideoUrl?: string;
}

export interface IconGenerationConfig {
  sourceImage: string;
  sizes: number[];
  style: 'rounded' | 'square' | 'adaptive';
  outputDir: string;
}

export interface SplashGenerationConfig {
  backgroundColor: string;
  darkModeBackgroundColor?: string;
  logoImage: string;
  animated: boolean;
  outputDir: string;
}

export interface ScreenshotGenerationConfig {
  devices: string[];
  count: number;
  captionStyle: 'minimal' | 'detailed' | 'marketing';
  locales: string[];
}

export interface EASBuildConfig {
  profile: string;
  platform: 'ios' | 'android' | 'all';
  cacheEnabled: boolean;
  environmentVariables: Record<string, string>;
}

export interface RehearsalCapture {
  deviceId: string;
  flowName: string;
  durationMs: number;
  interactions: RehearsalInteraction[];
}

export interface RehearsalInteraction {
  type: 'tap' | 'swipe' | 'type' | 'wait';
  target?: string;
  value?: string;
  timestamp: number;
}

export interface MobileLaunchConfig {
  enabled: boolean;
  defaultProfile: 'development' | 'preview' | 'production';
  tasteVaultInfluence: number;
  perplexityWeight: number;
}
