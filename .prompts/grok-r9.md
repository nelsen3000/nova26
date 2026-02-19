# GROK-R9: Nova26 Product Completion Research Prompt

> Assigned to: Grok
> Round: R9 (post-R8)
> Date issued: 2026-02-18
> Status: Active

---

## Context Brief

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. The 21 agents
are named after celestial bodies (MARS, VENUS, MERCURY, JUPITER, SATURN, PLUTO, etc.) and
operate through a core execution engine called the Ralph Loop (`src/orchestrator/ralph-loop.ts`),
which drives a Generator -> Reflector -> Curator cycle (ACE) for iterative quality improvement.

**Current state of the build:**
- R1-R8 covered: tool use, inner loops, Taste Vault design, Global Wisdom Pipeline, Premium
  Buyer Experience, ACE specs, Rehearsal Stage specs, Self-Improvement Protocol, Real-Time
  Collaboration UX, Competitive Moat Analysis, Semantic Similarity Engine, Convex Real-Time
  Architecture, Launch Strategy/GTM, Security/Privacy Architecture, Ollama Model Strategy.
- Kimi is executing KIMI-VAULT-01 through KIMI-VAULT-06 (Living Taste Vault), then moves to
  ACE and Rehearsal Stage implementation (KIMI-ACE-01 through KIMI-ACE-06).
- Claude Code (claude-sonnet-4-6) owns `src/orchestrator/`, `src/llm/`, and `convex/`.
- Premium pricing: $299/month. Path A: Opt-In Global Wisdom Layer. Local-first with Ollama.
- The core technical architecture is well-specified. R9 pushes into areas that complete
  the product vision and prepare Nova26 for real users: extensibility, teams, CI/CD
  integration, build intelligence, and the onboarding experience.

**Your style:** Open each deliverable with a big-picture analogy that makes the architecture
click instantly. Then go deep — TypeScript interfaces, method signatures, file structure, flow
diagrams in ASCII or prose. Every spec must be ready-to-implement or ready-to-research: a
developer or researcher should be able to pick it up without re-reading R1-R8.

---

## Deliverables

Label each section clearly: GROK-R9-01, GROK-R9-02, etc.

---

### GROK-R9-01: Plugin & Custom Agent Ecosystem

**The ask:** Nova26 ships 21 purpose-built agents. But a power user building, say, a Rust
embedded system has domain needs that MARS and VENUS were not designed for. The plugin
system is the escape hatch — and potentially a marketplace flywheel. This deliverable
designs the complete extensibility layer: how users build custom agents, register custom
tools, and optionally share or sell their work in an agent marketplace.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. The right mental model for Nova26's plugin
   system — given that it must allow custom agents to inherit core loop behavior, access the
   Taste Vault, and coexist with the 21 native planets without breaking the orchestrator.
   (Think: browser extension manifest, VS Code extension API, or Kubernetes operator pattern
   — pick the one that best captures the "extend without forking" principle.)

2. **Plugin agent model.** Define what a PluginAgent is and how it differs from a native
   agent. Cover:
   - How does a custom agent declare itself? (Manifest file? TypeScript class that extends
     a base? Both?)
   - What lifecycle hooks does the base agent loop expose to plugins?
     (`onTaskStart`, `onReflect`, `onCurate`, `onComplete`, `onError`)
   - How does a custom agent register with the Ralph Loop orchestrator so it is treated
     as a first-class agent alongside MARS, VENUS, etc.?
   - How does the orchestrator discover installed plugins at runtime?
     (Convention-based directory scan of `src/plugins/`? A manifest registry file?)

   Provide the full TypeScript interfaces:

   ```typescript
   interface PluginAgentManifest {
     id: string;               // e.g., 'rust-embedded-agent'
     name: string;             // display name
     version: string;          // semver
     description: string;
     author: string;
     agentRole: string;        // e.g., 'code-generator', 'reviewer', 'deployer'
     capabilities: string[];   // e.g., ['rust', 'embedded-c', 'uart-debugging']
     tools: string[];          // tool IDs this agent uses
     tasteVaultAccess: boolean;
     globalWisdomEligible: boolean;
     entrypoint: string;       // path to the agent's TypeScript class
   }

   interface PluginAgent {
     manifest: PluginAgentManifest;
     onTaskStart(task: Task, context: AgentContext): Promise<void>;
     generate(prompt: string, context: AgentContext): Promise<string>;
     reflect(output: string, context: AgentContext): Promise<ReflectionResult>;
     curate(reflections: ReflectionResult[], context: AgentContext): Promise<string>;
     onComplete(result: AgentResult, context: AgentContext): Promise<void>;
     onError(error: Error, context: AgentContext): Promise<void>;
   }

   interface AgentContext {
     task: Task;
     sessionMemory: SessionMemory;
     tasteVault?: TasteVaultClient;  // integration point with KIMI-VAULT — exact signature TBD
     tools: Record<string, CustomTool>;
     ollamaClient: OllamaClient;
     emit(event: AgentActivityEvent): void;
   }
   ```

