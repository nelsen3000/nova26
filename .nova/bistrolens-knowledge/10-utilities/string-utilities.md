# String Utilities

## Source
Extracted from BistroLens `lib/utils.ts`, `services/blogService.ts`, `utils/sanitizeHtml.ts`, `utils/contentFilter.ts`, and component patterns.

---

## Pattern: String Utility Functions

BistroLens uses a set of focused string utilities for normalization, sanitization, slug generation, and content filtering. These are spread across `lib/utils.ts` and dedicated utility files.

---

## Core Patterns

### 1. CSS Class Merging (`cn`)

The most-used string utility in the entire codebase — merges Tailwind classes safely.

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Usage — conditional classes without conflicts
<div className={cn(
  "base-class px-4 py-2",
  isActive && "bg-brand-primary text-white",
  isDisabled && "opacity-50 cursor-not-allowed",
  className // allow external override
)} />
```

### 2. Ingredient Normalization

```typescript
// lib/utils.ts
export function normalizeIngredient(input: string): string {
  if (!input) return '';

  // 1. Lowercase and trim
  let normalized = input.toLowerCase().trim();

  // 2. Remove common unit prefixes
  const prefixes = [
    'bag of', 'box of', 'can of', 'jar of', 'bottle of', 'cup of',
    'lb of', 'kg of', 'bunch of', 'head of', 'clove of', 'stick of'
  ];
  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix + ' ')) {
      normalized = normalized.slice(prefix.length + 1);
    }
  }

  // 3. Naive singularization
  if (normalized.endsWith('ies') && normalized.length > 3) {
    normalized = normalized.slice(0, -3) + 'y'; // berries -> berry
  } else if (normalized.endsWith('oes')) {
    normalized = normalized.slice(0, -2);        // tomatoes -> tomato
  } else if (
    normalized.endsWith('s') &&
    !['asparagus', 'hummus', 'cress', 'lens', 'couscous'].includes(normalized)
  ) {
    normalized = normalized.slice(0, -1);        // eggs -> egg
  }

  // 4. Title case for display
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

// Usage
normalizeIngredient("bag of onions")  // → "Onion"
normalizeIngredient("tomatoes")       // → "Tomato"
normalizeIngredient("asparagus")      // → "Asparagus" (exception preserved)
```

### 3. Slug Generation

```typescript
// services/blogService.ts
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')   // Remove special chars
    .replace(/[\s_-]+/g, '-')   // Spaces/underscores to hyphens
    .replace(/^-+|-+$/g, '');   // Trim leading/trailing hyphens
}

// Usage
slugify("My Awesome Recipe!")  // → "my-awesome-recipe"
slugify("Beef & Broccoli")     // → "beef-broccoli"
slugify("  Pad Thai  ")        // → "pad-thai"
```

### 4. HTML Sanitization

```typescript
// utils/sanitizeHtml.ts
export const sanitizeHtml = (input: string): string => {
  if (typeof input !== 'string') return '';

  // Remove script tags
  let sanitized = input.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ''
  );

  // Remove event handlers
  sanitized = sanitized.replace(/on\w+="[^"]*"/gi, '');
  sanitized = sanitized.replace(/on\w+='[^']*'/gi, '');

  // Remove javascript: hrefs
  sanitized = sanitized.replace(/href="javascript:[^"]*"/gi, '');
  sanitized = sanitized.replace(/href='javascript:[^']*'/gi, '');

  return sanitized;
};

// Usage — sanitize user-provided content before rendering
const safeContent = sanitizeHtml(userInput);
```

### 5. Profanity Filtering

```typescript
// utils/contentFilter.ts
const BLOCKLIST = ["damn", "hell", "crap", /* ... */];
const BLOCKLIST_REGEX = new RegExp(`\\b(${BLOCKLIST.join('|')})\\b`, 'i');

export const containsProfanity = (text: string): boolean => {
  if (!text) return false;
  return BLOCKLIST_REGEX.test(text);
};

export const maskProfanity = (text: string): string => {
  if (!text) return text;
  return text.replace(
    new RegExp(`\\b(${BLOCKLIST.join('|')})\\b`, 'gi'),
    (match) => '*'.repeat(match.length)
  );
};

// Usage
containsProfanity("This is terrible")  // → true
maskProfanity("This is terrible")      // → "This is ********"
```

### 6. Category Badge Styles (String → CSS)

```typescript
// lib/utils.ts
export function getCategoryBadgeStyles(category: string): string {
  const map: Record<string, string> = {
    'Technique': 'bg-brand-primary text-brand-white',
    'Breakfast': 'bg-brand-yellow text-brand-black',
    'Cocktail': 'bg-brand-black text-brand-yellow',
    // ...
  };

  const baseStyle = "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-sm transition-all";

  if (map[category]) return `${map[category]} ${baseStyle}`;

  // Deterministic fallback via hash
  const hash = category.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const variants = [
    'bg-brand-primary text-brand-white',
    'bg-brand-yellow text-brand-black',
    'bg-brand-black text-brand-white',
  ];
  return `${variants[hash % variants.length]} ${baseStyle}`;
}
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Don't concatenate Tailwind classes directly — conflicts arise
const classes = `base-class ${isActive ? 'bg-blue-500' : 'bg-gray-500'} ${extraClass}`;
// If extraClass has bg-*, it won't override properly

// Don't use innerHTML with unsanitized user content
element.innerHTML = userInput; // ❌ XSS risk

// Don't build slugs with simple replace
const slug = title.replace(' ', '-'); // ❌ Only replaces first space
```

### ✅ Do This Instead

```typescript
// Use cn() for all class merging
const classes = cn("base-class", isActive ? "bg-blue-500" : "bg-gray-500", extraClass);

// Always sanitize before rendering as HTML
const safe = sanitizeHtml(userInput);
element.innerHTML = safe; // ✅ (or better: use React's JSX which escapes by default)

// Use the full slugify function
const slug = slugify(title); // ✅ Handles all edge cases
```

---

## When to Use This Pattern

✅ **Use for:**
- Merging Tailwind classes conditionally (`cn`)
- Normalizing user-typed ingredient names
- Generating URL-safe slugs from titles
- Sanitizing user-provided HTML content
- Filtering inappropriate text in user inputs

❌ **Don't use for:**
- Complex text parsing (use a dedicated parser)
- Internationalization/i18n (use the `useTranslation` hook)
- Rich text editing (use a proper editor library)

---

## Benefits

1. `cn()` eliminates Tailwind class conflicts automatically
2. `normalizeIngredient` handles edge cases like irregular plurals
3. `slugify` produces consistent, URL-safe identifiers
4. `sanitizeHtml` provides basic XSS protection for user content
5. Profanity filter uses whole-word matching to avoid false positives (Scunthorpe problem)

---

## Related Patterns

- See `validation-helpers.md` for input validation
- See `number-formatting.md` for numeric string formatting
- See `../04-ui-components/button-variants.md` for `cn()` usage in components

---

*Extracted: 2026-02-18*
