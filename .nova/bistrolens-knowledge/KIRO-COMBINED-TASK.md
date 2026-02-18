# Kiro Combined Task — Three Jobs in One Session

You have three jobs to complete in this session. Do them in order.

---

## JOB 1: Fix Landing Page — Remove Higgsfield, Replace with Open-Source

### Context
You previously built the Nova26 landing page in `app/(landing)/`. It references "Higgsfield" for video generation throughout. **Higgsfield is a paid service — we don't use paid tools.** Our rule: we pay ONLY for LLM models, Convex, hosting, and Clerk. Everything else must be free/open-source or built by us.

### What to Do

**1. Replace ALL Higgsfield references with open-source video generation:**

The replacement stack (all free, self-hosted, MIT/Apache licensed):
- **Open-Sora** (GitHub: hpcaitech/Open-Sora) — Open-source Sora alternative, text-to-video, Apache 2.0
- **CogVideo** (GitHub: THUDM/CogVideo) — Text-to-video from Tsinghua, Apache 2.0
- **Stable Video Diffusion** (Stability AI) — Image-to-video, open weights
- **AnimateDiff** (GitHub: guoyww/AnimateDiff) — Text-to-video animation, Apache 2.0
- **Mochi** (GitHub: genmoai/mochi) — High quality open-source video gen

**2. Update the Video Engine Modal (`app/(landing)/video-engine-modal.tsx`):**
- Replace "Higgsfield" everywhere with "Nova26 Video Engine"
- Replace model names: instead of "Kling 2.6/3.0, Sora 2, Veo 3.1, WAN 2.6, Minimax Hailuo 02, Seedance 1.5 Pro" use: "Open-Sora, CogVideo, Stable Video Diffusion, AnimateDiff, Mochi"
- The 9 prompt templates (Trend Hijacker, Hook Generator, etc.) should stay — just change the model selector dropdown to list the open-source models above
- Add a note in the UI: "All models run locally or self-hosted — zero API costs"

**3. Update the Stage Cards (`app/(landing)/stage-cards.tsx`):**
- Any reference to Higgsfield in the Post-Production card dropdown → replace with "Nova26 Video Engine (Open-Source)"
- The "Model Selector" sub-option should list the open-source models

**4. Update any other files** that reference Higgsfield — search the entire `app/` directory.

**5. Update `app/(landing)/README.md`** to reflect the open-source video stack.

### Verification
After changes, grep the entire project for "Higgsfield" or "higgsfield" — there should be ZERO results.

---

## JOB 2: Create Inspiration Folder System

An inspiration folder already exists at `.nova/inspiration/` with these subfolders:
```
screenshots/
ui-flows/
ux-patterns/
color-palettes/
competitor-references/
component-ideas/
animations/
typography/
```

A `README.md` already exists explaining the structure. Your job:

**1. Create placeholder files** in each subfolder so they're tracked in git. In each folder, create a `.gitkeep` file.

**2. Create `.nova/inspiration/CONTRIBUTION-GUIDE.md`** with instructions:
- How to add new inspiration (naming conventions: `[date]-[source]-[description].png`)
- How agents should reference inspiration files in their output
- How to tag inspiration by relevance (which agents care about which folders)
- Example: "VENUS should check `component-ideas/` and `ux-patterns/` before generating any UI"

