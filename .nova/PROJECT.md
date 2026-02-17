# Project Configuration

## Tech Stack
- **Language**: TypeScript
- **Frontend Framework**: React 19
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Backend/Database**: Convex (only database - no other databases permitted)

## Constraints
- No other databases (Convex only)
- No REST APIs unless explicitly approved by user
- No Express or Next.js API routes
- All backend operations must use Convex queries, mutations, and actions

## Invariants
- Always use requireAuth() for authentication in Convex functions
- Always use Convex validators (v.string(), v.number(), v.id(), etc.)
- Always use Math.floor() for numeric operations (never Math.round or Math.ceil for chip/financial calculations)
- Chips are integers - no floating point or decimals
- $1 revenue = 1 chip exact conversion
- All validation must check: amount > 0, Number.isFinite(), Math.floor() === original value
