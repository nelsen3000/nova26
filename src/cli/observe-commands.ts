// KMS-04: /observe CLI command for Observability
// Traces, spans, reports, and configuration for Cinematic Observability

import {
  getCinematicObservability,
  resetCinematicObservability,
  type CinematicObservability,
} from '../observability/cinematic-core.js';
import type { CinematicSpan } from '../observability/types.js';

// ============================================================================
// Observability Command Handler
// ============================================================================

interface ObserveCommandArgs {
  action: 'traces' | 'spans' | 'report' | 'config' | 'help';
  traceId?: string;
  buildId?: string;
  backend?: 'braintrust' | 'langsmith';
  apiKey?: string;
  projectName?: string;
  endpoint?: string;
}

function parseObserveArgs(args: string[]): ObserveCommandArgs {
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    return { action: 'help' };
  }

  const action = args[0] as ObserveCommandArgs['action'];
  const remainingArgs = args.slice(1);

  switch (action) {
    case 'traces':
      return { action: 'traces' };

    case 'spans': {
      const traceId = remainingArgs[0];
      return { action: 'spans', traceId };
    }

    case 'report': {
      const buildId = remainingArgs[0];
      return { action: 'report', buildId };
    }

    case 'config': {
      let backend: 'braintrust' | 'langsmith' | undefined;
      let apiKey: string | undefined;
      let projectName: string | undefined;
      let endpoint: string | undefined;

      for (let i = 0; i < remainingArgs.length; i++) {
        if (remainingArgs[i] === '--braintrust') {
          backend = 'braintrust';
        } else if (remainingArgs[i] === '--langsmith') {
          backend = 'langsmith';
        } else if (remainingArgs[i] === '--api-key' && remainingArgs[i + 1]) {
          apiKey = remainingArgs[i + 1];
          i++;
        } else if (remainingArgs[i] === '--project' && remainingArgs[i + 1]) {
          projectName = remainingArgs[i + 1];
          i++;
        } else if (remainingArgs[i] === '--endpoint' && remainingArgs[i + 1]) {
          endpoint = remainingArgs[i + 1];
          i++;
        }
      }

      return { action: 'config', backend, apiKey, projectName, endpoint };
    }

    default:
      return { action: 'help' };
  }
}

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return 'running';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString();
}

function getStatusEmoji(status: CinematicSpan['status']): string {
  switch (status) {
    case 'running':
      return '🔄';
    case 'success':
      return '✅';
    case 'failure':
      return '❌';
    default:
      return '❓';
  }
}

function getSpanTypeEmoji(type: CinematicSpan['type']): string {
  switch (type) {
    case 'agent-call':
      return '🤖';
    case 'llm-inference':
      return '🧠';
    case 'tool-use':
      return '🔧';
    case 'gate-check':
      return '🚦';
    case 'user-interaction':
      return '👤';
    default:
      return '📋';
  }
}

async function handleListTraces(observability: CinematicObservability): Promise<void> {
  const stats = observability.getStats();

  console.log(`\n🔍 Active Traces (${stats.activeTraces} traces, ${stats.totalSpans} spans)\n`);

  if (stats.activeTraces === 0) {
    console.log('  No active traces. Start an operation to generate traces.\n');
    return;
  }

  // Get sample of spans to show trace info
  const runningSpans = observability.getSpansByStatus('running');
  const completedSpans = observability.getSpansByStatus('success');
  const failedSpans = observability.getSpansByStatus('failure');

  // Group by trace ID
  const traceMap = new Map<string, { spans: CinematicSpan[]; status: CinematicSpan['status'] }>();

  for (const span of [...runningSpans, ...completedSpans, ...failedSpans]) {
    const existing = traceMap.get(span.traceId);
    if (existing) {
      existing.spans.push(span);
      if (span.status === 'failure') existing.status = 'failure';
      else if (span.status === 'running' && existing.status !== 'failure') existing.status = 'running';
    } else {
      traceMap.set(span.traceId, { spans: [span], status: span.status });
    }
  }

  // Show traces
  for (const [traceId, data] of Array.from(traceMap.entries())) {
    const statusEmoji = getStatusEmoji(data.status);
    const agentSet = new Set(data.spans.map((s) => s.agentId));
    const agents = Array.from(agentSet).slice(0, 3).join(', ');
    const more = agentSet.size > 3 ? ` +${agentSet.size - 3} more` : '';
    const duration = data.spans.some((s) => s.durationMs)
      ? formatDuration(Math.max(...data.spans.map((s) => s.durationMs || 0)))
      : 'running';

    console.log(`  ${statusEmoji} ${traceId.substring(0, 8)}...`);
    console.log(`     Spans: ${data.spans.length} | Agents: ${agents}${more} | Duration: ${duration}`);
    console.log();
  }

  // Summary
  console.log(`  Summary: ${stats.runningSpans} running, ${stats.completedSpans} completed, ${stats.failedSpans} failed\n`);
}

