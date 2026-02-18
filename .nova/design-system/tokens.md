# Design Tokens Reference
## Complete design system values for NOVA26

---

## Colors

### Semantic Color Tokens

Use these tokens for all color values. **Never use raw hex/rgb/hsl values.**

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `background` | `#ffffff` | `#0a0a0a` | Page background |
| `foreground` | `#0a0a0a` | `#fafafa` | Primary text |
| `card` | `#ffffff` | `#0a0a0a` | Card backgrounds |
| `card-foreground` | `#0a0a0a` | `#fafafa` | Text on cards |
| `popover` | `#ffffff` | `#0a0a0a` | Popover/dropdown bg |
| `popover-foreground` | `#0a0a0a` | `#fafafa` | Text on popovers |
| `primary` | `#18181b` | `#fafafa` | Primary buttons, links |
| `primary-foreground` | `#fafafa` | `#18181b` | Text on primary |
| `secondary` | `#f4f4f5` | `#27272a` | Secondary buttons |
| `secondary-foreground` | `#18181b` | `#fafafa` | Text on secondary |
| `muted` | `#f4f4f5` | `#27272a` | Muted backgrounds |
| `muted-foreground` | `#71717a` | `#a1a1aa` | Secondary text |
| `accent` | `#f4f4f5` | `#27272a` | Accent backgrounds |
| `accent-foreground` | `#18181b` | `#fafafa` | Text on accent |
| `destructive` | `#ef4444` | `#7f1d1d` | Error states |
| `destructive-foreground` | `#fafafa` | `#fafafa` | Text on destructive |
| `border` | `#e4e4e7` | `#27272a` | Borders |
| `input` | `#e4e4e7` | `#27272a` | Input borders |
| `ring` | `#18181b` | `#d4d4d8` | Focus rings |
| `success` | `#22c55e` | `#15803d` | Success states |
| `success-foreground` | `#fafafa` | `#fafafa` | Text on success |
| `warning` | `#f59e0b` | `#b45309` | Warning states |
| `warning-foreground` | `#fafafa` | `#fafafa` | Text on warning |
| `info` | `#3b82f6` | `#1d4ed8` | Info states |
| `info-foreground` | `#fafafa` | `#fafafa` | Text on info |

### Tailwind Usage

```tsx
// ✅ CORRECT - Use semantic tokens
<div className="bg-background text-foreground">
  <button className="bg-primary text-primary-foreground hover:bg-primary/90">
    Click me
  </button>
</div>

// ❌ WRONG - Never use raw values
<div className="bg-white text-black">
  <button className="bg-[#18181b]" style={{ color: '#fafafa' }}>
    Click me
  </button>
</div>
```

### Opacity Modifiers

Use opacity modifiers for hover/focus states:

```tsx
<button className="bg-primary hover:bg-primary/90 active:bg-primary/80">
  Hover at 90% opacity, active at 80%
</button>

<div className="bg-muted/50 border-border/20">
  50% opacity muted bg, 20% opacity border
</div>
```

---

## Spacing

### 4px Grid System

All spacing uses a 4px base grid. **Never use arbitrary pixel values.**

| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| `0` | 0px | 0 | No spacing |
| `0.5` | 0.125rem | 2px | Micro spacing |
| `1` | 0.25rem | 4px | Tight spacing |
| `1.5` | 0.375rem | 6px | Extra small |
| `2` | 0.5rem | 8px | Small |
| `2.5` | 0.625rem | 10px | Small+ |
| `3` | 0.75rem | 12px | Default compact |
| `4` | 1rem | 16px | Default |
| `5` | 1.25rem | 20px | Medium |
| `6` | 1.5rem | 24px | Large |
| `8` | 2rem | 32px | XLarge |
| `10` | 2.5rem | 40px | 2XLarge |
| `12` | 3rem | 48px | 3XLarge |
| `16` | 4rem | 64px | 4XLarge |
| `20` | 5rem | 80px | 5XLarge |
| `24` | 6rem | 96px | 6XLarge |
| `32` | 8rem | 128px | Section spacing |
| `40` | 10rem | 160px | Large sections |
| `48` | 12rem | 192px | Hero spacing |
| `64` | 16rem | 256px | Massive spacing |

