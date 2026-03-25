# Billing Logic

How Work-Timer calculates duration and billing amounts.

## Duration Calculation

For each completed session:

```
Raw Duration = End Time - Start Time - Total Pause Time
```

Pause time is calculated by summing all pause intervals within the session:

```
Total Pause Time = Σ (pause_end - pause_start) for each pause in the session
```

If a session is still running (not yet stopped), the current time is used as the end time for display purposes. Similarly, if a pause is still open (not yet resumed), the current time is used as the pause end.

All times are stored in UTC to avoid timezone issues.

## Minimum Billing Block

Many contractors bill in minimum increments (e.g., 15-minute blocks, 6-minute blocks). Work-Timer rounds up to the nearest block:

```
Billed Duration = ⌈Raw Duration / Min Block⌉ × Min Block
```

### Examples

With a **15-minute** minimum block:

| Raw Duration | Billed Duration |
|--------------|----------------|
| 7 minutes | 15 minutes |
| 15 minutes | 15 minutes |
| 16 minutes | 30 minutes |
| 45 minutes | 45 minutes |
| 52 minutes | 60 minutes |

With a **6-minute** (0.1 hour) minimum block:

| Raw Duration | Billed Duration |
|--------------|----------------|
| 3 minutes | 6 minutes |
| 6 minutes | 6 minutes |
| 7 minutes | 12 minutes |
| 25 minutes | 30 minutes |

**Special cases:**
- If `min_block_minutes` is `0`, no rounding is applied
- Zero-duration sessions are billed as 0

## Amount Calculation

```
Amount = (Billed Duration in minutes / 60) × Rate per hour
```

Amounts are rounded to 2 decimal places (cents).

### Examples

| Billed Duration | Rate | Amount |
|----------------|------|--------|
| 60 min | $100/hr | $100.00 |
| 15 min | $100/hr | $25.00 |
| 45 min | $150/hr | $112.50 |
| 90 min | $200/hr | $300.00 |

## Rate Resolution

For each session, the billing rate is determined by checking:

1. The project's `billing_rate` (if set)
2. The global `default_rate` (fallback)

The same resolution applies to `currency` and `min_block_minutes`.

## Overlapping Timers

Work-Timer allows multiple timers to run simultaneously. Each timer bills independently — if you're working on two projects at the same time, both accumulate time.

This is useful for:
- Meetings that span multiple client projects
- Background tasks (monitoring, builds) while doing focused work
- Shared overhead time across projects

There is no special logic for overlapping — each session is billed based on its own start/end times and pauses, regardless of other running sessions.

## Currency Handling

Work-Timer stores currency as a string code (USD, EUR, GBP, etc.) but does not perform currency conversion. Each project uses a single currency for all its sessions.

When generating billing summaries with multiple currencies, totals are grouped by project (and therefore by currency). Mixed-currency totals are not combined.

## Audit Trail

Every billing calculation can be traced back to:
- The session record (start time, end time, status)
- The pause records (each pause start/end within the session)
- The project settings (or global defaults) at the time of calculation

Session records are never deleted — even archived projects retain their historical sessions.
