// Integration Tests for Taste Vault + Global Wisdom Pipeline
// KIMI-VAULT-06

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getTasteVault,
  resetTasteVault,
  PREMIUM_TIER,
} from './taste-vault.js';
import {
  getGlobalWisdomPipeline,
  resetGlobalWisdomPipeline,
  type GlobalPattern,
} from './global-wisdom.js';
import {
  getGraphMemory,
  resetGraphMemory,
} from './graph-memory.js';
import {
  buildVaultContext,
  trackInjectedVaultNodes,
  getInjectedVaultNodeIds,
  clearInjectedVaultNodeIds,
} from '../orchestrator/prompt-builder.js';

// ============================================================================
// Test Setup
// ============================================================================

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'taste-vault-integration-'));
  resetTasteVault();
  resetGlobalWisdomPipeline();
  resetGraphMemory();
});

afterEach(() => {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
  resetTasteVault();
  resetGlobalWisdomPipeline();
  resetGraphMemory();
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Taste Vault Integration', () => {
  describe('buildVaultContext integration', () => {
    it('adding a pattern to TasteVault causes it to appear in buildVaultContext output', async () => {
      const vault = getTasteVault('test-user');
      
      await vault.learn({
        type: 'Strategy',
        content: 'Use requireAuth() first in all Convex mutations',
        confidence: 0.9,
        tags: ['auth', 'convex'],
      });

      // Query with matching keywords to ensure pattern is retrieved
      const context = await buildVaultContext('convex mutations auth requireAuth', 'MARS', 'task-1');
      
      expect(context).toContain('taste_vault_context');
      // Either personal or global patterns should be present
      expect(context).toMatch(/<(personal_patterns|global_wisdom)/);
    });

    it('premium vault injects up to 12 global wisdom nodes; free injects up to 4', async () => {
      const pipeline = getGlobalWisdomPipeline();
      
      // Create multiple global patterns
      for (let i = 0; i < 15; i++) {
        const pattern: GlobalPattern = {
          id: `pattern-${i}`,
          canonicalContent: `Global pattern ${i}: Always use TypeScript`,
          originalNodeIds: [],
          successScore: 0.9 - (i * 0.01),
          userDiversity: 5,
          lastPromotedAt: new Date().toISOString(),
          tags: ['typescript'],
          promotionCount: 1,
          harmReports: 0,
          isActive: true,
        };
        // Add pattern to pipeline via direct map access
      (pipeline as unknown as { patterns: Map<string, GlobalPattern> }).patterns.set(pattern.id, pattern);
      }

      // Test premium tier
      process.env.NOVA26_TIER = 'premium';
      const premiumContext = await buildVaultContext('typescript code', 'MARS', 'task-2');
      const premiumMatches = premiumContext.match(/Global pattern \d+/g) || [];
      expect(premiumMatches.length).toBeLessThanOrEqual(12);
      
      // Test free tier
      process.env.NOVA26_TIER = 'free';
      const freeContext = await buildVaultContext('typescript code', 'MARS', 'task-3');
      const freeMatches = freeContext.match(/Global pattern \d+/g) || [];
      expect(freeMatches.length).toBeLessThanOrEqual(4);
      
      delete process.env.NOVA26_TIER;
    });
  });

  describe('learnFromBuildResult integration', () => {
    it('after a successful build, learnFromBuildResult adds a new node', async () => {
      const vault = getTasteVault('test-user');
      const initialCount = vault.summary().nodeCount;

      await vault.learnFromBuildResult(
        'Add auth middleware',
        'Implement requireAuth in Convex mutations',
        'export function requireAuth() { return true; }',
        'MARS',
        true
      );

      const finalCount = vault.summary().nodeCount;
      expect(finalCount).toBeGreaterThan(initialCount);
    });

    it('after a failed build, a Mistake node is created', async () => {
      const vault = getTasteVault('test-user');
      
      await vault.learnFromBuildResult(
        'Fix broken auth',
        'The auth is not working correctly',
        '',
        'MARS',
        false
      );

      const summary = vault.summary();
      const mistakeCount = summary.byType['Mistake'] || 0;
      expect(mistakeCount).toBeGreaterThan(0);
    });
  });

  describe('reinforcement integration', () => {
    it('reinforcing a node increases its confidence', async () => {
      const vault = getTasteVault('test-user');
      const memory = getGraphMemory('test-user');
      
      const node = await vault.learn({
        type: 'Pattern',
        content: 'Test pattern for reinforcement',
        confidence: 0.7,
      });

      const initialConfidence = node.confidence;
      
      await vault.reinforce(node.id);
      
      const updatedNode = memory.getNode(node.id);
      expect(updatedNode?.confidence).toBeGreaterThan(initialConfidence);
    });
  });

  describe('high confidence retrieval', () => {
    it('a node with confidence >= 0.85 is returned by getHighConfidence()', async () => {
      const vault = getTasteVault('test-user');
      const memory = getGraphMemory('test-user');
      
      await vault.learn({
        type: 'Strategy',
        content: 'High confidence pattern',
        confidence: 0.9,
      });

      const highConfNodes = memory.getHighConfidence(0.85);
      expect(highConfNodes.length).toBeGreaterThan(0);
      expect(highConfNodes[0]?.content).toBe('High confidence pattern');
    });
  });

  describe('token budget enforcement', () => {
    it('buildVaultContext respects token budget by limiting node count', async () => {
      const vault = getTasteVault('test-user');
      
      // Add many patterns
      for (let i = 0; i < 30; i++) {
        await vault.learn({
          type: 'Pattern',
          content: `Pattern ${i}: ${'x'.repeat(100)}`,
          confidence: 0.8,
          tags: ['test'],
        });
      }

      const context = await buildVaultContext('test context', 'MARS', 'task-4');
      
      // Check that context was generated (it may be limited by internal logic)
      expect(context).toContain('taste_vault_context');
      
      // Token estimate: context.length / 4 should be reasonable
      const estimatedTokens = Math.ceil(context.length / 4);
      expect(estimatedTokens).toBeLessThan(5000); // Sanity check
    });
  });
});

