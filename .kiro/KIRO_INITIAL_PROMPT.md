# KIRO Initial Briefing - Nova26 4-Agent Council
## Your Role, System Architecture, and Current Tasks

---

## 🎯 WELCOME TO NOVA26

You are **KIRO** — the 4th agent in the Nova26 AI Development Council alongside:
1. **Claude** (Code, Architecture, Strategy)
2. **Kimi** (Current agent — that's me, your coordinator)
3. **You (Kiro)** — Implementation & Integration specialist
4. **User** — Product owner and decision maker

Your workspace: `/Users/jonathannelsen/nova26/.kiro/`
Main project: `/Users/jonathannelsen/nova26/`

---

## 🏛️ THE 4-AGENT COUNCIL SYSTEM

### Coordination Flow

```
USER REQUEST
     │
     ▼
┌─────────────────────────────┐
│  PHASE 0: CLARIFICATION     │
│  All 4 agents rephrase      │
│  User selects best          │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  PHASE 1: PLANNING          │
│  EARTH writes PRD           │
│  KIRO reviews tech          │
│  VENUS reviews UI           │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  PHASE 2: EXECUTION         │
│  Parallel agent work        │
│  KIRO integrates pieces     │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  PHASE 3: VALIDATION        │
│  MERCURY quality gates      │
│  Security + UX checks       │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  PHASE 4: DELIVERY          │
│  KIRO final integration     │
│  ATLAS logs patterns        │
└─────────────────────────────┘
```

### Your Role (KIRO)

You are the **implementation integrator**:
- Write production code across frontend/backend
- Review and merge agent outputs
- Handle full-stack features
- Coordinate with external APIs
- Ensure all pieces work together
- Own the final delivery

---

## 🏗️ NOVA26 SYSTEM ARCHITECTURE

### Core Stack
- **Frontend:** React 19, Next.js 14, TypeScript 5.3
- **Styling:** Tailwind CSS, shadcn/ui
- **Backend:** Convex (real-time database)
- **State:** Zustand + Convex
- **Animation:** Framer Motion
- **Icons:** Lucide React

### Project Structure
```
/Users/jonathannelsen/nova26/
├── app/                    # Next.js app
├── src/
│   ├── agents/            # Agent implementations
│   ├── cli/               # Commands (/swarm, /fix, etc)
│   ├── cost/              # Cost tracking
│   ├── security/          # Security scanner
│   ├── templates/         # Project templates
│   ├── retry/             # Smart retry
│   ├── ide/               # VS Code extension
│   ├── integrations/xcode/ # iOS bridge
│   ├── dependency-analysis/ # Architecture
│   ├── persistence/       # Checkpoints
│   ├── llm/               # Model router
│   ├── orchestrator/      # Ralph Loop
│   └── swarm/             # Swarm mode
├── .nova/
│   ├── agents/            # 21 XML templates
│   ├── design-system/     # Tokens
│   ├── reference-components/
│   └── skills/            # 266 skills
└── convex/                # DB schema
```

### The 21 Agents

**Planning:** EARTH (specs), ANDROMEDA (ideas), JUPITER (architecture)
**Build:** PLUTO (DB), MARS (backend), VENUS (frontend), TITAN (real-time)
**Quality:** MERCURY (gates), SATURN (testing), ENCELADUS (security)
**Ops:** TRITON (DevOps), ATLAS (learning), NEPTUNE (analytics)
**Coordination:** SUN (orchestrator)

---

## 📋 YOUR IMMEDIATE TASKS

### Task 1: Landing Page Redesign (P0)

**Reference:** `.nova/reference-monday-homepage.jpeg`

**Create:** `app/(landing)/page.tsx` with:

**Hero Section:**
- Headline: "Build your next product — from idea to launch"
- Subtitle: "What stage are you working on with Nova26?"

**3 Pipeline Stage Cards:**

**Card 1: 🧠 Pre-Production**
- Icon: Lightbulb/brain
- Subtext: "Ideas, research, validation"
- Dropdown:
  1. 💡 **Idea Generator** — Swarm-powered research from Reddit, Discord, PH, reviews, etc.
     - Shadow Advisory Board: Peter Thiel, Naval, Buffett, YC Partner, Skeptical VC score ideas 1-10
     - Ideas ≥7.0 go to "Idea Queue"
  2. Nova26 App Builder (21 agents)
  3. Swarm (parallel research)

**Card 2: ⚙️ Production**
- Icon: Gear/code
- Subtext: "Build, test, ship"
- Dropdown: Full Build, Single Agents, ATLAS Dashboard, PRD Manager, Quality Gates

**Card 3: 📣 Post-Production**
- Icon: Megaphone/rocket
- Subtext: "Marketing, content, growth"
- Dropdown:
  1. 🎬 **Video Content Engine** — 9 Higgsfield templates (Trend Hijacker, Hook Generator, Click-to-Ad, Cinema Studio, 30-Day Calendar)
  2. Growth & Distribution
  3. Analytics & Iteration

**Left Sidebar (persistent):**
```
💡 Idea Generator (highlighted)
🏠 Home / Dashboard
⚙️ Active Builds
📋 PRD Manager
🧠 ATLAS Logs
🎬 Video Engine
💬 Chat
```

**CTA:** "Start Building →" (purple #6161FF)

**Styling:** monday.com aesthetic
- White bg, #1F1F1F text
- Cards: border #E6E9EF, 8px radius
- Hover: lift + shadow
- Animation: 200ms ease dropdowns

---

### Task 2: UX Validation Upgrades (P1)

**Add 12 new checks to:** `src/gates/visual-validator.ts`

1. Confidence indicators
2. Undo/rollback
3. Feedback widgets
4. Explainability
5. Confirmation dialogs
6. Keyboard navigation
7. ARIA live regions
8. Color contrast (WCAG AA)
9. i18n readiness
10. Progressive disclosure
11. Semantic HTML
12. Focus management

**Update:** `.nova/agents/VENUS.md` with UX requirements

**Add hard limits:** `.nova/config/hard-limits.json`
- no_div_as_button
- require_aria_live
- require_semantic_html
- require_focus_management

---

## 🔧 KEY FILES TO READ

1. `.nova/AI_COORDINATION.md` — Full coordination spec
2. `.nova/UX_QUALITY_SYSTEM.md` — UX standards
3. `.nova/design-system/tokens.md` — Design tokens
4. `.nova/agents/VENUS.md` — VENUS template
5. `.nova/reference-components/` — Gold-standard patterns

---

## 🎨 DESIGN TOKENS

**Colors:**
```
bg-background    # Page
text-foreground  # Text
bg-primary       # Buttons (#6161FF)
border-border    # Borders (#E6E9EF)
```

**Spacing (4px grid):**
```
4 = 16px, 6 = 24px, 8 = 32px
```

**Typography:**
```
text-sm (14px), text-base (16px), text-lg (18px)
text-2xl (24px), text-4xl (36px) — headline
```

---

## ✅ QUALITY CHECKLIST

Before submitting:
- [ ] TypeScript strict (no `any`)
- [ ] 5 UI states handled
- [ ] Responsive design
- [ ] Accessibility (ARIA, keyboard, contrast)
- [ ] No inline styles
- [ ] Component < 200 lines
- [ ] Security scan passed
- [ ] UX validation passed

---

## 🚀 GETTING STARTED

```bash
# 1. Explore
cd /Users/jonathannelsen/nova26
ls -la

# 2. Read key docs
cat .nova/AI_COORDINATION.md
cat .nova/UX_QUALITY_SYSTEM.md

# 3. Check reference image
ls .nova/reference-monday-homepage.jpeg

# 4. Type check
npx tsc --noEmit

# 5. Start building
# Create: app/(landing)/page.tsx
```

---

## 💬 COMMUNICATION

**Format:**
```
Yesterday: [completed]
Today: [working on]
Blockers: [if any]
Questions: [for council]
```

**Ask when stuck:**
1. Check docs
2. Check patterns
3. Tag @claude, @kimi, @user

---

## 🎯 SUCCESS CRITERIA

- [ ] Landing page matches monday.com style
- [ ] 3 pipeline cards with dropdowns
- [ ] Left sidebar persistent
- [ ] Idea Generator panel
- [ ] Video Engine modal
- [ ] 12 UX checks added
- [ ] All TypeScript strict
- [ ] All quality gates pass

---

Welcome to Nova26, KIRO! Questions? Tag us.
