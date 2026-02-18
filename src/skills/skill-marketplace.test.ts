// Unit tests for skill-marketplace.ts
// Tests skill marketplace functionality

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';

// Mock fs module
vi.mock('fs', () => ({
  mkdirSync: vi.fn(),
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  readdirSync: vi.fn(),
}));

// Mock path
vi.mock('path', async () => {
  const actual = await vi.importActual('path');
  return {
    ...actual,
    join: vi.fn((...args: string[]) => args.join('/')),
  };
});

// Mock console
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('skill-marketplace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      version: '1.0.0',
      skills: [],
      categories: ['authentication', 'payments'],
    }));
  });

  afterEach(() => {
    consoleSpy.mockClear();
  });

  describe('initializeMarketplace', () => {
    it('should create registry file if not exists', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const { initializeMarketplace } = await import('./skill-marketplace.js');
      initializeMarketplace();
      
      expect(mkdirSync).toHaveBeenCalled();
      expect(writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('registry.json'),
        expect.stringContaining('1.0.0')
      );
    });

    it('should not create registry if already exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      const { initializeMarketplace } = await import('./skill-marketplace.js');
      initializeMarketplace();
      
      expect(writeFileSync).not.toHaveBeenCalledWith(
        expect.stringContaining('registry.json'),
        expect.any(String)
      );
    });
  });

  describe('searchSkills', () => {
    it('should return empty array when no skills match', async () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [],
        categories: [],
      }));
      
      const { searchSkills } = await import('./skill-marketplace.js');
      const results = searchSkills('react');
      
      expect(results).toEqual([]);
    });

    it('should filter skills by query string', async () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [
          { id: '1', name: 'React Patterns', description: 'React hooks', tags: ['react'], downloads: 10, rating: 4.5 },
          { id: '2', name: 'Vue Patterns', description: 'Vue composition', tags: ['vue'], downloads: 5, rating: 4.0 },
        ],
        categories: [],
      }));
      
      const { searchSkills } = await import('./skill-marketplace.js');
      const results = searchSkills('react');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('React Patterns');
    });

    it('should filter by domain', async () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [
          { id: '1', name: 'Auth', domain: 'authentication', downloads: 10, rating: 4.5 },
          { id: '2', name: 'Stripe', domain: 'payments', downloads: 5, rating: 4.0 },
        ],
        categories: [],
      }));
      
      const { searchSkills } = await import('./skill-marketplace.js');
      const results = searchSkills('', { domain: 'payments' });
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Stripe');
    });

    it('should filter by agent', async () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [
          { id: '1', name: 'Auth', agents: ['MARS'], downloads: 10, rating: 4.5 },
          { id: '2', name: 'UI', agents: ['VENUS'], downloads: 5, rating: 4.0 },
        ],
        categories: [],
      }));
      
      const { searchSkills } = await import('./skill-marketplace.js');
      const results = searchSkills('', { agent: 'VENUS' });
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('UI');
    });

    it('should filter by complexity', async () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [
          { id: '1', name: 'Basic', complexity: 'beginner', downloads: 10, rating: 4.5 },
          { id: '2', name: 'Advanced', complexity: 'advanced', downloads: 5, rating: 4.0 },
        ],
        categories: [],
      }));
      
      const { searchSkills } = await import('./skill-marketplace.js');
      const results = searchSkills('', { complexity: 'advanced' });
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Advanced');
    });

    it('should filter by tags', async () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [
          { id: '1', name: 'Auth', tags: ['security', 'auth'], downloads: 10, rating: 4.5 },
          { id: '2', name: 'Stripe', tags: ['payment'], downloads: 5, rating: 4.0 },
        ],
        categories: [],
      }));
      
      const { searchSkills } = await import('./skill-marketplace.js');
      const results = searchSkills('', { tags: ['security'] });
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Auth');
    });

    it('should sort by rating and downloads', async () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [
          { id: '1', name: 'Low', downloads: 1, rating: 1.0 },
          { id: '2', name: 'High', downloads: 100, rating: 5.0 },
          { id: '3', name: 'Medium', downloads: 10, rating: 3.0 },
        ],
        categories: [],
      }));
      
      const { searchSkills } = await import('./skill-marketplace.js');
      const results = searchSkills('');
      
      expect(results[0].name).toBe('High');
    });
  });

  describe('getSkill', () => {
    it('should return skill by id', async () => {
      const mockSkill = { id: 'skill-1', name: 'Test Skill' };
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [mockSkill],
        categories: [],
      }));
      
      const { getSkill } = await import('./skill-marketplace.js');
      const skill = getSkill('skill-1');
      
      expect(skill).toEqual(mockSkill);
    });

    it('should return null for non-existent skill', async () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [],
        categories: [],
      }));
      
      const { getSkill } = await import('./skill-marketplace.js');
      const skill = getSkill('non-existent');
      
      expect(skill).toBeNull();
    });
  });

  describe('submitSkill', () => {
    it('should add new skill to registry', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [],
        categories: [],
      }));
      
      const { submitSkill } = await import('./skill-marketplace.js');
      const skill = submitSkill({
        name: 'Test Skill',
        description: 'A test skill',
        domain: 'testing',
        tags: ['test'],
        agents: ['MARS'],
        complexity: 'beginner',
        content: 'Test content',
        examples: ['Example 1'],
      }, 'test-author');
      
      expect(skill.name).toBe('Test Skill');
      expect(skill.author).toBe('test-author');
      expect(skill.version).toBe('1.0.0');
      expect(skill.downloads).toBe(0);
      expect(skill.rating).toBe(0);
      expect(skill.id).toMatch(/^skill-/);
      expect(writeFileSync).toHaveBeenCalled();
    });
  });

  describe('downloadSkill', () => {
    it('should download skill to target directory', async () => {
      const mockSkill = {
        id: 'skill-1',
        name: 'Test Skill',
        description: 'Test',
        version: '1.0.0',
        author: 'test',
        domain: 'test',
        tags: ['test'],
        agents: ['MARS'],
        complexity: 'beginner' as const,
        content: 'content',
        examples: [],
        downloads: 0,
        rating: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [mockSkill],
        categories: [],
      }));
      vi.mocked(existsSync).mockReturnValue(false);
      
      const { downloadSkill } = await import('./skill-marketplace.js');
      const result = downloadSkill('skill-1', './skills');
      
      expect(result).toBe(true);
      expect(mkdirSync).toHaveBeenCalled();
      expect(writeFileSync).toHaveBeenCalled();
    });

    it('should return false for non-existent skill', async () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [],
        categories: [],
      }));
      
      const { downloadSkill } = await import('./skill-marketplace.js');
      const result = downloadSkill('non-existent');
      
      expect(result).toBe(false);
    });

    it('should increment download count', async () => {
      const mockSkill = {
        id: 'skill-1',
        name: 'Test Skill',
        downloads: 5,
        rating: 4.5,
      };
      
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [mockSkill],
        categories: [],
      }));
      vi.mocked(existsSync).mockReturnValue(false);
      
      const { downloadSkill } = await import('./skill-marketplace.js');
      downloadSkill('skill-1');
      
      // Registry should be updated with incremented download count
      expect(writeFileSync).toHaveBeenCalled();
    });
  });

  describe('rateSkill', () => {
    it('should update skill rating', async () => {
      const mockSkill = {
        id: 'skill-1',
        name: 'Test',
        downloads: 10,
        rating: 4.0,
      };
      
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [mockSkill],
        categories: [],
      }));
      
      const { rateSkill } = await import('./skill-marketplace.js');
      const result = rateSkill('skill-1', 5);
      
      expect(result).toBe(true);
      expect(writeFileSync).toHaveBeenCalled();
    });

    it('should return false for invalid rating', async () => {
      const { rateSkill } = await import('./skill-marketplace.js');
      
      expect(rateSkill('skill-1', 6)).toBe(false);
      expect(rateSkill('skill-1', 0)).toBe(false);
    });

    it('should return false for non-existent skill', async () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [],
        categories: [],
      }));
      
      const { rateSkill } = await import('./skill-marketplace.js');
      const result = rateSkill('non-existent', 4);
      
      expect(result).toBe(false);
    });
  });

  describe('listCategories', () => {
    it('should return all categories', async () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [],
        categories: ['auth', 'payment', 'ui'],
      }));
      
      const { listCategories } = await import('./skill-marketplace.js');
      const categories = listCategories();
      
      expect(categories).toEqual(['auth', 'payment', 'ui']);
    });
  });

  describe('getFeaturedSkills', () => {
    it('should return top skills by downloads', async () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [
          { id: '1', name: 'Popular', downloads: 100 },
          { id: '2', name: 'Medium', downloads: 50 },
          { id: '3', name: 'Unpopular', downloads: 10 },
        ],
        categories: [],
      }));
      
      const { getFeaturedSkills } = await import('./skill-marketplace.js');
      const skills = getFeaturedSkills(2);
      
      expect(skills).toHaveLength(2);
      expect(skills[0].name).toBe('Popular');
    });

    it('should respect limit parameter', async () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [
          { id: '1', name: '1', downloads: 100 },
          { id: '2', name: '2', downloads: 90 },
          { id: '3', name: '3', downloads: 80 },
          { id: '4', name: '4', downloads: 70 },
        ],
        categories: [],
      }));
      
      const { getFeaturedSkills } = await import('./skill-marketplace.js');
      const skills = getFeaturedSkills(3);
      
      expect(skills).toHaveLength(3);
    });
  });

  describe('getRecentSkills', () => {
    it('should return most recently added skills', async () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [
          { id: '1', name: 'Old', createdAt: '2024-01-01' },
          { id: '2', name: 'New', createdAt: '2024-12-01' },
          { id: '3', name: 'Middle', createdAt: '2024-06-01' },
        ],
        categories: [],
      }));
      
      const { getRecentSkills } = await import('./skill-marketplace.js');
      const skills = getRecentSkills(2);
      
      expect(skills).toHaveLength(2);
      expect(skills[0].name).toBe('New');
    });
  });

  describe('handleMarketplaceCommand', () => {
    beforeEach(() => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [
          { id: '1', name: 'React', description: 'React patterns', domain: 'frontend', downloads: 100, rating: 4.5 },
        ],
        categories: ['frontend'],
      }));
    });

    it('should show marketplace for no args', async () => {
      const { handleMarketplaceCommand } = await import('./skill-marketplace.js');
      handleMarketplaceCommand([]);
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Skill Marketplace'));
    });

    it('should search skills', async () => {
      const { handleMarketplaceCommand } = await import('./skill-marketplace.js');
      handleMarketplaceCommand(['search', 'react']);
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Search Results'));
    });

    it('should install skill', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const { handleMarketplaceCommand } = await import('./skill-marketplace.js');
      handleMarketplaceCommand(['install', '1']);
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Downloaded skill'));
    });

    it('should list all skills', async () => {
      const { handleMarketplaceCommand } = await import('./skill-marketplace.js');
      handleMarketplaceCommand(['list']);
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Available Skills'));
    });

    it('should show featured skills', async () => {
      const { handleMarketplaceCommand } = await import('./skill-marketplace.js');
      handleMarketplaceCommand(['featured']);
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Featured Skills'));
    });
  });

  describe('edge cases', () => {
    it('should handle corrupted registry file', async () => {
      vi.mocked(readFileSync).mockReturnValue('invalid json');
      
      const { searchSkills } = await import('./skill-marketplace.js');
      
      expect(() => searchSkills('test')).toThrow();
    });

    it('should handle skill with empty tags', async () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        version: '1.0.0',
        skills: [
          { id: '1', name: 'Empty', tags: [], downloads: 0, rating: 0 },
        ],
        categories: [],
      }));
      
      const { searchSkills } = await import('./skill-marketplace.js');
      const results = searchSkills('', { tags: ['nonexistent'] });
      
      expect(results).toHaveLength(0);
    });
  });
});
