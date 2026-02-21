// KMS-01: /models CLI command for AI Model Database
// List models, show model details, compare models, run ensemble debate

import {
  AIModelVault,
  getAIModelVault,
  resetAIModelVault,
  EnsembleEngine,
  type ModelMetadata,
  type ModelVote,
} from '../models/index.js';

// ============================================================================
// Models Command Handler
// ============================================================================

interface ModelsCommandArgs {
  action: 'list' | 'show' | 'compare' | 'debate' | 'help';
  modelIds?: string[];
  prompt?: string;
  filters?: {
    provider?: string;
    minCodeScore?: number;
    localOnly?: boolean;
  };
}

function parseModelsArgs(args: string[]): ModelsCommandArgs {
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    return { action: 'help' };
  }

  const action = args[0] as ModelsCommandArgs['action'];
  const remainingArgs = args.slice(1);

  switch (action) {
    case 'list': {
      const filters: ModelsCommandArgs['filters'] = {};
      for (let i = 0; i < remainingArgs.length; i++) {
        if (remainingArgs[i] === '--provider' && remainingArgs[i + 1]) {
          filters.provider = remainingArgs[i + 1];
          i++;
        } else if (remainingArgs[i] === '--min-code' && remainingArgs[i + 1]) {
          filters.minCodeScore = parseInt(remainingArgs[i + 1], 10);
          i++;
        } else if (remainingArgs[i] === '--local') {
          filters.localOnly = true;
        }
      }
      return { action: 'list', filters };
    }

    case 'show':
      return { action: 'show', modelIds: remainingArgs };

    case 'compare':
      return { action: 'compare', modelIds: remainingArgs };

    case 'debate': {
      // Format: /models debate model1,model2,model3 "prompt text"
      const modelIds = remainingArgs[0]?.split(',').filter(Boolean) || [];
      const prompt = remainingArgs.slice(1).join(' ');
      return { action: 'debate', modelIds, prompt };
    }

    default:
      return { action: 'help' };
  }
}

