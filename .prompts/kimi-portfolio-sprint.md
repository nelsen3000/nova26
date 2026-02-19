# KIMI-PORTFOLIO Sprint: Cross-Project Intelligence & Portfolio Learning (R16-01)

> Assigned to: Kimi
> Sprint: Portfolio (post-Visionary)
> Date issued: 2026-02-18
> Prerequisite: KIMI-VISIONARY complete (1719 tests, 0 TS errors)

## Project Context

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama (local LLM), Convex, and vitest. Agents are named after celestial bodies: MARS, VENUS, MERCURY, JUPITER, SATURN, PLUTO, ATLAS, etc.

**Key systems you should be aware of (do not modify unless told):**

- Core execution: Ralph Loop (`src/orchestrator/ralph-loop.ts`)
- Taste Vault: `src/taste-vault/`
- ACE playbooks: `src/ace/`
- Rehearsal Stage: `src/rehearsal/`
- Agent Memory: `src/agents/`
- Personality Engine: `src/agents/personality-engine.ts`
- Offline Engine: `src/sync/offline-engine.ts`
- Semantic Search: `src/tools/semantic-search.ts`
- ATLAS: `src/atlas/`
- Dream Engine: `src/dream/`
- Parallel Universe: `src/universe/`
- Overnight Evolution: `src/evolution/`
- Nova Symbiont: `src/symbiont/`
- Taste Room: `src/taste-room/`

**Current state:** 1719 tests passing, 0 TypeScript errors.

---

## Rules

- TypeScript strict mode. No `any` types.
- ESM imports with `.js` extensions (e.g., `import { Foo } from './foo.js';`).
- Every new `.ts` source file gets a companion `.test.ts` file in the same directory.
- Tests use vitest (`import { describe, it, expect, vi, beforeEach } from 'vitest';`).
- Mock Ollama calls — **never** make real LLM calls in tests. Use `vi.fn()` or `vi.mock()`.
- Do **not** modify existing source files unless explicitly told to extend them.
- Run `npx tsc --noEmit` and `npx vitest run` after each task. Zero errors, zero failures.
- Target: 1719+ tests passing at end of sprint (aim for 90+ new tests).
- Use `zod` for runtime validation of configs and inputs where appropriate.
- Use `better-sqlite3` for any local persistence (consistent with existing codebase).
- All IDs should be generated with `crypto.randomUUID()`.
- All timestamps should be ISO 8601 strings (`new Date().toISOString()`).

---

## KIMI-PORTFOLIO-01: Portfolio Manifest & Project Fingerprinting

### Files to Create

- `src/portfolio/portfolio-manifest.ts`
- `src/portfolio/portfolio-manifest.test.ts`

### Purpose

Nova26 tracks every project a developer has ever worked on in a local-first portfolio manifest at `~/.nova/portfolio.json`. This is user-level, not project-level. The manifest stores metadata, ACE score history, pattern counts, and a semantic fingerprint (vector embedding) for each project. The fingerprint captures the project's architectural shape — not its code verbatim — computed locally via Ollama embeddings.

### Interfaces to Implement

All interfaces must be exported from `src/portfolio/portfolio-manifest.ts`:

