# Setup Guide

Complete instructions for installing and configuring Work-Timer.

## Prerequisites

- **Node.js** 18 or later ([download](https://nodejs.org))
- **npm** (included with Node.js)
- A free **Turso** account ([sign up](https://turso.tech))

## Step 1: Install Work-Timer

### From Source (Recommended)

```bash
git clone https://github.com/JoelBondoux/Work-Timer.git
cd Work-Timer
npm install
npm run build
```

To make the `work-timer` command available globally:

```bash
npm link
```

You can now run `work-timer` from any directory.

> **Windows users:** If `work-timer` is not recognized after `npm link`, see the [Windows troubleshooting section](#npm-link-not-working-on-windows) below.

### Verify Installation

```bash
work-timer --version
# Should output: 1.1.1
```

## Step 2: Create a Turso Database

Work-Timer uses [Turso](https://turso.tech) for cloud database storage. The free tier includes 9GB of storage and 500 million reads per month — far more than any solo contractor needs.

### Option A: Turso Web Dashboard (Recommended for Windows)

1. Sign up or log in at [app.turso.tech](https://app.turso.tech)
2. Create a new database (name it `work-timer` or anything you like)
3. Copy the **Database URL** — it looks like `libsql://work-timer-yourname.turso.io`
4. Generate an **Auth Token** from the database settings and copy it

You'll need both values in Step 3.

### Option B: Turso CLI (macOS / Linux)

Install the Turso CLI:

```bash
curl -sSfL https://get.tur.so/install.sh | bash
```

Create your database and get credentials:

```bash
turso auth login
turso db create work-timer

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
The auth token input is hidden while you type.

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

Edit (or create) your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json` (in PowerShell: `"$env:APPDATA\Claude\claude_desktop_config.json"`)

**Windows — quick setup (run in PowerShell):**

```powershell
$configDir = "$env:APPDATA\Claude"
$configFile = "$configDir\claude_desktop_config.json"
if (!(Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir | Out-Null }
if (!(Test-Path $configFile)) { '{}' | Set-Content $configFile }
notepad $configFile
```

Then paste the following config (adjust the path to where you cloned Work-Timer):

```json
{
  "mcpServers": {
    "work-timer": {
      "command": "node",
      "args": ["C:/Users/yourname/path/to/Work-Timer/dist/mcp/server.js"]
    }
  }
}
```

The MCP server reads credentials from `~/.work-timer/config.json` (created by `work-timer setup`) or environment variables automatically — no need to put tokens in this file.

**macOS / Linux:**

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or create it if needed, with the same JSON content above (using your actual path).

### Claude Code

Run this in VS Code's integrated terminal (`` Ctrl+` ``):

```bash
claude mcp add work-timer -- node /absolute/path/to/Work-Timer/dist/mcp/server.js
```

To verify it was added, type `/mcp` in the Claude Code chat panel. You can also manage (enable/disable/reconnect) servers from there.

### ChatGPT Desktop

MCP support in ChatGPT requires a Plus or Pro subscription and Developer Mode.

1. Open ChatGPT Desktop and go to **Settings > Connectors > Create**
2. Add a new MCP connector with the command: `node /absolute/path/to/Work-Timer/dist/mcp/server.js`

See [OpenAI's MCP documentation](https://developers.openai.com/api/docs/mcp) for full details.

### GitHub Copilot (VS Code)

You can configure MCP servers at the workspace level or user level.

**Option A: Workspace level** — add to any project that should have access to Work-Timer:

```powershell
# Run from your project's root directory
$dir = ".vscode"
if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
if (!(Test-Path "$dir\mcp.json")) { '{}' | Set-Content "$dir\mcp.json" }
notepad "$dir\mcp.json"
```

**Option B: User level** — available in all workspaces. Open the VS Code command palette (`Ctrl+Shift+P`) and run **MCP: Open User Configuration**.

Then paste:

```json
{
  "servers": {
    "work-timer": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/Work-Timer/dist/mcp/server.js"]
    }
  }
}
```

See [VS Code MCP documentation](https://code.visualstudio.com/docs/copilot/customization/mcp-servers) for more options.

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

There are two common issues with `npm link` on Windows:

**1. `work-timer` is not recognized as a command**

npm's global bin directory may not be in your system PATH. To fix:

```powershell
# Find where npm installs global commands
npm prefix -g
# Usually: C:\Users\yourname\AppData\Roaming\npm
```

Add that directory to your PATH permanently:

```powershell
# Run in PowerShell (no admin required)
[Environment]::SetEnvironmentVariable("PATH", [Environment]::GetEnvironmentVariable("PATH", "User") + ";$(npm prefix -g)", "User")
```

Then restart your terminal.

**2. "Running scripts is disabled on this system"**

PowerShell's default execution policy blocks npm global scripts. To fix:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

**Alternative: skip npm link entirely**

If you prefer not to modify system settings, use `npx` from the project directory:

```bash
npx work-timer --version
```

Or run the CLI directly with Node:

```bash
node C:\Users\yourname\path\to\Work-Timer\dist\cli\index.js start "My Project"
```
