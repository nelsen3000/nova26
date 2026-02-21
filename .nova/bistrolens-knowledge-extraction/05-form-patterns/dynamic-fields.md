# Dynamic Form Fields Pattern

## Source
Extracted from BistroLens:
- `components/FusionRecipeGenerator.tsx` (dynamic ingredient inputs with lock/unlock)
- `components/PotluckPlannerModal.tsx` (add/remove contributions)
- `components/ShopTool.tsx` (shopping list item management)
- `components/FridgeRescue.tsx` (ingredient list management)

---

## Pattern: Dynamic Array-Based Form Fields

BistroLens implements dynamic form fields using array state management with add/remove operations, unique IDs for tracking, and smooth animations for visual feedback.

---

## Core Pattern: Array State with Unique IDs

### Basic Structure

```tsx
interface InputState {
  id: string;
  value: string;
  locked: boolean;
}

const [inputs, setInputs] = useState<InputState[]>([
  { id: Date.now().toString(), value: '', locked: false },
  { id: (Date.now() + 1).toString(), value: '', locked: false }
]);
```

### Add Field Handler

```tsx
const handleAddInput = () => {
  if (inputs.length < 4) { // Optional max limit
    playClickSound();
    setInputs([...inputs, { 
      id: Date.now().toString(), 
      value: '', 
      locked: false 
    }]);
  }
};
```

### Remove Field Handler

```tsx
const handleRemoveInput = (id: string) => {
  if (inputs.length > 2) { // Optional min limit
    playClickSound();
    setInputs(inputs.filter(i => i.id !== id));
  }
};
```

### Update Field Handler

```tsx
const handleInputChange = (id: string, value: string) => {
  setInputs(inputs.map(i => 
    i.id === id ? { ...i, value } : i
  ));
};
```

---

## Pattern: Simple String Array (Lightweight)

### Basic Implementation

```tsx
const [contributions, setContributions] = useState<string[]>([]);
const [newContribution, setNewContribution] = useState('');

const addContribution = () => {
  if (newContribution.trim()) {
    setContributions([...contributions, newContribution.trim()]);
    setNewContribution('');
  }
};

const removeContribution = (index: number) => {
  setContributions(c => c.filter((_, idx) => idx !== index));
};
```

### UI Implementation

```tsx
<div>
  {/* Add Input */}
  <div className="flex gap-2 mb-2">
    <input 
      type="text" 
      value={newContribution} 
      onChange={e => setNewContribution(e.target.value)} 
      onKeyDown={e => e.key === 'Enter' && addContribution()} 
      placeholder="e.g. Chips & Salsa" 
      className="flex-1 p-3 rounded-xl bg-brand-white border border-brand-black/20 outline-none" 
    />
    <button 
      onClick={addContribution} 
      className="p-3 bg-brand-secondary text-brand-white rounded-xl"
    >
      <PlusIcon className="w-5 h-5"/>
    </button>
  </div>
  
  {/* Display List */}
  <div className="flex flex-wrap gap-2">
    {contributions.map((item, i) => (
      <span 
        key={i} 
        className="px-3 py-1 bg-brand-white border border-brand-black/20 rounded-full text-sm flex items-center gap-2"
      >
        {item} 
        <button onClick={() => removeContribution(i)}>
          <TrashIcon className="w-3 h-3 text-brand-black/60 hover:text-red-500"/>
        </button>
      </span>
    ))}
  </div>
</div>
```

---

## Pattern: Complex Object Arrays

### Ingredient Management with Metadata

```tsx
interface Ingredient {
  id: string;
  name: string;
  amount?: string;
  daysLeft?: number;
}

const [ingredients, setIngredients] = useState<Ingredient[]>([]);
const [newIngredient, setNewIngredient] = useState('');

const addIngredient = () => {
  if (!newIngredient.trim()) return;
  
  playClickSound();
  const ingredient: Ingredient = {
    id: Date.now().toString(),
    name: newIngredient.trim(),
    daysLeft: Math.floor(Math.random() * 7) + 1
  };
  
  setIngredients([...ingredients, ingredient]);
  setNewIngredient('');
};

const removeIngredient = (id: string) => {
  playClickSound();
  setIngredients(ingredients.filter(ing => ing.id !== id));
};
```

### Shopping List Item with Multiple Fields

