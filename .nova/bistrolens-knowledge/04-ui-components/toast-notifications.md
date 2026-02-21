# Toast Notification Patterns

## Source
Extracted from BistroLens:
- `components/Toast.tsx` - Simple toast with action button
- `components/AchievementToast.tsx` - Achievement, level-up, and XP toasts
- `components/SmartNotificationCenter.tsx` - Smart notification system with toast display

---

## Pattern 1: Simple Toast with Action Button

A minimal toast notification with optional action button (e.g., "Undo") and auto-dismiss with sound feedback.

### Implementation

```typescript
import React, { useEffect } from 'react';
import { playSuccessSound } from '../utils/sound';

interface ToastProps {
  message: string;
  onClose: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, onClose, actionLabel, onAction }) => {
  useEffect(() => {
    playSuccessSound();
    
    // Auto-close after 4 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div 
      className="fixed bottom-5 right-5 z-[60] flex items-center gap-4 bg-brand-black text-brand-white px-4 py-3 rounded-lg shadow-2xl animate-in slide-in-from-bottom-5 fade-in-25 border border-brand-white/10"
      role="alert"
    >
      <p className="text-sm font-semibold">{message}</p>
      {actionLabel && onAction && (
        <button 
          onClick={() => { onAction(); onClose(); }} 
          className="text-sm font-bold text-brand-primary hover:text-brand-accent uppercase tracking-wide transition-colors border-l border-white/20 pl-4"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default Toast;
```

### Usage

```typescript
// Simple success message
<Toast 
  message="Recipe saved!" 
  onClose={() => setToast(null)} 
/>

// With undo action
<Toast 
  message="Recipe deleted" 
  actionLabel="UNDO"
  onAction={handleUndo}
  onClose={() => setToast(null)} 
/>
```

---

## Pattern 2: Achievement Toast with Rarity System

Animated achievement notifications with rarity-based styling, sparkle effects, and reward display.

### Type Definitions

```typescript
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  category: string;
  reward?: {
    type: 'title' | 'xp_bonus' | 'unlock';
    value: string | number;
  };
}

interface AchievementToastProps {
  achievement: Achievement;
  onDismiss: () => void;
  autoHide?: boolean;
  autoHideDelay?: number;
}
```

### Implementation

