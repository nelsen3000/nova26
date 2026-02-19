// Tests for SkillRegistry — Skill registration and lookup
// KIMI-INTEGRATE-06

import { describe, it, expect, beforeEach } from 'vitest';
import { getSkillRegistry, resetSkillRegistry, builtinSkills } from './skill-registry.js';

describe('SkillRegistry', () => {
  beforeEach(() => {
    resetSkillRegistry();
  });

  describe('Registration', () => {
    it('register() adds a skill to the registry', () => {
      const registry = getSkillRegistry();
      const skill = {
        name: 'test-skill',
        description: 'A test skill',
        agents: [],
        steps: [],
        requiredTools: [],
        version: '1.0.0',
      };

      registry.register(skill);
      expect(registry.has('test-skill')).toBe(true);
    });

    it('register() overwrites an existing skill with the same name', () => {
      const registry = getSkillRegistry();
      const skill1 = {
        name: 'test-skill',
        description: 'Original description',
        agents: [],
        steps: [],
        requiredTools: [],
        version: '1.0.0',
      };
      const skill2 = {
        name: 'test-skill',
        description: 'Updated description',
        agents: ['MARS'],
        steps: [],
        requiredTools: [],
        version: '2.0.0',
      };

      registry.register(skill1);
      registry.register(skill2);

      const retrieved = registry.get('test-skill');
      expect(retrieved?.description).toBe('Updated description');
      expect(retrieved?.version).toBe('2.0.0');
    });

    it('get() returns null for an unknown skill name', () => {
      const registry = getSkillRegistry();
      const result = registry.get('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('Agent filtering', () => {
    it('listForAgent(MARS) returns skills where agents is empty OR contains MARS', () => {
      const registry = getSkillRegistry();
      const skillAll = {
        name: 'skill-all',
        description: 'Available to all',
        agents: [],
        steps: [],
        requiredTools: [],
        version: '1.0.0',
      };
      const skillMars = {
        name: 'skill-mars',
        description: 'MARS only',
        agents: ['MARS'],
        steps: [],
        requiredTools: [],
        version: '1.0.0',
      };

      registry.register(skillAll);
      registry.register(skillMars);

      const marsSkills = registry.listForAgent('MARS');
      const names = marsSkills.map(s => s.name);

      expect(names).toContain('skill-all');
      expect(names).toContain('skill-mars');
    });

    it('listForAgent(SATURN) does not return skills restricted to [MARS]', () => {
      const registry = getSkillRegistry();
      const skillMars = {
        name: 'skill-mars',
        description: 'MARS only',
        agents: ['MARS'],
        steps: [],
        requiredTools: [],
        version: '1.0.0',
      };

      registry.register(skillMars);

      const saturnSkills = registry.listForAgent('SATURN');
      const names = saturnSkills.map(s => s.name);

      expect(names).not.toContain('skill-mars');
    });
  });

  describe('Listing', () => {
    it('listAll() returns all registered skills sorted alphabetically by name', () => {
      const registry = getSkillRegistry();
      const skillB = {
        name: 'zebra-skill',
        description: 'Zebra skill',
        agents: [],
        steps: [],
        requiredTools: [],
        version: '1.0.0',
      };
      const skillA = {
        name: 'alpha-skill',
        description: 'Alpha skill',
        agents: [],
        steps: [],
        requiredTools: [],
        version: '1.0.0',
      };

      registry.register(skillB);
      registry.register(skillA);

      const allSkills = registry.listAll();
      const names = allSkills.map(s => s.name);
      
      // Built-in skills are auto-registered, so we check relative ordering
      const alphaIndex = names.indexOf('alpha-skill');
      const zebraIndex = names.indexOf('zebra-skill');
      expect(alphaIndex).toBeLessThan(zebraIndex);
    });
  });

  describe('Unregistration', () => {
    it('unregister() returns true and removes the skill when it exists', () => {
      const registry = getSkillRegistry();
      const skill = {
        name: 'test-skill',
        description: 'A test skill',
        agents: [],
        steps: [],
        requiredTools: [],
        version: '1.0.0',
      };

      registry.register(skill);
      const result = registry.unregister('test-skill');

      expect(result).toBe(true);
      expect(registry.has('test-skill')).toBe(false);
    });

    it('unregister() returns false when the skill does not exist', () => {
      const registry = getSkillRegistry();
      const result = registry.unregister('nonexistent');
      expect(result).toBe(false);
    });

    it('has() returns true for a registered skill, false for an unknown name', () => {
      const registry = getSkillRegistry();
      const skill = {
        name: 'test-skill',
        description: 'A test skill',
        agents: [],
        steps: [],
        requiredTools: [],
        version: '1.0.0',
      };

      registry.register(skill);

      expect(registry.has('test-skill')).toBe(true);
      expect(registry.has('nonexistent')).toBe(false);
    });
  });

  describe('Built-in skills', () => {
    it('built-in skills are automatically registered on first getSkillRegistry() call', () => {
      const registry = getSkillRegistry();
      const allSkills = registry.listAll();

      expect(registry.has('debug-root-cause')).toBe(true);
      expect(registry.has('refactor-safely')).toBe(true);
      expect(registry.has('generate-tests')).toBe(true);
    });

    it('verify debug-root-cause skill has correct structure', () => {
      const registry = getSkillRegistry();
      const skill = registry.get('debug-root-cause');

      expect(skill).toBeDefined();
      expect(skill?.agents).toEqual([]);
      expect(skill?.requiredTools).toContain('readFile');
      expect(skill?.requiredTools).toContain('searchCode');
      expect(skill?.steps.length).toBe(3);
    });

    it('verify refactor-safely skill is restricted to correct agents', () => {
      const registry = getSkillRegistry();
      const skill = registry.get('refactor-safely');

      expect(skill?.agents).toContain('MARS');
      expect(skill?.agents).toContain('EARTH');
      expect(skill?.agents).toContain('SATURN');
    });

    it('verify generate-tests skill is restricted to SATURN', () => {
      const registry = getSkillRegistry();
      const skill = registry.get('generate-tests');

      expect(skill?.agents).toEqual(['SATURN']);
    });
  });

  describe('clear()', () => {
    it('clear() removes all registered skills', () => {
      const registry = getSkillRegistry();
      const skill = {
        name: 'test-skill',
        description: 'A test skill',
        agents: [],
        steps: [],
        requiredTools: [],
        version: '1.0.0',
      };

      registry.register(skill);
      registry.clear();

      expect(registry.has('test-skill')).toBe(false);
      expect(registry.listAll().length).toBe(0);
    });
  });
});
