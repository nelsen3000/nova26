# KIMI-VISIONARY Sprint: Dream Mode, Parallel Universe, Overnight Evolution, Nova Symbiont, Taste Room

> Assigned to: Kimi
> Sprint: Visionary (post-Frontier)
> Date issued: 2026-02-18
> Prerequisite: KIMI-FRONTIER complete (1584 tests, 0 TS errors)

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
- Agent Pool: `src/performance/agent-pool.ts`

**Current state:** 1584 tests passing, 0 TypeScript errors.

---

## Rules

- TypeScript strict mode. No `any` types.
- ESM imports with `.js` extensions (e.g., `import { Foo } from './foo.js';`).
- Every new `.ts` source file gets a companion `.test.ts` file in the same directory.
- Tests use vitest (`import { describe, it, expect, vi, beforeEach } from 'vitest';`).
- Mock Ollama calls — **never** make real LLM calls in tests. Use `vi.fn()` or `vi.mock()`.
- Do **not** modify existing source files unless explicitly told to extend them.
- Run `npx tsc --noEmit` and `npx vitest run` after each task. Zero errors, zero failures.
- Target: 1584+ tests passing at end of sprint.
- Use `zod` for runtime validation of configs and inputs where appropriate.
- Use `better-sqlite3` for any local persistence (consistent with existing codebase).
- All IDs should be generated with `crypto.randomUUID()`.
- All timestamps should be ISO 8601 strings (`new Date().toISOString()`).

---

## KIMI-VISIONARY-01: Dream Mode Engine (R16-06)

### Files to Create

- `src/dream/dream-engine.ts`
- `src/dream/dream-engine.test.ts`

### Purpose

Dream Mode creates a fully interactive simulation of an app from a natural language description, **before** any real code is written. The user explores the simulation, annotates it with feedback, and only approves real building when it feels right. This bridges the gap between "I have an idea" and "start coding" by making the idea tangible first.

### Interfaces to Implement

All interfaces must be exported from `src/dream/dream-engine.ts`:

```typescript
export interface DreamModeConfig {
  simulationTimeout: number;     // default: 60000 (60s)
  maxAnnotations: number;        // default: 50
  persistSimulations: boolean;   // default: true
  storagePath: string;           // default: '.nova/dreams'
  tasteVaultSeeding: boolean;    // default: true
}

export interface DreamSession {
  id: string;
  description: string;           // original user description
  status: 'generating' | 'ready' | 'annotating' | 'approved' | 'rejected';
  simulationHtml: string;        // the generated interactive HTML
  annotations: DreamAnnotation[];
  tasteProfile?: TasteProfile;   // seeded from Taste Vault
  createdAt: string;
  approvedAt?: string;
  generationDurationMs: number;
}

export interface DreamAnnotation {
  id: string;
  sessionId: string;
  targetSelector: string;        // CSS selector or description of element
  feedback: string;              // user's annotation text
  type: 'change' | 'approve' | 'remove' | 'add';
  createdAt: string;
}

export interface SimulationState {
  sessionId: string;
  currentRoute: string;
  viewport: 'mobile' | 'tablet' | 'desktop';
  interactionLog: Array<{ action: string; target: string; timestamp: string }>;
}

export type TasteProfile = Record<string, string>;  // key-value taste preferences
```

### Class to Implement

Export a class named `DreamEngine`:

```typescript
export class DreamEngine {
  constructor(config?: Partial<DreamModeConfig>);
}
```

The constructor should merge provided config with defaults:

```typescript
const DEFAULT_CONFIG: DreamModeConfig = {
  simulationTimeout: 60000,
  maxAnnotations: 50,
  persistSimulations: true,
  storagePath: '.nova/dreams',
  tasteVaultSeeding: true,
};
```

### Functions (all instance methods on `DreamEngine`)

1. **`createDreamSession(description: string, config?: Partial<DreamModeConfig>): Promise<DreamSession>`**
   - Validates that `description` is non-empty (throw `Error` if empty).
   - Creates a session with status `'generating'`.
   - Calls the LLM (Ollama) to generate `simulationHtml` from the description. In tests, this will be mocked.
   - If `tasteVaultSeeding` is true, seeds `tasteProfile` from the Taste Vault. Mock the Taste Vault interaction.
   - Tracks `generationDurationMs` (wall-clock time of the generation step).
   - Transitions status to `'ready'` once generation completes.
   - If `persistSimulations` is true, writes the session to disk at `storagePath/{sessionId}.json`.
   - Returns the completed `DreamSession`.

2. **`addAnnotation(sessionId: string, annotation: Omit<DreamAnnotation, 'id' | 'sessionId' | 'createdAt'>): DreamAnnotation`**
   - Finds the session by ID (throw if not found).
   - Only allows annotations when session status is `'ready'` or `'annotating'` (throw `Error` otherwise).
   - Checks `maxAnnotations` limit (throw if exceeded).
   - Creates the annotation with generated `id`, the `sessionId`, and current timestamp.
   - Updates session status to `'annotating'` if it was `'ready'`.
   - Returns the created `DreamAnnotation`.

3. **`approveSession(sessionId: string): DreamSession`**
   - Sets status to `'approved'`, records `approvedAt` timestamp.
   - Returns updated session.

4. **`rejectSession(sessionId: string): DreamSession`**
   - Sets status to `'rejected'`.
   - Returns updated session.

5. **`getSession(sessionId: string): DreamSession | undefined`**
   - Returns the session or `undefined` if not found.

6. **`listSessions(): DreamSession[]`**
   - Returns all sessions.