```typescript
const AchievementToast: React.FC<AchievementToastProps> = ({
  achievement,
  onDismiss,
  autoHide = true,
  autoHideDelay = 5000
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  
  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setIsVisible(true));
    
    // Auto-hide
    if (autoHide) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoHideDelay);
      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideDelay]);
  
  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      markAchievementNotified(achievement.id);
      onDismiss();
    }, 300);
  }, [achievement.id, onDismiss]);
  
  // Rarity-based gradient backgrounds
  const rarityGradients: Record<Achievement['rarity'], string> = {
    common: 'from-gray-400 to-gray-500',
    uncommon: 'from-green-400 to-green-600',
    rare: 'from-blue-400 to-blue-600',
    epic: 'from-purple-400 to-purple-600',
    legendary: 'from-amber-400 via-orange-500 to-red-500'
  };
  
  return (
    <div 
      className={`fixed top-4 right-4 z-[9999] transition-all duration-300 ${
        isVisible && !isExiting 
          ? 'translate-x-0 opacity-100' 
          : 'translate-x-full opacity-0'
      }`}
    >
      <div className="relative overflow-hidden rounded-2xl shadow-2xl max-w-sm">
        {/* Animated background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${rarityGradients[achievement.rarity]} opacity-90`} />
        
        {/* Sparkle effects for legendary */}
        {achievement.rarity === 'legendary' && (
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div 
                key={i}
                className="absolute w-1 h-1 bg-brand-white rounded-full animate-ping"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: '1.5s'
                }}
              />
            ))}
          </div>
        )}
        
        {/* Content */}
        <div className="relative p-4 text-brand-white">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider opacity-80">
                🏆 Achievement Unlocked!
              </span>
            </div>
            <button 
              onClick={handleDismiss}
              className="p-1 hover:bg-brand-white/20 rounded-full transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Achievement Info */}
          <div className="flex items-center gap-4">
            <div className="text-5xl animate-bounce">
              {achievement.icon}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold">{achievement.name}</h3>
              <p className="text-sm opacity-90 mt-0.5">{achievement.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-brand-white/20 capitalize">
                  {achievement.rarity}
                </span>
                <span className="text-xs opacity-75">
                  {achievement.category}
                </span>
              </div>
            </div>
          </div>
          
          {/* Reward */}
          {achievement.reward && (
            <div className="mt-3 pt-3 border-t border-white/20">
              <div className="flex items-center gap-2 text-sm">
                <span>🎁</span>
                <span>
                  {achievement.reward.type === 'title' 
                    ? `New Title: "${achievement.reward.value}"`
                    : achievement.reward.type === 'xp_bonus'
                    ? `+${achievement.reward.value} Bonus XP`
                    : `Unlocked: ${achievement.reward.value}`
                  }
                </span>
              </div>
            </div>
          )}
        </div>
        
        {/* Progress bar for auto-hide */}
        {autoHide && (
          <div className="h-1 bg-brand-white/20">
            <div 
              className="h-full bg-brand-white/50 transition-all ease-linear"
              style={{ 
                width: '100%',
                animation: `shrink ${autoHideDelay}ms linear forwards`
              }}
            />
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};
```

---

## Pattern 3: Achievement Toast Manager with Queue

Manages multiple achievement notifications, showing them one at a time from a queue.

```typescript
export const AchievementToastManager: React.FC = () => {
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [current, setCurrent] = useState<Achievement | null>(null);
  
  // Check for unnotified achievements on mount and periodically
  useEffect(() => {
    const checkAchievements = () => {
      const unnotified = getUnnotifiedAchievements();
      if (unnotified.length > 0) {
        setQueue(prev => {
          const newAchievements = unnotified.filter(
            a => !prev.some(p => p.id === a.id) && a.id !== current?.id
          );
          return [...prev, ...newAchievements];
        });
      }
    };
    
    checkAchievements();
    const interval = setInterval(checkAchievements, 2000);
    return () => clearInterval(interval);
  }, [current]);
  
  // Show next achievement from queue
  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue(prev => prev.slice(1));
    }
  }, [current, queue]);
  
  const handleDismiss = useCallback(() => {
    setCurrent(null);
  }, []);
  
  if (!current) return null;
  
  return (
    <AchievementToast 
      achievement={current}
      onDismiss={handleDismiss}
    />
  );
};
```

---

## Pattern 4: Level Up Toast

Compact notification for skill level increases.

```typescript
interface LevelUpToastProps {
  skillName: string;
  skillIcon: string;
  oldLevel: string;
  newLevel: string;
  onDismiss: () => void;
}

export const LevelUpToast: React.FC<LevelUpToastProps> = ({
  skillName,
  skillIcon,
  oldLevel,
  newLevel,
  onDismiss
}) => {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);
  
  return (
    <div 
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
    >
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-brand-white rounded-xl shadow-xl px-6 py-3 flex items-center gap-4">
        <div className="text-3xl animate-bounce">{skillIcon}</div>
        <div>
          <div className="text-sm opacity-90">Level Up!</div>
          <div className="font-bold">{skillName}</div>
          <div className="text-xs opacity-75">
            {oldLevel} → <span className="text-yellow-300">{newLevel}</span>
          </div>
        </div>
        <div className="text-2xl">🎉</div>
      </div>
    </div>
  );
};
```

---

## Pattern 5: XP Gain Toast

Quick, minimal notification for XP earned.

```typescript
interface XPGainToastProps {
  amount: number;
  skillName?: string;
  onDismiss: () => void;
}

