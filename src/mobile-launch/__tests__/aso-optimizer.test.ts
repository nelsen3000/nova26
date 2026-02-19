// ASO Optimizer Tests — R19-01

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ASOOptimizerEngine,
  createASOOptimizer,
} from '../aso-optimizer.js';

describe('ASOOptimizerEngine', () => {
  let optimizer: ASOOptimizerEngine;

  beforeEach(() => {
    optimizer = new ASOOptimizerEngine();
  });

  describe('analyzeKeywords()', () => {
    it('should extract keywords from description', () => {
      const analysis = optimizer.analyzeKeywords(
        'This amazing productivity app helps you manage tasks efficiently',
        [],
        'en-US'
      );

      expect(analysis.length).toBeGreaterThan(0);
      expect(analysis.some(a => a.keyword === 'productivity')).toBe(true);
    });

    it('should calculate keyword metrics', () => {
      const analysis = optimizer.analyzeKeywords(
        'Productivity app for task management',
        [],
        'en-US'
      );

      const keyword = analysis.find(a => a.keyword === 'productivity');
      expect(keyword?.volume).toBeGreaterThan(0);
      expect(keyword?.relevance).toBeGreaterThan(0);
      expect(keyword?.competition).toBeDefined();
    });

    it('should sort by relevance and volume', () => {
      const analysis = optimizer.analyzeKeywords(
        'Task task task management app productivity',
        [],
        'en-US'
      );

      // 'task' appears more frequently, should rank higher
      expect(analysis[0].keyword).toBe('task');
    });

    it('should filter short words', () => {
      const analysis = optimizer.analyzeKeywords(
        'A great app for the best user experience',
        [],
        'en-US'
      );

      // Words like 'a', 'the', 'for' should be filtered (< 4 chars)
      expect(analysis.some(a => a.keyword === 'a')).toBe(false);
      expect(analysis.some(a => a.keyword === 'the')).toBe(false);
    });

    it('should handle empty description', () => {
      const analysis = optimizer.analyzeKeywords('', [], 'en-US');
      expect(analysis).toEqual([]);
    });
  });

  describe('generateSubtitle()', () => {
    it('should generate subtitle from keywords', () => {
      const subtitle = optimizer.generateSubtitle(
        'MyApp',
        ['productivity', 'tasks', 'management'],
        30
      );

      expect(subtitle).toContain('productivity');
      expect(subtitle.length).toBeLessThanOrEqual(30);
    });

    it('should respect max length', () => {
      const longKeywords = ['verylongkeywordname', 'anotherlongkeyword'];
      const subtitle = optimizer.generateSubtitle('MyApp', longKeywords, 20);

      expect(subtitle.length).toBeLessThanOrEqual(20);
    });

    it('should handle empty keywords', () => {
      const subtitle = optimizer.generateSubtitle('MyApp', [], 30);
      expect(subtitle).toBeDefined();
    });
  });

  describe('generateDescription()', () => {
    it('should include features list', () => {
      const description = optimizer.generateDescription(
        ['Feature 1', 'Feature 2', 'Feature 3'],
        ['keyword1', 'keyword2'],
        'en-US'
      );

      expect(description).toContain('Feature 1');
      expect(description).toContain('Key Features');
    });

    it('should include keywords paragraph', () => {
      const description = optimizer.generateDescription(
        ['Feature'],
        ['keyword1', 'keyword2', 'keyword3'],
        'en-US'
      );

      expect(description).toContain('Keywords:');
      expect(description).toContain('keyword1');
    });

    it('should format with paragraphs', () => {
      const description = optimizer.generateDescription(
        ['Feature 1', 'Feature 2'],
        ['keyword'],
        'en-US'
      );

      expect(description.split('\n\n').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('suggestCategories()', () => {
    it('should suggest categories based on description', () => {
      const suggestions = optimizer.suggestCategories(
        'A productivity app for managing tasks and organizing work',
        ['Task management', 'Scheduling']
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].relevance).toBeGreaterThan(0);
    });

    it('should include Productivity for task-related apps', () => {
      const suggestions = optimizer.suggestCategories(
        'Task management and scheduling app',
        ['Tasks']
      );

      expect(suggestions.some(s => s.name === 'Productivity')).toBe(true);
    });

    it('should include Social Networking for chat apps', () => {
      const suggestions = optimizer.suggestCategories(
        'Chat and connect with friends',
        ['Messaging']
      );

      expect(suggestions.some(s => s.name === 'Social Networking')).toBe(true);
    });

    it('should sort by relevance', () => {
      const suggestions = optimizer.suggestCategories(
        'Task management and chat app',
        ['Tasks', 'Chat']
      );

      expect(suggestions[0].relevance).toBeGreaterThanOrEqual(
        suggestions[suggestions.length - 1]?.relevance ?? 0
      );
    });
  });

  describe('calculateProjectedScore()', () => {
    it('should calculate score based on keywords', () => {
      const keywords = [
        { keyword: 'test', volume: 80, relevance: 0.9, difficulty: 30, competition: 'low' as const },
        { keyword: 'app', volume: 100, relevance: 0.8, difficulty: 50, competition: 'medium' as const },
      ];

      const score = optimizer.calculateProjectedScore(
        keywords,
        'Productivity',
        { average: 4.5, count: 1000 }
      );

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should consider ratings', () => {
      const keywords = [{ keyword: 'test', volume: 50, relevance: 0.5, difficulty: 50, competition: 'medium' as const }];
      
      const highRating = optimizer.calculateProjectedScore(keywords, 'Category', { average: 5, count: 10000 });
      const lowRating = optimizer.calculateProjectedScore(keywords, 'Category', { average: 2, count: 10000 });

      expect(highRating).toBeGreaterThan(lowRating);
    });

    it('should cap at 100', () => {
      const keywords = Array(10).fill({
        keyword: 'test',
        volume: 100,
        relevance: 1,
        difficulty: 0,
        competition: 'low' as const,
      });

      const score = optimizer.calculateProjectedScore(
        keywords,
        'Category',
        { average: 5, count: 100000 }
      );

      expect(score).toBe(100);
    });
  });

  describe('optimizeForLocale()', () => {
    it('should change locale in result', () => {
      const original = {
        keywords: ['productivity'],
        subtitle: 'Productivity App',
        description: 'A productivity app',
        suggestedCategories: ['Productivity'],
        projectedScore: 80,
        locale: 'en-US',
      };

      const localized = optimizer.optimizeForLocale(original, 'es-ES');
      expect(localized.locale).toBe('es-ES');
    });

    it('should preserve other properties', () => {
      const original = {
        keywords: ['productivity'],
        subtitle: 'Productivity App',
        description: 'A productivity app',
        suggestedCategories: ['Productivity'],
        projectedScore: 80,
        locale: 'en-US',
      };

      const localized = optimizer.optimizeForLocale(original, 'fr-FR');
      expect(localized.projectedScore).toBe(80);
    });
  });

  describe('detectDuplicateKeywords()', () => {
    it('should detect exact duplicates', () => {
      const duplicates = optimizer.detectDuplicateKeywords([
        'productivity',
        'task',
        'productivity',
      ]);

      expect(duplicates).toContain('productivity');
    });

    it('should detect case-insensitive duplicates', () => {
      const duplicates = optimizer.detectDuplicateKeywords([
        'Productivity',
        'productivity',
        'PRODUCTIVITY',
      ]);

      expect(duplicates.length).toBeGreaterThan(0);
    });

    it('should return empty array when no duplicates', () => {
      const duplicates = optimizer.detectDuplicateKeywords([
        'productivity',
        'tasks',
        'management',
      ]);

      expect(duplicates).toHaveLength(0);
    });
  });

  describe('createASOOptimizer()', () => {
    it('should create a new optimizer instance', () => {
      const optimizer = createASOOptimizer();
      expect(optimizer).toBeInstanceOf(ASOOptimizerEngine);
    });
  });
});
