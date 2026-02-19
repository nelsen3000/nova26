# Pre-Sprint Analysis - Mega-Wiring Sprint

## Current State (Pre-Sprint)

### Test Count
- **Current:** 2,642 tests passing
- **Target:** 2,800+ tests (160+ new)

### Module Wiring Status

#### Currently Wired in ralph-loop.ts
1. ✅ task-picker.js
2. ✅ prompt-builder.js
3. ✅ gate-runner.js
4. ✅ council-runner.js
5. ✅ ollama-client.js
6. ✅ structured-output.js
7. ✅ observability/index.js
8. ✅ parallel-runner.js
9. ✅ event-store.js
10. ✅ memory/session-memory.js
11. ✅ git/workflow.js
12. ✅ cost/cost-tracker.js
13. ✅ analytics/agent-analytics.js
14. ✅ convex/sync.js
15. ✅ agent-loop/agent-loop.js
16. ✅ tools/tool-registry.js

#### R17 Modules NOT Yet Wired (To Be Added)
1. ⚠️ review/pr-intelligence.js
2. ⚠️ migrate/framework-migrator.js
3. ⚠️ debug/root-cause-analyzer.js
4. ⚠️ a11y/wcag-engine.js
5. ⚠️ debt/technical-debt.js
6. ⚠️ deps/dependency-manager.js
7. ⚠️ prod-feedback/feedback-loop.js
8. ⚠️ health/health-dashboard.js
9. ⚠️ env/environment-manager.js
10. ⚠️ orchestration/orchestration-optimizer.js

### Directory Structure Ready

```
src/
├── behaviors/           # ✅ Created, ready for implementation
│   ├── README.md
│   ├── behavior-engine.ts (to be created)
│   └── built-in/ (to be created)
│       ├── calm-ui.ts
│       ├── secure-code.ts
│       ├── test-first.ts
│       ├── api-design.ts
│       └── adr-on-decision.ts
├── orchestrator/
│   ├── ralph-loop.ts    # 🎯 TARGET: Wire all 13 modules
│   └── lifecycle/       # ✅ Created, ready for implementation
│       ├── README.md
│       ├── lifecycle-hooks.ts
│       └── lifecycle-wiring.ts
└── [all R17 modules]    # ✅ Implemented, tested, ready to wire
```

## Sprint Breakdown

### Task 1: Wire 13 Modules into ralph-loop.ts
**Estimated:** 20-30 minutes
**Target Lines:** ~100-150 new lines in ralph-loop.ts

Modules to wire:
1. review/pr-intelligence.js
2. migrate/framework-migrator.js
3. debug/root-cause-analyzer.js
4. a11y/wcag-engine.js
5. debt/technical-debt.js
6. deps/dependency-manager.js
7. prod-feedback/feedback-loop.js
8. health/health-dashboard.js
9. env/environment-manager.js
10. orchestration/orchestration-optimizer.js
11. behaviors/behavior-engine.js (new)
12. lifecycle/lifecycle-hooks.js (new)
13. lifecycle/lifecycle-wiring.js (new)

### Task 2: Build Lifecycle Hooks System
**Estimated:** 15-20 minutes
**Files to Create:**
- `src/orchestrator/lifecycle/lifecycle-hooks.ts` (replace placeholder)
- `src/orchestrator/lifecycle/lifecycle-wiring.ts` (replace placeholder)
- Integration with ralph-loop.ts

### Task 3: Build Behavior System
**Estimated:** 15-20 minutes
**Files to Create:**
- `src/behaviors/behavior-engine.ts`
- `src/behaviors/types.ts`
- `src/behaviors/built-in/calm-ui.ts`
- `src/behaviors/built-in/secure-code.ts`
- `src/behaviors/built-in/test-first.ts`
- `src/behaviors/built-in/api-design.ts`
- `src/behaviors/built-in/adr-on-decision.ts`

### Task 4: Edge Case Tests (76 tests)
**Estimated:** 20-25 minutes
**Distribution:**
- review: +8 tests
- migrate: +8 tests
- debug: +8 tests
- a11y: +7 tests
- debt: +7 tests
- deps: +7 tests
- prod-feedback: +7 tests
- health: +8 tests
- env: +8 tests
- orchestration: +8 tests

### Task 5: Cross-Module Integration Tests (20 tests)
**Estimated:** 15-20 minutes
**File:** `src/orchestrator/cross-module-integration.test.ts`

## Key Import Names Verified

From source code:
```typescript
// R17 Modules (from index.ts exports)
import { PRIntelligence, createPRIntelligence } from '../review/index.js';
import { FrameworkMigrator, createFrameworkMigrator } from '../migrate/index.js';
import { RootCauseAnalyzer, createRootCauseAnalyzer } from '../debug/index.js';
import { WCAGEngine, createWCAGEngine } from '../a11y/index.js';
import { DebtTracker, createDebtTracker } from '../debt/index.js';
import { DependencyManager, createDependencyManager } from '../deps/index.js';
import { FeedbackLoop, createFeedbackLoop } from '../prod-feedback/index.js';
import { HealthMonitor, createHealthMonitor } from '../health/index.js';
import { EnvironmentManager, createEnvironmentManager } from '../env/index.js';
import { OrchestrationOptimizer, buildOrchestrationContext } from './orchestration-optimizer.js';

// Lifecycle (to be created)
import { LifecycleHooks, HookRegistry } from './lifecycle/lifecycle-hooks.js';
import { globalHookRegistry } from './lifecycle/lifecycle-wiring.js';

// Behaviors (to be created)
import { BehaviorEngine } from '../behaviors/behavior-engine.js';
```

## Success Criteria

- [ ] All 13 modules wired into ralph-loop.ts
- [ ] Lifecycle hooks system fully functional
- [ ] Behavior system with 5 built-in behaviors
- [ ] 76 new edge case tests added
- [ ] 20 cross-module integration tests added
- [ ] Total tests: 2,642 → 2,800+
- [ ] TypeScript: 0 errors
- [ ] All tests passing

## Post-Sprint Verification Commands

```bash
# Verify test count
npx vitest run 2>&1 | grep "Tests"

# Verify TypeScript
npx tsc --noEmit

# Verify specific modules wired
grep -c "review\|migrate\|debug\|a11y\|debt\|deps\|prod-feedback\|health\|env\|orchestration\|behaviors\|lifecycle" src/orchestrator/ralph-loop.ts

# Run R17 integration tests
npx vitest run src/orchestrator/r17-integration.test.ts
```
