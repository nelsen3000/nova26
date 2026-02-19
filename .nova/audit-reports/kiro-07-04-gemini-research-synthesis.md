# KIRO-07-04: Gemini Research Synthesis Report
## Cross-Report Pattern Analysis Across 8 Research Files
### Date: February 19, 2026 | Analyst: Claude Opus 4.6 | Status: Complete

---

## Executive Summary

This report synthesizes findings from all 8 research files in `.nova/research/`, spanning Gemini rounds 02-06, Gemini-12 Model Intelligence, Grok R23 Gap Analysis, and Grok Shannon Patterns. The analysis identifies **10 cross-cutting pattern overlaps** that, taken together, form a coherent strategic blueprint for Nova26's next development phase.

The dominant theme across all sources is **sovereign local-first architecture** as both a technical differentiator and a compliance moat. Four of eight reports independently converge on local-first execution as the foundation for monetization (charge for the system, not tokens), regulatory compliance (EU AI Act data residency), and performance (2.5x throughput via speculative decoding). The second strongest signal is **model routing intelligence** -- the idea that Nova26 should never hardcode a single model per agent but instead deploy adaptive routing with confidence escalation, UCB learning, and circuit breakers.

The EU AI Act enforcement deadline of **August 2, 2026** creates an immovable 5-month constraint that elevates compliance from a nice-to-have to a launch-gating priority. Combined with the rapidly maturing open-model ecosystem (Qwen 3.5 Coder achieving 80.2% SWE-bench Verified), Nova26 is uniquely positioned to deliver a multi-agent IDE that is simultaneously more capable, more private, and less expensive than any competitor relying solely on closed-model APIs.

**Key numbers across all reports:**
- 10 cross-report pattern overlaps identified
- 21 agents mapped to primary/fallback/speed/budget models
- $12/$25/$45 three-tier pricing validated across monetization and compliance research
- 2.5x throughput gain from speculative decoding (Nemotron 3 Nano draft + Qwen 3.5 verify)
- 85-95% token savings from UCB adaptive routing
- 40ms memory recall target for Mem0 hybrid architecture
- 5-month runway to EU AI Act enforcement

---

## Cross-Report Pattern Analysis

### Pattern A: Local-First Architecture
**Appears in:** Gemini-04 (Monetization), Gemini-05 (Compliance), Gemini-06 (Local SLM), Grok Shannon Patterns
**Convergence strength:** Very High (4/8 reports)

This is the single most reinforced pattern across the entire research corpus. Each report approaches it from a different angle, and all four arrive at the same conclusion: local-first execution is Nova26's defining strategic advantage.

**Monetization lens (Gemini-04):** The "Sovereign Tier" pricing model charges for the system and sync infrastructure, not for per-token API consumption. Users running Ollama locally save $30-150/month on API fees compared to Cursor, Windsurf, or GitHub Copilot. This inverts the typical AI-tool cost structure -- the more a user builds, the less they spend relative to competitors.

**Compliance lens (Gemini-05):** Local-first is described as "the strongest compliance asset" because it solves data residency by default. Code never leaves the developer's machine unless they explicitly opt into cloud models. This is directly relevant to EU AI Act Article 86 "Right to Explanation" and GDPR data sovereignty requirements. Enterprises in regulated industries (finance, healthcare, government) can adopt Nova26 without legal review of cross-border data transfer.

**Performance lens (Gemini-06):** The Ollama integration with speculative decoding (Nemotron 3 Nano drafting, Qwen 3.5 verifying) delivers 2.5x throughput at zero API cost. Hardware tier configs range from MacBook Air 16GB (Q4_K_M quantization, 16K context) to H100 clusters (FP16, 256K context), ensuring every user gets the best local experience their hardware allows.

**Architecture lens (Shannon):** The Kocoro-lab/Shannon reference architecture validates WASI sandboxing + OPA policies for multi-tenant isolation, directly applicable to Nova26's L3 ToolLayer upgrade path. Their Tauri desktop app pattern maps to Nova26's Director's Private Screening Room concept.

