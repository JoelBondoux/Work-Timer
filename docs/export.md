# Export Guide

Work-Timer can export billing data as CSV or formatted Excel (XLSX) files for import into accounting software.

## Export Formats

### CSV

Plain-text comma-separated values. Compatible with virtually all accounting and spreadsheet software.

```bash
work-timer export                           # Print CSV to terminal
work-timer export --output billing.csv      # Save to file
work-timer export --project "Client Alpha"  # Filter by project
work-timer export --from 2026-01-01 --to 2026-03-31  # Date range
```

### Excel (XLSX)

Formatted Excel workbook with styled headers, number formatting, and auto-calculated totals by project.

```bash
work-timer export --format xlsx --output billing.xlsx
work-timer export --format xlsx --output q1-billing.xlsx --from 2026-01-01 --to 2026-03-31
```

The XLSX export includes:
- Bold, colored header row
- Number columns formatted to 2 decimal places
- Currency and amount columns properly formatted
- A totals-by-project section at the bottom

## Column Reference

Both CSV and XLSX exports contain these columns:

| Column | Description | Example |
|--------|-------------|---------|
| Project | Project name | Client Alpha |
| Date | Session date (YYYY-MM-DD) | 2026-03-15 |
| Start | Session start time (ISO 8601) | 2026-03-15T09:00:00 |
| End | Session end time (ISO 8601) | 2026-03-15T11:30:00 |
| Duration (h) | Actual working hours (minus pauses) | 2.25 |
| Billed Duration (h) | Hours after min-block rounding | 2.50 |
| Rate | Billing rate per hour | 150.00 |
| Currency | Currency code | USD |
| Amount | Billed amount (billed hours × rate) | 375.00 |
| Invoice Status | "Invoiced" or "Not Invoiced" | Not Invoiced |
| Invoice Ref | Invoice reference number | INV-2026-003 |
| Payment Status | "Paid" or "Unpaid" | Unpaid |
| Notes | Session notes | Sprint planning meeting |

## Filtering Exports

All filters can be combined:

```bash
# Everything for one client in Q1
work-timer export --project "Client Alpha" --from 2026-01-01 --to 2026-03-31

# All unbilled work (use summary command to find session IDs first)
work-timer summary --unbilled
```

## Importing into Accounting Software

### Xero

1. Export as CSV
2. In Xero, go to **Business > Invoices > Import**
3. Map the columns to Xero's fields
4. The "Amount" column maps to the line item total

### QuickBooks Online

1. Export as CSV or XLSX
2. In QuickBooks, go to **Settings > Import Data > Invoices**
3. Map columns: Project → Customer, Amount → Amount, Date → Invoice Date

### FreshBooks

1. Export as CSV
2. In FreshBooks, go to **Invoices > Import Time Entries**
3. Map Duration (h) to Hours and Rate to Rate

### General Approach

For any accounting software:
1. Export as CSV (most universally supported)
2. Open the CSV in your accounting software's import tool
3. Map the relevant columns (typically: Project/Client, Date, Hours, Rate, Amount)
4. Review and confirm the import

## Using Export with MCP

Via your AI assistant:

> "Export my billing for Client Alpha as a CSV"

> "Create an Excel report for all work in March and save it to my Desktop"

> "Export all unbilled sessions as a spreadsheet"

The MCP `export_csv` tool returns the CSV as text in the conversation. The `export_xlsx` tool writes a file to the specified path.
