# Deployment Configuration

## Source
Extracted from BistroLens `vercel.json`, `.github/workflows/security.yml`, `.github/workflows/golden-pdfs.yml`, `.github/workflows/sw-dev-guard.yml`, `49-DEPLOYMENT-RELEASE-PROCESS.md`

---

## Pattern: Vercel + Convex Deployment

BistroLens deploys the frontend SPA to Vercel and the backend to Convex. Vercel handles routing, caching headers, and API proxying. Convex is deployed independently via its CLI.

---

## Environment Overview

| Environment | Purpose | URL | Trigger |
|-------------|---------|-----|---------|
| Development | Local dev | localhost:5173 | Manual |
| Preview | PR previews | pr-{n}.bistrolens.dev | On PR open |
| Staging | Pre-production | staging.bistrolens.com | Push to main |
| Production | Live users | bistrolens.com | Manual approval |

---

## Vercel Configuration

### vercel.json

```json
{
  "rewrites": [
    { "source": "/sitemap.xml", "destination": "/api/sitemap" },
    { "source": "/api/:path*", "destination": "/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Content-Type", "value": "application/json" },
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, PUT, DELETE, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization" }
      ]
    },
    {
      "source": "/assets/:path*",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/index.html",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    },
    {
      "source": "/manifest.json",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=86400" }
      ]
    }
  ]
}
```

### Key Routing Rules

```typescript
// SPA fallback — all non-API routes serve index.html
// This enables client-side routing with React Router
{ "source": "/(.*)", "destination": "/index.html" }

// API routes pass through to Vercel serverless functions in /api/
{ "source": "/api/:path*", "destination": "/api/:path*" }

// Dynamic sitemap generation
{ "source": "/sitemap.xml", "destination": "/api/sitemap" }
```

### Deploy Commands

```bash
# Deploy to staging (auto on main push)
git push origin main

# Deploy to production (manual)
vercel --prod

# Deploy with specific token (CI)
vercel --prod --token=$VERCEL_TOKEN

# Rollback production
vercel rollback
```

---

## Convex Deployment

### Setup

```bash
# Install Convex CLI
npm install convex

# Initialize (first time)
npx convex dev

# Deploy to production
npx convex deploy

# Deploy to specific environment
npx convex deploy --prod
```

### Environment Variables in Convex

```bash
# Set env vars in Convex dashboard or via CLI
npx convex env set STRIPE_SECRET_KEY sk_live_...
npx convex env set STRIPE_WEBHOOK_SECRET whsec_...
npx convex env set ENCRYPTION_KEY your-64-char-hex-key
npx convex env set ADMIN_EMAILS admin@bistrolens.com
```

### Convex Auth Configuration

```typescript
// convex/auth.ts — OAuth providers configured here
import { convexAuth } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
import GitHub from "@auth/core/providers/github";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Google, GitHub],
});
```

---

## CI/CD Pipeline

### Pipeline Stages

```yaml
# Conceptual pipeline (from 49-DEPLOYMENT-RELEASE-PROCESS.md)
stages:
  - lint        # ESLint, Prettier
  - typecheck   # TypeScript
  - test        # Unit tests
  - build       # Vite build
  - preview     # Deploy preview (PRs)
  - staging     # Deploy staging (main)
  - production  # Deploy production (manual)
```

### Quality Gates

```typescript
const QUALITY_GATES = {
  required: {
    linting: true,
    typecheck: true,
    unitTests: true,
    buildSuccess: true,
  },
  thresholds: {
    testCoverage: 70,           // Minimum %
    bundleSize: 500,            // KB gzipped
    lighthousePerformance: 80,  // Minimum score
  },
};
```

---

## GitHub Actions Workflows

### Security Checks (`security.yml`)

Runs on push to `main`/`develop`, PRs to `main`, and weekly schedule.

```yaml
name: Security Checks

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  dependency-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      # Critical-level audit; report-only on PRs, strict on main
      - run: npm audit --omit=dev --audit-level=critical
        continue-on-error: ${{ github.event_name == 'pull_request' }}

  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
          extra_args: --only-verified

  build-verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint || true
      - run: npm run build
        env:
          VITE_CONVEX_URL: ${{ secrets.VITE_CONVEX_URL }}
      - run: |
          if [ ! -d "dist" ]; then echo "❌ Build failed!"; exit 1; fi
          echo "✅ Build successful"
```

