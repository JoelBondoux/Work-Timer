# Changelog

All notable changes to this project will be documented in this file.

## [1.3.14] - 2026-04-01

### Added

- Added new MCP tool `work_timer_help` that returns a beginner-friendly capabilities guide and topic-specific usage help
- `work-timer mcp install` now prints a recommended LLM system prompt so clients can answer "how it works" questions more reliably
- Manual fallback instructions now include the same recommended system prompt guidance

### Changed

- MCP docs now include the new help tool and updated tool count

## [1.3.13] - 2026-04-01

### Changed

- Made setup/update/MCP install flows more verbose with step-by-step status output for beginner clarity
- `work-timer setup` now ends with a short quick-start usage walkthrough
- `work-timer mcp install` now prints an end-of-run summary (updated, unchanged, skipped, errors)

## [1.3.12] - 2026-04-01

### Added

- `work-timer mcp install` now prints client-specific manual follow-up instructions when automated installation fails
- Manual fallback instructions are shown for config-write failures and missing-config-file cases

## [1.3.11] - 2026-04-01

### Changed

- Update announcements now trigger only on `work-timer start` and `work-timer stop`
- If an update prompt is dismissed, that same version is not announced again
- A new announcement is shown only when a newer version than the dismissed one becomes available

## [1.3.10] - 2026-04-01

### Added

- Added Dependabot configuration for all npm dependencies in the repository root (`/.github/dependabot.yml`)
- Added a dedicated npm watchlist manifest for external LLM client tooling at `/.github/llm-client-watchlist/package.json`
- Dependabot now checks tracked client tooling versions (Claude Code, Codex CLI, Ollama npm package) separately so MCP installer compatibility changes are easier to spot

### Changed

- Dependency update strategy now separates core project dependency updates from external client watchlist updates

## [1.3.9] - 2026-04-01

### Added

- Added `work-timer mcp list` to detect known MCP client targets and show their local config status
- Added `work-timer mcp install` to programmatically register/update the Work-Timer MCP server in supported local client configs
- New installer options: `--clients`, `--server-path`, `--dry-run`, and `--create-missing`
- Automatic backup creation before rewriting existing MCP JSON configs

### Changed

- Setup and CLI docs now include the new MCP installer workflow for local clients

## [1.3.8] - 2026-03-31

### Fixed
- Fixed `work-timer update` command hanging on Windows with npm.cmd spawn error (EINVAL). The npm invocation now properly falls back to bundled npm-cli.js when npm.cmd fails with stdio piping.
- Improved error messages in `getNpmGlobalPrefix()` to include exit codes and output details for debugging.
- Added `environment: process.env` to spawnSync options to ensure environment variables are properly inherited.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.7] - 2026-03-31

### Fixed

- `work-timer update` now falls back to invoking npm via Node's bundled `npm-cli.js` when `npm`/`npm.cmd` cannot be resolved on PATH
- Fixes failures like `Update failed: npm prefix failed` in environments where the global shim can run but npm command resolution is inconsistent

## [1.3.6] - 2026-03-31

### Added

- New `work-timer uninstall` CLI command with confirmation prompt (`--yes` to skip)
- Automatic update announcements in CLI usage: checks GitHub daily and, when newer builds exist, offers an interactive `Update now?` prompt

### Changed

- Refactored updater flow into shared logic so both `work-timer update` and the update prompt use the same install path and messaging

## [1.3.5] - 2026-03-31

### Fixed

- `work-timer update` now installs from the GitHub tarball URL instead of npm's `github:` git dependency transport
- Avoids Windows `git dep preparation failed` and long `npm warn tar TAR_ENTRY_ERROR` cascades caused by partial git-dependency cleanup in global installs
- Manual recovery/install path is now the same tarball command used by the updater

## [1.3.4] - 2026-03-31

### Fixed

- Global GitHub installs no longer depend on an install-time TypeScript compile step
- Prebuilt `dist` artifacts are now shipped in the repository so `npm install -g github:JoelBondoux/Work-Timer#master` can link `work-timer` without running `prepare`
- This avoids Windows temp-clone failures and `_npx` cache edge cases that caused repeated `git dep preparation failed` errors

