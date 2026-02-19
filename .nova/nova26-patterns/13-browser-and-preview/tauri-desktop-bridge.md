# Tauri Native Desktop Bridge

> Source: `src-tauri/src/main.rs`, `src-tauri/src/commands.rs`, `src-tauri/src/ollama_manager.rs`, `src-tauri/src/electric_sync.rs`, `src-tauri/tauri.conf.json`

## Description

The Tauri Native Desktop Bridge wraps the Nova26 web application in a native desktop shell using Tauri v2, enabling bidirectional TypeScript-Rust communication via `invoke` (TS calls Rust) and `listen` (Rust emits events to TS). The Rust backend manages local Ollama model lifecycle (auto-start, port watching, graceful shutdown), offline-first data sync via ElectricSync with conflict resolution, file system access with scoped permissions, and Git operations via libgit2. The security model enforces an explicit command allowlist, file system scope restrictions, strict CSP, and a no-shell policy. Distribution targets macOS (.dmg with notarization), Windows (.msi with NSIS), and Linux (.AppImage, .deb, Snap) via a GitHub Actions CI matrix.

---

## Code Examples

### TypeScript: NativeBridge Interface

```typescript
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface NativeBridge {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  listen<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn>;
  fileSystem: FileSystemBridge;
  git: GitBridge;
  notifications: NotificationBridge;
}

export interface FileSystemBridge {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  watchProject(path: string): Promise<UnlistenFn>;
}

export interface GitBridge {
  commit(message: string, files: string[]): Promise<string>;
  status(): Promise<GitStatus>;
  diff(ref?: string): Promise<string>;
}

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

export interface SecurityModel {
  allowlist: string[];    // Explicit list of allowed Rust commands
  fsScope: string[];      // Allowed file system paths (glob patterns)
  csp: string;            // Content Security Policy string
  noShell: true;          // Never spawn shell processes from frontend
}

export interface OfflineCapabilityConfig {
  ollamaAutoStart: boolean;
  queuePath: string;
  syncEngine: 'electric-sql' | 'custom';
  conflictStrategy: 'last-write-wins' | 'merge' | 'manual';
}
```

### TypeScript: Calling Rust Commands

```typescript
// Read a project file through the scoped file system bridge
export async function readProjectFile(path: string): Promise<string> {
  return invoke<string>('read_project_file', { path });
}

// Commit via libgit2 (no shell, no git CLI)
export async function gitCommit(
  message: string,
  files: string[]
): Promise<string> {
  return invoke<string>('git_commit', { message, files });
}

// Start Ollama for local model inference
export async function startOllama(): Promise<void> {
  return invoke<void>('spawn_ollama');
}

// Watch project directory for file changes
export async function watchProject(
  path: string,
  onChange: (event: FileChangeEvent) => void
): Promise<UnlistenFn> {
  return listen<FileChangeEvent>('project-file-changed', (event) => {
    onChange(event.payload);
  });
}

interface FileChangeEvent {
  path: string;
  kind: 'create' | 'modify' | 'delete';
  timestamp: number;
}
```

### Rust: Tauri Commands

```rust
use tauri::command;
use std::fs;
use std::path::PathBuf;

#[command]
pub fn read_project_file(path: String) -> Result<String, String> {
    // Path is validated against fs scope by Tauri's security layer
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read {}: {}", path, e))?;
    Ok(content)
}

#[command]
pub fn git_commit(message: String, files: Vec<String>) -> Result<String, String> {
    // Uses libgit2 — no shell spawning
    let repo = git2::Repository::open(".")
        .map_err(|e| format!("Failed to open repo: {}", e))?;

    let mut index = repo.index()
        .map_err(|e| format!("Failed to get index: {}", e))?;

    for file in &files {
        index.add_path(&PathBuf::from(file))
            .map_err(|e| format!("Failed to stage {}: {}", file, e))?;
    }
    index.write()
        .map_err(|e| format!("Failed to write index: {}", e))?;

    let oid = index.write_tree()
        .map_err(|e| format!("Failed to write tree: {}", e))?;
    let tree = repo.find_tree(oid)
        .map_err(|e| format!("Failed to find tree: {}", e))?;

    let sig = repo.signature()
        .map_err(|e| format!("Failed to get signature: {}", e))?;
    let parent = repo.head()
        .and_then(|h| h.peel_to_commit())
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;

    let commit_oid = repo.commit(
        Some("HEAD"), &sig, &sig, &message, &tree, &[&parent]
    ).map_err(|e| format!("Failed to commit: {}", e))?;

    Ok(commit_oid.to_string())
}
```

