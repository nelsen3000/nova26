# CALLISTO Style Guide - Documentation Standards

> Standards for README files, API documentation, and inline code comments

---

## Documentation File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Project README | `README.md` | Root documentation |
| Component docs | `[Component].stories.mdx` | `Button.stories.mdx` |
| API documentation | `api/[resource]-api.md` | `api/users-api.md` |
| Setup guides | `SETUP-[topic].md` | `SETUP-database.md` |
| Architecture docs | `ARCHITECTURE-[domain].md` | `ARCHITECTURE-auth.md` |
| Changelog | `CHANGELOG.md` | Version history |
| Contributing | `CONTRIBUTING.md` | Contribution guidelines |

---

## README Structure Template

Every project README must include:

```markdown
# [Project Name]

> One-line description of the project

Brief paragraph explaining what this project does and its purpose.

## Quick Start

\`\`\`bash
# Clone the repository
git clone [repo-url]

# Install dependencies
npm install

# Start development
npm run dev
\`\`\`

## Prerequisites

- Node.js >= 18.x
- [Other requirements]

## Project Structure

\`\`\`
project/
├── src/
│   ├── components/    # React components
│   ├── hooks/         # Custom hooks
│   ├── lib/           # Utilities
│   └── types/         # TypeScript types
├── convex/            # Backend functions
└── docs/              # Documentation
\`\`\`

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run test` | Run tests |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CONVEX_URL` | Yes | Convex deployment URL |
| `VITE_API_KEY` | Yes | External API key |

## Architecture Overview

[High-level description or link to ARCHITECTURE.md]

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

[License Type] - See [LICENSE](./LICENSE)
```

---

## API Documentation Format (OpenAPI Conventions)

### Endpoint Documentation Template

```markdown
## [METHOD] /[path]

**Summary:** [Brief description]

### Description
[Detailed explanation of what this endpoint does]

### Authentication
- **Type:** [Bearer Token / API Key / None]
- **Scope:** [Required permissions]

### Request

#### Headers
| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token |
| `Content-Type` | Yes | `application/json` |

#### Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | Resource identifier |
| `limit` | number | No | Max items (default: 20) |

#### Body
\`\`\`json
{
  "name": "string",
  "email": "string",
  "status": "active" | "inactive"
}
\`\`\`

### Response

#### Success (200 OK)
\`\`\`json
{
  "id": "string",
  "name": "string",
  "createdAt": "2024-01-01T00:00:00Z"
}
\`\`\`

#### Error (400 Bad Request)
\`\`\`json
{
  "error": "validation_error",
  "message": "Invalid email format",
  "field": "email"
}
\`\`\`

#### Error Codes
| Code | Description |
|------|-------------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 404 | Not Found |
| 429 | Rate Limited |

### Example

#### Request
\`\`\`bash
curl -X GET \\
  https://api.example.com/v1/users \
  -H "Authorization: Bearer {token}"
\`\`\`

#### Response
\`\`\`json
{
  "users": [],
  "total": 0
}
\`\`\`
```

### OpenAPI Spec Pattern

```yaml
openapi: 3.0.0
info:
  title: API Name
  version: 1.0.0
paths:
  /users:
    get:
      summary: List users
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserList'
components:
  schemas:
    UserList:
      type: object
      properties:
        users:
          type: array
          items:
            $ref: '#/components/schemas/User'
```

---

## Inline Comment Standards

### File Header Comments

Every file should begin with:

```typescript
/**
 * @fileoverview [Brief description of file purpose]
 * @module [module/path]
 * @author [Name/Agent]
 * @since [Version/Date]
 */
```

### Function Documentation

```typescript
/**
 * [Brief description of function purpose]
 * 
 * @param param1 - [Description of parameter]
 * @param param2 - [Description of parameter]
 * @returns [Description of return value]
 * @throws [Error type] - [When this error is thrown]
 * 
 * @example
 * ```typescript
 * const result = calculateTotal(100, 0.2);
 * // result: 120
 * ```
 */
function calculateTotal(amount: number, taxRate: number): number {
  // Implementation
}
```

### Inline Comment Rules

```typescript
// ✅ GOOD - Explains WHY, not WHAT
// Use Math.floor to prevent floating point chip errors
const chips = Math.floor(amount * rate);

// ✅ GOOD - Complex logic clarification
// Sort by createdAt desc, then by name asc for ties
const sorted = items.sort((a, b) => 
  b.createdAt - a.createdAt || a.name.localeCompare(b.name)
);

// ✅ GOOD - Section dividers in large files
// ============================================================================
// AUTHENTICATION HELPERS
// ============================================================================

// ❌ BAD - Obvious comments
// Increment counter by 1
counter++;

// ❌ BAD - No comment on complex logic
const x = a > b ? (c < d ? e : f) : g;
```

### TODO/FIXME Comments

```typescript
// TODO: Add pagination support (see issue #123)
// FIXME: Handle race condition on rapid updates
// NOTE: This assumesConvex subscription is active
// HACK: Temporary workaround until API v2
```

---

## Component Documentation (Storybook Style)

```markdown
# ComponentName

> One-line description of the component

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary'` | `'primary'` | Visual style |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Component size |
| `disabled` | `boolean` | `false` | Disable interaction |
| `onClick` | `() => void` | - | Click handler |

## Usage

### Basic
\`\`\`tsx
<Button variant="primary">Click me</Button>
\`\`\`

### With Icon
\`\`\`tsx
<Button icon={<PlusIcon />}>Add Item</Button>
\`\`\`

### Disabled State
\`\`\`tsx
<Button disabled>Loading...</Button>
\`\`\`

## Accessibility

- Keyboard navigable (Tab/Enter)
- ARIA label support
- Focus visible state

## Related

- [RelatedComponent](./RelatedComponent.md)
```

---

## Quality Checklist (25+ items)

### README Quality (5)
- [ ] Clear one-line description
- [ ] Quick start instructions
- [ ] Prerequisites listed
- [ ] Project structure explained
- [ ] Environment variables documented

### API Documentation (5)
- [ ] All endpoints documented
- [ ] Request/response examples
- [ ] Error codes explained
- [ ] Authentication described
- [ ] Rate limits noted

### Code Comments (5)
- [ ] File headers present
- [ ] Functions have JSDoc
- [ ] Complex logic explained
- [ ] TODOs have issue references
- [ ] No obvious comments

### Component Docs (5)
- [ ] All props documented
- [ ] Usage examples included
- [ ] Variants shown
- [ ] Accessibility noted
- [ ] Related components linked

### General Quality (5)
- [ ] No broken links
- [ ] Consistent formatting
- [ ] Code examples tested
- [ ] Version numbers current
- [ ] Spell check passed

---

## Self-Check Before Responding

- [ ] README follows template structure
- [ ] API docs include all error codes
- [ ] Inline comments explain why, not what
- [ ] JSDoc comments for all exports
- [ ] Examples are runnable/tested
- [ ] Links are valid
- [ ] OpenAPI spec is valid YAML/JSON
- [ ] Component props fully documented

---

## Output Format Template

```markdown
## Documentation: [Type] - [Name]

### Purpose
[What this documents]

### Structure
- [Section 1]
- [Section 2]

### Key Information
- [Important point 1]
- [Important point 2]

### Code Example
\`\`\`[language]
[Example code]
\`\`\`

### Checklist
- [ ] Required sections included
- [ ] Examples tested
- [ ] Links verified
```
