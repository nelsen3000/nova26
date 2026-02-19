# Nova26 Patterns — Index

> Catalog of all extracted Nova26 architecture and intelligence patterns.

---

## Summary

| # | Category | Pattern Count |
|---|----------|---------------|
| 01 | Orchestration | 13 |
| 02 | Agent System | 5 |
| 02i | Intelligence | 9 |
| 03 | Quality Gates | 3 |
| 04 | CLI and Commands | 3 |
| 05 | Execution | 3 |
| 06 | LLM Integration | 4 |
| 07 | Memory and Persistence | 2 |
| 08 | Security | 1 |
| 09 | Observability | 2 |
| 10 | Cost Management | 1 |
| 11 | Codebase Analysis | 2 |
| 12 | Git and Integrations | 3 |
| 13 | Browser and Preview | 4 |
| 14 | Templates and Skills | 2 |
| 15 | Type System | 1 |

**Total Architecture Patterns: 36**
**Total Intelligence Patterns: 9**
**Total Data/Intelligence Patterns: 15**
**Grand Total: 58**

---

## 01 — Orchestration

| Pattern Name | File | Description |
|---|---|---|
| Ralph Loop Execution | `01-orchestration/ralph-loop-execution.md` | Core execution engine that processes a PRD by iterating over tasks, dispatching to agents, running quality gates, and persisting state |
| Task Picker | `01-orchestration/task-picker.md` | Selects the next task from a PRD's task list by filtering ready tasks, sorting by phase and attempt count, and verifying dependencies |
| Parallel Task Runner | `01-orchestration/parallel-task-runner.md` | Executes independent tasks concurrently using Promise.all with configurable concurrency limit and timeout guards |
| Event Store | `01-orchestration/event-store.md` | Append-only event-sourced session log recording every agent action as JSON events for full replay and crash-safe resumption |
| Prompt Builder with Dependency Injection | `01-orchestration/prompt-builder-dependency-injection.md` | Constructs agent prompts by combining system prompt, user prompt, and dependency context from completed upstream tasks |
| Gate Runner Pipeline | `01-orchestration/gate-runner-pipeline.md` | Validates LLM responses through a fail-fast pipeline of hard limits and configurable gates including TypeScript checks and test runners |
| Council Consensus Voting | `01-orchestration/council-consensus-voting.md` | Runs multiple specialized agents to vote on critical task outputs with approve/reject/abstain and confidence scoring |
| Todo Tracking System | `01-orchestration/todo-tracking-system.md` | Breaks complex tasks into sub-steps tracked through pending/in_progress/completed states with agent-specific verification criteria |
| Test → Fix → Retest Loop | `01-orchestration/test-fix-retest-loop.md` | Automatically runs TypeScript type-checking and test suites after code-producing agents, with LLM-driven fix retries on failure |
| Agent Schema Registry | `01-orchestration/agent-schema-registry.md` | Maps agent names to Zod schemas for structured JSON output validation with graceful fallback on validation failure |
| Lifecycle Hook Registry | `01-orchestration/lifecycle-hook-registry.md` | Priority-ordered hook system with 6 lifecycle phases, error isolation per hook, and singleton global registry with lazy Zod validation |
| Feature Lifecycle Wiring | `01-orchestration/feature-lifecycle-wiring.md` | Declarative config mapping 13 R16/R17 feature modules to lifecycle hook phases with diagnostics and options-driven enablement |
| Multi-Layer Orchestrator Hierarchy | `01-orchestration/multi-layer-hierarchy.md` | 4-layer architecture (L0 intent → L1 planning → L2 execution → L3 tools) with escalation, task graphs, and backward compatibility |

---

## 02 — Agent System

| Pattern Name | File | Description |
|---|---|---|
| Agent Loader | `02-agent-system/agent-loader.md` | Cached file-based mechanism for loading agent prompt templates from markdown files with fallback to hardcoded defaults |
| Agent Explanations | `02-agent-system/agent-explanations.md` | Multi-level human-readable descriptions of agent actions with chain-of-reasoning for transparency |
| PRD Generator | `02-agent-system/prd-generator.md` | LLM-driven conversion of natural language descriptions into structured PRDs with phased, dependency-aware tasks |
| ATLAS Convex Integration | `02-agent-system/atlas-convex.md` | Typed facade over Convex backend for build tracking with silent degradation when backend is unavailable |
| Convex Client | `02-agent-system/convex-client.md` | Lightweight HTTP wrapper around Convex API with singleton accessor and automatic execution logging decorator |

