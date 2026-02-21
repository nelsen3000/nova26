# useMediaQuery Hook

## Source
Extracted from BistroLens patterns in:
- `components/design-system/tokens.ts` (BreakpointTokens)
- `components/dev/LayoutInspector.tsx` (getBreakpointName function)
- `utils/accessibilityUtils.ts` (prefersReducedMotion)
- `lib/cdnHelper.ts` (responsive image patterns)

---

## Pattern: Media Query Hook for Responsive Design

A custom React hook that listens to CSS media queries and returns boolean values for responsive design decisions. Essential for building mobile-first, accessible applications that adapt to different screen sizes and user preferences.

---

## Implementation

### Basic useMediaQuery Hook

```typescript
import { useState, useEffect } from 'react';

/**
 * Custom hook to listen to media queries
 * @param query - CSS media query string (e.g., "(min-width: 768px)")
 * @returns boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    // Server-side rendering safety
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    // Server-side rendering safety
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    
    // Update state when media query changes
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Set initial value
    setMatches(mediaQuery.matches);

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}
```

---

## Breakpoint-Specific Hooks

### Tailwind Breakpoint Hooks

```typescript
/**
 * Breakpoint tokens matching Tailwind CSS defaults
 */
export const BreakpointTokens = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

/**
 * Hook for mobile screens (< 640px)
 */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${BreakpointTokens.sm})`);
}

/**
 * Hook for tablet screens (>= 768px)
 */
export function useIsTablet(): boolean {
  return useMediaQuery(`(min-width: ${BreakpointTokens.md})`);
}

/**
 * Hook for desktop screens (>= 1024px)
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${BreakpointTokens.lg})`);
}

/**
 * Hook for large desktop screens (>= 1280px)
 */
export function useIsLargeDesktop(): boolean {
  return useMediaQuery(`(min-width: ${BreakpointTokens.xl})`);
}
```

---

## Breakpoint Name Detection

### Get Current Breakpoint Name

```typescript
/**
 * Get the current breakpoint name based on viewport width
 * @param width - Viewport width in pixels
 * @returns Breakpoint name (xs, sm, md, lg, xl, 2xl)
 */
export function getBreakpointName(width: number): string {
  if (width >= 1536) return '2xl';
  if (width >= 1280) return 'xl';
  if (width >= 1024) return 'lg';
  if (width >= 768) return 'md';
  if (width >= 640) return 'sm';
  return 'xs';
}

/**
 * Hook to get current breakpoint name
 * @returns Current breakpoint name
 */
export function useBreakpoint(): string {
  const [breakpoint, setBreakpoint] = useState<string>(() => {
    if (typeof window === 'undefined') return 'md';
    return getBreakpointName(window.innerWidth);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setBreakpoint(getBreakpointName(window.innerWidth));
    };

    // Set initial value
    handleResize();

    // Listen for resize
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return breakpoint;
}
```

---

## Accessibility: Reduced Motion

### Prefers Reduced Motion Hook

```typescript
/**
 * Check if user prefers reduced motion (accessibility)
 * @returns boolean indicating if reduced motion is preferred
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Get animation duration respecting reduced motion preference
 * @param normalDuration - Normal animation duration in ms
 * @returns Duration (0 if reduced motion preferred, normal otherwise)
 */
export function useAccessibleDuration(normalDuration: number): number {
  const prefersReduced = usePrefersReducedMotion();
  return prefersReduced ? 0 : normalDuration;
}
```

---

## Dark Mode Detection

### Prefers Color Scheme Hook

```typescript
/**
 * Check if user prefers dark color scheme
 * @returns boolean indicating if dark mode is preferred
 */
export function usePrefersDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

/**
 * Hook for color scheme with fallback
 * @param defaultScheme - Default color scheme ('light' or 'dark')
 * @returns Current color scheme
 */
export function useColorScheme(defaultScheme: 'light' | 'dark' = 'light'): 'light' | 'dark' {
  const prefersDark = usePrefersDarkMode();
  
  if (typeof window === 'undefined') return defaultScheme;
  
  return prefersDark ? 'dark' : 'light';
}
```

---

## Usage Examples

### Responsive Component Rendering

```typescript
import { useIsMobile, useIsDesktop } from '@/hooks/useMediaQuery';

export function ResponsiveNav() {
  const isMobile = useIsMobile();
  const isDesktop = useIsDesktop();

  return (
    <nav>
      {isMobile && <MobileMenu />}
      {isDesktop && <DesktopMenu />}
    </nav>
  );
}
```

### Conditional Rendering Based on Breakpoint

```typescript
import { useBreakpoint } from '@/hooks/useMediaQuery';

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const breakpoint = useBreakpoint();
  
  // Show different layouts based on breakpoint
  const columns = {
    xs: 1,
    sm: 2,
    md: 2,
    lg: 3,
    xl: 4,
    '2xl': 4,
  }[breakpoint] || 2;

  return (
    <div className={`grid grid-cols-${columns} gap-4`}>
      {/* Recipe content */}
    </div>
  );
}
```

### Accessible Animations

```typescript
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { motion } from 'framer-motion';

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

