# Nova26 Inspiration Library Index

## Overview

This index catalogs all visual and UX references used to inform Nova26's design decisions. Each entry documents the source, what it demonstrates, and how it influenced our implementation.

---

## References

### 1. Monday.com Homepage - Pipeline Stage Cards

**File:** `reference-monday-homepage.jpeg` (located in `.nova/`)  
**Source:** https://monday.com  
**Date Added:** 2026-02-18  
**Category:** Landing Page / Navigation  
**Used For:** Nova26 landing page three-stage pipeline cards

#### What It Demonstrates

- **Three-card horizontal layout** with equal spacing
- **Hover-to-expand dropdowns** revealing sub-options
- **Clean white aesthetic** with subtle borders (#E6E9EF)
- **Purple accent color** (#6161FF) for primary CTAs
- **Icon + title + description** pattern for each card
- **Smooth animations** (200ms ease-out transitions)
- **Clear visual hierarchy** with large headlines
- **Prominent CTA button** below cards

#### What We Learned

1. **Progressive Disclosure**: Don't overwhelm users with all options at once. Show high-level categories first, reveal details on interaction.

2. **Visual Consistency**: Use a consistent card pattern (white bg, 1px border, 8px radius, subtle shadow on hover) across all three stages.

3. **Color Psychology**: Purple conveys creativity and innovation, perfect for a product development platform.

4. **Interaction Feedback**: Hover states should be immediate and smooth. Cards lift slightly (-translate-y-0.5) and gain shadow on hover.

5. **Mobile-First Thinking**: While optimized for desktop (1280px+), the pattern scales down to stacked cards on mobile.

#### Implementation Details

**Files Created:**
- `app/(landing)/components/stage-cards.tsx` — Main component
- `app/(landing)/components/hero-section.tsx` — Headline section
- `app/(landing)/components/header.tsx` — Top navigation
- `app/(landing)/components/cta-section.tsx` — Call-to-action

**Design Tokens Used:**
```css
--primary-purple: #6161FF
--secondary-indigo: #7B68EE
--text-dark: #1F1F1F
--border-light: #E6E9EF
--background: #FFFFFF
```

**Key CSS Classes:**
```tsx
className="bg-white border border-[#E6E9EF] rounded-lg p-6
  hover:shadow-lg hover:-translate-y-0.5
  transition-all duration-200 ease-out"
```

**Animation Pattern:**
```tsx
<motion.div
  initial={{ opacity: 0, y: -8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -8 }}
  transition={{ duration: 0.2 }}
>
```

#### Adaptations Made

**What We Kept:**
- Three-card layout
- Hover-to-expand pattern
- Purple accent color
- Clean white aesthetic
- Smooth animations

**What We Changed:**
- **Card Content**: Adapted to Nova26's three-stage pipeline (Pre-Production, Production, Post-Production)
- **Dropdown Options**: Customized to show Nova26-specific features (Idea Generator, Video Engine, etc.)
- **Featured Items**: Added visual emphasis to hero features (Idea Generator, Video Engine)
- **Left Sidebar**: Added persistent navigation with glowing Idea Generator button
- **Slide-in Panels**: Used panels instead of modals for Idea Generator (better UX for complex content)

#### Accessibility Improvements

We enhanced Monday.com's pattern with:
- **Keyboard Navigation**: All cards and dropdowns accessible via Tab/Enter
- **ARIA Labels**: Proper labeling for screen readers
- **Focus Management**: Visible focus rings on all interactive elements
- **Semantic HTML**: Used `<nav>`, `<main>`, `<section>` instead of generic divs
- **Color Contrast**: Ensured WCAG AA compliance (4.5:1 ratio)

#### Performance Optimizations

- **Framer Motion**: Used for smooth animations without layout thrashing
- **Lazy Loading**: Dropdowns only render when expanded
- **CSS Transitions**: Hardware-accelerated transforms for hover effects
- **Minimal Re-renders**: Memoized components and callbacks

#### Lessons for Future References

1. **Document Early**: Capture the reference as soon as you use it
2. **Be Specific**: Note exact colors, spacing, and timing values
3. **Explain Adaptations**: Document what you changed and why
4. **Include Code**: Show actual implementation, not just descriptions
5. **Measure Impact**: Note improvements (accessibility, performance, UX)

#### Related References

- **Stripe Checkout**: Informed our payment flow design (future)
- **Linear Command Palette**: Inspired keyboard shortcuts (future)
- **Notion Sidebar**: Influenced left sidebar navigation

---

## Statistics

- **Total References**: 1
- **Categories**: Landing Page (1)
- **Date Range**: 2026-02-18 to present
- **Most Used Category**: Landing Page

---

## Upcoming References

### Planned Additions

1. **Stripe Checkout Flow** — For payment page redesign
2. **Linear Issue Detail** — For task view layout
3. **Notion Database Views** — For PRD manager
4. **Figma Component Properties** — For design system
5. **GitHub Actions UI** — For build pipeline visualization

### Requested by Team

- Dashboard layouts (Datadog, Grafana)
- Command palettes (Linear, Raycast)
- Onboarding flows (Loom, Superhuman)
- Settings pages (Vercel, Netlify)

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on adding new references.

---

*Last Updated: 2026-02-18*  
*Maintained by: Kiro*
