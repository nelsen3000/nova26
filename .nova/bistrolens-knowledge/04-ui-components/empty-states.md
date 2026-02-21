# Empty State Patterns

## Source
Extracted from BistroLens components:
- `components/NotificationCenter.tsx`
- `components/SkillProfile.tsx`
- `components/PublicRecipesPage.tsx`
- `components/BentoRecipeLibrary.tsx`
- `components/GlobalSearch.tsx`
- `components/CookingChallengesModal.tsx`
- `components/TopRecipesView.tsx`
- `components/IngredientSwapSheet.tsx`

---

## Pattern: Empty State Components

Empty states communicate to users when there's no content to display, providing context and often suggesting next actions. Well-designed empty states turn potentially frustrating moments into opportunities for engagement.

---

## Core Empty State Patterns

### 1. Simple Empty State (No Data Yet)

**Use Case:** When a feature has no data because the user hasn't used it yet.

```typescript
// Example: Notification Center Empty State
<div className="py-8 text-center text-brand-black/60 text-sm">
  <BellIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
  No notifications yet.
</div>
```

**Key Elements:**
- Icon (large, centered, low opacity)
- Short message explaining the empty state
- Centered layout
- Muted text color

---

### 2. Empty State with Call-to-Action

**Use Case:** When users can take action to populate the empty state.

```typescript
// Example: Public Recipes Page Empty State
<div className="text-center py-20">
  <div className="text-6xl mb-4">📖</div>
  <h2 className="text-2xl font-bold text-brand-black mb-2">No recipes yet</h2>
  <p className="text-brand-black/60 mb-6">
    Our editorial team is working on publishing amazing recipes. Check back soon!
  </p>
  <button
    onClick={() => { playClickSound(); onBack(); }}
    className="px-6 py-3 bg-brand-primary text-brand-on-primary font-bold rounded-xl hover:bg-brand-primary/90 transition-colors"
  >
    Generate Your Own Recipe
  </button>
</div>
```

**Key Elements:**
- Large emoji or icon (text-6xl)
- Bold heading explaining the situation
- Descriptive text providing context
- Primary action button with clear label
- Generous spacing (py-20)

---

### 3. Empty State with Guidance

**Use Case:** When users need help understanding what to do next.

```typescript
// Example: Cooking History Empty State
<div className="text-center py-8 text-gray-500">
  <div className="text-4xl mb-2">📝</div>
  <div>No cooking history yet</div>
  <div className="text-sm">Complete recipes to track your progress!</div>
</div>
```

**Key Elements:**
- Icon/emoji
- Status message
- Instructional text explaining how to populate

---

### 4. Filtered Empty State (No Results)

**Use Case:** When filters or search return no results.

```typescript
// Example: Recipe Library Filtered Empty State
<div className="text-center py-12">
  <div className="text-6xl mb-4">🍽️</div>
  <h3 className="text-xl font-bold text-brand-black mb-2">
    No recipes found
  </h3>
  <p className="text-brand-black/60">
    Try adjusting your filters or check back later for new recipes.
  </p>
</div>
```

**Key Elements:**
- Acknowledges user action (filtering/searching)
- Suggests remediation (adjust filters)
- Maintains visual consistency with other empty states

---

### 5. Search Empty State

**Use Case:** When search returns no results.

```typescript
// Example: Global Search No Results
{query.trim() && !isLoading && results.length === 0 && (
  <div className="p-4 text-center text-brand-black/60">
    <p>No results found for "{query}"</p>
    <p className="text-sm mt-1">Try different keywords or check your spelling</p>
  </div>
)}
```

**Key Elements:**
- Shows the search query
- Provides helpful suggestions
- Compact layout (less dramatic than other empty states)

---

### 6. Empty State with Alternative Content

**Use Case:** When showing suggestions or alternatives instead of truly empty.

```typescript
// Example: Ingredient Swap Sheet No Swaps
<div className="text-center py-8">
  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
    <span className="text-2xl">🤔</span>
  </div>
  <p className="text-gray-600 font-medium">No swaps found</p>
  <p className="text-sm text-gray-400 mt-1">
    We don't have substitutes for this ingredient yet
  </p>
</div>
```

**Key Elements:**
- Icon in a circular container
- Primary message (font-medium)
- Secondary explanation (smaller, lighter)

