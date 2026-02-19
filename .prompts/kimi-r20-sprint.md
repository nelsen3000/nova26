# Kimi Sprint: R20 Feature Implementation
## 2 Tasks | 199+ Tests | TypeScript Strict | ESM `.js` Imports

> **Pre-requisite**: R19 Sprint (KIMI-R19-01→R19-03) should ideally be complete first,
> but these can be started independently if needed.
> **Repo**: https://github.com/nelsen3000/nova26
> **Branch**: `main` (or feature branch if preferred)
> **Rules**: TypeScript strict, ESM `.js` imports, vitest, no `any`, mock all I/O, no real API calls

---

## Task 1: KIMI-R20-01 — Orchestrator-Worker L0/L1/L2/L3 Hierarchy

**Spec**: `.nova/specs/grok-r20-01-orchestrator-hierarchy.md`
**Tests**: 112 vitest cases minimum

### What to Build

Extend `src/orchestrator/` with a layered hierarchy:

```
src/orchestrator/
├── ralph-loop.ts             ← upgrade to layer dispatcher (backward compat: hierarchyLevel: "flat" → L2 only)
├── layers/
│   ├── l0-intent.ts          ← parse user intent, clarification loop, confidence scoring
│   ├── l1-planning.ts        ← task decomposition, dependency graph, parallel group detection
│   ├── l2-execution.ts       ← agent task execution, retry with new prompt, parallel workers
│   └── l3-tool.ts            ← sandboxed tool execution, backoff retry
├── escalation.ts             ← layer-to-layer escalation, human-required detection
├── hierarchy-config.ts       ← configuration + validation + defaults
├── types.ts                  ← UserIntent, TaskGraph, ExecutionArtifact, ToolRequest, EscalationEvent, etc.
├── __tests__/
│   ├── l0-intent.test.ts
│   ├── l1-planning.test.ts
│   ├── l2-execution.test.ts
│   ├── l3-tool.test.ts
│   ├── escalation.test.ts
│   ├── hierarchy-config.test.ts
│   └── integration.test.ts
└── lifecycle-wiring.ts       ← add hooks for layer boundaries (if not already built in W-02)
```

### Key Interfaces (from spec)

```typescript
// types.ts
export interface OrchestratorHierarchyConfig {
  enabled: boolean;
  layers: LayerConfig[];
  escalationPolicy: 'auto' | 'manual' | 'threshold-based';
  defaultMaxRetries: number;
  globalTimeoutMs: number;
  backwardCompatibilityMode: boolean; // true = flat mode, everything routes to L2
  observabilityLevel: 'minimal' | 'standard' | 'verbose';
}

export interface LayerConfig {
  level: 0 | 1 | 2 | 3;
  supervisorAgent: string;
  workers: string[];
  maxConcurrency: number;
  timeoutMs: number;
  maxRetries: number;
}

export interface UserIntent {
  id: string;
  rawInput: string;
  parsedType: string;
  scope: string;
  constraints: string[];
  tasteVaultTags: string[];
  confidence: number; // 0-1
  needsClarification: boolean;
}

export interface TaskGraph {
  nodes: TaskNode[];
  parallelGroups: string[][];
}

export interface TaskNode {
  id: string;
  agent: string;
  dependencies: string[];
  estimatedTokens: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface ExecutionArtifact {
  type: 'code' | 'spec' | 'design' | 'test' | 'asset';
  content: string;
  metadata: Record<string, unknown>;
}

export interface ToolRequest {
  toolName: string;
  parameters: Record<string, unknown>;
  sandboxed: boolean;
}

export interface EscalationEvent {
  layer: 0 | 1 | 2 | 3;
  taskId: string;
  error: string;
  retryCount: number;
  suggestedNextLayer: number;
  requiresHuman: boolean;
}
```

