# Mobile Launch Pipeline

> Source: `src/mobile-launch/launch-ramp.ts`, `src/mobile-launch/asset-pipeline.ts`, `src/mobile-launch/aso-optimizer.ts`, `src/mobile-launch/eas-wrapper.ts`, `src/mobile-launch/rehearsal-stage.ts`, `src/mobile-launch/types.ts`

## Description

The Mobile Launch Pipeline automates the full journey from development build to App Store / Play Store submission. It orchestrates five stages: asset generation (icon resizing, splash screens, automated screenshot capture), EAS build wrapping (Expo Application Services with a Taste Vault quality layer), ASO optimization (keyword research, subtitle suggestions, category recommendations), a rehearsal pattern (Dream Mode simulation followed by real device capture), and final submission with quality gate checks. The pipeline supports three launch profiles -- development, preview, and production -- each with different Taste Vault weight and quality gate strictness. VENUS drives the visual asset generation, MERCURY gates quality, SATURN checks wellbeing, and Perplexity provides real-time ASO research.

---

## Code Examples

### Core Interfaces

```typescript
export type LaunchProfileName = 'development' | 'preview' | 'production';

export interface MobileLaunchProfile {
  id: string;
  name: LaunchProfileName;
  platforms: ('ios' | 'android')[];
  easConfig: EASConfig;
  tasteVaultWeight: number; // 0-1, higher = stricter taste enforcement
  aso: ASOConfig;
  rehearsalStage: RehearsalConfig;
}

export interface EASConfig {
  projectId: string;
  profile: string;
  distribution: 'internal' | 'store';
  platform: 'ios' | 'android' | 'all';
  autoSubmit: boolean;
}

export interface AssetGenPipeline {
  icon: {
    sizes: number[];     // [1024, 512, 192, 180, 167, 152, 120, 87, 80, 76, 60, 58, 40, 29, 20];
    style: 'flat' | 'gradient' | 'custom';
    sourceImage: string;
  };
  splash: {
    darkMode: boolean;
    animated: boolean;
    backgroundColor: string;
  };
  screenshots: {
    count: number;
    devices: string[];   // ['iPhone 15 Pro', 'iPad Pro 12.9', 'Pixel 8']
    captionStyle: 'minimal' | 'descriptive' | 'marketing';
  };
  generatorModel: string; // LLM/image model for asset generation
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
  status: 'success' | 'failed' | 'pending-review';
  testflightLink?: string;
  playStoreLink?: string;
  assetGalleryUrl?: string;
  rehearsalVideoUrl?: string;
}
```

### Launch Ramp: Main Pipeline

```typescript
export class LaunchRamp {
  private profile: MobileLaunchProfile;
  private assetPipeline: AssetPipeline;
  private easWrapper: EASWrapper;
  private asoOptimizer: ASOOptimizerService;
  private rehearsalStage: RehearsalStage;

  constructor(profile: MobileLaunchProfile) {
    this.profile = profile;
    this.assetPipeline = new AssetPipeline(profile);
    this.easWrapper = new EASWrapper(profile.easConfig);
    this.asoOptimizer = new ASOOptimizerService(profile.aso);
    this.rehearsalStage = new RehearsalStage(profile.rehearsalStage);
  }

  async launch(): Promise<MobileLaunchResult> {
    // Stage 1: Generate all assets (icons, splash, screenshots)
    const assets = await this.assetPipeline.generateAll();

    // Stage 2: Rehearsal — Dream Mode simulation, then real device capture
    const rehearsalResult = await this.rehearsalStage.run(assets);
    if (!rehearsalResult.passed) {
      return {
        buildId: '',
        status: 'failed',
        rehearsalVideoUrl: rehearsalResult.videoUrl,
      };
    }

    // Stage 3: ASO optimization — keywords, subtitle, category
    const aso = await this.asoOptimizer.optimize();

    // Stage 4: EAS build + submit
    const buildResult = await this.easWrapper.buildAndSubmit({
      assets,
      aso,
      profile: this.profile.name,
    });

    return buildResult;
  }
}
```

