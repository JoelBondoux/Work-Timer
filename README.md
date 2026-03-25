# Work-Timer

A zero-cost, open-source work timer and billing tool built for solo contractors and freelancers. Control it with natural language through any MCP-compatible AI assistant (Claude, Cursor, etc.) or via the command line.

## Features

- **Natural language control** — "Start a timer for Project Alpha", "How much time on Client X this month?"
- **MCP server** — Works with Claude Desktop, ChatGPT, GitHub Copilot, Cursor, and any MCP-compatible client
- **CLI** — Full command-line interface for quick manual use
- **Overlapping timers** — Bill multiple clients simultaneously
- **Flexible billing** — Per-project rates, currencies, and minimum billing blocks with global defaults
- **Invoice tracking** — Mark sessions as invoiced and paid with reference numbers
- **Export** — CSV, Excel (XLSX), and accounting-specific presets (QuickBooks, Xero, FreshBooks, Sage, MYOB)
- **Cloud sync** — Turso database means your data is accessible from any device
- **Free** — Turso free tier (9GB, 500M reads/mo) is more than enough for any solo practice

## Quick Start

### 1. Install

```bash
git clone https://github.com/JoelBondoux/Work-Timer.git
cd Work-Timer
npm install
npm run build
npm link  # Makes 'work-timer' available globally
```

> **Windows users:** `npm link` may require adding npm's global bin to your PATH and setting PowerShell's execution policy. See the [Setup Guide](docs/setup.md#npm-link-not-working-on-windows) for details.

### 2. Set Up Database

Create a free [Turso](https://turso.tech) account and set up a database:

**Via web dashboard (recommended for Windows):** Go to [app.turso.tech](https://app.turso.tech), create a database, and copy the database URL and auth token from the database settings.

**Via CLI (macOS / Linux):**

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
turso db create work-timer
turso db show work-timer --url       # Copy this
turso db tokens create work-timer    # Copy this
```

Run the setup wizard:

```bash
work-timer setup
```

Or set environment variables:

```bash
export TURSO_DATABASE_URL="libsql://your-db-url.turso.io"
export TURSO_AUTH_TOKEN="your-token"
```

### 3. Start Tracking

**Via CLI:**

```bash
work-timer start "Client Alpha"
# ... work for a while ...
work-timer stop
work-timer query "Client Alpha"
```

**Via AI assistant (MCP):**

Add to your MCP client configuration (Claude Desktop, ChatGPT, GitHub Copilot, Cursor — see [Setup Guide](docs/setup.md#step-4-configure-mcp-client-optional) for each):

```json
{
  "mcpServers": {
    "work-timer": {
      "command": "node",
      "args": ["/path/to/Work-Timer/dist/mcp/server.js"]
    }
  }
}
```

Then just talk naturally:

> "Start a timer for the Website Redesign project"
> "Pause the timer"
> "How much time have I spent on Website Redesign this week?"
> "Export my billing for January as Excel"

## Documentation

| Guide | Description |
|-------|-------------|
| [Setup Guide](docs/setup.md) | Full installation and configuration instructions |
| [CLI Reference](docs/cli-reference.md) | Every CLI command with examples |
| [MCP Tools Reference](docs/mcp-tools.md) | Every MCP tool with parameters and example prompts |
| [Configuration](docs/configuration.md) | Global defaults, project settings, environment variables |
| [Billing Logic](docs/billing.md) | How duration, rounding, and amounts are calculated |
| [Export Guide](docs/export.md) | CSV and XLSX export formats and accounting software import |
| [Invoicing Guide](docs/invoicing.md) | Tracking invoices and payments |
| [Contributing](docs/contributing.md) | Developer setup, architecture, and PR guidelines |

## How It Works

Work-Timer stores all data in a [Turso](https://turso.tech) cloud database (a hosted SQLite-compatible service). This means:

- Your time data syncs across all your devices automatically
- No server to run or maintain
- The free tier is generous enough for any solo contractor
- All timestamps are stored in UTC for consistency

Both the MCP server and CLI use the same core logic, so behavior is identical regardless of how you interact with Work-Timer.

## Architecture

```
src/
  types.ts          # Shared TypeScript interfaces
  db/
    schema.ts       # Database schema and migrations
    client.ts       # Turso client management
  core/
    timer.ts        # Start/stop/pause/resume logic
    projects.ts     # Project CRUD operations
    billing.ts      # Duration and billing calculations
    settings.ts     # Global default settings
    sessions.ts     # Session queries and invoice marking
    export.ts       # CSV, XLSX, and accounting preset export
    presets.ts      # Accounting software export presets
    format.ts       # Text formatting for output
  mcp/
    server.ts       # MCP server with 16 tool definitions
  cli/
    index.ts        # CLI entry point with Commander.js
```

## License

[MIT](LICENSE)
