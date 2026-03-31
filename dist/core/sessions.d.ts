import type { Client } from '@libsql/client';
import type { Session } from '../types.js';
export interface SessionQueryFilters {
    projectName?: string;
    from?: string;
    to?: string;
    status?: 'running' | 'paused' | 'completed';
}
export declare function querySessions(client: Client, filters?: SessionQueryFilters): Promise<(Session & {
    project_name: string;
})[]>;
export declare function getSession(client: Client, id: number): Promise<Session | null>;
export declare function markInvoiced(client: Client, sessionIds: number[], invoiceRef?: string): Promise<number>;
export declare function markPaid(client: Client, sessionIds: number[]): Promise<number>;
export declare function adjustSession(client: Client, sessionId: number, opts: {
    start_time?: string;
    end_time?: string;
}): Promise<Session>;
export declare function addSessionNote(client: Client, sessionId: number, note: string): Promise<void>;
