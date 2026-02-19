# GROK-R15: Nova26 Visionary Territory Research Prompt

> Assigned to: Grok
> Round: R15 (post-R14)
> Date issued: 2026-02-18
> Status: Active

---

## Context Brief

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. The 21 agents
are named after celestial bodies (MARS, VENUS, MERCURY, JUPITER, SATURN, PLUTO, ATLAS, etc.)
and operate through a core execution engine called the Ralph Loop (`src/orchestrator/ralph-loop.ts`),
which drives a Generator -> Reflector -> Curator cycle (ACE) for iterative quality improvement.

**Current state of the build:**
- R1-R14 covered: core architecture, Taste Vault, Global Wisdom, ACE, Rehearsal, Security,
  Performance, Plugins, Teams, CI/CD, Analytics, Onboarding, Multi-Modal, Voice, Benchmarks,
  Graph Viz, Autonomous Projects, Context7, Superpowers, Retention, Revenue, Community,
  Agent Communication, Predictive Decomposition, Semantic Search, Adaptive Personality,
  Offline-First, Documentation, CLI Polish, Launch Readiness, Growth Playbook, Brand Identity.
- Kimi's frontier sprint is active: agent communication, semantic search, predictive
  decomposition, adaptive personality, offline-first.
- Kiro is extracting Nova26 codebase patterns (KIRO-03), 79+ patterns documented.
- 1445+ tests passing, 0 TypeScript errors.
- Premium pricing: $299/month. Local-first with Ollama.
- The product is at or near feature-completeness for its initial premium launch.

**R15 mission:** R1-R14 covered Nova26 from raw architecture to brand identity — the full
product, business, and launch surface. R15 moves past the horizon. These are not the features
needed to launch; they are the features that define what AI-assisted development looks like
in 2027 and beyond. Think of R15 as the product roadmap for the version of Nova26 that
exists after the first 500 paying users. Each deliverable should feel genuinely ambitious —
not a logical extension of what already exists, but a leap into territory that will make
other AI IDE teams uncomfortable. Think big. Think weird. Think transformative.

**Your style:** Open each deliverable with a tight, concrete analogy that makes the challenge
click in one paragraph — the kind of analogy that makes a senior engineer pause and say
"hm, I hadn't thought about it that way." Then go deep: concrete TypeScript interfaces,
integration points with named agents (MERCURY, PLUTO, SATURN, etc.), rationale for design
decisions, and honest analysis of the hardest implementation problems. Every spec must be
independently actionable. Vague vision documents are not acceptable — specific, buildable
outputs only.

---

## Deliverables

Label each section clearly: GROK-R15-01, GROK-R15-02, etc.

---

### GROK-R15-01: Autonomous Code Review & Security Auditing

**The ask:** A smoke detector does not wait for you to smell smoke. It monitors continuously,
it has a specific threat model, and it wakes you up at 3am when the probability of danger
crosses a threshold — not when you remember to check. Most developers treat security like
a smoke detector with no batteries: they check when they remember, they run a scan before
a big launch, and they find out about a vulnerability from a customer who found it first.
Nova26 has 21 agents and a continuous build loop. It should be the smoke detector that
never needs new batteries — a security guardian that runs silently in the background,
understands the full codebase, and surfaces threats before they become breaches.

Produce a complete specification for Nova26's autonomous security auditing layer covering:

1. **Security guardian architecture.** Define how continuous security auditing integrates
   with the existing Ralph Loop and agent system:

   - Which agent owns security: MERCURY (quality gate agent) is the natural home. Define
     MERCURY's expanded role as a dual-purpose agent: quality gate (existing) + security
     guardian (new). Explain the separation of concerns within MERCURY's task queue.
   - When security scans trigger: after every build completion, after every file write,
     on a configurable schedule (e.g., nightly full scans), and on-demand via CLI.
   - How security findings feed back into the build loop: if MERCURY detects a critical
     vulnerability in code just written by MARS, it should be able to interrupt the current
     build, surface the finding, and (at autonomy level 4-5) automatically request MARS to
     fix the vulnerable code before proceeding.
   - The security scan as a first-class gate: alongside the existing ACE score and test
     pass/fail gates, add a Security Gate: builds with critical vulnerabilities do not
     complete until the vulnerability is resolved or explicitly overridden.

2. **OWASP Top 10 detection.** For each of the OWASP Top 10, specify:

   - The detection strategy (static analysis pattern, AST analysis, or semantic code
     understanding via the existing semantic search index)
   - At least two concrete TypeScript/JavaScript code examples that trigger a finding
   - The remediation recommendation that Nova26 should generate alongside the finding
   - Which existing Nova26 tool or capability enables the detection

   Cover all ten:
   - A01: Broken Access Control
   - A02: Cryptographic Failures
   - A03: Injection (SQL, NoSQL, command injection)
   - A04: Insecure Design
   - A05: Security Misconfiguration
   - A06: Vulnerable and Outdated Components
   - A07: Identification and Authentication Failures
   - A08: Software and Data Integrity Failures
   - A09: Security Logging and Monitoring Failures
   - A10: Server-Side Request Forgery (SSRF)

3. **Dependency vulnerability scanning.** Define the CVE scanning pipeline:

   - Integration with OSV (Open Source Vulnerabilities) database — Google's free,
     comprehensive vulnerability database. Specify the API endpoints and query format.
   - How this differs from `npm audit`: OSV covers more ecosystems and is updated
     faster; Nova26 should use OSV as the primary source and npm audit as a secondary
     signal. Explain the reconciliation strategy when they disagree.
   - Scanning cadence: full scan on `nova26 build`, incremental scan (only changed
     packages) on every file write, scheduled deep scan on a configurable interval.
   - The dependency graph: Nova26 should understand transitive dependencies — a
     vulnerability in a package three levels deep in the dependency tree should still
     surface, with the dependency chain shown clearly in the finding.
   - Auto-fix for dependency vulnerabilities: when a non-breaking semver-compatible
     update is available that patches a vulnerability, Nova26 at autonomy level 4-5
     should propose or automatically apply the update and re-run tests.

4. **Code review as a service.** Design the "senior developer review" feature:

   - The concept: when a user pushes code (via git hook or manual invocation), Nova26
     reviews it with the same critical eye a senior developer would apply — not just
     "does it work?" but "is this idiomatic? is it maintainable? does it follow the
     patterns in the Taste Vault? are there edge cases the author missed?"
   - VENUS (code quality) is the primary reviewer, but the review should be multi-agent:
     SATURN validates architectural decisions, MERCURY checks security, PLUTO assesses
     testability. Define the review pipeline and how the findings are aggregated.
   - Inline comments: findings should be presented as inline annotations on the diff,
     not just a flat list. Define the `ReviewComment` format with file, line, severity,
     message, and suggested fix.
   - How this integrates with git: a pre-push hook that triggers the review, a
     `nova26 review` command that reviews uncommitted changes, and integration with
     GitHub/GitLab PR review via the existing CI/CD integration.
   - The Taste Vault connection: review comments should reference the user's own past
     patterns. "In auth/session.ts, you handle this case with X pattern. This code uses
     Y pattern inconsistently." This makes the review personal, not generic.

5. **Security Score.** Define the 0-100 scoring model:

   - Dimension weights: define what contributes to the score and how much each dimension
     counts. Suggest: Dependency vulnerabilities (25%), OWASP findings (35%), Code quality
     indicators (20%), Security configuration (10%), Test coverage of security paths (10%).
   - Score thresholds: 90-100 = Excellent, 75-89 = Good, 50-74 = Fair (warnings surfaced
     in build output), 25-49 = Poor (build warning, user must acknowledge), 0-24 = Critical
     (build blocked at default settings).
   - How the score degrades over time without intervention: a score of 85 with no new
     findings still degrades slowly as new CVEs are published against existing dependencies.
     Define the degradation model and how Nova26 communicates it.
   - Score history and trends: track score over time and show the trend in the build
     completion summary. A score that is improving (even if still low) is meaningfully
     different from one that is declining.

