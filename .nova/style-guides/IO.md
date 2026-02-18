# IO Style Guide - Performance & Optimization

> Standards for performance budgets, bundle analysis, and loading patterns

---

## Performance Budget Thresholds

### Global Budgets

| Metric | Target | Warning | Failure |
|--------|--------|---------|---------|
| **First Contentful Paint (FCP)** | < 1.0s | 1.0s - 1.8s | > 1.8s |
| **Largest Contentful Paint (LCP)** | < 2.0s | 2.0s - 2.5s | > 2.5s |
| **First Input Delay (FID)** | < 50ms | 50ms - 100ms | > 100ms |
| **Interaction to Next Paint (INP)** | < 200ms | 200ms - 500ms | > 500ms |
| **Cumulative Layout Shift (CLS)** | < 0.05 | 0.05 - 0.1 | > 0.1 |
| **Time to First Byte (TTFB)** | < 200ms | 200ms - 600ms | > 600ms |

### Bundle Size Budgets

| Resource | Target | Warning | Failure |
|----------|--------|---------|---------|
| **Total JavaScript** | < 200KB | 200KB - 350KB | > 350KB |
| **Initial JS (gzip)** | < 100KB | 100KB - 170KB | > 170KB |
| **Total CSS** | < 50KB | 50KB - 80KB | > 80KB |
| **Images (total)** | < 500KB | 500KB - 1MB | > 1MB |
| **Fonts** | < 100KB | 100KB - 200KB | > 200KB |
| **Third-party JS** | < 100KB | 100KB - 150KB | > 150KB |

### Runtime Budgets

| Metric | Target | Warning | Failure |
|--------|--------|---------|---------|
| **Total Blocking Time** | < 150ms | 150ms - 300ms | > 300ms |
| **DOM Nodes** | < 800 | 800 - 1400 | > 1400 |
| **Script Duration** | < 100ms | 100ms - 200ms | > 200ms |
| **Memory Usage** | < 100MB | 100MB - 200MB | > 200MB |

---

## Bundle Analysis Patterns

### Analysis Configuration

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          "vendor-react": ["react", "react-dom"],
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-dropdown"],
          "vendor-utils": ["lodash-es", "date-fns"],
        },
      },
    },
    // Chunk size warnings
    chunkSizeWarningLimit: 100, // KB
  },
  plugins: [
    visualizer({
      filename: "dist/stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
});
```

### Bundle Analysis Script

```typescript
// scripts/analyze-bundle.ts

import { readFileSync } from "fs";
import path from "path";

interface ChunkAnalysis {
  name: string;
  size: number;
  gzipSize: number;
  modules: string[];
}

interface BudgetCheck {
  metric: string;
  actual: number;
  budget: number;
  status: "pass" | "warn" | "fail";
}

const BUDGETS = {
  totalJs: 350 * 1024,      // 350KB
  initialJs: 170 * 1024,    // 170KB
  vendorJs: 150 * 1024,     // 150KB
  css: 80 * 1024,           // 80KB
};

function analyzeBundle(): void {
  const manifestPath = path.join(process.cwd(), "dist", "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

  const checks: BudgetCheck[] = [];

  // Calculate total JS
  const jsFiles = Object.values(manifest).filter((f: unknown) => 
    (f as { file: string }).file.endsWith(".js")
  );
  const totalJsSize = jsFiles.reduce((sum: number, f: unknown) => 
    sum + (f as { size: number }).size, 0
  );

  checks.push({
    metric: "Total JavaScript",
    actual: totalJsSize,
    budget: BUDGETS.totalJs,
    status: getStatus(totalJsSize, BUDGETS.totalJs),
  });

  // Output report
  console.log("\n📦 Bundle Analysis Report\n");
  console.log("-".repeat(60));

  checks.forEach((check) => {
    const icon = check.status === "pass" ? "✅" : check.status === "warn" ? "⚠️" : "❌";
    const size = formatBytes(check.actual);
    const budget = formatBytes(check.budget);
    console.log(`${icon} ${check.metric}: ${size} / ${budget}`);
  });

  // Exit with error if any failures
  const failures = checks.filter((c) => c.status === "fail");
  if (failures.length > 0) {
    console.error("\n❌ Bundle budget exceeded!");
    process.exit(1);
  }
}

function getStatus(actual: number, budget: number): "pass" | "warn" | "fail" {
  const ratio = actual / budget;
  if (ratio > 1) return "fail";
  if (ratio > 0.8) return "warn";
  return "pass";
}

function formatBytes(bytes: number): string {
  const kb = bytes / 1024;
  return `${kb.toFixed(1)}KB`;
}

analyzeBundle();
```

### Bundle Report Template

```markdown
# Bundle Analysis Report

**Generated:** [timestamp]
**Commit:** [hash]
**Branch:** [branch]

## Summary

| Metric | Size | Budget | Status |
|--------|------|--------|--------|
| Total JS | 280KB | 350KB | ✅ Pass |
| Initial JS | 120KB | 170KB | ✅ Pass |
| CSS | 45KB | 80KB | ✅ Pass |
| Images | 420KB | 500KB | ✅ Pass |

## Chunk Breakdown

| Chunk | Size (gz) | % of Total |
|-------|-----------|------------|
| index | 85KB | 30% |
| vendor-react | 45KB | 16% |
| vendor-ui | 38KB | 14% |
| [feature] | 25KB | 9% |

## Largest Dependencies

| Package | Size | Impact |
|---------|------|--------|
| [package] | 45KB | High |
| [package] | 32KB | Medium |

## Recommendations

1. [Specific recommendation with estimated savings]
2. [Another recommendation]

## Visual Report
- Interactive: `dist/stats.html`
- Screenshot: `docs/bundle-[date].png`
```

---

## Lazy Loading Patterns

### Route-Based Code Splitting

```typescript
// router.tsx
import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { PageLoader } from "@/components/PageLoader";

// Lazy load routes
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings = lazy(() => import("./pages/Settings"));
const Analytics = lazy(() => import("./pages/Analytics"));

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<PageLoader />}>
            <Dashboard />
          </Suspense>
        ),
      },
      {
        path: "settings",
        element: (
          <Suspense fallback={<PageLoader />}>
            <Settings />
          </Suspense>
        ),
      },
      {
        path: "analytics",
        element: (
          <Suspense fallback={<PageLoader />}>
            <Analytics />
          </Suspense>
        ),
      },
    ],
  },
]);
```

### Component-Level Lazy Loading

```typescript
// components/HeavyChart.tsx
import { lazy, Suspense, useState } from "react";