**Recommended implementation:**
- Ollama Modelfile templates per agent role (Gemini-06 provides exact configs)
- Hardware auto-detection at `nova init` to select optimal quantization tier
- "Privacy Shield" icon in UI when all inference is local (Gemini-02 UX pattern #15)
- Real-time "Tokens/Cost Saved" counter comparing local vs cloud pricing (Gemini-02 pattern #18)

---

### Pattern B: Model Routing & Speculative Decoding
**Appears in:** Gemini-06 (Local SLM), Gemini-12 (Model Intelligence), Grok R23 (Gap Analysis), Grok Shannon Patterns
**Convergence strength:** Very High (4/8 reports)

Every report that touches model selection independently recommends the same three-layer routing strategy: start cheap, measure confidence, escalate if needed. This pattern has matured from a theoretical optimization to a production-ready architecture with concrete benchmarks.

**UCB Learning Router (Shannon):** The Kocoro-lab/Shannon platform demonstrates 85-95% token savings using Upper Confidence Bound (UCB) multi-armed bandit routing. The router learns which model performs best for each task type over time, avoiding the need for static model assignments. Nova26's `src/model-routing/ucb-router.ts` should implement this pattern.

**Speculative Decoding (Gemini-06):** The specific pairing of Nemotron 3 Nano as the draft model with Qwen 3.5 Coder as the verifier achieves 2.5x throughput. The small model generates candidate tokens at high speed; the large model verifies in parallel, accepting correct tokens and correcting wrong ones. This is the single highest-impact performance optimization available.

**Confidence Escalation (Gemini-06, Gemini-12):** Start with the cheapest model capable of the task. If the model's self-reported confidence score falls below a configurable threshold, automatically escalate to the next tier. This creates a natural cost curve where simple tasks (boilerplate, imports, test stubs) consume nearly zero resources while complex tasks (architecture decisions, security reviews) get frontier-quality reasoning.

**Circuit Breakers (Shannon):** If the cloud provider fails or latency exceeds SLA thresholds, the router falls back to local models automatically. This ensures Nova26 never blocks the developer's workflow due to external service degradation.

**Recommended implementation:**
```
Routing hierarchy per request:
1. Budget model (Nemotron 3 Nano / Phi-4) -- attempt first
2. Speed model (MiMo-V2-Flash / GPT-4.1 Mini) -- if confidence < 0.7
3. Primary model (Qwen 3.5 Coder / Claude Opus 4.6) -- if confidence < 0.85
4. Fallback local (always available) -- if cloud unreachable
```

---

### Pattern C: Audit Trails & EU AI Act Compliance
**Appears in:** Gemini-05 (Compliance), Grok R23 (Gap Analysis), Grok Shannon Patterns
**Convergence strength:** High (3/8 reports)

The August 2, 2026 enforcement deadline creates the most time-sensitive constraint in the entire research corpus. Three reports independently converge on the same compliance architecture: OpenTelemetry tracing + immutable JSONL trajectory logs + a structured `AIDecisionLog` schema.

**Required schema (Gemini-05):**
```typescript
interface AIDecisionLog {
  timestamp: string;           // ISO 8601
  traceId: string;             // OTel compliant
  agentId: string;             // e.g., "MARS", "PLUTO"
  model: {
    id: string;
    provider: "local" | "cloud";
    temperature: number;
    promptVersion: string;
  };
  context: { filePaths: string[]; dependencyId?: string };
  decision: {
    action: string;
    reasoning: string;
    confidenceScore: number;
  };
  humanAction: "approved" | "modified" | "rejected" | "auto-applied";
}
```

**Trajectory format (Gemini-05):** Every agent handoff produces an immutable JSONL record at `.nova/audit/trajectory.jsonl` with fields for step type, source agent, destination agent, reasoning, OTel trace ID, and a data hash for tamper detection.

**EU AI Act specifics (Gemini-05):**
- AI coding tools are generally classified as Low/Minimal Risk unless used in critical infrastructure
- Article 86 "Right to Explanation" is triggered when AI decisions have "significant effect"
- Penalties reach up to EUR 35M or 7% global turnover for prohibited practices
- OTel GenAI Semantic Conventions are the 2026 industry standard

**Shannon reinforcement:** Circuit breakers + OPA policy enforcement + audit trail integration. The pattern of immutable logging with policy-as-code is validated by Shannon's production deployment.

**R23 enhancement (R23-05):** The Cinematic Observability suite extends basic audit trails into a "Dailies Room" where every agent run is scored, visualized, and auto-optimized overnight via Braintrust integration.

**Recommended implementation timeline:**
1. **Immediate (by March 2026):** OTel tracing layer + immutable audit log
2. **Q2 2026:** "Explain this Code" feature using agent monologue + ACE score
3. **Pre-enforcement (by July 2026):** License Awareness + PII Redaction in MERCURY gate
4. **Post-launch:** Compliance Dashboard for enterprise CISO visibility

---

### Pattern D: Taste Vault & Persistent Memory
**Appears in:** Gemini-02 (UX Patterns), Gemini-04 (Monetization), Grok R23 (Gap Analysis), Grok R23 (references to Grok R23-03 Infinite Memory)
**Convergence strength:** Very High (4/8 reports)

The Taste Vault is Nova26's most unique product feature -- no competitor offers a persistent, synced, user-owned style graph that shapes every agent's output. Four reports address different facets of this capability.

**Visualization (Gemini-02):** UX pattern #10 proposes a "Personal Style Graph" visualization showing learned patterns -- the developer's coding preferences rendered as an interactive graph. This is the Taste Vault's consumer-facing surface.

**Memory architecture (R23-03):** The Mem0 hybrid approach achieves 40ms recall with a three-tier memory hierarchy:
- **Core (short-term):** Current session context, recent decisions, active file state
- **Archival (graph-vector):** Long-term style preferences, project patterns, team conventions
- **CRDT sync:** Multi-device consistency without central server dependency

**Monetization gate (Gemini-04):** Infinite history and Graph Memory are gated behind the Pro tier ($25/month). The Indie tier gets basic Taste Vault with 1-project Convex sync. This creates a natural upgrade path as developers accumulate more projects and want their style preferences to follow them.

**Gap analysis (R23-03):** Current ATLAS Graph memory is "strong but lacks infinite OS-style hierarchy." The Mem0/Letta (MemGPT) pattern of self-organizing archival memory with automatic promotion/demotion of memories is the target architecture.

**Recommended implementation:**
- `src/atlas/mem0-hybrid.ts` -- three-tier memory layer
- `src/taste-vault/infinite-recall.ts` -- persistent style recall across sessions
- CRDT sync via ElectricSQL for multi-device Taste Vault consistency
- Personal Style Graph component in Living Canvas

---

### Pattern E: Vision/Design Pipeline
**Appears in:** Gemini-03 (Mobile), Gemini-06 (Local SLM), Gemini-12 (Model Intelligence)
**Convergence strength:** High (3/8 reports)

Three reports converge on a specific model hierarchy for vision and design tasks, with Kimi K2.5 as the standout performer for UI reconstruction.

**Model hierarchy:**
1. **Kimi K2.5** (Primary): Native vision, image-to-code, UI reconstruction oracle. Ranked #1 for Agentic-VL tasks. This is VENUS and ANDROMEDA's primary model.
2. **Qwen 3.5 VL** (Fallback local): Strong vision-language model that runs locally. Falls back gracefully when K2.5's cloud API is unavailable.
3. **Gemini 3 Flash** (Speed): Ultra-low latency for rapid design iteration where quality can trade off against speed.
4. **GPT-4o-Mini** (Budget): Minimal cost for simple design tasks, screenshot analysis, and asset generation.

**Mobile-specific (Gemini-03):** The 5-agent mobile launch pipeline (TRITON, VENUS, SATURN, EUROPA, GANYMEDE) depends heavily on vision models for generating React Native components from wireframes and for automated screenshot generation via AppScreens.

**Hardware consideration (Gemini-06):** Kimi K2.5 at full resolution requires Tier 3+ hardware (RTX 4090/5090). For Tier 1-2 users, Kimi-VL 32B at Q5_K_M quantization provides adequate vision capability within 32GB memory constraints.

---

### Pattern F: Agent Council & Debate
**Appears in:** Gemini-02 (UX Patterns), Grok R23-04 (Agent Debate), Grok Shannon Patterns
**Convergence strength:** High (3/8 reports)

The concept of multi-agent debate as a quality mechanism appears independently in UX research, gap analysis, and reference architecture analysis. This is not just a backend optimization -- it is a visible, differentiated user experience.

**UX surface (Gemini-02):** Pattern #11 "Collaborative Agent Cursors" shows ghost cursors with agent names moving through code in real time. Combined with pattern #2 "Multi-Agent Activity Stream" (Dynamic Island-style agent avatars pulsing/thinking), the debate becomes a visual spectacle that builds user trust and understanding.

**Architecture (R23-04):** Five agents debate three alternative directions simultaneously. Each agent generates arguments for its preferred approach. Votes are tallied and the winning direction proceeds. The entire debate is visible in the Living Canvas as a branching tree of proposals.

**Shannon validation:** CrewAI role patterns + AutoGen conversation protocols + OpenAI Swarm 2026 patterns all confirm that multi-agent debate produces measurably better outcomes than single-agent generation, especially for architectural decisions and security reviews.

**Recommended implementation:**
- `src/orchestrator/swarm-debate.ts` -- debate round management
- `DebateRound { agents: string[], arguments: AgentArgument[], vote: VoteResult }`
- Living Canvas visualization with branching proposal tree
- Ghost cursor overlay for real-time collaboration visibility

---

### Pattern G: Mobile-First Launch
**Appears in:** Gemini-03 (Mobile Ecosystem), Gemini-04 (Monetization/GTM)
**Convergence strength:** Moderate (2/8 reports)

Two reports address mobile from complementary angles: Gemini-03 provides the technical stack recommendation, Gemini-04 provides the go-to-market rationale.

**Framework decision (Gemini-03):** React Native + Expo SDK 54 is the unambiguous recommendation. Rationale:
- Best AI generation quality due to TypeScript (matches Nova26's stack)
- Expo SDK 54 delivers precompiled React Native binaries (seconds, not minutes to build)
- `expo-router` for universal deep linking
- `EAS Update` for OTA JavaScript fixes without App Store review cycles
- New Expo UI (SwiftUI primitives) for native feel on iOS

**Testing (Gemini-03):** Maestro is recommended over Detox, achieving 90% less flaky tests for AI-generated UI flows. YAML-based test definitions integrate naturally with agent-generated test suites.

**5-Agent Mobile Pipeline (Gemini-03):**
1. **TRITON** -- Expo 54 monorepo initialization
2. **VENUS** -- UI generation with `react-native-mobile` patterns
3. **SATURN** -- Maestro YAML E2E test generation
4. **EUROPA** -- AppScreens localized asset creation
5. **GANYMEDE** -- EAS Submit to TestFlight / Play Console

**App Store 2026 constraints (Gemini-03):**
- Apple: iOS 26 SDK required from April 2026; AI disclosure required for 3rd-party data sharing
- Google: "Synthetic Content" label for AI-generated media
- Both: increasing rejections for "Misleading Assets" (AI-hallucinated UI screenshots)

---

### Pattern H: Zero-Config Onboarding
**Appears in:** Gemini-02 (UX Patterns), Gemini-04 (Monetization/GTM)
**Convergence strength:** Moderate (2/8 reports)

**UX pattern (Gemini-02):** Pattern #7 "Zero-Config Onboarding" draws from Vercel's developer experience. `nova init` auto-detects the project's tech stack (framework, language, package manager, database, deployment target) and generates a first PRD immediately. The developer sees value in under 60 seconds.

**GTM loop (Gemini-04):** "Agent Snapshot" sharing is the primary viral mechanism. When a developer solves a complex bug or generates an impressive feature with Nova26, they can share a public URL showing exactly how the agents collaborated to produce the result. This serves simultaneously as social proof, developer education, and product marketing.

**Combined flow:**
1. Developer runs `nova init` in existing project
2. Stack auto-detected, first PRD generated, agents assigned
3. Developer completes first meaningful task
4. "Share this build" prompt creates an Agent Snapshot
5. Snapshot URL shared on GitHub/Twitter/Discord becomes acquisition funnel

---

### Pattern I: Real-Time Cost Transparency
**Appears in:** Gemini-02 (UX Patterns), Gemini-04 (Monetization)
**Convergence strength:** Moderate (2/8 reports)

**UX implementation (Gemini-02):** Pattern #18 "Usage-Based Cost Transparency" proposes a persistent "Tokens/Cost Saved" counter in the IDE chrome. This counter shows:
- Total tokens processed in the current session
- Estimated cost if those tokens had been processed via cloud APIs
- Actual cost (typically $0 for local-first users)
- Net savings with a running total

**Strategic rationale (Gemini-04):** The cost counter is a retention mechanism. Every session reinforces the value proposition: "You saved $X.XX today by using Nova26 instead of [competitor]." This is particularly powerful for the Indie tier ($12/month) where users are price-sensitive. If they see they saved $47 in API fees this month, the $12 subscription fee becomes trivially justified.

**Implementation notes:**
- Counter should be subtle (ambient, not distracting) per Gemini-02 anti-pattern guidance
- Should use actual model pricing from Gemini-12 Model Intelligence Database
- Cumulative "lifetime savings" metric for long-term retention reinforcement

---

### Pattern J: Temporal Workflows & Replay
**Appears in:** Grok R23-01 (Persistent Visual Workflow), Grok Shannon Patterns
**Convergence strength:** Moderate (2/8 reports)

**Shannon foundation:** The Kocoro-lab/Shannon platform's Temporal workflow engine provides the reference architecture for durable execution with time-travel debugging and step-by-step replay. Every agent action is recorded as a workflow step that can be rewound, forked, and re-run with different parameters.

**R23-01 vision:** "Every task becomes a living film reel with scrubber, fork, re-run." This transforms Nova26's build process from a fire-and-forget operation into a cinematic experience where the developer can:
- **Scrub** back through the build timeline to see exactly when and why each decision was made
- **Fork** at any point to explore alternative approaches without losing the original
- **Re-run** from any checkpoint with modified parameters or different models

**Integration points:**
- Ralph Loop L1 orchestration layer
- Living Canvas timeline scrubber
- R21-03 audit trail compliance (every replay step is auditable)
- `src/orchestrator/workflow-engine.ts` and `src/atlas/replay-nle.ts`

**Interfaces:**
```typescript
interface WorkflowNode {
  id: string;
  agentId: string;
  action: string;
  input: unknown;
  output: unknown;
  timestamp: string;
  parentId?: string;  // for fork tracking
}

interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: { from: string; to: string; type: "sequential" | "fork" }[];
  checkpoints: string[];  // node IDs that can be re-run from
}
```

---

## Priority Matrix

### IMMEDIATE (0-8 weeks | Deadline-driven)

| Priority | Item | Rationale | Source Reports |
|----------|------|-----------|----------------|
| P0 | EU AI Act compliance framework | August 2, 2026 enforcement -- 5 months | Gemini-05, R23, Shannon |
| P0 | OTel tracing + immutable audit log | Foundation for all compliance | Gemini-05, Shannon |
| P0 | AIDecisionLog schema implementation | Required for Article 86 | Gemini-05 |
| P1 | Model routing + UCB learning router | 85-95% token savings, 2.5x throughput | Gemini-06, 12, R23, Shannon |
| P1 | Speculative decoding (Nemotron 3 Nano + Qwen 3.5) | Highest-impact performance gain | Gemini-06, Gemini-12 |
| P1 | Qwen 3.5 Coder integration | SOTA open model, 80.2% SWE-bench | Gemini-06, Gemini-12 |
| P2 | Confidence escalation pipeline | Cost optimization for all tiers | Gemini-06, Shannon |
| P2 | Circuit breaker fallback to local | Reliability guarantee | Shannon |

### SHORT-TERM (2-4 months | Feature-driven)

| Priority | Item | Rationale | Source Reports |
|----------|------|-----------|----------------|
| P1 | Persistent Visual Workflow Engine | "Biggest feel difference" per R23 | R23-01, Shannon |
| P1 | Infinite hierarchical memory (Mem0 hybrid) | "Biggest capability unlock" per R23 | R23-03, Gemini-02, Gemini-04 |
| P2 | React Native + Expo SDK 54 mobile launch | Time-sensitive: iOS 26 SDK April 2026 | Gemini-03, Gemini-04 |
| P2 | Taste Vault visualization (Personal Style Graph) | Key differentiator, Pro tier gate | Gemini-02, Gemini-04 |
| P2 | Zero-config `nova init` onboarding | Acquisition funnel foundation | Gemini-02, Gemini-04 |
| P3 | CRDT multi-device Taste Vault sync | Multi-device Pro feature | R23-08, Gemini-04 |

### MEDIUM-TERM (4-6 months | Growth-driven)

| Priority | Item | Rationale | Source Reports |
|----------|------|-----------|----------------|
| P2 | Cinematic Observability (Braintrust integration) | "Biggest quality unlock" per R23 | R23-05, Gemini-05 |
| P2 | Monetization launch ($12/$25/$45 tiers) | Revenue engine | Gemini-04 |
| P2 | Agent Snapshot sharing (viral loop) | Primary PLG acquisition mechanism | Gemini-04, Gemini-02 |
| P3 | Agent Debate & Swarm Layer | "Biggest creativity unlock" per R23 | R23-04, Gemini-02, Shannon |
| P3 | Tokens/Cost Saved counter | Retention reinforcement | Gemini-02, Gemini-04 |
| P3 | Compliance Dashboard for enterprise | CISO visibility, Team tier enabler | Gemini-05 |

### LONG-TERM (6-12 months | Scale-driven)

| Priority | Item | Rationale | Source Reports |
|----------|------|-----------|----------------|
| P3 | MicroVM / WASI Ultra-Sandbox (L3) | "Biggest enterprise unlock" per R23 | R23-02, Shannon |
| P3 | Full Shannon pattern integration | Production-grade orchestration | Shannon |
| P4 | Agent Skills Marketplace (70/30 rev share) | Ecosystem flywheel | Gemini-04 |
| P4 | Voice Command "Whisper" Mode | Accessibility, mobile UX | Gemini-02 |
| P4 | Guidance/Outlines structured output | Tighter safety guarantees | R23-06 |

---

## Model-to-Agent Mapping

### Primary Agent Roles (Recommended Feb 2026)

| Agent Role | Primary (Quality) | Fallback (Local) | Speed (Latency) | Budget (Cost) |
|---|---|---|---|---|
| **MARS / PLUTO** (Code + Security) | Qwen 3.5 Coder (397B-A17B) | DeepSeek-Coder | Phi-4 | Nemotron 3 Nano |
| **VENUS / EUROPA** (Design + Integration) | Kimi K2.5 | Qwen 3.5 VL | Gemini 3 Flash | GPT-4o-Mini |
| **MERCURY / CHARON** (Review + Debug) | Claude Sonnet 4.6 | Qwen 3.5 Coder | MiMo-V2-Flash | DeepSeek-R1 |
| **SUN / JUPITER** (PRD + Architecture) | Claude Opus 4.6 | GLM-5 | GPT-5.2 High | Qwen 3.5 397B |
| **EARTH** (Orchestrator) | Gemini 3.1 Pro | Qwen 3.5 Full | GPT-4.1 Mini | DeepSeek-V3.2 |
| **SATURN** (Planning) | GLM-5 | MiniMax M2.5 | GPT-4.1 Mini | DeepSeek-V3.2 |
| **NEPTUNE** (Data/Embedding) | Qwen3-Embedding | BGE-M3 | MiMo-V2-Flash | Nomic Embed V2 |
| **ATLAS** (Memory) | Voyage 3.5 | Qwen3-Embedding | MiMo-V2-Flash | Jina Embed V3 |
| **IO** (Real-time) | MiMo-V2-Flash | Nemotron 3 Nano | Xiaomi MiMo-V2 | Nova Micro |
| **GANYMEDE** (Testing) | MiniMax M2.5 | DeepSeek-V3.2 | GPT-4.1 Mini | DeepSeek-R1 |
| **ANDROMEDA** (GenUI) | Kimi K2.5 | Qwen 3.5 VL | Gemini 3 Flash | GPT-4o-Mini |
| **TRITON** (Collab) | Grok 4.1 | Qwen 3.5 VL | Grok 4.1 Fast | Claude Haiku 4.5 |
| **URANUS** (Innovation) | Gemini 3.1 Pro | Kimi K2 Thinking | Grok 4.1 Fast | DeepSeek-V3.1 |
| **TITAN** (Scaling) | GPT-5.2 High | GLM-5 | GPT-4.1 Mini | DeepSeek-V3.2 |
| **CALLISTO** (Portfolio) | Gemini 3 Pro | Claude Sonnet 4.6 | Gemini 3 Flash | GPT-4o-Mini |
| **ENCELADUS** (Perf) | GPT-5.2 Codex | Qwen 3.5 Coder | Nemotron 3 Nano | Phi-4 |
| **MIMAS** (Migration) | Gemini 3 Pro (10M ctx) | Llama 4 Scout | Claude Haiku 4.5 | Gemini 2.5 Flash |

### Speculative Decoding Pairs

| Draft Model | Verifier Model | Expected Throughput Gain | Use Case |
|---|---|---|---|
| Nemotron 3 Nano | Qwen 3.5 Coder | 2.5x | Code generation (MARS, PLUTO) |
| Phi-4 | Claude Sonnet 4.6 | 2.0x | Code review (MERCURY, CHARON) |
| GPT-4o-Mini | Kimi K2.5 | 1.8x | Design tasks (VENUS, ANDROMEDA) |
| DeepSeek-V3.2 | Claude Opus 4.6 | 2.2x | Architecture (JUPITER, SUN) |

### Hardware Tier Constraints

| Tier | Hardware | Max Active Params | Recommended Quantization | Context Window |
|---|---|---|---|---|
| Tier 1 | MacBook Air 16GB | 3-8B | Q4_K_M | 16,384 |
| Tier 2 | MacBook Pro 32GB+ | 17-32B (MoE active) | Q5_K_M | 32,768 |
| Tier 3 | RTX 4090 / RTX 5090 | 70-120B | Q6_K | 128,000 |
| Tier 4 | H100 / MI30x | 200B+ / full MoE | Q8_0 / FP16 | 256,000 |

---

## Recommended Tools & Libraries

### Compliance & Observability
| Tool | Purpose | Source Report | Priority |
|---|---|---|---|
| **OpenTelemetry JS SDK** | Distributed tracing, GenAI semantic conventions | Gemini-05, Shannon | P0 |
| **Braintrust** | CI/CD evaluation scoring, auto-optimization | R23-05 | P2 |
| **LangSmith** | Alternative observability (if Braintrust insufficient) | R23-05 | P3 |
| **OPA (Open Policy Agent)** | Policy-as-code for sandbox and compliance | Shannon, R23-02 | P3 |

### Model Serving & Routing
| Tool | Purpose | Source Report | Priority |
|---|---|---|---|
| **Ollama** | Local model serving, Modelfile configs | Gemini-06 | P0 |
| **llama.cpp** | Backend for Ollama, speculative decoding support | Gemini-06 | P0 |
| **vLLM** | High-throughput serving for Tier 3-4 hardware | Gemini-12 | P2 |
| **DSPy** | Prompt optimization and evaluation | R23-05 | P3 |

### Memory & State
| Tool | Purpose | Source Report | Priority |
|---|---|---|---|
| **Mem0** | Hybrid memory layer, 40ms recall | R23-03 | P1 |
| **Convex** | Real-time backend, reactive subscriptions | All reports | P0 (existing) |
| **ElectricSQL** | CRDT local-first sync for Taste Vault | R23-08 | P2 |
| **Graphiti / Zep** | Graph-based long-term memory (alternative to Mem0) | R23-03 | P3 |

### Mobile & Desktop
| Tool | Purpose | Source Report | Priority |
|---|---|---|---|
| **Expo SDK 54** | React Native build, OTA updates, universal linking | Gemini-03 | P2 |
| **Maestro** | YAML-based mobile E2E testing (90% less flaky) | Gemini-03 | P2 |
| **EAS Build + Submit** | Zero-config CI/CD for app stores | Gemini-03 | P2 |
| **AppScreens** | Automated multi-device screenshot generation | Gemini-03 | P3 |
| **Tauri v2** | Desktop app (existing Nova26 choice) | Shannon, R23 | P0 (existing) |

### Agent Orchestration
| Tool | Purpose | Source Report | Priority |
|---|---|---|---|
| **Temporal (patterns only)** | Durable execution, replay, time-travel debugging | Shannon, R23-01 | P1 |
| **CrewAI (patterns only)** | Role-based agent collaboration patterns | R23-04 | P3 |
| **OpenAI Agents SDK (patterns only)** | Swarm coordination patterns | R23-04 | P3 |

### Benchmarking
| Tool | Purpose | Source Report | Priority |
|---|---|---|---|
| **Nova-Bench (custom)** | Built-in benchmark: Convex mutation, wireframe-to-component, GH Action, race condition | Gemini-06 | P1 |
| **SWE-bench Verified** | External code generation benchmark | Gemini-12 | Reference |
| **ARC-AGI-2** | External reasoning benchmark | Gemini-12 | Reference |

---

## Actionable Next Steps

### Week 1-2: Compliance Foundation (P0)

1. **Implement OTel tracing layer** -- Instrument all 21 agents with OpenTelemetry GenAI semantic conventions. Every LLM call should produce a span with model ID, token counts, latency, and confidence score.
   - File: `src/observability/otel-tracing.ts`
   - Depends on: OpenTelemetry JS SDK v1.x

2. **Implement AIDecisionLog schema** -- Create the TypeScript interface from Gemini-05 and wire it into every agent's output pipeline. Each decision must record traceId, agentId, model metadata, decision reasoning, confidence score, and human action.
   - File: `src/compliance/ai-decision-log.ts`
   - Schema: See Pattern C above

3. **Create immutable trajectory log writer** -- Append-only JSONL writer at `.nova/audit/trajectory.jsonl` with data hashing for tamper detection. Every agent handoff (TASK_HANDOFF, DECISION, ESCALATION) produces a record.
   - File: `src/compliance/trajectory-writer.ts`

### Week 3-4: Model Routing Engine (P1)

4. **Build UCB learning router** -- Multi-armed bandit router that tracks model performance per task type and adaptively selects the optimal model. Initial state uses static mapping from Gemini-12; UCB exploration begins after 100 tasks per agent.
   - File: `src/model-routing/ucb-router.ts`
   - Interface: `{ selectModel(agentId, taskType, budget): ModelConfig }`

5. **Implement speculative decoding pipeline** -- Configure Ollama Modelfile pairs (Nemotron 3 Nano draft + Qwen 3.5 Coder verify) for code generation agents. Measure throughput gain against Nova-Bench Task A.
   - File: `src/model-routing/speculative-decoder.ts`
   - Target: 2.5x throughput improvement

6. **Add confidence escalation** -- Wrap every model call with confidence checking. If the model's output confidence falls below the configured threshold (default 0.7), automatically escalate to the next tier in the routing hierarchy.
   - File: `src/model-routing/confidence-escalation.ts`

7. **Implement circuit breakers** -- If a cloud model API fails 3 times in 60 seconds, trip the circuit breaker and route all requests to the local fallback model. Auto-reset after 5 minutes.
   - File: `src/model-routing/circuit-breaker.ts`

### Week 5-8: Memory & Workflow (P1-P2)

8. **Integrate Mem0 hybrid memory** -- Three-tier memory layer (core/short-term, archival/graph-vector, CRDT sync). Target 40ms recall latency. Gate infinite history behind Pro tier.
   - Files: `src/atlas/mem0-hybrid.ts`, `src/taste-vault/infinite-recall.ts`

9. **Build workflow replay engine** -- Temporal-inspired durable execution with checkpointing. Every agent action becomes a replayable workflow node with scrub, fork, and re-run capability.
   - Files: `src/orchestrator/workflow-engine.ts`, `src/atlas/replay-nle.ts`

10. **Implement Taste Vault Personal Style Graph** -- Visual representation of learned coding preferences. Interactive graph component for Living Canvas.
    - File: `src/taste-vault/style-graph.tsx`

### Week 9-12: Mobile & Monetization (P2)

11. **Initialize Expo SDK 54 mobile project** -- Follow TRITON agent pipeline for monorepo setup with expo-router, EAS Build, and Maestro testing infrastructure.
    - Pipeline: TRITON -> VENUS -> SATURN -> EUROPA -> GANYMEDE

12. **Implement pricing tiers** -- Wire $12/$25/$45 tier gates into agent and feature access. Indie: local agents + basic Taste Vault. Pro: cloud models + Graph Memory + unlimited Convex. Team: Agent Squads + audit logs + SSO.

13. **Build Agent Snapshot sharing** -- Public URL generation for completed builds showing agent collaboration timeline, decisions made, and code produced. Primary viral acquisition mechanism.

### Week 13+: Scale & Polish (P3-P4)

14. **Launch Cinematic Observability** -- Braintrust integration for automated evaluation scoring. "Dailies Room" tab in IDE showing per-run quality metrics.

15. **Implement Agent Debate layer** -- 5-agent debate rounds visible in Living Canvas with ghost cursors and branching proposal trees.

16. **Build MicroVM sandbox (L3)** -- Firecracker/gVisor/WASI upgrade for production-grade isolated code execution. OPA policy enforcement per workspace.

17. **Launch Agent Skills Marketplace** -- 70/30 revenue share platform for community-created agent templates and PRD recipes.

---

## Appendix: Source File Index

| # | File | Research Round | Key Contribution |
|---|------|----------------|------------------|
| 1 | `gemini-02-ux-patterns.md` | Gemini-02 | 20 must-steal UX patterns, anti-patterns |
| 2 | `gemini-03-mobile-ecosystem.md` | Gemini-03 | React Native + Expo SDK 54, Maestro testing, 5-agent mobile pipeline |
| 3 | `gemini-04-monetization-gtm.md` | Gemini-04 | $12/$25/$45 pricing, PLG viral loops, $1M ARR scenarios |
| 4 | `gemini-05-compliance.md` | Gemini-05 | EU AI Act framework, AIDecisionLog schema, OTel audit trails |
| 5 | `gemini-06-local-slm.md` | Gemini-06 | Ollama configs, speculative decoding, hardware tiers, Nova-Bench |
| 6 | `gemini-12-model-intelligence.md` | Gemini-12 | Complete model landscape, 21-agent mapping, benchmark schema |
| 7 | `grok-r23-gap-analysis.md` | Grok R23 | 8 enhancement proposals, gap prioritization |
| 8 | `grok-shannon-patterns.md` | Grok Shannon | Shannon reference architecture, UCB routing, Temporal patterns |

---

*Generated by Claude Opus 4.6 | February 19, 2026 | 10 cross-report patterns, 17 actionable next steps, 21 agent-model mappings*
