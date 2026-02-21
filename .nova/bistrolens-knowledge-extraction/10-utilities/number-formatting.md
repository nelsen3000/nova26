# Number Formatting Utilities

## Source
Extracted from BistroLens:
- `convex/publicRecipes.ts` (formatCount, formatRating)
- `services/stripeService.ts` (getPricingInfo)
- `services/substitutionService.ts` (quantity formatting)
- `services/unifiedShoppingListService.ts` (cost formatting)
- Various service files (toFixed, toLocaleString patterns)

---

## Pattern: Number Formatting Utilities

Number formatting utilities provide consistent, user-friendly display of numeric values across the application. These utilities handle counts, currency, percentages, decimals, and large numbers with appropriate precision and formatting.

---

## Core Formatting Functions

### 1. Format Count (Social Metrics)

Format counts for display with smart abbreviations (100+, 1K+, 1.1K+).

```typescript
/**
 * Format count for display (exact <100, then 100+, 200+, 1K+, 1.1K+...)
 * Used for social metrics like favorites, views, ratings
 */
function formatCount(count: number): string {
  if (count < 100) return count.toString();
  if (count < 1000) return `${Math.floor(count / 100) * 100}+`;
  if (count < 10000) {
    const k = count / 1000;
    return k % 1 === 0 ? `${k}K+` : `${k.toFixed(1)}K+`;
  }
  return `${Math.floor(count / 1000)}K+`;
}

// Usage examples
formatCount(42);      // "42"
formatCount(156);     // "100+"
formatCount(789);     // "700+"
formatCount(1000);    // "1K+"
formatCount(1234);    // "1.2K+"
formatCount(5000);    // "5K+"
formatCount(12500);   // "12K+"
```

### 2. Format Rating

Format rating with average and count display.

```typescript
/**
 * Format rating for display
 * Shows average rating with formatted count
 */
function formatRating(avg: number | undefined, count: number): string {
  if (!avg || count === 0) return 'No ratings';
  return `${avg.toFixed(1)} (${formatCount(count)})`;
}

// Usage examples
formatRating(undefined, 0);  // "No ratings"
formatRating(4.7, 0);        // "No ratings"
formatRating(4.7, 42);       // "4.7 (42)"
formatRating(4.7, 1234);     // "4.7 (1.2K+)"
formatRating(3.8, 5000);     // "3.8 (5K+)"
```

### 3. Format Currency

Format currency values with proper decimal places.

```typescript
/**
 * Format currency for display
 * Always shows 2 decimal places for consistency
 */
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// Usage examples
formatCurrency(9.99);    // "$9.99"
formatCurrency(10);      // "$10.00"
formatCurrency(1234.5);  // "$1234.50"

// With locale support
function formatCurrencyLocale(amount: number, locale = 'en-US', currency = 'USD'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

// Usage examples
formatCurrencyLocale(1234.56);              // "$1,234.56"
formatCurrencyLocale(1234.56, 'de-DE', 'EUR'); // "1.234,56 €"
```

### 4. Format Percentage

Format percentage values with appropriate precision.

```typescript
/**
 * Format percentage for display
 * @param value - Decimal value (0.15 = 15%)
 * @param decimals - Number of decimal places (default: 1)
 */
function formatPercentage(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// Usage examples
formatPercentage(0.15);      // "15.0%"
formatPercentage(0.156);     // "15.6%"
formatPercentage(0.156, 2);  // "15.60%"
formatPercentage(0.9);       // "90.0%"
formatPercentage(1);         // "100.0%"
```

### 5. Format Decimal (Smart Trailing Zeros)

Format decimal numbers by removing unnecessary trailing zeros.

```typescript
/**
 * Format decimal number, removing trailing zeros
 * Used for recipe quantities and measurements
 */
function formatDecimal(value: number, maxDecimals: number = 2): string {
  const formatted = value % 1 === 0 
    ? value.toString()
    : value.toFixed(maxDecimals).replace(/\.?0+$/, '');
  
  return formatted;
}

// Usage examples
formatDecimal(2);       // "2"
formatDecimal(2.5);     // "2.5"
formatDecimal(2.50);    // "2.5"
formatDecimal(2.125);   // "2.13" (rounded to 2 decimals)
formatDecimal(2.100);   // "2.1"
formatDecimal(0.333);   // "0.33"
```

### 6. Format Large Numbers (Locale-Aware)

Format large numbers with thousands separators.

