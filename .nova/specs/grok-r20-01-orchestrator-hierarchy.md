# R20-01: Orchestrator-Worker L0/L1/L2/L3 Hierarchy — Accepted Spec
## Source: Grok R20-01 (Feb 19, 2026)

## Key Interfaces

- OrchestratorHierarchyConfig: enabled, layers[], escalationPolicy (auto|manual|threshold-based), defaultMaxRetries, globalTimeoutMs, backwardCompatibilityMode, observabilityLevel
- LayerConfig: level (0-3), supervisorAgent, workers[], maxConcurrency, timeoutMs, maxRetries
- UserIntent (L0): id, rawInput, parsedType, scope, constraints, tasteVaultTags, confidence, needsClarification
- TaskGraph (L1): TaskNode[] with agent + dependencies + estimatedTokens, parallelGroups
- ExecutionArtifact (L2): type (code|spec|design|test|asset), content, metadata
- ToolRequest (L3): toolName, parameters, sandboxed
- EscalationEvent: layer, taskId, error, retryCount, suggestedNextLayer, requiresHuman

Layer responsibilities:
- L0 (SUN): parse intent, confirm with user, clarification loop
- L1 (SUN+JUPITER+MERCURY): decompose tasks, validate architecture, re-plan on failure
- L2 (assigned agent): execute task, retry with new prompt, run parallel
- L3 (sandbox): execute tool calls, backoff retry

## File Structure
src/orchestrator/
├── ralph-loop.ts (upgraded to layer dispatcher)
├── layers/
│   ├── l0-intent.ts
│   ├── l1-planning.ts
│   ├── l2-execution.ts
│   └── l3-tool.ts
├── escalation.ts
├── hierarchy-config.ts
├── types.ts
├── __tests__/hierarchy.test.ts
└── lifecycle-wiring.ts (hooks for layer boundaries)

## RalphLoopOptions Addition
orchestratorHierarchy: OrchestratorHierarchyConfig

## Backward Compatibility
hierarchyLevel: "flat" routes everything to L2 (zero breaking change)

## Tests: 112 vitest cases
