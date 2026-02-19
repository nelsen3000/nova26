// Tests for Adaptive Agent Personality
// KIMI-FRONTIER-06

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getPersonalityEngine,
  resetPersonalityEngine,
  PersonalityEngine,
  type PersonalityDimensions,
  type PersonalityProfile,
} from './personality-engine.js';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('PersonalityEngine', () => {
  let tempDir: string;
  let profileDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), 'nova-personality-test-' + Date.now());
    profileDir = join(tempDir, 'personalities');
    mkdirSync(profileDir, { recursive: true });
    resetPersonalityEngine();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Default profiles', () => {
    it('getDefaultProfile() returns MARS profile', () => {
      const engine = new PersonalityEngine({ profileDir });
      const profile = engine.getDefaultProfile('MARS');

      expect(profile.agentName).toBe('MARS');
      expect(profile.dimensions.verbosity).toBeLessThan(5);
      expect(profile.dimensions.technicalDensity).toBeGreaterThan(7);
    });

    it('getDefaultProfile() returns VENUS profile', () => {
      const engine = new PersonalityEngine({ profileDir });
      const profile = engine.getDefaultProfile('VENUS');

      expect(profile.agentName).toBe('VENUS');
      expect(profile.dimensions.encouragement).toBeGreaterThan(7);
      expect(profile.dimensions.verbosity).toBeGreaterThan(5);
    });

    it('getDefaultProfile() returns JUPITER profile', () => {
      const engine = new PersonalityEngine({ profileDir });
      const profile = engine.getDefaultProfile('JUPITER');

      expect(profile.agentName).toBe('JUPITER');
      expect(profile.dimensions.explanationDepth).toBeGreaterThan(7);
      expect(profile.dimensions.formality).toBeGreaterThan(7);
    });

    it('getDefaultProfile() returns MERCURY profile', () => {
      const engine = new PersonalityEngine({ profileDir });
      const profile = engine.getDefaultProfile('MERCURY');

      expect(profile.agentName).toBe('MERCURY');
      expect(profile.dimensions.verbosity).toBeLessThan(5);
      expect(profile.dimensions.explanationDepth).toBeLessThan(5);
    });

    it('getDefaultProfile() returns SATURN profile', () => {
      const engine = new PersonalityEngine({ profileDir });
      const profile = engine.getDefaultProfile('SATURN');

      expect(profile.agentName).toBe('SATURN');
      expect(profile.dimensions.formality).toBeGreaterThan(7);
    });

    it('getDefaultProfile() returns PLUTO profile', () => {
      const engine = new PersonalityEngine({ profileDir });
      const profile = engine.getDefaultProfile('PLUTO');

      expect(profile.agentName).toBe('PLUTO');
      expect(profile.dimensions.verbosity).toBeGreaterThan(7);
    });

    it('getDefaultProfile() returns NEPTUNE profile', () => {
      const engine = new PersonalityEngine({ profileDir });
      const profile = engine.getDefaultProfile('NEPTUNE');

      expect(profile.agentName).toBe('NEPTUNE');
      expect(profile.dimensions.technicalDensity).toBeGreaterThan(7);
    });

    it('getDefaultProfile() returns URANUS profile', () => {
      const engine = new PersonalityEngine({ profileDir });
      const profile = engine.getDefaultProfile('URANUS');

      expect(profile.agentName).toBe('URANUS');
      expect(profile.dimensions.verbosity).toBeLessThan(5);
    });

    it('getDefaultProfile() returns EARTH profile', () => {
      const engine = new PersonalityEngine({ profileDir });
      const profile = engine.getDefaultProfile('EARTH');

      expect(profile.agentName).toBe('EARTH');
      expect(profile.dimensions.explanationDepth).toBeGreaterThan(7);
    });

    it('getDefaultProfile() returns balanced profile for unknown agent', () => {
      const engine = new PersonalityEngine({ profileDir });
      const profile = engine.getDefaultProfile('UNKNOWN' as any);

      // Falls back to balanced defaults
      expect(profile.dimensions.verbosity).toBe(5);
      expect(profile.dimensions.encouragement).toBe(5);
    });
  });

  describe('Signal processing', () => {
    it('applySignal() increases verbosity on MORE_DETAIL', async () => {
      const engine = new PersonalityEngine({ profileDir });
      
      const initial = engine.getDefaultProfile('MARS');
      const initialVerbosity = initial.dimensions.verbosity;

      const updated = await engine.applySignal('MARS', 'MORE_DETAIL');

      expect(updated.dimensions.verbosity).toBeGreaterThan(initialVerbosity);
      expect(updated.version).toBeGreaterThan(initial.version);
    });

    it('applySignal() decreases verbosity on LESS_DETAIL', async () => {
      const engine = new PersonalityEngine({ profileDir });
      
      const initial = engine.getDefaultProfile('VENUS');
      const initialVerbosity = initial.dimensions.verbosity;

      const updated = await engine.applySignal('VENUS', 'LESS_DETAIL');

      expect(updated.dimensions.verbosity).toBeLessThan(initialVerbosity);
    });

    it('applySignal() increases formality on USE_FORMAL', async () => {
      const engine = new PersonalityEngine({ profileDir });
      
      const initial = engine.getDefaultProfile('VENUS');
      const initialFormality = initial.dimensions.formality;

      const updated = await engine.applySignal('VENUS', 'USE_FORMAL');

      expect(updated.dimensions.formality).toBeGreaterThan(initialFormality);
    });

    it('applySignal() decreases formality on USE_CASUAL', async () => {
      const engine = new PersonalityEngine({ profileDir });
      
      const initial = engine.getDefaultProfile('SATURN');
      const initialFormality = initial.dimensions.formality;

      const updated = await engine.applySignal('SATURN', 'USE_CASUAL');

      expect(updated.dimensions.formality).toBeLessThan(initialFormality);
    });

    it('applySignal() increases technical density on MORE_TECHNICAL', async () => {
      const engine = new PersonalityEngine({ profileDir });
      
      const initial = engine.getDefaultProfile('VENUS');
      const initialDensity = initial.dimensions.technicalDensity;

      const updated = await engine.applySignal('VENUS', 'MORE_TECHNICAL');

      expect(updated.dimensions.technicalDensity).toBeGreaterThan(initialDensity);
    });

    it('applySignal() decreases technical density on LESS_TECHNICAL', async () => {
      const engine = new PersonalityEngine({ profileDir });
      
      const initial = engine.getDefaultProfile('MARS');
      const initialDensity = initial.dimensions.technicalDensity;

      const updated = await engine.applySignal('MARS', 'LESS_TECHNICAL');

      expect(updated.dimensions.technicalDensity).toBeLessThan(initialDensity);
    });

    it('applySignal() increases encouragement on SHOW_EMPATHY', async () => {
      const engine = new PersonalityEngine({ profileDir });
      
      const initial = engine.getDefaultProfile('MARS');
      const initialEncouragement = initial.dimensions.encouragement;

      const updated = await engine.applySignal('MARS', 'SHOW_EMPATHY');

      expect(updated.dimensions.encouragement).toBeGreaterThan(initialEncouragement);
    });

    it('applySignal() decreases encouragement on GET_TO_POINT', async () => {
      const engine = new PersonalityEngine({ profileDir });
      
      const initial = engine.getDefaultProfile('VENUS');
      const initialEncouragement = initial.dimensions.encouragement;

      const updated = await engine.applySignal('VENUS', 'GET_TO_POINT');

      expect(updated.dimensions.encouragement).toBeLessThan(initialEncouragement);
    });

    it('applySignal() resets to defaults on RESET', async () => {
      const engine = new PersonalityEngine({ profileDir });
      
      // First modify the profile
      await engine.applySignal('MARS', 'MORE_DETAIL');
      const modified = await engine.loadProfile('MARS');
      expect(modified.dimensions.verbosity).not.toBe(engine.getDefaultProfile('MARS').dimensions.verbosity);

      // Then reset
      const reset = await engine.applySignal('MARS', 'RESET');
      expect(reset.dimensions).toEqual(engine.getDefaultProfile('MARS').dimensions);
    });

    it('dimensions stay within valid range (1-10)', async () => {
      const engine = new PersonalityEngine({ profileDir });
      
      // Try to increase verbosity beyond max
      for (let i = 0; i < 20; i++) {
        await engine.applySignal('MARS', 'MORE_DETAIL');
      }

      const profile = await engine.loadProfile('MARS');
      expect(profile.dimensions.verbosity).toBeLessThanOrEqual(10);

      // Try to decrease verbosity below min
      for (let i = 0; i < 20; i++) {
        await engine.applySignal('MARS', 'LESS_DETAIL');
      }

      const profile2 = await engine.loadProfile('MARS');
      expect(profile2.dimensions.verbosity).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Profile persistence', () => {
    it('loadProfile() returns persisted profile if exists', async () => {
      const engine = new PersonalityEngine({ profileDir });

      // Modify profile
      await engine.applySignal('MARS', 'MORE_DETAIL');

      // Load should return modified version
      const loaded = await engine.loadProfile('MARS');
      expect(loaded.dimensions.verbosity).toBeGreaterThan(engine.getDefaultProfile('MARS').dimensions.verbosity);
    });

    it('loadProfile() returns default if no persisted profile', async () => {
      const engine = new PersonalityEngine({ profileDir });

      const loaded = await engine.loadProfile('MARS');
      expect(loaded.dimensions).toEqual(engine.getDefaultProfile('MARS').dimensions);
    });

    it('saveProfile() writes profile to disk', async () => {
      const engine = new PersonalityEngine({ profileDir });

      const defaultProfile = engine.getDefaultProfile('MARS');
      await engine.saveProfile(defaultProfile);

      const savedPath = join(profileDir, 'MARS.json');
      expect(existsSync(savedPath)).toBe(true);

      const saved = JSON.parse(readFileSync(savedPath, 'utf-8'));
      expect(saved.agentName).toBe('MARS');
    });
  });

  describe('Instruction building', () => {
    it('buildPersonalityInstructions() includes personality description', async () => {
      const engine = new PersonalityEngine({ profileDir });

      const instructions = await engine.buildPersonalityInstructions('MARS');
      
      expect(instructions).toContain('Communication Style');
      expect(instructions.length).toBeGreaterThan(0);
    });

    it('buildPersonalityInstructions() for low verbosity', async () => {
      const engine = new PersonalityEngine({ profileDir });

      const instructions = await engine.buildPersonalityInstructions('MARS');
      
      // MARS has low verbosity (3)
      expect(instructions).toContain('Terse');
    });

    it('buildPersonalityInstructions() for high verbosity', async () => {
      const engine = new PersonalityEngine({ profileDir });

      const instructions = await engine.buildPersonalityInstructions('JUPITER');
      
      // JUPITER has high verbosity (8)
      expect(instructions).toContain('Verbose');
    });

    it('buildPersonalityInstructions() for high formality', async () => {
      const engine = new PersonalityEngine({ profileDir });

      const instructions = await engine.buildPersonalityInstructions('SATURN');
      
      // SATURN has high formality (8)
      expect(instructions).toContain('Formal');
    });

    it('buildPersonalityInstructions() for high encouragement', async () => {
      const engine = new PersonalityEngine({ profileDir });

      const instructions = await engine.buildPersonalityInstructions('VENUS');
      
      // VENUS has high encouragement (9)
      expect(instructions).toContain('Encouraging');
    });
  });

  describe('Safety detection', () => {
    it('isSafetyContent() returns true for security-related text', () => {
      const engine = new PersonalityEngine({ profileDir });

      expect(engine.isSafetyContent('There is a security vulnerability in the code')).toBe(true);
      expect(engine.isSafetyContent('This has a potential security issue')).toBe(true);
      expect(engine.isSafetyContent('Found a security flaw')).toBe(true);
    });

    it('isSafetyContent() returns true for breaking change text', () => {
      const engine = new PersonalityEngine({ profileDir });

      expect(engine.isSafetyContent('This is a breaking change')).toBe(true);
    });

    it('isSafetyContent() returns true for deprecated API text', () => {
      const engine = new PersonalityEngine({ profileDir });

      expect(engine.isSafetyContent('This API is deprecated')).toBe(true);
    });

    it('isSafetyContent() returns false for normal content', () => {
      const engine = new PersonalityEngine({ profileDir });

      expect(engine.isSafetyContent('The code looks good')).toBe(false);
      expect(engine.isSafetyContent('All tests pass')).toBe(false);
    });

    it('isSafetyContent() is case insensitive', () => {
      const engine = new PersonalityEngine({ profileDir });

      expect(engine.isSafetyContent('SECURITY ISSUE')).toBe(true);
      expect(engine.isSafetyContent('breaking CHANGE')).toBe(true);
    });
  });

  describe('Message adaptation', () => {
    it('adaptMessage() preserves full detail for safety content', async () => {
      const engine = new PersonalityEngine({ profileDir });
      
      const message = 'CRITICAL: security vulnerability found in auth module';
      const adapted = await engine.adaptMessage('MARS', message);

      expect(adapted).toBe(message);
    });

    it('adaptMessage() shortens message for low verbosity', async () => {
      const engine = new PersonalityEngine({ profileDir });
      
      const longMessage = 'This is a very long message with lots of detail about the implementation. ' +
        'We should consider refactoring this code to improve maintainability and readability. ' +
        'Additionally, we could add more tests to ensure the code works correctly. ' +
        'The current implementation has some issues that need to be addressed.';

      const adapted = await engine.adaptMessage('MARS', longMessage);

      // MARS has low verbosity, so message should be shortened
      expect(adapted.length).toBeLessThan(longMessage.length);
    });
  });

  describe('Singleton', () => {
    it('getPersonalityEngine returns same instance', () => {
      const e1 = getPersonalityEngine();
      const e2 = getPersonalityEngine();
      expect(e1).toBe(e2);
    });

    it('resetPersonalityEngine creates new instance', () => {
      const e1 = getPersonalityEngine();
      resetPersonalityEngine();
      const e2 = getPersonalityEngine();
      expect(e1).not.toBe(e2);
    });
  });
});