7. **`exportConstraints(sessionId: string): string[]`**
   - Finds the session (throw if not found).
   - Converts each annotation into a human-readable constraint string.
   - Format: `"[{type}] {feedback} (target: {targetSelector})"`.
   - Returns the array of constraint strings.

### Persistence Detail

When `persistSimulations` is true:
- On `createDreamSession`: write `{storagePath}/{sessionId}.json` containing the full `DreamSession` object.
- On engine construction with `persistSimulations: true`: scan `storagePath` for existing `.json` files and load them into memory.
- Use `fs.mkdirSync(storagePath, { recursive: true })` to ensure directory exists.

### Required Tests (minimum 15)

Write these in `src/dream/dream-engine.test.ts`:

1. **Creates a dream session from description** — call `createDreamSession('Build a todo app')`, verify it returns a `DreamSession` with the description.
2. **Session starts in 'generating' status** — verify the internal status is `'generating'` during the async generation (you can check by spying on internal state or by checking the flow).
3. **Session transitions to 'ready' after generation** — the returned session should have status `'ready'`.
4. **Adds annotations to a session** — call `addAnnotation` with valid data, verify the annotation is returned with an `id` and `createdAt`.
5. **Rejects annotation when session not in 'annotating' or 'ready' status** — approve a session first, then try to annotate; expect an error.
6. **Approves a session** — call `approveSession`, verify status is `'approved'` and `approvedAt` is set.
7. **Rejects a session** — call `rejectSession`, verify status is `'rejected'`.
8. **Lists all sessions** — create 3 sessions, verify `listSessions()` returns all 3.
9. **Exports constraints from annotations** — add 3 annotations, call `exportConstraints`, verify 3 constraint strings with correct format.
10. **Handles empty description gracefully** — call `createDreamSession('')`, expect it to throw.
11. **Respects maxAnnotations limit** — set `maxAnnotations: 2`, add 2 annotations (succeed), add a 3rd (expect throw).
12. **Persists sessions to disk when persistSimulations is true** — use a temp directory, create a session, verify the JSON file exists on disk.
13. **Loads persisted sessions** — write a session JSON to disk, create a new `DreamEngine` with the same `storagePath`, verify `listSessions()` includes it.
14. **Seeds taste profile from mock Taste Vault data** — with `tasteVaultSeeding: true`, verify `tasteProfile` is populated.
15. **Tracks generation duration** — verify `generationDurationMs` is a positive number.

---

## KIMI-VISIONARY-02: Parallel Universe Engine (R16-07)

### Files to Create

- `src/universe/parallel-universe.ts`
- `src/universe/parallel-universe.test.ts`

### Purpose

For creative decisions (e.g., "how should the dashboard look?"), the engine clones the agent loop into 2-4 parallel "universes" that each explore a different creative direction simultaneously. The user compares the results side-by-side and picks the best one, or blends elements from multiple universes. This eliminates the "what if we had tried the other approach?" regret.

### Interfaces to Implement

All interfaces must be exported from `src/universe/parallel-universe.ts`:

```typescript
export interface ParallelUniverseConfig {
  maxUniverses: number;          // default: 4
  defaultCount: number;          // default: 3
  computeBudgetMs: number;       // default: 120000 (2 min total)
  perUniverseTimeoutMs: number;  // default: 60000
  modelOverride?: string;        // lighter model for universe exploration
}

export interface ParallelUniverseSession {
  id: string;
  description: string;
  status: 'exploring' | 'compared' | 'selected' | 'blended' | 'cancelled';
  universes: Universe[];
  selectedUniverseId?: string;
  blendedFrom?: string[];        // universe IDs used in blend
  createdAt: string;
  completedAt?: string;
}

export interface Universe {
  id: string;
  sessionId: string;
  label: string;                 // "Universe A", "Universe B", etc.
  approach: string;              // description of the creative direction
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  result?: UniverseResult;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface UniverseResult {
  universeId: string;
  codeDiff: string;              // the code changes this universe produced
  qualityScore: number;          // 0-100
  summary: string;               // one-paragraph description of approach
  filesCreated: string[];
  filesModified: string[];
}

export interface BlendRequest {
  sessionId: string;
  sourceUniverses: Array<{
    universeId: string;
    elements: string[];          // what to take from this universe
  }>;
}
```

### Class to Implement

```typescript
export class ParallelUniverseEngine {
  constructor(config?: Partial<ParallelUniverseConfig>);
}
```

Default config:

```typescript
const DEFAULT_CONFIG: ParallelUniverseConfig = {
  maxUniverses: 4,
  defaultCount: 3,
  computeBudgetMs: 120000,
  perUniverseTimeoutMs: 60000,
};
```

### Functions (all instance methods on `ParallelUniverseEngine`)

1. **`createSession(description: string, count?: number, config?: Partial<ParallelUniverseConfig>): ParallelUniverseSession`**
   - `count` defaults to `config.defaultCount` (which defaults to 3).
   - Throws if `count > maxUniverses`.
   - Creates `count` `Universe` objects, each with:
     - Unique `id` (UUID).
     - `label`: `"Universe A"`, `"Universe B"`, `"Universe C"`, `"Universe D"` (using index to letter).
     - `status: 'running'`.
     - `startedAt`: current timestamp.
     - `approach`: empty string initially (filled during exploration).
   - Session starts with `status: 'exploring'`.

