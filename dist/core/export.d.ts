import type { Client } from '@libsql/client';
import { type BillingQueryFilters } from './billing.js';
import { type PresetOptions } from './presets.js';
export declare function sanitizeSpreadsheetCell(value: string): string;
export declare function exportCsv(client: Client, filters?: BillingQueryFilters): Promise<string>;
export declare function exportPresetCsv(client: Client, filters: BillingQueryFilters, presetId: string, options?: PresetOptions): Promise<string>;
export declare function exportXlsx(client: Client, filters?: BillingQueryFilters): Promise<Buffer>;
