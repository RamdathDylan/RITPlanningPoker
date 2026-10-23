# ADR-010: ESLint 10 with axe checks in Playwright instead of eslint-plugin-jsx-a11y

**Status:** Proposed · **Date:** 2026-10-22 · **Deciders:** Dylan Ramdath

## Context

We want automated accessibility checks. The usual lint plugin, `eslint-plugin-jsx-a11y` 6.10.2, was last published in October 2024. Its peer dependency range ends at ESLint 9, and ESLint 9 reached end of life on 2026-08-06, according to eslint.org. The current ESLint is 10.13.0.

## Decision

- ESLint 10 (flat config) with `@eslint/js`, `globals`, `eslint-plugin-react-hooks` 7 (supports ESLint 10), and `eslint-config-prettier`.
- A built-in `no-restricted-syntax` rule bans `dangerouslySetInnerHTML`, with no plugin needed.
- Accessibility is checked at runtime with `@axe-core/playwright` 4.14 on every screen in E2E tests, and with Testing Library's role-based queries, which fail when elements lack accessible names.

## Options considered

### Option A: ESLint 10 + axe (chosen)

**Pros:** a supported linter; axe checks the real rendered page, including contrast.
**Cons:** some issues are caught at test time rather than while typing.

### Option B: Stay on ESLint 9 with jsx-a11y

**Pros:** accessibility hints in the editor.
**Cons:** an unmaintained linter on a public, deployed project.

## Consequences

- Every new screen's E2E test includes an axe scan with zero violations allowed.

## Revisit when

- jsx-a11y publishes ESLint 10 support.
