// Taste Vault - Hindsight Integration Tests
// K4-21: Verify Hindsight integration with Taste Vault

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getTasteVault, 
  resetTasteVault,
} from '../taste-vault.js';
import { resetGraphMemory } from '../graph-memory.js';

describe('Taste Vault Hindsight Integration', () => {
  const companyId = 'test-company';

  beforeEach(() => {
    resetGraphMemory();
    resetTasteVault();
  });

  describe('Pattern Learning', () => {
    it('should learn patterns', async () => {
      const vault = getTasteVault(companyId);
      
      const node = await vault.learn({
        type: 'preference',
        content: 'prefers-functional-react',
        context: 'React component development',
        source: 'user-feedback',
        tags: ['react', 'functional'],
        confidence: 0.9,
      });

      expect(node).toBeDefined();
      expect(node.content).toBe('prefers-functional-react');
      expect(node.confidence).toBe(0.9);
    });

    it('should handle multiple patterns', async () => {
      const vault = getTasteVault(companyId);
      
      const node1 = await vault.learn({ type: 'preference', content: 'pattern-1', confidence: 0.9 });
      const node2 = await vault.learn({ type: 'preference', content: 'pattern-2', confidence: 0.8 });
      const node3 = await vault.learn({ type: 'preference', content: 'pattern-3', confidence: 0.95 });

      // All nodes should be created
      expect(node1).toBeDefined();
      expect(node2).toBeDefined();
      expect(node3).toBeDefined();
      expect(node1.content).toBe('pattern-1');
      expect(node2.content).toBe('pattern-2');
      expect(node3.content).toBe('pattern-3');
    });
  });

  describe('Pattern Retrieval', () => {
    it('should retrieve relevant patterns', async () => {
      const vault = getTasteVault(companyId);
      
      await vault.learn({ type: 'preference', content: 'react hooks pattern', confidence: 0.9 });
      await vault.learn({ type: 'preference', content: 'vue composition pattern', confidence: 0.8 });

      const results = await vault.getRelevantPatterns('react component');
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Pattern Reinforcement', () => {
    it('should reinforce patterns without error', async () => {
      const vault = getTasteVault(companyId);
      
      const node = await vault.learn({ type: 'preference', content: 'test-pattern', confidence: 0.8 });

      // Should not throw
      await expect(vault.reinforce(node.id, { helpful: true })).resolves.not.toThrow();
    });
  });
});