### Common Spacing Patterns

```tsx
// Component internal spacing
<div className="p-4 gap-2">     // 16px padding, 8px gap
<div className="p-6 gap-4">     // 24px padding, 16px gap

// Section spacing
<section className="py-12">     // 48px vertical padding
<section className="py-16">     // 64px vertical padding
<section className="py-24">     // 96px vertical padding

// Container padding
<div className="px-4 md:px-6 lg:px-8">  // Mobile: 16px, Tablet: 24px, Desktop: 32px

// Component gaps
<div className="gap-2">  // 8px between items
<div className="gap-4">  // 16px between items
<div className="gap-6">  // 24px between items
```

---

## Typography

### Type Scale

| Size | Token | Value | Line Height | Usage |
|------|-------|-------|-------------|-------|
| 12px | `text-xs` | 0.75rem | 1rem | Captions, badges |
| 14px | `text-sm` | 0.875rem | 1.25rem | Secondary text, labels |
| 16px | `text-base` | 1rem | 1.5rem | Body text (default) |
| 18px | `text-lg` | 1.125rem | 1.75rem | Lead paragraphs |
| 20px | `text-xl` | 1.25rem | 1.75rem | Small headings |
| 24px | `text-2xl` | 1.5rem | 2rem | H3 headings |
| 30px | `text-3xl` | 1.875rem | 2.25rem | H2 headings |
| 36px | `text-4xl` | 2.25rem | 2.5rem | H1 headings |
| 48px | `text-5xl` | 3rem | 1 | Hero text |
| 60px | `text-6xl` | 3.75rem | 1 | Display text |

### Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `font-normal` | 400 | Body text |
| `font-medium` | 500 | Emphasis, labels |
| `font-semibold` | 600 | Headings, strong |
| `font-bold` | 700 | Extra emphasis |

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `leading-3` | 0.75rem | Tight (icons) |
| `leading-4` | 1rem | XS text |
| `leading-5` | 1.25rem | Small text |
| `leading-6` | 1.5rem | Body text |
| `leading-7` | 1.75rem | Large text |
| `leading-8` | 2rem | Headings |
| `leading-9` | 2.25rem | Large headings |
| `leading-10` | 2.5rem | Display |
| `leading-none` | 1 | Headings, single line |
| `leading-tight` | 1.25 | Headings |
| `leading-snug` | 1.375 | Tight body |
| `leading-normal` | 1.5 | Default body |
| `leading-relaxed` | 1.625 | Spacious |
| `leading-loose` | 2 | Very spacious |

### Typography Patterns

```tsx
// Page title
<h1 className="text-3xl md:text-4xl font-bold tracking-tight">

// Section heading
<h2 className="text-2xl font-semibold tracking-tight">

// Card title
<h3 className="text-lg font-semibold">

// Body text
<p className="text-base leading-7 text-muted-foreground">

// Caption/label
<span className="text-sm text-muted-foreground">

// Monospace (code)
<code className="text-sm font-mono bg-muted px-1.5 py-0.5 rounded">
```

---

## Border Radius

### Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-none` | 0 | Sharp corners |
| `rounded-sm` | 2px | Subtle rounding |
| `rounded` | 4px | Default (buttons, inputs) |
| `rounded-md` | 6px | Cards, panels |
| `rounded-lg` | 8px | Larger cards |
| `rounded-xl` | 12px | Modals, dialogs |
| `rounded-2xl` | 16px | Feature cards |
| `rounded-3xl` | 24px | Hero elements |
| `rounded-full` | 9999px | Pills, avatars, circles |