---

## 02i — Intelligence

| Pattern Name | File | Description |
|---|---|---|
| Checkpoint System | `02-intelligence/checkpoint-system.md` | SQLite-backed build state checkpointing with auto-save timer and automatic pruning of old checkpoints |
| Langfuse Tracing | `02-intelligence/langfuse-tracing.md` | Distributed tracing for agent orchestration via Langfuse with hierarchical session/trace/span tree and silent degradation |
| LLM Response Cache | `02-intelligence/llm-response-cache.md` | SQLite-backed LLM response cache keyed by SHA-256 hash with TTL expiry and hit count tracking |
| Model Router Fallback Chains | `02-intelligence/model-router-fallback-chains.md` | Multi-tier model routing with fallback chains across free/paid/hybrid tiers for LLM provider selection |
| Security Scanner | `02-intelligence/security-scanner.md` | Regex-based static analysis scanner detecting six vulnerability categories with severity-gated pass/fail |
| Session Memory Relevance | `02-intelligence/session-memory-relevance.md` | Persistent cross-session key-value memory with confidence scoring and relevance ranking for agent prompt injection |
| Smart Retry Escalation | `02-intelligence/smart-retry-escalation.md` | Error classification with escalating retry strategies across models with automatic tier upgrading |
| Semantic Model Graph | `02-intelligence/semantic-model-graph.md` | CodeGraph with typed nodes and edges, impact analysis with Mermaid visualization, context compaction for LLM token budgets |
| Studio Rules Engine | `02-intelligence/studio-rules-engine.md` | Rule engine with warn/block/auto-fix enforcement, DSPy prompt optimization, Taste Vault rule learner with decay |

---

## 03 — Quality Gates

| Pattern Name | File | Description |
|---|---|---|
| TypeScript Gate | `03-quality-gates/typescript-gate.md` | Validates code blocks in LLM responses by extracting and compiling TypeScript through the Piston execution service |
| Test Runner Gate | `03-quality-gates/test-runner-gate.md` | Smoke tests LLM-generated code by wrapping extracted blocks in try-catch harnesses and executing through Piston |
| Piston Client | `03-quality-gates/piston-client.md` | Typed HTTP wrapper around the Piston code execution API with runtime discovery, timeouts, and graceful degradation |

---

## 04 — CLI and Commands

| Pattern Name | File | Description |
|---|---|---|
| CLI Entry Point | `04-cli-and-commands/cli-entry.md` | Unified command registry merging multiple command sources into a single dispatch table with interactive REPL loop |
| Slash Commands | `04-cli-and-commands/slash-commands.md` | Strongly-typed slash command interface with core development commands integrating Nova26 subsystems |
| Slash Commands Extended | `04-cli-and-commands/slash-commands-extended.md` | Comprehensive set of 25+ commands organized across seven functional categories for the CLI |

---

## 05 — Execution

| Pattern Name | File | Description |
|---|---|---|
| Docker Executor | `05-execution/docker-executor.md` | Sandboxed code execution using Docker containers with automatic fallback to Node.js child processes |
| Swarm Mode | `05-execution/swarm-mode.md` | Multi-agent collaborative execution activating all 21 agents simultaneously for complex tasks with declarative agent registry |
| Mobile Launch Pipeline | `05-execution/mobile-launch-pipeline.md` | Asset generation pipeline with EAS/Expo wrapper, ASO optimization, launch profiles, and rehearsal-to-production workflow |

---

## 13 — Browser and Preview

