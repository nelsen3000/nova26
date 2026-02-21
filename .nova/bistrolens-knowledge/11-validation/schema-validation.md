# Schema Validation with Zod

## Source
Extracted from BistroLens:
- `src/llm/structured-output.ts` (comprehensive agent schemas)
- `.nova/reference-components/FormWithValidation.reference.tsx` (form validation)
- `src/templates/template-engine.ts` (API validation)

---

## Pattern: Type-Safe Schema Validation with Zod

Zod provides runtime type validation with automatic TypeScript type inference. Use Zod schemas to validate user input, API requests, LLM outputs, and any data crossing boundaries in your application.

---

## Basic Schema Definition

### Code Example

```typescript
import { z } from 'zod';

// Simple object schema
const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  age: z.number().min(18, 'Must be 18 or older').optional(),
});

// Infer TypeScript type from schema
type User = z.infer<typeof userSchema>;

// Validate data
const result = userSchema.safeParse({
  name: 'John Doe',
  email: 'john@example.com',
});

if (result.success) {
  const user: User = result.data;
  console.log('Valid user:', user);
} else {
  console.error('Validation errors:', result.error.errors);
}
```

---

## Form Validation with React Hook Form

### Code Example

```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

// Define form schema
const formSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(50),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().regex(/^\+?[\d\s-()]+$/, 'Please enter a valid phone number').optional(),
  company: z.string().min(2, 'Company name must be at least 2 characters').max(100),
  role: z.enum(['developer', 'designer', 'manager', 'other']),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  newsletter: z.boolean().default(false),
});

type FormData = z.infer<typeof formSchema>;

// Use in component
function ProfileForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      role: 'developer',
      newsletter: false,
    },
    mode: 'onBlur', // Validate on blur
  });

  const onSubmit = async (data: FormData) => {
    // Data is guaranteed to be valid here
    console.log('Valid form data:', data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  );
}
```

---

## API Request Validation

### Code Example

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Define API request schema
const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest']).default('user'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate request body
    const result = createUserSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: result.error.errors 
        },
        { status: 400 }
      );
    }
    
    // Use validated data
    const userData = result.data;
    
    // Create user...
    return NextResponse.json({ user: userData }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400 }
    );
  }
}
```

---

## Complex Nested Schemas

### Code Example

```typescript
import { z } from 'zod';

// Nested object schema with arrays
const projectSchema = z.object({
  meta: z.object({
    name: z.string().describe('Project name'),
    version: z.string().describe('Version string e.g. "1.0.0"'),
    createdAt: z.string().describe('ISO 8601 timestamp'),
  }),
  tasks: z.array(z.object({
    id: z.string().describe('Unique task ID'),
    title: z.string().describe('Human-readable task title'),
    description: z.string().describe('Detailed instructions'),
    status: z.enum(['pending', 'ready', 'running', 'done', 'failed', 'blocked']),
    dependencies: z.array(z.string()).describe('Task IDs this task depends on'),
    phase: z.number().int().min(0).describe('Execution phase'),
    attempts: z.number().int().min(0).default(0),
  })).min(1).describe('All tasks in the project'),
});

type Project = z.infer<typeof projectSchema>;
```

---

## Validation with Enums and Unions

### Code Example

```typescript
import { z } from 'zod';

// Enum validation
const statusSchema = z.enum(['PASS', 'FAIL', 'WARNING']);

// Union types
const resultSchema = z.union([
  z.object({ success: true, data: z.any() }),
  z.object({ success: false, error: z.string() }),
]);

// Discriminated unions
const shapeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('circle'), radius: z.number() }),
  z.object({ type: z.literal('rectangle'), width: z.number(), height: z.number() }),
  z.object({ type: z.literal('triangle'), base: z.number(), height: z.number() }),
]);

// Literal values
const roleSchema = z.union(
  z.literal('admin'),
  z.literal('member'),
  z.literal('guest')
);
```

---

## Advanced Validation Patterns

### Code Example

```typescript
import { z } from 'zod';

// Custom refinements
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .refine(
    (val) => /[A-Z]/.test(val),
    'Password must contain at least one uppercase letter'
  )
  .refine(
    (val) => /[0-9]/.test(val),
    'Password must contain at least one number'
  );

// Conditional validation
const addressSchema = z.object({
  country: z.string(),
  zipCode: z.string(),
}).refine(
  (data) => {
    if (data.country === 'US') {
      return /^\d{5}(-\d{4})?$/.test(data.zipCode);
    }
    return true;
  },
  { message: 'Invalid US zip code', path: ['zipCode'] }
);

