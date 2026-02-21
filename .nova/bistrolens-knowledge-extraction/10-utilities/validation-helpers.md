# Validation Helpers

## Source
Extracted from BistroLens:
- `utils/imagenAspectRatioValidator.ts`
- `utils/touchTargetValidator.ts`
- `utils/imageTags.ts`
- `utils/contentSafety.ts`
- `utils/accessibilityUtils.ts`
- `utils/gdprCompliance.ts`

---

## Pattern: Validation Helper Functions

Validation helpers provide reusable functions for validating data, user input, and system constraints. BistroLens implements multiple validation patterns for different domains: aspect ratios, touch targets, image tags, content safety, accessibility compliance, and GDPR requirements.

---

## 1. Simple Value Validation

### Code Example

```typescript
/**
 * Imagen Aspect Ratio Validator
 * Single source of truth for validating and coercing aspect ratios
 */

export const IMAGEN_SUPPORTED_ASPECT_RATIOS = new Set(['1:1', '9:16', '16:9', '4:3', '3:4']);
export const DEFAULT_ASPECT_RATIO = '4:3';

let aspectRatioCoercionLogged = false; // Prevent log spam

/**
 * Validates and coerces aspect ratio to Imagen-supported values.
 * @param requestedRatio - The requested aspect ratio
 * @returns A valid Imagen aspect ratio
 */
export const validateImagenAspectRatio = (requestedRatio: string | undefined): string => {
    // If no ratio provided, use default
    if (!requestedRatio) {
        return DEFAULT_ASPECT_RATIO;
    }
    
    // If already valid, pass through
    if (IMAGEN_SUPPORTED_ASPECT_RATIOS.has(requestedRatio)) {
        return requestedRatio;
    }
    
    // Coercion rules for known invalid ratios
    let coercedRatio: string;
    switch (requestedRatio) {
        case '3:2':
            coercedRatio = '4:3'; // Closest landscape option
            break;
        case '2:3':
            coercedRatio = '3:4'; // Closest portrait option
            break;
        default:
            coercedRatio = DEFAULT_ASPECT_RATIO; // Safe fallback
    }
    
    // Log governance warning once per session (not per retry)
    if (!aspectRatioCoercionLogged) {
        console.warn(`[ImageGovernance] Aspect ratio "${requestedRatio}" not supported. Coerced to "${coercedRatio}".`);
        aspectRatioCoercionLogged = true;
    }
    
    return coercedRatio;
};

/**
 * Reset coercion log flag (for testing)
 */
export const resetAspectRatioCoercionLog = () => {
    aspectRatioCoercionLogged = false;
};
```

**Key Features:**
- Whitelist validation with Set for O(1) lookup
- Automatic coercion to nearest valid value
- Single warning per session to prevent log spam
- Testable with reset function

---

## 2. Complex Object Validation with Results

### Code Example

```typescript
/**
 * Touch Target Validator - WCAG Compliance Utility
 */

export const MIN_TOUCH_TARGET_SIZE = 44; // WCAG 2.1 AA

export interface TouchTargetValidationResult {
  element: Element;
  isValid: boolean;
  width: number;
  height: number;
  minRequired: number;
  issues: string[];
}

export interface ValidationSummary {
  totalElements: number;
  validElements: number;
  invalidElements: number;
  results: TouchTargetValidationResult[];
}

/**
 * Check if an element meets minimum touch target size
 */
export function validateTouchTarget(element: Element): TouchTargetValidationResult {
  const rect = element.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  
  const issues: string[] = [];
  
  if (width < MIN_TOUCH_TARGET_SIZE) {
    issues.push(`Width ${width}px is below minimum ${MIN_TOUCH_TARGET_SIZE}px`);
  }
  
  if (height < MIN_TOUCH_TARGET_SIZE) {
    issues.push(`Height ${height}px is below minimum ${MIN_TOUCH_TARGET_SIZE}px`);
  }
  
  return {
    element,
    isValid: issues.length === 0,
    width,
    height,
    minRequired: MIN_TOUCH_TARGET_SIZE,
    issues,
  };
}

/**
 * Validate all interactive elements in a container
 */
export function validateAllTouchTargets(
  container: Element | Document = document
): ValidationSummary {
  const selector = INTERACTIVE_SELECTORS.join(', ');
  const elements = container.querySelectorAll(selector);
  
  const results: TouchTargetValidationResult[] = [];
  let validCount = 0;
  let invalidCount = 0;
  
  elements.forEach((element) => {
    // Skip hidden elements
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return;
    }
    
    const result = validateTouchTarget(element);
    results.push(result);
    
    if (result.isValid) {
      validCount++;
    } else {
      invalidCount++;
    }
  });
  
  return {
    totalElements: results.length,
    validElements: validCount,
    invalidElements: invalidCount,
    results,
  };
}

/**
 * Get only invalid touch targets
 */
export function getInvalidTouchTargets(
  container: Element | Document = document
): TouchTargetValidationResult[] {
  const summary = validateAllTouchTargets(container);
  return summary.results.filter((r) => !r.isValid);
}
```

