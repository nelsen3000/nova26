# GROK-R20: Orchestrator-Worker Architecture, Native Desktop & AI Design Pipeline

> Assigned to: Grok
> Round: R20 (post-R19)
> Date issued: 2026-02-19
> Status: Queued (deliver after R19)

---

## Context Brief

Nova26 is a 21-agent AI-powered IDE. After R19, the engine has: deep semantic model, mobile
launch stage, studio rules, prompt optimization. 2,800+ tests expected. All 17 R16/R17 features
wired into ralph-loop.ts with lifecycle hooks. Behavior system active.

**R20 mission:** Spec the three systems that make Nova26 feel like a native, professional-grade
creative studio — not just another CLI tool.

**Your style:** Same as always. Analogy → deep TypeScript → integration points → open questions.

---

## Deliverables

### GROK-R20-01: Orchestrator-Worker Architecture (L0/L1/L2/L3 Hierarchy)

**Scope:** Formalize the agent hierarchy into a proper L0 → L1 → L2 → L3 system, inspired by
levnikolaevich's Claude Code skills pipeline and Windsurf's Cascade multi-step flows.

**Must cover:**
1. **L0 Meta-Orchestrator (ATLAS)** — receives user intent, decomposes into projects
2. **L1 Orchestrators (SUN, Ralph Loop)** — receive projects, decompose into tasks, manage lifecycle
3. **L2 Coordinators (JUPITER, SATURN)** — receive multi-step tasks, delegate to specialists
4. **L3 Workers (VENUS, MARS, MERCURY, ENCELADUS, etc.)** — execute single focused tasks
5. **Context management** — each level loads ONLY the context it needs (progressive disclosure)
6. **Cascade-style flows:**
   - Plan → Validate → Execute → Review → Refine → Ship
   - Any step can loop back
   - User confirmation gates at Plan and Ship stages
7. **Parallel execution within levels** — L3 workers can run concurrently on independent tasks
8. **Error escalation** — L3 failure → L2 retry → L1 replan → L0 escalate to user
9. **Meta-learning** — L0 learns from every cascade to improve decomposition

**Integration points:**
- `src/orchestrator/ralph-loop.ts` — becomes the L1 runtime
- `src/atlas/` — becomes the L0 brain
- `src/orchestrator/lifecycle-hooks.ts` — hooks fire at each level transition
- `src/orchestration/orchestration-optimizer.ts` — R17-12 provides the meta-learning layer
- `src/agents/` — all 21 agents classified into L2/L3 roles

**TypeScript interfaces:**
- `AgentLevel`, `OrchestratorRole`, `CascadePhase`, `CascadeFlow`
- `ContextSlice` (what each level sees), `EscalationPolicy`
- `ParallelExecutionPlan`, `DependencyGraph`

---

### GROK-R20-02: Tauri Native Desktop Application

**Scope:** A native desktop wrapper for Nova26 using Tauri (Rust-based, lightweight, secure) that
gives Nova26 a first-class desktop presence alongside the CLI and VS Code extension.

**Must cover:**
1. **Tauri app shell** — wraps the Next.js dashboard (R18-01) in a native window
2. **System tray integration** — background agent monitoring, build status notifications
3. **Native file dialogs** — project open/save with OS-native feel
4. **Local-first sync** — ElectricSQL-style local Postgres + Convex sync when online
5. **Offline mode** — full functionality without internet (Ollama is local)
6. **OS integration:**
   - macOS: Spotlight search for Nova26 projects
   - Windows: Jump list with recent projects
   - Linux: Desktop file integration
7. **Auto-update** — Tauri's built-in updater for seamless version upgrades
8. **Performance** — near-zero overhead vs Electron (Tauri uses system webview)

**Integration points:**
- Dashboard (R18-01) rendered inside Tauri webview
- `src/cli/` — CLI commands invocable from Tauri IPC
- SQLite (better-sqlite3) for local state
- Convex for cloud sync

**TypeScript interfaces:**
- `TauriAppConfig`, `NativeNotification`, `SyncState`
- `ProjectFile`, `RecentProject`

---

### GROK-R20-03: AI-Native Design Pipeline (Relume + Uizard + Living Canvas)

**Scope:** Turn the Living Canvas from a code preview into a full AI-native design pipeline where
you describe a UI and get wireframes → components → interactive prototypes → production code.

**Must cover:**
1. **Prompt → Sitemap** — "calm fitness dashboard" → generates full page hierarchy
2. **Sitemap → Wireframes** — each page gets low-fidelity wireframe (ASCII or SVG)
3. **Wireframes → Components** — VENUS generates React/React Native components from wireframes
4. **Components → Interactive Prototype** — clickable prototype in Living Canvas
5. **Prototype → Production Code** — approved prototype becomes real code
6. **Style system** — all outputs respect Taste Vault aesthetic rules
7. **Variant generation** — generate 3 variants per page, let user pick
8. **Accessibility-first** — every generated UI passes WCAG AA from R17-06
9. **Device frames** — preview in iPhone, iPad, Android, desktop frames
10. **Export** — Figma JSON, SVG, React components, React Native components

**Integration points:**
- Living Canvas (R16-03) — the rendering surface
- VENUS — the UI generation agent
- Taste Vault — aesthetic rules
- R17-06 A11y — accessibility validation
- Mobile Launch Stage (R19-01) — mobile previews

**TypeScript interfaces:**
- `Sitemap`, `SitemapNode`, `Wireframe`, `WireframeElement`
- `DesignVariant`, `PrototypeSession`, `DesignExport`
- `DeviceFrame` (type, dimensions, safe areas)

---

## Output Format

Same as R18/R19: analogy, full TypeScript interfaces, file plan, integration points, CLI commands,
open questions, test strategy. ~12,000-18,000 words total.
