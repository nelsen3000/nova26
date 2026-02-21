// KMS-12: Tests for LangSmith Client

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LangSmithClient,
  createLangSmithClient,
  getLangSmithClient,
  resetLangSmithClient,
  type LangSmithRun,
  type CreateRunOptions,
  type RunType,
} from '../langsmith-client.js';

describe('LangSmithClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLangSmithClient();
  });

  // ============================================================================
  // Connection Tests
  // ============================================================================

  describe('connection', () => {
    it('should connect with valid API key', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      const connected = await client.connect();
      expect(connected).toBe(true);
      expect(client.isConnected()).toBe(true);
    });

    it('should throw when connecting without API key', async () => {
      const client = createLangSmithClient({ apiKey: '' });
      await expect(client.connect()).rejects.toThrow('API key is required');
    });

    it('should throw when calling methods without connecting', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await expect(client.listRuns()).rejects.toThrow('not connected');
    });
  });

  // ============================================================================
  // Create Run Tests
  // ============================================================================

  describe('createRun', () => {
    it('should create a run with required fields', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const run = await client.createRun({
        name: 'Test Run',
        runType: 'llm',
        inputs: { prompt: 'Hello' },
      });

      expect(run.name).toBe('Test Run');
      expect(run.runType).toBe('llm');
      expect(run.inputs).toEqual({ prompt: 'Hello' });
      expect(run.status).toBe('running');
      expect(run.id).toBeDefined();
    });

    it('should create run with different run types', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const types: RunType[] = ['llm', 'chain', 'tool', 'retriever', 'embedding', 'prompt'];

      for (const runType of types) {
        const run = await client.createRun({
          name: `Test ${runType}`,
          runType,
          inputs: {},
        });
        expect(run.runType).toBe(runType);
      }
    });

    it('should use default project ID from config', async () => {
      const client = createLangSmithClient({
        apiKey: 'test-key',
        projectId: 'my-project',
      });
      await client.connect();

      const run = await client.createRun({
        name: 'Test',
        runType: 'llm',
        inputs: {},
      });

      expect(run.projectId).toBe('my-project');
    });

    it('should use override project ID when provided', async () => {
      const client = createLangSmithClient({
        apiKey: 'test-key',
        projectId: 'default-project',
      });
      await client.connect();

      const run = await client.createRun({
        name: 'Test',
        runType: 'llm',
        inputs: {},
        projectId: 'override-project',
      });

      expect(run.projectId).toBe('override-project');
    });

    it('should store run metadata and tags', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const run = await client.createRun({
        name: 'Test',
        runType: 'llm',
        inputs: {},
        metadata: { model: 'gpt-4', temperature: 0.7 },
        tags: ['production', 'v1'],
      });

      expect(run.metadata).toEqual({ model: 'gpt-4', temperature: 0.7 });
      expect(run.tags).toEqual(['production', 'v1']);
    });

    it('should set start time on creation', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const before = Date.now();
      const run = await client.createRun({
        name: 'Test',
        runType: 'llm',
        inputs: {},
      });
      const after = Date.now();

      const startTime = new Date(run.startTime).getTime();
      expect(startTime).toBeGreaterThanOrEqual(before);
      expect(startTime).toBeLessThanOrEqual(after);
    });
  });

  // ============================================================================
  // Update Run Tests
  // ============================================================================

  describe('updateRun', () => {
    it('should update run with outputs', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const run = await client.createRun({
        name: 'Test',
        runType: 'llm',
        inputs: { prompt: 'Hello' },
      });

      const updated = await client.updateRun({
        runId: run.id,
        outputs: { response: 'World' },
      });

      expect(updated.outputs).toEqual({ response: 'World' });
    });

    it('should merge outputs on multiple updates', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const run = await client.createRun({
        name: 'Test',
        runType: 'llm',
        inputs: {},
      });

      await client.updateRun({
        runId: run.id,
        outputs: { step1: 'done' },
      });

      const updated = await client.updateRun({
        runId: run.id,
        outputs: { step2: 'done' },
      });

      expect(updated.outputs).toEqual({ step1: 'done', step2: 'done' });
    });

    it('should update run metadata', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const run = await client.createRun({
        name: 'Test',
        runType: 'llm',
        inputs: {},
        metadata: { initial: true },
      });

      const updated = await client.updateRun({
        runId: run.id,
        metadata: { updated: true },
      });

      expect(updated.metadata).toEqual({ initial: true, updated: true });
    });

    it('should throw for non-existent run', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      await expect(
        client.updateRun({
          runId: 'non-existent',
          outputs: {},
        })
      ).rejects.toThrow('Run not found');
    });
  });

  // ============================================================================
  // End Run Tests
  // ============================================================================

  describe('endRun', () => {
    it('should mark run as completed', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const run = await client.createRun({
        name: 'Test',
        runType: 'llm',
        inputs: {},
      });

      const ended = await client.endRun({
        runId: run.id,
        status: 'completed',
        outputs: { result: 'success' },
      });

      expect(ended.status).toBe('completed');
      expect(ended.endTime).toBeDefined();
      expect(ended.outputs).toEqual({ result: 'success' });
    });

    it('should mark run as failed', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const run = await client.createRun({
        name: 'Test',
        runType: 'llm',
        inputs: {},
      });

      const ended = await client.endRun({
        runId: run.id,
        status: 'failed',
        error: 'API timeout',
      });

      expect(ended.status).toBe('failed');
      expect(ended.error).toBe('API timeout');
    });

    it('should mark run as error', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const run = await client.createRun({
        name: 'Test',
        runType: 'llm',
        inputs: {},
      });

      const ended = await client.endRun({
        runId: run.id,
        status: 'error',
        error: 'Invalid input',
      });

      expect(ended.status).toBe('error');
    });

    it('should throw for non-existent run', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      await expect(
        client.endRun({
          runId: 'non-existent',
          status: 'completed',
        })
      ).rejects.toThrow('Run not found');
    });
  });

  // ============================================================================
  // List Runs Tests
  // ============================================================================

  describe('listRuns', () => {
    it('should return empty array when no runs', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const runs = await client.listRuns();

      expect(runs).toEqual([]);
    });

    it('should list all runs', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      await client.createRun({ name: 'Run 1', runType: 'llm', inputs: {} });
      await client.createRun({ name: 'Run 2', runType: 'chain', inputs: {} });
      await client.createRun({ name: 'Run 3', runType: 'tool', inputs: {} });

      const runs = await client.listRuns();

      expect(runs.length).toBe(3);
    });

    it('should filter by project ID', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      await client.createRun({
        name: 'Run 1',
        runType: 'llm',
        inputs: {},
        projectId: 'project-a',
      });
      await client.createRun({
        name: 'Run 2',
        runType: 'llm',
        inputs: {},
        projectId: 'project-b',
      });

      const runs = await client.listRuns({ projectId: 'project-a' });

      expect(runs.length).toBe(1);
      expect(runs[0].name).toBe('Run 1');
    });

    it('should filter by status', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const run = await client.createRun({ name: 'Run 1', runType: 'llm', inputs: {} });
      await client.endRun({ runId: run.id, status: 'completed' });

      await client.createRun({ name: 'Run 2', runType: 'llm', inputs: {} });

      const completed = await client.listRuns({ status: 'completed' });

      expect(completed.length).toBe(1);
      expect(completed[0].name).toBe('Run 1');
    });

    it('should filter by run type', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      await client.createRun({ name: 'Run 1', runType: 'llm', inputs: {} });
      await client.createRun({ name: 'Run 2', runType: 'chain', inputs: {} });
      await client.createRun({ name: 'Run 3', runType: 'llm', inputs: {} });

      const llmRuns = await client.listRuns({ runType: 'llm' });

      expect(llmRuns.length).toBe(2);
    });

    it('should apply limit', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      for (let i = 0; i < 5; i++) {
        await client.createRun({ name: `Run ${i}`, runType: 'llm', inputs: {} });
      }

      const runs = await client.listRuns({ limit: 3 });

      expect(runs.length).toBe(3);
    });

    it('should apply offset', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      for (let i = 0; i < 5; i++) {
        await client.createRun({ name: `Run ${i}`, runType: 'llm', inputs: {} });
      }

      const runs = await client.listRuns({ offset: 3 });

      expect(runs.length).toBe(2);
    });

    it('should sort by start time descending', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const run1 = await client.createRun({ name: 'First', runType: 'llm', inputs: {} });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const run2 = await client.createRun({ name: 'Second', runType: 'llm', inputs: {} });

      const runs = await client.listRuns();

      expect(runs[0].id).toBe(run2.id);
      expect(runs[1].id).toBe(run1.id);
    });
  });

  // ============================================================================
  // Get Run Tests
  // ============================================================================

  describe('getRun', () => {
    it('should return run by ID', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const created = await client.createRun({
        name: 'Test',
        runType: 'llm',
        inputs: {},
      });
      const fetched = await client.getRun(created.id);

      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.name).toBe('Test');
    });

    it('should return null for non-existent ID', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const fetched = await client.getRun('non-existent');

      expect(fetched).toBeNull();
    });
  });

  // ============================================================================
  // Get Feedback Tests
  // ============================================================================

  describe('getFeedback', () => {
    it('should return empty array for run with no feedback', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const run = await client.createRun({
        name: 'Test',
        runType: 'llm',
        inputs: {},
      });

      const feedback = await client.getFeedback(run.id);

      expect(feedback).toEqual([]);
    });

    it('should return feedback for a run', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const run = await client.createRun({
        name: 'Test',
        runType: 'llm',
        inputs: {},
      });

      await client.addFeedback(run.id, {
        key: 'correctness',
        score: 1,
        comment: 'Good answer',
      });

      const feedback = await client.getFeedback(run.id);

      expect(feedback.length).toBe(1);
      expect(feedback[0].key).toBe('correctness');
      expect(feedback[0].score).toBe(1);
      expect(feedback[0].comment).toBe('Good answer');
    });

    it('should throw for non-existent run', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      await expect(client.getFeedback('non-existent')).rejects.toThrow('Run not found');
    });
  });

  // ============================================================================
  // Add Feedback Tests
  // ============================================================================

  describe('addFeedback', () => {
    it('should add feedback with score', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const run = await client.createRun({
        name: 'Test',
        runType: 'llm',
        inputs: {},
      });

      const feedback = await client.addFeedback(run.id, {
        key: 'helpfulness',
        score: 0.95,
      });

      expect(feedback.key).toBe('helpfulness');
      expect(feedback.score).toBe(0.95);
      expect(feedback.runId).toBe(run.id);
    });

    it('should add feedback with value', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const run = await client.createRun({
        name: 'Test',
        runType: 'llm',
        inputs: {},
      });

      const feedback = await client.addFeedback(run.id, {
        key: 'sentiment',
        value: 'positive',
      });

      expect(feedback.value).toBe('positive');
    });

    it('should store user ID with feedback', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      const run = await client.createRun({
        name: 'Test',
        runType: 'llm',
        inputs: {},
      });

      const feedback = await client.addFeedback(run.id, {
        key: 'rating',
        score: 5,
        userId: 'user-123',
      });

      expect(feedback.userId).toBe('user-123');
    });

    it('should throw for non-existent run', async () => {
      const client = createLangSmithClient({ apiKey: 'test-key' });
      await client.connect();

      await expect(
        client.addFeedback('non-existent', {
          key: 'test',
        })
      ).rejects.toThrow('Run not found');
    });
  });

  // ============================================================================
  // Singleton Tests
  // ============================================================================

  describe('singleton', () => {
    it('should return same instance from getLangSmithClient', async () => {
      const client1 = getLangSmithClient({ apiKey: 'test-key' });
      const client2 = getLangSmithClient();

      expect(client1).toBe(client2);
    });

    it('should throw when getting client without initialization', () => {
      resetLangSmithClient();

      expect(() => getLangSmithClient()).toThrow('not initialized');
    });

    it('should reset client and store', async () => {
      const client = getLangSmithClient({ apiKey: 'test-key' });
      await client.connect();
      await client.createRun({ name: 'Test', runType: 'llm', inputs: {} });

      resetLangSmithClient();

      const newClient = getLangSmithClient({ apiKey: 'test-key' });
      await newClient.connect();
      const runs = await newClient.listRuns();

      expect(runs.length).toBe(0);
    });
  });
});
