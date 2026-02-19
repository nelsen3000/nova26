# R20-02: Tauri Native Desktop Application — Accepted Spec
## Source: Grok R20-02 (Feb 19, 2026)

## Key Interfaces

### TypeScript (frontend)
- TauriAppConfig: window (WindowConfig), autoUpdate, deepLinks, menuBar, security, offline
- WindowConfig: title, width, height, minWidth, minHeight, alwaysOnTop, transparent, systemTray
- NativeBridge: invoke(), listen(), fileSystem, git, notifications
- OfflineCapabilityConfig: ollamaAutoStart, queuePath, syncEngine (electric-sql|custom), conflictStrategy
- SecurityModel: allowlist, fsScope, csp, noShell: true

### Rust (backend)
- Commands: read_project_file, git_commit (libgit2), spawn_ollama, watch_project (notify crate)
- OllamaManager: auto-start/stop, port watching
- ElectricSync: conflict resolution, offline queue flush

## File Structure
src-tauri/
├── src/
│   ├── main.rs
│   ├── commands.rs
│   ├── ollama_manager.rs
│   └── electric_sync.rs
├── tauri.conf.json
├── Cargo.toml
├── capabilities/ (allowlist definitions)
└── icons/

## Distribution
- macOS: .dmg + notarization + Sparkle auto-update
- Windows: .msi + NSIS + WinSparkle
- Linux: .AppImage + .deb + Snap
- CI: GitHub Actions matrix (macos, windows, ubuntu)

## Integration Points
- CLI commands → Tauri invoke commands
- Next.js dashboard → embedded webview with HMR
- Ollama → auto-started by Rust
- Ralph Loop → background Rust thread
- TRITON → new desktop distribution target

## Tests: 87 vitest + cargo test cases
