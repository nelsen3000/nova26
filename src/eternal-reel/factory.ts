// Eternal Data Reel Factory - K3-37
// Initializes all 4 Eternal Data Reel modules with shared config

import { createHarnessManager } from '../harness/harness-manager.js';
import { createHarnessSerializer } from '../harness/harness-serializer.js';
import { createEternalEngineBridge } from '../harness/eternal-engine-bridge.js';
import { HindsightEngine, createHindsightEngine } from '../hindsight/engine.js';
import type { HarnessManager } from '../harness/harness-manager.js';
import type { HarnessSerializer } from '../harness/harness-serializer.js';
import type { EternalEngineBridge } from '../harness/eternal-engine-bridge.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════════════════════

export interface EternalReelConfig {
  /** Namespace prefix for Hindsight memory isolation */
  namespace?: string;
  /** Max memory fragments to retain in Hindsight */
  maxFragments?: number;
  /** Enable cross-module telemetry wiring */
  telemetryEnabled?: boolean;
}

export const DEFAULT_ETERNAL_REEL_CONFIG: Required<EternalReelConfig> = {
  namespace: 'default',
  maxFragments: 1000,
  telemetryEnabled: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Eternal Reel Instance
// ═══════════════════════════════════════════════════════════════════════════════

export interface EternalReelInstance {
  /** Agent harness registry for long-running tasks */
  harnessManager: HarnessManager;
  /** Harness state serializer */
  harnessSerializer: HarnessSerializer;
  /** Persistence bridge (Rust/SQLite/memory) */
  persistenceBridge: EternalEngineBridge;
  /** Hindsight persistent memory engine */
  hindsight: HindsightEngine;
  /** Resolved config */
  config: Required<EternalReelConfig>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a fully initialized Eternal Data Reel system.
 * All 4 modules share the same namespace and config.
 */
export function createEternalReel(config: EternalReelConfig = {}): EternalReelInstance {
  const resolvedConfig: Required<EternalReelConfig> = {
    ...DEFAULT_ETERNAL_REEL_CONFIG,
    ...config,
  };

  const harnessManager = createHarnessManager();
  const harnessSerializer = createHarnessSerializer();
  const persistenceBridge = createEternalEngineBridge();
  const hindsight = createHindsightEngine({
    namespace: resolvedConfig.namespace,
    maxFragmentsBeforeCompression: resolvedConfig.maxFragments,
  });

  return {
    harnessManager,
    harnessSerializer,
    persistenceBridge,
    hindsight,
    config: resolvedConfig,
  };
}
