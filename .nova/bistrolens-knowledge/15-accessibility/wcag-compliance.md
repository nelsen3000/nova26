# WCAG Compliance Patterns

## Source
Extracted from BistroLens `.kiro/steering/50-ACCESSIBILITY-WCAG-COMPLIANCE.md`, `components/PantryScannerModal.test.tsx`, `components/TonightCTA.tsx`, `components/SettingsModal.tsx`, `components/LoginPage.tsx`

---

## Compliance Target

BistroLens targets **WCAG 2.1 Level AA** across all features.

| Principle | Description |
|-----------|-------------|
| Perceivable | Content must be presentable in ways users can perceive |
| Operable | UI must be operable by all users |
| Understandable | Content must be understandable |
| Robust | Content must work with assistive technologies |

---

## Pattern: Color Contrast Requirements

Normal text requires a 4.5:1 contrast ratio; large text and UI components require 3:1.

### Code Example

```typescript
// From 50-ACCESSIBILITY-WCAG-COMPLIANCE.md
const CONTRAST_REQUIREMENTS = {
  normalText: 4.5,    // WCAG AA minimum for body text
  largeText: 3.0,     // 18px+ or 14px bold
  uiComponents: 3.0,  // Interactive elements (buttons, inputs)

  largeTextSize: 18,  // px
  largeBoldSize: 14,  // px bold
};

// BistroLens accessible color palette
const ACCESSIBLE_COLORS = {
  primary: {
    background: '#f97316',  // Orange
    foreground: '#000000',  // Black text — 4.6:1 ratio, passes AA
  },
  text: {
    primary: '#171717',     // Near black — high contrast on white
    secondary: '#525252',   // Gray — verify contrast per context
    onDark: '#fafafa',      // Near white — for dark backgrounds
  },
  status: {
    success: { bg: '#22c55e', fg: '#000000' },
    error:   { bg: '#ef4444', fg: '#ffffff' },
    warning: { bg: '#f59e0b', fg: '#000000' },
    info:    { bg: '#3b82f6', fg: '#ffffff' },
  },
};
```

### Don't Rely on Color Alone

```tsx
// ❌ BAD — color is the only differentiator
<span className={error ? 'text-red-500' : 'text-green-500'}>
  Status
</span>

// ✅ GOOD — color + icon + text label
<span className={error ? 'text-red-500' : 'text-green-500'}>
  {error ? <XIcon aria-hidden="true" /> : <CheckIcon aria-hidden="true" />}
  {error ? 'Error' : 'Success'}
</span>
```

---

## Pattern: Touch Target Sizes (44×44px Minimum)

Interactive elements on mobile must be at least 44×44px to meet WCAG 2.5.5 (Target Size).

### Code Example

```tsx
// components/TonightCTA.tsx — min-h-[44px] on all action buttons
<button
  onClick={handleResume}
  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-brand-primary text-brand-on-primary rounded-xl font-semibold text-sm min-h-[44px]"
  aria-label={`Continue cooking ${resumeState.recipeTitle}`}
>
  <PlayIcon className="w-4 h-4" />
  Continue Cooking
</button>

<button
  onClick={handleStartFresh}
  className="px-3 py-3 text-brand-black/60 hover:text-brand-black hover:bg-brand-white rounded-xl transition-colors min-h-[44px]"
  aria-label="Start fresh with a new recipe"
>
  <RefreshIcon className="w-5 h-5" />
</button>

// components/SettingsModal.tsx — mobile-first: 44px on mobile, smaller on md+
<button
  className="flex-1 px-4 py-3 md:px-2 md:py-1.5 rounded-lg text-sm font-semibold min-h-[44px] md:min-h-0 ..."
>
  {opt.label}
</button>
```

---

## Pattern: Visible Focus Indicators

Every interactive element must show a visible focus ring (WCAG 2.4.7 Focus Visible).

### Code Example

```tsx
// Tailwind focus ring on inputs
<input
  className="... focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none"
/>

// Tailwind focus ring on checkboxes
<input
  type="checkbox"
  className="w-4 h-4 text-brand-primary bg-[#121212] border-[#535353] rounded focus:ring-brand-primary focus:ring-2"
/>

// Design token from 50-ACCESSIBILITY-WCAG-COMPLIANCE.md
const FOCUS_RULES = {
  focusStyle: 'ring-2 ring-orange-500 ring-offset-2',
};

// Skip link — sr-only by default, visible on focus
<a
  href="#main"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand-primary focus:text-white focus:rounded"
>
  Skip to main content
</a>
```

---

## Pattern: Error Identification

Errors must be identified in text (not color alone) and associated with the relevant input.

### Code Example

```tsx
// From 50-ACCESSIBILITY-WCAG-COMPLIANCE.md
const FORM_ERROR_RULES = {
  useAriaInvalid: true,       // Mark invalid inputs
  useAriaDescribedby: true,   // Link input to error message
  useRoleAlert: true,         // Announce errors immediately
  clearLanguage: true,        // Plain-language error messages
  suggestCorrection: true,    // Tell users how to fix it
  focusFirstError: true,      // Move focus to first error on submit
  announceErrors: true,       // Announce via live region
};

// Accessible error pattern
<div>
  <label htmlFor="recipe-name">Recipe Name *</label>
  <input
    id="recipe-name"
    type="text"
    aria-required="true"
    aria-invalid={!!error}
    aria-describedby={error ? 'name-error' : 'name-hint'}
    className={`border rounded-lg p-2 ${error ? 'border-red-500' : 'border-brand-black/20'}`}
  />
  {!error && (
    <span id="name-hint" className="text-sm text-gray-500">
      Enter a descriptive name
    </span>
  )}
  {error && (
    <span id="name-error" role="alert" className="text-red-500 text-sm flex items-center gap-1">
      <XIcon className="w-4 h-4" aria-hidden="true" />
      {error}
    </span>
  )}
</div>
```

