# Feature Lifecycle Wiring

## Source
Extracted from Nova26 `src/orchestrator/lifecycle-wiring.ts`

---

## Pattern: Feature Lifecycle Wiring

The lifecycle wiring system connects 13 feature modules to the HookRegistry using a declarative configuration map (DEFAULT_FEATURE_HOOKS). Each feature declares which lifecycle phases it participates in and at what priority. The `wireFeatureHooks()` function reads RalphLoopOptions flags, and for every enabled feature, registers its hooks into the HookRegistry at the configured priority. A companion `getWiringSummary()` function provides diagnostics showing which features would be wired, skipped, or are unknown -- useful for debugging and dry-run inspection.

---

## Implementation

### Code Example

```typescript
import type { HookRegistry } from './lifecycle-hooks.js';
import type { RalphLoopOptions } from './ralph-loop-types.js';

export interface FeatureHookConfig {
  moduleName: string;
  phases: {
    onBeforeBuild?: boolean;
    onBeforeTask?: boolean;
    onAfterTask?: boolean;
    onTaskError?: boolean;
    onHandoff?: boolean;
    onBuildComplete?: boolean;
  };
  priority: number;
}

// 13 features mapped to lifecycle phases with priority ordering
export const DEFAULT_FEATURE_HOOKS: Record<string, FeatureHookConfig> = {
  environment:          { moduleName: 'environment',          phases: { onBeforeBuild: true },                                    priority: 10  },
  debug:                { moduleName: 'debug',                phases: { onTaskError: true },                                      priority: 20  },
  orchestration:        { moduleName: 'orchestration',        phases: { onHandoff: true, onBeforeTask: true },                    priority: 25  },
  health:               { moduleName: 'health',               phases: { onBeforeBuild: true, onBuildComplete: true },              priority: 30  },
  autonomousTesting:    { moduleName: 'autonomous-testing',   phases: { onAfterTask: true, onTaskError: true, onBuildComplete: true }, priority: 40 },
  portfolio:            { moduleName: 'portfolio',            phases: { onBeforeBuild: true, onBuildComplete: true },              priority: 50  },
  accessibility:        { moduleName: 'accessibility',        phases: { onAfterTask: true, onBuildComplete: true },                priority: 55  },
  generativeUI:         { moduleName: 'generative-ui',        phases: { onBeforeBuild: true, onAfterTask: true },                  priority: 60  },
  codeReview:           { moduleName: 'code-review',          phases: { onAfterTask: true, onBuildComplete: true },                priority: 70  },
  migration:            { moduleName: 'migration',            phases: { onBeforeBuild: true, onAfterTask: true },                  priority: 80  },
  debt:                 { moduleName: 'debt',                 phases: { onBeforeBuild: true, onBuildComplete: true },              priority: 90  },
  dependencyManagement: { moduleName: 'dependency-management', phases: { onBeforeBuild: true },                                   priority: 100 },
  productionFeedback:   { moduleName: 'production-feedback',  phases: { onBuildComplete: true },                                  priority: 110 },
};
```

```typescript
// Main wiring function — reads options flags, registers hooks for enabled features
export function wireFeatureHooks(
  registry: HookRegistry,
  options: RalphLoopOptions
): {
  wiredCount: number;
  skippedCount: number;
  totalHooks: number;
  featuresWired: string[];
} {
  const featuresWired: string[] = [];
  let totalHooks = 0;

  // Map RalphLoopOptions boolean flags to feature names
  const featureFlags: Record<string, boolean | undefined> = {
    portfolio: options.portfolioEnabled,
    generativeUI: options.generativeUIEnabled,
    autonomousTesting: options.autonomousTestingEnabled,
    codeReview: options.codeReviewEnabled,
    migration: options.migrationEnabled,
    debug: options.debugEngineEnabled,
    accessibility: options.accessibilityEnabled,
    debt: options.debtScoringEnabled,
    dependencyManagement: options.dependencyManagementEnabled,
    productionFeedback: options.productionFeedbackEnabled,
    health: options.healthDashboardEnabled,
    environment: options.envManagementEnabled,
    orchestration: options.orchestrationOptimizationEnabled,
  };

  for (const [featureName, enabled] of Object.entries(featureFlags)) {
    if (!enabled) continue;

    const config = DEFAULT_FEATURE_HOOKS[featureName];
    if (!config) continue;

    // Wire each enabled phase
    for (const [phase, phaseEnabled] of Object.entries(config.phases)) {
      if (!phaseEnabled) continue;

      registry.register({
        phase: phase as 'onBeforeBuild' | 'onBeforeTask' | 'onAfterTask' | 'onTaskError' | 'onHandoff' | 'onBuildComplete',
        moduleName: config.moduleName,
        priority: config.priority,
        handler: async (): Promise<void> => {
          // Stub — actual feature modules would be called here
        },
      });

      totalHooks++;
    }

    featuresWired.push(featureName);
  }

  const skippedCount = Object.keys(featureFlags).length - featuresWired.length;

  return { wiredCount: featuresWired.length, skippedCount, totalHooks, featuresWired };
}
```

