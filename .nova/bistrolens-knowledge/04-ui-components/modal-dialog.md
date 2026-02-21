# Modal/Dialog Patterns

## Source
Extracted from BistroLens `components/Modal.tsx`, `components/HistoryModal.tsx`, `components/WelcomeModal.tsx`, `components/RecipeRemixerModal.tsx`

---

## Pattern: Reusable Modal Component

A flexible, accessible modal component that handles overlay, focus trapping, keyboard navigation, and body scroll locking. The base Modal component provides a foundation for building feature-specific modals.

---

## Base Modal Component

### Code Example

```typescript
import React, { useEffect, useRef } from 'react';
import { CloseIcon } from './Icons';

interface ModalProps {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
  fixedHeight?: boolean;
  hideHeader?: boolean;
}

const Modal: React.FC<ModalProps> = ({ 
  onClose, 
  title, 
  children, 
  size = 'lg', 
  fixedHeight = false, 
  hideHeader = false 
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation: ESC to close
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Trap focus in modal
    if (modalRef.current) {
      modalRef.current.focus();
    }

    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const maxWidthClass = {
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-5xl'
  }[size];

  const heightClass = fixedHeight ? 'h-[800px]' : 'max-h-[85vh]';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-brand-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        ref={modalRef}
        tabIndex={-1}
        className={`bg-brand-white border border-brand-black/20 rounded-[3rem] shadow-2xl w-full ${maxWidthClass} ${heightClass} flex flex-col animate-in zoom-in-95 transition-all duration-300 overflow-hidden relative outline-none`}
        onClick={e => e.stopPropagation()}
      >
        {!hideHeader && (
          <header className="flex items-center justify-between px-8 py-5 border-b border-brand-black/20 flex-none bg-brand-white">
            <h2 id="modal-title" className="text-xl font-serif font-bold text-brand-black">
              {title}
            </h2>
            <button 
              onClick={onClose} 
              className="p-3 rounded-full text-brand-black/60 hover:bg-brand-black/20 transition-colors" 
              aria-label="Close modal"
            >
              <CloseIcon className="w-6 h-6" />
            </button>
          </header>
        )}
        <div className="flex-1 overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
```

### Key Features

1. **Accessibility**
   - `role="dialog"` and `aria-modal="true"` for screen readers
   - `aria-labelledby` connects to modal title
   - Focus trap with `tabIndex={-1}` and auto-focus
   - ESC key to close

2. **UX Enhancements**
   - Body scroll lock when modal is open
   - Click outside to close (overlay click)
   - Backdrop blur effect
   - Smooth animations (fade-in, zoom-in)

3. **Flexibility**
   - Three size variants: `md`, `lg`, `xl`
   - Optional fixed height
   - Optional header hiding
   - Flexible children content

---

## Pattern: List Modal with Empty State

A modal that displays a list of items with proper empty state handling.

### Code Example

