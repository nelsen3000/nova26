/**
 * Nova26 Model Routing & Speculative Decoding Module
 * KIMI-R22-01 - Public Exports
 * 
 * This module provides intelligent model routing, hardware auto-detection,
 * speculative decoding acceleration, and priority-based inference queueing
 * for the Nova26 multi-agent system.
 */

// Type definitions
export type {
  HardwareTierId,
  HardwareTier,
  ModelProfile,
  AgentModelMapping,
  ModelRoutingConfig,
  SpeculativeDecodingConfig,
  InferenceMetrics,
  ModelRouteResult,
  DecodeResult,
  InferenceRequest,
} from './types.js';

// Hardware detection
export { HardwareDetector } from './hardware-detector.js';

// Model registry
export { ModelRegistry } from './model-registry.js';

// Router
export { ModelRouter, type RouterConfig } from './router.js';

// Speculative decoding
export {
  SpeculativeDecoder,
  type SpeculativeDecoderConfig,
} from './speculative-decoder.js';

// Inference queue
export {
  InferenceQueue,
  createInferenceRequest,
  type InferenceQueueConfig,
  type QueueStats,
} from './inference-queue.js';

/**
 * Creates a fully configured model routing system with all components
 * wired together with sensible defaults.
 */
import { ModelRegistry } from './model-registry.js';
import { HardwareDetector } from './hardware-detector.js';
import { ModelRouter, RouterConfig } from './router.js';
import { SpeculativeDecoder } from './speculative-decoder.js';
import { InferenceQueue, InferenceQueueConfig } from './inference-queue.js';
import { ModelRoutingConfig, HardwareTierId } from './types.js';

export interface RoutingSystemOptions {
  /** Override auto-detected hardware tier */
  hardwareTier?: HardwareTierId;
  /** Router configuration */
  routerConfig?: Partial<RouterConfig>;
  /** Queue configuration */
  queueConfig?: Partial<InferenceQueueConfig>;
  /** Enable speculative decoding */
  enableSpeculativeDecoding?: boolean;
  /** Maximum draft tokens for speculative decoding */
  draftTokens?: number;
}

export interface RoutingSystem {
  registry: ModelRegistry;
  hardwareDetector: HardwareDetector;
  router: ModelRouter;
  speculativeDecoder: SpeculativeDecoder;
  queue: InferenceQueue;
  config: ModelRoutingConfig;
}

/**
 * Factory function to create a complete routing system.
 */
export function createRoutingSystem(options: RoutingSystemOptions = {}): RoutingSystem {
  // Initialize components
  const registry = new ModelRegistry();
  const hardwareDetector = new HardwareDetector();
  
  // Detect or use specified hardware
  const detectedHardware = options.hardwareTier 
    ? { ...hardwareDetector.detect(), id: options.hardwareTier }
    : hardwareDetector.detect();

  // Create router
  const router = new ModelRouter(
    registry,
    hardwareDetector,
    options.routerConfig
  );

  // Create speculative decoder
  const speculativeDecoder = new SpeculativeDecoder({
    maxDraftTokens: options.draftTokens ?? 4,
  });

  // Create inference queue
  const queue = new InferenceQueue(options.queueConfig);

  // Build configuration
  const config: ModelRoutingConfig = {
    enabled: true,
    autoDetectHardware: !options.hardwareTier,
    defaultTier: detectedHardware.id,
    agentMappings: registry.getDefaultMappings(),
    speculativeDecoding: {
      enabled: options.enableSpeculativeDecoding ?? true,
      draftModel: 'llama-3.1-8b-Q4_K_M',
      verifyModel: 'llama-3.1-70b-Q4_K_M',
      draftTokens: options.draftTokens ?? 4,
      acceptanceRateTarget: 0.7,
    },
    queueEnabled: options.queueConfig?.maxSize !== 0,
    benchmarkOnStartup: false,
  };

  return {
    registry,
    hardwareDetector,
    router,
    speculativeDecoder,
    queue,
    config,
  };
}

// Re-export factory as default
export { createRoutingSystem as default };
