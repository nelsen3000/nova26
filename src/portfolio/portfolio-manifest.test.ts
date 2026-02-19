// Tests for Portfolio Manifest & Project Fingerprinting
// KIMI-PORTFOLIO-01

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PortfolioManifest, type PortfolioProject } from './portfolio-manifest.js';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('PortfolioManifest', () => {
  let tempDir: string;
  let manifestPath: string;
  let manifest: PortfolioManifest;

  beforeEach(() => {
    tempDir = join(tmpdir(), 'nova-portfolio-test-' + Date.now());
    mkdirSync(tempDir, { recursive: true });
    manifestPath = join(tempDir, 'portfolio.json');
    manifest = new PortfolioManifest({ manifestPath });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('load', () => {
    it('creates empty portfolio when manifest does not exist', () => {
      const portfolio = manifest.load();

      expect(portfolio).toBeDefined();
      expect(portfolio.version).toBe('1.0.0');
      expect(portfolio.userId).toBeDefined();
      expect(portfolio.projects).toEqual([]);
      expect(portfolio.portfolioPatterns).toEqual([]);
      expect(portfolio.skillGrowthHistory).toEqual([]);
    });

    it('validates manifest JSON on load', () => {
      // Write invalid JSON
      writeFileSync(manifestPath, '{ invalid json }');

      const portfolio = manifest.load();

      // Should return empty portfolio, not crash
      expect(portfolio.projects).toEqual([]);
    });
  });

  describe('save', () => {
    it('saves and loads portfolio round-trip', () => {
      const portfolio = manifest.load();
      portfolio.projects.push({
        id: 'test-id',
        name: 'Test Project',
        path: '/test/path',
        type: 'dashboard',
        primaryLanguage: 'TypeScript',
        firstBuildAt: new Date().toISOString(),
        lastBuildAt: new Date().toISOString(),
        totalBuilds: 5,
        aceScoreHistory: [{ date: new Date().toISOString(), score: 85 }],
        patternCount: 3,
        semanticFingerprint: [0.1, 0.2, 0.3],
        isPrivate: false,
        isArchived: false,
        tags: ['test'],
      } as PortfolioProject);

      manifest.save(portfolio);

      const loaded = manifest.load();
      expect(loaded.projects.length).toBe(1);
      expect(loaded.projects[0].name).toBe('Test Project');
    });

    it('creates parent directories on save', () => {
      const nestedPath = join(tempDir, 'deep', 'nested', 'portfolio.json');
      const nestedManifest = new PortfolioManifest({ manifestPath: nestedPath });
      const portfolio = nestedManifest.load();

      nestedManifest.save(portfolio);

      expect(existsSync(nestedPath)).toBe(true);
    });

    it('updates updatedAt timestamp on save', () => {
      const portfolio = manifest.load();
      const beforeSave = portfolio.updatedAt;

      // Small delay
      const start = Date.now();
      while (Date.now() - start < 10) {} // busy wait

      manifest.save(portfolio);
      const afterSave = manifest.load().updatedAt;

      expect(new Date(afterSave).getTime()).toBeGreaterThanOrEqual(new Date(beforeSave).getTime());
    });
  });

  describe('addProject', () => {
    it('adds a project', () => {
      const project = manifest.addProject({
        name: 'My Dashboard',
        path: '/projects/dashboard',
        type: 'dashboard',
        primaryLanguage: 'TypeScript',
        framework: 'React',
        isPrivate: false,
      });

      expect(project).toBeDefined();
      expect(project.id).toBeDefined();
      expect(project.name).toBe('My Dashboard');
      expect(project.totalBuilds).toBe(0);
      expect(project.aceScoreHistory).toEqual([]);
      expect(project.isArchived).toBe(false);
      expect(project.tags).toEqual([]);
      expect(project.semanticFingerprint).toEqual([]);
    });

    it('auto-saves after addProject', () => {
      manifest.addProject({
        name: 'Test Project',
        path: '/test',
        type: 'api',
        primaryLanguage: 'Python',
        isPrivate: false,
      });

      // Create new manifest instance pointing to same file
      const newManifest = new PortfolioManifest({ manifestPath });
      const portfolio = newManifest.load();

      expect(portfolio.projects.length).toBe(1);
      expect(portfolio.projects[0].name).toBe('Test Project');
    });
  });

  describe('updateProjectAfterBuild', () => {
    it('updates project after build', () => {
      const project = manifest.addProject({
        name: 'Test Project',
        path: '/test',
        type: 'cli',
        primaryLanguage: 'Go',
        isPrivate: false,
      });

      const updated = manifest.updateProjectAfterBuild(project.id, 85, 5);

      expect(updated.totalBuilds).toBe(1);
      expect(updated.aceScoreHistory.length).toBe(1);
      expect(updated.aceScoreHistory[0].score).toBe(85);
      expect(updated.patternCount).toBe(5);
    });

    it('throws when updating non-existent project', () => {
      expect(() => {
        manifest.updateProjectAfterBuild('non-existent-id', 80, 3);
      }).toThrow('Project not found');
    });

    it('handles multiple ACE score entries', () => {
      const project = manifest.addProject({
        name: 'Test Project',
        path: '/test',
        type: 'library',
        primaryLanguage: 'Rust',
        isPrivate: false,
      });

      // Update 5 times with different scores
      manifest.updateProjectAfterBuild(project.id, 70, 2);
      manifest.updateProjectAfterBuild(project.id, 75, 3);
      manifest.updateProjectAfterBuild(project.id, 80, 4);
      manifest.updateProjectAfterBuild(project.id, 85, 5);
      manifest.updateProjectAfterBuild(project.id, 90, 6);

      const updated = manifest.getProject(project.id)!;
      expect(updated.aceScoreHistory.length).toBe(5);
      expect(updated.aceScoreHistory.map(h => h.score)).toEqual([70, 75, 80, 85, 90]);
    });
  });

  describe('computeFingerprint', () => {
    it('computes fingerprint via Ollama embedding', async () => {
      const project = manifest.addProject({
        name: 'Test Project',
        path: '/test',
        type: 'full-stack',
        primaryLanguage: 'TypeScript',
        isPrivate: false,
      });

      const updated = await manifest.computeFingerprint(project.id, 'A React dashboard with TypeScript');

      expect(updated.semanticFingerprint.length).toBeGreaterThan(0);
      expect(updated.semanticFingerprint.length).toBe(768); // Common embedding size
    });

    it('throws when computing fingerprint for non-existent project', async () => {
      await expect(
        manifest.computeFingerprint('non-existent', 'summary')
      ).rejects.toThrow('Project not found');
    });

    it('generates deterministic fingerprints for same summary', async () => {
      const project1 = manifest.addProject({
        name: 'Project 1',
        path: '/test1',
        type: 'api',
        primaryLanguage: 'Python',
        isPrivate: false,
      });

      const project2 = manifest.addProject({
        name: 'Project 2',
        path: '/test2',
        type: 'api',
        primaryLanguage: 'Python',
        isPrivate: false,
      });

      const updated1 = await manifest.computeFingerprint(project1.id, 'Same summary text');
      const updated2 = await manifest.computeFingerprint(project2.id, 'Same summary text');

      // Fingerprints should be identical for same summary
      expect(updated1.semanticFingerprint).toEqual(updated2.semanticFingerprint);
    });
  });

  describe('getProject', () => {
    it('gets project by ID', () => {
      const added = manifest.addProject({
        name: 'Test Project',
        path: '/test',
        type: 'mobile',
        primaryLanguage: 'Swift',
        isPrivate: false,
      });

      const retrieved = manifest.getProject(added.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(added.id);
      expect(retrieved?.name).toBe('Test Project');
    });

    it('returns undefined for non-existent project', () => {
      const retrieved = manifest.getProject('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('listProjects', () => {
    let archivedProjectId: string;

    beforeEach(() => {
      manifest.addProject({ name: 'Active Project', path: '/active', type: 'dashboard', primaryLanguage: 'TS', isPrivate: false });
      manifest.addProject({ name: 'Private Project', path: '/private', type: 'api', primaryLanguage: 'Python', isPrivate: true });
      const archived = manifest.addProject({ name: 'Archived Project', path: '/archived', type: 'cli', primaryLanguage: 'Go', isPrivate: false });
      archivedProjectId = archived.id;
    });

    it('lists all non-archived projects by default', () => {
      // First archive one project
      manifest.archiveProject(archivedProjectId);

      const projects = manifest.listProjects();
      expect(projects.length).toBe(2); // Active and Private
      expect(projects.map(p => p.name)).toContain('Active Project');
      expect(projects.map(p => p.name)).toContain('Private Project');
      expect(projects.map(p => p.name)).not.toContain('Archived Project');
    });

    it('filters projects by type', () => {
      const dashboardProjects = manifest.listProjects({ type: 'dashboard' });
      expect(dashboardProjects.length).toBe(1);
      expect(dashboardProjects[0].name).toBe('Active Project');
    });

    it('filters projects by privacy', () => {
      const privateProjects = manifest.listProjects({ private: true });
      expect(privateProjects.length).toBe(1);
      expect(privateProjects[0].name).toBe('Private Project');
    });

    it('includes archived projects when archived filter is true', () => {
      // First archive a project
      const toArchive = manifest.listProjects().find(p => p.name === 'Active Project')!;
      manifest.archiveProject(toArchive.id);

      const archivedOnly = manifest.listProjects({ archived: true });
      expect(archivedOnly.length).toBe(1);
      expect(archivedOnly[0].name).toBe('Active Project');
    });
  });

  describe('archiveProject', () => {
    it('archives a project', () => {
      const project = manifest.addProject({
        name: 'To Archive',
        path: '/archive',
        type: 'library',
        primaryLanguage: 'Rust',
        isPrivate: false,
      });

      const archived = manifest.archiveProject(project.id);

      expect(archived.isArchived).toBe(true);
      expect(manifest.getProject(project.id)?.isArchived).toBe(true);
    });
  });

  describe('setProjectPrivacy', () => {
    it('sets project privacy', () => {
      const project = manifest.addProject({
        name: 'To Make Private',
        path: '/private',
        type: 'other',
        primaryLanguage: 'C++',
        isPrivate: false,
      });

      const updated = manifest.setProjectPrivacy(project.id, true);

      expect(updated.isPrivate).toBe(true);
      expect(manifest.getProject(project.id)?.isPrivate).toBe(true);
    });
  });

  describe('getRecencyWeight', () => {
    it('computes recency weight for recent project', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const weight = manifest.getRecencyWeight(yesterday.toISOString());
      expect(weight).toBe(1.0);
    });

    it('computes recency weight for 6-month-old project', () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const weight = manifest.getRecencyWeight(sixMonthsAgo.toISOString());
      expect(weight).toBe(0.8);
    });

    it('computes recency weight for 2-year-old project', () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      const weight = manifest.getRecencyWeight(twoYearsAgo.toISOString());
      expect(weight).toBe(0.6);
    });
  });
});
