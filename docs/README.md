# NOVA26 Documentation

Welcome to the official documentation for **NOVA26**, the AI-powered IDE that orchestrates a swarm of 21 specialized agents to build, refactor, and deploy software.

## Core Documentation

### [Getting Started](./getting-started.md)
**Start here!** Go from zero to your first AI-generated build in under 5 minutes.
- Prerequisites (Node.js, Ollama)
- Initialization
- Your first `/generate` and run

### [Architecture Overview](../ARCHITECTURE.md)
Deep dive into the **Ralph Loop**, our deterministic orchestrator that ensures reliability through:
- **The 21-Agent Swarm**: Specialized roles (SUN, MARS, VENUS, etc.)
- **Quality Gates**: Automatic validation of code, specs, and security.
- **Model Router**: Dynamic switching between Local (Ollama) and Cloud (OpenAI/Anthropic) models.

### [CLI Reference](../CLI.md)
Complete guide to the `nova26` command-line interface and slash commands:
- `/generate`: Create PRDs from natural language
- `/status`: Check build progress and costs
- `/cost`: Track token usage and budget
- `/preview`: Visual component testing

### [Configuration Guide](./CONFIGURATION.md)
Customize your NOVA26 environment:
- `.nova/config/hard-limits.json`: Define strict boundaries for agents.
- `.novaignore`: Prevent agents from touching sensitive files.
- Environment Variables (`NOVA26_TIER`, `NOVA26_BUDGET`).

### [Agent Reference](../AGENTS.md)
Meet the swarm. A detailed look at the 21 agents, their prompt templates, and responsibilities.

| Agent | Role | Domain | Tier |
|-------|------|--------|------|
| **SUN** | Orchestrator | Planning & Dispatch | Balanced |
| **MARS** | Backend | TypeScript & Convex | Quality |
| **VENUS** | Frontend | React & Tailwind | Quality |
| **ENCELADUS** | Security | Auth & Compliance | Quality |
| ...and 17 more | | | |

## Operations

- **[Deployment Guide](./DEPLOYMENT.md)**: How to deploy NOVA26 locally, via Docker, or with a hosted Convex backend.
- **[Security & Compliance](./SECURITY.md)**: Threat models, SOC 2 roadmap, and ISO 42001 alignment.

## Research & Analysis

NOVA26 is built on deep research into the evolving AI landscape.
- **[P-01: Competitive Analysis](./research/P-01-competitive-analysis.md)** (vs Cursor, Devin)
- **[P-02: Multi-Agent Orchestration](./research/P-02-multi-agent-orchestration.md)** (vs CrewAI, LangGraph)
- **[P-03: Convex 1.31 Features](./research/P-03-convex-features.md)** (Vector search & agents)
- **[P-04: Compliance Requirements](./research/P-04-compliance-requirements.md)** (SOC 2 & ISO 42001)
- **[P-05: Video Generation](./research/P-05-video-generation.md)** (Open-Sora, Mochi 1)
- **[P-06: Streaming Patterns](./research/P-06-streaming-patterns.md)** (SSE & Async Iterators)

## Community

- **[Contributing Guide](./CONTRIBUTING.md)**: Learn how to add new agents, skills, or models to the core platform.
- **[Tutorial: Build Your First App](./tutorial/first-build.md)**: A step-by-step walkthrough.

---
*NOVA26 - Built by the Intelligence Systems Team*
