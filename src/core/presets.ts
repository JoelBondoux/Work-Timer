import type { BillingRecord } from '../types.js';

export interface PresetDefinition {
  id: string;
  name: string;
  columns: string[];
  mapRecord: (record: BillingRecord, options: PresetOptions) => string[];
}

export interface PresetOptions {
  accountCode?: string;
  taxType?: string;
  paymentTermsDays?: number;
  invoicePrefix?: string;
}

function formatDate(isoDate: string, fmt: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'): string {
  const d = new Date(isoDate);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  switch (fmt) {
    case 'MM/DD/YYYY': return `${mm}/${dd}/${yyyy}`;
    case 'DD/MM/YYYY': return `${dd}/${mm}/${yyyy}`;
    case 'YYYY-MM-DD': return `${yyyy}-${mm}-${dd}`;
  }
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function sessionDescription(record: BillingRecord): string {
  const timeRange = `${record.start_time.split('T').pop()?.slice(0, 5) ?? ''}-${record.end_time.split('T').pop()?.slice(0, 5) ?? ''}`;
  const desc = `Work session: ${record.date} ${timeRange}`;
  return record.notes ? `${desc} — ${record.notes}` : desc;
}

const quickbooks: PresetDefinition = {
  id: 'quickbooks',
  name: 'QuickBooks Online',
  columns: ['InvoiceNo', 'Customer', 'InvoiceDate', 'DueDate', 'Item(Description)', 'ItemQuantity', 'ItemRate', 'ItemAmount', 'ServiceDate'],
  mapRecord: (record, options) => {
    const terms = options.paymentTermsDays ?? 30;
    return [
      record.invoice_ref ?? '',
      record.project_name,
      formatDate(record.date, 'MM/DD/YYYY'),
      formatDate(addDays(record.date, terms), 'MM/DD/YYYY'),
      sessionDescription(record),
      (record.billed_duration_minutes / 60).toFixed(2),
      record.rate.toFixed(2),
      record.amount.toFixed(2),
      formatDate(record.date, 'MM/DD/YYYY'),
    ];
  },
};

const xero: PresetDefinition = {
  id: 'xero',
  name: 'Xero',
  columns: ['ContactName', 'InvoiceNumber', 'InvoiceDate', 'DueDate', 'Description', 'Quantity', 'UnitAmount', 'AccountCode', 'TaxType'],
  mapRecord: (record, options) => {
    const terms = options.paymentTermsDays ?? 30;
    return [
      record.project_name,
      record.invoice_ref ?? '',
      formatDate(record.date, 'DD/MM/YYYY'),
      formatDate(addDays(record.date, terms), 'DD/MM/YYYY'),
      sessionDescription(record),
      (record.billed_duration_minutes / 60).toFixed(2),
      record.rate.toFixed(2),
      options.accountCode ?? '200',
      options.taxType ?? 'Tax Exempt',
    ];
  },
};

const freshbooks: PresetDefinition = {
  id: 'freshbooks',
  name: 'FreshBooks',
  columns: ['Client', 'Description', 'Amount', 'Date', 'Currency'],
  mapRecord: (record) => [
    record.project_name,
    sessionDescription(record),
    record.amount.toFixed(2),
    formatDate(record.date, 'YYYY-MM-DD'),
    record.currency,
  ],
};

const sage: PresetDefinition = {
  id: 'sage',
  name: 'Sage',
  columns: ['Account Reference', 'Nominal A/C', 'Date', 'Reference', 'Details', 'Net Amount', 'Tax Code', 'Tax Amount'],
  mapRecord: (record, options) => [
    record.project_name,
    options.accountCode ?? '4000',
    formatDate(record.date, 'DD/MM/YYYY'),
    record.invoice_ref ?? '',
    sessionDescription(record),
    record.amount.toFixed(2),
    options.taxType ?? 'T0',
    '0.00',
  ],
};

const myob: PresetDefinition = {
  id: 'myob',
  name: 'MYOB',
  columns: ['Co./Last Name', 'Date', 'Description', 'Account Number', 'Inclusive', 'Amount', 'Job'],
  mapRecord: (record, options) => [
    record.project_name,
    formatDate(record.date, 'DD/MM/YYYY'),
    sessionDescription(record),
    options.accountCode ?? '41000',
    'N',
    record.amount.toFixed(2),
    record.project_name,
  ],
};

export const PRESETS = new Map<string, PresetDefinition>([
  ['quickbooks', quickbooks],
  ['xero', xero],
  ['freshbooks', freshbooks],
  ['sage', sage],
  ['myob', myob],
]);

export function getPreset(id: string): PresetDefinition {
  const preset = PRESETS.get(id.toLowerCase());
  if (!preset) {
    const valid = listPresetIds().join(', ');
    throw new Error(`Unknown export preset "${id}". Valid presets: ${valid}`);
  }
  return preset;
}

export function listPresetIds(): string[] {
  return Array.from(PRESETS.keys());
}