### Rust: OllamaManager

```rust
use std::process::{Command, Child};
use std::sync::Mutex;
use std::net::TcpStream;

pub struct OllamaManager {
    process: Mutex<Option<Child>>,
    port: u16,
}

impl OllamaManager {
    pub fn new(port: u16) -> Self {
        Self {
            process: Mutex::new(None),
            port,
        }
    }

    pub fn start(&self) -> Result<(), String> {
        // Check if already running
        if self.is_running() {
            return Ok(());
        }

        let child = Command::new("ollama")
            .arg("serve")
            .env("OLLAMA_HOST", format!("0.0.0.0:{}", self.port))
            .spawn()
            .map_err(|e| format!("Failed to start Ollama: {}", e))?;

        *self.process.lock().unwrap() = Some(child);

        // Wait for port to become available
        self.wait_for_ready(30)?;
        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        if let Some(mut child) = self.process.lock().unwrap().take() {
            child.kill().map_err(|e| format!("Failed to stop Ollama: {}", e))?;
        }
        Ok(())
    }

    pub fn is_running(&self) -> bool {
        TcpStream::connect(format!("127.0.0.1:{}", self.port)).is_ok()
    }

    fn wait_for_ready(&self, timeout_secs: u32) -> Result<(), String> {
        for _ in 0..timeout_secs {
            if self.is_running() {
                return Ok(());
            }
            std::thread::sleep(std::time::Duration::from_secs(1));
        }
        Err(format!("Ollama did not start within {} seconds", timeout_secs))
    }
}
```

### Rust: ElectricSync for Offline-First

```rust
pub struct ElectricSync {
    queue_path: String,
    conflict_strategy: ConflictStrategy,
}

pub enum ConflictStrategy {
    LastWriteWins,
    Merge,
    Manual,
}

impl ElectricSync {
    pub fn new(queue_path: String, strategy: ConflictStrategy) -> Self {
        Self {
            queue_path,
            conflict_strategy: strategy,
        }
    }

    pub fn queue_mutation(&self, mutation: OfflineMutation) -> Result<(), String> {
        // Append mutation to local queue file
        // Queue is flushed when connectivity is restored
        let serialized = serde_json::to_string(&mutation)
            .map_err(|e| format!("Serialization error: {}", e))?;
        std::fs::OpenOptions::new()
            .append(true)
            .create(true)
            .open(&self.queue_path)
            .and_then(|mut f| {
                use std::io::Write;
                writeln!(f, "{}", serialized)
            })
            .map_err(|e| format!("Queue write error: {}", e))?;
        Ok(())
    }

    pub fn flush_queue(&self) -> Result<Vec<SyncResult>, String> {
        // Read all queued mutations, apply conflict resolution, sync to server
        // Returns per-mutation results
        todo!("Implement flush with conflict resolution")
    }

    fn resolve_conflict(
        &self,
        local: &OfflineMutation,
        remote: &OfflineMutation,
    ) -> OfflineMutation {
        match self.conflict_strategy {
            ConflictStrategy::LastWriteWins => {
                if local.timestamp > remote.timestamp { local.clone() }
                else { remote.clone() }
            }
            ConflictStrategy::Merge => {
                // Deep merge fields from both mutations
                todo!("Implement deep merge")
            }
            ConflictStrategy::Manual => {
                // Queue for user resolution
                todo!("Implement manual conflict resolution UI")
            }
        }
    }
}
```

### Security Configuration (tauri.conf.json excerpt)

