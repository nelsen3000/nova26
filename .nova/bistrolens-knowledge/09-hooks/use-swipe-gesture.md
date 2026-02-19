# useSwipeGesture

## Source
Extracted from BistroLens `hooks/useSwipeGesture.ts`

**Category:** 09-hooks
**Type:** Pattern
**Tags:** hooks, mobile, swipe, gesture, touch, responsive

---

## Overview

`useSwipeGesture` detects horizontal and vertical swipe gestures on touch devices. Used for mobile navigation, dismissible cards, and carousel interactions.

---

## Pattern

```typescript
// hooks/useSwipeGesture.ts
import { useRef, useCallback } from "react";

type SwipeDirection = "left" | "right" | "up" | "down";

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface SwipeOptions {
  threshold?: number;       // Minimum px to register as swipe (default: 50)
  velocityThreshold?: number; // Minimum px/ms (default: 0.3)
  preventScroll?: boolean;  // Prevent page scroll during swipe
}

interface UseSwipeGestureReturn {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export function useSwipeGesture(
  handlers: SwipeHandlers,
  options: SwipeOptions = {}
): UseSwipeGestureReturn {
  const { threshold = 50, velocityThreshold = 0.3, preventScroll = false } = options;

  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (preventScroll && touchStart.current) {
        e.preventDefault();
      }
    },
    [preventScroll]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStart.current.x;
      const deltaY = touch.clientY - touchStart.current.y;
      const elapsed = Date.now() - touchStart.current.time;

      const velocityX = Math.abs(deltaX) / elapsed;
      const velocityY = Math.abs(deltaY) / elapsed;

      const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

      if (isHorizontal && Math.abs(deltaX) >= threshold && velocityX >= velocityThreshold) {
        if (deltaX < 0) {
          handlers.onSwipeLeft?.();
        } else {
          handlers.onSwipeRight?.();
        }
      } else if (!isHorizontal && Math.abs(deltaY) >= threshold && velocityY >= velocityThreshold) {
        if (deltaY < 0) {
          handlers.onSwipeUp?.();
        } else {
          handlers.onSwipeDown?.();
        }
      }

      touchStart.current = null;
    },
    [handlers, threshold, velocityThreshold]
  );

  return { onTouchStart, onTouchMove, onTouchEnd };
}
```

---

## Usage

```tsx
// Swipeable card component
function SwipeableCard({ onDismiss, onArchive }: { onDismiss: () => void; onArchive: () => void }) {
  const swipeHandlers = useSwipeGesture(
    {
      onSwipeLeft: onDismiss,
      onSwipeRight: onArchive,
    },
    { threshold: 80 }
  );

  return (
    <div
      className="bg-white rounded-lg p-4 shadow"
      {...swipeHandlers}
    >
      <p>Swipe left to dismiss, right to archive</p>
    </div>
  );
}

// Mobile navigation drawer
function MobileNav({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const swipeHandlers = useSwipeGesture(
    { onSwipeLeft: onClose },
    { preventScroll: true }
  );

  return (
    <nav
      className={`fixed inset-y-0 left-0 w-64 bg-white ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      {...swipeHandlers}
    >
      {/* nav content */}
    </nav>
  );
}
```

---

## Anti-Patterns

### Don't Do This

```typescript
// No velocity check — slow drags trigger swipe
if (Math.abs(deltaX) > 50) onSwipeLeft(); // Slow drag counts as swipe

// No threshold — tiny movements trigger swipe
const swipeHandlers = useSwipeGesture({ onSwipeLeft }, { threshold: 0 });

// Blocking scroll without user intent
// preventScroll: true on a scrollable list breaks vertical scrolling
```

### Do This Instead

```typescript
// Use both distance threshold and velocity check
const swipeHandlers = useSwipeGesture(
  { onSwipeLeft: onDismiss, onSwipeRight: onArchive },
  { threshold: 80, velocityThreshold: 0.3 } // Requires intentional, fast swipe
);
```

---

## When to Use This Pattern

**Use for:**
- Mobile navigation drawers with swipe-to-close
- Dismissible cards and notifications on touch devices
- Carousel and image gallery navigation

**Don't use for:**
- Desktop-only interfaces where mouse drag is the primary interaction
- Scrollable content areas where swipe conflicts with native scroll

---

## Benefits

1. Velocity-based detection distinguishes intentional swipes from accidental drags
2. Configurable thresholds allow tuning per use case (cards vs. navigation)
3. Supports all four directions with independent handlers
4. Lightweight — no external gesture library dependency

---

## Related Patterns

- `use-media-query.md` — Responsive breakpoint detection
- `../04-ui-components/modal-dialog.md` — Modal with swipe-to-dismiss
