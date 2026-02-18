// Repo Map Generator — Lightweight codebase awareness for NOVA26
// Provides file signatures, caching, and prompt formatting

import { readFileSync, statSync, readdirSync, type Dirent } from 'fs';
import { join, relative, resolve, dirname } from 'path';

// ============================================================================
// Types
// ============================================================================

export interface FileSignature {
  path: string;
  exports: string[];        // export names
  functions: string[];      // function signatures
  classes: string[];        // class names
  types: string[];          // type/interface names
  size: number;             // file size in bytes
  lastModified: number;
}

export interface RepoMap {
  root: string;
  files: FileSignature[];
  totalFiles: number;
  totalSize: number;
  generatedAt: number;
}

export interface RepoMapOptions {
  maxTokens: number;        // default 2000
  includePatterns: string[]; // default: ['src/**/*.ts']
  excludePatterns: string[]; // default: ['node_modules', 'dist', '.git']
  cacheDurationMs: number;  // default 60000 (1 min)
}

interface CacheEntry {
  repoMap: RepoMap;
  timestamp: number;
}

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_OPTIONS: RepoMapOptions = {
  maxTokens: 2000,
  includePatterns: ['src/**/*.ts'],
  excludePatterns: ['node_modules', 'dist', '.git', 'coverage', '.nova'],
  cacheDurationMs: 60000,
};

// ============================================================================
// Cache Storage (in-memory)
// ============================================================================

const repoMapCache = new Map<string, CacheEntry>();

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generate a repository map from the given root directory
 */
export function generateRepoMap(
  rootDir: string,
  options?: Partial<RepoMapOptions>
): RepoMap {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const resolvedRoot = resolve(rootDir);

  const files: FileSignature[] = [];
  let totalSize = 0;

  // Walk the directory and find matching files
  const filePaths = findFiles(resolvedRoot, opts);

  for (const filePath of filePaths) {
    try {
      const signature = extractFileSignatures(filePath);
      // Make path relative to root
      signature.path = relative(resolvedRoot, filePath);
      files.push(signature);
      totalSize += signature.size;
    } catch {
      // Skip files we can't read
    }
  }

  const repoMap: RepoMap = {
    root: resolvedRoot,
    files,
    totalFiles: files.length,
    totalSize,
    generatedAt: Date.now(),
  };

  // Store in cache
  repoMapCache.set(resolvedRoot, {
    repoMap,
    timestamp: Date.now(),
  });

  return repoMap;
}

// ============================================================================
// File Discovery
// ============================================================================

/**
 * Find files matching include patterns, excluding excluded patterns
 */
function findFiles(rootDir: string, options: RepoMapOptions): string[] {
  const files: string[] = [];
  const excludeSet = new Set(options.excludePatterns);

  function walk(dir: string): void {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(rootDir, fullPath);

      // Check exclude patterns
      if (shouldExclude(relPath, excludeSet)) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        // Check include patterns
        if (matchesIncludePatterns(relPath, options.includePatterns)) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(rootDir);
  return files;
}

function shouldExclude(relPath: string, excludeSet: Set<string>): boolean {
  for (const pattern of excludeSet) {
    // Simple pattern matching
    if (relPath === pattern || relPath.startsWith(pattern + '/')) {
      return true;
    }
    // Glob-style matching for simple cases
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
      if (regex.test(relPath) || relPath.startsWith(pattern.replace(/\*.*$/, ''))) {
        return true;
      }
    }
  }
  return false;
}

function matchesIncludePatterns(relPath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    // Handle src/**/*.ts style patterns
    if (pattern.includes('**')) {
      const basePath = pattern.split('/**')[0];
      const extPattern = pattern.split('*.')[1];
      if (relPath.startsWith(basePath) && (!extPattern || relPath.endsWith('.' + extPattern))) {
        return true;
      }
    } else if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '[^/]*') + '$');
      if (regex.test(relPath)) {
        return true;
      }
    } else if (relPath === pattern) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// Signature Extraction
// ============================================================================

/**
 * Extract signatures from a single file using regex-based parsing
 */
