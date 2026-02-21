// Perplexity Research Agent Tests
// Comprehensive test suite for multi-query research capabilities

import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import {
  PerplexityResearchAgent,
  registerPerplexityTools,
  type ResearchResult,
  type ComparisonResult,
  type FactCheckResult,
  type SummaryResult,
} from './perplexity-research-agent.js';
import { PerplexityClient, type SearchResult } from './perplexity-client.js';
import { resetToolRegistry } from '../tools/tool-registry.js';

describe('PerplexityResearchAgent', () => {
  let mockClient: PerplexityClient;
  let searchMock: MockInstance<typeof mockClient.search>;

  beforeEach(() => {
    vi.restoreAllMocks();
    resetToolRegistry();
    
    // Create a mock client
    mockClient = new PerplexityClient({ apiKey: 'test-key' });
    searchMock = vi.fn() as unknown as MockInstance<typeof mockClient.search>;
    mockClient.search = searchMock;
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Constructor Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('creates agent with provided client', () => {
      const agent = new PerplexityResearchAgent(mockClient);
      expect(agent).toBeInstanceOf(PerplexityResearchAgent);
    });

    it('creates agent without client (uses env)', () => {
      process.env.PERPLEXITY_API_KEY = 'env-key';
      const agent = new PerplexityResearchAgent();
      expect(agent).toBeInstanceOf(PerplexityResearchAgent);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // researchTopic Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('researchTopic', () => {
    const mockSearchResult: SearchResult = {
      answer: 'This is a research answer',
      citations: [{ title: 'Source', url: 'https://example.com' }],
      confidence: 0.85,
      model: 'sonar',
      tokensUsed: 100,
    };

    it('researches topic with shallow depth (1 query)', async () => {
      searchMock.mockResolvedValue(mockSearchResult);

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.researchTopic('test topic', 'shallow');

      expect(searchMock).toHaveBeenCalledTimes(1);
      expect(result.topic).toBe('test topic');
      expect(result.findings).toHaveLength(1);
    });

    it('researches topic with medium depth (3 queries)', async () => {
      searchMock.mockResolvedValue(mockSearchResult);

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.researchTopic('test topic', 'medium');

      expect(searchMock).toHaveBeenCalledTimes(3);
      expect(result.findings).toHaveLength(3);
    });

    it('researches topic with deep depth (5 queries)', async () => {
      searchMock.mockResolvedValue(mockSearchResult);

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.researchTopic('test topic', 'deep');

      expect(searchMock).toHaveBeenCalledTimes(5);
      expect(result.findings).toHaveLength(5);
    });

    it('returns research result with correct structure', async () => {
      searchMock.mockResolvedValue(mockSearchResult);

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.researchTopic('test topic', 'shallow');

      expect(result).toHaveProperty('topic');
      expect(result).toHaveProperty('findings');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('totalTokensUsed');
    });

    it('calculates overall confidence from findings', async () => {
      searchMock.mockResolvedValue(mockSearchResult);

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.researchTopic('test topic', 'medium');

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('tracks token usage across multiple queries', async () => {
      searchMock.mockResolvedValue({ ...mockSearchResult, tokensUsed: 100 });

      const agent = new PerplexityResearchAgent(mockClient);
      await agent.researchTopic('test topic', 'medium');

      expect(result.totalTokensUsed).toBeGreaterThan(0);
    });

    it('handles partial failures gracefully', async () => {
      searchMock
        .mockResolvedValueOnce(mockSearchResult)
        .mockRejectedValueOnce(new Error('Query failed'))
        .mockResolvedValueOnce(mockSearchResult);

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.researchTopic('test topic', 'medium');

      expect(result.findings).toHaveLength(2);
      expect(result.partialFailure).toBe(true);
      expect(result.warnings).toHaveLength(1);
    });

    it('throws when all queries fail', async () => {
      searchMock.mockRejectedValue(new Error('All queries failed'));

      const agent = new PerplexityResearchAgent(mockClient);
      await expect(agent.researchTopic('test topic', 'medium')).rejects.toThrow();
    });

    it('validates topic is not empty', async () => {
      const agent = new PerplexityResearchAgent(mockClient);
      await expect(agent.researchTopic('', 'shallow')).rejects.toThrow('Topic');
    });

    it('validates topic is not whitespace', async () => {
      const agent = new PerplexityResearchAgent(mockClient);
      await expect(agent.researchTopic('   ', 'shallow')).rejects.toThrow('Topic');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // compareOptions Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('compareOptions', () => {
    const mockComparisonResult: SearchResult = {
      answer: 'Score: 85/100. This option performs well due to its features.',
      citations: [{ title: 'Comparison Source', url: 'https://example.com' }],
      confidence: 0.8,
      model: 'sonar',
      tokensUsed: 150,
    };

    it('compares multiple options against criteria', async () => {
      searchMock.mockResolvedValue(mockComparisonResult);

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.compareOptions(
        ['Option A', 'Option B'],
        ['Performance', 'Cost']
      );

      // 2 options × 2 criteria = 4 queries
      expect(searchMock).toHaveBeenCalledTimes(4);
      expect(result.options).toEqual(['Option A', 'Option B']);
      expect(result.criteria).toEqual(['Performance', 'Cost']);
    });

    it('returns comparison matrix', async () => {
      searchMock.mockResolvedValue(mockComparisonResult);

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.compareOptions(
        ['Option A', 'Option B'],
        ['Criterion 1']
      );

      expect(result.matrix.has('Option A')).toBe(true);
      expect(result.matrix.has('Option B')).toBe(true);
      expect(result.matrix.get('Option A')!.has('Criterion 1')).toBe(true);
    });

    it('extracts scores from answers', async () => {
      searchMock.mockResolvedValue(mockComparisonResult);

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.compareOptions(
        ['Option A'],
        ['Criterion 1']
      );

      const criterionResult = result.matrix.get('Option A')!.get('Criterion 1')!;
      expect(criterionResult.score).toBe(85);
    });

    it('determines winner from matrix', async () => {
      searchMock
        .mockResolvedValueOnce({ ...mockComparisonResult, answer: 'Score: 90/100' })
        .mockResolvedValueOnce({ ...mockComparisonResult, answer: 'Score: 70/100' });

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.compareOptions(
        ['Winner', 'Loser'],
        ['Criterion 1']
      );

      expect(result.winner).toBe('Winner');
    });

    it('calculates comparison confidence', async () => {
      searchMock.mockResolvedValue(mockComparisonResult);

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.compareOptions(
        ['Option A', 'Option B'],
        ['Criterion 1']
      );

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('handles partial failures in comparison', async () => {
      searchMock
        .mockResolvedValueOnce(mockComparisonResult)
        .mockRejectedValueOnce(new Error('Failed'));

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.compareOptions(
        ['Option A', 'Option B'],
        ['Criterion 1']
      );

      expect(result.warnings).toHaveLength(1);
      // Should still have entries for failed comparisons
      expect(result.matrix.get('Option B')!.get('Criterion 1')!.score).toBe(0);
    });

    it('requires at least 2 options', async () => {
      const agent = new PerplexityResearchAgent(mockClient);
      await expect(agent.compareOptions(['Single'], ['Criterion'])).rejects.toThrow('at least 2');
    });

    it('validates options array is not empty', async () => {
      const agent = new PerplexityResearchAgent(mockClient);
      await expect(agent.compareOptions([], ['Criterion'])).rejects.toThrow('Options');
    });

    it('validates criteria array is not empty', async () => {
      const agent = new PerplexityResearchAgent(mockClient);
      await expect(agent.compareOptions(['A', 'B'], [])).rejects.toThrow('Criteria');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // factCheck Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('factCheck', () => {
    const mockFactCheckResult: SearchResult = {
      answer: 'This claim is true. Multiple sources confirm it.',
      citations: [
        { title: 'Source 1', url: 'https://source1.com' },
        { title: 'Source 2', url: 'https://source2.com' },
      ],
      confidence: 0.9,
      model: 'sonar',
      tokensUsed: 120,
    };

    it('fact-checks a claim', async () => {
      searchMock.mockResolvedValue(mockFactCheckResult);

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.factCheck('The sky is blue');

      expect(result.claim).toBe('The sky is blue');
      expect(result.verified).toBe(true);
      expect(result.evidence).toHaveLength(2);
    });

    it('returns reasoning with result', async () => {
      searchMock.mockResolvedValue(mockFactCheckResult);

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.factCheck('test claim');

      expect(result.reasoning).toBe(mockFactCheckResult.answer);
    });

    it('returns confidence score', async () => {
      searchMock.mockResolvedValue(mockFactCheckResult);

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.factCheck('test claim');

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('tracks token usage', async () => {
      searchMock.mockResolvedValue(mockFactCheckResult);

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.factCheck('test claim');

      expect(result.tokensUsed).toBe(120);
    });

    it('determines false claims', async () => {
      searchMock.mockResolvedValue({
        ...mockFactCheckResult,
        answer: 'This claim is false. Evidence contradicts it.',
      });

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.factCheck('false claim');

      expect(result.verified).toBe(false);
    });

    it('validates claim is not empty', async () => {
      const agent = new PerplexityResearchAgent(mockClient);
      await expect(agent.factCheck('')).rejects.toThrow('Claim');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // summarizeFindings Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('summarizeFindings', () => {
    const mockSummaryResult: SearchResult = {
      answer: 'Key finding: This is important. Another point: This matters too.',
      citations: [{ title: 'Source', url: 'https://example.com' }],
      confidence: 0.8,
      model: 'sonar',
      tokensUsed: 200,
    };

    it('batch researches multiple queries', async () => {
      searchMock.mockResolvedValue(mockSummaryResult);

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.summarizeFindings([
        'Query 1',
        'Query 2',
        'Query 3',
      ]);

      expect(searchMock).toHaveBeenCalledTimes(3);
      expect(result.queries).toHaveLength(3);
    });

    it('returns structured summary', async () => {
      searchMock.mockResolvedValue(mockSummaryResult);

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.summarizeFindings(['Query 1']);

      expect(result.structuredSummary).toHaveProperty('overview');
      expect(result.structuredSummary).toHaveProperty('keyPoints');
      expect(result.structuredSummary).toHaveProperty('consensus');
      expect(result.structuredSummary).toHaveProperty('contradictions');
      expect(result.structuredSummary).toHaveProperty('gaps');
      expect(result.structuredSummary).toHaveProperty('confidence');
    });

    it('extracts key points from findings', async () => {
      searchMock.mockResolvedValue(mockSummaryResult);

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.summarizeFindings(['Query 1']);

      expect(result.structuredSummary.keyPoints.length).toBeGreaterThan(0);
    });

    it('calculates summary confidence', async () => {
      searchMock.mockResolvedValue(mockSummaryResult);

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.summarizeFindings(['Query 1']);

      expect(result.structuredSummary.confidence).toBeGreaterThan(0);
    });

    it('handles partial failures in batch', async () => {
      searchMock
        .mockResolvedValueOnce(mockSummaryResult)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(mockSummaryResult);

      const agent = new PerplexityResearchAgent(mockClient);
      const result = await agent.summarizeFindings(['Q1', 'Q2', 'Q3']);

      expect(result.warnings).toHaveLength(1);
      // Should still provide summary with successful queries
      expect(result.structuredSummary.overview).toBeDefined();
    });

    it('throws when all queries fail', async () => {
      searchMock.mockRejectedValue(new Error('All failed'));

      const agent = new PerplexityResearchAgent(mockClient);
      await expect(agent.summarizeFindings(['Q1', 'Q2'])).rejects.toThrow('All queries failed');
    });

    it('validates queries array is not empty', async () => {
      const agent = new PerplexityResearchAgent(mockClient);
      await expect(agent.summarizeFindings([])).rejects.toThrow('Queries');
    });

    it('validates queries is an array', async () => {
      const agent = new PerplexityResearchAgent(mockClient);
      await expect(agent.summarizeFindings('not an array' as unknown as string[])).rejects.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Token Usage Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('token usage tracking', () => {
    const mockResult: SearchResult = {
      answer: 'Answer',
      citations: [],
      confidence: 0.8,
      model: 'sonar',
      tokensUsed: 100,
    };

    it('tracks token usage across operations', async () => {
      searchMock.mockResolvedValue(mockResult);

      const agent = new PerplexityResearchAgent(mockClient);
      
      expect(agent.getTokenUsage().totalTokens).toBe(0);
      
      await agent.researchTopic('topic', 'shallow');
      expect(agent.getTokenUsage().totalTokens).toBe(100);
      
      await agent.factCheck('claim');
      expect(agent.getTokenUsage().totalTokens).toBe(200);
    });

    it('resets token usage', async () => {
      searchMock.mockResolvedValue(mockResult);

      const agent = new PerplexityResearchAgent(mockClient);
      await agent.researchTopic('topic', 'shallow');
      
      expect(agent.getTokenUsage().totalTokens).toBeGreaterThan(0);
      
      agent.resetTokenUsage();
      expect(agent.getTokenUsage().totalTokens).toBe(0);
    });

    it('tracks call count', async () => {
      searchMock.mockResolvedValue(mockResult);

      const agent = new PerplexityResearchAgent(mockClient);
      await agent.researchTopic('topic', 'medium'); // 3 queries
      
      expect(agent.getTokenUsage().calls).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Tool Registration Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('tool registration', () => {
    const mockResult: SearchResult = {
      answer: 'Answer',
      citations: [],
      confidence: 0.8,
      model: 'sonar',
      tokensUsed: 100,
    };

    beforeEach(() => {
      searchMock.mockResolvedValue(mockResult);
    });

    it('registers all Perplexity tools', async () => {
      const agent = new PerplexityResearchAgent(mockClient);
      registerPerplexityTools(agent);

      const { getToolRegistry } = await import('../tools/tool-registry.js');
      const registry = getToolRegistry();

      expect(registry.get('perplexityResearchTopic')).toBeDefined();
      expect(registry.get('perplexityCompareOptions')).toBeDefined();
      expect(registry.get('perplexityFactCheck')).toBeDefined();
      expect(registry.get('perplexitySummarizeFindings')).toBeDefined();
    });

    it('research topic tool executes successfully', async () => {
      const agent = new PerplexityResearchAgent(mockClient);
      registerPerplexityTools(agent);

      const { getToolRegistry } = await import('../tools/tool-registry.js');
      const registry = getToolRegistry();
      const tool = registry.get('perplexityResearchTopic')!;

      const result = await tool.execute({ topic: 'test', depth: 'shallow' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('test');
    });

    it('compare options tool executes successfully', async () => {
      const agent = new PerplexityResearchAgent(mockClient);
      registerPerplexityTools(agent);

      const { getToolRegistry } = await import('../tools/tool-registry.js');
      const registry = getToolRegistry();
      const tool = registry.get('perplexityCompareOptions')!;

      const result = await tool.execute({ 
        options: ['A', 'B'], 
        criteria: ['cost'] 
      });

      expect(result.success).toBe(true);
    });

    it('fact check tool executes successfully', async () => {
      const agent = new PerplexityResearchAgent(mockClient);
      registerPerplexityTools(agent);

      const { getToolRegistry } = await import('../tools/tool-registry.js');
      const registry = getToolRegistry();
      const tool = registry.get('perplexityFactCheck')!;

      const result = await tool.execute({ claim: 'test claim' });

      expect(result.success).toBe(true);
    });

    it('summarize findings tool executes successfully', async () => {
      const agent = new PerplexityResearchAgent(mockClient);
      registerPerplexityTools(agent);

      const { getToolRegistry } = await import('../tools/tool-registry.js');
      const registry = getToolRegistry();
      const tool = registry.get('perplexitySummarizeFindings')!;

      const result = await tool.execute({ queries: ['query1', 'query2'] });

      expect(result.success).toBe(true);
    });
  });
});
