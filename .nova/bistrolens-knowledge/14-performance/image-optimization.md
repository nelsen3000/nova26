# Image Optimization Patterns

## Source
Extracted from BistroLens `utils/imageOptimizer.ts`, `hooks/useImagePrefetch.ts`, `components/BentoRecipeLibrary.tsx`

---

## Pattern: Lazy Loading + Prefetching + WebP Conversion

BistroLens uses a multi-layered image strategy:
1. **Lazy loading** via IntersectionObserver — images load only when near the viewport
2. **Prefetching** via `useImagePrefetch` — hero images are pre-warmed before the user opens a recipe
3. **Client-side compression** — uploaded images are compressed and optionally converted to WebP
4. **Retry logic** — failed image loads retry up to 3 times before showing a fallback

---

## Core Image Optimizer Class

### Code Example

```typescript
// utils/imageOptimizer.ts
class ImageOptimizer {
  private observer: IntersectionObserver | null = null;
  private imageCache = new Map<string, HTMLImageElement>();
  private loadingImages = new Set<string>();

  constructor() {
    this.setupIntersectionObserver();
  }

  private setupIntersectionObserver(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            this.loadImage(img);
            this.observer?.unobserve(img); // Stop observing once loaded
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '50px', // Start loading 50px before entering viewport
      }
    );
  }

  // Create a lazy-loading image element
  createLazyImage(src: string, alt: string = '', options: LazyImageOptions = {}): HTMLImageElement {
    const { placeholder = 'blur', placeholderColor = '#f3f4f6', fadeIn = true, retries = 3 } = options;

    const img = document.createElement('img');
    img.alt = alt;
    img.dataset.src = src;
    img.dataset.retries = retries.toString();

    // Apply placeholder style while loading
    if (placeholder === 'blur') {
      img.style.filter = 'blur(10px)';
      img.style.backgroundColor = placeholderColor;
    } else if (placeholder === 'color') {
      img.style.backgroundColor = placeholderColor;
    } else {
      img.classList.add('skeleton-placeholder');
    }

    if (fadeIn) img.classList.add('lazy-fade');

    // Observe for lazy loading
    if (this.observer) {
      this.observer.observe(img);
    } else {
      this.loadImage(img); // Fallback for unsupported browsers
    }

    return img;
  }

  private async loadImage(img: HTMLImageElement): Promise<void> {
    const src = img.dataset.src;
    if (!src || this.loadingImages.has(src)) return;

    this.loadingImages.add(src);
    const retries = parseInt(img.dataset.retries || '3');

    try {
      await this.loadImageWithRetry(img, src, retries);
      // Remove placeholder effects on success
      img.style.filter = '';
      img.style.backgroundColor = '';
      img.classList.remove('skeleton-placeholder');
      img.classList.add('lazy-loaded');
      delete img.dataset.src;
    } catch (error) {
      console.error('Image failed to load:', error);
      img.src = this.generateFallbackImage(img.alt);
      img.classList.add('lazy-error');
    } finally {
      this.loadingImages.delete(src);
    }
  }

  private loadImageWithRetry(img: HTMLImageElement, src: string, retries: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const attemptLoad = (attempt: number) => {
        const tempImg = new Image();
        tempImg.onload = () => {
          img.src = src;
          resolve();
        };
        tempImg.onerror = () => {
          if (attempt < retries) {
            console.warn(`Image load failed, retrying... (${attempt + 1}/${retries})`);
            setTimeout(() => attemptLoad(attempt + 1), 1000 * attempt);
          } else {
            reject(new Error(`Failed to load image after ${retries} attempts`));
          }
        };
        tempImg.src = src;
      };
      attemptLoad(0);
    });
  }

  private generateFallbackImage(alt: string): string {
    const svg = `
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#9ca3af" font-family="Arial, sans-serif" font-size="14">
          ${alt || 'Image not available'}
        </text>
      </svg>
    `;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }
}

export const imageOptimizer = new ImageOptimizer();
```

---

## Image Prefetch Hook

