# Kiro Task: BistroLens Comprehensive Knowledge Extraction

## Your Role
You are extracting a complete knowledge base from the BistroLens project. Another AI agent (Kimi) is separately adapting patterns for a sister project called Nova26 — your job is the RAW EXTRACTION and DOCUMENTATION. Document everything of value so any developer can find, understand, and reuse these patterns.

## Source Project
**Location:** `/Users/jonathannelsen/bistrolens-2`

## Output Location
**Write ALL files to:** `/Users/jonathannelsen/nova26/.nova/bistrolens-knowledge/`

The folder structure already exists:
```
01-security/
02-steering-system/
03-quality-gates/
04-image-governance/
05-database-patterns/
06-api-cost-protection/
07-testing-strategies/
08-design-system/
09-error-handling/
10-deployment/
11-monitoring/
12-business-logic/
13-i18n/
14-performance/
15-ai-prompts/
16-documentation/
17-nova26-adaptations/   ← DO NOT WRITE HERE (Kimi's territory)
```

**IMPORTANT:** Do NOT write to `17-nova26-adaptations/` — that folder belongs to Kimi. Write only to folders `01` through `16`.

---

## What You're Extracting

### Folder 01-security/ — Security Architecture

**Read these BistroLens files:**
- `.kiro/steering/29-SECURITY-STEERING.md`
- `.kiro/steering/39-AUTHENTICATION-AUTHORIZATION.md`
- `utils/advancedRateLimiter.ts`
- `utils/dataEncryption.ts`
- `utils/contentSafety.ts`
- `utils/ddosProtection.ts`
- `api/waf-middleware.ts`
- `api/middleware.ts`
- `scripts/enhanced-rls-policies.sql`

**Create these files:**
- `01-security/rate-limiting-patterns.md` — Complete rate limiting architecture (per-minute, per-hour, per-day, per-user). Include code examples.
- `01-security/encryption-patterns.md` — Data encryption approaches, PII handling, key management.
- `01-security/content-safety.md` — Input validation, XSS prevention, SQL injection prevention, content moderation.
- `01-security/waf-rules.md` — WAF middleware patterns, bot detection, DDoS mitigation.
- `01-security/rls-policies.md` — Row-level security patterns, data isolation, soft delete.
- `01-security/auth-patterns.md` — Authentication flows, authorization models, session management.
- `01-security/security-layers-overview.md` — How all security layers work together (the big picture).

### Folder 02-steering-system/ — Steering File Architecture

**Read these BistroLens files:**
- `.kiro/steering/README-STEERING-USAGE.md`
- `.kiro/steering/00-KIRO-MASTER-PROMPT.md`
- ALL files in `.kiro/steering/` (there are 34 files — read every one)

**Create these files:**
- `02-steering-system/architecture.md` — Complete steering system design: inclusion patterns (always/fileMatch/manual), priority system, conflict resolution, context management.
- `02-steering-system/file-catalog.md` — Catalog of every steering file with: filename, purpose, inclusion pattern, priority level, what it controls.
- `02-steering-system/template.md` — Template for creating new steering files, with examples.
- `02-steering-system/context-management.md` — How BistroLens prevents context bloat, which files load when, token budget strategies.

### Folder 03-quality-gates/ — Hooks & Quality Automation

**Read these BistroLens files:**
- `.kiro/hooks/pre-commit-quality.json`
- `.kiro/hooks/security-scan.json`
- `.kiro/hooks/accessibility-audit.json`
- `.kiro/hooks/performance-check.json`
- `.kiro/hooks/api-cost-monitor.json`
- `.kiro/hooks/test-runner.json`
- `.kiro/hooks/release-checklist.json`
- `.kiro/hooks/i18n-string-check.json`
- `.kiro/hooks/documentation-sync.json`

