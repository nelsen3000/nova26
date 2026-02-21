// KMS-02: /workflow CLI command for Workflow Engine
// List workflows, show node details, visualize graph, analyze critical path, export

import {
  RalphVisualWorkflowEngine,
  WorkflowEngineError,
  type PersistentWorkflow,
  type VisualNode,
  type VisualNodeStatus,
  type VisualNodeType,
} from '../workflow-engine/index.js';

// ============================================================================
// Workflow Manager - Simple registry for active workflows
// ============================================================================

interface WorkflowEntry {
  engine: RalphVisualWorkflowEngine;
  workflow: PersistentWorkflow;
  createdAt: Date;
}

class WorkflowManager {
  private workflows = new Map<string, WorkflowEntry>();
  private static instance: WorkflowManager | null = null;

  static getInstance(): WorkflowManager {
    if (!WorkflowManager.instance) {
      WorkflowManager.instance = new WorkflowManager();
    }
    return WorkflowManager.instance;
  }

  static resetInstance(): void {
    WorkflowManager.instance = null;
  }

  register(id: string, engine: RalphVisualWorkflowEngine, workflow: PersistentWorkflow): void {
    this.workflows.set(id, {
      engine,
      workflow,
      createdAt: new Date(),
    });
  }

  get(id: string): WorkflowEntry | undefined {
    return this.workflows.get(id);
  }

  list(): Array<{ id: string; entry: WorkflowEntry }> {
    return Array.from(this.workflows.entries()).map(([id, entry]) => ({ id, entry }));
  }

  getAllWorkflows(): PersistentWorkflow[] {
    return this.list().map(({ entry }) => entry.workflow);
  }

  clear(): void {
    this.workflows.clear();
  }

  size(): number {
    return this.workflows.size;
  }
}

// Export singleton getter for tests
export function getWorkflowManager(): WorkflowManager {
  return WorkflowManager.getInstance();
}

export function resetWorkflowManager(): void {
  WorkflowManager.resetInstance();
}

// ============================================================================
// Command Argument Parsing
// ============================================================================

interface WorkflowCommandArgs {
  action: 'list' | 'show' | 'graph' | 'critical-path' | 'export' | 'help';
  nodeId?: string;
  exportFormat?: 'json' | 'mermaid';
}

function parseWorkflowArgs(args: string[]): WorkflowCommandArgs {
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    return { action: 'help' };
  }

  const action = args[0] as WorkflowCommandArgs['action'];
  const remainingArgs = args.slice(1);

  switch (action) {
    case 'list':
      return { action: 'list' };

    case 'show':
      return { action: 'show', nodeId: remainingArgs[0] };

    case 'graph':
      return { action: 'graph' };

    case 'critical-path':
      return { action: 'critical-path' };

    case 'export': {
      const format = remainingArgs[0] as 'json' | 'mermaid' | undefined;
      return { action: 'export', exportFormat: format ?? 'json' };
    }

    default:
      return { action: 'help' };
  }
}

// ============================================================================
// Status Formatting Helpers
// ============================================================================

function getStatusIcon(status: VisualNodeStatus): string {
  const icons: Record<VisualNodeStatus, string> = {
    pending: '⏳',
    running: '🔄',
    complete: '✅',
    failed: '❌',
    skipped: '⏭️',
  };
  return icons[status] ?? '❓';
}

function getNodeTypeIcon(type: VisualNodeType): string {
  const icons: Record<VisualNodeType, string> = {
    agent: '🤖',
    gate: '🔒',
    decision: '🔀',
    parallel: '⚡',
    merge: '🔀',
  };
  return icons[type] ?? '📦';
}


// ============================================================================
// Command Handlers
// ============================================================================

