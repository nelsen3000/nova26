# NOVA26 Deployment Checklist

> Pre-deployment verification checklist for production releases

---

## Pre-Deployment (Local)

- [ ] Run `npm test` — all tests passing (0 failures)
- [ ] Run `npx tsc --noEmit` — TypeScript clean (0 errors)
- [ ] Run `npx convex dev --once` — schema syncs without errors
- [ ] Run `npx convex deploy --dry-run` — dry-run succeeds
- [ ] Review `git log main` — commits documented clearly
- [ ] Verify `.env.local` has all required variables
- [ ] Test auth flow locally (sign up, sign in, profile view)
- [ ] Test dashboard queries (list builds, agent stats, activity feed)
- [ ] Test build creation and task lifecycle

---

## Security Checks

- [ ] No secrets in source code (run `git grep sk-`)
- [ ] `.env.local` added to `.gitignore`
- [ ] CONVEX_DEPLOY_KEY only in Vercel secrets, not committed
- [ ] All API keys using NEXT_PUBLIC prefix correctly (public vs private)
- [ ] CORS headers configured in Convex
- [ ] Rate limiting enabled on webhooks
- [ ] X-Frame-Options header present (DENY)
- [ ] X-Content-Type-Options header present (nosniff)
- [ ] Strict-Transport-Security header present
- [ ] Auth tokens validated server-side
- [ ] Sensitive fields excluded from activity logs

---

## Data & Schema

- [ ] `convex/schema.ts` defines all 6 ATLAS tables:
  - [ ] builds (by_prd, by_status)
  - [ ] tasks (by_build, by_status, by_agent)
  - [ ] executions (by_task, by_timestamp)
  - [ ] patterns (by_language, by_tags)
  - [ ] agents (by_name, by_domain)
  - [ ] learnings (by_build, by_task)
- [ ] `convex/schema.ts` defines all 4 UI Dashboard tables:
  - [ ] companies (by_status, by_sector)
  - [ ] divisions (by_company, by_company_revenue)
  - [ ] chipAccounts (by_company, by_company_type)
  - [ ] companyAgents (by_company, by_division, by_status)
- [ ] `convex/schema.ts` defines all 4 Wisdom tables:
  - [ ] globalPatterns (by_active, by_success_score, by_promoted_at)
  - [ ] userProfiles (by_user_id, by_tier)
  - [ ] wisdomUpdates (by_timestamp, by_pattern)
  - [ ] agentActivityFeed (by_user_and_time, by_user_and_agent)
- [ ] All indexes are created in schema (schema applies during deploy)
- [ ] Database size estimate is reasonable (<100MB for demo)

---

## Convex Functions

- [ ] `convex/dashboard.ts` compiles (8 queries, 6 mutations)
- [ ] `convex/realtime.ts` compiles (5 queries, 1 mutation)
- [ ] `convex/auth.ts` compiles (7 queries, 1 mutation)
- [ ] `convex/users.ts` compiles (8 queries, 5 mutations)
- [ ] `convex/http.ts` defines HTTP endpoints (GET /health, webhooks)
- [ ] All functions have explicit return types
- [ ] All mutations validate inputs (args)
- [ ] All queries check auth where needed
- [ ] Error messages are user-friendly (no internal stack traces)
- [ ] Pagination implemented correctly (limit, cursor, hasMore)

---

## Authentication

- [ ] Convex Auth configured (public/private keys set)
- [ ] GitHub OAuth configured (optional, if enabled)
  - [ ] Client ID in Vercel env
  - [ ] Client secret in Vercel secrets
  - [ ] Callback URL set in GitHub app
- [ ] `getCurrentUser` query works (returns null when not authed)
- [ ] `ensureUser` mutation works (creates profile on first login)
- [ ] User tier defaults to 'free'
- [ ] Tier upgrades prevent downgrades
- [ ] Session tokens validated server-side

---

## API & Endpoints

**Dashboard endpoints:**
- [ ] `listBuilds(cursor?, pageSize?)` — returns paginated builds
- [ ] `getBuild(buildId)` — returns build with tasks
- [ ] `listTasks(buildId)` — returns sorted tasks
- [ ] `getOverviewStats()` — returns KPIs
- [ ] `getAgentStats()` — returns agent statistics

**Activity endpoints:**
- [ ] `subscribeToActivity()` — returns latest 50 activities
- [ ] `subscribeToBuilds()` — returns running/pending builds
- [ ] `getAgentActivityHistory(agentName)` — returns agent activity
- [ ] `logActivity(agentName, action, details)` — logs event

**User endpoints:**
- [ ] `getCurrentUser()` — returns authed user profile
- [ ] `ensureUser(name?, email?)` — creates user on first login
- [ ] `updateSettings(userId, settings)` — updates preferences
- [ ] `updateTier(userId, tier)` — upgrades user tier
- [ ] `listUsers(limit?, cursor?)` — paginated user list

