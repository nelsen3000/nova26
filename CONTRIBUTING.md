# Contributing to Nova26

## Getting Started

1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npx tsx src/index.ts status .nova/prd-test.json` to verify setup

## Development Guidelines

### Code Standards

- **TypeScript**: Strict mode enabled. No `any` types without explicit justification.
- **Formatting**: Use consistent indentation (2 spaces).
- **Testing**: Run `npx tsx src/test/mock-run.ts` before committing.

### What NOT to Modify

- **`.nova/agents/`**: Agent templates require review before changes. These define system behavior.
- **`convex/schema.ts`**: Database schema changes need careful consideration.

### Dependencies

- No new npm dependencies without approval
- Keep existing dependencies up to date

### Git Workflow

1. Commit per feature: `feat: description` or `fix: description`
2. Push frequently
3. Run verification before pushing:
   ```bash
   npx tsc --noEmit  # Must exit 0
   npx tsx src/test/mock-run.ts  # Must pass
   ```

### Testing

- Use mock test for quick verification: `npm run test:mock`
- Mock test doesn't require Ollama running

### File Structure

```
src/
  orchestrator/    # Core loop logic
  llm/             # LLM client
  types/           # TypeScript interfaces
  test/            # Tests
.nova/
  agents/          # Agent templates (don't modify without review)
  output/          # Task outputs (runtime)
  prd-*.json       # PRD definitions
convex/
  schema.ts        # Database schema
```

## Questions?

Open an issue for discussion before starting major work.
