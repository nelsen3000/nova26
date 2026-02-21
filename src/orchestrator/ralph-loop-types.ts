// RalphLoop Type Exports - Extracted to avoid circular dependencies

// R16-01 Portfolio
import type { PortfolioEngineConfig } from '../portfolio/index.js';
// R16-03 Generative UI
import type { LivePreviewConfig } from '../generative-ui/live-preview.js';
// R16-04 Autonomous Testing
import type { TestRunConfig } from '../testing/autonomous-runner.js';
// R17-01 Code Review
import type { ReviewConfig } from '../review/pr-intelligence.js';
// R17-06 Accessibility
import type { A11yConfig } from '../a11y/wcag-engine.js';
// R17-07 Technical Debt
import type { DebtConfig } from '../debt/technical-debt.js';
// R17-09 Production Feedback
import type { FeedbackLoopConfig } from '../prod-feedback/feedback-loop.js';
// R17-10 Health Dashboard
import type { HealthConfig } from '../health/health-dashboard.js';

// R19 Imports
import type { MobileLaunchConfig } from '../mobile-launch/types.js';
import type { SemanticModelConfig } from '../atlas/types.js';
import type { StudioRulesConfig } from '../studio-rules/types.js';
import type { OrchestratorHierarchyConfig } from './hierarchy-types.js';

import type { DreamModeConfig } from '../dream/dream-engine.js';
import type { ParallelUniverseConfig } from '../universe/parallel-universe.js';
import type { OvernightEvolutionConfig } from '../evolution/overnight-engine.js';
import type { SymbiontConfig } from '../symbiont/symbiont-core.js';
import type { TasteRoomConfig } from '../taste-room/taste-room.js';
import type { AgentMemoryConfig } from '../memory/agent-memory.js';
import type { WellbeingConfig } from '../wellbeing/signal-detector.js';
import type { AdvancedRecoveryConfig } from '../recovery/recovery-index.js';
import type { AdvancedInitConfig } from '../init/init-index.js';
import type { AutonomyLevel } from '../config/autonomy.js';
// R22-01 Model Routing
import type { ModelRoutingConfig } from '../model-routing/index.js';
// R23-01 Visual Workflow Engine
import type { VisualWorkflowEngineConfig } from '../workflow-engine/types.js';

// R22-R24 Imports
import type { ModelRoutingConfig } from '../model-routing/types.js';
import type { PerplexityToolConfig } from '../tools/perplexity/types.js';
import type { WorkflowEngineOptions } from '../workflow-engine/types.js';
import type { CinematicConfig } from '../observability/types.js';

// Placeholder configs for R22-R24 modules without dedicated config types
export interface InfiniteMemoryModuleConfig {
  maxNodes?: number;
  pruneStaleAfterDays?: number;
}

export interface AIModelDatabaseModuleConfig {
  autoSyncEnabled?: boolean;
  tasteAwareRouting?: boolean;
}

export interface CRDTCollaborationModuleConfig {
  maxParticipants?: number;
  conflictResolution?: 'last-write-wins' | 'semantic-merge';
}

// Placeholder configs for modules without dedicated config types
export interface MigrationModuleConfig {
  maxStepsPerRun?: number;
  autoRollback?: boolean;
}

export interface DebugModuleConfig {
  maxSessionHistory?: number;
  autoRegressionTests?: boolean;
}

export interface DependencyModuleConfig {
  autoUpdateMinor?: boolean;
  vulnerabilityScanOnBuild?: boolean;
}

export interface EnvModuleConfig {
  secretDetection?: boolean;
  envDiffOnSwitch?: boolean;
}

export interface OrchestrationModuleConfig {
  metaLearningEnabled?: boolean;
  retrospectiveAfterBuild?: boolean;
}