3. **Custom tool registration.** Users need to register their own tools (deploy to Vercel,
   run Prisma migrations, trigger a GitHub Actions workflow, call an internal API). Design
   the tool registration system:
   - How is a custom tool defined? (TypeScript function + JSON Schema for parameters?)
   - How does a plugin agent discover and invoke registered tools?
   - How does the orchestrator sandbox custom tool execution? (Does it run in a separate
     process? Does it have filesystem access restrictions?)
   - What is the tool execution contract — what does a tool receive and what must it return?

   Provide the full TypeScript interfaces:

   ```typescript
   interface CustomToolSchema {
     name: string;
     description: string;
     parameters: Record<string, {
       type: 'string' | 'number' | 'boolean' | 'object' | 'array';
       description: string;
       required: boolean;
       enum?: string[];
     }>;
   }

   interface CustomToolResult {
     success: boolean;
     output: string;
     metadata?: Record<string, unknown>;
     error?: string;
   }

   interface CustomTool {
     schema: CustomToolSchema;
     execute(args: Record<string, unknown>): Promise<CustomToolResult>;
   }

   interface ToolRegistry {
     register(tool: CustomTool): void;
     unregister(toolName: string): void;
     get(toolName: string): CustomTool | undefined;
     list(): CustomTool[];
   }
   ```

   Provide three concrete example implementations in TypeScript pseudocode:
   - `VercelDeployTool`: runs `vercel deploy` and returns the deployment URL
   - `PrismaMigrateTool`: runs `prisma migrate deploy` against a given DATABASE_URL
   - `SlackNotifyTool`: posts a message to a Slack channel via webhook

4. **Taste Vault integration for custom agents.** A custom agent should be able to learn
   from its own build history just like native agents. Design the integration:
   - How does a custom agent read from the Taste Vault? What query interface does it get?
   - How does it write new preference nodes? (Same schema as native agents, or plugin-namespaced?)
   - How are patterns from custom agents treated in Global Wisdom promotion? (Same pipeline,
     or quarantined behind a stricter review gate?)
   - Note explicitly: "Integration point with KIMI-VAULT — exact function signature TBD
     pending Kimi's output."

5. **Agent marketplace concept.** Design the marketplace system for sharing and selling
   custom agents:
   - What is the distribution format? (npm package? Signed zip archive? Git repo URL?)
   - What metadata is required for a marketplace listing?
   - How does trust and verification work? (Community ratings, verified publisher badge,
     code signature verification?)
   - How does the install flow work? (`nova26 plugin install rust-embedded-agent`?)
   - How does pricing work for paid plugins? (Revenue split? One-time vs subscription?)
   - What abuse prevention mechanisms prevent malicious plugins?

   Provide the full TypeScript interface:

   ```typescript
   interface AgentMarketplaceListing {
     id: string;
     manifest: PluginAgentManifest;
     publishedAt: string;
     updatedAt: string;
     downloads: number;
     rating: number;           // 1-5
     ratingCount: number;
     verifiedPublisher: boolean;
     pricing: 'free' | 'paid' | 'freemium';
     price?: number;           // USD/month if paid
     revenueShare?: number;    // Nova26's cut (e.g., 0.30 = 30%)
     tags: string[];
     screenshots?: string[];
     readmeUrl: string;
     repositoryUrl?: string;
     installCommand: string;   // e.g., 'nova26 plugin install rust-embedded-agent@1.2.0'
   }

   interface MarketplaceClient {
     search(query: string, filters?: MarketplaceFilters): Promise<AgentMarketplaceListing[]>;
     get(id: string): Promise<AgentMarketplaceListing>;
     install(id: string, version?: string): Promise<void>;
     uninstall(id: string): Promise<void>;
     publish(manifest: PluginAgentManifest, packagePath: string): Promise<AgentMarketplaceListing>;
   }
   ```

6. **Base agent class.** Design the abstract `BasePluginAgent` class that plugin developers
   extend. Show how it wires into the Ralph Loop's existing `processTask()` method. Provide
   the class skeleton in TypeScript with all protected methods that subclasses can override.

7. **File structure.** Specify:
   - `src/plugins/` — root directory for all plugin code
   - `src/plugins/registry.ts` — `PluginRegistry` class: scans, loads, and manages plugins
   - `src/plugins/base-agent.ts` — `BasePluginAgent` abstract class
   - `src/plugins/tool-registry.ts` — `ToolRegistry` implementation
   - `src/plugins/marketplace-client.ts` — `MarketplaceClient` implementation
   - `src/plugins/loader.ts` — dynamic import loader with sandboxing
   - `src/plugins/examples/vercel-deploy-tool.ts` — example tool implementation
   - `src/plugins/examples/prisma-migrate-tool.ts` — example tool implementation

8. **Integration with ralph-loop.ts.** Show the specific changes to `RalphLoopOptions`
   and `processTask()` that enable plugin agent discovery and execution. Where in the
   Ralph Loop does the orchestrator ask "is there a plugin agent better suited to this
   task than the default assignment?" Provide pseudocode for the routing decision.

9. **Open questions for the build team.** List 3-5 questions that must be answered before
   implementation begins.

---

### GROK-R9-02: Team & Enterprise Features

**The ask:** A solo developer paying $299/month is a great customer. A 10-person engineering
team at a funded startup paying $199/seat/month is a transformational one. The team and
enterprise layer is the path from lifestyle product to company — but it requires careful
architecture to avoid undermining the local-first, personal-taste-vault design that makes
Nova26 unique. This deliverable designs the complete multi-seat and enterprise feature set.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. Multi-seat Nova26 with shared Taste Vaults
   is like what real-world creative collaboration model? The tension is: each engineer has
   personal taste, but the team needs shared standards. (Think: a film studio where directors
   have individual style but the studio has a house style guide; a law firm with partner
   preferences and firm-wide citation standards; a Michelin kitchen where chefs have flair
   but the restaurant has a consistent menu.) Pick the analogy that makes the shared-vault
   architecture click.