```typescript
export interface PortfolioConfig {
  manifestPath: string;                // default: '~/.nova/portfolio.json'
  similarityThreshold: number;         // default: 0.70
  patternPromotionMinProjects: number; // default: 3
  patternPromotionSimilarityMin: number; // default: 0.80
  recencyWeights: {
    within90Days: number;              // default: 1.0
    within1Year: number;              // default: 0.8
    beyond1Year: number;              // default: 0.6
  };
  crossProjectSuggestionsEnabled: boolean; // default: true
  globalWisdomOptIn: boolean;          // default: false
}

export interface Portfolio {
  version: string;                     // e.g. '1.0.0'
  userId: string;                      // local machine identifier (not user account)
  createdAt: string;
  updatedAt: string;
  projects: PortfolioProject[];
  portfolioPatterns: PortfolioPattern[];
  skillGrowthHistory: SkillGrowthRecord[];
}

export interface PortfolioProject {
  id: string;
  name: string;
  path: string;
  type: 'dashboard' | 'api' | 'cli' | 'mobile' | 'full-stack' | 'library' | 'other';
  primaryLanguage: string;
  framework?: string;
  firstBuildAt: string;
  lastBuildAt: string;
  totalBuilds: number;
  aceScoreHistory: Array<{ date: string; score: number }>;
  currentHealthScore?: number;
  patternCount: number;
  semanticFingerprint: number[];       // embedding vector from Ollama
  isPrivate: boolean;
  isArchived: boolean;
  tags: string[];
}

export type PatternScope = 'project' | 'portfolio' | 'global';

export interface PortfolioPattern {
  id: string;
  scope: PatternScope;
  name: string;
  description: string;
  sourceProjectIds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  averageQualityScore: number;         // 0-100
  isAntiPattern: boolean;
  lineage?: PatternLineage;
}

export interface PatternLineage {
  patternId: string;
  versions: Array<{
    projectId: string;
    projectName: string;
    builtAt: string;
    qualityScore: number;
    changeDescription: string;
  }>;
  bestVersionProjectId: string;
}

export interface SkillGrowthRecord {
  date: string;
  dimension: 'test-coverage' | 'complexity' | 'security' | 'ace-score' | 'build-speed';
  rollingAverage5Projects: number;
  allTimeAverage: number;
  trend: 'improving' | 'stable' | 'declining';
}
```

### Class to Implement

Export a class named `PortfolioManifest`:

```typescript
export class PortfolioManifest {
  constructor(config?: Partial<PortfolioConfig>);
}
```

The constructor should merge provided config with defaults:

```typescript
const DEFAULT_CONFIG: PortfolioConfig = {
  manifestPath: '~/.nova/portfolio.json',
  similarityThreshold: 0.70,
  patternPromotionMinProjects: 3,
  patternPromotionSimilarityMin: 0.80,
  recencyWeights: {
    within90Days: 1.0,
    within1Year: 0.8,
    beyond1Year: 0.6,
  },
  crossProjectSuggestionsEnabled: true,
  globalWisdomOptIn: false,
};
```

### Functions (all instance methods on `PortfolioManifest`)

1. **`load(): Portfolio`**
   - Reads the manifest JSON from `manifestPath`.
   - If the file does not exist, returns a new empty `Portfolio` with `version: '1.0.0'`, a machine-generated `userId` (use `crypto.randomUUID()`), current timestamp, and empty arrays.
   - Validates the loaded JSON with zod. If validation fails, logs a warning and returns the empty portfolio.

2. **`save(portfolio: Portfolio): void`**
   - Writes the portfolio to `manifestPath` as formatted JSON.
   - Creates parent directories if they don't exist (`fs.mkdirSync` with `recursive: true`).
   - Updates `updatedAt` to current timestamp before writing.

3. **`addProject(project: Omit<PortfolioProject, 'id' | 'firstBuildAt' | 'lastBuildAt' | 'totalBuilds' | 'aceScoreHistory' | 'patternCount' | 'semanticFingerprint' | 'isArchived' | 'tags'>): PortfolioProject`**
   - Creates a new project entry with generated ID, timestamps, `totalBuilds: 0`, empty arrays for `aceScoreHistory` and `tags`, `patternCount: 0`, empty `semanticFingerprint`, `isArchived: false`.
   - Adds to the portfolio's projects array.
   - Auto-saves the manifest.
   - Returns the created project.

4. **`updateProjectAfterBuild(projectId: string, aceScore: number, patternCount: number): PortfolioProject`**
   - Finds the project by ID (throw if not found).
   - Increments `totalBuilds`.
   - Updates `lastBuildAt` to current timestamp.
   - Appends `{ date: now, score: aceScore }` to `aceScoreHistory`.
   - Updates `patternCount`.
   - Auto-saves.
   - Returns the updated project.

5. **`computeFingerprint(projectId: string, projectSummary: string): Promise<PortfolioProject>`**
   - Finds the project by ID (throw if not found).
   - `projectSummary` is a structured text summary of the project (max 2000 tokens), prepared by the caller.
   - Calls Ollama embedding API to produce a vector (mock in tests). Store as `semanticFingerprint`.
   - Auto-saves.
   - Returns the updated project.

6. **`getProject(projectId: string): PortfolioProject | undefined`**
   - Returns the project or `undefined`.

