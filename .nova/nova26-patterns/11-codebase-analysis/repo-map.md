# Repository Map

## Source
Extracted from Nova26 `src/codebase/repo-map.ts`

---

## Pattern: Repository Map

A lightweight, regex-based repository indexing system that scans the project structure, extracts symbols (functions, classes, interfaces, types, enums) from source files, and produces a structured map. The map is used for agent context injection — giving each agent a focused view of the codebase relevant to its current task rather than dumping the entire project into the prompt.

The system trades off full AST accuracy (tree-sitter) for speed and zero native dependencies, making it suitable for CLI-based agent orchestrators that need fast startup.

---

## Implementation

### Code Example

```typescript
import { readFileSync } from 'fs';
import { join, relative, extname } from 'path';

export interface Symbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'const' | 'export' | 'import' | 'enum';
  file: string;
  line: number;
  signature?: string;
  exported: boolean;
  references: number;
}

export interface FileInfo {
  path: string;
  relativePath: string;
  symbols: Symbol[];
  imports: string[];
  exports: string[];
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

const INDEXABLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', '.nova',
  'coverage', '__pycache__', '.turbo', '.vercel',
]);

/**
 * Build a repository map from the codebase.
 * Walks the file tree, parses each file for symbols, and counts cross-references.
 */
export function buildRepoMap(rootDir: string, maxFiles: number = 500): RepoMap {
  const start = Date.now();
  const files: FileInfo[] = [];
  const filePaths = findFiles(rootDir, maxFiles);

  for (const filePath of filePaths) {
    try {
      const info = parseFile(filePath, rootDir);
      if (info.symbols.length > 0 || info.exports.length > 0) {
        files.push(info);
      }
    } catch {
      // Skip unparseable files silently
    }
  }

  // Collect symbols and count cross-file references
  const allSymbols: Symbol[] = [];
  const symbolNames = new Map<string, Symbol>();

  for (const file of files) {
    for (const sym of file.symbols) {
      allSymbols.push(sym);
      if (sym.exported) symbolNames.set(sym.name, sym);
    }
  }

  for (const file of files) {
    for (const sym of allSymbols) {
      if (sym.exported && file.imports.some(i => i.includes(sym.name))) {
        sym.references++;
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

/**
 * Get symbols relevant to a task description, ranked by keyword match + reference count.
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

  return repoMap.symbols
    .filter(s => s.exported)
    .map(sym => {
      const nameLower = sym.name.toLowerCase();
      const fileLower = sym.file.toLowerCase();
      let score = sym.references;
      for (const kw of keywords) {
        if (nameLower.includes(kw)) score += 10;
        if (fileLower.includes(kw)) score += 5;
      }
      return { sym, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSymbols)
    .map(s => s.sym);
}

/**
 * Format the repo map as markdown context for agent prompts.
 * Supports focused mode (task-relevant symbols) and overview mode (project structure).
 */
export function formatRepoContext(
  repoMap: RepoMap,
  taskDescription?: string,
  maxTokens: number = 2000
): string {
  const lines: string[] = ['## Codebase Map\n'];

  if (taskDescription) {
    const relevant = getRelevantSymbols(repoMap, taskDescription);
    if (relevant.length > 0) {
      lines.push('### Relevant Symbols\n');
      for (const sym of relevant) {
        const sig = sym.signature ? sym.signature : '';
        lines.push(`- \`${sym.kind}\` **${sym.name}**${sig} — ${sym.file}:${sym.line}`);
      }
    }
  } else {
    lines.push('### Project Structure\n');
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

  let result = lines.join('\n');
  if (result.length > maxTokens * 4) {
    result = result.slice(0, maxTokens * 4) + '\n...(truncated)';
  }
  return result;
}
```

### Key Concepts

- **Regex-based parsing**: Uses line-by-line regex matching instead of a full AST parser — fast startup, zero native deps, covers ~90% of common TypeScript/Python patterns
- **Symbol reference counting**: Tracks how many files import each exported symbol, surfacing the most-connected code as "core" symbols
- **Task-focused context**: `getRelevantSymbols` scores symbols against a task description using keyword matching + reference count, so agents receive only the context they need
- **Token-aware truncation**: `formatRepoContext` caps output to a configurable token budget, preventing prompt overflow
- **Graceful degradation**: Unparseable files are silently skipped; the map is always partial-safe

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Dumping the entire codebase into the agent prompt
function getContext(rootDir: string): string {
  const allFiles = glob.sync('**/*.ts', { cwd: rootDir });
  let context = '';
  for (const file of allFiles) {
    context += readFileSync(join(rootDir, file), 'utf-8') + '\n';
  }
  return context; // 500KB+ of raw source — blows the context window
}
```

### ✅ Do This Instead

```typescript
// Build a structured map, then inject only task-relevant symbols
const repoMap = buildRepoMap(rootDir, 500);
const context = formatRepoContext(repoMap, 'implement user authentication', 2000);
// Result: ~30 relevant symbols with file locations, fits in 2K tokens
```

---

## When to Use This Pattern

✅ **Use for:**
- Giving AI agents focused codebase context before they generate or modify code
- Building project overviews for onboarding dashboards or architecture reports
- Ranking files by importance (reference count) for code review prioritization

❌ **Don't use for:**
- Full semantic analysis requiring type resolution (use TypeScript compiler API or tree-sitter instead)
- Languages not covered by the regex parsers (currently TS/JS/Python; Go and Rust extensions are stubs)

---

## Benefits

1. **Fast startup** — regex parsing is 10–50x faster than spinning up tree-sitter or the TypeScript compiler, critical for CLI tools that run on every prompt
2. **Zero native dependencies** — no compiled binaries, works in any Node.js environment without platform-specific builds
3. **Token-efficient context** — agents receive a ranked, truncated symbol list instead of raw source, maximizing useful information per token
4. **Multi-language support** — extensible parser architecture; adding a new language is a single function

---

## Related Patterns

- See `../01-orchestration/prompt-builder-dependency-injection.md` for how the repo map context is injected into agent prompts
- See `./dependency-analyzer.md` for import graph analysis that complements the symbol-level view
- See `../02-agent-system/agent-loader.md` for the agent system that consumes repo map context
- See `../06-llm-integration/model-router.md` for the LLM routing layer that receives the formatted context

---

*Extracted: 2026-02-19*