### Layer Responsibilities
- **L0 (SUN)**: Parse intent, confirm with user, clarification loop
- **L1 (SUN + JUPITER + MERCURY)**: Decompose tasks, validate architecture, re-plan on failure
- **L2 (assigned agent)**: Execute task, retry with new prompt, run parallel workers
- **L3 (sandbox)**: Execute tool calls, backoff retry

### RalphLoopOptions Addition

```typescript
orchestratorHierarchy?: OrchestratorHierarchyConfig;
```

### Backward Compatibility
**CRITICAL**: `backwardCompatibilityMode: true` (default) routes everything directly to L2, which is identical to current behavior. Zero breaking changes. The hierarchy is opt-in.

### Integration Points
- ralph-loop.ts becomes the layer dispatcher
- Each layer calls the next via a standard `dispatch(layerLevel, payload)` pattern
- Escalation events flow upward (L3 → L2 → L1 → L0 → human)
- lifecycle-wiring.ts gets hooks for layer entry/exit if not already present
- ATLAS logs all layer transitions for observability

### Test Requirements (112 minimum)
- l0-intent: intent parsing (8), clarification loop (5), confidence scoring (4), edge cases (3) — empty input, ambiguous, multi-intent
- l1-planning: task decomposition (8), dependency graph (6), parallel detection (5), re-planning (4) — circular deps, single task, 50+ nodes
- l2-execution: agent dispatch (6), retry with new prompt (4), parallel workers (5), artifact collection (4) — agent timeout, all fail, partial success
- l3-tool: tool execution (5), sandbox enforcement (4), backoff retry (4) — unknown tool, permission denied, timeout
- escalation: upward flow (5), human-required detection (3), policy modes (3) — max retries exceeded, cascade failure
- hierarchy-config: validation (4), defaults (3), backward compat (4) — missing layers, invalid level, flat mode routing
- integration: full L0→L3 flow (5), escalation round-trip (3), backward compat end-to-end (3), parallel execution (3)

---

## Task 2: KIMI-R20-02 — Tauri Native Desktop Application

**Spec**: `.nova/specs/grok-r20-02-tauri-desktop.md`
**Tests**: 87 vitest + cargo test cases minimum

### What to Build

Create `src-tauri/` (Rust backend) and `src/desktop/` (TypeScript bridge):

```
src-tauri/
├── src/
│   ├── main.rs               ← Tauri app entry point + window config
│   ├── commands.rs            ← invoke commands: read_project_file, git_commit, spawn_ollama, watch_project
│   ├── ollama_manager.rs      ← auto-start/stop Ollama, port watching, health checks
│   └── electric_sync.rs       ← offline queue, conflict resolution, sync flush
├── tauri.conf.json            ← window config, security allowlist, deep links, auto-update
├── Cargo.toml                 ← dependencies: tauri, serde, tokio, libgit2, notify
├── capabilities/
│   └── default.json           ← allowlist definitions (fs scope, shell restrictions)
└── icons/                     ← app icons (can be placeholder PNGs)

src/desktop/
├── index.ts                   ← public exports
├── types.ts                   ← TauriAppConfig, WindowConfig, NativeBridge, OfflineCapabilityConfig, SecurityModel
├── native-bridge.ts           ← TypeScript invoke() wrapper for Rust commands
├── ollama-bridge.ts           ← TypeScript interface to OllamaManager Rust commands
├── offline-queue.ts           ← offline action queue + sync engine interface
├── security-model.ts          ← CSP generation, allowlist validation, fs scope checking
└── __tests__/
    ├── native-bridge.test.ts
    ├── ollama-bridge.test.ts
    ├── offline-queue.test.ts
    └── security-model.test.ts
```

### Key TypeScript Interfaces (from spec)

