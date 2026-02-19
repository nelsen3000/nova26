# Grok R21-03: Compliance & Audit Trail System
## Source: Grok Research Round 21-03 (Feb 19, 2026)
## Status: Accepted

## Key Interfaces

### AIDecisionLog
- id (uuid v7), timestamp, previousHash, hash (sha256 chain)
- agentId, decisionType: 'intent'|'plan'|'codegen'|'design'|'review'|'deploy'|'evolve'|'trajectory'
- inputSummary (redacted), outputSummary (redacted), reasoning (human-readable)
- trajectoryId, riskLevel, complianceTags, metadata

### AgentTrajectory
- id, rootIntent, steps (agent, action, decisionLogId, tokensUsed, tasteVaultInfluence)
- finalOutcome, totalDurationMs, complianceScore (0-100)

### AuditTrailConfig
- enabled, logPath (.nova/audit/audit.log.jsonl), hashingAlgorithm: 'sha256'
- retentionDays (min 180 for EU), piiRedactionLevel, openTelemetryEnabled, immutable: true
- exportFormats: ('json'|'csv'|'pdf')[], maxLogSizeMB

### ComplianceDashboardConfig
- enabled, refreshIntervalSeconds, defaultFilters, explanationDepth

### ExplanationRequest / ExplanationResponse
- "Explain this code" feature: user clicks any AI line → full reasoning chain
- Cinematic narrative + trajectory replay + Taste Vault factors

## File Structure
src/compliance/
├── index.ts, types.ts, audit-trail.ts, trajectory-recorder.ts
├── pii-redactor.ts, opentelemetry.ts, explanation-engine.ts
├── dashboard/ (compliance-dashboard.ts, routes.ts)
├── retention-manager.ts
├── exporters/ (json.ts, csv.ts, pdf.ts)
└── __tests__/compliance.test.ts

## RalphLoopOptions Addition
complianceConfig: { enabled, auditTrail, dashboard, retentionDays: 180, requireExplanationForHighRisk }

## Key Features
- Immutable append-only JSONL with cryptographic hash chain (tamper detection)
- OpenTelemetry GenAI tracing on every agent decision
- Automatic PII redaction before log writes
- Agent trajectory replay (step-by-step)
- Export: JSON (raw), CSV (summary), PDF (signed branded report)
- EU AI Act Article 86 + NIST RMF compliant

## Test Strategy
84 vitest cases: hash chain integrity, PII redaction, trajectory replay, OTel spans, retention enforcement, high-load append, Article 86 simulation, chaos recovery