## [1.3.3] - 2026-03-31

### Fixed

- Changed Git install `prepare` from `npm exec --package=typescript -- tsc` to `node ./node_modules/typescript/bin/tsc`
- Avoids npm `_npx` temp cache failures on Windows that could break `npm install -g github:JoelBondoux/Work-Timer#master`

## [1.3.2] - 2026-03-31

### Fixed

- Hardened Git dependency preparation by changing `prepare` to `npm exec --package=typescript -- tsc`
- Fixes environments where `npm install -g github:JoelBondoux/Work-Timer#master` runs `prepare` but does not expose `tsc` on PATH during temporary clone build

## [1.3.1] - 2026-03-31

### Fixed

- Added an npm `prepare` script so `npm install -g github:JoelBondoux/Work-Timer#master` builds `dist` before npm links the `work-timer` binary
- This fixes `work-timer update` bootstrap installs from older global versions that could fetch the repo but fail to create the executable shim

## [1.3.0] - 2026-03-31

### Changed

- Replaced `exceljs` with `write-excel-file` for XLSX export generation
- XLSX export remains formatted and includes the same billing columns plus totals-by-project, but now uses a smaller and more modern dependency tree

### Security

- Removed the `exceljs` dependency chain that produced deprecated transitive packages such as `inflight`, `glob@7`, `lodash.isequal`, `fstream`, and `rimraf@2`
- After the replacement, the remaining install-time deprecation warning is limited to `node-domexception`, which comes from `@libsql/client`'s upstream fetch stack

## [1.2.2] - 2026-03-31

### Added

- `work-timer update` now auto-adds npm's global bin directory to the Windows user PATH when missing

### Changed

- `work-timer update` now surfaces full npm install output on failure to make troubleshooting actionable

## [1.2.1] - 2026-03-31

### Fixed

- `work-timer session adjust <session-id>` CLI parsing now correctly routes through a dedicated `session` subcommand
- This removes the extra positional argument bug that caused `Invalid session ID: adjust`

## [1.2.0] - 2026-03-31

### Changed

- Release version bumped to `1.2.0`

## [1.1.7] - 2026-03-31

### Added

- New `work-timer update` CLI command to install the latest Work-Timer release directly from GitHub (`npm install -g github:JoelBondoux/Work-Timer`)
- The updater prints the globally installed MCP server path so users can quickly refresh hardcoded MCP client configs

### Changed

- README and docs were synchronized with today's shipped behavior: project rename/delete/merge, session adjust, local-time display/filter semantics, MCP destructive-operation safety (`dry_run` + `confirm_phrase`), and current MCP tool count

## [1.1.6] - 2026-03-31

### Security

- Added MCP safety gating for destructive tools: `project_delete`, `project_merge`, and `session_adjust` now support `dry_run` previews and require an exact `confirm_phrase` before mutation
- Added dry-run impact previews for project deletion/merge, including active-timer and row-count visibility
- Wrapped multi-step project delete and merge operations in explicit SQL transactions (`BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`) to prevent partial state on failure
- Added regression tests proving transactional rollback under simulated mid-operation failures and tests for MCP confirmation-gate behavior
- Added dependency overrides to remediate known transitive vulnerabilities: `path-to-regexp` and `brace-expansion`

## [1.1.5] - 2026-03-31

### Added

- `session adjust <id> --start <datetime> --end <datetime>` CLI command to correct a session's start and/or end time
- `session_adjust` MCP tool with the same capability
- Both accept local time (`YYYY-MM-DDTHH:MM:SS`) and store as UTC; confirmation shows adjusted times in local time
- Setting an end time is blocked if the session is still running or paused; start must be before end
- `localDateTimeToUtcDb` helper added to `src/core/time.ts` for exact local→UTC datetime conversion

## [1.1.4] - 2026-03-31

### Fixed

- All displayed timestamps (timer start/stop confirmations, running timer status, billing records, exports) now show the **local wall-clock time** instead of raw UTC from the database
- Date filters (`--from` / `--to` and their MCP equivalents) now correctly interpret user-supplied dates as **local calendar dates**, converting them to the corresponding UTC range before querying. This means `--from 2026-03-31` returns all sessions that started on March 31 in your timezone, regardless of the UTC offset
- The "already has a running timer" error message now shows the start time in local time

