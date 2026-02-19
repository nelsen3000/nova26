// Unified Knowledge Base — Search across Taste Vault, BistroLens, and cached docs
// KIMI-INTEGRATE-05: Grok R11 Obsidian-style knowledge management spec

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getGraphMemory, type GraphNode } from '../taste-vault/graph-memory.js';
import { getSemanticDedup } from '../similarity/semantic-dedup.js';
import { DocsCacheEntrySchema } from './docs-fetcher.js';

// ============================================================================
// Core Types
// ============================================================================

export interface KnowledgeResult {
  source: 'taste-vault' | 'docs-cache' | 'bistrolens';
  title: string;
  snippet: string;
  relevanceScore: number;
  tags: string[];
  sourceRef: string;
}

export interface KnowledgeQueryResult {
  query: string;
  results: KnowledgeResult[];
  totalFound: number;
  searchedSources: string[];
  durationMs: number;
}

interface KnowledgeBaseOptions {
  maxResults?: number;
  minScore?: number;
  includeVault?: boolean;
  includeDocsCache?: boolean;
}

// ============================================================================
// KnowledgeBase Class
// ============================================================================

class KnowledgeBase {
  private maxResults: number;
  private minScore: number;
  private includeVault: boolean;
  private includeDocsCache: boolean;

  constructor(options: KnowledgeBaseOptions = {}) {
    this.maxResults = options.maxResults ?? 10;
    this.minScore = options.minScore ?? 0.1;
    this.includeVault = options.includeVault ?? true;
    this.includeDocsCache = options.includeDocsCache ?? true;
  }

  async query(queryText: string): Promise<KnowledgeQueryResult> {
    const startTime = Date.now();

    // Validate query
    const trimmedQuery = queryText.trim();
    if (!trimmedQuery) {
      return {
        query: queryText,
        results: [],
        totalFound: 0,
        searchedSources: [],
        durationMs: 0,
      };
    }

    const searchedSources: string[] = [];
    const allResults: KnowledgeResult[] = [];

    // Run searches (vault is async due to potential semantic scoring)
    if (this.includeVault) {
      try {
        const vaultResults = await this.searchVault(trimmedQuery);
        allResults.push(...vaultResults);
        searchedSources.push('taste-vault');
      } catch (error) {
        console.warn('KnowledgeBase: vault search failed:', error);
      }
    }

    if (this.includeDocsCache) {
      try {
        const docsResults = this.searchDocsCache(trimmedQuery);
        allResults.push(...docsResults);
        searchedSources.push('docs-cache');
      } catch (error) {
        console.warn('KnowledgeBase: docs-cache search failed:', error);
      }
    }

    // Sort by relevance score descending
    allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Filter by minScore
    const filteredResults = allResults.filter(r => r.relevanceScore >= this.minScore);

    // Take top maxResults
    const finalResults = filteredResults.slice(0, this.maxResults);

    return {
      query: trimmedQuery,
      results: finalResults,
      totalFound: allResults.length,
      searchedSources,
      durationMs: Date.now() - startTime,
    };
  }

  private async searchVault(queryText: string): Promise<KnowledgeResult[]> {
    const results: KnowledgeResult[] = [];
    const graphMemory = getGraphMemory();

    // Get all nodes (we'll filter by relevance)
    const allNodes = graphMemory.search('');
    if (allNodes.length === 0) return results;

    // Get keyword scores for all nodes
    const scoredNodes: Array<{ node: GraphNode; keywordScore: number }> = [];
    for (const node of allNodes) {
      const text = node.content + ' ' + node.tags.join(' ');
      const keywordScore = this.keywordScore(queryText, text);
      if (keywordScore > 0) {
        scoredNodes.push({ node, keywordScore });
      }
    }

    // Sort by keyword score and take top 20 for semantic scoring
    scoredNodes.sort((a, b) => b.keywordScore - a.keywordScore);
    const topNodes = scoredNodes.slice(0, 20);

    // Try semantic scoring if available
    let useSemantic = false;
    let queryEmbedding: number[] | null = null;
    try {
      const dedup = getSemanticDedup();
      queryEmbedding = await dedup.getEmbedding(queryText);
      useSemantic = true;
    } catch {
      // Semantic scoring unavailable, use keyword only
    }

    // Calculate final scores
    for (const { node, keywordScore } of topNodes) {
      let finalScore = keywordScore;

      if (useSemantic && queryEmbedding) {
        try {
          const dedup = getSemanticDedup();
          const nodeEmbedding = await dedup.getEmbedding(node.content);
          const semanticScore = dedup.cosineSimilarity(queryEmbedding, nodeEmbedding);
          finalScore = 0.4 * keywordScore + 0.6 * semanticScore;
        } catch {
          // Fall back to keyword score
        }
      }

      const title = node.content.split('\n')[0].slice(0, 80);
      const source = node.userId === 'bistrolens-import' ? 'bistrolens' : 'taste-vault';

      results.push({
        source,
        title,
        snippet: node.content.slice(0, 300),
        relevanceScore: finalScore,
        tags: node.tags,
        sourceRef: `taste-vault:${node.id}`,
      });
    }

    return results;
  }

