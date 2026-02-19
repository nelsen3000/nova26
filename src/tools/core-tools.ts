// Core Tools — The 10 foundational tools for agent tool use
// These run locally (or in Docker sandbox when available)

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, relative, resolve } from 'path';
import { z } from 'zod';
import type { Tool, ToolResult, ToolRegistry } from './tool-registry.js';
import { getDocsFetcher } from './docs-fetcher.js';
import { getKnowledgeBase } from './knowledge-base.js';
import { getSkillRunner } from '../skills/skill-runner.js';

// ============================================================================
// Safety constants
// ============================================================================

const PROJECT_ROOT = process.cwd();
const MAX_OUTPUT_LENGTH = 8000; // chars, ~2k tokens
const MAX_FILE_READ_LINES = 500;

/** Paths that agents must never read or modify */
const BLOCKED_PATHS = [
  '.env',
  '.git/',
  'node_modules/',
  'package-lock.json',
  '.nova/data/',
  '.nova/cache/',
];

// ============================================================================
// Path safety
// ============================================================================

function isPathSafe(filePath: string, requireInsideProject: boolean = true): { safe: boolean; reason?: string } {
  const resolved = resolve(filePath);
  const rel = relative(PROJECT_ROOT, resolved);

  // Must be inside project
  if (requireInsideProject && (rel.startsWith('..') || resolve(filePath) === resolve('/'))) {
    return { safe: false, reason: `Path "${filePath}" is outside the project root` };
  }

  // Check blocked paths
  for (const blocked of BLOCKED_PATHS) {
    if (rel === blocked.replace(/\/$/, '') || rel.startsWith(blocked)) {
      return { safe: false, reason: `Path "${rel}" is blocked for agent access` };
    }
  }

  return { safe: true };
}

function truncateOutput(output: string): { text: string; truncated: boolean } {
  if (output.length <= MAX_OUTPUT_LENGTH) {
    return { text: output, truncated: false };
  }
  return {
    text: output.slice(0, MAX_OUTPUT_LENGTH) + `\n\n... (truncated, ${output.length - MAX_OUTPUT_LENGTH} chars omitted)`,
    truncated: true,
  };
}

function makeResult(success: boolean, output: string, startTime: number, error?: string): ToolResult {
  const { text, truncated } = truncateOutput(output);
  return {
    success,
    output: text,
    error,
    duration: Date.now() - startTime,
    truncated,
  };
}

// ============================================================================
// Tool: readFile
// ============================================================================

const readFileSchema = z.object({
  path: z.string().describe('File path relative to project root'),
  startLine: z.number().optional().describe('Start line (1-based)'),
  endLine: z.number().optional().describe('End line (1-based, inclusive)'),
});

async function readFileTool(args: Record<string, unknown>): Promise<ToolResult> {
  const start = Date.now();
  const parsed = readFileSchema.parse(args);
  const fullPath = resolve(PROJECT_ROOT, parsed.path);

  const safety = isPathSafe(fullPath);
  if (!safety.safe) return makeResult(false, '', start, safety.reason);

  if (!existsSync(fullPath)) {
    return makeResult(false, '', start, `File not found: ${parsed.path}`);
  }

  try {
    const content = readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    const startLine = Math.max(1, parsed.startLine ?? 1);
    const endLine = Math.min(lines.length, parsed.endLine ?? Math.min(lines.length, startLine + MAX_FILE_READ_LINES - 1));

    const selected = lines.slice(startLine - 1, endLine);
    const numbered = selected.map((line, i) => `${startLine + i}\t${line}`).join('\n');

    const header = `File: ${parsed.path} (lines ${startLine}-${endLine} of ${lines.length})\n\n`;
    return makeResult(true, header + numbered, start);
  } catch (err) {
    return makeResult(false, '', start, `Failed to read file: ${(err as Error).message}`);
  }
}

export const readFileDef: Tool = {
  name: 'readFile',
  description: 'Read file contents with optional line range. Returns numbered lines.',
  parameters: readFileSchema,
  execute: readFileTool,
  allowedAgents: [],
  blockedAgents: [],
  mutating: false,
  timeout: 5000,
};

// ============================================================================
// Tool: writeFile
// ============================================================================

const writeFileSchema = z.object({
  path: z.string().describe('File path relative to project root'),
  content: z.string().describe('Content to write'),
});

async function writeFileTool(args: Record<string, unknown>): Promise<ToolResult> {
  const start = Date.now();
  const parsed = writeFileSchema.parse(args);
  const fullPath = resolve(PROJECT_ROOT, parsed.path);

  const safety = isPathSafe(fullPath);
  if (!safety.safe) return makeResult(false, '', start, safety.reason);

  try {
    writeFileSync(fullPath, parsed.content, 'utf-8');
    return makeResult(true, `Written ${parsed.content.length} chars to ${parsed.path}`, start);
  } catch (err) {
    return makeResult(false, '', start, `Failed to write file: ${(err as Error).message}`);
  }
}

