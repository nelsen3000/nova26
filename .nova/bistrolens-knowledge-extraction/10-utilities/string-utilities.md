# String Utilities

## Source
Extracted from BistroLens:
- `services/blogService.ts` (slugify)
- `components/RecipePDFLandscape/utils.ts` (truncateText, formatTruncationIndicator)
- `convex/securityGuards.ts` (sanitizeString)
- Various files (capitalize, trim, replace patterns)

---

## Pattern: String Manipulation Utilities

Common string manipulation functions for formatting, sanitization, and transformation. These utilities handle URL slugs, text truncation, input sanitization, and case transformations.

---

## 1. Slugify - URL-Safe String Conversion

### Code Example

```typescript
/**
 * Convert text to URL-safe slug
 * Removes special characters, converts to lowercase, replaces spaces with hyphens
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')      // Remove non-word chars except spaces and hyphens
    .replace(/[\s_-]+/g, '-')      // Replace spaces, underscores, multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '');      // Remove leading/trailing hyphens
}

// Usage
const slug = slugify("Hello World! This is a Test");
// Result: "hello-world-this-is-a-test"

const slug2 = slugify("  React & TypeScript  ");
// Result: "react-typescript"
```

---

## 2. Text Truncation with Ellipsis

### Code Example

```typescript
/**
 * Truncate text with ellipsis if it exceeds max length
 * Ensures ellipsis is included in the max length
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text || '';
  return text.slice(0, maxLength - 3).trim() + '...';
}

// Usage
const description = "This is a very long description that needs to be truncated";
const short = truncateText(description, 30);
// Result: "This is a very long desc..."

// Edge cases
truncateText("", 20);           // Result: ""
truncateText("Short", 20);      // Result: "Short"
truncateText(null as any, 20);  // Result: ""
```

---

## 3. Truncation Indicator Formatting

### Code Example

```typescript
/**
 * Format truncation indicator for displaying remaining count
 * Returns empty string if count is 0 or negative
 */
export function formatTruncationIndicator(count: number): string {
  if (count <= 0) return '';
  return `(+${count} more)`;
}

// Usage in UI
const totalItems = 25;
const displayedItems = 10;
const remaining = totalItems - displayedItems;

console.log(`Showing ${displayedItems} items ${formatTruncationIndicator(remaining)}`);
// Result: "Showing 10 items (+15 more)"
```

---

## 4. Input Sanitization (XSS Prevention)

### Code Example

```typescript
/**
 * Sanitize string input for basic XSS prevention
 * Removes null bytes and encodes HTML entities
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
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, "");
  
  // Basic HTML entity encoding for dangerous characters
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
  
  return sanitized;
}

// Usage
const userInput = '<script>alert("XSS")</script>';
const safe = sanitizeString(userInput);
// Result: "&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;"
```

---

## 5. Capitalize First Letter

### Code Example

```typescript
/**
 * Capitalize the first letter of a string
 */
function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Usage
capitalize("hello");      // Result: "Hello"
capitalize("react");      // Result: "React"
capitalize("UPPERCASE");  // Result: "UPPERCASE"
capitalize("");           // Result: ""
```

---

## 6. Common String Transformations

### Code Example

```typescript
/**
 * Collection of common string transformations
 */

// Title Case - capitalize first letter of each word
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Usage
toTitleCase("hello world from typescript");
// Result: "Hello World From Typescript"

// Trim and normalize whitespace
function normalizeWhitespace(str: string): string {
  return str
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .trim();               // Remove leading/trailing whitespace
}

// Usage
normalizeWhitespace("  hello    world  ");
// Result: "hello world"

// Remove special characters
function removeSpecialChars(str: string): string {
  return str.replace(/[^\w\s]/g, '');
}

// Usage
removeSpecialChars("Hello, World! #2024");
// Result: "Hello World 2024"
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// DON'T: Forget to handle null/undefined
function badTruncate(text: string, max: number): string {
  return text.slice(0, max) + '...';  // Crashes if text is null
}

// DON'T: Forget to account for ellipsis length
function badTruncate2(text: string, max: number): string {
  if (text.length > max) {
    return text.slice(0, max) + '...';  // Result is longer than max!
  }
  return text;
}

// DON'T: Use innerHTML with unsanitized user input
function dangerousRender(userInput: string) {
  element.innerHTML = userInput;  // XSS vulnerability!
}

// DON'T: Forget to trim before slugifying
function badSlugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-');
  // Result: "  hello world  " → "--hello-world--"
}

// DON'T: Mutate the original string (strings are immutable anyway)
function confusingTransform(str: string): void {
  str.toUpperCase();  // This doesn't modify str, returns new string
  // Caller expects str to be modified but it's not
}
```

### ✅ Do This Instead

```typescript
// DO: Handle null/undefined gracefully
function safeTruncate(text: string | null | undefined, max: number): string {
  if (!text || text.length <= max) return text || '';
  return text.slice(0, max - 3).trim() + '...';
}

// DO: Account for ellipsis in max length
function properTruncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text || '';
  return text.slice(0, maxLength - 3).trim() + '...';  // Ellipsis counts toward max
}

// DO: Sanitize before rendering
function safeRender(userInput: string) {
  element.textContent = sanitizeString(userInput);  // Safe!
}

// DO: Trim and clean thoroughly
function properSlugify(text: string): string {
  return text
    .toLowerCase()
    .trim()                        // Remove leading/trailing spaces
    .replace(/[^\w\s-]/g, '')      // Remove special chars
    .replace(/[\s_-]+/g, '-')      // Normalize separators
    .replace(/^-+|-+$/g, '');      // Remove edge hyphens
}

// DO: Return the transformed value
function clearTransform(str: string): string {
  return str.toUpperCase();  // Explicit return
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Creating URL-friendly slugs from titles or names
- Displaying truncated text in UI with character limits
- Sanitizing user input before storage or display
- Formatting text for consistent display (capitalization, whitespace)
- Preventing XSS attacks through HTML entity encoding
- Normalizing text input for comparison or search

❌ **Don't use for:**
- Complex HTML parsing (use a proper HTML parser like DOMParser)
- Internationalization (use i18n libraries for locale-specific formatting)
- Markdown or rich text processing (use dedicated libraries)
- Cryptographic operations (use proper crypto libraries)
- Regular expression-heavy transformations (consider dedicated text processing libraries)

---

## Benefits

1. **Security**: Sanitization prevents XSS attacks by encoding dangerous characters
2. **Consistency**: Standardized string transformations ensure uniform data format
3. **User Experience**: Truncation with ellipsis provides clean UI without overflow
4. **SEO-Friendly**: Slugify creates clean, readable URLs
5. **Type Safety**: TypeScript types catch null/undefined errors at compile time
6. **Reusability**: Small, focused functions can be composed for complex transformations
7. **Performance**: Simple string operations are fast and don't require heavy libraries

---

## Related Patterns

- See `validation-helpers.md` for email and URL validation patterns
- See `date-formatting.md` for date/time string formatting
- See `number-formatting.md` for numeric string formatting
- See `convex-validators.md` for server-side input validation
- See `error-messages.md` for user-friendly error text formatting

---

*Extracted: 2026-02-18*