### Asset Generation Pipeline

```typescript
export class AssetPipeline {
  private config: AssetGenPipeline;

  constructor(profile: MobileLaunchProfile) {
    this.config = profile.aso as unknown as AssetGenPipeline;
  }

  async generateAll(): Promise<GeneratedAssets> {
    const [icons, splash, screenshots] = await Promise.all([
      this.generateIcons(),
      this.generateSplash(),
      this.generateScreenshots(),
    ]);

    return { icons, splash, screenshots };
  }

  private async generateIcons(): Promise<IconSet> {
    // Resize source image to all required sizes
    // iOS: 1024, 180, 167, 152, 120, 87, 80, 76, 60, 58, 40, 29, 20
    // Android: 512, 192, 144, 96, 72, 48
    const icons: IconSet = { ios: [], android: [] };

    for (const size of this.config.icon.sizes) {
      const resized = await resizeImage(this.config.icon.sourceImage, size, size);
      if (size >= 512) {
        icons.ios.push(resized);
        icons.android.push(resized);
      } else {
        // Platform-specific size mapping
        icons.ios.push(resized);
      }
    }

    return icons;
  }

  private async generateScreenshots(): Promise<Screenshot[]> {
    // For each device, launch simulator/emulator, navigate app, capture screenshots
    const screenshots: Screenshot[] = [];

    for (const device of this.config.screenshots.devices) {
      for (let i = 0; i < this.config.screenshots.count; i++) {
        const screenshot = await captureDeviceScreenshot(device, i);
        const captioned = await addCaption(
          screenshot,
          this.config.screenshots.captionStyle
        );
        screenshots.push(captioned);
      }
    }

    return screenshots;
  }

  // ... generateSplash
}
```

### EAS Wrapper with Taste Vault Layer

```typescript
export class EASWrapper {
  private config: EASConfig;

  constructor(config: EASConfig) {
    this.config = config;
  }

  async buildAndSubmit(params: {
    assets: GeneratedAssets;
    aso: ASOOptimizer;
    profile: LaunchProfileName;
  }): Promise<MobileLaunchResult> {
    // Pre-build: Taste Vault quality check on assets
    if (params.profile === 'production') {
      const tasteCheck = await this.runTasteVaultCheck(params.assets);
      if (!tasteCheck.passed) {
        return { buildId: '', status: 'failed' };
      }
    }

    // Run EAS build
    const buildId = await this.easBuild(this.config);

    // Post-build: Quality gate (MERCURY)
    const qualityGate = await this.runQualityGate(buildId);
    if (!qualityGate.passed) {
      return { buildId, status: 'failed' };
    }

    // Submit to stores if autoSubmit is enabled
    if (this.config.autoSubmit && params.profile === 'production') {
      await this.submitToStores(buildId, params.aso);
    }

    return {
      buildId,
      status: this.config.autoSubmit ? 'pending-review' : 'success',
      testflightLink: this.config.platform !== 'android'
        ? `https://testflight.apple.com/join/${buildId}` : undefined,
      playStoreLink: this.config.platform !== 'ios'
        ? `https://play.google.com/apps/testing/${this.config.projectId}` : undefined,
    };
  }

  // ... easBuild, runQualityGate, runTasteVaultCheck, submitToStores
}
```

### Rehearsal Pattern: Dream Mode to Real Device

```typescript
export interface RehearsalConfig {
  dreamModeEnabled: boolean;
  realDeviceCapture: boolean;
  maxRetries: number;
  acceptanceThreshold: number; // 0-1, visual quality score
}

export class RehearsalStage {
  private config: RehearsalConfig;

  constructor(config: RehearsalConfig) {
    this.config = config;
  }

