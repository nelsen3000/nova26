# Feature: Nova26 Landing Page & UX Validation System

## Overview

Create Nova26's first web frontend - a landing page that showcases the three-stage product pipeline (Pre-Production, Production, Post-Production) with an emphasis on the Idea Generator feature. Additionally, upgrade the UX validation system to enforce AI-first design principles including confidence indicators, explainability, and accessibility.

## Business Value

- Provides a visual entry point for Nova26 (currently CLI-only)
- Showcases the full product pipeline in an intuitive interface
- Highlights the unique "Shadow Advisory Board" scoring system
- Ensures all generated UIs meet modern accessibility and AI UX standards

---

## User Stories

### US-001: Landing Page Hero Section
**As a** potential Nova26 user  
**I want to** see a clear overview of the three pipeline stages  
**So that** I can understand where Nova26 fits in my product development workflow

### US-002: Idea Generator Feature
**As a** product builder  
**I want to** generate and score ideas using the Shadow Advisory Board  
**So that** I can validate concepts before investing development time

### US-003: Pipeline Stage Navigation
**As a** user  
**I want to** click on pipeline stage cards and see available tools  
**So that** I can discover relevant features for my current stage

### US-004: Video Content Engine Access
**As a** marketer  
**I want to** access the 9 Higgsfield video templates  
**So that** I can create marketing content efficiently

### US-005: Enhanced UX Validation
**As a** developer using Nova26  
**I want** all generated components to meet accessibility and AI UX standards  
**So that** my application provides a high-quality user experience

---

## Acceptance Criteria

### Landing Page (Deliverable A)

