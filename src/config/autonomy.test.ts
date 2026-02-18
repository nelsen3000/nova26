// KIMI-AUTO-01: Tests for Unified Autonomy Level System

import { describe, it, expect } from 'vitest';
import {
  getAutonomyOptions,
  getAutonomyConfig,
  listAutonomyLevels,
  formatAutonomyDescription,
  isValidAutonomyLevel,
  getDefaultAutonomyLevel,
  parseAutonomyLevel,
  type AutonomyLevel,
  type AutonomyConfig,
} from './autonomy.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Level Validation Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('isValidAutonomyLevel', () => {
  it('returns true for valid levels 1-5', () => {
    expect(isValidAutonomyLevel(1)).toBe(true);
    expect(isValidAutonomyLevel(2)).toBe(true);
    expect(isValidAutonomyLevel(3)).toBe(true);
    expect(isValidAutonomyLevel(4)).toBe(true);
    expect(isValidAutonomyLevel(5)).toBe(true);
  });

  it('returns false for invalid levels', () => {
    expect(isValidAutonomyLevel(0)).toBe(false);
    expect(isValidAutonomyLevel(6)).toBe(false);
    expect(isValidAutonomyLevel(-1)).toBe(false);
    expect(isValidAutonomyLevel(1.5)).toBe(false);
  });

  it('returns false for non-number values', () => {
    expect(isValidAutonomyLevel('1')).toBe(false);
    expect(isValidAutonomyLevel(null)).toBe(false);
    expect(isValidAutonomyLevel(undefined)).toBe(false);
    expect(isValidAutonomyLevel({})).toBe(false);
    expect(isValidAutonomyLevel([])).toBe(false);
  });
});

describe('parseAutonomyLevel', () => {
  it('parses valid number levels', () => {
    expect(parseAutonomyLevel(1)).toBe(1);
    expect(parseAutonomyLevel(5)).toBe(5);
  });

  it('parses valid string levels', () => {
    expect(parseAutonomyLevel('1')).toBe(1);
    expect(parseAutonomyLevel('5')).toBe(5);
    expect(parseAutonomyLevel('3')).toBe(3);
  });

  it('returns null for invalid levels', () => {
    expect(parseAutonomyLevel(0)).toBeNull();
    expect(parseAutonomyLevel(6)).toBeNull();
    expect(parseAutonomyLevel('invalid')).toBeNull();
    expect(parseAutonomyLevel('')).toBeNull();
  });
});