// Transform data during validation
const dateSchema = z.string().transform((str) => new Date(str));

const trimmedStringSchema = z.string().transform((val) => val.trim());

// Preprocess before validation
const numberFromString = z.preprocess(
  (val) => Number(val),
  z.number().min(0)
);
```

---

## LLM Output Validation

### Code Example

```typescript
import { z } from 'zod';

// Schema for structured LLM output
const llmResponseSchema = z.object({
  title: z.string().describe('Response title'),
  status: z.enum(['proposed', 'accepted', 'deprecated']).describe('Status'),
  context: z.string().describe('Problem context and background'),
  decision: z.string().describe('The decision made'),
  consequences: z.object({
    positive: z.array(z.string()).describe('Positive consequences'),
    negative: z.array(z.string()).describe('Negative consequences'),
    tradeoffs: z.array(z.string()).describe('Trade-offs considered'),
  }).describe('Consequences of the decision'),
  alternatives: z.array(z.string()).describe('Alternatives considered'),
  relatedItems: z.array(z.string()).optional().describe('Related items'),
});

type LLMResponse = z.infer<typeof llmResponseSchema>;

// Validate LLM output
async function validateLLMOutput(rawOutput: string): Promise<LLMResponse> {
  try {
    const parsed = JSON.parse(rawOutput);
    const result = llmResponseSchema.safeParse(parsed);
    
    if (!result.success) {
      console.warn('LLM output validation failed:', result.error.errors);
      throw new Error('Invalid LLM output structure');
    }
    
    return result.data;
  } catch (error) {
    throw new Error('Failed to parse LLM output');
  }
}
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// DON'T: Use 'any' type - defeats the purpose of validation
const badSchema = z.object({
  data: z.any(), // No validation!
});

// DON'T: Ignore validation errors
const result = schema.safeParse(data);
const user = result.data; // Could be undefined if validation failed!

// DON'T: Use parse() without error handling
try {
  const user = schema.parse(data); // Throws on error
} catch {
  // Silently swallow errors
}

// DON'T: Duplicate validation logic
function validateEmail(email: string) {
  // Custom validation logic
  if (!email.includes('@')) return false;
  // ... more checks
}
// Then also define a Zod schema with same rules

// DON'T: Make everything optional without reason
const badFormSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  // Everything optional = no validation!
});
```

### ✅ Do This Instead

```typescript
// DO: Use specific types
const goodSchema = z.object({
  data: z.array(z.string()), // Specific validation
});

// DO: Check validation results
const result = schema.safeParse(data);
if (result.success) {
  const user = result.data; // Safe to use
} else {
  console.error('Validation errors:', result.error.errors);
  return; // Handle error appropriately
}

// DO: Use safeParse for better error handling
const result = schema.safeParse(data);
if (!result.success) {
  return NextResponse.json(
    { error: 'Validation failed', details: result.error.errors },
    { status: 400 }
  );
}

// DO: Define schema once, use everywhere
const emailSchema = z.string().email();

// Use in multiple places
const userSchema = z.object({ email: emailSchema });
const loginSchema = z.object({ email: emailSchema });

// DO: Mark only truly optional fields as optional
const goodFormSchema = z.object({
  name: z.string().min(1), // Required
  email: z.string().email(), // Required
  phone: z.string().optional(), // Truly optional
});
```

---

## When to Use This Pattern

✅ **Use for:**
- Form validation with React Hook Form
- API request/response validation
- Validating external data (user input, API responses, file uploads)
- LLM output validation for structured responses
- Configuration file validation
- Database query parameter validation
- Type-safe environment variable validation
- Data transformation pipelines

❌ **Don't use for:**
- Internal function parameters (use TypeScript types)
- Simple type checks (use TypeScript's built-in type guards)
- Performance-critical hot paths (validation has overhead)
- Data you fully control and trust

---

## Benefits

1. **Type Safety**: Automatic TypeScript type inference from schemas
2. **Runtime Validation**: Catch invalid data at runtime, not just compile time
3. **Clear Error Messages**: Descriptive validation errors for users
4. **Single Source of Truth**: Schema defines both validation and types
5. **Composability**: Build complex schemas from simple ones
6. **Transformation**: Transform data during validation
7. **Framework Integration**: Works with React Hook Form, tRPC, Next.js
8. **Developer Experience**: Excellent autocomplete and type checking

---

## Related Patterns

- See `convex-validators.md` for Convex-specific validation patterns
- See `client-validation.md` for client-side validation strategies
- See `../05-form-patterns/form-validation.md` for complete form validation examples
- See `business-rules.md` for business logic validation

---

*Extracted: 2026-02-18*