2. **`startExploration(sessionId: string): Promise<ParallelUniverseSession>`**
   - Runs all universes in parallel using `Promise.allSettled()`.
   - Each universe calls the LLM to generate an approach and code diff (mocked in tests).
   - Per-universe timeout: cancel the universe if it exceeds `perUniverseTimeoutMs`.
   - Total compute budget: if total elapsed time exceeds `computeBudgetMs`, cancel remaining universes.
   - A failed universe gets `status: 'failed'`; it does **not** block others.
   - Each completed universe gets a `UniverseResult` with `qualityScore` (0-100).
   - Session transitions to `'compared'` after all universes finish (or are cancelled/failed).
   - Records `completedAt` and `durationMs` on each universe.

3. **`getSession(sessionId: string): ParallelUniverseSession | undefined`**
   - Returns the session or `undefined`.

4. **`selectUniverse(sessionId: string, universeId: string): ParallelUniverseSession`**
   - Throws if session not found.
   - Throws if `universeId` does not belong to any universe in the session.
   - Sets `selectedUniverseId` and transitions session to `'selected'`.

5. **`blendUniverses(request: BlendRequest): Promise<ParallelUniverseSession>`**
   - Validates all `sourceUniverses[].universeId` belong to the same session (`request.sessionId`).
   - Throws if any universe belongs to a different session.
   - Calls the LLM to blend the specified elements (mocked in tests).
   - Sets `blendedFrom` to the list of universe IDs, transitions to `'blended'`.

6. **`cancelSession(sessionId: string): ParallelUniverseSession`**
   - Sets all running universes to `status: 'cancelled'`.
   - Sets session to `status: 'cancelled'`.

7. **`compareUniverses(sessionId: string): string`**
   - Returns a formatted markdown comparison of all universes.
   - Format per universe: `"### {label}\n**Approach:** {approach}\n**Quality:** {qualityScore}/100\n**Summary:** {summary}\n**Files:** {filesCreated.length} created, {filesModified.length} modified\n"`.
   - Throws if session not found.

### Required Tests (minimum 18)

Write these in `src/universe/parallel-universe.test.ts`:

1. **Creates a session with default 3 universes** — verify `session.universes.length === 3`.
2. **Creates a session with custom count** — pass `count: 2`, verify 2 universes.
3. **Rejects count > maxUniverses** — pass `count: 5` with default `maxUniverses: 4`, expect throw.
4. **Universes get labels A, B, C, D** — create 4 universes, verify labels.
5. **Starts exploration and all universes run** — mock LLM, verify all universes reach `'completed'`.
6. **Handles universe timeout (per-universe)** — mock one universe to be slow, verify it gets `'failed'` or `'cancelled'`.
7. **Handles total compute budget exceeded** — mock slow universes, verify budget enforcement.
8. **Selects a universe** — verify `selectedUniverseId` is set and status is `'selected'`.
9. **Rejects selection of non-existent universe** — pass a fake UUID, expect throw.
10. **Cancels a session and stops all universes** — verify all universe statuses are `'cancelled'`.
11. **Blends elements from multiple universes** — pass valid blend request, verify `blendedFrom`.
12. **Rejects blend with universes from different sessions** — expect throw.
13. **Compares universes returns formatted output** — verify the markdown contains all universe labels.
14. **Session status transitions correctly** — trace: `'exploring'` -> `'compared'` -> `'selected'`.
15. **Failed universe doesn't block others** — one fails, others complete successfully.
16. **Each universe gets independent approach** — verify approaches are populated after exploration.
17. **Quality scores computed for completed universes** — verify `qualityScore` is a number 0-100.
18. **Session tracks total duration** — verify `completedAt` is set after exploration.

---

## KIMI-VISIONARY-03: Overnight Evolution Engine (R16-08)

### Files to Create

- `src/evolution/overnight-engine.ts`
- `src/evolution/overnight-engine.test.ts`

### Purpose

While the user is away (overnight, weekend, etc.), the system runs safe experiments on sandbox copies of the codebase. Each experiment tries a small variation (apply a design pattern, try an alternative implementation, fill a test gap) and measures quality improvement via a scoring function. Results are compiled into a "morning report" that the user reviews when they return, with one-click apply for any improvement they approve.

### Interfaces to Implement

All interfaces must be exported from `src/evolution/overnight-engine.ts`:

```typescript
export interface OvernightEvolutionConfig {
  enabled: boolean;              // default: false (opt-in)
  schedule: 'nightly' | 'weekly' | 'manual';
  computeBudgetMs: number;       // default: 600000 (10 min)
  maxExperiments: number;        // default: 20
  perExperimentTimeoutMs: number;// default: 300000 (5 min)
  sandboxPath: string;           // default: '.nova/sandbox/evolution'
  reportPath: string;            // default: '.nova/evolution-reports'
}

export type ExperimentType =
  | 'wisdom-pattern'             // apply Global Wisdom pattern
  | 'alternative-impl'          // try different implementation
  | 'dependency-upgrade'        // simulate upgrade
  | 'refactor-suggestion'       // VENUS-suggested refactor
  | 'test-gap-fill';            // PLUTO-suggested test

export interface Experiment {
  id: string;
  sessionId: string;
  type: ExperimentType;
  description: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'skipped' | 'timeout';
  beforeScore?: number;          // quality score before
  afterScore?: number;           // quality score after
  scoreDelta?: number;           // after - before
  diff?: string;                 // the code changes
  testsPassed?: boolean;
  durationMs?: number;
  error?: string;
}

export interface OvernightSession {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'aborted';
  experiments: Experiment[];
  computeUsedMs: number;
  report?: MorningReport;
}

export interface MorningReport {
  sessionId: string;
  generatedAt: string;
  totalExperiments: number;
  successful: number;
  improved: number;              // experiments with positive scoreDelta
  recommendations: Array<{
    experimentId: string;
    summary: string;
    scoreDelta: number;
    actionLabel: string;         // e.g., "Apply refactor to auth module"
  }>;
  narrative: string;             // 2-3 sentence natural language summary
}
```

