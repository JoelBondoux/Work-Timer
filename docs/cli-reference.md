# CLI Reference

Complete reference for all Work-Timer CLI commands.

## Timer Commands

### `work-timer start <project>`

Start a timer for a project. If the project doesn't exist, it's created automatically.

```bash
work-timer start "Client Alpha"
work-timer start "Website Redesign" --rate 150 --currency EUR
work-timer start "Quick Fix" --notes "Emergency bugfix for login page"
```

**Options:**

| Flag | Description |
|------|-------------|
| `--rate <number>` | Set billing rate per hour (only when creating a new project) |
| `--currency <code>` | Set currency code, e.g. USD, EUR, GBP |
| `--notes <text>` | Add notes to this session |

**Behavior:**
- Creates the project if it doesn't exist
- Fails if the project already has a running or paused timer
- Multiple projects can have timers running simultaneously (overlapping timers)

### `work-timer stop [project]`

Stop a running or paused timer.

```bash
work-timer stop                  # Stops the most recently started timer
work-timer stop "Client Alpha"   # Stops the timer for a specific project
```

**Behavior:**
- If no project is specified, stops the most recently started active timer
- If the timer is paused, the pause is closed automatically before stopping
- Displays the total duration

### `work-timer pause [project]`

Pause a running timer. Paused time is not billed.

```bash
work-timer pause                  # Pauses the most recent running timer
work-timer pause "Client Alpha"   # Pauses a specific project's timer
```

### `work-timer resume [project]`

Resume a paused timer.

```bash
work-timer resume                  # Resumes the most recently paused timer
work-timer resume "Client Alpha"   # Resumes a specific project's timer
```

### `work-timer status`

Show all currently running and paused timers with elapsed time.

```bash
work-timer status
```

**Example output:**

```
Running Timers:
  #12 Client Alpha  01:23:45  (started 2026-03-25T09:15:00)
  #13 Side Project  00:45:12  (started 2026-03-25T10:30:00, PAUSED)
```

## Project Commands

### `work-timer project create <name>`

Create a project with specific billing settings.

```bash
work-timer project create "Client Beta" --rate 200 --currency GBP --min-block 30
work-timer project create "Pro Bono Work"  # Uses global defaults
```

**Options:**

| Flag | Description |
|------|-------------|
| `--rate <number>` | Billing rate per hour |
| `--currency <code>` | Currency code |
| `--min-block <minutes>` | Minimum billing block in minutes |

### `work-timer project update <name>`

Update a project's settings.

```bash
work-timer project update "Client Beta" --rate 250
work-timer project update "Old Client" --archive
work-timer project update "Old Client" --unarchive
```

**Options:**

| Flag | Description |
|------|-------------|
| `--rate <number>` | New billing rate per hour |
| `--currency <code>` | New currency code |
| `--min-block <minutes>` | New minimum billing block |
| `--archive` | Archive the project |
| `--unarchive` | Unarchive the project |

### `work-timer projects`

List all active projects.

```bash
work-timer projects         # Active projects only
work-timer projects --all   # Include archived projects
```

## Billing & Query Commands

### `work-timer query [project]`

Query time and billing records with optional filters.

```bash
work-timer query                                    # All completed sessions
work-timer query "Client Alpha"                     # Specific project
work-timer query --from 2026-01-01 --to 2026-01-31  # Date range
work-timer query "Client Alpha" --from 2026-03-01   # Combined filters
```

**Options:**

| Flag | Description |
|------|-------------|
| `--from <date>` | Start date filter (YYYY-MM-DD) |
| `--to <date>` | End date filter (YYYY-MM-DD) |

### `work-timer summary`

Show a billing summary with filters for payment status.

```bash
work-timer summary                          # All completed sessions
work-timer summary --project "Client Alpha" # Specific project
work-timer summary --unbilled               # Only uninvoiced sessions
work-timer summary --unpaid                 # Only unpaid sessions
```

**Options:**

| Flag | Description |
|------|-------------|
| `--project <name>` | Filter by project |
| `--unbilled` | Only show sessions not yet invoiced |
| `--unpaid` | Only show sessions not yet paid |

## Invoice Commands

### `work-timer invoice <session-ids...>`

Mark one or more sessions as invoiced.

```bash
work-timer invoice 1 2 3                    # Mark sessions 1, 2, 3 as invoiced
work-timer invoice 5 6 --ref "INV-2026-001" # With invoice reference
```

**Options:**

| Flag | Description |
|------|-------------|
| `--ref <reference>` | Invoice reference number |

### `work-timer paid <session-ids...>`

Mark one or more sessions as paid.

```bash
work-timer paid 1 2 3   # Mark sessions 1, 2, 3 as paid
```

## Export Commands

### `work-timer export`

Export billing data as CSV, Excel, or accounting-specific format.

```bash
work-timer export                                           # CSV to stdout
work-timer export --output billing.csv                      # CSV to file
work-timer export --format xlsx --output billing.xlsx       # Excel file
work-timer export --project "Client Alpha" --from 2026-01-01  # Filtered export
work-timer export --preset quickbooks --output march.csv    # QuickBooks format
work-timer export --preset xero --account-code 400          # Xero with custom account
```

**Options:**

| Flag | Description |
|------|-------------|
| `--project <name>` | Filter by project |
| `--from <date>` | Start date filter |
| `--to <date>` | End date filter |
| `--output <file>` | Output file path |
| `--format <fmt>` | `csv` (default) or `xlsx` |
| `--preset <name>` | Accounting preset: `quickbooks`, `xero`, `freshbooks`, `sage`, `myob` |
| `--account-code <code>` | Account code (Xero, Sage, MYOB presets) |
| `--tax-type <type>` | Tax type (Xero, Sage presets) |
| `--payment-terms <days>` | Payment terms in days for DueDate (default 30) |

When `--preset` is used, the output is always CSV in the target accounting format. The `--format` flag is ignored.

## Configuration Commands

### `work-timer config get [key]`

View current settings.

```bash
work-timer config get                          # Show all settings
work-timer config get default_rate             # Show specific setting
```

### `work-timer config set <key> <value>`

Update a global default setting.

```bash
work-timer config set default_rate 150
work-timer config set default_currency EUR
work-timer config set default_min_block_minutes 30
```

**Valid keys:**

| Key | Description | Example |
|-----|-------------|---------|
| `default_rate` | Default billing rate per hour | `150` |
| `default_currency` | Default currency code | `USD` |
| `default_min_block_minutes` | Default minimum billing block | `15` |

## Setup Command

### `work-timer setup`

Interactive setup wizard for configuring your Turso database connection.

```bash
work-timer setup
```

Prompts for your Turso database URL and auth token, then saves them to `~/.work-timer/config.json`.

## Project Name Matching

Project names are matched case-insensitively. These all refer to the same project:

```bash
work-timer start "Client Alpha"
work-timer stop "client alpha"
work-timer query "CLIENT ALPHA"
```

The original casing is preserved as entered when the project was created.
