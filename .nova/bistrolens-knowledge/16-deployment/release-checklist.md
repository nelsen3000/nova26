# Release Checklist

## Source
Extracted from BistroLens `.kiro/steering/49-DEPLOYMENT-RELEASE-PROCESS.md`

---

## Pattern: Structured Release Process

BistroLens follows a staged release process: staging validation → manual production approval → post-deploy monitoring → rollback readiness. Production deploys are manual-only, require approval, and are restricted to a preferred deployment window.

---

## Pre-Release Checklist

### Code Quality

```typescript
const PRE_RELEASE_CHECKS = {
  code: [
    '✅ All CI checks pass (lint, typecheck, tests, build)',
    '✅ No critical npm audit vulnerabilities',
    '✅ No hardcoded secrets (TruffleHog scan clean)',
    '✅ Bundle size under 500KB gzipped',
    '✅ Lighthouse performance score ≥ 80',
  ],
  
  staging: [
    '✅ Feature tested on staging environment',
    '✅ Smoke tests pass on staging',
    '✅ No error spike in Sentry after staging deploy',
    '✅ Health check endpoint returns 200',
  ],
  
  database: [
    '✅ Schema migrations reviewed (safe vs. multi-step)',
    '✅ Backfill scripts tested on staging data',
    '✅ No breaking schema changes without migration plan',
  ],
  
  operations: [
    '✅ Rollback plan documented',
    '✅ On-call engineer available',
    '✅ Team notified in #deployments channel',
    '✅ Deployment window is within preferred hours',
  ],
};
```

### Deployment Window

```typescript
const DEPLOYMENT_WINDOW = {
  // Preferred: Tue–Thu, 10am–4pm ET
  preferred: {
    days: ['Tuesday', 'Wednesday', 'Thursday'],
    hours: { start: 10, end: 16 },
    timezone: 'America/New_York',
  },
  
  // Never deploy during these periods
  blackout: [
    'Fridays after 2pm',
    'Weekends',
    'Public holidays',
    'During major product events or launches',
    'When on-call engineer is unavailable',
  ],
};
```

---

## Testing Requirements

### Required Before Production

```bash
# 1. Unit tests
npm run test

# 2. Type check
npm run type-check

# 3. Lint (zero warnings)
npm run lint

# 4. Production build succeeds
npm run build

# 5. E2E tests (critical paths)
npm run test:e2e

# 6. Security audit
npm audit --omit=dev --audit-level=critical
```

### Quality Thresholds

```typescript
const QUALITY_THRESHOLDS = {
  testCoverage: 70,           // Minimum % coverage
  bundleSize: 500,            // KB gzipped max
  lighthousePerformance: 80,  // Minimum Lighthouse score
  errorRate: 1,               // Max % of requests erroring
  p95ResponseTime: 1000,      // ms — warning threshold
};
```

---

## Deployment Steps

### Step 1: Deploy Convex Backend

```bash
# Deploy Convex functions and schema
npx convex deploy --prod

# Verify deployment
npx convex dashboard  # Check function logs for errors
```

### Step 2: Deploy Frontend to Vercel

```bash
# Manual production deploy
vercel --prod --token=$VERCEL_TOKEN

# Or via Vercel dashboard: Deployments → Promote to Production
```

### Step 3: Verify Deployment

```bash
# Health check
curl https://bistrolens.com/api/health

# Expected response
{
  "status": "ok",
  "checks": {
    "database": "healthy",
    "ai_service": "healthy",
    "storage": "healthy"
  }
}
```

### Step 4: Smoke Test Critical Paths

```typescript
const SMOKE_TESTS = [
  'User can load the homepage',
  'User can sign in with Google/GitHub',
  'User can view their recipe list',
  'User can generate a recipe (AI call succeeds)',
  'Subscription page loads correctly',
  'Stripe checkout initiates',
];
```

---

## Post-Deployment Verification

### Monitoring Checklist (First 15 Minutes)

```typescript
const POST_DEPLOY_MONITORING = {
  immediate: [
    '✅ Health check endpoint returns 200',
    '✅ Homepage loads without JS errors',
    '✅ Sentry shows no new error spike',
    '✅ Convex dashboard shows no function failures',
  ],
  
  after5min: [
    '✅ Error rate below 1% (warning threshold)',
    '✅ p95 response time below 1000ms',
    '✅ No user-reported issues in support channel',
  ],
  
  after15min: [
    '✅ Uptime monitoring shows 100% availability',
    '✅ No critical alerts fired',
    '✅ Notify team: deploy successful ✅',
  ],
};
```

### Alert Thresholds

```typescript
const ALERT_THRESHOLDS = {
  errorRate: {
    warning: 1,    // % — investigate
    critical: 5,   // % — consider rollback
  },
  p95ResponseTime: {
    warning: 1000, // ms
    critical: 3000, // ms — consider rollback
  },
  uptime: {
    warning: 99.5, // %
    critical: 99,  // % — immediate action
  },
};
```

---

## Rollback Procedures

### Automatic Rollback Triggers

