// Autonomy Gating - Human oversight control for evolution
// Spec: .kiro/specs/saga-self-evolving-agents/design.md

// ═══════════════════════════════════════════════════════════════════════════════
// Autonomy Levels
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Autonomy Level 1-2: High oversight
 * - Pause after every generation for human approval
 * - All changes require explicit approval
 */

/**
 * Autonomy Level 3: Balanced
 * - Pause on significant fitness deviation
 * - Swarm Debate enabled for important decisions
 */

/**
 * Autonomy Level 4-5: Full autonomy
 * - No pauses (unless budget exceeded)
 * - Swarm Debate always enabled
 */

export interface AutonomyGatingConfig {
  /** Significant deviation threshold (relative change) */
  deviationThreshold: number;
  /** Generations between mandatory pauses (level 1-2) */
  pauseInterval: number;
}

export const DEFAULT_CONFIG: AutonomyGatingConfig = {
  deviationThreshold: 0.2, // 20% change
  pauseInterval: 1, // Every generation
};

// ═══════════════════════════════════════════════════════════════════════════════
// Gating Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determine if evolution should pause after this generation
 * based on autonomy level
 */
export function shouldPauseAfterGeneration(
  autonomyLevel: number,
  generation: number,
  config: Partial<AutonomyGatingConfig> = {}
): boolean {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Level 1-2: Pause after every N generations
  if (autonomyLevel <= 2) {
    return generation % fullConfig.pauseInterval === 0;
  }

  // Level 3+: No automatic pauses
  return false;
}

/**
 * Determine if a significant deviation should trigger a pause
 * (relevant for level 3)
 */
export function shouldTriggerOnDeviation(
  autonomyLevel: number,
  currentFitness: number,
  previousFitness: number,
  config: Partial<AutonomyGatingConfig> = {}
): boolean {
  // Only level 3 triggers on deviation
  if (autonomyLevel !== 3) {
    return false;
  }

  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Calculate relative change
  if (previousFitness === 0) {
    return currentFitness > 0; // Any improvement from zero is significant
  }

  const relativeChange = Math.abs(currentFitness - previousFitness) / previousFitness;
  return relativeChange > fullConfig.deviationThreshold;
}

/**
 * Determine if Swarm Debate should be enabled
 * (level 3+ enables debate)
 */
export function isSwarmDebateEnabled(autonomyLevel: number): boolean {
  return autonomyLevel >= 3;
}

/**
 * Get human approval requirements for a generation
 */
export function getApprovalRequirements(
  autonomyLevel: number
): {
  requiresExplicitApproval: boolean;
  canAutoApprove: boolean;
  maxGenerationsWithoutApproval: number;
} {
  switch (autonomyLevel) {
    case 1:
      return {
        requiresExplicitApproval: true,
        canAutoApprove: false,
        maxGenerationsWithoutApproval: 0,
      };
    case 2:
      return {
        requiresExplicitApproval: true,
        canAutoApprove: false,
        maxGenerationsWithoutApproval: 1,
      };
    case 3:
      return {
        requiresExplicitApproval: false,
        canAutoApprove: true,
        maxGenerationsWithoutApproval: 5,
      };
    case 4:
      return {
        requiresExplicitApproval: false,
        canAutoApprove: true,
        maxGenerationsWithoutApproval: 10,
      };
    case 5:
      return {
        requiresExplicitApproval: false,
        canAutoApprove: true,
        maxGenerationsWithoutApproval: Infinity,
      };
    default:
      return {
        requiresExplicitApproval: true,
        canAutoApprove: false,
        maxGenerationsWithoutApproval: 0,
      };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Gate Decision
// ═══════════════════════════════════════════════════════════════════════════════

export interface GateDecision {
  shouldPause: boolean;
  reason: string;
  requiresHumanInput: boolean;
}

export function evaluateGate(
  autonomyLevel: number,
  generation: number,
  currentFitness: number,
  previousFitness: number,
  config: Partial<AutonomyGatingConfig> = {}
): GateDecision {
  // Check for mandatory pause (level 1-2)
  if (shouldPauseAfterGeneration(autonomyLevel, generation, config)) {
    return {
      shouldPause: true,
      reason: `Mandatory pause after generation ${generation} (autonomy level ${autonomyLevel})`,
      requiresHumanInput: true,
    };
  }

  // Check for significant deviation (level 3)
  if (shouldTriggerOnDeviation(autonomyLevel, currentFitness, previousFitness, config)) {
    const change = ((currentFitness - previousFitness) / previousFitness * 100).toFixed(1);
    return {
      shouldPause: true,
      reason: `Significant fitness deviation detected: ${change}% change`,
      requiresHumanInput: true,
    };
  }

  // No pause needed
  return {
    shouldPause: false,
    reason: 'No gating conditions met',
    requiresHumanInput: false,
  };
}
