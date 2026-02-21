# Keyboard Navigation Patterns

## Source
Extracted from BistroLens `.kiro/steering/50-ACCESSIBILITY-WCAG-COMPLIANCE.md`, `components/Modal.tsx`, `components/GlobalSearch.tsx`, `components/design-system/Card.tsx`, `components/CollectionManager.tsx`, `components/PantryManager.tsx`, `components/RecipeFinder.tsx`

---

## Pattern: Enter Key Submission on Text Inputs

Allow users to submit forms or add items by pressing Enter in a text field — no mouse required.

### Code Example

```tsx
// components/CollectionManager.tsx
<input
  type="text"
  value={newCollectionName}
  onChange={e => setNewCollectionName(e.target.value)}
  onKeyDown={(e) => e.key === 'Enter' && handleCreateCollection()}
  placeholder="New collection..."
  className="bg-brand-white border border-brand-black/20 rounded-lg p-2.5 w-full text-sm focus:ring-2 focus:ring-brand-primary outline-none"
  aria-label="New collection name"
/>

// components/PantryManager.tsx
<input
  type="text"
  value={newItem}
  onChange={(e) => setNewItem(e.target.value)}
  onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
  placeholder="Item name (e.g. Rice)"
  className="flex-1 bg-brand-white border border-brand-black/20 rounded-full p-4 focus:outline-none focus:border-brand-primary"
/>

// components/GroceryListModal.tsx
<input
  id="new-grocery-item"
  value={newItemText}
  onChange={(e) => setNewItemText(e.target.value)}
  onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
  placeholder="e.g., Milk, Eggs"
  className="bg-brand-white border border-brand-black/20 rounded-full p-4 w-full text-brand-black"
/>
```

---

## Pattern: Arrow Key Navigation in Search Results

Keyboard users navigate a list of results with ArrowUp/ArrowDown and confirm with Enter.

### Code Example

```tsx
// components/GlobalSearch.tsx
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setSelectedIndex(prev => Math.max(prev - 1, -1));
  } else if (e.key === 'Enter') {
    if (selectedIndex >= 0 && results[selectedIndex]) {
      handleSelectResult(results[selectedIndex]);
    } else {
      handleSearch();
    }
  } else if (e.key === 'Escape') {
    handleClose();
  }
};

<input
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  onKeyDown={handleKeyDown}
  placeholder="Search recipes, ingredients, help..."
  className="w-full pl-10 pr-20 py-3 bg-brand-white border border-brand-black/20 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none"
/>
```

---

## Pattern: Escape Key to Close Modals

Modals listen for the Escape key globally and close when it fires.

### Code Example

```tsx
// components/Modal.tsx
const Modal: React.FC<ModalProps> = ({ onClose, title, children }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}  // programmatic focus target
        className="... outline-none"
        onClick={e => e.stopPropagation()}
      >
        ...
      </div>
    </div>
  );
};
```

---

## Pattern: Focus Trapping in Modals

When a modal opens, focus moves into it immediately. `tabIndex={-1}` makes the container focusable without adding it to the tab order.

### Code Example

```tsx
// components/Modal.tsx
useEffect(() => {
  // Move focus into modal on open
  if (modalRef.current) {
    modalRef.current.focus();
  }
}, []);

// The modal container is focusable but not in the natural tab order
<div
  ref={modalRef}
  tabIndex={-1}
  className="bg-brand-white rounded-[3rem] shadow-2xl ... outline-none"
>
  {children}
</div>
```

---

## Pattern: Interactive Cards with Keyboard Activation

Cards that act as buttons must respond to Enter and Space, and be reachable via Tab.

### Code Example

```tsx
// components/design-system/Card.tsx
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ interactive = false, onClick, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        role={interactive || onClick ? 'button' : undefined}
        tabIndex={interactive || onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={
          interactive || onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick?.(e as any);
                }
              }
            : undefined
        }
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
```

---

## Pattern: Keyboard Shortcuts Reference

BistroLens defines a global keyboard shortcut map for power users.

### Code Example

```typescript
// From 50-ACCESSIBILITY-WCAG-COMPLIANCE.md
const KEYBOARD_SHORTCUTS = {
  // Global
  '/': 'Focus search',
  'Escape': 'Close modal/menu',
  '?': 'Show keyboard shortcuts',

  // Navigation
  'g h': 'Go to home',
  'g r': 'Go to recipes',
  'g m': 'Go to meal plan',

  // Actions
  'n': 'New recipe',
  's': 'Save current recipe',
  'p': 'Print recipe',
};
```

---

## Pattern: Focus Indicator Styling

All interactive elements show a visible focus ring using Tailwind's `focus:ring-*` utilities.

### Code Example

```tsx
// Standard focus ring on inputs
<input
  className="... focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none"
/>

// Focus ring on select elements
<select
  className="px-3 py-2 bg-brand-white border border-brand-black/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
/>

// From 50-ACCESSIBILITY-WCAG-COMPLIANCE.md — design token
const FOCUS_RULES = {
  focusStyle: 'ring-2 ring-orange-500 ring-offset-2',
  tabIndex: {
    interactive: 0,   // Natural tab order
    skipLink: -1,     // Programmatic focus only
    disabled: -1,     // Remove from tab order
  },
};
```

---

## Anti-Patterns

### ❌ Don't Do This

```tsx
// Click-only handler — keyboard users can't activate
<div onClick={handleSelect} className="cursor-pointer">
  Recipe Card
</div>

// Removing focus outline without replacement
<button className="outline-none focus:outline-none">Submit</button>

// Using onKeyPress (deprecated)
<input onKeyPress={(e) => e.key === 'Enter' && submit()} />
```

### ✅ Do This Instead

```tsx
// Keyboard-accessible interactive element
<div
  role="button"
  tabIndex={0}
  onClick={handleSelect}
  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSelect()}
>
  Recipe Card
</div>

// Replace outline with visible ring
<button className="outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2">
  Submit
</button>

// Use onKeyDown (not deprecated)
<input onKeyDown={(e) => e.key === 'Enter' && submit()} />
```

---

## When to Use This Pattern

✅ **Use for:**
- Text inputs that trigger an action (Enter to submit/add)
- Search results lists (arrow key navigation)
- Modals and drawers (Escape to close, focus trap on open)
- Non-button interactive elements (cards, list items)
- Any interactive element that needs a visible focus indicator

❌ **Don't use for:**
- Read-only content that doesn't need keyboard interaction
- Elements already handled by native browser keyboard behavior (native `<button>`, `<a>`, `<input>`)

---

## Benefits

1. Users who can't use a mouse can fully operate the UI
2. Power users can navigate faster without lifting hands from keyboard
3. Focus trapping prevents keyboard users from getting "lost" behind a modal
4. Visible focus indicators meet WCAG 2.4.7 (Focus Visible)

---

## Related Patterns

- See `aria-patterns.md` for aria-expanded, role="dialog", tabIndex usage
- See `screen-reader.md` for announcing focus changes to screen readers
- See `wcag-compliance.md` for WCAG 2.1 AA keyboard requirements

---

*Extracted: 2026-02-18*
