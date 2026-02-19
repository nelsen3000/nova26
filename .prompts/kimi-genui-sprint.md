# KIMI-GENUI Sprint: Generative UI & Live Preview System (R16-03)

> Assigned to: Kimi
> Sprint: Generative UI (post-Memory)
> Date issued: 2026-02-19
> Prerequisite: KIMI-MEMORY complete (1901 tests, 0 TS errors)

## Project Context

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama (local LLM), Convex, and vitest. Agents are named after celestial bodies: MARS, VENUS, MERCURY, JUPITER, SATURN, PLUTO, ATLAS, etc.

**Key systems you should be aware of (do not modify unless told):**

- Core execution: Ralph Loop (`src/orchestrator/ralph-loop.ts`)
- Taste Vault: `src/taste-vault/`
- ACE playbooks: `src/ace/`
- Rehearsal Stage: `src/rehearsal/`
- Session Memory: `src/memory/session-memory.ts`
- Agent Memory: `src/memory/agent-memory.ts`
- Personality Engine: `src/agents/personality-engine.ts`
- Offline Engine: `src/sync/offline-engine.ts`
- Semantic Search: `src/tools/semantic-search.ts`
- ATLAS: `src/atlas/`
- Dream Engine: `src/dream/`
- Parallel Universe: `src/universe/`
- Overnight Evolution: `src/evolution/`
- Nova Symbiont: `src/symbiont/`
- Taste Room: `src/taste-room/`
- Portfolio: `src/portfolio/`
- Preview Server: `src/preview/server.ts`

**Current state:** 1901 tests passing, 0 TypeScript errors.

**Important context:** `src/preview/server.ts` already exists as a basic HTTP preview server for component rendering. The Generative UI system (this sprint) is a **separate, higher-level system** in `src/generative-ui/` that manages live preview sessions, generative component creation, visual feedback loops, component playgrounds, and the Living Canvas concept. Do **not** modify `src/preview/server.ts`.

**Key distinction from Preview Server:** The existing preview server is a dumb HTTP server that serves component HTML. The Generative UI system orchestrates intelligent, agent-driven UI generation with live feedback, variation exploration, and canvas state management. Think of it as the brain behind the preview.

---

## Rules

- TypeScript strict mode. No `any` types.
- ESM imports with `.js` extensions (e.g., `import { Foo } from './foo.js';`).
- Every new `.ts` source file gets a companion `.test.ts` file in the same directory.
- Tests use vitest (`import { describe, it, expect, vi, beforeEach } from 'vitest';`).
- Mock Ollama calls — **never** make real LLM calls in tests. Use `vi.fn()` or `vi.mock()`.
- Do **not** modify existing source files unless explicitly told to extend them.
- Run `npx tsc --noEmit` and `npx vitest run` after each task. Zero errors, zero failures.
- Target: 1901+ tests passing at end of sprint (aim for 90+ new tests).
- Use `zod` for runtime validation where appropriate.
- All IDs should be generated with `crypto.randomUUID()`.
- All timestamps should be ISO 8601 strings (`new Date().toISOString()`).

---

## KIMI-GENUI-01: Live Preview Types & Session Manager

### Files to Create

- `src/generative-ui/live-preview.ts`
- `src/generative-ui/live-preview.test.ts`

### Purpose

The live preview system manages preview sessions where agents write UI code and users see it rendered in real time. A session tracks the preview server lifecycle, the rendering strategy (Vite HMR for Vite projects, iframe sandbox for isolation), the active component being previewed, and the session status. This task creates the foundational types and the session manager.

### Interfaces to Implement

All interfaces must be exported from `src/generative-ui/live-preview.ts`:

```typescript
export type PreviewStrategy = 'vite-hmr' | 'iframe-sandbox' | 'auto';
export type FrameworkType = 'auto' | 'react' | 'vue' | 'svelte' | 'solid';
export type SessionStatus = 'starting' | 'ready' | 'updating' | 'error' | 'stopped';

export interface LivePreviewConfig {
  port: number;                        // default: 5274
  framework: FrameworkType;            // default: 'auto'
  strategy: PreviewStrategy;           // default: 'auto'
  mockBackend: boolean;                // default: true
  openBrowser: boolean;                // default: false (terminal-first)
  variationsDefault: number;           // default: 1
  sourceMapAnnotation: boolean;        // default: true — inject data-nova-source attributes
}

export interface LivePreviewSession {
  id: string;
  projectId: string;
  strategy: 'vite-hmr' | 'iframe-sandbox';  // resolved strategy (never 'auto')
  port: number;
  url: string;
  startedAt: string;
  lastUpdatedAt: string;
  activeComponentPath?: string;
  status: SessionStatus;
  errorMessage?: string;
  framework: string;                   // resolved framework (never 'auto')
}

export interface FrameworkDetectionResult {
  framework: string;
  confidence: number;                  // 0-1
  detectedFrom: string;               // e.g., 'package.json dependencies'
  strategy: 'vite-hmr' | 'iframe-sandbox';
}
```

