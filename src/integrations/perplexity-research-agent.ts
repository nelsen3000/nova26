// Perplexity Research Agent - High-level research capabilities
// Wraps PerplexityClient to provide multi-query research workflows

import {
  PerplexityClient,
  SearchResult,
  Citation,
  SearchOptions,
} from './perplexity-client.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type ResearchDepth = 'shallow' | 'medium' | 'deep';

export interface ResearchOptions {
  depth?: ResearchDepth;
  maxTokensPerQuery?: number;
  temperature?: number;
  searchDomain?: string[];
  returnCitations?: boolean;
  searchRecency?: 'day' | 'week' | 'month' | 'year';
}

export interface ResearchResult {
  topic: string;
  findings: Finding[];
  summary: string;
  confidence: number;
  totalTokensUsed: number;
  partialFailure?: boolean;
  warnings?: string[];
}

export interface Finding {
  query: string;
  answer: string;
  citations: Citation[];
  confidence: number;
  tokensUsed: number;
}

export interface ComparisonResult {
  options: string[];
  criteria: string[];
  matrix: ComparisonMatrix;
  winner?: string;
  confidence: number;
  totalTokensUsed: number;
  warnings?: string[];
}

export type ComparisonMatrix = Map<string, Map<string, CriterionResult>>;

export interface CriterionResult {
  score: number; // 0-100
  reasoning: string;
  citations: Citation[];
}

export interface FactCheckResult {
  claim: string;
  verified: boolean;
  confidence: number;
  evidence: Citation[];
  reasoning: string;
  tokensUsed: number;
}

export interface SummaryResult {
  queries: string[];
  structuredSummary: StructuredSummary;
  totalTokensUsed: number;
  warnings?: string[];
}

export interface StructuredSummary {
  overview: string;
  keyPoints: string[];
  consensus: string;
  contradictions: string[];
  gaps: string[];
  confidence: number;
}

export interface TokenUsage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PerplexityResearchAgent Class
// ═══════════════════════════════════════════════════════════════════════════════

export class PerplexityResearchAgent {
  private client: PerplexityClient;
  private tokenUsage: TokenUsage;

