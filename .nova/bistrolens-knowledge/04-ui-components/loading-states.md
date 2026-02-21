# Loading States

## Source
Extracted from BistroLens:
- `components/LoadingScreen.tsx`
- `components/ui/skeleton.tsx` (via reference components)
- `.nova/reference-components/DataTable.reference.tsx`
- `.nova/reference-components/CommandPalette.reference.tsx`
- `App.tsx` (loading state management)
- `components/RecipeModeToggle.tsx`
- `components/ChefMasterExportGateModal.tsx`

---

## Pattern: Loading States

Loading states provide visual feedback during asynchronous operations. BistroLens implements multiple loading patterns: full-screen loading screens, skeleton loaders, inline spinners, and button loading states.

---

## 1. Full-Screen Loading with Facts

### Code Example

```typescript
import React, { useState, useEffect } from 'react';
import { LOADING_FACTS } from '../data/loadingFacts';
import { LightBulbIcon } from './Icons';

interface LoadingScreenProps {
  task: string;
  className?: string;
  showSkeleton?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  task, 
  className = "h-[450px]", 
  showSkeleton = false 
}) => {
  const [currentFactIndex, setCurrentFactIndex] = useState(() => 
    Math.floor(Math.random() * LOADING_FACTS.length)
  );
  const [fade, setFade] = useState(true);
  
  // Rotate facts every 4 seconds with fade transition
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const intervalId = setInterval(() => {
      setFade(false);
      timeoutId = setTimeout(() => {
        setCurrentFactIndex((prev) => (prev + 1) % LOADING_FACTS.length);
        setFade(true);
      }, 500);
    }, 4000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, []);

  const fact = LOADING_FACTS[currentFactIndex];

  return (
    <div className="relative flex flex-col items-center justify-center p-6 text-center w-full min-h-[400px] max-h-[500px] bg-brand-white rounded-xl shadow-2xl overflow-hidden">
      {/* Subtle Background with gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 via-transparent to-brand-secondary/5 pointer-events-none rounded-xl" />

      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-md mx-auto space-y-4">
        {/* Task Text - Embossed effect */}
        <h3 
          className="text-xs font-serif font-bold tracking-[0.15em] text-brand-primary uppercase antialiased"
          style={{ textShadow: '0 1px 0 rgba(255,255,255,0.5), 0 2px 3px rgba(0,0,0,0.1)' }}
        >
          {task}
        </h3>

        {/* Spinning Logo Animation */}
        <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center">
          {/* Outer Ring Pulse */}
          <div className="absolute inset-0 rounded-full border-2 border-brand-primary/20 animate-ping opacity-20"></div>
          <div className="absolute inset-3 rounded-full border border-brand-primary/10 animate-pulse"></div>
          
          {/* Spinning Logo Icon */}
          <div className="animate-[spin_3s_linear_infinite] origin-center drop-shadow-xl">
            <img 
              src="/logo-icon.png" 
              alt="Loading" 
              className="w-16 h-16 object-contain"
            />
          </div>
        </div>
        
        {/* Fact Box - Fixed height with proper overflow handling */}
        <div className={`w-full min-w-0 transition-opacity duration-500 ${fade ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-brand-white/50 border-l-4 border-brand-primary p-3 backdrop-blur-sm relative text-left rounded-r-lg shadow-lg min-h-[72px]">
            <div className="flex items-center gap-2 mb-1 text-[8px] font-bold uppercase tracking-widest text-brand-secondary">
              <LightBulbIcon className="w-3 h-3 flex-shrink-0" />
              <span>{fact.type}</span>
            </div>
            <p className="text-brand-black font-sans font-medium text-xs sm:text-sm leading-snug antialiased break-words whitespace-normal">
              "{fact.text}"
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="w-full max-w-xs">
          <div className="h-1 bg-brand-black/20/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary animate-[shimmer_2s_ease-in-out_infinite]" 
              style={{ width: '40%' }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
```

**Usage:**
```tsx
// In App.tsx or route components
<Suspense fallback={<LoadingScreen task="Setting the table..." className="h-64"/>}>
  <ViewTransition viewKey={currentView}>
    <RouteBoundary routeName={currentView}>
      {/* Your content */}
    </RouteBoundary>
  </ViewTransition>
</Suspense>
```

---

## 2. Skeleton Loaders

### Code Example

```typescript
// Reusable skeleton components
const SkeletonLine = ({ width = "100%" }: { width?: string }) => (
  <div 
    className="h-4 bg-gradient-to-r from-brand-black/20/30 via-brand-black/20/50 to-brand-black/20/30 rounded animate-pulse"
    style={{ width, animationDuration: '1.5s' }}
  />
);

const SkeletonCard = () => (
  <div className="bg-brand-white rounded-xl p-6 shadow-md space-y-4 animate-pulse">
    <div className="h-6 bg-gradient-to-r from-brand-black/20/30 via-brand-black/20/50 to-brand-black/20/30 rounded w-3/4" />
    <div className="space-y-2">
      <SkeletonLine width="100%" />
      <SkeletonLine width="90%" />
      <SkeletonLine width="95%" />
    </div>
    <div className="flex gap-2">
      <div className="h-8 w-20 bg-gradient-to-r from-brand-black/20/30 via-brand-black/20/50 to-brand-brand-black/20/30 rounded" />
      <div className="h-8 w-24 bg-gradient-to-r from-brand-black/20/30 via-brand-black/20/50 to-brand-black/20/30 rounded" />
    </div>
  </div>
);

// Skeleton screen variant for content loading
const SkeletonScreen = () => (
  <div className="w-full space-y-6 p-4">
    <div className="flex items-center gap-4 mb-8">
      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-brand-black/20/30 via-brand-black/20/50 to-brand-black/20/30 animate-pulse" />
      <div className="flex-1 space-y-2">
        <SkeletonLine width="40%" />
        <SkeletonLine width="60%" />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  </div>
);
```

**Usage in Data Tables:**
```tsx
// From DataTable.reference.tsx
if (users === undefined) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-6">
          <Skeleton className="h-10 w-[300px]" />
          <Skeleton className="h-10 w-[120px]" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 3. Inline Spinners

### Code Example

```typescript
// Simple spinner component
const Spinner = ({ className = "h-4 w-4" }: { className?: string }) => (
  <div className={`animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />
);

// Alternative with SVG
const SpinnerSVG = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
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
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
    />
  </svg>
);

