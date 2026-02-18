// Codebase Indexing - AST-based repository map
// Builds a symbol graph of the codebase (functions, classes, exports, imports)
// and injects relevant context into agent prompts.
//
// Uses regex-based parsing as a lightweight alternative to tree-sitter
// (can be upgraded to tree-sitter for 40+ language support)

import { readFileSync, existsSync } from 'fs';
import { join, relative, extname } from 'path';

export interface Symbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'const' | 'export' | 'import' | 'enum';
  file: string;
  line: number;
  signature?: string;   // e.g., "(args: Args) => Promise<void>"
  exported: boolean;
  references: number;   // How many files reference this symbol
}

export interface FileInfo {
  path: string;
  relativePath: string;
  symbols: Symbol[];
  imports: string[];     // Module specifiers this file imports from
  exports: string[];     // Names this file exports
  lineCount: number;
}

export interface RepoMap {
  root: string;
  files: FileInfo[];
  symbols: Symbol[];
  buildTime: number;
  totalFiles: number;
  totalSymbols: number;
}

// File extensions to index
const INDEXABLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs',
]);

// Directories to skip
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', '.nova',
  'coverage', '__pycache__', '.turbo', '.vercel',
]);

/**
 * Build a repository map from the codebase
 */
export function buildRepoMap(rootDir: string, maxFiles: number = 500): RepoMap {
  const start = Date.now();
  const files: FileInfo[] = [];

  // Recursively find files
  const filePaths = findFiles(rootDir, maxFiles);

  // Parse each file
  for (const filePath of filePaths) {
    try {
      const info = parseFile(filePath, rootDir);
      if (info.symbols.length > 0 || info.exports.length > 0) {
        files.push(info);
      }
    } catch {
      // Skip files that can't be parsed
    }
  }

  // Collect all symbols and count references
  const allSymbols: Symbol[] = [];
  const symbolNames = new Map<string, Symbol>();

  for (const file of files) {
    for (const sym of file.symbols) {
      allSymbols.push(sym);
      if (sym.exported) {
        symbolNames.set(sym.name, sym);
      }
    }
  }

  // Count references (how many files import each symbol)
  for (const file of files) {
    for (const _imp of file.imports) {
      // Find which symbols are imported from this module
      for (const sym of allSymbols) {
        if (sym.exported && file.imports.some(i => i.includes(sym.name))) {
          sym.references++;
        }
      }
    }
  }

  return {
    root: rootDir,
    files,
    symbols: allSymbols,
    buildTime: Date.now() - start,
    totalFiles: files.length,
    totalSymbols: allSymbols.length,
  };
}

// --- C-08: .novaignore support ---

/**
 * Load .novaignore patterns from project root.
 * Supports glob-like patterns: *.env, secrets/, src/generated/*
 */
export function loadNovaIgnore(rootDir: string): string[] {
  const ignorePath = join(rootDir, '.novaignore');
  if (!existsSync(ignorePath)) return [];

  const content = readFileSync(ignorePath, 'utf-8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));
}

/**
 * Check if a relative path matches any .novaignore pattern
 */
export function isIgnored(relPath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    // Exact directory match: "secrets/" matches "secrets/foo.ts"
    if (pattern.endsWith('/') && relPath.startsWith(pattern)) return true;
    // Exact file match
    if (relPath === pattern) return true;
    // Glob with *: "*.env" matches "foo.env", "src/*.gen.ts" matches "src/foo.gen.ts"
    if (pattern.includes('*')) {
      const regex = new RegExp(
        '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^/]*') + '$'
      );
      if (regex.test(relPath)) return true;
      // Also test just the filename for patterns like "*.env"
      const fileName = relPath.split('/').pop() || '';
      if (regex.test(fileName)) return true;
    }
  }
  return false;
}

/**
 * Find indexable files recursively — respects .novaignore
 */