7. **`listProjects(filter?: { archived?: boolean; private?: boolean; type?: PortfolioProject['type'] }): PortfolioProject[]`**
   - Returns projects matching the filter. If no filter, returns all non-archived projects.

8. **`archiveProject(projectId: string): PortfolioProject`**
   - Sets `isArchived: true`. Auto-saves. Returns updated project.

9. **`setProjectPrivacy(projectId: string, isPrivate: boolean): PortfolioProject`**
   - Sets `isPrivate`. Auto-saves. Returns updated project.

10. **`getRecencyWeight(lastBuildAt: string): number`**
    - Computes the recency weight based on the configured thresholds:
      - Built within 90 days → `recencyWeights.within90Days`
      - Built 90-365 days ago → `recencyWeights.within1Year`
      - Built over 1 year ago → `recencyWeights.beyond1Year`

### Required Tests (minimum 20)

Write these in `src/portfolio/portfolio-manifest.test.ts`:

1. **Creates empty portfolio when manifest doesn't exist** — `load()` returns a valid empty portfolio.
2. **Saves and loads portfolio round-trip** — save a portfolio, load it, verify contents match.
3. **Creates parent directories on save** — save to a nested path, verify it works.
4. **Adds a project** — call `addProject`, verify ID is generated, timestamps set, `totalBuilds: 0`.
5. **Updates project after build** — call `updateProjectAfterBuild`, verify `totalBuilds` incremented, score appended.
6. **Throws when updating non-existent project** — call `updateProjectAfterBuild` with fake ID, expect error.
7. **Computes fingerprint via Ollama embedding** — mock Ollama, call `computeFingerprint`, verify `semanticFingerprint` is set.
8. **Gets project by ID** — add a project, get it by ID, verify match.
9. **Returns undefined for non-existent project** — `getProject('fake')` returns `undefined`.
10. **Lists all non-archived projects by default** — add 3 projects, archive 1, list without filter, verify 2 returned.
11. **Filters projects by type** — add projects with different types, filter by `'dashboard'`, verify only dashboards returned.
12. **Filters projects by privacy** — add private and non-private projects, filter by `private: true`.
13. **Archives a project** — call `archiveProject`, verify `isArchived: true`.
14. **Sets project privacy** — call `setProjectPrivacy(id, true)`, verify `isPrivate: true`.
15. **Computes recency weight for recent project** — project built yesterday → weight `1.0`.
16. **Computes recency weight for 6-month-old project** — weight `0.8`.
17. **Computes recency weight for 2-year-old project** — weight `0.6`.
18. **Auto-saves after addProject** — add a project, create new manifest instance with same path, load, verify project exists.
19. **Validates manifest JSON on load** — write invalid JSON to manifest path, load, expect empty portfolio (not crash).
20. **Handles multiple ACE score entries** — update same project 5 times with different scores, verify all 5 entries in `aceScoreHistory`.

---

## KIMI-PORTFOLIO-02: Similarity Detection & Cross-Project Suggestions

### Files to Create

- `src/portfolio/similarity-engine.ts`
- `src/portfolio/similarity-engine.test.ts`

### Purpose

When a developer starts a new project or reviews code, Nova26 queries the portfolio for similar past projects. If a similar function in Project B scored higher on quality metrics, Nova26 surfaces a cross-project suggestion: "You solved this better in Project B. Want to see the diff?" Similarity is computed using cosine similarity of semantic fingerprints, weighted by recency.

### Interfaces to Implement

All interfaces must be exported from `src/portfolio/similarity-engine.ts`:

```typescript
export interface ProjectSimilarity {
  sourceProjectId: string;
  targetProjectId: string;
  similarityScore: number;             // 0-1 cosine similarity
  recencyWeightedScore: number;        // similarity * recency weight
  architecturalOverlap: string[];      // shared patterns/approaches
  computedAt: string;
}

export interface CrossProjectInsight {
  id: string;
  type: 'better-pattern' | 'anti-pattern' | 'new-project-match' | 'skill-growth';
  sourceProjectId: string;
  targetProjectId?: string;
  title: string;
  description: string;
  qualityDelta?: number;               // signed; positive = source is better
  actionAvailable: boolean;
  actionDescription?: string;
  generatedAt: string;
  status: 'pending' | 'accepted' | 'rejected' | 'dismissed';
}

export interface CrossProjectSuggestion {
  insightId: string;
  sourceProject: string;
  sourceFile: string;
  targetProject: string;
  targetFile: string;
  qualityDelta: number;
  explanation: string;
  adaptedDiff?: string;
  adaptationStatus: 'not-started' | 'running' | 'ready' | 'failed';
}

export interface SimilarityEngineConfig {
  similarityThreshold: number;         // default: 0.70 — minimum to surface
  qualityDeltaThreshold: number;       // default: 15 — minimum quality gap to suggest
  maxSuggestions: number;              // default: 10
  excludePrivateProjects: boolean;     // default: true
}
```