async function handleListWorkflows(manager: WorkflowManager): Promise<void> {
  const workflows = manager.list();

  if (workflows.length === 0) {
    console.log('📭 No active workflows found.');
    console.log('   Use the workflow engine to create and manage workflows.\n');
    return;
  }

  console.log(`🔄 Active Workflows (${workflows.length}):\n`);

  for (const { id, entry } of workflows) {
    const { workflow } = entry;
    const stats = entry.engine.getStats();
    const statusIcon = workflow.state.globalStatus === 'running' ? '🟢' :
                       workflow.state.globalStatus === 'completed' ? '✅' :
                       workflow.state.globalStatus === 'failed' ? '❌' :
                       workflow.state.globalStatus === 'paused' ? '⏸️' : '⚪';

    console.log(`  ${statusIcon} ${workflow.name || id}`);
    console.log(`     ID: ${id}`);
    console.log(`     Status: ${workflow.state.globalStatus}`);
    console.log(`     Nodes: ${stats.completedNodes}/${stats.totalNodes} complete (${stats.failedNodes} failed)`);
    console.log(`     Current: ${workflow.state.currentNodeId || 'none'}`);
    console.log(`     Checkpoints: ${workflow.state.checkpoints.length}`);
    console.log();
  }
}

async function handleShowNode(manager: WorkflowManager, nodeId?: string): Promise<void> {
  if (!nodeId) {
    console.log('❌ Please specify a node ID. Usage: /workflow show <node-id>');
    return;
  }

  const workflows = manager.list();
  if (workflows.length === 0) {
    console.log('❌ No workflows found. Create a workflow first.');
    return;
  }

  // Search for node in all workflows
  let foundNode: VisualNode | null = null;
  let foundWorkflow: PersistentWorkflow | null = null;

  for (const { entry } of workflows) {
    const workflow = entry.engine.getWorkflow();
    const node = workflow.nodes.find((n) => n.id === nodeId);
    if (node) {
      foundNode = node;
      foundWorkflow = workflow;
      break;
    }
  }

  if (!foundNode || !foundWorkflow) {
    console.log(`❌ Node not found: ${nodeId}`);
    return;
  }

  console.log(`\n📦 Node: ${foundNode.label || foundNode.id}`);
  console.log(`   ID: ${foundNode.id}`);
  console.log(`   Type: ${getNodeTypeIcon(foundNode.type)} ${foundNode.type}`);
  console.log(`   Status: ${getStatusIcon(foundNode.status)} ${foundNode.status}`);
  console.log(`   Position: (${foundNode.position.x}, ${foundNode.position.y})`);

  if (foundNode.agentId) {
    console.log(`   Agent: ${foundNode.agentId}`);
  }

  console.log(`\n   Configuration:`);
  console.log(`     Entry Function: ${foundNode.config.entryFunction}`);
  console.log(`     Timeout: ${foundNode.config.timeoutMs ?? 'default'}ms`);

  if (foundNode.config.retryPolicy) {
    const rp = foundNode.config.retryPolicy;
    console.log(`     Retry: ${rp.maxRetries} attempts, ${rp.backoffMs}ms backoff (${rp.strategy ?? 'exponential'})`);
  }

  // Find connections
  const incoming = foundWorkflow.edges.filter((e) => e.to === nodeId);
  const outgoing = foundWorkflow.edges.filter((e) => e.from === nodeId);

  if (incoming.length > 0) {
    console.log(`\n   Incoming (${incoming.length}):`);
    for (const edge of incoming) {
      const fromNode = foundWorkflow.nodes.find((n) => n.id === edge.from);
      console.log(`     ← ${edge.from}${fromNode?.label ? ` (${fromNode.label})` : ''}${edge.condition ? ` [${edge.condition}]` : ''}`);
    }
  }

  if (outgoing.length > 0) {
    console.log(`\n   Outgoing (${outgoing.length}):`);
    for (const edge of outgoing) {
      const toNode = foundWorkflow.nodes.find((n) => n.id === edge.to);
      console.log(`     → ${edge.to}${toNode?.label ? ` (${toNode.label})` : ''}${edge.condition ? ` [${edge.condition}]` : ''}`);
    }
  }

  if (foundNode.metadata && Object.keys(foundNode.metadata).length > 0) {
    console.log(`\n   Metadata:`);
    for (const [key, value] of Object.entries(foundNode.metadata)) {
      if (value !== undefined) {
        console.log(`     ${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
      }
    }
  }

  console.log();
}

async function handleGraphVisualization(manager: WorkflowManager): Promise<void> {
  const workflows = manager.list();
  if (workflows.length === 0) {
    console.log('❌ No workflows found to visualize.');
    return;
  }

  // Show the first workflow's graph
  const { entry, id } = workflows[0];
  const workflow = entry.engine.getWorkflow();

  console.log(`\n🕸️  Workflow Graph: ${workflow.name || id}\n`);

  if (workflow.nodes.length === 0) {
    console.log('   (Empty workflow - no nodes)\n');
    return;
  }

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  for (const edge of workflow.edges) {
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge.to);
    adjacency.set(edge.from, list);
  }

  // Find entry points (nodes with no incoming edges)
  const incomingNodes = new Set(workflow.edges.map((e) => e.to));
  const entryPoints = workflow.nodes.filter((n) => !incomingNodes.has(n.id));

  // BFS traversal for display - entryPoints used in summary at end
  const visited = new Set<string>();
  const queue: Array<{ nodeId: string; depth: number; isLast: boolean; parentPrefix: string }> = [];

  // Add entry points
  for (let i = 0; i < entryPoints.length; i++) {
    const isLast = i === entryPoints.length - 1;
    queue.push({
      nodeId: entryPoints[i].id,
      depth: 0,
      isLast,
      parentPrefix: '',
    });
  }

  const displayed = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const { nodeId, depth, isLast, parentPrefix } = current;
    const node = workflow.nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    // Handle cycles - mark as visited but still display
    const isRevisit = visited.has(nodeId);
    visited.add(nodeId);

    // Build the line prefix
    const connector = depth === 0 ? '' : (isLast ? '└── ' : '├── ');
    const prefix = parentPrefix + connector;

    // Display the node
    const typeIcon = getNodeTypeIcon(node.type);
    const statusIcon = getStatusIcon(node.status);
    const cycleMark = isRevisit ? ' ↺' : '';
    const label = node.label ? ` (${node.label})` : '';

    console.log(`${prefix}${typeIcon} ${node.id}${label} ${statusIcon}${cycleMark}`);
    displayed.add(nodeId);

    // Add children to queue
    const children = adjacency.get(nodeId) ?? [];
    const childPrefix = parentPrefix + (depth === 0 ? '' : (isLast ? '    ' : '│   '));

    for (let i = 0; i < children.length; i++) {
      const childIsLast = i === children.length - 1;
      queue.push({
        nodeId: children[i],
        depth: depth + 1,
        isLast: childIsLast,
        parentPrefix: childPrefix,
      });
    }
  }

  // Show any disconnected nodes
  const disconnected = workflow.nodes.filter((n) => !displayed.has(n.id));
  if (disconnected.length > 0) {
    console.log('\n   (Disconnected nodes):');
    for (const node of disconnected) {
      const typeIcon = getNodeTypeIcon(node.type);
      const statusIcon = getStatusIcon(node.status);
      const label = node.label ? ` (${node.label})` : '';
      console.log(`   ${typeIcon} ${node.id}${label} ${statusIcon}`);
    }
  }

  // Summary
  console.log(`\n   ─────────────────────────`);
  console.log(`   Total nodes: ${workflow.nodes.length}`);
  console.log(`   Total edges: ${workflow.edges.length}`);
  console.log(`   Entry points: ${entryPoints.length}`);
  console.log();
}

async function handleCriticalPath(manager: WorkflowManager): Promise<void> {
  const workflows = manager.list();
  if (workflows.length === 0) {
    console.log('❌ No workflows found to analyze.');
    return;
  }

  const { entry, id } = workflows[0];
  const workflow = entry.engine.getWorkflow();

  console.log(`\n⏱️  Critical Path Analysis: ${workflow.name || id}\n`);

  // Build graph structures
  const adjacency = new Map<string, string[]>();
  const reverseAdjacency = new Map<string, string[]>();
  const edgeWeights = new Map<string, number>();

  for (const edge of workflow.edges) {
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge.to);
    adjacency.set(edge.from, list);

    const revList = reverseAdjacency.get(edge.to) ?? [];
    revList.push(edge.from);
    reverseAdjacency.set(edge.to, revList);

    // Estimate weight based on node execution (mock: use 1 as base)
    edgeWeights.set(`${edge.from}->${edge.to}`, 1);
  }

  // Find entry points (no incoming edges)
  const incomingNodes = new Set(workflow.edges.map((e) => e.to));
  const _entryPoints = workflow.nodes.filter((n) => !incomingNodes.has(n.id));

  // Find exit points (no outgoing edges)
  const outgoingNodes = new Set(workflow.edges.map((e) => e.from));
  const exitPoints = workflow.nodes.filter((n) => !outgoingNodes.has(n.id));

  // Calculate longest path (critical path) using dynamic programming
  const longestPath = new Map<string, { distance: number; path: string[] }>();

  function getLongestPathTo(nodeId: string): { distance: number; path: string[] } {
    if (longestPath.has(nodeId)) {
      return longestPath.get(nodeId)!;
    }

    const predecessors = reverseAdjacency.get(nodeId) ?? [];
    if (predecessors.length === 0) {
      const result = { distance: 1, path: [nodeId] };
      longestPath.set(nodeId, result);
      return result;
    }

    let maxDistance = 0;
    let bestPath: string[] = [nodeId];

    for (const pred of predecessors) {
      const predPath = getLongestPathTo(pred);
      const weight = edgeWeights.get(`${pred}->${nodeId}`) ?? 1;
      const totalDist = predPath.distance + weight;

      if (totalDist > maxDistance) {
        maxDistance = totalDist;
        bestPath = [...predPath.path, nodeId];
      }
    }

    const result = { distance: maxDistance, path: bestPath };
    longestPath.set(nodeId, result);
    return result;
  }

  // Find critical path among all exit points
  let criticalPath: { distance: number; path: string[] } = { distance: 0, path: [] };
  for (const exit of exitPoints) {
    const path = getLongestPathTo(exit.id);
    if (path.distance > criticalPath.distance) {
      criticalPath = path;
    }
  }

  // Avoid unused variable warning - _entryPoints may be used for future analysis
  void _entryPoints;

  // Display results
  if (criticalPath.path.length === 0) {
    console.log('   No critical path found (empty or cyclic workflow).\n');
    return;
  }

  console.log('   Critical Path:');
  console.log('   ' + '─'.repeat(50));

  for (let i = 0; i < criticalPath.path.length; i++) {
    const nodeId = criticalPath.path[i];
    const node = workflow.nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    const typeIcon = getNodeTypeIcon(node.type);
    const statusIcon = getStatusIcon(node.status);
    const label = node.label ? ` (${node.label})` : '';
    const isCritical = true;

    console.log(`   ${isCritical ? '★' : ' '} ${i + 1}. ${typeIcon} ${node.id}${label} ${statusIcon}`);

    if (i < criticalPath.path.length - 1) {
      console.log('        ↓');
    }
  }

  console.log('   ' + '─'.repeat(50));
  console.log(`\n   Path length: ${criticalPath.distance} steps`);
  console.log(`   Nodes in path: ${criticalPath.path.length}`);

  // Calculate parallel efficiency
  const totalNodes = workflow.nodes.length;
  const efficiency = totalNodes > 0 ? ((criticalPath.path.length / totalNodes) * 100).toFixed(1) : '0';
  console.log(`   Parallel efficiency: ${efficiency}% (${criticalPath.path.length}/${totalNodes} nodes on critical path)`);

  // Show bottlenecks (nodes with multiple incoming edges)
  const bottlenecks = workflow.nodes.filter((n) => (reverseAdjacency.get(n.id)?.length ?? 0) > 1);
  if (bottlenecks.length > 0) {
    console.log(`\n   ⚠️  Potential bottlenecks (merge nodes):`);
    for (const node of bottlenecks) {
      const incoming = reverseAdjacency.get(node.id)?.length ?? 0;
      console.log(`      ${node.id}${node.label ? ` (${node.label})` : ''} ← ${incoming} inputs`);
    }
  }

  console.log();
}

async function handleExport(
  manager: WorkflowManager,
  format: 'json' | 'mermaid'
): Promise<void> {
  const workflows = manager.list();
  if (workflows.length === 0) {
    console.log('❌ No workflows found to export.');
    return;
  }

  const { entry, id } = workflows[0];
  const workflow = entry.engine.getWorkflow();

  if (format === 'mermaid') {
    console.log(`\n🧜 Mermaid Diagram: ${workflow.name || id}\n`);
    console.log('```mermaid');
    console.log('flowchart TD');

    // Define nodes with styling
    for (const node of workflow.nodes) {
      const label = node.label ?? node.id;
      let style = '';

      // Style based on status
      switch (node.status) {
        case 'complete':
          style = ':::done';
          break;
        case 'running':
          style = ':::active';
          break;
        case 'failed':
          style = ':::error';
          break;
        default:
          style = '';
      }

      console.log(`    ${node.id}["${label}"]${style}`);
    }

    // Define edges
    for (const edge of workflow.edges) {
      const condition = edge.condition ? `|${edge.condition}|` : '';
      console.log(`    ${edge.from} -->${condition} ${edge.to}`);
    }

    // Define class styles
    console.log('```');
    console.log();
  } else {
    // JSON export
    console.log(`\n📄 JSON Export: ${workflow.name || id}\n`);
    const exportData = {
      id: workflow.id,
      name: workflow.name,
      createdAt: workflow.createdAt,
      lastModified: workflow.lastModified,
      state: {
        globalStatus: workflow.state.globalStatus,
        currentNodeId: workflow.state.currentNodeId,
        variables: Object.keys(workflow.state.variables),
        checkpointCount: workflow.state.checkpoints.length,
      },
      nodes: workflow.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        label: n.label,
        status: n.status,
        position: n.position,
        agentId: n.agentId,
        config: {
          entryFunction: n.config.entryFunction,
          timeoutMs: n.config.timeoutMs,
          retryPolicy: n.config.retryPolicy,
        },
      })),
      edges: workflow.edges.map((e) => ({
        from: e.from,
        to: e.to,
        condition: e.condition,
      })),
      timeline: workflow.timeline.map((t) => ({
        type: t.type,
        nodeId: t.nodeId,
        timestamp: t.timestamp,
      })),
      stats: entry.engine.getStats(),
    };

    console.log(JSON.stringify(exportData, null, 2));
    console.log();
  }
}