#### AC-1.1: Header Navigation
- [ ] Logo "Nova26" displays on top left
- [ ] Nav links present: Products, Teams, Platform, Resources
- [ ] Right side contains: Pricing | Log in | "Get Started →" button
- [ ] Get Started button uses purple/indigo color (#6161FF or #7B68EE)

#### AC-1.2: Hero Section Layout
- [ ] Headline displays: "Build your next product — from idea to launch"
- [ ] Subheadline displays: "What stage are you working on with Nova26?"
- [ ] Three pipeline stage cards display in horizontal row
- [ ] Cards are visually balanced and equally sized

#### AC-1.3: Pre-Production Card
- [ ] Card displays lightbulb or brain icon
- [ ] Subtext reads: "Ideas, research, validation & iteration"
- [ ] On click/hover, dropdown reveals 3 options
- [ ] Idea Generator is first option with prominent styling
- [ ] Nova26 App Builder is second option
- [ ] Swarm is third option with 7 presets listed

#### AC-1.4: Idea Generator Feature
- [ ] Shadow Advisory Board includes 5 advisors: Peter Thiel, Naval Ravikant, Warren Buffett, YC Partner, Skeptical VC
- [ ] Each advisor provides: Opening reaction, Key insight, Critical question, Red flag/opportunity
- [ ] Overall scoring includes: Consensus, Split Decision, Vote (Fund Yes/No + confidence 1-10), Composite Score
- [ ] Routing logic: Score >= 7.0 → Idea Queue (green) | 4.0-6.9 → Revision List (yellow) | < 4.0 → Archived (red)
- [ ] Research sources listed: Reddit, Discord, ProductHunt, App Store/Play Store, Twitter/X, Hacker News, Amazon, YouTube, LinkedIn, Google Trends, Patents, Job postings

#### AC-1.5: Production Card
- [ ] Card displays gear or code brackets icon
- [ ] Subtext reads: "Build, test, and ship your application"
- [ ] Dropdown reveals 5 options: Nova26 Full Build, Single Agent Tasks, ATLAS Learning Dashboard, PRD Manager, Quality Gates Monitor

#### AC-1.6: Post-Production Card
- [ ] Card displays megaphone or rocket icon
- [ ] Subtext reads: "Marketing, content, and user acquisition"
- [ ] Dropdown reveals 3 main options: Video Content Engine, Growth & Distribution, Analytics & Iteration

#### AC-1.7: Video Content Engine
- [ ] Lists 9 Higgsfield templates: Trend Hijacker, Hook Generator, Model Selector, Face Swap Factory, Click-to-Ad Generator, Cinema Studio Director, Multi-Model A/B Testing, Lipsync Dialogue Creator, 30-Day Content Calendar
- [ ] Model Selector includes: Kling, Sora, Veo, WAN, Minimax, Seedance

#### AC-1.8: Left Sidebar
- [ ] Idea Generator button is most prominent (large, glowing/highlighted)
- [ ] Contains: Home/Dashboard, Active Builds, PRD Manager, ATLAS Logs, Video Engine, Chat with Nova26
- [ ] Sidebar persists across navigation

#### AC-1.9: CTA Section
- [ ] "Start Building →" button displays below cards in purple
- [ ] Text below button: "No credit card needed ✦ Free tier available"

#### AC-1.10: Visual Styling
- [ ] White background (#FFFFFF)
- [ ] Text color: #1F1F1F
- [ ] Accent color: #6161FF or #7B68EE (purple/indigo)
- [ ] Cards: white bg, 1px border #E6E9EF, 8px border-radius
- [ ] Cards show subtle box-shadow on hover
- [ ] Font: Inter or similar clean sans-serif
- [ ] Dropdown animation: smooth expand 200ms ease
- [ ] Responsive: works on 1280px+ desktop

### UX Validation Upgrades (Deliverable B)

#### AC-2.1: Visual Validator - New Checks
- [ ] Check for confidence indicators on AI output UIs (deduct 5-10 points if missing)
- [ ] Check for undo/rollback controls on AI-driven actions (deduct 5-10 points if missing)
- [ ] Check for feedback widgets (thumbs-up/down, ratings) (deduct 5-10 points if missing)
- [ ] Check for explainability affordances ("Why?" buttons, info icons) (deduct 5-10 points if missing)
- [ ] Check for confirmation dialogs before risky actions (deduct 5-10 points if missing)
- [ ] Check for keyboard navigation (tabIndex, onKeyDown) (deduct 5-10 points if missing)
- [ ] Check for ARIA live regions on streaming/dynamic content (deduct 5-10 points if missing)
- [ ] Check for color contrast (text-gray-900 vs text-gray-300) (deduct 5-10 points if poor contrast)
- [ ] Check for i18n readiness (flag hardcoded strings) (deduct 5-10 points if hardcoded)
- [ ] Check for progressive disclosure (collapsible sections) (deduct 5-10 points if missing)
- [ ] Check for semantic HTML (button, nav, main, header, footer) (deduct 5-10 points if using divs)
- [ ] Check for focus management in modals (deduct 5-10 points if missing)

#### AC-2.2: VENUS Agent Updates
- [ ] VENUS principles include: confidence indicators on AI-generated content
- [ ] VENUS principles include: undo buttons on AI-driven mutations
- [ ] VENUS principles include: feedback widgets on AI responses
- [ ] VENUS principles include: "Why?" explainability tooltips
- [ ] VENUS principles include: confirmation dialogs before destructive actions
- [ ] VENUS principles include: full keyboard navigation
- [ ] VENUS principles include: aria-live regions on dynamic content
- [ ] VENUS principles include: progressive disclosure patterns
- [ ] VENUS principles include: semantic HTML usage
- [ ] VENUS principles include: focus management in modals

#### AC-2.3: Hard Limits Configuration
- [ ] Hard limit added: NO_DIV_BUTTON (interactive elements must use button)
- [ ] Hard limit added: REQUIRE_ARIA_LIVE (streaming content must have aria-live)
- [ ] Hard limit added: REQUIRE_SEMANTIC_HTML (layouts must use main, nav, header, footer)
- [ ] Hard limit added: REQUIRE_FOCUS_MANAGEMENT (modals must trap focus)

---

## Gherkin Scenarios

### Scenario: User views landing page hero section
```gherkin
Given I am on the Nova26 landing page
When the page loads
Then I see the headline "Build your next product — from idea to launch"
And I see three pipeline stage cards: Pre-Production, Production, Post-Production
And I see the "Start Building →" CTA button
```

### Scenario: User explores Pre-Production tools
```gherkin
Given I am on the Nova26 landing page
When I click on the "Pre-Production" card
Then a dropdown appears with 3 options
And "Idea Generator" is the first and most prominent option
And I see the Shadow Advisory Board description
```

### Scenario: User views Idea Generator scoring system
```gherkin
Given I have clicked on "Idea Generator"
When I view the feature details
Then I see 5 advisors listed: Peter Thiel, Naval Ravikant, Warren Buffett, YC Partner, Skeptical VC
And I see the scoring thresholds: >= 7.0 (green), 4.0-6.9 (yellow), < 4.0 (red)
And I see 12 research sources listed
```

### Scenario: User explores Video Content Engine
```gherkin
Given I am on the Nova26 landing page
When I click on the "Post-Production" card
Then a dropdown appears
And I see "Video Content Engine" as the first option
When I expand "Video Content Engine"
Then I see 9 Higgsfield templates listed
```

### Scenario: Visual validator detects missing confidence indicator
```gherkin
Given VENUS generates a component with AI output
And the component does not display confidence scores
When the visual validator runs
Then it deducts 5-10 points from the score
And it flags "Missing confidence indicator"
```

### Scenario: Visual validator detects missing undo control
```gherkin
Given VENUS generates a component with an AI-driven mutation
And the component does not provide an undo button
When the visual validator runs
Then it deducts 5-10 points from the score
And it flags "Missing undo/rollback control"
```

### Scenario: Visual validator detects div button anti-pattern
```gherkin
Given VENUS generates a component with interactive elements
And the component uses <div onClick> instead of <button>
When the visual validator runs
Then it deducts points from the score
And it flags "NO_DIV_BUTTON hard limit violation"
```

### Scenario: Visual validator detects missing ARIA live region
```gherkin
Given VENUS generates a component with streaming/dynamic content
And the component does not include aria-live attribute
When the visual validator runs
Then it deducts 5-10 points from the score
And it flags "REQUIRE_ARIA_LIVE hard limit violation"
```

---

## UI States

### Landing Page States

**Loading State:**
- Skeleton loaders for cards
- Animated pulse effect on card placeholders
- Header and sidebar load immediately

**Empty State:**
- Not applicable (static landing page)

**Error State:**
- If API fails to load dynamic content (e.g., ATLAS stats), show error message
- "Unable to load data. Please refresh the page."
- Retry button available

**Partial State:**
- If some cards load but others fail, show loaded cards
- Display error message for failed sections only

**Populated State:**
- All three pipeline stage cards visible
- All dropdown options loaded
- Sidebar fully interactive

### Idea Generator States

**Loading State:**
- "Analyzing your idea..." message
- Progress indicator showing research sources being queried
- Animated advisor avatars with loading spinner

**Empty State:**
- "No ideas generated yet"
- "Enter your product idea to get started" prompt
- Example ideas shown as inspiration

**Error State:**
- "Unable to generate score. Please try again."
- Error details (e.g., "API timeout", "Invalid input")
- Retry button

**Partial State:**
- Some advisors have responded, others still loading
- Show completed advisor feedback
- "Waiting for remaining advisors..." message

**Populated State:**
- All 5 advisor responses visible
- Composite score displayed prominently
- Routing decision shown (Idea Queue / Revision List / Archived)

---

## Edge Cases

### Landing Page Edge Cases

**Case 1: Very long dropdown content**
- Handling: Implement scrollable dropdown with max-height
- Show "scroll for more" indicator at bottom

**Case 2: Mobile viewport (< 1280px)**
- Handling: Stack cards vertically
- Collapse sidebar into hamburger menu
- Maintain touch-friendly tap targets (44px minimum)

**Case 3: Slow network connection**
- Handling: Show skeleton loaders immediately
- Progressive enhancement: load critical content first
- Timeout after 10 seconds with error message

**Case 4: JavaScript disabled**
- Handling: Show static version of page
- Display message: "Enable JavaScript for full experience"
- Provide alternative navigation links

**Case 5: Keyboard-only navigation**
- Handling: All interactive elements must be keyboard accessible
- Visible focus indicators on all focusable elements
- Dropdown opens on Enter/Space key

### Idea Generator Edge Cases

**Case 1: Idea text exceeds character limit**
- Handling: Truncate at 500 characters
- Show character count indicator
- Display warning at 450 characters

**Case 2: API rate limit exceeded**
- Handling: Queue requests
- Show "High demand - your request is queued" message
- Provide estimated wait time

**Case 3: Conflicting advisor scores (e.g., 2 Fund Yes, 3 Fund No)**
- Handling: Display "SPLIT DECISION" consensus
- Show individual votes clearly
- Composite score reflects weighted average

**Case 4: Research sources unavailable**
- Handling: Continue with available sources
- Note which sources failed in results
- Adjust confidence score accordingly

**Case 5: User navigates away during scoring**
- Handling: Save partial results
- Allow user to resume from sidebar "Active Builds"
- Show notification: "Idea scoring in progress"

### UX Validation Edge Cases

**Case 1: Component has both button and div onClick**
- Handling: Flag both instances
- Prioritize button usage in recommendations

**Case 2: ARIA live region on static content**
- Handling: Do not penalize (over-application is acceptable)
- Note in report as "unnecessary but harmless"

**Case 3: Semantic HTML used incorrectly (e.g., nav without navigation)**
- Handling: Flag as misuse
- Suggest correct semantic element

**Case 4: Color contrast passes WCAG AA but not AAA**
- Handling: Pass validation (AA is requirement)
- Note AAA opportunity in report

**Case 5: i18n keys present but hardcoded strings also exist**
- Handling: Flag only hardcoded strings
- Suggest converting to i18n keys

---

## Technical Requirements

### Stack
- React 19
- TypeScript (strict mode)
- Tailwind CSS
- shadcn/ui components
- Next.js app router (app/ directory) OR standalone React app (src/web/)

### File Structure
```
app/                          # OR src/web/
  page.tsx                    # Landing page
  components/
    Header.tsx
    HeroSection.tsx
    PipelineCard.tsx
    IdeaGenerator.tsx
    VideoContentEngine.tsx
    Sidebar.tsx
    CTASection.tsx
```

### Visual Validator Updates
```
src/browser/visual-validator.ts
  - Add 12 new validation checks
  - Update scoring thresholds if needed
  - Maintain existing check patterns
```

### Agent Updates
```
.nova/agents/VENUS.md
  - Add AI UX principles
  - Add accessibility requirements
  - Add semantic HTML requirements
```

### Configuration Updates
```
.nova/config/hard-limits.json
  - Add NO_DIV_BUTTON
  - Add REQUIRE_ARIA_LIVE
  - Add REQUIRE_SEMANTIC_HTML
  - Add REQUIRE_FOCUS_MANAGEMENT
```

### Reference Materials
- Visual reference: `.nova/reference-monday-homepage.jpeg`
- UX research: `/Users/jonathannelsen/Desktop/deep-research-report.md`

---

## Dependencies

- Existing Nova26 CLI infrastructure
- ATLAS logging system (for "Active Builds" sidebar)
- Convex backend (for idea scoring API)
- Higgsfield API integration (for video templates)

---

## Out of Scope

- Backend API implementation for Idea Generator (separate task)
- Higgsfield video generation logic (separate task)
- User authentication/login flow (separate task)
- Pricing page implementation (separate task)
- Mobile app (PWA only, not native)

---

## Success Metrics

- Landing page loads in < 2 seconds on 3G connection
- All interactive elements keyboard accessible
- Visual validator score >= 70 for all generated components
- Zero hard limit violations in production
- Lighthouse accessibility score >= 90

---

*Requirements document created: 2026-02-18*
