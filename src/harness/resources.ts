// Resource Manager - CPU, memory, and time budget management
// Spec: .kiro/specs/agent-harnesses/tasks.md

import type { ResourceLimits, ResourceUsage } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Resource Manager
// ═══════════════════════════════════════════════════════════════════════════════

export interface ResourceManagerConfig {
  limits: ResourceLimits;
  onExhausted?: (type: keyof ResourceLimits) => void;
  onWarning?: (type: keyof ResourceLimits, percentUsed: number) => void;
  warningThreshold?: number; // Default 80%
}

export class ResourceManager {
  private config: ResourceManagerConfig;
  private usage: ResourceUsage = {
    cpuTimeMs: 0,
    memoryBytes: 0,
    wallClockTimeMs: 0,
  };
  private startTime: number;
  private warningsEmitted: Set<string> = new Set();

  constructor(config: ResourceManagerConfig) {
    this.config = {
      warningThreshold: 0.8,
      ...config,
    };
    this.startTime = Date.now();
  }

  /**
   * Record CPU time usage
   */
  recordCpuTime(ms: number): void {
    this.usage.cpuTimeMs += ms;
    this.checkLimits('maxCpuTimeMs', this.usage.cpuTimeMs);
  }

  /**
   * Record memory usage
   */
  recordMemory(bytes: number): void {
    this.usage.memoryBytes = Math.max(this.usage.memoryBytes, bytes);
    this.checkLimits('maxMemoryBytes', this.usage.memoryBytes);
  }

  /**
   * Update wall-clock time
   */
  updateWallClockTime(): void {
    this.usage.wallClockTimeMs = Date.now() - this.startTime;
    this.checkLimits('maxWallClockTimeMs', this.usage.wallClockTimeMs);
  }

  /**
   * Get current resource usage
   */
  getUsage(): ResourceUsage {
    this.updateWallClockTime();
    return { ...this.usage };
  }

  /**
   * Get resource limits
   */
  getLimits(): ResourceLimits {
    return { ...this.config.limits };
  }

  /**
   * Check if any resource is exhausted
   */
  isExhausted(): boolean {
    this.updateWallClockTime();
    
    return (
      (this.config.limits.maxCpuTimeMs > 0 && 
       this.usage.cpuTimeMs >= this.config.limits.maxCpuTimeMs) ||
      (this.config.limits.maxMemoryBytes > 0 && 
       this.usage.memoryBytes >= this.config.limits.maxMemoryBytes) ||
      (this.config.limits.maxWallClockTimeMs > 0 && 
       this.usage.wallClockTimeMs >= this.config.limits.maxWallClockTimeMs)
    );
  }

  /**
   * Get resource utilization percentages
   */
  getUtilization(): {
    cpuTime: number;
    memory: number;
    wallClockTime: number;
  } {
    this.updateWallClockTime();
    
    return {
      cpuTime: this.config.limits.maxCpuTimeMs > 0
        ? this.usage.cpuTimeMs / this.config.limits.maxCpuTimeMs
        : 0,
      memory: this.config.limits.maxMemoryBytes > 0
        ? this.usage.memoryBytes / this.config.limits.maxMemoryBytes
        : 0,
      wallClockTime: this.config.limits.maxWallClockTimeMs > 0
        ? this.usage.wallClockTimeMs / this.config.limits.maxWallClockTimeMs
        : 0,
    };
  }

  /**
   * Graceful degradation - reduce resource allocation
   */
  degrade(): void {
    // Increase limits to allow recovery (simulated)
    this.config.limits.maxCpuTimeMs *= 0.9;
    this.config.limits.maxMemoryBytes *= 0.9;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private checkLimits(type: keyof ResourceLimits, value: number): void {
    const limit = this.config.limits[type];
    if (limit <= 0) return;

    const utilization = value / limit;

    // Check warning threshold
    if (utilization >= this.config.warningThreshold! && 
        !this.warningsEmitted.has(type)) {
      this.warningsEmitted.add(type);
      this.config.onWarning?.(type, utilization * 100);
    }

    // Check exhaustion
    if (utilization >= 1) {
      this.config.onExhausted?.(type);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Process Resource Monitor
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProcessInfo {
  pid: number;
  cpuPercent: number;
  memoryBytes: number;
}

export class ProcessMonitor {
  private measurements: ProcessInfo[] = [];
  private maxMeasurements: number;

  constructor(maxMeasurements = 100) {
    this.maxMeasurements = maxMeasurements;
  }

  /**
   * Record a measurement
   */
  record(info: ProcessInfo): void {
    this.measurements.push(info);
    if (this.measurements.length > this.maxMeasurements) {
      this.measurements.shift();
    }
  }

  /**
   * Get average CPU usage
   */
  getAverageCpu(): number {
    if (this.measurements.length === 0) return 0;
    const sum = this.measurements.reduce((acc, m) => acc + m.cpuPercent, 0);
    return sum / this.measurements.length;
  }

  /**
   * Get peak memory usage
   */
  getPeakMemory(): number {
    return Math.max(...this.measurements.map(m => m.memoryBytes), 0);
  }

  /**
   * Get latest measurement
   */
  getLatest(): ProcessInfo | undefined {
    return this.measurements[this.measurements.length - 1];
  }
}
