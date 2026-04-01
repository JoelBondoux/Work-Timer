# Copilot Instructions for Work-Timer

## Repository Workflow

- Treat `master` as production-ready at all times.
- Never perform feature development directly on `master`.
- Create a short-lived branch from `master` for each task.
- Open a PR to merge back into `master`.
- Merge only after checks pass (`npm test` and `npm run build`).
- Prefer squash merge.

## Branch Naming

- `feature/<short-description>`
- `fix/<short-description>`
- `chore/<short-description>`

## Development Guardrails

- Keep changes focused and minimal.
- Do not bypass safety behavior in timer, billing, export, or destructive flows.
- Preserve current CLI and MCP behavior unless the task explicitly changes it.

## Required Validation Before PR

- Run `npm test` and `npm run build`.
- Run `npm run check:production` to catch debug/dev-only artifacts before merge.
- If source files change under `src/`, ensure generated outputs under `dist/` are regenerated and committed when applicable.
- If CLI command behavior changes, update docs in `docs/cli-reference.md` and relevant setup/readme pages.
- If MCP tools change, update `docs/mcp-tools.md` to keep tool docs and counts accurate.

## MCP Installer And Client Integration Rules

- Keep installer behavior safe by default: support dry-run, avoid destructive overwrites, and keep backup behavior for existing JSON configs.
- When adding/removing supported MCP clients, update all of:
	- installer logic under `src/cli/mcp-install.ts`
	- user docs (`docs/setup.md`, `docs/cli-reference.md`, and `README.md` as needed)
	- client watchlist manifest under `.github/llm-client-watchlist/package.json` when relevant

## Release Hygiene

- Keep version references in sync when cutting a release change:
	- `package.json`
	- `package-lock.json`
	- `src/cli/index.ts` (CLI version)
	- `src/mcp/server.ts` (MCP server version)
- Add a clear entry in `CHANGELOG.md` for user-visible changes.

## Merge Gate

- Version tags are cut from `master` only.
- If a PR is not production-ready, do not merge it.
