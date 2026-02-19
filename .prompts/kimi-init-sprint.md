# KIMI-INIT Sprint: Advanced Project Initialization (R17-02)

> Assigned to: Kimi
> Sprint: Advanced Init (post-R17 Mega)
> Date issued: 2026-02-19
> Prerequisite: KIMI-R17-MEGA complete (~2081 tests, 0 TS errors)

## Project Context

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama (local LLM), Convex, and vitest. Agents are named after celestial bodies: MARS, VENUS, MERCURY, JUPITER, SATURN, PLUTO, ATLAS, etc.

**Key systems you should be aware of (do not modify unless told):**

- Core execution: Ralph Loop (`src/orchestrator/ralph-loop.ts`)
- Existing init command: `src/cli/init.ts` (563 lines — basic project setup)
- Taste Vault: `src/taste-vault/`
- ACE playbooks: `src/ace/`
- Rehearsal Stage: `src/rehearsal/`
- Session Memory: `src/memory/session-memory.ts`
- Agent Memory: `src/memory/agent-memory.ts`
- Personality Engine: `src/agents/personality-engine.ts`
- Portfolio: `src/portfolio/`
- Generative UI: `src/generative-ui/`
- Autonomous Testing: `src/testing/`
- Dream Engine: `src/dream/`
- Parallel Universe: `src/universe/`
- Overnight Evolution: `src/evolution/`
- Nova Symbiont: `src/symbiont/`
- Taste Room: `src/taste-room/`

**Current state:** ~2081 tests passing, 0 TypeScript errors.

**Important context:** `src/cli/init.ts` already exists and handles the basic `nova26 init` command — Ollama detection, tier selection, directory structure creation, agent template copying, sample PRD generation, `.novaignore` creation, and repo indexing. The advanced project initialization system (this sprint) is a **separate, higher-level system** that adds project templates, framework auto-detection, intelligent dependency recommendations, and a configuration wizard. New files go in a **NEW directory** `src/init/`. Do **not** modify `src/cli/init.ts`.

**Key distinction from existing init:** The existing `src/cli/init.ts` is a CLI command handler that creates the `.nova/` directory structure and basic configuration. The advanced init system in `src/init/` provides *intelligent* initialization — it detects what kind of project the user has, recommends frameworks and dependencies, offers pre-built templates for common project types, and walks users through configuration with a wizard. The advanced init system produces data that the existing init command can consume.

---

## Rules

- TypeScript strict mode. No `any` types.
- ESM imports with `.js` extensions (e.g., `import { Foo } from './foo.js';`).
- Every new `.ts` source file gets a companion `.test.ts` file in the same directory.
- Tests use vitest (`import { describe, it, expect, vi, beforeEach } from 'vitest';`).
- Mock Ollama calls — **never** make real LLM calls in tests. Use `vi.fn()` or `vi.mock()`.
- Mock file system operations in tests — **never** read/write real files. Use `vi.mock('fs')`.
- Do **not** modify existing source files unless explicitly told to extend them.
- Run `npx tsc --noEmit` and `npx vitest run` after each task. Zero errors, zero failures.
- Target: 2081+ tests passing at end of sprint (aim for 90+ new tests).
- Use `zod` for runtime validation where appropriate.
- All IDs should be generated with `crypto.randomUUID()`.
- All timestamps should be ISO 8601 strings (`new Date().toISOString()`).

---

## KIMI-INIT-01: Project Template System

### Files to Create

- `src/init/template-system.ts`
- `src/init/template-system.test.ts`

### Purpose

A template system that scaffolds different project types (React app, API server, CLI tool, full-stack) with pre-configured Nova26 settings, agent configurations, and sample PRDs tailored to the project type. Each template defines the files to create, dependencies to install, scripts to add, and Nova26 configuration overrides specific to that project type. Templates support variable interpolation (`{{projectName}}`, `{{author}}`, etc.) so generated files are personalized to the user's project.

### Interfaces to Implement

All interfaces must be exported from `src/init/template-system.ts`:

```typescript
export type ProjectType = 'react-app' | 'next-app' | 'api-server' | 'cli-tool' | 'full-stack' | 'library' | 'monorepo';

export interface ProjectTemplate {
  id: string;
  name: string;
  type: ProjectType;
  description: string;
  version: string;
  files: TemplateFile[];           // files to create
  dependencies: string[];          // npm packages to install
  devDependencies: string[];
  scripts: Record<string, string>; // package.json scripts
  novaConfig: Record<string, unknown>; // .nova/config.json overrides
  agentOverrides: Record<string, Record<string, unknown>>; // agent-specific config
  tags: string[];
}

export interface TemplateFile {
  path: string;                    // relative to project root
  content: string;
  templateVars: string[];          // variables like {{projectName}}, {{author}}
}

export interface TemplateVariable {
  name: string;
  description: string;
  defaultValue?: string;
  required: boolean;
  validator?: (value: string) => boolean;
}

export interface TemplateRenderResult {
  templateId: string;
  renderedFiles: Array<{ path: string; content: string }>;
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  novaConfig: Record<string, unknown>;
  renderedAt: string;
}
```

### Class to Implement

```typescript
export class TemplateSystem {
  constructor();
}
```

The constructor initializes the built-in template registry. At least 4 built-in templates must be registered during construction: `react-app`, `api-server`, `cli-tool`, `library`. Additional types (`next-app`, `full-stack`, `monorepo`) may be included but are not required for the minimum.

### Built-in Templates

Each template must have:
- A unique `id` generated with `crypto.randomUUID()` (generated once at construction, stable for the lifetime of the instance).
- A `name`, `description`, `version` (`'1.0.0'`), and populated `tags` array.
- At least 2 `files` entries with template variables.
- Appropriate `dependencies` and `devDependencies` for the project type.
- At least 2 `scripts` entries.
- A `novaConfig` object with at least one override.
- An `agentOverrides` object (may be empty `{}`).