```tsx
const [newItemName, setNewItemName] = useState('');
const [newItemQuantity, setNewItemQuantity] = useState('1');
const [newItemUnit, setNewItemUnit] = useState('item');

const handleAddItem = () => {
  if (!newItemName.trim()) return;
  
  playClickSound();
  unifiedShoppingListService.addItem(
    newItemName.trim(),
    parseFloat(newItemQuantity) || 1,
    newItemUnit,
    'manual'
  );
  
  // Reset form
  setNewItemName('');
  setNewItemQuantity('1');
  setNewItemUnit('item');
  loadShoppingList();
  playSuccessSound();
};
```

### Multi-Field Input UI

```tsx
<div className="flex gap-3">
  <input
    type="text"
    value={newItemName}
    onChange={(e) => setNewItemName(e.target.value)}
    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
    placeholder="Item name (e.g., Milk, Eggs)"
    className="flex-1 p-3 border border-brand-black/20 rounded-lg bg-brand-white text-brand-black focus:border-brand-primary outline-none"
  />
  <input
    type="number"
    value={newItemQuantity}
    onChange={(e) => setNewItemQuantity(e.target.value)}
    onFocus={(e) => e.target.select()}
    className="w-20 p-3 border border-brand-black/20 rounded-lg bg-brand-white text-brand-black text-center focus:border-brand-primary outline-none"
  />
  <select
    value={newItemUnit}
    onChange={(e) => setNewItemUnit(e.target.value)}
    className="w-24 p-3 border border-brand-black/20 rounded-lg bg-brand-white text-brand-black focus:border-brand-primary outline-none"
  >
    <option value="item">item</option>
    <option value="lb">lb</option>
    <option value="oz">oz</option>
    <option value="cup">cup</option>
    <option value="tsp">tsp</option>
    <option value="tbsp">tbsp</option>
    <option value="pkg">pkg</option>
    <option value="bottle">bottle</option>
    <option value="can">can</option>
  </select>
  <button
    onClick={handleAddItem}
    className="px-6 py-3 bg-green-600 text-brand-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
  >
    <PlusIcon className="w-4 h-4" />
    Add
  </button>
</div>
```

---

## Pattern: Animated Dynamic Fields with Framer Motion

### AnimatePresence for Smooth Transitions

```tsx
import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence>
  {inputs.map((input, index) => (
    <React.Fragment key={input.id}>
      {/* Separator between items */}
      {index > 0 && (
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-brand-black font-sans text-lg font-bold select-none pb-0.5 px-1"
        >
          x
        </motion.div>
      )}

      {/* Input Module */}
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="relative flex-1 min-w-[160px] max-w-[260px] h-16 md:h-[72px] group"
      >
        {/* Input content */}
      </motion.div>
    </React.Fragment>
  ))}
</AnimatePresence>
```

### Add Button with Animation

```tsx
{inputs.length < 4 && (
  <motion.button
    layout
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    onClick={handleAddInput}
    className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full border-2 border-dashed border-brand-black/20 text-brand-black/60 hover:text-brand-primary hover:border-brand-primary hover:bg-brand-primary/5 transition-all"
    aria-label="Add another item"
  >
    <PlusIcon className="w-6 h-6 md:w-7 md:h-7" />
  </motion.button>
)}
```

---

## Pattern: Lock/Unlock Field State

### Stateful Input with Lock Toggle

```tsx
interface InputState {
  id: string;
  value: string;
  locked: boolean;
}

const handleInputLock = (id: string) => {
  playClickSound();
  setInputs(inputs.map(i => 
    i.id === id ? { ...i, locked: true } : i
  ));
};

const handleInputUnlock = (id: string) => {
  playClickSound();
  setInputs(inputs.map(i => 
    i.id === id ? { ...i, locked: false } : i
  ));
};

const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: string) => {
  if (e.key === 'Enter') {
    handleInputLock(id);
  }
};
```

### Conditional Rendering: Locked vs Unlocked