```typescript
/**
 * Format large numbers with locale-aware separators
 */
function formatLargeNumber(value: number, locale: string = 'en-US'): string {
  return value.toLocaleString(locale);
}

// Usage examples
formatLargeNumber(1234);        // "1,234"
formatLargeNumber(1234567);     // "1,234,567"
formatLargeNumber(1234.56);     // "1,234.56"
formatLargeNumber(1234, 'de-DE'); // "1.234"
```

---

## Real-World Examples from BistroLens

### Example 1: Recipe Metrics Display

```typescript
// From convex/publicRecipes.ts
export const getPublicRecipes = query({
  handler: async (ctx, args) => {
    const results = await fetchRecipes();
    
    // Format for display
    const formatted = results.map(recipe => ({
      ...recipe,
      displayFavorites: formatCount(recipe.favoritesCount),
      displayMade: formatCount(recipe.madeCount),
      displayRating: formatRating(recipe.ratingAvg, recipe.ratingCount),
    }));
    
    return { recipes: formatted };
  },
});

// UI displays:
// "4.7 (1.2K+) ⭐ • 5K+ favorites • 3.4K+ made"
```

### Example 2: Pricing Display

```typescript
// From services/stripeService.ts
getPricingInfo(tier: SubscriptionTier, billingPeriod: 'monthly' | 'annual') {
  const basePrice = tierInfo.price;

  if (billingPeriod === 'annual') {
    const annualPrice = basePrice * 10; // 2 months free
    return {
      price: annualPrice,
      originalPrice: basePrice * 12,
      savings: `Save $${(basePrice * 2).toFixed(2)}/year`,
      features: this.getTierFeatures(tier)
    };
  }

  return {
    price: basePrice,
    features: this.getTierFeatures(tier)
  };
}

// UI displays:
// "$99.00/year • Save $19.80/year"
```

### Example 3: Recipe Quantity Scaling

```typescript
// From services/substitutionService.ts
function scaleQuantity(quantity: string, multiplier: number): string {
  const qtyMatch = quantity.match(/^([\d.]+)\s*(.*)$/);
  if (!qtyMatch) return quantity;
  
  const numericValue = parseFloat(qtyMatch[1]);
  const unit = qtyMatch[2];
  const adjustedValue = numericValue * multiplier;
  
  // Format nicely - remove trailing zeros
  const formatted = adjustedValue % 1 === 0 
    ? adjustedValue.toString()
    : adjustedValue.toFixed(2).replace(/\.?0+$/, '');
  
  return `${formatted} ${unit}`.trim();
}

// Usage examples
scaleQuantity("2 cups", 1.5);    // "3 cups"
scaleQuantity("1.5 tsp", 2);     // "3 tsp"
scaleQuantity("0.25 lb", 4);     // "1 lb"
scaleQuantity("1.333 oz", 1.5);  // "2 oz"
```

### Example 4: Shopping List Cost Summary

```typescript
// From services/unifiedShoppingListService.ts
exportAsText(): string {
  const list = this.getShoppingList();
  
  let content = `Shopping List\n`;
  content += `Generated: ${list.created.toLocaleDateString()}\n`;
  content += `Total Items: ${list.totalItems} | Estimated Cost: $${list.estimatedCost.toFixed(2)}\n`;
  content += `===========================================\n\n`;
  
  return content;
}

// Output:
// Shopping List
// Generated: 2/18/2026
// Total Items: 24 | Estimated Cost: $87.45
// ===========================================
```

### Example 5: Analytics Metrics

```typescript
// From services/abTestingEngine.ts
function calculateImprovement(bestVariant: Variant, controlVariant: Variant): string {
  const improvement = ((bestVariant.conversionRate - controlVariant.conversionRate) 
    / controlVariant.conversionRate) * 100;
  
  return `Implement ${bestVariant.name} for ${improvement.toFixed(1)}% improvement`;
}

// Output:
// "Implement Variant B for 15.3% improvement"
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// 1. Inconsistent decimal places
const price1 = `$${amount.toFixed(1)}`;  // "$9.9"
const price2 = `$${amount}`;             // "$9.9"
const price3 = `$${amount.toFixed(3)}`;  // "$9.900"

// 2. No handling of edge cases
function formatCount(count: number): string {
  return `${count / 1000}K+`;  // "0.042K+" for 42
}

// 3. Hardcoded locale assumptions
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;  // Only works for USD
}

// 4. Not removing trailing zeros
function formatQuantity(value: number): string {
  return value.toFixed(2);  // "2.00" instead of "2"
}

// 5. Inconsistent abbreviations
formatCount(1500);  // "1.5K+" in one place
formatCount(1500);  // "1500" in another place
formatCount(1500);  // "1.50K" in yet another place
```