describe('getDefaultAutonomyLevel', () => {
  it('returns level 3 (Balanced)', () => {
    expect(getDefaultAutonomyLevel()).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Level 1 (Manual) Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Level 1 (Manual)', () => {
  it('returns correct configuration', () => {
    const config = getAutonomyConfig(1);

    expect(config.level).toBe(1);
    expect(config.name).toBe('Manual');
    expect(config.description).toContain('human approval');
  });

  it('has planApproval=true', () => {
    const options = getAutonomyOptions(1);
    expect(options.ralph.planApproval).toBe(true);
  });

  it('has autoTestFix=false', () => {
    const options = getAutonomyOptions(1);
    expect(options.ralph.autoTestFix).toBe(false);
  });

  it('has maxTestRetries=0', () => {
    const options = getAutonomyOptions(1);
    expect(options.ralph.maxTestRetries).toBe(0);
  });

  it('has parallelMode=false', () => {
    const options = getAutonomyOptions(1);
    expect(options.ralph.parallelMode).toBe(false);
  });

  it('has maxConcurrency=1', () => {
    const options = getAutonomyOptions(1);
    expect(options.swarm.maxConcurrency).toBe(1);
  });

  it('has continueOnFailure=false', () => {
    const options = getAutonomyOptions(1);
    expect(options.swarm.continueOnFailure).toBe(false);
  });

  it('has longer timeout for human response', () => {
    const options = getAutonomyOptions(1);
    expect(options.swarm.timeoutPerAgent).toBe(300000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Level 2 (Guided) Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Level 2 (Guided)', () => {
  it('returns correct configuration', () => {
    const config = getAutonomyConfig(2);

    expect(config.level).toBe(2);
    expect(config.name).toBe('Guided');
    expect(config.description).toContain('limited auto-fix');
  });

  it('has planApproval=true', () => {
    const options = getAutonomyOptions(2);
    expect(options.ralph.planApproval).toBe(true);
  });

  it('has autoTestFix=true', () => {
    const options = getAutonomyOptions(2);
    expect(options.ralph.autoTestFix).toBe(true);
  });

  it('has maxTestRetries=1', () => {
    const options = getAutonomyOptions(2);
    expect(options.ralph.maxTestRetries).toBe(1);
  });

  it('has parallelMode=false', () => {
    const options = getAutonomyOptions(2);
    expect(options.ralph.parallelMode).toBe(false);
  });

  it('has maxConcurrency=2', () => {
    const options = getAutonomyOptions(2);
    expect(options.swarm.maxConcurrency).toBe(2);
  });

  it('has continueOnFailure=false', () => {
    const options = getAutonomyOptions(2);
    expect(options.swarm.continueOnFailure).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Level 3 (Balanced) Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Level 3 (Balanced)', () => {
  it('returns correct configuration', () => {
    const config = getAutonomyConfig(3);

    expect(config.level).toBe(3);
    expect(config.name).toBe('Balanced');
    expect(config.description).toContain('No plan approval');
  });

  it('has planApproval=false', () => {
    const options = getAutonomyOptions(3);
    expect(options.ralph.planApproval).toBe(false);
  });

  it('has autoTestFix=true', () => {
    const options = getAutonomyOptions(3);
    expect(options.ralph.autoTestFix).toBe(true);
  });

  it('has maxTestRetries=3', () => {
    const options = getAutonomyOptions(3);
    expect(options.ralph.maxTestRetries).toBe(3);
  });

  it('has parallelMode=true', () => {
    const options = getAutonomyOptions(3);
    expect(options.ralph.parallelMode).toBe(true);
  });

  it('has maxConcurrency=4', () => {
    const options = getAutonomyOptions(3);
    expect(options.swarm.maxConcurrency).toBe(4);
  });

  it('has continueOnFailure=false', () => {
    const options = getAutonomyOptions(3);
    expect(options.swarm.continueOnFailure).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Level 4 (Autonomous) Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Level 4 (Autonomous)', () => {
  it('returns correct configuration', () => {
    const config = getAutonomyConfig(4);

    expect(config.level).toBe(4);
    expect(config.name).toBe('Autonomous');
    expect(config.description).toContain('continue-on-failure');
  });

  it('has planApproval=false', () => {
    const options = getAutonomyOptions(4);
    expect(options.ralph.planApproval).toBe(false);
  });

  it('has autoTestFix=true', () => {
    const options = getAutonomyOptions(4);
    expect(options.ralph.autoTestFix).toBe(true);
  });

  it('has maxTestRetries=5', () => {
    const options = getAutonomyOptions(4);
    expect(options.ralph.maxTestRetries).toBe(5);
  });

  it('has parallelMode=true', () => {
    const options = getAutonomyOptions(4);
    expect(options.ralph.parallelMode).toBe(true);
  });

  it('has maxConcurrency=6', () => {
    const options = getAutonomyOptions(4);
    expect(options.swarm.maxConcurrency).toBe(6);
  });

  it('has continueOnFailure=true', () => {
    const options = getAutonomyOptions(4);
    expect(options.swarm.continueOnFailure).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Level 5 (Full Auto) Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Level 5 (Full Auto)', () => {
  it('returns correct configuration', () => {
    const config = getAutonomyConfig(5);

    expect(config.level).toBe(5);
    expect(config.name).toBe('Full Auto');
    expect(config.description).toContain('Maximum autonomy');
  });

  it('has planApproval=false', () => {
    const options = getAutonomyOptions(5);
    expect(options.ralph.planApproval).toBe(false);
  });

  it('has autoTestFix=true', () => {
    const options = getAutonomyOptions(5);
    expect(options.ralph.autoTestFix).toBe(true);
  });

  it('has maxTestRetries=10', () => {
    const options = getAutonomyOptions(5);
    expect(options.ralph.maxTestRetries).toBe(10);
  });

  it('has parallelMode=true', () => {
    const options = getAutonomyOptions(5);
    expect(options.ralph.parallelMode).toBe(true);
  });

  it('has maxConcurrency=10', () => {
    const options = getAutonomyOptions(5);
    expect(options.swarm.maxConcurrency).toBe(10);
  });

  it('has continueOnFailure=true', () => {
    const options = getAutonomyOptions(5);
    expect(options.swarm.continueOnFailure).toBe(true);
  });

  it('has shortest timeout for maximum speed', () => {
    const options = getAutonomyOptions(5);
    expect(options.swarm.timeoutPerAgent).toBe(60000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Cross-Level Comparison Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cross-level progression', () => {
  it('planApproval transitions from true to false at level 3', () => {
    expect(getAutonomyOptions(1).ralph.planApproval).toBe(true);
    expect(getAutonomyOptions(2).ralph.planApproval).toBe(true);
    expect(getAutonomyOptions(3).ralph.planApproval).toBe(false);
    expect(getAutonomyOptions(4).ralph.planApproval).toBe(false);
    expect(getAutonomyOptions(5).ralph.planApproval).toBe(false);
  });

  it('maxTestRetries increases with level', () => {
    expect(getAutonomyOptions(1).ralph.maxTestRetries).toBe(0);
    expect(getAutonomyOptions(2).ralph.maxTestRetries).toBe(1);
    expect(getAutonomyOptions(3).ralph.maxTestRetries).toBe(3);
    expect(getAutonomyOptions(4).ralph.maxTestRetries).toBe(5);
    expect(getAutonomyOptions(5).ralph.maxTestRetries).toBe(10);
  });

  it('maxConcurrency increases with level', () => {
    expect(getAutonomyOptions(1).swarm.maxConcurrency).toBe(1);
    expect(getAutonomyOptions(2).swarm.maxConcurrency).toBe(2);
    expect(getAutonomyOptions(3).swarm.maxConcurrency).toBe(4);
    expect(getAutonomyOptions(4).swarm.maxConcurrency).toBe(6);
    expect(getAutonomyOptions(5).swarm.maxConcurrency).toBe(10);
  });

  it('continueOnFailure is false for levels 1-3, true for 4-5', () => {
    expect(getAutonomyOptions(1).swarm.continueOnFailure).toBe(false);
    expect(getAutonomyOptions(2).swarm.continueOnFailure).toBe(false);
    expect(getAutonomyOptions(3).swarm.continueOnFailure).toBe(false);
    expect(getAutonomyOptions(4).swarm.continueOnFailure).toBe(true);
    expect(getAutonomyOptions(5).swarm.continueOnFailure).toBe(true);
  });

  it('timeoutPerAgent decreases with level', () => {
    expect(getAutonomyOptions(1).swarm.timeoutPerAgent).toBeGreaterThan(
      getAutonomyOptions(2).swarm.timeoutPerAgent!
    );
    expect(getAutonomyOptions(2).swarm.timeoutPerAgent).toBeGreaterThan(
      getAutonomyOptions(3).swarm.timeoutPerAgent!
    );
    expect(getAutonomyOptions(3).swarm.timeoutPerAgent).toBeGreaterThan(
      getAutonomyOptions(4).swarm.timeoutPerAgent!
    );
    expect(getAutonomyOptions(4).swarm.timeoutPerAgent).toBeGreaterThan(
      getAutonomyOptions(5).swarm.timeoutPerAgent!
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// List and Description Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('listAutonomyLevels', () => {
  it('returns all 5 levels', () => {
    const levels = listAutonomyLevels();
    expect(levels).toHaveLength(5);
  });

  it('returns levels sorted 1-5', () => {
    const levels = listAutonomyLevels();
    expect(levels[0].level).toBe(1);
    expect(levels[1].level).toBe(2);
    expect(levels[2].level).toBe(3);
    expect(levels[3].level).toBe(4);
    expect(levels[4].level).toBe(5);
  });

  it('returns complete AutonomyConfig objects', () => {
    const levels = listAutonomyLevels();
    for (const level of levels) {
      expect(level).toHaveProperty('level');
      expect(level).toHaveProperty('name');
      expect(level).toHaveProperty('description');
      expect(level).toHaveProperty('ralph');
      expect(level).toHaveProperty('swarm');
    }
  });
});

describe('formatAutonomyDescription', () => {
  it('returns formatted string for level 1', () => {
    const description = formatAutonomyDescription(1);
    expect(description).toContain('Autonomy Level 1');
    expect(description).toContain('Manual');
    expect(description).toContain('Plan Approval');
    expect(description).toContain('Auto Test Fix');
  });

  it('returns formatted string for level 5', () => {
    const description = formatAutonomyDescription(5);
    expect(description).toContain('Autonomy Level 5');
    expect(description).toContain('Full Auto');
    expect(description).toContain('Max Concurrency');
    expect(description).toContain('Continue on Fail');
  });

  it('includes box-drawing characters', () => {
    const description = formatAutonomyDescription(3);
    expect(description).toContain('╔');
    expect(description).toContain('╗');
    expect(description).toContain('╚');
    expect(description).toContain('╝');
    expect(description).toContain('║');
  });

  it('throws error for invalid level', () => {
    expect(() => formatAutonomyDescription(0 as AutonomyLevel)).toThrow('Invalid autonomy level');
    expect(() => formatAutonomyDescription(6 as AutonomyLevel)).toThrow('Invalid autonomy level');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Error Handling Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Error handling', () => {
  it('getAutonomyConfig throws for level 0', () => {
    expect(() => getAutonomyConfig(0 as AutonomyLevel)).toThrow('Invalid autonomy level');
  });

  it('getAutonomyConfig throws for level 6', () => {
    expect(() => getAutonomyConfig(6 as AutonomyLevel)).toThrow('Invalid autonomy level');
  });

  it('getAutonomyConfig throws for negative level', () => {
    expect(() => getAutonomyConfig(-1 as AutonomyLevel)).toThrow('Invalid autonomy level');
  });

  it('getAutonomyOptions throws for invalid level', () => {
    expect(() => getAutonomyOptions(99 as AutonomyLevel)).toThrow('Invalid autonomy level');
  });

  it('error message includes valid levels', () => {
    expect(() => getAutonomyConfig(0 as AutonomyLevel)).toThrow('1, 2, 3, 4, 5');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Type Safety Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Type safety', () => {
  it('getAutonomyOptions returns correct shape', () => {
    const options = getAutonomyOptions(3);
    expect(options).toHaveProperty('ralph');
    expect(options).toHaveProperty('swarm');
    expect(typeof options.ralph).toBe('object');
    expect(typeof options.swarm).toBe('object');
  });

  it('AutonomyConfig has all required fields', () => {
    const config = getAutonomyConfig(1);
    const expectedKeys: (keyof AutonomyConfig)[] = ['level', 'name', 'description', 'ralph', 'swarm'];
    for (const key of expectedKeys) {
      expect(config).toHaveProperty(key);
    }
  });

  it('ralph options are Partial<RalphLoopOptions>', () => {
    const options = getAutonomyOptions(3);
    // Should not have undefined values for key properties
    expect(options.ralph.planApproval).toBeDefined();
    expect(options.ralph.autoTestFix).toBeDefined();
    expect(options.ralph.maxTestRetries).toBeDefined();
  });

  it('swarm options are Partial<SwarmOptions>', () => {
    const options = getAutonomyOptions(3);
    expect(options.swarm.maxConcurrency).toBeDefined();
    expect(options.swarm.timeoutPerAgent).toBeDefined();
    expect(options.swarm.continueOnFailure).toBeDefined();
  });
});
