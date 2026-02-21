# Form Validation Patterns

## Source
Extracted from BistroLens:
- `components/AffiliateSignup.tsx` (client-side validation)
- `components/SettingsModal.tsx` (form state management)
- `convex/auth.ts` (server-side validation)
- `convex/schema.ts` (schema-level validation)

---

## Pattern: Multi-Layer Form Validation

BistroLens implements a comprehensive validation strategy across three layers: client-side, type-safe schema, and server-side validation.

---

## Layer 1: Client-Side Validation

### Basic HTML5 Validation

```tsx
// Simple required field validation
<input 
  required 
  name="full_name" 
  type="text" 
  onChange={handleInputChange} 
  className="w-full p-3 bg-brand-white rounded-xl border border-brand-black/20 focus:border-brand-primary outline-none text-brand-black" 
  placeholder="Jane Doe"
/>

// Email validation with type
<input 
  required 
  name="email" 
  type="email" 
  onChange={handleInputChange} 
  className="w-full p-3 bg-brand-white rounded-xl border border-brand-black/20 focus:border-brand-primary outline-none text-brand-black" 
  placeholder="jane@example.com"
/>

// Number validation
<input 
  name="instagram_followers" 
  type="number" 
  onChange={handleInputChange} 
  className="w-full p-3 bg-brand-white rounded-xl border border-brand-black/20 focus:border-brand-primary outline-none text-brand-black" 
  placeholder="0"
/>
```

### Manual Pre-Submit Validation

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  playClickSound();
  setIsSubmitting(true);
  
  // Manual validation before API call
  if (!formData.full_name || !formData.email || !formData.paypal_email || !formData.audience_description) {
    setSubmitResult({ 
      success: false, 
      message: "Please fill in all required fields." 
    });
    setIsSubmitting(false);
    return;
  }

  const result = await submitAffiliateApplication(formData as AffiliateApplication);
  setSubmitResult(result);
  if (result.success) playSuccessSound();
  setIsSubmitting(false);
};
```

### Checkbox Validation

```tsx
// Required checkbox with visual feedback
<label className="flex items-center gap-3 cursor-pointer select-none">
  <input 
    required 
    name="agree_terms" 
    type="checkbox" 
    onChange={handleInputChange} 
    className="w-5 h-5 text-brand-primary rounded border-gray-300 focus:ring-brand-primary bg-brand-white"
  />
  <span className="text-sm text-brand-black/60">
    I agree to the <button type="button" onClick={() => setShowTerms(true)} className="underline hover:text-brand-primary font-bold">Terms & Conditions</button>
  </span>
</label>
```

---

## Layer 2: TypeScript Type Safety

### Form Data Types

```tsx
import { AffiliateApplication } from '../types';

const [formData, setFormData] = useState<Partial<AffiliateApplication>>({
  content_type: 'recipes',
  country: 'United States',
  agree_terms: false,
  agree_ftc_compliance: false
});

// Type-safe input handler
const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  const { name, value, type } = e.target;
  const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
  setFormData(prev => ({ ...prev, [name]: val }));
};
```

### Settings Form with Complex Types

```tsx
interface HealthGoals {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  water?: number;
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';
  primaryGoal?: 'lose_fat' | 'maintain' | 'build_muscle' | 'endurance';
}

// Type-safe update handler
const handleHealthGoalChange = (field: keyof HealthGoals, value: string | number) => {
  const numValue = typeof value === 'string' ? (value ? parseInt(value, 10) : undefined) : value;
  setSettings(s => ({ 
    ...s, 
    profile: { 
      ...s.profile, 
      healthGoals: { 
        ...s.profile.healthGoals, 
        [field]: isNaN(numValue as number) ? undefined : numValue 
      } 
    } 
  }));
};
```

---

## Layer 3: Convex Schema Validation

### Schema-Level Type Enforcement

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  profiles: defineTable({
    userId: v.string(),
    email: v.string(),
    fullName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    settings: v.object({
      fontSize: v.union(v.literal("sm"), v.literal("base"), v.literal("lg")),
      mode: v.union(v.literal("food"), v.literal("drinks")),
      theme: v.union(v.literal("light"), v.literal("dark"), v.literal("auto")),
      drinkPreference: v.union(v.literal("Alcoholic"), v.literal("Non-Alcoholic"), v.literal("Both")),
      profile: v.object({
        name: v.string(),
        zipCode: v.optional(v.string()),
        dietaryPreferences: v.array(v.string()),
        allergies: v.array(v.string()),
        healthGoals: v.optional(v.object({
          calories: v.optional(v.number()),
          protein: v.optional(v.number()),
          carbs: v.optional(v.number()),
          fat: v.optional(v.number()),
          activityLevel: v.optional(v.union(
            v.literal("sedentary"), 
            v.literal("light"), 
            v.literal("moderate"), 
            v.literal("active"), 
            v.literal("athlete")
          )),
          primaryGoal: v.optional(v.union(
            v.literal("lose_fat"), 
            v.literal("maintain"), 
            v.literal("build_muscle"), 
            v.literal("endurance")
          ))
        })),
        kitchenEquipment: v.optional(v.array(v.string()))
      }),
      defaultServings: v.number(),
      measurementSystem: v.union(v.literal("Metric"), v.literal("Imperial")),
      country: v.string(),
      language: v.optional(v.string())
    }),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["email"])
});
```

