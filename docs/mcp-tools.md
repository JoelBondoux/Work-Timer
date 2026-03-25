# MCP Tools Reference

Work-Timer exposes 16 MCP tools that any compatible AI assistant can call. This document describes each tool, its parameters, and example natural language prompts.

## How It Works

When you add Work-Timer as an MCP server to your AI assistant (Claude Desktop, ChatGPT, GitHub Copilot, Cursor, etc.), the assistant can call these tools on your behalf. You simply speak naturally, and the assistant maps your intent to the right tool.

## Timer Tools

### `timer_start`

Start a timer for a project. Creates the project automatically if it doesn't exist.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project` | string | Yes | Project name |
| `rate` | number | No | Billing rate per hour |
| `currency` | string | No | Currency code (USD, EUR, GBP, etc.) |
| `notes` | string | No | Notes for this session |

**Example prompts:**
- "Start a timer for Client Alpha"
- "Start tracking time on the Website Redesign project at 200 EUR per hour"
- "Begin timing the API migration, note that this is the auth module"

**Example response:**
```
Timer started for "Client Alpha" (session #5)
Started at: 2026-03-25T14:30:00
```

### `timer_stop`

Stop a running or paused timer.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project` | string | No | Project name (defaults to most recent) |

**Example prompts:**
- "Stop the timer"
- "Stop tracking time on Client Alpha"
- "I'm done working for now"

### `timer_pause`

Pause a running timer. Paused time is not billed.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project` | string | No | Project name (defaults to most recent running timer) |

**Example prompts:**
- "Pause the timer"
- "Taking a break from Client Alpha"
- "Pause my current session"

### `timer_resume`

Resume a paused timer.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project` | string | No | Project name (defaults to most recently paused timer) |

**Example prompts:**
- "Resume the timer"
- "Back to work on Client Alpha"
- "Unpause my session"

### `timer_status`

Show all currently running and paused timers with elapsed time.

**Parameters:** None

**Example prompts:**
- "What timers are running?"
- "Show me my active timers"
- "Am I tracking any time right now?"

**Example response:**
```
Running Timers:
  #12 Client Alpha  01:23:45  (started 2026-03-25T09:15:00)
  #13 Side Project  00:45:12  (started 2026-03-25T10:30:00, PAUSED)
```

## Project Tools

### `project_create`

Create a new project with optional billing settings.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | Yes | Project name |
| `rate` | number | No | Billing rate per hour |
| `currency` | string | No | Currency code |
| `min_block_minutes` | number | No | Minimum billing block in minutes |

**Example prompts:**
- "Create a project called Client Beta at 200 GBP per hour with 30-minute billing blocks"
- "Set up a new project for the Mobile App"

### `project_update`

Update a project's billing settings.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | Yes | Project name |
| `rate` | number | No | New billing rate |
| `currency` | string | No | New currency |
| `min_block_minutes` | number | No | New minimum billing block |
| `archived` | boolean | No | Archive or unarchive |

**Example prompts:**
- "Update Client Alpha's rate to 175 per hour"
- "Archive the Old Client project"
- "Change the Website Redesign billing to 6-minute blocks"

### `project_list`

List all projects.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `include_archived` | boolean | No | Include archived projects |

**Example prompts:**
- "Show me all my projects"
- "List projects including archived ones"

## Billing & Query Tools

### `time_query`

Query time spent on projects with date range filters. Returns detailed billing records and totals.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project` | string | No | Filter by project name |
| `from` | string | No | Start date (YYYY-MM-DD) |
| `to` | string | No | End date (YYYY-MM-DD) |

**Example prompts:**
- "How much time have I spent on Client Alpha?"
- "Show me my billing for March 2026"
- "What's the total for the Website Redesign project this quarter?"
- "How many hours did I work last week?"

### `billing_summary`

Calculate billing amounts with payment status filters.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project` | string | No | Filter by project |
| `unbilled_only` | boolean | No | Only uninvoiced sessions |
| `unpaid_only` | boolean | No | Only unpaid sessions |

**Example prompts:**
- "What's my unbilled total?"
- "How much does Client Alpha owe me?"
- "Show me all unpaid sessions"
- "What haven't I invoiced yet?"

## Invoice Tools

### `mark_invoiced`

Mark completed sessions as invoiced.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `session_ids` | number[] | Yes | Session IDs to mark |
| `invoice_ref` | string | No | Invoice reference number |

**Example prompts:**
- "Mark sessions 5, 6, and 7 as invoiced with reference INV-2026-003"
- "I've invoiced those sessions"

### `mark_paid`

Mark completed sessions as paid.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `session_ids` | number[] | Yes | Session IDs to mark |

**Example prompts:**
- "Mark sessions 5, 6, and 7 as paid"
- "Client Alpha has paid for those sessions"

## Export Tools

### `export_csv`

Export billing data as CSV text.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project` | string | No | Filter by project |
| `from` | string | No | Start date |
| `to` | string | No | End date |

**Example prompts:**
- "Export my billing as CSV"
- "Give me a CSV of Client Alpha's time for January"

### `export_xlsx`

Export billing data as a formatted Excel workbook.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project` | string | No | Filter by project |
| `from` | string | No | Start date |
| `to` | string | No | End date |
| `output_path` | string | Yes | Relative file path under `~/.work-timer/exports` for the `.xlsx` file |

**Example prompts:**
- "Export my billing as an Excel file to ~/Desktop/billing.xlsx"
- "Create an Excel report for Client Alpha"

### `export_preset`

Export billing data as CSV formatted for a specific accounting package (QuickBooks, Xero, FreshBooks, Sage, MYOB).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `preset` | enum | Yes | Target: `quickbooks`, `xero`, `freshbooks`, `sage`, `myob` |
| `project` | string | No | Filter by project |
| `from` | string | No | Start date |
| `to` | string | No | End date |
| `output_path` | string | No | Relative file path under `~/.work-timer/exports` (if omitted, returns CSV text) |
| `account_code` | string | No | Account code (Xero, Sage, MYOB) |
| `tax_type` | string | No | Tax type (Xero, Sage) |
| `payment_terms_days` | number | No | Payment terms in days for DueDate (default 30) |

**Example prompts:**
- "Export my March billing for QuickBooks"
- "Export Client Alpha's time in Xero format with account code 400"
- "Create a Sage export for Q1 and save it to billing.csv"
- "Export all unbilled sessions for FreshBooks"

## Settings Tool

### `settings_update`

View or update global default settings.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | enum | No | Setting key (omit to view all) |
| `value` | string | No | New value |

**Valid keys:** `default_rate`, `default_currency`, `default_min_block_minutes`

**Example prompts:**
- "What are my current settings?"
- "Set my default rate to 150 per hour"
- "Change the default currency to EUR"
- "Set minimum billing blocks to 6 minutes"