2. **Multi-seat account model.** Design the core team account structure:
   - How does a team account relate to individual user accounts? (Owner + members model?
     Organization with seats?)
   - What is the seat management flow? (Invite by email, accept, consume a seat from a pool)
   - How does billing work for teams? ($199/seat/month, minimum seats, prorated adds/removes)
   - What happens to a team member's personal vault when they leave the team?
   - How does Global Wisdom opt-in work for teams? (Each member controls their own? Team
     admin sets a team-wide policy? Both, with admin as override?)

3. **Shared Taste Vault.** The most architecturally interesting team feature. Design it:
   - What is the relationship between a personal vault and a team vault? (Personal vault is
     primary, team vault supplements? Team vault takes precedence for certain pattern categories?)
   - How does a pattern get promoted from a personal vault to the team vault?
     (Manual promotion by user? Team admin approval? Automatic above a quality threshold?)
   - How does a team member's agent query the team vault? (Merged view? Fallback chain:
     personal → team → global?)
   - How are conflicts handled when personal preferences contradict team standards?
     (Personal wins for style, team wins for architecture decisions?)
   - Note explicitly: "Integration point with KIMI-VAULT — exact function signature TBD
     pending Kimi's output."

   Provide the full TypeScript interfaces:

   ```typescript
   interface TeamVault {
     teamId: string;
     name: string;
     patterns: TeamVaultPattern[];
     memberCount: number;
     createdAt: string;
     adminIds: string[];
   }

   interface TeamVaultPattern {
     id: string;
     text: string;
     category: string;
     promotedBy: string;         // userId
     promotedAt: string;
     approvedBy?: string;        // adminId, if approval required
     voteCount: number;
     status: 'active' | 'pending' | 'deprecated';
   }

   interface VaultQueryOptions {
     scope: 'personal' | 'team' | 'global' | 'merged';
     categories?: string[];
     limit?: number;
   }

   interface MergedVaultClient {
     query(options: VaultQueryOptions): Promise<VaultPattern[]>;
     promoteToTeam(patternId: string): Promise<void>;
     approveTeamPattern(patternId: string): Promise<void>;
   }
   ```

4. **Role-based access control.** Design the RBAC model:
   - Define the three roles: Admin, Developer, Viewer — what can each role do?
   - Admin: manage seats, manage team vault, view analytics, control Global Wisdom policy,
     invite/remove members, configure SSO
   - Developer: run builds, access personal vault, access team vault (read/propose),
     view own analytics
   - Viewer: read-only access to build history and analytics — no agent execution
   - How are roles stored? (Convex `teamMembers` table with a `role` field)
   - How are permissions checked at runtime? (Middleware on every Convex mutation?)

   Provide the complete Convex schema for teams:

   ```typescript
   // New Convex tables for team support
   // teams table
   // teamMembers table (userId, teamId, role, joinedAt, seatStatus)
   // teamVaultPatterns table (extends vault pattern schema for team scope)
   // teamInvitations table (inviteeEmail, teamId, role, token, expiresAt, status)
   // teamSettings table (teamId, globalWisdomPolicy, sharedVaultApprovalRequired, ssoConfig)
   ```

   Show the full `defineSchema` additions using Convex schema syntax. Include all indexes.

5. **Team analytics.** Design the team-level analytics dashboard:
   - What metrics are tracked at the team level? (Builds per day, success rate, most active
     agents, vault growth, time saved estimate)
   - What does the weekly team summary look like? Design it as a text/email template:
     "Your team completed 47 builds this week, 94% success rate. MARS was the most active
     agent. Your team vault grew by 12 new patterns."
   - How does team analytics aggregate individual member data without exposing personal
     build content? (Aggregate counts only, not task descriptions)
   - Which Convex functions power the analytics queries? (Provide function signatures)

6. **Enterprise SSO integration.** Design the SAML/OIDC integration:
   - What is the minimum viable SSO implementation? (OIDC with Google Workspace and
     Microsoft Entra ID as the two must-have providers)
   - How does SSO interact with seat provisioning? (Just-in-time provisioning: first SSO
     login creates a seat automatically?)
   - How is the SAML/OIDC configuration stored and managed? (Admin UI, Convex `teamSettings`)
   - What third-party library handles the SAML/OIDC flow in a TypeScript/Node.js context?
     Evaluate and recommend one.

7. **Pricing tiers.** Specify the complete pricing structure and how it is enforced
   in the codebase:
   - Solo: $299/month — single user, full features, personal vault, Global Wisdom opt-in
   - Team: $199/seat/month — minimum 3 seats, shared vault, team analytics, priority support
   - Enterprise: custom pricing — SSO, custom data residency, SLA, audit logs, dedicated support
   - How are plan limits enforced? (Convex query checks seat count before allowing build start?)
   - What happens when a team exceeds its seat count? (Grace period? Hard block? Notification?)

8. **File structure.** Specify:
   - `convex/teams.ts` — all team management mutations and queries
   - `convex/teamVault.ts` — shared vault functions (integration point with KIMI-VAULT output)
   - `convex/teamAnalytics.ts` — team analytics aggregation functions
   - `src/auth/rbac.ts` — role checking middleware and permission definitions
   - `src/auth/sso.ts` — SAML/OIDC integration client
   - `src/billing/seats.ts` — seat management and billing integration

