# Card Layout Patterns

## Source
Extracted from BistroLens:
- `components/design-system/Card.tsx` (Design System Card)
- `components/MealPrepBatchingCard.tsx` (Interactive Card)
- `components/RecipeCardPDF.tsx` (Content Cards)
- `.nova/reference-components/DashboardCard.reference.tsx` (Metric Cards)

---

## Pattern: Card Layout Patterns

Cards are versatile container components that group related content and actions. BistroLens implements multiple card patterns for different use cases: design system cards with variants, interactive expandable cards, content-rich recipe cards, and metric dashboard cards with state management.

---

## 1. Design System Card (Base Pattern)

### Code Example

```typescript
/**
 * Design System Card Component
 * 
 * LOCKED CONSTRAINTS:
 * - Exactly 2 variants: elevated, flat
 * - Border radius: 16px (md)
 * - Elevated: shadow-lg
 * - Flat: border only
 */

import React, { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import {
  CardTokens,
  BorderRadiusTokens,
  SpacingTokens,
  AnimationTokens,
  type CardVariant,
} from './tokens';

export interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  /** Card style variant - LOCKED to 2 options */
  variant?: CardVariant;
  /** Card padding */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Make card interactive (clickable) */
  interactive?: boolean;
  /** Card header content */
  header?: React.ReactNode;
  /** Card footer content */
  footer?: React.ReactNode;
  /** Children */
  children: React.ReactNode;
}

/**
 * Get padding value from size
 */
function getPadding(size: 'none' | 'sm' | 'md' | 'lg'): string {
  switch (size) {
    case 'none':
      return '0';
    case 'sm':
      return SpacingTokens.sm;
    case 'md':
      return SpacingTokens.md;
    case 'lg':
      return SpacingTokens.lg;
  }
}

/**
 * Design System Card
 * 
 * A card component with exactly 2 variants (elevated, flat)
 * with consistent 16px border radius.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'elevated',
      padding = 'md',
      interactive = false,
      header,
      footer,
      children,
      className = '',
      style,
      onClick,
      ...props
    },
    ref
  ) => {
    const tokens = CardTokens[variant];
    
    const cardStyle: React.CSSProperties = {
      backgroundColor: tokens.background,
      boxShadow: tokens.shadow,
      borderRadius: tokens.borderRadius, // Always 16px
      border: tokens.border,
      overflow: 'hidden',
      cursor: interactive || onClick ? 'pointer' : 'default',
      transition: `all ${AnimationTokens.duration.normal} ${AnimationTokens.easing.default}`,
      ...style,
    };

    const contentStyle: React.CSSProperties = {
      padding: getPadding(padding),
    };

    const motionProps = interactive || onClick
      ? {
          whileHover: { scale: 1.01, boxShadow: variant === 'elevated' 
            ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            : tokens.shadow 
          },
          whileTap: { scale: 0.99 },
        }
      : {};

    return (
      <motion.div
        ref={ref}
        className={`ds-card ds-card--${variant} ${className}`}
        style={cardStyle}
        onClick={onClick}
        role={interactive || onClick ? 'button' : undefined}
        tabIndex={interactive || onClick ? 0 : undefined}
        onKeyDown={
          interactive || onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick?.(e as any);
                }
              }
            : undefined
        }
        {...motionProps}
        {...props}
      >
        {header && (
          <div 
            className="ds-card__header"
            style={{
              padding: getPadding(padding),
              borderBottom: `1px solid rgba(0, 0, 0, 0.1)`,
            }}
          >
            {header}
          </div>
        )}
        
        <div className="ds-card__content" style={contentStyle}>
          {children}
        </div>
        
        {footer && (
          <div 
            className="ds-card__footer"
            style={{
              padding: getPadding(padding),
              borderTop: `1px solid rgba(0, 0, 0, 0.1)`,
            }}
          >
            {footer}
          </div>
        )}
      </motion.div>
    );
  }
);

Card.displayName = 'Card';

/**
 * Card Header component for consistent styling
 */
export interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  action,
  children,
}) => {
  return (
    <div className="ds-card-header" style={{ 
      display: 'flex', 
      alignItems: 'flex-start', 
      justifyContent: 'space-between', 
      gap: SpacingTokens.md 
    }}>
      <div>
        <h3 style={{ 
          margin: 0, 
          fontSize: '18px', 
          fontWeight: 600, 
          color: '#111111' 
        }}>
          {title}
        </h3>
        {subtitle && (
          <p style={{ 
            margin: '4px 0 0', 
            fontSize: '14px', 
            color: 'rgba(17, 17, 17, 0.6)' 
          }}>
            {subtitle}
          </p>
        )}
        {children}
      </div>
      {action && <div className="ds-card-header__action">{action}</div>}
    </div>
  );
};

/**
 * Card Footer component for consistent styling
 */
export interface CardFooterProps {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right' | 'space-between';
}

export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  align = 'right',
}) => {
  const justifyContent = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
    'space-between': 'space-between',
  }[align];

  return (
    <div 
      className="ds-card-footer"
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent,
        gap: SpacingTokens.sm,
      }}
    >
      {children}
    </div>
  );
};
```

