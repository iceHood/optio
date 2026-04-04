# Contributing to Optio

Thanks for your interest in contributing! Here's how to get involved.

## Submitting Issues

- Search [existing issues](https://github.com/jonwiggins/optio/issues) before opening a new one.
- Use a clear, descriptive title and include steps to reproduce any bugs.
- For feature requests, describe the problem you're trying to solve and your proposed solution.

## Submitting Pull Requests

1. Fork the repo and create a branch from `main`.
2. Write or update tests for your changes.
3. Run `pnpm turbo typecheck` and `pnpm turbo test` to verify everything passes.
4. Run `pnpm format:check` to ensure formatting is correct.
5. Open a PR with a clear description of what changed and why.
6. Wait for CI checks to pass and a maintainer to review.

## Code Style

- **ESM modules**: All packages use `"type": "module"` with `.js` extensions in imports.
- **Conventional commits**: Enforced by commitlint (e.g., `feat:`, `fix:`, `docs:`, `refactor:`).
- **Prettier**: Formatting is enforced on commit via Husky pre-commit hooks. Run `pnpm format` to auto-fix.
- **TypeScript**: Strict mode enabled across all packages.
- **Zod**: Used for API request validation.
- **Drizzle ORM**: Database schema lives in `apps/api/src/db/schema.ts`.

## Quick Setup

```bash
pnpm install
pnpm dev            # Start API + Web with hot reload
pnpm turbo test     # Run tests
pnpm format         # Format with Prettier
```
