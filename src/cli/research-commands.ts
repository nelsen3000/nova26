// KMS-06: /research CLI command for Perplexity Research
// Quick search, deep research, and cache management

import { PerplexityAgent, createPerplexityAgent } from '../tools/perplexity/index.js';
import type { PerplexityResearchBrief } from '../tools/perplexity/index.js';

// ============================================================================
// Research Command Handler
// ============================================================================

interface ResearchCommandArgs {
  action: 'search' | 'deep' | 'cache' | 'help';
  query?: string;
  clearCache?: boolean;
}

function parseResearchArgs(args: string[]): ResearchCommandArgs {
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    return { action: 'help' };
  }

  const action = args[0] as ResearchCommandArgs['action'];
  const remainingArgs = args.slice(1);

  switch (action) {
    case 'search': {
      const query = remainingArgs.join(' ');
      return { action: 'search', query };
    }

    case 'deep': {
      const query = remainingArgs.join(' ');
      return { action: 'deep', query };
    }

    case 'cache': {
      const clearCache = remainingArgs.includes('--clear');
      return { action: 'cache', clearCache };
    }

    default:
      return { action: 'help' };
  }
}

function formatSources(sources: PerplexityResearchBrief['sources']): string {
  if (sources.length === 0) {
    return '  No sources available';
  }

  return sources
    .map((source, index) => {
      const reliability = source.reliability >= 0.8 ? '✓' : source.reliability >= 0.5 ? '~' : '?';
      return `  ${index + 1}. [${reliability}] ${source.title}\n     ${source.url}`;
    })
    .join('\n');
}

function formatKeyFindings(findings: string[]): string {
  if (findings.length === 0) {
    return '  No key findings available';
  }

  return findings.map((finding, index) => `  ${index + 1}. ${finding}`).join('\n');
}

function formatNextActions(actions: string[]): string {
  if (actions.length === 0) {
    return '  No suggested actions';
  }

  return actions.map((action) => `  • ${action}`).join('\n');
}

async function handleSearch(
  agent: PerplexityAgent,
  query: string | undefined,
  deep: boolean
): Promise<void> {
  if (!query || query.trim().length === 0) {
    console.log('❌ Please provide a search query. Usage: /research search <query>');
    return;
  }

  const modeLabel = deep ? 'Deep Research' : 'Quick Search';
  console.log(`\n🔍 ${modeLabel}: "${query}"`);
  console.log('   Researching...\n');

  try {
    // Deep mode uses more comprehensive settings via context
    const context = deep ? 'comprehensive detailed research' : undefined;
    const result = await agent.research(query, context);

    // Display results
    console.log(`📊 Results (Relevance: ${result.novaRelevanceScore}%)`);
    console.log(`   Query ID: ${result.queryId}`);
    console.log(`   Timestamp: ${result.timestamp}\n`);

    console.log('📝 Synthesized Answer:');
    console.log(`   ${result.synthesizedAnswer}\n`);

    console.log('🔑 Key Findings:');
    console.log(formatKeyFindings(result.keyFindings));
    console.log();

    if (result.sources.length > 0) {
      console.log('📚 Sources:');
      console.log(formatSources(result.sources));
      console.log();
    }

    if (result.tags.length > 0) {
      console.log(`🏷️  Tags: ${result.tags.join(', ')}`);
    }

    console.log('\n💡 Suggested Next Actions:');
    console.log(formatNextActions(result.suggestedNextActions));
    console.log();
  } catch (error) {
    console.log(`❌ Research failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleCache(agent: PerplexityAgent, clear: boolean): Promise<void> {
  if (clear) {
    agent.clearCache();
    console.log('✅ Research cache cleared successfully');
    return;
  }

  const stats = agent.getCacheStats();
  console.log('\n📦 Research Cache Stats\n');
  console.log(`   Cached Entries: ${stats.size}`);
  console.log(`   Cache Hit Rate: ${stats.hitRate}%`);
  console.log();
  console.log('   Use `/research cache --clear` to clear the cache');
  console.log();
}

function showHelp(): void {
  console.log(`
🔍 /research — Perplexity Research Commands

Usage:
  /research search <query>          # Quick research search
  /research deep <query>            # Deep research with comprehensive results
  /research cache                   # Show cache statistics
  /research cache --clear           # Clear research cache
  /research help

Examples:
  /research search TypeScript tips           # Quick search for TypeScript tips
  /research deep "React performance"         # Deep research on React performance
  /research cache                            # View cache stats
  /research cache --clear                    # Clear all cached research

Notes:
  • Deep research provides more comprehensive results
  • Results are cached for 60 minutes by default
  • All research is scored for relevance by ATLAS
`);
}

// ============================================================================
// Main Command Export
// ============================================================================

export async function handleResearchCommand(args: string[]): Promise<void> {
  const parsed = parseResearchArgs(args);
  const agent = createPerplexityAgent();

  switch (parsed.action) {
    case 'search':
      await handleSearch(agent, parsed.query, false);
      break;
    case 'deep':
      await handleSearch(agent, parsed.query, true);
      break;
    case 'cache':
      await handleCache(agent, parsed.clearCache || false);
      break;
    case 'help':
    default:
      showHelp();
      break;
  }
}

// Command definition for slash-commands-extended.ts
export const researchCommand = {
  name: '/research',
  description: 'Perplexity Research — search, deep research, cache management',
  usage: '/research <search|deep|cache> [args]',
  handler: handleResearchCommand,
};
