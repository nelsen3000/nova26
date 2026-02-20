// KIMI-R26-01: Model Routing Lifecycle Adapter
// Bridges Ralph Loop lifecycle events to Model Routing

import type { FeatureLifecycleHandlers } from '../orchestrator/lifecycle-wiring.js';
import type {
  BuildContext,
  TaskContext,
} from '../orchestrator/lifecycle-hooks.js';
import { ModelRouter, type RouterConfig } from './router.js';
import { ModelRegistry } from './model-registry.js';
import { HardwareDetector } from './hardware-detector.js';
import { SpeculativeDecoder } from './speculative-decoder.js';
import type {
  ModelRoutingConfig,
  ModelRouteResult,
  HardwareTier,
} from './types.js';

// ============================================================================
// Configuration Types
// ============================================================================

export interface ModelRoutingLifecycleConfig {
  /** Enable model routing */
  enabled: boolean;
  /** Model routing configuration */
  routingConfig?: Partial<ModelRoutingConfig>;
  /** Router-specific configuration */
  routerConfig?: Partial<RouterConfig>;
  /** Confidence threshold for model selection */
  confidenceThreshold?: number;
  /** Enable speculative decoding */
  enableSpeculativeDecoding?: boolean;
  /** Maximum draft tokens for speculative decoding */
  draftTokens?: number;
}

// ============================================================================
// Adapter State
// ============================================================================

interface BuildState {
  buildId: string;
  registry: ModelRegistry;
  hardwareDetector: HardwareDetector;
  router: ModelRouter;
  speculativeDecoder: SpeculativeDecoder;
  hardware: HardwareTier;
  routingDecisions: Map<string, ModelRouteResult>;
  startTime: number;
}

// Module-level state (isolated per build)
let currentBuildState: BuildState | null = null;

// ============================================================================
// Type Guards
// ============================================================================

function isValidBuildContext(context: unknown): context is BuildContext {
  return (
    typeof context === 'object' &&
    context !== null &&
    'buildId' in context &&
    'prdId' in context &&
    typeof (context as Record<string, unknown>).buildId === 'string'
  );
}

