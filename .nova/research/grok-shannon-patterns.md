# Grok Shannon Patterns Research
## Source: Grok Deep Research (Feb 19, 2026)
## Status: Accepted — reference architecture for Nova26

## Two Key References

### 1. Kocoro-lab/Shannon (MIT, 1k stars)
Production-grade multi-agent orchestration platform.
- Temporal workflows (durable execution, time-travel debugging, step-by-step replay)
- WASI sandbox (Rust core) + OPA policies for multi-tenant isolation
- Smart LLM routing: UCB-style learning router, 85-95% token savings, circuit breakers
- Built-in MCP support, OpenAI-compatible REST, Python SDK, CLI
- Swarm collaboration, human-in-the-loop approval middleware
- Real-time observability (Prometheus + OTel + Temporal UI + Tauri desktop app)
- Stack: Go orchestrator, Rust agent core, Python LLM service, Tauri/TS dashboard

### 2. KeygraphHQ/Shannon (AGPL, 23.6k stars)
Fully autonomous AI pentesting tool.
- Multi-agent (Claude SDK + Temporal), 96.15% success on XBOW benchmark
- Recon → Analysis → Exploitation → Reporting pipeline
- Delivers real PoC exploits + reports

## Patterns to Adapt for Nova26

1. **Ralph Loop + R20-01 Hierarchy**: Temporal-style replay engine using GraphMemory + Convex
   - Every agent trajectory becomes watchable
   - Upgrades R17-01 Error Recovery and R21-03 Trajectory replay

2. **R22-01 Model Routing**: UCB learning router + hard token budgets + fallback logic
   - Same confidence-escalation patterns
   - Benchmark Nova-Bench against their 85-95% savings claims

3. **R21-01 MCP Integration**: Their tool-registration and OAuth patterns
   - Cleaner MCP citizen implementation

4. **L3 ToolLayer Sandbox (R20-01)**: WASI + OPA inspiration
   - Upgrade sandbox to production-grade isolated workspaces
   - Policy files for "Nova26 as a Service"

5. **R21-03 Compliance**: Audit trail + circuit breakers + OPA
   - Strengthen immutable JSONL
   - Add security scanning via KeygraphHQ patterns as Mercury gate

6. **R20-02 Tauri Desktop**: Their Tauri dashboard + system tray + offline history
   - Direct inspiration for Director's Private Screening Room

7. **R16 Visionary Layer**: Swarm collaboration + HITL
   - Accelerates Parallel Universe Mode and Dream Mode approval flows

## Potential Buildable Files
- src/orchestrator/replay-engine.ts
- src/model-routing/ucb-router.ts
- src/orchestrator/sandbox-policy.ts

## Note
Not a fork candidate (different stack: Go/Rust/Python). Cherry-pick patterns only.
All adaptations stay pure TS + Convex + Ollama.
