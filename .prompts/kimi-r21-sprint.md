# Kimi Sprint: R21 Feature Implementation
## 3 Tasks | 229+ Tests | TypeScript Strict | ESM `.js` Imports

> **Pre-requisite**: R19 + R20 sprints should ideally be complete first.
> **Repo**: https://github.com/nelsen3000/nova26
> **Branch**: `main` (or feature branch if preferred)
> **Rules**: TypeScript strict, ESM `.js` imports, vitest, no `any`, mock all I/O, no real API calls

---

## Task 1: KIMI-R21-01 — MCP (Model Context Protocol) Integration

**Spec**: `.nova/specs/grok-r21-01-mcp-integration.md`
**Tests**: 78 vitest cases minimum

### What to Build

Create `src/mcp/` module for Nova26 as both MCP Server and MCP Client.

```
src/mcp/
├── index.ts
├── types.ts
├── server.ts                      ← Nova26 as MCP Server (exposes 21 agents)
├── client.ts                      ← Nova26 as MCP Client (discovery + consumption)
├── transport/
│   ├── stdio.ts
│   ├── streamable-http.ts
│   └── websocket.ts
├── discovery.ts                   ← auto-scan local + registry
├── resources/
│   ├── project-files.ts
│   ├── taste-vault.ts
│   └── convex-sync.ts
├── prompts/
│   └── agent-templates.ts
├── security.ts                    ← allowlist + sandbox
├── registry.ts                    ← integration with RalphLoop tool registry
└── __tests__/mcp.test.ts
```

### Key Interfaces to Implement

```typescript
export interface MCPServerConfig {
  enabled: boolean;
  serverName: string;
  version: string;
  instructions: string;
  transports: MCPTransport[];
  allowlist: string[];
  resourceScopes: string[];
}

export interface MCPToolDefinition {
  name: string; // e.g. "nova26.venus.generateDesignFlow"
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  tags: string[];
  agentSource: string;
  requiresConfirmation: boolean;
}

export interface MCPResourceDefinition {
  uri: string; // e.g. "nova26://taste-vault/swipes"
  name: string;
  description: string;
  mimeType: string;
  size?: number;
  content: () => Promise<string | Uint8Array>;
  metadata: { tasteVaultTags?: string[]; lastUpdated: string };
}

export interface MCPPromptDefinition {
  name: string;
  description: string;
  template: string;
  arguments: Array<{ name: string; description: string; required: boolean }>;
}

export interface MCPTransport {
  type: 'stdio' | 'streamable-http' | 'sse' | 'websocket';
  options: { port?: number; path?: string; host?: string; secure?: boolean };
}
```

### RalphLoopOptions Addition

Add to `RalphLoopOptions`:
```typescript
mcpEnabled?: boolean;
mcpConfig?: {
  server: { enabled: boolean; transports: ('stdio' | 'websocket')[] };
  client: { autoDiscover: boolean; maxConcurrent: number };
  tasteVaultExposure: 'read-only' | 'full';
};
```

### Key Implementation Notes

- **Server**: Auto-registers every RalphLoop tool + 21 agents as MCP Tools
- **Client**: Auto-discovery via local stdio scan + optional public registry
- **Resources**: Taste Vault, project files, Design Pipeline outputs, Semantic Model snapshots
- **Prompts**: All 21 agent templates exposed with Studio Rules baked in
- **Security**: Strict allowlist, resource scoping ($PROJECT + .nova/ only)
- **Transport defaults**: stdio for local IDEs, WebSocket for dashboard

### Test Requirements (78 cases)

- Server/client round-trip (stdio + WebSocket)
- Tool discovery + auto-registration
- Resource streaming (large Taste Vault data)
- Prompt template execution
- Security: blocked unauthorized resources + allowlist enforcement
- Performance: <50 ms stdio latency
- Chaos: disconnect/reconnect, partial failures

---