**3. Create `.nova/inspiration/competitor-references/monday-com.md`** documenting what we took from monday.com's design:
- Clean white background
- Card-based service selector
- Purple/indigo accent (#6161FF)
- Horizontal card layout with hover dropdowns
- CTA placement below cards
- Reference the screenshot at `.nova/reference-monday-homepage.jpeg`

---

## JOB 3: BistroLens Knowledge Extraction (The Big One)

### Full Task
Read the complete task specification at:
**`/Users/jonathannelsen/nova26/.nova/bistrolens-knowledge/KIRO-EXTRACTION-TASK.md`**

That file has your complete instructions. Here's the summary:

**Source project:** `/Users/jonathannelsen/bistrolens-2`

**Output location:** `/Users/jonathannelsen/nova26/.nova/bistrolens-knowledge/` (folders 01-16 ONLY, NOT folder 17)

**What you're doing:** Comprehensive knowledge extraction from BistroLens across 16 categories:

| Folder | Category | Key Source Files |
|--------|----------|-----------------|
| 01-security/ | Security architecture | `.kiro/steering/29-SECURITY-STEERING.md`, `utils/advancedRateLimiter.ts`, `utils/dataEncryption.ts`, `utils/contentSafety.ts`, `utils/ddosProtection.ts`, `api/waf-middleware.ts`, `scripts/enhanced-rls-policies.sql` |
| 02-steering-system/ | Steering file architecture | ALL files in `.kiro/steering/` (34 files) |
| 03-quality-gates/ | Hooks & automation | ALL files in `.kiro/hooks/` (9 files), ALL spec directories in `.kiro/specs/` (16 specs) |
| 04-image-governance/ | Image generation governance | `.kiro/steering/04-*.md`, `30-*.md`, `35-*.md`, `36-*.md`, `37-*.md`, `.kiro/prompts/` |
| 05-database-patterns/ | Convex & database | `.kiro/steering/38-CONVEX-DATABASE-PATTERNS.md`, `convex/schema.ts`, `convex/auth.ts` |
| 06-api-cost-protection/ | API cost management | `.kiro/steering/31-API-COST-PROTECTION.md`, `api/rateLimiter.ts` |
| 07-testing-strategies/ | Testing & QA | `.kiro/steering/01-QA-TEST-SUITE.md`, `.kiro/testing/TESTPLAN.md` |
| 08-design-system/ | UI/UX & accessibility | `.kiro/steering/34-BRAND-VOICE-UX.md`, `50-ACCESSIBILITY-WCAG-COMPLIANCE.md`, `components/design-system/` |
| 09-error-handling/ | Error UX | `.kiro/steering/48-ERROR-HANDLING-UX.md` |
| 10-deployment/ | Deployment & release | `.kiro/steering/49-DEPLOYMENT-RELEASE-PROCESS.md`, `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md` |
| 11-monitoring/ | Observability | `docs/SENTRY_MONITORING_SETUP.md`, `utils/sentry.ts` |
| 12-business-logic/ | Business patterns | `.kiro/steering/41-*.md`, `45-*.md`, `44-*.md` |
| 13-i18n/ | Internationalization | `.kiro/steering/32-INTERNATIONALIZATION.md`, `lib/i18n.ts` |
| 14-performance/ | Performance optimization | `utils/cachingStrategy.ts`, `utils/imageOptimizer.ts`, `utils/advancedLazyLoading.ts` |
| 15-ai-prompts/ | AI prompt engineering | `.kiro/steering/40-AI-PROMPT-ENGINEERING.md`, `42-*.md`, `.kiro/prompts/` |
| 16-documentation/ | Documentation practices | `.kiro/steering/99-DOCUMENTATION-UPDATES.md`, `docs/` |

### Key Rules
- Read from `/Users/jonathannelsen/bistrolens-2` — NEVER modify BistroLens files
- Write to `/Users/jonathannelsen/nova26/.nova/bistrolens-knowledge/` folders 01-16 ONLY
- **DO NOT write to folder 17/** — that's Kimi's territory (Nova26 adaptations)
- Include ACTUAL CODE from source files, not just descriptions
- Reproduce steering file rules/constraints VERBATIM — those are the valuable parts
- If a file listed above doesn't exist, note it was missing and move on
- Aim for 50+ documented patterns across all categories

### Pattern Format
For each pattern:
```markdown
### Pattern: [Name]
**Category:** [Security/Database/UI/etc.]
**Source File:** [Exact BistroLens file path]
**Problem Solved:** [What problem this addresses]
**How BistroLens Implements It:** [Description + code]
**Key Insights:** [Why this approach, trade-offs, when to use]
**Reusability Score:** [1-10]
**Code Example:**
[Actual code from BistroLens with comments]
```

### Final Deliverable
After extracting everything, create:
**`/Users/jonathannelsen/nova26/.nova/bistrolens-knowledge/INDEX.md`**

A master index listing every pattern by category and reusability score (highest first). This is the table of contents that makes the whole knowledge base navigable.

---

## Execution Order

1. **Job 1 first** (5 min) — Fix the Higgsfield references in the landing page
2. **Job 2 second** (5 min) — Set up the inspiration folder system
3. **Job 3 last** (the bulk) — BistroLens knowledge extraction

After all three jobs, update `.nova/AI_COORDINATION.md` to log what you completed.

---

## Philosophy Reminder
**We do not pay for tools we can build or find open-source.** The only paid services are:
- LLM API calls (OpenAI, Anthropic) — core to the product
- Convex — database/backend
- Hosting (Vercel/similar) — deployment
- Clerk — authentication

Everything else: build it, find it open-source, or don't use it.