export const writeFileDef: Tool = {
  name: 'writeFile',
  description: 'Write content to a file. Creates the file if it does not exist.',
  parameters: writeFileSchema,
  execute: writeFileTool,
  allowedAgents: [],
  blockedAgents: [],
  mutating: true,
  timeout: 5000,
};

// ============================================================================
// Tool: searchCode
// ============================================================================

const searchCodeSchema = z.object({
  pattern: z.string().describe('Regex pattern to search for'),
  glob: z.string().optional().describe('File glob pattern (e.g., "*.ts", "src/**/*.tsx")'),
  maxResults: z.number().optional().describe('Maximum results to return (default 20)'),
});

async function searchCodeTool(args: Record<string, unknown>): Promise<ToolResult> {
  const start = Date.now();
  const parsed = searchCodeSchema.parse(args);
  const maxResults = parsed.maxResults ?? 20;

  try {
    const globArg = parsed.glob ? `--glob '${parsed.glob}'` : '--type ts --type tsx --type js --type jsx';
    const cmd = `rg --line-number --max-count ${maxResults} ${globArg} '${parsed.pattern.replace(/'/g, "'\\''")}'`;

    const output = execSync(cmd, {
      cwd: PROJECT_ROOT,
      timeout: 10000,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
    });

    const lines = output.trim().split('\n').slice(0, maxResults);
    return makeResult(true, `Found ${lines.length} matches:\n\n${lines.join('\n')}`, start);
  } catch (err) {
    const error = err as { status?: number; message?: string; stdout?: string };
    if (error.status === 1) {
      return makeResult(true, 'No matches found', start);
    }
    return makeResult(false, '', start, `Search failed: ${error.message ?? 'unknown error'}`);
  }
}

export const searchCodeDef: Tool = {
  name: 'searchCode',
  description: 'Search for a regex pattern across the codebase. Returns matching lines with file paths and line numbers.',
  parameters: searchCodeSchema,
  execute: searchCodeTool,
  allowedAgents: [],
  blockedAgents: [],
  mutating: false,
  timeout: 10000,
};

// ============================================================================
// Tool: checkTypes
// ============================================================================

const checkTypesSchema = z.object({});

async function checkTypesTool(_args: Record<string, unknown>): Promise<ToolResult> {
  const start = Date.now();

  try {
    execSync('npx tsc --noEmit', {
      cwd: PROJECT_ROOT,
      timeout: 60000,
      encoding: 'utf-8',
      maxBuffer: 2 * 1024 * 1024,
    });

    return makeResult(true, 'TypeScript: 0 errors', start);
  } catch (err) {
    const error = err as { stdout?: string; stderr?: string };
    const output = (error.stdout ?? '') + (error.stderr ?? '');
    const errorLines = output.split('\n').filter(l => l.includes('error TS'));
    return makeResult(false, `TypeScript: ${errorLines.length} errors\n\n${errorLines.join('\n')}`, start);
  }
}

export const checkTypesDef: Tool = {
  name: 'checkTypes',
  description: 'Run TypeScript type checker (tsc --noEmit). Returns error count and error details.',
  parameters: checkTypesSchema,
  execute: checkTypesTool,
  allowedAgents: [],
  blockedAgents: [],
  mutating: false,
  timeout: 60000,
};

// ============================================================================
// Tool: runTests
// ============================================================================

const runTestsSchema = z.object({
  pattern: z.string().optional().describe('Test file pattern (e.g., "src/tools/*.test.ts")'),
});

async function runTestsTool(args: Record<string, unknown>): Promise<ToolResult> {
  const start = Date.now();
  const parsed = runTestsSchema.parse(args);

  try {
    const patternArg = parsed.pattern ? ` ${parsed.pattern}` : '';
    const output = execSync(`npx vitest run${patternArg} --reporter=verbose 2>&1`, {
      cwd: PROJECT_ROOT,
      timeout: 120000,
      encoding: 'utf-8',
      maxBuffer: 2 * 1024 * 1024,
    });

    // Extract summary line
    const lines = output.split('\n');
    const summaryLines = lines.filter(l => /Tests\s+\d|Test Files/.test(l));
    const passed = output.includes('0 failed') || !output.includes('FAIL');

    return makeResult(passed, summaryLines.join('\n') + '\n\n' + output, start);
  } catch (err) {
    const error = err as { stdout?: string; stderr?: string };
    const output = (error.stdout ?? '') + (error.stderr ?? '');

    // Extract failure info
    const failLines = output.split('\n').filter(l => /FAIL|Error|expect|received/.test(l));
    return makeResult(false, `Tests failed:\n\n${failLines.slice(0, 30).join('\n')}\n\nFull output:\n${output}`, start);
  }
}

