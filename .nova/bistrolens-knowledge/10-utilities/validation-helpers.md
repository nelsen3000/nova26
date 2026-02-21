# Validation Helpers

## Source
Extracted from BistroLens `convex/securityGuards.ts`, `src/validators/ImageValidators.ts`, `utils/contentFilter.ts`, `utils/contentSafety.ts`, and `utils/resilience.ts`.

---

## Pattern: Validation Helper Functions

BistroLens uses a layered validation approach: Convex validators for schema-level type safety, security guard functions for business rules, and custom error classes for hard-fail scenarios.

---

## Core Patterns

### 1. Email & URL Validation

```typescript
// convex/securityGuards.ts

/**
 * Validate email format
 * Regex-based, enforces max length per RFC 5321
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate URL format — only allows http/https
 */
export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// Usage
if (!validateEmail(args.email)) {
  throw new ConvexError({ code: "INVALID_INPUT", message: "Invalid email format" });
}

if (!validateUrl(args.imageUrl)) {
  throw new ConvexError({ code: "INVALID_INPUT", message: "Invalid URL" });
}
```

### 2. String Sanitization (Server-Side)

```typescript
// convex/securityGuards.ts

/**
 * Sanitize string input — truncate + remove null bytes + HTML encode
 * Use on ALL user-provided strings before storing in Convex
 */
export function sanitizeString(input: string, maxLength: number = 10000): string {
  if (typeof input !== "string") {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: "Expected string input"
    });
  }

  // Truncate to max length
  let sanitized = input.slice(0, maxLength);

  // Remove null bytes (can cause issues in some DBs)
  sanitized = sanitized.replace(/\0/g, "");

  // HTML entity encoding for dangerous characters
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

  return sanitized;
}

// Usage in Convex mutation
const safeName = sanitizeString(args.name, 100);
const safeDescription = sanitizeString(args.description, 5000);
```

### 3. Hard-Fail Validators (Throw Pattern)

```typescript
// src/validators/ImageValidators.ts

// Custom error classes with structured metadata
export class ImageJobValidationError extends Error {
  public readonly blockedReason: BlockedReason;
  public readonly details: Record<string, unknown>;

  constructor(message: string, blockedReason: BlockedReason, details: Record<string, unknown> = {}) {
    super(`[IMAGE JOB VALIDATION FAILED] ${message}`);
    this.name = 'ImageJobValidationError';
    this.blockedReason = blockedReason;
    this.details = details;
  }
}

// Validator that throws — never returns false
export function assertImageJobValid(job: ImageGenerationJob): void {
  // Model validation — ABSOLUTE REQUIREMENT
  if (job.model !== IMAGE_MODEL) {
    throw new ImageJobValidationError(
      `Invalid model: "${job.model}". Only "${IMAGE_MODEL}" is permitted.`,
      BlockedReason.MODEL_ERROR,
      { providedModel: job.model, requiredModel: IMAGE_MODEL }
    );
  }

  // Type validation
  if (!Object.values(ImageType).includes(job.requestedImageType)) {
    throw new ImageJobValidationError(
      `Invalid image type: "${job.requestedImageType}"`,
      BlockedReason.INVALID_TYPE,
      { providedType: job.requestedImageType }
    );
  }
}

// Usage — wrap in try/catch at call site
try {
  assertImageJobValid(job);
} catch (error) {
  if (error instanceof ImageJobValidationError) {
    logBlockedJob(error.blockedReason, error.details);
    return null;
  }
  throw error;
}
```

### 4. Convex Schema Validators

```typescript
// convex/affiliates.ts — Convex v.* validators in mutation args

export const submitAffiliateApplication = mutation({
  args: {
    fullName: v.string(),
    email: v.string(),
    socialHandle: v.optional(v.string()),
    audienceSize: v.optional(v.string()),
    motivation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // args are already type-safe — Convex validates at runtime
    if (!validateEmail(args.email)) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Invalid email" });
    }
    // ...
  }
});

// Enum validation with v.union + v.literal
status: v.optional(v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived")
))

// Array of strings
tags: v.array(v.string())

// Optional fields
description: v.optional(v.string())
```

### 5. Structure Validation (Safe Defaults)