### Class to Implement

```typescript
export class SimilarityEngine {
  constructor(config?: Partial<SimilarityEngineConfig>);
}
```

Default config:

```typescript
const DEFAULT_CONFIG: SimilarityEngineConfig = {
  similarityThreshold: 0.70,
  qualityDeltaThreshold: 15,
  maxSuggestions: 10,
  excludePrivateProjects: true,
};
```

### Functions (all instance methods on `SimilarityEngine`)

1. **`cosineSimilarity(a: number[], b: number[]): number`**
   - Computes cosine similarity between two vectors.
   - Returns 0 if either vector is empty or all zeros.
   - Returns a value between -1 and 1 (in practice, fingerprint vectors should always yield 0 to 1).

2. **`findSimilarProjects(targetProject: PortfolioProject, allProjects: PortfolioProject[], recencyWeightFn: (lastBuildAt: string) => number): ProjectSimilarity[]`**
   - Computes cosine similarity between `targetProject.semanticFingerprint` and every other project's fingerprint.
   - Applies recency weight via `recencyWeightFn` to get `recencyWeightedScore`.
   - Excludes projects where `isPrivate: true` (if `excludePrivateProjects` is set).
   - Excludes projects where `isArchived: true`.
   - Excludes the target project itself.
   - Filters to only results above `similarityThreshold`.
   - Sorts by `recencyWeightedScore` descending.
   - Returns the list of `ProjectSimilarity` objects.

3. **`classifySimilarity(score: number): 'architecturally-similar' | 'very-similar' | 'essentially-same' | 'below-threshold'`**
   - 0.70-0.80 → `'architecturally-similar'`
   - 0.80-0.90 → `'very-similar'`
   - 0.90+ → `'essentially-same'`
   - Below 0.70 → `'below-threshold'`

4. **`generateInsight(sourceProject: PortfolioProject, targetProject: PortfolioProject, similarity: ProjectSimilarity): CrossProjectInsight`**
   - Creates a `CrossProjectInsight` of type `'new-project-match'`.
   - Title: `"Similar to ${sourceProject.name}"`.
   - Description includes the similarity classification and any architectural overlap.
   - `actionAvailable: true` with description `"Pre-load patterns from ${sourceProject.name}"`.
   - `status: 'pending'`.

5. **`generateBetterPatternInsight(sourceProject: PortfolioProject, targetProject: PortfolioProject, sourceScore: number, targetScore: number, patternName: string): CrossProjectInsight`**
   - Creates a `CrossProjectInsight` of type `'better-pattern'`.
   - Only generated when `sourceScore - targetScore >= qualityDeltaThreshold`.
   - Title: `"Better '${patternName}' in ${sourceProject.name}"`.
   - `qualityDelta`: `sourceScore - targetScore`.
   - `actionAvailable: true` with description about applying the better version.
   - Returns the insight, or `null` if quality delta is below threshold.

6. **`createSuggestion(insight: CrossProjectInsight, sourceFile: string, targetFile: string, explanation: string): CrossProjectSuggestion`**
   - Creates a `CrossProjectSuggestion` linked to the insight.
   - `adaptationStatus: 'not-started'`.

7. **`acceptInsight(insight: CrossProjectInsight): CrossProjectInsight`**
   - Sets `status: 'accepted'`. Returns updated insight.

8. **`dismissInsight(insight: CrossProjectInsight): CrossProjectInsight`**
   - Sets `status: 'dismissed'`. Returns updated insight.

### Required Tests (minimum 20)

Write these in `src/portfolio/similarity-engine.test.ts`:

1. **Cosine similarity of identical vectors returns 1** — `[1,0,1]` vs `[1,0,1]` → `1.0`.
2. **Cosine similarity of orthogonal vectors returns 0** — `[1,0,0]` vs `[0,1,0]` → `0.0`.
3. **Cosine similarity of opposite vectors returns -1** — `[1,0]` vs `[-1,0]` → `-1.0`.
4. **Cosine similarity of empty vectors returns 0** — `[]` vs `[]` → `0`.
5. **Cosine similarity of zero vectors returns 0** — `[0,0,0]` vs `[0,0,0]` → `0`.
6. **Finds similar projects above threshold** — create 3 projects with known fingerprints, verify similar ones returned.
7. **Excludes private projects** — mark a similar project as private, verify it is excluded.
8. **Excludes archived projects** — mark a similar project as archived, verify excluded.
9. **Excludes the target project itself** — verify the target doesn't appear in its own similarity results.
10. **Sorts by recency-weighted score descending** — create projects with different recency weights, verify sort order.
11. **Filters below threshold** — create a project with low similarity, verify it's excluded.
12. **Classifies 0.75 as architecturally-similar** — verify classification.
13. **Classifies 0.85 as very-similar** — verify classification.
14. **Classifies 0.95 as essentially-same** — verify classification.
15. **Classifies 0.50 as below-threshold** — verify classification.
16. **Generates new-project-match insight** — verify title, description, type, status.
17. **Generates better-pattern insight when delta meets threshold** — 90 vs 70, delta=20 ≥ 15.
18. **Returns null for better-pattern when delta below threshold** — 80 vs 70, delta=10 < 15.
19. **Creates suggestion linked to insight** — verify `insightId` matches, `adaptationStatus` is `'not-started'`.
20. **Accepts an insight** — verify status changes to `'accepted'`.
21. **Dismisses an insight** — verify status changes to `'dismissed'`.

---

## KIMI-PORTFOLIO-03: Pattern Detection & Portfolio Analytics

### Files to Create

- `src/portfolio/pattern-detection.ts`
- `src/portfolio/pattern-detection.test.ts`

### Purpose

Nova26 detects patterns that recur across multiple projects (personal idioms), tracks how patterns evolve over time (lineage), and identifies anti-patterns correlated with low quality scores. It also computes skill growth metrics showing the developer is improving over time. This transforms the portfolio from a passive record into an active learning system.

### Interfaces to Implement

All interfaces must be exported from `src/portfolio/pattern-detection.ts`:

```typescript
export interface PatternCandidate {
  name: string;
  description: string;
  projectIds: string[];                // projects where this pattern appears
  qualityScores: number[];             // per-project quality scores
  structuralHash: string;             // hash of normalized pattern for dedup
}

export interface PatternPromotionResult {
  promoted: PortfolioPattern[];        // patterns promoted to portfolio scope
  antiPatterns: PortfolioPattern[];    // patterns flagged as anti-patterns
  skipped: PatternCandidate[];         // patterns below threshold
}

export interface SkillGrowthAnalysis {
  dimensions: SkillGrowthRecord[];
  summary: string;                     // human-readable summary
  overallTrend: 'improving' | 'stable' | 'declining';
}

export interface PatternDetectionConfig {
  minProjectsForPromotion: number;     // default: 3
  minSimilarityForMatch: number;       // default: 0.80
  antiPatternQualityThreshold: number; // default: 40 — below this = anti-pattern candidate
  antiPatternMinOccurrences: number;   // default: 3
  skillWindowSize: number;             // default: 5 — rolling window for skill growth
}
```

Import `PortfolioPattern`, `PatternLineage`, `PatternScope`, `SkillGrowthRecord`, and `PortfolioProject` from `./portfolio-manifest.js`.

### Class to Implement

```typescript
export class PatternDetector {
  constructor(config?: Partial<PatternDetectionConfig>);
}
```

Default config:

```typescript
const DEFAULT_CONFIG: PatternDetectionConfig = {
  minProjectsForPromotion: 3,
  minSimilarityForMatch: 0.80,
  antiPatternQualityThreshold: 40,
  antiPatternMinOccurrences: 3,
  skillWindowSize: 5,
};
```

### Functions (all instance methods on `PatternDetector`)