**react-app** template:
- `dependencies`: `['react', 'react-dom']`
- `devDependencies`: `['@types/react', '@types/react-dom', 'typescript', 'vite', '@vitejs/plugin-react', 'vitest']`
- `scripts`: `{ 'dev': 'vite', 'build': 'tsc && vite build', 'test': 'vitest run', 'preview': 'vite preview' }`
- `files`: at least `src/App.tsx` and `src/main.tsx` with `{{projectName}}` variable
- `tags`: `['frontend', 'react', 'vite', 'typescript']`

**api-server** template:
- `dependencies`: `['express', 'zod', 'cors']`
- `devDependencies`: `['@types/express', '@types/cors', 'typescript', 'tsx', 'vitest']`
- `scripts`: `{ 'dev': 'tsx watch src/index.ts', 'build': 'tsc', 'test': 'vitest run', 'start': 'node dist/index.js' }`
- `files`: at least `src/index.ts` and `src/routes.ts` with `{{projectName}}` and `{{author}}` variables
- `tags`: `['backend', 'express', 'api', 'typescript']`

**cli-tool** template:
- `dependencies`: `['commander', 'chalk']`
- `devDependencies`: `['typescript', 'vitest', '@types/node']`
- `scripts`: `{ 'dev': 'tsx src/cli.ts', 'build': 'tsc', 'test': 'vitest run' }`
- `files`: at least `src/cli.ts` and `src/commands/index.ts` with `{{projectName}}` variable
- `tags`: `['cli', 'tool', 'typescript']`

**library** template:
- `dependencies`: `[]`
- `devDependencies`: `['typescript', 'vitest', 'tsup']`
- `scripts`: `{ 'build': 'tsup src/index.ts --format esm,cjs --dts', 'test': 'vitest run', 'prepublishOnly': 'npm run build' }`
- `files`: at least `src/index.ts` and `README.md` with `{{projectName}}` and `{{author}}` variables
- `tags`: `['library', 'npm', 'typescript']`

### Functions (all instance methods on `TemplateSystem`)

1. **`listTemplates(): ProjectTemplate[]`**
   - Returns all built-in templates (at least 4: react-app, api-server, cli-tool, library).
   - Returns a new array (not the internal reference).

2. **`getTemplate(type: ProjectType): ProjectTemplate | undefined`**
   - Returns the template matching the given type, or `undefined` if no template exists for that type.

3. **`getTemplateVariables(template: ProjectTemplate): TemplateVariable[]`**
   - Scans all `template.files[].content` for `{{variableName}}` patterns.
   - Extracts unique variable names.
   - Returns a `TemplateVariable` for each unique variable found:
     - `name`: the variable name (e.g., `'projectName'`).
     - `description`: auto-generated description (e.g., `'Value for projectName'`).
     - `required`: `true` for `projectName`, `false` for others.
     - `defaultValue`: `undefined` for required variables, `''` for optional.
   - The variable `projectName` is always required. The variable `author` is always optional with default `''`.

4. **`renderTemplate(template: ProjectTemplate, variables: Record<string, string>): TemplateRenderResult`**
   - Iterates over `template.files` and replaces all `{{variableName}}` occurrences in `content` with the corresponding value from `variables`.
   - If a variable is referenced in the template but not provided in `variables`, leaves the `{{variableName}}` placeholder as-is.
   - Returns a `TemplateRenderResult` with:
     - `templateId`: the template's `id`.
     - `renderedFiles`: array of `{ path, content }` with variables replaced.
     - `dependencies`: copied from template.
     - `devDependencies`: copied from template.
     - `scripts`: copied from template.
     - `novaConfig`: copied from template.
     - `renderedAt`: current ISO 8601 timestamp.

5. **`validateVariables(template: ProjectTemplate, variables: Record<string, string>): Array<{ variable: string; error: string }>`**
   - Calls `getTemplateVariables(template)` to get required variables.
   - For each required variable, checks if it exists in `variables` and is non-empty.
   - Returns an array of validation errors. Empty array means all valid.
   - Error format: `{ variable: 'projectName', error: 'Required variable "projectName" is missing' }`.

6. **`createProjectFromTemplate(type: ProjectType, variables: Record<string, string>): TemplateRenderResult`**
   - Full pipeline: `getTemplate(type)` → `validateVariables()` → `renderTemplate()`.
   - Throws `Error` if template not found: `'No template found for type: ${type}'`.
   - Throws `Error` if validation fails: `'Template validation failed: ${errors.map(e => e.error).join(', ')}'`.
   - Returns the `TemplateRenderResult` on success.

### Required Tests (minimum 20)

Write these in `src/init/template-system.test.ts`:

1. **Lists at least 4 built-in templates** — verify `listTemplates().length >= 4`.
2. **Each template has unique ID** — verify all IDs are distinct UUIDs.
3. **Gets template by type: react-app** — verify `getTemplate('react-app')` returns a template with `type === 'react-app'`.
4. **Returns undefined for unknown type** — verify `getTemplate('monorepo')` returns `undefined` (if monorepo not implemented) or test a definitely-unknown type cast.
5. **Extracts template variables from files** — template with `{{projectName}}` and `{{author}}`, verify both extracted.
6. **Renders template with variables replaced** — provide `{ projectName: 'my-app' }`, verify `{{projectName}}` replaced in rendered content.
7. **Handles {{projectName}} variable** — verify the string `'{{projectName}}'` no longer appears in rendered output when variable provided.
8. **Handles {{author}} variable** — provide `{ author: 'Jane' }`, verify `{{author}}` replaced in rendered content.
9. **Validates required variables present** — provide `{ projectName: 'test' }`, verify empty errors array.
10. **Validation error for missing required var** — provide `{}` (no projectName), verify error for `projectName`.
11. **react-app template has correct dependencies** — verify `dependencies` includes `'react'` and `'react-dom'`.
12. **api-server template has correct dependencies** — verify `dependencies` includes `'express'` and `'zod'`.
13. **cli-tool template has correct structure** — verify `files` includes a file with path containing `'cli'`.
14. **library template has correct structure** — verify `files` includes a file with path `'src/index.ts'`.
15. **Template files have correct paths** — verify all file paths are non-empty strings.
16. **Render result includes dependencies** — verify `renderedFiles`, `dependencies`, and `devDependencies` present.
17. **Render result includes scripts** — verify `scripts` is a non-empty object.
18. **Render result includes nova config** — verify `novaConfig` is a non-empty object.
19. **createProjectFromTemplate full pipeline works** — call with `'react-app'` and valid variables, verify `TemplateRenderResult` returned.
20. **createProjectFromTemplate throws for unknown type** — call with invalid type, expect error.
21. **createProjectFromTemplate throws for missing required vars** — call with empty variables, expect error.
22. **Template tags are populated** — verify each template has at least one tag.

---

## KIMI-INIT-02: Framework Detection Engine

### Files to Create

- `src/init/framework-detector.ts`
- `src/init/framework-detector.test.ts`

### Purpose

Automatically detect what frameworks, languages, and tools a project uses by analyzing `package.json`, `tsconfig.json`, file structure, and config files. The detector maintains a registry of framework signatures — known patterns that indicate the presence of a framework. It checks package dependencies, looks for characteristic config files (e.g., `next.config.js` means Next.js), and scans file structure patterns (e.g., `src/app/` directory means Next.js App Router). The output is a comprehensive `ProjectProfile` that downstream systems (dependency recommender, config wizard, template system) can use.

### Interfaces to Implement

All interfaces must be exported from `src/init/framework-detector.ts`:

```typescript
import type { ProjectType } from './template-system.js';

export type FrameworkCategory = 'frontend' | 'backend' | 'testing' | 'build' | 'css' | 'database' | 'deployment';

export interface DetectedFramework {
  name: string;                    // e.g., 'React', 'Express', 'Vitest'
  category: FrameworkCategory;
  version?: string;
  confidence: number;              // 0-1
  detectedFrom: string;            // what file/signal detected it
}

export interface FrameworkSignature {
  name: string;
  category: FrameworkCategory;
  packageNames: string[];          // any of these in deps → detected
  configFiles: string[];           // any of these exist → detected
  filePatterns: string[];          // glob patterns that indicate this framework
}

export interface ProjectProfile {
  projectId: string;
  detectedAt: string;
  frameworks: DetectedFramework[];
  primaryLanguage: 'typescript' | 'javascript' | 'unknown';
  hasTests: boolean;
  hasCi: boolean;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';
  isMonorepo: boolean;
  projectType: ProjectType;        // inferred from detected frameworks
}
```

### Class to Implement

```typescript
export class FrameworkDetector {
  constructor();
}
```

The constructor initializes the built-in signature registry with at least 12 framework signatures.

### Built-in Signatures

The following frameworks must have signatures registered:

| Name | Category | packageNames | configFiles | filePatterns |
|---|---|---|---|---|
| React | frontend | `['react', 'react-dom']` | `[]` | `['src/App.tsx', 'src/App.jsx']` |
| Next.js | frontend | `['next']` | `['next.config.js', 'next.config.mjs', 'next.config.ts']` | `['src/app/layout.tsx', 'app/layout.tsx', 'pages/_app.tsx']` |
| Vue | frontend | `['vue']` | `['vue.config.js', 'vite.config.ts']` | `['src/App.vue']` |
| Angular | frontend | `['@angular/core']` | `['angular.json']` | `['src/app/app.module.ts', 'src/app/app.component.ts']` |
| Express | backend | `['express']` | `[]` | `[]` |
| Fastify | backend | `['fastify']` | `[]` | `[]` |
| Vitest | testing | `['vitest']` | `['vitest.config.ts', 'vitest.config.js']` | `[]` |
| Jest | testing | `['jest']` | `['jest.config.js', 'jest.config.ts']` | `[]` |
| Tailwind | css | `['tailwindcss']` | `['tailwind.config.js', 'tailwind.config.ts']` | `[]` |
| Prisma | database | `['prisma', '@prisma/client']` | `[]` | `['prisma/schema.prisma']` |
| Drizzle | database | `['drizzle-orm']` | `['drizzle.config.ts']` | `[]` |
| Docker | deployment | `[]` | `['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml']` | `[]` |

### Functions (all instance methods on `FrameworkDetector`)

1. **`getSignatures(): FrameworkSignature[]`**
   - Returns all built-in framework signatures.
   - Returns a new array (not the internal reference).

2. **`detectFromPackageJson(packageJson: Record<string, unknown>): DetectedFramework[]`**
   - Extracts `dependencies` and `devDependencies` from the `packageJson` object.
   - For each signature, checks if any of its `packageNames` appear in the combined dependency list.
   - If found, creates a `DetectedFramework` with:
     - `name`: signature name.
     - `category`: signature category.
     - `version`: the version string from package.json if available.
     - `confidence`: `1.0` (package.json is definitive).
     - `detectedFrom`: `'package.json'`.
   - Returns all detected frameworks.

3. **`detectFromConfigFiles(existingFiles: string[]): DetectedFramework[]`**
   - For each signature, checks if any of its `configFiles` appear in `existingFiles`.
   - If found, creates a `DetectedFramework` with:
     - `confidence`: `0.9` (config file is strong signal but could be leftover).
     - `detectedFrom`: the matched config file name.
   - Returns all detected frameworks.