9. **Open questions for the build team.** List 3-5 questions.

---

### GROK-R9-03: CI/CD & Workflow Integration

**The ask:** Nova26 cannot be an island. Developers live in GitHub, deploy through Vercel or
Railway, review PRs in Slack, and run tests in GitHub Actions. Nova26 must fit into these
existing workflows — not replace them, but supercharge them. This deliverable designs Nova26's
complete integration story with the wider developer ecosystem.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. Nova26 as a CI/CD integration participant is
   like what role in a production pipeline? The key tension: it must be invokable headlessly
   (from a GitHub Actions runner) and interactively (from the IDE UI), while carrying its
   Taste Vault context in both modes. (Think: a senior engineer who can pair program at a
   whiteboard or review code async in a PR comment thread — same expertise, different modality.)
   Pick the analogy that makes the dual-mode (interactive/headless) architecture click.

2. **CLI mode design.** Design the `nova26 run --ci` headless execution mode:
   - What is the full CLI interface? Provide the complete command specification:
     ```
     nova26 run [options] <prd-file>
     nova26 run --ci --task "add OAuth to the API" --output json
     nova26 run --ci --pr-context <pr-number> --repo <owner/repo>
     nova26 status [build-id]
     nova26 vault export --format json
     nova26 vault import <vault-file>
     nova26 plugin install <plugin-id>
     ```
   - How does the CLI authenticate? (API key in environment variable `NOVA26_API_KEY`?)
   - How does the Taste Vault travel in CI? (Committed to repo as `nova26.vault.json`?
     Fetched from Convex cloud using the API key?)
   - What is the exit code contract? (0 = success, 1 = build failure, 2 = config error)
   - What does JSON output mode look like? Provide the schema for `nova26 run --output json`

   Provide the TypeScript interface for the CLI runner:

   ```typescript
   interface CLIRunOptions {
     prdFile?: string;
     task?: string;
     ciMode: boolean;
     prContext?: { prNumber: number; repo: string; };
     output: 'human' | 'json' | 'junit';
     vaultPath?: string;
     apiKey?: string;
     model?: string;
     autonomyLevel?: AutonomyLevel;
     dryRun?: boolean;
   }

   interface CLIRunResult {
     buildId: string;
     status: 'success' | 'failure' | 'partial';
     tasksCompleted: number;
     tasksFailed: number;
     duration: number;           // milliseconds
     outputFiles: string[];
     vaultChanges: number;       // new patterns added to vault
     exitCode: 0 | 1 | 2;
   }
   ```

3. **GitHub Actions integration.** Design the official Nova26 GitHub Action:
   - What triggers make sense? (On PR open, on push to main, on manual workflow dispatch)
   - What does the action YAML look like? Provide a complete example:
     ```yaml
     # .github/workflows/nova26.yml
     name: Nova26 Build Review
     on:
       pull_request:
         types: [opened, synchronize]
     jobs:
       nova26-review:
         runs-on: ubuntu-latest
         steps:
           - uses: nova26-ai/nova26-action@v1
             with:
               api-key: ${{ secrets.NOVA26_API_KEY }}
               mode: pr-review
               post-comment: true
     ```
   - What does the PR comment look like when Nova26 reviews a PR? Design the comment template
     with specific sections (summary, issues found, suggestions, vault patterns applied).
   - How does Nova26 know what changed in the PR? (Git diff piped to CLI? GitHub API context?)
   - How does the action handle timeouts? (GitHub Actions has a 6-hour job limit — is that
     sufficient? What is the expected runtime for a PR review build?)

4. **Pre-commit hooks.** Design Nova26 as a smart pre-commit reviewer:
   - What does the pre-commit hook do? (Quick lint-level check? Full ACE cycle? Taste Vault
     consistency check only?)
   - How is it installed? (`nova26 install-hook` command?)
   - What is the performance budget? (Pre-commit hooks that take > 30 seconds break dev flow)
   - What does the hook output look like? (Terminal output that blocks or warns?)
   - How does the hook use the local Taste Vault without a network call?

   Provide the shell script skeleton and the TypeScript runner it delegates to.

5. **Vault-as-code concept.** The Taste Vault should travel with the repository. Design the
   vault portability system:
   - What is the format of a portable vault file? (JSON? YAML? Custom binary?)
   - What is the file location convention? (`.nova/vault.json` committed to the repo root?)
   - What is the merge strategy when two developers have conflicting vaults? (3-way merge
     based on pattern IDs? Last-write-wins? Manual resolution for conflicts?)
   - How does a new team member bootstrap their vault from the team vault file?
   - What is the `.gitignore` recommendation? (Vault file committed, but personal overrides
     ignored?)

   Provide the schema for the portable vault file format:

   ```typescript
   interface PortableVaultFile {
     version: string;            // vault schema version
     exportedAt: string;
     exportedBy: string;         // anonymized user ID
     scope: 'personal' | 'team' | 'project';
     patterns: ExportedPattern[];
     metadata: {
       buildCount: number;
       patternCount: number;
       topAgents: string[];
       dateRange: { from: string; to: string };
     };
   }

   interface ExportedPattern {
     id: string;
     category: string;
     text: string;
     qualityScore: number;
     usageCount: number;
     createdAt: string;
     tags: string[];
   }
   ```

