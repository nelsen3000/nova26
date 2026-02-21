# Build Process

## Source
Extracted from BistroLens `vite.config.ts`, `package.json`, `tsconfig.json`

---

## Pattern: Vite + React Build Pipeline

BistroLens uses Vite 5 as its build tool with React 19, TypeScript, and automatic environment variable injection. The build pipeline injects git commit metadata at build time for deployment traceability.

---

## npm Scripts

### Core Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "dev:vite": "vite --port 5173 --strictPort",
    "dev:api": "node scripts/api-server.mjs",
    "dev:all": "node scripts/dev.mjs",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "test:e2e": "playwright test"
  }
}
```

### Development Workflow

```bash
# Start Vite dev server only (port 5173)
npm run dev

# Start Vite + API server together
npm run dev:all

# Kill stuck ports before starting
npm run dev:killports

# Diagnose dev environment issues
npm run dev:doctor
```

### Build & Verify

```bash
# Production build → outputs to dist/
npm run build

# Preview production build locally
npm run preview

# Type check without emitting files
npm run type-check

# Lint with zero warnings tolerance
npm run lint
```

---

## Vite Configuration

### Full Config

```typescript
// vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load env file based on mode (development, production, staging)
  const env = loadEnv(mode, process.cwd(), '')
  
  // Build metadata — injected from CI environment variables
  const buildSha = process.env.VERCEL_GIT_COMMIT_SHA || 
                   process.env.GITHUB_SHA || 
                   process.env.CF_PAGES_COMMIT_SHA ||
                   'local-dev';
  const buildTime = new Date().toISOString();
  
  return {
    plugins: [react()],
    
    // Inject build metadata as global constants (accessible anywhere in app)
    define: {
      '__BUILD_SHA__': JSON.stringify(buildSha),
      '__BUILD_TIME__': JSON.stringify(buildTime),
      '__BUILD_SHA_SHORT__': JSON.stringify(buildSha.substring(0, 7)),
    },
    
    build: {
      // Warn when chunks exceed 500KB gzipped
      chunkSizeWarningLimit: 500,
    },
    
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      proxy: {
        // Proxy /api calls to local Vercel dev server
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
```

### Accessing Build Metadata in App

```typescript
// Declare globals for TypeScript
declare const __BUILD_SHA__: string;
declare const __BUILD_TIME__: string;
declare const __BUILD_SHA_SHORT__: string;

// Use in components (e.g., footer, debug panel)
function BuildInfo() {
  return (
    <span className="text-xs text-muted-foreground">
      v{__BUILD_SHA_SHORT__} · {new Date(__BUILD_TIME__).toLocaleDateString()}
    </span>
  );
}
```

---

## Environment Variables

### Variable Naming Convention

Vite automatically exposes variables prefixed with `VITE_` to the client bundle. Variables without this prefix are server-only.

```bash
# ✅ Client-accessible (bundled into JS)
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_STRIPE_PUBLIC_KEY=pk_live_...
VITE_SENTRY_DSN=https://...@sentry.io/...

# ✅ Server-only (NOT bundled, used in API routes)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RECAPTCHA_SECRET_KEY=...
ENCRYPTION_KEY=...
```

### Required Variables by Environment

```typescript
const REQUIRED_ENV_VARS = {
  all: [
    'VITE_CONVEX_URL',        // Convex backend URL
    'VITE_GOOGLE_AI_API_KEY', // Gemini AI
  ],
  staging: [
    'VITE_SENTRY_DSN',        // Error monitoring
    'VITE_STRIPE_PUBLIC_KEY', // Payments
  ],
  production: [
    'VITE_SENTRY_DSN',
    'VITE_STRIPE_PUBLIC_KEY',
    'VITE_RECAPTCHA_SITE_KEY', // Bot protection
  ],
};
```

### Full .env.example

```bash
# Convex (Required)
VITE_CONVEX_URL=https://your-deployment-name.convex.cloud

# OAuth (Required)
AUTH_GOOGLE_ID=your-google-oauth-client-id.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=your-google-oauth-client-secret
AUTH_GITHUB_ID=your-github-oauth-client-id
AUTH_GITHUB_SECRET=your-github-oauth-client-secret

# Gemini AI (Required)
VITE_GEMINI_API_KEY=AIzaSy...

# Sentry (Required for Production)
VITE_SENTRY_DSN=https://abc123@o123.ingest.sentry.io/456
VITE_APP_VERSION=1.0.0
SENTRY_AUTH_TOKEN=your-auth-token-here

# Stripe (Required for Subscriptions)
VITE_STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PRICE_PREMIUM_MONTHLY=price_xxx
VITE_STRIPE_PRICE_PREMIUM_ANNUAL=price_xxx

# reCAPTCHA (Required for Production)
VITE_RECAPTCHA_SITE_KEY=6LeIxAcT...
RECAPTCHA_SECRET_KEY=6LeIxAcT...

# Security
ENCRYPTION_KEY=your-64-character-hex-key
ADMIN_EMAILS=admin@bistrolens.com

# Optional
VITE_CDN_URL=https://cdn.bistrolens.com
HUGGINGFACE_API_KEY=hf_...
```

---

## TypeScript Configuration

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "noEmit": true,           // Vite handles emit, not tsc
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    
    // Relaxed for build velocity (tighten per project needs)
    "strict": false,
    "noImplicitAny": false,
    "strictNullChecks": false
  },
  "exclude": [
    "node_modules",
    "vite.config.ts",
    "api/**/*",
    "scripts/**/*",
    "convex/**/*"             // Convex has its own tsconfig
  ]
}
```

---

## Build Output

```
dist/
├── index.html              # Entry point (cache: must-revalidate)
├── assets/
│   ├── index-[hash].js     # Main bundle (chunked)
│   ├── vendor-[hash].js    # Third-party deps
│   └── index-[hash].css    # Styles
└── public/                 # Static assets (cache: 1 year immutable)
```

### Cache Strategy (via vercel.json)

```json
{
  "headers": [
    {
      "source": "/assets/:path*",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/index.html",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }]
    }
  ]
}
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Don't hardcode environment-specific values
const API_URL = 'https://production.convex.cloud'; // ❌

// Don't expose secrets with VITE_ prefix
VITE_STRIPE_SECRET_KEY=sk_live_... // ❌ — bundled into client JS!

// Don't skip type-check in CI
"build": "vite build" // ❌ — type errors won't block the build
```

### ✅ Do This Instead

```typescript
// Use env vars for all environment-specific values
const API_URL = import.meta.env.VITE_CONVEX_URL; // ✅

// Keep secrets server-only (no VITE_ prefix)
STRIPE_SECRET_KEY=sk_live_... // ✅ — only available in API routes

// Run type-check separately in CI
"build": "tsc --noEmit && vite build" // ✅
```

---

## When to Use This Pattern

✅ **Use for:**
- React + TypeScript SPAs deployed to Vercel/Netlify
- Projects needing build-time metadata injection
- Multi-environment setups (dev/staging/prod)

❌ **Don't use for:**
- SSR applications (use Next.js/Remix instead)
- Projects requiring server-side rendering at build time

---

## Benefits

1. Fast HMR in development via Vite's native ESM
2. Automatic code splitting with hash-based filenames for long-term caching
3. Build metadata injection enables deployment traceability
4. Environment variable validation prevents misconfigured deployments

---

## Related Patterns

- See `deployment-config.md` for Vercel and Convex deployment setup
- See `release-checklist.md` for the full release process
- See `../14-performance/bundle-optimization.md` in `14-performance/` for chunk splitting strategies

---

*Extracted: 2026-02-18*
