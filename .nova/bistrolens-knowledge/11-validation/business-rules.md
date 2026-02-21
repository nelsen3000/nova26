# Business Rules Validation Patterns

## Source
Extracted from BistroLens:
- `convex/social.ts` - Social post validation
- `convex/recipeActions.ts` - Recipe action validation
- `convex/imageGeneration.ts` - Image generation validation
- `convex/securityGuards.ts` - Security and authorization guards

---

## Pattern: Business Rules Validation

Business rules validation enforces domain-specific constraints and policies in your application. Unlike schema validation (which checks data types and structure), business rules validate the **meaning** and **context** of operations.

---

## Core Business Rule Categories

### 1. Range and Boundary Validation

Enforce numeric ranges and limits based on business requirements.

```typescript
// Recipe rating validation (1-5 stars only)
export const rateRecipe = mutation({
  args: {
    recipeId: v.string(),
    userId: v.string(),
    rating: v.number(),
  },
  handler: async (ctx, args) => {
    const { rating } = args;
    
    // Business rule: Ratings must be between 1 and 5
    if (rating < 1 || rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }
    
    // Continue with valid rating...
  },
});
```

**When to use:**
- Numeric inputs with business-defined ranges (ratings, quantities, percentages)
- Age restrictions
- Price limits
- Quantity constraints

---

### 2. Rate Limiting

Prevent abuse by limiting action frequency per user.

```typescript
// Rate limit: Max 10 posts per day
export const createSocialPost = mutation({
  args: {
    recipe: v.any(),
    caption: v.string()
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    
    // Business rule: Maximum 10 posts per 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentPosts = await ctx.db
      .query("socialPosts")
      .withIndex("by_authorId", (q) => q.eq("authorId", user.userId))
      .filter((q) => q.gt(q.field("createdAt"), oneDayAgo))
      .collect();
    
    if (recentPosts.length >= 10) {
      throw new ConvexError({ 
        code: "RATE_LIMITED", 
        message: "Maximum 10 posts per day. Try again tomorrow." 
      });
    }
    
    // Continue with post creation...
  },
});
```

**Reusable rate limit guard:**

```typescript
// From securityGuards.ts
interface RateLimitConfig {
  identifier: string;  // User ID or IP
  action: string;      // Action name
  maxRequests: number; // Max requests allowed
  windowMs: number;    // Time window in milliseconds
}

export async function requireRateLimit(
  ctx: MutationCtx,
  config: RateLimitConfig
): Promise<void> {
  const result = await checkRateLimit(ctx, config);
  
  if (!result.allowed) {
    throw new ConvexError({
      code: "RATE_LIMITED",
      message: `Rate limit exceeded. Try again in ${Math.ceil((result.resetAt - Date.now()) / 1000)} seconds`,
      resetAt: result.resetAt
    });
  }
}

// Usage in mutation
await requireRateLimit(ctx, {
  identifier: user.userId,
  action: "create_post",
  maxRequests: 10,
  windowMs: 24 * 60 * 60 * 1000 // 24 hours
});
```

---

### 3. State-Based Validation

Validate operations based on current resource state.

```typescript
// Can only interact with approved posts
export const togglePostLike = mutation({
  args: {
    postId: v.id("socialPosts")
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    
    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new ConvexError({ 
        code: "NOT_FOUND", 
        message: "Post not found" 
      });
    }
    
    // Business rule: Can only like approved posts
    if (post.moderationStatus !== "approved") {
      throw new ConvexError({ 
        code: "FORBIDDEN", 
        message: "Cannot interact with unapproved posts" 
      });
    }
    
    // Continue with like operation...
  },
});
```

**Pattern variations:**

```typescript
// Status transition validation
if (currentStatus === "published" && newStatus === "draft") {
  throw new Error("Cannot unpublish a published recipe");
}

// Deletion protection
if (recipe.hasActiveOrders) {
  throw new Error("Cannot delete recipe with active orders");
}

// Time-based constraints
const isWithin60Seconds = (now - existingState.createdAt) < 60000;
if (isWithin60Seconds) {
  // Apply stronger negative signal for quick deletes
  actionType = "delete_within_60s";
}
```

---

### 4. Age Verification and Content Gating

Enforce age restrictions for regulated content.

```typescript
// Age verification for spirited (alcoholic) content
export const generateHeroImageForRecipe = mutation({
  args: {
    recipeId: v.string(),
    drinkMode: v.optional(v.union(
      v.literal("zero_proof"),
      v.literal("spirited")
    )),
    userAge: v.optional(v.object({
      birthDate: v.string(),
      country: v.string(),
      isVerified: v.boolean()
    })),
    adminBypass: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    // Business rule: Spirited content requires age verification
    if (args.drinkMode === 'spirited' && !args.adminBypass) {
      if (!args.userAge?.isVerified) {
        return {
          success: false,
          action: 'blocked',
          error: "Age verification required for spirited content",
          errorCode: 'AGE_VERIFICATION_REQUIRED'
        };
      }
      
      // Country-specific drinking age requirements
      const drinkingAges: Record<string, number> = {
        'US': 21,
        'UK': 18,
        'CA': 19,
        'AU': 18,
        'DE': 18,
        'FR': 18,
        'JP': 20,
        'MX': 18,
        'BR': 18
      };
      
      const requiredAge = drinkingAges[args.userAge.country] || 21;
      const userBirthDate = new Date(args.userAge.birthDate);
      const ageInYears = (Date.now() - userBirthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      
      if (ageInYears < requiredAge) {
        return {
          success: false,
          action: 'blocked',
          error: `User must be at least ${requiredAge} years old to access spirited content in ${args.userAge.country}`,
          errorCode: 'UNDERAGE'
        };
      }
    }
    
    // Continue with generation...
  },
});
```