export function extractFileSignatures(filePath: string): FileSignature {
  const content = readFileSync(filePath, 'utf-8');
  const stats = statSync(filePath);

  // Export names: export const|let|var|async function|function|class|interface|type|enum name
  const exportRegex = /export\s+(?:const|let|var|async\s+function|function|class|interface|type|enum)\s+(\w+)/g;
  const exports: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  // Also catch: export { name1, name2 } syntax
  const exportListRegex = /export\s*\{([^}]+)\}/g;
  while ((match = exportListRegex.exec(content)) !== null) {
    const names = match[1].split(',').map(n => n.trim().split(' as ')[0].trim());
    for (const name of names) {
      if (name && !name.startsWith('type ')) {
        exports.push(name);
      }
    }
  }

  // Function signatures: extract function name + params (not full type info)
  // Match: export async function name(params), export function name(params), function name(params)
  const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
  const functions: string[] = [];
  while ((match = functionRegex.exec(content)) !== null) {
    const funcName = match[1];
    const params = match[2]
      .split(',')
      .map(p => p.trim().split(':')[0].split('=')[0].trim())
      .filter(p => p)
      .join(', ');
    functions.push(`${funcName}(${params})`);
  }

  // Arrow functions exported as const: export const name = (params) =>
  const arrowFuncRegex = /export\s+const\s+(\w+)\s*=\s*(?:\([^)]*\)|[^(]+)\s*=>/g;
  while ((match = arrowFuncRegex.exec(content)) !== null) {
    const funcName = match[1];
    if (!functions.some(f => f.startsWith(funcName + '('))) {
      // Extract params from the match if possible
      const arrowMatch = match[0].match(/\(([^)]*)\)\s*=>/);
      if (arrowMatch) {
        const params = arrowMatch[1]
          .split(',')
          .map(p => p.trim().split(':')[0].split('=')[0].trim())
          .filter(p => p)
          .join(', ');
        functions.push(`${funcName}(${params})`);
      } else {
        functions.push(`${funcName}()`);
      }
    }
  }

  // Class names: class Name
  const classRegex = /class\s+(\w+)/g;
  const classes: string[] = [];
  while ((match = classRegex.exec(content)) !== null) {
    classes.push(match[1]);
  }

  // Type/interface names: type Name or interface Name
  const typeRegex = /\b(?:type|interface|enum)\s+(\w+)/g;
  const types: string[] = [];
  while ((match = typeRegex.exec(content)) !== null) {
    types.push(match[1]);
  }

  return {
    path: filePath,
    exports: Array.from(new Set(exports)),
    functions: Array.from(new Set(functions)),
    classes: Array.from(new Set(classes)),
    types: Array.from(new Set(types)),
    size: stats.size,
    lastModified: stats.mtimeMs,
  };
}

// ============================================================================
// Prompt Formatting
// ============================================================================

/**
 * Format the repo map for prompt injection, respecting token limits
 */
export function formatRepoMapForPrompt(
  repoMap: RepoMap,
  query?: string,
  maxTokens?: number
): string {
  const max = maxTokens ?? 2000;
  const files = query ? findRelevantFiles(repoMap, query) : repoMap.files;
  
  // Sort by relevance if query provided, otherwise by path
  if (!query) {
    files.sort((a, b) => a.path.localeCompare(b.path));
  }

  let output = `<repo_map>\n`;
  output += `Project Structure (${repoMap.totalFiles} files, ${formatBytes(repoMap.totalSize)})\n\n`;

  // Group files by directory
  const grouped = groupFilesByDirectory(files);
  const dirs = Object.keys(grouped).sort();

  let estimatedTokens = estimateTokenCount(output);
  const lines: string[] = [];
  let fileCount = 0;

  for (const dir of dirs) {
    const dirFiles = grouped[dir];
    
    // Print directory header if not root
    if (dir) {
      const dirHeader = `${dir}/`;
      const dirTokens = estimateTokenCount(dirHeader + '\n');
      if (estimatedTokens + dirTokens > max * 0.95) {
        lines.push(`... (${files.length - fileCount} more files)`);
        break;
      }
      lines.push(dirHeader);
      estimatedTokens += dirTokens;
    }
    
    for (const file of dirFiles) {
      const fileName = file.path.split('/').pop() || file.path;
      const parts: string[] = [];

      if (file.exports.length > 0) {
        parts.push(`exports: ${file.exports.slice(0, 5).join(', ')}${file.exports.length > 5 ? '...' : ''}`);
      }
      if (file.functions.length > 0) {
        const funcs = file.functions.slice(0, 3).join(', ');
        parts.push(`functions: ${funcs}${file.functions.length > 3 ? '...' : ''}`);
      }
      if (file.classes.length > 0) {
        parts.push(`classes: ${file.classes.join(', ')}`);
      }
      if (file.types.length > 0) {
        parts.push(`types: ${file.types.slice(0, 3).join(', ')}${file.types.length > 3 ? '...' : ''}`);
      }

      const line = dir 
        ? `  ${fileName}${parts.length > 0 ? ' — ' + parts.join(' | ') : ''}`
        : `${fileName}${parts.length > 0 ? ' — ' + parts.join(' | ') : ''}`;

      const lineTokens = estimateTokenCount(line + '\n');
      if (estimatedTokens + lineTokens > max * 0.95) {
        lines.push(`  ... (${files.length - fileCount} more files)`);
        break;
      }
      
      lines.push(line);
      estimatedTokens += lineTokens;
      fileCount++;
    }

    if (estimatedTokens > max * 0.95) break;
  }

  output += lines.join('\n');
  output += `\n</repo_map>`;

  return output;
}

