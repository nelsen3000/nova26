# KIMI TASK FILE — External Integrations Sprint

> Owner: Kimi
> Priority: Agent Intelligence Upgrade (smarter, more capable, pattern-aware)
> Prerequisite: KIMI-POLISH-01-06 complete and merged to main
> Spec sources: Grok R11 (Context7, Skills Framework, Venus UI Skills, Obsidian Knowledge), Kiro BistroLens Extraction
> Test baseline: 1226+ tests passing (post-polish), 0 TypeScript errors

---

## Context

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. You have
completed five major sprint cycles:

- **KIMI-AGENT-01-06** — inner loop (ReAct, agent-loop, tool registry, orchestrator)
- **KIMI-VAULT-01-06** — Living Taste Vault (`src/taste-vault/`) and Global Wisdom Pipeline
- **KIMI-ACE-01-06** — ACE Playbook System, Rehearsal Stage, Self-Improvement Protocol
- **KIMI-INFRA-01-06** — Semantic similarity, Convex real-time, security, model routing, analytics
- **KIMI-POLISH-01-06** — Error recovery, performance caching, prompt snapshots, property tests, CI

The core product is hardened. It is crash-resilient, fast, and thoroughly tested. Now it
needs to become dramatically smarter through external knowledge injection and higher-level
reasoning capabilities.

**This sprint is about integrating external capabilities that make agents dramatically
smarter — the difference between an IDE that generates plausible code and one that
generates correct, up-to-date, pattern-proven code:**

1. **Context7 Documentation Tool** — agents fetch live, up-to-date documentation for any
   library instead of reasoning from stale training data. A $299/month product should know
   the current React 19 API, not hallucinate deprecated patterns.
2. **Skills Framework** — agents gain multi-step reasoning workflows (debug-root-cause,
   refactor-safely, generate-tests) that coordinate sequences of tool calls into repeatable,
   reliable outcomes. Tools answer "what can I do?"; Skills answer "how do I do this well?"
3. **BistroLens Pattern Injection** — Kiro extracted 79 real-world production patterns from
   BistroLens across 16 categories. These are injected into the Taste Vault as a
   high-quality, pre-validated knowledge base. Agents get battle-tested patterns from day one.
4. **Enhanced Venus UI Skills** — Venus gains specialized capabilities: component generation
   with built-in accessibility, shadcn/ui awareness, responsive design by default. UI code
   quality goes from "technically correct" to "production-ready without review."
5. **Knowledge Base Tool** — a unified search layer across Taste Vault patterns, BistroLens
   knowledge, and cached docs. Any agent can call `queryKnowledge("how to validate forms")`
   and get ranked, relevant, actionable results from all knowledge sources.
6. **85+ new tests** — every new module is fully tested before merging.

**Key existing files you will read before touching:**

- `src/tools/tool-registry.ts` — `ToolRegistry`, singleton pattern (`getToolRegistry()`,
  `resetToolRegistry()`), `Tool` interface, `ToolResult` interface
- `src/tools/core-tools.ts` — how existing tools are defined and registered
- `src/taste-vault/graph-memory.ts` — `GraphMemory`, `GraphNode`, `NodeType`, `EdgeRelation`,
  `getGraphMemory()`, `resetGraphMemory()`
- `src/taste-vault/taste-vault.ts` — `TasteVault`, high-level vault API
- `src/similarity/semantic-dedup.ts` — `SemanticDedup`, `getSemanticDedup()`, dedup logic
- `src/skills/skill-marketplace.ts` — existing marketplace shape (do not duplicate; extend)
- `src/skills/skill-loader.ts` — existing skill loader (read before writing skill-runner)
- `.nova/agents/VENUS.md` — Venus agent template (read before modifying)
- `.nova/bistrolens-knowledge/` — 79 extracted patterns across 16 category directories

**New files you will create:**

- `src/tools/docs-fetcher.ts` — Context7 Documentation Tool
- `src/tools/knowledge-base.ts` — Knowledge Base unified search tool
- `src/skills/skill-runner.ts` — Skill execution engine
- `src/skills/skill-registry.ts` — Skill registration and lookup
- `src/taste-vault/pattern-loader.ts` — BistroLens pattern import pipeline
- `src/tools/docs-fetcher.test.ts` — docs fetcher tests
- `src/skills/skill-runner.test.ts` — skill runner tests
- `src/skills/skill-registry.test.ts` — skill registry tests
- `src/taste-vault/pattern-loader.test.ts` — pattern loader tests
- `src/tools/knowledge-base.test.ts` — knowledge base tests

**Existing files you will modify (read them first — never overwrite without reading):**

- `src/tools/core-tools.ts` — register `fetchDocs`, `queryKnowledge`, `runSkill` tools
- `.nova/agents/VENUS.md` — add `generateUIComponent` instructions and UI skill guidance

---

## Global Rules (apply to every task)

- **TypeScript strict mode** — no `any`, no implicit `any`, no `@ts-ignore`
- **ESM imports** — always use `.js` extensions on relative imports
  (e.g., `import { Foo } from './foo.js'`, NOT `'./foo'`)
- **Zod for all external/runtime data validation** — validate at system boundaries:
  HTTP responses from Context7, markdown file parsing, JSON cache files, CLI input
- **Tests with vitest** — all new tests use `import { describe, it, expect, vi } from 'vitest'`
- **Do not break existing tests** — `npx vitest run` must show 1226+ passing after each task
- **Zero TypeScript errors** — `npx tsc --noEmit` must report 0 errors after every task
- **Commit to main when done** — one commit per KIMI-INTEGRATE task, commit message format:
  `feat(integrate): KIMI-INTEGRATE-XX <short description>`
- **Singleton factory pattern** — follow the pattern from `src/tools/tool-registry.ts`:
  `class Foo { ... }` + `export function getFoo(): Foo` + `export function resetFoo(): void`
  (reset function clears the module-level singleton variable — used in `beforeEach` tests)
- **File header comments** — every new file starts with exactly 2 lines:
  `// <Short description of what this file does>`
  `// <Which task/spec this implements>`
- **No new npm dependencies** without a compelling reason — `zod`, `vitest`, `better-sqlite3`,
  `fast-check` are available. Node built-ins (`fs`, `path`, `crypto`, `https`, `http`) are
  preferred over adding new libraries for HTTP fetching.
- **Error handling convention** — follow `src/taste-vault/global-wisdom.ts`: catch errors,
  log with a descriptive prefix, return a safe fallback value. Never throw from
  context-building or read paths. Only throw from write paths when data integrity is at stake.
- **Max output token budget** — tool outputs injected into agent prompts must respect a
  token budget. Use 2000 tokens as the default cap for any single tool output unless the
  task spec says otherwise. Truncate with a `...[truncated]` suffix.

---

## KIMI-INTEGRATE-01: Context7 Documentation Tool

**File:** `src/tools/docs-fetcher.ts`
**Target size:** ~200 lines
**Spec:** Grok R11 — Context7 integration

### What to build

The `DocsFetcher` class fetches live, authoritative documentation for any library or
framework topic and returns it as a formatted string ready for injection into an agent
prompt. Agents that would otherwise hallucinate or use stale API patterns can call
`fetchDocs("react", "hooks")` and receive current, accurate documentation.

The fetcher is cache-first: it stores results in `.nova/docs-cache/{library}/{topic}.json`
with a 7-day TTL. This means the first call for `("react", "hooks")` hits the network;
subsequent calls within 7 days return instantly from disk. Cache files survive process
restarts.

The Context7 API endpoint is: `https://context7.com/api/docs?library={library}&topic={topic}`.
If the API is unreachable or returns a non-200 response, the tool returns
`"Documentation unavailable for {library}. Please consult the official docs."` — it
never throws and never blocks an agent from proceeding.

### Core interfaces

