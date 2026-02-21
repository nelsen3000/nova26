# Button Variants Pattern

## Source
Extracted from BistroLens `components/ui/button.tsx`

---

## Pattern: Button Variants with Class Variance Authority

A flexible button component system using `class-variance-authority` (CVA) to manage multiple visual variants and sizes. This pattern provides type-safe variant composition with Tailwind CSS classes, enabling consistent button styling across the application while maintaining accessibility and flexibility.

---

## Core Implementation

### Button Component with CVA

```typescript
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base styles applied to all buttons
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

---

## Variant Usage Examples

### Default Primary Button

```typescript
import { Button } from '@/components/ui/button';

// Standard primary action button
<Button>Click Me</Button>

// With custom styling
<Button className="bg-[#6161FF] text-white hover:bg-[#6161FF]/90">
  Get Started →
</Button>
```

### Size Variants

```typescript
// Small button for compact spaces
<Button size="sm">Small Button</Button>

// Large button for prominent CTAs
<Button 
  size="lg"
  className="h-12 px-8 text-base font-semibold shadow-lg"
>
  Start Building
</Button>

// Icon-only button (square)
<Button size="icon" variant="ghost">
  <Settings className="h-4 w-4" />
</Button>
```

### Visual Variants

```typescript
// Destructive action (delete, remove)
<Button variant="destructive">Delete Account</Button>

// Outline style for secondary actions
<Button variant="outline">Cancel</Button>

// Secondary style for less prominent actions
<Button variant="secondary">Learn More</Button>

// Ghost style for subtle actions
<Button variant="ghost">Skip</Button>

// Link style for text-like buttons
<Button variant="link">View Details</Button>
```

### Loading State

```typescript
import { Loader2 } from 'lucide-react';

<Button disabled={isSubmitting}>
  {isSubmitting && (
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  )}
  Save Changes
</Button>
```

### Button with Icon

```typescript
import { ArrowRight, Save } from 'lucide-react';

// Icon on the right
<Button>
  Continue
  <ArrowRight className="ml-2 h-5 w-5" />
</Button>

// Icon on the left
<Button>
  <Save className="mr-2 h-4 w-4" />
  Save
</Button>
```

### Polymorphic Button (asChild)

```typescript
// Render as a Link component instead of button
<Button asChild>
  <Link href="/dashboard">Go to Dashboard</Link>
</Button>

// Render as an anchor tag
<Button asChild variant="outline">
  <a href="https://example.com" target="_blank">
    External Link
  </a>
</Button>
```

---

## Real-World Examples

### CTA Button with Shadow

```typescript
<Button
  size="lg"
  className="h-12 bg-[#6161FF] px-8 text-base font-semibold text-white shadow-lg shadow-[#6161FF]/20 transition-all duration-200 hover:bg-[#6161FF]/90 hover:shadow-xl hover:shadow-[#6161FF]/30"
>
  Start Building
  <ArrowRight className="ml-2 h-5 w-5" />
</Button>
```

### Form Action Buttons

```typescript
<div className="flex gap-3">
  <Button
    type="button"
    variant="outline"
    onClick={() => form.reset()}
    disabled={!isDirty || isSubmitting}
  >
    Reset
  </Button>
  <Button type="submit" disabled={!isDirty || isSubmitting}>
    {isSubmitting && (
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    )}
    <Save className="mr-2 h-4 w-4" />
    Save Changes
  </Button>
</div>
```

### Navigation Button

```typescript
<Button
  className="bg-[#6161FF] text-white hover:bg-[#6161FF]/90"
  size="sm"
>
  Get Started →
</Button>
```

---

## Anti-Patterns

### ❌ Don't Hardcode Styles Without Variants

```typescript
// BAD: Bypassing the variant system
<button className="bg-blue-500 text-white px-4 py-2 rounded">
  Click Me
</button>
```

### ✅ Do Use Variant System

```typescript
// GOOD: Using the variant system with custom classes
<Button className="bg-[#6161FF]">
  Click Me
