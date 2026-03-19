# Contributing Guide

Welcome! To keep our project history clean and to automate our release process, we use **Conventional Commits** paired with a Squash and Merge workflow.

## The Workflow in a Nutshell

1. **Branch**: Create a feature branch from `main`.
2. **Commit**: Work on your changes. Don't worry about individual commit names on your branch; they will be squashed later.
3. **PR Title**: Give your Pull Request a title following the `type(scope): description` format.
4. **Merge**: Once approved, we use **Squash and Merge** to move your changes into `main`.

## Pull Request Naming Standard

We use the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification. Your PR title becomes the final commit message on `main` and the entry in our changelog.

**Format**: `type(scope): description` (all lowercase)

### 1. The Types

| Type | Description | Changelog | Version Bump |
|------|-------------|-----------|-------------|
| `feat` | A new feature | **Features** | Minor |
| `fix` | A bug fix | **Bug Fixes** | Patch |
| `perf` | A performance improvement | **Performance** | Patch |
| `docs` | Documentation only changes | **Documentation** | — |
| `refactor` | Code refactoring (no feature/fix) | Hidden | — |
| `test` | Test additions or changes | Hidden | — |
| `ci` | Changes to GitHub Actions, linting, or deployment scripts | Hidden | — |
| `build` | Build system or external dependency changes | Hidden | — |
| `chore` | Maintenance (updating deps, etc.) | Hidden | — |
| `style` | Code style changes (formatting, semicolons, etc.) | Hidden | — |

> **Breaking changes**: Append `!` after the type/scope (e.g., `feat(gateway)!: redesign auth middleware`) to trigger a major version bump.

### 2. The Scopes

Scopes should match the area of the codebase your change affects. Use the app or package name when the change is scoped to a single workspace.

**Apps:**

| Scope | Directory | Description |
|-------|-----------|-------------|
| `gateway` | `apps/gateway` | Hono API server |
| `dashboard` | `apps/dashboard` | Next.js admin dashboard |
| `mock` | `apps/mock` | Mock LLM server for local testing |

**Packages:**

| Scope | Directory | Description |
|-------|-----------|-------------|
| `shared` | `packages/shared` | Types, Zod schemas, utilities |
| `dal` | `packages/dal` | Prisma ORM & encryption |
| `config` | `packages/config` | Shared build config |
| `eslint-config` | `packages/eslint-config` | Shared ESLint rules |

**Feature-based scopes** (for cross-cutting changes that span multiple workspaces):

`auth`, `api`, `chat`, `analytics`, `logs`, `playground`, `provider`, `embedding`, `cache`, `deps`, `infra`, `deploy`, `docker`

### 3. Examples

```
feat(gateway): add LLM response caching via Redis
fix(dal): resolve connection pool leak on shutdown
feat(dashboard): add dark mode toggle
perf(gateway): optimize provider fallback latency
chore(deps): update typescript to v5.8
ci(docker): add multi-platform build support
docs: update Azure OIDC setup guide
refactor(shared): extract cache schemas into separate module
test(gateway): add cache middleware unit tests
```

## Before Submitting a PR

Run these checks locally to avoid CI failures:

```bash
pnpm lint          # ESLint — must pass with 0 errors
pnpm type-check    # TypeScript compiler — must pass with 0 new errors
pnpm test          # Vitest — all new tests must pass
```

## CI Checks on Pull Requests

Every PR runs the following GitHub Actions jobs (all must pass before merging):

| Job | What it does |
|-----|-------------|
| **Lint & Type Check** | `pnpm lint` + `pnpm type-check` |
| **Build** | `pnpm build` — ensures all packages compile |
| **Test** | `pnpm test` — runs Vitest across all workspaces |

## Automated Releases

We use [Release Please](https://github.com/googleapis/release-please) to automate versioning and changelogs.

1. Every time a PR is merged to `main`, Release Please analyzes the commit messages.
2. It creates or updates a **Release PR** that bumps the version and updates `CHANGELOG.md`.
3. When the Release PR is merged, a GitHub Release is created with a Git tag.
4. This triggers Docker image builds and (optionally) deployment to Azure.

**Release flow:**

```
PR merged to main
  → Release Please creates/updates Release PR
    → Team merges Release PR
      → GitHub Release + Git tag created
        → Docker images built & pushed to GHCR
          → Auto-deploy to test environment
```

## Best Practices

- **Use the imperative mood**: Write descriptions as commands — "add feature" not "added feature".
- **One PR = One task**: Don't mix a `feat` and a `fix` in the same PR. This makes it easier to revert if something goes wrong.
- **Write tests**: When adding or modifying code, always include corresponding tests in `__tests__` directories alongside the source files.
- **English only**: All code comments, JSDoc, inline comments, and TODO comments must be written in English.
- **Use pnpm**: This project uses pnpm exclusively. Never use `npm` or `npx`.
- **Use `@latest`**: When adding dependencies, use the `@latest` tag (e.g., `pnpm add package@latest`) unless there's a specific compatibility reason not to.

## Why We Do This

> "We write code for machines, but we write history for humans. A clean git log is the best documentation a project can have."

A consistent commit history enables automated changelogs, predictable versioning, and easy bisecting when debugging regressions. Thank you for helping us maintain this standard!