---

## 2. Interactive Expandable Card

### Code Example

```typescript
/**
 * MealPrepBatchingCard - Interactive Expandable Card Pattern
 * 
 * Demonstrates:
 * - Collapsible content with AnimatePresence
 * - Progress tracking
 * - Interactive task list
 * - Analytics integration
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MealPrepBatchingCardProps {
  mealPlan: MealPlan;
  onTaskChecked?: (taskId: string, checked: boolean) => void;
}

const MealPrepBatchingCard: React.FC<MealPrepBatchingCardProps> = ({
  mealPlan,
  onTaskChecked,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set());
  
  // Calculate progress
  const completedCount = checkedTasks.size;
  const totalCount = prepTasks.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  
  const handleExpand = () => {
    playClickSound();
    setIsExpanded(!isExpanded);
    
    // Track analytics on first expand
    if (!isExpanded && !hasTrackedView) {
      analyticsService.track('meal_prep_batching_viewed', {
        taskCount: prepTasks.length,
        recipeCount: recipes.length,
        timeSaved,
      });
      setHasTrackedView(true);
    }
  };
  
  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={handleExpand}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-amber-100/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <span className="text-xl">🍳</span>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Prep once, cook faster</h3>
            <p className="text-sm text-gray-600">
              {totalCount} tasks across {recipes.length} recipes
              {timeSaved > 0 && (
                <span className="text-amber-600 font-medium ml-1">
                  • Save ~{timeSaved} min
                </span>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Progress indicator */}
          {completedCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 bg-amber-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-medium text-amber-700">
                {completedCount}/{totalCount}
              </span>
            </div>
          )}
          
          {/* Expand/collapse icon */}
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            {isExpanded ? (
              <ChevronUpIcon className="w-5 h-5 text-amber-700" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-amber-700" />
            )}
          </div>
        </div>
      </button>
      
      {/* Expanded content with animation */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Task list */}
              <div className="space-y-2">
                {prepTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    isChecked={checkedTasks.has(task.id)}
                    onCheck={() => handleTaskCheck(task.id)}
                  />
                ))}
              </div>
              
              {/* Pro tip */}
              <div className="bg-white/60 rounded-xl p-3">
                <p className="text-xs text-gray-600">
                  💡 <span className="font-medium">Pro tip:</span> {prepTasks[0].tips[0]}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
```

---

## 3. Dashboard Metric Card with States

### Code Example

```typescript
/**
 * Dashboard Card with 5 UI States
 * 
 * Demonstrates:
 * - Loading state with skeletons
 * - Error state with retry
 * - Empty state
 * - Partial state (incomplete data)
 * - Populated state with sparkline
 */

import { useState, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

interface DashboardCardProps {
  title: string;
  description?: string;
  metricKey: string;
  type?: 'currency' | 'number' | 'percentage';
  icon?: React.ElementType;
  showSparkline?: boolean;
}

export function DashboardCard({
  title,
  metricKey,
  type = 'number',
  icon: Icon = Activity,
  showSparkline = true,
}: DashboardCardProps): JSX.Element {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Fetch metric data
  const metric = useQuery(api.metrics.get, { key: metricKey });
  
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsRefreshing(false);
  }, []);
  
  // Format value based on type
  const formatValue = useCallback((value: number): string => {
    switch (type) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
        }).format(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'number':
      default:
        return new Intl.NumberFormat('en-US').format(value);
    }
  }, [type]);
  
  // STATE 1: LOADING
  if (metric === undefined) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-24" />
          {showSparkline && <Skeleton className="h-10 w-full mt-4" />}
        </CardContent>
      </Card>
    );
  }
  
  // STATE 2: ERROR
  if (metric === null) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <div className="rounded-full bg-destructive/10 p-3 mb-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <p className="text-sm font-medium text-destructive">Failed to load</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={handleRefresh}
          >
            <RefreshCw className="mr-2 h-3 w-3" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  // STATE 3: EMPTY
  if (!metric.data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <div className="rounded-full bg-muted p-3 mb-3">
            <Inbox className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No data available</p>
          <p className="text-xs text-muted-foreground mt-1">
            Data will appear once available
          </p>
        </CardContent>
      </Card>
    );
  }
  
  // STATE 4 & 5: PARTIAL/POPULATED
  const data = metric.data;
  const trendColor = data.trend === 'up' 
    ? 'text-success' 
    : data.trend === 'down' 
    ? 'text-destructive' 
    : 'text-muted-foreground';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          </Button>
        </CardHeader>
        
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              {/* Main value with animation */}
              <motion.div
                className="text-2xl font-bold"
                key={data.value}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {formatValue(data.value)}
              </motion.div>
              
              {/* Trend indicator */}
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn('flex items-center gap-1', trendColor)}
                >
                  <TrendingUp className="h-3 w-3" />
                  <span>
                    {data.changePercentage >= 0 ? '+' : ''}
                    {data.changePercentage.toFixed(1)}%
                  </span>
                </Badge>
                <span className="text-xs text-muted-foreground">
                  vs last month
                </span>
              </div>
            </div>
            
            {/* Icon */}
            <div className={cn(
              'rounded-full p-3',
              data.trend === 'up' && 'bg-success/10',
              data.trend === 'down' && 'bg-destructive/10'
            )}>
              <Icon className={cn('h-5 w-5', trendColor)} />
            </div>
          </div>
          
          {/* Sparkline (if data available) */}
          {showSparkline && data.sparklineData && (
            <div className="mt-4 pt-4 border-t">
              <Sparkline
                data={data.sparklineData}
                trend={data.trend}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
```