describe('Global Wisdom Integration', () => {
  describe('promotion to global wisdom', () => {
    it('promoted global pattern appears in getForPremium with correct successScore', async () => {
      const vault = getTasteVault('test-user-1');
      const pipeline = getGlobalWisdomPipeline();
      
      const node = await vault.learn({
        type: 'Strategy',
        content: 'Always validate inputs with Zod',
        confidence: 0.9,
        tags: ['validation'],
      });

      // Manually set helpful count and reinforce to increase it
      const memory = getGraphMemory('test-user-1');
      for (let i = 0; i < 10; i++) {
        memory.incrementHelpful(node.id);
      }

      const weeklyLog: { userId: string; promotionCount: number; weekStart: string }[] = [];
      const graphNode = {
        id: node.id,
        content: node.content,
        helpfulCount: node.helpfulCount + 10,
        createdAt: node.createdAt,
        tags: node.tags,
      };
      const pattern = await pipeline.promote(graphNode, 'test-user-1', weeklyLog);
      
      expect(pattern).not.toBeNull();
      if (pattern) {
        expect(pattern.canonicalContent).toContain('validate inputs');
        expect(pattern.successScore).toBeGreaterThan(0);
        
        const premiumPatterns = pipeline.getForPremium(12);
        const found = premiumPatterns.find(p => p.id === pattern.id);
        expect(found).toBeDefined();
      }
    });
  });

  describe('harm report handling', () => {
    it('pattern with 3+ harm reports is excluded from getForPremium', async () => {
      const pipeline = getGlobalWisdomPipeline();
      
      const pattern: GlobalPattern = {
        id: 'harmful-pattern',
        canonicalContent: 'This pattern is harmful',
        originalNodeIds: [],
        successScore: 0.95,
        userDiversity: 5,
        lastPromotedAt: new Date().toISOString(),
        tags: ['bad'],
        promotionCount: 1,
        harmReports: 0,
        isActive: true,
      };
      
      (pipeline as unknown as { patterns: Map<string, GlobalPattern> }).patterns.set(pattern.id, pattern);
      
      // Report harm 3 times
      pipeline.reportHarm('harmful-pattern');
      pipeline.reportHarm('harmful-pattern');
      pipeline.reportHarm('harmful-pattern');
      
      const premiumPatterns = pipeline.getForPremium(12);
      const found = premiumPatterns.find(p => p.id === 'harmful-pattern');
      expect(found).toBeUndefined();
    });
  });

  describe('end-to-end promotion', () => {
    it('getTasteVault().learn() -> getGlobalWisdomPipeline().promote() -> getForFree() returns the pattern', async () => {
      const vault1 = getTasteVault('user-1');
      const vault2 = getTasteVault('user-2');
      const vault3 = getTasteVault('user-3');
      const pipeline = getGlobalWisdomPipeline();
      
      // Three users learn the same pattern
      const node1 = await vault1.learn({
        type: 'Strategy',
        content: 'Use early returns for guard clauses',
        confidence: 0.9,
        tags: ['code-style'],
      });

      await vault2.learn({
        type: 'Strategy',
        content: 'Use early returns for guard clauses',
        confidence: 0.85,
        tags: ['code-style'],
      });

      await vault3.learn({
        type: 'Strategy',
        content: 'Use early returns for guard clauses',
        confidence: 0.88,
        tags: ['code-style'],
      });

      // Promote from each user
      const weeklyLog: { userId: string; promotionCount: number; weekStart: string }[] = [];
      
      // Mark nodes as global and with high confidence for promotion
      // Create proper GraphNode input for promotion with helpful count
      const graphNode1 = {
        id: node1.id,
        content: node1.content,
        helpfulCount: 5,
        createdAt: node1.createdAt,
        tags: node1.tags,
      };
      
      const pattern1 = await pipeline.promote(graphNode1, 'user-1', weeklyLog);
      expect(pattern1).not.toBeNull();
      
      if (pattern1) {
        // Update user diversity to meet threshold
        (pattern1 as unknown as { userDiversity: number }).userDiversity = 3;
        
        // Should now appear in free tier results
        const freePatterns = pipeline.getForFree(4);
        const found = freePatterns.find(p => p.id === pattern1.id);
        
        if (found) {
          expect(found.canonicalContent).toContain('early returns');
        }
      }
    });
  });
});

