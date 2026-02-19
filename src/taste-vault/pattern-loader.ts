// BistroLens Pattern Loader — Imports Kiro-extracted patterns into Taste Vault
// KIMI-INTEGRATE-03: Kiro BistroLens extraction spec

import { readdirSync, readFileSync } from 'fs';
import { join, basename, dirname } from 'path';
import { getGraphMemory, type GraphNode, type NodeType } from './graph-memory.js';
import { getSemanticDedup } from '../similarity/semantic-dedup.js';

// ============================================================================
// Core Types
// ============================================================================

export interface PatternParseResult {
  filename: string;
  category: string;
  title: string;
  description: string;
  codeExamples: string[];
  tags: string[];
  priority: string;
  reusability: number;
  sourceFile: string;
  rawContent: string;
}

export interface PatternLoadResult {
  loaded: number;
  skipped: number;
  errors: number;
  nodes: GraphNode[];
  errorDetails: string[];
}

interface PatternLoaderOptions {
  userId?: string;
  confidence?: number;
  dryRun?: boolean;
}

// ============================================================================
// PatternLoader Class
// ============================================================================

class PatternLoader {
  private userId: string;
  private confidence: number;
  private dryRun: boolean;

  constructor(options: PatternLoaderOptions = {}) {
    this.userId = options.userId ?? 'bistrolens-import';
    this.confidence = options.confidence ?? 0.85;
    this.dryRun = options.dryRun ?? false;
  }

  async loadPatternsFromDirectory(dir: string): Promise<PatternLoadResult> {
    const result: PatternLoadResult = {
      loaded: 0,
      skipped: 0,
      errors: 0,
      nodes: [],
      errorDetails: [],
    };

    try {
      // Find all .md files recursively
      const files = this.findMarkdownFiles(dir);

      // Parse each file
      const parsedPatterns: PatternParseResult[] = [];
      for (const filePath of files) {
        try {
          const parsed = this.parsePatternFile(filePath);
          parsedPatterns.push(parsed);
        } catch (error) {
          result.errors++;
          result.errorDetails.push(`Failed to parse ${filePath}: ${error}`);
        }
      }

      // Convert to GraphNode format
      const nodes = parsedPatterns.map(p => this.toGraphNode(p));

      // Run dedup check
      const { unique, duplicates } = await this.dedupCheck(nodes);
      result.skipped = duplicates;

      if (this.dryRun) {
        result.loaded = unique.length;
        return result;
      }

      // Import non-duplicate nodes
      if (unique.length > 0) {
        const imported = await this.importPatterns(unique);
        result.loaded = imported.length;
        result.nodes = imported;

        // Create category edges
        this.createCategoryEdges(imported);
      }
    } catch (error) {
      result.errors++;
      result.errorDetails.push(`Failed to load patterns: ${error}`);
    }

    return result;
  }

