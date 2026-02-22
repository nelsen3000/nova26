# Implementation Plan: Nova26 Landing Page & UX Validation System

## Overview

Two deliverables implemented incrementally: (A) landing page components in `app/(landing)/`, and (B) UX validation upgrades in `src/browser/visual-validator.ts`, `.nova/agents/VENUS.md`, and `.nova/config/hard-limits.json`.

## Tasks

- [x] 1. Create landing page structure and entry point
  - [x] 1.1 Create `app/(landing)/layout.tsx` — route group layout (no auth wrapper, clean shell)
    - _Requirements: AC-1.1, AC-1.10_
  - [x] 1.2 Create `app/(landing)/page.tsx` — entry point with state machine for panels/modals
    - `ideaGeneratorOpen` + `videoEngineOpen` state
    - Renders Header, LeftSidebar, HeroSection, StageCards, CTASection, IdeaGeneratorPanel, VideoEngineModal
    - _Requirements: AC-1.2, AC-1.8, AC-1.9_

- [x] 2. Implement Header component
  - [x] 2.1 Create `app/(landing)/components/header.tsx`
    - Logo "Nova26" on left
    - Nav links: Products, Teams, Platform, Resources
    - Right side: Pricing | Log in | "Get Started →" button (#6161FF)
    - Responsive hamburger on mobile
    - _Requirements: AC-1.1_

- [x] 3. Implement HeroSection component
  - [x] 3.1 Create `app/(landing)/components/hero-section.tsx`
    - `<h1>`: "Build your next product — from idea to launch"
    - `<p>`: "What stage are you working on with Nova26?"
    - Framer-motion fade-in-up animation on mount
    - _Requirements: AC-1.2_

- [x] 4. Implement StageCards component
  - [x] 4.1 Create `app/(landing)/components/stage-cards.tsx`
    - Three horizontally-balanced cards: Pre-Production, Production, Post-Production
    - Each card: icon + title + subtext + animated dropdown
    - Pre-Production dropdown: Idea Generator (prominent), Nova26 App Builder, Swarm (7 presets)
    - Production dropdown: Full Build, Single Agent Tasks, ATLAS Dashboard, PRD Manager, Quality Gates
    - Post-Production dropdown: Video Content Engine, Growth & Distribution, Analytics & Iteration
    - Card styling: white bg, 1px border #E6E9EF, 8px radius, hover shadow
    - Dropdown animation: 200ms ease expand
    - _Requirements: AC-1.3, AC-1.4, AC-1.5, AC-1.6, AC-1.10_

- [x] 5. Implement LeftSidebar component
  - [x] 5.1 Create `app/(landing)/components/left-sidebar.tsx`
    - Items: Home/Dashboard, Active Builds, PRD Manager, ATLAS Logs, Video Engine, Chat with Nova26
    - "Idea Generator" button: most prominent (large, glowing/highlighted)
    - Sidebar persists via layout
    - _Requirements: AC-1.8_

- [x] 6. Implement IdeaGeneratorPanel component
  - [x] 6.1 Create `app/(landing)/components/idea-generator-panel.tsx`
    - Shadow Advisory Board: Peter Thiel, Naval Ravikant, Warren Buffett, YC Partner, Skeptical VC
    - Each advisor: Opening reaction, Key insight, Critical question, Red flag/opportunity
    - Scoring: Consensus, Split Decision, Vote (Fund Yes/No + confidence 1-10), Composite Score
    - Routing: ≥ 7.0 → Idea Queue (green) | 4.0–6.9 → Revision List (yellow) | < 4.0 → Archived (red)
    - 12 research sources listed
    - Accessible: `role="dialog"`, `aria-modal="true"`, focus trap, ESC to close
    - _Requirements: AC-1.3, AC-1.4_

- [x] 7. Implement VideoEngineModal component
  - [x] 7.1 Create `app/(landing)/components/video-engine-modal.tsx`
    - 9 Higgsfield templates listed
    - Model Selector: Kling, Sora, Veo, WAN, Minimax, Seedance
    - Accessible: focus trap, ESC to close, `aria-modal="true"`
    - _Requirements: AC-1.7_

- [x] 8. Implement CTASection component
  - [x] 8.1 Create `app/(landing)/components/cta-section.tsx`
    - "Start Building →" button (bg-indigo-600, large, centered)
    - Subtitle: "No credit card needed ✦ Free tier available"
    - _Requirements: AC-1.9_

- [x] 9. Upgrade visual validator with 12 new AI UX checks
  - [x] 9.1 Add 12 checks to `src/browser/visual-validator.ts`
    - Check 1: Confidence indicators (AI output UIs) — deduct 8 pts
    - Check 2: Undo/rollback controls — deduct 8 pts
    - Check 3: Feedback widgets (thumbs up/down) — deduct 7 pts
    - Check 4: Explainability affordances ("Why?" buttons) — deduct 8 pts
    - Check 5: Confirmation dialogs (risky actions) — deduct 10 pts
    - Check 6: Keyboard navigation (tabIndex, onKeyDown) — deduct 8 pts
    - Check 7: ARIA live regions (streaming/dynamic) — deduct 8 pts
    - Check 8: Color contrast (text-gray-300/400) — deduct 7 pts
    - Check 9: i18n readiness (hardcoded strings) — deduct 6 pts
    - Check 10: Progressive disclosure — deduct 6 pts
    - Check 11: Semantic HTML — deduct 8 pts
    - Check 12: Focus management in modals — deduct 8 pts
    - _Requirements: AC-2.1_

- [x] 10. Update VENUS agent with AI UX principles
  - [x] 10.1 Update `.nova/agents/VENUS.md`
    - Add principles: confidence indicators, undo buttons, feedback widgets, explainability, confirmations
    - Add principles: keyboard navigation, aria-live, progressive disclosure, semantic HTML, focus management
    - Add constraints (never): same 10 AI UX anti-patterns
    - _Requirements: AC-2.2_

- [x] 11. Add hard limits to configuration
  - [x] 11.1 Update `.nova/config/hard-limits.json`
    - Add `NO_DIV_BUTTON`: interactive elements must use `<button>` (SEVERE)
    - Add `REQUIRE_ARIA_LIVE`: streaming content must have `aria-live` (SEVERE)
    - Add `REQUIRE_SEMANTIC_HTML`: layouts must use `main, nav, header, footer` (SEVERE)
    - Add `REQUIRE_FOCUS_MANAGEMENT`: modals must trap focus (SEVERE)
    - _Requirements: AC-2.3_

- [x] 12. Final checkpoint — all deliverables verified
  - Landing page renders at `app/(landing)/` route
  - Visual validator has 12 new checks
  - VENUS.md has AI UX principles and constraints
  - hard-limits.json has 4 new SEVERE limits
  - tsc: 0 errors

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Landing page components are static/presentational (no backend calls at this stage)
- Visual validator checks use static source code pattern matching (no runtime rendering required)
- Hard limit gate runner reads `hard-limits.json` and applies patterns to VENUS output
- Focus trap in modals can use `focus-trap-react` or custom implementation
- Framer Motion is already in project dependencies