Pre-warm images before the user navigates to them, using `requestIdleCallback` to avoid blocking the main thread.

### Code Example

```typescript
// hooks/useImagePrefetch.ts
import { useEffect, useRef } from 'react';

interface PrefetchOptions {
  maxImagesPerRecipe?: number; // Default: 4 (hero + first 3 steps)
  timeout?: number;            // Default: 5000ms
  useIdleCallback?: boolean;   // Default: true
}

function prefetchImage(src: string, timeout: number = 5000): Promise<void> {
  return new Promise((resolve) => {
    if (!src || !src.startsWith('http')) {
      resolve(); // Skip invalid URLs silently
      return;
    }

    const img = new Image();
    let timeoutId: ReturnType<typeof setTimeout>;

    img.onload = () => { clearTimeout(timeoutId); resolve(); };
    img.onerror = () => { clearTimeout(timeoutId); resolve(); }; // Silently fail
    img.crossOrigin = 'anonymous';
    img.src = src;

    timeoutId = setTimeout(() => resolve(), timeout); // Timeout = silent fail
  });
}

export function useImagePrefetch(imageUrls: string[], options: PrefetchOptions = {}): void {
  const { maxImagesPerRecipe = 4, timeout = 5000, useIdleCallback = true } = options;
  const prefetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!imageUrls || imageUrls.length === 0) return;

    const urlsToPrefetch = imageUrls
      .filter(url => url && url.startsWith('http'))
      .filter(url => !prefetchedRef.current.has(url)) // Skip already prefetched
      .slice(0, maxImagesPerRecipe);

    if (urlsToPrefetch.length === 0) return;

    const doPrefetch = async () => {
      await Promise.allSettled(
        urlsToPrefetch.map(url => {
          prefetchedRef.current.add(url);
          return prefetchImage(url, timeout);
        })
      );
    };

    // Use requestIdleCallback to avoid blocking the main thread
    if (useIdleCallback && 'requestIdleCallback' in window) {
      requestIdleCallback(() => doPrefetch(), { timeout: 2000 });
    } else {
      setTimeout(doPrefetch, 100); // Fallback
    }
  }, [imageUrls, maxImagesPerRecipe, timeout, useIdleCallback]);
}
```

---

## Recipe Image Prefetch (Priority Order)

### Code Example

```typescript
// hooks/useImagePrefetch.ts
export function useRecipeImagePrefetch(
  heroImageUrl: string | undefined,
  stepImageUrls: string[] = [],
  options: PrefetchOptions = {}
): void {
  const { maxImagesPerRecipe = 4, timeout = 5000, useIdleCallback = true } = options;
  const prefetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const doPrefetch = async () => {
      // Priority 1: Hero image (blocks recipe display)
      if (heroImageUrl && heroImageUrl.startsWith('http') && !prefetchedRef.current.has(heroImageUrl)) {
        prefetchedRef.current.add(heroImageUrl);
        await prefetchImage(heroImageUrl, timeout);
      }

      // Priority 2: First N step images
      const maxSteps = Math.max(0, maxImagesPerRecipe - 1);
      const stepsToFetch = stepImageUrls
        .filter(url => url && url.startsWith('http'))
        .filter(url => !prefetchedRef.current.has(url))
        .slice(0, maxSteps);

      await Promise.allSettled(
        stepsToFetch.map(url => {
          prefetchedRef.current.add(url);
          return prefetchImage(url, timeout);
        })
      );
    };

    if (useIdleCallback && 'requestIdleCallback' in window) {
      requestIdleCallback(() => doPrefetch(), { timeout: 2000 });
    } else {
      setTimeout(doPrefetch, 100);
    }
  }, [heroImageUrl, stepImageUrls, maxImagesPerRecipe, timeout, useIdleCallback]);
}
```

---

## Collecting URLs for Prefetch with useMemo

### Code Example

