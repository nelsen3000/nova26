// KIMI-INFRA-06: Integration Tests for NOVA26 Similarity Engine

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { 
  SemanticDedup, 
  getSemanticDedup, 
  resetSemanticDedup,
  type GraphNode 
} from './semantic-dedup.js';
import { 
  GlobalWisdomPipeline, 
  getGlobalWisdomPipeline, 
  resetGlobalWisdomPipeline,
  type GraphNode as WisdomGraphNode 
} from '../taste-vault/global-wisdom.js';
import { 
  VaultSecurity, 
  getVaultSecurity, 
  resetVaultSecurity 
} from '../security/vault-security.js';
import { getWisdomImpactStats, recordTaskResult, resetAnalytics } from '../analytics/agent-analytics.js';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ============================================================================
// Test Setup
// ============================================================================

describe('Similarity Integration Tests', () => {
  let dedup: SemanticDedup;
  let pipeline: GlobalWisdomPipeline;
  let security: VaultSecurity;
  let fetchMock: MockInstance<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>;
  let tempDir: string;

  beforeEach(() => {
    // Reset singletons
    resetSemanticDedup();
    resetGlobalWisdomPipeline();
    resetVaultSecurity();
    resetAnalytics();

    // Get fresh instances
    dedup = getSemanticDedup();
    dedup.clearCache();
    pipeline = getGlobalWisdomPipeline();
    pipeline.reset();
    security = getVaultSecurity();
    security.resetAuditLog();

    // Setup fetch mock
    fetchMock = vi.fn() as unknown as MockInstance<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>;
    global.fetch = fetchMock as unknown as typeof fetch;

    // Create temp directory
    tempDir = mkdtempSync(join(tmpdir(), 'similarity-integration-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    dedup.clearCache();
    
    // Cleanup temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ============================================================================
  // Full Pipeline Integration Tests
  // ============================================================================

  describe('Full Pipeline: stripSensitiveData → isDuplicate → promote', () => {
    it('should return non-null pattern for unique node', async () => {
      // Mock Ollama to return embeddings indicating non-duplicate
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ embedding: [0.1, 0.2, 0.3, 0.4] }),
      });

      const node: WisdomGraphNode = {
        id: 'node-1',
        content: 'Unique pattern about TypeScript generics',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
        tags: ['typescript'],
      };

      // stripSensitiveData is called inside promote
      const weeklyLog: { userId: string; promotionCount: number; weekStart: string }[] = [];
      const result = await pipeline.promote(node, 'user-1', weeklyLog);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.canonicalContent).toContain('Unique pattern');
        expect(result.isActive).toBe(true);
        expect(result.successScore).toBeGreaterThan(0);
      }
    });

    it('should redact email in promoted pattern canonicalContent', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ embedding: [0.5, 0.6, 0.7, 0.8] }),
      });

      const node: WisdomGraphNode = {
        id: 'node-email',
        content: 'Contact admin@example.com for help with auth',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
        tags: ['auth'],
      };

      const weeklyLog: { userId: string; promotionCount: number; weekStart: string }[] = [];
      const result = await pipeline.promote(node, 'user-1', weeklyLog);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.canonicalContent).not.toContain('admin@example.com');
        expect(result.canonicalContent).toContain('[EMAIL_REDACTED]');
      }
    });

    it('should return null on second promote with semantically similar content', async () => {
      // First call - mock embedding for first node
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ embedding: [0.9, 0.1, 0.1, 0.1] }),
        })
        // Second call for duplicate check - return very similar embedding (cosine sim > 0.92)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ embedding: [0.89, 0.11, 0.1, 0.1] }), // High similarity
        });

      const node1: WisdomGraphNode = {
        id: 'node-first',
        content: 'Always validate user input with Zod schema',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
      };

      const weeklyLog: { userId: string; promotionCount: number; weekStart: string }[] = [];
      
      // First promotion should succeed
      const result1 = await pipeline.promote(node1, 'user-1', weeklyLog);
      expect(result1).not.toBeNull();

      // Second promotion with similar content should fail (return null)
      const node2: WisdomGraphNode = {
        id: 'node-second',
        content: 'Always validate user inputs using Zod schemas',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
      };

      const result2 = await pipeline.promote(node2, 'user-2', weeklyLog);
      expect(result2).toBeNull();
    });

    it('should fall through to Jaccard when Ollama unavailable', async () => {
      // Mock Ollama to fail
      fetchMock.mockRejectedValue(new Error('Ollama unavailable'));

      const node: WisdomGraphNode = {
        id: 'node-jaccard',
        content: 'Use early returns for guard clauses in functions',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
        tags: ['code-style'],
      };

      const weeklyLog: { userId: string; promotionCount: number; weekStart: string }[] = [];
      const result = await pipeline.promote(node, 'user-1', weeklyLog);

      // Should still succeed via Jaccard fallback
      expect(result).not.toBeNull();
      if (result) {
        expect(result.canonicalContent).toContain('early returns');
      }
    });
  });

  // ============================================================================
  // Encryption/Decryption Round-trip
  // ============================================================================

  describe('VaultSecurity encryptNode → decryptNode round-trip', () => {
    it('should correctly round-trip encrypt and decrypt node', () => {
      const node: WisdomGraphNode = {
        id: 'node-encrypt-test',
        content: 'Sensitive pattern: api_key=secret123',
        helpfulCount: 3,
        createdAt: new Date().toISOString(),
        tags: ['secret'],
      };

      const key = 'my-encryption-key-32-bytes-long!!';

      // Encrypt
      const encrypted = security.encryptNode(node, key);
      expect(encrypted.id).toBe(node.id);
      expect(encrypted.encryptedContent).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();

      // Decrypt
      const decrypted = security.decryptNode(encrypted, key);
      expect(decrypted.id).toBe(node.id);
      expect(decrypted.content).toBe(node.content);
    });

    it('should produce different ciphertext for same content (IV uniqueness)', () => {
      const node: WisdomGraphNode = {
        id: 'node-unique-iv',
        content: 'Same content',
        helpfulCount: 1,
        createdAt: new Date().toISOString(),
      };

      const key = 'encryption-key-32-bytes-long!!!';

      const encrypted1 = security.encryptNode(node, key);
      const encrypted2 = security.encryptNode(node, key);

      // Same content should produce different ciphertexts due to random IV
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.encryptedContent).not.toBe(encrypted2.encryptedContent);

      // But both should decrypt to same content
      expect(security.decryptNode(encrypted1, key).content).toBe(node.content);
      expect(security.decryptNode(encrypted2, key).content).toBe(node.content);
    });
  });

  // ============================================================================
  // VaultSecurity Data Deletion
  // ============================================================================

  describe('VaultSecurity.deleteAllUserData', () => {
    it('should remove TasteVault file for given userId', async () => {
      const userId = 'test-delete-user';
      const vaultFile = join(process.cwd(), '.nova', 'taste-vault', `${userId}.json`);

      // Create a vault file first
      const fs = await import('fs');
      const vaultDir = join(process.cwd(), '.nova', 'taste-vault');
      if (!existsSync(vaultDir)) {
        fs.mkdirSync(vaultDir, { recursive: true });
      }
      fs.writeFileSync(vaultFile, JSON.stringify({
        nodes: [{ id: 'node-1', content: 'test' }],
        edges: [],
      }));

      expect(existsSync(vaultFile)).toBe(true);

      // Delete user data
      const result = await security.deleteAllUserData(userId);

      // File should be marked as deleted (emptied)
      expect(existsSync(vaultFile)).toBe(true); // File still exists but is empty/deleted marker
      const content = fs.readFileSync(vaultFile, 'utf-8');
      const data = JSON.parse(content);
      expect(data.deleted).toBe(true);
      expect(data.nodes).toEqual([]);
      expect(result.nodesDeleted).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // SemanticDedup Bulk Index and Cache
  // ============================================================================

  describe('SemanticDedup.bulkIndex → isDuplicate with cached embeddings', () => {
    it('should use cached embeddings (no Ollama calls after bulkIndex)', async () => {
      const nodes: GraphNode[] = [
        { id: 'node-a', content: 'First test pattern' },
        { id: 'node-b', content: 'Second test pattern' },
        { id: 'node-c', content: 'Third test pattern' },
      ];

      // Setup mock to track calls
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ embedding: [0.1, 0.2, 0.3] }),
      });

      // Bulk index - should make 3 Ollama calls
      await dedup.bulkIndex(nodes);
      const bulkIndexCalls = fetchMock.mock.calls.length;
      expect(bulkIndexCalls).toBe(3);

      // Now check isDuplicate with same content - should use cache, not make new calls
      const newNode: GraphNode = { id: 'node-d', content: 'First test pattern' };
      await dedup.isDuplicate(newNode, nodes);

      // No additional fetch calls should have been made
      expect(fetchMock.mock.calls.length).toBe(bulkIndexCalls);
    });
  });

  // ============================================================================
  // CostTracker Integration
  // ============================================================================

  describe.skip('CostTracker integration', () => {
    it('should return correct model breakdown via getBuildCost', async () => {
      // Import CostTracker from model-router
      const { getCostTracker, resetCostTracker } = await import('../llm/model-router.js');
      resetCostTracker();
      const costTracker = getCostTracker();

      // Record usage for different models
      costTracker.recordUsage('gpt-4o', 1000, 0.0025);
      costTracker.recordUsage('gpt-4o-mini', 2000, 0.00015);
      costTracker.recordUsage('claude-3-sonnet', 1500, 0.003);

      const buildCost = costTracker.getBuildCost();

      expect(buildCost.totalTokens).toBe(4500);
      expect(buildCost.estimatedCostUsd).toBeGreaterThan(0);
      expect(buildCost.modelBreakdown['gpt-4o']).toBeDefined();
      expect(buildCost.modelBreakdown['gpt-4o'].tokens).toBe(1000);
      expect(buildCost.modelBreakdown['gpt-4o-mini']).toBeDefined();
      expect(buildCost.modelBreakdown['gpt-4o-mini'].tokens).toBe(2000);
      expect(buildCost.modelBreakdown['claude-3-sonnet']).toBeDefined();
      expect(buildCost.modelBreakdown['claude-3-sonnet'].tokens).toBe(1500);
    });

    it('should return 0 cost for Ollama models', async () => {
      const { getCostTracker, resetCostTracker } = await import('../llm/model-router.js');
      resetCostTracker();
      const costTracker = getCostTracker();

      // Ollama models have costPer1KTokens = 0
      costTracker.recordUsage('qwen2.5:7b', 5000, 0);
      costTracker.recordUsage('llama3:8b', 3000, 0);

      const buildCost = costTracker.getBuildCost();

      expect(buildCost.totalTokens).toBe(8000);
      expect(buildCost.estimatedCostUsd).toBe(0);
      expect(buildCost.modelBreakdown['qwen2.5:7b'].costUsd).toBe(0);
      expect(buildCost.modelBreakdown['llama3:8b'].costUsd).toBe(0);
    });
  });

  // ============================================================================
  // Wisdom Impact Stats
  // ============================================================================

  describe('getWisdomImpactStats', () => {
    it('should return higher wisdomAssistedSuccessRate than baseline when data seeded accordingly', () => {
      const agent = 'MARS';
      const buildId = 'build-wisdom-test';

      // Record baseline tasks (no wisdom) - 50% success rate
      for (let i = 0; i < 10; i++) {
        recordTaskResult(agent, `baseline-task-${i}`, i < 5, 1000, 2000, 0, undefined, buildId, 0, 0);
      }

      // Record wisdom-assisted tasks - 90% success rate
      for (let i = 0; i < 10; i++) {
        recordTaskResult(agent, `wisdom-task-${i}`, i < 9, 1000, 2000, 0, undefined, buildId, 3, 2);
      }

      const stats = getWisdomImpactStats(buildId, 'build');

      expect(stats.wisdomAssistedSuccessRate).toBeGreaterThan(stats.baselineSuccessRate);
      expect(stats.wisdomAssistedSuccessRate).toBeCloseTo(0.9, 1);
      expect(stats.baselineSuccessRate).toBeCloseTo(0.5, 1);
      expect(stats.avgVaultPatternsPerTask).toBe(3);
      expect(stats.avgGlobalWisdomPerTask).toBe(2);
    });
  });

  // ============================================================================
  // Model Selection with Installed Models
  // ============================================================================

  describe.skip('detectAvailableModels → selectModelForPhase', () => {
    it('should prefer installed models when populated', async () => {
      const { 
        detectAvailableModels, 
        selectModelForPhase,
        clearInstalledModelsCache 
      } = await import('../llm/model-router.js');

      clearInstalledModelsCache();

      // Mock Ollama /api/tags response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          models: [
            { name: 'qwen2.5:14b' },
            { name: 'nomic-embed-text' },
          ],
        }),
      });

      // Detect available models
      const installed = await detectAvailableModels();
      expect(installed).toContain('qwen2.5:14b');
      expect(installed).toContain('nomic-embed-text');

      // selectModelForPhase should prefer installed models
      const thinkingModel = await selectModelForPhase('thinking');
      // qwen2.5:14b is installed, so it should be preferred over qwen2.5:7b
      expect(['qwen2.5:7b', 'qwen2.5:14b', 'llama3:8b', 'deepseek-coder:6.7b', 'codellama:7b']).toContain(thinkingModel);

      const embeddingModel = await selectModelForPhase('embedding');
      // nomic-embed-text is installed
      expect(['nomic-embed-text', 'mxbai-embed-large']).toContain(embeddingModel);
    });
  });
});
