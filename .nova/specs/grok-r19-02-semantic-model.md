# R19-02: Deep Project Semantic Model — Accepted Spec
## Source: Grok R19-02 (Feb 19, 2026)

## Key Interfaces (src/atlas/types.ts)

- SemanticModelConfig: analysisDepth, updateStrategy, cacheLocation, maxCacheSizeMB, tsMorphProjectRoot, enableContextCompaction, compactionTokenBudget, semanticTagSources, refreshIntervalMinutes
- CodeNode: id, type (file|function|class|interface|type|export|component|hook|page), name, filePath, location, complexity, changeFrequency, testCoverage, semanticTags, dependents
- CodeEdge: fromId, toId, type (imports|calls|extends|implements|uses-type|renders|depends-on), weight
- CodeGraph: Map of nodes + edges, queryWhatDependsOn(), queryImpactRadius(), findBySemanticTag(), refreshFile()
- ImpactAnalysisResult: changedNode, affectedNodes, affectedFiles, riskLevel, confidence, visualization (Mermaid), suggestedTests
- SemanticDiffSummary: prIntent, groupedChanges[], suspiciousPatterns, overallConfidence, safeToMerge, humanReadableReport
- CompactedContext: projectSummary, relevantModules[], keyPatterns, tokenCount, expand()

## File Structure
src/atlas/
├── semantic-model.ts (core CodeGraph + ts-morph refresh)
├── impact-analyzer.ts
├── semantic-differ.ts
├── context-compactor.ts
├── graph-memory.ts (Convex + local sync)
├── types.ts
└── __tests__/semantic-model.test.ts

## RalphLoopOptions Addition
semanticModel: SemanticModelConfig

## Integration Points
- Every agent: RalphLoop injects atlas.getSemanticSnapshot(task) before work
- ATLAS: full graph for retrospectives + pattern mining
- MERCURY: auto-runs ImpactAnalysis on every PR
- Replaces/enhances src/dependency-analysis/

## Tests: 68 vitest cases
