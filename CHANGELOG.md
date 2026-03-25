# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
