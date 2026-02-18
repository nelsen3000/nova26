# NOVA26 UX/UI Quality System
## World-class quality assurance for every build

---

## 📋 Overview

This comprehensive UX/UI quality system ensures every NOVA26 build produces:
- **Pixel-perfect** interfaces following design system standards
- **Accessible** experiences (WCAG 2.1 AA compliant)
- **Production-grade** components with all 5 UI states
- **Consistent** interactions and animations
- **Mobile-first** responsive designs

---

## 🗂️ System Components

### P1: UX Quality Gates
**File:** `.nova/config/ux-quality-gates.json`

Mandatory automated checks for every VENUS output:

| Gate | Checks | Severity |
|------|--------|----------|
| **Visual Consistency** | 4px spacing grid, semantic tokens, typography scale, border radius, shadows | BLOCKING |
| **Interaction Quality** | Hover, focus, active, disabled, loading states, transitions | BLOCKING |
| **Responsive Design** | 4 breakpoints (mobile→wide), touch targets 44px | BLOCKING |
| **Accessibility (WCAG AA)** | 4.5:1 contrast, keyboard nav, screen readers, motion reduce | BLOCKING |
| **Component Quality** | 6-dimension scoring (35/50 minimum) | BLOCKING |
| **Code Quality** | No magic numbers, component size, naming | WARNING |

### P2: Design System Reference
**Location:** `.nova/design-system/`

| File | Contents |
|------|----------|
| `tokens.md` | Colors, spacing (4px grid), typography, radii, shadows, z-index, animations |
| `components.md` | Button variants, form patterns, cards, tables, modals, badges, toasts, navigation |
| `layouts.md` | Dashboard, settings, list/detail, wizard, auth, marketing layouts |
| `animations.md` | Duration scale, easing, enter/exit transitions, micro-interactions, Framer Motion |
| `patterns.md` | Optimistic updates, infinite scroll, command palette, keyboard shortcuts, drag-drop |

### P3: Enhanced VENUS Agent
**File:** `.nova/agents/VENUS.md`

New sections added:
- **Component Quality Score** - 6-dimension rubric (50 points max, 35 minimum)
- **Anti-patterns Blacklist** - 10 patterns VENUS must NEVER produce
- **Component Template** - Standard 5-section boilerplate every component must follow

### P4: Hard Limits
**File:** `.nova/config/hard-limits.json`

New VENUX UX-specific limits:
- `no_raw_div_onclick` - Never use div with onClick
- `no_magic_numbers` - No arbitrary pixel values
- `require_loading_skeleton` - Data fetching needs loading state
- `require_error_boundary` - Page components need error handling
- `require_empty_state` - Lists need empty states
- `require_aria_labels` - Icon buttons need aria-label
- `require_responsive` - Must have responsive variants
- `no_hardcoded_colors` - Use semantic tokens

### P5: Reference Components
**Location:** `.nova/reference-components/`

| Component | Score | Demonstrates |
|-----------|-------|--------------|
| `DataTable.reference.tsx` | 48/50 | Sorting, filtering, pagination, all 5 states |
| `FormWithValidation.reference.tsx` | 49/50 | Real-time validation, multi-field form, progress |
| `DashboardCard.reference.tsx` | 47/50 | Loading, error, empty, sparklines, tooltips |
| `CommandPalette.reference.tsx` | 48/50 | Keyboard navigation, search, grouped commands |
| `NotificationToast.reference.tsx` | 48/50 | Severity levels, actions, progress, stacking |

---

## 🎯 Component Quality Score

### Scoring Rubric

| Dimension | Weight | 10/10 Criteria |
|-----------|--------|----------------|
| Visual Polish | 2x | Pixel-perfect spacing, perfect alignment, beautiful typography |
| Interaction Quality | 2x | All 6 states (default, hover, focus, active, disabled, loading) |
| Responsiveness | 2x | Flawless at all 4 breakpoints, touch-optimized |
| Accessibility | 2x | WCAG AA, screen reader tested, keyboard navigable |
| Animation Quality | 1x | Beautiful, purposeful 150-300ms transitions |
| Error Handling | 1x | All 5 UI states (loading, empty, error, partial, populated) |

**Formula:** `(Visual × 2) + (Interaction × 2) + (Responsive × 2) + (Accessibility × 2) + (Animation × 1) + (Error × 1)`

**Maximum:** 50 points  
**Minimum to pass:** 35 points

### Quality Checklist

Before marking complete, VENUS must verify:

- [ ] **Visual** - 4px grid, semantic tokens, proper typography
- [ ] **Interactions** - hover, focus, active, disabled, loading
- [ ] **Responsive** - mobile, tablet, desktop, wide breakpoints
- [ ] **Accessibility** - alt text, ARIA labels, keyboard nav, 4.5:1 contrast
- [ ] **Animations** - 150-300ms transitions, reduced motion support
- [ ] **Error Handling** - 5 UI states with real implementations
- [ ] **Anti-patterns** - No raw div onClick, no magic numbers, no nested ternaries
- [ ] **Score** - 35+/50 minimum

---

## 🚫 Anti-patterns Blacklist

VENUS must NEVER produce these patterns:

| Pattern | Severity | Why |
|---------|----------|-----|
| Raw `<div onClick>` | SEVERE | Accessibility violation - not keyboard accessible |
| Inline styles | SEVERE | Breaks theming, no design tokens |
| Magic numbers (`w-[123px]`) | SEVERE | Breaks consistency |
| Missing alt text | SEVERE | Screen readers can't describe images |
| Missing loading state | SEVERE | Users need feedback |
| Missing empty state | SEVERE | Blank screens confuse users |
| z-index over 50 | SEVERE | Maintenance nightmare |
| Nested ternaries in JSX | SEVERE | Unreadable code |
| Component over 200 lines | WARNING | Hard to maintain |
| Props drilling >2 levels | WARNING | Hard to refactor |