### Dark Mode Toggle

```typescript
import { usePrefersDarkMode } from '@/hooks/useMediaQuery';
import { useEffect } from 'react';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const prefersDark = usePrefersDarkMode();

  useEffect(() => {
    if (prefersDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [prefersDark]);

  return <>{children}</>;
}
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// ❌ BAD: Creating new MediaQueryList on every render
function BadComponent() {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  // This doesn't update when screen size changes!
  return <div>{isMobile ? 'Mobile' : 'Desktop'}</div>;
}

// ❌ BAD: Not cleaning up event listeners
function BadHook(query: string) {
  const [matches, setMatches] = useState(false);
  
  useEffect(() => {
    const mq = window.matchMedia(query);
    mq.addEventListener('change', (e) => setMatches(e.matches));
    // Missing cleanup! Memory leak!
  }, [query]);
  
  return matches;
}

// ❌ BAD: Not handling SSR
function BadSSRHook(query: string) {
  const [matches, setMatches] = useState(
    window.matchMedia(query).matches // Crashes on server!
  );
  return matches;
}

// ❌ BAD: Hardcoding breakpoints instead of using tokens
function BadBreakpoint() {
  return useMediaQuery('(min-width: 768px)'); // Magic number!
}
```

### ✅ Do This Instead

```typescript
// ✅ GOOD: Use custom hook with proper cleanup
function GoodComponent() {
  const isMobile = useMediaQuery(`(max-width: ${BreakpointTokens.md})`);
  return <div>{isMobile ? 'Mobile' : 'Desktop'}</div>;
}

// ✅ GOOD: Proper cleanup and SSR handling
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler); // Cleanup!
  }, [query]);

  return matches;
}

// ✅ GOOD: Use breakpoint tokens
function GoodBreakpoint() {
  return useMediaQuery(`(min-width: ${BreakpointTokens.md})`);
}

// ✅ GOOD: Use semantic hook names
function GoodSemanticHook() {
  return useIsTablet(); // Clear intent!
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Responsive component rendering (mobile vs desktop layouts)
- Conditional feature loading (load heavy features only on desktop)
- Accessibility preferences (reduced motion, dark mode)
- Touch vs mouse input detection
- Print styles detection
- Orientation changes (portrait vs landscape)
- High contrast mode detection
- Viewport-specific optimizations

❌ **Don't use for:**
- CSS-only responsive design (use Tailwind responsive classes instead)
- Simple show/hide based on screen size (use CSS `hidden md:block`)
- Server-side rendering without proper guards (will cause hydration mismatches)
- Frequent re-renders (consider debouncing resize events)

---

## Benefits

1. **Reactive**: Automatically updates when media query changes
2. **Reusable**: Single hook for all media query needs
3. **Type-safe**: TypeScript support with proper types
4. **SSR-safe**: Handles server-side rendering gracefully
5. **Memory-efficient**: Proper cleanup prevents memory leaks
6. **Accessible**: Built-in support for accessibility preferences
7. **Performance**: Uses native browser APIs efficiently
8. **Testable**: Easy to mock in tests

---

## Performance Considerations

### Debouncing Resize Events

```typescript
import { useState, useEffect } from 'react';

/**
 * Debounced version for resize-heavy scenarios
 */
export function useDebouncedMediaQuery(query: string, delay: number = 150): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia(query);
    let timeoutId: NodeJS.Timeout;

    const handler = (e: MediaQueryListEvent) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setMatches(e.matches);
      }, delay);
    };

    mq.addEventListener('change', handler);
    return () => {
      clearTimeout(timeoutId);
      mq.removeEventListener('change', handler);
    };
  }, [query, delay]);

  return matches;
}
```

---

## Testing

### Mock Media Queries in Tests

```typescript
// Test setup
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

// Test example
test('useIsMobile returns true for mobile screens', () => {
  window.matchMedia = jest.fn().mockImplementation(query => ({
    matches: query === '(max-width: 640px)',
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));

  const { result } = renderHook(() => useIsMobile());
  expect(result.current).toBe(true);
});
```

---

## Related Patterns

- See `button-variants.md` for responsive button sizing
- See `card-layouts.md` for responsive grid layouts
- See `form-components.md` for responsive form layouts
- See `useDebounce.md` for debouncing resize events
- See `accessibility-patterns.md` for more accessibility hooks

---

*Extracted: 2026-02-18*
