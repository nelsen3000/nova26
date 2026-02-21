# BistroLens Knowledge Extraction — Summary

**Date Completed:** 2026-02-18
**Extracted By:** Kiro (Nova26)

---

## Overview

79 reusable patterns were extracted from the BistroLens project and organized into Nova26's knowledge base. Every pattern includes full TypeScript code examples, anti-patterns, usage guidelines, and cross-references.

---

## Stats

| Metric | Value |
|--------|-------|
| Total patterns extracted | 79 |
| Categories covered | 16 |
| Files created | 79 pattern files + INDEX.md + EXTRACTION-TASK-LIST.md |
| Code examples per file | 2–6 |
| Broken cross-references | 11 (future extraction candidates) |

---

## Categories Covered

| # | Category | Patterns |
|---|----------|----------|
| 01 | Convex Patterns | 8 |
| 02 | React Patterns | 6 |
| 03 | Auth Patterns | 5 |
| 04 | UI Components | 8 |
| 05 | Form Patterns | 5 |
| 06 | Data Fetching | 4 |
| 07 | Error Handling | 4 |
| 08 | Testing Patterns | 5 |
| 09 | Custom Hooks | 6 |
| 10 | Utilities | 5 |
| 11 | Validation | 4 |
| 12 | Routing | 3 |
| 13 | State Management | 4 |
| 14 | Performance | 4 |
| 15 | Accessibility | 4 |
| 16 | Deployment | 3 |
| **Total** | | **79** |

---

## Tech Stack Summary

BistroLens is a full-stack TypeScript application built on:

- **Frontend:** React 19, Tailwind CSS, shadcn/ui
- **Backend:** Convex (serverless database + functions)
- **Auth:** Clerk + custom reCAPTCHA integration
- **Validation:** Zod + react-hook-form + Convex validators
- **Testing:** Vitest, React Testing Library, Playwright
- **Build:** Vite with manual chunk splitting
- **Deployment:** Vercel + Convex cloud
- **Payments:** Stripe (subscription tiers)
- **Accessibility:** WCAG 2.1 AA compliance patterns

---

## Key Findings

### Architecture
- BistroLens uses a **multi-tenant architecture** with `companyId` row-level isolation on every Convex table
- All backend functions enforce auth via `requireAuth()` / `requireRole()` helpers before any data access
- Subscription tiers (free/pro/enterprise) are enforced both server-side (Convex) and client-side (feature gates)

### Convex Patterns
- Queries use cursor-based pagination with a `numItems` + `cursor` pattern
- Mutations follow a consistent pattern: validate → check auth → check ownership → mutate → return
- Real-time subscriptions use conditional `useQuery` with `skip` to avoid unnecessary subscriptions
- File storage uses Convex's built-in storage with signed URLs for secure access

### Auth & Security
- Age verification is stored in Convex with a `verifiedAt` timestamp and re-verified on sensitive actions
- RBAC uses a role hierarchy: `viewer < editor < admin < owner` with explicit permission checks
- Session management includes automatic refresh with a 5-minute buffer before expiry

### UI Patterns
- All components handle 5 states: loading, empty, error, partial, populated
- Empty states always include a CTA (call-to-action) button
- Error states include a retry mechanism with exponential backoff
- Toast notifications use a queue system with auto-dismiss and manual close

### Form Patterns
- Multi-step forms persist state in `sessionStorage` to survive page refreshes
- File uploads use Convex's `generateUploadUrl` mutation with client-side progress tracking
- Dynamic fields use `useFieldArray` from react-hook-form with optimistic UI updates

### Performance
- Code splitting is route-based using `React.lazy` + `Suspense`
- Images use `loading="lazy"` + `decoding="async"` + explicit `width`/`height`
- Bundle optimization uses Vite's `manualChunks` to separate vendor, UI, and app code
- Render optimization uses `React.memo` + `useCallback` for list items and event handlers

### Testing
- Unit tests use Vitest with `vi.mock` for Convex functions
- Component tests use React Testing Library with `userEvent` for realistic interactions
- E2E tests use Playwright with page object model and `data-testid` selectors
- Integration tests mock Convex with `ConvexTestingHelper` for realistic data flows

---

## Notable Patterns Discovered

1. **Soft Delete Pattern** — BistroLens never hard-deletes records; all deletes set `deletedAt` timestamp and `isDeleted: true`, enabling audit trails and recovery.

2. **Subscription Enforcement Middleware** — A reusable `requireSubscription(tier)` function wraps Convex mutations to enforce tier limits before any business logic runs.

3. **Age Verification Gate** — A multi-step age verification flow with legal compliance storage, used as a pattern for any sensitive content gating.

4. **Error Incident Tracking** — Errors are assigned unique incident IDs shown to users, enabling support teams to correlate user reports with server logs.

5. **Optimistic Mutation Pattern** — Mutations update local state immediately before the server confirms, with automatic rollback on failure.

6. **Convex Validator Composition** — Complex validators are built by composing `v.object()`, `v.union()`, and `v.array()` with custom error messages.

7. **Context + Convex Hybrid State** — App state combines React Context (UI state, preferences) with Convex real-time queries (server state), avoiding redundant local caching.

8. **WCAG-First Component Design** — Every interactive component is built with keyboard navigation, ARIA labels, and focus management as first-class requirements, not afterthoughts.

---

## Future Extraction Candidates

The following patterns were referenced in cross-references but not extracted (outside the 79-pattern scope):

- `rate-limiting.md` — API rate limiting patterns
- `soft-delete-pattern.md` — Dedicated soft delete documentation
- `use-auth-with-recaptcha.md` — reCAPTCHA-specific auth hook
- `use-swipe-gesture.md` — Mobile swipe gesture hook
- `use-tier-gates.md` / `use-freemium.md` — Subscription tier gate hooks
- `subscription-service.md` — Subscription service layer
- `convex-file-storage.md` — Dedicated file storage hook
- `resilience-patterns.md` — Circuit breaker / retry patterns

---

## Validation Results

| Check | Result |
|-------|--------|
| All files have required sections | ✅ 79/79 |
| No unclosed code fences | ✅ Clean |
| No `[truncated]` placeholders | ✅ Clean |
| Cross-references in Related Patterns | ⚠️ 11 broken (future patterns) |

---

*Extraction completed: 2026-02-18*
*Knowledge base location: `.nova/bistrolens-knowledge/`*
