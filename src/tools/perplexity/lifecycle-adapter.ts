// Perplexity Research Lifecycle Adapter — KIMI-PERP-02
// Bridges Ralph Loop lifecycle events to Perplexity Agent

import type { FeatureLifecycleHandlers } from '../../orchestrator/lifecycle-wiring.js';
import type {
  TaskContext,
  TaskResult,
} from '../../orchestrator/lifecycle-hooks.js';
import { PerplexityAgent, createPerplexityAgent } from './perplexity-agent.js';
import type {
  PerplexityResearchBrief,
  PerplexityToolConfig,
} from './types.js';

// ============================================================================
// Configuration Types
// ============================================================================

export interface PerplexityLifecycleConfig {
  /** Enable Perplexity research integration */
  enabled: boolean;
  /** Perplexity tool configuration */
  perplexityConfig?: Partial<PerplexityToolConfig>;
  /** Keywords that trigger research */
  researchKeywords?: string[];
  /** Minimum relevance score threshold (0-100) */
  minRelevanceThreshold?: number;
  /** Enable research result caching across tasks */
  enableResearchCache?: boolean;
  /** Enable logging of research results */
  enableLogging?: boolean;
}

// ============================================================================
// Research Context Types
// ============================================================================

interface ResearchContext {
  taskId: string;
  queries: string[];
  wasResearched: boolean;
  brief?: PerplexityResearchBrief;
  relevanceScore: number;
}

interface CachedResearchEntry {
  brief: PerplexityResearchBrief;
  taskId: string;
  timestamp: number;
}

// ============================================================================
// Adapter State
// ============================================================================

interface BuildState {
  buildId: string;
  agent: PerplexityAgent;
  researchContexts: Map<string, ResearchContext>;
  researchCache: Map<string, CachedResearchEntry>;
  startTime: number;
}

// Module-level state (isolated per build)
let currentBuildState: BuildState | null = null;

// Default research keywords
const DEFAULT_RESEARCH_KEYWORDS: string[] = [
  'research',
  'analyze',
  'compare',
  'evaluate',
  'find',
  'investigate',
];

// ============================================================================
// Type Guards
// ============================================================================

export function isValidTaskContext(context: unknown): context is TaskContext {
  return (
    typeof context === 'object' &&
    context !== null &&
    'taskId' in context &&
    'title' in context &&
    'agentName' in context &&
    typeof (context as Record<string, unknown>).taskId === 'string' &&
    typeof (context as Record<string, unknown>).title === 'string'
  );
}

