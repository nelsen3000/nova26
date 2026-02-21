# BistroLens Knowledge Extraction

## Overview

Extract 75+ reusable patterns from the BistroLens project into Nova26's knowledge base. Patterns are organized into 16 categories with actual code examples, anti-patterns, and usage guidelines.

## User Stories

### US-001: Extract Convex Patterns
**As a** Nova26 developer
**I want to** have documented Convex database patterns
**So that** I can build features using proven database patterns

**Acceptance Criteria:**
- [x] Schema conventions documented
- [x] Query patterns documented
- [x] Mutation patterns documented
- [x] File storage patterns documented
- [x] Real-time subscription patterns documented
- [x] Migration procedures documented
- [x] Error handling patterns documented
- [x] Performance optimization patterns documented

### US-002: Extract Auth Patterns
**As a** Nova26 developer
**I want to** have documented authentication patterns
**So that** I can implement secure auth flows

**Acceptance Criteria:**
- [x] Auth helper functions documented
- [ ] Session management patterns documented
- [ ] RBAC implementation documented
- [ ] Subscription enforcement documented
- [ ] Age verification patterns documented

### US-003: Extract Data Fetching Patterns
**As a** Nova26 developer
**I want to** have documented data fetching patterns
**So that** I can efficiently fetch and cache data

**Acceptance Criteria:**
- [ ] useQuery patterns documented
- [ ] useMutation patterns documented
- [ ] Pagination patterns documented
- [ ] Caching strategies documented

### US-004: Extract UI Component Patterns
**As a** Nova26 developer
**I want to** have documented UI component patterns
**So that** I can build consistent, accessible interfaces

**Acceptance Criteria:**
- [ ] Button variants documented
- [ ] Form components documented
- [ ] Modal/dialog patterns documented
- [ ] Toast notification patterns documented
- [ ] Loading state patterns documented
- [ ] Empty state patterns documented
- [ ] Error state patterns documented
- [ ] Card layout patterns documented

### US-005: Extract Form Patterns
**As a** Nova26 developer
**I want to** have documented form patterns
**So that** I can build robust forms with validation

**Acceptance Criteria:**
- [ ] Form validation patterns documented
- [ ] Form submission patterns documented
- [ ] Multi-step form patterns documented
- [ ] File upload form patterns documented
- [ ] Dynamic field patterns documented

### US-006: Extract Error Handling Patterns
**As a** Nova26 developer
**I want to** have documented error handling patterns
**So that** I can provide good error UX

**Acceptance Criteria:**
- [ ] Error boundary patterns documented
- [ ] Error message patterns documented
- [ ] Retry logic patterns documented
- [ ] Error logging patterns documented

### US-007: Extract Testing Patterns
**As a** Nova26 developer
**I want to** have documented testing patterns
**So that** I can write comprehensive tests

**Acceptance Criteria:**
- [ ] Unit testing patterns documented
- [ ] Component testing patterns documented
- [ ] Integration testing patterns documented
- [ ] E2E testing patterns documented
- [ ] Test utility patterns documented

### US-008: Extract Custom Hooks
**As a** Nova26 developer
**I want to** have documented custom hook patterns
**So that** I can reuse common React logic

**Acceptance Criteria:**
- [ ] useAuth hook documented
- [ ] useSubscription hook documented
- [ ] useToast hook documented
- [ ] useLocalStorage hook documented
- [ ] useDebounce hook documented
- [ ] useMediaQuery hook documented

### US-009: Extract Utility Patterns
**As a** Nova26 developer
**I want to** have documented utility functions
**So that** I can reuse common operations

**Acceptance Criteria:**
- [ ] Date formatting utilities documented
- [ ] String utilities documented
- [ ] Number formatting utilities documented
- [ ] Validation helpers documented
- [ ] Array utilities documented

### US-010: Extract Validation Patterns
**As a** Nova26 developer
**I want to** have documented validation patterns
**So that** I can validate data consistently

**Acceptance Criteria:**
- [ ] Convex validators documented
- [ ] Client validation patterns documented
- [ ] Schema validation patterns documented
- [ ] Business rule validation documented

### US-011: Extract React Patterns
**As a** Nova26 developer
**I want to** have documented React patterns
**So that** I can write idiomatic React code

**Acceptance Criteria:**
- [ ] Component structure patterns documented
- [ ] State management patterns documented
- [ ] Effect patterns documented
- [ ] Memo optimization patterns documented
- [ ] Error boundary patterns documented
- [ ] Suspense patterns documented

### US-012: Extract Routing Patterns
**As a** Nova26 developer
**I want to** have documented routing patterns
**So that** I can implement navigation correctly

**Acceptance Criteria:**
- [ ] Route structure patterns documented
- [ ] Navigation patterns documented
- [ ] Protected route patterns documented

### US-013: Extract State Management Patterns
**As a** Nova26 developer
**I want to** have documented state management patterns
**So that** I can manage app state effectively

**Acceptance Criteria:**
- [ ] Context patterns documented
- [ ] Global state patterns documented
- [ ] Local state patterns documented
- [ ] State persistence patterns documented

### US-014: Extract Performance Patterns
**As a** Nova26 developer
**I want to** have documented performance patterns
**So that** I can build fast applications

**Acceptance Criteria:**
- [ ] Code splitting patterns documented
- [ ] Image optimization patterns documented
- [ ] Bundle optimization patterns documented
- [ ] Render optimization patterns documented

### US-015: Extract Accessibility Patterns
**As a** Nova26 developer
**I want to** have documented accessibility patterns
**So that** I can build inclusive applications

**Acceptance Criteria:**
- [ ] ARIA patterns documented
- [ ] Keyboard navigation patterns documented
- [ ] Screen reader patterns documented
- [ ] WCAG compliance patterns documented

### US-016: Extract Deployment Patterns
**As a** Nova26 developer
**I want to** have documented deployment patterns
**So that** I can deploy applications reliably

**Acceptance Criteria:**
- [ ] Build process patterns documented
- [ ] Deployment config patterns documented
- [ ] Release checklist documented

### US-017: Create Knowledge Base Index
**As a** Nova26 developer
**I want to** have a comprehensive index of all patterns
**So that** I can quickly find relevant patterns

**Acceptance Criteria:**
- [ ] INDEX.md created with all patterns listed
- [ ] Patterns organized by category
- [ ] Quick reference section included
- [ ] Use case guides included

## Source Location

`Bistrolens for Nova/bistrolens-2/`

## Target Location

`.nova/bistrolens-knowledge/`

## Technical Requirements

1. Each pattern file must include:
   - Source reference
   - Full code examples with TypeScript types
   - Anti-patterns (what NOT to do)
   - "When to Use" section
   - "Benefits" section
   - "Related Patterns" section

2. Code quality standards:
   - Real code, not pseudocode
   - Complete examples with imports/exports
   - Inline comments for complex logic
   - No placeholder comments

3. File naming:
   - Use kebab-case
   - Be descriptive
   - Group related patterns

## Edge Cases

- Some patterns may not exist in BistroLens (skip those)
- Some files may have moved or been renamed (search for similar patterns)
- Code examples may need adaptation for Nova26 context

---

*Created: 2026-02-18*
