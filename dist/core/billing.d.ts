import type { Client } from '@libsql/client';
import type { Session, Project, BillingRecord, BillingSummary } from '../types.js';
export declare function applyMinBlock(rawMinutes: number, minBlockMinutes: number): number;
export declare function calculateAmount(billedMinutes: number, ratePerHour: number): number;
export declare function calculateBillingRecord(client: Client, session: Session, project: Project): Promise<BillingRecord>;
export interface BillingQueryFilters {
    projectName?: string;
    from?: string;
    to?: string;
    unbilledOnly?: boolean;
    unpaidOnly?: boolean;
}
export declare function getBillingSummary(client: Client, filters?: BillingQueryFilters): Promise<BillingSummary>;
