// A2A Tier Configuration — Default tier assignments for all 21 Nova26 agents
// Sprint S2-18 | A2A Agent-to-Agent Protocols

import type { AgentTier } from './types.js';

// Default tier assignments for all 21 Planetary Agents
export const DEFAULT_TIER_ASSIGNMENTS: Record<string, AgentTier> = {
  // L0 — Strategic Coordinator (Sun)
  SUN: 'L0',

  // L1 — Core Executors
  MERCURY: 'L1',
  EARTH: 'L1',
  JUPITER: 'L1',
  SATURN: 'L1',
  ATLAS: 'L1',

  // L2 — Specialists
  VENUS: 'L2',
  MARS: 'L2',
  NEPTUNE: 'L2',
  URANUS: 'L2',
  TITAN: 'L2',
  TRITON: 'L2',
  ANDROMEDA: 'L2',
  CALLISTO: 'L2',

  // L3 — Sub-task Workers
  IO: 'L3',
  GANYMEDE: 'L3',
  PLUTO: 'L3',
  CHARON: 'L3',
  MIMAS: 'L3',
  ENCELADUS: 'L3',
  EUROPA: 'L3',
};

export interface TierRule {
  canMessageTiers: AgentTier[];
  requiresEscalationFor: AgentTier[];
  maxDirectHops: number;
}

// Routing rules per tier
export const DEFAULT_TIER_RULES: Record<AgentTier, TierRule> = {
  L0: {
    canMessageTiers: ['L0', 'L1', 'L2', 'L3'],
    requiresEscalationFor: [],
    maxDirectHops: 5,
  },
  L1: {
    canMessageTiers: ['L0', 'L1', 'L2', 'L3'],
    requiresEscalationFor: [],
    maxDirectHops: 4,
  },
  L2: {
    canMessageTiers: ['L1', 'L2', 'L3'],
    requiresEscalationFor: ['L0'],
    maxDirectHops: 3,
  },
  L3: {
    canMessageTiers: ['L2', 'L3'],
    requiresEscalationFor: ['L0', 'L1'],
    maxDirectHops: 2,
  },
};

/**
 * Check if a source tier can message a target tier directly.
 */
export function canRoute(sourceTier: AgentTier, targetTier: AgentTier): boolean {
  return DEFAULT_TIER_RULES[sourceTier].canMessageTiers.includes(targetTier);
}

/**
 * Check if routing from source to target requires escalation justification.
 */
export function requiresEscalation(sourceTier: AgentTier, targetTier: AgentTier): boolean {
  return DEFAULT_TIER_RULES[sourceTier].requiresEscalationFor.includes(targetTier);
}