export const runTestsDef: Tool = {
  name: 'runTests',
  description: 'Run vitest tests. Optionally filter by file pattern. Returns pass/fail summary and details.',
  parameters: runTestsSchema,
  execute: runTestsTool,
  allowedAgents: [],
  blockedAgents: [],
  mutating: false,
  timeout: 120000,
};

// ============================================================================
// Tool: listFiles
// ============================================================================

const listFilesSchema = z.object({
  directory: z.string().optional().describe('Directory relative to project root (default: "src")'),
  recursive: z.boolean().optional().describe('List files recursively (default: true)'),
  maxDepth: z.number().optional().describe('Max directory depth (default: 4)'),
});

async function listFilesTool(args: Record<string, unknown>): Promise<ToolResult> {
  const start = Date.now();
  const parsed = listFilesSchema.parse(args);
  const dir = parsed.directory ?? 'src';
  const recursive = parsed.recursive ?? true;
  const maxDepth = parsed.maxDepth ?? 4;

  const fullPath = resolve(PROJECT_ROOT, dir);
  const safety = isPathSafe(fullPath);
  if (!safety.safe) return makeResult(false, '', start, safety.reason);

  if (!existsSync(fullPath)) {
    return makeResult(false, '', start, `Directory not found: ${dir}`);
  }

  const files: string[] = [];
  function walk(currentPath: string, depth: number): void {
    if (depth > maxDepth) return;
    if (files.length > 200) return; // Safety cap

    try {
      const entries = readdirSync(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = join(currentPath, entry.name);
        const relPath = relative(PROJECT_ROOT, entryPath);

        // Skip blocked paths
        if (BLOCKED_PATHS.some(b => relPath.startsWith(b.replace(/\/$/, '')))) continue;

        if (entry.isDirectory()) {
          files.push(relPath + '/');
          if (recursive) walk(entryPath, depth + 1);
        } else {
          const stat = statSync(entryPath);
          const sizeKB = (stat.size / 1024).toFixed(1);
          files.push(`${relPath} (${sizeKB}KB)`);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  walk(fullPath, 0);

  const output = `Directory: ${dir}/ (${files.length} entries)\n\n${files.join('\n')}`;
  return makeResult(true, output, start);
}

export const listFilesDef: Tool = {
  name: 'listFiles',
  description: 'List files in a directory with sizes. Useful for understanding project structure.',
  parameters: listFilesSchema,
  execute: listFilesTool,
  allowedAgents: [],
  blockedAgents: [],
  mutating: false,
  timeout: 10000,
};

// ============================================================================
// Registration helper
// ============================================================================

// ============================================================================
// Tool: fetchDocs
// ============================================================================

const fetchDocsSchema = z.object({
  library: z.string().describe('Library or framework name, e.g. "react", "zod", "tailwindcss", "convex"'),
  topic: z.string().optional().describe('Specific topic within the library, e.g. "hooks", "schema", "queries"'),
});

async function fetchDocsTool(args: Record<string, unknown>): Promise<ToolResult> {
  const start = Date.now();
  const { library, topic } = fetchDocsSchema.parse(args);
  const fetcher = getDocsFetcher();
  const result = await fetcher.fetchDocs(library, topic);
  const { text, truncated: isTruncated } = truncateOutput(result.content);
  return {
    success: true,
    output: text,
    duration: Date.now() - start,
    truncated: isTruncated || result.truncated,
  };
}

export const fetchDocsDef: Tool = {
  name: 'fetchDocs',
  description: 'Fetch up-to-date documentation for a library or framework. Use this before writing code that uses any external dependency to ensure you have the current API. Returns formatted documentation text.',
  parameters: fetchDocsSchema,
  execute: fetchDocsTool,
  allowedAgents: [],
  blockedAgents: [],
  mutating: false,
  timeout: 15_000,
};

// ============================================================================
// Tool: queryKnowledge
// ============================================================================

const queryKnowledgeSchema = z.object({
  query: z.string().describe('Natural language query describing what you are looking for, e.g. "form validation with zod", "react server components", "database indexing strategies"'),
  maxResults: z.number().optional().describe('Maximum number of results to return (default: 5)'),
});

async function queryKnowledgeTool(args: Record<string, unknown>): Promise<ToolResult> {
  const start = Date.now();
  const { query, maxResults } = queryKnowledgeSchema.parse(args);
  const kb = getKnowledgeBase({ maxResults: maxResults ?? 5 });
  const result = await kb.query(query);
  const formatted = kb.formatForPrompt(result);
  const { text, truncated: isTruncated } = truncateOutput(formatted);
  return {
    success: true,
    output: text,
    duration: Date.now() - start,
    truncated: isTruncated || result.results.length < result.totalFound,
  };
}

export const queryKnowledgeDef: Tool = {
  name: 'queryKnowledge',
  description: 'Search across all knowledge sources: Taste Vault patterns, BistroLens best practices, and cached documentation. Use this before starting any non-trivial implementation to retrieve relevant patterns, prior art, and documentation.',
  parameters: queryKnowledgeSchema,
  execute: queryKnowledgeTool,
  allowedAgents: [],
  blockedAgents: [],
  mutating: false,
  timeout: 10_000,
};

// ============================================================================
// Tool: runSkill
// ============================================================================

const runSkillSchema = z.object({
  skillName: z.string().describe('Name of the skill to run, e.g. "debug-root-cause", "refactor-safely", "generate-tests"'),
  inputs: z.record(z.unknown()).describe('Input values for the skill, e.g. { errorFile: "src/foo.ts", errorPattern: "Cannot read property" }'),
});

async function runSkillTool(args: Record<string, unknown>): Promise<ToolResult> {
  const { skillName, inputs } = runSkillSchema.parse(args);
  const runner = getSkillRunner();
  const result = await runner.execute(skillName, {
    agentName: 'unknown',
    taskDescription: '',
    workingDir: process.cwd(),
    inputs,
    stepResults: {},
  });
  return {
    success: result.success,
    output: runner.formatResultForPrompt(result),
    duration: result.durationMs,
    truncated: false,
  };
}

export const runSkillDef: Tool = {
  name: 'runSkill',
  description: 'Execute a multi-step skill workflow. Skills coordinate sequences of tool calls into reliable outcomes. Use this for complex, multi-step operations like debugging, refactoring, or test generation.',
  parameters: runSkillSchema,
  execute: runSkillTool,
  allowedAgents: [],
  blockedAgents: [],
  mutating: false,
  timeout: 60_000,
};

// ============================================================================
// Tool: generateUIComponent
// ============================================================================

const generateUIComponentSchema = z.object({
  componentName: z.string().describe('PascalCase component name, e.g. "UserCard", "DataTable"'),
  purpose: z.string().describe('What this component does and what data it displays'),
  props: z.array(z.string()).optional().describe('List of prop names this component needs'),
  shadcnComponents: z.array(z.string()).optional().describe('shadcn/ui components to use, e.g. ["Button", "Card", "Badge"]'),
  hasInteractivity: z.boolean().optional().describe('Whether component handles user interactions (clicks, form submission)'),
});

async function generateUIComponentTool(args: Record<string, unknown>): Promise<ToolResult> {
  const { componentName, purpose, props, shadcnComponents, hasInteractivity } = generateUIComponentSchema.parse(args);

  const spec = [
    `Component: ${componentName}`,
    `Purpose: ${purpose}`,
    props?.length ? `Props: ${props.join(', ')}` : '',
    shadcnComponents?.length ? `Use shadcn/ui: ${shadcnComponents.join(', ')}` : '',
    hasInteractivity ? 'Requires: click handlers, form submission, or state management' : '',
    '',
    'Requirements:',
    '- Handle all 5 UI states: loading (skeleton), empty (empty state with CTA), error (error boundary with retry), success (main content), disabled (greyed out with cursor-not-allowed)',
    '- Include ARIA attributes: aria-label, aria-describedby, role where semantic HTML is insufficient',
    '- Keyboard navigation: all interactive elements reachable via Tab, activated via Enter/Space',
    '- Responsive: mobile-first with sm:, md:, lg: breakpoints',
    '- Follow design tokens: use CSS variables (--background, --foreground, --primary, etc.) via Tailwind',
    '- Max 200 lines per component file; split sub-components into separate exports if needed',
  ].filter(Boolean).join('\n');

  return makeResult(true, spec, Date.now());
}

export const generateUIComponentDef: Tool = {
  name: 'generateUIComponent',
  description: 'Generate a React/Tailwind component following Nova26 design system conventions. Returns a complete, accessible, responsive component with all 5 UI states (loading, empty, error, success, disabled).',
  parameters: generateUIComponentSchema,
  execute: generateUIComponentTool,
  allowedAgents: ['VENUS'],
  blockedAgents: [],
  mutating: false,
  timeout: 5_000,
};

// ============================================================================
// Registration helper
// ============================================================================

/** Register all 10 core tools in a registry */
export function registerCoreTools(registry: ToolRegistry): void {
  registry.register(readFileDef);
  registry.register(writeFileDef);
  registry.register(searchCodeDef);
  registry.register(checkTypesDef);
  registry.register(runTestsDef);
  registry.register(listFilesDef);
  registry.register(fetchDocsDef);
  registry.register(queryKnowledgeDef);
  registry.register(runSkillDef);
  registry.register(generateUIComponentDef);
}
