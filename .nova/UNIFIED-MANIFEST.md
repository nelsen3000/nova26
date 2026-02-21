# Unified Pattern Manifest

A comprehensive catalog of all patterns extracted across both knowledge bases in the NOVA26 project.
This manifest provides a single point of discovery for every documented pattern, organized by knowledge base and category.

**Total Patterns:** 140
**BistroLens Patterns:** 89
**Nova26 Patterns:** 51

---

## Pattern Table

### BistroLens Knowledge Base

#### 01-convex-patterns: Convex Patterns

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Convex File Storage Hook | Convex Patterns | BistroLens | bistrolens-knowledge/01-convex-patterns/convex-file-storage.md | Dedicated useConvexFileStorage hook that wraps Convex's generateUploadUrl and getUrl mutations into a reusable interf... |
| Error Handling | Convex Patterns | BistroLens | bistrolens-knowledge/01-convex-patterns/error-handling.md | Proper error handling ensures users get clear feedback and developers can debug issues quickly. |
| File Storage Patterns | Convex Patterns | BistroLens | bistrolens-knowledge/01-convex-patterns/file-storage-patterns.md | Convex provides built-in file storage with automatic CDN distribution. Files are stored in _storage and referenced by... |
| Migration Procedures | Convex Patterns | BistroLens | bistrolens-knowledge/01-convex-patterns/migration-procedures.md | Convex schemas are flexible, but production migrations require careful planning to avoid data loss or downtime. |
| Convex Mutation Patterns | Convex Patterns | BistroLens | bistrolens-knowledge/01-convex-patterns/mutation-patterns.md | export const createRecipe = mutation({ |
| Optimistic Mutation Pattern | Convex Patterns | BistroLens | bistrolens-knowledge/01-convex-patterns/optimistic-mutation-pattern.md | Optimistic mutations update local UI state immediately before the server confirms, giving instant feedback. Convex's ... |
| Performance Optimization | Convex Patterns | BistroLens | bistrolens-knowledge/01-convex-patterns/performance-optimization.md | Optimize queries, mutations, and subscriptions for fast, scalable applications. |
| Convex Query Patterns | Convex Patterns | BistroLens | bistrolens-knowledge/01-convex-patterns/query-patterns.md | export const listUserRecipes = query({ |
| Real-Time Subscriptions | Convex Patterns | BistroLens | bistrolens-knowledge/01-convex-patterns/real-time-subscriptions.md | Convex provides automatic real-time updates through useQuery. When data changes on the server, all subscribed clients... |
| Convex Schema Conventions | Convex Patterns | BistroLens | bistrolens-knowledge/01-convex-patterns/schema-conventions.md | Every table MUST include these fields: |
| Soft Delete Pattern | Convex Patterns | BistroLens | bistrolens-knowledge/01-convex-patterns/soft-delete-pattern.md | BistroLens never hard-deletes records. All deletes set deletedAt timestamp and isDeleted: true, enabling audit trails... |

#### 02-react-patterns: React Patterns

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Component Structure Patterns | React Patterns | BistroLens | bistrolens-knowledge/02-react-patterns/component-structure.md | BistroLens uses a consistent structure for all React components: a TypeScript interface for props, a React.FC<Props> ... |
| Effect Patterns | React Patterns | BistroLens | bistrolens-knowledge/02-react-patterns/effect-patterns.md | BistroLens uses useEffect for side effects like event listeners, timers, and data fetching — always with proper clean... |
| Error Boundary Patterns | React Patterns | BistroLens | bistrolens-knowledge/02-react-patterns/error-boundaries.md | BistroLens implements a single ErrorBoundary class component that handles errors at different severity levels (compon... |
| Memo Optimization Patterns | React Patterns | BistroLens | bistrolens-knowledge/02-react-patterns/memo-optimization.md | BistroLens uses useMemo to avoid recomputing expensive derived values on every render, and useCallback to stabilize f... |
| State Management Patterns | React Patterns | BistroLens | bistrolens-knowledge/02-react-patterns/state-management.md | BistroLens uses useState extensively with TypeScript generics and lazy initializers for expensive computations. |
| Suspense Patterns | React Patterns | BistroLens | bistrolens-knowledge/02-react-patterns/suspense-patterns.md | BistroLens lazy-loads virtually every page-level and modal component using React.lazy() + Suspense. This keeps the in... |

#### 03-auth-patterns: Auth Patterns

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Age Verification Pattern | Auth Patterns | BistroLens | bistrolens-knowledge/03-auth-patterns/age-verification.md | Age verification is a critical compliance pattern that ensures users meet legal drinking age requirements before acce... |
| Auth Helpers | Auth Patterns | BistroLens | bistrolens-knowledge/03-auth-patterns/auth-helpers.md | Create reusable helper functions for common auth checks to keep code DRY and consistent. |
| RBAC Implementation | Auth Patterns | BistroLens | bistrolens-knowledge/03-auth-patterns/rbac-implementation.md | Implement hierarchical role-based access control with permission matrices and server-side enforcement. This pattern e... |
| Session Management | Auth Patterns | BistroLens | bistrolens-knowledge/03-auth-patterns/session-management.md | Secure session handling with automatic refresh, concurrent session limits, and proper invalidation on security events... |
| Subscription Tier Enforcement | Auth Patterns | BistroLens | bistrolens-knowledge/03-auth-patterns/subscription-enforcement.md | Enforce subscription tier limits and feature access both client-side (for UX) and server-side (for security). This pa... |
| Subscription Service | Auth Patterns | BistroLens | bistrolens-knowledge/03-auth-patterns/subscription-service.md | The subscription service layer manages Stripe subscription lifecycle: creation, upgrades, downgrades, cancellations, ... |

#### 04-ui-components: Ui Components

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Button Variants Pattern | Ui Components | BistroLens | bistrolens-knowledge/04-ui-components/button-variants.md | A flexible button component system using class-variance-authority (CVA) to manage multiple visual variants and sizes.... |
| Card Layout Patterns | Ui Components | BistroLens | bistrolens-knowledge/04-ui-components/card-layouts.md | Cards are versatile container components that group related content and actions. BistroLens implements multiple card ... |
| Empty State Patterns | Ui Components | BistroLens | bistrolens-knowledge/04-ui-components/empty-states.md | Empty states communicate to users when there's no content to display, providing context and often suggesting next act... |
| Error States | Ui Components | BistroLens | bistrolens-knowledge/04-ui-components/error-states.md | Error states in BistroLens follow a user-first philosophy: never blame the user, always provide an action, and use hu... |
| Form Components Pattern | Ui Components | BistroLens | bistrolens-knowledge/04-ui-components/form-components.md | A collection of reusable form components built with React forwardRef, consistent Tailwind styling, and accessibility ... |
| Loading States | Ui Components | BistroLens | bistrolens-knowledge/04-ui-components/loading-states.md | Loading states provide visual feedback during asynchronous operations. BistroLens implements multiple loading pattern... |
| Modal/Dialog Patterns | Ui Components | BistroLens | bistrolens-knowledge/04-ui-components/modal-dialog.md | A flexible, accessible modal component that handles overlay, focus trapping, keyboard navigation, and body scroll loc... |
| Toast Notification Patterns | Ui Components | BistroLens | bistrolens-knowledge/04-ui-components/toast-notifications.md | components/Toast.tsx - Simple toast with action button |

#### 05-form-patterns: Form Patterns

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Dynamic Form Fields Patterns | Form Patterns | BistroLens | bistrolens-knowledge/05-form-patterns/dynamic-fields.md | Dynamic form fields allow users to add or remove input fields at runtime, commonly used for lists of items, multiple ... |
| File Upload Form Patterns | Form Patterns | BistroLens | bistrolens-knowledge/05-form-patterns/file-upload-forms.md | Comprehensive file upload patterns including file selection, FileReader API usage, image preview, and processing work... |
| Form Submission Patterns | Form Patterns | BistroLens | bistrolens-knowledge/05-form-patterns/form-submission.md | Comprehensive form submission patterns with loading states, error handling, success feedback, and security verification. |
| Form Validation Patterns | Form Patterns | BistroLens | bistrolens-knowledge/05-form-patterns/form-validation.md | Comprehensive form validation patterns using React state, inline validation functions, and real-time error feedback. |
| Multi-Step Form Patterns | Form Patterns | BistroLens | bistrolens-knowledge/05-form-patterns/multi-step-forms.md | Multi-step forms (wizards) break complex forms into manageable steps with progress tracking, navigation, and state ma... |

#### 06-data-fetching: Data Fetching

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Caching Strategies | Data Fetching | BistroLens | bistrolens-knowledge/06-data-fetching/caching-strategies.md | Convex provides automatic caching and real-time updates through its reactive query system. Queries are cached client-... |
| Pagination Patterns | Data Fetching | BistroLens | bistrolens-knowledge/06-data-fetching/pagination-patterns.md | convex/social.ts (cursor-based pagination) |
| useMutation Patterns | Data Fetching | BistroLens | bistrolens-knowledge/06-data-fetching/usemutation-patterns.md | The useMutation hook from Convex React enables you to call server-side mutations (write operations) from your React c... |
| useQuery Patterns | Data Fetching | BistroLens | bistrolens-knowledge/06-data-fetching/usequery-patterns.md | The useQuery hook from Convex provides real-time reactive data fetching with automatic caching, subscriptions, and lo... |

#### 07-error-handling: Error Handling

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Error Boundaries | Error Handling | BistroLens | bistrolens-knowledge/07-error-handling/error-boundaries.md | A comprehensive error boundary implementation that provides graceful error handling at multiple levels (critical, pag... |
| Error Logging Patterns | Error Handling | BistroLens | bistrolens-knowledge/07-error-handling/error-logging.md | BistroLens uses a singleton ErrorLogger class that captures, stores, and reports errors with rich context. Errors are... |
| Error Messages | Error Handling | BistroLens | bistrolens-knowledge/07-error-handling/error-messages.md | Error messages should be clear, actionable, and never blame the user. They should use plain language, provide context... |
| Resilience Patterns | Error Handling | BistroLens | bistrolens-knowledge/07-error-handling/resilience-patterns.md | Resilience patterns for BistroLens: exponential backoff retry, circuit breaker state machine, and graceful degradatio... |
| Retry Logic Patterns | Error Handling | BistroLens | bistrolens-knowledge/07-error-handling/retry-logic.md | utils/resilience.ts - Generic retry wrapper with exponential backoff |

#### 08-testing-patterns: Testing Patterns

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Component Testing Patterns | Testing Patterns | BistroLens | bistrolens-knowledge/08-testing-patterns/component-testing.md | BistroLens tests React components with React Testing Library (RTL) and Jest in a jsdom environment. The philosophy is... |
| E2E Testing Patterns | Testing Patterns | BistroLens | bistrolens-knowledge/08-testing-patterns/e2e-testing.md | BistroLens uses Playwright for E2E testing. Tests live in tests/e2e/ and cover smoke tests, analytics event verificat... |
| Integration Testing Patterns | Testing Patterns | BistroLens | bistrolens-knowledge/08-testing-patterns/integration-testing.md | BistroLens uses Jest + ts-jest as its test runner. Integration tests live in the tests/ directory (top-level) and in ... |
| Test Utilities Patterns | Testing Patterns | BistroLens | bistrolens-knowledge/08-testing-patterns/test-utilities.md | BistroLens uses Jest + React Testing Library + fast-check for testing. |
| Unit Testing Patterns | Testing Patterns | BistroLens | bistrolens-knowledge/08-testing-patterns/unit-testing.md | BistroLens uses Jest (not Vitest) as its test runner, with ts-jest for TypeScript transformation and React Testing Li... |

#### 09-hooks: Hooks

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| useAuth Hook Pattern | Hooks | BistroLens | bistrolens-knowledge/09-hooks/useAuth.md | A comprehensive React hook that manages authentication state and provides secure signup/signin methods with built-in ... |
| useAuthWithRecaptcha | Hooks | BistroLens | bistrolens-knowledge/09-hooks/useAuthWithRecaptcha.md | useAuthWithRecaptcha wraps Clerk's useSignIn/useSignUp with Google reCAPTCHA v3 token generation. Tokens are verified... |
| useDebounce Hook | Hooks | BistroLens | bistrolens-knowledge/09-hooks/useDebounce.md | Debouncing delays the execution of a function until after a specified time has passed since the last invocation. Bist... |
| useFreemium | Hooks | BistroLens | bistrolens-knowledge/09-hooks/useFreemium.md | useFreemium tracks usage against free tier limits and surfaces upgrade prompts at the right moment. Handles usage cou... |
| useIntersectionObserver | Hooks | BistroLens | bistrolens-knowledge/09-hooks/useIntersectionObserver.md | useIntersectionObserver wraps the browser's IntersectionObserver API for lazy loading images, triggering infinite scr... |
| Safe LocalStorage Pattern | Hooks | BistroLens | bistrolens-knowledge/09-hooks/useLocalStorage.md | BistroLens implements a robust localStorage wrapper that handles quota exceeded errors, security exceptions, and auto... |
| useMediaQuery Hook | Hooks | BistroLens | bistrolens-knowledge/09-hooks/useMediaQuery.md | A custom React hook that listens to viewport changes and returns boolean values for responsive design decisions. Bist... |
| useSubscription Hook | Hooks | BistroLens | bistrolens-knowledge/09-hooks/useSubscription.md | A custom React hook that manages user subscription state with localStorage caching, automatic refresh, and optimistic... |
| useSwipeGesture | Hooks | BistroLens | bistrolens-knowledge/09-hooks/useSwipeGesture.md | useSwipeGesture detects horizontal and vertical swipe gestures on touch devices. Used for mobile navigation, dismissi... |
| useTierGates | Hooks | BistroLens | bistrolens-knowledge/09-hooks/useTierGates.md | useTierGates provides client-side subscription tier checking for feature gating. Returns helper functions to check if... |
| useToast Hook Pattern | Hooks | BistroLens | bistrolens-knowledge/09-hooks/useToast.md | A comprehensive React hook that manages toast notifications with support for multiple severity levels, auto-dismiss t... |

#### 10-utilities: Utilities

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Array Utilities | Utilities | BistroLens | bistrolens-knowledge/10-utilities/array-utilities.md | BistroLens uses native JavaScript array methods throughout — no lodash or utility libraries. Patterns cover filtering... |
| Date Formatting Patterns | Utilities | BistroLens | bistrolens-knowledge/10-utilities/date-formatting.md | BistroLens uses native JavaScript Date APIs for all date formatting — no external date libraries (no dayjs, no moment... |
| Number Formatting Patterns | Utilities | BistroLens | bistrolens-knowledge/10-utilities/number-formatting.md | BistroLens uses native JavaScript number methods for all formatting — no external libraries. Patterns cover currency,... |
| String Utilities | Utilities | BistroLens | bistrolens-knowledge/10-utilities/string-utilities.md | BistroLens uses a set of focused string utilities for normalization, sanitization, slug generation, and content filte... |
| Validation Helpers | Utilities | BistroLens | bistrolens-knowledge/10-utilities/validation-helpers.md | BistroLens uses a layered validation approach: Convex validators for schema-level type safety, security guard functio... |

#### 11-validation: Validation

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Business Rules Validation Patterns | Validation | BistroLens | bistrolens-knowledge/11-validation/business-rules.md | Business rules validation enforces domain-specific constraints and policies in your application. Unlike schema valida... |
| Client-Side Validation | Validation | BistroLens | bistrolens-knowledge/11-validation/client-validation.md | BistroLens validates form inputs on the client before submitting to the server. Validation functions return booleans,... |
| Convex Validators | Validation | BistroLens | bistrolens-knowledge/11-validation/convex-validators.md | BistroLens uses Convex's built-in v validator library to define type-safe schemas and mutation arguments. Validators ... |
| Rate Limiting | Validation | BistroLens | bistrolens-knowledge/11-validation/rate-limiting.md | Server-side rate limiting in Convex mutations using a sliding window counter stored in the database. Prevents API abu... |
| Schema Validation with Zod | Validation | BistroLens | bistrolens-knowledge/11-validation/schema-validation.md | Zod provides runtime type validation with automatic TypeScript type inference. Use Zod schemas to validate user input... |

#### 12-routing: Routing

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Navigation Patterns | Routing | BistroLens | bistrolens-knowledge/12-routing/navigation-patterns.md | BistroLens organizes navigation around user goals (intents), not feature names. The IntentNavigation component maps i... |
| Protected Routes | Routing | BistroLens | bistrolens-knowledge/12-routing/protected-routes.md | BistroLens does not use a PrivateRoute wrapper component. Instead, auth protection is applied inline at the point of ... |
| Route Structure | Routing | BistroLens | bistrolens-knowledge/12-routing/route-structure.md | BistroLens uses a custom state-based routing system instead of React Router. Navigation is managed via a currentView ... |

#### 13-state-management: State Management

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Context Patterns | State Management | BistroLens | bistrolens-knowledge/13-state-management/context-patterns.md | BistroLens uses a minimal contexts.ts file to define typed React contexts, then provides them at the app root. The co... |
| Global State Patterns | State Management | BistroLens | bistrolens-knowledge/13-state-management/global-state.md | BistroLens manages global state through a combination of React Context (for settings) and custom hooks that encapsula... |
| Local State Patterns | State Management | BistroLens | bistrolens-knowledge/13-state-management/local-state.md | BistroLens uses local useState for UI state that doesn't need to be shared, and useMemo/useCallback to avoid expensiv... |
| State Persistence Patterns | State Management | BistroLens | bistrolens-knowledge/13-state-management/state-persistence.md | BistroLens uses a two-tier persistence strategy: |

#### 14-performance: Performance

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Bundle Optimization Patterns | Performance | BistroLens | bistrolens-knowledge/14-performance/bundle-optimization.md | BistroLens uses Vite with a minimal but effective build config: chunk size warnings at 500KB, build metadata injectio... |
| Code Splitting Patterns | Performance | BistroLens | bistrolens-knowledge/14-performance/code-splitting.md | BistroLens lazy-loads every non-critical component using React.lazy + Suspense. A custom createLazyComponent utility ... |
| Image Optimization Patterns | Performance | BistroLens | bistrolens-knowledge/14-performance/image-optimization.md | BistroLens uses a multi-layered image strategy: |
| Render Optimization Patterns | Performance | BistroLens | bistrolens-knowledge/14-performance/render-optimization.md | BistroLens prevents unnecessary re-renders through three complementary techniques: |

#### 15-accessibility: Accessibility

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| ARIA Patterns | Accessibility | BistroLens | bistrolens-knowledge/15-accessibility/aria-patterns.md | Icon-only buttons must have aria-label so screen readers announce the action. |
| Keyboard Navigation Patterns | Accessibility | BistroLens | bistrolens-knowledge/15-accessibility/keyboard-navigation.md | Allow users to submit forms or add items by pressing Enter in a text field — no mouse required. |
| Screen Reader Patterns | Accessibility | BistroLens | bistrolens-knowledge/15-accessibility/screen-reader.md | Visually hidden text gives screen readers a meaningful label when the visible UI is icon-only. |
| WCAG Compliance Patterns | Accessibility | BistroLens | bistrolens-knowledge/15-accessibility/wcag-compliance.md | Normal text requires a 4.5:1 contrast ratio; large text and UI components require 3:1. |

#### 16-deployment: Deployment

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Build Process | Deployment | BistroLens | bistrolens-knowledge/16-deployment/build-process.md | BistroLens uses Vite 5 as its build tool with React 19, TypeScript, and automatic environment variable injection. The... |
| Deployment Configuration | Deployment | BistroLens | bistrolens-knowledge/16-deployment/deployment-config.md | BistroLens deploys the frontend SPA to Vercel and the backend to Convex. Vercel handles routing, caching headers, and... |
| Release Checklist | Deployment | BistroLens | bistrolens-knowledge/16-deployment/release-checklist.md | BistroLens follows a staged release process: staging validation → manual production approval → post-deploy monitoring... |

### Nova26 Knowledge Base

#### 01-orchestration: Orchestration

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Agent Schema Registry | Orchestration | Nova26 | nova26-patterns/01-orchestration/agent-schema-registry.md | Every Nova26 agent has a Zod schema defining the expected structure of its output. The AgentSchemas registry maps age... |
| Council Consensus Voting | Orchestration | Nova26 | nova26-patterns/01-orchestration/council-consensus-voting.md | The LLM Council runs multiple specialized agents (ARCHITECT, REVIEWER, IMPLEMENTER) to vote on critical task outputs.... |
| Event Store | Orchestration | Nova26 | nova26-patterns/01-orchestration/event-store.md | The Event Store implements an append-only, event-sourced durable session log. Every agent action — task starts, LLM c... |
| Gate Runner Pipeline | Orchestration | Nova26 | nova26-patterns/01-orchestration/gate-runner-pipeline.md | The gate runner validates LLM responses before they are accepted. It runs hard limits first (non-negotiable constrain... |
| Parallel Task Runner | Orchestration | Nova26 | nova26-patterns/01-orchestration/parallel-task-runner.md | The ParallelRunner executes independent tasks concurrently using Promise.all with a configurable concurrency limit. T... |
| Prompt Builder with Dependency Injection | Orchestration | Nova26 | nova26-patterns/01-orchestration/prompt-builder-dependency-injection.md | The prompt builder constructs agent prompts by combining three layers: a system prompt loaded from the agent's markdo... |
| Ralph Loop Execution Pattern | Orchestration | Nova26 | nova26-patterns/01-orchestration/ralph-loop-execution.md | The Ralph Loop is Nova26's core execution engine. It processes a PRD (Product Requirements Document) by iterating ove... |
| Task Picker | Orchestration | Nova26 | nova26-patterns/01-orchestration/task-picker.md | The Task Picker selects the next task to execute from a PRD's task list. It filters for "ready" tasks, sorts by phase... |
| Test → Fix → Retest Loop | Orchestration | Nova26 | nova26-patterns/01-orchestration/test-fix-retest-loop.md | After code-producing agents (MARS, VENUS, PLUTO, GANYMEDE, IO, TRITON) complete a task, the test-fix loop automatical... |
| Todo Tracking System | Orchestration | Nova26 | nova26-patterns/01-orchestration/todo-tracking-system.md | Complex tasks get broken into TodoItem sub-steps that are tracked through pending → in_progress → completed states. O... |

#### 02-agent-system: Agent System

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Agent Explanations | Agent System | Nova26 | nova26-patterns/02-agent-system/agent-explanations.md | The Agent Explanations pattern provides multi-level, human-readable descriptions of what each agent is doing and why.... |
| Agent Loader | Agent System | Nova26 | nova26-patterns/02-agent-system/agent-loader.md | The Agent Loader pattern provides a cached, file-based mechanism for loading agent prompt templates from the .nova/ag... |
| ATLAS Convex Integration | Agent System | Nova26 | nova26-patterns/02-agent-system/atlas-convex.md | The ATLAS Convex Integration pattern provides a typed facade over the Convex backend for build tracking, task logging... |
| Convex Client | Agent System | Nova26 | nova26-patterns/02-agent-system/convex-client.md | The Convex Client pattern provides a minimal HTTP wrapper around the Convex API with typed query/mutation methods, a ... |
| PRD Generator | Agent System | Nova26 | nova26-patterns/02-agent-system/prd-generator.md | The PRD Generator pattern uses the SUN agent to convert a natural language project description into a structured Prod... |

#### 02-intelligence: Intelligence

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Checkpoint System | Intelligence | Nova26 | nova26-patterns/02-intelligence/checkpoint-system.md | SQLite-backed checkpoint system saves build state every 30 seconds (auto-save) and after each task. On crash or resta... |
| Langfuse Tracing Integration | Intelligence | Nova26 | nova26-patterns/02-intelligence/langfuse-tracing.md | NovaTracer wraps Langfuse to provide structured observability for Ralph Loop executions. Traces LLM calls, gate resul... |
| LLM Response Cache | Intelligence | Nova26 | nova26-patterns/02-intelligence/llm-response-cache.md | SQLite-backed cache for LLM responses. Identical prompts (same content + model + temperature) return cached results i... |
| Model Router with Fallback Chains | Intelligence | Nova26 | nova26-patterns/02-intelligence/model-router-fallback-chains.md | The model router selects the appropriate LLM based on tier (free/paid/hybrid) and task complexity, then automatically... |
| Static Security Scanner | Intelligence | Nova26 | nova26-patterns/02-intelligence/security-scanner.md | SecurityScanner performs static analysis on the codebase before deployment. Detects secrets, SQL injection, XSS, path... |
| Session Memory with Relevance Ranking | Intelligence | Nova26 | nova26-patterns/02-intelligence/session-memory-relevance.md | session-memory.ts provides cross-session persistent memory stored in .nova/memory/session-memory.json. Memories are r... |
| Smart Retry with Escalation | Intelligence | Nova26 | nova26-patterns/02-intelligence/smart-retry-escalation.md | SmartRetrySystem classifies errors and applies escalating strategies across retries: same model with error context → ... |

#### 03-quality-gates: Quality Gates

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Piston Client | Quality Gates | Nova26 | nova26-patterns/03-quality-gates/piston-client.md | The Piston client provides a typed HTTP wrapper around the self-hosted Piston code execution API. It manages runtime ... |
| Test Runner Gate | Quality Gates | Nova26 | nova26-patterns/03-quality-gates/test-runner-gate.md | The test runner gate performs smoke tests on LLM-generated code by wrapping extracted code blocks in try-catch harnes... |
| TypeScript Gate | Quality Gates | Nova26 | nova26-patterns/03-quality-gates/typescript-gate.md | The TypeScript gate validates code blocks in LLM responses by extracting fenced TypeScript/JavaScript code and compil... |

#### 04-cli-and-commands: Cli And Commands

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| CLI Entry Point | Cli And Commands | Nova26 | nova26-patterns/04-cli-and-commands/cli-entry.md | The CLI entry point pattern provides a unified command registry that merges multiple command sources (base slash comm... |
| Slash Commands Extended | Cli And Commands | Nova26 | nova26-patterns/04-cli-and-commands/slash-commands-extended.md | The extended slash commands module provides a comprehensive set of 25+ commands organized across seven functional cat... |
| Slash Commands | Cli And Commands | Nova26 | nova26-patterns/04-cli-and-commands/slash-commands.md | The base slash commands module defines a strongly-typed SlashCommand interface and a registry of core development com... |

#### 05-execution: Execution

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Docker Executor | Execution | Nova26 | nova26-patterns/05-execution/docker-executor.md | The Docker Executor pattern provides safe, isolated code execution for AI-generated code. It uses Docker containers a... |
| Swarm Mode | Execution | Nova26 | nova26-patterns/05-execution/swarm-mode.md | Swarm Mode is a collaborative execution pattern where all 21 Nova26 agents are activated simultaneously to tackle com... |

#### 06-llm-integration: Llm Integration

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Model Router | Llm Integration | Nova26 | nova26-patterns/06-llm-integration/model-router.md | The model router implements a three-tier strategy (free/paid/hybrid) for selecting LLM providers based on cost constr... |
| Ollama Client | Llm Integration | Nova26 | nova26-patterns/06-llm-integration/ollama-client.md | The Ollama client provides a typed wrapper around the Ollama REST API for running LLMs locally. It maps Nova26 agents... |
| Response Cache | Llm Integration | Nova26 | nova26-patterns/06-llm-integration/response-cache.md | The response cache uses a local SQLite database to store LLM responses keyed by a SHA-256 hash of the prompt, model, ... |
| Structured Output | Llm Integration | Nova26 | nova26-patterns/06-llm-integration/structured-output.md | The structured output module defines per-agent Zod schemas for all 21 Nova26 agents and provides a callLLMStructured<... |

#### 07-memory-and-persistence: Memory And Persistence

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Checkpoint System | Memory And Persistence | Nova26 | nova26-patterns/07-memory-and-persistence/checkpoint-system.md | The checkpoint system saves and restores build state to a local SQLite database, preventing data loss on crashes. It ... |
| Session Memory | Memory And Persistence | Nova26 | nova26-patterns/07-memory-and-persistence/session-memory.md | Session memory stores user preferences, architectural decisions, error patterns, and project-specific context that pe... |

#### 08-security: Security

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Security Scanner | Security | Nova26 | nova26-patterns/08-security/security-scanner.md | A static analysis security scanner that detects vulnerabilities in generated and authored code before deployment. The... |

#### 09-observability: Observability

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Observability Setup | Observability | Nova26 | nova26-patterns/09-observability/observability-setup.md | The observability setup pattern defines how Nova26 bootstraps its tracing, logging, and metrics infrastructure throug... |
| Tracer | Observability | Nova26 | nova26-patterns/09-observability/tracer.md | The NovaTracer pattern wraps a third-party tracing backend (Langfuse) behind a gracefully-degrading singleton that tr... |

#### 10-cost-management: Cost Management

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Cost Tracker | Cost Management | Nova26 | nova26-patterns/10-cost-management/cost-tracker.md | The Cost Tracker pattern provides real-time monitoring of LLM API token usage and costs across multiple models. It pe... |

#### 11-codebase-analysis: Codebase Analysis

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Dependency Analyzer | Codebase Analysis | Nova26 | nova26-patterns/11-codebase-analysis/dependency-analyzer.md | A static analysis system that parses import graphs from TypeScript/JavaScript source files, builds a directed depende... |
| Repository Map | Codebase Analysis | Nova26 | nova26-patterns/11-codebase-analysis/repo-map.md | A lightweight, regex-based repository indexing system that scans the project structure, extracts symbols (functions, ... |

#### 12-git-and-integrations: Git And Integrations

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Git Workflow | Git And Integrations | Nova26 | nova26-patterns/12-git-and-integrations/git-workflow.md | An automated git operations pipeline that manages the full branch-commit-PR lifecycle for agent-generated code. When ... |
| Issue Importer | Git And Integrations | Nova26 | nova26-patterns/12-git-and-integrations/issue-importer.md | A bridge between external issue trackers (GitHub Issues, Linear, Jira) and the Nova26 PRD task system. The importer f... |
| Xcode Integration | Git And Integrations | Nova26 | nova26-patterns/12-git-and-integrations/xcode-integration.md | An integration layer that connects the Nova26 agent system with Xcode projects for iOS and macOS development workflow... |

#### 13-browser-and-preview: Browser And Preview

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Preview Server | Browser And Preview | Nova26 | nova26-patterns/13-browser-and-preview/preview-server.md | The Preview Server provides a local Express-based development server with a device-frame UI for previewing VENUS-gene... |
| Visual Validator | Browser And Preview | Nova26 | nova26-patterns/13-browser-and-preview/visual-validator.md | The Visual Validator implements a headless-browser feedback loop that validates VENUS (frontend agent) output for UI ... |
| VS Code Extension | Browser And Preview | Nova26 | nova26-patterns/13-browser-and-preview/vscode-extension.md | The VS Code Extension pattern implements a full IDE integration layer for Nova26, exposing the multi-agent system thr... |

#### 14-templates-and-skills: Templates And Skills

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Skill Loader | Templates And Skills | Nova26 | nova26-patterns/14-templates-and-skills/skill-loader.md | The Skill Loader pattern dynamically discovers, parses, and injects domain-specific knowledge into agent prompts at t... |
| Template Engine | Templates And Skills | Nova26 | nova26-patterns/14-templates-and-skills/template-engine.md | The Template Engine pattern provides a declarative, registry-based approach to project scaffolding. Instead of impera... |

#### 15-type-system: Type System

| Pattern Name | Category | Knowledge Base | File Path | Description |
|---|---|---|---|---|
| Core Type Definitions | Type System | Nova26 | nova26-patterns/15-type-system/core-types.md | Nova26's shared type module provides a single source of truth for every data structure that flows through the multi-a... |

---

## Relationship Map

This section documents how patterns connect to each other across both knowledge bases. Relationships are classified into four types:

- **depends_on** — Pattern A requires Pattern B to function correctly
- **alternative_to** — Pattern A can be used instead of Pattern B
- **extends** — Pattern A builds on top of Pattern B
- **used_with** — Pattern A is commonly used alongside Pattern B

### Nova26 Internal Relationships

| From Pattern | To Pattern | Relationship Type | Description |
|---|---|---|---|
| Ralph Loop Execution | Task Picker | depends_on | Ralph Loop calls `pickNextTask` each iteration to select the next task |
| Ralph Loop Execution | Parallel Task Runner | used_with | Ralph Loop invokes parallel runner for concurrent independent tasks |
| Ralph Loop Execution | Gate Runner Pipeline | depends_on | Ralph Loop runs quality gates on every agent output before acceptance |
| Ralph Loop Execution | Council Consensus Voting | used_with | Ralph Loop invokes council approval on critical task decisions |
| Ralph Loop Execution | Prompt Builder | depends_on | Ralph Loop calls `buildPrompt` to construct agent prompts each iteration |
| Ralph Loop Execution | Event Store | depends_on | Ralph Loop emits events to the append-only session log during execution |
| Task Picker | Parallel Task Runner | alternative_to | Sequential task picking vs concurrent execution of independent tasks |
| Gate Runner Pipeline | Council Consensus Voting | used_with | Gates run before council approval in the validation pipeline |
| Gate Runner Pipeline | TypeScript Gate | depends_on | Gate runner orchestrates TypeScript compilation gate |
| Gate Runner Pipeline | Test Runner Gate | depends_on | Gate runner orchestrates test execution gate |
| Gate Runner Pipeline | Agent Schema Registry | depends_on | Gate runner uses `getAgentSchema` for schema-validation gate |
| Agent Schema Registry | Structured Output | extends | Schema registry provides Zod schemas consumed by structured output module |
| Prompt Builder | Agent Loader | depends_on | Prompt builder loads agent templates via the agent loader |
| Prompt Builder | Repo Map | used_with | Repo map context is injected into agent prompts via the prompt builder |
| Prompt Builder | Session Memory | used_with | Memory context is injected into prompts via `buildMemoryContext()` |
| Prompt Builder | Skill Loader | used_with | Skill content is integrated into final agent prompts |
| Agent Loader | Agent Explanations | used_with | Agent prompts are loaded before explanations are generated |
| Agent Loader | PRD Generator | depends_on | PRD generator loads the SUN agent prompt template |
| ATLAS Convex | Convex Client | depends_on | ATLAS facade wraps the lower-level Convex HTTP client |
| ATLAS Convex | Event Store | used_with | Convex tracking complements the local event store |
| Test-Fix-Retest Loop | Gate Runner Pipeline | depends_on | Test-fix loop runs after quality gates to fix failures |
| Test-Fix-Retest Loop | Smart Retry with Escalation | extends | Test-fix loop is a specialized retry pattern for test failures |
| Todo Tracking System | Ralph Loop Execution | depends_on | Todos are created and updated within `processTask` |
| Model Router | Ollama Client | depends_on | Model router dispatches to Ollama client for free-tier local inference |
| Model Router | Response Cache | used_with | Cache sits on top of model routing to avoid redundant LLM calls |
| Model Router | Structured Output | used_with | Structured output applies Zod validation on top of routed model calls |
| Model Router | Cost Tracker | used_with | Cost data feeds back into routing decisions |
| Ollama Client | Structured Output | used_with | Zod schema validation applied on top of Ollama responses |
| Response Cache | Cost Tracker | used_with | Cache produces `cached: true` entries in cost tracking |
| Checkpoint System | Session Memory | used_with | Build state persistence complements key-value knowledge store |
| Checkpoint System | Response Cache | used_with | Both use SQLite-backed persistence for different data |
| Tracer | Cost Tracker | used_with | Token counts from traces feed into cost tracking |
| Tracer | Observability Setup | depends_on | Tracer is bootstrapped through the observability setup barrel export |
| Security Scanner | Gate Runner Pipeline | extends | Security scanner can be integrated as a quality gate |
| Security Scanner | Docker Executor | used_with | Security scanning should run before code enters the sandbox |
| Docker Executor | Piston Client | alternative_to | Local Docker execution vs remote Piston API for code execution |
| TypeScript Gate | Piston Client | depends_on | TypeScript gate uses Piston client for compilation checks |
| Test Runner Gate | Piston Client | depends_on | Test runner gate uses Piston client for smoke test execution |
| Swarm Mode | Ralph Loop Execution | alternative_to | All-agents-at-once vs sequential agent dispatch |
| Swarm Mode | Agent Loader | depends_on | Swarm mode loads all 21 agent prompt templates |
| CLI Entry | Slash Commands | depends_on | CLI merges base slash command definitions into unified registry |
| CLI Entry | Slash Commands Extended | depends_on | CLI merges extended command set into unified registry |
| Slash Commands | PRD Generator | depends_on | `/generate` command invokes PRD generation logic |
| Template Engine | Skill Loader | used_with | Templates scaffold project files; skills inject domain knowledge |
| Template Engine | Slash Commands | depends_on | `/new` CLI command invokes template generation |
| Visual Validator | Preview Server | depends_on | Visual validator uses preview server URLs for screenshot capture |
| VS Code Extension | Preview Server | used_with | Extension can launch preview server for visual component inspection |
| VS Code Extension | Swarm Mode | used_with | Extension's `nova26.swarm` command delegates to swarm mode |
| VS Code Extension | CLI Entry | alternative_to | Same Nova26 server, different interface surface (IDE vs terminal) |
| Core Type Definitions | Ralph Loop Execution | used_with | `Task` and `PRD` types drive the core execution loop |
| Core Type Definitions | Gate Runner Pipeline | used_with | `GateResult` and `GateConfig` types are produced and consumed by gates |
| Core Type Definitions | Model Router | used_with | `ModelConfig` and `LLMResponse` types route calls across providers |
| Dependency Analyzer | Repo Map | used_with | Module-level import analysis complements symbol-level indexing |
| Issue Importer | PRD Generator | depends_on | Imported issues feed into PRD generation system |
| Issue Importer | Git Workflow | used_with | Imported issues trigger git workflow runs after build |
| Git Workflow | Issue Importer | used_with | Git workflow runs after imported issues are built |

### BistroLens Internal Relationships (Selected)

| From Pattern | To Pattern | Relationship Type | Description |
|---|---|---|---|
| Mutation Patterns | Query Patterns | used_with | Mutations write data that queries read |
| Mutation Patterns | Rate Limiting | used_with | Rate limiting protects mutations from abuse |
| Schema Conventions | Soft Delete Pattern | used_with | Schema includes `isDeleted` field for soft delete support |
| Error Boundaries | Error Logging | used_with | Error boundaries capture errors that the logger tracks |
| Error Boundaries | Retry Logic | used_with | Error boundaries provide recovery UI with retry actions |
| Resilience Patterns | Retry Logic | extends | Resilience patterns build on retry with circuit breaker and degradation |
| useAuth | Session Management | depends_on | Auth hook manages state that sessions persist |
| useAuth | RBAC Implementation | used_with | Auth hook provides identity for role-based access checks |
| useSubscription | useTierGates | used_with | Subscription state feeds into tier-based feature gating |
| useSubscription | useFreemium | used_with | Subscription state determines freemium limit enforcement |
| useSubscription | Subscription Service | depends_on | Hook consumes the subscription service layer |
| Component Structure | State Management | used_with | Components use useState/useReducer patterns |
| Suspense Patterns | Code Splitting | depends_on | Suspense wraps lazy-loaded code-split components |
| Form Validation | Form Submission | used_with | Validation runs before submission |
| Caching Strategies | useQuery Patterns | extends | Caching builds on Convex's reactive query system |
| Context Patterns | State Persistence | used_with | Persisted settings are loaded into context |
| Bundle Optimization | Code Splitting | used_with | Chunk splitting reduces bundle sizes |
| ARIA Patterns | Keyboard Navigation | used_with | ARIA attributes support keyboard-driven interactions |
| ARIA Patterns | Screen Reader | used_with | ARIA attributes provide screen reader semantics |
| Build Process | Deployment Config | used_with | Build output is deployed via Vercel and Convex config |

### Cross-Base Relationships (BistroLens ↔ Nova26)

These relationships connect patterns across the two knowledge bases, highlighting where BistroLens application patterns and Nova26 infrastructure patterns intersect.

| From Pattern (Knowledge Base) | To Pattern (Knowledge Base) | Relationship Type | Description |
|---|---|---|---|
| Convex Client (Nova26) | Convex File Storage (BistroLens) | used_with | Nova26's Convex HTTP client relates to BistroLens's Convex file storage patterns |
| Resilience Patterns (BistroLens) | Smart Retry with Escalation (Nova26) | alternative_to | BistroLens uses circuit breaker + backoff; Nova26 uses LLM-aware retry with model escalation |
| Retry Logic (BistroLens) | Smart Retry with Escalation (Nova26) | alternative_to | BistroLens generic retry wrapper vs Nova26's error-classified retry with model switching |
| Caching Strategies (BistroLens) | Response Cache (Nova26) | alternative_to | BistroLens uses Convex reactive query caching; Nova26 uses SQLite-backed LLM response caching |
| Rate Limiting (BistroLens) | Cost Tracker (Nova26) | used_with | BistroLens rate-limits API calls; Nova26 tracks token costs — both manage resource consumption |
| Error Boundaries (BistroLens) | Gate Runner Pipeline (Nova26) | used_with | BistroLens catches runtime UI errors; Nova26 gates catch code-generation errors before deployment |
| Error Logging (BistroLens) | Tracer (Nova26) | alternative_to | BistroLens logs errors via singleton ErrorLogger; Nova26 traces via Langfuse-backed NovaTracer |
| Error Logging (BistroLens) | Observability Setup (Nova26) | used_with | Both provide error tracking infrastructure for their respective systems |
| Component Testing (BistroLens) | Test Runner Gate (Nova26) | alternative_to | BistroLens tests components with RTL/Jest; Nova26 smoke-tests generated code via Piston |
| Unit Testing (BistroLens) | TypeScript Gate (Nova26) | used_with | BistroLens unit tests validate app logic; Nova26 TypeScript gate validates generated code compiles |
| Schema Validation (BistroLens) | Structured Output (Nova26) | alternative_to | BistroLens validates user input with Zod; Nova26 validates LLM output with per-agent Zod schemas |
| Convex Validators (BistroLens) | Agent Schema Registry (Nova26) | alternative_to | BistroLens uses Convex `v` validators for DB schemas; Nova26 uses Zod schemas for agent output |
| ATLAS Convex (Nova26) | Convex Mutation Patterns (BistroLens) | used_with | Both use Convex mutations — ATLAS for build tracking, BistroLens for app data |
| ATLAS Convex (Nova26) | Convex Query Patterns (BistroLens) | used_with | Both use Convex queries — ATLAS for build data retrieval, BistroLens for app data |
| Session Management (BistroLens) | Session Memory (Nova26) | alternative_to | BistroLens manages user auth sessions; Nova26 manages AI agent memory sessions |
| State Persistence (BistroLens) | Checkpoint System (Nova26) | alternative_to | BistroLens persists UI state to localStorage; Nova26 persists build state to SQLite |
| Subscription Service (BistroLens) | Cost Tracker (Nova26) | used_with | BistroLens manages Stripe subscriptions; Nova26 tracks LLM costs — both handle billing concerns |
| Navigation Patterns (BistroLens) | CLI Entry (Nova26) | alternative_to | BistroLens uses intent-based UI navigation; Nova26 uses slash-command CLI navigation |
| Build Process (BistroLens) | Docker Executor (Nova26) | used_with | BistroLens builds with Vite; Nova26 executes generated code in Docker sandboxes |
| Deployment Config (BistroLens) | Git Workflow (Nova26) | used_with | BistroLens deploys to Vercel/Convex; Nova26 automates the branch-commit-PR lifecycle |
| Release Checklist (BistroLens) | Visual Validator (Nova26) | used_with | BistroLens has manual release checks; Nova26 automates visual validation with screenshots |
| RBAC Implementation (BistroLens) | Security Scanner (Nova26) | used_with | BistroLens enforces role-based access; Nova26 scans for security vulnerabilities in generated code |
| Optimistic Mutation Pattern (BistroLens) | Event Store (Nova26) | alternative_to | BistroLens uses optimistic UI updates; Nova26 uses event sourcing for durable state |

---

## Statistics

### Grand Total

| Metric | Count |
|---|---|
| **Total Patterns** | **140** |
| BistroLens Patterns | 89 |
| Nova26 Patterns | 51 |
| Cross-Base Relationships | 23 |

### BistroLens Patterns by Category

| Category | Folder | Count |
|---|---|---|
| Convex Patterns | 01-convex-patterns | 11 |
| React Patterns | 02-react-patterns | 6 |
| Auth Patterns | 03-auth-patterns | 6 |
| UI Components | 04-ui-components | 8 |
| Form Patterns | 05-form-patterns | 5 |
| Data Fetching | 06-data-fetching | 4 |
| Error Handling | 07-error-handling | 5 |
| Testing Patterns | 08-testing-patterns | 5 |
| Hooks | 09-hooks | 11 |
| Utilities | 10-utilities | 5 |
| Validation | 11-validation | 5 |
| Routing | 12-routing | 3 |
| State Management | 13-state-management | 4 |
| Performance | 14-performance | 4 |
| Accessibility | 15-accessibility | 4 |
| Deployment | 16-deployment | 3 |
| **BistroLens Total** | | **89** |

### Nova26 Patterns by Category

| Category | Folder | Count |
|---|---|---|
| Orchestration | 01-orchestration | 10 |
| Agent System | 02-agent-system | 5 |
| Intelligence | 02-intelligence | 7 |
| Quality Gates | 03-quality-gates | 3 |
| CLI and Commands | 04-cli-and-commands | 3 |
| Execution | 05-execution | 2 |
| LLM Integration | 06-llm-integration | 4 |
| Memory and Persistence | 07-memory-and-persistence | 2 |
| Security | 08-security | 1 |
| Observability | 09-observability | 2 |
| Cost Management | 10-cost-management | 1 |
| Codebase Analysis | 11-codebase-analysis | 2 |
| Git and Integrations | 12-git-and-integrations | 3 |
| Browser and Preview | 13-browser-and-preview | 3 |
| Templates and Skills | 14-templates-and-skills | 2 |
| Type System | 15-type-system | 1 |
| **Nova26 Total** | | **51** |

### Extraction Date

All patterns cataloged and statistics computed on **2026-02-18**.

---

*Generated: 2026-02-18*