6. **TypeScript interfaces.** Define the complete type system:

   ```typescript
   // Extend RalphLoopOptions with security capabilities
   interface RalphLoopOptions {
     // ... existing options
     securityAuditEnabled?: boolean;
     securityConfig?: SecurityConfig;
   }

   interface SecurityConfig {
     continuousScanning: boolean;
     scanOnBuild: boolean;
     scheduledScanCron?: string;           // e.g., '0 2 * * *' for 2am daily
     osvApiEndpoint: string;               // default: 'https://api.osv.dev/v1'
     blockBuildOnCritical: boolean;        // default: true
     autoFixDependencies: boolean;         // default: false; autonomy 4-5 recommended
     owaspChecksEnabled: OwaspCheck[];     // which OWASP checks to run
     reviewMode: 'inline' | 'summary' | 'both';
   }

   type OwaspCheck =
     | 'broken-access-control'
     | 'cryptographic-failures'
     | 'injection'
     | 'insecure-design'
     | 'security-misconfiguration'
     | 'vulnerable-components'
     | 'auth-failures'
     | 'integrity-failures'
     | 'logging-failures'
     | 'ssrf';

   interface SecurityScan {
     id: string;
     buildId: string;
     triggeredAt: string;                  // ISO 8601
     triggeredBy: 'build' | 'schedule' | 'manual' | 'file-write';
     durationMs: number;
     vulnerabilities: Vulnerability[];
     securityScore: SecurityScore;
     reviewComments: ReviewComment[];
     status: 'running' | 'completed' | 'failed';
   }

   type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

   interface Vulnerability {
     id: string;                           // e.g., 'CVE-2024-12345' or 'GHSA-xxxx-yyyy-zzzz'
     severity: VulnerabilitySeverity;
     category: OwaspCheck | 'dependency';
     title: string;
     description: string;
     affectedFile?: string;                // for code-level findings
     affectedLines?: [number, number];     // [start, end]
     affectedPackage?: string;             // for dependency findings
     affectedVersion?: string;
     fixedVersion?: string;
     codeSnippet?: string;                 // the vulnerable code
     remediation: string;                  // human-readable fix recommendation
     autoFixAvailable: boolean;
     references: string[];                 // CVE links, OSV links, OWASP docs
     detectedBy: AgentName;
     suppressedAt?: string;               // if user has acknowledged/suppressed
     suppressedReason?: string;
   }

   interface SecurityScore {
     overall: number;                      // 0-100
     grade: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
     dimensions: {
       dependencyVulnerabilities: number;  // 0-100, weight 25%
       owaspFindings: number;              // 0-100, weight 35%
       codeQuality: number;                // 0-100, weight 20%
       securityConfiguration: number;     // 0-100, weight 10%
       testCoverageOfSecurityPaths: number;// 0-100, weight 10%
     };
     trend: 'improving' | 'stable' | 'degrading';
     previousScore?: number;
     scoreHistory: Array<{ date: string; score: number }>;
     blockedBuild: boolean;
   }

   interface ReviewComment {
     id: string;
     file: string;
     startLine: number;
     endLine: number;
     severity: VulnerabilitySeverity | 'suggestion' | 'nitpick';
     category: 'security' | 'quality' | 'style' | 'architecture' | 'testability';
     message: string;
     suggestedFix?: string;               // code snippet to replace the flagged code
     tasteVaultReference?: string;        // ID of a relevant Taste Vault pattern
     reviewedBy: AgentName;
     confidence: number;                  // 0-1, how confident the agent is in the finding
   }
   ```

7. **Integration with existing gate-runner.** Specify how security gates plug into the
   existing build pipeline. Identify the specific file (`src/orchestrator/ralph-loop.ts`)
   and the phase at which the SecurityGate check should run. Define the gate's pass/fail
   contract and how it interacts with the existing `autoTestFix` retry loop.

8. **CLI surface.** Define all security-related CLI commands:

   ```
   nova26 security scan          # Run a full security scan now
   nova26 security status        # Show current Security Score with breakdown
   nova26 security findings      # List all open vulnerabilities
   nova26 security findings --severity critical  # Filter by severity
   nova26 security fix <id>      # Apply auto-fix for a specific finding
   nova26 security suppress <id> --reason "..."  # Suppress a finding with a reason
   nova26 security history       # Show Security Score trend over time
   nova26 review                 # Run code review on uncommitted changes
   nova26 review --staged        # Review only staged changes (pre-commit mode)
   ```

9. **Open questions.** List 3-5 hard implementation questions: how to run AST analysis
   on TypeScript without adding heavy dependencies (consider ts-morph — already likely
   in the codebase or easy to add); how to prevent false positives from overwhelming
   users (the signal-to-noise ratio of security scanners is their primary weakness);
   whether the Security Score should factor into the ACE score or remain a separate metric;
   and how to handle security findings in generated code vs. user-written code (should
   Nova26 be more forgiving of findings in code it generated itself, since it can auto-fix
   them, vs. findings in user-written code where the context is less clear?).

---

### GROK-R15-02: AI-Powered Database Design & Migration

**The ask:** A database schema is a commitment. Unlike code, which can be refactored with
a well-structured PR, a production schema carries every mistake forward through migrations
that accumulate like geological strata — each layer preserving the decisions (and
indecisions) of the layer before it. The reason senior engineers guard schema design
conversations so carefully is not perfectionism; it is that they have seen what happens
when a schema designed for a single-tenant app gets retrofitted for multi-tenancy six months
in, with 500,000 rows already in the tables. Nova26 has the context to get the schema right
from the beginning: it knows the application's access patterns, the agent's understanding
of the domain, and the full codebase context. It should use all of that to design data
models that will not become regrets.

Produce a complete specification for Nova26's database design and migration layer covering:

1. **PLUTO's expanded role.** PLUTO is the test execution agent. Database intelligence is
   a natural expansion: PLUTO already understands what code runs against the database
   (tests). Extend PLUTO's role to cover schema design, migration generation, and query
   analysis. Define the expanded responsibilities without diluting the testing focus.
   Alternative: introduce a new sub-agent pattern (like a PLUTO sub-specialist) rather
   than overloading a single agent — explore both and recommend one.