4. **`detectFromFileStructure(filePaths: string[]): DetectedFramework[]`**
   - For each signature, checks if any of its `filePatterns` appear in `filePaths`.
   - If found, creates a `DetectedFramework` with:
     - `confidence`: `0.7` (file structure is suggestive but not definitive).
     - `detectedFrom`: the matched file pattern.
   - Returns all detected frameworks.

5. **`detectPackageManager(existingFiles: string[]): ProjectProfile['packageManager']`**
   - Checks for lockfiles in `existingFiles`:
     - `'yarn.lock'` → `'yarn'`
     - `'pnpm-lock.yaml'` → `'pnpm'`
     - `'bun.lockb'` → `'bun'`
     - `'package-lock.json'` → `'npm'`
   - If none found: `'unknown'`.
   - If multiple found, priority: pnpm > yarn > bun > npm (pnpm is most explicit).

6. **`buildProfile(projectId: string, packageJson: Record<string, unknown>, existingFiles: string[], filePaths: string[]): ProjectProfile`**
   - Full detection pipeline:
     1. `detectFromPackageJson(packageJson)` → frameworks from deps.
     2. `detectFromConfigFiles(existingFiles)` → frameworks from config files.
     3. `detectFromFileStructure(filePaths)` → frameworks from file patterns.
     4. Merge all detected frameworks. If the same framework is detected multiple times, keep the one with the highest confidence.
     5. `detectPackageManager(existingFiles)` → package manager.
     6. Determine `primaryLanguage`:
        - If `'typescript'` is in dependencies/devDependencies OR `'tsconfig.json'` is in existingFiles → `'typescript'`.
        - Else if `'package.json'` is in existingFiles → `'javascript'`.
        - Else → `'unknown'`.
     7. `hasTests`: true if any testing framework detected (Vitest, Jest) OR any file in `filePaths` matches `*.test.*` or `*.spec.*`.
     8. `hasCi`: true if any of `.github/workflows`, `.gitlab-ci.yml`, `.circleci/config.yml`, `Jenkinsfile` found in `existingFiles`.
     9. `isMonorepo`: true if any of `'lerna.json'`, `'pnpm-workspace.yaml'`, `'packages/'` found in existingFiles, or packageJson has `workspaces` field.
     10. `inferProjectType(frameworks)` → `projectType`.
   - Returns the complete `ProjectProfile` with `detectedAt` set to now.

7. **`inferProjectType(frameworks: DetectedFramework[]): ProjectType`**
   - Decision logic:
     - If Next.js detected → `'next-app'`.
     - If React, Vue, or Angular detected (and no backend framework) → `'react-app'`.
     - If Express or Fastify detected (and no frontend framework) → `'api-server'`.
     - If both frontend AND backend frameworks detected → `'full-stack'`.
     - If `commander` or `yargs` or `meow` in dependencies (check framework names) → `'cli-tool'`.
     - Default → `'library'`.

### Required Tests (minimum 18)

Write these in `src/init/framework-detector.test.ts`:

1. **Returns at least 12 framework signatures** — verify `getSignatures().length >= 12`.
2. **Detects React from package.json** — `{ dependencies: { react: '^18.0.0' } }`, verify React detected.
3. **Detects Express from package.json** — `{ dependencies: { express: '^4.18.0' } }`, verify Express detected.
4. **Package.json detection has confidence 1.0** — verify confidence field.
5. **Detects version from package.json** — verify version string extracted.
6. **Detects Next.js from config file** — existingFiles includes `'next.config.js'`, verify Next.js detected.
7. **Config file detection has confidence 0.9** — verify confidence field.
8. **Detects React from file structure** — filePaths includes `'src/App.tsx'`, verify React detected.
9. **File structure detection has confidence 0.7** — verify confidence field.
10. **Detects npm from package-lock.json** — existingFiles includes `'package-lock.json'`, verify `'npm'`.
11. **Detects yarn from yarn.lock** — verify `'yarn'`.
12. **Detects pnpm from pnpm-lock.yaml** — verify `'pnpm'`.
13. **Detects bun from bun.lockb** — verify `'bun'`.
14. **Unknown package manager when no lockfile** — verify `'unknown'`.
15. **Builds full project profile** — provide packageJson with React and Vitest, existingFiles with tsconfig.json, verify profile.
16. **Detects TypeScript as primary language** — tsconfig.json present, verify `'typescript'`.
17. **Infers react-app project type** — React detected, no backend, verify `'react-app'`.
18. **Infers api-server project type** — Express detected, no frontend, verify `'api-server'`.
19. **Infers next-app project type** — Next.js detected, verify `'next-app'`.
20. **Infers full-stack project type** — React + Express detected, verify `'full-stack'`.
21. **Detects monorepo from workspaces** — packageJson has `workspaces`, verify `isMonorepo: true`.
22. **Detects CI from .github/workflows** — existingFiles includes `.github/workflows`, verify `hasCi: true`.

---

## KIMI-INIT-03: Dependency Recommendations

### Files to Create

- `src/init/dependency-recommender.ts`
- `src/init/dependency-recommender.test.ts`

### Purpose

Given a project profile (from the framework detector), recommend missing dependencies that would improve the developer experience — testing frameworks, linters, formatters, type checking tools, and Nova26-compatible packages. The recommender applies a set of rules that check for common gaps (e.g., a TypeScript project without a linter, a React project without testing-library). It also detects conflicts between packages and ranks recommendations by priority.

### Interfaces to Implement

All interfaces must be exported from `src/init/dependency-recommender.ts`:

