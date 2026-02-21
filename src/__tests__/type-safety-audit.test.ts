/**
 * Type Safety Audit Tests
 * Verifies type guard functions and proper typing across the codebase
 * KMS-09: Fix 80+ any types
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AgentMemoryStore, type AgentMemory, type EpisodicMemory, type SemanticMemory, type ProceduralMemory } from '../memory/agent-memory.js';
import { MemoryCommands } from '../memory/memory-commands.js';
import { MemoryRetrieval } from '../memory/memory-retrieval.js';
import { createMemoryEngine } from '../memory/index.js';
import type { Task, PRD } from '../types/index.js';
import Database from 'better-sqlite3';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync } from 'fs';

// ============================================================================
// Type Guard Functions
// ============================================================================

/**
 * Type guard to check if a value is a valid Task object
 */
function isTask(value: unknown): value is Task {
  if (typeof value !== 'object' || value === null) return false;
  const task = value as Record<string, unknown>;
  return (
    typeof task.id === 'string' &&
    typeof task.title === 'string' &&
    typeof task.description === 'string' &&
    typeof task.agent === 'string' &&
    ['pending', 'ready', 'running', 'done', 'failed', 'blocked'].includes(task.status as string) &&
    Array.isArray(task.dependencies) &&
    typeof task.phase === 'number' &&
    typeof task.attempts === 'number' &&
    typeof task.createdAt === 'string'
  );
}

/**
 * Type guard to check if a value is a valid PRD object
 */
function isPRD(value: unknown): value is PRD {
  if (typeof value !== 'object' || value === null) return false;
  const prd = value as Record<string, unknown>;
  return (
    typeof prd.meta === 'object' &&
    prd.meta !== null &&
    typeof (prd.meta as Record<string, unknown>).name === 'string' &&
    typeof (prd.meta as Record<string, unknown>).version === 'string' &&
    typeof (prd.meta as Record<string, unknown>).createdAt === 'string' &&
    Array.isArray(prd.tasks) &&
    prd.tasks.every(isTask)
  );
}

/**
 * Type guard to check if a memory is an EpisodicMemory
 */
function isEpisodicMemory(memory: AgentMemory): memory is EpisodicMemory {
  return memory.type === 'episodic' && 'eventDate' in memory;
}

/**
 * Type guard to check if a memory is a SemanticMemory
 */
function isSemanticMemory(memory: AgentMemory): memory is SemanticMemory {
  return memory.type === 'semantic' && 'confidence' in memory;
}

/**
 * Type guard to check if a memory is a ProceduralMemory
 */
function isProceduralMemory(memory: AgentMemory): memory is ProceduralMemory {
  return memory.type === 'procedural' && 'triggerPattern' in memory;
}

/**
 * Type guard for MemoryCommandResult
 */
function isMemoryCommandResult(value: unknown): value is { command: string; success: boolean; message: string; data?: unknown } {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.command === 'string' &&
    typeof result.success === 'boolean' &&
    typeof result.message === 'string'
  );
}

/**
 * Type guard for valid agent names
 */
function isValidAgentName(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const validAgents = ['SUN', 'EARTH', 'PLUTO', 'MERCURY', 'MARS', 'VENUS', 'SATURN', 
                       'JUPITER', 'TITAN', 'EUROPA', 'CHARON', 'NEPTUNE', 'ATLAS', 
                       'URANUS', 'TRITON', 'ENCELADUS', 'GANYMEDE', 'IO', 'MIMAS', 
                       'CALLISTO', 'ANDROMEDA'];
  return validAgents.includes(value);
}

/**
 * Type guard for Task status
 */
function isValidTaskStatus(value: unknown): value is Task['status'] {
  return typeof value === 'string' && 
    ['pending', 'ready', 'running', 'done', 'failed', 'blocked'].includes(value);
}

/**
 * Type guard for MemoryType
 */
function isValidMemoryType(value: unknown): value is 'episodic' | 'semantic' | 'procedural' {
  return typeof value === 'string' && 
    ['episodic', 'semantic', 'procedural'].includes(value);
}

/**
 * Type guard for MemoryOutcome
 */
function isValidMemoryOutcome(value: unknown): value is 'positive' | 'negative' | 'neutral' | 'unknown' {
  return typeof value === 'string' && 
    ['positive', 'negative', 'neutral', 'unknown'].includes(value);
}

/**
 * Type guard for database row results
 */
