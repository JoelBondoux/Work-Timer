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
- For user-facing PowerShell/terminal output formatting, follow `docs/powershell-output-style-guide.md` as the default standard for current and future output UX changes.

## Safety And Security First Policy

- Treat user data protection, billing correctness, and destructive-operation safety as top priority over speed.
- Default to least-privilege and non-destructive behavior: prefer dry-run, explicit confirmations, and reversible changes.
- Never weaken or bypass safety checks, authorization boundaries, or validation logic unless explicitly required and documented.
- If a change introduces meaningful security, privacy, or integrity risk, stop and escalate with options, risks, and a recommended safe default.
- Call out security-impacting changes in PR summaries and include focused validation steps.

## Local Staging Workspace Rules

- Use `staging/` for local-only test notes, debug helpers, and temporary artifacts.
- Treat `staging/` as non-production and non-release content.
- Do not commit files from `staging/`.
- Do not reference `staging/` as a required documentation location; durable docs must live under `docs/`.

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

## Merge Administration Policy

- The coding agent administers merge readiness by default.
- The agent should run review + validation, decide when the outcome is clear, and proceed without waiting for user confirmation in routine cases.
- The agent should escalate to the user only when there is a material choice (trade-off between valid options), unresolved risk, or policy ambiguity.
- When escalating, present concise options, risks, and a recommended default.

## PR Review Automation

- When a PR is in a `REVIEW_REQUIRED` state, the active coding agent must run a review automatically.
- The review should prioritize regressions and risk (correctness, safety, behavior changes, and missing tests).
- Provide a merge recommendation (`approve` or `changes requested`) with concrete next steps.
