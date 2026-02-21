# Date Formatting Utilities

## Source
Extracted from BistroLens:
- `services/reverseSchedulingService.ts`
- `services/mealPlanService.ts`
- `components/SecurityDashboard.tsx`
- `components/SmartNotificationCenter.tsx`
- Various component files

---

## Pattern: Date Formatting Utilities

Date formatting utilities provide consistent, user-friendly date and time displays across the application. These utilities handle relative time formatting ("5m ago"), absolute date formatting, duration calculations, and date manipulations for scheduling and planning features.

---

## Core Formatting Functions

### Relative Time Formatting (Time Ago)

```typescript
/**
 * Format timestamp as relative time (e.g., "5m ago", "2h ago")
 * Used for notifications, activity feeds, and recent events
 */
function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

// Usage in components
<p className="text-sm text-gray-500">
  {formatTimestamp(notification.timestamp)}
</p>
```

### Time of Day Formatting

```typescript
/**
 * Format time for display in 12-hour format
 * Used for scheduling, meal planning, and time-based features
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Usage
const startTime = new Date();
console.log(formatTime(startTime)); // "2:30 PM"
```

### Duration Formatting

```typescript
/**
 * Format duration in minutes to human-readable format
 * Handles hours and minutes display
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

// Usage
console.log(formatDuration(45));   // "45 min"
console.log(formatDuration(90));   // "1h 30m"
console.log(formatDuration(120));  // "2h"
```

---

## Date Calculations

### Get Next Monday

```typescript
/**
 * Get the start date for a new plan (next Monday)
 * Used for meal planning and weekly schedules
 */
function getNextMondayDate(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  return nextMonday.toISOString().split('T')[0];
}

// Usage
const startDate = getNextMondayDate(); // "2024-02-19"
```

### Shift Dates Forward

```typescript
/**
 * Shift plan dates forward by specified number of days
 * Used for rescheduling and date adjustments
 */
function shiftPlanDates(startDate: string, daysToShift: number = 7): string {
  const currentStart = new Date(startDate);
  currentStart.setDate(currentStart.getDate() + daysToShift);
  return currentStart.toISOString().split('T')[0];
}

// Usage
const newDate = shiftPlanDates('2024-02-19', 7); // "2024-02-26"
```

### Check if Date is Today

```typescript
/**
 * Check if a day name matches today
 * Used for highlighting current day in planners
 */
const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;

// Usage in components
<div className={isToday ? 'bg-blue-50 border-blue-500' : 'bg-white'}>
  {day}
</div>
```

---

## ISO Date Formatting

### ISO String for Storage

```typescript
/**
 * Store dates as ISO strings for consistency
 * Used for database storage and API communication
 */
interface SavedMealPlan {
  id: string;
  name: string;
  startDate: string;        // ISO date string (YYYY-MM-DD)
  createdAt: number;        // Unix timestamp
  updatedAt: number;        // Unix timestamp
}

// Creating ISO date strings
const plan = {
  id: generateId(),
  name: `Week of ${new Date().toLocaleDateString()}`,
  startDate: new Date().toISOString().split('T')[0], // "2024-02-19"
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
```

### Parse ISO Dates

```typescript
/**
 * Parse ISO date strings back to Date objects
 * Used when reading from storage or API
 */
const startDate = new Date(plan.startDate);
const dayOfWeek = startDate.getDay(); // 0-6 (Sunday-Saturday)
```

---

## Display Formatting

### Simple Date Display

```typescript
/**
 * Display dates in user's locale format
 * Used throughout the UI for date displays
 */
// Basic date display
<div className="text-sm text-gray-500">
  {new Date(user.createdAt).toLocaleDateString()}
</div>

// With time
<p className="text-xs text-gray-600">
  {new Date(notification.timestamp).toLocaleDateString()} at{' '}
  {new Date(notification.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })}
</p>
```

### Formatted Date with Options

```typescript
/**
 * Format dates with specific locale options
 * Provides more control over date display
 */
const formattedDate = new Date(entry.date).toLocaleDateString(undefined, {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});
// "February 19, 2024"
```

---

## Time Parsing

### Parse Time Strings