```tsx
{input.locked ? (
  // Locked state: Display as badge with actions
  <div className="w-full h-full flex items-center justify-between px-5 bg-brand-primary text-brand-white rounded-full font-bold text-xl md:text-2xl shadow-md group/item relative overflow-hidden">
    <span 
      className="truncate mr-2 cursor-pointer flex-1"
      onClick={() => handleInputUnlock(input.id)}
    >
      {input.value}
    </span>
    
    <div className="flex items-center gap-1.5">
      <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          handleShuffleInput(input.id); 
        }}
        className="p-1.5 rounded-full hover:bg-brand-white/20 transition-colors"
        title="Shuffle this item"
      >
        <ShuffleIcon className="w-5 h-5" />
      </button>
      <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          handleRemoveInput(input.id); 
        }}
        className={`p-1.5 rounded-full hover:bg-brand-white/20 transition-colors ${inputs.length <= 2 ? 'hidden' : ''}`}
      >
        <CloseIcon className="w-5 h-5" />
      </button>
    </div>
  </div>
) : (
  // Unlocked state: Editable input
  <input
    type="text"
    value={input.value}
    onChange={(e) => handleInputChange(input.id, e.target.value)}
    onKeyDown={(e) => handleKeyDown(e, input.id)}
    onBlur={() => input.value.trim() && handleInputLock(input.id)}
    placeholder="Ingredient..."
    autoFocus={!input.value}
    className="w-full h-full bg-brand-white border-2 border-brand-black/20 rounded-full px-5 text-xl md:text-2xl font-medium text-brand-black focus:outline-none focus:border-brand-primary focus:bg-brand-white transition-all placeholder:text-brand-black/60/50 text-center"
  />
)}
```

---

## Pattern: Keyboard Shortcuts

### Enter to Lock/Submit

```tsx
<input
  type="text"
  value={newContribution}
  onChange={e => setNewContribution(e.target.value)}
  onKeyDown={e => e.key === 'Enter' && addContribution()}
  placeholder="e.g. Chips & Salsa"
  className="flex-1 p-3 rounded-xl bg-brand-white border border-brand-black/20 outline-none"
/>
```

### Enter to Lock, Blur to Auto-Lock

```tsx
<input
  type="text"
  value={input.value}
  onChange={(e) => handleInputChange(input.id, e.target.value)}
  onKeyDown={(e) => handleKeyDown(e, input.id)} // Enter locks
  onBlur={() => input.value.trim() && handleInputLock(input.id)} // Blur auto-locks if has value
  placeholder="Ingredient..."
  autoFocus={!input.value}
  className="w-full h-full bg-brand-white border-2 border-brand-black/20 rounded-full px-5 text-xl md:text-2xl font-medium text-brand-black focus:outline-none focus:border-brand-primary transition-all"
/>
```

---

## Pattern: Min/Max Constraints

### Enforce Minimum Items

```tsx
const handleRemoveInput = (id: string) => {
  if (inputs.length > 2) { // Minimum 2 items required
    playClickSound();
    setInputs(inputs.filter(i => i.id !== id));
  }
};

// Hide remove button when at minimum
<button 
  onClick={(e) => { 
    e.stopPropagation(); 
    handleRemoveInput(input.id); 
  }}
  className={`p-1.5 rounded-full hover:bg-brand-white/20 transition-colors ${
    inputs.length <= 2 ? 'hidden' : ''
  }`}
>
  <CloseIcon className="w-5 h-5" />
</button>
```

### Enforce Maximum Items

```tsx
const handleAddInput = () => {
  if (inputs.length < 4) { // Maximum 4 items allowed
    playClickSound();
    setInputs([...inputs, { 
      id: Date.now().toString(), 
      value: '', 
      locked: false 
    }]);
  }
};

// Conditionally render add button
{inputs.length < 4 && (
  <motion.button
    layout
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    onClick={handleAddInput}
    className="w-12 h-12 flex items-center justify-center rounded-full border-2 border-dashed border-brand-black/20"
    aria-label="Add another item"
  >
    <PlusIcon className="w-6 h-6" />
  </motion.button>
)}
```

---

## Pattern: Empty State Handling

### Display Empty State

```tsx
{ingredients.length === 0 && (
  <div className="text-center py-8 text-gray-400">
    <Trash2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
    <p>Add ingredients to get started</p>
  </div>
)}
```

### Disable Actions When Empty