### Class to Implement

```typescript
export class LivePreviewSessionManager {
  constructor(config?: Partial<LivePreviewConfig>);
}
```

The constructor merges config with defaults:

```typescript
const DEFAULT_CONFIG: LivePreviewConfig = {
  port: 5274,
  framework: 'auto',
  strategy: 'auto',
  mockBackend: true,
  openBrowser: false,
  variationsDefault: 1,
  sourceMapAnnotation: true,
};
```

### Functions (all instance methods on `LivePreviewSessionManager`)

1. **`createSession(projectId: string, options?: { port?: number; strategy?: PreviewStrategy }): LivePreviewSession`**
   - Generates UUID for `id`. Resolves strategy: if 'auto', calls `resolveStrategy()`. Resolves framework via `detectFramework()`.
   - Constructs `url` as `http://localhost:${port}`.
   - Sets `status: 'starting'`, timestamps to now.
   - Stores session in internal `Map<string, LivePreviewSession>`.
   - Returns the session.

2. **`startSession(sessionId: string): LivePreviewSession`**
   - Transitions session status from `'starting'` to `'ready'`. Updates `lastUpdatedAt`.
   - Throws if session not found or not in `'starting'` status.

3. **`stopSession(sessionId: string): LivePreviewSession`**
   - Transitions session status to `'stopped'`. Updates `lastUpdatedAt`.
   - Throws if session not found.

4. **`getSession(sessionId: string): LivePreviewSession | undefined`**
   - Returns session by ID, or undefined.

5. **`getActiveSession(): LivePreviewSession | undefined`**
   - Returns the first session with status `'ready'` or `'updating'`. Undefined if none active.

6. **`updateSessionStatus(sessionId: string, status: SessionStatus, errorMessage?: string): LivePreviewSession`**
   - Updates session status and optional error message. Updates `lastUpdatedAt`.
   - Throws if session not found.

7. **`setActiveComponent(sessionId: string, componentPath: string): LivePreviewSession`**
   - Sets `activeComponentPath` on the session. Updates `lastUpdatedAt`.
   - Throws if session not found.

8. **`listSessions(): LivePreviewSession[]`**
   - Returns all sessions sorted by `startedAt` descending.

9. **`detectFramework(projectPath?: string): FrameworkDetectionResult`**
   - Detects UI framework from package.json dependencies. Priority order:
     1. `react` or `next` → framework: 'react', strategy: 'vite-hmr'
     2. `vue` → framework: 'vue', strategy: 'vite-hmr'
     3. `svelte` or `sveltekit` → framework: 'svelte', strategy: 'vite-hmr'
     4. `solid-js` → framework: 'solid', strategy: 'vite-hmr'
     5. Fallback → framework: 'react', strategy: 'iframe-sandbox'
   - Does NOT actually read package.json in the class (dependency-injected or mocked in tests). Uses a `packageJsonReader` function passed to constructor or defaults to reading from `process.cwd()`.
   - For testability: accept an optional `dependencies` parameter of type `Record<string, string>` that bypasses file reading.

10. **`resolveStrategy(framework: string): 'vite-hmr' | 'iframe-sandbox'`**
    - If framework is detected and Vite config exists → 'vite-hmr'.
    - Otherwise → 'iframe-sandbox'.

11. **`findAvailablePort(startPort: number): number`**
    - Scans from startPort upward until a free port is found. Returns the port number.
    - For testability: always returns `startPort` in tests (mock the port check).

### Required Tests (minimum 20)

Write these in `src/generative-ui/live-preview.test.ts`:

1. **Creates session with defaults** — verify port 5274, status 'starting', url correct.
2. **Creates session with custom port** — port 8080, verify url `http://localhost:8080`.
3. **Creates session with explicit strategy** — 'iframe-sandbox', verify not overridden.
4. **Starts session transitions to ready** — create then start, verify status 'ready'.
5. **Start throws for non-existent session** — expect error.
6. **Start throws for non-starting session** — session already 'ready', expect error.
7. **Stops session** — start then stop, verify status 'stopped'.
8. **Stop throws for non-existent session** — expect error.
9. **Gets session by ID** — create, get, verify match.
10. **Returns undefined for non-existent ID** — verify.
11. **Gets active session** — create and start, verify getActiveSession returns it.
12. **Returns undefined when no active session** — all stopped, verify undefined.
13. **Updates session status** — update to 'error' with message, verify both set.
14. **Sets active component** — verify componentPath set.
15. **Lists sessions sorted by startedAt** — create 3, verify order.
16. **Detects React from dependencies** — { react: '18.0.0' } → framework: 'react'.
17. **Detects Vue from dependencies** — { vue: '3.0.0' } → framework: 'vue'.
18. **Detects Svelte from dependencies** — { svelte: '4.0.0' } → framework: 'svelte'.
19. **Detects Solid from dependencies** — { 'solid-js': '1.0.0' } → framework: 'solid'.
20. **Falls back to React** — empty dependencies → framework: 'react', strategy: 'iframe-sandbox'.
21. **Resolves strategy to vite-hmr for known frameworks** — verify.
22. **Default config has correct values** — verify all defaults.

---

## KIMI-GENUI-02: Generative UI Request & Variation Engine

### Files to Create

- `src/generative-ui/generative-engine.ts`
- `src/generative-ui/generative-engine.test.ts`

### Purpose

When a user requests a UI component (natural language, ASCII sketch, or screenshot reference), Nova26 generates the component code through MARS, reviews it through VENUS, and renders it in the preview. When `--variations N` is passed, N distinct design variants are generated and presented. This task creates the generation request/result lifecycle and the variation engine.

### Interfaces to Implement

All interfaces must be exported from `src/generative-ui/generative-engine.ts`:

```typescript
export type InputMode = 'natural-language' | 'ascii-sketch' | 'screenshot';
export type AgentName = string;  // e.g., 'MARS', 'VENUS', 'JUPITER'

export interface GenerativeUIRequest {
  id: string;
  description: string;
  inputMode: InputMode;
  screenshotPath?: string;
  asciiSketch?: string;
  variationsRequested: number;         // default: 1
  targetPath?: string;                 // where to write the component
  framework: string;
  projectId: string;
  requestedAt: string;
  requestedBy: 'human' | AgentName;
}

export interface GenerativeUIResult {
  requestId: string;
  variations: UIVariation[];
  selectedVariationId?: string;
  finalComponentPath?: string;
  generatedAt: string;
  generatedBy: AgentName;
  previewUrl: string;
  aceScore?: number;                   // ACE quality score 0-100
}

export interface UIVariation {
  id: string;
  description: string;                 // what distinguishes this variation
  componentCode: string;
  previewUrl: string;
  accessibility: {
    score: number;                     // 0-100
    issues: string[];
  };
  qualityScore: number;                // VENUS review score 0-100
}

export interface DecompositionPlan {
  requestId: string;
  components: Array<{
    name: string;
    description: string;
    targetPath: string;
    dependsOn: string[];               // names of other components in this plan
  }>;
  compositionStrategy: string;         // how to assemble the final page
  estimatedVariations: number;
}
```

Import `LivePreviewSession` from `./live-preview.js`.

### Class to Implement

```typescript
export class GenerativeUIEngine {
  constructor(
    generateFn: (description: string, framework: string) => Promise<string>,   // generates component code
    reviewFn: (code: string) => Promise<{ score: number; issues: string[] }>,   // VENUS review
    config?: { defaultVariations?: number; maxVariations?: number }
  );
}
```

The `generateFn` wraps the MARS agent code generation call. The `reviewFn` wraps the VENUS accessibility/quality review. Both are injected for testability.

Default config:
```typescript
{ defaultVariations: 1, maxVariations: 5 }
```

### Functions (all instance methods on `GenerativeUIEngine`)

1. **`createRequest(params: { description: string; inputMode: InputMode; framework: string; projectId: string; requestedBy: 'human' | AgentName; screenshotPath?: string; asciiSketch?: string; variationsRequested?: number; targetPath?: string }): GenerativeUIRequest`**
   - Generates UUID for `id`. Sets `requestedAt` to now.
   - Clamps `variationsRequested` between 1 and `maxVariations`.
   - Returns the request.