  async run(assets: GeneratedAssets): Promise<{
    passed: boolean;
    videoUrl?: string;
    qualityScore: number;
  }> {
    // Phase 1: Dream Mode — simulate the launch experience with mock data
    if (this.config.dreamModeEnabled) {
      const dreamResult = await this.runDreamMode(assets);
      if (dreamResult.qualityScore < this.config.acceptanceThreshold) {
        return { passed: false, qualityScore: dreamResult.qualityScore };
      }
    }

    // Phase 2: Real device capture — record actual device interaction
    if (this.config.realDeviceCapture) {
      const captureResult = await this.captureRealDevice(assets);
      return {
        passed: captureResult.qualityScore >= this.config.acceptanceThreshold,
        videoUrl: captureResult.videoUrl,
        qualityScore: captureResult.qualityScore,
      };
    }

    return { passed: true, qualityScore: 1.0 };
  }

  // ... runDreamMode, captureRealDevice
}
```

### Key Concepts

- **Three launch profiles**: `development` (fast, low-quality checks), `preview` (internal testers, moderate checks), `production` (full asset generation, ASO, Taste Vault, quality gates)
- **Parallel asset generation**: Icons, splash screens, and screenshots generate concurrently via `Promise.all`
- **Taste Vault gating**: Production builds pass through Taste Vault quality assessment before EAS build
- **Rehearsal pattern**: Dream Mode simulates the full launch experience with mock data; real device capture then records the actual user experience on physical devices
- **ASO optimization**: Keywords, subtitles, and category suggestions are generated using Perplexity research data and projected ASO scores

---

## Anti-Patterns

### Don't Do This

```typescript
// Manual icon resizing — error-prone, misses sizes
const icon512 = await resizeImage(source, 512, 512);
const icon1024 = await resizeImage(source, 1024, 1024);
// Forgot 17 other required sizes

// Submitting to production without quality gates
await easBuild(config);
await submitToAppStore(buildId); // No quality check, no taste review

// Skipping rehearsal — first real user sees untested launch experience
const result = await launchRamp.launch(); // Went straight to production
```

### Do This Instead

```typescript
// Full pipeline with all stages
const ramp = new LaunchRamp({
  name: 'production',
  platforms: ['ios', 'android'],
  easConfig: { autoSubmit: true, distribution: 'store', ... },
  tasteVaultWeight: 0.8,
  aso: { locale: 'en-US', ... },
  rehearsalStage: {
    dreamModeEnabled: true,
    realDeviceCapture: true,
    maxRetries: 3,
    acceptanceThreshold: 0.85,
  },
});

const result = await ramp.launch();
// Assets generated -> rehearsal passed -> ASO optimized -> quality gated -> submitted
```

---

## When to Use

**Use for:**
- Automating the full mobile app launch pipeline from asset generation through store submission
- Ensuring consistent asset quality across multiple device sizes and platforms
- Validating the launch experience before real users see it (rehearsal pattern)
- Optimizing App Store presence with data-driven keyword and category suggestions

**Don't use for:**
- Web-only deployments with no mobile component
- Quick development builds where EAS CLI alone is sufficient (use `development` profile with minimal stages)

---

## Benefits

1. **End-to-end automation** -- from icon generation through store submission, no manual steps required
2. **Quality assurance** -- Taste Vault and MERCURY gates catch visual and functional issues before submission
3. **ASO optimization** -- data-driven keyword and category suggestions improve discoverability
4. **Rehearsal safety net** -- Dream Mode catches launch experience issues before real users are exposed
5. **Multi-platform coverage** -- single pipeline handles iOS (TestFlight) and Android (Play Store) simultaneously
6. **Profile-based flexibility** -- development/preview/production profiles let teams move fast when appropriate and be thorough when it matters

---

## Related Patterns

- See `docker-executor.md` for sandboxed execution of generated build scripts
- See `../13-browser-and-preview/visual-validator.md` for the visual validation used in rehearsal quality scoring
- See `../01-orchestration/gate-runner-pipeline.md` for how MERCURY quality gates integrate into the launch pipeline
- See `../02-intelligence/studio-rules-engine.md` for how Taste Vault rules influence asset generation
- See `../13-browser-and-preview/preview-server.md` for the preview server used during Dream Mode simulation

---

*Extracted: 2026-02-19*
