export * from './template-system.js';
export * from './framework-detector.js';
export * from './dependency-recommender.js';
export * from './config-wizard.js';

export interface AdvancedInitConfig {
  templateSystemEnabled: boolean;
  frameworkDetectionEnabled: boolean;
  dependencyRecommendationsEnabled: boolean;
  configWizardEnabled: boolean;
  autoDetectOnInit: boolean;
}