function findFiles(dir: string, maxFiles: number): string[] {
  const { readdirSync, statSync } = require('fs');
  const results: string[] = [];
  const ignorePatterns = loadNovaIgnore(dir);

  function walk(currentDir: string) {
    if (results.length >= maxFiles) return;

    let entries: string[];
    try {
      entries = readdirSync(currentDir) as string[];
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxFiles) return;
      if (SKIP_DIRS.has(entry)) continue;
      if (entry.startsWith('.')) continue;

      const fullPath = join(currentDir, entry);

      // Check .novaignore
      const relPath = relative(dir, fullPath);
      if (ignorePatterns.length > 0 && isIgnored(relPath, ignorePatterns)) continue;

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (stat.isFile() && INDEXABLE_EXTENSIONS.has(extname(entry))) {
          results.push(fullPath);
        }
      } catch {
        // Skip inaccessible files
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Parse a single file to extract symbols
 */
function parseFile(filePath: string, rootDir: string): FileInfo {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const ext = extname(filePath);
  const relPath = relative(rootDir, filePath);

  const symbols: Symbol[] = [];
  const imports: string[] = [];
  const exports: string[] = [];

  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    parseTypeScript(content, lines, relPath, symbols, imports, exports);
  } else if (ext === '.py') {
    parsePython(content, lines, relPath, symbols, imports, exports);
  }

  return {
    path: filePath,
    relativePath: relPath,
    symbols,
    imports,
    exports,
    lineCount: lines.length,
  };
}

/**
 * Parse TypeScript/JavaScript file
 */
function parseTypeScript(
  _content: string,
  lines: string[],
  filePath: string,
  symbols: Symbol[],
  imports: string[],
  exports: string[]
): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Imports
    const importMatch = line.match(/import\s+(?:(?:\{[^}]+\}|[\w*]+)\s+from\s+)?['"]([^'"]+)['"]/);
    if (importMatch) {
      imports.push(importMatch[1]);
    }

    // Exported functions
    const exportFuncMatch = line.match(/export\s+(?:async\s+)?function\s+(\w+)\s*(\([^)]*\))/);
    if (exportFuncMatch) {
      symbols.push({
        name: exportFuncMatch[1],
        kind: 'function',
        file: filePath,
        line: lineNum,
        signature: exportFuncMatch[2],
        exported: true,
        references: 0,
      });
      exports.push(exportFuncMatch[1]);
      continue;
    }

    // Exported const/arrow functions
    const exportConstMatch = line.match(/export\s+const\s+(\w+)\s*(?::\s*\w+)?\s*=/);
    if (exportConstMatch) {
      symbols.push({
        name: exportConstMatch[1],
        kind: 'const',
        file: filePath,
        line: lineNum,
        exported: true,
        references: 0,
      });
      exports.push(exportConstMatch[1]);
      continue;
    }

    // Exported interfaces
    const interfaceMatch = line.match(/export\s+interface\s+(\w+)/);
    if (interfaceMatch) {
      symbols.push({
        name: interfaceMatch[1],
        kind: 'interface',
        file: filePath,
        line: lineNum,
        exported: true,
        references: 0,
      });
      exports.push(interfaceMatch[1]);
      continue;
    }

    // Exported types
    const typeMatch = line.match(/export\s+type\s+(\w+)/);
    if (typeMatch) {
      symbols.push({
        name: typeMatch[1],
        kind: 'type',
        file: filePath,
        line: lineNum,
        exported: true,
        references: 0,
      });
      exports.push(typeMatch[1]);
      continue;
    }

    // Exported classes
    const classMatch = line.match(/export\s+class\s+(\w+)/);
    if (classMatch) {
      symbols.push({
        name: classMatch[1],
        kind: 'class',
        file: filePath,
        line: lineNum,
        exported: true,
        references: 0,
      });
      exports.push(classMatch[1]);
      continue;
    }

    // Exported enums
    const enumMatch = line.match(/export\s+enum\s+(\w+)/);
    if (enumMatch) {
      symbols.push({
        name: enumMatch[1],
        kind: 'enum',
        file: filePath,
        line: lineNum,
        exported: true,
        references: 0,
      });
      exports.push(enumMatch[1]);
      continue;
    }

    // Non-exported functions (private)
    const funcMatch = line.match(/^(?:async\s+)?function\s+(\w+)\s*(\([^)]*\))/);
    if (funcMatch) {
      symbols.push({
        name: funcMatch[1],
        kind: 'function',
        file: filePath,
        line: lineNum,
        signature: funcMatch[2],
        exported: false,
        references: 0,
      });
    }
  }
}

