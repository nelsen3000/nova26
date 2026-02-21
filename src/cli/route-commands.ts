// KMS-07: /route CLI command for Model Routing
// Route tasks, show routing table, hardware detection, model affinity

import {
  ModelRouter,
  ModelRegistry,
  HardwareDetector,
  type ModelRouteResult,
  type AgentModelMapping,
  type HardwareTier,
  type ModelProfile,
} from '../model-routing/index.js';

// ============================================================================
// Route Command Handler
// ============================================================================

interface RouteCommandArgs {
  action: 'task' | 'table' | 'hardware' | 'affinity' | 'help';
  agentId?: string;
  taskDescription?: string;
}

function parseRouteArgs(args: string[]): RouteCommandArgs {
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    return { action: 'help' };
  }

  const action = args[0] as RouteCommandArgs['action'];

  switch (action) {
    case 'task': {
      const agentId = args[1];
      const taskDescription = args.slice(2).join(' ').replace(/^"|"$/g, '');
      return { action: 'task', agentId, taskDescription };
    }

    case 'table':
      return { action: 'table' };

    case 'hardware':
      return { action: 'hardware' };

    case 'affinity':
      return { action: 'affinity' };

    default:
      return { action: 'help' };
  }
}

// ============================================================================
// Command Handlers
// ============================================================================