| Pattern Name | File | Description |
|---|---|---|
| Visual Validator | `13-browser-and-preview/visual-validator.md` | Headless-browser feedback loop scoring VENUS output 0–100 for responsiveness, accessibility, and UI quality |
| Preview Server | `13-browser-and-preview/preview-server.md` | Local Express-based dev server with device-frame UI for previewing components at mobile, tablet, and desktop viewports |
| VS Code Extension | `13-browser-and-preview/vscode-extension.md` | Full IDE integration exposing the multi-agent system through VS Code commands, completions, webviews, and status bar |
| Tauri Desktop Bridge | `13-browser-and-preview/tauri-desktop-bridge.md` | TypeScript-Rust bidirectional bridge with Ollama lifecycle, offline-first ElectricSync, and multi-platform distribution |

---

## 14 — Templates and Skills

| Pattern Name | File | Description |
|---|---|---|
| Template Engine | `14-templates-and-skills/template-engine.md` | Declarative registry-based project scaffolding with placeholder hydration and post-install hooks |
| Skill Loader | `14-templates-and-skills/skill-loader.md` | Dynamic discovery and injection of domain-specific knowledge into agent prompts based on task relevance |

---

## Phase 3: Data & Intelligence Patterns (KIRO-03-03)

---

## 06 — LLM Integration

| Pattern Name | File | Description |
|---|---|---|
| Model Router | `06-llm-integration/model-router.md` | Multi-tier model routing with fallback chains across free/paid/hybrid tiers for LLM provider selection |
| Ollama Client | `06-llm-integration/ollama-client.md` | Typed wrapper around the Ollama REST API for running LLMs locally with per-agent model mapping |
| Structured Output | `06-llm-integration/structured-output.md` | Zod-validated structured output from LLM responses with per-agent schemas and graceful fallback |
| Response Cache | `06-llm-integration/response-cache.md` | SQLite-backed LLM response cache keyed by SHA-256 hash with TTL expiry and hit count tracking |

---

## 07 — Memory and Persistence

| Pattern Name | File | Description |
|---|---|---|
| Session Memory | `07-memory-and-persistence/session-memory.md` | Persistent cross-session key-value memory with confidence scoring and relevance ranking for agent prompt injection |
| Checkpoint System | `07-memory-and-persistence/checkpoint-system.md` | SQLite-backed build state checkpointing with auto-save timer and automatic pruning of old checkpoints |

---

## 08 — Security

| Pattern Name | File | Description |
|---|---|---|
| Security Scanner | `08-security/security-scanner.md` | Regex-based static analysis scanner detecting six vulnerability categories with severity-gated pass/fail |

---

## 09 — Observability

| Pattern Name | File | Description |
|---|---|---|
| Tracer | `09-observability/tracer.md` | Distributed tracing for agent orchestration via Langfuse with hierarchical session/trace/span tree and silent degradation |
| Observability Setup | `09-observability/observability-setup.md` | Barrel module initialization and configuration with environment-driven bootstrap for tracing and metrics |

---

## 10 — Cost Management

| Pattern Name | File | Description |
|---|---|---|
| Cost Tracker | `10-cost-management/cost-tracker.md` | LLM API cost tracking with per-model pricing tables, SQLite persistence, and threshold-based budget alerts |

---

## 11 — Codebase Analysis

| Pattern Name | File | Description |
|---|---|---|
| Repository Map | `11-codebase-analysis/repo-map.md` | Regex-based codebase indexing that extracts symbols from source files for focused agent context injection |
| Dependency Analyzer | `11-codebase-analysis/dependency-analyzer.md` | Import graph analysis with circular dependency detection, orphan identification, and architecture metrics |

---

## 12 — Git and Integrations

| Pattern Name | File | Description |
|---|---|---|
| Git Workflow | `12-git-and-integrations/git-workflow.md` | Automated branch/commit/PR lifecycle for agent-generated code with conventional commit messages |
| Issue Importer | `12-git-and-integrations/issue-importer.md` | GitHub issue to PRD conversion with label-driven agent routing and template-based task chain generation |
| Xcode Integration | `12-git-and-integrations/xcode-integration.md` | iOS/macOS build integration connecting Nova26 agents with xcodebuild for compilation and test validation |

---

## 15 — Type System

| Pattern Name | File | Description |
|---|---|---|
| Core Types | `15-type-system/core-types.md` | Shared type definitions providing a single source of truth for all data structures across the multi-agent system |

---

*Updated: 2026-02-19*
