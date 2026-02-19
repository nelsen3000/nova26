# BistroLens Knowledge Base — Index

> Complete reference for 100 extracted patterns from the BistroLens codebase.
> Use this index to quickly find the right pattern for any task.

---

## Quick Navigation

- [All Patterns by Category](#all-patterns-by-category)
- [Most Used Patterns](#most-used-patterns)
- [By Use Case](#by-use-case)
- [Pattern Relationships](#pattern-relationships)

---

## All Patterns by Category

### 01 — Convex Patterns (11 patterns)
| Pattern | File | Description |
|---------|------|-------------|
| Schema Conventions | [schema-conventions.md](01-convex-patterns/schema-conventions.md) | defineTable, validators, indexes |
| Query Patterns | [query-patterns.md](01-convex-patterns/query-patterns.md) | useQuery, skip pattern, pagination |
| Mutation Patterns | [mutation-patterns.md](01-convex-patterns/mutation-patterns.md) | useMutation, optimistic updates |
| Real-time Subscriptions | [real-time-subscriptions.md](01-convex-patterns/real-time-subscriptions.md) | Live data, presence indicators |
| File Storage Patterns | [file-storage-patterns.md](01-convex-patterns/file-storage-patterns.md) | Image upload, storage IDs |
| Error Handling | [error-handling.md](01-convex-patterns/error-handling.md) | ConvexError, error propagation |
| Performance Optimization | [performance-optimization.md](01-convex-patterns/performance-optimization.md) | Index usage, query efficiency |
| Migration Procedures | [migration-procedures.md](01-convex-patterns/migration-procedures.md) | Safe schema changes, backfills |
| Convex File Storage | [convex-file-storage.md](01-convex-patterns/convex-file-storage.md) | Convex file storage hook, upload/download |
| Optimistic Mutation Pattern | [optimistic-mutation-pattern.md](01-convex-patterns/optimistic-mutation-pattern.md) | Optimistic UI updates for mutations |
| Soft Delete Pattern | [soft-delete-pattern.md](01-convex-patterns/soft-delete-pattern.md) | Soft delete with isDeleted flag, restore support |

### 02 — React Patterns (6 patterns)
| Pattern | File | Description |
|---------|------|-------------|
| Component Structure | [component-structure.md](02-react-patterns/component-structure.md) | Props, composition, forwardRef |
| State Management | [state-management.md](02-react-patterns/state-management.md) | useState, useReducer patterns |
| Effect Patterns | [effect-patterns.md](02-react-patterns/effect-patterns.md) | useEffect, cleanup, dependencies |
| Memo Optimization | [memo-optimization.md](02-react-patterns/memo-optimization.md) | useMemo, useCallback, React.memo |
| Error Boundaries | [error-boundaries.md](02-react-patterns/error-boundaries.md) | Class boundaries, fallback UI |
| Suspense Patterns | [suspense-patterns.md](02-react-patterns/suspense-patterns.md) | React.lazy, Suspense, code splitting |

### 03 — Auth Patterns (6 patterns)
| Pattern | File | Description |
|---------|------|-------------|
| Auth Helpers | [auth-helpers.md](03-auth-patterns/auth-helpers.md) | simpleAuth service, session init |
| Session Management | [session-management.md](03-auth-patterns/session-management.md) | localStorage persistence, listeners |
| RBAC Implementation | [rbac-implementation.md](03-auth-patterns/rbac-implementation.md) | Role-based access control |
| Subscription Enforcement | [subscription-enforcement.md](03-auth-patterns/subscription-enforcement.md) | Tier gates, useTierGates hook |
| Age Verification | [age-verification.md](03-auth-patterns/age-verification.md) | Drink mode age gate |
| Subscription Service | [subscription-service.md](03-auth-patterns/subscription-service.md) | Stripe subscription management, tier logic |

### 04 — UI Components (8 patterns)
| Pattern | File | Description |
|---------|------|-------------|
| Button Variants | [button-variants.md](04-ui-components/button-variants.md) | Design system button tokens |
| Form Components | [form-components.md](04-ui-components/form-components.md) | Input, Select, Textarea patterns |
| Modal / Dialog | [modal-dialog.md](04-ui-components/modal-dialog.md) | Modal component, focus trap |
| Toast Notifications | [toast-notifications.md](04-ui-components/toast-notifications.md) | Toast hook, role="alert" |
| Loading States | [loading-states.md](04-ui-components/loading-states.md) | Skeleton, spinner, LoadingScreen |
| Empty States | [empty-states.md](04-ui-components/empty-states.md) | Empty state components, CTAs |
| Error States | [error-states.md](04-ui-components/error-states.md) | Error display, retry buttons |
| Card Layouts | [card-layouts.md](04-ui-components/card-layouts.md) | Design system Card component |

### 05 — Form Patterns (5 patterns)
| Pattern | File | Description |
|---------|------|-------------|
| Form Validation | [form-validation.md](05-form-patterns/form-validation.md) | Client-side validation, error display |
| Form Submission | [form-submission.md](05-form-patterns/form-submission.md) | Submit handlers, loading states |
| Multi-step Forms | [multi-step-forms.md](05-form-patterns/multi-step-forms.md) | Wizard pattern, step tracking |
| File Upload Forms | [file-upload-forms.md](05-form-patterns/file-upload-forms.md) | Image upload, Convex storage |
| Dynamic Fields | [dynamic-fields.md](05-form-patterns/dynamic-fields.md) | Add/remove fields, arrays |

### 06 — Data Fetching (4 patterns)
| Pattern | File | Description |
|---------|------|-------------|
| useQuery Patterns | [usequery-patterns.md](06-data-fetching/usequery-patterns.md) | Convex useQuery, skip, loading |
| useMutation Patterns | [usemutation-patterns.md](06-data-fetching/usemutation-patterns.md) | Convex useMutation, optimistic |
| Pagination Patterns | [pagination-patterns.md](06-data-fetching/pagination-patterns.md) | Cursor-based pagination |
| Caching Strategies | [caching-strategies.md](06-data-fetching/caching-strategies.md) | Convex real-time cache |

### 07 — Error Handling (5 patterns)
| Pattern | File | Description |
|---------|------|-------------|
| Error Boundaries | [error-boundaries.md](07-error-handling/error-boundaries.md) | RouteBoundary, AIErrorBoundary |
| Error Messages | [error-messages.md](07-error-handling/error-messages.md) | User-friendly error copy |
| Retry Logic | [retry-logic.md](07-error-handling/retry-logic.md) | Exponential backoff, retry buttons |
| Error Logging | [error-logging.md](07-error-handling/error-logging.md) | Sentry integration, error capture |
| Resilience Patterns | [resilience-patterns.md](07-error-handling/resilience-patterns.md) | Circuit breakers, retry with backoff, fallbacks |

### 08 — Testing Patterns (5 patterns)
| Pattern | File | Description |
|---------|------|-------------|
| Unit Testing | [unit-testing.md](08-testing-patterns/unit-testing.md) | Jest, fast-check, jest-axe setup |
| Component Testing | [component-testing.md](08-testing-patterns/component-testing.md) | RTL, context wrappers, snapshots |
| Integration Testing | [integration-testing.md](08-testing-patterns/integration-testing.md) | Service orchestration, mock DBs |
| E2E Testing | [e2e-testing.md](08-testing-patterns/e2e-testing.md) | Playwright, 5 browser projects |
| Test Utilities | [test-utilities.md](08-testing-patterns/test-utilities.md) | Mock factories, arbitraries |

### 09 — Custom Hooks (11 patterns)
| Pattern | File | Description |
|---------|------|-------------|
| useAuth | [use-auth.md](09-hooks/use-auth.md) | Auth state, current user |
| useSubscription | [use-subscription.md](09-hooks/use-subscription.md) | Subscription tier, Convex query |
| useToast | [use-toast.md](09-hooks/use-toast.md) | Toast notifications hook |
| useLocalStorage | [use-local-storage.md](09-hooks/use-local-storage.md) | Persistent state hook |
| useDebounce | [use-debounce.md](09-hooks/use-debounce.md) | Debounced value hook |
| useMediaQuery | [use-media-query.md](09-hooks/use-media-query.md) | Responsive breakpoint hook |
| useAuthWithRecaptcha | [use-auth-with-recaptcha.md](09-hooks/use-auth-with-recaptcha.md) | Auth with reCAPTCHA verification |
| useFreemium | [use-freemium.md](09-hooks/use-freemium.md) | Freemium tier logic, usage metering |
| useIntersectionObserver | [use-intersection-observer.md](09-hooks/use-intersection-observer.md) | Intersection Observer API hook |
| useSwipeGesture | [use-swipe-gesture.md](09-hooks/use-swipe-gesture.md) | Touch swipe gesture detection |
| useTierGates | [use-tier-gates.md](09-hooks/use-tier-gates.md) | Subscription tier gating hook |

### 10 — Utilities (5 patterns)
| Pattern | File | Description |
|---------|------|-------------|
| Date Formatting | [date-formatting.md](10-utilities/date-formatting.md) | Date display, relative time |
| String Utilities | [string-utilities.md](10-utilities/string-utilities.md) | Truncation, slugify, capitalize |
| Number Formatting | [number-formatting.md](10-utilities/number-formatting.md) | Currency, percentages |
| Validation Helpers | [validation-helpers.md](10-utilities/validation-helpers.md) | Email, URL, input validators |
| Array Utilities | [array-utilities.md](10-utilities/array-utilities.md) | Grouping, sorting, deduplication |

### 11 — Validation (5 patterns)
| Pattern | File | Description |
|---------|------|-------------|
| Convex Validators | [convex-validators.md](11-validation/convex-validators.md) | v.string(), v.union(), v.id() |
| Client Validation | [client-validation.md](11-validation/client-validation.md) | Form field validation |
| Schema Validation | [schema-validation.md](11-validation/schema-validation.md) | Zod schemas |
| Business Rules | [business-rules.md](11-validation/business-rules.md) | Domain logic validation |
| Rate Limiting | [rate-limiting.md](11-validation/rate-limiting.md) | Rate limiter, throttling, abuse prevention |

### 12 — Routing (3 patterns)
| Pattern | File | Description |
|---------|------|-------------|
| Route Structure | [route-structure.md](12-routing/route-structure.md) | State-based routing, 45+ views |
| Navigation Patterns | [navigation-patterns.md](12-routing/navigation-patterns.md) | Intent-based nav, handleTabChange |
| Protected Routes | [protected-routes.md](12-routing/protected-routes.md) | Auth guards, tier gates |

### 13 — State Management (4 patterns)
| Pattern | File | Description |
|---------|------|-------------|
| Context Patterns | [context-patterns.md](13-state-management/context-patterns.md) | SettingsContext, createContext |
| Global State | [global-state.md](13-state-management/global-state.md) | App-level state in App.tsx |
| Local State | [local-state.md](13-state-management/local-state.md) | Component-level useState |
| State Persistence | [state-persistence.md](13-state-management/state-persistence.md) | localStorage sync patterns |

### 14 — Performance (4 patterns)
| Pattern | File | Description |
|---------|------|-------------|
| Code Splitting | [code-splitting.md](14-performance/code-splitting.md) | React.lazy, dynamic imports |
| Image Optimization | [image-optimization.md](14-performance/image-optimization.md) | Lazy loading, WebP, CDN |
| Bundle Optimization | [bundle-optimization.md](14-performance/bundle-optimization.md) | Vite chunks, tree shaking |
| Render Optimization | [render-optimization.md](14-performance/render-optimization.md) | Virtualization, memo, batching |

### 15 — Accessibility (4 patterns)
| Pattern | File | Description |
|---------|------|-------------|
| ARIA Patterns | [aria-patterns.md](15-accessibility/aria-patterns.md) | aria-label, aria-live, roles |
| Keyboard Navigation | [keyboard-navigation.md](15-accessibility/keyboard-navigation.md) | tabIndex, onKeyDown, focus trap |
| Screen Reader | [screen-reader.md](15-accessibility/screen-reader.md) | sr-only, alt text, announcements |
| WCAG Compliance | [wcag-compliance.md](15-accessibility/wcag-compliance.md) | Contrast, touch targets, jest-axe |

### 16 — Deployment (3 patterns)
| Pattern | File | Description |
|---------|------|-------------|
| Build Process | [build-process.md](16-deployment/build-process.md) | Vite config, env vars, scripts |
| Deployment Config | [deployment-config.md](16-deployment/deployment-config.md) | Vercel, Convex, GitHub Actions |
| Release Checklist | [release-checklist.md](16-deployment/release-checklist.md) | Pre/post deploy, rollback |

### Nova26 Adaptations (12 patterns)
| Pattern | File | Description |
|---------|------|-------------|
| Security Enforcement | [nova26-security-enforcement.md](01-security/nova26-security-enforcement.md) | Agent output security scanning |
| Steering Architecture | [nova26-steering-architecture.md](02-steering-system/nova26-steering-architecture.md) | Agent context management |
| Expanded Quality Gates | [nova26-expanded-gates.md](03-quality-gates/nova26-expanded-gates.md) | Extended validation gates |
| Code Governance | [nova26-code-governance.md](04-code-governance/nova26-code-governance.md) | Code generation governance |
| Convex Improvements | [nova26-convex-improvements.md](05-database-patterns/nova26-convex-improvements.md) | Database pattern improvements |
| Cost Protection | [nova26-cost-protection.md](06-cost-protection/nova26-cost-protection.md) | LLM cost management |
| Test Plan | [nova26-test-plan.md](07-testing-strategies/nova26-test-plan.md) | Testing strategy for Nova26 |
| Accessibility Rules | [nova26-accessibility-rules.md](08-design-system/nova26-accessibility-rules.md) | WCAG compliance rules |
| Error Patterns | [nova26-error-patterns.md](09-error-handling/nova26-error-patterns.md) | Error handling patterns |
| Prompt Improvements | [nova26-prompt-improvements.md](15-ai-prompts/nova26-prompt-improvements.md) | AI prompt engineering |
| Enhanced PRD Format | [enhanced-prd-format.md](17-nova26-adaptations/enhanced-prd-format.md) | Structured PRD v2 template |

---

## Most Used Patterns

These patterns appear in nearly every feature built in BistroLens:

1. **[useQuery Patterns](06-data-fetching/usequery-patterns.md)** — Every data-reading component uses Convex useQuery with the skip pattern
2. **[useMutation Patterns](06-data-fetching/usemutation-patterns.md)** — Every write operation uses Convex useMutation
3. **[Context Patterns](13-state-management/context-patterns.md)** — SettingsContext wraps almost every component
4. **[Component Structure](02-react-patterns/component-structure.md)** — Standard React component patterns used everywhere
5. **[Form Validation](05-form-patterns/form-validation.md)** — Every form uses this validation approach
6. **[Error Boundaries](07-error-handling/error-boundaries.md)** — RouteBoundary wraps every view
7. **[Loading States](04-ui-components/loading-states.md)** — Every async operation shows a loading state
8. **[Toast Notifications](04-ui-components/toast-notifications.md)** — User feedback for every action
9. **[Auth Helpers](03-auth-patterns/auth-helpers.md)** — Auth check before every protected action
10. **[Subscription Enforcement](03-auth-patterns/subscription-enforcement.md)** — Tier gates on premium features

---

## By Use Case

### Building a New Feature Page

1. [Route Structure](12-routing/route-structure.md) — Add view to App.tsx switch
2. [Component Structure](02-react-patterns/component-structure.md) — Create the component
3. [useQuery Patterns](06-data-fetching/usequery-patterns.md) — Fetch data
4. [Loading States](04-ui-components/loading-states.md) — Handle loading
5. [Error Boundaries](07-error-handling/error-boundaries.md) — Handle errors
6. [Empty States](04-ui-components/empty-states.md) — Handle empty data

### Adding a Form

1. [Form Validation](05-form-patterns/form-validation.md) — Validate inputs
2. [Form Submission](05-form-patterns/form-submission.md) — Handle submit
3. [useMutation Patterns](06-data-fetching/usemutation-patterns.md) — Save to Convex
4. [Toast Notifications](04-ui-components/toast-notifications.md) — Confirm success
5. [Error Messages](07-error-handling/error-messages.md) — Show errors

### Adding Auth Protection

1. [Auth Helpers](03-auth-patterns/auth-helpers.md) — Check auth state
2. [Protected Routes](12-routing/protected-routes.md) — Guard the route
3. [Session Management](03-auth-patterns/session-management.md) — Persist session
4. [Subscription Enforcement](03-auth-patterns/subscription-enforcement.md) — Gate by tier

### Writing Tests

1. [Unit Testing](08-testing-patterns/unit-testing.md) — Test utilities and logic
2. [Component Testing](08-testing-patterns/component-testing.md) — Test React components
3. [Test Utilities](08-testing-patterns/test-utilities.md) — Mock factories, render helpers
4. [Integration Testing](08-testing-patterns/integration-testing.md) — Test service chains
5. [E2E Testing](08-testing-patterns/e2e-testing.md) — Test critical user flows

### Optimizing Performance

1. [Code Splitting](14-performance/code-splitting.md) — Lazy load views
2. [Render Optimization](14-performance/render-optimization.md) — Memo, virtualization
3. [Bundle Optimization](14-performance/bundle-optimization.md) — Chunk splitting
4. [Image Optimization](14-performance/image-optimization.md) — Lazy images, WebP
5. [Performance Optimization](01-convex-patterns/performance-optimization.md) — Query efficiency

### Making a Component Accessible

1. [ARIA Patterns](15-accessibility/aria-patterns.md) — Add ARIA attributes
2. [Keyboard Navigation](15-accessibility/keyboard-navigation.md) — Keyboard support
3. [Screen Reader](15-accessibility/screen-reader.md) — sr-only text, announcements
4. [WCAG Compliance](15-accessibility/wcag-compliance.md) — Contrast, touch targets

### Deploying a Release

1. [Build Process](16-deployment/build-process.md) — Build and verify
2. [Deployment Config](16-deployment/deployment-config.md) — Vercel + Convex deploy
3. [Release Checklist](16-deployment/release-checklist.md) — Pre/post deploy steps

---

## Pattern Relationships

```
Data Flow:
  Schema Conventions → Query Patterns → useQuery Patterns → Component Structure
  Schema Conventions → Mutation Patterns → useMutation Patterns → Form Submission

Auth Flow:
  Auth Helpers → Session Management → Protected Routes → Subscription Enforcement

UI Flow:
  Component Structure → Loading States → Empty States → Error States
  Form Components → Form Validation → Form Submission → Toast Notifications

Testing Flow:
  Test Utilities → Unit Testing → Component Testing → Integration Testing → E2E Testing

Performance Flow:
  Code Splitting → Bundle Optimization → Render Optimization → Image Optimization

Accessibility Flow:
  ARIA Patterns → Keyboard Navigation → Screen Reader → WCAG Compliance
```

---

## Tech Stack Reference

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS |
| Backend | Convex (serverless, real-time) |
| Auth | Convex Auth (Google, GitHub OAuth) |
| Payments | Stripe |
| AI | Google Gemini |
| Testing | Jest, React Testing Library, fast-check, Playwright |
| Build | Vite 5 |
| Deploy | Vercel (frontend) + Convex (backend) |
| Monitoring | Sentry |

---

*Total Patterns: 100 across 17 categories*
*Last Updated: 2026-02-18*
