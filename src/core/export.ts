import type { Client } from '@libsql/client';
import { getBillingSummary, type BillingQueryFilters } from './billing.js';
import type { BillingRecord } from '../types.js';
import ExcelJS from 'exceljs';
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

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Work-Timer';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Billing');

  // Define columns with formatting
  sheet.columns = [
    { header: 'Project', key: 'project', width: 25 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Start', key: 'start', width: 20 },
    { header: 'End', key: 'end', width: 20 },
    { header: 'Duration (h)', key: 'duration', width: 14 },
    { header: 'Billed (h)', key: 'billed', width: 12 },
    { header: 'Rate', key: 'rate', width: 10 },
    { header: 'Currency', key: 'currency', width: 10 },
    { header: 'Amount', key: 'amount', width: 12 },
    { header: 'Invoice Status', key: 'invoiceStatus', width: 15 },
    { header: 'Invoice Ref', key: 'invoiceRef', width: 15 },
    { header: 'Payment Status', key: 'paymentStatus', width: 15 },
    { header: 'Notes', key: 'notes', width: 30 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Add data rows
  for (const record of summary.records) {
    sheet.addRow({
      project: sanitizeSpreadsheetCell(record.project_name),
      date: record.date,
      start: record.start_time,
      end: record.end_time,
      duration: Math.round((record.raw_duration_minutes / 60) * 100) / 100,
      billed: Math.round((record.billed_duration_minutes / 60) * 100) / 100,
      rate: record.rate,
      currency: record.currency,
      amount: record.amount,
      invoiceStatus: record.invoiced ? 'Invoiced' : 'Not Invoiced',
      invoiceRef: sanitizeSpreadsheetCell(record.invoice_ref ?? ''),
      paymentStatus: record.paid ? 'Paid' : 'Unpaid',
      notes: sanitizeSpreadsheetCell(record.notes ?? ''),
    });
  }

  // Format number columns
  sheet.getColumn('duration').numFmt = '0.00';
  sheet.getColumn('billed').numFmt = '0.00';
  sheet.getColumn('rate').numFmt = '#,##0.00';
  sheet.getColumn('amount').numFmt = '#,##0.00';

  // Add totals per project if there are records
  if (summary.records.length > 0) {
    sheet.addRow({}); // blank row

    const totalsHeaderRow = sheet.addRow({
      project: 'TOTALS BY PROJECT',
    });
    totalsHeaderRow.font = { bold: true };

    for (const [, total] of summary.totals_by_project) {
      sheet.addRow({
        project: sanitizeSpreadsheetCell(total.project_name),
        duration: Math.round((total.total_raw_minutes / 60) * 100) / 100,
        billed: Math.round((total.total_billed_minutes / 60) * 100) / 100,
        currency: total.currency,
        amount: total.total_amount,
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
