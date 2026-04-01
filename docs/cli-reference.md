# CLI Reference

Complete reference for all Work-Timer CLI commands.

## Maintenance Commands

### `work-timer update`

Update Work-Timer (including the MCP server) to the latest version from GitHub.

```bash
work-timer update
```

Behavior:
- Prints beginner-friendly step-by-step progress messages during update
- Runs `npm install -g https://codeload.github.com/JoelBondoux/Work-Timer/tar.gz/refs/heads/master`
- Falls back to Node's bundled `npm-cli.js` if `npm` is not resolvable on PATH
- On Windows, auto-adds npm global bin (from `npm prefix -g`) to user PATH when missing
- Prints the globally installed MCP server path (`.../work-timer/dist/mcp/server.js`)
- Shows full npm output when update fails (instead of a generic error)
- Useful when your MCP client points to a hardcoded server path and you want the newest release quickly

Update notifications:
- `work-timer start` and `work-timer stop` check daily for newer GitHub builds
- If a newer version exists, CLI announces it and asks `Update now? [y/N]`
- If you skip that prompt, the same version is not announced again; you are prompted only when a newer version appears
- Set `WORK_TIMER_DISABLE_UPDATE_CHECK=1` to disable this behavior

### `work-timer uninstall`

Uninstall Work-Timer from the global npm location.

```bash
work-timer uninstall
work-timer uninstall --yes
work-timer uninstall --purge-local C:\\Users\\yourname\\Work-Timer
```

Behavior:
- Runs `npm uninstall -g work-timer`
- Prompts for confirmation unless `--yes` is passed
- If your current terminal still resolves `work-timer` after uninstall, open a new terminal session
- Optional `--purge-local <path>` safely removes a local Work-Timer source folder after uninstall
- Local purge requires explicit confirmation (or `--yes`) and refuses to delete non-Work-Timer folders

### `work-timer mcp list`

List known MCP client targets and whether their local config is detected.

```bash
work-timer mcp list
```

### `work-timer mcp install`

Programmatically install/update Work-Timer MCP registration across supported local clients.

```bash
work-timer mcp install
work-timer mcp install --dry-run
work-timer mcp install --create-missing
work-timer mcp install --clients claude-desktop,cursor,vscode
work-timer mcp install --server-path /absolute/path/to/server.js
```

Options:

| Flag | Description |
|------|-------------|
| `--clients <ids>` | Comma-separated client IDs (`claude-desktop,cursor,vscode,vscode-insiders,claude-code,chatgpt-desktop`) |
| `--server-path <path>` | Override MCP server path (defaults to this Work-Timer install's `dist/mcp/server.js`) |
| `--create-missing` | Create missing JSON config files/directories for supported clients |
| `--dry-run` | Preview operations without writing files or running commands |

Behavior:
- Existing config files are backed up before rewrite (`.bak.<timestamp>`).
- `claude-code` uses command-mode install via `claude mcp add ...`.
- `chatgpt-desktop` is reported as manual because connector creation is currently in-app.
- If auto-install fails, CLI prints client-specific manual follow-up steps to complete setup.
- Prints a beginner-friendly run summary with counts for updated/unchanged/skipped/error results.
- Prints a recommended client system prompt that tells LLMs to call `work_timer_help` first for capability questions.

### `work-timer setup`

Interactive guided setup for Turso credentials.

```bash
work-timer setup
```

Behavior:
- Prints explicit step-by-step progress while collecting credentials and writing config.
- Hides token input while typing.
- Ends with a short quick-start walkthrough of first commands to run.

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

`--rate` must be a non-negative finite number.

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

Validation rules:
`--rate` must be a non-negative finite number.
`--min-block` must be an integer between `0` and `1440`.

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

Validation rules:
`--rate` must be a non-negative finite number.
`--min-block` must be an integer between `0` and `1440`.

### `work-timer projects`

List all active projects.

```bash
work-timer projects         # Active projects only
work-timer projects --all   # Include archived projects
```

### `work-timer project rename <old-name> <new-name>`

Rename an existing project.

```bash
work-timer project rename "ProjectName" "Project Name"
```

### `work-timer project delete <name> [--force]`

Delete a project.

```bash
work-timer project delete "Old Project"
work-timer project delete "Old Project" --force
```

Behavior:
- Without `--force`, deletion is blocked if sessions exist.
- With `--force`, the CLI requires typing `yes` before permanently deleting project + sessions.
- Deletion is blocked if the project has a running or paused timer.

### `work-timer project merge <source> <target>`

Move all sessions from source project into target project, then delete source.

```bash
work-timer project merge "ProjectName" "Project Name"
```

Behavior:
- Requires typing `yes` confirmation.
- Blocked if the source project has a running or paused timer.

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

Session IDs must be positive integers.

**Options:**

| Flag | Description |
|------|-------------|
| `--ref <reference>` | Invoice reference number |

### `work-timer paid <session-ids...>`

Mark one or more sessions as paid.

```bash
work-timer paid 1 2 3   # Mark sessions 1, 2, 3 as paid
```

Session IDs must be positive integers.

## Session Commands

### `work-timer session adjust <session-id>`

Adjust session start and/or end timestamps.

```bash
work-timer session adjust 42 --start 2026-03-31T09:00:00
work-timer session adjust 42 --end 2026-03-31T17:30:00
work-timer session adjust 42 --start 2026-03-31T09:00:00 --end 2026-03-31T17:30:00
```

Options:

| Flag | Description |
|------|-------------|
| `--start <datetime>` | New local start datetime (`YYYY-MM-DDTHH:MM:SS`) |
| `--end <datetime>` | New local end datetime (`YYYY-MM-DDTHH:MM:SS`) |

Behavior:
- Input datetimes are interpreted as local time and converted to UTC for database storage.
- End time can only be adjusted for completed sessions.
- `start` must be before `end`.

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

`--payment-terms` must be an integer between `0` and `3650`.

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