## Task 2: KIMI-R21-02 — ACP (Agent Client Protocol) Integration

**Spec**: `.nova/specs/grok-r21-02-acp-integration.md`
**Tests**: 67 vitest cases minimum

### What to Build

Create `src/acp/` module for Nova26 agents to work in any ACP-compatible editor.

```
src/acp/
├── index.ts
├── types.ts
├── server.ts                      ← Nova26 as ACP Server
├── client.ts                      ← optional client mode
├── descriptor.ts                  ← 21-agent advertisement
├── session-manager.ts             ← state & reconnection
├── transport/
│   ├── stdio.ts
│   ├── websocket.ts
│   └── sse.ts
├── capabilities/
│   ├── registry.ts
│   └── negotiator.ts
├── virtual-fs.ts                  ← FS abstraction layer
├── auth.ts
├── registry.ts
└── __tests__/acp.test.ts
```

### Key Interfaces to Implement

```typescript
export interface ACPAgentDescriptor {
  id: string;
  name: string;
  version: string;
  description: string;
  capabilities: ACPCapability[];
  icon: string;
  website: string;
  author: { name: string; handle: string };
}

export interface ACPCapability {
  id: string; // e.g. "codegen.react", "design.flow"
  name: string;
  description: string;
  agentSource: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  tags: string[];
  requiresConfirmation: boolean;
}

export interface ACPSession {
  id: string;
  projectRoot: string;
  userId: string;
  tasteVaultSnapshotHash: string;
  state: Record<string, unknown>;
  connectedAt: string;
  lastActivity: string;
  transport: ACPTransport;
}

export interface ACPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface ACPTransport {
  type: 'stdio' | 'websocket' | 'sse';
  options: { port?: number; path?: string; secure?: boolean; authToken?: string };
}
```

### RalphLoopOptions Addition

```typescript
acpEnabled?: boolean;
acpConfig?: {
  transports: ('stdio' | 'websocket')[];
  defaultSessionTimeoutMinutes: number;
  exposeToExternalEditors: boolean;
  serviceMode: 'local' | 'remote' | 'hybrid';
  capabilityWhitelist: string[];
};
```

### Key Implementation Notes

- **JSON-RPC 2.0** over stdio/WebSocket (LSP-inspired)
- **21 agents** advertised as grouped capabilities
- **Session persistence** via SQLite + optional Convex sync
- **Virtual FS** abstraction (agents never touch raw FS directly)
- **"Nova26 as a Service"**: `nova26 serve --acp` for remote IDE access
- **MCP + ACP coexist**: MCP for tools/resources, ACP for full editor integration
- **Backward compat**: acpConfig.enabled: false → zero change to CLI/Tauri/dashboard

### Test Requirements (67 cases)

- Descriptor + capability negotiation (21 agents)
- Session lifecycle (connect/reconnect/timeout)
- Bidirectional message round-trips
- Virtual FS operations in sandbox
- Security: blocked unauthorized methods + auth flows
- Backward compatibility matrix
- Performance: <40 ms stdio, <150 ms remote

---

## Task 3: KIMI-R21-03 — Compliance & Audit Trail System

**Spec**: `.nova/specs/grok-r21-03-compliance-audit.md`
**Tests**: 84 vitest cases minimum

### What to Build

Create `src/compliance/` module for EU AI Act Article 86 compliance.

```
src/compliance/
├── index.ts
├── types.ts
├── audit-trail.ts                ← immutable JSONL writer + hash chain verifier
├── trajectory-recorder.ts
├── pii-redactor.ts               ← automatic PII stripping
├── opentelemetry.ts              ← GenAI spans for every agent decision
├── explanation-engine.ts         ← "Explain this code" feature
├── dashboard/
│   ├── compliance-dashboard.ts
│   └── routes.ts
├── retention-manager.ts
├── exporters/
│   ├── json.ts
│   ├── csv.ts
│   └── pdf.ts
└── __tests__/compliance.test.ts
```