### Class to Implement

```typescript
export class OvernightEngine {
  constructor(config?: Partial<OvernightEvolutionConfig>);
}
```

Default config:

```typescript
const DEFAULT_CONFIG: OvernightEvolutionConfig = {
  enabled: false,
  schedule: 'manual',
  computeBudgetMs: 600000,
  maxExperiments: 20,
  perExperimentTimeoutMs: 300000,
  sandboxPath: '.nova/sandbox/evolution',
  reportPath: '.nova/evolution-reports',
};
```

### Functions (all instance methods on `OvernightEngine`)

1. **`createSession(config?: Partial<OvernightEvolutionConfig>): OvernightSession`**
   - Creates a new session with `status: 'running'`, empty experiments array, `computeUsedMs: 0`.
   - Stores the session internally.

2. **`runSession(sessionId: string): Promise<OvernightSession>`**
   - Retrieves the session (throw if not found).
   - Runs experiments **sequentially** (not in parallel — safety first).
   - Before each experiment:
     - Check if `computeUsedMs + estimatedTime > computeBudgetMs`. If so, skip remaining experiments with status `'skipped'`.
     - Check if experiment count has reached `maxExperiments`. If so, stop.
   - For each experiment:
     - Set status to `'running'`.
     - Call the LLM/scoring function (mocked in tests) to run the experiment.
     - Enforce `perExperimentTimeoutMs` — set status `'timeout'` if exceeded.
     - On success: record `beforeScore`, `afterScore`, `scoreDelta`, `diff`, `testsPassed`.
     - On failure: record `error`, set status `'failure'`.
     - Track `durationMs` and add to `computeUsedMs`.
   - After all experiments: set session `status: 'completed'`, record `completedAt`.

3. **`generateReport(sessionId: string): MorningReport`**
   - Retrieves the session (throw if not found).
   - Counts `totalExperiments`, `successful` (status `'success'`), `improved` (positive `scoreDelta`).
   - Creates `recommendations` array from experiments with positive `scoreDelta`, sorted by `scoreDelta` descending.
   - Each recommendation has an `actionLabel` like `"Apply {type}: {description}"`.
   - Generates `narrative` — a 2-3 sentence summary. In tests, this can be a simple template string; in production, it would use the LLM.
   - Stores the report on the session object.
   - Writes the report to `{reportPath}/{sessionId}-report.json`.

4. **`getSession(sessionId: string): OvernightSession | undefined`**
   - Returns the session or `undefined`.

5. **`listSessions(): OvernightSession[]`**
   - Returns all sessions.

6. **`applyExperiment(experimentId: string): Promise<boolean>`**
   - Finds the experiment across all sessions.
   - Returns `false` if the experiment status is not `'success'`.
   - Applies the `diff` to the real codebase (in tests, mock the file system operations).
   - Returns `true` on successful application.

7. **`abortSession(sessionId: string): OvernightSession`**
   - Sets session status to `'aborted'`.
   - Sets any `'pending'` or `'running'` experiments to `'skipped'`.
   - Records `completedAt`.

8. **`getLatestReport(): MorningReport | undefined`**
   - Returns the report from the most recently completed session that has a report.
   - Returns `undefined` if no reports exist.

### Required Tests (minimum 18)

Write these in `src/evolution/overnight-engine.test.ts`:

1. **Creates an overnight session** — verify session has ID, status `'running'`, empty experiments.
2. **Runs experiments within compute budget** — add mock experiments, verify they all run.
3. **Stops when compute budget exhausted** — set a low `computeBudgetMs`, mock slow experiments, verify remaining are `'skipped'`.
4. **Times out individual experiments at perExperimentTimeoutMs** — mock a slow experiment, verify it gets status `'timeout'`.
5. **Limits to maxExperiments** — set `maxExperiments: 3`, add 5 experiments, verify only 3 run.
6. **Tracks compute usage accurately** — verify `computeUsedMs` equals sum of experiment `durationMs` values.
7. **Generates morning report with recommendations** — verify report structure.
8. **Report only includes experiments with positive scoreDelta** — add experiments with negative, zero, and positive deltas; verify only positive ones appear in recommendations.
9. **Generates narrative summary** — verify `narrative` is a non-empty string.
10. **Aborts a running session** — verify status is `'aborted'` and pending experiments are `'skipped'`.
11. **Lists all sessions** — create 3 sessions, verify `listSessions()` returns all 3.
12. **Gets latest report** — create 2 sessions with reports, verify it returns the most recent.
13. **Apply experiment returns true on success** — apply a successful experiment, expect `true`.
14. **Apply experiment returns false when experiment failed** — try to apply a failed experiment, expect `false`.
15. **Handles empty experiment list** — run a session with no experiments, verify it completes cleanly.
16. **Session status transitions correctly** — trace: `'running'` -> `'completed'`.
17. **Skips experiments when previous ones consume too much budget** — first experiment uses 90% of budget, second gets skipped.
18. **Reports include experiment type breakdown** — verify `totalExperiments` and `successful` counts are correct per type.

---

## KIMI-VISIONARY-04: Nova Symbiont Core (R16-09)

### Files to Create

- `src/symbiont/symbiont-core.ts`
- `src/symbiont/symbiont-core.test.ts`

### Purpose

