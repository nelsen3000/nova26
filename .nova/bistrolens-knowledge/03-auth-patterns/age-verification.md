# Age Verification Pattern

## Source
Extracted from BistroLens `.kiro/steering/39-AUTHENTICATION-AUTHORIZATION.md` (Section 5), `services/ageGateService.ts`, `services/freemiumService.ts`, and `utils/imageGovernance.ts`

---

## Pattern: Age Verification for Alcohol Content

Age verification is a critical compliance pattern that ensures users meet legal drinking age requirements before accessing alcohol-related content. This pattern implements regional age checks, secure storage, and fail-safe defaults.

**Core Principle**: If age is unknown → treat as underage. No exceptions.

---

## Legal Requirements by Region

| Region | Drinking Age | Verification Required |
|--------|--------------|----------------------|
| US | 21 | Yes |
| UK, AU, DE, FR | 18 | Yes |
| CA | 19 | Yes |
| JP | 20 | Yes |
| Default | 21 | Yes (strictest) |

---

## Age Verification Flow

```
1. User attempts to access spirited content
2. Check if age already verified
3. If not, show age gate modal
4. Collect: birthDate, country
5. Calculate age based on country's drinking age
6. Store verification (encrypted in production)
7. Grant or deny access
```

---

## Implementation

### 1. Age Verification Interface

```typescript
// Core age verification data structure
interface AgeVerification {
  birthDate: string;        // ISO date string
  country: string;          // Country code (e.g., 'US', 'UK')
  isVerified: boolean;      // Verification status
  verifiedAt?: string;      // Timestamp of verification
}

// Regional drinking ages
const DRINKING_AGE_BY_REGION: Record<string, number> = {
  US: 21,
  UK: 18,
  AU: 18,
  DE: 18,
  FR: 18,
  CA: 19,
  JP: 20,
  default: 21  // Strictest common age
};
```

### 2. Age Verification Service

```typescript
// services/ageVerificationService.ts
const AGE_VERIFICATION_KEY = 'bistro_age_verification';

export const ageVerificationService = {
  /**
   * Get the drinking age for a specific country
   */
  getDrinkingAge(countryCode: string): number {
    return DRINKING_AGE_BY_REGION[countryCode.toUpperCase()] 
      || DRINKING_AGE_BY_REGION.default;
  },

  /**
   * Calculate age from birth date
   * Accounts for birthday not yet occurred this year
   */
  calculateAge(birthDate: string): number {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    // Adjust if birthday hasn't occurred yet this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  },

  /**
   * Check if user is of legal drinking age
   */
  isOfDrinkingAge(birthDate: string, countryCode: string = 'US'): boolean {
    const age = this.calculateAge(birthDate);
    const drinkingAge = this.getDrinkingAge(countryCode);
    return age >= drinkingAge;
  },

  /**
   * Save age verification to storage
   * In production: encrypt birthDate before storage
   */
  saveVerification(birthDate: string, country: string): void {
    const verification: AgeVerification = {
      birthDate,
      verifiedAt: new Date().toISOString(),
      country,
      isVerified: true
    };
    localStorage.setItem(AGE_VERIFICATION_KEY, JSON.stringify(verification));
  },

  /**
   * Get stored age verification
   */
  getVerification(): AgeVerification | null {
    const stored = localStorage.getItem(AGE_VERIFICATION_KEY);
    if (!stored) return null;
    
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },

  /**
   * Check if user can access alcohol content
   * Main entry point for age checks
   */
  canAccessAlcoholContent(): boolean {
    const verification = this.getVerification();
    if (!verification || !verification.isVerified) return false;
    
    return this.isOfDrinkingAge(verification.birthDate, verification.country);
  },

  /**
   * Clear age verification (for logout or testing)
   */
  clearVerification(): void {
    localStorage.removeItem(AGE_VERIFICATION_KEY);
  }
};
```

### 3. Server-Side Age Gate Enforcement