```tsx
<button
  onClick={generateRescueRecipe}
  disabled={ingredients.length === 0 || isGenerating}
  className="w-full mt-6 px-6 py-4 bg-green-500 text-brand-white rounded-xl hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-bold text-lg flex items-center justify-center gap-2"
>
  {isGenerating ? (
    <>
      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      Rescuing ingredients...
    </>
  ) : (
    <>
      <ChefHat className="w-5 h-5" />
      Rescue My Ingredients!
    </>
  )}
</button>
```

---

## Pattern: Validation Before Submission

### Filter Empty Values

```tsx
const handleGenerate = async () => {
  const activeInputs = inputs.filter(i => i.value.trim() !== '');
  
  if (activeInputs.length < 2) {
    // Show error or disable button
    return;
  }
  
  // Proceed with only non-empty inputs
  const fusionString = activeInputs.map(i => i.value).join(' + ');
  // ... generate recipe
};
```

### Visual Feedback for Validation

```tsx
<p className="text-base text-brand-black/60 animate-pulse">
  {inputs.filter(i => i.value.trim() !== '').length < 2 
    ? "Add at least two items to start." 
    : "Ready to fuse!"}
</p>
```

---

## Anti-Patterns

### ❌ Don't: Use Array Index as Key

```tsx
// BAD: Index as key causes issues when reordering/removing
{items.map((item, index) => (
  <div key={index}>{item.name}</div>
))}
```

### ✅ Do: Use Unique IDs

```tsx
// GOOD: Unique ID persists across operations
interface Item {
  id: string; // Date.now().toString() or uuid()
  name: string;
}

{items.map((item) => (
  <div key={item.id}>{item.name}</div>
))}
```

### ❌ Don't: Mutate State Directly

```tsx
// BAD: Direct mutation doesn't trigger re-render
const addItem = () => {
  items.push({ id: Date.now().toString(), value: '' });
};
```

### ✅ Do: Create New Array

```tsx
// GOOD: Spread operator creates new array
const addItem = () => {
  setItems([...items, { id: Date.now().toString(), value: '' }]);
};
```

### ❌ Don't: Forget to Reset Input After Add

```tsx
// BAD: Input field retains value after adding
const addItem = () => {
  setItems([...items, newItem]);
  // Forgot to clear input!
};
```

### ✅ Do: Clear Input State

```tsx
// GOOD: Reset input for next entry
const addItem = () => {
  if (!newItem.trim()) return;
  setItems([...items, newItem.trim()]);
  setNewItem(''); // Clear input
};
```

### ❌ Don't: Allow Unlimited Items Without Constraint

```tsx
// BAD: No limit can cause performance issues
const addItem = () => {
  setItems([...items, newItem]);
};
```

### ✅ Do: Enforce Reasonable Limits

```tsx
// GOOD: Set max limit for UX and performance
const addItem = () => {
  if (items.length >= 10) {
    showToast("Maximum 10 items allowed");
    return;
  }
  setItems([...items, newItem]);
};
```

---

## When to Use This Pattern

✅ **Use for:**
- Recipe ingredient lists
- Shopping list builders
- Tag/keyword inputs
- Multi-recipient email forms
- Dynamic form sections (add/remove address, phone numbers)
- Collaborative planning tools (potluck contributions, task assignments)
- Customizable option lists
- Survey forms with variable questions

❌ **Don't use for:**
- Fixed-length forms (use regular inputs)
- Single-item inputs (use simple input field)
- Large datasets (use virtualized lists or pagination)
- Complex nested structures (consider form libraries like React Hook Form)

---

## Benefits

1. **Flexibility**: Users can add exactly what they need
2. **Better UX**: No artificial limits on user input
3. **Visual Feedback**: Animations make operations clear
4. **Keyboard Support**: Enter key shortcuts improve efficiency
5. **Type Safety**: TypeScript interfaces prevent errors
6. **Accessibility**: Proper ARIA labels and keyboard navigation
7. **Performance**: Unique IDs enable efficient React reconciliation
8. **Validation**: Easy to validate before submission
9. **State Management**: Simple array operations are easy to reason about

---

## Related Patterns

- See `form-validation.md` for validating dynamic field arrays
- See `form-submission.md` for submitting dynamic field data
- See `../04-ui-components/form-components.md` for reusable input components
- See `../02-react-patterns/state-management.md` for complex state patterns
- See `../09-hooks/useDebounce.md` for debouncing dynamic field updates

---

*Extracted: 2026-02-18*
