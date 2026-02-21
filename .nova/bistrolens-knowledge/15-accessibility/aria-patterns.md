# ARIA Patterns

## Source
Extracted from BistroLens `.kiro/steering/50-ACCESSIBILITY-WCAG-COMPLIANCE.md`, `components/Modal.tsx`, `components/SocialProofBadge.tsx`, `components/TonightCTA.tsx`, `components/design-system/Typography.tsx`, `components/design-system/PrimaryAction.tsx`

---

## Pattern: ARIA Labels on Icon Buttons

Icon-only buttons must have `aria-label` so screen readers announce the action.

### Code Example

```tsx
// components/Modal.tsx
<button
  onClick={onClose}
  className="p-3 rounded-full text-brand-black/60 hover:bg-brand-black/20 transition-colors"
  aria-label="Close modal"
>
  <CloseIcon className="w-6 h-6" />
</button>

// components/TonightCTA.tsx
<button
  onClick={handleResume}
  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-brand-primary text-brand-on-primary rounded-xl font-semibold text-sm min-h-[44px]"
  aria-label={`Continue cooking ${resumeState.recipeTitle}`}
>
  <PlayIcon className="w-4 h-4" />
  Continue Cooking
</button>

// components/CollectionManager.tsx
<button
  onClick={handleCreateCollection}
  className="p-2.5 rounded-lg bg-brand-secondary text-brand-white"
  aria-label="Create new collection"
>
  <PlusIcon className="w-5 h-5 flex-none" />
</button>
```

---

## Pattern: aria-expanded for Collapsible Sections

Toggle buttons that show/hide content must reflect their state with `aria-expanded`.

### Code Example

```tsx
// components/DesktopRecipeView.tsx
const CollapsibleSection: React.FC<{
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  count?: number;
  children: React.ReactNode;
}> = ({ title, isOpen, onToggle, count, children }) => (
  <div className="mb-3">
    <button
      onClick={() => { playClickSound(); onToggle(); }}
      className="w-full flex items-center justify-between py-2 hover:bg-brand-white/50 rounded-lg"
      aria-expanded={isOpen}
    >
      <h3 className="font-bold text-xs uppercase tracking-wide text-brand-black/60">
        {title} {count !== undefined && `(${count})`}
      </h3>
      <ChevronDownIcon className={`w-4 h-4 text-brand-black/60 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    {isOpen && children}
  </div>
);
```

---

## Pattern: aria-live Regions for Dynamic Content

Wrap content that changes dynamically in `aria-live` so screen readers announce updates.

### Code Example

```tsx
// components/NutritionLog.tsx — preview state announces image change
<div aria-live="polite">
  {imageUrl && <img src={imageUrl} alt="Meal preview" className="w-full h-auto rounded-[3rem]" />}
  {error && <p className="text-red-500 text-center mt-2 text-sm">{error}</p>}
</div>

// Empty state container — announces when list becomes empty
<div
  className="flex flex-col items-center justify-center py-20 bg-brand-white border border-brand-black/20 rounded-[3rem]"
  aria-live="polite"
>
  <BarChartIcon className="w-16 h-16 text-brand-black/60/30 mb-4" />
  <p className="text-lg text-brand-black/60 font-medium">Your logbook is empty.</p>
</div>

// Inline error inside modal
{error && scanState === 'camera' ? (
  <p className="text-red-500 text-center p-8" aria-live="polite">{error}</p>
) : renderScanner()}
```

---

## Pattern: role Attributes for Semantic Meaning

Use `role` to give non-semantic elements the correct ARIA semantics.

### Code Example

```tsx
// components/Modal.tsx — dialog role
<div
  className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-brand-black/60 backdrop-blur-sm"
  onClick={onClose}
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <h2 id="modal-title" className="text-xl font-serif font-bold text-brand-black">
    {title}
  </h2>
</div>

// components/Toast.tsx — alert role for urgent messages
<div
  className="fixed bottom-5 right-5 z-[60] flex items-center gap-4 bg-brand-black text-brand-white px-4 py-3 rounded-lg shadow-2xl"
  role="alert"
>
  <p className="text-sm font-semibold">{message}</p>
</div>