```typescript
const AUTO_ROLLBACK_TRIGGERS = {
  errorRate: {
    threshold: 5,         // % of requests failing
    window: 300,          // 5-minute window
    action: 'rollback',
  },
  healthCheck: {
    consecutiveFailures: 3,
    action: 'rollback',
  },
  responseTime: {
    threshold: 3000,      // ms p95
    window: 300,
    action: 'alert',      // Alert only, not auto-rollback
  },
};
```

### Manual Rollback Process

```typescript
const ROLLBACK_STEPS = [
  '1. Identify the issue and confirm rollback is needed',
  '2. Notify team in #incidents channel immediately',
  '3. Execute rollback command',
  '4. Verify rollback was successful (health check)',
  '5. Monitor for 15 minutes post-rollback',
  '6. Post incident report within 24 hours',
];
```

### Rollback Commands

```bash
# Rollback Vercel frontend
vercel rollback

# Rollback Convex to previous deployment
npx convex deploy --preview {previous_deployment_id}

# Verify rollback
curl https://bistrolens.com/api/health
```

### Post-Rollback Actions

```typescript
const POST_ROLLBACK = [
  '✅ Verify site is functional (smoke tests)',
  '✅ Confirm error rates returned to baseline',
  '✅ Notify stakeholders of rollback',
  '✅ Create incident ticket with timeline',
  '✅ Schedule post-mortem within 48 hours',
  '✅ Document root cause and prevention steps',
];
```

---

## Feature Flag Management

### Gradual Rollout Pattern

```typescript
interface FeatureFlag {
  key: string;
  description: string;
  defaultValue: boolean;
  enabledFor?: {
    users?: string[];         // Specific user IDs
    tiers?: string[];         // Subscription tiers
    percentage?: number;      // % of users (0–100)
    environments?: string[];  // dev, staging, prod
  };
  expiresAt?: Date;           // Max 90 days
  owner: string;
}

// Example: 10% rollout to production
const newFeatureFlag: FeatureFlag = {
  key: 'new-fusion-kitchen-ui',
  description: 'New Fusion Kitchen interface',
  defaultValue: false,
  enabledFor: {
    environments: ['staging'],
    percentage: 10,
  },
  expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  owner: 'team-frontend',
};
```

### Using Feature Flags

```typescript
// Client-side check
const showNewUI = useFeatureFlag('new-fusion-kitchen-ui');

if (showNewUI) {
  return <NewFusionKitchen />;
}
return <FusionKitchen />;

// Server-side check (Convex action)
const isEnabled = await checkFeatureFlag(userId, 'live-chef-enabled');
```

### Flag Lifecycle Rules

```typescript
const FLAG_LIFECYCLE = {
  requireDescription: true,
  requireOwner: true,
  requireExpirationDate: true,  // Max 90 days
  reviewAfterDays: 30,
  removeAfterFullRollout: true, // Clean up flags after 100% rollout
};
```

---

## Database Migration Checklist

```typescript
const MIGRATION_SAFETY = {
  // Safe — can deploy without review
  safe: [
    'Add optional field to existing table',
    'Add new table',
    'Add new index',
  ],
  
  // Requires review before deploy
  review: [
    'Add required field (needs default or backfill)',
    'Remove field (check all usages first)',
    'Change field type',
    'Remove table',
  ],
  
  // Multi-step migration required
  multiStep: [
    'Rename field: add new → backfill → remove old',
    'Change optional to required: add default → backfill → enforce',
  ],
  
  // Backfill configuration
  backfill: {
    batchSize: 100,
    delayBetweenBatches: 100,  // ms — avoid overloading DB
    runDuringLowTraffic: true,
  },
};
```

---

## Release Notes Template

```markdown
## v{version} - {date}

### New Features
- Feature 1 description
- Feature 2 description

### Improvements
- Improvement 1
- Improvement 2

### Bug Fixes
- Fix 1
- Fix 2

### Breaking Changes
- None / List any breaking changes

### Migration Notes
- None / List any required actions for existing users
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Don't deploy on Fridays or weekends
// Don't skip staging validation
// Don't deploy without a rollback plan
// Don't deploy when on-call is unavailable
// Don't merge schema-breaking changes without a migration plan

// Don't leave feature flags indefinitely
const flag = { key: 'old-feature', expiresAt: undefined }; // ❌
```

### ✅ Do This Instead

```typescript
// Always set expiration on feature flags
const flag = {
  key: 'new-feature',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days ✅
};

// Always test on staging before production
// Always have rollback commands ready before deploying
// Always monitor for 15 minutes post-deploy
```

---

## When to Use This Pattern

✅ **Use for:**
- Any production deployment of a user-facing application
- Teams with multiple engineers and shared ownership
- Applications with paid subscriptions (rollback risk is high)

❌ **Don't use for:**
- Internal tools with no SLA requirements (lighter process is fine)
- Hotfixes during active incidents (expedited process applies)

---

## Benefits

1. Staged rollout (staging → production) catches issues before users see them
2. Deployment windows reduce risk by avoiding high-traffic periods
3. Automatic rollback triggers limit blast radius of bad deploys
4. Feature flags enable gradual rollouts without code branches

---

## Related Patterns

- See `build-process.md` for Vite build and environment variable setup
- See `deployment-config.md` for Vercel and Convex configuration
- See `../07-error-handling/error-logging.md` for Sentry monitoring setup

---

*Extracted: 2026-02-18*
