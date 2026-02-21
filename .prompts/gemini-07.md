# Gemini Research Prompt — GEMINI-07
## Topic: Agent Communication Protocols & Multi-Agent UX

**Role**: You are a principal AI systems architect with deep expertise in multi-agent frameworks, developer tooling UX, and protocol design.

---

## Research Mission

Nova26 has 21 specialized AI agents that currently communicate via the Ralph Loop orchestrator. We need to understand the state of the art in agent-to-agent communication and multi-agent UX patterns to make Nova26 agents feel like a cohesive team rather than isolated scripts.

---

## Required Research Areas

### 1. Protocol Landscape (MCP, ACP, A2A, ANP)
For each protocol:
- Full name, creator, release date, GitHub stars
- What problem it solves vs. existing protocols
- Message format (JSON? Protobuf? Custom?)
- Transport layer (HTTP, WebSocket, SSE, gRPC?)
- Tool calling vs. resource sharing vs. conversation threading
- Production adoption (who's using it in 2026?)
- Nova26 fit: could we use this for EARTH↔agent or agent↔agent comms?

Protocols to cover:
- **MCP** (Anthropic Model Context Protocol) — tool servers, resource discovery
- **ACP** (Agent Communication Protocol) — IBM Research, multi-agent mesh
- **A2A** (Google Agent2Agent) — cross-vendor agent interop
- **ANP** (Agent Network Protocol) — decentralized agent discovery

### 2. Multi-Agent Orchestration Patterns
- Hierarchical orchestration (L0→L1→L2→L3 — we already have this, what are we missing?)
- Publish/subscribe event bus for agent state changes
- Shared scratchpad / blackboard architecture
- Agent handoff protocols (how does EARTH hand off a task to JUPITER mid-flight?)
- Parallel vs. serial agent chains (dependency graphs, DAG execution)
- How CrewAI, AutoGen, LangGraph, Temporal handle multi-agent coordination in 2026

### 3. Multi-Agent UX Patterns
- How do users observe 21 agents working in parallel? (real-time visualization)
- Confidence indicators: how to surface per-agent uncertainty to users
- Explainability: how to show WHY agent A called agent B
- Intervention points: where can users pause, redirect, or override agent decisions?
- Progress visualization: Gantt chart? Event stream? Agent constellation map?
- Error attribution: which agent failed, why, and what's the recovery path?

### 4. Agent Marketplace Patterns
- How do Vertex AI Agent Builder, AWS Bedrock Agents, and Azure AI Studio handle agent registration?
- Plugin/tool discovery (beyond MCP) — how do agents find and verify tools at runtime?
- Agent versioning and rollback — what happens when GANYMEDE v2 breaks SATURN's output?
- Agent capability advertising — structured schema for "what can I do?"

### 5. Priority Matrix
Rank the top 10 findings by: (a) implementation complexity for Nova26, (b) user experience impact, (c) competitive differentiation.

---

## Output Format

```
## Executive Summary (3 bullets)
## 1. Protocol Deep-Dives (MCP / ACP / A2A / ANP)
## 2. Orchestration Patterns
## 3. Multi-Agent UX
## 4. Agent Marketplace
## 5. Priority Matrix (table: Feature | Complexity | UX Impact | Differentiation | Priority)
## 6. Nova26 Integration Points (specific file paths and interfaces to add/modify)
## 7. Open Questions for Jon
```

**Depth target**: 3,000-4,000 words. Include concrete TypeScript interface sketches where relevant.
Save output to: `.nova/research/gemini-07-agent-protocols.md`