---

## 4. Content-Rich Recipe Card

### Code Example

```typescript
/**
 * Recipe Card - Content-Rich Layout
 * 
 * Demonstrates:
 * - Hero image with gradient overlay
 * - Multi-column layout
 * - Grouped content sections
 * - Fixed dimensions for PDF export
 */

interface RecipeCardProps {
  recipe: Recipe;
  heroImage: string;
  ingredientGroups: IngredientGroup[];
}

export const RecipeCardFull: React.FC<RecipeCardProps> = ({ 
  recipe, 
  heroImage, 
  ingredientGroups 
}) => {
  // A4 dimensions at 96 DPI
  const PAGE_WIDTH = 794;
  const PAGE_HEIGHT = 1123;

  return (
    <div 
      className="font-sans text-brand-black bg-brand-white overflow-hidden relative" 
      style={{ width: `${PAGE_WIDTH}px`, height: `${PAGE_HEIGHT}px` }}
    >
      {/* Hero Section (Top 40%) */}
      <div className="h-[420px] w-full relative">
        <img 
          src={heroImage} 
          alt={recipe.title} 
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-full p-8 text-brand-white">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-brand-yellow text-brand-black px-3 py-1 rounded-sm text-xs font-bold uppercase">
              {recipe.cuisine}
            </span>
            <span className="text-sm font-bold uppercase">• {recipe.category}</span>
          </div>
          <h1 className="text-6xl font-serif font-bold leading-none mb-3">
            {recipe.title}
          </h1>
          <p className="text-brand-white/90 text-lg font-medium max-w-2xl">
            {recipe.description}
          </p>
        </div>
      </div>

      {/* Info Strip */}
      <div className="bg-brand-primary text-brand-yellow py-5 px-10 flex justify-between items-center">
        <div className="flex gap-12">
          <div className="flex items-center gap-3">
            <ClockIcon className="w-6 h-6"/>
            <div>
              <p className="text-[9px] uppercase font-bold tracking-widest opacity-80">Time</p>
              <p className="font-bold text-lg">{recipe.cookTime}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <BarChartIcon className="w-6 h-6"/>
            <div>
              <p className="text-[9px] uppercase font-bold tracking-widest opacity-80">Difficulty</p>
              <p className="font-bold text-lg">{recipe.difficulty}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Two Column Layout */}
      <div className="flex flex-1 p-10 gap-10 bg-brand-white">
        {/* Left Col: Ingredients (35%) */}
        <div className="w-[35%] flex flex-col border-r border-brand-yellow/20 pr-10">
          <h3 className="font-serif font-bold text-3xl text-brand-primary mb-6 border-b-2 border-brand-primary pb-2">
            Ingredients
          </h3>
          
          <div className="space-y-6 flex-1">
            {ingredientGroups.map((group, idx) => (
              <div key={idx}>
                {group.title && (
                  <h4 className="font-bold text-brand-yellow text-xs uppercase tracking-wider mb-3">
                    {group.title}
                  </h4>
                )}
                <ul className="space-y-2.5">
                  {group.ingredients.map((ing, i) => (
                    <li key={i} className="text-sm border-b border-gray-100 pb-1 flex justify-between">
                      <span className="text-brand-black font-medium">{ing.name}</span>
                      <span className="font-bold text-brand-primary text-xs">{ing.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Instructions (65%) */}
        <div className="flex-1 flex flex-col">
          <h3 className="font-serif font-bold text-3xl text-brand-primary mb-6 border-b-2 border-brand-primary pb-2">
            Instructions
          </h3>
          
          <div className="space-y-5 flex-1">
            {recipe.steps.map((step, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex-none flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-brand-primary text-brand-yellow flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  {index !== recipe.steps.length - 1 && (
                    <div className="w-px h-full bg-brand-yellow/30 my-1" />
                  )}
                </div>
                <div className="pb-4 w-full">
                  <p className="text-base text-brand-black font-medium leading-relaxed">
                    {step.instruction}
                  </p>
                  {step.tip && (
                    <div className="bg-brand-white/60 p-3 mt-2 rounded-lg border-l-4 border-brand-yellow">
                      <p className="text-xs text-[#5C4B3E] italic">
                        <span className="font-bold text-brand-yellow uppercase text-[9px] not-italic">
                          Chef Tip:
                        </span>
                        {step.tip}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// ❌ BAD: Inconsistent border radius
<div className="rounded-sm">  // 2px
  <Card className="rounded-xl" />  // 12px
</div>

// ❌ BAD: No loading state
function MetricCard() {
  const data = useQuery(api.metrics.get);
  return <div>{data.value}</div>; // Crashes if data is undefined
}

// ❌ BAD: Non-interactive card without proper semantics
<div onClick={handleClick} className="card">
  Click me
</div>

// ❌ BAD: Hardcoded padding instead of using design tokens
<Card style={{ padding: '20px' }}>
  Content
</Card>

// ❌ BAD: Missing error boundary for card content
<Card>
  {data.map(item => <ComplexComponent item={item} />)}
</Card>

// ❌ BAD: Expandable card without animation
{isExpanded && (
  <div>Content appears instantly</div>
)}
```