```typescript
export interface DocsFetchResult {
  library: string;
  topic?: string;
  content: string;          // formatted documentation text, max 2000 tokens
  source: 'cache' | 'network';
  fetchedAt: string;        // ISO timestamp of when content was retrieved
  cacheHit: boolean;
  truncated: boolean;       // true if content was cut to fit token budget
}

export interface DocsCacheEntry {
  library: string;
  topic?: string;
  content: string;
  fetchedAt: string;        // ISO timestamp
  expiresAt: string;        // ISO timestamp (fetchedAt + TTL)
  tokenCount: number;       // approximate token count of stored content
}
```

### Zod schemas

```typescript
const DocsCacheEntrySchema = z.object({
  library: z.string(),
  topic: z.string().optional(),
  content: z.string(),
  fetchedAt: z.string(),
  expiresAt: z.string(),
  tokenCount: z.number().nonnegative(),
});

const Context7ApiResponseSchema = z.object({
  content: z.string(),
  library: z.string().optional(),
  topic: z.string().optional(),
  version: z.string().optional(),
});
```

### DocsFetcher class

```typescript
class DocsFetcher {
  constructor(options?: {
    cacheDir?: string;       // default: '.nova/docs-cache'
    cacheTTLMs?: number;     // default: 604_800_000 (7 days)
    maxTokens?: number;      // default: 2000
    baseUrl?: string;        // default: 'https://context7.com/api/docs'
  })

  async fetchDocs(library: string, topic?: string): Promise<DocsFetchResult>
  // 1. Sanitize inputs: lowercase library, trim whitespace. If library is empty, throw.
  // 2. Check local cache (getCacheEntry). If valid (not expired): return cache result.
  // 3. Fetch from Context7 API:
  //    GET {baseUrl}?library={library}&topic={topic}
  //    Use Node's built-in `https` module (no fetch polyfill, no axios).
  //    Set a 10-second timeout. Set Accept: application/json header.
  // 4. On HTTP error or timeout: log warning, return fallback result.
  // 5. On 200: parse response body with Context7ApiResponseSchema.safeParse().
  //    If parse fails: log warning, return fallback result.
  // 6. Truncate content to maxTokens (approximate: 1 token ≈ 4 characters).
  // 7. Save to cache via writeCacheEntry().
  // 8. Return DocsFetchResult with source: 'network'.

  private getCacheEntry(library: string, topic?: string): DocsCacheEntry | null
  // Read .nova/docs-cache/{library}/{safeTopic}.json
  // safeTopic = topic?.replace(/[^a-z0-9-]/g, '-') ?? '_default'
  // Parse with DocsCacheEntrySchema.safeParse(). Return null if file missing or invalid.
  // Check expiry: if entry.expiresAt < new Date().toISOString(): return null (stale).

  private writeCacheEntry(entry: DocsCacheEntry): void
  // Write entry to .nova/docs-cache/{library}/{safeTopic}.json
  // Create parent directories with mkdirSync({ recursive: true }).
  // Serialize with JSON.stringify(entry, null, 2).
  // Silently ignore write errors (never block the caller for cache write failures).

  private truncateToTokenBudget(content: string, maxTokens: number): { text: string; truncated: boolean }
  // Approximate 1 token = 4 characters.
  // If content.length <= maxTokens * 4: return { text: content, truncated: false }.
  // Otherwise: slice to (maxTokens * 4) chars, append '\n...[truncated]'.
  // Return { text: sliced + suffix, truncated: true }.

  private buildFallbackResult(library: string, topic?: string): DocsFetchResult
  // Returns a DocsFetchResult with:
  //   content: `Documentation unavailable for ${library}${topic ? ` (${topic})` : ''}. Please consult the official docs.`
  //   source: 'network', cacheHit: false, truncated: false

  clearCache(library?: string): void
  // If library provided: delete .nova/docs-cache/{library}/ directory recursively.
  // If no library: delete .nova/docs-cache/ directory recursively.
  // Silently ignore errors if directory does not exist.

  getCacheStats(): { entries: number; oldestEntry?: string; newestEntry?: string }
  // Scan .nova/docs-cache/ for all .json files.
  // Return count and oldest/newest fetchedAt timestamps.
}
```

### Singleton factory

```typescript
export function getDocsFetcher(): DocsFetcher
export function resetDocsFetcher(): void  // for tests — clears singleton
```

### Registration in ToolRegistry

In `src/tools/core-tools.ts`, add a new tool definition:

```typescript
{
  name: 'fetchDocs',
  description: 'Fetch up-to-date documentation for a library or framework. Use this before writing code that uses any external dependency to ensure you have the current API. Returns formatted documentation text.',
  parameters: z.object({
    library: z.string().describe('Library or framework name, e.g. "react", "zod", "tailwindcss", "convex"'),
    topic: z.string().optional().describe('Specific topic within the library, e.g. "hooks", "schema", "queries"'),
  }),
  execute: async (args) => {
    const { library, topic } = args as { library: string; topic?: string };
    const fetcher = getDocsFetcher();
    const result = await fetcher.fetchDocs(library, topic);
    return {
      success: true,
      output: result.content,
      duration: 0,
      truncated: result.truncated,
    };
  },
  allowedAgents: [],   // empty = available to ALL agents
  blockedAgents: [],
  mutating: false,
  timeout: 15_000,
}
```

### Notes

- Use Node's built-in `https.get()` with a manual timeout via `req.setTimeout(10000, ...)`.
  Do not use `fetch()` — it may not be available in all Node 18 configurations without
  the `--experimental-fetch` flag.
- Cache file paths sanitize library and topic names: only `[a-z0-9-_]` characters allowed
  in path segments. Replace anything else with `-`.
- The `.nova/docs-cache/` directory is gitignored (treat it as ephemeral, like `.nova/checkpoints/`).
  Do not commit cached docs.
- The `tokenCount` field in the cache entry is an approximation used for stats/debugging
  only. It does not gate any behavior.

---

## KIMI-INTEGRATE-02: Skills Framework

**Files:** `src/skills/skill-runner.ts`, `src/skills/skill-registry.ts`
**Target size:** ~300 lines total
**Spec:** Grok R11 — Superpowers/Skills Framework

### What to build