**Key Features:**
- Rich validation result objects with detailed information
- Batch validation with summary statistics
- Filter functions for invalid results only
- Skips hidden elements automatically

---

## 3. Assertion-Based Validation

### Code Example

```typescript
/**
 * Assert that an element meets touch target requirements
 * Throws if validation fails
 */
export function assertTouchTarget(element: Element): void {
  const result = validateTouchTarget(element);
  
  if (!result.isValid) {
    throw new Error(
      `Touch target validation failed for ${element.tagName}: ${result.issues.join(', ')}`
    );
  }
}

/**
 * Assert that all interactive elements meet touch target requirements
 * Throws if any validation fails
 */
export function assertAllTouchTargets(container: Element | Document = document): void {
  const summary = validateAllTouchTargets(container);
  
  if (summary.invalidElements > 0) {
    const invalidDetails = summary.results
      .filter((r) => !r.isValid)
      .map((r) => `${r.element.tagName} (${r.width}x${r.height}px): ${r.issues.join(', ')}`)
      .join('\n');
    
    throw new Error(
      `Touch target validation failed for ${summary.invalidElements} elements:\n${invalidDetails}`
    );
  }
}

/**
 * Validate that a tag bundle has all required fields
 * Throws if missing required fields
 */
export function validateTagBundle(bundle: ImageTagBundle): void {
  const required = ['imageType', 'model', 'tier', 'aspectRatio', 'normalizedDishKey', 'source', 'createdAt'];
  
  for (const field of required) {
    if (!(field in bundle) || bundle[field as keyof ImageTagBundle] === undefined) {
      throw new Error(`[ImageTags] Missing required field: ${field}`);
    }
  }
  
  if (bundle.imageType === 'STEP' && bundle.stepIndex === undefined) {
    throw new Error('[ImageTags] STEP images require stepIndex');
  }
  
  if (bundle.model !== 'imagen-4.0-generate-001') {
    throw new Error(`[ImageTags] Invalid model: ${bundle.model}. Only imagen-4.0-generate-001 allowed.`);
  }
}
```

**Key Features:**
- Throws errors for test assertions
- Detailed error messages with context
- Useful for unit tests and critical validations
- Fails fast on first error

---

## 4. Normalization with Validation

### Code Example