```typescript
import type { FrameworkCategory, ProjectProfile } from './framework-detector.js';

export type RecommendationPriority = 'essential' | 'recommended' | 'nice-to-have';

export interface DependencyRecommendation {
  id: string;
  packageName: string;
  version: string;                 // latest recommended version
  isDev: boolean;
  priority: RecommendationPriority;
  reason: string;                  // why this is recommended
  category: FrameworkCategory;
  conflictsWith: string[];         // packages that conflict
  requiredBy: string[];            // features that need this
}

export interface RecommendationRule {
  condition: (profile: ProjectProfile) => boolean;
  recommendation: Omit<DependencyRecommendation, 'id'>;
}

export interface RecommendationReport {
  reportId: string;
  projectId: string;
  generatedAt: string;
  recommendations: DependencyRecommendation[];
  essentialCount: number;
  recommendedCount: number;
  niceToHaveCount: number;
  alreadyInstalled: string[];      // packages that are already in deps
}
```

### Class to Implement

```typescript
export class DependencyRecommender {
  constructor();
}
```

The constructor initializes the built-in recommendation rules.

### Built-in Recommendation Rules

The following rules must be registered:

1. **No test framework → recommend vitest (essential)**
   - Condition: `!profile.hasTests` (no testing framework detected).
   - Package: `vitest`, version `'^2.0.0'`, isDev `true`, category `'testing'`.
   - Reason: `'No testing framework detected. Vitest provides fast, TypeScript-native testing.'`
   - Priority: `'essential'`.
   - Conflicts with: `['jest']`.
   - Required by: `['testing', 'ci']`.

2. **TypeScript project without @types/node → recommend @types/node (recommended)**
   - Condition: `profile.primaryLanguage === 'typescript'` AND no `@types/node` in existing deps.
   - Package: `@types/node`, version `'^20.0.0'`, isDev `true`, category `'build'`.
   - Reason: `'TypeScript project should have Node.js type definitions.'`
   - Priority: `'recommended'`.

3. **No linter → recommend eslint (recommended)**
   - Condition: no framework with name `'ESLint'` detected (check by looking at frameworks list).
   - Package: `eslint`, version `'^9.0.0'`, isDev `true`, category `'build'`.
   - Reason: `'No linter detected. ESLint catches bugs and enforces code style.'`
   - Priority: `'recommended'`.
   - Conflicts with: `[]`.
   - Required by: `['code-quality']`.

4. **No formatter → recommend prettier (nice-to-have)**
   - Condition: no formatter detected in frameworks.
   - Package: `prettier`, version `'^3.0.0'`, isDev `true`, category `'build'`.
   - Reason: `'No code formatter detected. Prettier ensures consistent formatting.'`
   - Priority: `'nice-to-have'`.

5. **React without @testing-library/react → recommend it (recommended)**
   - Condition: React detected in frameworks AND `@testing-library/react` not in existing deps.
   - Package: `@testing-library/react`, version `'^16.0.0'`, isDev `true`, category `'testing'`.
   - Reason: `'React project should use Testing Library for component testing.'`
   - Priority: `'recommended'`.
   - Conflicts with: `[]`.
   - Required by: `['component-testing']`.

6. **API server without zod → recommend zod (recommended)**
   - Condition: project type is `'api-server'` or `'full-stack'` AND no `zod` detected.
   - Package: `zod`, version `'^3.23.0'`, isDev `false`, category `'backend'`.
   - Reason: `'API servers benefit from runtime schema validation with Zod.'`
   - Priority: `'recommended'`.

7. **No git hooks → recommend husky (nice-to-have)**
   - Condition: no `husky` or `lint-staged` detected in frameworks/deps.
   - Package: `husky`, version `'^9.0.0'`, isDev `true`, category `'build'`.
   - Reason: `'Git hooks with Husky automate pre-commit checks.'`
   - Priority: `'nice-to-have'`.
   - Required by: `['git-workflow']`.

8. **TypeScript project without tsx → recommend tsx (nice-to-have)**
   - Condition: `profile.primaryLanguage === 'typescript'` AND no `tsx` in existing deps.
   - Package: `tsx`, version `'^4.0.0'`, isDev `true`, category `'build'`.
   - Reason: `'tsx enables running TypeScript files directly without compilation.'`
   - Priority: `'nice-to-have'`.

### Functions (all instance methods on `DependencyRecommender`)

1. **`getRecommendationRules(): RecommendationRule[]`**
   - Returns all built-in recommendation rules.
   - Returns a new array (not the internal reference).

2. **`recommendForProfile(profile: ProjectProfile, existingDeps: string[]): DependencyRecommendation[]`**
   - Iterates over all rules.
   - For each rule where `condition(profile)` returns `true`:
     - Checks if `recommendation.packageName` is already in `existingDeps`.
     - If not already installed, creates a `DependencyRecommendation` with a generated UUID for `id`.
   - Returns all applicable, non-duplicate recommendations.

3. **`checkConflicts(recommendations: DependencyRecommendation[], existingDeps: string[]): Array<{ recommendation: string; conflictsWith: string }>`**
   - For each recommendation, checks if any of its `conflictsWith` packages are in `existingDeps` or in other recommendations.
   - Returns an array of conflict pairs. Empty if no conflicts.

4. **`suggestDevTools(profile: ProjectProfile, existingDeps: string[]): DependencyRecommendation[]`**
   - Convenience method: filters `recommendForProfile()` results to only return dev tools — packages where `isDev === true` and category is `'build'` or `'testing'`.
   - Useful for showing "dev tools you might want" separately from production dependencies.

5. **`rankRecommendations(recommendations: DependencyRecommendation[]): DependencyRecommendation[]`**
   - Sorts by priority: `essential` first, then `recommended`, then `nice-to-have`.
   - Within the same priority, maintains original order.
   - Returns a new sorted array.

