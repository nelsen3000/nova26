# useIntersectionObserver

## Source
Extracted from BistroLens `hooks/useIntersectionObserver.ts`

**Category:** 09-hooks
**Type:** Pattern
**Tags:** hooks, intersection-observer, lazy-loading, infinite-scroll, performance

---

## Overview

`useIntersectionObserver` wraps the browser's `IntersectionObserver` API for lazy loading images, triggering infinite scroll, and animating elements on entry into the viewport.

---

## Pattern

```typescript
// hooks/useIntersectionObserver.ts
import { useEffect, useRef, useState, useCallback } from "react";

interface IntersectionObserverOptions {
  threshold?: number | number[];
  rootMargin?: string;
  root?: Element | null;
  triggerOnce?: boolean; // Stop observing after first intersection
}

interface UseIntersectionObserverReturn {
  ref: React.RefCallback<Element>;
  isIntersecting: boolean;
  entry: IntersectionObserverEntry | null;
}

export function useIntersectionObserver(
  options: IntersectionObserverOptions = {}
): UseIntersectionObserverReturn {
  const { threshold = 0, rootMargin = "0px", root = null, triggerOnce = false } = options;

  const [isIntersecting, setIsIntersecting] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementRef = useRef<Element | null>(null);

  const ref: React.RefCallback<Element> = useCallback(
    (node) => {
      // Disconnect previous observer
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (!node) {
        elementRef.current = null;
        return;
      }

      elementRef.current = node;

      observerRef.current = new IntersectionObserver(
        ([observerEntry]) => {
          setIsIntersecting(observerEntry.isIntersecting);
          setEntry(observerEntry);

          if (observerEntry.isIntersecting && triggerOnce) {
            observerRef.current?.disconnect();
          }
        },
        { threshold, rootMargin, root }
      );

      observerRef.current.observe(node);
    },
    [threshold, rootMargin, root, triggerOnce]
  );

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return { ref, isIntersecting, entry };
}
```

---

## Usage

```tsx
// Lazy load images
function LazyImage({ src, alt }: { src: string; alt: string }) {
  const { ref, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
    triggerOnce: true,
  });

  return (
    <div ref={ref} className="min-h-[200px]">
      {isIntersecting && (
        <img src={src} alt={alt} loading="lazy" className="w-full h-auto" />
      )}
    </div>
  );
}

// Infinite scroll trigger
function InfiniteList({ loadMore }: { loadMore: () => void }) {
  const { ref, isIntersecting } = useIntersectionObserver({ threshold: 0.5 });

  useEffect(() => {
    if (isIntersecting) loadMore();
  }, [isIntersecting, loadMore]);

  return (
    <div>
      {/* list items */}
      <div ref={ref} className="h-4" /> {/* sentinel element */}
    </div>
  );
}

// Animate on scroll
function AnimatedSection({ children }: { children: React.ReactNode }) {
  const { ref, isIntersecting } = useIntersectionObserver({
    threshold: 0.2,
    triggerOnce: true,
  });

  return (
    <section
      ref={ref}
      className={`transition-all duration-700 ${
        isIntersecting ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      {children}
    </section>
  );
}
```

---

## Anti-Patterns

### Don't Do This

```typescript
// Creating observer in useEffect without cleanup
useEffect(() => {
  const observer = new IntersectionObserver(callback);
  observer.observe(element);
  // Missing: return () => observer.disconnect();
}, []);

// Not using triggerOnce for one-time animations
// Observer keeps firing on every scroll — wasteful
const { isIntersecting } = useIntersectionObserver({ threshold: 0.5 });
// Should be: triggerOnce: true for animations

// Observing non-existent elements
const ref = useRef<HTMLDivElement>(null);
observer.observe(ref.current!); // ref.current may be null on first render
```

### Do This Instead

```typescript
// Use the hook with triggerOnce for animations and lazy loading
const { ref, isIntersecting } = useIntersectionObserver({
  threshold: 0.1,
  triggerOnce: true, // Disconnects after first intersection
});

// The hook handles cleanup automatically via RefCallback pattern
return <div ref={ref}>{isIntersecting && <ExpensiveComponent />}</div>;
```

---

## When to Use This Pattern

**Use for:**
- Lazy loading images and heavy components below the fold
- Infinite scroll sentinel elements that trigger data fetching
- Scroll-triggered animations (fade-in, slide-up on viewport entry)

**Don't use for:**
- Elements that are always visible in the viewport
- Time-based animations that don't depend on scroll position

---

## Benefits

1. RefCallback pattern handles dynamic DOM elements without stale refs
2. Automatic cleanup on unmount prevents memory leaks
3. `triggerOnce` option avoids unnecessary re-observations for one-time effects
4. No external library dependency — wraps the native IntersectionObserver API

---

## Related Patterns

- `use-debounce.md` — Debounce for scroll events
- `../02-react-patterns/memo-optimization.md` — React.memo for list items
- `../02-react-patterns/suspense-patterns.md` — Lazy loading with Suspense