/**
 * Parse Python file
 */
function parsePython(
  _content: string,
  lines: string[],
  filePath: string,
  symbols: Symbol[],
  imports: string[],
  exports: string[]
): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Imports
    const importMatch = line.match(/^(?:from\s+(\S+)\s+)?import\s+(.+)/);
    if (importMatch) {
      imports.push(importMatch[1] || importMatch[2].trim());
    }

    // Functions
    const funcMatch = line.match(/^def\s+(\w+)\s*(\([^)]*\))/);
    if (funcMatch) {
      const isExported = !funcMatch[1].startsWith('_');
      symbols.push({
        name: funcMatch[1],
        kind: 'function',
        file: filePath,
        line: lineNum,
        signature: funcMatch[2],
        exported: isExported,
        references: 0,
      });
      if (isExported) exports.push(funcMatch[1]);
    }

    // Classes
    const classMatch = line.match(/^class\s+(\w+)/);
    if (classMatch) {
      const isExported = !classMatch[1].startsWith('_');
      symbols.push({
        name: classMatch[1],
        kind: 'class',
        file: filePath,
        line: lineNum,
        exported: isExported,
        references: 0,
      });
      if (isExported) exports.push(classMatch[1]);
    }
  }
}

/**
 * Get relevant symbols for a task description (ranked by relevance)
 */
export function getRelevantSymbols(
  repoMap: RepoMap,
  taskDescription: string,
  maxSymbols: number = 30
): Symbol[] {
  const keywords = taskDescription
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3);

  // Score each symbol by keyword match + reference count
  const scored = repoMap.symbols
    .filter(s => s.exported)
    .map(sym => {
      const nameLower = sym.name.toLowerCase();
      const fileLower = sym.file.toLowerCase();

      let score = sym.references; // Base score from references

      // Keyword match in symbol name
      for (const kw of keywords) {
        if (nameLower.includes(kw)) score += 10;
        if (fileLower.includes(kw)) score += 5;
      }

      return { sym, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSymbols);

  return scored.map(s => s.sym);
}

/**
 * Format repo map as context for agent prompts
 */
export function formatRepoContext(
  repoMap: RepoMap,
  taskDescription?: string,
  maxTokens: number = 2000
): string {
  const lines: string[] = ['## Codebase Map\n'];

  if (taskDescription) {
    // Focused context: only relevant symbols
    const relevant = getRelevantSymbols(repoMap, taskDescription);
    if (relevant.length > 0) {
      lines.push('### Relevant Symbols\n');
      for (const sym of relevant) {
        const sig = sym.signature ? sym.signature : '';
        lines.push(`- \`${sym.kind}\` **${sym.name}**${sig} — ${sym.file}:${sym.line}`);
      }
    }
  } else {
    // Overview: file structure with top exports
    lines.push('### Project Structure\n');

    // Group by directory
    const byDir = new Map<string, FileInfo[]>();
    for (const file of repoMap.files) {
      const dir = file.relativePath.split('/').slice(0, -1).join('/') || '.';
      if (!byDir.has(dir)) byDir.set(dir, []);
      byDir.get(dir)!.push(file);
    }

    for (const [dir, files] of byDir) {
      lines.push(`\n**${dir}/**`);
      for (const file of files.slice(0, 5)) {
        const topExports = file.exports.slice(0, 3).join(', ');
        lines.push(`  - ${file.relativePath} (${file.lineCount}L) exports: ${topExports || 'none'}`);
      }
    }
  }

  lines.push(`\n_${repoMap.totalFiles} files, ${repoMap.totalSymbols} symbols indexed in ${repoMap.buildTime}ms_`);

  // Truncate to approximate token limit
  let result = lines.join('\n');
  if (result.length > maxTokens * 4) {
    result = result.slice(0, maxTokens * 4) + '\n...(truncated)';
  }

  return result;
}