async function handleRouteTask(
  registry: ModelRegistry,
  agentId?: string,
  taskDescription?: string
): Promise<void> {
  if (!agentId) {
    console.log('❌ Please specify an agent ID. Usage: /route task <agent> "<description>"');
    return;
  }

  if (!taskDescription || taskDescription.trim().length === 0) {
    console.log('❌ Please provide a task description. Usage: /route task <agent> "<description>"');
    return;
  }

  const mapping = registry.getForAgent(agentId);
  if (!mapping) {
    console.log(`❌ No model mapping found for agent: ${agentId}`);
    console.log('   Run `/route table` to see available agents.');
    return;
  }

  const hardwareDetector = new HardwareDetector();
  const router = new ModelRouter(registry, hardwareDetector);

  // Use a default confidence of 0.8 for CLI routing
  const confidence = 0.8;

  try {
    const result = router.route(agentId, taskDescription, confidence);
    displayRouteResult(result);
  } catch (error) {
    console.log(`❌ Routing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function displayRouteResult(result: ModelRouteResult): void {
  console.log(`\n🎯 Task Routed Successfully\n`);
  console.log(`   Agent: ${result.agentId}`);
  console.log(`   Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  console.log();
  console.log(`   Selected Model: ${result.selectedModel.name}`);
  console.log(`   Family: ${result.selectedModel.family}`);
  console.log(`   Strength: ${result.selectedModel.strength}`);
  console.log(`   Quantization: ${result.selectedModel.quant}`);
  console.log(`   Context Window: ${result.selectedModel.contextWindow.toLocaleString()} tokens`);
  console.log();
  console.log(`   Performance Estimates:`);
  console.log(`   • Tokens/sec: ${result.estimatedTokensPerSec}`);
  console.log(`   • Cost Factor: ${result.estimatedCost.toFixed(2)}`);
  console.log(`   • Speculative Decoding: ${result.useSpeculativeDecoding ? '✅ Enabled' : '❌ Disabled'}`);

  if (result.fallbackChain.length > 0) {
    console.log();
    console.log(`   Fallback Chain:`);
    result.fallbackChain.forEach((model, index) => {
      console.log(`   ${index + 1}. ${model.name} (${model.strength})`);
    });
  }

  if (result.queuePosition !== undefined && result.queuePosition >= 0) {
    console.log();
    console.log(`   ⏳ Queued at position: ${result.queuePosition}`);
  }

  console.log();
}

async function handleRouteTable(registry: ModelRegistry): Promise<void> {
  const mappings = registry.getDefaultMappings();

  console.log(`\n📋 Model Routing Table (${mappings.length} agents)\n`);

  // Group by primary model family
  const byFamily = new Map<string, AgentModelMapping[]>();
  for (const mapping of mappings) {
    const family = mapping.primary.family;
    const list = byFamily.get(family) || [];
    list.push(mapping);
    byFamily.set(family, list);
  }

  for (const [family, familyMappings] of byFamily) {
    console.log(`  📦 ${family.toUpperCase()} Family:`);
    for (const mapping of familyMappings) {
      const fallbackCount = mapping.fallback.length;
      const indicator = getCapabilityIndicator(mapping.primary.strength);
      console.log(
        `     ${indicator} ${mapping.agentId.padEnd(20)} → ${mapping.primary.name.padEnd(25)} (${fallbackCount} fallbacks)`
      );
    }
    console.log();
  }
}

function getCapabilityIndicator(strength: string): string {
  const indicators: Record<string, string> = {
    'power': '🔥',
    'reasoning': '🧠',
    'coding': '💻',
    'balanced': '⚖️',
    'speed': '⚡',
    'efficiency': '🔋',
    'multilingual': '🌍',
    'moe': '🔀',
    'on-device': '📱',
  };
  return indicators[strength] || '🤖';
}

async function handleRouteHardware(): Promise<void> {
  const detector = new HardwareDetector();
  const hardware = detector.detect();

  console.log(`\n🔧 Hardware Detection Results\n`);
  console.log(`   Tier: ${hardware.id.toUpperCase()}`);
  console.log();

  if (hardware.gpuVendor) {
    console.log(`   GPU: ${hardware.gpuVendor}`);
    console.log(`   VRAM: ${hardware.vramGB} GB`);
  } else {
    console.log(`   GPU: ❌ Not detected (CPU-only mode)`);
    console.log(`   VRAM: N/A`);
  }

  console.log(`   RAM: ${hardware.ramGB} GB`);
  console.log(`   CPU Cores: ${hardware.cpuCores}`);
  console.log(`   Recommended Quantization: ${hardware.recommendedQuant}`);

  // Show hardware capability assessment
  console.log();
  console.log(`   Capability Assessment:`);
  displayHardwareCapabilities(hardware);

  console.log();
}

function displayHardwareCapabilities(hardware: HardwareTier): void {
  const models = getRecommendedModelsForHardware(hardware);

  if (models.length === 0) {
    console.log(`   ⚠️  Limited hardware - small models only (< 7B params)`);
    return;
  }

  console.log(`   ✅ Can run models up to ${getMaxModelSize(hardware)}B parameters`);
  console.log(`   ✅ Recommended models:`);
  for (const model of models.slice(0, 3)) {
    console.log(`      • ${model}`);
  }
}

function getMaxModelSize(hardware: HardwareTier): number {
  if (hardware.vramGB >= 48 || hardware.ramGB >= 64) return 405;
  if (hardware.vramGB >= 24 || hardware.ramGB >= 32) return 70;
  if (hardware.vramGB >= 16 || hardware.ramGB >= 24) return 32;
  if (hardware.vramGB >= 8 || hardware.ramGB >= 16) return 13;
  if (hardware.vramGB >= 4 || hardware.ramGB >= 8) return 7;
  return 3;
}

function getRecommendedModelsForHardware(hardware: HardwareTier): string[] {
  const size = getMaxModelSize(hardware);

  const recommendations: Record<number, string[]> = {
    405: ['llama-3.1-405b-Q4_K_M', 'mixtral-8x22b-Q4_K_M', 'qwen2.5-72b-Q4_K_M'],
    70: ['llama-3.1-70b-Q4_K_M', 'qwen2.5-72b-Q4_K_M', 'mistral-large-Q4_K_M'],
    32: ['qwen2.5-coder-32b-Q4_K_M', 'deepseek-coder-v2-Q4_K_M'],
    13: ['mixtral-8x22b-Q4_K_M (partial)', 'gemma-2-27b-Q4_K_M (with offloading)'],
    7: ['llama-3.1-8b-Q4_K_M', 'mistral-nemo-Q4_K_M', 'qwen2.5-7b-Q4_K_M'],
    3: ['phi-4-Q4_K_M', 'phi-3-medium-Q4_K_M'],
  };

  return recommendations[size] || [];
}

async function handleRouteAffinity(registry: ModelRegistry): Promise<void> {
  const mappings = registry.getDefaultMappings();
  const detector = new HardwareDetector();
  const hardware = detector.detect();

  console.log(`\n💕 Model Affinity Scores\n`);
  console.log(`   Hardware: ${hardware.id.toUpperCase()} | ${hardware.vramGB || hardware.ramGB}GB ${hardware.gpuVendor || 'CPU'}\n`);

  // Calculate affinity scores for each agent-model pair
  const affinities: Array<{
    agentId: string;
    model: ModelProfile;
    score: number;
    tier: 'optimal' | 'good' | 'fair' | 'poor';
  }> = [];

  for (const mapping of mappings) {
    const primaryScore = calculateAffinity(mapping.primary, hardware, mapping);
    affinities.push({
      agentId: mapping.agentId,
      model: mapping.primary,
      score: primaryScore,
      tier: getAffinityTier(primaryScore),
    });

    for (const fallback of mapping.fallback) {
      const fallbackScore = calculateAffinity(fallback, hardware, mapping);
      affinities.push({
        agentId: mapping.agentId,
        model: fallback,
        score: fallbackScore,
        tier: getAffinityTier(fallbackScore),
      });
    }
  }

  // Sort by score descending
  affinities.sort((a, b) => b.score - a.score);

  // Display top affinities by tier
  displayAffinityByTier(affinities, 'optimal', '🔥 Optimal Matches');
  displayAffinityByTier(affinities, 'good', '✅ Good Matches');
  displayAffinityByTier(affinities, 'fair', '⚡ Fair Matches');

  console.log();
  console.log(`   Scoring: speed × 0.4 + context × 0.3 + fit × 0.3 (normalized)`);
  console.log();
}

function calculateAffinity(
  model: ModelProfile,
  hardware: HardwareTier,
  mapping: AgentModelMapping
): number {
  // Speed score (0-100)
  const speedScore = Math.min(model.tokensPerSec / 2, 100);

  // Context window score (0-100)
  const contextScore = Math.min(model.contextWindow / 1280, 100);

  // Hardware fit score (0-100)
  const vramNeeded = estimateVRAM(model);
  const vramAvailable = hardware.vramGB || hardware.ramGB * 0.75;
  const fitScore = vramNeeded <= vramAvailable ? 100 : Math.max(0, 100 - (vramNeeded - vramAvailable) * 20);

  // Weighted average with taste vault weight influence
  const baseScore = speedScore * 0.4 + contextScore * 0.3 + fitScore * 0.3;
  const weightedScore = baseScore * (0.7 + mapping.tasteVaultWeight * 0.3);

  return Math.round(weightedScore);
}

function estimateVRAM(model: ModelProfile): number {
  const sizeMatch = model.name.match(/(\d+)b/i);
  const sizeInB = sizeMatch ? parseInt(sizeMatch[1], 10) : 7;

  const quantFactors: Record<string, number> = {
    'Q2_K': 0.3,
    'Q3_K': 0.4,
    'Q4_K_M': 0.5,
    'Q4_K_S': 0.45,
    'Q5_K_M': 0.6,
    'Q5_K_S': 0.55,
    'Q6_K': 0.7,
    'Q8_0': 0.75,
    'FP16': 2.0,
  };

  const factor = quantFactors[model.quant] ?? 0.5;
  return sizeInB * factor;
}

function getAffinityTier(score: number): 'optimal' | 'good' | 'fair' | 'poor' {
  if (score >= 85) return 'optimal';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

function displayAffinityByTier(
  affinities: Array<{
    agentId: string;
    model: ModelProfile;
    score: number;
    tier: 'optimal' | 'good' | 'fair' | 'poor';
  }>,
  tier: 'optimal' | 'good' | 'fair' | 'poor',
  title: string
): void {
  const tierAffinities = affinities.filter((a) => a.tier === tier);
  if (tierAffinities.length === 0) return;

  console.log(`   ${title}:`);
  for (const affinity of tierAffinities.slice(0, 5)) {
    const bars = '█'.repeat(Math.round(affinity.score / 10)) + '░'.repeat(10 - Math.round(affinity.score / 10));
    console.log(`      ${bars} ${affinity.score.toString().padStart(3)}% ${affinity.agentId} → ${affinity.model.name}`);
  }
  console.log();
}

function showHelp(): void {
  console.log(`
🎯 /route — Model Routing Commands

Usage:
  /route task <agent> "<description>"  # Route a task to the best model
  /route table                          # Show agent-model routing table
  /route hardware                       # Show hardware detection results
  /route affinity                       # Show model affinity scores
  /route help

Examples:
  /route task code-sage "Refactor authentication module"
  /route task architect-alpha "Design new API endpoint"
  /route table
  /route hardware
  /route affinity

Agents:
  Core: architect-alpha, code-sage, debug-oracle, doc-weaver,
        test-master, review-critic, security-guard
  Specialized: ui-artisan, api-gatekeeper, data-alchemist, perf-sage,
               refactor-ninja, dep-analyzer, migration-wizard
  Support: context-manager, prompt-engineer, knowledge-curator,
           quality-assurer, collab-facilitator, scheduler-optimizer,
           telemetry-analyst
`);
}

// ============================================================================
// Main Command Export
// ============================================================================

export async function handleRouteCommand(args: string[]): Promise<void> {
  const parsed = parseRouteArgs(args);
  const registry = new ModelRegistry();

  try {
    switch (parsed.action) {
      case 'task':
        await handleRouteTask(registry, parsed.agentId, parsed.taskDescription);
        break;
      case 'table':
        await handleRouteTable(registry);
        break;
      case 'hardware':
        await handleRouteHardware();
        break;
      case 'affinity':
        await handleRouteAffinity(registry);
        break;
      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Command definition for slash-commands-extended.ts
export const routeCommand = {
  name: '/route',
  description: 'Model Routing — task routing, table, hardware, affinity',
  usage: '/route <task|table|hardware|affinity> [args]',
  handler: handleRouteCommand,
};
