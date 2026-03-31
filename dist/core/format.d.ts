import type { RunningTimer, BillingRecord, ProjectTotal, Project } from '../types.js';
export declare function sanitizeTerminalText(value: string): string;
export declare function formatDuration(minutes: number): string;
export declare function formatRunningTimers(timers: RunningTimer[]): string;
export declare function formatBillingRecords(records: BillingRecord[]): string;
export declare function formatProjectTotals(totals: Map<string, ProjectTotal>): string;
export declare function formatProject(project: Project, effective?: {
    rate: number;
    currency: string;
    minBlock: number;
}): string;
export declare function formatProjectList(projects: Project[]): string;
