# useMutation Patterns

## Source
Extracted from BistroLens components:
- `components/AdminDashboard.tsx`
- `components/TonightCTA.tsx`
- `components/AcademySEOCollectionPage.tsx`
- `components/ImageAdminDashboard.tsx`
- `components/BentoDatasetAdmin.tsx`
- `components/RecipeScannerModal.tsx`
- `.nova/reference-components/FormWithValidation.reference.tsx`

---

## Pattern: Convex useMutation Hook

The `useMutation` hook from Convex React enables you to call server-side mutations (write operations) from your React components. Mutations modify database state and return results.

---

## Basic Usage

### Simple Mutation Declaration

```typescript
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';

function MyComponent() {
  // Declare mutation - returns a function you can call
  const updateProfile = useMutation(api.users.updateProfile);
  
  const handleUpdate = async () => {
    try {
      await updateProfile({
        userId: 'user_123',
        name: 'John Doe'
      });
    } catch (error) {
      console.error('Update failed:', error);
    }
  };
  
  return <button onClick={handleUpdate}>Update Profile</button>;
}
```

### Multiple Mutations in One Component

```typescript
function AdminDashboard() {
  // Declare multiple mutations
  const updateSubscription = useMutation(api.admin.updateUserSubscription);
  const moderateContent = useMutation(api.admin.moderateContent);
  const approveAffiliate = useMutation(api.affiliates.approveAffiliate);
  const rejectAffiliate = useMutation(api.affiliates.rejectAffiliate);
  const sendNotification = useMutation(api.admin.sendBulkNotification);
  
  // Use them in handlers
  const handleApprove = async (affiliateId: string) => {
    await approveAffiliate({ 
      affiliateId: affiliateId as any, 
      moderatorId: 'admin' 
    });
  };
  
  return (
    <button onClick={() => handleApprove('aff_123')}>
      Approve
    </button>
  );
}
```

---

## Error Handling Patterns

### Basic Try-Catch

```typescript
function SaveButton() {
  const saveCollection = useMutation(api.savedCollections.saveCollection);
  const [error, setError] = useState<string | null>(null);
  
  const handleSave = async () => {
    setError(null);
    
    try {
      await saveCollection({ slug: 'my-collection' });
    } catch (error) {
      console.error('Failed to save collection:', error);
      setError('Could not save collection. Please try again.');
    }
  };
  
  return (
    <div>
      <button onClick={handleSave}>Save</button>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}
```

### Form Submission with Error State

```typescript
function ProfileForm() {
  const updateProfile = useMutation(api.users.updateProfile);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    
    try {
      await updateProfile({
        userId: 'user_123',
        ...data,
      });
      
      setSubmitSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (error) {
      setSubmitError(
        error instanceof Error 
          ? error.message 
          : 'Failed to update profile'
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {submitSuccess && <Alert>Profile updated!</Alert>}
      {submitError && <Alert variant="error">{submitError}</Alert>}
      
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}
```

---

## State Management Patterns

### Loading States

```typescript
function CookTonightCTA() {
  const logSaveEvent = useMutation(api.savedCollections.logSaveEvent);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleClick = async () => {
    setIsLoading(true);
    
    try {
      await logSaveEvent({
        eventType: "cook_tonight_click",
        slug: 'my-collection',
        authed: true,
      });
      
      // Continue with other actions...
    } catch (error) {
      console.error('Failed to log event:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <button onClick={handleClick} disabled={isLoading}>
      {isLoading ? 'Starting...' : 'Cook one tonight'}
    </button>
  );
}
```

### Animation States

```typescript
function SaveCollectionButton() {
  const saveCollection = useMutation(api.savedCollections.saveCollection);
  const unsaveCollection = useMutation(api.savedCollections.unsaveCollection);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  
  const handleClick = async () => {
    setIsAnimating(true);
    
    try {
      if (isSaved) {
        await unsaveCollection({ slug: 'my-collection' });
        setIsSaved(false);
      } else {
        await saveCollection({ slug: 'my-collection' });
        setIsSaved(true);
      }
    } catch (error) {
      console.error('Failed to save/unsave:', error);
    } finally {
      setTimeout(() => setIsAnimating(false), 300);
    }
  };
  
  return (
    <motion.button
      onClick={handleClick}
      animate={isAnimating ? { scale: [1, 1.1, 1] } : {}}
    >
      {isSaved ? 'Saved ✓' : 'Save'}
    </motion.button>
  );
}
```