const Chart = lazy(() => import("./Chart"));

export function LazyChart({ data }: { data: DataPoint[] }) {
  const [loadChart, setLoadChart] = useState(false);

  // Load when user interacts or after initial paint
  useEffect(() => {
    const timer = setTimeout(() => setLoadChart(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!loadChart) {
    return <ChartSkeleton />;
  }

  return (
    <Suspense fallback={<ChartSkeleton />}>
      <Chart data={data} />
    </Suspense>
  );
}
```

### Intersection Observer Pattern

```typescript
// hooks/useLazyLoad.ts

import { useEffect, useRef, useState } from "react";

interface UseLazyLoadOptions {
  rootMargin?: string;
  threshold?: number;
  triggerOnce?: boolean;
}

export function useLazyLoad<T extends HTMLElement>(
  options: UseLazyLoadOptions = {}
): [React.RefObject<T>, boolean] {
  const { rootMargin = "100px", threshold = 0, triggerOnce = true } = options;
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce) {
            observer.unobserve(element);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin, threshold, triggerOnce]);

  return [ref, isVisible];
}

// Usage
function ImageGallery({ images }: { images: Image[] }) {
  return (
    <div className="grid">
      {images.map((img) => (
        <LazyImage key={img.id} src={img.src} alt={img.alt} />
      ))}
    </div>
  );
}

function LazyImage({ src, alt }: { src: string; alt: string }) {
  const [ref, isVisible] = useLazyLoad<HTMLDivElement>({
    rootMargin: "200px", // Start loading 200px before visible
  });

  return (
    <div ref={ref} className="aspect-video">
      {isVisible ? (
        <img src={src} alt={alt} loading="lazy" />
      ) : (
        <div className="bg-muted animate-pulse" />
      )}
    </div>
  );
}
```

### Prefetching Pattern

```typescript
// hooks/usePrefetch.ts

import { useCallback } from "react";

export function usePrefetch() {
  const prefetchRoute = useCallback((route: string) => {
    // Prefetch route component
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = route;
    document.head.appendChild(link);
  }, []);

  const prefetchComponent = useCallback(<T,>(
    importFn: () => Promise<T>
  ) => {
    // Prefetch dynamic import
    requestIdleCallback(() => {
      importFn();
    });
  }, []);

  return { prefetchRoute, prefetchComponent };
}

// Usage in navigation
function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const { prefetchRoute } = usePrefetch();

  return (
    <Link
      to={to}
      onMouseEnter={() => prefetchRoute(to)}
      onFocus={() => prefetchRoute(to)}
    >
      {children}
    </Link>
  );
}
```

---

## Web Vitals Targets

### Core Web Vitals Configuration

```typescript
// lib/webVitals.ts

import { onCLS, onFID, onFCP, onLCP, onTTFB, onINP } from "web-vitals";

interface WebVitalsMetrics {
  cls: number;
  fid: number;
  fcp: number;
  lcp: number;
  ttfb: number;
  inp: number;
}

const TARGETS = {
  cls: 0.05,
  fid: 50,
  fcp: 1000,
  lcp: 2000,
  ttfb: 200,
  inp: 200,
};

