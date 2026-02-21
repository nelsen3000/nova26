# Studio Rules + Prompt Optimization

## Overview

The Studio Rules engine enforces project-wide coding standards, security policies, architectural constraints, and user taste preferences at three enforcement levels: warn (advisory), block (fail the task), and auto-fix (silently correct). Rules are organized into categories -- code-style, security, architecture, ux, taste-vault, cinematic, and wellbeing -- and scoped to specific agents, file patterns, or R16+ features. On top of the rule engine sits a DSPy-based prompt optimizer that uses bayesian, genetic, or hill-climbing strategies to improve agent system prompts against golden sets. The Taste Vault Rule Learner closes the feedback loop: when a user corrects agent output, the learner extracts a candidate rule, clusters it with similar corrections, presents it for confirmation, and applies time-based decay to stale rules.

---

## Source

- `src/studio-rules/rule-engine.ts` — Rule engine with multi-scope targeting and three enforcement levels
- `src/studio-rules/taste-vault-learner.ts` — Taste Vault feedback loop: correction → rule extraction → decay
- `src/optimization/prompt-optimizer.ts` — DSPy-based prompt optimization with bayesian/genetic/hill-climbing strategies
- `src/optimization/eval-pipeline.ts` — Golden set evaluation pipeline with regression detection
- `src/studio-rules/types.ts` — Shared type definitions (StudioRule, RuleCategory, EnforcementLevel)

## Pattern

### Core Interfaces

```typescript
export type RuleCategory =
  | 'code-style' | 'security' | 'architecture'
  | 'ux' | 'taste-vault' | 'cinematic' | 'wellbeing';

export type EnforcementLevel = 'warn' | 'block' | 'auto-fix';

export interface StudioRulesConfig {
  rules: StudioRule[];
  enforcement: EnforcementLevel;
  ruleSource: 'local' | 'convex' | 'both';
  optimizationEnabled: boolean;
  optimizationSchedule: 'on-deploy' | 'nightly' | 'manual';
  maxRulesPerCategory: number;
  decayEnabled: boolean;
  tasteVaultInfluence: number; // 0-1 weight
}

export interface StudioRule {
  id: string;
  name: string;
  description: string;
  category: RuleCategory;
  condition: string; // Code pattern or regex to match
  action: 'require' | 'forbid' | 'prefer' | 'style-guide';
  examples: {
    good: string;
    bad: string;
    explanation: string;
  };
  scope: {
    agents: string[];       // Which agents this rule applies to
    filePatterns: string[];  // Glob patterns for file targeting
    r16Features: string[];   // R16+ feature module scoping
  };
  confidence: number;
  source: 'manual' | 'taste-vault' | 'imported';
  decayScore: number; // 0-1, decreases over time if rule is not reinforced
}
```

### Rule Engine: Enforcement at Runtime

```typescript
export interface RuleViolation {
  ruleId: string;
  ruleName: string;
  severity: EnforcementLevel;
  message: string;
  location?: { file: string; line: number };
  autoFixApplied?: boolean;
  suggestedFix?: string;
}

export class RuleEngine {
  private rules: StudioRule[];
  private enforcement: EnforcementLevel;

  constructor(config: StudioRulesConfig) {
    this.rules = config.rules;
    this.enforcement = config.enforcement;
  }

  evaluate(content: string, context: {
    agentName: string;
    filePath: string;
    feature?: string;
  }): RuleViolation[] {
    const applicable = this.rules.filter(rule =>
      this.ruleApplies(rule, context)
    );

    const violations: RuleViolation[] = [];

    for (const rule of applicable) {
      const match = this.checkCondition(rule, content);
      if (!match) continue;

      if (rule.action === 'forbid' && match.found) {
        violations.push(this.createViolation(rule, match));
      }
      if (rule.action === 'require' && !match.found) {
        violations.push(this.createViolation(rule, match));
      }
    }

    return violations;
  }

  enforceOrFail(violations: RuleViolation[]): {
    passed: boolean;
    blockers: RuleViolation[];
    warnings: RuleViolation[];
    autoFixed: RuleViolation[];
  } {
    const blockers = violations.filter(v => v.severity === 'block');
    const warnings = violations.filter(v => v.severity === 'warn');
    const autoFixed = violations.filter(v => v.severity === 'auto-fix');

    return {
      passed: blockers.length === 0,
      blockers,
      warnings,
      autoFixed,
    };
  }

  // Inject applicable rules into agent system prompt
  getPromptInjection(agentName: string): string {
    const agentRules = this.rules.filter(rule =>
      rule.scope.agents.length === 0 ||
      rule.scope.agents.includes(agentName)
    );

    if (agentRules.length === 0) return '';

    const lines = ['## Studio Rules (enforced)', ''];
    for (const rule of agentRules) {
      lines.push(`- **${rule.name}** [${rule.action}]: ${rule.description}`);
      if (rule.examples.bad) {
        lines.push(`  Bad: \`${rule.examples.bad}\``);
      }
      if (rule.examples.good) {
        lines.push(`  Good: \`${rule.examples.good}\``);
      }
    }
    return lines.join('\n');
  }

  private ruleApplies(
    rule: StudioRule,
    context: { agentName: string; filePath: string; feature?: string }
  ): boolean {
    if (rule.scope.agents.length > 0 &&
        !rule.scope.agents.includes(context.agentName)) return false;
    if (rule.scope.filePatterns.length > 0 &&
        !rule.scope.filePatterns.some(p => minimatch(context.filePath, p))) return false;
    if (rule.decayScore < 0.1) return false; // Decayed rules are effectively disabled
    return true;
  }

  // ... checkCondition, createViolation
}
```

### DSPy-Based Prompt Optimizer

```typescript
export type OptimizationStrategy = 'bayesian' | 'genetic' | 'hill-climbing';

