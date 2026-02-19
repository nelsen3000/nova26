// AI-Native Design Pipeline — R20-03

export type {
  DesignPipelineConfig,
  DesignFlow,
  DesignSystemConfig,
  ScreenSpec,
  ScreenConnection,
  ComponentSpec,
  DesignToken,
  AnimationConfig,
  JourneyTemplate,
  ScreenshotAnalysis,
  VariantSet,
  ResponsiveOutput,
  LivingCanvasRender,
  BreakpointConfig,
} from './types.js';

export {
  DEFAULT_DESIGN_PIPELINE_CONFIG,
  JOURNEY_TEMPLATES,
} from './types.js';

export {
  DesignPipeline,
  createDesignPipeline,
} from './pipeline-core.js';

export type { PipelineInput, PipelineOutput } from './pipeline-core.js';

export {
  TokenExtractor,
  createTokenExtractor,
  DEFAULT_EXTRACTION_CONFIG,
} from './token-extractor.js';

export {
  ResponsiveEngine,
  createResponsiveEngine,
  DEFAULT_RESPONSIVE_CONFIG,
} from './responsive-engine.js';
