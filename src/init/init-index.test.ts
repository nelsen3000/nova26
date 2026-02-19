import { describe, it, expect } from 'vitest';
import {
  TemplateSystem,
  FrameworkDetector,
  DependencyRecommender,
  ConfigWizard,
} from './init-index.js';
import type {
  ProjectType,
  ProjectTemplate,
  TemplateFile,
  TemplateVariable,
  TemplateRenderResult,
  FrameworkCategory,
  DetectedFramework,
  FrameworkSignature,
  ProjectProfile,
  RecommendationPriority,
  DependencyRecommendation,
  RecommendationRule,
  RecommendationReport,
  StepType,
  WizardStep,
  WizardState,
  WizardResult,
  AdvancedInitConfig,
} from './init-index.js';

// ── Export Accessibility ────────────────────────────────────────────────────

describe('init-index exports', () => {
  it('should export TemplateSystem class', () => {
    expect(TemplateSystem).toBeDefined();
    expect(typeof TemplateSystem).toBe('function');
  });

  it('should export FrameworkDetector class', () => {
    expect(FrameworkDetector).toBeDefined();
    expect(typeof FrameworkDetector).toBe('function');
  });

  it('should export DependencyRecommender class', () => {
    expect(DependencyRecommender).toBeDefined();
    expect(typeof DependencyRecommender).toBe('function');
  });

  it('should export ConfigWizard class', () => {
    expect(ConfigWizard).toBeDefined();
    expect(typeof ConfigWizard).toBe('function');
  });

  it('should allow AdvancedInitConfig type usage', () => {
    const config: AdvancedInitConfig = {
      templateSystemEnabled: true,
      frameworkDetectionEnabled: true,
      dependencyRecommendationsEnabled: true,
      configWizardEnabled: true,
      autoDetectOnInit: false,
    };
    expect(config.templateSystemEnabled).toBe(true);
    expect(config.autoDetectOnInit).toBe(false);
  });
});

// ── Type Compatibility ──────────────────────────────────────────────────────

describe('type compatibility', () => {
  it('should allow ProjectType usage', () => {
    const pt: ProjectType = 'react-app';
    expect(pt).toBe('react-app');
  });

  it('should allow FrameworkCategory usage', () => {
    const fc: FrameworkCategory = 'frontend';
    expect(fc).toBe('frontend');
  });

  it('should allow RecommendationPriority usage', () => {
    const rp: RecommendationPriority = 'required';
    expect(rp).toBe('required');
  });

  it('should allow StepType usage', () => {
    const st: StepType = 'select';
    expect(st).toBe('select');
  });
});

// ── Full Pipeline Integration ───────────────────────────────────────────────

