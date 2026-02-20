// KMS-11: Tests for Braintrust Client

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BraintrustClient,
  createBraintrustClient,
  getBraintrustClient,
  resetBraintrustClient,
  type BraintrustExperiment,
  type LogResultOptions,
} from '../braintrust-client.js';

describe('BraintrustClient', () => {
  beforeEach(() => {
    resetBraintrustClient();
  });

  // ============================================================================
  // Connection Tests
  // ============================================================================

  describe('connection', () => {
    it('should connect with valid API key', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      const connected = await client.connect();
      expect(connected).toBe(true);
      expect(client.isConnected()).toBe(true);
    });

    it('should throw when connecting without API key', async () => {
      const client = createBraintrustClient({ apiKey: '' });
      await expect(client.connect()).rejects.toThrow('API key is required');
    });

    it('should throw when calling methods without connecting', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await expect(client.listExperiments()).rejects.toThrow('not connected');
    });
  });

  // ============================================================================
  // Create Experiment Tests
  // ============================================================================

  describe('createExperiment', () => {
    it('should create an experiment with name', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const exp = await client.createExperiment({ name: 'Test Experiment' });

      expect(exp.name).toBe('Test Experiment');
      expect(exp.id).toBeDefined();
      expect(exp.status).toBe('running');
    });

    it('should create experiment with project ID', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const exp = await client.createExperiment({
        name: 'Test',
        projectId: 'my-project',
      });

      expect(exp.projectId).toBe('my-project');
    });

    it('should use default project ID from config', async () => {
      const client = createBraintrustClient({
        apiKey: 'test-key',
        projectId: 'default-project',
      });
      await client.connect();

      const exp = await client.createExperiment({ name: 'Test' });

      expect(exp.projectId).toBe('default-project');
    });

    it('should store experiment metadata', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const exp = await client.createExperiment({
        name: 'Test',
        metadata: { author: 'kimi', version: '1.0' },
      });

      expect(exp.metadata).toEqual({ author: 'kimi', version: '1.0' });
    });

    it('should set created and updated timestamps', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const before = Date.now();
      const exp = await client.createExperiment({ name: 'Test' });
      const after = Date.now();

      const created = new Date(exp.createdAt).getTime();
      expect(created).toBeGreaterThanOrEqual(before);
      expect(created).toBeLessThanOrEqual(after);
    });
  });

  // ============================================================================
  // Log Result Tests
  // ============================================================================

  describe('logResult', () => {
    it('should log a result to an experiment', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const exp = await client.createExperiment({ name: 'Test' });
      const result = await client.logResult({
        experimentId: exp.id,
        input: 'What is 2+2?',
        actualOutput: '4',
      });

      expect(result.experimentId).toBe(exp.id);
      expect(result.input).toBe('What is 2+2?');
      expect(result.actualOutput).toBe('4');
    });

    it('should include expected output when provided', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const exp = await client.createExperiment({ name: 'Test' });
      const result = await client.logResult({
        experimentId: exp.id,
        input: 'What is 2+2?',
        expectedOutput: '4',
        actualOutput: '4',
      });

      expect(result.expectedOutput).toBe('4');
    });

    it('should store scores', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const exp = await client.createExperiment({ name: 'Test' });
      const result = await client.logResult({
        experimentId: exp.id,
        input: 'Test',
        actualOutput: 'Result',
        scores: { accuracy: 0.95, relevance: 0.8 },
      });

      expect(result.scores.accuracy).toBe(0.95);
      expect(result.scores.relevance).toBe(0.8);
    });

    it('should throw for non-existent experiment', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      await expect(
        client.logResult({
          experimentId: 'non-existent',
          input: 'Test',
          actualOutput: 'Result',
        })
      ).rejects.toThrow('Experiment not found');
    });
  });

  // ============================================================================
  // Get Scores Tests
  // ============================================================================

  describe('getScores', () => {
    it('should return empty object for experiment with no results', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const exp = await client.createExperiment({ name: 'Test' });
      const scores = await client.getScores(exp.id);

      expect(scores).toEqual({});
    });

    it('should aggregate scores across results', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const exp = await client.createExperiment({ name: 'Test' });

      await client.logResult({
        experimentId: exp.id,
        input: 'Q1',
        actualOutput: 'A1',
        scores: { accuracy: 1.0 },
      });

      await client.logResult({
        experimentId: exp.id,
        input: 'Q2',
        actualOutput: 'A2',
        scores: { accuracy: 0.5 },
      });

      const scores = await client.getScores(exp.id);

      expect(scores.accuracy.mean).toBe(0.75);
      expect(scores.accuracy.count).toBe(2);
    });

    it('should handle multiple score types', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const exp = await client.createExperiment({ name: 'Test' });

      await client.logResult({
        experimentId: exp.id,
        input: 'Q1',
        actualOutput: 'A1',
        scores: { accuracy: 1.0, relevance: 0.9 },
      });

      const scores = await client.getScores(exp.id);

      expect(scores.accuracy).toBeDefined();
      expect(scores.relevance).toBeDefined();
    });
  });

  // ============================================================================
  // List Experiments Tests
  // ============================================================================

  describe('listExperiments', () => {
    it('should return empty array when no experiments', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const exps = await client.listExperiments();

      expect(exps).toEqual([]);
    });

    it('should list all experiments', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      await client.createExperiment({ name: 'Exp 1' });
      await client.createExperiment({ name: 'Exp 2' });
      await client.createExperiment({ name: 'Exp 3' });

      const exps = await client.listExperiments();

      expect(exps.length).toBe(3);
    });

    it('should filter by project ID', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      await client.createExperiment({ name: 'Exp 1', projectId: 'project-a' });
      await client.createExperiment({ name: 'Exp 2', projectId: 'project-b' });

      const exps = await client.listExperiments({ projectId: 'project-a' });

      expect(exps.length).toBe(1);
      expect(exps[0].name).toBe('Exp 1');
    });

    it('should filter by status', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const exp = await client.createExperiment({ name: 'Exp 1' });
      await client.completeExperiment(exp.id);

      await client.createExperiment({ name: 'Exp 2' });

      const completed = await client.listExperiments({ status: 'completed' });

      expect(completed.length).toBe(1);
      expect(completed[0].name).toBe('Exp 1');
    });

    it('should apply limit', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      for (let i = 0; i < 5; i++) {
        await client.createExperiment({ name: `Exp ${i}` });
      }

      const exps = await client.listExperiments({ limit: 3 });

      expect(exps.length).toBe(3);
    });

    it('should apply offset', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      for (let i = 0; i < 5; i++) {
        await client.createExperiment({ name: `Exp ${i}` });
      }

      const exps = await client.listExperiments({ offset: 3 });

      expect(exps.length).toBe(2);
    });

    it('should sort by created date descending', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const exp1 = await client.createExperiment({ name: 'First' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const exp2 = await client.createExperiment({ name: 'Second' });

      const exps = await client.listExperiments();

      expect(exps[0].id).toBe(exp2.id);
      expect(exps[1].id).toBe(exp1.id);
    });
  });

  // ============================================================================
  // Get Experiment Tests
  // ============================================================================

  describe('getExperiment', () => {
    it('should return experiment by ID', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const created = await client.createExperiment({ name: 'Test' });
      const fetched = await client.getExperiment(created.id);

      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.name).toBe('Test');
    });

    it('should return null for non-existent ID', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const fetched = await client.getExperiment('non-existent');

      expect(fetched).toBeNull();
    });
  });

  // ============================================================================
  // Complete Experiment Tests
  // ============================================================================

  describe('completeExperiment', () => {
    it('should mark experiment as completed', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const exp = await client.createExperiment({ name: 'Test' });
      const completed = await client.completeExperiment(exp.id);

      expect(completed.status).toBe('completed');
    });

    it('should mark experiment as failed', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const exp = await client.createExperiment({ name: 'Test' });
      const failed = await client.completeExperiment(exp.id, 'failed');

      expect(failed.status).toBe('failed');
    });

    it('should update updatedAt timestamp', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const exp = await client.createExperiment({ name: 'Test' });
      const beforeComplete = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const completed = await client.completeExperiment(exp.id);

      expect(new Date(completed.updatedAt).getTime()).toBeGreaterThan(beforeComplete);
    });

    it('should throw for non-existent experiment', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      await expect(client.completeExperiment('non-existent')).rejects.toThrow('Experiment not found');
    });
  });

  // ============================================================================
  // Delete Experiment Tests
  // ============================================================================

  describe('deleteExperiment', () => {
    it('should delete existing experiment', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const exp = await client.createExperiment({ name: 'Test' });
      const deleted = await client.deleteExperiment(exp.id);

      expect(deleted).toBe(true);
      expect(await client.getExperiment(exp.id)).toBeNull();
    });

    it('should return false for non-existent experiment', async () => {
      const client = createBraintrustClient({ apiKey: 'test-key' });
      await client.connect();

      const deleted = await client.deleteExperiment('non-existent');

      expect(deleted).toBe(false);
    });
  });

  // ============================================================================
  // Singleton Tests
  // ============================================================================

  describe('singleton', () => {
    it('should return same instance from getBraintrustClient', async () => {
      const client1 = getBraintrustClient({ apiKey: 'test-key' });
      const client2 = getBraintrustClient();

      expect(client1).toBe(client2);
    });

    it('should throw when getting client without initialization', () => {
      resetBraintrustClient();

      expect(() => getBraintrustClient()).toThrow('not initialized');
    });

    it('should reset client and store', async () => {
      const client = getBraintrustClient({ apiKey: 'test-key' });
      await client.connect();
      await client.createExperiment({ name: 'Test' });

      resetBraintrustClient();

      const newClient = getBraintrustClient({ apiKey: 'test-key' });
      await newClient.connect();
      const exps = await newClient.listExperiments();

      expect(exps.length).toBe(0);
    });
  });
});
