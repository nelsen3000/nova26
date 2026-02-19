# GROK-R14: Nova26 Launch Readiness Research Prompt

> Assigned to: Grok
> Round: R14 (post-R13)
> Date issued: 2026-02-18
> Status: Active

---

## Context Brief

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. The 21 agents
are named after celestial bodies (MARS, VENUS, MERCURY, JUPITER, SATURN, PLUTO, ATLAS, etc.)
and operate through a core execution engine called the Ralph Loop (`src/orchestrator/ralph-loop.ts`),
which drives a Generator -> Reflector -> Curator cycle (ACE) for iterative quality improvement.

**Current state of the build:**
- R1-R13 covered: tool use, inner loops, Taste Vault, Global Wisdom Pipeline, ACE specs,
  Rehearsal Stage, Self-Improvement Protocol, Real-Time Collaboration, Security/Privacy,
  Ollama Model Strategy, Plugin Ecosystem, Team/Enterprise, CI/CD Integration, Advanced
  Analytics, Onboarding & Education, Error Recovery, Performance Optimization, Testing at
  Scale, Accessibility/i18n, Long-Term Architecture, Multi-Modal Vision, Voice Interface,
  Code Quality Benchmarks, Knowledge Graph Visualization, Autonomous Project Generation,
  Context7 Integration, Superpowers/Skills Framework, Retention Mechanics, Revenue/Pricing,
  Developer Relations/Community, Agent-to-Agent Communication Protocol, Predictive Task
  Decomposition with Learning, Code Understanding & Semantic Search, Adaptive Agent
  Personality & Communication Style, and Offline-First Architecture & Edge Computing.
- Kimi has built: inner loop, Taste Vault + Global Wisdom, ACE + Rehearsal + Self-Improvement,
  similarity engine, Convex real-time, security, model routing, analytics. Frontier sprint
  now active: agent communication, semantic search, predictive decomposition, personality,
  offline-first.
- Kiro has extracted 79+ patterns from both BistroLens and Nova26 codebases.
- 1445+ tests passing, 0 TypeScript errors.
- Premium pricing: $299/month. Local-first with Ollama.
- The product is approaching feature-completeness for a premium launch.

**R14 mission:** Grok has covered the full technical and business surface of Nova26 across
13 rounds — from raw architecture through genuinely frontier features. R14 shifts to a
different kind of depth: the unglamorous, high-leverage work that separates a product
that is technically complete from a product that is ready to charge $299/month to real
developers. Documentation, CLI polish, launch readiness, post-launch growth mechanics,
and brand identity. These are not afterthoughts — they are the interface between Nova26
and the world. The best product in the world fails at $299/month if a developer cannot
get it running in five minutes, cannot find what a command does, or cannot articulate why
it is worth more than GitHub Copilot. R14 is the final sprint before money changes hands.

**Your style:** Open each deliverable with a tight, concrete analogy that makes the
challenge click in one paragraph. Then go deep — concrete recommendations with rationale,
specific tooling choices, command-by-command CLI designs, word-for-word tagline candidates,
week-by-week sprint plans. Every spec must be independently actionable: a person picking
up any single deliverable should be able to execute it without reading R1-R13. Vague
strategy documents are not acceptable — specific, actionable outputs only.

---

## Deliverables

Label each section clearly: GROK-R14-01, GROK-R14-02, etc.

---

### GROK-R14-01: Developer Documentation & API Reference

**The ask:** A product without documentation is like a city without street signs — the
streets exist, the destinations are real, but a visitor who has never been there before
cannot navigate without a guide. A developer evaluating Nova26 at $299/month is not just
buying software; they are buying confidence that they can make it work, understand it
deeply, and get help when they are stuck. Documentation is that confidence made tangible.
The best documentation frameworks (Stripe, Vercel, Tailwind) do not just explain — they
accelerate: they get a developer from "I downloaded this" to "I shipped something with this"
in a single uninterrupted session, and they answer the next ten questions before the
developer thinks to ask them.

Produce a complete, actionable documentation plan covering:

1. **Documentation architecture.** Define the full documentation site structure:

   Nova26 docs should be organized around the developer journey, not the product's internal
   structure. Define the top-level navigation with page-by-page content outlines:

   ```
   /docs
   ├── Getting Started
   │   ├── Installation                  [install, first-time setup wizard]
   │   ├── Your First Build              [5-minute end-to-end: PRD to passing tests]
   │   ├── Understanding the Output      [reading agent logs, ACE scores, Taste Vault]
   │   └── What's Next                   [guides roadmap by goal]
   ├── Guides
   │   ├── Writing Great PRDs            [how task quality starts with PRD quality]
   │   ├── Working with the Taste Vault  [what gets saved, when, how to curate]
   │   ├── Configuring Agent Behavior    [autonomy levels, model routing, personality]
   │   ├── Offline & Edge Mode           [full-offline setup, edge mode config]
   │   ├── Team & Collaboration          [team vault, real-time builds, role config]
   │   └── Plugin Development            [Skills framework, marketplace submission]
   ├── Reference
   │   ├── CLI Reference                 [every command, every flag, every env var]
   │   ├── Agent Reference               [all 21 agents: role, strengths, config]
   │   ├── Configuration Reference       [.novarc, config.json, env vars, all options]
   │   ├── RalphLoopOptions              [every TypeScript option with description]
   │   └── Convex Schema Reference       [all tables, indexes, access patterns]
   ├── Architecture
   │   ├── Overview                      [how 21 agents + Ralph Loop + Taste Vault fit together]
   │   ├── The Ralph Loop                [Generator/Reflector/Curator cycle in depth]
   │   ├── ACE & Rehearsal Stage         [quality loop mechanics]
   │   ├── Global Wisdom Pipeline        [how patterns flow from local to cross-user]
   │   └── Data Flow Diagram             [request lifecycle from CLI to output]
   └── Troubleshooting
       ├── Common Errors                 [top 20 errors with causes and fixes]
       ├── Performance Issues            [slow builds, high memory, model latency]
       ├── Ollama Setup                  [model download, GPU config, version compatibility]
       └── Convex Sync Issues            [offline conflicts, failed syncs, data repair]
   ```

   For each major section, specify:
   - The single most important thing a developer must learn from that section
   - The assumed reader (novice to Nova26 vs. experienced developer exploring a specific feature)
   - The one action it should enable the developer to take that they could not take before

2. **Five-minute getting-started guide.** Write the complete, word-for-word prose for the
   "Your First Build" page. This is the most important page in the entire documentation site:
   it is what every trial user reads first, and it must result in a successful build or
   it will result in a churned user.

   The guide must:
   - Start with a prerequisite check (Node 20+, Ollama running, model pulled)
   - Include the exact commands to run, in order, with expected output for each
   - Include a sample PRD that produces a working build in under 5 minutes (suggest: a
     simple TypeScript utility — a `formatDate` function library with tests)
   - Show what the output looks like (agent logs, ACE loop completion, test results)
   - End with "what just happened" — a one-paragraph explanation of the Ralph Loop,
     Taste Vault, and ACE without requiring the developer to read the architecture docs first
   - Include a "something went wrong?" section pointing to the 3 most common first-run errors

3. **Architecture overview page.** Design the complete architecture documentation:

   The architecture overview must answer: "How does Nova26 actually work?"

   Include:
   - A prose-first explanation of the Ralph Loop cycle (Generator → Reflector → Curator)
     written for a developer who has never seen the codebase
   - An ASCII flow diagram showing a complete build request lifecycle:
     ```
     User submits PRD
       → JUPITER decomposes → Task[] created
       → For each task: AgentLoop runs (ReAct: reason → tool call → observe)
         → Tool calls: read_file, write_file, run_tests, search_code, etc.
         → ACE loop: Generator produces draft → Reflector critiques → Curator improves
         → Rehearsal Stage: output staged and validated before commit
       → PLUTO runs test suite → results fed back
       → SATURN reviews architecture integrity
       → VENUS reviews code quality
       → Taste Vault: patterns extracted and stored
       → Build complete: output + ACE score + Taste Vault delta
     ```
   - A table of all 21 agents: name, role, primary responsibility, typical tools used,
     when it is invoked
   - One paragraph on the Taste Vault: what it is, what it stores, how it improves over time
   - One paragraph on Global Wisdom: how local patterns become cross-user improvements
   - One paragraph on the Ralph Loop's relationship to Convex (sync) and Ollama (inference)