2. **Schema design from natural language.** Define the full pipeline:

   - Input: a natural language description like "I need a multi-tenant SaaS with teams,
     billing, and audit logs. Each team has many users. Users can be in multiple teams.
     Billing is at the team level. Audit logs must be immutable and retained for 90 days."
   - Processing: the agent extracts entities, relationships, cardinalities, constraints,
     and access patterns from the description. Define the intermediate representation
     (the `DataModel` type) that captures this structure before schema code is generated.
   - Output: concrete schema code in the target ORM/framework (Convex, Prisma, Drizzle).
   - Clarification loop: for ambiguous descriptions ("users can be in multiple teams" —
     does a user's role differ per team?), the agent asks targeted clarifying questions
     before generating code. Define a maximum of 3 clarifying questions per schema to
     prevent questionnaire fatigue.
   - How the Taste Vault informs schema design: if the user has previously designed
     multi-tenant schemas, those patterns should influence the new design. "You've used
     a `teamId` foreign key pattern before — applying that here."

3. **Convex-specific schema generation.** Since Nova26 is built on Convex, this is the
   primary target. Define complete code generation for:

   - `convex/schema.ts`: the full Convex schema with tables, indexes, and access patterns
   - `convex/[domain].ts`: queries and mutations for each entity
   - Convex validators: using `v.` validators for all fields
   - Index strategy: the agent should reason about which fields will be queried together
     and generate appropriate `.index()` definitions, explaining its rationale in a
     comment above each index

   Provide a worked example: given the multi-tenant SaaS description above, show the
   complete generated `convex/schema.ts` with tables for teams, users, teamMemberships,
   billing, and auditLogs, with appropriate indexes and field types.

4. **Prisma and Drizzle support.** Define the generation targets for non-Convex projects:

   - Prisma: generate `schema.prisma`, initial migration SQL, and seed data
   - Drizzle: generate the schema file with `pgTable`/`mysqlTable` definitions and the
     migration files
   - The abstraction layer: define a `SchemaIR` (intermediate representation) that is
     ORM-agnostic, from which any target can be generated. This is the key architectural
     decision — specify the `SchemaIR` type in detail.
   - ORM detection: Nova26 should auto-detect the project's ORM from `package.json`
     dependencies and generate for the correct target without asking.

5. **Safe migration generation.** Define the migration safety model:

   - Detecting breaking vs. non-breaking changes: adding a nullable column is safe;
     dropping a column is not; renaming a column requires a two-phase migration. Define
     the full taxonomy of schema changes with their safety classification.
   - Two-phase migration pattern for breaking changes: phase 1 adds the new structure
     while keeping the old; phase 2 removes the old after all code has been updated.
     Nova26 should generate both phases and explain the rollout order.
   - Rollback migrations: every generated migration should have a corresponding down
     migration. Define when down migrations are impossible (data deletion) and how
     Nova26 communicates this.
   - Migration testing: before surfacing a migration, PLUTO should validate it against
     a test database. Define the test database strategy for both Convex (dev deployment)
     and Prisma/Drizzle (SQLite in-memory for testing).

6. **ER diagram generation.** Define the schema visualization feature:

   - The output format: a Mermaid `erDiagram` block, which renders natively in GitHub
     Markdown, Notion, and most documentation tools. No external tooling required.
   - Auto-generation: `nova26 db diagram` generates the Mermaid ER diagram from the
     current schema. The diagram is also written to `.nova/output/schema.mmd` after
     every schema generation.
   - Relationship inference: the agent should label relationships correctly (one-to-many,
     many-to-many, one-to-one) and include the foreign key field names on the edges.
   - Provide a worked example: the Mermaid ER diagram for the multi-tenant SaaS schema
     defined in point 3.

7. **Data modeling best practices.** Define the rules the agent applies when generating
   schemas and the rationale for each:

   - Normalization: when to normalize vs. denormalize, and how the access pattern
     analysis (from natural language input) drives the decision
   - Soft deletes: when to recommend `deletedAt: v.optional(v.number())` vs. hard
     deletes — specifically, audit-log entities should never be hard-deleted
   - Indexing strategy: compound indexes, partial indexes, and the "N+1 query smell"
     that indicates a missing index
   - UUID vs. sequential IDs: the agent should recommend Convex's built-in ID system
     for Convex projects, UUIDs for distributed systems, and sequential IDs only for
     human-readable references (order numbers, invoice numbers)

8. **TypeScript interfaces.** Define the complete type system:

   ```typescript
   // Extend RalphLoopOptions
   interface RalphLoopOptions {
     // ... existing options
     dbDesignEnabled?: boolean;
     dbDesignConfig?: DatabaseDesignConfig;
   }

   interface DatabaseDesignConfig {
     targetOrm: 'convex' | 'prisma' | 'drizzle' | 'auto-detect';
     autoDetectOrm: boolean;             // default: true
     generateErDiagram: boolean;         // default: true
     generateSeedData: boolean;          // default: false
     migrationSafety: 'strict' | 'warn' | 'permissive';
     testMigrationsInDev: boolean;       // default: true
   }

   // ORM-agnostic intermediate representation
   interface SchemaIR {
     version: string;
     entities: EntityIR[];
     relationships: RelationshipIR[];
     generatedAt: string;
     sourceDescription: string;          // the natural language input
     clarificationsRequested: string[];
     clarificationsResolved: Record<string, string>;
   }

   interface EntityIR {
     name: string;                       // e.g., 'Team', 'User'
     tableName: string;                  // snake_case: 'teams', 'users'
     fields: FieldIR[];
     indexes: IndexIR[];
     constraints: ConstraintIR[];
     accessPatterns: string[];           // e.g., 'find by teamId', 'list recent by createdAt'
     isSoftDeletable: boolean;
     isImmutable: boolean;               // e.g., audit logs
     retentionDays?: number;
   }

   interface FieldIR {
     name: string;
     type: 'string' | 'number' | 'boolean' | 'id' | 'object' | 'array' | 'optional';
     innerType?: FieldIR;                // for optional/array
     nullable: boolean;
     defaultValue?: unknown;
     isSystemField: boolean;             // e.g., createdAt, updatedAt
     referencesEntity?: string;          // foreign key
   }

   interface IndexIR {
     name: string;
     fields: string[];
     unique: boolean;
     partial?: string;                   // partial index condition
     rationale: string;                  // why this index exists
   }

   interface ConstraintIR {
     type: 'unique' | 'check' | 'foreign-key' | 'not-null';
     fields: string[];
     expression?: string;
   }

   type RelationshipType = 'one-to-one' | 'one-to-many' | 'many-to-many';

   interface RelationshipIR {
     from: string;                       // entity name
     to: string;                         // entity name
     type: RelationshipType;
     throughTable?: string;              // for many-to-many
     fromField: string;
     toField: string;
     onDelete: 'cascade' | 'restrict' | 'set-null' | 'no-action';
   }

   interface SchemaDesign {
     id: string;
     projectId: string;
     schemaIR: SchemaIR;
     generatedCode: GeneratedSchemaCode;
     erDiagramMermaid: string;
     migrations: Migration[];
     createdAt: string;
     createdBy: AgentName;
     tasteVaultPatternsApplied: string[];
   }

   interface GeneratedSchemaCode {
     targetOrm: 'convex' | 'prisma' | 'drizzle';
     files: Array<{ path: string; content: string }>;
   }

   interface Migration {
     id: string;
     name: string;
     sequence: number;
     upSql?: string;                     // for SQL ORMs
     downSql?: string;
     convexMigrationCode?: string;       // for Convex
     isBreaking: boolean;
     breakingReason?: string;
     requiresTwoPhase: boolean;
     phase?: 1 | 2;
     isRollbackPossible: boolean;
     rollbackWarning?: string;
     testedInDev: boolean;
     generatedAt: string;
   }

   interface ERDiagram {
     mermaidSource: string;
     entities: string[];
     relationships: Array<{
       from: string;
       to: string;
       type: string;
       label: string;
     }>;
     generatedAt: string;
   }
   ```

9. **CLI surface.** Define all database-related commands:

   ```
   nova26 db design "<description>"    # Generate schema from natural language
   nova26 db design --interactive      # Multi-turn dialog mode for schema design
   nova26 db migrate generate          # Generate migration from current schema diff
   nova26 db migrate apply             # Apply pending migrations (dev only)
   nova26 db migrate status            # Show migration history and pending migrations
   nova26 db migrate rollback <id>     # Roll back a specific migration
   nova26 db diagram                   # Generate/refresh ER diagram
   nova26 db diagram --open            # Open ER diagram in browser (via Mermaid Live)
   nova26 db analyze                   # Analyze existing schema for issues
   nova26 db seed                      # Generate seed data for development
   ```

10. **Open questions.** List 3-5 hard implementation questions: how to handle schema
    inference from an existing database (reverse-engineering a schema from a live database
    connection — is this in scope?); how to test Convex migrations without a Convex dev
    deployment (the test environment for Convex is a dev deployment, not an in-memory
    database); whether the `SchemaIR` should be stored in the Taste Vault as a first-class
    pattern (so that future schema designs can reuse entities from previous designs); and
    how to handle schema conflicts when two agents (e.g., MARS writing application code
    and PLUTO designing schema) make incompatible assumptions about the data model.

---

### GROK-R15-03: Collaborative Real-Time Editing (Multiplayer)

**The ask:** Pair programming is one of the oldest ideas in software development and one
of the most consistently underused — not because it does not work, but because the tools
make it awkward. Screen sharing adds latency, jank, and the discomfort of watching someone
else scroll. Tools like Visual Studio Live Share improved the mechanics but kept the same
fundamental model: two humans, one keyboard at a time, one context window. What Nova26 can
do is stranger and more interesting than that. Imagine a session where a senior developer
is writing the main application logic while two agents — VENUS reviewing every function as
it is written, PLUTO suggesting test cases in real time — annotate the code with inline
comments that the developer can accept or reject with a keypress. Not a review after the
fact. Not an autocomplete suggestion. A live collaboration between humans and agents, in
the same file, at the same time.

Produce a complete specification for Nova26's multiplayer collaboration layer covering:

1. **Architecture for real-time sync.** Convex is the natural backbone — Convex's reactive
   queries make it well-suited for real-time multi-client sync without a separate WebSocket
   server. Define the Convex tables and reactive query structure that enable multiplayer:

   - `collaborationSessions` table: session metadata, participants, state
   - `editOperations` table: the stream of operations (inserts, deletes, cursor moves)
     that are replayed to synchronize state across clients
   - `presenceState` table: who is online, where their cursor is, what they are working on
   - Operational Transform (OT) vs. CRDTs: evaluate both for this use case and recommend
     one. The key constraint is that agent operations and human operations must be
     reconcilable. Recommend CRDTs (specifically, a CRDT library like `yjs`) because they
     are composable and do not require a central authority to resolve conflicts. Explain
     the trade-offs.

2. **Participant model.** Define the full participant type system:

   - Human participants: a developer connected via the CLI or (future) a browser IDE
   - Agent participants: any of the 21 agents can be a participant in a session, but their
     role is specific — agents annotate, suggest, and generate; they do not overwrite human
     changes without explicit approval
   - Session roles: `owner` (created the session, has admin rights), `editor` (can make
     changes), `reviewer` (can annotate but not edit), `agent` (special role for Nova26
     agents — can suggest and annotate, edits require human approval)
   - Presence awareness: every participant has a cursor position, an active file, and a
     status (`idle`, `typing`, `reviewing`, `thinking` — agents use `thinking` while
     processing). Define how presence state is computed and when it is updated.

3. **Agent inline annotations.** The most innovative part of this feature — define it
   precisely:

   - VENUS reviews every function as it is completed (defined as: cursor leaves the
     function scope or more than 3 seconds of inactivity). The review appears as a
     collapsed annotation above the function, expandable with a keypress.
   - Annotation display: in a terminal IDE context, annotations must be compatible with
     standard terminal rendering. Define the annotation format for terminal output and
     the format for a (future) browser IDE context.
   - Accept/reject UX: `nova26 collab annotations` lists pending annotations. Individual
     annotations can be accepted (`nova26 collab accept <id>` applies the suggestion as
     a code change) or rejected (`nova26 collab reject <id>` dismisses it).
   - Annotation persistence: accepted annotations become code changes in the edit
     operation stream. Rejected annotations are dismissed but logged for potential Taste
     Vault feedback.
   - Agent annotation rate limiting: agents should not produce more than 1 annotation
     per function per 30 seconds. Define the rate limiting model and the priority queue
     for agents competing to annotate the same code.

4. **Conflict resolution.** The hardest problem in collaborative editing — define the model:

   - Human vs. human conflicts: two developers edit the same line simultaneously. Use
     CRDT merge semantics (last-write-wins at the character level, preserving both
     authors' intent as much as possible). Show the developer both versions when
     the merge is ambiguous and ask for resolution.
   - Human vs. agent conflicts: a developer rewrites a function while MARS is generating
     code for the same function based on a task assignment. Rule: human wins, always.
     MARS's output is discarded; MARS is notified and should re-generate based on the
     new human-written context.
   - Agent vs. agent conflicts: two agents assigned to overlapping tasks (e.g., MARS
     writing a function and VENUS refactoring the same function simultaneously). Rule:
     only one agent should have write access to a file at a time. The session coordinator
     (ATLAS, as the memory agent) maintains a file lock registry. Define the lock
     acquisition and release protocol.
   - Conflict detection threshold: define the time window within which concurrent edits
     to the same region are considered a conflict (suggest: 5 seconds).

5. **How this differs from Cursor multiplayer.** An honest competitive analysis:

   - What Cursor has: multiplayer editing via Live Share-style cursor sharing, but no
     agent awareness — agents (Cursor's AI) are invoked per-session, not as named
     persistent participants.
   - What Nova26 adds: named agent participants with specific roles, inline agent
     annotations with accept/reject mechanics, agent-to-agent conflict resolution via
     ATLAS's lock registry, and Taste Vault integration (the session's pattern learning
     feeds back to the local vault).
   - What Nova26 does not have (and should not pretend to): a browser-based IDE. The
     multiplayer feature is CLI-first and terminal-native. The browser IDE is a future
     phase — do not design it now.

6. **TypeScript interfaces.** Define the complete type system:

   ```typescript
   // Extend RalphLoopOptions
   interface RalphLoopOptions {
     // ... existing options
     multiplayerEnabled?: boolean;
     multiplayerConfig?: MultiplayerConfig;
   }

   interface MultiplayerConfig {
     maxParticipants: number;            // default: 10 (humans + agents)
     agentAnnotationRateLimitSeconds: number; // default: 30
     conflictWindowMs: number;           // default: 5000
     crdtLibrary: 'yjs' | 'automerge';  // recommend yjs
     presenceUpdateIntervalMs: number;   // default: 500
   }

   type ParticipantRole = 'owner' | 'editor' | 'reviewer' | 'agent';
   type ParticipantStatus = 'idle' | 'typing' | 'reviewing' | 'thinking' | 'offline';
   type ParticipantType = 'human' | 'agent';

   interface Participant {
     id: string;
     type: ParticipantType;
     name: string;                       // human display name or agent name (e.g., 'VENUS')
     agentName?: AgentName;              // set if type === 'agent'
     role: ParticipantRole;
     status: ParticipantStatus;
     joinedAt: string;
     lastActiveAt: string;
     color: string;                      // assigned cursor color for this participant
   }

   interface PresenceState {
     participantId: string;
     sessionId: string;
     activeFile?: string;
     cursorLine?: number;
     cursorColumn?: number;
     selectionStart?: { line: number; column: number };
     selectionEnd?: { line: number; column: number };
     status: ParticipantStatus;
     updatedAt: string;
   }

   type EditOperationType =
     | 'insert'
     | 'delete'
     | 'cursor-move'
     | 'file-open'
     | 'annotation-add'
     | 'annotation-accept'
     | 'annotation-reject'
     | 'file-lock-acquire'
     | 'file-lock-release';

   interface EditOperation {
     id: string;
     sessionId: string;
     authorId: string;                   // participant ID
     authorType: ParticipantType;
     operationType: EditOperationType;
     file?: string;
     position?: { line: number; column: number };
     content?: string;                   // for insert operations
     length?: number;                    // for delete operations
     annotationId?: string;              // for annotation operations
     vectorClock: Record<string, number>;// CRDT vector clock
     timestamp: string;
     appliedAt?: string;                 // when replayed on a remote client
   }

   interface CollaborationSession {
     id: string;
     projectId: string;
     name: string;
     owner: string;                      // participant ID
     participants: Participant[];
     presenceStates: PresenceState[];
     activeAgents: AgentName[];
     fileLocks: FileLock[];
     startedAt: string;
     lastActivityAt: string;
     status: 'active' | 'idle' | 'ended';
   }

   interface FileLock {
     file: string;
     heldBy: string;                     // participant ID
     heldByType: ParticipantType;
     acquiredAt: string;
     expiresAt: string;                  // locks auto-expire after 30 seconds of inactivity
   }

   interface AgentAnnotation {
     id: string;
     sessionId: string;
     file: string;
     startLine: number;
     endLine: number;
     authorAgent: AgentName;
     type: 'review' | 'suggestion' | 'warning' | 'test-case';
     message: string;
     suggestedCode?: string;
     severity?: VulnerabilitySeverity;
     status: 'pending' | 'accepted' | 'rejected' | 'expired';
     createdAt: string;
     resolvedAt?: string;
     resolvedBy?: string;                // participant ID
   }
   ```

7. **Convex schema additions.** Define the new Convex tables required:

   ```typescript
   // convex/schema.ts additions
   collaborationSessions: defineTable({
     projectId: v.string(),
     name: v.string(),
     status: v.union(v.literal('active'), v.literal('idle'), v.literal('ended')),
     ownerParticipantId: v.string(),
     startedAt: v.number(),
     lastActivityAt: v.number(),
   }).index('by_project', ['projectId']).index('by_status', ['status']),

   editOperations: defineTable({
     sessionId: v.string(),
     authorId: v.string(),
     authorType: v.union(v.literal('human'), v.literal('agent')),
     operationType: v.string(),
     file: v.optional(v.string()),
     positionLine: v.optional(v.number()),
     positionColumn: v.optional(v.number()),
     content: v.optional(v.string()),
     vectorClockJson: v.string(),        // JSON-serialized vector clock
     timestamp: v.number(),
   }).index('by_session', ['sessionId']).index('by_session_timestamp', ['sessionId', 'timestamp']),

   presenceStates: defineTable({
     sessionId: v.string(),
     participantId: v.string(),
     activeFile: v.optional(v.string()),
     cursorLine: v.optional(v.number()),
     status: v.string(),
     updatedAt: v.number(),
   }).index('by_session', ['sessionId']).index('by_participant', ['sessionId', 'participantId']),

   agentAnnotations: defineTable({
     sessionId: v.string(),
     file: v.string(),
     startLine: v.number(),
     endLine: v.number(),
     authorAgent: v.string(),
     type: v.string(),
     message: v.string(),
     suggestedCode: v.optional(v.string()),
     status: v.union(v.literal('pending'), v.literal('accepted'), v.literal('rejected'), v.literal('expired')),
     createdAt: v.number(),
     resolvedAt: v.optional(v.number()),
     resolvedBy: v.optional(v.string()),
   }).index('by_session', ['sessionId']).index('by_session_file', ['sessionId', 'file']).index('by_status', ['sessionId', 'status']),
   ```

8. **CLI surface.** Define the multiplayer CLI commands:

   ```
   nova26 collab start             # Start a new collaboration session
   nova26 collab start --name "API sprint" --invite alice,bob  # Named session with invites
   nova26 collab join <session-id> # Join an existing session
   nova26 collab status            # Show current session: participants, active files
   nova26 collab participants      # List participants with status and cursor locations
   nova26 collab agents add VENUS  # Add an agent to the current session
   nova26 collab agents remove VENUS # Remove an agent
   nova26 collab annotations       # List pending agent annotations
   nova26 collab accept <id>       # Accept an annotation (applies the suggested code)
   nova26 collab reject <id>       # Reject an annotation
   nova26 collab accept --all      # Accept all pending annotations
   nova26 collab end               # End the session (owner only)
   nova26 collab replay <session-id> # Replay a session as a build history view
   ```

9. **Open questions.** List 3-5 hard implementation questions: whether `yjs` or `automerge`
   is more appropriate for this use case (yjs has better ecosystem support; automerge has
   a more principled conflict model); how to make the terminal-native multiplayer feel
   good without a GUI (the key interaction is the annotation accept/reject workflow — this
   must be smooth in a terminal); how to handle sessions where the agent is significantly
   slower than the human (MARS generating code may take 30 seconds while the human has
   already moved on — is the stale suggestion still useful?); and how to scope the
   initial release (suggest: two-human sessions only, no agents, as the v1 to validate
   the sync layer before adding agent complexity).

---

### GROK-R15-04: Natural Language Programming Interface

**The ask:** The PRD-to-build flow Nova26 already has is natural language programming at
the architectural level — you describe what to build, and the agents build it. But there
is a granularity below "build a REST API" that current AI tools handle poorly: the
granularity of individual business rules, written in plain English, that live alongside
the code they describe as a living specification. When a developer writes "when a user
signs up, send them a welcome email after 24 hours unless they've already made a purchase,"
they are not describing a system; they are describing a rule. The gap between that sentence
and the TypeScript that implements it is wide — and every translation step (natural language
to specification, specification to code, code to tests) introduces the opportunity for the
rule to drift from the original intent. Nova26 can close that gap by keeping the natural
language description permanently linked to the code it describes, and by detecting when
code changes break the described intent.

Produce a complete specification for Nova26's natural language programming interface covering:

1. **Intent-to-code pipeline.** Define the full processing pipeline for a natural language
   intent statement:

   - Parsing: extract entities, conditions, triggers, actions, and exceptions from the
     natural language statement. Show the parse tree for the example: "When a user signs
     up, send them a welcome email after 24 hours unless they've already made a purchase."
     - Trigger: user sign-up event
     - Timing: 24-hour delay
     - Action: send welcome email
     - Exception: user has made a purchase (check at execution time, not at schedule time)
   - Code generation: translate the parse tree into TypeScript. For this example, the
     output would be a scheduled job (using Convex's scheduler or a queue), a check
     against the orders table, and an email send via the configured email provider.
     Show the complete generated TypeScript.
   - Test generation: generate tests for every branch in the parse tree. For the example:
     test 1 — user signs up, no purchase → email sent at 24h; test 2 — user signs up,
     makes purchase before 24h → email not sent; test 3 — user signs up, makes purchase
     after 24h → email sent (since the check is at execution time).
   - Validation: before presenting the output, MERCURY (quality gate) validates that the
     generated code correctly implements the stated intent by running the generated tests.

2. **Intent preservation.** The living spec concept — define how natural language intent
   stays linked to code:

   - Storage: every `IntentSpec` is stored in the Taste Vault with a reference to the
     generated `CodeBinding` (file path, line range, git commit hash).
   - Drift detection: when the bound code is modified, Nova26 checks whether the
     modification is consistent with the original intent. Define the drift detection
     algorithm: re-parse the modified code and compare its logical structure to the
     `IntentSpec`. Flag divergences that are likely to violate the stated rule.
   - Re-generation: when drift is detected, Nova26 can offer to re-generate the code
     from the original intent (if the code was accidentally broken) or to update the
     intent to match the new code (if the intent itself changed).
   - The `.intents` file: a human-readable, version-controlled file (similar to
     `.novarc`) that stores all `IntentSpec` entries for the project. This file is the
     "living specification" — it should be readable by non-engineers and reviewable in
     a standard PR process.

3. **Iterative refinement.** Define the multi-turn refinement flow:

   - Initial generation: user states the intent, Nova26 generates code and tests.
   - Refinement: user says "make it also check if they're a premium user" — Nova26
     parses the refinement as an additive constraint, updates the `IntentSpec`, and
     regenerates only the affected code and tests. Show the updated parse tree and the
     diff of the generated code.
   - Contradiction handling: "make it send the email immediately" contradicts the
     "after 24 hours" rule. Nova26 detects the contradiction, surfaces it, and asks
     the user to resolve it before generating new code.
   - Refinement history: the `RefinementHistory` type tracks every version of an intent
     and what changed in each iteration. This is both a debugging tool and a product
     insight (which intents require the most refinement = which domains have the highest
     natural language ambiguity).

4. **Relationship to the existing PRD → build flow.** Clarify where this feature sits
   in the Nova26 hierarchy:

   - PRD → build (existing): high-level, architectural, multi-feature. The output is
     a codebase, not a function.
   - Intent → code (new): granular, rule-level, single-function or single-workflow.
     The output is a TypeScript function or class with tests and a living spec.
   - Composition: a PRD can reference intent specs. "Build a user onboarding flow"
     as a PRD might decompose into 5 individual intent specs (welcome email timing,
     profile completion nudge, first-build celebration, etc.), each independently
     maintained.
   - JUPITER's role: when decomposing a PRD, JUPITER can identify which tasks are
     appropriate for intent-level specification and tag them for this pipeline.

5. **Literate programming integration.** Connect to the literate programming tradition:

   - The `.intents` file as a literate programming artifact: each intent spec is a
     natural language paragraph followed by the code it generates, rendered together.
     Show an example of a formatted `.intents` entry.
   - Documentation generation: from the `.intents` file, Nova26 can generate a
     human-readable specification document (Markdown) that describes the system's
     business rules in plain English. This is the closest thing to a living PRD at
     the function level.
   - How this integrates with the GROK-R14-01 documentation system: intent specs
     can be exported to the docs site as the "Business Logic Reference" section —
     the part of the docs that describes not how the system works technically, but
     what it is supposed to do.

6. **TypeScript interfaces.** Define the complete type system:

   ```typescript
   // Extend RalphLoopOptions
   interface RalphLoopOptions {
     // ... existing options
     intentProgrammingEnabled?: boolean;
     intentConfig?: IntentProgrammingConfig;
   }

   interface IntentProgrammingConfig {
     intentsFilePath: string;            // default: '.nova/intents.md'
     driftDetectionEnabled: boolean;     // default: true
     driftThreshold: number;             // 0-1, how different code must be to flag drift
     autoGenerateTests: boolean;         // default: true
     linkToTasteVault: boolean;          // default: true
   }

   interface IntentSpec {
     id: string;
     naturalLanguage: string;            // the original stated intent
     parsedIntent: ParsedIntent;
     refinementHistory: RefinementHistory[];
     codeBindings: CodeBinding[];
     status: 'active' | 'drifted' | 'archived';
     createdAt: string;
     lastRefinedAt: string;
     createdBy: 'human' | AgentName;
   }

   interface ParsedIntent {
     trigger?: IntentTrigger;
     conditions: IntentCondition[];
     actions: IntentAction[];
     exceptions: IntentCondition[];
     timing?: IntentTiming;
     confidence: number;                 // 0-1, how confident the parser is
     ambiguities: string[];              // ambiguous phrases that needed resolution
   }

   interface IntentTrigger {
     type: 'event' | 'schedule' | 'condition' | 'manual';
     description: string;
     eventName?: string;                 // e.g., 'user.signup'
     cronExpression?: string;
   }

   interface IntentCondition {
     description: string;
     field?: string;
     operator?: 'equals' | 'not-equals' | 'greater-than' | 'less-than' | 'contains' | 'exists';
     value?: unknown;
     evaluationTime?: 'at-trigger' | 'at-execution';  // important for delayed actions
   }

   interface IntentAction {
     type: 'send-email' | 'create-record' | 'update-record' | 'call-function' |
           'send-notification' | 'trigger-event' | 'custom';
     description: string;
     parameters: Record<string, unknown>;
   }

   interface IntentTiming {
     type: 'immediate' | 'delayed' | 'scheduled';
     delayMs?: number;
     cronExpression?: string;
     description: string;               // human-readable: "after 24 hours"
   }

   interface CodeBinding {
     intentId: string;
     filePath: string;
     startLine: number;
     endLine: number;
     gitCommitHash: string;
     generatedAt: string;
     driftDetectedAt?: string;
     driftScore?: number;               // 0-1, how far the code has drifted from intent
     isDrifted: boolean;
   }

   interface RefinementHistory {
     id: string;
     intentId: string;
     iteration: number;
     previousNaturalLanguage: string;
     newNaturalLanguage: string;
     refinementStatement: string;       // what the user said to trigger this refinement
     changeType: 'additive' | 'restrictive' | 'replacement' | 'contradiction-resolved';
     codeDiff: string;                  // unified diff of the generated code change
     testsDiff: string;                 // unified diff of the test changes
     refinedAt: string;
     refinedBy: 'human' | AgentName;
   }
   ```

7. **CLI surface.** Define the natural language programming CLI commands:

   ```
   nova26 intent add               # Interactive: state an intent, get generated code
   nova26 intent add "When a user signs up..."  # Inline intent statement
   nova26 intent list              # List all intents with status (active/drifted/archived)
   nova26 intent show <id>         # Show intent with code binding and history
   nova26 intent refine <id>       # Interactive refinement of an existing intent
   nova26 intent status            # Show drift report: which intents have drifted
   nova26 intent sync              # Re-generate drifted code from intents
   nova26 intent export            # Export intents as a human-readable spec document
   nova26 intent archive <id>      # Archive an intent (code remains, spec is marked inactive)
   ```

8. **Open questions.** List 3-5 hard implementation questions: what natural language
   parser to use (a zero-shot LLM parse via the existing Ollama model is the simplest
   path, but structured output via the existing Zod schemas in `src/llm/structured-output.ts`
   is more reliable — define the structured output schema for `ParsedIntent`); how to
   handle intents that span multiple files (the "when a user signs up" rule might touch
   the auth module, the email service, and the scheduler — how are multi-file code
   bindings tracked?); whether the `.intents` file should be machine-readable YAML or
   human-readable Markdown with YAML frontmatter (the literate programming argument
   favors Markdown; the tooling argument favors structured YAML); and how to handle
   intents that conflict with each other (two intents both trigger on the same event
   and produce conflicting actions — how does Nova26 detect and surface this?).

---

### GROK-R15-05: Self-Healing Codebase

**The ask:** A garden is not something you build once and walk away from — it is something
that requires continuous attention, pruning, and adaptation to remain healthy. Most codebases
are treated like architecture: designed, constructed, and then left to entropy. Dependencies
go stale. Test coverage erodes as features are added. Performance regressions accumulate
one imperceptible millisecond at a time. Technical debt compounds silently. The team notices
when it is too late — when the CI pipeline is taking 45 minutes, when a critical dependency
is 18 months behind its current version, when the test suite has 40% coverage on the module
that just failed in production. Nova26's 21 agents, running locally on the user's machine,
are perfectly positioned to be the gardeners — working quietly in the background, pruning
dead branches, catching regressions before they compound, and surfacing the health of the
codebase as a legible signal rather than an accumulating debt.

Produce a complete specification for Nova26's self-healing codebase layer covering:

1. **The health monitoring daemon.** Define the background process that runs between builds:

   - Process model: a lightweight TypeScript daemon (`nova26 monitor` / `nova26 monitor --daemon`)
     that runs independently of the Ralph Loop. It polls for health signals at configurable
     intervals. On a local machine with limited resources, it should be resource-frugal:
     no GPU inference during health checks (use fast, lightweight Ollama models for
     any LLM-assisted analysis, or no LLM at all for purely structural checks).
   - Health checks taxonomy: define four categories of checks — Structural (TypeScript
     compilation, linting), Temporal (test coverage trends, build time trends), Dependency
     (package versions, CVEs via the R15-01 integration), and Complexity (cyclomatic
     complexity, coupling metrics, file size growth).
   - Scheduling: structural checks run on every file save; temporal checks run after
     every build; dependency checks run daily; complexity checks run weekly. All intervals
     are configurable.
   - The daemon's resource budget: define the maximum CPU and memory the daemon may use.
     Suggest: 10% CPU, 256MB RAM. If a health check would exceed this, it defers to the
     next scheduled window.

2. **Proactive bug detection.** Define what "proactive" means in concrete terms:

   - Static analysis: TypeScript strict mode violations that are caught before `tsc`
     is run (using ts-morph to analyze the AST incrementally), unreachable code
     detection, unused variables and imports (beyond what ESLint covers), and type
     assertions that are likely to be wrong (`as any`, `as unknown as X`).
   - Pattern-based bug detection: using the Taste Vault's pattern library, detect when
     code uses a pattern that has historically been associated with failures (e.g., a
     `Promise` that is not awaited in a context where the codebase always awaits
     similar calls). Define how this pattern-based detection works — it is essentially
     semantic search (from R13/frontier sprint) applied to anti-patterns.
   - The "likely-to-fail" score: define a 0-100 score for each file in the codebase
     that represents the probability of that file containing a latent bug. High-scoring
     files should be surfaced in `nova26 health status` and flagged for the user's
     attention before they become production issues.

3. **Auto-fix when tests fail.** Define the CI loop for automated remediation:

   - Trigger: CI reports a failing test (via the existing `ciMode` integration in
     `RalphLoopOptions`). Nova26 receives the failure report, including the test name,
     the assertion that failed, and the relevant code context.
   - Triage: MERCURY (quality gate) determines whether the failure is likely caused by:
     (a) a code regression that can be auto-fixed, (b) a flaky test that should be
     quarantined, or (c) a genuinely broken feature that requires human review.
   - Auto-fix loop: for case (a), MARS attempts to fix the failing code, re-runs the
     test suite locally, and if the fix results in a passing suite, opens a PR with the
     fix. Define the PR template for auto-fix PRs — it must be clearly labeled as
     auto-generated and must include the test failure, the fix rationale, and a
     request for human review before merge.
   - Escalation: if the auto-fix loop fails after 3 attempts, it escalates to the
     human via a CLI notification and a GitHub issue with the full diagnostic context.
   - Safety rails: the auto-fix loop must never modify tests to make them pass (a
     common failure mode for naive auto-fixers). Define the guardrail that prevents this.

4. **Performance regression detection.** Define the performance monitoring model:

   - Metrics tracked: build time (time to complete a full Ralph Loop), test suite
     duration, TypeScript compilation time, bundle size (if applicable), and a
     configurable set of user-defined metrics (API response time benchmarks, etc.)
   - Baseline establishment: the first 10 builds after enabling `healthMonitorEnabled`
     establish the baseline. Define the baseline computation (median of the 10 builds,
     excluding outliers more than 2 standard deviations from the mean).
   - Regression threshold: a metric that exceeds the baseline by more than 15% (configurable)
     on 3 consecutive builds is flagged as a regression. Define the alert format and
     the diagnostic context included (which build introduced the regression, what changed).
   - Root cause analysis: when a build time regression is detected, Nova26 should
     analyze which phase of the build slowed down (JUPITER decomposition, MARS generation,
     PLUTO tests, SATURN review) and surface the bottleneck. This is different from
     simply reporting that the build is slow — it tells the user where to look.

5. **Safe dependency updates.** Define the dependency update pipeline:

   - Candidate selection: once per week, Nova26 identifies packages with available
     updates. Patches (semver `z` increment) are applied automatically at autonomy
     level 3+. Minor updates (semver `y` increment) are proposed but require approval.
     Major updates (semver `x` increment) are surfaced in a report and never auto-applied.
   - Update testing: for each candidate update, Nova26 applies the update in isolation,
     runs the full test suite, and reports the result. If tests pass, the update is
     safe. If tests fail, Nova26 reverts the update and logs the incompatibility.
   - Security-driven updates: CVE findings from R15-01 can promote a patch or minor
     update from "proposed" to "auto-applied" even at lower autonomy levels, because
     the security risk of not updating outweighs the risk of the update.
   - Update PRs: all auto-applied updates are batched into a single weekly PR (not one
     PR per package — this is deliberately designed to reduce PR noise, following
     Dependabot's most effective configuration). Define the PR template.

6. **Code health dashboard.** Define the `nova26 health status` output:

   ```
   nova26 health status

   Code Health — my-saas-app
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Overall Health Score    78 / 100   (Good)     ↑ +3 from last week

   Test Coverage           82%        (OK)       ↔ stable
   TypeScript Strict       0 errors   (OK)       ↔ stable
   Security Score          71 / 100   (Fair)     ↑ +5 (CVE-2024-xxx patched)
   Technical Debt Score    64 / 100   (Fair)     ↓ -4 (complexity rising in src/api/)
   Dependency Freshness    91 / 100   (Good)     ↑ +8 (3 patches auto-applied)
   Build Time              2m 14s     (OK)       ↑ +12s regression in PLUTO phase

   Attention Needed
     1. REGRESSION: Build time up 12s — PLUTO test phase slower since b3f9k2
        Likely cause: 3 new integration tests added in src/api/billing.test.ts
        Action: nova26 health diagnose --metric build-time

     2. RISING COMPLEXITY: src/api/ complexity score 74 → 89 over 14 days
        Files: src/api/payments.ts (+18%), src/api/subscriptions.ts (+22%)
        Action: nova26 health refactor-plan src/api/

     3. DEPENDENCY: lodash@4.17.19 has 2 minor updates available
        Action: nova26 health update --package lodash --preview

   Next scheduled deep scan: tonight at 2:00 AM
   ```

7. **Maintenance mode.** The premium differentiation feature — define it precisely:

   - What it is: `nova26 maintain` (or `nova26 monitor --maintain`) starts a maintenance
     session where agents actively improve the codebase rather than passively monitoring
     it. The user sets a maintenance budget (e.g., "spend up to 2 hours improving the
     codebase while I sleep") and Nova26 works through a prioritized list of improvements.
   - Maintenance tasks by priority: (1) auto-fix failing tests, (2) apply safe dependency
     updates, (3) refactor highest-complexity files, (4) improve test coverage on
     uncovered paths, (5) update inline documentation on recently changed functions.
   - The maintenance log: a human-readable log of everything Nova26 did during the
     maintenance session, presented as a summary when the user wakes up. Define the
     log format — it should feel like a note from a colleague who worked overnight.
   - Safety boundaries: maintenance mode must never (a) modify the public API surface
     of any module, (b) change test assertions (only add new tests), (c) modify
     configuration files, or (d) make changes that would require a human decision
     (leave those in the morning report). Define these as hard-coded guardrails, not
     configurable options.
   - The morning report: when the user runs `nova26 health morning`, they get a compact
     summary of overnight maintenance: what was fixed, what was improved, what was
     deferred for human review, and the delta in the Code Health Score.

8. **TypeScript interfaces.** Define the complete type system:

   ```typescript
   // Extend RalphLoopOptions
   interface RalphLoopOptions {
     // ... existing options
     healthMonitorEnabled?: boolean;
     healthConfig?: HealthMonitorConfig;
   }

   interface HealthMonitorConfig {
     daemonEnabled: boolean;             // run as background process
     resourceBudget: {
       maxCpuPercent: number;            // default: 10
       maxMemoryMb: number;              // default: 256
     };
     schedules: {
       structuralCheckOnSave: boolean;   // default: true
       temporalCheckAfterBuild: boolean; // default: true
       dependencyCheckCron: string;      // default: '0 3 * * *' (3am daily)
       complexityCheckCron: string;      // default: '0 4 * * 0' (4am Sunday)
     };
     regressionThresholdPercent: number; // default: 15
     regressionConsecutiveBuilds: number;// default: 3
     maintenanceBudgetHours?: number;    // for maintenance mode
     maintenanceSchedule?: string;       // cron expression for scheduled maintenance
   }

   interface HealthMonitor {
     id: string;
     projectId: string;
     config: HealthMonitorConfig;
     currentScore: CodeHealthScore;
     scoreHistory: Array<{ date: string; score: CodeHealthScore }>;
     activeAlerts: HealthAlert[];
     lastCheckedAt: string;
     daemonStatus: 'running' | 'stopped' | 'error';
   }

   interface CodeHealthScore {
     overall: number;                    // 0-100
     grade: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
     dimensions: {
       testCoverage: number;             // 0-100
       typeScriptStrict: number;         // 0-100 (100 = 0 errors)
       securityScore: number;            // from R15-01 SecurityScore
       technicalDebt: number;            // 0-100 (inverse of debt)
       dependencyFreshness: number;      // 0-100
       buildPerformance: number;         // 0-100 (vs. baseline)
     };
     trend: 'improving' | 'stable' | 'degrading';
     deltaFromLastWeek: number;          // signed integer
   }

   type AlertSeverity = 'critical' | 'warning' | 'info';
   type AlertCategory =
     | 'test-failure'
     | 'performance-regression'
     | 'security-vulnerability'
     | 'complexity-rising'
     | 'dependency-stale'
     | 'coverage-dropping';

   interface HealthAlert {
     id: string;
     severity: AlertSeverity;
     category: AlertCategory;
     title: string;
     description: string;
     detectedAt: string;
     metric?: string;
     metricCurrent?: number;
     metricBaseline?: number;
     affectedFiles?: string[];
     suggestedAction: string;
     suggestedCommand?: string;
     autoFixAvailable: boolean;
     status: 'open' | 'in-progress' | 'resolved' | 'suppressed';
   }

   interface AutoFix {
     id: string;
     alertId: string;
     triggeredAt: string;
     triggeredBy: 'ci-failure' | 'manual' | 'maintenance-mode';
     assignedAgent: AgentName;
     attempts: number;
     maxAttempts: number;
     status: 'pending' | 'running' | 'succeeded' | 'failed' | 'escalated';
     fixDescription?: string;
     codeDiff?: string;
     prUrl?: string;
     failureReason?: string;
     escalatedAt?: string;
   }

   interface MaintenanceTask {
     id: string;
     sessionId: string;
     type: 'fix-failing-test' | 'update-dependency' | 'refactor-complexity' |
           'improve-coverage' | 'update-documentation';
     priority: number;                   // 1 = highest
     description: string;
     assignedAgent: AgentName;
     status: 'queued' | 'running' | 'completed' | 'deferred' | 'failed';
     estimatedMinutes: number;
     actualMinutes?: number;
     outcome?: string;                   // human-readable description of what was done
     codeDiff?: string;
     deferredReason?: string;            // why it was not attempted
     completedAt?: string;
   }

   interface MaintenanceSession {
     id: string;
     projectId: string;
     startedAt: string;
     budgetMinutes: number;
     usedMinutes: number;
     tasks: MaintenanceTask[];
     healthScoreBefore: CodeHealthScore;
     healthScoreAfter?: CodeHealthScore;
     status: 'running' | 'completed' | 'aborted';
     morningReport?: string;             // Markdown summary for the user
   }
   ```

9. **CLI surface.** Define the health and maintenance CLI commands:

   ```
   nova26 health status            # Current Code Health Score with breakdown
   nova26 health status --watch    # Live-updating health dashboard (terminal UI)
   nova26 health morning           # Summary of overnight maintenance session
   nova26 health alerts            # List all open health alerts
   nova26 health diagnose --metric build-time  # Deep-dive on a specific metric
   nova26 health refactor-plan <path>  # Generate a refactoring plan for a file/directory
   nova26 health update --preview  # Preview available dependency updates
   nova26 health update --apply    # Apply safe dependency updates
   nova26 health history           # Code Health Score history (30-day chart in terminal)
   nova26 monitor                  # Start the health monitor (foreground mode)
   nova26 monitor --daemon         # Start as a background daemon
   nova26 monitor --stop           # Stop the daemon
   nova26 monitor --status         # Check if daemon is running
   nova26 maintain                 # Run a maintenance session now (interactive)
   nova26 maintain --budget 2h     # Non-interactive maintenance with time budget
   nova26 maintain --schedule "0 2 * * *"  # Schedule nightly maintenance
   ```

10. **The premium stickiness argument.** This is the business case for R15-05 — write
    the 150-word pitch for why self-healing is the ultimate premium retention mechanic:

    A user who cancels Nova26 cancels it because they do not see daily value — the tool
    is only present when they are actively building. Self-healing changes the relationship.
    The codebase gets better overnight. Dependencies are up to date. The security score
    improves. Technical debt is actively pruned. The user wakes up to a morning report
    that tells them what Nova26 did while they slept — not a passive notification, but a
    colleague's summary of genuine work performed. This is the tool that justifies $299/month
    even on days when the user does not open an editor. It is the first AI IDE that earns
    its keep 24 hours a day. And the cancellation conversation becomes: "If I cancel,
    who prunes the garden?" The answer — "you do, manually, at 2am" — is the retention
    mechanic. Not a dark pattern. A genuine value proposition.

11. **Open questions.** List 3-5 hard implementation questions: whether the daemon should
    use the full Ollama model (expensive) or a lightweight model (fast but less capable)
    for proactive bug detection — recommend a tiered model strategy where structural checks
    use no LLM, complexity analysis uses a lightweight model, and auto-fix uses the full
    model only when a fix is actually needed; how to handle maintenance mode on a machine
    that the user is actively using (the daemon should detect active user sessions and
    defer heavy operations like refactoring to idle periods); whether auto-fix PRs should
    go through the full ACE quality loop (slower but higher quality) or a streamlined
    single-pass (faster but potentially lower quality for the fix itself); and how to
    define the public API surface guardrail (static analysis of exported functions and
    their signatures — changes to exports are blocked; changes to internal implementations
    are allowed).

---

## Output Format

- Label each section clearly: `## GROK-R15-01`, `## GROK-R15-02`, etc.
- Begin each deliverable with the big-picture analogy paragraph before any technical content.
- Use TypeScript for all interfaces and configuration schemas — interfaces must be complete
  and directly buildable (no placeholder fields, no `// TODO` stubs).
- Use tables for comparisons, taxonomies, and command inventories.
- Reference real Nova26 file paths where applicable:
  - `src/orchestrator/ralph-loop.ts`
  - `src/orchestrator/prompt-builder.ts`
  - `src/agent-loop/agent-loop.ts`
  - `src/llm/structured-output.ts`
  - `convex/schema.ts`
  - `.novarc`
- Each deliverable must be independently actionable — a person picking up GROK-R15-03
  (Multiplayer) should not need to have read R15-01 (Security) first.
- Estimated output: 2,500-4,000 words per deliverable, 12,500-20,000 words total.
- Where this spec asks for a "worked example," write the actual example — complete
  TypeScript code, complete Mermaid diagram, complete CLI output. Not an outline.
- Where this spec asks for an "honest competitive analysis," be honest. Acknowledge
  what Nova26 cannot do yet. The goal is a credible spec, not a marketing document.
- The TypeScript interfaces defined here extend the cumulative `RalphLoopOptions` type
  in `src/orchestrator/ralph-loop.ts`. Each new `*Config` type and `*Enabled` flag
  follows the existing naming convention exactly.

---

## Reference: Key Nova26 Types

For accuracy and consistency, these are the core types from `src/types/index.ts` that
your specs must build on or extend:

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

// Ralph Loop options (cumulative — R15 adds to this)
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
  // R15 additions — each deliverable adds its own pair:
  securityAuditEnabled?: boolean;
  securityConfig?: SecurityConfig;
  dbDesignEnabled?: boolean;
  dbDesignConfig?: DatabaseDesignConfig;
  multiplayerEnabled?: boolean;
  multiplayerConfig?: MultiplayerConfig;
  intentProgrammingEnabled?: boolean;
  intentConfig?: IntentProgrammingConfig;
  healthMonitorEnabled?: boolean;
  healthConfig?: HealthMonitorConfig;
}
```

The existing Convex tables (`builds`, `tasks`, `executions`, `patterns`, `agents`,
`companyAgents`, `learnings`, `userEngagement`, `churnRisk`) must not be modified.
New tables required by R15 deliverables (multiplayer session tables, health monitor
tables) must be specified as explicit additions with full Convex schema definitions,
following the existing naming conventions in `convex/schema.ts`.

---

## Coordination Note

R15 is the first research round that is explicitly post-launch. The deliverables are not
features for the initial $299/month release — they are the roadmap for Nova26 v2. As such:

- Kimi's frontier sprint (agent communication, semantic search, predictive decomposition,
  personality, offline-first) takes priority over any R15 feature if there is a resource
  conflict. R15 specs must not assume any R15 feature is in production.
- GROK-R15-01 (Security) builds on the existing `ciMode` and MERCURY agent — it should
  be designed to integrate without breaking the existing gate-runner pattern.
- GROK-R15-02 (Database) builds on PLUTO's existing test infrastructure — the new schema
  design capabilities extend, rather than replace, PLUTO's testing role.
- GROK-R15-03 (Multiplayer) introduces new Convex tables — the schema additions defined
  in the deliverable should be treated as a binding spec for any Convex schema work.
- GROK-R15-04 (Intent Programming) integrates with the Taste Vault — the `IntentSpec`
  and `CodeBinding` types should be designed to be storable in the existing `patterns`
  table or a new `intents` table (decide and specify which).
- GROK-R15-05 (Self-Healing) introduces the most significant new system component — the
  health monitor daemon. Its resource budget and scheduling must be designed to coexist
  with the Ollama inference load from active builds.

---

*Prompt issued by Claude Code on 2026-02-18. Grok R15 output should be delivered to
`.nova/output/` or committed directly to the `grok/r15` branch for coordinator review.*