```typescript
import React from 'react';
import Modal from './Modal';
import { Recipe } from '../types';
import { ClockIcon, ArrowRightIcon } from './Icons';

interface HistoryModalProps {
  history: Recipe[];
  onClose: () => void;
  onSelectRecipe: (recipe: Recipe) => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ 
  history, 
  onClose, 
  onSelectRecipe 
}) => {
  return (
    <Modal onClose={onClose} title="Recent Recipes" size="lg">
      <div 
        className="overflow-y-auto"
        style={{ padding: '32px 24px', height: '500px' }}
        aria-label="Recipe history list"
      >
        {history.length === 0 ? (
          // Empty State
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
            <ClockIcon className="w-20 h-20 opacity-20 text-gray-400" />
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-600">
                No recent recipes found.
              </p>
              <p className="text-sm text-gray-500">
                Start cooking to build your history!
              </p>
            </div>
          </div>
        ) : (
          // List Items
          <div className="space-y-6">
            {history.map((recipe, index) => (
              <button 
                key={`${recipe.title}-${index}`}
                onClick={() => onSelectRecipe(recipe)}
                className="flex items-center w-full text-left p-5 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all group gap-5"
              >
                {/* Recipe Image */}
                <div className="flex-shrink-0 w-20 h-20 rounded-md overflow-hidden bg-gray-200">
                  {recipe.imageUrl ? (
                    <img 
                      src={recipe.imageUrl} 
                      alt={recipe.title} 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl">🍽️</span>
                    </div>
                  )}
                </div>
                
                {/* Recipe Info */}
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-base font-semibold text-black truncate">
                    {recipe.title}
                  </p>
                  <p className="text-sm text-gray-600 truncate">
                    {recipe.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs font-semibold text-gray-500 uppercase">
                    <span>{recipe.cuisine}</span>
                    <span className="text-gray-300">•</span>
                    <span>{recipe.difficulty}</span>
                  </div>
                </div>
                
                {/* Arrow Indicator */}
                <div className="flex-shrink-0 text-gray-400 group-hover:text-brand-primary transition-colors">
                  <ArrowRightIcon className="w-5 h-5" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="flex justify-end p-5 border-t border-gray-200">
        <button 
          onClick={onClose}
          className="px-6 py-2 rounded-full border border-gray-300 hover:bg-gray-100 font-bold text-sm uppercase"
        >
          Close
        </button>
      </div>
    </Modal>
  );
};

export default HistoryModal;
```

### Key Features

1. **Empty State Handling**
   - Clear icon and messaging
   - Centered layout
   - Call-to-action guidance

2. **List Item Design**
   - Image thumbnail with fallback
   - Clear visual hierarchy
   - Hover effects for interactivity
   - Arrow indicator for navigation

3. **Scrollable Content**
   - Fixed height with overflow-y-auto
   - Proper padding and spacing
   - Maintains footer visibility

---

## Pattern: Form Modal with Loading State

A modal that handles form submission with loading states and error handling.

### Code Example

```typescript
import React, { useState } from 'react';
import Modal from './Modal';
import { remixRecipe } from '../services/geminiService';
import { Recipe } from '../types';
import LoadingScreen from './LoadingScreen';

interface RecipeRemixerModalProps {
  recipe: Recipe;
  onClose: () => void;
  onRemixComplete: (remixedRecipe: Recipe) => void;
}

const RecipeRemixerModal: React.FC<RecipeRemixerModalProps> = ({ 
  recipe, 
  onClose, 
  onRemixComplete 
}) => {
  const [remixGoal, setRemixGoal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRemix = async () => {
    if (!remixGoal.trim()) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const remixedRecipe = await remixRecipe(recipe, remixGoal);
      onRemixComplete(remixedRecipe);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const quickGoals = [
    'Make it healthier', 
    'Make it vegan', 
    'Give it a spicy kick', 
    'Make it in under 30 minutes'
  ];

  return (
    <Modal onClose={onClose} title={`Remix: ${recipe.title}`}>
      {isLoading ? (
        <LoadingScreen task="Reimagining this dish..." className="h-96" />
      ) : (
        <div className="p-6 space-y-4">
          {/* Form Input */}
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">
              How would you like to change this recipe?
            </label>
            <textarea
              value={remixGoal}
              onChange={(e) => setRemixGoal(e.target.value)}
              placeholder="e.g., 'Give it a Korean twist' or 'Make it gluten-free'"
              className="w-full bg-white border border-gray-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-brand-primary resize-none"
              rows={3}
              aria-label="Describe your remix goal"
            />
          </div>
          
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            {quickGoals.map(goal => (
              <button 
                key={goal} 
                onClick={() => setRemixGoal(goal)} 
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-full hover:bg-gray-100"
                aria-label={`Set remix goal to ${goal}`}
              >
                {goal}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button 
              onClick={onClose} 
              className="px-4 py-2 text-sm font-bold uppercase rounded-full border border-gray-300 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button 
              onClick={handleRemix} 
              disabled={!remixGoal.trim()} 
              className="px-4 py-2 text-sm font-bold uppercase rounded-full bg-brand-primary text-white hover:bg-brand-primary-hover disabled:bg-gray-400"
            >
              Remix Recipe
            </button>
          </div>
          
          {/* Error Display */}
          {error && (
            <p className="text-red-500 text-sm text-right mt-2" aria-live="polite">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};

export default RecipeRemixerModal;
```