export interface OptimizationObjective {
  agentTemplateId: string;
  goldenSet: GoldenExample[];
  scorers: ScorerFunction[];
  weights: number[];
}

export interface GoldenExample {
  input: string;
  expectedOutput: string;
  tags: string[];
}

export type ScorerFunction = (output: string, expected: string) => number;

export interface OptimizationResult {
  optimizedSystemPrompt: string;
  optimizedFewShot: string[];
  improvementPercent: number;
  trace: OptimizationTrace[];
}

export class PromptOptimizer {
  async optimize(
    template: string,
    objective: OptimizationObjective,
    strategy: OptimizationStrategy,
    budget: { maxIterations: number; maxTokens: number }
  ): Promise<OptimizationResult> {
    switch (strategy) {
      case 'bayesian':
        return this.bayesianOptimize(template, objective, budget);
      case 'genetic':
        return this.geneticOptimize(template, objective, budget);
      case 'hill-climbing':
        return this.hillClimbOptimize(template, objective, budget);
    }
  }

  private async bayesianOptimize(
    template: string,
    objective: OptimizationObjective,
    budget: { maxIterations: number; maxTokens: number }
  ): Promise<OptimizationResult> {
    // Bayesian optimization: model the score landscape,
    // sample prompts from high-probability regions
    let bestPrompt = template;
    let bestScore = await this.evaluatePrompt(bestPrompt, objective);

    for (let i = 0; i < budget.maxIterations; i++) {
      const candidate = await this.sampleCandidate(bestPrompt, i);
      const score = await this.evaluatePrompt(candidate, objective);
      if (score > bestScore) {
        bestPrompt = candidate;
        bestScore = score;
      }
    }

    return {
      optimizedSystemPrompt: bestPrompt,
      optimizedFewShot: [],
      improvementPercent: ((bestScore - await this.evaluatePrompt(template, objective)) /
        await this.evaluatePrompt(template, objective)) * 100,
      trace: [],
    };
  }

  // ... geneticOptimize, hillClimbOptimize, evaluatePrompt, sampleCandidate
}
```

### Taste Vault Rule Learner

```typescript
export interface CorrectionEvent {
  agentName: string;
  originalOutput: string;
  correctedOutput: string;
  userComment?: string;
  timestamp: number;
}

export class TasteVaultRuleLearner {
  async extractFromCorrection(event: CorrectionEvent): Promise<StudioRule | null> {
    // Use LLM to diff original vs corrected and extract a rule
    const diff = computeDiff(event.originalOutput, event.correctedOutput);
    if (!diff.meaningful) return null;

    const candidateRule = await this.llmExtractRule(diff, event.userComment);
    return candidateRule;
  }

  clusterSimilarCorrections(
    corrections: CorrectionEvent[]
  ): Map<string, CorrectionEvent[]> {
    // Group corrections by semantic similarity to find patterns
    const clusters = new Map<string, CorrectionEvent[]>();
    // Embedding-based clustering of correction diffs
    return clusters;
  }

  async presentForConfirmation(rule: StudioRule): Promise<StudioRule | null> {
    // Show extracted rule to user with examples
    // Returns confirmed rule or null if rejected
    return rule;
  }

  applyDecay(rules: StudioRule[], decayRate: number = 0.01): StudioRule[] {
    const now = Date.now();
    return rules.map(rule => ({
      ...rule,
      decayScore: Math.max(0, rule.decayScore - decayRate),
    })).filter(rule => rule.decayScore > 0.05);
  }
}
```

### Golden Set Evaluation Pipeline

```typescript
export class EvalPipeline {
  async runGoldenSet(
    agentTemplateId: string,
    goldenSet: GoldenExample[]
  ): Promise<{ score: number; passed: number; failed: number; regressions: string[] }> {
    let passed = 0;
    let failed = 0;
    const regressions: string[] = [];

    for (const example of goldenSet) {
      const output = await this.runAgent(agentTemplateId, example.input);
      const score = this.score(output, example.expectedOutput);
      if (score >= 0.8) {
        passed++;
      } else {
        failed++;
        regressions.push(`[${example.tags.join(',')}] score=${score.toFixed(2)}`);
      }
    }

    return {
      score: passed / goldenSet.length,
      passed,
      failed,
      regressions,
    };
  }