6. **VS Code extension concept.** Design the Nova26 VS Code extension at a high level:
   - What does the extension add to the VS Code UI? (Sidebar panel? Status bar? Command palette?)
   - What is the extension's relationship to the running Nova26 process? (Extension talks to
     a local Nova26 server? Extension IS the Nova26 runner?)
   - What are the 5 most important VS Code commands the extension exposes?
   - How does the extension surface Taste Vault insights in the editor? (Inline ghost text?
     Hover card? Dedicated panel?)
   - What is the minimal viable extension scope for a first release?

7. **Webhook system.** Design the outbound webhook system for build notifications:
   - What events trigger webhooks? (Build started, task completed, build finished, vault updated,
     error occurred)
   - What is the webhook payload schema? (Provide the TypeScript interface)
   - How are webhooks configured? (Per-user in settings, per-team by admin?)
   - How does the system handle webhook failures? (Retry with exponential backoff? Dead letter queue?)
   - Provide example payloads for Slack and Discord integrations.

   ```typescript
   interface WebhookConfig {
     id: string;
     userId: string;
     url: string;
     events: WebhookEvent[];
     secret: string;             // HMAC signing secret
     active: boolean;
     createdAt: string;
   }

   type WebhookEvent =
     | 'build.started'
     | 'build.completed'
     | 'build.failed'
     | 'task.completed'
     | 'vault.updated'
     | 'agent.error';

   interface WebhookPayload {
     event: WebhookEvent;
     timestamp: string;
     buildId: string;
     userId: string;             // anonymized in team context
     data: Record<string, unknown>;
     signature: string;          // HMAC-SHA256 of payload
   }
   ```

8. **File structure.** Specify:
   - `src/cli/index.ts` — CLI entry point with command definitions
   - `src/cli/runner.ts` — `CLIRunner` class implementing `CLIRunOptions`
   - `src/cli/pr-reviewer.ts` — GitHub PR context processor
   - `src/integrations/github-action/action.yml` — GitHub Action definition
   - `src/integrations/pre-commit/hook.sh` — pre-commit shell hook
   - `src/integrations/pre-commit/runner.ts` — TypeScript pre-commit logic
   - `src/integrations/webhooks/dispatcher.ts` — webhook dispatch and retry logic
   - `src/vault/portable.ts` — vault export/import and merge logic

9. **Open questions for the build team.** List 3-5 questions.

---

### GROK-R9-04: Advanced Analytics & Build Intelligence

**The ask:** Nova26's 21 agents generate rich telemetry on every build: which agents fired,
how long each took, what the quality scores were, what vault patterns were applied, whether
tests passed on the first or fifth attempt. This raw telemetry is currently written to
`src/analytics/agent-analytics.ts`. This deliverable turns that raw data into a build
intelligence layer that justifies the $299/month price tag in concrete, measurable terms.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. Nova26's build intelligence dashboard is like
   what existing analytics product that developers already love and trust? The right analogy
   should capture both the time-series nature of build quality data and the predictive angle
   (forecasting future build outcomes from past patterns). (Think: Datadog APM for your AI
   build pipeline? Linear's project analytics? A personal trainer's performance log that
   adapts its recommendations over time?)

2. **Build performance dashboard.** Design the complete analytics dashboard:
   - What are the primary metrics shown? Define each metric precisely:
     - Build quality score (0-100): how is it computed from agent outputs and test results?
     - Agent efficiency score: ratio of successful ACE cycles to total cycles per agent
     - Vault utilization: what percentage of each build's output was influenced by vault patterns
     - Time per build: wall-clock time from task submission to completion, with P50/P90/P99
     - Task success rate: rolling 7-day and 30-day success percentages
   - What time series views are available? (Daily, weekly, monthly; drill down by agent or
     task category)
   - What does the dashboard layout look like? Design it as an ASCII wireframe.
   - Which Convex queries power the dashboard? (Provide function signatures for the 3-5
     most important queries)

3. **Predictive analytics engine.** Design the prediction system:
   - What does "predicted build time and success probability" mean concretely? What inputs
     go into the prediction? (Task description embedding similarity to past tasks, file count,
     agent assignment, vault coverage for this task type, current model being used)
   - What is the prediction model? (Simple weighted average of similar past tasks? Linear
     regression? Something more sophisticated that can run locally?)
   - How is "similarity to past tasks" computed? (Use the SimilarityEngine from R8-01?)
   - At what point in the build flow is the prediction surfaced to the user? (After task
     submission, before execution begins?)
   - How does the prediction improve over time as more builds accumulate?

   Provide the TypeScript interface:

   ```typescript
   interface BuildPrediction {
     estimatedDuration: number;        // milliseconds
     successProbability: number;        // 0.0 - 1.0
     confidence: number;               // 0.0 - 1.0: how many similar past builds exist
     similarBuildCount: number;
     riskFactors: RiskFactor[];
     recommendation?: string;          // e.g., "Consider breaking this into 2 tasks"
   }

   interface RiskFactor {
     type: 'low-vault-coverage' | 'novel-task' | 'high-file-count' | 'schema-change' | 'untested-agent';
     severity: 'low' | 'medium' | 'high';
     description: string;
   }

   interface PredictiveAnalyticsEngine {
     predict(task: Task, context: PredictionContext): Promise<BuildPrediction>;
     recordOutcome(buildId: string, actual: BuildOutcome): Promise<void>;
     getAccuracy(period: '7d' | '30d' | '90d'): Promise<PredictionAccuracyReport>;
   }
   ```