**Create these files:**
- `03-quality-gates/hook-system-architecture.md` — How the hook system works: trigger events, check logic, pass/fail handling, blocking vs warning.
- `03-quality-gates/all-hooks-detailed.md` — Every hook documented: what it checks, when it triggers, what fails it, what it warns on. Include the full JSON config for each.
- `03-quality-gates/hook-template.md` — Template for creating new hooks.

### Folder 04-image-governance/ — Image Generation & Dataset Governance

**Read these BistroLens files:**
- `.kiro/steering/04-IMAGE-SYSTEM-MASTER.md`
- `.kiro/steering/30-IMAGE-GENERATION-GOVERNANCE.md`
- `.kiro/steering/35-IMAGE-GOVERNANCE-ENFORCEMENT.md`
- `.kiro/steering/36-IMAGE-SYSTEM-RED-LINES.md`
- `.kiro/steering/37-IMAGE-DATASET-ABSOLUTE-NO.md`
- `.kiro/steering/05-FIRST-DATASET-RUN-PLAN.md`
- `.kiro/prompts/GEMINI_IMAGE_GENERATION_SUB_PROMPT.md`
- `.kiro/prompts/IMAGE_SYSTEM_LINT_VALIDATOR.md`
- `.kiro/prompts/INITIAL_IMAGE_DATASET_EXECUTION.md`
- `convex/imageDataset.ts` (if exists)
- `utils/imageGovernance.ts` (if exists)
- `src/policies/ImageGenerationPolicy.ts` (if exists)

**Create these files:**
- `04-image-governance/governance-model.md` — Complete governance framework: policies, red lines, kill switches, approval workflows, auto-pause conditions.
- `04-image-governance/dataset-architecture.md` — How permanent datasets are built: metadata schema, deduplication (perceptual hashing), reuse-before-regenerate logic, storage strategies.
- `04-image-governance/quality-scoring.md` — How image quality is scored and validated.
- `04-image-governance/red-lines.md` — Absolute prohibitions and enforcement mechanisms.
- `04-image-governance/prompts.md` — Image generation prompts, sub-prompt delegation, validation prompts.

### Folder 05-database-patterns/ — Convex & Database Architecture

**Read these BistroLens files:**
- `.kiro/steering/38-CONVEX-DATABASE-PATTERNS.md`
- `convex/schema.ts`
- `convex/auth.ts`
- `convex/social.ts` (if exists)
- `convex/analytics.ts` (if exists)
- `scripts/enhanced-rls-policies.sql`

**Create these files:**
- `05-database-patterns/convex-best-practices.md` — Schema design patterns, query optimization, real-time subscriptions, mutation patterns, security guards.
- `05-database-patterns/schema-design.md` — Full schema analysis: tables, indexes, relationships, validators.
- `05-database-patterns/rls-patterns.md` — Row-level security implementation with SQL examples.

### Folder 06-api-cost-protection/ — API Cost Management

**Read these BistroLens files:**
- `.kiro/steering/31-API-COST-PROTECTION.md`
- `api/rateLimiter.ts` (if exists)
- `services/tierLimits.ts` (if exists)

**Create these files:**
- `06-api-cost-protection/cost-architecture.md` — Per-user budgets, daily/monthly limits, caching strategies, circuit breakers, fallback mechanisms. Include code examples.

### Folder 07-testing-strategies/ — Testing & QA

**Read these BistroLens files:**
- `.kiro/steering/01-QA-TEST-SUITE.md`
- `.kiro/testing/TESTPLAN.md`
- `.kiro/testing/tests/` (any test files)
- `api/stripe/__tests__/` (if exists)
- `components/design-system/__tests__/` (if exists)

**Create these files:**
- `07-testing-strategies/testing-philosophy.md` — Testing strategy, coverage requirements, test organization.
- `07-testing-strategies/test-plan-template.md` — Complete test plan structure that can be reused.
- `07-testing-strategies/test-patterns.md` — Property-based testing, integration patterns, E2E patterns with code examples.

### Folder 08-design-system/ — UI/UX & Accessibility

