import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateSystem } from './template-system.js';
import type {
  ProjectTemplate,
  ProjectType,
  TemplateRenderResult,
  TemplateVariable,
  TemplateFile,
} from './template-system.js';

describe('TemplateSystem', () => {
  let system: TemplateSystem;

  beforeEach(() => {
    system = new TemplateSystem();
  });

  // ── Constructor / built-in templates ──────────────────────────────────

  it('should register exactly 4 built-in templates', () => {
    const templates = system.listTemplates();
    expect(templates).toHaveLength(4);
  });

  it('should assign unique UUIDs to every template', () => {
    const ids = system.listTemplates().map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(4);
    for (const id of ids) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    }
  });

  it('should set version 1.0.0 for all templates', () => {
    for (const t of system.listTemplates()) {
      expect(t.version).toBe('1.0.0');
    }
  });

  it('should set ISO 8601 createdAt for all templates', () => {
    for (const t of system.listTemplates()) {
      expect(new Date(t.createdAt).toISOString()).toBe(t.createdAt);
    }
  });

  // ── react-app template ────────────────────────────────────────────────

  it('should have react-app template with correct deps', () => {
    const t = system.getTemplate('react-app');
    expect(t).toBeDefined();
    expect(t!.dependencies).toEqual(expect.arrayContaining(['react', 'react-dom']));
    expect(t!.devDependencies).toEqual(
      expect.arrayContaining([
        '@types/react',
        '@types/react-dom',
        'typescript',
        'vite',
        '@vitejs/plugin-react',
        'vitest',
      ]),
    );
  });

  it('should have react-app template with correct scripts', () => {
    const t = system.getTemplate('react-app')!;
    expect(t.scripts).toEqual({
      dev: 'vite',
      build: 'tsc && vite build',
      test: 'vitest run',
      preview: 'vite preview',
    });
  });

  it('should have react-app template with correct tags', () => {
    const t = system.getTemplate('react-app')!;
    expect(t.tags).toEqual(expect.arrayContaining(['frontend', 'react', 'vite', 'typescript']));
  });

  it('should have react-app template with at least 2 files including App.tsx and main.tsx', () => {
    const t = system.getTemplate('react-app')!;
    expect(t.files.length).toBeGreaterThanOrEqual(2);
    const paths = t.files.map((f) => f.path);
    expect(paths).toContain('src/App.tsx');
    expect(paths).toContain('src/main.tsx');
  });

  // ── api-server template ──────────────────────────────────────────────

  it('should have api-server template with correct deps and scripts', () => {
    const t = system.getTemplate('api-server')!;
    expect(t.dependencies).toEqual(expect.arrayContaining(['express', 'zod', 'cors']));
    expect(t.scripts.start).toBe('node dist/index.js');
    expect(t.tags).toEqual(expect.arrayContaining(['backend', 'express', 'api', 'typescript']));
  });

  // ── cli-tool template ────────────────────────────────────────────────

  it('should have cli-tool template with commander and chalk', () => {
    const t = system.getTemplate('cli-tool')!;
    expect(t.dependencies).toEqual(expect.arrayContaining(['commander', 'chalk']));
    expect(t.tags).toEqual(expect.arrayContaining(['cli', 'tool', 'typescript']));
  });

  // ── library template ─────────────────────────────────────────────────

  it('should have library template with empty deps and tsup', () => {
    const t = system.getTemplate('library')!;
    expect(t.dependencies).toEqual([]);
    expect(t.devDependencies).toEqual(expect.arrayContaining(['typescript', 'vitest', 'tsup']));
    expect(t.scripts.prepublishOnly).toBe('npm run build');
  });

  // ── listTemplates ────────────────────────────────────────────────────

  it('should return all templates from listTemplates', () => {
    const templates = system.listTemplates();
    const types = templates.map((t) => t.projectType);
    expect(types).toEqual(
      expect.arrayContaining(['react-app', 'api-server', 'cli-tool', 'library']),
    );
  });

  // ── getTemplate ──────────────────────────────────────────────────────

  it('should return undefined for unknown project type', () => {
    const result = system.getTemplate('nonexistent' as ProjectType);
    expect(result).toBeUndefined();
  });

  // ── getTemplateVariables ─────────────────────────────────────────────

  it('should return variables for api-server including projectName and author', () => {
    const vars = system.getTemplateVariables('api-server');
    const names = vars.map((v) => v.name);
    expect(names).toContain('projectName');
    expect(names).toContain('author');
  });

  it('should return empty array for unknown project type', () => {
    const vars = system.getTemplateVariables('nonexistent' as ProjectType);
    expect(vars).toEqual([]);
  });

  // ── validateVariables ────────────────────────────────────────────────

  it('should validate successfully with all required variables', () => {
    const result = system.validateVariables('react-app', { projectName: 'my-app' });
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('should fail validation when required variable is missing', () => {
    const result = system.validateVariables('react-app', {});
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('projectName');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  // ── renderTemplate ───────────────────────────────────────────────────

  it('should render react-app template replacing {{projectName}}', () => {
    const result = system.renderTemplate('react-app', { projectName: 'cool-app' });
    expect(result).not.toBeNull();
    for (const file of result!.files) {
      expect(file.content).not.toContain('{{projectName}}');
      expect(file.content).toContain('cool-app');
    }
  });

  it('should return null when rendering unknown type', () => {
    const result = system.renderTemplate('nonexistent' as ProjectType, { projectName: 'x' });
    expect(result).toBeNull();
  });

  it('should return null when required variable is missing', () => {
    const result = system.renderTemplate('react-app', {});
    expect(result).toBeNull();
  });

  it('should include packageJson in render result', () => {
    const result = system.renderTemplate('react-app', { projectName: 'pkg-test' })!;
    expect(result.packageJson.name).toBe('pkg-test');
    expect(result.packageJson.version).toBe('1.0.0');
    expect(Object.keys(result.packageJson.scripts).length).toBeGreaterThanOrEqual(2);
  });

  it('should set renderedAt as ISO 8601 timestamp', () => {
    const result = system.renderTemplate('react-app', { projectName: 'ts-test' })!;
    expect(new Date(result.renderedAt).toISOString()).toBe(result.renderedAt);
  });

  // ── createProjectFromTemplate ────────────────────────────────────────

  it('should create a project with unique UUID', () => {
    const p = system.createProjectFromTemplate('react-app', { projectName: 'proj1' });
    expect(p).not.toBeNull();
    expect(p!.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(p!.projectType).toBe('react-app');
    expect(new Date(p!.createdAt).toISOString()).toBe(p!.createdAt);
  });

  it('should return null from createProjectFromTemplate for missing vars', () => {
    const p = system.createProjectFromTemplate('react-app', {});
    expect(p).toBeNull();
  });
});