**Webhooks:**
- [ ] POST `/api/webhooks/github` — GitHub events
- [ ] POST `/api/webhooks/build` — CI/CD notifications
- [ ] POST `/api/webhooks/alert` — Monitoring alerts

---

## Testing

- [ ] Unit tests for all 38 functions (215+ tests)
- [ ] Integration tests for build lifecycle
- [ ] Integration tests for auth flow
- [ ] Integration tests for tier management
- [ ] Load test pagination with 100+ items
- [ ] Test error cases (invalid transitions, auth failures)
- [ ] Test concurrent mutations (lock handling)
- [ ] Test real-time subscriptions (activity feed updates)

---

## Performance

- [ ] Query performance: all <200ms with 1000+ records
- [ ] Pagination working: max 100 items per page
- [ ] Indexes created for all filtered queries
- [ ] Caching headers set on static assets (1 year)
- [ ] API function timeout: 60 seconds (Vercel max)
- [ ] Database connections pooled (Convex managed)

---

## Environment Setup

**Vercel dashboard:**
- [ ] Project created and connected to GitHub repo
- [ ] Environment variables added:
  - [ ] NEXT_PUBLIC_CONVEX_URL
  - [ ] CONVEX_URL
  - [ ] CONVEX_DEPLOY_KEY
  - [ ] ANTHROPIC_API_KEY
  - [ ] (Optional) OPENAI_API_KEY, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
- [ ] Build command: `npx convex deploy && npm run build`
- [ ] Output directory: `.next`
- [ ] Framework: Next.js (auto-detected)
- [ ] Regions: sfo1 (US West Coast)

**Convex dashboard:**
- [ ] Project created
- [ ] Deploy key generated and saved to Vercel secrets
- [ ] Auth config set (GitHub OAuth optional)
- [ ] HTTP endpoints configured
- [ ] Telemetry enabled (10% sampling)

---

## Monitoring Setup

- [ ] Vercel deployment monitoring enabled
- [ ] Convex logs accessible (`npx convex logs`)
- [ ] Error tracking configured (Sentry optional)
- [ ] Langfuse tracing configured (optional)
- [ ] Database backups enabled (Convex auto)
- [ ] Uptime monitoring configured

---

## Documentation

- [ ] `vercel.json` explains build/deploy pipeline ✅
- [ ] `convex.json` documents auth and function config ✅
- [ ] `.env.local.example` documents all env vars ✅
- [ ] `DEPLOYMENT-CONFIG.md` covers all steps ✅
- [ ] `DEPLOYMENT-CHECKLIST.md` (this file) complete ✅
- [ ] README.md mentions deployment URL
- [ ] CONTRIBUTING.md includes local dev setup

---

## Final Verification

- [ ] All files committed to git
- [ ] No uncommitted changes (`git status` clean)
- [ ] Branch is up to date with origin
- [ ] No merge conflicts
- [ ] All CI checks passing (if configured)
- [ ] Staging environment deployed and tested
- [ ] Production URLs work

---

## Deployment

### Ready to Deploy ✅

**Step 1: Deploy Convex**
```bash
npx convex deploy --project prod:your-project-id
```
- Verifies schema compilation
- Creates tables and indexes
- Deploys all function code

**Step 2: Deploy Next.js to Vercel**
```bash
git push origin main
# Vercel auto-deploys via webhook
# Or use: npx vercel deploy --prod
```
- Installs dependencies
- Runs `npx convex deploy` (per vercel.json buildCommand)
- Builds Next.js
- Uploads to Vercel CDN

**Step 3: Verify Production**
```bash
# Check logs
vercel logs --prod

# Test health endpoint
curl https://nova26-prod.vercel.app/api/health

# Test API
curl -H "Authorization: Bearer $TOKEN" \
  https://nova26-prod.vercel.app/api/convex/dashboard.listBuilds
```

### Post-Deployment

- [ ] Verify production URLs accessible
- [ ] Test signup/login on production
- [ ] Verify all dashboard queries work
- [ ] Check error logs for any issues
- [ ] Notify stakeholders of deployment
- [ ] Document deployment date and version

---

## Rollback Procedures

**If Vercel deployment fails:**
```bash
vercel logs --prod  # Check what failed
# Fix issue locally
git push origin main  # Redeploy
```

**If Convex deployment fails:**
```bash
npx convex logs  # Check function compilation errors
# Fix convex/schema.ts or function code
npx convex deploy --project prod:your-project-id  # Retry
```

**To rollback to previous version:**
- Vercel dashboard → Deployments → Select previous → Promote
- Convex: revert to previous function version (if needed)

---

**Status**: ✅ Ready for Production
**Last verified**: 2026-02-20
**Next review**: After each deployment