// Usage in components
const LoadingIndicator = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-primary border-t-transparent" />
  </div>
);
```

**Usage:**
```tsx
// In monitoring dashboard
{isLoading ? (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-primary border-t-transparent" />
  </div>
) : (
  <DashboardContent />
)}
```

---

## 4. Button Loading States

### Code Example

```typescript
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Button with loading state
const SubmitButton = ({ isLoading, children }: { isLoading: boolean; children: React.ReactNode }) => (
  <Button type="submit" disabled={isLoading}>
    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
    {children}
  </Button>
);

// Full example from ChefMasterExportGateModal
const UpgradeButton = ({ isLoading, onClick }: { isLoading: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    disabled={isLoading}
    className="w-full py-4 bg-gradient-to-r from-brand-primary to-brand-primary text-brand-white rounded-xl font-bold uppercase tracking-wide hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
  >
    {isLoading ? (
      <>
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
          />
        </svg>
        Processing...
      </>
    ) : (
      <>
        <span>Upgrade Now</span>
      </>
    )}
  </button>
);
```

---

## 5. Pulse Animation for Active States

### Code Example

```typescript
// From RecipeModeToggle.tsx
const ModeButton = ({ 
  isLoading, 
  loadingMode, 
  mode, 
  onClick, 
  children 
}: {
  isLoading: boolean;
  loadingMode: string | null;
  mode: string;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    disabled={isLoading}
    className={`
      flex-1 py-2.5 px-4 rounded-full font-bold text-sm uppercase tracking-wide transition-all
      ${isLoading && loadingMode === mode ? 'animate-pulse' : ''}
    `}
  >
    {loadingMode === mode ? 'Loading...' : children}
  </button>
);

// Usage
<ModeButton
  isLoading={isLoading}
  loadingMode={loadingMode}
  mode="michelin"
  onClick={handleMichelinMode}
>
  Michelin
</ModeButton>
```

---

## 6. Loading State Management Pattern

### Code Example

```typescript
// From App.tsx - Comprehensive loading state management
const App = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingTask, setLoadingTask] = useState<string>("Concocting your masterpiece...");

  const handleStartLoading = () => {
    setIsLoading(true);
    setLoadingTask(settings.mode === 'drinks' ? "Mixing your drink..." : "Concocting your masterpiece...");
  };

  const handleStopLoading = () => {
    setIsLoading(false);
  };

  return (
    <>
      <RecipeFinder 
        onStartLoading={handleStartLoading}
        onStopLoading={handleStopLoading}
        isLoading={isLoading}
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-brand-white/50">
          <div className="w-12 h-12 border-3 border-brand-primary border-t-transparent rounded-full animate-spin mb-3"></div>
          <span className="text-xs font-semibold text-brand-black/60 uppercase tracking-wider">
            {loadingTask || 'Loading...'}
          </span>
        </div>
      )}
    </>
  );
};
```

---

## 7. Command Palette Loading State

### Code Example

```typescript
// From CommandPalette.reference.tsx
const CommandPalette = () => {
  const [isLoading, setIsLoading] = useState(false);

  // Loading state for command palette
  if (isLoading) {
    return (
      <CommandDialog open={open} onOpenChange={setOpen}>
        <div className="p-4 space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </CommandDialog>
    );
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      {/* Command palette content */}
    </CommandDialog>
  );
};
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// 1. No loading state at all
const BadComponent = () => {
  const data = useQuery(api.users.list);
  
  // This will crash if data is undefined
  return (
    <div>
      {data.map(item => <div key={item.id}>{item.name}</div>)}
    </div>
  );
};

