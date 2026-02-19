// Audit Trail — R21-03
// Immutable append-only JSONL with cryptographic hash chain

import { createHash } from 'crypto';
import type { AIDecisionLog, AuditTrailConfig } from './types.js';
import { PIIRedactor } from './pii-redactor.js';

export class AuditTrail {
  private config: AuditTrailConfig;
  private redactor: PIIRedactor;
  private logs: AIDecisionLog[] = [];
  private lastHash: string = '0'.repeat(64); // Genesis hash

  constructor(config: AuditTrailConfig) {
    this.config = config;
    this.redactor = new PIIRedactor(config.piiRedactionLevel);
  }

  /**
   * Log a decision with hash chain
   */
  async logDecision(
    agentId: string,
    decisionType: AIDecisionLog['decisionType'],
    input: string,
    output: string,
    reasoning: string,
    trajectoryId: string,
    riskLevel: AIDecisionLog['riskLevel'] = 'low',
    metadata: Record<string, unknown> = {}
  ): Promise<AIDecisionLog> {
    if (!this.config.enabled) {
      throw new Error('Audit trail is disabled');
    }

    // Redact PII
    const inputSummary = this.redactor.redact(input);
    const outputSummary = this.redactor.redact(output);

    // Generate ID (uuid-like timestamp-based)
    const id = this.generateId();

    // Calculate hash
    const hash = this.calculateHash({
      id,
      timestamp: Date.now(),
      previousHash: this.lastHash,
      agentId,
      decisionType,
      inputSummary,
      outputSummary,
      reasoning,
      trajectoryId,
      riskLevel,
      complianceTags: this.getComplianceTags(riskLevel),
      metadata,
    });

    const log: AIDecisionLog = {
      id,
      timestamp: Date.now(),
      previousHash: this.lastHash,
      hash,
      agentId,
      decisionType,
      inputSummary,
      outputSummary,
      reasoning,
      trajectoryId,
      riskLevel,
      complianceTags: this.getComplianceTags(riskLevel),
      metadata,
    };

    this.logs.push(log);
    this.lastHash = hash;

    // Persist to storage (mock implementation)
    await this.persistLog(log);

    return log;
  }

  /**
   * Get a log by ID
   */
  getLog(id: string): AIDecisionLog | undefined {
    return this.logs.find(l => l.id === id);
  }

  /**
   * Get all logs
   */
  getAllLogs(): AIDecisionLog[] {
    return [...this.logs];
  }

  /**
   * Get chain of logs from a starting point
   */
  getChain(fromId?: string): AIDecisionLog[] {
    if (!fromId) return [...this.logs];

    const startIndex = this.logs.findIndex(l => l.id === fromId);
    if (startIndex === -1) return [];

    return this.logs.slice(startIndex);
  }

  /**
   * Verify integrity of the hash chain
   */
  verifyIntegrity(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (let i = 0; i < this.logs.length; i++) {
      const log = this.logs[i];

      // Verify hash
      const expectedHash = this.calculateHash(log);
      if (log.hash !== expectedHash) {
        errors.push(`Log ${log.id}: hash mismatch`);
      }

      // Verify chain link (except for first log)
      if (i > 0) {
        const previousLog = this.logs[i - 1];
        if (log.previousHash !== previousLog.hash) {
          errors.push(`Log ${log.id}: chain break`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Export logs in specified format
   */
  async exportLogs(format: 'json' | 'csv' | 'pdf'): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(this.logs, null, 2);
      
      case 'csv':
        return this.exportCSV();
      
      case 'pdf':
        // Mock PDF generation - would use PDF library in production
        return `[PDF_EXPORT_MOCK] ${this.logs.length} logs`;
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Get audit statistics
   */
  getStats(): {
    totalLogs: number;
    byAgent: Record<string, number>;
    byRiskLevel: Record<string, number>;
    byDecisionType: Record<string, number>;
  } {
    const byAgent: Record<string, number> = {};
    const byRiskLevel: Record<string, number> = {};
    const byDecisionType: Record<string, number> = {};

    for (const log of this.logs) {
      byAgent[log.agentId] = (byAgent[log.agentId] || 0) + 1;
      byRiskLevel[log.riskLevel] = (byRiskLevel[log.riskLevel] || 0) + 1;
      byDecisionType[log.decisionType] = (byDecisionType[log.decisionType] || 0) + 1;
    }

    return {
      totalLogs: this.logs.length,
      byAgent,
      byRiskLevel,
      byDecisionType,
    };
  }

  /**
   * Clear all logs (for testing only)
   */
  clear(): void {
    this.logs = [];
    this.lastHash = '0'.repeat(64);
  }

  private calculateHash(log: Omit<AIDecisionLog, 'hash'>): string {
    const data = JSON.stringify({
      id: log.id,
      timestamp: log.timestamp,
      previousHash: log.previousHash,
      agentId: log.agentId,
      decisionType: log.decisionType,
      inputSummary: log.inputSummary,
      outputSummary: log.outputSummary,
      reasoning: log.reasoning,
      trajectoryId: log.trajectoryId,
      riskLevel: log.riskLevel,
    });

    return createHash('sha256').update(data).digest('hex');
  }

  private generateId(): string {
    return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async persistLog(_log: AIDecisionLog): Promise<void> {
    // Mock persistence - in production would write to JSONL file
    // await fs.appendFile(this.config.logPath, JSON.stringify(log) + '\n');
  }

  private getComplianceTags(riskLevel: AIDecisionLog['riskLevel']): string[] {
    const tags: string[] = ['eu-ai-act-article-86'];
    
    if (riskLevel === 'high' || riskLevel === 'critical') {
      tags.push('human-oversight-required');
    }
    
    return tags;
  }

  private exportCSV(): string {
    const headers = ['id', 'timestamp', 'agentId', 'decisionType', 'riskLevel', 'trajectoryId', 'hash'];
    const rows = this.logs.map(log => [
      log.id,
      log.timestamp,
      log.agentId,
      log.decisionType,
      log.riskLevel,
      log.trajectoryId,
      log.hash,
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

export function createAuditTrail(config: AuditTrailConfig): AuditTrail {
  return new AuditTrail(config);
}