4. **Agent reference.** For each of the 21 agents, write a reference entry following this
   template:

   ```
   ## MARS

   **Role:** Primary code generator
   **Agent class:** IMPLEMENTOR
   **Invoked when:** A task requires writing, modifying, or refactoring TypeScript code

   **What MARS does:**
   MARS is the workhorse of the Ralph Loop. When a task involves code production,
   MARS receives the task description, the current codebase context (from the Taste
   Vault and blackboard), and the full tool list. It executes a ReAct loop: it reasons
   about what to write, calls `write_file` or `edit_file`, calls `run_tests` to verify,
   and iterates until the task passes its completion criteria.

   **Tools MARS uses most often:**
   - `read_file`, `write_file`, `edit_file` — primary code manipulation
   - `run_tests` — immediate feedback loop after every change
   - `search_code` — semantic search to understand existing patterns before writing
   - `read_taste_vault` — check house style before producing new code

   **MARS configuration:**
   - `model`: overrides the default model for MARS (default: `qwen2.5-coder:32b`)
   - `maxIterations`: maximum ReAct loop iterations (default: 12)

   **Strengths:** Deep TypeScript implementation, high test coverage, consistent style
   **Limitations:** MARS does not evaluate architectural trade-offs — that is SATURN's role
   **Works closely with:** VENUS (code review), PLUTO (test execution), SATURN (arch review)
   ```

   Write this entry for all 21 agents. Agents: MARS, VENUS, MERCURY, JUPITER, SATURN, PLUTO,
   NEPTUNE, URANUS, EARTH, IO, GANYMEDE, EUROPA, CALLISTO, TITAN, ENCELADUS, MIMAS, TRITON,
   CHARON, ANDROMEDA, ATLAS, SUN. For each, infer the role from its celestial body namesake
   and what such a role would logically cover in a 21-agent AI IDE.

5. **CLI reference format.** Define the standard format for every CLI command entry:

   ```
   ## nova26 build

   **Synopsis:** `nova26 build [options] <prd-file>`

   **Description:**
   Runs the Ralph Loop against the provided PRD file. JUPITER decomposes the PRD into
   tasks, each task is executed by the assigned agent, and the build completes when all
   tasks pass ACE criteria and the test suite is green.

   **Arguments:**
   - `<prd-file>` — path to a `.md` or `.txt` file containing the PRD

   **Options:**
   | Flag | Type | Default | Description |
   |------|------|---------|-------------|
   | `--autonomy` | `1-5` | `3` | Autonomy level (1=full approval, 5=fully autonomous) |
   | `--model` | `string` | `qwen2.5-coder:32b` | Ollama model to use |
   | `--parallel` | `boolean` | `false` | Enable parallel agent execution |
   | `--no-ace` | `boolean` | `false` | Skip the ACE quality loop |
   | `--dry-run` | `boolean` | `false` | Plan only; do not execute tasks |
   | `--output` | `path` | `.nova/output/` | Directory for build artifacts |

   **Exit codes:**
   - `0` — build completed successfully
   - `1` — build failed (test failures or ACE score below threshold)
   - `2` — configuration error (missing model, invalid PRD, etc.)
   - `130` — build interrupted by user (Ctrl-C)

   **Examples:**
   ```sh
   # Basic build
   nova26 build prd.md

   # Full autonomy, parallel execution
   nova26 build prd.md --autonomy 5 --parallel

   # Plan only — see what JUPITER would do, then approve
   nova26 build prd.md --dry-run
   ```

   **See also:** `nova26 status`, `nova26 vault`, `nova26 config`
   ```

   Define this format for every command in the recommended command inventory (see
   GROK-R14-02 for the full inventory list).

6. **Documentation hosting recommendation.** Evaluate three options and recommend one:

   **Option A: Mintlify**
   - Pros: MDX-native, built-in search (Algolia-powered), API reference generation from
     OpenAPI specs, beautiful defaults, used by Supabase, Resend, Trigger.dev
   - Cons: Vendor dependency, $150/month for team features, less control over custom layouts
   - Best for: Teams that want beautiful docs fast with minimal setup

   **Option B: Docusaurus**
   - Pros: Open source, fully customizable, React-based (Nova26 team likely knows React),
     versioning built in, Algolia integration easy, used by React, Jest, Docusaurus itself
   - Cons: More setup than Mintlify, defaults require design work, slower to ship first draft
   - Best for: Teams that want full control and plan to heavily customize

   **Option C: GitHub Pages + Nextra**
   - Pros: Free hosting, Next.js-based (very customizable), good Markdown support
   - Cons: Less polished defaults, no built-in search (need to add Algolia separately),
     smaller ecosystem than Mintlify or Docusaurus
   - Best for: Teams already deeply invested in the Next.js ecosystem

   **Recommendation with rationale:** Based on Nova26's profile (small team, $299/month
   premium positioning, TypeScript-native), provide a concrete recommendation with the
   specific rationale: which option ships the highest-quality docs fastest, which integrates
   best with the existing GitHub workflow, and which will scale to the enterprise docs that
   a team/organization tier will eventually require.

