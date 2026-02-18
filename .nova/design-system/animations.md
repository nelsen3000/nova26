# Animation System
## Motion design standards for NOVA26

---

## Animation Principles

1. **Purposeful** - Every animation should serve a function
2. **Subtle** - Animations enhance, don't distract
3. **Fast** - 150-300ms for most interactions
4. **Accessible** - Respect `prefers-reduced-motion`
5. **Consistent** - Use the same easings and durations

---

## Duration Scale

| Token | Duration | Usage |
|-------|----------|-------|
| `duration-75` | 75ms | Micro-interactions, icon changes |
| `duration-100` | 100ms | Fast feedback, button presses |
| `duration-150` | 150ms | Quick transitions, hover states |
| `duration-200` | 200ms | Default - most UI transitions |
| `duration-300` | 300ms | Component enter/exit |
| `duration-500` | 500ms | Page transitions, emphasis |
| `duration-700` | 700ms | Complex animations |

### Standard Pattern

```tsx
// Most transitions use duration-200
transition-all duration-200 ease-in-out

// Enter/exit animations use duration-300
animate-in fade-in duration-300

// Page transitions use duration-500
animate-in slide-in-from-bottom-4 duration-500
```

---

## Easing Functions

| Token | CSS Value | Usage |
|-------|-----------|-------|
| `ease-linear` | linear | Continuous animations (spinners) |
| `ease-in` | cubic-bezier(0.4, 0, 1, 1) | Elements exiting |
| `ease-out` | cubic-bezier(0, 0, 0.2, 1) | Elements entering |
| `ease-in-out` | cubic-bezier(0.4, 0, 0.2, 1) | Default - UI transitions |

### Custom Easings

```css
/* Spring - for playful interactions */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

/* Bounce - for emphasis */
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

---

## Enter/Exit Transitions

### Fade In/Out

```tsx
// Simple fade
<div className="animate-in fade-in duration-300">
  Content fading in
</div>

// Fade with slight scale (subtle pop)
<div className="animate-in fade-in zoom-in-95 duration-300">
  Content with subtle scale
</div>

// Exit animation
<div className="animate-out fade-out zoom-out-95 duration-200">
  Content exiting
</div>
```

### Slide Animations

```tsx
// Slide from bottom (modal, toast)
<div className="animate-in slide-in-from-bottom-4 duration-300">
  Slides up from bottom
</div>

// Slide from right (sidebar, drawer)
<div className="animate-in slide-in-from-right duration-300">
  Slides in from right
</div>

// Slide from left
<div className="animate-in slide-in-from-left duration-300">
  Slides in from left
</div>

// Slide from top (dropdown)
<div className="animate-in slide-in-from-top-2 duration-200">
  Slides down from top
</div>
```

### Combined Enter Animations

```tsx
// Modal enter
<div className="
  animate-in 
  fade-in 
  zoom-in-95 
  slide-in-from-bottom-4 
  duration-300
">
  Modal content
</div>

// Toast enter
<div className="
  animate-in 
  slide-in-from-right-full 
  fade-in 
  duration-300
">
  Toast notification
</div>

// Dropdown enter
<div className="
  animate-in 
  fade-in-0 
  zoom-in-95 
  slide-in-from-top-2 
  duration-200
">
  Dropdown menu
</div>
```

### Exit Animations

```tsx
// Must use animate-out for exit
<div className="
  animate-out 
  fade-out 
  zoom-out-95 
  slide-out-to-bottom-4 
  duration-200
">
  Exiting content
</div>

// Toast exit
<div className="
  animate-out 
  slide-out-to-right-full 
  fade-out 
  duration-200
">
  Toast leaving
</div>
```

---

## Micro-interactions

### Button States

```tsx
<Button className="
  // Default
  bg-primary text-primary-foreground
  // Hover - subtle lift
  hover:bg-primary/90 hover:shadow-md
  // Active - press down
  active:scale-[0.98] active:shadow-none
  // Focus - ring
  focus-visible:ring-2 focus-visible:ring-ring
  // Transitions
  transition-all duration-200 ease-in-out
">
  Click me
</Button>
```

### Link Hover

```tsx
<a className="
  text-primary
  // Underline animation
  relative after:absolute after:bottom-0 after:left-0 
  after:h-[2px] after:w-0 after:bg-primary 
  after:transition-all after:duration-300
  hover:after:w-full
">
  Animated underline link
</a>
```

### Card Hover

```tsx
<Card className="
  // Default
  shadow-sm
  // Hover - lift up
  hover:-translate-y-1 hover:shadow-lg
  // Transition
  transition-all duration-300 ease-in-out
">
  Hover me
</Card>
```

### Icon Animations

```tsx
// Rotating icon (loading)
<Loader2 className="h-4 w-4 animate-spin" />

// Bouncing icon
<ChevronDown className="h-4 w-4 animate-bounce" />

// Pulse (notification)
<span className="relative flex h-3 w-3">
  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
</span>
```

---

## Loading Animations

### Spinner

```tsx
// Standard spinner
<Loader2 className="h-6 w-6 animate-spin text-primary" />

// Button with spinner
<Button disabled={isLoading}>
  {isLoading && (
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  )}
  Saving...
</Button>

// Page loader
<div className="flex items-center justify-center h-64">
  <div className="flex flex-col items-center gap-4">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <p className="text-sm text-muted-foreground animate-pulse">
      Loading...
    </p>
  </div>
</div>
```

### Skeleton Shimmer

```tsx
// Simple skeleton
<Skeleton className="h-4 w-full" />

// Shimmer effect
<div className="relative overflow-hidden">
  <Skeleton className="h-32 w-full" />
  <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
