# Contributing to Nova26 Inspiration Library

## Purpose

This directory stores visual and UX inspiration references that inform Nova26's design decisions. These references help maintain consistency and quality across all generated interfaces.

## What to Include

### ✅ Good Inspiration Sources

- **Screenshots** of well-designed interfaces (PNG, JPG)
- **Design patterns** from successful products
- **UX flows** that demonstrate best practices
- **Component examples** with exceptional polish
- **Interaction patterns** worth emulating
- **Color schemes** and visual systems
- **Typography** examples
- **Animation** references (GIFs, videos)

### ❌ What NOT to Include

- Copyrighted materials without attribution
- Low-quality or blurry screenshots
- Outdated design patterns
- Anti-patterns or poor UX examples
- Files larger than 5MB (compress first)
- Proprietary designs under NDA

## File Naming Convention

Use descriptive, kebab-case names:

```
✅ Good:
- monday-homepage-pipeline-cards.png
- stripe-checkout-flow.png
- linear-command-palette.png
- notion-sidebar-navigation.png

❌ Bad:
- screenshot1.png
- IMG_1234.jpg
- untitled.png
```

## Directory Structure

```
.nova/inspiration/
├── .gitkeep
├── CONTRIBUTING.md
├── INDEX.md                          # Catalog of all references
├── monday-homepage-pipeline-cards.png
├── stripe-checkout-flow.png
└── [other-references].png
```

## Adding New References

### 1. Capture the Reference

- Take a high-quality screenshot (at least 1280px wide)
- Crop to show only the relevant UI element
- Compress if file size > 2MB

### 2. Name the File

- Use kebab-case
- Include the product name
- Describe the specific element
- Example: `figma-component-properties-panel.png`

### 3. Add to INDEX.md

Document the reference with:
- **File name**
- **Source** (product/website)
- **What it demonstrates** (specific pattern or principle)
- **Why it's valuable** (what we learned from it)
- **Date added**

### 4. Commit with Context

```bash
git add .nova/inspiration/[filename]
git commit -m "Add [product] [element] reference for [purpose]"
```

Example:
```bash
git add .nova/inspiration/linear-issue-detail-layout.png
git commit -m "Add Linear issue detail reference for task view redesign"
```

## Using References

### For Designers

References inform:
- Visual hierarchy decisions
- Component structure
- Interaction patterns
- Color and typography choices

### For Developers (VENUS Agent)

References guide:
- Component implementation
- State management patterns
- Animation timing and easing
- Responsive breakpoints

### For Product (EARTH Agent)

References help define:
- User flows
- Feature specifications
- Acceptance criteria
- Edge case handling

## Attribution

Always credit the source:

```markdown
## Reference: Monday.com Homepage

**File:** `monday-homepage-pipeline-cards.png`
**Source:** https://monday.com
**Date Added:** 2026-02-18
**Used For:** Landing page pipeline stage cards

### What We Learned
- Three-card layout with hover-to-expand dropdowns
- Purple accent color (#6161FF) for CTAs
- Clean white background with subtle borders
- Icon + title + description pattern
```

## Quality Standards

### Image Quality
- Minimum 1280px width for desktop references
- Minimum 375px width for mobile references
- PNG format for UI screenshots (better quality)
- JPG format for photos (smaller file size)
- Compress images to < 2MB

### Documentation Quality
- Every reference must be documented in INDEX.md
- Include source URL when available
- Explain what pattern/principle it demonstrates
- Note any licensing restrictions

## Maintenance

### Monthly Review
- Remove outdated references
- Update INDEX.md
- Check for broken links
- Archive unused references

### Quarterly Audit
- Evaluate which references are most valuable
- Identify gaps in coverage
- Update contribution guidelines
- Refresh examples with newer patterns

## Examples

### Good Reference Entry

```markdown
## Stripe Checkout Flow

**File:** `stripe-checkout-flow.png`
**Source:** https://stripe.com/docs/payments/checkout
**Date Added:** 2026-02-18
**Category:** Payment UX
**Used For:** Checkout page redesign

### What We Learned
- Progressive disclosure: show only necessary fields
- Real-time validation with inline error messages
- Trust indicators (lock icon, "Powered by Stripe")
- Mobile-optimized input fields
- Clear CTA hierarchy

### Implementation Notes
- Used for VENUS checkout component
- Informed error handling patterns
- Guided mobile-first approach
```

### Bad Reference Entry

```markdown
## Some Website

**File:** `screenshot.png`
**Source:** Unknown
**Date Added:** Unknown

(No description, no context, no value)
```

## Questions?

- **Where to discuss?** Open an issue or PR
- **Need help?** Check existing references in INDEX.md
- **Found a great example?** Submit a PR with documentation

## License

All references in this directory are used for educational and design inspiration purposes only. Original designs remain property of their respective owners. Nova26 does not claim ownership of any reference materials.

---

*Last Updated: 2026-02-18*
