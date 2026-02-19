# Perplexity Intelligence Division — Spec
## Source: Grok R18-extra (February 19, 2026)
## Status: Accepted, queued for Kimi implementation

---

## Overview

Integrate Perplexity API as a research tool in the Ralph Loop, giving all agents
access to real-time, cited, web-sourced intelligence.

## Interfaces

```typescript
// src/tools/perplexity/types.ts

export interface PerplexityResearchBrief {
  queryId: string;
  timestamp: string;
  originalQuery: string;
  synthesizedAnswer: string;
  keyFindings: string[];
  sources: Array<{
    title: string;
    url: string;
    reliability: number;
    snippet: string;
  }>;
  novaRelevanceScore: number;          // 0-100, ATLAS-scored
  suggestedNextActions: string[];
  tags: string[];
  tasteVaultPersonalization: string;
}

export interface PerplexityToolConfig {
  apiKey: string;                      // from ENCELADUS secure vault
  model: 'sonar' | 'sonar-pro' | 'sonar-reasoning';
  maxTokens: number;
  temperature: number;
  cacheTTL: number;                    // minutes
  fallbackOnError: boolean;
}
```

## File Structure

```
src/tools/perplexity/
├── index.ts                     ← public export
├── types.ts
├── perplexity-agent.ts          ← main wrapper + caching
├── rules.md                     ← Studio Rules integration
└── __tests__/perplexity.test.ts
```

## Integration Points

- RalphLoop tool registry (add to ToolRegistry with priority "research-first")
- ATLAS ingest pipeline (new hook: onResearchBriefReceived)
- Studio Rules (R19-03): "For competitive intel or deep-dives → invoke Perplexity"
- Taste Vault: auto-prepends user style preferences
- Mobile Launch Stage (R19-01): EAS gotchas + ASO keywords sourced via Perplexity

## RalphLoopOptions Addition

```typescript
researchTools: {
  perplexity: { enabled: true, weight: 0.8 }
}
```

## Environment

```
PERPLEXITY_API_KEY=sk-...
PERPLEXITY_ENABLED=true
```

## Test Strategy

- 25 vitest cases: mocked responses, cache hit/miss, fallback, relevance scoring
- Integration test inside RalphLoop ReAct (one full research → spec cycle)
- End-to-end: query about "Expo EAS 2026 submit limits" → brief appears in dashboard

## Notes

- Uses OpenAI-compatible client (change baseURL to https://api.perplexity.ai)
- Full tool-calling support for Agent API (multi-step reasoning)
- Streaming + ReAct loop ready for RalphLoop
- Automatic ingestion hook to ATLAS GraphMemory
- Cost: ~$0.20-$1/day at expected usage. Smart cache + local fallback mitigates.
