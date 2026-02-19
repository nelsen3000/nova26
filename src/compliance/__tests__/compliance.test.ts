// Compliance & Audit Trail Tests — R21-03
// Comprehensive test suite for PII Redactor, Audit Trail, Trajectory Recorder, and Explanation Engine

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PIIRedactor, createPIIRedactor } from '../pii-redactor.js';
import { AuditTrail, createAuditTrail } from '../audit-trail.js';
import { TrajectoryRecorder, createTrajectoryRecorder } from '../trajectory-recorder.js';
import { ExplanationEngine, createExplanationEngine } from '../explanation-engine.js';
import { DEFAULT_AUDIT_TRAIL_CONFIG } from '../types.js';
import type { AIDecisionLog, AgentTrajectory, AuditTrailConfig } from '../types.js';

// ============================================================================
// PIIRedactor Tests (18 tests)
// ============================================================================

describe('PIIRedactor', () => {
  describe('constructor', () => {
    it('should create with default partial level', () => {
      const redactor = new PIIRedactor();
      expect(redactor).toBeInstanceOf(PIIRedactor);
    });

    it('should create with explicit none level', () => {
      const redactor = new PIIRedactor('none');
      expect(redactor).toBeInstanceOf(PIIRedactor);
    });

    it('should create with explicit full level', () => {
      const redactor = new PIIRedactor('full');
      expect(redactor).toBeInstanceOf(PIIRedactor);
    });
  });

  describe('redact with none level', () => {
    it('should return text unchanged when level is none', () => {
      const redactor = new PIIRedactor('none');
      const input = 'Contact john@example.com or call 555-123-4567';
      expect(redactor.redact(input)).toBe(input);
    });

    it('should not redact any PII when level is none', () => {
      const redactor = new PIIRedactor('none');
      const input = 'SSN: 123-45-6789, API: sk-test1234567890abcdef';
      expect(redactor.redact(input)).toBe(input);
    });
  });

  describe('redact with partial level', () => {
    it('should redact email addresses in partial mode', () => {
      const redactor = new PIIRedactor('partial');
      const input = 'Email me at john@example.com please';
      expect(redactor.redact(input)).toBe('Email me at [EMAIL_REDACTED] please');
    });

    it('should redact SSN in partial mode', () => {
      const redactor = new PIIRedactor('partial');
      const input = 'My SSN is 123-45-6789';
      expect(redactor.redact(input)).toBe('My SSN is [SSN_REDACTED]');
    });

    it('should redact API keys in partial mode', () => {
      const redactor = new PIIRedactor('partial');
      const input = 'Key: sk-abcdefghijklmnopqrstuvwxyz123456';
      expect(redactor.redact(input)).toBe('Key: [API_KEY_REDACTED]');
    });

    it('should redact credit cards in partial mode', () => {
      const redactor = new PIIRedactor('partial');
      const input = 'Card: 4111-1111-1111-1111';
      expect(redactor.redact(input)).toBe('Card: [CC_REDACTED]');
    });

    it('should NOT redact phone numbers in partial mode', () => {
      const redactor = new PIIRedactor('partial');
      const input = 'Call 555-123-4567';
      expect(redactor.redact(input)).toBe('Call 555-123-4567');
    });

    it('should NOT redact names in partial mode', () => {
      const redactor = new PIIRedactor('partial');
      const input = 'Contact John Smith for details';
      expect(redactor.redact(input)).toBe('Contact John Smith for details');
    });
  });

  describe('redact with full level', () => {
    it('should redact all PII types in full mode', () => {
      const redactor = new PIIRedactor('full');
      const input = 'Email: john@example.com, Phone: 555-123-4567';
      const result = redactor.redact(input);
      expect(result).toContain('[EMAIL_REDACTED]');
      expect(result).toContain('[PHONE_REDACTED]');
    });

    it('should redact names in full mode', () => {
      const redactor = new PIIRedactor('full');
      const input = 'Contact John Smith tomorrow';
      const result = redactor.redact(input);
      // Name pattern redacts "John Smith" (two capitalized words)
      expect(result).toContain('[NAME_REDACTED]');
      expect(result).not.toContain('John Smith');
    });

    it('should redact IP addresses in full mode', () => {
      const redactor = new PIIRedactor('full');
      const input = 'Server at 192.168.1.1';
      expect(redactor.redact(input)).toBe('Server at [IP_REDACTED]');
    });
  });

  describe('individual redaction methods', () => {
    let redactor: PIIRedactor;

    beforeEach(() => {
      redactor = new PIIRedactor('none');
    });

    it('should redact email addresses', () => {
      expect(redactor.redactEmail('test@example.com')).toBe('[EMAIL_REDACTED]');
      expect(redactor.redactEmail('user.name+tag@domain.co.uk')).toBe('[EMAIL_REDACTED]');
    });

    it('should redact phone numbers', () => {
      expect(redactor.redactPhone('555-123-4567')).toBe('[PHONE_REDACTED]');
      expect(redactor.redactPhone('(555) 123-4567')).toContain('[PHONE_REDACTED]');
      expect(redactor.redactPhone('+1 555 123 4567')).toContain('[PHONE_REDACTED]');
    });

    it('should redact SSN formats', () => {
      expect(redactor.redactSSN('123-45-6789')).toBe('[SSN_REDACTED]');
      expect(redactor.redactSSN('123.45.6789')).toBe('[SSN_REDACTED]');
      expect(redactor.redactSSN('123 45 6789')).toBe('[SSN_REDACTED]');
    });

    it('should redact API keys', () => {
      expect(redactor.redactAPIKey('sk-abcdefghijklmnopqrstuvwxyz123456')).toBe('[API_KEY_REDACTED]');
      expect(redactor.redactAPIKey('ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')).toBe('[API_KEY_REDACTED]');
    });

    it('should redact IP addresses', () => {
      expect(redactor.redactIP('192.168.1.1')).toBe('[IP_REDACTED]');
      expect(redactor.redactIP('10.0.0.255')).toBe('[IP_REDACTED]');
    });

    it('should redact credit card numbers', () => {
      expect(redactor.redactCreditCard('4111-1111-1111-1111')).toBe('[CC_REDACTED]');
      expect(redactor.redactCreditCard('4111 1111 1111 1111')).toBe('[CC_REDACTED]');
    });

    it('should redact names', () => {
      expect(redactor.redactName('John Smith')).toBe('[NAME_REDACTED]');
      expect(redactor.redactName('Alice Johnson')).toBe('[NAME_REDACTED]');
    });
  });

  describe('redactObject', () => {
    it('should recursively redact object values', () => {
      const redactor = new PIIRedactor('partial');
      const input = {
        name: 'John Doe',
        email: 'john@example.com',
        nested: {
          ssn: '123-45-6789',
        },
        count: 42,
      };
      const result = redactor.redactObject(input);
      expect(result.email).toBe('[EMAIL_REDACTED]');
      expect(result.nested.ssn).toBe('[SSN_REDACTED]');
      expect(result.count).toBe(42);
    });

    it('should handle empty objects', () => {
      const redactor = new PIIRedactor('partial');
      const result = redactor.redactObject({});
      expect(result).toEqual({});
    });
  });

  describe('createPIIRedactor factory', () => {
    it('should create redactor with default level', () => {
      const redactor = createPIIRedactor();
      expect(redactor).toBeInstanceOf(PIIRedactor);
    });

    it('should create redactor with specified level', () => {
      const redactor = createPIIRedactor('full');
      expect(redactor).toBeInstanceOf(PIIRedactor);
    });
  });
});