function showHelp(): void {
  console.log(`
🔄 /workflow — Workflow Engine Commands

Usage:
  /workflow list                    # List all workflows with status
  /workflow show <node-id>          # Show detailed node information
  /workflow graph                   # Display ASCII graph visualization
  /workflow critical-path           # Calculate and display critical path
  /workflow export [json|mermaid]   # Export as JSON or Mermaid diagram
  /workflow help

Examples:
  /workflow list                    # Show all active workflows
  /workflow show node-1             # Display details for node-1
  /workflow graph                   # Visualize workflow structure
  /workflow critical-path           # Find the longest execution path
  /workflow export json             # Export workflow as JSON
  /workflow export mermaid          # Export as Mermaid diagram

Node Types:
  🤖 agent     - Executes agent logic
  🔒 gate      - Validation checkpoint
  🔀 decision  - Conditional branch
  ⚡ parallel  - Parallel execution
  🔀 merge     - Join parallel branches

Node Status:
  ⏳ pending   - Waiting to execute
  🔄 running   - Currently executing
  ✅ complete  - Successfully completed
  ❌ failed    - Execution failed
  ⏭️  skipped   - Skipped execution
`);
}

// ============================================================================
// Main Command Export
// ============================================================================

export async function handleWorkflowCommand(args: string[]): Promise<void> {
  const parsed = parseWorkflowArgs(args);
  const manager = getWorkflowManager();

  try {
    switch (parsed.action) {
      case 'list':
        await handleListWorkflows(manager);
        break;
      case 'show':
        await handleShowNode(manager, parsed.nodeId);
        break;
      case 'graph':
        await handleGraphVisualization(manager);
        break;
      case 'critical-path':
        await handleCriticalPath(manager);
        break;
      case 'export':
        await handleExport(manager, parsed.exportFormat ?? 'json');
        break;
      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    if (error instanceof WorkflowEngineError) {
      console.log(`❌ Workflow error [${error.code}]: ${error.message}`);
      if (error.nodeId) {
        console.log(`   Node: ${error.nodeId}`);
      }
    } else {
      console.log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Command definition for slash-commands-extended.ts
export const workflowCommand = {
  name: '/workflow',
  description: 'Workflow Engine — list, show, graph, critical-path, export',
  usage: '/workflow <list|show|graph|critical-path|export> [args]',
  handler: handleWorkflowCommand,
};

// Re-export types for testing
export type { WorkflowManager, WorkflowEntry };
