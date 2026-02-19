# GROK-R7: Nova26 Next-Priority Research Prompt

> Assigned to: Grok
> Round: R7 (post-R6)
> Date issued: 2026-02-18
> Status: Active

---

## Context Brief

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. The 21 agents
are named after celestial bodies (MARS, VENUS, MERCURY, JUPITER, SATURN, PLUTO, etc.) and
operate through a core execution engine called the Ralph Loop (`src/orchestrator/ralph-loop.ts`),
which drives a Generator -> Reflector -> Curator cycle (ACE) for iterative quality improvement.
Prompts are assembled in `src/orchestrator/prompt-builder.ts`.

Rounds R1-R6 covered: tool use, inner loop patterns, Living Taste Vault design, Global Wisdom
Pipeline, Premium Buyer Experience, ACE integration specs, ReAct prompts, error recovery, and
multi-agent debate.

**Current state of priorities:**
- Priority 1 (Living Taste Vault + Global Wisdom): Now assigned to Kimi, who is executing
  KIMI-VAULT-01 through KIMI-VAULT-06.
- Priority 2 (ACE Integration): Yours to spec in full — GROK-R7-01.
- Priority 3 (Rehearsal Stage): Yours to spec in full — GROK-R7-02.
- Priority 4+ (new research): GROK-R7-03 through R7-05 below.

**Pricing target:** $250-$500/month premium tier. Path A: Opt-In Global Wisdom Layer.

**Your style:** Open each deliverable with a big-picture analogy that makes the architecture
click instantly. Then go deep — TypeScript interfaces, method signatures, file structure, flow
diagrams in ASCII or prose. Every spec must be ready-to-code: a developer should be able to
pick it up without re-reading R1-R6.

---

## Deliverables

Label each section clearly: GROK-R7-01, GROK-R7-02, etc.

---

### GROK-R7-01: ACE Playbook System — Detailed Build Spec

**The ask:** ACE (Autonomous Coding Engine) runs a Generator -> Reflector -> Curator cycle.
Right now the cycle is stateless — each pass starts from scratch. Playbooks change that.
A Playbook is a structured recipe that tells the Generator how to approach a class of task,
the Reflector what criteria to apply, and the Curator how to weigh competing outputs. Playbooks
accumulate wins and losses over time, evolving from static templates into learned heuristics.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** Open with one paragraph that makes the Generator-Reflector-Curator-Playbook
   relationship instantly intuitive to a developer who has never read prior Grok rounds.

2. **Playbook data structure.** Provide the full TypeScript interface for a `Playbook`, including:
   - `id`, `name`, `version` fields
   - `taskTypes: string[]` — which task types this playbook applies to (e.g. `"ui-component"`,
     `"api-endpoint"`, `"schema-migration"`)
   - `generatorHints: string[]` — prompt fragments injected into the Generator's system prompt
   - `reflectorCriteria: ReflectorCriterion[]` — weighted evaluation dimensions
   - `curatorWeights: CuratorWeights` — how to rank candidate outputs
   - `outcomeHistory: PlaybookOutcome[]` — wins/losses used for evolution
   - `metadata: PlaybookMeta` — created, updated, author (agent or human), confidence score

3. **Supporting interfaces.** `ReflectorCriterion`, `CuratorWeights`, `PlaybookOutcome`,
   `PlaybookMeta` — all fully typed.

4. **Playbook selection algorithm.** How does the system pick the right playbook for a given task?
   Write the method signature and logic in pseudocode or TypeScript:
   ```typescript
   function selectPlaybook(task: Task, library: PlaybookLibrary): Playbook | null
   ```
   Cover: exact match on taskType, fuzzy match by agent name, fallback to default playbook,
   confidence threshold before a playbook is trusted enough to auto-apply.

5. **Generator integration.** How does a selected playbook modify the prompt that goes to the
   Generator? Show exactly where in `prompt-builder.ts` the injection happens — reference the
   real function `buildPrompt(task, prd)` and show the diff in pseudocode or annotated code.