  private searchDocsCache(queryText: string): KnowledgeResult[] {
    const results: KnowledgeResult[] = [];
    const cacheDir = join(process.cwd(), '.nova', 'docs-cache');

    if (!existsSync(cacheDir)) {
      return results;
    }

    const scanDir = (dir: string): void => {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          try {
            const content = readFileSync(fullPath, 'utf-8');
            const parsed = JSON.parse(content);
            const validated = DocsCacheEntrySchema.safeParse(parsed);

            if (validated.success) {
              const entry = validated.data;
              const score = this.keywordScore(queryText, entry.content);

              if (score > 0) {
                const safeTopic = entry.topic ?? '_default';
                results.push({
                  source: 'docs-cache',
                  title: `${entry.library}${entry.topic ? ' / ' + entry.topic : ''} documentation`,
                  snippet: entry.content.slice(0, 300),
                  relevanceScore: score,
                  tags: [entry.library, entry.topic ?? 'general'].filter(Boolean),
                  sourceRef: `docs:${entry.library}/${safeTopic}`,
                });
              }
            }
          } catch {
            // Skip invalid cache entries
          }
        }
      }
    };

    scanDir(cacheDir);
    return results;
  }

  private keywordScore(query: string, text: string): number {
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length >= 3);

    if (queryWords.length === 0) return 0;

    const textLower = text.toLowerCase();
    let totalCount = 0;

    for (const word of queryWords) {
      const regex = new RegExp(word, 'g');
      const matches = textLower.match(regex);
      totalCount += matches?.length ?? 0;
    }

    if (text.length === 0) return 0;

    const score = (totalCount / text.length) * 1000;
    return Math.min(1, score);
  }

  formatForPrompt(result: KnowledgeQueryResult, maxTokens?: number): string {
    const maxChars = (maxTokens ?? 1500) * 4;

    let output = `=== Knowledge Base Results for: "${result.query}" ===\n`;
    output += `(${result.totalFound} results from ${result.searchedSources.join(', ')})\n\n`;

    for (let i = 0; i < result.results.length; i++) {
      const r = result.results[i];
      const entry = `[${i + 1}] ${r.title} [${r.source}] (score: ${r.relevanceScore.toFixed(2)})\n${r.snippet}\nTags: ${r.tags.join(', ')}\n\n`;

      // Check if adding this entry would exceed the limit
      if (output.length + entry.length > maxChars && i > 0) {
        output += '...[truncated]\n';
        break;
      }

      output += entry;
    }

    return output;
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let instance: KnowledgeBase | null = null;
let currentOptions: KnowledgeBaseOptions | undefined;

export function getKnowledgeBase(options?: KnowledgeBaseOptions): KnowledgeBase {
  // Create new instance if options changed or no instance exists
  if (!instance || JSON.stringify(options) !== JSON.stringify(currentOptions)) {
    instance = new KnowledgeBase(options);
    currentOptions = options;
  }
  return instance;
}

export function resetKnowledgeBase(): void {
  instance = null;
  currentOptions = undefined;
}

export { KnowledgeBase };
