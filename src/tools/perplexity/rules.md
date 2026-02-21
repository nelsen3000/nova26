# Perplexity Studio Rules — Integration Guide

## When to invoke Perplexity

| Scenario | Rule |
|----------|------|
| Competitive intelligence | ALWAYS invoke Perplexity before writing a spec |
| Technology deep-dives | Invoke for any library > 6 months old (APIs change) |
| EAS/mobile gotchas | Invoke for Expo submission limits, ASO keywords |
| Security advisories | Invoke when PLUTO requests threat intel |
| PRD market research | Invoke at SUN agent pre-flight |
| API compatibility | Invoke when ENCELADUS detects performance regressions |

## Caching policy

- Default TTL: 60 minutes
- Security queries: bypass cache (always fresh)
- Market research: 24h TTL acceptable
- Dev tooling: 4h TTL

## Model selection

| Task | Model |
|------|-------|
| Quick lookup | `sonar` |
| Deep analysis | `sonar-pro` |
| Multi-step reasoning | `sonar-reasoning` |

## Output handling

1. Ingest brief into ATLAS GraphMemory via `onResearchBriefReceived` hook
2. Attach `novaRelevanceScore` to task metadata
3. Surface `suggestedNextActions` to the orchestrator (EARTH)
4. Log sources for compliance audit trail (MIMAS)

## Cost guard

- Budget alert at $0.50/day
- Auto-downgrade to `sonar` if cost exceeds threshold
- Enable `fallbackOnError: true` in production to prevent build failures
