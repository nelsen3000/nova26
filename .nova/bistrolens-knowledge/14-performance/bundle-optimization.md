# Bundle Optimization Patterns

## Source
Extracted from BistroLens `vite.config.ts`, `utils/bundleOptimizer.ts`, `utils/performanceOptimizer.ts`

---

## Pattern: Vite Build Configuration + Runtime Bundle Analysis

BistroLens uses Vite with a minimal but effective build config: chunk size warnings at 500KB, build metadata injection for deployment verification, and a runtime `BundleOptimizer` class that analyzes loaded assets and generates optimization recommendations.

---

## Vite Configuration

### Code Example

```typescript
// vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env vars based on mode (development/production/staging)
  const env = loadEnv(mode, process.cwd(), '');

  // Inject build metadata for deployment verification
  const buildSha = process.env.VERCEL_GIT_COMMIT_SHA ||
                   process.env.GITHUB_SHA ||
                   process.env.CF_PAGES_COMMIT_SHA ||
                   'local-dev';
  const buildTime = new Date().toISOString();

  return {
    plugins: [react()],
    define: {
      // Available as global constants in the app
      '__BUILD_SHA__': JSON.stringify(buildSha),
      '__BUILD_TIME__': JSON.stringify(buildTime),
      '__BUILD_SHA_SHORT__': JSON.stringify(buildSha.substring(0, 7)),
    },
    build: {
      // Warn when any chunk exceeds 500KB (default is 500KB)
      // Chunks larger than this should be split further
      chunkSizeWarningLimit: 500,
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      proxy: {
        // Proxy /api calls to Vercel dev server during local development
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
```

---

## Build Metadata Usage

### Code Example

```typescript
// utils/buildInfo.ts — access injected build constants
declare const __BUILD_SHA__: string;
declare const __BUILD_TIME__: string;
declare const __BUILD_SHA_SHORT__: string;

export const getBuildInfo = () => ({
  sha: __BUILD_SHA__,
  shaShort: __BUILD_SHA_SHORT__,
  time: __BUILD_TIME__,
  isLocalDev: __BUILD_SHA__ === 'local-dev',
});

// Usage in deployment verification
const { sha, time } = getBuildInfo();
console.log(`Running build ${sha} deployed at ${time}`);
```

---

## Runtime Bundle Analyzer

### Code Example

```typescript
// utils/bundleOptimizer.ts
interface AssetInfo {
  name: string;
  size: number;
  type: 'js' | 'css' | 'image' | 'font' | 'other';
  critical: boolean;
  loadTime?: number;
}

class BundleOptimizer {
  private assets: AssetInfo[] = [];
  private criticalResources = new Set(['main.js', 'main.css', 'vendor.js', 'polyfills.js']);

  // Analyze what's actually been loaded
  async analyzeBundleComposition(): Promise<OptimizationReport> {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

    this.assets = resources.map(resource => ({
      name: resource.name.split('/').pop()?.split('?')[0] || resource.name,
      size: resource.transferSize || resource.decodedBodySize || 0,
      type: this.getAssetType(resource.name),
      critical: this.isCriticalResource(resource.name),
      loadTime: resource.responseEnd - resource.requestStart,
    }));

    const totalSize = this.assets.reduce((sum, a) => sum + a.size, 0);
    const criticalSize = this.assets.filter(a => a.critical).reduce((sum, a) => sum + a.size, 0);

    return {
      totalSize,
      criticalSize,
      nonCriticalSize: totalSize - criticalSize,
      recommendations: this.generateRecommendations(),
      assets: this.assets,
      performance: await this.getPerformanceMetrics(),
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const totalSize = this.assets.reduce((sum, a) => sum + a.size, 0);
    const jsSize = this.assets.filter(a => a.type === 'js').reduce((sum, a) => sum + a.size, 0);
    const imageSize = this.assets.filter(a => a.type === 'image').reduce((sum, a) => sum + a.size, 0);

    if (totalSize > 2 * 1024 * 1024) recommendations.push('Total bundle >2MB. Consider code splitting.');
    if (jsSize > 1 * 1024 * 1024) recommendations.push('JS bundle >1MB. Implement dynamic imports.');
    if (imageSize > 1 * 1024 * 1024) recommendations.push('Images >1MB. Use lazy loading and WebP.');

    const largeAssets = this.assets.filter(a => a.size > 100 * 1024);
    if (largeAssets.length > 0) {
      recommendations.push(`${largeAssets.length} assets >100KB. Consider compression or splitting.`);
    }

    const slowAssets = this.assets.filter(a => (a.loadTime || 0) > 1000);
    if (slowAssets.length > 0) {
      recommendations.push(`${slowAssets.length} assets take >1s to load. Check CDN and compression.`);
    }

    return recommendations;
  }

  // Optimize loading order: preload critical, prefetch non-critical
  optimizeLoadingOrder(): void {
    this.preloadCriticalResources();
    this.prefetchNonCriticalResources();
    this.setupLazyLoading();
  }

  private preloadCriticalResources(): void {
    this.assets.filter(a => a.critical).forEach(asset => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = asset.name;
      link.as = asset.type === 'js' ? 'script' : asset.type === 'css' ? 'style' : 'image';
      document.head.appendChild(link);
    });
  }

  private prefetchNonCriticalResources(): void {
    requestIdleCallback(() => {
      this.assets.filter(a => !a.critical).forEach(asset => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = asset.name;
        document.head.appendChild(link);
      });
    });
  }

  private setupLazyLoading(): void {
    const images = document.querySelectorAll('img[data-src]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          img.src = img.dataset.src!;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      });
    });
    images.forEach(img => observer.observe(img));
  }
}

export const bundleOptimizer = new BundleOptimizer();
```