6. **Reflector integration.** How does the Reflector use `reflectorCriteria` to score a
   Generator output? Show the scoring loop, the weighted sum formula, and the pass/fail threshold.

7. **Curator integration.** When multiple candidate outputs exist, how does the Curator use
   `curatorWeights` to pick the winner? Describe the ranking algorithm.

8. **Playbook evolution.** After a task completes (success or failure), how is `outcomeHistory`
   updated? How does the system detect that a playbook needs a version bump? Provide the method:
   ```typescript
   function recordOutcome(playbook: Playbook, outcome: PlaybookOutcome): Playbook
   function evolvePlaybook(playbook: Playbook): Playbook | null
   ```

9. **File structure.** Specify these four files with their exports:
   - `src/ace/playbook.ts` — all interfaces + `PlaybookLibrary` class
   - `src/ace/generator.ts` — `AceGenerator` class with playbook-aware prompt construction
   - `src/ace/reflector.ts` — `AceReflector` class with criterion-based scoring
   - `src/ace/curator.ts` — `AceCurator` class with weighted ranking

10. **Integration with ralph-loop.ts.** Show exactly where in the `processTask()` function
    the ACE cycle is invoked. What existing code is replaced or augmented? Reference line
    numbers from the real file (e.g., the LLM call block around line 700).

11. **Open questions for the build team.** List 3-5 questions that the developer implementing
    this will need to answer before writing the first line of code.

---

### GROK-R7-02: Rehearsal Stage — Detailed Build Spec

**The ask:** Before committing a change, an agent can spin up a "rehearsal" — a lightweight
sandbox where it explores 2-3 alternative implementations, scores them, and surfaces the winner
to the user for approval. Think of it as a director's cut workflow: shoot multiple takes, pick
the best one, only then go to print.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. Make the rehearsal concept click immediately —
   what problem does it solve, why does it belong in an AI IDE at the $250-$500/month tier,
   and how does it feel from the user's perspective?

2. **Rehearsal branch strategies.** Nova26 can use one of three strategies to create a
   rehearsal branch:
   - **Git worktree** (`git worktree add`): real filesystem isolation, full TypeScript
     compile available, higher overhead.
   - **In-memory diff**: store a `Map<filePath, content>` snapshot, apply proposed changes
     to the snapshot, run a virtual lint/type-check pass. Lower overhead, no real FS writes.
   - **Convex sandbox**: spin up a temporary Convex deployment for schema/mutation rehearsals.

   For each strategy: when to use it, how to create it, how to tear it down, estimated latency.

3. **Data structures.** Provide full TypeScript interfaces:
   - `RehearsalBranch` — id, strategy, files (Map or worktree path), createdAt, status
   - `RehearsalResult` — branchId, score, scoreBreakdown, summary, agentNotes
   - `RehearsalSession` — taskId, agentName, branches: RehearsalBranch[], results: RehearsalResult[], winner?: string, userApproved?: boolean

4. **Scoring algorithm.** How does Nova26 score a rehearsal branch? Design a `RehearsalScorer`
   that evaluates:
   - TypeScript compile pass (binary: 0 or 1)
   - Test suite delta (did tests improve, stay same, or regress?)
   - Code quality heuristics (line count delta, complexity estimate)
   - Agent self-assessment (the agent rates its own output 0.0-1.0)
   - Aesthetic alignment with Taste Vault profile (if available)

   Provide the `RehearsalScorer` class with a `score(branch: RehearsalBranch): RehearsalResult`
   method and the weighted formula for the final score.

