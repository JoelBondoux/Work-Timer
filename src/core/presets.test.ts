import { describe, it, expect } from 'vitest';
import { getPreset, listPresetIds, PRESETS } from './presets.js';
import type { BillingRecord } from '../types.js';

const sampleRecord: BillingRecord = {
  session_id: 1,
  project_name: 'Client Alpha',
  date: '2026-03-15',
  start_time: '2026-03-15T09:00:00Z',
  end_time: '2026-03-15T11:30:00Z',
  raw_duration_minutes: 150,
  billed_duration_minutes: 150,
  rate: 100,
  currency: 'USD',
  amount: 250.00,
  invoiced: false,
  invoice_ref: null,
  paid: false,
  notes: null,
};

const invoicedRecord: BillingRecord = {
  ...sampleRecord,
  invoiced: true,
  invoice_ref: 'INV-001',
  paid: true,
  notes: 'Bug fix work',
};

describe('getPreset', () => {
  it('returns preset by id', () => {
    const preset = getPreset('quickbooks');
    expect(preset.id).toBe('quickbooks');
  });

  it('is case-insensitive', () => {
    expect(getPreset('QuickBooks').id).toBe('quickbooks');
    expect(getPreset('XERO').id).toBe('xero');
  });

  it('throws on unknown preset', () => {
    expect(() => getPreset('unknown')).toThrow('Unknown export preset');
  });
});

describe('listPresetIds', () => {
  it('returns all preset ids', () => {
    const ids = listPresetIds();
    expect(ids).toContain('quickbooks');
    expect(ids).toContain('xero');
    expect(ids).toContain('freshbooks');
    expect(ids).toContain('sage');
    expect(ids).toContain('myob');
    expect(ids).toHaveLength(5);
  });
});

describe('quickbooks preset', () => {
  const preset = getPreset('quickbooks');

  it('has correct columns', () => {
    expect(preset.columns).toEqual([
      'InvoiceNo', 'Customer', 'InvoiceDate', 'DueDate',
      'Item(Description)', 'ItemQuantity', 'ItemRate', 'ItemAmount', 'ServiceDate',
    ]);
  });

  it('maps record with MM/DD/YYYY dates', () => {
    const row = preset.mapRecord(sampleRecord, {});
    expect(row[0]).toBe('');  // no invoice ref
    expect(row[1]).toBe('Client Alpha');
    expect(row[2]).toBe('03/15/2026');  // InvoiceDate
    expect(row[3]).toBe('04/14/2026');  // DueDate (30 days default)
    expect(row[5]).toBe('2.50');        // hours
    expect(row[6]).toBe('100.00');      // rate
    expect(row[7]).toBe('250.00');      // amount
    expect(row[8]).toBe('03/15/2026');  // ServiceDate
  });

  it('uses invoice_ref when present', () => {
    const row = preset.mapRecord(invoicedRecord, {});
    expect(row[0]).toBe('INV-001');
  });

  it('respects custom payment terms', () => {
    const row = preset.mapRecord(sampleRecord, { paymentTermsDays: 14 });
    expect(row[3]).toBe('03/29/2026');  // 14 days after March 15
  });

  it('includes notes in description', () => {
    const row = preset.mapRecord(invoicedRecord, {});
    expect(row[4]).toContain('Bug fix work');
  });
});

describe('xero preset', () => {
  const preset = getPreset('xero');

  it('has correct columns', () => {
    expect(preset.columns).toEqual([
      'ContactName', 'InvoiceNumber', 'InvoiceDate', 'DueDate',
      'Description', 'Quantity', 'UnitAmount', 'AccountCode', 'TaxType',
    ]);
  });

  it('maps record with DD/MM/YYYY dates and defaults', () => {
    const row = preset.mapRecord(sampleRecord, {});
    expect(row[0]).toBe('Client Alpha');
    expect(row[2]).toBe('15/03/2026');  // DD/MM/YYYY
    expect(row[3]).toBe('14/04/2026');  // DueDate
    expect(row[7]).toBe('200');         // default AccountCode
    expect(row[8]).toBe('Tax Exempt');  // default TaxType
  });

  it('uses custom account code and tax type', () => {
    const row = preset.mapRecord(sampleRecord, { accountCode: '400', taxType: 'OUTPUT2' });
    expect(row[7]).toBe('400');
    expect(row[8]).toBe('OUTPUT2');
  });
});

describe('freshbooks preset', () => {
  const preset = getPreset('freshbooks');

  it('has correct columns', () => {
    expect(preset.columns).toEqual(['Client', 'Description', 'Amount', 'Date', 'Currency']);
  });

  it('maps record with YYYY-MM-DD dates', () => {
    const row = preset.mapRecord(sampleRecord, {});
    expect(row[0]).toBe('Client Alpha');
    expect(row[2]).toBe('250.00');
    expect(row[3]).toBe('2026-03-15');
    expect(row[4]).toBe('USD');
  });
});

describe('sage preset', () => {
  const preset = getPreset('sage');

  it('has correct columns', () => {
    expect(preset.columns[0]).toBe('Account Reference');
    expect(preset.columns[5]).toBe('Net Amount');
    expect(preset.columns[7]).toBe('Tax Amount');
  });

  it('maps record with defaults', () => {
    const row = preset.mapRecord(sampleRecord, {});
    expect(row[0]).toBe('Client Alpha');
    expect(row[1]).toBe('4000');   // default Nominal A/C
    expect(row[2]).toBe('15/03/2026');
    expect(row[5]).toBe('250.00');
    expect(row[6]).toBe('T0');     // default Tax Code
    expect(row[7]).toBe('0.00');
  });
});

describe('myob preset', () => {
  const preset = getPreset('myob');

  it('has correct columns', () => {
    expect(preset.columns[0]).toBe('Co./Last Name');
    expect(preset.columns[4]).toBe('Inclusive');
  });

  it('maps record with defaults', () => {
    const row = preset.mapRecord(sampleRecord, {});
    expect(row[0]).toBe('Client Alpha');
    expect(row[2]).toContain('Work session');
    expect(row[3]).toBe('41000');  // default Account Number
    expect(row[4]).toBe('N');
    expect(row[5]).toBe('250.00');
    expect(row[6]).toBe('Client Alpha');  // Job = project name
  });
});

describe('all presets produce correct column count', () => {
  for (const [id, preset] of PRESETS) {
    it(`${id} mapRecord returns same length as columns`, () => {
      const row = preset.mapRecord(sampleRecord, {});
      expect(row).toHaveLength(preset.columns.length);
    });
  }
});