### Usage Patterns

```tsx
// Buttons
<Button className="rounded-md">       // Default button
<Button className="rounded-full">     // Pill button

// Cards
<Card className="rounded-lg">         // Standard card
<Card className="rounded-xl">         // Elevated card

// Inputs
<Input className="rounded-md">        // Standard input

// Avatars
<Avatar className="rounded-full">     // Circular avatar
<Avatar className="rounded-lg">       // Squircle avatar

// Modals
<Dialog className="rounded-xl">       // Modal dialog
```

---

## Shadows

### Shadow Scale

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-none` | none | Flat elements |
| `shadow-sm` | 0 1px 2px 0 rgb(0 0 0 / 0.05) | Subtle elevation |
| `shadow` | 0 1px 3px 0 rgb(0 0 0 / 0.1) | Default cards |
| `shadow-md` | 0 4px 6px -1px rgb(0 0 0 / 0.1) | Elevated cards |
| `shadow-lg` | 0 10px 15px -3px rgb(0 0 0 / 0.1) | Modals, popovers |
| `shadow-xl` | 0 20px 25px -5px rgb(0 0 0 / 0.1) | Dialogs, drawers |
| `shadow-2xl` | 0 25px 50px -12px rgb(0 0 0 / 0.25) | Overlays |
| `shadow-inner` | inset 0 2px 4px 0 rgb(0 0 0 / 0.05) | Inset shadows |

### Shadow Patterns

```tsx
// Card hover elevation
<Card className="shadow hover:shadow-md transition-shadow">

// Modal
<Dialog className="shadow-xl">

// Dropdown menu
<Dropdown className="shadow-lg">

// Button press
<Button className="shadow-sm active:shadow-none">

// Input focus
<Input className="shadow-sm focus:shadow-md">
```

---

## Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `z-0` | 0 | Base layer |
| `z-10` | 10 | Raised elements |
| `z-20` | 20 | Dropdowns |
| `z-30` | 30 | Sticky headers |
| `z-40` | 40 | Fixed navbars |
| `z-50` | 50 | Modals, dialogs |

### Z-Index Guidelines

**Never exceed z-50 without explicit justification.** Use these layers:

```
z-0:    Base content
z-10:   Cards, raised elements
z-20:   Dropdowns, tooltips
z-30:   Sticky headers
z-40:   Fixed navigation
z-50:   Modals, dialogs, toasts
```

For modal overlays and things above modals:

```tsx
// Modal backdrop
<div className="z-50 fixed inset-0 bg-black/50">

// Modal content (above backdrop)
<div className="z-50 relative">

// Toast notifications (above modals)
<Toast className="z-50">
```

---

## Animation Durations

| Token | Value | Usage |
|-------|-------|-------|
| `duration-75` | 75ms | Micro-interactions |
| `duration-100` | 100ms | Fast feedback |
| `duration-150` | 150ms | Button states |
| `duration-200` | 200ms | Default transitions |
| `duration-300` | 300ms | Component transitions |
| `duration-500` | 500ms | Page transitions |
| `duration-700` | 700ms | Complex animations |
| `duration-1000` | 1000ms | Emphasis animations |

### Standard Patterns

```tsx
// Button hover
<Button className="transition-colors duration-200">

// Modal enter/exit
<Dialog className="transition-all duration-300">

// Toast
<Toast className="transition-all duration-300">

// Page transition
<div className="transition-opacity duration-500">
```

---

## Quick Reference Card

```tsx
// Standard Component Structure
<div className="
  // Colors (semantic tokens only)
  bg-card text-card-foreground
  
  // Spacing (4px grid)
  p-4 md:p-6 gap-4
  
  // Typography
  text-sm md:text-base
  
  // Border radius
  rounded-lg
  
  // Shadow
  shadow-sm hover:shadow-md
  
  // Transitions
  transition-all duration-200
">
```