```typescript
// services/ageGateService.ts
class AgeGateService {
  /**
   * Check if a user meets the drinking age for their region.
   * Returns false if age is unknown or unverified.
   * 
   * CRITICAL: Always returns false for safety if data is missing
   */
  checkDrinkingAge(userAge: UserAge | null | undefined, region?: string): boolean {
    // If no age data, treat as underage
    if (!userAge) {
      return false;
    }
    
    // If age is not verified, treat as underage
    if (!userAge.isVerified) {
      return false;
    }
    
    // Calculate age
    const age = this.calculateAge(userAge.birthDate);
    
    // Get drinking age for region
    const country = region || userAge.country || 'default';
    const drinkingAge = this.getDrinkingAge(country);
    
    return age >= drinkingAge;
  }
  
  /**
   * Get the legal drinking age for a country.
   * Defaults to 21 (strictest common age) if unknown.
   */
  getDrinkingAge(country: string): number {
    const upperCountry = country.toUpperCase();
    return DRINKING_AGE_BY_COUNTRY[upperCountry] || DRINKING_AGE_BY_COUNTRY['default'];
  }
  
  /**
   * Calculate age from birth date.
   */
  calculateAge(birthDate: Date): number {
    const today = new Date();
    const birth = new Date(birthDate);
    
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }
  
  /**
   * Validate that a drink image request is appropriate for the user.
   */
  validateDrinkRequest(
    prompt: string, 
    userAge: UserAge | null | undefined,
    requestedClassification?: AlcoholClassification
  ): { 
    allowed: boolean; 
    classification: AlcoholClassification; 
    reason?: string;
  } {
    // Classify the drink
    const detectedClassification = this.classifyDrink(prompt);
    const classification = requestedClassification || detectedClassification;
    
    // If not a drink or zero-proof, always allowed
    if (classification === 'none' || classification === 'zero_proof') {
      return { allowed: true, classification };
    }
    
    // For spirited content, check age
    if (classification === 'spirited') {
      const isOfAge = this.checkDrinkingAge(userAge);
      
      if (!isOfAge) {
        return {
          allowed: false,
          classification,
          reason: userAge 
            ? `User age (${this.calculateAge(userAge.birthDate)}) below drinking age for ${userAge.country || 'unknown region'}`
            : 'User age not verified',
        };
      }
      
      return { allowed: true, classification };
    }
    
    // Default to blocking for unknown cases
    return { 
      allowed: false, 
      classification: 'none',
      reason: 'Unknown classification',
    };
  }
}

export const ageGateService = new AgeGateService();
```

### 4. Convex Mutation with Age Check

```typescript
// convex/recipes.ts
export const generateRecipe = mutation({
  args: { 
    prompt: v.string(),
    drinkMode: v.union(v.literal("zero_proof"), v.literal("spirited"))
  },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx);
    
    // Check age verification for spirited content
    if (args.drinkMode === "spirited") {
      await requireAgeVerification(ctx);
    }
    
    // Proceed with generation...
  },
});

/**
 * Require age verification for spirited content
 * Throws error if user is not verified or underage
 */
export async function requireAgeVerification(
  ctx: QueryCtx | MutationCtx
) {
  const { user } = await requireAuth(ctx);
  
  const verification = await ctx.db
    .query("ageVerifications")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();
  
  if (!verification || !verification.isOfAge) {
    throw new Error("Age verification required for spirited content");
  }
  
  return verification;
}
```

### 5. React Component Usage

```typescript
// components/CocktailGenerator.tsx
import { ageVerificationService } from '../services/ageVerificationService';

export function CocktailGenerator() {
  const [drinkMode, setDrinkMode] = useState<'zero_proof' | 'spirited'>('zero_proof');
  const canAccessAlcohol = ageVerificationService.canAccessAlcoholContent();
  
  return (
    <div>
      <div className="flex gap-2">
        <Button 
          onClick={() => setDrinkMode('zero_proof')}
          variant={drinkMode === 'zero_proof' ? 'default' : 'outline'}
        >
          Zero-Proof
        </Button>
        
        {canAccessAlcohol ? (
          <Button 
            onClick={() => setDrinkMode('spirited')}
            variant={drinkMode === 'spirited' ? 'default' : 'outline'}
          >
            Spirited
          </Button>
        ) : (
          <Button 
            onClick={() => setShowAgeGate(true)}
            variant="outline"
          >
            Spirited (Verify Age)
          </Button>
        )}
      </div>
      
      {/* Age gate modal */}
      {showAgeGate && (
        <AgeGateModal 
          onVerified={() => {
            setShowAgeGate(false);
            setDrinkMode('spirited');
          }}
          onCancel={() => setShowAgeGate(false)}
        />
      )}
    </div>
  );
}
```

### 6. Age Gate Modal Component

```typescript
// components/AgeGateModal.tsx
interface AgeGateModalProps {
  onVerified: () => void;
  onCancel: () => void;
}

export function AgeGateModal({ onVerified, onCancel }: AgeGateModalProps) {
  const [birthDate, setBirthDate] = useState('');
  const [country, setCountry] = useState('US');
  const [error, setError] = useState('');
  
  const handleSubmit = () => {
    if (!birthDate) {
      setError('Please enter your birth date');
      return;
    }
    
    const isOfAge = ageVerificationService.isOfDrinkingAge(birthDate, country);
    
    if (!isOfAge) {
      const drinkingAge = ageVerificationService.getDrinkingAge(country);
      setError(`You must be ${drinkingAge} or older to access spirited content`);
      return;
    }
    
    // Save verification
    ageVerificationService.saveVerification(birthDate, country);
    onVerified();
  };
  
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Age Verification Required</DialogTitle>
          <DialogDescription>
            You must be of legal drinking age to access spirited content.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="birthDate">Birth Date</Label>
            <Input
              id="birthDate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          
          <div>
            <Label htmlFor="country">Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="US">United States (21+)</SelectItem>
                <SelectItem value="UK">United Kingdom (18+)</SelectItem>
                <SelectItem value="CA">Canada (19+)</SelectItem>
                <SelectItem value="AU">Australia (18+)</SelectItem>
                <SelectItem value="JP">Japan (20+)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSubmit}>Verify Age</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// BAD: Trusting client-side age check only
export const generateCocktail = mutation({
  handler: async (ctx, args) => {
    // ❌ No server-side age verification
    // Client could bypass this
    return await generateSpirited(ctx, args);
  },
});

// BAD: Showing spirited content before verification
function CocktailList({ cocktails }) {
  const canAccess = ageVerificationService.canAccessAlcoholContent();
  
  return (
    <div>
      {cocktails.map(cocktail => (
        // ❌ Shows image before checking age
        <img src={cocktail.image} alt={cocktail.name} />
      ))}
      {!canAccess && <p>Verify age to see details</p>}
    </div>
  );
}

// BAD: Storing raw birth date unencrypted
function saveAge(birthDate: string) {
  // ❌ Storing sensitive PII in plain text
  localStorage.setItem('user_birthdate', birthDate);
}

// BAD: Defaulting to allowing access
function checkAge(userAge?: AgeVerification): boolean {
  if (!userAge) {
    // ❌ Defaults to true when age unknown
    return true;
  }
  return userAge.isVerified;
}

// BAD: Not respecting regional differences
function isOfAge(age: number): boolean {
  // ❌ Hardcoded to one age, ignores regional laws
  return age >= 21;
}
```

