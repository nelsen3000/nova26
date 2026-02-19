import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigWizard } from './config-wizard.js';
import type { WizardStep, WizardState, WizardResult, StepType } from './config-wizard.js';
import type { ProjectProfile } from './framework-detector.js';

function createProfile(overrides: Partial<ProjectProfile> = {}): ProjectProfile {
  return {
    detectedFrameworks: [],
    packageManager: 'npm',
    inferredProjectType: null,
    hasTypeScript: true,
    hasTests: false,
    builtAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ConfigWizard', () => {
  let wizard: ConfigWizard;

  beforeEach(() => {
    wizard = new ConfigWizard();
  });

  // ── Constructor / built-in steps ──────────────────────────────────────

  it('should register exactly 6 built-in steps', () => {
    const steps = wizard.getSteps();
    expect(steps).toHaveLength(6);
  });

  it('should include all required step names', () => {
    const names = wizard.getSteps().map((s) => s.name);
    expect(names).toContain('project-type');
    expect(names).toContain('tier-selection');
    expect(names).toContain('model-preference');
    expect(names).toContain('autonomy-level');
    expect(names).toContain('testing-strategy');
    expect(names).toContain('git-workflow');
  });

  it('should have unique IDs for all steps', () => {
    const ids = wizard.getSteps().map((s) => s.id);
    expect(new Set(ids).size).toBe(6);
  });

  it('should set model-preference to depend on tier-selection=free', () => {
    const modelStep = wizard.getSteps().find((s) => s.name === 'model-preference');
    expect(modelStep).toBeDefined();
    expect(modelStep!.dependsOn).toEqual({ stepName: 'tier-selection', value: 'free' });
  });

  // ── getSteps with profile ────────────────────────────────────────────

  it('should use inferred project type as default when profile is provided', () => {
    const profile = createProfile({ inferredProjectType: 'api-server' });
    const steps = wizard.getSteps(profile);
    const projectTypeStep = steps.find((s) => s.name === 'project-type');
    expect(projectTypeStep!.defaultValue).toBe('api-server');
  });

  it('should keep default when profile has no inferred type', () => {
    const profile = createProfile({ inferredProjectType: null });
    const steps = wizard.getSteps(profile);
    const projectTypeStep = steps.find((s) => s.name === 'project-type');
    expect(projectTypeStep!.defaultValue).toBe('react-app');
  });

  // ── createState ──────────────────────────────────────────────────────

  it('should create state with index 0, empty answers, and valid timestamp', () => {
    const state = wizard.createState();
    expect(state.currentStepIndex).toBe(0);
    expect(state.answers).toEqual({});
    expect(state.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(new Date(state.startedAt).toISOString()).toBe(state.startedAt);
  });

  // ── getCurrentStep ───────────────────────────────────────────────────

  it('should return the first step for a fresh state', () => {
    const state = wizard.createState();
    const step = wizard.getCurrentStep(state);
    expect(step).not.toBeNull();
    expect(step!.name).toBe('project-type');
  });

  it('should return null when past the last step', () => {
    const state: WizardState = {
      id: 'test',
      currentStepIndex: 100,
      answers: {},
      startedAt: new Date().toISOString(),
    };
    expect(wizard.getCurrentStep(state)).toBeNull();
  });

  // ── shouldShowStep ───────────────────────────────────────────────────

  it('should show steps without dependsOn', () => {
    const step = wizard.getSteps().find((s) => s.name === 'project-type')!;
    expect(wizard.shouldShowStep(step, {})).toBe(true);
  });

  it('should show model-preference when tier=free', () => {
    const step = wizard.getSteps().find((s) => s.name === 'model-preference')!;
    expect(wizard.shouldShowStep(step, { 'tier-selection': 'free' })).toBe(true);
  });

  it('should hide model-preference when tier=standard', () => {
    const step = wizard.getSteps().find((s) => s.name === 'model-preference')!;
    expect(wizard.shouldShowStep(step, { 'tier-selection': 'standard' })).toBe(false);
  });

  // ── processAnswer ────────────────────────────────────────────────────

  it('should advance to next step after answering', () => {
    let state = wizard.createState();
    state = wizard.processAnswer(state, 'react-app');
    expect(state.answers['project-type']).toBe('react-app');
    expect(state.currentStepIndex).toBe(1);
  });

  it('should skip model-preference when tier is standard', () => {
    let state = wizard.createState();
    state = wizard.processAnswer(state, 'react-app'); // project-type -> tier-selection
    state = wizard.processAnswer(state, 'standard');   // tier-selection -> skip model-preference -> autonomy-level
    const step = wizard.getCurrentStep(state);
    expect(step).not.toBeNull();
    expect(step!.name).toBe('autonomy-level');
  });

  it('should not skip model-preference when tier is free', () => {
    let state = wizard.createState();
    state = wizard.processAnswer(state, 'react-app');
    state = wizard.processAnswer(state, 'free');
    const step = wizard.getCurrentStep(state);
    expect(step).not.toBeNull();
    expect(step!.name).toBe('model-preference');
  });

  it('should not advance past the end', () => {
    let state = wizard.createState();
    // Walk through all 6 steps (model-preference skipped if standard)
    state = wizard.processAnswer(state, 'react-app');
    state = wizard.processAnswer(state, 'free');
    state = wizard.processAnswer(state, 'llama3');
    state = wizard.processAnswer(state, 'supervised');
    state = wizard.processAnswer(state, 'tdd');
    state = wizard.processAnswer(state, 'gitflow');
    expect(wizard.isComplete(state)).toBe(true);
    // Processing another answer should not change state
    const unchanged = wizard.processAnswer(state, 'extra');
    expect(unchanged.currentStepIndex).toBe(state.currentStepIndex);
  });

  // ── previousStep ─────────────────────────────────────────────────────

  it('should go back to the previous step', () => {
    let state = wizard.createState();
    state = wizard.processAnswer(state, 'react-app');
    state = wizard.previousStep(state);
    expect(state.currentStepIndex).toBe(0);
  });

  it('should not go before index 0', () => {
    const state = wizard.createState();
    const result = wizard.previousStep(state);
    expect(result.currentStepIndex).toBe(0);
  });

  // ── isComplete ───────────────────────────────────────────────────────

  it('should not be complete at the start', () => {
    expect(wizard.isComplete(wizard.createState())).toBe(false);
  });

  // ── generateConfig ───────────────────────────────────────────────────

  it('should generate config from answers', () => {
    const config = wizard.generateConfig({
      'project-type': 'api-server',
      'tier-selection': 'premium',
      'autonomy-level': 'fully-autonomous',
      'testing-strategy': 'tdd',
      'git-workflow': 'trunk-based',
    });
    expect(config['projectType']).toBe('api-server');
    expect(config['tier']).toBe('premium');
    expect(config['autonomyLevel']).toBe('fully-autonomous');
  });

  it('should use defaults for missing answers', () => {
    const config = wizard.generateConfig({});
    expect(config['projectType']).toBe('react-app');
    expect(config['tier']).toBe('standard');
  });

  // ── complete ─────────────────────────────────────────────────────────

  it('should produce a WizardResult with UUID and ISO timestamp', () => {
    let state = wizard.createState();
    state = wizard.processAnswer(state, 'cli-tool');
    state = wizard.processAnswer(state, 'free');
    state = wizard.processAnswer(state, 'mistral');
    state = wizard.processAnswer(state, 'supervised');
    state = wizard.processAnswer(state, 'minimal');
    state = wizard.processAnswer(state, 'none');
    const result = wizard.complete(state);
    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(result.projectType).toBe('cli-tool');
    expect(result.tier).toBe('free');
    expect(result.modelPreference).toBe('mistral');
    expect(new Date(result.completedAt).toISOString()).toBe(result.completedAt);
  });

  it('should set projectType to null for invalid type', () => {
    const state: WizardState = {
      id: 'test',
      currentStepIndex: 6,
      answers: { 'project-type': 'invalid-type' },
      startedAt: new Date().toISOString(),
    };
    const result = wizard.complete(state);
    expect(result.projectType).toBeNull();
  });
});