---

## Fire-and-Forget Analytics

### Non-Blocking Analytics Calls

```typescript
function CollectionPage() {
  const logSaveEvent = useMutation(api.savedCollections.logSaveEvent);
  const saveCollection = useMutation(api.savedCollections.saveCollection);
  
  const handleSave = async () => {
    // Log click event (fire and forget - don't block on analytics)
    logSaveEvent({
      eventType: "collection_save_click",
      slug: 'my-collection',
      authed: true,
    }).catch(console.error);
    
    // Don't wait for analytics - proceed immediately with main action
    try {
      await saveCollection({ slug: 'my-collection' });
    } catch (error) {
      console.error('Save failed:', error);
    }
  };
  
  return <button onClick={handleSave}>Save</button>;
}
```

### Multiple Analytics Events

```typescript
function TonightCTA() {
  const completeCooking = useMutation(api.cookingResumeState.completeCooking);
  const logAnalytics = useMutation(api.analytics.logEvent);
  
  const handleStartFresh = async () => {
    // Log analytics (fire and forget)
    logAnalytics({
      event: 'tonight_cta_clicked_start_fresh',
      data: { clearedRecipeId: resumeState?.recipeId }
    }).catch(console.error);
    
    // Clear the resume state (main action)
    await completeCooking();
  };
  
  return <button onClick={handleStartFresh}>Start Fresh</button>;
}
```

---

## Conditional Mutations

### Authentication-Gated Mutations

```typescript
function SaveButton({ isAuthenticated, slug }: Props) {
  const saveCollection = useMutation(api.savedCollections.saveCollection);
  const logEvent = useMutation(api.savedCollections.logSaveEvent);
  
  const handleClick = async () => {
    // Log click regardless of auth
    logEvent({
      eventType: "save_click",
      slug,
      authed: isAuthenticated,
    }).catch(console.error);
    
    if (!isAuthenticated) {
      // Redirect to login
      window.location.href = `/login?next=/collections/${slug}`;
      return;
    }
    
    // Proceed with mutation only if authenticated
    try {
      await saveCollection({ slug });
    } catch (error) {
      console.error('Save failed:', error);
    }
  };
  
  return <button onClick={handleClick}>Save</button>;
}
```

### Conditional Mutation Based on State

```typescript
function ResumeButton({ resumeState }: Props) {
  const completeCooking = useMutation(api.cookingResumeState.completeCooking);
  
  const handleResume = useCallback(() => {
    if (!resumeState) {
      console.warn('No resume state available');
      return;
    }
    
    // Only call mutation if state exists
    onStartCooking(
      resumeState.recipeId,
      resumeState.recipeTitle,
      resumeState.lastStepIndex
    );
  }, [resumeState, onStartCooking]);
  
  return (
    <button onClick={handleResume} disabled={!resumeState}>
      Continue Cooking
    </button>
  );
}
```

---

## Batch Operations

### Sequential Mutations

```typescript
function BentoDatasetAdmin() {
  const createBatchJob = useMutation(api.bentoDataset.createBentoBatchJob);
  const updateBatchProgress = useMutation(api.bentoDataset.updateBatchJobProgress);
  const createJobItem = useMutation(api.bentoDataset.createJobItem);
  const storeBentoRecipe = useMutation(api.bentoDataset.storeBentoRecipe);
  
  const handleBatchGeneration = async () => {
    const batchId = `batch-${Date.now()}`;
    
    try {
      // Step 1: Create batch job
      await createBatchJob({
        batchId,
        category: 'all',
        totalItems: 100,
        estimatedCost: 5.00
      });
      
      // Step 2: Process items sequentially
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Update progress
        await updateBatchProgress({
          batchId,
          current: i + 1,
          total: items.length
        });
        
        // Store recipe
        await storeBentoRecipe({
          recipeId: item.id,
          title: item.title,
          // ... other fields
        });
      }
    } catch (error) {
      console.error('Batch operation failed:', error);
    }
  };
  
  return <button onClick={handleBatchGeneration}>Start Batch</button>;
}
```