### ✅ Do This Instead

```typescript
// 1. Consistent decimal places for currency
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;  // Always 2 decimals
}

// 2. Handle all edge cases
function formatCount(count: number): string {
  if (count < 100) return count.toString();
  if (count < 1000) return `${Math.floor(count / 100) * 100}+`;
  if (count < 10000) {
    const k = count / 1000;
    return k % 1 === 0 ? `${k}K+` : `${k.toFixed(1)}K+`;
  }
  return `${Math.floor(count / 1000)}K+`;
}

// 3. Use Intl.NumberFormat for locale support
function formatCurrency(amount: number, locale = 'en-US', currency = 'USD'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

// 4. Remove trailing zeros intelligently
function formatDecimal(value: number, maxDecimals: number = 2): string {
  return value % 1 === 0 
    ? value.toString()
    : value.toFixed(maxDecimals).replace(/\.?0+$/, '');
}

// 5. Create centralized formatting utilities
// Use the same function everywhere for consistency
```

---

## When to Use This Pattern

✅ **Use for:**
- Social metrics (likes, views, followers, ratings)
- Currency display (prices, costs, savings)
- Recipe quantities and measurements
- Percentage displays (discounts, improvements, progress)
- Large numbers (statistics, analytics)
- File sizes (KB, MB, GB)
- Any numeric value shown to users

❌ **Don't use for:**
- Internal calculations (use raw numbers)
- Database storage (store unformatted values)
- API responses (format on client side)
- Precise scientific calculations (use appropriate precision)

---

## Benefits

1. **Consistency**: All numbers formatted the same way across the app
2. **Readability**: Users can quickly understand large numbers (1.2K+ vs 1,234)
3. **Localization**: Easy to adapt for different locales and currencies
4. **Clean Display**: Removes unnecessary trailing zeros and decimal places
5. **User-Friendly**: Appropriate precision for each use case
6. **Maintainability**: Centralized formatting logic
7. **Accessibility**: Screen readers handle formatted numbers well

---

## Related Patterns

- See `date-formatting.md` for date/time formatting utilities
- See `string-utilities.md` for text formatting and manipulation
- See `validation-helpers.md` for numeric validation
- See `ui-components/loading-states.md` for skeleton number displays

---

## TypeScript Types

```typescript
// Utility types for number formatting
type FormatOptions = {
  decimals?: number;
  locale?: string;
  currency?: string;
  abbreviate?: boolean;
};

type FormattedNumber = string;
type FormattedCurrency = string;
type FormattedPercentage = string;

// Example usage with types
function formatNumber(
  value: number, 
  options: FormatOptions = {}
): FormattedNumber {
  const { decimals = 2, locale = 'en-US', abbreviate = false } = options;
  
  if (abbreviate && value >= 1000) {
    return formatCount(value);
  }
  
  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
```

---

## Testing Considerations

```typescript
// Test edge cases
describe('formatCount', () => {
  it('handles small numbers', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(42)).toBe('42');
    expect(formatCount(99)).toBe('99');
  });
  
  it('handles hundreds', () => {
    expect(formatCount(100)).toBe('100+');
    expect(formatCount(156)).toBe('100+');
    expect(formatCount(999)).toBe('900+');
  });
  
  it('handles thousands', () => {
    expect(formatCount(1000)).toBe('1K+');
    expect(formatCount(1234)).toBe('1.2K+');
    expect(formatCount(5000)).toBe('5K+');
  });
  
  it('handles ten thousands and above', () => {
    expect(formatCount(10000)).toBe('10K+');
    expect(formatCount(12500)).toBe('12K+');
    expect(formatCount(999999)).toBe('999K+');
  });
});

describe('formatDecimal', () => {
  it('removes trailing zeros', () => {
    expect(formatDecimal(2.00)).toBe('2');
    expect(formatDecimal(2.50)).toBe('2.5');
    expect(formatDecimal(2.10)).toBe('2.1');
  });
  
  it('preserves necessary decimals', () => {
    expect(formatDecimal(2.5)).toBe('2.5');
    expect(formatDecimal(2.33)).toBe('2.33');
  });
  
  it('rounds to max decimals', () => {
    expect(formatDecimal(2.125)).toBe('2.13');
    expect(formatDecimal(2.999)).toBe('3');
  });
});
```

---

*Extracted: 2026-02-18*
