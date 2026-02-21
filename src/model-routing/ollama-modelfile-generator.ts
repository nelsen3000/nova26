// Ollama Modelfile Generator — Auto-generates Modelfiles per hardware tier
// KIMI-R22-01 | Feb 2026

import type { HardwareTier, OllamaModelfile } from './types.js';
import type { AgentModelMapping } from './types.js';

interface ModelfileParams {
  numCtx: number;
  numGpuLayers: number;
  numThread: number;
  flashAttn: boolean;
  f16Kv: boolean;
  temperature: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  numPredict: number;
  mirostat: 0 | 1 | 2;
}

function tierToParams(tier: HardwareTier): ModelfileParams {
  switch (tier.id) {
    case 'ultra':
      return { numCtx: 131072, numGpuLayers: 99, numThread: 8, flashAttn: true, f16Kv: true,
        temperature: 0.7, topP: 0.9, topK: 40, repeatPenalty: 1.1, numPredict: 2048, mirostat: 0 };
    case 'high':
      return { numCtx: 65536, numGpuLayers: 50, numThread: 8, flashAttn: true, f16Kv: true,
        temperature: 0.7, topP: 0.9, topK: 40, repeatPenalty: 1.1, numPredict: 1024, mirostat: 0 };
    case 'apple-silicon':
      return { numCtx: 32768, numGpuLayers: 99, numThread: tier.cpuCores, flashAttn: true, f16Kv: false,
        temperature: 0.7, topP: 0.9, topK: 40, repeatPenalty: 1.1, numPredict: 1024, mirostat: 2 };
    case 'mid':
      return { numCtx: 16384, numGpuLayers: 35, numThread: 8, flashAttn: false, f16Kv: false,
        temperature: 0.7, topP: 0.9, topK: 40, repeatPenalty: 1.1, numPredict: 512, mirostat: 1 };
    case 'low':
    default:
      return { numCtx: 8192, numGpuLayers: 0, numThread: Math.max(tier.cpuCores - 2, 2),
        flashAttn: false, f16Kv: false, temperature: 0.7, topP: 0.9, topK: 40,
        repeatPenalty: 1.1, numPredict: 256, mirostat: 1 };
  }
}

function buildModelfileContent(
  ollamaTag: string,
  params: ModelfileParams,
  agentSystem: string,
): string {
  const lines: string[] = [
    `FROM ${ollamaTag}`,
    '',
    '# Nova26 Auto-Generated Modelfile',
    `# Generated: ${new Date().toISOString()}`,
    '',
    `PARAMETER num_ctx ${params.numCtx}`,
    `PARAMETER num_gpu ${params.numGpuLayers}`,
    `PARAMETER num_thread ${params.numThread}`,
    `PARAMETER temperature ${params.temperature}`,
    `PARAMETER top_p ${params.topP}`,
    `PARAMETER top_k ${params.topK}`,
    `PARAMETER repeat_penalty ${params.repeatPenalty}`,
    `PARAMETER num_predict ${params.numPredict}`,
    `PARAMETER mirostat ${params.mirostat}`,
  ];

  if (params.flashAttn) lines.push('PARAMETER flash_attn true');
  if (params.f16Kv) lines.push('PARAMETER f16_kv true');

  lines.push('');
  lines.push('SYSTEM """');
  lines.push(agentSystem);
  lines.push('"""');

  return lines.join('\n');
}

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  MARS: 'You are MARS, a DevOps and deployment specialist. Generate production-ready infrastructure code. Prefer Kubernetes, Terraform, and Docker best practices. Always include health checks and rollback strategies.',
  VENUS: 'You are VENUS, a UI/UX design agent. Generate production-quality React components with Tailwind CSS and shadcn/ui. Follow WCAG 2.2 accessibility guidelines. Include dark mode support.',
  MERCURY: 'You are MERCURY, a code review specialist. Identify bugs, security vulnerabilities, and performance issues. Provide specific line-level feedback with fix examples.',
  SUN: 'You are SUN, a product requirements specialist. Generate comprehensive PRDs with user stories, acceptance criteria, and success metrics. Be specific and measurable.',
  JUPITER: 'You are JUPITER, a software architect. Design scalable, maintainable systems. Consider failure modes, data consistency, and future extensibility.',
  PLUTO: 'You are PLUTO, a security specialist. Treat all inputs as potentially malicious. Apply zero-trust principles. Reference OWASP, SOC 2, and GDPR where relevant.',
  NEPTUNE: 'You are NEPTUNE, a data pipeline specialist. Design reliable, scalable ETL pipelines. Include error handling, retries, and dead-letter queues.',
  IO: 'You are IO, a real-time processing specialist. Optimize for sub-200ms latency. Use streaming and WebSockets. Consider backpressure and graceful degradation.',
  GANYMEDE: 'You are GANYMEDE, a testing specialist. Write comprehensive tests that catch edge cases. Include unit, integration, and E2E test strategies.',
  CHARON: 'You are CHARON, a debugging specialist. Systematically identify root causes. Provide step-by-step debugging guides and prevention strategies.',
  EARTH: 'You are EARTH, the orchestrator. Coordinate agent tasks efficiently. Break complex goals into actionable sub-tasks. Monitor progress and handle failures.',
  ATLAS: 'You are ATLAS, the memory and learning agent. Extract patterns from completed work. Build institutional knowledge that improves future agent performance.',
  DEFAULT: 'You are a Nova26 AI agent. Complete tasks accurately, efficiently, and with production-quality output.',
};

export function generateModelfile(
  mapping: AgentModelMapping,
  tier: HardwareTier,
): OllamaModelfile {
  const params = tierToParams(tier);
  const systemPrompt = AGENT_SYSTEM_PROMPTS[mapping.agentId] ?? AGENT_SYSTEM_PROMPTS['DEFAULT']!;
  const content = buildModelfileContent(mapping.primary.ollamaTag, params, systemPrompt);

  return {
    agentId: mapping.agentId,
    hardwareTier: tier.id,
    modelName: `nova26-${mapping.agentId.toLowerCase()}-${tier.id}`,
    content,
  };
}

export function generateAllModelfiles(
  mappings: AgentModelMapping[],
  tier: HardwareTier,
): OllamaModelfile[] {
  return mappings.map(m => generateModelfile(m, tier));
}

export function generateOllamaInstallScript(modelfiles: OllamaModelfile[]): string {
  const lines = [
    '#!/bin/bash',
    '# Nova26 Ollama Setup Script — Auto-generated',
    `# Generated: ${new Date().toISOString()}`,
    '',
    'set -e',
    '',
    '# Check Ollama is installed',
    'if ! command -v ollama &> /dev/null; then',
    '  echo "Installing Ollama..."',
    '  curl -fsSL https://ollama.ai/install.sh | sh',
    'fi',
    '',
  ];

  for (const mf of modelfiles) {
    lines.push(`# ${mf.agentId} — ${mf.hardwareTier}`);
    lines.push(`cat > /tmp/Modelfile.${mf.agentId} << 'MODELFILE_EOF'`);
    lines.push(mf.content);
    lines.push('MODELFILE_EOF');
    lines.push(`ollama create ${mf.modelName} -f /tmp/Modelfile.${mf.agentId}`);
    lines.push(`echo "Created ${mf.modelName}"`);
    lines.push('');
  }

  lines.push('echo "All Nova26 models installed successfully!"');
  return lines.join('\n');
}