</Button>
```

---

### ❌ Don't Forget Disabled States

```typescript
// BAD: No disabled state handling
<Button onClick={handleSubmit}>
  {isLoading ? 'Loading...' : 'Submit'}
</Button>
```

### ✅ Do Handle Disabled States

```typescript
// GOOD: Proper disabled state
<Button disabled={isLoading} onClick={handleSubmit}>
  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  Submit
</Button>
```

---

### ❌ Don't Use Buttons for Navigation Without asChild

```typescript
// BAD: Button wrapping a link (invalid HTML)
<Button>
  <a href="/dashboard">Dashboard</a>
</Button>
```

### ✅ Do Use asChild for Navigation

```typescript
// GOOD: Proper polymorphic button
<Button asChild>
  <Link href="/dashboard">Dashboard</Link>
</Button>
```

---

### ❌ Don't Ignore Accessibility

```typescript
// BAD: Icon button without accessible label
<Button size="icon">
  <X />
</Button>
```

### ✅ Do Provide Accessible Labels

```typescript
// GOOD: Icon button with aria-label
<Button size="icon" aria-label="Close dialog">
  <X className="h-4 w-4" />
</Button>
```

---

## When to Use This Pattern

✅ **Use for:**
- All clickable actions in the application
- Form submissions and cancellations
- Navigation triggers (with `asChild`)
- Modal/dialog actions
- CTA buttons in marketing sections
- Icon-only actions (with `size="icon"`)
- Loading states during async operations

❌ **Don't use for:**
- Pure navigation links (use `<Link>` or `<a>` directly)
- Non-interactive elements (use `<div>` or `<span>`)
- Custom interactive elements that don't fit button semantics

---

## Benefits

1. **Type Safety**: TypeScript ensures only valid variant combinations are used
2. **Consistency**: All buttons follow the same design system
3. **Accessibility**: Built-in focus states, disabled states, and ARIA support
4. **Flexibility**: Easy to extend with custom classes via `className` prop
5. **Polymorphism**: `asChild` prop enables rendering as any component
6. **Maintainability**: Centralized variant definitions make updates easy
7. **Performance**: CVA generates optimized class strings
8. **Developer Experience**: IntelliSense autocomplete for variants

---

## Key Features

### Base Styles (Applied to All Buttons)
- `inline-flex items-center justify-center` - Flexbox centering
- `whitespace-nowrap` - Prevents text wrapping
- `rounded-md` - Consistent border radius
- `text-sm font-medium` - Typography
- `ring-offset-background` - Focus ring offset
- `transition-colors` - Smooth color transitions
- `focus-visible:outline-none focus-visible:ring-2` - Keyboard focus indicator
- `disabled:pointer-events-none disabled:opacity-50` - Disabled state

### Variant System
- **6 visual variants**: default, destructive, outline, secondary, ghost, link
- **4 size variants**: default, sm, lg, icon
- **Default variants**: Automatically applied when not specified
- **Composable**: Variants can be combined with custom classes

### Polymorphic Rendering
- `asChild` prop uses Radix UI's `Slot` component
- Allows button to render as any component while maintaining button styles
- Useful for navigation links, custom components, etc.

---

## Related Patterns

- See `form-components.md` for form-specific button usage
- See `modal-dialog.md` for dialog action buttons
- See `loading-states.md` for loading button patterns
- See `toast-notifications.md` for notification action buttons

---

## TypeScript Types

```typescript
// Inferred from CVA
type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

// Component props
interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

// Usage with type inference
const MyButton: React.FC = () => {
  return <Button variant="outline" size="lg">Click</Button>;
};
```

---

## Dependencies

- `class-variance-authority` - Variant management
- `@radix-ui/react-slot` - Polymorphic rendering
- `tailwindcss` - Styling
- `lucide-react` - Icons (optional)

---

*Extracted: 2026-02-18*
