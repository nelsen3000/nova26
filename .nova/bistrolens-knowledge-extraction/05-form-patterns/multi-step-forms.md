# Multi-Step Forms

## Source
Extracted from BistroLens:
- `components/OnboardingFlow.tsx`
- `components/TasteProfileQuiz.tsx`
- `components/DrinkProfileBuilder.tsx`
- `components/WelcomeModal.tsx`
- `components/PotluckPlannerModal.tsx`

---

## Pattern: Multi-Step Form Wizard

Multi-step forms break complex data collection into manageable steps with clear progress indicators, navigation controls, and state persistence. This pattern is essential for onboarding flows, profile builders, and complex configuration wizards.

---

## Core Implementation

### Basic Step Management

```typescript
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MultiStepFormProps {
  onComplete: (data: any) => void;
  onSkip?: () => void;
}

const MultiStepForm: React.FC<MultiStepFormProps> = ({ onComplete, onSkip }) => {
  // Step state management
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0); // For animations: 1 = forward, -1 = backward
  
  // Form data state
  const [formData, setFormData] = useState({
    step1Data: [],
    step2Data: '',
    step3Data: 3,
  });

  const totalSteps = 5;

  // Navigation handlers
  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setDirection(1);
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    // Save data and close
    onComplete(formData);
  };

  return (
    <div className="multi-step-form">
      {/* Progress indicator */}
      <ProgressBar current={currentStep} total={totalSteps} />
      
      {/* Step content with animation */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentStep}
          custom={direction}
          initial={{ opacity: 0, x: direction > 0 ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction > 0 ? -20 : 20 }}
          transition={{ duration: 0.2 }}
        >
          {renderStep(currentStep)}
        </motion.div>
      </AnimatePresence>
      
      {/* Navigation controls */}
      <div className="flex justify-between mt-6">
        <button onClick={currentStep === 0 ? onSkip : handleBack}>
          {currentStep === 0 ? 'Skip' : 'Back'}
        </button>
        <button onClick={handleNext}>
          {currentStep === totalSteps - 1 ? 'Complete' : 'Next'}
        </button>
      </div>
    </div>
  );
};
```

---

## Progress Indicators

### Linear Progress Bar

```typescript
interface ProgressBarProps {
  current: number;
  total: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, total }) => {
  const percentage = ((current + 1) / total) * 100;
  
  return (
    <div className="w-full bg-gray-200 rounded-full h-1 mb-6">
      <motion.div
        className="h-full bg-brand-primary rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.3 }}
      />
    </div>
  );
};
```

### Step Dots Indicator

