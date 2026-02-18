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
  // TodoWrite pattern support
  todos?: TodoItem[];
  currentTodoId?: string;
  // Context for agent reasoning
  context?: Record<string, unknown>;
}

export interface TodoItem {
  id: string;
  content: string;        // Imperative form: "Fix authentication bug"
  activeForm: string;     // Continuous form: "Fixing authentication bug"
  status: 'pending' | 'in_progress' | 'completed';
  agent: string;
  createdAt: string;
  completedAt?: string;
  verificationCriteria?: string[];
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

/** Function signature for LLM callers (real or mock) */
export type LLMCaller = (
  systemPrompt: string,
  userPrompt: string,
  agentName?: string
) => Promise<LLMResponse>;

export interface GateConfig {
  name: string;
  type: 'response-validation' | 'mercury-validator' | 'typescript-check' | 'test-runner';
  enabled: boolean;
  config: Record<string, unknown>;
}

// Hard limits configuration (from leaked prompt analysis)
export interface HardLimit {
  name: string;
  pattern?: string;
  check?: string;
  severity: 'SEVERE' | 'WARNING';
  message: string;
}

export interface HardLimitsConfig {
  agents: Record<string, {
    limits: HardLimit[];
  }>;
}

// Planning Mode types
export interface PlanningPhase {
  name: 'UNDERSTAND' | 'CLARIFY' | 'PLAN' | 'APPROVE' | 'EXECUTE' | 'VERIFY' | 'DELIVER';
  actions: string[];
  exitCriteria: string;
}

export interface Checkpoint {
  milestone: string;
  confirmationRequired: boolean;
  validationCriteria: string[];
}