function isValidTaskContext(context: unknown): context is TaskContext {
  return (
    typeof context === 'object' &&
    context !== null &&
    'taskId' in context &&
    'agentName' in context &&
    'title' in context &&
    typeof (context as Record<string, unknown>).taskId === 'string'
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function estimateTaskComplexity(taskDescription: string): number {
  const length = taskDescription.length;
  let complexity = 0.5;

  // Length-based adjustment
  if (length > 100) complexity += 0.1;
  if (length > 500) complexity += 0.1;
  if (length > 1000) complexity += 0.1;

  // Keyword-based complexity detection
  const complexityKeywords = [
    'refactor', 'optimize', 'architecture', 'design pattern',
    'security audit', 'performance', 'scalability', 'distributed',
    'complex', 'advanced', 'deep', 'comprehensive'
  ];

  const lowerDesc = taskDescription.toLowerCase();
  for (const keyword of complexityKeywords) {
    if (lowerDesc.includes(keyword)) {
      complexity += 0.05;
    }
  }

  return Math.min(complexity, 1.0);
}

function determineConfidence(agentName: string, taskDescription: string, config: ModelRoutingLifecycleConfig): number {
  // Base confidence from config
  let confidence = config.confidenceThreshold ?? 0.75;

  // Adjust based on task complexity
  const complexity = estimateTaskComplexity(taskDescription);
  confidence = confidence * (0.8 + complexity * 0.4);

  // Adjust based on agent type
  const highConfidenceAgents = ['kimi', 'claude', 'gpt4'];
  const lowConfidenceAgents = ['junior', 'trainee', 'experimental'];

  const agentLower = agentName.toLowerCase();
  if (highConfidenceAgents.some(a => agentLower.includes(a))) {
    confidence += 0.1;
  } else if (lowConfidenceAgents.some(a => agentLower.includes(a))) {
    confidence -= 0.1;
  }

  return Math.min(Math.max(confidence, 0.1), 1.0);
}

// ============================================================================
// Lifecycle Hook Factory
// ============================================================================

export function createModelRoutingLifecycleHooks(
  config: ModelRoutingLifecycleConfig
): FeatureLifecycleHandlers {
  return {
    onBeforeBuild: async (context: BuildContext): Promise<void> => {
      if (!config.enabled) return;

      // Validate context
      if (!isValidBuildContext(context)) {
        console.warn('[ModelRoutingAdapter] Invalid build context');
        return;
      }

      // Reset state
      currentBuildState = null;

      // Initialize components
      const registry = new ModelRegistry();
      const hardwareDetector = new HardwareDetector();
      const hardware = hardwareDetector.detect();

      // Create router
      const router = new ModelRouter(
        registry,
        hardwareDetector,
        config.routerConfig
      );

      // Create speculative decoder
      const speculativeDecoder = new SpeculativeDecoder({
        maxDraftTokens: config.draftTokens ?? 4,
      });

      // Store build state
      currentBuildState = {
        buildId: context.buildId,
        registry,
        hardwareDetector,
        router,
        speculativeDecoder,
        hardware,
        routingDecisions: new Map(),
        startTime: Date.now(),
      };

      console.log('[ModelRoutingAdapter] Initialized for build', context.buildId, {
        hardwareTier: hardware.id,
        vramGB: hardware.vramGB,
        ramGB: hardware.ramGB,
      });
    },

    onBeforeTask: async (context: TaskContext): Promise<void> => {
      if (!config.enabled || !currentBuildState) return;

      // Validate context
      if (!isValidTaskContext(context)) {
        console.warn('[ModelRoutingAdapter] Invalid task context');
        return;
      }

      const { router } = currentBuildState;

      // Determine confidence level for this task
      const confidence = determineConfidence(context.agentName, context.title, config);

      try {
        // Route the task to the best model
        const routeResult = router.route(context.agentName, context.title, confidence);

        // Store routing decision
        currentBuildState.routingDecisions.set(context.taskId, routeResult);

        // Log routing decision
        console.log('[ModelRoutingAdapter] Routed task', context.taskId, {
          agent: context.agentName,
          model: routeResult.selectedModel.name,
          confidence: routeResult.confidence.toFixed(2),
          speculativeDecoding: routeResult.useSpeculativeDecoding,
          estimatedTokensPerSec: routeResult.estimatedTokensPerSec,
          fallbackCount: routeResult.fallbackChain.length,
        });

        // Set up speculative decoding if available and enabled
        if (routeResult.useSpeculativeDecoding && config.enableSpeculativeDecoding !== false) {
          const draftModel = routeResult.selectedModel.speculativeDraft;
          if (draftModel) {
            console.log('[ModelRoutingAdapter] Speculative decoding enabled', {
              draftModel,
              verifyModel: routeResult.selectedModel.name,
              maxDraftTokens: config.draftTokens ?? 4,
            });
          }
        }

        // Check if escalation is recommended
        const shouldEscalate = router.shouldEscalate(routeResult.selectedModel.name, confidence);
        if (shouldEscalate) {
          console.log('[ModelRoutingAdapter] Escalation recommended for task', context.taskId, {
            currentModel: routeResult.selectedModel.name,
            confidence: confidence.toFixed(2),
          });
        }
      } catch (error) {
        // Handle routing errors gracefully - use fallback
        console.warn('[ModelRoutingAdapter] Routing failed for task', context.taskId, {
          agent: context.agentName,
          error: error instanceof Error ? error.message : String(error),
        });

        // Create a fallback routing result
        const fallbackResult: ModelRouteResult = {
          agentId: context.agentName,
          selectedModel: {
            name: 'gpt-4o',
            family: 'openai',
            strength: 'power',
            quant: 'FP16',
            contextWindow: 128000,
            tokensPerSec: 50,
            costFactor: 1.0,
          },
          fallbackChain: [],
          useSpeculativeDecoding: false,
          estimatedTokensPerSec: 50,
          estimatedCost: 0.1,
          confidence: 0.5,
        };

        currentBuildState.routingDecisions.set(context.taskId, fallbackResult);
      }
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getCurrentBuildState(): BuildState | null {
  return currentBuildState;
}

export function getRoutingDecision(taskId: string): ModelRouteResult | undefined {
  return currentBuildState?.routingDecisions.get(taskId);
}

export function getAllRoutingDecisions(): Map<string, ModelRouteResult> {
  return new Map(currentBuildState?.routingDecisions ?? []);
}

export function resetBuildState(): void {
  currentBuildState = null;
}