  private findMarkdownFiles(dir: string): string[] {
    const files: string[] = [];
    const skipFiles = ['KIRO-COMBINED-TASK.md', 'KIRO-EXTRACTION-TASK.md'];

    const scan = (currentDir: string): void => {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md') && !skipFiles.includes(entry.name)) {
          files.push(fullPath);
        }
      }
    };

    scan(dir);
    return files;
  }

  parsePatternFile(filePath: string): PatternParseResult {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Extract title from first H1
    let title = '';
    let titleIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('# ')) {
        title = line.slice(2).trim();
        titleIndex = i;
        break;
      }
    }

    // Extract description from first non-empty paragraph after title
    let description = '';
    if (titleIndex >= 0) {
      for (let i = titleIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith('#') && !line.startsWith('**')) {
          description = line.slice(0, 500);
          break;
        }
      }
    }

    // Extract code examples
    const codeExamples: string[] = [];
    let inCodeBlock = false;
    let currentBlock: string[] = [];
    for (const line of lines) {
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          codeExamples.push(currentBlock.join('\n'));
          currentBlock = [];
        }
        inCodeBlock = !inCodeBlock;
      } else if (inCodeBlock) {
        currentBlock.push(line);
      }
    }

    // Extract tags from ## headings
    const tags: string[] = [];
    const category = basename(dirname(filePath)).replace(/^\d+-/, '');
    tags.push(category);
    for (const line of lines) {
      if (line.startsWith('## ')) {
        const heading = line.slice(3).trim();
        if (!heading.includes('---')) {
          tags.push(heading.toLowerCase().replace(/\s+/g, '-'));
        }
      }
    }

    // Extract priority from frontmatter
    let priority = 'P2';
    const priorityMatch = content.match(/\*\*Priority:\*\*\s*(P[0-3])/i);
    if (priorityMatch) {
      priority = priorityMatch[1].toUpperCase();
    }

    // Extract reusability from frontmatter
    let reusability = 5;
    const reusabilityMatch = content.match(/\*\*Reusability:\*\*\s*(\d+)\s*\/\s*10/i);
    if (reusabilityMatch) {
      reusability = parseInt(reusabilityMatch[1], 10);
    }

    return {
      filename: basename(filePath),
      category,
      title,
      description,
      codeExamples,
      tags,
      priority,
      reusability,
      sourceFile: filePath,
      rawContent: content.slice(0, 3000),
    };
  }

  private toGraphNode(parsed: PatternParseResult): Omit<GraphNode, 'id' | 'createdAt' | 'updatedAt'> {
    const isNovaAdaptation = parsed.category.includes('nova26') || parsed.sourceFile.includes('17-nova26');
    const baseConfidence = isNovaAdaptation ? 0.95 : (this.confidence ?? 0.85);
    const adjustedConfidence = Math.min(0.99, baseConfidence + parsed.reusability * 0.01);

    // Build content
    let content = `${parsed.title}\n\n${parsed.description}`;
    if (parsed.codeExamples.length > 0) {
      content += `\n\nExample:\n${parsed.codeExamples[0].slice(0, 500)}`;
    }

    // Detect language
    let language: string | undefined;
    const codeText = parsed.codeExamples.join(' ').toLowerCase();
    if (codeText.includes('tsx') || codeText.includes('jsx')) {
      language = 'typescript';
    } else if (codeText.includes('typescript') || codeText.includes('.ts')) {
      language = 'typescript';
    }

    return {
      type: this.nodeTypeForCategory(parsed.category),
      content,
      confidence: adjustedConfidence,
      helpfulCount: 0,
      userId: this.userId,
      isGlobal: true,
      globalSuccessCount: 0,
      tags: parsed.tags,
      language,
    };
  }

  private nodeTypeForCategory(category: string): NodeType {
    // Strip leading digits and hyphens
    const cleanCategory = category.replace(/^\d+-/, '').toLowerCase();

    const patternCategories = [
      'security', 'code-governance', 'image-governance',
      'api-cost-protection', 'cost-protection',
      'database-patterns', 'error-handling', 'deployment'
    ];

    const strategyCategories = [
      'steering-system', 'quality-gates', 'testing-strategies',
      'monitoring', 'business-logic', 'ai-prompts'
    ];

    const preferenceCategories = [
      'design-system', 'i18n', 'performance',
      'documentation', 'nova26-adaptations'
    ];

    if (patternCategories.some(c => cleanCategory.includes(c))) return 'Pattern';
    if (strategyCategories.some(c => cleanCategory.includes(c))) return 'Strategy';
    if (preferenceCategories.some(c => cleanCategory.includes(c))) return 'Preference';

    return 'Pattern';
  }

  async importPatterns(nodes: Array<Omit<GraphNode, 'id' | 'createdAt' | 'updatedAt'>>): Promise<GraphNode[]> {
    const graphMemory = getGraphMemory(this.userId);
    const imported: GraphNode[] = [];

    for (const node of nodes) {
      try {
        const created = graphMemory.addNode(node);
        imported.push(created);
      } catch (error) {
        console.warn(`PatternLoader: failed to import node: ${error}`);
      }
    }

    console.log(`PatternLoader: imported ${imported.length} BistroLens patterns`);
    return imported;
  }

  private createCategoryEdges(nodes: GraphNode[]): void {
    try {
      const graphMemory = getGraphMemory(this.userId);
      const byCategory = new Map<string, GraphNode[]>();

      // Group nodes by first tag (category)
      for (const node of nodes) {
        const category = node.tags[0];
        if (!category) continue;

        const group = byCategory.get(category) ?? [];
        group.push(node);
        byCategory.set(category, group);
      }

      // Create edges between consecutive nodes in each category
      for (const categoryNodes of byCategory.values()) {
        if (categoryNodes.length < 2) continue;

        for (let i = 0; i < categoryNodes.length - 1; i++) {
          try {
            graphMemory.addEdge({
              sourceId: categoryNodes[i].id,
              targetId: categoryNodes[i + 1].id,
              relation: 'supports',
              strength: 0.7,
            });
          } catch {
            // Ignore edge creation errors
          }
        }
      }
    } catch (error) {
      console.warn('PatternLoader: error creating category edges:', error);
    }
  }

  async dedupCheck(nodes: Array<Omit<GraphNode, 'id' | 'createdAt' | 'updatedAt'>>): Promise<{
    unique: Array<Omit<GraphNode, 'id' | 'createdAt' | 'updatedAt'>>;
    duplicates: number;
  }> {
    const unique: Array<Omit<GraphNode, 'id' | 'createdAt' | 'updatedAt'>> = [];
    let duplicates = 0;

    try {
      const dedup = getSemanticDedup();
      const existingNodes = getGraphMemory(this.userId).search(''); // Get all nodes

      for (const node of nodes) {
        try {
          const result = await dedup.isDuplicate(
            { id: 'temp', content: node.content },
            existingNodes.map(n => ({ id: n.id, content: n.content }))
          );

          if (result.isDuplicate) {
            duplicates++;
          } else {
            unique.push(node);
          }
        } catch {
          // If dedup fails, allow the node through
          unique.push(node);
        }
      }
    } catch (error) {
      console.warn('PatternLoader: dedup check failed, allowing all nodes:', error);
      return { unique: nodes, duplicates: 0 };
    }

    return { unique, duplicates };
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let instance: PatternLoader | null = null;

export function getPatternLoader(options?: PatternLoaderOptions): PatternLoader {
  if (!instance) {
    instance = new PatternLoader(options);
  }
  return instance;
}

export function resetPatternLoader(): void {
  instance = null;
}

export { PatternLoader };

// CLI Usage (future: nova26 import-patterns <directory>):
//
//   const loader = getPatternLoader({ dryRun: false });
//   const result = await loader.loadPatternsFromDirectory('.nova/bistrolens-knowledge');
//   console.log(`Loaded: ${result.loaded}, Skipped: ${result.skipped}, Errors: ${result.errors}`);
//   if (result.errorDetails.length > 0) {
//     console.error('Import errors:', result.errorDetails.join('\n'));
//   }
