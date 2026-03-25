# Configuration

Work-Timer has two layers of configuration: connection settings (how to reach the database) and billing defaults (how to calculate charges).

## Connection Configuration

### Config File

Location: `~/.work-timer/config.json`

```json
{
  "turso_url": "libsql://work-timer-yourname.turso.io",
  "turso_auth_token": "eyJ...your-token..."
}
```

Created automatically by `work-timer setup`.

### Environment Variables

Environment variables take precedence over the config file:

| Variable | Description |
|----------|-------------|
| `TURSO_DATABASE_URL` | Turso database URL (starts with `libsql://`) |
| `TURSO_AUTH_TOKEN` | Turso authentication token |

These are useful for CI environments, Docker containers, or when you want to switch between databases.

## Billing Defaults

Global defaults are stored in the database and apply to any project that doesn't have its own specific value.

### View Current Defaults

```bash
work-timer config get
```

### Available Settings

| Key | Description | Default | Example |
|-----|-------------|---------|---------|
| `default_rate` | Billing rate per hour | `0` | `150` |
| `default_currency` | Currency code | `USD` | `EUR`, `GBP`, `AUD` |
| `default_min_block_minutes` | Minimum billing block in minutes | `15` | `6`, `30`, `60` |

### Update Defaults

```bash
work-timer config set default_rate 150
work-timer config set default_currency EUR
work-timer config set default_min_block_minutes 15
```

### How Defaults Work

When calculating billing for a session, Work-Timer resolves each parameter in order:

1. **Project-specific value** — If the project has a `billing_rate`, `currency`, or `min_block_minutes` set, that value is used.
2. **Global default** — If the project value is null, the global default is used.

This means you can set your most common rate as the global default and only override it for projects with different rates.

**Example:**

```bash
# Set global defaults
work-timer config set default_rate 150
work-timer config set default_currency USD

# Create a project with specific rate (overrides default)
work-timer project create "Premium Client" --rate 250 --currency EUR

# Create a project using defaults (150 USD/hr)
work-timer project create "Regular Client"
```

## Project-Level Settings

Each project can have its own billing configuration:

| Setting | Description | Falls back to |
|---------|-------------|---------------|
| `billing_rate` | Rate per hour | `default_rate` |
| `currency` | Currency code | `default_currency` |
| `min_block_minutes` | Minimum billing block | `default_min_block_minutes` |

Set these when creating or updating a project:

```bash
work-timer project create "Client" --rate 200 --currency GBP --min-block 30
work-timer project update "Client" --rate 225
```

## Data Location

| Item | Location |
|------|----------|
| Config file | `~/.work-timer/config.json` |
| Database | Turso cloud (URL in config) |
| Exports | Wherever you specify with `--output` |