7. **Troubleshooting guide: top 20 errors.** For each of the top 20 most likely first-year
   errors, write an entry:

   ```
   ### Error: OLLAMA_NOT_RUNNING
   **Message:** `OllamaError: connect ECONNREFUSED 127.0.0.1:11434`
   **Cause:** Ollama is not running, or is running on a non-default port.
   **Fix:**
   1. Start Ollama: `ollama serve`
   2. Verify it is running: `curl http://localhost:11434/api/tags`
   3. If using a non-default port, set `OLLAMA_HOST=http://localhost:YOUR_PORT` in your
      shell or `.novarc`
   **See also:** [Ollama Setup guide]
   ```

   Cover the top 20 error categories: Ollama connectivity, model not found, Convex auth
   failure, out-of-memory during inference, test suite timeout, Taste Vault corruption,
   TypeScript compilation errors in agent output, ACE loop not converging, Rehearsal Stage
   failure, offline sync conflicts, missing environment variables, file permission errors,
   Git workflow conflicts, parallel execution deadlocks, rate limiting on Ollama, invalid
   PRD format, JUPITER decomposition timeout, Convex schema migration failure, node version
   mismatch, and corrupted `.nova/` directory.

8. **Open questions.** List 3-5 questions the build team must resolve: how to keep API
   reference docs in sync with the TypeScript source without manual updates (consider
   TypeDoc or tsdoc-based generation); how to handle documentation for features that are
   behind feature flags (adaptive personality, agent-to-agent protocol) that are not
   yet exposed by default; whether to version the docs alongside the codebase or maintain
   a single "latest" doc site; and how to localize docs for the international expansion
   planned in month 5 (GROK-R14-04).

---

### GROK-R14-02: CLI Polish & Developer Experience

**The ask:** A CLI is not just a way to run a program — it is the entire relationship a
developer has with the product. The Stripe CLI is famous not for its functionality but for
how it feels: every error message tells you exactly what went wrong and what to do next,
every command is discoverable through `--help`, every output is legible at a glance. The
Vercel CLI makes deployment feel like publishing a tweet. When a developer uses Nova26
to build software, the CLI is Nova26. A rough CLI at $299/month communicates one thing:
this product is not finished. A polished CLI communicates the opposite: every detail was
considered, and this is what you are paying for.

Produce a complete CLI design specification covering:

1. **Command inventory.** Define every command that should exist in the Nova26 CLI:

   ```
   nova26 init             # Initialize a new Nova26 project in the current directory
   nova26 build <prd>      # Run the Ralph Loop against a PRD file
   nova26 run <task>       # Run a single named task (bypasses JUPITER decomposition)
   nova26 status           # Show system status: Ollama, Convex, pending sync, last build
   nova26 vault            # Taste Vault management subcommands
   nova26 vault list       # List patterns in the local vault (with filters)
   nova26 vault show <id>  # Show a specific pattern with full details
   nova26 vault delete <id># Remove a pattern from the vault
   nova26 vault export     # Export vault to JSON for backup or transfer
   nova26 vault import     # Import patterns from a JSON export
   nova26 config           # Configuration management subcommands
   nova26 config get <key> # Show a config value
   nova26 config set <key> <value>  # Set a config value
   nova26 config list      # Show all config values with their current state
   nova26 config personality       # Interactive personality preference wizard
   nova26 config wizard    # Full interactive setup wizard (for init and re-setup)
   nova26 agents           # Agent management subcommands
   nova26 agents list      # List all 21 agents with status and current model
   nova26 agents logs <name>       # Show recent logs for a specific agent
   nova26 agents reset <name>      # Reset an agent's personality profile
   nova26 models           # Model management subcommands
   nova26 models list      # List available Ollama models and which agents use them
   nova26 models pull <model>      # Pull a model via Ollama (convenience wrapper)
   nova26 models recommend # Recommend models based on available hardware
   nova26 index            # Code index management
   nova26 index build      # Build the semantic code index for the current project
   nova26 index status     # Show index freshness and unit count
   nova26 index clear      # Clear and rebuild the code index
   nova26 sync             # Manual sync to Convex (normally automatic)
   nova26 sync status      # Show sync state: pending changes, last sync time, conflicts
   nova26 sync --resolve   # Interactive conflict resolution
   nova26 test             # Run the Nova26 test suite for the current project
   nova26 upgrade          # Upgrade Nova26 to the latest version
   nova26 doctor           # Diagnose common setup problems and suggest fixes
   nova26 logs             # Show build logs (last build by default)
   nova26 logs --build <id># Show logs for a specific build
   nova26 skills           # Skills/plugin management
   nova26 skills list      # List installed skills
   nova26 skills install <name>    # Install a skill from the marketplace
   nova26 skills uninstall <name>  # Remove an installed skill
   nova26 skills publish   # Publish a skill to the marketplace
   ```

   For each command group, specify:
   - The primary use case (what developer goal does this command serve?)
   - The most important flag (the one flag every user of this command will eventually need)
   - The expected output format (table, JSON, human prose, spinner + completion message)

2. **Output design system.** Define the complete visual language for CLI output:

   **Colors (use chalk or picocolors — specify which and why):**
   ```
   Success green:   #22c55e  (use for: completed tasks, tests passing, sync success)
   Warning amber:   #f59e0b  (use for: degraded features, near limits, slow performance)
   Error red:       #ef4444  (use for: failures, connectivity errors, invalid config)
   Info blue:       #3b82f6  (use for: informational messages, progress context)
   Muted gray:      #6b7280  (use for: timestamps, IDs, secondary information)
   Accent violet:   #8b5cf6  (use for: Nova26 brand accents, agent names)
   ```

   **Agent name rendering:** All 21 agent names should be rendered in accent violet with
   bold weight. Agent names are proper nouns in Nova26 — they should feel like characters,
   not tokens.

   **Progress bars:** Use `cli-progress` for multi-task builds. Show:
   - Overall build progress (tasks completed / total)
   - Current task: agent name + task title (truncated to terminal width)
   - Elapsed time and estimated remaining time

   **Spinners:** Use `ora` for single-operation waits. Standard spinner text:
   ```
   [JUPITER] Decomposing PRD...
   [MARS] Writing src/utils/format-date.ts...
   [PLUTO] Running test suite...
   [VENUS] Reviewing code quality...
   [ACE] Iteration 2/3 — improving output...
   ```

   **Build completion summary:** Define the exact output format for a completed build:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Build complete  12 tasks  ·  47 tests passing  ·  2m 14s
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ACE Score       9.2 / 10
   Taste Vault     +3 patterns learned
   Model           qwen2.5-coder:32b (Ollama local)
   Build ID        bld_01j9k2...

   Next: nova26 vault list  ·  nova26 logs  ·  nova26 build another.md
   ```

   **Error output:** Define the non-negotiable rules for error messages:
   - Never print a raw stack trace to stdout (write to `.nova/logs/error.log` instead)
   - Every error message has three parts: what happened, why it happened, what to do
   - Every error message ends with a `See also:` link to the relevant troubleshooting doc
   - Show a compact "error ID" that can be pasted into GitHub Issues or support tickets

   ```
   ERROR  nova26/ollama-not-running

   Ollama is not responding at http://localhost:11434.
   Nova26 requires Ollama to run inference locally.

   To fix:
     1. Start Ollama:   ollama serve
     2. Verify it runs: curl http://localhost:11434/api/tags

   If Ollama is running on a different port, set:
     OLLAMA_HOST=http://localhost:YOUR_PORT

   See also: https://nova26.dev/docs/troubleshooting/ollama-setup
   Error ID: ERR_OLLAMA_CONN_REFUSED (build: none, time: 2026-02-18T14:32:01Z)
   ```

3. **Interactive setup wizard.** Design the complete first-run wizard experience:

   The wizard runs automatically on `nova26 init` and can be re-run with `nova26 config wizard`.
   It must be completable in under 3 minutes and result in a working configuration.

   ```
   Welcome to Nova26.
   I'll help you get set up in about 3 minutes.

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Step 1/5 — Checking prerequisites
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Node.js 20.11.0          OK
    Ollama                   OK  (v0.3.6)
    qwen2.5-coder:32b        Not found

   The recommended code model is qwen2.5-coder:32b (19GB).
   Would you like me to pull it now? This takes 5-15 minutes.
   [Y]es, pull now  [N]o, I'll do it later  [L]ight mode (smaller model)

   (L) → What model should I use instead? (llama3.2:8b, 5GB, faster but less capable)
         [Y]es, use llama3.2:8b  [Enter model name manually]
   ```

   Define all 5 wizard steps:
   - Step 1: Prerequisite check (Node, Ollama, recommended model)
   - Step 2: Project setup (project name, description, language/framework, directory)
   - Step 3: Autonomy level (show a clear description of each level 1-5 with examples)
   - Step 4: Convex setup (optional — skip for edge mode, configure for team features)
   - Step 5: Final summary (show all choices, confirm, write `.novarc`, open docs)

   The wizard must handle every common failure gracefully: Ollama not running (offer to
   open setup docs), network unavailable for model pull (offer to continue with a model
   already present), Convex credentials invalid (offer to skip and use local-only mode).

4. **Shell completions.** Specify the completions implementation:

   - **Generator:** Use `yargs` with its built-in `--get-yargs-completions` flag, or
     recommend `@fig/autocomplete-tools` for richer completions. Specify which and why.
   - **Installation instructions for each shell:**
     ```sh
     # bash (~/.bashrc)
     eval "$(nova26 completion bash)"

     # zsh (~/.zshrc)
     eval "$(nova26 completion zsh)"

     # fish (~/.config/fish/config.fish)
     nova26 completion fish | source
     ```
   - **What gets completed:** all commands, all flags, and context-sensitive completions
     for arguments (e.g., `nova26 vault show [TAB]` completes with actual vault pattern IDs;
     `nova26 agents logs [TAB]` completes with the 21 agent names; `nova26 models pull [TAB]`
     completes with available Ollama models from `ollama list`)
   - Specify which arguments support context-sensitive completion and how the completion
     script fetches live data (shell out to `nova26 _complete --context <command>`)

