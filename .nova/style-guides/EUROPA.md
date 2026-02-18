# EUROPA Style Guide - Mobile & PWA Patterns

> Standards for responsive design, PWA configuration, and mobile patterns

**CRITICAL: EUROPA provides patterns and configs; VENUS implements the actual components.**

---

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| PWA patterns | `pwa/[name]-pattern.ts` | `pwa/sw-pattern.ts` |
| Responsive patterns | `responsive-[feature]-patterns.md` | `responsive-table-patterns.md` |
| Touch patterns | `touch-[gesture]-pattern.ts` | `touch-swipe-pattern.ts` |
| Breakpoint configs | `breakpoints.ts` | `mobile-breakpoints.ts` |
| Manifest specs | `manifest-spec.json` | `pwa-manifest-spec.json` |

---

## What EUROPA Provides vs VENUS Implements

| EUROPA (Patterns) | VENUS (Implementation) |
|-------------------|------------------------|
| Service worker pattern | `sw.ts` implementation |
| Manifest specification | `manifest.json` file |
| Tailwind responsive patterns | Component CSS classes |
| Touch handler patterns | Event handler code |
| Offline strategy pattern | Cache implementation |

---

## PWA Manifest Specification Pattern

```json
{
  "name": "App Name",
  "short_name": "ShortName",
  "description": "App description",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192" },
    { "src": "/icon-512.png", "sizes": "512x512" }
  ]
}
```

---

## Service Worker Pattern (for VENUS to implement)

```typescript
// EUROPA provides this pattern, VENUS implements in sw.ts

/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = "app-v1";
const STATIC_ASSETS: string[] = [
  "/",
  "/index.html",
  "/manifest.json",
];

// Pattern: Cache on install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Pattern: Clean old caches on activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});
```

---

## Responsive Tailwind Patterns

### Mobile-First Pattern (for VENUS)

```markdown
## Responsive Card Pattern for VENUS

Base (mobile): `w-full px-4 py-6`
Tablet (md): `md:px-6 md:py-8`  
Desktop (lg): `lg:max-w-4xl lg:mx-auto`

Touch target: `min-h-[44px] min-w-[44px]`
```

### Breakpoint Specification

```typescript
export const BREAKPOINTS = {
  sm: 640,   // Small devices
  md: 768,   // Tablets
  lg: 1024,  // Desktop
  xl: 1280,  // Large desktop
} as const;

export const TOUCH_TARGET = {
  minWidth: 44,  // px
  minHeight: 44, // px
  minSpacing: 8, // px between targets
} as const;
```

---

## Touch Event Handler Pattern

```typescript
// Pattern for VENUS to implement

interface TouchPosition {
  x: number;
  y: number;
  timestamp: number;
}

interface TouchState {
  start: TouchPosition | null;
  current: TouchPosition | null;
  isDragging: boolean;
}

// Pattern: Swipe detection
export function createSwipePattern(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold: number = 50
) {
  return {
    onTouchStart: (e: React.TouchEvent) => { /* pattern */ },
    onTouchMove: (e: React.TouchEvent) => { /* pattern */ },
    onTouchEnd: () => { /* pattern */ },
  };
}
```

---

## Quality Checklist (25+ items)

### PWA Requirements (5)
- [ ] Manifest specification complete
- [ ] Service worker pattern provided
- [ ] Offline strategy documented
- [ ] A2HS (Add to Home Screen) guidance
- [ ] Icons specification (192px, 512px)

### Responsive Design (5)
- [ ] Breakpoints documented (sm, md, lg, xl)
- [ ] Mobile-first approach specified
- [ ] Touch targets minimum 44px
- [ ] Responsive image guidelines
- [ ] Viewport configuration

### Touch Interactions (5)
- [ ] 44px touch target minimum
- [ ] Swipe gesture patterns
- [ ] Touch feedback patterns
- [ ] Prevent zoom on inputs
- [ ] Pull-to-refresh guidance

### Mobile Performance (5)
- [ ] FCP target < 1.8s
- [ ] TTI target < 3.8s
- [ ] Code-splitting guidance
- [ ] Lazy loading patterns
- [ ] 60fps animation targets

### Accessibility on Mobile (8)
- [ ] Screen reader considerations
- [ ] Focus management on mobile
- [ ] Color contrast (WCAG AA)
- [ ] Reduced motion support
- [ ] Motor impairment considerations
- [ ] Form labels always visible
- [ ] Modal focus trapping
- [ ] Skip link patterns

---

## Self-Check Before Responding

- [ ] No full React components (only patterns/specs)
- [ ] No `any` types used
- [ ] PWA manifest specification complete
- [ ] Service worker pattern handles offline
- [ ] Touch targets minimum 44px documented
- [ ] Responsive breakpoints defined
- [ ] Mobile-first approach documented
- [ ] VENUS handoff clearly documented

---

## Output Format Template

```markdown
## Mobile Pattern: [Feature Name]

### Breakpoints
- Mobile (base): [classes]
- Tablet (md:): [classes]
- Desktop (lg:): [classes]

### Touch Targets
Minimum: 44x44px

### Implementation Notes for VENUS
1. [Step 1]
2. [Step 2]

### Code Pattern
\`\`\`typescript
[pattern code]
\`\`\`
```
