/**
 * Nova26 Model Routing & Speculative Decoding Module
 * KIMI-R22-01 - Hardware Auto-Detection
 */

import { HardwareTier, HardwareTierId } from './types.js';

/**
 * Hardware detection class that identifies system capabilities
 * and recommends appropriate model quantization levels.
 * 
 * Note: This implementation uses mock detection for cross-platform compatibility.
 * In production, this would interface with native system APIs.
 */
export class HardwareDetector {
  private cachedTier: HardwareTier | null = null;

  /**
   * Detects the current hardware tier of the system.
   * Uses caching to avoid repeated detection overhead.
   */
  detect(): HardwareTier {
    if (this.cachedTier) {
      return this.cachedTier;
    }

    // Check for Apple Silicon first
    if (this.detectAppleSilicon()) {
      const tier: HardwareTier = {
        id: 'apple-silicon',
        gpuVendor: 'Apple',
        vramGB: this.detectAppleVRAM(),
        ramGB: this.detectAppleRAM(),
        cpuCores: this.detectAppleCores(),
        recommendedQuant: 'Q4_K_M',
      };
      this.cachedTier = tier;
      return tier;
    }

    // Check for NVIDIA GPU
    const nvidiaInfo = this.detectNVIDIA();
    if (nvidiaInfo) {
      const tier = this.classifyNVIDIA(nvidiaInfo.vramGB);
      this.cachedTier = tier;
      return tier;
    }

    // Fallback to CPU-only detection
    const cpuTier = this.detectCPUOnly();
    this.cachedTier = cpuTier;
    return cpuTier;
  }

  /**
   * Detects if running on Apple Silicon (M1/M2/M3/M4).
   */
  detectAppleSilicon(): boolean {
    // Mock detection - in production would check process.arch and os.platform()
    const platform = this.getPlatform();
    const arch = this.getArchitecture();
    
    return platform === 'darwin' && (arch === 'arm64' || arch === 'aarch64');
  }

  /**
   * Detects NVIDIA GPU information if available.
   */
  detectNVIDIA(): { vramGB: number } | null {
    // Mock detection - in production would use nvidia-smi or CUDA APIs
    const hasNvidia = this.checkNvidiaDriver();
    
    if (!hasNvidia) {
      return null;
    }

    // Mock VRAM detection based on common GPU tiers
    const detectedVRAM = this.mockDetectVRAM();
    return { vramGB: detectedVRAM };
  }

  /**
   * Gets the recommended quantization level for a hardware tier.
   */
  getRecommendedQuant(tier: HardwareTier): string {
    const quantMap: Record<HardwareTierId, string> = {
      'low': 'Q2_K',        // Very limited VRAM - aggressive quantization
      'mid': 'Q4_K_M',      // Moderate VRAM - balanced quantization
      'high': 'Q5_K_M',     // Good VRAM - higher quality
      'ultra': 'Q8_0',      // Abundant VRAM - best quality
      'apple-silicon': 'Q4_K_M', // Optimized for unified memory
    };

    return quantMap[tier.id];
  }

  /**
   * Clears the hardware detection cache.
   */
  clearCache(): void {
    this.cachedTier = null;
  }

  // Private helper methods

  private getPlatform(): string {
    // Mock - in production would use process.platform
    return typeof process !== 'undefined' ? process.platform : 'linux';
  }

  private getArchitecture(): string {
    // Mock - in production would use process.arch
    return typeof process !== 'undefined' ? process.arch : 'x64';
  }

  private detectAppleVRAM(): number {
    // Mock unified memory detection
    // Would query system_profiler SPMemoryDataType in production
    const tiers = [8, 16, 24, 32, 64, 128];
    return tiers[Math.floor(Math.random() * tiers.length)];
  }

  private detectAppleRAM(): number {
    // Unified memory - same as VRAM on Apple Silicon
    return this.detectAppleVRAM();
  }

  private detectAppleCores(): number {
    // Mock CPU core detection
    // Would use os.cpus() in production
    const coreOptions = [8, 10, 12, 16, 24, 32];
    return coreOptions[Math.floor(Math.random() * coreOptions.length)];
  }

  private checkNvidiaDriver(): boolean {
    // Mock NVIDIA driver detection
    // Would check for nvidia-smi or CUDA libraries
    return Math.random() > 0.3; // 70% chance of NVIDIA in mock
  }

  private mockDetectVRAM(): number {
    // Mock VRAM detection simulating various GPU tiers
    const vramOptions = [4, 6, 8, 12, 16, 24, 32, 48, 80];
    return vramOptions[Math.floor(Math.random() * vramOptions.length)];
  }

  private classifyNVIDIA(vramGB: number): HardwareTier {
    if (vramGB >= 48) {
      return {
        id: 'ultra',
        gpuVendor: 'NVIDIA',
        vramGB,
        ramGB: Math.max(64, vramGB * 2),
        cpuCores: 32,
        recommendedQuant: 'Q8_0',
      };
    }

    if (vramGB >= 16) {
      return {
        id: 'high',
        gpuVendor: 'NVIDIA',
        vramGB,
        ramGB: Math.max(32, vramGB * 2),
        cpuCores: 16,
        recommendedQuant: 'Q5_K_M',
      };
    }

    if (vramGB >= 8) {
      return {
        id: 'mid',
        gpuVendor: 'NVIDIA',
        vramGB,
        ramGB: Math.max(16, vramGB * 2),
        cpuCores: 8,
        recommendedQuant: 'Q4_K_M',
      };
    }

    return {
      id: 'low',
      gpuVendor: 'NVIDIA',
      vramGB,
      ramGB: Math.max(8, vramGB * 2),
      cpuCores: 4,
      recommendedQuant: 'Q2_K',
    };
  }

  private detectCPUOnly(): HardwareTier {
    // Mock CPU-only system detection
    const ramGB = this.mockDetectRAM();
    const cores = this.mockDetectCPUCores();

    return {
      id: 'low',
      gpuVendor: null,
      vramGB: 0,
      ramGB,
      cpuCores: cores,
      recommendedQuant: ramGB >= 32 ? 'Q4_0' : 'Q2_K',
    };
  }

  private mockDetectRAM(): number {
    const ramOptions = [8, 16, 32, 64, 128];
    return ramOptions[Math.floor(Math.random() * ramOptions.length)];
  }

  private mockDetectCPUCores(): number {
    const coreOptions = [4, 6, 8, 12, 16, 32];
    return coreOptions[Math.floor(Math.random() * coreOptions.length)];
  }
}