### ✅ Do This Instead

```typescript
// ✅ GOOD: Consistent border radius using design tokens
<div className="rounded-2xl">  // 16px
  <Card variant="elevated" />  // Also 16px
</div>

// ✅ GOOD: Handle all 5 UI states
function MetricCard() {
  const data = useQuery(api.metrics.get);
  
  if (data === undefined) return <LoadingCard />;
  if (data === null) return <ErrorCard />;
  if (!data.value) return <EmptyCard />;
  
  return <PopulatedCard data={data} />;
}

// ✅ GOOD: Interactive card with proper accessibility
<Card 
  interactive 
  onClick={handleClick}
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  Click me
</Card>

// ✅ GOOD: Use design tokens for spacing
<Card padding="md">
  Content
</Card>

// ✅ GOOD: Wrap card content in error boundary
<Card>
  <ErrorBoundary fallback={<ErrorState />}>
    {data.map(item => <ComplexComponent item={item} />)}
  </ErrorBoundary>
</Card>

// ✅ GOOD: Smooth animation for expandable content
<AnimatePresence>
  {isExpanded && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      Content
    </motion.div>
  )}
</AnimatePresence>
```

---

## When to Use This Pattern

✅ **Use card layouts for:**
- Grouping related content and actions
- Dashboard metrics and statistics
- Content previews (articles, recipes, products)
- Interactive expandable sections
- Form containers with header/footer
- List items with rich content
- Settings panels
- Feature highlights

❌ **Don't use cards for:**
- Simple text paragraphs (use regular divs)
- Full-page layouts (use proper layout components)
- Navigation menus (use nav components)
- Inline content within paragraphs
- Single buttons or links (too much visual weight)

---

## Benefits

1. **Visual Hierarchy**: Cards create clear content boundaries and improve scannability
2. **Reusability**: Consistent card patterns reduce code duplication
3. **Accessibility**: Built-in keyboard navigation and ARIA roles for interactive cards
4. **Responsive**: Cards naturally adapt to different screen sizes
5. **State Management**: Clear patterns for loading, error, empty, and populated states
6. **Animation**: Smooth transitions enhance user experience
7. **Flexibility**: Support for headers, footers, and custom content
8. **Design Consistency**: Locked variants (elevated/flat) ensure visual consistency

---

## Related Patterns

- See `loading-states.md` for skeleton loading patterns
- See `empty-states.md` for empty state design
- See `error-states.md` for error handling in cards
- See `button-variants.md` for card action buttons
- See `modal-dialog.md` for card-based modal layouts

---

*Extracted: 2026-02-18*