```typescript
/**
 * Common words to remove from dish names for normalization
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'with', 'and', 'or', 'in', 'on', 'for', 'to', 'of',
  'style', 'homemade', 'classic', 'traditional', 'authentic', 'easy',
  'quick', 'simple', 'best', 'perfect', 'delicious', 'amazing', 'ultimate'
]);

/**
 * Normalize a string to a deterministic key
 * - Lowercase
 * - Remove special characters
 * - Remove stop words
 * - Replace spaces with hyphens
 * - Trim and dedupe hyphens
 */
export function normalizeToKey(input: string): string {
  if (!input) return '';
  
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word))
    .join('-')
    .replace(/-+/g, '-') // Dedupe hyphens
    .replace(/^-|-$/g, ''); // Trim hyphens
}

/**
 * Extract the primary technique from a step instruction
 */
export function extractTechnique(instruction: string): string | undefined {
  const words = instruction.toLowerCase().split(/\s+/);
  
  for (const word of words) {
    const cleanWord = word.replace(/[^a-z-]/g, '');
    if (COOKING_TECHNIQUES.has(cleanWord)) {
      return cleanWord;
    }
  }
  
  return undefined;
}

/**
 * Extract cuisine from text (title, category, or explicit cuisine)
 */
export function extractCuisine(text: string, explicitCuisine?: string): string | undefined {
  // If explicit cuisine provided, normalize it
  if (explicitCuisine) {
    return normalizeToKey(explicitCuisine);
  }
  
  const lowerText = text.toLowerCase();
  
  for (const [cuisine, keywords] of Object.entries(CUISINE_KEYWORDS)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      return cuisine;
    }
  }
  
  return undefined;
}
```

**Key Features:**
- Deterministic normalization (same input = same output)
- Keyword extraction from text
- Stop word filtering
- Pattern matching with Sets for performance

---

## 5. Multi-Level Validation with Scoring

### Code Example

```typescript
/**
 * Validate AI-generated recipe for safety
 */
async validateRecipe(recipe: any): Promise<RecipeValidationResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  let safetyScore = 100;

  try {
    // 1. Check ingredients for safety
    if (recipe.ingredients) {
      for (const ingredient of recipe.ingredients) {
        const ingredientCheck = this.checkIngredientSafety(ingredient);
        if (ingredientCheck.errors.length > 0) {
          errors.push(...ingredientCheck.errors);
          safetyScore -= 20;
        }
        if (ingredientCheck.warnings.length > 0) {
          warnings.push(...ingredientCheck.warnings);
          safetyScore -= 5;
        }
      }
    }

    // 2. Check cooking instructions for safety
    if (recipe.instructions) {
      const instructionCheck = this.checkInstructionSafety(recipe.instructions);
      if (instructionCheck.errors.length > 0) {
        errors.push(...instructionCheck.errors);
        safetyScore -= 15;
      }
      if (instructionCheck.warnings.length > 0) {
        warnings.push(...instructionCheck.warnings);
        safetyScore -= 3;
      }
    }

    // 3. Check for dangerous combinations
    const combinationCheck = this.checkDangerousCombinations(recipe);
    if (combinationCheck.length > 0) {
      errors.push(...combinationCheck);
      safetyScore -= 25;
    }

    // 4. Check cooking temperatures and times
    const tempCheck = this.checkCookingTemperatures(recipe);
    if (tempCheck.errors.length > 0) {
      errors.push(...tempCheck.errors);
      safetyScore -= 10;
    }

    return {
      valid: errors.length === 0 && safetyScore >= 70,
      warnings,
      errors,
      safetyScore: Math.max(0, safetyScore)
    };

  } catch (error) {
    console.error('Recipe validation error:', error);
    return {
      valid: false,
      warnings: [],
      errors: ['Recipe validation failed due to system error'],
      safetyScore: 0
    };
  }
}
```

**Key Features:**
- Composite validation with multiple checks
- Weighted scoring system
- Separate warnings vs errors
- Graceful error handling with fallback

---

## 6. Color Contrast Validation (WCAG)

### Code Example

```typescript
/**
 * WCAG contrast ratio requirements
 */
export const CONTRAST_REQUIREMENTS = Object.freeze({
  /** Normal text (< 18px or < 14px bold) */
  NORMAL_TEXT: 4.5,
  /** Large text (>= 18px or >= 14px bold) */
  LARGE_TEXT: 3.0,
  /** UI components and graphical objects */
  UI_COMPONENTS: 3.0,
} as const);

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Handle 6-char hex
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }
  
  // Handle 3-char hex (e.g., #fff -> #ffffff)
  const shortResult = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
  if (shortResult) {
    return {
      r: parseInt(shortResult[1] + shortResult[1], 16),
      g: parseInt(shortResult[2] + shortResult[2], 16),
      b: parseInt(shortResult[3] + shortResult[3], 16),
    };
  }
  
  return null;
}

/**
 * Calculate relative luminance per WCAG 2.1
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return 0;
  
  const l1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);
  
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Validate that a color pair meets contrast requirements
 */
export function validateContrastPair(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): { valid: boolean; ratio: number; required: number } {
  const ratio = getContrastRatio(foreground, background);
  const required = isLargeText 
    ? CONTRAST_REQUIREMENTS.LARGE_TEXT 
    : CONTRAST_REQUIREMENTS.NORMAL_TEXT;
  
  return {
    valid: ratio >= required,
    ratio: Math.round(ratio * 100) / 100,
    required,
  };
}

/**
 * Check if contrast ratio meets WCAG AA for normal text
 */
export function meetsNormalTextContrast(foreground: string, background: string): boolean {
  return getContrastRatio(foreground, background) >= CONTRAST_REQUIREMENTS.NORMAL_TEXT;
}
```