Skills are higher-level than tools. A Tool answers one question ("what files are in this
directory?"). A Skill orchestrates a multi-step workflow ("debug-root-cause: read the error
→ search for the source → identify the root cause → propose a fix"). Skills are repeatable,
composable, and agent-aware.

**Read `src/skills/skill-marketplace.ts` and `src/skills/skill-loader.ts` before starting.**
The marketplace manages discoverable community skills; the skill registry and runner you
build here manage the agent's active, executable skills during a build. Do not duplicate
the marketplace — they serve different purposes.

### Core interfaces

```typescript
// src/skills/skill-registry.ts

export interface SkillStep {
  name: string;                    // human-readable step name, e.g. "Read error message"
  tool: string;                    // tool name from ToolRegistry, e.g. "readFile"
  buildArgs: (context: SkillContext) => Record<string, unknown>;
  // Builds the tool arguments from the current skill execution context.
  // Must return a plain object — no promises, no side effects.
  validateResult?: (result: string) => boolean;
  // Optional: return false to indicate this step failed and execution should stop.
  // If omitted: any non-empty result is considered success.
}

export interface Skill {
  name: string;                    // unique identifier, e.g. "debug-root-cause"
  description: string;             // one sentence for display and LLM context injection
  agents: string[];                // agent names this skill is available to (empty = all)
  steps: SkillStep[];
  requiredTools: string[];         // tool names that must be in ToolRegistry
  version: string;                 // semver string, e.g. "1.0.0"
}

export interface SkillContext {
  agentName: string;
  taskDescription: string;
  workingDir: string;
  inputs: Record<string, unknown>;  // caller-provided inputs, e.g. { errorMessage: "..." }
  stepResults: Record<string, string>; // accumulated results by step name
}

export interface SkillRegistration {
  skill: Skill;
  registeredAt: string;
  source: 'builtin' | 'marketplace' | 'user';
}
```

### SkillRegistry class

```typescript
class SkillRegistry {
  register(skill: Skill, source?: 'builtin' | 'marketplace' | 'user'): void
  // Register a skill. If a skill with the same name already exists: overwrite it.
  // Log: `SkillRegistry: registered skill "${skill.name}" (${source ?? 'user'})`

  get(name: string): Skill | null
  // Return the skill with this name, or null if not found.

  listForAgent(agentName: string): Skill[]
  // Return all skills where skill.agents is empty (available to all) OR
  //   skill.agents includes agentName.
  // Sort by skill name alphabetically.

  listAll(): Skill[]
  // Return all registered skills, sorted by name alphabetically.

  unregister(name: string): boolean
  // Remove the skill. Return true if it existed, false if not found.

  has(name: string): boolean
  // Return true if a skill with this name is registered.

  clear(): void
  // Remove all registered skills. For tests.
}
```

### SkillRunner class

```typescript
// src/skills/skill-runner.ts

export interface SkillRunResult {
  skillName: string;
  success: boolean;
  stepsCompleted: number;
  totalSteps: number;
  stepResults: Record<string, string>;  // step name → tool output
  failedStep?: string;                  // name of the step that failed, if any
  error?: string;                       // error message if execution failed
  durationMs: number;
}

class SkillRunner {
  constructor(private registry: SkillRegistry)

  async execute(skillName: string, context: SkillContext): Promise<SkillRunResult>
  // 1. Look up skill in registry. If not found: return failure result with error "Skill not found".
  // 2. Validate that all requiredTools are registered in ToolRegistry.
  //    If any are missing: return failure result listing the missing tools.
  // 3. Execute each step in sequence:
  //    a. Call step.buildArgs(context) to get tool arguments.
  //    b. Call ToolRegistry.execute(step.tool, args).
  //    c. If ToolResult.success === false: stop execution, return failure result.
  //    d. If step.validateResult is defined and returns false: stop execution, return failure.
  //    e. Store result in context.stepResults[step.name] and in SkillRunResult.stepResults.
  //    f. Log: `SkillRunner: step "${step.name}" completed (${result.output.length} chars)`
  // 4. Return success result with all step outputs.
  // 5. On any thrown error: catch, log, return failure result with the error message.
  //    Never let SkillRunner.execute() throw.

  formatResultForPrompt(result: SkillRunResult): string
  // Format the skill result as a concise string for injection into an agent prompt.
  // Format:
  //   Skill: {skillName} ({stepsCompleted}/{totalSteps} steps)
  //   {if success}
  //   {each step name}: {first 200 chars of result}
  //   {if !success}
  //   Failed at step "{failedStep}": {error}
  // Max output: 1000 characters total. Truncate with '...[truncated]' if needed.
}
```

### Built-in skills (register at module init)

Define and register these three skills in `src/skills/skill-registry.ts`. They use tool
names from the existing ToolRegistry — read `src/tools/core-tools.ts` to confirm the exact
tool names before referencing them.

```typescript
const builtinSkills: Skill[] = [
  {
    name: 'debug-root-cause',
    description: 'Analyze an error message, search the codebase for its source, identify the root cause, and suggest a fix.',
    agents: [],  // available to all agents
    version: '1.0.0',
    requiredTools: ['readFile', 'searchFiles'],
    steps: [
      {
        name: 'read-error-context',
        tool: 'readFile',
        buildArgs: (ctx) => ({ path: ctx.inputs['errorFile'] as string ?? ctx.workingDir }),
        validateResult: (r) => r.length > 0,
      },
      {
        name: 'search-for-source',
        tool: 'searchFiles',
        buildArgs: (ctx) => ({
          pattern: ctx.inputs['errorPattern'] as string ?? '',
          directory: ctx.workingDir,
        }),
      },
      {
        name: 'identify-cause',
        tool: 'readFile',
        buildArgs: (ctx) => {
          // Use first file match from search-for-source step result
          const searchResult = ctx.stepResults['search-for-source'] ?? '';
          const firstFile = searchResult.split('\n')[0]?.trim() ?? ctx.workingDir;
          return { path: firstFile };
        },
      },
    ],
  },
  {
    name: 'refactor-safely',
    description: 'Analyze code to be refactored, propose changes, and verify no regressions by checking test files.',
    agents: ['MARS', 'EARTH', 'SATURN'],
    version: '1.0.0',
    requiredTools: ['readFile', 'searchFiles'],
    steps: [
      {
        name: 'analyze-target',
        tool: 'readFile',
        buildArgs: (ctx) => ({ path: ctx.inputs['targetFile'] as string }),
        validateResult: (r) => r.length > 0,
      },
      {
        name: 'find-usages',
        tool: 'searchFiles',
        buildArgs: (ctx) => ({
          pattern: ctx.inputs['symbolName'] as string ?? '',
          directory: ctx.workingDir,
        }),
      },
      {
        name: 'check-test-coverage',
        tool: 'searchFiles',
        buildArgs: (ctx) => ({
          pattern: (ctx.inputs['targetFile'] as string ?? '').replace(/\.\w+$/, '.test.'),
          directory: ctx.workingDir,
        }),
      },
    ],
  },
  {
    name: 'generate-tests',
    description: 'Read an implementation file and generate a comprehensive test file covering happy path, edge cases, and error cases.',
    agents: ['SATURN'],
    version: '1.0.0',
    requiredTools: ['readFile', 'searchFiles'],
    steps: [
      {
        name: 'read-implementation',
        tool: 'readFile',
        buildArgs: (ctx) => ({ path: ctx.inputs['targetFile'] as string }),
        validateResult: (r) => r.length > 0,
      },
      {
        name: 'find-existing-tests',
        tool: 'searchFiles',
        buildArgs: (ctx) => ({
          pattern: '.test.',
          directory: ctx.workingDir,
        }),
      },
      {
        name: 'read-related-types',
        tool: 'searchFiles',
        buildArgs: (ctx) => ({
          pattern: (ctx.inputs['targetFile'] as string ?? '').replace(/\.\w+$/, '.'),
          directory: ctx.workingDir,
        }),
      },
    ],
  },
];
```

### Singleton factories

```typescript
// skill-registry.ts
export function getSkillRegistry(): SkillRegistry
export function resetSkillRegistry(): void  // for tests

// skill-runner.ts
export function getSkillRunner(): SkillRunner
export function resetSkillRunner(): void    // for tests
```

### Registration in ToolRegistry

In `src/tools/core-tools.ts`, add a `runSkill` tool:

```typescript
{
  name: 'runSkill',
  description: 'Execute a multi-step skill workflow. Skills coordinate sequences of tool calls into reliable outcomes. Use this for complex, multi-step operations like debugging, refactoring, or test generation.',
  parameters: z.object({
    skillName: z.string().describe('Name of the skill to run, e.g. "debug-root-cause", "refactor-safely", "generate-tests"'),
    inputs: z.record(z.unknown()).describe('Input values for the skill, e.g. { errorFile: "src/foo.ts", errorPattern: "Cannot read property" }'),
  }),
  execute: async (args) => {
    const { skillName, inputs } = args as { skillName: string; inputs: Record<string, unknown> };
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
  },
  allowedAgents: [],
  blockedAgents: [],
  mutating: false,
  timeout: 60_000,
}
```

### Notes

- The SkillRunner does NOT call LLM methods directly. It only calls ToolRegistry tools.
  The LLM reasoning about what to do with skill results happens in the AgentLoop's normal
  ReAct cycle — the skill runner is a pure tool orchestrator.
- Built-in skills are registered when the `skill-registry.ts` module is first imported
  (module-level side effect). Call `getSkillRegistry()` in a module initializer, or
  register them inside the factory function before returning the singleton.
- Tool names referenced in skills (`readFile`, `searchFiles`) must match the exact names
  registered in ToolRegistry. Read `src/tools/core-tools.ts` to verify names before coding.
  If names differ, use the correct names — do not create aliases.

---

## KIMI-INTEGRATE-03: BistroLens Pattern Injection

**File:** `src/taste-vault/pattern-loader.ts`
**Target size:** ~200 lines
**Spec:** Kiro BistroLens extraction — 79 patterns across 16 categories

### What to build

Kiro extracted 79 production-quality patterns from BistroLens into
`.nova/bistrolens-knowledge/` across 16 category directories. This task builds the pipeline
that loads those patterns into the Taste Vault as first-class `GraphNode` entries, so all
agents get access to real-world, battle-tested knowledge from day one.

**Read the `.nova/bistrolens-knowledge/` directory structure before coding.** Each category
directory contains one or more `.md` files. Each file has frontmatter-style headers
(`**Category:**`, `**Priority:**`, `**Reusability:**`) and markdown sections with code
examples. Your parser must handle the actual file format.

The 16 categories map to `NodeType` as follows:

| Directory prefix | NodeType |
|---|---|
| `01-security`, `04-code-governance`, `04-image-governance`, `06-api-cost-protection`, `06-cost-protection` | `'Pattern'` |
| `02-steering-system`, `03-quality-gates`, `07-testing-strategies` | `'Strategy'` |
| `08-design-system`, `13-i18n`, `14-performance` | `'Preference'` |
| `05-database-patterns`, `09-error-handling`, `10-deployment` | `'Pattern'` |
| `11-monitoring`, `12-business-logic`, `15-ai-prompts` | `'Strategy'` |
| `16-documentation`, `17-nova26-adaptations` | `'Preference'` |

### Core interfaces

```typescript
export interface PatternParseResult {
  filename: string;
  category: string;           // e.g. "security", "design-system"
  title: string;              // extracted from first H1 heading
  description: string;        // first paragraph after the H1
  codeExamples: string[];     // all fenced code blocks (```...```)
  tags: string[];             // derived from category + any ## headings
  priority: string;           // P0/P1/P2/P3 from frontmatter, or 'P2' as default
  reusability: number;        // 0-10 from frontmatter, or 5 as default
  sourceFile: string;         // absolute path to the markdown file
  rawContent: string;         // full file content (for content field of GraphNode)
}

export interface PatternLoadResult {
  loaded: number;
  skipped: number;            // already in vault (dedup check passed)
  errors: number;
  nodes: GraphNode[];         // successfully loaded nodes
  errorDetails: string[];     // one entry per errored file
}
```

### PatternLoader class

```typescript
class PatternLoader {
  constructor(private options?: {
    userId?: string;         // default: 'bistrolens-import'
    confidence?: number;     // default: 0.85 (high confidence for real-world patterns)
    dryRun?: boolean;        // default: false — if true, parse but do not write to vault
  })

  async loadPatternsFromDirectory(dir: string): Promise<PatternLoadResult>
  // 1. Read all .md files recursively from dir using readdirSync + statSync.
  //    Skip KIRO-COMBINED-TASK.md, KIRO-EXTRACTION-TASK.md (meta files, not patterns).
  // 2. Parse each file with parsePatternFile().
  // 3. Convert each ParseResult to a GraphNode with toGraphNode().
  // 4. Run dedup check with getSemanticDedup() — skip nodes that are near-duplicates.
  // 5. If not dryRun: bulk-import the non-duplicate nodes with importPatterns().
  // 6. Create edges between nodes in the same category with createCategoryEdges().
  // 7. Return a PatternLoadResult summary.

  parsePatternFile(filePath: string): PatternParseResult
  // Read file with readFileSync(filePath, 'utf8').
  // Extract fields:
  //   title: first line starting with '# ' (strip the '# ' prefix)
  //   description: first non-empty paragraph after the title line (up to 500 chars)
  //   codeExamples: all content between ``` fences (capture code blocks, strip the fences)
  //   tags: [category, ...all '## ' heading texts in the file (strip '## ' prefix)]
  //   priority: match line like '**Priority:** P1' → extract 'P1'. Default: 'P2'.
  //   reusability: match line like '**Reusability:** 9/10' → extract 9. Default: 5.
  //   category: the parent directory name (e.g., '01-security' → 'security')
  //   sourceFile: absolute path (filePath)
  //   rawContent: full file text (truncated to 3000 chars for the node content field)
  // Never throw — if any extraction fails, use sensible defaults and continue.

  private toGraphNode(parsed: PatternParseResult): Omit<GraphNode, 'id' | 'createdAt' | 'updatedAt'>
  // Map PatternParseResult to GraphNode fields:
  //   type: nodeTypeForCategory(parsed.category) — see category→NodeType mapping above
  //   content: `${parsed.title}\n\n${parsed.description}`
  //     + (parsed.codeExamples.length > 0 ? `\n\nExample:\n${parsed.codeExamples[0].slice(0, 500)}` : '')
  //   confidence: Math.min(0.99, (this.options?.confidence ?? 0.85) + parsed.reusability * 0.01)
  //   helpfulCount: 0
  //   userId: this.options?.userId ?? 'bistrolens-import'
  //   isGlobal: true      // BistroLens patterns are global wisdom, not user-specific
  //   globalSuccessCount: 0
  //   tags: parsed.tags
  //   language: detectLanguage(parsed.codeExamples)
  //     — if any code example contains 'tsx' or 'jsx': 'typescript'
  //     — if any contains 'typescript' or 'ts': 'typescript'
  //     — else: undefined

  async importPatterns(nodes: Array<Omit<GraphNode, 'id' | 'createdAt' | 'updatedAt'>>): Promise<GraphNode[]>
  // For each node: call getGraphMemory().addNode(node).
  // Return the array of created GraphNodes with their assigned IDs.
  // Log: `PatternLoader: imported ${nodes.length} BistroLens patterns`

  private createCategoryEdges(nodes: GraphNode[]): void
  // Group nodes by their first tag (which is the category).
  // For each group of 2+ nodes: create 'supports' edges between consecutive nodes.
  // e.g., nodes [A, B, C] in category "security" → edges A→B and B→C (not A→C).
  // Use getGraphMemory().addEdge() for each edge.
  // Catch and log any errors — never throw from this method.

  private nodeTypeForCategory(category: string): NodeType
  // Apply the category → NodeType mapping from the table above.
  // Strip leading digits and hyphens for matching: '01-security' → 'security'.
  // If no match: return 'Pattern' as the default.

  async dedupCheck(nodes: Array<Omit<GraphNode, 'id' | 'createdAt' | 'updatedAt'>>): Promise<{
    unique: Array<Omit<GraphNode, 'id' | 'createdAt' | 'updatedAt'>>;
    duplicates: number;
  }>
  // Use getSemanticDedup().isDuplicate() to check each node against the existing vault.
  // A node is a duplicate if isDuplicate() returns { isDuplicate: true }.
  // Return the non-duplicate nodes and the count of duplicates found.
  // If SemanticDedup is unavailable (embeddings not running): skip dedup, return all as unique.
  // Log any dedup errors at warn level — never let dedup errors block the import.
}
```

### Singleton factory

```typescript
export function getPatternLoader(): PatternLoader
export function resetPatternLoader(): void  // for tests
```

### CLI integration

Add a comment block at the bottom of `pattern-loader.ts` documenting the intended CLI usage:

```typescript
// CLI Usage (future: nova26 import-patterns <directory>):
//
//   const loader = getPatternLoader({ dryRun: false });
//   const result = await loader.loadPatternsFromDirectory('.nova/bistrolens-knowledge');
//   console.log(`Loaded: ${result.loaded}, Skipped: ${result.skipped}, Errors: ${result.errors}`);
//   if (result.errorDetails.length > 0) {
//     console.error('Import errors:', result.errorDetails.join('\n'));
//   }
```

### Notes

- Read at least 3 pattern files from `.nova/bistrolens-knowledge/` before writing the parser
  to understand the actual format. The frontmatter is not YAML — it uses bold markdown syntax
  (`**Field:** Value`). Your parser must match this format exactly.
- The dedup check uses SemanticDedup which requires Ollama to be running for embeddings.
  If Ollama is not running, `isDuplicate()` may fail — handle this gracefully by catching
  errors and allowing all nodes through (log a warning).
- GraphMemory uses `userId` to namespace nodes. BistroLens patterns use userId
  `'bistrolens-import'` so they can be queried separately from user-specific patterns.
- The `isGlobal: true` flag means these patterns participate in the Global Wisdom Pipeline
  and can be shared with all users (subject to their opt-in setting).
- Pattern files in `17-nova26-adaptations/` are Nova26-specific adaptations. These have
  the highest direct applicability — give them `confidence: 0.95` instead of the default.

---

## KIMI-INTEGRATE-04: Enhanced Venus UI Skills

**Files:** `.nova/agents/VENUS.md` (modify), `src/tools/core-tools.ts` (add tool)
**Target size:** ~150 lines of additions
**Spec:** Grok R11 — UI/UX Pro Max skills for Venus agent

### What to build

Venus already generates React/Tailwind components but does so without structured guidance
on component generation workflow, shadcn/ui component selection, or design system consistency.
This task enhances Venus with a new `generateUIComponent` tool and updates her agent
template with richer UI skill instructions.

**Read `.nova/agents/VENUS.md` in full before modifying it.** The template uses XML tags
(`<agent_profile>`, `<principles>`, `<constraints>`, `<output_format>`). Any additions must
follow the same XML structure and not break existing sections.

### New tool: generateUIComponent

Add to `src/tools/core-tools.ts`:

```typescript
{
  name: 'generateUIComponent',
  description: 'Generate a React/Tailwind component following Nova26 design system conventions. Returns a complete, accessible, responsive component with all 5 UI states (loading, empty, error, success, disabled).',
  parameters: z.object({
    componentName: z.string().describe('PascalCase component name, e.g. "UserCard", "DataTable"'),
    purpose: z.string().describe('What this component does and what data it displays'),
    props: z.array(z.string()).optional().describe('List of prop names this component needs'),
    shadcnComponents: z.array(z.string()).optional().describe('shadcn/ui components to use, e.g. ["Button", "Card", "Badge"]'),
    hasInteractivity: z.boolean().optional().describe('Whether component handles user interactions (clicks, form submission)'),
  }),
  execute: async (args) => {
    const { componentName, purpose, props, shadcnComponents, hasInteractivity } = args as {
      componentName: string;
      purpose: string;
      props?: string[];
      shadcnComponents?: string[];
      hasInteractivity?: boolean;
    };
    // Build a structured component specification that Venus uses as a prompt scaffold.
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

    return {
      success: true,
      output: spec,
      duration: 0,
      truncated: false,
    };
  },
  allowedAgents: ['VENUS'],  // Venus only
  blockedAgents: [],
  mutating: false,
  timeout: 5_000,
}
```

### Venus agent template additions

In `.nova/agents/VENUS.md`, add the following sections. Insert them after the existing
`<constraints>` block and before `<input_requirements>`:

```xml
<ui_skills>
  <skill name="Component Generation Workflow">
    <description>Before writing any component, call the generateUIComponent tool to build a structured specification. Use the spec as your implementation scaffold.</description>
    <workflow>
      <step>1. Call generateUIComponent with componentName, purpose, and any known props</step>
      <step>2. Review the spec — add domain-specific requirements from the task brief</step>
      <step>3. Implement the component, hitting every requirement in the spec</step>
      <step>4. Verify: grep for aria-, keyboard handlers, and all 5 UI state renders</step>
    </workflow>
  </skill>

  <skill name="shadcn/ui Awareness">
    <description>Prefer shadcn/ui primitives over hand-rolled equivalents. Use these when the task involves the corresponding UI pattern.</description>
    <components>
      <item>Button — all click targets, form submits, icon buttons</item>
      <item>Card, CardHeader, CardContent, CardFooter — content containers</item>
      <item>Badge — status indicators, tags, counts</item>
      <item>Dialog, AlertDialog — modals and confirmations</item>
      <item>Sheet — slide-over panels</item>
      <item>Tooltip — hover information</item>
      <item>Select, Checkbox, RadioGroup, Switch — form controls</item>
      <item>Table, TableHeader, TableRow, TableCell — data tables</item>
      <item>Skeleton — loading states (preferred over spinners for content areas)</item>
      <item>Alert — inline error and warning messages</item>
      <item>Tabs — multi-panel navigation</item>
      <item>DropdownMenu — contextual menus</item>
    </components>
    <rule>Never implement a custom component that duplicates a shadcn/ui primitive. Import from @/components/ui/*.</rule>
  </skill>

  <skill name="Accessibility by Default">
    <description>Every component must be usable by keyboard-only and screen-reader users. These are not optional enhancements — they are part of the component contract.</description>
    <checklist>
      <item>Interactive elements: Button (not div[onClick]), input, select, or role="button" with tabIndex="0"</item>
      <item>Images: alt text always present — descriptive for informational images, empty alt="" for decorative</item>
      <item>Form inputs: always paired with a visible or sr-only label via htmlFor/id</item>
      <item>Icons used alone: aria-hidden="true" on the icon + aria-label on the wrapping button</item>
      <item>Loading states: aria-busy="true" on the loading container</item>
      <item>Error states: role="alert" on error messages so screen readers announce them</item>
      <item>Modals: focus trap inside Dialog (shadcn/ui handles this automatically)</item>
      <item>Color alone never conveys meaning: pair color with text or icon</item>
    </checklist>
  </skill>

  <skill name="Responsive Design System">
    <description>All components are mobile-first. Apply styles without breakpoints for mobile, then override at sm:, md:, lg: for larger screens.</description>
    <breakpoints>
      <item>Default (no prefix): &lt;640px — mobile phones</item>
      <item>sm: 640px+ — large phones and small tablets</item>
      <item>md: 768px+ — tablets and small laptops</item>
      <item>lg: 1024px+ — laptops and desktops</item>
    </breakpoints>
    <patterns>
      <item>Stack on mobile, grid on desktop: flex flex-col md:grid md:grid-cols-2</item>
      <item>Full-width on mobile, constrained on desktop: w-full md:max-w-lg</item>
      <item>Hide on mobile, show on desktop: hidden md:block</item>
      <item>Larger tap targets on mobile: p-3 md:p-2 (44px minimum touch target)</item>
    </patterns>
  </skill>
</ui_skills>
```

Also add to the existing `<constraints><never>` block:

```xml
<item>Generate a component without calling generateUIComponent first (for components over 50 lines)</item>
<item>Use a custom button, input, or card when a shadcn/ui equivalent exists</item>
<item>Add an interactive element without keyboard navigation (onClick without onKeyDown or using Button component)</item>
<item>Omit aria-label on icon-only buttons</item>
<item>Skip the loading state (use Skeleton, not a spinner, for content areas)</item>
```

### Notes

- The `generateUIComponent` tool's `execute()` returns a specification string, not the
  component code itself. Venus uses this spec as a scaffold — the actual component code
  is written by Venus's LLM reasoning in the AgentLoop. The tool structures the task;
  the LLM writes the code.
- The `allowedAgents: ['VENUS']` restriction means only Venus can call this tool. Other
  agents that need UI components must request them via Venus (through task delegation in
  the orchestrator) or call the tool directly if they are added to allowedAgents later.
- After modifying `VENUS.md`, verify the file is still valid XML by checking that all
  opening tags have corresponding closing tags. Do not run it through an XML parser — just
  visually verify the balance.

---

## KIMI-INTEGRATE-05: Knowledge Base Tool

**File:** `src/tools/knowledge-base.ts`
**Target size:** ~200 lines
**Spec:** Grok R11 — Obsidian-style knowledge management / unified search

### What to build

The Knowledge Base tool provides a single query interface that searches across all
knowledge sources: Taste Vault patterns (including BistroLens patterns injected in
KIMI-INTEGRATE-03), and cached documentation (from KIMI-INTEGRATE-01). It returns ranked
results formatted for direct injection into agent prompts.

Any agent can call `queryKnowledge("how to validate user input in convex")` and receive
the top-ranked relevant results from all sources without knowing which source they came from.

### Core interfaces

```typescript
export interface KnowledgeResult {
  source: 'taste-vault' | 'docs-cache' | 'bistrolens';
  title: string;
  snippet: string;          // first 300 chars of relevant content
  relevanceScore: number;   // 0.0 – 1.0
  tags: string[];
  sourceRef: string;        // e.g. "taste-vault:node-abc123" or "docs:react/hooks"
}

export interface KnowledgeQueryResult {
  query: string;
  results: KnowledgeResult[];
  totalFound: number;
  searchedSources: string[];
  durationMs: number;
}
```

### KnowledgeBase class

```typescript
class KnowledgeBase {
  constructor(private options?: {
    maxResults?: number;      // default: 10 — max results returned to caller
    minScore?: number;        // default: 0.1 — filter out results below this score
    includeVault?: boolean;   // default: true
    includeDocsCache?: boolean; // default: true
  })

  async query(queryText: string): Promise<KnowledgeQueryResult>
  // 1. Validate: queryText must be a non-empty string. Trim whitespace.
  // 2. Run searches in parallel:
  //    a. searchVault(queryText) — search GraphMemory nodes
  //    b. searchDocsCache(queryText) — search .nova/docs-cache/
  // 3. Merge and rank all results by relevanceScore descending.
  // 4. Filter out results with score < minScore.
  // 5. Return top maxResults results.
  // 6. On any error in an individual search source: log warning, treat as empty results.
  //    Never let a single source failure prevent results from other sources.

  private searchVault(queryText: string): KnowledgeResult[]
  // Get all nodes from getGraphMemory() (use .getAllNodes() or equivalent).
  // For each node: compute keyword relevance score with keywordScore(queryText, node.content + ' ' + node.tags.join(' ')).
  // If SemanticDedup is available: also compute semantic similarity and blend:
  //   finalScore = 0.4 * keywordScore + 0.6 * semanticScore
  // If not available: use keyword score alone.
  // Return results above 0.0 with:
  //   source: 'bistrolens' if node.userId === 'bistrolens-import', else 'taste-vault'
  //   title: first line of node.content (up to 80 chars)
  //   snippet: node.content slice(0, 300)
  //   relevanceScore: finalScore
  //   tags: node.tags
  //   sourceRef: `taste-vault:${node.id}`

  private searchDocsCache(queryText: string): KnowledgeResult[]
  // Scan .nova/docs-cache/ for all .json files.
  // Parse each as DocsCacheEntry (import the schema from docs-fetcher.ts).
  // For each entry: compute keywordScore(queryText, entry.content).
  // Return results above 0.0 with:
  //   source: 'docs-cache'
  //   title: `${entry.library}${entry.topic ? ' / ' + entry.topic : ''} documentation`
  //   snippet: entry.content slice(0, 300)
  //   relevanceScore: keyword score
  //   tags: [entry.library, entry.topic ?? 'general'].filter(Boolean)
  //   sourceRef: `docs:${entry.library}/${entry.topic ?? '_default'}`

  private keywordScore(query: string, text: string): number
  // Simple keyword scoring:
  // 1. Tokenize query into words (split on /\s+/, lowercase, filter length >= 3).
  // 2. For each word: count occurrences in text (case-insensitive).
  // 3. Score = sum of (count per word) / text.length * 1000, capped at 1.0.
  // This is intentionally simple — it does not need to be TF-IDF.
  // The semantic layer (SemanticDedup) provides the quality; keyword scoring provides recall.

  formatForPrompt(result: KnowledgeQueryResult, maxTokens?: number): string
  // Format top results for injection into an agent system prompt.
  // Format:
  //   === Knowledge Base Results for: "{query}" ===
  //   ({totalFound} results from {searchedSources.join(', ')})
  //
  //   [1] {title} [{source}] (score: {relevanceScore.toFixed(2)})
  //   {snippet}
  //   Tags: {tags.join(', ')}
  //
  //   [2] ...
  //
  // Truncate total output to maxTokens * 4 characters (default maxTokens: 1500).
  // Always include at least 1 result even if truncation is needed.
}
```

### Singleton factory

```typescript
export function getKnowledgeBase(): KnowledgeBase
export function resetKnowledgeBase(): void  // for tests
```

### Registration in ToolRegistry

In `src/tools/core-tools.ts`, add:

```typescript
{
  name: 'queryKnowledge',
  description: 'Search across all knowledge sources: Taste Vault patterns, BistroLens best practices, and cached documentation. Use this before starting any non-trivial implementation to retrieve relevant patterns, prior art, and documentation.',
  parameters: z.object({
    query: z.string().describe('Natural language query describing what you are looking for, e.g. "form validation with zod", "react server components", "database indexing strategies"'),
    maxResults: z.number().optional().describe('Maximum number of results to return (default: 5)'),
  }),
  execute: async (args) => {
    const { query, maxResults } = args as { query: string; maxResults?: number };
    const kb = getKnowledgeBase({ maxResults: maxResults ?? 5 });
    const result = await kb.query(query);
    return {
      success: true,
      output: kb.formatForPrompt(result),
      duration: result.durationMs,
      truncated: result.results.length < result.totalFound,
    };
  },
  allowedAgents: [],   // available to ALL agents
  blockedAgents: [],
  mutating: false,
  timeout: 10_000,
}
```

### Notes

- `searchVault()` is synchronous (GraphMemory is in-memory). `searchDocsCache()` reads
  files synchronously. Use `Promise.all([searchVault(), searchDocsCache()])` by wrapping
  both in `Promise.resolve()` so they run in parallel without blocking.
- The semantic scoring path (SemanticDedup) involves an async Ollama call. To keep the
  tool response time under 10 seconds, limit semantic scoring to the top 20 keyword
  candidates only: sort by keyword score first, take top 20, then run semantic scoring on
  those 20. Skip semantic scoring entirely if keywordScore returns no results above 0.05.
- `getKnowledgeBase()` takes an optional options override — the factory should accept
  options and pass them to the constructor on each call (since options vary per invocation).
  Use: `export function getKnowledgeBase(options?: KnowledgeBaseOptions): KnowledgeBase`
  This breaks the pure singleton pattern — that is acceptable here since options affect
  behavior and callers pass different `maxResults` values.

---

## KIMI-INTEGRATE-06: Tests

**Files:**
- `src/tools/docs-fetcher.test.ts` — ~20 tests
- `src/skills/skill-runner.test.ts` — ~20 tests
- `src/skills/skill-registry.test.ts` — ~10 tests
- `src/taste-vault/pattern-loader.test.ts` — ~15 tests
- `src/tools/knowledge-base.test.ts` — ~15 tests
- Integration test within `knowledge-base.test.ts` — ~5 tests

**Target:** 85+ new tests. All must pass. The 1226+ existing tests must still pass.

All test files follow the pattern from `src/tools/tool-registry.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// ... subject imports
// reset singletons in beforeEach
```

---

### docs-fetcher.test.ts (~20 tests)

Use `vi.mock('https', ...)` or `vi.spyOn` to intercept HTTP calls — do not make real
network calls in tests. Use `os.tmpdir()` for cache directory to avoid touching `.nova/`.
Call `resetDocsFetcher()` in `beforeEach`.

Cover:

**Cache behavior:**
- `fetchDocs()` writes a cache entry to disk after a successful network fetch
- `fetchDocs()` returns `source: 'cache'` and `cacheHit: true` on second call within TTL
- `fetchDocs()` returns `source: 'network'` on first call (cache miss)
- `fetchDocs()` re-fetches and returns `source: 'network'` when the cache entry is expired
  (mock `Date.now()` to simulate TTL expiry)
- `getCacheEntry()` returns null when the cache file does not exist
- `getCacheEntry()` returns null when the cache file contains invalid JSON
- `getCacheEntry()` returns null when the entry's `expiresAt` is in the past

**Network behavior:**
- `fetchDocs()` builds the correct URL with library and topic as query params
- `fetchDocs()` parses a valid Context7 API response and returns content
- `fetchDocs()` returns the fallback result when the HTTP response is non-200
- `fetchDocs()` returns the fallback result when the request times out
- `fetchDocs()` returns the fallback result when the response body fails Zod validation
- `fetchDocs()` returns the fallback result when the HTTPS module throws

**Truncation:**
- `truncateToTokenBudget()` returns `truncated: false` when content is under the limit
- `truncateToTokenBudget()` returns `truncated: true` and appends `...[truncated]` when over
- `fetchDocs()` respects the `maxTokens` option passed to the constructor

**Input validation:**
- `fetchDocs()` throws when `library` is an empty string
- `fetchDocs()` sanitizes library name to lowercase and trimmed

**Cache management:**
- `clearCache(library)` removes only that library's cache directory
- `clearCache()` (no argument) removes the entire cache directory
- `getCacheStats()` returns zero entries on a fresh (empty) cache directory
- `getCacheStats()` returns correct entry count after multiple fetches

---

### skill-registry.test.ts (~10 tests)

Call `resetSkillRegistry()` in `beforeEach`.

Cover:

- `register()` adds a skill to the registry
- `register()` overwrites an existing skill with the same name (upsert)
- `get()` returns the registered skill by name
- `get()` returns null for an unknown skill name
- `listForAgent('MARS')` returns skills where `agents` is empty OR contains 'MARS'
- `listForAgent('SATURN')` does not return skills restricted to `['MARS']`
- `listAll()` returns all registered skills sorted alphabetically by name
- `unregister()` returns true and removes the skill when it exists
- `unregister()` returns false when the skill does not exist
- `has()` returns true for a registered skill, false for an unknown name
- Built-in skills are automatically registered on first `getSkillRegistry()` call
  (verify 'debug-root-cause', 'refactor-safely', 'generate-tests' are all present)

---

### skill-runner.test.ts (~20 tests)

Mock `getToolRegistry()` to inject a test tool registry. Call `resetSkillRunner()` and
`resetSkillRegistry()` in `beforeEach`.

Cover:

**Successful execution:**
- `execute()` runs all steps in order and returns `success: true`
- `execute()` accumulates step results in `context.stepResults`
- `execute()` returns the correct `stepsCompleted` count
- `execute()` calls each step's `buildArgs()` with the updated context (including prior results)

**Failure handling:**
- `execute()` returns `success: false` when a step's tool returns `success: false`
- `execute()` stops after the failing step (does not run subsequent steps)
- `execute()` sets `failedStep` to the name of the step that failed
- `execute()` returns `success: false` when a step's `validateResult()` returns false
- `execute()` returns `success: false` for an unknown skill name
- `execute()` returns `success: false` when a required tool is not in ToolRegistry
- `execute()` returns `success: false` (does not throw) when a step throws an exception
- `execute()` never throws — always returns a SkillRunResult regardless of errors

**Result formatting:**
- `formatResultForPrompt()` returns a string containing the skill name
- `formatResultForPrompt()` includes step names and truncated results for a success
- `formatResultForPrompt()` includes "Failed at step" and error message for a failure
- `formatResultForPrompt()` output is at most 1000 characters

**Timing:**
- `execute()` includes `durationMs` in the result (non-zero after real execution)
- `execute()` sets `durationMs` to 0 for an immediate unknown-skill failure

---

### pattern-loader.test.ts (~15 tests)

Use `os.tmpdir()` for test pattern directories. Create real temporary markdown files in
`beforeEach` with content that matches the actual BistroLens format. Call
`resetPatternLoader()` in `beforeEach`.

Cover:

**File parsing:**
- `parsePatternFile()` extracts the title from the first H1 heading
- `parsePatternFile()` extracts the description from the first paragraph after H1
- `parsePatternFile()` extracts all fenced code blocks into `codeExamples` array
- `parsePatternFile()` extracts the priority from `**Priority:** P1` frontmatter
- `parsePatternFile()` defaults to `'P2'` priority when frontmatter is missing
- `parsePatternFile()` extracts reusability number from `**Reusability:** 9/10`
- `parsePatternFile()` defaults to `5` reusability when not present
- `parsePatternFile()` derives the category from the parent directory name
- `parsePatternFile()` does not throw on a malformed or empty markdown file

**Node conversion:**
- `toGraphNode()` maps `01-security` category to NodeType `'Pattern'`
- `toGraphNode()` maps `02-steering-system` category to NodeType `'Strategy'`
- `toGraphNode()` maps `08-design-system` category to NodeType `'Preference'`
- `toGraphNode()` sets `isGlobal: true` on all BistroLens nodes
- `toGraphNode()` includes a code example excerpt in the content when available

**Import pipeline:**
- `loadPatternsFromDirectory()` skips `KIRO-COMBINED-TASK.md` and `KIRO-EXTRACTION-TASK.md`
- `importPatterns()` calls `getGraphMemory().addNode()` for each node
- `loadPatternsFromDirectory()` with `dryRun: true` parses but does not write to vault

---

### knowledge-base.test.ts (~15 tests + 5 integration tests)

Mock `getGraphMemory()` to return controlled test nodes. Mock filesystem reads for the
docs-cache. Call `resetKnowledgeBase()` in `beforeEach`.

**Vault search:**
- `searchVault()` returns results for a query that matches node content
- `searchVault()` returns empty array for a query with no keyword matches
- `searchVault()` tags bistrolens-import nodes with `source: 'bistrolens'`
- `searchVault()` tags other nodes with `source: 'taste-vault'`

**Docs cache search:**
- `searchDocsCache()` returns results for queries matching cached doc content
- `searchDocsCache()` returns empty array when `.nova/docs-cache/` is empty or missing

**Ranking and filtering:**
- `query()` returns results sorted by `relevanceScore` descending
- `query()` filters out results below `minScore`
- `query()` respects `maxResults` and never returns more than the configured maximum

**Edge cases:**
- `query()` returns an empty result set for an all-whitespace query (after trimming)
- `query()` does not throw when vault returns no nodes
- `query()` does not throw when docs-cache directory does not exist
- `query()` returns results from remaining sources when one source throws an error

**Result formatting:**
- `formatForPrompt()` includes the query text in the header
- `formatForPrompt()` includes source labels (`[taste-vault]`, `[bistrolens]`, `[docs-cache]`)
- `formatForPrompt()` truncates output at the configured token budget

**Integration tests (within knowledge-base.test.ts, tagged with `// integration`):**
- Given a real GraphMemory instance with BistroLens nodes loaded, `query("input validation")`
  returns at least 1 result from the vault
- Given a real docs-cache entry for "zod/schema", `query("zod schema validation")` returns
  the docs result
- `formatForPrompt()` output on a real multi-source query fits within 6000 characters
- `queryKnowledge` tool (via ToolRegistry) returns a non-empty string for a generic query
- `runSkill` tool (via ToolRegistry) returns a formatted result when the skill exists
  and required tools are registered

---

## File Structure to Create

```
src/
  tools/
    docs-fetcher.ts                 (KIMI-INTEGRATE-01)
    docs-fetcher.test.ts            (KIMI-INTEGRATE-06)
    knowledge-base.ts               (KIMI-INTEGRATE-05)
    knowledge-base.test.ts          (KIMI-INTEGRATE-06)
    core-tools.ts                   (modify: add fetchDocs, runSkill, queryKnowledge, generateUIComponent)
  skills/
    skill-registry.ts               (KIMI-INTEGRATE-02)
    skill-runner.ts                 (KIMI-INTEGRATE-02)
    skill-registry.test.ts          (KIMI-INTEGRATE-06)
    skill-runner.test.ts            (KIMI-INTEGRATE-06)
  taste-vault/
    pattern-loader.ts               (KIMI-INTEGRATE-03)
    pattern-loader.test.ts          (KIMI-INTEGRATE-06)
.nova/
  agents/
    VENUS.md                        (modify: add <ui_skills> block and new constraints)
  docs-cache/                       (created at runtime by DocsFetcher — gitignore this)
  bistrolens-knowledge/             (existing — read-only source for PatternLoader)
```

---

## Verification Checklist

After all six tasks are complete, run:

```bash
# TypeScript: must be 0 errors
npx tsc --noEmit

# Tests: must be 1226+ existing + 85+ new, 0 failing
npx vitest run

# Spot-check: docs fetcher cache round-trip
node --input-type=module << 'EOF'
import { getDocsFetcher } from './src/tools/docs-fetcher.js';
const fetcher = getDocsFetcher({ maxTokens: 500, baseUrl: 'https://context7.com/api/docs' });
// First call — network (or graceful fallback if offline)
const r1 = await fetcher.fetchDocs('zod', 'schema');
console.log('Fetch 1 — source:', r1.source, '| truncated:', r1.truncated);
console.log('Content preview:', r1.content.slice(0, 100));
// Second call — should hit cache
const r2 = await fetcher.fetchDocs('zod', 'schema');
console.log('Fetch 2 — cacheHit:', r2.cacheHit, '| source:', r2.source);
const stats = fetcher.getCacheStats();
console.log('Cache stats:', JSON.stringify(stats));
EOF

# Spot-check: skill registry and runner
node --input-type=module << 'EOF'
import { getSkillRegistry } from './src/skills/skill-registry.js';
import { getSkillRunner } from './src/skills/skill-runner.js';
const registry = getSkillRegistry();
const allSkills = registry.listAll();
console.log('Registered skills:', allSkills.map(s => s.name).join(', '));
const marsSkills = registry.listForAgent('MARS');
console.log('MARS skills:', marsSkills.map(s => s.name).join(', '));
const saturnSkills = registry.listForAgent('SATURN');
console.log('SATURN skills:', saturnSkills.map(s => s.name).join(', '));
EOF

# Spot-check: BistroLens pattern loader (dry run)
node --input-type=module << 'EOF'
import { getPatternLoader } from './src/taste-vault/pattern-loader.js';
const loader = getPatternLoader({ dryRun: true });
const result = await loader.loadPatternsFromDirectory('.nova/bistrolens-knowledge');
console.log('Pattern load result (dry run):');
console.log('  Parsed:', result.loaded + result.skipped + result.errors, 'files');
console.log('  Would import:', result.loaded, 'patterns');
console.log('  Skipped (dedup):', result.skipped);
console.log('  Errors:', result.errors);
if (result.errorDetails.length > 0) {
  console.log('  Error details:', result.errorDetails.slice(0, 3).join('\n  '));
}
EOF

# Spot-check: knowledge base query
node --input-type=module << 'EOF'
import { getKnowledgeBase } from './src/tools/knowledge-base.js';
const kb = getKnowledgeBase({ maxResults: 3 });
const result = await kb.query('input validation typescript');
console.log('Query results:');
console.log('  Total found:', result.totalFound);
console.log('  Sources searched:', result.searchedSources.join(', '));
console.log('  Duration:', result.durationMs, 'ms');
console.log('  Top result:', result.results[0]?.title ?? 'none');
const formatted = kb.formatForPrompt(result);
console.log('Formatted output length:', formatted.length, 'chars');
console.log('Preview:', formatted.slice(0, 200));
EOF

# Spot-check: full agent tool availability
node --input-type=module << 'EOF'
import { getToolRegistry } from './src/tools/tool-registry.js';
const registry = getToolRegistry();
const tools = registry.listAll();
const newTools = ['fetchDocs', 'runSkill', 'queryKnowledge', 'generateUIComponent'];
for (const toolName of newTools) {
  const found = tools.some(t => t.name === toolName);
  console.log(`Tool "${toolName}" registered:`, found);
}
EOF
```

---

## Commit Order

Commit after each task so main stays green:

1. `feat(integrate): KIMI-INTEGRATE-01 docs-fetcher — Context7 live documentation with 7-day cache`
2. `feat(integrate): KIMI-INTEGRATE-02 skills framework — SkillRegistry, SkillRunner, 3 built-in skills`
3. `feat(integrate): KIMI-INTEGRATE-03 pattern-loader — import 79 BistroLens patterns into Taste Vault`
4. `feat(integrate): KIMI-INTEGRATE-04 venus UI skills — generateUIComponent tool, shadcn awareness, a11y checklist`
5. `feat(integrate): KIMI-INTEGRATE-05 knowledge-base — unified search across vault, bistrolens, docs cache`
6. `feat(integrate): KIMI-INTEGRATE-06 85+ tests for docs-fetcher, skills, pattern-loader, knowledge-base`

Each commit must pass `npx tsc --noEmit` and `npx vitest run` before being committed.

---

## Key Design Decisions (do not deviate without flagging)

1. **DocsFetcher uses Node's built-in `https` module, not `fetch()`.**
   Node 18+ has experimental fetch but it is not universally enabled in CI environments.
   Use `https.get()` with a manual timeout. This adds 10-15 lines but removes a reliability
   risk in CI. Do not add `node-fetch` or `axios` as a dependency.

2. **Skills are pure tool orchestrators — they never call LLMs directly.**
   A Skill's `execute()` in SkillRunner only calls ToolRegistry tools. The LLM reasoning
   about skill results happens in the AgentLoop's normal ReAct cycle. This keeps skills
   predictable, testable, and auditable — their output is deterministic given the same
   tool results.

3. **BistroLens patterns are imported with `isGlobal: true` and `userId: 'bistrolens-import'`.**
   This makes them discoverable by the Global Wisdom Pipeline and queryable by namespace.
   They are not attributed to any real user and cannot be opted-out by tier restrictions.
   Future sprints can add a `source` field to GraphNode to distinguish origin more cleanly.

4. **The KnowledgeBase does not maintain its own data store.**
   It reads from GraphMemory (for vault/bistrolens) and the docs-cache filesystem (for
   documentation). It is a query aggregator, not a storage layer. There is no
   `knowledge-base.json` file — the KB is computed on demand from existing stores.

5. **`getKnowledgeBase()` accepts per-call options, breaking the pure singleton pattern.**
   This is intentional — `maxResults` varies per tool invocation and affects the result set.
   The factory creates a new instance with the provided options on each call. The "singleton"
   pattern here is used for testability (via `resetKnowledgeBase()`) but not for caching
   a single instance.

6. **The `generateUIComponent` tool returns a specification, not code.**
   The tool structures Venus's task by returning a requirements checklist. Venus's LLM
   reasoning writes the actual component. This design means the tool output is deterministic
   and testable, while the creative work stays in the LLM where it belongs.

7. **Skill built-ins are registered at module load time (module-level side effect).**
   When `src/skills/skill-registry.ts` is first imported, the three built-in skills are
   registered via `getSkillRegistry().register(...)`. Tests call `resetSkillRegistry()`
   in `beforeEach` to clear the singleton, then re-import or re-call `getSkillRegistry()`
   which re-registers the built-ins. This ensures built-ins are always present without
   a separate initialization step.

8. **Pattern dedup is best-effort — import errors never block the pipeline.**
   If SemanticDedup cannot run (Ollama down, embeddings unavailable), all patterns are
   imported without dedup. If dedup finds a duplicate, it is silently skipped with a count
   increment. If `addNode()` throws for a single node, that node is counted as an error
   and the loop continues. The result summary tells the user exactly what happened.

9. **The docs-cache is gitignored and treated as ephemeral.**
   Cached documentation is not committed. It is machine-local, expires in 7 days, and is
   re-fetched on next use. This prevents stale docs from being committed into the repo.
   The `.nova/docs-cache/` directory is created on first use; developers do not need to
   create it manually.

10. **Venus's agent template additions use the same XML tag structure as the existing file.**
    Read `VENUS.md` before writing. The additions must fit inside the existing XML envelope
    without creating duplicate or malformed tags. If the existing file does not have a
    `<ui_skills>` section, add it. If it already has one, extend it. Do not duplicate
    existing constraints — only add new ones from this spec.
