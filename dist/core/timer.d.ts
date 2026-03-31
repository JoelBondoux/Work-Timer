import type { Client } from '@libsql/client';
import type { Session, RunningTimer } from '../types.js';
export declare function startTimer(client: Client, projectName: string, opts?: {
    rate?: number;
    currency?: string;
    notes?: string;
}): Promise<Session & {
    project_name: string;
}>;
export declare function stopTimer(client: Client, projectName?: string): Promise<Session & {
    project_name: string;
}>;
export declare function pauseTimer(client: Client, projectName?: string): Promise<Session & {
    project_name: string;
}>;
export declare function resumeTimer(client: Client, projectName?: string): Promise<Session & {
    project_name: string;
}>;
export declare function getRunningTimers(client: Client): Promise<RunningTimer[]>;
export declare function getSessionDurationMinutes(client: Client, session: Session): Promise<number>;
