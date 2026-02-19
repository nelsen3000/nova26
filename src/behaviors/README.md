# Behaviors System

Reusable, versioned behavior patterns for Ralph Loop.

## Built-in Behaviors

1. **calm-ui** - UI/UX focused, measured approach
2. **secure-code** - Security-first coding patterns
3. **test-first** - TDD/BDD approach
4. **api-design** - API-first design patterns
5. **adr-on-decision** - Architecture Decision Records for significant choices

## Usage

```typescript
import { BehaviorEngine } from './behavior-engine.js';

const engine = new BehaviorEngine();
engine.activate('secure-code');
```
