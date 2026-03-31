import { type Client } from '@libsql/client';
import type { Config } from '../types.js';
export declare function loadConfig(): Config | null;
export declare function createDbClient(url: string, authToken?: string): Client;
export declare function getClient(): Promise<Client>;
export declare function createMemoryClient(): Promise<Client>;