4. **Cost tracking.** Design the compute cost tracking system:
   - What units are tracked? (Ollama tokens in/out per agent per build? Wall-clock seconds
     of GPU utilization? Both?)
   - How are token counts obtained from the Ollama API? (Does Ollama return token counts
     in its response? If not, how do you estimate them?)
   - What is the cost per token for local Ollama inference? (It is not zero — electricity
     and hardware amortization. Provide the formula and default constants.)
   - How is cost broken down? (By agent, by task type, by model used, by day/week/month)
   - How is the cumulative cost budget feature implemented? (The `budgetLimit` field already
     in `RalphLoopOptions` — how does it integrate with cost tracking?)

   Provide the TypeScript interface:

   ```typescript
   interface BuildCostBreakdown {
     buildId: string;
     totalTokensIn: number;
     totalTokensOut: number;
     totalComputeSeconds: number;
     estimatedElectricityCost: number;   // USD
     estimatedHardwareCost: number;      // USD (amortized)
     costByAgent: Record<string, AgentCost>;
     costByModel: Record<string, ModelCost>;
   }

   interface AgentCost {
     agentName: string;
     tokensIn: number;
     tokensOut: number;
     computeSeconds: number;
     estimatedCost: number;
   }

   interface CostTracker {
     recordBuildCost(breakdown: BuildCostBreakdown): Promise<void>;
     getMonthlyCost(userId: string, month: string): Promise<number>;
     getCostByAgent(userId: string, period: string): Promise<Record<string, number>>;
     isOverBudget(userId: string): Promise<boolean>;
   }
   ```

5. **ROI calculator.** The $299/month price is justified by the time Nova26 saves. Design
   the ROI calculation and surfacing:
   - How is "time saved" estimated? (Compare actual build duration to a baseline estimate
     for manual implementation? Use a configurable hourly rate?)
   - What is the default assumption for manual implementation time? (Task complexity score
     mapped to a time estimate, e.g., a 3-agent build = 2 hours manually?)
   - What is the default hourly rate assumption? ($150/hour? User-configurable?)
   - How is the ROI number surfaced in the UI? ("Nova26 saved you 47 hours this month,
     worth $7,050 at $150/hr — your ROI is 23.5x on your $299 subscription.")
   - How is this number verified against reality? (What validation prevents inflated numbers
     that embarrass users when they quote them?)

6. **Agent performance heatmap.** Design the per-user agent performance visualization:
   - What does the heatmap show? (Each agent on one axis, task categories on the other,
     cell value = average quality score for that agent+category combination)
   - How is "average quality score" computed for a cell? (Average ACE score over all builds
     where that agent handled that category)
   - What is the minimum data threshold before a cell is populated vs shown as "insufficient data"?
   - How does this heatmap feed back into the Ralph Loop's agent routing decisions?
     (Can the loop use this data to prefer agents that historically perform well for the
     current task category for this user?)
   - Provide the TypeScript interface for the heatmap data structure.

7. **Export and reporting.** Design the weekly report and data export system:
   - What does the weekly PDF/email report contain? Design the layout as a text template
     with specific sections and example values.
   - What export formats are supported? (JSON, CSV, PDF)
   - How is the PDF generated in a TypeScript/Node.js context? Recommend a library.
   - How is the email delivered? (Sendgrid? Resend? User-configured SMTP?)
   - How does the user control report frequency and content? (Settings panel)

8. **Integration with existing analytics.** Describe exactly how this spec extends the
   existing `src/analytics/agent-analytics.ts`. What new methods are added? What new
   data structures flow into it from `ralph-loop.ts`? Show the integration as a pseudocode
   diff on the existing file.

9. **File structure.** Specify:
   - `src/analytics/agent-analytics.ts` — additions to existing file (document what's new)
   - `src/analytics/build-intelligence.ts` — `PredictiveAnalyticsEngine` implementation
   - `src/analytics/cost-tracker.ts` — `CostTracker` implementation
   - `src/analytics/roi-calculator.ts` — ROI computation logic
   - `src/analytics/heatmap.ts` — agent performance heatmap data builder
   - `src/analytics/reporter.ts` — weekly report generation and export
   - `convex/analytics.ts` — Convex functions for analytics storage and aggregation

10. **Open questions for the build team.** List 3-5 questions.

---

### GROK-R9-05: Onboarding & Education System

**The ask:** The best technical product fails without a great first-hour experience. Nova26's
onboarding must do three things at once: teach the user how Nova26 works, demonstrate immediate
value from their very first build, and begin populating their Taste Vault so the system can
start personalizing. This deliverable designs the complete onboarding and education system —
from the first screen a new user sees to the Nova26 Academy progressive learning path.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. The best onboarding systems are not tutorials
   — they are the product itself, just guided. What is the right analogy for Nova26's
   onboarding? (Think: Duolingo's "first lesson IS the product demo"; Figma's template gallery
   that immediately puts real work in your hands; a flight simulator that starts with a
   pre-planned route before handing you the controls.) Pick the analogy that captures the
   "teach by doing a real thing" principle.

2. **First-run experience design.** Design the complete first-session experience in detail:
   - What is the very first screen a new user sees after installation? (Project selection?
     Model setup check? Welcome tour?)
   - What is the first task Nova26 automatically suggests or runs? (Analyze the current
     directory? Run a sample task on a template project? Something else?)
   - What output should the user see in the first 90 seconds that delivers an "I have never
     seen a tool do that before" moment?
   - At what point does the Taste Vault log its first preference node? How is this surfaced
     to the user? ("Nova26 noticed you prefer TypeScript strict mode — I've saved that.")
   - What is the first Global Wisdom touchpoint? When does the user see that their agents
     are benefiting from patterns learned from other builders?

   Design the complete 5-minute first session script — what happens in minutes 1, 2, 3, 4, 5:

   ```
   Minute 1: [describe exactly what the user sees and does]
   Minute 2: [describe exactly what happens next]
   Minute 3: [describe the first "aha" moment]
   Minute 4: [describe first vault interaction]
   Minute 5: [describe handoff to self-directed use]
   ```

3. **Interactive tutorial system.** Design the guided tutorial architecture:
   - How are tutorials structured? (Step-by-step guided builds with annotations? Sandbox
     project that the user builds guided by Nova26 itself?)
   - How does the tutorial system know when the user has completed a step?
     (Output validation? Explicit "Next" button? Timed progression?)
   - What are the 3 mandatory tutorial modules every new user must complete?
   - How is tutorial progress persisted? (Local file? Convex `userProgress` table?)
   - How does skipping the tutorial affect the user's first week experience? (Should it
     be skippable? What is lost by skipping?)

   Provide the TypeScript interfaces:

   ```typescript
   interface TutorialModule {
     id: string;
     title: string;
     description: string;
     estimatedMinutes: number;
     prerequisites: string[];    // module IDs that must be completed first
     steps: TutorialStep[];
     completionReward?: string;  // e.g., "Unlocks the Rehearsal Stage"
   }

   interface TutorialStep {
     id: string;
     instruction: string;
     expectedAction: TutorialAction;
     hint?: string;
     skippable: boolean;
     validationFn?: string;      // name of a validator function to check completion
   }

   type TutorialAction =
     | 'run-build'
     | 'view-vault'
     | 'approve-plan'
     | 'review-agent-output'
     | 'promote-pattern'
     | 'install-plugin'
     | 'configure-setting';

   interface TutorialProgress {
     userId: string;
     completedModules: string[];
     currentModule?: string;
     currentStep?: string;
     startedAt: string;
     completedAt?: string;
   }
   ```

4. **Nova26 Academy.** Design the progressive learning path system:
   - What are the learning tiers? (Beginner, Intermediate, Advanced, Expert — define what
     distinguishes each tier and what capabilities unlock at each)
   - What topics does each tier cover? Design a full curriculum outline with 3-5 topics
     per tier and the format of each (interactive demo, video, hands-on challenge, or reading).
   - How does the Academy adapt to the user's build history? (If the Taste Vault shows the
     user primarily builds Next.js apps, does the Academy surface Next.js-specific modules?)
   - How does Academy progress connect to the Taste Vault? (Learning preferences feed new
     vault nodes — e.g., completing the "Schema Design" module adds a preference node for
     schema-first development patterns)
   - What is the certification or recognition system? (Nova26 badges? A public profile?)

