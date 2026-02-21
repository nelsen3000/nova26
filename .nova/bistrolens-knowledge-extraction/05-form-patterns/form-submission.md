# Form Submission Patterns

## Source
Extracted from BistroLens:
- `components/AffiliateSignup.tsx`
- `components/SignupPage.tsx`
- `components/SettingsModal.tsx`
- `.nova/reference-components/FormWithValidation.reference.tsx`

---

## Pattern: Form Submission with Validation and Error Handling

Form submission in React requires careful orchestration of validation, loading states, error handling, and success feedback. This pattern demonstrates robust form submission using both controlled forms and React Hook Form with Convex mutations.

---

## Basic Form Submission Pattern

### Code Example

```typescript
import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

interface FormData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export function BasicFormSubmission() {
  // State management
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    firstName: '',
    lastName: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Convex mutation
  const createUser = useMutation(api.users.create);

  // Input change handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      // Client-side validation
      if (!formData.email || !formData.password) {
        throw new Error('Email and password are required');
      }

      if (formData.password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      // Submit to backend
      await createUser({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName
      });

      setSuccess(true);
      
      // Reset form on success
      setFormData({
        email: '',
        password: '',
        firstName: '',
        lastName: ''
      });

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          Account created successfully!
        </div>
      )}

      {/* Form fields */}
      <div>
        <label className="block text-sm font-semibold mb-2">Email</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleInputChange}
          className="w-full px-4 py-2 border rounded-lg"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2">Password</label>
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleInputChange}
          className="w-full px-4 py-2 border rounded-lg"
          required
        />
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 bg-primary text-white rounded-lg font-bold disabled:opacity-50"
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
```

---

## Advanced Pattern: React Hook Form with Zod Validation

### Code Example

```typescript
import { useState, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Zod schema for validation
const formSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  company: z.string().min(2, 'Company name is required'),
  role: z.enum(['developer', 'designer', 'manager', 'other']),
});

type FormData = z.infer<typeof formSchema>;

interface AdvancedFormProps {
  userId?: string;
  onSuccess?: (data: FormData) => void;
}

export function AdvancedFormSubmission({ userId, onSuccess }: AdvancedFormProps) {
  // Convex mutation
  const updateProfile = useMutation(api.users.updateProfile);

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Form setup with React Hook Form
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      company: '',
      role: 'developer',
    },
    mode: 'onBlur', // Validate on blur
  });

  // Submission handler
  const onSubmit = useCallback(
    async (data: FormData) => {
      setIsSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(false);

      try {
        await updateProfile({
          userId,
          ...data,
        });

        setSubmitSuccess(true);
        form.reset(data); // Reset dirty state but keep values
        onSuccess?.(data);

        // Clear success message after 3 seconds
        setTimeout(() => setSubmitSuccess(false), 3000);
      } catch (error) {
        setSubmitError(
          error instanceof Error ? error.message : 'Failed to update profile'
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [updateProfile, userId, onSuccess, form]
  );

  const isDirty = form.formState.isDirty;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Success Message with Animation */}
        <AnimatePresence>
          {submitSuccess && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Your profile has been updated successfully.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message with Animation */}
        <AnimatePresence>
          {submitError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form Fields */}
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>
                  First Name <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="John"
                    {...field}
                    aria-invalid={fieldState.invalid}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>
                  Last Name <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Doe"
                    {...field}
                    aria-invalid={fieldState.invalid}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>
                Email <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="john@example.com"
                  {...field}
                  aria-invalid={fieldState.invalid}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit Button */}
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
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

---

## Pattern: Form Submission with Optimistic Updates

### Code Example

```typescript
import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

interface Recipe {
  _id: string;
  title: string;
  isSaved: boolean;
}

