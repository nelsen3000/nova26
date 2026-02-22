# Design Document: Nova26 Landing Page & UX Validation System

## Overview

Two-deliverable spec: (A) a Next.js 15 App Router landing page for Nova26 showcasing the three-stage product pipeline, and (B) UX validation system upgrades enforcing AI-first design principles across all generated components.

---

## Architecture

### Deliverable A — Landing Page

**File structure:**
```
app/(landing)/
  layout.tsx                   — root layout (no auth wrapper)
  page.tsx                     — entry point, state machine for panels/modals
  components/
    header.tsx                 — nav bar with logo + links + CTA
    hero-section.tsx           — headline + subheadline
    stage-cards.tsx            — three pipeline stage cards with dropdowns
    left-sidebar.tsx           — persistent sidebar with feature shortcuts
    idea-generator-panel.tsx   — slide-in panel: Shadow Advisory Board
    video-engine-modal.tsx     — modal: 9 Higgsfield templates
    cta-section.tsx            — "Start Building →" + free tier note
```

**State machine (page.tsx):**
- `ideaGeneratorOpen: boolean` — slide-in panel from left
- `videoEngineOpen: boolean` — modal overlay
- Both opened from either `LeftSidebar` shortcuts or `StageCards` dropdown actions

**Component communication:**
- Parent (`page.tsx`) owns state; passes `onXxxClick` callbacks down — no prop drilling beyond 1 level
- No global state required (static landing page)

### Deliverable B — UX Validation Upgrades

**Files modified:**
```
src/browser/visual-validator.ts   — 12 new AI UX validation checks (score 0-100)
.nova/agents/VENUS.md             — AI UX principles + constraints
.nova/config/hard-limits.json     — 4 new SEVERE hard limits for VENUS
```

---

## Component Design

