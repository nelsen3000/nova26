// KMS-03: /memory CLI command for Infinite Memory
// Query, hierarchy, stats, and prune commands

import {
  ATLASInfiniteMemory,
  getInfiniteMemory,
  resetInfiniteMemory,
  type MemoryLevel,
  type HierarchicalMemoryNode,
} from '../atlas/infinite-memory-core.js';

// ============================================================================
// Memory Command Handler
// ============================================================================

interface MemoryCommandArgs {
  action: 'query' | 'hierarchy' | 'stats' | 'prune' | 'help';
  searchTerm?: string;
  days?: number;
}

function parseMemoryArgs(args: string[]): MemoryCommandArgs {
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    return { action: 'help' };
  }

  const action = args[0] as MemoryCommandArgs['action'];
  const remainingArgs = args.slice(1);

  switch (action) {
    case 'query': {
      const searchTerm = remainingArgs.join(' ').trim();
      return { action: 'query', searchTerm };
    }

    case 'hierarchy':
      return { action: 'hierarchy' };

    case 'stats':
      return { action: 'stats' };

    case 'prune': {
      let days = 30; // Default
      for (let i = 0; i < remainingArgs.length; i++) {
        if (remainingArgs[i] === '--days' && remainingArgs[i + 1]) {
          const parsedDays = parseInt(remainingArgs[i + 1], 10);
          if (!isNaN(parsedDays) && parsedDays > 0) {
            days = parsedDays;
          }
          i++;
        }
      }
      return { action: 'prune', days };
    }

    default:
      return { action: 'help' };
  }
}

// ============================================================================
// Command Handlers
// ============================================================================

async function handleQuery(
  memory: ATLASInfiniteMemory,
  searchTerm?: string
): Promise<void> {
  if (!searchTerm || searchTerm.trim().length === 0) {
    console.log('❌ Please specify a search term. Usage: /memory query <search>');
    return;
  }

  console.log(`🔍 Querying memory for: "${searchTerm}"\n`);

  const results = await memory.queryHierarchical(searchTerm, {
    limit: 20,
  });

  if (results.length === 0) {
    console.log('  No memories found matching your query.\n');
    return;
  }

  console.log(`  Found ${results.length} memory node(s):\n`);

  for (const node of results) {
    const levelIcon = getLevelIcon(node.level);
    const tasteBar = formatTasteBar(node.metadata.tasteScore);
    const preview =
      node.content.length > 60
        ? node.content.substring(0, 60) + '...'
        : node.content;

    console.log(`  ${levelIcon} ${node.id}`);
    console.log(`     ${tasteBar} Taste: ${(node.metadata.tasteScore * 100).toFixed(0)}%`);
    console.log(`     "${preview}"`);
    console.log(`     Accessed: ${node.metadata.accessCount} times | Level: ${node.level}`);
    console.log();
  }
}

async function handleHierarchy(memory: ATLASInfiniteMemory): Promise<void> {
  const graph = memory.getGraph();
  const stats = memory.getStats();

  if (stats.totalNodes === 0) {
    console.log('🧠 Memory Hierarchy\n');
    console.log('  No memories in the system yet.\n');
    return;
  }

  console.log('🧠 Memory Hierarchy (4-Level)\n');

  const levelOrder: MemoryLevel[] = ['lifetime', 'portfolio', 'project', 'scene'];
  const levelNames: Record<MemoryLevel, string> = {
    lifetime: '🌟 Lifetime',
    portfolio: '📁 Portfolio',
    project: '📂 Project',
    scene: '🎬 Scene',
  };

  for (const level of levelOrder) {
    const count = stats.byLevel[level];
    console.log(`${levelNames[level]} (${count} nodes)`);

    if (count === 0) {
      console.log('   (empty)');
      console.log();
      continue;
    }

    // Find root nodes at this level (no parent or parent at higher level)
    const rootNodes = findRootNodesAtLevel(graph.nodes, level);

    if (rootNodes.length === 0) {
      // Show all nodes at this level if no clear roots
      const allNodesAtLevel = Array.from(graph.nodes.values()).filter(
        (n) => n.level === level
      );
      for (const node of allNodesAtLevel.slice(0, 5)) {
        printNodeTree(memory, node, 1, new Set<string>());
      }
      if (allNodesAtLevel.length > 5) {
        console.log(`   ... and ${allNodesAtLevel.length - 5} more`);
      }
    } else {
      for (const node of rootNodes.slice(0, 5)) {
        printNodeTree(memory, node, 1, new Set<string>());
      }
      if (rootNodes.length > 5) {
        console.log(`   ... and ${rootNodes.length - 5} more roots`);
      }
    }
    console.log();
  }

  console.log(`Total: ${stats.totalNodes} nodes, ${stats.totalEdges} edges\n`);
}

