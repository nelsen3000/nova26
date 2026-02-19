// KIMI-ACE-02: Ace Cycle Tests
// Tests for AceGenerator, AceReflector, and AceCurator

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Task } from '../types/index.js';
import {
  AceGenerator,
  getAceGenerator,
  resetAceGenerator,
  setAceGenerator,
} from './generator.js';
import {
  AceReflector,
  getAceReflector,
  resetAceReflector,
  setAceReflector,
} from './reflector.js';
import {
  AceCurator,
  getAceCurator,
  resetAceCurator,
  setAceCurator,
} from './curator.js';
import {
  PlaybookManager,
  getPlaybookManager,
  resetPlaybookManager,
  setPlaybookManager,
  type PlaybookDelta,
  type PlaybookRule,
} from './playbook.js';
import { resetTasteVault, getTasteVault } from '../taste-vault/taste-vault.js';

// Mock the LLM router
vi.mock('../llm/model-router.js', () => ({
  callLLM: vi.fn(),
}));

import { callLLM } from '../llm/model-router.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: 'Fix authentication bug in login form',
    agent: 'MARS',
    status: 'ready',
    dependencies: [],
    phase: 1,
    attempts: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createDelta(overrides: Partial<PlaybookDelta> = {}): PlaybookDelta {
  return {
    id: `delta-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    action: 'add',
    content: 'Always validate user input before processing',
    type: 'Strategy',
    confidence: 0.85,
    helpfulDelta: 1,
    harmfulDelta: 0,
    isGlobalCandidate: false,
    reason: 'Prevented injection attacks',
    ...overrides,
  };
}

// ============================================================================
// AceGenerator Tests
// ============================================================================

describe('AceGenerator', () => {
  beforeEach(() => {
    resetAceGenerator();
    resetPlaybookManager();
    resetTasteVault();
  });

  it('should return empty playbook context when no rules exist', async () => {
    const generator = getAceGenerator();
    const task = createTask();
    
    const result = await generator.analyzeTask(task, 'MARS', 1000);
    
    expect(result.playbookContext).toContain('playbook_context');
    expect(result.playbookContext).toContain('rules_applied="0"');
    expect(result.appliedRuleIds).toEqual([]);
  });

  it('should include active rules in playbook context', async () => {
    const manager = getPlaybookManager();
    manager.updatePlaybook('MARS', [
      createDelta({ id: 'rule-1', content: 'Run tsc before output', type: 'Strategy', confidence: 0.92 }),
    ]);

    const generator = getAceGenerator();
    const task = createTask({ description: 'Compile TypeScript code' });
    
    const result = await generator.analyzeTask(task, 'MARS', 1000);
    
    expect(result.playbookContext).toContain('Run tsc before output');
    expect(result.appliedRuleIds).toContain('rule-1');
  });

  it('should format playbook context with correct XML structure', async () => {
    const manager = getPlaybookManager();
    manager.updatePlaybook('MARS', [
      createDelta({ id: 'rule-1', content: 'Test content', type: 'Pattern', confidence: 0.8 }),
    ]);

    const generator = getAceGenerator();
    const task = createTask();
    
    const result = await generator.analyzeTask(task, 'MARS', 1000);
    
    expect(result.playbookContext).toMatch(/<playbook_context agent="MARS"/);
    expect(result.playbookContext).toMatch(/version="\d+"/);
    expect(result.playbookContext).toMatch(/rules_applied="1"/);
    expect(result.playbookContext).toContain('</playbook_context>');
  });

  it('should enforce token budget by trimming rules', async () => {
    const manager = getPlaybookManager();
    // Add many long rules
    for (let i = 0; i < 10; i++) {
      manager.updatePlaybook('MARS', [
        createDelta({ 
          id: `rule-${i}`, 
          content: 'This is a very long rule content that takes up many characters '.repeat(5),
          type: 'Strategy',
          confidence: 0.9,
        }),
      ]);
    }

    const generator = getAceGenerator();
    const task = createTask();
    
    // Very small budget
    const result = await generator.analyzeTask(task, 'MARS', 100);
    
    // Should be trimmed
    expect(result.playbookContext.length).toBeLessThan(500);
  });

  it('should track applied rule IDs', async () => {
    const manager = getPlaybookManager();
    manager.updatePlaybook('MARS', [
      createDelta({ id: 'rule-1', content: 'Rule 1', type: 'Strategy' }),
      createDelta({ id: 'rule-2', content: 'Rule 2', type: 'Pattern' }),
    ]);

    const generator = getAceGenerator();
    const task = createTask();
    
    await generator.analyzeTask(task, 'MARS', 1000);
    
    expect(manager.getAppliedRuleIds()).toContain('rule-1');
    expect(manager.getAppliedRuleIds()).toContain('rule-2');
  });

  it('should select relevant rules based on task description', async () => {
    const manager = getPlaybookManager();
    manager.updatePlaybook('VENUS', [
      createDelta({ id: 'ui-rule', content: 'Use React hooks pattern', type: 'Pattern' }),
      createDelta({ id: 'db-rule', content: 'Add database indexes', type: 'Strategy' }),
    ]);

    const generator = getAceGenerator();
    const task = createTask({ description: 'Build React component with hooks' });
    
    const result = await generator.analyzeTask(task, 'VENUS', 1000);
    
    // Should prefer UI-related rule for React task
    expect(result.playbookContext).toContain('React');
  });
});

// ============================================================================
// AceReflector Tests
// ============================================================================

describe('AceReflector', () => {
  beforeEach(() => {
    resetAceReflector();
    resetPlaybookManager();
    vi.clearAllMocks();
  });

  it('should return empty array when LLM returns invalid JSON', async () => {
    vi.mocked(callLLM).mockResolvedValue('invalid json');
    
    const reflector = getAceReflector();
    const task = createTask();
    const playbook = getPlaybookManager().getPlaybook('MARS');
    
    const result = await reflector.reflectOnOutcome(
      task,
      { success: true, output: 'output' },
      playbook
    );
    
    expect(result).toEqual([]);
  });

  it('should parse valid deltas from LLM response', async () => {
    const mockDeltas: PlaybookDelta[] = [
      createDelta({ id: 'new-rule', action: 'add', confidence: 0.8 }),
    ];
    
    vi.mocked(callLLM).mockResolvedValue(JSON.stringify(mockDeltas));
    
    const reflector = getAceReflector();
    const task = createTask();
    const playbook = getPlaybookManager().getPlaybook('MARS');
    
    const result = await reflector.reflectOnOutcome(
      task,
      { success: true, output: 'output' },
      playbook
    );
    
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('new-rule');
    expect(result[0].confidence).toBe(0.8);
  });

  it('should filter out deltas with confidence < 0.5', async () => {
    const mockDeltas: PlaybookDelta[] = [
      createDelta({ id: 'high-conf', confidence: 0.8 }),
      createDelta({ id: 'low-conf', confidence: 0.3 }),
      createDelta({ id: 'medium-conf', confidence: 0.5 }),
    ];
    
    vi.mocked(callLLM).mockResolvedValue(JSON.stringify(mockDeltas));
    
    const reflector = getAceReflector();
    const task = createTask();
    const playbook = getPlaybookManager().getPlaybook('MARS');
    
    const result = await reflector.reflectOnOutcome(
      task,
      { success: true, output: 'output' },
      playbook
    );
    
    expect(result).toHaveLength(2);
    expect(result.map(d => d.id)).toContain('high-conf');
    expect(result.map(d => d.id)).toContain('medium-conf');
    expect(result.map(d => d.id)).not.toContain('low-conf');
  });

  it('should cap deltas at 5 and return top by confidence', async () => {
    const mockDeltas: PlaybookDelta[] = [
      createDelta({ id: 'd1', confidence: 0.6 }),
      createDelta({ id: 'd2', confidence: 0.9 }),
      createDelta({ id: 'd3', confidence: 0.7 }),
      createDelta({ id: 'd4', confidence: 0.5 }),
      createDelta({ id: 'd5', confidence: 0.8 }),
      createDelta({ id: 'd6', confidence: 0.55 }),
      createDelta({ id: 'd7', confidence: 0.95 }),
    ];
    
    vi.mocked(callLLM).mockResolvedValue(JSON.stringify(mockDeltas));
    
    const reflector = getAceReflector();
    const task = createTask();
    const playbook = getPlaybookManager().getPlaybook('MARS');
    
    const result = await reflector.reflectOnOutcome(
      task,
      { success: true, output: 'output' },
      playbook
    );
    
    expect(result).toHaveLength(5);
    // Should be sorted by confidence descending
    expect(result[0].confidence).toBe(0.95);
    expect(result[1].confidence).toBe(0.9);
  });

  it('should extract JSON from markdown code blocks', async () => {
    const mockDeltas: PlaybookDelta[] = [createDelta({ id: 'test-rule', confidence: 0.8 })];
    const markdownResponse = `\`\`\`json\n${JSON.stringify(mockDeltas)}\n\`\`\``;
    
    vi.mocked(callLLM).mockResolvedValue(markdownResponse);
    
    const reflector = getAceReflector();
    const task = createTask();
    const playbook = getPlaybookManager().getPlaybook('MARS');
    
    const result = await reflector.reflectOnOutcome(
      task,
      { success: true, output: 'output' },
      playbook
    );
    
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test-rule');
  });

  it('should use cheap LLM model for reflection', async () => {
    vi.mocked(callLLM).mockResolvedValue('[]');
    
    const reflector = getAceReflector();
    const task = createTask();
    const playbook = getPlaybookManager().getPlaybook('MARS');
    
    await reflector.reflectOnOutcome(
      task,
      { success: true, output: 'output' },
      playbook
    );
    
    expect(callLLM).toHaveBeenCalledWith(
      expect.stringContaining('Task Information'),
      expect.objectContaining({ model: 'gpt-4o-mini' })
    );
  });

  it('should include task outcome in prompt', async () => {
    vi.mocked(callLLM).mockResolvedValue('[]');
    
    const reflector = getAceReflector();
    const task = createTask({ title: 'Auth Fix', description: 'Fix login' });
    const playbook = getPlaybookManager().getPlaybook('MARS');
    
    await reflector.reflectOnOutcome(
      task,
      { success: false, output: 'Error: timeout', gateScore: 45 },
      playbook
    );
    
    const prompt = vi.mocked(callLLM).mock.calls[0][0] as string;
    expect(prompt).toContain('Auth Fix');
    expect(prompt).toContain('Fix login');
    expect(prompt).toContain('Error: timeout');
    expect(prompt).toContain('Gate Score: 45/100');
  });
});