export const XPGainToast: React.FC<XPGainToastProps> = ({
  amount,
  skillName,
  onDismiss
}) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2000);
    return () => clearTimeout(timer);
  }, [onDismiss]);
  
  return (
    <div className="fixed bottom-20 right-4 z-[9998] animate-bounce-in">
      <div className="bg-green-500 text-brand-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-2">
        <span>⚡</span>
        <span className="font-bold">+{amount} XP</span>
        {skillName && <span className="text-sm opacity-90">({skillName})</span>}
      </div>
      
      <style>{`
        @keyframes bounce-in {
          0% { transform: scale(0.5) translateY(20px); opacity: 0; }
          50% { transform: scale(1.1) translateY(-5px); }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .animate-bounce-in {
          animation: bounce-in 0.4s ease-out;
        }
      `}</style>
    </div>
  );
};
```

---

## Pattern 6: Smart Notification System with Event Dispatch

Global notification system with custom event dispatching and toast display.

### Type Definitions

```typescript
export interface Notification {
  id: string;
  type: 'meal-suggestion' | 'badge' | 'streak' | 'community' | 'reminder' | 'system';
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
  icon?: string;
  timestamp: number;
  read: boolean;
  priority?: 'low' | 'normal' | 'high';
}
```

### Implementation

```typescript
const SmartNotificationCenter: React.FC<SmartNotificationCenterProps> = ({
  userId,
  onNotificationClick,
  onClose,
  maxVisible = 5,
  position = 'top-right'
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toastNotification, setToastNotification] = useState<Notification | null>(null);

  // Notification type icons and colors
  const TYPE_ICONS: Record<string, string> = {
    'meal-suggestion': '🍽️',
    'badge': '🏆',
    'streak': '🔥',
    'community': '👥',
    'reminder': '⏰',
    'system': '📢'
  };

  const TYPE_COLORS: Record<string, string> = {
    'meal-suggestion': '#E81B27',
    'badge': '#F59E0B',
    'streak': '#EF4444',
    'community': '#3B82F6',
    'reminder': '#8B5CF6',
    'system': '#6B7280'
  };

  // Listen for new notifications
  useEffect(() => {
    const handleNewNotification = (event: CustomEvent<Notification>) => {
      const newNotification = {
        ...event.detail,
        id: event.detail.id || `notif_${Date.now()}`,
        timestamp: event.detail.timestamp || Date.now(),
        read: false
      };

      setNotifications(prev => [newNotification, ...prev].slice(0, 50));
      setToastNotification(newNotification);

      // Auto-hide toast after 5 seconds
      setTimeout(() => {
        setToastNotification(null);
      }, 5000);
    };

    window.addEventListener('smartNotification', handleNewNotification as EventListener);
    return () => {
      window.removeEventListener('smartNotification', handleNewNotification as EventListener);
    };
  }, []);

  // Format timestamp
  const formatTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <AnimatePresence>
      {toastNotification && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          className={`fixed top-4 right-4 z-50 max-w-sm`}
        >
          <div
            className="bg-brand-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden cursor-pointer"
            onClick={() => {
              handleClick(toastNotification);
              setToastNotification(null);
            }}
          >
            <div 
              className="h-1"
              style={{ backgroundColor: TYPE_COLORS[toastNotification.type] }}
            />
            <div className="p-4 flex items-start gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                style={{ backgroundColor: `${TYPE_COLORS[toastNotification.type]}20` }}
              >
                {toastNotification.icon || TYPE_ICONS[toastNotification.type]}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 truncate">
                  {toastNotification.title}
                </h4>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {toastNotification.body}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setToastNotification(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Helper function to dispatch notifications
export const dispatchNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
  const event = new CustomEvent('smartNotification', {
    detail: {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      read: false
    }
  });
  window.dispatchEvent(event);
};
```

### Usage

```typescript
// Dispatch a notification from anywhere in the app
dispatchNotification({
  type: 'meal-suggestion',
  title: 'Dinner Idea',
  body: 'Try our new pasta recipe tonight!',
  actionUrl: '/recipes/pasta-carbonara'
});

// Badge notification
dispatchNotification({
  type: 'badge',
  title: 'Achievement Unlocked!',
  body: 'You earned the "Master Chef" badge',
  priority: 'high'
});
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Blocking the UI with alerts
alert('Changes saved!'); // Blocks user interaction

// No auto-dismiss
<Toast message="Success" /> // Stays forever, clutters UI

// Missing severity/type distinction
<Toast message="Error occurred" /> // No visual distinction between success/error

// No stacking support - overlapping toasts
<div className="fixed top-4 right-4">
  {toasts.map(t => <Toast key={t.id} {...t} />)}
</div>

// Missing accessibility
<div className="toast">
  {/* No role="alert", aria-live */}
  <p>{message}</p>
</div>

// Hardcoded durations for all types
const DURATION = 3000; // Same for all toast types

// No sound feedback
// Silent notifications miss opportunity for engagement

// No queue management
// Multiple achievements show simultaneously, overlapping
```

### ✅ Do This Instead

```typescript
// Non-blocking notifications
<Toast message="Changes saved!" onClose={handleClose} />

// Auto-dismiss with appropriate durations
<Toast message="Saved" onClose={handleClose} /> // 4s default
<AchievementToast autoHideDelay={5000} /> // 5s for achievements
<XPGainToast /> // 2s for quick feedback

// Clear type distinction with visual styling
<Toast message="Success" /> // Green gradient
<AchievementToast rarity="legendary" /> // Gold gradient with sparkles
<LevelUpToast /> // Green gradient

// Proper stacking with queue management
<AchievementToastManager /> // Shows one at a time from queue

// Full accessibility
<div
  role="alert"
  aria-live="polite"
  className="toast"
>
  {content}
</div>

// Type-specific durations
const durations = {
  simple: 4000,
  achievement: 5000,
  levelUp: 4000,
  xpGain: 2000,
  smart: 5000
};

// Sound feedback for engagement
useEffect(() => {
  playSuccessSound();
}, []);

// Queue management for multiple notifications
const [queue, setQueue] = useState<Achievement[]>([]);
const [current, setCurrent] = useState<Achievement | null>(null);
```

---

## When to Use This Pattern

✅ **Use for:**
- **Simple Toast**: Success confirmations (save, delete, update), quick feedback with optional undo
- **Achievement Toast**: Unlocking achievements, earning badges, completing challenges
- **Level Up Toast**: Skill progression, tier upgrades, milestone celebrations
- **XP Gain Toast**: Quick XP feedback, micro-interactions, progress indicators
- **Smart Notifications**: System messages, meal suggestions, reminders, community updates
- Non-critical feedback that doesn't require immediate action
- Temporary status updates
- Gamification feedback (achievements, XP, levels)

❌ **Don't use for:**
- Critical errors requiring user action (use Modal)
- Form validation errors (use inline errors)
- Permanent status indicators (use Badge or Status)
- Complex interactions requiring multiple steps (use Modal or Drawer)
- Long-form content or detailed information (use Modal)
- Blocking operations that need user confirmation (use Dialog)

---

## Benefits

1. **Multiple Toast Types**: Simple, achievement, level-up, XP gain, and smart notifications
2. **Auto-Dismiss**: Configurable duration with visual progress bars
3. **Sound Feedback**: Audio cues for engagement (success sounds)
4. **Action Buttons**: Support for undo, retry, or custom actions
5. **Rarity System**: Visual distinction for achievement importance (common to legendary)
6. **Sparkle Effects**: Animated effects for legendary achievements
7. **Queue Management**: Multiple toasts show one at a time without overlap
8. **Event-Based**: Global notification system with custom event dispatching
9. **Accessibility**: Proper ARIA attributes and screen reader support
10. **Positioning**: Configurable position (top/bottom, left/right/center)
11. **Smooth Animations**: Framer Motion for enter/exit animations
12. **Type-Safe**: Full TypeScript support with proper interfaces
13. **Reward Display**: Shows achievement rewards (titles, XP bonuses, unlocks)
14. **Relative Timestamps**: Human-readable time formatting (e.g., "2m ago")
15. **Pause on Hover**: Prevents dismissal while user is reading (for smart notifications)

---

## Related Patterns

- See `modal-dialog.md` for blocking notifications requiring user action
- See `error-states.md` for inline error displays
- See `loading-states.md` for loading indicators
- See `form-components.md` for form validation feedback
- See `../09-hooks/use-toast.md` for toast hook implementation (if extracted)

---

*Extracted: 2026-02-18*
