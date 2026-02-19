// Semantic Code Search — Natural language codebase search using TypeScript AST + embeddings
// KIMI-FRONTIER-02: Grok R13-03 spec

import ts from 'typescript';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { createHash } from 'crypto';
import { z } from 'zod';
import { getSemanticDedup } from '../similarity/semantic-dedup.js';

// ============================================================================
// Core Types
// ============================================================================

export interface CodeUnit {
  id: string;
  filePath: string;
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'method';
  docstring: string;
  signature: string;
  startLine: number;
  endLine: number;
  embedding?: number[];
  indexedAt: string;
}

export interface SearchResult {
  unit: CodeUnit;
  score: number;
  relevance: 'high' | 'medium' | 'low';
}

export interface ImpactAnalysis {
  filePath: string;
  affectedFiles: string[];
  affectedSymbols: Array<{
    symbol: string;
    usedIn: string[];
  }>;
  radius: 'contained' | 'moderate' | 'widespread';
  rootEntry?: CodeUnit;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const CodeUnitSchema = z.object({
  id: z.string(),
  filePath: z.string(),
  name: z.string(),
  kind: z.enum(['function', 'class', 'interface', 'type', 'variable', 'method']),
  docstring: z.string(),
  signature: z.string(),
  startLine: z.number().int().nonnegative(),
  endLine: z.number().int().nonnegative(),
  embedding: z.array(z.number()).optional(),
  indexedAt: z.string(),
});

export const CodeIndexFileSchema = z.object({
  version: z.literal('1'),
  projectRoot: z.string(),
  indexedAt: z.string(),
  units: z.array(CodeUnitSchema),
});

// ============================================================================
// CodeIndex Class
// ============================================================================

class CodeIndex {
  private units: CodeUnit[] = [];
  private projectRoot: string;
  private _embeddingModel: string;
  private indexPath: string;
  private _ollamaBaseUrl: string;
  private excludePatterns: string[];

  constructor(options?: {
    projectRoot?: string;
    embeddingModel?: string;
    indexPath?: string;
    ollamaBaseUrl?: string;
    excludePatterns?: string[];
  }) {
    this.projectRoot = options?.projectRoot ?? process.cwd();
    this._embeddingModel = options?.embeddingModel ?? 'nomic-embed-text';
    this._ollamaBaseUrl = options?.ollamaBaseUrl ?? 'http://localhost:11434';
    this.excludePatterns = options?.excludePatterns ?? ['node_modules', 'dist', '.nova', '.git'];
    
    // Compute project hash for index path
    const projectHash = createHash('sha256').update(this.projectRoot).digest('hex').slice(0, 12);
    this.indexPath = options?.indexPath ?? join(process.cwd(), '.nova', 'code-index', `${projectHash}.json`);
  }

  get embeddingModel(): string {
    return this._embeddingModel;
  }

  get ollamaBaseUrl(): string {
    return this._ollamaBaseUrl;
  }

  // ---- Indexing ----

  async buildIndex(projectRoot?: string): Promise<void> {
    const root = projectRoot ?? this.projectRoot;
    const files = this.discoverFiles(root);
    
    this.units = [];
    
    for (const filePath of files) {
      try {
        const fileUnits = await this.parseFile(filePath);
        
        for (const unit of fileUnits) {
          await this.embedUnit(unit);
          this.units.push(unit);
        }
      } catch (error) {
        console.warn(`CodeIndex: failed to parse ${filePath}:`, error);
      }
    }

    await this.saveIndex();
    console.log(`CodeIndex: indexed ${this.units.length} units from ${files.length} files`);
  }

