# Dynamic Form Fields Patterns

## Source
Extracted from BistroLens `components/FusionRecipeGenerator.tsx`

---

## Pattern: Add/Remove Dynamic Form Fields

Dynamic form fields allow users to add or remove input fields at runtime, commonly used for lists of items, multiple entries, or flexible forms.

---

## Basic Dynamic Field State

### Code Example

```typescript
import { useState } from 'react';

interface InputState {
  id: string;
  value: string;
  locked: boolean;
}

const DynamicFieldsForm: React.FC = () => {
  const [inputs, setInputs] = useState<InputState[]>([
    { id: Date.now().toString(), value: '', locked: false },
    { id: (Date.now() + 1).toString(), value: '', locked: false }
  ]);

  const handleAddInput = () => {
    if (inputs.length < 10) { // Max limit
      playClickSound();
      setInputs([
        ...inputs, 
        { 
          id: Date.now().toString(), 
          value: '', 
          locked: false 
        }
      ]);
    }
  };

  const handleRemoveInput = (id: string) => {
    if (inputs.length > 1) { // Min limit
      playClickSound();
      setInputs(inputs.filter(i => i.id !== id));
    }
  };

  const handleInputChange = (id: string, value: string) => {
    setInputs(inputs.map(i => 
      i.id === id ? { ...i, value } : i
    ));
  };

  return (
    <div>
      {inputs.map((input) => (
        <div key={input.id} className="flex gap-2 mb-2">
          <input
            type="text"
            value={input.value}
            onChange={(e) => handleInputChange(input.id, e.target.value)}
            className="flex-1 px-4 py-2 border rounded"
          />
          <button
            onClick={() => handleRemoveInput(input.id)}
            disabled={inputs.length <= 1}
            className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ))}
      
      <button
        onClick={handleAddInput}
        disabled={inputs.length >= 10}
        className="mt-2 px-4 py-2 bg-brand-primary text-white rounded disabled:opacity-50"
      >
        Add Field
      </button>
    </div>
  );
};
```

---

## Dynamic Fields with Unique IDs

### Code Example

```typescript
// Generate unique IDs for each field
const generateId = () => `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Or use a counter
let fieldCounter = 0;
const generateId = () => `field_${++fieldCounter}`;

// Or use UUID library
import { v4 as uuidv4 } from 'uuid';
const generateId = () => uuidv4();

// Usage
const handleAddInput = () => {
  setInputs([
    ...inputs,
    {
      id: generateId(),
      value: '',
      locked: false
    }
  ]);
};
```

---

## Dynamic Fields with Validation

### Code Example

```typescript
interface FieldState {
  id: string;
  value: string;
  error: string | null;
}

const [fields, setFields] = useState<FieldState[]>([
  { id: '1', value: '', error: null }
]);

const validateField = (value: string): string | null => {
  if (!value.trim()) {
    return 'This field is required';
  }
  if (value.length < 3) {
    return 'Must be at least 3 characters';
  }
  return null;
};

const handleFieldChange = (id: string, value: string) => {
  setFields(fields.map(field =>
    field.id === id
      ? { ...field, value, error: validateField(value) }
      : field
  ));
};

const handleSubmit = () => {
  // Validate all fields
  const validatedFields = fields.map(field => ({
    ...field,
    error: validateField(field.value)
  }));
  
  setFields(validatedFields);
  
  // Check if any errors
  const hasErrors = validatedFields.some(field => field.error !== null);
  if (hasErrors) {
    return;
  }
  
  // Submit form
  submitForm(fields.map(f => f.value));
};

// Render with error messages
{fields.map((field) => (
  <div key={field.id} className="mb-4">
    <input
      value={field.value}
      onChange={(e) => handleFieldChange(field.id, e.target.value)}
      className={`px-4 py-2 border rounded ${
        field.error ? 'border-red-500' : 'border-gray-300'
      }`}
    />
    {field.error && (
      <p className="text-red-500 text-sm mt-1">{field.error}</p>
    )}
  </div>
))}
```

---

## Lockable Dynamic Fields

### Code Example

```typescript
interface LockableField {
  id: string;
  value: string;
  locked: boolean;
}

