# useMediaQuery Hook

## Source
Extracted from BistroLens responsive patterns in:
- `components/Hero.tsx` (viewport-based layout switching)
- `components/ui/SuperNavBar.tsx` (desktop/mobile nav detection)
- `components/WelcomeModal.tsx` (responsive modal layout)
- `components/SocialShareModal.tsx` (canvas scale detection)

---

## Pattern: Media Query Hook for Responsive Design

A custom React hook that listens to viewport changes and returns boolean values for responsive design decisions. BistroLens uses this pattern to switch between mobile and desktop layouts — for example, the Hero headline switches from a two-line mobile layout to a single-line desktop layout at 1024px.

The codebase uses **inline `window.innerWidth` + resize listener** as the primary pattern. This document extracts that into a reusable `useMediaQuery` hook and breakpoint-specific helpers.

---

## Core Implementation

### Pattern 1: Inline Viewport Detection (BistroLens Native)

The primary pattern used directly in `Hero.tsx` and `SuperNavBar.tsx`:

```typescript
import { useState, useEffect } from 'react';

// Desktop breakpoint for single-line headline (Hero.tsx)
const DESKTOP_BREAKPOINT = 1024;

export const Hero: React.FC = () => {
  const [isDesktop, setIsDesktop] = useState(false);

  // Track viewport width for responsive headline layout
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    checkDesktop(); // Set initial value
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop); // Cleanup
  }, []);

  return (
    <div
      style={{
        flexDirection: isDesktop ? 'row' : 'column',
        alignItems: isDesktop ? 'baseline' : 'center',
      }}
    >
      {/* Headline content */}
    </div>
  );
};
```

### Pattern 2: Desktop Detection with Side Effects (SuperNavBar.tsx)

Closing menus when the viewport changes — a common real-world use case:

```typescript
import { useState, useEffect } from 'react';

const SuperNavBar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      const newIsDesktop = window.innerWidth >= 1024;
      setIsDesktop(newIsDesktop);

      // Close mobile menu when switching to desktop
      if (newIsDesktop && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }

      // Close desktop dropdowns when switching to mobile
      if (!newIsDesktop) {
        setShowExploreMenu(false);
        setShowResourcesMenu(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mobileMenuOpen]);

  return (
    <nav>
      {/* Desktop nav — conditionally rendered */}
      <div className={`${isDesktop ? 'flex' : 'hidden'} items-center gap-2`}>
        {/* Desktop links */}
      </div>

      {/* Mobile menu toggle — only shown on mobile */}
      <button className={`${!isDesktop ? 'flex' : 'hidden'}`}>
        Menu
      </button>
    </nav>
  );
};
```

### Pattern 3: Quick Inline Check (SocialShareModal.tsx)

For one-off checks where a full hook is overkill:

```typescript
// Quick inline check for canvas scale factor
const isMobile = window.innerWidth < 768;
const scale = isMobile ? 1.5 : 2;

return await html2canvas(element, { scale });
```

---

## Reusable Hook (Extracted Pattern)

### useMediaQuery — Generic Hook

Extract the resize listener pattern into a reusable hook:

```typescript
import { useState, useEffect } from 'react';

/**
 * Custom hook to track viewport width against a breakpoint.
 * Extracted from BistroLens Hero.tsx and SuperNavBar.tsx patterns.
 *
 * @param breakpoint - Minimum width in pixels (e.g., 1024 for desktop)
 * @returns boolean — true if viewport width >= breakpoint
 */
export function useMinWidth(breakpoint: number): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    // SSR safety — default to false on server
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= breakpoint;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const check = () => setMatches(window.innerWidth >= breakpoint);
    check(); // Set initial value

    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check); // Cleanup
  }, [breakpoint]);

  return matches;
}
```

### useMediaQuery — CSS Media Query Variant

For cases requiring full CSS media query syntax (e.g., `prefers-reduced-motion`):

```typescript
import { useState, useEffect } from 'react';

/**
 * Custom hook to listen to CSS media queries.
 * Use for non-width queries like prefers-reduced-motion, prefers-color-scheme.
 *
 * @param query - CSS media query string (e.g., "(prefers-reduced-motion: reduce)")
 * @returns boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

    setMatches(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
```

---

## Breakpoint-Specific Hooks

### Tailwind-Aligned Breakpoints

Matching BistroLens's Tailwind CSS defaults (standard Tailwind breakpoints):

```typescript
// Breakpoints matching Tailwind CSS defaults
export const Breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,  // BistroLens DESKTOP_BREAKPOINT
  xl: 1280,
  '2xl': 1536,
} as const;

/**
 * Hook for mobile screens (< 768px)
 * Matches BistroLens SocialShareModal: window.innerWidth < 768
 */
export function useIsMobile(): boolean {
  return !useMinWidth(Breakpoints.md);
}

/**
 * Hook for tablet and above (>= 768px)
 */
export function useIsTablet(): boolean {
  return useMinWidth(Breakpoints.md);
}

/**
 * Hook for desktop screens (>= 1024px)
 * Matches BistroLens Hero.tsx DESKTOP_BREAKPOINT = 1024
 * Matches BistroLens SuperNavBar.tsx: window.innerWidth >= 1024
 */
export function useIsDesktop(): boolean {
  return useMinWidth(Breakpoints.lg);
}

/**
 * Hook for large desktop screens (>= 1280px)
 */
export function useIsLargeDesktop(): boolean {
  return useMinWidth(Breakpoints.xl);
}
```

---

## Accessibility Hooks

### Prefers Reduced Motion

```typescript
/**
 * Check if user prefers reduced motion (accessibility).
 * Use to disable animations for users who have enabled this OS setting.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
```