async function handleStats(memory: ATLASInfiniteMemory): Promise<void> {
  const stats = memory.getStats();

  console.log('📊 Infinite Memory Statistics\n');

  console.log(`  Total Memory Nodes: ${stats.totalNodes}`);
  console.log(`  Total Edges: ${stats.totalEdges}`);
  console.log(`  Average Taste Score: ${(stats.avgTasteScore * 100).toFixed(1)}%\n`);

  console.log('  By Level:');
  const levelIcons: Record<MemoryLevel, string> = {
    scene: '🎬',
    project: '📂',
    portfolio: '📁',
    lifetime: '🌟',
  };

  for (const [level, count] of Object.entries(stats.byLevel)) {
    const icon = levelIcons[level as MemoryLevel];
    const percentage =
      stats.totalNodes > 0 ? ((count / stats.totalNodes) * 100).toFixed(1) : '0.0';
    const bar = '█'.repeat(Math.round(Number(percentage) / 5));
    console.log(
      `    ${icon} ${level.padEnd(10)} ${String(count).padStart(4)} nodes (${percentage}%) ${bar}`
    );
  }

  console.log();
}

async function handlePrune(
  memory: ATLASInfiniteMemory,
  days: number
): Promise<void> {
  console.log(`🧹 Pruning memories older than ${days} days...\n`);

  const prunedCount = await memory.pruneStale(days);

  if (prunedCount === 0) {
    console.log('  No stale memories found. All memories are fresh! 🌟\n');
  } else {
    console.log(`  Pruned ${prunedCount} stale memory node(s).\n`);
    console.log('  💡 Tip: Lifetime memories are never pruned automatically.');
    console.log('     High taste score memories (≥80%) are also preserved.\n');
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getLevelIcon(level: MemoryLevel): string {
  const icons: Record<MemoryLevel, string> = {
    scene: '🎬',
    project: '📂',
    portfolio: '📁',
    lifetime: '🌟',
  };
  return icons[level];
}

function formatTasteBar(score: number): string {
  const filled = Math.round(score * 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function findRootNodesAtLevel(
  nodes: Map<string, HierarchicalMemoryNode>,
  level: MemoryLevel
): HierarchicalMemoryNode[] {
  const roots: HierarchicalMemoryNode[] = [];

  for (const node of Array.from(nodes.values())) {
    if (node.level !== level) continue;

    // Root node: no parent, or parent at a higher level
    if (!node.parentId) {
      roots.push(node);
    } else {
      const parent = nodes.get(node.parentId);
      if (parent) {
        const levelOrder: MemoryLevel[] = ['scene', 'project', 'portfolio', 'lifetime'];
        const parentIndex = levelOrder.indexOf(parent.level);
        const nodeIndex = levelOrder.indexOf(node.level);
        // If parent is at a "higher" level (higher index), this is a root
        if (parentIndex > nodeIndex) {
          roots.push(node);
        }
      }
    }
  }

  return roots;
}

function printNodeTree(
  memory: ATLASInfiniteMemory,
  node: HierarchicalMemoryNode,
  depth: number,
  visited: Set<string>
): void {
  if (visited.has(node.id)) {
    console.log(`${'  '.repeat(depth)}└── (circular reference)`);
    return;
  }

  visited.add(node.id);

  const indent = '  '.repeat(depth);
  const prefix = depth > 1 ? '└── ' : '';
  const preview =
    node.content.length > 40
      ? node.content.substring(0, 40) + '...'
      : node.content;
  const taste = (node.metadata.tasteScore * 100).toFixed(0);

  console.log(`${indent}${prefix}${getLevelIcon(node.level)} "${preview}" (taste: ${taste}%)`);

  // Print children (up to 3)
  const children = memory.getChildren(node.id);
  for (let i = 0; i < Math.min(children.length, 3); i++) {
    printNodeTree(memory, children[i], depth + 1, new Set(visited));
  }

  if (children.length > 3) {
    console.log(`${indent}  └── ... and ${children.length - 3} more children`);
  }
}

function showHelp(): void {
  console.log(`
🧠 /memory — Infinite Memory Commands

Usage:
  /memory query <search>           Query memories with text search
  /memory hierarchy                Show 4-level memory hierarchy
  /memory stats                    Show memory statistics
  /memory prune [--days <n>]       Prune stale memories (default: 30 days)
  /memory help

Examples:
  /memory query "authentication"   Search for memories about auth
  /memory hierarchy                Display full memory tree
  /memory stats                    Show memory statistics
  /memory prune                    Remove memories older than 30 days
  /memory prune --days 7           Remove memories older than 7 days

Hierarchy Levels:
  🌟 Lifetime  — Permanent knowledge (never auto-pruned)
  📁 Portfolio — Cross-project patterns
  📂 Project  — Project-specific context
  🎬 Scene    — Current session/scene context
`);
}

// ============================================================================
// Main Command Export
// ============================================================================

export async function handleMemoryCommand(args: string[]): Promise<void> {
  const parsed = parseMemoryArgs(args);
  const memory = getInfiniteMemory();

  try {
    switch (parsed.action) {
      case 'query':
        await handleQuery(memory, parsed.searchTerm);
        break;
      case 'hierarchy':
        await handleHierarchy(memory);
        break;
      case 'stats':
        await handleStats(memory);
        break;
      case 'prune':
        await handlePrune(memory, parsed.days ?? 30);
        break;
      case 'help':
      default:
        showHelp();
        break;
    }
  } finally {
    // Clean up memory state
    resetInfiniteMemory();
  }
}

// Command definition for slash-commands-extended.ts
export const memoryCommand = {
  name: '/memory',
  description: 'Infinite Memory — query, hierarchy, stats, prune',
  usage: '/memory <query|hierarchy|stats|prune> [args]',
  handler: handleMemoryCommand,
};