export interface RalphLoopOptions {
  parallelMode?: boolean;
  concurrency?: number;
  autoTestFix?: boolean;       // Auto test→fix→retest loop
  maxTestRetries?: number;     // Max retries for test loop (default: 3)
  planApproval?: boolean;      // Require plan approval before execution
  eventStore?: boolean;        // Enable event-sourced session logging
  sessionMemory?: boolean;     // Enable cross-session memory (learn from tasks)
  gitWorkflow?: boolean;       // Enable auto branch/commit/PR workflow
  costTracking?: boolean;      // Enable per-call cost tracking (C-04)
  budgetLimit?: number;        // Daily budget limit in USD — halt builds when exceeded (C-05)
  convexSync?: boolean;        // Enable real-time Convex cloud dashboard sync (MEGA-04)
  agenticMode?: boolean;       // Enable agentic inner loop with tools
  autonomyLevel?: AutonomyLevel;  // Autonomy level for agent behavior (1-5)
  // Visionary engine configs (KIMI-VISIONARY)
  dreamModeEnabled?: boolean;
  dreamConfig?: DreamModeConfig;
  parallelUniverseEnabled?: boolean;
  parallelUniverseConfig?: ParallelUniverseConfig;
  overnightEvolutionEnabled?: boolean;
  overnightConfig?: OvernightEvolutionConfig;
  symbiontEnabled?: boolean;
  symbiontConfig?: SymbiontConfig;
  tasteRoomEnabled?: boolean;
  tasteRoomConfig?: TasteRoomConfig;
  // Agent memory (R16-02)
  agentMemoryEnabled?: boolean;
  memoryConfig?: AgentMemoryConfig;
  // Developer wellbeing (R16-05)
  wellbeingEnabled?: boolean;
  wellbeingConfig?: WellbeingConfig;
  // Advanced Recovery (R17-01)
  advancedRecoveryEnabled?: boolean;
  advancedRecoveryConfig?: AdvancedRecoveryConfig;
  // Advanced Init (R17-02)
  advancedInitEnabled?: boolean;
  advancedInitConfig?: AdvancedInitConfig;
  // Portfolio Intelligence (R16-01)
  portfolioEnabled?: boolean;
  portfolioConfig?: PortfolioEngineConfig;
  // Generative UI (R16-03)
  generativeUIEnabled?: boolean;
  generativeUIConfig?: LivePreviewConfig;
  // Autonomous Testing (R16-04)
  autonomousTestingEnabled?: boolean;
  testRunConfig?: TestRunConfig;
  // Code Review (R17-03)
  codeReviewEnabled?: boolean;
  codeReviewConfig?: ReviewConfig;
  // Migration Engine (R17-04)
  migrationEnabled?: boolean;
  migrationConfig?: MigrationModuleConfig;
  // Debugging (R17-05)
  debugEngineEnabled?: boolean;
  debugConfig?: DebugModuleConfig;
  // Accessibility (R17-06)
  accessibilityEnabled?: boolean;
  accessibilityConfig?: A11yConfig;
  // Technical Debt (R17-07)
  debtScoringEnabled?: boolean;
  debtConfig?: DebtConfig;
  // Dependency Management (R17-08)
  dependencyManagementEnabled?: boolean;
  dependencyConfig?: DependencyModuleConfig;
  // Production Feedback (R17-09)
  productionFeedbackEnabled?: boolean;
  productionFeedbackConfig?: FeedbackLoopConfig;
  // Health Dashboard (R17-10)
  healthDashboardEnabled?: boolean;
  healthConfig?: HealthConfig;
  // Environment Management (R17-11)
  envManagementEnabled?: boolean;
  envConfig?: EnvModuleConfig;
  // Orchestration Optimization (R17-12)
  orchestrationOptimizationEnabled?: boolean;
  orchestrationConfig?: OrchestrationModuleConfig;
  // R19: Mobile Launch (R19-01)
  mobileLaunchEnabled?: boolean;
  mobileLaunchConfig?: MobileLaunchConfig;
  // R19: Semantic Model (R19-02)
  semanticModelEnabled?: boolean;
  semanticModelConfig?: SemanticModelConfig;
  // R19: Studio Rules (R19-03)
  studioRulesEnabled?: boolean;
  studioRulesConfig?: StudioRulesConfig;
  // R20: Orchestrator Hierarchy (R20-01)
  orchestratorHierarchyEnabled?: boolean;
  orchestratorHierarchy?: OrchestratorHierarchyConfig;
  // R22: Model Routing (R22-01)
  modelRoutingEnabled?: boolean;
  modelRoutingConfig?: ModelRoutingConfig;
  // PERP: Perplexity Research (PERP-01)
  perplexityEnabled?: boolean;
  perplexityConfig?: PerplexityToolConfig;
  // R23: Workflow Engine (R23-01)
  workflowEngineEnabled?: boolean;
  workflowEngineConfig?: WorkflowEngineOptions;
  // R23: Infinite Memory (R23-03)
  infiniteMemoryEnabled?: boolean;
  infiniteMemoryConfig?: InfiniteMemoryModuleConfig;
  // R23: Cinematic Observability (R23-05)
  cinematicObservabilityEnabled?: boolean;
  cinematicObservabilityConfig?: CinematicConfig;
  // R24: AI Model Database (R24-01)
  aiModelDatabaseEnabled?: boolean;
  aiModelDatabaseConfig?: AIModelDatabaseModuleConfig;
  // R24: CRDT Collaboration (R24-03)
  crdtCollaborationEnabled?: boolean;
  crdtCollaborationConfig?: CRDTCollaborationModuleConfig;
}

// Re-export HookRegistry from lifecycle-hooks
export { HookRegistry } from './lifecycle-hooks.js';