Usage with Framer Motion (as used in BistroLens WelcomeModal.tsx):

```typescript
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';

export function AnimatedCard({ children }: { children: React.ReactNode }) {
  const prefersReduced = usePrefersReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReduced ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.3 }}
    >
      {children}
    </motion.div>
  );
}
```

---

## Usage Examples

### Responsive Hero Headline (BistroLens Pattern)

```typescript
import { useIsDesktop } from '@/hooks/useMediaQuery';

// Gap constants from BistroLens Hero.tsx
const GAP_STANDARD_EM = '0.25em';
const GAP_ROTATING_EM = '0.4em';
const ROTATING_SLOT_WIDTH = 'clamp(220px, 20vw, 320px)';

export function HeroHeadline() {
  const isDesktop = useIsDesktop();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isDesktop ? 'row' : 'column',
        alignItems: isDesktop ? 'baseline' : 'center',
        justifyContent: 'center',
        gap: isDesktop ? GAP_STANDARD_EM : '8px',
      }}
    >
      <span style={{ fontSize: isDesktop ? '4rem' : '2.5rem' }}>
        create something
      </span>
      <span
        style={{
          width: isDesktop ? ROTATING_SLOT_WIDTH : 'auto',
          textAlign: isDesktop ? 'left' : 'center',
        }}
      >
        {/* Rotating word */}
      </span>
    </div>
  );
}
```

### Responsive Navigation (BistroLens Pattern)

```typescript
import { useIsDesktop } from '@/hooks/useMediaQuery';

export function ResponsiveNav() {
  const isDesktop = useIsDesktop();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when switching to desktop
  useEffect(() => {
    if (isDesktop && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [isDesktop, mobileMenuOpen]);

  return (
    <nav>
      {/* Desktop links */}
      <div className={isDesktop ? 'flex' : 'hidden'}>
        <DesktopLinks />
      </div>

      {/* Mobile hamburger */}
      <button className={!isDesktop ? 'flex' : 'hidden'}>
        <MenuIcon />
      </button>
    </nav>
  );
}
```

### Canvas Scale Based on Viewport

```typescript
import { useIsMobile } from '@/hooks/useMediaQuery';

export function useCanvasScale(): number {
  const isMobile = useIsMobile();
  // BistroLens SocialShareModal.tsx: mobile = 1.5x, desktop = 2x
  return isMobile ? 1.5 : 2;
}
```

---

## Anti-Patterns

### Don't: Read window.innerWidth Directly in Render

```typescript
// BAD: Doesn't update when screen size changes — stale value
function BadComponent() {
  const isMobile = window.innerWidth < 768; // Snapshot, not reactive!
  return <div>{isMobile ? 'Mobile' : 'Desktop'}</div>;
}
```

### Do: Use a Hook That Subscribes to Resize

```typescript
// GOOD: Reactive — updates when viewport changes
function GoodComponent() {
  const isMobile = useIsMobile();
  return <div>{isMobile ? 'Mobile' : 'Desktop'}</div>;
}
```

### Don't: Forget the Cleanup

```typescript
// BAD: Memory leak — listener fires after component unmounts
useEffect(() => {
  window.addEventListener('resize', handleResize);
  // Missing return () => window.removeEventListener(...)
}, []);
```

### Do: Always Return the Cleanup Function

```typescript
// GOOD: Listener removed on unmount
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

### Don't: Skip SSR Safety

```typescript
// BAD: Crashes during server-side rendering
const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
```

### Do: Guard Against SSR

```typescript
// GOOD: Safe on server — defaults to false
const [isDesktop, setIsDesktop] = useState(() => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 1024;
});
```

### Don't: Use CSS Breakpoints for Logic That Needs JS

```typescript
// BAD: CSS classes can't drive JS logic like closing menus
<div className="hidden md:block">
  {/* Can't use this to conditionally run JS */}
</div>
```

### Do: Use Tailwind for Pure CSS, Hooks for JS Logic

```typescript
// GOOD: Tailwind for visual show/hide, hook for JS side effects
const isDesktop = useIsDesktop();

// JS side effect (close menu on resize)
useEffect(() => {
  if (isDesktop) setMobileMenuOpen(false);
}, [isDesktop]);

// CSS for visual layout (no JS needed)
<div className="hidden md:flex items-center gap-2">
  <DesktopLinks />
</div>
```

---

## When to Use This Pattern

**Use for:**
- Switching between mobile and desktop layouts in JS (not just CSS)
- Running side effects when viewport changes (e.g., closing menus)
- Adjusting canvas/image scale based on device type
- Accessibility preferences (`prefers-reduced-motion`, `prefers-color-scheme`)
- Conditional feature loading (load heavy features only on desktop)
- Touch vs. mouse input detection

**Don't use for:**
- Pure CSS show/hide — use Tailwind responsive classes (`hidden md:block`)
- Simple responsive styling — use Tailwind breakpoint prefixes (`md:flex-row`)
- Server-side rendering without SSR guards (causes hydration mismatches)

---

## Benefits

1. Reactive — automatically updates when viewport changes
2. Reusable — one hook for all breakpoint needs
3. Type-safe — TypeScript support with proper types
4. SSR-safe — handles server-side rendering gracefully
5. Memory-efficient — proper cleanup prevents memory leaks
6. Composable — combine with other hooks for complex responsive logic
7. Testable — easy to mock `window.innerWidth` in tests

---

## Related Patterns

- See `use-swipe-gesture.md` for touch-specific mobile interactions
- See `use-debounce.md` for debouncing resize-heavy operations
- See `../04-ui-components/card-layouts.md` for responsive grid layouts
- See `../04-ui-components/form-components.md` for responsive form layouts

---

*Extracted: 2026-02-18*