2. **`generate(request: GenerativeUIRequest): Promise<GenerativeUIResult>`**
   - Main entry point. For each variation (1 to `variationsRequested`):
     - Calls `generateFn(request.description + variation prompt suffix, request.framework)` to get component code.
     - Calls `reviewFn(code)` to get accessibility score and quality.
     - Creates a `UIVariation` with UUID, the code, accessibility data, and quality score.
   - Sets `generatedBy` to `'MARS'`.
   - Sets `previewUrl` to `http://localhost:5274/component/${request.id}`.
   - Returns `GenerativeUIResult` with `generatedAt` set to now.

3. **`selectVariation(result: GenerativeUIResult, variationId: string): GenerativeUIResult`**
   - Sets `selectedVariationId` on the result.
   - Sets `finalComponentPath` to the request's `targetPath`.
   - Throws if variationId not found in result's variations.
   - Returns updated result.

4. **`decompose(description: string, framework: string): DecompositionPlan`**
   - For complex UI requests (description > 200 chars or mentions "page", "dashboard", "form with"), creates a decomposition plan.
   - Splits into logical components (e.g., "user settings page" → Header, ProfileForm, NotificationSettings, DangerZone).
   - Returns the plan with dependency ordering.
   - For simple requests, returns a plan with a single component.

5. **`parseInputMode(input: { description?: string; screenshotPath?: string; asciiSketch?: string }): InputMode`**
   - If `screenshotPath` provided → 'screenshot'
   - If `asciiSketch` provided → 'ascii-sketch'
   - Otherwise → 'natural-language'

6. **`buildVariationPromptSuffix(variationIndex: number, totalVariations: number): string`**
   - Returns a prompt suffix that guides each variation to be distinct.
   - Variation 1: "Create the default, clean implementation."
   - Variation 2: "Create an alternative with a different layout approach."
   - Variation 3: "Create a minimal, compact version."
   - Variation 4+: "Create a unique design variant #{N} that differs significantly from previous variants."

### Required Tests (minimum 18)

Write these in `src/generative-ui/generative-engine.test.ts`:

1. **Creates request with defaults** — verify id, requestedAt, variationsRequested: 1.
2. **Creates request with custom variations** — 3 variations, verify.
3. **Clamps variations to max** — request 10 (max 5), verify clamped to 5.
4. **Generates single variation** — mock generateFn and reviewFn, verify 1 UIVariation returned.
5. **Generates multiple variations** — request 3, verify 3 UIVariations returned.
6. **Calls generateFn for each variation** — 3 variations, verify generateFn called 3 times.
7. **Calls reviewFn for each variation** — verify reviewFn called per variation.
8. **Sets generatedBy to MARS** — verify.
9. **Sets previewUrl correctly** — verify URL format.
10. **Sets generatedAt** — verify non-empty ISO string.
11. **Selects a variation** — verify selectedVariationId set.
12. **Select throws for invalid variationId** — expect error.
13. **Decomposes complex request** — "user settings page with profile and notifications", verify multiple components.
14. **Single component for simple request** — "a blue button", verify 1 component.
15. **Parses screenshot input mode** — screenshotPath set → 'screenshot'.
16. **Parses ascii-sketch input mode** — asciiSketch set → 'ascii-sketch'.
17. **Parses natural-language by default** — no screenshot/sketch → 'natural-language'.
18. **Variation prompt suffix differs per index** — verify variation 1 ≠ variation 2 suffix.
19. **Accessibility score stored on variation** — verify score and issues array present.
20. **Quality score stored on variation** — verify qualityScore number.

---

## KIMI-GENUI-03: Visual Feedback & DOM-Source Mapping

### Files to Create

- `src/generative-ui/visual-feedback.ts`
- `src/generative-ui/visual-feedback.test.ts`

### Purpose

After a UI is previewed, users provide visual feedback like "make the button bigger" or "change the sidebar to blue." Nova26 parses these natural language statements into structured changes, maps them back to source code via DOM-to-source annotations (`data-nova-source`), and applies the changes. This is the hardest and most innovative part of the system.

### Interfaces to Implement

All interfaces must be exported from `src/generative-ui/visual-feedback.ts`:

```typescript
export type FeedbackStatus = 'pending' | 'applied' | 'rejected' | 'ambiguous';
export type ChangeDirection = 'increase' | 'decrease' | 'change' | 'remove' | 'add';

export interface VisualFeedback {
  id: string;
  sessionId: string;
  rawStatement: string;                // what the user said
  parsedTarget: {
    elementDescription: string;        // e.g., "button in the top right"
    sourceFile?: string;               // resolved source file path
    sourceLine?: number;               // resolved line number
    domSelector?: string;              // CSS selector for the element
  };
  parsedChange: {
    attribute: string;                 // e.g., 'width', 'color', 'font-size'
    direction?: ChangeDirection;
    value?: string;                    // specific value if provided
  };
  confidence: number;                  // 0-1
  appliedAt?: string;
  codeDiff?: string;
  status: FeedbackStatus;
}

export interface SourceAnnotation {
  domSelector: string;
  sourceFile: string;
  sourceLine: number;
  componentName: string;
}

export interface FeedbackParseResult {
  target: VisualFeedback['parsedTarget'];
  change: VisualFeedback['parsedChange'];
  confidence: number;
}
```

### Class to Implement

```typescript
export class VisualFeedbackProcessor {
  constructor(
    parseFn: (statement: string) => Promise<FeedbackParseResult>,
    config?: { minConfidence?: number }
  );
}
```

The `parseFn` wraps an LLM call that parses natural language feedback into structured data. Injected for testability.

Default config:
```typescript
{ minConfidence: 0.5 }
```

### Functions (all instance methods on `VisualFeedbackProcessor`)

1. **`processFeedback(sessionId: string, rawStatement: string): Promise<VisualFeedback>`**
   - Generates UUID for `id`. Sets `status: 'pending'`.
   - Calls `parseFn(rawStatement)` to get parsed target and change.
   - If `confidence < minConfidence`: sets `status: 'ambiguous'`.
   - Stores feedback in internal `Map<string, VisualFeedback>`.
   - Returns the feedback.

2. **`resolveSourceMapping(feedback: VisualFeedback, annotations: SourceAnnotation[]): VisualFeedback`**
   - Given a list of source annotations from the preview DOM, finds the best match for `feedback.parsedTarget.elementDescription`.
   - Matching strategy: case-insensitive substring match of `elementDescription` against `annotation.componentName` or `annotation.domSelector`.
   - If match found: sets `sourceFile`, `sourceLine`, and `domSelector` on `parsedTarget`.
   - If no match found: leaves them undefined.
   - Returns updated feedback.

3. **`applyFeedback(feedbackId: string, codeDiff: string): VisualFeedback`**
   - Sets `status: 'applied'`, `appliedAt` to now, `codeDiff` to the provided diff.
   - Throws if feedback not found.
   - Returns updated feedback.

4. **`rejectFeedback(feedbackId: string, reason?: string): VisualFeedback`**
   - Sets `status: 'rejected'`.
   - Throws if feedback not found.

5. **`getFeedback(feedbackId: string): VisualFeedback | undefined`**
   - Returns feedback by ID.

6. **`getSessionFeedback(sessionId: string): VisualFeedback[]`**
   - Returns all feedback for a session, sorted by creation time (oldest first).

7. **`injectSourceAnnotations(htmlContent: string, mappings: SourceAnnotation[]): string`**
   - For each mapping, injects `data-nova-source="${sourceFile}:${sourceLine}"` into the matching HTML element.
   - Uses a simple regex-based approach: finds elements matching the `domSelector` and adds the attribute.
   - Returns the annotated HTML string.

8. **`extractAnnotations(htmlContent: string): SourceAnnotation[]`**
   - Parses HTML for all `data-nova-source` attributes.
   - Returns an array of `SourceAnnotation` objects parsed from the attribute values.

### Required Tests (minimum 18)

Write these in `src/generative-ui/visual-feedback.test.ts`:

1. **Processes feedback with parsed target and change** — mock parseFn, verify all fields set.
2. **Sets status pending for high confidence** — confidence 0.8 → 'pending'.
3. **Sets status ambiguous for low confidence** — confidence 0.3 → 'ambiguous'.
4. **Stores feedback in internal map** — process, then getFeedback returns it.
5. **Resolves source mapping with matching annotation** — elementDescription matches componentName, verify sourceFile/sourceLine set.
6. **No source mapping for unmatched element** — verify sourceFile undefined.
7. **Case-insensitive matching** — "Button" matches annotation "button", verify.
8. **Applies feedback with diff** — verify status 'applied', appliedAt set, codeDiff stored.
9. **Apply throws for non-existent feedback** — expect error.
10. **Rejects feedback** — verify status 'rejected'.
11. **Reject throws for non-existent feedback** — expect error.
12. **Gets feedback by ID** — verify round-trip.
13. **Returns undefined for non-existent ID** — verify.
14. **Gets session feedback sorted** — insert 3 feedbacks, verify order.
15. **Injects source annotations into HTML** — verify `data-nova-source` attribute added.
16. **Extracts annotations from HTML** — HTML with data-nova-source attrs, verify parsed correctly.
17. **Handles HTML without annotations** — verify empty array returned.
18. **Min confidence configurable** — set minConfidence to 0.8, confidence 0.6 → 'ambiguous'.