---

## Performance Metrics Collection

### Code Example

```typescript
// utils/performanceOptimizer.ts
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.setupObservers();
  }

  private setupObservers() {
    if (typeof window === 'undefined') return;

    try {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.recordMetric('LCP', lastEntry.startTime);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          this.recordMetric('FID', entry.processingStart - entry.startTime);
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);

      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            this.recordMetric('CLS', entry.value);
          }
        });
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);
    } catch (error) {
      console.warn('Performance observers not supported:', error);
    }
  }

  recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) this.metrics.set(name, []);
    this.metrics.get(name)!.push(value);
  }

  getMetrics() {
    const result: Record<string, { avg: number; min: number; max: number; count: number }> = {};
    for (const [name, values] of this.metrics.entries()) {
      if (values.length > 0) {
        result[name] = {
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length,
        };
      }
    }
    return result;
  }

  async getWebVitals() {
    const vitals: Record<string, number> = {};
    const metrics = this.getMetrics();

    if (metrics.LCP) vitals.LCP = metrics.LCP.avg;
    if (metrics.FID) vitals.FID = metrics.FID.avg;
    if (metrics.CLS) vitals.CLS = metrics.CLS.avg;

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) vitals.TTFB = navigation.responseStart - navigation.requestStart;

    const fcpEntry = performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint');
    if (fcpEntry) vitals.FCP = fcpEntry.startTime;

    return vitals;
  }

  cleanup() {
    this.observers.forEach(o => o.disconnect());
    this.observers = [];
    this.metrics.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();
```

---

## Resource Hints

### Code Example

```typescript
// utils/performanceOptimizer.ts
export const addResourceHints = (urls: string[], type: 'preload' | 'prefetch' | 'preconnect') => {
  if (typeof document === 'undefined') return;

  urls.forEach(url => {
    const link = document.createElement('link');
    link.rel = type;
    link.href = url;

    if (type === 'preload') {
      if (url.match(/\.(js|mjs)$/)) link.as = 'script';
      else if (url.match(/\.css$/)) link.as = 'style';
      else if (url.match(/\.(woff2?|ttf|otf)$/)) { link.as = 'font'; link.crossOrigin = 'anonymous'; }
      else if (url.match(/\.(jpg|jpeg|png|webp|svg)$/)) link.as = 'image';
    }

    document.head.appendChild(link);
  });
};

// Called once on app start
export const loadCriticalResources = () => {
  // Preconnect to external domains to reduce DNS + TLS handshake time
  addResourceHints([
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://generativelanguage.googleapis.com',
  ], 'preconnect');

  // Preload critical fonts
  addResourceHints([
    'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2',
  ], 'preload');
};
```

---

## Bundle Size Utilities

### Code Example

```typescript
// utils/bundleOptimizer.ts
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const measureBundleImpact = (before: number, after: number) => {
  const reduction = before - after;
  const percentage = (reduction / before) * 100;
  return {
    reduction,
    percentage,
    impact: percentage > 20 ? 'high' : percentage > 10 ? 'medium' : 'low',
  };
};
```

---

## App Startup Integration

### Code Example

```typescript
// App.tsx — initialize bundle optimizer on mount
import { bundleOptimizer } from './utils/bundleOptimizer';
import { performanceMonitoringService } from './services/performanceMonitoringService';

useEffect(() => {
  // Mark app start for performance measurement
  performanceMonitoringService.mark('app_start');

  // Optimize asset loading order (preload critical, prefetch non-critical)
  bundleOptimizer.optimizeLoadingOrder();
}, []);
```

---

## Anti-Patterns

### ❌ Don't Do This — No chunk size limits

```typescript
// Bad: no warning when chunks get too large
export default defineConfig({
  plugins: [react()],
  // Missing: build.chunkSizeWarningLimit
});
```

### ✅ Do This Instead

```typescript
// Good: warn at 500KB so you catch bloat early
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 500 },
});
```

---

### ❌ Don't Do This — Hardcoded env vars in config

```typescript
// Bad: env vars not available at build time
const apiKey = 'hardcoded-key';
```

### ✅ Do This Instead

```typescript
// Good: use loadEnv to access .env files per mode
const env = loadEnv(mode, process.cwd(), '');
// Access as env.VITE_API_KEY
```

---

## When to Use This Pattern

✅ **Use for:**
- Any Vite-based React app
- Tracking deployment versions in production
- Identifying bundle bloat before it ships

❌ **Don't use for:**
- Next.js apps (use next.config.js instead)
- Apps where bundle analysis is done only in CI (still useful, but runtime analysis adds value)

---

## Benefits

1. `chunkSizeWarningLimit` catches bundle bloat during development
2. Build metadata injection enables deployment verification without extra tooling
3. Runtime bundle analyzer identifies slow/large assets in production
4. Web Vitals collection provides real-user performance data

---

## Related Patterns

- See `code-splitting.md` for lazy loading to reduce chunk sizes
- See `image-optimization.md` for reducing image asset sizes
- See `render-optimization.md` for reducing JS execution time

---

*Extracted: 2026-02-18*