The Symbiont is the meta-layer that sits above all 21 agents and develops a persistent creative intelligence that co-evolves with the user over time. It stores taste DNA (an embedding vector of accumulated preferences), a decision journal (recording what was decided and why), a creative style profile (patterns, colors, layout preferences, code style), and generates proactive insights ("I noticed you always prefer functional patterns — should we refactor the auth module?"). This is the "soul" of Nova26.

### Interfaces to Implement

All interfaces must be exported from `src/symbiont/symbiont-core.ts`:

```typescript
export interface SymbiontConfig {
  dbPath: string;                // default: '.nova/symbiont.db'
  insightGenerationEnabled: boolean; // default: true
  metaCognitionInterval: number; // turns between meta-checks; default: 5
  maxInsightsPerDay: number;     // default: 5
  evolutionEnabled: boolean;     // default: true
}

export interface SymbiontState {
  id: string;
  userId: string;                // local machine identifier
  tasteDNA: number[];            // embedding vector of accumulated preferences
  creativeStyleProfile: CreativeStyleProfile;
  totalInteractions: number;
  totalBuilds: number;
  maturityLevel: 'nascent' | 'growing' | 'mature' | 'evolved';
  createdAt: string;
  lastActiveAt: string;
}

export interface CreativeStyleProfile {
  preferredPatterns: string[];   // top 10 pattern names from Taste Vault
  avoidedPatterns: string[];     // patterns the user consistently rejects
  colorPreferences: string[];   // hex codes user gravitates toward
  layoutPreference: 'minimal' | 'dense' | 'balanced' | 'unknown';
  codeStyleTraits: string[];    // e.g., "functional", "explicit-errors", "small-functions"
  confidence: number;            // 0-1, how confident the profile is
}

export interface DecisionJournalEntry {
  id: string;
  buildId: string;
  decision: string;              // what was decided
  rationale: string;             // why
  alternatives: string[];        // what else was considered
  outcome: 'positive' | 'negative' | 'neutral' | 'unknown';
  createdAt: string;
}

export interface SymbiontInsight {
  id: string;
  type: 'pattern-suggestion' | 'style-drift' | 'proactive-idea' | 'meta-reflection';
  title: string;
  content: string;
  confidence: number;            // 0-1
  actionable: boolean;
  actionDescription?: string;
  generatedAt: string;
  status: 'pending' | 'accepted' | 'dismissed';
}
```

### Class to Implement

```typescript
export class SymbiontCore {
  constructor(config?: Partial<SymbiontConfig>);
}
```

Default config:

```typescript
const DEFAULT_CONFIG: SymbiontConfig = {
  dbPath: '.nova/symbiont.db',
  insightGenerationEnabled: true,
  metaCognitionInterval: 5,
  maxInsightsPerDay: 5,
  evolutionEnabled: true,
};
```

### Maturity Level Thresholds

Maturity is determined by `totalInteractions`:

| Interactions | Level |
|---|---|
| 0-10 | `'nascent'` |
| 11-50 | `'growing'` |
| 51-200 | `'mature'` |
| 201+ | `'evolved'` |

### Functions (all instance methods on `SymbiontCore`)

1. **`initSymbiont(config?: Partial<SymbiontConfig>): Promise<SymbiontState>`**
   - If a Symbiont already exists in storage (`dbPath`), loads and returns it.
   - Otherwise, creates a new one with:
     - UUID for `id`.
     - `userId` from a machine identifier (use `os.hostname()` or similar; mock in tests).
     - `tasteDNA`: empty array `[]` initially.
     - Default `CreativeStyleProfile` with empty arrays, `'unknown'` layout, `confidence: 0`.
     - `totalInteractions: 0`, `totalBuilds: 0`.
     - `maturityLevel: 'nascent'`.
   - Uses `better-sqlite3` for persistence. Create the DB and tables if they don't exist.

2. **`getSymbiont(): SymbiontState | undefined`**
   - Returns the current Symbiont state from memory, or `undefined` if not initialized.

3. **`updateTasteDNA(preferences: Record<string, number>): void`**
   - Takes a key-value map of preference signals (e.g., `{ "dark-mode": 0.8, "minimal": 0.9 }`).
   - Updates the `tasteDNA` vector. Strategy: convert preference values to a simple numeric array and append/update.
   - Increments `totalInteractions`.
   - Updates `maturityLevel` based on new `totalInteractions`.
   - Persists the updated state.

4. **`recordDecision(entry: Omit<DecisionJournalEntry, 'id' | 'createdAt'>): DecisionJournalEntry`**
   - Creates the entry with generated ID and current timestamp.
   - Persists to the DB.
   - Returns the full entry.

5. **`getDecisionJournal(limit?: number): DecisionJournalEntry[]`**
   - Returns entries from the DB, ordered by `createdAt` descending.
   - If `limit` is provided, returns at most `limit` entries.

6. **`generateInsight(): Promise<SymbiontInsight | null>`**
   - If `insightGenerationEnabled` is false, returns `null`.
   - Checks the daily insight count; returns `null` if `maxInsightsPerDay` reached.
   - Calls the LLM (mocked in tests) to generate an insight based on accumulated taste DNA, decision journal, and creative profile.
   - Creates the insight with `status: 'pending'`.
   - Persists and returns it.

7. **`getInsights(filter?: { status?: string; type?: string }): SymbiontInsight[]`**
   - Returns all insights, optionally filtered by `status` and/or `type`.

8. **`acceptInsight(insightId: string): void`**
   - Sets the insight's status to `'accepted'`.
   - Throws if insight not found.

9. **`dismissInsight(insightId: string): void`**
   - Sets the insight's status to `'dismissed'`.
   - Throws if insight not found.

10. **`getCreativeProfile(): CreativeStyleProfile`**
    - Returns the current creative style profile.