**Key Features:**
- WCAG 2.1 compliant calculations
- Handles both 3-char and 6-char hex colors
- Returns detailed validation results
- Boolean convenience functions for quick checks

---

## 7. Consent and Compliance Validation

### Code Example

```typescript
/**
 * Validate user consent for data processing
 */
validateConsent(): {
  hasConsent: boolean;
  consentDate: string | null;
  needsRenewal: boolean;
} {
  const consentData = safeLocalStorageGet('cookie_consent', false);
  const consentDate = safeLocalStorageGet('cookie_consent_date', null);
  
  let needsRenewal = false;
  if (consentDate) {
    const consentTime = new Date(consentDate).getTime();
    const now = new Date().getTime();
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    needsRenewal = (now - consentTime) > oneYear;
  }

  return {
    hasConsent: !!consentData,
    consentDate,
    needsRenewal
  };
}

/**
 * Check if data retention periods have expired
 */
checkRetentionPeriods(): { expired: string[]; warnings: string[] } {
  const expired: string[] = [];
  const warnings: string[] = [];
  const now = new Date().getTime();

  // Check account deletion date
  const deletionData = safeLocalStorageGet('data_deletion_completed', null);
  if (deletionData) {
    const deletionDate = new Date(deletionData.date).getTime();
    const daysSinceDeletion = (now - deletionDate) / (1000 * 60 * 60 * 24);
    
    if (daysSinceDeletion > this.RETENTION_PERIODS.accountData) {
      expired.push('All retained data should be permanently deleted');
    } else if (daysSinceDeletion > this.RETENTION_PERIODS.accountData - 30) {
      warnings.push('Account data retention period expires soon');
    }
  }

  // Check analytics data age
  const behaviorData = safeLocalStorageGet('bistro_user_behavior', null);
  if (behaviorData && behaviorData.lastActive) {
    const lastActiveDate = new Date(behaviorData.lastActive).getTime();
    const daysSinceActive = (now - lastActiveDate) / (1000 * 60 * 60 * 24);
    
    if (daysSinceActive > this.RETENTION_PERIODS.analyticsData) {
      expired.push('Analytics data retention period expired');
    }
  }

  return { expired, warnings };
}
```

**Key Features:**
- Time-based validation with expiration checks
- Separate expired vs warning states
- GDPR compliance helpers
- Renewal detection

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// ❌ BAD: Throwing generic errors without context
function validateInput(value: string) {
  if (!value) {
    throw new Error('Invalid input');
  }
}

// ❌ BAD: No validation result object
function checkSize(width: number, height: number): boolean {
  return width >= 44 && height >= 44;
}

// ❌ BAD: Silent failures
function validateAspectRatio(ratio: string): string {
  if (VALID_RATIOS.has(ratio)) {
    return ratio;
  }
  return '1:1'; // No indication that coercion happened
}

// ❌ BAD: Mixing validation and business logic
function saveUser(user: User) {
  if (!user.email) {
    throw new Error('Invalid email');
  }
  if (!user.name) {
    throw new Error('Invalid name');
  }
  // Save logic mixed with validation
  database.save(user);
}

// ❌ BAD: No type safety
function validate(data: any): boolean {
  return data.field1 && data.field2;
}
```

### ✅ Do This Instead

```typescript
// ✅ GOOD: Rich validation result with context
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  value?: string;
}