### Key Interfaces to Implement

```typescript
export interface AIDecisionLog {
  id: string;
  timestamp: string;
  previousHash: string;
  hash: string; // sha256(JSON.stringify(entry) + previousHash)
  agentId: string;
  decisionType: 'intent' | 'plan' | 'codegen' | 'design' | 'review' | 'deploy' | 'evolve' | 'trajectory';
  inputSummary: string;
  outputSummary: string;
  reasoning: string;
  trajectoryId: string;
  riskLevel: 'low' | 'medium' | 'high';
  complianceTags: string[];
  metadata: Record<string, unknown>;
}

export interface AgentTrajectory {
  id: string;
  rootIntent: string;
  steps: Array<{
    stepNumber: number;
    agent: string;
    action: string;
    decisionLogId?: string;
    timestamp: string;
    tokensUsed: number;
    tasteVaultInfluence?: number;
  }>;
  finalOutcome: string;
  totalDurationMs: number;
  tasteVaultInfluences: string[];
  complianceScore: number;
}

export interface AuditTrailConfig {
  enabled: boolean;
  logPath: string;
  hashingAlgorithm: 'sha256';
  retentionDays: number;
  piiRedactionLevel: 'strict' | 'balanced' | 'minimal';
  openTelemetryEnabled: boolean;
  immutable: true;
  exportFormats: ('json' | 'csv' | 'pdf')[];
  maxLogSizeMB: number;
}

export interface ComplianceDashboardConfig {
  enabled: boolean;
  refreshIntervalSeconds: number;
  defaultFilters: { agents?: string[]; riskLevels?: string[]; dateRange?: [string, string] };
  explanationDepth: 'brief' | 'full' | 'technical';
}

export interface ExplanationRequest {
  targetType: 'code-line' | 'component' | 'screen' | 'flow' | 'decision';
  targetId: string;
  context: { filePath?: string; projectId: string; lineNumber?: number };
  depth: 'brief' | 'full' | 'trajectory';
  userId?: string;
}

export interface ExplanationResponse {
  explanation: string;
  trajectory: AgentTrajectory;
  decisionLogs: AIDecisionLog[];
  tasteVaultFactors: string[];
  confidence: number;
  sources: string[];
  exportReady: boolean;
}
```

### RalphLoopOptions Addition

```typescript
complianceEnabled?: boolean;
complianceConfig?: {
  auditTrail: AuditTrailConfig;
  dashboard: ComplianceDashboardConfig;
  retentionDays: number;
  requireExplanationForHighRisk: boolean;
};
```

### Key Implementation Notes

- **Immutable JSONL** with cryptographic hash chain (sha256, each entry references previous)
- **PII redaction** before any log write (configurable levels)
- **OpenTelemetry GenAI** tracing on every agent decision
- **"Explain this code"** feature: click any AI line → full reasoning chain
- **Trajectory replay**: step-by-step agent collaboration playback
- **Export**: JSON (raw), CSV (summary), PDF (signed branded report)
- **Retention**: auto-purge after configured days (180-day minimum for EU AI Act)
- **Integration**: ATLAS GraphMemory, MERCURY compliance gate, L0-L3 layer boundaries

### Test Requirements (84 cases)

- Hash chain integrity (tamper detection)
- PII redaction accuracy across 40+ patterns
- Full trajectory replay + explanation quality
- OpenTelemetry span correctness
- Retention enforcement + auto-purge
- High-load append (10k decisions/sec)
- EU AI Act Article 86 simulation
- Export format validation (JSON, CSV, PDF)
- Chaos: disk full, power loss mid-write → graceful recovery

---

## Final Checklist

After implementing all 3 tasks:
1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → all tests pass (target: 229+ new tests)
3. Barrel exports in each `index.ts`
4. No `any` types (use `unknown` + type guards)
5. All I/O mocked in tests
6. ESM `.js` imports throughout
