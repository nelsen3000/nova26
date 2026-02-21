# Screen Reader Patterns

## Source
Extracted from BistroLens `.kiro/steering/50-ACCESSIBILITY-WCAG-COMPLIANCE.md`, `components/PersonalizationDashboard.tsx`, `components/GroceryListModal.tsx`, `components/CookieConsent.tsx`, `components/ui/TextRotate.tsx`, `components/Toast.tsx`, `components/SocialProofBadge.tsx`, `components/design-system/Typography.tsx`

---

## Pattern: sr-only Text for Icon Buttons

Visually hidden text gives screen readers a meaningful label when the visible UI is icon-only.

### Code Example

```tsx
// components/PersonalizationDashboard.tsx
// The "✕" character is visible; sr-only provides the accessible name
<button
  className="p-2 hover:bg-brand-white rounded-lg transition-colors"
>
  <span className="sr-only">Close</span>
  ✕
</button>

// components/GroceryListModal.tsx — label hidden visually but read by AT
<label htmlFor="new-grocery-item" className="sr-only">
  Add new grocery item
</label>
<input
  id="new-grocery-item"
  value={newItemText}
  onChange={(e) => setNewItemText(e.target.value)}
  onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
  placeholder="e.g., Milk, Eggs"
/>
```

---

## Pattern: sr-only for Custom Toggle Inputs

When a custom-styled checkbox or toggle hides the native `<input>`, keep the input in the DOM with `sr-only` so screen readers still interact with it.

### Code Example

```tsx
// components/CookieConsent.tsx
// The real checkbox is sr-only; a styled div shows the visual state
<input
  type="checkbox"
  checked={preferences.analytics}
  onChange={(e) => updatePreference('analytics', e.target.checked)}
  className="sr-only peer"
/>
<div className="w-5 h-5 bg-gray-100 border-2 border-gray-300 rounded peer-checked:bg-brand-primary peer-checked:border-brand-primary transition-colors">
  {/* Visual indicator driven by :peer-checked */}
</div>
```

---

## Pattern: Meaningful Alt Text for Images

Alt text describes the content and context of an image, not just its filename.

### Code Example

```tsx
// From 50-ACCESSIBILITY-WCAG-COMPLIANCE.md
// Recipe images
<img alt="Completed pasta carbonara with crispy pancetta" src="..." />
<img alt="Step 3: Sautéing onions until golden" src="..." />

// Decorative images — empty alt removes from accessibility tree
<img alt="" src="decorative-border.svg" />

// Complex images — brief alt + long description via aria-describedby
<img
  alt="Nutrition breakdown chart"
  aria-describedby="chart-description"
  src="nutrition-chart.png"
/>
<p id="chart-description" className="sr-only">
  Pie chart showing 45% carbohydrates, 30% protein, 25% fat for this meal.
</p>

// Dynamic preview image
<img src={imageUrl} alt="Meal preview" className="w-full h-auto rounded-[3rem]" />
```

---

## Pattern: Programmatic Screen Reader Announcements

Inject a temporary live region to announce events that don't have a natural DOM update.

### Code Example

```typescript
// From 50-ACCESSIBILITY-WCAG-COMPLIANCE.md
function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
) {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);
  // Remove after AT has time to read it
  setTimeout(() => announcement.remove(), 1000);
}

// Usage
announceToScreenReader('Recipe saved successfully');
announceToScreenReader('Error: Please check your input', 'assertive');
```

---

## Pattern: role="alert" for Toast Notifications

`role="alert"` is an implicit `aria-live="assertive"` region — screen readers interrupt and announce immediately.

### Code Example

```tsx
// components/Toast.tsx
const Toast: React.FC<ToastProps> = ({ message, onClose, actionLabel, onAction }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(), 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="fixed bottom-5 right-5 z-[60] flex items-center gap-4 bg-brand-black text-brand-white px-4 py-3 rounded-lg shadow-2xl"
      role="alert"
    >
      <p className="text-sm font-semibold">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={() => { onAction(); onClose(); }}
          className="text-sm font-bold text-brand-primary uppercase tracking-wide border-l border-white/20 pl-4"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

// components/ChefMasterLockPlanGateModal.tsx — inline error alert
{error && (
  <p className="text-center text-sm text-red-500" role="alert">
    {error}
  </p>
)}
```

---

## Pattern: Animated Text with sr-only Static Copy

