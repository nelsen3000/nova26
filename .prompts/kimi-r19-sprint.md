# Kimi Sprint: R19 Feature Implementation
## 3 Tasks | 204+ Tests | TypeScript Strict | ESM `.js` Imports

> **Pre-requisite**: Mega Wiring Sprint (KIMI-W-01→W-05) must be complete first.
> **Repo**: https://github.com/nelsen3000/nova26
> **Branch**: `main` (or feature branch if preferred)
> **Rules**: TypeScript strict, ESM `.js` imports, vitest, no `any`, mock all I/O, no real API calls

---

## Task 1: KIMI-R19-01 — Mobile Launch Stage

**Spec**: `.nova/specs/grok-r19-01-mobile-launch.md`
**Tests**: 42 vitest cases minimum

### What to Build

Create `src/mobile-launch/` with these files:

```
src/mobile-launch/
├── index.ts                  ← public exports
├── types.ts                  ← MobileLaunchProfile, AssetGenPipeline, ASOOptimizer, MobileLaunchResult
├── launch-ramp.ts            ← main pipeline orchestrating asset gen → ASO → EAS → rehearsal
├── asset-pipeline.ts         ← icon generation (sizes + styles), splash screens (dark mode, animated), screenshots
├── aso-optimizer.ts          ← keyword extraction, subtitle/description gen, category suggestion, projected score
├── eas-wrapper.ts            ← Expo Application Services wrapper with Taste Vault layer
├── rehearsal-stage.ts        ← Dream Mode → real device capture simulation
└── __tests__/
    ├── launch-ramp.test.ts
    ├── asset-pipeline.test.ts
    ├── aso-optimizer.test.ts
    ├── eas-wrapper.test.ts
    └── rehearsal-stage.test.ts
```

### Key Interfaces (from spec)

```typescript
// types.ts
export interface MobileLaunchProfile {
  id: string;
  name: 'development' | 'preview' | 'production';
  platforms: ('ios' | 'android')[];
  easConfig: Record<string, unknown>;
  tasteVaultWeight: number; // 0-1
  aso: ASOOptimizer;
  rehearsalStage: boolean;
}

export interface AssetGenPipeline {
  icon: { sizes: number[]; style: string };
  splash: { darkMode: boolean; animated: boolean };
  screenshots: { count: number; devices: string[]; captionStyle: string };
  generatorModel: string;
}

export interface ASOOptimizer {
  keywords: string[];
  subtitle: string;
  description: string;
  suggestedCategories: string[];
  projectedScore: number; // 0-100
  locale: string;
}

export interface MobileLaunchResult {
  buildId: string;
  status: 'success' | 'failed' | 'pending';
  testflightLink?: string;
  playStoreLink?: string;
  assetGalleryUrl?: string;
  rehearsalVideoUrl?: string;
}
```

### RalphLoopOptions Addition

Add to `src/orchestrator/ralph-loop.ts` `RalphLoopOptions`:
```typescript
mobileLaunch?: {
  enabled: boolean;
  defaultProfile: 'development' | 'preview' | 'production';
  tasteVaultInfluence: number;
  perplexityWeight: number;
};
```

### Integration Points
- Import and wire into ralph-loop.ts RalphLoopOptions
- Venus agent: mobile Director's Booth + asset generation
- ATLAS: Taste Vault + semantic model pull
- Mercury: quality gate before submit

### Test Requirements (42 minimum)
- launch-ramp: full pipeline (7 tests) — happy path, missing profile, platform-specific, rehearsal on/off
- asset-pipeline: icon gen (5), splash gen (4), screenshot gen (4) — sizes, dark mode, device matrix
- aso-optimizer: keyword extraction (4), scoring (3), locale handling (3) — empty input, duplicate keywords
- eas-wrapper: config generation (4), taste vault layer (3), error handling (3)
- rehearsal-stage: capture flow (3), dream mode (2) — disabled flag, empty project

---

## Task 2: KIMI-R19-02 — Deep Project Semantic Model