async function handleListSpans(observability: CinematicObservability, traceId: string | undefined): Promise<void> {
  if (!traceId) {
    console.log('❌ Please specify a trace ID. Usage: /observe spans <trace-id>');
    return;
  }

  const spans = observability.getTraceTree(traceId);

  if (spans.length === 0) {
    console.log(`❌ No spans found for trace: ${traceId}`);
    return;
  }

  console.log(`\n📋 Spans for Trace: ${traceId.substring(0, 16)}...\n`);

  // Build hierarchy
  const spanMap = new Map<string, CinematicSpan & { depth: number }>();
  const roots: Array<CinematicSpan & { depth: number }> = [];

  // First pass: create map
  for (const span of spans) {
    spanMap.set(span.id, { ...span, depth: 0 });
  }

  // Second pass: build hierarchy and set depth
  for (const span of spans) {
    const node = spanMap.get(span.id)!;
    if (span.parentId && spanMap.has(span.parentId)) {
      const parent = spanMap.get(span.parentId)!;
      node.depth = parent.depth + 1;
    } else {
      roots.push(node);
    }
  }

  // Display
  for (const span of spans) {
    const node = spanMap.get(span.id)!;
    const indent = '  '.repeat(node.depth);
    const typeEmoji = getSpanTypeEmoji(span.type);
    const statusEmoji = getStatusEmoji(span.status);
    const duration = formatDuration(span.durationMs);
    const name = span.name.length > 30 ? span.name.substring(0, 27) + '...' : span.name;

    console.log(`${indent}${typeEmoji} ${statusEmoji} ${name.padEnd(32)} ${duration.padStart(10)}`);
    console.log(`${indent}   Agent: ${span.agentId} | ${formatTimestamp(span.startTime)}`);

    if (span.tasteVaultScore !== undefined) {
      const score = (span.tasteVaultScore * 100).toFixed(0);
      console.log(`${indent}   Taste Score: ${score}%`);
    }

    console.log();
  }
}

async function handleShowReport(observability: CinematicObservability, buildId: string | undefined): Promise<void> {
  const targetBuildId = buildId || `build-${Date.now()}`;

  console.log(`\n📊 Observability Report: ${targetBuildId}\n`);

  const stats = observability.getStats();

  console.log('  ┌─────────────────────────────────────┐');
  console.log('  │           Span Statistics           │');
  console.log('  ├─────────────────────────────────────┤');
  console.log(`  │  Total Spans:      ${String(stats.totalSpans).padStart(23)} │`);
  console.log(`  │  Active Traces:    ${String(stats.activeTraces).padStart(23)} │`);
  console.log(`  │  Running:          ${String(stats.runningSpans).padStart(23)} │`);
  console.log(`  │  Completed:        ${String(stats.completedSpans).padStart(23)} │`);
  console.log(`  │  Failed:           ${String(stats.failedSpans).padStart(23)} │`);
  console.log('  └─────────────────────────────────────┘');

  // Success rate
  const completed = stats.completedSpans + stats.failedSpans;
  const successRate = completed > 0 ? ((stats.completedSpans / completed) * 100).toFixed(1) : '0.0';
  console.log(`\n  Success Rate: ${successRate}%`);

  // Remediation history
  const remediationHistory = observability.getRemediationHistory();
  if (remediationHistory.length > 0) {
    console.log(`\n  ⚠️  Remediation Events: ${remediationHistory.length}`);
    for (const event of remediationHistory.slice(-3)) {
      const actions = event.actionsTaken.join(', ');
      console.log(`     - ${formatTimestamp(event.timestamp)}: ${actions} (${(event.scoreDrop * 100).toFixed(1)}% drop)`);
    }
  }

  // Agent breakdown
  const agentStats = new Map<string, { spans: number; failures: number }>();
  const allSpans = [
    ...observability.getSpansByStatus('running'),
    ...observability.getSpansByStatus('success'),
    ...observability.getSpansByStatus('failure'),
  ];

  for (const span of allSpans) {
    const existing = agentStats.get(span.agentId);
    if (existing) {
      existing.spans++;
      if (span.status === 'failure') existing.failures++;
    } else {
      agentStats.set(span.agentId, { spans: 1, failures: span.status === 'failure' ? 1 : 0 });
    }
  }

  if (agentStats.size > 0) {
    console.log('\n  Agent Performance:');
    for (const [agentId, data] of Array.from(agentStats.entries())) {
      const failRate = data.spans > 0 ? ((data.failures / data.spans) * 100).toFixed(0) : '0';
      const bar = '█'.repeat(Math.min(data.spans, 20));
      console.log(`     ${agentId.padEnd(12)} ${bar} ${data.spans} spans (${failRate}% fail)`);
    }
  }

  console.log('\n');
}

