// KIMI-AUTO-01: Unified Autonomy Level System for NOVA26
// Maps autonomy levels 1-5 to concrete RalphLoopOptions + SwarmOptions

import type { RalphLoopOptions } from '../orchestrator/ralph-loop-types.js';

// SwarmOptions was previously in src/swarm/swarm-mode.ts (module deleted with CUT R23-04)
export interface SwarmOptions {
  maxConcurrency: number;
  timeoutPerAgent: number;
  continueOnFailure: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Type Definitions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Valid autonomy levels (1-5)
 * - Level 1: Manual - Every task needs human approval
 * - Level 2: Guided - Plan approval required, limited auto-fix
 * - Level 3: Balanced - No plan approval, moderate auto-fix
 * - Level 4: Autonomous - Full auto-fix, continue on failure
 * - Level 5: Full Auto - Everything enabled, max retries, no pauses
 */
export type AutonomyLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Complete autonomy configuration mapping a level to its settings
 */
export interface AutonomyConfig {
  level: AutonomyLevel;
  name: string;
  description: string;
  ralph: Partial<RalphLoopOptions>;
  swarm: Partial<SwarmOptions>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Autonomy Level Configurations
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Level 1 (Manual): Every task needs human approval
 * - planApproval: true (pause for every plan)
 * - autoTestFix: false (no automatic fixes)
 * - maxTestRetries: 0
 * - pauseOnGateFailure: true (pause on any gate failure)
 * - continueOnFailure: false (stop on failure)
 * - verbose: true (maximum detail for human review)
 */
const LEVEL_1_MANUAL: AutonomyConfig = {
  level: 1,
  name: 'Manual',
  description: 'Every task needs human approval. Maximum oversight with plan approval required, no auto-fixes, and pauses on all failures.',
  ralph: {
    planApproval: true,
    autoTestFix: false,
    maxTestRetries: 0,
    parallelMode: false,
  },
  swarm: {
    maxConcurrency: 1,
    timeoutPerAgent: 300000, // 5 minutes for human response
    continueOnFailure: false,
  },
};

/**
 * Level 2 (Guided): Plan approval required, limited auto-fix
 * - planApproval: true (still need plan approval)
 * - autoTestFix: true (enable auto-fixes)
 * - maxTestRetries: 1 (minimal retries)
 * - pauseOnGateFailure: true (pause on gate failures)
 * - continueOnFailure: false (stop on failure)
 * - verbose: true
 */
const LEVEL_2_GUIDED: AutonomyConfig = {
  level: 2,
  name: 'Guided',
  description: 'Plan approval required with limited auto-fix capabilities. Pauses on gate failures, single retry for test fixes.',
  ralph: {
    planApproval: true,
    autoTestFix: true,
    maxTestRetries: 1,
    parallelMode: false,
  },
  swarm: {
    maxConcurrency: 2,
    timeoutPerAgent: 180000, // 3 minutes
    continueOnFailure: false,
  },
};

/**
 * Level 3 (Balanced): No plan approval, moderate auto-fix
 * - planApproval: false (no plan approval needed)
 * - autoTestFix: true (enable auto-fixes)
 * - maxTestRetries: 3 (moderate retries)
 * - pauseOnGateFailure: false (no pausing)
 * - continueOnFailure: false (stop on failure)
 * - verbose: false
 */
const LEVEL_3_BALANCED: AutonomyConfig = {
  level: 3,
  name: 'Balanced',
  description: 'No plan approval required with moderate auto-fix capabilities. Up to 3 test retries, stops on failure but does not pause.',
  ralph: {
    planApproval: false,
    autoTestFix: true,
    maxTestRetries: 3,
    parallelMode: true,
  },
  swarm: {
    maxConcurrency: 4,
    timeoutPerAgent: 120000, // 2 minutes
    continueOnFailure: false,
  },
};

/**
 * Level 4 (Autonomous): Full auto-fix, continue on failure
 * - planApproval: false (no plan approval needed)
 * - autoTestFix: true (enable auto-fixes)
 * - maxTestRetries: 5 (generous retries)
 * - pauseOnGateFailure: false (no pausing)
 * - continueOnFailure: true (continue despite failures)
 * - verbose: false
 */
const LEVEL_4_AUTONOMOUS: AutonomyConfig = {
  level: 4,
  name: 'Autonomous',
  description: 'Full autonomy with up to 5 test retries and continue-on-failure enabled. Best for trusted codebases.',
  ralph: {
    planApproval: false,
    autoTestFix: true,
    maxTestRetries: 5,
    parallelMode: true,
  },
  swarm: {
    maxConcurrency: 6,
    timeoutPerAgent: 90000, // 1.5 minutes
    continueOnFailure: true,
  },
};

/**
 * Level 5 (Full Auto): Everything enabled, max retries, no pauses
 * - planApproval: false (no plan approval needed)
 * - autoTestFix: true (enable auto-fixes)
 * - maxTestRetries: 10 (maximum retries)
 * - pauseOnGateFailure: false (never pause)
 * - continueOnFailure: true (always continue)
 * - verbose: false (minimal output)
 * - maxConcurrency: 10 (maximum parallelism)
 */
const LEVEL_5_FULL_AUTO: AutonomyConfig = {
  level: 5,
  name: 'Full Auto',
  description: 'Maximum autonomy with 10 test retries, maximum parallelism, and no pauses. For fully automated CI/CD pipelines.',
  ralph: {
    planApproval: false,
    autoTestFix: true,
    maxTestRetries: 10,
    parallelMode: true,
  },
  swarm: {
    maxConcurrency: 10,
    timeoutPerAgent: 60000, // 1 minute
    continueOnFailure: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Registry of All Levels
// ═══════════════════════════════════════════════════════════════════════════════

const AUTONOMY_LEVELS: Record<AutonomyLevel, AutonomyConfig> = {
  1: LEVEL_1_MANUAL,
  2: LEVEL_2_GUIDED,
  3: LEVEL_3_BALANCED,
  4: LEVEL_4_AUTONOMOUS,
  5: LEVEL_5_FULL_AUTO,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the RalphLoopOptions and SwarmOptions for a given autonomy level
 * @param level - The autonomy level (1-5)
 * @returns Object containing ralph and swarm partial options
 * @throws Error if level is not a valid AutonomyLevel
 */
export function getAutonomyOptions(level: AutonomyLevel): {
  ralph: Partial<RalphLoopOptions>;
  swarm: Partial<SwarmOptions>;
} {
  const config = getAutonomyConfig(level);
  return {
    ralph: config.ralph,
    swarm: config.swarm,
  };
}

/**
 * Get the complete AutonomyConfig for a given level
 * @param level - The autonomy level (1-5)
 * @returns Complete AutonomyConfig including name and description
 * @throws Error if level is not a valid AutonomyLevel
 */
export function getAutonomyConfig(level: AutonomyLevel): AutonomyConfig {
  if (!isValidAutonomyLevel(level)) {
    throw new Error(
      `Invalid autonomy level: ${level}. Must be one of: ${Object.keys(AUTONOMY_LEVELS).join(', ')}`
    );
  }
  return AUTONOMY_LEVELS[level];
}

/**
 * List all available autonomy levels with their configurations
 * @returns Array of all AutonomyConfig objects (levels 1-5)
 */
export function listAutonomyLevels(): AutonomyConfig[] {
  return Object.values(AUTONOMY_LEVELS).sort((a, b) => a.level - b.level);
}

/**
 * Format a human-readable description of an autonomy level
 * @param level - The autonomy level (1-5)
 * @returns Formatted multi-line description string
 * @throws Error if level is not a valid AutonomyLevel
 */
export function formatAutonomyDescription(level: AutonomyLevel): string {
  const config = getAutonomyConfig(level);

  const lines: string[] = [
    `╔══════════════════════════════════════════════════════════════════╗`,
    `║  Autonomy Level ${config.level}: ${config.name.padEnd(42 - config.name.length)}║`,
    `╠══════════════════════════════════════════════════════════════════╣`,
    wrapText(config.description, 64, '║  ', '║'),
    `╠══════════════════════════════════════════════════════════════════╣`,
    `║  Ralph Loop Options:                                             ║`,
    `║    • Plan Approval:      ${formatBoolean(config.ralph.planApproval)}                               ║`,
    `║    • Auto Test Fix:      ${formatBoolean(config.ralph.autoTestFix)}                               ║`,
    `║    • Max Test Retries:   ${String(config.ralph.maxTestRetries).padEnd(33)}║`,
    `║    • Parallel Mode:      ${formatBoolean(config.ralph.parallelMode)}                               ║`,
    `╠══════════════════════════════════════════════════════════════════╣`,
    `║  Swarm Options:                                                  ║`,
    `║    • Max Concurrency:    ${String(config.swarm.maxConcurrency).padEnd(33)}║`,
    `║    • Timeout/Agent:      ${formatTimeout(config.swarm.timeoutPerAgent)}                         ║`,
    `║    • Continue on Fail:   ${formatBoolean(config.swarm.continueOnFailure)}                               ║`,
    `╚══════════════════════════════════════════════════════════════════╝`,
  ];

  return lines.join('\n');
}

/**
 * Check if a number is a valid AutonomyLevel
 * @param level - The value to check
 * @returns True if level is 1, 2, 3, 4, or 5
 */
export function isValidAutonomyLevel(level: unknown): level is AutonomyLevel {
  return typeof level === 'number' && level in AUTONOMY_LEVELS;
}

/**
 * Get the default autonomy level (3 - Balanced)
 * @returns Default AutonomyLevel (3)
 */
export function getDefaultAutonomyLevel(): AutonomyLevel {
  return 3;
}

/**
 * Parse an autonomy level from various input types
 * @param value - The value to parse (number, string, or unknown)
 * @returns Valid AutonomyLevel or null if invalid
 */
export function parseAutonomyLevel(value: unknown): AutonomyLevel | null {
  if (typeof value === 'number') {
    return isValidAutonomyLevel(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isValidAutonomyLevel(parsed) ? parsed : null;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

function formatBoolean(value: boolean | undefined): string {
  return value === true ? '✓' : value === false ? '✗' : '?';
}

function formatTimeout(ms: number | undefined): string {
  if (ms === undefined) return '?';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining > 0 ? `${minutes}m ${remaining}s` : `${minutes}m`;
}

function wrapText(text: string, maxWidth: number, prefix: string, suffix: string): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxWidth) {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    } else {
      if (currentLine) {
        lines.push(`${prefix}${currentLine.padEnd(maxWidth)}${suffix}`);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(`${prefix}${currentLine.padEnd(maxWidth)}${suffix}`);
  }

  return lines.join('\n');
}