**Spec**: `.nova/specs/grok-r19-02-semantic-model.md`
**Tests**: 68 vitest cases minimum

### What to Build

Create/extend `src/atlas/` with these files:

```
src/atlas/
├── semantic-model.ts         ← core CodeGraph class + ts-morph refresh
├── impact-analyzer.ts        ← queryWhatDependsOn, queryImpactRadius, riskLevel scoring
├── semantic-differ.ts        ← PR intent summarization, suspicious pattern detection
├── context-compactor.ts      ← token-budgeted context for agents
├── graph-memory.ts           ← Convex + local sqlite sync
├── types.ts                  ← CodeNode, CodeEdge, CodeGraph, ImpactAnalysisResult, etc.
└── __tests__/
    ├── semantic-model.test.ts
    ├── impact-analyzer.test.ts
    ├── semantic-differ.test.ts
    ├── context-compactor.test.ts
    └── graph-memory.test.ts
```

### Key Interfaces (from spec)

```typescript
export interface SemanticModelConfig {
  analysisDepth: 'shallow' | 'standard' | 'deep';
  updateStrategy: 'on-change' | 'periodic' | 'manual';
  cacheLocation: string;
  maxCacheSizeMB: number;
  tsMorphProjectRoot: string;
  enableContextCompaction: boolean;
  compactionTokenBudget: number;
  semanticTagSources: string[];
  refreshIntervalMinutes: number;
}

export interface CodeNode {
  id: string;
  type: 'file' | 'function' | 'class' | 'interface' | 'type' | 'export' | 'component' | 'hook' | 'page';
  name: string;
  filePath: string;
  location: { line: number; column: number };
  complexity: number;
  changeFrequency: number;
  testCoverage: number;
  semanticTags: string[];
  dependents: string[];
}

export interface CodeEdge {
  fromId: string;
  toId: string;
  type: 'imports' | 'calls' | 'extends' | 'implements' | 'uses-type' | 'renders' | 'depends-on';
  weight: number;
}

export interface ImpactAnalysisResult {
  changedNode: CodeNode;
  affectedNodes: CodeNode[];
  affectedFiles: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  visualization: string; // Mermaid diagram
  suggestedTests: string[];
}

export interface SemanticDiffSummary {
  prIntent: string;
  groupedChanges: Array<{ category: string; files: string[]; summary: string }>;
  suspiciousPatterns: string[];
  overallConfidence: number;
  safeToMerge: boolean;
  humanReadableReport: string;
}

export interface CompactedContext {
  projectSummary: string;
  relevantModules: Array<{ name: string; purpose: string; keyExports: string[] }>;
  keyPatterns: string[];
  tokenCount: number;
  expand: (moduleName: string) => string;
}
```

### RalphLoopOptions Addition

```typescript
semanticModel?: SemanticModelConfig;
```

### Integration Points
- Wire into ralph-loop.ts — agents receive `atlas.getSemanticSnapshot(task)` before work
- ATLAS: full graph for retrospectives + pattern mining
- MERCURY: auto-runs ImpactAnalysis on every PR
- Replaces/enhances `src/dependency-analysis/`

### Test Requirements (68 minimum)
- semantic-model: CodeGraph CRUD (8), ts-morph refresh mock (6), query methods (8) — empty graph, circular deps
- impact-analyzer: impact radius (6), risk scoring (5), visualization (4), suggested tests (3) — isolated node, deep chain
- semantic-differ: PR intent (5), grouping (4), suspicious patterns (4), safeToMerge (3) — empty diff, huge diff
- context-compactor: budget enforcement (4), expand (3), relevance ranking (4) — over-budget, no relevant modules
- graph-memory: local write/read (4), sync mock (4) — conflict handling, empty graph, corrupted cache

---

## Task 3: KIMI-R19-03 — Studio Rules + DSPy Prompt Optimization

**Spec**: `.nova/specs/grok-r19-03-studio-rules.md`
**Tests**: 94 vitest cases minimum

### What to Build

Create two new directories:

```
src/studio-rules/
├── index.ts                  ← public exports
├── types.ts                  ← StudioRule, StudioRulesConfig, OptimizationObjective
├── rule-engine.ts            ← enforcement (warn/block/auto-fix) + agent prompt injection
├── taste-vault-learner.ts    ← correction → rule extraction → clustering → decay
└── __tests__/
    ├── rule-engine.test.ts
    └── taste-vault-learner.test.ts

src/optimization/
├── index.ts                  ← public exports
├── prompt-optimizer.ts       ← DSPy-inspired core: bayesian/genetic/hill-climbing
├── eval-pipeline.ts          ← golden set evaluation, regression detection, CI hook
├── golden-sets.ts            ← golden set management (load, validate, extend)
├── optimizers/
│   ├── bayesian.ts
│   ├── genetic.ts
│   └── hill-climbing.ts
└── __tests__/
    ├── prompt-optimizer.test.ts
    ├── eval-pipeline.test.ts
    ├── golden-sets.test.ts
    └── optimizers.test.ts
```

### Key Interfaces (from spec)

```typescript
// studio-rules/types.ts
export interface StudioRulesConfig {
  rules: StudioRule[];
  enforcement: 'warn' | 'block' | 'auto-fix';
  ruleSource: string;
  optimizationEnabled: boolean;
  optimizationSchedule: string; // cron
  maxRulesPerCategory: number;
  decayEnabled: boolean;
  tasteVaultInfluence: number;
}

export interface StudioRule {
  id: string;
  name: string;
  description: string;
  category: 'code-style' | 'security' | 'architecture' | 'ux' | 'taste-vault' | 'cinematic' | 'wellbeing';
  condition: string; // rule matching expression
  action: 'require' | 'forbid' | 'prefer' | 'style-guide';
  examples: { good: string; bad: string; explanation: string };
  scope: { agents: string[]; filePatterns: string[]; r16Features: string[] };
  confidence: number;
  source: string;
  decayScore: number;
}

// optimization/types.ts
export interface OptimizationObjective {
  agentTemplateId: string;
  goldenSet: Array<{ input: string; expectedOutput: string; weight: number }>;
  scorers: Array<{ name: string; fn: (output: string, expected: string) => number }>;
  weights: number[];
}

export interface OptimizeResult {
  optimizedSystemPrompt: string;
  optimizedFewShot: Array<{ input: string; output: string }>;
  improvementPercent: number;
  trace: Array<{ iteration: number; score: number; mutation: string }>;
}
```

### RalphLoopOptions Addition

```typescript
studioRules?: StudioRulesConfig;
```

### Integration Points
- Wire into ralph-loop.ts — `{{studioRules}}` injected into agent system prompts at runtime
- PromptOptimizer uses ATLAS retrospective data as training signal
- EvalPipeline hooks into MERCURY + SATURN, blocks >5% regressions
- TasteVault: correction → rule → optimize → all agents improved

### Test Requirements (94 minimum)
- rule-engine: enforcement modes (8), prompt injection (6), scope filtering (5), rule matching (6) — empty rules, conflicting rules, all-agents scope
- taste-vault-learner: extraction (5), clustering (4), decay (4), confirmation flow (3) — no corrections, duplicate rules
- prompt-optimizer: bayesian (6), genetic (6), hill-climbing (6), budget enforcement (3) — zero improvement, over-budget
- eval-pipeline: golden set run (5), regression detection (4), CI hook mock (3), threshold blocking (3)
- golden-sets: load (3), validate (3), extend (3) — empty set, corrupted file, duplicate entries
- optimizers (unit): bayesian mutation (4), genetic crossover (4), hill-climbing step (4) — convergence, degenerate cases

---

## Completion Checklist

After all 3 tasks:

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → all tests pass (204+ new tests)
3. All new imports use `.js` ESM extensions
4. No `any` types anywhere
5. All I/O mocked (no real API calls, no real file system, no real Expo/ts-morph)
6. ralph-loop.ts has 3 new config fields: `mobileLaunch`, `semanticModel`, `studioRules`

Report output to Jon when complete.