### Progress Tracking

```typescript
function QuickSeedButton() {
  const seedBentoRecipe = useMutation(api.bentoDataset.seedBentoRecipe);
  const [seedProgress, setSeedProgress] = useState({ current: 0, total: 0 });
  const [seedingStatus, setSeedingStatus] = useState<'idle' | 'seeding' | 'done'>('idle');
  
  const handleQuickSeed = async () => {
    if (seedingStatus === 'seeding') return;
    
    setSeedingStatus('seeding');
    setSeedProgress({ current: 0, total: allRecipes.length });
    
    try {
      for (let i = 0; i < allRecipes.length; i++) {
        const recipe = allRecipes[i];
        
        // Update progress UI
        setSeedProgress({ current: i + 1, total: allRecipes.length });
        
        // Seed recipe
        await seedBentoRecipe({
          recipeId: recipe.recipeId,
          title: recipe.title,
          description: recipe.description,
          // ... other fields
        });
      }
      
      setSeedingStatus('done');
    } catch (error) {
      console.error('Quick seed failed:', error);
      setSeedingStatus('idle');
    }
  };
  
  return (
    <div>
      <button onClick={handleQuickSeed} disabled={seedingStatus === 'seeding'}>
        {seedingStatus === 'seeding' ? 'Seeding...' : 'Quick Seed'}
      </button>
      {seedingStatus === 'seeding' && (
        <p>Progress: {seedProgress.current} / {seedProgress.total}</p>
      )}
    </div>
  );
}
```

---

## Toggle Patterns

### Boolean Toggle with Reason

```typescript
function KillSwitchToggle() {
  const toggleKillSwitch = useMutation(api.imageDataset.toggleKillSwitch);
  const [killSwitchReason, setKillSwitchReason] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  
  const handleToggle = async () => {
    const newState = !isEnabled;
    
    // Require reason when enabling
    if (newState && !killSwitchReason.trim()) {
      alert('Please provide a reason for enabling the kill switch');
      return;
    }
    
    try {
      await toggleKillSwitch({
        enabled: newState,
        reason: newState ? killSwitchReason : undefined,
        adminId: 'admin-user'
      });
      
      setIsEnabled(newState);
      
      // Clear reason after successful toggle
      if (newState) {
        setKillSwitchReason('');
      }
    } catch (error) {
      console.error('Toggle failed:', error);
    }
  };
  
  return (
    <div>
      {!isEnabled && (
        <input
          type="text"
          placeholder="Reason for enabling..."
          value={killSwitchReason}
          onChange={(e) => setKillSwitchReason(e.target.value)}
        />
      )}
      <button onClick={handleToggle}>
        {isEnabled ? 'Disable' : 'Enable'} Kill Switch
      </button>
    </div>
  );
}
```

---

## Inline Mutations (Dropdown Actions)

### Select Dropdown with Mutation

```typescript
function UserRow({ user }: Props) {
  const updateSubscription = useMutation(api.admin.updateUserSubscription);
  
  return (
    <tr>
      <td>{user.name}</td>
      <td>{user.email}</td>
      <td>
        <select
          defaultValue=""
          onChange={async (e) => {
            if (e.target.value) {
              await updateSubscription({
                userId: user.id,
                tier: e.target.value as any,
                status: 'active',
                reason: 'Admin override'
              });
              
              // Reset dropdown
              e.target.value = '';
            }
          }}
        >
          <option value="">Change tier...</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
          <option value="chef_master">Chef Master</option>
        </select>
      </td>
    </tr>
  );
}
```

---

## Anti-Patterns

### ❌ Don't Call Mutations During Render

```typescript
// BAD: Calling mutation during render
function BadComponent() {
  const updateProfile = useMutation(api.users.updateProfile);
  
  // ❌ This will cause infinite re-renders!
  updateProfile({ userId: 'user_123', name: 'John' });
  
  return <div>Profile</div>;
}
```

### ✅ Do Call Mutations in Event Handlers or Effects