```json
{
  "security": {
    "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
    "dangerousDisableAssetCspModification": false
  },
  "app": {
    "withGlobalTauri": false,
    "security": {
      "capabilities": [
        {
          "identifier": "nova26-main",
          "windows": ["main"],
          "permissions": [
            "core:default",
            "read_project_file",
            "git_commit",
            "spawn_ollama",
            "watch_project"
          ]
        }
      ]
    }
  }
}
```

### Key Concepts

- **Bidirectional TS-Rust bridge**: `invoke()` calls Rust commands from TypeScript; `listen()` receives Rust-emitted events in TypeScript
- **OllamaManager lifecycle**: Auto-start on app launch, port watching for readiness, graceful shutdown on app close
- **Offline-first architecture**: ElectricSync queues mutations locally when offline, flushes with conflict resolution when connectivity returns
- **No-shell security**: All system operations (Git, file I/O, Ollama) use native libraries (libgit2, std::fs, std::process) -- never shell invocation from the frontend
- **Scoped file system**: Tauri's fs scope restricts which directories the frontend can read/write, preventing unauthorized access
- **Capability-based allowlist**: Each window gets an explicit list of allowed Rust commands; unlisted commands are blocked

---

## Anti-Patterns

### Don't Do This

```typescript
// Calling shell commands from the frontend — security violation
import { Command } from '@tauri-apps/plugin-shell';
const output = await Command.create('git', ['commit', '-m', 'msg']).execute();
// Exposes shell to frontend, bypasses allowlist

// Unrestricted file system access
import { readTextFile } from '@tauri-apps/plugin-fs';
const secrets = await readTextFile('/etc/passwd'); // No scope restriction

// Ignoring offline state — mutations silently fail
await convexClient.mutation('tasks:create', { ... }); // Fails with no internet, no retry
```

### Do This Instead

```typescript
// Use invoke with allowlisted commands — no shell access
const commitId = await invoke<string>('git_commit', {
  message: 'feat: add button',
  files: ['src/Button.tsx'],
});

// File access through scoped bridge
const content = await invoke<string>('read_project_file', {
  path: 'src/App.tsx', // Validated against fs scope
});

// Offline-first with queue and sync
if (navigator.onLine) {
  await convexClient.mutation('tasks:create', { ... });
} else {
  await invoke('queue_offline_mutation', {
    mutation: { path: 'tasks:create', args: { ... }, timestamp: Date.now() },
  });
}
```

---

## When to Use

**Use for:**
- Wrapping the Nova26 web dashboard as a native desktop application with system-level capabilities
- Managing local Ollama model lifecycle without requiring users to run terminal commands
- Offline-capable workflows where agents can continue working without internet, syncing later
- Multi-platform distribution (macOS, Windows, Linux) from a single codebase

**Don't use for:**
- Web-only deployments where no native desktop features are needed
- Mobile targets (use the Mobile Launch Pipeline instead)
- Server-side orchestration (Tauri runs on the client machine)

---

## Benefits

1. **Native performance** -- Rust backend handles file I/O, Git, and process management with minimal overhead compared to Electron
2. **Strong security model** -- allowlist + fs scope + CSP + no-shell provides defense-in-depth against malicious code
3. **Offline resilience** -- ElectricSync ensures no work is lost when connectivity drops, with configurable conflict resolution
4. **Automatic Ollama management** -- users get local LLM inference without manual setup; OllamaManager handles the full lifecycle
5. **Cross-platform from one codebase** -- GitHub Actions CI matrix produces .dmg, .msi, .AppImage, .deb, and Snap packages
6. **Small binary size** -- Tauri uses the system webview instead of bundling Chromium, resulting in significantly smaller downloads than Electron

---

## Related Patterns

- See `vscode-extension.md` for the VS Code integration that shares some bridge patterns with the Tauri desktop app
- See `preview-server.md` for the embedded webview that Tauri loads with HMR during development
- See `../06-llm-integration/ollama-client.md` for the TypeScript Ollama client that communicates with the Rust-managed Ollama instance
- See `../05-execution/docker-executor.md` for sandboxed execution that complements the Tauri no-shell security model
- See `../12-git-and-integrations/git-workflow.md` for the Git workflow that the Rust libgit2 bridge implements

---

*Extracted: 2026-02-19*