---

## KIMI-GENUI-04: Component Playground & Stress Testing

### Files to Create

- `src/generative-ui/component-playground.ts`
- `src/generative-ui/component-playground.test.ts`

### Purpose

The component playground isolates a single component with mock props, lets the user modify props interactively, and runs stress tests with extreme prop values. If the project uses Storybook, tested scenarios are exported as stories. This is the "lab environment" for component exploration.

### Interfaces to Implement

All interfaces must be exported from `src/generative-ui/component-playground.ts`:

```typescript
export type RenderStatus = 'ok' | 'error' | 'loading';
export type FailureType = 'layout-break' | 'error-boundary' | 'accessibility' | 'console-error';

export interface PropTypeInfo {
  name: string;
  type: string;                        // TypeScript type as string, e.g. 'string', 'number', 'boolean'
  currentValue: unknown;
  mockValues: unknown[];               // generated mock values for this prop
  required: boolean;
}

export interface ComponentPlayground {
  sessionId: string;
  componentPath: string;
  propTypes: PropTypeInfo[];
  activeProps: Record<string, unknown>;
  renderStatus: RenderStatus;
  stressTestResults?: StressTestResult[];
  storiesGenerated: boolean;
}

export interface StressTestResult {
  propCombination: Record<string, unknown>;
  passed: boolean;
  failureType?: FailureType;
  failureDescription?: string;
}

export interface StoryExport {
  componentName: string;
  storyFilePath: string;
  scenarios: Array<{
    name: string;
    props: Record<string, unknown>;
    description: string;
  }>;
}
```

### Class to Implement

```typescript
export class PlaygroundManager {
  constructor(
    propExtractorFn: (componentPath: string) => Promise<PropTypeInfo[]>,
    renderFn: (componentPath: string, props: Record<string, unknown>) => Promise<{ status: RenderStatus; error?: string }>,
    config?: { maxStressCombinations?: number }
  );
}
```

The `propExtractorFn` analyzes a component file and extracts its prop types. The `renderFn` renders a component with given props and reports the render status. Both injected for testability.

Default config:
```typescript
{ maxStressCombinations: 20 }
```

### Functions (all instance methods on `PlaygroundManager`)

1. **`startPlayground(componentPath: string): Promise<ComponentPlayground>`**
   - Generates UUID for `sessionId`.
   - Calls `propExtractorFn(componentPath)` to get prop types.
   - Generates initial `activeProps` from the first `mockValues` entry for each prop (or a sensible default based on type).
   - Calls `renderFn(componentPath, activeProps)` to get initial render status.
   - Creates and stores the playground.
   - Returns it.

2. **`setProp(sessionId: string, propName: string, value: unknown): Promise<ComponentPlayground>`**
   - Updates `activeProps[propName]` with the new value.
   - Calls `renderFn` with updated props to check render status.
   - Returns updated playground.
   - Throws if playground not found or propName not in propTypes.

3. **`runStressTest(sessionId: string): Promise<StressTestResult[]>`**
   - Generates extreme prop combinations:
     - For `string`: `''`, `'a'.repeat(10000)`, `undefined` (if not required)
     - For `number`: `0`, `-1`, `Number.MAX_SAFE_INTEGER`, `NaN` (if not required)
     - For `boolean`: `true`, `false`
     - For arrays: `[]`, `Array(1000).fill(null)`
   - Caps total combinations at `maxStressCombinations`.
   - For each combination, calls `renderFn`. Records pass/fail with failure type.
   - Stores results on the playground.
   - Returns results.

4. **`generateStorybook(sessionId: string): StoryExport`**
   - Uses the playground's prop types and any stress test results to generate Storybook story scenarios.
   - Creates: Default story (default props), Edge Case stories (from passing stress test combinations), Error stories (from failing stress tests, marked as expected failures).
   - Sets `storyFilePath` to `${componentPath.replace('.tsx', '.stories.tsx')}`.
   - Marks `storiesGenerated: true` on playground.
   - Returns the StoryExport.
   - Throws if playground not found.

5. **`getPlayground(sessionId: string): ComponentPlayground | undefined`**
   - Returns playground by session ID.

6. **`listPlaygrounds(): ComponentPlayground[]`**
   - Returns all playgrounds.

