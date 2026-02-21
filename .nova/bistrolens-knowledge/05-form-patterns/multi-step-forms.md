# Multi-Step Form Patterns

## Source
Extracted from BistroLens `components/OnboardingFlow.tsx`

---

## Pattern: Wizard-Style Multi-Step Forms

Multi-step forms (wizards) break complex forms into manageable steps with progress tracking, navigation, and state management.

---

## Step Configuration

### Code Example

```typescript
interface OnboardingStep {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  component: React.ComponentType<any>;
}

const steps: OnboardingStep[] = [
  {
    id: 'dietary',
    title: 'Dietary',
    subtitle: 'Your Preferences',
    description: 'Tell us about your dietary needs',
    icon: UserIcon,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    component: DietaryPreferencesStep
  },
  {
    id: 'allergies',
    title: 'Allergies',
    subtitle: 'Stay Safe',
    description: 'Let us know about any food allergies',
    icon: AlertCircleIcon,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    component: AllergiesStep
  },
  {
    id: 'cuisines',
    title: 'Cuisines',
    subtitle: 'Your Favorites',
    description: 'Select cuisines you love',
    icon: SparklesIcon,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
    component: CuisinePreferencesStep
  },
  {
    id: 'equipment',
    title: 'Equipment',
    subtitle: 'Your Kitchen',
    description: 'What equipment do you have?',
    icon: CogIcon,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    component: KitchenEquipmentStep
  },
  {
    id: 'demo',
    title: 'Experience',
    subtitle: 'See AI in Action',
    description: 'Watch how we create personalized recipes',
    icon: ChefHatIcon,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    component: RecipeDemoStep
  }
];
```

---

## State Management

### Code Example

```typescript
import { useState } from 'react';

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ 
  isOpen, 
  onClose, 
  onComplete 
}) => {
  // Current step index
  const [currentStep, setCurrentStep] = useState(0);
  
  // Data collected from steps
  const [selectedPersona, setSelectedPersona] = useState('beginner_cook');
  
  // Track completed steps
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  // Step navigation handler
  const handleStepComplete = (stepData?: any) => {
    const currentStepId = steps[currentStep].id;
    
    // Save step-specific data
    if (currentStepId === 'persona' && stepData) {
      setSelectedPersona(stepData);
    }
    
    // Mark step as completed
    setCompletedSteps(prev => [...prev, currentStepId]);
    
    // Navigate to next step or complete
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    // Persist completion state
    localStorage.setItem('bistroLens_onboardingCompleted', 'true');
    localStorage.setItem('bistroLens_onboardingCompletedAt', new Date().toISOString());
    
    // Notify parent
    onComplete(completedSteps);
    onClose();
  };

  // Render current step component
  const CurrentStepComponent = steps[currentStep].component;

  return (
    <div>
      {/* Wizard UI */}
      <CurrentStepComponent 
        onNext={handleStepComplete}
        persona={selectedPersona}
      />
    </div>
  );
};
```

---

## Progress Indicator

### Code Example

```tsx
import { motion } from 'framer-motion';

// Visual progress bar
<div className="flex gap-2 mt-4">
  {steps.map((step, index) => (
    <div
      key={step.id}
      className={`flex-1 h-1 rounded-full transition-colors ${
        index <= currentStep 
          ? 'bg-brand-primary' 
          : 'bg-brand-black/20'
      }`}
    />
  ))}
</div>

// Step indicator with labels
<div className="flex items-center justify-between mb-8">
  {steps.map((step, index) => (
    <div key={step.id} className="flex flex-col items-center">
      <div className={`
        w-10 h-10 rounded-full flex items-center justify-center
        ${index <= currentStep 
          ? 'bg-brand-primary text-white' 
          : 'bg-gray-200 text-gray-400'
        }
      `}>
        {index < currentStep ? (
          <CheckIcon className="w-5 h-5" />
        ) : (
          <span>{index + 1}</span>
        )}
      </div>
      <span className="text-xs mt-2">{step.title}</span>
    </div>
  ))}
</div>
```