  private discoverFiles(dir: string): string[] {
    const files: string[] = [];
    
    const scan = (currentDir: string): void => {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip excluded directories
          if (this.excludePatterns.some(p => entry.name.includes(p))) {
            continue;
          }
          scan(fullPath);
        } else if (entry.isFile()) {
          // Only include .ts and .tsx files
          if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
            // Skip .d.ts files
            if (!entry.name.endsWith('.d.ts')) {
              files.push(fullPath);
            }
          }
        }
      }
    };

    scan(dir);
    return files;
  }

  async parseFile(filePath: string): Promise<CodeUnit[]> {
    const content = readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const units: CodeUnit[] = [];
    const lines = content.split('\n');

    const visit = (node: ts.Node): void => {
      let unit: CodeUnit | null = null;

      if (ts.isFunctionDeclaration(node) && node.name) {
        unit = this.createUnit(filePath, node.name.text, 'function', node, lines);
      } else if (ts.isClassDeclaration(node) && node.name) {
        unit = this.createUnit(filePath, node.name.text, 'class', node, lines);
        
        // Extract methods from class
        ts.forEachChild(node, (child) => {
          if (ts.isMethodDeclaration(child) && child.name) {
            const methodName = ts.isIdentifier(child.name) ? child.name.text : '[method]';
            const methodUnit = this.createUnit(filePath, `${unit?.name}.${methodName}`, 'method', child, lines);
            if (methodUnit) units.push(methodUnit);
          }
        });
      } else if (ts.isInterfaceDeclaration(node)) {
        unit = this.createUnit(filePath, node.name.text, 'interface', node, lines);
      } else if (ts.isTypeAliasDeclaration(node)) {
        unit = this.createUnit(filePath, node.name.text, 'type', node, lines);
      } else if (ts.isVariableDeclaration(node) && node.name) {
        // Check if it's a function-like variable
        if (node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
          const varName = ts.isIdentifier(node.name) ? node.name.text : '[var]';
          unit = this.createUnit(filePath, varName, 'variable', node, lines);
        }
      }

      if (unit) {
        units.push(unit);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return units;
  }

  private createUnit(
    filePath: string,
    name: string,
    kind: CodeUnit['kind'],
    node: ts.Node,
    lines: string[]
  ): CodeUnit | null {
    // Skip anonymous
    if (!name || name === '[method]' || name === '[var]') {
      return null;
    }

    const startLine = ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).line + 1;
    const endLine = ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getEnd()).line + 1;
    
    // Extract docstring (JSDoc comment)
    const docstring = this.extractDocstring(node, lines);
    
    // Build signature from first line of node
    const signature = lines[startLine - 1]?.trim() ?? '';

    // Create ID from filePath + name
    const id = createHash('sha256').update(`${filePath}:${name}`).digest('hex').slice(0, 16);

    return {
      id,
      filePath,
      name,
      kind,
      docstring,
      signature,
      startLine,
      endLine,
      indexedAt: new Date().toISOString(),
    };
  }

  private extractDocstring(node: ts.Node, _lines: string[]): string {
    // Get leading comments
    const sourceFile = node.getSourceFile();
    const commentRanges = ts.getLeadingCommentRanges(sourceFile.getFullText(), node.getFullStart());
    
    if (commentRanges && commentRanges.length > 0) {
      const comments: string[] = [];
      for (const range of commentRanges) {
        const text = sourceFile.getFullText().slice(range.pos, range.end);
        comments.push(text);
      }
      return comments.join('\n').trim();
    }

    // Fallback: return first line of body if available
    return '';
  }

  async embedUnit(unit: CodeUnit): Promise<CodeUnit> {
    const embedText = `${unit.kind} ${unit.name}: ${unit.docstring} ${unit.signature}`;
    
    try {
      const dedup = getSemanticDedup();
      const embedding = await dedup.getEmbedding(embedText);
      unit.embedding = embedding;
    } catch (error) {
      console.warn(`CodeIndex: failed to embed ${unit.name}:`, error);
    }

    return unit;
  }

  // ---- Search ----

  async query(naturalLanguage: string, topK: number = 10): Promise<SearchResult[]> {
    // Load index if not loaded
    if (this.units.length === 0) {
      await this.loadIndex();
    }

    // Embed query
    let queryEmbedding: number[];
    try {
      const dedup = getSemanticDedup();
      queryEmbedding = await dedup.getEmbedding(naturalLanguage);
    } catch (error) {
      console.warn('CodeIndex: failed to embed query:', error);
      return [];
    }

    // Compute similarities
    const results: SearchResult[] = [];
    
    for (const unit of this.units) {
      if (!unit.embedding) continue;
      
      const score = this.cosineSimilarity(queryEmbedding, unit.embedding);
      
      // Map score to relevance
      let relevance: SearchResult['relevance'];
      if (score >= 0.75) relevance = 'high';
      else if (score >= 0.55) relevance = 'medium';
      else relevance = 'low';
      
      results.push({ unit, score, relevance });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    
    // Return topK
    return results.slice(0, topK);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // ---- Impact analysis ----

  async analyzeImpact(filePath: string): Promise<ImpactAnalysis> {
    // Load index if not loaded
    if (this.units.length === 0) {
      await this.loadIndex();
    }

    // Check if file exists in index
    const targetUnits = this.units.filter(u => u.filePath === filePath);
    if (targetUnits.length === 0) {
      throw new Error(`No code entry found for ${filePath}`);
    }

    const exportedSymbols = targetUnits.map(u => u.name);

    // Find files that import from target
    const affectedFiles = new Set<string>();
    const symbolUsage: Map<string, Set<string>> = new Map();

    // Get relative path for import matching
    const relativePath = relative(this.projectRoot, filePath).replace(/\.tsx?$/, '');
    const importPatterns = [
      `from ['"]${relativePath}['"]`,
      `from ['"]\.\/${relativePath}['"]`,
      `from ['"]\.\.\/${relativePath}['"]`,
    ];

    for (const unit of this.units) {
      if (unit.filePath === filePath) continue;

      // Simple text-based import check
      const content = readFileSync(unit.filePath, 'utf-8');
      const importsTarget = importPatterns.some(p => new RegExp(p).test(content));

      if (importsTarget) {
        affectedFiles.add(unit.filePath);

        // Check which specific symbols are used
        for (const symbol of exportedSymbols) {
          if (content.includes(symbol)) {
            if (!symbolUsage.has(symbol)) {
              symbolUsage.set(symbol, new Set());
            }
            symbolUsage.get(symbol)!.add(unit.filePath);
          }
        }
      }
    }

    // Build affected symbols array
    const affectedSymbols = Array.from(symbolUsage.entries()).map(([symbol, usedIn]) => ({
      symbol,
      usedIn: Array.from(usedIn),
    }));

    // Compute impact radius
    const affectedCount = affectedFiles.size;
    let radius: ImpactAnalysis['radius'];
    if (affectedCount <= 3) radius = 'contained';
    else if (affectedCount <= 10) radius = 'moderate';
    else radius = 'widespread';

    // Get root entry (first unit from target file)
    const rootEntry = targetUnits[0];

    return {
      filePath,
      affectedFiles: Array.from(affectedFiles),
      affectedSymbols,
      radius,
      rootEntry,
    };
  }

  // ---- Index persistence ----

  async saveIndex(): Promise<void> {
    const data = {
      version: '1' as const,
      projectRoot: this.projectRoot,
      indexedAt: new Date().toISOString(),
      units: this.units,
    };

    const dir = dirname(this.indexPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(this.indexPath, JSON.stringify(data, null, 2));
  }

  async loadIndex(): Promise<boolean> {
    if (!existsSync(this.indexPath)) {
      return false;
    }

    try {
      const content = readFileSync(this.indexPath, 'utf-8');
      const parsed = JSON.parse(content);
      const validated = CodeIndexFileSchema.parse(parsed);
      
      this.units = validated.units;
      return true;
    } catch (error) {
      console.warn('CodeIndex: failed to load index:', error);
      return false;
    }
  }

  async incrementalUpdate(changedFiles: string[]): Promise<void> {
    for (const filePath of changedFiles) {
      // Remove existing units for this file
      this.units = this.units.filter(u => u.filePath !== filePath);

      // Re-parse and embed
      try {
        const newUnits = await this.parseFile(filePath);
        for (const unit of newUnits) {
          await this.embedUnit(unit);
          this.units.push(unit);
        }
      } catch (error) {
        console.warn(`CodeIndex: failed to update ${filePath}:`, error);
      }
    }

    await this.saveIndex();
    console.log(`CodeIndex: incremental update for ${changedFiles.length} files`);
  }

  // ---- File change detection ----

  async detectChangedFiles(since?: string): Promise<string[]> {
    const changed: string[] = [];
    const files = this.discoverFiles(this.projectRoot);

    for (const filePath of files) {
      try {
        const stats = statSync(filePath);
        const mtime = stats.mtime.toISOString();
        
        if (!since || mtime > since) {
          changed.push(filePath);
        }
      } catch {
        // Skip files we can't stat
      }
    }

    return changed;
  }

  getStats(): { totalUnits: number; totalFiles: number; lastIndexedAt?: string } {
    const totalFiles = new Set(this.units.map(u => u.filePath)).size;
    
    // Get last indexed from first unit (they all have similar timestamps)
    const lastIndexedAt = this.units.length > 0 ? this.units[0].indexedAt : undefined;
    
    return {
      totalUnits: this.units.length,
      totalFiles,
      lastIndexedAt,
    };
  }

  getAllUnits(): CodeUnit[] {
    return [...this.units];
  }

  clear(): void {
    this.units = [];
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let instance: CodeIndex | null = null;

export function getCodeIndex(options?: ConstructorParameters<typeof CodeIndex>[0]): CodeIndex {
  if (!instance) {
    instance = new CodeIndex(options);
  }
  return instance;
}

export function resetCodeIndex(): void {
  instance = null;
}

export { CodeIndex };