export function isValidTaskResult(context: unknown): context is TaskResult {
  return (
    typeof context === 'object' &&
    context !== null &&
    'taskId' in context &&
    'success' in context &&
    typeof (context as Record<string, unknown>).taskId === 'string' &&
    typeof (context as Record<string, unknown>).success === 'boolean'
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

function containsResearchKeywords(
  title: string,
  keywords: string[]
): boolean {
  const normalizedTitle = normalizeText(title);
  return keywords.some(keyword => normalizedTitle.includes(normalizeText(keyword)));
}

function generateSuggestedQueries(title: string): string[] {
  const queries: string[] = [];
  const normalizedTitle = normalizeText(title);

  // Base query from title
  queries.push(title);

  // Add contextual queries based on keywords
  if (normalizedTitle.includes('compare') || normalizedTitle.includes('vs')) {
    queries.push(`${title} - pros and cons`);
    queries.push(`${title} - comparison table`);
  }

  if (normalizedTitle.includes('best') || normalizedTitle.includes('recommend')) {
    queries.push(`${title} - 2024 rankings`);
    queries.push(`${title} - expert reviews`);
  }

  if (normalizedTitle.includes('how to') || normalizedTitle.includes('implement')) {
    queries.push(`${title} - step by step guide`);
    queries.push(`${title} - tutorial examples`);
  }

  if (normalizedTitle.includes('analyze') || normalizedTitle.includes('evaluate')) {
    queries.push(`${title} - analysis methodology`);
    queries.push(`${title} - key metrics`);
  }

  // Add a catch-all deep research query
  queries.push(`${title} - comprehensive overview`);

  return queries.slice(0, 3); // Limit to top 3 queries
}

function calculateRelevanceScore(brief: PerplexityResearchBrief): number {
  return brief.novaRelevanceScore;
}

// ============================================================================
// Lifecycle Hook Factory
// ============================================================================

export function createPerplexityLifecycleHooks(
  config: PerplexityLifecycleConfig
): FeatureLifecycleHandlers {
  const researchKeywords = config.researchKeywords ?? DEFAULT_RESEARCH_KEYWORDS;
  const minRelevanceThreshold = config.minRelevanceThreshold ?? 50;
  const enableLogging = config.enableLogging ?? true;

  return {
    onBeforeTask: async (context: TaskContext): Promise<void> => {
      if (!config.enabled) return;

      // Validate context
      if (!isValidTaskContext(context)) {
        console.warn('[PerplexityAdapter] Invalid task context');
        return;
      }

      // Initialize build state if needed
      if (!currentBuildState) {
        currentBuildState = {
          buildId: `build-${Date.now()}`,
          agent: createPerplexityAgent(config.perplexityConfig),
          researchContexts: new Map(),
          researchCache: new Map(),
          startTime: Date.now(),
        };
      }

      const shouldResearch = shouldUseResearch(context.title, researchKeywords);

      if (shouldResearch) {
        const queries = generateSuggestedQueries(context.title);

        // Store research context
        const researchContext: ResearchContext = {
          taskId: context.taskId,
          queries,
          wasResearched: false,
          relevanceScore: 0,
        };

        currentBuildState.researchContexts.set(context.taskId, researchContext);

        if (enableLogging) {
          console.log('[PerplexityAdapter] Research triggered for task', context.taskId, {
            title: context.title,
            queryCount: queries.length,
            queries,
          });
        }

        // Perform research using the primary query
        const primaryQuery = queries[0];
        if (primaryQuery) {
          try {
            // Check cache first
            const cachedEntry = currentBuildState.researchCache.get(normalizeText(primaryQuery));
            let brief: PerplexityResearchBrief;

            if (cachedEntry && config.enableResearchCache !== false) {
              brief = cachedEntry.brief;
              if (enableLogging) {
                console.log('[PerplexityAdapter] Using cached research for task', context.taskId);
              }
            } else {
              brief = await currentBuildState.agent.research(primaryQuery);

              // Cache the result
              if (config.enableResearchCache !== false) {
                currentBuildState.researchCache.set(normalizeText(primaryQuery), {
                  brief,
                  taskId: context.taskId,
                  timestamp: Date.now(),
                });
              }
            }

            const relevanceScore = calculateRelevanceScore(brief);
            researchContext.brief = brief;
            researchContext.relevanceScore = relevanceScore;
            researchContext.wasResearched = true;

            if (enableLogging) {
              console.log('[PerplexityAdapter] Research completed for task', context.taskId, {
                queryId: brief.queryId,
                relevanceScore,
                keyFindingsCount: brief.keyFindings.length,
                sourcesCount: brief.sources.length,
              });
            }

            // Warn if relevance is below threshold
            if (relevanceScore < minRelevanceThreshold) {
              console.warn(
                `[PerplexityAdapter] Low relevance score ${relevanceScore} for task ${context.taskId} ` +
                  `(threshold: ${minRelevanceThreshold})`
              );
            }
          } catch (error) {
            console.error(
              '[PerplexityAdapter] Research failed for task',
              context.taskId,
              error instanceof Error ? error.message : String(error)
            );
          }
        }
      } else {
        // Store minimal context for non-research tasks
        currentBuildState.researchContexts.set(context.taskId, {
          taskId: context.taskId,
          queries: [],
          wasResearched: false,
          relevanceScore: 0,
        });

        if (enableLogging) {
          console.log('[PerplexityAdapter] Research skipped for task', context.taskId, {
            title: context.title,
            reason: 'No research keywords detected',
          });
        }
      }
    },

    onAfterTask: async (context: TaskResult): Promise<void> => {
      if (!config.enabled) return;

      // Validate context
      if (!isValidTaskResult(context)) {
        console.warn('[PerplexityAdapter] Invalid task result');
        return;
      }

      if (!currentBuildState) {
        console.warn(`[PerplexityAdapter] No research context found for task ${context.taskId}`);
        return;
      }

      const researchContext = currentBuildState.researchContexts.get(context.taskId);

      if (!researchContext) {
        console.warn(`[PerplexityAdapter] No research context found for task ${context.taskId}`);
        return;
      }

      if (researchContext.wasResearched && researchContext.brief) {
        if (enableLogging) {
          console.log('[PerplexityAdapter] Post-task research summary for task', context.taskId, {
            queryId: researchContext.brief.queryId,
            relevanceScore: researchContext.relevanceScore,
            taskSuccess: context.success,
            taskDurationMs: context.durationMs,
            aceScore: context.aceScore,
            keyFindings: researchContext.brief.keyFindings.slice(0, 3),
            tags: researchContext.brief.tags,
          });
        }

        // Store findings in cache for future reference
        for (const query of researchContext.queries) {
          const normalizedQuery = normalizeText(query);
          if (!currentBuildState.researchCache.has(normalizedQuery)) {
            currentBuildState.researchCache.set(normalizedQuery, {
              brief: researchContext.brief,
              taskId: context.taskId,
              timestamp: Date.now(),
            });
          }
        }
      }

      // Clean up research context for completed task
      currentBuildState.researchContexts.delete(context.taskId);
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getCurrentBuildState(): BuildState | null {
  return currentBuildState;
}

export function getResearchCache(): Map<string, CachedResearchEntry> {
  return new Map(currentBuildState?.researchCache ?? []);
}

export function shouldUseResearch(title: string, keywords?: string[]): boolean {
  const researchKeywords = keywords ?? DEFAULT_RESEARCH_KEYWORDS;
  return containsResearchKeywords(title, researchKeywords);
}

export function resetBuildState(): void {
  currentBuildState = null;
}

// ============================================================================
// Additional Type Exports
// ============================================================================

export type { ResearchContext, CachedResearchEntry, BuildState };