```typescript
// utils/resilience.ts

/**
 * Ensure an object has required keys — prevents "undefined is not an object" crashes
 * Shallow merge with defaults covers 90% of crash cases
 */
export function validateStructure<T extends object>(data: any, defaults: T): T {
  if (!data || typeof data !== 'object') return defaults;
  return { ...defaults, ...data };
}

// Usage — safe access to API responses
const recipe = validateStructure(apiResponse, {
  title: 'Untitled Recipe',
  ingredients: [],
  steps: [],
  servings: 1,
});
```

### 6. Content Safety Validation

```typescript
// utils/contentFilter.ts

const BLOCKLIST_REGEX = new RegExp(`\\b(${BLOCKLIST.join('|')})\\b`, 'i');

export const containsProfanity = (text: string): boolean => {
  if (!text) return false;
  return BLOCKLIST_REGEX.test(text);
};

// utils/contentSafety.ts — Recipe validation pipeline
async function validateRecipe(recipe: any): Promise<RecipeValidationResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  let safetyScore = 100;

  // 1. Check ingredients
  for (const ingredient of recipe.ingredients || []) {
    const check = checkIngredientSafety(ingredient);
    errors.push(...check.errors);
    warnings.push(...check.warnings);
    safetyScore -= check.errors.length * 20 + check.warnings.length * 5;
  }

  // 2. Check instructions
  const instructionCheck = checkInstructionSafety(recipe.instructions || []);
  errors.push(...instructionCheck.errors);
  warnings.push(...instructionCheck.warnings);

  return {
    valid: errors.length === 0 && safetyScore >= 70,
    warnings,
    errors,
    safetyScore: Math.max(0, safetyScore)
  };
}
```

### 7. Promo Code Validation

```typescript
// convex/affiliates.ts — Example of business rule validation
export const validatePromoCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    if (!args.code.trim()) {
      return { valid: false, error: "Code cannot be empty" };
    }

    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_promoCode", (q) => q.eq("promoCode", args.code.toUpperCase()))
      .first();

    if (!affiliate) {
      return { valid: false, error: "Invalid promo code" };
    }

    if (affiliate.status !== "approved") {
      return { valid: false, error: "Promo code is not active" };
    }

    return { valid: true, affiliateId: affiliate._id };
  }
});
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Don't silently swallow validation failures
function validateJob(job: Job): boolean {
  if (!job.model) return false; // ❌ Caller may ignore the return value
}

// Don't validate only on the client
// Client validation is UX — server validation is security
const isValid = email.includes('@'); // ❌ Client-only, easily bypassed

// Don't use loose equality for type checks
if (input == null) return; // ❌ Use strict === null || === undefined
```

### ✅ Do This Instead

```typescript
// Throw for hard failures — can't be ignored
function assertJobValid(job: Job): void {
  if (!job.model) throw new ValidationError("Model is required"); // ✅
}

// Always validate on the server too
export const createUser = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    if (!validateEmail(args.email)) { // ✅ Server-side check
      throw new ConvexError({ code: "INVALID_INPUT", message: "Invalid email" });
    }
  }
});
```

---

## When to Use This Pattern

✅ **Use for:**
- All user-provided string inputs (sanitize before storing)
- Email and URL fields (use `validateEmail`/`validateUrl`)
- Convex mutation args (use `v.*` validators)
- Critical business rules (use throw pattern)
- API response data (use `validateStructure` with defaults)

❌ **Don't use for:**
- Complex schema validation (use Zod for client-side forms)
- File type validation (use MIME type checking)

---

## Benefits

1. Convex `v.*` validators provide runtime type safety at the API boundary
2. Throw pattern ensures validation failures can't be silently ignored
3. `sanitizeString` prevents XSS and null byte injection in one pass
4. `validateStructure` prevents runtime crashes from malformed API responses
5. Custom error classes carry structured metadata for logging/monitoring

---

## Related Patterns

- See `../11-validation/convex-validators.md` for full Convex schema validation
- See `../11-validation/schema-validation.md` for Zod client-side validation
- See `../03-auth-patterns/auth-helpers.md` for auth guard patterns
- See `string-utilities.md` for client-side HTML sanitization

---

*Extracted: 2026-02-18*
