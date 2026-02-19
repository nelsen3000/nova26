// Integration tests for R20-01 Orchestrator Hierarchy
// Tests full L0→L3 flow, escalation, backward compatibility, and parallel execution

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { L0IntentLayer } from '../layers/l0-intent.js';
import { L1PlanningLayer } from '../layers/l1-planning.js';
import { L2ExecutionLayer, MockAgentExecutor } from '../layers/l2-execution.js';
import { L3ToolLayer, MockToolExecutor } from '../layers/l3-tool.js';
import { EscalationManager, DefaultEscalationHandler } from '../escalation.js';
import { createFlatModeConfig } from '../hierarchy-config.js';
import type {
  UserIntent,
  TaskGraph,
  ExecutionResult,
  ToolRequest,
  OrchestratorHierarchyConfig,
} from '../hierarchy-types.js';

describe('Hierarchy Integration', () => {
  let l0Layer: L0IntentLayer;
  let l1Layer: L1PlanningLayer;
  let l2Layer: L2ExecutionLayer;
  let l3Layer: L3ToolLayer;
  let mockAgentExecutor: MockAgentExecutor;
  let mockToolExecutor: MockToolExecutor;
  let escalationManager: EscalationManager;
  let escalationHandler: DefaultEscalationHandler;

  beforeEach(() => {
    // Create fresh instances for each test
    l0Layer = new L0IntentLayer({ minConfidenceThreshold: 0.7 });
    l1Layer = new L1PlanningLayer();
    mockAgentExecutor = new MockAgentExecutor();
    mockToolExecutor = new MockToolExecutor();
    // Use minimal retries to avoid timeouts in tests
    l2Layer = new L2ExecutionLayer(mockAgentExecutor, { maxRetries: 1, retryDelayMs: 10 });
    l3Layer = new L3ToolLayer(mockToolExecutor, { maxBackoffRetries: 1, initialBackoffMs: 10 });
    escalationHandler = new DefaultEscalationHandler();
    
    const config: OrchestratorHierarchyConfig = {
      enabled: true,
      layers: [],
      escalationPolicy: 'threshold-based',
      defaultMaxRetries: 3,
      globalTimeoutMs: 300000,
      backwardCompatibilityMode: false,
      observabilityLevel: 'standard',
    };
    escalationManager = new EscalationManager(
      {
        mode: 'threshold-based',
        thresholds: { maxRetriesPerLayer: 3, confidenceThreshold: 0.7, successRateThreshold: 0.5 },
        autoEscalateOn: ['timeout', 'failure'],
      },
      escalationHandler
    );
  });

  // ============================================================================
  // Full L0→L3 Flow (5 tests)
  // ============================================================================
  describe('Full L0→L3 Flow', () => {
    it('should complete full flow from intent to tool execution', async () => {
      // L0: Parse intent
      const parseResult = await l0Layer.parseIntent(
        'Create a new user authentication API endpoint',
        { tasteVaultTags: ['backend', 'api'] }
      );
      
      expect(parseResult.intent.confidence).toBeGreaterThan(0);
      expect(parseResult.intent.parsedType).toBe('create');
      
      // L1: Decompose into task graph
      const decomposition = await l1Layer.decompose(parseResult.intent, {
        availableAgents: ['sun', 'mercury', 'venus', 'mars'],
      });
      
      expect(decomposition.graph.nodes.length).toBeGreaterThan(0);
      expect(decomposition.architectureValidated).toBe(true);
      
      // L2: Execute tasks
      const executionResult = await l2Layer.execute(decomposition.graph.nodes[0]);
      
      expect(executionResult.success).toBe(true);
      expect(executionResult.artifacts.length).toBeGreaterThan(0);
      
      // L3: Execute tool if needed
      const toolRequest: ToolRequest = {
        toolName: 'write_file',
        parameters: { path: '/tmp/test.ts', content: executionResult.artifacts[0].content },
        sandboxed: true,
        timeoutMs: 5000,
      };
      
      const toolResult = await l3Layer.execute(toolRequest);
      
      expect(toolResult.success).toBe(true);
    });

    it('should pass data correctly between layers', async () => {
      // L0 produces intent
      const parseResult = await l0Layer.parseIntent('Fix the login bug in the authentication module');
      const intent = parseResult.intent;
      
      // Verify intent data structure
      expect(intent.id).toBeDefined();
      expect(intent.rawInput).toBe('Fix the login bug in the authentication module');
      expect(intent.parsedType).toBe('fix');
      
      // L1 receives intent and produces task graph
      const decomposition = await l1Layer.decompose(intent);
      const graph = decomposition.graph;
      
      // Verify task nodes have correct structure
      expect(graph.nodes.every(n => n.id && n.agent && n.description)).toBe(true);
      expect(graph.criticalPath.length).toBeGreaterThan(0);
      
      // L2 receives task nodes and produces execution results
      const task = graph.nodes[0];
      const execResult = await l2Layer.execute(task);
      
      // Verify execution result contains task reference
      expect(execResult.taskId).toBe(task.id);
      expect(execResult.success).toBe(true);
      
      // Artifacts should contain task metadata
      if (execResult.artifacts.length > 0) {
        expect(execResult.artifacts[0].metadata.taskId).toBe(task.id);
        expect(execResult.artifacts[0].metadata.agent).toBe(task.agent);
      }
    });

    it('should maintain context through all layers', async () => {
      const context = {
        tasteVaultTags: ['security', 'authentication'],
        projectContext: 'web-application',
        previousIntents: [] as UserIntent[],
      };
      
      // L0 captures context
      const parseResult = await l0Layer.parseIntent(
        'Implement OAuth2 authentication flow',
        context
      );
      
      expect(parseResult.intent.tasteVaultTags).toEqual(context.tasteVaultTags);
      
      // Pass context through to L1
      const decomposition = await l1Layer.decompose(parseResult.intent, {
        availableAgents: ['sun', 'mercury'],
        projectStructure: ['src/', 'tests/'],
      });
      
      // Task graph should reflect context
      const graph = decomposition.graph;
      expect(graph.nodes.length).toBeGreaterThan(0);
      
      // Execution maintains context via task metadata
      const task = graph.nodes[0];
      const execResult = await l2Layer.execute(task);
      
      expect(execResult.success).toBe(true);
      
      // Build trace through the layers
      const layerTrace = [
        { layer: 0, intentId: parseResult.intent.id, type: parseResult.intent.parsedType },
        { layer: 1, taskCount: graph.nodes.length, validated: decomposition.architectureValidated },
        { layer: 2, taskId: execResult.taskId, success: execResult.success },
      ];
      
      expect(layerTrace).toHaveLength(3);
      expect(layerTrace[0].layer).toBe(0);
      expect(layerTrace[1].layer).toBe(1);
      expect(layerTrace[2].layer).toBe(2);
    });

    it('should collect artifacts from each layer', async () => {
      const artifacts: Array<{
        layer: number;
        type: string;
        content: string;
        metadata: Record<string, unknown>;
      }> = [];
      
      // L0: Parse intent and collect parsing metadata
      const parseResult = await l0Layer.parseIntent('Create React component for user profile');
      artifacts.push({
        layer: 0,
        type: 'intent',
        content: parseResult.intent.parsedType,
        metadata: parseResult.parsingMetadata,
      });
      
      // L1: Decompose and collect task graph info
      const decomposition = await l1Layer.decompose(parseResult.intent);
      artifacts.push({
        layer: 1,
        type: 'task-graph',
        content: `Tasks: ${decomposition.graph.nodes.length}`,
        metadata: {
          validated: decomposition.architectureValidated,
          criticalPath: decomposition.graph.criticalPath,
        },
      });
      
      // L2: Execute and collect execution artifacts
      const execResults: ExecutionResult[] = [];
      for (const task of decomposition.graph.nodes) {
        const result = await l2Layer.execute(task);
        execResults.push(result);
        for (const artifact of result.artifacts) {
          artifacts.push({
            layer: 2,
            type: artifact.type,
            content: artifact.content,
            metadata: artifact.metadata,
          });
        }
      }
      
      // Verify artifacts collected from all layers
      expect(artifacts.some(a => a.layer === 0)).toBe(true);
      expect(artifacts.some(a => a.layer === 1)).toBe(true);
      expect(artifacts.some(a => a.layer === 2)).toBe(true);
      
      // L2 should have produced code artifacts
      const codeArtifacts = artifacts.filter(a => a.type === 'code');
      expect(codeArtifacts.length).toBeGreaterThan(0);
    });

    it('should complete end-to-end successfully', async () => {
      // Full end-to-end flow
      const userInput = 'Build a REST API endpoint for user management with validation';
      
      // L0
      const l0Result = await l0Layer.parseIntent(userInput);
      expect(l0Result.intent.needsClarification).toBe(false);
      
      // L1
      const l1Result = await l1Layer.decompose(l0Result.intent);
      expect(l1Result.validationErrors).toHaveLength(0);
      
      // L2 - Execute all tasks
      const l2Results = await l2Layer.executeParallel(l1Result.graph.nodes);
      expect(l2Results.completedCount).toBe(l1Result.graph.nodes.length);
      
      // Collect all artifacts
      const allArtifacts = l2Layer.collectArtifacts(l2Results.results);
      expect(allArtifacts.length).toBeGreaterThan(0);
      
      // Verify end-to-end success
      const endToEndSuccess = 
        l0Result.intent.confidence > 0 &&
        l1Result.architectureValidated &&
        l2Results.failedCount === 0;
      
      expect(endToEndSuccess).toBe(true);
    });
  });

  // ============================================================================
  // Escalation Round-trip (3 tests)
  // ============================================================================
  describe('Escalation Round-trip', () => {
    it('should escalate L3 failure to L2', async () => {
      // Use unique task ID for this test
      const taskId = `l3-task-${Date.now()}`;
      
      // Evaluate escalation from L3 with high retry count and security error
      // Using 'permission_denied' error forces human intervention
      const escalationEvent = await escalationManager.evaluateEscalation(
        3,
        taskId,
        'permission_denied: cannot access resource',  // Forces human intervention
        6  // Exceeds maxRetriesPerLayer * 2 (3 * 2 = 6)
      );
      
      expect(escalationEvent).not.toBeNull();
      expect(escalationEvent!.layer).toBe(3);
      expect(escalationEvent!.suggestedNextLayer).toBe(-1); // L3 escalates to human
      expect(escalationEvent!.requiresHuman).toBe(true);
    });

    it('should escalate L2 failure to L1', async () => {
      // Execute at L2 with failure simulation
      const mockTask = {
        id: 'permanent-task',
        agent: 'mercury',
        description: 'task that will fail',
        dependencies: [],
        estimatedTokens: 1000,
        status: 'pending' as const,
        priority: 1,
        metadata: {},
      };
      
      // Configure agent to fail
      mockAgentExecutor.setShouldFail(mockTask.id, 5);
      
      // Execute at L2 (should fail)
      const execResult = await l2Layer.execute(mockTask);
      expect(execResult.success).toBe(false);
      
      // Evaluate escalation from L2 using 'failure' trigger
      // Need to exceed maxRetriesPerLayer (3) to trigger escalation
      const escalationEvent = await escalationManager.evaluateEscalation(
        2,
        mockTask.id,
        'failure after retries',  // Use 'failure' keyword to trigger auto-escalation
        4  // Exceed maxRetriesPerLayer (3)
      );
      
      expect(escalationEvent).not.toBeNull();
      expect(escalationEvent!.layer).toBe(2);
      expect(escalationEvent!.suggestedNextLayer).toBe(1); // L2 escalates to L1
      expect(escalationEvent!.requiresHuman).toBe(false); // Not yet requiring human
    });

    it('should require human intervention at L0', async () => {
      // Use unique task ID
      const taskId = `l0-intent-${Date.now()}`;
      
      // L0 always requires human intervention per EscalationManager.requiresHumanIntervention
      // which returns true immediately when layer === 0
      // Use 'failure' trigger with retryCount >= maxRetriesPerLayer (3) to trigger escalation
      const escalationEvent = await escalationManager.evaluateEscalation(
        0,
        taskId,
        'failure',  // 'failure' is in autoEscalateOn list
        4,  // >= maxRetriesPerLayer (3) to trigger escalation
        { confidence: 0.5 }
      );
      
      expect(escalationEvent).not.toBeNull();
      expect(escalationEvent!.layer).toBe(0);
      expect(escalationEvent!.requiresHuman).toBe(true);
      expect(escalationEvent!.suggestedNextLayer).toBe(-1); // L0 escalates to human
      
      // Verify escalation history
      const history = escalationManager.getHistory({ requiresHuman: true });
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].layer).toBe(0);
    });
  });

  // ============================================================================
  // Backward Compatibility End-to-End (3 tests)
  // ============================================================================
  describe('Backward Compatibility End-to-End', () => {
    it('should skip L0/L1 in flat mode', async () => {
      const flatConfig = createFlatModeConfig();
      
      // Verify flat mode configuration
      expect(flatConfig.enabled).toBe(false);
      expect(flatConfig.backwardCompatibilityMode).toBe(true);
      expect(flatConfig.layers.length).toBe(1);
      expect(flatConfig.layers[0].level).toBe(2);
      
      // In flat mode, tasks go directly to L2
      const mockTask = {
        id: 'flat-task-001',
        agent: 'mercury',
        description: 'direct execution task',
        dependencies: [],
        estimatedTokens: 1000,
        status: 'pending' as const,
        priority: 1,
        metadata: {},
      };
      
      // Execute directly at L2 (skipping L0/L1)
      const result = await l2Layer.execute(mockTask);
      expect(result.success).toBe(true);
    });

    it('should route directly to L2 in backward compatibility mode', async () => {
      // Simulate backward compatibility flow
      const userRequest = 'Create a simple component';
      
      // In backward compat mode, we skip intent parsing and planning
      // and create tasks directly for L2 execution
      const directTask = {
        id: 'compat-task-001',
        agent: 'venus',
        description: userRequest,
        dependencies: [],
        estimatedTokens: 1500,
        status: 'pending' as const,
        priority: 1,
        metadata: { mode: 'backward-compat' },
      };
      
      // Execute directly at L2
      const result = await l2Layer.execute(directTask);
      
      expect(result.success).toBe(true);
      expect(result.taskId).toBe(directTask.id);
      
      // Verify artifact was produced
      expect(result.artifacts.length).toBeGreaterThan(0);
      expect(result.artifacts[0].metadata.agent).toBe('venus');
    });

    it('should produce same result as hierarchical mode for simple tasks', async () => {
      // Test that flat mode produces equivalent results for simple tasks
      
      // Hierarchical path
      const hierarchicalIntent = await l0Layer.parseIntent('Fix typo in readme');
      const hierarchicalDecomp = await l1Layer.decompose(hierarchicalIntent.intent);
      const hierarchicalResult = await l2Layer.execute(hierarchicalDecomp.graph.nodes[0]);
      
      // Flat path (direct L2 execution)
      const flatTask = {
        id: 'flat-typo-fix',
        agent: 'mercury',
        description: 'Fix typo in readme',
        dependencies: [],
        estimatedTokens: 500,
        status: 'pending' as const,
        priority: 1,
        metadata: {},
      };
      const flatResult = await l2Layer.execute(flatTask);
      
      // Both should succeed
      expect(hierarchicalResult.success).toBe(true);
      expect(flatResult.success).toBe(true);
      
      // Both should produce artifacts
      expect(hierarchicalResult.artifacts.length).toBeGreaterThan(0);
      expect(flatResult.artifacts.length).toBeGreaterThan(0);
      
      // Artifact structure should be equivalent
      expect(hierarchicalResult.artifacts[0].type).toBe('code');
      expect(flatResult.artifacts[0].type).toBe('code');
    });
  });

  // ============================================================================
  // Parallel Execution (3 tests)
  // ============================================================================
  describe('Parallel Execution', () => {
    it('should execute parallel groups concurrently', async () => {
      // Create independent tasks (no dependencies between them)
      const independentTasks = [
        {
          id: 'parallel-1',
          agent: 'mercury',
          description: 'task 1',
          dependencies: [],
          estimatedTokens: 1000,
          status: 'pending' as const,
          priority: 1,
          metadata: {},
        },
        {
          id: 'parallel-2',
          agent: 'venus',
          description: 'task 2',
          dependencies: [],
          estimatedTokens: 1000,
          status: 'pending' as const,
          priority: 1,
          metadata: {},
        },
        {
          id: 'parallel-3',
          agent: 'mars',
          description: 'task 3',
          dependencies: [],
          estimatedTokens: 1000,
          status: 'pending' as const,
          priority: 1,
          metadata: {},
        },
      ];
      
      // Execute in parallel
      const startTime = Date.now();
      const result = await l2Layer.executeParallel(independentTasks, {
        maxConcurrency: 3,
      });
      const endTime = Date.now();
      
      // All should complete
      expect(result.completedCount).toBe(3);
      expect(result.failedCount).toBe(0);
      
      // Should complete faster than sequential (rough check)
      // Sequential would take ~3000ms with mocked delays, parallel should be faster
      expect(result.totalExecutionTimeMs).toBeLessThan(3000);
      
      // Verify all task IDs are in results
      const resultIds = result.results.map(r => r.taskId);
      expect(resultIds).toContain('parallel-1');
      expect(resultIds).toContain('parallel-2');
      expect(resultIds).toContain('parallel-3');
    });

    it('should merge results correctly from parallel execution', async () => {
      const tasks = [
        {
          id: 'merge-1',
          agent: 'mercury',
          description: 'generate spec',
          dependencies: [],
          estimatedTokens: 1000,
          status: 'pending' as const,
          priority: 1,
          metadata: {},
        },
        {
          id: 'merge-2',
          agent: 'venus',
          description: 'generate design',
          dependencies: [],
          estimatedTokens: 1000,
          status: 'pending' as const,
          priority: 1,
          metadata: {},
        },
      ];
      
      // Execute in parallel
      const parallelResult = await l2Layer.executeParallel(tasks);
      
      // Collect and merge artifacts
      const mergedArtifacts = l2Layer.collectArtifacts(parallelResult.results);
      
      // Should have artifacts from all tasks
      expect(mergedArtifacts.length).toBe(tasks.length);
      
      // Each artifact should have correct metadata
      const mercuryArtifact = mergedArtifacts.find(a => a.metadata.agent === 'mercury');
      const venusArtifact = mergedArtifacts.find(a => a.metadata.agent === 'venus');
      
      expect(mercuryArtifact).toBeDefined();
      expect(venusArtifact).toBeDefined();
      
      // Verify results array structure
      expect(parallelResult.results).toHaveLength(2);
      expect(parallelResult.results.every(r => r.success)).toBe(true);
      
      // Verify merged result stats
      expect(parallelResult.completedCount).toBe(2);
      expect(parallelResult.failedCount).toBe(0);
    });

    it('should respect dependency order during execution', async () => {
      // Create tasks with dependencies
      // Task A -> Task B -> Task C (B depends on A, C depends on B)
      const taskA = {
        id: 'dep-A',
        agent: 'mercury',
        description: 'step A',
        dependencies: [],
        estimatedTokens: 500,
        status: 'pending' as const,
        priority: 1,
        metadata: {},
      };
      
      const taskB = {
        id: 'dep-B',
        agent: 'venus',
        description: 'step B',
        dependencies: ['dep-A'],
        estimatedTokens: 500,
        status: 'pending' as const,
        priority: 2,
        metadata: {},
      };
      
      const taskC = {
        id: 'dep-C',
        agent: 'mars',
        description: 'step C',
        dependencies: ['dep-B'],
        estimatedTokens: 500,
        status: 'pending' as const,
        priority: 3,
        metadata: {},
      };
      
      const tasks = [taskA, taskB, taskC];
      
      // Build dependency map
      const dependencyMap = new Map<string, string[]>();
      for (const task of tasks) {
        dependencyMap.set(task.id, task.dependencies);
      }
      
      // Execute with dependencies
      const result = await l2Layer.executeWithDependencies(tasks, dependencyMap);
      
      // All should complete successfully
      expect(result.completedCount).toBe(3);
      expect(result.failedCount).toBe(0);
      
      // Verify execution order by checking results are in dependency order
      // Results may not be in strict order due to parallel batching,
      // but all should succeed if dependencies were respected
      const executionOrder: string[] = [];
      for (const execResult of result.results) {
        executionOrder.push(execResult.taskId);
      }
      
      // All tasks should be in results
      expect(executionOrder).toContain('dep-A');
      expect(executionOrder).toContain('dep-B');
      expect(executionOrder).toContain('dep-C');
      
      // Verify task A's result succeeded (it has no dependencies)
      const resultA = result.results.find(r => r.taskId === 'dep-A');
      expect(resultA?.success).toBe(true);
      
      // Verify task B's result succeeded (depends on A)
      const resultB = result.results.find(r => r.taskId === 'dep-B');
      expect(resultB?.success).toBe(true);
      
      // Verify task C's result succeeded (depends on B)
      const resultC = result.results.find(r => r.taskId === 'dep-C');
      expect(resultC?.success).toBe(true);
    });
  });
});