**Read these BistroLens files:**
- `.kiro/steering/34-BRAND-VOICE-UX.md`
- `.kiro/steering/50-ACCESSIBILITY-WCAG-COMPLIANCE.md`
- `components/design-system/tokens.ts` (if exists)
- `components/design-system/Button.tsx` (if exists)
- `components/design-system/PrimaryAction.tsx` (if exists)
- Any other files in `components/design-system/`

**Create these files:**
- `08-design-system/token-architecture.md` — Design tokens: colors, spacing, typography, shadows, breakpoints.
- `08-design-system/component-patterns.md` — Component architecture, props patterns, composition.
- `08-design-system/accessibility-requirements.md` — Complete WCAG compliance rules, touch targets, keyboard nav, screen reader patterns.
- `08-design-system/brand-voice.md` — Tone, microcopy patterns, error message voice.

### Folder 09-error-handling/ — Error UX

**Read these BistroLens files:**
- `.kiro/steering/48-ERROR-HANDLING-UX.md`

**Create these files:**
- `09-error-handling/error-patterns.md` — Error message patterns, retry logic, graceful degradation, fallback content, loading states. Include code examples.

### Folder 10-deployment/ — Deployment & Release

**Read these BistroLens files:**
- `.kiro/steering/49-DEPLOYMENT-RELEASE-PROCESS.md`
- `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md` (if exists)

**Create these files:**
- `10-deployment/deployment-process.md` — Complete deployment workflow, pre/post checklists, rollback procedures, environment management.

### Folder 11-monitoring/ — Observability

**Read these BistroLens files:**
- `docs/SENTRY_MONITORING_SETUP.md` (if exists)
- `utils/sentry.ts` (if exists)
- `services/performanceMonitoringService.ts` (if exists)

**Create these files:**
- `11-monitoring/monitoring-architecture.md` — Error tracking, performance monitoring, analytics, alert thresholds.

### Folder 12-business-logic/ — Business Patterns

**Read these BistroLens files:**
- `.kiro/steering/41-SUBSCRIPTION-TIER-ENFORCEMENT.md`
- `.kiro/steering/45-AFFILIATE-PROGRAM-RULES.md`
- `.kiro/steering/44-SOCIAL-FEATURES-MODERATION.md`
- `services/tierLimits.ts` (if exists)
- `services/affiliateService.ts` (if exists)

**Create these files:**
- `12-business-logic/tier-enforcement.md` — Subscription tier patterns, feature gating, usage tracking, upgrade prompts.
- `12-business-logic/affiliate-system.md` — Affiliate tracking, commission calculation, fraud prevention.
- `12-business-logic/content-moderation.md` — Social features moderation, user-generated content safety.

### Folder 13-i18n/ — Internationalization

**Read these BistroLens files:**
- `.kiro/steering/32-INTERNATIONALIZATION.md`
- `lib/i18n.ts` (if exists)

**Create these files:**
- `13-i18n/i18n-architecture.md` — Language detection, translation management, locale formatting, RTL support.

### Folder 14-performance/ — Performance Optimization

**Read these BistroLens files:**
- `docs/PERFORMANCE-OPTIMIZATION-IMPLEMENTATION.md` (if exists)
- `utils/cachingStrategy.ts` (if exists)
- `utils/imageOptimizer.ts` (if exists)
- `utils/advancedLazyLoading.ts` (if exists)

**Create these files:**
- `14-performance/optimization-patterns.md` — Caching strategies, lazy loading, code splitting, image optimization, bundle optimization with code examples.

### Folder 15-ai-prompts/ — AI Prompt Engineering

**Read these BistroLens files:**
- `.kiro/steering/40-AI-PROMPT-ENGINEERING.md`
- `.kiro/steering/42-RECIPE-GENERATION-RULES.md`
- `.kiro/steering/43-LIVE-CHEF-VOICE-GUIDELINES.md`
- `.kiro/prompts/GEMINI_IMAGE_GENERATION_SUB_PROMPT.md`
- `.kiro/prompts/SINGLE_LINE_SYSTEM_INSTRUCTION.md`
- `services/geminiService.ts` (if exists)