### Mutation-Level Validation

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const upsertProfile = mutation({
  args: {
    userId: v.string(),
    email: v.string(),
    fullName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    settings: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    const now = Date.now();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        fullName: args.fullName,
        avatarUrl: args.avatarUrl,
        settings: args.settings || existing.settings,
        updatedAt: now
      });
      return existing._id;
    } else {
      // Create with validated defaults
      const defaultSettings = {
        fontSize: "base" as const,
        mode: "food" as const,
        theme: "light" as const,
        // ... more defaults
      };

      return await ctx.db.insert("profiles", {
        userId: args.userId,
        email: args.email,
        fullName: args.fullName,
        avatarUrl: args.avatarUrl,
        settings: args.settings || defaultSettings,
        createdAt: now,
        updatedAt: now
      });
    }
  },
});

// Validation with error throwing
export const updateSettings = mutation({
  args: {
    userId: v.string(),
    settings: v.any()
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!profile) {
      throw new Error("Profile not found");
    }

    await ctx.db.patch(profile._id, {
      settings: args.settings,
      updatedAt: Date.now()
    });

    return profile._id;
  },
});
```

---

## Pattern: Form State Management

### Controlled Inputs with Local State

```tsx
// Local state for immediate feedback
const [localName, setLocalName] = useState(context?.settings.profile.name || '');
const [localHandle, setLocalHandle] = useState(socialUser.handle || '');
const [localCountry, setLocalCountry] = useState(context?.settings.country || '');
const [localZip, setLocalZip] = useState(context?.settings.profile.zipCode || '');

// Update on blur to avoid excessive updates
<input 
  type="text" 
  value={localName} 
  onChange={(e) => setLocalName(e.target.value)} 
  onBlur={() => handleProfileChange('name', localName)} 
  className="w-full bg-brand-white border border-brand-black/20 rounded-full px-3 py-3 text-base font-medium outline-none focus:border-brand-primary" 
/>
```

### Submission State Management

```tsx
const [isSubmitting, setIsSubmitting] = useState(false);
const [submitResult, setSubmitResult] = useState<{success: boolean, message: string} | null>(null);

// Disable button during submission
<button 
  disabled={isSubmitting} 
  type="submit" 
  className="w-full py-4 bg-brand-primary text-brand-on-primary rounded-full font-bold shadow-lg hover:bg-brand-primary-hover disabled:opacity-50 transition-all flex items-center justify-center gap-2"
>
  {isSubmitting ? "Submitting..." : "Submit Application"}
</button>