```typescript
// FeatureLifecycleRegistry — runtime registration with enable/disable tracking
export class FeatureLifecycleRegistry {
  private features: Map<string, RegisteredFeature> = new Map();

  register(
    name: string,
    enabled: boolean,
    handlers: FeatureLifecycleHandlers,
    config: FeatureHookConfig = DEFAULT_FEATURE_HOOKS[name]
  ): void {
    this.features.set(name, {
      name,
      enabled,
      handlers,
      config: config ?? DEFAULT_FEATURE_HOOKS[name] ?? {
        moduleName: name,
        phases: {},
        priority: 100,
      },
    });
  }

  getEnabledFeatures(): RegisteredFeature[] {
    return Array.from(this.features.values()).filter(f => f.enabled);
  }
}
```

```typescript
// Diagnostics — dry-run to see what would be wired without actually registering
export function getWiringSummary(options: RalphLoopOptions): {
  wouldWire: string[];
  wouldSkip: string[];
  unknown: string[];
} {
  const wouldWire: string[] = [];
  const wouldSkip: string[] = [];
  const unknown: string[] = [];

  for (const [featureName, enabled] of Object.entries(featureFlags)) {
    if (enabled) {
      if (DEFAULT_FEATURE_HOOKS[featureName]) {
        wouldWire.push(featureName);
      } else {
        unknown.push(featureName);
      }
    } else {
      wouldSkip.push(featureName);
    }
  }

  return { wouldWire, wouldSkip, unknown };
}
```

### Key Concepts

- Declarative configuration: each feature declares its phases and priority in DEFAULT_FEATURE_HOOKS, not scattered through code
- Priority ordering across features: environment (10) always runs before debug (20), which runs before orchestration (25), and so on up to productionFeedback (110)
- Feature flag gating: wireFeatureHooks only registers hooks for features whose RalphLoopOptions flag is truthy
- Diagnostics without side effects: getWiringSummary lets you inspect wiring decisions without registering any hooks
- Graceful fallback: if a feature name has no entry in DEFAULT_FEATURE_HOOKS, it is silently skipped (not an error)

---

## Anti-Patterns

### Don't Do This

```typescript
// Imperative wiring — scattered, no single source of truth
if (options.portfolioEnabled) {
  registry.register({ phase: 'onBeforeBuild', moduleName: 'portfolio', priority: 50, handler });
  registry.register({ phase: 'onBuildComplete', moduleName: 'portfolio', priority: 50, handler });
}
if (options.debugEngineEnabled) {
  registry.register({ phase: 'onTaskError', moduleName: 'debug', priority: 20, handler });
}
// Repeat for each of 13 features... hard to audit, easy to get priorities wrong

// No diagnostics — can't inspect what was wired without checking the registry
// Missing: getWiringSummary() for dry-run introspection

// Hard-coded priorities without a visible ordering table
// Priority numbers sprinkled across 13 separate if-blocks
```

### Do This Instead

```typescript
// Declarative config map — single source of truth for all 13 features
const DEFAULT_FEATURE_HOOKS: Record<string, FeatureHookConfig> = {
  environment: { moduleName: 'environment', phases: { onBeforeBuild: true }, priority: 10 },
  debug:       { moduleName: 'debug',       phases: { onTaskError: true },   priority: 20 },
  // ... all 13 features in one scannable table
};

// One loop to wire them all
for (const [featureName, enabled] of Object.entries(featureFlags)) {
  if (!enabled) continue;
  const config = DEFAULT_FEATURE_HOOKS[featureName];
  if (!config) continue;
  for (const [phase, phaseEnabled] of Object.entries(config.phases)) {
    if (!phaseEnabled) continue;
    registry.register({ phase, moduleName: config.moduleName, priority: config.priority, handler });
  }
}

// Diagnostics for debugging
const summary = getWiringSummary(options);
console.log('Would wire:', summary.wouldWire);
console.log('Would skip:', summary.wouldSkip);
```

---

## When to Use This Pattern

**Use for:**
- Systems with many feature modules that need opt-in registration into a shared hook pipeline
- Configuration-driven architectures where feature enablement is controlled by runtime flags
- Situations requiring an auditable, scannable priority table instead of scattered registration calls

**Don't use for:**
- Simple systems with fewer than 3-4 features where a declarative config map adds unnecessary indirection
- Systems where features are always-on and don't need flag-gated registration

---

## Benefits

1. Single source of truth -- all 13 features, their phases, and their priorities are visible in one `DEFAULT_FEATURE_HOOKS` table
2. Auditable priority ordering -- the full execution order is readable at a glance without tracing through code
3. Flag-gated registration -- disabled features pay zero runtime cost (no hooks registered)
4. Diagnostics built in -- `getWiringSummary()` enables dry-run inspection and debugging without side effects
5. Extensible -- adding a new feature is one entry in the config map plus one boolean flag in RalphLoopOptions

---

## Related Patterns

- See `lifecycle-hook-registry.md` for the HookRegistry that this wiring system registers hooks into
- See `ralph-loop-execution.md` for the main loop that calls `wireFeatureHooks()` during initialization
- See `agent-schema-registry.md` for a similar registry pattern applied to agent schemas
- See `gate-runner-pipeline.md` for the gate validation pipeline that runs alongside lifecycle hooks

---

*Extracted: 2026-02-19*