5. **Contextual tooltip system.** Design the in-product help and contextual explanation layer:
   - What types of contextual help are surfaced? (Agent decision explanations, vault pattern
     citations, ACE cycle progress, error recovery suggestions)
   - How does a user trigger an explanation? (Hover? Click an info icon? Ask the system?)
   - What does "Why did MARS choose this approach?" look like as a UX interaction?
     Design the tooltip content schema.
   - How are tooltips connected to the Academy? (Tooltip for a concept links to the
     Academy module that covers it in depth?)
   - How does the tooltip system avoid becoming noise for expert users? (Dismissal,
     learning curve detection, "expert mode" toggle?)

   Provide the TypeScript interface:

   ```typescript
   interface TooltipContent {
     id: string;
     trigger: 'hover' | 'click' | 'auto';
     title: string;
     body: string;
     agentRationale?: string;    // "MARS chose this because..."
     vaultPatternUsed?: string;  // "This came from your Taste Vault: ..."
     academyLink?: string;       // link to relevant Academy module
     dismissible: boolean;
     showOnce: boolean;          // if true, never show again after first dismissal
   }

   interface TooltipSystem {
     register(content: TooltipContent): void;
     show(id: string, anchorElement: string): void;
     dismiss(id: string, userId: string): void;
     getRelevantTips(context: BuildContext): Promise<TooltipContent[]>;
   }
   ```

