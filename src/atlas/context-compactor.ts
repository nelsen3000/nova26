// Context Compactor — R19-02
// Token-budgeted context for agents

import type { CompactedContext, CodeNode } from './types.js';

export interface ContextModule {
  name: string;
  purpose: string;
  keyExports: string[];
  relevanceScore: number;
  tokenEstimate: number;
}

export class ContextCompactor {
  private tokenBudget: number;

  constructor(tokenBudget: number = 4000) {
    this.tokenBudget = tokenBudget;
  }

  compact(
    projectSummary: string,
    modules: ContextModule[],
    keyPatterns: string[]
  ): CompactedContext {
    // Sort modules by relevance
    const sortedModules = [...modules].sort((a, b) => 
      b.relevanceScore - a.relevanceScore
    );
    
    // Select modules that fit within budget
    const selectedModules: ContextModule[] = [];
    let usedTokens = this.estimateTokens(projectSummary);
    
    for (const module of sortedModules) {
      if (usedTokens + module.tokenEstimate <= this.tokenBudget) {
        selectedModules.push(module);
        usedTokens += module.tokenEstimate;
      }
    }

    return {
      projectSummary,
      relevantModules: selectedModules.map(m => ({
        name: m.name,
        purpose: m.purpose,
        keyExports: m.keyExports,
      })),
      keyPatterns,
      tokenCount: usedTokens,
      expand: (moduleName: string) => this.expandModule(moduleName, modules),
    };
  }

  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token on average
    return Math.ceil(text.length / 4);
  }

  expandModule(moduleName: string, allModules: ContextModule[]): string {
    const module = allModules.find(m => m.name === moduleName);
    if (!module) {
      return `Module "${moduleName}" not found.`;
    }

    return `
## ${module.name}

**Purpose:** ${module.purpose}

**Key Exports:**
${module.keyExports.map(e => `- ${e}`).join('\n')}

**Relevance Score:** ${(module.relevanceScore * 100).toFixed(1)}%

**Token Estimate:** ${module.tokenEstimate}
    `.trim();
  }

  createFromNodes(
    projectName: string,
    description: string,
    nodes: CodeNode[],
    queryContext: string
  ): CompactedContext {
    // Group nodes by file (module)
    const fileGroups = new Map<string, CodeNode[]>();
    for (const node of nodes) {
      const existing = fileGroups.get(node.filePath) ?? [];
      existing.push(node);
      fileGroups.set(node.filePath, existing);
    }

    // Create modules from file groups
    const modules: ContextModule[] = [];
    for (const [filePath, fileNodes] of fileGroups.entries()) {
      const relevanceScore = this.calculateRelevance(fileNodes, queryContext);
      const moduleName = filePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? filePath;
      
      modules.push({
        name: moduleName,
        purpose: this.inferPurpose(fileNodes),
        keyExports: fileNodes
          .filter(n => n.type === 'export' || n.type === 'function' || n.type === 'component')
          .map(n => n.name)
          .slice(0, 10),
        relevanceScore,
        tokenEstimate: this.estimateTokens(JSON.stringify(fileNodes)),
      });
    }

    const projectSummary = `${projectName}: ${description}`;
    const keyPatterns = this.extractPatterns(nodes);

    return this.compact(projectSummary, modules, keyPatterns);
  }

  prioritizeByQuery(
    modules: ContextModule[],
    query: string
  ): ContextModule[] {
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    return modules
      .map(m => ({
        ...m,
        relevanceScore: this.scoreRelevance(m, queryTerms),
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  getBudgetUtilization(context: CompactedContext): {
    used: number;
    total: number;
    percentage: number;
  } {
    return {
      used: context.tokenCount,
      total: this.tokenBudget,
      percentage: Math.round((context.tokenCount / this.tokenBudget) * 100),
    };
  }

  isWithinBudget(context: CompactedContext): boolean {
    return context.tokenCount <= this.tokenBudget;
  }

  private calculateRelevance(nodes: CodeNode[], queryContext: string): number {
    const queryTerms = queryContext.toLowerCase().split(/\s+/);
    let score = 0;
    
    for (const node of nodes) {
      // Name matches
      if (queryTerms.some(term => node.name.toLowerCase().includes(term))) {
        score += 0.3;
      }
      
      // Semantic tag matches
      for (const tag of node.semanticTags) {
        if (queryTerms.some(term => tag.toLowerCase().includes(term))) {
          score += 0.2;
        }
      }
      
      // File path matches
      if (queryTerms.some(term => node.filePath.toLowerCase().includes(term))) {
        score += 0.1;
      }
    }
    
    return Math.min(score, 1);
  }

  private inferPurpose(nodes: CodeNode[]): string {
    const types = new Set(nodes.map(n => n.type));
    
    if (types.has('component')) return 'React component definitions';
    if (types.has('hook')) return 'Custom React hooks';
    if (types.has('api') || types.has('endpoint')) return 'API endpoints';
    if (types.has('util')) return 'Utility functions';
    if (types.has('test')) return 'Test cases';
    
    return 'Mixed functionality';
  }

  private extractPatterns(nodes: CodeNode[]): string[] {
    const patterns: string[] = [];
    
    // Detect common patterns
    const hasComponents = nodes.some(n => n.type === 'component');
    const hasHooks = nodes.some(n => n.type === 'hook');
    const hasTests = nodes.some(n => n.filePath.includes('.test.'));
    
    if (hasComponents) patterns.push('Component-based architecture');
    if (hasHooks) patterns.push('Custom hooks pattern');
    if (hasTests) patterns.push('Comprehensive test coverage');
    
    // Complexity patterns
    const highComplexity = nodes.filter(n => n.complexity > 10).length;
    if (highComplexity > 0) {
      patterns.push(`${highComplexity} complex functions identified`);
    }
    
    return patterns;
  }

  private scoreRelevance(module: ContextModule, queryTerms: string[]): number {
    let score = module.relevanceScore;
    
    const moduleText = `${module.name} ${module.purpose} ${module.keyExports.join(' ')}`.toLowerCase();
    
    for (const term of queryTerms) {
      if (moduleText.includes(term)) {
        score += 0.1;
      }
    }
    
    return Math.min(score, 1);
  }
}

export function createContextCompactor(tokenBudget?: number): ContextCompactor {
  return new ContextCompactor(tokenBudget);
}
