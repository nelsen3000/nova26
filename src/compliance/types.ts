// Compliance & Audit Trail Types — R21-03

export interface AIDecisionLog {
  id: string; // uuid v7
  timestamp: number;
  previousHash: string;
  hash: string; // sha256 chain
  agentId: string;
  decisionType: 'intent' | 'plan' | 'codegen' | 'design' | 'review' | 'deploy' | 'evolve' | 'trajectory';
  inputSummary: string; // redacted
  outputSummary: string; // redacted
  reasoning: string;
  trajectoryId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  complianceTags: string[];
  metadata: Record<string, unknown>;
}

export interface AgentTrajectory {
  id: string;
  rootIntent: string;
  steps: Array<{
    agent: string;
    action: string;
    decisionLogId: string;
    tokensUsed: number;
    tasteVaultInfluence: number;
    timestamp: number;
  }>;
  finalOutcome: string;
  totalDurationMs: number;
  complianceScore: number; // 0-100
}

export interface AuditTrailConfig {
  enabled: boolean;
  logPath: string; // .nova/audit/audit.log.jsonl
  hashingAlgorithm: 'sha256';
  retentionDays: number; // min 180 for EU
  piiRedactionLevel: 'none' | 'partial' | 'full';
  openTelemetryEnabled: boolean;
  immutable: boolean;
  exportFormats: ('json' | 'csv' | 'pdf')[];
  maxLogSizeMB: number;
}

export interface ExplanationRequest {
  decisionLogId: string;
  userId?: string;
  depth: 'summary' | 'detailed' | 'technical';
}

export interface ExplanationResponse {
  decisionLogId: string;
  narrative: string;
  trajectorySteps: AgentTrajectory['steps'];
  tasteVaultFactors: string[];
  complianceScore: number;
}

export interface ComplianceDashboardConfig {
  enabled: boolean;
  refreshIntervalSeconds: number;
  defaultFilters: string[];
  explanationDepth: 'summary' | 'detailed' | 'technical';
}

export const DEFAULT_AUDIT_TRAIL_CONFIG: AuditTrailConfig = {
  enabled: true,
  logPath: '.nova/audit/audit.log.jsonl',
  hashingAlgorithm: 'sha256',
  retentionDays: 180,
  piiRedactionLevel: 'partial',
  openTelemetryEnabled: true,
  immutable: true,
  exportFormats: ['json', 'csv', 'pdf'],
  maxLogSizeMB: 100,
};

export const DEFAULT_COMPLIANCE_DASHBOARD_CONFIG: ComplianceDashboardConfig = {
  enabled: true,
  refreshIntervalSeconds: 30,
  defaultFilters: [],
  explanationDepth: 'detailed',
};
