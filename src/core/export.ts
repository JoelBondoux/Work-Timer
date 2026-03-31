import type { Client } from '@libsql/client';
import { getBillingSummary, type BillingQueryFilters } from './billing.js';
import type { BillingRecord } from '../types.js';
import writeXlsxFile, { type Cell } from 'write-excel-file/node';
import { getPreset, type PresetOptions } from './presets.js';

const DANGEROUS_SPREADSHEET_PREFIXES = new Set(['=', '+', '-', '@']);

const CSV_HEADERS = [
  'Project',
  'Date',
  'Start',
  'End',
  'Duration (h)',
  'Billed Duration (h)',
  'Rate',
  'Currency',
  'Amount',
  'Invoice Status',
  'Invoice Ref',
  'Payment Status',
  'Notes',
];

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function sanitizeSpreadsheetCell(value: string): string {
  const trimmed = value.trimStart();
  if (!trimmed) {
    return value;
  }

  // Allow plain numeric values (including signed) so amounts and rates remain numeric in exports.
  const looksNumeric = /^[+-]?\d+(\.\d+)?$/.test(trimmed);
  if (!looksNumeric && DANGEROUS_SPREADSHEET_PREFIXES.has(trimmed[0])) {
    return `'${value}`;
  }

  return value;
}

function recordToCsvRow(record: BillingRecord): string {
  const values = [
    sanitizeSpreadsheetCell(record.project_name),
    record.date,
    record.start_time,
    record.end_time,
    (record.raw_duration_minutes / 60).toFixed(2),
    (record.billed_duration_minutes / 60).toFixed(2),
    record.rate.toString(),
    record.currency,
    record.amount.toFixed(2),
    record.invoiced ? 'Invoiced' : 'Not Invoiced',
    sanitizeSpreadsheetCell(record.invoice_ref ?? ''),
    record.paid ? 'Paid' : 'Unpaid',
    sanitizeSpreadsheetCell(record.notes ?? ''),
  ];
  return values.map(escapeCsv).join(',');
}

export async function exportCsv(
  client: Client,
  filters: BillingQueryFilters = {}
): Promise<string> {
  const summary = await getBillingSummary(client, filters);
  const lines = [CSV_HEADERS.join(',')];
  for (const record of summary.records) {
    lines.push(recordToCsvRow(record));
  }
  return lines.join('\n');
}

export async function exportPresetCsv(
  client: Client,
  filters: BillingQueryFilters,
  presetId: string,
  options: PresetOptions = {}
): Promise<string> {
  const preset = getPreset(presetId);
  const summary = await getBillingSummary(client, filters);
  const lines = [preset.columns.map(escapeCsv).join(',')];
  for (const record of summary.records) {
    lines.push(preset.mapRecord(record, options).map(sanitizeSpreadsheetCell).map(escapeCsv).join(','));
  }
  return lines.join('\n');
}

export async function exportXlsx(
  client: Client,
  filters: BillingQueryFilters = {}
): Promise<Buffer> {
  const summary = await getBillingSummary(client, filters);

  const headerStyle = {
    fontWeight: 'bold' as const,
    textColor: '#FFFFFF',
    backgroundColor: '#4472C4',
  };

  const boldStyle = {
    fontWeight: 'bold' as const,
  };

  const numericFormat = '#,##0.00';
  const hourFormat = '0.00';

  const columns = [
    { width: 25 },
    { width: 12 },
    { width: 20 },
    { width: 20 },
    { width: 14 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 30 },
  ];

  const data: Cell[][] = [
    CSV_HEADERS.map((header) => ({ value: header, ...headerStyle })),
  ];

  for (const record of summary.records) {
    data.push([
      { value: sanitizeSpreadsheetCell(record.project_name) },
      { value: record.date },
      { value: record.start_time },
      { value: record.end_time },
      { value: Math.round((record.raw_duration_minutes / 60) * 100) / 100, type: Number, format: hourFormat },
      { value: Math.round((record.billed_duration_minutes / 60) * 100) / 100, type: Number, format: hourFormat },
      { value: record.rate, type: Number, format: numericFormat },
      { value: record.currency },
      { value: record.amount, type: Number, format: numericFormat },
      { value: record.invoiced ? 'Invoiced' : 'Not Invoiced' },
      { value: sanitizeSpreadsheetCell(record.invoice_ref ?? '') },
      { value: record.paid ? 'Paid' : 'Unpaid' },
      { value: sanitizeSpreadsheetCell(record.notes ?? '') },
    ]);
  }

  if (summary.records.length > 0) {
    data.push(new Array(CSV_HEADERS.length).fill(null));
    data.push([{ value: 'TOTALS BY PROJECT', ...boldStyle }]);

    for (const [, total] of summary.totals_by_project) {
      data.push([
        { value: sanitizeSpreadsheetCell(total.project_name) },
        null,
        null,
        null,
        { value: Math.round((total.total_raw_minutes / 60) * 100) / 100, type: Number, format: hourFormat },
        { value: Math.round((total.total_billed_minutes / 60) * 100) / 100, type: Number, format: hourFormat },
        null,
        { value: total.currency },
        { value: total.total_amount, type: Number, format: numericFormat },
      ]);
    }
  }

  return await writeXlsxFile(data, {
    sheet: 'Billing',
    columns,
    buffer: true,
    fontFamily: 'Calibri',
    fontSize: 11,
  });
}