---

### 5. Content Safety and Sanitization

Prevent XSS attacks and enforce content policies.

```typescript
// Input sanitization for user-generated content
export const createSocialPost = mutation({
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    
    // Business rule: Sanitize caption to prevent XSS
    const sanitizedCaption = args.caption
      .slice(0, 1000) // Max length enforcement
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    await ctx.db.insert("socialPosts", {
      caption: sanitizedCaption,
      // ... other fields
    });
  },
});
```

**Reusable sanitization guard:**

```typescript
// From securityGuards.ts
export function sanitizeString(input: string, maxLength: number = 10000): string {
  if (typeof input !== "string") {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: "Expected string input"
    });
  }
  
  // Truncate to max length
  let sanitized = input.slice(0, maxLength);
  
  // Remove null bytes
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

// Usage
const sanitizedCaption = sanitizeString(args.caption, 1000);
```

---

### 6. Forbidden Content Patterns

Block specific content types based on business policies.

```typescript
// Forbidden tag patterns (from intentAggregation.ts)
const FORBIDDEN_TAG_PATTERNS = [
  'allerg', 'diet', 'vegan', 'vegetarian', 'keto', 'paleo', 'gluten',
  'halal', 'kosher', 'medical', 'health', 'pregnancy', 'kid-safe',
];

function isTagAllowed(tag: string): boolean {
  const lowerTag = tag.toLowerCase();
  
  // Business rule: Never store medical/dietary claim tags
  for (const pattern of FORBIDDEN_TAG_PATTERNS) {
    if (lowerTag.includes(pattern)) {
      return false;
    }
  }
  
  return true;
}

// Unsafe content detection in prompts
const unsafePatterns = [
  /\b(bleach|ammonia|poison|drug|cocaine|heroin)\b/i,
  /\b(person|people|face|human|man|woman|child)\b/i,
  /\b(coca-cola|pepsi|mcdonalds|burger king|starbucks)\b/i
];

const blockedReasons = [];
for (const pattern of unsafePatterns) {
  if (pattern.test(args.prompt)) {
    if (pattern.source.includes('bleach|ammonia')) {
      blockedReasons.push('Unsafe substances detected');
    } else if (pattern.source.includes('person|people')) {
      blockedReasons.push('People/faces not allowed');
    } else if (pattern.source.includes('coca-cola|pepsi')) {
      blockedReasons.push('Brand names not allowed');
    }
  }
}

if (blockedReasons.length > 0) {
  return {
    allowed: false,
    blockedReasons,
    sanitizedPrompt: ''
  };
}
```

---

### 7. Resource Ownership Validation

Ensure users can only modify their own resources.

```typescript
// From securityGuards.ts
export async function requireOwnership(
  ctx: QueryCtx | MutationCtx,
  resourceUserId: string
) {
  const user = await requireAuth(ctx);
  
  // Business rule: User must own the resource
  if (user.userId !== resourceUserId) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You do not have permission to access this resource"
    });
  }
  
  return user;
}

// Usage in mutation
export const deleteRecipe = mutation({
  args: { recipeId: v.string() },
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.recipeId);
    
    // Verify ownership before deletion
    await requireOwnership(ctx, recipe.authorId);
    
    // Continue with deletion...
  },
});
```

---

### 8. Subscription Tier Enforcement

Gate features based on subscription level.

```typescript
// From securityGuards.ts
type SubscriptionTier = "free" | "premium" | "chef_master";

export async function requireSubscription(
  ctx: QueryCtx | MutationCtx,
  minimumTier: SubscriptionTier
): Promise<{ userId: string; tier: SubscriptionTier }> {
  const user = await requireAuth(ctx);
  
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", user.userId))
    .first();
  
  const tierHierarchy: Record<SubscriptionTier, number> = {
    free: 0,
    premium: 1,
    chef_master: 2
  };
  
  const currentTier = subscription?.tier || "free";
  const currentLevel = tierHierarchy[currentTier];
  const requiredLevel = tierHierarchy[minimumTier];
  
  // Business rule: Feature requires minimum subscription tier
  if (currentLevel < requiredLevel) {
    throw new ConvexError({
      code: "SUBSCRIPTION_REQUIRED",
      message: `This feature requires ${minimumTier} subscription`,
      currentTier,
      requiredTier: minimumTier
    });
  }
  
  return { userId: user.userId, tier: currentTier };
}

// Usage
export const exportRecipeToPDF = mutation({
  handler: async (ctx, args) => {
    // Require premium subscription for PDF export
    await requireSubscription(ctx, "premium");
    
    // Continue with export...
  },
});
```