  constructor(client?: PerplexityClient) {
    this.client = client ?? new PerplexityClient({
      apiKey: process.env.PERPLEXITY_API_KEY ?? '',
    });
    this.tokenUsage = {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
  }

  /**
   * Research a topic with configurable depth
   * - shallow: 1 query
   * - medium: 3 queries with follow-ups
   * - deep: 5 queries with synthesis
   */
  async researchTopic(topic: string, depth: ResearchDepth = 'medium'): Promise<ResearchResult> {
    this.validateInput(topic, 'Topic');

    const findings: Finding[] = [];
    const warnings: string[] = [];

    // Generate queries based on depth
    const queries = this.generateResearchQueries(topic, depth);

    // Execute queries with graceful failure handling
    for (const query of queries) {
      try {
        const result = await this.executeQuery(query);
        findings.push({
          query,
          answer: result.answer,
          citations: result.citations,
          confidence: result.confidence,
          tokensUsed: result.tokensUsed,
        });
        this.trackTokenUsage(result.tokensUsed);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        warnings.push(`Query "${query.slice(0, 50)}..." failed: ${errorMsg}`);
        // Continue with other queries
      }
    }

    if (findings.length === 0) {
      throw new Error(`All research queries failed for topic: ${topic}`);
    }

    // Synthesize findings
    const summary = await this.synthesizeFindings(findings, topic);
    const overallConfidence = this.calculateOverallConfidence(findings);

    return {
      topic,
      findings,
      summary,
      confidence: overallConfidence,
      totalTokensUsed: this.tokenUsage.totalTokens,
      partialFailure: warnings.length > 0,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Compare multiple options against criteria
   */
  async compareOptions(
    options: string[],
    criteria: string[]
  ): Promise<ComparisonResult> {
    this.validateInput(options, 'Options');
    this.validateInput(criteria, 'Criteria');

    if (options.length < 2) {
      throw new Error('At least 2 options are required for comparison');
    }

    const matrix: ComparisonMatrix = new Map();
    const warnings: string[] = [];

    // Initialize matrix
    for (const option of options) {
      matrix.set(option, new Map());
    }

    // Research each option against each criterion
    for (const option of options) {
      for (const criterion of criteria) {
        try {
          const query = `Compare "${option}" against the criterion "${criterion}". Provide a score 0-100 and detailed reasoning.`;
          const result = await this.executeQuery(query);
          this.trackTokenUsage(result.tokensUsed);

          const score = this.extractScore(result.answer);
          matrix.get(option)!.set(criterion, {
            score,
            reasoning: result.answer,
            citations: result.citations,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          warnings.push(`Failed to compare "${option}" against "${criterion}": ${errorMsg}`);
          matrix.get(option)!.set(criterion, {
            score: 0,
            reasoning: 'Failed to evaluate',
            citations: [],
          });
        }
      }
    }

    // Determine winner
    const winner = this.determineWinner(matrix, options, criteria);
    const confidence = this.calculateComparisonConfidence(matrix, options, criteria);

    return {
      options,
      criteria,
      matrix,
      winner,
      confidence,
      totalTokensUsed: this.tokenUsage.totalTokens,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Fact-check a claim with citations
   */
  async factCheck(claim: string): Promise<FactCheckResult> {
    this.validateInput(claim, 'Claim');

    const query = `Fact-check this claim: "${claim}". Is it true, false, or uncertain? Provide evidence and explain your reasoning.`;
    
    const result = await this.executeQuery(query);
    this.trackTokenUsage(result.tokensUsed);

    const verified = this.determineVerification(result.answer);
    const confidence = this.extractConfidence(result.answer) * result.confidence;

    return {
      claim,
      verified,
      confidence,
      evidence: result.citations,
      reasoning: result.answer,
      tokensUsed: result.tokensUsed,
    };
  }

  /**
   * Batch research and synthesize findings
   */
  async summarizeFindings(queries: string[]): Promise<SummaryResult> {
    this.validateInput(queries, 'Queries');

    if (queries.length === 0) {
      throw new Error('At least one query is required');
    }

    const findings: Finding[] = [];
    const warnings: string[] = [];

    // Execute all queries
    for (const query of queries) {
      try {
        const result = await this.executeQuery(query);
        findings.push({
          query,
          answer: result.answer,
          citations: result.citations,
          confidence: result.confidence,
          tokensUsed: result.tokensUsed,
        });
        this.trackTokenUsage(result.tokensUsed);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        warnings.push(`Query "${query.slice(0, 50)}..." failed: ${errorMsg}`);
      }
    }

    if (findings.length === 0) {
      throw new Error('All queries failed');
    }

    // Synthesize structured summary
    const structuredSummary = await this.createStructuredSummary(findings);

    return {
      queries,
      structuredSummary,
      totalTokensUsed: this.tokenUsage.totalTokens,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Get current token usage
   */
  getTokenUsage(): TokenUsage {
    return { ...this.tokenUsage };
  }

  /**
   * Reset token usage counter
   */
  resetTokenUsage(): void {
    this.tokenUsage = {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════════

  private validateInput(input: string | unknown[], name: string): void {
    if (input === undefined || input === null) {
      throw new Error(`${name} is required`);
    }
    if (Array.isArray(input) && input.length === 0) {
      throw new Error(`${name} cannot be empty`);
    }
    if (typeof input === 'string' && input.trim() === '') {
      throw new Error(`${name} cannot be empty`);
    }
  }

  private generateResearchQueries(topic: string, depth: ResearchDepth): string[] {
    const baseQuery = `Research: ${topic}`;

    switch (depth) {
      case 'shallow':
        return [baseQuery];

      case 'medium':
        return [
          baseQuery,
          `What are the key aspects and considerations for ${topic}?`,
          `What are the latest developments or trends in ${topic}?`,
        ];

      case 'deep':
        return [
          baseQuery,
          `What are the fundamental concepts and principles of ${topic}?`,
          `What are the current best practices for ${topic}?`,
          `What are the common challenges and solutions in ${topic}?`,
          `What are the future prospects and emerging trends for ${topic}?`,
        ];

      default:
        return [baseQuery];
    }
  }

  private async executeQuery(query: string): Promise<SearchResult> {
    const options: SearchOptions = {
      maxTokens: 1024,
      temperature: 0.7,
      returnCitations: true,
    };

    return this.client.search(query, options);
  }

  private async synthesizeFindings(findings: Finding[], topic: string): Promise<string> {
    // Simple synthesis - in production, this could use another LLM call
    const parts: string[] = [];
    parts.push(`Research on "${topic}":\n`);

    for (const finding of findings) {
      parts.push(`\n${finding.query}:`);
      parts.push(finding.answer);
    }

    parts.push(`\n\nOverall confidence: ${(this.calculateOverallConfidence(findings) * 100).toFixed(1)}%`);

    return parts.join('\n');
  }

  private async createStructuredSummary(findings: Finding[]): Promise<StructuredSummary> {
    // Combine all findings
    const combinedText = findings.map(f => f.answer).join('\n\n');

    // Extract key points (simple extraction)
    const sentences = combinedText.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const keyPoints = sentences.slice(0, 5).map(s => s.trim());

    // Calculate overall confidence
    const avgConfidence = findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length;

    return {
      overview: findings[0]?.answer.slice(0, 200) + '...' ?? 'No overview available',
      keyPoints,
      consensus: this.extractConsensus(findings),
      contradictions: this.extractContradictions(findings),
      gaps: this.identifyGaps(findings),
      confidence: avgConfidence,
    };
  }

  private calculateOverallConfidence(findings: Finding[]): number {
    if (findings.length === 0) return 0;
    const avgConfidence = findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length;
    // Boost confidence slightly for multiple corroborating sources
    const sourceBoost = Math.min(findings.length * 0.02, 0.1);
    return Math.min(avgConfidence + sourceBoost, 1);
  }

  private extractScore(answer: string): number {
    // Try to find a score 0-100 in the answer
    const scoreMatch = answer.match(/\b(\d{1,3})\s*(?:\/|out of)\s*100\b/i);
    if (scoreMatch) {
      return Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10)));
    }

    // Try to find just a number that could be a score
    const numberMatch = answer.match(/\b(\d{1,3})\b/);
    if (numberMatch) {
      const num = parseInt(numberMatch[1], 10);
      if (num >= 0 && num <= 100) {
        return num;
      }
    }

    // Default to 50 if no score found
    return 50;
  }

  private extractConfidence(answer: string): number {
    // Look for confidence indicators
    const lower = answer.toLowerCase();
    if (lower.includes('certain') || lower.includes('definitely')) return 0.9;
    if (lower.includes('likely') || lower.includes('probably')) return 0.7;
    if (lower.includes('uncertain') || lower.includes('unclear')) return 0.5;
    if (lower.includes('unlikely')) return 0.3;
    return 0.6; // Default
  }

  private determineVerification(answer: string): boolean {
    const lower = answer.toLowerCase();
    // Check for clear true/false indicators
    if (lower.includes('true') && !lower.includes('false')) return true;
    if (lower.includes('false') && !lower.includes('true')) return false;
    if (lower.includes('verified') || lower.includes('correct')) return true;
    if (lower.includes('incorrect') || lower.includes('untrue')) return false;
    // Uncertain by default
    return false;
  }

  private determineWinner(
    matrix: ComparisonMatrix,
    options: string[],
    criteria: string[]
  ): string | undefined {
    let bestOption: string | undefined;
    let bestScore = -1;

    for (const option of options) {
      const optionMatrix = matrix.get(option)!;
      let totalScore = 0;
      let count = 0;

      for (const criterion of criteria) {
        const result = optionMatrix.get(criterion);
        if (result) {
          totalScore += result.score;
          count++;
        }
      }

      const avgScore = count > 0 ? totalScore / count : 0;
      if (avgScore > bestScore) {
        bestScore = avgScore;
        bestOption = option;
      }
    }

    return bestOption;
  }

  private calculateComparisonConfidence(
    matrix: ComparisonMatrix,
    options: string[],
    criteria: string[]
  ): number {
    let totalCells = 0;
    let successfulCells = 0;

    for (const option of options) {
      for (const criterion of criteria) {
        totalCells++;
        const result = matrix.get(option)?.get(criterion);
        if (result && result.reasoning !== 'Failed to evaluate') {
          successfulCells++;
        }
      }
    }

    return totalCells > 0 ? successfulCells / totalCells : 0;
  }

  private extractConsensus(findings: Finding[]): string {
    // Simple consensus extraction
    const commonTerms = this.findCommonTerms(findings.map(f => f.answer));
    if (commonTerms.length > 0) {
      return `Multiple sources agree on: ${commonTerms.slice(0, 3).join(', ')}`;
    }
    return 'No clear consensus identified';
  }

  private extractContradictions(findings: Finding[]): string[] {
    // Simplified contradiction detection
    const contradictions: string[] = [];
    const answers = findings.map(f => f.answer.toLowerCase());

    // Check for common contradiction patterns
    const hasPositive = answers.some(a => a.includes('beneficial') || a.includes('advantage'));
    const hasNegative = answers.some(a => a.includes('problem') || a.includes('disadvantage'));

    if (hasPositive && hasNegative) {
      contradictions.push('Sources show mixed perspectives on benefits vs problems');
    }

    return contradictions;
  }

  private identifyGaps(findings: Finding[]): string[] {
    const gaps: string[] = [];
    const combinedText = findings.map(f => f.answer).join(' ').toLowerCase();

    // Check for common gap indicators
    if (!combinedText.includes('example') && !combinedText.includes('case study')) {
      gaps.push('Limited concrete examples or case studies');
    }
    if (!combinedText.includes('statistic') && !combinedText.includes('data')) {
      gaps.push('Lack of quantitative data or statistics');
    }
    if (!combinedText.includes('recent') && !combinedText.includes('202')) {
      gaps.push('May not include most recent developments');
    }

    return gaps;
  }

  private findCommonTerms(texts: string[]): string[] {
    // Simple term extraction
    const termCounts = new Map<string, number>();
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been']);

    for (const text of texts) {
      const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
      const uniqueWords = new Set(words);
      for (const word of uniqueWords) {
        if (!stopWords.has(word)) {
          termCounts.set(word, (termCounts.get(word) || 0) + 1);
        }
      }
    }

    // Return terms that appear in multiple findings
    return Array.from(termCounts.entries())
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .map(([term]) => term);
  }

  private trackTokenUsage(tokens: number): void {
    this.tokenUsage.calls++;
    this.tokenUsage.totalTokens += tokens;
    // Estimate input/output split (rough approximation)
    this.tokenUsage.inputTokens += Math.floor(tokens * 0.3);
    this.tokenUsage.outputTokens += Math.floor(tokens * 0.7);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool Registration
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod';
import { getToolRegistry, type Tool } from '../tools/tool-registry.js';

const ResearchTopicSchema = z.object({
  topic: z.string().describe('The topic to research'),
  depth: z.enum(['shallow', 'medium', 'deep']).optional().describe('Research depth level'),
});

const CompareOptionsSchema = z.object({
  options: z.array(z.string()).describe('Options to compare'),
  criteria: z.array(z.string()).describe('Criteria to compare against'),
});

const FactCheckSchema = z.object({
  claim: z.string().describe('The claim to fact-check'),
});

const SummarizeFindingsSchema = z.object({
  queries: z.array(z.string()).describe('Queries to research and summarize'),
});

/**
 * Register Perplexity research tools with the tool registry
 */
export function registerPerplexityTools(agent?: PerplexityResearchAgent): void {
  const researchAgent = agent ?? new PerplexityResearchAgent();
  const registry = getToolRegistry();

  const researchTopicTool: Tool = {
    name: 'perplexityResearchTopic',
    description: 'Research a topic using Perplexity AI with configurable depth (shallow/medium/deep)',
    parameters: ResearchTopicSchema,
    allowedAgents: [], // All agents can use
    blockedAgents: [],
    mutating: false,
    timeout: 60000,
    execute: async (args: Record<string, unknown>) => {
      const { topic, depth } = ResearchTopicSchema.parse(args);
      const result = await researchAgent.researchTopic(topic, depth);
      return {
        success: true,
        output: JSON.stringify(result, null, 2),
        duration: 0,
        truncated: false,
      };
    },
  };

  const compareOptionsTool: Tool = {
    name: 'perplexityCompareOptions',
    description: 'Compare multiple options against criteria using Perplexity AI',
    parameters: CompareOptionsSchema,
    allowedAgents: [],
    blockedAgents: [],
    mutating: false,
    timeout: 90000,
    execute: async (args: Record<string, unknown>) => {
      const { options, criteria } = CompareOptionsSchema.parse(args);
      const result = await researchAgent.compareOptions(options, criteria);
      return {
        success: true,
        output: JSON.stringify(result, null, 2),
        duration: 0,
        truncated: false,
      };
    },
  };

  const factCheckTool: Tool = {
    name: 'perplexityFactCheck',
    description: 'Fact-check a claim using Perplexity AI with citations',
    parameters: FactCheckSchema,
    allowedAgents: [],
    blockedAgents: [],
    mutating: false,
    timeout: 30000,
    execute: async (args: Record<string, unknown>) => {
      const { claim } = FactCheckSchema.parse(args);
      const result = await researchAgent.factCheck(claim);
      return {
        success: true,
        output: JSON.stringify(result, null, 2),
        duration: 0,
        truncated: false,
      };
    },
  };

  const summarizeFindingsTool: Tool = {
    name: 'perplexitySummarizeFindings',
    description: 'Batch research multiple queries and synthesize findings',
    parameters: SummarizeFindingsSchema,
    allowedAgents: [],
    blockedAgents: [],
    mutating: false,
    timeout: 120000,
    execute: async (args: Record<string, unknown>) => {
      const { queries } = SummarizeFindingsSchema.parse(args);
      const result = await researchAgent.summarizeFindings(queries);
      return {
        success: true,
        output: JSON.stringify(result, null, 2),
        duration: 0,
        truncated: false,
      };
    },
  };

  registry.register(researchTopicTool);
  registry.register(compareOptionsTool);
  registry.register(factCheckTool);
  registry.register(summarizeFindingsTool);
}
