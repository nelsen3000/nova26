# R19-03: Studio Rules + DSPy Prompt Optimization — Accepted Spec
## Source: Grok R19-03 (Feb 19, 2026)

## Key Interfaces

- StudioRulesConfig: rules[], enforcement (warn|block|auto-fix), ruleSource, optimizationEnabled, optimizationSchedule, maxRulesPerCategory, decayEnabled, tasteVaultInfluence
- StudioRule: id, name, description, category (code-style|security|architecture|ux|taste-vault|cinematic|wellbeing), condition, action (require|forbid|prefer|style-guide), examples {good, bad, explanation}, scope {agents, filePatterns, r16Features}, confidence, source, decayScore
- OptimizationObjective: agentTemplateId, goldenSet, scorers[], weights[]
- PromptOptimizer.optimize(): template + objective + strategy (bayesian|genetic|hill-climbing) + budget → optimizedSystemPrompt + optimizedFewShot + improvementPercent + trace
- EvalPipeline: runGoldenSet(), detectRegressions(), hookIntoCI()
- TasteVaultRuleLearner: extractFromCorrection(), clusterSimilarCorrections(), presentForConfirmation(), applyDecay()

## File Structure
src/studio-rules/
├── index.ts
├── types.ts
├── rule-engine.ts (enforcement + injection)
├── taste-vault-learner.ts
├── __tests__/rule-learning.test.ts

src/optimization/
├── prompt-optimizer.ts (DSPy core)
├── eval-pipeline.ts
├── golden-sets.ts
└── optimizers/

## RalphLoopOptions Addition
studioRules: StudioRulesConfig

## Integration Points
- Every agent: {{studioRules}} injected into system prompt at runtime
- PromptOptimizer: uses ATLAS retrospective data as training signal
- EvalPipeline: hooks into MERCURY + SATURN, blocks >5% regressions
- TasteVault: correction → rule → optimize → all agents improved

## Tests: 94 vitest cases