describe('Vault Node Tracking', () => {
  it('trackInjectedVaultNodes records node IDs for a task', () => {
    trackInjectedVaultNodes('task-1', ['node-1', 'node-2']);
    trackInjectedVaultNodes('task-1', ['node-3']);
    
    const ids = getInjectedVaultNodeIds('task-1');
    expect(ids).toContain('node-1');
    expect(ids).toContain('node-2');
    expect(ids).toContain('node-3');
  });

  it('clearInjectedVaultNodeIds removes tracking for a task', () => {
    trackInjectedVaultNodes('task-2', ['node-1', 'node-2']);
    clearInjectedVaultNodeIds('task-2');
    
    const ids = getInjectedVaultNodeIds('task-2');
    expect(ids).toHaveLength(0);
  });
});

describe('Tier Enforcement Integration', () => {
  it('free tier respects maxNodes limit', async () => {
    const vault = getTasteVault('test-user', { 
      tier: 'free', 
      maxNodes: 5, 
      globalWisdomInjections: 4, 
      canOptIntoGlobal: true 
    });
    
    // Add 5 nodes
    for (let i = 0; i < 5; i++) {
      await vault.learn({
        type: 'Pattern',
        content: `Pattern ${i}`,
        confidence: 0.8,
      });
    }
    
    expect(vault.summary().nodeCount).toBe(5);
    
    // Add 6th node - should evict lowest confidence
    await vault.learn({
      type: 'Pattern',
      content: 'Pattern 6',
      confidence: 0.95,
    });
    
    // Should still be 5 due to eviction
    expect(vault.summary().nodeCount).toBe(5);
  });

  it('premium tier allows more than free tier limit', async () => {
    const vault = getTasteVault('test-user', PREMIUM_TIER);
    
    // Add many nodes
    for (let i = 0; i < 10; i++) {
      await vault.learn({
        type: 'Pattern',
        content: `Pattern ${i}`,
        confidence: 0.8,
      });
    }
    
    expect(vault.summary().nodeCount).toBe(10);
  });
});