// 2. Generic "Loading..." text without context
const BadLoadingText = () => (
  <div>Loading...</div>
);

// 3. Blocking the entire UI unnecessarily
const BadFullScreenLoading = () => {
  const [isLoading, setIsLoading] = useState(false);
  
  if (isLoading) {
    return <LoadingScreen task="Loading..." />; // Blocks everything
  }
  
  return (
    <div>
      <Header />
      <SmallComponent /> {/* Only this needs loading state */}
    </div>
  );
};

// 4. No disabled state on buttons during loading
const BadButton = ({ onClick, isLoading }: { onClick: () => void; isLoading: boolean }) => (
  <button onClick={onClick}>
    {isLoading ? 'Loading...' : 'Submit'}
  </button>
  // Missing: disabled={isLoading}
);

// 5. Inconsistent animation durations
const BadSkeleton = () => (
  <>
    <div className="animate-pulse" style={{ animationDuration: '1s' }} />
    <div className="animate-pulse" style={{ animationDuration: '3s' }} />
    <div className="animate-pulse" style={{ animationDuration: '0.5s' }} />
  </>
);
```

### ✅ Do This Instead

```typescript
// 1. Always handle loading states
const GoodComponent = () => {
  const data = useQuery(api.users.list);
  
  if (data === undefined) {
    return <SkeletonLoader />;
  }
  
  return (
    <div>
      {data.map(item => <div key={item.id}>{item.name}</div>)}
    </div>
  );
};

// 2. Provide contextual loading messages
const GoodLoadingText = () => (
  <LoadingScreen task="Fetching your recipes..." />
);

// 3. Use localized loading states
const GoodLocalizedLoading = () => {
  const [isLoading, setIsLoading] = useState(false);
  
  return (
    <div>
      <Header />
      {isLoading ? (
        <Spinner />
      ) : (
        <SmallComponent />
      )}
    </div>
  );
};

// 4. Always disable interactive elements during loading
const GoodButton = ({ onClick, isLoading }: { onClick: () => void; isLoading: boolean }) => (
  <button onClick={onClick} disabled={isLoading}>
    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
    {isLoading ? 'Processing...' : 'Submit'}
  </button>
);

// 5. Consistent animation durations (1.5s for pulse)
const GoodSkeleton = () => (
  <>
    <div className="animate-pulse" style={{ animationDuration: '1.5s' }} />
    <div className="animate-pulse" style={{ animationDuration: '1.5s' }} />
    <div className="animate-pulse" style={{ animationDuration: '1.5s' }} />
  </>
);
```

---

## When to Use This Pattern

✅ **Use for:**
- Data fetching operations (queries, mutations)
- Form submissions
- File uploads
- Image generation or processing
- Navigation between routes
- Modal/dialog content loading
- Async button actions (save, delete, upgrade)
- Initial page load
- Lazy-loaded components

❌ **Don't use for:**
- Synchronous operations
- Instant UI updates (use optimistic updates instead)
- Operations under 100ms (too fast to perceive)
- Static content that doesn't require loading

---

## Benefits

1. **User Feedback**: Users know the app is working, not frozen
2. **Perceived Performance**: Skeleton loaders make the app feel faster
3. **Context**: Task-specific messages inform users what's happening
4. **Engagement**: Loading facts/tips keep users entertained during waits
5. **Accessibility**: Proper loading states work with screen readers
6. **Error Prevention**: Disabled states prevent duplicate submissions
7. **Professional UX**: Polished loading states elevate the user experience

---

## Testing Loading States

### Code Example

```typescript
// From RecipeCostBadge.test.tsx
describe('Loading States', () => {
  it('should display loading state correctly', () => {
    render(<RecipeCostBadge isLoading={true} />);
    expect(screen.getByText('Calculating...')).toBeInTheDocument();
  });

  it('should have proper ARIA attributes for loading state', () => {
    const { container } = render(<RecipeCostBadge isLoading={true} />);
    
    // Loading state should be accessible
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('should disable button during loading', () => {
    render(<SubmitButton isLoading={true}>Submit</SubmitButton>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});
```

---

## Related Patterns

- See `empty-states.md` for handling no-data scenarios
- See `error-states.md` for error handling during loading
- See `../05-form-patterns/form-submission.md` for form loading patterns
- See `toast-notifications.md` for success/error feedback after loading
- See `../02-react-patterns/suspense-patterns.md` for React Suspense integration

---

*Extracted: 2026-02-18*