```typescript
// src/desktop/types.ts
export interface TauriAppConfig {
  window: WindowConfig;
  autoUpdate: boolean;
  deepLinks: string[];
  menuBar: boolean;
  security: SecurityModel;
  offline: OfflineCapabilityConfig;
}

export interface WindowConfig {
  title: string;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  alwaysOnTop: boolean;
  transparent: boolean;
  systemTray: boolean;
}

export interface NativeBridge {
  invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  listen: (event: string, handler: (payload: unknown) => void) => () => void;
  fileSystem: {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    watchDir: (path: string, handler: (event: FileChangeEvent) => void) => () => void;
  };
  git: {
    commit: (message: string, files: string[]) => Promise<string>;
    status: () => Promise<GitStatus>;
  };
  notifications: {
    send: (title: string, body: string) => Promise<void>;
  };
}

export interface OfflineCapabilityConfig {
  ollamaAutoStart: boolean;
  queuePath: string;
  syncEngine: 'electric-sql' | 'custom';
  conflictStrategy: 'last-write-wins' | 'merge' | 'manual';
}

export interface SecurityModel {
  allowlist: string[];
  fsScope: string[];
  csp: string;
  noShell: boolean;
}

export interface FileChangeEvent {
  path: string;
  type: 'create' | 'modify' | 'delete';
  timestamp: number;
}

export interface GitStatus {
  modified: string[];
  staged: string[];
  untracked: string[];
  branch: string;
}
```

### Rust Backend (src-tauri/)

**NOTE**: Write the Rust files as clean, compilable stubs. The actual Tauri runtime won't be available in the test environment, so focus on:
- Correct Rust syntax and types
- `#[tauri::command]` annotations on all command functions
- Proper `serde` derive macros
- Correct Cargo.toml dependencies

```rust
// commands.rs — key commands
#[tauri::command]
fn read_project_file(path: String) -> Result<String, String> { ... }

#[tauri::command]
fn git_commit(message: String, files: Vec<String>) -> Result<String, String> { ... }

#[tauri::command]
fn spawn_ollama() -> Result<(), String> { ... }

#[tauri::command]
fn watch_project(path: String) -> Result<(), String> { ... }
```

### RalphLoopOptions Addition

```typescript
desktop?: {
  enabled: boolean;
  config: TauriAppConfig;
};
```

### Distribution Targets
- macOS: .dmg + notarization + Sparkle auto-update
- Windows: .msi + NSIS + WinSparkle
- Linux: .AppImage + .deb + Snap
- CI: GitHub Actions matrix build (define in `.github/workflows/desktop-build.yml` stub)

### Integration Points
- CLI commands → Tauri invoke commands (native-bridge.ts)
- Next.js dashboard → embedded webview with HMR
- Ollama → auto-started by Rust OllamaManager
- Ralph Loop → can run as background Rust thread
- TRITON agent → new desktop distribution target

### Test Requirements (87 minimum)

**TypeScript tests (vitest)**:
- native-bridge: invoke wrapper (6), listen/unlisten (4), fileSystem operations (6), git operations (4) — invoke error, timeout, unknown command
- ollama-bridge: auto-start (4), health check (4), port detection (3), stop (3) — already running, port conflict, not installed
- offline-queue: enqueue (4), flush (4), conflict resolution (5), persistence (3) — empty queue, corrupt file, sync failure
- security-model: CSP generation (4), allowlist validation (4), fs scope check (5), noShell enforcement (3) — wildcard scope, empty allowlist

**Rust stubs** (cargo test — can be basic assertion tests):
- commands: read_project_file (3), git_commit (3), spawn_ollama (2), watch_project (2)
- ollama_manager: start/stop lifecycle (3), port detection (2)
- electric_sync: queue operations (3), conflict resolution (2)

---

## Completion Checklist

After both tasks:

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → all TypeScript tests pass (199+ new tests)
3. `cargo check` in `src-tauri/` → 0 errors (if Rust toolchain available; skip if not)
4. All new imports use `.js` ESM extensions
5. No `any` types anywhere
6. All I/O mocked (no real Tauri runtime, no real Ollama, no real file system, no real git)
7. ralph-loop.ts has 2 new config fields: `orchestratorHierarchy`, `desktop`
8. Backward compatibility verified: `backwardCompatibilityMode: true` produces identical behavior to current ralph-loop

Report output to Jon when complete.