---

### 7. Error-Adjacent Empty State

**Use Case:** When data failed to load or connection issues occurred.

```typescript
// Example: Convex Connection Error
<div className="text-center py-12 bg-brand-white rounded-2xl border border-brand-black/20">
  <div className="text-red-500 text-5xl mb-4">⚠️</div>
  <h2 className="text-xl font-bold text-brand-black mb-2">Connection Issue</h2>
  <p className="text-brand-black/60 mb-4">{convexError}</p>
  <button
    onClick={() => { setConvexError(null); window.location.reload(); }}
    className="px-6 py-3 bg-brand-primary text-brand-on-primary font-bold rounded-xl hover:bg-brand-primary/90 transition-colors"
  >
    Try Again
  </button>
</div>
```

**Key Elements:**
- Warning icon (red color)
- Clear error heading
- Error message
- Retry action button

---

### 8. Conditional Empty State (Feature-Specific)

**Use Case:** When empty state depends on feature availability.

```typescript
// Example: Challenges Modal Empty State
{Object.keys(challengeDefinitions).length === 0 ? (
  <div className="text-center py-8">
    <p className="text-lg text-brand-black/60">No challenges yet. Keep cooking!</p>
  </div>
) : (
  // Render challenges
)}
```

**Key Elements:**
- Simple, encouraging message
- Minimal styling
- Contextual to the feature

---

## Empty State Component Template

```typescript
interface EmptyStateProps {
  icon?: React.ReactNode;
  emoji?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'search' | 'error' | 'minimal';
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  emoji,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'default'
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'search':
        return 'p-4';
      case 'error':
        return 'py-12 bg-brand-white rounded-2xl border border-brand-black/20';
      case 'minimal':
        return 'py-8';
      default:
        return 'py-20';
    }
  };

  const getIconSize = () => {
    switch (variant) {
      case 'search':
      case 'minimal':
        return 'text-4xl';
      case 'error':
        return 'text-5xl';
      default:
        return 'text-6xl';
    }
  };

  return (
    <div className={`text-center ${getVariantStyles()}`}>
      {/* Icon or Emoji */}
      {emoji && (
        <div className={`${getIconSize()} mb-4`}>
          {emoji}
        </div>
      )}
      {icon && (
        <div className="flex justify-center mb-4">
          {icon}
        </div>
      )}

      {/* Title */}
      <h3 className={`font-bold text-brand-black mb-2 ${
        variant === 'minimal' ? 'text-base' : 'text-xl'
      }`}>
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className={`text-brand-black/60 ${
          variant === 'search' || variant === 'minimal' ? 'text-sm' : 'text-base'
        } ${actionLabel ? 'mb-6' : ''}`}>
          {description}
        </p>
      )}

      {/* Action Button */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-3 bg-brand-primary text-brand-on-primary font-bold rounded-xl hover:bg-brand-primary/90 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
```

**Usage Examples:**

```typescript
// Simple empty state
<EmptyState
  emoji="📝"
  title="No cooking history yet"
  description="Complete recipes to track your progress!"
  variant="minimal"
/>

// Empty state with action
<EmptyState
  emoji="📖"
  title="No recipes yet"
  description="Our editorial team is working on publishing amazing recipes. Check back soon!"
  actionLabel="Generate Your Own Recipe"
  onAction={handleGenerateRecipe}
/>

// Search empty state
<EmptyState
  title={`No results found for "${query}"`}
  description="Try different keywords or check your spelling"
  variant="search"
/>

// Error state
<EmptyState
  emoji="⚠️"
  title="Connection Issue"
  description={errorMessage}
  actionLabel="Try Again"
  onAction={handleRetry}
  variant="error"
/>
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// 1. Empty state without context
<div>No data</div>

// 2. Empty state that looks like an error
<div className="text-red-500">
  <p>Nothing here!</p>
</div>

// 3. Empty state with too much text
<div>
  <p>We couldn't find any recipes matching your criteria. This could be because...</p>
  <p>Here are some things you can try...</p>
  <p>If the problem persists...</p>
</div>

// 4. Empty state without visual hierarchy
<div>
  No recipes found. Try adjusting your filters or check back later.
</div>

// 5. Empty state with broken action
<button onClick={undefined}>
  Get Started
</button>
```