```typescript
const StepDots: React.FC<{ current: number; total: number }> = ({ current, total }) => {
  return (
    <div className="flex items-center gap-1 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-colors ${
            i === current ? 'bg-brand-primary' : 'bg-brand-black/20'
          }`}
        />
      ))}
    </div>
  );
};
```

### Segmented Progress

```typescript
const SegmentedProgress: React.FC<{ current: number; steps: string[] }> = ({ 
  current, 
  steps 
}) => {
  return (
    <div className="flex gap-1 w-full">
      {steps.map((step, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
            i <= current ? 'bg-brand-primary' : 'bg-brand-primary/20'
          }`}
        />
      ))}
    </div>
  );
};
```

---

## Step Content Patterns

### Selection Step (Multi-Select)

```typescript
interface SelectionStepProps {
  options: Array<{ id: string; label: string; emoji: string }>;
  selected: string[];
  onToggle: (id: string) => void;
  onNext: () => void;
}

const SelectionStep: React.FC<SelectionStepProps> = ({ 
  options, 
  selected, 
  onToggle, 
  onNext 
}) => {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-center">
        What cuisines do you love? 🍽️
      </h2>
      <p className="text-sm text-gray-600 text-center">
        Select all that apply
      </p>
      
      <div className="grid grid-cols-3 gap-2">
        {options.map(option => (
          <button
            key={option.id}
            onClick={() => onToggle(option.id)}
            className={`p-3 rounded-xl border-2 transition-all ${
              selected.includes(option.id)
                ? 'border-brand-primary bg-brand-primary/10'
                : 'border-gray-200 hover:border-brand-primary/50'
            }`}
          >
            <span className="text-2xl block">{option.emoji}</span>
            <span className="text-xs font-medium">{option.label}</span>
          </button>
        ))}
      </div>
      
      <button onClick={onNext} className="w-full btn-primary">
        Continue
      </button>
    </div>
  );
};
```

### Slider Input Step

```typescript
interface SliderStepProps {
  value: number;
  onChange: (value: number) => void;
  onNext: () => void;
}

const SliderStep: React.FC<SliderStepProps> = ({ value, onChange, onNext }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-center">
        How spicy do you like it? 🌶️
      </h2>
      
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-gray-600">
          <span>Mild</span>
          <span>Medium</span>
          <span>Hot!</span>
        </div>
        
        <input
          type="range"
          min="1"
          max="5"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="w-full h-2 bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 rounded-lg appearance-none cursor-pointer"
        />
        
        <div className="text-center text-2xl">
          {['🥒', '🫑', '🌶️', '🔥', '💀'][value - 1]}
        </div>
      </div>
      
      <button onClick={onNext} className="w-full btn-primary">
        Continue
      </button>
    </div>
  );
};
```

### Form Input Step

```typescript
interface FormInputStepProps {
  data: { name: string; email: string };
  onChange: (field: string, value: string) => void;
  onNext: () => void;
}

const FormInputStep: React.FC<FormInputStepProps> = ({ data, onChange, onNext }) => {
  const isValid = data.name.trim() && data.email.includes('@');
  
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-center">
        Tell us about yourself
      </h2>
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="Your name"
            className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={data.email}
            onChange={(e) => onChange('email', e.target.value)}
            placeholder="your@email.com"
            className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
          />
        </div>
      </div>
      
      <button 
        onClick={onNext} 
        disabled={!isValid}
        className="w-full btn-primary disabled:opacity-50"
      >
        Continue
      </button>
    </div>
  );
};
```

---

## State Management Patterns

### Centralized Form State

```typescript
interface OnboardingData {
  dietaryPreferences: string[];
  allergies: string[];
  cuisines: string[];
  spiceLevel: number;
  cookTime: 'quick' | 'moderate' | 'elaborate' | 'any';
}

const OnboardingFlow: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<OnboardingData>({
    dietaryPreferences: [],
    allergies: [],
    cuisines: [],
    spiceLevel: 3,
    cookTime: 'any',
  });

  // Update specific field
  const updateField = <K extends keyof OnboardingData>(
    field: K,
    value: OnboardingData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Toggle array item (for multi-select)
  const toggleArrayItem = <K extends keyof OnboardingData>(
    field: K,
    item: string
  ) => {
    setFormData(prev => {
      const array = prev[field] as string[];
      return {
        ...prev,
        [field]: array.includes(item)
          ? array.filter(i => i !== item)
          : [...array, item]
      };
    });
  };

  return (
    // Form implementation
    <div>
      {/* Steps render here */}
    </div>
  );
};
```

### Context-Based State (for complex forms)

```typescript
import { createContext, useContext, useState } from 'react';

interface FormContextType {
  data: OnboardingData;
  updateField: (field: string, value: any) => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
}

const FormContext = createContext<FormContextType | null>(null);

export const FormProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<OnboardingData>({
    /* initial state */
  });
  const [currentStep, setCurrentStep] = useState(0);

  const updateField = (field: string, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <FormContext.Provider value={{ data, updateField, currentStep, setCurrentStep }}>
      {children}
    </FormContext.Provider>
  );
};

// Usage in step components
const StepComponent = () => {
  const { data, updateField } = useContext(FormContext)!;
  
  return (
    <div>
      {/* Use data and updateField */}
    </div>
  );
};
```

---

## Navigation Patterns

### Standard Navigation

```typescript
const Navigation: React.FC<{
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
  canProceed?: boolean;
}> = ({ currentStep, totalSteps, onNext, onBack, onSkip, canProceed = true }) => {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="flex justify-between items-center mt-6 pt-4 border-t">
      <button
        onClick={isFirstStep ? onSkip : onBack}
        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        {isFirstStep ? 'Skip for now' : 'Back'}
      </button>

      <button
        onClick={onNext}
        disabled={!canProceed}
        className="px-6 py-2 bg-brand-primary text-white rounded-full font-bold disabled:opacity-50"
      >
        {isLastStep ? 'Complete' : 'Next'}
      </button>
    </div>
  );
};
```

### Swipe Navigation (Mobile)

```typescript
import { motion, PanInfo, useMotionValue, useTransform } from 'framer-motion';

const SwipeableStep: React.FC<{
  children: React.ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}> = ({ children, onSwipeLeft, onSwipeRight }) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-5, 5]);

  const handleDragEnd = (_: any, { offset }: PanInfo) => {
    const threshold = 50;
    if (offset.x < -threshold) {
      onSwipeLeft(); // Next
    } else if (offset.x > threshold) {
      onSwipeRight(); // Previous
    }
  };

  return (
    <motion.div
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={1}
      onDragEnd={handleDragEnd}
      className="cursor-grab active:cursor-grabbing"
    >
      {children}
    </motion.div>
  );
};
```

---

## Validation Patterns

### Step-Level Validation

```typescript
interface StepConfig {
  id: string;
  component: React.ComponentType<any>;
  validate: (data: any) => boolean;
  required: boolean;
}

const steps: StepConfig[] = [
  {
    id: 'dietary',
    component: DietaryStep,
    validate: (data) => data.dietaryPreferences.length > 0,
    required: false, // Can skip
  },
  {
    id: 'allergies',
    component: AllergiesStep,
    validate: () => true, // Always valid
    required: false,
  },
  {
    id: 'profile',
    component: ProfileStep,
    validate: (data) => data.name.trim() && data.email.includes('@'),
    required: true, // Must complete
  },
];

const MultiStepForm = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});

  const canProceed = steps[currentStep].validate(formData);
  const canSkip = !steps[currentStep].required;

  const handleNext = () => {
    if (canProceed || canSkip) {
      setCurrentStep(prev => prev + 1);
    }
  };

  return (
    <div>
      {/* Render current step */}
      <Navigation
        currentStep={currentStep}
        totalSteps={steps.length}
        onNext={handleNext}
        onBack={() => setCurrentStep(prev => prev - 1)}
        canProceed={canProceed || canSkip}
      />
    </div>
  );
};
```

### Real-Time Validation

```typescript
const ValidatedInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  validate: (value: string) => { valid: boolean; message?: string };
  label: string;
}> = ({ value, onChange, validate, label }) => {
  const [touched, setTouched] = useState(false);
  const validation = validate(value);
  const showError = touched && !validation.valid;

  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        className={`w-full p-3 rounded-xl border ${
          showError ? 'border-red-500' : 'border-gray-200'
        } focus:ring-2 focus:ring-brand-primary outline-none`}
      />
      {showError && (
        <p className="text-xs text-red-500 mt-1">{validation.message}</p>
      )}
    </div>
  );
};
```

---

## State Persistence

### LocalStorage Persistence

```typescript
const STORAGE_KEY = 'onboarding_progress';

const usePersistedForm = <T,>(initialData: T) => {
  const [data, setData] = useState<T>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialData;
  });

  const [currentStep, setCurrentStep] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_step`);
    return saved ? parseInt(saved) : 0;
  });

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_step`, currentStep.toString());
  }, [currentStep]);

  const clearProgress = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(`${STORAGE_KEY}_step`);
  };

  return { data, setData, currentStep, setCurrentStep, clearProgress };
};

// Usage
const OnboardingFlow = () => {
  const { data, setData, currentStep, setCurrentStep, clearProgress } = 
    usePersistedForm<OnboardingData>(initialData);

  const handleComplete = () => {
    // Save final data
    saveToBackend(data);
    // Clear progress
    clearProgress();
  };

  return (
    // Form implementation
    <div>...</div>
  );
};
```

---

## Loading States

### Async Step Completion

```typescript
const AsyncStep: React.FC<{
  onComplete: () => void;
}> = ({ onComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await saveData(formData);
      playSuccessSound();
      onComplete();
    } catch (err) {
      setError('Failed to save. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      
      <button
        onClick={handleSubmit}
        disabled={isLoading}
        className="w-full btn-primary disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            Saving...
          </>
        ) : (
          'Complete'
        )}
      </button>
    </div>
  );
};
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// ❌ BAD: Losing form data on unmount
const BadMultiStepForm = () => {
  const [step, setStep] = useState(0);
  // Data is lost if component unmounts
  const [data, setData] = useState({});
  
  return <div>{/* Form */}</div>;
};

// ❌ BAD: No validation before proceeding
const handleNext = () => {
  setCurrentStep(currentStep + 1); // Always allows progression
};

// ❌ BAD: No progress indicator
const NoProgressForm = () => {
  return (
    <div>
      {/* User has no idea how many steps remain */}
      <StepContent />
    </div>
  );
};

// ❌ BAD: Abrupt step transitions
const AbruptTransition = () => {
  return (
    <div>
      {currentStep === 0 && <Step1 />}
      {currentStep === 1 && <Step2 />}
      {/* No animation, jarring experience */}
    </div>
  );
};

// ❌ BAD: No way to go back
const NoBackButton = () => {
  return (
    <div>
      <button onClick={handleNext}>Next</button>
      {/* User is trapped, can't review previous steps */}
    </div>
  );
};
```

### ✅ Do This Instead

```typescript
// ✅ GOOD: Persist form data
const GoodMultiStepForm = () => {
  const { data, setData, currentStep, setCurrentStep } = 
    usePersistedForm(initialData);
  
  return <div>{/* Form with persistence */}</div>;
};

// ✅ GOOD: Validate before proceeding
const handleNext = () => {
  if (validateCurrentStep(formData)) {
    setCurrentStep(currentStep + 1);
  } else {
    showValidationErrors();
  }
};

// ✅ GOOD: Clear progress indicator
const GoodProgressForm = () => {
  return (
    <div>
      <ProgressBar current={currentStep} total={totalSteps} />
      <p className="text-sm text-gray-600 text-center">
        Step {currentStep + 1} of {totalSteps}
      </p>
      <StepContent />
    </div>
  );
};

// ✅ GOOD: Smooth animated transitions
const SmoothTransition = () => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
      >
        {renderStep(currentStep)}
      </motion.div>
    </AnimatePresence>
  );
};

// ✅ GOOD: Allow navigation in both directions
const GoodNavigation = () => {
  return (
    <div className="flex justify-between">
      <button 
        onClick={handleBack}
        disabled={currentStep === 0}
      >
        Back
      </button>
      <button onClick={handleNext}>Next</button>
    </div>
  );
};
```

---

## When to Use This Pattern

✅ **Use for:**
- Onboarding flows with multiple configuration steps
- Profile builders requiring extensive user input
- Complex forms that would overwhelm users if shown all at once
- Wizards guiding users through multi-stage processes
- Data collection that benefits from logical grouping
- Forms where early steps inform later step options

❌ **Don't use for:**
- Simple forms with 2-3 fields (use single-page form)
- Forms where users need to see all fields simultaneously
- Time-sensitive forms where speed is critical
- Forms where steps are highly interdependent (consider alternative UI)

---

## Benefits

1. **Reduced Cognitive Load**: Breaking complex forms into steps makes them less overwhelming
2. **Better Completion Rates**: Users are more likely to complete shorter, focused steps
3. **Progressive Disclosure**: Show only relevant information at each stage
4. **Clear Progress**: Users know how far they've come and what remains
5. **Validation Per Step**: Catch errors early before final submission
6. **Mobile-Friendly**: Smaller screens benefit from focused, single-step views
7. **Conditional Logic**: Later steps can adapt based on earlier responses
8. **Save Progress**: Users can return later without losing work

---

## Related Patterns

- See `form-validation.md` for validation strategies
- See `form-submission.md` for final submission handling
- See `loading-states.md` for async operation patterns
- See `error-states.md` for error handling in forms
- See `modal-dialog.md` for containing multi-step flows in modals

---

*Extracted: 2026-02-18*
