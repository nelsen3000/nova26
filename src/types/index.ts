// Task status lifecycle: ready → in_progress → done | blocked
export type TaskStatus = "ready" | "in_progress" | "done" | "blocked" | "pending";

// Agent names must match .nova/agents/ filenames (without .md)
export type AgentName =
  | "SUN" | "MERCURY" | "VENUS" | "EARTH" | "MARS" | "PLUTO" | "SATURN"
  | "JUPITER" | "ENCELADUS" | "GANYMEDE" | "NEPTUNE" | "CHARON"
  | "URANUS" | "TITAN" | "EUROPA" | "MIMAS" | "IO" | "TRITON"
  | "CALLISTO" | "ATLAS" | "ANDROMEDA";

export interface Task {
  id: string;                    // e.g., "task-001"
  title: string;                 // Human-readable title
  description: string;           // What needs to be done
  agent: AgentName;              // Which agent handles this
  status: TaskStatus;
  dependencies: string[];        // Task IDs that must be "done" first
  phase: number;                // Phase number (0, 1, 2...)
  output?: string;              // File path of output (set after completion)
  attempts: number;             // Number of attempts (max 2: initial + 1 retry)
  blockedReason?: string;       // Why it's blocked (if status is "blocked")
  createdAt: string;           // ISO timestamp
  completedAt?: string;         // ISO timestamp
}

export interface PRD {
  projectName: string;
  version: string;
  phases: Phase[];
}

export interface Phase {
  id: number;
  name: string;
  tasks: Task[];
}

export interface AgentTemplate {
  name: AgentName;
  content: string;              // Raw markdown content of the agent file
  filePath: string;             // Path to the .md file
}

export interface LLMRequest {
  model: string;                // e.g., "qwen2.5:7b"
  systemPrompt: string;          // Agent template content
  userPrompt: string;           // Task description + context
  temperature?: number;         // Default 0.3 for code, 0.7 for creative
}

export interface LLMResponse {
  content: string;              // Raw response text
  model: string;                // Which model was used
  tokensUsed?: number;
  durationMs: number;
}

export interface GateResult {
  gateName: string;             // e.g., "typescript-check", "mercury-validator"
  passed: boolean;
  message: string;               // Details on pass/fail
  severity: "critical" | "warning" | "info";
}

export interface BuildLog {
  taskId: string;
  agent: AgentName;
  model: string;
  attempt: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  gateResults: GateResult[];
  success: boolean;
  outputPath?: string;
}

export interface Pattern {
  id: string;
  agent: AgentName;
  patternType: "success" | "failure" | "optimization";
  description: string;
  evidence: string[];
  confidence: number;
  createdAt: string;
  lastValidated: string;
}

export interface ModelConfig {
  precisionAgents: AgentName[];
  creativeAgents: AgentName[];
  defaultModel: string;
  temperature: {
    precision: number;
    creative: number;
  };
}