```typescript
/**
 * Parse time strings like "30 minutes" or "1 hour 15 minutes"
 * Used for recipe timing and duration inputs
 */
function parseTimeString(timeStr: string): number {
  if (!timeStr) return 0;
  
  let totalMinutes = 0;
  const str = timeStr.toLowerCase();
  
  // Match hours
  const hourMatch = str.match(/(\d+)\s*(hour|hr)/);
  if (hourMatch) {
    totalMinutes += parseInt(hourMatch[1]) * 60;
  }
  
  // Match minutes
  const minMatch = str.match(/(\d+)\s*(minute|min)/);
  if (minMatch) {
    totalMinutes += parseInt(minMatch[1]);
  }
  
  // If no match, try to parse as just a number
  if (totalMinutes === 0) {
    const numMatch = str.match(/(\d+)/);
    if (numMatch) {
      totalMinutes = parseInt(numMatch[1]);
    }
  }
  
  return totalMinutes;
}

// Usage
console.log(parseTimeString("1 hour 30 minutes")); // 90
console.log(parseTimeString("45 min"));            // 45
console.log(parseTimeString("2 hours"));           // 120
```

---

## Schedule Summary Formatting

### Combined Time Display

```typescript
/**
 * Get schedule summary with formatted times
 * Combines multiple formatting utilities
 */
export function getScheduleSummary(schedule: {
  startTime: Date;
  servingTime: Date;
  totalDuration: number;
}): string {
  const startFormatted = formatTime(schedule.startTime);
  const serveFormatted = formatTime(schedule.servingTime);
  const duration = formatDuration(schedule.totalDuration);
  
  return `Start at ${startFormatted} to serve by ${serveFormatted} (${duration} total)`;
}

// Usage
const summary = getScheduleSummary({
  startTime: new Date('2024-02-19T16:30:00'),
  servingTime: new Date('2024-02-19T18:00:00'),
  totalDuration: 90
});
// "Start at 4:30 PM to serve by 6:00 PM (1h 30m total)"
```

---

## Anti-Patterns

### ❌ Don't Use String Concatenation for Dates

```typescript
// Bad: Inconsistent formatting, locale issues
const dateStr = `${month}/${day}/${year}`;
const timeStr = `${hour}:${minute}`;
```

### ✅ Use Built-in Locale Methods

```typescript
// Good: Consistent, locale-aware formatting
const dateStr = new Date().toLocaleDateString();
const timeStr = new Date().toLocaleTimeString();
```

### ❌ Don't Store Dates as Formatted Strings

```typescript
// Bad: Hard to sort, compare, or manipulate
const plan = {
  createdAt: "Feb 19, 2024 at 2:30 PM"
};
```

### ✅ Store as ISO Strings or Timestamps

```typescript
// Good: Easy to sort, compare, and manipulate
const plan = {
  createdAt: Date.now(),                           // Unix timestamp
  startDate: new Date().toISOString().split('T')[0] // ISO date
};
```

### ❌ Don't Hardcode Time Calculations

```typescript
// Bad: Magic numbers, unclear intent
const yesterday = Date.now() - 86400000;
```

### ✅ Use Clear Time Constants

```typescript
// Good: Self-documenting, maintainable
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const yesterday = Date.now() - MILLISECONDS_PER_DAY;

// Or use descriptive calculations
const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
```

### ❌ Don't Ignore Timezones

```typescript
// Bad: Assumes local timezone
const date = new Date('2024-02-19');
```

### ✅ Be Explicit About Timezones

```typescript
// Good: Use ISO strings or be explicit
const date = new Date('2024-02-19T00:00:00Z'); // UTC
const localDate = new Date('2024-02-19T00:00:00'); // Local
```

---

## When to Use This Pattern

✅ **Use for:**
- Displaying timestamps in activity feeds and notifications
- Showing relative time ("5 minutes ago")
- Formatting dates for user display
- Calculating date ranges for schedules
- Parsing user-entered time strings
- Storing dates in a consistent format
- Scheduling and calendar features

❌ **Don't use for:**
- Complex timezone conversions (use a library like date-fns or luxon)
- Date arithmetic across DST boundaries (use a library)
- Internationalization beyond basic locale support (use i18n library)
- Recurring date patterns (use a specialized library)

---

## Benefits

1. **Consistency**: Uniform date formatting across the entire application
2. **User-Friendly**: Relative time makes timestamps more intuitive
3. **Maintainability**: Centralized formatting logic is easier to update
4. **Locale Support**: Built-in methods respect user's locale settings
5. **Type Safety**: TypeScript types ensure correct usage
6. **Performance**: Native Date methods are fast and efficient
7. **Readability**: Named functions make code self-documenting

---

## Related Patterns

- See `string-utilities.md` for text formatting helpers
- See `number-formatting.md` for numeric display formatting
- See `validation-helpers.md` for date validation
- See `useLocalStorage.md` for persisting date preferences

---

*Extracted: 2026-02-18*
