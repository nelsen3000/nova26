# Gemini-05: EU AI Act + Compliance Deep Dive
## Source: Gemini Deep Research Round 05 (Feb 19, 2026)
## Status: Accepted

## Key Findings

- EU AI Act fully applicable August 2, 2026 — compliance framework needed by Q2
- AI coding tools generally Low/Minimal Risk unless used in critical infrastructure
- Article 86 "Right to Explanation" triggered when AI decisions have "significant effect"
- OTel GenAI Semantic Conventions = 2026 industry standard for audit trails
- Local-first architecture is the strongest compliance asset (data residency solved)

## Audit Trail Schema (TypeScript)

```typescript
interface AIDecisionLog {
  timestamp: string;           // ISO 8601
  traceId: string;             // OTel compliant
  agentId: string;             // e.g., "MARS", "PLUTO"
  model: { id: string; provider: "local" | "cloud"; temperature: number; promptVersion: string };
  context: { filePaths: string[]; dependencyId?: string };
  decision: { action: string; reasoning: string; confidenceScore: number };
  humanAction: "approved" | "modified" | "rejected" | "auto-applied";
}
```

## Agent Trajectory Format (JSONL)

```json
{ "step": "TASK_HANDOFF", "from": "EARTH", "to": "PLUTO",
  "reason": "Product spec finalized; DB schema generation required.",
  "trace": "550e8400-...", "data_hash": "e3b0c442..." }
```

## Implementation Roadmap

1. **Immediate**: OTel Tracing layer + immutable audit log (.nova/audit/trajectory.jsonl)
2. **Q2 2026**: "Explain this Code" feature using agent monologue + ACE score
3. **Pre-Enforcement**: License Awareness + PII Redaction in MERCURY gate
4. **Expansion**: Compliance Dashboard for enterprise CISO visibility

## Penalties
- Up to EUR 35M or 7% global turnover for prohibited practices
- Market access restrictions for documentation non-compliance
