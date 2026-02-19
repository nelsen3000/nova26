// Global Wisdom Pipeline Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  GlobalWisdomPipeline,
  getGlobalWisdomPipeline,
  resetGlobalWisdomPipeline,
  type GraphNode,
  type UserVault,
  type WeeklyPromotionLog,
  type GlobalPattern,
} from './global-wisdom.js';

describe('GlobalWisdomPipeline', () => {
  let pipeline: GlobalWisdomPipeline;

  beforeEach(() => {
    resetGlobalWisdomPipeline();
    pipeline = getGlobalWisdomPipeline();
  });

  afterEach(() => {
    resetGlobalWisdomPipeline();
  });

  describe('collectHighConfidenceNodes', () => {
    it('should collect nodes above threshold from opt-in users', () => {
      const vaults: UserVault[] = [
        {
          userId: 'user-1',
          optIn: true,
          nodes: [
            { id: 'node-1', content: 'content-1', helpfulCount: 0.9, createdAt: new Date().toISOString() },
            { id: 'node-2', content: 'content-2', helpfulCount: 0.8, createdAt: new Date().toISOString() },
          ],
        },
        {
          userId: 'user-2',
          optIn: false,
          nodes: [
            { id: 'node-3', content: 'content-3', helpfulCount: 0.95, createdAt: new Date().toISOString() },
          ],
        },
      ];

      const nodes = pipeline.collectHighConfidenceNodes(vaults, 0.85);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('node-1');
    });

    it('should use default threshold of 0.85 when not specified', () => {
      const vaults: UserVault[] = [
        {
          userId: 'user-1',
          optIn: true,
          nodes: [
            { id: 'node-1', content: 'content-1', helpfulCount: 0.86, createdAt: new Date().toISOString() },
            { id: 'node-2', content: 'content-2', helpfulCount: 0.84, createdAt: new Date().toISOString() },
          ],
        },
      ];

      const nodes = pipeline.collectHighConfidenceNodes(vaults);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('node-1');
    });

    it('should return empty array when no opt-in users', () => {
      const vaults: UserVault[] = [
        {
          userId: 'user-1',
          optIn: false,
          nodes: [
            { id: 'node-1', content: 'content-1', helpfulCount: 0.95, createdAt: new Date().toISOString() },
          ],
        },
      ];

      const nodes = pipeline.collectHighConfidenceNodes(vaults);
      expect(nodes).toHaveLength(0);
    });
  });

  describe('stripSensitiveData', () => {
    it('should remove file paths from content', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Check /home/user/project/config.json for settings and ./src/app.ts',
        helpfulCount: 1,
        createdAt: new Date().toISOString(),
      };

      const stripped = pipeline.stripSensitiveData(node);
      expect(stripped.content).not.toContain('/home/user/project/config.json');
      expect(stripped.content).not.toContain('./src/app.ts');
      expect(stripped.content).toContain('[PATH_REDACTED]');
    });

    it('should remove secrets from content', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Set api_key=secret12345 and token="bearer_token_abc"',
        helpfulCount: 1,
        createdAt: new Date().toISOString(),
      };

      const stripped = pipeline.stripSensitiveData(node);
      expect(stripped.content).not.toContain('secret12345');
      expect(stripped.content).not.toContain('bearer_token_abc');
      expect(stripped.content).toContain('[REDACTED]');
    });

    it('should remove user-specific variables', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'username=john_doe and email=johndoe@example.com',
        helpfulCount: 1,
        createdAt: new Date().toISOString(),
      };

      const stripped = pipeline.stripSensitiveData(node);
      expect(stripped.content).not.toContain('john_doe');
      expect(stripped.content).not.toContain('johndoe@example.com');
      expect(stripped.content).toContain('[REDACTED]');
    });

    it('should return new node without mutating original', () => {
      const original: GraphNode = {
        id: 'node-1',
        content: 'Check /path/to/file for settings',
        helpfulCount: 1,
        createdAt: new Date().toISOString(),
      };

      const stripped = pipeline.stripSensitiveData(original);
      expect(stripped).not.toBe(original);
      expect(original.content).toContain('/path/to/file');
    });
  });

  describe('isSimilar', () => {
    it('should return true for similar content above threshold', () => {
      const a = 'Use React hooks for state in components';
      const b = 'Use React hooks for state in functional components';

      expect(pipeline.isSimilar(a, b, 0.7)).toBe(true);
    });

    it('should return false for dissimilar content below threshold', () => {
      const a = 'Use React hooks for state management';
      const b = 'Database schema design for PostgreSQL';

      expect(pipeline.isSimilar(a, b, 0.7)).toBe(false);
    });

    it('should use default threshold of 0.7', () => {
      const a = 'the quick brown fox jumps';
      const b = 'the quick brown fox jumps over';

      expect(pipeline.isSimilar(a, b)).toBe(true);
    });

    it('should handle empty strings', () => {
      expect(pipeline.isSimilar('', '')).toBe(true);
      expect(pipeline.isSimilar('content', '')).toBe(false);
      expect(pipeline.isSimilar('', 'content')).toBe(false);
    });
  });

  describe('findDuplicates', () => {
    it('should identify duplicate candidates', () => {
      const candidates: GraphNode[] = [
        { id: 'node-1', content: 'React hooks pattern for state management in components', helpfulCount: 1, createdAt: new Date().toISOString() },
        { id: 'node-2', content: 'Database schema design using PostgreSQL tables', helpfulCount: 1, createdAt: new Date().toISOString() },
      ];

      const existing: GlobalPattern[] = [
        {
          id: 'pattern-1',
          canonicalContent: 'React hooks pattern for managing state in components effectively',
          originalNodeIds: ['old-node'],
          successScore: 0.8,
          userDiversity: 3,
          lastPromotedAt: new Date().toISOString(),
          tags: [],
          promotionCount: 1,
          harmReports: 0,
          isActive: true,
        },
      ];

      const { duplicates, unique } = pipeline.findDuplicates(candidates, existing, 0.7);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].candidate.id).toBe('node-1');
      expect(unique).toHaveLength(1);
      expect(unique[0].id).toBe('node-2');
    });

    it('should return all unique when no duplicates', () => {
      const candidates: GraphNode[] = [
        { id: 'node-1', content: 'Use Vue composition API', helpfulCount: 1, createdAt: new Date().toISOString() },
      ];

      const existing: GlobalPattern[] = [
        {
          id: 'pattern-1',
          canonicalContent: 'Use React hooks for state',
          originalNodeIds: ['old-node'],
          successScore: 0.8,
          userDiversity: 3,
          lastPromotedAt: new Date().toISOString(),
          tags: [],
          promotionCount: 1,
          harmReports: 0,
          isActive: true,
        },
      ];

      const { duplicates, unique } = pipeline.findDuplicates(candidates, existing);
      expect(duplicates).toHaveLength(0);
      expect(unique).toHaveLength(1);
    });
  });

  describe('scoreNode', () => {
    it('should calculate correct score with all components', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Test content',
        helpfulCount: 1,
        createdAt: new Date().toISOString(),
      };

      const score = pipeline.scoreNode(node, 10);
      // helpfulScore: 1 * 0.6 = 0.6
      // diversityScore: min(10/10, 1) * 0.3 = 0.3
      // recencyBoost: 1.0 * 0.1 = 0.1
      // total: 1.0
      expect(score).toBeCloseTo(1.0, 1);
    });

    it('should apply recency decay for older nodes', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100); // 100 days ago

      const node: GraphNode = {
        id: 'node-1',
        content: 'Test content',
        helpfulCount: 1,
        createdAt: oldDate.toISOString(),
      };

      const score = pipeline.scoreNode(node, 0);
      // helpfulScore: 0.6
      // diversityScore: 0
      // recencyBoost: ((180-100)/150) * 0.1 = 0.053
      expect(score).toBeLessThan(0.7);
      expect(score).toBeGreaterThan(0.6);
    });

    it('should apply zero recency boost for very old nodes', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 200); // 200 days ago

      const node: GraphNode = {
        id: 'node-1',
        content: 'Test content',
        helpfulCount: 1,
        createdAt: oldDate.toISOString(),
      };

      const score = pipeline.scoreNode(node, 0);
      // helpfulScore: 0.6
      // diversityScore: 0
      // recencyBoost: 0 (beyond 180 days)
      expect(score).toBe(0.6);
    });
  });

  describe('checkAntiGaming', () => {
    it('should return true when user has fewer than 5 promotions', () => {
      const logs: WeeklyPromotionLog[] = [
        { userId: 'user-1', promotionCount: 3, weekStart: getWeekStart() },
      ];

      expect(pipeline.checkAntiGaming('user-1', logs)).toBe(true);
    });

    it('should return false when user has 5 or more promotions', () => {
      const logs: WeeklyPromotionLog[] = [
        { userId: 'user-1', promotionCount: 5, weekStart: getWeekStart() },
      ];

      expect(pipeline.checkAntiGaming('user-1', logs)).toBe(false);
    });

    it('should return true for new users with no log', () => {
      const logs: WeeklyPromotionLog[] = [];
      expect(pipeline.checkAntiGaming('user-1', logs)).toBe(true);
    });
  });

  describe('reportHarm', () => {
    it('should increment harm reports', async () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Test content',
        helpfulCount: 1,
        createdAt: new Date().toISOString(),
      };

      await pipeline.promote(node, 'user-1', []);
      const pattern = pipeline.getForPremium(1)[0];

      expect(pattern.harmReports).toBe(0);

      pipeline.reportHarm(pattern.id);
      const updated = pipeline.getPattern(pattern.id);
      expect(updated?.harmReports).toBe(1);
    });

    it('should deactivate pattern after 3 harm reports', async () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Test content',
        helpfulCount: 1,
        createdAt: new Date().toISOString(),
      };

      await pipeline.promote(node, 'user-1', []);
      const pattern = pipeline.getForPremium(1)[0];

      pipeline.reportHarm(pattern.id);
      pipeline.reportHarm(pattern.id);
      pipeline.reportHarm(pattern.id);

      const updated = pipeline.getPattern(pattern.id);
      expect(updated?.harmReports).toBe(3);
      expect(updated?.isActive).toBe(false);
    });

    it('should handle non-existent pattern gracefully', () => {
      expect(() => pipeline.reportHarm('non-existent')).not.toThrow();
    });
  });

  describe('promote', () => {
    it('should promote valid node to global pattern', async () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Use TypeScript strict mode for better type safety',
        helpfulCount: 0.9,
        createdAt: new Date().toISOString(),
        tags: ['typescript', 'best-practices'],
        language: 'typescript',
      };

      const pattern = await pipeline.promote(node, 'user-1', []);
      expect(pattern).not.toBeNull();
      expect(pattern?.canonicalContent).toContain('TypeScript');
      expect(pattern?.tags).toContain('typescript');
    });

    it('should return null for duplicate content', async () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Unique content for testing',
        helpfulCount: 0.9,
        createdAt: new Date().toISOString(),
      };

      await pipeline.promote(node, 'user-1', []);
      const duplicate = await pipeline.promote(node, 'user-2', []);

      expect(duplicate).toBeNull();
    });

    it('should return null for anti-gaming violation', async () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Some content',
        helpfulCount: 0.9,
        createdAt: new Date().toISOString(),
      };

      const logs: WeeklyPromotionLog[] = [
        { userId: 'user-1', promotionCount: 5, weekStart: getWeekStart() },
      ];

      const pattern = await pipeline.promote(node, 'user-1', logs);
      expect(pattern).toBeNull();
    });

    it('should strip sensitive data during promotion', async () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Set password=secret123 in /config/app.json',
        helpfulCount: 0.9,
        createdAt: new Date().toISOString(),
      };

      const pattern = await pipeline.promote(node, 'user-1', []);
      expect(pattern?.canonicalContent).not.toContain('secret123');
      expect(pattern?.canonicalContent).not.toContain('/config/app.json');
    });

    it('should update weekly log on successful promotion', async () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Test content',
        helpfulCount: 0.9,
        createdAt: new Date().toISOString(),
      };

      await pipeline.promote(node, 'user-1', []);
      const log = pipeline.getWeeklyLog('user-1');

      expect(log).toBeDefined();
      expect(log?.promotionCount).toBe(1);
    });
  });

  describe('getForPremium', () => {
    it('should return top active patterns by score', async () => {
      const nodes: GraphNode[] = [
        { id: 'node-1', content: 'Use TypeScript for type safety', helpfulCount: 0.9, createdAt: new Date().toISOString() },
        { id: 'node-2', content: 'React components should be pure functions', helpfulCount: 0.8, createdAt: new Date().toISOString() },
        { id: 'node-3', content: 'Database queries need proper indexing', helpfulCount: 0.7, createdAt: new Date().toISOString() },
      ];

      for (let i = 0; i < nodes.length; i++) {
        await pipeline.promote(nodes[i], `user-${i}`, []);
      }

      const patterns = pipeline.getForPremium(2);
      expect(patterns).toHaveLength(2);
      expect(patterns[0].successScore).toBeGreaterThanOrEqual(patterns[1].successScore);
    });

    it('should exclude inactive patterns', async () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Test content',
        helpfulCount: 0.9,
        createdAt: new Date().toISOString(),
      };

      await pipeline.promote(node, 'user-1', []);
      const pattern = pipeline.getForPremium(1)[0];
      pipeline.reportHarm(pattern.id);
      pipeline.reportHarm(pattern.id);
      pipeline.reportHarm(pattern.id);

      const patterns = pipeline.getForPremium(10);
      expect(patterns).toHaveLength(0);
    });

    it('should use default limit of 12', async () => {
      // Create 15 patterns
      for (let i = 0; i < 15; i++) {
        const node: GraphNode = {
          id: `node-${i}`,
          content: `Content ${i}`,
          helpfulCount: 0.9,
          createdAt: new Date().toISOString(),
        };
        await pipeline.promote(node, `user-${i}`, []);
      }

      const patterns = pipeline.getForPremium();
      expect(patterns.length).toBeLessThanOrEqual(12);
    });
  });

  describe('getForFree', () => {
    it('should return limited patterns for free tier', async () => {
      for (let i = 0; i < 10; i++) {
        const node: GraphNode = {
          id: `node-${i}`,
          content: `Content ${i}`,
          helpfulCount: 0.9,
          createdAt: new Date().toISOString(),
        };
        await pipeline.promote(node, `user-${i}`, []);
      }

      const patterns = pipeline.getForFree();
      expect(patterns.length).toBeLessThanOrEqual(4);
    });

    it('should use default limit of 4', async () => {
      const contents = [
        'TypeScript best practices for large projects',
        'React hooks patterns and anti-patterns',
        'Database optimization strategies',
        'API design principles for RESTful services',
        'Testing methodologies for frontend code',
        'CI/CD pipeline configuration tips',
        'Docker containerization best practices',
        'GraphQL schema design guidelines',
        'Authentication security considerations',
        'Performance profiling techniques',
      ];
      
      for (let i = 0; i < 10; i++) {
        const node: GraphNode = {
          id: `node-${i}`,
          content: contents[i],
          helpfulCount: 0.9,
          createdAt: new Date().toISOString(),
        };
        await pipeline.promote(node, `user-${i}`, []);
      }

      const patterns = pipeline.getForFree();
      expect(patterns.length).toBe(4);
    });
  });

  describe('pushToSubscribers', () => {
    it('should notify subscribers of new patterns', async () => {
      const received: GlobalPattern[] = [];
      const unsubscribe = pipeline.subscribe(pattern => {
        received.push(pattern);
      });

      const node: GraphNode = {
        id: 'node-1',
        content: 'Test content',
        helpfulCount: 0.9,
        createdAt: new Date().toISOString(),
      };

      await pipeline.promote(node, 'user-1', []);
      expect(received).toHaveLength(1);
      expect(received[0].canonicalContent).toBe('Test content');

      unsubscribe();
    });

    it('should allow unsubscribing', async () => {
      const received: GlobalPattern[] = [];
      const unsubscribe = pipeline.subscribe(pattern => {
        received.push(pattern);
      });

      unsubscribe();

      const node: GraphNode = {
        id: 'node-1',
        content: 'Test content',
        helpfulCount: 0.9,
        createdAt: new Date().toISOString(),
      };

      await pipeline.promote(node, 'user-1', []);
      expect(received).toHaveLength(0);
    });
  });

  describe('persist and load', () => {
    it('should persist and load patterns', async () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Test content',
        helpfulCount: 0.9,
        createdAt: new Date().toISOString(),
      };

      await pipeline.promote(node, 'user-1', []);
      await pipeline.persist();

      // Reset and reload
      resetGlobalWisdomPipeline();
      const newPipeline = getGlobalWisdomPipeline();
      await newPipeline.load();

      const patterns = newPipeline.getForPremium(10);
      expect(patterns).toHaveLength(1);
      expect(patterns[0].canonicalContent).toBe('Test content');
    });

    it('should handle missing file on load', async () => {
      resetGlobalWisdomPipeline();
      const newPipeline = getGlobalWisdomPipeline();
      await expect(newPipeline.load()).resolves.not.toThrow();
    });
  });

  describe('stats', () => {
    it('should return correct statistics', async () => {
      expect(pipeline.stats().totalPatterns).toBe(0);

      const node: GraphNode = {
        id: 'node-1',
        content: 'Test content',
        helpfulCount: 0.9,
        createdAt: new Date().toISOString(),
      };

      await pipeline.promote(node, 'user-1', []);

      const stats = pipeline.stats();
      expect(stats.totalPatterns).toBe(1);
      expect(stats.activePatterns).toBe(1);
      expect(stats.demotedPatterns).toBe(0);
      expect(stats.avgSuccessScore).toBeGreaterThan(0);
      expect(stats.topPatterns).toHaveLength(1);
    });

    it('should include demoted patterns in stats', async () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Test content',
        helpfulCount: 0.9,
        createdAt: new Date().toISOString(),
      };

      await pipeline.promote(node, 'user-1', []);
      const pattern = pipeline.getForPremium(1)[0];
      pipeline.reportHarm(pattern.id);
      pipeline.reportHarm(pattern.id);
      pipeline.reportHarm(pattern.id);

      const stats = pipeline.stats();
      expect(stats.totalPatterns).toBe(1);
      expect(stats.activePatterns).toBe(0);
      expect(stats.demotedPatterns).toBe(1);
    });

    it('should return zero averages when no patterns', () => {
      const stats = pipeline.stats();
      expect(stats.avgSuccessScore).toBe(0);
      expect(stats.topPatterns).toHaveLength(0);
    });
  });
});

// Helper function
function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}
