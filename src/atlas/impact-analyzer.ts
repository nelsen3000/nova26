// Impact Analyzer — R19-02
// Query impact radius, risk scoring, visualization

import type { CodeNode, ImpactAnalysisResult } from './types.js';
import { SemanticModel } from './semantic-model.js';

export class ImpactAnalyzer {
  private model: SemanticModel;

  constructor(model: SemanticModel) {
    this.model = model;
  }

  analyzeImpact(
    changedNodeId: string,
    _changeDescription: string = ''
  ): ImpactAnalysisResult | null {
    const changedNode = this.model.getNode(changedNodeId);
    if (!changedNode) {
      return null;
    }

    // Query impact radius
    const { nodes: affectedNodes, depth } = this.model.queryImpactRadius(changedNodeId, 5);
    
    // Get unique affected files
    const affectedFiles = [...new Set(affectedNodes.map(n => n.filePath))];
    
    // Calculate risk level
    const riskLevel = this.calculateRiskLevel(changedNode, affectedNodes, depth);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(changedNode, affectedNodes);
    
    // Generate visualization
    const visualization = this.generateMermaidDiagram(changedNode, affectedNodes);
    
    // Suggest tests
    const suggestedTests = this.suggestTests(changedNode, affectedNodes);

    return {
      changedNode,
      affectedNodes,
      affectedFiles,
      riskLevel,
      confidence,
      visualization,
      suggestedTests,
    };
  }

  calculateRiskLevel(
    changedNode: CodeNode,
    affectedNodes: CodeNode[],
    impactDepth: number
  ): ImpactAnalysisResult['riskLevel'] {
    let score = 0;
    
    // Factor 1: Complexity of changed node
    if (changedNode.complexity > 15) score += 3;
    else if (changedNode.complexity > 10) score += 2;
    else if (changedNode.complexity > 5) score += 1;
    
    // Factor 2: Number of affected nodes
    if (affectedNodes.length > 20) score += 3;
    else if (affectedNodes.length > 10) score += 2;
    else if (affectedNodes.length > 5) score += 1;
    
    // Factor 3: Impact depth
    if (impactDepth > 4) score += 3;
    else if (impactDepth > 2) score += 2;
    else if (impactDepth > 1) score += 1;
    
    // Factor 4: Test coverage of changed node
    if (changedNode.testCoverage < 30) score += 2;
    else if (changedNode.testCoverage < 60) score += 1;
    
    // Factor 5: Change frequency (hot spots are riskier)
    if (changedNode.changeFrequency > 10) score += 1;
    
    // Map score to risk level
    if (score >= 8) return 'critical';
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  calculateConfidence(changedNode: CodeNode, affectedNodes: CodeNode[]): number {
    let confidence = 1.0;
    
    // Reduce confidence if changed node has low test coverage
    confidence *= (0.5 + (changedNode.testCoverage / 200));
    
    // Reduce confidence for many affected nodes
    if (affectedNodes.length > 50) confidence *= 0.7;
    else if (affectedNodes.length > 20) confidence *= 0.85;
    
    // Reduce confidence if any affected node has low coverage
    const lowCoverageNodes = affectedNodes.filter(n => n.testCoverage < 30);
    if (lowCoverageNodes.length > affectedNodes.length / 2) {
      confidence *= 0.8;
    }
    
    return Math.round(confidence * 100) / 100;
  }

  generateMermaidDiagram(changedNode: CodeNode, affectedNodes: CodeNode[]): string {
    const lines: string[] = ['graph TD'];
    const nodeIds = new Set<string>();
    
    // Add changed node (highlighted)
    const changedId = this.sanitizeId(changedNode.id);
    lines.push(`  ${changedId}["${changedNode.name}"]:::changed`);
    nodeIds.add(changedNode.id);
    
    // Add affected nodes
    for (const node of affectedNodes.slice(0, 20)) { // Limit for readability
      if (!nodeIds.has(node.id)) {
        const id = this.sanitizeId(node.id);
        lines.push(`  ${id}["${node.name}"]`);
        nodeIds.add(node.id);
      }
    }
    
    // Add edges (simplified)
    for (const node of affectedNodes.slice(0, 10)) {
      const fromId = this.sanitizeId(changedNode.id);
      const toId = this.sanitizeId(node.id);
      lines.push(`  ${fromId} --> ${toId}`);
    }
    
    // Add styling
    lines.push('  classDef changed fill:#f96,stroke:#333,stroke-width:4px');
    
    return lines.join('\n');
  }

  suggestTests(changedNode: CodeNode, affectedNodes: CodeNode[]): string[] {
    const suggestions: string[] = [];
    
    // Always suggest test for changed node
    if (changedNode.testCoverage < 80) {
      suggestions.push(`Increase test coverage for ${changedNode.name} (${changedNode.testCoverage}%)`);
    }
    
    // Suggest integration tests for high-impact changes
    const highComplexityNodes = affectedNodes.filter(n => n.complexity > 10);
    if (highComplexityNodes.length > 0) {
      suggestions.push(`Add integration tests for ${highComplexityNodes.length} complex dependent modules`);
    }
    
    // Suggest regression tests for frequently changed code
    if (changedNode.changeFrequency > 5) {
      suggestions.push('Add regression tests for hot-spot code path');
    }
    
    // Suggest E2E tests if components are affected
    const components = affectedNodes.filter(n => n.type === 'component');
    if (components.length > 0) {
      suggestions.push(`Add E2E tests for ${components.length} affected components`);
    }
    
    return suggestions;
  }

  batchAnalyze(changedNodeIds: string[]): ImpactAnalysisResult[] {
    return changedNodeIds
      .map(id => this.analyzeImpact(id))
      .filter((result): result is ImpactAnalysisResult => result !== null);
  }

  findHighestRiskNodes(limit: number = 10): Array<{ node: CodeNode; riskScore: number }> {
    const allNodes = Array.from(this.model['graph'].nodes.values());
    
    return allNodes
      .map(node => {
        const { nodes: affected } = this.model.queryImpactRadius(node.id, 3);
        const riskLevel = this.calculateRiskLevel(node, affected, 0);
        const riskScore = this.riskLevelToScore(riskLevel);
        return { node, riskScore };
      })
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, limit);
  }

  compareImpact(beforeId: string, afterId: string): {
    increased: CodeNode[];
    decreased: CodeNode[];
    unchanged: CodeNode[];
  } {
    const before = this.analyzeImpact(beforeId);
    const after = this.analyzeImpact(afterId);
    
    if (!before || !after) {
      return { increased: [], decreased: [], unchanged: [] };
    }
    
    const beforeIds = new Set(before.affectedNodes.map(n => n.id));
    const afterIds = new Set(after.affectedNodes.map(n => n.id));
    
    const increased = after.affectedNodes.filter(n => !beforeIds.has(n.id));
    const decreased = before.affectedNodes.filter(n => !afterIds.has(n.id));
    const unchanged = after.affectedNodes.filter(n => beforeIds.has(n.id));
    
    return { increased, decreased, unchanged };
  }

  private sanitizeId(id: string): string {
    return id
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/^[0-9]/, '_$&')
      .slice(0, 50);
  }

  private riskLevelToScore(riskLevel: ImpactAnalysisResult['riskLevel']): number {
    const scores: Record<string, number> = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4,
    };
    return scores[riskLevel] ?? 0;
  }
}

export function createImpactAnalyzer(model: SemanticModel): ImpactAnalyzer {
  return new ImpactAnalyzer(model);
}
