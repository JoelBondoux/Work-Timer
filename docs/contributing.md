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

### Before Submitting

1. Run `npm test` — all tests must pass
2. Run `npm run build` — no TypeScript errors
3. Add tests for new features or bug fixes
4. Update documentation if the change affects user-facing behavior

### PR Format

```
## Summary
Brief description of what changed and why.

## Changes
- Bullet list of specific changes

## Test Plan
- How to verify the change works
```

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
