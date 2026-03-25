# Invoicing Guide

How to track invoices and payments in Work-Timer.

## Overview

Work-Timer doesn't generate invoices directly — it tracks which time sessions have been invoiced and paid. This lets you:

- Know exactly what work hasn't been billed yet
- Track which invoices have been paid
- Associate sessions with specific invoice reference numbers
- Export only unbilled or unpaid sessions for invoicing

## Typical Workflow

### 1. Work and Track Time

```bash
work-timer start "Client Alpha"
# ... do work ...
work-timer stop
```

### 2. Review Unbilled Sessions

```bash
work-timer summary --unbilled
```

This shows all completed sessions that haven't been invoiced yet, with their session IDs, duration, and amounts.

### 3. Create Your Invoice

Use your preferred invoicing tool (Xero, QuickBooks, FreshBooks, a Word template, etc.) to create the invoice based on the session data.

### 4. Mark Sessions as Invoiced

```bash
work-timer invoice 5 6 7 --ref "INV-2026-003"
```

This marks sessions 5, 6, and 7 as invoiced with the reference "INV-2026-003". The reference is optional but recommended for cross-referencing.

### 5. Track Payment

When the client pays:

```bash
work-timer paid 5 6 7
```

### 6. Verify

```bash
work-timer summary --unpaid   # Shows what's still outstanding
```

## Session States

Each session tracks two independent statuses:

| Field | Values | Set by |
|-------|--------|--------|
| `invoiced_at` | null or timestamp | `work-timer invoice` |
| `invoice_ref` | null or string | `work-timer invoice --ref` |
| `paid_at` | null or timestamp | `work-timer paid` |

A session can be:
- **Not invoiced, not paid** — Work completed, not yet billed
- **Invoiced, not paid** — Invoice sent, awaiting payment
- **Invoiced and paid** — Fully settled
- **Paid but not invoiced** — Unusual, but possible (e.g., advance payment)

## Finding Session IDs

To mark sessions as invoiced or paid, you need their IDs. Find them with:

```bash
# Show unbilled sessions (includes session IDs in the output)
work-timer summary --unbilled

# Show all sessions for a specific project
work-timer query "Client Alpha"

# Show unpaid sessions
work-timer summary --unpaid
```

Session IDs are shown as `#1`, `#2`, etc. in all output.

## Using with MCP

Via your AI assistant:

> "What sessions haven't been invoiced yet?"

> "Mark sessions 5, 6, and 7 as invoiced with reference INV-2026-003"

> "Client Alpha just paid — mark their sessions as paid"

> "How much is still outstanding across all clients?"

## Export for Accounting

To export only uninvoiced sessions for creating an invoice:

```bash
# First review what needs invoicing
work-timer summary --project "Client Alpha" --unbilled

# Export to create the invoice
work-timer export --project "Client Alpha" --format xlsx --output client-alpha-march.xlsx
```

After creating the invoice in your accounting software, mark the sessions:

```bash
work-timer invoice 10 11 12 --ref "INV-2026-004"
```

## Best Practices

1. **Use invoice references** — Always include `--ref` when marking invoiced. This creates an audit trail connecting your time records to your accounting system.

2. **Invoice promptly** — Run `work-timer summary --unbilled` regularly (weekly or monthly) to catch any uninvoiced work.

3. **Batch by client** — Invoice all sessions for a client in one batch, using the same `--ref`.

4. **Export before marking** — Export the sessions first for your invoice, then mark them. This ensures the export matches exactly what you're billing.

5. **Track partial payments** — If a client pays only part of an invoice, mark only the paid sessions. The remaining sessions will show in `--unpaid` queries.
