# Nova26 Landing Page

## Overview

This is Nova26's first web frontend - a landing page showcasing the three-stage product pipeline (Pre-Production, Production, Post-Production).

## Structure

```
app/(landing)/
├── page.tsx                          # Main landing page
├── layout.tsx                        # Landing layout
├── components/
│   ├── header.tsx                    # Top navigation
│   ├── hero-section.tsx              # Headline and subheadline
│   ├── stage-cards.tsx               # Three pipeline stage cards (CORE FEATURE)
│   ├── left-sidebar.tsx              # Persistent navigation
│   ├── idea-generator-panel.tsx      # Slide-in panel with Shadow Advisory Board
│   ├── video-engine-modal.tsx        # Modal with 9 open-source video templates
│   └── cta-section.tsx               # Call-to-action button
```

## Key Features

### 1. Three Pipeline Stage Cards
- **Pre-Production**: Idea Generator (featured), App Builder, Swarm
- **Production**: Full Build, Single Agent Tasks, ATLAS Dashboard, PRD Manager, Quality Gates
- **Post-Production**: Video Engine (featured), Growth & Distribution, Analytics

### 2. Idea Generator (Hero Feature)
- Shadow Advisory Board with 5 advisors:
  - Peter Thiel (Contrarian Technologist)
  - Naval Ravikant (Leverage Maximalist)
  - Warren Buffett (Economics Fundamentalist)
  - YC Partner (Startup Operator)
  - Skeptical VC (Devil's Advocate)
- Scoring system: ≥7.0 (green), 4.0-6.9 (yellow), <4.0 (red)
- 12 research sources: Reddit, Discord, ProductHunt, App Store, Play Store, Twitter/X, Hacker News, Amazon, YouTube, LinkedIn, Google Trends, Patents

### 3. Video Content Engine
- 9 open-source video generation templates:
  1. Trend Hijacker
  2. Hook Generator
  3. Model Selector (Open-Sora/CogVideo/Stable Video Diffusion/AnimateDiff/Mochi)
  4. Face Swap Factory
  5. Click-to-Ad Generator
  6. Cinema Studio Director
  7. Multi-Model A/B Testing
  8. Lipsync Dialogue Creator
  9. 30-Day Content Calendar

## Design System

### Colors
- Primary: `#6161FF` (purple)
- Secondary: `#7B68EE` (indigo)
- Text: `#1F1F1F` (dark gray)
- Border: `#E6E9EF` (light gray)
- Background: `#FFFFFF` (white)

### Typography
- Font: Inter (clean sans-serif)
- Headline: 4xl-6xl, bold
- Subheadline: lg-xl, muted
- Body: sm-base

### Spacing
- 4px grid system
- Card padding: 24px (p-6)
- Section spacing: 48-80px (py-12 to py-20)

### Animations
- Card hover: -translate-y-0.5, shadow-lg
- Dropdown: 200ms ease-out
- Panel slide-in: 300ms ease-out
- Modal: 200ms scale + fade

## Interactions

### Stage Cards
- Hover to expand dropdown
- Click options to navigate or open panels
- Featured options have purple accent

### Idea Generator
- Opens as slide-in panel from left
- 4 tabs: Research Running, Idea Queue, Revision List, Archived
- Each idea shows score, sources, and advisor votes

### Video Engine
- Opens as centered modal
- 9 template cards in 3-column grid
- Model selector shows 6 available AI models

## Responsive Breakpoints

- Mobile: 320px-767px (stacked layout)
- Tablet: 768px-1023px (2-column grid)
- Desktop: 1024px-1439px (3-column grid)
- Wide: 1440px+ (optimized for large screens)

## Accessibility

- All interactive elements keyboard accessible
- ARIA labels on icon buttons
- Focus visible on all focusable elements
- Semantic HTML (nav, main, section, button)
- Color contrast meets WCAG AA

## Next Steps

1. Connect to real Convex backend for idea scoring
2. Integrate open-source video generation models (Open-Sora, CogVideo, etc.)
3. Add authentication flow
4. Implement pricing page
5. Add analytics tracking

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Type check
npx tsc --noEmit
```

## Notes

- This is a static landing page with mock data
- Backend integration required for full functionality
- Designed for desktop-first (1280px+)
- Mobile responsive but optimized for larger screens