describe('full pipeline: detect -> recommend -> template -> wizard', () => {
  it('should run the complete detection-to-wizard pipeline', () => {
    // Step 1: Detect frameworks
    const detector = new FrameworkDetector();
    const profile = detector.buildProfile(
      { dependencies: { react: '^18', 'react-dom': '^18' }, devDependencies: { typescript: '^5', vitest: '^1' } },
      ['package-lock.json', 'tsconfig.json'],
      ['src/App.tsx'],
    );
    expect(profile.inferredProjectType).toBe('react-app');
    expect(profile.hasTypeScript).toBe(true);

    // Step 2: Recommend dependencies
    const recommender = new DependencyRecommender();
    const report = recommender.generateReport(profile);
    expect(report.recommendations.length).toBeGreaterThan(0);

    // Step 3: Get template
    const templates = new TemplateSystem();
    const template = templates.getTemplate(profile.inferredProjectType!);
    expect(template).toBeDefined();
    expect(template!.projectType).toBe('react-app');

    // Step 4: Render template
    const result = templates.renderTemplate('react-app', { projectName: 'my-pipeline-app' });
    expect(result).not.toBeNull();
    expect(result!.files.length).toBeGreaterThanOrEqual(2);

    // Step 5: Configure wizard with profile
    const wizard = new ConfigWizard();
    const steps = wizard.getSteps(profile);
    const projectTypeStep = steps.find((s) => s.name === 'project-type');
    expect(projectTypeStep!.defaultValue).toBe('react-app');
  });

  it('should handle api-server pipeline end-to-end', () => {
    const detector = new FrameworkDetector();
    const profile = detector.buildProfile(
      { dependencies: { express: '^4', zod: '^3', cors: '^2' }, devDependencies: { typescript: '^5' } },
      ['package-lock.json'],
      ['src/routes'],
    );
    expect(profile.inferredProjectType).toBe('api-server');

    const recommender = new DependencyRecommender();
    const recs = recommender.recommendForProfile(profile);
    expect(recs.find((r) => r.packageName === 'zod')).toBeDefined();

    const templates = new TemplateSystem();
    const rendered = templates.renderTemplate('api-server', {
      projectName: 'my-api',
      author: 'Test Author',
    });
    expect(rendered).not.toBeNull();
    expect(rendered!.files.some((f) => f.content.includes('my-api'))).toBe(true);
    expect(rendered!.files.some((f) => f.content.includes('Test Author'))).toBe(true);
  });

  it('should create project from template and complete wizard', () => {
    const templates = new TemplateSystem();
    const project = templates.createProjectFromTemplate('cli-tool', { projectName: 'my-cli' });
    expect(project).not.toBeNull();
    expect(project!.result.packageJson.name).toBe('my-cli');

    const wizard = new ConfigWizard();
    let state = wizard.createState();
    state = wizard.processAnswer(state, 'cli-tool');
    state = wizard.processAnswer(state, 'standard');
    // model-preference skipped
    state = wizard.processAnswer(state, 'semi-autonomous');
    state = wizard.processAnswer(state, 'comprehensive');
    state = wizard.processAnswer(state, 'feature-branch');
    expect(wizard.isComplete(state)).toBe(true);
    const result = wizard.complete(state);
    expect(result.projectType).toBe('cli-tool');
  });

  it('should detect library project and render template', () => {
    const templates = new TemplateSystem();
    const vars = templates.getTemplateVariables('library');
    expect(vars.map((v) => v.name)).toContain('projectName');
    expect(vars.map((v) => v.name)).toContain('author');

    const rendered = templates.renderTemplate('library', {
      projectName: 'my-lib',
      author: 'Lib Author',
    });
    expect(rendered).not.toBeNull();
    expect(rendered!.packageJson.dependencies).toEqual({});
    expect(rendered!.packageJson.devDependencies['tsup']).toBe('latest');
  });

  it('should produce ranked recommendations in report', () => {
    const detector = new FrameworkDetector();
    const profile = detector.buildProfile(
      { dependencies: { react: '^18' }, devDependencies: { typescript: '^5' } },
      ['package-lock.json'],
      [],
    );
    const recommender = new DependencyRecommender();
    const report = recommender.generateReport(profile);
    const priorities = report.recommendations.map((r) => r.priority);
    const order = { required: 0, recommended: 1, optional: 2 };
    for (let i = 1; i < priorities.length; i++) {
      expect(order[priorities[i - 1]]).toBeLessThanOrEqual(order[priorities[i]]);
    }
  });

  it('should merge detection methods in buildProfile', () => {
    const detector = new FrameworkDetector();
    const profile = detector.buildProfile(
      { dependencies: { react: '^18' } },
      ['vitest.config.ts', 'tailwind.config.js'],
      ['src/App.tsx', 'prisma'],
    );
    const names = profile.detectedFrameworks.map((f) => f.name);
    expect(names).toContain('React');
    expect(names).toContain('Vitest');
    expect(names).toContain('Tailwind');
    expect(names).toContain('Prisma');
  });

  it('should validate template variables before rendering', () => {
    const templates = new TemplateSystem();
    const validation = templates.validateVariables('api-server', {});
    expect(validation.valid).toBe(false);
    expect(validation.missing).toContain('projectName');

    const validResult = templates.validateVariables('api-server', { projectName: 'test' });
    expect(validResult.valid).toBe(true);
  });

  it('should have all templates with novaConfig and agentOverrides', () => {
    const templates = new TemplateSystem();
    for (const template of templates.listTemplates()) {
      expect(template.novaConfig).toBeDefined();
      expect(Object.keys(template.novaConfig).length).toBeGreaterThanOrEqual(1);
      expect(template.agentOverrides).toBeDefined();
      expect(typeof template.agentOverrides).toBe('object');
    }
  });
});