function isDatabaseRow(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for array of strings
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

/**
 * Type guard for number array (embedding)
 */
function isEmbeddingArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(item => typeof item === 'number');
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Type Safety Audit', () => {
  let testDir: string;
  let store: AgentMemoryStore;
  let commands: MemoryCommands;
  let retrieval: MemoryRetrieval;

  // Setup test database
  beforeAll(() => {
    testDir = join(tmpdir(), `nova26-type-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    const dbPath = join(testDir, 'test.db');
    
    const mockEmbeddingFn = async (text: string): Promise<number[]> => {
      // Create a simple mock embedding
      return Array(128).fill(0).map((_, i) => (text.length + i) % 100 / 100);
    };

    store = new AgentMemoryStore({ dbPath });
    retrieval = new MemoryRetrieval(store, mockEmbeddingFn);
    commands = new MemoryCommands(store, mockEmbeddingFn, retrieval);
  });

  afterAll(() => {
    store.close();
    // Cleanup
    try {
      const db = new Database(join(testDir, 'test.db'));
      db.close();
    } catch {
      // Ignore cleanup errors
    }
  });

  // Test 1: Type guard for valid Task objects
  it('should correctly identify valid Task objects', () => {
    const validTask: Task = {
      id: 'test-001',
      title: 'Test Task',
      description: 'A test task',
      agent: 'EARTH',
      status: 'ready',
      dependencies: ['dep-001'],
      phase: 0,
      attempts: 0,
      createdAt: new Date().toISOString(),
    };

    expect(isTask(validTask)).toBe(true);
    expect(isTask({})).toBe(false);
    expect(isTask(null)).toBe(false);
    expect(isTask('string')).toBe(false);
  });

  // Test 2: Type guard for PRD objects
  it('should correctly identify valid PRD objects', () => {
    const validPRD: PRD = {
      meta: {
        name: 'Test Project',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
      },
      tasks: [],
    };

    expect(isPRD(validPRD)).toBe(true);
    expect(isPRD({ meta: { name: 'Test' } })).toBe(false);
    expect(isPRD(null)).toBe(false);
  });

  // Test 3: Type guard for EpisodicMemory
  it('should correctly identify EpisodicMemory type', () => {
    const episodicMemory = store.insertMemory({
      type: 'episodic',
      content: 'Test event',
      embedding: Array(128).fill(0.1),
      agentsInvolved: ['EARTH'],
      outcome: 'positive',
      relevanceScore: 1.0,
      isPinned: false,
      isSuppressed: false,
      tags: ['test'],
      eventDate: new Date().toISOString(),
      location: 'test-location',
    } as Omit<EpisodicMemory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'>);

    const retrieved = store.getMemory(episodicMemory.id);
    expect(retrieved).toBeDefined();
    if (retrieved) {
      expect(isEpisodicMemory(retrieved)).toBe(true);
      expect(isSemanticMemory(retrieved)).toBe(false);
      expect(isProceduralMemory(retrieved)).toBe(false);
    }
  });

  // Test 4: Type guard for SemanticMemory
  it('should correctly identify SemanticMemory type', () => {
    const semanticMemory = store.insertMemory({
      type: 'semantic',
      content: 'Test semantic memory',
      embedding: Array(128).fill(0.2),
      agentsInvolved: ['MARS'],
      outcome: 'positive',
      relevanceScore: 0.9,
      isPinned: true,
      isSuppressed: false,
      tags: ['pattern'],
      confidence: 0.85,
      supportingMemoryIds: [],
    } as Omit<SemanticMemory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'>);

    const retrieved = store.getMemory(semanticMemory.id);
    expect(retrieved).toBeDefined();
    if (retrieved) {
      expect(isSemanticMemory(retrieved)).toBe(true);
      expect(isEpisodicMemory(retrieved)).toBe(false);
      expect(isProceduralMemory(retrieved)).toBe(false);
    }
  });

  // Test 5: Type guard for ProceduralMemory
  it('should correctly identify ProceduralMemory type', () => {
    const proceduralMemory = store.insertMemory({
      type: 'procedural',
      content: 'Test procedure',
      embedding: Array(128).fill(0.3),
      agentsInvolved: ['VENUS'],
      outcome: 'positive',
      relevanceScore: 0.8,
      isPinned: false,
      isSuppressed: false,
      tags: ['procedure'],
      triggerPattern: 'when user clicks',
      steps: ['step1', 'step2'],
      successRate: 0.95,
    } as Omit<ProceduralMemory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'>);

    const retrieved = store.getMemory(proceduralMemory.id);
    expect(retrieved).toBeDefined();
    if (retrieved) {
      expect(isProceduralMemory(retrieved)).toBe(true);
      expect(isEpisodicMemory(retrieved)).toBe(false);
      expect(isSemanticMemory(retrieved)).toBe(false);
    }
  });

  // Test 6: Type guard for MemoryCommandResult
  it('should correctly identify MemoryCommandResult objects', () => {
    const validResult = {
      command: 'remember',
      success: true,
      message: 'Memory stored',
      data: { memoryId: '123' },
    };

    expect(isMemoryCommandResult(validResult)).toBe(true);
    expect(isMemoryCommandResult({ command: 'test' })).toBe(false);
    expect(isMemoryCommandResult(null)).toBe(false);
  });

  // Test 7: Type guard for valid agent names
  it('should correctly validate agent names', () => {
    expect(isValidAgentName('EARTH')).toBe(true);
    expect(isValidAgentName('MARS')).toBe(true);
    expect(isValidAgentName('VENUS')).toBe(true);
    expect(isValidAgentName('INVALID')).toBe(false);
    expect(isValidAgentName(123)).toBe(false);
    expect(isValidAgentName(null)).toBe(false);
  });

  // Test 8: Type guard for Task status
  it('should correctly validate Task status values', () => {
    expect(isValidTaskStatus('pending')).toBe(true);
    expect(isValidTaskStatus('ready')).toBe(true);
    expect(isValidTaskStatus('running')).toBe(true);
    expect(isValidTaskStatus('done')).toBe(true);
    expect(isValidTaskStatus('failed')).toBe(true);
    expect(isValidTaskStatus('blocked')).toBe(true);
    expect(isValidTaskStatus('invalid')).toBe(false);
    expect(isValidTaskStatus(123)).toBe(false);
  });

  // Test 9: Type guard for MemoryType
  it('should correctly validate MemoryType values', () => {
    expect(isValidMemoryType('episodic')).toBe(true);
    expect(isValidMemoryType('semantic')).toBe(true);
    expect(isValidMemoryType('procedural')).toBe(true);
    expect(isValidMemoryType('invalid')).toBe(false);
    expect(isValidMemoryType(123)).toBe(false);
  });

  // Test 10: Type guard for MemoryOutcome
  it('should correctly validate MemoryOutcome values', () => {
    expect(isValidMemoryOutcome('positive')).toBe(true);
    expect(isValidMemoryOutcome('negative')).toBe(true);
    expect(isValidMemoryOutcome('neutral')).toBe(true);
    expect(isValidMemoryOutcome('unknown')).toBe(true);
    expect(isValidMemoryOutcome('invalid')).toBe(false);
    expect(isValidMemoryOutcome(null)).toBe(false);
  });

  // Test 11: Type guard for database rows
  it('should correctly identify database row objects', () => {
    expect(isDatabaseRow({ id: 1, name: 'test' })).toBe(true);
    expect(isDatabaseRow({})).toBe(true);
    expect(isDatabaseRow([])).toBe(false);
    expect(isDatabaseRow('string')).toBe(false);
    expect(isDatabaseRow(null)).toBe(false);
  });

  // Test 12: Type guard for string arrays
  it('should correctly validate string arrays', () => {
    expect(isStringArray(['a', 'b', 'c'])).toBe(true);
    expect(isStringArray([])).toBe(true);
    expect(isStringArray(['a', 1, 'c'])).toBe(false);
    expect(isStringArray('not-array')).toBe(false);
    expect(isStringArray(null)).toBe(false);
  });

  // Test 13: Type guard for embedding arrays
  it('should correctly validate embedding arrays', () => {
    expect(isEmbeddingArray([0.1, 0.2, 0.3])).toBe(true);
    expect(isEmbeddingArray([])).toBe(true);
    expect(isEmbeddingArray([0.1, 'not-number', 0.3])).toBe(false);
    expect(isEmbeddingArray('not-array')).toBe(false);
  });

  // Test 14: Integration - MemoryCommands returns typed results
  it('should return properly typed results from MemoryCommands', async () => {
    const result = await commands.remember('Test memory content', ['test-tag']);
    
    expect(isMemoryCommandResult(result)).toBe(true);
    expect(result.success).toBe(true);
    expect(typeof result.message).toBe('string');
  });

  // Test 15: Integration - createMemoryEngine produces valid types
  it('should create memory engine with proper types', () => {
    const mockEmbeddingFn = async (text: string): Promise<number[]> => {
      return Array(128).fill(0).map((_, i) => (text.length + i) % 100 / 100);
    };

    const mockExtractionFn = async (eventLog: { buildId: string; projectId: string }) => {
      return {
        memories: [{
          type: 'episodic' as const,
          content: `Build ${eventLog.buildId} completed`,
          agentsInvolved: ['EARTH'],
          outcome: 'positive' as const,
        }],
      };
    };

    const engine = createMemoryEngine(mockEmbeddingFn, mockExtractionFn, {
      store: { dbPath: join(testDir, 'engine-test.db') }
    });
    
    expect(engine).toHaveProperty('store');
    expect(engine).toHaveProperty('consolidation');
    expect(engine).toHaveProperty('retrieval');
    expect(engine).toHaveProperty('commands');
    
    // Verify store is properly typed
    expect(typeof engine.store.getStats).toBe('function');
    expect(typeof engine.store.insertMemory).toBe('function');
    
    // Cleanup
    engine.store.close();
  });
});
