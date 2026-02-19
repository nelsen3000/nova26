# GROK-R19: Mobile Launch Stage, Deep Semantic Model & Studio Rules

> Assigned to: Grok
> Round: R19 (post-R18)
> Date issued: 2026-02-19
> Status: Active

---

## Context Brief

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. 2,642+ tests,
0 TypeScript errors, 105 test files, 17 R16/R17 feature modules. R18 specs covered: Dashboard
(R18-01), Deployment (R18-02), VS Code Extension (R18-03), Orchestrator Integration (R18-04),
Observability (R18-05).

**New context from your own research:**
- Rork validates prompt → mobile app → App Store in minutes using Expo + EAS
- JetBrains PSI (Program Structure Interface) proves deep semantic models are the #1 unlock
- Claude Code skills, JetBrains Project Rules, and Cursor Rules all prove "studio rules" are essential
- DSPy and LangGraph show programmatic prompt optimization is the next frontier
- ElectricSQL + Tauri prove local-first native desktop is achievable
- Relume + Uizard prove AI-native design → code workflows work at scale

**Current state:**
- 62 directories under src/, 21 agents, Ralph Loop orchestrator
- GraphMemory in taste-vault for per-user knowledge
- Living Canvas (R16-03) for generative UI
- Orchestration Optimizer (R17-12) for meta-learning
- Portfolio Intelligence (R16-01) for cross-project learning
- NO mobile output target. NO deep semantic model. NO studio rules system. NO prompt optimization.

**R19 mission:** Spec the three highest-leverage systems that make Nova26 feel alive, personal,
and capable of shipping to mobile stores in clicks. Each spec must be independently implementable
by a coding AI (Kimi) in a 5-task sprint.

**Your style:** Open each deliverable with a tight, concrete analogy. Then deep TypeScript
interfaces, file paths, integration points, CLI commands, open questions. No hand-waving.

---

## Deliverables

### GROK-R19-01: Mobile Launch Stage (Expo + EAS + Asset Generation + ASO)

**Scope:** A complete "prompt → mobile app → App Store/Google Play" pipeline inside Nova26.

**Must cover:**
1. **React Native + Expo as default mobile output** — how agents generate Expo-compatible code
2. **EAS Build + EAS Submit integration** — one-command cloud build for iOS and Android (no Mac required)
3. **Device preview** — QR code instant preview on physical device via Expo Go
4. **App Store asset generation pipeline:**
   - Icon generation (1024×1024, all sizes) using image generation API
   - Screenshot generation (device-framed, all required sizes for both stores)
   - Feature graphic (Google Play 1024×500)
   - All images auto-styled from Taste Vault aesthetic
5. **ASO (App Store Optimization) content generation:**
   - App title + subtitle (keyword-optimized, < 30 chars)
   - Full description (4000 chars, keyword-dense, benefit-focused)
   - Keywords list (100 chars for iOS)
   - What's New text
   - Privacy policy URL stub
   - Category recommendation
   - Age rating assessment
6. **Store submission metadata** — complete, copy-pasteable JSON for both App Store Connect and
   Google Play Console
7. **Localization** — auto-generate descriptions in top 5 languages
8. **CLI commands:**
   - `nova26 mobile init` — scaffold Expo project with Taste Vault theme
   - `nova26 mobile preview` — QR code for device preview
   - `nova26 mobile build --platform all` — trigger EAS build
   - `nova26 mobile assets` — generate all store images
   - `nova26 mobile aso` — generate all store text content
   - `nova26 mobile launch` — one command that does build + assets + aso + submit

**Integration points:**
- VENUS generates UI components as React Native
- MARS generates API layer as React Native compatible
- Living Canvas (R16-03) renders mobile preview in device frames
- Taste Vault provides the calm aesthetic for all generated assets
- Portfolio (R16-01) learns cross-project mobile patterns

**TypeScript interfaces needed:**
- `MobileLaunchConfig`, `StoreAsset`, `ASOContent`, `StoreSubmission`, `DevicePreviewSession`
- `MobileProjectScaffold` (extends Expo app.json schema)
- `AssetGenerationRequest`, `AssetGenerationResult`

**Open questions:**
- Should we support Flutter as an alternative to React Native?
- How do we handle native module requirements (camera, push notifications)?
- Should the ASO tool integrate with AppTweak/Sensor Tower APIs or be fully local?

---

### GROK-R19-02: Deep Project Semantic Model (ATLAS Intelligence Upgrade)