  async detectRegressions(
    currentScore: number,
    baselineScore: number,
    threshold: number = 0.05
  ): Promise<boolean> {
    return (baselineScore - currentScore) > threshold;
  }

  hookIntoCI(): void {
    // Register as MERCURY quality gate
    // Blocks merge if regression > 5%
  }
}
```

## Usage

### Key Concepts

- **Multi-scope rule targeting**: Rules can target specific agents, file glob patterns, and R16+ feature modules simultaneously
- **Three enforcement levels**: `warn` logs without blocking, `block` fails the task, `auto-fix` silently corrects the violation
- **Prompt injection**: `getPromptInjection()` serializes applicable rules into the agent's system prompt at runtime
- **DSPy optimization strategies**: Three strategies (bayesian, genetic, hill-climbing) optimize agent prompts against golden sets
- **Taste Vault feedback loop**: User correction -> rule extraction -> clustering -> confirmation -> all agents improved
- **Decay mechanism**: Rules that are never reinforced decay toward zero and are eventually disabled, preventing rule bloat

---

## Anti-Patterns

### Don't Do This

```typescript
// Hardcoded rules scattered across agent templates
const systemPrompt = `Always use semicolons. Never use any. Always prefer const.`;
// Rules are invisible, unversioned, and impossible to manage at scale

// No enforcement — rules are suggestions that agents ignore
const violations = ruleEngine.evaluate(output, context);
console.log(violations); // Logged but never acted upon

// Optimizing prompts without a golden set — no objective measurement
const newPrompt = await optimizer.optimize(template, {
  goldenSet: [], // Empty! Optimization is directionless
  scorers: [],
  weights: [],
});

// Never decaying taste vault rules — stale preferences accumulate forever
rules.push(newRule); // Added 6 months ago, user's taste has changed
```

### Do This Instead

```typescript
// Centralized rule engine with enforcement
const engine = new RuleEngine(studioRulesConfig);
const violations = engine.evaluate(agentOutput, context);
const result = engine.enforceOrFail(violations);
if (!result.passed) {
  throw new Error(`Blocked by ${result.blockers.length} rule violations`);
}

// Inject rules into agent prompts dynamically
const ruleBlock = engine.getPromptInjection('EARTH');
const prompt = `${basePrompt}\n\n${ruleBlock}`;

// Optimize with a real golden set and measurable scorers
const result = await optimizer.optimize(template, {
  goldenSet: loadGoldenExamples('earth-coding'),
  scorers: [exactMatchScorer, semanticSimilarityScorer],
  weights: [0.3, 0.7],
}, 'bayesian', { maxIterations: 50, maxTokens: 100_000 });

// Apply decay to prune stale rules
config.rules = learner.applyDecay(config.rules, 0.01);
```

---

## When to Use

**Use for:**
- Enforcing consistent coding standards across all 21+ agents in the system
- Learning and codifying user taste preferences from corrections over time
- Systematically improving agent prompt quality with measurable golden set evaluations
- Blocking security violations (e.g., exposed secrets, unsafe patterns) before they reach production

**Don't use for:**
- One-off ad-hoc rules that apply to a single prompt (use direct prompt editing instead)
- Performance-critical hot paths where rule evaluation overhead matters (rules are evaluated on agent output, not in tight loops)

---

## Benefits

1. **Consistent quality** -- rules enforce the same standards across every agent, eliminating drift between agents
2. **Self-improving prompts** -- DSPy optimization measurably improves agent performance against golden sets
3. **User taste capture** -- the Taste Vault converts subjective corrections into objective, enforceable rules
4. **Graceful rule lifecycle** -- decay prevents rule bloat; new corrections reinforce relevant rules
5. **CI integration** -- the eval pipeline gates deployments, blocking any change that causes >5% regression in golden set scores
6. **Multi-category coverage** -- seven rule categories cover code style, security, architecture, UX, taste preferences, cinematic quality, and developer wellbeing

---

## Related Patterns

- See `../01-orchestration/ralph-loop-execution.md` for how `{{studioRules}}` is injected into agent system prompts at runtime
- See `../07-memory-and-persistence/session-memory.md` for how correction events are persisted for the Taste Vault learner
- See `../01-orchestration/gate-runner-pipeline.md` for how the eval pipeline hooks into quality gates
- See `model-router-fallback-chains.md` for how the optimizer selects models for golden set evaluation
- See `security-scanner.md` for security-category rules that overlap with the dedicated scanner

---

*Extracted: 2026-02-19*
