# Contributing

Thank you for your interest in contributing to Work-Timer! This guide covers development setup, architecture, testing, and pull request guidelines.

## Development Setup

### Prerequisites

- Node.js 18+
- npm

### Getting Started

```bash
git clone https://github.com/JoelBondoux/Work-Timer.git
cd Work-Timer
npm install
npm run build
```

### Branching Model (Production-Safe)

- `master` is production-ready only.
- Do not commit directly to `master` for feature work.
- Create short-lived branches from `master` for every change.
- Open a pull request back into `master`.
- Merge only after required checks pass (`npm test`, `npm run build`).

Suggested branch names:

- `feature/<short-description>`
- `fix/<short-description>`
- `chore/<short-description>`

### Development Workflow

```bash
# Watch mode — recompiles on file changes
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build for production
npm run build
```

### Local Staging Workspace (Not Committed)

- Use the repo-root `staging/` folder for local testing artifacts you never want in `master`.
- This folder is gitignored by default.
- Typical contents: manual test notes, temporary debug scripts, local env snapshots, ad-hoc export files.
- Do not put required project documentation in `staging/`; keep durable docs under `docs/`.

### Running Without Turso

For development and testing, you don't need a Turso account. The test suite uses in-memory SQLite databases via `@libsql/client`'s `:memory:` URL.

To test the CLI locally, you can set up a local file-based database:

```bash
export TURSO_DATABASE_URL="file:./dev.db"
export TURSO_AUTH_TOKEN=""
```

## Architecture

### Directory Structure

```
src/
  types.ts          # Shared TypeScript interfaces
  db/
    schema.ts       # Database schema (CREATE TABLE statements)
    client.ts       # Turso client singleton and config loading
  core/             # Business logic — no I/O formatting
    settings.ts     # Global defaults CRUD
    projects.ts     # Project CRUD operations
    timer.ts        # Timer state machine (start/stop/pause/resume)
    billing.ts      # Duration and billing calculations
    sessions.ts     # Session queries, invoice/payment marking
    export.ts       # CSV and XLSX generation
    format.ts       # Text formatting for human-readable output
  mcp/
    server.ts       # MCP server — tool registrations
  cli/
    index.ts        # CLI entry point — Commander.js commands
```

### Key Design Principles

1. **Dependency injection** — All core functions accept a `Client` parameter as their first argument. This makes them testable with in-memory databases. Only the MCP server and CLI entry points call `getClient()`.

2. **Single source of truth** — Both MCP and CLI call the exact same core functions. No logic is duplicated between interfaces.

3. **UTC timestamps** — All times stored as ISO 8601 UTC strings. The display layer handles local time conversion where needed.

4. **Case-insensitive project names** — Lookups use `LOWER(name) = LOWER(?)`. Original casing is preserved.

5. **Graceful defaults** — When stop/pause/resume is called without a project name, the most recently started active session is used.

### Data Flow

```
User Input (natural language or CLI args)
    ↓
MCP Server / CLI (parse input, call core functions)
    ↓
Core Logic (business rules, calculations)
    ↓
Database (Turso/libSQL via @libsql/client)
    ↓
Core Logic (format results)
    ↓
MCP Server / CLI (return response)
```

## Testing

### Running Tests

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode
```

### Test Strategy

- **Unit tests** for pure functions (billing calculations, min-block rounding)
- **Integration tests** for database-dependent operations using in-memory SQLite
- Each test file creates its own fresh in-memory database via `createMemoryClient()`

### Writing Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import type { Client } from '@libsql/client';
import { createMemoryClient } from '../db/client.js';

describe('myFeature', () => {
  let client: Client;

  beforeEach(async () => {
    client = await createMemoryClient();
  });

  it('should do something', async () => {
    // Use client to set up test data and call functions
  });
});
```

### What to Test

- **Always test**: Billing calculations (money must be correct), timer state transitions
- **Good to test**: CRUD operations, edge cases (empty data, null values)
- **Not needed**: MCP tool registration, CLI argument parsing (covered by Commander.js)

## Pull Request Guidelines

### Protected Branch Rules (Recommended)

Configure these GitHub branch protection settings for `master`:

1. Require a pull request before merging
2. Require status checks to pass before merging
3. Block force pushes
4. Optional for solo-maintainer repos: set required approvals to `0` while keeping required status checks enabled

### Merge Administration (Agent-Led)

For this repository, merge administration is delegated to the coding agent by default.

- The agent should perform review + validation and proceed when results are clear.
- The agent should escalate to the maintainer only when there is a real decision to make: trade-off between valid options, unresolved risk, or policy ambiguity.
- Escalations should include concise options, risks, and a recommended default path.

### AI Safety Policy Files

Repository AI agents must follow the safety and security policy defined in:

- `.github/copilot-instructions.md`
- `CLAUDE.md`

When updating one policy, keep both files aligned so agent behavior stays consistent across tools.

## Dependency Update Automation

- Dependabot is configured in `/.github/dependabot.yml`
- Root npm dependencies (`/package.json`) are updated automatically on a weekly schedule
- External LLM client tooling is tracked separately in `/.github/llm-client-watchlist/package.json`
- Keep the watchlist focused on integrations that can affect MCP installer compatibility to avoid noisy update PRs
- When adding or removing supported client integrations, update both the MCP installer logic and the watchlist manifest
- Semver-major updates for `typescript`, `@types/node`, and `vitest` are intentionally ignored by Dependabot to reduce breakage risk; review these major upgrades manually at least once per quarter in a dedicated compatibility branch

### Before Submitting

1. Run `npm test` — all tests must pass
2. Run `npm run build` — no TypeScript errors
3. Run `npm run check:production` — ensures no debug/dev-only artifacts are shipped
4. Add tests for new features or bug fixes
5. Update documentation if the change affects user-facing behavior
6. Confirm your branch is not `master`

### PR Format

```
## Summary
Brief description of what changed and why.

## Changes
- Bullet list of specific changes

## Test Plan
- How to verify the change works
```

### Production Cleanup PR Checklist

Use this checklist when a PR's goal is to remove debug/dev-only artifacts before release:

1. Branch from `master` using a `fix/` branch name (for example: `fix/production-cleanup`).
2. Remove only production-risk artifacts (debug code, temporary release tags, conflict markers, accidental dev-only content).
3. Keep useful development context in the PR description, issue discussion, or a follow-up branch instead of shipping it to `master`.
4. Run `npm run check:production`, `npm test`, and `npm run build`.
5. Include a short "before vs after" summary in the PR body.
6. Merge only through PR after required checks pass.

### Code Style

- TypeScript strict mode is enabled — no `any` types
- Use `async/await` consistently (not `.then()`)
- Prefer descriptive variable names over abbreviations
- Keep functions focused — one function, one responsibility

### Commit Messages

- Use imperative mood: "Add billing export" not "Added billing export"
- Keep the first line under 72 characters
- Reference issues if applicable: "Fix min-block rounding for zero duration (#42)"

## Reporting Issues

Please open an issue on GitHub with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your Node.js version and OS