// Show result after submission
{submitResult && (
  <div className={`p-6 rounded-2xl text-center border ${submitResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
    <div className="text-4xl mb-4">{submitResult.success ? '🎉' : '⚠️'}</div>
    <h3 className="text-xl font-bold mb-2">{submitResult.success ? "Application Received!" : "Error"}</h3>
    <p>{submitResult.message}</p>
  </div>
)}
```

---

## Pattern: Visual Validation Feedback

### Focus States

```tsx
// Border color changes on focus
className="w-full p-3 bg-brand-white rounded-xl border border-brand-black/20 focus:border-brand-primary outline-none text-brand-black"
```

### Error Display

```tsx
const [authError, setAuthError] = useState('');

// Display error message
{authError && (
  <p className="text-[10px] text-red-500 text-center bg-red-50 p-1 rounded">
    {authError}
  </p>
)}
```

### Success Feedback with Sound

```tsx
import { playClickSound, playSuccessSound } from '../utils/sound';

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  playClickSound(); // Immediate feedback
  
  const result = await submitAffiliateApplication(formData);
  setSubmitResult(result);
  
  if (result.success) playSuccessSound(); // Success audio feedback
};
```

---

## Pattern: Segmented Controls (Alternative to Dropdowns)

```tsx
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
    {label && <label className="block text-[10px] font-semibold text-brand-black/60 uppercase tracking-wide mb-1 pl-1">{label}</label>}
    <div className="flex flex-wrap gap-1 bg-brand-white/50 p-1 rounded-xl">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => { playClickSound(); onChange(opt.value); }}
          className={`flex-1 px-4 py-3 rounded-lg text-sm font-semibold uppercase tracking-wide transition-all shadow-sm whitespace-nowrap min-h-[44px] ${
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
  label="Measurement System"
  options={[
    { label: 'Metric', value: 'Metric' },
    { label: 'Imperial', value: 'Imperial' }
  ]}
  value={settings.measurementSystem}
  onChange={(val) => setSettings(s => ({ ...s, measurementSystem: val }))}
/>
```

---

## Anti-Patterns

### ❌ Don't: Validate Only on Submit

```tsx
// BAD: No feedback until form submission
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // User only finds out about errors after clicking submit
  if (!email || !password) {
    setError("Missing fields");
    return;
  }
  
  await submitForm();
};
```

### ✅ Do: Use HTML5 Validation + Manual Checks

```tsx
// GOOD: HTML5 validation provides immediate feedback
<input 
  required 
  type="email" 
  name="email"
  // Browser validates on blur/submit
/>

// Plus manual validation for complex rules
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!formData.full_name || !formData.email) {
    setSubmitResult({ success: false, message: "Please fill in all required fields." });
    return;
  }
  
  await submitForm();
};
```

### ❌ Don't: Use Untyped Form Data

```tsx
// BAD: No type safety
const [formData, setFormData] = useState<any>({});

const handleChange = (e: any) => {
  setFormData({ ...formData, [e.target.name]: e.target.value });
};
```

### ✅ Do: Use TypeScript Types

```tsx
// GOOD: Type-safe form data
interface FormData {
  full_name: string;
  email: string;
  paypal_email: string;
  agree_terms: boolean;
}

const [formData, setFormData] = useState<Partial<FormData>>({
  agree_terms: false
});

const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value, type } = e.target;
  const val = type === 'checkbox' ? e.checked : value;
  setFormData(prev => ({ ...prev, [name]: val }));
};
```

### ❌ Don't: Skip Server-Side Validation

```tsx
// BAD: Trust client data blindly
export const saveProfile = mutation({
  args: { data: v.any() },
  handler: async (ctx, args) => {
    // Directly insert without validation
    return await ctx.db.insert("profiles", args.data);
  },
});
```

### ✅ Do: Validate on Server with Schema

```tsx
// GOOD: Schema enforces validation
export const saveProfile = mutation({
  args: {
    userId: v.string(),
    email: v.string(),
    fullName: v.optional(v.string()),
    settings: v.object({
      fontSize: v.union(v.literal("sm"), v.literal("base"), v.literal("lg")),
      // ... strict schema
    })
  },
  handler: async (ctx, args) => {
    // Convex validates args against schema automatically
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!profile) {
      throw new Error("Profile not found");
    }

    return await ctx.db.patch(profile._id, {
      email: args.email,
      fullName: args.fullName,
      settings: args.settings,
      updatedAt: Date.now()
    });
  },
});
```

---

## When to Use This Pattern

✅ **Use for:**
- User registration and profile forms
- Settings and preferences forms
- Multi-step forms with complex data
- Forms with file uploads
- Forms requiring real-time validation feedback
- Forms with conditional fields
- Forms that need offline support

❌ **Don't use for:**
- Simple search inputs (use debounced onChange)
- Single-field forms (HTML5 validation may suffice)
- Read-only data display

---

## Benefits

1. **Defense in Depth**: Three validation layers catch errors at different stages
2. **Type Safety**: TypeScript prevents runtime type errors
3. **Immediate Feedback**: HTML5 validation provides instant user feedback
4. **Server Authority**: Final validation on server prevents malicious data
5. **Better UX**: Visual feedback and sound effects improve user experience
6. **Maintainability**: Schema-driven validation is self-documenting
7. **Accessibility**: HTML5 validation works with screen readers
8. **Performance**: Client validation reduces unnecessary API calls

---

## Related Patterns

- See `form-submission.md` for handling form submission with mutations
- See `../11-validation/convex-validators.md` for Convex validator patterns
- See `../11-validation/client-validation.md` for advanced client validation
- See `../04-ui-components/form-components.md` for reusable form components
- See `../07-error-handling/error-messages.md` for user-friendly error display

---

*Extracted: 2026-02-18*