5. **The `.novarc` file.** Design the project-level configuration file:

   ```yaml
   # .novarc — Nova26 project configuration
   # This file is project-specific and should be committed to git.
   # Secrets belong in environment variables, never in .novarc.

   project:
     name: "my-saas-app"
     description: "A multi-tenant SaaS with Next.js and Convex"

   build:
     autonomyLevel: 3          # 1-5: how much approval the build requires
     parallelMode: false        # enable parallel agent execution
     maxTestRetries: 3          # retry failing tests before giving up
     aceEnabled: true           # run the ACE quality loop
     rehearsalStage: true       # stage outputs before committing

   models:
     default: "qwen2.5-coder:32b"
     agents:
       MARS: "qwen2.5-coder:32b"   # override model for a specific agent
       VENUS: "llama3.2:8b"        # lighter model for review tasks

   vault:
     globalWisdom: true            # contribute patterns to Global Wisdom
     autoExtract: true             # automatically extract patterns after each build

   offline:
     edgeMode: false               # set true for air-gapped environments
     syncIntervalSeconds: 300      # how often to sync to Convex

   personality:
     verbosity: "concise"          # minimal | concise | standard | detailed | exhaustive
     technicalDensity: "expert"    # plain-english | intermediate | expert | terse-expert
   ```

   Specify:
   - Which settings belong in `.novarc` (project-scoped, safe to commit) vs.
     `~/.nova26/config.json` (user-scoped, cross-project) vs. environment variables
     (secrets and deployment-specific overrides)
   - The precedence order: env vars > user config > project .novarc > defaults
   - A JSON schema for `.novarc` so IDEs can provide autocomplete and validation
   - The `.novarc` should be auto-generated by `nova26 init` with sensible defaults
     and inline comments explaining each option

6. **`nova26 doctor` command.** Design the full diagnostic experience:

   `nova26 doctor` is the single most important developer-experience command for a CLI
   at this complexity level. It should check and report on everything:

   ```
   nova26 doctor

   Running diagnostics...

   System
     Node.js 20.11.0         OK
     npm 10.2.4              OK
     OS: macOS 15.2          OK

   Ollama
     Status                  OK  (running at http://localhost:11434)
     qwen2.5-coder:32b      OK  (19.1GB, last used 2h ago)
     nomic-embed-text        OK  (274MB)
     llama3.2:8b            MISSING  (optional, used by VENUS — pull with: ollama pull llama3.2:8b)

   Nova26
     Version                 0.9.2
     Config file             OK  (.novarc found and valid)
     Taste Vault             OK  (SQLite, 247 patterns, 1.2MB)
     Code index              STALE  (last built 3 days ago — run: nova26 index build)
     Pending sync            14 changes  (run: nova26 sync to push to Convex)

   Convex
     CONVEX_URL              OK  (configured)
     Connection              OK  (reachable, latency: 42ms)
     Auth                    OK

   Environment
     NOVA26_EDGE_MODE        not set  (default: disabled)
     NOVA26_LOG_LEVEL        not set  (default: info)

   Recommendations
     1. Pull llama3.2:8b for better VENUS performance:
        ollama pull llama3.2:8b
     2. Rebuild code index (stale by 3 days):
        nova26 index build
     3. Push 14 pending changes to Convex:
        nova26 sync
   ```

   Specify the full checklist for `nova26 doctor` — every check, its failure condition,
   the message to display, and the remediation command to suggest.

