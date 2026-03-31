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
export declare const PRESETS: Map<string, PresetDefinition>;
export declare function getPreset(id: string): PresetDefinition;
export declare function listPresetIds(): string[];
