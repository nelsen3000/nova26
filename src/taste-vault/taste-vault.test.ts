// KIMI-VAULT-02: Taste Vault Manager Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  TasteVault,
  getTasteVault,
  resetTasteVault,
  FREE_TIER,
  PREMIUM_TIER,
  type TierConfig,
} from './taste-vault.js';
import { resetGraphMemory } from './graph-memory.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('Taste Vault Manager', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nova26-taste-vault-test-'));
    originalCwd = process.cwd();
    
    // Reset singletons
    resetTasteVault();
    resetGraphMemory();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    
    resetTasteVault();
    resetGraphMemory();
  });

  // ============================================================================
  // Basic Operations Tests
  // ============================================================================

  describe('Basic Operations', () => {
    it('should create a TasteVault with default free tier', () => {
      const vault = new TasteVault('test-user');
      
      expect(vault.tier.tier).toBe('free');
      expect(vault.tier.maxNodes).toBe(500);
    });

    it('should create a TasteVault with premium tier', () => {
      const vault = new TasteVault('test-user', PREMIUM_TIER);
      
      expect(vault.tier.tier).toBe('premium');
      expect(vault.tier.maxNodes).toBe(Infinity);
    });

    it('should learn a new pattern', async () => {
      const vault = new TasteVault('test-user');
      
      const node = await vault.learn({
        type: 'Pattern',
        content: 'Use const for immutable variables',
        context: 'JavaScript best practices',
        confidence: 0.9,
      });

      expect(node.id).toBeDefined();
      expect(node.type).toBe('Pattern');
      expect(node.content).toBe('Use const for immutable variables');
      expect(node.confidence).toBe(0.9);
    });

    it('should forget a pattern by ID', async () => {
      const vault = new TasteVault('test-user');
      
      const node = await vault.learn({
        type: 'Pattern',
        content: 'Temporary pattern',
      });

      const result = await vault.forget(node.id);
      expect(result).toBe(true);

      const summary = vault.summary();
      expect(summary.nodeCount).toBe(0);
    });

    it('should return false when forgetting non-existent node', async () => {
      const vault = new TasteVault('test-user');
      
      const result = await vault.forget('non-existent-id');
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Reinforcement Tests
  // ============================================================================

  describe('Reinforcement', () => {
    it('should reinforce a pattern', async () => {
      const vault = new TasteVault('test-user');
      
      const node = await vault.learn({
        type: 'Pattern',
        content: 'Important pattern',
        confidence: 0.5,
      });

      await vault.reinforce(node.id);

      const summary = vault.summary();
      expect(summary.topPatterns[0].confidence).toBeGreaterThan(0.5);
      expect(summary.topPatterns[0].helpfulCount).toBe(1);
    });

    it('should throw when reinforcing non-existent node', async () => {
      const vault = new TasteVault('test-user');
      
      await expect(vault.reinforce('non-existent')).rejects.toThrow('Node not found');
    });
  });

  // ============================================================================
  // Relevant Pattern Retrieval Tests
  // ============================================================================

  describe('Relevant Pattern Retrieval', () => {
    it('should return relevant patterns based on context', async () => {
      const vault = new TasteVault('test-user');
      
      await vault.learn({
        type: 'Pattern',
        content: 'Use TypeScript for type safety',
        tags: ['typescript', 'types'],
      });

      await vault.learn({
        type: 'Pattern',
        content: 'Write unit tests for all functions',
        tags: ['testing', 'jest'],
      });

      const relevant = await vault.getRelevantPatterns('How should I handle types in my code?', 10);
      
      expect(relevant.length).toBeGreaterThan(0);
      expect(relevant[0].content).toContain('TypeScript');
    });

    it('should return empty array when no patterns exist', async () => {
      const vault = new TasteVault('test-user');
      
      const relevant = await vault.getRelevantPatterns('Some context');
      
      expect(relevant).toEqual([]);
    });

    it('should respect the limit parameter', async () => {
      const vault = new TasteVault('test-user');
      
      // Learn 5 patterns
      for (let i = 0; i < 5; i++) {
        await vault.learn({
          type: 'Pattern',
          content: `Pattern ${i}`,
        });
      }

      const relevant = await vault.getRelevantPatterns('Pattern', 3);
      
      expect(relevant.length).toBe(3);
    });
  });

  // ============================================================================
  // Auto-learning Tests
  // ============================================================================

  describe('Auto-learning from Build Results', () => {
    it('should learn patterns from successful build', async () => {
      const vault = new TasteVault('test-user');
      
      await vault.learnFromBuildResult(
        'Auth task',
        'Implement authentication',
        'function requireAuth() { return true; }',
        'MARS',
        true
      );

      const summary = vault.summary();
      expect(summary.nodeCount).toBeGreaterThan(0);
      
      const patterns = summary.topPatterns.filter(p => 
        p.content.includes('requireAuth')
      );
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should create Mistake node from failed build', async () => {
      const vault = new TasteVault('test-user');
      
      await vault.learnFromBuildResult(
        'Broken feature',
        'This should have worked',
        'error output here',
        'VENUS',
        false
      );

      const summary = vault.summary();
      expect(summary.byType.Mistake).toBe(1);
    });

    it('should extract Math.floor pattern from description', async () => {
      const vault = new TasteVault('test-user');
      
      await vault.learnFromBuildResult(
        'Chip calculation',
        'Use Math.floor() for chip calculations',
        'some code',
        'PLUTO',
        true
      );

      const summary = vault.summary();
      const hasMathFloor = summary.topPatterns.some(p => 
        p.content.includes('Math.floor')
      );
      expect(hasMathFloor).toBe(true);
    });
  });

  // ============================================================================
  // Pattern Detection Tests
  // ============================================================================

  describe('Pattern Detection', () => {
    it('should detect auth guard patterns', async () => {
      const vault = new TasteVault('test-user');
      
      const code = `
        function mutation(ctx) {
          const user = requireAuth(ctx);
          return user;
        }
      `;

      const patterns = await vault.detectPatterns(code, 'typescript');
      
      const authPattern = patterns.find(p => 
        p.content.includes('requireAuth')
      );
      expect(authPattern).toBeDefined();
    });

    it('should detect multi-tenancy patterns', async () => {
      const vault = new TasteVault('test-user');
      
      const code = `
        const results = await db
          .query('companies')
          .withIndex('by_companyId', q => q.eq('companyId', args.companyId))
          .collect();
      `;

      const patterns = await vault.detectPatterns(code, 'typescript');
      
      const tenantPattern = patterns.find(p => 
        p.content.includes('companyId')
      );
      expect(tenantPattern).toBeDefined();
    });

    it('should detect Zod validation patterns', async () => {
      const vault = new TasteVault('test-user');
      
      const code = `
        const schema = z.object({
          name: z.string(),
          age: z.number(),
        });
      `;

      const patterns = await vault.detectPatterns(code, 'typescript');
      
      const zodPattern = patterns.find(p => 
        p.content.includes('Zod')
      );
      expect(zodPattern).toBeDefined();
    });

    it('should detect error handling patterns', async () => {
      const vault = new TasteVault('test-user');
      
      const code = `
        try {
          const result = await riskyOperation();
          return result;
        } catch (error) {
          console.error('Failed:', error);
          throw error;
        }
      `;

      const patterns = await vault.detectPatterns(code, 'typescript');
      
      const errorPattern = patterns.find(p => 
        p.content.includes('try-catch')
      );
      expect(errorPattern).toBeDefined();
    });
  });

  // ============================================================================
  // Conflict Detection Tests
  // ============================================================================

  describe('Conflict Detection', () => {
    it('should detect never vs always conflicts', async () => {
      const vault = new TasteVault('test-user');
      
      // First learn a "never" pattern
      await vault.learn({
        type: 'Pattern',
        content: 'Never use var declarations',
      });

      // Check for conflict with "always use var"
      const conflicts = vault.detectConflicts('Always use var declarations', vault['getAllNodes']());
      
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('should detect should vs should not conflicts', async () => {
      const vault = new TasteVault('test-user');
      
      await vault.learn({
        type: 'Pattern',
        content: 'You should validate all inputs',
      });

      const conflicts = vault.detectConflicts('You should not validate all inputs', vault['getAllNodes']());
      
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('should create contradiction edge when learning conflicting content', async () => {
      const vault = new TasteVault('test-user');
      
      await vault.learn({
        type: 'Pattern',
        content: 'Always use TypeScript',
      });

      await vault.learn({
        type: 'Pattern',
        content: 'Never use TypeScript',
      });

      const summary = vault.summary();
      expect(summary.edgeCount).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Tier Limit Tests
  // ============================================================================

  describe('Tier Limits', () => {
    it('should enforce maxNodes limit for free tier', async () => {
      const testTier: TierConfig = { 
        tier: 'free', 
        maxNodes: 3, 
        globalWisdomInjections: 4, 
        canOptIntoGlobal: true 
      };
      const vault = new TasteVault('test-user', testTier);
      
      // Learn 3 patterns
      for (let i = 0; i < 3; i++) {
        await vault.learn({
          type: 'Pattern',
          content: `Pattern ${i}`,
          confidence: 0.5,
        });
      }

      // Learn a 4th pattern (should trigger eviction)
      await vault.learn({
        type: 'Pattern',
        content: 'New pattern that should not evict high confidence',
        confidence: 0.95,
      });

      const summary = vault.summary();
      expect(summary.nodeCount).toBeLessThanOrEqual(3);
    });

    it('should not enforce limit for premium tier', async () => {
      const vault = new TasteVault('test-user', PREMIUM_TIER);
      
      // Learn many patterns
      for (let i = 0; i < 10; i++) {
        await vault.learn({
          type: 'Pattern',
          content: `Pattern ${i}`,
        });
      }

      const summary = vault.summary();
      expect(summary.nodeCount).toBe(10);
    });
  });

  // ============================================================================
  // Summary Tests
  // ============================================================================

  describe('Summary', () => {
    it('should return correct summary', async () => {
      const vault = new TasteVault('test-user');
      
      await vault.learn({ type: 'Pattern', content: 'Pattern 1' });
      await vault.learn({ type: 'Strategy', content: 'Strategy 1' });
      await vault.learn({ type: 'Decision', content: 'Decision 1' });

      const summary = vault.summary();
      
      expect(summary.tier).toBeDefined();
      expect(summary.nodeCount).toBe(3);
      expect(summary.byType.Pattern).toBe(1);
      expect(summary.byType.Strategy).toBe(1);
      expect(summary.byType.Decision).toBe(1);
      expect(summary.topPatterns.length).toBe(3);
    });
  });

  // ============================================================================
  // Singleton Factory Tests
  // ============================================================================

  describe('Singleton Factory', () => {
    it('should return same instance for same userId', () => {
      const vault1 = getTasteVault('user-1');
      const vault2 = getTasteVault('user-1');
      
      expect(vault1).toBe(vault2);
    });

    it('should return different instances for different userIds', () => {
      const vault1 = getTasteVault('user-1');
      const vault2 = getTasteVault('user-2');
      
      expect(vault1).not.toBe(vault2);
    });

    it('should update tier when provided to getTasteVault', () => {
      const vault = getTasteVault('user-1', FREE_TIER);
      expect(vault.tier.tier).toBe('free');

      const vault2 = getTasteVault('user-1', PREMIUM_TIER);
      expect(vault2.tier.tier).toBe('premium');
    });

    it('should reset all instances', () => {
      const vault1 = getTasteVault('user-1');
      resetTasteVault();
      const vault2 = getTasteVault('user-1');
      
      expect(vault1).not.toBe(vault2);
    });
  });

  // ============================================================================
  // Persistence Tests
  // ============================================================================

  describe('Persistence', () => {
    it('should persist and load vault', async () => {
      const vault = new TasteVault('persist-test');
      
      await vault.learn({
        type: 'Pattern',
        content: 'Persistent pattern',
        tags: ['persistent'],
      });

      await vault.persist();

      // Create new vault instance for same user (should load from disk)
      resetTasteVault();
      resetGraphMemory();
      
      const loadedVault = new TasteVault('persist-test');
      await loadedVault.load();

      const summary = loadedVault.summary();
      expect(summary.nodeCount).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should throw on empty content', async () => {
      const vault = new TasteVault('test-user');
      
      await expect(vault.learn({
        type: 'Pattern',
        content: '',
      })).rejects.toThrow();
    });

    it('should handle special characters in content', async () => {
      const vault = new TasteVault('test-user');
      
      const specialContent = 'Use <script>alert("xss")</script> or `backticks` or "quotes"';
      const node = await vault.learn({
        type: 'Pattern',
        content: specialContent,
      });

      expect(node.content).toBe(specialContent);
    });

    it('should handle very long content', async () => {
      const vault = new TasteVault('test-user');
      
      const longContent = 'a'.repeat(10000);
      const node = await vault.learn({
        type: 'Pattern',
        content: longContent,
      });

      expect(node.content.length).toBe(10000);
    });

    it('should handle multiple tags', async () => {
      const vault = new TasteVault('test-user');
      
      const node = await vault.learn({
        type: 'Pattern',
        content: 'Multi-tagged pattern',
        tags: ['tag1', 'tag2', 'tag3', 'typescript', 'react'],
      });

      expect(node.tags).toHaveLength(5);
      expect(node.tags).toContain('typescript');
    });
  });
});
