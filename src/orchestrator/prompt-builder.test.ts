import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRetryPrompt, invalidateRepoMap } from './prompt-builder.js';
import type { Task, PRD } from '../types/index.js';

// Mock the agent-loader to avoid filesystem reads
vi.mock('./agent-loader.js', () => ({
  loadAgent: vi.fn().mockResolvedValue('You are a test agent.'),
}));

// Mock repo-map to avoid filesystem
vi.mock('../codebase/repo-map.js', () => ({
  buildRepoMap: vi.fn().mockReturnValue({ files: [], symbols: [] }),
  formatRepoContext: vi.fn().mockReturnValue(''),
}));

// Mock session-memory to avoid filesystem
vi.mock('../memory/session-memory.js', () => ({
  buildMemoryContext: vi.fn().mockReturnValue(''),
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'T1',
    title: 'Test Task',
    description: 'Implement the user model',
    agent: 'EARTH',
    status: 'running',
    dependencies: [],
    phase: 1,
    attempts: 1,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makePRD(tasks: Task[]): PRD {
  return {
    meta: { name: 'test', version: '1.0', createdAt: new Date().toISOString() },
    tasks,
  };
}

beforeEach(() => {
  invalidateRepoMap();
});

describe('buildRetryPrompt', () => {
  it('includes task title', () => {
    const task = makeTask({ title: 'Build User Auth' });
    const prompt = buildRetryPrompt(task, 'Schema mismatch', 'bad response');
    expect(prompt).toContain('Build User Auth');
  });

  it('includes task ID', () => {
    const task = makeTask({ id: 'T42' });
    const prompt = buildRetryPrompt(task, 'error', 'prev');
    expect(prompt).toContain('T42');
  });

  it('includes the error message', () => {
    const task = makeTask();
    const prompt = buildRetryPrompt(task, 'Missing required field: name', 'prev');
    expect(prompt).toContain('Missing required field: name');
  });

  it('includes the previous response', () => {
    const task = makeTask();
    const prompt = buildRetryPrompt(task, 'err', 'Here was my previous output...');
    expect(prompt).toContain('Here was my previous output...');
  });

  it('has retry instructions', () => {
    const task = makeTask();
    const prompt = buildRetryPrompt(task, 'err', 'prev');
    expect(prompt).toContain('retry');
  });
});

// We can import and test buildPrompt since we've mocked its dependencies
describe('buildPrompt', () => {
  // Dynamic import to ensure mocks are applied
  it('returns system and user prompts', async () => {
    const { buildPrompt } = await import('./prompt-builder.js');
    const task = makeTask();
    const prd = makePRD([task]);
    const result = await buildPrompt(task, prd);

    expect(result).toHaveProperty('systemPrompt');
    expect(result).toHaveProperty('userPrompt');
    expect(result.systemPrompt).toBe('You are a test agent.');
    expect(result.userPrompt).toContain('Test Task');
    expect(result.userPrompt).toContain('T1');
    expect(result.userPrompt).toContain('EARTH');
  });

  it('includes dependency context when task has dependencies', async () => {
    const { buildPrompt } = await import('./prompt-builder.js');
    const depTask = makeTask({ id: 'T0', status: 'done', title: 'Create Schema' });
    const task = makeTask({ id: 'T1', dependencies: ['T0'] });
    const prd = makePRD([depTask, task]);
    const result = await buildPrompt(task, prd);

    expect(result.userPrompt).toContain('Dependencies');
    expect(result.userPrompt).toContain('Create Schema');
  });

  it('notes when dependency output is unavailable', async () => {
    const { buildPrompt } = await import('./prompt-builder.js');
    const depTask = makeTask({ id: 'T0', status: 'running', title: 'Create Schema' });
    const task = makeTask({ id: 'T1', dependencies: ['T0'] });
    const prd = makePRD([depTask, task]);
    const result = await buildPrompt(task, prd);

    expect(result.userPrompt).toContain('not yet available');
  });

  it('includes agent instructions', async () => {
    const { buildPrompt } = await import('./prompt-builder.js');
    const task = makeTask({ agent: 'VENUS' });
    const prd = makePRD([task]);
    const result = await buildPrompt(task, prd);

    expect(result.userPrompt).toContain('Instructions');
    expect(result.userPrompt).toContain('VENUS');
  });
});