### ✅ Do This Instead

```typescript
// 1. Empty state with clear context
<div className="text-center py-8">
  <div className="text-4xl mb-2">🍽️</div>
  <p className="text-brand-black/60">No recipes saved yet</p>
</div>

// 2. Empty state with appropriate tone
<div className="text-center py-8 text-brand-black/60">
  <BellIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
  <p>No notifications yet</p>
</div>

// 3. Empty state with concise messaging
<div className="text-center py-12">
  <div className="text-6xl mb-4">🍽️</div>
  <h3 className="text-xl font-bold text-brand-black mb-2">
    No recipes found
  </h3>
  <p className="text-brand-black/60">
    Try adjusting your filters or check back later.
  </p>
</div>

// 4. Empty state with clear hierarchy
<div className="text-center py-20">
  <div className="text-6xl mb-4">📖</div>
  <h2 className="text-2xl font-bold text-brand-black mb-2">No recipes yet</h2>
  <p className="text-brand-black/60 mb-6">
    Our editorial team is working on publishing amazing recipes.
  </p>
</div>

// 5. Empty state with working action
<button
  onClick={() => { playClickSound(); onAction(); }}
  className="px-6 py-3 bg-brand-primary text-brand-on-primary font-bold rounded-xl hover:bg-brand-primary/90 transition-colors"
>
  Get Started
</button>
```

---

## When to Use This Pattern

✅ **Use for:**
- Lists or grids with no items
- Search results with no matches
- Filtered views with no results
- Features not yet used by the user
- Data that failed to load
- Collections that are empty by default

❌ **Don't use for:**
- Loading states (use skeletons instead)
- Temporary states during data fetching
- Error states (use error components)
- States that will resolve in < 1 second

---

## Benefits

1. **Reduces User Confusion**: Clear messaging explains why content is missing
2. **Guides User Action**: CTAs help users understand what to do next
3. **Maintains Visual Consistency**: Empty states keep the UI from feeling broken
4. **Improves Perceived Performance**: Better than showing nothing or a spinner
5. **Encourages Engagement**: Well-designed empty states can drive feature adoption
6. **Provides Context**: Helps users understand the feature's purpose

---

## Design Guidelines

### Visual Hierarchy
1. **Icon/Emoji** (largest, most prominent)
2. **Heading** (bold, clear statement)
3. **Description** (supporting context)
4. **Action Button** (if applicable)

### Spacing
- Use generous padding (py-8 to py-20)
- Maintain consistent spacing between elements
- Center-align all content

### Typography
- **Heading**: text-xl to text-2xl, font-bold
- **Description**: text-sm to text-base, text-brand-black/60
- **Minimal variants**: Smaller text sizes

### Icons
- Use emojis for friendly, approachable feel
- Use icon components for more professional contexts
- Size: w-8 h-8 for minimal, text-4xl to text-6xl for emojis
- Opacity: 30% for icon components to reduce visual weight

### Colors
- **Default**: text-brand-black/60 (muted)
- **Error**: text-red-500 or text-red-600
- **Success**: text-green-600
- **Warning**: text-amber-600

### Tone
- **Encouraging**: "No recipes yet" vs "No recipes found"
- **Helpful**: Provide next steps or suggestions
- **Concise**: Keep messages short and scannable
- **Contextual**: Match the feature's purpose and user expectations

---

## Accessibility Considerations

```typescript
// Add ARIA labels for screen readers
<div 
  role="status" 
  aria-live="polite"
  className="text-center py-8"
>
  <BellIcon 
    className="w-8 h-8 mx-auto mb-2 opacity-30"
    aria-hidden="true"
  />
  <p>No notifications yet</p>
</div>

// Ensure buttons are keyboard accessible
<button
  onClick={onAction}
  className="px-6 py-3 bg-brand-primary text-brand-on-primary font-bold rounded-xl hover:bg-brand-primary/90 transition-colors focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
  aria-label="Generate your first recipe"
>
  Get Started
</button>
```

---

## Related Patterns

- See `loading-states.md` for skeleton loaders and loading indicators
- See `error-states.md` for error handling and recovery patterns
- See `toast-notifications.md` for transient feedback messages
- See `button-variants.md` for CTA button styling

---

*Extracted: 2026-02-18*