6. **`generateReport(projectId: string, profile: ProjectProfile, existingDeps: string[]): RecommendationReport`**
   - Full pipeline:
     1. `recommendForProfile(profile, existingDeps)` → get recommendations.
     2. `rankRecommendations(recommendations)` → sort.
     3. Count by priority.
     4. Identify already-installed packages (packages that matched a rule's condition but were filtered because they're in `existingDeps`).
   - Returns `RecommendationReport` with:
     - `reportId`: generated UUID.
     - `projectId`: passed in.
     - `generatedAt`: current ISO 8601 timestamp.
     - `recommendations`: ranked list.
     - `essentialCount`, `recommendedCount`, `niceToHaveCount`: counts.
     - `alreadyInstalled`: list of package names that were already installed.

### Required Tests (minimum 18)

Write these in `src/init/dependency-recommender.test.ts`:

1. **Returns at least 8 recommendation rules** — verify `getRecommendationRules().length >= 8`.
2. **Recommends vitest when no testing framework** — profile with `hasTests: false`, verify vitest recommended.
3. **Does not recommend vitest when tests exist** — profile with `hasTests: true`, verify vitest not recommended.
4. **Vitest recommendation is essential priority** — verify priority field.
5. **Recommends eslint when no linter** — verify eslint recommended.
6. **Recommends prettier when no formatter** — verify prettier recommended.
7. **Recommends @testing-library/react for React projects** — profile with React framework, verify recommended.
8. **Recommends zod for API server** — profile with projectType `'api-server'`, verify zod recommended.
9. **Filters already-installed packages** — existingDeps includes `'vitest'`, verify not recommended again.
10. **Detects conflict between vitest and jest** — vitest recommended + jest in existingDeps, verify conflict returned.
11. **No conflicts when no overlaps** — verify empty conflicts array.
12. **Ranks essential before recommended** — verify sort order.
13. **Ranks recommended before nice-to-have** — verify sort order.
14. **suggestDevTools returns only dev tools** — verify all returned packages have `isDev: true`.
15. **suggestDevTools filters by category** — verify only `'build'` or `'testing'` categories.
16. **Generates report with correct counts** — verify essentialCount, recommendedCount, niceToHaveCount.
17. **Report includes already-installed packages** — verify `alreadyInstalled` array populated.
18. **Report has generated UUID and timestamp** — verify reportId is string and generatedAt is ISO format.
19. **Recommends @types/node for TypeScript projects** — verify recommendation.
20. **Does not recommend @types/node for JavaScript projects** — profile with `primaryLanguage: 'javascript'`, verify not recommended.

---

## KIMI-INIT-04: Configuration Wizard

### Files to Create

- `src/init/config-wizard.ts`
- `src/init/config-wizard.test.ts`

### Purpose

An interactive configuration wizard that guides users through project setup decisions step by step, producing a complete Nova26 configuration optimized for their project. The wizard supports conditional steps (show a step only if a previous answer meets a condition), back navigation, and generates a comprehensive `.nova/config.json` from the collected answers. It can optionally take a `ProjectProfile` to pre-fill defaults intelligently.

### Interfaces to Implement

All interfaces must be exported from `src/init/config-wizard.ts`:

```typescript
import type { ProjectProfile } from './framework-detector.js';
import type { ProjectType } from './template-system.js';

export type StepType = 'select' | 'confirm' | 'text' | 'multi-select';

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  type: StepType;
  options?: Array<{ label: string; value: string; description?: string }>;
  defaultValue?: string;
  required: boolean;
  dependsOn?: { stepId: string; value: string }; // only show if previous step has this value
}

export interface WizardState {
  currentStepIndex: number;
  totalSteps: number;
  answers: Record<string, string>;
  completedSteps: string[];
  startedAt: string;
}

export interface WizardResult {
  wizardId: string;
  completedAt: string;
  answers: Record<string, string>;
  generatedConfig: Record<string, unknown>; // .nova/config.json content
  templateType?: ProjectType;
  recommendedDeps: string[];
  summary: string;                 // human-readable summary of choices
}
```

### Class to Implement

```typescript
export class ConfigWizard {
  constructor();
}
```

The constructor does not take parameters. Steps are generated dynamically based on the optional `ProjectProfile` passed to `getSteps()`.

### Built-in Steps

The wizard defines the following steps (in order). Steps with `dependsOn` are conditionally shown.

1. **project-type** (select, required)
   - Title: `'Project Type'`
   - Description: `'What type of project are you building?'`
   - Options: `[{ label: 'React App', value: 'react-app' }, { label: 'Next.js App', value: 'next-app' }, { label: 'API Server', value: 'api-server' }, { label: 'CLI Tool', value: 'cli-tool' }, { label: 'Full-Stack', value: 'full-stack' }, { label: 'Library', value: 'library' }, { label: 'Monorepo', value: 'monorepo' }]`
   - If a `ProjectProfile` is provided to `getSteps()`, the `defaultValue` should be set to `profile.projectType`.

2. **tier-selection** (select, required)
   - Title: `'Tier Selection'`
   - Description: `'Which LLM tier would you like to use?'`
   - Options: `[{ label: 'Free (Ollama only)', value: 'free', description: 'Uses local models via Ollama' }, { label: 'Paid (Cloud APIs)', value: 'paid', description: 'Uses OpenAI, Anthropic, etc.' }, { label: 'Hybrid', value: 'hybrid', description: 'Local models + cloud fallback' }]`
   - Default: `'free'`.

3. **model-preference** (select, required)
   - Title: `'Model Preference'`
   - Description: `'Which model size do you prefer for local inference?'`
   - Options: `[{ label: 'Small (1-3B)', value: 'small', description: 'Fastest, lowest resource usage' }, { label: 'Medium (7B)', value: 'medium', description: 'Good balance of speed and quality' }, { label: 'Large (13B+)', value: 'large', description: 'Best quality, requires more RAM' }]`
   - Default: `'medium'`.
   - `dependsOn`: `{ stepId: 'tier-selection', value: 'free' }` — only show if tier is free.