### ✅ Do This Instead

```typescript
// GOOD: Server-side age verification
export const generateCocktail = mutation({
  handler: async (ctx, args) => {
    // ✅ Always verify on server
    await requireAgeVerification(ctx);
    return await generateSpirited(ctx, args);
  },
});

// GOOD: Hide spirited content until verified
function CocktailList({ cocktails }) {
  const canAccess = ageVerificationService.canAccessAlcoholContent();
  
  if (!canAccess) {
    return <AgeGatePrompt />;
  }
  
  return (
    <div>
      {cocktails.map(cocktail => (
        // ✅ Only shows after verification
        <img src={cocktail.image} alt={cocktail.name} />
      ))}
    </div>
  );
}

// GOOD: Encrypt sensitive data
function saveAge(birthDate: string, country: string) {
  // ✅ Encrypt before storage (in production)
  const encrypted = encrypt(birthDate);
  const verification = {
    birthDate: encrypted,
    country,
    isVerified: true
  };
  localStorage.setItem(AGE_KEY, JSON.stringify(verification));
}

// GOOD: Fail-safe defaults
function checkAge(userAge?: AgeVerification): boolean {
  // ✅ Defaults to false when age unknown
  if (!userAge || !userAge.isVerified) {
    return false;
  }
  return ageVerificationService.isOfDrinkingAge(
    userAge.birthDate, 
    userAge.country
  );
}

// GOOD: Regional age requirements
function isOfAge(birthDate: string, country: string): boolean {
  // ✅ Respects regional drinking ages
  const age = calculateAge(birthDate);
  const drinkingAge = getDrinkingAge(country);
  return age >= drinkingAge;
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Any alcohol-related content (images, recipes, articles)
- Spirited drink generation or display
- Cocktail databases and mixology features
- Wine/beer recommendations
- Bar and restaurant features with alcohol
- Compliance with regional alcohol laws
- Protecting minors from age-restricted content

❌ **Don't use for:**
- Non-alcoholic content (zero-proof drinks, food)
- General recipe browsing
- Public marketing pages
- Content that doesn't involve alcohol

---

## Benefits

1. **Legal Compliance**: Meets regional age verification requirements
2. **Fail-Safe Design**: Defaults to blocking access when age unknown
3. **Regional Awareness**: Respects different drinking ages by country
4. **User Privacy**: Stores minimal data, can be encrypted
5. **Seamless UX**: One-time verification, remembered across sessions
6. **Server Enforcement**: Cannot be bypassed by client manipulation
7. **Audit Trail**: Can log verification attempts for compliance
8. **Flexible**: Works with both client and server-side checks

---

## Security Best Practices

### Critical Rules

```typescript
// ❌ NEVER show spirited content without verification
// ❌ NEVER allow age verification bypass
// ❌ NEVER store raw birthdate (encrypt it in production)
// ❌ NEVER show spirited toggle to unverified users
// ❌ NEVER trust client-side checks alone

// ✅ ALWAYS default to zero-proof mode
// ✅ ALWAYS require explicit age verification
// ✅ ALWAYS respect regional drinking ages
// ✅ ALWAYS log verification attempts
// ✅ ALWAYS verify on server for sensitive operations
```

### Rate Limiting

```typescript
// Prevent brute force age verification attempts
const RATE_LIMITS = {
  ageVerification: {
    attempts: 3,
    window: 24 * 60 * 60 * 1000 // 24 hours
  }
};
```

### Audit Logging

```typescript
// Log age verification events
interface AgeVerificationLog {
  userId: string;
  timestamp: number;
  country: string;
  result: 'approved' | 'denied';
  age: number;
  ipAddress: string; // Hashed for privacy
}
```

---

## Related Patterns

- See `session-management.md` for storing verification across sessions
- See `rbac-implementation.md` for role-based content access
- See `subscription-enforcement.md` for premium feature gating
- See `auth-helpers.md` for user authentication utilities

---

*Extracted: 2026-02-18*
