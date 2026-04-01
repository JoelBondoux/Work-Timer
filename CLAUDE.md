# Claude Instructions for Work-Timer

## Repository Workflow

- `master` is the production-ready branch.
- Do not commit feature work directly to `master`.
- Create short-lived task branches from `master`.
- Submit a PR back to `master`.
- Ensure `npm test` and `npm run build` pass before merge.
- Prefer squash merge.

## Branch Naming

- `feature/<short-description>`
- `fix/<short-description>`
- `chore/<short-description>`

## Contribution Standards

- Keep PRs scoped to one concern.
- Add tests for logic changes.
- Update docs for user-facing changes.

## Required Validation

- Run `npm test` and `npm run build` before opening or updating a PR.
- Run `npm run check:production` to block debug/dev-only artifacts from release branches.
- If files in `src/` are changed, regenerate and commit matching `dist/` outputs when applicable.
- If CLI behavior changes, update `docs/cli-reference.md` and related setup/readme docs.
- If MCP tools are added or changed, update `docs/mcp-tools.md` to keep tool docs and counts accurate.

## MCP Installer Rules

- Preserve safe defaults for client config edits (backup existing JSON, support dry-run behavior, avoid destructive edits by default).
- When supported MCP clients change, update:
	- `src/cli/mcp-install.ts`
	- `docs/setup.md`
	- `docs/cli-reference.md`
	- `README.md` when user-facing behavior changes
	- `.github/llm-client-watchlist/package.json` when watchlist relevance changes

## Release Consistency

- Keep release version references synchronized across:
	- `package.json`
	- `package-lock.json`
	- `src/cli/index.ts`
	- `src/mcp/server.ts`
- Add changelog entries in `CHANGELOG.md` for user-visible changes.

## Safety Rule

If a change is not production-ready, keep it on a branch and do not merge to `master`.