4. **autonomy-level** (select, required)
   - Title: `'Autonomy Level'`
   - Description: `'How much autonomy should agents have?'`
   - Options: `[{ label: 'Level 1 - Suggest Only', value: '1' }, { label: 'Level 2 - Auto-apply safe changes', value: '2' }, { label: 'Level 3 - Auto-apply with review', value: '3' }, { label: 'Level 4 - Full auto (with gates)', value: '4' }, { label: 'Level 5 - Unrestricted', value: '5' }]`
   - Default: `'3'`.

5. **testing-strategy** (select, required)
   - Title: `'Testing Strategy'`
   - Description: `'How should Nova26 handle testing?'`
   - Options: `[{ label: 'Test-first', value: 'test-first', description: 'Generate tests before implementation' }, { label: 'Test-after', value: 'test-after', description: 'Generate tests after implementation' }, { label: 'Test-with', value: 'test-with', description: 'Generate tests alongside implementation' }, { label: 'Manual', value: 'manual', description: 'No automatic test generation' }]`
   - Default: `'test-with'`.

6. **git-workflow** (select, required)
   - Title: `'Git Workflow'`
   - Description: `'How should Nova26 manage git?'`
   - Options: `[{ label: 'Auto branch + commit + PR', value: 'full-auto', description: 'Nova26 manages branches, commits, and PRs' }, { label: 'Auto commit only', value: 'auto-commit', description: 'Nova26 commits but you manage branches' }, { label: 'Manual', value: 'manual', description: 'You manage all git operations' }]`
   - Default: `'auto-commit'`.

### Functions (all instance methods on `ConfigWizard`)

1. **`getSteps(projectProfile?: ProjectProfile): WizardStep[]`**
   - Returns the ordered list of wizard steps.
   - If `projectProfile` is provided, sets intelligent defaults:
     - `project-type` default → `profile.projectType`.
   - Returns a new array each time.

2. **`createState(): WizardState`**
   - Returns a fresh `WizardState`:
     - `currentStepIndex`: `0`.
     - `totalSteps`: number of steps from `getSteps()`.
     - `answers`: `{}`.
     - `completedSteps`: `[]`.
     - `startedAt`: current ISO 8601 timestamp.

3. **`getCurrentStep(state: WizardState): WizardStep | undefined`**
   - Returns the step at `state.currentStepIndex`.
   - Returns `undefined` if `currentStepIndex >= totalSteps`.

4. **`processAnswer(state: WizardState, stepId: string, value: string): WizardState`**
   - Records the answer: `state.answers[stepId] = value`.
   - Adds `stepId` to `completedSteps` if not already present.
   - Advances `currentStepIndex` to the next **visible** step (skipping steps whose `dependsOn` condition is not met).
   - Returns a **new** `WizardState` object (immutable update).

5. **`previousStep(state: WizardState): WizardState`**
   - Decrements `currentStepIndex` by 1, but not below 0.
   - Skips backward over non-visible steps.
   - Returns a **new** `WizardState` object.

6. **`shouldShowStep(step: WizardStep, state: WizardState): boolean`**
   - If `step.dependsOn` is undefined → `true`.
   - If `step.dependsOn` is defined → checks `state.answers[step.dependsOn.stepId] === step.dependsOn.value`.
   - Returns `true` if the condition is met, `false` otherwise.

7. **`isComplete(state: WizardState): boolean`**
   - Returns `true` if all required visible steps have answers in `state.answers`.
   - A step is "visible" if `shouldShowStep()` returns true.

8. **`generateConfig(state: WizardState): Record<string, unknown>`**
   - Builds a `.nova/config.json` object from `state.answers`:
     - `models.tier` ← `answers['tier-selection']`.
     - `models.preference` ← `answers['model-preference']` (if present).
     - `autonomy.level` ← `parseInt(answers['autonomy-level'])`.
     - `testing.strategy` ← `answers['testing-strategy']`.
     - `git.workflow` ← `answers['git-workflow']`.
     - `project.type` ← `answers['project-type']`.
   - Returns the config object.

9. **`complete(state: WizardState): WizardResult`**
   - Calls `generateConfig(state)` to build the config.
   - Generates a human-readable `summary` string from the answers, e.g.:
     ```
     Project Type: React App
     Tier: Free (Ollama only)
     Model: Medium (7B)
     Autonomy: Level 3
     Testing: Test-with
     Git: Auto commit only
     ```
   - Sets `templateType` from `answers['project-type']` (cast to `ProjectType`).
   - Sets `recommendedDeps` to `[]` (to be populated by the integration layer).
   - Returns `WizardResult` with generated UUID for `wizardId` and `completedAt` set to now.

### Required Tests (minimum 18)

Write these in `src/init/config-wizard.test.ts`:

1. **getSteps returns at least 6 steps** — verify `getSteps().length >= 6`.
2. **Steps include project-type** — verify a step with `id: 'project-type'` exists.
3. **Steps include tier-selection** — verify a step with `id: 'tier-selection'` exists.
4. **Steps include autonomy-level** — verify.
5. **createState returns initial state** — verify `currentStepIndex === 0`, empty answers, empty completedSteps.
6. **getCurrentStep returns first step** — verify returns step at index 0.
7. **getCurrentStep returns undefined when past end** — set index past totalSteps, verify undefined.
8. **processAnswer records answer** — process 'project-type' → 'react-app', verify in answers.
9. **processAnswer advances step index** — verify currentStepIndex incremented.
10. **processAnswer adds to completedSteps** — verify stepId in completedSteps.
11. **previousStep decrements index** — advance twice, go back once, verify index.
12. **previousStep does not go below 0** — at index 0, go back, verify still 0.
13. **shouldShowStep returns true when no dependsOn** — step without dependsOn, verify true.
14. **shouldShowStep returns true when condition met** — model-preference depends on tier=free, set tier=free, verify true.
15. **shouldShowStep returns false when condition not met** — set tier=paid, verify model-preference step returns false.
16. **isComplete when all required steps answered** — answer all required visible steps, verify true.
17. **isComplete false when required step missing** — leave one unanswered, verify false.
18. **generateConfig builds correct structure** — answer all steps, verify config has models.tier, autonomy.level, etc.
19. **complete returns WizardResult** — verify wizardId, completedAt, answers, generatedConfig, summary present.
20. **complete summary is human-readable** — verify summary contains key labels like 'Project Type' and 'Tier'.
21. **getSteps with ProjectProfile sets defaults** — pass profile with projectType 'api-server', verify default set.
22. **processAnswer skips hidden steps** — tier=paid, verify model-preference step skipped during advance.

---

## KIMI-INIT-05: Integration & Wiring

### Files to Modify

- `src/orchestrator/ralph-loop.ts` — **ADD** two new fields to `RalphLoopOptions` + 1 import

### Files to Create

- `src/init/init-index.ts`
- `src/init/init-index.test.ts`

### Purpose

Wire the advanced init system into the Ralph Loop. Add `advancedInitEnabled` and `advancedInitConfig` to `RalphLoopOptions`. Create the barrel export for the advanced init module. Write integration tests that verify the full pipeline: detect frameworks → recommend dependencies → generate template → run wizard.

### Modification to `src/orchestrator/ralph-loop.ts`

Add these two lines to the `RalphLoopOptions` interface, **after** the agent memory fields (after `memoryConfig`):

```typescript
  // Advanced Init (R17-02)
  advancedInitEnabled?: boolean;
  advancedInitConfig?: AdvancedInitConfig;
```

Add the import at the top of the file (after the existing type imports):

```typescript
import type { AdvancedInitConfig } from '../init/init-index.js';
```

**That is the ONLY change to ralph-loop.ts.** Do not modify any functions.

### Barrel Export: `src/init/init-index.ts`

Create a barrel export that re-exports from all new init modules:

```typescript
// Advanced Project Initialization (R17-02)
// Barrel export for the advanced init system

export * from './template-system.js';
export * from './framework-detector.js';
export * from './dependency-recommender.js';
export * from './config-wizard.js';

export interface AdvancedInitConfig {
  templateSystemEnabled: boolean;    // default: true
  frameworkDetectionEnabled: boolean; // default: true
  dependencyRecommendationsEnabled: boolean; // default: true
  configWizardEnabled: boolean;      // default: true
  autoDetectOnInit: boolean;         // default: true
}
```

**Do not re-export from `src/cli/init.ts`** — that module has its own existing import patterns.

### Integration Tests: `src/init/init-index.test.ts`

### Required Tests (minimum 16)

1. **Barrel export exposes TemplateSystem** — import TemplateSystem from init-index, verify defined.
2. **Barrel export exposes FrameworkDetector** — import FrameworkDetector from init-index, verify defined.
3. **Barrel export exposes DependencyRecommender** — import DependencyRecommender from init-index, verify defined.
4. **Barrel export exposes ConfigWizard** — import ConfigWizard from init-index, verify defined.
5. **Barrel export exposes AdvancedInitConfig type** — verify type is importable (create a typed variable).
6. **Full pipeline: detect frameworks then recommend deps** — detect React from package.json, pass profile to recommender, verify recommendations returned.
7. **Full pipeline: detect then recommend skips installed** — detect vitest, pass as existingDeps, verify not re-recommended.
8. **Full pipeline: framework detection feeds wizard defaults** — detect profile, pass to wizard getSteps, verify defaults set.
9. **Full pipeline: template renders for detected project type** — detect api-server, get template for that type, render, verify result.
10. **Full pipeline: wizard generates config that includes project type** — answer all steps, verify config has project.type.
11. **Full pipeline: recommendation report for detected profile** — build profile → generate report, verify report structure.
12. **AdvancedInitConfig default values are assignable** — create config with all defaults true, verify type compatibility.
13. **Template system and framework detector project types align** — verify ProjectType used by both modules is the same type.
14. **Wizard complete result includes template type** — complete wizard with project-type answer, verify templateType set.
15. **Dependency recommendations rank correctly in pipeline** — generate recommendations from profile, verify essential first.
16. **Config wizard skips model-preference for paid tier** — set tier to paid, verify model-preference step not shown.
17. **Full pipeline: end-to-end from package.json to wizard result** — parse package.json → detect → recommend → wizard → complete, verify WizardResult.

---

## Final Checklist

After completing all 5 tasks, verify:

```bash
npx tsc --noEmit        # 0 errors
npx vitest run           # 2081+ tests (target: 90+ new = 2171+)
```

New files created (10):
- `src/init/template-system.ts`
- `src/init/template-system.test.ts`
- `src/init/framework-detector.ts`
- `src/init/framework-detector.test.ts`
- `src/init/dependency-recommender.ts`
- `src/init/dependency-recommender.test.ts`
- `src/init/config-wizard.ts`
- `src/init/config-wizard.test.ts`
- `src/init/init-index.ts`
- `src/init/init-index.test.ts`

Modified files (1):
- `src/orchestrator/ralph-loop.ts` (2 new fields + 1 import only)

Test count target: 90+ new tests across 5 test files:
- `template-system.test.ts`: 22 tests
- `framework-detector.test.ts`: 22 tests
- `dependency-recommender.test.ts`: 20 tests
- `config-wizard.test.ts`: 22 tests
- `init-index.test.ts`: 17 tests
- **Total: 103 new tests → 2184+ total**
