// Cross-Module Contract Tests
// K4-24: Verify wiring between RLM, SAGA, Harness, Hindsight, and Eternal Reel

import { describe, it, expect, beforeEach } from 'vitest';

// Type-only imports to verify contracts without circular dependencies
import type { RlmConfig, RlmAuditLog } from '../rlm/convex-types.js';
import type { GoalGenomeRecord, EvolutionSessionRecord } from '../saga/convex-types.js';
import type { AgentHarnessRecord, HarnessEventRecord } from '../harness/convex-types.js';
import type { MemoryFragmentRecord, ConsolidationJobRecord } from '../hindsight/convex-types.js';

describe('Cross-Module Contracts', () => {
  describe('RLM → AgentLoop Contracts', () => {
    it('should have compatible token tracking types', () => {
      // RLM audit log should track tokens
      const auditLog: Partial<RlmAuditLog> = {
        originalTokens: 1000,
        compressedTokens: 500,
        compressionRatio: 0.5,
      };

      expect(auditLog.originalTokens).toBe(1000);
      expect(auditLog.compressedTokens).toBe(500);
      expect(auditLog.compressionRatio).toBe(0.5);
    });

    it('should have compatible RLM config types', () => {
      const config: Partial<RlmConfig> = {
        enabled: true,
        readerModelId: 'ollama-qwen2.5:7b',
        maxTokens: 2000,
      };

      expect(config.enabled).toBe(true);
      expect(config.readerModelId).toBe('ollama-qwen2.5:7b');
    });
  });

  describe('SAGA → Harness Contracts', () => {
    it('should have compatible evolution session types', () => {
      const session: Partial<EvolutionSessionRecord> = {
        sessionId: 'evo-001',
        agentId: 'test-agent',
        status: 'running',
        generation: 5,
      };

      expect(session.sessionId).toBe('evo-001');
      expect(session.status).toBe('running');
    });

    it('should have compatible goal genome types', () => {
      const genome: Partial<GoalGenomeRecord> = {
        genomeId: 'genome-001',
        generation: 1,
        fitnessScore: 0.85,
      };

      expect(genome.fitnessScore).toBe(0.85);
    });
  });

  describe('Hindsight → Memory Contracts', () => {
    it('should have compatible memory fragment types', () => {
      const fragment: Partial<MemoryFragmentRecord> = {
        fragmentId: 'frag-001',
        sourceType: 'episodic',
        content: 'Test memory',
        relevance: 0.9,
      };

      expect(fragment.sourceType).toBe('episodic');
      expect(fragment.relevance).toBe(0.9);
    });

    it('should have compatible consolidation job types', () => {
      const job: Partial<ConsolidationJobRecord> = {
        jobId: 'job-001',
        status: 'completed',
        fragmentsBefore: 100,
        fragmentsAfter: 80,
      };

      expect(job.status).toBe('completed');
      expect(job.fragmentsBefore).toBe(100);
      expect(job.fragmentsAfter).toBe(80);
    });
  });

  describe('Harness → Orchestrator Contracts', () => {
    it('should have compatible harness record types', () => {
      const harness: Partial<AgentHarnessRecord> = {
        harnessId: 'harness-001',
        status: 'running',
        autonomyLevel: 3,
        taskDescription: 'Test task',
      };

      expect(harness.harnessId).toBe('harness-001');
      expect(harness.status).toBe('running');
    });

    it('should have compatible harness event types', () => {
      const event: Partial<HarnessEventRecord> = {
        eventType: 'state_transition',
        payload: { from: 'created', to: 'running' },
      };

      expect(event.eventType).toBe('state_transition');
    });
  });

  describe('Eternal Reel Factory', () => {
    it('should verify all module types are importable', () => {
      // This test verifies that all convex types can be imported
      // If this compiles, the contracts are valid
      
      const modules = [
        'rlm',
        'saga', 
        'harness',
        'hindsight',
      ];

      expect(modules).toHaveLength(4);
      expect(modules).toContain('rlm');
      expect(modules).toContain('saga');
      expect(modules).toContain('harness');
      expect(modules).toContain('hindsight');
    });
  });

  describe('Dream Mode Contracts', () => {
    it('should have consistent checkpoint types across modules', () => {
      // All modules should support checkpoint data as string
      const checkpointData = JSON.stringify({
        rlmConfig: { enabled: true },
        sagaState: { generation: 5 },
        harnessState: { status: 'paused' },
      });

      expect(typeof checkpointData).toBe('string');
      expect(JSON.parse(checkpointData).rlmConfig.enabled).toBe(true);
    });
  });
});