```typescript
// components/BentoRecipeLibrary.tsx
import { useMemo } from 'react';
import { useImagePrefetch } from '../hooks/useImagePrefetch';

const BentoRecipeLibrary: React.FC = () => {
  const bentoRecipes = useQuery(api.bentoDataset.getTopRecipes);

  // Collect hero image URLs — memoized to avoid re-running on unrelated renders
  const heroImageUrls = useMemo(() => {
    if (!bentoRecipes) return [];
    return bentoRecipes
      .map(r => r.imageUrl)
      .filter(Boolean) as string[];
  }, [bentoRecipes]);

  // Pre-warm images in the background
  useImagePrefetch(heroImageUrls, {
    maxImagesPerRecipe: 6,
    useIdleCallback: true,
  });

  return (
    <div>
      {bentoRecipes?.map(recipe => (
        <RecipeCard key={recipe._id} recipe={recipe} />
      ))}
    </div>
  );
};
```

---

## Client-Side Image Compression

### Code Example

```typescript
// utils/imageOptimizer.ts
async compressImage(
  imageFile: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number; format?: string } = {}
): Promise<Blob> {
  const { maxWidth = 1920, maxHeight = 1080, quality = 0.8, format = 'image/jpeg' } = options;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;

      // Scale down while maintaining aspect ratio
      if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
      if (height > maxHeight) { width = (width * maxHeight) / height; height = maxHeight; }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Compression failed')),
        format,
        quality
      );
    };

    img.onerror = reject;
    img.src = URL.createObjectURL(imageFile);
  });
}

// Convert to WebP for better compression
async convertToWebP(imageFile: File, quality: number = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('WebP conversion failed')),
        'image/webp',
        quality
      );
    };

    img.onerror = reject;
    img.src = URL.createObjectURL(imageFile);
  });
}
```

---

## Format Detection Utilities

### Code Example

```typescript
// utils/imageOptimizer.ts
export const isWebPSupported = (): boolean => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
};

export const isAVIFSupported = (): boolean => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
};

// Usage: choose best format at runtime
const format = isAVIFSupported() ? 'avif' : isWebPSupported() ? 'webp' : 'jpeg';
```

---

## Anti-Patterns

### ❌ Don't Do This — Eager loading all images

```typescript
// Bad: all images load immediately, blocking bandwidth for critical resources
<img src={recipe.imageUrl} alt={recipe.title} />
```

### ✅ Do This Instead

```typescript
// Good: lazy load with IntersectionObserver
<img
  data-src={recipe.imageUrl}
  alt={recipe.title}
  className="lazy-fade"
  ref={el => el && imageOptimizer.observe(el)}
/>
```

---

### ❌ Don't Do This — No fallback on image error

```typescript
// Bad: broken image icon shown to user
<img src={recipe.imageUrl} alt={recipe.title} />
```

### ✅ Do This Instead

```typescript
// Good: SVG placeholder fallback
<img
  src={recipe.imageUrl}
  alt={recipe.title}
  onError={(e) => {
    (e.target as HTMLImageElement).src = generateImagePlaceholder(400, 300);
  }}
/>
```

---

### ❌ Don't Do This — Prefetching on every render

```typescript
// Bad: re-prefetches on every render, wastes bandwidth
useEffect(() => {
  prefetchImages(imageUrls);
}); // No dependency array!
```

### ✅ Do This Instead

```typescript
// Good: track prefetched URLs, only fetch new ones
const prefetchedRef = useRef<Set<string>>(new Set());
// Filter out already-prefetched URLs before fetching
```

---

## When to Use This Pattern

✅ **Use for:**
- Recipe card grids with many images
- Step-by-step cooking views
- Any list/grid with user-uploaded images

❌ **Don't use for:**
- Hero images above the fold — load them eagerly
- Images that are always visible on first paint

---

## Benefits

1. Reduces initial page load time by deferring off-screen images
2. Prefetching eliminates perceived latency on common navigation paths
3. Retry logic handles flaky CDN connections gracefully
4. Client-side compression reduces upload sizes before they hit storage

---

## Related Patterns

- See `code-splitting.md` for lazy loading components
- See `render-optimization.md` for `useMemo` to collect image URLs
- See `bundle-optimization.md` for CDN and asset delivery

---

*Extracted: 2026-02-18*