const WARNINGS = {
  cls: 0.1,
  fid: 100,
  fcp: 1800,
  lcp: 2500,
  ttfb: 600,
  inp: 500,
};

export function initWebVitals(): void {
  const metrics: Partial<WebVitalsMetrics> = {};

  onCLS((metric) => {
    metrics.cls = metric.value;
    reportMetric("CLS", metric.value, TARGETS.cls, WARNINGS.cls);
  });

  onFID((metric) => {
    metrics.fid = metric.value;
    reportMetric("FID", metric.value, TARGETS.fid, WARNINGS.fid);
  });

  onFCP((metric) => {
    metrics.fcp = metric.value;
    reportMetric("FCP", metric.value, TARGETS.fcp, WARNINGS.fcp);
  });

  onLCP((metric) => {
    metrics.lcp = metric.value;
    reportMetric("LCP", metric.value, TARGETS.lcp, WARNINGS.lcp);
  });

  onTTFB((metric) => {
    metrics.ttfb = metric.value;
    reportMetric("TTFB", metric.value, TARGETS.ttfb, WARNINGS.ttfb);
  });

  onINP((metric) => {
    metrics.inp = metric.value;
    reportMetric("INP", metric.value, TARGETS.inp, WARNINGS.inp);
  });
}

function reportMetric(
  name: string,
  value: number,
  target: number,
  warning: number
): void {
  const status = value <= target ? "good" : value <= warning ? "needs-improvement" : "poor";
  
  // Send to analytics
  if (typeof gtag !== "undefined") {
    gtag("event", "web_vitals", {
      event_category: "Web Vitals",
      event_label: name,
      value: Math.round(value),
      custom_parameter_1: status,
    });
  }

  // Console logging in development
  if (import.meta.env.DEV) {
    const emoji = status === "good" ? "✅" : status === "needs-improvement" ? "⚠️" : "❌";
    console.log(`${emoji} ${name}: ${value.toFixed(2)}`);
  }
}
```

### Performance Observer Pattern

```typescript
// hooks/usePerformanceObserver.ts

import { useEffect } from "react";

type PerformanceEntryType = 
  | "resource"
  | "navigation"
  | "paint"
  | "measure"
  | "mark";

export function usePerformanceObserver(
  type: PerformanceEntryType,
  callback: (entries: PerformanceEntryList) => void
): void {
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;

    const observer = new PerformanceObserver((list) => {
      callback(list.getEntries());
    });

    observer.observe({ entryTypes: [type] });
    return () => observer.disconnect();
  }, [type, callback]);
}

// Usage - Track slow resources
function useSlowResourceWarning(threshold = 1000) {
  usePerformanceObserver("resource", (entries) => {
    entries.forEach((entry) => {
      if (entry.duration > threshold) {
        console.warn(`Slow resource: ${entry.name} (${entry.duration.toFixed(0)}ms)`);
      }
    });
  });
}
```

---

## Quality Checklist (25+ items)

### Performance Budgets (5)
- [ ] All metrics have defined thresholds
- [ ] Bundle size budgets configured
- [ ] CI integration for budget enforcement
- [ ] Alerting for budget violations
- [ ] Historical tracking in place

### Bundle Analysis (5)
- [ ] Build-time analysis script
- [ ] Visual reports generated
- [ ] Large dependencies identified
- [ ] Chunk splitting optimized
- [ ] Tree-shaking verified

### Lazy Loading (5)
- [ ] Route-based code splitting
- [ ] Component-level lazy loading
- [ ] Intersection Observer for images
- [ ] Prefetching on hover/focus
- [ ] Loading states implemented

### Web Vitals (5)
- [ ] All 6 metrics tracked
- [ ] Analytics integration
- [ ] Real User Monitoring (RUM)
- [ ] Lab tests (Lighthouse)
- [ ] Performance regression tests

### Optimization (5)
- [ ] Images optimized (WebP/AVIF)
- [ ] Fonts subsetted
- [ ] Critical CSS inlined
- [ ] Compression enabled
- [ ] CDN configured

---

## Self-Check Before Responding

- [ ] Performance budgets defined for all metrics
- [ ] Bundle analysis shows all chunks
- [ ] Lazy loading uses Suspense boundaries
- [ ] Web Vitals tracked with attribution
- [ ] Prefetching doesn't impact initial load
- [ ] Images have proper loading attributes
- [ ] Third-party scripts deferred/async
- [ ] Font loading optimized

---

## Output Format Template

```markdown
## Performance Analysis: [Area]

### Current Metrics
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| [Name] | [Value] | [Target] | [Icon] |

### Bundle Impact
- **Size:** [KB]
- **Chunks Affected:** [List]
- **Load Time Impact:** [ms]

### Recommendations
1. [Recommendation with estimated savings]
2. [Another recommendation]

### Implementation
\`\`\`typescript
[Code example]
\`\`\`

### Verification
- [ ] Metric improvement measured
- [ ] No regression in other metrics
- [ ] Budget compliance maintained
```