---

### 9. Minimum Threshold Validation

Enforce minimum requirements for data quality.

```typescript
// From publicRecipes.ts
const MIN_RATING_COUNT_FOR_TOP_RATED = 25;

export const getTopRatedRecipes = query({
  handler: async (ctx) => {
    const recipes = await ctx.db
      .query("recipes")
      .collect();
    
    // Business rule: Top rated requires minimum 25 ratings
    const qualified = recipes.filter(r => 
      r.ratingCount >= MIN_RATING_COUNT_FOR_TOP_RATED
    );
    
    return qualified.sort((a, b) => b.ratingAvg - a.ratingAvg);
  },
});

// Revision quality threshold
const REVISION_THRESHOLDS = {
  minSimilarity: 0.85,        // Must be 85% similar to revise same URL
  minQualityImprovement: 0.25, // Requires 25% quality improvement
};

if (qualityImprovement < REVISION_THRESHOLDS.minQualityImprovement) {
  return {
    allowed: false,
    reason: `Quality improvement (${(qualityImprovement * 100).toFixed(1)}%) below threshold (${REVISION_THRESHOLDS.minQualityImprovement * 100}%)`,
  };
}
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// BAD: No validation
export const rateRecipe = mutation({
  handler: async (ctx, args) => {
    // Accepts any rating value, including negative or > 5
    await ctx.db.insert("ratings", {
      rating: args.rating // Could be -100 or 9999!
    });
  },
});

// BAD: Client-side only validation
// User can bypass by modifying request
function submitRating(rating: number) {
  if (rating >= 1 && rating <= 5) {
    // Validation only on client
    api.rateRecipe({ rating });
  }
}

// BAD: Unclear error messages
if (rating < 1 || rating > 5) {
  throw new Error("Invalid"); // What's invalid? Why?
}

// BAD: No rate limiting
export const sendEmail = mutation({
  handler: async (ctx, args) => {
    // User can spam unlimited emails
    await sendEmailService(args.to, args.message);
  },
});

// BAD: Trusting user input without sanitization
export const createPost = mutation({
  handler: async (ctx, args) => {
    await ctx.db.insert("posts", {
      content: args.content // XSS vulnerability!
    });
  },
});
```

### ✅ Do This Instead

```typescript
// GOOD: Server-side validation with clear errors
export const rateRecipe = mutation({
  args: {
    rating: v.number(),
  },
  handler: async (ctx, args) => {
    // Validate on server
    if (rating < 1 || rating > 5) {
      throw new ConvexError({
        code: "INVALID_RATING",
        message: "Rating must be between 1 and 5 stars"
      });
    }
    
    await ctx.db.insert("ratings", { rating: args.rating });
  },
});

// GOOD: Rate limiting
export const sendEmail = mutation({
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    
    await requireRateLimit(ctx, {
      identifier: user.userId,
      action: "send_email",
      maxRequests: 10,
      windowMs: 60 * 60 * 1000 // 10 per hour
    });
    
    await sendEmailService(args.to, args.message);
  },
});

// GOOD: Input sanitization
export const createPost = mutation({
  handler: async (ctx, args) => {
    const sanitizedContent = sanitizeString(args.content, 5000);
    
    await ctx.db.insert("posts", {
      content: sanitizedContent
    });
  },
});
```

---

## When to Use This Pattern

✅ **Use for:**
- Enforcing business constraints (rating ranges, age limits, pricing rules)
- Preventing abuse (rate limiting, spam prevention)
- Content safety (XSS prevention, forbidden content)
- Authorization (ownership checks, subscription tiers)
- Data quality (minimum thresholds, required fields)
- State transitions (workflow validation)
- Regulatory compliance (age verification, content restrictions)

❌ **Don't use for:**
- Type checking (use Convex validators instead)
- Schema validation (use `v.object()` definitions)
- Simple null checks (use `v.optional()`)
- Client-side UX validation (complement, don't replace server validation)

---

## Benefits

1. **Security**: Prevents malicious users from bypassing client-side validation
2. **Data Integrity**: Ensures all data meets business requirements
3. **Compliance**: Enforces legal and regulatory requirements
4. **User Protection**: Prevents abuse and spam
5. **Clear Errors**: Provides actionable feedback to users
6. **Centralized Logic**: Business rules in one place, not scattered across UI
7. **Testable**: Easy to unit test validation logic
8. **Auditable**: Clear trail of why operations were blocked

---

## Related Patterns

- See `convex-validators.md` for schema-level validation
- See `client-validation.md` for UX-focused validation
- See `schema-validation.md` for Zod validation patterns
- See `../03-auth-patterns/auth-helpers.md` for authentication patterns
- See `../01-convex-patterns/error-handling.md` for error response patterns

---

*Extracted: 2026-02-18*
