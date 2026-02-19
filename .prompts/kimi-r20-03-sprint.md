# Kimi Sprint: R20-03 AI-Native Design Pipeline
## 1 Task | 82+ Tests | TypeScript Strict | ESM `.js` Imports

> **Pre-requisite**: R19 sprint complete, R20-01/R20-02 ideally complete.
> **Repo**: https://github.com/nelsen3000/nova26
> **Branch**: `main` (or feature branch if preferred)
> **Rules**: TypeScript strict, ESM `.js` imports, vitest, no `any`, mock all I/O, no real API calls

---

## Task 1: KIMI-R20-03 — AI-Native Design Pipeline

**Spec**: `.nova/specs/grok-r20-03-design-pipeline.md`
**Tests**: 82 vitest cases minimum

### What to Build

Create `src/design-pipeline/` module for full UI flow generation from natural language.

```
src/design-pipeline/
├── index.ts
├── types.ts
├── pipeline-core.ts               ← main orchestrator
├── journey-generator.ts           ← multi-screen flow + connections
├── variant-generator.ts           ← A/B 3-variant engine
├── screenshot-reverse.ts          ← vision → ScreenSpec (mock vision model)
├── token-extractor.ts             ← Taste Vault + brand → DesignSystemConfig
├── responsive-engine.ts           ← mobile-first + tablet + desktop breakpoints
├── living-canvas-renderer.ts      ← render DesignFlow as interactive prototype
├── __tests__/pipeline.test.ts
└── assets/                        ← example journeys for golden set
```

### Key Interfaces to Implement

```typescript
export interface DesignPipelineConfig {
  enabled: boolean;
  defaultVariants: 1 | 2 | 3 | 5;
  maxScreensPerJourney: number;
  responsivePresets: ('mobile-first' | 'tablet' | 'desktop')[];
  visionModel: 'local-llava' | 'grok-vision' | 'perplexity-sonar-vision';
  tasteVaultInfluence: number; // 0-1
  autoDreamModePreview: boolean;
  maxTokensPerGeneration: number;
}

export interface DesignFlow {
  id: string;
  name: string;
  description: string;
  screens: ScreenSpec[];
  connections: Array<{ fromScreenId: string; toScreenId: string; trigger: string }>;
  journeyType: 'auth' | 'onboarding' | 'core' | 'launch' | 'custom';
  semanticTags: string[];
  generatedAt: string;
  variantParentId?: string;
}

export interface ScreenSpec {
  id: string;
  name: string;
  description: string;
  layout: 'stack' | 'grid' | 'scroll' | 'modal';
  components: ComponentSpec[];
  designTokens: DesignToken[];
  responsiveBreakpoints: Record<'mobile' | 'tablet' | 'desktop', { width: number; height: number }>;
  accessibility: { ariaLabels: Record<string, string>; contrastRatio: number };
  dreamModeReady: boolean;
}

export interface ComponentSpec {
  id: string;
  type: 'button' | 'card' | 'swipeable' | 'chat' | 'gallery' | 'timeline' | 'custom';
  props: Record<string, unknown>;
  children: ComponentSpec[];
  position: { x: number; y: number; zIndex: number };
  animation: { type: string; durationMs: number; easing: string };
  tasteVaultTags: string[];
}

export interface DesignToken {
  id: string;
  category: 'color' | 'typography' | 'spacing' | 'radius' | 'shadow' | 'motion';
  name: string;
  value: string | number | { light: string; dark: string };
  source: 'taste-vault' | 'brand-upload' | 'hall-of-fame' | 'manual';
  confidence: number;
}

export interface DesignSystemConfig {
  name: string;
  tokens: DesignToken[];
  baseFont: string;
  colorPalette: { primary: string; accent: string; background: { light: string; dark: string } };
  spacingScale: number[];
  motionCurve: string;
  derivedFromTasteVault: boolean;
}
```

### RalphLoopOptions Addition

```typescript
designPipelineEnabled?: boolean;
designPipelineConfig?: {
  defaultVariants: 1 | 2 | 3 | 5;
  tasteVaultInfluence: number;
  autoPreviewInDreamMode: boolean;
};
```

### Key Implementation Notes

- **Pipeline Core**: Orchestrates prompt → journey → variants → responsive → preview
- **Journey Generator**: Multi-screen flows with connection graph (navigation triggers)
- **Variant Generator**: Generate N variants of same flow, each with different Taste Vault emphasis
- **Screenshot Reverse**: Accept image → analyze → produce ScreenSpec (mock vision model in tests)
- **Token Extractor**: Pull tokens from Taste Vault + brand uploads → DesignSystemConfig
- **Responsive Engine**: Apply mobile-first → tablet → desktop breakpoints to each ScreenSpec
- **Living Canvas Renderer**: Convert DesignFlow to interactive prototype representation
- **Integration**: VENUS (codegen), EUROPA (polish), ATLAS (GraphMemory), Taste Vault, Dream Mode

### Test Requirements (82 cases)

- End-to-end prompt → 3-variant DesignFlow generation
- Screenshot reverse engineering accuracy (mock vision responses)
- Taste Vault influence regression (same prompt, different history → different tokens)
- Responsive breakpoint fidelity across 6 device presets
- A/B variant consistency + connection graph integrity
- Token extraction from brand config + manual overrides
- Journey type generation (auth, onboarding, core, launch, custom)
- DesignSystemConfig derivation from Taste Vault
- Component tree nesting + animation configuration
- Performance: <25 sec for full journey (mocked)

---

## Final Checklist

After implementing:
1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → all tests pass (target: 82+ new tests)
3. Barrel exports in `index.ts`
4. No `any` types (use `unknown` + type guards)
5. All I/O mocked (especially vision model calls)
6. ESM `.js` imports throughout