### Service Worker Dev Guard (`sw-dev-guard.yml`)

Blocks PRs that are missing the SW dev-disable fix (prevents localhost cache issues).

```yaml
name: SW Dev Guard

on:
  pull_request:
    branches: [main, develop]

jobs:
  check-sw-dev-disable:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      
      - name: Check for SW dev-disable commit
        run: |
          # Check if fix commit is ancestor
          if git merge-base --is-ancestor f80b82f HEAD 2>/dev/null; then
            echo "✅ SW dev-disable commit present"; exit 0
          fi
          # Fallback: check for code pattern
          if grep -q "DEV MODE: Unregister all service workers" index.tsx 2>/dev/null; then
            echo "✅ SW dev-disable code found"; exit 0
          fi
          echo "❌ FAILED: SW dev-disable fix is missing!"
          exit 1
```

### Golden PDF Generation (`golden-pdfs.yml`)

Manual-only workflow for generating and validating recipe PDF outputs.

```yaml
name: Golden PDF Generation

on:
  workflow_dispatch:  # Manual trigger only

jobs:
  generate-golden-pdfs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:golden-pdfs
        env:
          CI: true
          VITE_CONVEX_URL: ${{ secrets.VITE_CONVEX_URL }}
      - uses: actions/upload-artifact@v4
        with:
          name: golden-pdfs
          path: tests/golden-pdfs/golden-*.pdf
          retention-days: 30
```

---

## Staging vs Production Rules

### Staging (Auto-Deploy on main)

```typescript
const STAGING_RULES = {
  trigger: 'push_to_main',
  preChecks: [
    'all_tests_pass',
    'build_succeeds',
    'no_critical_vulnerabilities',
  ],
  postChecks: [
    'health_check_passes',
    'smoke_tests_pass',
    'no_error_spike',
  ],
};
```

### Production (Manual Approval Required)

```typescript
const PRODUCTION_RULES = {
  trigger: 'manual',
  requiredApprovals: 1,
  approvers: ['admin', 'lead'],
  
  // Preferred deployment window
  preferredWindow: {
    days: ['Tuesday', 'Wednesday', 'Thursday'],
    hours: { start: 10, end: 16 },  // 10am–4pm ET
    timezone: 'America/New_York',
  },
  
  // Never deploy during
  blackoutPeriods: [
    'Fridays after 2pm',
    'Weekends',
    'Holidays',
    'During major events',
  ],
};
```

---

## Anti-Patterns

### ❌ Don't Do This

```yaml
# Don't deploy to production automatically on every push
on:
  push:
    branches: [main]
# with: run: vercel --prod  ❌

# Don't skip security checks on PRs
- run: npm audit
  continue-on-error: true  # ❌ — always continue-on-error hides real issues
```

### ✅ Do This Instead

```yaml
# Production deploys are always manual
# Staging auto-deploys, production requires approval

# Security audit: report-only on PRs, strict on main
- run: npm audit --omit=dev --audit-level=critical
  continue-on-error: ${{ github.event_name == 'pull_request' }}  # ✅
```

---

## When to Use This Pattern

✅ **Use for:**
- React SPAs with Convex backend
- Projects needing separate staging and production environments
- Teams requiring security scanning in CI

❌ **Don't use for:**
- SSR apps (Vercel rewrites assume SPA fallback)
- Projects without a Convex backend (adapt Convex steps)

---

## Benefits

1. SPA routing works correctly via catch-all rewrite to `index.html`
2. Hashed assets get 1-year immutable cache; `index.html` always revalidates
3. Security scanning catches vulnerabilities before they reach production
4. Manual production gate prevents accidental deploys

---

## Related Patterns

- See `build-process.md` for Vite build configuration
- See `release-checklist.md` for the full pre/post deployment checklist
- See `01-convex-patterns/` for Convex schema and query patterns

---

*Extracted: 2026-02-18*