1. **`detectCandidates(projects: PortfolioProject[], patternExtractor: (projectId: string) => PatternCandidate[]): PatternCandidate[]`**
   - Calls `patternExtractor` for each non-archived, non-private project to get pattern candidates.
   - Groups candidates by `structuralHash`.
   - Returns candidates that appear in 2+ projects (potential portfolio patterns).

2. **`promotePatterns(candidates: PatternCandidate[]): PatternPromotionResult`**
   - For each candidate appearing in `>= minProjectsForPromotion` projects:
     - If average quality score >= `antiPatternQualityThreshold`: promote to `PortfolioPattern` with `scope: 'portfolio'`, `isAntiPattern: false`.
     - If average quality score < `antiPatternQualityThreshold` AND appears in >= `antiPatternMinOccurrences` projects: flag as anti-pattern (`isAntiPattern: true`).
   - Candidates below the project count threshold go into `skipped`.
   - Returns the `PatternPromotionResult`.

3. **`buildLineage(pattern: PortfolioPattern, projectDetails: Array<{ projectId: string; projectName: string; builtAt: string; qualityScore: number; changeDescription: string }>): PatternLineage`**
   - Sorts the project details by `builtAt` ascending.
   - Finds the version with the highest `qualityScore` and sets `bestVersionProjectId`.
   - Returns the `PatternLineage` object.

4. **`computeSkillGrowth(projects: PortfolioProject[]): SkillGrowthAnalysis`**
   - Sorts projects by `lastBuildAt` ascending.
   - For each skill dimension (`'test-coverage'`, `'complexity'`, `'security'`, `'ace-score'`, `'build-speed'`):
     - Computes rolling average of the most recent `skillWindowSize` projects' ACE scores (as proxy).
     - Computes all-time average.
     - Determines trend: if rolling > allTime * 1.05 → `'improving'`; if rolling < allTime * 0.95 → `'declining'`; else `'stable'`.
   - Generates a human-readable `summary` string.
   - Sets `overallTrend` based on majority of dimensions.

5. **`detectAntiPatterns(candidates: PatternCandidate[]): PortfolioPattern[]`**
   - Filters candidates with average quality < `antiPatternQualityThreshold` and occurrence in >= `antiPatternMinOccurrences` projects.
   - Creates `PortfolioPattern` entries with `isAntiPattern: true`.

### Required Tests (minimum 20)

Write these in `src/portfolio/pattern-detection.test.ts`:

1. **Detects candidate patterns across projects** — 3 projects share pattern with same hash, verify detected.
2. **Groups candidates by structural hash** — verify grouping logic.
3. **Ignores archived projects** — archived project's patterns not included.
4. **Ignores private projects** — private project's patterns not included.
5. **Promotes patterns appearing in 3+ projects** — verify promotion with default threshold.
6. **Does not promote patterns in only 2 projects** — verify they go to `skipped`.
7. **Flags anti-patterns with low quality scores** — average quality 30 < 40 threshold.
8. **Does not flag anti-patterns below occurrence threshold** — low quality but only 2 occurrences.
9. **Builds lineage sorted by build date** — 3 versions, verify chronological order.
10. **Identifies best version in lineage** — verify `bestVersionProjectId` matches highest score.
11. **Computes skill growth as improving** — recent projects score higher than average.
12. **Computes skill growth as declining** — recent projects score lower.
13. **Computes skill growth as stable** — recent projects similar to average.
14. **Generates human-readable skill summary** — verify summary is a non-empty string.
15. **Overall trend reflects majority** — 3 improving, 2 stable → overall improving.
16. **Handles empty project list for skill growth** — returns reasonable defaults.
17. **Handles single project for skill growth** — no crash, stable trend.
18. **Detects anti-patterns correctly** — quality 35, 4 projects → flagged.
19. **Separates promoted and anti-patterns in result** — mix of good and bad patterns.
20. **Skipped patterns are below project threshold** — verify skipped list contents.

---

## KIMI-PORTFOLIO-04: Portfolio CLI Output & Status Display

### Files to Create

- `src/portfolio/portfolio-cli.ts`
- `src/portfolio/portfolio-cli.test.ts`

### Purpose