6. **Template library.** Design the pre-built PRD template system:
   - What templates are included in v1.0? Define at least 5 with their scope and structure:
     - Next.js SaaS application (authentication, database, billing, API)
     - REST API server (Express/Fastify, TypeScript, OpenAPI spec, tests)
     - CLI tool (commander.js, config file, help system, distribution)
     - Mobile-first web app (React Native Web or PWA)
     - Data pipeline / ETL script (file processing, transformation, output)
   - What does a PRD template file look like? Provide the schema and a complete example
     for the "CLI tool" template.
   - How does a template interact with the Taste Vault? (Template provides a starting point,
     but Taste Vault overrides with the user's personal preferences when they conflict)
   - How are community-contributed templates handled? (Same marketplace as plugins?
     Separate curation process?)

   Provide the TypeScript interface:

   ```typescript
   interface PRDTemplate {
     id: string;
     name: string;
     description: string;
     category: 'web-app' | 'api' | 'cli' | 'mobile' | 'data' | 'library' | 'other';
     tags: string[];
     author: string;
     version: string;
     popularity: number;
     prdContent: string;         // the actual PRD text, with {{placeholders}} for customization
     variables: TemplateVariable[];
     suggestedAgents: AgentName[];
     estimatedBuildTime: number; // minutes
   }

   interface TemplateVariable {
     name: string;
     description: string;
     type: 'string' | 'boolean' | 'select';
     default?: string;
     options?: string[];         // for select type
     required: boolean;
   }
   ```

7. **Community showcase.** Design the anonymized community gallery:
   - What is shown in the showcase? (Build type, agent usage, quality metrics — never project
     content or business logic)
   - What is the opt-in flow? (User must explicitly consent to include their build stats;
     default is private)
   - How is "what others built" surfaced? (Aggregate stats: "12,847 Next.js apps built this
     month"; anonymized capability demos; user-published testimonials)
   - How does the showcase connect to the template library? (A user who achieved a high-quality
     score on a CLI tool build can publish their PRD as a template for others)
   - What abuse prevention keeps the showcase from becoming spam or marketing?

8. **Documentation auto-generation.** Design the self-documentation feature:
   - What does Nova26 document automatically? (The build itself: what was built, why each
     decision was made, which agents contributed, which vault patterns were applied)
   - What format is the auto-generated documentation? (Markdown in the repo? A separate
     `nova26-build-log.md`? Both?)
   - How does the documentation cite agent reasoning? (Quote the ACE reflection output?)
   - How does this feed the Taste Vault? (Learning preferences extracted from build decisions
     are converted into vault nodes automatically)
   - What is the documentation output for a typical build? Provide an example template.

9. **File structure.** Specify:
   - `src/onboarding/tutorial.ts` — `TutorialEngine` class and `TutorialProgress` management
   - `src/onboarding/academy.ts` — `AcademyManager` and curriculum definitions
   - `src/onboarding/tooltips.ts` — `TooltipSystem` implementation
   - `src/onboarding/first-run.ts` — first-run detection and guided flow orchestration
   - `src/templates/library.ts` — `TemplateLibrary` class and template loading
   - `src/templates/prd-templates/` — directory of built-in PRD template files (`.prd.md`)
   - `src/community/showcase.ts` — opt-in data collection and showcase rendering
   - `src/docs/auto-generator.ts` — build documentation generator
   - `convex/onboarding.ts` — Convex functions for tutorial progress and Academy state

10. **Open questions for the build team.** List 3-5 questions.

---

## Output Format

- Label each section clearly: `## GROK-R9-01`, `## GROK-R9-02`, etc.
- Begin each deliverable with the big-picture analogy paragraph before any technical content.
- Use TypeScript for all interfaces and method signatures.
- Use ASCII or prose for flow diagrams — no image dependencies.
- For code examples that reference real Nova26 files, use the actual file paths:
  - `src/orchestrator/ralph-loop.ts`
  - `src/orchestrator/prompt-builder.ts`
  - `src/llm/structured-output.ts`
  - `src/agent-loop/scratchpad.ts`
  - `src/agent-loop/agent-loop.ts`
  - `src/memory/session-memory.ts`
  - `src/analytics/agent-analytics.ts`
  - `convex/schema.ts`
  - `convex/atlas.ts`
- Each deliverable should be independently useful — a developer picking up GROK-R9-03
  should not need to read R9-01 first.
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

// Ralph Loop options (extend these for R9 features)
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
  acePlaybooks?: boolean;      // added in R7-01
  rehearsalStage?: boolean;    // added in R7-02
  similarityEngine?: boolean;  // added in R8-01
  modelRouting?: boolean;      // added in R8-05
  // TODO: add pluginAgents?: boolean; teamVault?: boolean; ciMode?: boolean;
  //        predictiveAnalytics?: boolean; onboardingMode?: boolean;
}
```

---

## Coordination Note

Kimi is currently executing KIMI-VAULT-01 through KIMI-VAULT-06 (Living Taste Vault), then
moves to ACE and Rehearsal Stage implementation (KIMI-ACE-01 through KIMI-ACE-06).

Your specs in R9-01 (Plugin Ecosystem), R9-02 (Team Features), and R9-05 (Onboarding) all
reference the Taste Vault interfaces as dependencies. Design your specs to plug into whatever
Kimi builds, not to replace it. When you reference the Vault in your specs, note explicitly:
"Integration point with KIMI-VAULT — exact function signature TBD pending Kimi's output."

Claude Code (claude-sonnet-4-6) owns `src/orchestrator/`, `src/llm/`, and `convex/`.
Your new directories (`src/plugins/`, `src/cli/`, `src/integrations/`, `src/onboarding/`,
`src/templates/`, `src/community/`) are clean-slate additions — no conflicts with existing
Claude Code domains.

The `src/analytics/agent-analytics.ts` file (R9-04) is in Claude Code's domain. When you
design additions to it, document them as proposed additions for Claude Code to implement —
do not modify the existing interface contract.

Existing Convex tables (from `convex/schema.ts`): `builds`, `tasks`, `executions`,
`patterns`, `agents`, `companyAgents`, `learnings`. R9-02 schema additions must not
modify these tables — only add new ones alongside them.

---

*Prompt issued by Claude Code on 2026-02-18. Grok R9 output should be delivered to
`.nova/output/` or committed directly to the `grok/r9` branch for coordinator review.*