11. **`updateCreativeProfile(traits: Partial<CreativeStyleProfile>): void`**
    - Merges the provided traits into the existing profile.
    - Persists the update.

12. **`getMaturityLevel(): string`**
    - Returns the current maturity level string.

13. **`askSymbiont(question: string): Promise<string>`**
    - The "what would we do?" interface.
    - Calls the LLM with the question, the current taste DNA, creative profile, and recent decision journal entries as context.
    - Returns the LLM response string (mocked in tests).

14. **`resetSymbiont(): Promise<void>`**
    - Deletes all data: drops DB tables, clears in-memory state.
    - After reset, `getSymbiont()` returns `undefined`.

### Required Tests (minimum 20)

Write these in `src/symbiont/symbiont-core.test.ts`:

1. **Initializes a new Symbiont** — verify the returned state has all required fields.
2. **Loads existing Symbiont from storage** — init once, create a new instance, init again, verify same ID.
3. **Updates taste DNA** — call `updateTasteDNA`, verify `tasteDNA` is updated.
4. **Records a decision** — call `recordDecision`, verify it returns a full entry with ID and timestamp.
5. **Retrieves decision journal** — record 3 decisions, verify `getDecisionJournal()` returns all 3.
6. **Decision journal respects limit** — record 5 decisions, call `getDecisionJournal(2)`, verify only 2 returned.
7. **Generates an insight (mock LLM)** — mock the LLM call, verify the insight has `status: 'pending'`.
8. **Gets insights filtered by status** — create insights with different statuses, filter by `'pending'`, verify only pending ones returned.
9. **Gets insights filtered by type** — create insights with different types, filter by `'pattern-suggestion'`, verify correct filtering.
10. **Accepts an insight** — call `acceptInsight`, verify status changes to `'accepted'`.
11. **Dismisses an insight** — call `dismissInsight`, verify status changes to `'dismissed'`.
12. **Gets creative profile** — verify it returns a `CreativeStyleProfile` object.
13. **Updates creative profile** — update `layoutPreference` to `'minimal'`, verify it persists.
14. **Maturity level starts at 'nascent'** — new Symbiont has `maturityLevel: 'nascent'`.
15. **Maturity progresses correctly** — simulate interactions: 0-10 = nascent, 11-50 = growing, 51-200 = mature, 201+ = evolved.
16. **Ask symbiont returns a response (mock LLM)** — mock the LLM, call `askSymbiont('What color scheme?')`, verify non-empty response.
17. **Resets symbiont completely** — call `resetSymbiont`, verify `getSymbiont()` returns `undefined`.
18. **Respects maxInsightsPerDay** — set `maxInsightsPerDay: 2`, generate 2 insights (succeed), attempt 3rd (returns `null`).
19. **Taste DNA is a valid embedding vector** — verify `tasteDNA` is an array of numbers.
20. **Total interactions tracks correctly** — call `updateTasteDNA` 5 times, verify `totalInteractions === 5`.

---

## KIMI-VISIONARY-05: Taste Room Engine (R16-10)

### Files to Create

- `src/taste-room/taste-room.ts`
- `src/taste-room/taste-room.test.ts`

### Purpose

The Taste Room is an infinite personalized visual design library with dedicated sections for every component type (buttons, cards, navigation, heroes, full pages, etc.). Users browse a curated feed and swipe in 4 directions (Tinder-style) to train the recommendation engine:

- **Right** = Love (save to Taste Vault, strong positive signal)
- **Left** = Dislike (negative training signal)
- **Up** = Save to Inspiration Board (mild positive, save for later reference)
- **Down** = Generate Variations (explore similar designs)

The system gets smarter with every interaction, building a preference vector that powers increasingly accurate curation.

### Interfaces to Implement

All interfaces must be exported from `src/taste-room/taste-room.ts`:

```typescript
export type SwipeDirection = 'right' | 'left' | 'up' | 'down';

export type TasteRoomSection =
  | 'buttons' | 'toggles' | 'switches' | 'fonts' | 'colors'
  | 'backgrounds' | 'cards' | 'inputs' | 'navigation'
  | 'modals' | 'tables' | 'loading-states' | 'empty-states'
  | 'heroes' | 'footers' | 'full-pages';

export type DevicePreview = 'mobile' | 'tablet' | 'desktop';

export interface TasteRoomConfig {
  storagePath: string;           // default: '.nova/taste-room'
  baselineCollectionSize: number;// default: 500
  curatedFeedSize: number;       // default: 20
  refreshInterval: 'daily' | 'weekly' | 'manual';
  sections: TasteRoomSection[];  // which sections to show
}

export interface TasteCard {
  id: string;
  section: TasteRoomSection;
  title: string;
  description: string;
  previewHtml: string;           // the component preview markup
  tags: string[];
  sourceCollection: 'baseline' | 'generated' | 'community';
  devicePreviews: Record<DevicePreview, string>; // HTML per device size
  metadata: Record<string, unknown>;
}

export interface SwipeEvent {
  id: string;
  cardId: string;
  direction: SwipeDirection;
  section: TasteRoomSection;
  device: DevicePreview;
  timestamp: string;
}

export interface CuratedFeed {
  cards: TasteCard[];
  generatedAt: string;
  basedOnSwipeCount: number;     // how many swipes informed this feed
  confidenceScore: number;       // 0-1, how confident the curation is
}

export interface InspirationBoard {
  id: string;
  cards: TasteCard[];            // cards swiped up
  createdAt: string;
  updatedAt: string;
}
```

### Constants

Define and export the full list of all 16 sections:

```typescript
export const ALL_SECTIONS: TasteRoomSection[] = [
  'buttons', 'toggles', 'switches', 'fonts', 'colors',
  'backgrounds', 'cards', 'inputs', 'navigation',
  'modals', 'tables', 'loading-states', 'empty-states',
  'heroes', 'footers', 'full-pages',
];
```

### Class to Implement

```typescript
export class TasteRoom {
  constructor(config?: Partial<TasteRoomConfig>);
}
```

Default config:

```typescript
const DEFAULT_CONFIG: TasteRoomConfig = {
  storagePath: '.nova/taste-room',
  baselineCollectionSize: 500,
  curatedFeedSize: 20,
  refreshInterval: 'manual',
  sections: ALL_SECTIONS,
};
```

### Functions (all instance methods on `TasteRoom`)

1. **`initTasteRoom(config?: Partial<TasteRoomConfig>): Promise<void>`**
   - Creates the storage directory if it doesn't exist.
   - Loads the baseline collection. The baseline is a set of pre-generated `TasteCard` objects. In production this would load from a file or generate them; in tests, mock this to return a small set (e.g., 10-20 cards across sections).
   - Each baseline card must have:
     - `devicePreviews` with entries for `'mobile'`, `'tablet'`, and `'desktop'`.
     - `sourceCollection: 'baseline'`.
   - Initializes the inspiration board (empty or loaded from storage).

2. **`getCards(section: TasteRoomSection, device?: DevicePreview, limit?: number): TasteCard[]`**
   - Returns cards for the given section.
   - If `device` is provided, only returns cards that have a preview for that device (which should be all of them, but filter anyway).
   - If `limit` is provided, returns at most `limit` cards.

3. **`getCard(cardId: string): TasteCard | undefined`**
   - Returns a single card by ID, or `undefined`.

4. **`recordSwipe(event: Omit<SwipeEvent, 'id' | 'timestamp'>): SwipeEvent`**
   - Creates the event with generated ID and current timestamp.
   - Stores the event in swipe history.
   - Based on direction:
     - `'right'` (Love): strong positive signal (weight: +2) for the card's tags/section.
     - `'left'` (Dislike): negative signal (weight: -1) for the card's tags/section.
     - `'up'` (Inspiration): mild positive signal (weight: +1), adds card to inspiration board.
     - `'down'` (Variations): neutral signal, triggers variation generation (the actual generation happens in `generateVariations`).
   - Updates the internal preference vector.
   - Returns the created `SwipeEvent`.

5. **`getSwipeHistory(limit?: number): SwipeEvent[]`**
   - Returns swipe events ordered by timestamp descending.
   - Respects `limit` if provided.

6. **`getCuratedFeed(): CuratedFeed`**
   - Returns a `CuratedFeed` with up to `curatedFeedSize` cards.
   - Cards are ranked by how well they match the current preference vector.
   - `basedOnSwipeCount`: the total number of swipes recorded so far.
   - `confidenceScore`: calculated as `min(1, swipeCount / 100)` — increases with more swipes, capped at 1.
   - If no swipes yet, returns a random selection from the baseline.

7. **`getInspirationBoard(): InspirationBoard`**
   - Returns the current inspiration board (cards that were swiped up).

8. **`generateVariations(cardId: string, count?: number): Promise<TasteCard[]>`**
   - `count` defaults to 4.
   - Finds the source card (throw if not found).
   - Calls the LLM (mocked in tests) to generate `count` variations of the card.
   - Each variation gets:
     - New UUID.
     - `sourceCollection: 'generated'`.
     - Same `section` as the original.
     - `devicePreviews` for all three device sizes.
   - Adds the variations to the card collection.
   - Returns the generated cards.

9. **`getSectionStats(): Record<TasteRoomSection, { total: number; liked: number; disliked: number }>`**
   - For each section in `ALL_SECTIONS`, returns:
     - `total`: number of cards in that section.
     - `liked`: number of right-swipes in that section.
     - `disliked`: number of left-swipes in that section.

10. **`getPreferenceVector(): number[]`**
    - Returns the current preference vector (array of numbers).
    - The vector encodes accumulated swipe signals.
    - Initially empty `[]`, grows as swipes are recorded.

11. **`resetPreferences(): void`**
    - Clears all swipe history.
    - Resets the preference vector to `[]`.
    - Clears the inspiration board.
    - Does **not** remove baseline cards.

### Required Tests (minimum 22)

Write these in `src/taste-room/taste-room.test.ts`:

1. **Initializes taste room with default config** — verify `initTasteRoom` completes without error.
2. **Loads baseline collection** — after init, verify cards are available via `getCards`.
3. **Gets cards by section** — add cards to `'buttons'` section, verify `getCards('buttons')` returns only button cards.
4. **Gets cards filtered by device** — pass `device: 'mobile'`, verify all returned cards have mobile preview.
5. **Respects limit parameter** — pass `limit: 2`, verify at most 2 cards returned.
6. **Gets single card by ID** — get a known card, verify it matches.
7. **Returns undefined for non-existent card** — pass a fake UUID, expect `undefined`.
8. **Records a right swipe (love)** — record swipe, verify event returned with direction `'right'`.
9. **Records a left swipe (dislike)** — record swipe, verify event returned with direction `'left'`.
10. **Records an up swipe (inspiration board)** — record swipe, verify card appears on inspiration board.
11. **Records a down swipe triggers variation generation** — record down swipe, verify the event is recorded (actual generation is separate).
12. **Gets swipe history** — record 5 swipes, verify `getSwipeHistory()` returns all 5.
13. **Swipe history respects limit** — record 5 swipes, call `getSwipeHistory(2)`, verify only 2 returned.
14. **Curated feed returns cards** — after some swipes, verify `getCuratedFeed()` returns a non-empty `CuratedFeed`.
15. **Curated feed confidence increases with more swipes** — record 10 swipes, check confidence; record 90 more, check that confidence is higher.
16. **Inspiration board contains only up-swiped cards** — swipe 3 cards up, 2 right, 1 left; verify board has exactly 3.
17. **Generates variations from a card** — call `generateVariations` on a known card, verify it returns new cards with `sourceCollection: 'generated'`.
18. **Section stats track likes and dislikes correctly** — swipe 3 right and 2 left in `'buttons'`, verify stats `{ liked: 3, disliked: 2 }`.
19. **Preference vector updates after swipes** — record swipes, verify `getPreferenceVector()` is no longer empty.
20. **Reset preferences clears history** — record swipes, reset, verify `getSwipeHistory()` is empty and preference vector is `[]`.
21. **Cards have device previews for all three devices** — verify each card has `mobile`, `tablet`, and `desktop` keys in `devicePreviews`.
22. **Section list includes all 16 sections** — verify `ALL_SECTIONS.length === 16` and contains all expected values.

---

## KIMI-VISIONARY-06: Integration & Wiring (R16-06 through R16-10)

### Overview

Wire up all 5 new engines into the existing Nova26 architecture by extending the Ralph Loop options and creating a central barrel export.

### Step 1: Extend `src/orchestrator/ralph-loop.ts`

**Modify** the existing `RalphLoopOptions` interface (or type) to add the following optional fields:

```typescript
// Add these imports at the top of ralph-loop.ts:
import type { DreamModeConfig } from '../dream/dream-engine.js';
import type { ParallelUniverseConfig } from '../universe/parallel-universe.js';
import type { OvernightEvolutionConfig } from '../evolution/overnight-engine.js';
import type { SymbiontConfig } from '../symbiont/symbiont-core.js';
import type { TasteRoomConfig } from '../taste-room/taste-room.js';

// Add these fields to RalphLoopOptions:
dreamModeEnabled?: boolean;
dreamConfig?: DreamModeConfig;
parallelUniverseEnabled?: boolean;
parallelUniverseConfig?: ParallelUniverseConfig;
overnightEvolutionEnabled?: boolean;
overnightConfig?: OvernightEvolutionConfig;
symbiontEnabled?: boolean;
symbiontConfig?: SymbiontConfig;
tasteRoomEnabled?: boolean;
tasteRoomConfig?: TasteRoomConfig;
```

**Important:** Do NOT modify any existing logic in ralph-loop.ts. Only add the imports and the new optional fields to the options interface/type.

### Step 2: Create `src/visionary/index.ts`

Create a barrel export file that re-exports all 5 engines for convenient access:

```typescript
export { DreamEngine } from '../dream/dream-engine.js';
export { ParallelUniverseEngine } from '../universe/parallel-universe.js';
export { OvernightEngine } from '../evolution/overnight-engine.js';
export { SymbiontCore } from '../symbiont/symbiont-core.js';
export { TasteRoom } from '../taste-room/taste-room.js';
```

Also re-export all interfaces and types from each module so consumers can import everything from `'./visionary/index.js'`.

### Step 3: Create `src/visionary/index.test.ts`

Write smoke tests that verify the wiring works.

### Required Tests (minimum 5)

1. **DreamEngine can be imported and instantiated** — `new DreamEngine()` does not throw.
2. **ParallelUniverseEngine can be imported and instantiated** — `new ParallelUniverseEngine()` does not throw.
3. **OvernightEngine can be imported and instantiated** — `new OvernightEngine()` does not throw.
4. **SymbiontCore can be imported and instantiated** — `new SymbiontCore()` does not throw.
5. **TasteRoom can be imported and instantiated** — `new TasteRoom()` does not throw.

### Final Verification

After completing all 6 tasks, run:

```bash
npx tsc --noEmit
npx vitest run
```

Expected results:
- **0 TypeScript errors**
- **All tests passing** (target: 1584 existing + ~98 new = **1682+ total**)

---

## Completion Checklist

| Task | Files | Min Tests |
|------|-------|-----------|
| KIMI-VISIONARY-01 | `src/dream/dream-engine.ts` + `src/dream/dream-engine.test.ts` | 15 |
| KIMI-VISIONARY-02 | `src/universe/parallel-universe.ts` + `src/universe/parallel-universe.test.ts` | 18 |
| KIMI-VISIONARY-03 | `src/evolution/overnight-engine.ts` + `src/evolution/overnight-engine.test.ts` | 18 |
| KIMI-VISIONARY-04 | `src/symbiont/symbiont-core.ts` + `src/symbiont/symbiont-core.test.ts` | 20 |
| KIMI-VISIONARY-05 | `src/taste-room/taste-room.ts` + `src/taste-room/taste-room.test.ts` | 22 |
| KIMI-VISIONARY-06 | `src/visionary/index.ts` + `src/visionary/index.test.ts` + `src/orchestrator/ralph-loop.ts` (modify) | 5 |
| **Total** | **12+ files** | **98+** |

**Final state:** 0 TypeScript errors, 1682+ tests passing.

---

## Execution Order

Complete the tasks in order: 01 through 06. Each task should compile and pass tests independently before moving to the next. Task 06 depends on all previous tasks being complete.

After each task:
1. `npx tsc --noEmit` — must show 0 errors.
2. `npx vitest run` — must show 0 failures.
3. Verify no existing tests were broken.

Do not proceed to the next task until the current one is green.
