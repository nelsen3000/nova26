# Form Components Pattern

## Source
Extracted from BistroLens `components/ui/textarea.tsx`, `components/ui/toggle.tsx`, `components/AuthModal.tsx`, `components/WelcomeModal.tsx`, `components/SettingsModal.tsx`

---

## Pattern: Accessible Form Components with Consistent Styling

A collection of reusable form components built with React forwardRef, consistent Tailwind styling, and accessibility best practices. These components provide a unified design language across text inputs, textareas, selects, toggles, and other form elements while maintaining flexibility through className composition.

---

## Core Components

### Textarea Component

```typescript
import * as React from "react";
import { cn } from "../../lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-[2.5rem] border border-brand-black/20 bg-brand-white px-6 py-4 text-base ring-offset-brand-white placeholder:text-brand-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 touch-pan-y scrollbar-hide",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
```

### Toggle/Switch Component

```typescript
"use client"

import * as React from "react";
import { cn } from "../../lib/utils";

const styles = {
  switch: `relative block cursor-pointer h-[32px] w-[52px]
    [--c-active:#E81B27]
    [--c-success:#22C55E]
    [--c-warning:#FFA001]
    [--c-danger:#EF4444]
    [--c-active-inner:#FFFFFF]
    [--c-default:#E5E7EB]
    [--c-default-hover:#D1D5DB]
    [--c-black:#111111]
    [transform:translateZ(0)]
    [-webkit-transform:translateZ(0)]
    [backface-visibility:hidden]
    [-webkit-backface-visibility:hidden]
    [perspective:1000]
    [-webkit-perspective:1000]`,
  input: `h-full w-full cursor-pointer appearance-none rounded-full
    bg-[--c-default] outline-none transition-colors duration-500
    hover:bg-[--c-default-hover]
    [transform:translate3d(0,0,0)]
    [-webkit-transform:translate3d(0,0,0)]
    data-[checked=true]:bg-[--c-background]`,
  svg: `pointer-events-none absolute inset-0 fill-brand-white
    [transform:translate3d(0,0,0)]
    [-webkit-transform:translate3d(0,0,0)]`,
  circle: `transform-gpu transition-transform duration-500
    [transform:translate3d(0,0,0)]
    [-webkit-transform:translate3d(0,0,0)]
    [backface-visibility:hidden]
    [-webkit-backface-visibility:hidden]`,
  dropCircle: `transform-gpu transition-transform duration-700
    [transform:translate3d(0,0,0)]
    [-webkit-transform:translate3d(0,0,0)]`
};

const variantStyles = {
  default: '[--c-background:var(--c-active)]',
  success: '[--c-background:var(--c-success)]',
  warning: '[--c-background:var(--c-warning)]',
  danger: '[--c-background:var(--c-danger)]',
};

export const MinimalToggle = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    variant?: 'default' | 'success' | 'warning' | 'danger'
  }
>(({ className, checked, onChange, variant = 'default', ...props }, ref) => {
  // Controlled vs uncontrolled state handling
  const [internalChecked, setInternalChecked] = React.useState(
    props.defaultChecked || false
  );
  const isChecked = checked !== undefined ? checked : internalChecked;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (checked === undefined) {
      setInternalChecked(e.target.checked);
    }
    onChange?.(e);
  };

  return (
    <label className={cn(styles.switch, className)}>
      <input
        type="checkbox"
        ref={ref}
        checked={isChecked}
        onChange={handleChange}
        data-checked={isChecked}
        className={cn(styles.input, variantStyles[variant])}
        {...props}
      />
      <svg
        viewBox="0 0 52 32"
        filter="url(#goo)"
        className={styles.svg}
      >
        <circle
          className={styles.circle}
          cx="16"
          cy="16"
          r="10"
          style={{
            transformOrigin: '16px 16px',
            transform: `translateX(${isChecked ? '12px' : '0px'}) scale(${isChecked ? '0' : '1'})`,
          }}
        />
        <circle
          className={styles.circle}
          cx="36"
          cy="16"
          r="10"
          style={{
            transformOrigin: '36px 16px',
            transform: `translateX(${isChecked ? '0px' : '-12px'}) scale(${isChecked ? '1' : '0'})`,
          }}
        />
        {isChecked && (
          <circle
            className={styles.dropCircle}
            cx="35"
            cy="-1"
            r="2.5"
          />
        )}
      </svg>
    </label>
  );
});
MinimalToggle.displayName = "MinimalToggle";

// SVG Filter for gooey effect
export function GooeyFilter() {
  return (
    <svg className="fixed w-0 h-0" style={{ pointerEvents: 'none' }}>
      <defs>
        <filter id="goo">
          <feGaussianBlur
            in="SourceGraphic"
            stdDeviation="2"
            result="blur"
          />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
            result="goo"
          />
          <feComposite
            in="SourceGraphic"
            in2="goo"
            operator="atop"
          />
        </filter>
      </defs>
    </svg>
  );
}
```

---

## Form Input Patterns

### Text Input with Label

```typescript
// Standard text input pattern from AuthModal
<div>
  <label className="block text-sm font-medium text-brand-black mb-2">
    Email Address
  </label>
  <input
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-brand-white text-gray-900 placeholder-gray-500 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
    placeholder="your@email.com"
    required
  />
</div>
```

### Password Input with Toggle Visibility

```typescript
import { EyeIcon, EyeOffIcon } from './Icons';

const [showPassword, setShowPassword] = useState(false);

<div>
  <label className="block text-sm font-medium text-brand-black mb-2">
    Password
  </label>
  <div className="relative">
    <input
      type={showPassword ? 'text' : 'password'}
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg bg-brand-white text-gray-900 placeholder-gray-500 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
      placeholder="••••••••"
      required
    />
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-black/50 hover:text-brand-black/70 focus:outline-none"
    >
      {showPassword ? (
        <EyeOffIcon className="w-5 h-5" />
      ) : (
        <EyeIcon className="w-5 h-5" />
      )}
    </button>
  </div>
</div>
```

### Select Dropdown

```typescript
// Native select with consistent styling
<div>
  <label className="block text-[10px] font-semibold text-brand-black/60 uppercase tracking-wide mb-1">
    Country
  </label>
  <select
    value={country}
    onChange={(e) => setCountry(e.target.value)}
    className="w-full bg-brand-white border border-brand-black/20 rounded-xl px-4 py-3 text-sm font-medium text-brand-black outline-none focus:border-brand-primary appearance-none cursor-pointer"
  >
    {COUNTRIES.map(c => (
      <option key={c} value={c}>{c}</option>
    ))}
  </select>
</div>
```

### Compact Inline Input

```typescript
// Minimal inline input from WelcomeModal
<div className="flex gap-1.5 items-center">
  <span className="w-16 text-[10px] md:text-[8px] font-bold uppercase text-brand-black/60 text-right flex-shrink-0 whitespace-nowrap">
    Name
  </span>
  <input 
    type="text" 
    value={name}
    onChange={(e) => setName(e.target.value)}
    onBlur={handleBlur}
    placeholder="Chef"
    className="w-full text-brand-black font-bold text-sm md:text-xs focus:outline-none bg-brand-white border-b border-brand-black/20 focus:border-brand-primary transition-colors py-1.5 md:py-1 px-2 rounded-t-sm"
  />
</div>
```

### Range Slider

```typescript
// Range input for numeric values
<div className="space-y-2">
  <div className="flex justify-between items-center">
    <span className="text-xs font-semibold text-brand-black/60">
      Min Price
    </span>
    <span className="text-sm font-bold text-brand-black">
      ${minPrice}
    </span>
  </div>
  <input
    type="range"
    min="0"
    max="100"
    value={minPrice}
    onChange={(e) => setMinPrice(Number(e.target.value))}
    className="w-full h-2 bg-brand-black/10 rounded-lg appearance-none cursor-pointer accent-brand-primary"
  />
</div>
```

### File Input (Hidden with Custom Trigger)

```typescript
const fileInputRef = useRef<HTMLInputElement>(null);

// Hidden file input
<input 
  type="file" 
  ref={fileInputRef} 
  className="hidden" 
  accept="image/*" 
  onChange={handleFileUpload} 
/>

// Custom trigger button
<button
  onClick={() => fileInputRef.current?.click()}
  className="px-4 py-2 bg-brand-primary text-brand-white rounded-lg font-semibold hover:bg-brand-primary-hover"
>
  Upload Image
</button>
```

---

## Form Layout Patterns

### Two-Column Grid Layout

```typescript
// Responsive grid for form fields
<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
  <div>
    <label className="block text-sm font-medium text-brand-black mb-2">
      First Name
    </label>
    <input
      type="text"
      value={firstName}
      onChange={(e) => setFirstName(e.target.value)}
      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-brand-white text-gray-900 placeholder-gray-500 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
      placeholder="John"
      required
    />
  </div>
  <div>
    <label className="block text-sm font-medium text-brand-black mb-2">
      Last Name
    </label>
    <input
      type="text"
      value={lastName}
      onChange={(e) => setLastName(e.target.value)}
      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-brand-white text-gray-900 placeholder-gray-500 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
      placeholder="Doe"
      required
    />
  </div>
</div>
```

### Form with Submit Button

```typescript
<form onSubmit={handleSubmit} className="space-y-4">
  {/* Form fields */}
  <div>
    <label className="block text-sm font-medium text-brand-black mb-2">
      Email Address
    </label>
    <input
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-brand-white text-gray-900 placeholder-gray-500 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
      placeholder="your@email.com"
      required
    />
  </div>

  {/* Submit button */}
  <button
    type="submit"
    disabled={isLoading}
    className="w-full py-4 min-h-[56px] bg-brand-primary text-brand-white rounded-xl hover:bg-brand-primary-hover transition-all duration-300 font-bold uppercase tracking-wide disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
  >
    {isLoading && <LoaderIcon className="w-4 h-4 animate-spin" />}
    Submit
  </button>
</form>
```

### Segmented Control (Pill Buttons)

```typescript
// Pill-style selection from SettingsModal
const SegmentedControl = <T extends string | boolean>({ 
  options, 
  value, 
  onChange, 
  label 
}: { 
  options: { label: string, value: T }[], 
  value: T, 
  onChange: (val: T) => void, 
  label?: string 
}) => (
  <div className="mb-2">
    {label && (
      <label className="block text-[10px] font-semibold text-brand-black/60 uppercase tracking-wide mb-1 pl-1">
        {label}
      </label>
    )}
    <div className="flex flex-wrap gap-1 bg-brand-white/50 p-1 rounded-xl">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-4 py-3 md:px-2 md:py-1.5 rounded-lg text-sm md:text-xs font-semibold uppercase tracking-wide transition-all shadow-sm whitespace-nowrap min-h-[44px] md:min-h-0 ${
            value === opt.value 
              ? 'bg-brand-primary text-brand-white shadow-md' 
              : 'bg-brand-white text-brand-black/60 hover:text-brand-black hover:bg-brand-white/80'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

// Usage
<SegmentedControl
  label="Skill Level"
  options={[
    { label: 'Beginner', value: 'beginner' },
    { label: 'Intermediate', value: 'intermediate' },
    { label: 'Advanced', value: 'advanced' }
  ]}
  value={skillLevel}
  onChange={setSkillLevel}
/>
```

---

## Anti-Patterns

### ❌ Don't Forget Focus States

```typescript
// BAD: No focus indicator
<input
  type="text"
  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
/>
```

### ✅ Do Provide Clear Focus States

```typescript
// GOOD: Clear focus ring
<input
  type="text"
  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary"
/>
```

---

### ❌ Don't Use Inconsistent Styling

```typescript
// BAD: Mixed styling approaches
<input className="border p-2" />
<input className="px-4 py-3 border-2" />
<input style={{ padding: '10px' }} />
```

### ✅ Do Use Consistent Design Tokens

```typescript
// GOOD: Consistent spacing and borders
<input className="w-full px-3 py-2.5 border border-gray-300 rounded-lg" />
<input className="w-full px-3 py-2.5 border border-gray-300 rounded-lg" />
```

---

### ❌ Don't Forget Labels for Accessibility

```typescript
// BAD: No label
<input type="email" placeholder="Email" />
```

### ✅ Do Provide Accessible Labels

```typescript
// GOOD: Proper label association
<label htmlFor="email" className="block text-sm font-medium mb-2">
  Email Address
</label>
<input
  id="email"
  type="email"
  placeholder="your@email.com"
/>
```

---

### ❌ Don't Ignore Mobile Touch Targets

```typescript
// BAD: Too small for mobile
<input className="px-2 py-1 text-xs" />
```

### ✅ Do Provide Adequate Touch Targets

```typescript
// GOOD: Minimum 44px height for mobile
<input className="px-3 py-3 md:py-2.5 text-base md:text-sm min-h-[44px] md:min-h-0" />
```

---

### ❌ Don't Lose Input State on Re-renders

```typescript
// BAD: Uncontrolled input that loses focus
const MyForm = () => {
  return (
    <input
      type="text"
      defaultValue={name}
      onChange={(e) => setName(e.target.value)}
    />
  );
};
```

### ✅ Do Use Controlled Inputs Properly

```typescript
// GOOD: Controlled input with stable state
const MyForm = () => {
  const [name, setName] = useState('');
  
  return (
    <input
      type="text"
      value={name}
      onChange={(e) => setName(e.target.value)}
    />
  );
};
```

---

## When to Use This Pattern

✅ **Use for:**
- User authentication forms (login, signup)
- Profile and settings forms
- Search inputs and filters
- Multi-step wizards
- Data entry forms
- Preference selections
- File uploads
- Toggle switches for boolean settings

❌ **Don't use for:**
- Complex form builders (use a library like React Hook Form)
- Rich text editing (use a dedicated editor)
- Date/time pickers (use a specialized component)
- Multi-select with search (use a combobox component)

---

## Benefits

1. **Consistency**: Unified styling across all form elements
2. **Accessibility**: Built-in focus states, labels, and ARIA support
3. **Responsive**: Mobile-first with appropriate touch targets
4. **Type Safety**: TypeScript interfaces for all props
5. **Flexibility**: Easy to extend with className composition
6. **Performance**: Optimized with React.forwardRef for ref forwarding
7. **User Experience**: Clear visual feedback for interactions
8. **Maintainability**: Centralized styling makes updates easy

---

## Key Features

### Common Input Styles
- Consistent padding: `px-3 py-2.5` (desktop), `py-3` (mobile)
- Border: `border border-gray-300` or `border-brand-black/20`
- Border radius: `rounded-lg` or `rounded-xl`
- Focus ring: `focus:ring-2 focus:ring-brand-primary`
- Disabled state: `disabled:opacity-50 disabled:cursor-not-allowed`
- Placeholder: `placeholder:text-brand-black/60`

### Mobile Considerations
- Minimum touch target: `min-h-[44px]` on mobile
- Responsive text sizes: `text-base md:text-sm`
- Responsive padding: `py-3 md:py-2.5`
- Touch-friendly spacing: `gap-3` on mobile, `gap-2` on desktop

### Accessibility Features
- Semantic HTML elements (`<label>`, `<input>`, `<select>`)
- Proper label associations with `htmlFor` and `id`
- Focus indicators with `focus-visible:ring-2`
- Disabled states with `disabled` attribute
- Required fields with `required` attribute
- ARIA labels for icon-only buttons

---

## Related Patterns

- See `button-variants.md` for form submit buttons
- See `../05-form-patterns/form-validation.md` for validation patterns
- See `../05-form-patterns/form-submission.md` for form handling
- See `loading-states.md` for loading indicators in forms
- See `error-states.md` for error message display

---

## TypeScript Types

```typescript
// Textarea props
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

// Toggle props
interface ToggleProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

// Segmented control props
interface SegmentedControlProps<T extends string | boolean> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (val: T) => void;
  label?: string;
}
```

---

## Dependencies

- `react` - Core React library
- `tailwindcss` - Styling
- `cn` utility - Class name merging (from `lib/utils`)
- Icons library (optional) - For password visibility toggle, etc.

---

*Extracted: 2026-02-18*