7. **`generateMockValue(type: string): unknown`**
   - Generates a sensible mock value for a TypeScript type string:
     - `'string'` → `'Sample text'`
     - `'number'` → `42`
     - `'boolean'` → `true`
     - `'string[]'` → `['item1', 'item2']`
     - `'unknown'` → `null`
     - Default → `null`

### Required Tests (minimum 18)

Write these in `src/generative-ui/component-playground.test.ts`:

1. **Starts playground with extracted props** — mock propExtractorFn returning 3 props, verify playground created.
2. **Generates initial activeProps from mock values** — verify each prop has a value.
3. **Calls renderFn on start** — verify renderFn called with componentPath and activeProps.
4. **Sets render status from renderFn result** — renderFn returns 'ok', verify.
5. **Sets prop and re-renders** — setProp, verify renderFn called again with updated props.
6. **Set prop throws for unknown prop** — expect error.
7. **Set prop throws for unknown session** — expect error.
8. **Runs stress test with string combinations** — string prop, verify '', long string tested.
9. **Runs stress test with number combinations** — number prop, verify 0, -1, MAX_SAFE_INTEGER tested.
10. **Caps stress combinations at max** — maxStressCombinations: 5, verify ≤ 5 results.
11. **Records failure in stress test** — renderFn returns error, verify failed: true and failureType set.
12. **Generates storybook export** — verify StoryExport with scenarios.
13. **Story file path derived from component path** — `.tsx` → `.stories.tsx`.
14. **Generates default story** — verify default props scenario.
15. **Marks storiesGenerated on playground** — verify true after generation.
16. **Gets playground by session ID** — verify round-trip.
17. **Returns undefined for non-existent session** — verify.
18. **Lists all playgrounds** — create 2, verify both in list.
19. **Generates mock value for string** — verify returns string.
20. **Generates mock value for number** — verify returns number.

---

## KIMI-GENUI-05: Living Canvas, Integration & Wiring

### Files to Modify

- `src/orchestrator/ralph-loop.ts` — **ADD** two new fields to `RalphLoopOptions`

### Files to Create

- `src/generative-ui/canvas.ts`
- `src/generative-ui/canvas.test.ts`
- `src/generative-ui/index.ts`
- `src/generative-ui/index.test.ts`

### Purpose

The Living Canvas is the mode of interaction when live preview and generative UI are both active. It maintains state across interactions so the user can close and reopen the canvas without losing context. This task creates the canvas state manager, the barrel export, and wires the system into the Ralph Loop.

### Interfaces to Implement

All interfaces must be exported from `src/generative-ui/canvas.ts`:

```typescript
export type CanvasStatus = 'active' | 'paused' | 'closed';

export interface CanvasState {
  sessionId: string;
  projectId: string;
  activeComponents: string[];          // component paths currently in the canvas
  feedbackHistory: string[];           // feedback IDs (references to VisualFeedback objects)
  variationHistory: string[];          // GenerativeUIResult request IDs
  previewUrl: string;
  lastInteractionAt: string;
  status: CanvasStatus;
  canvasStartedAt: string;
  totalInteractions: number;
}

export interface CanvasCommand {
  type: 'generate' | 'feedback' | 'select-variation' | 'playground' | 'stress-test' | 'stop';
  payload: Record<string, unknown>;
}

export interface CanvasCommandResult {
  command: CanvasCommand;
  success: boolean;
  message: string;
  data?: unknown;
}
```

Import from `./live-preview.js`, `./generative-engine.js`, `./visual-feedback.js`, `./component-playground.js`.

### Class to Implement

```typescript
export class LivingCanvas {
  constructor(
    previewManager: LivePreviewSessionManager,
    engine: GenerativeUIEngine,
    feedbackProcessor: VisualFeedbackProcessor,
    playgroundManager: PlaygroundManager
  );
}
```

### Functions (all instance methods on `LivingCanvas`)

1. **`startCanvas(projectId: string): CanvasState`**
   - Creates a new canvas state. Generates UUID for `sessionId`.
   - Creates a live preview session via `previewManager.createSession()`.
   - Sets `previewUrl` from the session, `status: 'active'`, timestamps to now, `totalInteractions: 0`.
   - Stores internally. Returns the state.

2. **`resumeCanvas(sessionId: string): CanvasState`**
   - Loads a previously saved canvas state. Sets `status: 'active'`, updates `lastInteractionAt`.
   - Throws if canvas not found.