**Create these files:**
- `15-ai-prompts/prompt-engineering-framework.md` — Prompt structure patterns, sub-prompt delegation, context management, output validation.
- `15-ai-prompts/content-generation-rules.md` — Rules for AI-generated content: consistency, safety, quality checks.
- `15-ai-prompts/prompt-templates.md` — Reusable prompt templates with fill-in-the-blank sections.

### Folder 16-documentation/ — Documentation Practices

**Read these BistroLens files:**
- `.kiro/steering/99-DOCUMENTATION-UPDATES.md`
- All files in `docs/` directory

**Create these files:**
- `16-documentation/documentation-strategy.md` — What to document, when to update, automation strategies, documentation templates.

---

## Spec-Driven Development (Special Section)

**Read ALL spec directories:**
```
.kiro/specs/stripe-integration-hardening/
.kiro/specs/ui-ux-elevation/
.kiro/specs/daily-cooking-prompt/
.kiro/specs/recipe-pdf-landscape/
.kiro/specs/image-dataset-bootstrap/
.kiro/specs/cooking-skill-progression/
.kiro/specs/voice-commands-cooking/
.kiro/specs/multi-language-support/
.kiro/specs/seo-collections-growth/
.kiro/specs/recipe-cost-calculator/
.kiro/specs/ingredient-substitution/
.kiro/specs/leftover-recipes/
.kiro/specs/recipe-remix-history/
.kiro/specs/pre-generated-step-images/
.kiro/specs/bento-seo-dataset-admin-system/
.kiro/specs/chef-master-gate-standardization/
```

For each spec, read `requirements.md`, `design.md`, and `tasks.md` if they exist.

**Create:** `03-quality-gates/spec-driven-development.md` — Complete spec system documentation: structure, templates, how requirements flow to design to tasks, acceptance criteria format, user story patterns. Include 2-3 example specs condensed.

---

## Output Format for Each Pattern

Use this format consistently:

```markdown
### Pattern: [Descriptive Name]

**Category:** [Security/Database/UI/etc.]
**Source File:** [Exact BistroLens file path]

**Problem Solved:** [1-2 sentences on what problem this addresses]

**How BistroLens Implements It:**
[Detailed description with code examples where relevant]

**Key Insights:**
- [What makes this approach valuable?]
- [What are the trade-offs?]
- [When should you use this vs. alternatives?]

**Reusability Score:** [1-10]
- 10 = Copy-paste ready for any project
- 5 = Needs adaptation but concept is universal
- 1 = Very BistroLens-specific

**Code Example:**
```[language]
[Relevant code from BistroLens, with comments explaining key parts]
```
```

---

## Rules

1. READ ONLY from `/Users/jonathannelsen/bistrolens-2` — never modify BistroLens files
2. WRITE ONLY to `/Users/jonathannelsen/nova26/.nova/bistrolens-knowledge/` folders 01-16
3. Do NOT write to folder `17-nova26-adaptations/` — that's Kimi's territory
4. If a file doesn't exist (marked "if exists"), skip it and note it was missing
5. Include ACTUAL CODE from BistroLens files — not just descriptions. Developers need to see the real implementation.
6. If a steering file contains rules/constraints, reproduce them verbatim — these are the valuable parts
7. Aim for 50+ documented patterns across all categories
8. Create an `INDEX.md` at the root of `bistrolens-knowledge/` that lists every pattern with its location and reusability score

---

## Create This File Last

**`/Users/jonathannelsen/nova26/.nova/bistrolens-knowledge/INDEX.md`**

A master index of every pattern extracted, organized by:
1. Category
2. Reusability score (highest first within each category)
3. File location

This is the "table of contents" that makes the whole knowledge base navigable.