export function OptimisticFormSubmission({ recipe }: { recipe: Recipe }) {
  const [localSaved, setLocalSaved] = useState(recipe.isSaved);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const saveRecipe = useMutation(api.recipes.save);
  const unsaveRecipe = useMutation(api.recipes.unsave);

  const handleToggleSave = async () => {
    // Optimistic update
    const previousState = localSaved;
    setLocalSaved(!localSaved);
    setIsSubmitting(true);

    try {
      if (localSaved) {
        await unsaveRecipe({ recipeId: recipe._id });
      } else {
        await saveRecipe({ recipeId: recipe._id });
      }
    } catch (error) {
      // Rollback on error
      setLocalSaved(previousState);
      console.error('Failed to save recipe:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <button
      onClick={handleToggleSave}
      disabled={isSubmitting}
      className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50"
    >
      {localSaved ? 'Unsave' : 'Save'}
    </button>
  );
}
```

---

## Pattern: Multi-Step Form Submission

### Code Example

```typescript
import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

interface StepData {
  step1: { email: string; password: string };
  step2: { firstName: string; lastName: string };
  step3: { company: string; role: string };
}

export function MultiStepFormSubmission() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<StepData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAccount = useMutation(api.users.createAccount);

  const handleStepSubmit = (stepData: any) => {
    setFormData(prev => ({ ...prev, [`step${currentStep}`]: stepData }));
    
    if (currentStep < 3) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleFinalSubmit({ ...formData, step3: stepData });
    }
  };

  const handleFinalSubmit = async (allData: Partial<StepData>) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await createAccount({
        email: allData.step1?.email || '',
        password: allData.step1?.password || '',
        firstName: allData.step2?.firstName || '',
        lastName: allData.step2?.lastName || '',
        company: allData.step3?.company || '',
        role: allData.step3?.role || '',
      });

      // Success - redirect or show success message
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex gap-2">
        {[1, 2, 3].map(step => (
          <div
            key={step}
            className={`flex-1 h-2 rounded-full ${
              step <= currentStep ? 'bg-primary' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Step content */}
      {currentStep === 1 && <Step1Form onSubmit={handleStepSubmit} />}
      {currentStep === 2 && <Step2Form onSubmit={handleStepSubmit} />}
      {currentStep === 3 && <Step3Form onSubmit={handleStepSubmit} isSubmitting={isSubmitting} />}

      {/* Error display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Back button */}
      {currentStep > 1 && (
        <button
          onClick={() => setCurrentStep(prev => prev - 1)}
          className="text-primary hover:underline"
        >
          Back
        </button>
      )}
    </div>
  );
}
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// BAD: No loading state
function BadFormSubmission() {
  const createUser = useMutation(api.users.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createUser({ email: 'test@example.com' });
    // User has no feedback that submission is in progress
  };

  return <form onSubmit={handleSubmit}>...</form>;
}

// BAD: No error handling
function BadErrorHandling() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createUser = useMutation(api.users.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await createUser({ email: 'test@example.com' });
    // If this fails, user never knows
    setIsSubmitting(false);
  };

  return <form onSubmit={handleSubmit}>...</form>;
}

// BAD: No client-side validation
function BadValidation() {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Submitting without checking if fields are valid
    await createUser({ email: '', password: '' });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}

// BAD: Not preventing default form behavior
function BadFormBehavior() {
  const handleSubmit = async () => {
    // Missing e.preventDefault() - form will cause page reload
    await createUser({ email: 'test@example.com' });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}

// BAD: Not resetting form after success
function BadFormReset() {
  const [email, setEmail] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createUser({ email });
    // Form still shows old data after successful submission
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### ✅ Do This Instead

```typescript
// GOOD: Complete submission handling
function GoodFormSubmission() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const createUser = useMutation(api.users.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent page reload
    
    // Client-side validation
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      await createUser({ email });
      setSuccess(true);
      setEmail(''); // Reset form
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="text-red-600">{error}</div>}
      {success && <div className="text-green-600">Success!</div>}
      
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isSubmitting}
      />
      
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
```

---

## When to Use This Pattern

✅ **Use for:**
- User registration and login forms
- Profile update forms
- Data creation forms (recipes, posts, etc.)
- Settings and preferences forms
- Multi-step wizards
- Forms with complex validation requirements
- Forms that need optimistic updates

❌ **Don't use for:**
- Simple search inputs (use debounced onChange instead)
- Single-field updates (consider inline editing)
- Read-only data display

---

## Benefits

1. **User Feedback**: Clear loading, error, and success states
2. **Error Recovery**: Users can retry failed submissions
3. **Validation**: Catch errors before sending to server
4. **Accessibility**: Proper ARIA attributes and error messages
5. **Type Safety**: TypeScript ensures correct data structure
6. **Optimistic Updates**: Immediate UI feedback for better UX
7. **Form State Management**: React Hook Form handles complex validation
8. **Reusability**: Patterns can be extracted into custom hooks

---

## Related Patterns

- See `form-validation.md` for validation strategies
- See `usemutation-patterns.md` for Convex mutation patterns
- See `error-handling.md` for error display patterns
- See `loading-states.md` for loading UI patterns
- See `multi-step-forms.md` for wizard patterns

---

*Extracted: 2026-02-18*