### Header (`header.tsx`)
- Full-width, white background, 1px bottom border
- Left: "Nova26" logo text in #1F1F1F, bold
- Center nav: Products | Teams | Platform | Resources
- Right: "Pricing" link + "Log in" link + "Get Started →" button (#6161FF)
- Responsive: center nav collapses to hamburger on mobile

### HeroSection (`hero-section.tsx`)
- Centered layout, vertical padding py-12 → py-20
- `<h1>`: "Build your next product — from idea to launch" (text-4xl → text-6xl)
- `<p>`: "What stage are you working on with Nova26?" (text-muted-foreground)
- Framer-motion fade-in-up on mount (opacity 0→1, y 20→0, 500ms)

### StageCards (`stage-cards.tsx`)
Three horizontally-balanced cards. Each card:
- White bg, 1px border (#E6E9EF), 8px border-radius, hover shadow
- Icon + title + subtext
- Dropdown reveals on click with 200ms ease animation

| Card | Icon | Subtext | Dropdown items |
|------|------|---------|----------------|
| Pre-Production | Lightbulb | "Ideas, research, validation & iteration" | Idea Generator · Nova26 App Builder · Swarm (7 presets) |
| Production | Code brackets | "Build, test, and ship your application" | Full Build · Single Agent Tasks · ATLAS Dashboard · PRD Manager · Quality Gates |
| Post-Production | Megaphone | "Marketing, content, and user acquisition" | Video Content Engine · Growth & Distribution · Analytics & Iteration |

### LeftSidebar (`left-sidebar.tsx`)
- Fixed left sidebar, 64px wide when collapsed, 256px when expanded
- Items: Home/Dashboard · Active Builds · PRD Manager · ATLAS Logs · Video Engine · Chat with Nova26
- "Idea Generator" button: most prominent (large, indigo glow, full-width)
- Persists across navigation via layout

### IdeaGeneratorPanel (`idea-generator-panel.tsx`)
- Slide-in from right or left, max-width 480px
- **Shadow Advisory Board**: Peter Thiel · Naval Ravikant · Warren Buffett · YC Partner · Skeptical VC
- Each advisor: Opening reaction · Key insight · Critical question · Red flag / Opportunity
- **Scoring**: Consensus · Split Decision · Vote (Fund Yes/No + confidence 1-10) · Composite Score
- **Routing**: Score ≥ 7.0 → Idea Queue (green) | 4.0–6.9 → Revision List (yellow) | < 4.0 → Archived (red)
- **Research sources** (12): Reddit · Discord · ProductHunt · App Store/Play Store · Twitter/X · Hacker News · Amazon · YouTube · LinkedIn · Google Trends · Patents · Job postings
- Close button with focus trap; `aria-modal="true"`, `role="dialog"`

### VideoEngineModal (`video-engine-modal.tsx`)
- Full dialog overlay with backdrop
- **9 Higgsfield templates**: Trend Hijacker · Hook Generator · Model Selector · Face Swap Factory · Click-to-Ad Generator · Cinema Studio Director · Multi-Model A/B Testing · Lipsync Dialogue Creator · 30-Day Content Calendar
- **Model Selector models**: Kling · Sora · Veo · WAN · Minimax · Seedance
- Focus trapped; ESC key closes

### CTASection (`cta-section.tsx`)
- "Start Building →" button (bg-indigo-600, large, centered)
- Subtitle: "No credit card needed ✦ Free tier available"

---

## Visual Validator Checks (Deliverable B)

12 new checks added to `validateComponent()` in `src/browser/visual-validator.ts`:

| # | Check | Deduction | Pattern |
|---|-------|-----------|---------|
| 1 | Confidence indicators on AI output | -8 | missing `confidence`, `score`, `certainty` |
| 2 | Undo/rollback controls | -8 | missing `undo`, `rollback`, `revert` |
| 3 | Feedback widgets | -7 | missing `thumbs`, `feedback`, `rating` |
| 4 | Explainability affordances | -8 | missing `why`, `explain`, `tooltip` |
| 5 | Confirmation dialogs | -10 | missing `confirm`, `are you sure`, `dialog` |
| 6 | Keyboard navigation | -8 | missing `tabIndex`, `onKeyDown`, `keydown` |
| 7 | ARIA live regions | -8 | missing `aria-live` on streaming/dynamic content |
| 8 | Color contrast (text-gray-300/400) | -7 | low-contrast color classes |
| 9 | i18n readiness | -6 | hardcoded UI strings |
| 10 | Progressive disclosure | -6 | missing `collapse`, `accordion`, `expand` |
| 11 | Semantic HTML | -8 | missing `<nav>`, `<main>`, `<header>`, `<footer>` |
| 12 | Focus management in modals | -8 | modals missing `autoFocus`, `focus-trap` |

---

## Hard Limits Added (Deliverable B)

Four new SEVERE hard limits in `.nova/config/hard-limits.json` under `VENUS`:

| Limit name | Pattern | Message |
|-----------|---------|---------|
| `NO_DIV_BUTTON` | `<div[^>]*onClick` | Use `<button>` not `<div onClick>` |
| `REQUIRE_ARIA_LIVE` | streaming/dynamic without `aria-live` | Streaming content must have `aria-live` |
| `REQUIRE_SEMANTIC_HTML` | layouts missing `main/nav/header/footer` | Use semantic HTML not generic divs |
| `REQUIRE_FOCUS_MANAGEMENT` | modals without `autoFocus`/`focus` | Modals must trap focus |

---

## Design Decisions

1. **Next.js App Router** — landing page lives in `app/(landing)/` as a route group, isolating it from the main app shell without a URL segment
2. **Client components** — page.tsx is `'use client'` to manage panel/modal open state; child components are server-compatible where possible
3. **No external state library** — useState in page.tsx is sufficient for this static page
4. **Framer Motion** — used for card dropdown animation (200ms ease) and hero fade-in
5. **Tailwind semantic tokens** — all colors via `bg-background`, `text-foreground`, etc. except intentional brand colors (#6161FF, #1F1F1F)
6. **Visual validator is static analysis** — checks source code string patterns, not runtime rendering, so no Playwright dependency for the 12 new checks

---

## Testing Strategy

- Landing page components are static/presentational — tested via visual validator + Playwright screenshots
- Visual validator new checks: unit-tested with fixture HTML strings (passing and failing examples)
- Hard limits: validated by MERCURY gate runner on each VENUS output
- No unit tests for landing page components themselves (React component tests deferred per `tasks.md`)