---

## 🧪 Automated Validation

MERCURY runs these checks automatically:

```
1. Parse VENUS output
2. Check forbidden patterns (regex)
3. Verify required patterns exist
4. Calculate quality score
5. Output: PASS/FAIL with specific issues
```

**Pass Example:**
```
PASS: Component meets all UX quality gates
Score: 42/50
- Visual Polish: 9/10
- Interaction Quality: 8/10
- Responsiveness: 7/10
- Accessibility: 8/10
- Animation Quality: 5/10
- Error Handling: 5/10
```

**Fail Example:**
```
FAIL: visual_consistency
Issue: Found arbitrary pixel value "w-[123px]"
How to fix: Use spacing scale (w-32 for 128px)
Severity: BLOCKING
```

---

## 📐 Design Tokens Quick Reference

### Spacing (4px Grid)
```
1 = 4px     6 = 24px    20 = 80px
2 = 8px     8 = 32px    24 = 96px
3 = 12px    10 = 40px   32 = 128px
4 = 16px    12 = 48px   48 = 192px
5 = 20px    16 = 64px   64 = 256px
```

### Semantic Colors
```tsx
// ✅ CORRECT
<div className="bg-card text-card-foreground border-border">

// ❌ WRONG
<div className="bg-white text-black border-gray-200">
```

### Border Radius
```
rounded-none  = 0px
rounded-sm    = 2px
rounded       = 4px (default)
rounded-md    = 6px
rounded-lg    = 8px
rounded-xl    = 12px
rounded-full  = 9999px
```

### Animation Duration
```
duration-150 = 150ms (button states)
duration-200 = 200ms (default transitions)
duration-300 = 300ms (component enter/exit)
duration-500 = 500ms (page transitions)
```

---

## ♿ Accessibility Requirements

### WCAG 2.1 AA Checklist

- [ ] **Color Contrast** - 4.5:1 for text, 3:1 for UI components
- [ ] **Touch Targets** - Minimum 44×44px
- [ ] **Keyboard Navigation** - Tab order logical, focus visible
- [ ] **Screen Readers** - All images have alt, forms have labels
- [ ] **Motion** - Respect `prefers-reduced-motion`
- [ ] **Semantic HTML** - Proper heading hierarchy, landmarks

### ARIA Requirements

```tsx
// Icon-only buttons MUST have aria-label
<Button size="icon" aria-label="Delete item">
  <Trash2 className="h-4 w-4" />
</Button>

// Form inputs MUST have associated labels
<Label htmlFor="email">Email</Label>
<Input id="email" aria-describedby="email-help" />
<p id="email-help">We'll never share your email.</p>

// Dynamic updates need aria-live
<div aria-live="polite">
  {statusMessage}
</div>
```

---

## 📱 Responsive Breakpoints

```tsx
// Mobile-first approach
<div className="
  /* Base: Mobile (320px+) */
  w-full px-4 py-4
  /* md: Tablet (768px+) */
  md:px-6 md:py-6
  /* lg: Desktop (1024px+) */
  lg:max-w-4xl lg:mx-auto
  /* xl: Wide (1440px+) */
  xl:max-w-6xl
">
```

| Breakpoint | Range | Target |
|------------|-------|--------|
| base | 320px-767px | Mobile phones |
| md: | 768px-1023px | Tablets |
| lg: | 1024px-1439px | Laptops |
| xl: | 1440px+ | Desktops |

---

## 🎬 Animation Standards

### Micro-interactions

```tsx
// Button with all states
<Button className="
  bg-primary text-primary-foreground
  hover:bg-primary/90 hover:shadow-md
  active:scale-[0.98] active:shadow-none
  focus-visible:ring-2 focus-visible:ring-ring
  disabled:opacity-50
  transition-all duration-200 ease-in-out
">
```

### Enter/Exit Animations

```tsx
// Modal enter
<div className="animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300">

// Toast exit
<div className="animate-out slide-out-to-right-full fade-out duration-200">
```

### Reduced Motion

```tsx
<div className="
  transition-all duration-300
  motion-reduce:transition-none
  motion-reduce:transform-none
">
```

---

## 🧰 Usage Guide

### For VENUS Agent

1. Read `tokens.md` for design values
2. Follow `component_template` structure
3. Implement all 5 UI states
4. Score component (minimum 35/50)
5. Run self-check before submitting

### For MERCURY Validator

1. Load `ux-quality-gates.json`
2. Check for anti-patterns (regex)
3. Verify design token usage
4. Calculate quality score
5. Output PASS/FAIL with specifics

### For Developers

1. Reference `reference-components/` for patterns
2. Use `components.md` for UI patterns
3. Follow `layouts.md` for page structures
4. Reference `animations.md` for motion
5. Use `patterns.md` for UX patterns

---

## ✅ Success Metrics

After implementing this system:

- **0** components with inline styles
- **0** components with raw div onClick
- **100%** components with all 5 UI states
- **100%** components pass WCAG AA
- **100%** components score 35+/50
- **100%** images have alt text
- **100%** interactive elements keyboard accessible

---

## 🚀 Quick Start

```bash
# Check component quality
/skill component-quality

# View design tokens
/cat .nova/design-system/tokens.md

# View reference component
/cat .nova/reference-components/DataTable.reference.tsx

# Validate against gates
/validate-ux component.tsx
```

---

**Version:** 1.0.0  
**Last Updated:** 2024  
**Owner:** VENUS (Frontend/UX Specialist)
