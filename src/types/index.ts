// Core type definitions for NOVA26 orchestrator

export interface Task {
  id: string;
  title: string;
  description: string;
  agent: string;
  status: 'pending' | 'ready' | 'running' | 'done' | 'failed' | 'blocked';
  dependencies: string[];
  phase: number;
  attempts: number;
  createdAt: string;
  output?: string;
  error?: string;
}

export interface PRD {
  meta: {
    name: string;
    version: string;
    createdAt: string;
  };
  tasks: Task[];
}

export interface Pattern {
  id: string;
  name: string;
  description: string;
  code: string;
  language: string;
  tags: string[];
  createdAt: string;
}

export interface BuildLog {
  id: string;
  taskId: string;
  agent: string;
  model: string;
  prompt: string;
  response: string;
  gatesPassed: boolean;
  duration: number;
  timestamp: string;
  error?: string;
}

export interface ModelConfig {
  name: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
}

export interface AgentConfig {
  name: string;
  role: string;
  domain: string;
  systemPrompt: string;
  model: string;
  gates: string[];
}

export interface GateResult {
  gate: string;
  passed: boolean;
  message: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  duration: number;
  tokens: number;
}

export interface GateConfig {
  name: string;
  type: 'response-validation' | 'mercury-validator' | 'typescript-check' | 'test-runner';
  enabled: boolean;
  config: Record<string, unknown>;
}