```typescript
// GOOD: Call mutation in event handler
function GoodComponent() {
  const updateProfile = useMutation(api.users.updateProfile);
  
  const handleUpdate = async () => {
    await updateProfile({ userId: 'user_123', name: 'John' });
  };
  
  return <button onClick={handleUpdate}>Update</button>;
}

// GOOD: Call mutation in effect (with proper dependencies)
function GoodComponentWithEffect() {
  const updateProfile = useMutation(api.users.updateProfile);
  
  useEffect(() => {
    updateProfile({ userId: 'user_123', name: 'John' });
  }, []); // Only run once on mount
  
  return <div>Profile</div>;
}
```

### ❌ Don't Ignore Errors

```typescript
// BAD: Silently failing mutation
function BadErrorHandling() {
  const saveCollection = useMutation(api.savedCollections.saveCollection);
  
  const handleSave = async () => {
    // ❌ No error handling - user won't know if it failed
    await saveCollection({ slug: 'my-collection' });
  };
  
  return <button onClick={handleSave}>Save</button>;
}
```

### ✅ Do Handle Errors Appropriately

```typescript
// GOOD: Proper error handling with user feedback
function GoodErrorHandling() {
  const saveCollection = useMutation(api.savedCollections.saveCollection);
  const [error, setError] = useState<string | null>(null);
  
  const handleSave = async () => {
    setError(null);
    
    try {
      await saveCollection({ slug: 'my-collection' });
    } catch (error) {
      console.error('Save failed:', error);
      setError('Could not save collection. Please try again.');
    }
  };
  
  return (
    <div>
      <button onClick={handleSave}>Save</button>
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
```

### ❌ Don't Block UI on Analytics

```typescript
// BAD: Waiting for analytics before proceeding
function BadAnalytics() {
  const logEvent = useMutation(api.analytics.logEvent);
  const saveCollection = useMutation(api.savedCollections.saveCollection);
  
  const handleSave = async () => {
    // ❌ Waiting for analytics slows down user action
    await logEvent({ event: 'save_click' });
    await saveCollection({ slug: 'my-collection' });
  };
  
  return <button onClick={handleSave}>Save</button>;
}
```

### ✅ Do Fire-and-Forget Analytics

```typescript
// GOOD: Non-blocking analytics
function GoodAnalytics() {
  const logEvent = useMutation(api.analytics.logEvent);
  const saveCollection = useMutation(api.savedCollections.saveCollection);
  
  const handleSave = async () => {
    // ✅ Fire and forget - don't wait for analytics
    logEvent({ event: 'save_click' }).catch(console.error);
    
    // Proceed immediately with main action
    await saveCollection({ slug: 'my-collection' });
  };
  
  return <button onClick={handleSave}>Save</button>;
}
```

---

## When to Use This Pattern

✅ **Use useMutation for:**
- Creating, updating, or deleting data
- Server-side operations that modify state
- Actions that require authentication/authorization
- Operations that need to be atomic
- Batch operations with progress tracking
- Form submissions
- User actions (save, delete, approve, etc.)

❌ **Don't use useMutation for:**
- Reading data (use `useQuery` instead)
- Client-only state changes (use `useState`)
- Computed values (use `useMemo`)
- Side effects without data changes (use `useEffect`)

---

## Benefits

1. **Type Safety**: Full TypeScript support with generated API types
2. **Automatic Retries**: Convex handles transient failures automatically
3. **Optimistic Updates**: Can be combined with optimistic UI patterns
4. **Real-time Sync**: Changes propagate to all connected clients via queries
5. **Error Handling**: Built-in error handling with try-catch
6. **Progress Tracking**: Easy to implement loading and progress states
7. **Authentication**: Integrates with Convex auth system
8. **Atomic Operations**: Mutations are transactional by default

---

## Related Patterns

- See `usequery-patterns.md` for reading data
- See `pagination-patterns.md` for paginated mutations
- See `caching-strategies.md` for optimistic updates
- See `../05-form-patterns/form-validation.md` for form submission patterns
- See `../01-convex-patterns/error-handling.md` for comprehensive error strategies

---

*Extracted: 2026-02-18*
