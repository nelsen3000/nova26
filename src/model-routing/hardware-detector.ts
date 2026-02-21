// Hardware Auto-Detection — Apple Silicon, NVIDIA, CPU-only
// KIMI-R22-01 | Feb 2026

import { execSync } from 'child_process';
import type { HardwareTier, HardwareTierId, GpuVendor, QuantizationLevel } from './types.js';

export interface DetectionResult {
  tier: HardwareTier;
  detectionMethod: 'auto' | 'forced';
  rawInfo: Record<string, unknown>;
}

function safeExec(cmd: string): string {
  try {
    return execSync(cmd, { timeout: 3000, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function detectAppleSilicon(): HardwareTier | null {
  const platform = process.platform;
  if (platform !== 'darwin') return null;

  const cpuInfo = safeExec('sysctl -n machdep.cpu.brand_string');
  if (!cpuInfo.includes('Apple')) return null;

  const chipInfo = safeExec('system_profiler SPHardwareDataType 2>/dev/null | grep "Chip:"');
  const ramStr = safeExec('sysctl -n hw.memsize');
  const ramGB = ramStr ? Math.round(Number(ramStr) / (1024 ** 3)) : 8;
  const cpuCores = Number(safeExec('sysctl -n hw.logicalcpu')) || 8;

  // Estimate unified memory / neural engine tier
  let quant: QuantizationLevel = 'q4';
  let maxConcurrent = 1;
  if (ramGB >= 192) { quant = 'bf16'; maxConcurrent = 4; }
  else if (ramGB >= 96) { quant = 'fp16'; maxConcurrent = 3; }
  else if (ramGB >= 48) { quant = 'q8'; maxConcurrent = 2; }
  else if (ramGB >= 24) { quant = 'q6'; maxConcurrent = 2; }
  else if (ramGB >= 16) { quant = 'q5'; maxConcurrent = 1; }

  return {
    id: 'apple-silicon',
    gpuVendor: 'apple',
    vramGB: ramGB,  // Unified memory
    ramGB,
    cpuCores,
    recommendedQuant: quant,
    maxConcurrentInferences: maxConcurrent,
  };
}

function detectNvidia(): HardwareTier | null {
  const nvidiaSmi = safeExec('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits 2>/dev/null');
  if (!nvidiaSmi) return null;

  const lines = nvidiaSmi.split('\n').filter(Boolean);
  if (!lines.length) return null;

  // Pick the highest-VRAM GPU
  let maxVram = 0;
  for (const line of lines) {
    const parts = line.split(',');
    const vram = Number(parts[1]?.trim()) || 0;
    if (vram > maxVram) maxVram = vram;
  }
  const vramGB = Math.round(maxVram / 1024);
  const ramStr = safeExec('cat /proc/meminfo 2>/dev/null | grep MemTotal | awk \'{print $2}\'');
  const ramGB = ramStr ? Math.round(Number(ramStr) / (1024 ** 2)) : 16;
  const cpuCores = Number(safeExec('nproc 2>/dev/null')) || 8;

  let id: HardwareTierId = 'mid';
  let quant: QuantizationLevel = 'q5';
  let maxConcurrent = 1;

  if (vramGB >= 80) { id = 'ultra'; quant = 'fp16'; maxConcurrent = 4; }
  else if (vramGB >= 40) { id = 'high'; quant = 'q8'; maxConcurrent = 3; }
  else if (vramGB >= 24) { id = 'high'; quant = 'q6'; maxConcurrent = 2; }
  else if (vramGB >= 12) { id = 'mid'; quant = 'q5'; maxConcurrent = 2; }
  else { id = 'low'; quant = 'q4'; maxConcurrent = 1; }

  return { id, gpuVendor: 'nvidia', vramGB, ramGB, cpuCores, recommendedQuant: quant, maxConcurrentInferences: maxConcurrent };
}

function detectAmd(): HardwareTier | null {
  const rocmInfo = safeExec('rocm-smi --showmeminfo vram --csv 2>/dev/null');
  if (!rocmInfo) return null;

  const lines = rocmInfo.split('\n').filter(l => l && !l.startsWith('device'));
  if (!lines.length) return null;

  const parts = lines[0]!.split(',');
  const vramMb = Number(parts[1]?.trim()) || 0;
  const vramGB = Math.round(vramMb / 1024);
  const ramGB = 16;
  const cpuCores = Number(safeExec('nproc 2>/dev/null')) || 8;

  let id: HardwareTierId = 'mid';
  let quant: QuantizationLevel = 'q5';
  let maxConcurrent = 1;

  if (vramGB >= 48) { id = 'high'; quant = 'q6'; maxConcurrent = 2; }
  else if (vramGB >= 24) { id = 'mid'; quant = 'q5'; maxConcurrent = 2; }
  else { id = 'low'; quant = 'q4'; maxConcurrent = 1; }

  return { id, gpuVendor: 'amd', vramGB, ramGB, cpuCores, recommendedQuant: quant, maxConcurrentInferences: maxConcurrent };
}

function cpuOnlyFallback(): HardwareTier {
  const ramStr = safeExec(
    process.platform === 'darwin'
      ? 'sysctl -n hw.memsize'
      : 'cat /proc/meminfo 2>/dev/null | grep MemTotal | awk \'{print $2 * 1024}\''
  );
  const ramGB = ramStr ? Math.round(Number(ramStr) / (1024 ** 3)) : 8;
  const cpuCores =
    Number(process.platform === 'darwin' ? safeExec('sysctl -n hw.logicalcpu') : safeExec('nproc 2>/dev/null')) || 4;

  return {
    id: 'low',
    gpuVendor: 'none',
    vramGB: 0,
    ramGB,
    cpuCores,
    recommendedQuant: 'q4',
    maxConcurrentInferences: 1,
  };
}

export function detectHardware(forceTier?: HardwareTierId | null): DetectionResult {
  if (forceTier) {
    return {
      tier: buildForcedTier(forceTier),
      detectionMethod: 'forced',
      rawInfo: { forceTier },
    };
  }

  const apple = detectAppleSilicon();
  if (apple) {
    return { tier: apple, detectionMethod: 'auto', rawInfo: { vendor: 'apple' } };
  }

  const nvidia = detectNvidia();
  if (nvidia) {
    return { tier: nvidia, detectionMethod: 'auto', rawInfo: { vendor: 'nvidia' } };
  }

  const amd = detectAmd();
  if (amd) {
    return { tier: amd, detectionMethod: 'auto', rawInfo: { vendor: 'amd' } };
  }

  const cpu = cpuOnlyFallback();
  return { tier: cpu, detectionMethod: 'auto', rawInfo: { vendor: 'none' } };
}

function buildForcedTier(id: HardwareTierId): HardwareTier {
  const TIER_PRESETS: Record<HardwareTierId, HardwareTier> = {
    low: { id: 'low', gpuVendor: 'none', vramGB: 0, ramGB: 8, cpuCores: 4, recommendedQuant: 'q4', maxConcurrentInferences: 1 },
    mid: { id: 'mid', gpuVendor: 'nvidia', vramGB: 12, ramGB: 32, cpuCores: 16, recommendedQuant: 'q5', maxConcurrentInferences: 2 },
    high: { id: 'high', gpuVendor: 'nvidia', vramGB: 40, ramGB: 64, cpuCores: 32, recommendedQuant: 'q6', maxConcurrentInferences: 3 },
    ultra: { id: 'ultra', gpuVendor: 'nvidia', vramGB: 80, ramGB: 128, cpuCores: 64, recommendedQuant: 'fp16', maxConcurrentInferences: 4 },
    'apple-silicon': { id: 'apple-silicon', gpuVendor: 'apple', vramGB: 36, ramGB: 36, cpuCores: 12, recommendedQuant: 'q6', maxConcurrentInferences: 2 },
  };
  return TIER_PRESETS[id];
}
