// Portfolio Module - Cross-Project Intelligence
// KIMI-PORTFOLIO: R16-01 spec

// Core manifest management
export {
  PortfolioManifest,
  type PortfolioConfig,
  type Portfolio,
  type PortfolioProject,
  type PortfolioPattern,
  type PatternLineage,
  type SkillGrowthRecord,
} from './portfolio-manifest.js';

// Similarity detection
export {
  SimilarityEngine,
  type SimilarityEngineConfig,
  type ProjectSimilarity,
  type CrossProjectInsight,
  type SimilarityClassification,
} from './similarity-engine.js';

// Pattern detection & analytics
export {
  PatternDetector,
  type PatternCandidate,
  type PatternPromotionResult,
  type SkillGrowthAnalysis,
  type PatternDetectionConfig,
} from './pattern-detection.js';

// CLI rendering
export {
  PortfolioRenderer,
  type RenderOptions,
  type PortfolioStatus,
  type PortfolioSummary,
  type RenderedProject,
  type RenderedSkillTrend,
  type RenderedPattern,
  type RenderedInsight,
} from './portfolio-renderer.js';

// ============================================================================
// Factory function for easy instantiation
// ============================================================================

import { PortfolioManifest, type PortfolioConfig } from './portfolio-manifest.js';
import { SimilarityEngine, type SimilarityEngineConfig } from './similarity-engine.js';
import { PatternDetector, type PatternDetectionConfig } from './pattern-detection.js';
import { PortfolioRenderer, type RenderOptions } from './portfolio-renderer.js';

export interface PortfolioEngineConfig {
  manifest?: Partial<PortfolioConfig>;
  similarity?: Partial<SimilarityEngineConfig>;
  patternDetection?: Partial<PatternDetectionConfig>;
  rendering?: Partial<RenderOptions>;
}

/**
 * Create a complete portfolio engine with all components
 */
export function createPortfolioEngine(config: PortfolioEngineConfig = {}) {
  const manifest = new PortfolioManifest(config.manifest);
  const similarity = new SimilarityEngine(config.similarity);
  const detector = new PatternDetector(config.patternDetection);
  const renderer = new PortfolioRenderer(config.rendering);

  return {
    manifest,
    similarity,
    detector,
    renderer,
  };
}
