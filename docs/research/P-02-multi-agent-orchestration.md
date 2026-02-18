# P-02: Multi-Agent Orchestration Patterns (February 2026)

## Overview

This document surveys state-of-the-art multi-agent orchestration frameworks as of February 2026 and compares their patterns to Nova26's Ralph Loop.[file:9][web:125][web:129] It focuses on CrewAI, LangGraph, AutoGen, OpenAI Swarm, and Anthropic's emerging agent-team patterns, then distills concrete recommendations for Nova26.

## CrewAI

- Architecture:
  - Role-based framework where each agent is assigned a role (e.g., Researcher, Developer, Reviewer) and a set of tools.[web:126][web:128]
  - Orchestrator manages task decomposition and message routing between agents, hiding low-level communication from developers.[web:126]
- Strengths:
  - Natural fit for "AI team" metaphors; very productive for task-oriented workflows like research → implementation → QA.[web:126][web:132]
  - Late-2025 introduction of the Agent Operations Platform (AOP) adds enterprise features: deployment, monitoring, RBAC, and audit logs.[web:126]
- Weaknesses:
  - Less explicit control over control-flow compared to graph-based systems.
  - More opinionated; complex custom flows can be harder to model.

## LangGraph

- Architecture:
  - Graph-based orchestration where nodes are functions/agents/tools and edges define control flow; state is explicitly threaded through the graph.[web:129]
  - Built by the LangChain team; integrates strongly with LangChain's tool and memory ecosystem.[web:125][web:129]
- Key capabilities:
  - Explicit state machines with START/END nodes and conditional routing, enabling rigorous control and auditability.[web:129]
  - Visual debugging: graphs can be rendered as diagrams for understanding and debugging complex flows.[web:129]
  - Checkpointing and thread-based persistence for long-running workflows.[web:129]
  - Human-in-the-loop interrupts for manual approval at specific nodes.[web:129]
- Strengths vs Nova26:
  - Comparable to Ralph Loop in having explicit control flow, but with richer graph semantics (branches, merges, dynamic routing).
  - Stronger built-in story for state persistence and visual introspection.
- Weaknesses:
  - Steeper learning curve; can be overkill for simple linear pipelines.

## AutoGen (Microsoft)

- Architecture:
  - Multi-agent conversation framework where agents (e.g., Coder, Critic, Executor) communicate via structured messages.[web:125][web:132][web:138]
  - Emphasizes dialog-style coordination rather than rigid graphs.
- Patterns:
  - Turn-based collaboration loops: Coder proposes changes, Critic reviews, Executor runs tools/tests, iterating until success.[web:132][web:138]
  - Human-in-the-loop via "user" agent roles.
- Strengths:
  - Very good for iterative refinement of code or documents.
  - Flexible conversational patterns that are easy to prototype.
- Weaknesses:
  - Less deterministic than graph or PRD-based systems.
  - Harder to audit and reason about all possible paths.

## OpenAI Swarm

- Architecture:
  - Lightweight experimental orchestration pattern for coordinating specialized GPT-based agents around a triage agent.[web:125][web:135]
  - Often used with LangChain or other ecosystems for RAG and document workflows.[web:135]
- Key ideas:
  - Triage agent receives a request, decides which specialist agents to invoke, aggregates results, and returns a unified answer.[web:135]
  - Designed to keep orchestration simple and modular.
- Strengths:
  - Easy to adopt in small systems or as a layer on top of existing LLM APIs.
  - Good mental model for Nova26's SUN agent acting as a triage/orchestrator.
- Weaknesses:
  - Less focus on long-lived state and complex pipelines.

## Anthropic Multi-Step & Agent Teams

- Tool use and planning:
  - Anthropic's Claude uses a planning loop: interpret goal → decompose tasks → select tools → execute → analyze → refine.[web:131]
  - Reduces hallucinations by grounding decisions in tool outputs and verifying intermediate steps.[web:131]
- Agent teams (Opus 4.6, 2026):
  - Introduces "agent teams" where multiple agents work in parallel, each owning a subtask but coordinating on a shared goal.[web:137][web:134]
  - Parallelism across context windows yields faster completion for complex workflows.[web:134][web:137]
- Relevance to Nova26:
  - Mirrors Nova26's vision of specialized agents (SUN, MERCURY, MARS, etc.) coordinated by an orchestrator.[file:9][file:3]
  - Highlights importance of parallelism, intermediate validation, and human-oversight escalation.

## Emerging Best Practices (2025–2026)

Across frameworks and the 2026 agentic coding trends report, several common patterns emerge:[web:125][web:134][web:138]