function groupFilesByDirectory(files: FileSignature[]): Record<string, FileSignature[]> {
  const grouped: Record<string, FileSignature[]> = {};
  
  for (const file of files) {
    const dir = dirname(file.path);
    const key = dir === '.' ? '' : dir;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(file);
  }
  
  return grouped;
}



function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Get cached repo map if available and not stale
 */
export function getCachedRepoMap(rootDir: string): RepoMap | null {
  const resolvedRoot = resolve(rootDir);
  const entry = repoMapCache.get(resolvedRoot);
  
  if (!entry) {
    return null;
  }
  
  return entry.repoMap;
}

/**
 * Invalidate cached repo map for a root directory
 */
export function invalidateRepoMap(rootDir: string): void {
  const resolvedRoot = resolve(rootDir);
  repoMapCache.delete(resolvedRoot);
}

/**
 * Check if the cached repo map is stale (older than maxAgeMs)
 */
export function isRepoMapStale(rootDir: string, maxAgeMs: number): boolean {
  const resolvedRoot = resolve(rootDir);
  const entry = repoMapCache.get(resolvedRoot);
  
  if (!entry) {
    return true;
  }
  
  const age = Date.now() - entry.timestamp;
  return age >= maxAgeMs;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Estimate token count for a repo map (rough approximation: 4 chars ≈ 1 token)
 */
export function estimateMapTokens(repoMap: RepoMap): number {
  let totalChars = 0;
  
  for (const file of repoMap.files) {
    totalChars += file.path.length;
    totalChars += file.exports.join(',').length;
    totalChars += file.functions.join(',').length;
    totalChars += file.classes.join(',').length;
    totalChars += file.types.join(',').length;
  }
  
  return Math.ceil(totalChars / 4);
}

/**
 * Find files relevant to a query (simple keyword matching)
 */
export function findRelevantFiles(repoMap: RepoMap, query: string): FileSignature[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  if (queryTerms.length === 0) {
    return [...repoMap.files];
  }

  const scored = repoMap.files.map(file => {
    let score = 0;
    const searchableText = [
      file.path,
      ...file.exports,
      ...file.functions,
      ...file.classes,
      ...file.types,
    ].join(' ').toLowerCase();

    for (const term of queryTerms) {
      // Exact match in path (high priority)
      if (file.path.toLowerCase().includes(term)) {
        score += 10;
      }
      // Match in exports
      if (file.exports.some(e => e.toLowerCase().includes(term))) {
        score += 5;
      }
      // Match in functions
      if (file.functions.some(f => f.toLowerCase().includes(term))) {
        score += 3;
      }
      // Match in classes
      if (file.classes.some(c => c.toLowerCase().includes(term))) {
        score += 4;
      }
      // Match in types
      if (file.types.some(t => t.toLowerCase().includes(term))) {
        score += 3;
      }
      // General match
      if (searchableText.includes(term)) {
        score += 1;
      }
    }

    return { file, score };
  });

  // Sort by score descending, then by path
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.file.path.localeCompare(b.file.path);
  });

  return scored.map(s => s.file);
}

/**
 * Estimate token count for a string (rough approximation)
 */
function estimateTokenCount(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for code
  return Math.ceil(text.length / 4);
}

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Get or generate repo map with caching
 */
export function getRepoMap(
  rootDir: string,
  options?: Partial<RepoMapOptions>
): RepoMap {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const resolvedRoot = resolve(rootDir);

  // Check cache
  const cached = getCachedRepoMap(resolvedRoot);
  if (cached && !isRepoMapStale(resolvedRoot, opts.cacheDurationMs)) {
    return cached;
  }

  // Generate new
  return generateRepoMap(resolvedRoot, opts);
}