const [fields, setFields] = useState<LockableField[]>([
  { id: '1', value: 'Preset Value', locked: true },
  { id: '2', value: '', locked: false }
]);

const handleToggleLock = (id: string) => {
  playClickSound();
  setFields(fields.map(field =>
    field.id === id
      ? { ...field, locked: !field.locked }
      : field
  ));
};

// Render with lock button
{fields.map((field) => (
  <div key={field.id} className="flex gap-2 mb-2">
    <input
      value={field.value}
      onChange={(e) => handleFieldChange(field.id, e.target.value)}
      disabled={field.locked}
      className={`flex-1 px-4 py-2 border rounded ${
        field.locked ? 'bg-gray-100 cursor-not-allowed' : ''
      }`}
    />
    <button
      onClick={() => handleToggleLock(field.id)}
      className="px-3 py-2 border rounded"
    >
      {field.locked ? <LockIcon /> : <UnlockIcon />}
    </button>
    <button
      onClick={() => handleRemoveField(field.id)}
      disabled={field.locked}
      className="px-3 py-2 bg-red-500 text-white rounded disabled:opacity-50"
    >
      Remove
    </button>
  </div>
))}
```

---

## Animated Dynamic Fields

### Code Example

```tsx
import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence>
  {fields.map((field, index) => (
    <motion.div
      key={field.id}
      initial={{ opacity: 0, height: 0, y: -10 }}
      animate={{ opacity: 1, height: 'auto', y: 0 }}
      exit={{ opacity: 0, height: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="mb-2"
    >
      <div className="flex gap-2">
        <input
          value={field.value}
          onChange={(e) => handleFieldChange(field.id, e.target.value)}
          className="flex-1 px-4 py-2 border rounded"
          placeholder={`Item ${index + 1}`}
        />
        <button
          onClick={() => handleRemoveField(field.id)}
          className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  ))}
</AnimatePresence>

<button
  onClick={handleAddField}
  className="mt-2 px-4 py-2 bg-brand-primary text-white rounded"
>
  + Add Item
</button>
```

---

## Dynamic Fields with Separators

### Code Example

```tsx
{fields.map((field, index) => (
  <React.Fragment key={field.id}>
    {index > 0 && (
      <div className="flex items-center justify-center my-4">
        <div className="flex-1 border-t border-gray-300" />
        <span className="px-4 text-gray-500 font-medium">AND</span>
        <div className="flex-1 border-t border-gray-300" />
      </div>
    )}
    
    <div className="flex gap-2">
      <input
        value={field.value}
        onChange={(e) => handleFieldChange(field.id, e.target.value)}
        className="flex-1 px-4 py-2 border rounded"
      />
      <button onClick={() => handleRemoveField(field.id)}>
        Remove
      </button>
    </div>
  </React.Fragment>
))}
```

---

## Complex Dynamic Field Objects

### Code Example

```typescript
interface IngredientField {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

const [ingredients, setIngredients] = useState<IngredientField[]>([
  { id: '1', name: '', quantity: 0, unit: 'cups' }
]);

const handleAddIngredient = () => {
  setIngredients([
    ...ingredients,
    {
      id: Date.now().toString(),
      name: '',
      quantity: 0,
      unit: 'cups'
    }
  ]);
};

const handleIngredientChange = (
  id: string,
  field: keyof IngredientField,
  value: any
) => {
  setIngredients(ingredients.map(ing =>
    ing.id === id ? { ...ing, [field]: value } : ing
  ));
};

// Render complex fields
{ingredients.map((ingredient) => (
  <div key={ingredient.id} className="flex gap-2 mb-2">
    <input
      type="text"
      value={ingredient.name}
      onChange={(e) => handleIngredientChange(ingredient.id, 'name', e.target.value)}
      placeholder="Ingredient name"
      className="flex-1 px-4 py-2 border rounded"
    />
    <input
      type="number"
      value={ingredient.quantity}
      onChange={(e) => handleIngredientChange(ingredient.id, 'quantity', parseFloat(e.target.value))}
      placeholder="Qty"
      className="w-20 px-4 py-2 border rounded"
    />
    <select
      value={ingredient.unit}
      onChange={(e) => handleIngredientChange(ingredient.id, 'unit', e.target.value)}
      className="w-32 px-4 py-2 border rounded"
    >
      <option value="cups">Cups</option>
      <option value="tbsp">Tbsp</option>
      <option value="tsp">Tsp</option>
      <option value="oz">Oz</option>
    </select>
    <button
      onClick={() => handleRemoveIngredient(ingredient.id)}
      className="px-3 py-2 bg-red-500 text-white rounded"
    >
      <XIcon className="w-5 h-5" />
    </button>
  </div>
))}
```

---

## Reordering Dynamic Fields

### Code Example

```typescript
const handleMoveUp = (id: string) => {
  const index = fields.findIndex(f => f.id === id);
  if (index > 0) {
    playClickSound();
    const newFields = [...fields];
    [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
    setFields(newFields);
  }
};

const handleMoveDown = (id: string) => {
  const index = fields.findIndex(f => f.id === id);
  if (index < fields.length - 1) {
    playClickSound();
    const newFields = [...fields];
    [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
    setFields(newFields);
  }
};

// Render with reorder buttons
{fields.map((field, index) => (
  <div key={field.id} className="flex gap-2 mb-2">
    <div className="flex flex-col gap-1">
      <button
        onClick={() => handleMoveUp(field.id)}
        disabled={index === 0}
        className="p-1 border rounded disabled:opacity-50"
      >
        <ChevronUpIcon className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleMoveDown(field.id)}
        disabled={index === fields.length - 1}
        className="p-1 border rounded disabled:opacity-50"
      >
        <ChevronDownIcon className="w-4 h-4" />
      </button>
    </div>
    <input
      value={field.value}
      onChange={(e) => handleFieldChange(field.id, e.target.value)}
      className="flex-1 px-4 py-2 border rounded"
    />
    <button onClick={() => handleRemoveField(field.id)}>
      Remove
    </button>
  </div>
))}
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Using array index as key (causes bugs when reordering)
{fields.map((field, index) => (
  <div key={index}>
    <input value={field.value} />
  </div>
))}

// No minimum field requirement
const handleRemoveField = (id: string) => {
  setFields(fields.filter(f => f.id !== id));
  // User can remove all fields!
};

// No maximum limit
const handleAddField = () => {
  setFields([...fields, newField]);
  // User can add unlimited fields, causing performance issues
};

// Mutating state directly
const handleFieldChange = (id: string, value: string) => {
  const field = fields.find(f => f.id === id);
  field.value = value; // WRONG! Mutating state
  setFields(fields);
};
```

### ✅ Do This Instead

```typescript
// Use unique IDs as keys
{fields.map((field) => (
  <div key={field.id}>
    <input value={field.value} />
  </div>
))}

// Enforce minimum
const handleRemoveField = (id: string) => {
  if (fields.length > 1) { // At least 1 field required
    setFields(fields.filter(f => f.id !== id));
  }
};

// Enforce maximum
const handleAddField = () => {
  if (fields.length < 10) { // Max 10 fields
    setFields([...fields, newField]);
  }
};

// Immutable state updates
const handleFieldChange = (id: string, value: string) => {
  setFields(fields.map(f =>
    f.id === id ? { ...f, value } : f
  ));
};
```

---

## When to Use This Pattern

✅ **Use for:**
- Ingredient lists in recipes
- Multiple email/phone inputs
- Task lists with add/remove
- Form sections that can be duplicated
- Shopping cart items
- Tag/keyword inputs
- Multiple file uploads
- Address lists (shipping/billing)

❌ **Don't use for:**
- Fixed number of fields (use regular inputs)
- Very large lists (use virtualization)
- Complex nested structures (consider alternative UI)

---

## Benefits

1. **Flexibility** - Users control how many fields they need
2. **Better UX** - No wasted space for unused fields
3. **Scalability** - Handles variable-length data
4. **Validation** - Can validate each field independently
5. **User Control** - Empowers users to structure their data
6. **Clean UI** - Only shows necessary fields
7. **Mobile Friendly** - Reduces scrolling on small screens

---

## Related Patterns

- See `form-validation.md` for validating dynamic fields
- See `form-submission.md` for submitting dynamic field data
- See `../02-react-patterns/state-management.md` for managing complex field state
- See `../10-utilities/array-utilities.md` for array manipulation helpers

---

*Extracted: 2026-02-18*