The `nova26 portfolio status` command produces a rich terminal output showing the developer's entire project portfolio at a glance: project health, pattern counts, skill growth trends, and active cross-project insights. This is the "proof that Nova26 is making you better" surface.

### Interfaces to Implement

All interfaces must be exported from `src/portfolio/portfolio-cli.ts`:

```typescript
export interface PortfolioStatusOutput {
  header: string;                      // "NOVA26 PORTFOLIO STATUS"
  summary: PortfolioSummary;
  projectTable: string;                // formatted ASCII table
  skillGrowthSection: string;          // skill growth display
  insightsSection: string;             // active insights
  footer: string;                      // timestamp + tip
}

export interface PortfolioSummary {
  totalProjects: number;
  activeProjects: number;              // built in last 30 days
  totalBuilds: number;
  totalPatterns: number;               // portfolio-level patterns
  averageAceScore: number;
  topFramework: string;
  topProjectType: string;
}
```

Import `Portfolio`, `PortfolioProject`, `SkillGrowthRecord` from `./portfolio-manifest.js`.
Import `CrossProjectInsight` from `./similarity-engine.js`.
Import `SkillGrowthAnalysis` from `./pattern-detection.js`.

### Class to Implement

```typescript
export class PortfolioCli {
  constructor();
}
```

### Functions (all instance methods on `PortfolioCli`)

1. **`computeSummary(portfolio: Portfolio): PortfolioSummary`**
   - Calculates all summary metrics from the portfolio data.
   - `activeProjects`: projects with `lastBuildAt` within 30 days of now.
   - `totalBuilds`: sum of all projects' `totalBuilds`.
   - `totalPatterns`: count of `portfolioPatterns` with `scope: 'portfolio'`.
   - `averageAceScore`: average of the latest ACE score from each project's history (skip projects with no scores).
   - `topFramework`: most common `framework` value across projects.
   - `topProjectType`: most common `type` value across projects.

2. **`formatProjectTable(projects: PortfolioProject[]): string`**
   - Creates an ASCII table with columns: `Name`, `Type`, `Last Build`, `Builds`, `ACE`, `Health`, `Status`.
   - `Status` column: `Active` (built in last 30 days), `Stale` (30-90 days), `Archived` (if `isArchived`).
   - `Health` column: score from `currentHealthScore` or `—` if not set.
   - `ACE` column: latest ACE score or `—`.
   - Sort by `lastBuildAt` descending (most recent first).
   - Limit to 20 projects (add "... and N more" if truncated).

3. **`formatSkillGrowth(analysis: SkillGrowthAnalysis): string`**
   - Creates a readable skill growth display.
   - For each dimension, show: dimension name, rolling average, all-time average, trend arrow (↑ improving, → stable, ↓ declining).
   - Include the overall trend and summary text.

4. **`formatInsights(insights: CrossProjectInsight[]): string`**
   - Lists pending insights as numbered items.
   - Each insight shows: type icon, title, description (truncated to 80 chars).
   - Maximum 5 insights shown (add "... and N more" if truncated).
   - If no insights: returns `"No active insights. Keep building!"`.

5. **`renderStatus(portfolio: Portfolio, skillGrowth: SkillGrowthAnalysis, insights: CrossProjectInsight[]): PortfolioStatusOutput`**
   - Assembles the full status output by calling the above functions.
   - `header`: centered "NOVA26 PORTFOLIO STATUS" with decoration.
   - `footer`: `"Last updated: {timestamp} | Tip: Run 'nova26 portfolio insights' for details"`.

6. **`renderToString(output: PortfolioStatusOutput): string`**
   - Joins all sections into a single string for terminal display.
   - Adds blank lines between sections.

### Required Tests (minimum 15)

Write these in `src/portfolio/portfolio-cli.test.ts`:

