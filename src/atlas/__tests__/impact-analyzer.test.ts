// Impact Analyzer Tests — R19-02

import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticModel } from '../semantic-model.js';
import { ImpactAnalyzer, createImpactAnalyzer } from '../impact-analyzer.js';

describe('ImpactAnalyzer', () => {
  let model: SemanticModel;
  let analyzer: ImpactAnalyzer;

  beforeEach(() => {
    model = new SemanticModel();
    analyzer = new ImpactAnalyzer(model);
  });

  describe('analyzeImpact()', () => {
    it('should return null for non-existent node', () => {
      const result = analyzer.analyzeImpact('nonexistent');
      expect(result).toBeNull();
    });

    it('should analyze impact of a simple change', () => {
      const node = model.addNode({
        type: 'function',
        name: 'base',
        filePath: 'src/base.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 3,
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      });

      const result = analyzer.analyzeImpact(node.id);

      expect(result).toBeDefined();
      expect(result?.changedNode.id).toBe(node.id);
      expect(result?.riskLevel).toBeDefined();
    });

    it('should identify affected nodes', () => {
      const base = model.addNode({
        type: 'function',
        name: 'base',
        filePath: 'src/base.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      });

      const dependent = model.addNode({
        type: 'function',
        name: 'user',
        filePath: 'src/user.ts',
        location: { line: 1, column: 0 },
        complexity: 3,
        changeFrequency: 0,
        testCoverage: 60,
        semanticTags: [],
        dependents: [],
      });

      model.addEdge({ fromId: dependent.id, toId: base.id, type: 'calls' });

      const result = analyzer.analyzeImpact(base.id);
      expect(result?.affectedNodes).toHaveLength(1);
      expect(result?.affectedFiles).toContain('src/user.ts');
    });
  });

  describe('calculateRiskLevel()', () => {
    it('should calculate low risk for simple changes', () => {
      const node = model.addNode({
        type: 'function',
        name: 'simple',
        filePath: 'src/simple.ts',
        location: { line: 1, column: 0 },
        complexity: 3,
        changeFrequency: 1,
        testCoverage: 90,
        semanticTags: [],
        dependents: [],
      });

      const risk = analyzer.calculateRiskLevel(node, [], 0);
      expect(risk).toBe('low');
    });

    it('should calculate critical risk for complex changes', () => {
      const node = model.addNode({
        type: 'function',
        name: 'complex',
        filePath: 'src/complex.ts',
        location: { line: 1, column: 0 },
        complexity: 20,
        changeFrequency: 15,
        testCoverage: 20,
        semanticTags: [],
        dependents: [],
      });

      const affectedNodes = Array(25).fill(null).map((_, i) => ({
        id: `node-${i}`,
        type: 'function' as const,
        name: `affected${i}`,
        filePath: 'src/other.ts',
        location: { line: i, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 50,
        semanticTags: [],
        dependents: [],
      }));

      const risk = analyzer.calculateRiskLevel(node, affectedNodes, 5);
      expect(risk).toBe('critical');
    });

    it('should consider test coverage', () => {
      const lowCoverage = model.addNode({
        type: 'function',
        name: 'lowCoverage',
        filePath: 'src/low.ts',
        location: { line: 1, column: 0 },
        complexity: 10,
        changeFrequency: 0,
        testCoverage: 10,
        semanticTags: [],
        dependents: [],
      });

      const highCoverage = model.addNode({
        type: 'function',
        name: 'highCoverage',
        filePath: 'src/high.ts',
        location: { line: 1, column: 0 },
        complexity: 10,
        changeFrequency: 0,
        testCoverage: 95,
        semanticTags: [],
        dependents: [],
      });

      const lowRisk = analyzer.calculateRiskLevel(lowCoverage, [], 0);
      const highRisk = analyzer.calculateRiskLevel(highCoverage, [], 0);

      expect(lowRisk).not.toBe('low');
      expect(highRisk).toBe('low');
    });
  });

  describe('calculateConfidence()', () => {
    it('should be high for well-tested code', () => {
      const node = model.addNode({
        type: 'function',
        name: 'wellTested',
        filePath: 'src/tested.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 95,
        semanticTags: [],
        dependents: [],
      });

      const confidence = analyzer.calculateConfidence(node, []);
      expect(confidence).toBeGreaterThan(0.9);
    });

    it('should be lower for poorly tested code', () => {
      const node = model.addNode({
        type: 'function',
        name: 'poorlyTested',
        filePath: 'src/poor.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 10,
        semanticTags: [],
        dependents: [],
      });

      const confidence = analyzer.calculateConfidence(node, []);
      expect(confidence).toBeLessThan(0.8);
    });
  });

  describe('generateMermaidDiagram()', () => {
    it('should generate valid mermaid syntax', () => {
      const node = model.addNode({
        type: 'function',
        name: 'main',
        filePath: 'src/main.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      });

      const diagram = analyzer.generateMermaidDiagram(node, []);
      expect(diagram).toContain('graph TD');
      expect(diagram).toContain('classDef changed');
    });

    it('should include affected nodes', () => {
      const main = model.addNode({
        type: 'function',
        name: 'main',
        filePath: 'src/main.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      });

      const affected = model.addNode({
        id: 'affected-id',
        type: 'function',
        name: 'helper',
        filePath: 'src/helper.ts',
        location: { line: 1, column: 0 },
        complexity: 3,
        changeFrequency: 0,
        testCoverage: 60,
        semanticTags: [],
        dependents: [],
      });

      const diagram = analyzer.generateMermaidDiagram(main, [affected]);
      expect(diagram).toContain('helper');
    });
  });

  describe('suggestTests()', () => {
    it('should suggest tests for low coverage', () => {
      const node = model.addNode({
        type: 'function',
        name: 'lowCoverage',
        filePath: 'src/low.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 30,
        semanticTags: [],
        dependents: [],
      });

      const suggestions = analyzer.suggestTests(node, []);
      expect(suggestions.some(s => s.includes('coverage'))).toBe(true);
    });

    it('should suggest integration tests for complex dependents', () => {
      const node = model.addNode({
        type: 'function',
        name: 'base',
        filePath: 'src/base.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      });

      const affected = model.addNode({
        id: 'complex-id',
        type: 'function',
        name: 'complex',
        filePath: 'src/complex.ts',
        location: { line: 1, column: 0 },
        complexity: 15,
        changeFrequency: 0,
        testCoverage: 60,
        semanticTags: [],
        dependents: [],
      });

      const suggestions = analyzer.suggestTests(node, [affected]);
      expect(suggestions.some(s => s.includes('integration'))).toBe(true);
    });

    it('should suggest regression tests for hot spots', () => {
      const node = model.addNode({
        type: 'function',
        name: 'hotSpot',
        filePath: 'src/hot.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 10,
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      });

      const suggestions = analyzer.suggestTests(node, []);
      expect(suggestions.some(s => s.includes('regression'))).toBe(true);
    });
  });

  describe('batchAnalyze()', () => {
    it('should analyze multiple nodes', () => {
      const node1 = model.addNode({
        type: 'function',
        name: 'func1',
        filePath: 'src/1.ts',
        location: { line: 1, column: 0 },
        complexity: 5,
        changeFrequency: 0,
        testCoverage: 80,
        semanticTags: [],
        dependents: [],
      });

      const node2 = model.addNode({
        type: 'function',
        name: 'func2',
        filePath: 'src/2.ts',
        location: { line: 1, column: 0 },
        complexity: 3,
        changeFrequency: 0,
        testCoverage: 60,
        semanticTags: [],
        dependents: [],
      });

      const results = analyzer.batchAnalyze([node1.id, node2.id]);
      expect(results).toHaveLength(2);
    });
  });

  describe('findHighestRiskNodes()', () => {
    it('should return nodes sorted by risk', () => {
      model.addNode({
        type: 'function',
        name: 'lowRisk',
        filePath: 'src/low.ts',
        location: { line: 1, column: 0 },
        complexity: 2,
        changeFrequency: 0,
        testCoverage: 95,
        semanticTags: [],
        dependents: [],
      });

      model.addNode({
        type: 'function',
        name: 'highRisk',
        filePath: 'src/high.ts',
        location: { line: 1, column: 0 },
        complexity: 20,
        changeFrequency: 15,
        testCoverage: 20,
        semanticTags: [],
        dependents: [],
      });

      const risks = analyzer.findHighestRiskNodes(2);
      expect(risks[0].riskScore).toBeGreaterThanOrEqual(risks[1].riskScore);
    });
  });

  describe('createImpactAnalyzer()', () => {
    it('should create an analyzer instance', () => {
      const analyzer = createImpactAnalyzer(model);
      expect(analyzer).toBeInstanceOf(ImpactAnalyzer);
    });
  });
});