3. **`processCommand(sessionId: string, command: CanvasCommand): Promise<CanvasCommandResult>`**
   - Routes commands to the appropriate subsystem:
     - `'generate'` → calls `engine.createRequest()` then `engine.generate()`
     - `'feedback'` → calls `feedbackProcessor.processFeedback()`
     - `'select-variation'` → calls `engine.selectVariation()`
     - `'playground'` → calls `playgroundManager.startPlayground()`
     - `'stress-test'` → calls `playgroundManager.runStressTest()`
     - `'stop'` → calls `stopCanvas()`
   - Increments `totalInteractions`. Updates `lastInteractionAt`.
   - Returns `CanvasCommandResult` with success/failure and relevant data.

4. **`pauseCanvas(sessionId: string): CanvasState`**
   - Sets `status: 'paused'`. Canvas state is preserved.
   - Throws if not found.

5. **`stopCanvas(sessionId: string): CanvasState`**
   - Sets `status: 'closed'`. Stops the preview session.
   - Returns final state.
   - Throws if not found.

6. **`getState(sessionId: string): CanvasState | undefined`**
   - Returns canvas state by session ID.

7. **`saveState(sessionId: string): string`**
   - Serializes canvas state to JSON string for persistence.
   - Throws if not found.

8. **`loadState(json: string): CanvasState`**
   - Deserializes and stores canvas state from JSON string.
   - Validates with zod. Throws on invalid data.

### Modification to `src/orchestrator/ralph-loop.ts`

Add these two lines to the `RalphLoopOptions` interface, **after** the agent memory fields (after `memoryConfig`):

```typescript
  // Generative UI & Live Preview (R16-03)
  livePreviewEnabled?: boolean;
  livePreviewConfig?: LivePreviewConfig;
```

Add the import at the top of the file:

```typescript
import type { LivePreviewConfig } from '../generative-ui/live-preview.js';
```

**That is the ONLY change to ralph-loop.ts.** Do not modify any functions.

### Barrel Export: `src/generative-ui/index.ts`

Create a barrel export that re-exports from all new modules:

```typescript
export * from './live-preview.js';
export * from './generative-engine.js';
export * from './visual-feedback.js';
export * from './component-playground.js';
export * from './canvas.js';
```

### Integration Tests: `src/generative-ui/index.test.ts`

### Required Tests (minimum 16)

**Canvas tests** in `src/generative-ui/canvas.test.ts`:

1. **Starts canvas with correct initial state** — verify sessionId, status 'active', totalInteractions 0.
2. **Resume updates status to active** — pause then resume, verify 'active'.
3. **Resume throws for non-existent session** — expect error.
4. **Processes generate command** — verify engine.createRequest and engine.generate called.
5. **Processes feedback command** — verify feedbackProcessor.processFeedback called.
6. **Processes stop command** — verify status 'closed'.
7. **Increments totalInteractions** — process 3 commands, verify count is 3.
8. **Updates lastInteractionAt on each command** — verify timestamp changes.
9. **Pauses canvas** — verify status 'paused'.
10. **Stops canvas** — verify status 'closed'.
11. **Gets state by session ID** — verify round-trip.
12. **Saves state to JSON** — verify valid JSON string.
13. **Loads state from JSON** — save then load, verify match.
14. **Load throws on invalid JSON** — expect error.

**Integration tests** in `src/generative-ui/index.test.ts`:

15. **Barrel export exposes all key types** — import LivePreviewSessionManager, GenerativeUIEngine, VisualFeedbackProcessor, PlaygroundManager, LivingCanvas from index, verify defined.
16. **LivePreviewConfig type is assignable to RalphLoopOptions.livePreviewConfig** — verify type compatibility.

---

## Final Checklist

After completing all 5 tasks, verify:

```bash
npx tsc --noEmit        # 0 errors
npx vitest run           # 1901+ tests (target: 90+ new = 1991+)
```

New files created:
- `src/generative-ui/live-preview.ts`
- `src/generative-ui/live-preview.test.ts`
- `src/generative-ui/generative-engine.ts`
- `src/generative-ui/generative-engine.test.ts`
- `src/generative-ui/visual-feedback.ts`
- `src/generative-ui/visual-feedback.test.ts`
- `src/generative-ui/component-playground.ts`
- `src/generative-ui/component-playground.test.ts`
- `src/generative-ui/canvas.ts`
- `src/generative-ui/canvas.test.ts`
- `src/generative-ui/index.ts`
- `src/generative-ui/index.test.ts`

Modified files:
- `src/orchestrator/ralph-loop.ts` (2 new fields + 1 import only)
