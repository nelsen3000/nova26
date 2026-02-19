// Tests for Predictive Task Decomposition
// KIMI-FRONTIER-06

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getPredictiveDecomposer,
  resetPredictiveDecomposer,
  PredictiveDecomposer,
  type TaskTemplate,
  type BuildRecord,
} from './predictive-decomposer.js';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('PredictiveDecomposer', () => {
  let tempDir: string;
  let templateDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), 'nova-decomposer-test-' + Date.now());
    templateDir = join(tempDir, 'templates');
    mkdirSync(templateDir, { recursive: true });
    resetPredictiveDecomposer();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Template management', () => {
    it('loadTemplates() loads templates from storage', async () => {
      const template: TaskTemplate = {
        id: 'test-template',
        name: 'Test Template',
        projectType: 'general',
        description: 'A test template',
        tasks: [
          { order: 1, agentName: 'MARS', taskType: 'code', title: 'Step 1', estimatedComplexity: 'medium', dependsOnOrders: [] },
          { order: 2, agentName: 'VENUS', taskType: 'code', title: 'Step 2', estimatedComplexity: 'medium', dependsOnOrders: [1] },
        ],
        successCount: 5,
        avgTokensUsed: 1000,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        embedding: Array(768).fill(0.1),
      };

      writeFileSync(join(templateDir, `${template.id}.json`), JSON.stringify(template, null, 2));

      const decomposer = new PredictiveDecomposer({ templateDir });
      await decomposer.loadTemplates();

      expect(decomposer.getStats().templateCount).toBe(1);
    });

    it('saveTemplate() writes template to storage', async () => {
      const decomposer = new PredictiveDecomposer({ templateDir });

      const template: TaskTemplate = {
        id: 'new-template',
        name: 'New Template',
        projectType: 'cli-tool',
        description: 'A new template',
        tasks: [{ order: 1, agentName: 'MERCURY', taskType: 'code', title: 'Setup', estimatedComplexity: 'low', dependsOnOrders: [] }],
        successCount: 0,
        avgTokensUsed: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      };

      await decomposer.saveTemplate(template);

      const savedPath = join(templateDir, `${template.id}.json`);
      expect(existsSync(savedPath)).toBe(true);

      const saved = JSON.parse(readFileSync(savedPath, 'utf-8'));
      expect(saved.name).toBe('New Template');
    });

    it('listTemplates() returns all stored templates', async () => {
      const decomposer = new PredictiveDecomposer({ templateDir });

      const template1: TaskTemplate = {
        id: 'template-1',
        name: 'Template 1',
        projectType: 'general',
        description: 'First template',
        tasks: [],
        successCount: 0,
        avgTokensUsed: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      };

      const template2: TaskTemplate = {
        id: 'template-2',
        name: 'Template 2',
        projectType: 'react-spa',
        description: 'Second template',
        tasks: [],
        successCount: 0,
        avgTokensUsed: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      };

      await decomposer.saveTemplate(template1);
      await decomposer.saveTemplate(template2);
      await decomposer.loadTemplates();

      const templates = decomposer.listTemplates();
      expect(templates.length).toBe(2);
      expect(templates.map(t => t.id)).toContain('template-1');
      expect(templates.map(t => t.id)).toContain('template-2');
    });

    it('listTemplates() filters by project type', async () => {
      const decomposer = new PredictiveDecomposer({ templateDir });

      const generalTemplate: TaskTemplate = {
        id: 'general-template',
        name: 'General',
        projectType: 'general',
        description: 'General template',
        tasks: [],
        successCount: 0,
        avgTokensUsed: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      };

      const reactTemplate: TaskTemplate = {
        id: 'react-template',
        name: 'React',
        projectType: 'react-spa',
        description: 'React template',
        tasks: [],
        successCount: 0,
        avgTokensUsed: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      };

      await decomposer.saveTemplate(generalTemplate);
      await decomposer.saveTemplate(reactTemplate);
      await decomposer.loadTemplates();

      const reactTemplates = decomposer.listTemplates('react-spa');
      expect(reactTemplates.length).toBe(1);
      expect(reactTemplates[0].projectType).toBe('react-spa');
    });
  });

  describe('Decomposition prediction', () => {
    it('predictDecomposition() returns null when no templates exist', async () => {
      const decomposer = new PredictiveDecomposer({ templateDir });
      await decomposer.loadTemplates();

      const result = await decomposer.predictDecomposition('create a todo app');
      expect(result).toBeNull();
    });

    it('predictDecomposition() returns null when embedding service unavailable', async () => {
      const decomposer = new PredictiveDecomposer({
        templateDir,
      });

      const template: TaskTemplate = {
        id: 'react-app',
        name: 'React App',
        projectType: 'react-spa',
        description: 'Create a React application with TypeScript',
        tasks: [
          { order: 1, agentName: 'MERCURY', taskType: 'setup', title: 'Initialize project', estimatedComplexity: 'medium', dependsOnOrders: [] },
          { order: 2, agentName: 'MERCURY', taskType: 'setup', title: 'Setup React', estimatedComplexity: 'medium', dependsOnOrders: [1] },
          { order: 3, agentName: 'VENUS', taskType: 'code', title: 'Create components', estimatedComplexity: 'high', dependsOnOrders: [2] },
        ],
        successCount: 10,
        avgTokensUsed: 5000,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      };

      await decomposer.saveTemplate(template);
      await decomposer.loadTemplates();

      // Without an embedding service, predictDecomposition returns null
      const result = await decomposer.predictDecomposition('build a React todo app');

      expect(result).toBeNull();
    });

    it('predictDecomposition() returns null when no template matches', async () => {
      const decomposer = new PredictiveDecomposer({
        templateDir,
      });

      // Add a template that won't have an embedding
      const template: TaskTemplate = {
        id: 'cli-tool',
        name: 'CLI Tool',
        projectType: 'cli-tool',
        description: 'Create a CLI tool',
        tasks: [],
        successCount: 5,
        avgTokensUsed: 2000,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      };

      await decomposer.saveTemplate(template);
      await decomposer.loadTemplates();

      // Without embeddings on templates, predictDecomposition returns null
      const result = await decomposer.predictDecomposition('build a web application with React');

      expect(result).toBeNull();
    });
  });

  describe('Learning from builds', () => {
    it('learnFromBuild() creates a new template on success when no match', async () => {
      const decomposer = new PredictiveDecomposer({ templateDir });
      await decomposer.loadTemplates();

      const record: BuildRecord = {
        buildId: 'build-1',
        intent: 'Create a CLI tool',
        tasks: [{ order: 1, agentName: 'MERCURY', taskType: 'code', title: 'Setup', estimatedComplexity: 'low', dependsOnOrders: [] }],
        successful: true,
        tokensUsed: 2500,
        completedAt: new Date().toISOString(),
      };

      await decomposer.learnFromBuild(record);

      // learnFromBuild creates a new template since no existing template matched
      const stats = decomposer.getStats();
      expect(stats.templateCount).toBe(1);
      expect(stats.totalSuccessfulBuilds).toBe(1);
    });

    it('learnFromBuild() skips learning on failure', async () => {
      const decomposer = new PredictiveDecomposer({ templateDir });
      await decomposer.loadTemplates();

      const record: BuildRecord = {
        buildId: 'build-2',
        intent: 'Create a CLI tool',
        tasks: [{ order: 1, agentName: 'MERCURY', taskType: 'code', title: 'Setup', estimatedComplexity: 'low', dependsOnOrders: [] }],
        successful: false,
        tokensUsed: 3000,
        completedAt: new Date().toISOString(),
      };

      await decomposer.learnFromBuild(record);

      // Source only learns from successful builds, so no template created
      const stats = decomposer.getStats();
      expect(stats.templateCount).toBe(0);
    });

    it('extractTemplate() creates a new template from a build record', async () => {
      const decomposer = new PredictiveDecomposer({ templateDir });

      const record: BuildRecord = {
        buildId: 'build-3',
        intent: 'Create a Node.js REST API',
        tasks: [
          { order: 1, agentName: 'MERCURY', taskType: 'setup', title: 'Initialize project', estimatedComplexity: 'medium', dependsOnOrders: [] },
          { order: 2, agentName: 'MERCURY', taskType: 'setup', title: 'Setup Express', estimatedComplexity: 'medium', dependsOnOrders: [1] },
          { order: 3, agentName: 'MARS', taskType: 'code', title: 'Create routes', estimatedComplexity: 'high', dependsOnOrders: [2] },
        ],
        successful: true,
        tokensUsed: 4000,
        completedAt: new Date().toISOString(),
      };

      const template = await decomposer.extractTemplate(record);

      expect(template.projectType).toBe('general');
      expect(template.tasks.length).toBe(3);
      expect(template.successCount).toBe(1);
      expect(template.avgTokensUsed).toBe(4000);
    });
  });

  describe('Project type detection', () => {
    it('detectProjectType() detects nextjs-saas', async () => {
      const decomposer = new PredictiveDecomposer({ templateDir });

      const type = await decomposer.detectProjectType('Build a Next.js SaaS with authentication');
      expect(type).toBe('nextjs-saas');
    });

    it('detectProjectType() detects react-spa', async () => {
      const decomposer = new PredictiveDecomposer({ templateDir });

      const type = await decomposer.detectProjectType('Create a React single page app');
      expect(type).toBe('react-spa');
    });

    it('detectProjectType() detects node-api', async () => {
      const decomposer = new PredictiveDecomposer({ templateDir });

      const type = await decomposer.detectProjectType('Build a Node.js REST API');
      expect(type).toBe('node-api');
    });

    it('detectProjectType() detects cli-tool', async () => {
      const decomposer = new PredictiveDecomposer({ templateDir });

      const type = await decomposer.detectProjectType('Create a CLI utility');
      expect(type).toBe('cli-tool');
    });

    it('detectProjectType() defaults to general', async () => {
      const decomposer = new PredictiveDecomposer({ templateDir });

      const type = await decomposer.detectProjectType('Do something generic');
      expect(type).toBe('general');
    });
  });

  describe('Statistics', () => {
    it('getStats() returns template and build counts', async () => {
      const decomposer = new PredictiveDecomposer({ templateDir });

      const template: TaskTemplate = {
        id: 'test',
        name: 'Test',
        projectType: 'general',
        description: 'Test template',
        tasks: [],
        successCount: 5,
        avgTokensUsed: 1000,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      };

      await decomposer.saveTemplate(template);
      await decomposer.loadTemplates();

      const stats = decomposer.getStats();
      expect(stats.templateCount).toBe(1);
      expect(stats.totalSuccessfulBuilds).toBe(5);
    });
  });

  describe('Singleton', () => {
    it('getPredictiveDecomposer returns same instance', () => {
      const d1 = getPredictiveDecomposer();
      const d2 = getPredictiveDecomposer();
      expect(d1).toBe(d2);
    });

    it('resetPredictiveDecomposer creates new instance', () => {
      const d1 = getPredictiveDecomposer();
      resetPredictiveDecomposer();
      const d2 = getPredictiveDecomposer();
      expect(d1).not.toBe(d2);
    });
  });
});