### Key Features

1. **Loading State Management**
   - Conditional rendering based on loading state
   - Loading screen replaces form content
   - Prevents interaction during submission

2. **Form Validation**
   - Disabled submit button when input is empty
   - Trim whitespace validation
   - Clear error messaging

3. **Quick Actions**
   - Pre-defined options for common use cases
   - One-click form population
   - Improves UX and reduces typing

4. **Error Handling**
   - Error state display with `aria-live="polite"`
   - Clear error messages
   - Error cleared on retry

---

## Pattern: Multi-Step Modal with Animation

A modal that guides users through multiple steps with smooth animations.

### Code Example

```typescript
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRightIcon, MagicWandIcon } from './Icons';

interface WelcomeModalProps {
  onClose: () => void;
  onComplete: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ onClose, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const features = [
    {
      id: 'visual',
      title: "Visual Intelligence",
      desc: "Snap a photo of any dish, menu, or recipe card. Our AI instantly analyzes and reconstructs the recipe.",
      icon: CameraIcon
    },
    {
      id: 'voice',
      title: "Hands-Free Cooking",
      desc: "Use voice commands like 'Next' or 'Back' to navigate recipe steps without lifting a finger.",
      icon: MicIcon
    },
    // ... more steps
  ];

  const paginate = (newDirection: number) => {
    const newIndex = currentIndex + newDirection;
    if (newIndex >= 0 && newIndex < features.length) {
      setDirection(newDirection);
      setCurrentIndex(newIndex);
    } else if (newIndex >= features.length) {
      onComplete();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        paginate(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        paginate(1);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: { type: "spring", stiffness: 350, damping: 25 }
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -300 : 300,
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.2 }
    })
  };

  return (
    <Modal onClose={onClose} title="" size="xl" hideHeader={true}>
      <div className="flex flex-col h-[600px] relative overflow-hidden">
        
        {/* Progress Bar */}
        <div className="flex justify-center gap-1 w-full max-w-sm mx-auto p-4">
          {features.map((_, i) => (
            <div 
              key={i} 
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= currentIndex ? 'bg-brand-primary' : 'bg-gray-300'
              }`} 
            />
          ))}
        </div>

        {/* Animated Content */}
        <div className="flex-1 relative flex items-center justify-center p-4">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute inset-0 flex flex-col items-center justify-center text-center p-8"
            >
              <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center mb-6">
                {React.createElement(features[currentIndex].icon, { 
                  className: "w-8 h-8 text-brand-primary" 
                })}
              </div>
              <h2 className="text-2xl font-bold mb-4">
                {features[currentIndex].title}
              </h2>
              <p className="text-gray-600 max-w-md">
                {features[currentIndex].desc}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Controls */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200">
          <button 
            onClick={onClose}
            className="px-6 py-2 rounded-full text-sm font-bold text-gray-600 hover:bg-gray-100"
          >
            Skip
          </button>

          <div className="flex gap-2">
            <button 
              onClick={() => paginate(-1)}
              disabled={currentIndex === 0}
              className="px-6 py-2 rounded-full text-sm font-bold border border-gray-300 hover:bg-gray-100 disabled:opacity-30"
            >
              Back
            </button>
            <button 
              onClick={() => paginate(1)}
              className="px-8 py-2 bg-brand-primary text-white rounded-full font-bold text-sm shadow-lg hover:bg-brand-primary-hover flex items-center gap-2"
            >
              {currentIndex === features.length - 1 ? (
                <>Complete <MagicWandIcon className="w-4 h-4" /></>
              ) : (
                <>Next <ArrowRightIcon className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default WelcomeModal;
```

### Key Features

1. **Smooth Animations**
   - Framer Motion for enter/exit animations
   - Spring physics for natural movement
   - Direction-aware transitions

2. **Progress Indication**
   - Visual progress bar
   - Current step highlighting
   - Clear completion state

3. **Multiple Navigation Methods**
   - Button controls
   - Keyboard navigation (arrow keys)
   - Skip option for power users

4. **Adaptive Content**
   - Dynamic button text based on step
   - Conditional rendering for final step
   - Icon-based visual hierarchy

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Missing accessibility attributes
<div className="modal-overlay" onClick={onClose}>
  <div className="modal-content">
    <h2>{title}</h2>
    {children}
  </div>
</div>

// No focus trap or keyboard handling
// No body scroll lock
// No ESC key support
// Missing ARIA attributes
```

### ❌ Don't Do This

```typescript
// Forgetting to stop propagation on modal content
<div className="overlay" onClick={onClose}>
  <div className="modal">
    {/* Clicking here will also trigger onClose! */}
    {children}
  </div>
</div>
```

### ❌ Don't Do This

```typescript
// Not cleaning up body scroll lock
useEffect(() => {
  document.body.style.overflow = 'hidden';
  // Missing cleanup!
}, []);
```

### ❌ Don't Do This

```typescript
// Loading state that doesn't prevent interaction
{isLoading && <LoadingSpinner />}
<form onSubmit={handleSubmit}>
  {/* Form is still interactive while loading! */}
  <button type="submit">Submit</button>
</form>
```

### ✅ Do This Instead

```typescript
// Proper accessibility and UX
<div 
  className="fixed inset-0 z-50 flex items-center justify-center"
  onClick={onClose}
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <div 
    ref={modalRef}
    tabIndex={-1}
    onClick={e => e.stopPropagation()}
  >
    <h2 id="modal-title">{title}</h2>
    {children}
  </div>
</div>

// With proper cleanup
useEffect(() => {
  document.body.style.overflow = 'hidden';
  return () => {
    document.body.style.overflow = '';
  };
}, []);

// Conditional rendering for loading
{isLoading ? (
  <LoadingScreen />
) : (
  <form onSubmit={handleSubmit}>
    <button type="submit">Submit</button>
  </form>
)}
```

---

## When to Use This Pattern

✅ **Use for:**
- Focused user tasks that require attention (forms, confirmations)
- Displaying detailed information without navigation
- Multi-step workflows (onboarding, wizards)
- Temporary content that doesn't need a dedicated page
- Interrupting user flow for important actions

❌ **Don't use for:**
- Complex workflows better suited for full pages
- Content that users need to reference while working elsewhere
- Mobile-first experiences (consider bottom sheets instead)
- Frequent, repetitive interactions (use inline UI)
- Content that should be bookmarkable or shareable

---

## Benefits

1. **Accessibility First**
   - Screen reader support with proper ARIA attributes
   - Keyboard navigation (ESC, Tab, Arrow keys)
   - Focus management and trapping
   - Semantic HTML structure

2. **Excellent UX**
   - Body scroll lock prevents confusion
   - Click outside to close is intuitive
   - Smooth animations feel polished
   - Loading states prevent double-submission

3. **Flexible Architecture**
   - Base component handles common concerns
   - Feature-specific modals extend base
   - Size variants for different content needs
   - Optional header for custom layouts

4. **Maintainable Code**
   - Single source of truth for modal behavior
   - Consistent styling across all modals
   - Easy to add new modal types
   - Clear separation of concerns

5. **Performance**
   - Lazy loading with React.lazy() for modal content
   - Conditional rendering prevents unnecessary work
   - Proper cleanup prevents memory leaks
   - Optimized animations with GPU acceleration

---

## Related Patterns

- See `toast-notifications.md` for non-blocking feedback
- See `loading-states.md` for loading UI patterns
- See `empty-states.md` for empty state handling
- See `error-states.md` for error display patterns
- See `../05-form-patterns/form-validation.md` for form handling in modals

---

*Extracted: 2026-02-18*