---

## Step Header with Context

### Code Example

```tsx
// Dynamic header showing current step info
<div className="bg-brand-white border-b border-brand-black/20 px-6 py-4">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-4">
      {/* Step icon */}
      <div className={`w-10 h-10 rounded-full ${steps[currentStep].bgColor} flex items-center justify-center`}>
        {React.createElement(steps[currentStep].icon, { 
          className: `w-5 h-5 ${steps[currentStep].color}` 
        })}
      </div>
      
      {/* Step title and subtitle */}
      <div>
        <h1 className="text-lg font-bold text-brand-black">
          {steps[currentStep].title}
        </h1>
        <p className="text-sm text-brand-black/60">
          {steps[currentStep].subtitle}
        </p>
      </div>
    </div>
    
    {/* Close button */}
    <button
      onClick={handleClose}
      className="w-8 h-8 flex items-center justify-center rounded-full text-brand-black/60 hover:bg-brand-white transition-colors"
    >
      <XMarkIcon className="w-5 h-5" />
    </button>
  </div>
  
  {/* Progress bar */}
  <div className="flex gap-2 mt-4">
    {steps.map((step, index) => (
      <div
        key={step.id}
        className={`flex-1 h-1 rounded-full transition-colors ${
          index <= currentStep ? 'bg-brand-primary' : 'bg-brand-black/20'
        }`}
      />
    ))}
  </div>
</div>
```

---

## Individual Step Component Pattern

### Code Example

```typescript
// Step component interface
interface StepProps {
  onNext: (data?: any) => void;
}

// Example step component
const DietaryPreferencesStep: React.FC<StepProps> = ({ onNext }) => {
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);

  const handleContinue = () => {
    // Save preferences to backend or context
    saveDietaryPreferences(selectedPreferences);
    
    // Move to next step
    onNext(selectedPreferences);
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Select Your Dietary Preferences</h2>
      
      {/* Preference options */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {preferences.map(pref => (
          <button
            key={pref.id}
            onClick={() => togglePreference(pref.id)}
            className={`p-4 rounded-lg border ${
              selectedPreferences.includes(pref.id)
                ? 'border-brand-primary bg-brand-primary/10'
                : 'border-gray-200'
            }`}
          >
            {pref.label}
          </button>
        ))}
      </div>
      
      {/* Navigation */}
      <button
        onClick={handleContinue}
        className="w-full py-3 bg-brand-primary text-white rounded-lg"
      >
        Continue
      </button>
    </div>
  );
};
```

---

## Navigation Controls

### Code Example

```tsx
// Back and Next buttons
<div className="flex gap-4 mt-6">
  {currentStep > 0 && (
    <button
      onClick={() => setCurrentStep(currentStep - 1)}
      className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
    >
      Back
    </button>
  )}
  
  <button
    onClick={handleStepComplete}
    disabled={!isStepValid}
    className="flex-1 py-3 bg-brand-primary text-white rounded-lg disabled:opacity-50"
  >
    {currentStep === steps.length - 1 ? 'Complete' : 'Next'}
  </button>
</div>

// Skip option for optional steps
{steps[currentStep].optional && (
  <button
    onClick={() => handleStepComplete()}
    className="w-full mt-2 text-sm text-gray-500 hover:text-gray-700"
  >
    Skip this step
  </button>
)}
```

---

## Conditional Step Flow

### Code Example

```typescript
// Dynamic step flow based on user input
const handleStepComplete = (stepData?: any) => {
  const currentStepId = steps[currentStep].id;
  
  // Save step data
  if (currentStepId === 'persona' && stepData) {
    setSelectedPersona(stepData);
  }
  
  setCompletedSteps(prev => [...prev, currentStepId]);
  
  // Conditional navigation
  if (currentStepId === 'persona' && stepData === 'advanced_chef') {
    // Skip beginner tutorial for advanced users
    setCurrentStep(currentStep + 2);
  } else if (currentStep < steps.length - 1) {
    setCurrentStep(currentStep + 1);
  } else {
    handleComplete();
  }
};
```

