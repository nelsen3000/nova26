// Retrieval Formatter - Format memories for LLM context
// Spec: .kiro/specs/hindsight-persistent-memory/tasks.md

import type { MemoryFragment, ScoredFragment, RetrievalContext } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface FormatterConfig {
  tokenBudget: number;
  includeMetadata: boolean;
  formatType: 'structured' | 'conversational';
}

export const DEFAULT_CONFIG: FormatterConfig = {
  tokenBudget: 2000,
  includeMetadata: true,
  formatType: 'structured',
};

// ═══════════════════════════════════════════════════════════════════════════════
// Token Estimation
// ═══════════════════════════════════════════════════════════════════════════════

export function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Retrieval Formatter
// ═══════════════════════════════════════════════════════════════════════════════

export function formatRetrieval(
  scoredFragments: ScoredFragment[],
  config?: Partial<FormatterConfig>
): RetrievalContext {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Sort by score (already should be sorted, but ensure)
  const sorted = [...scoredFragments].sort((a, b) => b.score - a.score);

  // Build formatted context within token budget
  const selected: MemoryFragment[] = [];
  let tokenCount = 0;

  for (const scored of sorted) {
    const fragmentText = formatFragment(scored.fragment, fullConfig);
    const fragmentTokens = estimateTokenCount(fragmentText);

    if (tokenCount + fragmentTokens > fullConfig.tokenBudget) {
      break;
    }

    selected.push(scored.fragment);
    tokenCount += fragmentTokens;
  }

  // Generate formatted context
  const formattedContext = selected
    .map(f => formatFragment(f, fullConfig))
    .join('\n\n---\n\n');

  const relevanceScores: Record<string, number> = {};
  for (const scored of scoredFragments) {
    relevanceScores[scored.fragment.id] = scored.score;
  }

  return {
    fragments: selected,
    formattedContext,
    tokenCount,
    relevanceScores,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fragment Formatting
// ═══════════════════════════════════════════════════════════════════════════════

function formatFragment(
  fragment: MemoryFragment,
  config: FormatterConfig
): string {
  switch (fragment.type) {
    case 'episodic':
      return formatEpisodic(fragment, config);
    case 'procedural':
      return formatProcedural(fragment, config);
    case 'semantic':
      return formatSemantic(fragment, config);
    default:
      return formatGeneric(fragment, config);
  }
}

function formatEpisodic(
  fragment: MemoryFragment,
  config: FormatterConfig
): string {
  const date = new Date(fragment.createdAt).toISOString().split('T')[0];
  const lines: string[] = [
    `[EPISODIC] ${date} | ${fragment.projectId} | ${fragment.agentId}`,
    fragment.content,
  ];

  if (config.includeMetadata) {
    lines.push(`  Relevance: ${(fragment.relevance * 100).toFixed(0)}%`);
    lines.push(`  Source: ${fragment.provenance.sourceType}`);
  }

  return lines.join('\n');
}

function formatProcedural(
  fragment: MemoryFragment,
  config: FormatterConfig
): string {
  const lines: string[] = [
    `[PROCEDURAL] ${fragment.agentId}`,
    `Trigger: ${fragment.extra?.trigger || 'N/A'}`,
    `Steps:`,
    fragment.content,
  ];

  if (config.includeMetadata) {
    lines.push(`  Confidence: ${(fragment.confidence * 100).toFixed(0)}%`);
  }

  return lines.join('\n');
}

function formatSemantic(
  fragment: MemoryFragment,
  config: FormatterConfig
): string {
  const lines: string[] = [
    `[SEMANTIC] ${fragment.agentId}`,
    fragment.content,
  ];

  if (config.includeMetadata) {
    const evidenceCount = fragment.extra?.evidenceCount || 0;
    lines.push(`  Confidence: ${(fragment.confidence * 100).toFixed(0)}%`);
    lines.push(`  Evidence: ${evidenceCount} sources`);
    if (fragment.tags.length > 0) {
      lines.push(`  Tags: ${fragment.tags.join(', ')}`);
    }
  }

  return lines.join('\n');
}

function formatGeneric(
  fragment: MemoryFragment,
  config: FormatterConfig
): string {
  const lines: string[] = [
    `[${fragment.type.toUpperCase()}] ${fragment.agentId}`,
    fragment.content,
  ];

  if (config.includeMetadata) {
    lines.push(`  Relevance: ${(fragment.relevance * 100).toFixed(0)}%`);
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pretty Printer
// ═══════════════════════════════════════════════════════════════════════════════

export function prettyPrint(fragment: MemoryFragment): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════',
    `Memory Fragment: ${fragment.id}`,
    `Type: ${fragment.type.toUpperCase()}`,
    `Content: ${fragment.content.substring(0, 200)}${fragment.content.length > 200 ? '...' : ''}`,
    `Agent: ${fragment.agentId}`,
    `Project: ${fragment.projectId}`,
    `Relevance: ${(fragment.relevance * 100).toFixed(1)}%`,
    `Confidence: ${(fragment.confidence * 100).toFixed(1)}%`,
    `Created: ${new Date(fragment.createdAt).toISOString()}`,
    `Accessed: ${fragment.accessCount} times`,
    `Source: ${fragment.provenance.sourceType}:${fragment.provenance.sourceId}`,
  ];

  if (fragment.isPinned) {
    lines.push('📌 PINNED');
  }
  if (fragment.isArchived) {
    lines.push('🗄️ ARCHIVED');
  }
  if (fragment.tags.length > 0) {
    lines.push(`Tags: ${fragment.tags.join(', ')}`);
  }

  lines.push('═══════════════════════════════════════════════════════════');

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Token Budget Enforcement
// ═══════════════════════════════════════════════════════════════════════════════

export function enforceTokenBudget(
  fragments: MemoryFragment[],
  tokenBudget: number
): MemoryFragment[] {
  const sorted = [...fragments].sort((a, b) => b.relevance - a.relevance);

  const selected: MemoryFragment[] = [];
  let tokenCount = 0;

  for (const fragment of sorted) {
    const fragmentTokens = estimateTokenCount(fragment.content);

    if (tokenCount + fragmentTokens > tokenBudget) {
      break;
    }

    selected.push(fragment);
    tokenCount += fragmentTokens;
  }

  return selected;
}
