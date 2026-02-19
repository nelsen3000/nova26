import crypto from 'node:crypto';
import type { ProjectProfile } from './framework-detector.js';
import type { ProjectType } from './template-system.js';

// ── Types ──────────────────────────────────────────────────────────────────

export type StepType = 'select' | 'input' | 'confirm' | 'multi-select';

export interface WizardStep {
  id: string;
  name: string;
  prompt: string;
  type: StepType;
  options?: string[];
  defaultValue?: string;
  dependsOn?: { stepName: string; value: string };
}

export interface WizardState {
  id: string;
  currentStepIndex: number;
  answers: Record<string, string>;
  startedAt: string;
}

export interface WizardResult {
  id: string;
  projectType: ProjectType | null;
  tier: string;
  modelPreference: string;
  autonomyLevel: string;
  testingStrategy: string;
  gitWorkflow: string;
  completedAt: string;
}

// ── Config Wizard ──────────────────────────────────────────────────────────

export class ConfigWizard {
  private steps: WizardStep[] = [];

  constructor() {
    this.registerBuiltInSteps();
  }

  private registerBuiltInSteps(): void {
    this.steps = [
      {
        id: crypto.randomUUID(),
        name: 'project-type',
        prompt: 'What type of project are you building?',
        type: 'select',
        options: ['react-app', 'api-server', 'cli-tool', 'library'],
        defaultValue: 'react-app',
      },
      {
        id: crypto.randomUUID(),
        name: 'tier-selection',
        prompt: 'Which tier would you like to use?',
        type: 'select',
        options: ['free', 'standard', 'premium'],
        defaultValue: 'standard',
      },
      {
        id: crypto.randomUUID(),
        name: 'model-preference',
        prompt: 'Which model would you prefer for code generation?',
        type: 'select',
        options: ['llama3', 'codellama', 'mistral', 'mixtral'],
        defaultValue: 'llama3',
        dependsOn: { stepName: 'tier-selection', value: 'free' },
      },
      {
        id: crypto.randomUUID(),
        name: 'autonomy-level',
        prompt: 'What level of agent autonomy would you like?',
        type: 'select',
        options: ['supervised', 'semi-autonomous', 'fully-autonomous'],
        defaultValue: 'semi-autonomous',
      },
      {
        id: crypto.randomUUID(),
        name: 'testing-strategy',
        prompt: 'What testing strategy should Nova use?',
        type: 'select',
        options: ['tdd', 'bdd', 'minimal', 'comprehensive'],
        defaultValue: 'comprehensive',
      },
      {
        id: crypto.randomUUID(),
        name: 'git-workflow',
        prompt: 'What git workflow should Nova follow?',
        type: 'select',
        options: ['gitflow', 'trunk-based', 'feature-branch', 'none'],
        defaultValue: 'feature-branch',
      },
    ];
  }

  getSteps(profile?: ProjectProfile): WizardStep[] {
    if (!profile) {
      return [...this.steps];
    }

    return this.steps.map((step) => {
      if (step.name === 'project-type' && profile.inferredProjectType) {
        return { ...step, defaultValue: profile.inferredProjectType };
      }
      if (step.name === 'testing-strategy' && profile.hasTests) {
        return { ...step, defaultValue: 'comprehensive' };
      }
      return { ...step };
    });
  }

  createState(): WizardState {
    return {
      id: crypto.randomUUID(),
      currentStepIndex: 0,
      answers: {},
      startedAt: new Date().toISOString(),
    };
  }

  getCurrentStep(state: WizardState): WizardStep | null {
    const steps = this.getSteps();
    if (state.currentStepIndex >= steps.length) {
      return null;
    }
    return steps[state.currentStepIndex];
  }

  shouldShowStep(step: WizardStep, answers: Record<string, string>): boolean {
    if (!step.dependsOn) {
      return true;
    }
    return answers[step.dependsOn.stepName] === step.dependsOn.value;
  }

  processAnswer(state: WizardState, answer: string): WizardState {
    const steps = this.getSteps();
    if (state.currentStepIndex >= steps.length) {
      return state;
    }

    const currentStep = steps[state.currentStepIndex];
    const newAnswers = { ...state.answers, [currentStep.name]: answer };
    let nextIndex = state.currentStepIndex + 1;

    // Skip steps that should not be shown based on current answers
    while (nextIndex < steps.length) {
      const nextStep = steps[nextIndex];
      if (this.shouldShowStep(nextStep, newAnswers)) {
        break;
      }
      nextIndex++;
    }

    return {
      ...state,
      currentStepIndex: nextIndex,
      answers: newAnswers,
    };
  }

  previousStep(state: WizardState): WizardState {
    if (state.currentStepIndex <= 0) {
      return state;
    }

    const steps = this.getSteps();
    let prevIndex = state.currentStepIndex - 1;

    // Skip hidden steps going backward
    while (prevIndex > 0) {
      const prevStep = steps[prevIndex];
      if (this.shouldShowStep(prevStep, state.answers)) {
        break;
      }
      prevIndex--;
    }

    return {
      ...state,
      currentStepIndex: prevIndex,
    };
  }

  isComplete(state: WizardState): boolean {
    return state.currentStepIndex >= this.steps.length;
  }

  generateConfig(answers: Record<string, string>): Record<string, unknown> {
    return {
      projectType: answers['project-type'] ?? 'react-app',
      tier: answers['tier-selection'] ?? 'standard',
      modelPreference: answers['model-preference'] ?? 'llama3',
      autonomyLevel: answers['autonomy-level'] ?? 'semi-autonomous',
      testingStrategy: answers['testing-strategy'] ?? 'comprehensive',
      gitWorkflow: answers['git-workflow'] ?? 'feature-branch',
    };
  }

  complete(state: WizardState): WizardResult {
    const config = this.generateConfig(state.answers);
    const projectTypeStr = config['projectType'] as string;
    const validTypes: ProjectType[] = ['react-app', 'api-server', 'cli-tool', 'library'];
    const projectType: ProjectType | null = validTypes.includes(projectTypeStr as ProjectType)
      ? (projectTypeStr as ProjectType)
      : null;

    return {
      id: crypto.randomUUID(),
      projectType,
      tier: config['tier'] as string,
      modelPreference: config['modelPreference'] as string,
      autonomyLevel: config['autonomyLevel'] as string,
      testingStrategy: config['testingStrategy'] as string,
      gitWorkflow: config['gitWorkflow'] as string,
      completedAt: new Date().toISOString(),
    };
  }
}
