# PowerShell Output Style Guide

This guide defines the standard output style for Work-Timer PowerShell and terminal-facing CLI commands.

Use this guide for all current and future user-facing command output where readability matters (especially setup, install, doctor, export, and diagnostic flows).

## Goals

- Make important outcomes obvious at a glance.
- Keep long, multi-step instructions readable in a narrow terminal.
- Use consistent visual language across commands.
- Preserve plain-text compatibility when color is unavailable.

## Design System

### Structural Patterns

- Use bordered panels for major sections.
- Use horizontal separators between result groups.
- Keep a predictable section order:
  1. Header panel (context)
  2. Results section (per target/action)
  3. Summary panel
  4. Tips / next actions
- Include blank spacer lines only when they improve scannability.

### Status Vocabulary (Canonical)

Use these status labels consistently:

- `updated`
- `created`
- `unchanged`
- `skipped`
- `error`
- `warn` (diagnostic commands only)

If command internals need finer statuses (for example `skipped-missing`), map them into user-facing grouped labels while retaining detailed text in the body.

### Color Mapping

- Success (`updated`, `created`): green
- Stable/no-op (`unchanged`): blue
- Attention (`skipped`, `warn`): yellow
- Failure (`error`): red
- Section chrome and neutral emphasis: cyan + dim where appropriate

Color must be additive, not required for understanding.

## Content Rules

### Header Panel

Must include:

- Command/workflow name
- Execution mode (apply/dry-run)
- Scope/target count
- Key path inputs when relevant

### Per-Result Panels

Each result block should contain:

- Subject identity (client/project/file)
- Status tag
- Human-readable outcome sentence
- Optional backup/output path
- Actionable manual follow-up when needed

When manual follow-up is shown:

- Use numbered steps (`1.`, `2.`, `3.`)
- Keep one action per step
- Preserve indentation for multi-line snippets

### Summary Panel

Always include totals by category, for example:

- Updated/created
- Unchanged
- Skipped
- Errors

If errors are zero, include a concise success next-step line.
If errors are non-zero, include clear remediation direction.

## Readability Standards

- Target terminal width: flexible, typically 76-120 columns.
- Wrap long lines predictably; avoid hard truncation.
- Preserve leading indentation on wrapped instructional lines.
- Avoid dense paragraphs; prefer concise sentence lines.
- Keep JSON/manual snippets visually aligned inside panel bodies.

## Accessibility and Fallback Behavior

- Respect `NO_COLOR=1` / non-TTY output and disable ANSI styling.
- Output must remain fully readable in monochrome logs.
- Do not rely on symbols alone for severity; include text labels.

## Implementation Guidance

- Prefer shared helpers for:
  - color detection
  - ANSI-safe width calculations
  - line wrapping with indentation preservation
  - panel rendering
  - status tag rendering
- Keep formatting logic separate from business logic.
- Ensure deterministic output order for stable testing.

## Testing Expectations

For output-focused changes:

- Run `npm run build`, `npm test`, and `npm run check:production`.
- Add or update snapshot-style/assertion tests when practical for structured output helpers.
- Verify both color-enabled and no-color output manually for major UX updates.

## Adoption Requirement

All new or significantly revised PowerShell/terminal outputs should follow this style guide.

When existing command output is touched for functional work, align that output with this guide as part of the same change when practical.
