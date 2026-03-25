# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