5. **User approval flow.** When rehearsal completes, the user sees a structured summary.
   Design the approval UX as a text protocol (not a UI mock — text messages the system sends
   to the user's terminal or IDE panel):
   - Show: task name, number of branches rehearsed, winner with score, runner-up with score
   - Show: key differences between winner and runner-up (3 bullet points max)
   - Prompt: "Accept winner? (y/n/inspect)" — if inspect, show full diff
   - On accept: winner branch is committed. On reject: user picks a branch or aborts.

6. **Agent-initiated rehearsals.** Agents should be able to request a rehearsal before
   delivering final output. Design the protocol:
   ```typescript
   interface RehearsalRequest {
     taskId: string;
     agentName: string;
     reason: string;           // Why the agent wants a rehearsal
     strategyHint?: 'worktree' | 'in-memory' | 'convex';
     branchCount: number;      // How many alternatives to explore (2 or 3)
   }
   ```
   Where in the agent loop does the agent signal a rehearsal request? Show the integration
   point in `ralph-loop.ts` (reference the `processTask()` function).

7. **Cost/benefit gate.** Not every task deserves a rehearsal. Define the decision function:
   ```typescript
   function shouldRehearse(task: Task, context: RehearsalContext): boolean
   ```
   Inputs: task complexity score, task phase, agent confidence from prior turns, whether
   the task touches schema/migrations (high risk), whether a Taste Vault profile exists.
   Output rules: rehearse if complexity > threshold OR schema touched OR agent confidence < 0.7.

8. **File structure.** Specify:
   - `src/rehearsal/stage.ts` — `RehearsalStage` orchestrator class
   - `src/rehearsal/branch-manager.ts` — `BranchManager` with create/teardown per strategy
   - `src/rehearsal/scorer.ts` — `RehearsalScorer` class

9. **Integration with ralph-loop.ts.** Show the exact insertion point in `processTask()`.
   The rehearsal gate runs after the LLM call (around line 700-800) but before gate validation.
   Sketch the modified flow in pseudocode.

10. **Open questions for the build team.** List 3-5 questions.

---

### GROK-R7-03: Agent Self-Improvement Protocol

**The ask:** The Living Taste Vault (Kimi's work) captures user preferences. But agents also
need to learn from their own performance history — not just what the user liked, but what
approaches the agent itself tried, which ones passed gates, which ones failed, and how the
agent's style should shift as a result. This is the per-agent performance layer.

Produce a research spec (not necessarily ready-to-code, but interface-level complete) covering:

1. **The big-picture analogy.** One paragraph. What is "agent personality evolution" and why
   does it matter for a premium product?

2. **Per-agent performance profile.** Design the `AgentProfile` interface:
   - `agentName: string`
   - `totalTasks: number`, `successRate: number`, `avgGateScore: number`
   - `strongTaskTypes: string[]` — task types where this agent consistently excels
   - `weakTaskTypes: string[]` — task types where this agent struggles
   - `preferredApproaches: string[]` — prompting patterns that work for this agent
   - `avoidPatterns: string[]` — patterns correlated with gate failures
   - `styleAdaptations: StyleAdaptation[]` — user-specific style adjustments (verbose vs terse, etc.)
   - `lastUpdated: string`

3. **The self-improvement loop.** After every task completion (success or failure), what
   happens to the agent's profile? Show the update flow:
   - On success: which fields are strengthened, how confidence is updated
   - On failure: which failure modes are logged, how `avoidPatterns` grows
   - How `strongTaskTypes` and `weakTaskTypes` are computed from rolling history (window size?)

4. **Connecting to the Taste Vault.** The Taste Vault holds user preference nodes. Some of
   those nodes are about agent behavior ("I prefer when VENUS keeps components under 150 lines").
   How does the self-improvement protocol read from the Vault and write back to it?
   Design the sync interface:
   ```typescript
   interface AgentVaultSync {
     readUserPreferences(agentName: string, userId: string): StyleAdaptation[]
     writePerformanceSignal(agentName: string, signal: PerformanceSignal): void
   }
   ```

5. **StyleAdaptation and PerformanceSignal interfaces.** Fully typed.

6. **Influence on prompt-builder.ts.** How does the agent's profile modify the system prompt?
   Show where in `buildPrompt()` the agent profile is injected and what the injected text
   looks like (give an example for MARS and an example for VENUS).

7. **Profile persistence.** Where is the profile stored? Options: Convex (cloud, synced),
   local JSON file per agent (`.nova/profiles/MARS.json`), or in-memory with periodic flush.
   Recommend one approach with reasoning.

8. **Ethical guardrails.** What prevents the self-improvement loop from amplifying bad habits?
   (e.g., an agent that learns to write minimal code to pass gates but deliver poor quality).
   Design at least two safeguard mechanisms.

---

### GROK-R7-04: Real-Time Collaboration UX for Premium

**The ask:** A premium user at the $250-$500/month tier is paying for an experience, not just
output. When 21 agents are working on a build, the user should feel like they are in a
world-class creative studio — aware, in control, able to intervene. Design the UX layer.

Produce a research spec covering:

1. **The big-picture analogy.** One paragraph. What studio or production metaphor best captures
   the feeling of watching 21 agents build your product? Make it visceral.

2. **Live activity feed protocol.** Design the event schema that powers the live feed:
   ```typescript
   interface AgentActivityEvent {
     timestamp: string;
     agentName: string;          // e.g. "MARS"
     eventType: AgentEventType;  // see below
     subject: string;            // e.g. "Button.tsx"
     detail?: string;            // e.g. "Found 2 type errors on line 45"
     severity?: 'info' | 'warning' | 'error' | 'success';
   }

   type AgentEventType =
     | 'reading'
     | 'writing'
     | 'reviewing'
     | 'testing'
     | 'debating'      // multi-agent council vote
     | 'rehearsing'    // rehearsal stage
     | 'learning'      // taste vault update
     | 'blocked'
     | 'completed';
   ```
   Show 8-10 example events in the format the user would see in their terminal or IDE panel:
   ```
   [14:32:01] MARS      writing    Button.tsx         — Adding hover state variant
   [14:32:03] VENUS     reviewing  Button.tsx         — Checking accessibility props
   [14:32:05] MERCURY   testing    Button.test.tsx    — Running 12 test cases
   ```

3. **Sound design strategy.** Premium tools have audio feedback. Design a sound event map
   (text description — no audio files needed):
   - What sound plays when an agent completes a task?
   - What sound plays when the council reaches a unanimous verdict?
   - What sound plays when a gate fails?
   - What sound plays when the rehearsal stage surfaces a winner?
   - General principle: how does the sound palette stay calm and non-intrusive while still
     providing meaningful signal? Reference a known product that does this well.

4. **Director's Chair mode.** The user can pause, redirect, or veto agents mid-build.
   Design the command interface:
   ```
   /pause MARS                    — pause MARS after current task
   /redirect VENUS "use Tailwind v4 classes only"
   /veto TASK-07                  — cancel a running task
   /focus MERCURY                 — bring one agent's output to the foreground
   /resume all                    — resume all paused agents
   ```
   For each command: what state change happens in ralph-loop.ts? Which data structures need
   a `paused: boolean` or `directive: string` field added?

5. **Surfacing inner loop thinking.** When an agent is in its ReAct inner loop (reasoning
   before acting), the user can optionally see the scratchpad. Design the visibility modes:
   - **Silent** (default): user sees only completed outputs
   - **Summary**: user sees one-line summaries of each reasoning step
   - **Full**: user sees raw scratchpad content in real time

   How does the system switch between modes? What is the data path from
   `src/agent-loop/scratchpad.ts` to the user's terminal panel?

6. **Notification strategy.** Not every event warrants a notification. Design the notification
   tiers:
   - **Tier 1 (always notify):** gate failure, council rejection, build complete, budget alert
   - **Tier 2 (notify if user is watching):** task complete, rehearsal winner chosen
   - **Tier 3 (stream to feed only):** individual agent reads/writes

   How does the user set their notification threshold? Where is that preference stored?

7. **Mock UI concepts (text-based).** Describe three distinct screen states in plain text:
   - State A: Build in progress — 4 agents active, 2 waiting, 1 in rehearsal
   - State B: Council debate — 5 agents voting on an architectural decision
   - State C: Build complete — summary of all tasks, agents, time elapsed, cost

---

### GROK-R7-05: Competitive Moat Analysis

**The ask:** Nova26 is entering a crowded market. Cursor, Windsurf, Devin, GitHub Copilot
Workspace, and Replit Agent all claim to be AI-powered development tools. What makes Nova26
genuinely impossible to copy — or at least 3-5 years behind for a well-funded competitor to
replicate?

Produce a strategic analysis covering:

1. **The big-picture analogy.** One paragraph. What industry or historical product transition
   best captures what Nova26 is doing to the IDE market?

2. **Competitor breakdown.** For each competitor, provide a one-paragraph assessment covering:
   their current capability, their architectural approach (single LLM, multi-model, etc.),
   their pricing, and their key weakness relative to Nova26.

   Competitors to cover:
   - **Cursor** — the current market leader
   - **Windsurf** (Codeium) — the closest follower
   - **Devin** (Cognition) — the autonomous agent play
   - **GitHub Copilot Workspace** — the enterprise incumbent
   - **Replit Agent** — the cloud-native generalist

3. **Nova26's structural advantages.** For each advantage below, explain why it is a moat —
   i.e., why a competitor cannot simply copy it in 6 months:

   a. **21 specialized agents** — Each agent has a narrow, deep prompt engineered for one
      domain. The moat is: the prompt engineering investment + the organizational architecture
      + the inter-agent communication protocol. A competitor would need to replicate all three.

   b. **Living Taste Vault** — A private, personalized preference graph that improves with
      every build. The moat is: the data flywheel (each user's vault is unique and grows
      over time), plus the integration into every agent's prompt. A competitor starting today
      has zero vault data.

   c. **Global Wisdom Pipeline (Path A)** — Opt-in cross-user learning that improves all
      users when any user builds something great. The moat is: the network effect. Early
      adopters make the product better for everyone. A competitor needs N users before this
      kicks in; Nova26 builds the lead from day one.

   d. **Local-first + Ollama** — All inference can run on-device. The moat is: privacy,
      offline capability, and zero per-token cost at scale. A competitor built on cloud APIs
      cannot match this without a multi-year infrastructure investment.

   e. **ACE Playbook System** (if GROK-R7-01 is built) — Playbooks encode institutional
      knowledge about how to solve classes of problems. The moat is: accumulated wins/losses
      over thousands of builds. A competitor starts with empty playbooks.

4. **Replication cost estimate.** If a well-funded team (10 senior engineers, $10M budget)
   tried to replicate Nova26 from scratch today, estimate:
   - Time to replicate the 21-agent architecture: ? months
   - Time to replicate the Taste Vault with meaningful data: ? months (data moat)
   - Time to replicate the Global Wisdom flywheel with enough users to matter: ? months
   - Time to replicate ACE Playbooks with meaningful outcome history: ? months
   - Overall: how many months before a well-funded competitor is competitive?

5. **Pricing defensibility.** Explain why $250-$500/month is not only justified but is
   actually a bargain for the target buyer (CTO, lead engineer, senior indie developer):
   - What is the fully-loaded hourly cost of a senior developer in 2026?
   - How many hours per month does Nova26 realistically displace?
   - What is the ROI calculation at $500/month?
   - Why is $250/month the right floor? (Under-pricing risks)
   - Why is $500/month the right ceiling? (Over-pricing risks, market size implications)

6. **The elevator pitch.** Write one paragraph (5-7 sentences) that captures the full Nova26
   vision — what it is, who it is for, what makes it unique, and why it wins. This should be
   something a founder could say at a demo day or a sales call. It must:
   - Not mention "AI IDE" (too generic)
   - Name the Taste Vault, the 21-agent team, and the Global Wisdom layer
   - Convey the $250-$500/month value proposition
   - End on a forward-looking statement about where this is going

---

## Output Format

- Label each section clearly: `## GROK-R7-01`, `## GROK-R7-02`, etc.
- Begin each deliverable with the big-picture analogy paragraph before any technical content.
- Use TypeScript for all interfaces and method signatures.
- Use ASCII or prose for flow diagrams — no image dependencies.
- For code examples that reference real Nova26 files, use the actual file paths:
  - `src/orchestrator/ralph-loop.ts`
  - `src/orchestrator/prompt-builder.ts`
  - `src/agent-loop/scratchpad.ts`
  - `src/agent-loop/agent-loop.ts`
  - `src/memory/session-memory.ts`
  - `src/analytics/agent-analytics.ts`
- Each deliverable should be independently useful — a developer picking up GROK-R7-02
  should not need to read R7-01 first.
- Estimated output: 3,000-5,000 words per deliverable, 15,000-25,000 words total.

---

## Reference: Key Nova26 Types

For accuracy, here are the core types from `src/types/index.ts` that your specs should
build on or extend:

```typescript
// Agent names in the system
type AgentName = 'MARS' | 'VENUS' | 'MERCURY' | 'JUPITER' | 'SATURN' | 'PLUTO'
  | 'NEPTUNE' | 'URANUS' | 'EARTH' | 'IO' | 'GANYMEDE' | 'EUROPA' | 'CALLISTO'
  | 'TITAN' | 'ENCELADUS' | 'MIMAS' | 'TRITON' | 'CHARON' | 'ANDROMEDA'
  | 'ATLAS' | 'SUN';

// Task structure (used throughout ralph-loop.ts and prompt-builder.ts)
interface Task {
  id: string;
  title: string;
  description: string;
  agent: string;
  phase: string;
  status: 'pending' | 'ready' | 'running' | 'done' | 'failed';
  dependencies: string[];
  attempts: number;
  output?: string;
  todos?: TodoItem[];
  currentTodoId?: string;
}

// The autonomy spectrum
type AutonomyLevel = 1 | 2 | 3 | 4 | 5;

// Ralph Loop options (extend this for rehearsal and ACE features)
interface RalphLoopOptions {
  parallelMode?: boolean;
  concurrency?: number;
  autoTestFix?: boolean;
  maxTestRetries?: number;
  planApproval?: boolean;
  eventStore?: boolean;
  sessionMemory?: boolean;
  gitWorkflow?: boolean;
  costTracking?: boolean;
  budgetLimit?: number;
  convexSync?: boolean;
  agenticMode?: boolean;
  autonomyLevel?: AutonomyLevel;
  // TODO: add acePlaybooks?: boolean; rehearsalStage?: boolean;
}
```

---

## Coordination Note

Kimi is currently building KIMI-VAULT-01 through KIMI-VAULT-06 (Living Taste Vault).
Your specs in R7-03 (Agent Self-Improvement) and R7-04 (Real-Time Collaboration UX) should
reference Kimi's vault interfaces as a dependency — design your specs to plug into whatever
Kimi builds, not to replace it. When you reference the Vault in your specs, note explicitly:
"Integration point with KIMI-VAULT — sync interface TBD pending Kimi's output."

Claude Code (claude-sonnet-4-6) owns `src/orchestrator/`, `src/llm/`, and `convex/`.
Your new files (`src/ace/`, `src/rehearsal/`) land in new directories that have no current
owner — they are clean slate for whoever picks up the implementation.

---

*Prompt issued by Claude Code on 2026-02-18. Grok R7 output should be delivered to
`.nova/output/` or committed directly to the `grok/r7` branch for coordinator review.*