// components/SocialProofBadge.tsx — status role for non-urgent info
<span
  className="inline-flex items-center gap-1 rounded-full font-medium ..."
  role="status"
  aria-label={displayLabel}
>
  <span aria-hidden="true">{emoji}</span>
  <span>{displayLabel}</span>
</span>

// components/TonightCTA.tsx — region role for landmark
<div
  className="bg-brand-white rounded-2xl p-4 shadow-md border border-brand-black/20/30"
  role="region"
  aria-label="Resume cooking session"
>
  ...
</div>

// components/design-system/Card.tsx — button role for interactive cards
<motion.div
  role={interactive || onClick ? 'button' : undefined}
  tabIndex={interactive || onClick ? 0 : undefined}
  onClick={onClick}
  ...
>
  {children}
</motion.div>
```

---

## Pattern: aria-hidden for Decorative Elements

Decorative icons, emojis, and spacers should be hidden from the accessibility tree.

### Code Example

```tsx
// components/design-system/PrimaryAction.tsx — decorative SVG
<svg
  viewBox="0 0 24 24"
  fill="none"
  aria-hidden="true"
>
  <circle ... />
</svg>

// components/SocialProofBadge.tsx — emoji is decorative; label carries meaning
<span aria-hidden="true">{emoji}</span>
<span>{displayLabel}</span>

// components/design-system/Stack.tsx — layout spacer
<div
  className={`spacer spacer--${size}`}
  style={{ height: GAP_MAP[size], flexShrink: 0 }}
  aria-hidden="true"
/>

// components/layout/ScreenLayout.tsx — skeleton shimmer
<div
  className={`animate-pulse bg-gray-200 ${className}`}
  style={{ width, height, borderRadius }}
  aria-hidden="true"
/>
```

---

## Pattern: aria-required and aria-describedby on Form Inputs

Link inputs to their labels, hints, and error messages using IDs.

### Code Example

```tsx
// From 50-ACCESSIBILITY-WCAG-COMPLIANCE.md
<form aria-labelledby="form-title">
  <h2 id="form-title">Recipe Details</h2>

  <div>
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
  </div>
</form>

// components/design-system/Typography.tsx — required asterisk hidden from AT
export const Label = forwardRef<HTMLLabelElement, LabelProps>(({ required, children, ...props }, ref) => (
  <label ref={ref} {...props}>
    {children}
    {required && (
      <span style={{ color: '#E81B27', marginLeft: '4px' }} aria-hidden="true">
        *
      </span>
    )}
  </label>
));
```

---

## Anti-Patterns

### ❌ Don't Do This

```tsx
// Icon button with no label — screen reader announces nothing useful
<button onClick={onClose}>
  <XIcon />
</button>

// Emoji as content without text alternative
<span>🔥 Trending</span>

// Dynamic content with no live region — changes are silent
<div>{statusMessage}</div>
```

### ✅ Do This Instead

```tsx
// Named icon button
<button onClick={onClose} aria-label="Close modal">
  <XIcon aria-hidden="true" />
</button>

// Emoji decorative, text carries meaning
<span role="status" aria-label="Trending tonight">
  <span aria-hidden="true">🔥</span>
  <span>Trending tonight</span>
</span>

// Live region announces changes
<div aria-live="polite" aria-atomic="true">{statusMessage}</div>
```

---

## When to Use This Pattern

✅ **Use for:**
- Icon-only buttons (aria-label)
- Collapsible sections (aria-expanded)
- Dynamic content updates (aria-live)
- Non-semantic interactive elements (role="button")
- Decorative images and icons (aria-hidden)
- Form error associations (aria-describedby)

❌ **Don't use for:**
- Elements that already have semantic HTML equivalents (use `<button>` not `role="button"` on a `<div>` when possible)
- Overriding correct native semantics

---

## Benefits

1. Screen readers announce the correct action for icon buttons
2. State changes (expanded/collapsed) are communicated without visual cues
3. Dynamic content updates reach users who can't see the DOM change
4. Decorative noise is filtered out of the accessibility tree

---

## Related Patterns

- See `keyboard-navigation.md` for tabIndex and focus management
- See `screen-reader.md` for sr-only text and announcements
- See `wcag-compliance.md` for automated testing with jest-axe

---

*Extracted: 2026-02-18*
