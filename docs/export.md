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

Security note: values that look like spreadsheet formulas are exported as literal text to reduce CSV/Excel formula-injection risk.

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

## Accounting Software Presets

Work-Timer includes built-in export presets that produce CSV files with the exact column names, date formats, and structure required by popular accounting packages. No manual column mapping needed.

```bash
work-timer export --preset quickbooks --output march.csv
work-timer export --preset xero --from 2026-03-01 --account-code 400
work-timer export --preset freshbooks --project "Client Alpha"
work-timer export --preset sage --tax-type T1
work-timer export --preset myob --output billing.csv
```

### Available Presets

| Preset | Date Format | Key Columns |
|--------|------------|-------------|
| `quickbooks` | MM/DD/YYYY | InvoiceNo, Customer, InvoiceDate, DueDate, Item(Description), ItemQuantity, ItemRate, ItemAmount, ServiceDate |
| `xero` | DD/MM/YYYY | ContactName, InvoiceNumber, InvoiceDate, DueDate, Description, Quantity, UnitAmount, AccountCode, TaxType |
| `freshbooks` | YYYY-MM-DD | Client, Description, Amount, Date, Currency |
| `sage` | DD/MM/YYYY | Account Reference, Nominal A/C, Date, Reference, Details, Net Amount, Tax Code, Tax Amount |
| `myob` | DD/MM/YYYY | Co./Last Name, Date, Description, Account Number, Inclusive, Amount, Job |

### Preset Options

Some presets accept additional options for fields that don't exist in Work-Timer's data:

| Flag | Default | Used By | Description |
|------|---------|---------|-------------|
| `--account-code <code>` | 200 (Xero), 4000 (Sage), 41000 (MYOB) | Xero, Sage, MYOB | Account/nominal code |
| `--tax-type <type>` | Tax Exempt (Xero), T0 (Sage) | Xero, Sage | Tax type/code |
| `--payment-terms <days>` | 30 | QuickBooks, Xero | Days to add for DueDate |

### Importing into Your Accounting Software

**QuickBooks Online:**
1. `work-timer export --preset quickbooks --output billing.csv`
2. In QuickBooks, go to **Settings > Import Data > Invoices**
3. Upload the CSV — columns should auto-map

**Xero:**
1. `work-timer export --preset xero --output billing.csv`
2. In Xero, go to **Business > Invoices > Import**
3. Upload the CSV — columns match Xero's expected format

**FreshBooks:**
1. `work-timer export --preset freshbooks --output billing.csv`
2. In FreshBooks, go to **Invoices > Import Time Entries**
3. Upload the CSV

**Sage:**
1. `work-timer export --preset sage --output billing.csv`
2. Use Sage's Quick Entry import feature

**MYOB:**
1. `work-timer export --preset myob --output billing.csv`
2. Use MYOB's CSV import tool

### Generic Export (No Preset)

If your accounting software isn't listed, the default CSV/XLSX export includes all billing data. Use your software's column mapping tool to match the fields:

```bash
work-timer export --output billing.csv
```

## Using Export with MCP

Via your AI assistant:

> "Export my billing for Client Alpha as a CSV"

> "Create an Excel report for all work in March and save it to my Desktop"

> "Export my March billing for QuickBooks"

> "Export all unbilled sessions in Xero format with account code 400"

The MCP tools: `export_csv` returns CSV text, `export_xlsx` writes an Excel file, and `export_preset` produces accounting-specific CSV.
For file-writing MCP tools (`export_xlsx`, `export_preset` with `output_path`), `output_path` must be relative and is confined to `~/.work-timer/exports`.
