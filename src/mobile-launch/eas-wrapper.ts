// EAS Wrapper — R19-01
// Expo Application Services wrapper with Taste Vault layer

import type { EASBuildConfig } from './types.js';

export interface EASBuild {
  id: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  platform: 'ios' | 'android';
  profile: string;
  createdAt: string;
  completedAt?: string;
  artifacts?: {
    url: string;
    type: 'ipa' | 'aab' | 'apk';
  }[];
}

export interface EASConfig {
  projectId: string;
  cli: {
    version: string;
    requireCommit: boolean;
  };
  build: {
    development: Record<string, unknown>;
    preview: Record<string, unknown>;
    production: Record<string, unknown>;
  };
}

export class EASWrapper {
  private builds: Map<string, EASBuild> = new Map();
  private config: EASConfig;
  private tasteVaultInfluence: number;

  constructor(config: EASConfig, tasteVaultInfluence: number = 0.5) {
    this.config = config;
    this.tasteVaultInfluence = tasteVaultInfluence;
  }

  async createBuild(buildConfig: EASBuildConfig): Promise<EASBuild> {
    const build: EASBuild = {
      id: crypto.randomUUID(),
      status: 'pending',
      platform: buildConfig.platform === 'all' ? 'ios' : buildConfig.platform,
      profile: buildConfig.profile,
      createdAt: new Date().toISOString(),
    };

    this.builds.set(build.id, build);

    // Simulate build starting
    setTimeout(() => {
      this.updateBuildStatus(build.id, 'in-progress');
    }, 100);

    return build;
  }

  async getBuildStatus(buildId: string): Promise<EASBuild | undefined> {
    return this.builds.get(buildId);
  }

  updateBuildStatus(buildId: string, status: EASBuild['status']): void {
    const build = this.builds.get(buildId);
    if (build) {
      build.status = status;
      if (status === 'completed' || status === 'failed') {
        build.completedAt = new Date().toISOString();
      }
    }
  }

  async waitForBuild(buildId: string, timeoutMs: number = 600000): Promise<EASBuild> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const build = this.builds.get(buildId);
      
      if (!build) {
        throw new Error(`Build ${buildId} not found`);
      }

      if (build.status === 'completed') {
        return build;
      }

      if (build.status === 'failed') {
        throw new Error(`Build ${buildId} failed`);
      }

      await this.sleep(5000);
    }

    throw new Error(`Build ${buildId} timed out`);
  }

  generateBuildConfig(
    profile: string,
    platform: 'ios' | 'android' | 'all',
    tasteVaultRecommendations: string[]
  ): EASBuildConfig {
    // Merge Taste Vault recommendations
    const mergedEnv: Record<string, string> = {};
    
    if (this.tasteVaultInfluence > 0) {
      for (const rec of tasteVaultRecommendations) {
        mergedEnv[`TASTE_VAULT_${rec.toUpperCase()}`] = 'enabled';
      }
    }

    return {
      profile,
      platform,
      cacheEnabled: true,
      environmentVariables: mergedEnv,
    };
  }

  async submitToTestFlight(buildId: string): Promise<string | undefined> {
    const build = this.builds.get(buildId);
    if (build?.status !== 'completed') {
      return undefined;
    }

    // Simulate submission
    return `https://testflight.apple.com/join/${buildId}`;
  }

  async submitToPlayStore(buildId: string, track: 'internal' | 'alpha' | 'beta' | 'production'): Promise<string | undefined> {
    const build = this.builds.get(buildId);
    if (build?.status !== 'completed') {
      return undefined;
    }

    return `https://play.google.com/apps/${track}/${buildId}`;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.projectId) {
      errors.push('EAS projectId is required');
    }

    if (!this.config.cli?.version) {
      errors.push('EAS CLI version is required');
    }

    if (!this.config.build?.production) {
      errors.push('Production build profile is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  getBuildsByProfile(profile: string): EASBuild[] {
    return Array.from(this.builds.values())
      .filter(b => b.profile === profile);
  }

  getBuildsByPlatform(platform: 'ios' | 'android'): EASBuild[] {
    return Array.from(this.builds.values())
      .filter(b => b.platform === platform);
  }

  cancelBuild(buildId: string): boolean {
    const build = this.builds.get(buildId);
    if (build && (build.status === 'pending' || build.status === 'in-progress')) {
      build.status = 'failed';
      build.completedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export function createEASWrapper(
  config: EASConfig,
  tasteVaultInfluence?: number
): EASWrapper {
  return new EASWrapper(config, tasteVaultInfluence);
}
