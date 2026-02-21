// Ralph Loop → Visual Workflow Adapter
// Bridges RalphLoop task execution into the visual workflow engine
// KIMI-R23-01 | Feb 2026

import type { PersistentWorkflow, VisualNode, VisualWorkflowEngineConfig } from './types.js';
import { RalphVisualWorkflowEngine } from './ralph-visual-engine.js';

export interface TaskDefinition {
  id: string;
  agentId: string;
  label: string;
  prompt: string;
  dependsOn?: string[];
  timeoutMs?: number;
  checkpoint?: boolean;
  position?: { x: number; y: number };
}

export interface AdapterConfig {
  engineConfig?: Partial<VisualWorkflowEngineConfig>;
  tasteVaultEnabled?: boolean;
}

export function buildWorkflowFromTasks(
  workflowId: string,
  name: string,
  tasks: TaskDefinition[],
): PersistentWorkflow {
  const nodes: VisualNode[] = tasks.map((task, idx) => ({
    id: task.id,
    label: task.label,
    type: 'agent',
    agentId: task.agentId,
    status: 'pending',
    position: task.position ?? { x: idx * 200, y: 0 },
    config: {
      channelBindings: { output: `${task.id}.output` },
      timeoutMs: task.timeoutMs ?? 30000,
      checkpointAfter: task.checkpoint ?? false,
    },
    inputChannels: (task.dependsOn ?? []).map(dep => `${dep}.output`),
    outputChannels: [`${task.id}.output`],
    metadata: { prompt: task.prompt },
  }));

  const edges = tasks.flatMap(task =>
    (task.dependsOn ?? []).map(dep => ({
      id: `edge-${dep}-${task.id}`,
      fromNodeId: dep,
      toNodeId: task.id,
      channel: `${dep}.output`,
    })),
  );

  return {
    id: workflowId,
    name,
    nodes,
    edges,
    initialChannelValues: {},
  };
}

export class RalphLoopVisualAdapter {
  private engine: RalphVisualWorkflowEngine;

  constructor(config: AdapterConfig = {}) {
    this.engine = new RalphVisualWorkflowEngine(config.engineConfig ?? {});
  }

  getEngine(): RalphVisualWorkflowEngine {
    return this.engine;
  }

  async runTasks(
    workflowId: string,
    name: string,
    tasks: TaskDefinition[],
    executeTask: (agentId: string, prompt: string) => Promise<string>,
  ) {
    const workflow = buildWorkflowFromTasks(workflowId, name, tasks);

    this.engine.setExecutor(async (node, _channels) => {
      const prompt = node.metadata['prompt'] as string ?? node.label;
      try {
        const output = await executeTask(node.agentId ?? 'EARTH', prompt);
        return { outputs: { output }, success: true };
      } catch (err) {
        return { outputs: {}, success: false, error: String(err) };
      }
    });

    const state = await this.engine.startVisualWorkflow(workflow);
    return this.engine.getResult(workflowId) ?? {
      workflowId,
      status: state.status,
      completedNodes: [],
      failedNodes: [],
      skippedNodes: [],
      durationMs: 0,
      checkpointCount: 0,
      tasteVaultScore: 1.0,
      outputChannelValues: {},
    };
  }

  listCheckpoints(workflowId: string) {
    return this.engine.listCheckpoints(workflowId);
  }

  async rewindAndRetry(
    workflowId: string,
    checkpointId: string,
    executeTask: (agentId: string, prompt: string) => Promise<string>,
  ) {
    this.engine.setExecutor(async (node, _channels) => {
      const prompt = node.metadata['prompt'] as string ?? node.label;
      try {
        const output = await executeTask(node.agentId ?? 'EARTH', prompt);
        return { outputs: { output }, success: true };
      } catch (err) {
        return { outputs: {}, success: false, error: String(err) };
      }
    });

    return this.engine.rewindTo(workflowId, { checkpointId });
  }
}