// ============================================================================
// AuditTrail Tests (25 tests)
// ============================================================================

describe('AuditTrail', () => {
  let auditTrail: AuditTrail;
  let config: AuditTrailConfig;

  beforeEach(() => {
    config = { ...DEFAULT_AUDIT_TRAIL_CONFIG };
    auditTrail = new AuditTrail(config);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    auditTrail.clear();
  });

  describe('logDecision', () => {
    it('should create a hashed log entry', async () => {
      const log = await auditTrail.logDecision(
        'agent-1',
        'intent',
        'test input',
        'test output',
        'test reasoning',
        'traj-1',
        'low',
        {}
      );
      expect(log).toHaveProperty('id');
      expect(log).toHaveProperty('hash');
      expect(log.hash).toHaveLength(64); // SHA256 hex
      expect(log.previousHash).toBe('0'.repeat(64));
    });

    it('should include timestamp in log', async () => {
      const now = 1234567890;
      vi.setSystemTime(now);
      const log = await auditTrail.logDecision(
        'agent-1',
        'plan',
        'input',
        'output',
        'reasoning',
        'traj-1'
      );
      expect(log.timestamp).toBe(now);
    });

    it('should link logs in hash chain', async () => {
      const log1 = await auditTrail.logDecision(
        'agent-1',
        'intent',
        'input1',
        'output1',
        'reasoning1',
        'traj-1'
      );
      const log2 = await auditTrail.logDecision(
        'agent-1',
        'plan',
        'input2',
        'output2',
        'reasoning2',
        'traj-1'
      );
      expect(log2.previousHash).toBe(log1.hash);
    });

    it('should include compliance tags', async () => {
      const log = await auditTrail.logDecision(
        'agent-1',
        'intent',
        'input',
        'output',
        'reasoning',
        'traj-1',
        'high'
      );
      expect(log.complianceTags).toContain('eu-ai-act-article-86');
      expect(log.complianceTags).toContain('human-oversight-required');
    });

    it('should include metadata', async () => {
      const metadata = { customField: 'value', number: 42 };
      const log = await auditTrail.logDecision(
        'agent-1',
        'intent',
        'input',
        'output',
        'reasoning',
        'traj-1',
        'low',
        metadata
      );
      expect(log.metadata).toEqual(metadata);
    });
  });

  describe('hash chain integrity', () => {
    it('should maintain chain with multiple logs', async () => {
      for (let i = 0; i < 5; i++) {
        await auditTrail.logDecision(
          'agent-1',
          'intent',
          `input-${i}`,
          `output-${i}`,
          'reasoning',
          'traj-1'
        );
      }
      const chain = auditTrail.getAllLogs();
      expect(chain).toHaveLength(5);
      for (let i = 1; i < chain.length; i++) {
        expect(chain[i].previousHash).toBe(chain[i - 1].hash);
      }
    });

    it('should have unique hashes for each log', async () => {
      const log1 = await auditTrail.logDecision(
        'agent-1',
        'intent',
        'input',
        'output',
        'reasoning',
        'traj-1'
      );
      const log2 = await auditTrail.logDecision(
        'agent-1',
        'intent',
        'input',
        'output',
        'reasoning',
        'traj-1'
      );
      expect(log1.hash).not.toBe(log2.hash);
    });
  });

  describe('verifyIntegrity', () => {
    it('should return valid for untampered chain', async () => {
      await auditTrail.logDecision('agent-1', 'intent', 'input', 'output', 'reasoning', 'traj-1');
      await auditTrail.logDecision('agent-1', 'plan', 'input', 'output', 'reasoning', 'traj-1');
      const result = auditTrail.verifyIntegrity();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect hash tampering', async () => {
      await auditTrail.logDecision('agent-1', 'intent', 'input', 'output', 'reasoning', 'traj-1');
      const logs = auditTrail.getAllLogs();
      // Tamper with the hash
      (logs[0] as AIDecisionLog & { hash: string }).hash = 'tampered';
      const result = auditTrail.verifyIntegrity();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect chain break', async () => {
      await auditTrail.logDecision('agent-1', 'intent', 'input', 'output', 'reasoning', 'traj-1');
      await auditTrail.logDecision('agent-1', 'plan', 'input', 'output', 'reasoning', 'traj-1');
      const logs = auditTrail.getAllLogs();
      // Break the chain
      (logs[1] as AIDecisionLog & { previousHash: string }).previousHash = 'broken';
      const result = auditTrail.verifyIntegrity();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('chain break'))).toBe(true);
    });
  });

  describe('getLog', () => {
    it('should retrieve log by ID', async () => {
      const log = await auditTrail.logDecision(
        'agent-1',
        'intent',
        'input',
        'output',
        'reasoning',
        'traj-1'
      );
      const retrieved = auditTrail.getLog(log.id);
      expect(retrieved).toEqual(log);
    });

    it('should return undefined for non-existent ID', () => {
      const retrieved = auditTrail.getLog('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAllLogs', () => {
    it('should return all logs', async () => {
      await auditTrail.logDecision('agent-1', 'intent', 'input1', 'output1', 'reasoning', 'traj-1');
      await auditTrail.logDecision('agent-2', 'plan', 'input2', 'output2', 'reasoning', 'traj-1');
      const logs = auditTrail.getAllLogs();
      expect(logs).toHaveLength(2);
    });

    it('should return copy of logs array', async () => {
      await auditTrail.logDecision('agent-1', 'intent', 'input', 'output', 'reasoning', 'traj-1');
      const logs1 = auditTrail.getAllLogs();
      const logs2 = auditTrail.getAllLogs();
      expect(logs1).not.toBe(logs2);
    });
  });

  describe('getChain', () => {
    it('should return all logs when no fromId provided', async () => {
      await auditTrail.logDecision('agent-1', 'intent', 'input1', 'output1', 'reasoning', 'traj-1');
      await auditTrail.logDecision('agent-1', 'plan', 'input2', 'output2', 'reasoning', 'traj-1');
      const chain = auditTrail.getChain();
      expect(chain).toHaveLength(2);
    });

    it('should return chain from specific log', async () => {
      const log1 = await auditTrail.logDecision('agent-1', 'intent', 'input1', 'output1', 'reasoning', 'traj-1');
      await auditTrail.logDecision('agent-1', 'plan', 'input2', 'output2', 'reasoning', 'traj-1');
      await auditTrail.logDecision('agent-1', 'codegen', 'input3', 'output3', 'reasoning', 'traj-1');
      const chain = auditTrail.getChain(log1.id);
      expect(chain).toHaveLength(3);
    });

    it('should return empty array for non-existent fromId', () => {
      const chain = auditTrail.getChain('non-existent');
      expect(chain).toEqual([]);
    });
  });

  describe('exportLogs', () => {
    it('should export logs as JSON', async () => {
      await auditTrail.logDecision('agent-1', 'intent', 'input', 'output', 'reasoning', 'traj-1');
      const json = await auditTrail.exportLogs('json');
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
    });

    it('should export logs as CSV', async () => {
      await auditTrail.logDecision('agent-1', 'intent', 'input', 'output', 'reasoning', 'traj-1');
      const csv = await auditTrail.exportLogs('csv');
      expect(csv).toContain('id,timestamp,agentId');
      expect(csv.split('\n')).toHaveLength(2); // header + 1 row
    });

    it('should export logs as PDF mock', async () => {
      await auditTrail.logDecision('agent-1', 'intent', 'input', 'output', 'reasoning', 'traj-1');
      const pdf = await auditTrail.exportLogs('pdf');
      expect(pdf).toContain('[PDF_EXPORT_MOCK]');
      expect(pdf).toContain('1 logs');
    });

    it('should throw for unsupported format', async () => {
      await expect(auditTrail.exportLogs('xml' as 'json')).rejects.toThrow('Unsupported format');
    });
  });

  describe('getStats', () => {
    it('should return total logs count', async () => {
      await auditTrail.logDecision('agent-1', 'intent', 'input', 'output', 'reasoning', 'traj-1');
      await auditTrail.logDecision('agent-1', 'plan', 'input', 'output', 'reasoning', 'traj-1');
      const stats = auditTrail.getStats();
      expect(stats.totalLogs).toBe(2);
    });

    it('should return stats by agent', async () => {
      await auditTrail.logDecision('agent-1', 'intent', 'input', 'output', 'reasoning', 'traj-1');
      await auditTrail.logDecision('agent-2', 'intent', 'input', 'output', 'reasoning', 'traj-1');
      await auditTrail.logDecision('agent-1', 'plan', 'input', 'output', 'reasoning', 'traj-1');
      const stats = auditTrail.getStats();
      expect(stats.byAgent['agent-1']).toBe(2);
      expect(stats.byAgent['agent-2']).toBe(1);
    });

    it('should return stats by risk level', async () => {
      await auditTrail.logDecision('agent-1', 'intent', 'input', 'output', 'reasoning', 'traj-1', 'low');
      await auditTrail.logDecision('agent-1', 'plan', 'input', 'output', 'reasoning', 'traj-1', 'high');
      await auditTrail.logDecision('agent-1', 'codegen', 'input', 'output', 'reasoning', 'traj-1', 'high');
      const stats = auditTrail.getStats();
      expect(stats.byRiskLevel['low']).toBe(1);
      expect(stats.byRiskLevel['high']).toBe(2);
    });

    it('should return stats by decision type', async () => {
      await auditTrail.logDecision('agent-1', 'intent', 'input', 'output', 'reasoning', 'traj-1');
      await auditTrail.logDecision('agent-1', 'plan', 'input', 'output', 'reasoning', 'traj-1');
      await auditTrail.logDecision('agent-1', 'codegen', 'input', 'output', 'reasoning', 'traj-1');
      const stats = auditTrail.getStats();
      expect(stats.byDecisionType['intent']).toBe(1);
      expect(stats.byDecisionType['plan']).toBe(1);
      expect(stats.byDecisionType['codegen']).toBe(1);
    });
  });

  describe('PII redaction before logging', () => {
    it('should redact email before logging with partial level', async () => {
      const configWithRedaction: AuditTrailConfig = {
        ...DEFAULT_AUDIT_TRAIL_CONFIG,
        piiRedactionLevel: 'partial',
      };
      const trail = new AuditTrail(configWithRedaction);
      const log = await trail.logDecision(
        'agent-1',
        'intent',
        'Contact john@example.com',
        'output',
        'reasoning',
        'traj-1'
      );
      expect(log.inputSummary).toContain('[EMAIL_REDACTED]');
      expect(log.inputSummary).not.toContain('john@example.com');
    });

    it('should redact PII in output as well', async () => {
      const configWithRedaction: AuditTrailConfig = {
        ...DEFAULT_AUDIT_TRAIL_CONFIG,
        piiRedactionLevel: 'partial',
      };
      const trail = new AuditTrail(configWithRedaction);
      const log = await trail.logDecision(
        'agent-1',
        'intent',
        'input',
        'SSN: 123-45-6789 here',
        'reasoning',
        'traj-1'
      );
      expect(log.outputSummary).toContain('[SSN_REDACTED]');
    });
  });

  describe('disabled trail', () => {
    it('should throw error when logging to disabled trail', async () => {
      const disabledConfig: AuditTrailConfig = {
        ...DEFAULT_AUDIT_TRAIL_CONFIG,
        enabled: false,
      };
      const disabledTrail = new AuditTrail(disabledConfig);
      await expect(
        disabledTrail.logDecision('agent-1', 'intent', 'input', 'output', 'reasoning', 'traj-1')
      ).rejects.toThrow('Audit trail is disabled');
    });
  });

  describe('createAuditTrail factory', () => {
    it('should create audit trail with config', () => {
      const trail = createAuditTrail(DEFAULT_AUDIT_TRAIL_CONFIG);
      expect(trail).toBeInstanceOf(AuditTrail);
    });
  });
});

// ============================================================================
// TrajectoryRecorder Tests (25 tests)
// ============================================================================

describe('TrajectoryRecorder', () => {
  let recorder: TrajectoryRecorder;

  beforeEach(() => {
    recorder = new TrajectoryRecorder();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    recorder.clear();
  });

  describe('startTrajectory', () => {
    it('should create a new trajectory and return ID', () => {
      const id = recorder.startTrajectory('Create new feature');
      expect(typeof id).toBe('string');
      expect(id).toContain('traj-');
    });

    it('should store trajectory with root intent', () => {
      const id = recorder.startTrajectory('Test intent');
      const trajectory = recorder.getTrajectory(id);
      expect(trajectory).toBeDefined();
      expect(trajectory?.rootIntent).toBe('Test intent');
    });

    it('should create empty steps array', () => {
      const id = recorder.startTrajectory('Test');
      const trajectory = recorder.getTrajectory(id);
      expect(trajectory?.steps).toEqual([]);
    });

    it('should initialize with zero compliance score', () => {
      const id = recorder.startTrajectory('Test');
      const trajectory = recorder.getTrajectory(id);
      expect(trajectory?.complianceScore).toBe(0);
    });
  });

  describe('recordStep', () => {
    it('should add step to active trajectory', () => {
      const id = recorder.startTrajectory('Test');
      recorder.recordStep(id, 'agent-1', 'analyze', 'log-1', 100, 0.8);
      const trajectory = recorder.getTrajectory(id);
      expect(trajectory?.steps).toHaveLength(1);
    });

    it('should store step details correctly', () => {
      const id = recorder.startTrajectory('Test');
      vi.setSystemTime(1234567890);
      recorder.recordStep(id, 'agent-1', 'analyze', 'log-1', 100, 0.8);
      const trajectory = recorder.getTrajectory(id);
      const step = trajectory?.steps[0];
      expect(step?.agent).toBe('agent-1');
      expect(step?.action).toBe('analyze');
      expect(step?.decisionLogId).toBe('log-1');
      expect(step?.tokensUsed).toBe(100);
      expect(step?.tasteVaultInfluence).toBe(0.8);
      expect(step?.timestamp).toBe(1234567890);
    });

    it('should throw for non-existent trajectory', () => {
      expect(() => {
        recorder.recordStep('non-existent', 'agent-1', 'action', 'log-1', 100, 0.5);
      }).toThrow('Trajectory not found');
    });

    it('should support multiple steps', () => {
      const id = recorder.startTrajectory('Test');
      recorder.recordStep(id, 'agent-1', 'step1', 'log-1', 50, 0.6);
      recorder.recordStep(id, 'agent-2', 'step2', 'log-2', 75, 0.7);
      recorder.recordStep(id, 'agent-1', 'step3', 'log-3', 100, 0.8);
      const trajectory = recorder.getTrajectory(id);
      expect(trajectory?.steps).toHaveLength(3);
    });
  });

  describe('completeTrajectory', () => {
    it('should mark trajectory as completed', () => {
      const id = recorder.startTrajectory('Test');
      recorder.recordStep(id, 'agent-1', 'action', 'log-1', 100, 0.5);
      const completed = recorder.completeTrajectory(id, 'Success');
      expect(completed.finalOutcome).toBe('Success');
    });

    it('should calculate duration from first to last step', () => {
      const id = recorder.startTrajectory('Test');
      vi.setSystemTime(1000);
      recorder.recordStep(id, 'agent-1', 'step1', 'log-1', 100, 0.5);
      vi.setSystemTime(5000);
      recorder.recordStep(id, 'agent-1', 'step2', 'log-2', 100, 0.5);
      const completed = recorder.completeTrajectory(id, 'Done');
      expect(completed.totalDurationMs).toBe(4000);
    });

    it('should calculate compliance score', () => {
      const id = recorder.startTrajectory('Test');
      recorder.recordStep(id, 'agent-1', 'action', 'log-1', 100, 0.8);
      const completed = recorder.completeTrajectory(id, 'Done');
      expect(completed.complianceScore).toBeGreaterThanOrEqual(0);
      expect(completed.complianceScore).toBeLessThanOrEqual(100);
    });

    it('should throw for non-existent trajectory', () => {
      expect(() => {
        recorder.completeTrajectory('non-existent', 'Done');
      }).toThrow('Trajectory not found');
    });

    it('should move trajectory from active to completed', () => {
      const id = recorder.startTrajectory('Test');
      recorder.recordStep(id, 'agent-1', 'action', 'log-1', 100, 0.5);
      recorder.completeTrajectory(id, 'Done');
      const lists = recorder.listTrajectories();
      expect(lists.active).not.toContain(id);
      expect(lists.completed).toContain(id);
    });
  });

  describe('getTrajectory', () => {
    it('should retrieve active trajectory', () => {
      const id = recorder.startTrajectory('Test');
      const trajectory = recorder.getTrajectory(id);
      expect(trajectory?.id).toBe(id);
    });

    it('should retrieve completed trajectory', () => {
      const id = recorder.startTrajectory('Test');
      recorder.recordStep(id, 'agent-1', 'action', 'log-1', 100, 0.5);
      recorder.completeTrajectory(id, 'Done');
      const trajectory = recorder.getTrajectory(id);
      expect(trajectory?.finalOutcome).toBe('Done');
    });

    it('should return undefined for non-existent trajectory', () => {
      const trajectory = recorder.getTrajectory('non-existent');
      expect(trajectory).toBeUndefined();
    });
  });

  describe('listTrajectories', () => {
    it('should list active trajectories', () => {
      const id1 = recorder.startTrajectory('Test1');
      const id2 = recorder.startTrajectory('Test2');
      const lists = recorder.listTrajectories();
      expect(lists.active).toContain(id1);
      expect(lists.active).toContain(id2);
      expect(lists.active).toHaveLength(2);
    });

    it('should list completed trajectories', () => {
      const id = recorder.startTrajectory('Test');
      recorder.recordStep(id, 'agent-1', 'action', 'log-1', 100, 0.5);
      recorder.completeTrajectory(id, 'Done');
      const lists = recorder.listTrajectories();
      expect(lists.completed).toContain(id);
      expect(lists.completed).toHaveLength(1);
    });

    it('should separate active and completed', () => {
      const activeId = recorder.startTrajectory('Active');
      const completedId = recorder.startTrajectory('Completed');
      recorder.recordStep(completedId, 'agent-1', 'action', 'log-1', 100, 0.5);
      recorder.completeTrajectory(completedId, 'Done');
      const lists = recorder.listTrajectories();
      expect(lists.active).toContain(activeId);
      expect(lists.active).not.toContain(completedId);
      expect(lists.completed).toContain(completedId);
      expect(lists.completed).not.toContain(activeId);
    });
  });

  describe('replayTrajectory', () => {
    it('should yield all steps asynchronously', async () => {
      const id = recorder.startTrajectory('Test');
      recorder.recordStep(id, 'agent-1', 'step1', 'log-1', 50, 0.6);
      recorder.recordStep(id, 'agent-2', 'step2', 'log-2', 75, 0.7);
      recorder.completeTrajectory(id, 'Done');
      
      const steps: AgentTrajectory['steps'] = [];
      for await (const step of recorder.replayTrajectory(id)) {
        steps.push(step);
      }
      expect(steps).toHaveLength(2);
      expect(steps[0].action).toBe('step1');
      expect(steps[1].action).toBe('step2');
    });

    it('should throw for non-existent trajectory', async () => {
      const generator = recorder.replayTrajectory('non-existent');
      await expect(generator.next()).rejects.toThrow('Trajectory not found');
    });
  });

  describe('getNarrative', () => {
    it('should generate narrative for trajectory', () => {
      const id = recorder.startTrajectory('Build feature');
      recorder.recordStep(id, 'agent-1', 'analyze requirements', 'log-1', 100, 0.8);
      recorder.completeTrajectory(id, 'Feature built');
      const narrative = recorder.getNarrative(id);
      expect(narrative).toContain('Trajectory:');
      expect(narrative).toContain('Intent: Build feature');
      expect(narrative).toContain('Outcome: Feature built');
    });

    it('should include step details in narrative', () => {
      const id = recorder.startTrajectory('Test');
      recorder.recordStep(id, 'agent-1', 'action1', 'log-1', 100, 0.8);
      recorder.completeTrajectory(id, 'Done');
      const narrative = recorder.getNarrative(id);
      expect(narrative).toContain('agent-1: action1');
      expect(narrative).toContain('Tokens: 100');
      // Taste vault influence is shown as percentage (0.8 = 80%)
      expect(narrative).toContain('Taste Vault:');
    });

    it('should throw for non-existent trajectory', () => {
      expect(() => {
        recorder.getNarrative('non-existent');
      }).toThrow('Trajectory not found');
    });
  });

  describe('calculateComplianceScore', () => {
    it('should start with base score of 100', () => {
      const id = recorder.startTrajectory('Test');
      recorder.recordStep(id, 'agent-1', 'action', 'log-1', 100, 0.8);
      const completed = recorder.completeTrajectory(id, 'Done');
      expect(completed.complianceScore).toBe(100);
    });

    it('should deduct for long trajectories (>10 steps)', () => {
      const id = recorder.startTrajectory('Test');
      for (let i = 0; i < 12; i++) {
        recorder.recordStep(id, 'agent-1', `step-${i}`, `log-${i}`, 10, 0.8);
      }
      const completed = recorder.completeTrajectory(id, 'Done');
      expect(completed.complianceScore).toBeLessThan(100);
    });

    it('should deduct for high token usage (>10000)', () => {
      const id = recorder.startTrajectory('Test');
      recorder.recordStep(id, 'agent-1', 'action', 'log-1', 15000, 0.8);
      const completed = recorder.completeTrajectory(id, 'Done');
      expect(completed.complianceScore).toBeLessThan(100);
    });

    it('should deduct for low taste vault influence (<0.5)', () => {
      const id = recorder.startTrajectory('Test');
      recorder.recordStep(id, 'agent-1', 'action', 'log-1', 100, 0.3);
      const completed = recorder.completeTrajectory(id, 'Done');
      expect(completed.complianceScore).toBeLessThan(100);
    });

    it('should not go below zero', () => {
      const id = recorder.startTrajectory('Test');
      // Add many steps with low influence to reduce score significantly
      for (let i = 0; i < 15; i++) {
        recorder.recordStep(id, 'agent-1', `step-${i}`, `log-${i}`, 50000, 0.1);
      }
      const completed = recorder.completeTrajectory(id, 'Done');
      // Score should be clamped at minimum 0
      expect(completed.complianceScore).toBeGreaterThanOrEqual(0);
      expect(completed.complianceScore).toBeLessThanOrEqual(100);
    });
  });

  describe('getStats', () => {
    it('should return total trajectories count', () => {
      recorder.startTrajectory('Test1');
      recorder.startTrajectory('Test2');
      const stats = recorder.getStats();
      expect(stats.totalTrajectories).toBe(2);
    });

    it('should return active and completed counts', () => {
      const id = recorder.startTrajectory('Test');
      recorder.recordStep(id, 'agent-1', 'action', 'log-1', 100, 0.5);
      recorder.completeTrajectory(id, 'Done');
      recorder.startTrajectory('Active');
      const stats = recorder.getStats();
      expect(stats.activeCount).toBe(1);
      expect(stats.completedCount).toBe(1);
    });

    it('should calculate average steps', () => {
      const id1 = recorder.startTrajectory('Test1');
      recorder.recordStep(id1, 'agent-1', 'action', 'log-1', 100, 0.5);
      recorder.completeTrajectory(id1, 'Done');
      const id2 = recorder.startTrajectory('Test2');
      recorder.recordStep(id2, 'agent-1', 'action1', 'log-1', 100, 0.5);
      recorder.recordStep(id2, 'agent-1', 'action2', 'log-2', 100, 0.5);
      recorder.completeTrajectory(id2, 'Done');
      const stats = recorder.getStats();
      expect(stats.averageSteps).toBe(1.5);
    });

    it('should calculate average duration', () => {
      const id = recorder.startTrajectory('Test');
      vi.setSystemTime(1000);
      recorder.recordStep(id, 'agent-1', 'step1', 'log-1', 100, 0.5);
      vi.setSystemTime(5000);
      recorder.recordStep(id, 'agent-1', 'step2', 'log-2', 100, 0.5);
      recorder.completeTrajectory(id, 'Done');
      const stats = recorder.getStats();
      expect(stats.averageDuration).toBe(4000);
    });

    it('should handle empty recorder', () => {
      const stats = recorder.getStats();
      expect(stats.totalTrajectories).toBe(0);
      expect(stats.averageSteps).toBe(0);
      expect(stats.averageDuration).toBe(0);
    });
  });

  describe('multi-step trajectories', () => {
    it('should handle complex multi-step workflow', () => {
      const id = recorder.startTrajectory('Build feature');
      recorder.recordStep(id, 'planner', 'analyze', 'log-1', 500, 0.9);
      recorder.recordStep(id, 'designer', 'create-design', 'log-2', 800, 0.85);
      recorder.recordStep(id, 'coder', 'implement', 'log-3', 2000, 0.75);
      recorder.recordStep(id, 'reviewer', 'review', 'log-4', 600, 0.9);
      const completed = recorder.completeTrajectory(id, 'Feature deployed');
      expect(completed.steps).toHaveLength(4);
      expect(completed.finalOutcome).toBe('Feature deployed');
    });

    it('should calculate correct duration for multi-step', () => {
      const id = recorder.startTrajectory('Test');
      vi.setSystemTime(0);
      recorder.recordStep(id, 'agent-1', 'step1', 'log-1', 100, 0.5);
      vi.setSystemTime(1000);
      recorder.recordStep(id, 'agent-1', 'step2', 'log-2', 100, 0.5);
      vi.setSystemTime(3000);
      recorder.recordStep(id, 'agent-1', 'step3', 'log-3', 100, 0.5);
      const completed = recorder.completeTrajectory(id, 'Done');
      expect(completed.totalDurationMs).toBe(3000);
    });
  });

  describe('createTrajectoryRecorder factory', () => {
    it('should create trajectory recorder', () => {
      const rec = createTrajectoryRecorder();
      expect(rec).toBeInstanceOf(TrajectoryRecorder);
    });
  });
});

// ============================================================================
// ExplanationEngine Tests (16 tests)
// ============================================================================

describe('ExplanationEngine', () => {
  let trajectoryRecorder: TrajectoryRecorder;
  let explanationEngine: ExplanationEngine;

  beforeEach(() => {
    trajectoryRecorder = new TrajectoryRecorder();
    explanationEngine = new ExplanationEngine(trajectoryRecorder);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    trajectoryRecorder.clear();
  });

  describe('generateExplanation', () => {
    it('should generate explanation with summary depth', () => {
      const trajectoryId = trajectoryRecorder.startTrajectory('Test');
      trajectoryRecorder.recordStep(trajectoryId, 'agent-1', 'action', 'log-1', 100, 0.8);
      trajectoryRecorder.completeTrajectory(trajectoryId, 'Done');
      
      const decisionLog: AIDecisionLog = {
        id: 'decision-1',
        timestamp: Date.now(),
        previousHash: '0'.repeat(64),
        hash: 'abc123',
        agentId: 'agent-1',
        decisionType: 'intent',
        inputSummary: 'test input',
        outputSummary: 'test output',
        reasoning: 'Test reasoning for decision',
        trajectoryId,
        riskLevel: 'low',
        complianceTags: ['eu-ai-act-article-86'],
        metadata: {},
      };

      const explanation = explanationEngine.generateExplanation(
        { decisionLogId: 'decision-1', depth: 'summary' },
        decisionLog
      );

      expect(explanation.decisionLogId).toBe('decision-1');
      expect(explanation.narrative).toContain('Decision: intent');
      expect(explanation.narrative).toContain('Made by: agent-1');
      expect(explanation.complianceScore).toBeGreaterThanOrEqual(0);
    });

    it('should include trajectory steps in explanation', () => {
      const trajectoryId = trajectoryRecorder.startTrajectory('Test');
      trajectoryRecorder.recordStep(trajectoryId, 'agent-1', 'action', 'log-1', 100, 0.8);
      trajectoryRecorder.completeTrajectory(trajectoryId, 'Done');
      
      const decisionLog: AIDecisionLog = {
        id: 'decision-1',
        timestamp: Date.now(),
        previousHash: '0'.repeat(64),
        hash: 'abc123',
        agentId: 'agent-1',
        decisionType: 'intent',
        inputSummary: 'input',
        outputSummary: 'output',
        reasoning: 'reasoning',
        trajectoryId,
        riskLevel: 'low',
        complianceTags: [],
        metadata: {},
      };

      const explanation = explanationEngine.generateExplanation(
        { decisionLogId: 'decision-1', depth: 'summary' },
        decisionLog
      );

      expect(explanation.trajectorySteps).toHaveLength(1);
    });

    it('should include detailed depth information', () => {
      const trajectoryId = trajectoryRecorder.startTrajectory('Build feature');
      trajectoryRecorder.recordStep(trajectoryId, 'agent-1', 'step1', 'log-1', 100, 0.8);
      trajectoryRecorder.completeTrajectory(trajectoryId, 'Done');
      
      const decisionLog: AIDecisionLog = {
        id: 'decision-1',
        timestamp: Date.now(),
        previousHash: '0'.repeat(64),
        hash: 'abc123',
        agentId: 'agent-1',
        decisionType: 'intent',
        inputSummary: 'input',
        outputSummary: 'output',
        reasoning: 'reasoning',
        trajectoryId,
        riskLevel: 'medium',
        complianceTags: ['eu-ai-act-article-86'],
        metadata: {},
      };

      const explanation = explanationEngine.generateExplanation(
        { decisionLogId: 'decision-1', depth: 'detailed' },
        decisionLog
      );

      expect(explanation.narrative).toContain('larger workflow');
      expect(explanation.narrative).toContain('Build feature');
    });

    it('should include technical depth information', () => {
      const trajectoryId = trajectoryRecorder.startTrajectory('Test');
      trajectoryRecorder.recordStep(trajectoryId, 'agent-1', 'action', 'log-1', 100, 0.8);
      trajectoryRecorder.completeTrajectory(trajectoryId, 'Done');
      
      const decisionLog: AIDecisionLog = {
        id: 'decision-1',
        timestamp: Date.now(),
        previousHash: '0'.repeat(64),
        hash: 'abc123',
        agentId: 'agent-1',
        decisionType: 'intent',
        inputSummary: 'test input data here',
        outputSummary: 'test output data here',
        reasoning: 'reasoning',
        trajectoryId,
        riskLevel: 'low',
        complianceTags: ['eu-ai-act-article-86'],
        metadata: {},
      };

      const explanation = explanationEngine.generateExplanation(
        { decisionLogId: 'decision-1', depth: 'technical' },
        decisionLog
      );

      expect(explanation.narrative).toContain('Technical Details');
      expect(explanation.narrative).toContain('Trajectory ID');
      expect(explanation.narrative).toContain('Compliance Tags');
    });
  });

  describe('buildNarrative', () => {
    it('should include reasoning in narrative', () => {
      const decisionLog: AIDecisionLog = {
        id: 'decision-1',
        timestamp: Date.now(),
        previousHash: '0'.repeat(64),
        hash: 'abc123',
        agentId: 'agent-1',
        decisionType: 'intent',
        inputSummary: 'input',
        outputSummary: 'output',
        reasoning: 'This is the reasoning',
        trajectoryId: 'traj-1',
        riskLevel: 'low',
        complianceTags: [],
        metadata: {},
      };

      const explanation = explanationEngine.generateExplanation(
        { decisionLogId: 'decision-1', depth: 'summary' },
        decisionLog
      );

      expect(explanation.narrative).toContain('This is the reasoning');
    });

    it('should include risk level in narrative', () => {
      const decisionLog: AIDecisionLog = {
        id: 'decision-1',
        timestamp: Date.now(),
        previousHash: '0'.repeat(64),
        hash: 'abc123',
        agentId: 'agent-1',
        decisionType: 'intent',
        inputSummary: 'input',
        outputSummary: 'output',
        reasoning: 'reasoning',
        trajectoryId: 'traj-1',
        riskLevel: 'high',
        complianceTags: [],
        metadata: {},
      };

      const explanation = explanationEngine.generateExplanation(
        { decisionLogId: 'decision-1', depth: 'summary' },
        decisionLog
      );

      expect(explanation.narrative).toContain('Risk Level: high');
    });
  });

  describe('extractTasteVaultFactors', () => {
    it('should return empty array when no trajectory', () => {
      const decisionLog: AIDecisionLog = {
        id: 'decision-1',
        timestamp: Date.now(),
        previousHash: '0'.repeat(64),
        hash: 'abc123',
        agentId: 'agent-1',
        decisionType: 'intent',
        inputSummary: 'input',
        outputSummary: 'output',
        reasoning: 'reasoning',
        trajectoryId: 'non-existent',
        riskLevel: 'low',
        complianceTags: [],
        metadata: {},
      };

      const explanation = explanationEngine.generateExplanation(
        { decisionLogId: 'decision-1', depth: 'summary' },
        decisionLog
      );

      expect(explanation.tasteVaultFactors).toEqual([]);
    });

    it('should detect strong taste vault alignment (>80%)', () => {
      const trajectoryId = trajectoryRecorder.startTrajectory('Test');
      trajectoryRecorder.recordStep(trajectoryId, 'agent-1', 'action', 'log-1', 100, 0.9);
      trajectoryRecorder.completeTrajectory(trajectoryId, 'Done');
      
      const decisionLog: AIDecisionLog = {
        id: 'decision-1',
        timestamp: Date.now(),
        previousHash: '0'.repeat(64),
        hash: 'abc123',
        agentId: 'agent-1',
        decisionType: 'intent',
        inputSummary: 'input',
        outputSummary: 'output',
        reasoning: 'reasoning',
        trajectoryId,
        riskLevel: 'low',
        complianceTags: [],
        metadata: {},
      };

      const explanation = explanationEngine.generateExplanation(
        { decisionLogId: 'decision-1', depth: 'summary' },
        decisionLog
      );

      expect(explanation.tasteVaultFactors.some(f => f.includes('Strong'))).toBe(true);
    });

    it('should detect moderate taste vault alignment (50-80%)', () => {
      const trajectoryId = trajectoryRecorder.startTrajectory('Test');
      trajectoryRecorder.recordStep(trajectoryId, 'agent-1', 'action', 'log-1', 100, 0.6);
      trajectoryRecorder.completeTrajectory(trajectoryId, 'Done');
      
      const decisionLog: AIDecisionLog = {
        id: 'decision-1',
        timestamp: Date.now(),
        previousHash: '0'.repeat(64),
        hash: 'abc123',
        agentId: 'agent-1',
        decisionType: 'intent',
        inputSummary: 'input',
        outputSummary: 'output',
        reasoning: 'reasoning',
        trajectoryId,
        riskLevel: 'low',
        complianceTags: [],
        metadata: {},
      };

      const explanation = explanationEngine.generateExplanation(
        { decisionLogId: 'decision-1', depth: 'summary' },
        decisionLog
      );

      expect(explanation.tasteVaultFactors.some(f => f.includes('Moderate'))).toBe(true);
    });

    it('should detect low taste vault alignment (<50%)', () => {
      const trajectoryId = trajectoryRecorder.startTrajectory('Test');
      trajectoryRecorder.recordStep(trajectoryId, 'agent-1', 'action', 'log-1', 100, 0.3);
      trajectoryRecorder.completeTrajectory(trajectoryId, 'Done');
      
      const decisionLog: AIDecisionLog = {
        id: 'decision-1',
        timestamp: Date.now(),
        previousHash: '0'.repeat(64),
        hash: 'abc123',
        agentId: 'agent-1',
        decisionType: 'intent',
        inputSummary: 'input',
        outputSummary: 'output',
        reasoning: 'reasoning',
        trajectoryId,
        riskLevel: 'low',
        complianceTags: [],
        metadata: {},
      };

      const explanation = explanationEngine.generateExplanation(
        { decisionLogId: 'decision-1', depth: 'summary' },
        decisionLog
      );

      expect(explanation.tasteVaultFactors.some(f => f.includes('Low'))).toBe(true);
    });

    it('should identify agent with strongest alignment', () => {
      const trajectoryId = trajectoryRecorder.startTrajectory('Test');
      trajectoryRecorder.recordStep(trajectoryId, 'agent-1', 'action1', 'log-1', 100, 0.5);
      trajectoryRecorder.recordStep(trajectoryId, 'agent-2', 'action2', 'log-2', 100, 0.9);
      trajectoryRecorder.completeTrajectory(trajectoryId, 'Done');
      
      const decisionLog: AIDecisionLog = {
        id: 'decision-1',
        timestamp: Date.now(),
        previousHash: '0'.repeat(64),
        hash: 'abc123',
        agentId: 'agent-1',
        decisionType: 'intent',
        inputSummary: 'input',
        outputSummary: 'output',
        reasoning: 'reasoning',
        trajectoryId,
        riskLevel: 'low',
        complianceTags: [],
        metadata: {},
      };

      const explanation = explanationEngine.generateExplanation(
        { decisionLogId: 'decision-1', depth: 'summary' },
        decisionLog
      );

      expect(explanation.tasteVaultFactors.some(f => f.includes('agent-2'))).toBe(true);
    });
  });

  describe('explainTrajectory', () => {
    it('should generate trajectory explanation', () => {
      const trajectoryId = trajectoryRecorder.startTrajectory('Build feature');
      trajectoryRecorder.recordStep(trajectoryId, 'planner', 'analyze', 'log-1', 500, 0.9);
      trajectoryRecorder.recordStep(trajectoryId, 'coder', 'implement', 'log-2', 1000, 0.8);
      trajectoryRecorder.completeTrajectory(trajectoryId, 'Feature complete');
      
      const explanation = explanationEngine.explainTrajectory(trajectoryId);
      
      expect(explanation).toContain('=== Workflow Explanation ===');
      expect(explanation).toContain('Objective: Build feature');
      expect(explanation).toContain('Total Steps: 2');
      expect(explanation).toContain('Outcome:');
      expect(explanation).toContain('Feature complete');
    });

    it('should list agent involvement', () => {
      const trajectoryId = trajectoryRecorder.startTrajectory('Test');
      trajectoryRecorder.recordStep(trajectoryId, 'agent-1', 'action1', 'log-1', 100, 0.8);
      trajectoryRecorder.recordStep(trajectoryId, 'agent-2', 'action2', 'log-2', 100, 0.7);
      trajectoryRecorder.recordStep(trajectoryId, 'agent-1', 'action3', 'log-3', 100, 0.9);
      trajectoryRecorder.completeTrajectory(trajectoryId, 'Done');
      
      const explanation = explanationEngine.explainTrajectory(trajectoryId);
      
      expect(explanation).toContain('Agent Involvement:');
      expect(explanation).toContain('agent-1: 2 steps');
      expect(explanation).toContain('agent-2: 1 step');
    });

    it('should throw for non-existent trajectory', () => {
      expect(() => {
        explanationEngine.explainTrajectory('non-existent');
      }).toThrow('Trajectory not found');
    });
  });

  describe('compliance score inclusion', () => {
    it('should include compliance score in explanation', () => {
      const trajectoryId = trajectoryRecorder.startTrajectory('Test');
      trajectoryRecorder.recordStep(trajectoryId, 'agent-1', 'action', 'log-1', 100, 0.8);
      trajectoryRecorder.completeTrajectory(trajectoryId, 'Done');
      
      const decisionLog: AIDecisionLog = {
        id: 'decision-1',
        timestamp: Date.now(),
        previousHash: '0'.repeat(64),
        hash: 'abc123',
        agentId: 'agent-1',
        decisionType: 'intent',
        inputSummary: 'input',
        outputSummary: 'output',
        reasoning: 'reasoning',
        trajectoryId,
        riskLevel: 'low',
        complianceTags: [],
        metadata: {},
      };

      const explanation = explanationEngine.generateExplanation(
        { decisionLogId: 'decision-1', depth: 'summary' },
        decisionLog
      );

      expect(explanation.complianceScore).toBeDefined();
      expect(typeof explanation.complianceScore).toBe('number');
    });

    it('should reference compliance score in narrative', () => {
      const trajectoryId = trajectoryRecorder.startTrajectory('Test');
      trajectoryRecorder.recordStep(trajectoryId, 'agent-1', 'action', 'log-1', 100, 0.8);
      trajectoryRecorder.completeTrajectory(trajectoryId, 'Done');
      
      const decisionLog: AIDecisionLog = {
        id: 'decision-1',
        timestamp: Date.now(),
        previousHash: '0'.repeat(64),
        hash: 'abc123',
        agentId: 'agent-1',
        decisionType: 'intent',
        inputSummary: 'input',
        outputSummary: 'output',
        reasoning: 'reasoning',
        trajectoryId,
        riskLevel: 'low',
        complianceTags: ['eu-ai-act-article-86'],
        metadata: {},
      };

      const explanation = explanationEngine.generateExplanation(
        { decisionLogId: 'decision-1', depth: 'summary' },
        decisionLog
      );

      expect(explanation.narrative).toContain('compliance score');
      expect(explanation.narrative).toContain('/100');
    });
  });

  describe('createExplanationEngine factory', () => {
    it('should create explanation engine', () => {
      const engine = createExplanationEngine(trajectoryRecorder);
      expect(engine).toBeInstanceOf(ExplanationEngine);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Compliance Module Integration', () => {
  let auditTrail: AuditTrail;
  let trajectoryRecorder: TrajectoryRecorder;
  let explanationEngine: ExplanationEngine;

  beforeEach(() => {
    const config = { ...DEFAULT_AUDIT_TRAIL_CONFIG };
    auditTrail = new AuditTrail(config);
    trajectoryRecorder = new TrajectoryRecorder();
    explanationEngine = new ExplanationEngine(trajectoryRecorder);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    auditTrail.clear();
    trajectoryRecorder.clear();
  });

  it('should record full workflow with audit and trajectory', async () => {
    // Start trajectory
    const trajectoryId = trajectoryRecorder.startTrajectory('Create user dashboard');
    
    // Log first decision and record step
    const decision1 = await auditTrail.logDecision(
      'planner-agent',
      'intent',
      'Create dashboard for user@example.com',
      'Plan created',
      'Analyzed requirements',
      trajectoryId,
      'medium'
    );
    trajectoryRecorder.recordStep(trajectoryId, 'planner-agent', 'create-plan', decision1.id, 500, 0.85);
    
    // Log second decision
    const decision2 = await auditTrail.logDecision(
      'design-agent',
      'design',
      'Design dashboard UI',
      'UI mockup',
      'Created responsive design',
      trajectoryId,
      'low'
    );
    trajectoryRecorder.recordStep(trajectoryId, 'design-agent', 'create-design', decision2.id, 800, 0.75);
    
    // Complete trajectory
    const trajectory = trajectoryRecorder.completeTrajectory(trajectoryId, 'Dashboard created successfully');
    
    // Generate explanation
    const explanation = explanationEngine.generateExplanation(
      { decisionLogId: decision1.id, depth: 'detailed' },
      decision1
    );
    
    // Verify integration
    expect(trajectory.steps).toHaveLength(2);
    expect(explanation.trajectorySteps).toHaveLength(2);
    expect(explanation.narrative).toContain('Create user dashboard');
    
    // Verify PII redaction worked
    expect(decision1.inputSummary).toContain('[EMAIL_REDACTED]');
    
    // Verify audit chain integrity
    const integrity = auditTrail.verifyIntegrity();
    expect(integrity.valid).toBe(true);
  });

  it('should handle complete workflow with all risk levels', async () => {
    const trajectoryId = trajectoryRecorder.startTrajectory('Deploy application');
    
    const riskLevels: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical'];
    
    for (const risk of riskLevels) {
      const decision = await auditTrail.logDecision(
        'deploy-agent',
        'deploy',
        'Deploy to production',
        'Deployed',
        `Deployment with ${risk} risk`,
        trajectoryId,
        risk
      );
      trajectoryRecorder.recordStep(trajectoryId, 'deploy-agent', `deploy-${risk}`, decision.id, 100, 0.8);
    }
    
    trajectoryRecorder.completeTrajectory(trajectoryId, 'Deployed');
    
    const stats = auditTrail.getStats();
    expect(stats.totalLogs).toBe(4);
    expect(stats.byRiskLevel['critical']).toBe(1);
    expect(stats.byRiskLevel['high']).toBe(1);
  });
});
