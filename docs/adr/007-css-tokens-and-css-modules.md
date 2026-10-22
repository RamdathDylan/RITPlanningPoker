# ADR-007: Plain CSS with design tokens and CSS Modules

**Status:** Proposed · **Date:** 2026-10-22 · **Deciders:** Dylan Ramdath

## Context

CLAUDE.md requires plain CSS and tokens for every color, space, size, radius, and shadow, with light and dark themes that meet WCAG AA.

## Decision

- `client/src/styles/tokens.css` defines CSS custom properties (variables) on `:root`, with dark values under `@media (prefers-color-scheme: dark)`.
- Components use **CSS Modules**: a file named `Card.module.css` whose class names Vite automatically makes unique per component, so styles can't leak between components. This is built into Vite, with no dependency.
- A token check that needs no extra linter: a unit test scans `*.module.css` for hex colors and raw `px` values outside the tokens file and fails if it finds any.

## Options considered

### Option A: Tokens + CSS Modules (chosen)
**Pros:** standard CSS; scoped class names; no dependency.
**Cons:** more files than a utility framework.

### Option B: Tailwind CSS
**Pros:** fast to build with.
**Cons:** not plain CSS; a new dependency and build step; harder to enforce our own token names.

### Option C: A component library such as MUI
**Pros:** accessible components out of the box.
**Cons:** large; hides the accessibility work Dylan needs to understand; fights the token system.

## Consequences

- Accessibility patterns (roving tabindex, live regions) are built and tested by hand.

## Revisit when

- Shared component needs grow beyond what tokens and modules handle comfortably.
