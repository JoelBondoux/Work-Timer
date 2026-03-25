import { createClient, type Client } from '@libsql/client';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { initializeDatabase } from './schema.js';
import type { Config } from '../types.js';

let _client: Client | null = null;
let _initialized = false;

function getConfigPath(): string {
  return join(homedir(), '.work-timer', 'config.json');
}

export function loadConfig(): Config | null {
  const configPath = getConfigPath();

  // Environment variables take precedence
  const envUrl = process.env.TURSO_DATABASE_URL;
  const envToken = process.env.TURSO_AUTH_TOKEN;

  if (envUrl && envToken) {
    return { turso_url: envUrl, turso_auth_token: envToken };
  }

  // Fall back to config file
  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<Config>;
    if (parsed.turso_url && parsed.turso_auth_token) {
      return parsed as Config;
    }
  }

  return null;
}

export function createDbClient(url: string, authToken?: string): Client {
  return createClient({
    url,
    authToken,
  });
}

export async function getClient(): Promise<Client> {
  if (_client && _initialized) {
    return _client;
  }

  const config = loadConfig();
  if (!config) {
    throw new Error(
      'Work-Timer is not configured. Run "work-timer setup" or set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.'
    );
  }

  _client = createDbClient(config.turso_url, config.turso_auth_token);
  await initializeDatabase(_client);
  _initialized = true;
  return _client;
}

export async function createMemoryClient(): Promise<Client> {
  const client = createDbClient(':memory:');
  await initializeDatabase(client);
  return client;
}