</div>

// CSS for shimmer (add to globals.css)
@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}
```

### Progress Indicators

```tsx
// Linear progress
<Progress value={progress} className="h-2" />

// With animated stripes
<div className="h-2 bg-muted rounded-full overflow-hidden">
  <div 
    className="h-full bg-primary transition-all duration-500 animate-[progress_2s_ease-in-out]"
    style={{ width: `${progress}%` }}
  />
</div>

// Circular progress
<div className="relative h-12 w-12">
  <svg className="animate-spin" viewBox="0 0 24 24">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      fill="none"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
</div>
```

---

## Page Transitions

### Next.js Page Transition

```tsx
// app/template.tsx
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {children}
    </div>
  );
}
```

### Layout Transition

```tsx
// Animate layout changes
<div className="grid gap-4 transition-all duration-500 ease-in-out">
  {items.map((item) => (
    <div 
      key={item.id}
      layout // Framer Motion prop
      className="transition-all duration-300"
    >
      {item.content}
    </div>
  ))}
</div>
```

---

## Framer Motion Patterns

### Basic Motion

```tsx
import { motion } from 'framer-motion';

// Fade in up
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
>
  Content
</motion.div>

// Scale on hover
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ duration: 0.2 }}
>
  Hover me
</motion.button>
```

### Stagger Children

```tsx
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

<motion.ul variants={container} initial="hidden" animate="show">
  {items.map((item) => (
    <motion.li key={item.id} variants={item}>
      {item.content}
    </motion.li>
  ))}
</motion.ul>
```

### List Reordering

```tsx
import { Reorder } from 'framer-motion';

<Reorder.Group axis="y" values={items} onReorder={setItems}>
  {items.map((item) => (
    <Reorder.Item
      key={item.id}
      value={item}
      className="cursor-grab active:cursor-grabbing"
    >
      {item.content}
    </Reorder.Item>
  ))}
</Reorder.Group>
```

### Animate Presence (Exit Animations)

```tsx
import { AnimatePresence, motion } from 'framer-motion';

<AnimatePresence mode="wait">
  {isOpen && (
    <motion.div
      key="modal"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      Modal content
    </motion.div>
  )}
</AnimatePresence>
```

### Gesture Animations

```tsx
// Drag
<motion.div
  drag
  dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
  dragElastic={0.2}
>
  Drag me
</motion.div>

// Swipe to dismiss
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  onDragEnd={(e, { offset, velocity }) => {
    if (offset.x > 100 || velocity.x > 500) {
      dismiss();
    }
  }}
>
  Swipe me
</motion.div>
```

---

## Accessibility: Reduced Motion

Always respect user preferences:

```tsx
// Tailwind - built in
<div className="
  transition-all duration-300
  motion-reduce:transition-none
  motion-reduce:transform-none
">
  Content
</div>

// Framer Motion
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ 
    duration: prefersReducedMotion ? 0 : 0.3 
  }}
>
  Content
</motion.div>

// CSS approach
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Common Animation Recipes

### Toast Notification

```tsx
const toastVariants = {
  hidden: { 
    opacity: 0, 
    y: -20,
    scale: 0.95 
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: { 
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1]
    }
  },
  exit: { 
    opacity: 0,
    x: 100,
    transition: { 
      duration: 0.2 
    }
  }
};

<motion.div
  variants={toastVariants}
  initial="hidden"
  animate="visible"
  exit="exit"
  className="rounded-lg bg-foreground text-background p-4 shadow-lg"
>
  Toast message
</motion.div>
```

### Modal/Dialog

```tsx
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 }
};

const contentVariants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95,
    y: 10 
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: { 
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1]
    }
  },
  exit: { 
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: { 
      duration: 0.15 
    }
  }
};

<AnimatePresence>
  {isOpen && (
    <>
      <motion.div
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />
      <motion.div
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        <DialogContent>
          {/* Dialog content */}
        </DialogContent>
      </motion.div>
    </>
  )}
</AnimatePresence>
```

### Dropdown Menu

```tsx
const menuVariants = {
  hidden: { 
    opacity: 0,
    scale: 0.95,
    y: -8
  },
  visible: { 
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { 
      duration: 0.15,
      ease: [0.4, 0, 0.2, 1]
    }
  },
  exit: { 
    opacity: 0,
    scale: 0.95,
    y: -8,
    transition: { 
      duration: 0.1 
    }
  }
};

<motion.div
  variants={menuVariants}
  initial="hidden"
  animate="visible"
  exit="exit"
  className="rounded-lg border bg-popover p-1 shadow-lg"
>
  {menuItems.map((item) => (
    <motion.button
      key={item.id}
      whileHover={{ x: 2 }}
      className="..."
    >
      {item.label}
    </motion.button>
  ))}
</motion.div>
```

### Page Loading State

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1]
    }
  }
};

<motion.div
  variants={containerVariants}
  initial="hidden"
  animate="visible"
>
  <motion.div variants={itemVariants}>
    <Hero />
  </motion.div>
  <motion.div variants={itemVariants}>
    <Features />
  </motion.div>
  <motion.div variants={itemVariants}>
    <CTA />
  </motion.div>
</motion.div>
```

---

## Animation Checklist

Before shipping, verify:

- [ ] All animations are 150-500ms
- [ ] Uses consistent easing (ease-in-out)
- [ ] Respects `prefers-reduced-motion`
- [ ] Exit animations defined (for AnimatePresence)
- [ ] No layout thrashing
- [ ] 60fps on target devices
- [ ] Purpose is clear (not decorative only)