7. **Achieving Stripe/Vercel CLI polish.** List 10 specific design rules that separate a
   polished CLI from a functional one:

   For each rule, give one bad example (what a typical CLI does) and one good example
   (what Nova26's CLI should do):

   - Rule 1: Every error suggests its own fix.
   - Rule 2: Long operations show real-time progress, not silence.
   - Rule 3: Successful operations confirm what happened, briefly.
   - Rule 4: `--help` is comprehensive but scannable in 30 seconds.
   - Rule 5: Interactive prompts have sensible defaults (press Enter to accept the default).
   - Rule 6: Commands are composable with pipes (JSON output mode via `--json` flag).
   - Rule 7: The CLI never crashes silently — all unhandled errors are caught and reported.
   - Rule 8: Environment variables are documented inline in `--help` output.
   - Rule 9: The wizard never asks a question whose answer the CLI can detect automatically.
   - Rule 10: Breaking changes in CLI commands follow a deprecation cycle, not silent removal.

8. **Open questions.** List 3-5 questions the build team must resolve: which CLI framework
   to use (yargs, commander, oclif — evaluate trade-offs for this specific use case);
   how to handle Windows support (WSL recommended vs. native PowerShell — document the
   support tier clearly); how to test CLI output in CI without brittle snapshot tests;
   and how to handle terminal width detection for progress bars and summary boxes.

---

### GROK-R14-03: Launch Readiness Checklist

**The ask:** Launching a $299/month developer tool without a checklist is like performing
surgery with a pre-flight pilot's manual — the individual steps are known, but without
a structured protocol, something critical gets skipped at exactly the wrong moment. The
best launch checklists are not reminders of obvious tasks; they are the accumulated wisdom
of every launch that went badly before, translated into gates that must be passed before
money changes hands. A developer paying $299/month on day one will have their entire
opinion of the product formed in the first 30 minutes — by whether the install worked,
whether the first build succeeded, whether the error message made sense, and whether
support responded quickly when something went wrong.

Produce a complete launch readiness specification covering:

1. **Technical readiness gates.** Define the specific, measurable criteria that must be
   true before launch:

   ```
   TECHNICAL GATES — must all be green before launch

   [ ] Test coverage ≥ 80% across src/
       Current: 1445 tests. Measure with: npx jest --coverage
       Acceptable: lines ≥ 80%, branches ≥ 75%, functions ≥ 85%

   [ ] TypeScript: 0 errors in strict mode
       Command: tsc --strict --noEmit
       Current state: confirmed 0 errors

   [ ] End-to-end build test: 5 representative PRDs run successfully
       PRDs: (1) TypeScript utility library, (2) REST API, (3) Next.js page,
             (4) CLI tool, (5) data transformation script
       Criterion: all 5 complete with ACE score ≥ 8.0 and tests passing

   [ ] Performance benchmark: median build time ≤ 5 minutes on reference hardware
       Reference hardware: Apple M2, 16GB RAM, qwen2.5-coder:32b via Ollama
       Measure: run each of the 5 E2E PRDs 3 times, take median

   [ ] Offline mode verified: full build completes with no network connection
       Test procedure: disable Wi-Fi + Ethernet, run `nova26 build` on a simple PRD
       Criterion: build completes, Taste Vault writes succeed, output is correct

   [ ] Security: no secrets in codebase, no plaintext API keys in logs
       Tool: `trufflehog filesystem .` — must return 0 findings
       Manual: review all log outputs for key patterns

   [ ] Dependency audit: 0 high or critical npm vulnerabilities
       Command: npm audit --audit-level=high
       Criterion: 0 high/critical; low/moderate documented and accepted

   [ ] Error handling: all identified error paths return structured errors (never crashes)
       Test: run `nova26 doctor` with Ollama stopped — must show friendly error, not stack trace
       Test: run `nova26 build` with invalid PRD file — must show friendly validation error

   [ ] Documentation: all commands documented in CLI reference
       Test: run `nova26 [command] --help` for every command — must show description + options

   [ ] Install test: fresh install works on macOS, Linux (Ubuntu 22.04), and Windows (WSL2)
       Procedure: use a clean VM for each platform; follow the getting-started guide exactly
       Criterion: first build succeeds within 10 minutes of starting the guide
   ```

2. **Legal readiness gates.** Define the specific legal documents and compliance states:

   ```
   LEGAL GATES

   [ ] Terms of Service — written, reviewed by lawyer, published at nova26.dev/terms
       Must cover: subscription terms, cancellation policy, refund policy, acceptable use,
       intellectual property (who owns the code Nova26 generates?), limitation of liability,
       data handling for local-first model (what data leaves the machine?)

   [ ] Privacy Policy — written, reviewed, published at nova26.dev/privacy
       Must cover: what data is collected (telemetry, usage analytics), what data stays
       local (Taste Vault, build history), what data goes to Convex (if any), GDPR rights
       (access, deletion, portability), data retention policy

   [ ] GDPR compliance — for EU users
       Required: lawful basis for any data processing, data processing agreement (DPA)
       with Convex (they process data on your behalf), cookie consent if marketing site
       uses analytics, right-to-erasure procedure documented and implemented

   [ ] Data Processing Agreement with Convex
       Convex provides a standard DPA — ensure it is signed and covers the data Nova26
       stores in Convex (build logs, patterns, usage data). If Nova26 stores any PII in
       Convex, this is mandatory.

   [ ] Intellectual property — generated code ownership
       The Terms of Service must explicitly state: "Code generated by Nova26 belongs to
       the user. Anthropic/Nova26 makes no claim on generated outputs." This is a purchase
       blocker for enterprise users.

   [ ] Open source licenses — review all dependencies
       Command: `npx license-checker --summary`
       Criterion: no GPL/AGPL dependencies in the production bundle (these require
       open-sourcing Nova26 if distributed). MIT, Apache 2.0, BSD are acceptable.
   ```

3. **Infrastructure readiness gates.** Define the production setup requirements:

   ```
   INFRASTRUCTURE GATES

   [ ] Convex production deployment
       - Separate production and staging environments (never test on production Convex)
       - Production environment variables documented in a secure secrets manager
         (not in .env files in the repository)
       - Convex backup strategy: scheduled exports to S3 (Convex supports this natively)
       - Database migration path tested from current schema to production schema

   [ ] Error monitoring
       - Sentry (or equivalent) integrated for server-side and CLI errors
       - Error budget defined: how many errors per day is "acceptable"?
       - PagerDuty/alerting configured for P0 errors (Convex down, Ollama connectivity)
       - Dashboard created with key health metrics: build success rate, error rate by type

   [ ] Analytics instrumentation
       - PostHog (self-hosted for privacy) or Segment configured
       - Event schema defined (see analytics section below)
       - Key dashboards created before launch: daily active users, builds per user,
         feature adoption, error rate, churn indicators
       - Privacy-preserving telemetry: opt-out available; no PII in events

   [ ] Billing — Stripe integration
       - Stripe Billing configured for $299/month subscription
       - Trial period defined: recommend 14-day free trial (no card required to start,
         card required to continue after 14 days)
       - Cancellation flow: must be possible without contacting support (legal requirement
         in several US states and required by Stripe's terms)
       - Failed payment handling: 3 retry attempts over 7 days → subscription paused,
         not immediately deleted (allows user to fix payment method)
       - Refund policy: recommend 30-day money-back guarantee for new subscribers
         (reduces purchase anxiety at $299/month significantly)

   [ ] Support infrastructure
       - Bug report template on GitHub Issues (or Linear)
       - Feature request process (separate label from bugs)
       - First-response time SLA defined (recommend: 24h for billing/security,
         72h for bugs, 1 week for feature requests)
       - Status page: statuspage.io or similar — shows Convex health, Ollama releases,
         known issues
   ```

4. **Analytics: what to track from day 1.** Define the complete event schema:

   ```typescript
   // Core events to instrument before launch

   // User lifecycle
   'user_signed_up'          // { plan: string, source: string }
   'user_activated'          // first successful build — most important activation metric
   'user_churned'            // subscription cancelled — { reason: string, buildCount: number }
   'trial_converted'         // trial → paid subscription

   // Build events
   'build_started'           // { prdLength: number, model: string, autonomyLevel: number }
   'build_completed'         // { durationMs: number, taskCount: number, aceScore: number,
                             //   testsTotal: number, testsPassed: number }
   'build_failed'            // { errorType: string, phase: string }

   // Feature adoption
   'taste_vault_viewed'      // user is engaging with vault
   'taste_vault_pattern_deleted'   // user is curating (high-value engagement)
   'global_wisdom_contributed'     // pattern promoted to Global Wisdom
   'parallel_mode_enabled'         // user is power-using
   'edge_mode_enabled'             // privacy-sensitive user segment
   'skills_installed'        // { skillName: string }

   // CLI health
   'command_run'             // { command: string, flags: string[], durationMs: number,
                             //   success: boolean }
   'error_encountered'       // { errorCode: string, command: string }
   'doctor_run'              // { issuesFound: number, issuesResolved: number }
   ```

   Define:
   - What is the activation event? (`build_completed` with `aceScore ≥ 7.0` and
     `testsPassed > 0` — a build that produced working code)
   - What is the leading indicator of churn? (No `build_started` event in 7 days from a
     previously active user — trigger a re-engagement email at day 7)
   - What MRR target makes Nova26 sustainable? (Define the break-even model: at $299/month,
     how many users cover Anthropic API costs if any, Convex costs, and 1 FTE salary?
     Target for sustainable solo operation: 20 users = $5,980 MRR. Target for 2-person
     team: 50 users = $14,950 MRR. First year goal: 100 users = $29,900 MRR.)

5. **Two-week launch sprint plan.** Define a concrete day-by-day plan:

   ```
   WEEK 1 — Polish & Verification

   Day 1 (Mon):  Run full E2E test suite on 5 representative PRDs. Document failures.
   Day 2 (Tue):  Fix critical E2E failures. Run npm audit. Resolve high/critical CVEs.
   Day 3 (Wed):  CLI polish pass: test every command + --help output. Fix rough edges.
   Day 4 (Thu):  Install test on Linux (Ubuntu 22.04 VM). Fix any platform issues.
   Day 5 (Fri):  Offline mode + edge mode verification. nova26 doctor coverage pass.

   WEEK 2 — Launch Infrastructure

   Day 6 (Mon):  Documentation site live (Mintlify/Docusaurus). Getting-started guide
                 verified end-to-end by someone who has never used Nova26.
   Day 7 (Tue):  Legal: Terms, Privacy, DPA finalized and published.
   Day 8 (Wed):  Stripe integration tested: subscribe, cancel, failed payment, refund.
                 14-day trial flow working end-to-end.
   Day 9 (Thu):  Sentry + PostHog instrumented. Key dashboards created. Status page live.
   Day 10 (Fri): Launch day. Announce in target communities (see GROK-R14-04).
                 Personal outreach to first 10 target users. Monitor all dashboards.
   ```

   For each day, specify: the primary deliverable, the person responsible (or role), and
   the go/no-go criterion that gates the next day.

6. **Open questions.** List 3-5 questions the build team must resolve: whether to do a
   soft launch (invite-only, no public announcement) before the hard launch to catch
   issues with real users; how to handle a critical bug discovered on launch day (have a
   rollback plan); whether the 14-day trial is the right length (shorter = more conversions
   from committed users; longer = more time for skeptical users to find value); and how to
   handle users on slower hardware (where `qwen2.5-coder:32b` may be too slow) without
   splitting the product into "light" and "heavy" tiers prematurely.

---

### GROK-R14-04: Post-Launch Growth Playbook (Months 1-6)

**The ask:** A product launch is not a moment — it is a starting line. The first six months
after launch are when the product either builds the compounding loops that lead to sustainable
growth or gets trapped in a cycle of one-time users who never return. The difference between
these outcomes is not luck or marketing spend; it is whether the product's growth mechanics
are intentional and instrumented from day one. Basecamp, Linear, and Raycast did not grow
because of ad budgets — they grew because developers talked about them unprompted, because
every new user who succeeded became a channel, and because the product itself got better
as more people used it. Nova26 has the same potential: Global Wisdom is a literal compounding
loop where more users = better outputs = more users. The first six months are about activating
that loop.

Produce a complete month-by-month growth playbook covering:

1. **Month 1: Stabilize and learn (target: 20 paying users).**

   The goal of month 1 is not growth — it is learning. Twenty users is a small enough
   cohort to onboard personally, talk to weekly, and understand deeply. The data from
   this cohort will be worth more than any marketing campaign.

   **Actions:**
   - Personal onboarding: video call with every paying user in week 1
   - Weekly check-in message (not automated — real message from the founder)
   - Bug triage: fix every blocker within 24 hours; fixes ship within 48 hours
   - Build a "top 10 friction points" list from user conversations; fix #1-3 in week 2
   - Start a Discord (or Slack) for early users — give them a private channel;
     make them feel like collaborators, not customers
   - Track weekly: DAU/MAU ratio, builds per user per week, error rate by type

   **Key metric:** Activation rate (% of new users who complete a successful build in
   first session). Target: ≥ 70%. Below 60%: the getting-started experience needs emergency work.

   **Leading churn indicator:** Any user who has not run a build in 5 days. Trigger: personal
   message from founder: "Hey, noticed you haven't built anything yet — can I help you get
   started?"

   **When to hire:** Not yet. Month 1 is founder-led support.

   **Revenue target:** $5,980 MRR (20 users × $299). This covers basic infrastructure costs.

2. **Month 2: First pricing experiment (target: 40 paying users).**

   **Actions:**
   - Run the A/B test from GROK-R12-04: test current $299/month against an annual plan
     ($2,490/year = $207.50/month). Offer annual to new sign-ups only.
   - Predicted result: 20-30% of new users prefer annual (better cash flow for Nova26,
     lower perceived risk for users who are uncertain about committing month-to-month)
   - First content piece: "How we built Nova26's test suite with Nova26" — a genuine
     dogfooding story. Publish on the Nova26 blog and post to Hacker News (Show HN).
   - Set up referral tracking: when an existing user mentions Nova26 and a new user signs up,
     attribute the referral. Reward: 1 free month for both. Track referral conversion rate.
   - First community content: "Nova26 vs. GitHub Copilot" — not a feature comparison, but
     a use case comparison: what kinds of tasks each tool is best suited for.

   **Key metric:** Trial-to-paid conversion rate. Target: ≥ 35%. Below 25%: the trial
   experience is not delivering value quickly enough.

   **Revenue target:** $11,960 MRR (40 users × $299). Begin covering 1 part-time support role.

3. **Month 3: Plugin marketplace launch (target: 75 paying users).**

   **Actions:**
   - Launch the Skills marketplace with 10 curated community-built skills
   - Skills = the first user-generated content Nova26 has — this is important for community
   - "Skills of the week" feature on the docs homepage and in a weekly newsletter
   - First conference presence: find one developer-focused conference (or online event)
     where 200+ TypeScript developers will be. Apply to speak. Topic: "21 agents, one build"
   - Start a newsletter: weekly, 3-5 items: a new skill, a user build story, a Nova26 tip,
     one behind-the-scenes architecture note. Target: 500 subscribers by end of month 3.
   - Skills metrics to track: installs per skill, build success rate with/without skill,
     which skills are used most often in the same build (cross-sell opportunity)

   **Key metric:** Retention (month 2 users still active in month 3). Target: ≥ 75%.
   Below 65%: there is a product-value problem in the second month of usage.

   **Revenue target:** $22,425 MRR (75 users × $299).

4. **Month 4: Team/enterprise tier (target: 100 paying users, first 5 team accounts).**

   **Actions:**
   - Launch team tier: $899/month for up to 5 seats ($179.80/seat — discount vs. individual)
   - Team features: shared Taste Vault, team Global Wisdom (patterns shared within team),
     team admin dashboard, SSO/SAML (if enterprise)
   - Outreach: identify 20 companies whose engineers are likely using Nova26 individually.
     Offer them a team trial. Personalize the pitch: "I see you already have 3 users —
     here is what the team plan adds."
   - Enterprise requirements: on-premises deployment option (edge mode + local Convex
     replacement — evaluate Turso or self-hosted Convex for enterprise customers)
   - Content: case study from a month-1 user who is willing to be publicly quoted

   **Key metric:** Team account conversion rate (individual → team). Target: 10% of users
   are on team accounts by end of month 4.

   **When to hire (first employee):** When MRR exceeds $20,000 and support requests exceed
   2 hours/day. First hire should be: a developer who is a power user of Nova26, ideally
   from the early-user community. Role: customer success + community. NOT a marketing hire.

   **Revenue target:** $33,845 MRR (95 individual + 5 team accounts).

5. **Month 5: International expansion and i18n (target: 125 users).**

   **Actions:**
   - Translate the getting-started guide and top 5 docs pages into: Spanish, German,
     Japanese, Chinese (Simplified). These are the 4 largest developer markets outside
     English-speaking countries.
   - Add locale detection to the CLI: `nova26` detects system locale and sets language
     for user-facing messages (errors, wizard prompts, progress output)
   - Partner with one developer community in each target locale (e.g., a Japanese developer
     YouTube channel, a German TypeScript meetup) for an intro post
   - Pricing: check whether $299/month is the right price in each market (purchasing power
     parity consideration — some markets may need local pricing via Stripe's local pricing API)
   - Metrics to add: new user sign-ups by country, activation rate by locale (does the
     i18n help or not?), feature usage patterns by region

   **Revenue target:** $37,375 MRR (125 users × $299).

6. **Month 6: Evaluate and double down (target: 150 users).**

   **Actions:**
   - Full retrospective: which acquisition channels produced the highest-quality users?
     (quality = still active + high build frequency + low support burden)
   - Double down on the 2-3 highest-quality channels; cut everything else
   - Price evaluation: at 150 users and $44,850 MRR, is $299 still the right price?
     Survey users: would they pay $399? $499? What would make them upgrade?
   - Evaluate building a self-service upgrade path for power users (GROK-R12-04's
     "usage-based add-ons" — extra Convex storage, priority model access)
   - Newsletter: should be at 2,000+ subscribers by month 6 — this is now an acquisition
     channel worth investing in (guest posts, sponsorships, community AMAs)

   **Revenue target:** $44,850 MRR (150 users × $299). Sustainable for a 2-person team.

7. **Content calendar: months 1-6.** Define specific content pieces for each month:

   | Month | Blog Post | Video | Tweet Thread |
   |-------|-----------|-------|--------------|
   | 1 | "We launched Nova26: what the first 20 users taught us" | "5-minute demo: PRD to passing tests" | "How 21 AI agents collaborate on a single build [thread]" |
   | 2 | "How we built Nova26's own test suite with Nova26" | "Nova26 vs. Copilot: when to use which" | "The Ralph Loop explained in 6 tweets" |
   | 3 | "Building your first Nova26 plugin (Skills tutorial)" | "Skills marketplace launch" | "5 community skills that changed how I build" |
   | 4 | "How one team cut their PR review time by 60%" | "Team tier demo" | "What 100 builds taught us about AI task decomposition" |
   | 5 | "Nova26 in Japanese: why we localized and how" | "Nova26 for non-English-speaking developers" | "Global Wisdom: how 125 developers are improving each other's code" |
   | 6 | "Six months of Nova26: what worked, what didn't, what's next" | "One year roadmap" | "We almost failed in month 2. Here's what we did." |

8. **Revenue sustainability model.** Define the explicit model:

   | Users | MRR | Annual Revenue | Can sustain |
   |-------|-----|---------------|-------------|
   | 20 | $5,980 | $71,760 | Infrastructure costs + part-time dev |
   | 50 | $14,950 | $179,400 | 1 full-time founder salary |
   | 100 | $29,900 | $358,800 | 1 founder + 1 early employee |
   | 200 | $59,800 | $717,600 | 2-3 person team + marketing budget |
   | 500 | $149,500 | $1,794,000 | Full product team + raising if desired |

   Note: these calculations assume individual plan only. Enterprise/team plans materially
   improve revenue per user.

9. **Open questions.** List 3-5 questions the build team must resolve: whether personal
   founder-led support is scalable past month 3 or whether to hire earlier; how to measure
   Global Wisdom's actual impact on user output quality (this is the core compounding
   mechanic — it needs a metric); whether the plugin marketplace should be moderated
   (preventing low-quality or malicious skills) and what the moderation policy should be;
   and whether an annual plan is better than monthly for a tool at this price point (annual
   improves predictability but increases purchase anxiety for first-time users).

---

### GROK-R14-05: Nova26 Brand & Visual Identity

**The ask:** A brand is not a logo — it is the answer to the question "why should I trust
this?" For a $299/month developer tool, trust is earned in three ways: technical credibility
(the product works), aesthetic credibility (the product looks considered), and voice
credibility (the product sounds like it was built by people who know what they are talking
about). The tools that developers recommend unprompted — Linear, Tailwind, Vercel, Zed —
are brands as much as they are products. They have a point of view, a visual language, and
a voice that is consistent from the marketing site to the error messages to the company
tweets. Nova26 has 21 planets, a compelling technical story, and a product that does
something genuinely new. The question is not whether it deserves a brand — it is whether
the brand will do justice to the product.

Produce a complete brand and visual identity specification covering:

1. **Brand voice.** Define Nova26's communication personality with concrete examples:

   Nova26's brand voice is: **technically precise, genuinely warm, and quietly confident.**

   - **Technically precise** means: no vague promises, no marketing fluff, no "AI-powered"
     without explaining what that means. Every claim is specific.
   - **Genuinely warm** means: this was built by developers for developers, and that
     shows. The copy does not read like a VC pitch; it reads like a senior engineer
     explaining their favorite tool to a friend.
   - **Quietly confident** means: Nova26 does not need to shout. The product speaks for
     itself. Copy that says "the most powerful AI IDE ever built" is not confident — it is
     insecure. Copy that says "build a REST API in 12 minutes, tested and committed" is confident.

   **Brand voice examples — the same idea expressed poorly and well:**

   | Context | Wrong tone | Right tone |
   |---------|-----------|------------|
   | Hero headline | "The future of AI-powered development" | "21 agents. One build. Your standards." |
   | Feature description | "Leverage cutting-edge AI to supercharge your workflow" | "MARS writes the code. PLUTO tests it. VENUS reviews it. You ship it." |
   | Error message | "An unexpected error has occurred" | "JUPITER couldn't parse your PRD. It needs a goal section — here's an example." |
   | Pricing page | "Unlimited AI power for serious developers" | "Everything. Locally. $299/month." |
   | Tweet | "We just launched the Nova26 Skills marketplace!" | "You can now extend any Nova26 agent with a 50-line TypeScript function. The first 10 community skills are live." |

2. **Visual identity.** Define the complete visual language in words:

   **Color palette:**
   ```
   Primary:   Deep space navy    #0a0e1a   — backgrounds, primary surfaces
   Accent:    Nebula violet      #7c3aed   — CTAs, active states, agent names
   Highlight: Stellar gold       #f59e0b   — achievements, ACE scores, success moments
   Success:   Aurora green       #10b981   — passing tests, build complete, sync success
   Error:     Mars red           #dc2626   — failures, errors, blockers
   Neutral:   Cosmic gray        #94a3b8   — secondary text, borders, muted information
   White:     Clean white        #f8fafc   — primary text on dark backgrounds
   ```

   **Typography:**
   - Headline font: **Geist** (by Vercel — free, modern, technical without being cold)
     or **Inter** (widely used, highly legible, developer-familiar)
   - Code/mono font: **Geist Mono** or **JetBrains Mono** (both free, respected in dev community)
   - Body font: Same as headline (Geist or Inter — keep it to one family for coherence)
   - Font philosophy: no novelty fonts, no serif, no display fonts that distract from content

   **Logo concept (described in words for a designer brief):**
   A minimal mark: a stylized orbit ring — a clean ellipse — with a small dot at one
   point on the ring (the planet). The ring represents the Ralph Loop's cyclical nature
   (Generator → Reflector → Curator). The planet represents the local-first, single-machine
   philosophy. The wordmark is set in Geist Bold: "nova26" in lowercase (lowercase signals
   approachability; most respected dev tool brands use lowercase). No tagline in the logo
   mark itself — the logo should work at 16px as a favicon.

   **Design philosophy:**
   - Functional beauty: every design choice should serve clarity, not aesthetics alone
   - Dark mode first: developers work in dark mode; light mode is a secondary consideration
   - Dense information layouts: developers want data, not whitespace
   - Minimal color usage: violet for interactive elements only; gold for achievement moments;
     the rest is navy and gray

3. **The planetary theme in marketing.** Define how the 21 planets are used:

   The 21 agent names are Nova26's most distinctive asset — they make the product feel like
   a world, not a tool. The marketing should lean into this without becoming precious or
   confusing.

   **Principles:**
   - Agent names are proper nouns — always capitalized: MARS, not mars or "Mars agent"
   - Each agent's name should evoke its role: JUPITER (largest, most powerful = planning),
     MARS (red, aggressive = code generation), VENUS (beautiful = code quality/aesthetics),
     PLUTO (far out, thorough = testing the edges)
   - The marketing site can have a "Meet the agents" section — but it must be a reference,
     not the hero. The hero is what the agents produce, not the agents themselves.
   - A subtle easter egg: the CLI's `nova26 agents list` command shows each agent's
     "current status" with a small planetary icon next to the name. This is delightful
     for power users who discover it and does not clutter the primary flow.

   **The 21 planets as marketing:**
   - "Nova26 isn't one AI. It's 21." — this is the simplest version of the pitch
   - Show the collaboration: MARS writes, VENUS reviews, PLUTO tests, ATLAS remembers
   - The Taste Vault = the system that makes 21 agents feel like one team that knows you

4. **Tagline candidates.** Five options with rationale:

   **Option 1: "21 agents. One build. Your standards."**
   Rationale: Specific (21 agents), outcome-focused (one build), and positions the user
   as the one setting the bar (your standards). Works as a hero headline and as a one-liner.

   **Option 2: "The AI IDE that learns how you build."**
   Rationale: Directly references the Taste Vault's core promise without naming it. Positions
   Nova26 as unique because it improves over time — not a generic AI tool. "How you build"
   is personal and specific.

   **Option 3: "Build it right. Then build it faster."**
   Rationale: Two-part structure that speaks to the ACE quality loop (right) and the
   efficiency gains (faster). Implies that quality and speed are not in tension — Nova26
   delivers both. Slightly more conservative, works well for enterprise positioning.

   **Option 4: "Local AI. Global craft."**
   Rationale: Directly names the two core differentiators: local-first (Ollama, no cloud)
   and Global Wisdom (cross-user pattern sharing). "Craft" is a developer-respectful word —
   it implies skill, not just output. Risk: "Global craft" may be too abstract.

   **Option 5: "Code ships. Standards compound."**
   Rationale: "Code ships" is the immediate promise; "standards compound" is the long-term
   value of the Taste Vault. This is the most technically honest tagline — it tells developers
   exactly what Nova26 does differently. Risk: requires explanation for non-power-users.

   **Recommendation:** Option 1 for the hero; Option 2 for the secondary tagline in
   meta descriptions and email subjects. Rationale: Option 1 is specific and bold (earns
   attention); Option 2 is clear and benefit-focused (earns clicks).

5. **Marketing site structure.** Define the full homepage layout and all pages:

   ```
   Homepage
   ├── Hero: Headline + one-line description + CTA ("Start building") + animated build demo
   ├── Social proof: "Built by developers, for developers" + 3 user quotes (launch day: placeholder)
   ├── How it works: 3-step graphic (Submit PRD → 21 agents build → Taste Vault learns)
   ├── Feature highlights (4 cards):
   │   - Local-first: "Every build runs on your machine. Nothing leaves without your permission."
   │   - Taste Vault: "Nova26 learns how you build. Every build improves the next."
   │   - 21 agents: "From planning to testing to review — specialized agents for every phase."
   │   - Skills: "Extend any agent. Share with the community."
   ├── Demo video or animated GIF: 60-second real build end-to-end
   ├── Pricing: Simple, one-tier + team tier + enterprise CTA
   └── Footer: Docs | GitHub | Discord | Twitter | Privacy | Terms

   /pricing
   ├── Individual: $299/month or $2,490/year ($207.50/month)
   │   Full feature list with tooltips explaining each feature
   ├── Team: $899/month for 5 seats ($179.80/seat)
   │   Features added: shared vault, team admin, SSO
   ├── Enterprise: "Contact us" (custom pricing, on-premises, SLA)
   └── FAQ: Is my code private? Can I cancel anytime? What models are included?

   /docs
   → See GROK-R14-01 for full architecture

   /blog
   → One post per month minimum; developer-authored, not marketing-authored

   /community
   → Discord invite, Twitter link, GitHub org, Skills marketplace link
   ```

6. **Social media presence.** Define the strategy by platform:

   **Twitter/X (primary developer platform):**
   - Tone: the same voice as the CLI error messages — specific, human, no marketing-speak
   - Frequency: 3-5 tweets per week (1 product update, 1 build story/demo, 1 technical insight,
     1 retweet of a user, 1 occasional opinion on AI/developer tooling)
   - Who should tweet: the founder, under their own name, with context that they built Nova26.
     Do not launch a @nova26dev brand account as the primary voice — developer trust flows
     through people, not brands, in the early stages.
   - First 90 days content calendar: demo GIFs of successful builds, behind-the-scenes of
     the 21-agent architecture, honest posts about what is hard about building an AI IDE,
     responses to user tweets praising or criticizing Nova26

   **GitHub (developer credibility signal):**
   - The nova26 organization should have: a public roadmap repository (GitHub Discussions),
     the CLI open-source if possible (consider open-core model: CLI is open, Convex sync
     and Global Wisdom are paid), a public issues tracker, active responses to issues
   - Star count is a vanity metric — focus on issue response time and PR merge rate

   **Discord (community and support):**
   - Channels: #announcements, #help, #show-your-builds, #skills-development, #feedback
   - First 3 months: founder is in #help personally. This is non-negotiable for learning
     what users actually struggle with.
   - Goal: by month 6, community members are answering each other's questions faster
     than the founder can

   **Hacker News (highest-quality developer acquisition):**
   - "Show HN: Nova26 — 21 agents that build, test, and learn from your code style"
     This should be the launch day post. Title must be factual, no superlatives.
   - The thread will ask: "How is this different from Cursor/GitHub Copilot?" Have a
     prepared answer: local-first inference, Taste Vault learning, 21 specialized agents
     vs. one general assistant, ACE quality loop. Be honest about limitations.

7. **The product story.** Write the full "about Nova26" narrative (300-400 words):

   Nova26 exists because the best developers have a way of working that AI should learn,
   not replace.

   When a senior engineer writes TypeScript, they make a hundred small decisions that are
   invisible to anyone watching: the naming convention that matches the rest of the codebase,
   the error handling pattern used in the auth module, the test structure preferred by the
   team. These decisions are not documented anywhere. They live in the patterns of the code
   they have already written.

   Current AI tools do not see those patterns. They see the file in front of them and
   generate the most statistically probable code for that context. The result is code that
   technically works but does not feel like it was written by anyone — it feels generated.

   Nova26 is different because it learns. Every build contributes patterns to the Taste
   Vault — a local knowledge base that captures how you build: the idioms you prefer, the
   architectures you gravitate toward, the test coverage you expect. The next build draws
   on those patterns. The build after that improves on them. Over time, Nova26 builds code
   that could plausibly have been written by you, because it has learned from everything
   you have built.

   Twenty-one specialized agents handle the work: JUPITER decomposes the problem, MARS
   writes the code, VENUS reviews it, PLUTO tests it, SATURN validates the architecture.
   They communicate, negotiate, and iterate through the Ralph Loop — a Generator-Reflector-Curator
   cycle that does not stop until the output meets the quality bar you have set.

   Everything runs locally, on your hardware, through Ollama. Your code never leaves your
   machine. The Taste Vault is yours. The patterns you build are yours. Global Wisdom —
   the cross-user aggregation that improves patterns across the community — is opt-in, and
   it never sends code, only structural patterns.

   Nova26 was built for the developer who has spent too long fixing AI-generated code that
   looked right but was not: not quite consistent with the rest of the codebase, not quite
   following the project's conventions, not quite what they would have written themselves.
   It is for the developer who wants an AI that works with their standards, not against them.

   That is Nova26. $299/month. Your standards. Every build.

8. **Open questions.** List 3-5 questions the build team must resolve: whether to open-source
   the CLI (open-core model can drive developer awareness, but it complicates licensing and
   support); how to handle the brand if the product pivots from individual developers to
   teams as the primary buyer (the planetary theme scales, but the messaging may need to
   shift); whether "nova26" as a name is searchable enough (search for "nova ai" and "nova26"
   — are the results dominated by other products?); and whether the 21-planet theme needs
   to be explained prominently or can be discovered by users (recommendation: explain it once,
   in the architecture docs, and let the agent names speak for themselves everywhere else).

---

## Output Format

- Label each section clearly: `## GROK-R14-01`, `## GROK-R14-02`, etc.
- Begin each deliverable with the big-picture analogy paragraph before any technical content.
- Use TypeScript for any interfaces and configuration schemas.
- Use tables for comparisons, checklists, and command inventories.
- Reference real Nova26 file paths where applicable:
  - `src/orchestrator/ralph-loop.ts`
  - `src/orchestrator/prompt-builder.ts`
  - `src/agent-loop/agent-loop.ts`
  - `.novarc` (project config)
  - `convex/schema.ts`
- Each deliverable must be independently actionable — a person picking up GROK-R14-03
  (Launch Readiness) should not need to have read R14-01 (Documentation) first.
- Estimated output: 2,000-3,500 words per deliverable, 10,000-17,500 words total.
- Where this spec says "write the complete prose for X", write actual prose — not an
  outline of prose. The getting-started guide should be a real getting-started guide.
  The product story should be a real story.

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

// Task structure
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

// Ralph Loop options (cumulative from R1-R13)
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
  acePlaybooks?: boolean;
  rehearsalStage?: boolean;
  similarityEngine?: boolean;
  modelRouting?: boolean;
  pluginAgents?: boolean;
  teamVault?: boolean;
  ciMode?: boolean;
  predictiveAnalytics?: boolean;
  onboardingMode?: boolean;
  checkpointing?: boolean;
  gracefulDegradation?: boolean;
  agentPooling?: boolean;
  llmResponseCache?: boolean;
  migrationCheck?: boolean;
  visionEnabled?: boolean;
  visionModel?: string;
  screenshotEnabled?: boolean;
  diagramGeneration?: boolean;
  voiceEnabled?: boolean;
  speechConfig?: SpeechConfig;
  knowledgeGraphEnabled?: boolean;
  projectGenEnabled?: boolean;
  projectPlanId?: string;
  phaseId?: string;
  context7Enabled?: boolean;
  context7Config?: Context7Config;
  skillsEnabled?: boolean;
  skillsConfig?: SkillsConfig;
  agentProtocolEnabled?: boolean;
  agentProtocolConfig?: AgentProtocolConfig;
  predictiveDecompositionEnabled?: boolean;
  predictiveDecompositionConfig?: PredictiveDecompositionConfig;
  adaptivePersonalityEnabled?: boolean;
  adaptivePersonalityConfig?: AdaptivePersonalityConfig;
  offlineFirstEnabled?: boolean;
  offlineConfig?: OfflineFirstConfig;
  edgeModeEnabled?: boolean;
  edgeConfig?: EdgeModeConfig;
}
```

---

## Coordination Note

R14 deliverables are primarily specifications, plans, and design documents rather than
new TypeScript source directories. However, some deliverables have direct code implications:

- GROK-R14-02 (CLI Polish) informs the CLI command structure in `src/cli/` — the command
  inventory, flag definitions, and error message formats should be treated as a binding spec
  for whoever implements or refactors the CLI.
- GROK-R14-01 (Documentation) and GROK-R14-03 (Launch Readiness) have implications for
  `convex/schema.ts` only if new analytics or billing tables are needed — specify any new
  tables explicitly, following the existing table naming conventions.
- GROK-R14-05 (Brand & Visual Identity) informs the marketing site (not in this repository)
  but also informs the CLI output design specified in GROK-R14-02 — the color palette and
  typography choices apply to the terminal output as well as the web.

The existing Convex tables (`builds`, `tasks`, `executions`, `patterns`, `agents`,
`companyAgents`, `learnings`, `userEngagement`, `churnRisk`) must not be modified.
Any new tables for analytics instrumentation (GROK-R14-03) must be specified as explicit
additions with full schema definitions.

---

*Prompt issued by Claude Code on 2026-02-18. Grok R14 output should be delivered to
`.nova/output/` or committed directly to the `grok/r14` branch for coordinator review.*