- Orchestrator-centric design:
  - A central coordinator (LangGraph controller, CrewAI manager, AutoGen controller, triage agent, etc.) deciding which agent runs next and with what context.[web:129][web:126][web:138]
- Specialization + parallelism:
  - Teams of specialized agents (research, retrieval, coding, testing, review) working in parallel rather than one monolithic agent.[web:126][web:134][web:137]
- Explicit state & memory:
  - Persistent thread or workflow state stored in a database or checkpointer; used for resuming, auditing, and analysis.[web:129][web:133][web:136]
- Human-in-the-loop checkpoints:
  - Intentional interrupts at risky points (deployments, large refactors, refunds, etc.).[web:129][web:134]
- Tool-centric reliability:
  - Heavy reliance on tools (search, databases, code runners) with intermediate checks to reduce hallucinations.[web:131][web:135]

## Comparison with Nova26's Ralph Loop

Nova26 today:[file:9][file:3][file:7]

- Uses PRDs (JSON) describing tasks, dependencies, phases, and assigned agents.
- Ralph Loop promotes tasks from pending → ready when dependencies are done, then runs Pick Task → Load Agent → Build Prompt → Call LLM → Run Gates → Save/Log.
- Quality gates (response validation, MERCURY checks, future TypeScript/tests) enforce minimum standards.
- Execution is primarily linear within a PRD, ordered by phase and dependencies; parallelism is limited.

Compared to frameworks:

- Similarities:
  - SUN + Ralph Loop act like a central orchestrator (triage/manager agent).[file:9][web:135]
  - 21 specialized agents mirror role-based design in CrewAI and agent teams in Anthropic's patterns.[file:9][web:126][web:134]
  - PRDs+ATLAS provide explicit state and potential for persistent memory, like LangGraph+checkpoints.[file:9][file:11][web:129]
- Differences / gaps:
  - No explicit graph model or visual workflow; flows are implicit in PRD dependencies.[file:9][file:3]
  - Limited human-in-the-loop controls beyond quality gate failures.
  - No built-in support for parallel execution of independent tasks (no swarm-style parallelism).
  - Tool use is relatively simple (LLM + file writes), with limited code execution feedback.

## Recommendations for Nova26

1. **Adopt a lightweight graph representation over PRDs**
   - Keep PRDs as the source of truth but introduce an internal graph model (nodes = tasks, edges = dependencies) with visualization similar to LangGraph's diagrams.[web:129][file:9]
   - Benefits: better debugging, ability to introduce conditional branches, and easier reasoning about parallelism.

2. **Introduce parallel task execution (agent "swarms")**
   - Allow Ralph Loop to run independent tasks in parallel when dependencies allow, inspired by Anthropic agent teams and multi-agent trends.[web:134][web:137][file:7]
   - Start with a small concurrency cap and per-agent resource quotas.

3. **Add structured human-in-the-loop checkpoints**
   - Add optional PRD fields like `requiresApproval: true` or `riskLevel: high` and pause before/after such tasks, similar to LangGraph interrupts.[web:129][web:134]
   - Implement a simple approval API/UI before continuing execution.

4. **Strengthen tool integration inside agents**
   - Move toward tool-centric reliability: e.g., MARS and SATURN agents calling local test runners, linters, or schema validators instead of purely reasoning from text.[web:131][web:135][file:7]
   - Define a Convex-based agent toolkit (read/write ATLAS, vector search, query UA Dashboard data) using the Convex agent framework.[web:133][web:136][file:11]

5. **Codify agent roles and templates more like CrewAI**
   - Standardize each Nova26 agent's responsibilities, expected inputs/outputs, and tools in a machine-readable manifest, not just markdown.[web:126][web:128][file:9]
   - Enables future UI (mode selection) and automatic validation that a task is assigned to the right agent.

6. **Plan for persistent execution state & resumability**
   - Use ATLAS/Convex to persist Ralph Loop state (current task, attempts, gate outcomes) so runs can be paused/resumed like LangGraph checkpoints.[web:129][file:9][file:11]

7. **Design for governance from the start**
   - Borrow ideas from CrewAI AOP and the broader 2026 agentic trends (audit logs, RBAC, monitoring).[web:126][web:134]
   - Log all LLM calls, prompts, and gate decisions into ATLAS with trace IDs to enable future SOC 2/ISO 42001 work.

By layering these patterns on top of the existing Ralph Loop and PRD model, Nova26 can retain its deterministic, local-first architecture while adopting the best orchestration ideas from CrewAI, LangGraph, AutoGen, OpenAI Swarm, and Anthropic's latest work.
