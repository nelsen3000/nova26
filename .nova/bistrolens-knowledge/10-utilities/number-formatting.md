# Number Formatting Patterns

## Source
Extracted from BistroLens `utils/unitConversion.ts`, `utils/recipeScaler.ts`, `utils/bakersCalculator.ts`, `convex/publicRecipes.ts`, `components/MonitoringDashboard.tsx`, and throughout the codebase.

---

## Pattern: Number Formatting Utilities

BistroLens uses native JavaScript number methods for all formatting — no external libraries. Patterns cover currency, percentages, file sizes, recipe quantities (fractions), and unit conversions.

---

## Core Patterns

### 1. Currency Formatting

```typescript
// Simple currency display — used throughout the app
const formatCurrency = (amount: number): string => `$${amount.toFixed(2)}`;

// Usage in components
<p>${affiliate.total_earnings.toFixed(2)}</p>
<p>${revenueData.mrr.toFixed(2)}</p>
<span>+${commission.commission_amount.toFixed(2)}</span>

// With savings label
const savings = `Save $${(basePrice * 2).toFixed(2)}/year`;
```

### 2. Percentage Formatting

```typescript
// Percentage with 1 decimal place
const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`;

// Integer percentage (scores, ratings)
const formatScore = (score: number): string => `${(score * 100).toFixed(0)}%`;

// Usage
<span>{(metadata.safetyScore * 100).toFixed(0)}%</span>
<span>{(metrics.modularity * 100).toFixed(1)}%</span>
```

### 3. Count Formatting (K/M abbreviations)

```typescript
// convex/publicRecipes.ts
function formatCount(count: number): string {
  if (count < 10000) {
    const k = count / 1000;
    return k % 1 === 0 ? `${k}K+` : `${k.toFixed(1)}K+`;
  }
  return `${Math.floor(count / 1000)}K+`;
}

// Usage
formatCount(1500)   // → "1.5K+"
formatCount(2000)   // → "2K+"
formatCount(15000)  // → "15K+"
```

### 4. Rating Formatting

```typescript
// convex/publicRecipes.ts
function formatRating(avg: number | undefined, count: number): string {
  if (!avg || count === 0) return 'No ratings';
  return `${avg.toFixed(1)} (${formatCount(count)})`;
}

// Usage
formatRating(4.7, 1250)  // → "4.7 (1.3K+)"
formatRating(undefined, 0) // → "No ratings"
```

### 5. File Size Formatting

```typescript
// components/MonitoringDashboard.tsx
const formatBytes = (bytes: number): string => {
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// utils/bundleOptimizer.ts (inline version)
const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

// Usage
formatBytes(1536)       // → "1.5 KB"
formatBytes(2097152)    // → "2 MB"
```

### 6. Recipe Quantity Fractions

```typescript
// utils/recipeScaler.ts — converts decimals to culinary fractions
const toFraction = (decimal: number): string => {
  // Handle whole numbers
  if (Math.abs(decimal - Math.round(decimal)) < 0.01) {
    return `${Math.round(decimal)}`;
  }

  const tolerance = 0.05;
  const denominators = [2, 3, 4, 8, 16];
  const whole = Math.floor(decimal);
  const frac = decimal - whole;

  let bestMatch = { numerator: 0, denominator: 1, error: 1 };

  for (const den of denominators) {
    const num = Math.round(frac * den);
    const diff = Math.abs(frac - (num / den));
    if (diff < tolerance && diff < bestMatch.error) {
      bestMatch = { numerator: num, denominator: den, error: diff };
    }
  }

  if (bestMatch.error < tolerance) {
    if (bestMatch.numerator === 0) return `${whole}`;
    if (bestMatch.numerator === bestMatch.denominator) return `${whole + 1}`;

    // Simplify fraction using GCD
    const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
    const common = gcd(bestMatch.numerator, bestMatch.denominator);
    const num = bestMatch.numerator / common;
    const den = bestMatch.denominator / common;

    return whole > 0 ? `${whole} ${num}/${den}` : `${num}/${den}`;
  }

  // Fallback to decimal
  return decimal.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
};

// Usage
toFraction(0.5)   // → "1/2"
toFraction(1.25)  // → "1 1/4"
toFraction(2.0)   // → "2"
toFraction(0.333) // → "1/3"
```

### 7. Quantity Display with Smart Precision

```typescript
// utils/unitConversion.ts
export function formatQuantity(amount: number, unit: string): string {
  let rounded: number;

  if (amount < 0.1) {
    rounded = Math.round(amount * 1000) / 1000;  // 3 decimal places
  } else if (amount < 1) {
    rounded = Math.round(amount * 100) / 100;    // 2 decimal places
  } else if (amount < 10) {
    rounded = Math.round(amount * 10) / 10;      // 1 decimal place
  } else {
    rounded = Math.round(amount);                // whole numbers
  }

  // Convert common decimals to fractions
  const fractions: Record<string, string> = {
    '0.25': '1/4', '0.33': '1/3', '0.5': '1/2',
    '0.67': '2/3', '0.75': '3/4'
  };

  const decimalPart = rounded % 1;
  const wholePart = Math.floor(rounded);

  if (decimalPart > 0) {
    const fractionStr = fractions[decimalPart.toFixed(2)];
    if (fractionStr) {
      return wholePart > 0
        ? `${wholePart} ${fractionStr} ${unit}`
        : `${fractionStr} ${unit}`;
    }
  }

  return `${rounded} ${unit}`;
}

// Usage
formatQuantity(0.5, 'cup')   // → "1/2 cup"
formatQuantity(1.75, 'lb')   // → "1 3/4 lb"
formatQuantity(12, 'oz')     // → "12 oz"
```

### 8. Milliseconds to Human-Readable Time

```typescript
// components/MonitoringDashboard.tsx
const formatMs = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

// Usage
formatMs(450)   // → "450ms"
formatMs(2300)  // → "2.3s"
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Don't display raw floats to users
<span>{price}</span>                    // → "19.999999999"
<span>{rating}</span>                   // → "4.666666666"

// Don't use string concatenation for currency
const price = "$" + amount;            // ❌ No decimal control

// Don't use Math.round for currency (loses cents)
const rounded = Math.round(amount);    // ❌ $19.99 → $20
```

### ✅ Do This Instead

```typescript
// Always use toFixed(2) for currency
<span>${amount.toFixed(2)}</span>      // → "$19.99"

// Use toFixed(1) for ratings
<span>{rating.toFixed(1)} ★</span>    // → "4.7 ★"

// Use the fraction converter for recipe quantities
<span>{toFraction(scaledAmount)} {unit}</span>  // → "1 1/2 cups"
```

---

## When to Use This Pattern

✅ **Use for:**
- Displaying prices, earnings, costs (always `.toFixed(2)`)
- Recipe ingredient quantities (use fraction converter)
- Ratings and scores (`.toFixed(1)`)
- File sizes and performance metrics
- Large counts (K/M abbreviations)

❌ **Don't use for:**
- Financial calculations (use integer cents to avoid floating point errors)
- Complex statistical formatting (use a charting library's built-in formatters)

---

## Benefits

1. Zero dependencies — all native JavaScript
2. Fraction display makes recipe quantities feel natural
3. Smart precision adapts to the magnitude of the number
4. Consistent currency formatting across the entire app

---

## Related Patterns

- See `string-utilities.md` for text manipulation
- See `date-formatting.md` for date display
- See `validation-helpers.md` for numeric input validation
- See `utils/unitConversion.ts` for full unit conversion system

---

*Extracted: 2026-02-18*
