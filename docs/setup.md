# Setup Guide

Complete instructions for installing and configuring Work-Timer.

## Prerequisites

- **Node.js** 18 or later ([download](https://nodejs.org))
- **npm** (included with Node.js)
- A free **Turso** account ([sign up](https://turso.tech))

## Step 1: Install Work-Timer

### From Source (Recommended)

```bash
git clone https://github.com/YOUR_USERNAME/Work-Timer.git
cd Work-Timer
npm install
npm run build
```

To make the `work-timer` command available globally:

```bash
npm link
```

You can now run `work-timer` from any directory.

### Verify Installation

```bash
work-timer --version
# Should output: 1.0.0
```

## Step 2: Create a Turso Database

Work-Timer uses [Turso](https://turso.tech) for cloud database storage. The free tier includes 9GB of storage and 500 million reads per month — far more than any solo contractor needs.

### Install the Turso CLI

**macOS / Linux:**

```bash
curl -sSfL https://get.tur.so/install.sh | bash
```

**Windows (via scoop):**

```bash
scoop install turso
```

### Create Your Database

```bash
turso auth login
turso db create work-timer
```

### Get Your Credentials

```bash
# Get the database URL
turso db show work-timer --url
# Output: libsql://work-timer-yourname.turso.io

# Create an auth token
turso db tokens create work-timer
# Output: eyJ...long-token...
```

## Step 3: Configure Work-Timer

### Option A: Interactive Setup (Recommended)

```bash
work-timer setup
```

This will prompt you for your Turso URL and token, and save them to `~/.work-timer/config.json`.

### Option B: Environment Variables

Set these in your shell profile (`.bashrc`, `.zshrc`, PowerShell profile, etc.):

```bash
export TURSO_DATABASE_URL="libsql://work-timer-yourname.turso.io"
export TURSO_AUTH_TOKEN="eyJ...your-token..."
```

Environment variables take precedence over the config file.

### Option C: Config File

Manually create `~/.work-timer/config.json`:

```json
{
  "turso_url": "libsql://work-timer-yourname.turso.io",
  "turso_auth_token": "eyJ...your-token..."
}
```

## Step 4: Configure MCP Client (Optional)

To use Work-Timer with an AI assistant, add it as an MCP server.

### Claude Desktop

Edit your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "work-timer": {
      "command": "node",
      "args": ["/absolute/path/to/Work-Timer/dist/mcp/server.js"],
      "env": {
        "TURSO_DATABASE_URL": "libsql://work-timer-yourname.turso.io",
        "TURSO_AUTH_TOKEN": "your-token"
      }
    }
  }
}
```

### Claude Code

Add to your project or user settings:

```json
{
  "mcpServers": {
    "work-timer": {
      "command": "node",
      "args": ["/absolute/path/to/Work-Timer/dist/mcp/server.js"]
    }
  }
}
```

If you've already configured `~/.work-timer/config.json`, you don't need to pass env vars.

### Cursor

Add to your Cursor MCP settings (Settings > MCP Servers):

```json
{
  "work-timer": {
    "command": "node",
    "args": ["/absolute/path/to/Work-Timer/dist/mcp/server.js"]
  }
}
```

## Step 5: Set Your Defaults

Configure your default billing rate and currency:

```bash
work-timer config set default_rate 150
work-timer config set default_currency USD
work-timer config set default_min_block_minutes 15
```

Or via your AI assistant: "Set my default billing rate to 150 USD per hour with 15-minute blocks."

## Verification

Test that everything works:

```bash
work-timer start "Test Project" --rate 100
work-timer status
work-timer stop
work-timer query "Test Project"
```

You should see the timer start, show in status, stop, and appear in the billing query.

## Troubleshooting

### "Work-Timer is not configured"

Run `work-timer setup` or set the `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` environment variables.

### "Failed to connect to database"

- Check your Turso URL is correct (should start with `libsql://`)
- Verify your auth token hasn't expired: `turso db tokens create work-timer`
- Check your internet connection

### MCP server not appearing in Claude

- Ensure the path to `dist/mcp/server.js` is absolute
- Restart Claude Desktop/Cursor after config changes
- Check the MCP server logs in your client's developer console

### npm link not working on Windows

Use the full path instead:

```bash
node C:\Users\yourname\path\to\Work-Timer\dist\cli\index.js start "My Project"
```

Or add the dist/cli directory to your PATH.