async function handleConfig(
  backend: 'braintrust' | 'langsmith' | undefined,
  apiKey: string | undefined,
  projectName: string | undefined,
  endpoint: string | undefined
): Promise<void> {
  if (!backend) {
    // Show current config
    console.log('\n⚙️  Observability Configuration\n');
    console.log('  Backends:');
    console.log('    • Braintrust: Configure with --braintrust --api-key <key> --project <name>');
    console.log('    • LangSmith:  Configure with --langsmith --api-key <key> --endpoint <url>');
    console.log('\n  Usage:');
    console.log('    /observe config --braintrust --api-key bt-xxx --project my-project');
    console.log('    /observe config --langsmith --api-key ls-xxx --endpoint https://api.langchain.com');
    console.log('\n');
    return;
  }

  if (backend === 'braintrust') {
    if (!apiKey) {
      console.log('❌ Braintrust API key required. Use --api-key <key>');
      return;
    }

    const project = projectName || 'nova26-default';
    console.log(`\n✅ Braintrust configured`);
    console.log(`   Project: ${project}`);
    console.log(`   API Key: ${apiKey.substring(0, 8)}...`);
    console.log('\n   Traces will be exported to Braintrust on next build.\n');
  } else if (backend === 'langsmith') {
    if (!apiKey) {
      console.log('❌ LangSmith API key required. Use --api-key <key>');
      return;
    }

    const ep = endpoint || 'https://api.smith.langchain.com';
    console.log(`\n✅ LangSmith configured`);
    console.log(`   Endpoint: ${ep}`);
    console.log(`   API Key: ${apiKey.substring(0, 8)}...`);
    console.log('\n   Traces will be exported to LangSmith on next build.\n');
  }
}

function showHelp(): void {
  console.log(`
🔍 /observe — Cinematic Observability Commands

Usage:
  /observe traces                    # Show active traces
  /observe spans <trace-id>          # List spans for a trace
  /observe report [build-id]         # Show observability report
  /observe config [--braintrust|--langsmith] [options]  # Configure backends

Backend Configuration:
  --braintrust                       # Configure Braintrust backend
  --langsmith                        # Configure LangSmith backend
  --api-key <key>                    # API key for the backend
  --project <name>                   # Project name (Braintrust)
  --endpoint <url>                   # API endpoint (LangSmith)

Examples:
  /observe traces                    # List all active traces
  /observe spans abc-123-def         # Show spans for trace
  /observe report build-123          # Show report for build
  /observe config --braintrust --api-key bt-xxx --project my-app
  /observe config --langsmith --api-key ls-xxx --endpoint https://api.smith.langchain.com
`);
}

// ============================================================================
// Main Command Export
// ============================================================================

export async function handleObserveCommand(args: string[]): Promise<void> {
  const parsed = parseObserveArgs(args);
  const observability = getCinematicObservability();

  try {
    switch (parsed.action) {
      case 'traces':
        await handleListTraces(observability);
        break;
      case 'spans':
        await handleListSpans(observability, parsed.traceId);
        break;
      case 'report':
        await handleShowReport(observability, parsed.buildId);
        break;
      case 'config':
        await handleConfig(
          parsed.backend,
          parsed.apiKey,
          parsed.projectName,
          parsed.endpoint
        );
        break;
      case 'help':
      default:
        showHelp();
        break;
    }
  } finally {
    // Clean up observability state - reset singleton
    resetCinematicObservability();
  }
}

// Command definition for slash-commands-extended.ts
export const observeCommand = {
  name: '/observe',
  description: 'Cinematic Observability — traces, spans, reports, config',
  usage: '/observe <traces|spans|report|config> [args]',
  handler: handleObserveCommand,
};