function formatModelCapabilities(capabilities: ModelMetadata['capabilities']): string {
  const bars = (score: number): string => {
    const filled = Math.round(score / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  };

  return `
    Code:        ${bars(capabilities.code)} ${capabilities.code}%
    Reasoning:   ${bars(capabilities.reasoning)} ${capabilities.reasoning}%
    Multimodal:  ${bars(capabilities.multimodal)} ${capabilities.multimodal}%
    Speed:       ${bars(capabilities.speed)} ${capabilities.speed}%
    Cost:        ${bars(capabilities.cost)} ${capabilities.cost}%`;
}

function formatPricing(model: ModelMetadata): string {
  const input = model.pricing.inputPerMToken.toFixed(2);
  const output = model.pricing.outputPerMToken.toFixed(2);
  return `$${input}/M tokens in, $${output}/M tokens out`;
}

async function handleListModels(vault: AIModelVault, filters?: ModelsCommandArgs['filters']): Promise<void> {
  const models = vault.listModels();

  const filtered = models.filter((model) => {
    if (filters?.provider && model.provider !== filters.provider) return false;
    if (filters?.minCodeScore && model.capabilities.code < filters.minCodeScore) return false;
    if (filters?.localOnly && !model.capabilities.localAvailable) return false;
    return true;
  });

  console.log(`🤖 AI Models (${filtered.length}/${models.length}):\n`);

  // Group by provider
  const byProvider = new Map<string, ModelMetadata[]>();
  for (const model of filtered) {
    const list = byProvider.get(model.provider) || [];
    list.push(model);
    byProvider.set(model.provider, list);
  }

  for (const [provider, providerModels] of byProvider) {
    console.log(`  📦 ${provider.toUpperCase()}:`);
    for (const model of providerModels) {
      const local = model.capabilities.localAvailable ? '🏠' : '☁️';
      const speed = model.capabilities.speed >= 90 ? '⚡' : model.capabilities.speed >= 75 ? '🚀' : '🐢';
      console.log(`     ${local} ${speed} ${model.id.padEnd(20)} — ${model.name}`);
    }
    console.log();
  }
}

async function handleShowModel(vault: AIModelVault, modelIds: string[]): Promise<void> {
  if (modelIds.length === 0) {
    console.log('❌ Please specify a model ID. Usage: /models show <model-id>');
    return;
  }

  for (const modelId of modelIds) {
    const model = vault.getModel(modelId);
    if (!model) {
      console.log(`❌ Model not found: ${modelId}`);
      continue;
    }

    console.log(`\n🤖 ${model.name}`);
    console.log(`   ID: ${model.id}`);
    console.log(`   Provider: ${model.provider}`);
    console.log(`   Family: ${model.family} ${model.version}`);
    console.log(`   Context Window: ${model.contextWindow.toLocaleString()} tokens`);
    console.log(`   Pricing: ${formatPricing(model)}`);
    console.log(`   Local Available: ${model.capabilities.localAvailable ? '✅ Yes' : '❌ No'}`);

    if (model.capabilities.localAvailable && model.capabilities.quantizations.length > 0) {
      console.log(`   Quantizations: ${model.capabilities.quantizations.join(', ')}`);
    }

    console.log(`\n   Capabilities:${formatModelCapabilities(model.capabilities)}`);

    console.log('\n   Benchmarks:');
    for (const [name, score] of Object.entries(model.benchmarks)) {
      console.log(`     ${name.padEnd(15)}: ${score}%`);
    }

    console.log(`   Last Updated: ${model.lastUpdated}`);
    console.log();
  }
}

async function handleCompareModels(vault: AIModelVault, modelIds: string[]): Promise<void> {
  if (modelIds.length < 2) {
    console.log('❌ Please specify at least 2 models to compare. Usage: /models compare <model1> <model2> [...]');
    return;
  }

  const models: ModelMetadata[] = [];
  for (const id of modelIds) {
    const model = vault.getModel(id);
    if (model) {
      models.push(model);
    } else {
      console.log(`⚠️  Model not found: ${id}`);
    }
  }

  if (models.length < 2) {
    console.log('❌ Need at least 2 valid models to compare');
    return;
  }

  console.log('\n📊 Model Comparison\n');

  // Header
  const maxIdLength = Math.max(...models.map((m) => m.id.length));
  const header = 'Capability'.padEnd(12) + models.map((m) => m.id.padEnd(maxIdLength + 2)).join('');
  console.log(header);
  console.log('─'.repeat(header.length));

  // Comparison rows
  const capabilities: Array<{ name: string; key: keyof ModelMetadata['capabilities'] }> = [
    { name: 'Code', key: 'code' },
    { name: 'Reasoning', key: 'reasoning' },
    { name: 'Multimodal', key: 'multimodal' },
    { name: 'Speed', key: 'speed' },
    { name: 'Cost', key: 'cost' },
  ];

  for (const cap of capabilities) {
    const row =
      cap.name.padEnd(12) +
      models.map((m) => String(m.capabilities[cap.key]).padEnd(maxIdLength + 2)).join('');
    console.log(row);
  }

  // Context window
  console.log(
    '\n' +
      'Context'.padEnd(12) +
      models.map((m) => `${(m.contextWindow / 1000).toFixed(0)}k`.padEnd(maxIdLength + 2)).join('')
  );

  // Pricing
  console.log(
    'In/Out $/M'.padEnd(12) +
      models
        .map((m) => `${m.pricing.inputPerMToken}/${m.pricing.outputPerMToken}`.padEnd(maxIdLength + 2))
        .join('')
  );

  // Local availability
  console.log(
    'Local'.padEnd(12) +
      models.map((m) => (m.capabilities.localAvailable ? '✅' : '❌').padEnd(maxIdLength + 2)).join('')
  );

  console.log();
}

async function handleDebate(
  vault: AIModelVault,
  modelIds: string[],
  prompt?: string
): Promise<void> {
  if (modelIds.length < 2) {
    console.log('❌ Please specify at least 2 models. Usage: /models debate model1,model2 "prompt"');
    return;
  }

  if (!prompt || prompt.trim().length === 0) {
    console.log('❌ Please provide a prompt for the debate. Usage: /models debate model1,model2 "prompt text"');
    return;
  }

  // Validate models
  const validModels: string[] = [];
  for (const id of modelIds) {
    if (vault.getModel(id)) {
      validModels.push(id);
    } else {
      console.log(`⚠️  Model not found: ${id}`);
    }
  }

  if (validModels.length < 2) {
    console.log('❌ Need at least 2 valid models for a debate');
    return;
  }

  console.log(`\n🎭 Ensemble Debate`);
  console.log(`   Models: ${validModels.join(', ')}`);
  console.log(`   Prompt: "${prompt}"\n`);
  console.log('   Debating...\n');

  // Create ensemble engine
  const ensemble = new EnsembleEngine(vault);

  try {
    const result = await ensemble.debate(validModels, prompt);

    console.log('📊 Results:\n');

    // Show each model's response from votes
    const modelResponses = new Map<string, ModelVote>();
    for (const vote of result.votes) {
      modelResponses.set(vote.modelId, vote);
    }

    for (const [modelId, vote] of modelResponses) {
      const model = vault.getModel(modelId);
      console.log(`   🤖 ${model?.name || modelId}:`);
      console.log(`      "${vote.response.substring(0, 100)}${vote.response.length > 100 ? '...' : ''}"`);
      console.log(`      Confidence: ${(vote.confidence * 100).toFixed(0)}%`);
      console.log();
    }

    // Show votes
    console.log('   🗳️  Votes:');
    for (const vote of result.votes) {
      const voter = vault.getModel(vote.modelId);
      const votedFor = vault.getModel(vote.votedFor);
      console.log(
        `      ${voter?.name || vote.modelId} → ${votedFor?.name || vote.votedFor} (${(vote.confidence * 100).toFixed(0)}%)`
      );
    }

    // Winner
    const winner = vault.getModel(result.winner);
    console.log(`\n🏆 Winner: ${winner?.name || result.winner}`);
    console.log(`   Consensus: ${(result.consensusScore * 100).toFixed(0)}%`);
    console.log(`   Reasoning: ${result.reasoning}\n`);
  } catch (error) {
    console.log(`❌ Debate failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function showHelp(): void {
  console.log(`
🤖 /models — AI Model Database Commands

Usage:
  /models list [--provider <name>] [--min-code <score>] [--local]
  /models show <model-id> [<model-id> ...]
  /models compare <model-id1> <model-id2> [...]
  /models debate <model1,model2,...> "<prompt>"
  /models help

Examples:
  /models list                    # List all models
  /models list --provider openai  # List OpenAI models only
  /models list --local            # List locally available models
  /models show gpt-4o             # Show details for GPT-4o
  /models compare gpt-4o claude-3-5-sonnet  # Compare two models
  /models debate gpt-4o,claude-3-5-sonnet "Best way to handle errors in TypeScript"
`);
}

// ============================================================================
// Main Command Export
// ============================================================================

export async function handleModelsCommand(args: string[]): Promise<void> {
  const parsed = parseModelsArgs(args);
  const vault = getAIModelVault();

  try {
    switch (parsed.action) {
      case 'list':
        await handleListModels(vault, parsed.filters);
        break;
      case 'show':
        await handleShowModel(vault, parsed.modelIds || []);
        break;
      case 'compare':
        await handleCompareModels(vault, parsed.modelIds || []);
        break;
      case 'debate':
        await handleDebate(vault, parsed.modelIds || [], parsed.prompt);
        break;
      case 'help':
      default:
        showHelp();
        break;
    }
  } finally {
    // Clean up vault state
    resetAIModelVault();
  }
}

// Command definition for slash-commands-extended.ts
export const modelsCommand = {
  name: '/models',
  description: 'AI Model Database — list, show, compare, debate',
  usage: '/models <list|show|compare|debate> [args]',
  handler: handleModelsCommand,
};