---

## Persisting Progress

### Code Example

```typescript
// Save progress to localStorage
const saveProgress = () => {
  const progress = {
    currentStep,
    completedSteps,
    formData: {
      selectedPersona,
      // other collected data
    },
    timestamp: new Date().toISOString()
  };
  
  localStorage.setItem('onboarding_progress', JSON.stringify(progress));
};

// Restore progress on mount
useEffect(() => {
  const saved = localStorage.getItem('onboarding_progress');
  if (saved) {
    const progress = JSON.parse(saved);
    setCurrentStep(progress.currentStep);
    setCompletedSteps(progress.completedSteps);
    setSelectedPersona(progress.formData.selectedPersona);
  }
}, []);

// Auto-save on step change
useEffect(() => {
  saveProgress();
}, [currentStep, completedSteps]);
```

---

## Animated Transitions

### Code Example

```tsx
import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence mode="wait">
  <motion.div
    key={currentStep}
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.3 }}
  >
    <CurrentStepComponent 
      onNext={handleStepComplete}
      data={formData}
    />
  </motion.div>
</AnimatePresence>
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Losing data when going back
const handleBack = () => {
  setCurrentStep(currentStep - 1);
  // Data from current step is lost!
};

// No progress indication
<div>
  <CurrentStepComponent />
  {/* User has no idea how many steps remain */}
</div>

// Allowing invalid progression
<button onClick={() => setCurrentStep(currentStep + 1)}>
  Next
  {/* No validation - user can skip required fields */}
</button>

// Not persisting progress
// User loses all data if they close the browser
```

### ✅ Do This Instead

```typescript
// Preserve data when navigating
const handleBack = () => {
  saveCurrentStepData(); // Save before moving
  setCurrentStep(currentStep - 1);
};

// Clear progress indication
<div className="flex gap-2">
  {steps.map((step, index) => (
    <div className={`flex-1 h-1 ${
      index <= currentStep ? 'bg-primary' : 'bg-gray-200'
    }`} />
  ))}
</div>
<p className="text-sm text-gray-600">
  Step {currentStep + 1} of {steps.length}
</p>

// Validate before allowing progression
<button 
  onClick={handleNext}
  disabled={!isCurrentStepValid()}
>
  Next
</button>

// Auto-save progress
useEffect(() => {
  localStorage.setItem('progress', JSON.stringify(formData));
}, [formData]);
```

---

## When to Use This Pattern

✅ **Use for:**
- Complex forms with 5+ fields
- User onboarding flows
- Multi-stage applications (job applications, loan applications)
- Checkout processes
- Account setup wizards
- Survey forms
- Configuration wizards

❌ **Don't use for:**
- Simple 2-3 field forms (over-engineering)
- Forms where users need to see all fields at once
- Forms where steps don't have logical grouping
- Real-time collaborative forms

---

## Benefits

1. **Reduced Cognitive Load** - Users focus on one section at a time
2. **Better Completion Rates** - Progress indication motivates completion
3. **Improved Validation** - Validate each step before proceeding
4. **Mobile Friendly** - Less scrolling on small screens
5. **Progress Tracking** - Users can see how far they've come
6. **Conditional Logic** - Show/hide steps based on previous answers
7. **Save Progress** - Users can return later to complete
8. **Better UX** - Less overwhelming than one long form

---

## Related Patterns

- See `form-validation.md` for step validation
- See `form-submission.md` for final submission handling
- See `../04-ui-components/loading-states.md` for step transition loading
- See `../02-react-patterns/state-management.md` for complex form state
- See `../13-state-management/local-state.md` for step-level state management

---

*Extracted: 2026-02-18*