---

## Pattern: Reduced Motion Support

Respect the `prefers-reduced-motion` media query for users who are sensitive to animation.

### Code Example

```css
/* Global CSS — disable all animations when user prefers reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

```typescript
// React hook from 50-ACCESSIBILITY-WCAG-COMPLIANCE.md
function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);
    mq.addEventListener('change', (e) => setPrefersReduced(e.matches));
  }, []);

  return prefersReduced;
}

// Usage in animated component
const prefersReduced = useReducedMotion();

<motion.div
  animate={prefersReduced ? {} : { opacity: 1, y: 0 }}
  transition={prefersReduced ? { duration: 0 } : { duration: 0.3 }}
>
  {children}
</motion.div>
```

---

## Pattern: Automated Testing with jest-axe

Run axe-core accessibility checks as part of the test suite to catch violations automatically.

### Code Example

```typescript
// components/PantryScannerModal.test.tsx
import { axe, toHaveNoViolations } from 'jest-axe';
import { render } from '@testing-library/react';

// Extend Jest matchers once (typically in setupTests.ts)
expect.extend(toHaveNoViolations);

describe('PantryScannerModal', () => {
  it('should render in camera state and pass accessibility audit', async () => {
    const { container } = render(
      <PantryScannerModal
        onClose={mockOnClose}
        onAddItems={mockOnAddItems}
        existingPantry={mockExistingPantry}
      />
    );

    // Verify the labelled element exists
    expect(screen.getByLabelText('Take photo of pantry items')).toBeInTheDocument();

    // Run axe and assert no violations
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### Setup (setupTests.ts)

```typescript
// Add once to your test setup file
import { toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);
```

### Installation

```bash
npm install --save-dev jest-axe @types/jest-axe
```

---

## Pattern: Manual Testing Checklist

Automated tools catch ~30% of issues. Manual testing covers the rest.

### Code Example

```typescript
// From 50-ACCESSIBILITY-WCAG-COMPLIANCE.md
const MANUAL_TESTS = {
  keyboard: [
    'Tab through all interactive elements',
    'Activate buttons with Enter/Space',
    'Navigate menus with arrow keys',
    'Close modals with Escape',
    'Visible focus indicator on every element',
  ],
  screenReader: [
    'Test with VoiceOver (Mac/iOS)',
    'Test with NVDA (Windows)',
    'All content announced correctly',
    'Proper heading structure (h1 → h2 → h3)',
    'Form labels read correctly',
  ],
  visual: [
    'Zoom to 200% — no content loss',
    'High contrast mode',
    'Color blindness simulation',
    'Reduced motion preference',
  ],
};

const AUTOMATED_TESTS = [
  'axe-core (jest-axe)',   // Accessibility violations
  'lighthouse',            // Accessibility score
  'pa11y',                 // WCAG compliance
];
```

---

## Anti-Patterns

### ❌ Don't Do This

```tsx
// Removing focus outline with no replacement
<button className="outline-none focus:outline-none">Click me</button>

// Touch target too small on mobile
<button className="p-1 text-xs">✕</button>

// Color-only error state
<input className={error ? 'border-red-500' : 'border-gray-300'} />

// Autoplay video/audio
<video autoPlay src="intro.mp4" />
```

### ✅ Do This Instead

```tsx
// Visible focus ring
<button className="outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2">
  Click me
</button>

// Adequate touch target
<button className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center">
  <XIcon className="w-5 h-5" />
  <span className="sr-only">Close</span>
</button>

// Color + text + icon for error
<input
  aria-invalid={!!error}
  className={error ? 'border-red-500' : 'border-gray-300'}
/>
{error && (
  <span role="alert" className="text-red-500 flex items-center gap-1">
    <XIcon aria-hidden="true" />
    {error}
  </span>
)}

// User-controlled media
<video controls src="intro.mp4" />
```

---

## When to Use This Pattern

✅ **Use for:**
- Every component (color contrast is always required)
- All interactive elements on mobile (touch targets)
- All interactive elements (focus indicators)
- All form inputs with validation (error identification)
- Components with animation (reduced motion)
- Component tests (jest-axe audit)

❌ **Don't use for:**
- Skipping — WCAG AA is a baseline requirement, not optional

---

## Benefits

1. Meets legal accessibility requirements (ADA, EN 301 549)
2. Improves usability for all users, not just those with disabilities
3. Automated tests catch regressions before they ship
4. Reduced motion support prevents harm to users with vestibular disorders

---

## Related Patterns

- See `aria-patterns.md` for ARIA attribute usage
- See `keyboard-navigation.md` for keyboard operability
- See `screen-reader.md` for screen reader support

---

*Extracted: 2026-02-18*