When text animates character-by-character, provide a static `sr-only` version so screen readers read the full string once.

### Code Example

```tsx
// components/ui/TextRotate.tsx
// Screen readers get the full text; sighted users see the animation
<>
  <span className="sr-only">{texts[currentTextIndex]}</span>

  <AnimatePresence mode="popLayout" initial={false}>
    {splitText.map((char, i) => (
      <motion.span
        key={`${char}-${i}`}
        aria-hidden="true"   // Hide animated chars from AT
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
      >
        {char}
      </motion.span>
    ))}
  </AnimatePresence>
</>
```

---

## Pattern: Form Label Associations

Every input must have an associated `<label>` via `htmlFor`/`id` or an `aria-label`.

### Code Example

```tsx
// Explicit label association
<label htmlFor="recipe-name">Recipe Name *</label>
<input
  id="recipe-name"
  type="text"
  aria-required="true"
  aria-describedby="name-hint name-error"
/>
<span id="name-hint" className="text-sm text-gray-500">
  Enter a descriptive name
</span>
{error && (
  <span id="name-error" role="alert" className="text-red-500">
    {error}
  </span>
)}

// Visually hidden label when design has no visible label
<label htmlFor="new-grocery-item" className="sr-only">
  Add new grocery item
</label>
<input id="new-grocery-item" placeholder="e.g., Milk, Eggs" />

// aria-label when no label element is feasible
<input
  aria-label="New collection name"
  placeholder="New collection..."
/>
```

---

## Pattern: Semantic HTML Structure

Use landmark elements so screen reader users can jump between page sections.

### Code Example

```tsx
// From 50-ACCESSIBILITY-WCAG-COMPLIANCE.md
// Page structure landmarks
<header>
  <nav aria-label="Main navigation">...</nav>
</header>

<main id="main-content">
  <h1>Recipes</h1>   {/* One h1 per page */}

  <section aria-labelledby="featured-heading">
    <h2 id="featured-heading">Featured Recipes</h2>
    ...
  </section>

  <aside aria-label="Filters">...</aside>
</main>

<footer>...</footer>

// Skip link — lets keyboard/SR users jump past nav
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand-primary focus:text-white focus:rounded"
>
  Skip to main content
</a>
```

---

## Anti-Patterns

### ❌ Don't Do This

```tsx
// Placeholder as the only label — disappears on focus
<input placeholder="Recipe name" />

// Alt text that repeats the filename
<img alt="recipe-photo-123.jpg" src="recipe-photo-123.jpg" />

// Animated text with no static alternative
{chars.map(char => <motion.span>{char}</motion.span>)}

// Custom checkbox with no accessible input
<div className="custom-checkbox" onClick={toggle} />
```

### ✅ Do This Instead

```tsx
// Visible or sr-only label + placeholder for hint
<label htmlFor="recipe-name" className="sr-only">Recipe name</label>
<input id="recipe-name" placeholder="e.g., Pasta Carbonara" />

// Descriptive alt text
<img alt="Completed pasta carbonara with crispy pancetta" src="..." />

// Static sr-only text alongside animation
<span className="sr-only">{currentText}</span>
{chars.map(char => <motion.span aria-hidden="true">{char}</motion.span>)}

// Native input hidden with sr-only
<input type="checkbox" className="sr-only peer" checked={value} onChange={onChange} />
<div className="peer-checked:bg-brand-primary ..." />
```

---

## When to Use This Pattern

✅ **Use for:**
- Icon-only buttons (sr-only label)
- Custom-styled form controls (sr-only native input)
- Animated or rotating text (sr-only static copy)
- Toast/alert messages (role="alert")
- Dynamic content updates (aria-live or announceToScreenReader)
- Visually hidden form labels (sr-only label)

❌ **Don't use for:**
- Hiding content that should be visible to all users
- Replacing proper semantic HTML with ARIA workarounds

---

## Benefits

1. Screen reader users hear meaningful descriptions instead of "button" or filename
2. Custom UI controls remain operable with AT
3. Dynamic changes are announced without requiring a page reload
4. Proper heading hierarchy lets users navigate by section

---

## Related Patterns

- See `aria-patterns.md` for aria-live, aria-hidden, role attributes
- See `keyboard-navigation.md` for focus management
- See `wcag-compliance.md` for automated testing

---

*Extracted: 2026-02-18*