// ============================================================================
// AceCurator Tests
// ============================================================================

describe('AceCurator', () => {
  beforeEach(() => {
    resetAceCurator();
    resetPlaybookManager();
    resetTasteVault();
  });

  it('should return empty applied/rejected when no deltas provided', async () => {
    const curator = getAceCurator();
    
    const result = await curator.curate([], 'MARS');
    
    expect(result.applied).toEqual([]);
    expect(result.rejected).toEqual([]);
    expect(result.newPlaybook.rules).toEqual([]);
  });

  it('should apply valid deltas and update playbook', async () => {
    const curator = getAceCurator();
    const delta = createDelta({ id: 'new-rule', action: 'add', content: 'Test rule' });
    
    const result = await curator.curate([delta], 'MARS');
    
    expect(result.applied).toHaveLength(1);
    expect(result.newPlaybook.rules).toHaveLength(1);
    expect(result.newPlaybook.rules[0].content).toBe('Test rule');
  });

  it('should reject deltas that are duplicates (Jaccard >= 0.65)', async () => {
    const manager = getPlaybookManager();
    manager.updatePlaybook('MARS', [
      createDelta({ id: 'existing-rule', content: 'Always validate user input before processing database queries' }),
    ]);

    const curator = getAceCurator();
    // Very similar content with high token overlap
    const delta = createDelta({ 
      id: 'new-rule', 
      action: 'add',
      content: 'Always validate user input before processing any queries' 
    });
    
    const result = await curator.curate([delta], 'MARS');
    
    expect(result.applied).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain('Duplicate');
  });

  it('should calculate score correctly using formula', () => {
    const curator = getAceCurator();
    
    // Score = helpful * 0.6 + confidence * 0.4 - harmful * 0.3
    // = 2 * 0.6 + 0.8 * 0.4 - 1 * 0.3 = 1.2 + 0.32 - 0.3 = 1.22 -> clamped to 1.0
    const delta = createDelta({ helpfulDelta: 2, harmfulDelta: 1, confidence: 0.8 });
    
    const score = curator.calculateScore(delta);
    
    expect(score).toBe(1.0); // Clamped to 1.0
  });

  it('should reject deltas with score < 0.4', async () => {
    const curator = getAceCurator();
    // Low confidence, no helpful delta -> low score
    const delta = createDelta({ 
      id: 'low-score',
      confidence: 0.2, 
      helpfulDelta: 0,
      harmfulDelta: 1 
    });
    
    const result = await curator.curate([delta], 'MARS');
    
    expect(result.applied).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain('Score');
  });

  it('should cap at 3 applied deltas', async () => {
    const curator = getAceCurator();
    const deltas = [
      createDelta({ id: 'd1', confidence: 0.9, helpfulDelta: 2 }),
      createDelta({ id: 'd2', confidence: 0.8, helpfulDelta: 1 }),
      createDelta({ id: 'd3', confidence: 0.7, helpfulDelta: 1 }),
      createDelta({ id: 'd4', confidence: 0.6, helpfulDelta: 1 }),
      createDelta({ id: 'd5', confidence: 0.5, helpfulDelta: 1 }),
    ];
    
    const result = await curator.curate(deltas, 'MARS');
    
    expect(result.applied).toHaveLength(3);
    expect(result.rejected).toHaveLength(2);
    expect(result.applied[0].id).toBe('d1'); // Highest score
  });

  it('should learn global candidates to taste vault', async () => {
    const curator = getAceCurator();
    const delta = createDelta({ 
      id: 'global-rule',
      confidence: 0.9, 
      helpfulDelta: 2,
      isGlobalCandidate: true,
      content: 'Global best practice',
      type: 'Strategy'
    });
    
    await curator.curate([delta], 'MARS');
    
    const vault = getTasteVault('default');
    const summary = vault.summary();
    expect(summary.nodeCount).toBeGreaterThan(0);
  });

  it('should not learn non-global-candidates to taste vault', async () => {
    resetTasteVault();
    const curator = getAceCurator();
    const delta = createDelta({ 
      id: 'local-rule',
      confidence: 0.9, 
      helpfulDelta: 2,
      isGlobalCandidate: false, // Not a global candidate
    });
    
    await curator.curate([delta], 'MARS');
    
    const vault = getTasteVault('default');
    const summary = vault.summary();
    // Should not have learned this
    expect(summary.nodeCount).toBe(0);
  });

  it('should detect duplicates using Jaccard similarity', () => {
    const curator = getAceCurator();
    const existingRules: PlaybookRule[] = [
      {
        id: 'rule-1',
        content: 'Always validate user input before processing database queries for security',
        type: 'Strategy',
        confidence: 0.9,
        helpfulCount: 5,
        harmfulCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        agentName: 'MARS',
        isGlobalCandidate: false,
      },
    ];
    
    // Very similar content with high token overlap
    const isDup = curator.isDuplicate(
      'Always validate user input before processing database queries securely',
      existingRules,
      0.65
    );
    
    expect(isDup.isDuplicate).toBe(true);
    expect(isDup.matchedRule).toBeDefined();
  });

  it('should not flag non-duplicates as duplicates', () => {
    const curator = getAceCurator();
    const existingRules: PlaybookRule[] = [
      {
        id: 'rule-1',
        content: 'Always use TypeScript',
        type: 'Strategy',
        confidence: 0.9,
        helpfulCount: 5,
        harmfulCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        agentName: 'MARS',
        isGlobalCandidate: false,
      },
    ];
    
    const isDup = curator.isDuplicate(
      'Deploy to production on Fridays',
      existingRules,
      0.65
    );
    
    expect(isDup.isDuplicate).toBe(false);
  });

  it('should handle update actions correctly', async () => {
    const manager = getPlaybookManager();
    manager.updatePlaybook('MARS', [
      createDelta({ id: 'rule-1', content: 'Original content', helpfulDelta: 1 }),
    ]);

    const curator = getAceCurator();
    const updateDelta = createDelta({
      id: 'update-1',
      ruleId: 'rule-1',
      action: 'update',
      content: 'Updated content',
      helpfulDelta: 2,
    });
    
    const result = await curator.curate([updateDelta], 'MARS');
    
    expect(result.applied).toHaveLength(1);
    expect(result.newPlaybook.rules[0].content).toBe('Updated content');
    expect(result.newPlaybook.rules[0].helpfulCount).toBe(3); // 1 + 2
  });

  it('should handle remove actions correctly', async () => {
    const manager = getPlaybookManager();
    manager.updatePlaybook('MARS', [
      createDelta({ id: 'rule-1', content: 'To be removed' }),
    ]);

    const curator = getAceCurator();
    const removeDelta = createDelta({
      id: 'remove-1',
      ruleId: 'rule-1',
      action: 'remove',
      content: '',
    });
    
    const result = await curator.curate([removeDelta], 'MARS');
    
    expect(result.applied).toHaveLength(1);
    expect(result.newPlaybook.rules).toHaveLength(0);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Ace Cycle Integration', () => {
  beforeEach(() => {
    resetAceGenerator();
    resetAceReflector();
    resetAceCurator();
    resetPlaybookManager();
    resetTasteVault();
    vi.clearAllMocks();
  });

  it('should complete full ACE cycle', async () => {
    // Setup
    const generator = getAceGenerator();
    const reflector = getAceReflector();
    const curator = getAceCurator();
    
    // 1. GENERATE: Analyze task
    const task = createTask({ description: 'Build authentication' });
    const genResult = await generator.analyzeTask(task, 'MARS', 1000);
    
    expect(genResult.playbookContext).toBeDefined();
    
    // Seed some rules for reflection context
    getPlaybookManager().updatePlaybook('MARS', [
      createDelta({ id: 'seed-rule', content: 'Use requireAuth', type: 'Strategy' }),
    ]);
    
    // 2. REFLECT: Analyze outcome
    const mockDeltas: PlaybookDelta[] = [
      createDelta({ 
        id: 'learned-rule', 
        action: 'add',
        content: 'Always hash passwords with bcrypt',
        type: 'Strategy',
        confidence: 0.9,
        helpfulDelta: 1,
      }),
    ];
    vi.mocked(callLLM).mockResolvedValue(JSON.stringify(mockDeltas));
    
    const playbook = getPlaybookManager().getPlaybook('MARS');
    const reflectResult = await reflector.reflectOnOutcome(
      task,
      { success: true, output: 'Password hashed successfully' },
      playbook
    );
    
    expect(reflectResult).toHaveLength(1);
    
    // 3. CURATE: Apply deltas
    const curateResult = await curator.curate(reflectResult, 'MARS');
    
    expect(curateResult.applied).toHaveLength(1);
    expect(curateResult.newPlaybook.rules).toHaveLength(2); // seed + learned
    
    // 4. Verify: New rule available for next generation
    const genResult2 = await generator.analyzeTask(
      createTask({ description: 'password hashing' }), 
      'MARS', 
      1000
    );
    expect(genResult2.playbookContext).toContain('bcrypt');
  });

  it('should handle singleton reset functions', () => {
    // Test each reset function
    resetAceGenerator();
    resetAceReflector();
    resetAceCurator();
    resetPlaybookManager();
    
    // Should get fresh instances
    const gen1 = getAceGenerator();
    const gen2 = getAceGenerator();
    expect(gen1).toBe(gen2); // Same instance
    
    resetAceGenerator();
    const gen3 = getAceGenerator();
    expect(gen1).not.toBe(gen3); // Different after reset
  });

  it('should handle setters for dependency injection', () => {
    const customGenerator = new AceGenerator();
    const customReflector = new AceReflector();
    const customCurator = new AceCurator();
    const customManager = new PlaybookManager();
    
    setAceGenerator(customGenerator);
    setAceReflector(customReflector);
    setAceCurator(customCurator);
    setPlaybookManager(customManager);
    
    expect(getAceGenerator()).toBe(customGenerator);
    expect(getAceReflector()).toBe(customReflector);
    expect(getAceCurator()).toBe(customCurator);
    expect(getPlaybookManager()).toBe(customManager);
  });
});