**Scope:** A rich, live semantic graph of the entire project that every agent can query — the
foundation for "the studio knows everything about your project."

**Must cover:**
1. **Semantic Graph structure** — nodes for files, functions, classes, types, imports, exports,
   tests, patterns, decisions. Edges for imports, calls, extends, tests, depends-on.
2. **Incremental indexing** — only re-index changed files (watch mode via fs.watch or chokidar)
3. **Query API** — agents query the graph with natural-language-like filters:
   - "Find all usages of PaymentService"
   - "Show me all calm UI patterns"
   - "What tests cover this function?"
   - "What changed since last build?"
4. **Integration with ts-morph** — use ts-morph (already in deps) for AST parsing
5. **Integration with GraphMemory** — merge semantic graph with Taste Vault knowledge graph
6. **Impact analysis** — "if I change this file, what else breaks?"
7. **Architecture extraction** — auto-generate dependency diagrams and module maps
8. **Agent context injection** — when an agent starts a task, automatically inject the relevant
   subgraph (only files, types, and patterns related to the task)
9. **Persistence** — store the graph in SQLite (better-sqlite3, already in deps)

**Integration points:**
- ATLAS becomes the "semantic brain" — all agents query through it
- `src/codebase/repo-map.ts` — existing repo map (upgrade to semantic)
- `src/similarity/semantic-dedup.ts` — use for deduplication
- `src/orchestrator/prompt-builder.ts` — inject semantic context into every prompt
- `src/taste-vault/graph-memory.ts` — merge knowledge graphs

**TypeScript interfaces needed:**
- `SemanticNode`, `SemanticEdge`, `SemanticGraph`, `SemanticQuery`, `SemanticQueryResult`
- `ImpactAnalysis`, `ArchitectureDiagram`
- `AgentContextSlice` (what a specific agent sees)

**Open questions:**
- How large can the graph get before queries slow down? Do we need pagination?
- Should we support languages other than TypeScript for the semantic model?
- How does the semantic model interact with the Portfolio cross-project graph?

---

### GROK-R19-03: Studio Rules & Prompt Optimization System

**Scope:** A living, versioned rules system that every agent automatically respects + DSPy-style
programmatic prompt optimization that makes agents systematically better over time.

**Must cover:**
1. **Studio Rules format** — `.novarc` or `.nova/rules.json`:
   - Style rules (calm aesthetic, typography, color palette)
   - Constitutional rules (no any types, always handle errors, etc.)
   - Quality thresholds (min ACE score, min test coverage)
   - Agent-specific overrides (VENUS gets extra UI rules, MARS gets API rules)
2. **Rules inheritance** — project rules < user rules < workspace rules
3. **Rules injection** — every agent prompt automatically includes relevant rules
4. **Rules enforcement** — Mercury validates rules compliance in quality gates
5. **DSPy-style prompt optimization:**
   - Track agent success/failure per task type
   - Automatically adjust prompt templates based on outcomes
   - A/B test prompt variants and measure ACE score differences
   - "Compile" better prompts from historical data
6. **Optimization loop:**
   - After each build, analyze which prompts produced highest ACE scores
   - Generate prompt variants with small modifications
   - Test variants on next similar task type
   - Promote winners, demote losers
   - All local, all private, all on-device
7. **CLI commands:**
   - `nova26 rules show` — display active rules
   - `nova26 rules add "always use TypeScript strict mode"`
   - `nova26 optimize status` — show current optimization progress
   - `nova26 optimize reset` — clear optimization history

**Integration points:**
- Taste Vault stores rules (they're a special type of Pattern node)
- `src/orchestrator/prompt-builder.ts` — inject rules into every prompt
- `src/ace/reflector.ts` — use ACE scores as optimization signal
- `src/orchestration/orchestration-optimizer.ts` — R17-12 meta-learning feeds optimization
- `src/agents/self-improvement.ts` — existing self-improvement protocol

**TypeScript interfaces needed:**
- `StudioRule`, `RuleSet`, `RuleInheritanceChain`, `RuleValidationResult`
- `PromptVariant`, `OptimizationExperiment`, `OptimizationResult`
- `PromptCompiler` (takes historical data, outputs optimized prompt templates)

---

## Output Format

Deliver all 3 specs in a single response. For each spec:
1. One-paragraph analogy
2. Complete TypeScript interfaces (every field documented)
3. File-by-file implementation plan
4. Integration points (exact file paths and function names)
5. CLI commands
6. Open questions
7. Test strategy (what to test, approximate test count)

Total expected output: ~12,000-18,000 words across all 3 specs.
