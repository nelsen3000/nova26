# NOVA26 Deployment Configuration

> **Task H5**: Deployment Configuration for Wave 1
> **Status**: Complete
> **Files**: `vercel.json`, `convex.json`, `.env.local.example`

---

## Overview

Nova26 is deployed as a Next.js + Convex fullstack application:
- **Frontend/API**: Vercel (Next.js)
- **Backend**: Convex (serverless)
- **Database**: Convex managed database
- **Real-time**: Convex subscriptions

---

## Configuration Files

### 1. `vercel.json` — Vercel Deployment Config

**Build pipeline:**
```bash
npx convex deploy && npm run build
```

**Key settings:**
- `outputDirectory`: `.next` (Next.js output)
- `framework`: `nextjs` (Vercel auto-detection)
- `regions`: `sfo1` (US West Coast primary)
- `maxDuration`: 60 seconds (API functions)

**Security headers** (applied to all routes):
- `X-Frame-Options: DENY` — Prevent clickjacking
- `X-Content-Type-Options: nosniff` — Prevent MIME sniffing
- `Strict-Transport-Security: max-age=31536000` — Force HTTPS for 1 year
- `X-XSS-Protection: 1; mode=block` — Legacy XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin` — Privacy-preserving referrer
- `Permissions-Policy` — Disable geolocation, microphone, camera

**Rewrites:**
- `/api/convex/*` → Convex serverless functions (optional, usually client-side only)

**Environment variables:**
All required vars are declared in `env` object for Vercel dashboard visibility.

---

### 2. `convex.json` — Convex Configuration

**Auth providers:**
- GitHub OAuth (optional, configured in Convex dashboard)
- Convex Auth (built-in token validation)

**HTTP functions:**
- `/webhooks/*`: Max 1MB body, POST/PUT only
- `/health`: Health check endpoint, GET only

**Telemetry:**
- Enabled with 10% sampling rate (production optimization)

---

### 3. `.env.local.example` — Environment Variables

**Required for all environments:**
```bash
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
CONVEX_URL=https://your-project.convex.cloud
```

**Required for deployment (CI/CD):**
```bash
CONVEX_DEPLOY_KEY=prod:...  # From Convex dashboard → Settings → Deploy Key
```

**LLM providers** (at least one):
```bash
ANTHROPIC_API_KEY=sk-ant-...    # Required for Claude models
OPENAI_API_KEY=sk-...           # Optional for GPT models
```

**Optional integrations:**
```bash
GITHUB_CLIENT_ID=Ov23li...
GITHUB_CLIENT_SECRET=...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
```

---

## Deployment Steps

### Local Development

1. **Setup environment:**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your values
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start Convex development:**
   ```bash
   npx convex dev
   # This syncs schema and generates type files
   # Convex will prompt for project selection on first run
   ```

4. **Start Next.js dev server:**
   ```bash
   npm run dev
   # Visit http://localhost:3000
   ```

### Pre-deployment Verification

1. **Type check:**
   ```bash
   npx tsc --noEmit
   # Should complete with 0 errors
   ```

2. **Convex schema sync:**
   ```bash
   npx convex dev --once
   # Validates schema.ts and creates indexes
   ```

3. **Convex deployment dry-run:**
   ```bash
   npx convex deploy --dry-run
   # Shows what will be deployed without deploying
   # Verify all functions compile and indexes are defined
   ```

4. **Run tests:**
   ```bash
   npm test
   # All tests should pass before deployment
   ```

### Production Deployment

**Option 1: GitHub → Vercel (Recommended)**

1. Connect repo to Vercel dashboard
2. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_CONVEX_URL`
   - `CONVEX_URL`
   - `CONVEX_DEPLOY_KEY`
   - `ANTHROPIC_API_KEY`
   - Other optional vars as needed

3. Push to `main` branch → Auto-deploys

**Option 2: Manual Deployment**

```bash
# Deploy Convex functions
npx convex deploy --project prod:your-project-id --team your-team-id

# Build Next.js
npm run build

# Deploy to Vercel (if using Vercel CLI)
npx vercel deploy --prod
```

---

## Convex Function Deployment Pipeline

1. **Schema validation** (`convex/schema.ts`)
   - Defines all tables and indexes
   - Type-safe TypeScript definitions

2. **Function compilation** (`convex/*.ts`)
   - All `.ts` files outside schema become HTTP endpoints
   - Validates function signatures and argument types

3. **Index creation**
   - All indexes defined in schema are created in production
   - Indexes on high-query fields (by_timestamp, by_build, by_agent, etc.)

4. **Environment variables injection**
   - `CONVEX_URL` and `CONVEX_DEPLOY_KEY` used for auth
   - Other secrets available to Convex functions via `process.env`

---

## Health Checks

**Vercel health check:**
- Auto-configured for `/` (Next.js root)
- Vercel monitors deployment health

**Convex health check:**
- Endpoint: `GET /api/health` (via `convex/http.ts`)
- Returns: `{ status: "ok", timestamp, version }`
- Monitors backend availability

**Monitor deployment:**
```bash
# Check Vercel logs
vercel logs --prod

# Check Convex logs
npx convex logs
```

---

## Rollback Procedures

**Vercel rollback:**
- Vercel dashboard → Deployments → Select previous deployment → Promote

**Convex rollback:**
- Convex dashboard → Functions → Redeploy previous version
- Note: Database schema changes are permanent (manual rollback if needed)

---

## Security Checklist

✅ `X-Frame-Options: DENY` — Prevent frame embedding
✅ `X-Content-Type-Options: nosniff` — Prevent MIME attacks
✅ `Strict-Transport-Security` — Force HTTPS
✅ CONVEX_DEPLOY_KEY stored in Vercel secrets (not committed)
✅ API keys in environment variables only (not in source)
✅ Auth tokens validated server-side via Convex Auth
✅ CORS headers configured in Convex
✅ Rate limiting on webhooks (max 100/min per source)

---

## Monitoring & Observability

**Langfuse integration** (optional):
- Traces all Anthropic API calls
- Monitor token usage, latency, error rates
- Dashboard: https://cloud.langfuse.com

**Convex observability:**
- Function execution logs
- Database query performance
- Real-time subscription metrics

**Vercel monitoring:**
- Request metrics (latency, error rate)
- Build duration
- Deployment status

---

## Troubleshooting

### "CONVEX_DEPLOY_KEY not found"
→ Set in Vercel dashboard Environment Variables, deploy again

### "Schema mismatch"
→ Run `npx convex dev` locally, commit schema changes, redeploy

### "Function not found"
→ Ensure file is in `convex/` directory, check function export names

### "Index creation failed"
→ Check `convex/schema.ts` index definitions, verify field names match schema

### "Auth token invalid"
→ Verify `NEXT_PUBLIC_CONVEX_URL` matches deployed Convex project URL

---

## Next Steps

- **H6**: Index optimization (add caching table if needed)
- **H7**: Cron jobs (cleanup, stats aggregation, stalled build detection)
- **H8**: Webhooks (GitHub, CI/CD notifications)

---

**Last updated**: 2026-02-20
**Deployed**: Production-ready ✅