1. **Computes summary from portfolio** — verify `totalProjects`, `activeProjects`, `totalBuilds`.
2. **Counts only portfolio-scope patterns** — mix of scopes, verify only portfolio counted.
3. **Computes average ACE score** — 3 projects with scores 80, 90, 70 → avg 80.
4. **Finds most common framework** — 3 React, 2 Vue → `'React'`.
5. **Finds most common project type** — verify.
6. **Formats project table with correct columns** — verify table contains all column headers.
7. **Marks projects as Active/Stale/Archived** — verify status column values.
8. **Sorts projects by lastBuildAt descending** — verify order.
9. **Truncates table at 20 projects** — add 25 projects, verify truncation message.
10. **Formats skill growth with trend arrows** — verify ↑, →, ↓ appear.
11. **Formats insights as numbered list** — 3 insights → 3 numbered items.
12. **Truncates insights at 5** — 8 insights → 5 shown + "... and 3 more".
13. **Shows placeholder when no insights** — verify "No active insights" message.
14. **Renders full status output** — verify all sections present in `PortfolioStatusOutput`.
15. **RenderToString joins sections** — verify output is a single string with section separators.

---

## KIMI-PORTFOLIO-05: Integration & Wiring

### Files to Modify

- `src/orchestrator/ralph-loop.ts` — **ADD** two new fields to `RalphLoopOptions`

### Files to Create

- `src/portfolio/index.ts`
- `src/portfolio/index.test.ts`

### Purpose

Wire the portfolio system into the Ralph Loop. Add `portfolioIntelligenceEnabled` and `portfolioConfig` to `RalphLoopOptions`. Create the barrel export for the portfolio module. Write integration tests that verify the full pipeline: create portfolio → add projects → compute fingerprints → find similar → detect patterns → generate insights.

### Modification to `src/orchestrator/ralph-loop.ts`

Add these two lines to the `RalphLoopOptions` interface, **after** the existing visionary engine configs (after `tasteRoomConfig`):

```typescript
  // Portfolio intelligence (R16-01)
  portfolioIntelligenceEnabled?: boolean;
  portfolioConfig?: PortfolioConfig;
```

Add the import at the top of the file:

```typescript
import type { PortfolioConfig } from '../portfolio/portfolio-manifest.js';
```

**That is the ONLY change to ralph-loop.ts.** Do not modify any functions.

### Barrel Export: `src/portfolio/index.ts`

Re-export everything from the three modules:

```typescript
export * from './portfolio-manifest.js';
export * from './similarity-engine.js';
export * from './pattern-detection.js';
export * from './portfolio-cli.js';
```

### Integration Tests: `src/portfolio/index.test.ts`

Write integration tests that verify the modules work together:

### Required Tests (minimum 15)

1. **Full pipeline: create portfolio, add project, compute fingerprint** — end-to-end.
2. **Full pipeline: add 3 projects, find similar** — verify similarity engine uses manifest data.
3. **Full pipeline: detect patterns across 3 projects** — verify pattern promotion.
4. **Full pipeline: generate insight from similar projects** — verify insight created.
5. **Full pipeline: compute skill growth from 5 projects** — verify analysis.
6. **Full pipeline: render portfolio status** — verify all sections populated.
7. **Portfolio config flows from RalphLoopOptions** — verify `PortfolioConfig` type is importable and assignable.
8. **Private projects excluded from similarity** — add private project, verify excluded.
9. **Archived projects excluded from pattern detection** — verify.
10. **Anti-pattern detection across portfolio** — low-quality pattern in 3 projects → flagged.
11. **Pattern lineage tracks evolution** — same pattern in 3 projects with different scores.
12. **Recency weighting affects similarity ranking** — recent project ranks higher despite slightly lower raw similarity.
13. **Barrel export exposes all key types** — import each type from index, verify defined.
14. **Empty portfolio produces valid status output** — no projects → summary shows zeros.
15. **Portfolio CLI handles missing ACE scores gracefully** — projects with no scores show `—`.

---

## Final Checklist

After completing all 5 tasks, verify:

```bash
npx tsc --noEmit        # 0 errors
npx vitest run           # 1719+ tests (target: 90+ new = 1809+)
```

New files created:
- `src/portfolio/portfolio-manifest.ts`
- `src/portfolio/portfolio-manifest.test.ts`
- `src/portfolio/similarity-engine.ts`
- `src/portfolio/similarity-engine.test.ts`
- `src/portfolio/pattern-detection.ts`
- `src/portfolio/pattern-detection.test.ts`
- `src/portfolio/portfolio-cli.ts`
- `src/portfolio/portfolio-cli.test.ts`
- `src/portfolio/index.ts`
- `src/portfolio/index.test.ts`

Modified files:
- `src/orchestrator/ralph-loop.ts` (2 new fields + 1 import only)