function validateInput(value: string): ValidationResult {
  const errors: string[] = [];
  
  if (!value) {
    errors.push('Input is required');
  }
  if (value && value.length < 3) {
    errors.push('Input must be at least 3 characters');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
    value: value
  };
}

// ✅ GOOD: Detailed validation result object
interface SizeValidationResult {
  isValid: boolean;
  width: number;
  height: number;
  minRequired: number;
  issues: string[];
}

function checkSize(width: number, height: number): SizeValidationResult {
  const issues: string[] = [];
  
  if (width < 44) {
    issues.push(`Width ${width}px is below minimum 44px`);
  }
  if (height < 44) {
    issues.push(`Height ${height}px is below minimum 44px`);
  }
  
  return {
    isValid: issues.length === 0,
    width,
    height,
    minRequired: 44,
    issues
  };
}

// ✅ GOOD: Explicit coercion with logging
interface CoercionResult {
  value: string;
  wasCoerced: boolean;
  originalValue?: string;
}

function validateAspectRatio(ratio: string): CoercionResult {
  if (VALID_RATIOS.has(ratio)) {
    return {
      value: ratio,
      wasCoerced: false
    };
  }
  
  const coerced = '1:1';
  console.warn(`Aspect ratio "${ratio}" coerced to "${coerced}"`);
  
  return {
    value: coerced,
    wasCoerced: true,
    originalValue: ratio
  };
}

// ✅ GOOD: Separate validation from business logic
interface UserValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

function validateUser(user: User): UserValidationResult {
  const errors: Record<string, string> = {};
  
  if (!user.email) {
    errors.email = 'Email is required';
  }
  if (!user.name) {
    errors.name = 'Name is required';
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

function saveUser(user: User) {
  const validation = validateUser(user);
  if (!validation.valid) {
    throw new ValidationError(validation.errors);
  }
  database.save(user);
}

// ✅ GOOD: Type-safe validation
interface UserData {
  email: string;
  name: string;
  age: number;
}

function validateUserData(data: UserData): ValidationResult {
  const errors: string[] = [];
  
  if (!data.email.includes('@')) {
    errors.push('Invalid email format');
  }
  if (data.name.length < 2) {
    errors.push('Name must be at least 2 characters');
  }
  if (data.age < 0 || data.age > 150) {
    errors.push('Age must be between 0 and 150');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings: []
  };
}
```

---

## When to Use This Pattern

✅ **Use validation helpers for:**
- Input sanitization and normalization
- WCAG compliance checks (contrast, touch targets)
- API response validation
- Form field validation
- Data integrity checks before database operations
- Security validations (XSS, SQL injection prevention)
- Business rule enforcement
- Configuration validation
- File format validation
- Compliance checks (GDPR, COPPA, etc.)

❌ **Don't use validation helpers for:**
- Simple null checks (use optional chaining)
- Type checking (use TypeScript types)
- Authentication (use dedicated auth middleware)
- Authorization (use RBAC systems)
- Complex business logic (use service layer)

---

## Benefits

1. **Reusability**: Write validation logic once, use everywhere
2. **Consistency**: Same validation rules across the application
3. **Testability**: Easy to unit test validation functions in isolation
4. **Maintainability**: Centralized validation logic is easier to update
5. **Type Safety**: TypeScript interfaces ensure correct usage
6. **Rich Feedback**: Detailed validation results help users fix issues
7. **Performance**: Optimized validation with Sets and early returns
8. **Compliance**: Built-in WCAG, GDPR, and security validations
9. **Debugging**: Detailed error messages with context
10. **Separation of Concerns**: Validation logic separate from business logic

---

## Related Patterns

- See `convex-validators.md` for Convex-specific validation patterns
- See `client-validation.md` for form validation patterns
- See `schema-validation.md` for Zod schema validation
- See `business-rules.md` for business logic validation
- See `error-messages.md` for user-friendly error display
- See `form-validation.md` for React Hook Form integration

---

*Extracted: 2026-02-18*