### Added

- New internal `src/core/time.ts` module with `utcDbToLocal`, `utcDbToLocalDate`, `localToUtcRangeStart`, and `localToUtcRangeEnd` helpers used consistently across the codebase

## [1.1.3] - 2026-03-31

### Added

- `project rename <old-name> <new-name>` CLI subcommand to rename a project
- `project delete <name>` CLI subcommand to delete a project; blocked if sessions exist unless `--force` is passed (prompts for confirmation before force-deleting)
- `project merge <source> <target>` CLI subcommand to move all sessions from one project into another and delete the source (prompts for confirmation)
- `project list [--all]` CLI subcommand (mirrors the existing `projects` command)
- `project_rename`, `project_delete`, `project_merge` MCP tools with equivalent behaviour; `project_delete` accepts a `force` boolean parameter

## [1.1.2] - 2026-03-31

### Added

- Project name similarity check when starting a timer for a project that does not yet exist
- CLI `start` command now detects similar project names (e.g. "BoldBathroom" vs "Bold Bathroom") and presents an interactive menu to choose an existing project or confirm creating a new one
- MCP `timer_start` tool now returns a warning listing similar project names when no exact match is found; pass `confirm_new_project: true` to bypass the check and force creation

## [1.1.1] - 2026-03-25

### Added

- Spreadsheet formula-injection protection for CSV/XLSX exports and accounting preset exports
- MCP-safe export path resolver that confines file writes to `~/.work-timer/exports`
- Hidden token entry during `work-timer setup`
- New security regression tests for spreadsheet sanitization, safe export path handling, terminal text sanitization, and numeric validation

### Changed

- CLI and MCP input validation now enforce non-negative finite rates, bounded integer min blocks, positive session IDs, and bounded payment terms
- Setup now creates config directory/file with restrictive modes where supported (`0700` dir, `0600` file)
- Config loading now returns a clear recovery message when `~/.work-timer/config.json` is malformed
- Terminal output formatting now strips ANSI escape/control characters from user-controlled fields

## [1.1.0] - 2026-03-25

### Added

- Accounting software export presets: `--preset quickbooks`, `xero`, `freshbooks`, `sage`, `myob`
- Each preset maps billing data to the exact CSV column names and date formats required by the target package
- Configurable preset options: `--account-code`, `--tax-type`, `--payment-terms` for package-specific fields
- New MCP tool `export_preset` for natural language accounting exports (e.g. "Export my March billing for QuickBooks")
- Setup instructions for ChatGPT Desktop and GitHub Copilot (VS Code) MCP configuration
- Windows troubleshooting: npm global PATH, PowerShell execution policy, Turso install via web dashboard
- PowerShell quick-setup script for Claude Desktop config file creation

### Changed

- Turso setup instructions now recommend the web dashboard for Windows users (no WSL/scoop required)
- Claude Desktop config no longer includes auth tokens (credentials read from `~/.work-timer/config.json`)
- Setup guide uses PowerShell-compatible syntax for Windows paths

## [1.0.0] - 2026-03-25

### Added

- Timer management: start, stop, pause, resume timers for named projects
- Overlapping timers: run multiple timers simultaneously for different projects
- Project configuration: per-project billing rate, currency, and minimum billing block
- Global defaults: fallback rate, currency, and min block for projects without specific settings
- Billing calculations: duration tracking with pause support, min-block rounding, amount calculation
- Invoice tracking: mark sessions as invoiced (with optional reference) and paid
- CSV export: plain-text export compatible with all accounting software
- XLSX export: formatted Excel workbook with styled headers and totals
- MCP server: 15 tools for natural language control via Claude, Cursor, etc.
- CLI: full command-line interface with Commander.js
- Cloud database: Turso (libSQL) for cross-device data access
- Interactive setup wizard: `work-timer setup` for first-time configuration
- Comprehensive documentation: setup, CLI reference, MCP tools, billing logic, export, invoicing, contributing
