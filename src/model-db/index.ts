// Model Database - Extended model registry with capabilities and matching
// Spec: .nova/specs/grok-r24-immortal-omniverse.md (R24-01)

export {
  ExtendedModelRegistry,
  PREPOPULATED_MODELS,
  ModelCapabilitySchema,
  ModelPricingSchema,
  ModelPerformanceSchema,
  ModelLimitsSchema,
  ModelEntrySchema,
  getExtendedModelRegistry,
  resetExtendedModelRegistry,
} from './model-registry';

export type {
  ModelCapability,
  ModelPricing,
  ModelPerformance,
  ModelLimits,
  ModelEntry,
} from './model-registry';

export {
  ModelMatcher,
  getModelMatcher,
  resetModelMatcher,
} from './model-matcher';

export type {
  TaskRequirements,
  RequiredCapability,
  MatchResult,
  MatchBreakdown,
  MatchOptions,
} from './model-matcher';
